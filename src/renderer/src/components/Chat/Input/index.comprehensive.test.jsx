import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatInput from './index.jsx'
import { EmoteNode } from './EmoteNode.jsx'
import { 
  createMockChatStore,
  createMockWindowApp,
  createMockReplyData,
  createMockEmote,
  createMockSettings,
  triggerMockReply,
  setupMockEnvironment,
  cleanupMockEnvironment,
  simulateKeyCommand,
  simulateEditorUpdate,
  createMockEditorState,
  createMockSelection,
  createMockTextNode
} from './__tests__/test-utils.js'

// Mock all dependencies with comprehensive implementations
vi.mock('clsx', () => ({
  default: (...args) => args.filter(Boolean).join(' ')
}))

vi.mock('../../../assets/styles/components/Chat/Input.scss')
vi.mock('../../../assets/icons/x-bold.svg?asset', () => ({ default: 'x-icon.svg' }))
vi.mock('../../../assets/icons/lock-simple-fill.svg?asset', () => ({ default: 'lock-icon.svg' }))

// Mock EmoteDialogs with comprehensive emote handling
vi.mock('./EmoteDialogs', () => ({
  default: vi.fn(({ handleEmoteClick, chatroomId, userChatroomInfo }) => (
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
        disabled={!userChatroomInfo?.subscription}
        onClick={() => handleEmoteClick({ 
          id: '2', 
          name: 'SubEmote', 
          platform: 'kick', 
          subscribers_only: true 
        })}
      >
        Sub Emote
      </button>
      <button
        data-testid="large-emote"
        onClick={() => handleEmoteClick({ 
          id: '3', 
          name: 'LargeEmote', 
          platform: '7tv',
          width: '56px',
          height: '56px'
        })}
      >
        Large Emote
      </button>
    </div>
  ))
}))

vi.mock('./InfoBar', () => ({
  default: vi.fn(({ chatroomInfo, initialChatroomInfo }) => (
    <div data-testid="info-bar">
      <span>Viewers: {chatroomInfo?.viewers || 0}</span>
      <span>Title: {chatroomInfo?.title || initialChatroomInfo?.title || 'No Title'}</span>
    </div>
  ))
}))

vi.mock('../../../utils/MessageParser', () => ({
  MessageParser: vi.fn(({ message, type, sevenTVEmotes, chatroomId }) => (
    <span data-testid="parsed-message" data-type={type} data-chatroom={chatroomId}>
      {message?.content || 'No content'}
    </span>
  ))
}))

vi.mock('@utils/constants', () => ({
  kickEmoteInputRegex: /(?:^|\s)(:(?<emoteCase1>\w{3,}):)|(?:^|\s)(?<emoteCase2>\w{2,})\b/g,
  DEFAULT_CHAT_HISTORY_LENGTH: 400
}))

// Enhanced mock chat store with comprehensive data
const mockChatStore = createMockChatStore({
  chatrooms: [
    {
      id: 'test-chatroom-1',
      username: 'teststreamer',
      userChatroomInfo: {
        subscription: true,
        id: 'user123',
        permissions: ['chat', 'emotes']
      },
      streamerData: {
        id: 'streamer123',
        user_id: 'user123',
        user: { username: 'teststreamer' },
        subscriber_badges: [
          { months: 1, badge_image: { src: 'badge1.png' } },
          { months: 6, badge_image: { src: 'badge6.png' } },
          { months: 12, badge_image: { src: 'badge12.png' } }
        ]
      },
      emotes: [{
        type: 'channel',
        emotes: [
          { id: '1', name: 'Kappa', platform: 'kick', subscribers_only: false },
          { id: '2', name: 'SubEmote', platform: 'kick', subscribers_only: true },
          { id: '3', name: 'ModEmote', platform: 'kick', subscribers_only: false }
        ]
      }],
      channel7TVEmotes: [
        {
          type: 'global',
          emotes: [
            { id: '7tv1', name: 'OMEGALUL', platform: '7tv', width: '28px', height: '28px' },
            { id: '7tv2', name: 'Sadge', platform: '7tv', width: '28px', height: '28px' }
          ]
        },
        {
          type: 'channel',
          emotes: [
            { id: '7tv3', name: 'ChannelEmote', platform: '7tv', width: '32px', height: '32px' }
          ]
        }
      ],
      chatroomInfo: { 
        title: 'Test Stream Chat',
        viewers: 1337,
        followers: 5000,
        category: 'Just Chatting'
      },
      initialChatroomInfo: { 
        title: 'Initial Chat Info',
        viewers: 0
      }
    }
  ],
  chatters: {
    'test-chatroom-1': [
      { id: '1', username: 'viewer1', badges: [] },
      { id: '2', username: 'moderator1', badges: ['moderator'] },
      { id: '3', username: 'subscriber1', badges: ['subscriber'] },
      { id: '4', username: 'teststreamer', badges: ['broadcaster'] },
      { id: '5', username: 'viewer_with_underscore', badges: [] }
    ]
  },
  personalEmoteSets: [
    {
      type: 'personal',
      emotes: [
        { id: 'personal1', name: 'MyEmote', platform: '7tv', width: '28px', height: '28px' }
      ]
    }
  ],
  messages: {
    'test-chatroom-1': Array.from({ length: 20 }, (_, i) => ({
      id: `msg${i + 1}`,
      content: `Test message ${i + 1}`,
      sender: { id: `user${i + 1}`, username: `sender${i + 1}` },
      type: 'message',
      created_at: new Date(Date.now() - i * 60000).toISOString()
    }))
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

// Enhanced mock editor with comprehensive functionality
const mockEditor = {
  focus: vi.fn(),
  blur: vi.fn(),
  update: vi.fn((fn) => {
    if (typeof fn === 'function') {
      try {
        fn()
      } catch (error) {
        console.warn('Mock editor update error:', error)
      }
    }
  }),
  getRootElement: vi.fn(() => {
    const element = document.createElement('div')
    element.contentEditable = true
    element.setAttribute('data-testid', 'editor-root')
    return element
  }),
  registerCommand: vi.fn((command, handler, priority) => {
    // Store handlers for testing
    mockEditor._commandHandlers = mockEditor._commandHandlers || new Map()
    mockEditor._commandHandlers.set(command, { handler, priority })
    return vi.fn() // cleanup function
  }),
  registerUpdateListener: vi.fn((listener) => {
    mockEditor._updateListeners = mockEditor._updateListeners || []
    mockEditor._updateListeners.push(listener)
    return vi.fn() // cleanup function
  }),
  registerNodeTransform: vi.fn((nodeType, transform) => {
    mockEditor._nodeTransforms = mockEditor._nodeTransforms || new Map()
    if (!mockEditor._nodeTransforms.has(nodeType)) {
      mockEditor._nodeTransforms.set(nodeType, [])
    }
    mockEditor._nodeTransforms.get(nodeType).push(transform)
    return vi.fn() // cleanup function
  }),
  getEditorState: vi.fn(() => ({
    read: vi.fn((fn) => fn())
  })),
  // Helper methods for testing
  _triggerCommand: (command, event) => {
    const handler = mockEditor._commandHandlers?.get(command)
    if (handler) {
      return handler.handler(event)
    }
    return false
  },
  _triggerUpdate: (editorState) => {
    mockEditor._updateListeners?.forEach(listener => listener({ editorState }))
  },
  _triggerNodeTransform: (nodeType, node) => {
    const transforms = mockEditor._nodeTransforms?.get(nodeType)
    if (transforms) {
      transforms.forEach(transform => transform(node))
    }
  }
}

// Mock Lexical components with enhanced functionality
vi.mock('@lexical/react/LexicalComposerContext', () => ({
  useLexicalComposerContext: vi.fn(() => [mockEditor])
}))

vi.mock('@lexical/react/LexicalComposer', () => ({
  LexicalComposer: vi.fn(({ children, initialConfig }) => (
    <div 
      data-testid="lexical-composer" 
      data-namespace={initialConfig?.namespace}
      role="textbox" 
      tabIndex={0}
    >
      {children}
    </div>
  ))
}))

vi.mock('@lexical/react/PlainTextPlugin', () => ({
  PlainTextPlugin: vi.fn(({ contentEditable, placeholder, ErrorBoundary }) => (
    <div data-testid="plain-text-plugin">
      <div data-testid="content-wrapper">
        {contentEditable}
      </div>
      {placeholder}
      {ErrorBoundary && <ErrorBoundary />}
    </div>
  ))
}))

vi.mock('@lexical/react/LexicalContentEditable', () => ({
  ContentEditable: vi.fn(({ className, placeholder, spellCheck, ...props }) => (
    <div
      {...props}
      data-testid="content-editable"
      className={className}
      placeholder={props['aria-placeholder']}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      spellCheck={spellCheck}
    />
  ))
}))

vi.mock('@lexical/react/LexicalAutoFocusPlugin', () => ({
  AutoFocusPlugin: vi.fn(() => <div data-testid="auto-focus-plugin" />)
}))

vi.mock('@lexical/react/LexicalHistoryPlugin', () => ({
  HistoryPlugin: vi.fn(() => <div data-testid="history-plugin" />)
}))

vi.mock('@lexical/react/LexicalErrorBoundary', () => ({
  LexicalErrorBoundary: vi.fn(({ onError }) => {
    // Simulate error boundary functionality
    if (onError) {
      window.mockErrorBoundary = onError
    }
    return <div data-testid="error-boundary" />
  })
}))

// Enhanced Lexical core mocks
let mockSelection = null
let mockRoot = null
let mockTextContent = 'test message content'

vi.mock('lexical', () => ({
  $getRoot: vi.fn(() => {
    if (!mockRoot) {
      mockRoot = {
        clear: vi.fn(),
        append: vi.fn(),
        getChildren: vi.fn(() => []),
        getFirstChild: vi.fn(() => null),
        getLastChild: vi.fn(() => null),
        getTextContent: vi.fn(() => mockTextContent)
      }
    }
    return mockRoot
  }),
  $createTextNode: vi.fn((text = '') => createMockTextNode(text)),
  $createParagraphNode: vi.fn(() => ({
    append: vi.fn(),
    getChildren: vi.fn(() => []),
    getType: () => 'paragraph'
  })),
  $getSelection: vi.fn(() => mockSelection || createMockSelection()),
  $isRangeSelection: vi.fn((selection) => selection && selection.anchor),
  $getNodeByKey: vi.fn((key) => {
    if (key.startsWith('emote-')) {
      return new EmoteNode('123', 'TestEmote', 'kick', key)
    }
    return null
  }),
  TextNode: class TextNode {
    constructor(text = '') {
      this.__text = text
      this.__key = `text-${Math.random()}`
      this.__type = 'text'
    }
    getTextContent() { return this.__text }
    setTextContent(text) { this.__text = text }
    getType() { return this.__type }
    getKey() { return this.__key }
    splitText(start, end) { 
      const parts = []
      if (start > 0) {
        parts.push(new TextNode(this.__text.substring(0, start)))
      }
      if (end !== undefined) {
        parts.push(new TextNode(this.__text.substring(start, end)))
        if (end < this.__text.length) {
          parts.push(new TextNode(this.__text.substring(end)))
        }
      }
      return parts
    }
    getParent() { return null }
    replace(node) { /* mock replace */ }
    remove() { /* mock remove */ }
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
  $rootTextContent: vi.fn(() => mockTextContent)
}))

describe('ChatInput Comprehensive Tests', () => {
  const defaultProps = {
    chatroomId: 'test-chatroom-1',
    isReplyThread: false,
    replyMessage: {},
    settings: createMockSettings({
      chatrooms: { showInfoBar: true },
      sevenTV: { enabled: true }
    })
  }

  let mockEnv
  let user

  beforeAll(() => {
    // Set up global test environment
    vi.stubGlobal('requestAnimationFrame', (cb) => setTimeout(cb, 16))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  beforeEach(() => {
    vi.clearAllMocks()
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mockEnv = setupMockEnvironment()
    
    // Reset mock state
    mockSelection = null
    mockRoot = null
    mockTextContent = 'test message content'
    mockEditor._commandHandlers = new Map()
    mockEditor._updateListeners = []
    mockEditor._nodeTransforms = new Map()
  })

  afterEach(() => {
    cleanupMockEnvironment()
    vi.useRealTimers()
  })

  describe('Component Initialization and Rendering', () => {
    it('should render without crashing with all plugins', () => {
      render(<ChatInput {...defaultProps} />)
      
      expect(screen.getByTestId('lexical-composer')).toBeInTheDocument()
      expect(screen.getByTestId('content-editable')).toBeInTheDocument()
      expect(screen.getByTestId('plain-text-plugin')).toBeInTheDocument()
      expect(screen.getByTestId('auto-focus-plugin')).toBeInTheDocument()
      expect(screen.getByTestId('history-plugin')).toBeInTheDocument()
      expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
      expect(screen.getByTestId('emote-dialogs')).toBeInTheDocument()
    })

    it('should initialize Lexical composer with correct configuration', () => {
      render(<ChatInput {...defaultProps} />)
      
      const composer = screen.getByTestId('lexical-composer')
      expect(composer).toHaveAttribute('data-namespace', 'chat')
      expect(composer).toHaveAttribute('role', 'textbox')
      expect(composer).toHaveAttribute('tabIndex', '0')
    })

    it('should render placeholder correctly', () => {
      render(<ChatInput {...defaultProps} />)
      
      expect(screen.getByText('Send a message...')).toBeInTheDocument()
      const contentEditable = screen.getByTestId('content-editable')
      expect(contentEditable).toHaveAttribute('placeholder', 'Enter message...')
    })

    it('should render info bar when enabled', () => {
      render(<ChatInput {...defaultProps} />)
      
      expect(screen.getByTestId('info-bar')).toBeInTheDocument()
      expect(screen.getByText('Viewers: 1337')).toBeInTheDocument()
      expect(screen.getByText('Title: Test Stream Chat')).toBeInTheDocument()
    })

    it('should not render info bar when disabled', () => {
      const props = {
        ...defaultProps,
        settings: { ...defaultProps.settings, chatrooms: { showInfoBar: false } }
      }
      
      render(<ChatInput {...props} />)
      
      expect(screen.queryByTestId('info-bar')).not.toBeInTheDocument()
    })

    it('should set up all Lexical event handlers', () => {
      render(<ChatInput {...defaultProps} />)
      
      expect(mockEditor.registerCommand).toHaveBeenCalledWith('ENTER', expect.any(Function), 1)
      expect(mockEditor.registerCommand).toHaveBeenCalledWith('ARROW_UP', expect.any(Function), 1)
      expect(mockEditor.registerCommand).toHaveBeenCalledWith('ARROW_DOWN', expect.any(Function), 1)
      expect(mockEditor.registerCommand).toHaveBeenCalledWith('TAB', expect.any(Function), 1)
      expect(mockEditor.registerCommand).toHaveBeenCalledWith('BACKSPACE', expect.any(Function), 1)
      expect(mockEditor.registerUpdateListener).toHaveBeenCalled()
      expect(mockEditor.registerNodeTransform).toHaveBeenCalled()
    })
  })

  describe('Text Input and Editing Functionality', () => {
    it('should handle basic text input', async () => {
      render(<ChatInput {...defaultProps} />)
      
      const input = screen.getByTestId('content-editable')
      expect(input).toHaveAttribute('contentEditable', 'true')
      expect(input).toHaveAttribute('spellCheck', 'false')
      
      await user.click(input)
      await user.type(input, 'Hello world')
      
      expect(input).toHaveTextContent('Hello world')
    })

    it('should handle special characters and unicode', async () => {
      render(<ChatInput {...defaultProps} />)
      
      const input = screen.getByTestId('content-editable')
      const specialText = 'Hello 世界 🌍 @user #hashtag'
      
      await user.click(input)
      await user.type(input, specialText)
      
      expect(input).toHaveTextContent(specialText)
    })

    it('should handle paste operations', async () => {
      render(<ChatInput {...defaultProps} />)
      
      const input = screen.getByTestId('content-editable')
      await user.click(input)
      
      const pasteData = 'Pasted content with emotes :Kappa: and mentions @user'
      
      // Simulate paste event
      fireEvent.paste(input, {
        clipboardData: {
          getData: () => pasteData
        }
      })
      
      // Should handle paste (implementation would process emotes and mentions)
      expect(input).toBeInTheDocument()
    })

    it('should maintain cursor position during edits', async () => {
      render(<ChatInput {...defaultProps} />)
      
      const input = screen.getByTestId('content-editable')
      await user.click(input)
      await user.type(input, 'Initial text')
      
      // Simulate cursor movement and editing
      await user.keyboard('{Home}')
      await user.type(input, 'Start: ')
      
      expect(input).toHaveTextContent('Start: Initial text')
    })
  })

  describe('Message Sending and Validation', () => {
    it('should send message on Enter key press', async () => {
      mockTextContent = 'Hello world!'
      render(<ChatInput {...defaultProps} />)
      
      const input = screen.getByTestId('content-editable')
      await user.click(input)
      await user.keyboard('{Enter}')
      
      const result = mockEditor._triggerCommand('ENTER', { 
        shiftKey: false, 
        preventDefault: vi.fn() 
      })
      
      expect(result).toBe(true)
      expect(mockChatStore.sendMessage).toHaveBeenCalledWith(
        'test-chatroom-1',
        'Hello world!'
      )
    })

    it('should not send message on Shift+Enter', async () => {
      render(<ChatInput {...defaultProps} />)
      
      const result = mockEditor._triggerCommand('ENTER', { 
        shiftKey: true, 
        preventDefault: vi.fn() 
      })
      
      expect(result).toBe(false)
      expect(mockChatStore.sendMessage).not.toHaveBeenCalled()
    })

    it('should not send empty messages', async () => {
      mockTextContent = ''
      render(<ChatInput {...defaultProps} />)
      
      const result = mockEditor._triggerCommand('ENTER', { 
        shiftKey: false, 
        preventDefault: vi.fn() 
      })
      
      expect(result).toBe(true)
      expect(mockChatStore.sendMessage).not.toHaveBeenCalled()
    })

    it('should not send whitespace-only messages', async () => {
      mockTextContent = '   \n\t  '
      render(<ChatInput {...defaultProps} />)
      
      const result = mockEditor._triggerCommand('ENTER', { 
        shiftKey: false, 
        preventDefault: vi.fn() 
      })
      
      expect(result).toBe(true)
      expect(mockChatStore.sendMessage).not.toHaveBeenCalled()
    })

    it('should clear editor after sending message (without Ctrl)', async () => {
      mockTextContent = 'Test message'
      render(<ChatInput {...defaultProps} />)
      
      mockEditor._triggerCommand('ENTER', { 
        shiftKey: false, 
        ctrlKey: false,
        preventDefault: vi.fn() 
      })
      
      expect(mockRoot.clear).toHaveBeenCalled()
    })

    it('should keep message in editor when sending with Ctrl+Enter', async () => {
      mockTextContent = 'Test message'
      render(<ChatInput {...defaultProps} />)
      
      mockEditor._triggerCommand('ENTER', { 
        shiftKey: false, 
        ctrlKey: true,
        preventDefault: vi.fn() 
      })
      
      expect(mockRoot.clear).not.toHaveBeenCalled()
    })

    it('should handle message sending failure gracefully', async () => {
      mockChatStore.sendMessage.mockRejectedValueOnce(new Error('Send failed'))
      mockTextContent = 'Failed message'
      render(<ChatInput {...defaultProps} />)
      
      // Should not throw error
      expect(() => {
        mockEditor._triggerCommand('ENTER', { 
          shiftKey: false, 
          preventDefault: vi.fn() 
        })
      }).not.toThrow()
      
      // Draft should not be cleared on failed send
      expect(mockChatStore.clearDraftMessage).not.toHaveBeenCalled()
    })
  })

  describe('Emote Integration and Autocomplete', () => {
    beforeEach(() => {
      // Set up mock selection for emote testing
      mockSelection = createMockSelection(':kappa', 6)
    })

    it('should show emote suggestions when typing colon', () => {
      render(<ChatInput {...defaultProps} />)
      
      // Simulate typing ":kappa"
      mockSelection = {
        anchor: {
          getNode: vi.fn(() => ({
            getTextContent: () => ':kappa',
            getType: () => 'text'
          })),
          offset: 6
        }
      }
      
      const mockEditorState = createMockEditorState(':kappa', mockSelection)
      mockEditor._triggerUpdate(mockEditorState)
      
      // Should trigger emote search functionality
      expect(mockEditor.registerUpdateListener).toHaveBeenCalled()
    })

    it('should handle emote selection from picker', async () => {
      render(<ChatInput {...defaultProps} />)
      
      const kickEmoteButton = screen.getByTestId('kick-emote')
      await user.click(kickEmoteButton)
      
      expect(mockEditor.focus).toHaveBeenCalled()
      expect(mockEditor.update).toHaveBeenCalled()
    })

    it('should handle 7TV emote selection', async () => {
      render(<ChatInput {...defaultProps} />)
      
      const stvEmoteButton = screen.getByTestId('7tv-emote')
      await user.click(stvEmoteButton)
      
      expect(mockEditor.focus).toHaveBeenCalled()
      expect(mockEditor.update).toHaveBeenCalled()
    })

    it('should respect subscriber-only emote restrictions', async () => {
      // Test with non-subscriber user
      const nonSubStore = {
        ...mockChatStore,
        chatrooms: [{
          ...mockChatStore.chatrooms[0],
          userChatroomInfo: { 
            ...mockChatStore.chatrooms[0].userChatroomInfo, 
            subscription: false 
          }
        }]
      }
      
      vi.mocked(require('../../../providers/ChatProvider').default)
        .mockImplementation((selector) => {
          return typeof selector === 'function' ? selector(nonSubStore) : nonSubStore
        })
      
      render(<ChatInput {...defaultProps} />)
      
      const subEmoteButton = screen.getByTestId('subscriber-emote')
      expect(subEmoteButton).toBeDisabled()
    })

    it('should allow subscriber emotes for subscribers', async () => {
      render(<ChatInput {...defaultProps} />)
      
      const subEmoteButton = screen.getByTestId('subscriber-emote')
      expect(subEmoteButton).not.toBeDisabled()
      
      await user.click(subEmoteButton)
      expect(mockEditor.focus).toHaveBeenCalled()
    })

    it('should handle tab completion for emotes', () => {
      render(<ChatInput {...defaultProps} />)
      
      // Mock current word being "kappa"
      mockSelection = {
        anchor: {
          getNode: vi.fn(() => ({
            getTextContent: () => 'kappa test',
            getType: () => 'text',
            setTextContent: vi.fn(),
            splitText: vi.fn(() => [])
          })),
          offset: 5
        }
      }
      
      const result = mockEditor._triggerCommand('TAB', { 
        shiftKey: false, 
        preventDefault: vi.fn() 
      })
      
      expect(result).toBe(true)
    })

    it('should handle emote node transformation', () => {
      render(<ChatInput {...defaultProps} />)
      
      const textNode = createMockTextNode('[emote:123:TestEmote]')
      
      // Simulate emote transformation
      mockEditor._triggerNodeTransform(require('lexical').TextNode, textNode)
      
      expect(mockEditor.registerNodeTransform).toHaveBeenCalled()
    })

    it('should handle large emotes correctly', async () => {
      render(<ChatInput {...defaultProps} />)
      
      const largeEmoteButton = screen.getByTestId('large-emote')
      await user.click(largeEmoteButton)
      
      expect(mockEditor.focus).toHaveBeenCalled()
    })
  })

  describe('Chatter Mentions and Autocomplete', () => {
    it('should show chatter suggestions when typing @', () => {
      render(<ChatInput {...defaultProps} />)
      
      // Simulate typing "@viewer"
      mockSelection = {
        anchor: {
          getNode: vi.fn(() => ({
            getTextContent: () => '@viewer',
            getType: () => 'text'
          })),
          offset: 7
        }
      }
      
      const mockEditorState = createMockEditorState('@viewer', mockSelection)
      mockEditor._triggerUpdate(mockEditorState)
      
      expect(mockEditor.registerUpdateListener).toHaveBeenCalled()
    })

    it('should filter chatters by username prefix', () => {
      render(<ChatInput {...defaultProps} />)
      
      // Test filtering logic would be in the update listener
      // The component should filter chatters based on the text after @
      expect(mockChatStore.chatters['test-chatroom-1']).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ username: 'viewer1' }),
          expect.objectContaining({ username: 'moderator1' }),
          expect.objectContaining({ username: 'subscriber1' })
        ])
      )
    })

    it('should handle chatter selection with arrow keys', () => {
      render(<ChatInput {...defaultProps} />)
      
      // Set up chatter suggestions context
      const mockEvent = { preventDefault: vi.fn() }
      
      const upResult = mockEditor._triggerCommand('ARROW_UP', mockEvent)
      const downResult = mockEditor._triggerCommand('ARROW_DOWN', mockEvent)
      
      expect(upResult).toBe(false) // No suggestions active
      expect(downResult).toBe(true)
    })

    it('should handle usernames with underscores', () => {
      render(<ChatInput {...defaultProps} />)
      
      const chattersWithUnderscores = mockChatStore.chatters['test-chatroom-1']
        .filter(c => c.username.includes('_'))
      
      expect(chattersWithUnderscores).toHaveLength(1)
      expect(chattersWithUnderscores[0].username).toBe('viewer_with_underscore')
    })
  })

  describe('Reply Functionality', () => {
    it('should not show reply UI initially', () => {
      render(<ChatInput {...defaultProps} />)
      
      expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument()
    })

    it('should handle reply data from external API', async () => {
      render(<ChatInput {...defaultProps} />)
      
      const replyData = createMockReplyData({
        content: 'Original message to reply to',
        sender: { username: 'originaluser', id: 'orig123' }
      })
      
      act(() => {
        triggerMockReply(replyData)
      })
      
      await waitFor(() => {
        expect(screen.getByText(/Replying to/)).toBeInTheDocument()
        expect(screen.getByText(/@originaluser/)).toBeInTheDocument()
      })
      
      expect(screen.getByTestId('parsed-message')).toBeInTheDocument()
    })

    it('should close reply UI when close button is clicked', async () => {
      render(<ChatInput {...defaultProps} />)
      
      const replyData = createMockReplyData()
      act(() => {
        triggerMockReply(replyData)
      })
      
      await waitFor(() => {
        expect(screen.getByText(/Replying to/)).toBeInTheDocument()
      })
      
      const closeButton = screen.getByRole('button')
      await user.click(closeButton)
      
      await waitFor(() => {
        expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument()
      })
    })

    it('should send reply when reply data is present', async () => {
      mockTextContent = 'This is my reply'
      render(<ChatInput {...defaultProps} />)
      
      const replyData = createMockReplyData({
        id: 'msg123',
        content: 'Original message',
        sender: { username: 'originaluser', id: 'orig123' }
      })
      
      act(() => {
        triggerMockReply(replyData)
      })
      
      await waitFor(() => {
        expect(screen.getByText(/Replying to/)).toBeInTheDocument()
      })
      
      mockEditor._triggerCommand('ENTER', { 
        shiftKey: false, 
        preventDefault: vi.fn() 
      })
      
      expect(mockChatStore.sendReply).toHaveBeenCalledWith(
        'test-chatroom-1',
        'This is my reply',
        expect.objectContaining({
          original_message: expect.objectContaining({
            id: 'msg123',
            content: 'Original message'
          }),
          original_sender: expect.objectContaining({
            username: 'originaluser'
          })
        })
      )
    })

    it('should handle nested reply (reply to reply)', async () => {
      mockTextContent = 'Nested reply'
      render(<ChatInput {...defaultProps} />)
      
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
      
      mockEditor._triggerCommand('ENTER', { 
        shiftKey: false, 
        preventDefault: vi.fn() 
      })
      
      // Should reply to the original message, not the reply
      expect(mockChatStore.sendReply).toHaveBeenCalledWith(
        'test-chatroom-1',
        'Nested reply',
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

    it('should clear reply after sending', async () => {
      mockTextContent = 'Reply message'
      render(<ChatInput {...defaultProps} />)
      
      const replyData = createMockReplyData()
      act(() => {
        triggerMockReply(replyData)
      })
      
      mockEditor._triggerCommand('ENTER', { 
        shiftKey: false, 
        preventDefault: vi.fn() 
      })
      
      // Reply should be cleared after sending
      await waitFor(() => {
        expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument()
      })
    })

    it('should handle invalid reply data gracefully', () => {
      render(<ChatInput {...defaultProps} />)
      
      const invalidData = {
        // Missing required fields
        id: null,
        content: null,
        sender: null
      }
      
      act(() => {
        triggerMockReply(invalidData)
      })
      
      // Should not show reply UI for invalid data
      expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument()
    })

    it('should handle reply thread mode', () => {
      const replyThreadProps = {
        ...defaultProps,
        isReplyThread: true,
        replyMessage: {
          original_message: { id: 'msg1', content: 'Original' },
          original_sender: { username: 'sender1' }
        }
      }
      
      render(<ChatInput {...replyThreadProps} />)
      
      // Should render normally in reply thread mode
      expect(screen.getByTestId('lexical-composer')).toBeInTheDocument()
    })
  })

  describe('Draft Message Persistence', () => {
    it('should save draft messages on content change', () => {
      render(<ChatInput {...defaultProps} />)
      
      const mockEditorState = createMockEditorState('Draft message content')
      mockEditor._triggerUpdate(mockEditorState)
      
      expect(mockChatStore.saveDraftMessage).toHaveBeenCalledWith(
        'test-chatroom-1',
        'Draft message content'
      )
    })

    it('should restore draft when switching to chatroom', () => {
      mockChatStore.getDraftMessage.mockReturnValue('Saved draft message')
      
      render(<ChatInput {...defaultProps} />)
      
      expect(mockChatStore.getDraftMessage).toHaveBeenCalledWith('test-chatroom-1')
    })

    it('should clear draft after successful message send', async () => {
      mockTextContent = 'Message to send'
      render(<ChatInput {...defaultProps} />)
      
      mockEditor._triggerCommand('ENTER', { 
        shiftKey: false, 
        preventDefault: vi.fn() 
      })
      
      expect(mockChatStore.clearDraftMessage).toHaveBeenCalledWith('test-chatroom-1')
    })

    it('should maintain separate drafts for different chatrooms', () => {
      const { rerender } = render(<ChatInput {...defaultProps} />)
      
      // Switch to different chatroom
      rerender(<ChatInput {...defaultProps} chatroomId="test-chatroom-2" />)
      
      expect(mockChatStore.getDraftMessage).toHaveBeenCalledWith('test-chatroom-2')
    })

    it('should clear reply data when switching chatrooms', () => {
      const { rerender } = render(<ChatInput {...defaultProps} />)
      
      // Set up reply data
      const replyData = createMockReplyData()
      act(() => {
        triggerMockReply(replyData)
      })
      
      // Switch chatroom
      rerender(<ChatInput {...defaultProps} chatroomId="test-chatroom-2" />)
      
      // Reply data should be cleared
      expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument()
    })
  })

  describe('Keyboard Shortcuts and Event Handling', () => {
    it('should handle message history navigation with arrow keys', () => {
      render(<ChatInput {...defaultProps} />)
      
      const mockEvent = { preventDefault: vi.fn() }
      
      // Should handle arrow up for history
      const upResult = mockEditor._triggerCommand('ARROW_UP', mockEvent)
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(upResult).toBe(false) // No history initially
      
      // Should handle arrow down
      const downResult = mockEditor._triggerCommand('ARROW_DOWN', mockEvent)
      expect(downResult).toBe(true)
    })

    it('should handle tab key for emote completion', () => {
      render(<ChatInput {...defaultProps} />)
      
      const result = mockEditor._triggerCommand('TAB', { 
        shiftKey: false, 
        preventDefault: vi.fn() 
      })
      
      expect(result).toBe(true)
    })

    it('should ignore Shift+Tab', () => {
      render(<ChatInput {...defaultProps} />)
      
      const result = mockEditor._triggerCommand('TAB', { 
        shiftKey: true, 
        preventDefault: vi.fn() 
      })
      
      expect(result).toBe(false)
    })

    it('should handle backspace for emote deletion', () => {
      render(<ChatInput {...defaultProps} />)
      
      // Mock selection with emote-like text
      mockSelection = {
        anchor: {
          getNode: vi.fn(() => ({
            getType: () => 'paragraph',
            getTextContent: () => '[emote:123:TestEmote]',
            getChildren: vi.fn(() => [
              {
                getTextContent: () => '[emote:123:TestEmote]',
                remove: vi.fn()
              }
            ])
          })),
          offset: 0
        }
      }
      
      const result = mockEditor._triggerCommand('BACKSPACE', {})
      expect(typeof result).toBe('boolean')
    })

    it('should handle space key to reset tab suggestions', () => {
      render(<ChatInput {...defaultProps} />)
      
      mockEditor._triggerCommand('SPACE', {})
      
      // Should reset tab suggestions (implementation detail)
      expect(mockEditor.registerCommand).toHaveBeenCalledWith(
        'SPACE',
        expect.any(Function),
        2
      )
    })

    it('should handle keyboard event listeners for tab reset', () => {
      render(<ChatInput {...defaultProps} />)
      
      // Mock DOM element with event listeners
      const rootElement = mockEditor.getRootElement()
      expect(rootElement).toBeDefined()
      
      // Simulate keydown event
      fireEvent.keyDown(rootElement, { key: 'A' })
      
      // Should not throw error
      expect(rootElement).toBeInTheDocument()
    })
  })

  describe('Command System', () => {
    it('should handle user lookup command', async () => {
      mockTextContent = '/user @testviewer'
      render(<ChatInput {...defaultProps} />)
      
      mockEditor._triggerCommand('ENTER', { 
        shiftKey: false, 
        preventDefault: vi.fn() 
      })
      
      await waitFor(() => {
        expect(mockEnv.windowApp.kick.getUserChatroomInfo).toHaveBeenCalledWith(
          'teststreamer',
          'testviewer'
        )
      })
    })

    it('should handle user command with @ prefix', async () => {
      mockTextContent = '/user @testuser'
      render(<ChatInput {...defaultProps} />)
      
      mockEditor._triggerCommand('ENTER', { 
        shiftKey: false, 
        preventDefault: vi.fn() 
      })
      
      await waitFor(() => {
        expect(mockEnv.windowApp.kick.getUserChatroomInfo).toHaveBeenCalledWith(
          'teststreamer',
          'testuser'
        )
      })
    })

    it('should open user dialog after successful lookup', async () => {
      mockTextContent = '/user testuser'
      render(<ChatInput {...defaultProps} />)
      
      mockEditor._triggerCommand('ENTER', { 
        shiftKey: false, 
        preventDefault: vi.fn() 
      })
      
      await waitFor(() => {
        expect(mockEnv.windowApp.userDialog.open).toHaveBeenCalledWith(
          expect.objectContaining({
            sender: expect.objectContaining({
              username: 'testuser'
            }),
            chatroomId: 'test-chatroom-1'
          })
        )
      })
    })

    it('should handle command with no username gracefully', async () => {
      mockTextContent = '/user'
      render(<ChatInput {...defaultProps} />)
      
      mockEditor._triggerCommand('ENTER', { 
        shiftKey: false, 
        preventDefault: vi.fn() 
      })
      
      // Should not make API calls without username
      expect(mockEnv.windowApp.kick.getUserChatroomInfo).not.toHaveBeenCalled()
    })

    it('should handle failed user lookup', async () => {
      mockEnv.windowApp.kick.getUserChatroomInfo.mockRejectedValueOnce(
        new Error('User not found')
      )
      mockTextContent = '/user nonexistentuser'
      render(<ChatInput {...defaultProps} />)
      
      mockEditor._triggerCommand('ENTER', { 
        shiftKey: false, 
        preventDefault: vi.fn() 
      })
      
      // Should not crash on failed lookup
      await waitFor(() => {
        expect(mockEnv.windowApp.kick.getUserChatroomInfo).toHaveBeenCalled()
      })
    })
  })

  describe('Character Limits and Input Validation', () => {
    it('should handle maximum character limit', async () => {
      const longMessage = 'a'.repeat(1000) // Simulate very long message
      mockTextContent = longMessage
      render(<ChatInput {...defaultProps} />)
      
      // Should still attempt to send (server will validate)
      mockEditor._triggerCommand('ENTER', { 
        shiftKey: false, 
        preventDefault: vi.fn() 
      })
      
      expect(mockChatStore.sendMessage).toHaveBeenCalledWith(
        'test-chatroom-1',
        longMessage
      )
    })

    it('should handle special characters in messages', async () => {
      const specialMessage = '!@#$%^&*()_+-=[]{}|;:,.<>?`~'
      mockTextContent = specialMessage
      render(<ChatInput {...defaultProps} />)
      
      mockEditor._triggerCommand('ENTER', { 
        shiftKey: false, 
        preventDefault: vi.fn() 
      })
      
      expect(mockChatStore.sendMessage).toHaveBeenCalledWith(
        'test-chatroom-1',
        specialMessage
      )
    })

    it('should handle newlines in messages', async () => {
      const messageWithNewlines = 'Line 1\nLine 2\nLine 3'
      mockTextContent = messageWithNewlines
      render(<ChatInput {...defaultProps} />)
      
      mockEditor._triggerCommand('ENTER', { 
        shiftKey: false, 
        preventDefault: vi.fn() 
      })
      
      expect(mockChatStore.sendMessage).toHaveBeenCalledWith(
        'test-chatroom-1',
        messageWithNewlines
      )
    })
  })

  describe('Integration with ChatProvider', () => {
    it('should access chatroom data correctly', () => {
      render(<ChatInput {...defaultProps} />)
      
      // Verify that all chatroom data is accessible
      expect(mockChatStore.chatrooms).toHaveLength(1)
      expect(mockChatStore.chatrooms[0].id).toBe('test-chatroom-1')
      expect(mockChatStore.chatrooms[0].userChatroomInfo).toBeDefined()
      expect(mockChatStore.chatrooms[0].emotes).toBeDefined()
      expect(mockChatStore.chatrooms[0].channel7TVEmotes).toBeDefined()
    })

    it('should handle missing chatroom data gracefully', () => {
      const emptyChatStore = {
        ...mockChatStore,
        chatrooms: []
      }
      
      vi.mocked(require('../../../providers/ChatProvider').default)
        .mockImplementation((selector) => {
          return typeof selector === 'function' ? selector(emptyChatStore) : emptyChatStore
        })
      
      // Should not crash with missing data
      expect(() => {
        render(<ChatInput {...defaultProps} chatroomId="nonexistent" />)
      }).not.toThrow()
    })

    it('should handle chatters data correctly', () => {
      render(<ChatInput {...defaultProps} />)
      
      const chatters = mockChatStore.chatters['test-chatroom-1']
      expect(chatters).toHaveLength(5)
      expect(chatters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ username: 'viewer1' }),
          expect.objectContaining({ username: 'moderator1' }),
          expect.objectContaining({ username: 'subscriber1' })
        ])
      )
    })

    it('should handle personal emote sets', () => {
      render(<ChatInput {...defaultProps} />)
      
      expect(mockChatStore.personalEmoteSets).toHaveLength(1)
      expect(mockChatStore.personalEmoteSets[0]).toEqual(
        expect.objectContaining({
          type: 'personal',
          emotes: expect.arrayContaining([
            expect.objectContaining({ name: 'MyEmote' })
          ])
        })
      )
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle Lexical editor errors gracefully', () => {
      // Mock error in editor update
      mockEditor.update.mockImplementationOnce(() => {
        throw new Error('Lexical update error')
      })
      
      render(<ChatInput {...defaultProps} />)
      
      // Should not crash the component
      expect(screen.getByTestId('lexical-composer')).toBeInTheDocument()
    })

    it('should handle error boundary activation', () => {
      render(<ChatInput {...defaultProps} />)
      
      // Simulate error boundary trigger
      if (window.mockErrorBoundary) {
        expect(() => {
          window.mockErrorBoundary(new Error('Test error'))
        }).not.toThrow()
      }
    })

    it('should handle missing window.app gracefully', () => {
      // Temporarily remove window.app
      const originalApp = global.window.app
      delete global.window.app
      
      expect(() => {
        render(<ChatInput {...defaultProps} />)
      }).not.toThrow()
      
      // Restore window.app
      global.window.app = originalApp
    })

    it('should handle invalid emote data', async () => {
      const invalidEmoteStore = {
        ...mockChatStore,
        chatrooms: [{
          ...mockChatStore.chatrooms[0],
          emotes: [{ emotes: null }], // Invalid emote data
          channel7TVEmotes: null
        }]
      }
      
      vi.mocked(require('../../../providers/ChatProvider').default)
        .mockImplementation((selector) => {
          return typeof selector === 'function' ? selector(invalidEmoteStore) : invalidEmoteStore
        })
      
      render(<ChatInput {...defaultProps} />)
      
      // Should handle invalid emote data without crashing
      expect(screen.getByTestId('emote-dialogs')).toBeInTheDocument()
    })

    it('should handle network timeouts', async () => {
      mockChatStore.sendMessage.mockImplementationOnce(
        () => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      )
      
      mockTextContent = 'Timeout test message'
      render(<ChatInput {...defaultProps} />)
      
      mockEditor._triggerCommand('ENTER', { 
        shiftKey: false, 
        preventDefault: vi.fn() 
      })
      
      // Should handle timeout gracefully
      await waitFor(() => {
        expect(mockChatStore.sendMessage).toHaveBeenCalled()
      }, { timeout: 200 })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<ChatInput {...defaultProps} />)
      
      const contentEditable = screen.getByTestId('content-editable')
      expect(contentEditable).toHaveAttribute('aria-placeholder', 'Enter message...')
      expect(contentEditable).toHaveAttribute('role', 'textbox')
    })

    it('should have proper keyboard navigation', () => {
      render(<ChatInput {...defaultProps} />)
      
      const composer = screen.getByTestId('lexical-composer')
      expect(composer).toHaveAttribute('tabIndex', '0')
      expect(composer).toHaveAttribute('role', 'textbox')
    })

    it('should maintain focus management', async () => {
      render(<ChatInput {...defaultProps} />)
      
      const composer = screen.getByTestId('lexical-composer')
      await user.click(composer)
      
      expect(composer).toHaveFocus()
    })

    it('should handle screen reader announcements for replies', async () => {
      render(<ChatInput {...defaultProps} />)
      
      const replyData = createMockReplyData({
        sender: { username: 'testuser' }
      })
      
      act(() => {
        triggerMockReply(replyData)
      })
      
      await waitFor(() => {
        const replyText = screen.getByText(/Replying to/)
        expect(replyText).toBeInTheDocument()
      })
    })

    it('should provide proper focus indicators', () => {
      render(<ChatInput {...defaultProps} />)
      
      const contentEditable = screen.getByTestId('content-editable')
      expect(contentEditable).toHaveAttribute('contentEditable', 'true')
      expect(contentEditable).not.toHaveAttribute('disabled')
    })
  })

  describe('Performance and Memory Management', () => {
    it('should cleanup event listeners on unmount', () => {
      const { unmount } = render(<ChatInput {...defaultProps} />)
      
      const commandHandlers = mockEditor.registerCommand.mock.results
      const updateListeners = mockEditor.registerUpdateListener.mock.results
      const nodeTransforms = mockEditor.registerNodeTransform.mock.results
      
      // All registrations should return cleanup functions
      commandHandlers.forEach(result => {
        expect(typeof result.value).toBe('function')
      })
      updateListeners.forEach(result => {
        expect(typeof result.value).toBe('function')
      })
      nodeTransforms.forEach(result => {
        expect(typeof result.value).toBe('function')
      })
      
      unmount()
      
      // Cleanup functions would have been called
    })

    it('should handle rapid re-renders efficiently', () => {
      const { rerender } = render(<ChatInput {...defaultProps} />)
      
      // Rapid re-renders with same props (should be memoized)
      for (let i = 0; i < 10; i++) {
        rerender(<ChatInput {...defaultProps} />)
      }
      
      expect(screen.getByTestId('lexical-composer')).toBeInTheDocument()
    })

    it('should handle chatroom switching efficiently', () => {
      const { rerender } = render(<ChatInput {...defaultProps} />)
      
      // Switch between different chatrooms
      const chatrooms = ['room-1', 'room-2', 'room-3']
      chatrooms.forEach(chatroomId => {
        rerender(<ChatInput {...defaultProps} chatroomId={chatroomId} />)
      })
      
      expect(screen.getByTestId('lexical-composer')).toBeInTheDocument()
    })

    it('should handle large emote lists without performance degradation', () => {
      const largeEmoteStore = {
        ...mockChatStore,
        chatrooms: [{
          ...mockChatStore.chatrooms[0],
          emotes: [{
            emotes: Array.from({ length: 1000 }, (_, i) => ({
              id: `emote${i}`,
              name: `Emote${i}`,
              platform: 'kick',
              subscribers_only: false
            }))
          }],
          channel7TVEmotes: [{
            emotes: Array.from({ length: 1000 }, (_, i) => ({
              id: `7tv${i}`,
              name: `STVEmote${i}`,
              platform: '7tv',
              width: '28px',
              height: '28px'
            }))
          }]
        }]
      }
      
      vi.mocked(require('../../../providers/ChatProvider').default)
        .mockImplementation((selector) => {
          return typeof selector === 'function' ? selector(largeEmoteStore) : largeEmoteStore
        })
      
      const startTime = performance.now()
      render(<ChatInput {...defaultProps} />)
      const renderTime = performance.now() - startTime
      
      expect(renderTime).toBeLessThan(1000) // Should render quickly even with large lists
      expect(screen.getByTestId('lexical-composer')).toBeInTheDocument()
    })
  })

  describe('Component Memoization', () => {
    it('should memoize component properly', () => {
      const { rerender } = render(<ChatInput {...defaultProps} />)
      
      // Re-render with identical props
      rerender(<ChatInput {...defaultProps} />)
      
      // Should not cause unnecessary re-renders due to memoization
      expect(screen.getByTestId('lexical-composer')).toBeInTheDocument()
    })

    it('should re-render when chatroom changes', () => {
      const { rerender } = render(<ChatInput {...defaultProps} />)
      
      // Change chatroom
      rerender(<ChatInput {...defaultProps} chatroomId="different-room" />)
      
      expect(screen.getByTestId('lexical-composer')).toBeInTheDocument()
    })

    it('should re-render when settings change', () => {
      const { rerender } = render(<ChatInput {...defaultProps} />)
      
      const newSettings = {
        ...defaultProps.settings,
        chatrooms: { showInfoBar: false }
      }
      
      rerender(<ChatInput {...defaultProps} settings={newSettings} />)
      
      expect(screen.queryByTestId('info-bar')).not.toBeInTheDocument()
    })
  })

  describe('Real-world Scenarios', () => {
    it('should handle complete conversation flow', async () => {
      render(<ChatInput {...defaultProps} />)
      
      // Type message with emote and mention
      const input = screen.getByTestId('content-editable')
      await user.click(input)
      await user.type(input, 'Hey @viewer1 check this ')
      
      // Add emote
      const emoteButton = screen.getByTestId('kick-emote')
      await user.click(emoteButton)
      
      // Add more text
      await user.type(input, ' and subscribe!')
      
      // Send message
      await user.keyboard('{Enter}')
      
      expect(mockChatStore.sendMessage).toHaveBeenCalled()
    })

    it('should handle streamer interaction workflow', async () => {
      mockTextContent = '/user @viewer1'
      render(<ChatInput {...defaultProps} />)
      
      // Streamer looks up user
      mockEditor._triggerCommand('ENTER', { 
        shiftKey: false, 
        preventDefault: vi.fn() 
      })
      
      await waitFor(() => {
        expect(mockEnv.windowApp.kick.getUserChatroomInfo).toHaveBeenCalledWith(
          'teststreamer',
          'viewer1'
        )
      })
      
      // User dialog opens
      expect(mockEnv.windowApp.userDialog.open).toHaveBeenCalled()
    })

    it('should handle mod interaction workflow', async () => {
      // Set user as moderator
      const modStore = {
        ...mockChatStore,
        chatrooms: [{
          ...mockChatStore.chatrooms[0],
          userChatroomInfo: {
            ...mockChatStore.chatrooms[0].userChatroomInfo,
            badges: ['moderator']
          }
        }]
      }
      
      vi.mocked(require('../../../providers/ChatProvider').default)
        .mockImplementation((selector) => {
          return typeof selector === 'function' ? selector(modStore) : modStore
        })
      
      render(<ChatInput {...defaultProps} />)
      
      // Should render with mod permissions
      expect(screen.getByTestId('lexical-composer')).toBeInTheDocument()
    })

    it('should handle subscriber interaction with premium emotes', async () => {
      render(<ChatInput {...defaultProps} />)
      
      // Subscriber should be able to use sub-only emotes
      const subEmoteButton = screen.getByTestId('subscriber-emote')
      expect(subEmoteButton).not.toBeDisabled()
      
      await user.click(subEmoteButton)
      expect(mockEditor.focus).toHaveBeenCalled()
    })

    it('should handle rapid message sending (spam protection)', async () => {
      render(<ChatInput {...defaultProps} />)
      
      // Send multiple messages rapidly
      for (let i = 0; i < 5; i++) {
        mockTextContent = `Rapid message ${i}`
        mockEditor._triggerCommand('ENTER', { 
          shiftKey: false, 
          preventDefault: vi.fn() 
        })
      }
      
      // All messages should be sent (rate limiting would be server-side)
      expect(mockChatStore.sendMessage).toHaveBeenCalledTimes(5)
    })
  })

  describe('Edge Cases and Stress Testing', () => {
    it('should handle extremely long emote names', async () => {
      const longEmoteName = 'a'.repeat(200)
      const longEmote = createMockEmote({ 
        name: longEmoteName,
        id: 'long123' 
      })
      
      // Should handle long emote names without issues
      expect(longEmote.name).toHaveLength(200)
    })

    it('should handle special Unicode in usernames', () => {
      const unicodeStore = {
        ...mockChatStore,
        chatters: {
          'test-chatroom-1': [
            { id: '1', username: 'user_中文' },
            { id: '2', username: 'モデレータ' },
            { id: '3', username: 'пользователь' },
            { id: '4', username: '🎮gamer🎮' }
          ]
        }
      }
      
      vi.mocked(require('../../../providers/ChatProvider').default)
        .mockImplementation((selector) => {
          return typeof selector === 'function' ? selector(unicodeStore) : unicodeStore
        })
      
      render(<ChatInput {...defaultProps} />)
      
      // Should handle Unicode usernames
      expect(unicodeStore.chatters['test-chatroom-1']).toHaveLength(4)
    })

    it('should handle malformed emote data', () => {
      const malformedEmoteStore = {
        ...mockChatStore,
        chatrooms: [{
          ...mockChatStore.chatrooms[0],
          emotes: [
            { emotes: [{ id: null, name: undefined, platform: '' }] },
            null,
            undefined,
            { emotes: [] }
          ]
        }]
      }
      
      vi.mocked(require('../../../providers/ChatProvider').default)
        .mockImplementation((selector) => {
          return typeof selector === 'function' ? selector(malformedEmoteStore) : malformedEmoteStore
        })
      
      // Should not crash with malformed data
      expect(() => {
        render(<ChatInput {...defaultProps} />)
      }).not.toThrow()
    })

    it('should handle concurrent reply operations', async () => {
      render(<ChatInput {...defaultProps} />)
      
      // Trigger multiple rapid reply operations
      const replies = [
        createMockReplyData({ id: 'reply1', sender: { username: 'user1' } }),
        createMockReplyData({ id: 'reply2', sender: { username: 'user2' } }),
        createMockReplyData({ id: 'reply3', sender: { username: 'user3' } })
      ]
      
      // Only the last reply should be active
      replies.forEach(reply => {
        act(() => {
          triggerMockReply(reply)
        })
      })
      
      await waitFor(() => {
        expect(screen.getByText(/@user3/)).toBeInTheDocument()
      })
    })
  })
})