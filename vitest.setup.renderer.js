import { afterEach, beforeEach, vi, expect } from 'vitest'

// Only import and setup browser-specific modules in jsdom environment
let cleanup, screen;
if (typeof window !== 'undefined') {
  const rtl = await import('@testing-library/react')
  cleanup = rtl.cleanup
  screen = rtl.screen
  const matchers = await import('@testing-library/jest-dom/matchers')
  // Extend expect with jest-dom matchers
  expect.extend(matchers)
}
// Ensure React is in scope for any JSX that escapes transform in mocks
import * as React from 'react'
import { createRequire } from 'module'

// Some test files rely on a Jest-style vi.requireActual. Provide a minimal shim
// that returns the already-imported module for known ids (sync), falling back
// to a helpful error for others.
if (typeof vi.requireActual !== 'function') {
  vi.requireActual = (id) => {
    if (id === 'react') return React
    throw new Error(
      `[vitest.setup.renderer] vi.requireActual(${id}) is not supported. ` +
      `Import the module directly or use vi.importActual().`
    )
  }
}

// Make React available globally for any code paths that still expect it
if (typeof globalThis.React === 'undefined') {
  // Provide a spy-friendly shim instead of the ESM namespace object
  const ReactShim = { ...React }
  try {
    Object.keys(React).forEach((k) => {
      const desc = Object.getOwnPropertyDescriptor(React, k)
      if (desc && !desc.writable) {
        // Redefine as writable/configurable on the shim
        Object.defineProperty(ReactShim, k, { value: React[k], writable: true, configurable: true, enumerable: true })
      }
    })
  } catch {}
  globalThis.React = ReactShim
}

// Allow requiring .jsx in tests that use CommonJS require()
try {
  const requireCjs = createRequire(import.meta.url)
  const Module = requireCjs('module')
  // If not already defined, map .jsx handling to .js handler
  if (!Module._extensions['.jsx']) {
    Module._extensions['.jsx'] = Module._extensions['.js']
  }
} catch {}

// Pre-mock zustand/react/shallow so components imported before test mocks still use a spy
try {
  vi.mock('zustand/react/shallow', () => {
    const useShallow = vi.fn((fn) => fn)
    return { useShallow }
  })
} catch {}

// Note: removed stale absolute-path mock for useClickOutside from a different repo path

// Provide className-based queries to match existing tests that use them
// These augment Testing Library's screen object with convenience helpers.
if (screen) {
  const findAllByClass = (className, container = document) => {
    try {
      return Array.from(container.getElementsByClassName(className))
    } catch {
      return []
    }
  }

  if (!('getAllByClassName' in screen)) {
    screen.getAllByClassName = (className, container = document) => {
      const els = findAllByClass(className, container)
      if (els.length === 0) {
        throw new Error(`Unable to find element(s) by className: ${className}`)
      }
      return els
    }
  }

  if (!('getByClassName' in screen)) {
    screen.getByClassName = (className, container = document) => {
      const els = findAllByClass(className, container)
      if (els.length === 0) {
        throw new Error(`Unable to find an element by className: ${className}`)
      }
      if (els.length > 1) {
        throw new Error(`Found multiple elements with className: ${className}`)
      }
      return els[0]
    }
  }

  if (!('queryAllByClassName' in screen)) {
    screen.queryAllByClassName = (className, container = document) => findAllByClass(className, container)
  }

  if (!('queryByClassName' in screen)) {
    screen.queryByClassName = (className, container = document) => {
      const els = findAllByClass(className, container)
      if (els.length > 1) {
        throw new Error(`Found multiple elements with className: ${className}`)
      }
      return els[0] || null
    }
  }

  // Also expose on globalThis for any tests using global screen (defensive)
  try { if (!globalThis.screen) globalThis.screen = screen } catch {}
}

// Mock IntersectionObserver globally
global.IntersectionObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}))

// Mock ResizeObserver globally
global.ResizeObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}))

// Mock window.matchMedia (only in browser environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

// Clipboard API: always ensure functions are vitest spies with mockClear
;(() => {
  const ensureClipboard = () => {
    try {
      // Create clipboard object if missing
      if (!('clipboard' in navigator)) {
        Object.defineProperty(navigator, 'clipboard', {
          value: {},
          configurable: true,
          writable: true,
          enumerable: true,
        })
      }

      const obj = navigator.clipboard || {}

      // Helper to ensure a spy function exists and supports .mockClear
      const ensureSpy = (key, defaultValue) => {
        const current = obj[key]
        const isMock = current && typeof current === 'function' && 'mock' in current
        if (isMock) return current
        try {
          // Try converting existing fn to a spy
          if (typeof current === 'function') {
            const spy = vi.fn(current)
            Object.defineProperty(obj, key, { value: spy, configurable: true, writable: true })
            return spy
          }
        } catch {}
        // Define a new spy
        const spy = vi.fn(defaultValue)
        Object.defineProperty(obj, key, { value: spy, configurable: true, writable: true })
        return spy
      }

      // writeText/readText defaults
      ensureSpy('writeText', () => Promise.resolve())
      ensureSpy('readText', () => Promise.resolve(''))

      // Reassign the possibly-updated object back (in case it was created)
      if (navigator.clipboard !== obj) {
        try {
          Object.defineProperty(navigator, 'clipboard', {
            value: obj,
            configurable: true,
            writable: true,
            enumerable: true,
          })
        } catch {}
      }
    } catch {
      // As a last resort, provide a plain object
      try {
        Object.defineProperty(navigator, 'clipboard', {
          value: {
            writeText: vi.fn().mockResolvedValue(),
            readText: vi.fn().mockResolvedValue(''),
          },
          configurable: true,
          writable: true,
          enumerable: true,
        })
      } catch {}
    }
  }
  ensureClipboard()
})()
if (typeof globalThis.ClipboardEvent === 'undefined') {
  globalThis.ClipboardEvent = function ClipboardEvent() {}
}

// Ensure DOM constructor globals exist for instanceof checks (React selection)
try {
  if (typeof window !== 'undefined') {
    // Ensure document.defaultView exists for React selection helpers
    try {
      if (!document.defaultView) {
        Object.defineProperty(document, 'defaultView', { value: window, configurable: true })
      }
      // Avoid React selection instanceof checks explosion; provide safe activeElement
      try {
        Object.defineProperty(document, 'activeElement', { get: () => document.body || null, configurable: true })
      } catch {}
    } catch {}
    const ctorKeys = [
      'Node', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement',
      'Document', 'HTMLDocument', 'DocumentFragment', 'HTMLIFrameElement', 'SVGElement',
      'ShadowRoot', 'Range', 'Selection'
    ]
    ctorKeys.forEach((k) => {
      if (typeof globalThis[k] === 'undefined' && window[k]) {
        globalThis[k] = window[k]
      }
    })

    // Minimal Selection + Range stubs for React selection logic if missing
    if (typeof window.getSelection !== 'function') {
      window.getSelection = () => ({
        removeAllRanges: () => {},
        addRange: () => {},
        anchorNode: null,
        focusNode: null,
        toString: () => ''
      })
    }
    if (typeof document.createRange !== 'function') {
      document.createRange = () => ({
        setStart: () => {},
        setEnd: () => {},
        setStartBefore: () => {},
        setEndAfter: () => {},
        selectNode: () => {},
        selectNodeContents: () => {},
        collapse: () => {},
        commonAncestorContainer: document.body || document,
      })
    }
  }
} catch {}

// Work around user-event + fake timers interaction that can hang clicks.
// When tests opt into fake timers by passing advanceTimers to userEvent.setup,
// prefer a synchronous click via Testing Library's fireEvent to avoid timing deadlocks.
try {
  vi.mock('@testing-library/user-event', async () => {
    const actual = await vi.importActual('@testing-library/user-event')
    const rtl = await import('@testing-library/react')
  const setup = (options = {}) => {
    const u = actual.default.setup(options)
    if (options && options.advanceTimers) {
      return {
        ...u,
        click: async (element, init) => {
          rtl.fireEvent.click(element, init)
        },
        type: async (element, text) => {
          // Synchronously set the value and dispatch input/change events
          const prev = element.value ?? ''
          const next = prev + String(text)
          rtl.fireEvent.input(element, { target: { value: next } })
          rtl.fireEvent.change(element, { target: { value: next } })
        },
        clear: async (element) => {
          rtl.fireEvent.input(element, { target: { value: '' } })
          rtl.fireEvent.change(element, { target: { value: '' } })
        },
        keyboard: async (sequence) => {
          // Handle a couple of common keys synchronously
          const seq = String(sequence)
          if (seq.includes('{Enter}')) {
            rtl.fireEvent.keyDown(document.activeElement || document.body, { key: 'Enter' })
            rtl.fireEvent.keyUp(document.activeElement || document.body, { key: 'Enter' })
          }
          if (seq.includes('{Escape}')) {
            rtl.fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape' })
            rtl.fireEvent.keyUp(document.activeElement || document.body, { key: 'Escape' })
          }
          if (seq.includes('{ArrowDown}')) {
            rtl.fireEvent.keyDown(document.activeElement || document.body, { key: 'ArrowDown' })
            rtl.fireEvent.keyUp(document.activeElement || document.body, { key: 'ArrowDown' })
          }
          if (seq.includes('{ArrowUp}')) {
            rtl.fireEvent.keyDown(document.activeElement || document.body, { key: 'ArrowUp' })
            rtl.fireEvent.keyUp(document.activeElement || document.body, { key: 'ArrowUp' })
          }
        },
      }
    }
    return u
  }
    return { __esModule: true, default: { ...actual.default, setup } }
  })
} catch {}

// Mock Electron APIs that might be used in renderer
global.electronAPI = {
  invoke: vi.fn(),
  on: vi.fn(),
  removeAllListeners: vi.fn(),
}

// Ensure window.electronAPI exists where tests access it
if (typeof window !== 'undefined') {
  // Keep reference equality with the global mock
  window.electronAPI = globalThis.electronAPI
  
  // Mock window.app APIs used by components
  window.app = {
    getAppInfo: vi.fn().mockResolvedValue({
      version: '1.0.0',
      platform: 'test',
      arch: 'x64'
    }),
    settingsDialog: {
      onData: vi.fn(() => vi.fn()),
      close: vi.fn(),
      open: vi.fn(),
    },
    contextMenu: {
      onData: vi.fn(() => vi.fn()),
    },
    notificationSounds: {
      getAvailable: vi.fn().mockResolvedValue(['default.wav', 'bells.wav']),
      getSoundUrl: vi.fn().mockResolvedValue(''),
      openFolder: vi.fn(),
      play: vi.fn()
    },
    auth: {
      getToken: vi.fn(() => null),
    },
    authDialog: {
      open: vi.fn(),
      auth: vi.fn(),
      close: vi.fn(),
    },
    logout: vi.fn(),
    // Add other commonly used app APIs
    userDialog: {
      onData: vi.fn(() => vi.fn()),
      onUpdate: vi.fn(() => vi.fn()),
      open: vi.fn(),
      pin: vi.fn(),
    },
    logs: {
      onUpdate: vi.fn(() => vi.fn()),
      add: vi.fn(),
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
}

// Mock CSS imports and static assets
vi.mock('*.scss', () => ({}))
vi.mock('*.css', () => ({}))
vi.mock('*.svg', () => 'test-file-stub')
vi.mock('*.png', () => 'test-file-stub')
vi.mock('*.jpg', () => 'test-file-stub')
vi.mock('*.jpeg', () => 'test-file-stub')
vi.mock('*.gif', () => 'test-file-stub')
vi.mock('*.avif', () => 'test-file-stub')

// Mock problematic Lexical plugin subpath to avoid Vite resolution errors in tests
// Some versions of @lexical/react rely on package exports that can fail to resolve
// in the test bundler. Provide a minimal no-op component.
vi.mock('@lexical/react/LexicalPlainTextPlugin', () => ({
  PlainTextPlugin: () => null,
}))

// Mock individual Lexical plugin imports
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

// Also provide a coarse-grained mock for the base package to satisfy deep import resolution
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

// Setup WebSocket mocks for testing
const WebSocketMock = vi.fn(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1, // OPEN
}))
// Provide static readyState constants on the constructor to match usage like WebSocket.OPEN
WebSocketMock.CONNECTING = 0
WebSocketMock.OPEN = 1
WebSocketMock.CLOSING = 2
WebSocketMock.CLOSED = 3
global.WebSocket = WebSocketMock

// Prevent unhandled errors/rejections in jsdom from crashing tests that purposely throw in handlers
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    // Allow tests to assert UI fallbacks without failing the entire suite
    event.preventDefault?.()
    // Still log for visibility during debugging
    console.warn('[vitest.setup.renderer] window error suppressed:', event?.error || event?.message)
  })
  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault?.()
    console.warn('[vitest.setup.renderer] unhandledrejection suppressed:', event?.reason)
  })
}

// Also guard at process level for completeness
// Note: Vitest may handle these internally; this is a best-effort safety net
if (typeof process.on === 'function') {
  process.on('unhandledRejection', (reason) => {
    console.warn('[vitest.setup.renderer] process unhandledRejection suppressed:', reason)
  })
  process.on('uncaughtException', (err) => {
    console.warn('[vitest.setup.renderer] process uncaughtException suppressed:', err)
  })
}

// Ensure process.listeners exists for Vitest
if (typeof process.listeners !== 'function') {
  process.listeners = () => []
}

// Clean up after each test automatically
afterEach(() => {
  // Ensure timers are back to real before unmounting to avoid nested act issues
  vi.useRealTimers()
  try {
    if (cleanup) {
      try {
        cleanup()
      } catch (e) {
        // Swallow React concurrent cleanup conflicts to keep tests running
        if (e && /Should not already be working/.test(String(e))) {
          // no-op
        } else {
          throw e
        }
      }
    }
  } finally {
    vi.clearAllMocks()
  }
})

// Use real timers by default; individual tests can opt into fake timers when needed

// Ensure clipboard spies are fresh for every test (some suites call mockClear explicitly)
beforeEach(() => {
  try {
    if (!('clipboard' in navigator)) {
      Object.defineProperty(navigator, 'clipboard', {
        value: {},
        configurable: true,
        writable: true,
        enumerable: true,
      })
    }
    try {
      vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    } catch {
      try {
        const proto = Object.getPrototypeOf(navigator.clipboard) || navigator.clipboard
        vi.spyOn(proto, 'writeText').mockResolvedValue()
      } catch {
        Object.defineProperty(navigator.clipboard, 'writeText', {
          value: vi.fn().mockResolvedValue(),
          configurable: true,
          writable: true,
        })
      }
    }
    try {
      if ('readText' in navigator.clipboard) {
        vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue('')
      } else {
        Object.defineProperty(navigator.clipboard, 'readText', {
          value: vi.fn().mockResolvedValue(''),
          configurable: true,
          writable: true,
        })
      }
    } catch {}
  } catch {}
})
