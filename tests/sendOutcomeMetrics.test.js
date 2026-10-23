// @vitest-environment node
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { CHAT_ERROR_CODES } from '../utils/constants.js';

const require = createRequire(import.meta.url);
const { metrics: metricsAPI } = require('@opentelemetry/api');
const { MeterProvider, MetricReader } = require('@opentelemetry/sdk-metrics');

class CollectingReader extends MetricReader {
  async onForceFlush() {}
  async onShutdown() {}
}

const reader = new CollectingReader();
const provider = new MeterProvider({ readers: [reader] });
let helper;

beforeAll(() => {
  metricsAPI.setGlobalMeterProvider(provider);
  ({ MetricsHelper: helper } = require('../src/telemetry/metrics.js'));
});

afterAll(async () => {
  await provider.shutdown();
  metricsAPI.disable();
});

async function collect() {
  const { resourceMetrics, errors } = await reader.collect();
  expect(errors).toEqual([]);
  return resourceMetrics.scopeMetrics.flatMap(scope => scope.metrics);
}

function instrument(all, name) {
  return all.find(metric => metric.descriptor.name === name);
}

function count(metric, outcome, type = 'regular') {
  return (metric?.dataPoints ?? []).filter(point => point.attributes.outcome === outcome && point.attributes.message_type === type)
    .reduce((total, point) => total + point.value, 0);
}

test('real SDK collection separates attempt, API acceptance, rejection, confirmation and no echo', async () => {
  const before = await collect();
  const previousOutcomes = instrument(before, 'kicktalk_message_send_outcomes_total');
  const transitions = [
    { outcome: 'attempted', messageType: 'regular', duration: 0 },
    { outcome: 'rejected', messageType: 'regular', duration: 0.25, cause: 'Unauthorized' },
    { outcome: 'attempted', messageType: 'reply', duration: 0 },
    { outcome: 'api_accepted', messageType: 'reply', duration: 0.5 },
    { outcome: 'unconfirmed', messageType: 'reply', duration: 30, cause: 'SEND_TIMEOUT' },
    { outcome: 'confirmed', messageType: 'reply', duration: 31 },
  ];
  for (const transition of transitions) helper.recordSendOutcome(transition);
  const all = await collect();
  const outcomes = instrument(all, 'kicktalk_message_send_outcomes_total');
  expect(count(outcomes, 'attempted') - count(previousOutcomes, 'attempted')).toBe(1);
  expect(count(outcomes, 'rejected') - count(previousOutcomes, 'rejected')).toBe(1);
  expect(count(outcomes, 'api_accepted') - count(previousOutcomes, 'api_accepted')).toBe(0);
  expect(count(outcomes, 'confirmed') - count(previousOutcomes, 'confirmed')).toBe(0);
  for (const outcome of ['attempted', 'api_accepted', 'unconfirmed', 'confirmed']) {
    expect(count(outcomes, outcome, 'reply') - count(previousOutcomes, outcome, 'reply')).toBe(1);
  }
  const durations = instrument(all, 'kicktalk_message_send_transition_duration_seconds');
  for (const transition of transitions) {
    const point = durations.dataPoints.find(point => point.attributes.outcome === transition.outcome &&
      point.attributes.message_type === transition.messageType);
    const previous = instrument(before, 'kicktalk_message_send_transition_duration_seconds')?.dataPoints
      .find(point => point.attributes.outcome === transition.outcome &&
        point.attributes.message_type === transition.messageType);
    expect(point.value.count - (previous?.value.count ?? 0)).toBe(1);
    expect(point.value.sum - (previous?.value.sum ?? 0)).toBeCloseTo(transition.duration);
    expect(point.attributes).toEqual({ outcome: transition.outcome, message_type: transition.messageType,
      ...(transition.cause ? { cause: transition.cause } : {}) });
  }
});

function mainBoundary(isEnabled = true) {
  const source = readFileSync(new URL('../src/main/index.js', import.meta.url), 'utf8');
  const senderStart = source.indexOf('const requireMainRendererSender =');
  const senderEnd = source.indexOf('\nipcMain.handle(', senderStart);
  const handlerStart = source.indexOf('ipcMain.handle("telemetry:recordSendOutcome"');
  if (handlerStart < 0) throw new Error('Outcome IPC handler unavailable');
  const handlerEnd = source.indexOf('\nipcMain.handle(', handlerStart + 1);
  const trustedRendererUrl = 'file:///synthetic/renderer/index.html';
  const mainFrame = { url: trustedRendererUrl };
  const webContents = { mainFrame };
  const mainWindow = { isDestroyed: () => false, webContents };
  let handler;
  vm.runInNewContext(`${source.slice(senderStart, senderEnd)}\n${source.slice(handlerStart, handlerEnd)}`, {
    mainWindow, isDev: false, process: { env: {} }, URL,
    pathToFileURL: () => new URL(trustedRendererUrl), join: () => '', __dirname: '/synthetic/main',
    ipcMain: { handle: (_name, callback) => { handler = callback; } },
    isTelemetryEnabled: () => isEnabled, metrics: helper, CHAT_ERROR_CODES,
  });
  return { handler, event: { sender: webContents, senderFrame: mainFrame } };
}

test('main IPC rejects foreign senders and invalid or unbounded payloads before SDK mutation', async () => {
  const before = await collect();
  const rejectedBefore = count(instrument(before, 'kicktalk_message_send_outcomes_total'), 'rejected');
  const { handler, event } = mainBoundary();
  const valid = { outcome: 'rejected', messageType: 'regular', duration: 0.1, cause: 'Unauthorized' };
  expect(() => handler({ ...event, sender: {} }, valid)).toThrow();
  expect(() => handler({ ...event, senderFrame: { url: event.senderFrame.url } }, valid)).toThrow();
  const trustedUrl = event.senderFrame.url;
  event.senderFrame.url = 'file:///untrusted/index.html';
  expect(() => handler(event, valid)).toThrow();
  event.senderFrame.url = trustedUrl;
  for (const payload of [null, [], {}, { ...valid, outcome: 'message-body' },
    { ...valid, messageType: 'user-identifier' }, { ...valid, duration: NaN },
    { ...valid, duration: Infinity }, { ...valid, duration: -1 },
    { ...valid, duration: '1' }, { ...valid, cause: 'private raw error' },
    { ...valid, cause: '__proto__' }, { ...valid, cause: 'constructor' },
    { ...valid, cause: null }, { ...valid, cause: 401 },
    { ...valid, chatroomId: 'private-room' }, { ...valid, tempId: 'private-id' }]) {
    expect(() => handler(event, payload)).toThrow();
  }
  const all = await collect();
  const outcomes = instrument(all, 'kicktalk_message_send_outcomes_total');
  expect(count(outcomes, 'rejected')).toBe(rejectedBefore);
  const durationValues = all => instrument(all, 'kicktalk_message_send_transition_duration_seconds')?.dataPoints
    .map(({ attributes, value }) => ({ attributes, value })) ?? [];
  expect(durationValues(all)).toEqual(durationValues(before));
  handler(event, valid);
  const recorded = instrument(await collect(), 'kicktalk_message_send_outcomes_total');
  expect(count(recorded, 'rejected') - rejectedBefore).toBe(1);
  for (const point of recorded.dataPoints) {
    expect(Object.keys(point.attributes).every(key => ['outcome', 'message_type', 'cause'].includes(key))).toBe(true);
  }
});

test('telemetry opt-out records no outcome or duration updates at the main IPC boundary', async () => {
  const before = await collect();
  const { handler, event } = mainBoundary(false);
  handler(event, { outcome: 'confirmed', messageType: 'regular', duration: 0.75 });
  const all = await collect();
  for (const name of ['kicktalk_message_send_outcomes_total', 'kicktalk_message_send_transition_duration_seconds']) {
    const values = metric => (metric?.dataPoints ?? []).map(({ attributes, value }) => ({ attributes, value }));
    expect(values(instrument(all, name))).toEqual(values(instrument(before, name)));
  }
});
