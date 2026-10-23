// @vitest-environment node
import { gzipSync } from 'node:zlib';
import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendMessageToChannel, sendReplyToChannel } from '../utils/services/kick/kickAPI.js';
import {
  SEND_METRICS, SEND_PACING, classifyTempoHttp, decodeAttributes, decodeOtlpBody, expectSendMetrics, expectSendTrace, forbiddenHits,
  hexId, normalizeMetrics, normalizeSpans, sendPacingDelayMs, staleSourceFiles,
} from '../scripts/otel-failure-smoke.mjs';

// Only the network boundary of the real preload send guard is replaced.
vi.mock('axios', () => ({ default: { post: vi.fn(async () => ({ status: 200, data: {} })) } }));

// The live harness (scripts/otel-failure-smoke.mjs) is never run here; these pin the pure
// Tempo decoding and trace-matching logic that decides whether it passes.

const TRACE = '0123456789abcdef0123456789abcdef';
const hex = value => value.padStart(16, '0');
const nanos = ms => String(BigInt(Math.round(ms * 1e6)));
const T0 = 1_800_000_000_000;
const RESOURCE = { 'service.name': 'kicktalk-renderer', 'service.version': '2.0.2' };
const REASON = {
  mapped: 'Chatroom is in slow mode. Slow down your messages.',
  unknown: 'An error occurred while sending your message.',
  timeout: 'Delivery could not be confirmed. Your message may have been sent; check chat before retrying.',
  unauth: 'You must login to chat.',
};

const span = (name, spanId, overrides = {}) => ({
  name, traceId: TRACE, spanId: hex(spanId), parentSpanId: '', status: 0, statusMessage: '',
  attrs: {}, resource: RESOURCE, scope: 'kicktalk-renderer', events: [], startMs: T0, endMs: T0 + 5, ...overrides,
});
const failed = (reason, attrs) => ({ status: 2, statusMessage: reason, attrs });
const TEMP = 'temp_1_abc';
const OP = 'op_1_abc';
const optimistic = [{ name: 'optimistic.add', attrs: { 'message.temp_id': TEMP } }];
const COMPOSER = 'chat.input.send_message';

// Composer (root, id a) -> provider operation (id 1) -> API (id 2) [-> terminal (id 3)].
const ids = { 'message.operation_id': OP, 'message.temp_id': TEMP };
const composer = (overrides = {}) => span(COMPOSER, 'a', { attrs: ids, ...overrides });
const operation = (action, overrides = {}) => span(action === 'send' ? 'chat.send' : 'chat.reply', '1', {
  attrs: ids, events: optimistic, parentSpanId: hex('a'), ...overrides,
});

function mapped(action = 'send', overrides = {}) {
  const failure = failed(REASON.mapped, { ...ids, 'error.type': 'SLOW_MODE_ERROR', 'http.response.status_code': 422 });
  return [
    composer({ ...failure, ...overrides.input }),
    operation(action, { ...failure, ...overrides.operation }),
    span(action === 'send' ? 'chat.api.sendMessage' : 'chat.api.sendReply', '2', {
      ...failure, parentSpanId: hex('1'), attrs: { ...failure.attrs, 'http.request.method': 'POST' }, ...overrides.api,
    }),
  ];
}

// pending: the request is still open when the 30 s timeout fires; confirmed: the echo arrived instead.
function accepted({ pending = false, afterMs = 30001, timeoutAttrs = {}, confirmed = false, retry = false, action = 'send' } = {}) {
  const terminal = confirmed
    ? { attrs: { ...ids, 'message.delivery': 'confirmed', ...timeoutAttrs }, startMs: T0 + 400, endMs: T0 + 401 }
    : {
      ...failed(REASON.timeout, { ...ids, 'error.type': 'SEND_TIMEOUT', 'message.delivery': 'unconfirmed', ...timeoutAttrs }),
      startMs: T0 + afterMs, endMs: T0 + afterMs + 1,
    };
  const parent = retry ? [] : [composer({ endMs: pending ? T0 + 31000 : T0 + 20 })];
  return [
    ...parent,
    operation(action, { ...(retry ? { parentSpanId: '' } : {}), endMs: pending ? T0 + 31000 : T0 + 20 }),
    span(action === 'send' ? 'chat.api.sendMessage' : 'chat.api.sendReply', '2', {
      parentSpanId: hex('1'), attrs: { ...ids, 'http.request.method': 'POST', 'http.response.status_code': 200 },
    }),
    span(`${action === 'send' ? 'chat.send' : 'chat.reply'}.${confirmed ? 'confirmed' : 'confirmation_timeout'}`, '3', {
      parentSpanId: hex('1'), ...terminal,
    }),
  ];
}

describe('Tempo absence versus failure, and build freshness', () => {
  it('treats only HTTP 404 as proven absence', () => {
    expect(classifyTempoHttp(404, 'trace not found')).toEqual({ kind: 'absent' });
    expect(classifyTempoHttp(404, '')).toEqual({ kind: 'absent' });
    expect(classifyTempoHttp(200, '{"traces":[]}')).toEqual({ kind: 'ok', data: { traces: [] } });
  });

  it('classifies transport, server and parse failures as errors, never absence', () => {
    for (const [status, body] of [[null, ''], [undefined, ''], [500, '{}'], [503, 'down'], [429, ''], [200, '{invalid'], [301, '']]) {
      expect(classifyTempoHttp(status, body).kind).toBe('error');
    }
    expect(classifyTempoHttp(500, '{}').message).toMatch(/HTTP 500/);
    expect(classifyTempoHttp(null, '').message).toMatch(/transport/);
    expect(classifyTempoHttp(200, '{invalid').message).toMatch(/invalid JSON/);
  });

  it('flags only sources strictly newer than the build output', () => {
    const files = [
      { path: 'src/older.js', mtimeMs: 999 },
      { path: 'src/same.js', mtimeMs: 1000 },
      { path: 'utils/newer.js', mtimeMs: 1001 },
    ];
    expect(staleSourceFiles(files, 1000)).toEqual(['utils/newer.js']);
    expect(staleSourceFiles(files, 2000)).toEqual([]);
    expect(staleSourceFiles([], 0)).toEqual([]);
  });
});

describe('scripted send pacing', () => {
  afterEach(() => {
    vi.useRealTimers();
    axios.post.mockClear();
  });

  it('waits only while the window is full, until the oldest counted attempt leaves it', () => {
    const { windowMs, maxAttempts } = SEND_PACING;
    const burst = Array.from({ length: maxAttempts - 1 }, (_, index) => 10_000 + index * 100);
    expect(sendPacingDelayMs([], 10_000)).toBe(0);
    expect(sendPacingDelayMs(burst, 10_700)).toBe(0);
    const full = [10_700, ...burst];
    expect(sendPacingDelayMs(full, 10_800)).toBe(10_000 + windowMs - 10_800);
    expect(sendPacingDelayMs(full, 10_000 + windowMs - 1)).toBe(1);
    expect(sendPacingDelayMs(full, 10_000 + windowMs)).toBe(0);
    expect(sendPacingDelayMs([...full, 10_900], 10_950)).toBe(10_100 + windowMs - 10_950);
  });

  it('keeps a long scripted run under the real preload guard that otherwise declines it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    const run = async (channel, paced) => {
      const times = [];
      let declined = 0;
      for (let index = 0; index < 40; index++) {
        if (paced) for (let wait; (wait = sendPacingDelayMs(times, Date.now())) > 0;) vi.advanceTimersByTime(wait);
        times.push(Date.now());
        const send = index % 2 ? sendReplyToChannel(channel, 'x', {}, 'token', 'session') : sendMessageToChannel(channel, 'x', 'token', 'session');
        if (!(await send.catch(() => null))) declined += 1;
        vi.advanceTimersByTime(330);
      }
      return declined;
    };
    // Roughly the original smoke cadence: the 9th send inside 3 s is declined locally with no request.
    expect(await run(1, false)).toBeGreaterThan(0);
    expect(axios.post.mock.calls.length).toBeLessThan(40);
    axios.post.mockClear();
    expect(await run(2, true)).toBe(0);
    expect(axios.post).toHaveBeenCalledTimes(40);
  });
});

describe('Tempo decoding', () => {

  it('normalizes hex and base64 ids', () => {
    expect(hexId('00f067aa0ba902b7')).toBe('00f067aa0ba902b7');
    expect(hexId(Buffer.from('00f067aa0ba902b7', 'hex').toString('base64'))).toBe('00f067aa0ba902b7');
    expect(hexId(undefined)).toBe('');
  });

  it('decodes attributes, string and numeric status codes, and ids from OTLP JSON', () => {
    const attributes = decodeAttributes([
      { key: 'a', value: { stringValue: 'x' } }, { key: 'b', value: { intValue: '422' } },
      { key: 'c', value: { boolValue: true } }, { key: 'd', value: { doubleValue: 1.5 } },
    ]);
    expect(attributes).toEqual({ a: 'x', b: 422, c: true, d: 1.5 });

    const data = {
      batches: [{
        resource: { attributes: [{ key: 'service.name', value: { stringValue: 'kicktalk' } }] },
        scopeSpans: [{ scope: { name: 's' }, spans: [
          { name: 'one', traceId: Buffer.from(TRACE, 'hex').toString('base64'), spanId: Buffer.from(hex('9'), 'hex').toString('base64'),
            parentSpanId: Buffer.from(hex('8'), 'hex').toString('base64'), status: { code: 'STATUS_CODE_ERROR', message: 'm' },
            startTimeUnixNano: nanos(T0), endTimeUnixNano: nanos(T0 + 250) },
          { name: 'two', traceId: TRACE, spanId: hex('7'), status: { code: 2 },
            startTimeUnixNano: nanos(T0), endTimeUnixNano: nanos(T0 + 1) },
        ] }],
      }],
    };
    const [one, two] = normalizeSpans(data);
    expect(one).toMatchObject({ traceId: TRACE, spanId: hex('9'), parentSpanId: hex('8'), status: 2, statusMessage: 'm', scope: 's' });
    expect(one.endMs - one.startMs).toBeCloseTo(250, 0);
    expect(one.resource['service.name']).toBe('kicktalk');
    expect(two.status).toBe(2);
    expect(normalizeSpans(null)).toEqual([]);
  });

  it('decodes plain and gzipped OTLP JSON bodies and flags what it cannot read', () => {
    const body = { resourceSpans: [{
      resource: { attributes: [{ key: 'service.name', value: { stringValue: 'kicktalk-renderer' } }] },
      scopeSpans: [{ spans: [{ name: 'chat.send', traceId: TRACE, spanId: hex('1'), startTimeUnixNano: '1', endTimeUnixNano: '2' }] }],
    }] };
    const raw = Buffer.from(JSON.stringify(body));
    for (const [payload, headers] of [[raw, {}], [gzipSync(raw), { 'content-encoding': 'gzip' }]]) {
      const decoded = decodeOtlpBody(payload, { 'content-type': 'application/json', ...headers });
      expect(decoded).toMatchObject({ encoding: 'json', services: ['kicktalk-renderer'], spans: [{ name: 'chat.send', spanId: hex('1') }] });
    }
    expect(decodeOtlpBody(raw, { 'content-type': 'application/x-protobuf' }).encoding).toBe('binary');
    expect(decodeOtlpBody(Buffer.from('{'), { 'content-type': 'application/json' }).encoding).toBe('invalid-json');
    expect(decodeOtlpBody(Buffer.from('nope'), { 'content-type': 'application/json', 'content-encoding': 'gzip' }).encoding).toBe('undecodable');
  });

  it('reports which forbidden markers appear', () => {
    expect(forbiddenHits('a KTSYNTH b token-1', ['KTSYNTH', 'token-1', 'absent'])).toEqual(['KTSYNTH', 'token-1']);
  });
});

describe('expectSendTrace', () => {
  const run = (spans, kind, action = 'send', reason = REASON[kind === 'mapped' || kind === 'unknown' || kind === 'unauth' ? kind : 'timeout'], retry = false) =>
    expectSendTrace(spans, { action, kind, tempId: TEMP, reason, retry });

  it.each(['send', 'reply'])('accepts a mapped %s rejection with its known HTTP status through composer, provider and API', action => {
    expect(run(mapped(action), 'mapped', action)).toEqual({ traceId: TRACE, operationId: OP });
  });

  it('accepts an unknown failure with a 503 and the fixed fallback reason on every layer', () => {
    const failure = failed(REASON.unknown, { ...ids, 'error.type': 'UNKNOWN_SEND_ERROR', 'http.response.status_code': 503 });
    const spans = mapped('send', {
      input: failure, operation: failure, api: { ...failure, attrs: { ...failure.attrs, 'http.request.method': 'POST' } },
    });
    expect(() => run(spans, 'unknown')).not.toThrow();
  });

  it('accepts local authentication failure only as composer plus provider spans without HTTP status or temp id', () => {
    const attrs = { 'message.operation_id': OP, 'error.type': 'Unauthorized' };
    const local = (extra = {}) => [
      span(COMPOSER, 'a', failed(REASON.unauth, { ...attrs, ...extra })),
      span('chat.reply', '1', { ...failed(REASON.unauth, { ...attrs, ...extra }), parentSpanId: hex('a') }),
    ];
    expect(() => run(local(), 'unauth', 'reply')).not.toThrow();
    expect(() => run(local({ 'http.response.status_code': 401 }), 'unauth', 'reply')).toThrow(/invented an HTTP status/);
    expect(() => run(local({ 'message.temp_id': TEMP }), 'unauth', 'reply')).toThrow(/temp id/);
    expect(() => run(local().slice(1), 'unauth', 'reply')).toThrow(/expected 2 spans/);
  });

  it('accepts accepted-without-echo (operation ended first) and still-pending (operation outlives the timeout)', () => {
    expect(run(accepted(), 'accepted')).toMatchObject({ traceId: TRACE, operationId: OP, elapsedMs: 30001 });
    expect(() => run(accepted({ pending: true }), 'pending')).not.toThrow();
  });

  it('accepts an API-accepted request confirmed by its echo without any cause or HTTP status on the confirmation', () => {
    expect(run(accepted({ confirmed: true }), 'confirmed')).toEqual({ traceId: TRACE, operationId: OP });
    expect(() => run(accepted({ confirmed: true, timeoutAttrs: { 'error.type': 'SEND_TIMEOUT' } }), 'confirmed')).toThrow(/carry a cause/);
    expect(() => run(accepted({ confirmed: true, timeoutAttrs: { 'message.delivery': 'unconfirmed' } }), 'confirmed')).toThrow();
    expect(() => run(accepted({ confirmed: true }), 'accepted')).toThrow();
  });

  it('accepts a manual retry as a fresh provider root with no composer span', () => {
    const spans = accepted({ confirmed: true, retry: true });
    expect(run(spans, 'retry_confirmed', 'send', undefined, true)).toEqual({ traceId: TRACE, operationId: OP });
    expect(() => run(spans, 'retry_confirmed')).toThrow(/expected 4 spans/);
    expect(() => run(accepted({ confirmed: true }), 'retry_confirmed', 'send', undefined, true)).toThrow(/expected 3 spans/);
  });

  it('rejects a trace that misattributes the ordering of accepted versus pending', () => {
    expect(() => run(accepted({ pending: true }), 'accepted')).toThrow(/ended before the timeout/);
    expect(() => run(accepted(), 'pending')).toThrow(/still have been pending/);
  });

  it('rejects wrong parenting, causes, statuses, ids, reasons and timing', () => {
    expect(() => run(mapped('send', { api: { parentSpanId: hex('9') } }), 'mapped')).toThrow(/API span is not a child/);
    expect(() => run(mapped('send', { operation: { parentSpanId: hex('9') } }), 'mapped')).toThrow(/not a child of composer/);
    expect(() => run(mapped('send', { input: { parentSpanId: hex('9') } }), 'mapped')).toThrow(/composer is not a root/);
    expect(() => run(mapped('send', { api: { attrs: { ...ids, 'error.type': 'OTHER', 'http.response.status_code': 422, 'http.request.method': 'POST' } } }), 'mapped'))
      .toThrow(/cause/);
    expect(() => run(mapped('send', { operation: { attrs: { ...ids, 'error.type': 'SLOW_MODE_ERROR' } } }), 'mapped'))
      .toThrow(/HTTP status/);
    expect(() => run(mapped('send', { operation: { status: 1 } }), 'mapped')).toThrow(/not ERROR/);
    expect(() => run(mapped('send', { input: { status: 0 } }), 'mapped')).toThrow(/not ERROR/);
    expect(() => run(mapped(), 'mapped', 'send', 'A different reason.')).toThrow();
    expect(() => expectSendTrace(mapped(), { action: 'send', kind: 'mapped', tempId: 'temp_other', reason: REASON.mapped })).toThrow(/temp id/);
    expect(() => run(mapped('send', { api: { attrs: { ...ids, 'message.operation_id': 'op_other', 'error.type': 'SLOW_MODE_ERROR', 'http.response.status_code': 422, 'http.request.method': 'POST' } } }), 'mapped'))
      .toThrow(/operation id differs/);
    expect(() => run(accepted({ timeoutAttrs: { 'http.response.status_code': 408 } }), 'accepted')).toThrow(/invented an HTTP status/);
    expect(() => run(accepted({ afterMs: 2000 }), 'accepted')).toThrow(/expected about 30000/);
    expect(() => run([...mapped(), span('chat.extra', '5')], 'mapped')).toThrow(/expected 3 spans/);
    expect(() => run(mapped().map(item => ({ ...item, resource: { ...RESOURCE, 'service.name': 'kicktalk' } })), 'mapped'))
      .toThrow(/wrong service/);
  });
});

describe('send outcome metrics decoded from the actual OTLP JSON export', () => {
  const labels = ({ outcome, messageType = 'regular', cause, ...extra }) => [
    { key: 'outcome', value: { stringValue: outcome } }, { key: 'message_type', value: { stringValue: messageType } },
    ...(cause ? [{ key: 'cause', value: { stringValue: cause } }] : []),
    ...Object.entries(extra).map(([key, value]) => ({ key, value: { stringValue: value } })),
  ];
  const counter = (spec, value, start = '100') => ({
    attributes: labels(spec), startTimeUnixNano: start, timeUnixNano: '200', asInt: String(value),
  });
  const histogram = (spec, count, sum, start = '100') => ({
    attributes: labels(spec), startTimeUnixNano: start, timeUnixNano: '200', count: String(count), sum,
    bucketCounts: [String(count), '0'], explicitBounds: [1],
  });
  const body = ({ counters, histograms, temporality = 2, service = 'kicktalk' }) => ({
    resourceMetrics: [{
      resource: { attributes: [{ key: 'service.name', value: { stringValue: service } }] },
      scopeMetrics: [{ scope: { name: 'kicktalk' }, metrics: [
        { name: SEND_METRICS.outcomes, sum: { aggregationTemporality: temporality, isMonotonic: true, dataPoints: counters } },
        { name: SEND_METRICS.duration, histogram: { aggregationTemporality: temporality, dataPoints: histograms } },
      ] }],
    }],
  });
  const exportOf = (...bodies) => bodies.map(item => ({ path: '/v1/metrics', metrics: normalizeMetrics(item) }));
  const ATTEMPT = { outcome: 'attempted' };
  const REJECT = { outcome: 'rejected', cause: 'SLOW_MODE_ERROR' };
  const EXPECTED = [
    { messageType: 'regular', outcome: 'attempted', count: 2 },
    { messageType: 'regular', outcome: 'rejected', cause: 'SLOW_MODE_ERROR', count: 1 },
  ];
  const snapshot = (attempts, rejects, overrides = {}) => body({
    counters: [counter(ATTEMPT, attempts), counter(REJECT, rejects)],
    histograms: [histogram(ATTEMPT, attempts, 0), histogram(REJECT, rejects, 0.4)],
    ...overrides,
  });

  it('decodes counters and histograms with their labels, temporality and cumulative stream identity', () => {
    const [attempted, rejected, ...rest] = normalizeMetrics(snapshot(2, 1));
    expect(attempted).toMatchObject({
      name: SEND_METRICS.outcomes, type: 'sum', value: 2, monotonic: true, temporality: 2, start: '100',
      attrs: { outcome: 'attempted', message_type: 'regular' }, resource: { 'service.name': 'kicktalk' },
    });
    expect(rejected.attrs).toEqual({ outcome: 'rejected', message_type: 'regular', cause: 'SLOW_MODE_ERROR' });
    expect(rest).toHaveLength(2);
    expect(rest[1]).toMatchObject({ name: SEND_METRICS.duration, type: 'histogram', count: 1, sum: 0.4, buckets: [1, 0] });
    expect(normalizeMetrics(null)).toEqual([]);
    const decoded = decodeOtlpBody(Buffer.from(JSON.stringify(snapshot(2, 1))), { 'content-type': 'application/json' });
    expect(decoded).toMatchObject({ encoding: 'json', services: ['kicktalk'], spans: [] });
    expect(decoded.metrics).toHaveLength(4);
  });

  it('uses the latest cumulative snapshot per series, never the sum of repeated exports', () => {
    const records = exportOf(snapshot(1, 0), snapshot(2, 1), snapshot(2, 1));
    expect(expectSendMetrics(records, EXPECTED)).toBe(3);
    expect(() => expectSendMetrics(records, [{ ...EXPECTED[0], count: 5 }, EXPECTED[1]])).toThrow(/wrong exact transition count/);
  });

  it('rejects missing, extra, unbounded and non-cumulative series', () => {
    const only = { counters: [counter(ATTEMPT, 2)], histograms: [histogram(ATTEMPT, 2, 0)] };
    expect(() => expectSendMetrics(exportOf(body(only)), EXPECTED)).toThrow(/missing transition label sets/);
    expect(() => expectSendMetrics(exportOf(snapshot(2, 1)), [EXPECTED[0]])).toThrow(/unexpected outcome/);
    const unbounded = body({
      counters: [counter({ ...ATTEMPT, operation_id: OP }, 2), counter(REJECT, 1)],
      histograms: [histogram(ATTEMPT, 2, 0), histogram(REJECT, 1, 0.4)],
    });
    expect(() => expectSendMetrics(exportOf(unbounded), EXPECTED)).toThrow(/unbounded metric dimensions/);
    expect(() => expectSendMetrics(exportOf(snapshot(2, 1, { temporality: 1 })), EXPECTED)).toThrow(/not cumulative/);
    expect(() => expectSendMetrics(exportOf(snapshot(2, 1, { service: 'kicktalk-renderer' })), EXPECTED)).toThrow(/not exported by main SDK/);
    expect(() => expectSendMetrics([], EXPECTED)).toThrow(/captured no send-outcome metric points/);
  });

  it('rejects decreasing or restarted counters and inconsistent histograms', () => {
    expect(() => expectSendMetrics(exportOf(snapshot(2, 1), snapshot(1, 1)), EXPECTED)).toThrow(/decreased/);
    const restarted = body({ counters: [counter(ATTEMPT, 2, '999'), counter(REJECT, 1, '999')], histograms: [histogram(ATTEMPT, 2, 0, '999'), histogram(REJECT, 1, 0.4, '999')] });
    expect(() => expectSendMetrics(exportOf(snapshot(2, 1), restarted), EXPECTED)).toThrow(/restarted/);
    const nonZero = body({
      counters: [counter(ATTEMPT, 2), counter(REJECT, 1)], histograms: [histogram(ATTEMPT, 2, 0.5), histogram(REJECT, 1, 0.4)],
    });
    expect(() => expectSendMetrics(exportOf(nonZero), EXPECTED)).toThrow(/attempted duration must be zero/);
    const brokenBuckets = snapshot(2, 1);
    brokenBuckets.resourceMetrics[0].scopeMetrics[0].metrics[1].histogram.dataPoints[0].bucketCounts = ['1', '0'];
    expect(() => expectSendMetrics(exportOf(brokenBuckets), EXPECTED)).toThrow(/histogram bucket count/);
  });

  it('requires a measured 30 s duration for every unconfirmed observation', () => {
    const spec = { outcome: 'unconfirmed', cause: 'SEND_TIMEOUT' };
    const expected = [{ messageType: 'regular', outcome: 'unconfirmed', cause: 'SEND_TIMEOUT', count: 2 }];
    const measured = sum => body({ counters: [counter(spec, 2)], histograms: [histogram(spec, 2, sum)] });
    expect(expectSendMetrics(exportOf(measured(60.4)), expected)).toBe(2);
    expect(() => expectSendMetrics(exportOf(measured(1.2)), expected)).toThrow(/timeout duration was not measured/);
  });
});
