import { memo, useMemo, useEffect, useState, useRef, useCallback } from "react";
import { Virtuoso } from "react-virtuoso";
import useChatStore from "../../providers/ChatProvider";
import Message from "./Message";
import { MouseScroll } from "@phosphor-icons/react";

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
      (index, message) => (
        <Message
          key={message?.id}
          data-message-id={message.id}
          message={message}
          chatroomId={chatroomId}
          chatroomName={slug}
          subscriberBadges={subscriberBadges}
          allStvEmotes={allStvEmotes}
          existingKickTalkBadges={kickTalkBadges}
          settings={settings}
          userChatroomInfo={userChatroomInfo}
          username={username}
          userId={userId}
          donators={donators}
        />
      ),
      [chatroomId, slug, subscriberBadges, allStvEmotes, kickTalkBadges, settings, userChatroomInfo, username, userId, donators],
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
          // followOutput={"auto"}
          initialTopMostItemIndex={filteredMessages?.length - 1}
          // alignToBottom={true}
          // atBottomStateChange={setAtBottom}
          atBottomThreshold={100}
          overscan={20}
          increaseViewportBy={200}
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
