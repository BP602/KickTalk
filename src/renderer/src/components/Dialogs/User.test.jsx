import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import User from './User.jsx'

// Mock SCSS imports
vi.mock('../../assets/styles/dialogs/UserDialog.scss', () => ({}))

// Mock static assets
vi.mock('../../assets/icons/push-pin-fill.svg?asset', () => ({ default: 'pin-icon.svg' }))
vi.mock('../../assets/icons/arrow-up-right-bold.svg?asset', () => ({ default: 'arrow-icon.svg' }))
vi.mock('../../assets/icons/copy-simple-fill.svg?asset', () => ({ default: 'copy-icon.svg' }))
vi.mock('../../assets/icons/gavel-fill.svg?asset', () => ({ default: 'ban-icon.svg' }))
vi.mock('../../assets/icons/circle-slash.svg?asset', () => ({ default: 'unban-icon.svg' }))
vi.mock('../../assets/icons/check-bold.svg?asset', () => ({ default: 'check-icon.svg' }))

// Mock utilities
vi.mock('@utils/kickTalkBadges', () => ({
  userKickTalkBadges: [
    { username: 'testuser', badges: [{ type: 'Founder', title: 'KickTalk Founder' }] }
  ]
}))

// Mock clsx
vi.mock('clsx', () => ({
  default: (...args) => args.filter(Boolean).join(' ')
}))

// Mock Message component
vi.mock('../Messages/Message', () => ({
  default: ({ message, chatroomId, type }) => (
    <div data-testid={`message-${message.id}`} data-type={type} data-chatroom-id={chatroomId}>
      {message.sender?.username}: {message.content}
    </div>
  )
}))

// Mock Badge components
vi.mock('../Cosmetics/Badges', () => ({
  KickBadges: ({ badges, subscriberBadges, tooltip, className }) => (
    <div data-testid="kick-badges" data-tooltip={tooltip} className={className}>
      {badges?.map((badge, i) => <span key={i}>{badge.type}</span>)}
      {subscriberBadges?.map((badge, i) => <span key={i}>{badge.name}</span>)}
    </div>
  ),
  KickTalkBadges: ({ badges, className }) => (
    <div data-testid="kicktalk-badges" className={className}>
      {badges?.map((badge, i) => <span key={i}>{badge.type}</span>)}
    </div>
  ),
  StvBadges: ({ badge, tooltip, className }) => (
    <div data-testid="stv-badges" data-tooltip={tooltip} className={className}>
      {badge?.name}
    </div>
  )
}))

// Mock Tooltip components
vi.mock('../Shared/Tooltip', () => ({
  Tooltip: ({ children, delayDuration }) => (
    <div data-testid="tooltip" data-delay={delayDuration}>{children}</div>
  ),
  TooltipContent: ({ children }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipProvider: ({ children }) => (
    <div data-testid="tooltip-provider">{children}</div>
  ),
  TooltipTrigger: ({ children, asChild }) => (
    <div data-testid="tooltip-trigger" data-as-child={asChild}>{children}</div>
  )
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

// Mock clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined)
  }
})

// Mock window.open
global.window.open = vi.fn()

// Mock window.app API
const mockUserDialog = {
  onData: vi.fn(() => vi.fn()), // Returns cleanup function
  pin: vi.fn()
}

const mockLogs = {
  get: vi.fn().mockResolvedValue([]),
  onUpdate: vi.fn(() => vi.fn()) // Returns cleanup function
}

const mockStore = {
  get: vi.fn().mockResolvedValue({})
}

const mockKick = {
  getUserChatroomInfo: vi.fn().mockResolvedValue({ data: null }),
  getSilenceUser: vi.fn(),
  getUnsilenceUser: vi.fn()
}

const mockModActions = {
  getTimeoutUser: vi.fn(),
  getBanUser: vi.fn(),
  getUnbanUser: vi.fn()
}

global.window.app = {
  userDialog: mockUserDialog,
  logs: mockLogs,
  store: mockStore,
  kick: mockKick,
  modActions: mockModActions
}

describe('User Dialog Component', () => {
  const mockUserProfile = {
    id: 'user123',
    username: 'testuser',
    profile_pic: 'https://example.com/profile.jpg',
    following_since: '2024-01-01T00:00:00Z',
    subscribed_for: 3
  }

  const mockDialogData = {
    sender: {
      id: 'user123',
      username: 'testuser',
      identity: {
        badges: [
          { type: 'Broadcaster', text: 'Broadcaster' }
        ]
      }
    },
    chatroomId: 'chatroom123',
    chatroom: {
      id: 'chatroom123',
      username: 'streamer',
      slug: 'streamer',
      channel7TVEmotes: []
    },
    userChatroomInfo: {
      id: 'currentuser',
      is_broadcaster: false,
      is_moderator: false,
      is_super_admin: false
    },
    userStyle: {
      badge: { name: '7TV Badge' }
    },
    subscriberBadges: [
      { id: 'sub1', name: 'Subscriber' }
    ],
    pinned: false
  }

  const mockMessages = [
    {
      id: 'msg1',
      content: 'Test message 1',
      sender: { id: 'user123', username: 'testuser' },
      chatroom_id: 'chatroom123',
      created_at: '2024-01-01T10:00:00Z'
    },
    {
      id: 'msg2', 
      content: 'Test message 2',
      sender: { id: 'user123', username: 'testuser' },
      chatroom_id: 'chatroom123',
      created_at: '2024-01-01T10:01:00Z'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup localStorage defaults
    mockLocalStorage.getItem.mockImplementation((key) => {
      switch (key) {
        case 'kickUsername':
          return 'currentuser'
        case 'silencedUsers':
          return JSON.stringify({ data: [] })
        case 'chatrooms':
          return JSON.stringify([mockDialogData.chatroom])
        default:
          return null
      }
    })
    
    // Setup API defaults
    mockLogs.get.mockResolvedValue(mockMessages)
    mockKick.getUserChatroomInfo.mockResolvedValue({ data: mockUserProfile })
    mockStore.get.mockResolvedValue({})
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Rendering and Initialization', () => {
    it('should render dialog wrapper', async () => {
      render(<User />)
      
      // Trigger data load
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      expect(screen.getByTestId('tooltip-provider')).toBeInTheDocument()
      expect(document.querySelector('.dialogWrapper')).toBeInTheDocument()
    })

    it('should setup event listeners on mount', () => {
      render(<User />)
      
      expect(mockUserDialog.onData).toHaveBeenCalledTimes(1)
      expect(mockLogs.onUpdate).toHaveBeenCalledTimes(1)
    })

    it('should cleanup event listeners on unmount', () => {
      const mockDataCleanup = vi.fn()
      const mockUpdateCleanup = vi.fn()
      
      mockUserDialog.onData.mockReturnValue(mockDataCleanup)
      mockLogs.onUpdate.mockReturnValue(mockUpdateCleanup)
      
      const { unmount } = render(<User />)
      unmount()
      
      expect(mockDataCleanup).toHaveBeenCalledTimes(1)
      expect(mockUpdateCleanup).toHaveBeenCalledTimes(1)
    })

    it('should handle initial silenced users from localStorage', () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'silencedUsers') {
          return JSON.stringify({
            data: [{ id: 'user123', username: 'testuser' }]
          })
        }
        return null
      })
      
      render(<User />)
      
      // Component should parse silenced users without error
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('silencedUsers')
    })

    it('should handle invalid silenced users JSON gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'silencedUsers') {
          return 'invalid json'
        }
        return null
      })
      
      render(<User />)
      
      expect(consoleSpy).toHaveBeenCalledWith('Error parsing silenced users:', expect.any(Error))
      consoleSpy.mockRestore()
    })
  })

  describe('Data Loading', () => {
    it('should load user data when onData is triggered', async () => {
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      expect(mockStore.get).toHaveBeenCalled()
      expect(mockLogs.get).toHaveBeenCalledWith({ 
        chatroomId: 'chatroom123', 
        userId: 'user123' 
      })
      expect(mockKick.getUserChatroomInfo).toHaveBeenCalledWith('streamer', 'testuser')
    })

    it('should use fetched user if provided', async () => {
      render(<User />)
      
      const dataWithFetchedUser = {
        ...mockDialogData,
        fetchedUser: mockUserProfile
      }
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(dataWithFetchedUser)
      
      expect(mockKick.getUserChatroomInfo).not.toHaveBeenCalled()
    })

    it('should handle data loading errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      mockStore.get.mockRejectedValue(new Error('Store error'))
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[User Dialog]: Error loading user dialog data:',
        expect.any(Error)
      )
      
      consoleSpy.mockRestore()
    })

    it('should set pin state correctly', async () => {
      render(<User />)
      
      const pinnedData = { ...mockDialogData, pinned: true }
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(pinnedData)
      
      expect(mockUserDialog.pin).toHaveBeenCalledWith(true)
    })

    it('should check if user is silenced', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'silencedUsers') {
          return JSON.stringify({
            data: [{ id: 'user123', username: 'testuser' }]
          })
        }
        return mockLocalStorage.getItem.mockReturnValue(null)
      })
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      await waitFor(() => {
        expect(screen.getByText('Unmute User')).toBeInTheDocument()
      })
    })
  })

  describe('User Profile Display', () => {
    it('should display user profile information', async () => {
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument()
        expect(screen.getByText('January 1, 2024')).toBeInTheDocument()
        expect(screen.getByText('3 months.')).toBeInTheDocument()
      })
    })

    it('should show default profile picture when none provided', async () => {
      mockKick.getUserChatroomInfo.mockResolvedValue({ 
        data: { ...mockUserProfile, profile_pic: null } 
      })
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      await waitFor(() => {
        const img = document.querySelector('.dialogHeaderUserImage img')
        expect(img).toHaveAttribute('src', 'https://kick.com/img/default-profile-pictures/default2.jpeg')
      })
    })

    it('should handle singular month subscription', async () => {
      mockKick.getUserChatroomInfo.mockResolvedValue({ 
        data: { ...mockUserProfile, subscribed_for: 1 } 
      })
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      await waitFor(() => {
        expect(screen.getByText('1 month.')).toBeInTheDocument()
      })
    })

    it('should handle zero subscription months', async () => {
      mockKick.getUserChatroomInfo.mockResolvedValue({ 
        data: { ...mockUserProfile, subscribed_for: 0 } 
      })
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      await waitFor(() => {
        expect(screen.getByText('0 months.')).toBeInTheDocument()
      })
    })

    it('should show N/A for missing following date', async () => {
      mockKick.getUserChatroomInfo.mockResolvedValue({ 
        data: { ...mockUserProfile, following_since: null } 
      })
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      await waitFor(() => {
        expect(screen.getByText('Following since:')).toBeInTheDocument()
        expect(screen.getByText('N/A')).toBeInTheDocument()
      })
    })

    it('should display user badges', async () => {
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      await waitFor(() => {
        expect(screen.getByTestId('stv-badges')).toBeInTheDocument()
        expect(screen.getByTestId('kick-badges')).toBeInTheDocument()
      })
    })

    it('should handle user without badges', async () => {
      const dataWithoutBadges = {
        ...mockDialogData,
        sender: {
          ...mockDialogData.sender,
          identity: { badges: [] }
        },
        userStyle: null
      }
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(dataWithoutBadges)
      
      await waitFor(() => {
        expect(screen.queryByTestId('stv-badges')).not.toBeInTheDocument()
        expect(screen.queryByTestId('kick-badges')).not.toBeInTheDocument()
      })
    })
  })

  describe('Message Logs', () => {
    it('should display user message logs', async () => {
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      await waitFor(() => {
        expect(screen.getByTestId('message-msg1')).toBeInTheDocument()
        expect(screen.getByTestId('message-msg2')).toBeInTheDocument()
        expect(screen.getByText('testuser: Test message 1')).toBeInTheDocument()
        expect(screen.getByText('testuser: Test message 2')).toBeInTheDocument()
      })
    })

    it('should update logs when new messages arrive', async () => {
      render(<User />)
      
      // Initial load
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      // Update with new messages
      const onUpdateHandler = mockLogs.onUpdate.mock.calls[0][0]
      const newMessages = [
        {
          id: 'msg3',
          content: 'New message',
          sender: { id: 'user123', username: 'testuser' },
          chatroom_id: 'chatroom123',
          created_at: '2024-01-01T10:02:00Z'
        }
      ]
      
      onUpdateHandler({ logs: newMessages })
      
      await waitFor(() => {
        expect(screen.getByTestId('message-msg3')).toBeInTheDocument()
        expect(screen.getByText('testuser: New message')).toBeInTheDocument()
      })
    })

    it('should not duplicate messages in logs', async () => {
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      // Try to update with existing message
      const onUpdateHandler = mockLogs.onUpdate.mock.calls[0][0]
      onUpdateHandler({ logs: [mockMessages[0]] }) // Same message
      
      await waitFor(() => {
        const messages = screen.getAllByTestId('message-msg1')
        expect(messages).toHaveLength(1) // Should not duplicate
      })
    })

    it('should handle update with no logs', () => {
      render(<User />)
      
      const onUpdateHandler = mockLogs.onUpdate.mock.calls[0][0]
      
      // Should not crash
      expect(() => {
        onUpdateHandler({ logs: [] })
        onUpdateHandler({}) // No logs property
        onUpdateHandler(null)
      }).not.toThrow()
    })

    it('should auto-scroll to bottom when new messages arrive', async () => {
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      // Mock scrollHeight and scrollTop
      const mockScrollElement = {
        scrollTop: 0,
        scrollHeight: 1000
      }
      
      // Mock the ref
      const dialogLogsRef = { current: mockScrollElement }
      vi.spyOn(React, 'useRef').mockReturnValue(dialogLogsRef)
      
      // Add new message
      const onUpdateHandler = mockLogs.onUpdate.mock.calls[0][0]
      onUpdateHandler({ 
        logs: [{ 
          id: 'msg3', 
          content: 'New message',
          sender: { id: 'user123', username: 'testuser' }
        }] 
      })
      
      // Should scroll to bottom
      expect(mockScrollElement.scrollTop).toBe(1000)
    })
  })

  describe('User Silencing', () => {
    it('should silence user when mute button clicked', async () => {
      const user = userEvent.setup()
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      await waitFor(() => {
        expect(screen.getByText('Mute User')).toBeInTheDocument()
      })
      
      const muteButton = screen.getByText('Mute User')
      await user.click(muteButton)
      
      expect(mockKick.getSilenceUser).toHaveBeenCalledWith('user123')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'silencedUsers',
        JSON.stringify({
          data: [{ id: 'user123', username: 'testuser' }]
        })
      )
    })

    it('should unsilence user when unmute button clicked', async () => {
      const user = userEvent.setup()
      
      // Setup with already silenced user
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'silencedUsers') {
          return JSON.stringify({
            data: [{ id: 'user123', username: 'testuser' }]
          })
        }
        return null
      })
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      await waitFor(() => {
        expect(screen.getByText('Unmute User')).toBeInTheDocument()
      })
      
      const unmuteButton = screen.getByText('Unmute User')
      await user.click(unmuteButton)
      
      expect(mockKick.getUnsilenceUser).toHaveBeenCalledWith('user123')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'silencedUsers',
        JSON.stringify({ data: [] })
      )
    })

    it('should disable mute button for current user', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'kickUsername') {
          return 'testuser'
        }
        return null
      })
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      await waitFor(() => {
        const muteButton = screen.getByText('Mute User').closest('button')
        expect(muteButton).toBeDisabled()
      })
    })

    it('should handle username with underscores vs dashes', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'kickUsername') {
          return 'test-user' // Dash in localStorage
        }
        return null
      })
      
      const dataWithUnderscoreUser = {
        ...mockDialogData,
        sender: {
          ...mockDialogData.sender,
          username: 'test_user' // Underscore in username
        }
      }
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(dataWithUnderscoreUser)
      
      await waitFor(() => {
        const muteButton = screen.getByText('Mute User').closest('button')
        expect(muteButton).toBeDisabled() // Should be disabled due to same user
      })
    })

    it('should disable mute button when not logged in', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'kickUsername') {
          return null // No username
        }
        return null
      })
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      await waitFor(() => {
        const muteButton = screen.getByText('Mute User').closest('button')
        expect(muteButton).toBeDisabled()
      })
    })
  })

  describe('Dialog Controls', () => {
    it('should toggle pin state', async () => {
      const user = userEvent.setup()
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      await waitFor(() => {
        const pinButton = screen.getByAltText('Pin').closest('button')
        expect(pinButton).not.toHaveClass('pinned')
      })
      
      const pinButton = screen.getByAltText('Pin').closest('button')
      await user.click(pinButton)
      
      expect(mockUserDialog.pin).toHaveBeenCalledWith(true)
    })

    it('should copy username to clipboard', async () => {
      const user = userEvent.setup()
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      await waitFor(() => {
        const copyButton = screen.getByAltText('Copy')
        expect(copyButton).toBeInTheDocument()
      })
      
      const copyButton = screen.getByAltText('Copy')
      await user.click(copyButton)
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('testuser')
    })

    it('should open user channel in new tab', async () => {
      const user = userEvent.setup()
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      await waitFor(() => {
        expect(screen.getByText('Open Channel')).toBeInTheDocument()
      })
      
      const openChannelButton = screen.getByText('Open Channel')
      await user.click(openChannelButton)
      
      expect(window.open).toHaveBeenCalledWith(
        'https://kick.com/testuser',
        '_blank',
        'noopener,noreferrer'
      )
    })

    it('should handle username case conversion for channel link', async () => {
      const user = userEvent.setup()
      const dataWithMixedCase = {
        ...mockDialogData,
        sender: {
          ...mockDialogData.sender,
          username: 'TestUser'
        }
      }
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(dataWithMixedCase)
      
      await waitFor(() => {
        expect(screen.getByText('Open Channel')).toBeInTheDocument()
      })
      
      const openChannelButton = screen.getByText('Open Channel')
      await user.click(openChannelButton)
      
      expect(window.open).toHaveBeenCalledWith(
        'https://kick.com/testuser',
        '_blank',
        'noopener,noreferrer'
      )
    })
  })

  describe('Moderation Actions', () => {
    it('should show moderation actions for moderators', async () => {
      const moderatorData = {
        ...mockDialogData,
        userChatroomInfo: {
          ...mockDialogData.userChatroomInfo,
          is_moderator: true
        }
      }
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(moderatorData)
      
      await waitFor(() => {
        expect(screen.getByAltText('Unban')).toBeInTheDocument()
        expect(screen.getByAltText('Ban')).toBeInTheDocument()
        expect(screen.getByText('1m')).toBeInTheDocument()
        expect(screen.getByText('5m')).toBeInTheDocument()
        expect(screen.getByText('30m')).toBeInTheDocument()
        expect(screen.getByText('1h')).toBeInTheDocument()
        expect(screen.getByText('1d')).toBeInTheDocument()
        expect(screen.getByText('1w')).toBeInTheDocument()
      })
    })

    it('should show moderation actions for broadcasters', async () => {
      const broadcasterData = {
        ...mockDialogData,
        userChatroomInfo: {
          ...mockDialogData.userChatroomInfo,
          is_broadcaster: true
        }
      }
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(broadcasterData)
      
      await waitFor(() => {
        expect(screen.getByAltText('Ban')).toBeInTheDocument()
      })
    })

    it('should hide moderation actions for regular users', async () => {
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument()
      })
      
      expect(screen.queryByAltText('Ban')).not.toBeInTheDocument()
      expect(screen.queryByText('1m')).not.toBeInTheDocument()
    })

    it('should hide moderation actions for the broadcaster themselves', async () => {
      const selfModeratorData = {
        ...mockDialogData,
        sender: {
          ...mockDialogData.sender,
          username: 'streamer' // Same as chatroom username
        },
        userChatroomInfo: {
          ...mockDialogData.userChatroomInfo,
          is_moderator: true
        }
      }
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(selfModeratorData)
      
      await waitFor(() => {
        expect(screen.getByText('streamer')).toBeInTheDocument()
      })
      
      expect(screen.queryByAltText('Ban')).not.toBeInTheDocument()
    })

    it('should execute timeout actions with correct durations', async () => {
      const user = userEvent.setup()
      const moderatorData = {
        ...mockDialogData,
        userChatroomInfo: {
          ...mockDialogData.userChatroomInfo,
          is_moderator: true
        }
      }
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(moderatorData)
      
      await waitFor(() => {
        expect(screen.getByText('1m')).toBeInTheDocument()
      })
      
      // Test different timeout durations
      const timeouts = [
        { button: '1m', duration: 1 },
        { button: '5m', duration: 5 },
        { button: '30m', duration: 30 },
        { button: '1h', duration: 60 },
        { button: '1d', duration: 1440 },
        { button: '1w', duration: 10080 }
      ]
      
      for (const timeout of timeouts) {
        await user.click(screen.getByText(timeout.button))
        expect(mockModActions.getTimeoutUser).toHaveBeenCalledWith(
          'streamer',
          'testuser',
          timeout.duration
        )
      }
    })

    it('should execute ban action', async () => {
      const user = userEvent.setup()
      const moderatorData = {
        ...mockDialogData,
        userChatroomInfo: {
          ...mockDialogData.userChatroomInfo,
          is_moderator: true
        }
      }
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(moderatorData)
      
      await waitFor(() => {
        expect(screen.getByAltText('Ban')).toBeInTheDocument()
      })
      
      const banButton = screen.getByAltText('Ban')
      await user.click(banButton)
      
      expect(mockModActions.getBanUser).toHaveBeenCalledWith('streamer', 'testuser')
    })

    it('should execute unban action', async () => {
      const user = userEvent.setup()
      const moderatorData = {
        ...mockDialogData,
        userChatroomInfo: {
          ...mockDialogData.userChatroomInfo,
          is_moderator: true
        }
      }
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(moderatorData)
      
      await waitFor(() => {
        expect(screen.getByAltText('Unban')).toBeInTheDocument()
      })
      
      const unbanButton = screen.getByAltText('Unban')
      await user.click(unbanButton)
      
      expect(mockModActions.getUnbanUser).toHaveBeenCalledWith('streamer', 'testuser')
    })
  })

  describe('Error Handling', () => {
    it('should handle missing dialog data gracefully', () => {
      render(<User />)
      
      expect(screen.getByTestId('tooltip-provider')).toBeInTheDocument()
      expect(document.querySelector('.dialogWrapper')).toBeInTheDocument()
    })

    it('should handle missing window.app methods gracefully', async () => {
      const user = userEvent.setup()
      
      // Remove specific methods
      delete window.app.userDialog.pin
      delete window.app.kick.getSilenceUser
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      // Should not crash when methods are missing
      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument()
      })
    })

    it('should handle clipboard errors gracefully', async () => {
      const user = userEvent.setup()
      navigator.clipboard.writeText.mockRejectedValue(new Error('Clipboard error'))
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      await waitFor(() => {
        const copyButton = screen.getByAltText('Copy')
        expect(copyButton).toBeInTheDocument()
      })
      
      const copyButton = screen.getByAltText('Copy')
      
      // Should not crash when clipboard fails
      await expect(user.click(copyButton)).resolves.not.toThrow()
    })

    it('should handle null user data', async () => {
      mockKick.getUserChatroomInfo.mockResolvedValue({ data: null })
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument()
      })
    })

    it('should handle missing chatroom data', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'chatrooms') {
          return JSON.stringify([]) // Empty chatrooms
        }
        return null
      })
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      
      // Should not crash with missing chatroom
      await expect(onDataHandler(mockDialogData)).resolves.not.toThrow()
    })
  })

  describe('Accessibility', () => {
    it('should have proper alt text for all icons', async () => {
      const moderatorData = {
        ...mockDialogData,
        userChatroomInfo: {
          ...mockDialogData.userChatroomInfo,
          is_moderator: true
        }
      }
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(moderatorData)
      
      await waitFor(() => {
        expect(screen.getByAltText('Check')).toBeInTheDocument()
        expect(screen.getByAltText('Pin')).toBeInTheDocument()
        expect(screen.getByAltText('Copy')).toBeInTheDocument()
        expect(screen.getByAltText('Ban')).toBeInTheDocument()
        expect(screen.getByAltText('Unban')).toBeInTheDocument()
      })
    })

    it('should have clickable buttons with proper roles', async () => {
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      await waitFor(() => {
        const buttons = screen.getAllByRole('button')
        expect(buttons.length).toBeGreaterThan(0)
        
        buttons.forEach(button => {
          expect(button.tagName).toBe('BUTTON')
        })
      })
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      await waitFor(() => {
        const pinButton = screen.getByAltText('Pin').closest('button')
        expect(pinButton).toBeInTheDocument()
      })
      
      const pinButton = screen.getByAltText('Pin').closest('button')
      pinButton.focus()
      
      await user.keyboard('{Enter}')
      
      expect(mockUserDialog.pin).toHaveBeenCalled()
    })
  })

  describe('Performance and Memory Management', () => {
    it('should not cause memory leaks with repeated renders', () => {
      const { rerender } = render(<User />)
      
      // Multiple re-renders should not cause issues
      for (let i = 0; i < 100; i++) {
        rerender(<User />)
      }
      
      expect(screen.getByTestId('tooltip-provider')).toBeInTheDocument()
    })

    it('should handle large message logs efficiently', async () => {
      // Create 1000 messages
      const manyMessages = Array.from({ length: 1000 }, (_, i) => ({
        id: `msg${i}`,
        content: `Message ${i}`,
        sender: { id: 'user123', username: 'testuser' },
        chatroom_id: 'chatroom123',
        created_at: `2024-01-01T10:${i.toString().padStart(2, '0')}:00Z`
      }))
      
      mockLogs.get.mockResolvedValue(manyMessages)
      
      render(<User />)
      
      const onDataHandler = mockUserDialog.onData.mock.calls[0][0]
      await onDataHandler(mockDialogData)
      
      await waitFor(() => {
        const messages = screen.getAllByTestId(/message-msg\d+/)
        expect(messages).toHaveLength(1000)
      })
    })

    it('should cleanup properly on unmount', () => {
      const mockDataCleanup = vi.fn()
      const mockUpdateCleanup = vi.fn()
      
      mockUserDialog.onData.mockReturnValue(mockDataCleanup)
      mockLogs.onUpdate.mockReturnValue(mockUpdateCleanup)
      
      const { unmount } = render(<User />)
      unmount()
      
      expect(mockDataCleanup).toHaveBeenCalled()
      expect(mockUpdateCleanup).toHaveBeenCalled()
    })
  })
})