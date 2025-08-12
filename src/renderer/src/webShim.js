// Minimal shim to run the renderer in a plain browser without Electron
// Provides window.app with no-op or localStorage-backed implementations
// In web preview only (gated by __WEB_PREVIEW__)
import { buildChannelInfo, buildEmotes, buildInitialMessages, buildSelfChatroomInfo } from '@renderer/mocks/fixtures';

if (typeof window !== 'undefined' && typeof __WEB_PREVIEW__ !== 'undefined' && __WEB_PREVIEW__) {
  const SETTINGS_KEY = 'kt_settings';

  const readAll = () => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const writeAll = (obj) => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(obj));
    } catch {}
  };

  const updateListeners = new Set();

  const store = {
    async get(key) {
      const all = readAll();
      return key ? all?.[key] : all;
    },
    async set(key, value) {
      const all = readAll();
      let patch = {};
      if (typeof key === 'object' && key !== null) {
        patch = key;
        Object.assign(all, key);
      } else {
        all[key] = value;
        patch = { [key]: value };
      }
      writeAll(all);
      updateListeners.forEach((cb) => {
        try { cb(patch); } catch {}
      });
      return true;
    },
    onUpdate(cb) {
      updateListeners.add(cb);
      return () => updateListeners.delete(cb);
    },
  };

  const makeDialog = () => ({
    open: () => {},
    close: () => {},
    onData: () => () => {},
    pin: async () => {},
  });

  const noopAsync = async () => {};

  const app = {
    // window controls
    minimize: () => {},
    maximize: () => {},
    close: () => {},

    // app info
    async getAppInfo() {
      return { name: 'KickTalk', version: 'web-preview', appVersion: 'web-preview' };
    },

    // settings store
    store,

    // dialogs
    settingsDialog: makeDialog(),
    userDialog: makeDialog(),
    authDialog: makeDialog(),
    searchDialog: makeDialog(),
    chattersDialog: makeDialog(),
    reply: makeDialog(),
    replyThreadDialog: makeDialog(),
    contextMenu: makeDialog(),

    // update system
    update: {
      onUpdate: () => () => {},
      onDismiss: () => () => {},
      async checkForUpdates() { return { available: false }; },
      async downloadUpdate() { return { downloaded: true }; },
      installUpdate: () => {},
    },

    // logs APIs
    logs: {
      onUpdate: () => () => {},
      async get() { return { messages: [] }; },
      add: () => {},
    },
    replyLogs: {
      onUpdate: () => () => {},
      add: () => {},
    },

    // auth
    auth: {
      getToken: () => null,
    },

    // kick APIs (stubs)
    kick: {
      async getUserChatroomInfo() { return { data: null }; },
      async getSelfInfo() { return null; },
      async sendMessage() { return { ok: true }; },
      async sendReply() { return { ok: true }; },
      async getChannelInfo(input) { return buildChannelInfo(input); },
      async getSelfChatroomInfo(slug) { return buildSelfChatroomInfo(slug); },
      async getEmotes(slug) { return buildEmotes(slug); },
      async getChannelChatroomInfo() { return { data: { livestream: null } }; },
      async getInitialChatroomMessages(chatroomId) { return buildInitialMessages(chatroomId); },
      async getPinMessage() { return { ok: true }; },
      async getUnpinMessage() { return { ok: true }; },
      getSilenceUser: noopAsync,
      getUnsilenceUser: noopAsync,
    },

    // mod actions
    modActions: {
      getTimeoutUser: noopAsync,
      getUnbanUser: noopAsync,
      getBanUser: noopAsync,
    },

    // 7TV APIs (stubs)
    stv: {
      async getChannelEmotes() { return []; },
    },

    // notifications
    notificationSounds: [],

    // utils
    utils: {
      openExternal: (url) => {
        try { window.open(url, '_blank', 'noopener,noreferrer'); } catch {}
      },
    },
  };

  // expose (augment existing for HMR friendliness)
  const existing = window.app || {};
  window.app = {
    ...existing,
    ...app,
    // merge nested objects to avoid clobbering
    kick: { ...(existing.kick || {}), ...(app.kick || {}) },
    stv: { ...(existing.stv || {}), ...(app.stv || {}) },
    logs: { ...(existing.logs || {}), ...(app.logs || {}) },
    replyLogs: { ...(existing.replyLogs || {}), ...(app.replyLogs || {}) },
    update: { ...(existing.update || {}), ...(app.update || {}) },
    utils: { ...(existing.utils || {}), ...(app.utils || {}) },
  };
}
