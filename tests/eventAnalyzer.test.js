// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const KickEventAnalyzer = require('../scripts/event-collection/event-analyzer.js');
const { describePayload } = require('../scripts/event-collection/event-collector.js');
const directories = [];

async function analyze(entries) {
  const directory = await mkdtemp(join(tmpdir(), 'kick-event-analyzer-'));
  directories.push(directory);
  const logFile = join(directory, 'events.jsonl');
  await writeFile(logFile, entries.map((entry) => JSON.stringify({
    channel: 'chatrooms.101.v2',
    ...entry,
  })).join('\n') + '\n');
  const analyzer = new KickEventAnalyzer(logFile);
  await analyzer.loadEvents();
  analyzer.analyzeEvents();
  return analyzer.generateDefinitions();
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('collected event schema analysis', () => {
  it('infers redacted scalar types recursively without recovering scalar values', async () => {
    const data = describePayload({
      count: 42,
      enabled: true,
      label: 'synthetic label',
      absent: null,
      numbers: [7, 8],
      flags: [false],
      labels: ['synthetic item'],
      empty: [],
      nested: { count: 9, enabled: false, absent: null },
      records: [{ count: 3, enabled: true, label: 'synthetic record' }],
      type: 'message',
    });
    const result = await analyze([{ event: 'SyntheticSchema', redacted: true, data }]);
    expect(Object.values(result.definitions)[0].structure).toEqual({
      count: 'number',
      enabled: 'boolean',
      label: 'string',
      absent: null,
      numbers: ['number'],
      flags: ['boolean'],
      labels: ['string'],
      empty: [],
      nested: { count: 'number', enabled: 'boolean', absent: null },
      records: [{ count: 'number', enabled: 'boolean', label: 'string' }],
      type: 'string',
    });
  });

  it('preserves collector depth limits and the analyzer recursion limit', async () => {
    const result = await analyze([{
      event: 'SyntheticDepth',
      redacted: true,
      data: {
        limited: describePayload({ count: 1 }, 9),
        nested: describePayload({ a: { b: { c: { count: 1 } } } }),
        absent: describePayload(null),
      },
    }]);
    expect(result.definitions.SyntheticDepth.structure).toEqual({
      limited: '...',
      nested: { a: { b: { c: '...' } } },
      absent: null,
    });
  });

  it.each([undefined, false, 'true'])('keeps historical marker literals as strings with redacted=%s', async (redacted) => {
    const result = await analyze([{
      event: 'SyntheticHistory',
      redacted,
      data: {
        number: '[number]',
        boolean: '[boolean]',
        depth: '[depth_limit]',
        nested: { value: '[number]' },
        values: ['[boolean]'],
        count: 12,
        enabled: true,
        absent: null,
      },
    }]);
    expect(result.definitions.SyntheticHistory.structure).toEqual({
      number: 'string',
      boolean: 'string',
      depth: 'string',
      nested: { value: 'string' },
      values: ['string'],
      count: 'number',
      enabled: 'boolean',
      absent: null,
    });
  });

  it.each([true, false])('uses the first sample contract in mixed logs when redacted first=%s', async (redactedFirst) => {
    const historical = { event: 'SyntheticMixed', data: { value: '[number]' } };
    const redacted = { event: 'SyntheticMixed', redacted: true, data: describePayload({ value: 17 }) };
    const entries = redactedFirst ? [redacted, historical] : [historical, redacted];
    const result = await analyze(entries);
    expect(result.definitions.SyntheticMixed.structure).toEqual({ value: redactedFirst ? 'number' : 'string' });
    expect(result.definitions.SyntheticMixed.count).toBe(2);
  });

  it('recognizes only collector type markers in redacted scalar entries', async () => {
    const result = await analyze([{
      event: 'SyntheticMarkers',
      redacted: true,
      data: {
        missing: describePayload(undefined),
        integer: describePayload(1n),
        symbol: describePayload(Symbol('synthetic')),
        callback: describePayload(() => {}),
        unknown: '[not_a_type]',
        invalid: '[invalid_json]',
      },
    }]);
    expect(result.definitions.SyntheticMarkers.structure).toEqual({
      missing: 'undefined',
      integer: 'bigint',
      symbol: 'symbol',
      callback: 'function',
      unknown: 'string',
      invalid: 'string',
    });
  });
});
