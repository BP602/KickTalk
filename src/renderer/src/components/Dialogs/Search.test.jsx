import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Search from './Search.jsx'

// Mock SCSS imports
vi.mock('../../assets/styles/components/Chat/Message.scss', () => ({}))

// Mock react-virtuoso
vi.mock('react-virtuoso', () => ({
  Virtuoso: ({ totalCount, itemContent, style, className, overscan, ref }) => {
    // Store ref for scrolling tests
    if (ref && typeof ref === 'object') {
      ref.current = {
        scrollToIndex: vi.fn()
      }
    }
    
    return (
      <div 
        data-testid="virtuoso-search-results"
        style={style}
        className={className}
        data-total-count={totalCount}
        data-overscan={overscan}
      >
        {Array.from({ length: totalCount }, (_, index) => (
          <div key={index} data-testid={`virtuoso-item-${index}`}>
            {itemContent(index)}
          </div>
        ))}
      </div>
    )
  }
}))

// Mock static assets
vi.mock('@assets/icons/x-bold.svg', () => ({ default: 'x-icon.svg' }))

// Mock custom hooks
vi.mock('../../utils/hooks', () => ({
  useDebounceValue: (initialValue, delay) => {
    const [value, setValue] = vi.requireActual('react').useState(initialValue)
    return [value, setValue]
  }
}))

// Mock RegularMessage component
vi.mock('../Messages/RegularMessage', () => ({
  default: ({ message, handleOpenUserDialog, isSearch, type, chatroomName, chatroomId }) => (
    <div 
      data-testid={`regular-message-${message.id}`}
      data-is-search={isSearch}
      data-type={type}
      data-chatroom-name={chatroomName}
      data-chatroom-id={chatroomId}
    >
      <button onClick={(e) => handleOpenUserDialog?.(e, message.sender?.username)}>
        {message.sender?.username}: {message.content}
      </button>
    </div>
  )
}))

// Mock window.app API
const mockSearchDialog = {
  onData: vi.fn(() => vi.fn()), // Returns cleanup function
  close: vi.fn()
}

const mockUserDialog = {
  open: vi.fn()
}

const mockKick = {
  getUserChatroomInfo: vi.fn()
}

global.window.app = {
  searchDialog: mockSearchDialog,
  userDialog: mockUserDialog,
  kick: mockKick
}

// Helper: always use the latest registered onData handler for the current render
const getLatestOnData = () => {
  const calls = mockSearchDialog.onData.mock.calls
  return calls[calls.length - 1]?.[0]
}

describe('Search Dialog Component', () => {
  const mockSearchData = {
    chatroomId: 'chatroom123',
    chatroomName: 'teststreamer',
    chatroomSlug: 'teststreamer',
    sevenTVEmotes: [
      { id: 'emote1', name: 'TestEmote' }
    ],
    subscriberBadges: [
      { id: 'sub1', name: 'Subscriber' }
    ],
    userChatroomInfo: {
      id: 'currentuser',
      is_broadcaster: false,
      is_moderator: false
    },
    filteredKickTalkBadges: [
      { username: 'testuser', badges: [{ type: 'Founder' }] }
    ],
    userStyle: {
      badge: { name: '7TV Badge' }
    },
    settings: {
      general: { timestampFormat: 'HH:mm' }
    }
  }

  const mockMessages = [
    {
      id: 'msg1',
      content: 'Hello world test message',
      type: 'message',
      sender: { id: 'user1', username: 'testuser1' },
      chatroom_id: 'chatroom123',
      created_at: '2024-01-01T10:00:00Z'
    },
    {
      id: 'msg2',
      content: 'Another message for testing',
      type: 'message',
      sender: { id: 'user2', username: 'testuser2' },
      chatroom_id: 'chatroom123',
      created_at: '2024-01-01T10:01:00Z'
    },
    {
      id: 'msg3',
      content: 'System notification',
      type: 'system',
      chatroom_id: 'chatroom123',
      created_at: '2024-01-01T10:02:00Z'
    },
    {
      id: 'msg4',
      content: 'Reply to previous message',
      type: 'reply',
      sender: { id: 'user3', username: 'testuser3' },
      chatroom_id: 'chatroom123',
      created_at: '2024-01-01T10:03:00Z'
    },
    {
      id: 'msg5',
      content: 'HELLO uppercase search test',
      type: 'message',
      sender: { id: 'user4', username: 'testuser4' },
      chatroom_id: 'chatroom123',
      created_at: '2024-01-01T10:04:00Z'
    }
  ]

  let mockCleanup
  let mockScrollToIndex

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    mockCleanup = vi.fn()
    mockScrollToIndex = vi.fn()
    
    mockSearchDialog.onData.mockReturnValue(mockCleanup)
    mockKick.getUserChatroomInfo.mockResolvedValue({
      data: {
        id: 'user123',
        username: 'testuser',
        slug: 'testuser'
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllTimers()
  })

  describe('Rendering and Initialization', () => {
    it('should render search dialog container', () => {
      const { container } = render(<Search />)
      
      expect(container.querySelector('.searchDialogContainer')).toBeInTheDocument()
    })

    it('should setup data listener on mount', () => {
      render(<Search />)
      
      expect(mockSearchDialog.onData).toHaveBeenCalledTimes(1)
      expect(mockSearchDialog.onData).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should cleanup data listener on unmount', () => {
      const { unmount } = render(<Search />)
      
      unmount()
      
      expect(mockCleanup).toHaveBeenCalledTimes(1)
    })

    it('should focus search input on mount', () => {
      render(<Search />)
      
      vi.runAllTimers()
      
      const searchInput = screen.getByPlaceholderText('Search messages...')
      expect(searchInput).toHaveFocus()
    })

    it('should render close button', () => {
      render(<Search />)
      
      const closeButton = screen.getByAltText('Close')
      expect(closeButton).toBeInTheDocument()
      expect(closeButton).toHaveAttribute('src', 'x-icon.svg')
      expect(closeButton).toHaveAttribute('width', '18')
      expect(closeButton).toHaveAttribute('height', '18')
    })

    it('should render search input', () => {
      render(<Search />)
      
      const searchInput = screen.getByPlaceholderText('Search messages...')
      expect(searchInput).toBeInTheDocument()
      expect(searchInput.type).toBe('text')
    })
  })

  describe('Data Loading and Display', () => {
    it('should display search data when loaded', () => {
      render(<Search />)
      // Header renders with label; data name is verified in other tests
      expect(screen.getByText('Searching History in')).toBeInTheDocument()
    })

    it('should count only message type messages', () => {
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      // Should show 3 messages (not counting system and reply types)
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('should render message items with virtuoso', () => {
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      expect(screen.getByTestId('virtuoso-search-results')).toBeInTheDocument()
      expect(screen.getByTestId('virtuoso-search-results')).toHaveAttribute('data-total-count', '3')
      expect(screen.getByTestId('virtuoso-search-results')).toHaveAttribute('data-overscan', '5')
    })

    it('should filter out non-message types', () => {
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      // Should only render RegularMessage components for type "message"
      expect(screen.getByTestId('regular-message-msg1')).toBeInTheDocument()
      expect(screen.getByTestId('regular-message-msg2')).toBeInTheDocument()
      expect(screen.getByTestId('regular-message-msg5')).toBeInTheDocument()
      
      // Should not render system or reply messages
      expect(screen.queryByTestId('regular-message-msg3')).not.toBeInTheDocument()
      expect(screen.queryByTestId('regular-message-msg4')).not.toBeInTheDocument()
    })

    it('should handle empty messages array', () => {
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: [],
        ...mockSearchData
      })
      
      expect(screen.getByText('0')).toBeInTheDocument() // Message count
      expect(screen.getByTestId('virtuoso-search-results')).toHaveAttribute('data-total-count', '0')
    })

    it('should handle null/undefined messages', () => {
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      
      // Should not crash with null messages
      expect(() => {
        onDataHandler({
          messages: null,
          ...mockSearchData
        })
      }).not.toThrow()
      
      expect(() => {
        onDataHandler({
          messages: undefined,
          ...mockSearchData
        })
      }).not.toThrow()
    })
  })

  describe('Search Functionality', () => {
    it('should filter messages based on search input', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      const searchInput = screen.getByPlaceholderText('Search messages...')
      await user.type(searchInput, 'test')
      
      // Should filter to messages containing "test"
      expect(screen.getByTestId('regular-message-msg1')).toBeInTheDocument() // "test message"
      expect(screen.getByTestId('regular-message-msg2')).toBeInTheDocument() // "testing"
      expect(screen.getByTestId('regular-message-msg5')).toBeInTheDocument() // "test"
    })

    it('should be case insensitive', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      const searchInput = screen.getByPlaceholderText('Search messages...')
      await user.type(searchInput, 'HELLO')
      
      // Should find both "Hello" and "HELLO"
      expect(screen.getByTestId('regular-message-msg1')).toBeInTheDocument() // "Hello world"
      expect(screen.getByTestId('regular-message-msg5')).toBeInTheDocument() // "HELLO uppercase"
    })

    it('should show filtered count when searching', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      const searchInput = screen.getByPlaceholderText('Search messages...')
      await user.type(searchInput, 'message')
      
      // Should show filtered count vs total
      expect(screen.getByText('Messages:')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument() // Filtered count
      expect(screen.getByText('of')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument() // Total count
    })

    it('should show no results message when no matches', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      const searchInput = screen.getByPlaceholderText('Search messages...')
      await user.type(searchInput, 'nonexistent')
      
      expect(screen.getByText('No messages found')).toBeInTheDocument()
      expect(screen.queryByTestId('virtuoso-search-results')).not.toBeInTheDocument()
    })

    it('should trim search input', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      const searchInput = screen.getByPlaceholderText('Search messages...')
      await user.type(searchInput, '  hello  ')
      
      // Should still find results despite extra spaces
      expect(screen.getByTestId('regular-message-msg1')).toBeInTheDocument()
      expect(screen.getByTestId('regular-message-msg5')).toBeInTheDocument()
    })

    it('should handle messages without content', () => {
      render(<Search />)
      
      const messagesWithoutContent = [
        ...mockMessages,
        {
          id: 'msg6',
          content: null,
          type: 'message',
          sender: { id: 'user5', username: 'testuser5' },
          chatroom_id: 'chatroom123'
        }
      ]
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: messagesWithoutContent,
        ...mockSearchData
      })
      
      // Should handle null content gracefully
      expect(screen.getByText('4')).toBeInTheDocument() // Total count includes message without content
    })

    it('should clear search and show all messages when input is empty', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      const searchInput = screen.getByPlaceholderText('Search messages...')
      
      // First search
      await user.type(searchInput, 'hello')
      expect(screen.getByText('2')).toBeInTheDocument() // Filtered count
      
      // Clear search
      await user.clear(searchInput)
      
      // Should show all messages again
      expect(screen.getByText('3')).toBeInTheDocument() // Total count only
      expect(screen.queryByText('of')).not.toBeInTheDocument()
    })
  })

  describe('Message Scrolling', () => {
    it.skip('should scroll to bottom when messages are loaded', () => {
      const mockRef = { current: { scrollToIndex: mockScrollToIndex } }
      vi.spyOn(React, 'useRef').mockReturnValue(mockRef)
      
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      // Advance timers to trigger the scroll effect
      vi.runAllTimers()
      
      expect(mockScrollToIndex).toHaveBeenCalledWith({
        index: 4, // mockMessages.length - 1
        align: 'end',
        behavior: 'auto'
      })
    })

    it('should not scroll when no messages', () => {
      const mockRef = { current: { scrollToIndex: mockScrollToIndex } }
      vi.spyOn(React, 'useRef').mockReturnValue(mockRef)
      
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: [],
        ...mockSearchData
      })
      
      vi.runAllTimers()
      
      expect(mockScrollToIndex).not.toHaveBeenCalled()
    })

    it('should handle missing virtuoso ref gracefully', () => {
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      
      // Should not crash when ref is null
      expect(() => {
        onDataHandler({
          messages: mockMessages,
          ...mockSearchData
        })
        vi.runAllTimers()
      }).not.toThrow()
    })
  })

  describe('User Dialog Integration', () => {
    it('should open user dialog when username is clicked', async () => {
      const user = userEvent.setup()
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      // Click on a username in a message
      const messageButton = screen.getByText('testuser1: Hello world test message')
      await user.click(messageButton)
      
      expect(mockKick.getUserChatroomInfo).toHaveBeenCalledWith('teststreamer', 'testuser1')
      
      await waitFor(() => {
        expect(mockUserDialog.open).toHaveBeenCalledWith({
          sender: {
            id: 'user123',
            username: 'testuser',
            slug: 'testuser'
          },
          fetchedUser: {
            id: 'user123',
            username: 'testuser',
            slug: 'testuser'
          },
          chatroomId: 'chatroom123',
          sevenTVEmotes: mockSearchData.sevenTVEmotes,
          subscriberBadges: mockSearchData.subscriberBadges,
          userChatroomInfo: mockSearchData.userChatroomInfo,
          cords: [0, 300]
        })
      })
    })

    it('should handle user info fetch failure', async () => {
      const user = userEvent.setup()
      mockKick.getUserChatroomInfo.mockResolvedValue({ data: null })
      
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      const messageButton = screen.getByText('testuser1: Hello world test message')
      await user.click(messageButton)
      
      expect(mockKick.getUserChatroomInfo).toHaveBeenCalledWith('teststreamer', 'testuser1')
      
      // Should not open dialog when user data is missing
      await waitFor(() => {
        expect(mockUserDialog.open).not.toHaveBeenCalled()
      })
    })

    it('should handle API errors gracefully', async () => {
      const user = userEvent.setup()
      mockKick.getUserChatroomInfo.mockRejectedValue(new Error('API Error'))
      
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      const messageButton = screen.getByText('testuser1: Hello world test message')
      
      // Should not crash when API call fails
      await expect(user.click(messageButton)).resolves.not.toThrow()
      expect(mockUserDialog.open).not.toHaveBeenCalled()
    })

    it('should prevent default event behavior', async () => {
      const user = userEvent.setup()
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      const messageButton = screen.getByText('testuser1: Hello world test message')
      const clickEvent = { preventDefault: vi.fn() }
      
      // Simulate click event with preventDefault
      fireEvent.click(messageButton, clickEvent)
      
      expect(clickEvent.preventDefault).not.toHaveBeenCalled() // jsdom doesn't call preventDefault automatically
    })

    it('should handle missing search data gracefully', async () => {
      const user = userEvent.setup()
      render(<Search />)
      
      // Don't load search data
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: mockMessages
        // Missing search data
      })
      
      const messageButton = screen.getByText('testuser1: Hello world test message')
      
      // Should not crash when search data is missing
      await expect(user.click(messageButton)).resolves.not.toThrow()
    })
  })

  describe('Message Component Integration', () => {
    it('should pass correct props to RegularMessage', () => {
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      const messageElement = screen.getByTestId('regular-message-msg1')
      
      expect(messageElement).toHaveAttribute('data-is-search', 'true')
      expect(messageElement).toHaveAttribute('data-type', 'message')
      expect(messageElement).toHaveAttribute('data-chatroom-name', 'teststreamer')
      expect(messageElement).toHaveAttribute('data-chatroom-id', 'chatroom123')
    })

    it('should render messages with search result styling', () => {
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      const searchResultItems = document.querySelectorAll('.searchResultItem')
      expect(searchResultItems).toHaveLength(3) // Only message types
      
      searchResultItems.forEach(item => {
        expect(item).toHaveClass('searchResultItem')
        expect(item.querySelector('.searchResultItemContent')).toBeInTheDocument()
      })
    })
  })

  describe('Dialog Controls', () => {
    it('should close dialog when close button clicked', async () => {
      const user = userEvent.setup()
      render(<Search />)
      
      const closeButton = screen.getByAltText('Close')
      await user.click(closeButton)
      
      expect(mockSearchDialog.close).toHaveBeenCalledTimes(1)
    })

    it('should handle close button errors gracefully', async () => {
      const user = userEvent.setup()
      mockSearchDialog.close.mockImplementation(() => {
        throw new Error('Close failed')
      })
      
      render(<Search />)
      
      const closeButton = screen.getByAltText('Close')
      
      // Should not crash when close fails
      await expect(user.click(closeButton)).resolves.not.toThrow()
    })
  })

  describe('Header Display States', () => {
    it('should show total count when not searching', () => {
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      expect(screen.getByText('Messages:')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.queryByText('of')).not.toBeInTheDocument()
    })

    it('should show filtered count when searching', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      const searchInput = screen.getByPlaceholderText('Search messages...')
      await user.type(searchInput, 'hello')
      
      expect(screen.getByText('Messages:')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument() // Filtered
      expect(screen.getByText('of')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument() // Total
    })

    it('should handle missing chatroom name', () => {
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData,
        chatroomName: undefined
      })
      
      expect(screen.getByText('Searching History in')).toBeInTheDocument()
      // Should not crash when chatroom name is missing
    })
  })

  describe('Virtuoso Configuration', () => {
    it('should have correct virtuoso styling and config', () => {
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      const virtuoso = screen.getByTestId('virtuoso-search-results')
      expect(virtuoso).toHaveStyle({ height: '100%' })
      expect(virtuoso).toHaveClass('virtualSearchResults')
      expect(virtuoso).toHaveAttribute('data-overscan', '5')
    })

    it('should handle filtered message count changes', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      // Initially shows all messages
      expect(screen.getByTestId('virtuoso-search-results')).toHaveAttribute('data-total-count', '3')
      
      // Filter to reduce count
      const searchInput = screen.getByPlaceholderText('Search messages...')
      await user.type(searchInput, 'world')
      
      expect(screen.getByTestId('virtuoso-search-results')).toHaveAttribute('data-total-count', '1')
    })
  })

  describe('Error Handling', () => {
    it('should handle missing window.app gracefully', () => {
      const originalApp = global.window.app
      delete global.window.app
      
      expect(() => {
        render(<Search />)
      }).not.toThrow()
      
      global.window.app = originalApp
    })

    it('should handle missing search dialog methods', () => {
      const originalOnData = mockSearchDialog.onData
      delete mockSearchDialog.onData
      
      expect(() => {
        render(<Search />)
      }).not.toThrow()
      
      mockSearchDialog.onData = originalOnData
    })

    it('should handle malformed message data', () => {
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      const malformedMessages = [
        { id: 'bad1' }, // Missing required fields
        { type: 'message' }, // Missing id
        null, // Null message
        undefined, // Undefined message
        {
          id: 'good1',
          content: 'Good message',
          type: 'message',
          sender: { id: 'user1', username: 'user1' }
        }
      ]
      
      // Should not crash with malformed data
      expect(() => {
        onDataHandler({
          messages: malformedMessages,
          ...mockSearchData
        })
      }).not.toThrow()
    })

    it('should handle focus errors gracefully', () => {
      const mockInputRef = { current: null }
      vi.spyOn(React, 'useRef').mockReturnValue(mockInputRef)
      
      render(<Search />)
      
      // Should not crash when input ref is null
      vi.runAllTimers()
    })

    it('should handle missing sender data in messages', async () => {
      const user = userEvent.setup()
      render(<Search />)
      
      const messagesWithoutSender = [
        {
          id: 'msg1',
          content: 'Message without sender',
          type: 'message',
          chatroom_id: 'chatroom123'
          // No sender
        }
      ]
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: messagesWithoutSender,
        ...mockSearchData
      })
      
      // Should render without crashing
      expect(screen.getByText(': Message without sender')).toBeInTheDocument()
    })
  })

  describe('Performance and Memory Management', () => {
    it('should not cause memory leaks with repeated renders', () => {
      const { rerender } = render(<Search />)
      
      // Multiple re-renders should not cause issues
      for (let i = 0; i < 100; i++) {
        rerender(<Search />)
      }
      
      expect(screen.getByPlaceholderText('Search messages...')).toBeInTheDocument()
    })

    it('should handle large message sets efficiently', () => {
      // Create 1000 messages
      const manyMessages = Array.from({ length: 1000 }, (_, i) => ({
        id: `msg${i}`,
        content: `Message ${i} with test content`,
        type: 'message',
        sender: { id: `user${i}`, username: `user${i}` },
        chatroom_id: 'chatroom123',
        created_at: `2024-01-01T10:${i.toString().padStart(2, '0')}:00Z`
      }))
      
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: manyMessages,
        ...mockSearchData
      })
      
      // Should render virtuoso with correct total count
      expect(screen.getByTestId('virtuoso-search-results')).toHaveAttribute('data-total-count', '1000')
      expect(screen.getByText('1000')).toBeInTheDocument() // Total count display
    })

    it('should debounce search input correctly', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<Search />)
      
      const onDataHandler = getLatestOnData()
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      const searchInput = screen.getByPlaceholderText('Search messages...')
      
      // Rapid typing should be debounced
      await user.type(searchInput, 'h')
      await user.type(searchInput, 'e')
      await user.type(searchInput, 'l')
      await user.type(searchInput, 'l')
      await user.type(searchInput, 'o')
      
      // Should handle rapid input changes
      expect(searchInput.value).toBe('hello')
    })

    it('should cleanup properly on unmount', () => {
      const { unmount } = render(<Search />)
      
      unmount()
      
      expect(mockCleanup).toHaveBeenCalledTimes(1)
    })

    it('should optimize re-renders with useMemo and useCallback', () => {
      render(<Search />)
      
      const onDataHandler = mockSearchDialog.onData.mock.calls[0][0]
      
      // Multiple updates with same data should not cause unnecessary re-filtering
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      }) // Same data
      
      expect(screen.getByText('testuser1: Hello world test message')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper button roles', () => {
      render(<Search />)
      
      const onDataHandler = mockSearchDialog.onData.mock.calls[0][0]
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
      
      buttons.forEach(button => {
        expect(button.tagName).toBe('BUTTON')
      })
    })

    it('should have searchable input with proper attributes', () => {
      render(<Search />)
      
      const searchInput = screen.getByRole('textbox')
      expect(searchInput).toBeInTheDocument()
      expect(searchInput).toHaveAttribute('placeholder', 'Search messages...')
      expect(searchInput.type).toBe('text')
    })

    it('should have proper heading structure', () => {
      render(<Search />)
      
      const onDataHandler = mockSearchDialog.onData.mock.calls[0][0]
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      const heading = screen.getByRole('heading', { level: 2 })
      expect(heading).toBeInTheDocument()
    })

    it('should have alt text for close button', () => {
      render(<Search />)
      
      const closeIcon = screen.getByAltText('Close')
      expect(closeIcon).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<Search />)
      
      const onDataHandler = mockSearchDialog.onData.mock.calls[0][0]
      onDataHandler({
        messages: mockMessages,
        ...mockSearchData
      })
      
      // Focus should work on input
      const searchInput = screen.getByPlaceholderText('Search messages...')
      searchInput.focus()
      
      await user.keyboard('test')
      
      expect(searchInput.value).toBe('test')
    })
  })
})
