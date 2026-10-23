import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const { createTelemetryHealth, createConsentExporter } =
  createRequire(import.meta.url)('../src/main/services/telemetryHealth.cjs');

const create = (enabled = true) => {
  let clock = 1000;
  const state = { enabled };
  const health = createTelemetryHealth({ now: () => (clock += 1000) });
  health.setEnabledGetter(() => state.enabled);
  return { health, state };
};

describe('telemetry health state', () => {
  it('reports disabled before configuration or results, with null timestamps', () => {
    const { health } = create(false);
    health.configure('main', { configured: true });
    expect(health.snapshot().main).toEqual({
      state: 'disabled', reason: 'none', lastResultAt: null, lastFailureAt: null
    });
  });

  it('distinguishes not_configured, no_data and accepted', () => {
    const { health } = create();
    expect(health.snapshot().renderer).toMatchObject({ state: 'not_configured', reason: 'restart_required' });
    health.configure('renderer', { configured: false, reason: 'configuration_missing' });
    expect(health.snapshot().renderer).toMatchObject({ state: 'not_configured', reason: 'configuration_missing' });
    health.configure('renderer', { configured: true });
    expect(health.snapshot().renderer).toMatchObject({ state: 'no_data', lastResultAt: null });
    health.recordResult('renderer');
    expect(health.snapshot().renderer).toMatchObject({ state: 'accepted', reason: 'none', lastFailureAt: null });
  });

  it('clears the current failure on recovery but keeps the prior failure timestamp', () => {
    const { health } = create();
    health.configure('main', { configured: true });
    health.recordResult('main', 'receiver_rejected');
    const failed = health.snapshot().main;
    expect(failed).toMatchObject({ state: 'failed', reason: 'receiver_rejected' });
    expect(failed.lastFailureAt).toBe(failed.lastResultAt);
    health.recordResult('main');
    const recovered = health.snapshot().main;
    expect(recovered).toMatchObject({ state: 'accepted', reason: 'none', lastFailureAt: failed.lastFailureAt });
    expect(recovered.lastResultAt).toBeGreaterThan(failed.lastResultAt);
  });

  it('collapses unknown reasons to fixed classes and records nothing while disabled', () => {
    const { health, state } = create();
    health.configure('main', { configured: true });
    health.recordResult('main', 'ECONNREFUSED https://secret.example');
    expect(health.snapshot().main).toMatchObject({ state: 'failed', reason: 'export_error' });
    state.enabled = false;
    const before = health.snapshot().main;
    health.recordResult('main');
    state.enabled = true;
    expect(health.snapshot().main).toMatchObject({ lastResultAt: before.lastResultAt, state: 'failed' });
    expect(JSON.stringify(health.snapshot())).not.toContain('secret');
  });

  it('notifies subscribers with snapshots until unsubscribed', () => {
    const { health } = create();
    const listener = vi.fn();
    const unsubscribe = health.subscribe(listener);
    health.configure('main', { configured: true });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].main.state).toBe('no_data');
    unsubscribe();
    health.recordResult('main');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('consent exporter', () => {
  it('makes no export attempt while disabled and reports success to the SDK', () => {
    const exporter = { export: vi.fn(), forceFlush: vi.fn(), shutdown: vi.fn() };
    const onResult = vi.fn();
    const wrapped = createConsentExporter(exporter, { isEnabled: () => false, onResult });
    const callback = vi.fn();
    wrapped.export([], callback);
    expect(exporter.export).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith({ code: 0 });
  });

  it('passes enabled exports through and reports each result once', () => {
    const failure = { code: 1, error: new Error('x') };
    const exporter = { export: vi.fn((_data, cb) => cb(failure)), forceFlush: vi.fn(), shutdown: vi.fn() };
    const onResult = vi.fn();
    const wrapped = createConsentExporter(exporter, { isEnabled: () => true, onResult });
    const callback = vi.fn();
    wrapped.export([], callback);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith(failure);
    expect(callback).toHaveBeenCalledWith(failure);
  });

  it('turns a synchronous exporter throw into a failed result', () => {
    const exporter = { export: () => { throw new Error('boom'); }, shutdown: vi.fn() };
    const onResult = vi.fn();
    const wrapped = createConsentExporter(exporter, { isEnabled: () => true, onResult });
    const callback = vi.fn();
    wrapped.export([], callback);
    expect(callback.mock.calls[0][0].code).toBe(1);
    expect(onResult).toHaveBeenCalledTimes(1);
  });
});
