'use strict';

const MAX_NAME_LENGTH = 100;
const MAX_TITLE_LENGTH = 200;

const clip = (value, max) => value.replace(/\s+/g, " ").trim().slice(0, max);

/** Returns a safe payload, or null when the renderer sent something that is not a live notification. */
const sanitizeLiveNotification = (payload) => {
  if (!payload || typeof payload !== "object") return null;
  const { chatroomId, streamerName, streamTitle } = payload;
  if (!/^\d{1,20}$/.test(String(chatroomId))) return null;
  if (typeof streamerName !== "string" || !clip(streamerName, MAX_NAME_LENGTH)) return null;
  return {
    chatroomId: String(chatroomId),
    streamerName: clip(streamerName, MAX_NAME_LENGTH),
    streamTitle: typeof streamTitle === "string" ? clip(streamTitle, MAX_TITLE_LENGTH) : "",
  };
};

/**
 * Shows native "went live" notifications. Clicking one focuses the main window and asks the
 * renderer to select the streamer's room. The OS sound is suppressed; the renderer plays the
 * user's configured notification sound.
 */
const createLiveNotifier = ({ Notification, getMainWindow }) => {
  // Notifications are garbage-collected, and their click handler lost, unless something holds them.
  const active = new Set();

  const focusRoom = (chatroomId) => {
    const window = getMainWindow();
    if (!window || window.isDestroyed()) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
    window.webContents.send("chatroom:select", { chatroomId });
  };

  return {
    show(payload) {
      const live = sanitizeLiveNotification(payload);
      if (!live || !Notification.isSupported()) return false;

      const notification = new Notification({
        title: `${live.streamerName} is live`,
        body: live.streamTitle,
        silent: true,
      });
      const release = () => active.delete(notification);
      notification.on("click", () => {
        release();
        focusRoom(live.chatroomId);
      });
      notification.on("close", release);
      notification.on("failed", release);
      active.add(notification);
      notification.show();
      return true;
    },
  };
};

module.exports = { sanitizeLiveNotification, createLiveNotifier };
