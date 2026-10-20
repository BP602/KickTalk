// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixtures = vi.hoisted(() => ({ expose: vi.fn(), messages: vi.fn() }));
vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: fixtures.expose },
  ipcRenderer: { invoke: vi.fn(async () => null), on: vi.fn(), send: vi.fn(), removeListener: vi.fn() },
  shell: {}, session: {},
}));
vi.mock('@electron-toolkit/preload', () => ({ electronAPI: {} }));
vi.mock('electron-store', () => ({ default: class { get() { return undefined; } clear() {} } }));
vi.mock('../utils/services/kick/kickAPI', () => ({
  sendMessageToChannel: vi.fn(), sendReplyToChannel: vi.fn(), getChannelInfo: vi.fn(),
  getChannelChatroomInfo: vi.fn(), getKickEmotes: vi.fn(), getSelfInfo: vi.fn(),
  getUserChatroomInfo: vi.fn(), getSelfChatroomInfo: vi.fn(), getSilencedUsers: vi.fn(),
  getLinkThumbnail: vi.fn(), getInitialChatroomMessages: fixtures.messages, getInitialPollInfo: vi.fn(),
  getSubmitPollVote: vi.fn(), getChatroomViewers: vi.fn(), getBanUser: vi.fn(),
  getUnbanUser: vi.fn(), getTimeoutUser: vi.fn(), getDeleteMessage: vi.fn(),
  getSilenceUser: vi.fn(), getUnsilenceUser: vi.fn(), getPinMessage: vi.fn(),
  getUnpinMessage: vi.fn(), getUpdateTitle: vi.fn(), getClearChatroom: vi.fn(),
}));
vi.mock('../utils/services/seventv/stvAPI', () => ({ getUserStvProfile: vi.fn(), getChannelEmotes: vi.fn() }));

let kick;
beforeEach(async () => {
  vi.resetModules();
  fixtures.expose.mockClear();
  fixtures.messages.mockReset();
  vi.stubGlobal('localStorage', { clear: vi.fn(), getItem: vi.fn(), setItem: vi.fn() });
  vi.stubGlobal('window', {});
  vi.stubGlobal('document', { addEventListener: vi.fn() });
  vi.stubGlobal('process', { ...process, contextIsolated: true });
  await import('../src/preload/index.js');
  kick = fixtures.expose.mock.calls.find(([name]) => name === 'app')?.[1]?.kick;
});
afterEach(() => vi.unstubAllGlobals());

describe('preload initial-load structured results', () => {
  it('classifies an HTTP rejection before crossing contextBridge', async () => {
    fixtures.messages.mockRejectedValueOnce({ response: { status: 503 } });
    await expect(kick.initialLoad.messages(501)).resolves.toEqual({ ok: false, failure: { type: 'http_error', status: 503 } });
  });
  it.each(['ETIMEDOUT', 'ECONNABORTED'])('classifies %s without inventing a status', async (code) => {
    fixtures.messages.mockRejectedValueOnce({ code });
    await expect(kick.initialLoad.messages(501)).resolves.toEqual({ ok: false, failure: { type: 'timeout' } });
  });

  it('resolves a plain Error as an allowlisted failure rather than rejecting', async () => {
    fixtures.messages.mockRejectedValueOnce(new Error('boom'));
    await expect(kick.initialLoad.messages(501)).resolves.toEqual({ ok: false, failure: { type: 'request_failed' } });
  });

  it('preserves the existing sanitized messages success shape', async () => {
    const response = { status: 200, data: { data: { messages: [] } }, headers: { private: 'discard' } };
    fixtures.messages.mockResolvedValue(response);
    const legacy = await kick.getInitialChatroomMessages(501);
    await expect(kick.initialLoad.messages(501)).resolves.toEqual({ ok: true, value: legacy });
    expect(legacy).toEqual({ status: 200, data: response.data });
  });

  it.each([99, 600, '503', undefined])('does not fabricate HTTP status from invalid status %s', async (status) => {
    fixtures.messages.mockRejectedValueOnce({ response: { status } });
    await expect(kick.initialLoad.messages(501)).resolves.toEqual({ ok: false, failure: { type: 'request_failed' } });
  });
  it('preserves direct chatroom and unauthenticated user/poll success shapes', async () => {
    const services = await import('../utils/services/kick/kickAPI');
    services.getChannelChatroomInfo.mockResolvedValue({ chatroom: { id: 1 } });
    await expect(kick.initialLoad.chatroomInfo('synthetic')).resolves.toEqual({
      ok: true, value: await kick.getChannelChatroomInfo('synthetic'),
    });
    await expect(kick.initialLoad.selfChatroomInfo('synthetic')).resolves.toEqual({
      ok: true, value: await kick.getSelfChatroomInfo('synthetic'),
    });
    await expect(kick.initialLoad.pollInfo('synthetic')).resolves.toEqual({
      ok: true, value: await kick.getInitialPollInfo('synthetic'),
    });
  });
});
