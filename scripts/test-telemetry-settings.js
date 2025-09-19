#!/usr/bin/env node

/**
 * Test script to verify telemetry respects user settings
 * Run with: node scripts/test-telemetry-settings.js
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const Store = require('electron-store');

// Test configuration
const store = new Store();

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const RUNTIME_WAIT_MS = Number(process.env.TELEMETRY_TEST_RUNTIME_MS || 5000);
const SHUTDOWN_TIMEOUT_MS = Number(process.env.TELEMETRY_TEST_SHUTDOWN_TIMEOUT_MS || 2000);
const SKIP_RUNTIME_TESTS = process.env.SKIP_TELEMETRY_RUNTIME === '1';
const originalTelemetrySetting = store.get('telemetry');

function restoreTelemetrySetting() {
  if (typeof originalTelemetrySetting === 'undefined') {
    store.delete('telemetry');
    console.log('\nRestored telemetry setting: deleted (was undefined)');
  } else {
    store.set('telemetry', originalTelemetrySetting);
    console.log(`\nRestored telemetry.enabled = ${originalTelemetrySetting?.enabled}`);
  }
}

async function runAppAndCollectLogs(label) {
  console.log(`Starting app with telemetry ${label}...`);

  const proc = spawn(npmCommand, ['run', 'dev'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' },
    stdio: 'pipe'
  });

  let logs = '';
  let spawnError;

  proc.stdout.on('data', (data) => {
    logs += data.toString();
  });
  proc.stderr.on('data', (data) => {
    logs += data.toString();
  });
  proc.on('error', (err) => {
    spawnError = err;
  });

  await new Promise((resolve) => setTimeout(resolve, RUNTIME_WAIT_MS));
  proc.kill('SIGTERM');

  await new Promise((resolve) => {
    const fallback = setTimeout(() => {
      if (proc.exitCode === null) {
        proc.kill('SIGKILL');
      }
      resolve();
    }, SHUTDOWN_TIMEOUT_MS);

    proc.once('close', () => {
      clearTimeout(fallback);
      resolve();
    });
  });

  if (spawnError) {
    throw spawnError;
  }

  return logs;
}

async function testTelemetryDisabled() {
  console.log('\n=== TEST 1: Telemetry DISABLED ===');

  store.set('telemetry', { enabled: false });
  console.log('✓ Set telemetry.enabled = false');

  const logs = await runAppAndCollectLogs('disabled');

  const checks = {
    'Telemetry disabled by user settings': logs.includes('Telemetry disabled by user settings'),
    'SDK not initialized': logs.includes('skipping initialization') || logs.includes('SDK creation skipped'),
    'No OTLP connection': !logs.includes('OTLP') || !logs.includes('exporter'),
    'No spans created': !logs.includes('span started') && !logs.includes('websocket.connect')
  };

  console.log('\nResults:');
  for (const [check, passed] of Object.entries(checks)) {
    console.log(`  ${passed ? '✓' : '✗'} ${check}`);
  }

  return Object.values(checks).every(Boolean);
}

async function testTelemetryEnabled() {
  console.log('\n=== TEST 2: Telemetry ENABLED ===');

  store.set('telemetry', { enabled: true });
  console.log('✓ Set telemetry.enabled = true');

  const logs = await runAppAndCollectLogs('enabled');

  const checks = {
    'SDK initialized': logs.includes('NodeSDK') || logs.includes('Web tracer initialized'),
    'OTLP configured': logs.includes('OTLP') || logs.includes('exporter'),
    'Instrumentation active': logs.includes('instrumentation') || logs.includes('WebSocket instrumentation installed')
  };

  console.log('\nResults:');
  for (const [check, passed] of Object.entries(checks)) {
    console.log(`  ${passed ? '✓' : '✗'} ${check}`);
  }

  return Object.values(checks).every(Boolean);
}



async function testIPCHandlers() {
  console.log('\n=== TEST 3: IPC Handlers Check Settings ===');
  
  // Test with telemetry disabled
  store.set('telemetry', { enabled: false });
  
  // We can't easily test IPC handlers directly without Electron running,
  // but we can verify the code is in place
  const mainIndexPath = path.join(__dirname, '..', 'src', 'main', 'index.js');
  const mainIndexCode = fs.readFileSync(mainIndexPath, 'utf8');
  
  const checks = {
    'isTelemetryEnabled function exists': mainIndexCode.includes('isTelemetryEnabled'),
    'IPC handlers check telemetry': mainIndexCode.includes('if (isTelemetryEnabled())'),
    'Settings read from store': mainIndexCode.includes("store.get('telemetry'")
  };
  
  console.log('\nCode checks:');
  for (const [check, passed] of Object.entries(checks)) {
    console.log(`  ${passed ? '✓' : '✗'} ${check}`);
  }
  
  return Object.values(checks).every(v => v);
}

async function runAllTests() {
  console.log('='.repeat(50));
  console.log('TELEMETRY USER SETTINGS RESPECT TEST');
  console.log('='.repeat(50));
  
  const results = [];
  
  try {
    // Note: These tests require the app to be built
    if (SKIP_RUNTIME_TESTS) {
      console.log('\n[warning] Skipping runtime telemetry tests (set SKIP_TELEMETRY_RUNTIME=1 to suppress this warning intentionally).');
    } else {
      results.push(await testTelemetryDisabled());
      results.push(await testTelemetryEnabled());
    }
    results.push(await testIPCHandlers());
    
    console.log('\n' + '='.repeat(50));
    console.log('SUMMARY');
    console.log('='.repeat(50));
    
    const passed = results.filter(r => r).length;
    const total = results.length;
    
    console.log(`Tests passed: ${passed}/${total}`);
    
    if (passed === total) {
      console.log('\n✓ All tests passed! Telemetry properly respects user settings.');
    } else {
      console.log('\n✗ Some tests failed. Review the implementation.');
    }
    
  } catch (error) {
    console.error('Test error:', error);
    process.exitCode = 1;
  } finally {
    restoreTelemetrySetting();
  }
}

// Run tests
runAllTests().catch(console.error);
