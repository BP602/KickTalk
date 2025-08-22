import { expect } from '@playwright/test';
import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Global setup for Playwright E2E tests
 * Ensures the Electron app is built before running tests
 */
export default async function globalSetup() {
  console.log('🔧 Setting up E2E test environment...');
  
  // Check if the built Electron app exists
  const electronMainPath = join(process.cwd(), 'out/main/index.js');
  
  if (!existsSync(electronMainPath)) {
    console.log('📦 Building Electron app for E2E tests...');
    
    // Build the Electron app
    await new Promise((resolve, reject) => {
      const buildProcess = spawn('pnpm', ['run', 'build'], {
        stdio: 'inherit',
        shell: true
      });
      
      buildProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Electron app built successfully');
          resolve();
        } else {
          console.error('❌ Failed to build Electron app');
          reject(new Error(`Build process exited with code ${code}`));
        }
      });
      
      buildProcess.on('error', (error) => {
        console.error('❌ Build process error:', error);
        reject(error);
      });
    });
  } else {
    console.log('✅ Electron app already built');
  }
  
  // Verify the built app exists
  if (!existsSync(electronMainPath)) {
    throw new Error('❌ Built Electron app not found at: ' + electronMainPath);
  }
  
  console.log('🎭 E2E test environment ready');
}