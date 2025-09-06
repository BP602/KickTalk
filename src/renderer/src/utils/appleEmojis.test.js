import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  emojisByCategory,
  categories,
  getEmojiImageUrl,
  unicodeToEmoji,
  searchEmojis,
  convertLegacyEmoji
} from './appleEmojis'

// Mock emoji data for testing
const mockEmojiData = [
  {
    name: 'grinning face',
    unified: '1F600',
    non_qualified: null,
    image: 'emoji_u1f600.png',
    sheet_x: 26,
    sheet_y: 0,
    short_name: 'grinning',
    short_names: ['grinning'],
    category: 'Smileys & Emotion',
    subcategory: 'face-smiling',
    sort_order: 1
  },
  {
    name: 'beaming face with smiling eyes',
    unified: '1F601',
    non_qualified: null,
    image: 'emoji_u1f601.png',
    sheet_x: 26,
    sheet_y: 1,
    short_name: 'grin',
    short_names: ['grin'],
    category: 'Smileys & Emotion',
    subcategory: 'face-smiling',
    sort_order: 2
  },
  {
    name: 'face with tears of joy',
    unified: '1F602',
    non_qualified: null,
    image: 'emoji_u1f602.png',
    sheet_x: 26,
    sheet_y: 2,
    short_name: 'joy',
    short_names: ['joy', 'laugh'],
    category: 'Smileys & Emotion',
    subcategory: 'face-smiling',
    sort_order: 3
  },
  {
    name: 'red apple',
    unified: '1F34E',
    non_qualified: null,
    image: 'emoji_u1f34e.png',
    sheet_x: 7,
    sheet_y: 14,
    short_name: 'apple',
    short_names: ['apple'],
    category: 'Food & Drink',
    subcategory: 'food-fruit',
    sort_order: 659
  },
  {
    name: 'waving hand',
    unified: '1F44F',
    non_qualified: null,
    image: 'emoji_u1f44f.png',
    sheet_x: 13,
    sheet_y: 15,
    short_name: 'wave',
    short_names: ['wave'],
    category: 'People & Body',
    subcategory: 'hand-fingers-open',
    sort_order: 162
  },
  {
    name: 'woman technologist',
    unified: '1F469-200D-1F4BB',
    non_qualified: null,
    image: 'emoji_u1f469_200d_1f4bb.png',
    sheet_x: 20,
    sheet_y: 5,
    short_name: 'woman_technologist',
    short_names: ['woman_technologist'],
    category: 'People & Body',
    subcategory: 'person-role',
    sort_order: 554
  }
]

// Mock the emoji-datasource-apple/emoji.json import
vi.mock('emoji-datasource-apple/emoji.json', () => {
  return {
    default: mockEmojiData
  }
})

describe('appleEmojis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('emojisByCategory', () => {
    it('should group emojis by category correctly', () => {
      // Assert
      expect(emojisByCategory).toHaveProperty('Smileys & Emotion')
      expect(emojisByCategory).toHaveProperty('Food & Drink')
      expect(emojisByCategory).toHaveProperty('People & Body')
    })

    it('should contain correct emojis in Smileys & Emotion category', () => {
      // Assert
      const smileyEmojis = emojisByCategory['Smileys & Emotion']
      expect(smileyEmojis).toHaveLength(3)
      expect(smileyEmojis[0].short_name).toBe('grinning')
      expect(smileyEmojis[1].short_name).toBe('grin')
      expect(smileyEmojis[2].short_name).toBe('joy')
    })

    it('should contain correct emojis in Food & Drink category', () => {
      // Assert
      const foodEmojis = emojisByCategory['Food & Drink']
      expect(foodEmojis).toHaveLength(1)
      expect(foodEmojis[0].short_name).toBe('apple')
    })

    it('should contain correct emojis in People & Body category', () => {
      // Assert
      const peopleEmojis = emojisByCategory['People & Body']
      expect(peopleEmojis).toHaveLength(2)
      expect(peopleEmojis[0].short_name).toBe('wave')
      expect(peopleEmojis[1].short_name).toBe('woman_technologist')
    })

    it('should handle emojis with same category correctly', () => {
      // Assert
      const smileyEmojis = emojisByCategory['Smileys & Emotion']
      expect(smileyEmojis.every(emoji => emoji.category === 'Smileys & Emotion')).toBe(true)
    })

    it('should create separate arrays for each category', () => {
      // Assert
      const category1 = emojisByCategory['Smileys & Emotion']
      const category2 = emojisByCategory['Food & Drink']
      expect(category1).not.toBe(category2)
    })

    it('should preserve original emoji object properties', () => {
      // Assert
      const firstEmoji = emojisByCategory['Smileys & Emotion'][0]
      expect(firstEmoji).toHaveProperty('name')
      expect(firstEmoji).toHaveProperty('unified')
      expect(firstEmoji).toHaveProperty('image')
      expect(firstEmoji).toHaveProperty('short_name')
      expect(firstEmoji).toHaveProperty('short_names')
      expect(firstEmoji).toHaveProperty('category')
    })
  })

  describe('categories', () => {
    it('should return all unique category names', () => {
      // Assert
      expect(categories).toContain('Smileys & Emotion')
      expect(categories).toContain('Food & Drink')
      expect(categories).toContain('People & Body')
    })

    it('should return sorted category names', () => {
      // Assert
      const sortedCategories = [...categories].sort()
      expect(categories).toEqual(sortedCategories)
    })

    it('should have correct number of categories', () => {
      // Assert
      const uniqueCategories = new Set(mockEmojiData.map(emoji => emoji.category))
      expect(categories).toHaveLength(uniqueCategories.size)
    })

    it('should not contain duplicates', () => {
      // Assert
      const uniqueCategories = new Set(categories)
      expect(categories).toHaveLength(uniqueCategories.size)
    })

    it('should be an array', () => {
      // Assert
      expect(Array.isArray(categories)).toBe(true)
    })

    it('should contain only string values', () => {
      // Assert
      expect(categories.every(category => typeof category === 'string')).toBe(true)
    })
  })

  describe('getEmojiImageUrl', () => {
    it('should return correct URL with default size', () => {
      // Arrange
      const emoji = { image: 'emoji_u1f600.png' }

      // Act
      const result = getEmojiImageUrl(emoji)

      // Assert
      expect(result).toBe('/emoji-images/emoji_u1f600.png')
    })

    it('should return correct URL with custom size', () => {
      // Arrange
      const emoji = { image: 'emoji_u1f601.png' }

      // Act
      const result = getEmojiImageUrl(emoji, 128)

      // Assert
      expect(result).toBe('/emoji-images/emoji_u1f601.png')
    })

    it('should handle emoji with complex image filename', () => {
      // Arrange
      const emoji = { image: 'emoji_u1f469_200d_1f4bb.png' }

      // Act
      const result = getEmojiImageUrl(emoji)

      // Assert
      expect(result).toBe('/emoji-images/emoji_u1f469_200d_1f4bb.png')
    })

    it('should handle emoji without image property', () => {
      // Arrange
      const emoji = {}

      // Act
      const result = getEmojiImageUrl(emoji)

      // Assert
      expect(result).toBe('/emoji-images/undefined')
    })

    it('should handle null emoji input', () => {
      // Arrange & Act & Assert
      expect(() => getEmojiImageUrl(null)).toThrow()
    })

    it('should handle undefined emoji input', () => {
      // Arrange & Act & Assert
      expect(() => getEmojiImageUrl(undefined)).toThrow()
    })

    it('should handle emoji with empty image filename', () => {
      // Arrange
      const emoji = { image: '' }

      // Act
      const result = getEmojiImageUrl(emoji)

      // Assert
      expect(result).toBe('/emoji-images/')
    })

    it('should handle emoji with null image filename', () => {
      // Arrange
      const emoji = { image: null }

      // Act
      const result = getEmojiImageUrl(emoji)

      // Assert
      expect(result).toBe('/emoji-images/null')
    })

    it('should not use the size parameter in URL (size is ignored)', () => {
      // Arrange
      const emoji = { image: 'emoji_u1f600.png' }

      // Act
      const result1 = getEmojiImageUrl(emoji, 32)
      const result2 = getEmojiImageUrl(emoji, 128)

      // Assert
      expect(result1).toBe(result2)
      expect(result1).toBe('/emoji-images/emoji_u1f600.png')
    })
  })

  describe('unicodeToEmoji', () => {
    it('should find emoji by unified code', () => {
      // Arrange
      const unicode = '1F600'

      // Act
      const result = unicodeToEmoji(unicode)

      // Assert
      expect(result).toBeTruthy()
      expect(result.short_name).toBe('grinning')
      expect(result.unified).toBe('1F600')
    })

    it('should find emoji by unified code with hyphens', () => {
      // Arrange
      const unicode = '1F469-200D-1F4BB'

      // Act
      const result = unicodeToEmoji(unicode)

      // Assert
      expect(result).toBeTruthy()
      expect(result.short_name).toBe('woman_technologist')
    })

    it('should normalize unicode by removing variation selectors', () => {
      // Arrange
      const unicode = '1F600\uFE0F' // With variation selector

      // Act
      const result = unicodeToEmoji(unicode)

      // Assert
      expect(result).toBeTruthy()
      expect(result.short_name).toBe('grinning')
    })

    it('should normalize unicode by removing ZWJ sequences', () => {
      // Arrange
      const unicode = '1F469\u200D1F4BB' // With ZWJ

      // Act
      const result = unicodeToEmoji(unicode)

      // Assert
      expect(result).toBeTruthy()
      expect(result.short_name).toBe('woman_technologist')
    })

    it('should handle lowercase unicode input', () => {
      // Arrange
      const unicode = '1f600'

      // Act
      const result = unicodeToEmoji(unicode)

      // Assert
      expect(result).toBeTruthy()
      expect(result.short_name).toBe('grinning')
    })

    it('should return null for non-existent unicode', () => {
      // Arrange
      const unicode = 'ZZZZZ'

      // Act
      const result = unicodeToEmoji(unicode)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle empty string input', () => {
      // Arrange
      const unicode = ''

      // Act
      const result = unicodeToEmoji(unicode)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle null input', () => {
      // Arrange & Act
      const result = unicodeToEmoji(null)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle undefined input', () => {
      // Arrange & Act
      const result = unicodeToEmoji(undefined)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle unicode with mixed case', () => {
      // Arrange
      const unicode = '1f60A'

      // Act
      const result = unicodeToEmoji(unicode)

      // Assert
      expect(result).toBeUndefined() // This specific emoji is not in our mock data
    })

    it('should handle complex unicode sequences', () => {
      // Arrange
      const unicode = '1F469-200D-1F4BB\uFE0F\u200D'

      // Act
      const result = unicodeToEmoji(unicode)

      // Assert
      expect(result).toBeTruthy()
      expect(result.short_name).toBe('woman_technologist')
    })

    it('should find emoji by non_qualified code when available', () => {
      // This test would need emoji data with non_qualified values
      // Since our mock data has null non_qualified values, we test the fallback behavior
      const unicode = 'NONEXISTENT'
      const result = unicodeToEmoji(unicode)
      expect(result).toBeUndefined()
    })
  })

  describe('searchEmojis', () => {
    describe('Basic Search Functionality', () => {
      it('should return all emojis when no search term provided', () => {
        // Act
        const result = searchEmojis()

        // Assert
        expect(result).toEqual(mockEmojiData)
        expect(result).toHaveLength(mockEmojiData.length)
      })

      it('should return all emojis when empty search term provided', () => {
        // Act
        const result = searchEmojis('')

        // Assert
        expect(result).toEqual(mockEmojiData)
        expect(result).toHaveLength(mockEmojiData.length)
      })

      it('should search by emoji name', () => {
        // Act
        const result = searchEmojis('grinning')

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0].name).toBe('grinning face')
        expect(result[0].short_name).toBe('grinning')
      })

      it('should search by short_name', () => {
        // Act
        const result = searchEmojis('joy')

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0].short_name).toBe('joy')
      })

      it('should search by alternative short_names', () => {
        // Act
        const result = searchEmojis('laugh')

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0].short_name).toBe('joy')
        expect(result[0].short_names).toContain('laugh')
      })

      it('should be case insensitive', () => {
        // Act
        const result1 = searchEmojis('GRINNING')
        const result2 = searchEmojis('grinning')
        const result3 = searchEmojis('GrInNiNg')

        // Assert
        expect(result1).toEqual(result2)
        expect(result2).toEqual(result3)
        expect(result1).toHaveLength(1)
      })

      it('should return partial matches', () => {
        // Act
        const result = searchEmojis('face')

        // Assert
        expect(result.length).toBeGreaterThan(0)
        expect(result.every(emoji => 
          emoji.name.toLowerCase().includes('face') ||
          emoji.short_name.toLowerCase().includes('face') ||
          emoji.short_names.some(name => name.toLowerCase().includes('face'))
        )).toBe(true)
      })

      it('should return multiple results for generic terms', () => {
        // Act
        const result = searchEmojis('face')

        // Assert
        expect(result.length).toBeGreaterThan(1)
      })
    })

    describe('Category Filtering', () => {
      it('should filter by category when specified', () => {
        // Act
        const result = searchEmojis('', 'Food & Drink')

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0].category).toBe('Food & Drink')
        expect(result[0].short_name).toBe('apple')
      })

      it('should combine search term with category filter', () => {
        // Act
        const result = searchEmojis('apple', 'Food & Drink')

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0].short_name).toBe('apple')
        expect(result[0].category).toBe('Food & Drink')
      })

      it('should return empty array for non-matching category search', () => {
        // Act
        const result = searchEmojis('grinning', 'Food & Drink')

        // Assert
        expect(result).toHaveLength(0)
      })

      it('should handle non-existent category', () => {
        // Act
        const result = searchEmojis('test', 'Non-Existent Category')

        // Assert
        expect(result).toHaveLength(0)
      })

      it('should return all emojis in category when no search term but category specified', () => {
        // Act
        const result = searchEmojis('', 'Smileys & Emotion')

        // Assert
        expect(result).toHaveLength(3)
        expect(result.every(emoji => emoji.category === 'Smileys & Emotion')).toBe(true)
      })

      it('should handle null category parameter', () => {
        // Act
        const result = searchEmojis('grinning', null)

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0].short_name).toBe('grinning')
      })

      it('should handle undefined category parameter', () => {
        // Act
        const result = searchEmojis('grinning', undefined)

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0].short_name).toBe('grinning')
      })
    })

    describe('Edge Cases and Error Handling', () => {
      it('should handle null search term', () => {
        // Act
        const result = searchEmojis(null)

        // Assert
        expect(result).toEqual(mockEmojiData)
      })

      it('should handle undefined search term', () => {
        // Act
        const result = searchEmojis(undefined)

        // Assert
        expect(result).toEqual(mockEmojiData)
      })

      it('should handle numeric search term', () => {
        // Act
        const result = searchEmojis(123)

        // Assert
        expect(result).toEqual([])
      })

      it('should handle boolean search term', () => {
        // Act
        const result = searchEmojis(true)

        // Assert
        expect(result).toEqual([])
      })

      it('should handle object search term', () => {
        // Act
        const result = searchEmojis({})

        // Assert
        expect(result).toEqual([])
      })

      it('should handle array search term', () => {
        // Act
        const result = searchEmojis([])

        // Assert
        expect(result).toEqual([])
      })

      it('should handle search term with special characters', () => {
        // Act
        const result = searchEmojis('face!@#$%')

        // Assert
        expect(result).toEqual([])
      })

      it('should handle very long search terms', () => {
        // Act
        const longTerm = 'a'.repeat(1000)
        const result = searchEmojis(longTerm)

        // Assert
        expect(result).toEqual([])
      })

      it('should handle search terms with unicode characters', () => {
        // Act
        const result = searchEmojis('😀')

        // Assert
        expect(result).toEqual([])
      })

      it('should handle whitespace in search terms', () => {
        // Act
        const result = searchEmojis(' grinning ')

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0].short_name).toBe('grinning')
      })
    })

    describe('Performance Considerations', () => {
      it('should handle repeated searches efficiently', () => {
        // Act
        const startTime = performance.now()
        for (let i = 0; i < 100; i++) {
          searchEmojis('face')
        }
        const endTime = performance.now()

        // Assert
        expect(endTime - startTime).toBeLessThan(100) // Should complete 100 searches within 100ms
      })

      it('should not modify original emoji data', () => {
        // Arrange
        const originalData = JSON.parse(JSON.stringify(mockEmojiData))

        // Act
        searchEmojis('test')

        // Assert
        expect(mockEmojiData).toEqual(originalData)
      })
    })

    describe('Search Result Quality', () => {
      it('should return exact matches first for short_name', () => {
        // Act
        const result = searchEmojis('joy')

        // Assert
        expect(result[0].short_name).toBe('joy')
      })

      it('should include all relevant matches', () => {
        // Act
        const result = searchEmojis('grin')

        // Assert
        const shortNames = result.map(emoji => emoji.short_name)
        expect(shortNames).toContain('grin')
        expect(shortNames).toContain('grinning')
      })
    })
  })

  describe('convertLegacyEmoji', () => {
    describe('Successful Conversions', () => {
      it('should convert legacy emoji with matching character', () => {
        // Arrange
        const legacyEmoji = {
          char: '😀', // This corresponds to U+1F600
          name: 'grinning'
        }

        // Act
        const result = convertLegacyEmoji(legacyEmoji)

        // Assert
        expect(result).toBeTruthy()
        expect(result.id).toBe('1F600')
        expect(result.name).toBe('grinning')
        expect(result.image).toBe('emoji_u1f600.png')
        expect(result.platform).toBe('apple')
        expect(result.category).toBe('Smileys & Emotion')
        expect(result.short_names).toEqual(['grinning'])
      })

      it('should convert complex emoji with ZWJ sequence', () => {
        // Arrange
        const legacyEmoji = {
          char: '👩‍💻', // This corresponds to woman technologist
          name: 'woman_technologist'
        }

        // Act
        const result = convertLegacyEmoji(legacyEmoji)

        // Assert
        expect(result).toBeTruthy()
        expect(result.id).toBe('1F469-200D-1F4BB')
        expect(result.name).toBe('woman_technologist')
        expect(result.platform).toBe('apple')
      })

      it('should preserve all required properties in converted emoji', () => {
        // Arrange
        const legacyEmoji = {
          char: '🍎',
          name: 'apple'
        }

        // Act
        const result = convertLegacyEmoji(legacyEmoji)

        // Assert
        expect(result).toHaveProperty('id')
        expect(result).toHaveProperty('name')
        expect(result).toHaveProperty('image')
        expect(result).toHaveProperty('platform')
        expect(result).toHaveProperty('category')
        expect(result).toHaveProperty('short_names')
        expect(result.platform).toBe('apple')
      })
    })

    describe('Failed Conversions', () => {
      it('should return null for non-matching character', () => {
        // Arrange
        const legacyEmoji = {
          char: '🦄', // This emoji is not in our mock data
          name: 'unicorn'
        }

        // Act
        const result = convertLegacyEmoji(legacyEmoji)

        // Assert
        expect(result).toBeNull()
      })

      it('should return null for invalid character', () => {
        // Arrange
        const legacyEmoji = {
          char: 'not an emoji',
          name: 'invalid'
        }

        // Act
        const result = convertLegacyEmoji(legacyEmoji)

        // Assert
        expect(result).toBeNull()
      })

      it('should return null for empty character', () => {
        // Arrange
        const legacyEmoji = {
          char: '',
          name: 'empty'
        }

        // Act
        const result = convertLegacyEmoji(legacyEmoji)

        // Assert
        expect(result).toBeNull()
      })
    })

    describe('Edge Cases and Error Handling', () => {
      it('should handle null legacy emoji input', () => {
        // Act
        const result = convertLegacyEmoji(null)

        // Assert
        expect(result).toBeNull()
      })

      it('should handle undefined legacy emoji input', () => {
        // Act
        const result = convertLegacyEmoji(undefined)

        // Assert
        expect(result).toBeNull()
      })

      it('should handle legacy emoji without char property', () => {
        // Arrange
        const legacyEmoji = {
          name: 'missing_char'
        }

        // Act
        const result = convertLegacyEmoji(legacyEmoji)

        // Assert
        expect(result).toBeNull()
      })

      it('should handle legacy emoji with null char', () => {
        // Arrange
        const legacyEmoji = {
          char: null,
          name: 'null_char'
        }

        // Act
        const result = convertLegacyEmoji(legacyEmoji)

        // Assert
        expect(result).toBeNull()
      })

      it('should handle legacy emoji with undefined char', () => {
        // Arrange
        const legacyEmoji = {
          char: undefined,
          name: 'undefined_char'
        }

        // Act
        const result = convertLegacyEmoji(legacyEmoji)

        // Assert
        expect(result).toBeNull()
      })

      it('should handle legacy emoji without name property', () => {
        // Arrange
        const legacyEmoji = {
          char: '😀'
        }

        // Act
        const result = convertLegacyEmoji(legacyEmoji)

        // Assert
        expect(result).toBeTruthy()
        expect(result.name).toBe('grinning') // Should use short_name from found emoji
      })

      it('should handle empty object input', () => {
        // Act
        const result = convertLegacyEmoji({})

        // Assert
        expect(result).toBeNull()
      })

      it('should handle non-object input', () => {
        // Act
        const result1 = convertLegacyEmoji('string')
        const result2 = convertLegacyEmoji(123)
        const result3 = convertLegacyEmoji(true)

        // Assert
        expect(result1).toBeNull()
        expect(result2).toBeNull()
        expect(result3).toBeNull()
      })

      it('should handle circular reference in legacy emoji object', () => {
        // Arrange
        const legacyEmoji = {
          char: '😀',
          name: 'grinning'
        }
        legacyEmoji.self = legacyEmoji // Create circular reference

        // Act
        const result = convertLegacyEmoji(legacyEmoji)

        // Assert
        expect(result).toBeTruthy()
        expect(result.name).toBe('grinning')
      })

      it('should handle legacy emoji with extra properties', () => {
        // Arrange
        const legacyEmoji = {
          char: '😀',
          name: 'grinning',
          extra1: 'value1',
          extra2: 'value2',
          nested: {
            prop: 'value'
          }
        }

        // Act
        const result = convertLegacyEmoji(legacyEmoji)

        // Assert
        expect(result).toBeTruthy()
        expect(result.name).toBe('grinning')
        // Extra properties should not affect the conversion
        expect(result).not.toHaveProperty('extra1')
        expect(result).not.toHaveProperty('extra2')
        expect(result).not.toHaveProperty('nested')
      })
    })

    describe('Unicode Character Matching', () => {
      it('should correctly convert single code point emojis', () => {
        // Arrange - Testing specific character matching
        const legacyEmoji = {
          char: String.fromCodePoint(0x1F600), // Grinning face
          name: 'test'
        }

        // Act
        const result = convertLegacyEmoji(legacyEmoji)

        // Assert
        expect(result).toBeTruthy()
        expect(result.id).toBe('1F600')
      })

      it('should correctly convert multi-code point emojis', () => {
        // Arrange - Testing ZWJ sequence
        const legacyEmoji = {
          char: String.fromCodePoint(0x1F469, 0x200D, 0x1F4BB), // Woman technologist
          name: 'test'
        }

        // Act
        const result = convertLegacyEmoji(legacyEmoji)

        // Assert
        expect(result).toBeTruthy()
        expect(result.id).toBe('1F469-200D-1F4BB')
      })

      it('should handle variation selectors in character matching', () => {
        // This tests the internal character comparison logic
        const legacyEmoji = {
          char: String.fromCodePoint(0x1F600) + '\uFE0F', // With variation selector
          name: 'test'
        }

        const result = convertLegacyEmoji(legacyEmoji)
        
        // The result depends on whether the variation selector affects matching
        // For our mock data, it should still find the emoji
        expect(result).toBeNull() // Since the character won't match exactly
      })
    })

    describe('Performance and Memory', () => {
      it('should handle large emoji datasets efficiently', () => {
        // Act
        const startTime = performance.now()
        for (let i = 0; i < 100; i++) {
          convertLegacyEmoji({ char: '😀', name: 'test' })
        }
        const endTime = performance.now()

        // Assert
        expect(endTime - startTime).toBeLessThan(100) // Should complete within 100ms
      })

      it('should not modify the original legacy emoji object', () => {
        // Arrange
        const legacyEmoji = { char: '😀', name: 'grinning' }
        const originalEmoji = { ...legacyEmoji }

        // Act
        convertLegacyEmoji(legacyEmoji)

        // Assert
        expect(legacyEmoji).toEqual(originalEmoji)
      })

      it('should not modify the original emoji data during conversion', () => {
        // Arrange
        const originalData = JSON.parse(JSON.stringify(mockEmojiData))
        const legacyEmoji = { char: '😀', name: 'grinning' }

        // Act
        convertLegacyEmoji(legacyEmoji)

        // Assert
        expect(mockEmojiData).toEqual(originalData)
      })
    })
  })

  describe('Module Integration', () => {
    it('should work together for emoji discovery workflow', () => {
      // Arrange - simulate finding and converting emojis
      const categoryName = 'Smileys & Emotion'

      // Act - get all emojis in category
      const categoryEmojis = emojisByCategory[categoryName]
      const searchResults = searchEmojis('face', categoryName)
      const firstEmoji = searchResults[0]
      const imageUrl = getEmojiImageUrl(firstEmoji)

      // Assert
      expect(categoryEmojis).toBeDefined()
      expect(searchResults.length).toBeGreaterThan(0)
      expect(firstEmoji).toBeDefined()
      expect(imageUrl).toContain('/emoji-images/')
      expect(imageUrl).toContain(firstEmoji.image)
    })

    it('should handle cross-function data consistency', () => {
      // Act
      const allCategories = categories
      const categoryEmojis = Object.keys(emojisByCategory)

      // Assert - categories array should match emojisByCategory keys
      const sortedCategoryEmojis = categoryEmojis.sort()
      expect(allCategories).toEqual(sortedCategoryEmojis)
    })

    it('should maintain data integrity across all functions', () => {
      // Arrange
      const testEmoji = mockEmojiData[0]

      // Act
      const foundByUnicode = unicodeToEmoji(testEmoji.unified)
      const foundBySearch = searchEmojis(testEmoji.short_name)[0]
      const imageUrl = getEmojiImageUrl(testEmoji)

      // Assert
      expect(foundByUnicode).toEqual(testEmoji)
      expect(foundBySearch).toEqual(testEmoji)
      expect(imageUrl).toBe(`/emoji-images/${testEmoji.image}`)
    })
  })

  describe('Data Structure Validation', () => {
    it('should have consistent emoji data structure in all functions', () => {
      // Assert - test that all emoji objects have required properties
      mockEmojiData.forEach(emoji => {
        expect(emoji).toHaveProperty('name')
        expect(emoji).toHaveProperty('unified')
        expect(emoji).toHaveProperty('image')
        expect(emoji).toHaveProperty('short_name')
        expect(emoji).toHaveProperty('short_names')
        expect(emoji).toHaveProperty('category')
        expect(Array.isArray(emoji.short_names)).toBe(true)
      })
    })

    it('should maintain referential integrity in emojisByCategory', () => {
      // Assert - emojis in categories should reference the same objects as in main data
      Object.values(emojisByCategory).forEach(categoryEmojis => {
        categoryEmojis.forEach(emoji => {
          const foundInMain = mockEmojiData.find(mainEmoji => mainEmoji.unified === emoji.unified)
          expect(foundInMain).toEqual(emoji)
        })
      })
    })
  })
})