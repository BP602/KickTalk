import { create } from "zustand";

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

  addCosmetics: (body) => {
    set(() => {
      // Create lookup maps for O(1) access
      const badgeMap = new Map();
      const paintMap = new Map();

      if (body.badges) {
        body.badges.forEach(badge => {
          badgeMap.set(badge.id, badge);
        });
      }

      if (body.paints) {
        body.paints.forEach(paint => {
          paintMap.set(paint.id, paint);
        });
      }

      const newState = {
        globalCosmetics: {
          ...body,
        },
        cosmeticsLookup: {
          badgeMap,
          paintMap,
        },
      };

      return newState;
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
