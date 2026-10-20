// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import * as stv from '../utils/services/seventv/stvAPI';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));

const owner = { id: 'owner' };
const file = { name: '1x.webp', width: 32 };
const rawEmote = { id: 'emote', actor_id: 'actor', flags: 1, name: 'Alias', timestamp: 42,
  data: { name: 'Original', owner, host: { files: [file] } } };
const globalData = { id: 'global', name: 'Global', emote_count: 1, capacity: 100, emotes: [rawEmote] };
const channelData = { ...globalData, id: 'channel', name: 'Channel', owner };
const formattedEmote = (type) => ({ id: 'emote', actor_id: 'actor', flags: 1, name: 'Alias',
  alias: 'Original', owner, file, added_timestamp: 42, platform: '7tv', type });
const globalSets = [{ setInfo: { id: 'global', name: 'Global', emote_count: 1, capacity: 100 },
  emotes: [formattedEmote('global')], type: 'global' }];
const allSets = [...globalSets, { setInfo: { id: 'channel', name: 'Channel', owner, emote_count: 1, capacity: 100 },
  user: { id: 'user' }, emotes: [formattedEmote('channel')], type: 'channel' }];
const queueSuccess = () => axios.get.mockResolvedValueOnce({ status: 200, data: globalData })
  .mockResolvedValueOnce({ status: 200, data: { emote_set: channelData, user: { id: 'user' } } });

beforeEach(() => axios.get.mockReset());

describe('7TV channel emote producer results', () => {
  it('exposes successful formatted sets while preserving the legacy value', async () => {
    queueSuccess();
    await expect(stv.getChannelEmotesResult(123)).resolves.toEqual({ emotes: allSets });
    queueSuccess();
    await expect(stv.getChannelEmotes(123)).resolves.toEqual(allSets);
  });

  it.each([
    ['global 503 rejection', 'global', { response: { status: 503 } }, [], true],
    ['global 404 rejection', 'global', { response: { status: 404 } }, [], true],
    ['channel 500 rejection', 'channel', { response: { status: 500 } }, globalSets, true],
    ['channel 404 rejection', 'channel', { response: { status: 404 } }, globalSets, false],
  ])('preserves fallback values and reports %s', async (_name, phase, error, expected, failed) => {
    const queue = () => {
      if (phase === 'channel') axios.get.mockResolvedValueOnce({ status: 200, data: globalData });
      axios.get.mockRejectedValueOnce(error);
    };
    queue();
    const result = await stv.getChannelEmotesResult(123);
    expect(result).toEqual(failed ? { emotes: expected, failure: { error } } : { emotes: expected });
    if (failed) expect(result.failure.error).toBe(error);
    queue();
    await expect(stv.getChannelEmotes(123)).resolves.toEqual(expected);
  });

  it.each([404, 500])('reports resolved channel %s as failure, unlike a rejected 404', async (status) => {
    const queue = () => axios.get.mockResolvedValueOnce({ status: 200, data: globalData })
      .mockResolvedValueOnce({ status, data: {} });
    queue();
    await expect(stv.getChannelEmotesResult(123)).resolves.toEqual({ emotes: globalSets, failure: { status } });
    queue();
    await expect(stv.getChannelEmotes(123)).resolves.toEqual(globalSets);
  });

  it('retains the real status when a resolved global response fails', async () => {
    axios.get.mockResolvedValueOnce({ status: 503 });
    const result = await stv.getChannelEmotesResult(123);
    expect(result.emotes).toEqual([]);
    expect(result.failure.error).toBeInstanceOf(Error);
    expect(result.failure.error.response.status).toBe(503);
    axios.get.mockResolvedValueOnce({ status: 503 });
    await expect(stv.getChannelEmotes(123)).resolves.toEqual([]);
  });

  it.each([globalData, undefined])('treats a channel without a set as success and preserves even undefined globals', async (data) => {
    const queue = () => axios.get.mockResolvedValueOnce({ status: 200, data })
      .mockResolvedValueOnce({ status: 200, data: {} });
    const expected = data ? globalSets : undefined;
    queue();
    await expect(stv.getChannelEmotesResult(123)).resolves.toEqual({ emotes: expected });
    queue();
    await expect(stv.getChannelEmotes(123)).resolves.toEqual(expected);
  });
});
