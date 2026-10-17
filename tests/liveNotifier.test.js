import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const { createLiveNotifier, sanitizeLiveNotification } =
  createRequire(import.meta.url)('../src/main/services/liveNotification.cjs');

class FakeNotification {
  static supported = true;
  static instances = [];
  static isSupported() { return FakeNotification.supported; }
  constructor(options) {
    this.options = options;
    this.handlers = {};
    this.show = vi.fn();
    FakeNotification.instances.push(this);
  }
  on(name, handler) { this.handlers[name] = handler; }
}

const makeWindow = () => ({
  isDestroyed: () => false,
  isMinimized: vi.fn(() => true),
  restore: vi.fn(),
  show: vi.fn(),
  focus: vi.fn(),
  webContents: { send: vi.fn() },
});

const setup = (window = makeWindow()) => {
  FakeNotification.supported = true;
  FakeNotification.instances = [];
  return { window, notifier: createLiveNotifier({ Notification: FakeNotification, getMainWindow: () => window }) };
};

describe('sanitizeLiveNotification', () => {
  it.each([
    [null], ['text'], [{}],
    [{ chatroomId: 'abc', streamerName: 'x' }],
    [{ chatroomId: '1; drop', streamerName: 'x' }],
    [{ chatroomId: 5, streamerName: '   ' }],
    [{ chatroomId: 5, streamerName: { toString: () => 'x' } }],
  ])('rejects %j', (payload) => {
    expect(sanitizeLiveNotification(payload)).toBeNull();
  });

  it('normalizes and bounds renderer-supplied text', () => {
    const result = sanitizeLiveNotification({
      chatroomId: 42, streamerName: ' A\n\nname ', streamTitle: 't'.repeat(500),
    });
    expect(result).toEqual({ chatroomId: '42', streamerName: 'A name', streamTitle: 't'.repeat(200) });
    expect(sanitizeLiveNotification({ chatroomId: 42, streamerName: 'a', streamTitle: 7 }).streamTitle).toBe('');
  });
});

describe('createLiveNotifier', () => {
  it('shows a silent native notification with streamer and title', () => {
    const { notifier } = setup();
    expect(notifier.show({ chatroomId: '42', streamerName: 'Streamer', streamTitle: 'Playing' })).toBe(true);

    const [notification] = FakeNotification.instances;
    expect(notification.options).toEqual({ title: 'Streamer is live', body: 'Playing', silent: true });
    expect(notification.show).toHaveBeenCalledTimes(1);
  });

  it('shows nothing for invalid payloads or when the OS has no notification support', () => {
    const { notifier } = setup();
    expect(notifier.show({ chatroomId: 'nope', streamerName: 'x' })).toBe(false);
    FakeNotification.supported = false;
    expect(notifier.show({ chatroomId: '42', streamerName: 'x' })).toBe(false);
    expect(FakeNotification.instances).toHaveLength(0);
  });

  it('click restores and focuses the window and asks the renderer to select that room', () => {
    const { notifier, window } = setup();
    notifier.show({ chatroomId: '42', streamerName: 'Streamer' });
    FakeNotification.instances[0].handlers.click();

    expect(window.restore).toHaveBeenCalled();
    expect(window.show).toHaveBeenCalled();
    expect(window.focus).toHaveBeenCalled();
    expect(window.webContents.send).toHaveBeenCalledWith('chatroom:select', { chatroomId: '42' });
  });

  it('click after the window is gone does nothing', () => {
    const { notifier, window } = setup();
    notifier.show({ chatroomId: '42', streamerName: 'Streamer' });
    window.isDestroyed = () => true;
    expect(() => FakeNotification.instances[0].handlers.click()).not.toThrow();
    expect(window.webContents.send).not.toHaveBeenCalled();
  });
});
