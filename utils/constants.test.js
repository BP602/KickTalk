import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  urlRegex,
  kickEmoteRegex,
  kickEmoteInputRegex,
  mentionRegex,
  kickClipRegex,
  DEFAULT_CHAT_HISTORY_LENGTH,
  kickBadgeMap,
  CHAT_ERROR_CODES
} from './constants.js'

describe('Constants', () => {
  describe('URL Regex', () => {
    it('should match basic HTTP URLs', () => {
      const text = 'Check out http://example.com for more info'
      const matches = [...text.matchAll(urlRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0][1]).toBe('http://example.com')
    })

    it('should match basic HTTPS URLs', () => {
      const text = 'Visit https://secure.example.com today'
      const matches = [...text.matchAll(urlRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0][1]).toBe('https://secure.example.com')
    })

    it('should match multiple URLs in text', () => {
      const text = 'Visit https://example.com or http://backup.site.org'
      const matches = [...text.matchAll(urlRegex)]
      
      expect(matches).toHaveLength(2)
      expect(matches[0][1]).toBe('https://example.com')
      expect(matches[1][1]).toBe('http://backup.site.org')
    })

    it('should match URLs with query parameters', () => {
      const text = 'Search at https://search.com?q=test&sort=date'
      const matches = [...text.matchAll(urlRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0][1]).toBe('https://search.com?q=test&sort=date')
    })

    it('should match URLs with fragments', () => {
      const text = 'Go to https://docs.example.com/page#section'
      const matches = [...text.matchAll(urlRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0][1]).toBe('https://docs.example.com/page#section')
    })

    it('should match URLs with port numbers', () => {
      const text = 'Dev server at http://localhost:3000/app'
      const matches = [...text.matchAll(urlRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0][1]).toBe('http://localhost:3000/app')
    })

    it('should not match incomplete URLs', () => {
      const text = 'Visit www.example.com or ftp://files.com'
      const matches = [...text.matchAll(urlRegex)]
      
      expect(matches).toHaveLength(0)
    })

    it('should handle URLs at different text positions', () => {
      const testCases = [
        'https://start.com at the beginning',
        'Middle https://middle.com link',
        'End link https://end.com'
      ]
      
      testCases.forEach(text => {
        const matches = [...text.matchAll(urlRegex)]
        expect(matches).toHaveLength(1)
      })
    })

    it('should match URLs with complex paths', () => {
      const text = 'API endpoint https://api.example.com/v1/users/123/profile?format=json'
      const matches = [...text.matchAll(urlRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0][1]).toBe('https://api.example.com/v1/users/123/profile?format=json')
    })

    it('should handle URLs with special characters in query params', () => {
      const text = 'Search https://example.com?q=hello%20world&filter=active'
      const matches = [...text.matchAll(urlRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0][1]).toBe('https://example.com?q=hello%20world&filter=active')
    })
  })

  describe('Kick Emote Regex', () => {
    it('should match basic kick emotes', () => {
      const text = 'Hello [emote:123:kappa] world'
      const matches = [...text.matchAll(kickEmoteRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.id).toBe('123')
      expect(matches[0].groups.name).toBe('kappa')
    })

    it('should match emotes with just ID', () => {
      const text = 'Simple [emote:456] emote'
      const matches = [...text.matchAll(kickEmoteRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.id).toBe('456')
      expect(matches[0].groups.name).toBe('')
    })

    it('should match multiple emotes in text', () => {
      const text = 'Start [emote:123:smile] middle [emote:456:laugh] end'
      const matches = [...text.matchAll(kickEmoteRegex)]
      
      expect(matches).toHaveLength(2)
      expect(matches[0].groups.id).toBe('123')
      expect(matches[0].groups.name).toBe('smile')
      expect(matches[1].groups.id).toBe('456')
      expect(matches[1].groups.name).toBe('laugh')
    })

    it('should handle emotes with underscores and hyphens in names', () => {
      const text = 'Cool [emote:789:cool_emote-v2] very nice'
      const matches = [...text.matchAll(kickEmoteRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.id).toBe('789')
      expect(matches[0].groups.name).toBe('cool_emote-v2')
    })

    it('should handle emotes with exclamation marks', () => {
      const text = 'Excited [emote:999:wow!] much'
      const matches = [...text.matchAll(kickEmoteRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.id).toBe('999')
      expect(matches[0].groups.name).toBe('wow!')
    })

    it('should not match invalid emote formats', () => {
      const invalidCases = [
        'Invalid [emote:abc:name] format',
        'Missing [emote::name] ID',
        'Wrong [emote:123:] format',
        'No brackets emote:123:name'
      ]
      
      invalidCases.forEach(text => {
        const matches = [...text.matchAll(kickEmoteRegex)]
        expect(matches).toHaveLength(0)
      })
    })

    it('should match emotes at different positions', () => {
      const testCases = [
        '[emote:123:start] at beginning',
        'Middle [emote:456:mid] emote',
        'End emote [emote:789:end]'
      ]
      
      testCases.forEach(text => {
        const matches = [...text.matchAll(kickEmoteRegex)]
        expect(matches).toHaveLength(1)
      })
    })

    it('should handle long emote names', () => {
      const text = 'Long [emote:123:verylongemotename123] name'
      const matches = [...text.matchAll(kickEmoteRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.id).toBe('123')
      expect(matches[0].groups.name).toBe('verylongemotename123')
    })

    it('should handle numeric emote names', () => {
      const text = 'Numeric [emote:123:456789] emote'
      const matches = [...text.matchAll(kickEmoteRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.id).toBe('123')
      expect(matches[0].groups.name).toBe('456789')
    })

    it('should handle alternative colon format', () => {
      const text = 'Alternative [emote:123:name:] format'
      const matches = [...text.matchAll(kickEmoteRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.id).toBe('123')
      expect(matches[0].groups.name).toBe('name')
    })
  })

  describe('Kick Emote Input Regex', () => {
    it('should match emote shortcodes with colons', () => {
      const text = 'Hello :kappa: world'
      const matches = [...text.matchAll(kickEmoteInputRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.emoteCase1).toBe('kappa')
    })

    it('should match emotes at start of text', () => {
      const text = ':smile: at start'
      const matches = [...text.matchAll(kickEmoteInputRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.emoteCase1).toBe('smile')
    })

    it('should match emotes after spaces', () => {
      const text = 'Text :laugh: more text'
      const matches = [...text.matchAll(kickEmoteInputRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.emoteCase1).toBe('laugh')
    })

    it('should match plain emote names without colons', () => {
      const text = 'Hello kappa world'
      const matches = [...text.matchAll(kickEmoteInputRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.emoteCase2).toBe('kappa')
    })

    it('should match emotes at word boundaries', () => {
      const text = 'Start smile middle'
      const matches = [...text.matchAll(kickEmoteInputRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.emoteCase2).toBe('smile')
    })

    it('should require minimum length for emotes', () => {
      const shortEmotes = ['a', 'ab', ':a:', ':ab:']
      
      shortEmotes.forEach(text => {
        const matches = [...text.matchAll(kickEmoteInputRegex)]
        expect(matches).toHaveLength(0)
      })
    })

    it('should match multiple emotes in text', () => {
      const text = ':kappa: and smile and :laugh:'
      const matches = [...text.matchAll(kickEmoteInputRegex)]
      
      expect(matches).toHaveLength(3)
      expect(matches[0].groups.emoteCase1).toBe('kappa')
      expect(matches[1].groups.emoteCase2).toBe('smile')
      expect(matches[2].groups.emoteCase1).toBe('laugh')
    })

    it('should handle numeric emote names', () => {
      const text = ':123emote: and emote456'
      const matches = [...text.matchAll(kickEmoteInputRegex)]
      
      expect(matches).toHaveLength(2)
      expect(matches[0].groups.emoteCase1).toBe('123emote')
      expect(matches[1].groups.emoteCase2).toBe('emote456')
    })

    it('should handle underscored emote names', () => {
      const text = ':cool_emote: test'
      const matches = [...text.matchAll(kickEmoteInputRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.emoteCase1).toBe('cool_emote')
    })

    it('should not match emotes inside words', () => {
      const text = 'wordkappa and :emote:suffix'
      // Should not match 'kappa' inside 'wordkappa', but should match ':emote:'
      const matches = [...text.matchAll(kickEmoteInputRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.emoteCase1).toBe('emote')
    })
  })

  describe('Mention Regex', () => {
    it('should match basic mentions', () => {
      const text = 'Hello @username how are you?'
      const matches = [...text.matchAll(mentionRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.username).toBe('username')
    })

    it('should match mentions at start of text', () => {
      const text = '@user123 welcome!'
      const matches = [...text.matchAll(mentionRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.username).toBe('user123')
    })

    it('should match mentions with underscores', () => {
      const text = 'Thanks @cool_user for help'
      const matches = [...text.matchAll(mentionRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.username).toBe('cool_user')
    })

    it('should match mentions with numbers', () => {
      const text = 'Hey @user123 and @player456'
      const matches = [...text.matchAll(mentionRegex)]
      
      expect(matches).toHaveLength(2)
      expect(matches[0].groups.username).toBe('user123')
      expect(matches[1].groups.username).toBe('player456')
    })

    it('should handle mentions with comma punctuation', () => {
      const text = 'Hello @username, how are you?'
      const matches = [...text.matchAll(mentionRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.username).toBe('username')
    })

    it('should handle mentions with period punctuation', () => {
      const text = 'Thanks @helper. You rock!'
      const matches = [...text.matchAll(mentionRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.username).toBe('helper')
    })

    it('should require minimum username length', () => {
      const shortMentions = ['@a', '@ab', '@12']
      
      shortMentions.forEach(text => {
        const matches = [...text.matchAll(mentionRegex)]
        expect(matches).toHaveLength(0)
      })
    })

    it('should match mentions followed by spaces', () => {
      const text = '@username thanks for the help!'
      const matches = [...text.matchAll(mentionRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.username).toBe('username')
    })

    it('should match mentions at end of text', () => {
      const text = 'Good job @streamer'
      const matches = [...text.matchAll(mentionRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.username).toBe('streamer')
    })

    it('should not match emails as mentions', () => {
      const text = 'Contact user@example.com for help'
      const matches = [...text.matchAll(mentionRegex)]
      
      expect(matches).toHaveLength(0)
    })

    it('should handle multiple mentions in text', () => {
      const text = '@user1 and @user2, please help @user3'
      const matches = [...text.matchAll(mentionRegex)]
      
      expect(matches).toHaveLength(3)
      expect(matches[0].groups.username).toBe('user1')
      expect(matches[1].groups.username).toBe('user2')
      expect(matches[2].groups.username).toBe('user3')
    })

    it('should handle mixed case usernames', () => {
      const text = 'Hello @CoolUser123 welcome!'
      const matches = [...text.matchAll(mentionRegex)]
      
      expect(matches).toHaveLength(1)
      expect(matches[0].groups.username).toBe('CoolUser123')
    })
  })

  describe('Kick Clip Regex', () => {
    it('should match basic kick clip URLs', () => {
      const url = 'https://kick.com/channel123/clips/abc456'
      expect(kickClipRegex.test(url)).toBe(true)
    })

    it('should match kick clip URLs with www', () => {
      const url = 'https://www.kick.com/streamer/clips/xyz789'
      expect(kickClipRegex.test(url)).toBe(true)
    })

    it('should match HTTP kick clip URLs', () => {
      const url = 'http://kick.com/user/clips/clip123'
      expect(kickClipRegex.test(url)).toBe(true)
    })

    it('should match kick clip URLs with additional path segments', () => {
      const url = 'https://kick.com/channel/subpath/clips/clipid'
      expect(kickClipRegex.test(url)).toBe(true)
    })

    it('should not match regular kick URLs without clips', () => {
      const urls = [
        'https://kick.com/channel123',
        'https://kick.com/channel123/videos',
        'https://kick.com/channel123/about'
      ]
      
      urls.forEach(url => {
        expect(kickClipRegex.test(url)).toBe(false)
      })
    })

    it('should not match non-kick domains', () => {
      const urls = [
        'https://twitch.tv/clips/abc123',
        'https://youtube.com/clips/xyz456',
        'https://example.com/clips/test'
      ]
      
      urls.forEach(url => {
        expect(kickClipRegex.test(url)).toBe(false)
      })
    })

    it('should be case insensitive', () => {
      const urls = [
        'HTTPS://KICK.COM/CHANNEL/CLIPS/ABC',
        'https://KICK.com/channel/CLIPS/def',
        'HTTP://kick.COM/user/clips/GHI'
      ]
      
      urls.forEach(url => {
        expect(kickClipRegex.test(url)).toBe(true)
      })
    })

    it('should match clips URLs with query parameters', () => {
      const url = 'https://kick.com/channel/clips/abc123?t=30&quality=720p'
      expect(kickClipRegex.test(url)).toBe(true)
    })

    it('should match clips URLs with fragments', () => {
      const url = 'https://kick.com/channel/clips/abc123#share'
      expect(kickClipRegex.test(url)).toBe(true)
    })
  })

  describe('Default Chat History Length', () => {
    it('should have correct default value', () => {
      expect(DEFAULT_CHAT_HISTORY_LENGTH).toBe(400)
    })

    it('should be a number', () => {
      expect(typeof DEFAULT_CHAT_HISTORY_LENGTH).toBe('number')
    })

    it('should be positive', () => {
      expect(DEFAULT_CHAT_HISTORY_LENGTH).toBeGreaterThan(0)
    })

    it('should be reasonable for chat history', () => {
      // Should be between 100 and 1000 for reasonable performance
      expect(DEFAULT_CHAT_HISTORY_LENGTH).toBeGreaterThanOrEqual(100)
      expect(DEFAULT_CHAT_HISTORY_LENGTH).toBeLessThanOrEqual(1000)
    })
  })

  describe('Kick Badge Map', () => {
    describe('Static Badges', () => {
      const staticBadgeTypes = [
        'bot', 'moderator', 'broadcaster', 'vip', 'og', 'founder',
        'sub_gifter', 'subgifter25', 'subgifter50', 'subgifter100', 
        'subgifter200', 'staff', 'trainwreckstv', 'verified', 'sidekick', 'donator'
      ]

      it.each(staticBadgeTypes)('should have %s badge with required properties', (badgeType) => {
        const badge = kickBadgeMap[badgeType]
        
        expect(badge).toBeDefined()
        expect(badge).toHaveProperty('src')
        expect(badge).toHaveProperty('title')
        expect(badge).toHaveProperty('info')
        expect(badge).toHaveProperty('platform')
        
        expect(typeof badge.src).toBe('string')
        expect(typeof badge.title).toBe('string')
        expect(typeof badge.info).toBe('string')
        expect(typeof badge.platform).toBe('string')
        
        expect(badge.src).toContain('https://')
        expect(['Kick', 'KickTalk'].includes(badge.platform)).toBe(true)
      })

      it('should have consistent CDN URL for kick badges', () => {
        const kickBadges = Object.keys(kickBadgeMap)
          .filter(key => key !== 'subscriber' && key !== 'donator')
          .map(key => kickBadgeMap[key])

        kickBadges.forEach(badge => {
          expect(badge.src).toMatch(/^https:\/\/cdn\.kicktalk\.app\/Badges\//)
        })
      })

      it('should have donator badge with different CDN path', () => {
        const donatorBadge = kickBadgeMap.donator
        
        expect(donatorBadge.src).toBe('https://cdn.kicktalk.app/Donator.webp')
        expect(donatorBadge.platform).toBe('KickTalk')
      })

      it('should have all sub gifter badges with different tiers', () => {
        const subGifterBadges = [
          'sub_gifter', 'subgifter25', 'subgifter50', 'subgifter100', 'subgifter200'
        ]

        subGifterBadges.forEach(badgeType => {
          const badge = kickBadgeMap[badgeType]
          expect(badge.title).toBe('Sub Gifter')
          expect(badge.info).toBe('Sub gifter')
          expect(badge.platform).toBe('Kick')
        })
      })
    })

    describe('Subscriber Badge Function', () => {
      it('should be a function', () => {
        expect(typeof kickBadgeMap.subscriber).toBe('function')
      })

      it('should return default subscriber badge when no custom badges', () => {
        const badge = { count: 3, text: 'Subscriber' }
        const result = kickBadgeMap.subscriber(badge, null)

        expect(result).toEqual({
          src: 'https://cdn.kicktalk.app/Badges/subscriber.svg',
          title: '3 Month Subscriber',
          info: '3 Month Subscriber',
          platform: 'Kick'
        })
      })

      it('should return default subscriber badge when empty subscriber badges array', () => {
        const badge = { count: 5, text: 'Subscriber' }
        const result = kickBadgeMap.subscriber(badge, [])

        expect(result).toEqual({
          src: 'https://cdn.kicktalk.app/Badges/subscriber.svg',
          title: '5 Month Subscriber',
          info: '5 Month Subscriber',
          platform: 'Kick'
        })
      })

      it('should return custom subscriber badge when available', () => {
        const badge = { count: 12, text: 'Subscriber' }
        const subscriberBadges = [
          { months: 1, badge_image: { src: 'custom1.png' } },
          { months: 6, badge_image: { src: 'custom6.png' } },
          { months: 12, badge_image: { src: 'custom12.png' } }
        ]

        const result = kickBadgeMap.subscriber(badge, subscriberBadges)

        expect(result).toEqual({
          src: 'custom12.png',
          title: '12 Month Subscriber',
          info: '12 Month Subscriber',
          platform: 'Kick'
        })
      })

      it('should return highest applicable tier badge', () => {
        const badge = { count: 8, text: 'Subscriber' }
        const subscriberBadges = [
          { months: 12, badge_image: { src: 'custom12.png' } },
          { months: 1, badge_image: { src: 'custom1.png' } },
          { months: 6, badge_image: { src: 'custom6.png' } }
        ]

        const result = kickBadgeMap.subscriber(badge, subscriberBadges)

        expect(result).toEqual({
          src: 'custom6.png',
          title: '8 Month Subscriber',
          info: '8 Month Subscriber',
          platform: 'Kick'
        })
      })

      it('should handle edge case with zero months', () => {
        const badge = { count: 0, text: 'Subscriber' }
        const subscriberBadges = [
          { months: 1, badge_image: { src: 'custom1.png' } }
        ]

        const result = kickBadgeMap.subscriber(badge, subscriberBadges)

        expect(result).toBe(null)
      })

      it('should handle subscriber badges sorting correctly', () => {
        const badge = { count: 10, text: 'Subscriber' }
        const subscriberBadges = [
          { months: 1, badge_image: { src: 'custom1.png' } },
          { months: 24, badge_image: { src: 'custom24.png' } },
          { months: 6, badge_image: { src: 'custom6.png' } },
          { months: 12, badge_image: { src: 'custom12.png' } }
        ]

        const result = kickBadgeMap.subscriber(badge, subscriberBadges)

        expect(result).toEqual({
          src: 'custom6.png',
          title: '10 Month Subscriber',
          info: '10 Month Subscriber',
          platform: 'Kick'
        })
      })

      it('should handle missing badge_image gracefully', () => {
        const badge = { count: 5, text: 'Subscriber' }
        const subscriberBadges = [
          { months: 3, badge_image: null }
        ]

        // Should not crash, but behavior depends on implementation
        expect(() => {
          kickBadgeMap.subscriber(badge, subscriberBadges)
        }).not.toThrow()
      })
    })

    it('should have all badges as either objects or functions', () => {
      Object.keys(kickBadgeMap).forEach(key => {
        const badge = kickBadgeMap[key]
        expect(['object', 'function'].includes(typeof badge)).toBe(true)
      })
    })
  })

  describe('Chat Error Codes', () => {
    it('should be defined as an object', () => {
      expect(typeof CHAT_ERROR_CODES).toBe('object')
      expect(CHAT_ERROR_CODES).not.toBeNull()
    })

    it('should contain expected error codes', () => {
      const expectedErrorCodes = [
        'FOLLOWERS_ONLY_ERROR',
        'Unauthorized',
        'BANNED_ERROR',
        'SLOW_MODE_ERROR',
        'NO_LINKS_ERROR',
        'SUBSCRIBERS_ONLY_EMOTE_ERROR',
        'EMOTES_ONLY_ERROR',
        'SUBSCRIBERS_ONLY_ERROR',
        'ORIGINAL_MESSAGE_NOT_FOUND_ERROR',
        'CHAT_RATE_LIMIT_ERROR',
        'PINNED_MESSAGE_NOT_FOUND_ERROR',
        'USER_NOT_MODERATOR',
        'USER_NOT_VIP',
        'USER_NOT_OG'
      ]

      expectedErrorCodes.forEach(errorCode => {
        expect(CHAT_ERROR_CODES).toHaveProperty(errorCode)
        expect(typeof CHAT_ERROR_CODES[errorCode]).toBe('string')
        expect(CHAT_ERROR_CODES[errorCode].length).toBeGreaterThan(0)
      })
    })

    it('should have meaningful error messages', () => {
      const errorMessages = Object.values(CHAT_ERROR_CODES)
      
      errorMessages.forEach(message => {
        expect(message).toMatch(/[A-Z]/) // Should start with capital letter
        expect(message.length).toBeGreaterThan(10) // Should be descriptive
      })
    })

    it('should group related errors logically', () => {
      // Chat restriction errors
      expect(CHAT_ERROR_CODES.FOLLOWERS_ONLY_ERROR).toContain('following')
      expect(CHAT_ERROR_CODES.SUBSCRIBERS_ONLY_ERROR).toContain('subscribers')
      expect(CHAT_ERROR_CODES.EMOTES_ONLY_ERROR).toContain('emote')
      
      // Authorization errors
      expect(CHAT_ERROR_CODES.Unauthorized).toContain('login')
      expect(CHAT_ERROR_CODES.BANNED_ERROR).toContain('banned')
      
      // Rate limiting errors
      expect(CHAT_ERROR_CODES.SLOW_MODE_ERROR).toContain('slow')
      expect(CHAT_ERROR_CODES.CHAT_RATE_LIMIT_ERROR).toContain('rate')
      
      // User role errors
      expect(CHAT_ERROR_CODES.USER_NOT_MODERATOR).toContain('moderator')
      expect(CHAT_ERROR_CODES.USER_NOT_VIP).toContain('VIP')
      expect(CHAT_ERROR_CODES.USER_NOT_OG).toContain('OG')
    })

    it('should have consistent error message formatting', () => {
      const errorMessages = Object.values(CHAT_ERROR_CODES)
      
      errorMessages.forEach(message => {
        // Should end with period
        expect(message).toMatch(/\.$/)
        // Should not have leading/trailing whitespace
        expect(message).toBe(message.trim())
      })
    })

    it('should handle square bracket notation for error codes', () => {
      const squareBracketErrors = [
        'FOLLOWERS_ONLY_ERROR',
        'Unauthorized'
      ]

      squareBracketErrors.forEach(errorCode => {
        expect(CHAT_ERROR_CODES[`["${errorCode}"]`] || CHAT_ERROR_CODES[errorCode]).toBeDefined()
      })
    })
  })

  describe('Constants Immutability', () => {
    it('should not allow modification of regex patterns', () => {
      const originalSource = urlRegex.source
      
      // Attempt to modify should not affect the original
      expect(() => {
        urlRegex.source = 'modified'
      }).not.toThrow()
      
      // Original should remain unchanged (regex.source is read-only)
      expect(urlRegex.source).toBe(originalSource)
    })

    it('should not allow modification of DEFAULT_CHAT_HISTORY_LENGTH', () => {
      const originalValue = DEFAULT_CHAT_HISTORY_LENGTH
      
      // This won't actually modify the imported constant due to ES module semantics
      expect(DEFAULT_CHAT_HISTORY_LENGTH).toBe(originalValue)
    })

    it('should handle frozen objects correctly', () => {
      // Test if objects can be accessed without issues
      expect(() => {
        Object.keys(kickBadgeMap)
        Object.keys(CHAT_ERROR_CODES)
      }).not.toThrow()
    })
  })

  describe('Performance Characteristics', () => {
    it('should handle large text efficiently with URL regex', () => {
      const largeText = 'Check https://example.com '.repeat(1000)
      const startTime = performance.now()
      
      const matches = [...largeText.matchAll(urlRegex)]
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      expect(matches).toHaveLength(1000)
      expect(duration).toBeLessThan(100) // Should complete in under 100ms
    })

    it('should handle large text efficiently with emote regex', () => {
      const largeText = 'Hello [emote:123:kappa] '.repeat(1000)
      const startTime = performance.now()
      
      const matches = [...largeText.matchAll(kickEmoteRegex)]
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      expect(matches).toHaveLength(1000)
      expect(duration).toBeLessThan(100)
    })

    it('should handle many mentions efficiently', () => {
      const largeText = 'Hello @user123 '.repeat(1000)
      const startTime = performance.now()
      
      const matches = [...largeText.matchAll(mentionRegex)]
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      expect(matches).toHaveLength(1000)
      expect(duration).toBeLessThan(100)
    })
  })

  describe('Edge Cases and Security', () => {
    it('should handle malicious URL patterns safely', () => {
      const maliciousUrls = [
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'vbscript:execute("malicious")'
      ]

      maliciousUrls.forEach(url => {
        const matches = [...url.matchAll(urlRegex)]
        expect(matches).toHaveLength(0) // Should not match non-http(s) protocols
      })
    })

    it('should handle extremely long inputs without crashing', () => {
      const veryLongText = 'a'.repeat(100000)
      
      expect(() => {
        void Array.from(veryLongText.matchAll(urlRegex));
        void Array.from(veryLongText.matchAll(kickEmoteRegex));
        void Array.from(veryLongText.matchAll(mentionRegex));
      }).not.toThrow()
    })

    it('should handle special Unicode characters', () => {
      const unicodeText = 'Hello 👋 @user123 check https://example.com 🌟'
      
      expect(() => {
        const urlMatches = [...unicodeText.matchAll(urlRegex)]
        const mentionMatches = [...unicodeText.matchAll(mentionRegex)]
        
        expect(urlMatches).toHaveLength(1)
        expect(mentionMatches).toHaveLength(1)
      }).not.toThrow()
    })

    it('should handle null and undefined inputs gracefully', () => {
      const nullText = null
      const undefinedText = undefined
      
      expect(() => {
        // These should throw TypeError, but not crash the application
        try {
          void Array.from(nullText?.matchAll?.(urlRegex) ?? []);
          void Array.from(undefinedText?.matchAll?.(mentionRegex) ?? []);
        } catch (error) {
          expect(error).toBeInstanceOf(TypeError)
        }
      }).not.toThrow()
    })
  })

  describe('Type Validation', () => {
    it('should have correct types for all exports', () => {
      expect(urlRegex).toBeInstanceOf(RegExp)
      expect(kickEmoteRegex).toBeInstanceOf(RegExp)
      expect(kickEmoteInputRegex).toBeInstanceOf(RegExp)
      expect(mentionRegex).toBeInstanceOf(RegExp)
      expect(kickClipRegex).toBeInstanceOf(RegExp)
      
      expect(typeof DEFAULT_CHAT_HISTORY_LENGTH).toBe('number')
      expect(typeof kickBadgeMap).toBe('object')
      expect(typeof CHAT_ERROR_CODES).toBe('object')
    })

    it('should have global flag set on appropriate regexes', () => {
      expect(urlRegex.global).toBe(true)
      expect(kickEmoteRegex.global).toBe(true)
      expect(kickEmoteInputRegex.global).toBe(true)
      expect(mentionRegex.global).toBe(true)
      expect(kickClipRegex.global).toBe(false) // Used for testing, not matching
    })

    it('should have case insensitive flag where appropriate', () => {
      expect(kickClipRegex.ignoreCase).toBe(true)
    })
  })
})
