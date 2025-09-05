import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use vi.hoisted to create mocks that are available during module hoisting
const { 
  mockAutoUpdater,
  mockLog, 
  mockStore,
  mockIpcMain,
  mockMainWindow 
} = vi.hoisted(() => {
  const mockAutoUpdater = {
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

  const mockLog = {
    info: vi.fn(),
    error: vi.fn(),
    transports: {
      file: {
        level: 'debug'
      }
    }
  }

  const mockStore = {
    get: vi.fn(),
    set: vi.fn()
  }

  const mockIpcMain = {
    handle: vi.fn()
  }

  const mockMainWindow = {
    webContents: {
      send: vi.fn()
    }
  }

  return {
    mockAutoUpdater,
    mockLog,
    mockStore,
    mockIpcMain,
    mockMainWindow
  }
})

// Mock electron-updater
vi.mock('electron-updater', () => ({
  autoUpdater: mockAutoUpdater
}))

// Mock electron-log
vi.mock('electron-log', () => ({ default: mockLog }))

// Mock config store
vi.mock('../../../../utils/config', () => ({ default: mockStore }))

// Mock electron
vi.mock('electron', () => ({
  default: { ipcMain: mockIpcMain },
  ipcMain: mockIpcMain
}))

// Import after mocking
import { update } from '../update.js'

describe('update.js - Auto Updater Utilities', () => {
  let originalProcessEnv
  let originalConsole

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
    
    // Reset mock objects to their default state
    mockAutoUpdater.logger = null
    mockAutoUpdater.autoDownload = false
    mockAutoUpdater.autoInstallOnAppQuit = false
    mockAutoUpdater.disableWebInstaller = false
    mockAutoUpdater.disableDifferentialDownload = false
    mockAutoUpdater.allowDowngrade = true
    mockAutoUpdater.forceDevUpdateConfig = false
    
    // Store original environment
    originalProcessEnv = { ...process.env }
    
    // Mock console methods to suppress logs during testing
    originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error
    }
    console.log = vi.fn()
    console.warn = vi.fn()
    console.error = vi.fn()
  })

  afterEach(() => {
    // Restore environment
    process.env = originalProcessEnv
    
    // Restore console
    console.log = originalConsole.log
    console.warn = originalConsole.warn
    console.error = originalConsole.error
    
    vi.clearAllMocks()
  })

  describe('Environment-based Initialization', () => {
    it('should skip auto-updater in development mode', () => {
      process.env.NODE_ENV = 'development'
      
      update(mockMainWindow)
      
      expect(mockLog.info).toHaveBeenCalledWith('[Auto Updater]: Skipping auto-updater in development mode')
      expect(mockAutoUpdater.on).not.toHaveBeenCalled()
      expect(mockIpcMain.handle).not.toHaveBeenCalled()
    })

    it('should initialize auto-updater in production mode', () => {
      process.env.NODE_ENV = 'production'
      
      update(mockMainWindow)
      
      expect(mockLog.info).toHaveBeenCalledWith('[Auto Updater]: Initialized')
      expect(mockAutoUpdater.logger).toBe(mockLog)
      expect(mockAutoUpdater.logger.transports.file.level).toBe('info')
    })

    it('should initialize auto-updater when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV
      
      update(mockMainWindow)
      
      expect(mockLog.info).toHaveBeenCalledWith('[Auto Updater]: Initialized')
      expect(mockAutoUpdater.on).toHaveBeenCalled()
    })
  })

  describe('Auto Updater Configuration', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
    })

    it('should configure auto-updater with correct settings', () => {
      update(mockMainWindow)
      
      expect(mockAutoUpdater.autoDownload).toBe(true)
      expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(true)
      expect(mockAutoUpdater.disableWebInstaller).toBe(true)
      expect(mockAutoUpdater.disableDifferentialDownload).toBe(true)
      expect(mockAutoUpdater.allowDowngrade).toBe(false)
      expect(mockAutoUpdater.forceDevUpdateConfig).toBe(true)
    })

    it('should set up logger configuration', () => {
      update(mockMainWindow)
      
      expect(mockAutoUpdater.logger).toBe(mockLog)
      expect(mockAutoUpdater.logger.transports.file.level).toBe('info')
    })
  })

  describe('Event Handlers', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
      update(mockMainWindow)
    })

    it('should register all required event handlers', () => {
      const expectedEvents = [
        'checking-for-update',
        'update-available', 
        'update-not-available',
        'download-progress',
        'update-downloaded',
        'error'
      ]
      
      expectedEvents.forEach(event => {
        expect(mockAutoUpdater.on).toHaveBeenCalledWith(event, expect.any(Function))
      })
    })

    it('should handle checking-for-update event', () => {
      const handler = mockAutoUpdater.on.mock.calls.find(call => call[0] === 'checking-for-update')[1]
      
      handler()
      
      expect(mockLog.info).toHaveBeenCalledWith('[Auto Updater]: Checking for update...')
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
        'autoUpdater:status', 
        { event: 'checking' }
      )
    })

    it('should handle update-available event with info', () => {
      const handler = mockAutoUpdater.on.mock.calls.find(call => call[0] === 'update-available')[1]
      const updateInfo = {
        version: '1.2.0',
        releaseDate: '2023-10-01T10:00:00.000Z',
        files: [{ url: 'http://example.com/update.exe' }]
      }
      
      handler(updateInfo)
      
      expect(mockLog.info).toHaveBeenCalledWith('[Auto Updater]: Update available:', updateInfo)
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
        'autoUpdater:status',
        {
          event: 'available',
          version: updateInfo.version,
          releaseDate: updateInfo.releaseDate,
          files: updateInfo.files
        }
      )
    })

    it('should handle update-not-available event', () => {
      const handler = mockAutoUpdater.on.mock.calls.find(call => call[0] === 'update-not-available')[1]
      const updateInfo = {
        version: '1.1.0',
        releaseDate: '2023-09-01T10:00:00.000Z',
        files: []
      }
      
      handler(updateInfo)
      
      expect(mockLog.info).toHaveBeenCalledWith('[Auto Updater]: Update not available:', updateInfo)
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
        'autoUpdater:status',
        {
          event: 'not-available',
          version: updateInfo.version,
          releaseDate: updateInfo.releaseDate,
          files: updateInfo.files
        }
      )
    })

    it('should handle download-progress event', () => {
      const handler = mockAutoUpdater.on.mock.calls.find(call => call[0] === 'download-progress')[1]
      const progress = {
        percent: 50,
        bytesPerSecond: 1024000,
        transferred: 5000000,
        total: 10000000
      }
      
      handler(progress)
      
      expect(mockLog.info).toHaveBeenCalledWith('[Auto Updater]: Download progress: 50%')
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
        'autoUpdater:status',
        {
          event: 'downloading',
          percent: 50,
          bytesPerSecond: 1024000,
          transferred: 5000000,
          total: 10000000
        }
      )
    })

    it('should handle download-progress event with missing percent', () => {
      const handler = mockAutoUpdater.on.mock.calls.find(call => call[0] === 'download-progress')[1]
      const progress = {
        bytesPerSecond: 1024000,
        transferred: 5000000,
        total: 10000000
      }
      
      handler(progress)
      
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
        'autoUpdater:status',
        expect.objectContaining({
          event: 'downloading',
          percent: 0
        })
      )
    })

    it('should handle update-downloaded event', () => {
      const handler = mockAutoUpdater.on.mock.calls.find(call => call[0] === 'update-downloaded')[1]
      const updateInfo = {
        version: '1.2.0'
      }
      
      handler(updateInfo)
      
      expect(mockLog.info).toHaveBeenCalledWith('[Auto Updater]: Update downloaded')
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
        'autoUpdater:status',
        {
          event: 'ready',
          version: '1.2.0'
        }
      )
    })

    describe('Error Handler', () => {
      it('should handle download-related errors', () => {
        const handler = mockAutoUpdater.on.mock.calls.find(call => call[0] === 'error')[1]
        const downloadError = new Error('Download failed: Network error')
        
        handler(downloadError)
        
        expect(mockLog.error).toHaveBeenCalledWith('[Auto Updater]: Update error:', downloadError)
        expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
          'autoUpdater:status',
          {
            event: 'download-failed',
            error: 'Download failed: Network error'
          }
        )
      })

      it('should handle download-related errors with capital Download', () => {
        const handler = mockAutoUpdater.on.mock.calls.find(call => call[0] === 'error')[1]
        const downloadError = new Error('Update Download timeout')
        
        handler(downloadError)
        
        expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
          'autoUpdater:status',
          {
            event: 'download-failed',
            error: 'Update Download timeout'
          }
        )
      })

      it('should handle general errors', () => {
        const handler = mockAutoUpdater.on.mock.calls.find(call => call[0] === 'error')[1]
        const generalError = new Error('General update error')
        
        handler(generalError)
        
        expect(mockLog.error).toHaveBeenCalledWith('[Auto Updater]: Update error:', generalError)
        expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
          'autoUpdater:status',
          {
            event: 'error',
            error: 'General update error'
          }
        )
      })

      it('should handle errors without message property', () => {
        const handler = mockAutoUpdater.on.mock.calls.find(call => call[0] === 'error')[1]
        const errorWithoutMessage = { code: 'UPDATE_ERROR' }
        
        handler(errorWithoutMessage)
        
        expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
          'autoUpdater:status',
          {
            event: 'error',
            error: undefined
          }
        )
      })
    })
  })

  describe('IPC Handlers', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
      update(mockMainWindow)
    })

    it('should register all IPC handlers', () => {
      const expectedHandlers = [
        'autoUpdater:check',
        'autoUpdater:download',
        'autoUpdater:install',
        'autoUpdater:setEnabled'
      ]
      
      expectedHandlers.forEach(handler => {
        expect(mockIpcMain.handle).toHaveBeenCalledWith(handler, expect.any(Function))
      })
    })

    describe('autoUpdater:check handler', () => {
      let checkHandler

      beforeEach(() => {
        checkHandler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'autoUpdater:check')[1]
      })

      it('should successfully check for updates', async () => {
        mockAutoUpdater.checkForUpdates.mockResolvedValue()
        
        const result = await checkHandler()
        
        expect(mockLog.info).toHaveBeenCalledWith('[Auto Updater]: Checking for updates...')
        expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalled()
        expect(result).toEqual({ success: true })
      })

      it('should handle check for updates error', async () => {
        const error = new Error('Check failed')
        mockAutoUpdater.checkForUpdates.mockRejectedValue(error)
        
        const result = await checkHandler()
        
        expect(mockLog.error).toHaveBeenCalledWith('[Auto Updater]: Error checking for updates:', error)
        expect(result).toEqual({ 
          success: false, 
          error: 'Check failed' 
        })
      })
    })

    describe('autoUpdater:download handler', () => {
      let downloadHandler

      beforeEach(() => {
        downloadHandler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'autoUpdater:download')[1]
      })

      it('should successfully download update', async () => {
        mockAutoUpdater.downloadUpdate.mockResolvedValue()
        
        const result = await downloadHandler()
        
        expect(mockLog.info).toHaveBeenCalledWith('[Auto Updater]: Downloading update...')
        expect(mockAutoUpdater.downloadUpdate).toHaveBeenCalled()
        expect(result).toEqual({ success: true })
      })

      it('should handle download error', async () => {
        const error = new Error('Download failed')
        mockAutoUpdater.downloadUpdate.mockRejectedValue(error)
        
        const result = await downloadHandler()
        
        expect(mockLog.error).toHaveBeenCalledWith('[Auto Updater]: Error downloading update:', error)
        expect(result).toEqual({ 
          success: false, 
          error: 'Download failed' 
        })
      })
    })

    describe('autoUpdater:install handler', () => {
      let installHandler

      beforeEach(() => {
        vi.useFakeTimers()
        installHandler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'autoUpdater:install')[1]
      })

      afterEach(() => {
        vi.useRealTimers()
      })

      it('should install update using setImmediate', async () => {
        installHandler()
        
        expect(mockLog.info).toHaveBeenCalledWith('[Auto Updater]: Installing update and quitting...')
        
        // Run timers to execute setImmediate
        vi.runAllTimers()
        
        expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true)
      })
    })

    describe('autoUpdater:setEnabled handler', () => {
      let setEnabledHandler

      beforeEach(() => {
        setEnabledHandler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'autoUpdater:setEnabled')[1]
      })

      it('should enable auto-update setting', async () => {
        mockStore.set.mockReturnValue(true)
        
        const result = await setEnabledHandler({}, true)
        
        expect(mockStore.set).toHaveBeenCalledWith('general.autoUpdate', true)
        expect(mockLog.info).toHaveBeenCalledWith('[Auto Updater]: Auto-update enabled via settings')
        expect(result).toEqual({ success: true })
      })

      it('should disable auto-update setting', async () => {
        mockStore.set.mockReturnValue(true)
        
        const result = await setEnabledHandler({}, false)
        
        expect(mockStore.set).toHaveBeenCalledWith('general.autoUpdate', false)
        expect(mockLog.info).toHaveBeenCalledWith('[Auto Updater]: Auto-update disabled via settings')
        expect(result).toEqual({ success: true })
      })

      it('should handle setting error', async () => {
        const error = new Error('Store error')
        mockStore.set.mockImplementation(() => { throw error })
        
        const result = await setEnabledHandler({}, true)
        
        expect(mockLog.error).toHaveBeenCalledWith('[Auto Updater]: Error updating auto-update setting:', error)
        expect(result).toEqual({ 
          success: false, 
          error: 'Store error' 
        })
      })
    })
  })

  describe('Initial Update Check', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should perform initial update check when auto-update is enabled by default', async () => {
      mockStore.get.mockReturnValue(true)
      mockAutoUpdater.checkForUpdates.mockResolvedValue()
      
      update(mockMainWindow)
      
      // Fast-forward the timeout
      vi.runAllTimers()
      
      expect(mockStore.get).toHaveBeenCalledWith('general.autoUpdate', true)
      expect(mockLog.info).toHaveBeenCalledWith('[Auto Updater]: Performing initial update check...')
      expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalled()
    })

    it('should perform initial update check when setting returns undefined (default true)', async () => {
      // When store.get is called with a default value, it should return that default if the stored value is undefined
      mockStore.get.mockImplementation((key, defaultValue) => {
        if (key === 'general.autoUpdate') {
          return defaultValue // Return the default value (true)
        }
        return undefined
      })
      mockAutoUpdater.checkForUpdates.mockResolvedValue()
      
      update(mockMainWindow)
      
      // Fast-forward the timeout
      vi.runAllTimers()
      
      expect(mockStore.get).toHaveBeenCalledWith('general.autoUpdate', true)
      expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalled()
    })

    it('should skip initial update check when auto-update is disabled', async () => {
      mockStore.get.mockReturnValue(false)
      
      update(mockMainWindow)
      
      // Fast-forward the timeout
      vi.runAllTimers()
      
      expect(mockStore.get).toHaveBeenCalledWith('general.autoUpdate', true)
      expect(mockLog.info).toHaveBeenCalledWith('[Auto Updater]: Auto-update disabled in settings, skipping initial check')
      expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled()
    })

    it('should handle initial update check error gracefully', async () => {
      mockStore.get.mockReturnValue(true)
      const checkError = new Error('Initial check failed')
      mockAutoUpdater.checkForUpdates.mockRejectedValue(checkError)
      
      update(mockMainWindow)
      
      // Fast-forward the timeout and wait for promise to resolve
      vi.runAllTimers()
      
      // Wait for the catch handler to execute
      await new Promise(resolve => process.nextTick(resolve))
      
      expect(mockLog.error).toHaveBeenCalledWith('[Auto Updater]: Initial update check failed:', checkError)
      expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalled()
    })

    it('should schedule initial check', () => {
      mockStore.get.mockReturnValue(true)
      
      update(mockMainWindow)
      
      // The update function should complete without error
      // The actual timeout behavior is tested in other integration tests
      expect(mockLog.info).toHaveBeenCalledWith('[Auto Updater]: Initialized')
    })
  })

  describe('sendUpdateEvent Helper', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
      update(mockMainWindow)
    })

    it('should log and send update event to renderer', () => {
      const checkingHandler = mockAutoUpdater.on.mock.calls.find(call => call[0] === 'checking-for-update')[1]
      
      checkingHandler()
      
      expect(mockLog.info).toHaveBeenCalledWith('[Auto Updater]: Status - [object Object]')
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('autoUpdater:status', { event: 'checking' })
    })

    it('should handle complex status objects', () => {
      const availableHandler = mockAutoUpdater.on.mock.calls.find(call => call[0] === 'update-available')[1]
      const updateInfo = {
        version: '2.0.0',
        releaseDate: '2023-12-01T10:00:00.000Z',
        files: [{ url: 'http://example.com/v2.exe', size: 50000000 }]
      }
      
      availableHandler(updateInfo)
      
      const expectedStatus = {
        event: 'available',
        version: '2.0.0',
        releaseDate: '2023-12-01T10:00:00.000Z',
        files: [{ url: 'http://example.com/v2.exe', size: 50000000 }]
      }
      
      expect(mockLog.info).toHaveBeenCalledWith('[Auto Updater]: Status - [object Object]')
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('autoUpdater:status', expectedStatus)
    })
  })

  describe('Integration Tests', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should handle complete update flow', async () => {
      process.env.NODE_ENV = 'production'
      mockStore.get.mockReturnValue(true)
      mockAutoUpdater.checkForUpdates.mockResolvedValue()
      mockAutoUpdater.downloadUpdate.mockResolvedValue()
      
      update(mockMainWindow)
      
      // Get handlers
      const checkHandler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'autoUpdater:check')[1]
      const downloadHandler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'autoUpdater:download')[1]
      const installHandler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'autoUpdater:install')[1]
      
      // Test complete flow
      const checkResult = await checkHandler()
      expect(checkResult.success).toBe(true)
      
      const downloadResult = await downloadHandler()
      expect(downloadResult.success).toBe(true)
      
      installHandler()
      
      // Run timers to execute setImmediate
      vi.runAllTimers()
      
      expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true)
    })

    it('should handle multiple concurrent IPC calls', async () => {
      process.env.NODE_ENV = 'production'
      mockAutoUpdater.checkForUpdates.mockResolvedValue()
      
      update(mockMainWindow)
      
      const checkHandler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'autoUpdater:check')[1]
      
      // Make multiple concurrent calls
      const promises = [
        checkHandler(),
        checkHandler(),
        checkHandler()
      ]
      
      const results = await Promise.all(promises)
      
      results.forEach(result => {
        expect(result.success).toBe(true)
      })
      
      expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(3)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
    })

    it('should handle missing webContents.send gracefully', () => {
      const windowWithoutWebContents = {}
      
      expect(() => update(windowWithoutWebContents)).not.toThrow()
    })

    it('should handle null mainWindow', () => {
      expect(() => update(null)).not.toThrow()
      
      // Should still initialize in production
      expect(mockLog.info).toHaveBeenCalledWith('[Auto Updater]: Initialized')
    })

    it('should handle undefined mainWindow', () => {
      expect(() => update(undefined)).not.toThrow()
      
      // Should still initialize in production
      expect(mockLog.info).toHaveBeenCalledWith('[Auto Updater]: Initialized')
    })

    it('should handle store.get returning different data types', async () => {
      // Test with various falsy values
      const falsyValues = [
        { value: false, shouldCheck: false },
        { value: 0, shouldCheck: false },
        { value: '', shouldCheck: false },
        { value: null, shouldCheck: false },
        { value: undefined, shouldCheck: true }, // Should use default value (true)
        { value: NaN, shouldCheck: false } // NaN is falsy
      ]
      
      vi.useFakeTimers()
      
      for (const test of falsyValues) {
        vi.clearAllMocks()
        
        if (test.value === undefined) {
          // For undefined, mock to return default value
          mockStore.get.mockImplementation((key, defaultValue) => {
            if (key === 'general.autoUpdate') {
              return defaultValue // Return the default value (true)
            }
            return test.value
          })
        } else {
          mockStore.get.mockReturnValue(test.value)
        }
        
        update(mockMainWindow)
        
        // Fast-forward the timeout
        vi.runAllTimers()
        
        if (test.shouldCheck) {
          expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalled()
        } else {
          expect(mockLog.info).toHaveBeenCalledWith('[Auto Updater]: Auto-update disabled in settings, skipping initial check')
          expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled()
        }
      }
      
      vi.useRealTimers()
    })

    it('should handle autoUpdater configuration gracefully', () => {
      // This test verifies that the autoUpdater is configured with expected properties
      // In a production environment, these properties might fail to set but shouldn't crash the app
      
      // Test that configuration happens without throwing
      expect(() => update(mockMainWindow)).not.toThrow()
      
      // Verify that the configuration was attempted
      expect(mockAutoUpdater.autoDownload).toBe(true)
      expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(true)
      expect(mockAutoUpdater.disableWebInstaller).toBe(true)
      expect(mockAutoUpdater.disableDifferentialDownload).toBe(true)
      expect(mockAutoUpdater.allowDowngrade).toBe(false)
      expect(mockAutoUpdater.forceDevUpdateConfig).toBe(true)
    })
  })
})