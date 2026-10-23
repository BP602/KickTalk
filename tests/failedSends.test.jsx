// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { context, trace } from '@opentelemetry/api';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';

// Keep unrelated startup services out of this real store/action integration test.
vi.mock('../utils/fetchQueue', () => ({ default: vi.fn() }));
vi.mock('../utils/services/connectionManager', () => ({ default: vi.fn() }));
vi.mock('../src/renderer/src/providers/CosmeticsProvider', () => ({ default: vi.fn() }));
vi.mock('../utils/services/seventv/stvAPI', () => ({ sendUserPresence: vi.fn() }));
vi.mock('../utils/services/kick/kickAPI', () => ({ getKickTalkDonators: vi.fn() }));
vi.mock('../src/renderer/src/utils/MessageParser', () => ({
  clearChatroomEmoteCache: vi.fn(),
  MessageParser: ({ message }) => message.content,
}));
vi.mock('../src/renderer/src/components/Cosmetics/Badges', () => ({
  KickBadges: () => null, KickTalkBadges: () => null, StvBadges: () => null,
}));
vi.mock('../src/renderer/src/components/Messages/ModActions', () => ({ default: () => null }));
vi.mock('../src/renderer/src/utils/ChatUtils', () => ({ getTimestampFormat: () => '' }));

let useChatStore;
let traceProvider;
let spanExporter;

function captureSendTraces() {
  spanExporter = new InMemorySpanExporter();
  traceProvider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(spanExporter)],
  });
  window.__KT_TRACER__ = traceProvider.getTracer('failed-send-integration');
  window.__KT_TRACE_API__ = { context, trace };
}

async function flushSendTraces() {
  // Nested zero-delay exporter callbacks are deferred one millisecond by fake timers.
  await vi.advanceTimersByTimeAsync(1);
  await traceProvider.forceFlush();
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
  vi.stubGlobal('window', {
    location: { pathname: '/fixture.html' },
    app: {
      kick: { sendMessage: vi.fn(), sendReply: vi.fn() },
      store: { get: vi.fn(async () => ({ enabled: false })) },
      telemetry: { recordSendOutcome: vi.fn(), recordError: vi.fn() },
    },
  });
  ({ default: useChatStore } = await import('../src/renderer/src/providers/ChatProvider.jsx'));
  useChatStore.setState({
    messages: {},
    chatHistorySettings: { chatHistoryLength: 200 },
    isChatroomPaused: {},
    chatrooms: [{ id: 42, username: 'streamer' }],
    currentUser: { id: 9, username: 'sender' },
  });
});

afterEach(async () => {
  if (traceProvider) await flushSendTraces();
  await traceProvider?.shutdown();
  traceProvider = undefined;
  spanExporter = undefined;
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it.each(['sendMessage', 'sendReply'])('keeps duplicate %s failures associated with their own tempId', async (action) => {
  const first = deferred();
  const second = deferred();
  window.app.kick[action].mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const metadata = { original_message: { id: 'original', content: 'source' } };
  const a = useChatStore.getState()[action](42, 'duplicate', metadata);
  const b = useChatStore.getState()[action](42, 'duplicate', metadata);
  const [firstRow, secondRow] = useChatStore.getState().messages[42];
  second.reject({ response: { data: { status: { message: 'SLOW_MODE_ERROR' } } } });
  expect(await b).toBe(false);
  expect(useChatStore.getState().messages[42].find(row => row.tempId === firstRow.tempId).state).toBe('optimistic');
  first.reject({ code: 'CHAT_RATE_LIMIT_ERROR' });
  expect(await a).toBe(false);
  const rows = useChatStore.getState().messages[42];
  expect(rows.find(row => row.tempId === firstRow.tempId).failureReason).toMatch(/rate limit/i);
  expect(rows.find(row => row.tempId === secondRow.tempId).failureReason).toMatch(/slow mode/i);
});

it.each(['sendMessage', 'sendReply'])('records one %s attempt and safe rejection without claiming acceptance or delivery', async (action) => {
  window.app.kick[action].mockResolvedValue({ sendError: { code: 'SLOW_MODE_ERROR' } });
  expect(await useChatStore.getState()[action](42, 'private content')).toBe(false);
  const messageType = action === 'sendMessage' ? 'regular' : 'reply';
  expect(window.app.telemetry.recordSendOutcome.mock.calls.map(([outcome]) => outcome)).toEqual([
    { outcome: 'attempted', messageType, duration: 0 },
    { outcome: 'rejected', messageType, duration: expect.any(Number), cause: 'SLOW_MODE_ERROR' },
  ]);
});

it.each(['sendMessage', 'sendReply'])('separates %s API acceptance from confirmation under the explicit composer parent', async (action) => {
  captureSendTraces();
  const parent = window.__KT_TRACER__.startSpan('chat.input.send_message');
  const sendContext = { parentSpan: parent };
  const request = deferred();
  window.app.kick[action].mockReturnValueOnce(request.promise);
  const metadata = { original_message: { id: 'original', content: 'source' } };
  const sending = action === 'sendMessage'
    ? useChatStore.getState().sendMessage(42, 'private content', sendContext)
    : useChatStore.getState().sendReply(42, 'private content', metadata, sendContext);
  const pending = useChatStore.getState().messages[42][0];
  expect(window.app.telemetry.recordSendOutcome.mock.calls.map(([event]) => event.outcome)).toEqual(['attempted']);
  request.resolve({ status: 200 });
  expect(await sending).toBe(true);
  expect(window.app.telemetry.recordSendOutcome.mock.calls.map(([event]) => event.outcome)).toEqual(['attempted', 'api_accepted']);
  useChatStore.getState().addMessage(42, {
    id: 'server-id', type: pending.type, content: pending.content, sender: pending.sender,
  });
  expect(window.app.telemetry.recordSendOutcome.mock.calls.map(([event]) => event.outcome)).toEqual(['attempted', 'api_accepted', 'confirmed']);
  parent.end();
  await flushSendTraces();
  const spans = spanExporter.getFinishedSpans();
  const operation = spans.find(span => span.name === (action === 'sendMessage' ? 'chat.send' : 'chat.reply'));
  const api = spans.find(span => span.name === `chat.api.${action}`);
  expect(operation.parentSpanContext.spanId).toBe(parent.spanContext().spanId);
  expect(api.parentSpanContext.spanId).toBe(operation.spanContext().spanId);
  for (const span of spans) {
    expect(span.spanContext().traceId).toBe(parent.spanContext().traceId);
    expect(span.attributes['message.operation_id']).toBe(sendContext.operationId);
    expect(span.attributes['message.operation_id']).toEqual(expect.any(String));
    expect(span.attributes['message.temp_id']).toBe(pending.tempId);
  }
  for (const [event] of window.app.telemetry.recordSendOutcome.mock.calls) {
    expect(event).toEqual({
      outcome: expect.stringMatching(/^(attempted|api_accepted|confirmed)$/),
      messageType: action === 'sendMessage' ? 'regular' : 'reply',
      duration: expect.any(Number),
    });
    expect(Number.isFinite(event.duration)).toBe(true);
    expect(event.duration).toBeGreaterThanOrEqual(0);
  }
});

it.each(['sendMessage', 'sendReply'])('does not let duplicate %s echo publication confirm another identical pending action', async (action) => {
  const first = deferred();
  const second = deferred();
  window.app.kick[action].mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const a = useChatStore.getState()[action](42, 'identical');
  const b = useChatStore.getState()[action](42, 'identical');
  const [firstRow, secondRow] = useChatStore.getState().messages[42];
  const echo = { id: 'server-id', type: firstRow.type, content: firstRow.content, sender: firstRow.sender };
  useChatStore.getState().addMessage(42, echo);
  useChatStore.getState().addMessage(42, echo);
  const rows = useChatStore.getState().messages[42];
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({ id: 'server-id', state: 'confirmed' });
  expect(rows[1]).toMatchObject({ tempId: secondRow.tempId, state: 'optimistic' });
  first.resolve({ status: 200 });
  second.reject({ code: 'SLOW_MODE_ERROR' });
  expect(await a).toBe(true);
  expect(await b).toBe(false);
  expect(window.app.telemetry.recordSendOutcome.mock.calls.map(([event]) => event.outcome)).toEqual([
    'attempted', 'attempted', 'confirmed', 'api_accepted', 'rejected',
  ]);
});

it.each(['sendMessage', 'sendReply'])('keeps local-auth %s correlated and returns its fixed cause to the composer without an optimistic row', async (action) => {
  captureSendTraces();
  useChatStore.setState({ currentUser: null });
  window.app.kick.getSelfInfo = vi.fn().mockResolvedValue(null);
  const parent = window.__KT_TRACER__.startSpan('chat.input.send_message');
  const sendContext = { parentSpan: parent };
  const result = action === 'sendMessage'
    ? await useChatStore.getState().sendMessage(42, 'secret draft', sendContext)
    : await useChatStore.getState().sendReply(42, 'secret draft', {}, sendContext);
  expect(result).toBe(false);
  expect(sendContext.failure).toEqual({ code: 'Unauthorized', reason: 'You must login to chat.' });
  expect(sendContext.operationId).toEqual(expect.any(String));
  expect(sendContext).not.toHaveProperty('tempId');
  expect(window.app.kick[action]).not.toHaveBeenCalled();
  parent.end();
  await flushSendTraces();
  const operation = spanExporter.getFinishedSpans().find(span => span.name === (action === 'sendMessage' ? 'chat.send' : 'chat.reply'));
  expect(operation.parentSpanContext.spanId).toBe(parent.spanContext().spanId);
  expect(operation.attributes['message.operation_id']).toBe(sendContext.operationId);
  expect(operation.attributes).not.toHaveProperty('message.temp_id');
  expect(operation.attributes).not.toHaveProperty('http.response.status_code');
  expect(window.app.telemetry.recordSendOutcome.mock.calls.map(([event]) => event.outcome)).toEqual(['attempted', 'rejected']);
  expect(window.app.telemetry.recordSendOutcome).toHaveBeenLastCalledWith({
    outcome: 'rejected', messageType: action === 'sendMessage' ? 'regular' : 'reply',
    duration: expect.any(Number), cause: 'Unauthorized',
  });
});

it.each(['sendMessage', 'sendReply'])('records %s uncertainty once and only confirms a timed-out row through the existing explicit path', async (action) => {
  captureSendTraces();
  window.app.kick[action].mockResolvedValue({ status: 200 });
  expect(await useChatStore.getState()[action](42, 'late echo')).toBe(true);
  const pending = useChatStore.getState().messages[42][0];
  await vi.advanceTimersByTimeAsync(60000);
  expect(window.app.telemetry.recordSendOutcome.mock.calls.map(([event]) => event.outcome)).toEqual([
    'attempted', 'api_accepted', 'unconfirmed',
  ]);
  expect(window.app.telemetry.recordSendOutcome).toHaveBeenLastCalledWith({
    outcome: 'unconfirmed', messageType: action === 'sendMessage' ? 'regular' : 'reply',
    duration: 30, cause: 'SEND_TIMEOUT',
  });
  const echo = { id: 'late-server-id', type: pending.type, content: pending.content, sender: pending.sender };
  useChatStore.getState().addMessage(42, echo);
  useChatStore.getState().addMessage(42, echo);
  expect(useChatStore.getState().messages[42]).toHaveLength(2);
  expect(useChatStore.getState().messages[42].find(row => row.tempId === pending.tempId).state).toBe('failed');
  expect(window.app.telemetry.recordSendOutcome).toHaveBeenCalledTimes(3);
  useChatStore.getState().confirmMessage(42, pending.tempId, { ...pending, id: 'explicit-id' });
  useChatStore.getState().confirmMessage(42, pending.tempId, { ...pending, id: 'explicit-id' });
  expect(window.app.telemetry.recordSendOutcome.mock.calls.map(([event]) => event.outcome)).toEqual([
    'attempted', 'api_accepted', 'unconfirmed', 'confirmed',
  ]);
  await flushSendTraces();
  const spans = spanExporter.getFinishedSpans();
  const operationName = action === 'sendMessage' ? 'chat.send' : 'chat.reply';
  const operation = spans.find(span => span.name === operationName);
  const confirmations = spans.filter(span => span.name === `${operationName}.confirmed`);
  expect(confirmations).toHaveLength(1);
  expect(confirmations[0].parentSpanContext.spanId).toBe(operation.spanContext().spanId);
  expect(confirmations[0].attributes).toMatchObject({
    'message.operation_id': operation.attributes['message.operation_id'],
    'message.temp_id': pending.tempId, 'message.delivery': 'confirmed',
  });
});

it.each(['sendMessage', 'sendReply'].flatMap(action =>
  ['removal', 'eviction', 'room removal', 'cleanup'].map(loss => [action, loss]),
))('releases the %s confirmation timer after %s without inventing an outcome or retry', async (action, loss) => {
  useChatStore.setState({ chatHistorySettings: { chatHistoryLength: 1 }, isChatroomPaused: {} });
  const timersBefore = vi.getTimerCount();
  window.app.kick[action].mockResolvedValue({ status: 200 });
  expect(await useChatStore.getState()[action](42, 'removed pending')).toBe(true);
  const pending = useChatStore.getState().messages[42][0];
  expect(vi.getTimerCount()).toBe(timersBefore + 1);
  if (loss === 'removal') {
    useChatStore.getState().removeOptimisticMessage(42, pending.tempId);
  } else if (loss === 'eviction') {
    useChatStore.getState().addMessage(42, {
      id: 'newer', type: 'message', content: 'different', sender: { id: 10 },
      created_at: new Date(Date.now() + 1).toISOString(),
    });
  } else if (loss === 'room removal') {
    useChatStore.getState().removeChatroom(42);
  } else {
    useChatStore.getState().cleanupConnections();
  }
  expect(vi.getTimerCount()).toBe(timersBefore);
  await vi.advanceTimersByTimeAsync(60000);
  expect(window.app.telemetry.recordSendOutcome.mock.calls.map(([event]) => event.outcome)).toEqual(['attempted', 'api_accepted']);
  expect(window.app.kick[action]).toHaveBeenCalledTimes(1);
});

it.each([
  [{ sendError: { code: 'SLOW_MODE_ERROR' } }, /slow mode/i],
  [{ sendError: { code: 'CHAT_RATE_LIMIT_ERROR' } }, /rate limit/i],
  [{ sendError: { code: 'Unauthorized' } }, /login/i],
  [{ data: { status: { code: 401 } } }, /login/i],
])('explains recognized bridge/API failures safely: %j', async (response, reason) => {
  window.app.kick.sendMessage.mockResolvedValue(response);
  expect(await useChatStore.getState().sendMessage(42, 'kept content')).toBe(false);
  expect(useChatStore.getState().messages[42][0]).toMatchObject({
    state: 'failed', content: 'kept content', failureReason: expect.stringMatching(reason),
  });
});

it.each([
  new Error('<script>secret credential</script>'),
  { code: '__proto__', message: 'Bearer secret credential' },
  { code: 'constructor', response: { data: { status: { message: '<img onerror=secret>' } } } },
  { code: { toString: () => 'SLOW_MODE_ERROR' } },
])('uses fixed fallback instead of exposing unknown/hostile errors: %j', async (error) => {
  window.app.kick.sendMessage.mockRejectedValue(error);
  expect(await useChatStore.getState().sendMessage(42, 'safe content')).toBe(false);
  const row = useChatStore.getState().messages[42][0];
  expect(row.failureReason).toMatch(/error.*sending.*message/i);
  expect(row.failureReason).not.toMatch(/secret|script|onerror|Bearer/i);
  expect(typeof row.failureReason).toBe('string');
});

it.each(['sendMessage', 'sendReply'])('keeps %s delivery uncertainty visible when API succeeds but echo never arrives', async (action) => {
  window.app.kick[action].mockResolvedValue({ status: 200 });
  expect(await useChatStore.getState()[action](42, 'unconfirmed')).toBe(true);
  await vi.advanceTimersByTimeAsync(30000);
  const row = useChatStore.getState().messages[42][0];
  expect(row.state).toBe('failed');
  expect(row.failureReason).toMatch(/could not be confirmed/i);
  expect(row.failureReason).toMatch(/may have been sent/i);
  expect(window.app.kick[action]).toHaveBeenCalledTimes(1);
});

it('clears a timeout reason on confirmation and ignores the late request failure', async () => {
  const request = deferred();
  window.app.kick.sendMessage.mockReturnValue(request.promise);
  const send = useChatStore.getState().sendMessage(42, 'uncertain');
  const pending = useChatStore.getState().messages[42][0];
  await vi.advanceTimersByTimeAsync(30000);
  expect(useChatStore.getState().messages[42][0].failureReason).toMatch(/may have been sent/i);
  useChatStore.getState().confirmMessage(42, pending.tempId, { ...pending, id: 'confirmed' });
  request.reject({ code: 'SLOW_MODE_ERROR' });
  expect(await send).toBe(false);
  const row = useChatStore.getState().messages[42][0];
  expect(row.state).toBe('confirmed');
  expect(row).not.toHaveProperty('failureReason');
});

it('does not overwrite a websocket-confirmed row with a later failure', async () => {
  const request = deferred();
  window.app.kick.sendMessage.mockReturnValue(request.promise);
  const send = useChatStore.getState().sendMessage(42, 'echoed');
  useChatStore.getState().addMessage(42, {
    id: 'server-id', type: 'message', content: 'echoed', sender: { id: 9 },
  });
  request.reject({ code: 'CHAT_RATE_LIMIT_ERROR' });
  expect(await send).toBe(false);
  await vi.advanceTimersByTimeAsync(30000);
  expect(useChatStore.getState().messages[42]).toHaveLength(1);
  expect(useChatStore.getState().messages[42][0]).toMatchObject({ id: 'server-id', state: 'confirmed' });
  expect(useChatStore.getState().messages[42][0]).not.toHaveProperty('failureReason');
});

it.each(['sendMessage', 'sendReply'])('manually retries %s without stale reason, preserving content and reply metadata', async (action) => {
  captureSendTraces();
  const metadata = { original_message: { id: 'source-id', content: 'original' } };
  window.app.kick[action].mockRejectedValueOnce({ code: 'SLOW_MODE_ERROR' });
  expect(await useChatStore.getState()[action](42, 'retry me', metadata)).toBe(false);
  const failed = useChatStore.getState().messages[42][0];
  expect(failed.failureReason).toMatch(/slow mode/i);
  const retry = deferred();
  window.app.kick[action].mockReturnValueOnce(retry.promise);
  const retried = useChatStore.getState().retryFailedMessage(42, failed.tempId);
  const rows = useChatStore.getState().messages[42];
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ content: 'retry me', state: 'optimistic' });
  expect(rows[0].tempId).not.toBe(failed.tempId);
  expect(rows[0]).not.toHaveProperty('failureReason');
  if (action === 'sendReply') {
    expect(rows[0].metadata).toEqual(metadata);
    expect(window.app.kick.sendReply).toHaveBeenLastCalledWith(42, 'retry me', metadata);
  }
  retry.resolve({ status: 200 });
  expect(await retried).toBe(true);
  const current = useChatStore.getState().messages[42][0];
  useChatStore.getState().addMessage(42, {
    id: 'retry-confirmed', type: current.type, content: current.content, sender: current.sender,
  });
  await flushSendTraces();
  expect(window.app.telemetry.recordSendOutcome.mock.calls.map(([event]) => event.outcome)).toEqual([
    'attempted', 'rejected', 'attempted', 'api_accepted', 'confirmed',
  ]);
  const operations = spanExporter.getFinishedSpans().filter(span => span.name === (action === 'sendMessage' ? 'chat.send' : 'chat.reply'));
  expect(operations).toHaveLength(2);
  expect(operations[0].attributes['message.operation_id']).not.toBe(operations[1].attributes['message.operation_id']);
  expect(operations[0].attributes['message.temp_id']).not.toBe(operations[1].attributes['message.temp_id']);
});

it.each(['ECONNABORTED', 'ETIMEDOUT', 'SEND_TIMEOUT'])('describes uncertain delivery for %s without exposing transport details', async (code) => {
  window.app.kick.sendMessage.mockRejectedValue({ code, message: 'secret endpoint and credentials' });
  expect(await useChatStore.getState().sendMessage(42, 'maybe sent')).toBe(false);
  const row = useChatStore.getState().messages[42][0];
  expect(row.failureReason).toMatch(/may have been sent/i);
  expect(row.failureReason).not.toMatch(/secret|credentials|endpoint/i);
});

it('renders the actual failed store row reason beside its intact content and manual actions', async () => {
  const { default: RegularMessage } = await import('../src/renderer/src/components/Messages/RegularMessage.jsx');
  window.app.kick.sendMessage.mockResolvedValue({ sendError: { code: 'SLOW_MODE_ERROR' } });
  await useChatStore.getState().sendMessage(42, 'visible content');
  const message = useChatStore.getState().messages[42][0];
  const html = renderToStaticMarkup(createElement(RegularMessage, {
    message, chatroomId: 42, settings: { general: { timestampFormat: 'disabled' } },
  }));
  expect(html).toContain('visible content');
  expect(html).toContain(message.failureReason);
  expect(html).toContain('role="status"');
  expect(html).toContain('aria-label="Retry sending message"');
  expect(html).toContain('aria-label="Copy message"');
});

it.each([undefined, '', '   ', {}])('renders helpful legacy fallback for invalid reason %j', async (failureReason) => {
  const { default: RegularMessage } = await import('../src/renderer/src/components/Messages/RegularMessage.jsx');
  const html = renderToStaticMarkup(createElement(RegularMessage, {
    message: {
      id: 'legacy', tempId: 'legacy', type: 'message', content: 'kept',
      sender: { id: 9, username: 'sender' }, isOptimistic: true, state: 'failed', failureReason,
    },
    settings: { general: { timestampFormat: 'disabled' } },
  }));
  expect(html).toMatch(/could not be sent/i);
  expect(html).toContain('aria-label="Retry sending message"');
  expect(html).toContain('aria-label="Copy message"');
});

it('hides stale failure reasons on confirmed rows', async () => {
  const { default: RegularMessage } = await import('../src/renderer/src/components/Messages/RegularMessage.jsx');
  const message = {
    id: 'row', tempId: 'temp', type: 'message', content: 'kept',
    sender: { id: 9, username: 'sender' }, isOptimistic: true, state: 'failed',
    failureReason: 'Previous send failure.',
  };
  const render = row => renderToStaticMarkup(createElement(RegularMessage, {
    message: row, settings: { general: { timestampFormat: 'disabled' } },
  }));
  expect(render({ ...message, state: 'confirmed', isOptimistic: false })).not.toContain('Previous send failure.');
});

it.each(['sendMessage', 'sendReply'])('exports a safe mapped %s failure under its actual operation span', async (action) => {
  captureSendTraces();
  window.app.kick[action].mockResolvedValue({
    sendError: { code: 'SLOW_MODE_ERROR', status: 422, message: 'Bearer secret credential' },
  });

  expect(await useChatStore.getState()[action](42, 'private content')).toBe(false);
  await flushSendTraces();
  const spans = spanExporter.getFinishedSpans();
  const operation = spans.find(span => span.name === (action === 'sendMessage' ? 'chat.send' : 'chat.reply'));
  const api = spans.find(span => span.name === `chat.api.${action}`);
  const row = useChatStore.getState().messages[42][0];

  expect(operation.status).toEqual({ code: 2, message: row.failureReason });
  expect(api.status).toEqual(operation.status);
  expect(operation.attributes['error.type']).toBe('SLOW_MODE_ERROR');
  expect(api.attributes['error.type']).toBe('SLOW_MODE_ERROR');
  expect(api.attributes['http.response.status_code']).toBe(422);
  expect(api.parentSpanContext.spanId).toBe(operation.spanContext().spanId);
  expect(api.spanContext().traceId).toBe(operation.spanContext().traceId);
  expect(operation.attributes['message.temp_id']).toBe(row.tempId);
  expect(api.attributes['message.temp_id']).toBe(row.tempId);
  expect(JSON.stringify(spans.map(span => ({ status: span.status, attributes: span.attributes, events: span.events })))).not.toMatch(/private content|Bearer|secret credential/);
});

it.each(['sendMessage', 'sendReply'].flatMap(action => [
  [action, { sendError: { code: 'CHAT_RATE_LIMIT_ERROR' } }, 'CHAT_RATE_LIMIT_ERROR', undefined],
  [action, { sendError: { code: 'Unauthorized' } }, 'Unauthorized', undefined],
  [action, { data: { status: { code: 401 } } }, 'Unauthorized', undefined],
  [action, { status: 200, data: { status: { code: 401 } } }, 'Unauthorized', 200],
  [action, { sendError: { code: 'UNKNOWN_SEND_ERROR', status: 503 } }, 'UNKNOWN_SEND_ERROR', 503],
  [action, { sendError: { code: 'constructor', status: '401', message: 'secret credential' } }, 'UNKNOWN_SEND_ERROR', undefined],
  [action, { sendError: { code: 'ETIMEDOUT' } }, 'SEND_TIMEOUT', undefined],
]))('exports interpretable %s failure %j without inventing an HTTP status', async (action, response, code, status) => {
  captureSendTraces();
  window.app.kick[action].mockResolvedValue(response);

  expect(await useChatStore.getState()[action](42, 'kept content')).toBe(false);
  await flushSendTraces();
  const spans = spanExporter.getFinishedSpans();
  expect(spans).toHaveLength(2);
  const operation = spans.find(span => span.name === (action === 'sendMessage' ? 'chat.send' : 'chat.reply'));
  const api = spans.find(span => span.name === `chat.api.${action}`);
  for (const span of spans) {
    expect(span.status).toEqual({ code: 2, message: useChatStore.getState().messages[42][0].failureReason });
    expect(span.attributes['error.type']).toBe(code);
    expect(span.attributes['http.response.status_code']).toBe(status);
    if (code === 'SEND_TIMEOUT') expect(span.attributes['message.delivery']).toBe('unconfirmed');
  }
  expect(api.parentSpanContext.spanId).toBe(operation.spanContext().spanId);
  expect(api.spanContext().traceId).toBe(operation.spanContext().traceId);
});

it.each(['sendMessage', 'sendReply'])('exports a %s confirmation timeout linked to its already-ended operation', async (action) => {
  captureSendTraces();
  window.app.kick[action].mockResolvedValue({ status: 200 });
  expect(await useChatStore.getState()[action](42, 'unconfirmed')).toBe(true);
  await flushSendTraces();
  expect(spanExporter.getFinishedSpans()).toHaveLength(2);

  await vi.advanceTimersByTimeAsync(30000);
  await flushSendTraces();
  const spans = spanExporter.getFinishedSpans();
  const operationName = action === 'sendMessage' ? 'chat.send' : 'chat.reply';
  const operation = spans.find(span => span.name === operationName);
  const timeout = spans.find(span => span.name === `${operationName}.confirmation_timeout`);
  const row = useChatStore.getState().messages[42][0];
  expect(operation.status.code).toBe(0);
  expect(timeout.status).toEqual({ code: 2, message: row.failureReason });
  expect(timeout.attributes).toMatchObject({
    'error.type': 'SEND_TIMEOUT',
    'message.delivery': 'unconfirmed',
    'message.temp_id': row.tempId,
  });
  expect(timeout.attributes).not.toHaveProperty('http.response.status_code');
  expect(timeout.parentSpanContext.spanId).toBe(operation.spanContext().spanId);
  expect(timeout.spanContext().traceId).toBe(operation.spanContext().traceId);

  await vi.advanceTimersByTimeAsync(30000);
  await flushSendTraces();
  expect(spanExporter.getFinishedSpans()).toHaveLength(3);
  expect(window.app.kick[action]).toHaveBeenCalledTimes(1);
});

it.each(['sendMessage', 'sendReply'].flatMap(action => ['explicit', 'websocket'].map(confirmation => [action, confirmation])))(
  'does not export stale %s delivery failure after %s confirmation',
  async (action, confirmation) => {
    captureSendTraces();
    const request = deferred();
    window.app.kick[action].mockReturnValue(request.promise);
    const sending = useChatStore.getState()[action](42, 'confirmed');
    const pending = useChatStore.getState().messages[42][0];
    if (confirmation === 'explicit') {
      useChatStore.getState().confirmMessage(42, pending.tempId, { ...pending, id: 'server-id' });
    } else {
      useChatStore.getState().addMessage(42, {
        id: 'server-id', type: pending.type, content: pending.content, sender: pending.sender,
      });
    }
    request.reject({ code: 'SLOW_MODE_ERROR', message: 'secret credential' });
    expect(await sending).toBe(false);
    await vi.advanceTimersByTimeAsync(30000);
    await flushSendTraces();

    const spans = spanExporter.getFinishedSpans();
    expect(spans).toHaveLength(3);
    const operation = spans.find(span => span.name === (action === 'sendMessage' ? 'chat.send' : 'chat.reply'));
    const api = spans.find(span => span.name === `chat.api.${action}`);
    expect(operation.status.code).toBe(0);
    expect(operation.attributes).not.toHaveProperty('error.type');
    expect(operation.events).toContainEqual(expect.objectContaining({
      name: 'send.failure_ignored',
      attributes: { 'error.type': 'SLOW_MODE_ERROR', 'message.temp_id': pending.tempId },
    }));
    // The HTTP request did fail, but the delivery operation must not report an unconfirmed failure.
    expect(api.status.code).toBe(2);
    expect(api.attributes['error.type']).toBe('SLOW_MODE_ERROR');
    expect(useChatStore.getState().messages[42][0].state).toBe('confirmed');
    expect(window.app.telemetry.recordError).not.toHaveBeenCalled();
    expect(window.app.telemetry.recordSendOutcome.mock.calls.map(([event]) => event.outcome)).toEqual([
      'attempted', 'confirmed', 'rejected',
    ]);
  },
);

it.each(['sendMessage', 'sendReply'])('ends locally unauthenticated %s tracing without inventing a request or HTTP 401', async (action) => {
  captureSendTraces();
  useChatStore.setState({ currentUser: null });
  window.app.kick.getSelfInfo = vi.fn().mockResolvedValue(null);

  expect(await useChatStore.getState()[action](42, 'not sent')).toBe(false);
  await flushSendTraces();
  const spans = spanExporter.getFinishedSpans();
  expect(spans).toHaveLength(1);
  expect(spans[0].status).toEqual({ code: 2, message: 'You must login to chat.' });
  expect(spans[0].attributes['error.type']).toBe('Unauthorized');
  expect(spans[0].attributes).not.toHaveProperty('http.response.status_code');
  expect(window.app.kick[action]).not.toHaveBeenCalled();
});

it.each(['sendMessage', 'sendReply'])('keeps concurrent %s API failures in their own real SDK traces', async (action) => {
  captureSendTraces();
  const first = deferred();
  const second = deferred();
  window.app.kick[action].mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const a = useChatStore.getState()[action](42, 'duplicate');
  const b = useChatStore.getState()[action](42, 'duplicate');
  second.reject({ code: 'CHAT_RATE_LIMIT_ERROR' });
  first.reject({ code: 'SLOW_MODE_ERROR' });
  await Promise.all([a, b]);
  await flushSendTraces();

  const spans = spanExporter.getFinishedSpans();
  const operations = spans.filter(span => span.name === (action === 'sendMessage' ? 'chat.send' : 'chat.reply'));
  expect(operations).toHaveLength(2);
  expect(operations[0].spanContext().traceId).not.toBe(operations[1].spanContext().traceId);
  expect(new Set(operations.map(span => span.attributes['message.operation_id'])).size).toBe(2);
  for (const api of spans.filter(span => span.name === `chat.api.${action}`)) {
    const operation = operations.find(span => span.spanContext().spanId === api.parentSpanContext.spanId);
    expect(operation.attributes['message.temp_id']).toBe(api.attributes['message.temp_id']);
    expect(operation.attributes['message.operation_id']).toBe(api.attributes['message.operation_id']);
    expect(operation.attributes['error.type']).toBe(api.attributes['error.type']);
    expect(operation.spanContext().traceId).toBe(api.spanContext().traceId);
  }
  expect(window.app.telemetry.recordSendOutcome.mock.calls.map(([event]) => [event.outcome, event.cause])).toEqual([
    ['attempted', undefined], ['attempted', undefined],
    ['rejected', 'CHAT_RATE_LIMIT_ERROR'], ['rejected', 'SLOW_MODE_ERROR'],
  ]);
});

it.each(['sendMessage', 'sendReply'].flatMap(action => ['eviction', 'room removal'].map(loss => [action, loss])))(
  'keeps %s operation failure diagnostics when the pending row is lost to %s',
  async (action, loss) => {
    captureSendTraces();
    useChatStore.setState({ chatHistorySettings: { chatHistoryLength: 1 }, isChatroomPaused: {} });
    const request = deferred();
    window.app.kick[action].mockReturnValueOnce(request.promise);
    const sending = useChatStore.getState()[action](42, 'pending body');
    const pending = useChatStore.getState().messages[42][0];
    if (loss === 'eviction') {
      useChatStore.getState().addMessage(42, {
        id: 'newer', type: 'message', content: 'other body', sender: { id: 10 },
        created_at: new Date(Date.now() + 1).toISOString(),
      });
    } else {
      useChatStore.getState().removeChatroom(42);
    }
    expect((useChatStore.getState().messages[42] || []).some(row => row.tempId === pending.tempId)).toBe(false);

    request.reject({ code: 'SLOW_MODE_ERROR' });
    expect(await sending).toBe(false);
    await flushSendTraces();

    const operation = spanExporter.getFinishedSpans()
      .find(span => span.name === (action === 'sendMessage' ? 'chat.send' : 'chat.reply'));
    expect(operation.status.code).toBe(2);
    expect(operation.attributes['error.type']).toBe('SLOW_MODE_ERROR');
    expect(window.app.telemetry.recordError).toHaveBeenCalledTimes(1);
    expect((useChatStore.getState().messages[42] || []).some(row => row.tempId === pending.tempId)).toBe(false);
  },
);
