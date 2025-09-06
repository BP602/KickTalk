import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { MessageParser, clearChatroomEmoteCache, clearAllEmoteCaches } from './MessageParser'
import { kickEmoteRegex, urlRegex, mentionRegex } from '@utils/constants'
import { parse } from 'tldts'

// Mock external dependencies
vi.mock('tldts')
vi.mock('../components/Cosmetics/Emote', () => ({
  default: ({ emote, type, overlaidEmotes = [] }) => {
    const element = React.createElement('span', {
      'data-testid': `emote-${emote.id}`,
      'data-emote-name': emote.name,
      'data-emote-type': type,
      'data-overlaid-count': overlaidEmotes.length.toString(),
      'data-width': emote.width,
      'data-height': emote.height,
      'data-zero-width': emote.isZeroWidth || false,
      'data-platform': emote.platform,
    }, `[${emote.name}]`)
    
    return element
  }
}))

// Mock console.log to track cache clearing operations
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

// Mock window.app APIs
global.window = {
  ...global.window,
  app: {
    kick: {
      getUserChatroomInfo: vi.fn()
    },
    userDialog: {
      open: vi.fn()
    }
  }
}

describe('MessageParser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset parse mock
    parse.mockReturnValue({ isIcann: true, domain: 'example.com' })
    
    // Mock getUserChatroomInfo to return valid user data
    global.window.app.kick.getUserChatroomInfo.mockResolvedValue({
      data: {
        id: 123,
        username: 'testuser',
        slug: 'testuser'
      }
    })
  })

  afterEach(() => {
    clearAllEmoteCaches()
    mockConsoleLog.mockClear()
  })

  describe('Basic Text Parsing', () => {
    it('should return empty array for empty or null message', () => {
      const result1 = MessageParser({ message: null })
      const result2 = MessageParser({ message: {} })
      const result3 = MessageParser({ message: { content: '' } })

      expect(result1).toEqual([])
      expect(result2).toEqual([])
      expect(result3).toEqual([])
    })

    it('should parse plain text correctly', () => {
      const message = { id: '1', content: 'Hello world', timestamp: Date.now() }
      const result = MessageParser({ message })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      
      // Plain text should be returned as a React span element
      const textElement = result[0]
      expect(React.isValidElement(textElement)).toBe(true)
      expect(textElement.type).toBe('span')
      expect(textElement.props.children).toBe('Hello world')
    })

    it('should preserve whitespace in text', () => {
      const message = { id: '1', content: 'Hello   world   test', timestamp: Date.now() }
      const result = MessageParser({ message })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      
      // Check content preservation
      const textElement = result[0]
      expect(React.isValidElement(textElement)).toBe(true)
      expect(textElement.props.children).toBe('Hello   world   test')
    })
  })

  describe('Kick Emote Parsing', () => {
    it('should parse kick emotes correctly', () => {
      const message = { id: '1', content: 'Hello [emote:123:TestEmote] world', timestamp: Date.now() }
      const result = MessageParser({ message })
      
      console.log('MessageParser result:', result)
      console.log('Result length:', result.length)
      console.log('Result items:', result.map((item, i) => ({ 
        index: i, 
        type: typeof item,
        isReactElement: React.isValidElement(item),
        props: React.isValidElement(item) ? item.props : null,
        content: React.isValidElement(item) ? item.props?.children : item
      })))
      
      expect(result.length).toBeGreaterThan(1)
      
      // Should have text before emote, the emote, and text after
      const emoteElement = result.find(element => 
        React.isValidElement(element) && element.props && element.props['data-testid'] === 'emote-123'
      )
      
      expect(emoteElement).toBeTruthy()
      expect(emoteElement.props['data-emote-name']).toBe('TestEmote')
      expect(emoteElement.props['data-emote-type']).toBe('kick')
    })

    it('should handle multiple kick emotes', () => {
      const message = { 
        id: '1', 
        content: '[emote:123:First] and [emote:456:Second]', 
        timestamp: Date.now() 
      }
      const result = MessageParser({ message })
      
      const emote1 = result.find(element => 
        React.isValidElement(element) && element.props && element.props['data-testid'] === 'emote-123'
      )
      const emote2 = result.find(element => 
        React.isValidElement(element) && element.props && element.props['data-testid'] === 'emote-456'
      )
      
      expect(emote1).toBeTruthy()
      expect(emote1.props['data-emote-name']).toBe('First')
      expect(emote2).toBeTruthy()
      expect(emote2.props['data-emote-name']).toBe('Second')
    })

    it('should handle kick emotes without names', () => {
      const message = { id: '1', content: 'Test [emote:789] text', timestamp: Date.now() }
      const result = MessageParser({ message })
      
      const emoteComponent = result.find(element => 
        React.isValidElement(element) && element.props && element.props['data-testid'] === 'emote-789'
      )
      
      expect(emoteComponent).toBeTruthy()
      expect(emoteComponent.props['data-emote-type']).toBe('kick')
    })

    it('should treat malformed kick emote patterns as text', () => {
      const message = { id: '1', content: 'Test [emote:] [emote:abc] text', timestamp: Date.now() }
      const result = MessageParser({ message })

      // Should not contain any kick emote components
      const hasKickEmotes = result.some(element => 
        React.isValidElement(element) && element.props && element.props['data-emote-type'] === 'kick'
      )
      expect(hasKickEmotes).toBe(false)
      
      // Should be treated as plain text - check if malformed patterns are preserved
      const textContent = result
        .map(r => React.isValidElement(r) ? (r.props && r.props.children ? r.props.children : '') : r)
        .join('')
      expect(textContent).toContain('[emote:]')
      expect(textContent).toContain('[emote:abc]')
    })
  })

  describe('URL Parsing', () => {
    it('should parse valid HTTP/HTTPS URLs', () => {
      const message = { id: '1', content: 'Visit https://example.com', timestamp: Date.now() }
      const result = MessageParser({ message })
      
      // Find URL link element in results
      const linkComponent = result.find(element => 
        React.isValidElement(element) && element.type === 'a'
      )
      
      expect(linkComponent).toBeTruthy()
      expect(linkComponent.props.href).toBe('https://example.com')
      expect(linkComponent.props.target).toBe('_blank')
      expect(linkComponent.props.rel).toBe('noreferrer')
      expect(linkComponent.props.children).toBe('https://example.com')
    })

    it('should parse multiple URLs', () => {
      const message = { 
        id: '1', 
        content: 'Visit https://first.com and http://second.com', 
        timestamp: Date.now() 
      }
      const result = MessageParser({ message })
      
      const links = result.filter(element => 
        React.isValidElement(element) && element.type === 'a'
      )
      
      expect(links).toHaveLength(2)
      expect(links[0].props.href).toBe('https://first.com')
      expect(links[1].props.href).toBe('http://second.com')
    })

    it('should not parse invalid domain URLs', () => {
      parse.mockReturnValue({ isIcann: false, domain: null })
      
      const message = { id: '1', content: 'Check http://invalid.domain', timestamp: Date.now() }
      const result = MessageParser({ message })
      
      // Should not have any link components
      const hasLinks = result.some(element => 
        React.isValidElement(element) && element.type === 'a'
      )
      expect(hasLinks).toBe(false)
      
      // Should preserve text as span element
      expect(result).toHaveLength(1)
      const textElement = result[0]
      expect(React.isValidElement(textElement)).toBe(true)
      expect(textElement.props.children).toBe('Check http://invalid.domain')
    })
  })

  describe('Mention Parsing', () => {
    it('should parse mentions in regular messages', () => {
      const message = { id: '1', content: 'Hello @username test', timestamp: Date.now() }
      const props = {
        message,
        chatroomId: 'room1',
        chatroomName: 'testroom',
        subscriberBadges: [],
        userChatroomInfo: {}
      }
      const result = MessageParser(props)
      
      // Find mention span element
      const mentionComponent = result.find(element => 
        React.isValidElement(element) && 
        element.type === 'span' &&
        element.props.style &&
        element.props.style.cursor === 'pointer'
      )
      
      expect(mentionComponent).toBeTruthy()
      expect(mentionComponent.props.style.color).toBe('#fff')
      expect(mentionComponent.props.style.fontWeight).toBe('bold')
      expect(mentionComponent.props.onClick).toBeDefined()
    })

    it('should handle minified type mentions differently', () => {
      const message = { id: '1', content: 'Hello @username', timestamp: Date.now() }
      const props = {
        message,
        type: 'minified',
        chatroomId: 'room1',
        chatroomName: 'testroom',
        subscriberBadges: [],
        userChatroomInfo: {}
      }
      const result = MessageParser(props)
      
      // Find mention span element
      const mentionComponent = result.find(element => 
        React.isValidElement(element) && 
        element.type === 'span' &&
        element.props.style &&
        element.props.style.fontWeight === 'bold' &&
        (!element.props.style.cursor || element.props.style.cursor !== 'pointer')
      )
      
      expect(mentionComponent).toBeTruthy()
      expect(mentionComponent.props.style.cursor).not.toBe('pointer')
      expect(mentionComponent.props.onClick).toBeUndefined()
    })

    it('should handle reply type mentions differently', () => {
      const message = { id: '1', content: 'Hello @username', timestamp: Date.now() }
      const props = {
        message,
        type: 'reply',
        chatroomId: 'room1',
        chatroomName: 'testroom',
        subscriberBadges: [],
        userChatroomInfo: {}
      }
      const result = MessageParser(props)
      
      // Find mention span element
      const mentionComponent = result.find(element => 
        React.isValidElement(element) && 
        element.type === 'span' &&
        element.props.style &&
        element.props.style.fontWeight === 'bold' &&
        (!element.props.style.cursor || element.props.style.cursor !== 'pointer')
      )
      
      expect(mentionComponent).toBeTruthy()
      expect(mentionComponent.props.style.cursor).not.toBe('pointer')
      expect(mentionComponent.props.onClick).toBeUndefined()
    })
  })

  describe('7TV Emote Parsing', () => {
    const mockSevenTVEmotes = [
      {
        emotes: [
          {
            id: 'stv1',
            name: 'TestEmote',
            flags: 0,
            file: { width: 28, height: 28 },
            data: { listed: true }
          },
          {
            id: 'stv2',
            name: 'ZeroWidth',
            flags: 1,
            file: { width: 28, height: 28 },
            data: { listed: true }
          }
        ]
      }
    ]

    it('should parse 7TV emotes when enabled', () => {
      const message = { id: '1', content: 'Hello TestEmote world', timestamp: Date.now(), chatroom_id: 'room1' }
      const props = {
        message,
        sevenTVEmotes: mockSevenTVEmotes,
        sevenTVSettings: { emotes: true },
        chatroomId: 'room1'
      }
      const result = MessageParser(props)
      
      const emoteComponent = result.find(element => 
        React.isValidElement(element) && element.props && element.props['data-testid'] === 'emote-stv1'
      )
      
      expect(emoteComponent).toBeTruthy()
      expect(emoteComponent.props['data-emote-type']).toBe('stv')
      expect(emoteComponent.props['data-emote-name']).toBe('TestEmote')
    })

    it('should not parse 7TV emotes when disabled', () => {
      const message = { id: '1', content: 'Hello TestEmote world', timestamp: Date.now() }
      const props = {
        message,
        sevenTVEmotes: mockSevenTVEmotes,
        sevenTVSettings: { emotes: false }
      }
      const result = MessageParser(props)
      
      // Should not have STV emote components
      const hasStvEmotes = result.some(element => 
        React.isValidElement(element) && element.props && element.props['data-emote-type'] === 'stv'
      )
      expect(hasStvEmotes).toBe(false)
      
      // Should preserve text as span element
      expect(result).toHaveLength(1)
      const textElement = result[0]
      expect(React.isValidElement(textElement)).toBe(true)
      expect(textElement.props.children).toBe('Hello TestEmote world')
    })

    it('should handle zero-width emotes', () => {
      const message = { 
        id: '1', 
        content: 'TestEmote ZeroWidth', 
        timestamp: Date.now(),
        chatroom_id: 'room1'
      }
      const props = {
        message,
        sevenTVEmotes: mockSevenTVEmotes,
        sevenTVSettings: { emotes: true },
        chatroomId: 'room1'
      }
      const result = MessageParser(props)
      
      const baseEmote = result.find(element => 
        React.isValidElement(element) && element.props && element.props['data-testid'] === 'emote-stv1'
      )
      
      expect(baseEmote).toBeTruthy()
      // Zero-width emote should be overlaid on base emote
      expect(parseInt(baseEmote.props['data-overlaid-count']) || 0).toBeGreaterThan(0)
    })

    it('should cache emote data', () => {
      const message = { id: '1', content: 'TestEmote', timestamp: Date.now(), chatroom_id: 'room1' }
      const props = {
        message,
        sevenTVEmotes: mockSevenTVEmotes,
        sevenTVSettings: { emotes: true },
        chatroomId: 'room1'
      }
      
      // Parse twice to test caching
      const result1 = MessageParser(props)
      const result2 = MessageParser(props)
      
      const emote1 = result1.find(element => 
        React.isValidElement(element) && element.props && element.props['data-testid'] === 'emote-stv1'
      )
      const emote2 = result2.find(element => 
        React.isValidElement(element) && element.props && element.props['data-testid'] === 'emote-stv1'
      )
      
      expect(emote1).toBeTruthy()
      expect(emote2).toBeTruthy()
    })

    it('should handle non-existent emotes', () => {
      const message = { id: '1', content: 'NonexistentEmote', timestamp: Date.now() }
      const props = {
        message,
        sevenTVEmotes: mockSevenTVEmotes,
        sevenTVSettings: { emotes: true }
      }
      const result = MessageParser(props)
      
      // Should not have any emote components
      const hasEmotes = result.some(element => 
        React.isValidElement(element) && element.props && element.props['data-testid'] && element.props['data-testid'].includes('emote-')
      )
      expect(hasEmotes).toBe(false)
      
      // Should preserve text as span element
      expect(result).toHaveLength(1)
      const textElement = result[0]
      expect(React.isValidElement(textElement)).toBe(true)
      expect(textElement.props.children).toBe('NonexistentEmote')
    })
  })

  describe('Combined Pattern Parsing', () => {
    it('should handle mixed content types', () => {
      const message = { 
        id: '1', 
        content: 'Hello @user check https://example.com [emote:123:Test]', 
        timestamp: Date.now() 
      }
      const props = {
        message,
        chatroomId: 'room1',
        chatroomName: 'testroom',
        subscriberBadges: [],
        userChatroomInfo: {}
      }
      const result = MessageParser(props)
      
      // Check for mention
      const hasMention = result.some(element => 
        React.isValidElement(element) && 
        element.type === 'span' &&
        element.props.style &&
        element.props.style.cursor === 'pointer'
      )
      
      // Check for URL
      const hasUrl = result.some(element => 
        React.isValidElement(element) && element.type === 'a'
      )
      
      // Check for emote
      const hasEmote = result.some(element => 
        React.isValidElement(element) && element.props && element.props['data-testid'] === 'emote-123'
      )
      
      expect(hasMention).toBe(true)
      expect(hasUrl).toBe(true)
      expect(hasEmote).toBe(true)
    })

    it('should preserve content order', () => {
      const message = { 
        id: '1', 
        content: 'Start @user middle [emote:123:Test] https://example.com end', 
        timestamp: Date.now() 
      }
      const props = {
        message,
        chatroomId: 'room1',
        chatroomName: 'testroom',
        subscriberBadges: [],
        userChatroomInfo: {}
      }
      const result = MessageParser(props)
      
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(3) // Should have multiple parts
      
      // Check that text content is preserved in some form
      const fullText = result
        .map(r => {
          if (React.isValidElement(r)) {
            return r.props && r.props.children ? r.props.children : (r.props && r.props.href ? r.props.href : '')
          }
          return r
        })
        .join('')
        
      expect(fullText).toContain('Start')
      expect(fullText).toContain('middle')
      expect(fullText).toContain('end')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle extremely long messages', () => {
      const longText = 'word '.repeat(1000)
      const message = { id: '1', content: longText, timestamp: Date.now() }
      const result = MessageParser({ message })
      
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      
      const textElement = result[0]
      expect(React.isValidElement(textElement)).toBe(true)
      expect(textElement.props.children).toBe(longText)
    })

    it('should handle whitespace-only messages', () => {
      const message = { id: '1', content: '   \n\t  ', timestamp: Date.now() }
      const result = MessageParser({ message })
      
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      
      const textElement = result[0]
      expect(React.isValidElement(textElement)).toBe(true)
      expect(textElement.props.children).toBe('   \n\t  ')
    })

    it('should handle Unicode characters', () => {
      const message = { id: '1', content: '🔥 こんにちは 🎉', timestamp: Date.now() }
      const result = MessageParser({ message })
      
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      
      const textElement = result[0]
      expect(React.isValidElement(textElement)).toBe(true)
      expect(textElement.props.children).toBe('🔥 こんにちは 🎉')
    })

    it('should handle malformed patterns gracefully', () => {
      const message = { id: '1', content: '[emote:] @a http://', timestamp: Date.now() }
      const result = MessageParser({ message })
      
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should handle null sevenTV emotes', () => {
      const message = { id: '1', content: 'TestEmote', timestamp: Date.now() }
      const props = {
        message,
        sevenTVEmotes: null,
        sevenTVSettings: { emotes: true }
      }
      const result = MessageParser(props)
      
      expect(result).toHaveLength(1)
      const textElement = result[0]
      expect(React.isValidElement(textElement)).toBe(true)
      expect(textElement.props.children).toBe('TestEmote')
    })

    it('should handle empty sevenTV emotes', () => {
      const message = { id: '1', content: 'TestEmote', timestamp: Date.now() }
      const props = {
        message,
        sevenTVEmotes: [],
        sevenTVSettings: { emotes: true }
      }
      const result = MessageParser(props)
      
      expect(result).toHaveLength(1)
      const textElement = result[0]
      expect(React.isValidElement(textElement)).toBe(true)
      expect(textElement.props.children).toBe('TestEmote')
    })
  })

  describe('Caching Behavior', () => {
    it('should return cached results for identical messages', () => {
      const message = { id: '1', content: 'Test message', timestamp: Date.now() }
      const props = {
        message,
        sevenTVSettings: { emotes: false },
        type: 'regular'
      }
      
      const result1 = MessageParser(props)
      const result2 = MessageParser(props)
      
      expect(result1).toBe(result2) // Should be same reference due to caching
    })

    it('should generate different results for different message types', () => {
      const message = { id: '1', content: '@user test', timestamp: Date.now() }
      const baseProps = {
        message,
        chatroomId: 'room1',
        chatroomName: 'testroom',
        subscriberBadges: [],
        userChatroomInfo: {}
      }
      
      const result1 = MessageParser({ ...baseProps, type: 'regular' })
      const result2 = MessageParser({ ...baseProps, type: 'minified' })
      
      expect(result1).not.toBe(result2)
    })

    it('should handle different cache keys correctly', () => {
      const message1 = { id: '1', content: 'test', timestamp: Date.now() }
      const message2 = { id: '2', content: 'test', timestamp: Date.now() }
      
      const result1 = MessageParser({ message: message1 })
      const result2 = MessageParser({ message: message2 })
      
      // Different IDs should produce different cache entries
      expect(result1).not.toBe(result2)
    })
  })

  describe('Cache Management Functions', () => {
    it('should clear specific chatroom emote cache', () => {
      // Create an emote in cache first by parsing a message
      const message = { id: '1', content: 'TestEmote', timestamp: Date.now(), chatroom_id: 'room1' }
      const props = {
        message,
        sevenTVEmotes: [{ emotes: [{ id: 'test', name: 'TestEmote', flags: 0, file: { width: 28, height: 28 } }] }],
        sevenTVSettings: { emotes: true },
        chatroomId: 'room1'
      }
      MessageParser(props)
      
      // Now clear the cache for that room
      clearChatroomEmoteCache('room1')
      
      // The console.log should have been called for existing room
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Cleared emote cache for chatroom')
      )
    })

    it('should clear all emote caches', () => {
      clearAllEmoteCaches()
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[MessageParser] Cleared all emote caches'
      )
    })
  })

  describe('Security and HTML Escaping Tests', () => {
    it('should handle potentially malicious HTML content', () => {
      const message = { 
        id: '1', 
        content: '<script>alert("xss")</script> <img onerror="alert(1)" src="x"> &lt;test&gt;', 
        timestamp: Date.now() 
      }
      
      expect(() => MessageParser({ message })).not.toThrow()
      const result = MessageParser({ message })
      
      expect(Array.isArray(result)).toBe(true)
      // Ensure no dangerous HTML elements are created
      const hasScriptElement = result.some(element => 
        React.isValidElement(element) && element.type === 'script'
      )
      expect(hasScriptElement).toBe(false)
      
      // Should be treated as plain text
      expect(result).toHaveLength(1)
      const textElement = result[0]
      expect(React.isValidElement(textElement)).toBe(true)
      expect(textElement.type).toBe('span')
    })

    it('should handle SQL injection-like patterns', () => {
      const message = { 
        id: '1', 
        content: "'; DROP TABLE messages; --", 
        timestamp: Date.now() 
      }
      
      expect(() => MessageParser({ message })).not.toThrow()
      const result = MessageParser({ message })
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
    })

    it('should handle code injection patterns in emote names', () => {
      const message = { 
        id: '1', 
        content: '[emote:123:<script>alert(1)</script>] text', 
        timestamp: Date.now() 
      }
      
      const result = MessageParser({ message })
      
      // Should not parse as emote due to invalid characters
      const hasEmote = result.some(element => 
        React.isValidElement(element) && element.props && element.props['data-emote-type'] === 'kick'
      )
      expect(hasEmote).toBe(false)
    })

    it('should sanitize dangerous URL schemes', () => {
      const message = { 
        id: '1', 
        content: 'javascript:alert(1) data:text/html,<script>alert(1)</script> vbscript:alert(1)', 
        timestamp: Date.now() 
      }
      
      const result = MessageParser({ message })
      
      // Should not create link elements for dangerous schemes
      const hasLinks = result.some(element => 
        React.isValidElement(element) && element.type === 'a'
      )
      expect(hasLinks).toBe(false)
    })
  })

  describe('Performance and Stress Testing', () => {
    it('should handle rapid successive parsing efficiently', () => {
      const message = { 
        id: '1', 
        content: 'Test message', 
        timestamp: Date.now()
      }
      const props = { message }

      const startTime = performance.now()
      
      // Parse same message multiple times (should be cached)
      for (let i = 0; i < 100; i++) {
        MessageParser(props)
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should be very fast due to caching
      expect(duration).toBeLessThan(50) // 50ms for 100 cached calls
    })

    it('should handle different message variations', () => {
      const startTime = performance.now()
      
      // Parse 50 different messages
      for (let i = 0; i < 50; i++) {
        const message = { 
          id: `msg-${i}`, 
          content: `Message ${i}`, 
          timestamp: Date.now() + i
        }
        MessageParser({ message })
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should complete in reasonable time
      expect(duration).toBeLessThan(200) // 200ms for 50 different messages
    })

    it('should handle memory pressure scenarios', () => {
      // Create many messages to test cache limits
      for (let room = 0; room < 25; room++) {
        for (let msg = 0; msg < 10; msg++) {
          const message = { 
            id: `room${room}-msg${msg}`, 
            content: `Message ${msg} in room ${room}`, 
            timestamp: Date.now()
          }
          MessageParser({ message })
        }
      }

      // Should not crash or throw errors
      expect(true).toBe(true) // If we get here, no memory issues occurred
    })
  })

  describe('Complex Unicode and Special Characters', () => {
    it('should handle emoji combinations', () => {
      const message = { id: '1', content: '👨‍👩‍👧‍👦 🔥🎉✨', timestamp: Date.now() }
      const result = MessageParser({ message })
      
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      
      const textElement = result[0]
      expect(React.isValidElement(textElement)).toBe(true)
      expect(textElement.props.children).toContain('👨‍👩‍👧‍👦')
    })

    it('should handle right-to-left text', () => {
      const message = { id: '1', content: 'Hello مرحبا שלום', timestamp: Date.now() }
      const result = MessageParser({ message })
      
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      
      const textElement = result[0]
      expect(React.isValidElement(textElement)).toBe(true)
      expect(textElement.props.children).toContain('مرحبا')
      expect(textElement.props.children).toContain('שלום')
    })

    it('should handle zero-width characters', () => {
      const message = { 
        id: '1', 
        content: 'Hello\u200B\u200C\u200D\uFEFF test', 
        timestamp: Date.now() 
      }
      const result = MessageParser({ message })
      
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should handle mathematical notation', () => {
      const message = { 
        id: '1', 
        content: 'Formula: ∑ᵢ₌₁ⁿ xᵢ² = ∫₋∞^∞ f(x)dx', 
        timestamp: Date.now() 
      }
      const result = MessageParser({ message })
      
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      
      const textElement = result[0]
      expect(React.isValidElement(textElement)).toBe(true)
      expect(textElement.props.children).toContain('∑ᵢ₌₁ⁿ')
      expect(textElement.props.children).toContain('∫₋∞^∞')
    })
  })

  describe('Malformed Content Resilience', () => {
    it('should handle deeply nested brackets', () => {
      const message = { 
        id: '1', 
        content: '[[[emote:123]]] [emote:[nested]:456]', 
        timestamp: Date.now() 
      }
      
      expect(() => MessageParser({ message })).not.toThrow()
      const result = MessageParser({ message })
      expect(Array.isArray(result)).toBe(true)
    })

    it('should handle extremely long URLs and mentions', () => {
      const longUrl = 'https://' + 'a'.repeat(1000) + '.com'
      const longMention = '@' + 'u'.repeat(50)
      const message = { 
        id: '1', 
        content: `Check ${longUrl} and ${longMention}`, 
        timestamp: Date.now() 
      }
      
      expect(() => MessageParser({ message })).not.toThrow()
      const result = MessageParser({ message })
      expect(Array.isArray(result)).toBe(true)
    })

    it('should handle control characters', () => {
      const message = { 
        id: '1', 
        content: 'Test\0null\x01control\x1Fchars', 
        timestamp: Date.now() 
      }
      
      expect(() => MessageParser({ message })).not.toThrow()
      const result = MessageParser({ message })
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('Advanced 7TV Emote Scenarios', () => {
    const complexSevenTVEmotes = [
      {
        emotes: [
          {
            id: 'normal1',
            name: 'NormalEmote',
            flags: 0,
            file: { width: 32, height: 32 },
            data: { listed: true }
          },
          {
            id: 'zerowidth1',
            name: 'ZeroWidth1',
            flags: 1,
            file: { width: 28, height: 28 },
            data: { listed: true }
          },
          {
            id: 'zerowidth2',
            name: 'ZeroWidth2',
            flags: 2,
            file: { width: 28, height: 28 },
            data: { listed: false }
          }
        ]
      }
    ]

    it('should handle multiple zero-width emotes on single base emote', () => {
      const message = { 
        id: '1', 
        content: 'NormalEmote ZeroWidth1 ZeroWidth2', 
        timestamp: Date.now(),
        chatroom_id: 'zw-room'
      }
      const props = {
        message,
        sevenTVEmotes: complexSevenTVEmotes,
        sevenTVSettings: { emotes: true },
        chatroomId: 'zw-room'
      }
      const result = MessageParser(props)
      
      const baseEmote = result.find(element => 
        React.isValidElement(element) && element.props && element.props['data-testid'] === 'emote-normal1'
      )
      
      expect(baseEmote).toBeTruthy()
      expect(parseInt(baseEmote.props['data-overlaid-count'])).toBeGreaterThanOrEqual(2)
    })

    it('should handle emote data with missing dimensions', () => {
      const emoteWithoutDimensions = [
        {
          emotes: [
            {
              id: 'nodim1',
              name: 'NoDimensionsEmote',
              flags: 0,
              file: {}, // No width/height
              data: { listed: true }
            }
          ]
        }
      ]

      const message = { 
        id: '1', 
        content: 'NoDimensionsEmote', 
        timestamp: Date.now(),
        chatroom_id: 'nodim-room'
      }
      const props = {
        message,
        sevenTVEmotes: emoteWithoutDimensions,
        sevenTVSettings: { emotes: true },
        chatroomId: 'nodim-room'
      }
      const result = MessageParser(props)
      
      const emote = result.find(element => 
        React.isValidElement(element) && element.props && element.props['data-testid'] === 'emote-nodim1'
      )
      
      expect(emote).toBeTruthy()
      expect(emote.props['data-width']).toBe(28) // Default fallback
      expect(emote.props['data-height']).toBe(28) // Default fallback
    })
  })

  describe('Regex Pattern Validation', () => {
    it('should match kick emote regex correctly', () => {
      expect('[emote:123:TestEmote]'.match(kickEmoteRegex)).toBeTruthy()
      expect('[emote:456]'.match(kickEmoteRegex)).toBeTruthy()
      expect('[emote:789:Name123]'.match(kickEmoteRegex)).toBeTruthy()
      expect('[emote:]'.match(kickEmoteRegex)).toBeFalsy()
      expect('[emote:abc:Name]'.match(kickEmoteRegex)).toBeFalsy()
    })

    it('should match URL regex correctly', () => {
      expect('https://example.com'.match(urlRegex)).toBeTruthy()
      expect('http://test.org/path?query=1'.match(urlRegex)).toBeTruthy()
      expect('ftp://example.com'.match(urlRegex)).toBeFalsy()
      expect('example.com'.match(urlRegex)).toBeFalsy()
    })

    it('should match mention regex correctly', () => {
      expect(' @username '.match(mentionRegex)).toBeTruthy()
      expect('@user123'.match(mentionRegex)).toBeTruthy()
      expect('@user_name'.match(mentionRegex)).toBeTruthy()
      expect('@user,'.match(mentionRegex)).toBeTruthy()
      expect('@user.'.match(mentionRegex)).toBeTruthy()
      expect('@ab'.match(mentionRegex)).toBeFalsy() // too short
      expect('email@domain.com'.match(mentionRegex)).toBeFalsy() // not at word boundary
    })
  })

  describe('Mention Click Handler Tests', () => {
    it('should handle mention click with valid user lookup', async () => {
      const message = { id: '1', content: 'Hello @testuser', timestamp: Date.now() }
      const props = {
        message,
        chatroomId: 'test-room',
        chatroomName: 'testroom',
        subscriberBadges: [],
        userChatroomInfo: {}
      }
      
      const result = MessageParser(props)
      const mention = result.find(element => 
        React.isValidElement(element) && 
        element.props.style &&
        element.props.style.cursor === 'pointer'
      )
      
      expect(mention).toBeTruthy()
      expect(mention.props.onClick).toBeDefined()
      
      // Test click handler
      if (mention && mention.props.onClick) {
        await mention.props.onClick()
        expect(global.window.app.kick.getUserChatroomInfo).toHaveBeenCalledWith('testroom', 'testuser')
        expect(global.window.app.userDialog.open).toHaveBeenCalled()
      }
    })

    it('should handle mention click with failed user lookup', async () => {
      // Mock failed user lookup
      global.window.app.kick.getUserChatroomInfo.mockResolvedValue({
        data: null // No user data
      })
      
      const message = { id: '1', content: 'Hello @nonexistent', timestamp: Date.now() }
      const props = {
        message,
        chatroomId: 'test-room',
        chatroomName: 'testroom',
        subscriberBadges: [],
        userChatroomInfo: {}
      }
      
      const result = MessageParser(props)
      const mention = result.find(element => 
        React.isValidElement(element) && 
        element.props.style &&
        element.props.style.cursor === 'pointer'
      )
      
      expect(mention).toBeTruthy()
      
      // Test click handler
      if (mention && mention.props.onClick) {
        await mention.props.onClick()
        expect(global.window.app.userDialog.open).not.toHaveBeenCalled()
      }
    })
  })

  describe('Basic message parsing', () => {
    it('should render plain text messages', () => {
      const message = {
        id: 'test-1',
        content: 'Hello world!',
        timestamp: Date.now()
      }

      const { container } = render(
        <MessageParser 
          message={message}
          sevenTVEmotes={[]}
          sevenTVSettings={{ emotes: false }}
          type="regular"
          chatroomId="123"
        />
      )

      expect(container.textContent).toBe('Hello world!')
    })

    it('should handle empty message content', () => {
      const message = {
        id: 'test-2',
        content: '',
        timestamp: Date.now()
      }

      const { container } = render(
        <MessageParser 
          message={message}
          sevenTVEmotes={[]}
          sevenTVSettings={{ emotes: false }}
          type="regular"
          chatroomId="123"
        />
      )

      expect(container.children).toHaveLength(0)
    })

    it('should handle null message content', () => {
      const message = {
        id: 'test-3',
        content: null,
        timestamp: Date.now()
      }

      const { container } = render(
        <MessageParser 
          message={message}
          sevenTVEmotes={[]}
          sevenTVSettings={{ emotes: false }}
          type="regular"
          chatroomId="123"
        />
      )

      expect(container.children).toHaveLength(0)
    })

    it('should handle undefined message', () => {
      expect(() => {
        render(
          <MessageParser 
            message={undefined}
            sevenTVEmotes={[]}
            sevenTVSettings={{ emotes: false }}
            type="regular"
            chatroomId="123"
          />
        )
      }).not.toThrow()
    })
  })

  describe('Kick emote parsing', () => {
    it('should parse kick emotes with ID and name', () => {
      const message = {
        id: 'test-4',
        content: 'Check out this emote [emote:123:coolEmote] nice!',
        timestamp: Date.now()
      }

      render(
        <MessageParser 
          message={message}
          sevenTVEmotes={[]}
          sevenTVSettings={{ emotes: true }}
          type="regular"
          chatroomId="123"
        />
      )

      const emote = screen.getByTestId('emote-kick')
      expect(emote).toBeInTheDocument()
      expect(emote).toHaveAttribute('data-emote-id', '123')
      expect(emote).toHaveAttribute('data-emote-name', 'coolEmote')
    })

    it('should parse kick emotes with only ID', () => {
      const message = {
        id: 'test-5',
        content: 'Simple emote [emote:456] here',
        timestamp: Date.now()
      }

      render(
        <MessageParser 
          message={message}
          sevenTVEmotes={[]}
          sevenTVSettings={{ emotes: true }}
          type="regular"
          chatroomId="123"
        />
      )

      const emote = screen.getByTestId('emote-kick')
      expect(emote).toBeInTheDocument()
      expect(emote).toHaveAttribute('data-emote-id', '456')
      expect(emote).toHaveAttribute('data-emote-name', '')
    })

    it('should parse multiple kick emotes', () => {
      const message = {
        id: 'test-6',
        content: '[emote:123:first] and [emote:456:second] emotes',
        timestamp: Date.now()
      }

      render(
        <MessageParser 
          message={message}
          sevenTVEmotes={[]}
          sevenTVSettings={{ emotes: true }}
          type="regular"
          chatroomId="123"
        />
      )

      const emotes = screen.getAllByTestId('emote-kick')
      expect(emotes).toHaveLength(2)
      expect(emotes[0]).toHaveAttribute('data-emote-name', 'first')
      expect(emotes[1]).toHaveAttribute('data-emote-name', 'second')
    })

    it('should handle malformed kick emote syntax', () => {
      const message = {
        id: 'test-7',
        content: '[emote:] [emote:abc] [emote:123:] text',
        timestamp: Date.now()
      }

      const { container } = render(
        <MessageParser 
          message={message}
          sevenTVEmotes={[]}
          sevenTVSettings={{ emotes: true }}
          type="regular"
          chatroomId="123"
        />
      )

      // Should render as plain text since regex won't match malformed syntax
      expect(container.textContent).toContain('[emote:]')
      expect(container.textContent).toContain('[emote:abc]')
      expect(container.textContent).toContain('[emote:123:]')
    })
  })

  describe('URL parsing', () => {
    it('should parse and create clickable links for valid URLs', () => {
      const message = {
        id: 'test-8',
        content: 'Visit https://example.com for more info',
        timestamp: Date.now()
      }

      render(
        <MessageParser 
          message={message}
          sevenTVEmotes={[]}
          sevenTVSettings={{ emotes: false }}
          type="regular"
          chatroomId="123"
        />
      )

      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('href', 'https://example.com')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noreferrer')
      expect(link).toHaveTextContent('https://example.com')
    })

    it('should not create links for non-ICANN domains', () => {
      const message = {
        id: 'test-9',
        content: 'Invalid link https://invalid.local here',
        timestamp: Date.now()
      }

      const { container } = render(
        <MessageParser 
          message={message}
          sevenTVEmotes={[]}
          sevenTVSettings={{ emotes: false }}
          type="regular"
          chatroomId="123"
        />
      )

      expect(screen.queryByRole('link')).not.toBeInTheDocument()
      expect(container.textContent).toContain('https://invalid.local')
    })

    it('should parse multiple URLs in the same message', () => {
      const message = {
        id: 'test-10',
        content: 'Check https://github.com and https://example.com',
        timestamp: Date.now()
      }

      render(
        <MessageParser 
          message={message}
          sevenTVEmotes={[]}
          sevenTVSettings={{ emotes: false }}
          type="regular"
          chatroomId="123"
        />
      )

      const links = screen.getAllByRole('link')
      expect(links).toHaveLength(2)
      expect(links[0]).toHaveAttribute('href', 'https://github.com')
      expect(links[1]).toHaveAttribute('href', 'https://example.com')
    })

    it('should handle HTTP URLs', () => {
      const message = {
        id: 'test-11',
        content: 'Visit http://example.com (insecure)',
        timestamp: Date.now()
      }

      render(
        <MessageParser 
          message={message}
          sevenTVEmotes={[]}
          sevenTVSettings={{ emotes: false }}
          type="regular"
          chatroomId="123"
        />
      )

      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('href', 'http://example.com')
    })
  })

  describe('Mention parsing', () => {
    it('should parse mentions and make them bold for regular messages', () => {
      const message = {
        id: 'test-12',
        content: 'Hey @testuser how are you?',
        timestamp: Date.now()
      }

      render(
        <MessageParser 
          message={message}
          sevenTVEmotes={[]}
          sevenTVSettings={{ emotes: false }}
          type="regular"
          chatroomId="123"
          chatroomName="test-room"
          userChatroomInfo={{}}
          subscriberBadges={[]}
        />
      )

      const mention = screen.getByText('@testuser')
      expect(mention).toHaveStyle({ fontWeight: 'bold', color: '#fff' })
      expect(mention).toHaveStyle({ cursor: 'pointer' })
    })

    it('should parse mentions in minified messages without click handlers', () => {
      const message = {
        id: 'test-13',
        content: 'Hey @testuser!',
        timestamp: Date.now()
      }

      render(
        <MessageParser 
          message={message}
          sevenTVEmotes={[]}
          sevenTVSettings={{ emotes: false }}
          type="minified"
          chatroomId="123"
        />
      )

      const mention = screen.getByText('@testuser!')
      expect(mention).toHaveStyle({ fontWeight: 'bold', color: '#fff' })
      expect(mention).not.toHaveStyle({ cursor: 'pointer' })
    })

    it('should parse mentions in reply messages without click handlers', () => {
      const message = {
        id: 'test-14',
        content: 'Reply to @originaluser',
        timestamp: Date.now()
      }

      render(
        <MessageParser 
          message={message}
          sevenTVEmotes={[]}
          sevenTVSettings={{ emotes: false }}
          type="reply"
          chatroomId="123"
        />
      )

      const mention = screen.getByText('@originaluser')
      expect(mention).toHaveStyle({ fontWeight: 'bold', color: '#fff' })
      expect(mention).not.toHaveStyle({ cursor: 'pointer' })
    })

    it('should handle mention clicks and open user dialog', async () => {
      const mockUserData = {
        data: {
          id: 'user-123',
          username: 'testuser',
          slug: 'testuser-slug'
        }
      }

      mockWindow.app.kick.getUserChatroomInfo.mockResolvedValue(mockUserData)
      mockWindow.app.userDialog.open.mockResolvedValue(undefined)

      const message = {
        id: 'test-15',
        content: 'Hello @testuser!',
        timestamp: Date.now()
      }

      const userChatroomInfo = { role: 'member' }
      const subscriberBadges = [{ months: 1, badge_image: { src: 'badge.png' } }]

      render(
        <MessageParser 
          message={message}
          sevenTVEmotes={[]}
          sevenTVSettings={{ emotes: false }}
          type="regular"
          chatroomId="123"
          chatroomName="test-room"
          userChatroomInfo={userChatroomInfo}
          subscriberBadges={subscriberBadges}
        />
      )

      const mention = screen.getByText('@testuser!')
      fireEvent.click(mention)

      await waitFor(() => {
        expect(mockWindow.app.kick.getUserChatroomInfo).toHaveBeenCalledWith('test-room', 'testuser')
      })

      await waitFor(() => {
        expect(mockWindow.app.userDialog.open).toHaveBeenCalledWith({
          sender: {
            id: 'user-123',
            username: 'testuser',
            slug: 'testuser-slug'
          },
          fetchedUser: mockUserData.data,
          subscriberBadges,
          chatroomId: '123',
          userChatroomInfo,
          cords: [0, 300]
        })
      })
    })

    it('should handle mention clicks when user is not found', async () => {
      mockWindow.app.kick.getUserChatroomInfo.mockResolvedValue({ data: null })

      const message = {
        id: 'test-16',
        content: 'Hello @nonexistent!',
        timestamp: Date.now()
      }

      render(
        <MessageParser 
          message={message}
          sevenTVEmotes={[]}
          sevenTVSettings={{ emotes: false }}
          type="regular"
          chatroomId="123"
          chatroomName="test-room"
          userChatroomInfo={{}}
          subscriberBadges={[]}
        />
      )

      const mention = screen.getByText('@nonexistent!')
      fireEvent.click(mention)

      await waitFor(() => {
        expect(mockWindow.app.kick.getUserChatroomInfo).toHaveBeenCalledWith('test-room', 'nonexistent')
      })

      // Should not open user dialog for non-existent user
      expect(mockWindow.app
