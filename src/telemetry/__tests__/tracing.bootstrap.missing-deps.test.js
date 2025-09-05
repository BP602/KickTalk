import { describe, it, expect, vi } from 'vitest'

describe('telemetry/tracing bootstrap missing deps (isolated)', () => {
  it('exports null and logs an error when OTEL modules are missing', async () => {
    vi.resetModules()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Force-enable telemetry and force missing OpenTelemetry deps
    process.env.KICKTALK_TELEMETRY_FORCE_ENABLED = '1'
    process.env.KICKTALK_TELEMETRY_FORCE_OTEL_MISSING = '1'
    const mod = await import('../tracing.js')

    // Expect an error about missing modules
    expect(errSpy).toHaveBeenCalled()
    const first = errSpy.mock.calls[0]?.[0]
    expect(String(first)).toContain('[Telemetry] OpenTelemetry modules are not available, disabling telemetry:')
    // CJS: default export should be null when OTEL deps are missing
    expect(mod?.default ?? mod).toBe(null)
  })
})
