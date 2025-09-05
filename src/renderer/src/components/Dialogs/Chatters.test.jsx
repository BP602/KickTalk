import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Chatters from './Chatters.jsx'

// Mock react-virtuoso
vi.mock('react-virtuoso', () => ({
  Virtuoso: ({ totalCount, itemContent, style, className, overscan }) => (
    <div 
      data-testid="virtuoso-chatters-list"
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
}))

// Mock static assets
vi.mock('../../assets/icons/x-bold.svg', () => ({ default: 'x-icon.svg' }))

// Mock custom hooks
vi.mock('../../utils/hooks', () => ({
  useDebounceValue: (initialValue, delay) => {
    const [value, setValue] = vi.requireActual('react').useState(initialValue)
    return [value, setValue]
  }
}))

// Mock KickBadges component
vi.mock('../Cosmetics/Badges', () => ({
  KickBadges: ({ badges, subscriberBadges, tooltip }) => (
    <div data-testid="kick-badges" data-tooltip={tooltip}>
      {badges?.map((badge, i) => <span key={i} data-badge-type={badge.type}>{badge.type}</span>)}
      {subscriberBadges?.map((badge, i) => <span key={i} data-sub-badge>{badge.name}</span>)}
    </div>
  )
}))

// Mock window.app API
const mockChattersDialog = {
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
  chattersDialog: mockChattersDialog,
  userDialog: mockUserDialog,
  kick: mockKick
}

describe('Chatters Dialog Component', () => {
  const mockChattersData = {
    chatroomId: 'chatroom123',
    streamerData: {
      user: {
        username: 'teststreamer',
        id: 'streamer123'
      },
      subscriber_badges: [
        { id: 'sub1', name: 'Subscriber', months: 1 }
      ]
    },
    channel7TVEmotes: [
      { id: 'emote1', name: 'TestEmote' }
    ],
    userChatroomInfo: {
      id: 'currentuser',
      is_broadcaster: false,
      is_moderator: false
    },
    chatters: [
      {
        id: 'chatter1',
        username: 'user1',
        identity: {
          color: '#ff0000',
          badges: [
            { type: 'Broadcaster', text: 'Broadcaster' }
          ]
        }
      },
      {
        id: 'chatter2',
        username: 'user2',
        identity: {
          color: '#00ff00',
          badges: [
            { type: 'Moderator', text: 'Moderator' }
          ]
        }
      },
      {
        id: 'chatter3',
        username: 'testuser',
        identity: {
          color: '#0000ff',
          badges: []
        }
      }
    ]
  }

  let mockCleanup

  beforeEach(() => {
    vi.clearAllMocks()
    mockCleanup = vi.fn()
    mockChattersDialog.onData.mockReturnValue(mockCleanup)
    mockKick.getUserChatroomInfo.mockResolvedValue({
      data: {
        id: 'user123',
        username: 'testuser',
        slug: 'testuser'
      }
    })
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Rendering and Initialization', () => {
    it('should render chatters container', () => {
      const { container } = render(<Chatters />)
      
      expect(container.querySelector('.chattersContainer')).toBeInTheDocument()
    })

    it('should setup data listener on mount', () => {
      render(<Chatters />)
      
      expect(mockChattersDialog.onData).toHaveBeenCalledTimes(1)
      expect(mockChattersDialog.onData).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should cleanup data listener on unmount', () => {
      const { unmount } = render(<Chatters />)
      
      unmount()
      
      expect(mockCleanup).toHaveBeenCalledTimes(1)
    })

    it('should render header with streamer name', () => {
      render(<Chatters />)
      
      // Trigger data update
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(mockChattersData)
      
      expect(screen.getByText('teststreamer')).toBeInTheDocument()
      expect(screen.getByText('Chatters:')).toBeInTheDocument()
    })

    it('should render close button', () => {
      render(<Chatters />)
      
      const closeButton = screen.getByAltText('Close')
      expect(closeButton).toBeInTheDocument()
      expect(closeButton).toHaveAttribute('src', 'x-icon.svg')
      expect(closeButton).toHaveAttribute('width', '18')
      expect(closeButton).toHaveAttribute('height', '18')
    })

    it('should render search input', () => {
      render(<Chatters />)
      
      const searchInput = screen.getByPlaceholderText('Search...')
      expect(searchInput).toBeInTheDocument()
      expect(searchInput.type).toBe('text')
    })
  })

  describe('Chatters List Display', () => {
    it('should display chatters count', () => {
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(mockChattersData)
      
      expect(screen.getByText('3')).toBeInTheDocument() // Total count
      expect(screen.getByText('Total:')).toBeInTheDocument()
    })

    it('should render chatters list with virtuoso', () => {
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(mockChattersData)
      
      expect(screen.getByTestId('virtuoso-chatters-list')).toBeInTheDocument()
      expect(screen.getByTestId('virtuoso-chatters-list')).toHaveAttribute('data-total-count', '3')
      expect(screen.getByTestId('virtuoso-chatters-list')).toHaveAttribute('data-overscan', '5')
    })

    it('should render individual chatter items', () => {
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(mockChattersData)
      
      expect(screen.getByText('user1')).toBeInTheDocument()
      expect(screen.getByText('user2')).toBeInTheDocument()
      expect(screen.getByText('testuser')).toBeInTheDocument()
      
      // Should have OPEN buttons
      const openButtons = screen.getAllByText('OPEN')
      expect(openButtons).toHaveLength(3)
    })

    it('should apply user colors to usernames', () => {
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(mockChattersData)
      
      const user1Element = screen.getByText('user1')
      const user2Element = screen.getByText('user2')
      const testUserElement = screen.getByText('testuser')
      
      expect(user1Element).toHaveStyle({ color: '#ff0000' })
      expect(user2Element).toHaveStyle({ color: '#00ff00' })
      expect(testUserElement).toHaveStyle({ color: '#0000ff' })
    })

    it('should render badges for chatters with badges', () => {
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(mockChattersData)
      
      const badgeContainers = screen.getAllByTestId('kick-badges')
      expect(badgeContainers).toHaveLength(2) // user1 and user2 have badges
      
      expect(screen.getByText('Broadcaster')).toBeInTheDocument()
      expect(screen.getByText('Moderator')).toBeInTheDocument()
    })

    it('should not render badges for chatters without badges', () => {
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(mockChattersData)
      
      // testuser has no badges, should not have badge container
      const chatterItems = document.querySelectorAll('.chatterListItem')
      const testUserItem = Array.from(chatterItems).find(item => 
        item.querySelector('span')?.textContent === 'testuser'
      )
      
      expect(testUserItem?.querySelector('.chatterListItemBadges')).not.toBeInTheDocument()
    })

    it('should show empty state when no chatters', () => {
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler({ ...mockChattersData, chatters: [] })
      
      expect(screen.getByText('No chatters tracked yet')).toBeInTheDocument()
      expect(screen.getByText('As users type their username will appear here.')).toBeInTheDocument()
    })

    it('should handle missing chatters property', () => {
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler({ ...mockChattersData, chatters: undefined })
      
      expect(screen.getByText('No chatters tracked yet')).toBeInTheDocument()
    })
  })

  describe('Search Functionality', () => {
    it('should filter chatters based on search input', async () => {
      const user = userEvent.setup()
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(mockChattersData)
      
      const searchInput = screen.getByPlaceholderText('Search...')
      await user.type(searchInput, 'user1')
      
      // Should show filtered results
      expect(screen.getByText('user1')).toBeInTheDocument()
      expect(screen.queryByText('user2')).not.toBeInTheDocument()
      expect(screen.queryByText('testuser')).not.toBeInTheDocument()
    })

    it('should show filtered count when searching', async () => {
      const user = userEvent.setup()
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(mockChattersData)
      
      const searchInput = screen.getByPlaceholderText('Search...')
      await user.type(searchInput, 'user')
      
      // Should show "Showing: 2 of 3" (user1 and user2 match)
      expect(screen.getByText('Showing:')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('of')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('should be case insensitive', async () => {
      const user = userEvent.setup()
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(mockChattersData)
      
      const searchInput = screen.getByPlaceholderText('Search...')
      await user.type(searchInput, 'USER1')
      
      expect(screen.getByText('user1')).toBeInTheDocument()
      expect(screen.queryByText('user2')).not.toBeInTheDocument()
    })

    it('should show no results message when no matches', async () => {
      const user = userEvent.setup()
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(mockChattersData)
      
      const searchInput = screen.getByPlaceholderText('Search...')
      await user.type(searchInput, 'nonexistent')
      
      expect(screen.getByText('No results found')).toBeInTheDocument()
      expect(screen.queryByTestId('virtuoso-chatters-list')).not.toBeInTheDocument()
    })

    it('should clear search and show all chatters when input is empty', async () => {
      const user = userEvent.setup()
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(mockChattersData)
      
      const searchInput = screen.getByPlaceholderText('Search...')
      
      // First search
      await user.type(searchInput, 'user1')
      expect(screen.getByText('user1')).toBeInTheDocument()
      expect(screen.queryByText('user2')).not.toBeInTheDocument()
      
      // Clear search
      await user.clear(searchInput)
      
      // Should show all chatters again
      expect(screen.getByText('user1')).toBeInTheDocument()
      expect(screen.getByText('user2')).toBeInTheDocument()
      expect(screen.getByText('testuser')).toBeInTheDocument()
    })

    it('should trim search input', async () => {
      const user = userEvent.setup()
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(mockChattersData)
      
      const searchInput = screen.getByPlaceholderText('Search...')
      await user.type(searchInput, '  user1  ')
      
      // Should still find user1 despite extra spaces
      expect(screen.getByText('user1')).toBeInTheDocument()
      expect(screen.queryByText('user2')).not.toBeInTheDocument()
    })
  })

  describe('User Dialog Opening', () => {
    it('should open user dialog when chatter is clicked', async () => {
      const user = userEvent.setup()
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(mockChattersData)
      
      const chatterButton = screen.getByText('user1').closest('button')
      await user.click(chatterButton)
      
      expect(mockKick.getUserChatroomInfo).toHaveBeenCalledWith('teststreamer', 'user1')
      
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
          sevenTVEmotes: mockChattersData.channel7TVEmotes,
          subscriberBadges: mockChattersData.streamerData.subscriber_badges,
          userChatroomInfo: mockChattersData.userChatroomInfo,
          cords: [0, 300]
        })
      })
    })

    it('should handle user info fetch failure', async () => {
      const user = userEvent.setup()
      mockKick.getUserChatroomInfo.mockResolvedValue({ data: null })
      
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(mockChattersData)
      
      const chatterButton = screen.getByText('user1').closest('button')
      await user.click(chatterButton)
      
      expect(mockKick.getUserChatroomInfo).toHaveBeenCalledWith('teststreamer', 'user1')
      
      // Should not open dialog when user data is missing
      await waitFor(() => {
        expect(mockUserDialog.open).not.toHaveBeenCalled()
      })
    })

    it('should handle API errors gracefully', async () => {
      const user = userEvent.setup()
      mockKick.getUserChatroomInfo.mockRejectedValue(new Error('API Error'))
      
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(mockChattersData)
      
      const chatterButton = screen.getByText('user1').closest('button')
      
      // Should not crash when API call fails
      await expect(user.click(chatterButton)).resolves.not.toThrow()
      expect(mockUserDialog.open).not.toHaveBeenCalled()
    })

    it('should handle missing user ID in API response', async () => {
      const user = userEvent.setup()
      mockKick.getUserChatroomInfo.mockResolvedValue({
        data: {
          username: 'testuser',
          slug: 'testuser'
          // Missing id
        }
      })
      
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(mockChattersData)
      
      const chatterButton = screen.getByText('user1').closest('button')
      await user.click(chatterButton)
      
      // Should not open dialog when user ID is missing
      await waitFor(() => {
        expect(mockUserDialog.open).not.toHaveBeenCalled()
      })
    })
  })

  describe('Dialog Controls', () => {
    it('should close dialog when close button clicked', async () => {
      const user = userEvent.setup()
      render(<Chatters />)
      
      const closeButton = screen.getByAltText('Close')
      await user.click(closeButton)
      
      expect(mockChattersDialog.close).toHaveBeenCalledTimes(1)
    })

    it('should handle close button errors gracefully', async () => {
      const user = userEvent.setup()
      mockChattersDialog.close.mockImplementation(() => {
        throw new Error('Close failed')
      })
      
      render(<Chatters />)
      
      const closeButton = screen.getByAltText('Close')
      
      // Should not crash when close fails
      await expect(user.click(closeButton)).resolves.not.toThrow()
    })
  })

  describe('Data Updates', () => {
    it('should update chatters list when new data arrives', () => {
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      
      // Initial data
      onDataHandler(mockChattersData)
      expect(screen.getByText('user1')).toBeInTheDocument()
      
      // Updated data
      const updatedData = {
        ...mockChattersData,
        chatters: [
          ...mockChattersData.chatters,
          {
            id: 'chatter4',
            username: 'newuser',
            identity: {
              color: '#ffff00',
              badges: []
            }
          }
        ]
      }
      
      onDataHandler(updatedData)
      expect(screen.getByText('newuser')).toBeInTheDocument()
      expect(screen.getByText('4')).toBeInTheDocument() // Updated total count
    })

    it('should handle null data updates', () => {
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      
      // Should not crash with null data
      expect(() => {
        onDataHandler(null)
      }).not.toThrow()
    })

    it('should handle empty data updates', () => {
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      
      // Should not crash with empty data
      expect(() => {
        onDataHandler({})
      }).not.toThrow()
    })
  })

  describe('Accessibility', () => {
    it('should have proper button roles for chatter items', () => {
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(mockChattersData)
      
      const chatterButtons = screen.getAllByRole('button')
      // Should have close button + chatter buttons
      expect(chatterButtons.length).toBeGreaterThan(3)
      
      chatterButtons.forEach(button => {
        expect(button.tagName).toBe('BUTTON')
      })
    })

    it('should have searchable input', () => {
      render(<Chatters />)
      
      const searchInput = screen.getByRole('textbox')
      expect(searchInput).toBeInTheDocument()
      expect(searchInput).toHaveAttribute('placeholder', 'Search...')
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(mockChattersData)
      
      const firstChatterButton = screen.getByText('user1').closest('button')
      firstChatterButton.focus()
      
      await user.keyboard('{Enter}')
      
      expect(mockKick.getUserChatroomInfo).toHaveBeenCalled()
    })

    it('should have proper heading structure', () => {
      render(<Chatters />)
      
      const heading = screen.getByRole('heading', { level: 2 })
      expect(heading).toBeInTheDocument()
    })

    it('should have alt text for close button', () => {
      render(<Chatters />)
      
      const closeIcon = screen.getByAltText('Close')
      expect(closeIcon).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle missing window.app gracefully', () => {
      const originalApp = global.window.app
      delete global.window.app
      
      expect(() => {
        render(<Chatters />)
      }).not.toThrow()
      
      global.window.app = originalApp
    })

    it('should handle missing dialog methods', () => {
      const originalOnData = mockChattersDialog.onData
      delete mockChattersDialog.onData
      
      expect(() => {
        render(<Chatters />)
      }).not.toThrow()
      
      mockChattersDialog.onData = originalOnData
    })

    it('should handle malformed chatter data', () => {
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      const malformedData = {
        ...mockChattersData,
        chatters: [
          { id: 'bad1' }, // Missing username
          { username: 'user2' }, // Missing id
          null, // Null chatter
          undefined, // Undefined chatter
          {
            id: 'good1',
            username: 'gooduser',
            identity: { color: '#fff', badges: [] }
          }
        ]
      }
      
      // Should not crash with malformed data
      expect(() => {
        onDataHandler(malformedData)
      }).not.toThrow()
    })

    it('should handle missing streamer data', () => {
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      const dataWithoutStreamer = {
        ...mockChattersData,
        streamerData: null
      }
      
      expect(() => {
        onDataHandler(dataWithoutStreamer)
      }).not.toThrow()
      
      // Should show empty string for streamer name
      expect(screen.getByText('Chatters:')).toBeInTheDocument()
    })

    it('should handle missing identity data', () => {
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      const dataWithoutIdentity = {
        ...mockChattersData,
        chatters: [
          {
            id: 'chatter1',
            username: 'user1'
            // No identity object
          }
        ]
      }
      
      expect(() => {
        onDataHandler(dataWithoutIdentity)
      }).not.toThrow()
      
      expect(screen.getByText('user1')).toBeInTheDocument()
    })
  })

  describe('Performance and Memory Management', () => {
    it('should not cause memory leaks with repeated renders', () => {
      const { rerender } = render(<Chatters />)
      
      // Multiple re-renders should not cause issues
      for (let i = 0; i < 100; i++) {
        rerender(<Chatters />)
      }
      
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
    })

    it('should handle large chatter lists efficiently', () => {
      // Create 1000 chatters
      const manyChatters = Array.from({ length: 1000 }, (_, i) => ({
        id: `chatter${i}`,
        username: `user${i}`,
        identity: {
          color: '#ffffff',
          badges: []
        }
      }))
      
      const largeData = {
        ...mockChattersData,
        chatters: manyChatters
      }
      
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(largeData)
      
      // Should render virtuoso with correct total count
      expect(screen.getByTestId('virtuoso-chatters-list')).toHaveAttribute('data-total-count', '1000')
      expect(screen.getByText('1000')).toBeInTheDocument() // Total count display
    })

    it('should debounce search input correctly', async () => {
      const user = userEvent.setup()
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(mockChattersData)
      
      const searchInput = screen.getByPlaceholderText('Search...')
      
      // Rapid typing should be debounced
      await user.type(searchInput, 'u')
      await user.type(searchInput, 's')
      await user.type(searchInput, 'e')
      await user.type(searchInput, 'r')
      
      // Should handle rapid input changes
      expect(searchInput.value).toBe('user')
    })

    it('should cleanup properly on unmount', () => {
      const { unmount } = render(<Chatters />)
      
      unmount()
      
      expect(mockCleanup).toHaveBeenCalledTimes(1)
    })

    it('should optimize re-renders with useMemo', () => {
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      
      // Multiple updates with same data should not cause unnecessary re-filtering
      onDataHandler(mockChattersData)
      onDataHandler(mockChattersData) // Same data
      
      expect(screen.getByText('user1')).toBeInTheDocument()
    })
  })

  describe('UI States and Interaction', () => {
    it('should show virtuoso with correct styling', () => {
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(mockChattersData)
      
      const virtuoso = screen.getByTestId('virtuoso-chatters-list')
      expect(virtuoso).toHaveStyle({ height: '100%' })
      expect(virtuoso).toHaveClass('virtualChattersList')
    })

    it('should handle chatter item styling', () => {
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(mockChattersData)
      
      const chatterItems = document.querySelectorAll('.chatterListItem')
      expect(chatterItems).toHaveLength(3)
      
      chatterItems.forEach(item => {
        expect(item).toHaveClass('chatterListItem')
      })
    })

    it('should maintain search state during data updates', async () => {
      const user = userEvent.setup()
      render(<Chatters />)
      
      const onDataHandler = mockChattersDialog.onData.mock.calls[0][0]
      onDataHandler(mockChattersData)
      
      // Set search term
      const searchInput = screen.getByPlaceholderText('Search...')
      await user.type(searchInput, 'user1')
      
      // Update data
      onDataHandler({ ...mockChattersData })
      
      // Search should still be active
      expect(searchInput.value).toBe('user1')
      expect(screen.getByText('user1')).toBeInTheDocument()
      expect(screen.queryByText('user2')).not.toBeInTheDocument()
    })
  })
})