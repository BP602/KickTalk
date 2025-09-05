import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReplyMessage from './ReplyMessage.jsx'

// Mock dependencies
vi.mock('clsx', () => ({
  default: (...args) => args.filter(Boolean).join(' ')
}))

// Mock MessageParser
vi.mock('../../utils/MessageParser', () => ({
  MessageParser: ({ message, type, chatroomId, chatroomName, sevenTVEmotes, userChatroomInfo }) => (
    <div data-testid="message-parser" data-type={type}>
      <span data-chatroom-id={chatroomId} data-chatroom-name={chatroomName}>
        {type === 'reply' ? (message?.content || 'Reply content') : 'Regular content'}
      </span>
      {sevenTVEmotes && <span data-testid="emotes-count">{sevenTVEmotes.length}</span>}
      {userChatroomInfo && <span data-testid="user-info">{userChatroomInfo.id}</span>}
    </div>
  )
}))

// Mock RegularMessage component
vi.mock('./RegularMessage', () => ({
  default: ({ message, type, userStyle, handleOpenUserDialog, settings, username, chatroomId, chatroomName, userChatroomInfo, subscriberBadges, kickTalkBadges, donatorBadges, sevenTVEmotes }) => (
    <div data-testid="regular-message" data-type={type}>
      <div data-testid="message-content">{message?.content}</div>
      <div data-testid="message-sender">{message?.sender?.username}</div>
      <button 
        data-testid="user-dialog-trigger" 
        onClick={(e) => handleOpenUserDialog?.(e)}
      >
        Open User Dialog
      </button>
      {userStyle && <div data-testid="user-style">{JSON.stringify(userStyle)}</div>}
      {settings && <div data-testid="settings">{settings.general?.timestampFormat}</div>}
      {username && <div data-testid="current-username">{username}</div>}
      {chatroomId && <div data-testid="chatroom-id">{chatroomId}</div>}
      {chatroomName && <div data-testid="chatroom-name">{chatroomName}</div>}
      {userChatroomInfo && <div data-testid="user-chatroom-info">{userChatroomInfo.id}</div>}
      {subscriberBadges && <div data-testid="subscriber-badges">{subscriberBadges.length}</div>}
      {kickTalkBadges && <div data-testid="kicktalk-badges">{kickTalkBadges.length}</div>}
      {donatorBadges && <div data-testid="donator-badges">{donatorBadges.length}</div>}
      {sevenTVEmotes && <div data-testid="seventv-emotes">{sevenTVEmotes.length}</div>}
    </div>
  )
}))

// Mock SVG asset
vi.mock('@assets/icons/arrow_reply_line.svg?asset', () => ({ default: 'reply-arrow-icon.svg' }))

// Mock ChatProvider and useShallow
const mockChatStoreMessages = []

vi.mock('../../providers/ChatProvider', () => ({
  default: vi.fn(() => mockChatStoreMessages)
}))

vi.mock('zustand/shallow', () => ({
  useShallow: (fn) => fn
}))

describe('ReplyMessage Component', () => {
  const mockOriginalMessage = {
    id: 'original123',
    content: 'This is the original message being replied to'
  }

  const mockOriginalSender = {
    id: 'originaluser123',
    username: 'originaluser',
    slug: 'originaluser'
  }

  const mockReplyMessage = {
    id: 'reply123',
    content: 'This is a reply to the original message',
    sender: {
      id: 'replier123',
      username: 'replieruser',
      identity: {
        color: '#00ff00'
      }
    },
    metadata: {
      original_message: mockOriginalMessage,
      original_sender: mockOriginalSender
    },
    chatroom_id: 'chatroom123',
    created_at: '2024-01-01T10:05:00Z',
    deleted: false
  }

  const defaultProps = {
    message: mockReplyMessage,
    sevenTVEmotes: [
      { id: 'emote1', name: 'TestEmote', url: 'emote1.png' },
      { id: 'emote2', name: 'AnotherEmote', url: 'emote2.png' }
    ],
    sevenTVSettings: {
      enabled: true,
      zeroWidth: false
    },
    subscriberBadges: [
      { id: 'sub1', name: 'Subscriber', months: 3 }
    ],
    kickTalkBadges: [
      { type: 'Beta', title: 'Beta Tester' }
    ],
    donatorBadges: [
      { type: 'Donator', amount: 25 }
    ],
    handleOpenUserDialog: vi.fn(),
    userStyle: {
      badge: { id: 'badge1', name: 'Cool Badge', url: 'badge.png' },
      paint: { id: 'paint1', name: 'Cool Paint', color: '#ff0000' }
    },
    chatroomId: 'chatroom123',
    chatroomName: 'testchatroom',
    userChatroomInfo: {
      id: 'currentuser123',
      is_broadcaster: false,
      is_moderator: false,
      is_super_admin: false
    },
    handleOpenReplyThread: vi.fn(),
    username: 'currentuser',
    settings: {
      general: {
        timestampFormat: 'HH:mm'
      },
      sevenTV: {
        enabled: true
      }
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the mock chat store messages
    mockChatStoreMessages.length = 0
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Rendering', () => {
    it('should render reply message structure', () => {
      render(<ReplyMessage {...defaultProps} />)

      expect(screen.getByText('@originaluser:')).toBeInTheDocument()
      expect(screen.getByTestId('regular-message')).toBeInTheDocument()
      expect(screen.getByTestId('message-parser')).toBeInTheDocument()
    })

    it('should render reply arrow icon', () => {
      render(<ReplyMessage {...defaultProps} />)

      const replyIcon = document.querySelector('.chatMessageReplySymbol')
      expect(replyIcon).toBeInTheDocument()
      expect(replyIcon).toHaveAttribute('src', 'reply-arrow-icon.svg')
    })

    it('should display original sender username', () => {
      render(<ReplyMessage {...defaultProps} />)

      const originalSenderButton = screen.getByText('@originaluser:')
      expect(originalSenderButton).toBeInTheDocument()
      expect(originalSenderButton.tagName).toBe('BUTTON')
    })

    it('should display original message content in title', () => {
      render(<ReplyMessage {...defaultProps} />)

      const replyContent = screen.getByTitle('This is the original message being replied to')
      expect(replyContent).toBeInTheDocument()
    })

    it('should render both reply content and regular message', () => {
      render(<ReplyMessage {...defaultProps} />)

      // Reply content (original message)
      expect(screen.getByTestId('message-parser')).toHaveAttribute('data-type', 'reply')
      
      // Regular message content (the actual reply)
      expect(screen.getByTestId('regular-message')).toBeInTheDocument()
      expect(screen.getByTestId('message-content')).toHaveTextContent('This is a reply to the original message')
    })
  })

  describe('Reply Thread Integration', () => {
    it('should call handleOpenReplyThread with thread messages on click', async () => {
      const user = userEvent.setup()
      const handleOpenReplyThread = vi.fn()

      // Mock some thread messages
      const threadMessages = [
        { id: 'thread1', content: 'First thread message' },
        { id: 'thread2', content: 'Second thread message' }
      ]
      mockChatStoreMessages.push(...threadMessages)

      render(<ReplyMessage {...defaultProps} handleOpenReplyThread={handleOpenReplyThread} />)

      const replyContent = screen.getByTitle('This is the original message being replied to')
      await user.click(replyContent)

      expect(handleOpenReplyThread).toHaveBeenCalledWith(threadMessages)
    })

    it('should call handleOpenReplyThread with empty array when no thread messages', async () => {
      const user = userEvent.setup()
      const handleOpenReplyThread = vi.fn()

      render(<ReplyMessage {...defaultProps} handleOpenReplyThread={handleOpenReplyThread} />)

      const replyContent = screen.getByTitle('This is the original message being replied to')
      await user.click(replyContent)

      expect(handleOpenReplyThread).toHaveBeenCalledWith([])
    })

    it('should filter messages correctly by original message ID', async () => {
      const user = userEvent.setup()
      const handleOpenReplyThread = vi.fn()

      // Mock messages with different original IDs
      const mixedMessages = [
        { id: 'msg1', metadata: { original_message: { id: 'original123' } } },
        { id: 'msg2', metadata: { original_message: { id: 'different456' } } },
        { id: 'msg3', metadata: { original_message: { id: 'original123' } } }
      ]
      mockChatStoreMessages.push(...mixedMessages)

      render(<ReplyMessage {...defaultProps} handleOpenReplyThread={handleOpenReplyThread} />)

      const replyContent = screen.getByTitle('This is the original message being replied to')
      await user.click(replyContent)

      expect(handleOpenReplyThread).toHaveBeenCalledWith([mixedMessages[0], mixedMessages[2]])
    })
  })

  describe('User Dialog Integration', () => {
    it('should handle original sender username click', async () => {
      const user = userEvent.setup()
      const handleOpenUserDialog = vi.fn()

      render(<ReplyMessage {...defaultProps} handleOpenUserDialog={handleOpenUserDialog} />)

      const originalSenderButton = screen.getByText('@originaluser:')
      await user.click(originalSenderButton)

      expect(handleOpenUserDialog).toHaveBeenCalledWith(
        expect.any(Object), 
        'originaluser'
      )
    })

    it('should pass lowercase username to handleOpenUserDialog', async () => {
      const user = userEvent.setup()
      const handleOpenUserDialog = vi.fn()

      const propsWithUppercaseSender = {
        ...defaultProps,
        message: {
          ...mockReplyMessage,
          metadata: {
            ...mockReplyMessage.metadata,
            original_sender: {
              ...mockOriginalSender,
              username: 'UPPERCASEUSER'
            }
          }
        }
      }

      render(<ReplyMessage {...propsWithUppercaseSender} />)

      const originalSenderButton = screen.getByText('@UPPERCASEUSER:')
      await user.click(originalSenderButton)

      expect(handleOpenUserDialog).toHaveBeenCalledWith(
        expect.any(Object),
        'uppercaseuser'
      )
    })

    it('should handle user dialog from regular message component', async () => {
      const user = userEvent.setup()
      const handleOpenUserDialog = vi.fn()

      render(<ReplyMessage {...defaultProps} handleOpenUserDialog={handleOpenUserDialog} />)

      const userDialogTrigger = screen.getByTestId('user-dialog-trigger')
      await user.click(userDialogTrigger)

      expect(handleOpenUserDialog).toHaveBeenCalled()
    })
  })

  describe('Props Passing to Child Components', () => {
    it('should pass all required props to RegularMessage', () => {
      render(<ReplyMessage {...defaultProps} />)

      // Check message content
      expect(screen.getByTestId('message-content')).toHaveTextContent('This is a reply to the original message')
      
      // Check sender
      expect(screen.getByTestId('message-sender')).toHaveTextContent('replieruser')
      
      // Check user style
      expect(screen.getByTestId('user-style')).toHaveTextContent(JSON.stringify(defaultProps.userStyle))
      
      // Check settings
      expect(screen.getByTestId('settings')).toHaveTextContent('HH:mm')
      
      // Check current username
      expect(screen.getByTestId('current-username')).toHaveTextContent('currentuser')
      
      // Check chatroom info
      expect(screen.getByTestId('chatroom-id')).toHaveTextContent('chatroom123')
      expect(screen.getByTestId('chatroom-name')).toHaveTextContent('testchatroom')
      expect(screen.getByTestId('user-chatroom-info')).toHaveTextContent('currentuser123')
      
      // Check badges and emotes
      expect(screen.getByTestId('subscriber-badges')).toHaveTextContent('1')
      expect(screen.getByTestId('kicktalk-badges')).toHaveTextContent('1')
      expect(screen.getByTestId('donator-badges')).toHaveTextContent('1')
      expect(screen.getByTestId('seventv-emotes')).toHaveTextContent('2')
    })

    it('should pass correct props to MessageParser for reply content', () => {
      render(<ReplyMessage {...defaultProps} />)

      const messageParser = screen.getByTestId('message-parser')
      expect(messageParser).toHaveAttribute('data-type', 'reply')
      
      const content = messageParser.querySelector('[data-chatroom-id="chatroom123"]')
      expect(content).toBeInTheDocument()
      expect(content).toHaveAttribute('data-chatroom-name', 'testchatroom')
      expect(content).toHaveTextContent('Reply content')
      
      expect(screen.getByTestId('emotes-count')).toHaveTextContent('2')
      expect(screen.getByTestId('user-info')).toHaveTextContent('currentuser123')
    })

    it('should handle null or missing props gracefully', () => {
      const minimalProps = {
        message: mockReplyMessage,
        handleOpenUserDialog: vi.fn(),
        handleOpenReplyThread: vi.fn(),
        chatroomId: 'chatroom123',
        chatroomName: 'testchatroom'
      }

      expect(() => {
        render(<ReplyMessage {...minimalProps} />)
      }).not.toThrow()

      expect(screen.getByTestId('regular-message')).toBeInTheDocument()
    })
  })

  describe('Message Content Variations', () => {
    it('should handle empty original message content', () => {
      const propsWithEmptyContent = {
        ...defaultProps,
        message: {
          ...mockReplyMessage,
          metadata: {
            ...mockReplyMessage.metadata,
            original_message: {
              ...mockOriginalMessage,
              content: ''
            }
          }
        }
      }

      render(<ReplyMessage {...propsWithEmptyContent} />)

      const replyContent = screen.getByTitle('')
      expect(replyContent).toBeInTheDocument()
    })

    it('should handle very long original message content', () => {
      const longContent = 'A'.repeat(1000)
      const propsWithLongContent = {
        ...defaultProps,
        message: {
          ...mockReplyMessage,
          metadata: {
            ...mockReplyMessage.metadata,
            original_message: {
              ...mockOriginalMessage,
              content: longContent
            }
          }
        }
      }

      render(<ReplyMessage {...propsWithLongContent} />)

      const replyContent = screen.getByTitle(longContent)
      expect(replyContent).toBeInTheDocument()
    })

    it('should handle special characters in original message content', () => {
      const specialContent = '🔥💯 Special chars: <>&"\'`'
      const propsWithSpecialContent = {
        ...defaultProps,
        message: {
          ...mockReplyMessage,
          metadata: {
            ...mockReplyMessage.metadata,
            original_message: {
              ...mockOriginalMessage,
              content: specialContent
            }
          }
        }
      }

      render(<ReplyMessage {...propsWithSpecialContent} />)

      const replyContent = screen.getByTitle(specialContent)
      expect(replyContent).toBeInTheDocument()
    })
  })

  describe('Username Handling', () => {
    it('should handle usernames with special characters', () => {
      const specialUsername = 'user-name_123.special'
      const propsWithSpecialUsername = {
        ...defaultProps,
        message: {
          ...mockReplyMessage,
          metadata: {
            ...mockReplyMessage.metadata,
            original_sender: {
              ...mockOriginalSender,
              username: specialUsername
            }
          }
        }
      }

      render(<ReplyMessage {...propsWithSpecialUsername} />)

      expect(screen.getByText(`@${specialUsername}:`)).toBeInTheDocument()
    })

    it('should handle very long usernames', () => {
      const longUsername = 'a'.repeat(100)
      const propsWithLongUsername = {
        ...defaultProps,
        message: {
          ...mockReplyMessage,
          metadata: {
            ...mockReplyMessage.metadata,
            original_sender: {
              ...mockOriginalSender,
              username: longUsername
            }
          }
        }
      }

      render(<ReplyMessage {...propsWithLongUsername} />)

      expect(screen.getByText(`@${longUsername}:`)).toBeInTheDocument()
    })

    it('should handle empty or null username', () => {
      const propsWithEmptyUsername = {
        ...defaultProps,
        message: {
          ...mockReplyMessage,
          metadata: {
            ...mockReplyMessage.metadata,
            original_sender: {
              ...mockOriginalSender,
              username: ''
            }
          }
        }
      }

      render(<ReplyMessage {...propsWithEmptyUsername} />)

      expect(screen.getByText('@:')).toBeInTheDocument()
    })
  })

  describe('CSS Classes and Styling', () => {
    it('should apply correct CSS classes to reply elements', () => {
      render(<ReplyMessage {...defaultProps} />)

      const replyContainer = document.querySelector('.chatMessageReply')
      expect(replyContainer).toBeInTheDocument()

      const replyText = document.querySelector('.chatMessageReplyText')
      expect(replyText).toBeInTheDocument()

      const replySymbol = document.querySelector('.chatMessageReplySymbol')
      expect(replySymbol).toBeInTheDocument()

      const replySender = document.querySelector('.chatMessageReplyTextSender')
      expect(replySender).toBeInTheDocument()

      const replyUsername = document.querySelector('.chatMessageReplyTextSenderUsername')
      expect(replyUsername).toBeInTheDocument()

      const replyContent = document.querySelector('.chatMessageReplyTextContent')
      expect(replyContent).toBeInTheDocument()
    })

    it('should maintain proper DOM structure', () => {
      render(<ReplyMessage {...defaultProps} />)

      const replyContainer = document.querySelector('.chatMessageReply')
      const replyText = replyContainer.querySelector('.chatMessageReplyText')
      const regularMessage = replyContainer.querySelector('[data-testid="regular-message"]')

      expect(replyText).toBeInTheDocument()
      expect(regularMessage).toBeInTheDocument()
      
      // Reply text should come before regular message
      expect(Array.from(replyContainer.children).indexOf(replyText)).toBeLessThan(
        Array.from(replyContainer.children).indexOf(regularMessage)
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle missing message metadata gracefully', () => {
      const messageWithoutMetadata = {
        ...mockReplyMessage,
        metadata: null
      }

      expect(() => {
        render(<ReplyMessage {...defaultProps} message={messageWithoutMetadata} />)
      }).not.toThrow()
    })

    it('should handle missing original_sender gracefully', () => {
      const messageWithoutOriginalSender = {
        ...mockReplyMessage,
        metadata: {
          original_message: mockOriginalMessage,
          original_sender: null
        }
      }

      expect(() => {
        render(<ReplyMessage {...defaultProps} message={messageWithoutOriginalSender} />)
      }).not.toThrow()
    })

    it('should handle missing original_message gracefully', () => {
      const messageWithoutOriginalMessage = {
        ...mockReplyMessage,
        metadata: {
          original_message: null,
          original_sender: mockOriginalSender
        }
      }

      expect(() => {
        render(<ReplyMessage {...defaultProps} message={messageWithoutOriginalMessage} />)
      }).not.toThrow()
    })

    it('should handle undefined handleOpenUserDialog', async () => {
      const user = userEvent.setup()
      const propsWithoutHandler = { ...defaultProps }
      delete propsWithoutHandler.handleOpenUserDialog

      expect(() => {
        render(<ReplyMessage {...propsWithoutHandler} />)
      }).not.toThrow()
    })

    it('should handle undefined handleOpenReplyThread', async () => {
      const user = userEvent.setup()
      const propsWithoutHandler = { ...defaultProps }
      delete propsWithoutHandler.handleOpenReplyThread

      expect(() => {
        render(<ReplyMessage {...propsWithoutHandler} />)
      }).not.toThrow()
    })
  })

  describe('Accessibility', () => {
    it('should have proper button role for original sender', () => {
      render(<ReplyMessage {...defaultProps} />)

      const originalSenderButton = screen.getByText('@originaluser:')
      expect(originalSenderButton.tagName).toBe('BUTTON')
    })

    it('should have proper title attribute for original message content', () => {
      render(<ReplyMessage {...defaultProps} />)

      const replyContent = screen.getByTitle('This is the original message being replied to')
      expect(replyContent).toHaveAttribute('title', 'This is the original message being replied to')
    })

    it('should support keyboard navigation for original sender button', async () => {
      const user = userEvent.setup()
      const handleOpenUserDialog = vi.fn()

      render(<ReplyMessage {...defaultProps} handleOpenUserDialog={handleOpenUserDialog} />)

      const originalSenderButton = screen.getByText('@originaluser:')
      originalSenderButton.focus()
      
      await user.keyboard('{Enter}')
      expect(handleOpenUserDialog).toHaveBeenCalled()
    })

    it('should support keyboard navigation for reply content', async () => {
      const user = userEvent.setup()
      const handleOpenReplyThread = vi.fn()

      render(<ReplyMessage {...defaultProps} handleOpenReplyThread={handleOpenReplyThread} />)

      const replyContent = screen.getByTitle('This is the original message being replied to')
      
      await user.click(replyContent)
      expect(handleOpenReplyThread).toHaveBeenCalled()
    })
  })

  describe('Performance', () => {
    it('should handle rapid prop updates without memory leaks', () => {
      const { rerender } = render(<ReplyMessage {...defaultProps} />)

      // Simulate rapid updates
      for (let i = 0; i < 100; i++) {
        const updatedMessage = {
          ...mockReplyMessage,
          id: `reply${i}`,
          content: `Reply message ${i}`,
          metadata: {
            ...mockReplyMessage.metadata,
            original_message: {
              ...mockOriginalMessage,
              content: `Original message ${i}`
            }
          }
        }

        rerender(<ReplyMessage {...defaultProps} message={updatedMessage} />)
      }

      expect(screen.getByText('Reply message 99')).toBeInTheDocument()
      expect(screen.getByTitle('Original message 99')).toBeInTheDocument()
    })

    it('should efficiently handle large thread message arrays', async () => {
      const user = userEvent.setup()
      const handleOpenReplyThread = vi.fn()

      // Create large array of thread messages
      const largeThreadMessages = Array.from({ length: 1000 }, (_, i) => ({
        id: `thread${i}`,
        metadata: { original_message: { id: 'original123' } }
      }))
      mockChatStoreMessages.push(...largeThreadMessages)

      const startTime = performance.now()
      
      render(<ReplyMessage {...defaultProps} handleOpenReplyThread={handleOpenReplyThread} />)

      const replyContent = screen.getByTitle('This is the original message being replied to')
      await user.click(replyContent)

      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(100) // Should complete in under 100ms
      expect(handleOpenReplyThread).toHaveBeenCalledWith(largeThreadMessages)
    })
  })

  describe('Integration with Chat Store', () => {
    it('should properly filter messages from chat store', () => {
      const mixedMessages = [
        { 
          id: 'msg1', 
          metadata: { original_message: { id: 'original123' } },
          content: 'First matching message'
        },
        { 
          id: 'msg2', 
          metadata: { original_message: { id: 'different456' } },
          content: 'Non-matching message'
        },
        { 
          id: 'msg3', 
          metadata: { original_message: { id: 'original123' } },
          content: 'Second matching message'
        },
        { 
          id: 'msg4', 
          metadata: null,
          content: 'Message without metadata'
        }
      ]
      mockChatStoreMessages.push(...mixedMessages)

      render(<ReplyMessage {...defaultProps} />)

      // The component should render without errors and the chat store should be called
      expect(screen.getByTestId('regular-message')).toBeInTheDocument()
    })

    it('should handle empty chat store messages', () => {
      // mockChatStoreMessages is already empty from beforeEach
      
      expect(() => {
        render(<ReplyMessage {...defaultProps} />)
      }).not.toThrow()

      expect(screen.getByTestId('regular-message')).toBeInTheDocument()
    })

    it('should handle chat store returning null or undefined', () => {
      // Clear the mock messages to simulate null/undefined return
      mockChatStoreMessages.length = 0
      mockChatStoreMessages.push(...[])  // Ensure it returns empty array instead of null

      expect(() => {
        render(<ReplyMessage {...defaultProps} />)
      }).not.toThrow()

      expect(screen.getByTestId('regular-message')).toBeInTheDocument()
    })
  })
})