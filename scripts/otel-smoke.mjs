import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import WebSocket from 'ws';

const args = new Set(process.argv.slice(2));
if ([...args].some(arg => !['--local', '--main'].includes(arg))) {
  throw new Error('Usage: node scripts/otel-smoke.mjs [--local] [--main]');
}
const local = args.has('--local');
const exec = promisify(execFile);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function connect(port, match) {
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
  const target = targets.find(match);
  assert(target?.webSocketDebuggerUrl, `No debugger target on port ${port}`);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  let id = 0;
  const pending = new Map();
  ws.on('message', raw => {
    const message = JSON.parse(String(raw));
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timeout);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  return {
    async evaluate(expression) {
      const result = await new Promise((resolve, reject) => {
        const requestId = ++id;
        const timeout = setTimeout(() => {
          pending.delete(requestId);
          reject(new Error('Debugger request timed out'));
        }, 30000);
        pending.set(requestId, { resolve, reject, timeout });
        ws.send(JSON.stringify({ id: requestId, method: 'Runtime.evaluate', params: {
          expression, awaitPromise: true, returnByValue: true, includeCommandLineAPI: true,
        } }));
      });
      assert(!result.exceptionDetails, result.exceptionDetails?.text || 'Runtime evaluation failed');
      return result.result.value;
    },
    close() { ws.close(); },
  };
}

const probe = apiExpression => `(async () => {
  const { trace, context } = ${apiExpression};
  const tracer = trace.getTracer('kicktalk-diagnostics');
  const parent = tracer.startSpan('otel_diag_parent');
  const child = tracer.startSpan('otel_diag_child', { kind: 2 }, trace.setSpan(context.active(), parent));
  const ids = { traceId: parent.spanContext().traceId, parentId: parent.spanContext().spanId, childId: child.spanContext().spanId };
  await new Promise(resolve => setTimeout(resolve, 250));
  child.addEvent('diag_delay_complete', { 'diag.delay_ms': 250 });
  child.recordException(new Error('Controlled OTEL diagnostics exception'));
  child.setStatus({ code: 2, message: 'Controlled diagnostics failure' });
  child.end();
  parent.end();
  ${apiExpression.startsWith('window.') ? 'await window.__KT_OTEL_PROVIDER__.forceFlush();' : ''}
  return ids;
})()`;

function spanList(data) {
  return (data.batches || data.resourceSpans || []).flatMap(batch =>
    (batch.scopeSpans || batch.instrumentationLibrarySpans || []).flatMap(scope =>
      (scope.spans || []).map(span => ({ ...span, resource: batch.resource, scope: scope.scope || scope.instrumentationLibrary }))));
}

async function readTrace(renderer, traceId) {
  if (!local) {
    const response = await renderer.evaluate(`window.telemetry.readTrace(${JSON.stringify(traceId)})`);
    return response?.success ? response.data : null;
  }
  try {
    const { stdout } = await exec('podman', ['exec', 'kicktalk-lgtm', 'curl', '-fsS', `http://127.0.0.1:3200/api/traces/${traceId}`], { maxBuffer: 4 * 1024 * 1024 });
    return JSON.parse(stdout);
  } catch { return null; }
}

async function verify(renderer, ids, service) {
  let spans = [];
  for (let attempt = 0; attempt < 15; attempt++) {
    const data = await readTrace(renderer, ids.traceId);
    spans = data ? spanList(data) : [];
    if (spans.some(span => span.name === 'otel_diag_parent') && spans.some(span => span.name === 'otel_diag_child')) break;
    await delay(1000);
  }
  const parents = spans.filter(span => span.name === 'otel_diag_parent');
  const children = spans.filter(span => span.name === 'otel_diag_child');
  assert.equal(parents.length, 1, `${service}: expected one parent span`);
  assert.equal(children.length, 1, `${service}: expected one child span`);
  const child = children[0];
  const parent = parents[0];
  const parentBytes = Buffer.from(ids.parentId, 'hex').toString('base64');
  assert([ids.parentId, parentBytes].includes(child.parentSpanId), `${service}: missing parent linkage`);
  const durationMs = Number(BigInt(child.endTimeUnixNano) - BigInt(child.startTimeUnixNano)) / 1e6;
  assert(durationMs >= 200 && durationMs < 5000, `${service}: unexpected duration ${durationMs}ms`);
  assert([3, 'SPAN_KIND_CLIENT'].includes(child.kind), `${service}: wrong span kind`);
  assert([2, 'STATUS_CODE_ERROR'].includes(child.status?.code), `${service}: missing error status`);
  assert(child.events.some(event => event.name === 'diag_delay_complete'), `${service}: missing timed event`);
  assert(child.events.some(event => event.name === 'exception'), `${service}: missing exception event`);
  const attrs = Object.fromEntries((child.resource?.attributes || []).map(kv => [kv.key, kv.value?.stringValue]));
  assert.equal(attrs['service.name'], service);
  assert(attrs['service.version'], `${service}: missing app version`);
  assert.equal(child.scope?.name, 'kicktalk-diagnostics');
  console.log(JSON.stringify({ destination: local ? 'local LGTM' : 'Grafana Cloud', service, traceId: ids.traceId,
    durationMs, events: child.events.map(event => event.name), version: attrs['service.version'],
    parentDurationMs: Number(BigInt(parent.endTimeUnixNano) - BigInt(parent.startTimeUnixNano)) / 1e6 }, null, 2));
}

let renderer;
let main;
try {
  renderer = await connect(9222, target => target.type === 'page' && target.url?.endsWith('/renderer/index.html'));
  const state = await renderer.evaluate('({ ready: !!window.__KT_TRACER__ && !!window.__KT_TRACE_API__?.context })');
  assert(state.ready, 'Renderer telemetry is not initialized; enable telemetry in Settings and wait for preload');
  const rendererIds = await renderer.evaluate(probe('window.__KT_TRACE_API__'));
  await verify(renderer, rendererIds, 'kicktalk-renderer');
  if (args.has('--main')) {
    main = await connect(9230, target => !!target.webSocketDebuggerUrl);
    const mainIds = await main.evaluate(probe("require('@opentelemetry/api')"));
    await verify(renderer, mainIds, 'kicktalk');
  }
  console.log('OTEL smoke passed. Controlled exception spans above are intentional.');
} finally {
  renderer?.close();
  main?.close();
}
