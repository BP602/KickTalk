import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'path'

// Resolve absolute module paths so our mocks apply before importing main
const abs = (rel) => path.normalize(new URL(rel, import.meta.url).pathname)
const CONFIG = abs('../../../utils/config.js')
const FS = 'fs'
const HTTPS = 'https'
const CRYPTO = 'crypto'
const DOTENV = 'dotenv'
const TELEMETRY_TRACING = abs('../../telemetry/tracing.js')
const TELEMETRY_METRICS = abs('../../telemetry/metrics.js')
const ELECTRON_TOOLKIT_UTILS = '@electron-toolkit/utils'
const UPDATE_UTILS = abs('../utils/update')
const MAIN_INDEX = abs('../index.js')

// Helpers to access registered ipc handlers and listeners
const getIpcHandler = (ipcMain, channel) => {
  const call = ipcMain.handle.mock.calls.find((c) => c[0] === channel)
  if (!call) throw new Error(`IPC handler not registered for ${channel}`)
  return call[1]
}

const getIpcListener = (ipcMain, channel) => {
  const call = ipcMain.on.mock.calls.find((c) => c[0] === channel)
  if (!call) throw new Error(`IPC listener not registered for ${channel}`)
  return call[1]
}

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

  afterEach(() => {
    restoreConsole(originalConsole)
    process.env = originalProcessEnv
    vi.clearAllMocks()
  })

  const setupMocks = ({ 
    telemetryEnabled = false, 
    isDev = false, 
    platform = 'linux',
    envVars = {},
    storageValues = {} 
  } = {}) => {
    // Mock process environment
    process.env.NODE_ENV = isDev ? 'development' : 'production'
    // Use Object.defineProperty to override read-only process.platform
    Object.defineProperty(process, 'platform', { value: platform, writable: true })
    Object.assign(process.env, envVars)

    // Mock dotenv
    vi.doMock(DOTENV, () => ({
      default: { config: vi.fn() },
      config: vi.fn()
    }))

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
    
    const metrics = {
      incrementOpenWindows: vi.fn(),
      decrementOpenWindows: vi.fn(),
      recordError: vi.fn(),
      recordMessageSent: vi.fn(),
      recordMessageSendDuration: vi.fn(),
      recordMessageReceived: vi.fn(),
      recordRendererMemory: vi.fn(),
      recordDomNodeCount: vi.fn(),
      incrementWebSocketConnections: vi.fn(),
      decrementWebSocketConnections: vi.fn(),
      recordConnectionError: vi.fn(),
      recordReconnection: vi.fn(),
      recordAPIRequest: vi.fn(),
      recordSevenTVConnectionHealth: vi.fn(),
      recordSevenTVWebSocketCreated: vi.fn(),
      recordSevenTVEmoteUpdate: vi.fn(),
      recordSevenTVEmoteChanges: vi.fn(),
      recordChatroomSwitch: vi.fn(),
      recordStartupDuration: vi.fn(),
      recordMessageParsingDuration: vi.fn(),
      recordEmoteSearchDuration: vi.fn(),
      recordWebSocketConnectionDuration: vi.fn(),
      getSLOTarget: vi.fn(() => ({ target: 2.0, p99: 1.5 })),
      getAllSLOTargets: vi.fn(() => ({})),
      updatePerformanceBudget: vi.fn(),
      recordErrorRecovery: vi.fn(),
      executeWithRetry: vi.fn(async (op) => await op()),
      executeNetworkRequestWithRetry: vi.fn(async (op) => await op()),
      executeWebSocketWithRetry: vi.fn(async (op) => await op()),
      executeSevenTVWithRetry: vi.fn(async (op) => await op()),
      getCircuitBreaker: vi.fn(() => ({})),
      getErrorStatistics: vi.fn(() => ({})),
      startUserSession: vi.fn(() => ({ sessionId: 'test-session' })),
      endUserSession: vi.fn(),
      recordUserAction: vi.fn(),
      recordFeatureUsage: vi.fn(),
      recordChatEngagement: vi.fn(),
      recordConnectionQuality: vi.fn(),
      getUserAnalyticsData: vi.fn(() => ({})),
      getUserActionTypes: vi.fn(() => ({})),
      monitorUIInteraction: vi.fn(() => 'good'),
      monitorComponentRender: vi.fn(() => 'good'),
      monitorWebSocketLatency: vi.fn(() => 'good'),
      monitorMemoryUsage: vi.fn(() => 'good'),
      monitorCPUUsage: vi.fn(() => 'good'),
      monitorBundleSize: vi.fn(() => 'good'),
      getPerformanceData: vi.fn(() => ({})),
      cleanupOldSessions: vi.fn(() => ({ cleaned: 0, remaining: {} })),
      forceCleanupSessions: vi.fn(() => ({})),
      getAnalyticsMemoryStats: vi.fn(() => ({ total_estimated_bytes: 0 })),
    }
    
    vi.doMock(TELEMETRY_METRICS, () => ({ MetricsHelper: metrics }))

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
    vi.doMock('@opentelemetry/api', () => ({
      trace: {
        getTracer: vi.fn(() => mockTracer),
        setSpan: vi.fn(),
        active: vi.fn()
      },
      context: {
        with: vi.fn((ctx, fn) => fn()),
        active: vi.fn()
      }
    }))

    // Mock config store with comprehensive defaults
    const defaultStorage = {
      lastMainWindowState: { width: 800, height: 600, x: 0, y: 0 },
      zoomFactor: 1,
      telemetry: { enabled: telemetryEnabled },
      general: { alwaysOnTop: false, autoUpdate: true },
      ...storageValues
    }
    
    const mockStore = {
      store: defaultStorage,
      get: vi.fn((key, def) => {
        if (key && key.includes('.')) {
          const keys = key.split('.')
          let value = defaultStorage
          for (const k of keys) {
            value = value?.[k]
            if (value === undefined) return def
          }
          return value
        }
        return key ? (defaultStorage[key] ?? def) : defaultStorage
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
      }),
      delete: vi.fn(),
      clear: vi.fn()
    }
    vi.doMock(CONFIG, () => ({ default: mockStore }))

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
      readFileSync: vi.fn(() => Buffer.from('mock-audio-data')),
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn(),
      copyFileSync: vi.fn(),
      readdirSync: vi.fn(() => ['default.wav', 'bell.wav', 'notification.mp3'])
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

    return { mockStore, metrics, mockSpan, mockTracer, mockRequest }
  }

  const setupMainWithMocks = async (options = {}) => {
    const mocks = setupMocks(options)
    
    // Get electron mock from vitest setup
    const electronMod = await import('electron')
    const electron = electronMod.default || electronMod
    
    // Enhance electron mock with additional methods needed
    electron.BrowserWindow.getAllWindows = vi.fn(() => [
      { webContents: { send: vi.fn() }, getTitle: vi.fn(() => 'Main Window') }
    ])
    electron.screen = {
      getDisplayNearestPoint: vi.fn(() => ({
        bounds: { x: 0, y: 0, width: 1920, height: 1080 }
      }))
    }
    electron.session = {
      defaultSession: {
        clearStorageData: vi.fn().mockResolvedValue(),
        cookies: {
          get: vi.fn().mockResolvedValue([])
        }
      }
    }
    electron.dialog = {
      showMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
      showOpenDialog: vi.fn().mockResolvedValue({ 
        canceled: false, 
        filePaths: ['/mock/path/sound.wav'] 
      })
    }
    electron.shell = {
      openExternal: vi.fn()
    }

    // Mock ipcMain with ability to track registrations
    const ipcHandlers = new Map()
    const ipcListeners = new Map()
    
    electron.ipcMain.handle.mockImplementation((channel, handler) => {
      ipcHandlers.set(channel, handler)
    })
    
    electron.ipcMain.on.mockImplementation((channel, handler) => {
      ipcListeners.set(channel, handler)
    })
    
    electron.ipcMain.setMaxListeners = vi.fn()

    // Import main process to register handlers
    await import(MAIN_INDEX)

    return { 
      electron, 
      ...mocks,
      ipcHandlers,
      ipcListeners,
      getHandler: (channel) => ipcHandlers.get(channel),
      getListener: (channel) => ipcListeners.get(channel)
    }
  }

  describe('Initialization and Bootstrap', () => {
    it('should initialize telemetry bootstrap correctly', async () => {
      const envVars = {
        MAIN_VITE_OTEL_EXPORTER_OTLP_ENDPOINT: 'https://tempo.example.com',
        MAIN_VITE_OTEL_EXPORTER_OTLP_HEADERS: 'authorization=Bearer token123',
        MAIN_VITE_OTEL_SERVICE_NAME: 'kicktalk-test'
      }
      
      const { mockTracer } = await setupMainWithMocks({ envVars })
      
      expect(mockTracer.startSpan).toHaveBeenCalledWith('main_startup_boot')
      expect(process.env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('https://tempo.example.com')
      expect(process.env.OTEL_EXPORTER_OTLP_HEADERS).toBe('authorization=Bearer token123')
    })

    it('should handle missing telemetry configuration gracefully', async () => {
      const { mockTracer } = await setupMainWithMocks()
      
      // Should still attempt to create startup span even without config
      expect(console.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('[Telemetry]: Failed to create startup span')
      )
    })

    it('should set service version from app version', async () => {
      const { electron } = await setupMainWithMocks()
      
      electron.app.getVersion.mockReturnValue('1.2.3')
      
      // Re-import to trigger version setting logic
      vi.resetModules()
      await setupMainWithMocks()
      
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toContain('service.version=1.2.3')
    })

    it('should initialize request ID generator correctly', async () => {
      const crypto = await import(CRYPTO)
      await setupMainWithMocks()
      
      expect(crypto.randomUUID).toBeDefined()
    })
  })

  describe('Application Lifecycle Events', () => {
    it('should handle app ready event', async () => {
      const { electron } = await setupMainWithMocks()
      
      expect(electron.app.whenReady).toHaveBeenCalled()
      
      // Simulate app ready
      const readyPromise = electron.app.whenReady.mock.results[0].value
      await readyPromise
      
      // Should have set up tray
      expect(electron.Tray).toHaveBeenCalled()
    })

    it('should handle window-all-closed event on non-macOS', async () => {
      const { electron, metrics } = await setupMainWithMocks({ platform: 'win32' })
      
      expect(electron.app.on).toHaveBeenCalledWith('window-all-closed', expect.any(Function))
      
      // Get the handler and call it
      const handler = electron.app.on.mock.calls.find(call => call[0] === 'window-all-closed')[1]
      
      await handler()
      
      expect(electron.app.quit).toHaveBeenCalled()
    })

    it('should not quit on macOS when all windows closed', async () => {
      const { electron } = await setupMainWithMocks({ platform: 'darwin' })
      
      const handler = electron.app.on.mock.calls.find(call => call[0] === 'window-all-closed')[1]
      
      await handler()
      
      expect(electron.app.quit).not.toHaveBeenCalled()
    })

    it('should handle activate event on macOS', async () => {
      const { electron } = await setupMainWithMocks({ platform: 'darwin' })
      
      expect(electron.app.on).toHaveBeenCalledWith('activate', expect.any(Function))
      
      // Mock no windows
      electron.BrowserWindow.getAllWindows.mockReturnValue([])
      
      const handler = electron.app.on.mock.calls.find(call => call[0] === 'activate')[1]
      handler()
      
      // Should create new window when no windows exist
      expect(electron.BrowserWindow).toHaveBeenCalled()
    })

    it('should handle browser-window-created event', async () => {
      const { electron } = await setupMainWithMocks()
      
      expect(electron.app.on).toHaveBeenCalledWith('browser-window-created', expect.any(Function))
      
      const electronToolkit = await import(ELECTRON_TOOLKIT_UTILS)
      expect(electronToolkit.optimizer.watchWindowShortcuts).toHaveBeenCalled()
    })
  })

  describe('Window Creation and Management', () => {
    it('should create main window with correct configuration', async () => {
      const { electron, mockStore } = await setupMainWithMocks()
      
      expect(electron.BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 800,
          height: 600,
          minWidth: 335,
          minHeight: 250,
          show: false,
          backgroundColor: '#06190e',
          autoHideMenuBar: true,
          titleBarStyle: 'hidden',
          webPreferences: expect.objectContaining({
            devTools: true,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            backgroundThrottling: false
          })
        })
      )
    })

    it('should apply always on top setting from config', async () => {
      const storageValues = {
        general: { alwaysOnTop: true }
      }
      
      const { electron } = await setupMainWithMocks({ storageValues, platform: 'win32' })
      
      // Get the mock window instance
      const mockWindow = electron.BrowserWindow.mock.results[0].value
      
      expect(mockWindow.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver')
    })

    it('should handle window resize events', async () => {
      const { electron, mockStore } = await setupMainWithMocks()
      
      const mockWindow = electron.BrowserWindow.mock.results[0].value
      mockWindow.getNormalBounds = vi.fn(() => ({ x: 100, y: 100, width: 900, height: 700 }))
      
      // Find and call the resize handler
      const resizeHandler = mockWindow.on.mock.calls.find(call => call[0] === 'resize')[1]
      resizeHandler()
      
      expect(mockStore.set).toHaveBeenCalledWith('lastMainWindowState', {
        x: 100, y: 100, width: 900, height: 700
      })
    })

    it('should handle window close events', async () => {
      const { electron, mockStore, metrics } = await setupMainWithMocks()
      
      const mockWindow = electron.BrowserWindow.mock.results[0].value
      mockWindow.getNormalBounds = vi.fn(() => ({ x: 100, y: 100, width: 900, height: 700 }))
      
      // Find and call the close handler
      const closeHandler = mockWindow.on.mock.calls.find(call => call[0] === 'close')[1]
      closeHandler()
      
      expect(mockStore.set).toHaveBeenCalledWith('lastMainWindowState', {
        x: 100, y: 100, width: 900, height: 700
      })
      expect(metrics.decrementOpenWindows).toHaveBeenCalled()
    })

    it('should load correct URL in development mode', async () => {
      process.env.ELECTRON_RENDERER_URL = 'http://localhost:3000'
      
      const { electron } = await setupMainWithMocks({ isDev: true })
      
      const mockWindow = electron.BrowserWindow.mock.results[0].value
      expect(mockWindow.loadURL).toHaveBeenCalledWith('http://localhost:3000')
    })

    it('should load file in production mode', async () => {
      const { electron } = await setupMainWithMocks({ isDev: false })
      
      const mockWindow = electron.BrowserWindow.mock.results[0].value
      expect(mockWindow.loadFile).toHaveBeenCalled()
    })
  })

  describe('Tray and Menu Creation', () => {
    it('should create system tray with correct configuration', async () => {
      const { electron } = await setupMainWithMocks()
      
      expect(electron.Tray).toHaveBeenCalled()
      
      const mockTray = electron.Tray.mock.results[0].value
      expect(mockTray.setToolTip).toHaveBeenCalledWith('KickTalk')
      expect(mockTray.setContextMenu).toHaveBeenCalled()
    })

    it('should handle tray click events', async () => {
      const { electron } = await setupMainWithMocks()
      
      const mockTray = electron.Tray.mock.results[0].value
      const mockWindow = electron.BrowserWindow.mock.results[0].value
      
      // Mock window state methods
      mockWindow.isVisible = vi.fn(() => true)
      mockWindow.isMinimized = vi.fn(() => false)
      mockWindow.hide = vi.fn()
      mockWindow.show = vi.fn()
      mockWindow.focus = vi.fn()
      
      // Find and call the click handler
      const clickHandler = mockTray.on.mock.calls.find(call => call[0] === 'click')[1]
      clickHandler()
      
      expect(mockWindow.hide).toHaveBeenCalled()
    })

    it('should create context menu with correct items', async () => {
      const { electron } = await setupMainWithMocks()
      
      expect(electron.Menu.buildFromTemplate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ label: expect.stringMatching(/Show|Hide KickTalk/) }),
          expect.objectContaining({ label: 'Settings' }),
          expect.objectContaining({ type: 'separator' }),
          expect.objectContaining({ label: 'Quit' })
        ])
      )
    })
  })

  describe('IPC Handler Setup', () => {
    it('should register all required IPC handlers', async () => {
      const { electron } = await setupMainWithMocks()
      
      const expectedHandlers = [
        'store:get', 'store:set', 'store:delete',
        'chatLogs:get', 'chatLogs:add',
        'replyLogs:get', 'replyLogs:add',
        'logs:updateDeleted', 'replyLogs:updateDeleted',
        'bring-to-front',
        'logout',
        'userDialog:open', 'userDialog:pin',
        'authDialog:open', 'authDialog:auth', 'authDialog:close',
        'settingsDialog:open', 'settingsDialog:close',
        'chattersDialog:open', 'chattersDialog:close',
        'searchDialog:open', 'searchDialog:close',
        'replyThreadDialog:open', 'replyThreadDialog:close',
        'reply:open',
        'alwaysOnTop',
        'get-app-info',
        'otel:get-config', 'otel:trace-export-json',
        'telemetry:readTrace',
        'notificationSounds:openFolder', 'notificationSounds:getAvailable', 'notificationSounds:getSoundUrl'
      ]
      
      for (const handler of expectedHandlers) {
        expect(electron.ipcMain.handle).toHaveBeenCalledWith(handler, expect.any(Function))
      }
    })

    it('should register window control IPC listeners', async () => {
      const { electron } = await setupMainWithMocks()
      
      const expectedListeners = ['minimize', 'maximize', 'close', 'ping']
      
      for (const listener of expectedListeners) {
        expect(electron.ipcMain.on).toHaveBeenCalledWith(listener, expect.any(Function))
      }
    })

    it('should set maximum listeners on ipcMain', async () => {
      const { electron } = await setupMainWithMocks()
      
      expect(electron.ipcMain.setMaxListeners).toHaveBeenCalledWith(100)
    })
  })

  describe('Store Management IPC Handlers', () => {
    it('should handle store:get for retrieving configuration', async () => {
      const { getHandler, mockStore } = await setupMainWithMocks()
      
      const handler = getHandler('store:get')
      
      // Test getting whole store
      const allData = await handler({}, {})
      expect(allData).toBe(mockStore.store)
      
      // Test getting specific key
      const zoomFactor = await handler({}, { key: 'zoomFactor' })
      expect(mockStore.get).toHaveBeenCalledWith('zoomFactor')
      expect(zoomFactor).toBe(1)
    })

    it('should handle store:set and broadcast updates', async () => {
      const { getHandler, electron, mockStore } = await setupMainWithMocks()
      
      const handler = getHandler('store:set')
      const mockWindow = { webContents: { send: vi.fn() } }
      electron.BrowserWindow.getAllWindows.mockReturnValue([mockWindow])
      
      await handler({}, { key: 'zoomFactor', value: 1.5 })
      
      expect(mockStore.set).toHaveBeenCalledWith('zoomFactor', 1.5)
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('store:updated', { zoomFactor: 1.5 })
    })

    it('should handle store:delete and broadcast updates', async () => {
      const { getHandler, electron, mockStore } = await setupMainWithMocks()
      
      const handler = getHandler('store:delete')
      const mockWindow = { webContents: { send: vi.fn() } }
      electron.BrowserWindow.getAllWindows.mockReturnValue([mockWindow])
      
      await handler({}, { key: 'testKey' })
      
      expect(mockStore.delete).toHaveBeenCalledWith('testKey')
    })

    it('should handle general settings changes for always on top', async () => {
      const { getHandler, electron } = await setupMainWithMocks({ platform: 'win32' })
      
      const handler = getHandler('store:set')
      const mockWindow = electron.BrowserWindow.mock.results[0].value
      
      await handler({}, { key: 'general', value: { alwaysOnTop: true } })
      
      expect(mockWindow.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver', 1)
    })
  })

  describe('Chat Logs Management', () => {
    it('should handle chatLogs:add and chatLogs:get', async () => {
      const { getHandler } = await setupMainWithMocks()
      
      const addHandler = getHandler('chatLogs:add')
      const getHandler_logs = getHandler('chatLogs:get')
      
      const chatroomId = 'room123'
      const userId = 'user456'
      const message = {
        id: 'msg1',
        created_at: '2024-01-01T12:00:00Z',
        text: 'Hello world'
      }
      
      // Add a message
      const result = await addHandler({}, { data: { chatroomId, userId, message } })
      expect(result).toEqual({ messages: [message] })
      
      // Retrieve messages
      const logs = await getHandler_logs({}, { data: { chatroomId, userId } })
      expect(Array.isArray(logs)).toBe(true)
      expect(logs).toHaveLength(1)
      expect(logs[0].id).toBe('msg1')
    })

    it('should handle replyLogs:add and replyLogs:get', async () => {
      const { getHandler } = await setupMainWithMocks()
      
      const addHandler = getHandler('replyLogs:add')
      const getHandler_logs = getHandler('replyLogs:get')
      
      const chatroomId = 'room123'
      const message = {
        id: 'reply1',
        created_at: '2024-01-01T12:00:00Z',
        text: 'This is a reply',
        sender: { id: 'user456' },
        metadata: {
          original_message: { id: 'original1' }
        }
      }
      
      // Add a reply
      const result = await addHandler({}, { message, chatroomId })
      expect(Array.isArray(result)).toBe(true)
      
      // Retrieve replies
      const logs = await getHandler_logs({}, { 
        data: { originalMessageId: 'original1', chatroomId } 
      })
      expect(Array.isArray(logs)).toBe(true)
    })

    it('should handle message deletion updates', async () => {
      const { getHandler } = await setupMainWithMocks()
      
      const deleteHandler = getHandler('logs:updateDeleted')
      
      const result = await deleteHandler({}, { 
        chatroomId: 'room123', 
        messageId: 'msg1' 
      })
      
      expect(typeof result).toBe('boolean')
    })
  })

  describe('Dialog Management', () => {
    it('should handle userDialog:open', async () => {
      const { getHandler, electron } = await setupMainWithMocks()
      
      const handler = getHandler('userDialog:open')
      const mockMainWindow = electron.BrowserWindow.mock.results[0].value
      mockMainWindow.getPosition = vi.fn(() => [100, 100])
      
      const data = {
        chatroomId: 'room123',
        sender: { id: 'user456' },
        cords: [50, 75]
      }
      
      await handler({}, { data })
      
      // Should create a new BrowserWindow for the dialog
      expect(electron.BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 600,
          height: 600,
          frame: false,
          transparent: true,
          parent: mockMainWindow
        })
      )
    })

    it('should handle authDialog:open', async () => {
      const { getHandler, electron } = await setupMainWithMocks()
      
      const handler = getHandler('authDialog:open')
      const mockMainWindow = electron.BrowserWindow.mock.results[0].value
      mockMainWindow.getPosition = vi.fn(() => [100, 100])
      
      await handler({})
      
      expect(electron.BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 600,
          frame: false,
          transparent: true,
          parent: mockMainWindow
        })
      )
    })

    it('should handle settingsDialog:open', async () => {
      const { getHandler, electron } = await setupMainWithMocks()
      
      const handler = getHandler('settingsDialog:open')
      const mockMainWindow = electron.BrowserWindow.mock.results[0].value
      mockMainWindow.getPosition = vi.fn(() => [100, 100])
      mockMainWindow.getSize = vi.fn(() => [800, 600])
      
      await handler({}, { data: { userData: null } })
      
      expect(electron.BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 1200,
          height: 700,
          frame: false,
          transparent: true,
          parent: mockMainWindow
        })
      )
    })
  })

  describe('Window Controls', () => {
    it('should handle minimize IPC message', async () => {
      const { getListener, electron } = await setupMainWithMocks()
      
      const handler = getListener('minimize')
      const mockWindow = electron.BrowserWindow.mock.results[0].value
      
      handler()
      
      expect(mockWindow.minimize).toHaveBeenCalled()
    })

    it('should handle maximize/unmaximize IPC message', async () => {
      const { getListener, electron } = await setupMainWithMocks()
      
      const handler = getListener('maximize')
      const mockWindow = electron.BrowserWindow.mock.results[0].value
      
      // Test maximize
      mockWindow.isMaximized = vi.fn(() => false)
      handler()
      expect(mockWindow.maximize).toHaveBeenCalled()
      
      // Test unmaximize
      mockWindow.isMaximized = vi.fn(() => true)
      handler()
      expect(mockWindow.unmaximize).toHaveBeenCalled()
    })

    it('should handle close IPC message', async () => {
      const { getListener, electron } = await setupMainWithMocks()
      
      const handler = getListener('close')
      const mockWindow = electron.BrowserWindow.mock.results[0].value
      
      handler()
      
      expect(mockWindow.close).toHaveBeenCalled()
    })
  })

  describe('Telemetry IPC Handlers', () => {
    it('should handle telemetry:recordMessageSent when enabled', async () => {
      const { getHandler, metrics } = await setupMainWithMocks({ telemetryEnabled: true })
      
      const handler = getHandler('telemetry:recordMessageSent')
      
      await handler({}, {
        chatroomId: 'room123',
        messageType: 'regular',
        duration: 250,
        success: true,
        streamerName: 'TestStreamer'
      })
      
      expect(metrics.recordMessageSent).toHaveBeenCalledWith('room123', 'regular', 'TestStreamer')
      expect(metrics.recordMessageSendDuration).toHaveBeenCalledWith(250, 'room123', true)
    })

    it('should not call telemetry when disabled', async () => {
      const { getHandler, metrics } = await setupMainWithMocks({ telemetryEnabled: false })
      
      const handler = getHandler('telemetry:recordMessageSent')
      
      await handler({}, {
        chatroomId: 'room123',
        messageType: 'regular',
        duration: 250,
        success: true
      })
      
      expect(metrics.recordMessageSent).not.toHaveBeenCalled()
      expect(metrics.recordMessageSendDuration).not.toHaveBeenCalled()
    })

    it('should handle telemetry:recordError', async () => {
      const { getHandler, metrics } = await setupMainWithMocks({ telemetryEnabled: true })
      
      const handler = getHandler('telemetry:recordError')
      
      await handler({}, {
        error: { message: 'Test error', name: 'TestError' },
        context: { operation: 'test' }
      })
      
      expect(metrics.recordError).toHaveBeenCalled()
    })

    it('should handle otel:get-config', async () => {
      const envVars = {
        MAIN_VITE_OTEL_EXPORTER_OTLP_ENDPOINT: 'https://tempo.example.com',
        MAIN_VITE_OTEL_EXPORTER_OTLP_HEADERS: 'authorization=Bearer token123'
      }
      
      const { getHandler } = await setupMainWithMocks({ envVars })
      
      const handler = getHandler('otel:get-config')
      
      const result = await handler()
      
      expect(result).toEqual({
        ok: true,
        useIpcRelay: true,
        deploymentEnv: 'test'
      })
    })
  })

  describe('Notification Sounds', () => {
    it('should handle notificationSounds:getAvailable', async () => {
      const { getHandler } = await setupMainWithMocks()
      
      const handler = getHandler('notificationSounds:getAvailable')
      
      const result = await handler()
      
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
      expect(result[0]).toHaveProperty('name')
      expect(result[0]).toHaveProperty('value')
    })

    it('should handle notificationSounds:getSoundUrl', async () => {
      const { getHandler } = await setupMainWithMocks({ isDev: true })
      
      const handler = getHandler('notificationSounds:getSoundUrl')
      
      const result = await handler({}, { soundFile: 'default' })
      
      expect(typeof result).toBe('string')
      expect(result.startsWith('data:')).toBe(true)
    })
  })

  describe('Security Configurations', () => {
    it('should configure webPreferences securely', async () => {
      const { electron } = await setupMainWithMocks()
      
      expect(electron.BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          webPreferences: expect.objectContaining({
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false // Note: This is false in the actual code
          })
        })
      )
    })

    it('should handle external URL opening securely', async () => {
      const { electron } = await setupMainWithMocks()
      
      const mockWindow = electron.BrowserWindow.mock.results[0].value
      
      // Find setWindowOpenHandler call
      const setHandlerCall = mockWindow.webContents.setWindowOpenHandler.mock.calls[0]
      expect(setHandlerCall).toBeDefined()
      
      const handler = setHandlerCall[0]
      const result = handler({ url: 'https://external.com' })
      
      expect(result).toEqual({ action: 'deny' })
      expect(electron.shell.openExternal).toHaveBeenCalledWith('https://external.com')
    })
  })

  describe('Development vs Production Behavior', () => {
    it('should open dev tools in development mode', async () => {
      const { electron } = await setupMainWithMocks({ isDev: true })
      
      const mockWindow = electron.BrowserWindow.mock.results[0].value
      
      // Simulate ready-to-show event
      const readyHandler = mockWindow.once.mock.calls.find(call => call[0] === 'ready-to-show')[1]
      readyHandler()
      
      expect(mockWindow.webContents.openDevTools).toHaveBeenCalledWith({ mode: 'detach' })
    })

    it('should not open dev tools in production mode', async () => {
      const { electron } = await setupMainWithMocks({ isDev: false })
      
      const mockWindow = electron.BrowserWindow.mock.results[0].value
      
      // Simulate ready-to-show event
      const readyHandler = mockWindow.once.mock.calls.find(call => call[0] === 'ready-to-show')[1]
      readyHandler()
      
      expect(mockWindow.webContents.openDevTools).not.toHaveBeenCalled()
    })

    it('should use different icon paths for different platforms', async () => {
      const { electron } = await setupMainWithMocks({ platform: 'win32' })
      
      expect(electron.BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: expect.stringContaining('.ico')
        })
      )
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing chatroom ID in logs gracefully', async () => {
      const { getHandler } = await setupMainWithMocks()
      
      const handler = getHandler('chatLogs:get')
      
      const result = await handler({}, { data: {} })
      
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(0)
    })

    it('should handle invalid message data in chatLogs:add', async () => {
      const { getHandler } = await setupMainWithMocks()
      
      const handler = getHandler('chatLogs:add')
      
      const result = await handler({}, { data: { chatroomId: '', userId: '', message: null } })
      
      expect(result).toBeNull()
    })

    it('should handle telemetry errors gracefully', async () => {
      const { getHandler } = await setupMainWithMocks({ telemetryEnabled: true })
      
      const handler = getHandler('telemetry:recordError')
      
      // Should not throw with invalid error object
      expect(() => {
        handler({}, { error: null, context: {} })
      }).not.toThrow()
    })

    it('should handle missing environment variables in OTEL config', async () => {
      const { getHandler } = await setupMainWithMocks()
      
      const handler = getHandler('otel:get-config')
      
      const result = await handler()
      
      expect(result).toEqual({
        ok: false,
        reason: 'missing_endpoint_or_headers'
      })
    })
  })

  describe('Performance and Resource Management', () => {
    it('should limit IPC listeners correctly', async () => {
      const { electron } = await setupMainWithMocks()
      
      expect(electron.ipcMain.setMaxListeners).toHaveBeenCalledWith(100)
    })

    it('should track window count with metrics', async () => {
      const { electron, metrics } = await setupMainWithMocks()
      
      expect(metrics.incrementOpenWindows).toHaveBeenCalled()
      
      // Simulate window close
      const mockWindow = electron.BrowserWindow.mock.results[0].value
      const closeHandler = mockWindow.on.mock.calls.find(call => call[0] === 'close')[1]
      closeHandler()
      
      expect(metrics.decrementOpenWindows).toHaveBeenCalled()
    })

    it('should handle zoom factor changes efficiently', async () => {
      const { electron, mockStore } = await setupMainWithMocks()
      
      const mockWindow = electron.BrowserWindow.mock.results[0].value
      
      // Mock webContents methods
      mockWindow.webContents.getZoomFactor = vi.fn(() => 1.0)
      mockWindow.webContents.setZoomFactor = vi.fn()
      
      // Simulate zoom in event
      const zoomHandler = mockWindow.webContents.on.mock.calls.find(call => call[0] === 'zoom-changed')?.[1]
      
      if (zoomHandler) {
        const mockEvent = { preventDefault: vi.fn() }
        zoomHandler(mockEvent, 'in')
        
        expect(mockEvent.preventDefault).toHaveBeenCalled()
        expect(mockWindow.webContents.setZoomFactor).toHaveBeenCalled()
        expect(mockStore.set).toHaveBeenCalledWith('zoomFactor', expect.any(Number))
      }
    })
  })
})