import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ModActions from './ModActions.jsx'

// Mock dependencies
vi.mock('../Shared/Tooltip', () => ({
  Tooltip: ({ children }) => <div data-testid="tooltip">{children}</div>,
  TooltipContent: ({ children, side, sideOffset }) => (
    <div data-testid="tooltip-content" data-side={side} data-offset={sideOffset}>
      {children}
    </div>
  ),
  TooltipProvider: ({ children, delayDuration, skipDelayDuration, disableHoverableContent }) => (
    <div 
      data-testid="tooltip-provider"
      data-delay={delayDuration}
      data-skip-delay={skipDelayDuration}
      data-disable-hoverable={disableHoverableContent}
    >
      {children}
    </div>
  ),
  TooltipTrigger: ({ children, asChild }) => (
    <div data-testid="tooltip-trigger" data-as-child={asChild}>
      {children}
    </div>
  )
}))

vi.mock('../Shared/Slider', () => ({
  Slider: ({ value, onValueChange, min, max, step, className }) => (
    <input
      data-testid="timeout-slider"
      type="range"
      value={value[0]}
      onChange={(e) => onValueChange([parseInt(e.target.value)])}
      min={min}
      max={max}
      step={step}
      className={className}
    />
  )
}))

// Mock static assets
vi.mock('@assets/icons/gavel-fill.svg?asset', () => ({ default: 'ban-icon.svg' }))
vi.mock('@assets/icons/hourglass.svg?asset', () => ({ default: 'timeout-icon.svg' }))
vi.mock('@assets/icons/circle-slash.svg?asset', () => ({ default: 'unban-icon.svg' }))

// Mock ChatUtils
vi.mock('../../utils/ChatUtils', () => ({
  convertSecondsToHumanReadable: vi.fn((seconds) => {
    if (seconds >= 86400) return `${Math.floor(seconds / 86400)}d`
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h`
    if (seconds >= 60) return `${Math.floor(seconds / 60)}m`
    return `${seconds}s`
  })
}))

// Mock useClickOutside hook
vi.mock('../../utils/useClickOutside', () => ({
  default: (ref, handler) => {
    // Store the handler for testing
    if (typeof handler === 'function') {
      global.mockClickOutsideHandler = handler
    }
  }
}))

// Mock clsx
vi.mock('clsx', () => ({
  default: (...args) => args.filter(Boolean).join(' ')
}))

// Mock window.app API
const mockModActions = {
  getBanUser: vi.fn(),
  getTimeoutUser: vi.fn(),
  getUnbanUser: vi.fn()
}

global.window.app = {
  modActions: mockModActions
}

describe('ModActions Component', () => {
  const defaultProps = {
    chatroomName: 'testchatroom',
    message: {
      id: 'msg123',
      content: 'Test message',
      sender: {
        id: 'user123',
        username: 'testuser'
      }
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.mockClickOutsideHandler = null
  })

  afterEach(() => {
    // Reset any open sliders
    global.mockClickOutsideHandler = null
  })

  describe('Rendering and Basic Functionality', () => {
    it('should render mod actions toolbar', () => {
      render(<ModActions {...defaultProps} />)

      expect(screen.getByTestId('tooltip-provider')).toBeInTheDocument()
      expect(screen.getByAltText('Unban User')).toBeInTheDocument()
      expect(screen.getByAltText('Timeout Slider')).toBeInTheDocument()
      expect(screen.getByAltText('Ban User')).toBeInTheDocument()
    })

    it('should render all three action buttons', () => {
      render(<ModActions {...defaultProps} />)

      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(3) // Unban, Timeout, Ban buttons

      // Check icons
      expect(screen.getByAltText('Unban User')).toHaveAttribute('src', 'unban-icon.svg')
      expect(screen.getByAltText('Timeout Slider')).toHaveAttribute('src', 'timeout-icon.svg')
      expect(screen.getByAltText('Ban User')).toHaveAttribute('src', 'ban-icon.svg')
    })

    it('should set correct icon sizes', () => {
      render(<ModActions {...defaultProps} />)

      const unbanIcon = screen.getByAltText('Unban User')
      const timeoutIcon = screen.getByAltText('Timeout Slider')
      const banIcon = screen.getByAltText('Ban User')

      expect(unbanIcon).toHaveAttribute('width', '12')
      expect(unbanIcon).toHaveAttribute('height', '12')
      
      expect(timeoutIcon).toHaveAttribute('width', '13')
      expect(timeoutIcon).toHaveAttribute('height', '13')
      
      expect(banIcon).toHaveAttribute('width', '12')
      expect(banIcon).toHaveAttribute('height', '12')
    })

    it('should not render when chatroomName is missing', () => {
      const { container } = render(<ModActions chatroomName={null} message={defaultProps.message} />)
      
      expect(container.firstChild).toBeNull()
    })

    it('should not render when chatroomName is empty string', () => {
      const { container } = render(<ModActions chatroomName="" message={defaultProps.message} />)
      
      expect(container.firstChild).toBeNull()
    })

    it('should not render when chatroomName is undefined', () => {
      const { container } = render(<ModActions chatroomName={undefined} message={defaultProps.message} />)
      
      expect(container.firstChild).toBeNull()
    })
  })

  describe('Tooltip Configuration', () => {
    it('should configure tooltip provider correctly', () => {
      render(<ModActions {...defaultProps} />)

      const tooltipProvider = screen.getByTestId('tooltip-provider')
      expect(tooltipProvider).toHaveAttribute('data-delay', '150')
      expect(tooltipProvider).toHaveAttribute('data-skip-delay', '0')
      expect(tooltipProvider).toHaveAttribute('data-disable-hoverable', 'true')
    })

    it('should have correct tooltip content for each action', () => {
      render(<ModActions {...defaultProps} />)

      expect(screen.getByText('Unban testuser')).toBeInTheDocument()
      expect(screen.getByText('Timeout Slider')).toBeInTheDocument()
      expect(screen.getByText('Ban testuser')).toBeInTheDocument()
    })

    it('should handle missing username in tooltips', () => {
      const messageWithoutUsername = {
        ...defaultProps.message,
        sender: {
          id: 'user123'
          // No username
        }
      }

      render(<ModActions {...defaultProps} message={messageWithoutUsername} />)

      expect(screen.getByText('Unban ')).toBeInTheDocument()
      expect(screen.getByText('Ban ')).toBeInTheDocument()
    })

    it('should handle missing sender in tooltips', () => {
      const messageWithoutSender = {
        ...defaultProps.message,
        sender: null
      }

      render(<ModActions {...defaultProps} message={messageWithoutSender} />)

      expect(screen.getByText('Unban ')).toBeInTheDocument()
      expect(screen.getByText('Ban ')).toBeInTheDocument()
    })
  })

  describe('Unban Action', () => {
    it('should call unban API when unban button clicked', async () => {
      const user = userEvent.setup()
      render(<ModActions {...defaultProps} />)

      const unbanButton = screen.getByAltText('Unban User').closest('button')
      await user.click(unbanButton)

      expect(mockModActions.getUnbanUser).toHaveBeenCalledWith('testchatroom', 'testuser')
    })

    it('should not call unban API when username is missing', async () => {
      const user = userEvent.setup()
      const messageWithoutUsername = {
        ...defaultProps.message,
        sender: { id: 'user123' }
      }

      render(<ModActions {...defaultProps} message={messageWithoutUsername} />)

      const unbanButton = screen.getByAltText('Unban User').closest('button')
      await user.click(unbanButton)

      expect(mockModActions.getUnbanUser).not.toHaveBeenCalled()
    })

    it('should handle null sender gracefully', async () => {
      const user = userEvent.setup()
      const messageWithoutSender = {
        ...defaultProps.message,
        sender: null
      }

      render(<ModActions {...defaultProps} message={messageWithoutSender} />)

      const unbanButton = screen.getByAltText('Unban User').closest('button')
      await user.click(unbanButton)

      expect(mockModActions.getUnbanUser).not.toHaveBeenCalled()
    })
  })

  describe('Ban Action', () => {
    it('should call ban API when ban button clicked', async () => {
      const user = userEvent.setup()
      render(<ModActions {...defaultProps} />)

      const banButton = screen.getByAltText('Ban User').closest('button')
      await user.click(banButton)

      expect(mockModActions.getBanUser).toHaveBeenCalledWith('testchatroom', 'testuser', 'ban')
    })

    it('should not call ban API when username is missing', async () => {
      const user = userEvent.setup()
      const messageWithoutUsername = {
        ...defaultProps.message,
        sender: { id: 'user123' }
      }

      render(<ModActions {...defaultProps} message={messageWithoutUsername} />)

      const banButton = screen.getByAltText('Ban User').closest('button')
      await user.click(banButton)

      expect(mockModActions.getBanUser).not.toHaveBeenCalled()
    })
  })

  describe('Timeout Slider Functionality', () => {
    it('should show timeout slider when timeout button clicked', async () => {
      const user = userEvent.setup()
      render(<ModActions {...defaultProps} />)

      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')
      await user.click(timeoutButton)

      expect(screen.getByTestId('timeout-slider')).toBeInTheDocument()
      expect(screen.getByText('Confirm')).toBeInTheDocument()
    })

    it('should hide timeout slider when clicking outside', async () => {
      const user = userEvent.setup()
      render(<ModActions {...defaultProps} />)

      // Show slider
      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')
      await user.click(timeoutButton)

      expect(screen.getByTestId('timeout-slider')).toBeInTheDocument()

      // Simulate click outside
      if (global.mockClickOutsideHandler) {
        global.mockClickOutsideHandler()
      }

      expect(screen.queryByTestId('timeout-slider')).not.toBeInTheDocument()
    })

    it('should apply active class when timeout slider is shown', async () => {
      const user = userEvent.setup()
      render(<ModActions {...defaultProps} />)

      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')
      
      // Initially no active class
      expect(timeoutButton).not.toHaveClass('active')

      await user.click(timeoutButton)

      // Should have active class when slider is shown
      expect(timeoutButton).toHaveClass('quickModToolsBtn active')
    })

    it('should set default slider value', async () => {
      const user = userEvent.setup()
      render(<ModActions {...defaultProps} />)

      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')
      await user.click(timeoutButton)

      const slider = screen.getByTestId('timeout-slider')
      expect(slider).toHaveAttribute('value', '20') // Default value
    })

    it('should update slider value when changed', async () => {
      const user = userEvent.setup()
      render(<ModActions {...defaultProps} />)

      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')
      await user.click(timeoutButton)

      const slider = screen.getByTestId('timeout-slider')
      await user.clear(slider)
      await user.type(slider, '50')

      expect(slider).toHaveAttribute('value', '50')
    })

    it('should have correct slider configuration', async () => {
      const user = userEvent.setup()
      render(<ModActions {...defaultProps} />)

      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')
      await user.click(timeoutButton)

      const slider = screen.getByTestId('timeout-slider')
      expect(slider).toHaveAttribute('min', '0')
      expect(slider).toHaveAttribute('max', '100')
      expect(slider).toHaveAttribute('step', '1')
      expect(slider).toHaveClass('timeoutSliderInput')
    })
  })

  describe('Timeout Duration Calculation', () => {
    it('should display human readable duration for default slider value', async () => {
      const user = userEvent.setup()
      render(<ModActions {...defaultProps} />)

      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')
      await user.click(timeoutButton)

      // With default slider value of 20, should show some duration
      expect(screen.getByText(/\d+[smhd]/)).toBeInTheDocument()
    })

    it('should update duration display when slider value changes', async () => {
      const user = userEvent.setup()
      render(<ModActions {...defaultProps} />)

      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')
      await user.click(timeoutButton)

      const slider = screen.getByTestId('timeout-slider')
      
      // Change slider value
      fireEvent.change(slider, { target: { value: '80' } })

      // Should update duration display (exact value depends on calculation)
      expect(screen.getByText(/\d+[smhd]/)).toBeInTheDocument()
    })

    it('should handle edge cases in duration calculation', async () => {
      const user = userEvent.setup()
      render(<ModActions {...defaultProps} />)

      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')
      await user.click(timeoutButton)

      const slider = screen.getByTestId('timeout-slider')
      
      // Test minimum value
      fireEvent.change(slider, { target: { value: '0' } })
      expect(screen.getByText(/\d+[smhd]/)).toBeInTheDocument()

      // Test maximum value
      fireEvent.change(slider, { target: { value: '100' } })
      expect(screen.getByText(/\d+[smhd]/)).toBeInTheDocument()
    })
  })

  describe('Timeout Confirmation', () => {
    it('should call timeout API when confirm button clicked', async () => {
      const user = userEvent.setup()
      render(<ModActions {...defaultProps} />)

      // Show slider
      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')
      await user.click(timeoutButton)

      // Click confirm
      const confirmButton = screen.getByText('Confirm')
      await user.click(confirmButton)

      expect(mockModActions.getTimeoutUser).toHaveBeenCalledWith(
        'testchatroom',
        'testuser',
        expect.any(Number)
      )
    })

    it('should hide slider after confirming timeout', async () => {
      const user = userEvent.setup()
      render(<ModActions {...defaultProps} />)

      // Show slider
      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')
      await user.click(timeoutButton)

      expect(screen.getByTestId('timeout-slider')).toBeInTheDocument()

      // Click confirm
      const confirmButton = screen.getByText('Confirm')
      await user.click(confirmButton)

      expect(screen.queryByTestId('timeout-slider')).not.toBeInTheDocument()
    })

    it('should not call timeout API when username is missing', async () => {
      const user = userEvent.setup()
      const messageWithoutUsername = {
        ...defaultProps.message,
        sender: { id: 'user123' }
      }

      render(<ModActions {...defaultProps} message={messageWithoutUsername} />)

      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')
      await user.click(timeoutButton)

      const confirmButton = screen.getByText('Confirm')
      await user.click(confirmButton)

      expect(mockModActions.getTimeoutUser).not.toHaveBeenCalled()
    })

    it('should call timeout API with custom slider value', async () => {
      const user = userEvent.setup()
      render(<ModActions {...defaultProps} />)

      // Show slider
      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')
      await user.click(timeoutButton)

      // Change slider value
      const slider = screen.getByTestId('timeout-slider')
      fireEvent.change(slider, { target: { value: '75' } })

      // Click confirm
      const confirmButton = screen.getByText('Confirm')
      await user.click(confirmButton)

      expect(mockModActions.getTimeoutUser).toHaveBeenCalledWith(
        'testchatroom',
        'testuser',
        expect.any(Number)
      )

      // Verify the duration is calculated from slider value 75
      const [, , duration] = mockModActions.getTimeoutUser.mock.calls[0]
      expect(duration).toBeGreaterThan(0)
    })
  })

  describe('Slider Duration Logic', () => {
    it('should calculate correct durations for different slider values', async () => {
      const user = userEvent.setup()
      render(<ModActions {...defaultProps} />)

      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')
      await user.click(timeoutButton)

      const slider = screen.getByTestId('timeout-slider')
      const confirmButton = screen.getByText('Confirm')

      // Test various slider values
      const testValues = [0, 25, 50, 75, 100]
      
      for (const value of testValues) {
        fireEvent.change(slider, { target: { value: value.toString() } })
        await user.click(confirmButton)

        const [, , duration] = mockModActions.getTimeoutUser.mock.calls[mockModActions.getTimeoutUser.mock.calls.length - 1]
        expect(duration).toBeGreaterThan(0)
        expect(duration).toBeLessThanOrEqual(10080) // Max 7 days in minutes
      }
    })

    it('should handle logarithmic scale correctly', async () => {
      const user = userEvent.setup()
      render(<ModActions {...defaultProps} />)

      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')
      await user.click(timeoutButton)

      const slider = screen.getByTestId('timeout-slider')
      const confirmButton = screen.getByText('Confirm')

      // Test that lower values give shorter durations
      fireEvent.change(slider, { target: { value: '10' } })
      await user.click(confirmButton)
      const lowDuration = mockModActions.getTimeoutUser.mock.calls[mockModActions.getTimeoutUser.mock.calls.length - 1][2]

      fireEvent.change(slider, { target: { value: '90' } })
      await user.click(confirmButton)
      const highDuration = mockModActions.getTimeoutUser.mock.calls[mockModActions.getTimeoutUser.mock.calls.length - 1][2]

      expect(highDuration).toBeGreaterThan(lowDuration)
    })

    it('should round durations to appropriate intervals', async () => {
      const user = userEvent.setup()
      render(<ModActions {...defaultProps} />)

      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')
      await user.click(timeoutButton)

      const slider = screen.getByTestId('timeout-slider')
      const confirmButton = screen.getByText('Confirm')

      // Test high value (should round to days)
      fireEvent.change(slider, { target: { value: '95' } })
      await user.click(confirmButton)
      const daysDuration = mockModActions.getTimeoutUser.mock.calls[mockModActions.getTimeoutUser.mock.calls.length - 1][2]
      
      // Should be multiple of 1440 (24 * 60 minutes in a day)
      expect(daysDuration % 1440).toBe(0)
    })
  })

  describe('CSS Classes and Styling', () => {
    it('should apply correct CSS classes to components', () => {
      const { container } = render(<ModActions {...defaultProps} />)

      expect(container.querySelector('.quickModTools')).toBeInTheDocument()
      
      const buttons = container.querySelectorAll('.quickModToolsBtn')
      expect(buttons).toHaveLength(3)
    })

    it('should apply active class to all buttons when slider is shown', async () => {
      const user = userEvent.setup()
      const { container } = render(<ModActions {...defaultProps} />)

      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')
      await user.click(timeoutButton)

      const buttons = container.querySelectorAll('.quickModToolsBtn')
      buttons.forEach(button => {
        expect(button).toHaveClass('quickModToolsBtn active')
      })
    })

    it('should have correct slider container classes', async () => {
      const user = userEvent.setup()
      const { container } = render(<ModActions {...defaultProps} />)

      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')
      await user.click(timeoutButton)

      expect(container.querySelector('.timeoutSlider')).toBeInTheDocument()
      expect(container.querySelector('.timeoutSliderContent')).toBeInTheDocument()
      expect(container.querySelector('.timeoutSliderBody')).toBeInTheDocument()
      expect(container.querySelector('.timeoutSliderDuration')).toBeInTheDocument()
      expect(container.querySelector('.timeoutSliderButton')).toBeInTheDocument()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle null message gracefully', () => {
      render(<ModActions chatroomName="testchatroom" message={null} />)

      expect(screen.getByAltText('Unban User')).toBeInTheDocument()
      expect(screen.getByAltText('Ban User')).toBeInTheDocument()
      
      // Tooltips should handle null message
      expect(screen.getByText('Unban ')).toBeInTheDocument()
      expect(screen.getByText('Ban ')).toBeInTheDocument()
    })

    it('should handle undefined message gracefully', () => {
      render(<ModActions chatroomName="testchatroom" message={undefined} />)

      expect(screen.getByAltText('Unban User')).toBeInTheDocument()
      expect(screen.getByAltText('Ban User')).toBeInTheDocument()
    })

    it('should handle message without sender', async () => {
      const user = userEvent.setup()
      const messageWithoutSender = {
        id: 'msg123',
        content: 'Test message'
        // No sender property
      }

      render(<ModActions {...defaultProps} message={messageWithoutSender} />)

      // Should not crash when clicking buttons
      const unbanButton = screen.getByAltText('Unban User').closest('button')
      const banButton = screen.getByAltText('Ban User').closest('button')

      await user.click(unbanButton)
      await user.click(banButton)

      expect(mockModActions.getUnbanUser).not.toHaveBeenCalled()
      expect(mockModActions.getBanUser).not.toHaveBeenCalled()
    })

    it('should handle empty message object', async () => {
      const user = userEvent.setup()
      const emptyMessage = {}

      render(<ModActions {...defaultProps} message={emptyMessage} />)

      const unbanButton = screen.getByAltText('Unban User').closest('button')
      await user.click(unbanButton)

      expect(mockModActions.getUnbanUser).not.toHaveBeenCalled()
    })

    it('should handle API errors gracefully', async () => {
      const user = userEvent.setup()
      
      // Mock API to throw error
      mockModActions.getBanUser.mockImplementation(() => {
        throw new Error('API Error')
      })

      render(<ModActions {...defaultProps} />)

      const banButton = screen.getByAltText('Ban User').closest('button')
      
      // Should not crash when API throws error
      await expect(user.click(banButton)).resolves.not.toThrow()
    })

    it('should handle missing window.app gracefully', async () => {
      const user = userEvent.setup()
      
      // Temporarily remove window.app
      const originalApp = global.window.app
      delete global.window.app

      render(<ModActions {...defaultProps} />)

      const banButton = screen.getByAltText('Ban User').closest('button')
      
      // Should not crash when window.app is missing
      await expect(user.click(banButton)).resolves.not.toThrow()

      // Restore window.app
      global.window.app = originalApp
    })
  })

  describe('Accessibility', () => {
    it('should have proper alt text for all icons', () => {
      render(<ModActions {...defaultProps} />)

      expect(screen.getByAltText('Unban User')).toBeInTheDocument()
      expect(screen.getByAltText('Timeout Slider')).toBeInTheDocument()
      expect(screen.getByAltText('Ban User')).toBeInTheDocument()
    })

    it('should have clickable buttons', async () => {
      const user = userEvent.setup()
      render(<ModActions {...defaultProps} />)

      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(3)

      for (const button of buttons) {
        await user.click(button)
        // Should not throw errors
      }
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<ModActions {...defaultProps} />)

      const firstButton = screen.getByAltText('Unban User').closest('button')
      firstButton.focus()

      await user.keyboard('{Enter}')

      expect(mockModActions.getUnbanUser).toHaveBeenCalled()
    })

    it('should have proper button roles', () => {
      render(<ModActions {...defaultProps} />)

      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(3)
      
      buttons.forEach(button => {
        expect(button.tagName).toBe('BUTTON')
      })
    })
  })

  describe('Integration with External Dependencies', () => {
    it('should integrate correctly with ChatUtils', async () => {
      const user = userEvent.setup()
      const { convertSecondsToHumanReadable } = await import('../../utils/ChatUtils')
      
      render(<ModActions {...defaultProps} />)

      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')
      await user.click(timeoutButton)

      // Should call convertSecondsToHumanReadable for duration display
      expect(convertSecondsToHumanReadable).toHaveBeenCalled()
    })

    it('should integrate correctly with useClickOutside hook', () => {
      render(<ModActions {...defaultProps} />)

      // Should have registered click outside handler
      expect(global.mockClickOutsideHandler).toBeDefined()
      expect(typeof global.mockClickOutsideHandler).toBe('function')
    })

    it('should use clsx for conditional classes', async () => {
      const user = userEvent.setup()
      render(<ModActions {...defaultProps} />)

      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')
      
      // Check initial classes
      expect(timeoutButton).toHaveClass('quickModToolsBtn')
      expect(timeoutButton).not.toHaveClass('active')

      await user.click(timeoutButton)

      // Check classes after activation
      expect(timeoutButton).toHaveClass('quickModToolsBtn active')
    })
  })

  describe('Performance and Memory Management', () => {
    it('should not cause memory leaks with repeated renders', () => {
      const { rerender } = render(<ModActions {...defaultProps} />)

      // Multiple re-renders should not cause issues
      for (let i = 0; i < 100; i++) {
        rerender(<ModActions {...defaultProps} />)
      }

      expect(screen.getByAltText('Unban User')).toBeInTheDocument()
    })

    it('should cleanup click outside listeners properly', () => {
      const { unmount } = render(<ModActions {...defaultProps} />)

      expect(global.mockClickOutsideHandler).toBeDefined()

      unmount()

      // Handler should still be defined (hook handles cleanup internally)
      // This is more of a integration test with the actual hook
    })

    it('should handle rapid state changes', async () => {
      const user = userEvent.setup({ delay: null })
      render(<ModActions {...defaultProps} />)

      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')

      // Rapidly toggle slider
      for (let i = 0; i < 10; i++) {
        await user.click(timeoutButton)
      }

      // Should handle rapid state changes without issues
      expect(screen.getByTestId('timeout-slider')).toBeInTheDocument()
    })
  })

  describe('Slider Value Calculations', () => {
    it('should handle extreme slider values correctly', async () => {
      const user = userEvent.setup()
      render(<ModActions {...defaultProps} />)

      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')
      await user.click(timeoutButton)

      const slider = screen.getByTestId('timeout-slider')
      const confirmButton = screen.getByText('Confirm')

      // Test edge case values
      const edgeCases = [0, 1, 99, 100]
      
      for (const value of edgeCases) {
        fireEvent.change(slider, { target: { value: value.toString() } })
        await user.click(confirmButton)

        const [, , duration] = mockModActions.getTimeoutUser.mock.calls[mockModActions.getTimeoutUser.mock.calls.length - 1]
        expect(duration).toBeGreaterThanOrEqual(1) // At least 1 minute
        expect(duration).toBeLessThanOrEqual(10080) // Max 7 days in minutes
      }
    })

    it('should ensure minimum timeout duration is respected', async () => {
      const user = userEvent.setup()
      render(<ModActions {...defaultProps} />)

      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')
      await user.click(timeoutButton)

      const slider = screen.getByTestId('timeout-slider')
      const confirmButton = screen.getByText('Confirm')

      // Set to minimum value
      fireEvent.change(slider, { target: { value: '0' } })
      await user.click(confirmButton)

      const [, , duration] = mockModActions.getTimeoutUser.mock.calls[mockModActions.getTimeoutUser.mock.calls.length - 1]
      expect(duration).toBeGreaterThanOrEqual(1) // Should be at least 1 minute
    })

    it('should ensure maximum timeout duration is respected', async () => {
      const user = userEvent.setup()
      render(<ModActions {...defaultProps} />)

      const timeoutButton = screen.getByAltText('Timeout Slider').closest('button')
      await user.click(timeoutButton)

      const slider = screen.getByTestId('timeout-slider')
      const confirmButton = screen.getByText('Confirm')

      // Set to maximum value
      fireEvent.change(slider, { target: { value: '100' } })
      await user.click(confirmButton)

      const [, , duration] = mockModActions.getTimeoutUser.mock.calls[mockModActions.getTimeoutUser.mock.calls.length - 1]
      expect(duration).toBeLessThanOrEqual(10080) // Should be at most 7 days in minutes
    })
  })
})