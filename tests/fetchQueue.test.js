// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import queueChannelFetch from '../utils/fetchQueue.js';

let getChannelInfo;
let recordAPIRequest;
beforeEach(() => {
  getChannelInfo = vi.fn();
  recordAPIRequest = vi.fn();
  vi.stubGlobal('window', { app: { kick: { getChannelInfo }, telemetry: { recordAPIRequest } } });
});
afterEach(() => vi.unstubAllGlobals());

it('resolves the error sentinel without inventing HTTP 500 on rejection', async () => {
  getChannelInfo.mockRejectedValueOnce(new Error('lookup failed'));
  await expect(queueChannelFetch('synthetic-channel')).resolves.toBe('error');
  expect(recordAPIRequest).not.toHaveBeenCalled();
});

it('preserves a statusless body without inventing HTTP 200', async () => {
  const body = { id: 501 };
  getChannelInfo.mockResolvedValueOnce(body);
  await expect(queueChannelFetch('synthetic-channel')).resolves.toBe(body);
  expect(recordAPIRequest).not.toHaveBeenCalled();
});

it.each([
  { status: 201 },
  { data: { status: { code: 503 } } },
  { status: { code: 404 } },
])('records only the exact supplied integer HTTP status in %j', async (body) => {
  getChannelInfo.mockResolvedValueOnce(body);
  await expect(queueChannelFetch('synthetic-channel')).resolves.toBe(body);
  const status = Number.isInteger(body.status) ? body.status : body.data?.status?.code ?? body.status.code;
  expect(recordAPIRequest).toHaveBeenCalledExactlyOnceWith('kick_get_channel_info', 'GET', status, expect.any(Number));
});
