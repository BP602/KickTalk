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

const getChannelCosmetics = async (channelId) => {
  try {
    console.log("[7TV Cosmetics] Fetching global cosmetics catalog");

    // Fetch the global cosmetics catalog using v2 API (v3 removed cosmetics endpoints)
    // This provides the base catalog of badges and paints that WebSocket events reference
    const response = await axios.get(`https://api.7tv.app/v2/cosmetics`);

    if (response.status !== 200 || !response.data) {
      console.warn("[7TV Cosmetics] Failed to fetch cosmetics:", response.status);
      return { badges: [], paints: [] };
    }

    const cosmeticsData = response.data;
    const cosmetics = { badges: [], paints: [] };

    // Process badges from v2 API response
    if (cosmeticsData.badges?.length) {
      cosmetics.badges = cosmeticsData.badges.map(badge => ({
        id: badge.id,
        title: badge.tooltip || badge.name,
        url: `https:${badge.urls?.[badge.urls.length - 1] || badge.urls?.[0]}`,
      }));
      console.log(`[7TV Cosmetics] Loaded ${cosmetics.badges.length} badges`);
    }

    // Process paints from v2 API response
    if (cosmeticsData.paints?.length) {
      cosmetics.paints = cosmeticsData.paints.map(paint => {
        const randomColor = "#00f742";
        let paintObject = {};

        if (paint.data?.stops?.length) {
          const normalizedColors = paint.data.stops.map((stop) => ({
            at: stop.at * 100,
            color: stop.color,
          }));

          const gradient = normalizedColors.map((stop) => `${argbToRgba(stop.color)} ${stop.at}%`).join(", ");

          let paintFunction = paint.data.function?.toLowerCase().replace("_", "-");
          if (paint.data.repeat) {
            paintFunction = `repeating-${paintFunction}`;
          }

          let isDeg_or_Shape = `${paint.data.angle}deg`;
          if (paintFunction !== "linear-gradient" && paintFunction !== "repeating-linear-gradient") {
            isDeg_or_Shape = paint.data.shape;
          }

          paintObject = {
            id: paint.id,
            name: paint.data.name,
            style: paint.data.function,
            shape: paint.data.shape,
            backgroundImage: `${paintFunction || "linear-gradient"}(${isDeg_or_Shape}, ${gradient})` ||
              `${paint.data.style || "linear-gradient"}(${paint.data.shape || ""} 0deg, ${randomColor}, ${randomColor})`,
            shadows: null,
            KIND: "non-animated",
            url: paint.data.image_url,
          };
        } else {
          paintObject = {
            id: paint.id,
            name: paint.data.name,
            style: paint.data.function,
            shape: paint.data.shape,
            backgroundImage: `url('${paint.data.image_url}')` ||
              `${paint.data.style || "linear-gradient"}(${paint.data.shape || ""} 0deg, ${randomColor}, ${randomColor})`,
            shadows: null,
            KIND: "animated",
            url: paint.data.image_url,
          };
        }

        // Process shadows if present
        if (paint.data.shadows?.length) {
          const shadow = paint.data.shadows
            .map((shadow) => {
              let rgbaColor = argbToRgba(shadow.color);
              rgbaColor = rgbaColor.replace(/rgba\((\d+), (\d+), (\d+), (\d+(\.\d+)?)\)/, `rgba($1, $2, $3)`);
              return `drop-shadow(${rgbaColor} ${shadow.x_offset}px ${shadow.y_offset}px ${shadow.radius}px)`;
            })
            .join(" ");
          paintObject.shadows = shadow;
        }

        return paintObject;
      });
      console.log(`[7TV Cosmetics] Loaded ${cosmetics.paints.length} paints`);
    }

    console.log("[7TV Cosmetics] Total cosmetics loaded:", {
      badges: cosmetics.badges.length,
      paints: cosmetics.paints.length
    });

    return cosmetics;
  } catch (error) {
    console.error("[7TV Cosmetics] Error fetching cosmetics:", error.message);
    return { badges: [], paints: [] };
  }
};

// Helper function to convert ARGB to RGBA
const argbToRgba = (color) => {
  if (color < 0) {
    color = color >>> 0;
  }

  const red = (color >> 24) & 0xff;
  const green = (color >> 16) & 0xff;
  const blue = (color >> 8) & 0xff;
  return `rgba(${red}, ${green}, ${blue}, 1)`;
};

export { getChannelEmotes, sendUserPresence, getUserStvProfile, getChannelCosmetics };
