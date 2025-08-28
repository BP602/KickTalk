import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ModActionMessage from './ModActionMessage.jsx'

// Mock ChatUtils
vi.mock('../../utils/ChatUtils', () => ({
  convertMinutesToHumanReadable: vi.fn((minutes) => {
    if (minutes === 1) return '1 minute'
    if (minutes === 60) return '1 hour'
    if (minutes === 1440) return '1 day'
    return `${minutes} minutes`
  })
}))

// Mock CosmeticsProvider
const mockGetUserStyle = vi.fn()

vi.mock('../../providers/CosmeticsProvider', () => ({
  default: vi.fn(() => mockGetUserStyle)
}))

vi.mock('zustand/react/shallow', () => ({
  useShallow: (fn) => fn
}))

// Mock window.app API
const mockWindowApp = {
  kick: {
    getUserChatroomInfo: vi.fn()
  },
  userDialog: {
    open: vi.fn()
  }
}

describe('ModActionMessage Component', () => {
  const mockMessage = {
    modAction: 'banned',
    modActionDetails: {
      banned_by: {
        username: 'moderatoruser'
      },
      user: {
        username: 'banneduser'
      },
      duration: null
    }
  }

  const defaultProps = {
    message: mockMessage,
    chatroomId: 'chatroom123',
    allStvEmotes: [
      { id: 'emote1', name: 'TestEmote', url: 'emote1.png' }
    ],
    subscriberBadges: [
      { id: 'sub1', name: 'Subscriber', months: 1 }
    ],
    chatroomName: 'testchatroom',
    userChatroomInfo: {
      id: 'currentuser123',
      is_broadcaster: false,
      is_moderator: true,
      is_super_admin: false
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.window.app = mockWindowApp
    mockGetUserStyle.mockReturnValue(null)
    mockWindowApp.kick.getUserChatroomInfo.mockResolvedValue({
      data: {
        id: 'user123',
        username: 'testuser',
        slug: 'testuser',
        badges: []
      }
    })
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Ban Actions Rendering', () => {
    it('should render permanent ban message', () => {
      render(<ModActionMessage {...defaultProps} />)

      expect(screen.getByText('moderatoruser')).toBeInTheDocument()
      expect(screen.getByText(/permanently banned/)).toBeInTheDocument()
      expect(screen.getByText('banneduser')).toBeInTheDocument()
    })

    it('should render temporary ban message with duration', () => {
      const tempBanMessage = {
        ...mockMessage,
        modAction: 'ban_temporary',
        modActionDetails: {
          ...mockMessage.modActionDetails,
          duration: 60 // 1 hour
        }
      }

      render(<ModActionMessage {...defaultProps} message={tempBanMessage} />)

      expect(screen.getByText('moderatoruser')).toBeInTheDocument()
      expect(screen.getByText(/timed out/)).toBeInTheDocument()
      expect(screen.getByText('banneduser')).toBeInTheDocument()
      expect(screen.getByText(/for 1 hour/)).toBeInTheDocument()
    })

    it('should handle different duration formats', () => {
      const testCases = [
        { duration: 1, expected: '1 minute' },
        { duration: 60, expected: '1 hour' },
        { duration: 1440, expected: '1 day' },
        { duration: 30, expected: '30 minutes' }
      ]

      testCases.forEach(({ duration, expected }) => {
        const tempBanMessage = {
          ...mockMessage,
          modAction: 'ban_temporary',
          modActionDetails: {
            ...mockMessage.modActionDetails,
            duration
          }
        }

        const { unmount } = render(<ModActionMessage {...defaultProps} message={tempBanMessage} />)
        expect(screen.getByText(new RegExp(`for ${expected}`))).toBeInTheDocument()
        unmount()
      })
    })
  })

  describe('Unban Actions Rendering', () => {
    it('should render unban message', () => {
      const unbanMessage = {
        ...mockMessage,
        modAction: 'unbanned',
        modActionDetails: {
          unbanned_by: {
            username: 'moderatoruser'
          },
          user: {
            username: 'unbanneduser'
          }
        }
      }

      render(<ModActionMessage {...defaultProps} message={unbanMessage} />)

      expect(screen.getByText('moderatoruser')).toBeInTheDocument()
      expect(screen.getByText((_, element) => {
        return element.textContent.includes('unbanned') && !element.textContent.includes('unbanneduser')
      })).toBeInTheDocument()
      expect(screen.getByText('unbanneduser')).toBeInTheDocument()
    })

    it('should render timeout removal message', () => {
      const timeoutRemovalMessage = {
        ...mockMessage,
        modAction: 'untimeout',
        modActionDetails: {
          unbanned_by: {
            username: 'moderatoruser'
          },
          user: {
            username: 'untimeduser'
          }
        }
      }

      render(<ModActionMessage {...defaultProps} message={timeoutRemovalMessage} />)

      expect(screen.getByText('moderatoruser')).toBeInTheDocument()
      expect(screen.getByText(/removed timeout on/)).toBeInTheDocument()
      expect(screen.getByText('untimeduser')).toBeInTheDocument()
    })
  })

  describe('Bot Moderation Actions', () => {
    it('should handle bot moderation actions', () => {
      const botMessage = {
        ...mockMessage,
        modActionDetails: {
          banned_by: {
            username: 'moderated'
          },
          user: {
            username: 'spammeruser'
          }
        }
      }

      render(<ModActionMessage {...defaultProps} message={botMessage} />)

      expect(screen.getByText('Bot')).toBeInTheDocument()
      expect(screen.getByText(/permanently banned/)).toBeInTheDocument()
      expect(screen.getByText('spammeruser')).toBeInTheDocument()
    })

    it('should not open user dialog for bot actions', async () => {
      const user = userEvent.setup()
      const botMessage = {
        ...mockMessage,
        modActionDetails: {
          banned_by: {
            username: 'moderated'
          },
          user: {
            username: 'spammeruser'
          }
        }
      }

      render(<ModActionMessage {...defaultProps} message={botMessage} />)

      const botButton = screen.getByText('Bot')
      await user.click(botButton)

      expect(mockWindowApp.kick.getUserChatroomInfo).not.toHaveBeenCalled()
      expect(mockWindowApp.userDialog.open).not.toHaveBeenCalled()
    })

    it('should not open user dialog for "moderator" username', async () => {
      const user = userEvent.setup()
      const moderatorMessage = {
        ...mockMessage,
        modActionDetails: {
          banned_by: {
            username: 'moderator'
          },
          user: {
            username: 'banneduser'
          }
        }
      }

      render(<ModActionMessage {...defaultProps} message={moderatorMessage} />)

      const moderatorButton = screen.getByText('moderator')
      await user.click(moderatorButton)

      expect(mockWindowApp.kick.getUserChatroomInfo).not.toHaveBeenCalled()
      expect(mockWindowApp.userDialog.open).not.toHaveBeenCalled()
    })
  })

  describe('User Dialog Integration', () => {
    it('should open user dialog for moderator', async () => {
      const user = userEvent.setup()

      render(<ModActionMessage {...defaultProps} />)

      const moderatorButton = screen.getByText('moderatoruser')
      await user.click(moderatorButton)

      await waitFor(() => {
        expect(mockWindowApp.kick.getUserChatroomInfo).toHaveBeenCalledWith('testchatroom', 'moderatoruser')
      })

      await waitFor(() => {
        expect(mockWindowApp.userDialog.open).toHaveBeenCalledWith({
          sender: expect.objectContaining({
            id: 'user123',
            username: 'testuser',
            slug: 'testuser',
            identity: { badges: [] }
          }),
          fetchedUser: expect.objectContaining({
            id: 'user123',
            username: 'testuser'
          }),
          chatroomId: 'chatroom123',
          userStyle: null,
          sevenTVEmotes: defaultProps.allStvEmotes,
          subscriberBadges: defaultProps.subscriberBadges,
          userChatroomInfo: defaultProps.userChatroomInfo,
          cords: [0, 300]
        })
      })
    })

    it('should open user dialog for target user', async () => {
      const user = userEvent.setup()

      render(<ModActionMessage {...defaultProps} />)

      const targetUserButton = screen.getByText('banneduser')
      await user.click(targetUserButton)

      await waitFor(() => {
        expect(mockWindowApp.kick.getUserChatroomInfo).toHaveBeenCalledWith('testchatroom', 'banneduser')
      })
    })

    it('should include user style in dialog when available', async () => {
      const user = userEvent.setup()
      const mockUserStyle = {
        badge: { id: 'badge1', name: 'Test Badge' },
        paint: { color: '#ff0000' }
      }
      mockGetUserStyle.mockReturnValue(mockUserStyle)

      render(<ModActionMessage {...defaultProps} />)

      const moderatorButton = screen.getByText('moderatoruser')
      await user.click(moderatorButton)

      await waitFor(() => {
        expect(mockWindowApp.userDialog.open).toHaveBeenCalledWith(
          expect.objectContaining({
            userStyle: mockUserStyle
          })
        )
      })
    })

    it('should handle API errors gracefully', async () => {
      const user = userEvent.setup()
      mockWindowApp.kick.getUserChatroomInfo.mockRejectedValue(new Error('API Error'))

      render(<ModActionMessage {...defaultProps} />)

      const moderatorButton = screen.getByText('moderatoruser')
      
      await expect(user.click(moderatorButton)).resolves.not.toThrow()
      
      await waitFor(() => {
        expect(mockWindowApp.userDialog.open).not.toHaveBeenCalled()
      })
    })

    it('should handle invalid user data from API', async () => {
      const user = userEvent.setup()
      mockWindowApp.kick.getUserChatroomInfo.mockResolvedValue({
        data: null // Invalid data
      })

      render(<ModActionMessage {...defaultProps} />)

      const moderatorButton = screen.getByText('moderatoruser')
      await user.click(moderatorButton)

      await waitFor(() => {
        expect(mockWindowApp.userDialog.open).not.toHaveBeenCalled()
      })
    })
  })

  describe('Action Type Detection', () => {
    it('should correctly identify ban actions', () => {
      const banTypes = ['banned', 'ban_temporary']

      banTypes.forEach(modAction => {
        const banMessage = {
          ...mockMessage,
          modAction,
          modActionDetails: {
            ...mockMessage.modActionDetails,
            duration: modAction === 'ban_temporary' ? 30 : null
          }
        }

        const { unmount } = render(<ModActionMessage {...defaultProps} message={banMessage} />)
        
        if (modAction === 'banned') {
          expect(screen.getByText(/permanently banned/)).toBeInTheDocument()
        } else {
          expect(screen.getByText(/timed out/)).toBeInTheDocument()
        }
        
        unmount()
      })
    })

    it('should correctly identify unban actions', () => {
      const unbanTypes = ['unbanned', 'untimeout']

      unbanTypes.forEach(modAction => {
        const unbanMessage = {
          ...mockMessage,
          modAction,
          modActionDetails: {
            unbanned_by: {
              username: 'moderatoruser'
            },
            user: {
              username: 'targetuser'
            }
          }
        }

        const { unmount } = render(<ModActionMessage {...defaultProps} message={unbanMessage} />)
        
        if (modAction === 'unbanned') {
          expect(screen.getByText(/unbanned/)).toBeInTheDocument()
        } else {
          expect(screen.getByText(/removed timeout on/)).toBeInTheDocument()
        }
        
        unmount()
      })
    })
  })

  describe('CSS Classes and Styling', () => {
    it('should apply correct CSS classes', () => {
      render(<ModActionMessage {...defaultProps} />)

      const container = document.querySelector('.modActionContainer')
      expect(container).toBeInTheDocument()

      const message = document.querySelector('.modActionMessage')
      expect(message).toBeInTheDocument()
    })

    it('should maintain proper DOM structure', () => {
      render(<ModActionMessage {...defaultProps} />)

      const container = document.querySelector('.modActionContainer')
      const message = container.querySelector('.modActionMessage')
      
      expect(message).toBeInTheDocument()
      expect(container.children).toHaveLength(1)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing modActionDetails', () => {
      const messageWithoutDetails = {
        modAction: 'banned',
        modActionDetails: null
      }

      expect(() => {
        render(<ModActionMessage {...defaultProps} message={messageWithoutDetails} />)
      }).not.toThrow()
    })

    it('should handle missing user information', () => {
      const messageWithoutUser = {
        ...mockMessage,
        modActionDetails: {
          ...mockMessage.modActionDetails,
          user: null
        }
      }

      expect(() => {
        render(<ModActionMessage {...defaultProps} message={messageWithoutUser} />)
      }).not.toThrow()
    })

    it('should handle missing banned_by information', () => {
      const messageWithoutBannedBy = {
        ...mockMessage,
        modActionDetails: {
          ...mockMessage.modActionDetails,
          banned_by: null
        }
      }

      expect(() => {
        render(<ModActionMessage {...defaultProps} message={messageWithoutBannedBy} />)
      }).not.toThrow()
    })

    it('should handle missing unbanned_by information for unban actions', () => {
      const messageWithoutUnbannedBy = {
        modAction: 'unbanned',
        modActionDetails: {
          unbanned_by: null,
          user: {
            username: 'targetuser'
          }
        }
      }

      expect(() => {
        render(<ModActionMessage {...defaultProps} message={messageWithoutUnbannedBy} />)
      }).not.toThrow()
    })

    it('should handle undefined message prop', () => {
      expect(() => {
        render(<ModActionMessage {...defaultProps} message={{}} />)
      }).not.toThrow()
    })

    it('should handle missing chatroomName', () => {
      expect(() => {
        render(<ModActionMessage {...defaultProps} chatroomName={null} />)
      }).not.toThrow()
    })
  })

  describe('Button Interaction', () => {
    it('should render username buttons as clickable elements', () => {
      render(<ModActionMessage {...defaultProps} />)

      const moderatorButton = screen.getByText('moderatoruser')
      const targetButton = screen.getByText('banneduser')

      expect(moderatorButton.tagName).toBe('BUTTON')
      expect(targetButton.tagName).toBe('BUTTON')
    })

    it('should handle rapid clicks without issues', async () => {
      const user = userEvent.setup()

      render(<ModActionMessage {...defaultProps} />)

      const moderatorButton = screen.getByText('moderatoruser')
      
      // Rapid clicks
      await user.click(moderatorButton)
      await user.click(moderatorButton)
      await user.click(moderatorButton)

      // Should handle multiple calls gracefully
      expect(mockWindowApp.kick.getUserChatroomInfo).toHaveBeenCalledTimes(3)
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()

      render(<ModActionMessage {...defaultProps} />)

      const moderatorButton = screen.getByText('moderatoruser')
      moderatorButton.focus()
      
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockWindowApp.kick.getUserChatroomInfo).toHaveBeenCalled()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper button roles', () => {
      render(<ModActionMessage {...defaultProps} />)

      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(2) // Moderator and target user buttons
      
      buttons.forEach(button => {
        expect(button).toBeInTheDocument()
      })
    })

    it('should be accessible to screen readers', () => {
      render(<ModActionMessage {...defaultProps} />)

      const container = document.querySelector('.modActionMessage')
      expect(container).not.toHaveAttribute('aria-hidden')
    })

    it('should maintain semantic structure', () => {
      render(<ModActionMessage {...defaultProps} />)

      const message = document.querySelector('.modActionMessage')
      expect(message).toBeInTheDocument()
      
      // Should contain readable text
      expect(message).toHaveTextContent('moderatoruser permanently banned banneduser')
    })
  })

  describe('Performance', () => {
    it('should handle multiple instances efficiently', () => {
      const messages = Array.from({ length: 10 }, (_, i) => ({
        modAction: 'banned',
        modActionDetails: {
          banned_by: { username: `mod${i}` },
          user: { username: `user${i}` }
        }
      }))

      render(
        <div>
          {messages.map((message, i) => (
            <ModActionMessage
              key={i}
              {...defaultProps}
              message={message}
            />
          ))}
        </div>
      )

      messages.forEach((_, i) => {
        expect(screen.getByText(`mod${i}`)).toBeInTheDocument()
        expect(screen.getByText(`user${i}`)).toBeInTheDocument()
      })
    })

    it('should handle rapid prop updates', () => {
      const { rerender } = render(<ModActionMessage {...defaultProps} />)

      for (let i = 0; i < 100; i++) {
        const newMessage = {
          ...mockMessage,
          modActionDetails: {
            ...mockMessage.modActionDetails,
            banned_by: { username: `moderator${i}` },
            user: { username: `user${i}` }
          }
        }

        rerender(<ModActionMessage {...defaultProps} message={newMessage} />)
      }

      expect(screen.getByText('moderator99')).toBeInTheDocument()
      expect(screen.getByText('user99')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long usernames', () => {
      const longUsernameMessage = {
        ...mockMessage,
        modActionDetails: {
          banned_by: {
            username: 'a'.repeat(100)
          },
          user: {
            username: 'b'.repeat(100)
          }
        }
      }

      render(<ModActionMessage {...defaultProps} message={longUsernameMessage} />)

      expect(screen.getByText('a'.repeat(100))).toBeInTheDocument()
      expect(screen.getByText('b'.repeat(100))).toBeInTheDocument()
    })

    it('should handle special characters in usernames', () => {
      const specialUsernameMessage = {
        ...mockMessage,
        modActionDetails: {
          banned_by: {
            username: 'mod_user-123'
          },
          user: {
            username: 'target.user_456'
          }
        }
      }

      render(<ModActionMessage {...defaultProps} message={specialUsernameMessage} />)

      expect(screen.getByText('mod_user-123')).toBeInTheDocument()
      expect(screen.getByText('target.user_456')).toBeInTheDocument()
    })

    it('should handle zero duration timeout', () => {
      const zeroDurationMessage = {
        ...mockMessage,
        modAction: 'ban_temporary',
        modActionDetails: {
          ...mockMessage.modActionDetails,
          duration: 0
        }
      }

      render(<ModActionMessage {...defaultProps} message={zeroDurationMessage} />)

      expect(screen.getByText(/for 0 minutes/)).toBeInTheDocument()
    })

    it('should handle negative duration values', () => {
      const negativeDurationMessage = {
        ...mockMessage,
        modAction: 'ban_temporary',
        modActionDetails: {
          ...mockMessage.modActionDetails,
          duration: -5
        }
      }

      render(<ModActionMessage {...defaultProps} message={negativeDurationMessage} />)

      expect(screen.getByText(/for -5 minutes/)).toBeInTheDocument()
    })

    it('should handle unknown mod action types', () => {
      const unknownActionMessage = {
        modAction: 'unknown_action',
        modActionDetails: {
          banned_by: {
            username: 'moderatoruser'
          },
          user: {
            username: 'targetuser'
          }
        }
      }

      render(<ModActionMessage {...defaultProps} message={unknownActionMessage} />)

      // Should render unban branch for unknown actions
      expect(screen.getByText('moderatoruser')).toBeInTheDocument()
      expect(screen.getByText('targetuser')).toBeInTheDocument()
    })
  })
})