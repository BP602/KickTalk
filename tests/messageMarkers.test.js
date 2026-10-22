// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { computeMarkerBuckets, markerFraction, MARKER_GEOMETRY } from '../src/renderer/src/utils/messageMarkers';

describe('markerFraction', () => {
  it('is 0 for empty and single-message lists', () => {
    expect(markerFraction(0, 0)).toBe(0);
    expect(markerFraction(0, 1)).toBe(0);
  });

  it('spans 0 to 1 across the list', () => {
    expect(markerFraction(0, 11)).toBe(0);
    expect(markerFraction(5, 11)).toBe(0.5);
    expect(markerFraction(10, 11)).toBe(1);
  });
});

describe('computeMarkerBuckets', () => {
  it('returns nothing for no markers', () => {
    expect(computeMarkerBuckets([], 100, 500)).toEqual([]);
    expect(computeMarkerBuckets([], 0, 500)).toEqual([]);
  });

  it('places a single marker at the top', () => {
    const buckets = computeMarkerBuckets([{ index: 0, kind: 'mention' }], 1, 500);
    expect(buckets).toEqual([{ row: 0, fraction: 0, kinds: ['mention'] }]);
  });

  it('places first and last markers within one pitch of the ends', () => {
    const buckets = computeMarkerBuckets(
      [
        { index: 0, kind: 'own' },
        { index: 99, kind: 'mention' },
      ],
      100,
      200,
    );
    expect(buckets[0]).toMatchObject({ row: 0, fraction: 0, kinds: ['own'] });
    expect(buckets[1]).toMatchObject({ row: 39, fraction: 195 / 197, kinds: ['mention'] });
  });

  it('keeps buckets ordered by position regardless of input order', () => {
    const buckets = computeMarkerBuckets(
      [
        { index: 90, kind: 'mention' },
        { index: 10, kind: 'mention' },
        { index: 50, kind: 'own' },
      ],
      101,
      1000,
    );
    expect(buckets.map((b) => b.fraction * 997)).toEqual([95, 495, 895]);
  });

  it('merges nearby ticks of the same kind but keeps both kinds', () => {
    // These entries share the same rendered footprint on a 10px rail.
    const buckets = computeMarkerBuckets(
      [
        { index: 0, kind: 'mention' },
        { index: 1, kind: 'mention' },
        { index: 1, kind: 'own' },
      ],
      1001,
      10,
    );
    expect(buckets).toEqual([{ row: 0, fraction: 0, kinds: ['mention', 'own'] }]);
  });

  it('merges nearby different kinds in the same footprint-sized grid row', () => {
    const buckets = computeMarkerBuckets(
      [{ index: 0, kind: 'own' }, { index: 1, kind: 'mention' }],
      101,
      103,
    );
    expect(buckets).toEqual([{ row: 0, fraction: 0, kinds: ['mention', 'own'] }]);
  });

  it('keeps neighboring grid rows separate rather than merging transitively', () => {
    const buckets = computeMarkerBuckets(
      [
        { index: 20, kind: 'mention' },
        { index: 8, kind: 'own' },
        { index: 4, kind: 'mention' },
        { index: 0, kind: 'own' },
      ],
      101,
      103,
    );
    expect(buckets).toEqual([
      { row: 0, fraction: 0, kinds: ['mention', 'own'] },
      { row: 1, fraction: 0.05, kinds: ['own'] },
      { row: 4, fraction: 0.2, kinds: ['mention'] },
    ]);
  });

  it.each([0.5, 1, 3, 4, 5])('keeps both categories on a tiny %ipx rail', (height) => {
    const buckets = computeMarkerBuckets(
      [{ index: 0, kind: 'own' }, { index: 100, kind: 'mention' }],
      101,
      height,
    );
    expect(buckets).toEqual([{ row: 0, fraction: 0, kinds: ['mention', 'own'] }]);
  });

  it('caps rendered buckets by the rail height divided by the footprint', () => {
    const entries = Array.from({ length: 1000 }, (_, i) => ({ index: i, kind: 'mention' }));
    const buckets = computeMarkerBuckets(entries, 1000, 25);
    expect(buckets.length).toBeLessThanOrEqual(Math.ceil(25 / 5));
    expect(buckets.every((b) => b.kinds.length === 1)).toBe(true);
  });

  it('recomputes positions when the list is trimmed (pure function of the list)', () => {
    const before = computeMarkerBuckets([{ index: 50, kind: 'mention' }], 101, 100);
    const after = computeMarkerBuckets([{ index: 25, kind: 'mention' }], 51, 100);
    expect(before[0].fraction).toBe(45 / 97);
    expect(after[0].fraction).toBe(before[0].fraction);
    const shifted = computeMarkerBuckets([{ index: 50, kind: 'mention' }], 51, 100);
    expect(shifted[0].fraction).toBe(95 / 97);
  });

  it.each([8, 25, 103, 200, 1000])('quantizes isolated markers upward by less than one pitch on a %ipx rail', (height) => {
    const available = height - MARKER_GEOMETRY.height;
    const pitch = MARKER_GEOMETRY.pitch;
    for (let index = 0; index <= 1000; index++) {
      const [bucket] = computeMarkerBuckets([{ index, kind: 'own' }], 1001, height);
      const exactY = markerFraction(index, 1001) * available;
      const renderedY = bucket.fraction * available;
      expect(exactY - renderedY).toBeGreaterThanOrEqual(-1e-10);
      expect(exactY - renderedY).toBeLessThan(pitch);
      expect(renderedY + MARKER_GEOMETRY.height).toBeLessThanOrEqual(height);
    }
  });

  it('still buckets without a measured height', () => {
    const buckets = computeMarkerBuckets(
      [
        { index: 0, kind: 'mention' },
        { index: 10, kind: 'own' },
      ],
      11,
      0,
    );
    expect(buckets).toEqual([{ row: 0, fraction: 0, kinds: ['mention', 'own'] }]);
  });
});
