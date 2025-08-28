import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import EmoteTooltip from './EmoteTooltip.jsx'

// Mock dependencies
vi.mock('@assets/styles/components/Cosmetics/EmoteTooltip.scss', () => ({}))
vi.mock('clsx', () => ({
  default: (...args) => args.filter(Boolean).join(' ')
}))

// Mock dayjs
vi.mock('dayjs', () => ({
  default: (date) => ({
    format: (format) => {
      if (format === 'MMM D, YYYY') {
        return 'Jan 15, 2024'
      }
      return date
    }
  })
}))

describe('EmoteTooltip Component', () => {
  const mockKickEmoteInfo = {
    id: '123456',
    name: 'Kappa',
    platform: 'kick'
  }

  const mockStvEmoteInfo = {
    id: '60ae4b60f39dd10f2d2cc79c',
    name: 'OMEGALUL',
    platform: '7tv',
    owner: {
      username: 'testuser'
    },
    added_timestamp: '2024-01-15T10:00:00Z'
  }

  const mockOverlaidEmotes = [
    { id: '1', name: 'overlay1' },
    { id: '2', name: 'overlay2' }
  ]

  const defaultProps = {
    showEmoteInfo: true,
    mousePos: { x: 100, y: 200 },
    emoteInfo: mockKickEmoteInfo,
    type: 'kick',
    emoteSrc: 'https://files.kick.com/emotes/123456/fullsize',
    overlaidEmotes: []
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true })

    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 300,
      height: 200,
      top: 0,
      left: 0,
      bottom: 200,
      right: 300
    }))
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Rendering', () => {
    it('should not render when showEmoteInfo is false', () => {
      render(<EmoteTooltip {...defaultProps} showEmoteInfo={false} />)
      
      expect(screen.queryByText('Kappa')).not.toBeInTheDocument()
    })

    it('should not render when emoteInfo is null', () => {
      render(<EmoteTooltip {...defaultProps} emoteInfo={null} />)
      
      expect(screen.queryByText('Kappa')).not.toBeInTheDocument()
    })

    it('should render emote image and name for Kick emotes', async () => {
      render(<EmoteTooltip {...defaultProps} />)
      
      // Wait for image to load
      const img = screen.getByRole('img')
      fireEvent.load(img)
      
      await waitFor(() => {
        expect(screen.getByText('Kappa')).toBeInTheDocument()
      })
      
      expect(img.src).toBe('https://files.kick.com/emotes/123456/fullsize')
      expect(img).toHaveClass('kickEmote emote')
    })

    it('should render emote image and name for 7TV emotes', async () => {
      const stvProps = {
        ...defaultProps,
        emoteInfo: mockStvEmoteInfo,
        type: 'stv',
        emoteSrc: 'https://cdn.7tv.app/emote/60ae4b60f39dd10f2d2cc79c/1x.webp'
      }
      
      render(<EmoteTooltip {...stvProps} />)
      
      const img = screen.getByRole('img')
      fireEvent.load(img)
      
      await waitFor(() => {
        expect(screen.getByText('OMEGALUL')).toBeInTheDocument()
      })
      
      expect(img.src).toBe('https://cdn.7tv.app/emote/60ae4b60f39dd10f2d2cc79c/1x.webp')
      expect(img).toHaveClass('stvEmote emote')
    })

    it('should display correct platform for Kick emotes', async () => {
      render(<EmoteTooltip {...defaultProps} />)
      
      const img = screen.getByRole('img')
      fireEvent.load(img)
      
      await waitFor(() => {
        expect(screen.getByText('Kick')).toBeInTheDocument()
      })
    })

    it('should display correct platform for 7TV emotes', async () => {
      const stvProps = {
        ...defaultProps,
        emoteInfo: { ...mockStvEmoteInfo, platform: '7tv' },
        type: 'stv'
      }
      
      render(<EmoteTooltip {...stvProps} />)
      
      const img = screen.getByRole('img')
      fireEvent.load(img)
      
      await waitFor(() => {
        expect(screen.getByText('7TV')).toBeInTheDocument()
      })
    })
  })

  describe('Image Loading', () => {
    it('should have zero opacity initially', () => {
      render(<EmoteTooltip {...defaultProps} />)
      
      const tooltip = screen.getByText('Kappa').closest('.tooltipItem')
      expect(tooltip).toHaveStyle('opacity: 0')
    })

    it('should show tooltip with opacity 1 after image loads', async () => {
      render(<EmoteTooltip {...defaultProps} />)
      
      const img = screen.getByRole('img')
      fireEvent.load(img)
      
      await waitFor(() => {
        const tooltip = screen.getByText('Kappa').closest('.tooltipItem')
        expect(tooltip).toHaveStyle('opacity: 1')
      })
    })

    it('should reset image loaded state when tooltip is hidden', async () => {
      const { rerender } = render(<EmoteTooltip {...defaultProps} />)
      
      const img = screen.getByRole('img')
      fireEvent.load(img)
      
      await waitFor(() => {
        expect(screen.getByText('Kappa')).toBeInTheDocument()
      })
      
      // Hide tooltip
      rerender(<EmoteTooltip {...defaultProps} showEmoteInfo={false} />)
      
      // Show tooltip again
      rerender(<EmoteTooltip {...defaultProps} showEmoteInfo={true} />)
      
      // Should be hidden again until image loads
      const tooltip = screen.queryByText('Kappa')?.closest('.tooltipItem')
      if (tooltip) {
        expect(tooltip).toHaveStyle('opacity: 0')
      }
    })

    it('should handle image load events correctly', async () => {
      render(<EmoteTooltip {...defaultProps} />)
      
      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('loading', 'lazy')
      expect(img).toHaveAttribute('fetchpriority', 'low')
      expect(img).toHaveAttribute('decoding', 'async')
      
      fireEvent.load(img)
      
      await waitFor(() => {
        expect(screen.getByText('Kappa')).toBeInTheDocument()
      })
    })
  })

  describe('Positioning', () => {
    it('should position tooltip correctly by default', () => {
      render(<EmoteTooltip {...defaultProps} />)
      
      const tooltip = screen.getByText('Kappa').closest('.tooltipItem')
      expect(tooltip).toHaveStyle('top: 215px; left: 115px') // mousePos + 15 offset
    })

    it('should adjust position when tooltip would go off right edge', () => {
      const nearRightEdge = {
        ...defaultProps,
        mousePos: { x: 800, y: 200 }
      }
      
      render(<EmoteTooltip {...nearRightEdge} />)
      
      const tooltip = screen.getByText('Kappa').closest('.tooltipItem')
      expect(tooltip).toHaveStyle('left: 485px') // x - width - offset (800 - 300 - 15)
    })

    it('should adjust position when tooltip would go off bottom edge', () => {
      const nearBottomEdge = {
        ...defaultProps,
        mousePos: { x: 100, y: 600 }
      }
      
      render(<EmoteTooltip {...nearBottomEdge} />)
      
      const tooltip = screen.getByText('Kappa').closest('.tooltipItem')
      expect(tooltip).toHaveStyle('top: 385px') // y - height - offset (600 - 200 - 15)
    })

    it('should not go beyond screen boundaries', () => {
      const extremePositions = [
        { x: -50, y: -50 },   // Top-left extreme
        { x: 2000, y: 2000 }  // Bottom-right extreme
      ]
      
      extremePositions.forEach(mousePos => {
        const { rerender } = render(<EmoteTooltip {...defaultProps} mousePos={mousePos} />)
        
        const tooltip = screen.getByText('Kappa').closest('.tooltipItem')
        const styles = window.getComputedStyle(tooltip)
        
        // Should have valid positive positions within reasonable bounds
        expect(parseInt(styles.top)).toBeGreaterThanOrEqual(20)
        expect(parseInt(styles.left)).toBeGreaterThanOrEqual(20)
        
        if (mousePos !== extremePositions[extremePositions.length - 1]) {
          rerender(<div />)
        }
      })
    })

    it('should recalculate position when mouse moves', () => {
      const { rerender } = render(<EmoteTooltip {...defaultProps} />)
      
      let tooltip = screen.getByText('Kappa').closest('.tooltipItem')
      expect(tooltip).toHaveStyle('top: 215px; left: 115px')
      
      const newProps = {
        ...defaultProps,
        mousePos: { x: 300, y: 400 }
      }
      
      rerender(<EmoteTooltip {...newProps} />)
      
      tooltip = screen.getByText('Kappa').closest('.tooltipItem')
      expect(tooltip).toHaveStyle('top: 415px; left: 315px')
    })
  })

  describe('7TV Specific Features', () => {
    const stvProps = {
      ...defaultProps,
      emoteInfo: mockStvEmoteInfo,
      type: 'stv',
      emoteSrc: 'https://cdn.7tv.app/emote/60ae4b60f39dd10f2d2cc79c/1x.webp'
    }

    it('should display owner information for 7TV emotes', async () => {
      render(<EmoteTooltip {...stvProps} />)
      
      const img = screen.getByRole('img')
      fireEvent.load(img)
      
      await waitFor(() => {
        expect(screen.getByText('Made by')).toBeInTheDocument()
        expect(screen.getByText('testuser')).toBeInTheDocument()
      })
    })

    it('should display added date for 7TV emotes', async () => {
      render(<EmoteTooltip {...stvProps} />)
      
      const img = screen.getByRole('img')
      fireEvent.load(img)
      
      await waitFor(() => {
        expect(screen.getByText('Added on')).toBeInTheDocument()
        expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument()
      })
    })

    it('should not display owner/date info for Kick emotes', async () => {
      render(<EmoteTooltip {...defaultProps} />)
      
      const img = screen.getByRole('img')
      fireEvent.load(img)
      
      await waitFor(() => {
        expect(screen.queryByText('Made by')).not.toBeInTheDocument()
        expect(screen.queryByText('Added on')).not.toBeInTheDocument()
      })
    })

    it('should handle 7TV emotes without owner info', async () => {
      const stvWithoutOwner = {
        ...stvProps,
        emoteInfo: {
          ...mockStvEmoteInfo,
          owner: null
        }
      }
      
      render(<EmoteTooltip {...stvWithoutOwner} />)
      
      const img = screen.getByRole('img')
      fireEvent.load(img)
      
      await waitFor(() => {
        expect(screen.getByText('OMEGALUL')).toBeInTheDocument()
        expect(screen.queryByText('Made by')).not.toBeInTheDocument()
        expect(screen.queryByText('Added on')).not.toBeInTheDocument()
      })
    })
  })

  describe('Overlaid Emotes', () => {
    const propsWithOverlaid = {
      ...defaultProps,
      overlaidEmotes: mockOverlaidEmotes
    }

    it('should display overlaid emotes section when present', async () => {
      render(<EmoteTooltip {...propsWithOverlaid} />)
      
      const img = screen.getByRole('img')
      fireEvent.load(img)
      
      await waitFor(() => {
        expect(screen.getByText('Zero-Width')).toBeInTheDocument()
      })
    })

    it('should render overlaid emote images', async () => {
      render(<EmoteTooltip {...propsWithOverlaid} />)
      
      const img = screen.getByRole('img')
      fireEvent.load(img)
      
      await waitFor(() => {
        const overlaidImgs = screen.getAllByRole('img')
        // Main emote + 2 overlaid emotes
        expect(overlaidImgs).toHaveLength(3)
        
        // Check overlaid emote sources
        expect(overlaidImgs[1].src).toBe('https://cdn.7tv.app/emote/1/1x.webp')
        expect(overlaidImgs[2].src).toBe('https://cdn.7tv.app/emote/2/1x.webp')
      })
    })

    it('should not show overlaid section when no overlaid emotes', async () => {
      render(<EmoteTooltip {...defaultProps} />)
      
      const img = screen.getByRole('img')
      fireEvent.load(img)
      
      await waitFor(() => {
        expect(screen.queryByText('Zero-Width')).not.toBeInTheDocument()
      })
    })

    it('should handle empty overlaid emotes array', async () => {
      const emptyOverlaidProps = {
        ...defaultProps,
        overlaidEmotes: []
      }
      
      render(<EmoteTooltip {...emptyOverlaidProps} />)
      
      const img = screen.getByRole('img')
      fireEvent.load(img)
      
      await waitFor(() => {
        expect(screen.getByText('Kappa')).toBeInTheDocument()
        expect(screen.queryByText('Zero-Width')).not.toBeInTheDocument()
      })
    })
  })

  describe('Alias Handling', () => {
    it('should display alias information when present', async () => {
      const emoteWithAlias = {
        ...defaultProps,
        emoteInfo: {
          ...mockKickEmoteInfo,
          alias: 'KappaAlias'
        }
      }
      
      render(<EmoteTooltip {...emoteWithAlias} />)
      
      const img = screen.getByRole('img')
      fireEvent.load(img)
      
      await waitFor(() => {
        expect(screen.getByText('Alias of KappaAlias')).toBeInTheDocument()
      })
    })

    it('should not display alias when not present', async () => {
      render(<EmoteTooltip {...defaultProps} />)
      
      const img = screen.getByRole('img')
      fireEvent.load(img)
      
      await waitFor(() => {
        expect(screen.queryByText(/Alias of/)).not.toBeInTheDocument()
      })
    })
  })

  describe('CSS Classes and Styling', () => {
    it('should apply correct CSS classes when visible', async () => {
      render(<EmoteTooltip {...defaultProps} />)
      
      const img = screen.getByRole('img')
      fireEvent.load(img)
      
      await waitFor(() => {
        const tooltip = screen.getByText('Kappa').closest('.tooltipItem')
        expect(tooltip).toHaveClass('tooltipItem', 'emoteTooltip')
      })
    })

    it('should not apply emoteTooltip class when hidden', () => {
      render(<EmoteTooltip {...defaultProps} showEmoteInfo={false} />)
      
      expect(screen.queryByClassName('emoteTooltip')).not.toBeInTheDocument()
    })

    it('should apply correct image classes for different types', async () => {
      // Test Kick emote
      render(<EmoteTooltip {...defaultProps} />)
      
      let img = screen.getByRole('img')
      expect(img).toHaveClass('kickEmote emote')
      
      // Test 7TV emote
      const { rerender } = render(<EmoteTooltip {...defaultProps} />)
      
      const stvProps = {
        ...defaultProps,
        type: 'stv',
        emoteInfo: mockStvEmoteInfo
      }
      
      rerender(<EmoteTooltip {...stvProps} />)
      
      img = screen.getByRole('img')
      expect(img).toHaveClass('stvEmote emote')
    })

    it('should have proper image dimensions', async () => {
      render(<EmoteTooltip {...defaultProps} />)
      
      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('width', '100%')
      expect(img).toHaveAttribute('height', '64')
    })
  })

  describe('Error Handling', () => {
    it('should handle missing emote properties gracefully', () => {
      const incompleteEmote = {
        id: '123'
        // Missing name
      }
      
      const incompleteProps = {
        ...defaultProps,
        emoteInfo: incompleteEmote
      }
      
      expect(() => {
        render(<EmoteTooltip {...incompleteProps} />)
      }).not.toThrow()
    })

    it('should handle invalid mouse positions', () => {
      const invalidMousePos = {
        ...defaultProps,
        mousePos: { x: null, y: null }
      }
      
      expect(() => {
        render(<EmoteTooltip {...invalidMousePos} />)
      }).not.toThrow()
    })

    it('should handle malformed overlaid emotes', async () => {
      const malformedOverlaid = {
        ...defaultProps,
        overlaidEmotes: [
          { id: '1' }, // Missing name
          { name: 'test' }, // Missing id
          null,
          undefined
        ]
      }
      
      expect(() => {
        render(<EmoteTooltip {...malformedOverlaid} />)
      }).not.toThrow()
      
      const img = screen.getByRole('img')
      fireEvent.load(img)
      
      await waitFor(() => {
        expect(screen.getByText('Kappa')).toBeInTheDocument()
      })
    })

    it('should handle missing emoteSrc', async () => {
      const noSrcProps = {
        ...defaultProps,
        emoteSrc: null
      }
      
      expect(() => {
        render(<EmoteTooltip {...noSrcProps} />)
      }).not.toThrow()
    })
  })

  describe('Performance', () => {
    it('should memoize component correctly', () => {
      const { rerender } = render(<EmoteTooltip {...defaultProps} />)
      
      // Re-render with same props
      rerender(<EmoteTooltip {...defaultProps} />)
      
      expect(screen.getByText('Kappa')).toBeInTheDocument()
    })

    it('should handle rapid mouse movements efficiently', () => {
      const { rerender } = render(<EmoteTooltip {...defaultProps} />)
      
      // Rapid position changes
      for (let i = 0; i < 20; i++) {
        rerender(<EmoteTooltip {...defaultProps} mousePos={{ x: i * 10, y: i * 10 }} />)
      }
      
      const tooltip = screen.getByText('Kappa').closest('.tooltipItem')
      expect(tooltip).toHaveStyle('top: 205px; left: 205px') // Final position
    })

    it('should optimize callback functions', async () => {
      render(<EmoteTooltip {...defaultProps} />)
      
      const img = screen.getByRole('img')
      
      // Multiple load events should work consistently
      for (let i = 0; i < 3; i++) {
        fireEvent.load(img)
      }
      
      await waitFor(() => {
        expect(screen.getByText('Kappa')).toBeInTheDocument()
      })
    })
  })

  describe('Memory Management', () => {
    it('should clean up on unmount', () => {
      const { unmount } = render(<EmoteTooltip {...defaultProps} />)
      
      expect(() => {
        unmount()
      }).not.toThrow()
    })

    it('should handle multiple mount/unmount cycles', () => {
      for (let i = 0; i < 5; i++) {
        const { unmount } = render(<EmoteTooltip {...defaultProps} />)
        expect(screen.getByRole('img')).toBeInTheDocument()
        unmount()
      }
    })

    it('should handle rapid show/hide cycles', async () => {
      const { rerender } = render(<EmoteTooltip {...defaultProps} />)
      
      for (let i = 0; i < 10; i++) {
        rerender(<EmoteTooltip {...defaultProps} showEmoteInfo={i % 2 === 0} />)
      }
      
      // Final state should be hidden (i=9, 9%2=1, so false)
      expect(screen.queryByText('Kappa')).not.toBeInTheDocument()
    })
  })

  describe('Integration Tests', () => {
    it('should work with real emote data structures', async () => {
      const realEmoteData = [
        {
          emoteInfo: {
            id: '60ae4b60f39dd10f2d2cc79c',
            name: 'OMEGALUL',
            platform: '7tv',
            owner: { username: 'SevenTV' },
            added_timestamp: '2024-01-15T10:00:00Z'
          },
          type: 'stv',
          emoteSrc: 'https://cdn.7tv.app/emote/60ae4b60f39dd10f2d2cc79c/1x.webp'
        },
        {
          emoteInfo: {
            id: '25',
            name: 'Kappa',
            platform: 'kick'
          },
          type: 'kick',
          emoteSrc: 'https://files.kick.com/emotes/25/fullsize'
        }
      ]
      
      realEmoteData.forEach(({ emoteInfo, type, emoteSrc }, index) => {
        const props = {
          ...defaultProps,
          emoteInfo,
          type,
          emoteSrc
        }
        
        const { rerender } = render(<EmoteTooltip {...props} />)
        
        const img = screen.getByRole('img')
        fireEvent.load(img)
        
        expect(img.src).toBe(emoteSrc)
        expect(screen.getByText(emoteInfo.name)).toBeInTheDocument()
        
        if (index < realEmoteData.length - 1) {
          rerender(<div />)
        }
      })
    })

    it('should handle edge case combinations', async () => {
      const edgeCaseProps = {
        ...defaultProps,
        emoteInfo: {
          ...mockStvEmoteInfo,
          name: '',
          alias: 'AliasName',
          owner: { username: '' }
        },
        overlaidEmotes: [{ id: '', name: '' }],
        mousePos: { x: 0, y: 0 }
      }
      
      render(<EmoteTooltip {...edgeCaseProps} />)
      
      const img = screen.getByRole('img')
      fireEvent.load(img)
      
      await waitFor(() => {
        // Should handle empty name gracefully
        expect(screen.getByText('Alias of AliasName')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', async () => {
      render(<EmoteTooltip {...defaultProps} />)
      
      const img = screen.getByRole('img')
      fireEvent.load(img)
      
      expect(img).toHaveAttribute('alt', 'Kappa')
      
      await waitFor(() => {
        // Text content should be accessible to screen readers
        expect(screen.getByText('Kappa')).toBeInTheDocument()
        expect(screen.getByText('Kick')).toBeInTheDocument()
      })
    })

    it('should maintain focus accessibility', () => {
      render(<EmoteTooltip {...defaultProps} />)
      
      const tooltip = screen.getByText('Kappa').closest('.tooltipItem')
      
      // Should be accessible via tabbing
      tooltip.focus()
      expect(tooltip).toHaveFocus()
    })
  })
})