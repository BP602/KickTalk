#!/usr/bin/env node
// Repeatable failure-path OTEL check against the local LGTM container.
//
//   npm run build && npm run smoke:otel-failures [-- --serial]
//
// The harness (host side) owns the LGTM lifecycle, Tempo readback, assertions and
// cleanup. Each app launch runs inside a throwaway `unshare -rn` network
// namespace ("agent" mode) whose only interfaces are a fresh loopback:
//   - kick.com / 7tv.io / *.kicktalk.app are mapped by Chromium to a local HTTPS
//     stub (throwaway self-signed cert, trusted by SPKI pin) that scripts the
//     external API boundary. Nothing else is replaced: the real preload bridge,
//     store, OpenTelemetry SDK, IPC relay and exporters run unmodified.
//   - 127.0.0.1:4318 inside the namespace is a counting "receiver gate" that
//     either rejects (HTTP 401) or forwards to the host's LGTM through a unix
//     socket, so receiver-side counts are observed at the real boundary.
//   - Kick/Cloud are unreachable: the namespace has no route out (verified).
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
const SPAN_COUNT = { unauth: 1, mapped: 2, unknown: 2, accepted: 3, pending: 3 };

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

export function decodeOtlpBody(body, headers = {}) {
  let buffer = body;
  try {
    if (/gzip/i.test(headers['content-encoding'] || '')) buffer = zlib.gunzipSync(body);
  } catch {
    return { encoding: 'undecodable', services: [], spans: [], text: '' };
  }
  const text = buffer.toString('latin1');
  if (!/json/i.test(headers['content-type'] || '')) return { encoding: 'binary', services: [], spans: [], text };
  try {
    const json = JSON.parse(buffer.toString('utf8'));
    const spans = normalizeSpans(json);
    const resources = [...(json.resourceSpans || []), ...(json.resourceMetrics || [])];
    const services = [...new Set(resources
      .map(entry => decodeAttributes(entry.resource?.attributes)['service.name']).filter(Boolean))];
    return { encoding: 'json', services, spans: spans.map(({ name, traceId, spanId }) => ({ name, traceId, spanId })), text };
  } catch {
    return { encoding: 'invalid-json', services: [], spans: [], text };
  }
}

export const forbiddenHits = (text, markers) => markers.filter(marker => text.includes(marker));

// Asserts one send/reply trace exactly as stored by Tempo. `reason` is the text
// the application showed to the user for the same attempt.
export function expectSendTrace(spans, { action, kind, tempId, reason }) {
  const label = `${kind}/${action}`;
  const operationName = OPERATION[action];
  const named = name => spans.filter(span => span.name === name);
  const one = name => {
    const found = named(name);
    assert.equal(found.length, 1, `${label}: expected exactly one ${name}, found ${found.length}`);
    return found[0];
  };
  assert.equal(spans.length, SPAN_COUNT[kind], `${label}: expected ${SPAN_COUNT[kind]} spans, found ${spans.length}`);
  assert.equal(new Set(spans.map(span => span.traceId)).size, 1, `${label}: spans span several traces`);
  for (const span of spans) {
    assert.equal(span.resource['service.name'], 'kicktalk-renderer', `${label}: ${span.name} wrong service`);
    assert(span.resource['service.version'], `${label}: ${span.name} missing service.version`);
  }
  const operation = one(operationName);
  const noHttp = span => assert(!('http.response.status_code' in span.attrs), `${label}: ${span.name} invented an HTTP status`);

  if (kind === 'unauth') {
    assert.equal(operation.status, 2, `${label}: operation is not ERROR`);
    assert.equal(operation.statusMessage, reason, `${label}: status message differs from the UI reason`);
    assert.match(reason, REASON_PATTERN.unauth);
    assert.equal(operation.attrs['error.type'], FAILURE.unauth.code);
    noHttp(operation);
    assert(!('message.temp_id' in operation.attrs), `${label}: no row exists, so no temp id`);
    return { traceId: operation.traceId };
  }

  const api = one(API_SPAN[action]);
  assert.equal(api.parentSpanId, operation.spanId, `${label}: API span is not a child of the operation`);
  assert.equal(api.attrs['http.request.method'], 'POST');
  assert.equal(operation.attrs['message.temp_id'], tempId, `${label}: operation temp id differs from the UI row`);
  assert.equal(api.attrs['message.temp_id'], tempId, `${label}: API temp id differs from the UI row`);
  assert(operation.events.some(event => event.name === 'optimistic.add' && event.attrs['message.temp_id'] === tempId),
    `${label}: missing optimistic.add event`);

  if (kind === 'mapped' || kind === 'unknown') {
    assert.match(reason, REASON_PATTERN[kind]);
    for (const span of [operation, api]) {
      assert.equal(span.status, 2, `${label}: ${span.name} is not ERROR`);
      assert.equal(span.statusMessage, reason, `${label}: ${span.name} status message differs from the UI reason`);
      assert.equal(span.attrs['error.type'], FAILURE[kind].code, `${label}: ${span.name} cause`);
      assert.equal(span.attrs['http.response.status_code'], FAILURE[kind].http, `${label}: ${span.name} HTTP status`);
    }
    return { traceId: operation.traceId };
  }

  // accepted-without-echo / still-pending: the request itself did not fail.
  assert.match(reason, REASON_PATTERN.timeout);
  for (const span of [operation, api]) {
    assert.notEqual(span.status, 2, `${label}: ${span.name} must not be ERROR`);
    assert(!('error.type' in span.attrs), `${label}: ${span.name} must not carry a cause`);
  }
  assert.equal(api.attrs['http.response.status_code'], 200, `${label}: API HTTP status`);
  const timeout = one(`${operationName}.confirmation_timeout`);
  assert.equal(timeout.parentSpanId, operation.spanId, `${label}: timeout is not a child of the operation`);
  assert.equal(timeout.status, 2);
  assert.equal(timeout.statusMessage, reason, `${label}: timeout message differs from the UI reason`);
  assert.equal(timeout.attrs['error.type'], 'SEND_TIMEOUT');
  assert.equal(timeout.attrs['message.delivery'], 'unconfirmed');
  assert.equal(timeout.attrs['message.temp_id'], tempId);
  noHttp(timeout);
  const elapsed = timeout.startMs - operation.startMs;
  assert(elapsed >= CONFIRMATION_MS - 500 && elapsed < CONFIRMATION_MS + 15000,
    `${label}: timeout started ${Math.round(elapsed)}ms after the send, expected about 30000`);
  if (kind === 'accepted') {
    assert(timeout.startMs >= operation.endMs, `${label}: operation should have ended before the timeout fired`);
  } else {
    assert(timeout.startMs < operation.endMs, `${label}: request should still have been pending when the timeout fired`);
  }
  return { traceId: operation.traceId, elapsedMs: Math.round(elapsed) };
}

// ---------------------------------------------------------------------------
// Plans shared by the host and the agents
// ---------------------------------------------------------------------------

const entry = (n, kind, action) => ({ n, kind, action });
const markerFor = ({ n, kind, action }) => `KTSYNTH ${String(n).padStart(2, '0')} ${kind} ${action}`;
const PLANS = {
  // Both 30 s cases start first so their timers run while the quick cases execute.
  failures: [
    entry(1, 'accepted', 'send'), entry(2, 'accepted', 'reply'), entry(3, 'pending', 'send'), entry(4, 'pending', 'reply'),
    entry(5, 'mapped', 'send'), entry(6, 'mapped', 'reply'), entry(7, 'unknown', 'send'), entry(8, 'unknown', 'reply'),
  ],
  unauth: [entry(1, 'unauth', 'send'), entry(2, 'unauth', 'reply')],
  exporter: [entry(1, 'mapped', 'send'), entry(2, 'mapped', 'send')],
  disabled: [entry(1, 'mapped', 'send')],
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
    const list = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
    return list.find(item => item.webSocketDebuggerUrl && pick(item));
  }, { timeoutMs });
  const ws = new WebSocket(target.webSocketDebuggerUrl);
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
        const match = /^KTSYNTH (\d\d) (mapped|unknown|accepted|pending|unauth) (send|reply)$/.exec(parsed?.content ?? '');
        const record = {
          at: Date.now(), marker: match ? parsed.content : null, scenario: match?.[2] ?? null,
          chatId: Number(pathname.split('/').pop()), type: parsed?.type ?? null,
          replyTo: parsed?.metadata?.original_message?.id ?? null, authorized: Boolean(req.headers.authorization),
          status: null, heldMs: null,
        };
        sends.push(record);
        // Mirrors the synthetic envelopes in tests/failedSends.test.jsx.
        if (record.scenario === 'mapped') record.status = reply(json({ status: { message: 'SLOW_MODE_ERROR' } }, 422));
        else if (record.scenario === 'unknown') record.status = reply(json({ message: 'synthetic upstream failure' }, 503));
        else if (record.scenario === 'pending') held.set(record.marker, { res, headers, record });
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
    release(marker) {
      const hold = held.get(marker);
      if (!hold) return false;
      held.delete(marker);
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
    const chunks = [];
    let size = 0;
    req.on('data', chunk => { size += chunk.length; if (size <= 8 << 20) chunks.push(chunk); });
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const decoded = decodeOtlpBody(body, req.headers);
      const record = {
        at: Date.now(), phase: state.phase, mode: state.mode, method: req.method, path: req.url,
        host: req.headers.host, bytes: body.length, encoding: decoded.encoding, services: decoded.services,
        spans: decoded.spans, userAgent: String(req.headers['user-agent'] || '').split('/')[0] || null,
        channel: decoded.services.includes('kicktalk-renderer') ? 'renderer-relay' : 'main-sdk',
        leaks: forbiddenHits(decoded.text, cfg.forbidden), status: 0,
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
  const seen = (name, predicate = () => true) =>
    state.records.filter(record => record.spans.some(span => span.name === name && predicate(record, span))).length;
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
      XDG_CONFIG_HOME: path.join(cfg.root, 'xdg-config'),
      XDG_CACHE_HOME: path.join(cfg.root, 'xdg-cache'),
      OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${OTLP_PORT}`,
      OTEL_EXPORTER_OTLP_HEADERS: '',
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

    const rowExpression = marker => `(() => {
      const marker = ${JSON.stringify(marker)};
      const el = [...document.querySelectorAll('.chatMessageItem')].find(item => item.innerText.includes(marker));
      if (!el) return { present: false };
      const key = Object.keys(el).find(name => name.startsWith('__reactFiber$'));
      let fiber = key ? el[key] : null;
      // React double-buffers fibers: the node's fiber may be the previous render, so inspect both.
      let row = null;
      for (let depth = 0; fiber && depth < 80 && !row; depth++, fiber = fiber.return) {
        const found = [fiber, fiber.alternate].map(item => item?.memoizedProps?.message)
          .filter(message => message && typeof message === 'object' && message.content === marker);
        if (found.length) row = found.find(message => message.state === 'failed') || found[0];
      }
      const reason = el.querySelector('.chatMessageFailureReason');
      return { present: true, domFailed: el.classList.contains('failed'), domReason: reason ? reason.textContent : null,
        row: row ? { tempId: row.tempId, state: row.state, failureReason: row.failureReason, type: row.type } : null };
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
    const perform = async item => {
      const marker = markerFor(item);
      if (item.action === 'reply') {
        await page.evaluate(`(() => {
          const icon = document.querySelector('svg[aria-label=${JSON.stringify(`Reply to ${PEER.username}`)}]');
          icon.closest('button').click();
          return true;
        })()`);
        await waitFor('reply target', () => page.evaluate("document.body.innerText.includes('Replying to')"), { timeoutMs: 10000 });
      }
      await page.evaluate("(() => { const input = document.querySelector('.chatInput'); input.focus(); return document.activeElement === input; })()");
      await page.send('Input.insertText', { text: marker });
      const record = { ...item, marker, sentAt: Date.now(), ui: null };
      report.sends.push(record);
      await pressEnter();
      return record;
    };
    const rowFor = record => waitFor(`${record.marker} row`, async () => {
      const state = await page.evaluate(rowExpression(record.marker));
      return state.present && state.row ? state : null;
    }, { timeoutMs: 10000 });
    const untilFailed = (record, timeoutMs) => waitFor(`${record.marker} failure`, async () => {
      const state = await page.evaluate(rowExpression(record.marker));
      return state.present && state.row?.state === 'failed' ? state : null;
    }, { timeoutMs, intervalMs: 200 });
    const settle = (record, state) => {
      record.ui = {
        tempId: state.row.tempId, state: state.row.state, reason: state.row.failureReason,
        domReason: state.domReason, domFailed: state.domFailed, type: state.row.type,
        elapsedMs: Date.now() - record.sentAt,
      };
    };
    const gateHas = (what, predicate, timeoutMs = 25000) => waitFor(what, () => predicate(), { timeoutMs, intervalMs: 300 });

    const plan = PLANS[cfg.kind];
    if (cfg.kind === 'failures') {
      const sent = [];
      for (const item of plan) {
        const record = await perform(item);
        sent.push(record);
        if (item.kind === 'accepted' || item.kind === 'pending') settle(record, await rowFor(record));
        else if (item.kind === 'mapped' || item.kind === 'unknown') settle(record, await untilFailed(record, 10000));
        note(`sent ${record.marker}`);
        await delay(1200);
      }
      for (const record of sent.filter(item => item.kind === 'accepted' || item.kind === 'pending')) {
        settle(record, await untilFailed(record, CONFIRMATION_MS + 20000));
        note(`${record.kind}/${record.action} flagged unconfirmed after ${record.ui.elapsedMs}ms`);
      }
      for (const record of sent.filter(item => item.kind === 'pending')) {
        assert(stub.release(record.marker), `no held request for ${record.marker}`);
      }
      const probe = await evalMain('ktsmoke_main_probe');
      const expected = { 'chat.send': 4, 'chat.reply': 4, 'chat.api.sendMessage': 4, 'chat.api.sendReply': 4,
        'chat.send.confirmation_timeout': 2, 'chat.reply.confirmation_timeout': 2 };
      await gateHas('every send span at the receiver', () =>
        Object.entries(expected).every(([name, count]) => gate.seen(name) >= count) && gate.sawSpan(probe.spanId));
      // A silent retry would show up as a second request well after the failure.
      await delay(5000);
    } else if (cfg.kind === 'unauth') {
      for (const item of plan) {
        const record = await perform(item);
        await waitFor('login message', async () => (await loginCount()) >= item.n, { timeoutMs: 10000 });
        record.ui = { reason: 'You must login to chat.', loginMessages: await loginCount() };
        note(`sent ${record.marker}`);
        await delay(800);
      }
      report.logins = await loginCount();
      await gateHas('both unauthenticated operation spans at the receiver', () =>
        gate.seen('chat.send') >= 1 && gate.seen('chat.reply') >= 1);
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
    }

    report.alive ??= await page.evaluate("!!document.querySelector('.chatInput')");
    note('scenario complete');
  } catch (error) {
    report.error = String(error?.stack || error).split('\n').slice(0, 4).join(' | ');
    process.exitCode = 1;
    // Safe diagnostics only: synthetic row text/classes and filtered app errors.
    report.dom = await page?.evaluate(`[...document.querySelectorAll('.chatMessageItem')].map(item =>
      item.className + ' | ' + item.innerText.replace(/\\s+/g, ' ').slice(0, 160))`).catch(() => null);
    const appLog = path.join(cfg.root, 'app.log');
    report.appLog = fs.existsSync(appLog)
      ? fs.readFileSync(appLog, 'utf8').split('\n').filter(line => /rror/.test(line) && !/dbus|gpu/i.test(line)).slice(-12) : null;
  } finally {
    page?.close();
    report.stub = stub && { sends: stub.sends, routes: stub.routes, hostsSeen: [...stub.hostsSeen] };
    report.gate = gate && { records: gate.state.records.map(({ ...record }) => record) };
    await killApp();
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

async function tempoGet(pathname, params = {}) {
  const args = ['exec', CONTAINER, 'curl', '-fsS', '-G', '--max-time', '10'];
  for (const [key, value] of Object.entries(params)) args.push('--data-urlencode', `${key}=${value}`);
  args.push(`${TEMPO}${pathname}`);
  try {
    const { stdout } = await exec('podman', args, { maxBuffer: 32 * 1024 * 1024, timeout: 20000 });
    return JSON.parse(stdout);
  } catch { return null; }
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
  try {
    await waitFor(`Tempo search ${query}`, async () => {
      const data = await tempoGet('/api/search', {
        q: query, limit: 20, start: Math.floor(runStart / 1000) - 30, end: Math.floor(Date.now() / 1000) + 300,
      });
      ids = (data?.traces || []).map(trace => trace.traceID);
      return ids.length >= expected;
    }, { timeoutMs, intervalMs: 1500 });
  } catch (error) {
    if (!ids.length && expected > 0) throw error;
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
  fs.mkdirSync(dir, { recursive: true });
  const cfg = {
    ...base.shared, kind, root: dir, profile: path.join(dir, 'profile'), reportPath: path.join(dir, 'report.json'),
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
    const undecoded = report.gate.records.filter(item => item.path === '/v1/traces' && item.encoding !== 'json');
    assert.equal(undecoded.length, 0, `${undecoded.length} trace payloads were not JSON-decodable`);
    const leaks = report.gate.records.filter(item => item.leaks.length);
    assert.equal(leaks.length, 0, `receiver payloads contained synthetic content/credentials: ${leaks.map(item => item.leaks).flat()}`);
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
      const spans = await readTrace(ids[0], item.kind === 'accepted' || item.kind === 'pending' ? 3 : 2);
      const stored = JSON.stringify(spans);
      assert.equal(forbiddenHits(stored, launch.cfg.forbidden).length, 0, 'stored spans contain synthetic content/credentials');
      const outcome = expectSendTrace(spans, { action: item.action, kind: item.kind, tempId: sent.ui.tempId, reason: sent.ui.reason });
      const requests = report.stub.sends.filter(request => request.marker === sent.marker);
      assert.equal(requests.length, 1, `expected exactly one API request, saw ${requests.length}`);
      assert.equal(requests[0].type, item.action === 'send' ? 'message' : 'reply');
      if (item.action === 'reply') assert.equal(requests[0].replyTo, PEER.id, 'reply did not target the peer message');
      if (item.kind === 'pending') assert(requests[0].heldMs >= CONFIRMATION_MS - 500, `request held ${requests[0].heldMs}ms`);
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
  await verifySends(launch, runStart, PLANS.failures);
  await check('failures: exact request counts, no automatic retry', async () => {
    const sends = report.stub.sends;
    assert.equal(sends.length, PLANS.failures.length, `expected ${PLANS.failures.length} send requests, saw ${sends.length}`);
    for (const item of PLANS.failures) {
      assert.equal(sends.filter(request => request.marker === markerFor(item)).length, 1, `${markerFor(item)} was requested more than once`);
    }
    assert(sends.every(request => request.authorized), 'a send was made without credentials');
    return `send_requests=${sends.length} retries=0 observed_for_5s_after_last_failure`;
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
      const spans = await readTrace(ids[0], 1);
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
    const spans = await readTrace(ids[0], 2);
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
    if (!fs.existsSync(path.join(REPO, 'out/main/index.js'))) {
      console.error('Build first: npm run build'); process.exit(2);
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
    const chatIds = { failures: idBase, unauth: idBase + 10, exporter: idBase + 20, disabled: idBase + 30 };
    const base = {
      root, children, tokens, chatIds,
      shared: { runId, certPath, keyPath, spki, lgtmSock, forbidden },
    };

    // --- launches: separate namespaces, so they cannot collide on ports ---
    const kinds = ['failures', 'unauth', 'exporter', 'disabled'];
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
