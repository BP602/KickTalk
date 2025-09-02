import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'path'

const abs = (rel) => path.normalize(new URL(rel, import.meta.url).pathname)
const PRELOAD_INDEX = abs('../index.js')

// Mock global localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock

// Mock global window for non-contextIsolated tests
global.window = {
  electron: undefined
}

// Mock process.contextIsolated
Object.defineProperty(process, 'contextIsolated', {
  value: true,
  writable: true
})

describe('preload/index.js - Electron Preload Script', () => {
  let mockContextBridge
  let mockIpcRenderer
  let mockShell
  let mockSession
  let mockElectronStore
  let mockKickAPI
  let mockStvAPI
  let mockElectronAPI
  let originalConsole

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    // Mock console to suppress logs during tests
    originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    }
    console.log = vi.fn()
    console.warn = vi.fn()
    console.error = vi.fn()

    // Reset localStorage mock
    localStorageMock.getItem.mockReset()
    localStorageMock.setItem.mockReset()
    localStorageMock.removeItem.mockReset()
    localStorageMock.clear.mockReset()

    // Setup Electron mocks
    mockContextBridge = {
      exposeInMainWorld: vi.fn()
    }

    mockIpcRenderer = {
      invoke: vi.fn(),
      send: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn()
    }

    mockShell = {
      openExternal: vi.fn()
    }

    mockSession = {}

    mockElectronAPI = {
      ipcRenderer: mockIpcRenderer
    }

    // Mock electron-store
    mockElectronStore = vi.fn(() => ({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn()
    }))

    // Setup Kick API mocks
    mockKickAPI = {
      sendMessageToChannel: vi.fn(),
      sendReplyToChannel: vi.fn(),
      getChannelInfo: vi.fn(),
      getChannelChatroomInfo: vi.fn(),
      getKickEmotes: vi.fn(),
      getSelfInfo: vi.fn(),
      getUserChatroomInfo: vi.fn(),
      getSelfChatroomInfo: vi.fn(),
      getSilencedUsers: vi.fn(),
      getLinkThumbnail: vi.fn(),
      getInitialChatroomMessages: vi.fn(),
      getInitialPollInfo: vi.fn(),
      getSubmitPollVote: vi.fn(),
      getChatroomViewers: vi.fn(),
      getBanUser: vi.fn(),
      getUnbanUser: vi.fn(),
      getTimeoutUser: vi.fn(),
      getDeleteMessage: vi.fn(),
      getSilenceUser: vi.fn(),
      getUnsilenceUser: vi.fn(),
      getPinMessage: vi.fn(),
      getUnpinMessage: vi.fn(),
      getKickAuthForEvents: vi.fn(),
      getUpdateTitle: vi.fn(),
      getClearChatroom: vi.fn()
    }

    // Setup STV API mocks
    mockStvAPI = {
      getUserStvProfile: vi.fn(),
      getChannelEmotes: vi.fn()
    }

    // Apply mocks
    vi.doMock('electron', () => ({
      contextBridge: mockContextBridge,
      ipcRenderer: mockIpcRenderer,
      shell: mockShell,
      session: mockSession
    }))

    vi.doMock('@electron-toolkit/preload', () => ({
      electronAPI: mockElectronAPI
    }))

    vi.doMock('electron-store', () => ({
      default: mockElectronStore
    }))

    vi.doMock('../../../utils/services/kick/kickAPI', () => mockKickAPI)
    vi.doMock('../../../utils/services/seventv/stvAPI', () => mockStvAPI)
  })

  afterEach(() => {
    // Restore console
    console.log = originalConsole.log
    console.warn = originalConsole.warn
    console.error = originalConsole.error
    
    // Reset process.contextIsolated to true
    Object.defineProperty(process, 'contextIsolated', { value: true, writable: true })
    
    // Reset window
    global.window.electron = undefined
  })

  // Helper to load and initialize preload module
  const loadPreload = async () => {
    const module = await import(PRELOAD_INDEX)
    await new Promise(resolve => setTimeout(resolve, 100)) // Wait for initialization
    return module
  }

  describe('module initialization', () => {
    it('should initialize electron-store with correct configuration', async () => {
      await loadPreload()
      
      expect(mockElectronStore).toHaveBeenCalledWith({
        fileExtension: "env"
      })
    })

    it('should handle electron-store initialization failure gracefully', async () => {
      mockElectronStore.mockImplementation(() => {
        throw new Error('Store initialization failed')
      })

      await expect(loadPreload()).resolves.toBeDefined()
    })
  })

  describe('session validation', () => {
    let storeInstance

    beforeEach(() => {
      storeInstance = {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn()
      }
      mockElectronStore.mockReturnValue(storeInstance)
    })

    it('should validate session token successfully when valid credentials exist', async () => {
      const mockUserData = {
        id: 'user123',
        streamer_channel: {
          user_id: 'streamer456',
          slug: 'teststreamer'
        }
      }

      const mockStvData = {
        user_id: 'stv789',
        emoteSets: [
          { type: 'personal', id: 'set1' },
          { type: 'global', id: 'set2' }
        ]
      }

      storeInstance.get.mockImplementation((key) => {
        if (key === 'SESSION_TOKEN') return 'valid-token'
        if (key === 'KICK_SESSION') return 'valid-session'
        return null
      })

      mockKickAPI.getSelfInfo.mockResolvedValue({ data: mockUserData })
      mockStvAPI.getUserStvProfile.mockResolvedValue(mockStvData)

      await loadPreload()

      expect(mockKickAPI.getSelfInfo).toHaveBeenCalledWith('valid-token', 'valid-session')
      expect(mockStvAPI.getUserStvProfile).toHaveBeenCalledWith('user123')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('kickId', 'streamer456')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('kickUsername', 'teststreamer')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('stvId', 'stv789')
    })

    it('should handle missing session tokens', async () => {
      storeInstance.get.mockReturnValue(null)

      await loadPreload()

      expect(storeInstance.clear).toHaveBeenCalled()
      expect(localStorageMock.clear).toHaveBeenCalled()
      expect(mockKickAPI.getSelfInfo).not.toHaveBeenCalled()
    })

    it('should handle session validation errors', async () => {
      storeInstance.get.mockImplementation((key) => {
        if (key === 'SESSION_TOKEN') return 'invalid-token'
        if (key === 'KICK_SESSION') return 'invalid-session'
        return null
      })

      mockKickAPI.getSelfInfo.mockRejectedValue(new Error('Unauthorized'))

      await loadPreload()

      // The validation function should handle errors gracefully
      // It may or may not clear auth data depending on error handling
      expect(mockKickAPI.getSelfInfo).toHaveBeenCalledWith('invalid-token', 'invalid-session')
    })
  })

  describe('settings synchronization', () => {
    it('should sync settings from main store to localStorage', async () => {
      const mockSettings = {
        theme: 'dark',
        notifications: true,
        volume: 0.8
      }

      mockIpcRenderer.invoke.mockResolvedValue(mockSettings)

      await loadPreload()

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('store:get', { key: undefined })
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'settings',
        JSON.stringify(mockSettings)
      )
    })

    it('should handle settings sync failure gracefully', async () => {
      mockIpcRenderer.invoke.mockRejectedValue(new Error('IPC error'))

      await loadPreload()

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('store:get', { key: undefined })
      // Should not crash on error
    })
  })

  describe('context bridge API exposure', () => {
    it('should expose preload readiness API', async () => {
      await loadPreload()

      const preloadCall = mockContextBridge.exposeInMainWorld.mock.calls.find(
        call => call[0] === 'preload'
      )

      expect(preloadCall).toBeDefined()
      const preloadAPI = preloadCall[1]

      expect(preloadAPI).toHaveProperty('isReady')
      expect(preloadAPI).toHaveProperty('onReady')
      expect(typeof preloadAPI.isReady).toBe('function')
      expect(typeof preloadAPI.onReady).toBe('function')
    })

    it('should expose telemetry API with proper methods', async () => {
      await loadPreload()

      const telemetryCall = mockContextBridge.exposeInMainWorld.mock.calls.find(
        call => call[0] === 'telemetry'
      )

      expect(telemetryCall).toBeDefined()
      const telemetryAPI = telemetryCall[1]

      expect(telemetryAPI).toHaveProperty('getOtelConfig')
      expect(telemetryAPI).toHaveProperty('exportTracesJson')
      expect(telemetryAPI).toHaveProperty('readTrace')
      expect(typeof telemetryAPI.getOtelConfig).toBe('function')
      expect(typeof telemetryAPI.exportTracesJson).toBe('function')
      expect(typeof telemetryAPI.readTrace).toBe('function')
    })

    it('should expose app API with core methods', async () => {
      await loadPreload()

      const appCall = mockContextBridge.exposeInMainWorld.mock.calls.find(
        call => call[0] === 'app'
      )

      expect(appCall).toBeDefined()
      const appAPI = appCall[1]

      // Window controls
      expect(appAPI).toHaveProperty('minimize')
      expect(appAPI).toHaveProperty('maximize')
      expect(appAPI).toHaveProperty('close')

      // Store API
      expect(appAPI).toHaveProperty('store')
      expect(appAPI.store).toHaveProperty('get')
      expect(appAPI.store).toHaveProperty('set')
      expect(appAPI.store).toHaveProperty('delete')

      // Auth API
      expect(appAPI).toHaveProperty('auth')
      expect(appAPI.auth).toHaveProperty('isValidToken')
      expect(appAPI.auth).toHaveProperty('clearTokens')

      // Kick API
      expect(appAPI).toHaveProperty('kick')
      expect(appAPI.kick).toHaveProperty('getChannelInfo')
      expect(appAPI.kick).toHaveProperty('sendMessage')

      // STV API
      expect(appAPI).toHaveProperty('stv')
      expect(appAPI.stv).toHaveProperty('getChannelEmotes')

      // Utils
      expect(appAPI).toHaveProperty('utils')
      expect(appAPI.utils).toHaveProperty('openExternal')
    })
  })

  describe('preload readiness API functionality', () => {
    it('should return true after initialization', async () => {
      await loadPreload()
      
      const preloadCall = mockContextBridge.exposeInMainWorld.mock.calls.find(
        call => call[0] === 'preload'
      )
      const preloadAPI = preloadCall[1]

      expect(preloadAPI.isReady()).toBe(true)
    })

    it('should call callback immediately when already ready', async () => {
      await loadPreload()
      
      const preloadCall = mockContextBridge.exposeInMainWorld.mock.calls.find(
        call => call[0] === 'preload'
      )
      const preloadAPI = preloadCall[1]

      const callback = vi.fn()
      const unsubscribe = preloadAPI.onReady(callback)

      expect(callback).toHaveBeenCalled()
      expect(typeof unsubscribe).toBe('function')
    })

    it('should handle invalid callback gracefully', async () => {
      await loadPreload()
      
      const preloadCall = mockContextBridge.exposeInMainWorld.mock.calls.find(
        call => call[0] === 'preload'
      )
      const preloadAPI = preloadCall[1]

      const unsubscribe = preloadAPI.onReady('not-a-function')
      expect(typeof unsubscribe).toBe('function')
    })
  })

  describe('telemetry API functionality', () => {
    let telemetryAPI

    beforeEach(async () => {
      await loadPreload()
      const telemetryCall = mockContextBridge.exposeInMainWorld.mock.calls.find(
        call => call[0] === 'telemetry'
      )
      telemetryAPI = telemetryCall[1]
    })

    it('should invoke IPC call to get OTEL config', () => {
      mockIpcRenderer.invoke.mockResolvedValue({ endpoint: 'http://localhost:4318' })

      const result = telemetryAPI.getOtelConfig()

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('otel:get-config')
      expect(result).toBeInstanceOf(Promise)
    })

    it('should export valid trace data', async () => {
      const validPayload = {
        resourceSpans: [
          {
            resource: { attributes: [] },
            scopeSpans: []
          }
        ]
      }

      mockIpcRenderer.invoke.mockResolvedValue({ ok: true })

      const result = await telemetryAPI.exportTracesJson(validPayload)

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('otel:trace-export-json', validPayload)
      expect(result).toEqual({ ok: true })
    })

    it('should reject invalid payload', async () => {
      const result = await telemetryAPI.exportTracesJson(null)

      expect(result).toEqual({ ok: false, reason: 'invalid_json' })
    })

    it('should read trace with valid trace ID', async () => {
      const traceId = 'trace-123'
      mockIpcRenderer.invoke.mockResolvedValue({ success: true, data: {} })

      const result = await telemetryAPI.readTrace(traceId)

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('telemetry:readTrace', traceId)
      expect(result).toEqual({ success: true, data: {} })
    })

    it('should reject invalid trace ID', async () => {
      const result = await telemetryAPI.readTrace('')

      expect(result).toEqual({ success: false, reason: 'invalid_trace_id' })
    })
  })

  describe('app API functionality', () => {
    let appAPI

    beforeEach(async () => {
      await loadPreload()
      const appCall = mockContextBridge.exposeInMainWorld.mock.calls.find(
        call => call[0] === 'app'
      )
      appAPI = appCall[1]
    })

    it('should send window control commands via IPC', () => {
      appAPI.minimize()
      expect(mockIpcRenderer.send).toHaveBeenCalledWith('minimize')

      appAPI.maximize()
      expect(mockIpcRenderer.send).toHaveBeenCalledWith('maximize')

      appAPI.close()
      expect(mockIpcRenderer.send).toHaveBeenCalledWith('close')
    })

    it('should handle store operations', async () => {
      mockIpcRenderer.invoke.mockResolvedValue('test-value')

      const result = await appAPI.store.get('test-key')
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('store:get', { key: 'test-key' })
      expect(result).toBe('test-value')

      await appAPI.store.set('test-key', 'new-value')
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('store:set', { key: 'test-key', value: 'new-value' })

      await appAPI.store.delete('test-key')
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('store:delete', { key: 'test-key' })
    })

    it('should setup store update listener', () => {
      const callback = vi.fn()
      const cleanup = appAPI.store.onUpdate(callback)

      expect(mockIpcRenderer.on).toHaveBeenCalledWith('store:updated', expect.any(Function))
      expect(typeof cleanup).toBe('function')

      cleanup()
      expect(mockIpcRenderer.removeListener).toHaveBeenCalledWith('store:updated', expect.any(Function))
    })

    it('should open external URLs', () => {
      const url = 'https://example.com'
      appAPI.utils.openExternal(url)

      expect(mockShell.openExternal).toHaveBeenCalledWith(url)
    })
  })

  describe('authentication methods', () => {
    let appAPI
    let storeInstance

    beforeEach(async () => {
      storeInstance = {
        get: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn()
      }
      mockElectronStore.mockReturnValue(storeInstance)

      await loadPreload()
      const appCall = mockContextBridge.exposeInMainWorld.mock.calls.find(
        call => call[0] === 'app'
      )
      appAPI = appCall[1]
    })

    it('should clear tokens', () => {
      appAPI.auth.clearTokens()

      expect(storeInstance.delete).toHaveBeenCalledWith('SESSION_TOKEN')
      expect(storeInstance.delete).toHaveBeenCalledWith('KICK_SESSION')
    })

    it('should get tokens', () => {
      storeInstance.get.mockImplementation((key) => {
        if (key === 'SESSION_TOKEN') return 'token-value'
        if (key === 'KICK_SESSION') return 'session-value'
        return null
      })

      const result = appAPI.auth.getToken()

      expect(result).toEqual({
        token: 'token-value',
        session: 'session-value'
      })
    })

    it('should validate tokens', async () => {
      storeInstance.get.mockImplementation((key) => {
        if (key === 'SESSION_TOKEN') return 'valid-token'
        if (key === 'KICK_SESSION') return 'valid-session'
        return null
      })

      mockKickAPI.getSelfInfo.mockResolvedValue({ data: { id: 'user123' } })

      const result = await appAPI.auth.isValidToken()

      // The auth.isValidToken function should call the validateSessionToken function
      // which internally calls getSelfInfo
      expect(typeof result).toBe('boolean')
      expect(storeInstance.get).toHaveBeenCalledWith('SESSION_TOKEN')
      expect(storeInstance.get).toHaveBeenCalledWith('KICK_SESSION')
    })
  })

  describe('Kick API methods with auth wrapper', () => {
    let appAPI
    let storeInstance

    beforeEach(async () => {
      storeInstance = {
        get: vi.fn()
      }
      mockElectronStore.mockReturnValue(storeInstance)

      await loadPreload()
      const appCall = mockContextBridge.exposeInMainWorld.mock.calls.find(
        call => call[0] === 'app'
      )
      appAPI = appCall[1]
    })

    it('should call public API methods without auth', async () => {
      mockKickAPI.getChannelInfo.mockResolvedValue({ channel: 'data' })

      const result = await appAPI.kick.getChannelInfo('test-channel')

      expect(mockKickAPI.getChannelInfo).toHaveBeenCalledWith('test-channel')
      expect(result).toEqual({ channel: 'data' })
    })

    it('should return null for unauthorized requests when no tokens', async () => {
      storeInstance.get.mockReturnValue(null)

      const result = await appAPI.kick.sendMessage('channel123', 'Hello world')

      expect(result).toBeNull()
      expect(mockKickAPI.sendMessageToChannel).not.toHaveBeenCalled()
    })

    it('should handle getSelfInfo with error handling', async () => {
      storeInstance.get.mockImplementation((key) => {
        if (key === 'SESSION_TOKEN') return 'valid-token'
        if (key === 'KICK_SESSION') return 'valid-session'
        return null
      })

      mockKickAPI.getSelfInfo.mockRejectedValue(new Error('API error'))

      const result = await appAPI.kick.getSelfInfo()

      expect(result).toBeNull()
    })
  })

  describe('error handling and fallbacks', () => {
    it('should handle non-contextIsolated environment', async () => {
      Object.defineProperty(process, 'contextIsolated', { value: false })

      await loadPreload()

      // Should still complete initialization without contextBridge calls
      expect(mockElectronStore).toHaveBeenCalled()
      // Should not call contextBridge.exposeInMainWorld
      expect(mockContextBridge.exposeInMainWorld).not.toHaveBeenCalled()
      // Should set window.electron instead
      expect(global.window.electron).toBe(mockElectronAPI)
    })

    it('should complete initialization even with partial failures', async () => {
      // Ensure we're in contextIsolated mode for this test
      Object.defineProperty(process, 'contextIsolated', { value: true })
      
      // Mock some functions to fail
      mockKickAPI.getSelfInfo.mockRejectedValue(new Error('Auth failed'))
      mockIpcRenderer.invoke.mockRejectedValue(new Error('Settings sync failed'))

      await loadPreload()

      // Should still expose APIs despite initialization errors
      expect(mockElectronStore).toHaveBeenCalled()
      expect(mockContextBridge.exposeInMainWorld).toHaveBeenCalled()
    })

    it('should handle localStorage errors gracefully', async () => {
      // Ensure we're in contextIsolated mode for this test
      Object.defineProperty(process, 'contextIsolated', { value: true })
      
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })

      await loadPreload()

      // Should not crash on localStorage errors
      expect(mockElectronStore).toHaveBeenCalled()
      expect(mockContextBridge.exposeInMainWorld).toHaveBeenCalled()
    })
  })
})