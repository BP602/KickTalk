import { create } from "zustand";

const normalizeUsername = (username) => {
  if (!username || typeof username !== "string") return null;
  return username.replaceAll("-", "_").toLowerCase();
};

const useCosmeticsStore = create((set, get) => ({
  userStyles: {},
  globalCosmetics: {
    badges: [],
    paints: [],
  },

  addUserStyle: async (username, body) => {
    const userStyle = body?.object?.user;
    const style = userStyle?.style;
    if (!style) return;

    const fallbackUsername = username || userStyle?.username || userStyle?.display_name;
    const transformedUsername = normalizeUsername(fallbackUsername);
    if (!transformedUsername) return;

    set((state) => {
      const currentStyle = state.userStyles[transformedUsername] || {};
      if (
        currentStyle.badgeId === style.badge_id &&
        currentStyle.paintId === style.paint_id &&
        currentStyle.color === style.color
      ) {
        return state;
      }

      return {
        userStyles: {
          ...state.userStyles,
          [transformedUsername]: {
            badgeId: style.badge_id,
            paintId: style.paint_id,
            color: style.color,
            kickConnection: userStyle.connections?.find((c) => c.type === "KICK" || c.platform === "KICK"),
            entitlement: body,
            userId: userStyle.id,
            username: userStyle.username,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  },

  getUserStyle: (username) => {
    const transformedUsername = normalizeUsername(username);
    if (!transformedUsername) return null;
    const userStyle = get().userStyles[transformedUsername];

    if (!userStyle?.badgeId && !userStyle?.paintId) return null;

    const badge = get().globalCosmetics?.badges?.find((b) => b.id === userStyle.badgeId);
    const paint = get().globalCosmetics?.paints?.find((p) => p.id === userStyle.paintId);

    return {
      badge,
      paint,
      color: userStyle.color,
      username: userStyle.username,
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

  getUserBadge: (username) => {
    const transformedUsername = normalizeUsername(username);
    if (!transformedUsername) return null;

    const userStyle = get().userStyles[transformedUsername];
    if (!userStyle?.badgeId) return null;

    return get().globalCosmetics?.badges?.find((badge) => badge.id === userStyle.badgeId) || null;
  },

  getUserPaint: (username) => {
    const transformedUsername = normalizeUsername(username);
    if (!transformedUsername) return null;

    const userStyle = get().userStyles[transformedUsername];
    if (!userStyle?.paintId) return null;

    return get().globalCosmetics?.paints?.find((paint) => paint.id === userStyle.paintId) || null;
  },
}));

export default useCosmeticsStore;
