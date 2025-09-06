import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LinkPreview from './LinkPreview.jsx'

// Mock dependencies
vi.mock('@assets/styles/components/Cosmetics/LinkPreview.scss', () => ({}))

// Mock LinkTooltip component
vi.mock('./LinkTooltip', () => ({
  default: ({ showLinkInfo, mousePos, linkInfo }) => (
    <div data-testid="link-tooltip" style={{
      display: showLinkInfo ? 'block' : 'none',
      position: 'absolute',
      top: mousePos?.y || 0,
      left: mousePos?.x || 0
    }}>
      {linkInfo && (
        <div>
          <img src={linkInfo.clipThumbnailUrl} alt={linkInfo.clipTitle} />
          <span>{linkInfo.clipTitle}</span>
        </div>
      )}
    </div>
  )
}))

// Mock API service
const mockGetLinkThumbnail = vi.fn()
vi.mock('@utils/services/kick/kickAPI', () => ({
  getLinkThumbnail: mockGetLinkThumbnail
}))

describe('LinkPreview Component', () => {
  const testUrl = 'https://kick.com/testchannel/clips/clip123'
  const mockPreviewData = {
    clipThumbnailUrl: 'https://cdn.kick.com/thumbnails/clip123.jpg',
    clipTitle: 'Epic Gaming Moment',
    description: 'Amazing gameplay from streamer'
  }

  const defaultProps = {
    url: testUrl
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetLinkThumbnail.mockResolvedValue(mockPreviewData)
    
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true })
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Rendering', () => {
    it('should render link with correct URL and attributes', async () => {
      render(<LinkPreview {...defaultProps} />)
      
      await waitFor(() => {
        const link = screen.getByText(testUrl)
        expect(link).toBeInTheDocument()
        expect(link.tagName).toBe('A')
        expect(link).toHaveAttribute('href', testUrl)
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('rel', 'noreferrer')
      })
    })

    it('should apply correct styling to link', async () => {
      render(<LinkPreview {...defaultProps} />)
      
      await waitFor(() => {
        const link = screen.getByText(testUrl)
        expect(link).toHaveStyle('color: #c3d6c9')
        expect(link).toHaveClass('linkPreview')
      })
    })

    it('should have proper wrapper structure', async () => {
      render(<LinkPreview {...defaultProps} />)
      
      await waitFor(() => {
        const wrapper = document.querySelector('.chatroomLinkPreviewWrapper')
        const preview = document.querySelector('.chatroomLinkPreview')
        expect(wrapper).toBeInTheDocument()
        expect(preview).toBeInTheDocument()
      })
    })

    it('should display skeleton while loading', () => {
      // Mock slow API call
      mockGetLinkThumbnail.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve(mockPreviewData), 1000)
      }))
      
      render(<LinkPreview {...defaultProps} />)
      
      const skeleton = document.querySelector('.chatroomLinkPreviewSkeleton')
      expect(skeleton).toBeInTheDocument()
    })

    it('should hide skeleton after data loads', async () => {
      render(<LinkPreview {...defaultProps} />)
      
      await waitFor(() => {
        const skeleton = document.querySelector('.chatroomLinkPreviewSkeleton')
        expect(skeleton).not.toBeInTheDocument()
        expect(screen.getByTestId('link-tooltip')).toBeInTheDocument()
      })
    })
  })

  describe('API Integration', () => {
    it('should call getLinkThumbnail with correct URL', () => {
      render(<LinkPreview {...defaultProps} />)
      
      expect(mockGetLinkThumbnail).toHaveBeenCalledWith(testUrl)
      expect(mockGetLinkThumbnail).toHaveBeenCalledTimes(1)
    })

    it('should handle API success', async () => {
      render(<LinkPreview {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('link-tooltip')).toBeInTheDocument()
      })
    })

    it('should handle API errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGetLinkThumbnail.mockRejectedValue(new Error('API Error'))
      
      render(<LinkPreview {...defaultProps} />)
      
      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Error fetching link preview:', expect.any(Error))
        expect(screen.getByText(testUrl)).toBeInTheDocument() // Should still show link
      })
      
      consoleError.mockRestore()
    })

    it('should set loading to false after API error', async () => {
      mockGetLinkThumbnail.mockRejectedValue(new Error('API Error'))
      
      render(<LinkPreview {...defaultProps} />)
      
      await waitFor(() => {
        // Skeleton should be gone even on error
        const skeleton = document.querySelector('.chatroomLinkPreviewSkeleton')
        expect(skeleton).not.toBeInTheDocument()
      })
    })

    it('should handle API timeout', async () => {
      mockGetLinkThumbnail.mockImplementation(() => new Promise(() => {})) // Never resolves
      
      render(<LinkPreview {...defaultProps} />)
      
      // Should show skeleton while waiting
      const skeleton = document.querySelector('.chatroomLinkPreviewSkeleton')
      expect(skeleton).toBeInTheDocument()
    })

    it('should handle null API response', async () => {
      mockGetLinkThumbnail.mockResolvedValue(null)
      
      expect(() => {
        render(<LinkPreview {...defaultProps} />)
      }).not.toThrow()
      
      await waitFor(() => {
        expect(screen.getByText(testUrl)).toBeInTheDocument()
      })
    })
  })

  describe('Mouse Interactions', () => {
    it('should show tooltip on mouse enter', async () => {
      render(<LinkPreview {...defaultProps} />)
      
      await waitFor(() => {
        const linkPreview = screen.getByClassName('chatroomLinkPreview')
        fireEvent.mouseEnter(linkPreview, { clientX: 100, clientY: 200 })
        
        const tooltip = screen.getByTestId('link-tooltip')
        expect(tooltip).toHaveStyle('display: block')
      })
    })

    it('should hide tooltip on mouse leave', async () => {
      render(<LinkPreview {...defaultProps} />)
      
      await waitFor(() => {
        const linkPreview = screen.getByClassName('chatroomLinkPreview')
        fireEvent.mouseEnter(linkPreview)
        fireEvent.mouseLeave(linkPreview)
        
        const tooltip = screen.getByTestId('link-tooltip')
        expect(tooltip).toHaveStyle('display: none')
      })
    })

    it('should update tooltip position on mouse move', async () => {
      render(<LinkPreview {...defaultProps} />)
      
      await waitFor(() => {
        const linkPreview = screen.getByClassName('chatroomLinkPreview')
        
        fireEvent.mouseEnter(linkPreview, { clientX: 100, clientY: 200 })
        fireEvent.mouseMove(linkPreview, { clientX: 150, clientY: 250 })
        
        const tooltip = screen.getByTestId('link-tooltip')
        expect(tooltip).toHaveStyle('top: 250px; left: 150px')
      })
    })

    it('should not update position on mouse move when tooltip is hidden', async () => {
      render(<LinkPreview {...defaultProps} />)
      
      await waitFor(() => {
        const linkPreview = screen.getByClassName('chatroomLinkPreview')
        
        // Move without entering first
        fireEvent.mouseMove(linkPreview, { clientX: 150, clientY: 250 })
        
        const tooltip = screen.getByTestId('link-tooltip')
        expect(tooltip).toHaveStyle('top: 0px; left: 0px') // Should remain at default
      })
    })

    it('should handle rapid mouse events', async () => {
      render(<LinkPreview {...defaultProps} />)
      
      await waitFor(() => {
        const linkPreview = screen.getByClassName('chatroomLinkPreview')
        
        // Rapidly fire mouse events
        for (let i = 0; i < 10; i++) {
          fireEvent.mouseEnter(linkPreview, { clientX: i * 10, clientY: i * 10 })
          fireEvent.mouseMove(linkPreview, { clientX: i * 10 + 5, clientY: i * 10 + 5 })
          fireEvent.mouseLeave(linkPreview)
        }
        
        // Should not crash
        expect(screen.getByTestId('link-tooltip')).toBeInTheDocument()
      })
    })
  })

  describe('Tooltip Integration', () => {
    it('should pass correct data to tooltip', async () => {
      render(<LinkPreview {...defaultProps} />)
      
      await waitFor(() => {
        const linkPreview = screen.getByClassName('chatroomLinkPreview')
        fireEvent.mouseEnter(linkPreview)
        
        const tooltip = screen.getByTestId('link-tooltip')
        expect(screen.getByText('Epic Gaming Moment')).toBeInTheDocument()
        expect(screen.getByAltText('Epic Gaming Moment')).toBeInTheDocument()
      })
    })

    it('should show tooltip initially when component mounts', async () => {
      render(<LinkPreview {...defaultProps} />)
      
      // Tooltip should be shown by default (showLinkInfo starts as true)
      await waitFor(() => {
        const tooltip = screen.getByTestId('link-tooltip')
        expect(tooltip).toHaveStyle('display: block')
      })
    })

    it('should handle missing preview data in tooltip', async () => {
      mockGetLinkThumbnail.mockResolvedValue(null)
      
      render(<LinkPreview {...defaultProps} />)
      
      await waitFor(() => {
        const linkPreview = screen.getByClassName('chatroomLinkPreview')
        fireEvent.mouseEnter(linkPreview)
        
        // Should not crash with null data
        expect(screen.getByTestId('link-tooltip')).toBeInTheDocument()
      })
    })
  })

  describe('Loading States', () => {
    it('should manage loading state correctly', async () => {
      let resolveApi
      mockGetLinkThumbnail.mockImplementation(() => new Promise(resolve => {
        resolveApi = resolve
      }))
      
      render(<LinkPreview {...defaultProps} />)
      
      // Should show skeleton initially
      const skeleton = document.querySelector('.chatroomLinkPreviewSkeleton')
      expect(skeleton).toBeInTheDocument()
      
      // Resolve API call
      resolveApi(mockPreviewData)
      
      await waitFor(() => {
        const skeleton = document.querySelector('.chatroomLinkPreviewSkeleton')
        expect(skeleton).not.toBeInTheDocument()
        expect(screen.getByTestId('link-tooltip')).toBeInTheDocument()
      })
    })

    it('should handle multiple API calls correctly', async () => {
      const { rerender } = render(<LinkPreview url="https://kick.com/test1" />)
      
      await waitFor(() => {
        expect(mockGetLinkThumbnail).toHaveBeenCalledWith('https://kick.com/test1')
      })
      
      // Change URL
      rerender(<LinkPreview url="https://kick.com/test2" />)
      
      await waitFor(() => {
        expect(mockGetLinkThumbnail).toHaveBeenCalledWith('https://kick.com/test2')
        expect(mockGetLinkThumbnail).toHaveBeenCalledTimes(2)
      })
    })

    it('should reset loading state when URL changes', () => {
      const { rerender } = render(<LinkPreview url="https://kick.com/test1" />)
      
      rerender(<LinkPreview url="https://kick.com/test2" />)
      
      // Should show skeleton for new URL
      const skeleton = document.querySelector('.chatroomLinkPreviewSkeleton')
      expect(skeleton).toBeInTheDocument()
    })
  })

  describe('URL Handling', () => {
    it('should handle different URL formats', async () => {
      const urls = [
        'https://kick.com/channel',
        'https://www.kick.com/channel/clips/123',
        'http://kick.com/test',
        'https://kick.com/channel?param=value#section'
      ]
      
      for (const url of urls) {
        const { rerender } = render(<LinkPreview url={url} />)
        
        await waitFor(() => {
          expect(screen.getByText(url)).toBeInTheDocument()
          expect(screen.getByText(url)).toHaveAttribute('href', url)
        })
        
        if (url !== urls[urls.length - 1]) {
          rerender(<div />)
        }
      }
    })

    it('should handle very long URLs', async () => {
      const longUrl = 'https://kick.com/' + 'a'.repeat(200) + '/clips/' + 'b'.repeat(50)
      
      render(<LinkPreview url={longUrl} />)
      
      await waitFor(() => {
        expect(screen.getByText(longUrl)).toBeInTheDocument()
      })
    })

    it('should handle URLs with special characters', async () => {
      const specialUrl = 'https://kick.com/channel-name_123/clips/test?param=value&other=тест'
      
      render(<LinkPreview url={specialUrl} />)
      
      await waitFor(() => {
        expect(screen.getByText(specialUrl)).toBeInTheDocument()
        expect(screen.getByText(specialUrl)).toHaveAttribute('href', specialUrl)
      })
    })

    it('should handle empty URL', () => {
      expect(() => {
        render(<LinkPreview url="" />)
      }).not.toThrow()
      
      expect(mockGetLinkThumbnail).toHaveBeenCalledWith('')
    })

    it('should handle null URL', () => {
      expect(() => {
        render(<LinkPreview url={null} />)
      }).not.toThrow()
    })
  })

  describe('Performance', () => {
    it('should memoize component correctly', () => {
      const { rerender } = render(<LinkPreview {...defaultProps} />)
      
      // Re-render with same props
      rerender(<LinkPreview {...defaultProps} />)
      
      // Should only call API once due to memoization
      expect(mockGetLinkThumbnail).toHaveBeenCalledTimes(1)
    })

    it('should optimize event handlers with useCallback', async () => {
      render(<LinkPreview {...defaultProps} />)
      
      await waitFor(() => {
        const linkPreview = screen.getByClassName('chatroomLinkPreview')
        
        // Multiple interactions should work consistently
        for (let i = 0; i < 3; i++) {
          fireEvent.mouseEnter(linkPreview)
          fireEvent.mouseLeave(linkPreview)
        }
        
        expect(screen.getByTestId('link-tooltip')).toHaveStyle('display: none')
      })
    })

    it('should handle component unmount during API call', async () => {
      let rejectApi
      mockGetLinkThumbnail.mockImplementation(() => new Promise((resolve, reject) => {
        rejectApi = reject
      }))
      
      const { unmount } = render(<LinkPreview {...defaultProps} />)
      
      // Unmount before API resolves
      unmount()
      
      // Reject the API call (simulating cleanup)
      if (rejectApi) {
        rejectApi(new Error('Component unmounted'))
      }
      
      // Should not cause any issues
      expect(mockGetLinkThumbnail).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const networkError = new Error('Network error')
      mockGetLinkThumbnail.mockRejectedValue(networkError)
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      render(<LinkPreview {...defaultProps} />)
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error fetching link preview:', networkError)
        // Component should still render the link
        expect(screen.getByText(testUrl)).toBeInTheDocument()
      })
      
      consoleSpy.mockRestore()
    })

    it('should handle API returning invalid data', async () => {
      const invalidData = { invalid: 'structure' }
      mockGetLinkThumbnail.mockResolvedValue(invalidData)
      
      render(<LinkPreview {...defaultProps} />)
      
      await waitFor(() => {
        // Should still render component without crashing
        expect(screen.getByText(testUrl)).toBeInTheDocument()
        expect(screen.getByTestId('link-tooltip')).toBeInTheDocument()
      })
    })

    it('should handle missing API function', async () => {
      // Mock the entire module to return undefined
      vi.doMock('@utils/services/kick/kickAPI', () => ({
        getLinkThumbnail: undefined
      }))
      
      expect(() => {
        render(<LinkPreview {...defaultProps} />)
      }).not.toThrow()
    })
  })

  describe('Accessibility', () => {
    it('should have proper link attributes for accessibility', async () => {
      render(<LinkPreview {...defaultProps} />)
      
      await waitFor(() => {
        const link = screen.getByText(testUrl)
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('rel', 'noreferrer')
        expect(link).toHaveAttribute('href', testUrl)
      })
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<LinkPreview {...defaultProps} />)
      
      await waitFor(() => {
        const link = screen.getByText(testUrl)
        
        // Should be focusable
        link.focus()
        expect(link).toHaveFocus()
      })
    })

    it('should handle keyboard events on link preview area', async () => {
      const user = userEvent.setup()
      render(<LinkPreview {...defaultProps} />)
      
      await waitFor(() => {
        const linkPreview = screen.getByClassName('chatroomLinkPreview')
        
        // Focus the container
        linkPreview.focus()
        expect(linkPreview).toHaveFocus()
        
        // Enter key should work (handled by browser for links)
        user.keyboard('{Enter}')
      })
    })

    it('should provide meaningful text content', async () => {
      render(<LinkPreview {...defaultProps} />)
      
      await waitFor(() => {
        // URL should be readable by screen readers
        expect(screen.getByText(testUrl)).toBeInTheDocument()
        
        // Tooltip should have accessible content
        const tooltip = screen.getByTestId('link-tooltip')
        fireEvent.mouseEnter(screen.getByClassName('chatroomLinkPreview'))
        
        expect(screen.getByText('Epic Gaming Moment')).toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle component re-mounting', async () => {
      const { unmount, rerender } = render(<LinkPreview {...defaultProps} />)
      
      unmount()
      
      // Re-mount
      rerender(<LinkPreview {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText(testUrl)).toBeInTheDocument()
        expect(mockGetLinkThumbnail).toHaveBeenCalledTimes(2)
      })
    })

    it('should handle rapid URL changes', async () => {
      const { rerender } = render(<LinkPreview url="https://kick.com/test1" />)
      
      // Rapidly change URLs
      for (let i = 2; i <= 5; i++) {
        rerender(<LinkPreview url={`https://kick.com/test${i}`} />)
      }
      
      await waitFor(() => {
        expect(screen.getByText('https://kick.com/test5')).toBeInTheDocument()
      })
    })

    it('should handle tooltip state persistence across renders', async () => {
      const { rerender } = render(<LinkPreview {...defaultProps} />)
      
      await waitFor(() => {
        const linkPreview = screen.getByClassName('chatroomLinkPreview')
        fireEvent.mouseEnter(linkPreview)
        
        const tooltip = screen.getByTestId('link-tooltip')
        expect(tooltip).toHaveStyle('display: block')
      })
      
      // Re-render with same props
      rerender(<LinkPreview {...defaultProps} />)
      
      // Tooltip state should be maintained
      const tooltip = screen.getByTestId('link-tooltip')
      expect(tooltip).toHaveStyle('display: block')
    })
  })

  describe('Memory Management', () => {
    it('should clean up properly on unmount', () => {
      const { unmount } = render(<LinkPreview {...defaultProps} />)
      
      expect(() => {
        unmount()
      }).not.toThrow()
    })

    it('should handle multiple mount/unmount cycles', () => {
      for (let i = 0; i < 5; i++) {
        const { unmount } = render(<LinkPreview {...defaultProps} />)
        expect(screen.getByClassName('chatroomLinkPreviewWrapper')).toBeInTheDocument()
        unmount()
      }
    })

    it('should not create memory leaks with rapid re-renders', () => {
      const { rerender } = render(<LinkPreview {...defaultProps} />)
      
      // Rapid re-renders with different URLs
      for (let i = 0; i < 20; i++) {
        rerender(<LinkPreview url={`https://kick.com/test${i}`} />)
      }
      
      expect(screen.getByText('https://kick.com/test19')).toBeInTheDocument()
    })
  })
})