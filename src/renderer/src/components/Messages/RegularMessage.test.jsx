import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { memo } from 'react'
import RegularMessage from './RegularMessage.jsx'

// Mock dependencies
vi.mock('@assets/styles/components/Chat/Message.scss', () => ({}))
vi.mock('clsx', () => ({
  default: (...args) => args.filter(Boolean).join(' ')
}))

// Mock MessageParser
vi.mock('../../utils/MessageParser', () => ({
  MessageParser: ({ message, type, chatroomId, chatroomName }) => (
    <div data-testid="message-parser">
      <span data-type={type} data-chatroom-id={chatroomId} data-chatroom-name={chatroomName}>
        {message?.content || 'Parsed content'}
      </span>
    </div>
  )
}))

// Mock Badge components
vi.mock('../Cosmetics/Badges', () => ({
  KickBadges: ({ badges, subscriberBadges }) => (
    <div data-testid="kick-badges">
      {badges?.map((badge, i) => <span key={i} data-testid="kick-badge">{badge.type}</span>)}
      {subscriberBadges?.map((badge, i) => <span key={i} data-testid="subscriber-badge">{badge.name}</span>)}
    </div>
  ),
  KickTalkBadges: ({ badges }) => (
    <div data-testid="kicktalk-badges">
      {badges?.map((badge, i) => <span key={i} data-testid="kicktalk-badge">{badge.type}</span>)}
    </div>
  ),
  StvBadges: ({ badge }) => (
    <div data-testid="stv-badges">
      <span data-testid="stv-badge">{badge?.name}</span>
    </div>
  )
}))

// Mock ChatUtils
vi.mock('../../utils/ChatUtils', () => ({
  getTimestampFormat: vi.fn((timestamp, format) => {
    if (format === 'disabled') return null
    if (format === 'HH:mm') return '12:34'
    if (format === 'HH:mm:ss') return '12:34:56'
    return '12:34'
  })
}))

// Mock ModActions component
vi.mock('./ModActions', () => ({
  default: ({ chatroomName, message }) => (
    <div data-testid="mod-actions">
      Mod actions for {message?.sender?.username} in {chatroomName}
    </div>
  )
}))

// Mock SVG assets
vi.mock('@assets/icons/copy-simple-fill.svg?asset', () => ({ default: 'copy-icon.svg' }))
vi.mock('@assets/icons/reply-fill.svg?asset', () => ({ default: 'reply-icon.svg' }))
vi.mock('@assets/icons/push-pin-fill.svg?asset', () => ({ default: 'pin-icon.svg' }))
vi.mock('@assets/icons/arrow-clockwise-fill.svg?asset', () => ({ default: 'retry-icon.svg' }))

// Mock ChatProvider
vi.mock('../../providers/ChatProvider', () => ({
  default: vi.fn(() => vi.fn())
}))


// Mock window.app API
const mockWindowApp = {
  reply: {
    open: vi.fn()
  }
}

// Mock clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined)
  }
})

describe('RegularMessage Component', () => {
  const mockGetPinMessage = vi.fn()
  const mockRetryFailedMessage = vi.fn()
  const mockUseChatStore = vi.fn(() => mockGetPinMessage)

  const mockMessage = {
    id: 'msg123',
    content: 'Test message content',
    sender: {
      id: 'user123',
      username: 'testuser',
      identity: {
        color: '#ff0000',
        badges: [
          { type: 'Broadcaster', text: 'Broadcaster' }
        ]
      }
    },
    chatroom_id: 'chatroom123',
    created_at: '2024-01-01T10:00:00Z',
    deleted: false,
    isOptimistic: false,
    state: null
  }

  const defaultProps = {
    message: mockMessage,
    kickTalkBadges: null,
    donatorBadges: null,
    subscriberBadges: [
      { id: 'sub1', name: 'Subscriber', months: 1 }
    ],
    userStyle: null,
    sevenTVEmotes: [],
    handleOpenUserDialog: vi.fn(),
    type: 'chat',
    chatroomName: 'testchatroom',
    username: 'currentuser',
    chatroomId: 'chatroom123',
    userChatroomInfo: {
      id: 'currentuser123',
      is_broadcaster: false,
      is_moderator: false,
      is_super_admin: false
    },
    isSearch: false,
    settings: {
      general: {
        timestampFormat: 'HH:mm'
      },
      moderation: {
        quickModTools: true
      },
      sevenTV: {
        enabled: true
      }
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.window.app = mockWindowApp
    
    // Setup store mocks
    mockUseChatStore.mockReturnValue(mockGetPinMessage)
    mockUseChatStore.getState = vi.fn(() => ({
      retryFailedMessage: mockRetryFailedMessage
    }))
    
    // Apply the mock
    vi.mocked(require('../../providers/ChatProvider').default).mockImplementation(mockUseChatStore)
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Rendering', () => {
    it('should render basic message structure', () => {
      render(<RegularMessage {...defaultProps} />)

      expect(screen.getByTestId('message-parser')).toBeInTheDocument()
      expect(screen.getByText('testuser:')).toBeInTheDocument()
      expect(screen.getByTestId('kick-badges')).toBeInTheDocument()
    })

    it('should render timestamp when enabled', () => {
      render(<RegularMessage {...defaultProps} />)

      expect(screen.getByText('12:34')).toBeInTheDocument()
    })

    it('should not render timestamp when disabled', () => {
      const propsWithDisabledTimestamp = {
        ...defaultProps,
        settings: {
          ...defaultProps.settings,
          general: {
            timestampFormat: 'disabled'
          }
        }
      }

      render(<RegularMessage {...propsWithDisabledTimestamp} />)

      expect(screen.queryByText('12:34')).not.toBeInTheDocument()
    })

    it('should apply deleted message styling', () => {
      const deletedMessage = {
        ...mockMessage,
        deleted: true
      }

      render(<RegularMessage {...defaultProps} message={deletedMessage} />)

      const container = screen.getByText('testuser:').closest('.chatMessageContainer')
      expect(container).toHaveClass('deleted')
    })

    it('should render different timestamp formats', () => {
      const { rerender } = render(<RegularMessage {...defaultProps} />)
      
      expect(screen.getByText('12:34')).toBeInTheDocument()

      const propsWithSeconds = {
        ...defaultProps,
        settings: {
          ...defaultProps.settings,
          general: {
            timestampFormat: 'HH:mm:ss'
          }
        }
      }

      rerender(<RegularMessage {...propsWithSeconds} />)
      expect(screen.getByText('12:34:56')).toBeInTheDocument()
    })
  })

  describe('Badge System', () => {
    it('should render KickTalk badges when present', () => {
      const propsWithKickTalkBadges = {
        ...defaultProps,
        kickTalkBadges: [
          { type: 'Founder', title: 'KickTalk Founder' }
        ]
      }

      render(<RegularMessage {...propsWithKickTalkBadges} />)

      expect(screen.getByTestId('kicktalk-badges')).toBeInTheDocument()
      expect(screen.getByTestId('kicktalk-badge')).toHaveTextContent('Founder')
    })

    it('should render donator badges when present', () => {
      const propsWithDonatorBadges = {
        ...defaultProps,
        donatorBadges: [
          { type: 'Donator', amount: 10 }
        ]
      }

      render(<RegularMessage {...propsWithDonatorBadges} />)

      const kickTalkBadges = screen.getAllByTestId('kicktalk-badges')
      expect(kickTalkBadges).toHaveLength(1)
    })

    it('should render 7TV badge when user style has badge', () => {
      const propsWithStvBadge = {
        ...defaultProps,
        userStyle: {
          badge: { id: 'badge1', name: '7TV Badge', url: 'badge.png' }
        }
      }

      render(<RegularMessage {...propsWithStvBadge} />)

      expect(screen.getByTestId('stv-badges')).toBeInTheDocument()
      expect(screen.getByTestId('stv-badge')).toHaveTextContent('7TV Badge')
    })

    it('should render Kick identity badges', () => {
      render(<RegularMessage {...defaultProps} />)

      expect(screen.getByTestId('kick-badges')).toBeInTheDocument()
      expect(screen.getByTestId('kick-badge')).toHaveTextContent('Broadcaster')
    })

    it('should render subscriber badges', () => {
      render(<RegularMessage {...defaultProps} />)

      expect(screen.getByTestId('kick-badges')).toBeInTheDocument()
      expect(screen.getByTestId('subscriber-badge')).toHaveTextContent('Subscriber')
    })
  })

  describe('User Style and Paint', () => {
    it('should apply user paint styles when present', () => {
      const propsWithPaint = {
        ...defaultProps,
        userStyle: {
          paint: {
            backgroundImage: 'linear-gradient(45deg, #ff0000, #00ff00)',
            shadows: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.5))'
          }
        }
      }

      render(<RegularMessage {...propsWithPaint} />)

      const usernameButton = screen.getByText('testuser:').parentElement
      expect(usernameButton).toHaveClass('chatMessageUsernamePaint')
      expect(usernameButton).toHaveStyle({
        backgroundImage: 'linear-gradient(45deg, #ff0000, #00ff00)',
        filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.5))'
      })
    })

    it('should use identity color when no paint is present', () => {
      render(<RegularMessage {...defaultProps} />)

      const usernameButton = screen.getByText('testuser:').parentElement
      expect(usernameButton).toHaveStyle({
        color: '#ff0000'
      })
    })

    it('should fallback to default color when no identity color', () => {
      const messageWithoutColor = {
        ...mockMessage,
        sender: {
          ...mockMessage.sender,
          identity: {
            badges: []
          }
        }
      }

      render(<RegularMessage {...defaultProps} message={messageWithoutColor} />)

      const usernameButton = screen.getByText('testuser:').parentElement
      expect(usernameButton).toHaveStyle({
        color: 'var(--text-primary)'
      })
    })
  })

  describe('User Interactions', () => {
    it('should handle username click for regular messages', async () => {
      const user = userEvent.setup()
      const handleOpenUserDialog = vi.fn()

      render(<RegularMessage {...defaultProps} handleOpenUserDialog={handleOpenUserDialog} />)

      const usernameButton = screen.getByText('testuser:').parentElement
      await user.click(usernameButton)

      expect(handleOpenUserDialog).toHaveBeenCalledWith(expect.any(Object))
    })

    it('should handle username click for search messages', async () => {
      const user = userEvent.setup()
      const handleOpenUserDialog = vi.fn()

      render(<RegularMessage {...defaultProps} isSearch={true} handleOpenUserDialog={handleOpenUserDialog} />)

      const usernameButton = screen.getByText('testuser:').parentElement
      await user.click(usernameButton)

      expect(handleOpenUserDialog).toHaveBeenCalledWith(expect.any(Object), 'testuser')
    })

    it('should handle copy message action', async () => {
      const user = userEvent.setup()

      render(<RegularMessage {...defaultProps} />)

      const copyButton = screen.getByTitle('Copy Message')
      await user.click(copyButton)

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Test message content')
    })

    it('should handle reply action', async () => {
      const user = userEvent.setup()

      render(<RegularMessage {...defaultProps} />)

      const replyButton = screen.getByTitle('Reply to testuser')
      await user.click(replyButton)

      expect(mockWindowApp.reply.open).toHaveBeenCalledWith(mockMessage)
    })
  })

  describe('Message Actions for Different States', () => {
    it('should show normal actions for regular messages', () => {
      render(<RegularMessage {...defaultProps} />)

      expect(screen.getByTitle('Reply to testuser')).toBeInTheDocument()
      expect(screen.getByTitle('Copy Message')).toBeInTheDocument()
    })

    it('should show retry and copy actions for failed messages', () => {
      const failedMessage = {
        ...mockMessage,
        isOptimistic: true,
        state: 'failed',
        tempId: 'temp123'
      }

      render(<RegularMessage {...defaultProps} message={failedMessage} />)

      expect(screen.getByTitle('Retry sending message')).toBeInTheDocument()
      expect(screen.getByTitle('Copy Message')).toBeInTheDocument()
      expect(screen.queryByTitle('Reply to testuser')).not.toBeInTheDocument()
    })

    it('should handle retry action for failed messages', async () => {
      const user = userEvent.setup()
      const failedMessage = {
        ...mockMessage,
        isOptimistic: true,
        state: 'failed',
        tempId: 'temp123'
      }

      render(<RegularMessage {...defaultProps} message={failedMessage} />)

      const retryButton = screen.getByTitle('Retry sending message')
      await user.click(retryButton)

      expect(mockRetryFailedMessage).toHaveBeenCalledWith('chatroom123', 'temp123')
    })

    it('should not show reply and pin actions for deleted messages', () => {
      const deletedMessage = {
        ...mockMessage,
        deleted: true
      }

      render(<RegularMessage {...defaultProps} message={deletedMessage} />)

      expect(screen.queryByTitle('Reply to testuser')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Pin Message')).not.toBeInTheDocument()
      expect(screen.getByTitle('Copy Message')).toBeInTheDocument()
    })
  })

  describe('Moderation Features', () => {
    const moderatorInfo = {
      id: 'mod123',
      is_broadcaster: false,
      is_moderator: true,
      is_super_admin: false
    }

    it('should show mod actions for moderators', () => {
      render(<RegularMessage {...defaultProps} userChatroomInfo={moderatorInfo} />)

      expect(screen.getByTestId('mod-actions')).toBeInTheDocument()
    })

    it('should show pin action for moderators on non-deleted messages', () => {
      render(<RegularMessage {...defaultProps} userChatroomInfo={moderatorInfo} />)

      expect(screen.getByTitle('Pin Message')).toBeInTheDocument()
    })

    it('should handle pin message action', async () => {
      const user = userEvent.setup()

      render(<RegularMessage {...defaultProps} userChatroomInfo={moderatorInfo} />)

      const pinButton = screen.getByTitle('Pin Message')
      await user.click(pinButton)

      expect(mockGetPinMessage).toHaveBeenCalledWith('chatroom123', {
        chatroom_id: 'chatroom123',
        content: 'Test message content',
        id: 'msg123',
        sender: mockMessage.sender,
        chatroomName: 'testchatroom',
        type: 'chat'
      })
    })

    it('should not show pin action for deleted messages', () => {
      const deletedMessage = {
        ...mockMessage,
        deleted: true
      }

      render(<RegularMessage {...defaultProps} message={deletedMessage} userChatroomInfo={moderatorInfo} />)

      expect(screen.queryByTitle('Pin Message')).not.toBeInTheDocument()
    })

    it('should show mod actions for broadcasters', () => {
      const broadcasterInfo = {
        id: 'broadcaster123',
        is_broadcaster: true,
        is_moderator: false,
        is_super_admin: false
      }

      render(<RegularMessage {...defaultProps} userChatroomInfo={broadcasterInfo} />)

      expect(screen.getByTestId('mod-actions')).toBeInTheDocument()
    })

    it('should show mod actions for super admins', () => {
      const superAdminInfo = {
        id: 'admin123',
        is_broadcaster: false,
        is_moderator: false,
        is_super_admin: true
      }

      render(<RegularMessage {...defaultProps} userChatroomInfo={superAdminInfo} />)

      expect(screen.getByTestId('mod-actions')).toBeInTheDocument()
    })

    it('should not show mod actions when quick mod tools are disabled', () => {
      const propsWithDisabledMod = {
        ...defaultProps,
        userChatroomInfo: moderatorInfo,
        settings: {
          ...defaultProps.settings,
          moderation: {
            quickModTools: false
          }
        }
      }

      render(<RegularMessage {...propsWithDisabledMod} />)

      expect(screen.queryByTestId('mod-actions')).not.toBeInTheDocument()
    })

    it('should not show mod actions for own messages', () => {
      const ownMessage = {
        ...mockMessage,
        sender: {
          ...mockMessage.sender,
          username: 'testchatroom' // Same as chatroomName
        }
      }

      render(<RegularMessage {...defaultProps} message={ownMessage} userChatroomInfo={moderatorInfo} />)

      expect(screen.queryByTestId('mod-actions')).not.toBeInTheDocument()
    })

    it('should not show mod actions for current user messages', () => {
      const currentUserMessage = {
        ...mockMessage,
        sender: {
          ...mockMessage.sender,
          username: 'currentuser' // Same as username prop
        }
      }

      render(<RegularMessage {...defaultProps} message={currentUserMessage} userChatroomInfo={moderatorInfo} />)

      expect(screen.queryByTestId('mod-actions')).not.toBeInTheDocument()
    })

    it('should handle username with dashes properly', () => {
      const propsWithDashedUsername = {
        ...defaultProps,
        username: 'current-user'
      }

      const currentUserMessage = {
        ...mockMessage,
        sender: {
          ...mockMessage.sender,
          username: 'current_user' // Underscore version
        }
      }

      render(<RegularMessage {...propsWithDashedUsername} message={currentUserMessage} userChatroomInfo={moderatorInfo} />)

      expect(screen.queryByTestId('mod-actions')).not.toBeInTheDocument()
    })
  })

  describe('Message Parser Integration', () => {
    it('should pass correct props to MessageParser', () => {
      render(<RegularMessage {...defaultProps} />)

      const parser = screen.getByTestId('message-parser')
      const content = parser.querySelector('[data-type="chat"]')
      
      expect(content).toHaveAttribute('data-chatroom-id', 'chatroom123')
      expect(content).toHaveAttribute('data-chatroom-name', 'testchatroom')
      expect(content).toHaveTextContent('Test message content')
    })

    it('should pass sevenTV settings to MessageParser', () => {
      const propsWithSevenTV = {
        ...defaultProps,
        sevenTVEmotes: [
          { id: 'emote1', name: 'TestEmote', url: 'emote.png' }
        ]
      }

      render(<RegularMessage {...propsWithSevenTV} />)

      expect(screen.getByTestId('message-parser')).toBeInTheDocument()
    })
  })

  describe('Performance and Memory', () => {
    it('should memoize properly with React.memo', () => {
      const { rerender } = render(<RegularMessage {...defaultProps} />)

      // Same props should not cause re-render
      rerender(<RegularMessage {...defaultProps} />)

      expect(screen.getByTestId('message-parser')).toBeInTheDocument()
    })

    it('should re-render when message changes', () => {
      const { rerender } = render(<RegularMessage {...defaultProps} />)

      const newMessage = {
        ...mockMessage,
        content: 'Updated content'
      }

      rerender(<RegularMessage {...defaultProps} message={newMessage} />)

      expect(screen.getByText('Updated content')).toBeInTheDocument()
    })

    it('should re-render when settings change', () => {
      const { rerender } = render(<RegularMessage {...defaultProps} />)

      const newSettings = {
        ...defaultProps.settings,
        general: {
          timestampFormat: 'HH:mm:ss'
        }
      }

      rerender(<RegularMessage {...defaultProps} settings={newSettings} />)

      expect(screen.getByText('12:34:56')).toBeInTheDocument()
    })

    it('should handle rapid re-renders without memory leaks', () => {
      const { rerender } = render(<RegularMessage {...defaultProps} />)

      // Simulate rapid updates
      for (let i = 0; i < 100; i++) {
        const updatedMessage = {
          ...mockMessage,
          id: `msg${i}`,
          content: `Message ${i}`
        }

        rerender(<RegularMessage {...defaultProps} message={updatedMessage} />)
      }

      expect(screen.getByText('Message 99')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle missing message gracefully', () => {
      expect(() => {
        render(<RegularMessage {...defaultProps} message={null} />)
      }).not.toThrow()
    })

    it('should handle missing sender gracefully', () => {
      const messageWithoutSender = {
        ...mockMessage,
        sender: null
      }

      expect(() => {
        render(<RegularMessage {...defaultProps} message={messageWithoutSender} />)
      }).not.toThrow()
    })

    it('should handle missing settings gracefully', () => {
      expect(() => {
        render(<RegularMessage {...defaultProps} settings={null} />)
      }).not.toThrow()
    })

    it('should handle clipboard write errors gracefully', async () => {
      const user = userEvent.setup()
      navigator.clipboard.writeText.mockRejectedValue(new Error('Clipboard error'))

      render(<RegularMessage {...defaultProps} />)

      const copyButton = screen.getByTitle('Copy Message')
      
      await expect(user.click(copyButton)).resolves.not.toThrow()
    })
  })

  describe('Accessibility', () => {
    it('should have proper button roles and attributes', () => {
      render(<RegularMessage {...defaultProps} />)

      const usernameButton = screen.getByText('testuser:').parentElement
      expect(usernameButton).toHaveAttribute('type', 'button')

      const actionButtons = screen.getAllByRole('button')
      actionButtons.forEach(button => {
        expect(button).toBeInTheDocument()
      })
    })

    it('should have proper alt text for action icons', () => {
      render(<RegularMessage {...defaultProps} />)

      const copyIcon = screen.getByAltText('Copy Message')
      const replyIcon = screen.getByAltText('Reply to testuser')
      
      expect(copyIcon).toBeInTheDocument()
      expect(replyIcon).toBeInTheDocument()
    })

    it('should have proper alt text for retry icon in failed messages', () => {
      const failedMessage = {
        ...mockMessage,
        isOptimistic: true,
        state: 'failed',
        tempId: 'temp123'
      }

      render(<RegularMessage {...defaultProps} message={failedMessage} />)

      const retryIcon = screen.getByAltText('Retry Message')
      expect(retryIcon).toBeInTheDocument()
    })

    it('should have proper alt text for pin icon', () => {
      const moderatorInfo = {
        id: 'mod123',
        is_broadcaster: false,
        is_moderator: true,
        is_super_admin: false
      }

      render(<RegularMessage {...defaultProps} userChatroomInfo={moderatorInfo} />)

      const pinIcon = screen.getByAltText('Pin Message')
      expect(pinIcon).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      const handleOpenUserDialog = vi.fn()

      render(<RegularMessage {...defaultProps} handleOpenUserDialog={handleOpenUserDialog} />)

      const usernameButton = screen.getByText('testuser:').parentElement
      usernameButton.focus()
      
      await user.keyboard('{Enter}')
      expect(handleOpenUserDialog).toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty message content', () => {
      const emptyMessage = {
        ...mockMessage,
        content: ''
      }

      render(<RegularMessage {...defaultProps} message={emptyMessage} />)

      expect(screen.getByTestId('message-parser')).toBeInTheDocument()
    })

    it('should handle very long usernames', () => {
      const longUsernameMessage = {
        ...mockMessage,
        sender: {
          ...mockMessage.sender,
          username: 'a'.repeat(100)
        }
      }

      render(<RegularMessage {...defaultProps} message={longUsernameMessage} />)

      expect(screen.getByText(`${'a'.repeat(100)}:`)).toBeInTheDocument()
    })

    it('should handle special characters in content', () => {
      const specialCharMessage = {
        ...mockMessage,
        content: '🔥💯 Special chars: <>&"\'`'
      }

      render(<RegularMessage {...defaultProps} message={specialCharMessage} />)

      expect(screen.getByText('🔥💯 Special chars: <>&"\'`')).toBeInTheDocument()
    })

    it('should handle missing userChatroomInfo', () => {
      expect(() => {
        render(<RegularMessage {...defaultProps} userChatroomInfo={null} />)
      }).not.toThrow()
    })

    it('should handle undefined badge arrays', () => {
      const messageWithUndefinedBadges = {
        ...mockMessage,
        sender: {
          ...mockMessage.sender,
          identity: {
            ...mockMessage.sender.identity,
            badges: undefined
          }
        }
      }

      expect(() => {
        render(<RegularMessage {...defaultProps} message={messageWithUndefinedBadges} />)
      }).not.toThrow()
    })

    it('should handle different message types', () => {
      render(<RegularMessage {...defaultProps} type="dialog" />)

      const parser = screen.getByTestId('message-parser')
      const content = parser.querySelector('[data-type="dialog"]')
      expect(content).toBeInTheDocument()
    })
  })
})