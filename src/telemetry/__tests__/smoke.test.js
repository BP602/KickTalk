import { describe, it, expect } from 'vitest'

describe('Telemetry modules (smoke)', () => {
  it('loads metrics helper', async () => {
    const mod = await import('../metrics.js')
    expect(typeof mod.MetricsHelper).toBe('object')
  })

  it('loads error monitoring', async () => {
    const mod = await import('../error-monitoring.js')
    expect(typeof mod.ErrorMonitor).toBe('object')
  })

  it('loads retry utils', async () => {
    const mod = await import('../retry-utils.js')
    expect(typeof mod.RetryUtils).toBe('object')
  })

  it('loads SLO monitoring', async () => {
    const mod = await import('../slo-monitoring.js')
    expect(typeof mod.SLOMonitor).toBe('object')
  })

  it('loads performance budget monitor', async () => {
    const mod = await import('../performance-budget.js')
    expect(typeof mod.performanceBudgetMonitor).toBe('object')
  })

  it('loads tracing bootstrap', async () => {
    const mod = await import('../tracing.js')
    expect(mod).toBeTruthy()
  })

  it('loads prometheus server API', async () => {
    const mod = await import('../prometheus-server.js')
    expect(typeof mod.startMetricsServer).toBe('function')
    expect(typeof mod.stopMetricsServer).toBe('function')
  })

  it('loads user analytics', async () => {
    const mod = await import('../user-analytics.js')
    expect(typeof mod.default || mod.UserAnalytics).toBeTruthy()
  })
})

