import { memo, useMemo, useState, useEffect, useRef } from "react";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../Shared/ContextMenu";
import clsx from "clsx";
import useChatStore from "../../providers/ChatProvider";
import { useShallow } from "zustand/react/shallow";
import { XIcon, CircleNotchIcon, WarningCircleIcon, PlugIcon, ArrowClockwiseIcon } from "@phosphor-icons/react";
import { isLiveNotificationEnabled, setLiveNotification } from "../../utils/liveNotifications";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../Shared/Tooltip";

const CONNECTION_STATUSES = {
  connecting: { label: "Connecting", Icon: CircleNotchIcon },
  connected: { label: "Connected", Icon: null },
  reconnecting: { label: "Reconnecting", Icon: CircleNotchIcon },
  failed: { label: "Connection failed", Icon: WarningCircleIcon },
  disconnected: { label: "Disconnected", Icon: PlugIcon },
};

const ChatroomTab = memo(
  ({
    chatroom,
    index,
    currentChatroomId,
    onSelectChatroom,
    onRemoveChatroom,
    onRename,
    editingChatroomId,
    editingName,
    setEditingName,
    onRenameSubmit,
    setEditingChatroomId,
    renameInputRef,
    settings,
    onOpenInSplitPane,
    canOpenInSplitPane,
  }) => {
    const dragRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);

    // Use useShallow to prevent unnecessary re-renders and memoize the unread count calculation
    const chatroomMessages = useChatStore(
      useShallow((state) => state.messages[chatroom.id] || [])
    );
    const kickConnection = useChatStore(
      (state) => state.kickConnectionStates?.[String(chatroom.id)]
    );
    const retryKickConnection = useChatStore((state) => state.retryKickConnection);
    const connectionState = kickConnection?.state || "disconnected";
    const { label: connectionLabel, Icon: StatusIcon } =
      CONNECTION_STATUSES[connectionState] || CONNECTION_STATUSES.disconnected;
    const ConnectionIcon = connectionState === "connected" && kickConnection?.reason
      ? WarningCircleIcon
      : StatusIcon;
    const connectionDescription = [
      `Kick chat: ${connectionLabel}`,
      connectionState === "reconnecting" && kickConnection?.attempt > 0
        ? `Attempt ${kickConnection.attempt}`
        : null,
      kickConnection?.reason,
    ].filter(Boolean).join(". ");

    const [streamlinkSettings, setStreamlinkSettings] = useState({ enabled: false, quality: "best" });

    const liveNotificationEnabled = isLiveNotificationEnabled(settings?.liveNotifications, chatroom.id);
    const unreadCount = useMemo(() => {
      return chatroomMessages.filter((message) => !message.isRead && message.type !== "system").length;
    }, [chatroomMessages]);

    // Get Streamlink settings and subscribe to changes
    useEffect(() => {
      let unsubscribe = () => {};
      const init = async () => {
        try {
          const settings = await window.app.store.get("streamlink");
          if (settings) setStreamlinkSettings(settings);
        } catch (error) {
          console.error("Failed to get Streamlink settings:", error);
        }
        try {
          unsubscribe = window.app.store.onUpdate((delta) => {
            if (delta && Object.prototype.hasOwnProperty.call(delta, "streamlink")) {
              setStreamlinkSettings(delta.streamlink || { enabled: false, quality: "best" });
            }
          });
        } catch (e) {
          console.warn("Failed to subscribe to settings updates:", e);
        }
      };
      init();
      return () => {
        try { unsubscribe && unsubscribe(); } catch {}
      };
    }, []);

    // Setup drag and drop functionality
    useEffect(() => {
      const element = dragRef.current;
      if (!element) return;

      const getDraggableData = () => ({
        type: 'chatroom-tab',
        chatroomId: chatroom.id,
        index,
      });

      return combine(
        draggable({
          element,
          getInitialData: getDraggableData,
          onDragStart: () => setIsDragging(true),
          onDrop: () => setIsDragging(false),
          onDragEnd: () => setIsDragging(false),
        }),
        dropTargetForElements({
          element,
          canDrop: ({ source }) => {
            return source.data.type === 'chatroom-tab' && source.data.chatroomId !== chatroom.id;
          },
          getData: () => ({
            type: 'chatroom-list',
            index,
          }),
        })
      );
    }, [chatroom.id, index]);

    return (
      <div
        ref={dragRef}
        style={{
          opacity: isDragging ? 0.8 : 1,
        }}
      >
        <ContextMenu>
              <ContextMenuTrigger>
                <div
                  role="tab"
                  tabIndex={0}
                  aria-selected={chatroom.id === currentChatroomId}
                  aria-label={`Chatroom ${chatroom.displayName || chatroom.username}`}
                  aria-describedby={[
                    `chatroom-connection-${chatroom.id}`,
                    unreadCount > 0 ? `chatroom-unread-${chatroom.id}` : null,
                  ].filter(Boolean).join(" ")}
                  onDoubleClick={(e) =>
                    onRename({ chatroomId: chatroom.id, currentDisplayName: chatroom.displayName || chatroom.username })
                  }
                  onClick={() => onSelectChatroom(chatroom.id)}
                  onMouseDown={async (e) => {
                    if (e.button === 1) {
                      await onRemoveChatroom(chatroom.id);
                    }
                  }}
                  className={clsx(
                    "chatroomStreamer",
                    chatroom.id === currentChatroomId && "chatroomStreamerActive",
                    chatroom?.isStreamerLive && "chatroomStreamerLive",
                    isDragging && "dragging",
                    unreadCount > 0 && chatroom.id !== currentChatroomId && "hasUnread",
                  )}>
                  <div className="streamerInfo">
                    {settings?.general?.showTabImages && chatroom.streamerData?.user?.profile_pic && (
                      <img
                        className="profileImage"
                        src={chatroom.streamerData.user.profile_pic}
                        alt={`${chatroom.username}'s profile`}
                      />
                    )}
                    {editingChatroomId === chatroom.id ? (
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => onRenameSubmit(chatroom.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            onRenameSubmit(chatroom.id);
                          } else if (e.key === "Escape") {
                            setEditingChatroomId(null);
                            setEditingName("");
                          }
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        ref={renameInputRef}
                      />
                    ) : (
                      <>
                        <span>{chatroom.displayName || chatroom.username}</span>
                        <span
                          id={`chatroom-unread-${chatroom.id}`}
                          className={clsx("unreadCountIndicator", unreadCount > 0 && "hasUnread")}
                          role="status"
                          aria-live="polite"
                          aria-hidden={unreadCount === 0}
                        >
                          {unreadCount > 0 ? `${unreadCount} unread messages` : ""}
                        </span>
                      </>
                    )}
                  </div>
                  <span
                    id={`chatroom-connection-${chatroom.id}`}
                    className="kickConnectionText"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    {connectionDescription}
                  </span>
                  {ConnectionIcon && <TooltipProvider>
                    <span className="kickConnectionControls" data-connection-state={connectionState}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className="kickConnectionIndicator"
                            tabIndex={0}
                            aria-label={connectionDescription}
                          >
                            <ConnectionIcon size={14} aria-hidden="true" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{connectionDescription}</TooltipContent>
                      </Tooltip>
                      {connectionState === "failed" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="retryKickConnection"
                              aria-label={`Retry Kick connection for ${chatroom.displayName || chatroom.username}`}
                              onMouseDown={(e) => e.stopPropagation()}
                              onDoubleClick={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                retryKickConnection(chatroom.id);
                              }}
                            >
                              <ArrowClockwiseIcon size={14} aria-hidden="true" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Retry Kick connection</TooltipContent>
                        </Tooltip>
                      )}
                    </span>
                  </TooltipProvider>}
                  <button
                    className="closeChatroom"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveChatroom(chatroom.id);
                    }}
                    aria-label="Remove chatroom">
                    <XIcon size={12} aria-label="Remove chatroom" />
                  </button>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onSelect={() => window.open(`https://kick.com/${chatroom.username}`, "_blank")}>
                  Open Stream in Browser
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => window.open(`https://player.kick.com/${chatroom.username}`, "_blank")}>
                  Open Player in Browser
                </ContextMenuItem>
                {streamlinkSettings.enabled && (
                  <ContextMenuItem onSelect={async () => {
                    try {
                      const { available } = await window.app.utils.checkStreamlinkAvailable();
                      if (!available) {
                        try {
                          await window.app.store.set("streamlink", { ...streamlinkSettings, enabled: false });
                        } catch {}
                        window.app.utils.showNotification({
                          type: "warning",
                          title: "Streamlink Not Available", 
                          message: "Streamlink is not installed. Please install it and re-enable in Settings.",
                          buttons: ["OK"]
                        });
                        return;
                      }
                      const result = await window.app.utils.launchStreamlink(chatroom.username);
                      if (!result.success) {
                        console.error("Failed to launch Streamlink:", result.error);
                      }
                    } catch (error) {
                      console.error("Error launching Streamlink:", error);
                    }
                  }}>
                    Open Stream in Streamlink
                  </ContextMenuItem>
                )}
                <ContextMenuItem
                  onSelect={() => onOpenInSplitPane(chatroom.id)}
                  disabled={!canOpenInSplitPane}
                >
                  Open in Split Pane
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() =>
                    setLiveNotification(chatroom.id, !liveNotificationEnabled).catch((error) =>
                      console.error("Failed to update live notification setting:", error),
                    )
                  }>
                  {liveNotificationEnabled ? "Stop Notifying When Live" : "Notify When Live"}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onSelect={() =>
                    onRename({ chatroomId: chatroom.id, currentDisplayName: chatroom.displayName || chatroom.username })
                  }>
                  Rename Tab
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => onRemoveChatroom(chatroom.id)}>Remove Chatroom</ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
      </div>
    );
  },
);

ChatroomTab.displayName = "ChatroomTab";

export default ChatroomTab;
