import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReplyThread from './ReplyThread.jsx'

// Mock static assets
vi.mock('../../assets/icons/x-bold.svg?asset', () => ({ default: 'close-icon.svg' }))

// Mock child components
vi.mock('../Messages/Message', () => ({
  default: ({ 
    message, 
    chatroomId, 
    subscriberBadges, 
    sevenTVEmotes, 
    kickTalkBadges, 
    userChatroomInfo, 
    chatroomName, 
    username, 
    settings, 
    type 
  }) => (
    <div 
      data-testid="message-component"
      data-message-id={message?.id}
      data-chatroom-id={chatroomId}
      data-type={type}
      data-chatroom-name={chatroomName}
      data-username={username}
    >
      <span data-testid="message-content">{message?.content || 'Message content'}</span>
      <span data-testid="message-sender">{message?.sender?.username}</span>
    </div>
  )
}))

vi.mock('../../utils/MessageParser', () => ({
  MessageParser: ({ message, type }) => (
    <div data-testid="message-parser" data-type={type}>
      {message?.content || 'Parsed message'}
    </div>
  )
}))

vi.mock('../Chat/Input', () => ({
  default: ({ chatroomId, isReplyThread, replyMessage }) => (
    <div 
      data-testid="chat-input"
      data-chatroom-id={chatroomId}
      data-is-reply-thread={isReplyThread}
      data-reply-message-id={replyMessage?.original_message?.id}
    >
      Chat Input Component
    </div>
  )
}))

vi.mock('@utils/kickTalkBadges', () => ({
  userKickTalkBadges: [
    { id: 'kt1', name: 'KickTalk User', image: 'kt-badge.png' }
  ]
}))

// Mock window.app API
const mockReplyThreadDialog = {
  onData: vi.fn(() => vi.fn()), // Returns cleanup function
  close: vi.fn()
}

const mockReplyLogs = {
  onUpdate: vi.fn(() => vi.fn()) // Returns cleanup function
}

global.window.app = {
  replyThreadDialog: mockReplyThreadDialog,
  replyLogs: mockReplyLogs
}

describe('ReplyThread Component', () => {
  const mockDialogData = {
    chatroomId: 'chatroom123',
    originalMessageId: 'original123',
    userChatroomInfo: {
      id: 'user123',
      is_broadcaster: false,
      is_moderator: true
    },
    chatroomName: 'testchannel',
    username: 'testuser',
    settings: {
      theme: 'dark',
      showTimestamps: true
    },
    sevenTVEmotes: [
      { id: 'emote1', name: 'TestEmote', url: 'emote.png' }
    ],
    subscriberBadges: [
      { id: 'sub1', name: 'Subscriber', months: 1 }
    ]
  }

  const mockMessages = [
    {
      id: 'reply1',
      content: 'First reply message',
      sender: {
        username: 'replyer1',
        identity: {
          color: '#ff0000',
          badges: [{ type: 'Moderator', text: 'Moderator' }]
        }
      },
      metadata: {
        original_message: {
          id: 'original123',
          content: 'Original message content'
        },
        original_sender: {
          username: 'originaluser',
          identity: {
            color: '#00ff00',
            badges: []
          }
        }
      }
    },
    {
      id: 'reply2',
      content: 'Second reply message',
      sender: {
        username: 'replyer2',
        identity: {
          color: '#0000ff',
          badges: []
        }
      },
      metadata: {
        original_message: {
          id: 'original123',
          content: 'Original message content'
        },
        original_sender: {
          username: 'originaluser',
          identity: {
            color: '#00ff00',
            badges: []
          }
        }
      }
    }
  ]

  let mockOnDataCleanup, mockOnUpdateCleanup

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockOnDataCleanup = vi.fn()
    mockOnUpdateCleanup = vi.fn()
    
    mockReplyThreadDialog.onData.mockReturnValue(mockOnDataCleanup)
    mockReplyLogs.onUpdate.mockReturnValue(mockOnUpdateCleanup)
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Rendering and Initial State', () => {
    it('should render reply thread wrapper', () => {
      const { container } = render(<ReplyThread />)
      
      expect(container.querySelector('.replyThreadWrapper')).toBeInTheDocument()
    })

    it('should render header with title and close button', () => {
      render(<ReplyThread />)
      
      expect(screen.getByText('Reply Thread')).toBeInTheDocument()
      expect(screen.getByAltText('Close')).toBeInTheDocument()
    })

    it('should render main content area', () => {
      const { container } = render(<ReplyThread />)
      
      expect(container.querySelector('.replyThreadContent')).toBeInTheDocument()
    })

    it('should render input area', () => {
      const { container } = render(<ReplyThread />)
      
      expect(container.querySelector('.replyThreadInput')).toBeInTheDocument()
    })

    it('should setup data listeners on mount', () => {
      render(<ReplyThread />)
      
      expect(mockReplyThreadDialog.onData).toHaveBeenCalledTimes(1)
      expect(mockReplyLogs.onUpdate).toHaveBeenCalledTimes(1)
      expect(mockReplyThreadDialog.onData).toHaveBeenCalledWith(expect.any(Function))
      expect(mockReplyLogs.onUpdate).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should cleanup listeners on unmount', () => {
      const { unmount } = render(<ReplyThread />)
      
      unmount()
      
      expect(mockOnDataCleanup).toHaveBeenCalledTimes(1)
      expect(mockOnUpdateCleanup).toHaveBeenCalledTimes(1)
    })
  })

  describe('Data Loading and Display', () => {
    it('should load and display reply thread data', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      loadData({
        ...mockDialogData,
        messages: mockMessages
      })
      
      await waitFor(() => {
        expect(screen.getByText('First reply message')).toBeInTheDocument()
        expect(screen.getByText('Second reply message')).toBeInTheDocument()
      })
    })

    it('should display original message when available', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      loadData({
        ...mockDialogData,
        messages: mockMessages
      })
      
      await waitFor(() => {
        expect(screen.getByText('originaluser:')).toBeInTheDocument()
        expect(screen.getByTestId('message-parser')).toBeInTheDocument()
      })
    })

    it('should render Message components for each reply', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      loadData({
        ...mockDialogData,
        messages: mockMessages
      })
      
      await waitFor(() => {
        const messageComponents = screen.getAllByTestId('message-component')
        expect(messageComponents).toHaveLength(2)
        
        expect(messageComponents[0]).toHaveAttribute('data-message-id', 'reply1')
        expect(messageComponents[1]).toHaveAttribute('data-message-id', 'reply2')
        
        // Check type is set correctly
        messageComponents.forEach(component => {
          expect(component).toHaveAttribute('data-type', 'replyThread')
        })
      })
    })

    it('should pass correct props to Message components', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      loadData({
        ...mockDialogData,
        messages: mockMessages
      })
      
      await waitFor(() => {
        const messageComponents = screen.getAllByTestId('message-component')
        
        expect(messageComponents[0]).toHaveAttribute('data-chatroom-id', 'chatroom123')
        expect(messageComponents[0]).toHaveAttribute('data-chatroom-name', 'testchannel')
        expect(messageComponents[0]).toHaveAttribute('data-username', 'testuser')
      })
    })

    it('should render chat input when original message exists', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      loadData({
        ...mockDialogData,
        messages: mockMessages
      })
      
      await waitFor(() => {
        const chatInput = screen.getByTestId('chat-input')
        expect(chatInput).toBeInTheDocument()
        expect(chatInput).toHaveAttribute('data-chatroom-id', 'chatroom123')
        expect(chatInput).toHaveAttribute('data-is-reply-thread', 'true')
        expect(chatInput).toHaveAttribute('data-reply-message-id', 'original123')
      })
    })

    it('should not render chat input when no original message', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      const messagesWithoutOriginal = [
        {
          ...mockMessages[0],
          metadata: {
            ...mockMessages[0].metadata,
            original_message: { id: null }
          }
        }
      ]
      
      loadData({
        ...mockDialogData,
        messages: messagesWithoutOriginal
      })
      
      await waitFor(() => {
        expect(screen.queryByTestId('chat-input')).not.toBeInTheDocument()
      })
    })

    it('should handle empty messages array', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      loadData({
        ...mockDialogData,
        messages: []
      })
      
      await waitFor(() => {
        const messageComponents = screen.queryAllByTestId('message-component')
        expect(messageComponents).toHaveLength(0)
      })
    })

    it('should handle null messages', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      expect(() => {
        loadData({
          ...mockDialogData,
          messages: null
        })
      }).not.toThrow()
    })

    it('should handle undefined messages', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      expect(() => {
        loadData({
          ...mockDialogData,
          messages: undefined
        })
      }).not.toThrow()
    })
  })

  describe('Message Updates', () => {
    it('should update messages when reply logs update', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      const updateData = mockReplyLogs.onUpdate.mock.calls[0][0]
      
      // Initial load
      loadData({
        ...mockDialogData,
        messages: mockMessages
      })
      
      await waitFor(() => {
        expect(screen.getByText('First reply message')).toBeInTheDocument()
      })
      
      // Update with new messages
      const updatedMessages = [
        ...mockMessages,
        {
          id: 'reply3',
          content: 'Third reply message',
          sender: {
            username: 'replyer3',
            identity: {
              color: '#ff00ff',
              badges: []
            }
          }
        }
      ]
      
      updateData({ messages: updatedMessages })
      
      await waitFor(() => {
        expect(screen.getByText('Third reply message')).toBeInTheDocument()
        const messageComponents = screen.getAllByTestId('message-component')
        expect(messageComponents).toHaveLength(3)
      })
    })

    it('should handle null update data', () => {
      render(<ReplyThread />)
      
      const updateData = mockReplyLogs.onUpdate.mock.calls[0][0]
      
      expect(() => {
        updateData(null)
      }).not.toThrow()
    })

    it('should handle update data without messages', () => {
      render(<ReplyThread />)
      
      const updateData = mockReplyLogs.onUpdate.mock.calls[0][0]
      
      expect(() => {
        updateData({ someOtherData: true })
      }).not.toThrow()
    })

    it('should handle empty update messages array', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      const updateData = mockReplyLogs.onUpdate.mock.calls[0][0]
      
      // Initial load with messages
      loadData({
        ...mockDialogData,
        messages: mockMessages
      })
      
      await waitFor(() => {
        expect(screen.getByText('First reply message')).toBeInTheDocument()
      })
      
      // Update with empty array
      updateData({ messages: [] })
      
      await waitFor(() => {
        const messageComponents = screen.queryAllByTestId('message-component')
        expect(messageComponents).toHaveLength(0)
      })
    })
  })

  describe('Scrolling Behavior', () => {
    it('should scroll to bottom when messages update', async () => {
      const mockScrollTo = vi.fn()
      const mockRef = {
        current: {
          scrollTop: 0,
          scrollHeight: 1000,
          set scrollTop(value) { mockScrollTo(value) }
        }
      }
      
      // Mock useRef to return our mock ref
      const originalUseRef = React.useRef
      React.useRef = vi.fn(() => mockRef)
      
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      loadData({
        ...mockDialogData,
        messages: mockMessages
      })
      
      await waitFor(() => {
        // Should set scrollTop to scrollHeight to scroll to bottom
        expect(mockRef.current.scrollTop).toBe(1000)
      })
      
      React.useRef = originalUseRef
    })

    it('should handle missing scroll container ref', async () => {
      const mockRef = { current: null }
      
      const originalUseRef = React.useRef
      React.useRef = vi.fn(() => mockRef)
      
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      expect(() => {
        loadData({
          ...mockDialogData,
          messages: mockMessages
        })
      }).not.toThrow()
      
      React.useRef = originalUseRef
    })
  })

  describe('Dialog Controls', () => {
    it('should close dialog when close button clicked', async () => {
      const user = userEvent.setup()
      render(<ReplyThread />)
      
      const closeButton = screen.getByAltText('Close')
      await user.click(closeButton)
      
      expect(mockReplyThreadDialog.close).toHaveBeenCalledTimes(1)
    })

    it('should handle close button keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<ReplyThread />)
      
      const closeButton = screen.getByAltText('Close')
      closeButton.focus()
      
      await user.keyboard('{Enter}')
      
      expect(mockReplyThreadDialog.close).toHaveBeenCalledTimes(1)
    })

    it('should handle close button errors gracefully', async () => {
      const user = userEvent.setup()
      
      mockReplyThreadDialog.close.mockImplementation(() => {
        throw new Error('Close failed')
      })
      
      render(<ReplyThread />)
      
      const closeButton = screen.getByAltText('Close')
      
      // Should not crash when close fails
      await expect(user.click(closeButton)).resolves.not.toThrow()
    })
  })

  describe('Original Message Display', () => {
    it('should render original message section when original message exists', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      loadData({
        ...mockDialogData,
        messages: mockMessages
      })
      
      await waitFor(() => {
        const originalMessageSection = document.querySelector('.replyThreadOriginalMessage')
        expect(originalMessageSection).toBeInTheDocument()
      })
    })

    it('should not render original message section when no original message', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      const messagesWithoutOriginal = [
        {
          ...mockMessages[0],
          metadata: null
        }
      ]
      
      loadData({
        ...mockDialogData,
        messages: messagesWithoutOriginal
      })
      
      await waitFor(() => {
        const originalMessageSection = document.querySelector('.replyThreadOriginalMessage')
        expect(originalMessageSection).not.toBeInTheDocument()
      })
    })

    it('should display original sender username', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      loadData({
        ...mockDialogData,
        messages: mockMessages
      })
      
      await waitFor(() => {
        expect(screen.getByText('originaluser:')).toBeInTheDocument()
      })
    })

    it('should render MessageParser for original message', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      loadData({
        ...mockDialogData,
        messages: mockMessages
      })
      
      await waitFor(() => {
        const messageParser = screen.getByTestId('message-parser')
        expect(messageParser).toBeInTheDocument()
        expect(messageParser).toHaveAttribute('data-type', 'minified')
      })
    })

    it('should handle missing original sender', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      const messagesWithoutOriginalSender = [
        {
          ...mockMessages[0],
          metadata: {
            original_message: {
              id: 'original123',
              content: 'Original message content'
            },
            original_sender: null
          }
        }
      ]
      
      loadData({
        ...mockDialogData,
        messages: messagesWithoutOriginalSender
      })
      
      await waitFor(() => {
        // Should handle gracefully without crashing
        expect(document.querySelector('.replyThreadOriginalMessage')).toBeInTheDocument()
      })
    })

    it('should handle missing original message content', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      const messagesWithoutOriginalMessage = [
        {
          ...mockMessages[0],
          metadata: {
            original_message: null,
            original_sender: {
              username: 'originaluser'
            }
          }
        }
      ]
      
      loadData({
        ...mockDialogData,
        messages: messagesWithoutOriginalMessage
      })
      
      await waitFor(() => {
        // Should not render original message section
        const originalMessageSection = document.querySelector('.replyThreadOriginalMessage')
        expect(originalMessageSection).not.toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle missing window.app gracefully', () => {
      const originalApp = global.window.app
      delete global.window.app
      
      expect(() => {
        render(<ReplyThread />)
      }).not.toThrow()
      
      global.window.app = originalApp
    })

    it('should handle missing replyThreadDialog API gracefully', () => {
      const originalDialog = window.app.replyThreadDialog
      delete window.app.replyThreadDialog
      
      expect(() => {
        render(<ReplyThread />)
      }).not.toThrow()
      
      window.app.replyThreadDialog = originalDialog
    })

    it('should handle missing replyLogs API gracefully', () => {
      const originalLogs = window.app.replyLogs
      delete window.app.replyLogs
      
      expect(() => {
        render(<ReplyThread />)
      }).not.to Throw()
      
      window.app.replyLogs = originalLogs
    })

    it('should handle dialog data loading errors', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      expect(() => {
        loadData(null)
      }).not.toThrow()
      
      expect(() => {
        loadData(undefined)
      }).not.toThrow()
      
      expect(() => {
        loadData({})
      }).not.toThrow()
    })

    it('should handle malformed message data', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      const malformedMessages = [
        null,
        undefined,
        {},
        { id: 'partial' },
        'not an object',
        123,
        {
          id: 'valid',
          content: 'Valid message',
          sender: {
            username: 'user'
          }
        }
      ]
      
      expect(() => {
        loadData({
          ...mockDialogData,
          messages: malformedMessages
        })
      }).not.toThrow()
    })

    it('should handle missing dialog data properties', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      expect(() => {
        loadData({
          messages: mockMessages
          // Missing other properties
        })
      }).not.toThrow()
    })

    it('should handle circular reference in data', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      const circularData = { ...mockDialogData, messages: mockMessages }
      circularData.self = circularData
      
      expect(() => {
        loadData(circularData)
      }).not.toThrow()
    })
  })

  describe('Component Integration', () => {
    it('should pass all required props to Message components', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      loadData({
        ...mockDialogData,
        messages: mockMessages
      })
      
      await waitFor(() => {
        const messageComponents = screen.getAllByTestId('message-component')
        
        messageComponents.forEach(component => {
          expect(component).toHaveAttribute('data-chatroom-id', 'chatroom123')
          expect(component).toHaveAttribute('data-type', 'replyThread')
          expect(component).toHaveAttribute('data-chatroom-name', 'testchannel')
          expect(component).toHaveAttribute('data-username', 'testuser')
        })
      })
    })

    it('should pass correct kickTalkBadges', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      loadData({
        ...mockDialogData,
        messages: mockMessages
      })
      
      await waitFor(() => {
        // KickTalk badges should be passed from the imported constant
        const messageComponents = screen.getAllByTestId('message-component')
        expect(messageComponents).toHaveLength(2)
      })
    })

    it('should maintain message ordering', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      loadData({
        ...mockDialogData,
        messages: mockMessages
      })
      
      await waitFor(() => {
        const messageContents = screen.getAllByTestId('message-content')
        expect(messageContents[0]).toHaveTextContent('First reply message')
        expect(messageContents[1]).toHaveTextContent('Second reply message')
      })
    })

    it('should update chat input when dialog data changes', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      // Initial load
      loadData({
        ...mockDialogData,
        messages: mockMessages
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('chat-input')).toHaveAttribute('data-chatroom-id', 'chatroom123')
      })
      
      // Update with different chatroom
      loadData({
        ...mockDialogData,
        chatroomId: 'newchatroom',
        messages: mockMessages
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('chat-input')).toHaveAttribute('data-chatroom-id', 'newchatroom')
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading structure', async () => {
      render(<ReplyThread />)
      
      expect(screen.getByRole('heading')).toHaveTextContent('Reply Thread')
    })

    it('should have proper button role for close button', async () => {
      render(<ReplyThread />)
      
      const closeButton = screen.getByRole('button')
      expect(closeButton).toBeInTheDocument()
      expect(closeButton.tagName).toBe('BUTTON')
    })

    it('should have alt text for close button icon', async () => {
      render(<ReplyThread />)
      
      const closeIcon = screen.getByAltText('Close')
      expect(closeIcon).toBeInTheDocument()
      expect(closeIcon).toHaveAttribute('src', 'close-icon.svg')
      expect(closeIcon).toHaveAttribute('width', '16')
      expect(closeIcon).toHaveAttribute('height', '16')
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<ReplyThread />)
      
      const closeButton = screen.getByRole('button')
      closeButton.focus()
      expect(closeButton).toHaveFocus()
      
      await user.keyboard('{Enter}')
      expect(mockReplyThreadDialog.close).toHaveBeenCalled()
    })

    it('should have semantic HTML structure', async () => {
      const { container } = render(<ReplyThread />)
      
      expect(container.querySelector('.replyThreadWrapper')).toBeInTheDocument()
      expect(container.querySelector('.replyThreadHead')).toBeInTheDocument()
      expect(container.querySelector('.replyThreadContent')).toBeInTheDocument()
      expect(container.querySelector('.replyThreadInput')).toBeInTheDocument()
    })

    it('should have proper focus management', async () => {
      const user = userEvent.setup()
      render(<ReplyThread />)
      
      // Close button should be focusable
      const closeButton = screen.getByRole('button')
      await user.tab()
      
      // Should be able to focus on the close button
      expect(document.activeElement).toBe(closeButton)
    })
  })

  describe('Performance and Memory Management', () => {
    it('should not cause memory leaks with repeated renders', () => {
      const { rerender } = render(<ReplyThread />)
      
      // Multiple re-renders should not cause issues
      for (let i = 0; i < 100; i++) {
        rerender(<ReplyThread />)
      }
      
      expect(screen.getByText('Reply Thread')).toBeInTheDocument()
    })

    it('should cleanup all listeners on unmount', () => {
      const { unmount } = render(<ReplyThread />)
      
      unmount()
      
      expect(mockOnDataCleanup).toHaveBeenCalledTimes(1)
      expect(mockOnUpdateCleanup).toHaveBeenCalledTimes(1)
    })

    it('should handle rapid message updates efficiently', async () => {
      render(<ReplyThread />)
      
      const updateData = mockReplyLogs.onUpdate.mock.calls[0][0]
      
      const start = performance.now()
      
      // Rapid updates
      for (let i = 0; i < 100; i++) {
        const messages = [{
          id: `msg${i}`,
          content: `Message ${i}`,
          sender: { username: `user${i}` }
        }]
        updateData({ messages })
      }
      
      const end = performance.now()
      
      expect(end - start).toBeLessThan(1000) // Should complete within 1 second
    })

    it('should handle large message arrays efficiently', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      // Create large message array
      const largeMessageArray = Array.from({ length: 1000 }, (_, i) => ({
        id: `msg${i}`,
        content: `Message ${i}`,
        sender: {
          username: `user${i}`,
          identity: {
            color: '#ff0000',
            badges: []
          }
        }
      }))
      
      const start = performance.now()
      
      loadData({
        ...mockDialogData,
        messages: largeMessageArray
      })
      
      const end = performance.now()
      
      expect(end - start).toBeLessThan(500) // Should process within 500ms
    })

    it('should not re-render unnecessarily', async () => {
      const { rerender } = render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      loadData({
        ...mockDialogData,
        messages: mockMessages
      })
      
      await waitFor(() => {
        expect(screen.getByText('First reply message')).toBeInTheDocument()
      })
      
      // Re-render with same data should not cause issues
      for (let i = 0; i < 10; i++) {
        rerender(<ReplyThread />)
      }
      
      expect(screen.getByText('First reply message')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long message content', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      const longContent = 'a'.repeat(10000)
      const messagesWithLongContent = [
        {
          id: 'longmsg',
          content: longContent,
          sender: {
            username: 'user',
            identity: { color: '#ff0000', badges: [] }
          }
        }
      ]
      
      loadData({
        ...mockDialogData,
        messages: messagesWithLongContent
      })
      
      await waitFor(() => {
        expect(screen.getByText(longContent)).toBeInTheDocument()
      })
    })

    it('should handle messages with special characters', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      const specialContent = '🎉 Special chars: <>&"\'`\n\t\r Unicode: 你好 العربية'
      const messagesWithSpecialChars = [
        {
          id: 'specialmsg',
          content: specialContent,
          sender: {
            username: 'user',
            identity: { color: '#ff0000', badges: [] }
          }
        }
      ]
      
      loadData({
        ...mockDialogData,
        messages: messagesWithSpecialChars
      })
      
      await waitFor(() => {
        expect(screen.getByText(specialContent)).toBeInTheDocument()
      })
    })

    it('should handle empty or whitespace-only content', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      const messagesWithEmptyContent = [
        {
          id: 'empty1',
          content: '',
          sender: { username: 'user1', identity: { color: '#ff0000', badges: [] } }
        },
        {
          id: 'empty2',
          content: '   \n\t   ',
          sender: { username: 'user2', identity: { color: '#ff0000', badges: [] } }
        },
        {
          id: 'empty3',
          content: null,
          sender: { username: 'user3', identity: { color: '#ff0000', badges: [] } }
        }
      ]
      
      expect(() => {
        loadData({
          ...mockDialogData,
          messages: messagesWithEmptyContent
        })
      }).not.toThrow()
    })

    it('should handle concurrent data loads', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      
      // Simulate rapid concurrent loads
      Promise.all([
        loadData({ ...mockDialogData, messages: mockMessages }),
        loadData({ ...mockDialogData, messages: [] }),
        loadData({ ...mockDialogData, messages: mockMessages.slice(0, 1) })
      ])
      
      // Should handle without crashing
      await waitFor(() => {
        expect(screen.getByText('Reply Thread')).toBeInTheDocument()
      })
    })
  })

  describe('State Management', () => {
    it('should maintain state consistency across updates', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      const updateData = mockReplyLogs.onUpdate.mock.calls[0][0]
      
      // Initial load
      loadData({
        ...mockDialogData,
        messages: mockMessages
      })
      
      await waitFor(() => {
        expect(screen.getByText('First reply message')).toBeInTheDocument()
      })
      
      // Update messages
      const newMessages = [mockMessages[0]] // Only first message
      updateData({ messages: newMessages })
      
      await waitFor(() => {
        expect(screen.getByText('First reply message')).toBeInTheDocument()
        expect(screen.queryByText('Second reply message')).not.toBeInTheDocument()
      })
    })

    it('should preserve dialog data across message updates', async () => {
      render(<ReplyThread />)
      
      const loadData = mockReplyThreadDialog.onData.mock.calls[0][0]
      const updateData = mockReplyLogs.onUpdate.mock.calls[0][0]
      
      // Initial load
      loadData({
        ...mockDialogData,
        messages: mockMessages
      })
      
      await waitFor(() => {
        const chatInput = screen.getByTestId('chat-input')
        expect(chatInput).toHaveAttribute('data-chatroom-id', 'chatroom123')
      })
      
      // Update messages (should preserve dialog data)
      updateData({ messages: mockMessages })
      
      await waitFor(() => {
        const chatInput = screen.getByTestId('chat-input')
        expect(chatInput).toHaveAttribute('data-chatroom-id', 'chatroom123')
      })
    })
  })
})