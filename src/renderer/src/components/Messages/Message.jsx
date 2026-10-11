import "@assets/styles/components/Chat/Message.scss";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useShallow } from "zustand/shallow";
import { createMentionRegex } from "@utils/regex";

import useChatStore from "../../providers/ChatProvider";
import useCosmeticsStore from "../../providers/CosmeticsProvider";

import ModActionMessage from "./ModActionMessage";
import RegularMessage from "./RegularMessage";
import EmoteUpdateMessage from "./EmoteUpdateMessage";
import ReplyMessage from "./ReplyMessage";
import SupportEventMessage from "./SupportEventMessage";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "../Shared/ContextMenu";

const MessageComponent = ({
  message,
  userChatroomInfo,
  chatroomId,
  subscriberBadges,
  allStvEmotes,
  kickTalkBadges,
  donatorBadges,
  settings,
  dialogUserStyle,
  type,
  username,
  userId,
  chatroomName,
}) => {
  const messageRef = useRef(null);
  const getDeleteMessage = useChatStore(useShallow((state) => state.getDeleteMessage));
  const getUserStyle = useCosmeticsStore(useShallow((state) => state.getUserStyle));
  const [rightClickedEmote, setRightClickedEmote] = useState(null);

  const userStyle = useMemo(() => {
    if (!message?.sender || type === "replyThread") {
      return undefined;
    }

    if (type === "dialog") {
      return dialogUserStyle;
    }

    if (!getUserStyle) {
      return undefined;
    }

    return getUserStyle(message?.sender?.username);
  }, [dialogUserStyle, getUserStyle, message?.sender, type]);

  const canModerate = useMemo(
    () => userChatroomInfo?.is_broadcaster || userChatroomInfo?.is_moderator || userChatroomInfo?.is_super_admin,
    [userChatroomInfo],
  );

  const handleOpenUserDialog = useCallback(
    async (e, lookupUsername) => {
      e.preventDefault();

      if (lookupUsername) {
        const user = await window.app.kick.getUserChatroomInfo(chatroomName, lookupUsername);

        if (!user?.data?.id) return;

        const sender = {
          id: user.data.id,
          username: user.data.username,
          slug: user.data.slug,
        };

        window.app.userDialog.open({
          sender,
          fetchedUser: user?.data,
          chatroomId,
          subscriberBadges,
          sevenTVEmotes: allStvEmotes,
          cords: [e.clientX, e.clientY],
          username,
        });
      } else {
        window.app.userDialog.open({
          sender: message.sender,
          userChatroomInfo,
          chatroomId,
          subscriberBadges,
          sevenTVEmotes: allStvEmotes,
          cords: [e.clientX, e.clientY],
          userStyle,
          username,
        });
      }
    },
    [allStvEmotes, chatroomId, chatroomName, message?.sender, subscriberBadges, userChatroomInfo, userStyle, username],
  );

  const rgbaObjectToString = (rgba) => {
    if (!rgba) return "transparent";
    if (typeof rgba === "string") return rgba;
    if (typeof rgba === "object" && rgba.r !== undefined) {
      return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`;
    }
    return "transparent";
  };

  const parsedMetadata = useMemo(() => {
    if (typeof message?.metadata === "string") {
      try {
        return JSON.parse(message.metadata);
      } catch {
        return {};
      }
    }
    return message?.metadata || {};
  }, [message?.metadata]);

  const eventType = message?.type === "metadata" ? parsedMetadata?.type : message?.type;
  const isSupportEvent = useMemo(
    () =>
      [
        "subscription",
        "donation",
        "reward",
        "stream_live",
        "stream_end",
        "moderation",
        "host",
        "raid",
        "goal_progress",
        "kick_gift",
      ].includes(eventType),
    [eventType],
  );

  const handleCopyMessage = useCallback(() => {
    if (message?.content) {
      navigator.clipboard.writeText(message.content);
    }
  }, [message?.content]);

  const handleReply = useCallback(() => {
    window.app.reply.open(message);
  }, [message]);

  const handlePinMessage = useCallback(() => {
    const data = {
      chatroom_id: message.chatroom_id,
      content: message.content,
      id: message.id,
      sender: message.sender,
      chatroomName,
    };
    window.app.kick.getPinMessage(data);
  }, [chatroomName, message]);

  const handleDeleteMessage = useCallback(() => {
    getDeleteMessage(chatroomId, message.id);
  }, [chatroomId, getDeleteMessage, message.id]);

  const handleViewProfile = useCallback(() => {
    if (message?.sender?.username) {
      const profileSlug = message.sender.slug || message.sender.username;
      window.open(`https://kick.com/${profileSlug}`, "_blank");
    }
  }, [message?.sender]);

  const handleOpenEmoteLink = useCallback(() => {
    if (rightClickedEmote) {
      const emoteUrl =
        rightClickedEmote.type === "stv"
          ? `https://7tv.app/emotes/${rightClickedEmote.id}`
          : `https://files.kick.com/emotes/${rightClickedEmote.id}/fullsize`;

      window.open(emoteUrl, "_blank");
    }
  }, [rightClickedEmote]);

  const handleOpen7TVEmoteLink = useCallback(
    (resolution) => {
      if (rightClickedEmote && rightClickedEmote.type === "stv") {
        const emoteUrl =
          resolution === "page"
            ? `https://7tv.app/emotes/${rightClickedEmote.id}`
            : `https://cdn.7tv.app/emote/${rightClickedEmote.id}/${resolution}.webp`;

        window.open(emoteUrl, "_blank");
      }
    },
    [rightClickedEmote],
  );

  const handleMessageContextMenu = useCallback((e) => {
    setRightClickedEmote(null);
    let emoteImg = null;

    if (e.target.tagName === "IMG" && e.target.className.includes("emote")) {
      emoteImg = e.target;
    } else if (e.target.className.includes("chatroomEmote")) {
      emoteImg = e.target.querySelector("img.emote");
    }

    if (emoteImg) {
      const alt = emoteImg.getAttribute("alt");
      const src = emoteImg.getAttribute("src");

      if (src.includes("7tv.app")) {
        const match = src.match(/\/emote\/([^/]+)\//);
        if (match) {
          setRightClickedEmote({ id: match[1], name: alt, type: "stv" });
        }
      } else if (src.includes("kick.com/emotes")) {
        const match = src.match(/\/emotes\/([^/]+)/);
        if (match) {
          setRightClickedEmote({ id: match[1], name: alt, type: "kick" });
        }
      }
    }
  }, []);

  const showContextMenu =
    !message?.deleted &&
    message?.type !== "system" &&
    message?.type !== "stvEmoteSetUpdate" &&
    message?.type !== "mod_action";

  const handleOpenReplyThread = useCallback(
    async (chatStoreMessageThread) => {
      if (!message?.metadata?.original_message?.id) return;

      const messageThread = await window.app.replyLogs.get({
        originalMessageId: message?.metadata?.original_message?.id,
        chatroomId,
      });

      const sortedMessages = [...new Set([...chatStoreMessageThread, ...messageThread].map((m) => m.id))]
        .map((id) => [...chatStoreMessageThread, ...messageThread].find((m) => m.id === id))
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      await window.app.replyThreadDialog.open({
        chatroomId,
        messages: sortedMessages,
        originalMessageId: message?.metadata?.original_message?.id,
        allStvEmotes,
        subscriberBadges,
        userChatroomInfo,
        chatroomName,
        username,
        settings,
      });
    },
    [allStvEmotes, chatroomId, chatroomName, message, settings, subscriberBadges, userChatroomInfo, username],
  );

  const mentionRegex = useMemo(() => createMentionRegex(username), [username]);

  const shouldHighlightMessage = useMemo(() => {
    if (type === "dialog") {
      return false;
    }

    if (message?.sender?.slug === username) {
      return false;
    }

    if (settings?.notifications?.background) {
      if (message?.metadata?.original_sender?.id == userId && message?.sender?.id != userId) {
        return true;
      }
    }

    if (settings?.notifications?.background && mentionRegex) {
      const content = message?.content?.toLowerCase() || "";
      if (mentionRegex.test(content)) {
        return true;
      }
    }

    if (settings?.notifications?.background && settings?.notifications?.phrases?.length) {
      return settings.notifications.phrases.some((phrase) =>
        message?.content?.toLowerCase().includes(phrase.toLowerCase()),
      );
    }

    return false;
  }, [
    mentionRegex,
    message?.content,
    message?.metadata?.original_sender?.id,
    message?.sender?.id,
    message?.sender?.slug,
    settings?.notifications?.background,
    settings?.notifications?.phrases,
    type,
    userId,
    username,
  ]);

  const messageContent = (
    <div
      className={clsx(
        "chatMessageItem",
        message.is_old && type !== "replyThread" && "old",
        message.deleted && "deleted",
        message.type === "stvEmoteSetUpdate" && "emoteSetUpdate",
        type === "dialog" && "dialogChatMessageItem",
        shouldHighlightMessage && "highlighted",
        message.isOptimistic && message.state === "optimistic" && "optimistic",
        message.isOptimistic && message.state === "failed" && "failed",
        isSupportEvent && "supportEvent",
      )}
      style={{
        backgroundColor: shouldHighlightMessage ? rgbaObjectToString(settings?.notifications?.backgroundRgba) : "transparent",
      }}
      ref={messageRef}>
      {(message.type === "message" || type === "replyThread") && (
        <RegularMessage
          type={type}
          message={message}
          kickTalkBadges={kickTalkBadges}
          donatorBadges={donatorBadges}
          subscriberBadges={subscriberBadges}
          sevenTVEmotes={allStvEmotes}
          userStyle={userStyle}
          handleOpenUserDialog={handleOpenUserDialog}
          userChatroomInfo={userChatroomInfo}
          chatroomName={chatroomName}
          chatroomId={chatroomId}
          settings={settings}
          username={username}
        />
      )}

      {message.type === "reply" && type !== "replyThread" && (
        <ReplyMessage
          type={type}
          message={message}
          kickTalkBadges={kickTalkBadges}
          donatorBadges={donatorBadges}
          subscriberBadges={subscriberBadges}
          sevenTVEmotes={allStvEmotes}
          sevenTVSettings={settings?.sevenTV}
          userStyle={userStyle}
          handleOpenUserDialog={handleOpenUserDialog}
          userChatroomInfo={userChatroomInfo}
          chatroomName={chatroomName}
          chatroomId={chatroomId}
          handleOpenReplyThread={handleOpenReplyThread}
          settings={settings}
          username={username}
        />
      )}

      {message.type === "system" && (
        <span className="systemMessage">
          {message.content === "connection-pending"
            ? "Connecting to Channel..."
            : message.content === "connection-success"
              ? "Connected to Channel"
              : message.content}
        </span>
      )}

      {message.type === "stvEmoteSetUpdate" && <EmoteUpdateMessage message={message} />}

      {message.type === "mod_action" && (
        <ModActionMessage
          message={message}
          chatroomId={chatroomId}
          chatroomName={chatroomName}
          subscriberBadges={subscriberBadges}
          allStvEmotes={allStvEmotes}
          userChatroomInfo={userChatroomInfo}
        />
      )}

      {isSupportEvent && (
        <SupportEventMessage message={{ ...message, metadata: parsedMetadata }} handleOpenUserDialog={handleOpenUserDialog} />
      )}
    </div>
  );

  if (showContextMenu) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild onContextMenu={handleMessageContextMenu}>
          {messageContent}
        </ContextMenuTrigger>
        <ContextMenuContent>
          {message?.content && <ContextMenuItem onSelect={handleCopyMessage}>Copy Message</ContextMenuItem>}

          {message?.content && <ContextMenuItem onSelect={handleReply}>Reply to Message</ContextMenuItem>}

          {rightClickedEmote && rightClickedEmote.type === "stv" && (
            <>
              <ContextMenuSeparator />
              <ContextMenuSub>
                <ContextMenuSubTrigger>Open Emote Links</ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  <ContextMenuItem onSelect={() => handleOpen7TVEmoteLink("page")}>7TV Link</ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onSelect={() => handleOpen7TVEmoteLink("1x")}>1x Link</ContextMenuItem>
                  <ContextMenuItem onSelect={() => handleOpen7TVEmoteLink("2x")}>2x Link</ContextMenuItem>
                  <ContextMenuItem onSelect={() => handleOpen7TVEmoteLink("4x")}>4x Link</ContextMenuItem>
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuSub>
                <ContextMenuSubTrigger>Copy Emote Links</ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  <ContextMenuItem
                    onSelect={() => navigator.clipboard.writeText(`https://7tv.app/emotes/${rightClickedEmote.id}`)}>
                    7TV Link
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onSelect={() => navigator.clipboard.writeText(`https://cdn.7tv.app/emote/${rightClickedEmote.id}/1x.webp`)}>
                    1x Link
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={() => navigator.clipboard.writeText(`https://cdn.7tv.app/emote/${rightClickedEmote.id}/2x.webp`)}>
                    2x Link
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={() => navigator.clipboard.writeText(`https://cdn.7tv.app/emote/${rightClickedEmote.id}/4x.webp`)}>
                    4x Link
                  </ContextMenuItem>
                </ContextMenuSubContent>
              </ContextMenuSub>
            </>
          )}

          {rightClickedEmote && rightClickedEmote.type === "kick" && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={handleOpenEmoteLink}>Open Kick Emote</ContextMenuItem>
            </>
          )}

          {canModerate && message?.content && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={handlePinMessage}>Pin Message</ContextMenuItem>
              <ContextMenuItem onSelect={handleDeleteMessage}>Delete Message</ContextMenuItem>
            </>
          )}
          {message?.sender && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={handleOpenUserDialog}>Open User Card</ContextMenuItem>
              <ContextMenuItem onSelect={handleViewProfile}>View Profile on Kick</ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  return messageContent;
};

const areEqual = (prevProps, nextProps) => {
  if (prevProps.message !== nextProps.message) return false;
  if (prevProps.chatroomId !== nextProps.chatroomId) return false;
  if (prevProps.chatroomName !== nextProps.chatroomName) return false;
  if (prevProps.subscriberBadges !== nextProps.subscriberBadges) return false;
  if (prevProps.allStvEmotes !== nextProps.allStvEmotes) return false;
  if (prevProps.kickTalkBadges !== nextProps.kickTalkBadges) return false;
  if (prevProps.donatorBadges !== nextProps.donatorBadges) return false;
  if (prevProps.settings !== nextProps.settings) return false;
  if (prevProps.userChatroomInfo !== nextProps.userChatroomInfo) return false;
  if (prevProps.username !== nextProps.username) return false;
  if (prevProps.userId !== nextProps.userId) return false;
  if (prevProps.type !== nextProps.type) return false;
  if (prevProps.dialogUserStyle !== nextProps.dialogUserStyle) return false;

  return true;
};

export default memo(MessageComponent, areEqual);
