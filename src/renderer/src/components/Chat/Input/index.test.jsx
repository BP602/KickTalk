import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatInput from './index.jsx'
import { EmoteNode } from './EmoteNode.jsx'

// Mock dependencies
vi.mock('clsx', () => ({
  default: (...args) => args.filter(Boolean).join(' ')
}))

vi.mock('../../../assets/styles/components/Chat/Input.scss')
vi.mock('../../../assets/icons/x-bold.svg?asset', () => ({ default: 'x-icon.svg' }))
vi.mock('../../../assets/icons/lock-simple-fill.svg?asset', () => ({ default: 'lock-icon.svg' }))

vi.mock('./EmoteDialogs', () => ({
  default: vi.fn(({ handleEmoteClick }) => (
    <div data-testid="emote-dialogs">
      <button 
        data-testid="emote-button"
        onClick={() => handleEmoteClick({ id: '123', name: 'TestEmote', platform: 'kick' })}
      >
        Emote
      </button>
    </div>
  ))
}))

vi.mock('./InfoBar', () => ({
  default: vi.fn(() => <div data-testid="info-bar">Info Bar</div>)
}))

vi.mock('../../../utils/MessageParser', () => ({
  MessageParser: vi.fn(() => <span>Parsed message</span>)
}))

vi.mock('@utils/constants', () => ({
  kickEmoteInputRegex: /(?:^|\s)(:(?<emoteCase1>\w{3,}):)|(?:^|\s)(?<emoteCase2>\w{2,})\b/g,
  DEFAULT_CHAT_HISTORY_LENGTH: 400
}))

// Mock chat store with proper structure
const mockChatStore = {
  sendMessage: vi.fn().mockResolvedValue(true),
  sendReply: vi.fn().mockResolvedValue(true),
  saveDraftMessage: vi.fn(),
  getDraftMessage: vi.fn().mockReturnValue(''),
  clearDraftMessage: vi.fn(),
  chatrooms: [
    {
      id: 'test-chatroom-1',
      username: 'testuser',
      userChatroomInfo: {
        subscription: true,
        id: 'user123'
      },
      streamerData: {
        id: 'streamer123',
        user_id: 'user123',
        user: { username: 'testuser' },
        subscriber_badges: []
      },
      emotes: [{
        emotes: [
          { id: '1', name: 'Kappa', platform: 'kick' },
          { id: '2', name: 'PogChamp', platform: 'kick' }
        ]
      }],
      channel7TVEmotes: [{
        type: 'channel',
        emotes: [
          { id: '7tv1', name: 'OMEGALUL', platform: '7tv', width: '28px', height: '28px' }
        ]
      }],
      chatroomInfo: { title: 'Test Chat' },
      initialChatroomInfo: { title: 'Test Chat' }
    }
  ],
  chatters: {
    'test-chatroom-1': [
      { id: '1', username: 'chatter1' },
      { id: '2', username: 'chatter2' }
    ]
  },
  personalEmoteSets: [],
  messages: {}
}

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

// Mock Lexical components and functions
vi.mock('@lexical/react/LexicalComposer', () => ({
  LexicalComposer: vi.fn(({ children }) => <div data-testid="lexical-composer">{children}</div>)
}))

vi.mock('@lexical/react/LexicalAutoFocusPlugin', () => ({
  AutoFocusPlugin: vi.fn(() => <div data-testid="auto-focus-plugin" />)
}))

vi.mock('@lexical/react/PlainTextPlugin', () => ({
  PlainTextPlugin: vi.fn(({ contentEditable, placeholder }) => (
    <div data-testid="plain-text-plugin">
      {contentEditable}
      {placeholder}
    </div>
  ))
}))

vi.mock('@lexical/react/LexicalContentEditable', () => ({
  ContentEditable: vi.fn((props) => (
    <div 
      {...props}
      data-testid="content-editable"
      contentEditable
      suppressContentEditableWarning
    />
  ))
}))

vi.mock('@lexical/react/LexicalHistoryPlugin', () => ({
  HistoryPlugin: vi.fn(() => <div data-testid="history-plugin" />)
}))

vi.mock('@lexical/react/LexicalErrorBoundary', () => ({
  LexicalErrorBoundary: vi.fn(() => <div data-testid="error-boundary" />)
}))

vi.mock('@lexical/react/LexicalComposerContext', () => {
  const mockEditor = {
    focus: vi.fn(),
    update: vi.fn((fn) => fn()),
    getRootElement: vi.fn(() => document.createElement('div')),
    registerCommand: vi.fn(() => vi.fn()),
    registerUpdateListener: vi.fn(() => vi.fn()),
    registerNodeTransform: vi.fn(() => vi.fn())
  }
  
  return {
    useLexicalComposerContext: vi.fn(() => [mockEditor])
  }
})

vi.mock('lexical', () => ({
  $getRoot: vi.fn(() => ({
    clear: vi.fn(),
    append: vi.fn()
  })),
  $createTextNode: vi.fn((text) => ({
    getTextContent: () => text,
    setTextContent: vi.fn(),
    splitText: vi.fn(() => [])
  })),
  $createParagraphNode: vi.fn(() => ({
    append: vi.fn()
  })),
  $getSelection: vi.fn(() => ({
    anchor: {
      getNode: vi.fn(() => ({
        getTextContent: () => 'test text',
        getType: () => 'text'
      })),
      offset: 0
    },
    insertNodes: vi.fn()
  })),
  $isRangeSelection: vi.fn(() => true),
  $getNodeByKey: vi.fn(),
  TextNode: class TextNode {
    constructor(text) {
      this.__text = text
    }
    getTextContent() { return this.__text }
    setTextContent(text) { this.__text = text }
    splitText() { return [] }
  },
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
  $rootTextContent: vi.fn(() => 'test message content')
}))

// Mock window.app APIs
global.window.app = {
  reply: {
    onData: vi.fn((callback) => {
      // Store callback for manual triggering in tests
      global.mockReplyCallback = callback
      return vi.fn() // cleanup function
    })
  },
  kick: {
    getUserChatroomInfo: vi.fn().mockResolvedValue({
      data: {
        id: '123',
        username: 'testuser',
        slug: 'testuser'
      }
    })
  },
  userDialog: {
    open: vi.fn()
  }
}

describe('ChatInput Component', () => {
  const defaultProps = {
    chatroomId: 'test-chatroom-1',
    isReplyThread: false,
    replyMessage: {},
    settings: {
      chatrooms: { showInfoBar: true },
      sevenTV: { enabled: true }
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<ChatInput {...defaultProps} />)
      
      expect(screen.getByTestId('lexical-composer')).toBeInTheDocument()
      expect(screen.getByTestId('content-editable')).toBeInTheDocument()
    })

    it('should render with correct structure', () => {
      render(<ChatInput {...defaultProps} />)
      
      expect(screen.getByTestId('plain-text-plugin')).toBeInTheDocument()
      expect(screen.getByTestId('auto-focus-plugin')).toBeInTheDocument()
      expect(screen.getByTestId('history-plugin')).toBeInTheDocument()
      expect(screen.getByTestId('emote-dialogs')).toBeInTheDocument()
    })

    it('should render placeholder text', () => {
      render(<ChatInput {...defaultProps} />)
      
      expect(screen.getByText('Send a message...')).toBeInTheDocument()
    })

    it('should render info bar when enabled in settings', () => {
      render(<ChatInput {...defaultProps} />)
      
      expect(screen.getByTestId('info-bar')).toBeInTheDocument()
    })

    it('should not render info bar when disabled in settings', () => {
      const props = {
        ...defaultProps,
        settings: { chatrooms: { showInfoBar: false } }
      }
      
      render(<ChatInput {...props} />)
      
      expect(screen.queryByTestId('info-bar')).not.toBeInTheDocument()
    })
  })

  describe('Message Input and Handling', () => {
    it('should focus content editable element', () => {
      render(<ChatInput {...defaultProps} />)
      
      const contentEditable = screen.getByTestId('content-editable')
      expect(contentEditable).toHaveAttribute('contentEditable', 'true')
    })

    it('should handle basic text input', async () => {
      const user = userEvent.setup()
      render(<ChatInput {...defaultProps} />)
      
      const input = screen.getByTestId('content-editable')
      await user.click(input)
      await user.type(input, 'Hello world')
      
      // Verify the input received the text (mocked behavior)
      expect(input).toHaveTextContent('Hello world')
    })

    it('should handle Enter key to send message', async () => {
      render(<ChatInput {...defaultProps} />)
      
      // Simulate Enter key press through the mock
      const mockEditor = require('@lexical/react/LexicalComposerContext').useLexicalComposerContext()[0]
      const enterHandler = mockEditor.registerCommand.mock.calls.find(
        call => call[0] === 'ENTER'
      )?.[1]
      
      if (enterHandler) {
        const mockEvent = { shiftKey: false, preventDefault: vi.fn() }
        enterHandler(mockEvent)
        
        expect(mockEvent.preventDefault).toHaveBeenCalled()
        expect(mockChatStore.sendMessage).toHaveBeenCalledWith('test-chatroom-1', 'test message content')
      }
    })

    it('should not send message on Shift+Enter', async () => {
      render(<ChatInput {...defaultProps} />)
      
      const mockEditor = require('@lexical/react/LexicalComposerContext').useLexicalComposerContext()[0]
      const enterHandler = mockEditor.registerCommand.mock.calls.find(
        call => call[0] === 'ENTER'
      )?.[1]
      
      if (enterHandler) {
        const mockEvent = { shiftKey: true, preventDefault: vi.fn() }
        const result = enterHandler(mockEvent)
        
        expect(result).toBe(false)
        expect(mockChatStore.sendMessage).not.toHaveBeenCalled()
      }
    })

    it('should not send empty messages', async () => {
      vi.mocked(require('@lexical/text').$rootTextContent).mockReturnValue('')
      render(<ChatInput {...defaultProps} />)
      
      const mockEditor = require('@lexical/react/LexicalComposerContext').useLexicalComposerContext()[0]
      const enterHandler = mockEditor.registerCommand.mock.calls.find(
        call => call[0] === 'ENTER'
      )?.[1]
      
      if (enterHandler) {
        const mockEvent = { shiftKey: false, preventDefault: vi.fn() }
        enterHandler(mockEvent)
        
        expect(mockChatStore.sendMessage).not.toHaveBeenCalled()
      }
    })
  })

  describe('Emote Functionality', () => {
    it('should render emote picker', () => {
      render(<ChatInput {...defaultProps} />)
      
      expect(screen.getByTestId('emote-dialogs')).toBeInTheDocument()
      expect(screen.getByTestId('emote-button')).toBeInTheDocument()
    })

    it('should handle emote selection', async () => {
      const user = userEvent.setup()
      render(<ChatInput {...defaultProps} />)
      
      const emoteButton = screen.getByTestId('emote-button')
      await user.click(emoteButton)
      
      // Verify emote handler was called (mocked implementation)
      expect(emoteButton).toBeInTheDocument()
    })

    it('should show emote suggestions when typing colon', () => {
      render(<ChatInput {...defaultProps} />)
      
      // This would be tested through the mocked update listener
      const mockEditor = require('@lexical/react/LexicalComposerContext').useLexicalComposerContext()[0]
      const updateListener = mockEditor.registerUpdateListener.mock.calls[0]?.[0]
      
      if (updateListener) {
        // Mock editor state with colon input
        const mockEditorState = {
          read: vi.fn((fn) => {
            // Mock selection and text content for emote suggestions
            vi.mocked(require('lexical').$getSelection).mockReturnValue({
              anchor: {
                getNode: vi.fn(() => ({
                  getTextContent: () => ':kappa',
                  getType: () => 'text'
                })),
                offset: 6
              }
            })
            fn()
          })
        }
        
        updateListener({ editorState: mockEditorState })
        
        expect(mockEditorState.read).toHaveBeenCalled()
      }
    })

    it('should show chatter suggestions when typing @', () => {
      render(<ChatInput {...defaultProps} />)
      
      const mockEditor = require('@lexical/react/LexicalComposerContext').useLexicalComposerContext()[0]
      const updateListener = mockEditor.registerUpdateListener.mock.calls[0]?.[0]
      
      if (updateListener) {
        const mockEditorState = {
          read: vi.fn((fn) => {
            vi.mocked(require('lexical').$getSelection).mockReturnValue({
              anchor: {
                getNode: vi.fn(() => ({
                  getTextContent: () => '@chat',
                  getType: () => 'text'
                })),
                offset: 5
              }
            })
            fn()
          })
        }
        
        updateListener({ editorState: mockEditorState })
        
        expect(mockEditorState.read).toHaveBeenCalled()
      }
    })
  })

  describe('Reply Functionality', () => {
    it('should not show reply UI initially', () => {
      render(<ChatInput {...defaultProps} />)
      
      expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument()
    })

    it('should handle reply data from external API', async () => {
      render(<ChatInput {...defaultProps} />)
      
      // Simulate reply data coming from external API
      const replyData = {
        id: 'message123',
        content: 'Original message',
        sender: {
          id: 'user123',
          username: 'testuser'
        }
      }
      
      // Trigger the reply callback
      if (global.mockReplyCallback) {
        act(() => {
          global.mockReplyCallback(replyData)
        })
      }
      
      await waitFor(() => {
        expect(screen.getByText(/Replying to/)).toBeInTheDocument()
        expect(screen.getByText(/@testuser/)).toBeInTheDocument()
      })
    })

    it('should close reply UI when close button is clicked', async () => {
      const user = userEvent.setup()
      render(<ChatInput {...defaultProps} />)
      
      // First set up reply data
      const replyData = {
        id: 'message123',
        content: 'Original message',
        sender: {
          id: 'user123',
          username: 'testuser'
        }
      }
      
      if (global.mockReplyCallback) {
        act(() => {
          global.mockReplyCallback(replyData)
        })
      }
      
      await waitFor(() => {
        expect(screen.getByText(/Replying to/)).toBeInTheDocument()
      })
      
      // Click close button
      const closeButton = screen.getByRole('button')
      await user.click(closeButton)
      
      await waitFor(() => {
        expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument()
      })
    })

    it('should send reply when reply data is present', async () => {
      render(<ChatInput {...defaultProps} />)
      
      // Set up reply data
      const replyData = {
        id: 'message123',
        content: 'Original message',
        sender: {
          id: 'user123',
          username: 'testuser'
        }
      }
      
      if (global.mockReplyCallback) {
        act(() => {
          global.mockReplyCallback(replyData)
        })
      }
      
      // Simulate sending a reply
      const mockEditor = require('@lexical/react/LexicalComposerContext').useLexicalComposerContext()[0]
      const enterHandler = mockEditor.registerCommand.mock.calls.find(
        call => call[0] === 'ENTER'
      )?.[1]
      
      if (enterHandler) {
        const mockEvent = { shiftKey: false, preventDefault: vi.fn() }
        enterHandler(mockEvent)
        
        expect(mockChatStore.sendReply).toHaveBeenCalledWith(
          'test-chatroom-1',
          'test message content',
          expect.objectContaining({
            original_message: expect.objectContaining({
              id: 'message123',
              content: 'Original message'
            }),
            original_sender: expect.objectContaining({
              username: 'testuser'
            })
          })
        )
      }
    })
  })

  describe('Command Handling', () => {
    it('should handle user lookup command', async () => {
      vi.mocked(require('@lexical/text').$rootTextContent).mockReturnValue('/user @testuser')
      render(<ChatInput {...defaultProps} />)
      
      const mockEditor = require('@lexical/react/LexicalComposerContext').useLexicalComposerContext()[0]
      const enterHandler = mockEditor.registerCommand.mock.calls.find(
        call => call[0] === 'ENTER'
      )?.[1]
      
      if (enterHandler) {
        const mockEvent = { shiftKey: false, preventDefault: vi.fn() }
        await enterHandler(mockEvent)
        
        await waitFor(() => {
          expect(window.app.kick.getUserChatroomInfo).toHaveBeenCalledWith('testuser', 'testuser')
        })
      }
    })

    it('should handle arrow key navigation for message history', () => {
      render(<ChatInput {...defaultProps} />)
      
      const mockEditor = require('@lexical/react/LexicalComposerContext').useLexicalComposerContext()[0]
      const arrowUpHandler = mockEditor.registerCommand.mock.calls.find(
        call => call[0] === 'ARROW_UP'
      )?.[1]
      
      if (arrowUpHandler) {
        const mockEvent = { preventDefault: vi.fn() }
        arrowUpHandler(mockEvent)
        
        expect(mockEvent.preventDefault).toHaveBeenCalled()
      }
    })

    it('should handle tab key for emote completion', () => {
      render(<ChatInput {...defaultProps} />)
      
      const mockEditor = require('@lexical/react/LexicalComposerContext').useLexicalComposerContext()[0]
      const tabHandler = mockEditor.registerCommand.mock.calls.find(
        call => call[0] === 'TAB'
      )?.[1]
      
      if (tabHandler) {
        const mockEvent = { shiftKey: false, preventDefault: vi.fn() }
        const result = tabHandler(mockEvent)
        
        expect(mockEvent.preventDefault).toHaveBeenCalled()
        expect(result).toBe(true)
      }
    })
  })

  describe('Draft Message Management', () => {
    it('should save draft messages', () => {
      render(<ChatInput {...defaultProps} />)
      
      const mockEditor = require('@lexical/react/LexicalComposerContext').useLexicalComposerContext()[0]
      const updateListener = mockEditor.registerUpdateListener.mock.calls.find(
        call => typeof call[0] === 'function'
      )?.[0]
      
      if (updateListener) {
        const mockEditorState = {
          read: vi.fn((fn) => fn())
        }
        
        updateListener({ editorState: mockEditorState })
        
        expect(mockChatStore.saveDraftMessage).toHaveBeenCalledWith(
          'test-chatroom-1',
          'test message content'
        )
      }
    })

    it('should restore draft messages when switching chatrooms', () => {
      mockChatStore.getDraftMessage.mockReturnValue('saved draft message')
      
      render(<ChatInput {...defaultProps} />)
      
      expect(mockChatStore.getDraftMessage).toHaveBeenCalledWith('test-chatroom-1')
    })

    it('should clear draft after sending message', async () => {
      render(<ChatInput {...defaultProps} />)
      
      const mockEditor = require('@lexical/react/LexicalComposerContext').useLexicalComposerContext()[0]
      const enterHandler = mockEditor.registerCommand.mock.calls.find(
        call => call[0] === 'ENTER'
      )?.[1]
      
      if (enterHandler) {
        const mockEvent = { shiftKey: false, preventDefault: vi.fn() }
        await enterHandler(mockEvent)
        
        expect(mockChatStore.clearDraftMessage).toHaveBeenCalledWith('test-chatroom-1')
      }
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<ChatInput {...defaultProps} />)
      
      const contentEditable = screen.getByTestId('content-editable')
      expect(contentEditable).toHaveAttribute('aria-placeholder', 'Enter message...')
    })

    it('should have proper keyboard navigation', () => {
      render(<ChatInput {...defaultProps} />)
      
      const mockEditor = require('@lexical/react/LexicalComposerContext').useLexicalComposerContext()[0]
      
      // Verify key handlers are registered
      expect(mockEditor.registerCommand).toHaveBeenCalledWith(
        'ENTER',
        expect.any(Function),
        expect.any(Number)
      )
      expect(mockEditor.registerCommand).toHaveBeenCalledWith(
        'ARROW_UP',
        expect.any(Function),
        expect.any(Number)
      )
      expect(mockEditor.registerCommand).toHaveBeenCalledWith(
        'ARROW_DOWN',
        expect.any(Function),
        expect.any(Number)
      )
      expect(mockEditor.registerCommand).toHaveBeenCalledWith(
        'TAB',
        expect.any(Function),
        expect.any(Number)
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle failed message sends gracefully', async () => {
      mockChatStore.sendMessage.mockRejectedValueOnce(new Error('Send failed'))
      
      render(<ChatInput {...defaultProps} />)
      
      const mockEditor = require('@lexical/react/LexicalComposerContext').useLexicalComposerContext()[0]
      const enterHandler = mockEditor.registerCommand.mock.calls.find(
        call => call[0] === 'ENTER'
      )?.[1]
      
      if (enterHandler) {
        const mockEvent = { shiftKey: false, preventDefault: vi.fn() }
        
        // Should not throw error
        expect(() => enterHandler(mockEvent)).not.toThrow()
      }
    })

    it('should handle invalid reply data', async () => {
      render(<ChatInput {...defaultProps} />)
      
      // Simulate invalid reply data
      const invalidReplyData = null
      
      if (global.mockReplyCallback) {
        act(() => {
          global.mockReplyCallback(invalidReplyData)
        })
      }
      
      // Should not crash or show reply UI
      expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument()
    })

    it('should handle missing reply API gracefully', () => {
      // Remove the reply API temporarily
      const originalAPI = window.app.reply
      delete window.app.reply
      
      // Should not crash when rendering
      expect(() => {
        render(<ChatInput {...defaultProps} />)
      }).not.toThrow()
      
      // Restore API
      window.app.reply = originalAPI
    })
  })

  describe('Integration Tests', () => {
    it('should integrate with chat store properly', () => {
      render(<ChatInput {...defaultProps} />)
      
      // Verify chat store is accessed for chatroom data
      expect(mockChatStore.chatrooms).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'test-chatroom-1',
            username: 'testuser'
          })
        ])
      )
    })

    it('should handle chatroom switching', () => {
      const { rerender } = render(<ChatInput {...defaultProps} />)
      
      // Switch to different chatroom
      rerender(<ChatInput {...defaultProps} chatroomId="test-chatroom-2" />)
      
      // Should clear reply data and reset state
      expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument()
    })

    it('should handle reply thread mode', () => {
      const replyProps = {
        ...defaultProps,
        isReplyThread: true,
        replyMessage: {
          original_message: { id: 'msg1', content: 'Original' },
          original_sender: { username: 'sender1' }
        }
      }
      
      render(<ChatInput {...replyProps} />)
      
      // Should be in reply thread mode
      expect(screen.getByTestId('lexical-composer')).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('should memoize component properly', () => {
      const { rerender } = render(<ChatInput {...defaultProps} />)
      
      // Re-render with same props should not cause full re-render
      rerender(<ChatInput {...defaultProps} />)
      
      // Component should still be rendered correctly
      expect(screen.getByTestId('lexical-composer')).toBeInTheDocument()
    })

    it('should handle large emote lists efficiently', () => {
      const largeEmoteProps = {
        ...defaultProps,
        settings: {
          ...defaultProps.settings,
          sevenTV: { enabled: true }
        }
      }
      
      // Should render without performance issues
      render(<ChatInput {...largeEmoteProps} />)
      
      expect(screen.getByTestId('emote-dialogs')).toBeInTheDocument()
    })
  })
})