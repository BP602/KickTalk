// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixtures = vi.hoisted(() => ({
  expose: vi.fn(), messages: vi.fn(), selfChatroomInfo: vi.fn(), pollInfo: vi.fn(), tokens: {},
}));
vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: fixtures.expose },
  ipcRenderer: { invoke: vi.fn(async () => null), on: vi.fn(), send: vi.fn(), removeListener: vi.fn() },
  shell: {}, session: {},
}));
vi.mock('@electron-toolkit/preload', () => ({ electronAPI: {} }));
vi.mock('electron-store', () => ({ default: class { get(key) { return fixtures.tokens[key]; } clear() {} } }));
vi.mock('../utils/services/kick/kickAPI', () => ({
  sendMessageToChannel: vi.fn(), sendReplyToChannel: vi.fn(), getChannelInfo: vi.fn(),
  getChannelChatroomInfo: vi.fn(), getKickEmotes: vi.fn(), getSelfInfo: vi.fn(async () => ({ data: { id: 123 } })),
  getUserChatroomInfo: vi.fn(), getSelfChatroomInfo: fixtures.selfChatroomInfo, getSilencedUsers: vi.fn(async () => ({ status: 200, data: [] })),
  getLinkThumbnail: vi.fn(), getInitialChatroomMessages: fixtures.messages, getInitialPollInfo: fixtures.pollInfo,
  getSubmitPollVote: vi.fn(), getChatroomViewers: vi.fn(), getBanUser: vi.fn(),
  getUnbanUser: vi.fn(), getTimeoutUser: vi.fn(), getDeleteMessage: vi.fn(),
  getSilenceUser: vi.fn(), getUnsilenceUser: vi.fn(), getPinMessage: vi.fn(),
  getUnpinMessage: vi.fn(), getUpdateTitle: vi.fn(), getClearChatroom: vi.fn(),
}));
vi.mock('../utils/services/seventv/stvAPI', () => ({
  getUserStvProfile: vi.fn(), getChannelEmotes: vi.fn(), getChannelEmotesResult: vi.fn(),
}));

let kick;
const loadPreload = async (tokens = {}) => {
  vi.resetModules();
  fixtures.tokens = tokens;
  fixtures.expose.mockClear();
  vi.stubGlobal('localStorage', { clear: vi.fn(), getItem: vi.fn(), setItem: vi.fn() });
  vi.stubGlobal('window', {});
  vi.stubGlobal('document', { addEventListener: vi.fn() });
  vi.stubGlobal('process', { ...process, contextIsolated: true });
  await import('../src/preload/index.js');
  kick = fixtures.expose.mock.calls.find(([name]) => name === 'app')?.[1]?.kick;
};
beforeEach(async () => {
  fixtures.messages.mockReset();
  fixtures.selfChatroomInfo.mockReset();
  fixtures.pollInfo.mockReset();
  await loadPreload();
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

  it.each(['kick', '7tv'])('preserves direct %s emote values and classifies failures at the preload seam', async (provider) => {
    const services = provider === 'kick'
      ? await import('../utils/services/kick/kickAPI')
      : await import('../utils/services/seventv/stvAPI');
    const service = provider === 'kick' ? services.getKickEmotes : services.getChannelEmotesResult;
    const method = provider === 'kick' ? 'channelEmotes' : 'channel7tvEmotes';
    const input = provider === 'kick' ? 'synthetic-room' : 1001;
    const value = [{ id: 'synthetic-emote', name: 'Emote' }];
    service.mockReset();
    service.mockResolvedValueOnce(provider === 'kick' ? value : { emotes: value });
    await expect(kick.initialLoad[method](input)).resolves.toEqual({ ok: true, value });
    expect(service).toHaveBeenLastCalledWith(input);
    service.mockRejectedValueOnce({ response: { status: 503, headers: { authorization: 'secret' } } });
    await expect(kick.initialLoad[method](input)).resolves.toEqual({
      ok: false, failure: { type: 'http_error', status: 503 },
    });
  });

  it.each([
    [{ error: { response: { status: 500, data: { private: 'secret' } }, config: { token: 'secret' } } }, { type: 'http_error', status: 500 }],
    [{ status: 503 }, { type: 'http_error', status: 503 }],
    [{ status: 404 }, { type: 'http_error', status: 404 }],
    [{ error: { code: 'ETIMEDOUT' } }, { type: 'timeout' }],
    [{ status: '503' }, { type: 'request_failed' }],
  ])('preserves 7TV fallback sets but exposes only the classified producer failure', async (failure, classified) => {
    const services = await import('../utils/services/seventv/stvAPI');
    const value = [{ setInfo: { id: 'global' }, type: 'global', emotes: [] }];
    services.getChannelEmotesResult.mockResolvedValueOnce({ emotes: value, failure });
    const result = await kick.initialLoad.channel7tvEmotes(1001);
    expect(result).toEqual({ ok: false, failure: classified, value });
    expect(result.value).toBe(value);
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it.each([
    ['selfChatroomInfo', 'selfChatroomInfo'],
    ['pollInfo', 'pollInfo'],
  ])('passes imported credentials to authenticated %s and sanitizes its success', async (method, fixture) => {
    await loadPreload({ SESSION_TOKEN: 'synthetic-token', KICK_SESSION: 'synthetic-session' });
    const response = {
      status: 200,
      data: { data: { id: 501 } },
      headers: { authorization: 'discard' },
      config: { private: 'discard' },
    };
    fixtures[fixture].mockResolvedValueOnce(response);

    await expect(kick.initialLoad[method]('synthetic-room')).resolves.toEqual({
      ok: true, value: { status: 200, data: response.data },
    });
    expect(fixtures[fixture]).toHaveBeenCalledExactlyOnceWith(
      'synthetic-room', 'synthetic-token', 'synthetic-session',
    );
  });

  it.each([
    ['selfChatroomInfo', 'selfChatroomInfo'],
    ['pollInfo', 'pollInfo'],
  ])('classifies authenticated %s HTTP rejection before crossing contextBridge', async (method, fixture) => {
    await loadPreload({ SESSION_TOKEN: 'synthetic-token', KICK_SESSION: 'synthetic-session' });
    fixtures[fixture].mockRejectedValueOnce({ response: { status: 503 } });

    await expect(kick.initialLoad[method]('synthetic-room')).resolves.toEqual({
      ok: false, failure: { type: 'http_error', status: 503 },
    });
    expect(fixtures[fixture]).toHaveBeenCalledExactlyOnceWith(
      'synthetic-room', 'synthetic-token', 'synthetic-session',
    );
  });
});
