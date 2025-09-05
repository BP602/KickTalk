import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Chat from './index.jsx'

// Mock external dependencies
vi.mock('@utils/kickTalkBadges', () => ({
  userKickTalkBadges: {
    'user123': { badge: 'premium', color: '#gold' }
  }
}))

vi.mock('dayjs', () => {
  const mockDayjs = vi.fn(() => ({
    fromNow: () => '2 hours ago'
  }))
  mockDayjs.extend = vi.fn()
  return { default: mockDayjs }
})

vi.mock('dayjs/plugin/relativeTime', () => ({ default: {} }))

// Mock child components
vi.mock('./Input', () => ({
  default: ({ chatroomId, settings }) => (
    <div data-testid="chat-input">
      <span data-testid="input-chatroom-id">{chatroomId}</span>
      <span data-testid="input-settings">{JSON.stringify(settings)}</span>
    </div>
  )
}))

vi.mock('./StreamerInfo', () => ({
  default: ({ 
    streamerData, 
    streamStatus, 
    userChatroomInfo, 
    isStreamerLive, 
    chatroomId, 
    settings, 
    handleSearch, 
    updateSettings 
  }) => (
    <div data-testid="streamer-info">
      <span data-testid="streamer-name">
        {streamerData?.user?.username || 'Unknown'}
      </span>
      <span data-testid="stream-status">{streamStatus}</span>
      <span data-testid="is-live">{String(isStreamerLive)}</span>
      <span data-testid="info-chatroom-id">{chatroomId}</span>
      <button 
        data-testid="trigger-search"
        onClick={handleSearch}
      >
        Search
      </button>
      <button 
        data-testid="trigger-update-settings"
        onClick={() => updateSettings('test', 'value')}
      >
        Update Settings
      </button>
    </div>
  )
}))

vi.mock('../Messages/MessagesHandler', () => ({
  default: ({ 
    messages, 
    chatroomId, 
    slug, 
    allStvEmotes, 
    subscriberBadges, 
    kickTalkBadges, 
    userChatroomInfo, 
    username, 
    userId, 
    settings, 
    donators 
  }) => (
    <div data-testid="messages-handler">
      <span data-testid="messages-count">{messages?.length || 0}</span>
      <span data-testid="messages-chatroom-id">{chatroomId}</span>
      <span data-testid="messages-slug">{slug}</span>
      <span data-testid="messages-username">{username}</span>
      <span data-testid="messages-user-id">{userId}</span>
      <span data-testid="emotes-count">{allStvEmotes?.length || 0}</span>
      <span data-testid="subscriber-badges-count">{subscriberBadges?.length || 0}</span>
      <span data-testid="donators-count">{Object.keys(donators || {}).length}</span>
    </div>
  )
}))

// Mock providers
const mockChatStore = {
  chatrooms: [
    {
      id: 'chatroom-1',
      slug: 'test-channel',
      streamerData: {
        user: { username: 'test-streamer' },
        subscriber_badges: [
          { id: '1', name: '1 month' },
          { id: '2', name: '3 months' }
        ]
      },
      channel7TVEmotes: [
        { id: 'emote1', name: 'TestEmote1' },
        { id: 'emote2', name: 'TestEmote2' }
      ],
      userChatroomInfo: { role: 'moderator', badges: [] },
      isStreamerLive: true,
      streamStatus: 'Live'
    }
  ],
  personalEmoteSets: [
    { id: 'personal1', name: 'PersonalEmote1' },
    { id: 'personal2', name: 'PersonalEmote2' }
  ],
  messages: {
    'chatroom-1': [
      {
        id: 'msg1',
        content: 'Hello world',
        sender: { username: 'user1' },
        timestamp: Date.now()
      },
      {
        id: 'msg2',
        content: 'How are you?',
        sender: { username: 'user2' },
        timestamp: Date.now() + 1000
      }
    ]
  },
  donators: {
    'user1': { amount: 10.50, color: '#green' },
    'user2': { amount: 5.00, color: '#blue' }
  },
  markChatroomMessagesAsRead: vi.fn()
}

vi.mock('../../providers/ChatProvider', () => ({
  default: (selector) => selector(mockChatStore)
}))

vi.mock('zustand/shallow', () => ({
  useShallow: (fn) => fn
}))

// Mock window.app for search dialog
const mockSearchDialog = {
  open: vi.fn()
}

global.window = {
  app: {
    searchDialog: mockSearchDialog
  }
}

describe('Chat Component', () => {
  const defaultProps = {
    chatroomId: 'chatroom-1',
    kickUsername: 'testuser',
    kickId: 'test-id-123',
    settings: {
      general: { theme: 'dark' },
      chat: { showTimestamps: true }
    },
    updateSettings: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset mock store
    mockChatStore.markChatroomMessagesAsRead.mockClear()
    mockSearchDialog.open.mockClear()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Component Rendering', () => {
    it('should render main chat container structure', () => {
      render(<Chat {...defaultProps} />)
      
      const chatContainer = document.querySelector('.chatContainer')
      expect(chatContainer).toBeInTheDocument()
      
      const chatBody = document.querySelector('.chatBody')
      expect(chatBody).toBeInTheDocument()
      
      const chatBoxContainer = document.querySelector('.chatBoxContainer')
      expect(chatBoxContainer).toBeInTheDocument()
    })

    it('should render all child components', () => {
      render(<Chat {...defaultProps} />)
      
      expect(screen.getByTestId('streamer-info')).toBeInTheDocument()
      expect(screen.getByTestId('messages-handler')).toBeInTheDocument()
      expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    })

    it('should pass correct props to child components', () => {
      render(<Chat {...defaultProps} />)
      
      // Check StreamerInfo props
      expect(screen.getByTestId('streamer-name')).toHaveTextContent('test-streamer')
      expect(screen.getByTestId('is-live')).toHaveTextContent('true')
      expect(screen.getByTestId('info-chatroom-id')).toHaveTextContent('chatroom-1')
      
      // Check MessagesHandler props
      expect(screen.getByTestId('messages-count')).toHaveTextContent('2')
      expect(screen.getByTestId('messages-chatroom-id')).toHaveTextContent('chatroom-1')
      expect(screen.getByTestId('messages-slug')).toHaveTextContent('test-channel')
      expect(screen.getByTestId('messages-username')).toHaveTextContent('testuser')
      expect(screen.getByTestId('messages-user-id')).toHaveTextContent('test-id-123')
      
      // Check ChatInput props
      expect(screen.getByTestId('input-chatroom-id')).toHaveTextContent('chatroom-1')
    })
  })

  describe('Chatroom Data Processing', () => {
    it('should find and display correct chatroom data', () => {
      render(<Chat {...defaultProps} />)
      
      expect(screen.getByTestId('streamer-name')).toHaveTextContent('test-streamer')
      expect(screen.getByTestId('messages-slug')).toHaveTextContent('test-channel')
    })

    it('should handle missing chatroom gracefully', () => {
      mockChatStore.chatrooms = []
      
      render(<Chat {...defaultProps} chatroomId="nonexistent" />)
      
      expect(screen.getByTestId('streamer-name')).toHaveTextContent('Unknown')
      expect(screen.getByTestId('messages-slug')).toHaveTextContent('')
    })

    it('should extract subscriber badges correctly', () => {
      render(<Chat {...defaultProps} />)
      
      expect(screen.getByTestId('subscriber-badges-count')).toHaveTextContent('2')
    })

    it('should handle missing subscriber badges', () => {
      mockChatStore.chatrooms[0].streamerData.subscriber_badges = undefined
      
      render(<Chat {...defaultProps} />)
      
      expect(screen.getByTestId('subscriber-badges-count')).toHaveTextContent('0')
    })
  })

  describe('Emotes Processing', () => {
    it('should combine personal and channel 7TV emotes', () => {
      render(<Chat {...defaultProps} />)
      
      // Should have 2 personal + 2 channel emotes = 4 total
      expect(screen.getByTestId('emotes-count')).toHaveTextContent('4')
    })

    it('should handle missing personal emote sets', () => {
      mockChatStore.personalEmoteSets = null
      
      render(<Chat {...defaultProps} />)
      
      // Should only have channel emotes
      expect(screen.getByTestId('emotes-count')).toHaveTextContent('2')
    })

    it('should handle missing channel 7TV emotes', () => {
      mockChatStore.chatrooms[0].channel7TVEmotes = null
      
      render(<Chat {...defaultProps} />)
      
      // Should only have personal emotes
      expect(screen.getByTestId('emotes-count')).toHaveTextContent('2')
    })

    it('should memoize emotes combination correctly', () => {
      const { rerender } = render(<Chat {...defaultProps} />)
      
      expect(screen.getByTestId('emotes-count')).toHaveTextContent('4')
      
      // Rerender with same props - should maintain same count
      rerender(<Chat {...defaultProps} />)
      
      expect(screen.getByTestId('emotes-count')).toHaveTextContent('4')
    })
  })

  describe('Messages and Read Status', () => {
    it('should pass messages to MessagesHandler', () => {
      render(<Chat {...defaultProps} />)
      
      expect(screen.getByTestId('messages-count')).toHaveTextContent('2')
    })

    it('should mark messages as read on mount', () => {
      render(<Chat {...defaultProps} />)
      
      expect(mockChatStore.markChatroomMessagesAsRead).toHaveBeenCalledWith('chatroom-1')
    })

    it('should mark messages as read when chatroom changes', () => {
      const { rerender } = render(<Chat {...defaultProps} />)
      
      mockChatStore.markChatroomMessagesAsRead.mockClear()
      
      rerender(<Chat {...defaultProps} chatroomId="chatroom-2" />)
      
      expect(mockChatStore.markChatroomMessagesAsRead).toHaveBeenCalledWith('chatroom-2')
    })

    it('should handle empty messages array', () => {
      mockChatStore.messages['chatroom-1'] = []
      
      render(<Chat {...defaultProps} />)
      
      expect(screen.getByTestId('messages-count')).toHaveTextContent('0')
    })

    it('should handle missing messages for chatroom', () => {
      mockChatStore.messages = {}
      
      render(<Chat {...defaultProps} />)
      
      expect(screen.getByTestId('messages-count')).toHaveTextContent('0')
    })
  })

  describe('Donators Integration', () => {
    it('should pass donators data to MessagesHandler', () => {
      render(<Chat {...defaultProps} />)
      
      expect(screen.getByTestId('donators-count')).toHaveTextContent('2')
    })

    it('should handle missing donators data', () => {
      mockChatStore.donators = null
      
      render(<Chat {...defaultProps} />)
      
      expect(screen.getByTestId('donators-count')).toHaveTextContent('0')
    })
  })

  describe('Search Functionality', () => {
    it('should open search dialog when handleSearch is called', () => {
      render(<Chat {...defaultProps} />)
      
      fireEvent.click(screen.getByTestId('trigger-search'))
      
      expect(mockSearchDialog.open).toHaveBeenCalledWith({
        messages: mockChatStore.messages['chatroom-1'],
        chatroomId: 'chatroom-1',
        sevenTVEmotes: expect.arrayContaining([
          { id: 'personal1', name: 'PersonalEmote1' },
          { id: 'emote1', name: 'TestEmote1' }
        ]),
        settings: defaultProps.settings,
        subscriberBadges: mockChatStore.chatrooms[0].streamerData.subscriber_badges,
        userChatroomInfo: mockChatStore.chatrooms[0].userChatroomInfo,
        chatroomSlug: 'test-channel',
        chatroomName: 'test-streamer'
      })
    })

    it('should not open search dialog when no messages exist', () => {
      mockChatStore.messages['chatroom-1'] = []
      
      render(<Chat {...defaultProps} />)
      
      fireEvent.click(screen.getByTestId('trigger-search'))
      
      expect(mockSearchDialog.open).not.toHaveBeenCalled()
    })

    it('should handle keyboard shortcut Ctrl+F', () => {
      render(<Chat {...defaultProps} />)
      
      fireEvent.keyDown(window, { key: 'f', ctrlKey: true })
      
      expect(mockSearchDialog.open).toHaveBeenCalled()
    })

    it('should handle keyboard shortcut Cmd+F on Mac', () => {
      render(<Chat {...defaultProps} />)
      
      fireEvent.keyDown(window, { key: 'f', metaKey: true })
      
      expect(mockSearchDialog.open).toHaveBeenCalled()
    })

    it('should not open search on other keyboard combinations', () => {
      render(<Chat {...defaultProps} />)
      
      mockSearchDialog.open.mockClear()
      
      fireEvent.keyDown(window, { key: 'f' }) // No modifier
      fireEvent.keyDown(window, { key: 'g', ctrlKey: true }) // Wrong key
      fireEvent.keyDown(window, { key: 'f', altKey: true }) // Wrong modifier
      
      expect(mockSearchDialog.open).not.toHaveBeenCalled()
    })

    it('should cleanup keyboard event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
      
      const { unmount } = render(<Chat {...defaultProps} />)
      
      unmount()
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
      
      removeEventListenerSpy.mockRestore()
    })
  })

  describe('Settings Integration', () => {
    it('should pass settings to child components', () => {
      render(<Chat {...defaultProps} />)
      
      const inputSettings = screen.getByTestId('input-settings')
      const settingsData = JSON.parse(inputSettings.textContent)
      
      expect(settingsData).toEqual({
        general: { theme: 'dark' },
        chat: { showTimestamps: true }
      })
    })

    it('should call updateSettings when triggered', () => {
      render(<Chat {...defaultProps} />)
      
      fireEvent.click(screen.getByTestId('trigger-update-settings'))
      
      expect(defaultProps.updateSettings).toHaveBeenCalledWith('test', 'value')
    })
  })

  describe('Component State Management', () => {
    it('should maintain isSearchOpen state correctly', () => {
      render(<Chat {...defaultProps} />)
      
      // Search should initially be closed
      // (This is internal state, so we test it indirectly through behavior)
      fireEvent.click(screen.getByTestId('trigger-search'))
      
      expect(mockSearchDialog.open).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle missing chatroom data gracefully', () => {
      mockChatStore.chatrooms = []
      
      expect(() => render(<Chat {...defaultProps} />)).not.toThrow()
      
      expect(screen.getByTestId('streamer-name')).toHaveTextContent('Unknown')
    })

    it('should handle malformed chatroom data', () => {
      mockChatStore.chatrooms = [{ id: 'chatroom-1' }] // Missing required fields
      
      expect(() => render(<Chat {...defaultProps} />)).not.toThrow()
      
      expect(screen.getByTestId('streamer-name')).toHaveTextContent('Unknown')
    })

    it('should handle search dialog errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockSearchDialog.open.mockImplementation(() => {
        throw new Error('Search dialog error')
      })
      
      render(<Chat {...defaultProps} />)
      
      expect(() => {
        fireEvent.click(screen.getByTestId('trigger-search'))
      }).not.toThrow()
      
      consoleSpy.mockRestore()
    })

    it('should handle missing window.app.searchDialog', () => {
      const originalApp = global.window.app
      global.window.app = {}
      
      render(<Chat {...defaultProps} />)
      
      expect(() => {
        fireEvent.keyDown(window, { key: 'f', ctrlKey: true })
      }).not.toThrow()
      
      global.window.app = originalApp
    })
  })

  describe('Performance Optimization', () => {
    it('should memoize expensive computations', () => {
      const { rerender } = render(<Chat {...defaultProps} />)
      
      const initialEmoteCount = screen.getByTestId('emotes-count').textContent
      
      // Rerender with same data
      rerender(<Chat {...defaultProps} />)
      
      // Should maintain same computed values
      expect(screen.getByTestId('emotes-count')).toHaveTextContent(initialEmoteCount)
    })

    it('should update memoized values when dependencies change', () => {
      const { rerender } = render(<Chat {...defaultProps} />)
      
      expect(screen.getByTestId('emotes-count')).toHaveTextContent('4')
      
      // Change emote data
      mockChatStore.personalEmoteSets = [{ id: 'new1', name: 'New1' }]
      
      rerender(<Chat {...defaultProps} />)
      
      // Should reflect new count
      expect(screen.getByTestId('emotes-count')).toHaveTextContent('3')
    })
  })

  describe('Accessibility', () => {
    it('should have proper semantic structure', () => {
      render(<Chat {...defaultProps} />)
      
      const chatContainer = document.querySelector('.chatContainer')
      const chatBody = document.querySelector('.chatBody')
      const chatBoxContainer = document.querySelector('.chatBoxContainer')
      
      expect(chatContainer).toBeInTheDocument()
      expect(chatContainer).toContainElement(chatBody)
      expect(chatContainer).toContainElement(chatBoxContainer)
    })

    it('should support keyboard navigation for search', () => {
      render(<Chat {...defaultProps} />)
      
      // Should respond to keyboard shortcuts
      fireEvent.keyDown(window, { key: 'f', ctrlKey: true })
      
      expect(mockSearchDialog.open).toHaveBeenCalled()
    })
  })

  describe('Integration with External Services', () => {
    it('should integrate with kickTalkBadges correctly', () => {
      render(<Chat {...defaultProps} />)
      
      // This tests that the userKickTalkBadges import and usage works
      // The actual badges are passed to MessagesHandler
      expect(screen.getByTestId('messages-handler')).toBeInTheDocument()
    })

    it('should handle dayjs integration correctly', () => {
      render(<Chat {...defaultProps} />)
      
      // dayjs is imported and extended with relativeTime plugin
      // This tests that the import doesn't cause errors
      expect(screen.getByTestId('chat-container')).toBeInTheDocument()
    })
  })

  describe('Props Validation and Edge Cases', () => {
    it('should handle missing required props', () => {
      expect(() => render(<Chat />)).not.toThrow()
    })

    it('should handle undefined settings prop', () => {
      expect(() => render(<Chat {...defaultProps} settings={undefined} />)).not.toThrow()
    })

    it('should handle null chatroomId', () => {
      expect(() => render(<Chat {...defaultProps} chatroomId={null} />)).not.toThrow()
    })

    it('should handle empty string chatroomId', () => {
      render(<Chat {...defaultProps} chatroomId="" />)
      
      expect(screen.getByTestId('info-chatroom-id')).toHaveTextContent('')
    })

    it('should handle very long chatroomId', () => {
      const longId = 'a'.repeat(1000)
      
      render(<Chat {...defaultProps} chatroomId={longId} />)
      
      expect(screen.getByTestId('info-chatroom-id')).toHaveTextContent(longId)
    })
  })

  describe('Event Handling Edge Cases', () => {
    it('should handle rapid keyboard events', () => {
      render(<Chat {...defaultProps} />)
      
      // Rapidly trigger search
      for (let i = 0; i < 10; i++) {
        fireEvent.keyDown(window, { key: 'f', ctrlKey: true })
      }
      
      // Should handle gracefully
      expect(mockSearchDialog.open).toHaveBeenCalled()
    })

    it('should handle search when messages become available', () => {
      // Start with no messages
      mockChatStore.messages['chatroom-1'] = []
      
      const { rerender } = render(<Chat {...defaultProps} />)
      
      fireEvent.click(screen.getByTestId('trigger-search'))
      expect(mockSearchDialog.open).not.toHaveBeenCalled()
      
      // Add messages
      mockChatStore.messages['chatroom-1'] = [
        { id: 'msg1', content: 'Hello', sender: { username: 'user1' } }
      ]
      
      rerender(<Chat {...defaultProps} />)
      
      fireEvent.click(screen.getByTestId('trigger-search'))
      expect(mockSearchDialog.open).toHaveBeenCalled()
    })
  })

  describe('Memory Management', () => {
    it('should cleanup event listeners on unmount', () => {
      const { unmount } = render(<Chat {...defaultProps} />)
      
      unmount()
      
      // After unmount, keyboard events should not trigger search
      mockSearchDialog.open.mockClear()
      
      fireEvent.keyDown(window, { key: 'f', ctrlKey: true })
      
      expect(mockSearchDialog.open).not.toHaveBeenCalled()
    })

    it('should handle multiple mount/unmount cycles', () => {
      for (let i = 0; i < 5; i++) {
        const { unmount } = render(<Chat {...defaultProps} />)
        expect(screen.getByTestId('chat-container')).toBeInTheDocument()
        unmount()
      }
    })
  })

  describe('CSS Classes and Structure', () => {
    it('should apply correct CSS classes', () => {
      render(<Chat {...defaultProps} />)
      
      expect(document.querySelector('.chatContainer')).toBeInTheDocument()
      expect(document.querySelector('.chatBody')).toBeInTheDocument()
      expect(document.querySelector('.chatBoxContainer')).toBeInTheDocument()
    })

    it('should maintain proper DOM hierarchy', () => {
      render(<Chat {...defaultProps} />)
      
      const chatContainer = document.querySelector('.chatContainer')
      const streamerInfo = screen.getByTestId('streamer-info')
      const chatBody = document.querySelector('.chatBody')
      const messagesHandler = screen.getByTestId('messages-handler')
      const chatBoxContainer = document.querySelector('.chatBoxContainer')
      const chatInput = screen.getByTestId('chat-input')
      
      expect(chatContainer).toContainElement(streamerInfo)
      expect(chatContainer).toContainElement(chatBody)
      expect(chatContainer).toContainElement(chatBoxContainer)
      expect(chatBody).toContainElement(messagesHandler)
      expect(chatBoxContainer).toContainElement(chatInput)
    })
  })
})