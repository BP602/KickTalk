import { useMemo, useRef } from "react";
import useChatStore from "../../../providers/ChatProvider";
import { useShallow } from "zustand/react/shallow";
import { isEqual } from "lodash";

/**
 * Shared hook for combining channel7TVEmotes and personalEmoteSets with deep comparison memoization.
 * This prevents unnecessary re-renders when the emote sets have the same data but different object references.
 *
 * @param {number} chatroomId - The chatroom ID to get channel emotes for
 * @returns {Array} Combined array of channel and personal 7TV emote sets (channel emotes first)
 */
export const useAllStvEmotes = (chatroomId) => {
  const personalEmoteSets = useChatStore(useShallow((state) => state.personalEmoteSets));
  const channel7TVEmotes = useChatStore(
    useShallow((state) => state.chatrooms.find((room) => room.id === chatroomId)?.channel7TVEmotes)
  );

  const cacheRef = useRef({
    personalEmoteSets: null,
    channel7TVEmotes: null,
    chatroomId: null,
    result: null
  });

  return useMemo(() => {
    // Check if we can reuse the cached result with deep comparison
    if (
      cacheRef.current.chatroomId === chatroomId &&
      isEqual(cacheRef.current.personalEmoteSets, personalEmoteSets) &&
      isEqual(cacheRef.current.channel7TVEmotes, channel7TVEmotes)
    ) {
      return cacheRef.current.result;
    }

    // Compute new result and cache it - channel emotes first, then personal emotes
    const result = [...(channel7TVEmotes || []), ...(personalEmoteSets || [])];
    cacheRef.current = { chatroomId, personalEmoteSets, channel7TVEmotes, result };
    return result;
  }, [personalEmoteSets, channel7TVEmotes, chatroomId]);
};