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
import { XIcon } from "@phosphor-icons/react";

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
  }) => {
    const dragRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);

    // Use useShallow to prevent unnecessary re-renders and memoize the unread count calculation
    const chatroomMessages = useChatStore(
      useShallow((state) => state.messages[chatroom.id] || [])
    );

    const [streamlinkSettings, setStreamlinkSettings] = useState({ enabled: false, quality: "best" });

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
                  aria-describedby={unreadCount > 0 ? `chatroom-unread-${chatroom.id}` : undefined}
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
                        />
                      </>
                    )}
                  </div>
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
