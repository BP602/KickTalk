import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmoteNode, $createEmoteNode, $isEmoteNode } from './EmoteNode.jsx'

// Mock lexical
vi.mock('lexical', () => ({
  DecoratorNode: class DecoratorNode {
    constructor(key) {
      this.__key = key
    }
    getKey() {
      return this.__key
    }
  }
}))

describe('EmoteNode', () => {
  describe('EmoteNode Class', () => {
    let emoteNode

    beforeEach(() => {
      emoteNode = new EmoteNode('123', 'TestEmote', 'kick')
    })

    it('should create an EmoteNode with correct properties', () => {
      expect(emoteNode.__emoteId).toBe('123')
      expect(emoteNode.__emoteName).toBe('TestEmote')
      expect(emoteNode.__platform).toBe('kick')
    })

    it('should return correct type', () => {
      expect(EmoteNode.getType()).toBe('emote')
    })

    it('should clone correctly', () => {
      const cloned = EmoteNode.clone(emoteNode)
      expect(cloned.__emoteId).toBe('123')
      expect(cloned.__emoteName).toBe('TestEmote')
      expect(cloned.__platform).toBe('kick')
    })

    it('should create DOM element correctly', () => {
      const dom = emoteNode.createDOM()
      expect(dom.tagName).toBe('DIV')
      expect(dom.className).toBe('emoteContainer')
    })

    it('should not update DOM', () => {
      expect(emoteNode.updateDOM()).toBe(false)
    })

    it('should not be isolated', () => {
      expect(emoteNode.isIsolated()).toBe(false)
    })

    it('should export correct JSON', () => {
      const json = emoteNode.exportJSON()
      expect(json).toEqual({
        type: 'emote',
        emoteId: '123',
        emoteName: 'TestEmote',
        platform: 'kick'
      })
    })

    it('should import from JSON correctly', () => {
      const json = {
        emoteId: '456',
        emoteName: 'ImportedEmote',
        platform: '7tv'
      }
      const imported = EmoteNode.importJSON(json)
      expect(imported.__emoteId).toBe('456')
      expect(imported.__emoteName).toBe('ImportedEmote')
      expect(imported.__platform).toBe('7tv')
    })

    it('should export DOM correctly', () => {
      const { element } = emoteNode.exportDOM()
      expect(element.tagName).toBe('IMG')
      expect(element.getAttribute('data-emote-id')).toBe('123')
      expect(element.getAttribute('data-emote-name')).toBe('TestEmote')
      expect(element.getAttribute('data-platform')).toBe('kick')
    })

    describe('getTextContent', () => {
      it('should return correct text content for kick emotes', () => {
        const kickEmote = new EmoteNode('123', 'KickEmote', 'kick')
        expect(kickEmote.getTextContent()).toBe('[emote:123:KickEmote]')
      })

      it('should return correct text content for 7tv emotes', () => {
        const stvEmote = new EmoteNode('456', 'STVEmote', '7tv')
        expect(stvEmote.getTextContent()).toBe(' STVEmote ')
      })

      it('should return space for unknown platforms', () => {
        const unknownEmote = new EmoteNode('789', 'UnknownEmote', 'unknown')
        expect(unknownEmote.getTextContent()).toBe(' ')
      })
    })

    describe('importDOM', () => {
      it('should import DOM with valid attributes', () => {
        const mockNode = {
          getAttribute: vi.fn((attr) => {
            const attrs = {
              'emote-id': '123',
              'emote-name': 'TestEmote',
              'platform': 'kick'
            }
            return attrs[attr]
          })
        }

        const importFn = EmoteNode.importDOM().img
        const result = importFn(mockNode)
        
        expect(result).toBeInstanceOf(EmoteNode)
        expect(result.__emoteId).toBe('123')
        expect(result.__emoteName).toBe('TestEmote')
        expect(result.__platform).toBe('kick')
      })

      it('should not import DOM without required attributes', () => {
        const mockNode = {
          getAttribute: vi.fn(() => null)
        }

        const importFn = EmoteNode.importDOM().img
        const result = importFn(mockNode)
        
        expect(result).toBeUndefined()
      })

      it('should not import DOM with missing emoteId', () => {
        const mockNode = {
          getAttribute: vi.fn((attr) => {
            const attrs = {
              'emote-name': 'TestEmote',
              'platform': 'kick'
            }
            return attrs[attr] || null
          })
        }

        const importFn = EmoteNode.importDOM().img
        const result = importFn(mockNode)
        
        expect(result).toBeUndefined()
      })
    })
  })

  describe('CustomEmoteComponent', () => {
    const CustomEmoteComponent = require('./EmoteNode.jsx').default

    it('should render kick emote correctly', () => {
      const emoteNode = new EmoteNode('123', 'KickEmote', 'kick')
      const component = emoteNode.decorate()
      
      render(component)
      
      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('src', 'https://files.kick.com/emotes/123/fullsize')
      expect(img).toHaveAttribute('alt', 'KickEmote')
      expect(img).toHaveAttribute('emote-id', '123')
      expect(img).toHaveAttribute('emote-name', 'KickEmote')
    })

    it('should render 7tv emote correctly', () => {
      const emoteNode = new EmoteNode('456', 'STVEmote', '7tv')
      const component = emoteNode.decorate()
      
      render(component)
      
      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('src', 'https://cdn.7tv.app/emote/456/1x.webp')
      expect(img).toHaveAttribute('alt', 'STVEmote')
      expect(img).toHaveAttribute('emote-id', '456')
      expect(img).toHaveAttribute('emote-name', 'STVEmote')
    })

    it('should render unknown platform as text', () => {
      const emoteNode = new EmoteNode('789', 'UnknownEmote', 'unknown')
      const component = emoteNode.decorate()
      
      render(component)
      
      expect(screen.getByText('UnknownEmote')).toBeInTheDocument()
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })
  })

  describe('Helper Functions', () => {
    describe('$createEmoteNode', () => {
      it('should create a new EmoteNode', () => {
        const node = $createEmoteNode('test-id')
        expect(node).toBeInstanceOf(EmoteNode)
        expect(node.__emoteId).toBe('test-id')
      })
    })

    describe('$isEmoteNode', () => {
      it('should return true for EmoteNode instances', () => {
        const emoteNode = new EmoteNode('123', 'TestEmote', 'kick')
        expect($isEmoteNode(emoteNode)).toBe(true)
      })

      it('should return false for non-EmoteNode instances', () => {
        const notEmoteNode = { type: 'text' }
        expect($isEmoteNode(notEmoteNode)).toBe(false)
      })

      it('should return false for null/undefined', () => {
        expect($isEmoteNode(null)).toBe(false)
        expect($isEmoteNode(undefined)).toBe(false)
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle emote with special characters in name', () => {
      const emoteNode = new EmoteNode('123', 'Emote_Name-123!', 'kick')
      expect(emoteNode.getTextContent()).toBe('[emote:123:Emote_Name-123!]')
    })

    it('should handle very long emote names', () => {
      const longName = 'A'.repeat(100)
      const emoteNode = new EmoteNode('123', longName, 'kick')
      expect(emoteNode.getTextContent()).toBe(`[emote:123:${longName}]`)
    })

    it('should handle empty emote name', () => {
      const emoteNode = new EmoteNode('123', '', 'kick')
      expect(emoteNode.getTextContent()).toBe('[emote:123:]')
    })

    it('should handle numeric emote ID as string', () => {
      const emoteNode = new EmoteNode(123, 'NumericID', 'kick')
      expect(emoteNode.getTextContent()).toBe('[emote:123:NumericID]')
    })
  })

  describe('Platform-Specific Behavior', () => {
    it('should handle kick platform correctly', () => {
      const kickEmote = new EmoteNode('kick123', 'KickEmote', 'kick')
      const component = kickEmote.decorate()
      
      render(component)
      
      const img = screen.getByRole('img')
      expect(img.src).toBe('https://files.kick.com/emotes/kick123/fullsize')
      expect(kickEmote.getTextContent()).toBe('[emote:kick123:KickEmote]')
    })

    it('should handle 7tv platform correctly', () => {
      const stvEmote = new EmoteNode('7tv456', 'STVEmote', '7tv')
      const component = stvEmote.decorate()
      
      render(component)
      
      const img = screen.getByRole('img')
      expect(img.src).toBe('https://cdn.7tv.app/emote/7tv456/1x.webp')
      expect(stvEmote.getTextContent()).toBe(' STVEmote ')
    })

    it('should handle case-sensitive platform names', () => {
      const upperCaseEmote = new EmoteNode('123', 'TestEmote', 'KICK')
      expect(upperCaseEmote.getTextContent()).toBe(' ')
      
      const mixedCaseEmote = new EmoteNode('456', 'TestEmote', '7TV')
      expect(mixedCaseEmote.getTextContent()).toBe(' ')
    })
  })

  describe('Component Lifecycle', () => {
    it('should maintain properties after clone', () => {
      const original = new EmoteNode('123', 'TestEmote', 'kick', 'test-key')
      const cloned = EmoteNode.clone(original)
      
      expect(cloned.__emoteId).toBe(original.__emoteId)
      expect(cloned.__emoteName).toBe(original.__emoteName)
      expect(cloned.__platform).toBe(original.__platform)
      expect(cloned.__key).toBe(original.__key)
    })

    it('should export and import JSON correctly', () => {
      const original = new EmoteNode('789', 'RoundTripEmote', '7tv')
      const json = original.exportJSON()
      const imported = EmoteNode.importJSON(json)
      
      expect(imported.__emoteId).toBe(original.__emoteId)
      expect(imported.__emoteName).toBe(original.__emoteName)
      expect(imported.__platform).toBe(original.__platform)
    })

    it('should create consistent DOM elements', () => {
      const emoteNode = new EmoteNode('123', 'TestEmote', 'kick')
      
      const dom1 = emoteNode.createDOM()
      const dom2 = emoteNode.createDOM()
      
      expect(dom1.className).toBe(dom2.className)
      expect(dom1.tagName).toBe(dom2.tagName)
    })
  })
})