import { memo, useMemo, useEffect, useState, useRef, useCallback } from "react";
import { Virtuoso } from "react-virtuoso";
import useChatStore from "../../providers/ChatProvider";
import Message from "./Message";
import { MouseScroll } from "@phosphor-icons/react";
import { DEFAULT_SCROLL_SEEK_VELOCITY } from "@utils/constants";

const DONATOR_BADGE = Object.freeze([
  {
    type: "Donator",
    title: "KickTalk Donator",
  },
]);

const ScrollSeekPlaceholder = ({ height = 48 }) => (
  <div
    className="chatMessagePlaceholder"
    style={{
      height,
      padding: "8px 16px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      opacity: 0.7,
    }}>
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "var(--surface-3, rgba(255, 255, 255, 0.08))",
      }}
    />
    <div style={{ flex: 1 }}>
      <div
        style={{
          width: "45%",
          height: 10,
          borderRadius: 6,
          background: "var(--surface-3, rgba(255, 255, 255, 0.08))",
          marginBottom: 6,
        }}
      />
      <div
        style={{
          width: "70%",
          height: 10,
          borderRadius: 6,
          background: "var(--surface-3, rgba(255, 255, 255, 0.06))",
        }}
      />
    </div>
  </div>
);

const MessagesHandler = memo(
  ({
    messages,
    chatroomId,
    slug,
    allStvEmotes,
    subscriberBadges,
    kickTalkBadges,
    settings,
    userChatroomInfo,
    username,
    userId,
    donators,
  }) => {
    const virtuosoRef = useRef(null);
    const chatContainerRef = useRef(null);
    const [silencedUserIds, setSilencedUserIds] = useState(new Set());
    const [atBottom, setAtBottom] = useState(true);
    const [isPaused, setIsPaused] = useState(false);

    const eventVisibility = settings?.chatrooms?.eventVisibility;
    const showModActions = settings?.chatrooms?.showModActions !== false;

    const filteredMessages = useMemo(() => {
      if (!messages?.length) return [];

      return messages.filter((message) => {
        if (message?.chatroom_id != chatroomId) return false;

        if (message?.type === "mod_action") {
          return showModActions;
        }

        let metadata = {};
        if (typeof message?.metadata === "string") {
          try {
            metadata = JSON.parse(message.metadata);
          } catch {
            metadata = {};
          }
        } else {
          metadata = message?.metadata || {};
        }

        const eventType = message?.type === "metadata" ? metadata?.type : message?.type;

        const visibilityKey = (() => {
          switch (eventType) {
            case "subscription":
              return "subscriptions";
            case "donation":
            case "reward":
              return "rewards";
            case "stream_live":
            case "stream_end":
              return "streamStatus";
            case "host":
              return "hosts";
            case "raid":
              return "raids";
            case "goal_progress":
              return "goalProgress";
            case "kick_gift":
              return "kickGifts";
            case "moderation":
              return metadata?.action === "timed_out" ? "timeouts" : "bans";
            default:
              return null;
          }
        })();

        if (
          visibilityKey &&
          eventVisibility &&
          Object.prototype.hasOwnProperty.call(eventVisibility, visibilityKey) &&
          eventVisibility[visibilityKey] === false
        ) {
          return false;
        }

        if (message?.type === "system") {
          return true;
        }

        if (message?.type !== "reply" && message?.type !== "message") {
          return true;
        }

        return message?.sender?.id && !silencedUserIds.has(message?.sender?.id);
      });
    }, [messages, chatroomId, silencedUserIds, eventVisibility, showModActions]);

    const kickTalkBadgeMap = useMemo(() => {
      if (!Array.isArray(kickTalkBadges)) return new Map();

      const map = new Map();
      kickTalkBadges.forEach((entry) => {
        if (!entry?.username) return;
        map.set(entry.username.toLowerCase(), entry?.badges || []);
      });

      return map;
    }, [kickTalkBadges]);

    const donatorBadgeMap = useMemo(() => {
      if (!Array.isArray(donators)) return new Map();

      const map = new Map();
      donators.forEach((entry) => {
        const label = entry?.message;
        if (!label) return;
        map.set(label.toLowerCase(), DONATOR_BADGE);
      });

      return map;
    }, [donators]);

    const scrollSeekVelocityThreshold = settings?.chatrooms?.scrollSeekVelocityThreshold;

    const resolvedScrollSeekVelocity = useMemo(() => {
      if (typeof scrollSeekVelocityThreshold === "number") {
        return Math.max(0, Math.min(scrollSeekVelocityThreshold, 2000));
      }
      return DEFAULT_SCROLL_SEEK_VELOCITY;
    }, [scrollSeekVelocityThreshold]);

    const scrollSeekConfiguration = useMemo(() => {
      if (!resolvedScrollSeekVelocity) {
        return null;
      }

      const exitThreshold = Math.max(Math.floor(resolvedScrollSeekVelocity * 0.6), 60);

      return {
        enter: (velocity) => Math.abs(velocity) > resolvedScrollSeekVelocity,
        exit: (velocity) => Math.abs(velocity) < exitThreshold,
      };
    }, [resolvedScrollSeekVelocity]);

    const virtuosoComponents = useMemo(
      () => (scrollSeekConfiguration ? { ScrollSeekPlaceholder } : {}),
      [scrollSeekConfiguration],
    );

    useEffect(() => {
      if (filteredMessages.length > 0 && !isPaused) {
        virtuosoRef.current?.scrollToIndex({
          index: filteredMessages.length - 1,
          behavior: "instant",
          align: "end",
        });
      }
    }, [chatroomId]);

    useEffect(() => {
      if (virtuosoRef.current && atBottom) {
        setTimeout(() => {
          virtuosoRef.current?.scrollToIndex({
            index: filteredMessages.length - 1,
            align: "start",
            behavior: "instant",
          });
        }, 0);
      }
    }, [filteredMessages, atBottom]);

    const handleScroll = useCallback(
      (e) => {
        if (!e?.target) return;
        const { scrollHeight, scrollTop, clientHeight } = e.target;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 250;

        setAtBottom(isNearBottom);

        if (isNearBottom !== !isPaused) {
          setIsPaused(!isNearBottom);
          useChatStore.getState().handleChatroomPause(chatroomId, !isNearBottom);
        }
      },
      [chatroomId, isPaused],
    );

    const togglePause = () => {
      const newPausedState = !isPaused;
      setIsPaused(newPausedState);
      useChatStore.getState().handleChatroomPause(chatroomId, newPausedState);

      if (!newPausedState && filteredMessages?.length) {
        virtuosoRef.current?.scrollToIndex({
          index: filteredMessages.length - 1,
          behavior: "instant",
          align: "end",
        });
        setAtBottom(true);
      }
    };

    const itemContent = useCallback(
      (index, message) => {
        const usernameKey = message?.sender?.username?.toLowerCase();
        const messageKickTalkBadges = usernameKey ? kickTalkBadgeMap.get(usernameKey) : undefined;
        const messageDonatorBadges = usernameKey ? donatorBadgeMap.get(usernameKey) : undefined;

        return (
          <Message
            key={message?.id}
            data-message-id={message.id}
            message={message}
            chatroomId={chatroomId}
            chatroomName={slug}
            subscriberBadges={subscriberBadges}
            allStvEmotes={allStvEmotes}
            kickTalkBadges={messageKickTalkBadges}
            donatorBadges={messageDonatorBadges}
            settings={settings}
            userChatroomInfo={userChatroomInfo}
            username={username}
            userId={userId}
          />
        );
      },
      [
        chatroomId,
        slug,
        subscriberBadges,
        allStvEmotes,
        settings,
        userChatroomInfo,
        username,
        userId,
        kickTalkBadgeMap,
        donatorBadgeMap,
      ],
    );

    useEffect(() => {
      const loadSilencedUsers = () => {
        try {
          const storedUsers = JSON.parse(localStorage.getItem("silencedUsers") || "{}");
          const userIds = storedUsers?.data?.map((user) => user.id) || [];
          setSilencedUserIds(new Set(userIds));
        } catch (error) {
          console.error("[MessagesHandler]: Error loading silenced users:", error);
          setSilencedUserIds(new Set());
        }
      };

      const handleStorageChange = (e) => {
        if (e.key === "silencedUsers") {
          loadSilencedUsers();
        }
      };

      loadSilencedUsers();
      window.addEventListener("storage", handleStorageChange);

      return () => {
        window.removeEventListener("storage", handleStorageChange);
      };
    }, []);

    const computeItemKey = useCallback(
      (index, message) => {
        return `${message?.id || index}-${chatroomId}`;
      },
      [chatroomId],
    );

    return (
      <div className="chatContainer" style={{ height: "100%", flex: 1 }} ref={chatContainerRef} data-chatroom-id={chatroomId}>
        <Virtuoso
          ref={virtuosoRef}
          data={filteredMessages}
          itemContent={itemContent}
          computeItemKey={computeItemKey}
          onScroll={handleScroll}
          followOutput="smooth"
          initialTopMostItemIndex={filteredMessages?.length - 1}
          atBottomThreshold={100}
          overscan={8}
          increaseViewportBy={{ top: 0, bottom: 120 }}
          scrollSeekConfiguration={scrollSeekConfiguration || undefined}
          components={virtuosoComponents}
          defaultItemHeight={45}
          style={{
            height: "100%",
            width: "100%",
            flex: 1,
          }}
        />

        {!atBottom && (
          <div className="scrollToBottomBtn" onClick={togglePause}>
            Scroll To Bottom
            <MouseScroll weight="fill" size={24} aria-label="MouseScroll To Bottom" />
          </div>
        )}
      </div>
    );
  },
);

// Add displayName for debugging
MessagesHandler.displayName = "MessagesHandler";

export default MessagesHandler;
