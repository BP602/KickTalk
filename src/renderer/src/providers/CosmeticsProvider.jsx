import { create } from "zustand";

// Telemetry helpers
const getRendererTracer = () =>
  (typeof window !== 'undefined' && (window.__KT_TRACER__ || window.__KT_TRACE_API__?.trace?.getTracer?.('kicktalk-renderer'))) || null;

const startSpan = (name, attributes = {}) => {
  try {
    const tracer = getRendererTracer();
    if (!tracer || typeof tracer.startSpan !== 'function') return null;
    const span = tracer.startSpan(name);
    if (span && typeof span.setAttributes === 'function') {
      span.setAttributes(attributes);
    }
    return span;
  } catch {
    return null;
  }
};

const INVALID_7TV_NULL_ID = "00000000000000000000000000";

const normalizeCosmeticId = (id, refId) => {
  if (!id && refId) return refId;
  if (id === INVALID_7TV_NULL_ID) return refId || "default_id";
  return id;
};

const argbToRgba = (color) => {
  if (typeof color !== "number") return null;
  if (color < 0) {
    color = color >>> 0;
  }

  const red = (color >> 24) & 0xff;
  const green = (color >> 16) & 0xff;
  const blue = (color >> 8) & 0xff;
  const alpha = color & 0xff;
  const normalizedAlpha = Number.isFinite(alpha) ? Math.min(Math.max(alpha / 255, 0), 1) : 1;
  const alphaString = normalizedAlpha === 1 ? "1" : normalizedAlpha.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");

  return `rgba(${red}, ${green}, ${blue}, ${alphaString || "0"})`;
};

const buildBadgeFromData = (data = {}) => {
  const badgeId = normalizeCosmeticId(data.id, data.ref_id);
  if (!badgeId) return null;

  const host = data.host;
  let badgeUrl = data.url;

  if (!badgeUrl && host?.url && Array.isArray(host?.files) && host.files.length > 0) {
    badgeUrl = `https:${host.url}/${host.files[host.files.length - 1].name}`;
  }

  return {
    id: badgeId,
    title: data.tooltip || data.title || data.name || "",
    url: badgeUrl || null,
  };
};

const buildPaintFromData = (data = {}) => {
  const paintId = normalizeCosmeticId(data.id, data.ref_id);
  if (!paintId) return null;

  const stops = Array.isArray(data.stops) ? data.stops : [];
  const shadows = Array.isArray(data.shadows) ? data.shadows : [];

  const rawFunction = (data.function || "linear-gradient").toLowerCase().replace(/_/g, "-");
  const gradientFunction = data.repeat ? `repeating-${rawFunction}` : rawFunction;
  const isLinear = gradientFunction === "linear-gradient" || gradientFunction === "repeating-linear-gradient";
  const firstArgument = isLinear ? `${typeof data.angle === "number" ? data.angle : 0}deg` : (data.shape || "");

  const gradientStops = stops
    .map((stop) => {
      const colorValue = typeof stop.color === "string" ? stop.color : argbToRgba(stop.color);
      if (!colorValue) return null;
      const atPercent = typeof stop.at === "number" ? Math.max(0, Math.min(100, stop.at * 100)) : 0;
      return `${colorValue} ${atPercent}%`;
    })
    .filter(Boolean)
    .join(", ");

  let backgroundImage;

  if (gradientStops) {
    const firstSegment = firstArgument ? `${firstArgument}, ` : "";
    backgroundImage = `${gradientFunction}(${firstSegment}${gradientStops})`;
  } else if (data.image_url) {
    backgroundImage = `url('${data.image_url}')`;
  } else if (data.color) {
    const fallback = typeof data.color === "string" ? data.color : argbToRgba(data.color) || "rgba(255, 255, 255, 1)";
    backgroundImage = `linear-gradient(0deg, ${fallback}, ${fallback})`;
  } else {
    backgroundImage = "linear-gradient(0deg, rgba(255, 255, 255, 1), rgba(255, 255, 255, 1))";
  }

  const dropShadows = shadows.length
    ? shadows
        .map((shadow) => {
          let rgbaColor = typeof shadow.color === "string" ? shadow.color : argbToRgba(shadow.color);
          if (!rgbaColor) return null;
          rgbaColor = rgbaColor.replace(/rgba\((\d+), (\d+), (\d+), ([0-9.]+)\)/, "rgba($1, $2, $3)");
          return `drop-shadow(${rgbaColor} ${shadow.x_offset}px ${shadow.y_offset}px ${shadow.radius}px)`;
        })
        .filter(Boolean)
        .join(" ")
    : null;

  return {
    id: paintId,
    name: data.name,
    backgroundImage,
    shadows: dropShadows,
    style: gradientFunction,
    shape: data.shape,
    url: data.image_url || null,
  };
};

const normalizePaintEntry = (paint) => {
  if (!paint) return null;

  if (paint.backgroundImage && paint.id) {
    const normalizedId = normalizeCosmeticId(paint.id, paint.ref_id);
    if (!normalizedId) return null;

    return {
      id: normalizedId,
      name: paint.name,
      backgroundImage: paint.backgroundImage,
      shadows: paint.shadows || null,
      style: paint.style,
      shape: paint.shape,
      url: paint.url || paint.image_url || null,
    };
  }

  return buildPaintFromData(paint);
};

const useCosmeticsStore = create((set, get) => ({
  userStyles: {},
  globalCosmetics: {
    badges: [],
    paints: [],
  },
  cosmeticsLookup: {
    badgeMap: new Map(),
    paintMap: new Map(),
  },

  addUserStyle: async (username, body) => {
    if (!body?.object?.user?.style) return;
    const transformedUsername = username.toLowerCase();
    const userStyle = body.object.user;

    set((state) => {
      const currentStyle = state.userStyles[transformedUsername] || {};
      if (currentStyle.badgeId === body.object.user.style.badge_id && currentStyle.paintId === body.object.user.style.paint_id)
        return state;

      return {
        userStyles: {
          ...state.userStyles,
          [transformedUsername]: {
            badgeId: userStyle.style.badge_id,
            paintId: userStyle.style.paint_id,
            color: userStyle.style.color,
            kickConnection: userStyle.connections?.find((c) => c.type === "KICK"),
            entitlement: body,
            userId: userStyle.id,
            username: userStyle.username,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  },

  removeUserStyle: (username, body) => {
    if (!username) return;
    const transformedUsername = username.toLowerCase();
    const refId = body?.object?.ref_id;
    const kind = body?.object?.kind;

    if (!refId || !kind) return;

    set((state) => {
      const currentStyle = state.userStyles[transformedUsername];
      if (!currentStyle) return state;

      // Remove by kind and ref_id
      let updatedStyle = { ...currentStyle };
      let hasChanges = false;

      if (kind === "BADGE" && currentStyle.badgeId === refId) {
        updatedStyle.badgeId = null;
        hasChanges = true;
      } else if (kind === "PAINT" && currentStyle.paintId === refId) {
        updatedStyle.paintId = null;
        hasChanges = true;
      }

      if (!hasChanges) return state;

      // If both badge and paint are removed, remove the entire user style entry
      if (!updatedStyle.badgeId && !updatedStyle.paintId) {
        const { [transformedUsername]: removed, ...restUserStyles } = state.userStyles;
        return { userStyles: restUserStyles };
      }

      return {
        userStyles: {
          ...state.userStyles,
          [transformedUsername]: {
            ...updatedStyle,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  },

  getUserStyle: (username) => {
    if (!username) return null;
    const transformedUsername = username.toLowerCase();
    const userStyle = get().userStyles[transformedUsername];

    if (!userStyle?.badgeId && !userStyle?.paintId) return null;

    const { badgeMap, paintMap } = get().cosmeticsLookup;
    const badge = userStyle.badgeId ? badgeMap.get(userStyle.badgeId) : null;
    const paint = userStyle.paintId ? paintMap.get(userStyle.paintId) : null;

    return {
      badge,
      paint,
      color: userStyle.color,
      username: userStyle.username,
    };
  },

  addCosmetic: (body) => {
    // Handle individual cosmetic.create events with raw 7TV structure
    // body = { object: { kind: "BADGE"|"PAINT"|"AVATAR", data: {...} } }
    if (!body?.object) return;

    const { object } = body;
    const kind = object.kind;

    // Skip cosmetics that have a user (those are entitlements, not global cosmetics)
    if (object.user) return;

    set((state) => {
      const newBadges = [...state.globalCosmetics.badges];
      const newPaints = [...state.globalCosmetics.paints];
      const newBadgeMap = new Map(state.cosmeticsLookup.badgeMap);
      const newPaintMap = new Map(state.cosmeticsLookup.paintMap);

      if (kind === "BADGE") {
        const data = object.data;
        const badge = buildBadgeFromData(data);
        if (!badge) return state;

        // Skip if already exists
        if (newBadgeMap.has(badge.id)) return state;

        newBadges.push(badge);
        newBadgeMap.set(badge.id, badge);
      } else if (kind === "PAINT") {
        const paint = buildPaintFromData(object.data);
        if (!paint) return state;

        // Skip if already exists
        if (newPaintMap.has(paint.id)) return state;

        newPaints.push(paint);
        newPaintMap.set(paint.id, paint);
      } else {
        // Log unhandled cosmetic kinds (e.g., AVATAR) to telemetry
        const span = startSpan('seventv.unhandled_cosmetic_create');
        span?.setAttributes?.({
          'cosmetic.kind': kind || 'unknown',
          'cosmetic.id': object.data?.id || 'unknown',
          'cosmetic.has_user': !!object.user
        });
        span?.end?.();
      }

      return {
        globalCosmetics: {
          badges: newBadges,
          paints: newPaints,
        },
        cosmeticsLookup: {
          badgeMap: newBadgeMap,
          paintMap: newPaintMap,
        },
      };
    });
  },

  removeCosmetic: (body) => {
    // Handle individual cosmetic.delete events with raw 7TV structure
    // body = { object: { kind: "BADGE"|"PAINT"|"AVATAR", data: {...} } }
    if (!body?.object) return;

    const { object } = body;
    const kind = object.kind;

    // Skip cosmetics that have a user (those are entitlements, not global cosmetics)
    if (object.user) return;

    set((state) => {
      const data = object.data;
      const cosmeticId = normalizeCosmeticId(data?.id, data?.ref_id);

      if (!cosmeticId) return state;

      if (kind === "BADGE") {
        const newBadgeMap = new Map(state.cosmeticsLookup.badgeMap);
        newBadgeMap.delete(cosmeticId);

        const newBadges = state.globalCosmetics.badges.filter(b => b.id !== cosmeticId);

        return {
          globalCosmetics: {
            badges: newBadges,
            paints: state.globalCosmetics.paints,
          },
          cosmeticsLookup: {
            badgeMap: newBadgeMap,
            paintMap: state.cosmeticsLookup.paintMap,
          },
        };
      } else if (kind === "PAINT") {
        const newPaintMap = new Map(state.cosmeticsLookup.paintMap);
        newPaintMap.delete(cosmeticId);

        const newPaints = state.globalCosmetics.paints.filter(p => p.id !== cosmeticId);

        return {
          globalCosmetics: {
            badges: state.globalCosmetics.badges,
            paints: newPaints,
          },
          cosmeticsLookup: {
            badgeMap: state.cosmeticsLookup.badgeMap,
            paintMap: newPaintMap,
          },
        };
      } else {
        // Log unhandled cosmetic kinds (e.g., AVATAR) to telemetry
        const span = startSpan('seventv.unhandled_cosmetic_delete');
        span?.setAttributes?.({
          'cosmetic.kind': kind || 'unknown',
          'cosmetic.id': cosmeticId || 'unknown',
          'cosmetic.has_user': !!object.user
        });
        span?.end?.();
        return state;
      }
    });
  },

  addCosmetics: (body) => {
    set(() => {
      // Create lookup maps for O(1) access
      const badgeMap = new Map();
      const paintMap = new Map();

      if (body.badges) {
        body.badges
          .map(buildBadgeFromData)
          .filter(Boolean)
          .forEach((badge) => {
            badgeMap.set(badge.id, badge);
          });
      }

      if (body.paints) {
        body.paints
          .map(normalizePaintEntry)
          .filter(Boolean)
          .forEach((paint) => {
            paintMap.set(paint.id, paint);
          });
      }

      const badges = Array.from(badgeMap.values());
      const paints = Array.from(paintMap.values());

      return {
        globalCosmetics: {
          badges,
          paints,
        },
        cosmeticsLookup: {
          badgeMap,
          paintMap,
        },
      };
    });
  },

  getUserBadge: (username) => {
    const transformedUsername = username.toLowerCase();

    const userStyle = get().userStyles[transformedUsername];
    if (!userStyle?.badgeId) return null;

    return get().cosmeticsLookup.badgeMap.get(userStyle.badgeId);
  },

  getUserPaint: (username) => {
    const transformedUsername = username.toLowerCase();

    const userStyle = get().userStyles[transformedUsername];
    if (!userStyle?.paintId) return null;

    return get().cosmeticsLookup.paintMap.get(userStyle.paintId);
  },
}));

export default useCosmeticsStore;
