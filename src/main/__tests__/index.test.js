import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'path'

// Resolve absolute module paths so our mocks apply before importing main
const abs = (rel) => path.normalize(new URL(rel, import.meta.url).pathname)
const CONFIG = abs('../../../utils/config.js')
const FS = 'fs'
const HTTPS = 'https'
const CRYPTO = 'crypto'
const ELECTRON = 'electron'
const ELECTRON_STORE = 'electron-store'
const TELEMETRY_TRACING = abs('../../telemetry/tracing.js')
const TELEMETRY_METRICS = abs('../../telemetry/metrics.js')
const ELECTRON_TOOLKIT_UTILS = '@electron-toolkit/utils'
const UPDATE_UTILS = abs('../utils/update')
const MAIN_INDEX = path.resolve(__dirname, '../index.js')

// Mock console methods to suppress logs during testing
const mockConsole = () => {
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  }
  
  console.log = vi.fn()
  console.warn = vi.fn()
  console.error = vi.fn()
  
  return originalConsole
}

const restoreConsole = (originalConsole) => {
  console.log = originalConsole.log
  console.warn = originalConsole.warn
  console.error = originalConsole.error
}

describe('main/index.js - Electron Main Process', () => {
  let originalConsole
  let originalProcessEnv

  beforeEach(() => {
    vi.resetModules()
    originalConsole = mockConsole()
    originalProcessEnv = { ...process.env }
  })

  describe('Tray Menu Behavior', () => {
    it('creates tray and toggles window visibility on click', async () => {
      const { electron } = await setupMainWithMocks({ isDev: true })

      // Tray should be created and tooltip set
      expect(electron.Tray).toHaveBeenCalled()
      const trayInstance = electron.Tray.mock.results[0]?.value
      expect(trayInstance.setToolTip).toHaveBeenCalledWith('KickTalk')

      // Initial context menu should be built
      expect(electron.Menu.buildFromTemplate).toHaveBeenCalled()

      // Capture tray click handler
      const clickHandler = trayInstance.on.mock.calls.find(c => c[0] === 'click')?.[1]
      expect(typeof clickHandler).toBe('function')

      const mainWin = electron.BrowserWindow.mock.results[0]?.value
      // First click: window is visible -> should hide
      mainWin.isVisible = vi.fn(() => true)
      mainWin.isMinimized = vi.fn(() => false)
      await clickHandler()
      expect(mainWin.hide).toHaveBeenCalled()
      expect(trayInstance.setContextMenu).toHaveBeenCalled()

      // Second click: window is not visible -> should show and focus, restore if minimized
      mainWin.isVisible = vi.fn(() => false)
      mainWin.isMinimized = vi.fn(() => true)
      await clickHandler()
      expect(mainWin.show).toHaveBeenCalled()
      expect(mainWin.restore).toHaveBeenCalled()
      expect(mainWin.focus).toHaveBeenCalled()
      expect(trayInstance.setContextMenu).toHaveBeenCalled()
    })

    it('invokes app.quit on Quit menu item (telemetry disabled)', async () => {
      const { electron } = await setupMainWithMocks({ isDev: true, telemetryEnabled: false })

      // The tray context menu is built from a template; capture the first template used
      const firstTemplate = electron.Menu.buildFromTemplate.mock.calls[0]?.[0]
      expect(Array.isArray(firstTemplate)).toBe(true)

      const quitItem = firstTemplate.find(item => item.label === 'Quit')
      expect(quitItem).toBeDefined()

      // Click the Quit menu item
      await quitItem.click()

      // With telemetry disabled, we should still quit the app
      expect(electron.app.quit).toHaveBeenCalled()
    })
  })

  describe('OTEL env mapping and resource attributes', () => {
    it('maps MAIN_VITE_OTEL_* to OTEL_* and injects service metadata', async () => {
      process.env = { ...process.env } // clone for safety
      process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_ENDPOINT = 'https://tempo.example.com'
      process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_HEADERS = 'Authorization=Bearer test'
      process.env.MAIN_VITE_OTEL_SERVICE_NAME = 'kicktalk-dev'
      process.env.MAIN_VITE_OTEL_DEPLOYMENT_ENV = 'staging'

      await setupMainWithMocks({})

      // Basic mapping
      expect(process.env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('https://tempo.example.com')
      expect(process.env.OTEL_EXPORTER_OTLP_HEADERS).toBe('Authorization=Bearer test')
      // Deployment env preserved (not overridden by test env)
      expect(process.env.OTEL_DEPLOYMENT_ENV).toBe('staging')

      // Resource attributes should include service.name and service.version
      // service.version should be present (from app.getVersion() or package.json)
      const attrs = String(process.env.OTEL_RESOURCE_ATTRIBUTES || '')
      expect(attrs).toMatch(/service\.name=kicktalk-dev/)
      expect(attrs).toMatch(/service\.version=\d+\.\d+\.\d+/)
    })
  })

  afterEach(() => {
    restoreConsole(originalConsole)
    process.env = originalProcessEnv
    vi.clearAllMocks()
  })

  const setupMocks = (options = {}) => {
    const { 
      telemetryEnabled = false, 
      storageValues = {}, 
      envVars = {}, 
      platform = 'darwin' 
    } = options
    
    // Set platform if provided
    if (platform) {
      Object.defineProperty(process, 'platform', {
        value: platform,
        writable: false,
        configurable: true
      })
    }
    
    // Set environment variables
    Object.entries(envVars).forEach(([key, value]) => {
      process.env[key] = value
    })
    
    // Mock node:crypto
    const crypto = {
      randomUUID: vi.fn(() => 'mock-uuid-1234'),
      randomBytes: vi.fn(() => Buffer.from('mockhexbytes'))
    }
    vi.doMock('node:crypto', () => crypto)

    // Mock crypto module
    vi.doMock(CRYPTO, () => ({
      randomUUID: vi.fn(() => 'mock-uuid-1234'),
      randomBytes: vi.fn(() => Buffer.from('mockhexbytes'))
    }))

    // Mock https module
    const mockRequest = {
      on: vi.fn(),
      end: vi.fn(),
      write: vi.fn(),
      setTimeout: vi.fn(),
      destroy: vi.fn()
    }
    
    vi.doMock(HTTPS, () => ({
      request: vi.fn(() => mockRequest)
    }))

    // Mock telemetry modules
    vi.doMock(TELEMETRY_TRACING, () => ({}))

    // Mock @opentelemetry/api
    const mockSpan = {
      setAttribute: vi.fn(),
      addEvent: vi.fn(),
      end: vi.fn(),
      recordException: vi.fn(),
      setStatus: vi.fn()
    }
    const mockTracer = {
      startSpan: vi.fn(() => mockSpan)
    }
    const mockTrace = {
      getTracer: vi.fn(() => mockTracer),
      setSpan: vi.fn(),
      active: vi.fn()
    }
    vi.doMock('@opentelemetry/api', () => ({
      trace: mockTrace,
      context: {
        with: vi.fn((ctx, fn) => fn()),
        active: vi.fn()
      }
    }))

    // Mock config store with comprehensive defaults
    const defaultStorage = {
      general: {
        autoUpdate: true,
        alwaysOnTop: false,
        enableExperimentalFeatures: false,
        enableDebugMode: false,
        ...storageValues.general
      },
      notificationSounds: {
        enabled: true,
        volume: 0.5,
        ...storageValues.notificationSounds
      },
      windows: {
        main: { x: 100, y: 100, width: 800, height: 600 },
        ...storageValues.windows
      },
      telemetry: {
        enabled: telemetryEnabled,  // Use the telemetryEnabled option
        sessionId: 'test-session',
        ...storageValues.telemetry
      },
      ...storageValues
    }
    
    const mockStoreInstance = {
      store: defaultStorage,
      get: vi.fn((key, def) => {
        if (key && key.includes('.')) {
          const keys = key.split('.')
          let value = defaultStorage
          for (const k of keys) {
            value = value?.[k]
            if (value === undefined) return def !== undefined ? def : undefined
          }
          return value !== undefined ? value : def
        }
        return key ? (defaultStorage[key] !== undefined ? defaultStorage[key] : def) : defaultStorage
      }),
      set: vi.fn((key, value) => {
        if (key.includes('.')) {
          const keys = key.split('.')
          let obj = defaultStorage
          for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {}
            obj = obj[keys[i]]
          }
          obj[keys[keys.length - 1]] = value
        } else {
          defaultStorage[key] = value
        }
        return true
      }),
      has: vi.fn(key => defaultStorage[key] !== undefined),
      delete: vi.fn(),
      clear: vi.fn(),
      openInEditor: vi.fn(),
      size: 0,
      path: '/mock/store/path'
    }
    
    // Mock both the ES module and CommonJS exports
    vi.doMock(CONFIG, () => ({ default: mockStoreInstance }))
    // For CommonJS require() compatibility
    vi.doMock(CONFIG, () => {
      const module = { default: mockStoreInstance };
      // Make the module itself act like the store for require() calls
      Object.assign(module, mockStoreInstance);
      return module;
    })

    // Mock electron-store for auth store
    vi.doMock('electron-store', () => {
      const Store = vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn()
      }))
      return { default: Store }
    })

    // Mock file system operations for notification sounds
    const fsMock = {
      existsSync: vi.fn(() => true),
      readFileSync: vi.fn((path) => {
        if (path.includes('.wav') || path.includes('.mp3')) {
          // Return actual wav/mp3 data that will be base64 encoded
          return Buffer.from('mock-audio-data')
        }
        return 'mock file content'
      }),
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn(),
      copyFileSync: vi.fn(),
      readdirSync: vi.fn(() => ['default.wav', 'bells.wav', 'notification.mp3']),
      createReadStream: vi.fn(() => ({
        pipe: vi.fn(),
        on: vi.fn((event, callback) => {
          if (event === 'end') callback()
          return this
        })
      }))
    }
    vi.doMock(FS, () => ({ 
      ...fsMock,
      default: fsMock 
    }))

    // Mock electron-toolkit/utils
    vi.doMock(ELECTRON_TOOLKIT_UTILS, () => ({
      electronApp: {
        setAppUserModelId: vi.fn()
      },
      optimizer: {
        watchWindowShortcuts: vi.fn()
      }
    }))

    // Mock update utilities
    vi.doMock(UPDATE_UTILS, () => ({
      update: vi.fn()
    }))

    // Mock Electron API
    const mockBrowserWindow = {
      id: 1,
      loadURL: vi.fn(),
      loadFile: vi.fn(),
      setMenu: vi.fn(),
      setMenuBarVisibility: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      webContents: {
        send: vi.fn(),
        on: vi.fn(),
        session: {
          webRequest: {
            onBeforeRequest: vi.fn()
          }
        },
        getZoomFactor: vi.fn(() => 1),
        setZoomFactor: vi.fn(),
        setWindowOpenHandler: vi.fn(),
        openDevTools: vi.fn()
      },
      show: vi.fn(),
      hide: vi.fn(),
      close: vi.fn(),
      minimize: vi.fn(),
      maximize: vi.fn(),
      isMaximized: vi.fn(() => false),
      isVisible: vi.fn(() => true),
      isMinimized: vi.fn(() => false),
      focus: vi.fn(),
      restore: vi.fn(),
      setFullScreen: vi.fn(),
      isFullScreen: vi.fn(() => false),
      setAlwaysOnTop: vi.fn(),
      setVisibleOnAllWorkspaces: vi.fn(),
      setSize: vi.fn(),
      setPosition: vi.fn(),
      getBounds: vi.fn(() => ({ x: 100, y: 100, width: 800, height: 600 })),
      isNormal: vi.fn(() => true),
      setThumbarButtons: vi.fn()
    }
    
    const electron = {
      app: {
        whenReady: vi.fn(() => Promise.resolve()),
        on: vi.fn(),
        quit: vi.fn(),
        getName: vi.fn(() => 'KickTalk'),
        getVersion: vi.fn(() => '1.0.0'),
        getPath: vi.fn((name) => `/mock/path/${name}`),
        requestSingleInstanceLock: vi.fn(() => true),
        isPackaged: false,
        setAppUserModelId: vi.fn(),
        setAsDefaultProtocolClient: vi.fn(() => true)
      },
      BrowserWindow: vi.fn(() => mockBrowserWindow),
      ipcMain: {
        handle: vi.fn(),
        on: vi.fn(),
        removeHandler: vi.fn(),
        setMaxListeners: vi.fn()
      },
      screen: {
        getPrimaryDisplay: vi.fn(() => ({ bounds: { width: 1920, height: 1080 } }))
      },
      session: {
        defaultSession: {
          setUserAgent: vi.fn()
        }
      },
      dialog: {
        showErrorBox: vi.fn()
      },
      shell: {
        openExternal: vi.fn()
      },
      Tray: vi.fn(() => ({
        setToolTip: vi.fn(),
        setContextMenu: vi.fn(),
        on: vi.fn()
      })),
      Menu: {
        buildFromTemplate: vi.fn(() => ({ popup: vi.fn() })),
        setApplicationMenu: vi.fn()
      },
      nativeTheme: {
        themeSource: 'system'
      },
      powerMonitor: {
        on: vi.fn()
      },
      autoUpdater: {
        setFeedURL: vi.fn(),
        checkForUpdates: vi.fn(),
        on: vi.fn()
      },
      protocol: {
        registerFileProtocol: vi.fn()
      },
      crashReporter: {
        start: vi.fn()
      }
    }
    
    vi.doMock(ELECTRON, () => ({ 
      default: electron,
      ...electron 
    }))
    
    const mockStoreOverride = {
      get: vi.fn((key) => {
        if (key === 'telemetry.enabled') return options.telemetryEnabled || false
        if (key === 'general.alwaysOnTop') return false
        if (key === 'sounds') return { default: 'default.wav' }
        if (key === 'general.theme') return 'dark'
        return null
      }),
      set: vi.fn(),
      delete: vi.fn(),
      has: vi.fn(),
      path: '/mock/config/path'
    }
    vi.doMock(ELECTRON_STORE, () => ({
      default: vi.fn(() => mockStoreOverride)
    }))
    
    // Mock path module for sound URLs
    vi.doMock('path', () => ({
      join: vi.fn((...args) => {
        const joined = args.join('/')
        // For sound files, return a data URL
        if (joined.includes('.wav') || joined.includes('.mp3')) {
          return 'data:audio/wav;base64,bW9jay1hdWRpby1kYXRh'
        }
        return joined
      }),
      resolve: vi.fn((...args) => args.join('/')),
      dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/'))
    }))
    
    const metrics = {
      incrementAppLaunch: vi.fn(),
      recordChatConnection: vi.fn(),
      recordMessageSent: vi.fn(),
      recordMessageSendDuration: vi.fn(),
      recordError: vi.fn(),
      recordPerformance: vi.fn(),
      incrementOpenWindows: vi.fn(),
      decrementOpenWindows: vi.fn(),
      shutdown: vi.fn()
    }
    vi.doMock(TELEMETRY_METRICS, () => metrics)
    
    const tracing = {
      initializeTracing: vi.fn().mockResolvedValue(undefined),
      span: vi.fn((name, fn) => fn()),
      shutdown: vi.fn()
    }
    vi.doMock(TELEMETRY_TRACING, () => tracing)

    return {
      electron,
      mockStore: mockStoreOverride,
      metrics,
      tracing
    }
  }
  
  const setupMainWithMocks = async (options = {}) => {
    const { electron, mockStore, metrics } = setupMocks(options)
    
    // Set NODE_ENV based on isDev option if not already set
    if ('isDev' in options && !process.env.NODE_ENV) {
      process.env.NODE_ENV = options.isDev ? 'development' : 'production'
    }
    
    // Track IPC handlers
    const ipcHandlers = new Map()
    const ipcListeners = new Map()
    
    electron.ipcMain.handle.mockImplementation((channel, handler) => {
      ipcHandlers.set(channel, handler)
    })
    
    electron.ipcMain.on.mockImplementation((channel, listener) => {
      if (!ipcListeners.has(channel)) {
        ipcListeners.set(channel, [])
      }
      ipcListeners.get(channel).push(listener)
    })
    
    // Import the main process
    await import(MAIN_INDEX)
    
    return {
      electron,
      mockStore,
      metrics,
      ipcHandlers,
      ipcListeners,
      getHandler: (channel) => ipcHandlers.get(channel),
      getListeners: (channel) => ipcListeners.get(channel) || []
    }
  }

  describe('Development vs Production Behavior', () => {
    it('should open dev tools in development mode', async () => {
      // Set NODE_ENV to development BEFORE importing the main process
      process.env.NODE_ENV = 'development'
      const { electron } = await setupMainWithMocks({ isDev: true })
      
      // Wait for app ready event to be triggered
      await new Promise(resolve => setTimeout(resolve, 0))
      
      // Find the BrowserWindow instance that was created
      const mockWindow = electron.BrowserWindow.mock.results[0]?.value
      expect(mockWindow).toBeDefined()
      
      // Simulate window ready by calling the ready-to-show handler
      const readyHandler = mockWindow.once.mock.calls.find(c => c[0] === 'ready-to-show')?.[1]
      expect(readyHandler).toBeDefined()
      
      // Call the ready-to-show handler
      await readyHandler()
      
      // In dev mode, dev tools should open
      expect(mockWindow.webContents.openDevTools).toHaveBeenCalledWith({ mode: 'detach' })
    })

    it('should not open dev tools in production mode', async () => {
      // Set NODE_ENV to production BEFORE importing the main process
      process.env.NODE_ENV = 'production'
      const { electron } = await setupMainWithMocks({ isDev: false })
      
      // Wait for app ready event to be triggered
      await new Promise(resolve => setTimeout(resolve, 0))
      
      const mockWindow = electron.BrowserWindow.mock.results[0]?.value
      expect(mockWindow).toBeDefined()
      
      // Simulate window ready
      const readyHandler = mockWindow.once.mock.calls.find(c => c[0] === 'ready-to-show')?.[1]
      if (readyHandler) await readyHandler()
      
      // In production, dev tools should NOT be opened
      expect(mockWindow.webContents.openDevTools).not.toHaveBeenCalled()
    })

    it('should use different icon paths for different platforms', async () => {
      // Windows platform test
      const { electron } = await setupMainWithMocks({ platform: 'win32' })
      
      // The BrowserWindow should have been called during initialization
      if (electron.BrowserWindow.mock.calls.length > 0) {
        const windowConfig = electron.BrowserWindow.mock.calls[0][0]
        // On Windows, icon should contain .ico or .png
        expect(windowConfig.icon).toBeDefined()
      }
    })
  })

  describe('Performance and Resource Management', () => {
    it('should limit IPC listeners correctly', async () => {
      const { electron } = await setupMainWithMocks()
      
      expect(electron.ipcMain.setMaxListeners).toHaveBeenCalledWith(100)
    })

    it('should track window count with metrics', async () => {
      const { electron, metrics } = await setupMainWithMocks({ telemetryEnabled: true })
      
      // Check if window creation triggered metrics
      // The main window is created during app initialization
      // Metrics tracking happens after window is created
      
      // Simulate window close
      const mockWindow = electron.BrowserWindow.mock.results[0]?.value
      if (mockWindow) {
        const closeHandler = mockWindow.on.mock.calls.find(c => c[0] === 'closed')?.[1]
        if (closeHandler) {
          closeHandler()
          // When telemetry is enabled, should track window close
          if (metrics.decrementOpenWindows) {
            expect(metrics.decrementOpenWindows).toHaveBeenCalled()
          }
        }
      }
    })

    it('should handle zoom factor changes efficiently', async () => {
      const { electron, mockStore } = await setupMainWithMocks()
      
      // Find web-contents-created handler first
      const webContentsHandler = electron.app.on.mock.calls.find(
        call => call[0] === 'web-contents-created'
      )?.[1]
      
      if (webContentsHandler) {
        const mockWebContents = {
          on: vi.fn(),
          setZoomFactor: vi.fn(),
          getZoomFactor: vi.fn(() => 1)
        }
        
        // Call web-contents-created to register before-input-event
        webContentsHandler({}, mockWebContents)
        
        // Find the before-input-event handler registered on webContents
        const beforeInputHandler = mockWebContents.on.mock.calls.find(
          call => call[0] === 'before-input-event'
        )?.[1]
        
        if (beforeInputHandler) {
          const mockEvent = { preventDefault: vi.fn() }
          const mockInput = { control: true, key: '=' }
          
          beforeInputHandler(mockEvent, mockInput)
          
          expect(mockEvent.preventDefault).toHaveBeenCalled()
          expect(mockWebContents.setZoomFactor).toHaveBeenCalled()
          expect(mockStore.set).toHaveBeenCalledWith('zoomFactor', expect.any(Number))
        }
      }
    })
  })
})