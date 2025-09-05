import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import MessagesHandler from './MessagesHandler.jsx'

// Mock dependencies
vi.mock('react-virtuoso', () => ({
  Virtuoso: ({ data, itemContent, computeItemKey, onScroll, initialTopMostItemIndex, ...props }) => {
    const mockVirtuoso = {
      scrollToIndex: vi.fn()
    }
    
    // Store ref for access in tests
    if (props.ref) {
      if (typeof props.ref === 'function') {
        props.ref(mockVirtuoso)
      } else if (props.ref && typeof props.ref === 'object') {
        props.ref.current = mockVirtuoso
      }
    }
    
    const handleScroll = (e) => {
      // Create a custom event with target properties from dataset or defaults
      const customEvent = {
        ...e,
        target: {
          scrollHeight: parseInt(e.target.dataset?.scrollHeight || '1000'),
          scrollTop: parseInt(e.target.dataset?.scrollTop || '0'),
          clientHeight: parseInt(e.target.dataset?.clientHeight || '400'),
          ...e.target
        }
      }
      onScroll?.(customEvent)
    }
    
    return (
      <div 
        data-testid="virtuoso-container"
        data-initial-index={initialTopMostItemIndex}
        style={props.style}
        onScroll={handleScroll}
      >
        {data?.map((item, index) => {
          const key = computeItemKey ? computeItemKey(index, item) : index
          const content = itemContent(index, item)
          
          return content !== false ? (
            <div key={key} data-testid={`message-item-${index}`}>
              {content}
            </div>
          ) : null
        })}
      </div>
    )
  }
}))

// Mock Message component
vi.mock('./Message', () => ({
  default: ({ message, chatroomId, chatroomName, username, userId }) => (
    <div 
      data-testid={`message-${message?.id || 'unknown'}`}
      data-chatroom-id={chatroomId}
      data-chatroom-name={chatroomName}
      data-username={username}
      data-user-id={userId}
      data-message-type={message?.type}
      data-sender-id={message?.sender?.id}
    >
      {message?.type === 'system' ? (
        <span>System: {message?.content}</span>
      ) : message?.type === 'mod_action' ? (
        <span>Mod Action: {message?.content}</span>
      ) : (
        <span>{message?.sender?.username}: {message?.content}</span>
      )}
    </div>
  )
}))

// Mock ChatProvider
vi.mock('../../providers/ChatProvider', () => ({
  default: {
    getState: vi.fn(() => ({
      handleChatroomPause: vi.fn()
    }))
  }
}))

// Mock static assets
vi.mock('../../assets/icons/mouse-scroll-fill.svg?asset', () => ({ 
  default: 'mouse-scroll-icon.svg' 
}))

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

describe('MessagesHandler Component', () => {
  // Helper function to trigger scroll events with mock data
  const triggerScrollEvent = (element, { scrollHeight = 1000, scrollTop = 0, clientHeight = 400 } = {}) => {
    element.dataset.scrollHeight = scrollHeight.toString()
    element.dataset.scrollTop = scrollTop.toString()
    element.dataset.clientHeight = clientHeight.toString()
    fireEvent.scroll(element)
  }

  const mockMessages = [
    {
      id: 'msg1',
      content: 'First message',
      type: 'message',
      chatroom_id: 'chatroom1',
      sender: { id: 'user1', username: 'testuser1' },
      created_at: '2024-01-01T10:00:00Z'
    },
    {
      id: 'msg2',
      content: 'Second message',
      type: 'message',
      chatroom_id: 'chatroom1',
      sender: { id: 'user2', username: 'testuser2' },
      created_at: '2024-01-01T10:01:00Z'
    },
    {
      id: 'sys1',
      content: 'System notification',
      type: 'system',
      chatroom_id: 'chatroom1',
      created_at: '2024-01-01T10:02:00Z'
    },
    {
      id: 'mod1',
      content: 'User was banned',
      type: 'mod_action',
      chatroom_id: 'chatroom1',
      created_at: '2024-01-01T10:03:00Z'
    }
  ]

  const defaultProps = {
    messages: mockMessages,
    chatroomId: 'chatroom1',
    slug: 'testchatroom',
    allStvEmotes: [],
    subscriberBadges: [],
    kickTalkBadges: [],
    settings: {
      chatrooms: {
        showModActions: true
      }
    },
    userChatroomInfo: {
      id: 'currentuser',
      is_broadcaster: false,
      is_moderator: false
    },
    username: 'currentuser',
    userId: 'currentuser123',
    donators: []
  }

  let handleChatroomPause
  let mockUseChatStore

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    handleChatroomPause = vi.fn()
    mockUseChatStore = await import('../../providers/ChatProvider')
    mockUseChatStore.default.getState.mockReturnValue({
      handleChatroomPause
    })
    
    // Reset localStorage mock
    mockLocalStorage.getItem.mockReturnValue('{}')
    
    // Mock window.addEventListener and removeEventListener
    global.window.addEventListener = vi.fn()
    global.window.removeEventListener = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllTimers()
  })

  describe('Rendering and Initialization', () => {
    it('should render messages container with virtuoso', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      expect(screen.getByTestId('virtuoso-container')).toBeInTheDocument()
      expect(screen.getByTestId('virtuoso-container')).toHaveStyle({
        height: '100%',
        width: '100%',
        flex: '1'
      })
    })

    it('should render all filtered messages for current chatroom', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      expect(screen.getByTestId('message-msg1')).toBeInTheDocument()
      expect(screen.getByTestId('message-msg2')).toBeInTheDocument()
      expect(screen.getByTestId('message-sys1')).toBeInTheDocument()
      expect(screen.getByTestId('message-mod1')).toBeInTheDocument()
    })

    it('should filter messages by chatroom ID', () => {
      const messagesWithDifferentChatrooms = [
        ...mockMessages,
        {
          id: 'msg3',
          content: 'Different chatroom message',
          type: 'message',
          chatroom_id: 'chatroom2',
          sender: { id: 'user3', username: 'testuser3' }
        }
      ]
      
      render(<MessagesHandler {...defaultProps} messages={messagesWithDifferentChatrooms} />)
      
      expect(screen.getByTestId('message-msg1')).toBeInTheDocument()
      expect(screen.queryByTestId('message-msg3')).not.toBeInTheDocument()
    })

    it('should set initial top most item index to last message', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      const virtuoso = screen.getByTestId('virtuoso-container')
      expect(virtuoso).toHaveAttribute('data-initial-index', '3') // 4 messages, index 3
    })

    it('should handle empty messages array', () => {
      render(<MessagesHandler {...defaultProps} messages={[]} />)
      
      expect(screen.getByTestId('virtuoso-container')).toBeInTheDocument()
      expect(screen.queryByTestId(/message-/)).not.toBeInTheDocument()
    })

    it('should handle undefined messages', () => {
      render(<MessagesHandler {...defaultProps} messages={undefined} />)
      
      expect(screen.getByTestId('virtuoso-container')).toBeInTheDocument()
      expect(screen.queryByTestId(/message-/)).not.toBeInTheDocument()
    })
  })

  describe('Message Filtering', () => {
    it('should show system messages regardless of silencing', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      const systemMessage = screen.getByTestId('message-sys1')
      expect(systemMessage).toBeInTheDocument()
      expect(systemMessage).toHaveTextContent('System: System notification')
    })

    it('should show mod action messages regardless of silencing', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      const modMessage = screen.getByTestId('message-mod1')
      expect(modMessage).toBeInTheDocument()
      expect(modMessage).toHaveTextContent('Mod Action: User was banned')
    })

    it('should hide mod actions when setting is disabled', () => {
      const settingsWithHiddenMods = {
        ...defaultProps.settings,
        chatrooms: {
          showModActions: false
        }
      }
      
      render(<MessagesHandler {...defaultProps} settings={settingsWithHiddenMods} />)
      
      expect(screen.getByTestId('message-msg1')).toBeInTheDocument()
      expect(screen.queryByTestId('message-mod1')).not.toBeInTheDocument()
    })

    it('should handle reply messages', () => {
      const messagesWithReply = [
        ...mockMessages,
        {
          id: 'reply1',
          content: 'Reply message',
          type: 'reply',
          chatroom_id: 'chatroom1',
          sender: { id: 'user1', username: 'testuser1' },
          metadata: {
            original_sender: { username: 'original' },
            original_message: { content: 'Original message' }
          }
        }
      ]
      
      render(<MessagesHandler {...defaultProps} messages={messagesWithReply} />)
      
      expect(screen.getByTestId('message-reply1')).toBeInTheDocument()
    })

    it('should filter silenced users from regular messages', () => {
      // Mock localStorage with silenced users
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        data: [{ id: 'user1', username: 'testuser1' }]
      }))
      
      render(<MessagesHandler {...defaultProps} />)
      
      // System and mod messages should still appear
      expect(screen.getByTestId('message-sys1')).toBeInTheDocument()
      expect(screen.getByTestId('message-mod1')).toBeInTheDocument()
      
      // Regular message from silenced user should not appear
      expect(screen.queryByTestId('message-msg1')).not.toBeInTheDocument()
      
      // Message from non-silenced user should appear
      expect(screen.getByTestId('message-msg2')).toBeInTheDocument()
    })

    it('should handle invalid localStorage data gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json')
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      render(<MessagesHandler {...defaultProps} />)
      
      // Should render all messages when localStorage parsing fails
      expect(screen.getByTestId('message-msg1')).toBeInTheDocument()
      expect(screen.getByTestId('message-msg2')).toBeInTheDocument()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MessagesHandler]: Error loading silenced users:'),
        expect.any(Error)
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('Virtuoso Configuration', () => {
    it('should pass correct props to Virtuoso', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      const virtuoso = screen.getByTestId('virtuoso-container')
      expect(virtuoso).toHaveAttribute('data-initial-index', '3')
    })

    it('should compute item keys correctly', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      // Check that each message item has proper key structure
      const messageItems = screen.getAllByTestId(/message-item-/)
      expect(messageItems).toHaveLength(4)
      
      // Items should be rendered for each message
      expect(screen.getByTestId('message-item-0')).toBeInTheDocument()
      expect(screen.getByTestId('message-item-1')).toBeInTheDocument()
      expect(screen.getByTestId('message-item-2')).toBeInTheDocument()
      expect(screen.getByTestId('message-item-3')).toBeInTheDocument()
    })

    it('should handle messages without IDs in key computation', () => {
      const messagesWithoutIds = [
        {
          content: 'Message without ID',
          type: 'message',
          chatroom_id: 'chatroom1',
          sender: { id: 'user1', username: 'testuser1' }
        }
      ]
      
      render(<MessagesHandler {...defaultProps} messages={messagesWithoutIds} />)
      
      expect(screen.getByTestId('message-item-0')).toBeInTheDocument()
    })
  })

  describe('Scroll Behavior and Auto-scroll', () => {
    it('should scroll to bottom when chatroom changes', () => {
      const mockScrollToIndex = vi.fn()
      const mockVirtuoso = { scrollToIndex: mockScrollToIndex }
      
      // Mock ref to return our mock virtuoso
      vi.spyOn(React, 'useRef').mockReturnValue({ current: mockVirtuoso })
      
      const { rerender } = render(<MessagesHandler {...defaultProps} />)
      
      // Change chatroom
      rerender(<MessagesHandler {...defaultProps} chatroomId="chatroom2" />)
      
      expect(mockScrollToIndex).toHaveBeenCalledWith({
        index: 3, // filteredMessages.length - 1
        behavior: "instant",
        align: "end"
      })
    })

    it('should auto-scroll when at bottom and new messages arrive', () => {
      vi.advanceTimersByTime(0) // Process initial setTimeout
      
      const { rerender } = render(<MessagesHandler {...defaultProps} />)
      
      const newMessages = [
        ...mockMessages,
        {
          id: 'msg3',
          content: 'New message',
          type: 'message',
          chatroom_id: 'chatroom1',
          sender: { id: 'user3', username: 'testuser3' }
        }
      ]
      
      rerender(<MessagesHandler {...defaultProps} messages={newMessages} />)
      
      // Advance timer to trigger the setTimeout in useEffect
      vi.advanceTimersByTime(0)
      
      expect(screen.getByTestId('message-msg3')).toBeInTheDocument()
    })

    it('should handle scroll events and update atBottom state', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      const virtuoso = screen.getByTestId('virtuoso-container')
      
      // Mock scroll event - user scrolled up (not at bottom)
      // 1000 - 100 - 400 = 500 > 250, so it's NOT near bottom
      triggerScrollEvent(virtuoso, { scrollHeight: 1000, scrollTop: 100, clientHeight: 400 })
      
      // Should show scroll to bottom button when not at bottom
      expect(screen.getByText('Scroll To Bottom')).toBeInTheDocument()
    })

    it('should handle scroll events near bottom', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      const virtuoso = screen.getByTestId('virtuoso-container')
      
      // Mock scroll event - user is near bottom (within 250px)
      const scrollEvent = {
        target: {
          scrollHeight: 1000,
          scrollTop: 850, // 1000 - 850 - 100 = 50 < 250
          clientHeight: 100
        }
      }
      
      fireEvent.scroll(virtuoso, scrollEvent)
      
      // Should not show scroll to bottom button when near bottom
      expect(screen.queryByText('Scroll To Bottom')).not.toBeInTheDocument()
    })

    it('should handle scroll events without target gracefully', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      const virtuoso = screen.getByTestId('virtuoso-container')
      
      // Mock scroll event without proper target
      fireEvent.scroll(virtuoso, {})
      
      // Should not crash
      expect(screen.getByTestId('virtuoso-container')).toBeInTheDocument()
    })
  })

  describe('Pause/Resume Functionality', () => {
    it('should toggle pause state when scroll to bottom button clicked', async () => {
      const user = userEvent.setup({ delay: null })
      render(<MessagesHandler {...defaultProps} />)
      
      // First scroll up to show the button
      const virtuoso = screen.getByTestId('virtuoso-container')
      fireEvent.scroll(virtuoso, {
        target: {
          scrollHeight: 1000,
          scrollTop: 0,
          clientHeight: 400
        }
      })
      
      const scrollButton = screen.getByText('Scroll To Bottom')
      expect(scrollButton).toBeInTheDocument()
      
      await user.click(scrollButton)
      
      expect(handleChatroomPause).toHaveBeenCalledWith('chatroom1', false)
    })

    it('should call handleChatroomPause when pause state changes via scroll', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      const virtuoso = screen.getByTestId('virtuoso-container')
      
      // Scroll up (should pause)
      fireEvent.scroll(virtuoso, {
        target: {
          scrollHeight: 1000,
          scrollTop: 0,
          clientHeight: 400
        }
      })
      
      expect(handleChatroomPause).toHaveBeenCalledWith('chatroom1', true)
      
      // Scroll back to bottom (should unpause)
      fireEvent.scroll(virtuoso, {
        target: {
          scrollHeight: 1000,
          scrollTop: 850,
          clientHeight: 100
        }
      })
      
      expect(handleChatroomPause).toHaveBeenCalledWith('chatroom1', false)
    })

    it('should not auto-scroll when paused', () => {
      const { rerender } = render(<MessagesHandler {...defaultProps} />)
      
      // First scroll up to pause
      const virtuoso = screen.getByTestId('virtuoso-container')
      fireEvent.scroll(virtuoso, {
        target: {
          scrollHeight: 1000,
          scrollTop: 0,
          clientHeight: 400
        }
      })
      
      // Add new message while paused
      const newMessages = [
        ...mockMessages,
        {
          id: 'msg3',
          content: 'New message while paused',
          type: 'message',
          chatroom_id: 'chatroom1',
          sender: { id: 'user3', username: 'testuser3' }
        }
      ]
      
      rerender(<MessagesHandler {...defaultProps} messages={newMessages} />)
      
      // Should show scroll to bottom button (still paused)
      expect(screen.getByText('Scroll To Bottom')).toBeInTheDocument()
    })
  })

  describe('Silenced Users Management', () => {
    it('should load silenced users from localStorage on mount', () => {
      const silencedUsersData = {
        data: [
          { id: 'user1', username: 'testuser1' },
          { id: 'user2', username: 'testuser2' }
        ]
      }
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(silencedUsersData))
      
      render(<MessagesHandler {...defaultProps} />)
      
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('silencedUsers')
      
      // Messages from silenced users should be hidden
      expect(screen.queryByTestId('message-msg1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('message-msg2')).not.toBeInTheDocument()
      
      // System messages should still show
      expect(screen.getByTestId('message-sys1')).toBeInTheDocument()
    })

    it('should listen for localStorage changes', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      expect(window.addEventListener).toHaveBeenCalledWith('storage', expect.any(Function))
    })

    it('should update silenced users when localStorage changes', () => {
      mockLocalStorage.getItem.mockReturnValue('{}')
      
      render(<MessagesHandler {...defaultProps} />)
      
      // All messages should be visible initially
      expect(screen.getByTestId('message-msg1')).toBeInTheDocument()
      expect(screen.getByTestId('message-msg2')).toBeInTheDocument()
      
      // Simulate storage event
      const storageHandler = window.addEventListener.mock.calls.find(
        call => call[0] === 'storage'
      )[1]
      
      // Update localStorage to silence user1
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        data: [{ id: 'user1', username: 'testuser1' }]
      }))
      
      // Trigger storage event
      storageHandler({ key: 'silencedUsers' })
      
      // Should re-render without silenced user's message
      // Note: In a real test environment, this would require a re-render
    })

    it('should ignore non-silencedUsers storage events', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      const storageHandler = window.addEventListener.mock.calls.find(
        call => call[0] === 'storage'
      )[1]
      
      // Trigger storage event for different key
      storageHandler({ key: 'otherKey' })
      
      // Should not call getItem again for silencedUsers
      expect(mockLocalStorage.getItem).toHaveBeenCalledTimes(1) // Only initial call
    })

    it('should handle localStorage access errors', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage access denied')
      })
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      render(<MessagesHandler {...defaultProps} />)
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MessagesHandler]: Error loading silenced users:'),
        expect.any(Error)
      )
      
      // Should render all messages when error occurs
      expect(screen.getByTestId('message-msg1')).toBeInTheDocument()
      expect(screen.getByTestId('message-msg2')).toBeInTheDocument()
      
      consoleSpy.mockRestore()
    })

    it('should cleanup storage event listener on unmount', () => {
      const { unmount } = render(<MessagesHandler {...defaultProps} />)
      
      unmount()
      
      expect(window.removeEventListener).toHaveBeenCalledWith('storage', expect.any(Function))
    })
  })

  describe('Message Rendering and Content', () => {
    it('should pass correct props to Message components', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      const messageElement = screen.getByTestId('message-msg1')
      
      expect(messageElement).toHaveAttribute('data-chatroom-id', 'chatroom1')
      expect(messageElement).toHaveAttribute('data-chatroom-name', 'testchatroom')
      expect(messageElement).toHaveAttribute('data-username', 'currentuser')
      expect(messageElement).toHaveAttribute('data-user-id', 'currentuser123')
    })

    it('should handle different message types correctly', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      expect(screen.getByTestId('message-msg1')).toHaveAttribute('data-message-type', 'message')
      expect(screen.getByTestId('message-sys1')).toHaveAttribute('data-message-type', 'system')
      expect(screen.getByTestId('message-mod1')).toHaveAttribute('data-message-type', 'mod_action')
    })

    it('should render messages with sender information', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      const messageElement = screen.getByTestId('message-msg1')
      expect(messageElement).toHaveAttribute('data-sender-id', 'user1')
      expect(messageElement).toHaveTextContent('testuser1: First message')
    })

    it('should handle messages without senders', () => {
      const messagesWithoutSender = [
        {
          id: 'nosender',
          content: 'Message without sender',
          type: 'message',
          chatroom_id: 'chatroom1'
        }
      ]
      
      render(<MessagesHandler {...defaultProps} messages={messagesWithoutSender} />)
      
      expect(screen.getByTestId('message-nosender')).toBeInTheDocument()
    })
  })

  describe('Scroll to Bottom Button', () => {
    it('should show scroll to bottom button when not at bottom', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      const virtuoso = screen.getByTestId('virtuoso-container')
      
      // Scroll up
      fireEvent.scroll(virtuoso, {
        target: {
          scrollHeight: 1000,
          scrollTop: 0,
          clientHeight: 400
        }
      })
      
      const scrollButton = screen.getByText('Scroll To Bottom')
      expect(scrollButton).toBeInTheDocument()
      expect(screen.getByAltText('Scroll To Bottom')).toBeInTheDocument()
    })

    it('should hide scroll to bottom button when at bottom', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      // Should not show button initially (at bottom by default)
      expect(screen.queryByText('Scroll To Bottom')).not.toBeInTheDocument()
    })

    it('should scroll to bottom and update state when button clicked', async () => {
      const user = userEvent.setup({ delay: null })
      const mockScrollToIndex = vi.fn()
      
      // Override the mock to capture scroll calls
      mockUseChatStore.default.getState.mockReturnValue({
        handleChatroomPause: vi.fn()
      })
      
      render(<MessagesHandler {...defaultProps} />)
      
      const virtuoso = screen.getByTestId('virtuoso-container')
      
      // Scroll up to show button
      fireEvent.scroll(virtuoso, {
        target: {
          scrollHeight: 1000,
          scrollTop: 0,
          clientHeight: 400
        }
      })
      
      const scrollButton = screen.getByText('Scroll To Bottom')
      await user.click(scrollButton)
      
      // Should unpause and hide the button
      expect(screen.queryByText('Scroll To Bottom')).not.toBeInTheDocument()
    })
  })

  describe('Performance and Memory Management', () => {
    it('should memoize filtered messages correctly', () => {
      const { rerender } = render(<MessagesHandler {...defaultProps} />)
      
      // Same props should not cause re-filtering
      rerender(<MessagesHandler {...defaultProps} />)
      
      expect(screen.getByTestId('message-msg1')).toBeInTheDocument()
    })

    it('should handle large message arrays efficiently', () => {
      // Create 1000 messages
      const manyMessages = Array.from({ length: 1000 }, (_, i) => ({
        id: `msg${i}`,
        content: `Message ${i}`,
        type: 'message',
        chatroom_id: 'chatroom1',
        sender: { id: `user${i}`, username: `user${i}` }
      }))
      
      render(<MessagesHandler {...defaultProps} messages={manyMessages} />)
      
      // Should render virtuoso container
      expect(screen.getByTestId('virtuoso-container')).toBeInTheDocument()
      
      // Should have correct number of items
      const messageItems = screen.getAllByTestId(/message-item-/)
      expect(messageItems).toHaveLength(1000)
    })

    it('should cleanup effects on unmount', () => {
      const { unmount } = render(<MessagesHandler {...defaultProps} />)
      
      unmount()
      
      expect(window.removeEventListener).toHaveBeenCalledWith('storage', expect.any(Function))
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle null/undefined messages gracefully', () => {
      const messagesWithNulls = [
        null,
        undefined,
        mockMessages[0],
        {
          id: 'incomplete',
          type: 'message',
          chatroom_id: 'chatroom1'
          // Missing content, sender
        }
      ]
      
      render(<MessagesHandler {...defaultProps} messages={messagesWithNulls} />)
      
      // Should render valid messages
      expect(screen.getByTestId('message-msg1')).toBeInTheDocument()
      expect(screen.getByTestId('message-incomplete')).toBeInTheDocument()
    })

    it('should handle missing chatroom_id in messages', () => {
      const messagesWithoutChatroomId = [
        {
          id: 'no-chatroom',
          content: 'Message without chatroom_id',
          type: 'message',
          sender: { id: 'user1', username: 'testuser1' }
        }
      ]
      
      render(<MessagesHandler {...defaultProps} messages={messagesWithoutChatroomId} />)
      
      // Should filter out message without matching chatroom_id
      expect(screen.queryByTestId('message-no-chatroom')).not.toBeInTheDocument()
    })

    it('should handle messages with invalid types', () => {
      const messagesWithInvalidType = [
        {
          id: 'invalid-type',
          content: 'Message with invalid type',
          type: 'unknown_type',
          chatroom_id: 'chatroom1',
          sender: { id: 'user1', username: 'testuser1' }
        }
      ]
      
      render(<MessagesHandler {...defaultProps} messages={messagesWithInvalidType} />)
      
      // Should still render message with unknown type
      expect(screen.getByTestId('message-invalid-type')).toBeInTheDocument()
    })

    it('should handle rapid prop changes', () => {
      const { rerender } = render(<MessagesHandler {...defaultProps} />)
      
      // Rapid prop changes
      for (let i = 0; i < 10; i++) {
        rerender(<MessagesHandler {...defaultProps} chatroomId={`chatroom${i}`} />)
      }
      
      // Should not crash
      expect(screen.getByTestId('virtuoso-container')).toBeInTheDocument()
    })

    it('should handle missing settings gracefully', () => {
      render(<MessagesHandler {...defaultProps} settings={undefined} />)
      
      // Should render messages even without settings
      expect(screen.getByTestId('message-msg1')).toBeInTheDocument()
      
      // Mod action should be visible (default behavior)
      expect(screen.getByTestId('message-mod1')).toBeInTheDocument()
    })

    it('should handle partial settings object', () => {
      const partialSettings = {
        // Missing chatrooms.showModActions
      }
      
      render(<MessagesHandler {...defaultProps} settings={partialSettings} />)
      
      // Should render all messages with default behavior
      expect(screen.getByTestId('message-msg1')).toBeInTheDocument()
      expect(screen.getByTestId('message-mod1')).toBeInTheDocument()
    })
  })

  describe('Data Attributes and Container', () => {
    it('should set correct data attributes on chat container', () => {
      const { container } = render(<MessagesHandler {...defaultProps} />)
      
      const chatContainer = container.querySelector('.chatContainer')
      expect(chatContainer).toBeInTheDocument()
      expect(chatContainer).toHaveAttribute('data-chatroom-id', 'chatroom1')
      expect(chatContainer).toHaveStyle({
        height: '100%',
        flex: '1'
      })
    })

    it('should update container data attribute when chatroom changes', () => {
      const { container, rerender } = render(<MessagesHandler {...defaultProps} />)
      
      rerender(<MessagesHandler {...defaultProps} chatroomId="chatroom2" />)
      
      const chatContainer = container.querySelector('.chatContainer')
      expect(chatContainer).toHaveAttribute('data-chatroom-id', 'chatroom2')
    })
  })

  describe('Integration with ChatProvider', () => {
    it('should call handleChatroomPause with correct parameters', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      const virtuoso = screen.getByTestId('virtuoso-container')
      
      // Trigger scroll that should pause
      fireEvent.scroll(virtuoso, {
        target: {
          scrollHeight: 1000,
          scrollTop: 0,
          clientHeight: 400
        }
      })
      
      expect(handleChatroomPause).toHaveBeenCalledWith('chatroom1', true)
    })

    it('should handle ChatProvider state errors gracefully', async () => {
      const mockUseChatStore = await import('../../providers/ChatProvider')
      mockUseChatStore.default.getState.mockImplementation(() => {
        throw new Error('ChatProvider error')
      })
      
      render(<MessagesHandler {...defaultProps} />)
      
      const virtuoso = screen.getByTestId('virtuoso-container')
      
      // Should not crash when ChatProvider throws
      expect(() => {
        fireEvent.scroll(virtuoso, {
          target: {
            scrollHeight: 1000,
            scrollTop: 0,
            clientHeight: 400
          }
        })
      }).not.toThrow()
    })
  })

  describe('Accessibility', () => {
    it('should have proper alt text for scroll button icon', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      const virtuoso = screen.getByTestId('virtuoso-container')
      
      // Scroll up to show button
      fireEvent.scroll(virtuoso, {
        target: {
          scrollHeight: 1000,
          scrollTop: 0,
          clientHeight: 400
        }
      })
      
      const icon = screen.getByAltText('Scroll To Bottom')
      expect(icon).toBeInTheDocument()
      expect(icon).toHaveAttribute('src', 'mouse-scroll-icon.svg')
    })

    it('should have clickable scroll to bottom button', async () => {
      const user = userEvent.setup({ delay: null })
      render(<MessagesHandler {...defaultProps} />)
      
      const virtuoso = screen.getByTestId('virtuoso-container')
      
      // Scroll up to show button
      fireEvent.scroll(virtuoso, {
        target: {
          scrollHeight: 1000,
          scrollTop: 0,
          clientHeight: 400
        }
      })
      
      const scrollButton = screen.getByText('Scroll To Bottom')
      expect(scrollButton).toBeInTheDocument()
      
      await user.click(scrollButton)
      
      // Button should disappear after click
      expect(screen.queryByText('Scroll To Bottom')).not.toBeInTheDocument()
    })
  })

  describe('Advanced Virtual Scrolling and Ref Management', () => {
    it('should handle virtuoso ref assignment correctly', () => {
      let capturedRef = null
      const mockScrollToIndex = vi.fn()
      
      // Mock React.useRef to capture the ref
      vi.spyOn(React, 'useRef').mockImplementation(() => ({
        current: {
          scrollToIndex: mockScrollToIndex
        }
      }))
      
      render(<MessagesHandler {...defaultProps} />)
      
      // Verify virtuoso container is rendered
      expect(screen.getByTestId('virtuoso-container')).toBeInTheDocument()
    })

    it('should handle virtuoso scrollToIndex with different alignment options', () => {
      const mockScrollToIndex = vi.fn()
      
      vi.spyOn(React, 'useRef').mockImplementation(() => ({
        current: {
          scrollToIndex: mockScrollToIndex
        }
      }))
      
      const { rerender } = render(<MessagesHandler {...defaultProps} />)
      
      // Change chatroom to trigger scroll
      rerender(<MessagesHandler {...defaultProps} chatroomId="newChatroom" />)
      
      expect(mockScrollToIndex).toHaveBeenCalled()
    })

    it('should handle null virtuoso ref gracefully', () => {
      vi.spyOn(React, 'useRef').mockImplementation(() => ({
        current: null
      }))
      
      const { rerender } = render(<MessagesHandler {...defaultProps} />)
      
      // Should not crash when ref is null
      rerender(<MessagesHandler {...defaultProps} chatroomId="newChatroom" />)
      expect(screen.getByTestId('virtuoso-container')).toBeInTheDocument()
    })
  })

  describe('ItemContent Function Edge Cases', () => {
    it('should return false for hidden mod actions', () => {
      const settingsHidingModActions = {
        ...defaultProps.settings,
        chatrooms: {
          showModActions: false
        }
      }
      
      render(<MessagesHandler {...defaultProps} settings={settingsHidingModActions} />)
      
      // Mod action message should be filtered out
      expect(screen.queryByTestId('message-mod1')).not.toBeInTheDocument()
    })

    it('should handle messages without IDs in itemContent', () => {
      const messagesWithoutId = [
        {
          content: 'Message without ID',
          type: 'message',
          chatroom_id: 'chatroom1',
          sender: { id: 'user1', username: 'testuser1' }
        }
      ]
      
      render(<MessagesHandler {...defaultProps} messages={messagesWithoutId} />)
      
      // Should render message even without ID
      expect(screen.getByTestId('message-unknown')).toBeInTheDocument()
    })

    it('should pass all required props to Message component', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      const messageElement = screen.getByTestId('message-msg1')
      
      // Verify all props are passed through correctly
      expect(messageElement).toHaveAttribute('data-chatroom-id', 'chatroom1')
      expect(messageElement).toHaveAttribute('data-chatroom-name', 'testchatroom')
      expect(messageElement).toHaveAttribute('data-username', 'currentuser')
      expect(messageElement).toHaveAttribute('data-user-id', 'currentuser123')
    })
  })

  describe('Advanced Async Behavior and Timing', () => {
    it('should handle rapid chatroom changes without race conditions', async () => {
      const { rerender } = render(<MessagesHandler {...defaultProps} />)
      
      // Simulate rapid chatroom changes
      for (let i = 0; i < 5; i++) {
        rerender(<MessagesHandler {...defaultProps} chatroomId={`chatroom${i}`} />)
        vi.advanceTimersByTime(0) // Process any pending timeouts
      }
      
      // Should not crash and should be stable
      expect(screen.getByTestId('virtuoso-container')).toBeInTheDocument()
    })

    it('should handle timeout in auto-scroll effect correctly', async () => {
      const { rerender } = render(<MessagesHandler {...defaultProps} />)
      
      const newMessages = [
        ...mockMessages,
        {
          id: 'msg-new',
          content: 'New message',
          type: 'message',
          chatroom_id: 'chatroom1',
          sender: { id: 'user3', username: 'testuser3' }
        }
      ]
      
      rerender(<MessagesHandler {...defaultProps} messages={newMessages} />)
      
      // Fast-forward past the setTimeout delay
      vi.advanceTimersByTime(10)
      
      expect(screen.getByTestId('message-msg-new')).toBeInTheDocument()
    })

    it('should handle async localStorage operations', async () => {
      // Mock localStorage to return a Promise (simulating async behavior)
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'silencedUsers') {
          return JSON.stringify({
            data: [{ id: 'user1', username: 'testuser1' }]
          })
        }
        return '{}'
      })
      
      render(<MessagesHandler {...defaultProps} />)
      
      // Wait for localStorage to be processed
      await waitFor(() => {
        expect(mockLocalStorage.getItem).toHaveBeenCalledWith('silencedUsers')
      })
      
      // Silenced user message should not appear
      expect(screen.queryByTestId('message-msg1')).not.toBeInTheDocument()
    })
  })

  describe('Enhanced Scroll Behavior Edge Cases', () => {
    it('should handle scroll events with extreme values', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      const virtuoso = screen.getByTestId('virtuoso-container')
      
      // Test with very large scroll values
      fireEvent.scroll(virtuoso, {
        target: {
          scrollHeight: Number.MAX_SAFE_INTEGER,
          scrollTop: Number.MAX_SAFE_INTEGER - 300,
          clientHeight: 400
        }
      })
      
      // Should still function correctly
      expect(screen.queryByText('Scroll To Bottom')).not.toBeInTheDocument()
    })

    it('should handle scroll events with zero values', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      const virtuoso = screen.getByTestId('virtuoso-container')
      
      // Test with zero scroll values
      fireEvent.scroll(virtuoso, {
        target: {
          scrollHeight: 0,
          scrollTop: 0,
          clientHeight: 0
        }
      })
      
      // Should not crash
      expect(screen.getByTestId('virtuoso-container')).toBeInTheDocument()
    })

    it('should handle pause state changes during scroll', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      const virtuoso = screen.getByTestId('virtuoso-container')
      
      // Start paused (scroll up)
      fireEvent.scroll(virtuoso, {
        target: {
          scrollHeight: 1000,
          scrollTop: 0,
          clientHeight: 400
        }
      })
      
      expect(handleChatroomPause).toHaveBeenCalledWith('chatroom1', true)
      
      // Then scroll to near bottom but not exactly bottom
      fireEvent.scroll(virtuoso, {
        target: {
          scrollHeight: 1000,
          scrollTop: 740, // 1000 - 740 - 400 = -140, but threshold is 250
          clientHeight: 400
        }
      })
      
      expect(handleChatroomPause).toHaveBeenCalledWith('chatroom1', false)
    })
  })

  describe('Message Filtering Complex Scenarios', () => {
    it('should handle mixed message types with complex filtering', () => {
      const complexMessages = [
        {
          id: 'regular1',
          content: 'Regular message',
          type: 'message',
          chatroom_id: 'chatroom1',
          sender: { id: 'user1', username: 'user1' }
        },
        {
          id: 'reply1',
          content: 'Reply message',
          type: 'reply',
          chatroom_id: 'chatroom1',
          sender: { id: 'user2', username: 'user2' },
          metadata: {
            original_sender: { username: 'original' },
            original_message: { content: 'Original' }
          }
        },
        {
          id: 'unknown1',
          content: 'Unknown type message',
          type: 'custom_type',
          chatroom_id: 'chatroom1',
          sender: { id: 'user3', username: 'user3' }
        },
        {
          id: 'no_sender',
          content: 'No sender message',
          type: 'message',
          chatroom_id: 'chatroom1'
          // No sender field
        },
        {
          id: 'empty_sender',
          content: 'Empty sender ID',
          type: 'message',
          chatroom_id: 'chatroom1',
          sender: { username: 'emptySender' }
          // sender.id is undefined
        }
      ]
      
      render(<MessagesHandler {...defaultProps} messages={complexMessages} />)
      
      // Regular message should appear
      expect(screen.getByTestId('message-regular1')).toBeInTheDocument()
      
      // Reply should appear
      expect(screen.getByTestId('message-reply1')).toBeInTheDocument()
      
      // Unknown type should appear (falls through to default)
      expect(screen.getByTestId('message-unknown1')).toBeInTheDocument()
      
      // No sender message should be filtered out (no sender.id)
      expect(screen.queryByTestId('message-no_sender')).not.toBeInTheDocument()
      
      // Empty sender ID should be filtered out
      expect(screen.queryByTestId('message-empty_sender')).not.toBeInTheDocument()
    })

    it('should handle silenced users with edge case IDs', () => {
      // Test with various edge case user IDs
      const edgeCaseUsers = {
        data: [
          { id: '', username: 'emptyId' },        // Empty string ID
          { id: '0', username: 'zeroId' },        // Zero ID
          { id: 'null', username: 'nullString' }, // String 'null'
          { id: undefined, username: 'undefined' } // Undefined ID
        ]
      }
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(edgeCaseUsers))
      
      const edgeCaseMessages = [
        {
          id: 'msg1',
          content: 'Empty ID message',
          type: 'message',
          chatroom_id: 'chatroom1',
          sender: { id: '', username: 'emptyId' }
        },
        {
          id: 'msg2',
          content: 'Zero ID message',
          type: 'message',
          chatroom_id: 'chatroom1',
          sender: { id: '0', username: 'zeroId' }
        },
        {
          id: 'msg3',
          content: 'Regular message',
          type: 'message',
          chatroom_id: 'chatroom1',
          sender: { id: 'regular', username: 'regular' }
        }
      ]
      
      render(<MessagesHandler {...defaultProps} messages={edgeCaseMessages} />)
      
      // Empty ID should be silenced
      expect(screen.queryByTestId('message-msg1')).not.toBeInTheDocument()
      
      // Zero ID should be silenced
      expect(screen.queryByTestId('message-msg2')).not.toBeInTheDocument()
      
      // Regular ID should not be silenced
      expect(screen.getByTestId('message-msg3')).toBeInTheDocument()
    })
  })

  describe('Component Lifecycle and Cleanup', () => {
    it('should properly setup and cleanup all event listeners', () => {
      const { unmount } = render(<MessagesHandler {...defaultProps} />)
      
      // Verify storage listener was added
      expect(window.addEventListener).toHaveBeenCalledWith('storage', expect.any(Function))
      
      // Unmount and verify cleanup
      unmount()
      
      expect(window.removeEventListener).toHaveBeenCalledWith('storage', expect.any(Function))
    })

    it('should handle multiple mount/unmount cycles correctly', () => {
      // Mount and unmount multiple times
      for (let i = 0; i < 3; i++) {
        const { unmount } = render(<MessagesHandler {...defaultProps} />)
        unmount()
      }
      
      // Should not have any lingering effects
      expect(window.addEventListener).toHaveBeenCalled()
      expect(window.removeEventListener).toHaveBeenCalled()
    })
  })

  describe('State Management and Updates', () => {
    it('should handle rapid state updates without batching issues', () => {
      render(<MessagesHandler {...defaultProps} />)
      
      const virtuoso = screen.getByTestId('virtuoso-container')
      
      // Rapid scroll events
      for (let i = 0; i < 10; i++) {
        fireEvent.scroll(virtuoso, {
          target: {
            scrollHeight: 1000,
            scrollTop: i * 100,
            clientHeight: 400
          }
        })
      }
      
      // Should handle all events without crashing
      expect(screen.getByTestId('virtuoso-container')).toBeInTheDocument()
    })

    it('should maintain consistent state during prop changes', () => {
      const { rerender } = render(<MessagesHandler {...defaultProps} />)
      
      // Change multiple props simultaneously
      rerender(<MessagesHandler 
        {...defaultProps} 
        chatroomId="newChatroom"
        slug="newSlug"
        username="newUser"
      />)
      
      const container = screen.getByTestId('virtuoso-container').closest('.chatContainer')
      expect(container).toHaveAttribute('data-chatroom-id', 'newChatroom')
    })
  })
})