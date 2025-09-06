import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createContext, useContext } from 'react'
import SettingsProvider, { useSettings } from './SettingsProvider.jsx'
import { applyTheme } from '@utils/themeUtils'
import { DEFAULT_CHAT_HISTORY_LENGTH } from '@utils/constants'

// Mock external dependencies
vi.mock('@utils/themeUtils', () => ({
  applyTheme: vi.fn()
}))

vi.mock('@utils/constants', () => ({
  DEFAULT_CHAT_HISTORY_LENGTH: 400
}))

// Test component that consumes the SettingsProvider
const TestConsumer = ({ onSettingsReceived, onUpdateSettings, onThemeChange }) => {
  const { settings, updateSettings, handleThemeChange } = useSettings()
  
  // Call the callback when component mounts to provide access to context values
  onSettingsReceived?.(settings)
  
  return (
    <div>
      <div data-testid="settings-display">
        {JSON.stringify(settings)}
      </div>
      <button 
        data-testid="update-setting-btn" 
        onClick={() => onUpdateSettings?.(updateSettings)}
      >
        Update Setting
      </button>
      <button 
        data-testid="change-theme-btn" 
        onClick={() => onThemeChange?.(handleThemeChange)}
      >
        Change Theme
      </button>
    </div>
  )
}

// Test component that verifies the provider throws error when used outside provider
const TestConsumerOutsideProvider = () => {
  try {
    useSettings()
    return <div data-testid="no-error">No error</div>
  } catch (error) {
    return <div data-testid="error-message">{error.message}</div>
  }
}

describe('SettingsProvider', () => {
  let mockElectronStore
  let mockCleanupFunction
  
  beforeEach(() => {
    vi.useRealTimers() // Use real timers for async operations
    
    // Create mock cleanup function
    mockCleanupFunction = vi.fn()
    
    // Mock Electron store APIs
    mockElectronStore = {
      get: vi.fn(),
      set: vi.fn(),
      onUpdate: vi.fn(() => mockCleanupFunction)
    }
    
    // Mock window.app.store
    global.window = {
      ...global.window,
      app: {
        store: mockElectronStore
      }
    }
    
    // Clear all mocks before each test
    vi.clearAllMocks()
  })
  
  afterEach(() => {
    vi.clearAllMocks()
    delete global.window
  })

  describe('Provider Initialization', () => {
    it('should render children without crashing', () => {
      mockElectronStore.get.mockResolvedValue({})
      
      render(
        <SettingsProvider>
          <div data-testid="child">Test Child</div>
        </SettingsProvider>
      )
      
      expect(screen.getByTestId('child')).toBeInTheDocument()
    })

    it('should initialize with empty settings object', () => {
      mockElectronStore.get.mockResolvedValue({})
      let capturedSettings = null
      
      render(
        <SettingsProvider>
          <TestConsumer onSettingsReceived={(settings) => { capturedSettings = settings }} />
        </SettingsProvider>
      )
      
      expect(capturedSettings).toEqual({})
    })

    it('should load settings from Electron store on mount', async () => {
      const mockSettings = {
        customTheme: { current: 'dark' },
        someOtherSetting: 'value'
      }
      mockElectronStore.get.mockResolvedValue(mockSettings)
      
      let capturedSettings = null
      
      render(
        <SettingsProvider>
          <TestConsumer onSettingsReceived={(settings) => { capturedSettings = settings }} />
        </SettingsProvider>
      )
      
      await waitFor(() => {
        expect(mockElectronStore.get).toHaveBeenCalledOnce()
      })
      
      await waitFor(() => {
        expect(capturedSettings).toEqual({
          ...mockSettings,
          chatHistory: {
            chatHistoryLength: DEFAULT_CHAT_HISTORY_LENGTH,
            ...mockSettings.chatHistory
          }
        })
      })
    })

    it('should apply default chat history settings when not present', async () => {
      const mockSettings = { customTheme: { current: 'light' } }
      mockElectronStore.get.mockResolvedValue(mockSettings)
      
      let capturedSettings = null
      
      render(
        <SettingsProvider>
          <TestConsumer onSettingsReceived={(settings) => { capturedSettings = settings }} />
        </SettingsProvider>
      )
      
      await waitFor(() => {
        expect(capturedSettings?.chatHistory?.chatHistoryLength).toBe(DEFAULT_CHAT_HISTORY_LENGTH)
      })
    })

    it('should preserve existing chat history settings when present', async () => {
      const existingChatHistory = { chatHistoryLength: 500, someOtherChatSetting: true }
      const mockSettings = { 
        customTheme: { current: 'light' },
        chatHistory: existingChatHistory
      }
      mockElectronStore.get.mockResolvedValue(mockSettings)
      
      let capturedSettings = null
      
      render(
        <SettingsProvider>
          <TestConsumer onSettingsReceived={(settings) => { capturedSettings = settings }} />
        </SettingsProvider>
      )
      
      await waitFor(() => {
        expect(capturedSettings?.chatHistory).toEqual({
          chatHistoryLength: DEFAULT_CHAT_HISTORY_LENGTH,
          ...existingChatHistory
        })
      })
    })

    it('should apply theme on mount when customTheme is present', async () => {
      const mockTheme = { current: 'dark' }
      const mockSettings = { customTheme: mockTheme }
      mockElectronStore.get.mockResolvedValue(mockSettings)
      
      render(
        <SettingsProvider>
          <TestConsumer />
        </SettingsProvider>
      )
      
      await waitFor(() => {
        expect(applyTheme).toHaveBeenCalledWith(mockTheme)
      })
    })

    it('should not apply theme on mount when customTheme is not present', async () => {
      mockElectronStore.get.mockResolvedValue({})
      
      render(
        <SettingsProvider>
          <TestConsumer />
        </SettingsProvider>
      )
      
      await waitFor(() => {
        expect(mockElectronStore.get).toHaveBeenCalled()
      })
      
      expect(applyTheme).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle Electron store get error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockElectronStore.get.mockRejectedValue(new Error('Store error'))
      
      let capturedSettings = null
      
      render(
        <SettingsProvider>
          <TestConsumer onSettingsReceived={(settings) => { capturedSettings = settings }} />
        </SettingsProvider>
      )
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          '[SettingsProvider]: Error loading settings:',
          expect.any(Error)
        )
      })
      
      // Settings should remain as initial empty object
      expect(capturedSettings).toEqual({})
      
      consoleSpy.mockRestore()
    })

    it('should handle updateSettings error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockElectronStore.get.mockResolvedValue({})
      mockElectronStore.set.mockRejectedValue(new Error('Set error'))
      
      let updateSettingsFunction = null
      
      render(
        <SettingsProvider>
          <TestConsumer onUpdateSettings={(fn) => { updateSettingsFunction = fn }} />
        </SettingsProvider>
      )
      
      await waitFor(() => {
        expect(updateSettingsFunction).toBeTruthy()
      })
      
      await act(async () => {
        await updateSettingsFunction('testKey', 'testValue')
      })
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error updating setting testKey:',
        expect.any(Error)
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('Settings Updates', () => {
    it('should update settings locally and persist to Electron store', async () => {
      mockElectronStore.get.mockResolvedValue({})
      
      let updateSettingsFunction = null
      let capturedSettings = null
      
      render(
        <SettingsProvider>
          <TestConsumer 
            onSettingsReceived={(settings) => { capturedSettings = settings }}
            onUpdateSettings={(fn) => { updateSettingsFunction = fn }}
          />
        </SettingsProvider>
      )
      
      await waitFor(() => {
        expect(updateSettingsFunction).toBeTruthy()
      })
      
      await act(async () => {
        await updateSettingsFunction('testKey', 'testValue')
      })
      
      expect(mockElectronStore.set).toHaveBeenCalledWith('testKey', 'testValue')
      
      await waitFor(() => {
        expect(capturedSettings).toEqual(
          expect.objectContaining({ testKey: 'testValue' })
        )
      })
    })

    it('should apply theme when updating customTheme setting', async () => {
      mockElectronStore.get.mockResolvedValue({})
      
      let updateSettingsFunction = null
      
      render(
        <SettingsProvider>
          <TestConsumer onUpdateSettings={(fn) => { updateSettingsFunction = fn }} />
        </SettingsProvider>
      )
      
      await waitFor(() => {
        expect(updateSettingsFunction).toBeTruthy()
      })
      
      const newTheme = { current: 'dark' }
      
      await act(async () => {
        await updateSettingsFunction('customTheme', newTheme)
      })
      
      expect(applyTheme).toHaveBeenCalledWith(newTheme)
    })

    it('should not apply theme when updating customTheme without current property', async () => {
      mockElectronStore.get.mockResolvedValue({})
      
      let updateSettingsFunction = null
      
      render(
        <SettingsProvider>
          <TestConsumer onUpdateSettings={(fn) => { updateSettingsFunction = fn }} />
        </SettingsProvider>
      )
      
      await waitFor(() => {
        expect(updateSettingsFunction).toBeTruthy()
      })
      
      // Clear any previous applyTheme calls
      vi.clearAllMocks()
      
      await act(async () => {
        await updateSettingsFunction('customTheme', { someOtherProperty: 'value' })
      })
      
      expect(applyTheme).not.toHaveBeenCalled()
    })
  })

  describe('Theme Handling', () => {
    it('should handle theme changes through handleThemeChange', async () => {
      mockElectronStore.get.mockResolvedValue({})
      
      let handleThemeChangeFunction = null
      let capturedSettings = null
      
      render(
        <SettingsProvider>
          <TestConsumer 
            onSettingsReceived={(settings) => { capturedSettings = settings }}
            onThemeChange={(fn) => { handleThemeChangeFunction = fn }}
          />
        </SettingsProvider>
      )
      
      await waitFor(() => {
        expect(handleThemeChangeFunction).toBeTruthy()
      })
      
      await act(async () => {
        await handleThemeChangeFunction('dark')
      })
      
      const expectedThemeData = { current: 'dark' }
      
      expect(mockElectronStore.set).toHaveBeenCalledWith('customTheme', expectedThemeData)
      expect(applyTheme).toHaveBeenCalledWith(expectedThemeData)
      
      await waitFor(() => {
        expect(capturedSettings).toEqual(
          expect.objectContaining({ 
            customTheme: expectedThemeData 
          })
        )
      })
    })
  })

  describe('Store Updates Subscription', () => {
    it('should register for store updates on mount', async () => {
      mockElectronStore.get.mockResolvedValue({})
      
      render(
        <SettingsProvider>
          <TestConsumer />
        </SettingsProvider>
      )
      
      await waitFor(() => {
        expect(mockElectronStore.onUpdate).toHaveBeenCalledWith(expect.any(Function))
      })
    })

    it('should handle store update callbacks for simple values', async () => {
      mockElectronStore.get.mockResolvedValue({ existingKey: 'existingValue' })
      let updateCallback = null
      mockElectronStore.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupFunction
      })
      
      let capturedSettings = null
      
      render(
        <SettingsProvider>
          <TestConsumer onSettingsReceived={(settings) => { capturedSettings = settings }} />
        </SettingsProvider>
      )
      
      await waitFor(() => {
        expect(updateCallback).toBeTruthy()
      })
      
      act(() => {
        updateCallback({ newKey: 'newValue', anotherKey: 42 })
      })
      
      await waitFor(() => {
        expect(capturedSettings).toEqual(
          expect.objectContaining({
            existingKey: 'existingValue',
            newKey: 'newValue',
            anotherKey: 42
          })
        )
      })
    })

    it('should handle store update callbacks for object values by merging', async () => {
      mockElectronStore.get.mockResolvedValue({ 
        existingObject: { prop1: 'value1', prop2: 'value2' }
      })
      let updateCallback = null
      mockElectronStore.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupFunction
      })
      
      let capturedSettings = null
      
      render(
        <SettingsProvider>
          <TestConsumer onSettingsReceived={(settings) => { capturedSettings = settings }} />
        </SettingsProvider>
      )
      
      await waitFor(() => {
        expect(updateCallback).toBeTruthy()
      })
      
      act(() => {
        updateCallback({ 
          existingObject: { prop2: 'updatedValue2', prop3: 'value3' }
        })
      })
      
      await waitFor(() => {
        expect(capturedSettings?.existingObject).toEqual({
          prop1: 'value1',
          prop2: 'updatedValue2',
          prop3: 'value3'
        })
      })
    })

    it('should apply theme when store update contains customTheme', async () => {
      mockElectronStore.get.mockResolvedValue({})
      let updateCallback = null
      mockElectronStore.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupFunction
      })
      
      render(
        <SettingsProvider>
          <TestConsumer />
        </SettingsProvider>
      )
      
      await waitFor(() => {
        expect(updateCallback).toBeTruthy()
      })
      
      // Clear any previous applyTheme calls from initialization
      vi.clearAllMocks()
      
      const newTheme = { current: 'light' }
      
      act(() => {
        updateCallback({ customTheme: newTheme })
      })
      
      expect(applyTheme).toHaveBeenCalledWith(newTheme)
    })

    it('should not apply theme when store update customTheme lacks current property', async () => {
      mockElectronStore.get.mockResolvedValue({})
      let updateCallback = null
      mockElectronStore.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupFunction
      })
      
      render(
        <SettingsProvider>
          <TestConsumer />
        </SettingsProvider>
      )
      
      await waitFor(() => {
        expect(updateCallback).toBeTruthy()
      })
      
      // Clear any previous applyTheme calls
      vi.clearAllMocks()
      
      act(() => {
        updateCallback({ customTheme: { someOtherProperty: 'value' } })
      })
      
      expect(applyTheme).not.toHaveBeenCalled()
    })

    it('should handle null object values in store updates', async () => {
      mockElectronStore.get.mockResolvedValue({ existingKey: 'value' })
      let updateCallback = null
      mockElectronStore.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupFunction
      })
      
      let capturedSettings = null
      
      render(
        <SettingsProvider>
          <TestConsumer onSettingsReceived={(settings) => { capturedSettings = settings }} />
        </SettingsProvider>
      )
      
      await waitFor(() => {
        expect(updateCallback).toBeTruthy()
      })
      
      act(() => {
        updateCallback({ nullKey: null })
      })
      
      await waitFor(() => {
        expect(capturedSettings).toEqual(
          expect.objectContaining({
            existingKey: 'value',
            nullKey: null
          })
        )
      })
    })
  })

  describe('Component Cleanup', () => {
    it('should cleanup store subscription on unmount', async () => {
      mockElectronStore.get.mockResolvedValue({})
      
      const { unmount } = render(
        <SettingsProvider>
          <TestConsumer />
        </SettingsProvider>
      )
      
      await waitFor(() => {
        expect(mockElectronStore.onUpdate).toHaveBeenCalled()
      })
      
      unmount()
      
      expect(mockCleanupFunction).toHaveBeenCalledOnce()
    })
  })

  describe('Context Hook', () => {
    it('should provide settings, updateSettings, and handleThemeChange in context', async () => {
      mockElectronStore.get.mockResolvedValue({ testSetting: 'testValue' })
      
      let contextValue = null
      
      const ContextConsumer = () => {
        contextValue = useSettings()
        return null
      }
      
      render(
        <SettingsProvider>
          <ContextConsumer />
        </SettingsProvider>
      )
      
      await waitFor(() => {
        expect(contextValue).toBeTruthy()
        expect(contextValue).toHaveProperty('settings')
        expect(contextValue).toHaveProperty('updateSettings')
        expect(contextValue).toHaveProperty('handleThemeChange')
        expect(typeof contextValue.updateSettings).toBe('function')
        expect(typeof contextValue.handleThemeChange).toBe('function')
      })
    })

    it('should throw error when useSettings is used outside of provider', () => {
      expect(() => {
        render(<TestConsumerOutsideProvider />)
      }).toThrow('useSettings must be used within a SettingsProvider')
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle complete workflow: load → update → store update', async () => {
      const initialSettings = { initialKey: 'initialValue' }
      mockElectronStore.get.mockResolvedValue(initialSettings)
      
      let updateCallback = null
      mockElectronStore.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupFunction
      })
      
      let capturedSettings = null
      let updateSettingsFunction = null
      
      render(
        <SettingsProvider>
          <TestConsumer 
            onSettingsReceived={(settings) => { capturedSettings = settings }}
            onUpdateSettings={(fn) => { updateSettingsFunction = fn }}
          />
        </SettingsProvider>
      )
      
      // Wait for initial load
      await waitFor(() => {
        expect(capturedSettings).toEqual(
          expect.objectContaining({
            initialKey: 'initialValue'
          })
        )
      })
      
      // Update setting programmatically
      await act(async () => {
        await updateSettingsFunction('programmaticKey', 'programmaticValue')
      })
      
      // Simulate external store update
      act(() => {
        updateCallback({ externalKey: 'externalValue' })
      })
      
      await waitFor(() => {
        expect(capturedSettings).toEqual(
          expect.objectContaining({
            initialKey: 'initialValue',
            programmaticKey: 'programmaticValue',
            externalKey: 'externalValue',
            chatHistory: expect.objectContaining({
              chatHistoryLength: DEFAULT_CHAT_HISTORY_LENGTH
            })
          })
        )
      })
    })

    it('should handle multiple theme changes correctly', async () => {
      mockElectronStore.get.mockResolvedValue({})
      
      let handleThemeChangeFunction = null
      
      render(
        <SettingsProvider>
          <TestConsumer onThemeChange={(fn) => { handleThemeChangeFunction = fn }} />
        </SettingsProvider>
      )
      
      await waitFor(() => {
        expect(handleThemeChangeFunction).toBeTruthy()
      })
      
      // First theme change
      await act(async () => {
        await handleThemeChangeFunction('dark')
      })
      
      expect(applyTheme).toHaveBeenCalledWith({ current: 'dark' })
      expect(mockElectronStore.set).toHaveBeenCalledWith('customTheme', { current: 'dark' })
      
      // Second theme change
      await act(async () => {
        await handleThemeChangeFunction('light')
      })
      
      expect(applyTheme).toHaveBeenCalledWith({ current: 'light' })
      expect(mockElectronStore.set).toHaveBeenCalledWith('customTheme', { current: 'light' })
      
      expect(applyTheme).toHaveBeenCalledTimes(2)
      expect(mockElectronStore.set).toHaveBeenCalledTimes(2)
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined settings from store', async () => {
      mockElectronStore.get.mockResolvedValue(undefined)
      
      let capturedSettings = null
      
      render(
        <SettingsProvider>
          <TestConsumer onSettingsReceived={(settings) => { capturedSettings = settings }} />
        </SettingsProvider>
      )
      
      await waitFor(() => {
        expect(capturedSettings).toEqual({
          chatHistory: {
            chatHistoryLength: DEFAULT_CHAT_HISTORY_LENGTH
          }
        })
      })
    })

    it('should handle empty object from store updates', async () => {
      mockElectronStore.get.mockResolvedValue({ existing: 'value' })
      let updateCallback = null
      mockElectronStore.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupFunction
      })
      
      let capturedSettings = null
      
      render(
        <SettingsProvider>
          <TestConsumer onSettingsReceived={(settings) => { capturedSettings = settings }} />
        </SettingsProvider>
      )
      
      await waitFor(() => {
        expect(updateCallback).toBeTruthy()
      })
      
      act(() => {
        updateCallback({})
      })
      
      // Settings should remain unchanged
      await waitFor(() => {
        expect(capturedSettings).toEqual(
          expect.objectContaining({ existing: 'value' })
        )
      })
    })

    it('should handle complex nested object updates', async () => {
      mockElectronStore.get.mockResolvedValue({
        complex: {
          nested: {
            deep: { value: 'original' },
            other: 'stays'
          },
          sibling: 'unchanged'
        }
      })
      
      let updateCallback = null
      mockElectronStore.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupFunction
      })
      
      let capturedSettings = null
      
      render(
        <SettingsProvider>
          <TestConsumer onSettingsReceived={(settings) => { capturedSettings = settings }} />
        </SettingsProvider>
      )
      
      await waitFor(() => {
        expect(updateCallback).toBeTruthy()
      })
      
      act(() => {
        updateCallback({ 
          complex: {
            nested: {
              deep: { value: 'updated', newProp: 'added' }
            }
          }
        })
      })
      
      await waitFor(() => {
        expect(capturedSettings?.complex).toEqual({
          nested: {
            deep: { value: 'updated', newProp: 'added' },
            other: 'stays'
          },
          sibling: 'unchanged'
        })
      })
    })
  })
})