import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import {
  rgbaToString,
  scrollToBottom,
  convertDateToHumanReadable,
  convertMinutesToHumanReadable,
  convertSecondsToHumanReadable,
  getTimestampFormat
} from './ChatUtils'

dayjs.extend(utc)

describe('ChatUtils - Focused Business Logic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rgbaToString - Color Conversion', () => {
    it('should convert RGBA object to string format', () => {
      const rgba = { r: 255, g: 128, b: 64, a: 0.8 }
      const result = rgbaToString(rgba)
      expect(result).toBe('rgba(255, 128, 64, 0.8)')
    })

    it('should return string as-is when already formatted', () => {
      const rgbaString = 'rgba(100, 200, 50, 1)'
      const result = rgbaToString(rgbaString)
      expect(result).toBe(rgbaString)
    })

    it('should handle edge case color values', () => {
      const rgba = { r: 0, g: 0, b: 0, a: 0 }
      const result = rgbaToString(rgba)
      expect(result).toBe('rgba(0, 0, 0, 0)')
    })

    it('should handle maximum color values', () => {
      const rgba = { r: 255, g: 255, b: 255, a: 1 }
      const result = rgbaToString(rgba)
      expect(result).toBe('rgba(255, 255, 255, 1)')
    })

    it('should handle fractional alpha values', () => {
      const rgba = { r: 128, g: 128, b: 128, a: 0.333 }
      const result = rgbaToString(rgba)
      expect(result).toBe('rgba(128, 128, 128, 0.333)')
    })
  })

  describe('scrollToBottom - Chat Scrolling Behavior', () => {
    let mockElement
    let mockSetShowScrollToBottom

    beforeEach(() => {
      mockElement = {
        scrollTop: 0,
        scrollHeight: 1000
      }
      mockSetShowScrollToBottom = vi.fn()
    })

    it('should scroll to bottom and hide scroll button', () => {
      const mockRef = { current: mockElement }
      
      scrollToBottom(mockRef, mockSetShowScrollToBottom)

      expect(mockElement.scrollTop).toBe(1000)
      expect(mockSetShowScrollToBottom).toHaveBeenCalledWith(false)
    })

    it('should handle null ref gracefully', () => {
      const mockRef = { current: null }

      expect(() => scrollToBottom(mockRef, mockSetShowScrollToBottom)).not.toThrow()
      expect(mockSetShowScrollToBottom).not.toHaveBeenCalled()
    })

    it('should handle undefined ref gracefully', () => {
      const mockRef = {}

      expect(() => scrollToBottom(mockRef, mockSetShowScrollToBottom)).not.toThrow()
      expect(mockSetShowScrollToBottom).not.toHaveBeenCalled()
    })
  })

  describe('convertDateToHumanReadable - Time Display Logic', () => {
    beforeEach(() => {
      // Mock current time for consistent testing
      vi.setSystemTime(new Date('2024-01-15 12:00:00 UTC'))
    })

    it('should format recent time correctly (minutes only)', () => {
      const pastDate = '2024-01-15 11:45:00'  // 15 minutes ago
      const result = convertDateToHumanReadable(pastDate)
      expect(result).toBe('15m ago')
    })

    it('should format time over an hour correctly', () => {
      const pastDate = '2024-01-15 10:15:00'  // 1h 45m ago
      const result = convertDateToHumanReadable(pastDate)
      expect(result).toBe('1h 45m ago')
    })

    it('should handle exact hour boundaries', () => {
      const pastDate = '2024-01-15 10:00:00'  // exactly 2 hours ago
      const result = convertDateToHumanReadable(pastDate)
      expect(result).toBe('2h 0m ago')
    })

    it('should handle same time (0 minutes ago)', () => {
      const pastDate = '2024-01-15 12:00:00'  // same time
      const result = convertDateToHumanReadable(pastDate)
      expect(result).toBe('0m ago')
    })

    it('should handle very old timestamps', () => {
      const pastDate = '2024-01-10 06:00:00'  // 5 days, 6 hours ago = 126h ago
      const result = convertDateToHumanReadable(pastDate)
      expect(result).toBe('126h 0m ago')
    })
  })

  describe('convertMinutesToHumanReadable - Duration Formatting', () => {
    it('should format single minute correctly', () => {
      expect(convertMinutesToHumanReadable(1)).toBe('1 minute')
    })

    it('should format multiple minutes correctly', () => {
      expect(convertMinutesToHumanReadable(45)).toBe('45 minutes')
    })

    it('should format single hour correctly', () => {
      expect(convertMinutesToHumanReadable(60)).toBe('1 hour')
    })

    it('should format multiple hours correctly', () => {
      expect(convertMinutesToHumanReadable(150)).toBe('2 hours')  // 2.5 hours = 2 hours
    })

    it('should format single day correctly', () => {
      expect(convertMinutesToHumanReadable(1440)).toBe('1 day')  // 24 hours
    })

    it('should format multiple days correctly', () => {
      expect(convertMinutesToHumanReadable(2880)).toBe('2 days')  // 48 hours
    })

    it('should handle zero minutes', () => {
      expect(convertMinutesToHumanReadable(0)).toBe('0 minute')
    })

    it('should handle edge case between units', () => {
      expect(convertMinutesToHumanReadable(59)).toBe('59 minutes')
      expect(convertMinutesToHumanReadable(61)).toBe('1 hour')
      expect(convertMinutesToHumanReadable(1439)).toBe('23 hours')
      expect(convertMinutesToHumanReadable(1441)).toBe('1 day')
    })
  })

  describe('convertSecondsToHumanReadable - Time Duration Logic', () => {
    it('should format seconds correctly', () => {
      expect(convertSecondsToHumanReadable(1)).toBe('1 second')
      expect(convertSecondsToHumanReadable(30)).toBe('30 seconds')
      expect(convertSecondsToHumanReadable(59)).toBe('59 seconds')
    })

    it('should format minutes correctly', () => {
      expect(convertSecondsToHumanReadable(60)).toBe('1 minute')
      expect(convertSecondsToHumanReadable(120)).toBe('2 minutes')
      expect(convertSecondsToHumanReadable(3599)).toBe('59 minutes')
    })

    it('should format hours correctly', () => {
      expect(convertSecondsToHumanReadable(3600)).toBe('1 hour')
      expect(convertSecondsToHumanReadable(7200)).toBe('2 hours')
      expect(convertSecondsToHumanReadable(86399)).toBe('23 hours')
    })

    it('should format days correctly', () => {
      expect(convertSecondsToHumanReadable(86400)).toBe('1 day')
      expect(convertSecondsToHumanReadable(172800)).toBe('2 days')
      expect(convertSecondsToHumanReadable(604799)).toBe('6 days')
    })

    it('should format weeks correctly', () => {
      expect(convertSecondsToHumanReadable(604800)).toBe('1 week')
      expect(convertSecondsToHumanReadable(1209600)).toBe('2 weeks')
      expect(convertSecondsToHumanReadable(2591999)).toBe('4 weeks')
    })

    it('should format months correctly', () => {
      expect(convertSecondsToHumanReadable(2592000)).toBe('1 month')
      expect(convertSecondsToHumanReadable(5184000)).toBe('2 months')
      expect(convertSecondsToHumanReadable(31535999)).toBe('12 months')
    })

    it('should format years correctly', () => {
      expect(convertSecondsToHumanReadable(31536000)).toBe('1 year')
      expect(convertSecondsToHumanReadable(63072000)).toBe('2 years')
    })

    it('should handle zero seconds', () => {
      expect(convertSecondsToHumanReadable(0)).toBe('0 second')
    })

    it('should handle boundary conditions', () => {
      expect(convertSecondsToHumanReadable(59.9)).toBe('59.9 seconds')
      expect(convertSecondsToHumanReadable(60.1)).toBe('1 minute')
    })
  })

  describe('getTimestampFormat - Chat Timestamp Display', () => {
    const testTimestamp = '2024-01-15T14:30:25.000Z'

    it('should return empty string for disabled format', () => {
      expect(getTimestampFormat(testTimestamp, 'disabled')).toBe('')
    })

    it('should format 12-hour time without seconds', () => {
      expect(getTimestampFormat(testTimestamp, 'h:mm')).toMatch(/^\d{1,2}:\d{2}$/)
      expect(getTimestampFormat(testTimestamp, 'h:mm a')).toMatch(/^\d{1,2}:\d{2} [AP]M$/)
    })

    it('should format 24-hour time without seconds', () => {
      expect(getTimestampFormat(testTimestamp, 'hh:mm')).toMatch(/^\d{2}:\d{2}$/)
      expect(getTimestampFormat(testTimestamp, 'hh:mm a')).toMatch(/^\d{2}:\d{2} [AP]M$/)
    })

    it('should format time with seconds', () => {
      expect(getTimestampFormat(testTimestamp, 'h:mm:ss')).toMatch(/^\d{1,2}:\d{2}:\d{2}$/)
      expect(getTimestampFormat(testTimestamp, 'h:mm:ss a')).toMatch(/^\d{1,2}:\d{2}:\d{2} [AP]M$/)
      expect(getTimestampFormat(testTimestamp, 'hh:mm:ss')).toMatch(/^\d{2}:\d{2}:\d{2}$/)
      expect(getTimestampFormat(testTimestamp, 'hh:mm:ss a')).toMatch(/^\d{2}:\d{2}:\d{2} [AP]M$/)
    })

    it('should handle null or undefined timestamp', () => {
      expect(getTimestampFormat(null, 'h:mm')).toBe('')
      expect(getTimestampFormat(undefined, 'h:mm')).toBe('')
    })

    it('should handle invalid format', () => {
      expect(getTimestampFormat(testTimestamp, 'invalid')).toBe('')
      expect(getTimestampFormat(testTimestamp, null)).toBe('')
    })

    it('should format specific times correctly', () => {
      const morningTime = '2024-01-15T09:05:30.000Z'
      const afternoonTime = '2024-01-15T15:45:10.000Z'
      
      // Test morning time
      const morningResult = getTimestampFormat(morningTime, 'h:mm a')
      expect(morningResult).toContain('AM')
      
      // Test afternoon time  
      const afternoonResult = getTimestampFormat(afternoonTime, 'h:mm a')
      expect(afternoonResult).toContain('PM')
    })
  })

  describe('Business Logic Edge Cases', () => {
    it('should handle malformed rgba objects gracefully', () => {
      const malformedRgba = { r: 'red', g: null, b: undefined, a: NaN }
      const result = rgbaToString(malformedRgba)
      expect(result).toBe('rgba(red, null, undefined, NaN)')
    })

    it('should handle extreme duration values', () => {
      expect(convertSecondsToHumanReadable(999999999)).toBe('31 years')
      expect(convertMinutesToHumanReadable(999999)).toBe('694 days')
    })

    it('should handle negative duration values', () => {
      // These functions don't explicitly handle negative values, 
      // but we should test the behavior
      expect(convertSecondsToHumanReadable(-60)).toBe('-60 second')
      expect(convertMinutesToHumanReadable(-30)).toBe('-30 minute')
    })

    it('should handle dayjs parse errors gracefully', () => {
      const invalidDate = 'not-a-date'
      const result = convertDateToHumanReadable(invalidDate)
      // Should still return a string (dayjs handles invalid dates)
      expect(typeof result).toBe('string')
    })

    it('should handle very large scroll heights', () => {
      const mockElement = {
        scrollTop: 0,
        scrollHeight: Number.MAX_SAFE_INTEGER
      }
      const mockRef = { current: mockElement }
      const mockSetShowScrollToBottom = vi.fn()

      scrollToBottom(mockRef, mockSetShowScrollToBottom)

      expect(mockElement.scrollTop).toBe(Number.MAX_SAFE_INTEGER)
      expect(mockSetShowScrollToBottom).toHaveBeenCalledWith(false)
    })
  })

  describe('Performance and Memory Tests', () => {
    it('should handle rapid timestamp formatting efficiently', () => {
      const startTime = performance.now()
      const timestamp = '2024-01-15T12:30:45.000Z'
      
      // Format timestamp 1000 times
      for (let i = 0; i < 1000; i++) {
        getTimestampFormat(timestamp, 'h:mm:ss a')
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(50) // 50ms for 1000 calls
    })

    it('should handle large duration conversions efficiently', () => {
      const startTime = performance.now()
      
      // Convert many different durations
      for (let i = 1; i <= 10000; i++) {
        convertSecondsToHumanReadable(i * 3600) // Convert hours
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(100) // 100ms for 10000 conversions
    })
  })

  describe('Internationalization Considerations', () => {
    it('should handle timezone-aware date conversion', () => {
      // Test with different timezone formats
      const utcDate = '2024-01-15 12:00:00'
      const result = convertDateToHumanReadable(utcDate)
      expect(typeof result).toBe('string')
      expect(result).toContain('ago')
    })

    it('should maintain consistent format regardless of locale', () => {
      // Test that our functions return consistent formats
      const timestamp = '2024-01-15T12:30:45.000Z'
      
      const format1 = getTimestampFormat(timestamp, 'hh:mm:ss')
      const format2 = getTimestampFormat(timestamp, 'hh:mm:ss')
      
      expect(format1).toBe(format2)
      expect(format1).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    })
  })
})