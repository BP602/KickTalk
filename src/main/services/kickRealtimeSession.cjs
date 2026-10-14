'use strict';

const sessionError = (reason, code, fatal = true) => Object.assign(new Error(reason), { reason, code, fatal });

// The realtime service resolves account identity in main, never from IPC/localStorage.
function createRealtimeSessionProvider(authStore, fetchImpl = globalThis.fetch) {
  let cached = null;
  return async () => {
    const token = authStore.get('SESSION_TOKEN');
    const session = authStore.get('KICK_SESSION');
    if (!token && !session) { cached = null; return {}; }
    if (!token || !session) throw sessionError('realtime_auth_incomplete');
    if (cached?.token === token && cached?.session === session) return cached;
    let response;
    try {
      response = await fetchImpl('https://kick.com/api/v1/user', {
        headers: { accept: 'application/json', authorization: `Bearer ${token}`, 'x-xsrf-token': session },
        redirect: 'error', signal: AbortSignal.timeout(15000),
      });
    } catch { throw sessionError('realtime_identity_network_error', undefined, false); }
    if (!response.ok) {
      throw sessionError(response.status === 401 || response.status === 403 ? 'realtime_auth_denied' : 'realtime_identity_unavailable',
        response.status, response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429);
    }
    let body;
    try { body = await response.json(); }
    catch { throw sessionError('realtime_identity_invalid_response'); }
    const userId = body?.id ?? body?.data?.id;
    if (!Number.isSafeInteger(userId) || userId <= 0) throw sessionError('realtime_identity_unavailable');
    cached = { token, session, userId };
    return cached;
  };
}

module.exports = { createRealtimeSessionProvider };
