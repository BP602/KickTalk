import { beforeAll, afterEach, vi } from 'vitest'

// Mock Electron modules
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
      removeHandler: vi.fn(),
      removeAllListeners: vi.fn()
    },
    Menu: {
      buildFromTemplate: vi.fn(),
      setApplicationMenu: vi.fn()
    },
    Tray: vi.fn(() => ({
      setToolTip: vi.fn(),
      setContextMenu: vi.fn(),
      on: vi.fn()
    })),
    nativeTheme: {
      shouldUseDarkColors: false,
      on: vi.fn()
    },
    shell: {
      openExternal: vi.fn()
    },
    dialog: {
      showOpenDialog: vi.fn(),
      showSaveDialog: vi.fn(),
      showMessageBox: vi.fn()
    },
    contextBridge: {
      exposeInMainWorld: vi.fn()
    },
    ipcRenderer: {
      on: vi.fn(),
      once: vi.fn(),
      send: vi.fn(),
      invoke: vi.fn(),
      removeListener: vi.fn(),
      removeAllListeners: vi.fn()
    }
  }
  
  return {
    ...electron,
    default: electron
  }
})

// Mock electron-updater
vi.mock('electron-updater', () => ({
  autoUpdater: {
    logger: null,
    autoDownload: false,
    autoInstallOnAppQuit: false,
    disableWebInstaller: false,
    disableDifferentialDownload: false,
    allowDowngrade: true,
    forceDevUpdateConfig: false,
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
  }
}))

// Mock electron-store
vi.mock('electron-store', () => {
  const Store = vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
    has: vi.fn(() => false),
    store: {}
  }))
  return { default: Store }
})

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    transports: {
      file: { level: 'debug' }
    }
  }
}))

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(() => []),
    statSync: vi.fn(() => ({ isDirectory: () => false }))
  },
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(() => []),
  statSync: vi.fn(() => ({ isDirectory: () => false }))
}))

// Mock path
vi.mock('path', () => ({
  default: {
    join: vi.fn((...args) => args.join('/')),
    resolve: vi.fn((...args) => args.join('/')),
    dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/')),
    basename: vi.fn((p) => p.split('/').pop()),
    extname: vi.fn((p) => {
      const parts = p.split('.')
      return parts.length > 1 ? `.${parts.pop()}` : ''
    })
  },
  join: vi.fn((...args) => args.join('/')),
  resolve: vi.fn((...args) => args.join('/')),
  dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/')),
  basename: vi.fn((p) => p.split('/').pop()),
  extname: vi.fn((p) => {
    const parts = p.split('.')
    return parts.length > 1 ? `.${parts.pop()}` : ''
  })
}))

// Mock OTEL packages
vi.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: vi.fn(() => ({
      startSpan: vi.fn(() => ({
        end: vi.fn(),
        setAttribute: vi.fn(),
        setAttributes: vi.fn(),
        recordException: vi.fn(),
        setStatus: vi.fn()
      }))
    })),
    getActiveSpan: vi.fn(),
    setSpan: vi.fn()
  },
  context: {
    active: vi.fn(),
    with: vi.fn((ctx, fn) => fn())
  },
  SpanStatusCode: {
    OK: 1,
    ERROR: 2
  },
  SpanKind: {
    INTERNAL: 0,
    SERVER: 1,
    CLIENT: 2,
    PRODUCER: 3,
    CONSUMER: 4
  },
  metrics: {
    getMeter: vi.fn(() => ({
      createCounter: vi.fn(() => ({ add: vi.fn() })),
      createHistogram: vi.fn(() => ({ record: vi.fn() })),
      createUpDownCounter: vi.fn(() => ({ add: vi.fn() }))
    }))
  }
}))

vi.mock('@opentelemetry/sdk-trace-node', () => ({
  NodeTracerProvider: vi.fn(() => ({
    register: vi.fn(),
    addSpanProcessor: vi.fn(),
    getTracer: vi.fn(() => ({
      startSpan: vi.fn(() => ({
        end: vi.fn(),
        setAttribute: vi.fn(),
        setAttributes: vi.fn()
      }))
    }))
  })),
  BasicTracerProvider: vi.fn(() => ({
    register: vi.fn(),
    addSpanProcessor: vi.fn()
  }))
}))

vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: vi.fn(() => ({
    export: vi.fn(),
    shutdown: vi.fn()
  }))
}))

vi.mock('@opentelemetry/sdk-trace-base', () => ({
  BatchSpanProcessor: vi.fn(() => ({
    forceFlush: vi.fn(),
    shutdown: vi.fn()
  })),
  SimpleSpanProcessor: vi.fn()
}))

vi.mock('@opentelemetry/instrumentation', () => ({
  registerInstrumentations: vi.fn()
}))

// Add CustomEvent polyfill for Node.js
if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(event, params = {}) {
      super(event, params)
      this.detail = params.detail || null
    }
  }
}

// Add WebSocket mock for Node tests
if (typeof globalThis.WebSocket === 'undefined') {
  class MockWebSocket extends EventTarget {
    constructor(url, protocols) {
      super()
      this.url = url
      this.protocols = protocols
      this.readyState = MockWebSocket.CONNECTING
      
      // Simulate immediate connection for tests
      setTimeout(() => {
        this.readyState = MockWebSocket.OPEN
        const event = new Event('open')
        this.dispatchEvent(event)
      }, 0)
    }
    
    send(data) {
      if (this.readyState !== MockWebSocket.OPEN) {
        throw new Error('WebSocket is not open')
      }
    }
    
    close(code, reason) {
      this.readyState = MockWebSocket.CLOSING
      setTimeout(() => {
        this.readyState = MockWebSocket.CLOSED
        const event = new Event('close')
        event.code = code
        event.reason = reason
        this.dispatchEvent(event)
      }, 0)
    }
  }
  
  MockWebSocket.CONNECTING = 0
  MockWebSocket.OPEN = 1
  MockWebSocket.CLOSING = 2
  MockWebSocket.CLOSED = 3
  
  globalThis.WebSocket = MockWebSocket
}

// Ensure process.env exists
if (typeof process.env === 'undefined') {
  process.env = {}
}

// Setup environment variables for testing
beforeAll(() => {
  process.env.NODE_ENV = 'test'
  process.env.VITEST = 'true'
})

// Ensure process.listeners exists for Vitest
if (typeof process.listeners !== 'function') {
  process.listeners = () => []
}

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks()
})
