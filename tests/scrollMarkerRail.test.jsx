// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { computeMarkerBuckets, MARKER_GEOMETRY, markerTrackStyle } from '../src/renderer/src/utils/messageMarkers';

const colors = { mentionColor: { r: 255, g: 128, b: 0, a: 0.25 }, ownColor: 'var(--text-accent)' };
const bucket = (fraction, kinds, row = 0) => ({ row, fraction, kinds });

// CSS lists contain commas inside gradients/colors as well as between layers.
const cssLayers = (value) => {
  const layers = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++;
    if (value[i] === ')') depth--;
    if (value[i] === ',' && depth === 0) {
      layers.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  layers.push(value.slice(start).trim());
  return layers;
};

// Parse the actual hard stops, including horizontal size/position. First CSS
// background layer paints last (above subsequent layers).
const renderedSegments = (buckets, height) => {
  const style = markerTrackStyle(buckets, colors);
  if (!style['--scroll-marker-image']) return [];
  const images = cssLayers(style['--scroll-marker-image']);
  const sizes = cssLayers(style['--scroll-marker-size']);
  const positions = cssLayers(style['--scroll-marker-position']);
  return images.flatMap((image, i) => {
    const stops = [...image.matchAll(/transparent calc\(([-\d.e+]+)% - ([-\d.e+]+)px\), ([\s\S]*?) calc\(\1% - \2px\), \3 calc\(calc\(\1% - \2px\) \+ ([\d.]+)px\), transparent calc\(calc\(\1% - \2px\) \+ \4px\)/g)];
    const width = sizes[i] === '50% 100%' ? 5 : 10;
    const left = positions[i] === 'right top' ? 5 : 0;
    return stops.map((stop) => {
      const top = Number(stop[1]) * height / 100 - Number(stop[2]);
      return { order: images.length - i, kind: stop[3].includes('--text-accent') ? 'own' : 'mention', left, right: left + width, top, bottom: top + Number(stop[4]) };
    });
  });
};

const hasCoveredCategory = (segments) => segments.some((earlier) => segments.some((later) =>
  later.order > earlier.order && later.kind !== earlier.kind &&
  later.left <= earlier.left && later.right >= earlier.right &&
  later.top <= earlier.top && later.bottom >= earlier.bottom));
const hasCategoryOverlap = (segments) => segments.some((a, i) => segments.slice(i + 1).some((b) =>
  a.kind !== b.kind && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom));
const spansHistory = (buckets, height) => buckets.length > 1 &&
  Math.max(...renderedSegments(buckets, height).map((s) => s.top)) >= height * 0.9;

const oldPixelBuckets = (entries, total, height) => {
  const rows = new Map();
  for (const { index, kind } of entries) {
    const fraction = index / (total - 1);
    const row = Math.min(height - 1, Math.floor(fraction * height));
    if (!rows.has(row)) rows.set(row, bucket(fraction, [], row));
    if (!rows.get(row).kinds.includes(kind)) rows.get(row).kinds.push(kind);
  }
  return [...rows.values()];
};

// Previous transitive rule, with its old 1px outline, as a distribution control.
const transitiveBuckets = (entries, total, height) => {
  const buckets = [];
  let end = -Infinity;
  for (const { index, kind } of entries) {
    const fraction = index / (total - 1);
    const y = fraction * (height - 3);
    if (!buckets.length || y - 1 > end + 1e-10) buckets.push(bucket(fraction, [], Math.floor(y)));
    const current = buckets[buckets.length - 1];
    if (!current.kinds.includes(kind)) current.kinds.push(kind);
    end = Math.max(end, y + 4);
  }
  return buckets;
};

describe('markerTrackStyle', () => {
  it('returns no custom properties without ticks', () => {
    expect(markerTrackStyle([], colors)).toEqual({});
    expect(markerTrackStyle(undefined, colors)).toEqual({});
    expect(markerTrackStyle([bucket(0, [])], colors)).toEqual({});
  });

  it.each(['mention', 'own'])('renders %s-only ticks full width', (kind) => {
    const style = markerTrackStyle([bucket(0.5, [kind])], colors);
    expect(style['--scroll-marker-size']).toBe('100% 100%');
    expect(style['--scroll-marker-position']).toBe('left top');
    const [segment] = renderedSegments([bucket(0.5, [kind])], 103);
    expect(segment).toMatchObject({ kind, left: 0, right: 10, top: 50, bottom: 53 });
  });

  it('uses half-width layers only for rows with both kinds', () => {
    const style = markerTrackStyle([bucket(0.5, ['mention', 'own'])], colors);
    expect(cssLayers(style['--scroll-marker-size'])).toEqual(['50% 100%', '50% 100%']);
    expect(cssLayers(style['--scroll-marker-position'])).toEqual(['left top', 'right top']);
    expect(renderedSegments([bucket(0.5, ['mention', 'own'])], 103)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'mention', left: 0, right: 5 }),
      expect.objectContaining({ kind: 'own', left: 5, right: 10 }),
    ]));
  });

  it('keeps image, size, and position lists aligned while omitting empty layers', () => {
    const buckets = [bucket(0, ['mention']), bucket(0.3, ['own'], 1), bucket(1, ['mention', 'own'], 2)];
    const style = markerTrackStyle(buckets, colors);
    const segments = renderedSegments(buckets, 103);
    expect(cssLayers(style['--scroll-marker-image'])).toHaveLength(4);
    expect(cssLayers(style['--scroll-marker-size'])).toEqual(['100% 100%', '100% 100%', '50% 100%', '50% 100%']);
    expect(cssLayers(style['--scroll-marker-position'])).toEqual(['left top', 'left top', 'left top', 'right top']);
    expect(segments).toHaveLength(4);
    expect(segments.map((s) => s.top)).toEqual([0, 30, 100, 100]);
  });

  it('keeps mention opacity independent of its row-background alpha', () => {
    const style = markerTrackStyle([bucket(0, ['mention'])], colors);
    expect(style['--scroll-marker-image']).toContain('rgba(255, 128, 0, 0.7)');
    expect(style['--scroll-marker-image']).not.toContain('0.25');
  });

  it('supports string mention colors via color-mix', () => {
    const style = markerTrackStyle([bucket(0, ['mention'])], { ...colors, mentionColor: 'rgba(200, 100, 0, 0.5)' });
    expect(style['--scroll-marker-image']).toContain('color-mix(in srgb, rgba(200, 100, 0, 0.5) 70%, transparent)');
  });

  it.each([103, 200, 1000])('keeps endpoint fills in bounds within one pitch on a %ipx track', (height) => {
    const segments = renderedSegments(computeMarkerBuckets([{ index: 0, kind: 'own' }, { index: 100, kind: 'mention' }], 101, height), height);
    expect(Math.min(...segments.map((s) => s.top))).toBe(0);
    const bottom = Math.max(...segments.map((s) => s.bottom));
    expect(bottom).toBeLessThanOrEqual(height);
    expect(height - bottom).toBeLessThan(MARKER_GEOMETRY.pitch);
  });

  it('detects overlap under the old pixel rows and removes it for the reviewer counterexample', () => {
    const entries = [{ index: 0, kind: 'own' }, { index: 1, kind: 'mention' }];
    expect(hasCategoryOverlap(renderedSegments(oldPixelBuckets(entries, 101, 103), 103))).toBe(true);
    expect(hasCategoryOverlap(renderedSegments(computeMarkerBuckets(entries, 101, 103), 103))).toBe(false);
  });

  it.each([1, 39, 80])('retains distribution and category visibility for 4000 messages at stride %i', (stride) => {
    const entries = Array.from({ length: Math.ceil(4000 / stride) }, (_, i) => ({ index: i * stride, kind: i % 2 ? 'mention' : 'own' }));
    const buckets = computeMarkerBuckets(entries, 4000, 103);
    const segments = renderedSegments(buckets, 103);
    expect(spansHistory(buckets, 103)).toBe(true);
    expect(segments.some((s) => s.kind === 'mention')).toBe(true);
    expect(segments.some((s) => s.kind === 'own')).toBe(true);
    expect(hasCoveredCategory(segments)).toBe(false);
    expect(hasCategoryOverlap(segments)).toBe(false);
    expect(buckets.length).toBeLessThanOrEqual(Math.ceil(103 / MARKER_GEOMETRY.pitch));
    expect(spansHistory(transitiveBuckets(entries, 4000, 103), 103)).toBe(false);
  });

  it('keeps touching markers distributed instead of transitive chain collapse', () => {
    const entries = Array.from({ length: 21 }, (_, i) => ({ index: i * 5, kind: i % 2 ? 'mention' : 'own' }));
    const buckets = computeMarkerBuckets(entries, 101, 103);
    expect(spansHistory(buckets, 103)).toBe(true);
    expect(hasCoveredCategory(renderedSegments(buckets, 103))).toBe(false);
    expect(hasCategoryOverlap(renderedSegments(buckets, 103))).toBe(false);
    const collapsed = transitiveBuckets(entries, 101, 103);
    expect(spansHistory(collapsed, 103)).toBe(false);
    expect(renderedSegments(collapsed, 103).at(-1).top).toBe(0);
  });
});
