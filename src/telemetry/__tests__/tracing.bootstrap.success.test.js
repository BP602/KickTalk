import { describe, it, expect, vi } from 'vitest'

// Optional metrics SDK can be absent; we won't rely on it

describe('telemetry/tracing bootstrap success path (isolated)', () => {
  it('constructs SDK and installs shutdown handlers', async () => {
    const processOnSpy = vi.spyOn(process, 'on').mockImplementation(() => process)

    // Fresh graph and explicit mocks so CJS require() resolves to mocks
    delete process.env.KICKTALK_TELEMETRY_FORCE_OTEL_MISSING
    vi.resetModules()
    vi.doMock('electron-store', () => ({
      __esModule: true,
      default: vi.fn(() => ({ get: vi.fn((k, d) => (k === 'telemetry' ? { enabled: true } : d)) })),
    }), { virtual: true })
    vi.doMock('@opentelemetry/sdk-node', () => ({
      NodeSDK: vi.fn(() => ({ start: vi.fn(async () => {}), shutdown: vi.fn(async () => {}) })),
    }), { virtual: true })
    vi.doMock('@opentelemetry/api', () => ({
      diag: { setLogger: vi.fn() },
      DiagConsoleLogger: vi.fn(),
      DiagLogLevel: { INFO: 1 },
    }), { virtual: true })
    vi.doMock('@opentelemetry/exporter-trace-otlp-http', () => ({ OTLPTraceExporter: vi.fn(() => ({})) }), { virtual: true })
    vi.doMock('@opentelemetry/exporter-metrics-otlp-http', () => ({ OTLPMetricExporter: vi.fn(() => ({})) }), { virtual: true })
    vi.doMock('@opentelemetry/sdk-trace-base', () => ({ AlwaysOnSampler: vi.fn(() => ({})) }), { virtual: true })
    vi.doMock('@opentelemetry/instrumentation-http', () => ({ HttpInstrumentation: vi.fn(() => ({ __isHttpInst: true })) }), { virtual: true })

    // Force-enable telemetry for test
    process.env.KICKTALK_TELEMETRY_FORCE_ENABLED = '1'
    // Import module (CJS) and allow async bootstrap to complete
    await import('../tracing.js')
    await new Promise(r => setTimeout(r, 0))
    await Promise.resolve()

    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))
    expect(processOnSpy).toHaveBeenCalledWith('exit', expect.any(Function))
  })
})
