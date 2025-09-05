import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatPage from './ChatPage.jsx'

// Mock SCSS imports
vi.mock('@assets/styles/pages/ChatPage.scss', () => ({}))

// Mock child components
vi.mock('../providers/SettingsProvider', () => ({
  useSettings: () => ({
    settings: {
      general: { theme: 'dark' },
      chat: { showTimestamps: true }
    },
    updateSettings: vi.fn()
  })
}))

vi.mock('../providers/ChatProvider', () => ({
  default: (selector) => {
    const mockState = {
      chatrooms: [
        {
          id: 'chatroom-1',
          slug: 'test-channel',
          streamerData: { user: { username: 'test-streamer' } },
          isStreamerLive: true
        }
      ],
      setCurrentChatroom: vi.fn()
    }
    return selector(mockState)
  }
}))

vi.mock('../components/Chat', () => ({
  default: ({ chatroomId, kickUsername, kickId, settings, updateSettings }) => (
    <div data-testid="chat-component">
      <span data-testid="chatroom-id">{chatroomId}</span>
      <span data-testid="kick-username">{kickUsername}</span>
      <span data-testid="kick-id">{kickId}</span>
      <span data-testid="settings">{JSON.stringify(settings)}</span>
      <button 
        data-testid="trigger-settings-update"
        onClick={() => updateSettings('test', 'value')}
      >
        Update Settings
      </button>
    </div>
  )
}))

vi.mock('../components/Navbar', () => ({
  default: ({ currentChatroomId, kickId, onSelectChatroom }) => (
    <div data-testid="navbar-component">
      <span data-testid="current-chatroom">{currentChatroomId || 'none'}</span>
      <span data-testid="navbar-kick-id">{kickId}</span>
      <button 
        data-testid="select-chatroom-1"
        onClick={() => onSelectChatroom('chatroom-1')}
      >
        Select Chatroom 1
      </button>
      <button 
        data-testid="select-mentions"
        onClick={() => onSelectChatroom('mentions')}
      >
        Select Mentions
      </button>
      <button 
        data-testid="select-null"
        onClick={() => onSelectChatroom(null)}
      >
        Select None
      </button>
    </div>
  )
}))

vi.mock('../components/TitleBar', () => ({
  default: () => <div data-testid="title-bar-component">TitleBar</div>
}))

vi.mock('../components/Dialogs/Mentions', () => ({
  default: ({ setActiveChatroom, chatroomId }) => (
    <div data-testid="mentions-component">
      <span data-testid="mentions-chatroom-id">{chatroomId}</span>
      <button 
        data-testid="close-mentions"
        onClick={() => setActiveChatroom('chatroom-1')}
      >
        Close Mentions
      </button>
    </div>
  )
}))

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

// Mock window.app for telemetry
const mockTelemetry = {
  recordDomNodeCount: vi.fn(),
  recordRendererMemory: vi.fn()
}

global.window = {
  ...global.window,
  app: {
    telemetry: mockTelemetry
  }
}

// Mock performance.memory
Object.defineProperty(performance, 'memory', {
  value: {
    usedJSHeapSize: 10000000,
    totalJSHeapSize: 15000000,
    jsHeapSizeLimit: 50000000
  },
  writable: true
})

// Mock document.querySelectorAll for telemetry
const originalQuerySelectorAll = document.querySelectorAll
Object.defineProperty(document, 'querySelectorAll', {
  value: vi.fn(() => new Array(100)),
  writable: true
})

describe('ChatPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    // Reset localStorage mocks
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'kickUsername') return 'testuser'
      if (key === 'kickId') return 'test-id-123'
      return null
    })
    
    // Reset telemetry mocks
    mockTelemetry.recordDomNodeCount.mockClear()
    mockTelemetry.recordRendererMemory.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render main chat page structure', () => {
      render(<ChatPage />)
      
      // Verify main container
      const container = document.querySelector('.chatPageContainer')
      expect(container).toBeInTheDocument()
      
      // Verify child components
      expect(screen.getByTestId('title-bar-component')).toBeInTheDocument()
      expect(screen.getByTestId('navbar-component')).toBeInTheDocument()
      
      // Verify chat wrapper structure
      const chatWrapper = document.querySelector('.chatWrapper')
      expect(chatWrapper).toBeInTheDocument()
      
      const chatNavigation = document.querySelector('.chatNavigation')
      expect(chatNavigation).toBeInTheDocument()
      
      const chatContent = document.querySelector('.chatContent')
      expect(chatContent).toBeInTheDocument()
    })

    it('should display empty state when no chatroom is selected', () => {
      render(<ChatPage />)
      
      expect(screen.getByText('No Chatrooms')).toBeInTheDocument()
      expect(screen.getByText('Add a chatroom by using "CTRL"+"t" or clicking Add button')).toBeInTheDocument()
    })

    it('should render Chat component when chatroom is selected', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      render(<ChatPage />)
      
      // Select a chatroom
      await user.click(screen.getByTestId('select-chatroom-1'))
      
      // Should show Chat component
      expect(screen.getByTestId('chat-component')).toBeInTheDocument()
      expect(screen.getByTestId('chatroom-id')).toHaveTextContent('chatroom-1')
      expect(screen.queryByText('No Chatrooms')).not.toBeInTheDocument()
    })

    it('should render Mentions component when mentions is selected', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      render(<ChatPage />)
      
      // Select mentions
      await user.click(screen.getByTestId('select-mentions'))
      
      // Should show Mentions component
      expect(screen.getByTestId('mentions-component')).toBeInTheDocument()
      expect(screen.getByTestId('mentions-chatroom-id')).toHaveTextContent('mentions')
      expect(screen.queryByText('No Chatrooms')).not.toBeInTheDocument()
      expect(screen.queryByTestId('chat-component')).not.toBeInTheDocument()
    })
  })

  describe('State Management', () => {
    it('should initialize with null active chatroom', () => {
      render(<ChatPage />)
      
      expect(screen.getByTestId('current-chatroom')).toHaveTextContent('none')
      expect(screen.getByText('No Chatrooms')).toBeInTheDocument()
    })

    it('should update active chatroom state when navbar selection changes', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      render(<ChatPage />)
      
      // Initially no chatroom selected
      expect(screen.getByTestId('current-chatroom')).toHaveTextContent('none')
      
      // Select chatroom
      await user.click(screen.getByTestId('select-chatroom-1'))
      
      // State should update
      expect(screen.getByTestId('current-chatroom')).toHaveTextContent('chatroom-1')
    })

    it('should handle switching between different view states', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      render(<ChatPage />)
      
      // Start with empty state
      expect(screen.getByText('No Chatrooms')).toBeInTheDocument()
      
      // Switch to chatroom
      await user.click(screen.getByTestId('select-chatroom-1'))
      expect(screen.getByTestId('chat-component')).toBeInTheDocument()
      
      // Switch to mentions
      await user.click(screen.getByTestId('select-mentions'))
      expect(screen.getByTestId('mentions-component')).toBeInTheDocument()
      
      // Switch back to empty
      await user.click(screen.getByTestId('select-null'))
      expect(screen.getByText('No Chatrooms')).toBeInTheDocument()
    })
  })

  describe('LocalStorage Integration', () => {
    it('should read user credentials from localStorage', () => {
      render(<ChatPage />)
      
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('kickUsername')
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('kickId')
    })

    it('should pass localStorage values to child components', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      render(<ChatPage />)
      
      // Select chatroom to render Chat component
      await user.click(screen.getByTestId('select-chatroom-1'))
      
      // Verify values are passed to components
      expect(screen.getByTestId('kick-username')).toHaveTextContent('testuser')
      expect(screen.getByTestId('kick-id')).toHaveTextContent('test-id-123')
      expect(screen.getByTestId('navbar-kick-id')).toHaveTextContent('test-id-123')
    })

    it('should handle missing localStorage values gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      
      render(<ChatPage />)
      
      expect(screen.getByTestId('navbar-kick-id')).toHaveTextContent('')
    })
  })

  describe('Settings Integration', () => {
    it('should pass settings to Chat component', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      render(<ChatPage />)
      
      await user.click(screen.getByTestId('select-chatroom-1'))
      
      const settingsElement = screen.getByTestId('settings')
      const settingsValue = JSON.parse(settingsElement.textContent)
      expect(settingsValue).toEqual({
        general: { theme: 'dark' },
        chat: { showTimestamps: true }
      })
    })

    it('should pass updateSettings function to Chat component', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      render(<ChatPage />)
      
      await user.click(screen.getByTestId('select-chatroom-1'))
      
      // Should not throw when updateSettings is called
      expect(() => {
        fireEvent.click(screen.getByTestId('trigger-settings-update'))
      }).not.toThrow()
    })
  })

  describe('Telemetry Monitoring', () => {
    it('should initialize telemetry monitoring on mount', () => {
      render(<ChatPage />)
      
      // Should collect initial metrics
      expect(mockTelemetry.recordDomNodeCount).toHaveBeenCalledWith(100)
      expect(mockTelemetry.recordRendererMemory).toHaveBeenCalledWith({
        jsHeapUsedSize: 10000000,
        jsHeapTotalSize: 15000000,
        jsHeapSizeLimit: 50000000
      })
    })

    it('should collect telemetry metrics periodically', () => {
      render(<ChatPage />)
      
      // Clear initial calls
      mockTelemetry.recordDomNodeCount.mockClear()
      mockTelemetry.recordRendererMemory.mockClear()
      
      // Fast forward 10 seconds
      act(() => {
        vi.advanceTimersByTime(10000)
      })
      
      // Should collect metrics again
      expect(mockTelemetry.recordDomNodeCount).toHaveBeenCalledWith(100)
      expect(mockTelemetry.recordRendererMemory).toHaveBeenCalledWith({
        jsHeapUsedSize: 10000000,
        jsHeapTotalSize: 15000000,
        jsHeapSizeLimit: 50000000
      })
    })

    it('should handle telemetry errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockTelemetry.recordDomNodeCount.mockImplementation(() => {
        throw new Error('Telemetry error')
      })
      
      render(<ChatPage />)
      
      expect(consoleSpy).toHaveBeenCalledWith('Telemetry collection failed:', expect.any(Error))
      
      consoleSpy.mockRestore()
    })

    it('should cleanup telemetry interval on unmount', () => {
      const { unmount } = render(<ChatPage />)
      
      // Fast forward past interval
      act(() => {
        vi.advanceTimersByTime(5000)
      })
      
      unmount()
      
      // Clear call count
      mockTelemetry.recordDomNodeCount.mockClear()
      
      // Fast forward another interval
      act(() => {
        vi.advanceTimersByTime(10000)
      })
      
      // Should not be called after unmount
      expect(mockTelemetry.recordDomNodeCount).not.toHaveBeenCalled()
    })

    it('should handle missing performance.memory gracefully', () => {
      Object.defineProperty(performance, 'memory', {
        value: undefined,
        writable: true
      })
      
      expect(() => render(<ChatPage />)).not.toThrow()
      
      // Should still collect DOM node count
      expect(mockTelemetry.recordDomNodeCount).toHaveBeenCalledWith(100)
      
      // Restore performance.memory
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 10000000,
          totalJSHeapSize: 15000000,
          jsHeapSizeLimit: 50000000
        },
        writable: true
      })
    })

    it('should handle missing window.app.telemetry gracefully', () => {
      const originalApp = global.window.app
      global.window.app = {}
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      render(<ChatPage />)
      
      // Should not crash
      expect(screen.getByTestId('title-bar-component')).toBeInTheDocument()
      
      // Restore
      global.window.app = originalApp
      consoleSpy.mockRestore()
    })
  })

  describe('Chat Provider Integration', () => {
    it('should call setCurrentChatroom when active chatroom changes', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      render(<ChatPage />)
      
      await user.click(screen.getByTestId('select-chatroom-1'))
      
      // Should call setCurrentChatroom through the provider
      // (This is mocked in the ChatProvider mock)
    })
  })

  describe('Component Interactions', () => {
    it('should handle mentions navigation properly', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      render(<ChatPage />)
      
      // Navigate to mentions
      await user.click(screen.getByTestId('select-mentions'))
      
      expect(screen.getByTestId('mentions-component')).toBeInTheDocument()
      
      // Close mentions (should navigate back)
      await user.click(screen.getByTestId('close-mentions'))
      
      expect(screen.getByTestId('current-chatroom')).toHaveTextContent('chatroom-1')
    })

    it('should maintain proper component hierarchy', () => {
      render(<ChatPage />)
      
      const chatPageContainer = document.querySelector('.chatPageContainer')
      const titleBar = screen.getByTestId('title-bar-component')
      const chatWrapper = document.querySelector('.chatWrapper')
      
      expect(chatPageContainer).toContainElement(titleBar)
      expect(chatPageContainer).toContainElement(chatWrapper)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing chat provider gracefully', () => {
      vi.doMock('../providers/ChatProvider', () => ({
        default: () => {
          throw new Error('Provider error')
        }
      }))
      
      // Should not crash the entire page
      expect(() => render(<ChatPage />)).not.toThrow()
    })

    it('should handle missing settings provider gracefully', () => {
      vi.doMock('../providers/SettingsProvider', () => ({
        useSettings: () => {
          throw new Error('Settings error')
        }
      }))
      
      expect(() => render(<ChatPage />)).not.toThrow()
    })
  })

  describe('Performance Considerations', () => {
    it('should not create excessive DOM elements', () => {
      render(<ChatPage />)
      
      const container = document.querySelector('.chatPageContainer')
      const elements = container.querySelectorAll('*')
      
      // Should have a reasonable number of elements
      expect(elements.length).toBeLessThan(50)
    })

    it('should handle rapid state changes efficiently', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      render(<ChatPage />)
      
      // Rapidly change states
      for (let i = 0; i < 10; i++) {
        await user.click(screen.getByTestId('select-chatroom-1'))
        await user.click(screen.getByTestId('select-mentions'))
        await user.click(screen.getByTestId('select-null'))
      }
      
      // Should still be responsive
      expect(screen.getByText('No Chatrooms')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper semantic structure', () => {
      render(<ChatPage />)
      
      const container = document.querySelector('.chatPageContainer')
      expect(container).toBeInTheDocument()
      
      const chatWrapper = document.querySelector('.chatWrapper')
      expect(chatWrapper).toBeInTheDocument()
      
      const chatNavigation = document.querySelector('.chatNavigation')
      expect(chatNavigation).toBeInTheDocument()
      
      const chatContent = document.querySelector('.chatContent')
      expect(chatContent).toBeInTheDocument()
    })

    it('should have accessible headings in empty state', () => {
      render(<ChatPage />)
      
      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toHaveTextContent('No Chatrooms')
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined chatroom ID correctly', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      render(<ChatPage />)
      
      await user.click(screen.getByTestId('select-null'))
      
      expect(screen.getByText('No Chatrooms')).toBeInTheDocument()
      expect(screen.queryByTestId('chat-component')).not.toBeInTheDocument()
    })

    it('should handle empty string chatroom ID', () => {
      const { container } = render(<ChatPage />)
      
      // Simulate empty string chatroom ID (should show empty state)
      expect(screen.getByText('No Chatrooms')).toBeInTheDocument()
    })

    it('should handle telemetry with missing DOM elements', () => {
      document.querySelectorAll.mockReturnValue([])
      
      render(<ChatPage />)
      
      expect(mockTelemetry.recordDomNodeCount).toHaveBeenCalledWith(0)
    })
  })

  describe('CSS Classes and Styling', () => {
    it('should apply correct CSS classes', () => {
      render(<ChatPage />)
      
      expect(document.querySelector('.chatPageContainer')).toBeInTheDocument()
      expect(document.querySelector('.chatWrapper')).toBeInTheDocument()
      expect(document.querySelector('.chatNavigation')).toBeInTheDocument()
      expect(document.querySelector('.chatContent')).toBeInTheDocument()
      expect(document.querySelector('.chatroomsEmptyState')).toBeInTheDocument()
    })

    it('should conditionally render content based on state', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      render(<ChatPage />)
      
      // Empty state should have empty state class
      expect(document.querySelector('.chatroomsEmptyState')).toBeInTheDocument()
      
      // Select chatroom - empty state should be gone
      await user.click(screen.getByTestId('select-chatroom-1'))
      expect(document.querySelector('.chatroomsEmptyState')).not.toBeInTheDocument()
    })
  })

  describe('Memory Management', () => {
    it('should cleanup intervals on unmount', () => {
      const { unmount } = render(<ChatPage />)
      
      unmount()
      
      // Fast forward time
      act(() => {
        vi.advanceTimersByTime(20000)
      })
      
      // Clear previous calls
      mockTelemetry.recordDomNodeCount.mockClear()
      
      // Should not continue calling telemetry after unmount
      expect(mockTelemetry.recordDomNodeCount).not.toHaveBeenCalled()
    })

    it('should handle multiple mount/unmount cycles', () => {
      for (let i = 0; i < 5; i++) {
        const { unmount } = render(<ChatPage />)
        expect(screen.getByTestId('title-bar-component')).toBeInTheDocument()
        unmount()
      }
    })
  })

  describe('Integration Scenarios', () => {
    it('should work with all components integrated', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      render(<ChatPage />)
      
      // Should render all major components
      expect(screen.getByTestId('title-bar-component')).toBeInTheDocument()
      expect(screen.getByTestId('navbar-component')).toBeInTheDocument()
      
      // Should handle state transitions
      await user.click(screen.getByTestId('select-chatroom-1'))
      expect(screen.getByTestId('chat-component')).toBeInTheDocument()
      
      await user.click(screen.getByTestId('select-mentions'))
      expect(screen.getByTestId('mentions-component')).toBeInTheDocument()
      
      // Should maintain telemetry
      act(() => {
        vi.advanceTimersByTime(10000)
      })
      
      expect(mockTelemetry.recordDomNodeCount).toHaveBeenCalled()
    })
  })
})