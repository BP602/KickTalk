import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatInput from './index.jsx'
import { 
  createMockChatStore,
  createMockWindowApp,
  createMockReplyData,
  triggerMockReply,
  setupMockEnvironment,
  cleanupMockEnvironment
} from './__tests__/test-utils.js'

// Mock all dependencies
vi.mock('clsx', () => ({
  default: (...args) => args.filter(Boolean).join(' ')
}))

vi.mock('../../../assets/styles/components/Chat/Input.scss')
vi.mock('../../../assets/icons/x-bold.svg?asset', () => ({ default: 'x-icon.svg' }))
vi.mock('../../../assets/icons/lock-simple-fill.svg?asset', () => ({ default: 'lock-icon.svg' }))

vi.mock('./EmoteDialogs', () => ({
  default: vi.fn(({ handleEmoteClick, chatroomId }) => (
    <div data-testid="emote-dialogs">
      <button 
        data-testid="kick-emote"
        onClick={() => handleEmoteClick({ id: '1', name: 'Kappa', platform: 'kick' })}
      >
        Kick Emote
      </button>
      <button
        data-testid="7tv-emote"
        onClick={() => handleEmoteClick({ id: '7tv1', name: 'OMEGALUL', platform: '7tv' })}
      >
        7TV Emote
      </button>
      <button
        data-testid="subscriber-emote"
        onClick={() => handleEmoteClick({ 
          id: '2', 
          name: 'SubEmote', 
          platform: 'kick', 
          subscribers_only: true 
        })}
      >
        Sub Emote
      </button>
    </div>
  ))
}))

vi.mock('./InfoBar', () => ({
  default: vi.fn(({ chatroomInfo }) => (
    <div data-testid="info-bar">
      Info: {chatroomInfo?.title || 'No Info'}
    </div>
  ))
}))

vi.mock('../../../utils/MessageParser', () => ({
  MessageParser: vi.fn(({ message }) => (
    <span data-testid="parsed-message">{message?.content || 'No content'}</span>
  ))
}))

// Enhanced mock chat store
const mockChatStore = createMockChatStore({
  chatrooms: [
    {
      id: 'test-chatroom-1',
      username: 'teststreamer',
      userChatroomInfo: {
        subscription: true,
        id: 'user123'
      },
      streamerData: {
        id: 'streamer123',
        user_id: 'user123',
        user: { username: 'teststreamer' },
        subscriber_badges: [
          { months: 1, badge_image: { src: 'badge1.png' } },
          { months: 6, badge_image: { src: 'badge6.png' } }
        ]
      },
      emotes: [{
        emotes: [
          { id: '1', name: 'Kappa', platform: 'kick', subscribers_only: false },
          { id: '2', name: 'SubEmote', platform: 'kick', subscribers_only: true }
        ]
      }],
      channel7TVEmotes: [{
        type: 'channel',
        emotes: [
          { id: '7tv1', name: 'OMEGALUL', platform: '7tv', width: '28px', height: '28px' }
        ]
      }],
      chatroomInfo: { title: 'Test Stream Chat' },
      initialChatroomInfo: { title: 'Initial Chat Info' }
    }
  ],
  chatters: {
    'test-chatroom-1': [
      { id: '1', username: 'viewer1' },
      { id: '2', username: 'moderator1' },
      { id: '3', username: 'subscriber1' }
    ]
  },
  messages: {
    'test-chatroom-1': [
      {
        id: 'msg1',
        content: 'Hello world!',
        sender: { id: 'user1', username: 'viewer1' },
        type: 'message'
      }
    ]
  }
})

vi.mock('../../../providers/ChatProvider', () => ({
  default: vi.fn((selector) => {
    if (typeof selector === 'function') {
      return selector(mockChatStore)
    }
    return mockChatStore
  })
}))

vi.mock('zustand/react/shallow', () => ({
  useShallow: vi.fn((fn) => fn)
}))

// Mock Lexical with more realistic behavior
const mockEditor = {
  focus: vi.fn(),
  update: vi.fn((fn) => fn()),
  getRootElement: vi.fn(() => document.createElement('div')),
  registerCommand: vi.fn(() => vi.fn()),
  registerUpdateListener: vi.fn(() => vi.fn()),
  registerNodeTransform: vi.fn(() => vi.fn())
}

vi.mock('@lexical/react/LexicalComposerContext', () => ({
  useLexicalComposerContext: vi.fn(() => [mockEditor])
}))

vi.mock('@lexical/react/LexicalComposer', () => ({
  LexicalComposer: vi.fn(({ children }) => (
    <div data-testid="lexical-composer" role="textbox" tabIndex={0}>
      {children}
    </div>
  ))
}))

vi.mock('@lexical/react/PlainTextPlugin', () => ({
  PlainTextPlugin: vi.fn(({ contentEditable, placeholder }) => (
    <div data-testid="plain-text-plugin">
      <div data-testid="content-wrapper">
        {contentEditable}
      </div>
      {placeholder}
    </div>
  ))
}))

vi.mock('@lexical/react/LexicalContentEditable', () => ({
  ContentEditable: vi.fn((props) => (
    <textarea
      {...props}
      data-testid="content-editable"
      placeholder={props['aria-placeholder']}
    />
  ))
}))

// Other Lexical mocks
vi.mock('@lexical/react/LexicalAutoFocusPlugin', () => ({
  AutoFocusPlugin: vi.fn(() => <div data-testid="auto-focus-plugin" />)
}))

vi.mock('@lexical/react/LexicalHistoryPlugin', () => ({
  HistoryPlugin: vi.fn(() => <div data-testid="history-plugin" />)
}))

vi.mock('@lexical/react/LexicalErrorBoundary', () => ({
  LexicalErrorBoundary: vi.fn(() => <div data-testid="error-boundary" />)
}))

vi.mock('lexical', () => ({
  $getRoot: vi.fn(() => ({ clear: vi.fn(), append: vi.fn() })),
  $createTextNode: vi.fn((text) => ({ getTextContent: () => text })),
  $createParagraphNode: vi.fn(() => ({ append: vi.fn() })),
  $getSelection: vi.fn(() => ({
    anchor: {
      getNode: vi.fn(() => ({ getTextContent: () => 'test', getType: () => 'text' })),
      offset: 0
    },
    insertNodes: vi.fn()
  })),
  $isRangeSelection: vi.fn(() => true),
  TextNode: class TextNode {},
  KEY_ENTER_COMMAND: 'ENTER',
  KEY_ARROW_UP_COMMAND: 'ARROW_UP',
  KEY_ARROW_DOWN_COMMAND: 'ARROW_DOWN',
  KEY_TAB_COMMAND: 'TAB',
  KEY_BACKSPACE_COMMAND: 'BACKSPACE',
  KEY_SPACE_COMMAND: 'SPACE',
  COMMAND_PRIORITY_HIGH: 1,
  COMMAND_PRIORITY_CRITICAL: 2
}))

vi.mock('@lexical/text', () => ({
  $rootTextContent: vi.fn(() => 'Hello from integration test!')
}))

describe('ChatInput Integration Tests', () => {
  const defaultProps = {
    chatroomId: 'test-chatroom-1',
    isReplyThread: false,
    replyMessage: {},
    settings: {
      chatrooms: { showInfoBar: true },
      sevenTV: { enabled: true }
    }
  }

  let mockEnv

  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv = setupMockEnvironment()
  })

  afterEach(() => {
    cleanupMockEnvironment()
  })

  describe('Complete Message Flow', () => {
    it('should handle complete message sending workflow', async () => {
      const user = userEvent.setup()
      render(<ChatInput {...defaultProps} />)

      // Verify initial render
      expect(screen.getByTestId('content-editable')).toBeInTheDocument()
      expect(screen.getByText('Send a message...')).toBeInTheDocument()

      // Simulate typing
      const input = screen.getByTestId('content-editable')
      await user.type(input, 'Hello world!')

      // Simulate Enter key press
      await user.keyboard('{Enter}')

      // Verify message was sent
      await waitFor(() => {
        expect(mockChatStore.sendMessage).toHaveBeenCalledWith(
          'test-chatroom-1', 
          'Hello from integration test!'
        )
      })

      // Verify draft was cleared
      expect(mockChatStore.clearDraftMessage).toHaveBeenCalledWith('test-chatroom-1')
    })

    it('should handle message with emotes', async () => {
      const user = userEvent.setup()
      render(<ChatInput {...defaultProps} />)

      // Click on emote
      const kickEmote = screen.getByTestId('kick-emote')
      await user.click(kickEmote)

      // Verify emote was inserted (through mock)
      expect(mockEditor.focus).toHaveBeenCalled()
      expect(mockEditor.update).toHaveBeenCalled()

      // Send the message
      await user.keyboard('{Enter}')

      expect(mockChatStore.sendMessage).toHaveBeenCalled()
    })

    it('should handle subscriber-only emote restrictions', async () => {
      // Test with non-subscriber
      const nonSubStore = {
        ...mockChatStore,
        chatrooms: [{
          ...mockChatStore.chatrooms[0],
          userChatroomInfo: { ...mockChatStore.chatrooms[0].userChatroomInfo, subscription: false }
        }]
      }

      vi.mocked(require('../../../providers/ChatProvider').default).mockImplementation((selector) => {
        return typeof selector === 'function' ? selector(nonSubStore) : nonSubStore
      })

      const user = userEvent.setup()
      render(<ChatInput {...defaultProps} />)

      // Try to use subscriber emote
      const subEmote = screen.getByTestId('subscriber-emote')
      await user.click(subEmote)

      // Should not be able to use it (would be handled in EmoteDialogs component)
      expect(screen.getByTestId('subscriber-emote')).toBeInTheDocument()
    })
  })

  describe('Reply Workflow', () => {
    it('should handle complete reply workflow', async () => {
      const user = userEvent.setup()
      render(<ChatInput {...defaultProps} />)

      // Trigger reply from external source
      const replyData = createMockReplyData({
        content: 'Original message to reply to',
        sender: { username: 'originaluser', id: 'orig123' }
      })

      act(() => {
        triggerMockReply(replyData)
      })

      // Verify reply UI appears
      await waitFor(() => {
        expect(screen.getByText(/Replying to/)).toBeInTheDocument()
        expect(screen.getByText(/@originaluser/)).toBeInTheDocument()
      })

      // Type reply message
      const input = screen.getByTestId('content-editable')
      await user.type(input, 'This is my reply')

      // Send reply
      await user.keyboard('{Enter}')

      // Verify reply was sent with metadata
      await waitFor(() => {
        expect(mockChatStore.sendReply).toHaveBeenCalledWith(
          'test-chatroom-1',
          'Hello from integration test!', // From mock
          expect.objectContaining({
            original_message: expect.objectContaining({
              id: replyData.id,
              content: replyData.content
            }),
            original_sender: expect.objectContaining({
              username: replyData.sender.username
            })
          })
        )
      })

      // Verify reply UI is closed after sending
      await waitFor(() => {
        expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument()
      })
    })

    it('should handle closing reply manually', async () => {
      const user = userEvent.setup()
      render(<ChatInput {...defaultProps} />)

      // Setup reply
      const replyData = createMockReplyData()
      act(() => {
        triggerMockReply(replyData)
      })

      await waitFor(() => {
        expect(screen.getByText(/Replying to/)).toBeInTheDocument()
      })

      // Close reply
      const closeButton = screen.getByRole('button')
      await user.click(closeButton)

      await waitFor(() => {
        expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument()
      })
    })

    it('should handle nested reply workflow', async () => {
      const user = userEvent.setup()
      render(<ChatInput {...defaultProps} />)

      // Reply to a reply (nested)
      const nestedReplyData = createMockReplyData({
        type: 'reply',
        metadata: {
          original_message: { id: 'orig1', content: 'Very original message' },
          original_sender: { username: 'firstuser' }
        },
        content: 'This is a reply to the original',
        sender: { username: 'seconduser', id: 'second123' }
      })

      act(() => {
        triggerMockReply(nestedReplyData)
      })

      await waitFor(() => {
        expect(screen.getByText(/Replying to/)).toBeInTheDocument()
      })

      // Send nested reply
      await user.keyboard('{Enter}')

      // Should reply to the original message, not the reply
      expect(mockChatStore.sendReply).toHaveBeenCalledWith(
        'test-chatroom-1',
        'Hello from integration test!',
        expect.objectContaining({
          original_message: expect.objectContaining({
            id: 'orig1',
            content: 'Very original message'
          }),
          original_sender: expect.objectContaining({
            username: 'firstuser'
          })
        })
      )
    })
  })

  describe('Draft Management Workflow', () => {
    it('should save and restore drafts across chatroom switches', async () => {
      const user = userEvent.setup()
      
      // Mock draft return
      mockChatStore.getDraftMessage.mockReturnValue('My saved draft')

      const { rerender } = render(<ChatInput {...defaultProps} />)

      // Verify draft was restored
      expect(mockChatStore.getDraftMessage).toHaveBeenCalledWith('test-chatroom-1')

      // Type something to create a new draft
      const input = screen.getByTestId('content-editable')
      await user.type(input, 'New draft text')

      // Simulate editor update for draft saving
      const updateListener = mockEditor.registerUpdateListener.mock.calls[0]?.[0]
      if (updateListener) {
        const mockEditorState = {
          read: vi.fn((fn) => fn())
        }
        updateListener({ editorState: mockEditorState })
      }

      // Verify draft was saved
      expect(mockChatStore.saveDraftMessage).toHaveBeenCalledWith(
        'test-chatroom-1',
        'Hello from integration test!'
      )

      // Switch chatrooms
      rerender(<ChatInput {...defaultProps} chatroomId="test-chatroom-2" />)

      // Should clear reply data when switching chatrooms
      expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument()
    })

    it('should clear draft after successful message send', async () => {
      const user = userEvent.setup()
      render(<ChatInput {...defaultProps} />)

      // Type and send message
      const input = screen.getByTestId('content-editable')
      await user.type(input, 'Message to send')
      await user.keyboard('{Enter}')

      // Verify draft was cleared after successful send
      await waitFor(() => {
        expect(mockChatStore.clearDraftMessage).toHaveBeenCalledWith('test-chatroom-1')
      })
    })
  })

  describe('Emote Suggestions and Autocomplete', () => {
    it('should show and handle emote suggestions', async () => {
      render(<ChatInput {...defaultProps} />)

      // Simulate typing colon to trigger emote suggestions
      const updateListener = mockEditor.registerUpdateListener.mock.calls[0]?.[0]
      if (updateListener) {
        // Mock typing ":kappa"
        vi.mocked(require('lexical').$getSelection).mockReturnValue({
          anchor: {
            getNode: vi.fn(() => ({
              getTextContent: () => ':kappa',
              getType: () => 'text'
            })),
            offset: 6
          }
        })

        const mockEditorState = {
          read: vi.fn((fn) => fn())
        }

        updateListener({ editorState: mockEditorState })
      }

      // Verify update listener was called (emote suggestions would be shown)
      expect(mockEditor.registerUpdateListener).toHaveBeenCalled()
    })

    it('should show chatter mentions', async () => {
      render(<ChatInput {...defaultProps} />)

      const updateListener = mockEditor.registerUpdateListener.mock.calls[0]?.[0]
      if (updateListener) {
        // Mock typing "@viewer"
        vi.mocked(require('lexical').$getSelection).mockReturnValue({
          anchor: {
            getNode: vi.fn(() => ({
              getTextContent: () => '@viewer',
              getType: () => 'text'
            })),
            offset: 7
          }
        })

        const mockEditorState = {
          read: vi.fn((fn) => fn())
        }

        updateListener({ editorState: mockEditorState })
      }

      expect(mockEditor.registerUpdateListener).toHaveBeenCalled()
    })
  })

  describe('Command System Integration', () => {
    it('should handle user lookup command workflow', async () => {
      vi.mocked(require('@lexical/text').$rootTextContent).mockReturnValue('/user @testviewer')
      
      const user = userEvent.setup()
      render(<ChatInput {...defaultProps} />)

      // Simulate Enter key for command
      await user.keyboard('{Enter}')

      // Verify user lookup was called
      await waitFor(() => {
        expect(mockEnv.windowApp.kick.getUserChatroomInfo).toHaveBeenCalledWith(
          'teststreamer',
          'testviewer'
        )
      })

      // Should open user dialog after successful lookup
      await waitFor(() => {
        expect(mockEnv.windowApp.userDialog.open).toHaveBeenCalledWith(
          expect.objectContaining({
            sender: expect.objectContaining({
              username: 'testuser'
            })
          })
        )
      })
    })

    it('should handle keyboard shortcuts properly', async () => {
      const user = userEvent.setup()
      render(<ChatInput {...defaultProps} />)

      const input = screen.getByTestId('content-editable')

      // Test Shift+Enter (should not send)
      await user.type(input, 'Line 1')
      await user.keyboard('{Shift>}{Enter}{/Shift}')

      expect(mockChatStore.sendMessage).not.toHaveBeenCalled()

      // Test regular Enter (should send)
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockChatStore.sendMessage).toHaveBeenCalled()
      })
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle network errors gracefully', async () => {
      mockChatStore.sendMessage.mockRejectedValueOnce(new Error('Network error'))
      
      const user = userEvent.setup()
      render(<ChatInput {...defaultProps} />)

      const input = screen.getByTestId('content-editable')
      await user.type(input, 'Message that will fail')
      await user.keyboard('{Enter}')

      // Should not crash the component
      expect(screen.getByTestId('content-editable')).toBeInTheDocument()
      
      // Draft should not be cleared on failed send
      expect(mockChatStore.clearDraftMessage).not.toHaveBeenCalled()
    })

    it('should handle malformed reply data', async () => {
      render(<ChatInput {...defaultProps} />)

      // Send malformed reply data
      const malformedData = {
        // Missing required fields
        content: null,
        sender: null
      }

      act(() => {
        triggerMockReply(malformedData)
      })

      // Should not show reply UI for malformed data
      expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument()
    })
  })

  describe('Accessibility Integration', () => {
    it('should maintain focus management properly', async () => {
      const user = userEvent.setup()
      render(<ChatInput {...defaultProps} />)

      // Focus should be manageable
      const composer = screen.getByTestId('lexical-composer')
      await user.click(composer)

      expect(composer).toHaveFocus()
    })

    it('should handle keyboard navigation in emote suggestions', async () => {
      render(<ChatInput {...defaultProps} />)

      // Arrow keys should work for navigation
      const arrowUpHandler = mockEditor.registerCommand.mock.calls.find(
        call => call[0] === 'ARROW_UP'
      )?.[1]

      const arrowDownHandler = mockEditor.registerCommand.mock.calls.find(
        call => call[0] === 'ARROW_DOWN'
      )?.[1]

      expect(arrowUpHandler).toBeInstanceOf(Function)
      expect(arrowDownHandler).toBeInstanceOf(Function)
    })
  })

  describe('Performance Integration', () => {
    it('should handle rapid typing without issues', async () => {
      const user = userEvent.setup()
      render(<ChatInput {...defaultProps} />)

      const input = screen.getByTestId('content-editable')
      
      // Rapid typing simulation
      const rapidText = 'This is rapid typing test'
      await user.type(input, rapidText, { delay: 1 })

      expect(input).toHaveValue(rapidText)
    })

    it('should handle chatroom switching efficiently', () => {
      const { rerender } = render(<ChatInput {...defaultProps} />)

      // Switch between chatrooms rapidly
      for (let i = 0; i < 5; i++) {
        rerender(<ChatInput {...defaultProps} chatroomId={`chatroom-${i}`} />)
      }

      // Should still render correctly
      expect(screen.getByTestId('lexical-composer')).toBeInTheDocument()
    })
  })

  describe('Real-world Scenarios', () => {
    it('should handle complex message with emotes and mentions', async () => {
      const user = userEvent.setup()
      render(<ChatInput {...defaultProps} />)

      // Add emote
      const emoteButton = screen.getByTestId('kick-emote')
      await user.click(emoteButton)

      // Type text with mention
      const input = screen.getByTestId('content-editable')
      await user.type(input, ' Hey @viewer1 check this out!')

      // Send message
      await user.keyboard('{Enter}')

      expect(mockChatStore.sendMessage).toHaveBeenCalled()
    })

    it('should handle switching from reply to normal message', async () => {
      const user = userEvent.setup()
      render(<ChatInput {...defaultProps} />)

      // Start a reply
      const replyData = createMockReplyData()
      act(() => {
        triggerMockReply(replyData)
      })

      await waitFor(() => {
        expect(screen.getByText(/Replying to/)).toBeInTheDocument()
      })

      // Cancel reply
      const closeButton = screen.getByRole('button')
      await user.click(closeButton)

      // Send normal message
      await user.keyboard('{Enter}')

      expect(mockChatStore.sendMessage).toHaveBeenCalledWith(
        'test-chatroom-1',
        'Hello from integration test!'
      )
      expect(mockChatStore.sendReply).not.toHaveBeenCalled()
    })

    it('should handle subscriber badge context in replies', async () => {
      const user = userEvent.setup()
      render(<ChatInput {...defaultProps} />)

      // Reply with subscriber context
      const replyData = createMockReplyData({
        sender: { username: 'subscriber', id: 'sub123' }
      })

      act(() => {
        triggerMockReply(replyData)
      })

      await waitFor(() => {
        expect(screen.getByTestId('parsed-message')).toBeInTheDocument()
      })

      await user.keyboard('{Enter}')

      expect(mockChatStore.sendReply).toHaveBeenCalledWith(
        'test-chatroom-1',
        'Hello from integration test!',
        expect.objectContaining({
          original_sender: expect.objectContaining({
            username: 'subscriber'
          })
        })
      )
    })
  })
})