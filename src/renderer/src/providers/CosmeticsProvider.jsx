import { create } from "zustand";

const useCosmeticsStore = create((set, get) => ({
  userStyles: {},
  globalCosmetics: {
    badges: [],
    paints: [],
  },

  addUserStyle: async (username, body) => {
    console.log(`[CosmeticsStore DIAGNOSTIC] addUserStyle called`, {
      username,
      hasBody: !!body,
      hasUserStyle: !!body?.object?.user?.style,
      objectKind: body?.object?.kind,
      bodyKeys: Object.keys(body || {}),
      objectKeys: Object.keys(body?.object || {}),
      userKeys: Object.keys(body?.object?.user || {}),
      fullBody: body
    });

    if (!body?.object?.user?.style) {
      console.log(`[CosmeticsStore DIAGNOSTIC] No user style found in body, returning early`, {
        hasObject: !!body?.object,
        hasUser: !!body?.object?.user,
        hasStyle: !!body?.object?.user?.style,
        userObject: body?.object?.user
      });
      return;
    }

    const transformedUsername = username.toLowerCase();
    const userStyle = body.object.user;

    console.log(
      `[CosmeticsStore DIAGNOSTIC] Upserting style for ${transformedUsername}`,
      {
        badgeId: userStyle?.style?.badge_id,
        paintId: userStyle?.style?.paint_id,
        entitlementId: body?.object?.id,
        userStyleObject: userStyle?.style,
        connections: userStyle?.connections
      },
    );

    set((state) => {
      const currentStyle = state.userStyles[transformedUsername] || {};
      const newBadgeId = body.object.user.style.badge_id;
      const newPaintId = body.object.user.style.paint_id;

      if (currentStyle.badgeId === newBadgeId && currentStyle.paintId === newPaintId) {
        return state; // Skip duplicate style update
      }

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

  removeUserStyle: async (username, body) => {
    console.log(`[CosmeticsStore DIAGNOSTIC] removeUserStyle called`, {
      username,
      hasBody: !!body,
      refId: body?.object?.ref_id,
      kind: body?.object?.kind,
      fullBody: body
    });

    const transformedUsername = username.toLowerCase();
    const refId = body?.object?.ref_id;
    const kind = body?.object?.kind;

    if (!refId || !kind) {
      console.log(`[CosmeticsStore DIAGNOSTIC] Missing ref_id or kind in entitlement.delete`, {
        refId,
        kind
      });
      return;
    }

    console.log(
      `[CosmeticsStore DIAGNOSTIC] Removing ${kind} entitlement for ${transformedUsername}`,
      {
        refId,
        kind
      }
    );

    set((state) => {
      const currentStyle = state.userStyles[transformedUsername];
      if (!currentStyle) {
        console.log(`[CosmeticsStore DIAGNOSTIC] No existing style for ${transformedUsername}, nothing to remove`);
        return state;
      }

      // Based on Chatterino spec: remove by kind and ref_id
      let updatedStyle = { ...currentStyle };
      let hasChanges = false;

      if (kind === "BADGE" && currentStyle.badgeId === refId) {
        updatedStyle.badgeId = null;
        hasChanges = true;
        console.log(`[CosmeticsStore DIAGNOSTIC] Removed badge ${refId} from ${transformedUsername}`);
      } else if (kind === "PAINT" && currentStyle.paintId === refId) {
        updatedStyle.paintId = null;
        hasChanges = true;
        console.log(`[CosmeticsStore DIAGNOSTIC] Removed paint ${refId} from ${transformedUsername}`);
      }

      if (!hasChanges) {
        console.log(`[CosmeticsStore DIAGNOSTIC] No matching ${kind} with ref_id ${refId} found for ${transformedUsername}`);
        return state;
      }

      // If both badge and paint are removed, remove the entire user style entry
      if (!updatedStyle.badgeId && !updatedStyle.paintId) {
        const { [transformedUsername]: removed, ...restUserStyles } = state.userStyles;
        console.log(`[CosmeticsStore DIAGNOSTIC] Removed entire user style for ${transformedUsername} (no remaining cosmetics)`);
        return {
          userStyles: restUserStyles,
        };
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
    if (!username) {
      console.log(`[CosmeticsStore DIAGNOSTIC] getUserStyle called with empty username`);
      return null;
    }

    const transformedUsername = username.toLowerCase();

    // Track call frequency for debugging
    if (!window.__getUserStyleCalls) window.__getUserStyleCalls = new Map();
    const now = Date.now();
    const lastCall = window.__getUserStyleCalls.get(transformedUsername) || 0;
    const timeSinceLastCall = now - lastCall;
    window.__getUserStyleCalls.set(transformedUsername, now);

    if (timeSinceLastCall < 100) { // Less than 100ms since last call
      console.warn(`[CosmeticsStore WARNING] getUserStyle called for ${transformedUsername} only ${timeSinceLastCall}ms ago - possible render loop!`);
    }
    const userStyle = get().userStyles[transformedUsername];
    const globalCosmetics = get().globalCosmetics;

    console.log(`[CosmeticsStore DIAGNOSTIC] getUserStyle for ${transformedUsername}`, {
      hasUserStyle: !!userStyle,
      userStyleBadgeId: userStyle?.badgeId,
      userStylePaintId: userStyle?.paintId,
      totalBadges: globalCosmetics?.badges?.length,
      totalPaints: globalCosmetics?.paints?.length,
      userStyleObject: userStyle,
      callStack: new Error().stack?.split('\n').slice(1, 6).join('\n') // Show top 5 stack frames
    });

    if (!userStyle?.badgeId && !userStyle?.paintId) {
      console.log(`[CosmeticsStore DIAGNOSTIC] No badge or paint for ${transformedUsername}`);
      return null;
    }

    const badge = globalCosmetics?.badges?.find((b) => b.id === userStyle.badgeId);
    const paint = globalCosmetics?.paints?.find((p) => p.id === userStyle.paintId);

    console.log(`[CosmeticsStore DIAGNOSTIC] Found cosmetics for ${transformedUsername}`, {
      foundBadge: !!badge,
      foundPaint: !!paint,
      badgeId: userStyle.badgeId,
      paintId: userStyle.paintId,
      badge: badge,
      paint: paint
    });

    return {
      badge,
      paint,
      color: userStyle.color,
      username: userStyle.username,
    };
  },

  addCosmetics: (body) => {
    console.log(`[CosmeticsStore DIAGNOSTIC] addCosmetics called`, {
      hasBody: !!body,
      badges: body?.badges?.length,
      paints: body?.paints?.length,
      bodyKeys: Object.keys(body || {}),
      firstBadge: body?.badges?.[0],
      firstPaint: body?.paints?.[0]
    });

    const currentState = get();
    console.log(`[CosmeticsStore DIAGNOSTIC] Current state before update`, {
      currentBadges: currentState.globalCosmetics?.badges?.length,
      currentPaints: currentState.globalCosmetics?.paints?.length
    });

    set((state) => {
      const newState = {
        globalCosmetics: {
          ...body,
        },
      };

      console.log(`[CosmeticsStore DIAGNOSTIC] State updated`, {
        newBadges: newState.globalCosmetics?.badges?.length,
        newPaints: newState.globalCosmetics?.paints?.length,
        previousBadges: state.globalCosmetics?.badges?.length,
        previousPaints: state.globalCosmetics?.paints?.length
      });

      return newState;
    });
  },

  getUserBadge: (username) => {
    const transformedUsername = username.toLowerCase();

    const userStyle = get().userStyles[transformedUsername];
    if (!userStyle?.badgeId) return null;

    return get().globalCosmetics[userStyle.badgeId];
  },

  getUserPaint: (username) => {
    const transformedUsername = username.toLowerCase();

    const userStyle = get().userStyles[transformedUsername];
    if (!userStyle?.paintId) return null;

    return get().globalCosmetics[userStyle.paintId];
  },

  // TEST FUNCTION: Simulate receiving cosmetics to verify the store works
  testCosmetics: () => {
    console.log(`[CosmeticsStore TEST] Simulating cosmetic events...`);

    // Simulate cosmetic.create event
    const testCosmetics = {
      badges: [
        {
          id: "test-badge-1",
          title: "Test Badge",
          url: "https://cdn.7tv.app/badge/test/1x.webp"
        }
      ],
      paints: [
        {
          id: "test-paint-1",
          name: "Test Paint",
          backgroundImage: "linear-gradient(45deg, #ff0000, #00ff00)",
          KIND: "non-animated"
        }
      ]
    };

    get().addCosmetics(testCosmetics);

    // Simulate entitlement.create event
    const testEntitlement = {
      object: {
        kind: "ENTITLEMENT",
        id: "test-entitlement-1",
        user: {
          id: "test-user-id",
          username: "testuser",
          style: {
            badge_id: "test-badge-1",
            paint_id: "test-paint-1",
            color: -1
          },
          connections: [
            {
              platform: "KICK",
              username: "testuser"
            }
          ]
        }
      }
    };

    get().addUserStyle("testuser", testEntitlement);

    console.log(`[CosmeticsStore TEST] Test complete. Try getUserStyle('testuser')`);
  },
}));

// Expose test function globally for debugging
if (typeof window !== 'undefined') {
  window.testCosmeticsStore = () => {
    console.log(`[TEST] Starting cosmetics test...`);
    const store = useCosmeticsStore.getState();
    console.log(`[TEST] Got store:`, !!store);
    store.testCosmetics();

    // Also test retrieval
    setTimeout(() => {
      const result = store.getUserStyle('testuser');
      console.log(`[CosmeticsStore TEST] getUserStyle result:`, result);
    }, 100);
  };

  // Also expose the store itself for direct testing
  window.cosmeticsStore = useCosmeticsStore;
  console.log(`[CosmeticsProvider] Exposed window.testCosmeticsStore() and window.cosmeticsStore`);
}

export default useCosmeticsStore;
