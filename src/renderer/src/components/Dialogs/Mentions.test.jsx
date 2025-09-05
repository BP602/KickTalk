import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Mentions from './Mentions.jsx'

// Mock SCSS imports
vi.mock('../../assets/styles/dialogs/mentions.scss', () => ({}))

// Mock static assets
vi.mock('../../assets/icons/trash-fill.svg?asset', () => ({ default: 'trash-icon.svg' }))
vi.mock('../../assets/icons/caret-down-fill.svg?asset', () => ({ default: 'caret-down.svg' }))
vi.mock('../../assets/icons/arrow-up-right-bold.svg?asset', () => ({ default: 'arrow-up-right.svg' }))
vi.mock('../../assets/images/NOWWHAT.avif?asset', () => ({ default: 'nowwhat.avif' }))

// Mock external libraries
vi.mock('dayjs', () => {
  const mockDayjs = vi.fn((date) => ({
    format: vi.fn((format) => {
      if (format === 'HH:mm A') return '14:30 PM'
      return '14:30'
    }),
    fromNow: vi.fn(() => '2 hours ago')
  }))
  mockDayjs.extend = vi.fn()
  return { default: mockDayjs }
})

vi.mock('dayjs/plugin/relativeTime', () => ({ default: vi.fn() }))

// Mock clsx
vi.mock('clsx', () => ({
  default: (...classes) => classes.filter(Boolean).join(' ')
}))

// Mock ChatProvider
const mockChatStore = {
  mentions: [
    {
      id: 'mention1',
      type: 'mention',
      chatroomId: 'chatroom1',
      chatroomInfo: {
        displayName: 'TestStreamer',
        streamerUsername: 'teststreamer',
        slug: 'teststreamer'
      },
      message: {
        id: 'msg1',
        content: 'Hello @username!',
        sender: {
          username: 'user1',
          identity: {
            color: '#ff0000',
            badges: [
              { type: 'Moderator', text: 'Moderator' }
            ]
          }
        }
      },
      timestamp: Date.now() - 3600000, // 1 hour ago
      isRead: false
    },
    {
      id: 'mention2',
      type: 'highlight',
      chatroomId: 'chatroom2',
      chatroomInfo: {
        displayName: 'AnotherStreamer',
        streamerUsername: 'anotherstreamer',
        slug: 'anotherstreamer'
      },
      message: {
        id: 'msg2',
        content: 'This is a highlight phrase test',
        sender: {
          username: 'user2',
          identity: {
            color: '#00ff00',
            badges: [
              { type: 'Subscriber', text: 'Subscriber' }
            ]
          }
        }
      },
      timestamp: Date.now() - 7200000, // 2 hours ago
      isRead: true
    },
    {
      id: 'mention3',
      type: 'mention',
      chatroomId: 'chatroom1',
      chatroomInfo: {
        displayName: 'TestStreamer',
        streamerUsername: 'teststreamer',
        slug: 'teststreamer'
      },
      message: {
        id: 'msg3',
        content: 'Another mention here @username',
        sender: {
          username: 'user3',
          identity: {
            color: '#0000ff',
            badges: []
          }
        }
      },
      timestamp: Date.now() - 1800000, // 30 minutes ago
      isRead: false
    }
  ],
  chatrooms: [
    {
      id: 'chatroom1',
      displayName: 'TestStreamer',
      username: 'teststreamer',
      slug: 'teststreamer'
    },
    {
      id: 'chatroom2',
      displayName: 'AnotherStreamer',
      username: 'anotherstreamer',
      slug: 'anotherstreamer'
    },
    {
      id: 'chatroom3',
      displayName: null,
      username: 'thirdstreamer',
      slug: 'thirdstreamer'
    }
  ],
  getAllMentions: vi.fn(() => mockChatStore.mentions),
  getChatroomMentions: vi.fn((chatroomId) => 
    mockChatStore.mentions.filter(m => m.chatroomId === chatroomId)
  ),
  getUnreadMentionCount: vi.fn(() => 
    mockChatStore.mentions.filter(m => !m.isRead).length
  ),
  getChatroomUnreadMentionCount: vi.fn((chatroomId) => 
    mockChatStore.mentions.filter(m => m.chatroomId === chatroomId && !m.isRead).length
  ),
  markAllMentionsAsRead: vi.fn(),
  markChatroomMentionsAsRead: vi.fn(),
  clearAllMentions: vi.fn(),
  clearChatroomMentions: vi.fn()
}

vi.mock('../../providers/ChatProvider', () => ({
  default: (selector) => selector(mockChatStore)
}))

vi.mock('zustand/shallow', () => ({
  useShallow: (selector) => selector
}))

// Mock child components
vi.mock('../Shared/Dropdown', () => ({
  DropdownMenu: ({ children }) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuContent: ({ children }) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }) => (
    <button data-testid="dropdown-item" onClick={onClick} className={className}>
      {children}
    </button>
  ),
  DropdownMenuTrigger: ({ children, asChild }) => (
    asChild ? children : <div data-testid="dropdown-trigger">{children}</div>
  )
}))

vi.mock('../../utils/MessageParser', () => ({
  MessageParser: ({ message, type, chatroomId, chatroomName }) => (
    <div data-testid="message-parser" data-type={type} data-chatroom-id={chatroomId} data-chatroom-name={chatroomName}>
      {message?.content || 'Parsed message content'}
    </div>
  )
}))

vi.mock('../Cosmetics/Badges', () => ({
  KickBadges: ({ badges }) => (
    <div data-testid="kick-badges">
      {badges?.map((badge, i) => (
        <span key={i} data-badge-type={badge.type}>{badge.text}</span>
      ))}
    </div>
  )
}))

describe('Mentions Component', () => {
  const mockSetActiveChatroom = vi.fn()
  const mockChatroomId = 'chatroom1'

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock functions
    Object.keys(mockChatStore).forEach(key => {
      if (typeof mockChatStore[key] === 'function') {
        mockChatStore[key].mockClear?.()
      }
    })
    
    // Reset return values
    mockChatStore.getAllMentions.mockReturnValue(mockChatStore.mentions)
    mockChatStore.getChatroomMentions.mockImplementation((chatroomId) => 
      mockChatStore.mentions.filter(m => m.chatroomId === chatroomId)
    )
    mockChatStore.getUnreadMentionCount.mockReturnValue(
      mockChatStore.mentions.filter(m => !m.isRead).length
    )
    mockChatStore.getChatroomUnreadMentionCount.mockImplementation((chatroomId) => 
      mockChatStore.mentions.filter(m => m.chatroomId === chatroomId && !m.isRead).length
    )
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Rendering and Initial State', () => {
    it('should render mentions dialog', () => {
      const { container } = render(
        <Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />
      )
      
      expect(container.querySelector('.mentionsDialog')).toBeInTheDocument()
    })

    it('should render header with title', () => {
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      expect(screen.getByText('All Mentions')).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('All Mentions')
    })

    it('should render clear all button when mentions exist', () => {
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      expect(screen.getByText('Clear all')).toBeInTheDocument()
      expect(screen.getByAltText('Clear all')).toBeInTheDocument()
    })

    it('should not render clear all button when no mentions', () => {
      mockChatStore.getAllMentions.mockReturnValue([])
      
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      expect(screen.queryByText('Clear all')).not.toBeInTheDocument()
    })

    it('should render filter dropdown', () => {
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      expect(screen.getByTestId('dropdown-menu')).toBeInTheDocument()
      expect(screen.getByText('All Chatrooms')).toBeInTheDocument()
    })

    it('should start with "all" chatroom filter selected', () => {
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      expect(screen.getByText('All Chatrooms')).toBeInTheDocument()
    })
  })

  describe('Mentions Display', () => {
    it('should display all mentions when filter is "all"', () => {
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      expect(screen.getByText('Hello @username!')).toBeInTheDocument()
      expect(screen.getByText('This is a highlight phrase test')).toBeInTheDocument()
      expect(screen.getByText('Another mention here @username')).toBeInTheDocument()
    })

    it('should display correct mention metadata', () => {
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      expect(screen.getByText('mention')).toBeInTheDocument()
      expect(screen.getByText('highlight')).toBeInTheDocument()
      expect(screen.getByText('#TestStreamer')).toBeInTheDocument()
      expect(screen.getByText('#AnotherStreamer')).toBeInTheDocument()
    })

    it('should display timestamps', () => {
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      const timestamps = screen.getAllByText('14:30 PM')
      expect(timestamps.length).toBeGreaterThan(0)
    })

    it('should display sender usernames with colors', () => {
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      expect(screen.getByText('user1:')).toBeInTheDocument()
      expect(screen.getByText('user2:')).toBeInTheDocument()
      expect(screen.getByText('user3:')).toBeInTheDocument()
      
      const user1Element = screen.getByText('user1:')
      expect(user1Element).toHaveStyle({ color: '#ff0000' })
    })

    it('should display badges for users with badges', () => {
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      const badgeContainers = screen.getAllByTestId('kick-badges')
      expect(badgeContainers.length).toBeGreaterThan(0)
      
      expect(screen.getByText('Moderator')).toBeInTheDocument()
      expect(screen.getByText('Subscriber')).toBeInTheDocument()
    })

    it('should not display badges for users without badges', () => {
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      // user3 has no badges, should not render badge container for them
      const badgeContainers = screen.getAllByTestId('kick-badges')
      expect(badgeContainers.length).toBe(2) // Only user1 and user2 have badges
    })

    it('should render message parser for each mention', () => {
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      const messageParsers = screen.getAllByTestId('message-parser')
      expect(messageParsers).toHaveLength(3)
      
      expect(messageParsers[0]).toHaveAttribute('data-type', 'minified')
      expect(messageParsers[0]).toHaveAttribute('data-chatroom-name', 'teststreamer')
    })

    it('should show unread indicators', () => {
      const { container } = render(
        <Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />
      )
      
      const unreadItems = container.querySelectorAll('.mentionItem.unread')
      expect(unreadItems).toHaveLength(2) // mention1 and mention3 are unread
    })

    it('should render go to channel buttons', () => {
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      const goToChannelButtons = screen.getAllByTitle('Go to channel')
      expect(goToChannelButtons).toHaveLength(3)
      
      goToChannelButtons.forEach(button => {
        expect(button).toHaveAttribute('title', 'Go to channel')
      })
    })
  })

  describe('Empty States', () => {
    it('should show empty state when no mentions', () => {
      mockChatStore.getAllMentions.mockReturnValue([])
      
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      expect(screen.getByText('No Mentions...')).toBeInTheDocument()
      expect(screen.getByAltText('No mentions')).toBeInTheDocument()
    })

    it('should show empty state for specific chatroom when no mentions', () => {
      mockChatStore.getChatroomMentions.mockReturnValue([])
      
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      // Switch to specific chatroom filter
      const dropdownTrigger = screen.getByTestId('dropdown-trigger')
      fireEvent.click(dropdownTrigger)
      
      const chatroomOption = screen.getByText('TestStreamer')
      fireEvent.click(chatroomOption)
      
      expect(screen.getByText('No mentions in this chatroom...')).toBeInTheDocument()
    })

    it('should show correct empty state image', () => {
      mockChatStore.getAllMentions.mockReturnValue([])
      
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      const emptyStateImage = screen.getByAltText('No mentions')
      expect(emptyStateImage).toHaveAttribute('src', 'nowwhat.avif')
    })
  })

  describe('Filtering Functionality', () => {
    it('should render dropdown with all chatroom options', () => {
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      const dropdownTrigger = screen.getByTestId('dropdown-trigger')
      fireEvent.click(dropdownTrigger)
      
      expect(screen.getByText('All Chatrooms')).toBeInTheDocument()
      expect(screen.getByText('TestStreamer')).toBeInTheDocument()
      expect(screen.getByText('AnotherStreamer')).toBeInTheDocument()
      expect(screen.getByText('thirdstreamer')).toBeInTheDocument() // Uses username when displayName is null
    })

    it('should filter mentions by selected chatroom', async () => {
      const user = userEvent.setup()
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      const dropdownTrigger = screen.getByTestId('dropdown-trigger')
      await user.click(dropdownTrigger)
      
      const chatroomOption = screen.getByText('TestStreamer')
      await user.click(chatroomOption)
      
      // Should only show mentions from chatroom1
      expect(mockChatStore.getChatroomMentions).toHaveBeenCalledWith('chatroom1')
      expect(screen.getByText('Hello @username!')).toBeInTheDocument()
      expect(screen.getByText('Another mention here @username')).toBeInTheDocument()
      expect(screen.queryByText('This is a highlight phrase test')).not.toBeInTheDocument()
    })

    it('should update filter button text when chatroom selected', async () => {
      const user = userEvent.setup()
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      const dropdownTrigger = screen.getByTestId('dropdown-trigger')
      await user.click(dropdownTrigger)
      
      const chatroomOption = screen.getByText('AnotherStreamer')
      await user.click(chatroomOption)
      
      expect(screen.getByText('AnotherStreamer')).toBeInTheDocument()
    })

    it('should return to all mentions when "All Chatrooms" selected', async () => {
      const user = userEvent.setup()
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      // First select a specific chatroom
      const dropdownTrigger = screen.getByTestId('dropdown-trigger')
      await user.click(dropdownTrigger)
      
      const chatroomOption = screen.getByText('TestStreamer')
      await user.click(chatroomOption)
      
      // Then select all chatrooms again
      await user.click(dropdownTrigger)
      
      const allOption = screen.getAllByText('All Chatrooms')[1] // Second one is in dropdown
      await user.click(allOption)
      
      expect(mockChatStore.getAllMentions).toHaveBeenCalled()
      expect(screen.getByText('Hello @username!')).toBeInTheDocument()
      expect(screen.getByText('This is a highlight phrase test')).toBeInTheDocument()
    })

    it('should handle chatrooms with null display names', async () => {
      const user = userEvent.setup()
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      const dropdownTrigger = screen.getByTestId('dropdown-trigger')
      await user.click(dropdownTrigger)
      
      // Should show username when displayName is null
      expect(screen.getByText('thirdstreamer')).toBeInTheDocument()
      
      const chatroomOption = screen.getByText('thirdstreamer')
      await user.click(chatroomOption)
      
      expect(screen.getByText('thirdstreamer')).toBeInTheDocument()
    })

    it('should render dropdown caret icon', () => {
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      const caretIcon = screen.getByAltText('arrow down icon')
      expect(caretIcon).toHaveAttribute('src', 'caret-down.svg')
      expect(caretIcon).toHaveAttribute('width', '16')
      expect(caretIcon).toHaveAttribute('height', '16')
    })
  })

  describe('User Interactions', () => {
    it('should clear all mentions when clear all button clicked', async () => {
      const user = userEvent.setup()
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      const clearAllButton = screen.getByText('Clear all')
      await user.click(clearAllButton)
      
      expect(mockChatStore.clearAllMentions).toHaveBeenCalledTimes(1)
    })

    it('should clear chatroom mentions when clear all button clicked with chatroom filter', async () => {
      const user = userEvent.setup()
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      // First select a specific chatroom
      const dropdownTrigger = screen.getByTestId('dropdown-trigger')
      await user.click(dropdownTrigger)
      
      const chatroomOption = screen.getByText('TestStreamer')
      await user.click(chatroomOption)
      
      // Then clear mentions
      const clearAllButton = screen.getByText('Clear all')
      await user.click(clearAllButton)
      
      expect(mockChatStore.clearChatroomMentions).toHaveBeenCalledWith('chatroom1')
    })

    it('should navigate to chatroom when go to channel button clicked', async () => {
      const user = userEvent.setup()
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      const goToChannelButtons = screen.getAllByTitle('Go to channel')
      await user.click(goToChannelButtons[0])
      
      expect(mockSetActiveChatroom).toHaveBeenCalledWith('chatroom1')
    })

    it('should navigate to correct chatroom for each mention', async () => {
      const user = userEvent.setup()
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      const goToChannelButtons = screen.getAllByTitle('Go to channel')
      
      // First mention is from chatroom1
      await user.click(goToChannelButtons[0])
      expect(mockSetActiveChatroom).toHaveBeenCalledWith('chatroom1')
      
      // Second mention is from chatroom2
      await user.click(goToChannelButtons[1])
      expect(mockSetActiveChatroom).toHaveBeenCalledWith('chatroom2')
      
      // Third mention is from chatroom1
      await user.click(goToChannelButtons[2])
      expect(mockSetActiveChatroom).toHaveBeenCalledWith('chatroom1')
    })

    it('should handle multiple rapid clear all clicks', async () => {
      const user = userEvent.setup({ delay: null })
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      const clearAllButton = screen.getByText('Clear all')
      
      // Rapid clicks
      await user.click(clearAllButton)
      await user.click(clearAllButton)
      await user.click(clearAllButton)
      
      expect(mockChatStore.clearAllMentions).toHaveBeenCalledTimes(3)
    })

    it('should handle multiple rapid filter changes', async () => {
      const user = userEvent.setup({ delay: null })
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      const dropdownTrigger = screen.getByTestId('dropdown-trigger')
      
      // Rapid filter changes
      for (let i = 0; i < 5; i++) {
        await user.click(dropdownTrigger)
        const chatroomOption = screen.getByText('TestStreamer')
        await user.click(chatroomOption)
        
        await user.click(dropdownTrigger)
        const allOption = screen.getAllByText('All Chatrooms')[1]
        await user.click(allOption)
      }
      
      expect(mockChatStore.getAllMentions).toHaveBeenCalledTimes(6) // Initial + 5 filter changes
    })
  })

  describe('Data Updates and Reactivity', () => {
    it('should update mentions when mentions data changes', () => {
      const { rerender } = render(
        <Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />
      )
      
      expect(screen.getByText('Hello @username!')).toBeInTheDocument()
      
      // Update mentions data
      const newMentions = [
        {
          id: 'mention4',
          type: 'mention',
          chatroomId: 'chatroom1',
          chatroomInfo: {
            displayName: 'NewStreamer',
            streamerUsername: 'newstreamer',
            slug: 'newstreamer'
          },
          message: {
            id: 'msg4',
            content: 'New mention content',
            sender: {
              username: 'newuser',
              identity: {
                color: '#purple',
                badges: []
              }
            }
          },
          timestamp: Date.now(),
          isRead: false
        }
      ]
      
      mockChatStore.getAllMentions.mockReturnValue(newMentions)
      
      rerender(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      expect(screen.getByText('New mention content')).toBeInTheDocument()
      expect(screen.queryByText('Hello @username!')).not.toBeInTheDocument()
    })

    it('should update filtered mentions when filter changes', async () => {
      const user = userEvent.setup()
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      // Initially shows all mentions
      expect(screen.getByText('Hello @username!')).toBeInTheDocument()
      expect(screen.getByText('This is a highlight phrase test')).toBeInTheDocument()
      
      // Filter to specific chatroom
      const dropdownTrigger = screen.getByTestId('dropdown-trigger')
      await user.click(dropdownTrigger)
      
      const chatroomOption = screen.getByText('TestStreamer')
      await user.click(chatroomOption)
      
      // Should only show mentions from selected chatroom
      expect(screen.getByText('Hello @username!')).toBeInTheDocument()
      expect(screen.queryByText('This is a highlight phrase test')).not.toBeInTheDocument()
    })

    it('should handle empty mentions array gracefully', () => {
      mockChatStore.getAllMentions.mockReturnValue([])
      
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      expect(screen.getByText('No Mentions...')).toBeInTheDocument()
      expect(screen.queryByText('Clear all')).not.toBeInTheDocument()
    })

    it('should handle null mentions gracefully', () => {
      mockChatStore.getAllMentions.mockReturnValue(null)
      
      expect(() => {
        render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      }).not.toThrow()
    })

    it('should handle undefined mentions gracefully', () => {
      mockChatStore.getAllMentions.mockReturnValue(undefined)
      
      expect(() => {
        render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      }).not.toThrow()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle mentions with missing chatroomInfo', () => {
      const mentionsWithMissingInfo = [
        {
          id: 'mention1',
          type: 'mention',
          chatroomId: 'chatroom1',
          chatroomInfo: null,
          message: {
            id: 'msg1',
            content: 'Hello @username!',
            sender: {
              username: 'user1',
              identity: { color: '#ff0000', badges: [] }
            }
          },
          timestamp: Date.now(),
          isRead: false
        }
      ]
      
      mockChatStore.getAllMentions.mockReturnValue(mentionsWithMissingInfo)
      
      expect(() => {
        render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      }).not.toThrow()
    })

    it('should handle mentions with missing message data', () => {
      const mentionsWithMissingMessage = [
        {
          id: 'mention1',
          type: 'mention',
          chatroomId: 'chatroom1',
          chatroomInfo: {
            displayName: 'TestStreamer',
            streamerUsername: 'teststreamer',
            slug: 'teststreamer'
          },
          message: null,
          timestamp: Date.now(),
          isRead: false
        }
      ]
      
      mockChatStore.getAllMentions.mockReturnValue(mentionsWithMissingMessage)
      
      expect(() => {
        render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      }).not.toThrow()
    })

    it('should handle mentions with missing sender data', () => {
      const mentionsWithMissingSender = [
        {
          id: 'mention1',
          type: 'mention',
          chatroomId: 'chatroom1',
          chatroomInfo: {
            displayName: 'TestStreamer',
            streamerUsername: 'teststreamer',
            slug: 'teststreamer'
          },
          message: {
            id: 'msg1',
            content: 'Hello @username!',
            sender: null
          },
          timestamp: Date.now(),
          isRead: false
        }
      ]
      
      mockChatStore.getAllMentions.mockReturnValue(mentionsWithMissingSender)
      
      expect(() => {
        render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      }).not.toThrow()
    })

    it('should handle malformed mention objects', () => {
      const malformedMentions = [
        null,
        undefined,
        {},
        { id: 'partial' },
        'not an object',
        123
      ]
      
      mockChatStore.getAllMentions.mockReturnValue(malformedMentions)
      
      expect(() => {
        render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      }).not.toThrow()
    })

    it('should handle missing props gracefully', () => {
      expect(() => {
        render(<Mentions />)
      }).not.toThrow()
    })

    it('should handle null setActiveChatroom prop', () => {
      expect(() => {
        render(<Mentions setActiveChatroom={null} chatroomId={mockChatroomId} />)
      }).not.toThrow()
    })

    it('should handle empty chatrooms array', () => {
      mockChatStore.chatrooms = []
      
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      const dropdownTrigger = screen.getByTestId('dropdown-trigger')
      fireEvent.click(dropdownTrigger)
      
      expect(screen.getByText('All Chatrooms')).toBeInTheDocument()
    })

    it('should handle null chatrooms array', () => {
      mockChatStore.chatrooms = null
      
      expect(() => {
        render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      }).not.toThrow()
    })
  })

  describe('Store Integration', () => {
    it('should call getAllMentions when filter is "all"', () => {
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      expect(mockChatStore.getAllMentions).toHaveBeenCalled()
    })

    it('should call getChatroomMentions when specific chatroom selected', async () => {
      const user = userEvent.setup()
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      const dropdownTrigger = screen.getByTestId('dropdown-trigger')
      await user.click(dropdownTrigger)
      
      const chatroomOption = screen.getByText('TestStreamer')
      await user.click(chatroomOption)
      
      expect(mockChatStore.getChatroomMentions).toHaveBeenCalledWith('chatroom1')
    })

    it('should call getUnreadMentionCount when filter is "all"', () => {
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      expect(mockChatStore.getUnreadMentionCount).toHaveBeenCalled()
    })

    it('should call getChatroomUnreadMentionCount when specific chatroom selected', async () => {
      const user = userEvent.setup()
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      const dropdownTrigger = screen.getByTestId('dropdown-trigger')
      await user.click(dropdownTrigger)
      
      const chatroomOption = screen.getByText('TestStreamer')
      await user.click(chatroomOption)
      
      expect(mockChatStore.getChatroomUnreadMentionCount).toHaveBeenCalledWith('chatroom1')
    })

    it('should call clearAllMentions when clearing all mentions', async () => {
      const user = userEvent.setup()
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      const clearAllButton = screen.getByText('Clear all')
      await user.click(clearAllButton)
      
      expect(mockChatStore.clearAllMentions).toHaveBeenCalledTimes(1)
    })

    it('should call clearChatroomMentions when clearing chatroom mentions', async () => {
      const user = userEvent.setup()
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      // First select a specific chatroom
      const dropdownTrigger = screen.getByTestId('dropdown-trigger')
      await user.click(dropdownTrigger)
      
      const chatroomOption = screen.getByText('TestStreamer')
      await user.click(chatroomOption)
      
      // Then clear mentions
      const clearAllButton = screen.getByText('Clear all')
      await user.click(clearAllButton)
      
      expect(mockChatStore.clearChatroomMentions).toHaveBeenCalledWith('chatroom1')
    })

    it('should handle store method errors gracefully', async () => {
      const user = userEvent.setup()
      
      mockChatStore.clearAllMentions.mockImplementation(() => {
        throw new Error('Clear failed')
      })
      
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      const clearAllButton = screen.getByText('Clear all')
      
      // Should not crash when store method throws
      await expect(user.click(clearAllButton)).resolves.not.toThrow()
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('All Mentions')
    })

    it('should have proper button roles', () => {
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
      
      buttons.forEach(button => {
        expect(button.tagName).toBe('BUTTON')
      })
    })

    it('should have descriptive button titles', () => {
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      expect(screen.getByTitle('Clear all mentions')).toBeInTheDocument()
      
      const goToChannelButtons = screen.getAllByTitle('Go to channel')
      expect(goToChannelButtons.length).toBeGreaterThan(0)
    })

    it('should have alt text for images', () => {
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      expect(screen.getByAltText('Clear all')).toBeInTheDocument()
      expect(screen.getByAltText('arrow down icon')).toBeInTheDocument()
      
      const goToChannelImages = screen.getAllByAltText('Go to channel')
      expect(goToChannelImages.length).toBeGreaterThan(0)
    })

    it('should have alt text for empty state image', () => {
      mockChatStore.getAllMentions.mockReturnValue([])
      
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      expect(screen.getByAltText('No mentions')).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      const clearAllButton = screen.getByText('Clear all')
      clearAllButton.focus()
      
      await user.keyboard('{Enter}')
      
      expect(mockChatStore.clearAllMentions).toHaveBeenCalled()
    })

    it('should have semantic HTML structure', () => {
      const { container } = render(
        <Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />
      )
      
      expect(container.querySelector('.mentionsDialog')).toBeInTheDocument()
      expect(container.querySelector('.mentionsHeader')).toBeInTheDocument()
      expect(container.querySelector('.mentionsContent')).toBeInTheDocument()
      expect(container.querySelector('.mentionsList')).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('should render quickly with many mentions', () => {
      const manyMentions = Array.from({ length: 1000 }, (_, i) => ({
        id: `mention${i}`,
        type: 'mention',
        chatroomId: 'chatroom1',
        chatroomInfo: {
          displayName: 'TestStreamer',
          streamerUsername: 'teststreamer',
          slug: 'teststreamer'
        },
        message: {
          id: `msg${i}`,
          content: `Message ${i}`,
          sender: {
            username: `user${i}`,
            identity: {
              color: '#ff0000',
              badges: []
            }
          }
        },
        timestamp: Date.now() - i * 1000,
        isRead: i % 2 === 0
      }))
      
      mockChatStore.getAllMentions.mockReturnValue(manyMentions)
      
      const start = performance.now()
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      const end = performance.now()
      
      expect(end - start).toBeLessThan(1000) // Should render within 1 second
    })

    it('should not cause memory leaks with repeated renders', () => {
      const { rerender } = render(
        <Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />
      )
      
      // Multiple re-renders should not cause issues
      for (let i = 0; i < 100; i++) {
        rerender(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      }
      
      expect(screen.getByText('All Mentions')).toBeInTheDocument()
    })

    it('should handle rapid filter changes efficiently', async () => {
      const user = userEvent.setup({ delay: null })
      render(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      const start = performance.now()
      
      // Rapid filter changes
      for (let i = 0; i < 10; i++) {
        const dropdownTrigger = screen.getByTestId('dropdown-trigger')
        await user.click(dropdownTrigger)
        
        const chatroomOption = screen.getByText('TestStreamer')
        await user.click(chatroomOption)
        
        await user.click(dropdownTrigger)
        
        const allOption = screen.getAllByText('All Chatrooms')[1]
        await user.click(allOption)
      }
      
      const end = performance.now()
      
      expect(end - start).toBeLessThan(2000) // Should complete within 2 seconds
    })

    it('should memoize filtered mentions correctly', () => {
      const { rerender } = render(
        <Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />
      )
      
      const initialCallCount = mockChatStore.getAllMentions.mock.calls.length
      
      // Re-render with same props should not recalculate
      rerender(<Mentions setActiveChatroom={mockSetActiveChatroom} chatroomId={mockChatroomId} />)
      
      // Calls should be memoized (useMemo dependency array hasn't changed)
      expect(mockChatStore.getAllMentions.mock.calls.length).toBe(initialCallCount)
    })
  })
})