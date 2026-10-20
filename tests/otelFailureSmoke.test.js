// @vitest-environment node
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  decodeAttributes, decodeOtlpBody, expectSendTrace, forbiddenHits, hexId, normalizeSpans,
} from '../scripts/otel-failure-smoke.mjs';

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
const optimistic = [{ name: 'optimistic.add', attrs: { 'message.temp_id': TEMP } }];

function mapped(action = 'send', overrides = {}) {
  const failure = { ...failed(REASON.mapped, { 'error.type': 'SLOW_MODE_ERROR', 'http.response.status_code': 422, 'message.temp_id': TEMP }) };
  return [
    span(action === 'send' ? 'chat.send' : 'chat.reply', '1', { ...failure, events: optimistic, ...overrides.operation }),
    span(action === 'send' ? 'chat.api.sendMessage' : 'chat.api.sendReply', '2', {
      ...failure, parentSpanId: hex('1'), attrs: { ...failure.attrs, 'http.request.method': 'POST' }, ...overrides.api,
    }),
  ];
}

function unconfirmed({ pending = false, afterMs = 30001, timeoutAttrs = {} } = {}) {
  const base = { attrs: { 'message.temp_id': TEMP } };
  return [
    span('chat.send', '1', { ...base, events: optimistic, endMs: pending ? T0 + 31000 : T0 + 20 }),
    span('chat.api.sendMessage', '2', {
      parentSpanId: hex('1'), attrs: { 'message.temp_id': TEMP, 'http.request.method': 'POST', 'http.response.status_code': 200 },
    }),
    span('chat.send.confirmation_timeout', '3', {
      ...failed(REASON.timeout, {
        'error.type': 'SEND_TIMEOUT', 'message.delivery': 'unconfirmed', 'message.temp_id': TEMP, ...timeoutAttrs,
      }),
      parentSpanId: hex('1'), startMs: T0 + afterMs, endMs: T0 + afterMs + 1,
    }),
  ];
}

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
  const run = (spans, kind, action = 'send', reason = REASON[kind === 'mapped' || kind === 'unknown' || kind === 'unauth' ? kind : 'timeout']) =>
    expectSendTrace(spans, { action, kind, tempId: TEMP, reason });

  it.each(['send', 'reply'])('accepts a mapped %s rejection with its known HTTP status', action => {
    expect(run(mapped(action), 'mapped', action)).toEqual({ traceId: TRACE });
  });

  it('accepts an unknown failure with a 503 and the fixed fallback reason', () => {
    const failure = failed(REASON.unknown, { 'error.type': 'UNKNOWN_SEND_ERROR', 'http.response.status_code': 503, 'message.temp_id': TEMP });
    const spans = mapped('send', { operation: failure, api: { ...failure, attrs: { ...failure.attrs, 'http.request.method': 'POST' } } });
    expect(() => run(spans, 'unknown')).not.toThrow();
  });

  it('accepts local authentication failure only as one span without HTTP status or temp id', () => {
    const only = span('chat.reply', '1', failed(REASON.unauth, { 'error.type': 'Unauthorized' }));
    expect(() => run([only], 'unauth', 'reply')).not.toThrow();
    expect(() => run([span('chat.reply', '1', failed(REASON.unauth, { 'error.type': 'Unauthorized', 'http.response.status_code': 401 }))], 'unauth', 'reply'))
      .toThrow(/invented an HTTP status/);
    expect(() => run([span('chat.reply', '1', failed(REASON.unauth, { 'error.type': 'Unauthorized', 'message.temp_id': TEMP }))], 'unauth', 'reply'))
      .toThrow(/no row exists/);
  });

  it('accepts accepted-without-echo (operation ended first) and still-pending (operation outlives the timeout)', () => {
    expect(run(unconfirmed(), 'accepted')).toMatchObject({ traceId: TRACE, elapsedMs: 30001 });
    expect(() => run(unconfirmed({ pending: true }), 'pending')).not.toThrow();
  });

  it('rejects a trace that misattributes the ordering of accepted versus pending', () => {
    expect(() => run(unconfirmed({ pending: true }), 'accepted')).toThrow(/ended before the timeout/);
    expect(() => run(unconfirmed(), 'pending')).toThrow(/still have been pending/);
  });

  it('rejects wrong parenting, causes, statuses, ids, reasons and timing', () => {
    expect(() => run(mapped('send', { api: { parentSpanId: hex('9') } }), 'mapped')).toThrow(/not a child/);
    expect(() => run(mapped('send', { api: { attrs: { 'error.type': 'OTHER', 'http.response.status_code': 422, 'message.temp_id': TEMP, 'http.request.method': 'POST' } } }), 'mapped'))
      .toThrow(/cause/);
    expect(() => run(mapped('send', { operation: { attrs: { 'error.type': 'SLOW_MODE_ERROR', 'message.temp_id': TEMP } } }), 'mapped'))
      .toThrow(/HTTP status/);
    expect(() => run(mapped('send', { operation: { status: 1 } }), 'mapped')).toThrow(/not ERROR/);
    expect(() => run(mapped(), 'mapped', 'send', 'A different reason.')).toThrow();
    expect(() => expectSendTrace(mapped(), { action: 'send', kind: 'mapped', tempId: 'temp_other', reason: REASON.mapped })).toThrow(/temp id/);
    expect(() => run(unconfirmed({ timeoutAttrs: { 'http.response.status_code': 408 } }), 'accepted')).toThrow(/invented an HTTP status/);
    expect(() => run(unconfirmed({ afterMs: 2000 }), 'accepted')).toThrow(/expected about 30000/);
    expect(() => run([...mapped(), span('chat.extra', '5')], 'mapped')).toThrow(/expected 2 spans/);
    expect(() => run(mapped().map(item => ({ ...item, resource: { ...RESOURCE, 'service.name': 'kicktalk' } })), 'mapped'))
      .toThrow(/wrong service/);
  });
});
