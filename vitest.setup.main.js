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
  class CloseEventPolyfill {
    constructor(type, init = {}) {
      this.type = type
      this.wasClean = Boolean(init.wasClean)
      this.code = init.code ?? 1000
      this.reason = init.reason ?? ''
    }
  }
  globalThis.CloseEvent = CloseEventPolyfill
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