import { describe, it, expect, vi, beforeEach } from 'vitest'

// Helper to wait for a condition with timeout (bounded loop to satisfy lint rules)
const waitFor = async (predicate, { timeout = 1500, interval = 50 } = {}) => {
  const maxTries = Math.ceil(timeout / interval)
  for (let i = 0; i < maxTries; i++) {
    if (predicate()) return
    await new Promise((r) => setTimeout(r, interval))
  }
  throw new Error('waitFor timeout')
}

// Ensure clean module state between tests
beforeEach(() => {
  vi.resetModules()
  // Fresh localStorage per test
  try {
    localStorage.clear()
  } catch {}
  // Clean up any globals our module may set
  try { delete window.__KT_RENDERER_OTEL_INITIALIZED__ } catch {}
  try { delete window.__KT_OTEL_PROVIDER__ } catch {}
  try { delete window.__KT_TRACER__ } catch {}
  try { delete window.__KT_WEBSOCKET_INSTRUMENTED__ } catch {}
  try { delete window.__KT_EARLY_WEBSOCKET_ACTIVITY__ } catch {}
})

describe('renderer telemetry/webTracing', () => {
  it('initializes and uses IPC relay when telemetry enabled', async () => {
    // Enable telemetry via settings in localStorage (preload sync contract)
    localStorage.setItem('settings', JSON.stringify({ telemetry: { enabled: true } }))

    // Provide preload bridge stubs
    const getOtelConfig = vi.fn().mockResolvedValue({ ok: true, useIpcRelay: true, deploymentEnv: 'test', headers: 'Authorization=Bearer test' })
    const exportTracesJson = vi.fn().mockResolvedValue({ ok: true, status: 204, requestId: 'abc123' })
    window.telemetry = { getOtelConfig, exportTracesJson }

    // Import module under test (runs on import)
    await import('../webTracing.js')

    // Should fetch config
    expect(getOtelConfig).toHaveBeenCalled()

    // The module emits a smoke test span which should trigger an IPC export;
    // wait until exportTracesJson is called
    await waitFor(() => exportTracesJson.mock.calls.length > 0)

    // Basic shape assertion for OTLP JSON relay
    const [payload] = exportTracesJson.mock.calls[0]
    expect(payload).toBeTruthy()
    expect(Array.isArray(payload?.resourceSpans)).toBe(true)
  })

  it('skips initialization when telemetry disabled via settings', async () => {
    // Disable telemetry
    localStorage.setItem('settings', JSON.stringify({ telemetry: { enabled: false } }))

    const getOtelConfig = vi.fn().mockResolvedValue({ ok: true, useIpcRelay: true })
    const exportTracesJson = vi.fn().mockResolvedValue({ ok: true })
    window.telemetry = { getOtelConfig, exportTracesJson }

    await import('../webTracing.js')

    // When disabled, module should not request config nor export spans
    expect(getOtelConfig).not.toHaveBeenCalled()
    expect(exportTracesJson).not.toHaveBeenCalled()
  })
})
