import { afterEach, beforeEach, vi, expect } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'
import * as React from 'react'
import { createRequire } from 'module'

// Extend expect with jest-dom matchers
expect.extend(matchers)

// Some test files rely on a Jest-style vi.requireActual
if (typeof vi.requireActual !== 'function') {
  vi.requireActual = (id) => {
    if (id === 'react') return React
    throw new Error(
      `[vitest.setup.jsdom] vi.requireActual(${id}) is not supported. ` +
      `Import the module directly or use vi.importActual().`
    )
  }
}

// Make React available globally
if (typeof globalThis.React === 'undefined') {
  globalThis.React = React
}

// Allow requiring .jsx in tests that use CommonJS require()
try {
  const requireCjs = createRequire(import.meta.url)
  const Module = requireCjs('module')
  if (!Module._extensions['.jsx']) {
    Module._extensions['.jsx'] = Module._extensions['.js']
  }
} catch {}

// Pre-mock zustand/react/shallow
try {
  vi.mock('zustand/react/shallow', () => {
    const useShallow = vi.fn((fn) => fn)
    return { useShallow }
  })
} catch {}

// Provide className-based queries
if (screen) {
  const findAllByClass = (className, container = document) => {
    try {
      return Array.from(container.querySelectorAll(`.${className}`))
    } catch {
      return []
    }
  }
  const findByClass = (className, container) => {
    const all = findAllByClass(className, container)
    return all.length > 0 ? all[0] : null
  }
  screen.findAllByClass = findAllByClass
  screen.findByClass = findByClass
}

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Setup clipboard API
if (!('clipboard' in navigator)) {
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: vi.fn().mockResolvedValue(),
      readText: vi.fn().mockResolvedValue(''),
    },
    configurable: true,
    writable: true,
    enumerable: true,
  })
}

if (typeof globalThis.ClipboardEvent === 'undefined') {
  globalThis.ClipboardEvent = function ClipboardEvent() {}
}

// Mock Electron APIs
global.electronAPI = {
  getChatroomInfo: vi.fn().mockResolvedValue({ id: 'test-chatroom', title: 'Test Chatroom' }),
  getStoredValue: vi.fn().mockResolvedValue(null),
  setStoredValue: vi.fn(),
  deleteStoredValue: vi.fn(),
  deleteDatabase: vi.fn(),
  getAppInfo: vi.fn().mockResolvedValue({ version: '1.0.0', name: 'KickTalk' }),
  openExternalURL: vi.fn(),
  onChatroomUpdate: vi.fn(() => vi.fn()),
  onStorageChange: vi.fn(() => vi.fn()),
  onAuthUpdate: vi.fn(() => vi.fn()),
  requestOAuth: vi.fn(),
  alwaysOnTop: vi.fn(),
  logout: vi.fn(),
  settingsDialog: vi.fn(),
  toggleMaximize: vi.fn(),
  toggleMinimize: vi.fn(),
  toggleClose: vi.fn(),
  rendererReady: vi.fn(),
  otelGetConfig: vi.fn().mockResolvedValue({}),
  telemetryTrace: vi.fn(),
  reportError: vi.fn(),
  reportPerformance: vi.fn(),
}

// Mock window.app
global.window = global.window || {}
global.window.app = {
  getAppInfo: vi.fn().mockResolvedValue({ 
    version: '1.1.8', 
    name: 'KickTalk',
    platform: 'test'
  }),
  settingsDialog: {
    open: vi.fn(),
    onData: vi.fn((cb) => {
      global.mockSettingsCallback = cb
      return vi.fn()
    }),
  },
  notificationSounds: {
    getAll: vi.fn().mockResolvedValue(['default.wav', 'bell.wav']),
    play: vi.fn(),
  },
  userDialog: {
    open: vi.fn(),
    onData: vi.fn((cb) => vi.fn()),
  },
  logs: {
    updateDeleted: vi.fn(),
    get: vi.fn().mockResolvedValue([]),
  },
  ipc: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn()
  },
  telemetry: {
    recordRendererMemory: vi.fn(),
    recordDomNodeCount: vi.fn(),
    recordSevenTVConnectionHealth: vi.fn(),
  },
  kick: {
    getUserChatroomInfo: vi.fn().mockResolvedValue({ data: { id: 'user123', username: 'testuser', slug: 'testuser' } }),
    getSelfInfo: vi.fn().mockResolvedValue({ id: 'user123', username: 'self' }),
    getSelfChatroomInfo: vi.fn().mockResolvedValue({ data: {} }),
    getChannelChatroomInfo: vi.fn().mockResolvedValue({ data: {} }),
    getEmotes: vi.fn().mockResolvedValue({ data: [] }),
    getInitialChatroomMessages: vi.fn().mockResolvedValue({ data: [] }),
    getInitialPollInfo: vi.fn().mockResolvedValue({ data: null }),
    getPinMessage: vi.fn().mockResolvedValue({}),
    getUnpinMessage: vi.fn().mockResolvedValue({}),
    getSilenceUser: vi.fn(),
    getUnsilenceUser: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue({ success: true }),
    sendReply: vi.fn().mockResolvedValue({ success: true }),
  }
}

// Mock CSS imports
vi.mock('*.scss', () => ({}))
vi.mock('*.css', () => ({}))
vi.mock('*.svg', () => 'test-file-stub')
vi.mock('*.png', () => 'test-file-stub')
vi.mock('*.jpg', () => 'test-file-stub')

// Mock Lexical plugins
vi.mock('@lexical/react/LexicalPlainTextPlugin', () => ({
  PlainTextPlugin: () => null,
}))

vi.mock('@lexical/react/LexicalAutoFocusPlugin', () => ({
  AutoFocusPlugin: () => null,
}))

vi.mock('@lexical/react/LexicalComposer', () => ({
  LexicalComposer: ({ children }) => children,
}))

vi.mock('@lexical/react/LexicalContentEditable', () => ({
  ContentEditable: () => null,
}))

vi.mock('@lexical/react/LexicalHistoryPlugin', () => ({
  HistoryPlugin: () => null,
}))

vi.mock('@lexical/react/LexicalErrorBoundary', () => ({
  LexicalErrorBoundary: ({ children }) => children,
}))

vi.mock('@lexical/react/LexicalComposerContext', () => ({
  useLexicalComposerContext: () => [{
    update: (fn) => fn?.(),
    focus: () => {},
    registerCommand: () => () => {},
    registerNodeTransform: () => () => {},
    registerUpdateListener: () => () => {},
    getRootElement: () => document.createElement('div'),
  }],
}))

vi.mock('@lexical/react', () => ({
  LexicalComposer: ({ children }) => children,
  PlainTextPlugin: () => null,
  RichTextPlugin: () => null,
  ContentEditable: () => null,
  HistoryPlugin: () => null,
  AutoFocusPlugin: () => null,
  LexicalErrorBoundary: {},
  useLexicalComposerContext: () => [{
    update: (fn) => fn?.(),
    focus: () => {},
    registerCommand: () => () => {},
    registerNodeTransform: () => () => {},
    registerUpdateListener: () => () => {},
    getRootElement: () => document.createElement('div'),
  }],
}))

vi.mock('@lexical/text', () => ({
  $rootTextContent: () => '',
}))

// Setup WebSocket mock
const WebSocketMock = vi.fn(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1,
}))
WebSocketMock.CONNECTING = 0
WebSocketMock.OPEN = 1
WebSocketMock.CLOSING = 2
WebSocketMock.CLOSED = 3
global.WebSocket = WebSocketMock

// Prevent unhandled errors from crashing tests
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    event.preventDefault?.()
    console.warn('[vitest.setup.jsdom] window error suppressed:', event?.error || event?.message)
  })
  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault?.()
    console.warn('[vitest.setup.jsdom] unhandledrejection suppressed:', event?.reason)
  })
}

// Clean up after each test
afterEach(async () => {
  await cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

// Ensure clipboard spies are fresh for every test
beforeEach(() => {
  try {
    if (navigator?.clipboard) {
      const w = navigator.clipboard.writeText
      if (!w || typeof w !== 'function' || !('mock' in w)) {
        Object.defineProperty(navigator.clipboard, 'writeText', {
          value: vi.fn().mockResolvedValue(),
          configurable: true,
          writable: true,
        })
      }
    }
  } catch {}
})
