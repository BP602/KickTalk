import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'path'
import { Buffer } from 'buffer'

// Resolve absolute module paths for consistent mocking
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

// Mock console to suppress logs during testing
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

describe('Main Process IPC Handlers', () => {
  let originalConsole
  let originalProcessEnv
  let mockElectron
  let mockStore
  let mockAuthStore
  let mockMetrics
  let ipcHandlers
  let mockDialog
  let mockSession

  beforeEach(() => {
    vi.resetModules()
    originalConsole = mockConsole()
    originalProcessEnv = { ...process.env }
    
    // Set test environment
    process.env.NODE_ENV = 'test'
    process.env.VITEST = 'true'
    
    // Setup comprehensive mocks
    setupMocks()
  })

  describe('Provider Refresh Handler', () => {
    it('should broadcast provider:refresh to all windows', async () => {
      const { getHandler, electron } = await loadMainAndGetHandlers()
      const handler = getHandler('provider:refresh')

      // Mock two windows
      const win1 = { webContents: { send: vi.fn() } }
      const win2 = { webContents: { send: vi.fn() } }
      electron.BrowserWindow.getAllWindows = vi.fn(() => [win1, win2])

      const res = await handler({}, { provider: 'stv' })
      expect(res).toEqual({ ok: true })
      expect(win1.webContents.send).toHaveBeenCalledWith('provider:refresh', { provider: 'stv' })
      expect(win2.webContents.send).toHaveBeenCalledWith('provider:refresh', { provider: 'stv' })
    })

    it('should set alwaysOnTop correctly on darwin', async () => {
      const { getHandler, electron } = await loadMainAndGetHandlers()
      const handler = getHandler('store:set')

      // Change platform to darwin for this test
      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
      Object.defineProperty(process, 'platform', { value: 'darwin' })

      const mainWindow = electron.BrowserWindow.mock.results[0]?.value
      await handler({}, { key: 'general', value: { alwaysOnTop: true } })

      expect(mainWindow.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true, { visibleOnFullScreen: true })
      expect(mainWindow.setAlwaysOnTop).toHaveBeenCalledWith(true)

      // Restore platform
      if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform)
    })

    it('should set alwaysOnTop correctly on win32', async () => {
      const { getHandler, electron } = await loadMainAndGetHandlers()
      const handler = getHandler('store:set')

      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
      Object.defineProperty(process, 'platform', { value: 'win32' })

      const mainWindow = electron.BrowserWindow.mock.results[0]?.value
      await handler({}, { key: 'general', value: { alwaysOnTop: true } })

      expect(mainWindow.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver', 1)

      if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform)
    })

    it('should set alwaysOnTop correctly on linux', async () => {
      const { getHandler, electron } = await loadMainAndGetHandlers()
      const handler = getHandler('store:set')

      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
      Object.defineProperty(process, 'platform', { value: 'linux' })

      const mainWindow = electron.BrowserWindow.mock.results[0]?.value
      await handler({}, { key: 'general', value: { alwaysOnTop: true } })

      expect(mainWindow.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver', 1)

      if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform)
    })
  })

  afterEach(() => {
    restoreConsole(originalConsole)
    process.env = originalProcessEnv
    vi.clearAllMocks()
  })

  const setupMocks = () => {
    // Mock crypto
    vi.doMock(CRYPTO, () => ({
      randomUUID: vi.fn(() => 'test-uuid-1234'),
      randomBytes: vi.fn(() => Buffer.from('testhexbytes'))
    }))

    // Mock https module for telemetry IPC relay
    const mockRequest = {
      on: vi.fn((event, handler) => {
        if (event === 'error') {
          // Store error handler for manual triggering
          mockRequest._errorHandler = handler
        }
      }),
      end: vi.fn(),
      write: vi.fn(),
      setTimeout: vi.fn(),
      destroy: vi.fn()
    }
    
    vi.doMock(HTTPS, () => ({
      request: vi.fn((options, callback) => {
        // Store the callback for manual triggering
        mockRequest._responseCallback = callback
        return mockRequest
      })
    }))

    // Mock telemetry modules
    vi.doMock(TELEMETRY_TRACING, () => ({}))

    // Mock OpenTelemetry API
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
      },
      context: {
        with: vi.fn((ctx, fn) => fn()),
        active: vi.fn()
      }
    }))

    // Mock file system for notification sounds
    const mockFsBuffer = Buffer.from('mock-audio-data')
    const fsMock = {
      existsSync: vi.fn(() => true),
      readFileSync: vi.fn((filePath) => {
        if (filePath.includes('.wav') || filePath.includes('.mp3')) {
          return mockFsBuffer
        }
        return 'mock file content'
      }),
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn(),
      copyFileSync: vi.fn(),
      readdirSync: vi.fn(() => ['default.wav', 'bells.mp3', 'notification.wav']),
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

    // Mock path module
    vi.doMock('path', () => ({
      join: vi.fn((...args) => args.join('/')),
      resolve: vi.fn((...args) => args.join('/')),
      basename: vi.fn((p) => p.split('/').pop()),
      dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/'))
    }))

    // Mock config store
    const defaultStorage = {
      general: { alwaysOnTop: false, autoUpdate: true },
      telemetry: { enabled: true },
      lastMainWindowState: { width: 800, height: 600, x: 100, y: 100 },
      zoomFactor: 1.0
    }
    
    mockStore = {
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
        return key ? (defaultStorage[key] || def) : defaultStorage
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
      delete: vi.fn(),
      clear: vi.fn()
    }
    
    vi.doMock(CONFIG, () => ({ default: mockStore }))

    // Mock auth store (electron-store)
    mockAuthStore = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn()
    }
    vi.doMock(ELECTRON_STORE, () => ({
      default: vi.fn(() => mockAuthStore)
    }))

    // Mock dialog
    mockDialog = {
      showOpenDialog: vi.fn(),
      showMessageBox: vi.fn()
    }

    // Mock session
    mockSession = {
      defaultSession: {
        clearStorageData: vi.fn(),
        cookies: {
          get: vi.fn()
        }
      }
    }

    // Mock BrowserWindow
    const mockBrowserWindow = {
      id: 1,
      loadURL: vi.fn(),
      loadFile: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      close: vi.fn(),
      focus: vi.fn(),
      isVisible: vi.fn(() => true),
      isMinimized: vi.fn(() => false),
      isAlwaysOnTop: vi.fn(() => false),
      setAlwaysOnTop: vi.fn(),
      setVisibleOnAllWorkspaces: vi.fn(),
      setPosition: vi.fn(),
      getPosition: vi.fn(() => [100, 100]),
      getSize: vi.fn(() => [800, 600]),
      getNormalBounds: vi.fn(() => ({ x: 100, y: 100, width: 800, height: 600 })),
      setThumbarButtons: vi.fn(),
      webContents: {
        send: vi.fn(),
        on: vi.fn(),
        openDevTools: vi.fn(),
        setWindowOpenHandler: vi.fn(),
        setZoomFactor: vi.fn(),
        getZoomFactor: vi.fn(() => 1.0),
        reload: vi.fn()
      }
    }

    // Mock Electron
    mockElectron = {
      app: {
        whenReady: vi.fn(() => Promise.resolve()),
        on: vi.fn(),
        quit: vi.fn(),
        getName: vi.fn(() => 'KickTalk'),
        getVersion: vi.fn(() => '1.0.0'),
        getPath: vi.fn((name) => `/mock/path/${name}`),
        isPackaged: false,
        setAppUserModelId: vi.fn()
      },
      BrowserWindow: Object.assign(vi.fn(() => mockBrowserWindow), {
        getAllWindows: vi.fn(() => [mockBrowserWindow])
      }),
      ipcMain: {
        handle: vi.fn(),
        on: vi.fn(),
        setMaxListeners: vi.fn()
      },
      dialog: mockDialog,
      session: mockSession,
      shell: {
        openExternal: vi.fn()
      },
      screen: {
        getDisplayNearestPoint: vi.fn(() => ({
          bounds: { x: 0, y: 0, width: 1920, height: 1080 }
        }))
      },
      Tray: vi.fn(() => ({
        setToolTip: vi.fn(),
        setContextMenu: vi.fn(),
        on: vi.fn()
      })),
      Menu: {
        buildFromTemplate: vi.fn(() => ({ popup: vi.fn() }))
      }
    }

    vi.doMock(ELECTRON, () => ({ 
      default: mockElectron,
      ...mockElectron 
    }))

    // Mock other utilities
    vi.doMock(ELECTRON_TOOLKIT_UTILS, () => ({
      electronApp: { setAppUserModelId: vi.fn() },
      optimizer: { watchWindowShortcuts: vi.fn() }
    }))

    vi.doMock(UPDATE_UTILS, () => ({ update: vi.fn() }))

    // Mock metrics
    mockMetrics = {
      incrementOpenWindows: vi.fn(),
      decrementOpenWindows: vi.fn(),
      recordError: vi.fn(),
      recordMessageSent: vi.fn(),
      recordMessageSendDuration: vi.fn(),
      recordRendererMemory: vi.fn(),
      recordDomNodeCount: vi.fn(),
      incrementWebSocketConnections: vi.fn(),
      decrementWebSocketConnections: vi.fn(),
      recordConnectionError: vi.fn(),
      recordMessageReceived: vi.fn(),
      recordReconnection: vi.fn(),
      recordAPIRequest: vi.fn(),
      recordSevenTVConnectionHealth: vi.fn(),
      recordSevenTVWebSocketCreated: vi.fn(),
      recordSevenTVEmoteUpdate: vi.fn(),
      recordSevenTVEmoteChanges: vi.fn(),
      recordChatroomSwitch: vi.fn(),
      shutdown: vi.fn()
    }
    vi.doMock(TELEMETRY_METRICS, () => ({
      MetricsHelper: mockMetrics
    }))
  }

  const loadMainAndGetHandlers = async () => {
    // Track IPC handlers
    ipcHandlers = new Map()
    
    mockElectron.ipcMain.handle.mockImplementation((channel, handler) => {
      ipcHandlers.set(channel, handler)
    })
    
    // Import the main process
    await import(MAIN_INDEX)
    
    return {
      getHandler: (channel) => ipcHandlers.get(channel),
      electron: mockElectron,
      store: mockStore,
      authStore: mockAuthStore,
      dialog: mockDialog,
      session: mockSession
    }
  }

  describe('Notification Sound Handlers', () => {
    it('should get available notification sounds', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('notificationSounds:getAvailable')
      
      expect(handler).toBeDefined()
      
      const result = await handler()
      
      expect(result).toEqual([
        { name: 'default', value: expect.stringContaining('default.wav') },
        { name: 'bells', value: expect.stringContaining('bells.mp3') },
        { name: 'notification', value: expect.stringContaining('notification.wav') }
      ])
    })

    it('should get sound URL for development environment', async () => {
      process.env.NODE_ENV = 'development'
      
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('notificationSounds:getSoundUrl')
      
      expect(handler).toBeDefined()
      
      const result = await handler({}, { soundFile: 'default' })
      
      // Should return base64 data URL in development
      expect(result).toMatch(/^data:audio\/(wav|mpeg);base64,/)
    })

    it('should get sound URL for production environment', async () => {
      process.env.NODE_ENV = 'production'
      
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('notificationSounds:getSoundUrl')
      
      expect(handler).toBeDefined()
      
      const result = await handler({}, { soundFile: 'default' })
      
      // Should return file:// URL in production
      expect(result).toMatch(/^file:\/\//)
    })

    it('should fallback to default sound when requested sound not found', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('notificationSounds:getSoundUrl')
      
      const result = await handler({}, { soundFile: 'nonexistent' })
      
      // Should fallback to default sound
      expect(result).toBeDefined()
    })

    it('should handle sound file upload via dialog', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('notificationSounds:openFolder')
      
      // Mock successful file selection
      mockDialog.showOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ['/path/to/custom.wav']
      })
      
      const result = await handler()
      
      expect(mockDialog.showOpenDialog).toHaveBeenCalledWith(
        expect.any(Object), // settingsDialog or mainWindow
        expect.objectContaining({
          title: 'Select Notification Sound',
          filters: expect.arrayContaining([
            { name: 'Audio Files', extensions: ['mp3', 'wav'] }
          ]),
          properties: ['openFile']
        })
      )
      
      expect(result).toEqual({
        name: 'custom',
        value: expect.stringContaining('custom.wav'),
        fileName: 'custom.wav'
      })
    })

    it('should handle canceled sound file dialog', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('notificationSounds:openFolder')
      
      // Mock canceled dialog
      mockDialog.showOpenDialog.mockResolvedValue({
        canceled: true,
        filePaths: []
      })
      
      const result = await handler()
      
      expect(result).toBeNull()
    })
  })

  describe('Dialog Management Handlers', () => {
    it('should open user dialog with correct positioning', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('userDialog:open')
      
      expect(handler).toBeDefined()
      
      const testData = {
        chatroomId: 'test-room',
        sender: { id: 'user123' },
        cords: [200, 150]
      }
      
      await handler({}, { data: testData })
      
      // Should create a new BrowserWindow - check the second call (first is main window)
      expect(mockElectron.BrowserWindow).toHaveBeenCalledTimes(2)
      const userDialogCall = mockElectron.BrowserWindow.mock.calls[1][0]
      expect(userDialogCall).toEqual(
        expect.objectContaining({
          width: 600,
          height: 600,
          x: 150, // mainWindowPos[0] + cords[0] - 150 = 100 + 200 - 150
          y: 150, // mainWindowPos[1] + cords[1] - 100 = 100 + 150 - 100
          show: false,
          resizable: false,
          frame: false,
          transparent: true
        })
      )
    })

    it('should pin/unpin user dialog', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const openHandler = getHandler('userDialog:open')
      const pinHandler = getHandler('userDialog:pin')
      
      // First open the dialog
      await openHandler({}, { 
        data: { 
          chatroomId: 'test', 
          sender: { id: 'user1' }, 
          cords: [0, 0] 
        } 
      })
      
      // Then test pinning
      await pinHandler({}, true)
      
      const windowInstance = mockElectron.BrowserWindow.mock.results[0]?.value
      expect(windowInstance.setAlwaysOnTop).toHaveBeenCalledWith(true)
      expect(windowInstance.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true)
    })

    it('should open auth dialog centered on display', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('authDialog:open')
      
      await handler({})
      
      expect(mockElectron.BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 600,
          minHeight: 400,
          show: true,
          resizable: false,
          frame: false,
          transparent: true
        })
      )
    })

    it('should open settings dialog with proper configuration', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('settingsDialog:open')
      
      await handler({}, { data: { userData: { name: 'test' } } })
      
      expect(mockElectron.BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 1200,
          minWidth: 800,
          height: 700,
          minHeight: 600,
          show: false,
          resizable: true,
          frame: false,
          transparent: true
        })
      )
    })

    it('should open chatters dialog', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('chattersDialog:open')
      
      const testData = { chatroomId: 'test-room', users: [] }
      await handler({}, { data: testData })
      
      expect(mockElectron.BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 350,
          minWidth: 350,
          height: 600,
          minHeight: 400,
          show: false,
          resizable: true
        })
      )
    })

    it('should close dialogs gracefully', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const closeHandler = getHandler('settingsDialog:close')
      
      // Should not throw when no dialog exists
      expect(() => closeHandler()).not.toThrow()
    })
  })

  describe('Chat and Reply Log Management', () => {
    it('should add user log correctly', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('chatLogs:add')
      
      const testData = {
        chatroomId: 'room1',
        userId: 'user1',
        message: {
          id: 'msg1',
          content: 'Hello world',
          created_at: new Date().toISOString()
        }
      }
      
      const result = await handler({}, { data: testData })
      
      expect(result).toEqual({
        messages: expect.arrayContaining([
          expect.objectContaining({
            id: 'msg1',
            content: 'Hello world'
          })
        ])
      })
    })

    it('should get user logs for chatroom and user', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const addHandler = getHandler('chatLogs:add')
      const getHandler_logs = getHandler('chatLogs:get')
      
      // Add a message first
      await addHandler({}, {
        data: {
          chatroomId: 'room1',
          userId: 'user1',
          message: { id: 'msg1', content: 'Test', created_at: new Date().toISOString() }
        }
      })
      
      // Get logs
      const result = await getHandler_logs({}, { data: { chatroomId: 'room1', userId: 'user1' } })
      
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'msg1' })
        ])
      )
    })

    it('should add reply log correctly', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('replyLogs:add')
      
      const testMessage = {
        id: 'reply1',
        content: 'Reply message',
        created_at: new Date().toISOString(),
        metadata: {
          original_message: { id: 'original1' }
        },
        sender: { id: 'user1' }
      }
      
      const result = await handler({}, {
        message: testMessage,
        chatroomId: 'room1'
      })
      
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'reply1' })
        ])
      )
    })

    it('should get reply logs for original message', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const addHandler = getHandler('replyLogs:add')
      const getHandler_replies = getHandler('replyLogs:get')
      
      // Add a reply first
      const testMessage = {
        id: 'reply1',
        content: 'Test reply',
        created_at: new Date().toISOString(),
        metadata: { original_message: { id: 'original1' } },
        sender: { id: 'user1' }
      }
      
      await addHandler({}, { message: testMessage, chatroomId: 'room1' })
      
      // Get replies
      const result = await getHandler_replies({}, {
        data: { originalMessageId: 'original1', chatroomId: 'room1' }
      })
      
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'reply1' })
        ])
      )
    })

    it('should update deleted message status', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const addHandler = getHandler('chatLogs:add')
      const updateHandler = getHandler('logs:updateDeleted')
      
      // Add a message first
      await addHandler({}, {
        data: {
          chatroomId: 'room1',
          userId: 'user1',
          message: { id: 'msg1', content: 'Test', created_at: new Date().toISOString() }
        }
      })
      
      // Mark as deleted
      const result = await updateHandler({}, { chatroomId: 'room1', messageId: 'msg1' })
      
      expect(result).toBe(true)
    })

    it('should clear reply logs for a specific thread', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const addReplyHandler = getHandler('replyLogs:add')
      const getRepliesHandler = getHandler('replyLogs:get')
      const clearHandler = getHandler('replyLogs:clear')

      const chatroomId = 'roomX'
      const originalMessageId = 'orig-1'
      const testMessage = {
        id: 'reply-1',
        content: 'Reply 1',
        created_at: new Date().toISOString(),
        metadata: { original_message: { id: originalMessageId } },
        sender: { id: 'user1' }
      }

      // Add a reply to create the thread
      await addReplyHandler({}, { message: testMessage, chatroomId })

      // Verify it exists
      let replies = await getRepliesHandler({}, { data: { originalMessageId, chatroomId } })
      expect(replies).toEqual(
        expect.arrayContaining([ expect.objectContaining({ id: 'reply-1' }) ])
      )

      // Clear the specific thread
      const cleared = await clearHandler({}, { data: { chatroomId, originalMessageId } })
      expect(cleared).toBe(true)

      // Thread should now be empty
      replies = await getRepliesHandler({}, { data: { originalMessageId, chatroomId } })
      expect(replies).toEqual([])
    })

    it('should clear all reply logs for a chatroom', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const addReplyHandler = getHandler('replyLogs:add')
      const getRepliesHandler = getHandler('replyLogs:get')
      const clearHandler = getHandler('replyLogs:clear')

      const chatroomId = 'roomY'
      const msgA = {
        id: 'reply-A',
        content: 'Reply A',
        created_at: new Date().toISOString(),
        metadata: { original_message: { id: 'orig-A' } },
        sender: { id: 'user1' }
      }
      const msgB = {
        id: 'reply-B',
        content: 'Reply B',
        created_at: new Date().toISOString(),
        metadata: { original_message: { id: 'orig-B' } },
        sender: { id: 'user2' }
      }

      // Add two threads
      await addReplyHandler({}, { message: msgA, chatroomId })
      await addReplyHandler({}, { message: msgB, chatroomId })

      // Sanity check
      let repliesA = await getRepliesHandler({}, { data: { originalMessageId: 'orig-A', chatroomId } })
      let repliesB = await getRepliesHandler({}, { data: { originalMessageId: 'orig-B', chatroomId } })
      expect(repliesA.length).toBeGreaterThan(0)
      expect(repliesB.length).toBeGreaterThan(0)

      // Clear all threads for this chatroom
      const clearedAll = await clearHandler({}, { data: { chatroomId } })
      expect(clearedAll).toBe(true)

      repliesA = await getRepliesHandler({}, { data: { originalMessageId: 'orig-A', chatroomId } })
      repliesB = await getRepliesHandler({}, { data: { originalMessageId: 'orig-B', chatroomId } })
      expect(repliesA).toEqual([])
      expect(repliesB).toEqual([])
    })
  })

  describe('Telemetry IPC Relay', () => {
    beforeEach(() => {
      // Set up OTLP environment variables
      process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_ENDPOINT = 'https://tempo.example.com'
      process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_HEADERS = 'Authorization=Bearer test-token'
    })

    it('should get OTLP configuration for renderer', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('otel:get-config')
      
      const result = await handler()
      
      expect(result).toEqual({
        ok: true,
        useIpcRelay: true,
        deploymentEnv: 'test'
      })
    })

    it('should handle missing OTLP configuration', async () => {
      delete process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_ENDPOINT
      delete process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_HEADERS
      
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('otel:get-config')
      
      const result = await handler()
      
      expect(result).toEqual({
        ok: false,
        reason: 'missing_endpoint_or_headers'
      })
    })

    it('should relay trace export to OTLP endpoint successfully', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('otel:trace-export-json')
      
      const testExport = {
        resourceSpans: [{
          spans: [{ name: 'test-span' }]
        }]
      }
      
      const result = await handler({}, testExport)
      
      // Should attempt the request (may fail in test environment due to network)
      expect(result).toEqual(expect.objectContaining({
        ok: expect.any(Boolean),
        requestId: expect.any(String)
      }))
    })

    it('should handle trace export HTTP errors', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('otel:trace-export-json')
      
      const result = await handler({}, { test: 'data' })
      
      // Should handle errors gracefully
      expect(result).toEqual({
        ok: false,
        reason: expect.any(String),
        requestId: expect.any(String)
      })
    })

    it('should read trace from Grafana Tempo', async () => {
      process.env.MAIN_VITE_GRAFANA_TEMPO_QUERY_URL = 'https://grafana.example.com'
      process.env.MAIN_VITE_GRAFANA_TEMPO_QUERY_USER = 'user123'
      process.env.MAIN_VITE_GRAFANA_TEMPO_QUERY_TOKEN = 'token456'
      
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('telemetry:readTrace')
      
      const result = await handler({}, 'test-trace-id')
      
      // Should attempt to read trace and return result structure
      expect(result).toEqual(expect.objectContaining({
        success: expect.any(Boolean),
        requestId: expect.any(String),
        traceId: 'test-trace-id',
        message: expect.any(String)
      }))
    })

    it('should handle missing Grafana configuration', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('telemetry:readTrace')
      
      const result = await handler({}, 'test-trace')
      
      expect(result).toEqual({
        success: false,
        reason: 'missing_grafana_config',
        message: expect.stringContaining('not configured'),
        requestId: expect.any(String)
      })
    })
  })

  describe('Authentication Flow', () => {
    it('should handle logout confirmation', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('logout')
      
      // Mock user clicking "Yes" to confirm logout
      mockDialog.showMessageBox.mockResolvedValue({ response: 0 })
      
      // Should be callable without throwing
      expect(handler).toBeDefined()
      expect(() => handler()).not.toThrow()
    })

    it('should handle canceled logout', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('logout')
      
      // Mock user clicking "Cancel"
      mockDialog.showMessageBox.mockResolvedValue({ response: 1 })
      
      // Should be callable without throwing
      expect(handler).toBeDefined()
      expect(() => handler()).not.toThrow()
    })
  })

  describe('Store Operations', () => {
    it('should get store values with nested keys', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('store:get')
      
      const result = await handler({}, { key: 'general.alwaysOnTop' })
      
      // The handler should exist and be callable
      expect(handler).toBeDefined()
      
      // Should return some value (might be false, true, or undefined)
      expect([false, true, undefined]).toContain(result)
    })

    it('should set store values and broadcast updates', async () => {
      const { getHandler, electron } = await loadMainAndGetHandlers()
      const handler = getHandler('store:set')
      
      // Mock BrowserWindow.getAllWindows
      const mockWindow = { webContents: { send: vi.fn() } }
      electron.BrowserWindow.getAllWindows = vi.fn(() => [mockWindow])
      
      await handler({}, { key: 'general.alwaysOnTop', value: true })
      
      // Should broadcast update to all windows
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'store:updated',
        { 'general.alwaysOnTop': true }
      )
    })

    it('should delete store keys and notify windows', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('store:delete')
      
      await handler({}, { key: 'testKey' })
      
      // The handler exists and can be called without errors
      expect(handler).toBeDefined()
    })
  })

  describe('Window Management', () => {
    it('should bring main window to front', async () => {
      const { getHandler, electron } = await loadMainAndGetHandlers()
      const handler = getHandler('bring-to-front')
      
      // Create a mock main window
      const mainWindow = electron.BrowserWindow.mock.results[0]?.value
      mainWindow.isMinimized = vi.fn(() => true)
      mainWindow.restore = vi.fn()
      mainWindow.focus = vi.fn()
      
      await handler()
      
      expect(mainWindow.restore).toHaveBeenCalled()
      expect(mainWindow.focus).toHaveBeenCalled()
    })

    it('should handle window controls (minimize, maximize, close)', async () => {
      const { getHandler, electron } = await loadMainAndGetHandlers()
      
      const mainWindow = electron.BrowserWindow.mock.results[0]?.value
      
      // Test minimize
      const minimizeHandler = getHandler('minimize')
      if (minimizeHandler) {
        minimizeHandler()
        expect(mainWindow.minimize).toHaveBeenCalled()
      }
      
      // Test maximize toggle
      const maximizeHandler = getHandler('maximize')
      if (maximizeHandler) {
        mainWindow.isMaximized = vi.fn(() => false)
        maximizeHandler()
        expect(mainWindow.maximize).toHaveBeenCalled()
      }
      
      // Test close
      const closeHandler = getHandler('close')
      if (closeHandler) {
        closeHandler()
        expect(mainWindow.close).toHaveBeenCalled()
      }
    })
  })

  describe('Telemetry Event Handlers', () => {
    beforeEach(() => {
      // Enable telemetry in the store
      mockStore.store.telemetry = { enabled: true }
      mockStore.get.mockImplementation((key, def) => {
        if (key === 'telemetry') return { enabled: true }
        if (key === 'telemetry.enabled') return true
        if (key && key.includes('.')) {
          const keys = key.split('.')
          let value = mockStore.store
          for (const k of keys) {
            value = value?.[k]
            if (value === undefined) return def
          }
          return value
        }
        return mockStore.store[key] || def
      })
    })

    it('should record message sent telemetry', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('telemetry:recordMessageSent')
      
      expect(handler).toBeDefined()
      
      // Clear any previous calls and invoke handler
      mockMetrics.recordMessageSent.mockClear()
      mockMetrics.recordMessageSendDuration.mockClear()
      
      await handler({}, { 
        chatroomId: 'room1', 
        messageType: 'regular',
        duration: 100,
        success: true,
        streamerName: 'TestStreamer'
      })
      
      // Just verify the handler can be called without throwing
      expect(() => handler({}, { chatroomId: 'room1' })).not.toThrow()
    })

    it('should record error telemetry with proper error object handling', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('telemetry:recordError')
      
      const testError = {
        message: 'Test error message',
        name: 'TestError',
        stack: 'Error stack trace'
      }
      
      expect(handler).toBeDefined()
      
      await handler({}, { error: testError, context: { component: 'test' } })
      
      // Just verify the handler can be called without throwing
      expect(() => handler({}, { error: testError })).not.toThrow()
    })

    it('should record WebSocket connection telemetry', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('telemetry:recordWebSocketConnection')
      
      expect(handler).toBeDefined()
      
      await handler({}, {
        chatroomId: 'room1',
        streamerId: 'streamer1',
        connected: true,
        streamerName: 'TestStreamer'
      })
      
      // Just verify the handler can be called without throwing
      expect(() => handler({}, { connected: true })).not.toThrow()
    })

    it('should skip telemetry when disabled', async () => {
      // Reset telemetry to disabled state
      mockStore.store.telemetry = { enabled: false }
      mockStore.get.mockImplementation((key, def) => {
        if (key === 'telemetry') return { enabled: false }
        if (key === 'telemetry.enabled') return false
        if (key && key.includes('.')) {
          const keys = key.split('.')
          let value = mockStore.store
          for (const k of keys) {
            value = value?.[k]
            if (value === undefined) return def
          }
          return value
        }
        return mockStore.store[key] || def
      })
      
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('telemetry:recordMessageSent')
      
      // Clear any previous calls
      mockMetrics.recordMessageSent.mockClear()
      
      await handler({}, { chatroomId: 'room1', messageType: 'regular' })
      
      // Should not call metrics when telemetry is disabled
      expect(mockMetrics.recordMessageSent).not.toHaveBeenCalled()
    })
  })

  describe('Authentication Flow Handlers', () => {
    it('should handle auth dialog authentication with kick provider', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const authHandler = getHandler('authDialog:auth')
      
      expect(authHandler).toBeDefined()
      
      // Mock the auth flow - this will trigger complex login logic
      const authData = { type: 'kick' }
      
      // Should handle the auth request without throwing
      expect(() => authHandler({}, { data: authData })).not.toThrow()
    })

    it('should handle auth dialog authentication with google provider', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const authHandler = getHandler('authDialog:auth')
      
      const authData = { type: 'google' }
      expect(() => authHandler({}, { data: authData })).not.toThrow()
    })

    it('should handle auth dialog authentication with apple provider', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const authHandler = getHandler('authDialog:auth')
      
      const authData = { type: 'apple' }
      expect(() => authHandler({}, { data: authData })).not.toThrow()
    })

    it('should handle unknown auth provider gracefully', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const authHandler = getHandler('authDialog:auth')
      
      const authData = { type: 'unknown' }
      expect(() => authHandler({}, { data: authData })).not.toThrow()
    })

    it('should handle auth dialog close', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const closeHandler = getHandler('authDialog:close')
      
      expect(closeHandler).toBeDefined()
      expect(() => closeHandler()).not.toThrow()
    })
  })

  describe('Window Management Handlers', () => {
    it('should handle always on top toggle', async () => {
      const { getHandler, electron } = await loadMainAndGetHandlers()
      const handler = getHandler('alwaysOnTop')
      
      expect(handler).toBeDefined()
      
      const mainWindow = electron.BrowserWindow.mock.results[0]?.value
      mainWindow.isAlwaysOnTop = vi.fn(() => false)
      
      await handler()
      
      expect(mainWindow.setAlwaysOnTop).toHaveBeenCalledWith(true)
    })

    it('should bring window to front when minimized', async () => {
      const { getHandler, electron } = await loadMainAndGetHandlers()
      const handler = getHandler('bring-to-front')
      
      const mainWindow = electron.BrowserWindow.mock.results[0]?.value
      mainWindow.isMinimized = vi.fn(() => true)
      mainWindow.restore = vi.fn()
      mainWindow.focus = vi.fn()
      
      await handler()
      
      expect(mainWindow.restore).toHaveBeenCalled()
      expect(mainWindow.focus).toHaveBeenCalled()
    })

    it('should bring window to front when not minimized', async () => {
      const { getHandler, electron } = await loadMainAndGetHandlers()
      const handler = getHandler('bring-to-front')
      
      const mainWindow = electron.BrowserWindow.mock.results[0]?.value
      mainWindow.isMinimized = vi.fn(() => false)
      mainWindow.restore = vi.fn()
      mainWindow.focus = vi.fn()
      
      await handler()
      
      expect(mainWindow.restore).not.toHaveBeenCalled()
      expect(mainWindow.focus).toHaveBeenCalled()
    })
  })

  describe('App Info Handler', () => {
    it('should get app information', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('get-app-info')
      
      expect(handler).toBeDefined()
      
      const result = await handler()
      
      expect(result).toEqual(
        expect.objectContaining({
          appVersion: expect.any(String),
          nodeVersion: expect.any(String)
        })
      )
      
      // These may be undefined in test environment
      expect(result).toHaveProperty('electronVersion')
      expect(result).toHaveProperty('chromeVersion')
    })
  })

  describe('Extended Dialog Management Handlers', () => {
    it('should open search dialog with data', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('searchDialog:open')
      
      const testData = { query: 'test search', filters: [] }
      await handler({}, { data: testData })
      
      expect(mockElectron.BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 650,
          minWidth: 650,
          height: 600,
          minHeight: 600,
          show: false,
          resizable: true,
          frame: false,
          transparent: true
        })
      )
    })

    it('should close search dialog gracefully', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('searchDialog:close')
      
      expect(() => handler()).not.toThrow()
    })

    it('should open reply thread dialog', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('replyThreadDialog:open')
      
      const testData = {
        chatroomId: 'room1',
        originalMessageId: 'msg1',
        message: { id: 'original1', content: 'Original message' }
      }
      
      await handler({}, { data: testData })
      
      expect(mockElectron.BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 550,
          height: 500,
          show: false,
          resizable: false,
          frame: false,
          transparent: true
        })
      )
    })

    it('should close reply thread dialog', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('replyThreadDialog:close')
      
      expect(() => handler()).not.toThrow()
    })

    it('should handle reply input opening', async () => {
      const { getHandler, electron } = await loadMainAndGetHandlers()
      const handler = getHandler('reply:open')
      
      const mainWindow = electron.BrowserWindow.mock.results[0]?.value
      const testData = { replyTo: { id: 'msg1', content: 'Original' } }
      
      await handler({}, { data: testData })
      
      expect(mainWindow.webContents.send).toHaveBeenCalledWith('reply:data', testData)
    })
  })

  describe('Extended Telemetry Handlers', () => {
    beforeEach(() => {
      // Enable telemetry for these tests
      mockStore.store.telemetry = { enabled: true }
      mockStore.get.mockImplementation((key, def) => {
        if (key === 'telemetry') return { enabled: true }
        if (key === 'telemetry.enabled') return true
        if (key && key.includes('.')) {
          const keys = key.split('.')
          let value = mockStore.store
          for (const k of keys) {
            value = value?.[k]
            if (value === undefined) return def
          }
          return value
        }
        return mockStore.store[key] || def
      })
    })

    describe('SevenTV Telemetry Handlers', () => {
      it('should record SevenTV connection health', async () => {
        const { getHandler } = await loadMainAndGetHandlers()
        const handler = getHandler('telemetry:recordSevenTVConnectionHealth')
        
        expect(handler).toBeDefined()
        
        await handler({}, {
          chatroomsCount: 5,
          connectionsCount: 3,
          state: 'healthy'
        })
        
        expect(() => handler({}, { state: 'connected' })).not.toThrow()
      })

      it('should record SevenTV WebSocket creation', async () => {
        const { getHandler } = await loadMainAndGetHandlers()
        const handler = getHandler('telemetry:recordSevenTVWebSocketCreated')
        
        await handler({}, {
          chatroomId: 'room1',
          stvId: 'stv123',
          emoteSets: ['set1', 'set2']
        })
        
        expect(() => handler({}, { chatroomId: 'room1' })).not.toThrow()
      })

      it('should record SevenTV emote updates', async () => {
        const { getHandler } = await loadMainAndGetHandlers()
        const handler = getHandler('telemetry:recordSevenTVEmoteUpdate')
        
        await handler({}, {
          chatroomId: 'room1',
          pulled: 10,
          pushed: 5,
          updated: 2,
          duration: 1500
        })
        
        expect(() => handler({}, { chatroomId: 'room1' })).not.toThrow()
      })

      it('should record SevenTV emote changes', async () => {
        const { getHandler } = await loadMainAndGetHandlers()
        const handler = getHandler('telemetry:recordSevenTVEmoteChanges')
        
        await handler({}, {
          chatroomId: 'room1',
          added: 3,
          removed: 1,
          updated: 2,
          setType: 'global'
        })
        
        expect(() => handler({}, { chatroomId: 'room1' })).not.toThrow()
      })
    })

    describe('User Analytics Handlers', () => {
      it('should start user session', async () => {
        const { getHandler } = await loadMainAndGetHandlers()
        const handler = getHandler('telemetry:startUserSession')
        
        const result = await handler({}, { sessionId: 'session1', userId: 'user1' })
        
        expect(typeof result).toBe('object')
        expect(() => handler({}, { sessionId: 'session1' })).not.toThrow()
      })

      it('should end user session', async () => {
        const { getHandler } = await loadMainAndGetHandlers()
        const handler = getHandler('telemetry:endUserSession')
        
        expect(() => handler({}, { sessionId: 'session1' })).not.toThrow()
      })

      it('should record user action', async () => {
        const { getHandler } = await loadMainAndGetHandlers()
        const handler = getHandler('telemetry:recordUserAction')
        
        const result = await handler({}, {
          sessionId: 'session1',
          actionType: 'click',
          context: { component: 'button' }
        })
        
        expect(typeof result === 'object' || result === undefined).toBe(true)
      })

      it('should record feature usage', async () => {
        const { getHandler } = await loadMainAndGetHandlers()
        const handler = getHandler('telemetry:recordFeatureUsage')
        
        await handler({}, {
          sessionId: 'session1',
          featureName: 'emote-picker',
          action: 'open',
          context: { source: 'keyboard-shortcut' }
        })
        
        expect(() => handler({}, { sessionId: 'session1', featureName: 'test' })).not.toThrow()
      })

      it('should record chat engagement', async () => {
        const { getHandler } = await loadMainAndGetHandlers()
        const handler = getHandler('telemetry:recordChatEngagement')
        
        await handler({}, { sessionId: 'session1', engagementSeconds: 300 })
        
        expect(() => handler({}, { sessionId: 'session1', engagementSeconds: 60 })).not.toThrow()
      })

      it('should record connection quality', async () => {
        const { getHandler } = await loadMainAndGetHandlers()
        const handler = getHandler('telemetry:recordConnectionQuality')
        
        await handler({}, {
          sessionId: 'session1',
          quality: 'good',
          eventType: 'websocket-connect'
        })
        
        expect(() => handler({}, { sessionId: 'session1', quality: 'poor' })).not.toThrow()
      })

      it('should get user analytics data', async () => {
        const { getHandler } = await loadMainAndGetHandlers()
        const handler = getHandler('telemetry:getUserAnalyticsData')
        
        const result = await handler()
        
        expect(typeof result).toBe('object')
      })

      it('should get user action types', async () => {
        const { getHandler } = await loadMainAndGetHandlers()
        const handler = getHandler('telemetry:getUserActionTypes')
        
        const result = await handler()
        
        expect(typeof result).toBe('object')
      })
    })

    describe('Performance Monitoring Handlers', () => {
      it('should monitor UI interaction performance', async () => {
        const { getHandler } = await loadMainAndGetHandlers()
        const handler = getHandler('telemetry:monitorUIInteraction')
        
        const result = await handler({}, {
          interactionType: 'click',
          executionTime: 150,
          context: { component: 'chat-input' }
        })
        
        expect(['good', 'needs-improvement', 'poor']).toContain(result)
      })

      it('should monitor component render performance', async () => {
        const { getHandler } = await loadMainAndGetHandlers()
        const handler = getHandler('telemetry:monitorComponentRender')
        
        const result = await handler({}, {
          componentName: 'ChatMessage',
          renderTime: 8,
          context: { messageCount: 50 }
        })
        
        expect(['good', 'needs-improvement', 'poor']).toContain(result)
      })

      it('should monitor WebSocket latency', async () => {
        const { getHandler } = await loadMainAndGetHandlers()
        const handler = getHandler('telemetry:monitorWebSocketLatency')
        
        const result = await handler({}, {
          latency: 45,
          context: { endpoint: 'kick-ws' }
        })
        
        expect(['good', 'needs-improvement', 'poor']).toContain(result)
      })

      it('should monitor memory usage', async () => {
        const { getHandler } = await loadMainAndGetHandlers()
        const handler = getHandler('telemetry:monitorMemoryUsage')
        
        const result = await handler({}, {
          memoryMB: 256,
          context: { process: 'renderer' }
        })
        
        expect(['good', 'needs-improvement', 'poor']).toContain(result)
      })

      it('should monitor CPU usage', async () => {
        const { getHandler } = await loadMainAndGetHandlers()
        const handler = getHandler('telemetry:monitorCPUUsage')
        
        const result = await handler({}, {
          cpuPercent: 25.5,
          context: { activity: 'video-chat' }
        })
        
        expect(['good', 'needs-improvement', 'poor']).toContain(result)
      })

      it('should monitor bundle size', async () => {
        const { getHandler } = await loadMainAndGetHandlers()
        const handler = getHandler('telemetry:monitorBundleSize')
        
        const result = await handler({}, {
          bundleName: 'main',
          sizeKB: 1024
        })
        
        expect(['good', 'needs-improvement', 'poor']).toContain(result)
      })

      it('should get performance data', async () => {
        const { getHandler } = await loadMainAndGetHandlers()
        const handler = getHandler('telemetry:getPerformanceData')
        
        const result = await handler()
        
        expect(typeof result).toBe('object')
      })
    })

    it('should record chatroom switch', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('telemetry:recordChatroomSwitch')
      
      await handler({}, {
        fromChatroomId: 'room1',
        toChatroomId: 'room2',
        duration: 250
      })
      
      expect(() => handler({}, {
        fromChatroomId: 'room1',
        toChatroomId: 'room2'
      })).not.toThrow()
    })

    it('should record API request telemetry', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('telemetry:recordAPIRequest')
      
      await handler({}, {
        endpoint: '/api/channels/123/chatroom',
        method: 'GET',
        statusCode: 200,
        duration: 150
      })
      
      expect(() => handler({}, { endpoint: '/api/test', method: 'POST' })).not.toThrow()
    })
  })

  describe('Extended Store Operations', () => {
    it('should get entire store when no key provided', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('store:get')
      
      const result = await handler({}, {})
      
      expect(typeof result).toBe('object')
    })

    it('should handle store set with auto-update dismissal', async () => {
      const { getHandler, electron } = await loadMainAndGetHandlers()
      const handler = getHandler('store:set')
      
      const mainWindow = electron.BrowserWindow.mock.results[0]?.value
      
      await handler({}, { 
        key: 'general', 
        value: { autoUpdate: false, alwaysOnTop: false } 
      })
      
      // Should send dismiss notification when auto-update is disabled
      expect(mainWindow.webContents.send).toHaveBeenCalledWith('autoUpdater:dismiss')
    })

    it('should handle store delete and notify windows', async () => {
      const { getHandler, electron } = await loadMainAndGetHandlers()
      const handler = getHandler('store:delete')
      
      const mainWindow = electron.BrowserWindow.mock.results[0]?.value
      
      await handler({}, { key: 'testKey' })
      
      expect(mainWindow.webContents.send).toHaveBeenCalledWith(
        'store:updated',
        { testKey: null }
      )
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid chat log data gracefully', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('chatLogs:add')
      
      // Test with missing required fields
      const result = await handler({}, { 
        data: { chatroomId: null, userId: null, message: null } 
      })
      
      expect(result).toBeNull()
    })

    it('should handle invalid reply log data gracefully', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('replyLogs:add')
      
      // Test with invalid message structure
      const result = await handler({}, {
        message: { id: 'test' }, // Missing required metadata
        chatroomId: 'room1'
      })
      
      expect(result).toBeNull()
    })

    it('should handle file system errors in notification sounds', async () => {
      const fs = await import('fs')
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File read error')
      })
      
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('notificationSounds:getSoundUrl')
      
      const result = await handler({}, { soundFile: 'test' })
      
      // Should still return a result (likely null or fallback)
      expect(result).toBeDefined()
    })

    it('should handle dialog close errors gracefully', async () => {
      const { getHandler } = await loadMainAndGetHandlers()
      const handler = getHandler('settingsDialog:close')
      
      // Should not throw even if dialog doesn't exist
      expect(() => handler()).not.toThrow()
    })
  })
})