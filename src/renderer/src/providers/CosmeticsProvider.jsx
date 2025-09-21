import { create } from "zustand";

const normalizeUsername = (username) => {
  if (!username || typeof username !== "string") return null;
  const trimmed = username.trim();
  if (!trimmed) return null;
  return trimmed.replaceAll("-", "_").toLowerCase();
};

const normalizeUserId = (userId) => {
  if (userId === null || userId === undefined) return null;
  const value = typeof userId === "number" ? String(userId) : `${userId}`;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const createUserIdKey = (userId) => {
  const normalized = normalizeUserId(userId);
  return normalized ? `id:${normalized}` : null;
};

const isKickConnection = (connection) => {
  if (!connection) return false;
  const platform = connection.platform ?? connection.type;
  if (!platform) return false;
  return String(platform).toUpperCase() === "KICK";
};

const paintCssCache = new Map();
const colorCssCache = new Map();
const badgeCache = new Map();
let paintDefinitionMap = new Map();
let badgeDefinitionMap = new Map();
let globalCosmeticsPromise = null;

// LRU Cache for user style associations
class LRUCache {
  constructor(maxSize = 300) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (this.cache.has(key)) {
      // Move to end (most recently used)
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return null;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove oldest (first key)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  has(key) {
    return this.cache.has(key);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

// Temporarily disabled LRU cache due to memory leak
// const userStylesCache = new LRUCache(300);
// const kickTo7tvIdCache = new LRUCache(500);
// const callTracker = new Map();

const normalizeCosmeticId = (id) => {
  if (!id) return null;
  return String(id).replace(/^badge:/i, "").replace(/^paint:/i, "").trim() || null;
};

const extractKickConnectionInfo = (userStyle) => {
  if (!userStyle || !Array.isArray(userStyle.connections)) return { id: null, username: null };
  const connection = userStyle.connections.find(isKickConnection);
  if (!connection) return { id: null, username: null };

  const kickId =
    connection.id ??
    connection.user_id ??
    connection.userId ??
    connection.platform_id ??
    connection.platformId ??
    connection.external_id ??
    connection.externalId ??
    null;

  const username =
    connection.username ??
    connection.display_name ??
    connection.slug ??
    null;

  return {
    id: normalizeUserId(kickId),
    username,
    normalizedUsername: normalizeUsername(username),
  };
};

const extractBadgeId = (style, userStyle, body) => {
  const direct =
    style?.badge_id ??
    style?.badge?.id ??
    userStyle?.badge_id ??
    userStyle?.badge?.id ??
    null;
  if (direct) return direct;

  const bodyBadge =
    body?.object?.badge?.id ??
    body?.badge?.id ??
    body?.object?.user?.style?.badge?.id ??
    null;
  if (bodyBadge) return bodyBadge;

  const badgeCollections = [
    userStyle?.badges,
    body?.object?.badges,
    style?.badges,
    userStyle?.style?.badges,
    body?.badges,
    body?.object?.user?.badges,
  ];

  for (const collection of badgeCollections) {
    if (!Array.isArray(collection)) continue;
    const entry = collection.find((item) => item?.selected) ?? collection[0];
    if (!entry) continue;
    if (entry?.badge?.id) return entry.badge.id;
    if (entry?.id) return entry.id;
  }

  return null;
};

const extractPaintId = (style, userStyle, body) => {
  const direct =
    style?.paint_id ??
    style?.paint?.id ??
    userStyle?.paint_id ??
    userStyle?.paint?.id ??
    null;
  if (direct) return direct;

  const bodyPaint =
    body?.object?.paint?.id ??
    body?.paint?.id ??
    body?.object?.user?.style?.paint?.id ??
    null;
  if (bodyPaint) return bodyPaint;

  const paintCollections = [
    userStyle?.paints,
    style?.paints,
    body?.object?.paints,
    body?.paints,
    body?.object?.user?.paints,
  ];

  for (const collection of paintCollections) {
    if (!Array.isArray(collection)) continue;
    const entry = collection.find((item) => item?.selected) ?? collection[0];
    if (!entry) continue;
    if (entry?.paint?.id) return entry.paint.id;
    if (entry?.id) return entry.id;
  }

  return null;
};

const extractIdentityFields = (identity) => {
  if (!identity && identity !== 0) {
    return { username: null, userId: null };
  }

  if (typeof identity === "string") {
    return { username: identity, userId: null };
  }

  if (typeof identity === "number") {
    return { username: null, userId: identity };
  }

  if (Array.isArray(identity)) {
    const [usernameCandidate, userIdCandidate] = identity;
    return { username: usernameCandidate ?? null, userId: userIdCandidate ?? null };
  }

  if (typeof identity === "object") {
    const usernameCandidate =
      identity.username ??
      identity.slug ??
      identity.name ??
      identity.displayName ??
      identity?.sender?.username ??
      identity?.user?.username ??
      null;

    const userIdCandidate =
      identity.userId ??
      identity.id ??
      identity.user_id ??
      identity.kickUserId ??
      identity.kick_id ??
      identity?.sender?.id ??
      identity?.user?.id ??
      null;

    return { username: usernameCandidate ?? null, userId: userIdCandidate ?? null };
  }

  return { username: null, userId: null };
};

const deriveIdentityKeys = (identity) => {
  const { username, userId } = extractIdentityFields(identity);
  return {
    usernameKey: normalizeUsername(username),
    userIdKey: createUserIdKey(userId),
  };
};

const resolveStoredStyle = (identity, userStyles) => {
  if (!userStyles) return null;

  const { usernameKey, userIdKey } = deriveIdentityKeys(identity);
  return (
    (userIdKey && userStyles[userIdKey]) ||
    (usernameKey && userStyles[usernameKey]) ||
    null
  );
};

const useCosmeticsStore = create((set, get) => ({
  userStyles: {},
  globalCosmetics: {
    badges: [],
    paints: [],
  },
  pendingRequests: new Set(),
  resolvedNoStyle: new Set(),
  cosmeticsLoaded: false,

  addUserStyle: async (identity, body) => {
    const userStyle = body?.object?.user;
    const style = userStyle?.style;
    if (!style) return;

    const { username: providedUsername, userId: providedUserId } = extractIdentityFields(identity);
    const kickConnectionInfo = extractKickConnectionInfo(userStyle);

    const fallbackUsername =
      providedUsername ??
      kickConnectionInfo.username ??
      userStyle?.username ??
      userStyle?.display_name;
    const usernameKey = normalizeUsername(fallbackUsername);

    const resolvedKickUserId =
      providedUserId ??
      kickConnectionInfo.id ??
      null;
    const userIdKey = createUserIdKey(resolvedKickUserId);

    if (!usernameKey && !userIdKey) return;

    const badgeIdRaw = extractBadgeId(style, userStyle, body);
    const paintIdRaw = extractPaintId(style, userStyle, body);
    const normalizedBadgeId = normalizeCosmeticId(badgeIdRaw);
    const normalizedPaintId = normalizeCosmeticId(paintIdRaw);

    const hasBadge = Boolean(normalizedBadgeId);
    const hasPaint = Boolean(normalizedPaintId);
    const hasColor = style.color !== null && style.color !== undefined;
    const hasStyleData = hasBadge || hasPaint || hasColor;

    set((state) => {
      const existingStyle =
        (userIdKey && state.userStyles[userIdKey]) ||
        (usernameKey && state.userStyles[usernameKey]) ||
        null;
      const hasUsernameMapping = usernameKey ? Boolean(state.userStyles[usernameKey]) : false;
      const hasIdMapping = userIdKey ? Boolean(state.userStyles[userIdKey]) : false;

      let nextResolved = state.resolvedNoStyle;

      if (!hasStyleData) {
        const record = {
          badgeId: null,
          paintId: null,
          color: null,
          userId: userStyle.id,
          kickUserId: normalizeUserId(resolvedKickUserId),
          username: fallbackUsername ?? userStyle.username,
          stvUsername: userStyle.username,
          updatedAt: new Date().toISOString(),
          noStyle: true,
        };

        const updatedStyles = { ...state.userStyles };
        if (usernameKey) {
          updatedStyles[usernameKey] = record;
        }
        if (userIdKey) {
          updatedStyles[userIdKey] = record;
        }

        nextResolved = new Set(state.resolvedNoStyle);
        if (usernameKey) nextResolved.add(usernameKey);
        if (userIdKey) nextResolved.add(userIdKey);

        console.debug("[Cosmetics] user has no 7TV style", {
          usernameKey,
          userIdKey,
        });

        return {
          userStyles: updatedStyles,
          resolvedNoStyle: nextResolved,
        };
      }

      if (
        existingStyle &&
        existingStyle.badgeId === normalizedBadgeId &&
        existingStyle.paintId === normalizedPaintId &&
        existingStyle.color === style.color &&
        (!usernameKey || hasUsernameMapping) &&
        (!userIdKey || hasIdMapping)
      ) {
        return state;
      }

      // Create fallback badge/paint objects if needed
      const styleRecord = {
        badgeId: normalizedBadgeId,
        paintId: normalizedPaintId,
        color: style.color,
        userId: userStyle.id,
        kickUserId: normalizeUserId(resolvedKickUserId),
        username: fallbackUsername ?? userStyle.username,
        stvUsername: userStyle.username,
        updatedAt: new Date().toISOString(),
        noStyle: false,
      };

      const updatedStyles = { ...state.userStyles };
      if (usernameKey) {
        updatedStyles[usernameKey] = styleRecord;
      }
      if (userIdKey) {
        updatedStyles[userIdKey] = styleRecord;
      }

      if (usernameKey || userIdKey) {
        nextResolved = new Set(state.resolvedNoStyle);
        if (usernameKey) nextResolved.delete(usernameKey);
        if (userIdKey) nextResolved.delete(userIdKey);
      }

      console.debug("[Cosmetics] stored user style", {
        usernameKey,
        userIdKey,
        badgeId: styleRecord.badgeId,
        paintId: styleRecord.paintId,
        rawBadgeId: badgeIdRaw,
        rawPaintId: paintIdRaw,
        hasExistingStyle: Boolean(existingStyle),
      });

      return {
        userStyles: updatedStyles,
        resolvedNoStyle: nextResolved,
      };
    });
  },

  getUserStyle: (identity) => {
    const storedStyle = resolveStoredStyle(identity, get().userStyles);
    if (!storedStyle?.badgeId && !storedStyle?.paintId && !storedStyle?.color) return null;

    const badgeDefinition = storedStyle.badgeId
      ? badgeDefinitionMap.get(storedStyle.badgeId) ?? get().globalCosmetics?.badges?.find((b) => b.id === storedStyle.badgeId) ?? null
      : null;

    const paintDefinition = storedStyle.paintId
      ? paintDefinitionMap.get(storedStyle.paintId) ?? get().globalCosmetics?.paints?.find((p) => p.id === storedStyle.paintId) ?? null
      : null;

    if (badgeDefinition && !badgeDefinitionMap.has(badgeDefinition.id)) {
      badgeDefinitionMap.set(badgeDefinition.id, badgeDefinition);
    }
    if (paintDefinition && !paintDefinitionMap.has(paintDefinition.id)) {
      paintDefinitionMap.set(paintDefinition.id, paintDefinition);
    }

    // Convert paint definition to CSS
    let paint = null;
    if (paintDefinition) {
      const stvApi = typeof window !== "undefined" ? window.app?.stv : null;
      if (stvApi?.convertPaintToCSS) {
        const cached = paintCssCache.get(paintDefinition.id);
        if (cached && cached.source === paintDefinition) {
          paint = cached.value;
        } else {
          const cssPaint = stvApi.convertPaintToCSS(paintDefinition);
          const normalizedPaint = cssPaint && (cssPaint.backgroundImage || cssPaint.boxShadow)
            ? Object.freeze({
                id: paintDefinition.id,
                name: paintDefinition.name,
                backgroundImage: cssPaint.backgroundImage ?? null,
                shadows: cssPaint.boxShadow ?? null,
              })
            : null;

          paintCssCache.set(paintDefinition.id, {
            source: paintDefinition,
            value: normalizedPaint,
          });

          paint = normalizedPaint;
        }
      }
    }

    const badge = (() => {
      if (storedStyle.badgeId) {
        console.debug("[Cosmetics] resolving badge", {
          badgeId: storedStyle.badgeId,
          hasDefinition: Boolean(badgeDefinition),
        });
      }
      if (!badgeDefinition) return null;

      const cachedBadge = badgeCache.get(badgeDefinition.id);
      if (cachedBadge && cachedBadge.source === badgeDefinition) {
        return cachedBadge.value;
      }

      const image =
        badgeDefinition.images?.find((img) => img.scale === 3 && img?.url) ||
        badgeDefinition.images?.find((img) => img.scale === 2 && img?.url) ||
        badgeDefinition.images?.find((img) => img?.url) ||
        null;

      let imageUrl = image?.url ?? null;

      if (!imageUrl && badgeDefinition.image?.url) {
        imageUrl = badgeDefinition.image.url;
      }

      if (!imageUrl && Array.isArray(badgeDefinition.host?.files)) {
        const hostFile =
          badgeDefinition.host.files.find((file) => file.format === "WEBP" && file?.url) ||
          badgeDefinition.host.files[0];
        if (hostFile?.url) {
          imageUrl = hostFile.url;
        }
      }

      if (!imageUrl) {
        console.warn("[Cosmetics] badge definition missing image", {
          badgeId: badgeDefinition.id,
          badgeDefinition,
        });
        badgeCache.set(badgeDefinition.id, { source: badgeDefinition, value: null });
        return null;
      }

      const normalizedBadge = Object.freeze({
        id: badgeDefinition.id,
        type: badgeDefinition.id,
        title: badgeDefinition.tooltip ?? badgeDefinition.name,
        name: badgeDefinition.name,
        tooltip: badgeDefinition.tooltip ?? badgeDefinition.name,
        url: imageUrl,
      });

      badgeCache.set(badgeDefinition.id, { source: badgeDefinition, value: normalizedBadge });
      console.debug("[Cosmetics] normalized 7TV badge", {
        id: normalizedBadge.id,
        url: normalizedBadge.url,
        name: normalizedBadge.name,
      });
      return normalizedBadge;
    })();

    // Fallback for users with only color field (no paint_id)
    if (!paint && storedStyle.color && !storedStyle.paintId) {
      const convertColorToHex = (colorInt) => {
        if (colorInt == null) return null;
        const unsignedColor = (colorInt >>> 0) & 0xFFFFFF;
        return '#' + unsignedColor.toString(16).padStart(6, '0');
      };

      const colorHex = convertColorToHex(storedStyle.color);
      if (colorHex) {
        const cachedColor = colorCssCache.get(colorHex);
        if (cachedColor) {
          paint = cachedColor;
        } else {
          const colorPaint = Object.freeze({
            id: 'color',
            name: "7TV Color",
            backgroundImage: `linear-gradient(90deg, ${colorHex}, ${colorHex}99, ${colorHex})`,
            shadows: null,
          });
          colorCssCache.set(colorHex, colorPaint);
          paint = colorPaint;
        }
      }
    }

    return {
      badge,
      paint,
      color: storedStyle.color,
      username: storedStyle.username,
      stvUsername: storedStyle.stvUsername,
      badgeId: storedStyle.badgeId,
      paintId: storedStyle.paintId,
      userId: storedStyle.userId,
      kickUserId: storedStyle.kickUserId,
      updatedAt: storedStyle.updatedAt,
      noStyle: storedStyle.noStyle ?? false,
    };
  },

  loadGlobalCosmetics: async () => {
    if (get().cosmeticsLoaded) {
      console.debug("[Cosmetics] Global cosmetics already loaded");
      return;
    }

    if (globalCosmeticsPromise) {
      await globalCosmeticsPromise;
      return;
    }

    const stvApi = typeof window !== "undefined" ? window.app?.stv : null;
    if (!stvApi?.getAllPaints || !stvApi?.getAllBadges) {
      console.warn("[Cosmetics] 7TV API bridge missing getAllPaints/getAllBadges");
      return;
    }

    console.debug("[Cosmetics] Loading global cosmetics...");

    globalCosmeticsPromise = (async () => {
      try {
        const [paints, badges] = await Promise.all([
          stvApi.getAllPaints(),
          stvApi.getAllBadges()
        ]);

        paintCssCache.clear();
        badgeCache.clear();
        paintDefinitionMap = new Map(paints.map((paint) => [normalizeCosmeticId(paint.id) ?? paint.id, paint]));
        badgeDefinitionMap = new Map(badges.map((badge) => [normalizeCosmeticId(badge.id) ?? badge.id, badge]));

        set(() => ({
          globalCosmetics: {
            paints,
            badges,
          },
          cosmeticsLoaded: true,
        }));

        console.debug("[Cosmetics] Global cosmetics loaded", {
          badges: badges.length,
          paints: paints.length,
        });
      } catch (error) {
        console.error("[Cosmetics] Failed to load global cosmetics:", error?.message || error);
      } finally {
        globalCosmeticsPromise = null;
      }
    })();

    await globalCosmeticsPromise;
  },

  addCosmetics: (body) => {
    console.debug("[Cosmetics] received global cosmetics payload", {
      badges: body?.badges?.length,
      paints: body?.paints?.length,
    });

    const currentCosmetics = get().globalCosmetics ?? {};
    const paints = Array.isArray(body?.paints) ? body.paints : currentCosmetics.paints ?? [];
    const badges = Array.isArray(body?.badges) ? body.badges : currentCosmetics.badges ?? [];

    paintCssCache.clear();
    badgeCache.clear();
    paintDefinitionMap = new Map(paints.map((paint) => [normalizeCosmeticId(paint.id) ?? paint.id, paint]));
    badgeDefinitionMap = new Map(badges.map((badge) => [normalizeCosmeticId(badge.id) ?? badge.id, badge]));

    set(() => ({
      globalCosmetics: {
        paints,
        badges,
      },
    }));
  },

  ensureUserStyle: async (identity) => {
    if (!identity) return null;

    console.debug("[Cosmetics] ensureUserStyle called", {
      username: identity?.username,
      userId: identity?.userId ?? identity?.id
    });

    // Ensure global cosmetics are loaded first
    await get().loadGlobalCosmetics();

    const existingStyle = resolveStoredStyle(identity, get().userStyles);
    if (existingStyle?.badgeId || existingStyle?.paintId || existingStyle?.color || existingStyle?.noStyle) {
      console.debug("[Cosmetics] user style already cached", {
        username: identity?.username,
        userId: identity?.userId ?? identity?.id,
      });
      return existingStyle;
    }

    const { usernameKey, userIdKey } = deriveIdentityKeys(identity);
    const requestKey = userIdKey || usernameKey;
    if (!requestKey) return existingStyle;

    const resolvedNoStyle = get().resolvedNoStyle;
    if (
      (userIdKey && resolvedNoStyle.has(userIdKey)) ||
      (usernameKey && resolvedNoStyle.has(usernameKey))
    ) {
      console.debug("[Cosmetics] skipping 7TV lookup; user resolved without style", {
        usernameKey,
        userIdKey,
      });
      return existingStyle;
    }

    if (get().pendingRequests.has(requestKey)) {
      console.debug("[Cosmetics] request already in-flight", { requestKey });
      return existingStyle;
    }

    set((state) => {
      const nextPending = new Set(state.pendingRequests);
      nextPending.add(requestKey);
      return { pendingRequests: nextPending };
    });

    try {
      const stvApi = typeof window !== "undefined" ? window.app?.stv : null;
      if (!stvApi?.getUserCosmetics) {
        console.warn("[Cosmetics] 7TV API bridge missing getUserCosmetics");
        return existingStyle;
      }

      const normalizedUserId = normalizeUserId(identity?.userId ?? identity?.id);
      const response = await stvApi.getUserCosmetics({
        username: identity?.username ?? identity?.slug ?? identity?.displayName ?? null,
        userId: normalizedUserId
      });

      const userData = response?.user ?? response ?? null;

      if (!userData) {
        set((state) => {
          const nextResolved = new Set(state.resolvedNoStyle);
          if (usernameKey) nextResolved.add(usernameKey);
          if (userIdKey) nextResolved.add(userIdKey);
          return { resolvedNoStyle: nextResolved };
        });
        console.debug("[Cosmetics] 7TV lookup returned no data", {
          username: identity?.username,
          userId: normalizedUserId,
        });
        return existingStyle;
      }

      if (!userData?.style) {
        console.debug("[Cosmetics] user returned without style", {
          username: userData?.username ?? identity?.username,
          userId: normalizedUserId ?? userData?.id,
        });

        set((state) => {
          const nextResolved = new Set(state.resolvedNoStyle);
          if (usernameKey) nextResolved.add(usernameKey);
          if (userIdKey) nextResolved.add(userIdKey);
          return { resolvedNoStyle: nextResolved };
        });
        return existingStyle;
      }

      await get().addUserStyle(
        {
          username: userData?.username ?? identity?.username,
          userId: normalizedUserId ?? userData?.id,
        },
        { object: { user: userData } },
      );

      console.debug("[Cosmetics] user style hydrated from 7TV", {
        username: userData?.username ?? identity?.username,
        badgeId: userData?.style?.badge_id,
        paintId: userData?.style?.paint_id,
      });

      set((state) => {
        const nextResolved = new Set(state.resolvedNoStyle);
        if (usernameKey) nextResolved.delete(usernameKey);
        if (userIdKey) nextResolved.delete(userIdKey);
        return { resolvedNoStyle: nextResolved };
      });

      const hydratedStyle = resolveStoredStyle(identity, get().userStyles);

      console.debug("[Cosmetics] resolved hydrated style", {
        username: identity?.username,
        userId: identity?.userId ?? identity?.id,
        badgeResolved: Boolean(hydratedStyle?.badgeId),
        paintResolved: Boolean(hydratedStyle?.paintId),
      });

      return hydratedStyle;
    } catch (error) {
      console.error("[Cosmetics] Failed to fetch 7TV user style:", error?.message || error);
      if (error?.response?.status === 404) {
        set((state) => {
          const nextResolved = new Set(state.resolvedNoStyle);
          if (usernameKey) nextResolved.add(usernameKey);
          if (userIdKey) nextResolved.add(userIdKey);
          return { resolvedNoStyle: nextResolved };
        });
      }
      return existingStyle;
    } finally {
      set((state) => {
        const nextPending = new Set(state.pendingRequests);
        nextPending.delete(requestKey);
        return { pendingRequests: nextPending };
      });
    }
  },

  getUserBadge: (identity) => {
    const storedStyle = resolveStoredStyle(identity, get().userStyles);
    if (!storedStyle?.badgeId) return null;

    return get().globalCosmetics?.badges?.find((badge) => badge.id === storedStyle.badgeId) || null;
  },

  getUserPaint: (identity) => {
    const storedStyle = resolveStoredStyle(identity, get().userStyles);
    if (!storedStyle?.paintId) return null;

    return get().globalCosmetics?.paints?.find((paint) => paint.id === storedStyle.paintId) || null;
  },
}));

export default useCosmeticsStore;
