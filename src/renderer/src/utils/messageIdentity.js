import { createMentionRegex } from "@utils/regex";

/**
 * The single highlight rule for a chat message: a mention of the current user,
 * a reply to one of their messages, or a configured custom phrase. Extracted
 * verbatim from Message.jsx so the row highlight and the scrollbar mention
 * markers can never disagree. `type` is the viewer's context for the row
 * (e.g. "dialog"), not the message's own type.
 *
 * Scope note: ChatProvider.handleNotification carries a similar-looking check
 * for sound/desktop-notification purposes; it intentionally differs (broader
 * gating) and is not covered by this rule.
 */
export const isHighlightedMessage = (message, { username, userId, notifications, type } = {}) => {
  if (type === "dialog") {
    return false;
  }

  if (message?.sender?.slug === username) {
    return false;
  }

  if (notifications?.background) {
    if (message?.metadata?.original_sender?.id == userId && message?.sender?.id != userId) {
      return true;
    }
  }

  const mentionRegex = notifications?.background ? createMentionRegex(username) : null;
  if (mentionRegex) {
    const content = message?.content?.toLowerCase() || "";
    if (mentionRegex.test(content)) {
      return true;
    }
  }

  if (notifications?.background && notifications?.phrases?.length) {
    return notifications.phrases.some((phrase) => message?.content?.toLowerCase().includes(phrase.toLowerCase()));
  }

  return false;
};

/**
 * Whether a message was sent by the signed-in user. Identity comes from the
 * store's currentUser (getSelfInfo's data.id) — the same id space as
 * message.sender.id, which the optimistic-echo confirmation in ChatProvider
 * relies on — never from localStorage's kickId, which can outlive sign-out.
 */
export const isOwnMessage = (message, currentUser) => {
  if (currentUser?.id == null) return false;
  if (message?.type !== "message" && message?.type !== "reply") return false;
  if (message?.sender?.id == null) return false;
  return String(message.sender.id) === String(currentUser.id);
};
