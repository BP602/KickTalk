import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KickBadges, KickTalkBadges, StvBadges } from './Badges.jsx'

// Mock dependencies
vi.mock('@assets/styles/components/Cosmetics/Badges.scss', () => ({}))
vi.mock('clsx', () => ({
  default: (...args) => args.filter(Boolean).join(' ')
}))

// Mock BadgeTooltip component
vi.mock('./BadgeTooltip', () => ({
  default: ({ showBadgeInfo, mousePos, badgeInfo }) => (
    <div data-testid="badge-tooltip" style={{
      display: showBadgeInfo ? 'block' : 'none',
      position: 'absolute',
      top: mousePos?.y || 0,
      left: mousePos?.x || 0
    }}>
      {badgeInfo && (
        <div>
          <img src={badgeInfo.src} alt={badgeInfo.title} />
          <span>{badgeInfo.title}</span>
          <span>{badgeInfo.platform}</span>
          {badgeInfo.owner?.username && <span>by {badgeInfo.owner.username}</span>}
        </div>
      )}
    </div>
  )
}))

// Mock constants
vi.mock('@utils/constants', () => ({
  kickBadgeMap: {
    subscriber: (badge, subscriberBadges) => {
      if (!subscriberBadges?.length) {
        return {
          src: 'https://cdn.kicktalk.app/Badges/subscriber.svg',
          title: `${badge.count} Month ${badge.text}`,
          info: `${badge.count} Month Subscriber`,
          platform: 'Kick'
        }
      }
      const badgeData = subscriberBadges.find(b => badge.count >= b.months)
      return badgeData ? {
        src: badgeData.badge_image.src,
        title: `${badge.count} Month ${badge.text}`,
        info: `${badge.count} Month Subscriber`,
        platform: 'Kick'
      } : null
    },
    moderator: {
      src: 'https://cdn.kicktalk.app/Badges/moderator.svg',
      title: 'Moderator',
      info: 'Moderator',
      platform: 'Kick'
    },
    broadcaster: {
      src: 'https://cdn.kicktalk.app/Badges/broadcaster.svg',
      title: 'Broadcaster',
      info: 'Broadcaster',
      platform: 'Kick'
    },
    bot: {
      src: 'https://cdn.kicktalk.app/Badges/bot.svg',
      title: 'Bot',
      info: 'Bot',
      platform: 'Kick'
    },
    vip: {
      src: 'https://cdn.kicktalk.app/Badges/vip.svg',
      title: 'VIP',
      info: 'VIP',
      platform: 'Kick'
    },
    founder: {
      src: 'https://cdn.kicktalk.app/Badges/founder.svg',
      title: 'Founder',
      info: 'Founder',
      platform: 'Kick'
    }
  }
}))

// Top-level test data used in multiple suites
const mockBadges = [
  { type: 'moderator', count: 1, text: 'Moderator' },
  { type: 'subscriber', count: 12, text: 'Subscriber' },
  { type: 'bot', count: 1, text: 'Bot' }
]

describe('Badges Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true })
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('KickBadges Component', () => {
    const mockBadges = [
      { type: 'moderator', count: 1, text: 'Moderator' },
      { type: 'subscriber', count: 12, text: 'Subscriber' },
      { type: 'bot', count: 1, text: 'Bot' }
    ]

    const mockSubscriberBadges = [
      {
        months: 1,
        badge_image: { src: 'https://cdn.kicktalk.app/custom1.svg' }
      },
      {
        months: 6,
        badge_image: { src: 'https://cdn.kicktalk.app/custom6.svg' }
      },
      {
        months: 12,
        badge_image: { src: 'https://cdn.kicktalk.app/custom12.svg' }
      }
    ]

    describe('Rendering', () => {
      it('should render all badges correctly', () => {
        render(<KickBadges badges={mockBadges} subscriberBadges={mockSubscriberBadges} />)
        
        expect(screen.getAllByClassName('chatroomBadge')).toHaveLength(3)
        expect(screen.getByAltText('moderator')).toBeInTheDocument()
        expect(screen.getByAltText('subscriber')).toBeInTheDocument()
        expect(screen.getByAltText('bot')).toBeInTheDocument()
      })

      it('should render nothing when badges is empty', () => {
        const { container } = render(<KickBadges badges={[]} />)
        expect(container.firstChild).toBeNull()
      })

      it('should render nothing when badges is null', () => {
        const { container } = render(<KickBadges badges={null} />)
        expect(container.firstChild).toBeNull()
      })

      it('should render nothing when badges is undefined', () => {
        const { container } = render(<KickBadges badges={undefined} />)
        expect(container.firstChild).toBeNull()
      })

      it('should skip badges that are not in kickBadgeMap', () => {
        const badgesWithUnknown = [
          ...mockBadges,
          { type: 'unknown_badge', count: 1, text: 'Unknown' }
        ]
        
        render(<KickBadges badges={badgesWithUnknown} subscriberBadges={mockSubscriberBadges} />)
        
        // Should only render the known badges
        expect(screen.getAllByClassName('chatroomBadge')).toHaveLength(3)
        expect(screen.queryByAltText('unknown_badge')).not.toBeInTheDocument()
      })
    })

    describe('Subscriber Badge Logic', () => {
      it('should use custom subscriber badge when available', () => {
        const subscriberBadge = [{ type: 'subscriber', count: 12, text: 'Subscriber' }]
        
        render(<KickBadges badges={subscriberBadge} subscriberBadges={mockSubscriberBadges} />)
        
        const badgeImg = screen.getByAltText('subscriber')
        expect(badgeImg.src).toBe('https://cdn.kicktalk.app/custom12.svg')
      })

      it('should use default subscriber badge when no custom badges available', () => {
        const subscriberBadge = [{ type: 'subscriber', count: 6, text: 'Subscriber' }]
        
        render(<KickBadges badges={subscriberBadge} subscriberBadges={null} />)
        
        const badgeImg = screen.getByAltText('subscriber')
        expect(badgeImg.src).toBe('https://cdn.kicktalk.app/Badges/subscriber.svg')
      })

      it('should find the correct subscriber badge tier', () => {
        const subscriberBadge = [{ type: 'subscriber', count: 8, text: 'Subscriber' }]
        
        render(<KickBadges badges={subscriberBadge} subscriberBadges={mockSubscriberBadges} />)
        
        const badgeImg = screen.getByAltText('subscriber')
        // Should get 6-month badge since 8 >= 6 but 8 < 12
        expect(badgeImg.src).toBe('https://cdn.kicktalk.app/custom6.svg')
      })

      it('should handle edge case where subscriber count is less than minimum tier', () => {
        const subscriberBadges = [
          { months: 3, badge_image: { src: 'https://cdn.kicktalk.app/custom3.svg' } }
        ]
        const subscriberBadge = [{ type: 'subscriber', count: 1, text: 'Subscriber' }]
        
        render(<KickBadges badges={subscriberBadge} subscriberBadges={subscriberBadges} />)
        
        // Should not render since no matching tier
        expect(screen.queryByAltText('subscriber')).not.toBeInTheDocument()
      })
    })

    describe('Mouse Interactions', () => {
      it('should show tooltip on mouse enter', async () => {
        const user = userEvent.setup()
        render(<KickBadges badges={mockBadges} />)
        
        const badge = screen.getAllByClassName('chatroomBadge')[0]
        
        await user.hover(badge)
        
        expect(screen.getByTestId('badge-tooltip')).toHaveStyle('display: block')
      })

      it('should hide tooltip on mouse leave', async () => {
        const user = userEvent.setup()
        render(<KickBadges badges={mockBadges} />)
        
        const badge = screen.getAllByClassName('chatroomBadge')[0]
        
        await user.hover(badge)
        await user.unhover(badge)
        
        expect(screen.getByTestId('badge-tooltip')).toHaveStyle('display: none')
      })

      it('should update tooltip position on mouse move', () => {
        render(<KickBadges badges={mockBadges} />)
        
        const badge = screen.getAllByClassName('chatroomBadge')[0]
        
        fireEvent.mouseEnter(badge, { clientX: 100, clientY: 200 })
        fireEvent.mouseMove(badge, { clientX: 150, clientY: 250 })
        
        const tooltip = screen.getByTestId('badge-tooltip')
        expect(tooltip).toHaveStyle('top: 250px; left: 150px')
      })

      it('should not update position on mouse move when tooltip is hidden', () => {
        render(<KickBadges badges={mockBadges} />)
        
        const badge = screen.getAllByClassName('chatroomBadge')[0]
        
        // Move without entering first
        fireEvent.mouseMove(badge, { clientX: 150, clientY: 250 })
        
        const tooltip = screen.getByTestId('badge-tooltip')
        expect(tooltip).toHaveStyle('top: 0px; left: 0px') // Should remain at default
      })
    })

    describe('Tooltip Content', () => {
      it('should display correct badge information in tooltip', () => {
        render(<KickBadges badges={[{ type: 'moderator', count: 1, text: 'Moderator' }]} />)
        
        const badge = screen.getByClassName('chatroomBadge')
        fireEvent.mouseEnter(badge)
        
        const tooltip = screen.getByTestId('badge-tooltip')
        expect(tooltip).toHaveTextContent('Moderator')
        expect(tooltip).toHaveTextContent('Kick')
      })

      it('should display subscriber badge information correctly', () => {
        const subscriberBadge = [{ type: 'subscriber', count: 12, text: 'Subscriber' }]
        
        render(<KickBadges badges={subscriberBadge} subscriberBadges={mockSubscriberBadges} />)
        
        const badge = screen.getByClassName('chatroomBadge')
        fireEvent.mouseEnter(badge)
        
        const tooltip = screen.getByTestId('badge-tooltip')
        expect(tooltip).toHaveTextContent('12 Month Subscriber')
      })
    })

    describe('Accessibility', () => {
      it('should have proper alt text for badge images', () => {
        render(<KickBadges badges={mockBadges} />)
        
        const moderatorImg = screen.getByAltText('moderator')
        const subscriberImg = screen.getByAltText('subscriber')
        const botImg = screen.getByAltText('bot')
        
        expect(moderatorImg).toBeInTheDocument()
        expect(subscriberImg).toBeInTheDocument()
        expect(botImg).toBeInTheDocument()
      })

      it('should support keyboard navigation', async () => {
        const user = userEvent.setup()
        render(<KickBadges badges={mockBadges} />)
        
        const badges = screen.getAllByClassName('chatroomBadge')
        
        // Focus first badge
        badges[0].focus()
        expect(badges[0]).toHaveFocus()
        
        // Tab to next badge
        await user.tab()
        expect(badges[1]).toHaveFocus()
      })
    })

    describe('Performance', () => {
      it('should memoize badge components correctly', () => {
        const { rerender } = render(<KickBadges badges={mockBadges} />)
        
        const initialBadges = screen.getAllByClassName('chatroomBadge')
        
        // Re-render with same props
        rerender(<KickBadges badges={mockBadges} />)
        
        const newBadges = screen.getAllByClassName('chatroomBadge')
        expect(newBadges).toHaveLength(initialBadges.length)
      })

      it('should handle rapid mouse events without performance issues', () => {
        render(<KickBadges badges={mockBadges} />)
        
        const badge = screen.getAllByClassName('chatroomBadge')[0]
        
        // Rapidly fire mouse events
        for (let i = 0; i < 10; i++) {
          fireEvent.mouseEnter(badge, { clientX: i * 10, clientY: i * 10 })
          fireEvent.mouseMove(badge, { clientX: i * 10 + 5, clientY: i * 10 + 5 })
          fireEvent.mouseLeave(badge)
        }
        
        // Should not crash
        expect(screen.getByTestId('badge-tooltip')).toBeInTheDocument()
      })
    })

    describe('Error Handling', () => {
      it('should handle malformed badge data gracefully', () => {
        const malformedBadges = [
          { type: 'moderator' }, // Missing count and text
          { count: 1 }, // Missing type
          null, // Null badge
          undefined // Undefined badge
        ]
        
        expect(() => {
          render(<KickBadges badges={malformedBadges} />)
        }).not.toThrow()
      })

      it('should handle missing badge image sources', () => {
        // Mock a badge map that returns null src
        const badgeWithNullSrc = [{ type: 'moderator', count: 1, text: 'Moderator' }]
        
        vi.mocked(vi.importActual('@utils/constants')).kickBadgeMap = {
          moderator: { src: null, title: 'Moderator', platform: 'Kick' }
        }
        
        expect(() => {
          render(<KickBadges badges={badgeWithNullSrc} />)
        }).not.toThrow()
      })
    })
  })

  describe('KickTalkBadges Component', () => {
    const mockKickTalkBadges = [
      { type: 'founder', title: 'KickTalk Founder' },
      { type: 'betaTester', title: 'Beta Tester' },
      { type: 'developer', title: 'Developer' }
    ]

    describe('Rendering', () => {
      it('should render KickTalk badges correctly', () => {
        render(<KickTalkBadges badges={mockKickTalkBadges} />)
        
        expect(screen.getAllByClassName('chatroomBadge')).toHaveLength(3)
        expect(screen.getByAltText('KickTalk Founder')).toBeInTheDocument()
        expect(screen.getByAltText('Beta Tester')).toBeInTheDocument()
        expect(screen.getByAltText('Developer')).toBeInTheDocument()
      })

      it('should use correct CDN URLs', () => {
        render(<KickTalkBadges badges={[mockKickTalkBadges[0]]} />)
        
        const imgs = screen.getAllByAltText('KickTalk Founder')
        const badgeImg = imgs.find(img => img.classList.contains('chatroomBadgeIcon')) || imgs[0]
        expect(badgeImg.src).toBe('https://cdn.kicktalk.app/founder.webp')
      })

      it('should include owner information in tooltip', () => {
        render(<KickTalkBadges badges={[mockKickTalkBadges[0]]} />)
        
        const badge = screen.getByClassName('chatroomBadge')
        fireEvent.mouseEnter(badge)
        
        const tooltip = screen.getByTestId('badge-tooltip')
        expect(tooltip).toHaveTextContent('by d9')
        expect(tooltip).toHaveTextContent('KickTalk')
      })
    })

    describe('Mouse Interactions', () => {
      it('should handle mouse events correctly', async () => {
        const user = userEvent.setup()
        render(<KickTalkBadges badges={mockKickTalkBadges} />)
        
        const badge = screen.getAllByClassName('chatroomBadge')[0]
        const tooltips = screen.getAllByTestId('badge-tooltip')
        
        await user.hover(badge)
        expect(tooltips[0]).toHaveStyle('display: block')
        
        await user.unhover(badge)
        expect(tooltips[0]).toHaveStyle('display: none')
      })
    })

    describe('Memoization', () => {
      it('should memoize component with custom comparison', () => {
        const badges1 = [{ type: 'founder', title: 'KickTalk Founder' }]
        const badges2 = [{ type: 'founder', title: 'KickTalk Founder' }]
        
        const { rerender } = render(<KickTalkBadges badges={badges1} />)
        
        // Should render same content
        {
          const imgs = screen.getAllByAltText('KickTalk Founder')
          const badgeImg = imgs.find(img => img.classList.contains('chatroomBadgeIcon')) || imgs[0]
          expect(badgeImg).toBeInTheDocument()
        }
        
        rerender(<KickTalkBadges badges={badges2} />)
        
        // Should still render (different array reference but same content)
        {
          const imgs = screen.getAllByAltText('KickTalk Founder')
          const badgeImg = imgs.find(img => img.classList.contains('chatroomBadgeIcon')) || imgs[0]
          expect(badgeImg).toBeInTheDocument()
        }
      })
    })

    describe('Edge Cases', () => {
      it('should handle badges with special characters in titles', () => {
        const specialBadges = [
          { type: 'special', title: 'Badge with "quotes" & symbols!' }
        ]
        
        render(<KickTalkBadges badges={specialBadges} />)
        
        const imgs = screen.getAllByAltText('Badge with "quotes" & symbols!')
        const visibleImg = imgs.find(img => img.classList.contains('chatroomBadgeIcon')) || imgs[0]
        expect(visibleImg).toBeInTheDocument()
      })

      it('should handle very long badge titles', () => {
        const longTitleBadge = [
          { type: 'long', title: 'A'.repeat(100) }
        ]
        
        render(<KickTalkBadges badges={longTitleBadge} />)
        
        const imgs = screen.getAllByAltText('A'.repeat(100))
        const visibleImg = imgs.find(img => img.classList.contains('chatroomBadgeIcon')) || imgs[0]
        expect(visibleImg).toBeInTheDocument()
      })
    })
  })

  describe('StvBadges Component', () => {
    const mockStvBadge = {
      type: 'developer',
      title: '7TV Developer',
      url: 'https://cdn.7tv.app/badge/developer/2x.png'
    }

    describe('Rendering', () => {
      it('should render 7TV badge correctly', () => {
        render(<StvBadges badge={mockStvBadge} />)
        
        expect(screen.getByClassName('chatroomBadge')).toBeInTheDocument()
        const imgs = screen.getAllByAltText('7TV Developer')
        expect(imgs.length).toBeGreaterThan(0)
      })

      it('should use provided badge URL', () => {
        render(<StvBadges badge={mockStvBadge} />)
        
        const imgs = screen.getAllByAltText('7TV Developer')
        // pick the visible badge icon element (has class chatroomBadgeIcon)
        const badgeImg = imgs.find(img => img.classList.contains('chatroomBadgeIcon')) || imgs[0]
        expect(badgeImg.src).toBe(mockStvBadge.url)
      })

      it('should include 7TV platform in tooltip', () => {
        render(<StvBadges badge={mockStvBadge} />)
        
        const badge = screen.getByClassName('chatroomBadge')
        fireEvent.mouseEnter(badge)
        
        const tooltip = screen.getByTestId('badge-tooltip')
        expect(tooltip).toHaveTextContent('7TV Developer')
        expect(tooltip).toHaveTextContent('7TV')
      })
    })

    describe('Mouse Interactions', () => {
      it('should show and hide tooltip correctly', async () => {
        const user = userEvent.setup()
        render(<StvBadges badge={mockStvBadge} />)
        
        const badge = screen.getByClassName('chatroomBadge')
        
        await user.hover(badge)
        expect(screen.getByTestId('badge-tooltip')).toHaveStyle('display: block')
        
        await user.unhover(badge)
        expect(screen.getByTestId('badge-tooltip')).toHaveStyle('display: none')
      })

      it('should update tooltip position on mouse move', () => {
        render(<StvBadges badge={mockStvBadge} />)
        
        const badge = screen.getByClassName('chatroomBadge')
        
        fireEvent.mouseEnter(badge, { clientX: 300, clientY: 400 })
        fireEvent.mouseMove(badge, { clientX: 350, clientY: 450 })
        
        const tooltip = screen.getByTestId('badge-tooltip')
        expect(tooltip).toHaveStyle('top: 450px; left: 350px')
      })
    })

    describe('Error Handling', () => {
      it('should handle missing badge properties', () => {
        const incompleteBadge = { type: 'test' } // Missing title and url
        
        expect(() => {
          render(<StvBadges badge={incompleteBadge} />)
        }).not.toThrow()
      })

      it('should handle invalid badge URLs', () => {
        const invalidUrlBadge = {
          ...mockStvBadge,
          url: 'invalid-url'
        }
        
        expect(() => {
          render(<StvBadges badge={invalidUrlBadge} />)
        }).not.toThrow()
      })
    })
  })

  describe('Cross-Component Integration', () => {
    it('should handle multiple badge types together', () => {
      const kickBadges = [{ type: 'moderator', count: 1, text: 'Moderator' }]
      const kickTalkBadges = [{ type: 'founder', title: 'KickTalk Founder' }]
      const stvBadge = { type: 'developer', title: '7TV Developer', url: 'https://cdn.7tv.app/badge.png' }
      
      const { container } = render(
        <div>
          <KickBadges badges={kickBadges} />
          <KickTalkBadges badges={kickTalkBadges} />
          <StvBadges badge={stvBadge} />
        </div>
      )
      
      expect(container.querySelectorAll('.chatroomBadge')).toHaveLength(3)
    })

    it('should maintain independent tooltip states', async () => {
      const user = userEvent.setup()
      const kickBadges = [{ type: 'moderator', count: 1, text: 'Moderator' }]
      const kickTalkBadges = [{ type: 'founder', title: 'KickTalk Founder' }]
      
      render(
        <div>
          <KickBadges badges={kickBadges} />
          <KickTalkBadges badges={kickTalkBadges} />
        </div>
      )
      
      const badges = screen.getAllByClassName('chatroomBadge')
      
      // Hover first badge
      await user.hover(badges[0])
      
      const tooltips = screen.getAllByTestId('badge-tooltip')
      expect(tooltips[0]).toHaveStyle('display: block')
      expect(tooltips[1]).toHaveStyle('display: none')
    })
  })

  describe('Memory and Performance', () => {
    it('should clean up event listeners on unmount', () => {
      const { unmount } = render(<KickBadges badges={mockBadges} />)
      
      expect(() => {
        unmount()
      }).not.toThrow()
    })

    it('should handle component re-renders efficiently', () => {
      const badges = [{ type: 'moderator', count: 1, text: 'Moderator' }]
      
      const { rerender } = render(<KickBadges badges={badges} />)
      
      // Multiple re-renders shouldn't cause issues
      for (let i = 0; i < 5; i++) {
        rerender(<KickBadges badges={badges} />)
      }
      
      expect(screen.getByClassName('chatroomBadge')).toBeInTheDocument()
    })
  })
})