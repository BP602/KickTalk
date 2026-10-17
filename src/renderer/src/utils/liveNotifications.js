// A live event older than this is a replayed or stale one, not a stream that just started.
export const LIVE_NOTIFICATION_MAX_AGE_MS = 5 * 60 * 1000;

export const getLiveNotificationStreamers = (liveNotifications) =>
  Array.isArray(liveNotifications?.streamers) ? liveNotifications.streamers : [];

export const isLiveNotificationEnabled = (liveNotifications, chatroomId) =>
  getLiveNotificationStreamers(liveNotifications).includes(String(chatroomId));

export const withLiveNotification = (liveNotifications, chatroomId, enabled) => {
  const id = String(chatroomId);
  const others = getLiveNotificationStreamers(liveNotifications).filter((streamer) => streamer !== id);
  return { ...liveNotifications, streamers: enabled ? [...others, id] : others };
};

export const setLiveNotification = async (chatroomId, enabled) => {
  const current = await window.app.store.get("liveNotifications");
  const next = withLiveNotification(current, chatroomId, enabled);
  await window.app.store.set("liveNotifications", next);
  return next;
};

export const getStreamerName = (room) => room?.streamerData?.user?.username || room?.username || room?.displayName;

// The Settings window cannot rely on the shared localStorage (signed-out preloads clear it), so the
// main window hands it this roster when opening the dialog.
export const getLiveNotificationRoster = (chatrooms) =>
  (chatrooms || []).map((room) => ({ id: String(room.id), name: getStreamerName(room) }));

// Resolves an id received over IPC (always a string) to the id the chatroom is stored under.
export const findChatroomId = (chatrooms, id) => (chatrooms || []).find((room) => String(room.id) === String(id))?.id;

/**
 * Whether a live push event is an offline-to-live transition worth announcing.
 * Initial fetches never reach this check; they update room state without a push event.
 *
 * @param {object} args
 * @param {object} args.previousRoom room state before the event was applied
 * @param {object} args.livestream livestream payload carried by the event
 * @param {string|number|undefined} args.lastNotifiedId livestream id already announced for this room
 * @param {number} args.now current time in ms
 */
export const isWentLiveTransition = ({ previousRoom, livestream, lastNotifiedId, now }) => {
  if (!previousRoom || previousRoom.isStreamerLive === true) return false;
  if (livestream?.id === undefined || livestream?.id === null) return false;
  if (lastNotifiedId !== undefined && String(lastNotifiedId) === String(livestream.id)) return false;

  const startedAt = Date.parse(livestream.created_at);
  if (Number.isFinite(startedAt) && now - startedAt > LIVE_NOTIFICATION_MAX_AGE_MS) return false;
  return true;
};

/**
 * Announces a streamer going live when the user opted that streamer in and the event is a real
 * offline-to-live transition. `announced` maps chatroom id to the last announced livestream id.
 * The sound follows the existing notification settings (`notifications.enabled` and `.sound`).
 */
export const announceWentLive = async ({ previousRoom, livestream, announced, playSound, app = window.app, now = Date.now() }) => {
  const chatroomId = String(previousRoom?.id);
  if (!isWentLiveTransition({ previousRoom, livestream, lastNotifiedId: announced.get(chatroomId), now })) return false;
  announced.set(chatroomId, livestream.id);

  const [liveNotifications, notifications] = await Promise.all([
    app.store.get("liveNotifications"),
    app.store.get("notifications"),
  ]);
  if (!isLiveNotificationEnabled(liveNotifications, chatroomId)) return false;

  await app.liveNotification.show({
    chatroomId,
    streamerName: getStreamerName(previousRoom),
    streamTitle: livestream.session_title,
  });
  if (notifications?.enabled !== false && notifications?.sound !== false) await playSound(notifications);
  return true;
};
