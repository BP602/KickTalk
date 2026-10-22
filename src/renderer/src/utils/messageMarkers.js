// Pure marker math for the chat scrollbar rail.
//
// Positions are index-based: a marker's fraction is its index within the
// filtered message list. Chat rows have variable heights, so this is an
// approximation of the marker's true scroll position — accepted for a
// glanceable overview rail rather than chasing Virtuoso's internal state.
// Fixed-pitch grid quantization adds less than one 5px grid pitch of upward
// displacement from that index-based position (3px fill, 2px clear gap).

export const markerFraction = (index, total) => (total <= 1 ? 0 : index / (total - 1));

// Shared by bucketing and native-track gradient stops; no outline is painted.
export const MARKER_GEOMETRY = Object.freeze({ height: 3, outline: 0, pitch: 5 });

const KIND_ORDER = ["mention", "own"];

/**
 * Buckets marker entries ({ index, kind }) on a fixed 5px grid (3px fill plus
 * a 2px clear gap). Each entry's
 * exact y = fraction * (heightPx - tickHeight) selects a grid row; all kinds
 * on that row share a split-kind tick rendered at row * pitch.
 * Adjacent rows cannot occlude each other and dense histories retain marks
 * across the rail instead of collapsing into one transitive cluster.
 * First row starts at zero; the last row's fill remains in bounds. Measured
 * positions are quantized upward by less than one pitch, not kept exact.
 * Before measurement, all entries share one tick until the height is known.
 *
 * Returns [{ row, fraction, kinds }] in grid-row order. `fraction` maps the
 * grid position through the rail's existing top: calc(...) formula.
 */
export const computeMarkerBuckets = (entries, total, heightPx) => {
  if (!entries?.length) return [];

  const height = Number.isFinite(heightPx) && heightPx > 0 ? heightPx : 0;
  const availableHeight = Math.max(0, height - MARKER_GEOMETRY.height);
  const pitch = MARKER_GEOMETRY.pitch;
  const rowCount = Math.max(1, Math.floor(availableHeight / pitch) + 1);
  const rows = new Map();

  for (const entry of entries) {
    const y = markerFraction(entry.index, total) * availableHeight;
    const row = Math.min(rowCount - 1, Math.floor(y / pitch));
    if (!rows.has(row)) rows.set(row, new Set());
    rows.get(row).add(entry.kind);
  }

  return [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([row, kinds]) => ({
      row,
      fraction: availableHeight > 0 ? row * pitch / availableHeight : 0,
      kinds: KIND_ORDER.filter((kind) => kinds.has(kind)),
    }));
};

const markerColor = (color, opacity = 0.7) => {
  if (!color) return "transparent";
  if (typeof color === "object" && color.r !== undefined) {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`;
  }
  return `color-mix(in srgb, ${color} ${opacity * 100}%, transparent)`;
};

/**
 * Native scrollbar-track background layers. The thumb paints above the track,
 * and Chromium hides the track automatically when there is no overflow.
 * Single-kind rows use full width; only mixed rows split into left/right
 * halves. Up to four gradients group all ticks by category and width, keeping
 * image/size/position lists aligned and avoiding one background per message.
 */
export const markerTrackStyle = (buckets, { mentionColor, ownColor = "var(--text-tertiary)" } = {}) => {
  if (!buckets?.length) return {};

  const mention = markerColor(mentionColor);
  const own = markerColor(ownColor, 0.45);
  const stops = [[], [], [], []];
  for (const bucket of buckets) {
    const hasMention = bucket.kinds.includes("mention");
    const hasOwn = bucket.kinds.includes("own");
    const top = `calc(${bucket.fraction * 100}% - ${bucket.fraction * MARKER_GEOMETRY.height}px)`;
    const bottom = `calc(${top} + ${MARKER_GEOMETRY.height}px)`;
    const addStop = (layer, color) => stops[layer].push(`transparent ${top}, ${color} ${top}, ${color} ${bottom}, transparent ${bottom}`);
    if (hasMention && hasOwn) {
      addStop(2, mention);
      addStop(3, own);
    } else if (hasMention) {
      addStop(0, mention);
    } else if (hasOwn) {
      addStop(1, own);
    }
  }

  const images = [];
  const sizes = [];
  const positions = [];
  stops.forEach((layer, index) => {
    if (!layer.length) return;
    images.push(`linear-gradient(to bottom, ${layer.join(", ")})`);
    sizes.push(index < 2 ? "100% 100%" : "50% 100%");
    positions.push(index === 3 ? "right top" : "left top");
  });
  if (!images.length) return {};
  return {
    "--scroll-marker-image": images.join(", "),
    "--scroll-marker-size": sizes.join(", "),
    "--scroll-marker-position": positions.join(", "),
  };
};
