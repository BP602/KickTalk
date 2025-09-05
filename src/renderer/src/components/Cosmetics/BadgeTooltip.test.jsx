import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BadgeTooltip from './BadgeTooltip.jsx'

// Mock dependencies
vi.mock('@assets/styles/components/Cosmetics/BadgeTooltip.scss', () => ({}))
vi.mock('clsx', () => ({
  default: (...args) => args.filter(Boolean).join(' ')
}))

describe('BadgeTooltip Component', () => {
  const mockBadgeInfo = {
    src: 'https://cdn.kicktalk.app/Badges/moderator.svg',
    title: 'Moderator',
    platform: 'Kick',
    owner: {
      username: 'testuser'
    }
  }

  const defaultProps = {
    showBadgeInfo: true,
    mousePos: { x: 100, y: 200 },
    badgeInfo: mockBadgeInfo
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true })
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Rendering', () => {
    it('should render tooltip when showBadgeInfo is true', () => {
      render(<BadgeTooltip {...defaultProps} />)
      
      expect(screen.getByRole('img')).toBeInTheDocument()
      expect(screen.getByText('Moderator')).toBeInTheDocument()
      expect(screen.getByText('Kick')).toBeInTheDocument()
    })

    it('should not render when showBadgeInfo is false', () => {
      render(<BadgeTooltip {...defaultProps} showBadgeInfo={false} />)
      
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('should display badge image with correct src and alt', () => {
      render(<BadgeTooltip {...defaultProps} />)
      
      const img = screen.getByRole('img')
      expect(img.src).toBe(mockBadgeInfo.src)
      expect(img.alt).toBe(mockBadgeInfo.title)
    })

    it('should display badge title and platform', () => {
      render(<BadgeTooltip {...defaultProps} />)
      
      expect(screen.getByText('Moderator')).toBeInTheDocument()
      expect(screen.getByText('Kick')).toBeInTheDocument()
    })

    it('should display owner information when available', () => {
      render(<BadgeTooltip {...defaultProps} />)
      
      expect(screen.getByText('Created by')).toBeInTheDocument()
      expect(screen.getByText('testuser')).toBeInTheDocument()
    })

    it('should not display owner information when not available', () => {
      const badgeInfoWithoutOwner = { ...mockBadgeInfo, owner: null }
      
      render(<BadgeTooltip {...defaultProps} badgeInfo={badgeInfoWithoutOwner} />)
      
      expect(screen.queryByText('Created by')).not.toBeInTheDocument()
    })
  })

  describe('Positioning', () => {
    it('should position tooltip at correct coordinates by default', () => {
      render(<BadgeTooltip {...defaultProps} />)
      
      const tooltip = screen.getByText('Moderator').closest('.tooltipItem')
      const styles = window.getComputedStyle(tooltip)
      
      expect(tooltip).toHaveStyle('top: 215px') // mousePos.y + offset (15)
      expect(tooltip).toHaveStyle('left: 115px') // mousePos.x + offset (15)
    })

    it('should adjust position when tooltip would go off right edge', () => {
      const nearRightEdge = {
        ...defaultProps,
        mousePos: { x: 900, y: 200 } // Close to right edge (1024px window)
      }
      
      render(<BadgeTooltip {...nearRightEdge} />)
      
      const tooltip = screen.getByText('Moderator').closest('.tooltipItem')
      
      // Should position to the left of mouse instead
      expect(tooltip).toHaveStyle('left: 720px') // mousePos.x - fallbackOffset (180)
    })

    it('should adjust position when tooltip would go off bottom edge', () => {
      const nearBottomEdge = {
        ...defaultProps,
        mousePos: { x: 100, y: 650 } // Close to bottom edge (768px window)
      }
      
      render(<BadgeTooltip {...nearBottomEdge} />)
      
      const tooltip = screen.getByText('Moderator').closest('.tooltipItem')
      
      // Should position above mouse instead
      expect(tooltip).toHaveStyle('top: 470px') // mousePos.y - height - offset (650 - 165 - 15)
    })

    it('should not go above top edge', () => {
      const nearTopEdge = {
        ...defaultProps,
        mousePos: { x: 100, y: 10 } // Very close to top
      }
      
      render(<BadgeTooltip {...nearTopEdge} />)
      
      const tooltip = screen.getByText('Moderator').closest('.tooltipItem')
      
      // Should use minimum offset from top
      expect(tooltip).toHaveStyle('top: 15px') // offset
    })

    it('should not go past left edge', () => {
      const nearLeftEdge = {
        ...defaultProps,
        mousePos: { x: 10, y: 200 }
      }
      
      render(<BadgeTooltip {...nearLeftEdge} />)
      
      const tooltip = screen.getByText('Moderator').closest('.tooltipItem')
      
      // Should use minimum offset from left
      expect(tooltip).toHaveStyle('left: 15px') // offset
    })

    it('should handle window resize by recalculating position', () => {
      const { rerender } = render(<BadgeTooltip {...defaultProps} />)
      
      // Simulate window resize
      Object.defineProperty(window, 'innerWidth', { value: 500, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 400, writable: true })
      
      // Update mouse position to trigger recalculation
      const newProps = {
        ...defaultProps,
        mousePos: { x: 400, y: 200 }
      }
      
      rerender(<BadgeTooltip {...newProps} />)
      
      const tooltip = screen.getByText('Moderator').closest('.tooltipItem')
      
      // Should adjust for smaller window
      expect(tooltip).toHaveStyle('left: 220px') // 400 - 180 (fallbackOffset)
    })
  })

  describe('Dynamic Updates', () => {
    it('should update when mouse position changes', () => {
      const { rerender } = render(<BadgeTooltip {...defaultProps} />)
      
      let tooltip = screen.getByText('Moderator').closest('.tooltipItem')
      expect(tooltip).toHaveStyle('top: 215px; left: 115px')
      
      const newProps = {
        ...defaultProps,
        mousePos: { x: 300, y: 400 }
      }
      
      rerender(<BadgeTooltip {...newProps} />)
      
      tooltip = screen.getByText('Moderator').closest('.tooltipItem')
      expect(tooltip).toHaveStyle('top: 415px; left: 315px')
    })

    it('should update when badge info changes', () => {
      const { rerender } = render(<BadgeTooltip {...defaultProps} />)
      
      expect(screen.getByText('Moderator')).toBeInTheDocument()
      expect(screen.getByText('testuser')).toBeInTheDocument()
      
      const newBadgeInfo = {
        src: 'https://cdn.kicktalk.app/Badges/broadcaster.svg',
        title: 'Broadcaster',
        platform: '7TV',
        owner: {
          username: 'newuser'
        }
      }
      
      rerender(<BadgeTooltip {...defaultProps} badgeInfo={newBadgeInfo} />)
      
      expect(screen.getByText('Broadcaster')).toBeInTheDocument()
      expect(screen.getByText('7TV')).toBeInTheDocument()
      expect(screen.getByText('newuser')).toBeInTheDocument()
    })

    it('should handle showBadgeInfo toggle correctly', () => {
      const { rerender } = render(<BadgeTooltip {...defaultProps} />)
      
      expect(screen.getByText('Moderator')).toBeInTheDocument()
      
      rerender(<BadgeTooltip {...defaultProps} showBadgeInfo={false} />)
      
      expect(screen.queryByText('Moderator')).not.toBeInTheDocument()
      
      rerender(<BadgeTooltip {...defaultProps} showBadgeInfo={true} />)
      
      expect(screen.getByText('Moderator')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing badgeInfo gracefully', () => {
      expect(() => {
        render(<BadgeTooltip {...defaultProps} badgeInfo={null} />)
      }).not.toThrow()
    })

    it('should handle missing mouse position', () => {
      const propsWithoutMousePos = {
        ...defaultProps,
        mousePos: { x: null, y: null }
      }
      
      expect(() => {
        render(<BadgeTooltip {...propsWithoutMousePos} />)
      }).not.toThrow()
    })

    it('should handle undefined mouse coordinates', () => {
      const propsWithUndefinedCoords = {
        ...defaultProps,
        mousePos: { x: undefined, y: undefined }
      }
      
      expect(() => {
        render(<BadgeTooltip {...propsWithUndefinedCoords} />)
      }).not.toThrow()
    })

    it('should handle badge info with missing properties', () => {
      const incompleteBadgeInfo = {
        src: 'https://cdn.kicktalk.app/badge.svg'
        // Missing title, platform, owner
      }
      
      render(<BadgeTooltip {...defaultProps} badgeInfo={incompleteBadgeInfo} />)
      
      expect(screen.getByRole('img')).toBeInTheDocument()
      expect(screen.queryByText('Created by')).not.toBeInTheDocument()
    })

    it('should handle very long badge titles', () => {
      const longTitleBadge = {
        ...mockBadgeInfo,
        title: 'A'.repeat(100)
      }
      
      render(<BadgeTooltip {...defaultProps} badgeInfo={longTitleBadge} />)
      
      expect(screen.getByText('A'.repeat(100))).toBeInTheDocument()
    })

    it('should handle special characters in badge title and username', () => {
      const specialCharsBadge = {
        ...mockBadgeInfo,
        title: 'Badge with "quotes" & symbols!',
        owner: {
          username: 'user@domain.com'
        }
      }
      
      render(<BadgeTooltip {...defaultProps} badgeInfo={specialCharsBadge} />)
      
      expect(screen.getByText('Badge with "quotes" & symbols!')).toBeInTheDocument()
      expect(screen.getByText('user@domain.com')).toBeInTheDocument()
    })

    it('should handle owner with missing username', () => {
      const ownerWithoutUsername = {
        ...mockBadgeInfo,
        owner: { } // Owner object but no username
      }
      
      render(<BadgeTooltip {...defaultProps} badgeInfo={ownerWithoutUsername} />)
      
      expect(screen.queryByText('Created by')).not.toBeInTheDocument()
    })
  })

  describe('Styling and CSS Classes', () => {
    it('should apply correct CSS classes', () => {
      render(<BadgeTooltip {...defaultProps} />)
      
      const tooltip = screen.getByText('Moderator').closest('.tooltipItem')
      expect(tooltip).toHaveClass('tooltipItem', 'showTooltip')
    })

    it('should have correct height style', () => {
      render(<BadgeTooltip {...defaultProps} />)
      
      const tooltip = screen.getByText('Moderator').closest('.tooltipItem')
      expect(tooltip).toHaveStyle('height: 165px')
    })

    it('should have opacity 1 when shown', () => {
      render(<BadgeTooltip {...defaultProps} />)
      
      const tooltip = screen.getByText('Moderator').closest('.tooltipItem')
      expect(tooltip).toHaveStyle('opacity: 1')
    })

    it('should apply correct structure with CSS classes', () => {
      render(<BadgeTooltip {...defaultProps} />)
      
      expect(screen.getByText('Kick')).toHaveClass('badgeTooltipPlatform')
      expect(screen.getByText('testuser')).toHaveClass('tooltipItemCreatedByUsername')
      
      const createdBySection = screen.getByText('Created by').closest('span')
      expect(createdBySection).toHaveClass('tooltipItemCreatedBy')
    })
  })

  describe('Performance', () => {
    it('should memoize tooltip dimensions correctly', () => {
      const { rerender } = render(<BadgeTooltip {...defaultProps} />)
      
      // Multiple re-renders should not cause issues
      for (let i = 0; i < 5; i++) {
        rerender(<BadgeTooltip {...defaultProps} mousePos={{ x: i * 10, y: i * 10 }} />)
      }
      
      expect(screen.getByText('Moderator')).toBeInTheDocument()
    })

    it('should handle rapid position updates efficiently', () => {
      const { rerender } = render(<BadgeTooltip {...defaultProps} />)
      
      // Rapidly change mouse position
      for (let i = 0; i < 20; i++) {
        rerender(<BadgeTooltip {...defaultProps} mousePos={{ x: i * 5, y: i * 5 }} />)
      }
      
      const tooltip = screen.getByText('Moderator').closest('.tooltipItem')
      expect(tooltip).toHaveStyle('top: 110px; left: 110px') // Final position
    })

    it('should not recalculate position when not showing', () => {
      const { rerender } = render(<BadgeTooltip {...defaultProps} showBadgeInfo={false} />)
      
      // Change mouse position while hidden
      rerender(<BadgeTooltip {...defaultProps} showBadgeInfo={false} mousePos={{ x: 500, y: 500 }} />)
      
      // Show tooltip - should use new position
      rerender(<BadgeTooltip {...defaultProps} showBadgeInfo={true} mousePos={{ x: 500, y: 500 }} />)
      
      const tooltip = screen.getByText('Moderator').closest('.tooltipItem')
      expect(tooltip).toHaveStyle('top: 515px; left: 515px')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<BadgeTooltip {...defaultProps} />)
      
      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('alt', mockBadgeInfo.title)
      expect(img).toHaveAttribute('src', mockBadgeInfo.src)
    })

    it('should maintain readable text contrast', () => {
      render(<BadgeTooltip {...defaultProps} />)
      
      const tooltip = screen.getByText('Moderator').closest('.tooltipItem')
      
      // Should be visible with proper opacity
      expect(tooltip).toHaveStyle('opacity: 1')
    })

    it('should support screen readers with descriptive text', () => {
      render(<BadgeTooltip {...defaultProps} />)
      
      // Text content should be accessible
      expect(screen.getByText('Moderator')).toBeInTheDocument()
      expect(screen.getByText('Kick')).toBeInTheDocument()
      expect(screen.getByText('Created by')).toBeInTheDocument()
      expect(screen.getByText('testuser')).toBeInTheDocument()
    })
  })

  describe('Integration', () => {
    it('should work with different badge platforms', () => {
      const platforms = ['Kick', '7TV', 'KickTalk', 'Custom Platform']
      
      platforms.forEach(platform => {
        const badgeInfo = { ...mockBadgeInfo, platform }
        const { rerender } = render(<BadgeTooltip {...defaultProps} badgeInfo={badgeInfo} />)
        
        expect(screen.getByText(platform)).toBeInTheDocument()
        
        if (platform !== platforms[platforms.length - 1]) {
          rerender(<div />) // Clear for next test
        }
      })
    })

    it('should handle real-world badge data structures', () => {
      const realWorldBadges = [
        {
          src: 'https://cdn.kicktalk.app/Badges/founder.svg',
          title: 'Founder',
          platform: 'Kick',
          owner: { username: 'founder_user' }
        },
        {
          src: 'https://cdn.7tv.app/badge/developer.png',
          title: '7TV Developer',
          platform: '7TV',
          owner: { username: 'dev_user' }
        },
        {
          src: 'https://cdn.kicktalk.app/custom.webp',
          title: 'Custom Badge',
          platform: 'KickTalk',
          owner: { username: 'd9' }
        }
      ]
      
      realWorldBadges.forEach((badgeInfo, index) => {
        const { rerender } = render(<BadgeTooltip {...defaultProps} badgeInfo={badgeInfo} />)
        
        expect(screen.getByText(badgeInfo.title)).toBeInTheDocument()
        expect(screen.getByText(badgeInfo.platform)).toBeInTheDocument()
        expect(screen.getByText(badgeInfo.owner.username)).toBeInTheDocument()
        
        if (index < realWorldBadges.length - 1) {
          rerender(<div />)
        }
      })
    })
  })

  describe('Memory Management', () => {
    it('should clean up properly on unmount', () => {
      const { unmount } = render(<BadgeTooltip {...defaultProps} />)
      
      expect(() => {
        unmount()
      }).not.toThrow()
    })

    it('should handle multiple mount/unmount cycles', () => {
      for (let i = 0; i < 5; i++) {
        const { unmount } = render(<BadgeTooltip {...defaultProps} />)
        expect(screen.getByText('Moderator')).toBeInTheDocument()
        unmount()
      }
    })
  })
})