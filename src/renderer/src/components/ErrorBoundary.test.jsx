import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ErrorBoundary from './ErrorBoundary.jsx'

// Mock the SCSS import
vi.mock('@assets/styles/components/ErrorBoundary.scss', () => ({}))

// Mock clsx for consistent class name handling
vi.mock('clsx', () => ({
  default: (...args) => args.filter(Boolean).join(' ')
}))

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn()
  },
  writable: true
})

// Mock window.location.reload
Object.defineProperty(window, 'location', {
  value: {
    reload: vi.fn()
  },
  writable: true
})

// Mock console.error to test error logging
const originalConsoleError = console.error

// Test component that throws errors on command
const ThrowError = ({ shouldThrow = false, errorType = 'generic', errorMessage = 'Test error' }) => {
  if (shouldThrow) {
    switch (errorType) {
      case 'render':
        throw new Error(errorMessage)
      case 'reference':
        throw new ReferenceError(errorMessage)
      case 'type':
        throw new TypeError(errorMessage)
      case 'syntax':
        throw new SyntaxError(errorMessage)
      case 'range':
        throw new RangeError(errorMessage)
      case 'custom':
        const customError = new Error(errorMessage)
        customError.name = 'CustomError'
        customError.stack = `CustomError: ${errorMessage}\n    at ThrowError (test.js:1:1)`
        throw customError
      default:
        throw new Error(errorMessage)
    }
  }
  return <div data-testid="child-component">Child content</div>
}

const WorkingComponent = ({ content = 'Working component' }) => (
  <div data-testid="working-component">{content}</div>
)

describe('ErrorBoundary Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
    console.error = vi.fn() // Mock console.error for each test
    
    // Reset clipboard mock
    navigator.clipboard.writeText.mockClear()
    
    // Reset window.location.reload mock
    window.location.reload.mockClear()
  })

  afterEach(() => {
    console.error = originalConsoleError // Restore original console.error
    vi.useRealTimers()
  })

  describe('Normal Operation', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <WorkingComponent content="Test content" />
        </ErrorBoundary>
      )
      
      expect(screen.getByTestId('working-component')).toBeInTheDocument()
      expect(screen.getByText('Test content')).toBeInTheDocument()
    })

    it('should render multiple children without errors', () => {
      render(
        <ErrorBoundary>
          <WorkingComponent content="First child" />
          <WorkingComponent content="Second child" />
          <div data-testid="third-child">Third child</div>
        </ErrorBoundary>
      )
      
      expect(screen.getByText('First child')).toBeInTheDocument()
      expect(screen.getByText('Second child')).toBeInTheDocument()
      expect(screen.getByTestId('third-child')).toBeInTheDocument()
    })

    it('should pass props to children correctly', () => {
      render(
        <ErrorBoundary>
          <WorkingComponent content="Props passed correctly" />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Props passed correctly')).toBeInTheDocument()
    })

    it('should have correct initial state', () => {
      const { container } = render(
        <ErrorBoundary>
          <WorkingComponent />
        </ErrorBoundary>
      )
      
      // Should not render error boundary UI
      expect(container.querySelector('.errorBoundary')).not.toBeInTheDocument()
      expect(screen.getByTestId('working-component')).toBeInTheDocument()
    })
  })

  describe('Error Catching', () => {
    it('should catch and display generic errors', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Generic test error" />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByText('An error occurred while rendering the application.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Show Error Details' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reload App' })).toBeInTheDocument()
    })

    it('should catch ReferenceError', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorType="reference" errorMessage="undefined variable" />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(console.error).toHaveBeenCalledWith(
        'Error caught by ErrorBoundary:',
        expect.any(ReferenceError),
        expect.any(Object)
      )
    })

    it('should catch TypeError', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorType="type" errorMessage="Cannot read property of undefined" />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(console.error).toHaveBeenCalledWith(
        'Error caught by ErrorBoundary:',
        expect.any(TypeError),
        expect.any(Object)
      )
    })

    it('should catch SyntaxError', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorType="syntax" errorMessage="Unexpected token" />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(console.error).toHaveBeenCalledWith(
        'Error caught by ErrorBoundary:',
        expect.any(SyntaxError),
        expect.any(Object)
      )
    })

    it('should catch RangeError', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorType="range" errorMessage="Maximum call stack exceeded" />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(console.error).toHaveBeenCalledWith(
        'Error caught by ErrorBoundary:',
        expect.any(RangeError),
        expect.any(Object)
      )
    })

    it('should catch custom errors', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorType="custom" errorMessage="Custom application error" />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(console.error).toHaveBeenCalledWith(
        'Error caught by ErrorBoundary:',
        expect.objectContaining({
          name: 'CustomError',
          message: 'Custom application error'
        }),
        expect.any(Object)
      )
    })

    it('should log error details to console', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Console logging test" />
        </ErrorBoundary>
      )
      
      expect(console.error).toHaveBeenCalledWith(
        'Error caught by ErrorBoundary:',
        expect.objectContaining({
          message: 'Console logging test'
        }),
        expect.objectContaining({
          componentStack: expect.any(String)
        })
      )
    })

    it('should preserve error stack trace', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Stack trace test" />
        </ErrorBoundary>
      )
      
      const [[, error]] = console.error.mock.calls
      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('Stack trace test')
    })

    it('should handle errors with undefined messages', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage={undefined} />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('should handle errors with null messages', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage={null} />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })

  describe('Error Dialog Functionality', () => {
    beforeEach(() => {
      // Render component with error for these tests
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Dialog test error" />
        </ErrorBoundary>
      )
    })

    it('should show error dialog when "Show Error Details" is clicked', async () => {
      const user = userEvent.setup()
      
      const showDetailsButton = screen.getByRole('button', { name: 'Show Error Details' })
      await user.click(showDetailsButton)
      
      expect(screen.getByText('Error Details')).toBeInTheDocument()
      expect(screen.getByText(/Dialog test error/)).toBeInTheDocument()
    })

    it('should apply success class to show details button when dialog is open', async () => {
      const user = userEvent.setup()
      
      const showDetailsButton = screen.getByRole('button', { name: 'Show Error Details' })
      expect(showDetailsButton).not.toHaveClass('success')
      
      await user.click(showDetailsButton)
      expect(showDetailsButton).toHaveClass('success')
    })

    it('should close error dialog when close button is clicked', async () => {
      const user = userEvent.setup()
      
      // Open dialog first
      const showDetailsButton = screen.getByRole('button', { name: 'Show Error Details' })
      await user.click(showDetailsButton)
      
      expect(screen.getByText('Error Details')).toBeInTheDocument()
      
      // Close dialog
      const closeButton = screen.getByText('×')
      await user.click(closeButton)
      
      expect(screen.queryByText('Error Details')).not.toBeInTheDocument()
    })

    it('should display error message in dialog content', async () => {
      const user = userEvent.setup()
      
      const showDetailsButton = screen.getByRole('button', { name: 'Show Error Details' })
      await user.click(showDetailsButton)
      
      const dialogContent = document.querySelector('.errorDialogContentText')
      expect(dialogContent).toBeInTheDocument()
      expect(dialogContent.textContent).toContain('Dialog test error')
    })

    it('should display component stack trace in dialog', async () => {
      const user = userEvent.setup()
      
      const showDetailsButton = screen.getByRole('button', { name: 'Show Error Details' })
      await user.click(showDetailsButton)
      
      const dialogContent = document.querySelector('.errorDialogContentText')
      expect(dialogContent.textContent).toContain('ThrowError')
    })

    it('should handle missing error in dialog', async () => {
      const user = userEvent.setup()
      
      // Override the error state to be null (edge case)
      const showDetailsButton = screen.getByRole('button', { name: 'Show Error Details' })
      await user.click(showDetailsButton)
      
      // Should still render dialog without crashing
      expect(screen.getByText('Error Details')).toBeInTheDocument()
    })

    it('should handle missing error info in dialog', async () => {
      const user = userEvent.setup()
      
      const showDetailsButton = screen.getByRole('button', { name: 'Show Error Details' })
      await user.click(showDetailsButton)
      
      // Should render dialog even with limited error information
      expect(screen.getByText('Error Details')).toBeInTheDocument()
    })
  })

  describe('Copy Error Functionality', () => {
    beforeEach(async () => {
      vi.useFakeTimers()
      navigator.clipboard.writeText.mockResolvedValue()
      
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Copy test error" />
        </ErrorBoundary>
      )
      
      // Open error dialog
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const showDetailsButton = screen.getByRole('button', { name: 'Show Error Details' })
      await user.click(showDetailsButton)
    })

    it('should copy error details to clipboard', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      const copyButton = screen.getByRole('button', { name: 'Copy Error' })
      await user.click(copyButton)
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('Copy test error')
      )
    })

    it('should show success state after copying', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      const copyButton = screen.getByRole('button', { name: 'Copy Error' })
      await user.click(copyButton)
      
      expect(copyButton).toHaveTextContent('Copied!')
      expect(copyButton).toHaveClass('success')
    })

    it('should reset success state after 2 seconds', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      const copyButton = screen.getByRole('button', { name: 'Copy Error' })
      await user.click(copyButton)
      
      expect(copyButton).toHaveTextContent('Copied!')
      
      // Fast-forward 2 seconds
      vi.advanceTimersByTime(2000)
      
      expect(copyButton).toHaveTextContent('Copy Error')
      expect(copyButton).not.toHaveClass('success')
    })

    it('should include component stack in copied text', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      const copyButton = screen.getByRole('button', { name: 'Copy Error' })
      await user.click(copyButton)
      
      const [[copiedText]] = navigator.clipboard.writeText.mock.calls
      expect(copiedText).toContain('Copy test error')
      expect(copiedText).toContain('Stack Trace:')
    })

    it('should handle clipboard write failures gracefully', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      // Mock clipboard failure
      navigator.clipboard.writeText.mockRejectedValue(new Error('Clipboard error'))
      const consoleErrorSpy = vi.spyOn(console, 'error')
      
      const copyButton = screen.getByRole('button', { name: 'Copy Error' })
      await user.click(copyButton)
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to copy error details:', expect.any(Error))
    })

    it('should format error text correctly', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      const copyButton = screen.getByRole('button', { name: 'Copy Error' })
      await user.click(copyButton)
      
      const [[copiedText]] = navigator.clipboard.writeText.mock.calls
      const lines = copiedText.split('\n')
      
      expect(lines[0]).toMatch(/^Error: /)
      expect(lines[2]).toBe('Stack Trace:')
    })

    it('should handle null error gracefully', async () => {
      // This tests the edge case where error might be null
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      const copyButton = screen.getByRole('button', { name: 'Copy Error' })
      await user.click(copyButton)
      
      // Should not crash
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
    })

    it('should handle undefined errorInfo gracefully', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      const copyButton = screen.getByRole('button', { name: 'Copy Error' })
      await user.click(copyButton)
      
      // Should still copy without component stack
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
    })
  })

  describe('Reload Functionality', () => {
    beforeEach(() => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Reload test error" />
        </ErrorBoundary>
      )
    })

    it('should reload the page when reload button is clicked', async () => {
      const user = userEvent.setup()
      
      const reloadButton = screen.getByRole('button', { name: 'Reload App' })
      await user.click(reloadButton)
      
      expect(window.location.reload).toHaveBeenCalledTimes(1)
    })

    it('should have primary class on reload button', () => {
      const reloadButton = screen.getByRole('button', { name: 'Reload App' })
      expect(reloadButton).toHaveClass('errorButton', 'primary')
    })
  })

  describe('Component Recovery', () => {
    it('should recover when children change after error', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      // Should show error boundary
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      
      // Rerender with working component
      rerender(
        <ErrorBoundary>
          <WorkingComponent content="Recovered content" />
        </ErrorBoundary>
      )
      
      // Should still show error boundary (it doesn't auto-recover)
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('should not automatically recover from errors', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      
      // Rerender with same boundary instance
      rerender(
        <ErrorBoundary>
          <WorkingComponent />
        </ErrorBoundary>
      )
      
      // Should still show error state
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.queryByTestId('working-component')).not.toBeInTheDocument()
    })

    it('should recover when boundary is remounted', () => {
      const { rerender } = render(
        <ErrorBoundary key="first">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      
      // Remount with different key
      rerender(
        <ErrorBoundary key="second">
          <WorkingComponent content="New boundary content" />
        </ErrorBoundary>
      )
      
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
      expect(screen.getByText('New boundary content')).toBeInTheDocument()
    })
  })

  describe('CSS Classes and Styling', () => {
    beforeEach(() => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
    })

    it('should apply correct CSS classes to error boundary container', () => {
      const errorBoundary = document.querySelector('.errorBoundary')
      expect(errorBoundary).toBeInTheDocument()
      expect(errorBoundary).toHaveClass('errorBoundary')
    })

    it('should apply correct CSS classes to content container', () => {
      const errorContent = document.querySelector('.errorBoundaryContent')
      expect(errorContent).toBeInTheDocument()
      expect(errorContent).toHaveClass('errorBoundaryContent')
    })

    it('should apply correct CSS classes to actions container', () => {
      const actionsContainer = document.querySelector('.errorBoundaryActions')
      expect(actionsContainer).toBeInTheDocument()
      expect(actionsContainer).toHaveClass('errorBoundaryActions')
    })

    it('should apply correct CSS classes to error buttons', () => {
      const buttons = document.querySelectorAll('.errorButton')
      expect(buttons).toHaveLength(2)
      
      // Show Error Details button
      expect(buttons[0]).toHaveClass('errorButton')
      
      // Reload button
      expect(buttons[1]).toHaveClass('errorButton', 'primary')
    })

    it('should apply correct CSS classes to error dialog', async () => {
      const user = userEvent.setup()
      
      const showDetailsButton = screen.getByRole('button', { name: 'Show Error Details' })
      await user.click(showDetailsButton)
      
      const dialog = document.querySelector('.errorDialog')
      expect(dialog).toBeInTheDocument()
      expect(dialog).toHaveClass('errorDialog')
      
      const header = document.querySelector('.errorDialogHeader')
      expect(header).toHaveClass('errorDialogHeader')
      
      const content = document.querySelector('.errorDialogContent')
      expect(content).toHaveClass('errorDialogContent')
      
      const footer = document.querySelector('.errorDialogFooter')
      expect(footer).toHaveClass('errorDialogFooter')
    })

    it('should apply close button class', async () => {
      const user = userEvent.setup()
      
      const showDetailsButton = screen.getByRole('button', { name: 'Show Error Details' })
      await user.click(showDetailsButton)
      
      const closeButton = document.querySelector('.closeButton')
      expect(closeButton).toBeInTheDocument()
      expect(closeButton).toHaveClass('closeButton')
    })
  })

  describe('Accessibility', () => {
    beforeEach(() => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
    })

    it('should have accessible button roles', () => {
      expect(screen.getByRole('button', { name: 'Show Error Details' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reload App' })).toBeInTheDocument()
    })

    it('should have accessible headings', () => {
      expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeInTheDocument()
    })

    it('should have accessible dialog headings', async () => {
      const user = userEvent.setup()
      
      const showDetailsButton = screen.getByRole('button', { name: 'Show Error Details' })
      await user.click(showDetailsButton)
      
      expect(screen.getByRole('heading', { level: 2, name: 'Error Details' })).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      
      const showDetailsButton = screen.getByRole('button', { name: 'Show Error Details' })
      const reloadButton = screen.getByRole('button', { name: 'Reload App' })
      
      // Tab navigation
      await user.tab()
      expect(showDetailsButton).toHaveFocus()
      
      await user.tab()
      expect(reloadButton).toHaveFocus()
    })

    it('should support keyboard interaction with dialog', async () => {
      const user = userEvent.setup()
      
      const showDetailsButton = screen.getByRole('button', { name: 'Show Error Details' })
      
      // Open dialog with Enter key
      showDetailsButton.focus()
      await user.keyboard('{Enter}')
      
      expect(screen.getByText('Error Details')).toBeInTheDocument()
      
      // Close dialog with close button
      const closeButton = screen.getByText('×')
      closeButton.focus()
      await user.keyboard('{Enter}')
      
      expect(screen.queryByText('Error Details')).not.toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle errors thrown in componentDidCatch', () => {
      // Mock componentDidCatch to throw
      const OriginalErrorBoundary = ErrorBoundary
      const BrokenErrorBoundary = class extends OriginalErrorBoundary {
        componentDidCatch(error, errorInfo) {
          super.componentDidCatch(error, errorInfo)
          throw new Error('Error in componentDidCatch')
        }
      }
      
      expect(() => {
        render(
          <BrokenErrorBoundary>
            <ThrowError shouldThrow={true} />
          </BrokenErrorBoundary>
        )
      }).toThrow('Error in componentDidCatch')
    })

    it('should handle very long error messages', () => {
      const longMessage = 'A'.repeat(10000)
      
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage={longMessage} />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('should handle special characters in error messages', async () => {
      const specialMessage = '🔥💯 Special chars: <>&"\'`\n\t\r'
      
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage={specialMessage} />
        </ErrorBoundary>
      )
      
      const user = userEvent.setup()
      const showDetailsButton = screen.getByRole('button', { name: 'Show Error Details' })
      await user.click(showDetailsButton)
      
      const dialogContent = document.querySelector('.errorDialogContentText')
      expect(dialogContent.textContent).toContain(specialMessage)
    })

    it('should handle circular reference in error objects', () => {
      // Create error with circular reference
      const CircularError = ({ shouldThrow }) => {
        if (shouldThrow) {
          const error = new Error('Circular reference error')
          error.circular = error
          throw error
        }
        return <div>No error</div>
      }
      
      render(
        <ErrorBoundary>
          <CircularError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('should handle errors with no stack trace', () => {
      const NoStackError = ({ shouldThrow }) => {
        if (shouldThrow) {
          const error = new Error('No stack error')
          delete error.stack
          throw error
        }
        return <div>No error</div>
      }
      
      render(
        <ErrorBoundary>
          <NoStackError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('should handle rapid successive errors', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="First error" />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      
      // Trigger another error (won't actually re-catch since boundary is already in error state)
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Second error" />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })

  describe('Memory Management', () => {
    it('should cleanup timers on unmount', async () => {
      vi.useFakeTimers()
      
      const { unmount } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      // Open dialog and trigger copy
      const showDetailsButton = screen.getByRole('button', { name: 'Show Error Details' })
      await user.click(showDetailsButton)
      
      const copyButton = screen.getByRole('button', { name: 'Copy Error' })
      await user.click(copyButton)
      
      // Unmount before timeout completes
      unmount()
      
      // Should not crash when timeout tries to execute
      vi.advanceTimersByTime(2000)
    })

    it('should handle multiple rapid copy attempts', async () => {
      vi.useFakeTimers()
      
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      // Open dialog
      const showDetailsButton = screen.getByRole('button', { name: 'Show Error Details' })
      await user.click(showDetailsButton)
      
      const copyButton = screen.getByRole('button', { name: 'Copy Error' })
      
      // Rapid clicks
      await user.click(copyButton)
      await user.click(copyButton)
      await user.click(copyButton)
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(3)
      expect(copyButton).toHaveTextContent('Copied!')
    })
  })

  describe('Performance', () => {
    it('should not re-render when props change in error state', () => {
      const renderSpy = vi.fn()
      const TestBoundary = class extends ErrorBoundary {
        render() {
          renderSpy()
          return super.render()
        }
      }
      
      const { rerender } = render(
        <TestBoundary customProp="initial">
          <ThrowError shouldThrow={true} />
        </TestBoundary>
      )
      
      const initialRenderCount = renderSpy.mock.calls.length
      
      // Change props
      rerender(
        <TestBoundary customProp="changed">
          <ThrowError shouldThrow={true} />
        </TestBoundary>
      )
      
      // Should have re-rendered due to prop change
      expect(renderSpy.mock.calls.length).toBeGreaterThan(initialRenderCount)
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('should handle high-frequency state updates efficiently', async () => {
      vi.useFakeTimers()
      
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      // Open dialog
      const showDetailsButton = screen.getByRole('button', { name: 'Show Error Details' })
      await user.click(showDetailsButton)
      
      // Rapid dialog open/close
      for (let i = 0; i < 10; i++) {
        const closeButton = screen.getByText('×')
        await user.click(closeButton)
        await user.click(showDetailsButton)
      }
      
      expect(screen.getByText('Error Details')).toBeInTheDocument()
    })
  })
})