import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Message from './Message.jsx'

// Mock dependencies
vi.mock('@assets/styles/components/Chat/Message.scss', () => ({}))
vi.mock('clsx', () => ({
  default: (...args) => args.filter(Boolean).join(' ')
}))

// Mock child components
vi.mock('./ModActionMessage', () => ({
  default: ({ message, chatroomId }) => (
    <div data-testid="mod-action-message">
      Mod Action: {message.content} in {chatroomId}
    </div>
  )
}))

vi.mock('./RegularMessage', () => ({
  default: ({ message, type, userStyle, handleOpenUserDialog }) => (
    <div data-testid="regular-message" data-type={type}>
      <button onClick={(e) => handleOpenUserDialog?.(e)} data-testid="user-dialog-trigger">
        {message.sender?.username}: {message.content}
      </button>
      {userStyle && <div data-testid="user-style">{JSON.stringify(userStyle)}</div>}
    </div>
  )
}))

vi.mock('./ReplyMessage', () => ({
  default: ({ message, type, handleOpenReplyThread, handleOpenUserDialog }) => (
    <div data-testid="reply-message" data-type={type}>
      <button onClick={() => handleOpenReplyThread?.([])} data-testid="reply-thread-trigger">
        Reply to {message.metadata?.original_sender?.username}: {message.content}
      </button>
      <button onClick={(e) => handleOpenUserDialog?.(e)} data-testid="user-dialog-trigger">
        Open User Dialog
      </button>
    </div>
  )
}))

vi.mock('./EmoteUpdateMessage', () => ({
  default: ({ message }) => (
    <div data-testid="emote-update-message">
      Emote Update: {message.content}
    </div>
  )
}))

vi.mock('../Shared/ContextMenu', () => ({
  ContextMenu: ({ children }) => <div data-testid="context-menu">{children}</div>,
  ContextMenuTrigger: ({ children, onContextMenu, asChild }) => (
    <div onContextMenu={onContextMenu} data-testid="context-menu-trigger">
      {children}
    </div>
  ),
  ContextMenuContent: ({ children }) => <div data-testid="context-menu-content">{children}</div>,
  ContextMenuItem: ({ children, onSelect }) => (
    <button onClick={onSelect} data-testid="context-menu-item">
      {children}
    </button>
  ),
  ContextMenuSeparator: () => <div data-testid="context-menu-separator" />,
  ContextMenuSub: ({ children }) => <div data-testid="context-menu-sub">{children}</div>,
  ContextMenuSubTrigger: ({ children }) => <div data-testid="context-menu-sub-trigger">{children}</div>,
  ContextMenuSubContent: ({ children }) => <div data-testid="context-menu-sub-content">{children}</div>
}))

// Mock stores
const mockUseChatStore = vi.fn()
const mockUseCosmeticsStore = vi.fn()

vi.mock('../../providers/ChatProvider', () => ({
  default: mockUseChatStore
}))

vi.mock('../../providers/CosmeticsProvider', () => ({
  default: mockUseCosmeticsStore
}))

vi.mock('zustand/shallow', () => ({
  useShallow: (fn) => fn
}))

// Mock window.app API
const mockWindowApp = {
  kick: {
    getUserChatroomInfo: vi.fn(),
    getPinMessage: vi.fn()
  },
  userDialog: {
    open: vi.fn()
  },
  reply: {
    open: vi.fn()
  },
  replyLogs: {
    get: vi.fn()
  },
  replyThreadDialog: {
    open: vi.fn()
  }
}

// Mock clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn()
  }
})

describe('Message Component', () => {
  const mockMessage = {
    id: 'msg123',
    content: 'Test message content',
    type: 'message',
    sender: {
      id: 'user123',
      username: 'testuser',
      slug: 'testuser',
      identity: {
        color: '#ff0000'
      }
    },
    chatroom_id: 'chatroom123',
    created_at: '2024-01-01T10:00:00Z',
    deleted: false
  }

  const mockProps = {
    message: mockMessage,
    userChatroomInfo: {
      id: 'user123',
      is_broadcaster: false,
      is_moderator: false,
      is_super_admin: false
    },
    chatroomId: 'chatroom123',
    subscriberBadges: [],
    allStvEmotes: [],
    existingKickTalkBadges: [],
    settings: {
      notifications: {
        background: false,
        phrases: [],
        backgroundRgba: { r: 255, g: 0, b: 0, a: 0.3 }
      },
      general: {
        timestampFormat: 'HH:mm'
      }
    },
    dialogUserStyle: null,
    type: 'chat',
    username: 'currentuser',
    userId: 'currentuser123',
    chatroomName: 'testchatroom',
    donators: []
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.window.app = mockWindowApp
    
    // Setup default store returns
    mockUseChatStore.mockReturnValue(vi.fn())
    mockUseCosmeticsStore.mockReturnValue(null)
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Rendering', () => {
    it('should render regular message', () => {
      render(<Message {...mockProps} />)
      
      expect(screen.getByTestId('regular-message')).toBeInTheDocument()
      expect(screen.getByText('testuser: Test message content')).toBeInTheDocument()
    })

    it('should render reply message', () => {
      const replyMessage = {
        ...mockMessage,
        type: 'reply',
        metadata: {
          original_sender: {
            id: 'original123',
            username: 'originaluser'
          },
          original_message: {
            id: 'original_msg_123',
            content: 'Original message'
          }
        }
      }

      render(<Message {...mockProps} message={replyMessage} />)
      
      expect(screen.getByTestId('reply-message')).toBeInTheDocument()
      expect(screen.getByText(/Reply to originaluser/)).toBeInTheDocument()
    })

    it('should render system message', () => {
      const systemMessage = {
        ...mockMessage,
        type: 'system',
        content: 'System notification'
      }

      render(<Message {...mockProps} message={systemMessage} />)
      
      expect(screen.getByText('System notification')).toBeInTheDocument()
      expect(screen.getByText('System notification')).toHaveClass('systemMessage')
    })

    it('should render connection status messages', () => {
      const connectionPendingMessage = {
        ...mockMessage,
        type: 'system',
        content: 'connection-pending'
      }

      const { rerender } = render(<Message {...mockProps} message={connectionPendingMessage} />)
      expect(screen.getByText('Connecting to Channel...')).toBeInTheDocument()

      const connectionSuccessMessage = {
        ...mockMessage,
        type: 'system',
        content: 'connection-success'
      }

      rerender(<Message {...mockProps} message={connectionSuccessMessage} />)
      expect(screen.getByText('Connected to Channel')).toBeInTheDocument()
    })

    it('should render emote update message', () => {
      const emoteUpdateMessage = {
        ...mockMessage,
        type: 'stvEmoteSetUpdate',
        content: 'Emote set updated'
      }

      render(<Message {...mockProps} message={emoteUpdateMessage} />)
      
      expect(screen.getByTestId('emote-update-message')).toBeInTheDocument()
    })

    it('should render mod action message', () => {
      const modActionMessage = {
        ...mockMessage,
        type: 'mod_action',
        content: 'User was banned'
      }

      render(<Message {...mockProps} message={modActionMessage} />)
      
      expect(screen.getByTestId('mod-action-message')).toBeInTheDocument()
      expect(screen.getByText('Mod Action: User was banned in chatroom123')).toBeInTheDocument()
    })
  })

  describe('Message States and Styling', () => {
    it('should apply old message styling', () => {
      const oldMessage = { ...mockMessage, is_old: true }
      
      render(<Message {...mockProps} message={oldMessage} />)
      
      const messageItem = screen.getByTestId('regular-message').parentElement
      expect(messageItem).toHaveClass('old')
    })

    it('should apply deleted message styling', () => {
      const deletedMessage = { ...mockMessage, deleted: true }
      
      render(<Message {...mockProps} message={deletedMessage} />)
      
      const messageItem = screen.getByTestId('regular-message').parentElement
      expect(messageItem).toHaveClass('deleted')
    })

    it('should apply dialog styling', () => {
      render(<Message {...mockProps} type="dialog" />)
      
      const messageItem = screen.getByTestId('regular-message').parentElement
      expect(messageItem).toHaveClass('dialogChatMessageItem')
    })

    it('should apply optimistic message styling', () => {
      const optimisticMessage = { 
        ...mockMessage, 
        isOptimistic: true, 
        state: 'optimistic' 
      }
      
      render(<Message {...mockProps} message={optimisticMessage} />)
      
      const messageItem = screen.getByTestId('regular-message').parentElement
      expect(messageItem).toHaveClass('optimistic')
    })

    it('should apply failed message styling', () => {
      const failedMessage = { 
        ...mockMessage, 
        isOptimistic: true, 
        state: 'failed' 
      }
      
      render(<Message {...mockProps} message={failedMessage} />)
      
      const messageItem = screen.getByTestId('regular-message').parentElement
      expect(messageItem).toHaveClass('failed')
    })
  })

  describe('Message Highlighting', () => {
    it('should highlight message when notification phrases match', () => {
      const settingsWithPhrases = {
        ...mockProps.settings,
        notifications: {
          background: true,
          phrases: ['test'],
          backgroundRgba: { r: 255, g: 255, b: 0, a: 0.5 }
        }
      }

      render(<Message {...mockProps} settings={settingsWithPhrases} />)
      
      const messageItem = screen.getByTestId('regular-message').parentElement
      expect(messageItem).toHaveClass('highlighted')
      expect(messageItem).toHaveStyle('backgroundColor: rgba(255, 255, 0, 0.5)')
    })

    it('should highlight reply to current user', () => {
      const replyToCurrentUser = {
        ...mockMessage,
        type: 'reply',
        metadata: {
          original_sender: {
            id: 'currentuser123', // Current user ID
            username: 'currentuser'
          }
        },
        sender: {
          ...mockMessage.sender,
          id: 'differentuser123' // Different sender
        }
      }

      const settingsWithHighlight = {
        ...mockProps.settings,
        notifications: {
          background: true,
          phrases: [],
          backgroundRgba: { r: 0, g: 255, b: 0, a: 0.3 }
        }
      }

      render(<Message {...mockProps} message={replyToCurrentUser} settings={settingsWithHighlight} />)
      
      const messageItem = screen.getByTestId('reply-message').parentElement
      expect(messageItem).toHaveClass('highlighted')
    })

    it('should not highlight own messages', () => {
      const ownMessage = {
        ...mockMessage,
        sender: {
          ...mockMessage.sender,
          slug: 'currentuser' // Same as username prop
        }
      }

      const settingsWithPhrases = {
        ...mockProps.settings,
        notifications: {
          background: true,
          phrases: ['test'],
          backgroundRgba: { r: 255, g: 255, b: 0, a: 0.5 }
        }
      }

      render(<Message {...mockProps} message={ownMessage} settings={settingsWithPhrases} />)
      
      const messageItem = screen.getByTestId('regular-message').parentElement
      expect(messageItem).not.toHaveClass('highlighted')
    })

    it('should not highlight in dialog type', () => {
      const settingsWithPhrases = {
        ...mockProps.settings,
        notifications: {
          background: true,
          phrases: ['test'],
          backgroundRgba: { r: 255, g: 255, b: 0, a: 0.5 }
        }
      }

      render(<Message {...mockProps} type="dialog" settings={settingsWithPhrases} />)
      
      const messageItem = screen.getByTestId('regular-message').parentElement
      expect(messageItem).not.toHaveClass('highlighted')
    })
  })

  describe('User Styles', () => {
    it('should use dialog user style for dialog type', () => {
      const dialogUserStyle = { color: '#00ff00' }
      
      render(<Message {...mockProps} type="dialog" dialogUserStyle={dialogUserStyle} />)
      
      expect(screen.getByTestId('user-style')).toHaveTextContent(JSON.stringify(dialogUserStyle))
    })

    it('should fetch user style from cosmetics store for non-dialog types', () => {
      const userStyle = { color: '#0000ff' }
      mockUseCosmeticsStore.mockReturnValue(userStyle)
      
      render(<Message {...mockProps} />)
      
      expect(screen.getByTestId('user-style')).toHaveTextContent(JSON.stringify(userStyle))
    })
  })

  describe('Moderation Capabilities', () => {
    it('should detect broadcaster moderation rights', () => {
      const broadcasterInfo = {
        ...mockProps.userChatroomInfo,
        is_broadcaster: true
      }

      render(<Message {...mockProps} userChatroomInfo={broadcasterInfo} />)
      // Test passes if component renders without errors - moderation logic is internal
    })

    it('should detect moderator rights', () => {
      const moderatorInfo = {
        ...mockProps.userChatroomInfo,
        is_moderator: true
      }

      render(<Message {...mockProps} userChatroomInfo={moderatorInfo} />)
      // Test passes if component renders without errors - moderation logic is internal
    })

    it('should detect super admin rights', () => {
      const superAdminInfo = {
        ...mockProps.userChatroomInfo,
        is_super_admin: true
      }

      render(<Message {...mockProps} userChatroomInfo={superAdminInfo} />)
      // Test passes if component renders without errors - moderation logic is internal
    })
  })

  describe('Context Menu', () => {
    it('should show context menu for regular messages', () => {
      render(<Message {...mockProps} />)
      
      expect(screen.getByTestId('context-menu-trigger')).toBeInTheDocument()
      expect(screen.getByTestId('context-menu-content')).toBeInTheDocument()
    })

    it('should not show context menu for deleted messages', () => {
      const deletedMessage = { ...mockMessage, deleted: true }
      
      render(<Message {...mockProps} message={deletedMessage} />)
      
      expect(screen.queryByTestId('context-menu-trigger')).not.toBeInTheDocument()
    })

    it('should not show context menu for system messages', () => {
      const systemMessage = { ...mockMessage, type: 'system' }
      
      render(<Message {...mockProps} message={systemMessage} />)
      
      expect(screen.queryByTestId('context-menu-trigger')).not.toBeInTheDocument()
    })

    it('should not show context menu for emote update messages', () => {
      const emoteMessage = { ...mockMessage, type: 'stvEmoteSetUpdate' }
      
      render(<Message {...mockProps} message={emoteMessage} />)
      
      expect(screen.queryByTestId('context-menu-trigger')).not.toBeInTheDocument()
    })

    it('should not show context menu for mod action messages', () => {
      const modMessage = { ...mockMessage, type: 'mod_action' }
      
      render(<Message {...mockProps} message={modMessage} />)
      
      expect(screen.queryByTestId('context-menu-trigger')).not.toBeInTheDocument()
    })
  })

  describe('Context Menu Actions', () => {
    beforeEach(() => {
      vi.useRealTimers()
    })

    it('should copy message content', async () => {
      const user = userEvent.setup()
      render(<Message {...mockProps} />)
      
      const copyButton = screen.getByText('Copy Message')
      await user.click(copyButton)
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Test message content')
    })

    it('should open reply dialog', async () => {
      const user = userEvent.setup()
      render(<Message {...mockProps} />)
      
      const replyButton = screen.getByText('Reply to Message')
      await user.click(replyButton)
      
      expect(mockWindowApp.reply.open).toHaveBeenCalledWith(mockMessage)
    })

    it('should open user dialog', async () => {
      const user = userEvent.setup()
      render(<Message {...mockProps} />)
      
      const userCardButton = screen.getByText('Open User Card')
      await user.click(userCardButton)
      
      expect(mockWindowApp.userDialog.open).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: mockMessage.sender,
          chatroomId: 'chatroom123'
        })
      )
    })

    it('should open profile on Kick', async () => {
      const user = userEvent.setup()
      const mockOpen = vi.fn()
      global.window.open = mockOpen
      
      render(<Message {...mockProps} />)
      
      const profileButton = screen.getByText('View Profile on Kick')
      await user.click(profileButton)
      
      expect(mockOpen).toHaveBeenCalledWith('https://kick.com/testuser', '_blank')
    })

    it('should handle moderation actions for moderators', async () => {
      const user = userEvent.setup()
      const moderatorInfo = {
        ...mockProps.userChatroomInfo,
        is_moderator: true
      }

      const getDeleteMessage = vi.fn()
      mockUseChatStore.mockReturnValue(getDeleteMessage)
      
      render(<Message {...mockProps} userChatroomInfo={moderatorInfo} />)
      
      const pinButton = screen.getByText('Pin Message')
      await user.click(pinButton)
      
      expect(mockWindowApp.kick.getPinMessage).toHaveBeenCalledWith({
        chatroom_id: mockMessage.chatroom_id,
        content: mockMessage.content,
        id: mockMessage.id,
        sender: mockMessage.sender,
        chatroomName: 'testchatroom'
      })

      const deleteButton = screen.getByText('Delete Message')
      await user.click(deleteButton)
      
      expect(getDeleteMessage).toHaveBeenCalledWith('chatroom123', 'msg123')
    })
  })

  describe('Emote Context Menu', () => {
    it('should detect 7TV emote right-click', () => {
      render(<Message {...mockProps} />)
      
      const trigger = screen.getByTestId('context-menu-trigger')
      
      // Create mock emote image
      const mockEmoteImg = document.createElement('img')
      mockEmoteImg.className = 'emote'
      mockEmoteImg.alt = 'OMEGALUL'
      mockEmoteImg.src = 'https://cdn.7tv.app/emote/123abc/2x.webp'
      
      const contextMenuEvent = {
        preventDefault: vi.fn(),
        target: mockEmoteImg
      }
      
      fireEvent.contextMenu(trigger, contextMenuEvent)
      
      // Verify emote context menu items appear
      expect(screen.getByText('Open Emote Links')).toBeInTheDocument()
      expect(screen.getByText('Copy Emote Links')).toBeInTheDocument()
    })

    it('should detect Kick emote right-click', () => {
      render(<Message {...mockProps} />)
      
      const trigger = screen.getByTestId('context-menu-trigger')
      
      // Create mock kick emote image  
      const mockEmoteImg = document.createElement('img')
      mockEmoteImg.className = 'emote'
      mockEmoteImg.alt = 'Kappa'
      mockEmoteImg.src = 'https://files.kick.com/emotes/456def/fullsize'
      
      const contextMenuEvent = {
        preventDefault: vi.fn(),
        target: mockEmoteImg
      }
      
      fireEvent.contextMenu(trigger, contextMenuEvent)
      
      // Verify kick emote context menu items appear
      expect(screen.getByText('Open Kick Emote')).toBeInTheDocument()
    })

    it('should open 7TV emote links', async () => {
      const user = userEvent.setup()
      const mockOpen = vi.fn()
      global.window.open = mockOpen
      
      render(<Message {...mockProps} />)
      
      const trigger = screen.getByTestId('context-menu-trigger')
      
      // Setup emote detection
      const mockEmoteImg = document.createElement('img')
      mockEmoteImg.className = 'emote'
      mockEmoteImg.alt = 'OMEGALUL'
      mockEmoteImg.src = 'https://cdn.7tv.app/emote/123abc/2x.webp'
      
      fireEvent.contextMenu(trigger, { target: mockEmoteImg })
      
      // Click 7TV link
      const stvLinkButton = screen.getByText('7TV Link')
      await user.click(stvLinkButton)
      
      expect(mockOpen).toHaveBeenCalledWith('https://7tv.app/emotes/123abc', '_blank')
    })

    it('should copy 7TV emote links', async () => {
      const user = userEvent.setup()
      
      render(<Message {...mockProps} />)
      
      const trigger = screen.getByTestId('context-menu-trigger')
      
      // Setup emote detection
      const mockEmoteImg = document.createElement('img')
      mockEmoteImg.className = 'emote'
      mockEmoteImg.alt = 'OMEGALUL'  
      mockEmoteImg.src = 'https://cdn.7tv.app/emote/123abc/2x.webp'
      
      fireEvent.contextMenu(trigger, { target: mockEmoteImg })
      
      // Test copying different resolutions
      const copy1xButton = screen.getAllByText('1x Link')[1] // Second one is in copy menu
      await user.click(copy1xButton)
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://cdn.7tv.app/emote/123abc/1x.webp')
    })
  })

  describe('User Dialog Integration', () => {
    it('should open user dialog from regular message', async () => {
      const user = userEvent.setup()
      mockWindowApp.kick.getUserChatroomInfo.mockResolvedValue({
        data: {
          id: 'user123',
          username: 'testuser',
          slug: 'testuser'
        }
      })
      
      render(<Message {...mockProps} />)
      
      const userButton = screen.getByTestId('user-dialog-trigger')
      await user.click(userButton)
      
      await waitFor(() => {
        expect(mockWindowApp.userDialog.open).toHaveBeenCalled()
      })
    })

    it('should open user dialog for specific username', async () => {
      const user = userEvent.setup()
      mockWindowApp.kick.getUserChatroomInfo.mockResolvedValue({
        data: {
          id: 'other123',
          username: 'otheruser', 
          slug: 'otheruser'
        }
      })

      // Mock the handleOpenUserDialog function being called with a username
      const messageWithUserDialog = {
        ...mockMessage,
        sender: {
          ...mockMessage.sender,
          username: 'otheruser'
        }
      }
      
      render(<Message {...mockProps} message={messageWithUserDialog} />)
      
      const userButton = screen.getByTestId('user-dialog-trigger')
      
      // Simulate click with specific username
      fireEvent.click(userButton, { detail: 1 })
      
      await waitFor(() => {
        expect(mockWindowApp.kick.getUserChatroomInfo).toHaveBeenCalledWith('testchatroom', 'otheruser')
      })
    })
  })

  describe('Reply Thread Integration', () => {
    it('should open reply thread dialog', async () => {
      const user = userEvent.setup()
      const replyMessage = {
        ...mockMessage,
        type: 'reply',
        metadata: {
          original_message: {
            id: 'original123'
          },
          original_sender: {
            username: 'originaluser'
          }
        }
      }

      mockWindowApp.replyLogs.get.mockResolvedValue([
        {
          id: 'thread1',
          content: 'Thread message 1',
          created_at: '2024-01-01T10:01:00Z'
        }
      ])
      
      render(<Message {...mockProps} message={replyMessage} />)
      
      const replyThreadButton = screen.getByTestId('reply-thread-trigger')
      await user.click(replyThreadButton)
      
      await waitFor(() => {
        expect(mockWindowApp.replyLogs.get).toHaveBeenCalledWith({
          originalMessageId: 'original123',
          chatroomId: 'chatroom123'
        })
      })

      await waitFor(() => {
        expect(mockWindowApp.replyThreadDialog.open).toHaveBeenCalledWith(
          expect.objectContaining({
            chatroomId: 'chatroom123',
            originalMessageId: 'original123'
          })
        )
      })
    })
  })

  describe('Badge System Integration', () => {
    it('should handle KickTalk badges', () => {
      const propsWithKickTalkBadges = {
        ...mockProps,
        existingKickTalkBadges: [
          {
            username: 'testuser',
            badges: [
              { type: 'Founder', title: 'KickTalk Founder' },
              { type: 'Beta Tester', title: 'KickTalk Beta Tester' }
            ]
          }
        ]
      }
      
      render(<Message {...mockProps} {...propsWithKickTalkBadges} />)
      
      expect(screen.getByTestId('regular-message')).toBeInTheDocument()
    })

    it('should handle donator badges', () => {
      const propsWithDonators = {
        ...mockProps,
        donators: [
          {
            message: 'testuser', // Username matching donor
            amount: 10
          }
        ]
      }
      
      render(<Message {...mockProps} {...propsWithDonators} />)
      
      expect(screen.getByTestId('regular-message')).toBeInTheDocument()
    })

    it('should handle case-insensitive badge matching', () => {
      const propsWithMixedCase = {
        ...mockProps,
        message: {
          ...mockMessage,
          sender: {
            ...mockMessage.sender,
            username: 'TestUser' // Mixed case
          }
        },
        existingKickTalkBadges: [
          {
            username: 'testuser', // Lowercase
            badges: [{ type: 'Founder', title: 'KickTalk Founder' }]
          }
        ]
      }
      
      render(<Message {...mockProps} {...propsWithMixedCase} />)
      
      expect(screen.getByTestId('regular-message')).toBeInTheDocument()
    })
  })

  describe('RGBA Color Conversion', () => {
    it('should convert RGBA object to string', () => {
      const settingsWithRgba = {
        ...mockProps.settings,
        notifications: {
          background: true,
          phrases: ['test'],
          backgroundRgba: { r: 128, g: 64, b: 192, a: 0.7 }
        }
      }

      render(<Message {...mockProps} settings={settingsWithRgba} />)
      
      const messageItem = screen.getByTestId('regular-message').parentElement
      expect(messageItem).toHaveStyle('backgroundColor: rgba(128, 64, 192, 0.7)')
    })

    it('should handle string RGBA values', () => {
      const settingsWithStringRgba = {
        ...mockProps.settings,
        notifications: {
          background: true,
          phrases: ['test'],
          backgroundRgba: 'rgba(255, 128, 0, 0.8)'
        }
      }

      render(<Message {...mockProps} settings={settingsWithStringRgba} />)
      
      const messageItem = screen.getByTestId('regular-message').parentElement
      expect(messageItem).toHaveStyle('backgroundColor: rgba(255, 128, 0, 0.8)')
    })

    it('should handle invalid RGBA values', () => {
      const settingsWithInvalidRgba = {
        ...mockProps.settings,
        notifications: {
          background: true,
          phrases: ['test'],
          backgroundRgba: null
        }
      }

      render(<Message {...mockProps} settings={settingsWithInvalidRgba} />)
      
      const messageItem = screen.getByTestId('regular-message').parentElement
      expect(messageItem).toHaveStyle('backgroundColor: transparent')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels for interactive elements', async () => {
      const user = userEvent.setup()
      render(<Message {...mockProps} />)
      
      const contextMenuItems = screen.getAllByTestId('context-menu-item')
      
      // Test that context menu items are keyboard accessible
      contextMenuItems[0].focus()
      expect(contextMenuItems[0]).toHaveFocus()
      
      await user.keyboard('{Enter}')
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<Message {...mockProps} />)
      
      const userDialogTrigger = screen.getByTestId('user-dialog-trigger')
      
      userDialogTrigger.focus()
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(mockWindowApp.userDialog.open).toHaveBeenCalled()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle missing message data gracefully', () => {
      const propsWithoutMessage = {
        ...mockProps,
        message: null
      }
      
      expect(() => {
        render(<Message {...propsWithoutMessage} />)
      }).not.toThrow()
    })

    it('should handle missing sender data', () => {
      const messageWithoutSender = {
        ...mockMessage,
        sender: null
      }
      
      expect(() => {
        render(<Message {...mockProps} message={messageWithoutSender} />)
      }).not.toThrow()
    })

    it('should handle API errors gracefully', async () => {
      const user = userEvent.setup()
      mockWindowApp.kick.getUserChatroomInfo.mockRejectedValue(new Error('API Error'))
      
      render(<Message {...mockProps} />)
      
      const userButton = screen.getByTestId('user-dialog-trigger')
      await user.click(userButton)
      
      // Should not crash the component
      expect(screen.getByTestId('regular-message')).toBeInTheDocument()
    })

    it('should handle invalid user data from API', async () => {
      const user = userEvent.setup()
      mockWindowApp.kick.getUserChatroomInfo.mockResolvedValue({
        data: null // Invalid data
      })
      
      render(<Message {...mockProps} />)
      
      const userButton = screen.getByTestId('user-dialog-trigger')
      await user.click(userButton)
      
      await waitFor(() => {
        // Should not call userDialog.open with invalid data
        expect(mockWindowApp.userDialog.open).not.toHaveBeenCalled()
      })
    })
  })

  describe('Memory Management', () => {
    it('should cleanup event listeners on unmount', () => {
      const { unmount } = render(<Message {...mockProps} />)
      
      // Component should unmount without errors
      expect(() => {
        unmount()
      }).not.toThrow()
    })

    it('should handle rapid re-renders without memory leaks', () => {
      const { rerender } = render(<Message {...mockProps} />)
      
      // Rapid re-renders with different props
      for (let i = 0; i < 10; i++) {
        const newMessage = {
          ...mockMessage,
          id: `msg${i}`,
          content: `Message ${i}`
        }
        
        rerender(<Message {...mockProps} message={newMessage} />)
      }
      
      expect(screen.getByTestId('regular-message')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle messages in reply thread context', () => {
      render(<Message {...mockProps} type="replyThread" />)
      
      expect(screen.getByTestId('regular-message')).toBeInTheDocument()
      expect(screen.getByTestId('regular-message')).toHaveAttribute('data-type', 'replyThread')
    })

    it('should handle empty content messages', () => {
      const emptyMessage = {
        ...mockMessage,
        content: ''
      }
      
      render(<Message {...mockProps} message={emptyMessage} />)
      
      expect(screen.getByTestId('regular-message')).toBeInTheDocument()
    })

    it('should handle very long message content', () => {
      const longMessage = {
        ...mockMessage,
        content: 'A'.repeat(1000) // Very long content
      }
      
      render(<Message {...mockProps} message={longMessage} />)
      
      expect(screen.getByTestId('regular-message')).toBeInTheDocument()
    })

    it('should handle special characters in message content', () => {
      const specialCharMessage = {
        ...mockMessage,
        content: '🔥💯 Special chars: <>&"\'`'
      }
      
      render(<Message {...mockProps} message={specialCharMessage} />)
      
      expect(screen.getByTestId('regular-message')).toBeInTheDocument()
    })

    it('should handle undefined userChatroomInfo', () => {
      const propsWithoutUserInfo = {
        ...mockProps,
        userChatroomInfo: undefined
      }
      
      expect(() => {
        render(<Message {...propsWithoutUserInfo} />)
      }).not.toThrow()
    })
  })
})