import { beforeAll, afterEach, vi } from 'vitest'

// Mock Electron modules (provide both named and default for CJS/ESM interop)
vi.mock('electron', () => {
  const electron = {
    app: {
      getName: vi.fn(() => 'KickTalk'),
      getVersion: vi.fn(() => '1.1.8'),
      getPath: vi.fn((path) => `/mock/path/${path}`),
      whenReady: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      quit: vi.fn(),
      setAppUserModelId: vi.fn(),
      isPackaged: false,
    },
    BrowserWindow: vi.fn(() => ({
      loadFile: vi.fn(),
      loadURL: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      show: vi.fn(),
      close: vi.fn(),
      minimize: vi.fn(),
      maximize: vi.fn(),
      unmaximize: vi.fn(),
      isMaximized: vi.fn(() => false),
      setAlwaysOnTop: vi.fn(),
      setVisibleOnAllWorkspaces: vi.fn(),
      setFullScreenable: vi.fn(),
      setThumbarButtons: vi.fn(),
      getNormalBounds: vi.fn(() => ({ x: 0, y: 0, width: 800, height: 600 })),
      getPosition: vi.fn(() => [100, 100]),
      getSize: vi.fn(() => [800, 600]),
      setPosition: vi.fn(),
      isVisible: vi.fn(() => true),
      isMinimized: vi.fn(() => false),
      hide: vi.fn(),
      restore: vi.fn(),
      focus: vi.fn(),
      webContents: {
        send: vi.fn(),
        on: vi.fn(),
        openDevTools: vi.fn(),
        setWindowOpenHandler: vi.fn(),
        setZoomFactor: vi.fn(),
        getZoomFactor: vi.fn(() => 1.0),
        setAudioMuted: vi.fn(),
        executeJavaScript: vi.fn(),
      },
    })),
    ipcMain: {
      handle: vi.fn(),
      on: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    Menu: {
      setApplicationMenu: vi.fn(),
      buildFromTemplate: vi.fn(),
    },
    Tray: vi.fn(() => ({
      setToolTip: vi.fn(),
      setContextMenu: vi.fn(),
      on: vi.fn(),
    })),
    nativeImage: {
      createFromPath: vi.fn(),
    },
  }
  return { __esModule: true, ...electron, default: electron }
}, { virtual: true })


// Mock OpenTelemetry modules
vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: vi.fn(() => ({
    start: vi.fn(),
    shutdown: vi.fn(),
  })),
}))

vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: vi.fn(() => ({
    export: vi.fn(),
    shutdown: vi.fn(),
  })),
}))

// Mock file system operations
vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => '{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  copyFileSync: vi.fn(),
}))

// Mock path operations
vi.mock('path', async () => {
  const actual = await vi.importActual('path')
  return {
    ...actual,
    resolve: vi.fn((...paths) => paths.join('/')),
    join: vi.fn((...paths) => paths.join('/')),
  }
})

// Polyfill CloseEvent for Node test environment (used by WebSocket tests)
if (typeof globalThis.CloseEvent === 'undefined') {
  class CloseEventPolyfill extends Event {
    constructor(type, init = {}) {
      super(type)
      this.wasClean = Boolean(init.wasClean)
      this.code = init.code ?? 1000
      this.reason = init.reason ?? ''
    }
  }
  globalThis.CloseEvent = CloseEventPolyfill
}

// Polyfill ErrorEvent for Node test environment
if (typeof globalThis.ErrorEvent === 'undefined') {
  class ErrorEventPolyfill extends Event {
    constructor(type, init = {}) {
      super(type)
      this.error = init.error
      this.message = init.message || (init.error?.message ?? '')
      this.filename = init.filename || ''
      this.lineno = init.lineno || 0
      this.colno = init.colno || 0
    }
  }
  globalThis.ErrorEvent = ErrorEventPolyfill
}

// Polyfill CustomEvent for Node test environment
if (typeof globalThis.CustomEvent !== 'function') {
  class CustomEventPolyfill extends Event {
    constructor(type, params = {}) {
      super(type, params)
      this.detail = params?.detail
    }
  }
  globalThis.CustomEvent = CustomEventPolyfill
}

// Deterministic WebSocket mock for main tests
if (typeof globalThis.WebSocket === 'undefined') {
  class MockWebSocket extends EventTarget {
    constructor(url) {
      super()
      this.url = url
      this.readyState = MockWebSocket.CONNECTING
      this._listeners = new Map()
      
      // Simulate immediate connection for tests to avoid timeouts
      // Use setImmediate or process.nextTick for faster execution in tests
      const openConnection = () => {
        this.readyState = MockWebSocket.OPEN
        const openEvent = new Event('open')
        this.dispatchEvent(openEvent)
        this._emit('open', openEvent)
      }
      
      // In test environment, connect immediately
      if (process.env.VITEST) {
        // Use setImmediate if available, otherwise use minimal timeout
        if (typeof setImmediate !== 'undefined') {
          setImmediate(openConnection)
        } else {
          setTimeout(openConnection, 0)
        }
      } else {
        setTimeout(openConnection, 10)
      }
    }
    
    addEventListener(type, handler) {
      // Also support EventTarget interface
      super.addEventListener(type, handler)
      // Keep our own tracking for compatibility
      const set = this._listeners.get(type) || new Set()
      set.add(handler)
      this._listeners.set(type, set)
    }
    
    removeEventListener(type, handler) {
      super.removeEventListener(type, handler)
      this._listeners.get(type)?.delete(handler)
    }
    
    _emit(type, event) {
      const list = Array.from(this._listeners.get(type) || [])
      for (const handler of list) {
        try { 
          handler.call(this, event)
        } catch (e) {
          console.error('WebSocket mock handler error:', e)
        }
      }
    }
    
    send(data) {
      if (this.readyState !== MockWebSocket.OPEN) {
        throw new Error('WebSocket is not open')
      }
      // Mock send - in tests we can simulate responses if needed
    }
    
    close(code = 1000, reason = '') {
      if (this.readyState === MockWebSocket.CLOSED) return
      
      this.readyState = MockWebSocket.CLOSING
      const closeEvent = new CloseEvent('close', { 
        code, 
        reason, 
        wasClean: true 
      })
      
      setTimeout(() => {
        this.readyState = MockWebSocket.CLOSED
        this.dispatchEvent(closeEvent)
        this._emit('close', closeEvent)
      }, 0)
    }
  }
  
  MockWebSocket.CONNECTING = 0
  MockWebSocket.OPEN = 1
  MockWebSocket.CLOSING = 2
  MockWebSocket.CLOSED = 3
  
  globalThis.WebSocket = MockWebSocket
}

// Setup environment variables for testing
beforeAll(() => {
  process.env.NODE_ENV = 'test'
  process.env.VITEST = 'true'
})

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks()
})