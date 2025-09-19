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

  addUserStyle: async (identity, body) => {
    const userStyle = body?.object?.user;
    const style = userStyle?.style;
    if (!style) return;

    const { username: providedUsername, userId: providedUserId } = extractIdentityFields(identity);
    const kickConnection = Array.isArray(userStyle?.connections)
      ? userStyle.connections.find(isKickConnection)
      : null;

    const fallbackUsername =
      providedUsername ??
      kickConnection?.username ??
      userStyle?.username ??
      userStyle?.display_name;
    const usernameKey = normalizeUsername(fallbackUsername);

    const resolvedKickUserId =
      providedUserId ??
      kickConnection?.id ??
      kickConnection?.user_id ??
      kickConnection?.userId ??
      kickConnection?.platform_id ??
      kickConnection?.platformId ??
      kickConnection?.external_id ??
      kickConnection?.externalId ??
      null;
    const userIdKey = createUserIdKey(resolvedKickUserId);

    if (!usernameKey && !userIdKey) return;

    set((state) => {
      const existingStyle =
        (userIdKey && state.userStyles[userIdKey]) ||
        (usernameKey && state.userStyles[usernameKey]) ||
        null;
      const hasUsernameMapping = usernameKey ? Boolean(state.userStyles[usernameKey]) : false;
      const hasIdMapping = userIdKey ? Boolean(state.userStyles[userIdKey]) : false;

      if (
        existingStyle &&
        existingStyle.badgeId === style.badge_id &&
        existingStyle.paintId === style.paint_id &&
        existingStyle.color === style.color &&
        (!usernameKey || hasUsernameMapping) &&
        (!userIdKey || hasIdMapping)
      ) {
        return state;
      }

      const styleRecord = {
        badgeId: style.badge_id,
        paintId: style.paint_id,
        color: style.color,
        kickConnection,
        entitlement: body,
        userId: userStyle.id,
        kickUserId: normalizeUserId(resolvedKickUserId),
        username: fallbackUsername ?? userStyle.username,
        stvUsername: userStyle.username,
        updatedAt: new Date().toISOString(),
      };

      const updatedStyles = { ...state.userStyles };
      if (usernameKey) {
        updatedStyles[usernameKey] = styleRecord;
      }
      if (userIdKey) {
        updatedStyles[userIdKey] = styleRecord;
      }

      return { userStyles: updatedStyles };
    });
  },

  getUserStyle: (identity) => {
    const storedStyle = resolveStoredStyle(identity, get().userStyles);
    if (!storedStyle?.badgeId && !storedStyle?.paintId) return null;

    const badge = get().globalCosmetics?.badges?.find((b) => b.id === storedStyle.badgeId);
    const paint = get().globalCosmetics?.paints?.find((p) => p.id === storedStyle.paintId);

    return {
      badge,
      paint,
      color: storedStyle.color,
      username: storedStyle.username,
      stvUsername: storedStyle.stvUsername,
      badgeId: storedStyle.badgeId,
      paintId: storedStyle.paintId,
      kickConnection: storedStyle.kickConnection,
      entitlement: storedStyle.entitlement,
      userId: storedStyle.userId,
      kickUserId: storedStyle.kickUserId,
      updatedAt: storedStyle.updatedAt,
    };
  },

  addCosmetics: (body) => {
    set(() => {
      const newState = {
        globalCosmetics: {
          ...body,
        },
      };

      return newState;
    });
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
