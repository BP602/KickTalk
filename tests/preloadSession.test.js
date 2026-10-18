// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  authData: new Map(),
  authClear: vi.fn(),
  getSelfInfo: vi.fn(),
  exposed: {},
}));

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (name, api) => { hoisted.exposed[name] = api; },
  },
  ipcRenderer: {
    invoke: vi.fn(async () => null),
    on: vi.fn(),
    send: vi.fn(),
    removeListener: vi.fn(),
  },
  shell: { openExternal: vi.fn() },
  session: {},
}));

vi.mock('@electron-toolkit/preload', () => ({ electronAPI: {} }));

vi.mock('electron-store', () => ({
  default: class MockStore {
    get(key) { return hoisted.authData.get(key); }
    set(key, value) { hoisted.authData.set(key, value); }
    delete(key) { hoisted.authData.delete(key); }
    clear() { hoisted.authClear(); hoisted.authData.clear(); }
  },
}));

vi.mock('../utils/services/kick/kickAPI', () => ({
  sendMessageToChannel: vi.fn(),
  sendReplyToChannel: vi.fn(),
  getChannelInfo: vi.fn(),
  getChannelChatroomInfo: vi.fn(),
  getKickEmotes: vi.fn(),
  getSelfInfo: hoisted.getSelfInfo,
  getUserChatroomInfo: vi.fn(),
  getSelfChatroomInfo: vi.fn(),
  getSilencedUsers: vi.fn(),
  getLinkThumbnail: vi.fn(),
  getInitialChatroomMessages: vi.fn(),
  getInitialPollInfo: vi.fn(),
  getSubmitPollVote: vi.fn(),
  getChatroomViewers: vi.fn(),
  getBanUser: vi.fn(),
  getUnbanUser: vi.fn(),
  getTimeoutUser: vi.fn(),
  getDeleteMessage: vi.fn(),
  getSilenceUser: vi.fn(),
  getUnsilenceUser: vi.fn(),
  getPinMessage: vi.fn(),
  getUnpinMessage: vi.fn(),
  getUpdateTitle: vi.fn(),
  getClearChatroom: vi.fn(),
}));

vi.mock('../utils/services/seventv/stvAPI', () => ({
  getUserStvProfile: vi.fn(),
  getChannelEmotes: vi.fn(),
}));

const SAVED_CHATROOMS = JSON.stringify([{ id: 42, streamerName: 'fixture' }]);

function seedLocalStorage() {
  const data = new Map([
    ['chatrooms', SAVED_CHATROOMS],
    ['chatrooms_version', '2'],
    ['unrelatedSetting', 'keep-me'],
  ]);
  vi.stubGlobal('localStorage', {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
  });
  return data;
}

async function loadPreload() {
  vi.resetModules();
  hoisted.exposed = {};
  process.contextIsolated = true;
  await import('../src/preload/index.js');
  await vi.waitFor(() => expect(hoisted.exposed.app?.auth).toBeDefined());
  await vi.waitFor(() => expect(hoisted.authClear).toHaveBeenCalled());
}

describe('signed-out preload session validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.authData.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('preserves saved chatrooms and unrelated keys when session tokens are missing', async () => {
    const storage = seedLocalStorage();
    await loadPreload();

    expect(hoisted.authClear).toHaveBeenCalled();
    expect(storage.get('chatrooms')).toBe(SAVED_CHATROOMS);
    expect(storage.get('chatrooms_version')).toBe('2');
    expect(storage.get('unrelatedSetting')).toBe('keep-me');
  });

  it('preserves saved chatrooms when tokens exist but no user ID is returned', async () => {
    const storage = seedLocalStorage();
    hoisted.authData.set('SESSION_TOKEN', 'fixture-token');
    hoisted.authData.set('KICK_SESSION', 'fixture-session');
    hoisted.getSelfInfo.mockResolvedValue({ data: {} });
    await loadPreload();

    expect(hoisted.authClear).toHaveBeenCalled();
    expect(storage.get('chatrooms')).toBe(SAVED_CHATROOMS);
    expect(storage.get('chatrooms_version')).toBe('2');
    expect(storage.get('unrelatedSetting')).toBe('keep-me');
  });
});
