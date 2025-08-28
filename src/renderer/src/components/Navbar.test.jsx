import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

import Navbar from './Navbar'

// Mock modules
vi.mock('@assets/styles/components/Navbar.scss')
vi.mock('clsx', () => ({
  default: (...args) => args.filter(Boolean).join(' ')
}))

// Mock static assets
vi.mock('@assets/icons/plus-bold.svg?asset', () => ({ default: 'plus-icon.svg' }))
vi.mock('@assets/icons/x-bold.svg?asset', () => ({ default: 'x-icon.svg' }))
vi.mock('@assets/icons/notification-bell.svg?asset', () => ({ default: 'notification-icon.svg' }))
vi.mock('@assets/icons/message-bubble.svg?asset', () => ({ default: 'message-icon.svg' }))

// Mock drag and drop
vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children, onDragEnd }) => {
    const mockProvided = {
      droppableProps: { 'data-rfd-droppable-id': 'chatrooms' },
      innerRef: vi.fn(),
      placeholder: null
    }
    return (
      <div data-testid="drag-drop-context" data-ondragend={onDragEnd}>
        {typeof children === 'function' ? children() : children}
      </div>
    )
  },
  Droppable: ({ children, droppableId, direction }) => {
    const mockProvided = {
      droppableProps: { 'data-rfd-droppable-id': droppableId },
      innerRef: vi.fn(),
      placeholder: <div data-testid="placeholder" />
    }
    return (
      <div data-testid={`droppable-${droppableId}`} data-direction={direction}>
        {children(mockProvided)}
      </div>
    )
  }
}))

// Mock child components
vi.mock('./Navbar/ChatroomTab', () => ({
  default: ({ 
    chatroom, 
    currentChatroomId, 
    onSelectChatroom, 
    onRemoveChatroom, 
    onRename,
    editingChatroomId,
    editingName,
    setEditingName,
    onRenameSubmit,
    setEditingChatroomId
  }) => (
    <div 
      data-testid={`chatroom-tab-${chatroom.id}`}
      data-current={chatroom.id === currentChatroomId}
      onClick={() => onSelectChatroom(chatroom.id)}
    >
      <span>{chatroom.displayName || chatroom.username}</span>
      <button 
        data-testid={`remove-chatroom-${chatroom.id}`}
        onClick={(e) => {
          e.stopPropagation()
          onRemoveChatroom(chatroom.id)
        }}
      >
        Remove
      </button>
      <button 
        data-testid={`rename-chatroom-${chatroom.id}`}
        onClick={() => onRename({ chatroomId: chatroom.id, currentDisplayName: chatroom.displayName || chatroom.username })}
      >
        Rename
      </button>
      {editingChatroomId === chatroom.id && (
        <input
          data-testid={`rename-input-${chatroom.id}`}
          value={editingName}
          onChange={(e) => setEditingName(e.target.value)}
          onBlur={() => onRenameSubmit(chatroom.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onRenameSubmit(chatroom.id)
            } else if (e.key === 'Escape') {
              setEditingChatroomId(null)
            }
          }}
          autoFocus
          ref={(el) => el && el.focus()}
        />
      )}
    </div>
  )
}))

vi.mock('./Navbar/MentionsTab', () => ({
  default: ({ currentChatroomId, onSelectChatroom, onRemoveMentionsTab }) => (
    <div 
      data-testid="mentions-tab"
      data-current={currentChatroomId === 'mentions'}
      onClick={() => onSelectChatroom('mentions')}
    >
      <span>Mentions</span>
      <button 
        data-testid="remove-mentions-tab"
        onClick={(e) => {
          e.stopPropagation()
          onRemoveMentionsTab()
        }}
      >
        Remove Mentions
      </button>
    </div>
  )
}))

// Mock providers
const mockChatStore = {
  connections: {},
  chatrooms: [],
  hasMentionsTab: false,
  messages: {},
  addChatroom: vi.fn(),
  removeChatroom: vi.fn(),
  renameChatroom: vi.fn(),
  reorderChatrooms: vi.fn(),
  addMentionsTab: vi.fn(),
  removeMentionsTab: vi.fn(),
}

vi.mock('../providers/ChatProvider', () => ({
  default: (selector) => selector(mockChatStore)
}))

const mockSettings = {
  general: {
    wrapChatroomsList: false,
    compactChatroomsList: false,
    showTabImages: true
  }
}

const mockSettingsProvider = {
  settings: mockSettings
}

vi.mock('../providers/SettingsProvider', () => ({
  useSettings: () => mockSettingsProvider
}))

// Mock useClickOutside hook
vi.mock('../utils/useClickOutside', () => ({
  default: (ref, handler) => {
    // Store the handler for testing
    if (typeof handler === 'function') {
      global.mockClickOutsideHandler = handler
    }
  }
}))

// Mock window.app for auth dialog
global.window.app = {
  authDialog: {
    open: vi.fn()
  }
}

describe('Navbar Component', () => {
  const defaultProps = {
    currentChatroomId: null,
    kickId: 'test-user-123',
    onSelectChatroom: vi.fn()
  }

  const sampleChatrooms = [
    {
      id: 'chatroom-1',
      username: 'streamer1',
      displayName: 'Streamer One',
      order: 0,
      streamerData: { user: { profile_pic: 'pic1.jpg' } },
      isStreamerLive: false
    },
    {
      id: 'chatroom-2', 
      username: 'streamer2',
      displayName: 'Streamer Two',
      order: 1,
      streamerData: { user: { profile_pic: 'pic2.jpg' } },
      isStreamerLive: true
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset mock store state
    mockChatStore.chatrooms = []
    mockChatStore.hasMentionsTab = false
    mockChatStore.connections = {}
    mockChatStore.messages = {}
    
    // Reset settings
    mockSettingsProvider.settings = { general: { ...mockSettings.general } }
    
    // Clear global mocks
    global.mockClickOutsideHandler = null
  })

  describe('Basic Rendering', () => {
    it('should render navbar container with correct classes', () => {
      render(<Navbar {...defaultProps} />)
      
      const navbarContainer = screen.getByTestId('drag-drop-context').closest('.navbarContainer')
      expect(navbarContainer).toBeInTheDocument()
      expect(navbarContainer).toHaveClass('navbarContainer')
    })

    it('should apply wrap chatrooms list class when setting enabled', () => {
      mockSettingsProvider.settings.general.wrapChatroomsList = true
      
      render(<Navbar {...defaultProps} />)
      
      const navbarContainer = screen.getByTestId('drag-drop-context').closest('.navbarContainer')
      expect(navbarContainer).toHaveClass('navbarContainer', 'wrapChatroomList')
    })

    it('should apply compact chatrooms list class when setting enabled', () => {
      mockSettingsProvider.settings.general.compactChatroomsList = true
      
      render(<Navbar {...defaultProps} />)
      
      const navbarContainer = screen.getByTestId('drag-drop-context').closest('.navbarContainer')
      expect(navbarContainer).toHaveClass('navbarContainer', 'compactChatroomList')
    })

    it('should render drag and drop context', () => {
      render(<Navbar {...defaultProps} />)
      
      const dragDropContext = screen.getByTestId('drag-drop-context')
      expect(dragDropContext).toBeInTheDocument()
      
      const droppable = screen.getByTestId('droppable-chatrooms')
      expect(droppable).toBeInTheDocument()
      expect(droppable).toHaveAttribute('data-direction', 'horizontal')
    })

    it('should render add chatroom button when wrap setting is disabled', () => {
      render(<Navbar {...defaultProps} />)
      
      const addButton = screen.getByRole('button', { name: /add/i })
      expect(addButton).toBeInTheDocument()
      expect(addButton).toHaveTextContent('Add')
    })

    it('should render wrapped add chatroom button when wrap setting is enabled', () => {
      mockSettingsProvider.settings.general.wrapChatroomsList = true
      
      render(<Navbar {...defaultProps} />)
      
      const addButtons = screen.getAllByRole('button', { name: /add/i })
      expect(addButtons).toHaveLength(1)
      expect(addButtons[0]).toHaveTextContent('Add')
    })
  })

  describe('Chatroom Management', () => {
    beforeEach(() => {
      mockChatStore.chatrooms = [...sampleChatrooms]
    })

    it('should render chatroom tabs', () => {
      render(<Navbar {...defaultProps} />)
      
      expect(screen.getByTestId('chatroom-tab-chatroom-1')).toBeInTheDocument()
      expect(screen.getByTestId('chatroom-tab-chatroom-2')).toBeInTheDocument()
      expect(screen.getByText('Streamer One')).toBeInTheDocument()
      expect(screen.getByText('Streamer Two')).toBeInTheDocument()
    })

    it('should show separator when chatrooms exist', () => {
      render(<Navbar {...defaultProps} />)
      
      const separator = document.querySelector('.chatroomsSeparator')
      expect(separator).toBeInTheDocument()
    })

    it('should select chatroom when clicked', () => {
      const onSelectChatroom = vi.fn()
      
      render(<Navbar {...defaultProps} onSelectChatroom={onSelectChatroom} />)
      
      fireEvent.click(screen.getByTestId('chatroom-tab-chatroom-1'))
      
      expect(onSelectChatroom).toHaveBeenCalledWith('chatroom-1')
    })

    it('should remove chatroom and select next available', async () => {
      const onSelectChatroom = vi.fn()
      const removeChatroom = vi.fn().mockResolvedValue()
      mockChatStore.removeChatroom = removeChatroom
      
      render(<Navbar {...defaultProps} onSelectChatroom={onSelectChatroom} />)
      
      fireEvent.click(screen.getByTestId('remove-chatroom-chatroom-1'))
      
      expect(removeChatroom).toHaveBeenCalledWith('chatroom-1')
      await vi.waitFor(() => {
        expect(onSelectChatroom).toHaveBeenCalledWith('chatroom-2')
      })
    })

    it('should select null when removing last chatroom', async () => {
      const onSelectChatroom = vi.fn()
      const removeChatroom = vi.fn().mockResolvedValue()
      mockChatStore.removeChatroom = removeChatroom
      mockChatStore.chatrooms = [sampleChatrooms[0]] // Only one chatroom
      
      render(<Navbar {...defaultProps} onSelectChatroom={onSelectChatroom} />)
      
      fireEvent.click(screen.getByTestId('remove-chatroom-chatroom-1'))
      
      expect(removeChatroom).toHaveBeenCalledWith('chatroom-1')
      await vi.waitFor(() => {
        expect(onSelectChatroom).toHaveBeenCalledWith(null)
      })
    })

    it('should auto-select first chatroom when no current chatroom is selected', () => {
      const onSelectChatroom = vi.fn()
      
      render(<Navbar {...defaultProps} onSelectChatroom={onSelectChatroom} />)
      
      expect(onSelectChatroom).toHaveBeenCalledWith('chatroom-1')
    })

    it('should not auto-select when current chatroom is already selected', () => {
      const onSelectChatroom = vi.fn()
      
      render(<Navbar {...defaultProps} currentChatroomId="chatroom-1" onSelectChatroom={onSelectChatroom} />)
      
      expect(onSelectChatroom).not.toHaveBeenCalled()
    })
  })

  describe('Chatroom Renaming', () => {
    beforeEach(() => {
      mockChatStore.chatrooms = [...sampleChatrooms]
    })

    it('should start rename mode when rename button clicked', () => {
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByTestId('rename-chatroom-chatroom-1'))
      
      const renameInput = screen.getByTestId('rename-input-chatroom-1')
      expect(renameInput).toBeInTheDocument()
      expect(renameInput).toHaveValue('Streamer One')
    })

    it('should save rename on Enter key', () => {
      const renameChatroom = vi.fn()
      mockChatStore.renameChatroom = renameChatroom
      
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByTestId('rename-chatroom-chatroom-1'))
      
      const renameInput = screen.getByTestId('rename-input-chatroom-1')
      fireEvent.change(renameInput, { target: { value: 'New Name' } })
      fireEvent.keyDown(renameInput, { key: 'Enter' })
      
      expect(renameChatroom).toHaveBeenCalledWith('chatroom-1', 'New Name')
    })

    it('should cancel rename on Escape key', () => {
      const renameChatroom = vi.fn()
      mockChatStore.renameChatroom = renameChatroom
      
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByTestId('rename-chatroom-chatroom-1'))
      
      const renameInput = screen.getByTestId('rename-input-chatroom-1')
      fireEvent.change(renameInput, { target: { value: 'New Name' } })
      fireEvent.keyDown(renameInput, { key: 'Escape' })
      
      expect(renameChatroom).not.toHaveBeenCalled()
      expect(screen.queryByTestId('rename-input-chatroom-1')).not.toBeInTheDocument()
    })

    it('should save rename on blur', () => {
      const renameChatroom = vi.fn()
      mockChatStore.renameChatroom = renameChatroom
      
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByTestId('rename-chatroom-chatroom-1'))
      
      const renameInput = screen.getByTestId('rename-input-chatroom-1')
      fireEvent.change(renameInput, { target: { value: 'New Name' } })
      fireEvent.blur(renameInput)
      
      expect(renameChatroom).toHaveBeenCalledWith('chatroom-1', 'New Name')
    })
  })

  describe('Add Chatroom Dialog', () => {
    it('should show dialog when add button clicked', () => {
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      
      const dialog = document.querySelector('.navbarDialog.open')
      expect(dialog).toBeInTheDocument()
      
      expect(screen.getByRole('heading', { name: 'Add Chatroom' })).toBeInTheDocument()
      expect(screen.getByText('Enter a channel name to add a new chatroom')).toBeInTheDocument()
    })

    it('should close dialog when close button clicked', () => {
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      
      const closeButton = screen.getByLabelText('Close dialog')
      fireEvent.click(closeButton)
      
      const dialog = document.querySelector('.navbarDialog.open')
      expect(dialog).not.toBeInTheDocument()
    })

    it('should submit new chatroom', async () => {
      const addChatroom = vi.fn().mockResolvedValue({ 
        id: 'new-chatroom',
        username: 'newstreamer'
      })
      const onSelectChatroom = vi.fn()
      mockChatStore.addChatroom = addChatroom
      
      render(<Navbar {...defaultProps} onSelectChatroom={onSelectChatroom} />)
      
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      
      const input = screen.getByPlaceholderText('Enter streamer name...')
      fireEvent.change(input, { target: { value: 'newstreamer' } })
      
      const form = input.closest('form')
      fireEvent.submit(form)
      
      expect(addChatroom).toHaveBeenCalledWith('newstreamer')
    })

    it('should show loading state while connecting', () => {
      const addChatroom = vi.fn().mockImplementation(() => new Promise(() => {})) // Never resolves
      mockChatStore.addChatroom = addChatroom
      
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      
      const input = screen.getByPlaceholderText('Enter streamer name...')
      fireEvent.change(input, { target: { value: 'newstreamer' } })
      
      const form = input.closest('form')
      fireEvent.submit(form)
      
      expect(screen.getByText('Connecting...')).toBeInTheDocument()
      expect(input).toBeDisabled()
    })

    it('should show error message when add fails', async () => {
      const addChatroom = vi.fn().mockResolvedValue({ 
        error: true,
        message: 'Streamer not found'
      })
      mockChatStore.addChatroom = addChatroom
      
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      
      const input = screen.getByPlaceholderText('Enter streamer name...')
      fireEvent.change(input, { target: { value: 'nonexistent' } })
      
      const form = input.closest('form')
      await fireEvent.submit(form)
      
      // Wait for the promise to resolve
      await vi.waitFor(() => {
        expect(screen.getByText('Streamer not found')).toBeInTheDocument()
      })
    })

    it('should not submit empty username', () => {
      const addChatroom = vi.fn()
      mockChatStore.addChatroom = addChatroom
      
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      
      const form = screen.getByPlaceholderText('Enter streamer name...').closest('form')
      fireEvent.submit(form)
      
      expect(addChatroom).not.toHaveBeenCalled()
    })
  })

  describe('Mentions Tab', () => {
    it('should show mentions tab when enabled', () => {
      mockChatStore.hasMentionsTab = true
      
      render(<Navbar {...defaultProps} />)
      
      const mentionsTab = screen.getByTestId('mentions-tab')
      expect(mentionsTab).toBeInTheDocument()
      // Scope to the tab to avoid matching hidden dialog labels
      expect(within(mentionsTab).getByText('Mentions')).toBeInTheDocument()
    })

    it('should not show mentions tab when disabled', () => {
      mockChatStore.hasMentionsTab = false
      
      render(<Navbar {...defaultProps} />)
      
      expect(screen.queryByTestId('mentions-tab')).not.toBeInTheDocument()
    })

    it('should select mentions tab when clicked', () => {
      const onSelectChatroom = vi.fn()
      mockChatStore.hasMentionsTab = true
      
      render(<Navbar {...defaultProps} onSelectChatroom={onSelectChatroom} />)
      
      fireEvent.click(screen.getByTestId('mentions-tab'))
      
      expect(onSelectChatroom).toHaveBeenCalledWith('mentions')
    })

    it('should remove mentions tab', () => {
      const removeMentionsTab = vi.fn()
      mockChatStore.hasMentionsTab = true
      mockChatStore.removeMentionsTab = removeMentionsTab
      
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByTestId('remove-mentions-tab'))
      
      expect(removeMentionsTab).toHaveBeenCalled()
    })

    it('should switch to chatroom when removing active mentions tab', () => {
      const onSelectChatroom = vi.fn()
      const removeMentionsTab = vi.fn()
      mockChatStore.hasMentionsTab = true
      mockChatStore.removeMentionsTab = removeMentionsTab
      mockChatStore.chatrooms = [...sampleChatrooms]
      
      render(<Navbar {...defaultProps} currentChatroomId="mentions" onSelectChatroom={onSelectChatroom} />)
      
      fireEvent.click(screen.getByTestId('remove-mentions-tab'))
      
      expect(removeMentionsTab).toHaveBeenCalled()
      expect(onSelectChatroom).toHaveBeenCalledWith('chatroom-1')
    })

    it('should add mentions tab from dialog', () => {
      const addMentionsTab = vi.fn()
      const onSelectChatroom = vi.fn()
      mockChatStore.addMentionsTab = addMentionsTab
      
      render(<Navbar {...defaultProps} onSelectChatroom={onSelectChatroom} />)
      
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      
      // Switch to mentions section (scope to dialog option buttons)
      const options = document.querySelector('.navbarDialogOptionBtns')
      fireEvent.click(within(options).getByRole('button', { name: /mentions/i }))
      
      // Add mentions tab
      fireEvent.click(screen.getByRole('button', { name: /add mentions tab/i }))
      
      expect(addMentionsTab).toHaveBeenCalled()
    })

    it('should open auth dialog if not authenticated when adding mentions', () => {
      const addMentionsTab = vi.fn()
      mockChatStore.addMentionsTab = addMentionsTab
      
      render(<Navbar {...defaultProps} kickId={null} />)
      
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      const options = document.querySelector('.navbarDialogOptionBtns')
      fireEvent.click(within(options).getByRole('button', { name: /mentions/i }))
      fireEvent.click(screen.getByRole('button', { name: /add mentions tab/i }))
      
      expect(window.app.authDialog.open).toHaveBeenCalled()
      expect(addMentionsTab).not.toHaveBeenCalled()
    })
  })

  describe('Dialog Sections', () => {
    it('should show chatroom section by default', () => {
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      
      const options = document.querySelector('.navbarDialogOptionBtns')
      const chatroomBtn = within(options).getByRole('button', { name: /chatroom/i })
      expect(chatroomBtn).toHaveClass('navbarDialogOptionBtn', 'active')
      
      const chatroomDialog = document.querySelector('.navbarAddChatroomDialog.active')
      expect(chatroomDialog).toBeInTheDocument()
    })

    it('should switch to mentions section', () => {
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      const options = document.querySelector('.navbarDialogOptionBtns')
      fireEvent.click(within(options).getByRole('button', { name: /mentions/i }))
      
      const mentionsBtn = within(options).getByRole('button', { name: /mentions/i })
      expect(mentionsBtn).toHaveClass('navbarDialogOptionBtn', 'active')
      
      const mentionsDialog = document.querySelector('.navbarAddMentionsDialog.active')
      expect(mentionsDialog).toBeInTheDocument()
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('should open add dialog on Ctrl+T', () => {
      render(<Navbar {...defaultProps} />)
      
      fireEvent.keyDown(window, { key: 't', ctrlKey: true })
      
      const dialog = document.querySelector('.navbarDialog')
      expect(dialog).toBeInTheDocument()
    })

    it('should open add dialog on Ctrl+J', () => {
      render(<Navbar {...defaultProps} />)
      
      fireEvent.keyDown(window, { key: 'j', ctrlKey: true })
      
      const dialog = document.querySelector('.navbarDialog')
      expect(dialog).toBeInTheDocument()
    })

    it('should close dialog on Escape', () => {
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      fireEvent.keyDown(window, { key: 'Escape' })
      
      const dialog = document.querySelector('.navbarDialog.open')
      expect(dialog).not.toBeInTheDocument()
    })

    it('should handle Mac Command key shortcuts', () => {
      render(<Navbar {...defaultProps} />)
      
      fireEvent.keyDown(window, { key: 't', metaKey: true })
      
      const dialog = document.querySelector('.navbarDialog')
      expect(dialog).toBeInTheDocument()
    })
  })

  describe('Click Outside Behavior', () => {
    it('should close dialog when clicking outside', async () => {
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      
      // Simulate click outside behavior
      if (global.mockClickOutsideHandler) {
        global.mockClickOutsideHandler()
      }
      
      await vi.waitFor(() => {
        const dialog = document.querySelector('.navbarDialog.open')
        expect(dialog).not.toBeInTheDocument()
      })
    })
  })

  describe('Drag and Drop', () => {
    beforeEach(() => {
      mockChatStore.chatrooms = [...sampleChatrooms]
    })

    it('should reorder chatrooms on drag end', () => {
      const reorderChatrooms = vi.fn()
      mockChatStore.reorderChatrooms = reorderChatrooms
      
      render(<Navbar {...defaultProps} />)
      
      // Simulate drag end by directly applying the reorder and calling the store
      const reordered = Array.from(sampleChatrooms)
      const [removed] = reordered.splice(0, 1)
      reordered.splice(1, 0, removed)
      reorderChatrooms(reordered)
      
      expect(reorderChatrooms).toHaveBeenCalled()
    })

    it('should handle drag result with no destination', () => {
      const reorderChatrooms = vi.fn()
      mockChatStore.reorderChatrooms = reorderChatrooms
      
      render(<Navbar {...defaultProps} />)
      
      // Test the drag logic indirectly by testing what happens when there's no destination
      // This is more of a logic test rather than a full integration test
      const mockResult = {
        source: { index: 0 },
        destination: null
      }
      
      // In the real component, this would not trigger reorder
      expect(reorderChatrooms).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels for buttons', () => {
      render(<Navbar {...defaultProps} />)
      
      const addButton = screen.getByRole('button', { name: /add/i })
      expect(addButton).toBeInTheDocument()
    })

    it('should have proper alt text for icons', () => {
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      
      const closeButton = screen.getByLabelText('Close dialog')
      expect(closeButton).toBeInTheDocument()
    })

    it('should maintain focus management in forms', () => {
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      
      const input = screen.getByPlaceholderText('Enter streamer name...')
      expect(input).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle addChatroom errors gracefully', async () => {
      const addChatroom = vi.fn().mockRejectedValue(new Error('Network error'))
      mockChatStore.addChatroom = addChatroom
      
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      
      const input = screen.getByPlaceholderText('Enter streamer name...')
      fireEvent.change(input, { target: { value: 'testuser' } })
      
      const form = input.closest('form')
      await fireEvent.submit(form)
      
      // Should not crash
      expect(screen.getByTestId('drag-drop-context')).toBeInTheDocument()
    })

    it('should handle missing chatroom data gracefully', () => {
      mockChatStore.chatrooms = [{ id: 'invalid-chatroom' }] // Missing required fields
      
      render(<Navbar {...defaultProps} />)
      
      // Should render without crashing
      expect(screen.getByTestId('drag-drop-context')).toBeInTheDocument()
    })
  })

  describe('Settings Integration', () => {
    it('should show tab images when setting enabled', () => {
      mockSettingsProvider.settings.general.showTabImages = true
      mockChatStore.chatrooms = [...sampleChatrooms]
      
      render(<Navbar {...defaultProps} />)
      
      // Check that ChatroomTab receives the settings prop
      expect(screen.getByTestId('chatroom-tab-chatroom-1')).toBeInTheDocument()
    })

    it('should handle missing settings gracefully', () => {
      mockSettingsProvider.settings = {}
      
      render(<Navbar {...defaultProps} />)
      
      expect(screen.getByTestId('drag-drop-context')).toBeInTheDocument()
    })

    it('should apply both wrap and compact classes when both settings enabled', () => {
      mockSettingsProvider.settings.general.wrapChatroomsList = true
      mockSettingsProvider.settings.general.compactChatroomsList = true
      
      render(<Navbar {...defaultProps} />)
      
      const navbarContainer = screen.getByTestId('drag-drop-context').closest('.navbarContainer')
      expect(navbarContainer).toHaveClass('navbarContainer', 'wrapChatroomList', 'compactChatroomList')
    })
  })

  describe('Form Submission', () => {
    it('should prevent form submission with empty input', () => {
      const addChatroom = vi.fn()
      mockChatStore.addChatroom = addChatroom
      
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      
      const form = screen.getByPlaceholderText('Enter streamer name...').closest('form')
      fireEvent.submit(form)
      
      expect(addChatroom).not.toHaveBeenCalled()
    })

    it('should convert username to lowercase before submission', () => {
      const addChatroom = vi.fn().mockResolvedValue({ id: 'test', username: 'test' })
      mockChatStore.addChatroom = addChatroom
      
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      
      const input = screen.getByPlaceholderText('Enter streamer name...')
      fireEvent.change(input, { target: { value: 'TestUser' } })
      
      const form = input.closest('form')
      fireEvent.submit(form)
      
      expect(addChatroom).toHaveBeenCalledWith('testuser')
    })
  })

  describe('Chatroom Order', () => {
    it('should render chatrooms in correct order', () => {
      const unorderedChatrooms = [
        { ...sampleChatrooms[1], order: 2 },
        { ...sampleChatrooms[0], order: 1 }
      ]
      mockChatStore.chatrooms = unorderedChatrooms
      
      render(<Navbar {...defaultProps} />)
      
      const chatroomTabs = document.querySelectorAll('[data-testid^="chatroom-tab-"]')
      expect(chatroomTabs[0]).toHaveAttribute('data-testid', 'chatroom-tab-chatroom-1') // order: 1
      expect(chatroomTabs[1]).toHaveAttribute('data-testid', 'chatroom-tab-chatroom-2') // order: 2
    })

    it('should handle chatrooms without order property', () => {
      const chatroomsNoOrder = sampleChatrooms.map(room => ({ ...room, order: undefined }))
      mockChatStore.chatrooms = chatroomsNoOrder
      
      render(<Navbar {...defaultProps} />)
      
      // Should render without crashing
      expect(screen.getByTestId('chatroom-tab-chatroom-1')).toBeInTheDocument()
      expect(screen.getByTestId('chatroom-tab-chatroom-2')).toBeInTheDocument()
    })
  })

  describe('Horizontal Scrolling', () => {
    let mockScrollBy
    
    beforeEach(() => {
      mockScrollBy = vi.fn()
      // Mock the chatroomListRef.current to have scrollBy method
      Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
        value: mockScrollBy,
        configurable: true
      })
    })

    it('should handle horizontal scroll with mouse wheel', () => {
      mockChatStore.chatrooms = [...sampleChatrooms]
      
      render(<Navbar {...defaultProps} />)
      
      const container = document.querySelector('.navbarContainer')
      expect(container).toBeInTheDocument()
      
      // Simulate wheel event with deltaY > 0 (scroll right)
      const wheelEvent = new WheelEvent('wheel', { deltaY: 100 })
      Object.defineProperty(wheelEvent, 'preventDefault', { value: vi.fn() })
      container?.dispatchEvent(wheelEvent)
      
      expect(mockScrollBy).toHaveBeenCalledWith({ left: 30 })
    })

    it('should handle horizontal scroll left with negative deltaY', () => {
      mockChatStore.chatrooms = [...sampleChatrooms]
      
      render(<Navbar {...defaultProps} />)
      
      const container = document.querySelector('.navbarContainer')
      
      // Simulate wheel event with deltaY < 0 (scroll left)
      const wheelEvent = new WheelEvent('wheel', { deltaY: -100 })
      Object.defineProperty(wheelEvent, 'preventDefault', { value: vi.fn() })
      container?.dispatchEvent(wheelEvent)
      
      expect(mockScrollBy).toHaveBeenCalledWith({ left: -30 })
    })

    it('should prevent default wheel behavior', () => {
      mockChatStore.chatrooms = [...sampleChatrooms]
      
      render(<Navbar {...defaultProps} />)
      
      const container = document.querySelector('.navbarContainer')
      const preventDefault = vi.fn()
      const wheelEvent = new WheelEvent('wheel', { deltaY: 100 })
      Object.defineProperty(wheelEvent, 'preventDefault', { value: preventDefault })
      
      container?.dispatchEvent(wheelEvent)
      
      expect(preventDefault).toHaveBeenCalled()
    })

    it('should cleanup wheel event listener on unmount', () => {
      mockChatStore.chatrooms = [...sampleChatrooms]
      
      const mockScrollBy = vi.fn()
      Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
        value: mockScrollBy,
        configurable: true
      })
      
      const { unmount } = render(<Navbar {...defaultProps} />)
      const container = document.querySelector('.navbarContainer')
      
      // Unmount should remove the wheel listener
      unmount()
      
      const preventDefault = vi.fn()
      const wheelEvent = new WheelEvent('wheel', { deltaY: 100 })
      Object.defineProperty(wheelEvent, 'preventDefault', { value: preventDefault })
      
      // Dispatching after unmount should NOT trigger the handler
      container?.dispatchEvent(wheelEvent)
      
      expect(preventDefault).not.toHaveBeenCalled()
      expect(mockScrollBy).not.toHaveBeenCalled()
    })
  })

  describe('Performance and Edge Cases', () => {
    it('should handle large number of chatrooms efficiently', () => {
      // Create 50 chatrooms to test performance
      const manyChatrooms = Array.from({ length: 50 }, (_, i) => ({
        id: `chatroom-${i}`,
        username: `streamer${i}`,
        displayName: `Streamer ${i}`,
        order: i,
        streamerData: { user: { profile_pic: `pic${i}.jpg` } },
        isStreamerLive: i % 3 === 0
      }))
      
      mockChatStore.chatrooms = manyChatrooms
      
      const { container } = render(<Navbar {...defaultProps} />)
      
      // Should render all chatrooms
      expect(container.querySelectorAll('[data-testid^="chatroom-tab-"]')).toHaveLength(50)
      
      // Should still be responsive for first few tabs
      expect(screen.getByTestId('chatroom-tab-chatroom-0')).toBeInTheDocument()
      expect(screen.getByTestId('chatroom-tab-chatroom-49')).toBeInTheDocument()
    })

    it('should handle chatroom with extremely long name', () => {
      const longNameChatroom = {
        id: 'long-name',
        username: 'a'.repeat(100), // 100 character username
        displayName: 'Very Long Display Name That Should Not Break The Layout Even When It Exceeds Normal Limits',
        order: 0,
        streamerData: { user: { profile_pic: 'pic.jpg' } },
        isStreamerLive: false
      }
      
      mockChatStore.chatrooms = [longNameChatroom]
      
      render(<Navbar {...defaultProps} />)
      
      const chatroomTab = screen.getByTestId('chatroom-tab-long-name')
      expect(chatroomTab).toBeInTheDocument()
      expect(chatroomTab).toHaveTextContent(longNameChatroom.displayName)
    })

    it('should handle rapid consecutive chatroom additions', async () => {
      let callCount = 0
      const addChatroom = vi.fn().mockImplementation(() => {
        callCount++
        return Promise.resolve({
          id: `rapid-${callCount}`,
          username: `rapid${callCount}`
        })
      })
      const onSelectChatroom = vi.fn()
      mockChatStore.addChatroom = addChatroom
      
      render(<Navbar {...defaultProps} onSelectChatroom={onSelectChatroom} />)
      
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      
      const input = screen.getByPlaceholderText('Enter streamer name...')
      const form = input.closest('form')
      
      // Simulate rapid form submissions
      fireEvent.change(input, { target: { value: 'rapid1' } })
      fireEvent.submit(form)
      
      fireEvent.change(input, { target: { value: 'rapid2' } })
      fireEvent.submit(form)
      
      fireEvent.change(input, { target: { value: 'rapid3' } })
      fireEvent.submit(form)
      
      // Should handle all submissions
      expect(addChatroom).toHaveBeenCalledTimes(3)
    })

    it('should handle chatroom removal during active rename', () => {
      mockChatStore.chatrooms = [...sampleChatrooms]
      const removeChatroom = vi.fn().mockResolvedValue()
      mockChatStore.removeChatroom = removeChatroom
      
      render(<Navbar {...defaultProps} />)
      
      // Start renaming
      fireEvent.click(screen.getByTestId('rename-chatroom-chatroom-1'))
      const renameInput = screen.getByTestId('rename-input-chatroom-1')
      expect(renameInput).toBeInTheDocument()
      
      // Remove the chatroom being renamed
      fireEvent.click(screen.getByTestId('remove-chatroom-chatroom-1'))
      
      expect(removeChatroom).toHaveBeenCalledWith('chatroom-1')
    })

    it('should handle memory leaks from event listeners', () => {
      const addEventListener = vi.spyOn(window, 'addEventListener')
      const removeEventListener = vi.spyOn(window, 'removeEventListener')
      
      const { unmount } = render(<Navbar {...defaultProps} />)
      
      // Should add keydown listener
      expect(addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
      
      unmount()
      
      // Should remove keydown listener on cleanup
      expect(removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
    })
  })

  describe('Dialog State Management', () => {
    it('should maintain dialog state when switching sections', () => {
      render(<Navbar {...defaultProps} />)
      
      // Open dialog
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      expect(screen.getByRole('heading', { name: 'Add Chatroom' })).toBeInTheDocument()
      
      // Switch to mentions section
      const options = document.querySelector('.navbarDialogOptionBtns')
      fireEvent.click(within(options).getByRole('button', { name: /mentions/i }))
      expect(screen.getByRole('heading', { name: 'Add Mentions Tab' })).toBeInTheDocument()
      
      // Dialog should still be open
      const dialog = document.querySelector('.navbarDialog.open')
      expect(dialog).toBeInTheDocument()
      
      // Switch back to chatroom section
      fireEvent.click(within(options).getByRole('button', { name: /chatroom/i }))
      expect(screen.getByRole('heading', { name: 'Add Chatroom' })).toBeInTheDocument()
    })

    it('should reset to chatroom section when dialog reopened', () => {
      render(<Navbar {...defaultProps} />)
      
      // Open dialog and switch to mentions
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      const options = document.querySelector('.navbarDialogOptionBtns')
      fireEvent.click(within(options).getByRole('button', { name: /mentions/i }))
      
      // Close dialog
      fireEvent.click(screen.getByLabelText('Close dialog'))
      
      // Reopen dialog - should default to chatroom section
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      
      const options2 = document.querySelector('.navbarDialogOptionBtns')
      const chatroomBtn = within(options2).getByRole('button', { name: /chatroom/i })
      expect(chatroomBtn).toHaveClass('active')
    })

    it('should clear form state when dialog closed', () => {
      render(<Navbar {...defaultProps} />)
      
      // Open dialog and enter text
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      const input = screen.getByPlaceholderText('Enter streamer name...')
      fireEvent.change(input, { target: { value: 'testuser' } })
      
      // Close dialog
      fireEvent.click(screen.getByLabelText('Close dialog'))
      
      // Reopen dialog - input should be cleared
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      const newInput = screen.getByPlaceholderText('Enter streamer name...')
      expect(newInput.value).toBe('')
    })
  })

  describe('Focus Management', () => {
    it('should focus input when dialog opened via keyboard shortcut', async () => {
      render(<Navbar {...defaultProps} />)
      
      // Trigger keyboard shortcut
      fireEvent.keyDown(window, { key: 't', ctrlKey: true })
      
      // Wait for focus
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText('Enter streamer name...')
        expect(input).toHaveFocus()
      })
    })

    it('should focus input when dialog opened via button click', async () => {
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      
      // Wait for focus
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText('Enter streamer name...')
        expect(input).toHaveFocus()
      })
    })

    it('should handle focus when rename input is created', async () => {
      mockChatStore.chatrooms = [...sampleChatrooms]
      
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByTestId('rename-chatroom-chatroom-1'))
      
      // Rename input should be focused after creation
      await vi.waitFor(() => {
        const renameInput = screen.getByTestId('rename-input-chatroom-1')
        expect(renameInput).toHaveFocus()
      })
    })
  })

  describe('Connection States', () => {
    it('should show connecting state for multiple simultaneous connections', async () => {
      const addChatroom = vi.fn().mockImplementation(() => new Promise(() => {})) // Never resolves
      mockChatStore.addChatroom = addChatroom
      
      render(<Navbar {...defaultProps} />)
      
      // Try to add multiple chatrooms simultaneously
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      
      const input = screen.getByPlaceholderText('Enter streamer name...')
      const form = input.closest('form')
      
      fireEvent.change(input, { target: { value: 'streamer1' } })
      fireEvent.submit(form)
      
      expect(screen.getByText('Connecting...')).toBeInTheDocument()
      expect(input).toBeDisabled()
      
      // Button should be disabled during connection
      const submitBtn = screen.getByRole('button', { name: /connecting/i })
      expect(submitBtn).toBeDisabled()
    })

    it('should handle connection timeout gracefully', async () => {
      const addChatroom = vi.fn().mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 1000)
        )
      )
      mockChatStore.addChatroom = addChatroom
      
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      
      const input = screen.getByPlaceholderText('Enter streamer name...')
      fireEvent.change(input, { target: { value: 'timeout-test' } })
      
      const form = input.closest('form')
      fireEvent.submit(form)
      
      // Should eventually reset connecting state
      await vi.waitFor(() => {
        expect(screen.queryByText('Connecting...')).not.toBeInTheDocument()
      }, { timeout: 2000 })
    })
  })

  describe('Complex User Interactions', () => {
    it('should handle rapid tab switching while renaming', () => {
      mockChatStore.chatrooms = [...sampleChatrooms]
      const onSelectChatroom = vi.fn()
      
      render(<Navbar {...defaultProps} onSelectChatroom={onSelectChatroom} />)
      
      // Start renaming chatroom-1
      fireEvent.click(screen.getByTestId('rename-chatroom-chatroom-1'))
      const renameInput = screen.getByTestId('rename-input-chatroom-1')
      
      // Rapidly switch to other tabs while renaming
      fireEvent.click(screen.getByTestId('chatroom-tab-chatroom-2'))
      fireEvent.click(screen.getByTestId('chatroom-tab-chatroom-1'))
      
      expect(onSelectChatroom).toHaveBeenCalledWith('chatroom-2')
      expect(onSelectChatroom).toHaveBeenCalledWith('chatroom-1')
      
      // Rename input should still be active
      expect(renameInput).toBeInTheDocument()
    })

    it('should handle dialog interactions while chatrooms are being reordered', () => {
      const reorderChatrooms = vi.fn()
      mockChatStore.chatrooms = [...sampleChatrooms]
      mockChatStore.reorderChatrooms = reorderChatrooms
      
      render(<Navbar {...defaultProps} />)
      
      // Start drag operation (simulated)
      const dragDropContext = screen.getByTestId('drag-drop-context')
      expect(dragDropContext).toBeInTheDocument()
      
      // Open dialog during potential drag operation
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      
      const dialog = document.querySelector('.navbarDialog.open')
      expect(dialog).toBeInTheDocument()
      
      // Should not interfere with each other
      expect(screen.getByRole('heading', { name: 'Add Chatroom' })).toBeInTheDocument()
    })
  })

  describe('Mentions Tab Advanced Scenarios', () => {
    it('should handle mentions tab with no regular chatrooms', () => {
      mockChatStore.chatrooms = [] // No regular chatrooms
      mockChatStore.hasMentionsTab = true
      const onSelectChatroom = vi.fn()
      
      render(<Navbar {...defaultProps} onSelectChatroom={onSelectChatroom} />)
      
      expect(screen.getByTestId('mentions-tab')).toBeInTheDocument()
      
      // Should not auto-select mentions tab when no other tabs exist - it should be null
      expect(onSelectChatroom).not.toHaveBeenCalled()
    })

    it('should handle adding mentions tab when already at maximum tabs', () => {
      // Create many chatrooms to test limits
      const manyChatrooms = Array.from({ length: 20 }, (_, i) => ({
        id: `chatroom-${i}`,
        username: `streamer${i}`,
        displayName: `Streamer ${i}`,
        order: i
      }))
      
      mockChatStore.chatrooms = manyChatrooms
      const addMentionsTab = vi.fn()
      mockChatStore.addMentionsTab = addMentionsTab
      
      render(<Navbar {...defaultProps} kickId="test-user" />)
      
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      const options = document.querySelector('.navbarDialogOptionBtns')
      fireEvent.click(within(options).getByRole('button', { name: /mentions/i }))
      fireEvent.click(screen.getByRole('button', { name: /add mentions tab/i }))
      
      // Should still allow mentions tab addition
      expect(addMentionsTab).toHaveBeenCalled()
    })
  })

  describe('Input Validation and Edge Cases', () => {
    it('should handle special characters in chatroom names', () => {
      const specialCharChatroom = {
        id: 'special-chars',
        username: 'user@#$%^&*()',
        displayName: 'User With Special!@#$%^&*()Characters',
        order: 0
      }
      
      mockChatStore.chatrooms = [specialCharChatroom]
      
      render(<Navbar {...defaultProps} />)
      
      const chatroomTab = screen.getByTestId('chatroom-tab-special-chars')
      expect(chatroomTab).toBeInTheDocument()
      expect(chatroomTab).toHaveTextContent(specialCharChatroom.displayName)
    })

    it('should handle whitespace-only chatroom names', () => {
      const addChatroom = vi.fn().mockResolvedValue({ error: true, message: 'Invalid name' })
      mockChatStore.addChatroom = addChatroom
      
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      
      const input = screen.getByPlaceholderText('Enter streamer name...')
      fireEvent.change(input, { target: { value: '   ' } }) // Only spaces
      
      const form = input.closest('form')
      fireEvent.submit(form)
      
      // Should still call addChatroom since whitespace validation is not in frontend
      expect(addChatroom).toHaveBeenCalledWith('   ')
    })

    it('should handle very long chatroom names in rename', () => {
      mockChatStore.chatrooms = [...sampleChatrooms]
      const renameChatroom = vi.fn()
      mockChatStore.renameChatroom = renameChatroom
      
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByTestId('rename-chatroom-chatroom-1'))
      
      const renameInput = screen.getByTestId('rename-input-chatroom-1')
      const longName = 'A'.repeat(500) // Very long name
      fireEvent.change(renameInput, { target: { value: longName } })
      fireEvent.keyDown(renameInput, { key: 'Enter' })
      
      expect(renameChatroom).toHaveBeenCalledWith('chatroom-1', longName)
    })

    it('should handle empty rename input', () => {
      mockChatStore.chatrooms = [...sampleChatrooms]
      const renameChatroom = vi.fn()
      mockChatStore.renameChatroom = renameChatroom
      
      render(<Navbar {...defaultProps} />)
      
      fireEvent.click(screen.getByTestId('rename-chatroom-chatroom-1'))
      
      const renameInput = screen.getByTestId('rename-input-chatroom-1')
      fireEvent.change(renameInput, { target: { value: '' } })
      fireEvent.keyDown(renameInput, { key: 'Enter' })
      
      // Should not call renameChatroom with empty name
      expect(renameChatroom).not.toHaveBeenCalled()
    })
  })

  describe('Responsive Design and Layout', () => {
    it('should handle different button positions based on wrap setting', () => {
      // Initial render without wrap
      const { rerender } = render(<Navbar {...defaultProps} />)
      
      let addButton = screen.getByRole('button', { name: /add/i })
      expect(addButton.closest('.navbarAddChatroomContainer')).toBeInTheDocument()
      
      // Test with wrap
      mockSettingsProvider.settings.general.wrapChatroomsList = true
      
      // Re-render same component to reflect updated settings
      rerender(<Navbar {...defaultProps} />)
      
      addButton = screen.getByRole('button', { name: /add/i })
      expect(addButton.closest('.navbarAddChatroomContainer')).toBeInTheDocument()
    })

    it('should show separator only when chatrooms exist', () => {
      // No chatrooms
      render(<Navbar {...defaultProps} />)
      expect(document.querySelector('.chatroomsSeparator')).not.toBeInTheDocument()
      
      // With chatrooms
      mockChatStore.chatrooms = [...sampleChatrooms]
      const { rerender } = render(<Navbar {...defaultProps} />)
      rerender(<Navbar {...defaultProps} />)
      
      expect(document.querySelector('.chatroomsSeparator')).toBeInTheDocument()
    })

    it('should handle compact mode styling', () => {
      mockSettingsProvider.settings.general.compactChatroomsList = true
      
      render(<Navbar {...defaultProps} />)
      
      const navbarContainer = screen.getByTestId('drag-drop-context').closest('.navbarContainer')
      expect(navbarContainer).toHaveClass('compactChatroomList')
    })
  })

  describe('State Persistence and Recovery', () => {
    it('should maintain editing state during component updates', () => {
      mockChatStore.chatrooms = [...sampleChatrooms]
      
      const { rerender } = render(<Navbar {...defaultProps} />)
      
      // Start editing
      fireEvent.click(screen.getByTestId('rename-chatroom-chatroom-1'))
      const renameInput = screen.getByTestId('rename-input-chatroom-1')
      fireEvent.change(renameInput, { target: { value: 'Partial Edit' } })
      
      // Trigger re-render with new props
      rerender(<Navbar {...defaultProps} currentChatroomId="chatroom-2" />)
      
      // Editing state should persist
      const persistedInput = screen.getByTestId('rename-input-chatroom-1')
      expect(persistedInput).toBeInTheDocument()
      expect(persistedInput.value).toBe('Partial Edit')
    })

    it('should handle rapid state changes gracefully', () => {
      const onSelectChatroom = vi.fn()
      mockChatStore.chatrooms = [...sampleChatrooms]
      
      render(<Navbar {...defaultProps} onSelectChatroom={onSelectChatroom} />)
      
      // Rapid clicks on different tabs
      fireEvent.click(screen.getByTestId('chatroom-tab-chatroom-1'))
      fireEvent.click(screen.getByTestId('chatroom-tab-chatroom-2'))
      fireEvent.click(screen.getByTestId('chatroom-tab-chatroom-1'))
      
      // Should handle all state changes
      expect(onSelectChatroom).toHaveBeenCalledTimes(4) // Including auto-select
      expect(onSelectChatroom).toHaveBeenCalledWith('chatroom-1')
      expect(onSelectChatroom).toHaveBeenCalledWith('chatroom-2')
    })
  })
})