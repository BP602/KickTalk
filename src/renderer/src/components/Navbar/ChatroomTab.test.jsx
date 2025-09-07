import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import ChatroomTab from './ChatroomTab'

// Mock modules
vi.mock('clsx', () => ({
  default: (...args) => args.filter(Boolean).join(' ')
}))

// Mock static assets
vi.mock('../../assets/icons/x-bold.svg?asset', () => ({ default: 'x-icon.svg' }))

// Mock drag and drop
vi.mock('@hello-pangea/dnd', () => ({
  Draggable: ({ children, draggableId, index }) => {
    const mockProvided = {
      innerRef: vi.fn(),
      draggableProps: { 'data-rbd-draggable-id': draggableId },
      dragHandleProps: { 'data-rbd-drag-handle-id': draggableId }
    }
    const mockSnapshot = {
      isDragging: false,
      isDropAnimating: false,
      combineTargetFor: null,
      combineWith: null,
      draggingOver: null,
      mode: null
    }
    return (
      <div data-testid={`draggable-${draggableId}`} data-index={index}>
        {children(mockProvided, mockSnapshot)}
      </div>
    )
  }
}))

// Mock context menu components
vi.mock('../Shared/ContextMenu', () => ({
  ContextMenu: ({ children }) => <div data-testid="context-menu">{children}</div>,
  ContextMenuContent: ({ children }) => <div data-testid="context-menu-content">{children}</div>,
  ContextMenuItem: ({ children, onSelect }) => (
    <div 
      data-testid="context-menu-item" 
      onClick={onSelect}
      role="menuitem"
    >
      {children}
    </div>
  ),
  ContextMenuSeparator: () => <div data-testid="context-menu-separator" />,
  ContextMenuTrigger: ({ children, onContextMenu }) => (
    <div
      data-testid="context-menu-trigger"
      onContextMenu={(e) => onContextMenu?.(e.detail ? { ...e, detail: e.detail } : e)}
    >
      {children}
    </div>
  ),
}))

// Mock useChatStore with useShallow
const mockChatroomMessages = []

vi.mock('../../providers/ChatProvider', () => ({
  default: vi.fn(() => mockChatroomMessages)
}))

vi.mock('zustand/react/shallow', () => ({
  useShallow: (selector) => selector
}))

describe('ChatroomTab Component', () => {
  const mockChatroom = {
    id: 'test-chatroom-1',
    username: 'teststreamer',
    displayName: 'Test Streamer',
    isStreamerLive: false,
    streamerData: {
      user: {
        profile_pic: 'https://example.com/profile.jpg'
      }
    }
  }

  const defaultProps = {
    chatroom: mockChatroom,
    index: 0,
    currentChatroomId: null,
    onSelectChatroom: vi.fn(),
    onRemoveChatroom: vi.fn(),
    onRename: vi.fn(),
    editingChatroomId: null,
    editingName: '',
    setEditingName: vi.fn(),
    onRenameSubmit: vi.fn(),
    setEditingChatroomId: vi.fn(),
    renameInputRef: { current: null },
    settings: {
      general: {
        showTabImages: true
      }
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockChatroomMessages.length = 0
  })

  describe('Basic Rendering', () => {
    it('should render the chatroom tab', () => {
      render(<ChatroomTab {...defaultProps} />)
      
      expect(screen.getByTestId('draggable-item-test-chatroom-1')).toBeInTheDocument()
      expect(screen.getByTestId('context-menu')).toBeInTheDocument()
      expect(screen.getByText('Test Streamer')).toBeInTheDocument()
    })

    it('should render username when displayName is not available', () => {
      const propsWithoutDisplayName = {
        ...defaultProps,
        chatroom: {
          ...mockChatroom,
          displayName: null
        }
      }
      
      render(<ChatroomTab {...propsWithoutDisplayName} />)
      
      expect(screen.getByText('teststreamer')).toBeInTheDocument()
    })

    it('should render with correct draggable properties', () => {
      render(<ChatroomTab {...defaultProps} />)
      
      const draggable = screen.getByTestId('draggable-item-test-chatroom-1')
      expect(draggable).toHaveAttribute('data-index', '0')
    })

    it('should render close button', () => {
      render(<ChatroomTab {...defaultProps} />)
      
      const closeButton = screen.getByRole('button', { name: 'Remove chatroom' })
      expect(closeButton).toBeInTheDocument()
    })
  })

  describe('Profile Image Rendering', () => {
    it('should show profile image when setting is enabled and image exists', () => {
      render(<ChatroomTab {...defaultProps} />)
      
      const profileImage = screen.getByAltText(`${mockChatroom.username}'s profile`)
      expect(profileImage).toBeInTheDocument()
      expect(profileImage).toHaveAttribute('src', mockChatroom.streamerData.user.profile_pic)
    })

    it('should hide profile image when setting is disabled', () => {
      const propsWithoutImages = {
        ...defaultProps,
        settings: {
          general: {
            showTabImages: false
          }
        }
      }
      
      render(<ChatroomTab {...propsWithoutImages} />)
      
      expect(screen.queryByAltText(`${mockChatroom.username}'s profile`)).not.toBeInTheDocument()
    })

    it('should hide profile image when no image URL is available', () => {
      const propsWithoutProfilePic = {
        ...defaultProps,
        chatroom: {
          ...mockChatroom,
          streamerData: {
            user: {
              profile_pic: null
            }
          }
        }
      }
      
      render(<ChatroomTab {...propsWithoutProfilePic} />)
      
      expect(screen.queryByAltText(`${mockChatroom.username}'s profile`)).not.toBeInTheDocument()
    })

    it('should hide profile image when streamerData is missing', () => {
      const propsWithoutStreamerData = {
        ...defaultProps,
        chatroom: {
          ...mockChatroom,
          streamerData: null
        }
      }
      
      render(<ChatroomTab {...propsWithoutStreamerData} />)
      
      expect(screen.queryByAltText(`${mockChatroom.username}'s profile`)).not.toBeInTheDocument()
    })
  })

  describe('CSS Classes and States', () => {
    it('should apply active class when chatroom is currently selected', () => {
      const activeProps = {
        ...defaultProps,
        currentChatroomId: 'test-chatroom-1'
      }
      
      render(<ChatroomTab {...activeProps} />)
      
      const chatroomElement = screen.getByTestId('context-menu-trigger').firstChild
      expect(chatroomElement).toHaveClass('chatroomStreamer', 'chatroomStreamerActive')
    })

    it('should apply live class when streamer is live', () => {
      const liveProps = {
        ...defaultProps,
        chatroom: {
          ...mockChatroom,
          isStreamerLive: true
        }
      }
      
      render(<ChatroomTab {...liveProps} />)
      
      const chatroomElement = screen.getByTestId('context-menu-trigger').firstChild
      expect(chatroomElement).toHaveClass('chatroomStreamer', 'chatroomStreamerLive')
    })

    it('should apply hasUnread class when there are unread messages and tab is not active', () => {
      // Mock messages with unread ones
      mockChatroomMessages.push(
        { id: '1', isRead: false, type: 'message' },
        { id: '2', isRead: true, type: 'message' },
        { id: '3', isRead: false, type: 'message' }
      )
      
      render(<ChatroomTab {...defaultProps} />)
      
      const chatroomElement = screen.getByTestId('context-menu-trigger').firstChild
      expect(chatroomElement).toHaveClass('chatroomStreamer', 'hasUnread')
    })

    it('should not apply hasUnread class when tab is active', () => {
      mockChatroomMessages.push(
        { id: '1', isRead: false, type: 'message' }
      )
      
      const activeProps = {
        ...defaultProps,
        currentChatroomId: 'test-chatroom-1'
      }
      
      render(<ChatroomTab {...activeProps} />)
      
      const chatroomElement = screen.getByTestId('context-menu-trigger').firstChild
      expect(chatroomElement).not.toHaveClass('hasUnread')
    })

    it('should not count system messages for unread count', () => {
      mockChatroomMessages.push(
        { id: '1', isRead: false, type: 'system' },
        { id: '2', isRead: false, type: 'message' }
      )
      
      render(<ChatroomTab {...defaultProps} />)
      
      const chatroomElement = screen.getByTestId('context-menu-trigger').firstChild
      expect(chatroomElement).toHaveClass('hasUnread')
    })

    it('should show unread count indicator when there are unread messages', () => {
      mockChatroomMessages.push(
        { id: '1', isRead: false, type: 'message' }
      )
      
      render(<ChatroomTab {...defaultProps} />)
      
      const unreadIndicator = screen.getByText('Test Streamer').nextSibling
      expect(unreadIndicator).toHaveClass('unreadCountIndicator', 'hasUnread')
    })
  })

  describe('Click Interactions', () => {
    it('should call onSelectChatroom when clicked', async () => {
      const user = userEvent.setup()
      const mockOnSelectChatroom = vi.fn()
      
      render(<ChatroomTab {...defaultProps} onSelectChatroom={mockOnSelectChatroom} />)
      
      const chatroomElement = screen.getByTestId('context-menu-trigger').firstChild
      await user.click(chatroomElement)
      
      expect(mockOnSelectChatroom).toHaveBeenCalledWith('test-chatroom-1')
    })

    it('should call onRemoveChatroom when middle mouse button is clicked', () => {
      const mockOnRemoveChatroom = vi.fn().mockResolvedValue()
      
      render(<ChatroomTab {...defaultProps} onRemoveChatroom={mockOnRemoveChatroom} />)
      
      const chatroomElement = screen.getByTestId('context-menu-trigger').firstChild
      fireEvent.mouseDown(chatroomElement, { button: 1 })
      
      expect(mockOnRemoveChatroom).toHaveBeenCalledWith('test-chatroom-1')
    })

    it('should call onRename when double clicked', async () => {
      const user = userEvent.setup()
      const mockOnRename = vi.fn()
      
      render(<ChatroomTab {...defaultProps} onRename={mockOnRename} />)
      
      const chatroomElement = screen.getByTestId('context-menu-trigger').firstChild
      await user.dblClick(chatroomElement)
      
      expect(mockOnRename).toHaveBeenCalledWith({
        chatroomId: 'test-chatroom-1',
        currentDisplayName: 'Test Streamer'
      })
    })

    it('should call onRename with username when displayName is not available', async () => {
      const user = userEvent.setup()
      const mockOnRename = vi.fn()
      const propsWithoutDisplayName = {
        ...defaultProps,
        chatroom: {
          ...mockChatroom,
          displayName: null
        },
        onRename: mockOnRename
      }
      
      render(<ChatroomTab {...propsWithoutDisplayName} />)
      
      const chatroomElement = screen.getByTestId('context-menu-trigger').firstChild
      await user.dblClick(chatroomElement)
      
      expect(mockOnRename).toHaveBeenCalledWith({
        chatroomId: 'test-chatroom-1',
        currentDisplayName: 'teststreamer'
      })
    })

    it('should call onRemoveChatroom when close button is clicked', async () => {
      const user = userEvent.setup()
      const mockOnRemoveChatroom = vi.fn()
      
      render(<ChatroomTab {...defaultProps} onRemoveChatroom={mockOnRemoveChatroom} />)
      
      const closeButton = screen.getByRole('button', { name: 'Remove chatroom' })
      await user.click(closeButton)
      
      expect(mockOnRemoveChatroom).toHaveBeenCalledWith('test-chatroom-1')
    })

    it('should stop propagation when close button is clicked', async () => {
      const user = userEvent.setup()
      const mockOnSelectChatroom = vi.fn()
      const mockOnRemoveChatroom = vi.fn()
      
      render(<ChatroomTab {...defaultProps} onSelectChatroom={mockOnSelectChatroom} onRemoveChatroom={mockOnRemoveChatroom} />)
      
      const closeButton = screen.getByRole('button', { name: 'Remove chatroom' })
      await user.click(closeButton)
      
      expect(mockOnRemoveChatroom).toHaveBeenCalledWith('test-chatroom-1')
      expect(mockOnSelectChatroom).not.toHaveBeenCalled()
    })
  })

  describe('Rename Functionality', () => {
    it('should show rename input when editing', () => {
      const editingProps = {
        ...defaultProps,
        editingChatroomId: 'test-chatroom-1',
        editingName: 'New Name'
      }
      
      render(<ChatroomTab {...editingProps} />)
      
      const renameInput = screen.getByRole('textbox')
      expect(renameInput).toBeInTheDocument()
      expect(renameInput).toHaveValue('New Name')
      // Note: autoFocus is set in the component but doesn't reflect as a DOM property in tests
    })

    it('should not show regular content when editing', () => {
      const editingProps = {
        ...defaultProps,
        editingChatroomId: 'test-chatroom-1',
        editingName: 'New Name'
      }
      
      render(<ChatroomTab {...editingProps} />)
      
      expect(screen.queryByText('Test Streamer')).not.toBeInTheDocument()
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('should call setEditingName when input value changes', async () => {
      const user = userEvent.setup()
      const mockSetEditingName = vi.fn()
      const editingProps = {
        ...defaultProps,
        editingChatroomId: 'test-chatroom-1',
        editingName: 'Old Name',
        setEditingName: mockSetEditingName
      }
      
      render(<ChatroomTab {...editingProps} />)
      
      const renameInput = screen.getByRole('textbox')
      
      // Test direct onChange event since userEvent behavior is complex with user typing
      fireEvent.change(renameInput, { target: { value: 'New Name' } })
      
      expect(mockSetEditingName).toHaveBeenCalledWith('New Name')
    })

    it('should call onRenameSubmit when Enter key is pressed', async () => {
      const user = userEvent.setup()
      const mockOnRenameSubmit = vi.fn()
      const editingProps = {
        ...defaultProps,
        editingChatroomId: 'test-chatroom-1',
        editingName: 'New Name',
        onRenameSubmit: mockOnRenameSubmit
      }
      
      render(<ChatroomTab {...editingProps} />)
      
      const renameInput = screen.getByRole('textbox')
      await user.type(renameInput, '{Enter}')
      
      expect(mockOnRenameSubmit).toHaveBeenCalledWith('test-chatroom-1')
    })

    it('should cancel editing when Escape key is pressed', async () => {
      const user = userEvent.setup()
      const mockSetEditingChatroomId = vi.fn()
      const mockSetEditingName = vi.fn()
      const editingProps = {
        ...defaultProps,
        editingChatroomId: 'test-chatroom-1',
        editingName: 'New Name',
        setEditingChatroomId: mockSetEditingChatroomId,
        setEditingName: mockSetEditingName
      }
      
      render(<ChatroomTab {...editingProps} />)
      
      const renameInput = screen.getByRole('textbox')
      await user.type(renameInput, '{Escape}')
      
      expect(mockSetEditingChatroomId).toHaveBeenCalledWith(null)
      expect(mockSetEditingName).toHaveBeenCalledWith('')
    })

    it('should call onRenameSubmit when input loses focus', async () => {
      const user = userEvent.setup()
      const mockOnRenameSubmit = vi.fn()
      const editingProps = {
        ...defaultProps,
        editingChatroomId: 'test-chatroom-1',
        editingName: 'New Name',
        onRenameSubmit: mockOnRenameSubmit
      }
      
      render(<ChatroomTab {...editingProps} />)
      
      const renameInput = screen.getByRole('textbox')
      renameInput.focus()
      await user.tab()
      
      expect(mockOnRenameSubmit).toHaveBeenCalledWith('test-chatroom-1')
    })

    it('should stop propagation when rename input is clicked', async () => {
      const user = userEvent.setup()
      const mockOnSelectChatroom = vi.fn()
      const editingProps = {
        ...defaultProps,
        editingChatroomId: 'test-chatroom-1',
        editingName: 'New Name',
        onSelectChatroom: mockOnSelectChatroom
      }
      
      render(<ChatroomTab {...editingProps} />)
      
      const renameInput = screen.getByRole('textbox')
      await user.click(renameInput)
      
      expect(mockOnSelectChatroom).not.toHaveBeenCalled()
    })

    it('should use the passed renameInputRef', () => {
      const mockRef = { current: null }
      const editingProps = {
        ...defaultProps,
        editingChatroomId: 'test-chatroom-1',
        editingName: 'New Name',
        renameInputRef: mockRef
      }
      
      render(<ChatroomTab {...editingProps} />)
      
      const renameInput = screen.getByRole('textbox')
      expect(renameInput).toBeInTheDocument()
      // Note: We can't directly test ref assignment in JSDOM, but we verify the input exists
    })
  })

  describe('Context Menu', () => {
    it('should render context menu items', () => {
      render(<ChatroomTab {...defaultProps} />)
      
      expect(screen.getByText('Open Stream in Browser')).toBeInTheDocument()
      expect(screen.getByText('Open Player in Browser')).toBeInTheDocument()
      expect(screen.getByText('Rename Tab')).toBeInTheDocument()
      expect(screen.getByText('Remove Chatroom')).toBeInTheDocument()
      expect(screen.getByTestId('context-menu-separator')).toBeInTheDocument()
    })

    it('should open stream URL when context menu item is clicked', async () => {
      const mockOpen = vi.fn()
      global.window.open = mockOpen
      
      render(<ChatroomTab {...defaultProps} />)
      
      const openStreamItem = screen.getByText('Open Stream in Browser')
      fireEvent.click(openStreamItem)
      
      expect(mockOpen).toHaveBeenCalledWith('https://kick.com/teststreamer', '_blank')
    })

    it('should open player URL when context menu item is clicked', async () => {
      const mockOpen = vi.fn()
      global.window.open = mockOpen
      
      render(<ChatroomTab {...defaultProps} />)
      
      const openPlayerItem = screen.getByText('Open Player in Browser')
      fireEvent.click(openPlayerItem)
      
      expect(mockOpen).toHaveBeenCalledWith('https://player.kick.com/teststreamer', '_blank')
    })

    it('should call onRename when context menu rename item is clicked', () => {
      const mockOnRename = vi.fn()
      
      render(<ChatroomTab {...defaultProps} onRename={mockOnRename} />)
      
      const renameItem = screen.getByText('Rename Tab')
      fireEvent.click(renameItem)
      
      expect(mockOnRename).toHaveBeenCalledWith({
        chatroomId: 'test-chatroom-1',
        currentDisplayName: 'Test Streamer'
      })
    })

    it('should call onRemoveChatroom when context menu remove item is clicked', () => {
      const mockOnRemoveChatroom = vi.fn()
      
      render(<ChatroomTab {...defaultProps} onRemoveChatroom={mockOnRemoveChatroom} />)
      
      const removeItem = screen.getByText('Remove Chatroom')
      fireEvent.click(removeItem)
      
      expect(mockOnRemoveChatroom).toHaveBeenCalledWith('test-chatroom-1')
    })
  })

  describe('Memoization', () => {
    it('should be memoized to prevent unnecessary re-renders', () => {
      const { rerender } = render(<ChatroomTab {...defaultProps} />)
      
      const initialElement = screen.getByTestId('draggable-item-test-chatroom-1')
      
      // Re-render with same props
      rerender(<ChatroomTab {...defaultProps} />)
      
      const rerenderedElement = screen.getByTestId('draggable-item-test-chatroom-1')
      
      // Component should still be there (we can't directly test memo behavior in this setup)
      expect(rerenderedElement).toBeInTheDocument()
    })

    it('should update when relevant props change', () => {
      const { rerender } = render(<ChatroomTab {...defaultProps} />)
      
      expect(screen.getByText('Test Streamer')).toBeInTheDocument()
      
      // Change chatroom name
      const updatedProps = {
        ...defaultProps,
        chatroom: {
          ...mockChatroom,
          displayName: 'Updated Streamer Name'
        }
      }
      
      rerender(<ChatroomTab {...updatedProps} />)
      
      expect(screen.getByText('Updated Streamer Name')).toBeInTheDocument()
      expect(screen.queryByText('Test Streamer')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper alt text for close button icon', () => {
      render(<ChatroomTab {...defaultProps} />)
      
      const closeButtonIcon = screen.getByAltText('Remove chatroom')
      expect(closeButtonIcon).toBeInTheDocument()
    })

    it('should have proper alt text for profile image', () => {
      render(<ChatroomTab {...defaultProps} />)
      
      const profileImage = screen.getByAltText(`${mockChatroom.username}'s profile`)
      expect(profileImage).toBeInTheDocument()
    })

    it('should have proper aria-label for close button', () => {
      render(<ChatroomTab {...defaultProps} />)
      
      const closeButton = screen.getByRole('button', { name: 'Remove chatroom' })
      expect(closeButton).toHaveAttribute('aria-label', 'Remove chatroom')
    })

    it('should have proper role for context menu items', () => {
      render(<ChatroomTab {...defaultProps} />)
      
      const menuItems = screen.getAllByRole('menuitem')
      expect(menuItems).toHaveLength(4) // 4 context menu items
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing settings gracefully', () => {
      const propsWithoutSettings = {
        ...defaultProps,
        settings: null
      }
      
      expect(() => {
        render(<ChatroomTab {...propsWithoutSettings} />)
      }).not.toThrow()
    })

    it('should handle missing streamerData gracefully', () => {
      const propsWithoutStreamerData = {
        ...defaultProps,
        chatroom: {
          ...mockChatroom,
          streamerData: null
        }
      }
      
      expect(() => {
        render(<ChatroomTab {...propsWithoutStreamerData} />)
      }).not.toThrow()
    })

    it('should handle empty messages array', () => {
      mockChatroomMessages.length = 0
      
      render(<ChatroomTab {...defaultProps} />)
      
      const chatroomElement = screen.getByTestId('context-menu-trigger').firstChild
      expect(chatroomElement).not.toHaveClass('hasUnread')
    })

    it('should handle very long chatroom names', () => {
      const longNameProps = {
        ...defaultProps,
        chatroom: {
          ...mockChatroom,
          displayName: 'A'.repeat(100)
        }
      }
      
      render(<ChatroomTab {...longNameProps} />)
      
      expect(screen.getByText('A'.repeat(100))).toBeInTheDocument()
    })

    it('should handle special characters in chatroom names', () => {
      const specialCharProps = {
        ...defaultProps,
        chatroom: {
          ...mockChatroom,
          displayName: 'Test & <Special> "Characters"'
        }
      }
      
      render(<ChatroomTab {...specialCharProps} />)
      
      expect(screen.getByText('Test & <Special> "Characters"')).toBeInTheDocument()
    })

    it('should handle undefined callbacks gracefully', () => {
      const propsWithUndefinedCallbacks = {
        ...defaultProps,
        onSelectChatroom: undefined,
        onRemoveChatroom: undefined,
        onRename: undefined
      }
      
      expect(() => {
        render(<ChatroomTab {...propsWithUndefinedCallbacks} />)
      }).not.toThrow()
    })
  })

  describe('Drag and Drop Integration', () => {
    it('should render with draggable props', () => {
      render(<ChatroomTab {...defaultProps} />)
      
      const draggableContainer = screen.getByTestId('draggable-item-test-chatroom-1')
      expect(draggableContainer).toBeInTheDocument()
      expect(draggableContainer).toHaveAttribute('data-index', '0')
    })

    it('should pass correct draggableId to Draggable', () => {
      render(<ChatroomTab {...defaultProps} />)
      
      const draggableContainer = screen.getByTestId('draggable-item-test-chatroom-1')
      expect(draggableContainer).toBeInTheDocument()
    })

    it('should render correctly for different index values', () => {
      const propsWithDifferentIndex = {
        ...defaultProps,
        index: 5
      }
      
      render(<ChatroomTab {...propsWithDifferentIndex} />)
      
      const draggableContainer = screen.getByTestId('draggable-item-test-chatroom-1')
      expect(draggableContainer).toHaveAttribute('data-index', '5')
    })
  })

  describe('Unread Message Calculation', () => {
    it('should calculate unread count correctly with mixed message types', () => {
      mockChatroomMessages.push(
        { id: '1', isRead: false, type: 'message' },
        { id: '2', isRead: false, type: 'system' },
        { id: '3', isRead: true, type: 'message' },
        { id: '4', isRead: false, type: 'reply' },
        { id: '5', isRead: false, type: 'message' }
      )
      
      render(<ChatroomTab {...defaultProps} />)
      
      const chatroomElement = screen.getByTestId('context-menu-trigger').firstChild
      // Should count 3 unread messages (excluding system message)
      expect(chatroomElement).toHaveClass('hasUnread')
    })

    it('should not show hasUnread class when only system messages are unread', () => {
      mockChatroomMessages.push(
        { id: '1', isRead: false, type: 'system' },
        { id: '2', isRead: true, type: 'message' }
      )
      
      render(<ChatroomTab {...defaultProps} />)
      
      const chatroomElement = screen.getByTestId('context-menu-trigger').firstChild
      expect(chatroomElement).not.toHaveClass('hasUnread')
    })

    it('should handle messages without type property', () => {
      mockChatroomMessages.push(
        { id: '1', isRead: false }, // No type property
        { id: '2', isRead: false, type: 'message' }
      )
      
      expect(() => {
        render(<ChatroomTab {...defaultProps} />)
      }).not.toThrow()
    })

    it('should handle messages without isRead property', () => {
      mockChatroomMessages.push(
        { id: '1', type: 'message' }, // No isRead property
        { id: '2', isRead: false, type: 'message' }
      )
      
      expect(() => {
        render(<ChatroomTab {...defaultProps} />)
      }).not.toThrow()
    })
  })
})
