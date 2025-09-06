import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chatroomErrorHandler } from './chatErrors'

// Mock the constants module
vi.mock('@utils/constants', () => ({
  CHAT_ERROR_CODES: {
    FOLLOWERS_ONLY_ERROR: "You must be following this channel to send messages.",
    Unauthorized: "You must login to chat.",
    BANNED_ERROR: "You are banned or temporarily banned from this channel.",
    SLOW_MODE_ERROR: "Chatroom is in slow mode. Slow down your messages.",
    NO_LINKS_ERROR: "You are not allowed to send links in this chatroom.",
    SUBSCRIBERS_ONLY_EMOTE_ERROR: "Message contains subscriber only emote.",
    EMOTES_ONLY_ERROR: "Chatroom is in emote only mode. Only emotes are allowed.",
    SUBSCRIBERS_ONLY_ERROR: "Chatroom is in subscribers only mode.",
    ORIGINAL_MESSAGE_NOT_FOUND_ERROR: "Message cannot be replied to. It is old or no longer exists.",
    CHAT_RATE_LIMIT_ERROR: "Rate limit triggered. Slow down.",
    PINNED_MESSAGE_NOT_FOUND_ERROR: "Cannot pin message. It is old or no longer exists.",
    USER_NOT_MODERATOR: "Unable to remove moderator from user. User is not a moderator.",
    USER_NOT_VIP: "Unable to remove VIP from user. User is not a VIP.",
    USER_NOT_OG: "Unable to remove OG from user. User is not an OG.",
  }
}))

describe('chatErrors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('chatroomErrorHandler', () => {
    describe('Standard Error Code Handling', () => {
      it('should return followers only error message', () => {
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
        expect(result).toBe("You must be following this channel to send messages.")
      })

      it('should return unauthorized error message', () => {
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
        expect(result).toBe("You must login to chat.")
      })

      it('should return banned error message', () => {
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
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("You are banned or temporarily banned from this channel.")
      })

      it('should return slow mode error message', () => {
        // Arrange
        const error = {
          response: {
            data: {
              status: {
                message: 'SLOW_MODE_ERROR'
              }
            }
          }
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("Chatroom is in slow mode. Slow down your messages.")
      })

      it('should return no links error message', () => {
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
        expect(result).toBe("You are not allowed to send links in this chatroom.")
      })

      it('should return subscribers only emote error message', () => {
        // Arrange
        const error = {
          response: {
            data: {
              status: {
                message: 'SUBSCRIBERS_ONLY_EMOTE_ERROR'
              }
            }
          }
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("Message contains subscriber only emote.")
      })

      it('should return emotes only error message', () => {
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
        expect(result).toBe("Chatroom is in emote only mode. Only emotes are allowed.")
      })

      it('should return subscribers only error message', () => {
        // Arrange
        const error = {
          response: {
            data: {
              status: {
                message: 'SUBSCRIBERS_ONLY_ERROR'
              }
            }
          }
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("Chatroom is in subscribers only mode.")
      })

      it('should return original message not found error message', () => {
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
        expect(result).toBe("Message cannot be replied to. It is old or no longer exists.")
      })

      it('should return rate limit error message', () => {
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
        expect(result).toBe("Rate limit triggered. Slow down.")
      })

      it('should return pinned message not found error message', () => {
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
        expect(result).toBe("Cannot pin message. It is old or no longer exists.")
      })
    })

    describe('Moderator Action Error Codes', () => {
      it('should return user not moderator error message', () => {
        // Arrange
        const error = {
          response: {
            data: {
              status: {
                message: 'USER_NOT_MODERATOR'
              }
            }
          }
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("Unable to remove moderator from user. User is not a moderator.")
      })

      it('should return user not VIP error message', () => {
        // Arrange
        const error = {
          response: {
            data: {
              status: {
                message: 'USER_NOT_VIP'
              }
            }
          }
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("Unable to remove VIP from user. User is not a VIP.")
      })

      it('should return user not OG error message', () => {
        // Arrange
        const error = {
          response: {
            data: {
              status: {
                message: 'USER_NOT_OG'
              }
            }
          }
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("Unable to remove OG from user. User is not an OG.")
      })
    })

    describe('Alternative Error Code Extraction', () => {
      it('should extract error code from error.code when response structure is missing', () => {
        // Arrange
        const error = {
          code: 'FOLLOWERS_ONLY_ERROR'
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("You must be following this channel to send messages.")
      })

      it('should prefer response structure over error.code when both exist', () => {
        // Arrange
        const error = {
          code: 'BANNED_ERROR',
          response: {
            data: {
              status: {
                message: 'SLOW_MODE_ERROR'
              }
            }
          }
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("Chatroom is in slow mode. Slow down your messages.")
      })

      it('should fall back to error.code when response structure is incomplete', () => {
        // Arrange
        const error = {
          code: 'UNAUTHORIZED',
          response: {
            data: {}
          }
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("An error occurred while sending your message.")
      })

      it('should handle error.code with Unauthorized value', () => {
        // Arrange
        const error = {
          code: 'Unauthorized'
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("You must login to chat.")
      })
    })

    describe('Default Error Handling', () => {
      it('should return default error message for unknown error codes', () => {
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
        expect(result).toBe("An error occurred while sending your message.")
      })

      it('should return default error message when error code is null', () => {
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
        expect(result).toBe("An error occurred while sending your message.")
      })

      it('should return default error message when error code is undefined', () => {
        // Arrange
        const error = {
          response: {
            data: {
              status: {
                message: undefined
              }
            }
          }
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("An error occurred while sending your message.")
      })

      it('should return default error message when error code is empty string', () => {
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
        expect(result).toBe("An error occurred while sending your message.")
      })
    })

    describe('Edge Cases and Null Safety', () => {
      it('should handle null error input', () => {
        // Arrange & Act
        const result = chatroomErrorHandler(null)

        // Assert
        expect(result).toBe("An error occurred while sending your message.")
      })

      it('should handle undefined error input', () => {
        // Arrange & Act
        const result = chatroomErrorHandler(undefined)

        // Assert
        expect(result).toBe("An error occurred while sending your message.")
      })

      it('should handle empty object error input', () => {
        // Arrange
        const error = {}

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("An error occurred while sending your message.")
      })

      it('should handle error with null response', () => {
        // Arrange
        const error = {
          response: null
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("An error occurred while sending your message.")
      })

      it('should handle error with undefined response', () => {
        // Arrange
        const error = {
          response: undefined
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("An error occurred while sending your message.")
      })

      it('should handle error with null response.data', () => {
        // Arrange
        const error = {
          response: {
            data: null
          }
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("An error occurred while sending your message.")
      })

      it('should handle error with undefined response.data', () => {
        // Arrange
        const error = {
          response: {
            data: undefined
          }
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("An error occurred while sending your message.")
      })

      it('should handle error with null response.data.status', () => {
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
        expect(result).toBe("An error occurred while sending your message.")
      })

      it('should handle error with undefined response.data.status', () => {
        // Arrange
        const error = {
          response: {
            data: {
              status: undefined
            }
          }
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("An error occurred while sending your message.")
      })

      it('should handle malformed nested error structure', () => {
        // Arrange
        const error = {
          response: {
            data: {
              status: {
                // missing message property
              }
            }
          }
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("An error occurred while sending your message.")
      })

      it('should handle circular reference in error object', () => {
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
        error.self = error // Create circular reference

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("You are banned or temporarily banned from this channel.")
      })
    })

    describe('Case Sensitivity and String Matching', () => {
      it('should handle exact case match for error codes', () => {
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
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("You are banned or temporarily banned from this channel.")
      })

      it('should not match case-insensitive error codes', () => {
        // Arrange
        const error = {
          response: {
            data: {
              status: {
                message: 'banned_error' // lowercase
              }
            }
          }
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("An error occurred while sending your message.")
      })

      it('should handle error codes with extra whitespace', () => {
        // Arrange
        const error = {
          response: {
            data: {
              status: {
                message: ' BANNED_ERROR '
              }
            }
          }
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("An error occurred while sending your message.")
      })

      it('should handle numerical error codes', () => {
        // Arrange
        const error = {
          code: 404
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("An error occurred while sending your message.")
      })

      it('should handle boolean error codes', () => {
        // Arrange
        const error = {
          code: true
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("An error occurred while sending your message.")
      })
    })

    describe('Multiple Error Scenarios', () => {
      it('should handle error object with multiple potential error sources', () => {
        // Arrange
        const error = {
          code: 'SLOW_MODE_ERROR',
          message: 'Some other message',
          response: {
            data: {
              status: {
                message: 'BANNED_ERROR'
              }
            }
          },
          statusCode: 429
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert - should prioritize response structure
        expect(result).toBe("You are banned or temporarily banned from this channel.")
      })

      it('should handle complex error response structure', () => {
        // Arrange
        const error = {
          response: {
            status: 400,
            statusText: 'Bad Request',
            data: {
              error: 'Validation failed',
              status: {
                code: 400,
                message: 'FOLLOWERS_ONLY_ERROR',
                details: 'User must follow channel'
              }
            }
          }
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("You must be following this channel to send messages.")
      })
    })

    describe('Performance and Memory', () => {
      it('should handle large error objects without performance issues', () => {
        // Arrange
        const largeError = {
          response: {
            data: {
              status: {
                message: 'RATE_LIMIT_ERROR'
              },
              // Add large data payload
              largeData: Array.from({ length: 10000 }, (_, i) => ({ id: i, data: 'test data' }))
            }
          }
        }

        // Act
        const startTime = performance.now()
        const result = chatroomErrorHandler(largeError)
        const endTime = performance.now()

        // Assert
        expect(result).toBe("An error occurred while sending your message.")
        expect(endTime - startTime).toBeLessThan(10) // Should complete within 10ms
      })

      it('should not modify the original error object', () => {
        // Arrange
        const originalError = {
          response: {
            data: {
              status: {
                message: 'BANNED_ERROR'
              }
            }
          }
        }
        const errorCopy = JSON.parse(JSON.stringify(originalError))

        // Act
        chatroomErrorHandler(originalError)

        // Assert
        expect(originalError).toEqual(errorCopy)
      })
    })

    describe('Function Robustness', () => {
      it('should handle deeply nested null properties', () => {
        // Arrange
        const error = {
          response: {
            data: {
              status: {
                message: {
                  toString: () => 'BANNED_ERROR'
                }
              }
            }
          }
        }

        // Act
        const result = chatroomErrorHandler(error)

        // Assert
        expect(result).toBe("An error occurred while sending your message.")
      })

      it('should handle error objects with prototype pollution attempts', () => {
        // Arrange
        const maliciousError = {
          response: {
            data: {
              status: {
                message: 'BANNED_ERROR'
              }
            }
          },
          '__proto__': {
            polluted: true
          }
        }

        // Act
        const result = chatroomErrorHandler(maliciousError)

        // Assert
        expect(result).toBe("You are banned or temporarily banned from this channel.")
        expect(Object.prototype.polluted).toBeUndefined()
      })

      it('should handle frozen error objects', () => {
        // Arrange
        const frozenError = Object.freeze({
          response: Object.freeze({
            data: Object.freeze({
              status: Object.freeze({
                message: 'SLOW_MODE_ERROR'
              })
            })
          })
        })

        // Act
        const result = chatroomErrorHandler(frozenError)

        // Assert
        expect(result).toBe("Chatroom is in slow mode. Slow down your messages.")
      })
    })
  })
})