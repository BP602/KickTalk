// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findChatroomId, isLiveNotificationEnabled, withLiveNotification } from '../src/renderer/src/utils/liveNotifications';

// Keep unrelated startup services out of this real store/action integration test.
vi.mock('../utils/fetchQueue', () => ({ default: vi.fn() }));
vi.mock('../utils/services/connectionManager', () => ({ default: vi.fn() }));
vi.mock('../src/renderer/src/providers/CosmeticsProvider', () => ({ default: vi.fn() }));
vi.mock('../utils/services/seventv/stvAPI', () => ({ sendUserPresence: vi.fn() }));
vi.mock('../utils/services/kick/kickAPI', () => ({ getKickTalkDonators: vi.fn() }));
vi.mock('../src/renderer/src/utils/MessageParser', () => ({
  clearChatroomEmoteCache: vi.fn(),
  MessageParser: ({ message }) => message.content,
}));
vi.mock('../src/renderer/src/components/Cosmetics/Badges', () => ({
  KickBadges: () => null, KickTalkBadges: () => null, StvBadges: () => null,
}));
vi.mock('../src/renderer/src/components/Messages/ModActions', () => ({ default: () => null }));
vi.mock('../src/renderer/src/utils/ChatUtils', () => ({ getTimestampFormat: () => '' }));

describe('live notification settings', () => {
  it('is off for every streamer by default', () => {
    expect(isLiveNotificationEnabled(undefined, 42)).toBe(false);
    expect(isLiveNotificationEnabled({ streamers: [] }, 42)).toBe(false);
  });

  it('sets and unsets one streamer without touching others, matching string and numeric ids', () => {
    const on = withLiveNotification(withLiveNotification(undefined, 42, true), '7', true);
    expect(isLiveNotificationEnabled(on, '42')).toBe(true);
    expect(isLiveNotificationEnabled(on, 7)).toBe(true);
    expect(withLiveNotification(on, 42, true).streamers.filter((id) => id === '42')).toHaveLength(1);

    const off = withLiveNotification(on, 42, false);
    expect(isLiveNotificationEnabled(off, 42)).toBe(false);
    expect(isLiveNotificationEnabled(off, 7)).toBe(true);
  });
});

describe('resolving an IPC chatroom id', () => {
  // Chat views compare ids with ===, so a clicked notification must select the stored (numeric) id.
  it('returns the id the room is stored under, not the string received over IPC', () => {
    expect(findChatroomId([{ id: 7 }, { id: 42 }], '42')).toBe(42);
    expect(findChatroomId([{ id: 'abc' }], 'abc')).toBe('abc');
  });

  it('returns undefined for a room that no longer exists', () => {
    expect(findChatroomId([{ id: 7 }], '42')).toBeUndefined();
    expect(findChatroomId(undefined, '42')).toBeUndefined();
  });
});

describe('going live', () => {
  let useChatStore;
  let storeValues;
  let played;

  const event = (name, livestream) => ({ event: `App\\Events\\${name}`, data: JSON.stringify({ livestream }) });
  const livestream = (id, overrides = {}) => ({
    id, session_title: `title ${id}`, created_at: new Date().toISOString(), ...overrides,
  });
  const receive = async (name, stream) => {
    await useChatStore.getState().handleKickChannel(42, event(name, stream));
    await vi.advanceTimersByTimeAsync(0);
  };
  const shown = () => window.app.liveNotification.show.mock.calls.map(([payload]) => payload);

  beforeEach(async () => {
    vi.useFakeTimers();
    played = vi.fn(async () => {});
    storeValues = {
      liveNotifications: { streamers: ['42'] },
      notifications: { enabled: true, sound: true, volume: 0.5, soundFile: 'fixture.wav' },
      // Keep the in-chat "Stream started" row out of these assertions.
      chatrooms: { eventVisibility: { streamStatus: false } },
    };
    vi.stubGlobal('Audio', class { constructor() { this.volume = 1; } play() { return played(); } });
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
    vi.stubGlobal('window', {
      location: { pathname: '/fixture.html' },
      app: {
        store: { get: vi.fn(async (key) => storeValues[key]) },
        notificationSounds: { getSoundUrl: vi.fn(async () => 'data:audio/wav;base64,') },
        liveNotification: { show: vi.fn(async () => true) },
        telemetry: { recordError: vi.fn() },
      },
    });
    vi.resetModules();
    ({ default: useChatStore } = await import('../src/renderer/src/providers/ChatProvider.jsx'));
    useChatStore.setState({
      messages: {},
      chatrooms: [{ id: 42, username: 'streamer', isStreamerLive: false, streamerData: { user: { username: 'Streamer' } } }],
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('announces an opted-in streamer once, with name and title, and plays the notification sound', async () => {
    await receive('StreamerIsLive', livestream(1001));

    expect(shown()).toEqual([{ chatroomId: '42', streamerName: 'Streamer', streamTitle: 'title 1001' }]);
    expect(played).toHaveBeenCalledTimes(1);
    expect(useChatStore.getState().chatrooms[0].isStreamerLive).toBe(true);
  });

  it('stays silent for a streamer that is not switched on', async () => {
    storeValues.liveNotifications = { streamers: ['7'] };
    await receive('StreamerIsLive', livestream(1002));

    expect(shown()).toEqual([]);
    expect(played).not.toHaveBeenCalled();
    expect(useChatStore.getState().chatrooms[0].isStreamerLive).toBe(true);
  });

  it('stays silent for a stream already known live from the initial fetch or a previous session', async () => {
    useChatStore.getState().handleStreamStatus(42, { livestream: livestream(1003) }, true);
    await receive('StreamerIsLive', livestream(1003));
    await receive('LivestreamUpdated', livestream(1003, { session_title: 'new title' }));
    expect(shown()).toEqual([]);

    useChatStore.setState({ chatrooms: [{ id: 42, username: 'streamer', isStreamerLive: true }] });
    await receive('StreamerIsLive', livestream(1004));
    expect(shown()).toEqual([]);
  });

  it('does not repeat for the same livestream, but announces the next one after it ends', async () => {
    await receive('StreamerIsLive', livestream(1005));
    await receive('StreamerIsLive', livestream(1005));
    await receive('LivestreamUpdated', livestream(1005, { session_title: 'edited' }));
    expect(shown()).toHaveLength(1);

    await receive('StopStreamBroadcast', livestream(1005));
    await receive('StreamerIsLive', livestream(1006));
    expect(shown().map((payload) => payload.streamTitle)).toEqual(['title 1005', 'title 1006']);
  });

  it('announces a going-live that only arrives as LivestreamUpdated', async () => {
    await receive('LivestreamUpdated', livestream(1007));
    expect(shown()).toHaveLength(1);
  });

  it('ignores a stale live event replayed after reconnect or wake', async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await receive('StreamerIsLive', livestream(1008, { created_at: tenMinutesAgo }));

    expect(shown()).toEqual([]);
    expect(useChatStore.getState().chatrooms[0].isStreamerLive).toBe(true);
  });

  it.each([
    ['sound is off', { enabled: true, sound: false }],
    ['notifications are disabled', { enabled: false, sound: true }],
  ])('shows the notification but plays no sound when %s', async (_name, notifications) => {
    storeValues.notifications = notifications;
    await receive('StreamerIsLive', livestream(1009));

    expect(shown()).toHaveLength(1);
    expect(played).not.toHaveBeenCalled();
  });

  it('still updates live state when the notification cannot be shown', async () => {
    window.app.liveNotification.show.mockRejectedValue(new Error('unavailable'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await receive('StreamerIsLive', livestream(1010));

    expect(useChatStore.getState().chatrooms[0].isStreamerLive).toBe(true);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('LiveNotification'), expect.any(Error));
    error.mockRestore();
  });
});
