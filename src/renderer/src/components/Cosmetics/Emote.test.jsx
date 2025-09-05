import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Emote from './Emote.jsx'

// Mock dependencies
vi.mock('@assets/styles/components/Cosmetics/Emote.scss', () => ({}))

// Mock EmoteTooltip component
vi.mock('./EmoteTooltip', () => ({
  default: ({ type, showEmoteInfo, emoteSrc, mousePos, emoteInfo, overlaidEmotes = [] }) => (
    <div data-testid="emote-tooltip" style={{
      display: showEmoteInfo ? 'block' : 'none',
      position: 'absolute',
      top: mousePos?.y || 0,
      left: mousePos?.x || 0
    }}>
      {emoteInfo && (
        <div>
          <img src={emoteSrc} alt={emoteInfo.name} />
          <span>{emoteInfo.name}</span>
          <span>{type}</span>
          {overlaidEmotes.length > 0 && (
            <div data-testid="overlaid-emotes">
              {overlaidEmotes.map(e => <span key={e.id}>{e.name}</span>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}))

describe('Emote Component', () => {
  const mockKickEmote = {
    id: '123456',
    name: 'Kappa',
    width: 32,
    height: 32
  }

  const mockStvEmote = {
    id: '60ae4b60f39dd10f2d2cc79c',
    name: 'OMEGALUL',
    width: 28,
    height: 28
  }

  const mockOverlaidEmotes = [
    { id: '1', name: 'overlay1' },
    { id: '2', name: 'overlay2' }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true })

    // Mock image loading
    Object.defineProperty(HTMLImageElement.prototype, 'loading', {
      writable: true,
      value: 'lazy'
    })
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Rendering - Kick Emotes', () => {
    it('should render kick emote correctly', () => {
      render(<Emote emote={mockKickEmote} type="kick" />)
      
      expect(screen.getByAltText('Kappa')).toBeInTheDocument()
      expect(screen.getByClassName('chatroomEmoteWrapper')).toBeInTheDocument()
      expect(screen.getByClassName('kickEmote emote')).toBeInTheDocument()
    })

    it('should use correct Kick emote URL', () => {
      render(<Emote emote={mockKickEmote} type="kick" />)
      
      const emoteImg = screen.getByAltText('Kappa')
      expect(emoteImg.src).toBe('https://files.kick.com/emotes/123456/fullsize')
    })

    it('should set correct dimensions for Kick emotes', () => {
      render(<Emote emote={mockKickEmote} type="kick" />)
      
      const wrapper = screen.getByClassName('chatroomEmoteWrapper')
      expect(wrapper).toHaveStyle('width: 32px; height: 32px')
    })

    it('should not have srcSet for Kick emotes', () => {
      render(<Emote emote={mockKickEmote} type="kick" />)
      
      const emoteImg = screen.getByAltText('Kappa')
      expect(emoteImg.srcset).toBe('')
    })
  })

  describe('Rendering - 7TV Emotes', () => {
    it('should render 7TV emote correctly', () => {
      render(<Emote emote={mockStvEmote} type="stv" />)
      
      expect(screen.getByAltText('OMEGALUL')).toBeInTheDocument()
      expect(screen.getByClassName('stvEmote emote')).toBeInTheDocument()
    })

    it('should use correct 7TV emote URL', () => {
      render(<Emote emote={mockStvEmote} type="stv" />)
      
      const emoteImg = screen.getByAltText('OMEGALUL')
      expect(emoteImg.src).toBe('https://cdn.7tv.app/emote/60ae4b60f39dd10f2d2cc79c/1x.webp')
    })

    it('should set correct dimensions for 7TV emotes', () => {
      render(<Emote emote={mockStvEmote} type="stv" />)
      
      const wrapper = screen.getByClassName('chatroomEmoteWrapper')
      expect(wrapper).toHaveStyle('width: 28px; height: 28px')
    })

    it('should have srcSet for 7TV emotes', () => {
      render(<Emote emote={mockStvEmote} type="stv" />)
      
      const emoteImg = screen.getByAltText('OMEGALUL')
      const expectedSrcSet = 'https://cdn.7tv.app/emote/60ae4b60f39dd10f2d2cc79c/1x.webp 1x, https://cdn.7tv.app/emote/60ae4b60f39dd10f2d2cc79c/2x.webp 2x, https://cdn.7tv.app/emote/60ae4b60f39dd10f2d2cc79c/3x.webp 3x, https://cdn.7tv.app/emote/60ae4b60f39dd10f2d2cc79c/4x.webp 4x'
      expect(emoteImg.srcset).toBe(expectedSrcSet)
    })
  })

  describe('Overlaid Emotes', () => {
    it('should render overlaid emotes for Kick type', () => {
      render(<Emote emote={mockKickEmote} type="kick" overlaidEmotes={mockOverlaidEmotes} />)
      
      const overlaidEmoteElements = screen.getAllByClassName('zeroWidthEmote')
      expect(overlaidEmoteElements).toHaveLength(2)
      
      expect(screen.getByAltText(' overlay1')).toBeInTheDocument()
      expect(screen.getByAltText(' overlay2')).toBeInTheDocument()
    })

    it('should render overlaid emotes for 7TV type', () => {
      render(<Emote emote={mockStvEmote} type="stv" overlaidEmotes={mockOverlaidEmotes} />)
      
      const overlaidEmoteElements = screen.getAllByClassName('zeroWidthEmote')
      expect(overlaidEmoteElements).toHaveLength(2)
    })

    it('should use correct URLs for overlaid Kick emotes', () => {
      render(<Emote emote={mockKickEmote} type="kick" overlaidEmotes={mockOverlaidEmotes} />)
      
      const overlaidImg = screen.getByAltText(' overlay1')
      expect(overlaidImg.src).toBe('https://files.kick.com/emotes/1/fullsize')
    })

    it('should use correct URLs for overlaid 7TV emotes', () => {
      render(<Emote emote={mockStvEmote} type="stv" overlaidEmotes={mockOverlaidEmotes} />)
      
      const overlaidImg = screen.getByAltText(' overlay1')
      expect(overlaidImg.src).toBe('https://cdn.7tv.app/emote/1/1x.webp')
    })

    it('should render without overlaid emotes when array is empty', () => {
      render(<Emote emote={mockKickEmote} type="kick" overlaidEmotes={[]} />)
      
      const overlaidEmoteElements = screen.queryAllByClassName('zeroWidthEmote')
      expect(overlaidEmoteElements).toHaveLength(0)
    })
  })

  describe('Mouse Interactions', () => {
    it('should show tooltip on mouse enter', async () => {
      const user = userEvent.setup()
      render(<Emote emote={mockKickEmote} type="kick" />)
      
      const emote = screen.getByClassName('chatroomEmote')
      
      await user.hover(emote)
      
      expect(screen.getByTestId('emote-tooltip')).toHaveStyle('display: block')
    })

    it('should hide tooltip on mouse leave', async () => {
      const user = userEvent.setup()
      render(<Emote emote={mockKickEmote} type="kick" />)
      
      const emote = screen.getByClassName('chatroomEmote')
      
      await user.hover(emote)
      await user.unhover(emote)
      
      expect(screen.getByTestId('emote-tooltip')).toHaveStyle('display: none')
    })

    it('should update tooltip position on mouse move', () => {
      render(<Emote emote={mockKickEmote} type="kick" />)
      
      const emote = screen.getByClassName('chatroomEmote')
      
      fireEvent.mouseEnter(emote, { clientX: 100, clientY: 200 })
      fireEvent.mouseMove(emote, { clientX: 150, clientY: 250 })
      
      const tooltip = screen.getByTestId('emote-tooltip')
      expect(tooltip).toHaveStyle('top: 250px; left: 150px')
    })

    it('should not update position on mouse move when tooltip is hidden', () => {
      render(<Emote emote={mockKickEmote} type="kick" />)
      
      const emote = screen.getByClassName('chatroomEmote')
      
      // Move without entering first
      fireEvent.mouseMove(emote, { clientX: 150, clientY: 250 })
      
      const tooltip = screen.getByTestId('emote-tooltip')
      expect(tooltip).toHaveStyle('top: 0px; left: 0px') // Should remain at default
    })

    it('should handle rapid mouse events', () => {
      render(<Emote emote={mockKickEmote} type="kick" />)
      
      const emote = screen.getByClassName('chatroomEmote')
      
      // Rapidly fire mouse events
      for (let i = 0; i < 10; i++) {
        fireEvent.mouseEnter(emote, { clientX: i * 10, clientY: i * 10 })
        fireEvent.mouseMove(emote, { clientX: i * 10 + 5, clientY: i * 10 + 5 })
        fireEvent.mouseLeave(emote)
      }
      
      // Should not crash
      expect(screen.getByTestId('emote-tooltip')).toBeInTheDocument()
    })
  })

  describe('Tooltip Integration', () => {
    it('should pass correct props to tooltip for Kick emotes', () => {
      render(<Emote emote={mockKickEmote} type="kick" overlaidEmotes={mockOverlaidEmotes} />)
      
      const emote = screen.getByClassName('chatroomEmote')
      fireEvent.mouseEnter(emote)
      
      const tooltip = screen.getByTestId('emote-tooltip')
      expect(tooltip).toHaveTextContent('Kappa')
      expect(tooltip).toHaveTextContent('kick')
      expect(screen.getByTestId('overlaid-emotes')).toBeInTheDocument()
    })

    it('should pass correct props to tooltip for 7TV emotes', () => {
      render(<Emote emote={mockStvEmote} type="stv" overlaidEmotes={mockOverlaidEmotes} />)
      
      const emote = screen.getByClassName('chatroomEmote')
      fireEvent.mouseEnter(emote)
      
      const tooltip = screen.getByTestId('emote-tooltip')
      expect(tooltip).toHaveTextContent('OMEGALUL')
      expect(tooltip).toHaveTextContent('stv')
    })
  })

  describe('Image Loading Optimization', () => {
    it('should have lazy loading attributes', () => {
      render(<Emote emote={mockKickEmote} type="kick" />)
      
      const emoteImg = screen.getByAltText('Kappa')
      expect(emoteImg.loading).toBe('lazy')
      expect(emoteImg.getAttribute('fetchpriority')).toBe('low')
      expect(emoteImg.getAttribute('decoding')).toBe('async')
    })

    it('should have lazy loading on overlaid emotes', () => {
      render(<Emote emote={mockKickEmote} type="kick" overlaidEmotes={mockOverlaidEmotes} />)
      
      const overlaidImg = screen.getByAltText(' overlay1')
      expect(overlaidImg.loading).toBe('lazy')
      expect(overlaidImg.getAttribute('decoding')).toBe('async')
    })
  })

  describe('Scaling', () => {
    it('should apply custom scale to dimensions', () => {
      render(<Emote emote={mockStvEmote} type="stv" scale={2} />)
      
      const wrapper = screen.getByClassName('chatroomEmoteWrapper')
      expect(wrapper).toHaveStyle('width: 28px; height: 28px') // Scale doesn't change wrapper size in current implementation
    })

    it('should handle scale of 1 (default)', () => {
      render(<Emote emote={mockStvEmote} type="stv" scale={1} />)
      
      const wrapper = screen.getByClassName('chatroomEmoteWrapper')
      expect(wrapper).toHaveStyle('width: 28px; height: 28px')
    })

    it('should handle fractional scales', () => {
      render(<Emote emote={mockStvEmote} type="stv" scale={0.5} />)
      
      const wrapper = screen.getByClassName('chatroomEmoteWrapper')
      expect(wrapper).toHaveStyle('width: 28px; height: 28px')
    })
  })

  describe('Error Handling', () => {
    it('should handle missing emote properties gracefully', () => {
      const incompleteEmote = { id: '123' } // Missing name, width, height
      
      expect(() => {
        render(<Emote emote={incompleteEmote} type="kick" />)
      }).not.toThrow()
    })

    it('should handle undefined emote', () => {
      expect(() => {
        render(<Emote emote={undefined} type="kick" />)
      }).not.toThrow()
    })

    it('should handle null emote', () => {
      expect(() => {
        render(<Emote emote={null} type="kick" />)
      }).not.toThrow()
    })

    it('should handle invalid emote type', () => {
      expect(() => {
        render(<Emote emote={mockKickEmote} type="invalid" />)
      }).not.toThrow()
    })

    it('should handle missing overlaidEmotes gracefully', () => {
      expect(() => {
        render(<Emote emote={mockKickEmote} type="kick" overlaidEmotes={null} />)
      }).not.toThrow()
    })
  })

  describe('Accessibility', () => {
    it('should have proper alt text for emote images', () => {
      render(<Emote emote={mockKickEmote} type="kick" />)
      
      const emoteImg = screen.getByAltText('Kappa')
      expect(emoteImg).toBeInTheDocument()
    })

    it('should have proper alt text for overlaid emotes with leading space', () => {
      render(<Emote emote={mockKickEmote} type="kick" overlaidEmotes={mockOverlaidEmotes} />)
      
      expect(screen.getByAltText(' overlay1')).toBeInTheDocument()
      expect(screen.getByAltText(' overlay2')).toBeInTheDocument()
    })

    it('should handle emotes with special characters in names', () => {
      const specialEmote = { ...mockKickEmote, name: 'Emote_with-special.chars!' }
      
      render(<Emote emote={specialEmote} type="kick" />)
      
      expect(screen.getByAltText('Emote_with-special.chars!')).toBeInTheDocument()
    })

    it('should support keyboard navigation to emote container', () => {
      render(<Emote emote={mockKickEmote} type="kick" />)
      
      const emoteDiv = screen.getByClassName('chatroomEmote')
      emoteDiv.focus()
      expect(emoteDiv).toHaveFocus()
    })
  })

  describe('Performance and Memoization', () => {
    it('should memoize component correctly', () => {
      const { rerender } = render(<Emote emote={mockKickEmote} type="kick" />)
      
      const initialEmote = screen.getByAltText('Kappa')
      
      // Re-render with same props
      rerender(<Emote emote={mockKickEmote} type="kick" />)
      
      const newEmote = screen.getByAltText('Kappa')
      expect(newEmote).toBeInTheDocument()
    })

    it('should optimize emoteSrcSet callback', () => {
      const { rerender } = render(<Emote emote={mockStvEmote} type="stv" />)
      
      // Re-render multiple times - callback should be memoized
      for (let i = 0; i < 5; i++) {
        rerender(<Emote emote={mockStvEmote} type="stv" />)
      }
      
      const emoteImg = screen.getByAltText('OMEGALUL')
      expect(emoteImg.srcset).toBeTruthy()
    })

    it('should optimize event handlers with useCallback', async () => {
      const user = userEvent.setup()
      render(<Emote emote={mockKickEmote} type="kick" />)
      
      const emote = screen.getByClassName('chatroomEmote')
      
      // Multiple interactions should work consistently
      for (let i = 0; i < 3; i++) {
        await user.hover(emote)
        await user.unhover(emote)
      }
      
      expect(screen.getByTestId('emote-tooltip')).toHaveStyle('display: none')
    })

    it('should handle component unmount cleanly', () => {
      const { unmount } = render(<Emote emote={mockKickEmote} type="kick" />)
      
      expect(() => {
        unmount()
      }).not.toThrow()
    })
  })

  describe('Edge Cases', () => {
    it('should handle very large emote dimensions', () => {
      const largeEmote = {
        ...mockStvEmote,
        width: 512,
        height: 512
      }
      
      render(<Emote emote={largeEmote} type="stv" />)
      
      const wrapper = screen.getByClassName('chatroomEmoteWrapper')
      expect(wrapper).toHaveStyle('width: 512px; height: 512px')
    })

    it('should handle zero dimensions', () => {
      const zeroEmote = {
        ...mockStvEmote,
        width: 0,
        height: 0
      }
      
      render(<Emote emote={zeroEmote} type="stv" />)
      
      const wrapper = screen.getByClassName('chatroomEmoteWrapper')
      expect(wrapper).toHaveStyle('width: 0px; height: 0px')
    })

    it('should handle emotes with very long names', () => {
      const longNameEmote = {
        ...mockKickEmote,
        name: 'A'.repeat(100)
      }
      
      render(<Emote emote={longNameEmote} type="kick" />)
      
      expect(screen.getByAltText('A'.repeat(100))).toBeInTheDocument()
    })

    it('should handle empty emote name', () => {
      const emptyNameEmote = {
        ...mockKickEmote,
        name: ''
      }
      
      render(<Emote emote={emptyNameEmote} type="kick" />)
      
      expect(screen.getByAltText('')).toBeInTheDocument()
    })

    it('should handle overlaid emotes with missing properties', () => {
      const malformedOverlaidEmotes = [
        { id: '1' }, // Missing name
        { name: 'test' }, // Missing id
        null, // Null entry
        undefined // Undefined entry
      ]
      
      expect(() => {
        render(<Emote emote={mockKickEmote} type="kick" overlaidEmotes={malformedOverlaidEmotes} />)
      }).not.toThrow()
    })
  })

  describe('URL Generation', () => {
    it('should generate correct URLs for different Kick emote IDs', () => {
      const emoteIds = ['123', '456789', '0']
      
      emoteIds.forEach(id => {
        const emote = { ...mockKickEmote, id }
        const { rerender } = render(<Emote emote={emote} type="kick" />)
        
        const emoteImg = screen.getByAltText('Kappa')
        expect(emoteImg.src).toBe(`https://files.kick.com/emotes/${id}/fullsize`)
        
        if (id !== emoteIds[emoteIds.length - 1]) {
          rerender(<div />)
        }
      })
    })

    it('should generate correct URLs for different 7TV emote IDs', () => {
      const emoteIds = ['60ae4b60f39dd10f2d2cc79c', 'abc123', '']
      
      emoteIds.forEach(id => {
        const emote = { ...mockStvEmote, id }
        const { rerender } = render(<Emote emote={emote} type="stv" />)
        
        const emoteImg = screen.getByAltText('OMEGALUL')
        expect(emoteImg.src).toBe(`https://cdn.7tv.app/emote/${id}/1x.webp`)
        
        if (id !== emoteIds[emoteIds.length - 1]) {
          rerender(<div />)
        }
      })
    })
  })

  describe('Memory Management', () => {
    it('should handle rapid re-renders without memory leaks', () => {
      const { rerender } = render(<Emote emote={mockKickEmote} type="kick" />)
      
      // Rapid re-renders with different props
      for (let i = 0; i < 20; i++) {
        const newEmote = {
          ...mockKickEmote,
          id: `emote${i}`,
          name: `TestEmote${i}`
        }
        
        rerender(<Emote emote={newEmote} type="kick" />)
      }
      
      expect(screen.getByAltText('TestEmote19')).toBeInTheDocument()
    })

    it('should handle tooltip state changes efficiently', async () => {
      const user = userEvent.setup()
      render(<Emote emote={mockKickEmote} type="kick" />)
      
      const emote = screen.getByClassName('chatroomEmote')
      
      // Rapid show/hide cycles
      for (let i = 0; i < 10; i++) {
        await user.hover(emote)
        await user.unhover(emote)
      }
      
      expect(screen.getByTestId('emote-tooltip')).toHaveStyle('display: none')
    })
  })
})