import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Utility to load the module fresh each time with controlled mocks
async function importTracing() {
  // vi.resetModules() in each test ensures a fresh evaluation
  const mod = await import('../tracing.js')
  // Always return default when present (even if null)
  return Object.prototype.hasOwnProperty.call(mod, 'default') ? mod.default : mod
}

describe('telemetry/tracing bootstrap', () => {
  const originalEnv = { ...process.env }
  let consoleLogSpy
  let consoleWarnSpy
  let consoleErrorSpy

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    delete process.env.OTEL_DIAG_LOG_LEVEL

    // Default: mock electron-store; individual tests override as needed
    vi.doMock('electron-store', () => {
      return {
        default: vi.fn(() => ({
          get: vi.fn((key, def) => {
            if (key === 'telemetry') return { enabled: true }
            return def
          }),
        })),
      }
    })

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // restore env
    process.env = { ...originalEnv }
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  it('exports null when telemetry disabled by user settings', async () => {
    vi.resetModules()

    // electron-store returns enabled: false
    vi.doMock('electron-store', () => {
      return {
        default: vi.fn(() => ({
          get: vi.fn(() => ({ enabled: false })),
        })),
      }
    })

    const sdk = await importTracing()

    expect(sdk).toBeNull()
  })

  it('exports null and warns when electron-store throws', async () => {
    vi.resetModules()

    vi.doMock('electron-store', () => {
      return {
        default: vi.fn(() => { throw new Error('store failure') }),
      }
    })

    const sdk = await importTracing()

    expect(sdk).toBeNull()
    expect(consoleWarnSpy).toHaveBeenCalled()
    const msg = consoleWarnSpy.mock.calls.map(c => String(c[0])).join(' ')
    expect(msg).toContain('[Telemetry] Could not check user settings:')
  })

  // deps-not-available case moved to a dedicated test file to avoid hoisted mock leak

  // success-path covered in tracing.bootstrap.success.test.js
})
