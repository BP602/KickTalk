const REASONS = new Set(['none', 'configuration_missing', 'configuration_invalid', 'restart_required', 'receiver_rejected', 'receiver_unavailable', 'export_error']);

// Only fixed classes and timestamps cross the health boundary. Transport details stay private.
function createTelemetryHealth({ now = Date.now } = {}) {
  let isEnabled = () => false;
  const sources = {
    main: { enabled: true, configured: false, configurationReason: 'restart_required', reason: 'none', result: null, lastResultAt: null, lastFailureAt: null },
    renderer: { enabled: true, configured: false, configurationReason: 'restart_required', reason: 'none', result: null, lastResultAt: null, lastFailureAt: null }
  };
  const listeners = new Set();
  const snapshot = () => Object.fromEntries(Object.entries(sources).map(([name, source]) => {
    const enabled = isEnabled() && source.enabled;
    return [name, {
      state: !enabled ? 'disabled' : !source.configured ? 'not_configured' : source.result || 'no_data',
      reason: !enabled ? 'none' : !source.configured ? source.configurationReason : source.result === 'failed' ? source.reason : 'none',
      lastResultAt: source.lastResultAt,
      lastFailureAt: source.lastFailureAt
    }];
  }));
  const notify = () => { for (const listener of listeners) listener(snapshot()); };
  return {
    snapshot,
    notify,
    setEnabledGetter(getter) { isEnabled = getter; },
    isEnabled: () => isEnabled(),
    configure(name, { enabled = true, configured = false, reason = 'configuration_invalid' }) {
      if (!Object.hasOwn(sources, name)) return;
      Object.assign(sources[name], { enabled: enabled === true, configured: configured === true, configurationReason: REASONS.has(reason) ? reason : 'configuration_invalid' });
      notify();
    },
    recordResult(name, reason = 'none') {
      if (!Object.hasOwn(sources, name) || !isEnabled() || !sources[name].enabled) return;
      const source = sources[name];
      source.result = reason === 'none' ? 'accepted' : 'failed';
      source.reason = REASONS.has(reason) ? reason : 'export_error';
      source.lastResultAt = now();
      if (source.result === 'failed') source.lastFailureAt = source.lastResultAt;
      notify();
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  };
}

function createConsentExporter(exporter, { isEnabled, onResult = () => {} }) {
  return {
    export(data, callback) {
      if (!isEnabled()) { callback({ code: 0 }); return; }
      try {
        exporter.export(data, result => { onResult(result); callback(result); });
      } catch (error) {
        const result = { code: 1, error };
        onResult(result);
        callback(result);
      }
    },
    forceFlush: () => exporter.forceFlush?.() || Promise.resolve(),
    shutdown: () => exporter.shutdown(),
    ...(typeof exporter.selectAggregationTemporality === 'function' ? { selectAggregationTemporality: type => exporter.selectAggregationTemporality(type) } : {}),
    ...(typeof exporter.selectAggregation === 'function' ? { selectAggregation: type => exporter.selectAggregation(type) } : {})
  };
}

module.exports = { createTelemetryHealth, createConsentExporter, telemetryHealth: createTelemetryHealth() };
