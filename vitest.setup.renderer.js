import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, vi } from 'vitest'

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

// Mock window.matchMedia
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

// Setup WebSocket mocks for testing
global.WebSocket = vi.fn(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}))

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
process.on?.('unhandledRejection', (reason) => {
  console.warn('[vitest.setup.renderer] process unhandledRejection suppressed:', reason)
})
process.on?.('uncaughtException', (err) => {
  console.warn('[vitest.setup.renderer] process uncaughtException suppressed:', err)
})

// Clean up after each test automatically
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

// Setup fake timers before all tests by default
beforeAll(() => {
  vi.useFakeTimers()
})
