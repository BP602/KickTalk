import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'

const abs = (rel) => path.normalize(new URL(rel, import.meta.url).pathname)
const INSTR = abs('../instrumentation.js')
const METRICS = abs('../metrics.js')
const TRACING = abs('../tracing.js')
const INDEX = abs('../index.js')

// helper to load module fresh with specific mocks
const loadTelemetry = async (mocks) => {
  vi.resetModules()
  // Apply requested mocks before importing the module
  if (mocks?.instrumentation) {
    vi.doMock(INSTR, () => mocks.instrumentation)
  }
  if (mocks?.metrics) {
    vi.doMock(METRICS, () => mocks.metrics)
  }
  if (mocks?.tracing) {
    vi.doMock(TRACING, () => mocks.tracing)
  }
  // Import fresh after resetting module cache and applying mocks
  const telemetry = await import(INDEX)
  return telemetry
}

describe('telemetry/index.js', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('initializes successfully when instrumentation returns true and records startup event', async () => {
    const initializeTelemetry = vi.fn(() => true)
    const shutdown = vi.fn(() => Promise.resolve())

    const MetricsHelper = {
      recordApplicationStart: vi.fn(),
      incrementWebSocketConnections: vi.fn(),
      decrementWebSocketConnections: vi.fn(),
      recordConnectionError: vi.fn(),
      recordReconnection: vi.fn(),
      recordMessageReceived: vi.fn(),
      recordMessageSent: vi.fn(),
      recordMessageSendDuration: vi.fn(),
      recordError: vi.fn(),
      recordRendererMemory: vi.fn(),
      recordDomNodeCount: vi.fn(),
      incrementOpenWindows: vi.fn(),
      decrementOpenWindows: vi.fn(),
    }

    const addEvent = vi.fn()
    const setAttributes = vi.fn()
    const startActiveSpan = vi.fn((name, cb) => cb({ setAttributes, recordException: vi.fn(), setStatus: vi.fn(), end: vi.fn() }))

    const tracingExports = {
      TracingHelper: { addEvent, setAttributes, startActiveSpan, traceWebSocketConnection: vi.fn(), traceMessageFlow: vi.fn(), traceKickAPICall: vi.fn(), traceAPIRequest: vi.fn(), traceMessageSend: vi.fn((id, content, cb) => cb({ setAttributes, setStatus: vi.fn(), end: vi.fn() })) },
      SpanStatusCode: { OK: 1, ERROR: 2 },
    }

    const telemetry = await loadTelemetry({
      instrumentation: { initializeTelemetry, shutdown },
      metrics: { MetricsHelper },
      tracing: tracingExports,
    })

    expect(telemetry.isInitialized()).toBe(false)

    const ok = telemetry.initTelemetry()
    expect(ok).toBe(true)
    expect(initializeTelemetry).toHaveBeenCalled()
    expect(telemetry.isInitialized()).toBe(true)

    // startup event recorded via KickTalkMetrics.recordApplicationStart -> TracingHelper.addEvent
    expect(addEvent).toHaveBeenCalledWith('application.start', expect.objectContaining({
      'app.version': expect.any(String),
    }))

    await telemetry.shutdownTelemetry()
    expect(shutdown).toHaveBeenCalled()
    expect(telemetry.isInitialized()).toBe(false)
  })

  it('falls back gracefully when module loading fails', async () => {
    // Cause require failures by making each mocked module throw
    const throwingFactory = () => { throw new Error('boom') }

    vi.resetModules()
    vi.doMock(INSTR, throwingFactory)
    vi.doMock(METRICS, throwingFactory)
    vi.doMock(TRACING, throwingFactory)

    const telemetry = await import(INDEX)

    // initTelemetry returns false in fallback
    expect(telemetry.initTelemetry()).toBe(false)

    // metrics methods exist and are no-ops
    telemetry.metrics.recordMessageSent('room', 'regular', 'streamer')
    telemetry.metrics.recordDomNodeCount(42)

    // tracing helper exists and executes callback directly
    const result = telemetry.tracing.traceKickAPICall('/endpoint', 'GET', () => 'ok')
    expect(result).toBe('ok')

    // shutdown resolves without throwing
    await expect(telemetry.shutdownTelemetry()).resolves.toBeUndefined()
  })

  it('traceEmoteLoad sets attributes and status for sync success and error', async () => {
    const initializeTelemetry = vi.fn(() => true)
    const shutdown = vi.fn(() => Promise.resolve())

    const span = {
      setAttributes: vi.fn(),
      recordException: vi.fn(),
      setStatus: vi.fn(),
      end: vi.fn(),
    }

    const tracingExports = {
      TracingHelper: {
        addEvent: vi.fn(),
        setAttributes: vi.fn(),
        startActiveSpan: vi.fn((name, cb) => cb(span)),
        traceWebSocketConnection: vi.fn(),
        traceMessageFlow: vi.fn(),
        traceKickAPICall: vi.fn(),
        traceAPIRequest: vi.fn(),
        traceMessageSend: vi.fn((id, content, cb) => cb(span)),
      },
      SpanStatusCode: { OK: 1, ERROR: 2 },
    }

    const telemetry = await loadTelemetry({
      instrumentation: { initializeTelemetry, shutdown },
      metrics: { MetricsHelper: {} },
      tracing: tracingExports,
    })

    telemetry.initTelemetry()

    // success
    const res = telemetry.tracing.traceEmoteLoad('7tv', 'e1', () => ({ fromCache: true }))
    expect(res).toEqual({ fromCache: true })
    expect(span.setAttributes).toHaveBeenCalledWith(expect.objectContaining({ 'emote.load_success': true }))
    expect(span.setStatus).toHaveBeenCalledWith(expect.objectContaining({ code: 1 }))

    // error
    span.setAttributes.mockClear()
    span.setStatus.mockClear()
    span.recordException.mockClear()

    expect(() => telemetry.tracing.traceEmoteLoad('7tv', 'e2', () => { throw new Error('bad') })).toThrow('bad')
    expect(span.recordException).toHaveBeenCalled()
    expect(span.setStatus).toHaveBeenCalledWith(expect.objectContaining({ code: 2 }))
  })
})
