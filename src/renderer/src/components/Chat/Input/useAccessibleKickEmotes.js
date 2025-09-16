import { useMemo, useRef } from "react";
import useChatStore from "../../../providers/ChatProvider";
import { useShallow } from "zustand/react/shallow";
import { isEqual } from "lodash";

const normalizeSubscriptionStatus = (subscription) => {
  if (!subscription) return false;

  if (typeof subscription === "boolean") {
    return subscription;
  }

  if (typeof subscription === "string") {
    return subscription.toLowerCase() === "active" || subscription.toLowerCase() === "subscribed";
  }

  if (typeof subscription === "number") {
    return subscription > 0;
  }

  if (typeof subscription === "object") {
    if (typeof subscription.is_subscribed === "boolean") {
      return subscription.is_subscribed;
    }

    if (typeof subscription.active === "boolean") {
      return subscription.active;
    }

    if (typeof subscription.status === "string") {
      const normalized = subscription.status.toLowerCase();
      return normalized === "active" || normalized === "subscribed" || normalized === "renewed";
    }

    if (typeof subscription.state === "string") {
      const normalized = subscription.state.toLowerCase();
      return normalized === "active" || normalized === "subscribed";
    }

    if (typeof subscription.current_state === "string") {
      const normalized = subscription.current_state.toLowerCase();
      return normalized === "active" || normalized === "subscribed";
    }

    // Some Kick responses provide timestamps like `ends_at` when still active.
    if (subscription.ends_at) {
      const endsAt = new Date(subscription.ends_at);
      if (!Number.isNaN(endsAt.getTime())) {
        return endsAt.getTime() > Date.now();
      }
    }

    return false;
  }

  return false;
};

export const computeAccessibleKickEmotes = (chatrooms, activeChatroomId) => {
  if (!Array.isArray(chatrooms)) return [];

  const activeRoom = chatrooms.find((room) => room?.id === activeChatroomId);
  if (!activeRoom) return [];

  const currentChannelSections = [];
  const otherChannelSections = [];
  const globalSections = [];
  const emojiSections = [];
  const seenChannelKeys = new Set();

  const pushSet = (targetArray, room, set, overrides = {}) => {
    if (!set || !Array.isArray(set.emotes) || set.emotes.length === 0) {
      return;
    }

    const sectionKind = overrides.sectionKind || ((set.name || "").toLowerCase() === "channel_set" ? "channel" : "global");
    const sectionKey = overrides.sectionKey || `${sectionKind}:${room?.id ?? set.name ?? Math.random().toString(36).slice(2)}`;

    if (sectionKind === "channel" && seenChannelKeys.has(sectionKey)) {
      return;
    }

    const sectionLabel = overrides.sectionLabel ||
      (sectionKind === "channel"
        ? room?.displayName || room?.streamerData?.user?.username || set?.user?.username || "Channel Emotes"
        : set?.name || "Kick Emotes");

    const allowSubscriberEmotes =
      typeof overrides.allowSubscriberEmotes === "boolean"
        ? overrides.allowSubscriberEmotes
        : sectionKind !== "channel" || normalizeSubscriptionStatus(room?.userChatroomInfo?.subscription);

    const clonedSet = {
      ...set,
      emotes: (set.emotes || []).map((emote) => ({
        ...emote,
        __allowUse: !emote?.subscribers_only || allowSubscriberEmotes,
        __sectionKey: sectionKey,
        __sectionLabel: sectionLabel,
        __sectionKind: sectionKind,
        __sourceChatroomId: room?.id,
      })),
      sectionKey,
      sectionKind,
      sectionLabel,
      allowSubscriberEmotes,
      sourceChatroomId: room?.id,
      sourceChatroomSlug: room?.slug,
    };

    if (sectionKind === "channel") {
      seenChannelKeys.add(sectionKey);
      clonedSet.user = clonedSet.user || room?.streamerData?.user || null;
    }

    targetArray.push(clonedSet);
  };

  const activeSubscription = normalizeSubscriptionStatus(activeRoom?.userChatroomInfo?.subscription);

  (activeRoom?.emotes || []).forEach((set) => {
    const lowerName = (set?.name || "").toLowerCase();

    if (lowerName === "channel_set") {
      pushSet(currentChannelSections, activeRoom, set, {
        sectionKind: "channel",
        sectionKey: `channel:${activeRoom.id}`,
        allowSubscriberEmotes: activeSubscription,
        sectionLabel:
          activeRoom.displayName ||
          activeRoom?.streamerData?.user?.username ||
          set?.user?.username ||
          "Channel Emotes",
      });
      return;
    }

    if (lowerName === "emojis") {
      pushSet(emojiSections, activeRoom, set, {
        sectionKind: "emoji",
        sectionKey: `emoji:${lowerName}`,
        sectionLabel: set?.name || "Emojis",
        allowSubscriberEmotes: true,
      });
      return;
    }

    pushSet(globalSections, activeRoom, set, {
      sectionKind: "global",
      sectionKey: `global:${lowerName || set?.id || Math.random().toString(36).slice(2)}`,
      sectionLabel: set?.name || "Kick Emotes",
      allowSubscriberEmotes: true,
    });
  });

  chatrooms.forEach((room) => {
    if (!room || room.id === activeChatroomId) return;
    if (!normalizeSubscriptionStatus(room?.userChatroomInfo?.subscription)) return;

    const channelSet = (room.emotes || []).find((set) => (set?.name || "").toLowerCase() === "channel_set");
    if (!channelSet?.emotes?.length) return;

    pushSet(otherChannelSections, room, channelSet, {
      sectionKind: "channel",
      sectionKey: `channel:${room.id}`,
      sectionLabel:
        room.displayName ||
        room?.streamerData?.user?.username ||
        channelSet?.user?.username ||
        "Channel Emotes",
      allowSubscriberEmotes: true,
    });
  });

  return [...currentChannelSections, ...otherChannelSections, ...globalSections, ...emojiSections];
};

export const useAccessibleKickEmotes = (chatroomId) => {
  const chatrooms = useChatStore(useShallow((state) => state.chatrooms));
  const cacheRef = useRef({ chatroomId: null, chatrooms: null, result: null });

  return useMemo(() => {
    // Check if we can reuse the cached result with deep comparison
    if (
      cacheRef.current.chatroomId === chatroomId &&
      isEqual(cacheRef.current.chatrooms, chatrooms)
    ) {
      return cacheRef.current.result;
    }

    // Compute new result and cache it
    const result = computeAccessibleKickEmotes(chatrooms, chatroomId);
    cacheRef.current = { chatroomId, chatrooms, result };
    return result;
  }, [chatrooms, chatroomId]);
};

export { normalizeSubscriptionStatus as isKickSubscriptionActive };
