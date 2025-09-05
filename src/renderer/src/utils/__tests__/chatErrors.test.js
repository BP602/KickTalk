import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chatroomErrorHandler } from '../chatErrors.js'
import { CHAT_ERROR_CODES } from '@utils/constants'

// Mock the constants module
vi.mock('@utils/constants', () => ({
  CHAT_ERROR_CODES: {
    'FOLLOWERS_ONLY_ERROR': 'You must be following this channel to send messages.',
    'Unauthorized': 'You must login to chat.',
    'BANNED_ERROR': 'You are banned or temporarily banned from this channel.',
    'SLOW_MODE_ERROR': 'Chatroom is in slow mode. Slow down your messages.',
    'NO_LINKS_ERROR': 'You are not allowed to send links in this chatroom.',
    'SUBSCRIBERS_ONLY_EMOTE_ERROR': 'Message contains subscriber only emote.',
    'EMOTES_ONLY_ERROR': 'Chatroom is in emote only mode. Only emotes are allowed.',
    'SUBSCRIBERS_ONLY_ERROR': 'Chatroom is in subscribers only mode.',
    'ORIGINAL_MESSAGE_NOT_FOUND_ERROR': 'Message cannot be replied to. It is old or no longer exists.',
    'CHAT_RATE_LIMIT_ERROR': 'Rate limit triggered. Slow down.',
    'PINNED_MESSAGE_NOT_FOUND_ERROR': 'Cannot pin message. It is old or no longer exists.',
    'USER_NOT_MODERATOR': 'Unable to remove moderator from user. User is not a moderator.',
    'USER_NOT_VIP': 'Unable to remove VIP from user. User is not a VIP.',
    'USER_NOT_OG': 'Unable to remove OG from user. User is not an OG.',
  }
}))

describe('chatroomErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Valid error code handling', () => {
    it('should return correct message for FOLLOWERS_ONLY_ERROR from response.data.status.message', () => {
      // Arrange
      const error = {
        response: {
          data: {
            status: {
              message: 'FOLLOWERS_ONLY_ERROR'
            }
          }
        }
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('You must be following this channel to send messages.')
    })

    it('should return correct message for Unauthorized from response.data.status.message', () => {
      // Arrange
      const error = {
        response: {
          data: {
            status: {
              message: 'Unauthorized'
            }
          }
        }
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('You must login to chat.')
    })

    it('should return correct message for BANNED_ERROR from error.code', () => {
      // Arrange
      const error = {
        code: 'BANNED_ERROR'
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('You are banned or temporarily banned from this channel.')
    })

    it('should return correct message for SLOW_MODE_ERROR from error.code', () => {
      // Arrange
      const error = {
        code: 'SLOW_MODE_ERROR'
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('Chatroom is in slow mode. Slow down your messages.')
    })

    it('should return correct message for NO_LINKS_ERROR', () => {
      // Arrange
      const error = {
        response: {
          data: {
            status: {
              message: 'NO_LINKS_ERROR'
            }
          }
        }
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('You are not allowed to send links in this chatroom.')
    })

    it('should return correct message for SUBSCRIBERS_ONLY_EMOTE_ERROR', () => {
      // Arrange
      const error = {
        code: 'SUBSCRIBERS_ONLY_EMOTE_ERROR'
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('Message contains subscriber only emote.')
    })

    it('should return correct message for EMOTES_ONLY_ERROR', () => {
      // Arrange
      const error = {
        response: {
          data: {
            status: {
              message: 'EMOTES_ONLY_ERROR'
            }
          }
        }
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('Chatroom is in emote only mode. Only emotes are allowed.')
    })

    it('should return correct message for SUBSCRIBERS_ONLY_ERROR', () => {
      // Arrange
      const error = {
        code: 'SUBSCRIBERS_ONLY_ERROR'
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('Chatroom is in subscribers only mode.')
    })

    it('should return correct message for ORIGINAL_MESSAGE_NOT_FOUND_ERROR', () => {
      // Arrange
      const error = {
        response: {
          data: {
            status: {
              message: 'ORIGINAL_MESSAGE_NOT_FOUND_ERROR'
            }
          }
        }
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('Message cannot be replied to. It is old or no longer exists.')
    })

    it('should return correct message for CHAT_RATE_LIMIT_ERROR', () => {
      // Arrange
      const error = {
        code: 'CHAT_RATE_LIMIT_ERROR'
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('Rate limit triggered. Slow down.')
    })

    it('should return correct message for PINNED_MESSAGE_NOT_FOUND_ERROR', () => {
      // Arrange
      const error = {
        response: {
          data: {
            status: {
              message: 'PINNED_MESSAGE_NOT_FOUND_ERROR'
            }
          }
        }
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('Cannot pin message. It is old or no longer exists.')
    })

    it('should return correct message for broadcaster action errors', () => {
      // Arrange
      const userNotModError = { code: 'USER_NOT_MODERATOR' }
      const userNotVipError = { code: 'USER_NOT_VIP' }
      const userNotOgError = { code: 'USER_NOT_OG' }
      
      // Act & Assert
      expect(chatroomErrorHandler(userNotModError)).toBe('Unable to remove moderator from user. User is not a moderator.')
      expect(chatroomErrorHandler(userNotVipError)).toBe('Unable to remove VIP from user. User is not a VIP.')
      expect(chatroomErrorHandler(userNotOgError)).toBe('Unable to remove OG from user. User is not an OG.')
    })
  })

  describe('Error code precedence', () => {
    it('should prioritize response.data.status.message over error.code when both exist', () => {
      // Arrange
      const error = {
        response: {
          data: {
            status: {
              message: 'FOLLOWERS_ONLY_ERROR'
            }
          }
        },
        code: 'BANNED_ERROR'
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('You must be following this channel to send messages.')
    })

    it('should fallback to error.code when response.data.status.message is not present', () => {
      // Arrange
      const error = {
        response: {
          data: {
            status: {}
          }
        },
        code: 'SLOW_MODE_ERROR'
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('Chatroom is in slow mode. Slow down your messages.')
    })

    it('should fallback to error.code when response structure is incomplete', () => {
      // Arrange
      const error = {
        response: {
          data: {}
        },
        code: 'NO_LINKS_ERROR'
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('You are not allowed to send links in this chatroom.')
    })
  })

  describe('Invalid/unknown error codes', () => {
    it('should return default message for unknown error code in response.data.status.message', () => {
      // Arrange
      const error = {
        response: {
          data: {
            status: {
              message: 'UNKNOWN_ERROR_CODE'
            }
          }
        }
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('An error occurred while sending your message.')
    })

    it('should return default message for unknown error code in error.code', () => {
      // Arrange
      const error = {
        code: 'INVALID_ERROR_TYPE'
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('An error occurred while sending your message.')
    })

    it('should return default message for empty string error code', () => {
      // Arrange
      const error = {
        response: {
          data: {
            status: {
              message: ''
            }
          }
        }
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('An error occurred while sending your message.')
    })

    it('should return default message for numeric error codes', () => {
      // Arrange
      const error = {
        code: 404
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('An error occurred while sending your message.')
    })

    it('should return default message for whitespace-only error code', () => {
      // Arrange
      const error = {
        response: {
          data: {
            status: {
              message: '   '
            }
          }
        }
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('An error occurred while sending your message.')
    })
  })

  describe('Malformed error objects', () => {
    it('should return default message when error is null', () => {
      // Arrange
      const error = null
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('An error occurred while sending your message.')
    })

    it('should return default message when error is undefined', () => {
      // Arrange
      const error = undefined
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('An error occurred while sending your message.')
    })

    it('should return default message when error is empty object', () => {
      // Arrange
      const error = {}
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('An error occurred while sending your message.')
    })

    it('should return default message when response is null', () => {
      // Arrange
      const error = {
        response: null
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('An error occurred while sending your message.')
    })

    it('should return default message when data is null', () => {
      // Arrange
      const error = {
        response: {
          data: null
        }
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('An error occurred while sending your message.')
    })

    it('should return default message when status is null', () => {
      // Arrange
      const error = {
        response: {
          data: {
            status: null
          }
        }
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('An error occurred while sending your message.')
    })

    it('should return default message when message is null', () => {
      // Arrange
      const error = {
        response: {
          data: {
            status: {
              message: null
            }
          }
        }
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('An error occurred while sending your message.')
    })

    it('should return default message when error.code is null', () => {
      // Arrange
      const error = {
        code: null
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('An error occurred while sending your message.')
    })

    it('should handle deeply nested undefined properties', () => {
      // Arrange
      const error = {
        response: {
          data: {
            status: {
              message: undefined
            }
          }
        },
        code: undefined
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('An error occurred while sending your message.')
    })
  })

  describe('Different error response structures', () => {
    it('should handle error with only response.data.status.message', () => {
      // Arrange
      const error = {
        response: {
          data: {
            status: {
              message: 'CHAT_RATE_LIMIT_ERROR'
            }
          }
        }
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('Rate limit triggered. Slow down.')
    })

    it('should handle error with only error.code', () => {
      // Arrange
      const error = {
        code: 'EMOTES_ONLY_ERROR'
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('Chatroom is in emote only mode. Only emotes are allowed.')
    })

    it('should handle error with additional unrelated properties', () => {
      // Arrange
      const error = {
        response: {
          data: {
            status: {
              message: 'SUBSCRIBERS_ONLY_ERROR'
            }
          }
        },
        code: 'DIFFERENT_ERROR',
        extraProperty: 'should be ignored',
        timestamp: Date.now(),
        nested: {
          deep: {
            property: 'irrelevant'
          }
        }
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('Chatroom is in subscribers only mode.')
    })

    it('should handle error with response but missing data property', () => {
      // Arrange
      const error = {
        response: {
          status: 'error',
          statusText: 'Bad Request'
        },
        code: 'BANNED_ERROR'
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('You are banned or temporarily banned from this channel.')
    })

    it('should handle error with data but missing status property', () => {
      // Arrange
      const error = {
        response: {
          data: {
            error: 'Some error occurred'
          }
        },
        code: 'USER_NOT_VIP'
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('Unable to remove VIP from user. User is not a VIP.')
    })

    it('should handle error with status but missing message property', () => {
      // Arrange
      const error = {
        response: {
          data: {
            status: {
              code: 400,
              type: 'validation_error'
            }
          }
        },
        code: 'PINNED_MESSAGE_NOT_FOUND_ERROR'
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('Cannot pin message. It is old or no longer exists.')
    })
  })

  describe('Edge cases in error processing', () => {
    it('should handle boolean values in error properties', () => {
      // Arrange
      const error = {
        response: {
          data: {
            status: {
              message: true
            }
          }
        },
        code: false
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('An error occurred while sending your message.')
    })

    it('should handle array values in error properties', () => {
      // Arrange - arrays are converted to strings when used as object keys
      const errorWithValidArrayMessage = {
        response: {
          data: {
            status: {
              message: ['FOLLOWERS_ONLY_ERROR'] // JavaScript converts this to "FOLLOWERS_ONLY_ERROR" string
            }
          }
        }
      }
      
      const errorWithInvalidArrayMessage = {
        response: {
          data: {
            status: {
              message: ['INVALID_CODE', 'ANOTHER_CODE'] // JavaScript converts this to "INVALID_CODE,ANOTHER_CODE" string
            }
          }
        }
      }
      
      const errorWithArrayCode = {
        code: ['BANNED_ERROR'] // JavaScript converts this to "BANNED_ERROR" string
      }
      
      // Act & Assert
      expect(chatroomErrorHandler(errorWithValidArrayMessage)).toBe('You must be following this channel to send messages.')
      expect(chatroomErrorHandler(errorWithInvalidArrayMessage)).toBe('An error occurred while sending your message.')
      expect(chatroomErrorHandler(errorWithArrayCode)).toBe('You are banned or temporarily banned from this channel.')
    })

    it('should handle object values in error properties', () => {
      // Arrange
      const error = {
        response: {
          data: {
            status: {
              message: { error: 'SLOW_MODE_ERROR' }
            }
          }
        },
        code: { type: 'NO_LINKS_ERROR' }
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('An error occurred while sending your message.')
    })

    it('should handle zero as error code', () => {
      // Arrange
      const error = {
        code: 0
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('An error occurred while sending your message.')
    })

    it('should handle function values in error properties', () => {
      // Arrange
      const error = {
        response: {
          data: {
            status: {
              message: () => 'EMOTES_ONLY_ERROR'
            }
          }
        }
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('An error occurred while sending your message.')
    })
  })

  describe('Case sensitivity', () => {
    it('should be case sensitive for error codes', () => {
      // Arrange
      const lowerCaseError = {
        code: 'followers_only_error'
      }
      const mixedCaseError = {
        response: {
          data: {
            status: {
              message: 'Followers_Only_Error'
            }
          }
        }
      }
      
      // Act & Assert
      expect(chatroomErrorHandler(lowerCaseError)).toBe('An error occurred while sending your message.')
      expect(chatroomErrorHandler(mixedCaseError)).toBe('An error occurred while sending your message.')
    })

    it('should match exact case for valid error codes', () => {
      // Arrange
      const correctCaseError = {
        code: 'FOLLOWERS_ONLY_ERROR'
      }
      
      // Act
      const result = chatroomErrorHandler(correctCaseError)
      
      // Assert
      expect(result).toBe('You must be following this channel to send messages.')
    })
  })

  describe('Performance and consistency', () => {
    it('should handle repeated calls with same error object consistently', () => {
      // Arrange
      const error = {
        response: {
          data: {
            status: {
              message: 'BANNED_ERROR'
            }
          }
        }
      }
      
      // Act
      const result1 = chatroomErrorHandler(error)
      const result2 = chatroomErrorHandler(error)
      const result3 = chatroomErrorHandler(error)
      
      // Assert
      expect(result1).toBe(result2)
      expect(result2).toBe(result3)
      expect(result1).toBe('You are banned or temporarily banned from this channel.')
    })

    it('should handle multiple error objects with same error code consistently', () => {
      // Arrange
      const error1 = {
        response: { data: { status: { message: 'UNAUTHORIZED' } } }
      }
      const error2 = {
        code: 'UNAUTHORIZED'
      }
      const error3 = {
        response: { data: { status: { message: 'UNAUTHORIZED' } } },
        code: 'DIFFERENT_CODE'
      }
      
      // Act & Assert - Note: 'UNAUTHORIZED' is not in our mock, so should return default
      expect(chatroomErrorHandler(error1)).toBe('An error occurred while sending your message.')
      expect(chatroomErrorHandler(error2)).toBe('An error occurred while sending your message.')
      expect(chatroomErrorHandler(error3)).toBe('An error occurred while sending your message.')
    })

    it('should handle the Unauthorized case (capital U)', () => {
      // Arrange
      const error = {
        response: {
          data: {
            status: {
              message: 'Unauthorized'
            }
          }
        }
      }
      
      // Act
      const result = chatroomErrorHandler(error)
      
      // Assert
      expect(result).toBe('You must login to chat.')
    })
  })
})