#!/usr/bin/env node
// Repeatable failure-path OTEL check against the local LGTM container.
//
//   npm run build && npm run smoke:otel-failures [-- --serial]
//
// The harness (host side) owns the LGTM lifecycle, Tempo readback, assertions and
// cleanup. Each app launch runs inside a throwaway `unshare -rn` network
// namespace ("agent" mode) whose only interfaces are a fresh loopback:
//   - kick.com, 7tv.io, api.kicktalk.app and cdn.kicktalk.app are mapped by
//     Chromium to a local HTTPS stub (throwaway self-signed cert, trusted by
//     SPKI pin) that scripts the external API boundary. Nothing else is
//     replaced: the real preload bridge, store, OpenTelemetry SDK, IPC relay
//     and exporters run unmodified.
//   - 127.0.0.1:4318 inside the namespace is a counting "receiver gate" that
//     either rejects (HTTP 401) or forwards to the host's LGTM through a unix
//     socket, so receiver-side counts are observed at the real boundary.
//   - Kick/Cloud are unreachable: the namespace has no route out (verified).
//   - The gate decodes OTLP/HTTP JSON traces and metrics. Send-outcome counts are
//     asserted from the latest cumulative snapshot per series, never summed. Synthetic
//     realtime echoes enter through the existing main -> renderer `kick:realtime:event`
//     IPC channel; no store or telemetry helper fakes a transition. A fifth launch turns
//     telemetry off at runtime (window.app.store.set) and requires zero further requests.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import dns from 'node:dns/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import WebSocket from 'ws';

const SELF = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(SELF), '..');
const CONTAINER = 'kicktalk-lgtm';
const OTLP_PORT = 4318;
const TEMPO = 'http://127.0.0.1:3200';
const STUB_HOSTS = ['kick.com', '7tv.io', 'api.kicktalk.app', 'cdn.kicktalk.app'];
const CONFIRMATION_MS = 30000;
const exec = promisify(execFile);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Pure decoding / assertion helpers (unit-tested in tests/otelFailureSmoke.test.js)
// ---------------------------------------------------------------------------

export const OPERATION = { send: 'chat.send', reply: 'chat.reply' };
export const API_SPAN = { send: 'chat.api.sendMessage', reply: 'chat.api.sendReply' };
export const COMPOSER_SPAN = 'chat.input.send_message';
export const SEND_METRICS = {
  outcomes: 'kicktalk_message_send_outcomes_total',
  duration: 'kicktalk_message_send_transition_duration_seconds',
};
const STATUS = { STATUS_CODE_UNSET: 0, STATUS_CODE_OK: 1, STATUS_CODE_ERROR: 2 };
const REASON_PATTERN = {
  mapped: /slow mode/i,
  unknown: /error occurred while sending/i,
  unauth: /login/i,
  timeout: /could not be confirmed/i,
};
const FAILURE = {
  mapped: { code: 'SLOW_MODE_ERROR', http: 422 },
  unknown: { code: 'UNKNOWN_SEND_ERROR', http: 503 },
  unauth: { code: 'Unauthorized', http: undefined },
};
const spanCount = (kind, retry = false) =>
  (kind === 'unauth' ? 2 : ['mapped', 'unknown', 'retry_rejected'].includes(kind) ? 3 : 4) - Number(retry);

// The preload's per-channel guard (utils/services/kick/kickAPI.js) refuses the 9th send
// inside 3 s and then declines everything for 5 s, locally and without a request. Keep the
// scripted sends well below it (at most 7 per 3.5 s) so every fixture reaches the stub.
export const SEND_PACING = { windowMs: 3500, maxAttempts: 7 };
export function sendPacingDelayMs(attemptTimes, now, { windowMs, maxAttempts } = SEND_PACING) {
  const recent = attemptTimes.filter(at => now - at < windowMs).sort((a, b) => a - b);
  return recent.length < maxAttempts ? 0 : recent[recent.length - maxAttempts] + windowMs - now;
}

// Tempo returns ids as base64 in its v1 JSON and hex elsewhere; 16/32 character
// strings are always hex (base64 of 8/16 bytes is 12/24 characters).
export function hexId(value) {
  if (typeof value !== 'string' || !value) return '';
  if (/^(?:[0-9a-f]{16}|[0-9a-f]{32})$/i.test(value)) return value.toLowerCase();
  return Buffer.from(value, 'base64').toString('hex');
}

export function decodeAttributes(list = []) {
  const decode = value => {
    if (!value || typeof value !== 'object') return undefined;
    if ('stringValue' in value) return value.stringValue;
    if ('intValue' in value) return Number(value.intValue);
    if ('doubleValue' in value) return Number(value.doubleValue);
    if ('boolValue' in value) return value.boolValue;
    if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
    return undefined;
  };
  return Object.fromEntries((list || []).map(entry => [entry.key, decode(entry.value)]));
}

const nanosToMs = value => (value === undefined ? NaN : Number(BigInt(value)) / 1e6);

export function normalizeSpans(data) {
  const batches = data?.batches || data?.resourceSpans || data?.trace?.resourceSpans || [];
  return batches.flatMap(batch => {
    const resource = decodeAttributes(batch.resource?.attributes);
    return (batch.scopeSpans || batch.instrumentationLibrarySpans || []).flatMap(scope =>
      (scope.spans || []).map(span => ({
        name: span.name,
        traceId: hexId(span.traceId),
        spanId: hexId(span.spanId),
        parentSpanId: hexId(span.parentSpanId),
        status: typeof span.status?.code === 'string' ? (STATUS[span.status.code] ?? 0) : (span.status?.code ?? 0),
        statusMessage: span.status?.message ?? '',
        attrs: decodeAttributes(span.attributes),
        resource,
        scope: (scope.scope || scope.instrumentationLibrary)?.name,
        events: (span.events || []).map(event => ({ name: event.name, attrs: decodeAttributes(event.attributes) })),
        startMs: nanosToMs(span.startTimeUnixNano),
        endMs: nanosToMs(span.endTimeUnixNano),
      })));
  });
}

// Decode the actual SDK wire payload, not telemetry IPC calls or application logs.
// Cumulative points are snapshots: repeated exports must never be added together.
export function normalizeMetrics(data) {
  return (data?.resourceMetrics || []).flatMap(batch => {
    const resource = decodeAttributes(batch.resource?.attributes);
    return (batch.scopeMetrics || []).flatMap(scope => (scope.metrics || []).flatMap(metric => {
      const type = metric.sum ? 'sum' : metric.histogram ? 'histogram' : 'gauge';
      const aggregation = metric[type];
      return (aggregation?.dataPoints || []).map(point => ({
        name: metric.name, type, resource, attrs: decodeAttributes(point.attributes),
        temporality: aggregation.aggregationTemporality, monotonic: aggregation.isMonotonic,
        start: point.startTimeUnixNano, time: point.timeUnixNano,
        value: Number(point.asInt ?? point.asDouble), count: Number(point.count), sum: Number(point.sum),
        buckets: (point.bucketCounts || []).map(Number),
      }));
    }));
  });
}

const metricKey = attrs => JSON.stringify(Object.entries(attrs).sort(([a], [b]) => a.localeCompare(b)));

export function expectSendMetrics(records, expected) {
  const points = records.filter(record => record.path === '/v1/metrics').flatMap(record => record.metrics || [])
    .filter(point => Object.values(SEND_METRICS).includes(point.name));
  assert(points.length, 'receiver captured no send-outcome metric points');
  const wanted = new Map(expected.map(({ outcome, messageType, cause, count }) => [
    metricKey({ outcome, message_type: messageType, ...(cause ? { cause } : {}) }), count,
  ]));
  for (const [name, type] of [[SEND_METRICS.outcomes, 'sum'], [SEND_METRICS.duration, 'histogram']]) {
    const series = new Map();
    for (const point of points.filter(item => item.name === name)) {
      assert.equal(point.resource['service.name'], 'kicktalk', `${name}: not exported by main SDK`);
      assert.equal(point.type, type, `${name}: wrong instrument type`);
      assert([2, 'AGGREGATION_TEMPORALITY_CUMULATIVE'].includes(point.temporality), `${name}: not cumulative`);
      assert.deepEqual(Object.keys(point.attrs).sort(), point.attrs.cause
        ? ['cause', 'message_type', 'outcome'] : ['message_type', 'outcome'], `${name}: unbounded metric dimensions`);
      const key = metricKey(point.attrs);
      assert(wanted.has(key), `${name}: unexpected outcome/type/cause label set`);
      const value = type === 'sum' ? point.value : point.count;
      assert(Number.isSafeInteger(value) && value >= 0, `${name}: invalid transition count`);
      const previous = series.get(key);
      assert(!previous || previous.start === point.start, `${name}: metric stream restarted`);
      assert(!previous || value >= previous.value, `${name}: cumulative count decreased`);
      if (type === 'sum') assert.equal(point.monotonic, true, `${name}: counter is not monotonic`);
      else {
        assert(Number.isFinite(point.sum) && point.sum >= 0, `${name}: invalid duration sum`);
        assert.equal(point.buckets.reduce((total, count) => total + count, 0), point.count, `${name}: histogram bucket count`);
        if (point.attrs.outcome === 'attempted') assert.equal(point.sum, 0, `${name}: attempted duration must be zero`);
        if (point.attrs.outcome === 'unconfirmed') {
          assert(point.sum >= point.count * (CONFIRMATION_MS / 1000 - 0.5), `${name}: timeout duration was not measured`);
        }
      }
      series.set(key, { value, start: point.start });
    }
    assert.equal(series.size, wanted.size, `${name}: missing transition label sets`);
    for (const [key, count] of wanted) assert.equal(series.get(key)?.value, count, `${name}: wrong exact transition count ${key}`);
  }
  return expected.reduce((total, item) => total + item.count, 0);
}

export function decodeOtlpBody(body, headers = {}) {
  let buffer = body;
  try {
    if (/gzip/i.test(headers['content-encoding'] || '')) buffer = zlib.gunzipSync(body);
  } catch {
    return { encoding: 'undecodable', services: [], spans: [], metrics: [], text: '' };
  }
  const text = buffer.toString('latin1');
  if (!/json/i.test(headers['content-type'] || '')) return { encoding: 'binary', services: [], spans: [], metrics: [], text };
  try {
    const json = JSON.parse(buffer.toString('utf8'));
    const spans = normalizeSpans(json);
    const resources = [...(json.resourceSpans || []), ...(json.resourceMetrics || [])];
    const services = [...new Set(resources
      .map(entry => decodeAttributes(entry.resource?.attributes)['service.name']).filter(Boolean))];
    return { encoding: 'json', services, spans: spans.map(({ name, traceId, spanId }) => ({ name, traceId, spanId })),
      metrics: normalizeMetrics(json), text };
  } catch {
    return { encoding: 'invalid-json', services: [], spans: [], metrics: [], text };
  }
}

export const forbiddenHits = (text, markers) => markers.filter(marker => text.includes(marker));

// HTTP 404 is the only response that proves a trace is absent; transport,
// server and parse failures are errors the caller must surface, never "absent".
export function classifyTempoHttp(status, bodyText) {
  if (status === 404) return { kind: 'absent' };
  if (!Number.isInteger(status) || status < 200 || status >= 300) {
    return { kind: 'error', message: `Tempo query failed (HTTP ${status ?? 'transport'})` };
  }
  try {
    return { kind: 'ok', data: JSON.parse(bodyText) };
  } catch {
    return { kind: 'error', message: 'Tempo returned invalid JSON' };
  }
}

// Source files (relative path + mtime) newer than the build output make it stale.
export function staleSourceFiles(files, buildMtimeMs) {
  return files.filter(file => file.mtimeMs > buildMtimeMs).map(file => file.path);
}

// Asserts the complete composer -> provider -> API tree as stored by Tempo.
// Manual retry deliberately starts a fresh provider root: it is not a composer action.
export function expectSendTrace(spans, { action, kind, tempId, reason, retry = false }) {
  const label = `${kind}/${action}`;
  const operationName = OPERATION[action];
  const one = name => {
    const found = spans.filter(span => span.name === name);
    assert.equal(found.length, 1, `${label}: expected exactly one ${name}, found ${found.length}`);
    return found[0];
  };
  assert.equal(spans.length, spanCount(kind, retry), `${label}: expected ${spanCount(kind, retry)} spans, found ${spans.length}`);
  assert.equal(new Set(spans.map(span => span.traceId)).size, 1, `${label}: spans span several traces`);
  const operation = one(operationName);
  const operationId = operation.attrs['message.operation_id'];
  assert(typeof operationId === 'string' && operationId.length > 0, `${label}: missing operation id`);
  const input = retry ? null : one(COMPOSER_SPAN);
  assert.equal(operation.parentSpanId, input?.spanId || '', `${label}: provider is not a child of composer (or retry root)`);
  if (input) assert.equal(input.parentSpanId, '', `${label}: composer is not a root`);
  const noHttp = span => assert(!('http.response.status_code' in span.attrs), `${label}: ${span.name} invented an HTTP status`);
  for (const span of spans) {
    assert.equal(span.resource['service.name'], 'kicktalk-renderer', `${label}: ${span.name} wrong service`);
    assert(span.resource['service.version'], `${label}: ${span.name} missing service.version`);
    assert.equal(span.attrs['message.operation_id'], operationId, `${label}: operation id differs across layers`);
    if (kind !== 'unauth') assert.equal(span.attrs['message.temp_id'], tempId, `${label}: ${span.name} temp id differs from the UI row`);
  }
  if (kind === 'unauth') {
    assert.match(reason, REASON_PATTERN.unauth);
    for (const span of [input, operation]) {
      assert.equal(span.status, 2, `${label}: local rejection is not ERROR`);
      assert.equal(span.statusMessage, reason, `${label}: status message differs from the UI reason`);
      assert.equal(span.attrs['error.type'], FAILURE.unauth.code);
      noHttp(span);
      assert(!('message.temp_id' in span.attrs), `${label}: no row exists, so no temp id`);
    }
    return { traceId: operation.traceId, operationId };
  }
  const api = one(API_SPAN[action]);
  assert.equal(api.parentSpanId, operation.spanId, `${label}: API span is not a child of the operation`);
  assert.equal(api.attrs['http.request.method'], 'POST');
  assert(operation.events.some(event => event.name === 'optimistic.add' && event.attrs['message.temp_id'] === tempId),
    `${label}: missing optimistic.add event`);
  const failureKind = kind === 'retry_rejected' ? 'mapped' : kind;
  if (failureKind === 'mapped' || failureKind === 'unknown') {
    assert.match(reason, REASON_PATTERN[failureKind]);
    for (const span of [input, operation, api].filter(Boolean)) {
      assert.equal(span.status, 2, `${label}: ${span.name} is not ERROR`);
      assert.equal(span.statusMessage, reason, `${label}: ${span.name} status message differs from the UI reason`);
      assert.equal(span.attrs['error.type'], FAILURE[failureKind].code, `${label}: ${span.name} cause`);
      assert.equal(span.attrs['http.response.status_code'], FAILURE[failureKind].http, `${label}: ${span.name} HTTP status`);
    }
    return { traceId: operation.traceId, operationId };
  }
  for (const span of [input, operation, api].filter(Boolean)) {
    assert.notEqual(span.status, 2, `${label}: ${span.name} must not be ERROR`);
    assert(!('error.type' in span.attrs), `${label}: ${span.name} must not carry a cause`);
  }
  assert.equal(api.attrs['http.response.status_code'], 200, `${label}: API HTTP status`);
  const confirmed = ['confirmed', 'concurrent', 'retry_confirmed'].includes(kind);
  const terminal = one(`${operationName}.${confirmed ? 'confirmed' : 'confirmation_timeout'}`);
  assert.equal(terminal.parentSpanId, operation.spanId, `${label}: terminal span is not a child of the operation`);
  assert.equal(terminal.attrs['message.delivery'], confirmed ? 'confirmed' : 'unconfirmed');
  noHttp(terminal);
  if (confirmed) {
    assert.notEqual(terminal.status, 2, `${label}: confirmation must not be ERROR`);
    assert(!('error.type' in terminal.attrs), `${label}: confirmation must not carry a cause`);
    assert(terminal.startMs >= operation.startMs, `${label}: confirmation precedes attempt`);
    return { traceId: operation.traceId, operationId };
  }
  assert.match(reason, REASON_PATTERN.timeout);
  assert.equal(terminal.status, 2);
  assert.equal(terminal.statusMessage, reason, `${label}: timeout message differs from the UI reason`);
  assert.equal(terminal.attrs['error.type'], 'SEND_TIMEOUT');
  const elapsed = terminal.startMs - operation.startMs;
  assert(elapsed >= CONFIRMATION_MS - 500 && elapsed < CONFIRMATION_MS + 15000,
    `${label}: timeout started ${Math.round(elapsed)}ms after the send, expected about 30000`);
  if (kind === 'pending') assert(terminal.startMs < operation.endMs, `${label}: request should still have been pending when the timeout fired`);
  else assert(terminal.startMs >= operation.endMs, `${label}: operation should have ended before the timeout fired`);
  return { traceId: operation.traceId, operationId, elapsedMs: Math.round(elapsed) };
}

// ---------------------------------------------------------------------------
// Plans shared by the host and the agents
// ---------------------------------------------------------------------------

const entry = (n, kind, action) => ({ n, kind, action });
const markerFor = ({ n, kind, action }) => `KTSYNTH ${String(kind === 'concurrent' ? (action === 'send' ? 14 : 16) : n).padStart(2, '0')} ${kind} ${action}`;
const PLANS = {
  // Start all 30 s cases first; keep pending/unknown coverage from the original smoke.
  failures: [
    entry(1, 'accepted', 'send'), entry(2, 'accepted', 'reply'), entry(3, 'pending', 'send'), entry(4, 'pending', 'reply'),
    entry(11, 'late', 'send'), entry(12, 'late', 'reply'),
    entry(5, 'mapped', 'send'), entry(6, 'mapped', 'reply'), entry(7, 'unknown', 'send'), entry(8, 'unknown', 'reply'),
    entry(9, 'confirmed', 'send'), entry(10, 'confirmed', 'reply'), entry(13, 'retry_rejected', 'send'),
    entry(14, 'concurrent', 'send'), entry(15, 'concurrent', 'send'),
    entry(16, 'concurrent', 'reply'), entry(17, 'concurrent', 'reply'),
  ],
  unauth: [entry(1, 'unauth', 'send'), entry(2, 'unauth', 'reply')],
  exporter: [entry(1, 'mapped', 'send'), entry(2, 'mapped', 'send')],
  disabled: [entry(1, 'mapped', 'send')],
  runtime: [entry(1, 'mapped', 'send'), entry(2, 'mapped', 'send'), entry(3, 'mapped', 'reply')],
};

const metricExpectation = (kind) => {
  if (kind === 'unauth') return ['regular', 'reply'].flatMap(messageType => [
    { messageType, outcome: 'attempted', count: 1 }, { messageType, outcome: 'rejected', cause: 'Unauthorized', count: 1 },
  ]);
  return [
    ['regular', 10, 7, 4, 3, 2, 1],
    ['reply', 8, 6, 3, 3, 1, 1],
  ].flatMap(([messageType, attempted, accepted, confirmed, unconfirmed, mapped, unknown]) => [
    { messageType, outcome: 'attempted', count: attempted },
    { messageType, outcome: 'api_accepted', count: accepted },
    { messageType, outcome: 'confirmed', count: confirmed },
    { messageType, outcome: 'unconfirmed', cause: 'SEND_TIMEOUT', count: unconfirmed },
    { messageType, outcome: 'rejected', cause: 'SLOW_MODE_ERROR', count: mapped },
    { messageType, outcome: 'rejected', cause: 'UNKNOWN_SEND_ERROR', count: unknown },
  ]);
};
const PEER = { id: 'ktpeer-message-1', username: 'ktpeer', content: 'KTPEER synthetic peer message' };

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

async function waitFor(what, probe, { timeoutMs = 15000, intervalMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const value = await probe();
      if (value) return value;
    } catch { /* transient: context destroyed during reload, target not up yet */ }
    if (Date.now() >= deadline) throw new Error(`Timed out after ${timeoutMs}ms waiting for ${what}`);
    await delay(intervalMs);
  }
}

async function connectDebugger(port, pick, timeoutMs = 30000) {
  const target = await waitFor(`debugger target on ${port}`, async () => {
    const list = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(3000) }).then(response => response.json());
    return list.find(item => item.webSocketDebuggerUrl && pick(item));
  }, { timeoutMs });
  const ws = new WebSocket(target.webSocketDebuggerUrl, { handshakeTimeout: 5000 });
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  let nextId = 0;
  const pending = new Map();
  ws.on('message', raw => {
    const message = JSON.parse(String(raw));
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 20000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
  return {
    send,
    async evaluate(expression) {
      const result = await send('Runtime.evaluate', {
        expression, awaitPromise: true, returnByValue: true, includeCommandLineAPI: true,
      });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description?.split('\n')[0] || result.exceptionDetails.text);
      }
      return result.result.value;
    },
    close() { ws.close(); },
  };
}

// ---------------------------------------------------------------------------
// Agent (runs inside `unshare -rn`): stub API, receiver gate, app, UI driver
// ---------------------------------------------------------------------------

const json = (value, status = 200) => ({ status, body: JSON.stringify(value) });

function startStub(cfg) {
  const sends = [];
  const routes = {};
  const hostsSeen = new Set();
  const held = new Map();
  const peerMessage = {
    id: PEER.id, chatroom_id: cfg.chatId, content: PEER.content, type: 'message',
    created_at: new Date().toISOString(), metadata: '{}',
    sender: { id: 7001, username: PEER.username, slug: PEER.username, identity: { color: '#7aa2f7', badges: [] } },
  };
  const acceptedBody = { data: { id: 'synthetic-accepted' }, status: { error: false, code: 200 } };

  const server = https.createServer({ key: fs.readFileSync(cfg.keyPath), cert: fs.readFileSync(cfg.certPath) }, (req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const host = String(req.headers.host || '').replace(/:443$/, '');
      const [pathname] = req.url.split('?');
      hostsSeen.add(host);
      const route = `${req.method} ${host}${pathname.replace(/\d+/g, ':n')}`;
      routes[route] = (routes[route] || 0) + 1;
      const headers = {
        'access-control-allow-origin': req.headers.origin || '*',
        'access-control-allow-headers': req.headers['access-control-request-headers'] || '*',
        'access-control-allow-methods': '*',
        'content-type': 'application/json',
      };
      const reply = ({ status, body }) => { res.writeHead(status, headers); res.end(body); return status; };
      if (req.method === 'OPTIONS') return reply({ status: 204, body: '' });
      if (host === 'kick.com' && pathname === '/api/v1/user') {
        if (!req.headers.authorization) return reply(json({ message: 'unauthenticated' }, 401));
        return reply(json({ id: 9001, username: 'ktsmoke-sender', streamer_channel: { user_id: 9001, slug: 'ktsmoke-sender' } }));
      }
      if (host === 'kick.com' && /^\/api\/v2\/channels\/\d+\/messages$/.test(pathname)) {
        return reply(json({ data: { messages: [peerMessage], pinned_message: null } }));
      }
      if (host === 'kick.com' && /^\/emotes\//.test(pathname)) return reply(json([]));
      if (host === 'kick.com' && req.method === 'POST' && /^\/api\/v2\/messages\/send\/\d+$/.test(pathname)) {
        let parsed = null;
        try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* recorded as a malformed send */ }
        const match = /^KTSYNTH (\d\d) (mapped|unknown|accepted|pending|unauth|confirmed|late|retry_rejected|concurrent) (send|reply)$/.exec(parsed?.content ?? '');
        const prior = sends.filter(item => item.sourceN === Number(match?.[1]) && item.action === match?.[3]).length;
        const record = {
          at: Date.now(), sourceN: Number(match?.[1]), n: Number(match?.[1]) + (match?.[2] === 'concurrent' ? prior : 0),
          scenario: match?.[2] ?? null, action: match?.[3] ?? null, attempt: prior + 1,
          chatId: Number(pathname.split('/').pop()), type: parsed?.type ?? null,
          replyTo: parsed?.metadata?.original_message?.id ?? null, authorized: Boolean(req.headers.authorization),
          status: null, heldMs: null,
        };
        sends.push(record);
        if (record.scenario === 'mapped' || (record.scenario === 'retry_rejected' && record.attempt === 1)) {
          record.status = reply(json({ status: { message: 'SLOW_MODE_ERROR' } }, 422));
        } else if (record.scenario === 'unknown') record.status = reply(json({ message: 'synthetic upstream failure' }, 503));
        else if (record.scenario === 'pending' || record.scenario === 'concurrent') held.set(record.n, { res, headers, record });
        else record.status = reply(json(acceptedBody));
        return undefined;
      }
      return reply(json({}, 404));
    });
  });

  return {
    sends, routes, hostsSeen,
    listen: () => new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(443, '127.0.0.1', resolve);
    }),
    release(n) {
      const hold = held.get(n);
      if (!hold) return false;
      held.delete(n);
      hold.record.heldMs = Date.now() - hold.record.at;
      hold.record.status = 200;
      hold.res.writeHead(200, hold.headers);
      hold.res.end(JSON.stringify(acceptedBody));
      return true;
    },
    close() {
      for (const hold of held.values()) hold.res.destroy();
      held.clear();
      server.closeAllConnections?.();
      server.close();
    },
  };
}

function startGate(cfg) {
  const state = { mode: cfg.gateMode, phase: 'startup', records: [] };
  const server = http.createServer((req, res) => {
    const arrival = { at: Date.now(), phase: state.phase, mode: state.mode };
    const chunks = [];
    let size = 0;
    req.on('data', chunk => { size += chunk.length; if (size <= 8 << 20) chunks.push(chunk); });
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const decoded = decodeOtlpBody(body, req.headers);
      const record = {
        ...arrival, method: req.method, path: req.url,
        host: req.headers.host, bytes: body.length, encoding: decoded.encoding, services: decoded.services,
        spans: decoded.spans, userAgent: String(req.headers['user-agent'] || '').split('/')[0] || null,
        metrics: decoded.metrics.filter(point => Object.values(SEND_METRICS).includes(point.name)),
        channel: decoded.services.includes('kicktalk-renderer') ? 'renderer-relay' : 'main-sdk',
        leaks: forbiddenHits(decoded.text, cfg.forbidden).length, status: 0,
      };
      state.records.push(record);
      if (state.mode === 'reject') {
        record.status = 401;
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end('{"message":"synthetic receiver rejection"}');
        return;
      }
      const upstream = http.request({
        socketPath: cfg.lgtmSock, path: req.url, method: req.method,
        headers: {
          'content-type': req.headers['content-type'] || 'application/json', 'content-length': body.length,
          ...(req.headers['content-encoding'] ? { 'content-encoding': req.headers['content-encoding'] } : {}),
        },
        timeout: 10000,
      }, response => {
        const parts = [];
        response.on('data', chunk => parts.push(chunk));
        response.on('end', () => {
          record.status = response.statusCode || 502;
          res.writeHead(record.status, { 'content-type': response.headers['content-type'] || 'application/json' });
          res.end(Buffer.concat(parts));
        });
      });
      upstream.on('error', () => { record.status = 502; res.writeHead(502); res.end(); });
      upstream.on('timeout', () => upstream.destroy());
      upstream.end(body);
    });
  });
  const seen = (name, predicate = () => true) => state.records.reduce((count, record) =>
    count + record.spans.filter(span => span.name === name && predicate(record, span)).length, 0);
  return {
    state,
    listen: () => new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(OTLP_PORT, '127.0.0.1', resolve);
    }),
    seen,
    sawSpan: spanId => state.records.some(record => record.spans.some(span => span.spanId === spanId)),
    close() { server.closeAllConnections?.(); server.close(); },
  };
}

async function runAgent(cfg) {
  const t0 = Date.now();
  const report = {
    kind: cfg.kind, chatId: cfg.chatId, steps: [], error: null, sends: [], probes: {}, logins: 0,
    globals: null, observedMs: null,
  };
  const note = text => report.steps.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${text}`);
  let app;
  let page;
  let stub;
  let gate;
  const killApp = async () => {
    if (!app || app.exitCode !== null) return;
    for (const signal of ['SIGTERM', 'SIGKILL']) {
      try { process.kill(-app.pid, signal); } catch { return; }
      const stopped = await Promise.race([new Promise(resolve => app.once('exit', () => resolve(true))), delay(4000).then(() => false)]);
      if (stopped) return;
    }
  };
  process.on('SIGTERM', () => { killApp().finally(() => process.exit(143)); });

  try {
    await exec('ip', ['link', 'set', 'lo', 'up']);
    // Name resolution can work through host daemons; what matters is that no route exists.
    const kickAddress = (await dns.lookup('kick.com', { family: 4 }).catch(() => ({ address: '1.1.1.1' }))).address;
    const probeEgress = host => new Promise(resolve => {
      const socket = net.connect({ host, port: 443, timeout: 3000 });
      socket.once('connect', () => { socket.destroy(); resolve('connected'); });
      socket.once('timeout', () => { socket.destroy(); resolve('timeout'); });
      socket.once('error', error => resolve(error.code || 'error'));
    });
    const egress = await probeEgress('1.1.1.1');
    const kickEgress = await probeEgress(kickAddress);
    report.isolation = { egress, kickEgress };
    assert.notEqual(egress, 'connected', 'network namespace has outbound connectivity');
    assert.notEqual(kickEgress, 'connected', 'network namespace can reach Kick');
    note(`isolated (egress ${egress}, kick ${kickEgress})`);

    stub = startStub(cfg);
    gate = startGate(cfg);
    await stub.listen();
    await gate.listen();

    fs.mkdirSync(cfg.profile, { recursive: true });
    if (cfg.telemetry) fs.writeFileSync(path.join(cfg.profile, 'config.json'), JSON.stringify({ telemetry: { enabled: true } }));
    if (cfg.tokens) {
      fs.writeFileSync(path.join(cfg.profile, 'config.env'),
        JSON.stringify({ SESSION_TOKEN: cfg.tokens.token, KICK_SESSION: cfg.tokens.session }), { mode: 0o600 });
    }
    const env = Object.fromEntries(Object.entries(process.env)
      .filter(([key]) => !/^(OTEL_|MAIN_VITE_|VITE_|NODE_OPTIONS$|ELECTRON_RENDERER_URL$|(HTTPS?|ALL|NO)_PROXY$)/i.test(key)));
    Object.assign(env, {
      NODE_ENV: 'production',
      TMPDIR: cfg.tempDir,
      XDG_CONFIG_HOME: path.join(cfg.root, 'xdg-config'),
      XDG_CACHE_HOME: path.join(cfg.root, 'xdg-cache'),
      OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${OTLP_PORT}`,
      OTEL_EXPORTER_OTLP_HEADERS: '',
      OTEL_EXPORTER_OTLP_PROTOCOL: 'http/json',
      OTEL_EXPORTER_OTLP_METRICS_PROTOCOL: 'http/json',
      OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE: 'cumulative',
      OTEL_METRICS_EXPORTER: 'otlp',
      OTEL_METRIC_EXPORT_INTERVAL: '2000',
      OTEL_METRIC_EXPORT_TIMEOUT: '1500',
      OTEL_LOGS_EXPORTER: 'none',
      OTEL_RESOURCE_ATTRIBUTES: `ktsmoke.run=${cfg.runId},ktsmoke.launch=${cfg.kind}`,
    });
    const rules = STUB_HOSTS.map(host => `MAP ${host} 127.0.0.1`).join(', ');
    const log = fs.openSync(path.join(cfg.root, 'app.log'), 'a');
    app = spawn(path.join(REPO, 'node_modules/.bin/electron'), [
      path.join(REPO, 'out/main/index.js'), '--no-sandbox', '--remote-debugging-port=9222', '--inspect=9230',
      `--user-data-dir=${cfg.profile}`, `--ignore-certificate-errors-spki-list=${cfg.spki}`, `--host-resolver-rules=${rules}`,
    ], { cwd: cfg.root, env, stdio: ['ignore', log, log], detached: true });
    fs.closeSync(log);
    app.once('exit', code => note(`app exited (${code})`));
    note('app launched');

    const onPage = target => target.type === 'page' && String(target.url).includes('/renderer/index.html');
    page = await connectDebugger(9222, onPage);
    const room = {
      id: cfg.chatId, username: cfg.streamer, displayName: cfg.streamer, slug: cfg.streamer, order: 0, channel7TVEmotes: [],
      streamerData: {
        id: cfg.chatId, user_id: cfg.chatId + 1, slug: cfg.streamer, user: { username: cfg.streamer },
        chatroom: { id: cfg.chatId }, subscriber_badges: [],
      },
    };
    await waitFor('renderer document', () => page.evaluate('document.readyState === "complete"'), { timeoutMs: 30000 });
    // The message list is virtualized without look-behind: in the default window the peer row (the reply target)
    // unmounts once ~10 rows have been added. A tall viewport keeps every scripted row mounted for the whole run.
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 4000, deviceScaleFactor: 1, mobile: false });
    await page.evaluate(`(() => {
      localStorage.setItem('chatrooms', ${JSON.stringify(JSON.stringify([room]))});
      localStorage.setItem('chatrooms_version', '2');
      window.__ktPreReload = true;
      setTimeout(() => location.reload(), 0);
      return true;
    })()`);
    await waitFor('reloaded composer with the peer message', () => page.evaluate(
      `!window.__ktPreReload && !!document.querySelector('.chatInput') && document.body.innerText.includes(${JSON.stringify(PEER.content)})`),
    { timeoutMs: 30000 });
    if (cfg.telemetry) {
      await waitFor('renderer tracer', () => page.evaluate(
        '!!window.__KT_TRACER__ && !!window.__KT_OTEL_PROVIDER__ && !!window.__KT_TRACE_API__'), { timeoutMs: 20000 });
    }
    note('room loaded');

    const evalMain = async (label) => {
      const inspector = await connectDebugger(9230, () => true, 15000);
      try {
        const moduleUrl = pathToFileURL(path.join(REPO, 'out/main/index.js')).href;
        // Created through the main process's real SDK registration, like scripts/otel-smoke.mjs --main.
        const probe = await inspector.evaluate(`(() => {
          const { trace } = process.getBuiltinModule('module').createRequire(${JSON.stringify(moduleUrl)})('@opentelemetry/api');
          const span = trace.getTracer('kicktalk-failure-smoke').startSpan(${JSON.stringify(label)});
          span.setAttribute('ktsmoke.run', ${JSON.stringify(cfg.runId)});
          const { traceId, spanId } = span.spanContext();
          const recording = span.isRecording();
          span.end();
          return { traceId, spanId, recording };
        })()`);
        report.probes[label] = probe;
        return probe;
      } finally { inspector.close(); }
    };

    const rowsExpression = marker => `(() => {
      const marker = ${JSON.stringify(marker)};
      return [...document.querySelectorAll('.chatMessageItem')].filter(item => item.innerText.includes(marker)).map(el => {
        const key = Object.keys(el).find(name => name.startsWith('__reactFiber$'));
        let fiber = key ? el[key] : null;
        let row = null;
        for (let depth = 0; fiber && depth < 80 && !row; depth++, fiber = fiber.return) {
          const found = [fiber, fiber.alternate].map(item => item?.memoizedProps?.message)
            .filter(message => message && typeof message === 'object' && message.content === marker);
          row = found.find(message => el.classList.contains('failed') ? message.state === 'failed'
            : el.classList.contains('optimistic') ? message.isOptimistic && message.state === 'optimistic' : !message.isOptimistic);
        }
        const reason = el.querySelector('.chatMessageFailureReason');
        return { domFailed: el.classList.contains('failed'), domReason: reason ? reason.textContent : null,
          row: row ? { id: row.id, tempId: row.tempId, state: row.state, failureReason: row.failureReason,
            type: row.type, optimistic: !!row.isOptimistic } : null };
      });
    })()`;
    const loginCount = () => page.evaluate(
      '(document.body.innerText.match(/You must login to chat\\./g) || []).length');

    const pressEnter = async () => {
      for (const type of ['rawKeyDown', 'keyUp']) {
        await page.send('Input.dispatchKeyEvent', {
          type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
          ...(type === 'rawKeyDown' ? { text: '\r' } : {}),
        });
      }
    };
    const attempts = [];
    const paceSend = async () => {
      let wait;
      while ((wait = sendPacingDelayMs(attempts, Date.now())) > 0) await delay(wait);
    };
    const perform = async item => {
      await paceSend();
      if (item.action === 'reply') {
        const found = await page.evaluate(`(() => {
          const icon = document.querySelector('svg[aria-label=${JSON.stringify(`Reply to ${PEER.username}`)}]');
          if (!icon) return { rendered: document.querySelectorAll('.chatMessageItem').length, viewport: innerHeight };
          icon.closest('button').click();
          return { clicked: true };
        })()`);
        // The list is virtualized with no look-behind: the peer row unmounts once enough rows scroll above the viewport.
        assert(found.clicked, `peer reply control is not rendered (${found.rendered} rows mounted, viewport ${found.viewport}px)`);
        await waitFor('reply target', () => page.evaluate("document.body.innerText.includes('Replying to')"), { timeoutMs: 10000 });
      }
      await page.evaluate("(() => { const input = document.querySelector('.chatInput'); input.focus(); return document.activeElement === input; })()");
      await page.send('Input.insertText', { text: markerFor(item) });
      const record = { ...item, sentAt: Date.now(), ui: null };
      attempts.push(record.sentAt);
      report.sends.push(record);
      await pressEnter();
      await waitFor('composer cleared after Enter', () => page.evaluate(
        "!document.querySelector('.chatInput').textContent.trim()"), { timeoutMs: 5000 });
      return record;
    };
    const rowsFor = record => page.evaluate(rowsExpression(markerFor(record)));
    const selectRow = (record, rows) => {
      const used = report.sends.filter(other => other !== record).map(other => other.ui?.tempId).filter(Boolean);
      return rows.find(state => state.row && (record.ui?.tempId
        ? state.row.tempId === record.ui.tempId : state.row.tempId && !used.includes(state.row.tempId)));
    };
    const rowFor = record => waitFor(`${record.kind}/${record.action} optimistic row`,
      async () => selectRow(record, await rowsFor(record)), { timeoutMs: 10000 });
    const untilFailed = (record, timeoutMs) => waitFor(`${record.kind}/${record.action} failure`, async () => {
      const state = selectRow(record, await rowsFor(record));
      return state?.row.state === 'failed' ? state : null;
    }, { timeoutMs, intervalMs: 200 });
    const settle = (record, state) => {
      record.ui = {
        tempId: state.row.tempId, state: state.row.state, reason: state.row.failureReason,
        domReason: state.domReason, domFailed: state.domFailed, type: state.row.type,
        elapsedMs: Date.now() - record.sentAt,
      };
    };
    const accepted = record => waitFor(`${record.kind}/${record.action} API acceptance`, () =>
      stub.sends.some(request => request.n === record.n && request.status === 200), { timeoutMs: 10000 });
    const answered = (record, status) => waitFor(`${record.kind}/${record.action} HTTP ${status} from the stub`, () =>
      stub.sends.some(request => request.n === record.n && request.status === status), { timeoutMs: 5000 });
    const publish = async (record, id = `kt-echo-${record.n}`) => {
      const message = {
        id, chatroom_id: cfg.chatId, content: markerFor(record), type: record.action === 'reply' ? 'reply' : 'message',
        created_at: new Date().toISOString(),
        sender: { id: 9001, username: 'ktsmoke-sender', slug: 'ktsmoke-sender', identity: { color: '#7aa2f7', badges: [] } },
        metadata: record.action === 'reply'
          ? { original_message: { id: PEER.id, content: PEER.content }, original_sender: { id: 7001, username: PEER.username } } : {},
      };
      const event = { kind: 'publication', chatroomId: cfg.chatId, channel: `chatrooms.${cfg.chatId}.v2`,
        event: 'App\\Events\\ChatMessageEvent', data: JSON.stringify(message) };
      const inspector = await connectDebugger(9230, () => true, 15000);
      try {
        const moduleUrl = pathToFileURL(path.join(REPO, 'out/main/index.js')).href;
        // Synthetic publication enters at the existing main -> preload realtime IPC boundary.
        // No store mutation or telemetry helper can manufacture confirmation evidence.
        await inspector.evaluate(`(() => {
          const { BrowserWindow } = process.getBuiltinModule('module').createRequire(${JSON.stringify(moduleUrl)})('electron');
          const win = BrowserWindow.getAllWindows().find(item => item.webContents.getURL().includes('/renderer/index.html'));
          if (!win) throw new Error('Main renderer unavailable for realtime publication');
          win.webContents.send('kick:realtime:event', ${JSON.stringify(event)});
          return true;
        })()`);
      } finally { inspector.close(); }
      return id;
    };
    const confirmedRow = (record, id) => waitFor(`${record.kind}/${record.action} confirmed UI row`, async () =>
      (await rowsFor(record)).find(state => state.row?.id === id && !state.row.optimistic && state.row.state === 'confirmed'),
    { timeoutMs: 10000 });
    const confirm = async record => {
      await accepted(record);
      const id = await publish(record);
      await confirmedRow(record, id);
      await publish(record, id); // Same server id must never record another transition.
      await delay(300);
      const rows = await rowsFor(record);
      assert.equal(rows.filter(state => state.row?.id === id).length, 1, 'duplicate echo created another row');
      record.confirmed = true;
      record.duplicateEcho = true;
    };
    const gateHas = async (what, predicate, timeoutMs = 25000) => {
      let last;
      try {
        return await waitFor(what, () => {
          try { return predicate(); } catch (error) { last = error; return false; }
        }, { timeoutMs, intervalMs: 300 });
      } catch (error) {
        throw new Error(last ? `${error.message} (last mismatch: ${last.message})` : error.message);
      }
    };

    const plan = PLANS[cfg.kind];
    if (cfg.kind === 'failures') {
      const sent = [];
      for (const item of plan.filter(item => item.kind !== 'concurrent')) {
        const record = await perform(item);
        sent.push(record);
        if (['mapped', 'unknown', 'retry_rejected'].includes(item.kind)) {
          settle(record, await untilFailed(record, 10000));
          // The preload's rate guard also fails the row, without any request; require the scripted answer.
          await answered(record, FAILURE[item.kind === 'retry_rejected' ? 'mapped' : item.kind].http);
        } else settle(record, await rowFor(record));
        if (item.kind === 'confirmed') await confirm(record);
        note(`sent case=${item.n} ${item.kind}/${item.action}`);
        await delay(300);
      }
      const rejected = sent.find(item => item.kind === 'retry_rejected');
      await paceSend();
      const retry = { n: 18, kind: 'retry_confirmed', action: rejected.action, retry: true, sentAt: Date.now(), ui: null };
      attempts.push(retry.sentAt);
      // Retry preserves the original content but creates a new operation and temp id.
      await page.evaluate(`(() => {
        const el = [...document.querySelectorAll('.chatMessageItem')].find(item => item.innerText.includes(${JSON.stringify(markerFor(rejected))}));
        el.querySelector('button[aria-label="Retry sending message"]').click();
        return true;
      })()`);
      report.sends.push(retry);
      // Content routing remains case 13, while report case 18 uniquely identifies the retry attempt.
      const retryContent = { ...retry, n: rejected.n, kind: rejected.kind };
      settle(retry, await rowFor(retryContent));
      assert.notEqual(retry.ui.tempId, rejected.ui.tempId, 'manual retry reused the failed temp id');
      await accepted(rejected);
      const retryId = await publish(rejected, 'kt-echo-retry');
      await confirmedRow(rejected, retryId);
      await publish(rejected, retryId);
      retry.confirmed = true;
      retry.duplicateEcho = true;
      report.manualRetry = { oldTempId: rejected.ui.tempId, newTempId: retry.ui.tempId };

      for (const action of ['send', 'reply']) {
        const pair = [];
        for (const item of plan.filter(item => item.kind === 'concurrent' && item.action === action)) {
          const record = await perform(item);
          settle(record, await rowFor(record));
          pair.push(record);
        }
        assert.notEqual(pair[0].ui.tempId, pair[1].ui.tempId, 'identical concurrent content reused a temp id');
        await waitFor(`both concurrent ${action} API requests pending`, () =>
          pair.every(record => stub.sends.some(request => request.n === record.n && request.status === null)), { timeoutMs: 10000 });
        for (const record of pair) assert(stub.release(record.n), 'missing held concurrent request');
        await Promise.all(pair.map(accepted));
        const firstId = await publish(pair[0]);
        await confirmedRow(pair[0], firstId);
        await publish(pair[0], firstId);
        await delay(500);
        const afterDuplicate = await rowsFor(pair[1]);
        assert.equal(afterDuplicate.filter(state => state.row?.id === firstId).length, 1, 'duplicate server row');
        assert(afterDuplicate.some(state => state.row?.tempId === pair[1].ui.tempId && state.row.state === 'optimistic'),
          'duplicate echo incorrectly confirmed the second identical action');
        const secondId = await publish(pair[1]);
        await confirmedRow(pair[1], secondId);
        await publish(pair[1], secondId);
        for (const record of pair) { record.confirmed = true; record.duplicateEcho = true; }
      }
      for (const record of sent.filter(item => ['accepted', 'pending', 'late'].includes(item.kind))) {
        settle(record, await untilFailed(record, CONFIRMATION_MS + 20000));
        note(`${record.kind}/${record.action} unconfirmed after ${record.ui.elapsedMs}ms`);
      }
      for (const record of sent.filter(item => item.kind === 'pending')) assert(stub.release(record.n), 'missing held pending request');
      for (const record of sent.filter(item => item.kind === 'late')) {
        await accepted(record);
        const id = await publish(record);
        await waitFor('late echo remains separate from failed optimistic row', async () => {
          const rows = await rowsFor(record);
          return rows.some(state => state.row?.tempId === record.ui.tempId && state.row.state === 'failed')
            && rows.some(state => state.row?.id === id && !state.row.optimistic);
        }, { timeoutMs: 10000 });
        await publish(record, id);
        await delay(300);
        assert.equal((await rowsFor(record)).length, 2, 'late duplicate echo changed existing matcher behavior');
        record.lateEcho = { warningPreserved: true, serverRows: 1 };
      }
      const probe = await evalMain('ktsmoke_main_probe');
      const expected = { [COMPOSER_SPAN]: 17, 'chat.send': 10, 'chat.reply': 8,
        'chat.api.sendMessage': 10, 'chat.api.sendReply': 8, 'chat.send.confirmed': 4, 'chat.reply.confirmed': 3,
        'chat.send.confirmation_timeout': 3, 'chat.reply.confirmation_timeout': 3 };
      await gateHas('every send span at the receiver', () =>
        Object.entries(expected).every(([name, count]) => gate.seen(name) >= count) && gate.sawSpan(probe.spanId));
      await gateHas('exact actual exported outcome counters and histograms', () => {
        expectSendMetrics(gate.state.records, metricExpectation('failures'));
        return true;
      });
      // Keep observing past every confirmation timer, so duplicate or automatic
      // transitions cannot hide in a later cumulative export.
      const latestAttempt = Math.max(...report.sends.map(record => record.sentAt));
      await delay(Math.max(5000, latestAttempt + CONFIRMATION_MS + 2500 - Date.now()));
    } else if (cfg.kind === 'unauth') {
      for (const item of plan) {
        const record = await perform(item);
        await waitFor('login message', async () => (await loginCount()) >= item.n, { timeoutMs: 10000 });
        record.ui = { reason: 'You must login to chat.', loginMessages: await loginCount() };
        note(`sent case=${record.n} ${record.kind}/${record.action}`);
        await delay(800);
      }
      report.logins = await loginCount();
      await gateHas('both unauthenticated composer/provider traces at the receiver', () =>
        gate.seen(COMPOSER_SPAN) >= 2 && gate.seen('chat.send') >= 1 && gate.seen('chat.reply') >= 1);
      await gateHas('actual unauthenticated rejection metrics', () => {
        expectSendMetrics(gate.state.records, metricExpectation('unauth'));
        return true;
      });
      await delay(3000);
    } else if (cfg.kind === 'exporter') {
      gate.state.mode = 'reject';
      gate.state.phase = 'reject';
      const first = await perform(plan[0]);
      settle(first, await untilFailed(first, 10000));
      const rejectedProbe = await evalMain('ktsmoke_main_rejected');
      await gateHas('rejected renderer and main exports', () =>
        gate.seen('chat.send', record => record.status === 401) >= 1 && gate.seen('chat.api.sendMessage', record => record.status === 401) >= 1
        && gate.state.records.some(record => record.status === 401 && record.spans.some(span => span.spanId === rejectedProbe.spanId)));
      note('receiver rejection observed for both paths');
      report.alive = await page.evaluate("!!document.querySelector('.chatInput')");
      await delay(2000);
      gate.state.mode = 'pass';
      gate.state.phase = 'recovery';
      await delay(500);
      const second = await perform(plan[1]);
      settle(second, await untilFailed(second, 10000));
      const recoveredProbe = await evalMain('ktsmoke_main_recovered');
      await gateHas('recovered renderer and main exports', () =>
        gate.seen('chat.send', record => record.phase === 'recovery' && record.status >= 200 && record.status < 300) >= 1
        && gate.state.records.some(record => record.phase === 'recovery' && record.status >= 200 && record.status < 300
          && record.spans.some(span => span.spanId === recoveredProbe.spanId)));
      note('receiver recovery observed for both paths');
      await delay(6000);
    } else if (cfg.kind === 'disabled') {
      const record = await perform(plan[0]);
      settle(record, await untilFailed(record, 10000));
      await evalMain('ktsmoke_main_disabled');
      const observeStart = Date.now();
      await delay(15000);
      report.observedMs = Date.now() - observeStart;
      report.globals = await page.evaluate(`({
        tracer: !!window.__KT_TRACER__, provider: !!window.__KT_OTEL_PROVIDER__, api: !!window.__KT_TRACE_API__,
      })`);
    } else if (cfg.kind === 'runtime') {
      gate.state.phase = 'enabled';
      const control = await perform(plan[0]);
      settle(control, await untilFailed(control, 10000));
      const probe = await evalMain('ktsmoke_main_runtime_control');
      await gateHas('runtime control spans and real metric export', () =>
        gate.seen(COMPOSER_SPAN) >= 1 && gate.sawSpan(probe.spanId)
        && gate.state.records.some(record => record.path === '/v1/metrics' && record.status === 200
          && record.metrics.some(point => point.name === SEND_METRICS.outcomes && point.attrs.outcome === 'rejected')));
      await page.evaluate("window.app.store.set('telemetry', { enabled: false })");
      gate.state.phase = 'disabled';
      report.disabledAt = Date.now();
      assert.equal((await page.evaluate("window.app.store.get('telemetry')"))?.enabled, false, 'runtime opt-out was not persisted');
      for (const item of plan.slice(1)) {
        const record = await perform(item);
        settle(record, await untilFailed(record, 10000));
      }
      await evalMain('ktsmoke_main_runtime_disabled');
      await delay(15000);
      report.observedMs = Date.now() - report.disabledAt;
    }

    report.alive ??= await page.evaluate("!!document.querySelector('.chatInput')");
    note('scenario complete');
  } catch (error) {
    report.error = String(error?.message || error).split('\n')[0];
    for (const marker of [...cfg.forbidden, ...Object.values(PLANS).flat().map(markerFor)]) {
      report.error = report.error.split(marker).join('[redacted]');
    }
    process.exitCode = 1;
    // Evidence contains only classes/counts; never persist or print row content.
    report.dom = await page?.evaluate(`[...document.querySelectorAll('.chatMessageItem')].map(item =>
      ({ failed: item.classList.contains('failed'), optimistic: item.classList.contains('optimistic') }))`).catch(() => null);
  } finally {
    page?.close();
    // Kill first: SDK shutdown flushes also reach the gate and must be inside the
    // single snapshot below (leak scan, per-path counts, exported-once checks).
    await killApp();
    if (gate) {
      // Bounded drain so in-flight forwards settle to a final status (0 = pending).
      await waitFor('in-flight gate forwards to settle',
        () => gate.state.records.every(item => item.status !== 0), { timeoutMs: 5000, intervalMs: 100 }).catch(() => {});
    }
    report.stub = stub && structuredClone({ sends: stub.sends, routes: stub.routes, hostsSeen: [...stub.hostsSeen] });
    report.gate = gate && { records: structuredClone(gate.state.records) };
    stub?.close();
    gate?.close();
    fs.writeFileSync(cfg.reportPath, JSON.stringify(report));
    process.exit(process.exitCode ?? 0);
  }
}

// ---------------------------------------------------------------------------
// Host orchestrator
// ---------------------------------------------------------------------------

const outcomes = [];
function record(ok, name, detail = '') {
  outcomes.push({ ok, name, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` ${detail}` : ''}`);
}
async function check(name, run) {
  try {
    const detail = await run();
    record(true, name, typeof detail === 'string' ? detail : '');
  } catch (error) {
    record(false, name, `-> ${String(error?.message || error).split('\n')[0]}`);
  }
}

// Returns parsed JSON on 2xx, null only on HTTP 404 (proven absence); every
// transport/exec/server/parse failure throws so checks fail instead of passing.
async function tempoGet(pathname, params = {}) {
  const args = ['exec', CONTAINER, 'curl', '-sS', '-G', '--max-time', '10', '-w', '\n%{http_code}'];
  for (const [key, value] of Object.entries(params)) args.push('--data-urlencode', `${key}=${value}`);
  args.push(`${TEMPO}${pathname}`);
  let stdout;
  try {
    ({ stdout } = await exec('podman', args, { maxBuffer: 32 * 1024 * 1024, timeout: 20000 }));
  } catch {
    throw new Error(`Tempo query transport failure for ${pathname}`);
  }
  const split = stdout.lastIndexOf('\n');
  const result = classifyTempoHttp(Number(stdout.slice(split + 1)), stdout.slice(0, split));
  if (result.kind === 'error') throw new Error(`${result.message} for ${pathname}`);
  return result.kind === 'absent' ? null : result.data;
}

async function readTrace(traceId, minSpans, timeoutMs = 30000) {
  let spans = [];
  try {
    await waitFor(`trace ${traceId}`, async () => {
      const data = await tempoGet(`/api/traces/${traceId}`);
      spans = data ? normalizeSpans(data) : [];
      return spans.length >= minSpans;
    }, { timeoutMs, intervalMs: 1500 });
  } catch (error) {
    if (!spans.length) throw error;
  }
  return spans;
}

async function searchTraceIds(query, runStart, expected = 1, timeoutMs = 45000) {
  let ids = [];
  let succeeded = false;
  try {
    await waitFor(`Tempo search ${query}`, async () => {
      const data = await tempoGet('/api/search', {
        q: query, limit: 20, start: Math.floor(runStart / 1000) - 30, end: Math.floor(Date.now() / 1000) + 300,
      });
      if (data === null) return false; // No successful response yet: keep polling.
      succeeded = true;
      ids = (data?.traces || []).map(trace => trace.traceID);
      // Zero is only acceptable after at least one successful Tempo response.
      return expected === 0 || ids.length >= expected;
    }, { timeoutMs, intervalMs: 1500 });
  } catch (error) {
    if (expected === 0 ? !succeeded : !ids.length && expected > 0) throw error;
  }
  return ids;
}

async function absentFromTempo(traceId) {
  return (await tempoGet(`/api/traces/${traceId}`)) === null;
}

function findProcesses(token) {
  const pids = [];
  for (const name of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(name) || Number(name) === process.pid) continue;
    try {
      if (fs.readFileSync(`/proc/${name}/cmdline`, 'latin1').includes(token)) pids.push(Number(name));
    } catch { /* process exited */ }
  }
  return pids;
}

async function launchAgent(kind, base, options) {
  const dir = path.join(base.root, kind);
  fs.mkdirSync(path.join(dir, 'tmp'), { recursive: true });
  fs.mkdirSync(dir, { recursive: true });
  const cfg = {
    ...base.shared, kind, root: dir, profile: path.join(dir, 'profile'), reportPath: path.join(dir, 'report.json'),
    tempDir: path.join(dir, 'tmp'),
    chatId: base.chatIds[kind], streamer: `ktsmoke-streamer-${kind}`,
    telemetry: kind !== 'disabled', tokens: kind === 'unauth' ? null : base.tokens,
    gateMode: kind === 'exporter' ? 'reject' : 'pass',
  };
  const cfgPath = path.join(dir, 'agent.json');
  fs.writeFileSync(cfgPath, JSON.stringify(cfg));
  const out = fs.openSync(path.join(dir, 'agent.log'), 'a');
  const child = spawn('unshare', ['-rn', process.execPath, SELF, '--agent', cfgPath], {
    stdio: ['ignore', out, out], detached: true,
  });
  base.children.add(child);
  const result = await new Promise(resolve => {
    const timer = setTimeout(() => {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ }
      resolve({ timedOut: true });
    }, options.agentTimeoutMs);
    child.once('exit', code => { clearTimeout(timer); resolve({ code }); });
    child.once('error', error => { clearTimeout(timer); resolve({ code: -1, spawnError: error.message }); });
  });
  base.children.delete(child);
  for (const pid of findProcesses(`--user-data-dir=${cfg.profile}`)) {
    try { process.kill(pid, 'SIGKILL'); } catch { /* exited */ }
  }
  let report = null;
  try { report = JSON.parse(fs.readFileSync(cfg.reportPath, 'utf8')); } catch { /* agent died early */ }
  return { kind, cfg, report, ...result, logPath: path.join(dir, 'agent.log') };
}

const explain = launch => launch.report?.error
  || (launch.timedOut ? 'agent timed out' : launch.spawnError) || `exit ${launch.code}, no report`;

function commonChecks(launch) {
  const { report } = launch;
  return check(`${launch.kind}: isolated launch`, async () => {
    assert(report && !report.error, explain(launch));
    assert.notEqual(report.isolation.egress, 'connected');
    assert.notEqual(report.isolation.kickEgress, 'connected');
    // The content/credential scan is only meaningful on payloads the gate could decode.
    const undecoded = report.gate.records.filter(item => ['/v1/traces', '/v1/metrics'].includes(item.path) && item.encoding !== 'json');
    assert.equal(undecoded.length, 0, `${undecoded.length} trace/metric payloads were not JSON-decodable`);
    const leaks = report.gate.records.filter(item => item.leaks > 0);
    assert.equal(leaks.length, 0, 'receiver payloads contained synthetic content/credentials');
    const allowed = new Set(STUB_HOSTS);
    for (const host of report.stub.hostsSeen) assert(allowed.has(host), `unexpected API host ${host}`);
    for (const host of new Set(report.gate.records.map(item => item.host))) {
      assert.equal(host, `127.0.0.1:${OTLP_PORT}`, `export went to ${host}`);
    }
    return `profile=synthetic egress=${report.isolation.egress} receiver_requests=${report.gate.records.length} leaks=0`;
  });
}

async function verifySends(launch, runStart, plan) {
  const { report } = launch;
  const results = [];
  for (const item of plan) {
    const sent = report.sends.find(entryItem => entryItem.n === item.n);
    await check(`${item.kind}/${item.action}`, async () => {
      assert(sent?.ui?.tempId, 'the UI never exposed a temp id for the row');
      const ids = await searchTraceIds(`{ span.message.temp_id = "${sent.ui.tempId}" }`, runStart);
      assert.equal(ids.length, 1, `expected one trace for the temp id, found ${ids.length}`);
      const spans = await readTrace(ids[0], spanCount(item.kind, item.retry));
      const stored = JSON.stringify(spans);
      assert.equal(forbiddenHits(stored, launch.cfg.forbidden).length, 0, 'stored spans contain synthetic content/credentials');
      const outcome = expectSendTrace(spans, { action: item.action, kind: item.kind, tempId: sent.ui.tempId, reason: sent.ui.reason, retry: item.retry });
      const requests = report.stub.sends.filter(request => item.retry
        ? request.n === 13 && request.attempt === 2
        : request.n === item.n && (item.kind !== 'retry_rejected' || request.attempt === 1));
      assert.equal(requests.length, 1, `expected exactly one API request, saw ${requests.length}`);
      assert.equal(requests[0].type, item.action === 'send' ? 'message' : 'reply');
      if (item.action === 'reply') assert.equal(requests[0].replyTo, PEER.id, 'reply did not target the peer message');
      if (item.kind === 'pending') assert(requests[0].heldMs >= CONFIRMATION_MS - 500, `request held ${requests[0].heldMs}ms`);
      if (['confirmed', 'concurrent', 'retry_confirmed'].includes(item.kind)) {
        assert.equal(sent.confirmed, true, 'actual realtime publication did not confirm the UI row');
        assert.equal(sent.duplicateEcho, true, 'duplicate publication was not exercised');
      }
      if (item.kind === 'late') assert.deepEqual(sent.lateEcho, { warningPreserved: true, serverRows: 1 });
      results.push({ ...item, ...outcome });
      const http = spans.find(span => span.name === API_SPAN[item.action])?.attrs['http.response.status_code'];
      return `trace=${outcome.traceId} temp=${sent.ui.tempId}${http ? ` http=${http}` : ''}`
        + `${outcome.elapsedMs ? ` timeout_after=${outcome.elapsedMs}ms` : ''} requests=1`;
    });
  }
  return results;
}

async function verifyFailures(launch, runStart, control) {
  const { report } = launch;
  if (!report || report.error) return record(false, 'failures: agent', explain(launch));
  await commonChecks(launch);
  const traces = await verifySends(launch, runStart, [...PLANS.failures, { ...entry(18, 'retry_confirmed', 'send'), retry: true }]);
  await check('failures: distinct action correlation including identical concurrent content and retry', async () => {
    assert.equal(traces.length, 18, 'not every action produced a complete stored trace');
    assert.equal(new Set(traces.map(item => item.traceId)).size, 18, 'separate actions shared a trace');
    assert.equal(new Set(traces.map(item => item.operationId)).size, 18, 'separate actions shared an operation id');
    assert.equal(new Set(report.sends.map(item => item.ui.tempId)).size, 18, 'separate actions shared a temp id');
    assert.notEqual(report.manualRetry.oldTempId, report.manualRetry.newTempId);
    return 'actions=18 composer_roots=17 provider_retry_roots=1 distinct_operation_ids=18 distinct_temp_ids=18';
  });
  await check('failures: exact request counts, one explicit retry and no automatic retry', async () => {
    const sends = report.stub.sends;
    assert.equal(sends.length, 18, `expected 18 send requests, saw ${sends.length}`);
    for (const item of PLANS.failures) {
      assert.equal(sends.filter(request => request.n === item.n).length, item.kind === 'retry_rejected' ? 2 : 1,
        `case ${item.n}/${item.action} request count`);
    }
    assert.equal(sends.filter(request => request.status === 200).length, 13, 'API acceptance fixture count');
    assert.equal(sends.filter(request => request.status === 422).length, 3, 'mapped rejection fixture count');
    assert.equal(sends.filter(request => request.status === 503).length, 2, 'unknown rejection fixture count');
    assert.equal(report.sends.filter(item => item.confirmed).length, 7, 'actual confirmed UI fixture count');
    assert.equal(report.sends.filter(item => ['accepted', 'pending', 'late'].includes(item.kind) && item.ui.state === 'failed').length, 6,
      'actual unconfirmed UI fixture count');
    assert(sends.every(request => request.authorized), 'a send was made without credentials');
    return 'attempts=18 api_accepted=13 rejected=5 confirmed=7 unconfirmed=6 manual_retries=1 automatic_retries=0';
  });
  await check('failures: real OTLP counter and histogram counts with bounded labels', async () => {
    const transitions = expectSendMetrics(report.gate.records, metricExpectation('failures'));
    const exports = report.gate.records.filter(item => item.path === '/v1/metrics');
    assert(exports.length >= 2 && exports.every(item => item.status === 200), 'actual metric receiver exports were not accepted');
    return `receiver_metric_exports=${exports.length} cumulative_transitions=${transitions} histogram_observations=${transitions} bounded_labels=true`;
  });
  await check('failures: main and renderer export independently', async () => {
    const traces = report.gate.records.filter(item => item.path === '/v1/traces');
    const relay = traces.filter(item => item.channel === 'renderer-relay');
    const sdk = traces.filter(item => item.channel === 'main-sdk');
    assert(relay.length > 0 && relay.every(item => item.services.join() === 'kicktalk-renderer' && item.status === 200), 'renderer relay requests');
    assert(sdk.length > 0 && sdk.every(item => item.services.join() === 'kicktalk' && item.status === 200), 'main SDK requests');
    assert(relay.every(item => item.userAgent !== 'OTel-OTLP-Exporter-JavaScript'), 'relay request used the SDK exporter');
    assert(sdk.every(item => item.userAgent === 'OTel-OTLP-Exporter-JavaScript'), 'main request did not use the SDK exporter');
    const probe = report.probes.ktsmoke_main_probe;
    assert(probe.recording, 'main probe was not recorded');
    const spans = await readTrace(probe.traceId, 1);
    const stored = spans.find(span => span.spanId === probe.spanId);
    assert.equal(stored?.resource['service.name'], 'kicktalk', 'main span stored under another service');
    assert(!spans.some(span => span.resource['service.name'] === 'kicktalk-renderer'));
    control.requests = traces.length;
    return `renderer_requests=${relay.length} main_requests=${sdk.length} main_trace=${probe.traceId}`;
  });
}

async function verifyUnauth(launch, runStart) {
  const { report } = launch;
  if (!report || report.error) return record(false, 'unauth: agent', explain(launch));
  await commonChecks(launch);
  for (const item of PLANS.unauth) {
    await check(`unauth/${item.action}`, async () => {
      const name = OPERATION[item.action];
      const ids = await searchTraceIds(`{ name = "${name}" && span.chat.id = ${launch.cfg.chatId} }`, runStart);
      assert.equal(ids.length, 1, `expected one ${name} trace, found ${ids.length}`);
      const spans = await readTrace(ids[0], spanCount('unauth'));
      assert.equal(forbiddenHits(JSON.stringify(spans), launch.cfg.forbidden).length, 0, 'stored spans contain synthetic content/credentials');
      const outcome = expectSendTrace(spans, { action: item.action, kind: 'unauth', reason: 'You must login to chat.' });
      return `trace=${outcome.traceId} no_http_status=true no_api_span=true`;
    });
  }
  await check('unauth: no request left the app', async () => {
    assert.equal(report.stub.sends.length, 0, `saw ${report.stub.sends.length} send requests`);
    const authorized = Object.keys(report.stub.routes).filter(route => /\/api\/v1\/user|\/me$|silenced/.test(route));
    assert.equal(authorized.length, 0, `unexpected authenticated routes ${authorized}`);
    assert.equal(report.logins, 2, `expected two login messages, saw ${report.logins}`);
    return 'send_requests=0 login_messages=2';
  });
  await check('unauth: actual attempted/rejected metrics without invented API acceptance', async () => {
    const transitions = expectSendMetrics(report.gate.records, metricExpectation('unauth'));
    return `attempts=2 rejected=2 api_accepted=0 confirmed=0 unconfirmed=0 cumulative_transitions=${transitions}`;
  });
}

async function verifyExporter(launch, runStart) {
  const { report } = launch;
  if (!report || report.error) return record(false, 'exporter: agent', explain(launch));
  await commonChecks(launch);
  const [first, second] = PLANS.exporter.map(item => report.sends.find(sent => sent.n === item.n));
  const rejectedProbe = report.probes.ktsmoke_main_rejected;
  const recoveredProbe = report.probes.ktsmoke_main_recovered;
  const traces = report.gate.records.filter(item => item.path === '/v1/traces');
  const during = phase => traces.filter(item => item.phase === phase);
  const rejectedChatSpans = during('reject').flatMap(item => item.spans).filter(span => span.name.startsWith('chat.'));

  await check('exporter: rejection observed at the receiver for renderer and main', async () => {
    const rejected = during('reject');
    assert(rejected.some(item => item.channel === 'renderer-relay' && item.status === 401
      && item.spans.some(span => span.name === 'chat.send')), 'renderer export was not rejected');
    assert(rejected.some(item => item.channel === 'main-sdk' && item.status === 401
      && item.spans.some(span => span.spanId === rejectedProbe.spanId)), 'main export was not rejected');
    assert(rejected.every(item => item.status === 401), 'receiver forwarded something while rejecting');
    assert.equal(first.ui.state, 'failed', 'the app stopped reporting failures during rejection');
    assert.equal(report.alive, true, 'the app stopped rendering after export rejection');
    return `rejected_requests=${rejected.length} status=401 app_alive=true`;
  });
  await check('exporter: recovery delivers renderer and main spans to Tempo', async () => {
    assert(during('recovery').every(item => item.status === 200), 'recovered exports were not accepted');
    const ids = await searchTraceIds(`{ span.message.temp_id = "${second.ui.tempId}" }`, runStart);
    assert.equal(ids.length, 1);
    const spans = await readTrace(ids[0], spanCount('mapped'));
    expectSendTrace(spans, { action: 'send', kind: 'mapped', tempId: second.ui.tempId, reason: second.ui.reason });
    const mainSpans = await readTrace(recoveredProbe.traceId, 1);
    assert.equal(mainSpans.find(span => span.spanId === recoveredProbe.spanId)?.resource['service.name'], 'kicktalk');
    return `renderer_trace=${ids[0]} main_trace=${recoveredProbe.traceId}`;
  });
  await check('exporter: rejected spans were dropped, not replayed', async () => {
    const spanIds = [...rejectedChatSpans.map(span => span.spanId), rejectedProbe.spanId];
    for (const spanId of spanIds) {
      const count = traces.filter(item => item.spans.some(span => span.spanId === spanId)).length;
      assert.equal(count, 1, `span ${spanId} reached the receiver ${count} times`);
    }
    const traceIds = [...new Set([...rejectedChatSpans.map(span => span.traceId), rejectedProbe.traceId])];
    for (const traceId of traceIds) assert(await absentFromTempo(traceId), `rejected trace ${traceId} reached Tempo`);
    assert.equal((await searchTraceIds(`{ span.message.temp_id = "${first.ui.tempId}" }`, runStart, 0, 5000)).length, 0);
    return `rejected_traces=${traceIds.length} each_span_exported_once=true absent_from_tempo=true`;
  });
}

async function verifyDisabled(launch, runStart, control) {
  const { report } = launch;
  if (!report || report.error) return record(false, 'disabled: agent', explain(launch));
  await commonChecks(launch);
  await check('disabled: no export attempt reaches the receiver', async () => {
    assert.equal(report.gate.records.length, 0, `receiver saw ${report.gate.records.length} requests`);
    assert(report.observedMs >= 15000, `observed only ${report.observedMs}ms`);
    assert.equal(report.sends[0].ui.state, 'failed', 'the app did not exercise the failure path');
    assert.equal(report.stub.sends.length, 1, 'the failing send was not made');
    const probe = report.probes.ktsmoke_main_disabled;
    assert.equal(probe.recording, false, 'main process recorded a span');
    assert(/^0+$/.test(probe.traceId), 'main process produced a real trace id');
    assert.deepEqual(report.globals, { tracer: false, provider: false, api: false });
    assert((control.requests || 0) > 0, 'the enabled control produced no receiver requests');
    const stored = await searchTraceIds(`{ span.chat.id = ${launch.cfg.chatId} }`, runStart, 0, 5000);
    assert.equal(stored.length, 0, 'Tempo holds spans from the disabled profile');
    return `receiver_requests=0 observed=${report.observedMs}ms control_receiver_requests=${control.requests}`;
  });
}

async function verifyRuntimeDisabled(launch, runStart) {
  const { report } = launch;
  if (!report || report.error) return record(false, 'runtime-disabled: agent', explain(launch));
  await commonChecks(launch);
  const [control, ...after] = report.sends;
  await check('runtime-disabled: enabled control reached Tempo with renderer, main and metric exports', async () => {
    const before = report.gate.records.filter(item => item.phase === 'enabled' && item.status === 200);
    assert(before.some(item => item.path === '/v1/traces' && item.channel === 'renderer-relay'), 'no renderer export control');
    assert(before.some(item => item.path === '/v1/traces' && item.channel === 'main-sdk'), 'no main trace export control');
    assert(before.some(item => item.path === '/v1/metrics' && item.channel === 'main-sdk'
      && item.metrics.some(point => point.name === SEND_METRICS.outcomes && point.attrs.outcome === 'rejected')),
    'no main metric export control carrying the send outcome');
    const ids = await searchTraceIds(`{ span.message.temp_id = "${control.ui.tempId}" }`, runStart);
    assert.equal(ids.length, 1, `expected one control trace, found ${ids.length}`);
    expectSendTrace(await readTrace(ids[0], spanCount('mapped')), {
      action: 'send', kind: 'mapped', tempId: control.ui.tempId, reason: control.ui.reason,
    });
    const probe = report.probes.ktsmoke_main_runtime_control;
    assert((await readTrace(probe.traceId, 1)).some(span => span.spanId === probe.spanId), 'enabled main control absent from Tempo');
    return `control_trace=${ids[0]} main_trace=${probe.traceId} renderer+main+metrics=exported`;
  });
  await check('runtime-disabled: no export request reaches the receiver after opt-out', async () => {
    const late = report.gate.records.filter(item => item.phase === 'disabled' || item.at > report.disabledAt);
    assert.equal(late.length, 0, `receiver saw ${late.length} requests after the runtime opt-out`);
    assert(report.observedMs >= 15000, `observed only ${report.observedMs}ms`);
    assert.equal(report.stub.sends.length, 3, 'runtime sends did not exercise the real API');
    assert.equal(after.length, 2, 'post-opt-out sends were not both made');
    assert(report.sends.every(item => item.ui.state === 'failed'), 'runtime opt-out altered the user-visible rejection');
    for (const item of after) {
      const stored = await searchTraceIds(`{ span.message.temp_id = "${item.ui.tempId}" }`, runStart, 0, 5000);
      assert.equal(stored.length, 0, 'post-opt-out trace reached Tempo');
    }
    const disabled = report.probes.ktsmoke_main_runtime_disabled;
    if (disabled.recording) assert(await absentFromTempo(disabled.traceId), 'post-opt-out main probe reached Tempo');
    return `receiver_requests_after_opt_out=0 observed=${report.observedMs}ms post_opt_out_api_requests=2 post_opt_out_traces=0`;
  });
}

async function main() {
  const args = process.argv.slice(2);
  const known = new Set(['--serial']);
  if (args.some(arg => !known.has(arg))) {
    console.error('Usage: node scripts/otel-failure-smoke.mjs [--serial]');
    process.exit(2);
  }
  const options = { serial: args.includes('--serial'), agentTimeoutMs: 170000 };
  const startedAt = Date.now();
  const marker = crypto.randomBytes(4).toString('hex');
  const runId = `ktsmoke-${marker}`;
  let containerWasRunning = true;
  let root;
  let forwarder;
  const children = new Set();
  let cleaningUp = false;

  const cleanup = async () => {
    if (cleaningUp) return;
    cleaningUp = true;
    for (const child of children) { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ } }
    forwarder?.close();
    if (root) {
      const leftover = findProcesses(root);
      for (const pid of leftover) { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } }
      await delay(leftover.length ? 500 : 0);
      const survivors = findProcesses(root);
      record(survivors.length === 0, 'cleanup: no harness process, debug port or namespace left',
        survivors.length ? `-> ${survivors.length} survivors` : `(killed_stragglers=${leftover.length})`);
      fs.rmSync(root, { recursive: true, force: true });
      record(!fs.existsSync(root), 'cleanup: synthetic profiles, certificate and sockets removed');
    }
    if (!containerWasRunning) {
      await exec('podman', ['stop', '-t', '60', CONTAINER], { timeout: 90000 }).catch(() => {});
      console.log(`NOTE ${CONTAINER} was stopped when the run began; stopped it again (volume untouched)`);
    } else console.log(`NOTE ${CONTAINER} was already running; left running`);
  };
  const abort = signal => () => { console.error(`Interrupted (${signal})`); cleanup().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143)); };
  process.once('SIGINT', abort('SIGINT'));
  process.once('SIGTERM', abort('SIGTERM'));

  try {
    // --- prerequisites (never creates or replaces the container) ---
    const buildPath = path.join(REPO, 'out/main/index.js');
    if (!fs.existsSync(buildPath)) {
      console.error('Build first: npm run build'); process.exit(2);
    }
    const sourceFiles = [];
    const collect = dir => {
      for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) collect(full);
        else if (item.isFile()) sourceFiles.push({ path: path.relative(REPO, full), mtimeMs: fs.statSync(full).mtimeMs });
      }
    };
    collect(path.join(REPO, 'src'));
    collect(path.join(REPO, 'utils'));
    const stale = staleSourceFiles(sourceFiles, fs.statSync(buildPath).mtimeMs);
    if (stale.length) {
      console.error(`Stale build: ${stale.slice(0, 10).join(', ')}${stale.length > 10 ? ` (+${stale.length - 10} more)` : ''} `
        + 'is newer than out/main/index.js. Run: npm run build'); process.exit(2);
    }
    await exec('unshare', ['-rn', 'true']).catch(() => { console.error('Unprivileged user+net namespaces (unshare -rn) are required'); process.exit(2); });
    await exec('openssl', ['version']).catch(() => { console.error('openssl is required'); process.exit(2); });
    const status = await exec('podman', ['inspect', '-f', '{{.State.Status}}', CONTAINER]).then(r => r.stdout.trim(), () => null);
    if (!status) { console.error(`Container ${CONTAINER} does not exist; create it as documented in README.md (not created automatically)`); process.exit(2); }
    const bindings = JSON.parse((await exec('podman', ['inspect', '-f', '{{json .HostConfig.PortBindings}}', CONTAINER])).stdout);
    const loopbackOnly = Object.values(bindings).flat().every(binding => binding.HostIp === '127.0.0.1');
    if (!loopbackOnly) { console.error(`${CONTAINER} publishes ports beyond loopback; refusing`); process.exit(2); }
    containerWasRunning = status === 'running';
    if (!containerWasRunning) await exec('podman', ['start', CONTAINER]);
    await waitFor('Tempo readiness', async () => (await exec('podman', ['exec', CONTAINER, 'curl', '-fsS', `${TEMPO}/ready`])).stdout.includes('ready'),
      { timeoutMs: 120000, intervalMs: 2000 });
    await waitFor('OTLP/HTTP listener', () => new Promise(resolve => {
      const socket = net.connect({ host: '127.0.0.1', port: OTLP_PORT, timeout: 2000 });
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => resolve(false));
      socket.once('timeout', () => { socket.destroy(); resolve(false); });
    }), { timeoutMs: 60000, intervalMs: 1000 });
    record(true, `lgtm: ${CONTAINER} ready`, `(found ${status}; Tempo ready; OTLP 127.0.0.1:${OTLP_PORT}; loopback-only ports)`);

    // --- synthetic fixtures ---
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktotel-'));
    const certPath = path.join(root, 'cert.pem');
    const keyPath = path.join(root, 'key.pem');
    await exec('openssl', ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', keyPath,
      '-out', certPath, '-days', '1', '-subj', '/CN=kick.com', '-addext', `subjectAltName=${STUB_HOSTS.map(host => `DNS:${host}`).join(',')}`]);
    const spki = crypto.createHash('sha256')
      .update(new crypto.X509Certificate(fs.readFileSync(certPath)).publicKey.export({ type: 'spki', format: 'der' })).digest('base64');
    const lgtmSock = path.join(root, 'lgtm.sock');
    forwarder = net.createServer(client => {
      const upstream = net.connect({ host: '127.0.0.1', port: OTLP_PORT });
      client.pipe(upstream).pipe(client);
      const end = () => { client.destroy(); upstream.destroy(); };
      client.on('error', end); upstream.on('error', end);
    });
    await new Promise(resolve => forwarder.listen(lgtmSock, resolve));
    const tokens = { token: `ktsmoke-token-${crypto.randomBytes(8).toString('hex')}`, session: `ktsmoke-session-${crypto.randomBytes(8).toString('hex')}` };
    const forbidden = ['KTSYNTH', 'KTPEER', 'synthetic upstream failure', 'synthetic-accepted', 'Bearer ', tokens.token, tokens.session];
    const idBase = 100000 + crypto.randomInt(800000);
    const chatIds = { failures: idBase, unauth: idBase + 10, exporter: idBase + 20, disabled: idBase + 30, runtime: idBase + 40 };
    const base = {
      root, children, tokens, chatIds,
      shared: { runId, certPath, keyPath, spki, lgtmSock, forbidden },
    };

    // --- launches: separate namespaces, so they cannot collide on ports ---
    const kinds = ['failures', 'unauth', 'exporter', 'disabled', 'runtime'];
    const launches = [];
    if (options.serial) for (const kind of kinds) launches.push(await launchAgent(kind, base, options));
    else launches.push(...await Promise.all(kinds.map(kind => launchAgent(kind, base, options))));
    const byKind = Object.fromEntries(launches.map(launch => [launch.kind, launch]));
    console.log(`NOTE launches finished after ${Math.round((Date.now() - startedAt) / 1000)}s `
      + `(${options.serial ? 'serial' : 'concurrent'}; the 30 s confirmation cases of each send/reply run concurrently inside one launch)`);

    // --- Tempo readback and assertions ---
    const control = {};
    await verifyFailures(byKind.failures, startedAt, control);
    await verifyUnauth(byKind.unauth, startedAt);
    await verifyExporter(byKind.exporter, startedAt);
    await verifyDisabled(byKind.disabled, startedAt, control);
    await verifyRuntimeDisabled(byKind.runtime, startedAt);

    if (outcomes.some(item => !item.ok)) {
      for (const launch of launches) {
        if (launch.report?.error || launch.timedOut || !launch.report) {
          const { report } = launch;
          console.log(`--- ${launch.kind} steps ---\n${(report?.steps || []).join('\n')}\n${explain(launch)}`);
          console.log(`--- ${launch.kind} stub sends ---\n${JSON.stringify(report?.stub?.sends?.map(({ marker, status, type, heldMs }) => ({ marker, status, type, heldMs })))}`);
          console.log(`--- ${launch.kind} rows ---\n${JSON.stringify(report?.dom, null, 1)}\n${(report?.appLog || []).join('\n').slice(0, 1500)}`);
        }
      }
    }
  } catch (error) {
    record(false, 'harness', `-> ${String(error?.message || error).split('\n')[0]}`);
  } finally {
    await cleanup();
  }
  const failed = outcomes.filter(item => !item.ok).length;
  console.log(`${failed ? 'FAILED' : 'OK'}: ${outcomes.length - failed}/${outcomes.length} checks passed in ${Math.round((Date.now() - startedAt) / 1000)}s`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[2] === '--agent' && process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  await runAgent(JSON.parse(fs.readFileSync(process.argv[3], 'utf8')));
} else if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  await main();
}
