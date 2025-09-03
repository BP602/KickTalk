import { describe, it, expect } from 'vitest'
import {
  urlRegex,
  kickEmoteRegex,
  kickEmoteInputRegex,
  mentionRegex,
  kickClipRegex,
  DEFAULT_CHAT_HISTORY_LENGTH,
  kickBadgeMap
} from './constants.js'

describe('Constants - Focused Business Logic Tests', () => {
  describe('URL Regex Pattern', () => {
    it('should match valid HTTP URLs', () => {
      const text = 'Check out http://example.com for more info'
      const matches = [...text.matchAll(urlRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0][0]).toBe('http://example.com')
    })

    it('should match valid HTTPS URLs', () => {
      const text = 'Visit https://secure.example.com/path?query=value'
      const matches = [...text.matchAll(urlRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0][0]).toBe('https://secure.example.com/path?query=value')
    })

    it('should match multiple URLs in text', () => {
      const text = 'Check http://first.com and https://second.org/path'
      const matches = [...text.matchAll(urlRegex)]
      
      expect(matches).toHaveLength(2)
      expect(matches[0][0]).toBe('http://first.com')
      expect(matches[1][0]).toBe('https://second.org/path')
    })

    it('should not match partial URLs without protocol', () => {
      const text = 'Visit example.com or www.example.com'
      const matches = [...text.matchAll(urlRegex)]
      
      expect(matches).toHaveLength(0)
    })

    it('should handle URLs with special characters', () => {
      const text = 'API: https://api.example.com/v1/users?id=123&sort=name'
      const matches = [...text.matchAll(urlRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0][0]).toBe('https://api.example.com/v1/users?id=123&sort=name')
    })

    it('should handle URLs at end of sentence', () => {
      const text = 'Visit https://example.com.'
      const matches = [...text.matchAll(urlRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0][0]).toBe('https://example.com.')
    })

    it('should not match invalid protocols', () => {
      const text = 'Try ftp://example.com or file://path'
      const matches = [...text.matchAll(urlRegex)]
      
      expect(matches).toHaveLength(0)
    })
  })

  describe('Kick Emote Regex Pattern', () => {
    it('should match basic emote pattern with ID and name', () => {
      const text = 'Look at this [emote:123:TestEmote] cool emote'
      const matches = [...text.matchAll(kickEmoteRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.id).toBe('123')
      expect(matches[0].groups.name).toBe('TestEmote')
    })

    it('should match emote pattern with ID only', () => {
      const text = 'Simple [emote:456] emote'
      const matches = [...text.matchAll(kickEmoteRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.id).toBe('456')
      expect(matches[0].groups.name).toBe('')
    })

    it('should match multiple emotes in text', () => {
      const text = '[emote:123:First] and [emote:456:Second]'
      const matches = [...text.matchAll(kickEmoteRegex)]
      
      expect(matches).toHaveLength(2)
      expect(matches[0].groups.id).toBe('123')
      expect(matches[0].groups.name).toBe('First')
      expect(matches[1].groups.id).toBe('456')
      expect(matches[1].groups.name).toBe('Second')
    })

    it('should handle emote names with special characters', () => {
      const text = 'Emote: [emote:789:Test_Emote-123!]'
      const matches = [...text.matchAll(kickEmoteRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.id).toBe('789')
      expect(matches[0].groups.name).toBe('Test_Emote-123!')
    })

    it('should not match malformed emote patterns', () => {
      const malformed = [
        '[emote:]',           // No ID
        '[emote:abc:Name]',   // Non-numeric ID
        '[emot:123:Name]',    // Typo in emote
        'emote:123:Name',     // Missing brackets
      ]
      
      malformed.forEach(pattern => {
        const matches = [...pattern.matchAll(kickEmoteRegex)]
        expect(matches).toHaveLength(0)
      })
    })

    it('should handle edge cases in emote names', () => {
      const text = '[emote:123:] [emote:456:a] [emote:789:VeryLongEmoteNameThatIsStillValid]'
      const matches = [...text.matchAll(kickEmoteRegex)]
      
      expect(matches).toHaveLength(3)
      expect(matches[0].groups.name).toBe('')
      expect(matches[1].groups.name).toBe('a')
      expect(matches[2].groups.name).toBe('VeryLongEmoteNameThatIsStillValid')
    })
  })

  describe('Kick Emote Input Regex Pattern', () => {
    it('should match colon-wrapped emote input', () => {
      const text = 'I want :kappa: emote'
      const matches = [...text.matchAll(kickEmoteInputRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.emoteCase1).toBe('kappa')
    })

    it('should match word boundary emotes', () => {
      const text = 'Show me kappa emote'
      const matches = [...text.matchAll(kickEmoteInputRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.emoteCase2).toBe('kappa')
    })

    it('should handle multiple emote inputs', () => {
      const text = ':smile: and sadface in chat'
      const matches = [...text.matchAll(kickEmoteInputRegex)]
      
      expect(matches).toHaveLength(2)
      expect(matches[0].groups.emoteCase1).toBe('smile')
      expect(matches[1].groups.emoteCase2).toBe('sadface')
    })

    it('should respect minimum length requirements', () => {
      const text = ':a: :ab: :abc: and a ab abc'
      const matches = [...text.matchAll(kickEmoteInputRegex)]
      
      // Should only match :abc: (3+ chars) and abc (2+ chars at word boundary)
      expect(matches).toHaveLength(2)
      expect(matches[0].groups.emoteCase1).toBe('abc')
      expect(matches[1].groups.emoteCase2).toBe('abc')
    })

    it('should match at start and end of text', () => {
      const text = ':start: middle :end:'
      const matches = [...text.matchAll(kickEmoteInputRegex)]
      
      expect(matches).toHaveLength(3)
      expect(matches[0].groups.emoteCase1).toBe('start')
      expect(matches[1].groups.emoteCase2).toBe('middle')
      expect(matches[2].groups.emoteCase1).toBe('end')
    })
  })

  describe('Mention Regex Pattern', () => {
    it('should match basic username mentions', () => {
      const text = 'Hello @username welcome!'
      const matches = [...text.matchAll(mentionRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.username).toBe('username')
    })

    it('should match mentions with punctuation', () => {
      const text = 'Hey @user123, how are you @user456?'
      const matches = [...text.matchAll(mentionRegex)]
      
      expect(matches).toHaveLength(2)
      expect(matches[0].groups.username).toBe('user123')
      expect(matches[1].groups.username).toBe('user456')
    })

    it('should match mentions at start of message', () => {
      const text = '@moderator please help'
      const matches = [...text.matchAll(mentionRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.username).toBe('moderator')
    })

    it('should match mentions at end of message', () => {
      const text = 'Thanks @helper'
      const matches = [...text.matchAll(mentionRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.username).toBe('helper')
    })

    it('should require minimum 3 character username length', () => {
      const text = '@a @ab @abc @abcd'
      const matches = [...text.matchAll(mentionRegex)]
      
      expect(matches).toHaveLength(2)
      expect(matches[0].groups.username).toBe('abc')
      expect(matches[1].groups.username).toBe('abcd')
    })

    it('should handle underscores in usernames', () => {
      const text = 'Hello @user_name_123 there'
      const matches = [...text.matchAll(mentionRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.username).toBe('user_name_123')
    })

    it('should not match email addresses', () => {
      const text = 'Contact us at user@domain.com'
      const matches = [...text.matchAll(mentionRegex)]
      
      expect(matches).toHaveLength(0)
    })

    it('should handle mentions with trailing comma or period', () => {
      const text = 'Hello @user, and goodbye @friend.'
      const matches = [...text.matchAll(mentionRegex)]
      
      expect(matches).toHaveLength(2)
      expect(matches[0].groups.username).toBe('user')
      expect(matches[1].groups.username).toBe('friend')
    })
  })

  describe('Kick Clip Regex Pattern', () => {
    it('should match basic kick clip URLs', () => {
      const url = 'https://kick.com/streamer/clips/clip123'
      expect(kickClipRegex.test(url)).toBe(true)
    })

    it('should match kick clip URLs with www', () => {
      const url = 'https://www.kick.com/streamer/clips/clip456'
      expect(kickClipRegex.test(url)).toBe(true)
    })

    it('should match HTTP kick clip URLs', () => {
      const url = 'http://kick.com/streamer/clips/clip789'
      expect(kickClipRegex.test(url)).toBe(true)
    })

    it('should match case insensitive', () => {
      const url = 'HTTPS://KICK.COM/STREAMER/CLIPS/CLIP123'
      expect(kickClipRegex.test(url)).toBe(true)
    })

    it('should not match non-clip kick URLs', () => {
      const urls = [
        'https://kick.com/streamer',
        'https://kick.com/',
        'https://kick.com/streamer/videos/video123'
      ]
      
      urls.forEach(url => {
        expect(kickClipRegex.test(url)).toBe(false)
      })
    })

    it('should not match other domain clip URLs', () => {
      const urls = [
        'https://twitch.tv/streamer/clips/clip123',
        'https://youtube.com/clips/clip456'
      ]
      
      urls.forEach(url => {
        expect(kickClipRegex.test(url)).toBe(false)
      })
    })
  })

  describe('Badge Map Business Logic', () => {
    it('should handle subscriber badge with custom badges', () => {
      const badge = { count: 12, text: 'Subscriber' }
      const subscriberBadges = [
        { months: 1, badge_image: { src: '1month.png' } },
        { months: 6, badge_image: { src: '6months.png' } },
        { months: 12, badge_image: { src: '12months.png' } }
      ]
      
      const result = kickBadgeMap.subscriber(badge, subscriberBadges)
      
      expect(result.src).toBe('12months.png')
      expect(result.title).toBe('12 Month Subscriber')
      expect(result.info).toBe('12 Month Subscriber')
      expect(result.platform).toBe('Kick')
    })

    it('should handle subscriber badge without custom badges', () => {
      const badge = { count: 3, text: 'Subscriber' }
      const subscriberBadges = null
      
      const result = kickBadgeMap.subscriber(badge, subscriberBadges)
      
      expect(result.src).toContain('subscriber.svg')
      expect(result.title).toBe('3 Month Subscriber')
      expect(result.info).toBe('3 Month Subscriber')
      expect(result.platform).toBe('Kick')
    })

    it('should find best matching subscriber badge', () => {
      const badge = { count: 8, text: 'Subscriber' }
      const subscriberBadges = [
        { months: 12, badge_image: { src: '12months.png' } },
        { months: 6, badge_image: { src: '6months.png' } },
        { months: 1, badge_image: { src: '1month.png' } }
      ]
      
      const result = kickBadgeMap.subscriber(badge, subscriberBadges)
      
      // Should pick 6 month badge (highest that user qualifies for)
      expect(result.src).toBe('6months.png')
      expect(result.title).toBe('8 Month Subscriber')
    })

    it('should return null when subscriber doesnt qualify for any badge', () => {
      const badge = { count: 0, text: 'Subscriber' }
      const subscriberBadges = [
        { months: 1, badge_image: { src: '1month.png' } }
      ]
      
      const result = kickBadgeMap.subscriber(badge, subscriberBadges)
      
      expect(result).toBeNull()
    })

    it('should handle empty subscriber badges array', () => {
      const badge = { count: 5, text: 'Subscriber' }
      const subscriberBadges = []
      
      const result = kickBadgeMap.subscriber(badge, subscriberBadges)
      
      expect(result.src).toContain('subscriber.svg')
      expect(result.platform).toBe('Kick')
    })

    it('should have correct static badge properties', () => {
      const staticBadges = [
        'bot', 'moderator', 'broadcaster', 'vip', 'og', 
        'founder', 'staff', 'trainwreckstv'
      ]
      
      staticBadges.forEach(badgeType => {
        const badge = kickBadgeMap[badgeType]
        expect(badge.src).toContain('.svg')
        expect(badge.title).toBeTruthy()
        expect(badge.info).toBeTruthy()
        expect(badge.platform).toBe('Kick')
      })
    })

    it('should have correct sub gifter badge hierarchy', () => {
      const subGifterBadges = [
        'sub_gifter', 'subgifter25', 'subgifter50', 
        'subgifter100', 'subgifter200'
      ]
      
      subGifterBadges.forEach(badgeType => {
        const badge = kickBadgeMap[badgeType]
        expect(badge.src).toContain('subgifter')
        expect(badge.title).toBe('Sub Gifter')
        expect(badge.info).toBe('Sub gifter')
        expect(badge.platform).toBe('Kick')
      })
    })

    it('should use correct CDN for all badges', () => {
      const allBadgeTypes = Object.keys(kickBadgeMap).filter(key => key !== 'subscriber')
      
      allBadgeTypes.forEach(badgeType => {
        const badge = kickBadgeMap[badgeType]
        expect(badge.src).toContain('https://cdn.kicktalk.app')
      })
    })
  })

  describe('Configuration Constants', () => {
    it('should have reasonable default chat history length', () => {
      expect(DEFAULT_CHAT_HISTORY_LENGTH).toBe(400)
      expect(typeof DEFAULT_CHAT_HISTORY_LENGTH).toBe('number')
      expect(DEFAULT_CHAT_HISTORY_LENGTH).toBeGreaterThan(0)
    })

    it('should have sane limits for chat history', () => {
      // Should be reasonable for performance and memory usage
      expect(DEFAULT_CHAT_HISTORY_LENGTH).toBeGreaterThanOrEqual(100)
      expect(DEFAULT_CHAT_HISTORY_LENGTH).toBeLessThanOrEqual(1000)
    })
  })

  describe('Regex Pattern Integration', () => {
    it('should handle mixed content with multiple patterns', () => {
      const text = 'Hey @user check https://example.com for :smile: and [emote:123:kappa]'
      
      const mentions = [...text.matchAll(mentionRegex)]
      const urls = [...text.matchAll(urlRegex)]
      const emoteInputs = [...text.matchAll(kickEmoteInputRegex)]
      const emotes = [...text.matchAll(kickEmoteRegex)]
      
      expect(mentions).toHaveLength(1)
      expect(urls).toHaveLength(1)
      expect(emoteInputs).toHaveLength(1)
      expect(emotes).toHaveLength(1)
    })

    it('should handle overlapping patterns correctly', () => {
      const text = '@user123 :user123:'
      
      const mentions = [...text.matchAll(mentionRegex)]
      const emoteInputs = [...text.matchAll(kickEmoteInputRegex)]
      
      expect(mentions).toHaveLength(1)
      expect(mentions[0].groups.username).toBe('user123')
      expect(emoteInputs).toHaveLength(1)
      expect(emoteInputs[0].groups.emoteCase1).toBe('user123')
    })

    it('should preserve pattern order in complex text', () => {
      const text = 'Start @mention middle https://url.com :emote: [emote:123:name] end'
      
      // Test that each pattern finds its match regardless of position
      expect([...text.matchAll(mentionRegex)]).toHaveLength(1)
      expect([...text.matchAll(urlRegex)]).toHaveLength(1)
      expect([...text.matchAll(kickEmoteInputRegex)]).toHaveLength(2) // :emote: and middle
      expect([...text.matchAll(kickEmoteRegex)]).toHaveLength(1)
    })
  })

  describe('Edge Cases and Performance', () => {
    it('should handle very long text efficiently', () => {
      const longText = 'word '.repeat(1000) + '@user' + ' word'.repeat(1000)
      const startTime = performance.now()
      
      const matches = [...longText.matchAll(mentionRegex)]
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      expect(matches).toHaveLength(1)
      expect(duration).toBeLessThan(10) // Should be very fast
    })

    it('should handle special Unicode characters', () => {
      const text = '🎉 @user123 check https://example.com/🔥 :smile: 👍'
      
      const mentions = [...text.matchAll(mentionRegex)]
      const urls = [...text.matchAll(urlRegex)]
      
      expect(mentions).toHaveLength(1)
      expect(mentions[0].groups.username).toBe('user123')
      expect(urls).toHaveLength(1)
    })

    it('should handle empty and whitespace-only text', () => {
      const texts = ['', '   ', '\n\t\r', '     \n    ']
      
      texts.forEach(text => {
        expect([...text.matchAll(mentionRegex)]).toHaveLength(0)
        expect([...text.matchAll(urlRegex)]).toHaveLength(0)
        expect([...text.matchAll(kickEmoteRegex)]).toHaveLength(0)
        expect([...text.matchAll(kickEmoteInputRegex)]).toHaveLength(0)
      })
    })

    it('should handle null and undefined gracefully in badge logic', () => {
      expect(() => {
        kickBadgeMap.subscriber(null, [])
      }).toThrow()
      
      expect(() => {
        kickBadgeMap.subscriber({ count: 1 }, null)
      }).not.toThrow()
    })
  })
})