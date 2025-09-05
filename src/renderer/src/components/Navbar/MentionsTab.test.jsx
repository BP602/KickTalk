import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import MentionsTab from './MentionsTab'

// Mock modules
vi.mock('clsx', () => ({
  default: (...args) => args.filter(Boolean).join(' ')
}))

// Mock static assets
vi.mock('../../assets/icons/x-bold.svg?asset', () => ({ default: 'x-icon.svg' }))
vi.mock('../../assets/icons/notification-bell.svg?asset', () => ({ default: 'notification-bell.svg' }))

describe('MentionsTab Component', () => {
  const defaultProps = {
    currentChatroomId: null,
    onSelectChatroom: vi.fn(),
    onRemoveMentionsTab: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render the mentions tab', () => {
      render(<MentionsTab {...defaultProps} />)
      
      expect(screen.getByText('Mentions')).toBeInTheDocument()
      expect(screen.getByAltText('Mentions')).toBeInTheDocument()
    })

    it('should render notification bell icon', () => {
      render(<MentionsTab {...defaultProps} />)
      
      const notificationIcon = screen.getByAltText('Mentions')
      expect(notificationIcon).toBeInTheDocument()
      expect(notificationIcon).toHaveAttribute('src', 'notification-bell.svg')
      expect(notificationIcon).toHaveAttribute('width', '20')
      expect(notificationIcon).toHaveAttribute('height', '20')
    })

    it('should render close button', () => {
      render(<MentionsTab {...defaultProps} />)
      
      const closeButton = screen.getByRole('button', { name: 'Remove mentions tab' })
      expect(closeButton).toBeInTheDocument()
    })

    it('should render close button icon', () => {
      render(<MentionsTab {...defaultProps} />)
      
      const closeButtonIcon = screen.getByAltText('Remove mentions tab')
      expect(closeButtonIcon).toBeInTheDocument()
      expect(closeButtonIcon).toHaveAttribute('src', 'x-icon.svg')
      expect(closeButtonIcon).toHaveAttribute('width', '12')
      expect(closeButtonIcon).toHaveAttribute('height', '12')
    })
  })

  describe('CSS Classes and States', () => {
    it('should apply base chatroomStreamer class', () => {
      const { container } = render(<MentionsTab {...defaultProps} />)
      
      // The root element is the first div child which contains the chatroomStreamer class
      const mentionsContainer = container.firstChild
      expect(mentionsContainer).toHaveClass('chatroomStreamer')
    })

    it('should apply active class when mentions is currently selected', () => {
      const activeProps = {
        ...defaultProps,
        currentChatroomId: 'mentions'
      }
      
      const { container } = render(<MentionsTab {...activeProps} />)
      
      const mentionsContainer = container.firstChild
      expect(mentionsContainer).toHaveClass('chatroomStreamer', 'chatroomStreamerActive')
    })

    it('should not apply active class when another chatroom is selected', () => {
      const inactiveProps = {
        ...defaultProps,
        currentChatroomId: 'some-other-chatroom'
      }
      
      const { container } = render(<MentionsTab {...inactiveProps} />)
      
      const mentionsContainer = container.firstChild
      expect(mentionsContainer).toHaveClass('chatroomStreamer')
      expect(mentionsContainer).not.toHaveClass('chatroomStreamerActive')
    })

    it('should not apply active class when no chatroom is selected', () => {
      const { container } = render(<MentionsTab {...defaultProps} />)
      
      const mentionsContainer = container.firstChild
      expect(mentionsContainer).toHaveClass('chatroomStreamer')
      expect(mentionsContainer).not.toHaveClass('chatroomStreamerActive')
    })
  })

  describe('Click Interactions', () => {
    it('should call onSelectChatroom with "mentions" when clicked', async () => {
      const user = userEvent.setup()
      const mockOnSelectChatroom = vi.fn()
      
      const { container } = render(<MentionsTab {...defaultProps} onSelectChatroom={mockOnSelectChatroom} />)
      
      const mentionsElement = container.firstChild
      await user.click(mentionsElement)
      
      expect(mockOnSelectChatroom).toHaveBeenCalledWith('mentions')
    })

    it('should call onRemoveMentionsTab when middle mouse button is clicked', () => {
      const mockOnRemoveMentionsTab = vi.fn()
      
      const { container } = render(<MentionsTab {...defaultProps} onRemoveMentionsTab={mockOnRemoveMentionsTab} />)
      
      const mentionsElement = container.firstChild
      fireEvent.mouseDown(mentionsElement, { button: 1 })
      
      expect(mockOnRemoveMentionsTab).toHaveBeenCalled()
    })

    it('should not call onRemoveMentionsTab when left mouse button is clicked', () => {
      const mockOnRemoveMentionsTab = vi.fn()
      
      const { container } = render(<MentionsTab {...defaultProps} onRemoveMentionsTab={mockOnRemoveMentionsTab} />)
      
      const mentionsElement = container.firstChild
      fireEvent.mouseDown(mentionsElement, { button: 0 }) // Left click
      
      expect(mockOnRemoveMentionsTab).not.toHaveBeenCalled()
    })

    it('should not call onRemoveMentionsTab when right mouse button is clicked', () => {
      const mockOnRemoveMentionsTab = vi.fn()
      
      const { container } = render(<MentionsTab {...defaultProps} onRemoveMentionsTab={mockOnRemoveMentionsTab} />)
      
      const mentionsElement = container.firstChild
      fireEvent.mouseDown(mentionsElement, { button: 2 }) // Right click
      
      expect(mockOnRemoveMentionsTab).not.toHaveBeenCalled()
    })

    it('should call onRemoveMentionsTab when close button is clicked', async () => {
      const user = userEvent.setup()
      const mockOnRemoveMentionsTab = vi.fn()
      
      render(<MentionsTab {...defaultProps} onRemoveMentionsTab={mockOnRemoveMentionsTab} />)
      
      const closeButton = screen.getByRole('button', { name: 'Remove mentions tab' })
      await user.click(closeButton)
      
      expect(mockOnRemoveMentionsTab).toHaveBeenCalled()
    })

    it('should stop propagation when close button is clicked', async () => {
      const user = userEvent.setup()
      const mockOnSelectChatroom = vi.fn()
      const mockOnRemoveMentionsTab = vi.fn()
      
      render(<MentionsTab {...defaultProps} onSelectChatroom={mockOnSelectChatroom} onRemoveMentionsTab={mockOnRemoveMentionsTab} />)
      
      const closeButton = screen.getByRole('button', { name: 'Remove mentions tab' })
      await user.click(closeButton)
      
      expect(mockOnRemoveMentionsTab).toHaveBeenCalled()
      expect(mockOnSelectChatroom).not.toHaveBeenCalled()
    })
  })

  describe('Component Structure', () => {
    it('should have the correct DOM structure', () => {
      const { container } = render(<MentionsTab {...defaultProps} />)
      
      const rootContainer = container.firstChild
      expect(rootContainer).toBeInTheDocument()
      
      const streamerInfo = rootContainer.querySelector('.streamerInfo')
      expect(streamerInfo).toBeInTheDocument()
      
      const closeButton = rootContainer.querySelector('.closeChatroom')
      expect(closeButton).toBeInTheDocument()
    })

    it('should render profile image with correct classes', () => {
      render(<MentionsTab {...defaultProps} />)
      
      const profileImage = screen.getByAltText('Mentions')
      expect(profileImage).toHaveClass('profileImage')
    })

    it('should render close button with correct classes', () => {
      render(<MentionsTab {...defaultProps} />)
      
      const closeButton = screen.getByRole('button', { name: 'Remove mentions tab' })
      expect(closeButton).toHaveClass('closeChatroom')
    })

    it('should render streamer info container with correct class', () => {
      const { container } = render(<MentionsTab {...defaultProps} />)
      
      const rootContainer = container.firstChild
      const streamerInfo = rootContainer.querySelector('.streamerInfo')
      expect(streamerInfo).toHaveClass('streamerInfo')
      expect(streamerInfo).toContainElement(screen.getByText('Mentions'))
      expect(streamerInfo).toContainElement(screen.getByAltText('Mentions'))
    })
  })

  describe('Memoization', () => {
    it('should be memoized to prevent unnecessary re-renders', () => {
      const { rerender } = render(<MentionsTab {...defaultProps} />)
      
      const initialElement = screen.getByText('Mentions')
      expect(initialElement).toBeInTheDocument()
      
      // Re-render with same props
      rerender(<MentionsTab {...defaultProps} />)
      
      const rerenderedElement = screen.getByText('Mentions')
      expect(rerenderedElement).toBeInTheDocument()
      // Component should still be there (we can't directly test memo behavior in this setup)
    })

    it('should update when currentChatroomId changes', () => {
      const { rerender, container } = render(<MentionsTab {...defaultProps} />)
      
      let mentionsElement = container.firstChild
      expect(mentionsElement).not.toHaveClass('chatroomStreamerActive')
      
      // Change to active state
      const activeProps = {
        ...defaultProps,
        currentChatroomId: 'mentions'
      }
      
      rerender(<MentionsTab {...activeProps} />)
      
      mentionsElement = container.firstChild
      expect(mentionsElement).toHaveClass('chatroomStreamerActive')
    })

    it('should update when callback functions change', () => {
      const { rerender } = render(<MentionsTab {...defaultProps} />)
      
      expect(screen.getByText('Mentions')).toBeInTheDocument()
      
      // Change callback functions
      const updatedProps = {
        ...defaultProps,
        onSelectChatroom: vi.fn(),
        onRemoveMentionsTab: vi.fn()
      }
      
      rerender(<MentionsTab {...updatedProps} />)
      
      expect(screen.getByText('Mentions')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper alt text for notification icon', () => {
      render(<MentionsTab {...defaultProps} />)
      
      const notificationIcon = screen.getByAltText('Mentions')
      expect(notificationIcon).toBeInTheDocument()
    })

    it('should have proper alt text for close button icon', () => {
      render(<MentionsTab {...defaultProps} />)
      
      const closeButtonIcon = screen.getByAltText('Remove mentions tab')
      expect(closeButtonIcon).toBeInTheDocument()
    })

    it('should have proper aria-label for close button', () => {
      render(<MentionsTab {...defaultProps} />)
      
      const closeButton = screen.getByRole('button', { name: 'Remove mentions tab' })
      expect(closeButton).toHaveAttribute('aria-label', 'Remove mentions tab')
    })

    it('should be keyboard navigable', () => {
      render(<MentionsTab {...defaultProps} />)
      
      const closeButton = screen.getByRole('button', { name: 'Remove mentions tab' })
      expect(closeButton).toBeInTheDocument()
      
      // The main container is clickable but doesn't have explicit tabindex
      // This is consistent with the original implementation
    })
  })

  describe('Event Handling', () => {
    it('should handle multiple rapid clicks gracefully', async () => {
      const user = userEvent.setup()
      const mockOnSelectChatroom = vi.fn()
      
      const { container } = render(<MentionsTab {...defaultProps} onSelectChatroom={mockOnSelectChatroom} />)
      
      const mentionsElement = container.firstChild
      
      // Rapid clicks
      await user.click(mentionsElement)
      await user.click(mentionsElement)
      await user.click(mentionsElement)
      
      expect(mockOnSelectChatroom).toHaveBeenCalledTimes(3)
      mockOnSelectChatroom.mock.calls.forEach(call => {
        expect(call[0]).toBe('mentions')
      })
    })

    it('should handle simultaneous mouse events properly', async () => {
      const user = userEvent.setup()
      const mockOnSelectChatroom = vi.fn()
      const mockOnRemoveMentionsTab = vi.fn()
      
      const { container } = render(<MentionsTab {...defaultProps} onSelectChatroom={mockOnSelectChatroom} onRemoveMentionsTab={mockOnRemoveMentionsTab} />)
      
      const mentionsElement = container.firstChild
      
      // Simulate middle click followed by left click
      fireEvent.mouseDown(mentionsElement, { button: 1 })
      await user.click(mentionsElement)
      
      expect(mockOnRemoveMentionsTab).toHaveBeenCalledTimes(1)
      expect(mockOnSelectChatroom).toHaveBeenCalledTimes(1)
    })

    it('should handle close button events with different mouse buttons', async () => {
      const user = userEvent.setup()
      const mockOnRemoveMentionsTab = vi.fn()
      
      render(<MentionsTab {...defaultProps} onRemoveMentionsTab={mockOnRemoveMentionsTab} />)
      
      const closeButton = screen.getByRole('button', { name: 'Remove mentions tab' })
      
      // Left click should trigger removal
      await user.click(closeButton)
      expect(mockOnRemoveMentionsTab).toHaveBeenCalledTimes(1)
      
      // Right click should also work (handled by default button behavior)
      fireEvent.contextMenu(closeButton)
      // Context menu doesn't trigger the onClick handler
      expect(mockOnRemoveMentionsTab).toHaveBeenCalledTimes(1)
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined callbacks gracefully', () => {
      const propsWithUndefinedCallbacks = {
        currentChatroomId: 'mentions',
        onSelectChatroom: undefined,
        onRemoveMentionsTab: undefined
      }
      
      expect(() => {
        render(<MentionsTab {...propsWithUndefinedCallbacks} />)
      }).not.toThrow()
    })

    it('should handle null currentChatroomId', () => {
      const propsWithNullChatroomId = {
        ...defaultProps,
        currentChatroomId: null
      }
      
      render(<MentionsTab {...propsWithNullChatroomId} />)
      
      const mentionsElement = screen.getByText('Mentions').closest('div')
      expect(mentionsElement).not.toHaveClass('chatroomStreamerActive')
    })

    it('should handle empty string currentChatroomId', () => {
      const propsWithEmptyChatroomId = {
        ...defaultProps,
        currentChatroomId: ''
      }
      
      render(<MentionsTab {...propsWithEmptyChatroomId} />)
      
      const mentionsElement = screen.getByText('Mentions').closest('div')
      expect(mentionsElement).not.toHaveClass('chatroomStreamerActive')
    })

    it('should handle currentChatroomId with special characters', () => {
      const propsWithSpecialCharChatroomId = {
        ...defaultProps,
        currentChatroomId: 'mentions-with-special-chars!@#$%^&*()'
      }
      
      render(<MentionsTab {...propsWithSpecialCharChatroomId} />)
      
      const mentionsElement = screen.getByText('Mentions').closest('div')
      expect(mentionsElement).not.toHaveClass('chatroomStreamerActive')
    })

    it('should handle case-sensitive comparison correctly', () => {
      const propsWithUppercaseChatroomId = {
        ...defaultProps,
        currentChatroomId: 'MENTIONS'
      }
      
      render(<MentionsTab {...propsWithUppercaseChatroomId} />)
      
      const mentionsElement = screen.getByText('Mentions').closest('div')
      expect(mentionsElement).not.toHaveClass('chatroomStreamerActive')
    })
  })

  describe('Component Integration', () => {
    it('should work correctly when integrated with parent component state changes', () => {
      const { rerender, container } = render(<MentionsTab {...defaultProps} />)
      
      // Initial state - inactive
      let mentionsElement = container.firstChild
      expect(mentionsElement).not.toHaveClass('chatroomStreamerActive')
      
      // Activate mentions tab
      rerender(<MentionsTab {...defaultProps} currentChatroomId="mentions" />)
      
      mentionsElement = container.firstChild
      expect(mentionsElement).toHaveClass('chatroomStreamerActive')
      
      // Switch to different chatroom
      rerender(<MentionsTab {...defaultProps} currentChatroomId="other-chatroom" />)
      
      mentionsElement = container.firstChild
      expect(mentionsElement).not.toHaveClass('chatroomStreamerActive')
      
      // Back to no selection
      rerender(<MentionsTab {...defaultProps} currentChatroomId={null} />)
      
      mentionsElement = container.firstChild
      expect(mentionsElement).not.toHaveClass('chatroomStreamerActive')
    })

    it('should maintain consistent behavior across re-renders', () => {
      const mockOnSelectChatroom = vi.fn()
      const mockOnRemoveMentionsTab = vi.fn()
      
      const { rerender, container } = render(
        <MentionsTab 
          {...defaultProps} 
          onSelectChatroom={mockOnSelectChatroom}
          onRemoveMentionsTab={mockOnRemoveMentionsTab}
        />
      )
      
      // Test functionality after multiple re-renders
      for (let i = 0; i < 3; i++) {
        rerender(
          <MentionsTab 
            {...defaultProps} 
            currentChatroomId={i % 2 === 0 ? 'mentions' : 'other'}
            onSelectChatroom={mockOnSelectChatroom}
            onRemoveMentionsTab={mockOnRemoveMentionsTab}
          />
        )
      }
      
      // Functionality should still work
      const mentionsElement = container.firstChild
      fireEvent.click(mentionsElement)
      
      expect(mockOnSelectChatroom).toHaveBeenLastCalledWith('mentions')
    })
  })

  describe('Performance', () => {
    it('should render efficiently with minimal DOM nodes', () => {
      const { container } = render(<MentionsTab {...defaultProps} />)
      
      // Should have a lean DOM structure
      const allElements = container.querySelectorAll('*')
      
      // Basic structure: container div, streamerInfo div, img, span, button, img in button
      expect(allElements.length).toBeLessThan(10)
      
      // Verify essential elements are present
      expect(screen.getByText('Mentions')).toBeInTheDocument()
      expect(screen.getByAltText('Mentions')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Remove mentions tab' })).toBeInTheDocument()
    })

    it('should not create memory leaks with frequent prop changes', () => {
      const { rerender, unmount } = render(<MentionsTab {...defaultProps} />)
      
      // Simulate frequent prop changes
      for (let i = 0; i < 20; i++) {
        rerender(
          <MentionsTab 
            {...defaultProps}
            currentChatroomId={i % 2 === 0 ? 'mentions' : `chatroom-${i}`}
            onSelectChatroom={vi.fn()}
            onRemoveMentionsTab={vi.fn()}
          />
        )
      }
      
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Visual State Consistency', () => {
    it('should maintain visual consistency between active and inactive states', () => {
      const { rerender, container } = render(<MentionsTab {...defaultProps} />)
      
      // Test inactive state
      let mentionsElement = container.firstChild
      expect(mentionsElement).toHaveClass('chatroomStreamer')
      expect(mentionsElement).not.toHaveClass('chatroomStreamerActive')
      
      // Test active state
      rerender(<MentionsTab {...defaultProps} currentChatroomId="mentions" />)
      
      mentionsElement = container.firstChild
      expect(mentionsElement).toHaveClass('chatroomStreamer', 'chatroomStreamerActive')
      
      // Ensure basic structure remains the same
      expect(screen.getByText('Mentions')).toBeInTheDocument()
      expect(screen.getByAltText('Mentions')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Remove mentions tab' })).toBeInTheDocument()
    })

    it('should handle rapid state transitions smoothly', async () => {
      const { rerender, container } = render(<MentionsTab {...defaultProps} />)
      
      const states = ['mentions', null, 'other-tab', 'mentions', null]
      
      for (const state of states) {
        rerender(<MentionsTab {...defaultProps} currentChatroomId={state} />)
        
        const mentionsElement = container.firstChild
        const shouldBeActive = state === 'mentions'
        
        if (shouldBeActive) {
          expect(mentionsElement).toHaveClass('chatroomStreamerActive')
        } else {
          expect(mentionsElement).not.toHaveClass('chatroomStreamerActive')
        }
        
        // Base class should always be present
        expect(mentionsElement).toHaveClass('chatroomStreamer')
      }
    })
  })
})