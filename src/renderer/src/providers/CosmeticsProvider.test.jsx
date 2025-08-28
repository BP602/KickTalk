import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import useCosmeticsStore from './CosmeticsProvider.jsx'

describe('CosmeticsProvider (Zustand Store)', () => {
  let store

  beforeEach(() => {
    vi.useRealTimers()
    // Get a fresh store instance
    store = useCosmeticsStore.getState()
    
    // Reset store to initial state
    useCosmeticsStore.setState({
      userStyles: {},
      globalCosmetics: {
        badges: [],
        paints: [],
      },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    // Clean up store state
    useCosmeticsStore.setState({
      userStyles: {},
      globalCosmetics: {
        badges: [],
        paints: [],
      },
    })
  })

  describe('Initial State', () => {
    it('should initialize with empty userStyles and globalCosmetics', () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      expect(result.current.userStyles).toEqual({})
      expect(result.current.globalCosmetics).toEqual({
        badges: [],
        paints: [],
      })
    })

    it('should have all required store methods available', () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      expect(typeof result.current.addUserStyle).toBe('function')
      expect(typeof result.current.getUserStyle).toBe('function')
      expect(typeof result.current.addCosmetics).toBe('function')
      expect(typeof result.current.getUserBadge).toBe('function')
      expect(typeof result.current.getUserPaint).toBe('function')
    })
  })

  describe('addUserStyle', () => {
    const mockUserStyleData = {
      object: {
        user: {
          id: 'user123',
          username: 'TestUser',
          style: {
            badge_id: 'badge123',
            paint_id: 'paint456',
            color: '#ff0000'
          },
          connections: [
            { type: 'KICK', platform_id: 'kick123' }
          ]
        }
      }
    }

    it('should add user style with valid data', async () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      await act(async () => {
        await result.current.addUserStyle('TestUser', mockUserStyleData)
      })

      const userStyles = result.current.userStyles
      expect(userStyles).toHaveProperty('testuser')
      expect(userStyles.testuser).toEqual({
        badgeId: 'badge123',
        paintId: 'paint456',
        color: '#ff0000',
        kickConnection: { type: 'KICK', platform_id: 'kick123' },
        entitlement: mockUserStyleData,
        userId: 'user123',
        username: 'TestUser',
        updatedAt: expect.any(String)
      })
    })

    it('should normalize username to lowercase', async () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      await act(async () => {
        await result.current.addUserStyle('TestUser123', mockUserStyleData)
      })

      expect(result.current.userStyles).toHaveProperty('testuser123')
      expect(result.current.userStyles).not.toHaveProperty('TestUser123')
    })

    it('should skip adding style when body is missing required data', async () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      await act(async () => {
        await result.current.addUserStyle('TestUser', null)
      })

      expect(result.current.userStyles).toEqual({})
    })

    it('should skip adding style when user style object is missing', async () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      await act(async () => {
        await result.current.addUserStyle('TestUser', { object: {} })
      })

      expect(result.current.userStyles).toEqual({})
    })

    it('should not update if badge and paint IDs are the same', async () => {
      const { result } = renderHook(() => useCosmeticsStore())
      const initialTimestamp = '2023-01-01T00:00:00.000Z'
      
      // Add initial style
      await act(async () => {
        vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(initialTimestamp)
        await result.current.addUserStyle('TestUser', mockUserStyleData)
        vi.restoreAllMocks()
      })

      const laterTimestamp = '2023-01-02T00:00:00.000Z'
      
      // Try to add same style again
      await act(async () => {
        vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(laterTimestamp)
        await result.current.addUserStyle('TestUser', mockUserStyleData)
        vi.restoreAllMocks()
      })

      // Should still have the initial timestamp (unchanged)
      expect(result.current.userStyles.testuser.updatedAt).toBe(initialTimestamp)
    })

    it('should update when badge or paint ID changes', async () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      // Add initial style
      await act(async () => {
        await result.current.addUserStyle('TestUser', mockUserStyleData)
      })

      const updatedData = {
        ...mockUserStyleData,
        object: {
          ...mockUserStyleData.object,
          user: {
            ...mockUserStyleData.object.user,
            style: {
              ...mockUserStyleData.object.user.style,
              badge_id: 'newbadge123'
            }
          }
        }
      }

      await act(async () => {
        await result.current.addUserStyle('TestUser', updatedData)
      })

      expect(result.current.userStyles.testuser.badgeId).toBe('newbadge123')
    })

    it('should handle missing connections gracefully', async () => {
      const dataWithoutConnections = {
        object: {
          user: {
            id: 'user123',
            username: 'TestUser',
            style: {
              badge_id: 'badge123',
              paint_id: 'paint456',
              color: '#ff0000'
            }
          }
        }
      }

      const { result } = renderHook(() => useCosmeticsStore())
      
      await act(async () => {
        await result.current.addUserStyle('TestUser', dataWithoutConnections)
      })

      expect(result.current.userStyles.testuser.kickConnection).toBeUndefined()
    })
  })

  describe('getUserStyle', () => {
    const mockGlobalCosmetics = {
      badges: [
        { id: 'badge123', name: 'Test Badge', url: 'badge.png' },
        { id: 'badge456', name: 'Another Badge', url: 'badge2.png' }
      ],
      paints: [
        { id: 'paint123', name: 'Test Paint', color: '#ff0000' },
        { id: 'paint456', name: 'Another Paint', color: '#00ff00' }
      ]
    }

    beforeEach(async () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      // Add global cosmetics
      act(() => {
        result.current.addCosmetics(mockGlobalCosmetics)
      })

      // Add user style
      await act(async () => {
        await result.current.addUserStyle('TestUser', {
          object: {
            user: {
              id: 'user123',
              username: 'TestUser',
              style: {
                badge_id: 'badge123',
                paint_id: 'paint456',
                color: '#ff0000'
              },
              connections: [{ type: 'KICK', platform_id: 'kick123' }]
            }
          }
        })
      })
    })

    it('should return user style with badge and paint', () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      const userStyle = result.current.getUserStyle('TestUser')
      
      expect(userStyle).toEqual({
        badge: { id: 'badge123', name: 'Test Badge', url: 'badge.png' },
        paint: { id: 'paint456', name: 'Another Paint', color: '#00ff00' },
        color: '#ff0000',
        username: 'TestUser'
      })
    })

    it('should normalize username to lowercase when getting style', () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      const userStyle1 = result.current.getUserStyle('TestUser')
      const userStyle2 = result.current.getUserStyle('testuser')
      const userStyle3 = result.current.getUserStyle('TESTUSER')
      
      expect(userStyle1).toEqual(userStyle2)
      expect(userStyle2).toEqual(userStyle3)
    })

    it('should return null for non-existent user', () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      const userStyle = result.current.getUserStyle('NonExistentUser')
      
      expect(userStyle).toBeNull()
    })

    it('should return null when user has no badge or paint', () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      // Add user without badge or paint
      act(() => {
        useCosmeticsStore.setState({
          userStyles: {
            noscale: {
              badgeId: null,
              paintId: null,
              color: '#ff0000',
              username: 'NoScale'
            }
          }
        })
      })

      const userStyle = result.current.getUserStyle('NoScale')
      
      expect(userStyle).toBeNull()
    })

    it('should handle missing badge gracefully', () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      // Add user with non-existent badge ID
      act(() => {
        useCosmeticsStore.setState({
          userStyles: {
            testuser2: {
              badgeId: 'nonexistent',
              paintId: 'paint456',
              color: '#ff0000',
              username: 'TestUser2'
            }
          }
        })
      })

      const userStyle = result.current.getUserStyle('TestUser2')
      
      expect(userStyle).toEqual({
        badge: undefined,
        paint: { id: 'paint456', name: 'Another Paint', color: '#00ff00' },
        color: '#ff0000',
        username: 'TestUser2'
      })
    })

    it('should handle missing paint gracefully', () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      // Add user with non-existent paint ID
      act(() => {
        useCosmeticsStore.setState({
          userStyles: {
            testuser3: {
              badgeId: 'badge123',
              paintId: 'nonexistent',
              color: '#ff0000',
              username: 'TestUser3'
            }
          }
        })
      })

      const userStyle = result.current.getUserStyle('TestUser3')
      
      expect(userStyle).toEqual({
        badge: { id: 'badge123', name: 'Test Badge', url: 'badge.png' },
        paint: undefined,
        color: '#ff0000',
        username: 'TestUser3'
      })
    })
  })

  describe('addCosmetics', () => {
    const mockCosmetics = {
      badges: [
        { id: 'badge1', name: 'Badge 1', url: 'badge1.png' },
        { id: 'badge2', name: 'Badge 2', url: 'badge2.png' }
      ],
      paints: [
        { id: 'paint1', name: 'Paint 1', color: '#ff0000' },
        { id: 'paint2', name: 'Paint 2', color: '#00ff00' }
      ]
    }

    it('should add cosmetics to global store', () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      act(() => {
        result.current.addCosmetics(mockCosmetics)
      })

      expect(result.current.globalCosmetics).toEqual(mockCosmetics)
    })

    it('should replace existing cosmetics completely', () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      // Add initial cosmetics
      act(() => {
        result.current.addCosmetics(mockCosmetics)
      })

      // Replace with new cosmetics
      const newCosmetics = {
        badges: [{ id: 'badge3', name: 'Badge 3', url: 'badge3.png' }],
        paints: []
      }
      
      act(() => {
        result.current.addCosmetics(newCosmetics)
      })

      expect(result.current.globalCosmetics).toEqual(newCosmetics)
      expect(result.current.globalCosmetics.badges).toHaveLength(1)
      expect(result.current.globalCosmetics.paints).toHaveLength(0)
    })

    it('should handle empty cosmetics object', () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      act(() => {
        result.current.addCosmetics({})
      })

      expect(result.current.globalCosmetics).toEqual({})
    })

    it('should handle partial cosmetics data', () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      const partialCosmetics = {
        badges: [{ id: 'badge1', name: 'Badge 1', url: 'badge1.png' }]
        // paints missing
      }
      
      act(() => {
        result.current.addCosmetics(partialCosmetics)
      })

      expect(result.current.globalCosmetics.badges).toHaveLength(1)
      expect(result.current.globalCosmetics.paints).toBeUndefined()
    })
  })

  describe('getUserBadge', () => {
    beforeEach(() => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      // Setup global cosmetics with badge data
      act(() => {
        result.current.addCosmetics({
          badge123: { id: 'badge123', name: 'Test Badge', url: 'badge.png' },
          badge456: { id: 'badge456', name: 'Another Badge', url: 'badge2.png' }
        })
      })

      // Setup user with badge
      act(() => {
        useCosmeticsStore.setState({
          userStyles: {
            testuser: {
              badgeId: 'badge123',
              paintId: null,
              color: '#ff0000',
              username: 'TestUser'
            }
          }
        })
      })
    })

    it('should return user badge from global cosmetics', () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      const badge = result.current.getUserBadge('TestUser')
      
      expect(badge).toEqual({
        id: 'badge123',
        name: 'Test Badge',
        url: 'badge.png'
      })
    })

    it('should normalize username to lowercase', () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      const badge1 = result.current.getUserBadge('TestUser')
      const badge2 = result.current.getUserBadge('testuser')
      const badge3 = result.current.getUserBadge('TESTUSER')
      
      expect(badge1).toEqual(badge2)
      expect(badge2).toEqual(badge3)
    })

    it('should return null for user without badge', () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      // Add user without badge
      act(() => {
        useCosmeticsStore.setState({
          userStyles: {
            nobadgeuser: {
              badgeId: null,
              paintId: 'paint123',
              color: '#ff0000',
              username: 'NoBadgeUser'
            }
          }
        })
      })

      const badge = result.current.getUserBadge('NoBadgeUser')
      
      expect(badge).toBeNull()
    })

    it('should return null for non-existent user', () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      const badge = result.current.getUserBadge('NonExistentUser')
      
      expect(badge).toBeNull()
    })
  })

  describe('getUserPaint', () => {
    beforeEach(() => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      // Setup global cosmetics with paint data
      act(() => {
        result.current.addCosmetics({
          paint123: { id: 'paint123', name: 'Test Paint', color: '#ff0000' },
          paint456: { id: 'paint456', name: 'Another Paint', color: '#00ff00' }
        })
      })

      // Setup user with paint
      act(() => {
        useCosmeticsStore.setState({
          userStyles: {
            testuser: {
              badgeId: null,
              paintId: 'paint456',
              color: '#ff0000',
              username: 'TestUser'
            }
          }
        })
      })
    })

    it('should return user paint from global cosmetics', () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      const paint = result.current.getUserPaint('TestUser')
      
      expect(paint).toEqual({
        id: 'paint456',
        name: 'Another Paint',
        color: '#00ff00'
      })
    })

    it('should normalize username to lowercase', () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      const paint1 = result.current.getUserPaint('TestUser')
      const paint2 = result.current.getUserPaint('testuser')
      const paint3 = result.current.getUserPaint('TESTUSER')
      
      expect(paint1).toEqual(paint2)
      expect(paint2).toEqual(paint3)
    })

    it('should return null for user without paint', () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      // Add user without paint
      act(() => {
        useCosmeticsStore.setState({
          userStyles: {
            nopaintuser: {
              badgeId: 'badge123',
              paintId: null,
              color: '#ff0000',
              username: 'NoPaintUser'
            }
          }
        })
      })

      const paint = result.current.getUserPaint('NoPaintUser')
      
      expect(paint).toBeNull()
    })

    it('should return null for non-existent user', () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      const paint = result.current.getUserPaint('NonExistentUser')
      
      expect(paint).toBeNull()
    })
  })

  describe('Store Integration Tests', () => {
    it('should handle complete workflow: add cosmetics → add user style → get user style', async () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      // 1. Add global cosmetics
      const mockCosmetics = {
        badges: [{ id: 'badge123', name: 'Test Badge', url: 'badge.png' }],
        paints: [{ id: 'paint456', name: 'Test Paint', color: '#ff0000' }]
      }
      
      act(() => {
        result.current.addCosmetics(mockCosmetics)
      })

      // 2. Add user style
      const mockUserData = {
        object: {
          user: {
            id: 'user123',
            username: 'TestUser',
            style: {
              badge_id: 'badge123',
              paint_id: 'paint456',
              color: '#ffffff'
            },
            connections: [{ type: 'KICK', platform_id: 'kick123' }]
          }
        }
      }

      await act(async () => {
        await result.current.addUserStyle('TestUser', mockUserData)
      })

      // 3. Get user style
      const userStyle = result.current.getUserStyle('TestUser')
      
      expect(userStyle).toEqual({
        badge: { id: 'badge123', name: 'Test Badge', url: 'badge.png' },
        paint: { id: 'paint456', name: 'Test Paint', color: '#ff0000' },
        color: '#ffffff',
        username: 'TestUser'
      })
    })

    it('should handle multiple users with different cosmetics', async () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      // Add global cosmetics
      act(() => {
        result.current.addCosmetics({
          badges: [
            { id: 'badge1', name: 'Badge 1', url: 'badge1.png' },
            { id: 'badge2', name: 'Badge 2', url: 'badge2.png' }
          ],
          paints: [
            { id: 'paint1', name: 'Paint 1', color: '#ff0000' },
            { id: 'paint2', name: 'Paint 2', color: '#00ff00' }
          ]
        })
      })

      // Add first user
      await act(async () => {
        await result.current.addUserStyle('User1', {
          object: {
            user: {
              id: 'user1',
              username: 'User1',
              style: { badge_id: 'badge1', paint_id: 'paint1', color: '#aaa' },
              connections: [{ type: 'KICK' }]
            }
          }
        })
      })

      // Add second user
      await act(async () => {
        await result.current.addUserStyle('User2', {
          object: {
            user: {
              id: 'user2',
              username: 'User2',
              style: { badge_id: 'badge2', paint_id: 'paint2', color: '#bbb' },
              connections: [{ type: 'KICK' }]
            }
          }
        })
      })

      // Verify both users have correct styles
      const user1Style = result.current.getUserStyle('User1')
      const user2Style = result.current.getUserStyle('User2')

      expect(user1Style.badge.id).toBe('badge1')
      expect(user1Style.paint.id).toBe('paint1')
      expect(user1Style.color).toBe('#aaa')

      expect(user2Style.badge.id).toBe('badge2')
      expect(user2Style.paint.id).toBe('paint2')
      expect(user2Style.color).toBe('#bbb')
    })

    it('should persist user styles when cosmetics are updated', async () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      // Add initial cosmetics and user
      act(() => {
        result.current.addCosmetics({
          badges: [{ id: 'badge1', name: 'Badge 1', url: 'badge1.png' }],
          paints: []
        })
      })

      await act(async () => {
        await result.current.addUserStyle('TestUser', {
          object: {
            user: {
              id: 'user1',
              username: 'TestUser',
              style: { badge_id: 'badge1', paint_id: null, color: '#fff' },
              connections: [{ type: 'KICK' }]
            }
          }
        })
      })

      // Update cosmetics
      act(() => {
        result.current.addCosmetics({
          badges: [
            { id: 'badge1', name: 'Updated Badge 1', url: 'updated_badge1.png' },
            { id: 'badge2', name: 'Badge 2', url: 'badge2.png' }
          ],
          paints: [{ id: 'paint1', name: 'Paint 1', color: '#ff0000' }]
        })
      })

      // User style should still exist with updated cosmetic data
      const userStyle = result.current.getUserStyle('TestUser')
      expect(userStyle.badge.name).toBe('Updated Badge 1')
      expect(userStyle.badge.url).toBe('updated_badge1.png')
      expect(userStyle.username).toBe('TestUser')
      expect(result.current.userStyles.testuser).toBeDefined()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle null or undefined cosmetics gracefully', () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      act(() => {
        result.current.addCosmetics(null)
      })

      // When spreading null, it results in an empty object
      expect(result.current.globalCosmetics).toEqual({})
    })

    it('should handle empty userStyles when getting user data', () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      const userStyle = result.current.getUserStyle('NonExistent')
      const userBadge = result.current.getUserBadge('NonExistent')
      const userPaint = result.current.getUserPaint('NonExistent')
      
      expect(userStyle).toBeNull()
      expect(userBadge).toBeNull()
      expect(userPaint).toBeNull()
    })

    it('should handle malformed user style data', async () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      // Test with completely missing style object (should not add anything)
      const malformedDataMissingStyle = {
        object: {
          user: {
            id: 'user1',
            username: 'TestUser'
            // style object is completely missing
          }
        }
      }

      await act(async () => {
        await result.current.addUserStyle('TestUser', malformedDataMissingStyle)
      })

      expect(result.current.userStyles.testuser).toBeUndefined()

      // Test with empty style object (won't add because undefined === undefined condition)
      const malformedDataEmptyStyle = {
        object: {
          user: {
            id: 'user1',
            username: 'TestUser',
            style: {} // Empty but existing style object
          }
        }
      }

      await act(async () => {
        await result.current.addUserStyle('TestUser2', malformedDataEmptyStyle)
      })

      // The empty style won't be added due to the undefined === undefined condition
      expect(result.current.userStyles.testuser2).toBeUndefined()
      
      // Test with partial style data that would bypass the condition
      const partialStyleData = {
        object: {
          user: {
            id: 'user1',
            username: 'TestUser',
            style: {
              badge_id: 'badge1'
              // paint_id is undefined, so this will be different from empty object
            }
          }
        }
      }

      await act(async () => {
        await result.current.addUserStyle('TestUser3', partialStyleData)
      })

      expect(result.current.userStyles.testuser3).toEqual({
        badgeId: 'badge1',
        paintId: undefined,
        color: undefined,
        kickConnection: undefined,
        entitlement: partialStyleData,
        userId: 'user1',
        username: 'TestUser',
        updatedAt: expect.any(String)
      })
    })

    it('should handle special characters in usernames', async () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      const specialUsername = 'Test-User_123.Special'
      
      await act(async () => {
        await result.current.addUserStyle(specialUsername, {
          object: {
            user: {
              id: 'user1',
              username: specialUsername,
              style: { badge_id: 'badge1', paint_id: 'paint1', color: '#fff' },
              connections: [{ type: 'KICK' }]
            }
          }
        })
      })

      const normalizedUsername = specialUsername.toLowerCase()
      expect(result.current.userStyles[normalizedUsername]).toBeDefined()
      expect(result.current.getUserStyle(specialUsername)).toBeDefined()
      expect(result.current.getUserStyle(normalizedUsername)).toBeDefined()
    })

    it('should handle concurrent user style updates', async () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      const userData1 = {
        object: {
          user: {
            id: 'user1',
            username: 'TestUser',
            style: { badge_id: 'badge1', paint_id: 'paint1', color: '#fff' },
            connections: [{ type: 'KICK' }]
          }
        }
      }

      const userData2 = {
        object: {
          user: {
            id: 'user1',
            username: 'TestUser',
            style: { badge_id: 'badge2', paint_id: 'paint2', color: '#000' },
            connections: [{ type: 'KICK' }]
          }
        }
      }

      // Simulate concurrent updates
      await act(async () => {
        await Promise.all([
          result.current.addUserStyle('TestUser', userData1),
          result.current.addUserStyle('TestUser', userData2)
        ])
      })

      // One of the updates should have persisted
      const finalUserStyle = result.current.userStyles.testuser
      expect(finalUserStyle).toBeDefined()
      expect(['badge1', 'badge2']).toContain(finalUserStyle.badgeId)
      expect(['paint1', 'paint2']).toContain(finalUserStyle.paintId)
    })
  })

  describe('Performance and Memory Tests', () => {
    it('should handle large numbers of users efficiently', async () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      const startTime = performance.now()
      
      // Add 1000 users
      const promises = []
      for (let i = 0; i < 1000; i++) {
        promises.push(
          result.current.addUserStyle(`User${i}`, {
            object: {
              user: {
                id: `user${i}`,
                username: `User${i}`,
                style: { badge_id: 'badge1', paint_id: 'paint1', color: '#fff' },
                connections: [{ type: 'KICK' }]
              }
            }
          })
        )
      }
      
      await act(async () => {
        await Promise.all(promises)
      })
      
      const endTime = performance.now()
      
      // Should complete in reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(1000) // 1 second
      expect(Object.keys(result.current.userStyles)).toHaveLength(1000)
    })

    it('should handle large cosmetics datasets', () => {
      const { result } = renderHook(() => useCosmeticsStore())
      
      // Create large cosmetics dataset
      const largeCosmeticsData = {
        badges: Array.from({ length: 1000 }, (_, i) => ({
          id: `badge${i}`,
          name: `Badge ${i}`,
          url: `badge${i}.png`
        })),
        paints: Array.from({ length: 1000 }, (_, i) => ({
          id: `paint${i}`,
          name: `Paint ${i}`,
          color: `#${i.toString(16).padStart(6, '0')}`
        }))
      }
      
      const startTime = performance.now()
      
      act(() => {
        result.current.addCosmetics(largeCosmeticsData)
      })
      
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(100) // 100ms
      expect(result.current.globalCosmetics.badges).toHaveLength(1000)
      expect(result.current.globalCosmetics.paints).toHaveLength(1000)
    })
  })
})