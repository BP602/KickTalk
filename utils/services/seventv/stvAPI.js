import axios from "axios";

const getPersonalEmoteSet = async (userId) => {
  const response = await axios.get(`https://7tv.io/v3/users/${userId}/emote-sets/personal`);
  return response.data;
};

const getChannelEmotes = async (channelId) => {
  console.log("[7tv Emotes] Fetching channel emotes for", channelId);
  let formattedGlobalEmotes;

  // Try to fetch channel emotes
  try {
    const globalResponse = await axios.get(`https://7tv.io/v3/emote-sets/global`);

    if (globalResponse.status !== 200) {
      throw new Error(`[7TV Emotes] Error while fetching Global Emotes. Status: ${globalResponse.status}`);
    }

    const emoteGlobalData = globalResponse?.data;

    if (emoteGlobalData) {
      formattedGlobalEmotes = [
        {
          setInfo: {
            id: emoteGlobalData.id,
            name: emoteGlobalData.name,
            emote_count: emoteGlobalData.emote_count,
            capacity: emoteGlobalData.capacity,
          },
          emotes: emoteGlobalData.emotes.map((emote) => {
            return {
              id: emote.id,
              actor_id: emote.actor_id,
              flags: emote.flags,
              name: emote.name,
              alias: emote.data.name !== emote.name ? emote.data.name : null,
              owner: emote.data.owner,
              file: emote.data.host.files?.[0] || emote.data.host.files?.[1],
              added_timestamp: emote.timestamp,
              platform: "7tv",
              type: "global",
            };
          }),
          type: "global",
        },
      ];
    }

    // [7TV] Fetch channel emotes
    const channelResponse = await axios.get(`https://7tv.io/v3/users/kick/${channelId}`);
    if (channelResponse?.status !== 200 || !channelResponse?.data?.emote_set?.emotes) return formattedGlobalEmotes;

    const emoteSetData = channelResponse.data?.emote_set;
    const emotes = emoteSetData?.emotes;
    if (!emotes) return formattedGlobalEmotes;

    const emoteChannelData = emotes?.map((emote) => {
      return {
        id: emote.id,
        actor_id: emote.actor_id,
        flags: emote.flags,
        name: emote.name,
        alias: emote.data.name !== emote.name ? emote.data.name : null,
        owner: emote.data.owner,
        file: emote.data.host.files?.[0] || emote.data.host.files?.[1],
        added_timestamp: emote.timestamp,
        platform: "7tv",
        type: "channel",
      };
    });

    console.log("[7tv Emotes] Successfully fetched channel and global emotes");

    const channelFormattedSets = [
      ...formattedGlobalEmotes,
      {
        setInfo: {
          id: emoteSetData.id,
          name: emoteSetData.name,
          owner: emoteSetData.owner,
          emote_count: emoteSetData?.emote_count,
          capacity: emoteSetData?.capacity,
        },
        user: channelResponse?.data?.user,
        emotes: emoteChannelData,
        type: "channel",
      },
    ];

    console.log("[7TV Emotes] Channel Formatted Sets:", channelFormattedSets);

    return channelFormattedSets;
  } catch (error) {
    console.error("[7TV Emotes] Error fetching channel emotes:", error.message);
    return formattedGlobalEmotes || [];
  }
};

// Helper function to get full user profile with cosmetics by 7TV user ID
const getUserCosmeticsById = async (stvUserId) => {
  try {
    const response = await axios.get(`https://7tv.io/v3/users/${stvUserId}`);
    if (response?.data?.style) {
      console.log(`[7TV Cosmetics] Found cosmetics for 7TV user: ${stvUserId}`);
      console.log(`[7TV Cosmetics] Style data:`, response.data.style);
      console.log(`[7TV Cosmetics] Username:`, response.data.username);
      // Wrap in expected structure for CosmeticsProvider
      return { user: response.data };
    }
  } catch (error) {
    console.error(`[7TV Cosmetics] Error getting cosmetics for ${stvUserId}:`, error?.message || error);
  }
  return null;
};

const getUserCosmetics = async ({ userId, username }) => {
  if (!userId && !username) {
    return null;
  }

  // Helper function to get 7TV user ID from Kick connection using REST API
  const get7TVUserIdFromKick = async (kickIdentifier) => {
    try {
      console.log(`[7TV Cosmetics] Looking up 7TV user via REST API for Kick: ${kickIdentifier}`);

      // Try the v3 REST API endpoint for kick connections
      const response = await axios.get(`https://7tv.io/v3/users/kick/${kickIdentifier}`);

      if (response?.data?.user?.id) {
        console.log(`[7TV Cosmetics] Found 7TV user ID: ${response.data.user.id} for Kick: ${kickIdentifier}`);
        return response.data.user.id;
      }
    } catch (error) {
      console.error(`[7TV Cosmetics] REST API lookup error for ${kickIdentifier}:`, error?.message || error);
    }

    return null;
  };


  // Primary strategy: Use userId if available (most reliable)
  if (userId) {
    console.log(`[7TV Cosmetics] Trying userId: ${userId}`);
    const stvUserId = await get7TVUserIdFromKick(userId);
    if (stvUserId) {
      const cosmetics = await getUserCosmeticsById(stvUserId);
      if (cosmetics) {
        return cosmetics;
      }
      console.log(`[7TV Cosmetics] No cosmetics for 7TV user id ${stvUserId}, will try username next if available`);
    } else {
      console.log(`[7TV Cosmetics] Kick userId lookup failed, will try username next if available`);
    }
  }

  // Fallback: Try username if provided (even if userId lookup failed)
  if (username) {
    console.log(`[7TV Cosmetics] Trying username fallback: ${username}`);
    const stvUserId = await get7TVUserIdFromKick(username);
    if (stvUserId) {
      const cosmetics = await getUserCosmeticsById(stvUserId);
      if (cosmetics) {
        return cosmetics;
      }
    }
  }

  console.log(`[7TV Cosmetics] No cosmetics found for user: ${username} (${userId})`);
  return null;
};

const getAllPaints = async () => {
  try {
    console.log("[7TV Cosmetics] Loading all paint definitions...");

    const paintQuery = `
      query GetAllPaints {
        paints {
          paints {
            id
            name
            data {
              layers {
                id
                opacity
                ty {
                  ... on PaintLayerTypeRadialGradient {
                    stops {
                      at
                      color {
                        hex
                        r
                        g
                        b
                        a
                      }
                    }
                    shape
                  }
                  ... on PaintLayerTypeLinearGradient {
                    angle
                    stops {
                      at
                      color {
                        hex
                        r
                        g
                        b
                        a
                      }
                    }
                  }
                  ... on PaintLayerTypeSingleColor {
                    color {
                      hex
                      r
                      g
                      b
                      a
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await axios.post(
      "https://7tv.io/v4/gql",
      {
        query: paintQuery,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (response?.data?.data?.paints?.paints) {
      const paints = response.data.data.paints.paints;
      console.log(`[7TV Cosmetics] Loaded ${paints.length} paint definitions`);
      return paints;
    }

    return [];
  } catch (error) {
    console.error("[7TV Cosmetics] Error loading paint definitions:", error?.message || error);
    return [];
  }
};

const getAllBadges = async () => {
  try {
    console.log("[7TV Cosmetics] Loading all badge definitions...");

    const badgeQuery = `
      query GetAllBadges {
        badges {
          badges {
            id
            name
            description
            images {
              url
              mime
              size
              scale
              width
              height
            }
          }
        }
      }
    `;

    const response = await axios.post(
      "https://7tv.io/v4/gql",
      {
        query: badgeQuery,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (response?.data?.data?.badges?.badges) {
      const badges = response.data.data.badges.badges;
      console.log(`[7TV Cosmetics] Loaded ${badges.length} badge definitions`);
      return badges;
    }

    return [];
  } catch (error) {
    console.error("[7TV Cosmetics] Error loading badge definitions:", error?.message || error);
    return [];
  }
};

const sendUserPresence = async (stvId, userId) => {
  try {
    const response = await axios.post(
      `https://7tv.io/v3/users/${stvId}/presences`,
      {
        kind: 1,
        passive: true,
        session_id: undefined,
        data: {
          platform: "KICK",
          id: `${userId}`,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (response.status !== 200) {
      throw new Error(`[7TV Emotes] Error while sending user presence: ${response.status}`);
    }

    return response.data;
  } catch (error) {
    console.error("[7TV Emotes] Error while sending user presence:", error.message);
  }
};

const getUserStvProfile = async (platformId) => {
  try {
    const getUserByConnectionQuery = `
    query GetUserProfile {
      users {
        userByConnection(platform: KICK, platformId: "${platformId}") {
          id
          emoteSets {
            id
            name
            capacity
            description
            ownerId
            kind
            emotes {
              items {
                id
                alias
                addedAt
                addedById
                originSetId
                emote {
                  id
                  ownerId
                  defaultName
                  tags
                  aspectRatio
                  deleted
                  updatedAt
                  owner {
                    id
                    stripeCustomerId
                    updatedAt
                    searchUpdatedAt
                    highestRoleRank
                    roleIds
                  }
                  images {
                    url
                    mime
                    size
                    scale
                    width
                    height
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
    // End of Selection
    const response = await axios.post(
      "https://7tv.io/v4/gql",
      {
        query: getUserByConnectionQuery,
        variables: { platformId: `${platformId}` },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (response.status !== 200) {
      throw new Error(`[7TV Emotes] Error while fetching user STV ID: ${response.status}`);
    }

    const data = response?.data?.data?.users?.userByConnection;
    if (!data?.id) return null;
    if (!data?.emoteSets) {
      return {
        user_id: data?.id,
        emoteSets: [],
      };
    }

    const transformedEmoteSets = data?.emoteSets?.map((set) => {
      return {
        setInfo: {
          id: set.id,
          name: set.name,
          emote_count: set.emotes?.items?.length,
          capacity: set.capacity,
        },
        emotes: set?.emotes?.items?.map((emote) => {
          const image = emote.emote.images?.[0];
          return {
            id: emote.id,
            actor_id: emote.addedById,
            flags: emote.emote.flags,
            name: emote.alias,
            alias: emote.emote.defaultName !== emote.alias ? emote.emote.defaultName : null,
            owner: emote.emote.owner,
            file: {
              name: image?.mime.split("/")[1],
              static_name: image?.mime.split("/")[1].replace(".webp", "_static.webp"),
              width: image?.width,
              height: image?.height,
              frame_count: image?.frameCount,
              size: image?.size,
              url: image?.url,
            },
            added_timestamp: new Date(emote.addedAt).getTime(),
            platform: "7tv",
            type: set.kind.toLowerCase(),
          };
        }),
        type: set.kind.toLowerCase(),
      };
    });

    return {
      user_id: data?.id,
      emoteSets: transformedEmoteSets,
    };
  } catch (error) {
    console.error("[7TV Emotes] Error while fetching user STV ID:", error.message);
  }
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const toColorString = (color, layerOpacity = 1) => {
  if (!color) return null;

  if (typeof color === "string") {
    return color;
  }

  if (color.hex) {
    // The API already encodes alpha into the hex value when available (#RRGGBBAA)
    return color.hex;
  }

  const r = Number.isFinite(color.r) ? clamp(Math.round(color.r), 0, 255) : null;
  const g = Number.isFinite(color.g) ? clamp(Math.round(color.g), 0, 255) : null;
  const b = Number.isFinite(color.b) ? clamp(Math.round(color.b), 0, 255) : null;

  if ([r, g, b].some((value) => value === null)) {
    return null;
  }

  const baseAlpha = Number.isFinite(color.a) ? clamp(color.a, 0, 1) : 1;
  const alpha = clamp(baseAlpha * layerOpacity, 0, 1);

  if (alpha >= 1) {
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Trim trailing zeros for cleaner CSS
  const alphaString = Number(alpha.toFixed(3)).toString();
  return `rgba(${r}, ${g}, ${b}, ${alphaString})`;
};

const makeGradientStops = (stops = [], layerOpacity = 1) => {
  return stops
    .map((stop) => {
      const color = toColorString(stop?.color, layerOpacity);
      if (!color) return null;

      if (typeof stop?.at === "number") {
        const percentage = clamp(Math.round(stop.at * 100), 0, 100);
        return `${color} ${percentage}%`;
      }

      return color;
    })
    .filter(Boolean)
    .join(", ");
};

const convertLayerToBackground = (layer) => {
  if (!layer?.ty) return null;

  const { ty } = layer;
  const layerOpacity = "opacity" in layer ? clamp(layer.opacity ?? 1, 0, 1) : 1;

  // Gradients with stops
  if (Array.isArray(ty.stops) && ty.stops.length) {
    const stops = makeGradientStops(ty.stops, layerOpacity);
    if (!stops) return null;

    if (ty.shape) {
      const shape = String(ty.shape || "ellipse").toLowerCase();
      return `radial-gradient(${shape}, ${stops})`;
    }

    const angle = Number.isFinite(ty.angle) ? `${ty.angle}deg` : "180deg";
    return `linear-gradient(${angle}, ${stops})`;
  }

  // Solid color layer
  if (ty.color) {
    const color = toColorString(ty.color, layerOpacity);
    if (color) {
      return color;
    }
  }

  // Image layers
  const imageUrl = ty?.image?.url || ty?.url;
  if (imageUrl) {
    const parts = [`url(${imageUrl})`];

    if (ty.size) {
      parts.push(`/ ${ty.size}`);
    }

    if (ty.position) {
      parts.push(` ${ty.position}`);
    }

    if (ty.repeat) {
      parts.push(` ${ty.repeat}`);
    }

    return parts.join("");
  }

  return null;
};

const convertShadowsToCSS = (shadows = []) => {
  const cssShadows = shadows
    .map((shadow) => {
      if (!shadow) return null;

      const color = toColorString(shadow.color, shadow.opacity ?? 1);
      if (!color) return null;

      const offsetX = Number.isFinite(shadow.x_offset) ? `${shadow.x_offset}px` : "0px";
      const offsetY = Number.isFinite(shadow.y_offset) ? `${shadow.y_offset}px` : "0px";
      const blur = Number.isFinite(shadow.blur) ? `${shadow.blur}px` : "0px";

      return `drop-shadow(${offsetX} ${offsetY} ${blur} ${color})`;
    })
    .filter(Boolean);

  return cssShadows.length ? cssShadows.join(" ") : null;
};

// Convert 7TV paint definition to CSS background-image
const convertPaintToCSS = (paintDefinition) => {
  const layers = paintDefinition?.data?.layers;
  if (!Array.isArray(layers) || layers.length === 0) {
    return null;
  }

  const backgrounds = layers.map(convertLayerToBackground).filter(Boolean);
  if (!backgrounds.length) {
    return null;
  }

  // CSS paints the first background on top; reverse to maintain the 7TV layer ordering
  const backgroundImage = backgrounds.reverse().join(", ");
  const boxShadow = convertShadowsToCSS(paintDefinition?.data?.shadows);

  return {
    backgroundImage,
    boxShadow,
  };
};

export { getChannelEmotes, sendUserPresence, getUserStvProfile, getUserCosmetics, getUserCosmeticsById, getAllPaints, getAllBadges, convertPaintToCSS };
