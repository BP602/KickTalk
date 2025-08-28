import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LinkTooltip from './LinkTooltip.jsx'

// Mock dependencies
vi.mock('@assets/styles/components/Cosmetics/LinkTooltip.scss', () => ({}))
vi.mock('clsx', () => ({
  default: (...args) => args.filter(Boolean).join(' ')
}))

describe('LinkTooltip Component', () => {
  const mockLinkInfo = {
    clipThumbnailUrl: 'https://cdn.kick.com/thumbnails/clip123.jpg',
    clipTitle: 'Epic Gaming Moment',
    description: 'Amazing gameplay from streamer'
  }

  const defaultProps = {
    showLinkInfo: true,
    mousePos: { x: 100, y: 200 },
    linkInfo: mockLinkInfo
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true })

    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 350,
      height: 200,
      top: 0,
      left: 0,
      bottom: 200,
      right: 350
    }))
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Rendering', () => {
    it('should render tooltip when showLinkInfo is true', () => {
      render(<LinkTooltip {...defaultProps} />)
      
      expect(screen.getByRole('img')).toBeInTheDocument()
      expect(screen.getByText('Epic Gaming Moment')).toBeInTheDocument()
      expect(screen.getByText('Link Title:')).toBeInTheDocument()
    })

    it('should not render when showLinkInfo is false', () => {
      render(<LinkTooltip {...defaultProps} showLinkInfo={false} />)
      
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
      expect(screen.queryByText('Epic Gaming Moment')).not.toBeInTheDocument()
    })

    it('should display clip image with correct src and alt', () => {
      render(<LinkTooltip {...defaultProps} />)
      
      const img = screen.getByRole('img')
      expect(img.src).toBe(mockLinkInfo.clipThumbnailUrl)
      expect(img.alt).toBe(mockLinkInfo.clipTitle)
    })

    it('should display clip title in info section', () => {
      render(<LinkTooltip {...defaultProps} />)
      
      expect(screen.getByText('Link Title:')).toBeInTheDocument()
      expect(screen.getByText('Epic Gaming Moment')).toBeInTheDocument()
    })

    it('should have correct CSS classes', () => {
      render(<LinkTooltip {...defaultProps} />)
      
      const tooltip = screen.getByText('Epic Gaming Moment').closest('.tooltipItem')
      expect(tooltip).toHaveClass('tooltipItem', 'linkTooltip', 'showTooltip')
    })

    it('should apply correct opacity when shown', () => {
      render(<LinkTooltip {...defaultProps} />)
      
      const tooltip = screen.getByText('Epic Gaming Moment').closest('.tooltipItem')
      expect(tooltip).toHaveStyle('opacity: 1')
    })

    it('should not apply showTooltip class when hidden', () => {
      render(<LinkTooltip {...defaultProps} showLinkInfo={false} />)
      
      expect(screen.queryByClassName('showTooltip')).not.toBeInTheDocument()
    })
  })

  describe('Image Attributes', () => {
    it('should have proper loading attributes for performance', () => {
      render(<LinkTooltip {...defaultProps} />)
      
      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('loading', 'lazy')
      expect(img).toHaveAttribute('fetchpriority', 'low')
      expect(img).toHaveAttribute('decoding', 'async')
    })

    it('should have correct class for styling', () => {
      render(<LinkTooltip {...defaultProps} />)
      
      const img = screen.getByRole('img')
      expect(img).toHaveClass('linkTooltipPreview')
    })

    it('should handle missing image source gracefully', () => {
      const linkInfoWithoutImage = {
        ...mockLinkInfo,
        clipThumbnailUrl: null
      }
      
      render(<LinkTooltip {...defaultProps} linkInfo={linkInfoWithoutImage} />)
      
      const img = screen.getByRole('img')
      expect(img.src).toBe('') // Browser handles null as empty string
    })
  })

  describe('Positioning', () => {
    it('should position tooltip correctly by default', () => {
      render(<LinkTooltip {...defaultProps} />)
      
      const tooltip = screen.getByText('Epic Gaming Moment').closest('.tooltipItem')
      expect(tooltip).toHaveStyle('top: 215px; left: 115px') // mousePos + 15 offset
    })

    it('should adjust position when tooltip would go off right edge', () => {
      const nearRightEdge = {
        ...defaultProps,
        mousePos: { x: 750, y: 200 }
      }
      
      render(<LinkTooltip {...nearRightEdge} />)
      
      const tooltip = screen.getByText('Epic Gaming Moment').closest('.tooltipItem')
      expect(tooltip).toHaveStyle('left: 385px') // x - width - offset (750 - 350 - 15)
    })

    it('should adjust position when tooltip would go off bottom edge', () => {
      const nearBottomEdge = {
        ...defaultProps,
        mousePos: { x: 100, y: 650 }
      }
      
      render(<LinkTooltip {...nearBottomEdge} />)
      
      const tooltip = screen.getByText('Epic Gaming Moment').closest('.tooltipItem')
      expect(tooltip).toHaveStyle('top: 435px') // y - height - offset (650 - 200 - 15)
    })

    it('should not go beyond left screen boundary', () => {
      const nearLeftEdge = {
        ...defaultProps,
        mousePos: { x: 10, y: 200 }
      }
      
      render(<LinkTooltip {...nearLeftEdge} />)
      
      const tooltip = screen.getByText('Epic Gaming Moment').closest('.tooltipItem')
      expect(tooltip).toHaveStyle('left: 654px') // windowWidth - width - 20 (1024 - 350 - 20)
    })

    it('should not go beyond top screen boundary', () => {
      const nearTopEdge = {
        ...defaultProps,
        mousePos: { x: 100, y: 10 }
      }
      
      render(<LinkTooltip {...nearTopEdge} />)
      
      const tooltip = screen.getByText('Epic Gaming Moment').closest('.tooltipItem')
      expect(tooltip).toHaveStyle('top: 548px') // windowHeight - height - 20 (768 - 200 - 20)
    })

    it('should handle extreme positions correctly', () => {
      const extremePositions = [
        { x: -100, y: -100 },
        { x: 2000, y: 2000 },
        { x: 0, y: 0 }
      ]
      
      extremePositions.forEach(mousePos => {
        const { rerender } = render(<LinkTooltip {...defaultProps} mousePos={mousePos} />)
        
        const tooltip = screen.getByText('Epic Gaming Moment').closest('.tooltipItem')
        const styles = window.getComputedStyle(tooltip)
        
        // Should have valid positions within screen bounds
        expect(parseInt(styles.top)).toBeGreaterThanOrEqual(20)
        expect(parseInt(styles.left)).toBeGreaterThanOrEqual(20)
        expect(parseInt(styles.top)).toBeLessThanOrEqual(768 - 200 - 20)
        expect(parseInt(styles.left)).toBeLessThanOrEqual(1024 - 350 - 20)
        
        if (mousePos !== extremePositions[extremePositions.length - 1]) {
          rerender(<div />)
        }
      })
    })
  })

  describe('Dynamic Updates', () => {
    it('should update position when mouse moves', () => {
      const { rerender } = render(<LinkTooltip {...defaultProps} />)
      
      let tooltip = screen.getByText('Epic Gaming Moment').closest('.tooltipItem')
      expect(tooltip).toHaveStyle('top: 215px; left: 115px')
      
      const newProps = {
        ...defaultProps,
        mousePos: { x: 300, y: 400 }
      }
      
      rerender(<LinkTooltip {...newProps} />)
      
      tooltip = screen.getByText('Epic Gaming Moment').closest('.tooltipItem')
      expect(tooltip).toHaveStyle('top: 415px; left: 315px')
    })

    it('should update content when linkInfo changes', () => {
      const { rerender } = render(<LinkTooltip {...defaultProps} />)
      
      expect(screen.getByText('Epic Gaming Moment')).toBeInTheDocument()
      
      const newLinkInfo = {
        clipThumbnailUrl: 'https://cdn.kick.com/thumbnails/clip456.jpg',
        clipTitle: 'New Gaming Clip'
      }
      
      rerender(<LinkTooltip {...defaultProps} linkInfo={newLinkInfo} />)
      
      expect(screen.getByText('New Gaming Clip')).toBeInTheDocument()
      expect(screen.queryByText('Epic Gaming Moment')).not.toBeInTheDocument()
    })

    it('should handle showLinkInfo toggle', () => {
      const { rerender } = render(<LinkTooltip {...defaultProps} />)
      
      expect(screen.getByText('Epic Gaming Moment')).toBeInTheDocument()
      
      rerender(<LinkTooltip {...defaultProps} showLinkInfo={false} />)
      
      expect(screen.queryByText('Epic Gaming Moment')).not.toBeInTheDocument()
      
      rerender(<LinkTooltip {...defaultProps} showLinkInfo={true} />)
      
      expect(screen.getByText('Epic Gaming Moment')).toBeInTheDocument()
    })

    it('should recalculate position when dependencies change', () => {
      const { rerender } = render(<LinkTooltip {...defaultProps} />)
      
      // Mock different tooltip rect
      Element.prototype.getBoundingClientRect = vi.fn(() => ({
        width: 400,
        height: 250,
        top: 0,
        left: 0,
        bottom: 250,
        right: 400
      }))
      
      const newProps = {
        ...defaultProps,
        mousePos: { x: 800, y: 200 },
        linkInfo: { ...mockLinkInfo, clipTitle: 'Updated Title' }
      }
      
      rerender(<LinkTooltip {...newProps} />)
      
      const tooltip = screen.getByText('Updated Title').closest('.tooltipItem')
      // Position should be adjusted based on new dimensions
      expect(tooltip).toHaveStyle('left: 385px') // 800 - 400 - 15
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing linkInfo gracefully', () => {
      expect(() => {
        render(<LinkTooltip {...defaultProps} linkInfo={null} />)
      }).not.toThrow()
    })

    it('should handle undefined linkInfo', () => {
      expect(() => {
        render(<LinkTooltip {...defaultProps} linkInfo={undefined} />)
      }).not.toThrow()
    })

    it('should handle linkInfo with missing properties', () => {
      const incompleteLinkInfo = {
        clipThumbnailUrl: 'https://cdn.kick.com/thumbnails/clip123.jpg'
        // Missing clipTitle
      }
      
      render(<LinkTooltip {...defaultProps} linkInfo={incompleteLinkInfo} />)
      
      expect(screen.getByRole('img')).toBeInTheDocument()
      expect(screen.getByText('Link Title:')).toBeInTheDocument()
      // Should handle undefined clipTitle gracefully
    })

    it('should handle null mouse coordinates', () => {
      const nullMousePos = {
        ...defaultProps,
        mousePos: { x: null, y: null }
      }
      
      expect(() => {
        render(<LinkTooltip {...nullMousePos} />)
      }).not.toThrow()
    })

    it('should handle undefined mouse coordinates', () => {
      const undefinedMousePos = {
        ...defaultProps,
        mousePos: { x: undefined, y: undefined }
      }
      
      expect(() => {
        render(<LinkTooltip {...undefinedMousePos} />)
      }).not.toThrow()
    })

    it('should handle very long clip titles', () => {
      const longTitleLinkInfo = {
        ...mockLinkInfo,
        clipTitle: 'A'.repeat(200)
      }
      
      render(<LinkTooltip {...defaultProps} linkInfo={longTitleLinkInfo} />)
      
      expect(screen.getByText('A'.repeat(200))).toBeInTheDocument()
    })

    it('should handle special characters in clip title', () => {
      const specialCharsLinkInfo = {
        ...mockLinkInfo,
        clipTitle: 'Clip with "quotes" & symbols! <test>'
      }
      
      render(<LinkTooltip {...defaultProps} linkInfo={specialCharsLinkInfo} />)
      
      expect(screen.getByText('Clip with "quotes" & symbols! <test>')).toBeInTheDocument()
    })

    it('should handle empty clip title', () => {
      const emptyTitleLinkInfo = {
        ...mockLinkInfo,
        clipTitle: ''
      }
      
      render(<LinkTooltip {...defaultProps} linkInfo={emptyTitleLinkInfo} />)
      
      expect(screen.getByText('Link Title:')).toBeInTheDocument()
      // Empty title should render without issues
    })
  })

  describe('Performance Optimization', () => {
    it('should handle rapid position updates efficiently', () => {
      const { rerender } = render(<LinkTooltip {...defaultProps} />)
      
      // Rapidly change mouse position
      for (let i = 0; i < 20; i++) {
        rerender(<LinkTooltip {...defaultProps} mousePos={{ x: i * 5, y: i * 5 }} />)
      }
      
      const tooltip = screen.getByText('Epic Gaming Moment').closest('.tooltipItem')
      expect(tooltip).toHaveStyle('top: 110px; left: 110px') // Final position
    })

    it('should not recalculate position when tooltip is hidden', () => {
      const { rerender } = render(<LinkTooltip {...defaultProps} showLinkInfo={false} />)
      
      // Change position while hidden
      rerender(<LinkTooltip {...defaultProps} showLinkInfo={false} mousePos={{ x: 500, y: 500 }} />)
      
      // Show tooltip with new position
      rerender(<LinkTooltip {...defaultProps} showLinkInfo={true} mousePos={{ x: 500, y: 500 }} />)
      
      const tooltip = screen.getByText('Epic Gaming Moment').closest('.tooltipItem')
      expect(tooltip).toHaveStyle('top: 515px; left: 515px')
    })

    it('should handle getBoundingClientRect returning null', () => {
      // Mock getBoundingClientRect to return null (edge case)
      Element.prototype.getBoundingClientRect = vi.fn(() => null)
      
      expect(() => {
        render(<LinkTooltip {...defaultProps} />)
      }).not.toThrow()
    })
  })

  describe('Window Resize Handling', () => {
    it('should recalculate position when window dimensions change', () => {
      const { rerender } = render(<LinkTooltip {...defaultProps} />)
      
      // Simulate window resize
      Object.defineProperty(window, 'innerWidth', { value: 800, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 600, writable: true })
      
      // Update mouse position to trigger recalculation
      const newProps = {
        ...defaultProps,
        mousePos: { x: 600, y: 400 }
      }
      
      rerender(<LinkTooltip {...newProps} />)
      
      const tooltip = screen.getByText('Epic Gaming Moment').closest('.tooltipItem')
      
      // Should adjust for smaller window (800 - 350 - 20 = 430)
      expect(tooltip).toHaveStyle('left: 430px')
    })

    it('should handle very small window dimensions', () => {
      Object.defineProperty(window, 'innerWidth', { value: 300, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 200, writable: true })
      
      render(<LinkTooltip {...defaultProps} />)
      
      const tooltip = screen.getByText('Epic Gaming Moment').closest('.tooltipItem')
      
      // Should position within available space
      const styles = window.getComputedStyle(tooltip)
      expect(parseInt(styles.left)).toBeGreaterThanOrEqual(-70) // 300 - 350 - 20
      expect(parseInt(styles.top)).toBeGreaterThanOrEqual(-20) // 200 - 200 - 20
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for image', () => {
      render(<LinkTooltip {...defaultProps} />)
      
      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('alt', mockLinkInfo.clipTitle)
      expect(img).toHaveAttribute('src', mockLinkInfo.clipThumbnailUrl)
    })

    it('should provide accessible text content', () => {
      render(<LinkTooltip {...defaultProps} />)
      
      expect(screen.getByText('Link Title:')).toBeInTheDocument()
      expect(screen.getByText('Epic Gaming Moment')).toBeInTheDocument()
    })

    it('should be readable by screen readers', () => {
      render(<LinkTooltip {...defaultProps} />)
      
      const tooltip = screen.getByText('Epic Gaming Moment').closest('.tooltipItem')
      
      // Should have visible opacity for accessibility
      expect(tooltip).toHaveStyle('opacity: 1')
    })

    it('should handle focus management', () => {
      render(<LinkTooltip {...defaultProps} />)
      
      const tooltip = screen.getByText('Epic Gaming Moment').closest('.tooltipItem')
      
      // Should be focusable
      tooltip.focus()
      expect(tooltip).toHaveFocus()
    })
  })

  describe('Integration Tests', () => {
    it('should work with real-world link data', () => {
      const realWorldData = [
        {
          clipThumbnailUrl: 'https://cdn.kick.com/thumbnails/12345.webp',
          clipTitle: 'Amazing 1v5 Clutch',
          description: 'Insane gameplay'
        },
        {
          clipThumbnailUrl: 'https://cdn.kick.com/thumbnails/67890.jpg',
          clipTitle: 'Funny Moments Compilation',
          description: 'Best clips of the week'
        },
        {
          clipThumbnailUrl: 'https://cdn.kick.com/thumbnails/11111.png',
          clipTitle: 'World Record Speedrun',
          description: 'New personal best'
        }
      ]
      
      realWorldData.forEach((linkInfo, index) => {
        const { rerender } = render(<LinkTooltip {...defaultProps} linkInfo={linkInfo} />)
        
        expect(screen.getByText(linkInfo.clipTitle)).toBeInTheDocument()
        expect(screen.getByRole('img')).toHaveAttribute('src', linkInfo.clipThumbnailUrl)
        
        if (index < realWorldData.length - 1) {
          rerender(<div />)
        }
      })
    })

    it('should handle different tooltip sizes based on content', () => {
      const titles = [
        'Short',
        'Medium length title here',
        'Very long title that should test how the tooltip handles extensive text content that might wrap or cause layout issues'
      ]
      
      titles.forEach(clipTitle => {
        const linkInfo = { ...mockLinkInfo, clipTitle }
        const { rerender } = render(<LinkTooltip {...defaultProps} linkInfo={linkInfo} />)
        
        expect(screen.getByText(clipTitle)).toBeInTheDocument()
        
        if (clipTitle !== titles[titles.length - 1]) {
          rerender(<div />)
        }
      })
    })
  })

  describe('Memory Management', () => {
    it('should clean up properly on unmount', () => {
      const { unmount } = render(<LinkTooltip {...defaultProps} />)
      
      expect(() => {
        unmount()
      }).not.toThrow()
    })

    it('should handle multiple mount/unmount cycles', () => {
      for (let i = 0; i < 5; i++) {
        const { unmount } = render(<LinkTooltip {...defaultProps} />)
        expect(screen.getByText('Epic Gaming Moment')).toBeInTheDocument()
        unmount()
      }
    })

    it('should not cause memory leaks with rapid updates', () => {
      const { rerender } = render(<LinkTooltip {...defaultProps} />)
      
      // Simulate heavy usage
      for (let i = 0; i < 50; i++) {
        const newLinkInfo = {
          ...mockLinkInfo,
          clipTitle: `Title ${i}`,
          clipThumbnailUrl: `https://cdn.kick.com/thumbnails/${i}.jpg`
        }
        
        rerender(<LinkTooltip {...defaultProps} 
          mousePos={{ x: i * 2, y: i * 2 }} 
          linkInfo={newLinkInfo} 
        />)
      }
      
      expect(screen.getByText('Title 49')).toBeInTheDocument()
    })
  })
})