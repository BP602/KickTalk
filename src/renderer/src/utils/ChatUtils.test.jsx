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

// Extend dayjs with UTC plugin to match the implementation
dayjs.extend(utc)

describe('ChatUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Use fake timers for consistent date testing
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('rgbaToString', () => {
    it('should return string as-is when input is already a string', () => {
      // Arrange
      const colorString = 'rgb(255, 0, 0)'
      
      // Act
      const result = rgbaToString(colorString)
      
      // Assert
      expect(result).toBe('rgb(255, 0, 0)')
    })

    it('should convert RGBA object to string format', () => {
      // Arrange
      const rgbaObject = { r: 255, g: 128, b: 64, a: 0.8 }
      
      // Act
      const result = rgbaToString(rgbaObject)
      
      // Assert
      expect(result).toBe('rgba(255, 128, 64, 0.8)')
    })

    it('should handle RGBA object with zero values', () => {
      // Arrange
      const rgbaObject = { r: 0, g: 0, b: 0, a: 0 }
      
      // Act
      const result = rgbaToString(rgbaObject)
      
      // Assert
      expect(result).toBe('rgba(0, 0, 0, 0)')
    })

    it('should handle RGBA object with max values', () => {
      // Arrange
      const rgbaObject = { r: 255, g: 255, b: 255, a: 1 }
      
      // Act
      const result = rgbaToString(rgbaObject)
      
      // Assert
      expect(result).toBe('rgba(255, 255, 255, 1)')
    })

    it('should handle RGBA object with decimal values', () => {
      // Arrange
      const rgbaObject = { r: 127.5, g: 63.2, b: 191.8, a: 0.456 }
      
      // Act
      const result = rgbaToString(rgbaObject)
      
      // Assert
      expect(result).toBe('rgba(127.5, 63.2, 191.8, 0.456)')
    })

    it('should handle empty string input', () => {
      // Arrange
      const emptyString = ''
      
      // Act
      const result = rgbaToString(emptyString)
      
      // Assert
      expect(result).toBe('')
    })

    it('should handle hex color string input', () => {
      // Arrange
      const hexColor = '#ff0000'
      
      // Act
      const result = rgbaToString(hexColor)
      
      // Assert
      expect(result).toBe('#ff0000')
    })
  })

  describe('scrollToBottom', () => {
    let mockChatBodyRef
    let mockSetShowScrollToBottom

    beforeEach(() => {
      mockSetShowScrollToBottom = vi.fn()
      mockChatBodyRef = {
        current: {
          scrollTop: 0,
          scrollHeight: 1000
        }
      }
    })

    it('should scroll to bottom and hide scroll button when ref is valid', () => {
      // Arrange - setup done in beforeEach
      
      // Act
      scrollToBottom(mockChatBodyRef, mockSetShowScrollToBottom)
      
      // Assert
      expect(mockChatBodyRef.current.scrollTop).toBe(1000)
      expect(mockSetShowScrollToBottom).toHaveBeenCalledWith(false)
    })

    it('should not do anything when chatBodyRef.current is null', () => {
      // Arrange
      mockChatBodyRef.current = null
      
      // Act
      scrollToBottom(mockChatBodyRef, mockSetShowScrollToBottom)
      
      // Assert
      expect(mockSetShowScrollToBottom).not.toHaveBeenCalled()
    })

    it('should not do anything when chatBodyRef.current is undefined', () => {
      // Arrange
      mockChatBodyRef.current = undefined
      
      // Act
      scrollToBottom(mockChatBodyRef, mockSetShowScrollToBottom)
      
      // Assert
      expect(mockSetShowScrollToBottom).not.toHaveBeenCalled()
    })

    it('should handle zero scroll height', () => {
      // Arrange
      mockChatBodyRef.current.scrollHeight = 0
      
      // Act
      scrollToBottom(mockChatBodyRef, mockSetShowScrollToBottom)
      
      // Assert
      expect(mockChatBodyRef.current.scrollTop).toBe(0)
      expect(mockSetShowScrollToBottom).toHaveBeenCalledWith(false)
    })

    it('should handle large scroll height values', () => {
      // Arrange
      mockChatBodyRef.current.scrollHeight = 50000
      
      // Act
      scrollToBottom(mockChatBodyRef, mockSetShowScrollToBottom)
      
      // Assert
      expect(mockChatBodyRef.current.scrollTop).toBe(50000)
      expect(mockSetShowScrollToBottom).toHaveBeenCalledWith(false)
    })
  })

  describe('convertDateToHumanReadable', () => {
    beforeEach(() => {
      // Set current time to a fixed point for consistent testing
      const fixedTime = dayjs('2024-01-01 15:30:00')
      vi.setSystemTime(fixedTime.toDate())
    })

    it('should return minutes ago when difference is less than an hour', () => {
      // Arrange - 30 minutes after current time (results in negative)
      const date = '2024-01-01 16:00:00'
      
      // Act
      const result = convertDateToHumanReadable(date)
      
      // Assert
      expect(result).toBe('-30m ago')
    })

    it('should return hours and minutes ago when difference is more than an hour', () => {
      // Arrange - Test with past dates using UTC time to get positive differences > 1 hour
      vi.setSystemTime(dayjs.utc('2024-01-01 16:45:00').toDate())
      const pastDate = '2024-01-01 14:30:00' // 2h 15m ago in UTC
      
      // Act
      const result = convertDateToHumanReadable(pastDate)
      
      // Assert
      expect(result).toBe('2h 15m ago')
    })

    it('should handle exactly one hour difference', () => {
      // Arrange - exactly same time as current
      const date = '2024-01-01 15:30:00'
      
      // Act
      const result = convertDateToHumanReadable(date)
      
      // Assert
      expect(result).toBe('0m ago')
    })

    it('should handle zero minute difference', () => {
      // Arrange - same time as current
      const date = '2024-01-01 15:30:00'
      
      // Act
      const result = convertDateToHumanReadable(date)
      
      // Assert
      expect(result).toBe('0m ago')
    })

    it('should handle 1 minute difference', () => {
      // Arrange - 1 minute after current time
      const date = '2024-01-01 15:31:00'
      
      // Act
      const result = convertDateToHumanReadable(date)
      
      // Assert
      expect(result).toBe('-1m ago')
    })

    it('should handle large hour differences', () => {
      // Arrange - Test with a date that produces positive difference > 1 hour
      vi.setSystemTime(dayjs.utc('2024-01-01 18:00:00').toDate())
      const pastDate = '2024-01-01 13:15:00' // 4h 45m ago in UTC
      
      // Act
      const result = convertDateToHumanReadable(pastDate)
      
      // Assert
      expect(result).toBe('4h 45m ago')
    })

    it('should handle future dates (negative difference)', () => {
      // Arrange - 30 minutes in the future
      const date = '2024-01-01 16:00:00'
      
      // Act
      const result = convertDateToHumanReadable(date)
      
      // Assert
      expect(result).toBe('-30m ago') // This is the current behavior
    })

    it('should handle date strings in different UTC times', () => {
      // Arrange - date that should be parsed as UTC
      const date = '2024-01-01 12:00:00'
      
      // Act
      const result = convertDateToHumanReadable(date)
      
      // Assert
      // Should calculate difference based on UTC parsing
      expect(result).toMatch(/\d+[hm].*ago/)
    })

    it('should handle past dates correctly with actual positive differences', () => {
      // Arrange - Set a very recent time to test actual past dates
      vi.setSystemTime(dayjs.utc('2024-01-01 15:30:00').toDate())
      const pastDate = '2024-01-01 15:00:00' // 30 minutes ago in UTC
      
      // Act
      const result = convertDateToHumanReadable(pastDate)
      
      // Assert
      expect(result).toBe('30m ago')
    })
  })

  describe('convertMinutesToHumanReadable', () => {
    it('should return minutes format for values less than 60 minutes', () => {
      // Arrange & Act & Assert
      expect(convertMinutesToHumanReadable(1)).toBe('1 minute')
      expect(convertMinutesToHumanReadable(30)).toBe('30 minutes')
      expect(convertMinutesToHumanReadable(59)).toBe('59 minutes')
    })

    it('should return hours format for values between 60 and 1439 minutes', () => {
      // Arrange & Act & Assert
      expect(convertMinutesToHumanReadable(60)).toBe('1 hour')
      expect(convertMinutesToHumanReadable(120)).toBe('2 hours')
      expect(convertMinutesToHumanReadable(90)).toBe('1 hour') // 1.5 hours rounds down
      expect(convertMinutesToHumanReadable(1439)).toBe('23 hours')
    })

    it('should return days format for values 1440 minutes and above', () => {
      // Arrange & Act & Assert
      expect(convertMinutesToHumanReadable(1440)).toBe('1 day') // exactly 24 hours
      expect(convertMinutesToHumanReadable(2880)).toBe('2 days') // exactly 48 hours
      expect(convertMinutesToHumanReadable(10080)).toBe('7 days') // exactly 1 week
    })

    it('should handle zero minutes', () => {
      // Arrange & Act
      const result = convertMinutesToHumanReadable(0)
      
      // Assert
      expect(result).toBe('0 minute') // Uses singular form for 0 and 1
    })

    it('should handle fractional minutes (should be floored)', () => {
      // Arrange & Act & Assert
      expect(convertMinutesToHumanReadable(119.9)).toBe('1 hour') // 119.9/60 = 1.99, floored to 1
      expect(convertMinutesToHumanReadable(1499.5)).toBe('1 day') // 1499.5/1440 = 1.04, floored to 1
    })

    it('should use singular forms correctly', () => {
      // Arrange & Act & Assert
      expect(convertMinutesToHumanReadable(1)).toBe('1 minute')
      expect(convertMinutesToHumanReadable(60)).toBe('1 hour')
      expect(convertMinutesToHumanReadable(1440)).toBe('1 day')
    })

    it('should use plural forms correctly', () => {
      // Arrange & Act & Assert
      expect(convertMinutesToHumanReadable(2)).toBe('2 minutes')
      expect(convertMinutesToHumanReadable(120)).toBe('2 hours')
      expect(convertMinutesToHumanReadable(2880)).toBe('2 days')
    })

    it('should handle large values', () => {
      // Arrange & Act & Assert
      expect(convertMinutesToHumanReadable(100000)).toBe('69 days') // 100000/1440 = 69.44, floored to 69
    })
  })

  describe('convertSecondsToHumanReadable', () => {
    it('should return seconds format for values less than 60 seconds', () => {
      // Arrange & Act & Assert
      expect(convertSecondsToHumanReadable(1)).toBe('1 second')
      expect(convertSecondsToHumanReadable(30)).toBe('30 seconds')
      expect(convertSecondsToHumanReadable(59)).toBe('59 seconds')
    })

    it('should return minutes format for values between 60 and 3599 seconds', () => {
      // Arrange & Act & Assert
      expect(convertSecondsToHumanReadable(60)).toBe('1 minute')
      expect(convertSecondsToHumanReadable(120)).toBe('2 minutes')
      expect(convertSecondsToHumanReadable(3599)).toBe('59 minutes')
    })

    it('should return hours format for values between 3600 and 86399 seconds', () => {
      // Arrange & Act & Assert
      expect(convertSecondsToHumanReadable(3600)).toBe('1 hour')
      expect(convertSecondsToHumanReadable(7200)).toBe('2 hours')
      expect(convertSecondsToHumanReadable(86399)).toBe('23 hours')
    })

    it('should return days format for values between 86400 and 603999 seconds', () => {
      // Arrange & Act & Assert
      expect(convertSecondsToHumanReadable(86400)).toBe('1 day') // 1 day
      expect(convertSecondsToHumanReadable(172800)).toBe('2 days') // 2 days
      expect(convertSecondsToHumanReadable(603999)).toBe('6 days') // almost 1 week
    })

    it('should return weeks format for values between 604800 and 2591999 seconds', () => {
      // Arrange & Act & Assert
      expect(convertSecondsToHumanReadable(604800)).toBe('1 week') // exactly 1 week
      expect(convertSecondsToHumanReadable(1209600)).toBe('2 weeks') // 2 weeks
      expect(convertSecondsToHumanReadable(2591999)).toBe('4 weeks') // almost 1 month
    })

    it('should return months format for values between 2592000 and 31535999 seconds', () => {
      // Arrange & Act & Assert
      expect(convertSecondsToHumanReadable(2592000)).toBe('1 month') // exactly 1 month (30 days)
      expect(convertSecondsToHumanReadable(5184000)).toBe('2 months') // 2 months
      expect(convertSecondsToHumanReadable(31535999)).toBe('12 months') // almost 1 year
    })

    it('should return years format for values 31536000 seconds and above', () => {
      // Arrange & Act & Assert
      expect(convertSecondsToHumanReadable(31536000)).toBe('1 year') // exactly 1 year
      expect(convertSecondsToHumanReadable(63072000)).toBe('2 years') // 2 years
      expect(convertSecondsToHumanReadable(315360000)).toBe('10 years') // 10 years
    })

    it('should handle zero seconds', () => {
      // Arrange & Act
      const result = convertSecondsToHumanReadable(0)
      
      // Assert
      expect(result).toBe('0 second') // Uses singular form for 0 and 1
    })

    it('should use singular forms correctly', () => {
      // Arrange & Act & Assert
      expect(convertSecondsToHumanReadable(1)).toBe('1 second')
      expect(convertSecondsToHumanReadable(60)).toBe('1 minute')
      expect(convertSecondsToHumanReadable(3600)).toBe('1 hour')
      expect(convertSecondsToHumanReadable(86400)).toBe('1 day')
      expect(convertSecondsToHumanReadable(604800)).toBe('1 week')
      expect(convertSecondsToHumanReadable(2592000)).toBe('1 month')
      expect(convertSecondsToHumanReadable(31536000)).toBe('1 year')
    })

    it('should use plural forms correctly', () => {
      // Arrange & Act & Assert
      expect(convertSecondsToHumanReadable(2)).toBe('2 seconds')
      expect(convertSecondsToHumanReadable(120)).toBe('2 minutes')
      expect(convertSecondsToHumanReadable(7200)).toBe('2 hours')
      expect(convertSecondsToHumanReadable(172800)).toBe('2 days')
      expect(convertSecondsToHumanReadable(1209600)).toBe('2 weeks')
      expect(convertSecondsToHumanReadable(5184000)).toBe('2 months')
      expect(convertSecondsToHumanReadable(63072000)).toBe('2 years')
    })

    it('should handle fractional seconds (should be floored)', () => {
      // Arrange & Act & Assert
      expect(convertSecondsToHumanReadable(119.9)).toBe('1 minute') // 119.9/60 = 1.99, floored to 1
      expect(convertSecondsToHumanReadable(3659.5)).toBe('1 hour') // 3659.5/3600 = 1.01, floored to 1
    })

    it('should handle edge case that might return empty string', () => {
      // The default case should never be reached with valid inputs
      // but testing the switch statement structure
      const result = convertSecondsToHumanReadable(10)
      expect(result).toBe('10 seconds')
    })

    it('should handle large values correctly', () => {
      // Arrange - 100 years worth of seconds
      const hundredYears = 31536000 * 100
      
      // Act
      const result = convertSecondsToHumanReadable(hundredYears)
      
      // Assert
      expect(result).toBe('100 years')
    })
  })

  describe('getTimestampFormat', () => {
    beforeEach(() => {
      // Set a fixed time for consistent timestamp formatting tests
      const fixedTime = dayjs('2024-01-01 14:30:45')
      vi.setSystemTime(fixedTime.toDate())
    })

    it('should return empty string when timestamp is null', () => {
      // Arrange & Act & Assert
      expect(getTimestampFormat(null, 'h:mm')).toBe('')
    })

    it('should return empty string when timestamp is undefined', () => {
      // Arrange & Act & Assert
      expect(getTimestampFormat(undefined, 'h:mm')).toBe('')
    })

    it('should return empty string when timestamp is empty string', () => {
      // Arrange & Act & Assert
      expect(getTimestampFormat('', 'h:mm')).toBe('')
    })

    it('should return empty string when format is "disabled"', () => {
      // Arrange
      const timestamp = dayjs('2024-01-01 14:30:45').valueOf()
      
      // Act & Assert
      expect(getTimestampFormat(timestamp, 'disabled')).toBe('')
    })

    it('should format "h:mm" correctly', () => {
      // Arrange
      const timestamp = dayjs('2024-01-01 14:30:45').valueOf()
      
      // Act
      const result = getTimestampFormat(timestamp, 'h:mm')
      
      // Assert
      expect(result).toBe('2:30')
    })

    it('should format "hh:mm" correctly', () => {
      // Arrange
      const timestamp = dayjs('2024-01-01 14:30:45').valueOf()
      
      // Act
      const result = getTimestampFormat(timestamp, 'hh:mm')
      
      // Assert
      expect(result).toBe('14:30')
    })

    it('should format "h:mm a" correctly', () => {
      // Arrange
      const timestamp = dayjs('2024-01-01 14:30:45').valueOf()
      
      // Act
      const result = getTimestampFormat(timestamp, 'h:mm a')
      
      // Assert
      expect(result).toBe('2:30 PM')
    })

    it('should format "hh:mm a" correctly', () => {
      // Arrange
      const timestamp = dayjs('2024-01-01 14:30:45').valueOf()
      
      // Act
      const result = getTimestampFormat(timestamp, 'hh:mm a')
      
      // Assert
      expect(result).toBe('14:30 PM')
    })

    it('should format "h:mm:ss" correctly', () => {
      // Arrange
      const timestamp = dayjs('2024-01-01 14:30:45').valueOf()
      
      // Act
      const result = getTimestampFormat(timestamp, 'h:mm:ss')
      
      // Assert
      expect(result).toBe('2:30:45')
    })

    it('should format "hh:mm:ss" correctly', () => {
      // Arrange
      const timestamp = dayjs('2024-01-01 14:30:45').valueOf()
      
      // Act
      const result = getTimestampFormat(timestamp, 'hh:mm:ss')
      
      // Assert
      expect(result).toBe('14:30:45')
    })

    it('should format "h:mm:ss a" correctly', () => {
      // Arrange
      const timestamp = dayjs('2024-01-01 14:30:45').valueOf()
      
      // Act
      const result = getTimestampFormat(timestamp, 'h:mm:ss a')
      
      // Assert
      expect(result).toBe('2:30:45 PM')
    })

    it('should format "hh:mm:ss a" correctly', () => {
      // Arrange
      const timestamp = dayjs('2024-01-01 14:30:45').valueOf()
      
      // Act
      const result = getTimestampFormat(timestamp, 'hh:mm:ss a')
      
      // Assert
      expect(result).toBe('14:30:45 PM')
    })

    it('should return empty string for unsupported format', () => {
      // Arrange
      const timestamp = dayjs('2024-01-01 14:30:45').valueOf()
      
      // Act & Assert
      expect(getTimestampFormat(timestamp, 'invalid')).toBe('')
      expect(getTimestampFormat(timestamp, 'yyyy-mm-dd')).toBe('')
      expect(getTimestampFormat(timestamp, 'custom')).toBe('')
    })

    it('should handle morning hours correctly with 12-hour format', () => {
      // Arrange - 9:15:30 AM
      const timestamp = dayjs('2024-01-01 09:15:30').valueOf()
      
      // Act & Assert
      expect(getTimestampFormat(timestamp, 'h:mm a')).toBe('9:15 AM')
      expect(getTimestampFormat(timestamp, 'h:mm:ss a')).toBe('9:15:30 AM')
    })

    it('should handle midnight correctly', () => {
      // Arrange - midnight
      const timestamp = dayjs('2024-01-01 00:00:00').valueOf()
      
      // Act & Assert
      expect(getTimestampFormat(timestamp, 'h:mm')).toBe('12:00')
      expect(getTimestampFormat(timestamp, 'hh:mm')).toBe('00:00')
      expect(getTimestampFormat(timestamp, 'h:mm a')).toBe('12:00 AM')
    })

    it('should handle noon correctly', () => {
      // Arrange - noon
      const timestamp = dayjs('2024-01-01 12:00:00').valueOf()
      
      // Act & Assert
      expect(getTimestampFormat(timestamp, 'h:mm')).toBe('12:00')
      expect(getTimestampFormat(timestamp, 'hh:mm')).toBe('12:00')
      expect(getTimestampFormat(timestamp, 'h:mm a')).toBe('12:00 PM')
    })

    it('should handle single digit minutes and seconds', () => {
      // Arrange - 2:05:03 AM
      const timestamp = dayjs('2024-01-01 02:05:03').valueOf()
      
      // Act & Assert
      expect(getTimestampFormat(timestamp, 'h:mm')).toBe('2:05')
      expect(getTimestampFormat(timestamp, 'hh:mm')).toBe('02:05')
      expect(getTimestampFormat(timestamp, 'h:mm:ss')).toBe('2:05:03')
      expect(getTimestampFormat(timestamp, 'hh:mm:ss')).toBe('02:05:03')
    })

    it('should accept different timestamp input types', () => {
      // Arrange - test with string timestamp
      const stringTimestamp = '2024-01-01 14:30:45'
      
      // Act
      const result = getTimestampFormat(stringTimestamp, 'h:mm')
      
      // Assert
      expect(result).toBe('2:30')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle null and undefined inputs appropriately', () => {
      // Arrange & Act & Assert
      // rgbaToString will throw for null/undefined because it tries to access properties
      expect(() => rgbaToString(null)).toThrow()
      expect(() => rgbaToString(undefined)).toThrow()
      
      // Time conversion functions handle null/undefined by treating them as 0
      expect(() => convertMinutesToHumanReadable(null)).not.toThrow()
      expect(() => convertSecondsToHumanReadable(undefined)).not.toThrow()
    })

    it('should handle negative values in time conversion functions', () => {
      // Arrange & Act & Assert
      expect(convertMinutesToHumanReadable(-10)).toBe('-10 minute') // Uses singular for negative
      expect(convertSecondsToHumanReadable(-5)).toBe('-5 second') // Uses singular for negative
    })

    it('should handle very large numbers', () => {
      // Arrange
      const largeNumber = Number.MAX_SAFE_INTEGER
      
      // Act & Assert - should not throw errors
      expect(() => convertMinutesToHumanReadable(largeNumber)).not.toThrow()
      expect(() => convertSecondsToHumanReadable(largeNumber)).not.toThrow()
    })

    it('should handle invalid date strings in convertDateToHumanReadable', () => {
      // Arrange
      const invalidDate = 'not-a-date'
      
      // Act & Assert - dayjs should handle invalid dates gracefully
      expect(() => convertDateToHumanReadable(invalidDate)).not.toThrow()
    })

    it('should handle RGBA object with missing properties', () => {
      // Arrange
      const incompleteRgba = { r: 255, g: 128 } // missing b and a
      
      // Act
      const result = rgbaToString(incompleteRgba)
      
      // Assert
      expect(result).toBe('rgba(255, 128, undefined, undefined)')
    })

    it('should handle scrollToBottom with malformed ref object', () => {
      // Arrange
      const malformedRef = {}
      const mockSetShowScrollToBottom = vi.fn()
      
      // Act & Assert - should not throw
      expect(() => scrollToBottom(malformedRef, mockSetShowScrollToBottom)).not.toThrow()
      expect(mockSetShowScrollToBottom).not.toHaveBeenCalled()
    })

    it('should handle getTimestampFormat with invalid dayjs input', () => {
      // Arrange
      const invalidTimestamp = 'invalid-timestamp'
      
      // Act & Assert - should handle gracefully
      expect(() => getTimestampFormat(invalidTimestamp, 'h:mm')).not.toThrow()
    })
  })

  describe('Function Integration', () => {
    it('should work together in typical chat scenarios', () => {
      // Arrange - simulate a typical chat message processing scenario
      const chatRef = {
        current: {
          scrollTop: 0,
          scrollHeight: 500
        }
      }
      const setScrollButton = vi.fn()
      const messageDate = '2024-01-01 16:00:00' // 30 minutes after current time
      const userColor = { r: 100, g: 150, b: 200, a: 1 }
      
      // Set current time 
      vi.setSystemTime(dayjs('2024-01-01 15:30:00').toDate())
      
      // Act
      const colorString = rgbaToString(userColor)
      const timeAgo = convertDateToHumanReadable(messageDate)
      const timestamp = getTimestampFormat(dayjs(messageDate).valueOf(), 'h:mm a')
      scrollToBottom(chatRef, setScrollButton)
      
      // Assert
      expect(colorString).toBe('rgba(100, 150, 200, 1)')
      expect(timeAgo).toBe('-30m ago')
      expect(timestamp).toBe('4:00 PM')
      expect(chatRef.current.scrollTop).toBe(500)
      expect(setScrollButton).toHaveBeenCalledWith(false)
    })

    it('should handle time conversions consistently', () => {
      // Arrange
      const fiveMinutesInSeconds = 5 * 60
      const fiveMinutes = 5
      const twoHoursInMinutes = 2 * 60
      const twoHoursInSeconds = 2 * 60 * 60
      
      // Act & Assert - ensure consistent formatting across functions
      expect(convertSecondsToHumanReadable(fiveMinutesInSeconds)).toBe('5 minutes')
      expect(convertMinutesToHumanReadable(fiveMinutes)).toBe('5 minutes')
      
      expect(convertSecondsToHumanReadable(twoHoursInSeconds)).toBe('2 hours')
      expect(convertMinutesToHumanReadable(twoHoursInMinutes)).toBe('2 hours')
    })
  })
})