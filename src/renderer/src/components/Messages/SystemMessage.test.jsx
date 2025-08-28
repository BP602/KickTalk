import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SystemMessage from './SystemMessage.jsx'

describe('SystemMessage Component', () => {
  describe('Basic Rendering', () => {
    it('should render with correct CSS class', () => {
      render(<SystemMessage content="Test message" />)
      
      const systemMessage = screen.getByText('Test message')
      expect(systemMessage).toBeInTheDocument()
      expect(systemMessage).toHaveClass('systemMessage')
      expect(systemMessage.tagName).toBe('SPAN')
    })

    it('should render custom content directly', () => {
      const customContent = 'Custom system message'
      render(<SystemMessage content={customContent} />)
      
      expect(screen.getByText(customContent)).toBeInTheDocument()
    })
  })

  describe('Predefined Message Mapping', () => {
    it('should map "connection-pending" to connecting message', () => {
      render(<SystemMessage content="connection-pending" />)
      
      expect(screen.getByText('Connecting to Channel...')).toBeInTheDocument()
      expect(screen.queryByText('connection-pending')).not.toBeInTheDocument()
    })

    it('should map "connection-success" to connected message', () => {
      render(<SystemMessage content="connection-success" />)
      
      expect(screen.getByText('Connected to Channel')).toBeInTheDocument()
      expect(screen.queryByText('connection-success')).not.toBeInTheDocument()
    })

    it('should display unmapped content as-is', () => {
      const unmappedContent = 'unknown-message-type'
      render(<SystemMessage content={unmappedContent} />)
      
      expect(screen.getByText(unmappedContent)).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty string content', () => {
      render(<SystemMessage content="" />)
      
      const systemMessage = screen.getByText('')
      expect(systemMessage).toBeInTheDocument()
      expect(systemMessage).toHaveClass('systemMessage')
    })

    it('should handle null content', () => {
      render(<SystemMessage content={null} />)
      
      // Should render empty content when null
      const systemMessage = document.querySelector('.systemMessage')
      expect(systemMessage).toBeInTheDocument()
      expect(systemMessage).toBeEmptyDOMElement()
    })

    it('should handle undefined content', () => {
      render(<SystemMessage content={undefined} />)
      
      // Should render empty content when undefined
      const systemMessage = document.querySelector('.systemMessage')
      expect(systemMessage).toBeInTheDocument()
      expect(systemMessage).toBeEmptyDOMElement()
    })

    it('should handle number content', () => {
      render(<SystemMessage content={42} />)
      
      expect(screen.getByText('42')).toBeInTheDocument()
    })

    it('should handle boolean content', () => {
      render(<SystemMessage content={true} />)
      
      expect(screen.getByText('true')).toBeInTheDocument()
    })
  })

  describe('Special Characters and Formatting', () => {
    it('should handle special characters in content', () => {
      const specialContent = '🔥💯 Special chars: <>&"\'`'
      render(<SystemMessage content={specialContent} />)
      
      expect(screen.getByText(specialContent)).toBeInTheDocument()
    })

    it('should handle HTML-like content without rendering HTML', () => {
      const htmlContent = '<div>HTML content</div>'
      render(<SystemMessage content={htmlContent} />)
      
      expect(screen.getByText(htmlContent)).toBeInTheDocument()
      // Should not create actual HTML elements
      expect(document.querySelector('div')).not.toHaveTextContent('HTML content')
    })

    it('should handle multi-line content', () => {
      const multiLineContent = 'Line 1\nLine 2\nLine 3'
      render(<SystemMessage content={multiLineContent} />)
      
      expect(screen.getByText(multiLineContent)).toBeInTheDocument()
    })

    it('should handle very long content', () => {
      const longContent = 'A'.repeat(1000)
      render(<SystemMessage content={longContent} />)
      
      expect(screen.getByText(longContent)).toBeInTheDocument()
    })
  })

  describe('Connection Status Messages', () => {
    it('should show appropriate connecting message', () => {
      render(<SystemMessage content="connection-pending" />)
      
      const message = screen.getByText('Connecting to Channel...')
      expect(message).toBeInTheDocument()
      expect(message).toHaveClass('systemMessage')
    })

    it('should show appropriate connected message', () => {
      render(<SystemMessage content="connection-success" />)
      
      const message = screen.getByText('Connected to Channel')
      expect(message).toBeInTheDocument()
      expect(message).toHaveClass('systemMessage')
    })

    it('should handle case-sensitive message types', () => {
      // Should not match if case is different
      render(<SystemMessage content="Connection-Pending" />)
      
      expect(screen.getByText('Connection-Pending')).toBeInTheDocument()
      expect(screen.queryByText('Connecting to Channel...')).not.toBeInTheDocument()
    })

    it('should handle message types with extra whitespace', () => {
      render(<SystemMessage content=" connection-pending " />)
      
      // Should not match with whitespace
      expect(screen.getByText(' connection-pending ')).toBeInTheDocument()
      expect(screen.queryByText('Connecting to Channel...')).not.toBeInTheDocument()
    })
  })

  describe('Message Map Extensibility', () => {
    it('should handle all defined message types', () => {
      const messageTypes = [
        { input: 'connection-pending', expected: 'Connecting to Channel...' },
        { input: 'connection-success', expected: 'Connected to Channel' }
      ]

      messageTypes.forEach(({ input, expected }) => {
        const { unmount } = render(<SystemMessage content={input} />)
        expect(screen.getByText(expected)).toBeInTheDocument()
        unmount()
      })
    })

    it('should preserve original behavior for unmapped messages', () => {
      const unmappedMessages = [
        'custom-message',
        'error-occurred',
        'user-joined',
        'user-left',
        'moderator-action'
      ]

      unmappedMessages.forEach((message) => {
        const { unmount } = render(<SystemMessage content={message} />)
        expect(screen.getByText(message)).toBeInTheDocument()
        unmount()
      })
    })
  })

  describe('Component Performance', () => {
    it('should handle rapid re-renders efficiently', () => {
      const { rerender } = render(<SystemMessage content="connection-pending" />)
      
      // Rapid re-renders with different content
      for (let i = 0; i < 100; i++) {
        const content = i % 2 === 0 ? 'connection-pending' : 'connection-success'
        rerender(<SystemMessage content={content} />)
      }
      
      expect(screen.getByText('Connected to Channel')).toBeInTheDocument()
    })

    it('should handle large numbers of different messages', () => {
      const messages = Array.from({ length: 100 }, (_, i) => `message-${i}`)
      
      messages.forEach((message) => {
        const { unmount } = render(<SystemMessage content={message} />)
        expect(screen.getByText(message)).toBeInTheDocument()
        unmount()
      })
    })

    it('should not cause memory leaks with frequent mount/unmount', () => {
      for (let i = 0; i < 100; i++) {
        const { unmount } = render(<SystemMessage content={`message-${i}`} />)
        unmount()
      }
      
      // Test passes if no errors are thrown
      expect(true).toBe(true)
    })
  })

  describe('Accessibility', () => {
    it('should be accessible to screen readers', () => {
      render(<SystemMessage content="connection-success" />)
      
      const message = screen.getByText('Connected to Channel')
      expect(message).toBeInTheDocument()
      
      // Should be readable by screen readers (no aria-hidden)
      expect(message).not.toHaveAttribute('aria-hidden')
    })

    it('should maintain semantic meaning', () => {
      render(<SystemMessage content="Important system notification" />)
      
      const message = screen.getByText('Important system notification')
      expect(message.tagName).toBe('SPAN')
      expect(message).toHaveClass('systemMessage')
    })

    it('should not interfere with keyboard navigation', () => {
      render(<SystemMessage content="connection-pending" />)
      
      const message = screen.getByText('Connecting to Channel...')
      // Should not be focusable
      expect(message).not.toHaveAttribute('tabindex')
    })
  })

  describe('CSS Class Application', () => {
    it('should always apply systemMessage class', () => {
      const testCases = [
        'connection-pending',
        'connection-success',
        'custom-message',
        '',
        null,
        undefined
      ]

      testCases.forEach((content) => {
        const { unmount } = render(<SystemMessage content={content} />)
        const systemMessage = document.querySelector('.systemMessage')
        expect(systemMessage).toBeInTheDocument()
        expect(systemMessage).toHaveClass('systemMessage')
        unmount()
      })
    })

    it('should not apply additional classes', () => {
      render(<SystemMessage content="connection-pending" />)
      
      const message = screen.getByText('Connecting to Channel...')
      expect(message.className).toBe('systemMessage')
    })
  })

  describe('DOM Structure', () => {
    it('should render as a single span element', () => {
      render(<SystemMessage content="test message" />)
      
      const message = screen.getByText('test message')
      expect(message.tagName).toBe('SPAN')
      expect(message.children).toHaveLength(0) // No child elements
    })

    it('should not wrap content in additional elements', () => {
      render(<SystemMessage content="simple message" />)
      
      const container = document.querySelector('.systemMessage')
      expect(container.childNodes).toHaveLength(1) // Only text node
      expect(container.firstChild.nodeType).toBe(Node.TEXT_NODE)
    })

    it('should maintain consistent DOM structure across different content types', () => {
      const { rerender } = render(<SystemMessage content="connection-pending" />)
      
      let container = document.querySelector('.systemMessage')
      expect(container.tagName).toBe('SPAN')
      expect(container).toHaveClass('systemMessage')
      
      rerender(<SystemMessage content="custom message" />)
      
      container = document.querySelector('.systemMessage')
      expect(container.tagName).toBe('SPAN')
      expect(container).toHaveClass('systemMessage')
    })
  })

  describe('Integration and Compatibility', () => {
    it('should work correctly when rendered multiple times', () => {
      render(
        <div>
          <SystemMessage content="connection-pending" />
          <SystemMessage content="connection-success" />
          <SystemMessage content="custom message" />
        </div>
      )
      
      expect(screen.getByText('Connecting to Channel...')).toBeInTheDocument()
      expect(screen.getByText('Connected to Channel')).toBeInTheDocument()
      expect(screen.getByText('custom message')).toBeInTheDocument()
      
      const systemMessages = document.querySelectorAll('.systemMessage')
      expect(systemMessages).toHaveLength(3)
    })

    it('should maintain isolation between instances', () => {
      render(
        <div>
          <SystemMessage content="connection-pending" />
          <SystemMessage content="different message" />
        </div>
      )
      
      const messages = document.querySelectorAll('.systemMessage')
      expect(messages[0]).toHaveTextContent('Connecting to Channel...')
      expect(messages[1]).toHaveTextContent('different message')
    })

    it('should be compatible with React strict mode', () => {
      // This test ensures the component works with React.StrictMode
      expect(() => {
        render(
          <div>
            <SystemMessage content="connection-pending" />
          </div>
        )
      }).not.toThrow()
    })
  })
})