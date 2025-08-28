import { describe, it, expect, beforeEach } from 'vitest'
import { userKickTalkBadges } from './kickTalkBadges.js'

describe('KickTalk Badges', () => {
  describe('Data Structure Validation', () => {
    it('should be an array', () => {
      expect(Array.isArray(userKickTalkBadges)).toBe(true)
    })

    it('should contain user badge objects', () => {
      expect(userKickTalkBadges.length).toBeGreaterThan(0)
      
      userKickTalkBadges.forEach((user, index) => {
        expect(user).toBeTypeOf('object')
        expect(user).not.toBeNull()
        
        // Each user should have username and badges properties
        expect(user).toHaveProperty('username')
        expect(user).toHaveProperty('badges')
        
        expect(typeof user.username).toBe('string')
        expect(Array.isArray(user.badges)).toBe(true)
        
        // Username should not be empty
        expect(user.username.length).toBeGreaterThan(0)
        
        // Should have at least one badge
        expect(user.badges.length).toBeGreaterThan(0)
      })
    })

    it('should have valid badge objects', () => {
      userKickTalkBadges.forEach(user => {
        user.badges.forEach((badge, badgeIndex) => {
          expect(badge).toBeTypeOf('object')
          expect(badge).not.toBeNull()
          
          // Each badge should have type and title
          expect(badge).toHaveProperty('type')
          expect(badge).toHaveProperty('title')
          
          expect(typeof badge.type).toBe('string')
          expect(typeof badge.title).toBe('string')
          
          // Type and title should not be empty
          expect(badge.type.length).toBeGreaterThan(0)
          expect(badge.title.length).toBeGreaterThan(0)
        })
      })
    })

    it('should not have duplicate usernames', () => {
      const usernames = userKickTalkBadges.map(user => user.username)
      const uniqueUsernames = new Set(usernames)
      
      expect(usernames.length).toBe(uniqueUsernames.size)
    })

    it('should have consistent username formatting', () => {
      userKickTalkBadges.forEach(user => {
        // Usernames should be lowercase and contain only valid characters
        expect(user.username).toMatch(/^[a-z0-9_]+$/)
        expect(user.username).toBe(user.username.toLowerCase())
      })
    })
  })

  describe('Badge Types and Validation', () => {
    it('should contain expected badge types', () => {
      const allBadgeTypes = userKickTalkBadges
        .flatMap(user => user.badges)
        .map(badge => badge.type)
      
      const uniqueBadgeTypes = new Set(allBadgeTypes)
      
      // Should contain at least these known types
      const expectedTypes = ['Founder', 'BetaTester', 'd9']
      expectedTypes.forEach(expectedType => {
        expect(uniqueBadgeTypes.has(expectedType)).toBe(true)
      })
    })

    it('should have consistent badge type-title mapping', () => {
      const badgeTypeToTitle = new Map()
      
      userKickTalkBadges.forEach(user => {
        user.badges.forEach(badge => {
          const { type, title } = badge
          
          if (badgeTypeToTitle.has(type)) {
            // Same type should always have same title
            expect(badgeTypeToTitle.get(type)).toBe(title)
          } else {
            badgeTypeToTitle.set(type, title)
          }
        })
      })
      
      // Verify expected mappings
      expect(badgeTypeToTitle.get('Founder')).toBe('Founder')
      expect(badgeTypeToTitle.get('BetaTester')).toBe('Beta Tester')
      expect(badgeTypeToTitle.get('d9')).toBe('d9')
    })

    it('should have proper title formatting', () => {
      userKickTalkBadges.forEach(user => {
        user.badges.forEach(badge => {
          // Title should start with capital letter
          expect(badge.title).toMatch(/^[A-Z]/)
          
          // Title should not have leading/trailing whitespace
          expect(badge.title).toBe(badge.title.trim())
        })
      })
    })
  })

  describe('Specific User Validation', () => {
    it('should contain founders', () => {
      const founders = userKickTalkBadges.filter(user => 
        user.badges.some(badge => badge.type === 'Founder')
      )
      
      expect(founders.length).toBeGreaterThan(0)
      
      // Check known founders
      const founderUsernames = founders.map(f => f.username)
      expect(founderUsernames).toContain('ftk789')
      expect(founderUsernames).toContain('drkness_x')
    })

    it('should contain beta testers', () => {
      const betaTesters = userKickTalkBadges.filter(user => 
        user.badges.some(badge => badge.type === 'BetaTester')
      )
      
      expect(betaTesters.length).toBeGreaterThan(0)
      
      // Check some known beta testers
      const betaTesterUsernames = betaTesters.map(bt => bt.username)
      expect(betaTesterUsernames).toContain('forgettrance')
      expect(betaTesterUsernames).toContain('physikz')
      expect(betaTesterUsernames).toContain('receipts')
    })

    it('should handle users with multiple badges', () => {
      const usersWithMultipleBadges = userKickTalkBadges.filter(user => 
        user.badges.length > 1
      )
      
      expect(usersWithMultipleBadges.length).toBeGreaterThan(0)
      
      // dn9n should have multiple badges
      const dn9nUser = userKickTalkBadges.find(user => user.username === 'dn9n')
      expect(dn9nUser).toBeDefined()
      expect(dn9nUser.badges.length).toBeGreaterThan(1)
      
      const dn9nBadgeTypes = dn9nUser.badges.map(b => b.type)
      expect(dn9nBadgeTypes).toContain('BetaTester')
      expect(dn9nBadgeTypes).toContain('d9')
    })

    it('should validate specific user configurations', () => {
      const testCases = [
        {
          username: 'ftk789',
          expectedBadges: [{ type: 'Founder', title: 'Founder' }]
        },
        {
          username: 'drkness_x',
          expectedBadges: [{ type: 'Founder', title: 'Founder' }]
        },
        {
          username: 'forgettrance',
          expectedBadges: [{ type: 'BetaTester', title: 'Beta Tester' }]
        },
        {
          username: 'dn9n',
          expectedBadges: [
            { type: 'BetaTester', title: 'Beta Tester' },
            { type: 'd9', title: 'd9' }
          ]
        }
      ]

      testCases.forEach(testCase => {
        const user = userKickTalkBadges.find(u => u.username === testCase.username)
        expect(user).toBeDefined()
        expect(user.badges).toEqual(testCase.expectedBadges)
      })
    })
  })

  describe('Data Integrity', () => {
    it('should not contain null or undefined values', () => {
      userKickTalkBadges.forEach((user, userIndex) => {
        expect(user).not.toBeNull()
        expect(user).not.toBeUndefined()
        expect(user.username).not.toBeNull()
        expect(user.username).not.toBeUndefined()
        expect(user.badges).not.toBeNull()
        expect(user.badges).not.toBeUndefined()
        
        user.badges.forEach((badge, badgeIndex) => {
          expect(badge).not.toBeNull()
          expect(badge).not.toBeUndefined()
          expect(badge.type).not.toBeNull()
          expect(badge.type).not.toBeUndefined()
          expect(badge.title).not.toBeNull()
          expect(badge.title).not.toBeUndefined()
        })
      })
    })

    it('should have valid string lengths', () => {
      userKickTalkBadges.forEach(user => {
        expect(user.username.length).toBeGreaterThan(0)
        expect(user.username.length).toBeLessThan(50) // Reasonable username length
        
        user.badges.forEach(badge => {
          expect(badge.type.length).toBeGreaterThan(0)
          expect(badge.type.length).toBeLessThan(30) // Reasonable badge type length
          expect(badge.title.length).toBeGreaterThan(0)
          expect(badge.title.length).toBeLessThan(50) // Reasonable badge title length
        })
      })
    })

    it('should not contain empty badge arrays', () => {
      userKickTalkBadges.forEach(user => {
        expect(user.badges.length).toBeGreaterThan(0)
      })
    })

    it('should have proper object structure without extra properties', () => {
      userKickTalkBadges.forEach(user => {
        const userKeys = Object.keys(user).sort()
        expect(userKeys).toEqual(['badges', 'username'])
        
        user.badges.forEach(badge => {
          const badgeKeys = Object.keys(badge).sort()
          expect(badgeKeys).toEqual(['title', 'type'])
        })
      })
    })
  })

  describe('Badge Lookup Functions', () => {
    it('should allow lookup by username', () => {
      const getUserBadges = (username) => {
        const user = userKickTalkBadges.find(u => u.username === username)
        return user ? user.badges : []
      }

      // Test existing users
      expect(getUserBadges('ftk789')).toHaveLength(1)
      expect(getUserBadges('dn9n')).toHaveLength(2)
      expect(getUserBadges('nonexistent')).toHaveLength(0)
    })

    it('should allow checking if user has specific badge type', () => {
      const userHasBadgeType = (username, badgeType) => {
        const user = userKickTalkBadges.find(u => u.username === username)
        return user ? user.badges.some(b => b.type === badgeType) : false
      }

      expect(userHasBadgeType('ftk789', 'Founder')).toBe(true)
      expect(userHasBadgeType('ftk789', 'BetaTester')).toBe(false)
      expect(userHasBadgeType('forgettrance', 'BetaTester')).toBe(true)
      expect(userHasBadgeType('dn9n', 'd9')).toBe(true)
      expect(userHasBadgeType('nonexistent', 'Founder')).toBe(false)
    })

    it('should allow getting all users with specific badge type', () => {
      const getUsersWithBadgeType = (badgeType) => {
        return userKickTalkBadges.filter(user => 
          user.badges.some(badge => badge.type === badgeType)
        ).map(user => user.username)
      }

      const founders = getUsersWithBadgeType('Founder')
      expect(founders).toContain('ftk789')
      expect(founders).toContain('drkness_x')
      
      const betaTesters = getUsersWithBadgeType('BetaTester')
      expect(betaTesters.length).toBeGreaterThan(10)
      expect(betaTesters).toContain('forgettrance')
      expect(betaTesters).toContain('dn9n')
      
      const d9Users = getUsersWithBadgeType('d9')
      expect(d9Users).toContain('dn9n')
    })
  })

  describe('Statistics and Metrics', () => {
    it('should have reasonable badge distribution', () => {
      const badgeStats = {}
      
      userKickTalkBadges.forEach(user => {
        user.badges.forEach(badge => {
          badgeStats[badge.type] = (badgeStats[badge.type] || 0) + 1
        })
      })

      // Beta testers should be the majority
      expect(badgeStats.BetaTester).toBeGreaterThan(badgeStats.Founder)
      
      // Should have at least 2 founders
      expect(badgeStats.Founder).toBeGreaterThanOrEqual(2)
      
      // d9 should be rare
      expect(badgeStats.d9).toBeLessThan(badgeStats.BetaTester)
    })

    it('should have expected total user count', () => {
      // Should have reasonable number of special users
      expect(userKickTalkBadges.length).toBeGreaterThan(10)
      expect(userKickTalkBadges.length).toBeLessThan(100)
    })

    it('should calculate badge metrics correctly', () => {
      const totalUsers = userKickTalkBadges.length
      const totalBadges = userKickTalkBadges.reduce((sum, user) => sum + user.badges.length, 0)
      const averageBadgesPerUser = totalBadges / totalUsers
      
      expect(totalBadges).toBeGreaterThan(totalUsers) // Some users have multiple badges
      expect(averageBadgesPerUser).toBeGreaterThan(1)
      expect(averageBadgesPerUser).toBeLessThan(3) // Most users have 1-2 badges
    })
  })

  describe('Data Validation Edge Cases', () => {
    it('should handle case-sensitive username lookups', () => {
      const foundLowercase = userKickTalkBadges.find(u => u.username === 'ftk789')
      const foundUppercase = userKickTalkBadges.find(u => u.username === 'FTK789')
      
      expect(foundLowercase).toBeDefined()
      expect(foundUppercase).toBeUndefined()
    })

    it('should maintain data immutability', () => {
      const originalLength = userKickTalkBadges.length
      const originalFirstUser = JSON.parse(JSON.stringify(userKickTalkBadges[0]))
      
      // Attempt modifications (these might not work due to const, but testing)
      expect(() => {
        userKickTalkBadges.push({ username: 'test', badges: [] })
      }).toThrow()
      
      // Original data should be unchanged
      expect(userKickTalkBadges.length).toBe(originalLength)
      expect(userKickTalkBadges[0]).toEqual(originalFirstUser)
    })

    it('should handle array methods safely', () => {
      // These methods should work without modifying original
      const usernames = userKickTalkBadges.map(u => u.username)
      const betaTesters = userKickTalkBadges.filter(u => 
        u.badges.some(b => b.type === 'BetaTester')
      )
      
      expect(usernames.length).toBe(userKickTalkBadges.length)
      expect(betaTesters.length).toBeGreaterThan(0)
      expect(betaTesters.length).toBeLessThanOrEqual(userKickTalkBadges.length)
    })

    it('should handle malformed data gracefully', () => {
      // Test with defensive programming approach
      const findUserSafely = (username) => {
        try {
          return userKickTalkBadges.find(user => 
            user && typeof user.username === 'string' && user.username === username
          )
        } catch (error) {
          return null
        }
      }

      const getBadgesSafely = (user) => {
        try {
          return Array.isArray(user?.badges) ? user.badges : []
        } catch (error) {
          return []
        }
      }

      expect(findUserSafely('ftk789')).toBeDefined()
      expect(findUserSafely(null)).toBeUndefined()
      expect(getBadgesSafely(null)).toEqual([])
    })
  })

  describe('Performance Characteristics', () => {
    it('should handle lookups efficiently', () => {
      const startTime = performance.now()
      
      // Perform multiple lookups
      for (let i = 0; i < 1000; i++) {
        const randomUser = userKickTalkBadges[i % userKickTalkBadges.length]
        const foundUser = userKickTalkBadges.find(u => u.username === randomUser.username)
        expect(foundUser).toBeDefined()
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      expect(duration).toBeLessThan(100) // Should complete in under 100ms
    })

    it('should handle array operations efficiently', () => {
      const startTime = performance.now()
      
      // Perform multiple array operations
      const operations = [
        () => userKickTalkBadges.map(u => u.username),
        () => userKickTalkBadges.filter(u => u.badges.length > 1),
        () => userKickTalkBadges.reduce((acc, u) => acc + u.badges.length, 0),
        () => userKickTalkBadges.some(u => u.badges.some(b => b.type === 'Founder')),
        () => userKickTalkBadges.every(u => u.badges.length > 0)
      ]

      operations.forEach(operation => {
        operation()
      })
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      expect(duration).toBeLessThan(50) // Should complete efficiently
    })
  })

  describe('Integration and Usage Patterns', () => {
    it('should support common badge checking patterns', () => {
      // Pattern 1: Check if user is founder
      const isFounder = (username) => {
        const user = userKickTalkBadges.find(u => u.username === username)
        return user?.badges.some(b => b.type === 'Founder') ?? false
      }

      expect(isFounder('ftk789')).toBe(true)
      expect(isFounder('forgettrance')).toBe(false)

      // Pattern 2: Get all badge titles for display
      const getUserBadgeTitles = (username) => {
        const user = userKickTalkBadges.find(u => u.username === username)
        return user?.badges.map(b => b.title) ?? []
      }

      expect(getUserBadgeTitles('dn9n')).toEqual(['Beta Tester', 'd9'])
      expect(getUserBadgeTitles('nonexistent')).toEqual([])

      // Pattern 3: Check multiple badge types
      const hasAnyBadge = (username, badgeTypes) => {
        const user = userKickTalkBadges.find(u => u.username === username)
        return user?.badges.some(b => badgeTypes.includes(b.type)) ?? false
      }

      expect(hasAnyBadge('dn9n', ['Founder', 'd9'])).toBe(true)
      expect(hasAnyBadge('ftk789', ['BetaTester', 'd9'])).toBe(false)
    })

    it('should support badge prioritization', () => {
      const getBadgePriority = (badgeType) => {
        const priorities = {
          'Founder': 1,
          'd9': 2,
          'BetaTester': 3
        }
        return priorities[badgeType] || 999
      }

      const getHighestPriorityBadge = (username) => {
        const user = userKickTalkBadges.find(u => u.username === username)
        if (!user || !user.badges.length) return null
        
        return user.badges
          .sort((a, b) => getBadgePriority(a.type) - getBadgePriority(b.type))[0]
      }

      // dn9n has both BetaTester and d9, should prioritize d9
      const dn9nTopBadge = getHighestPriorityBadge('dn9n')
      expect(dn9nTopBadge.type).toBe('d9')

      // ftk789 has only Founder
      const ftk789TopBadge = getHighestPriorityBadge('ftk789')
      expect(ftk789TopBadge.type).toBe('Founder')
    })

    it('should support badge filtering and grouping', () => {
      // Group users by their highest priority badge
      const groupByHighestBadge = () => {
        const groups = {}
        
        userKickTalkBadges.forEach(user => {
          const highestBadge = user.badges
            .sort((a, b) => {
              const priorities = { 'Founder': 1, 'd9': 2, 'BetaTester': 3 }
              return (priorities[a.type] || 999) - (priorities[b.type] || 999)
            })[0]
          
          const groupKey = highestBadge.type
          if (!groups[groupKey]) groups[groupKey] = []
          groups[groupKey].push(user.username)
        })
        
        return groups
      }

      const groups = groupByHighestBadge()
      
      expect(groups.Founder).toContain('ftk789')
      expect(groups.Founder).toContain('drkness_x')
      expect(groups.d9).toContain('dn9n')
      expect(groups.BetaTester.length).toBeGreaterThan(10)
    })
  })

  describe('Data Export and Serialization', () => {
    it('should serialize to JSON correctly', () => {
      const jsonString = JSON.stringify(userKickTalkBadges)
      const parsedData = JSON.parse(jsonString)
      
      expect(parsedData).toEqual(userKickTalkBadges)
      expect(Array.isArray(parsedData)).toBe(true)
      expect(parsedData.length).toBe(userKickTalkBadges.length)
    })

    it('should handle deep cloning correctly', () => {
      const clonedData = JSON.parse(JSON.stringify(userKickTalkBadges))
      
      // Modify clone
      clonedData[0].username = 'modified'
      clonedData[0].badges.push({ type: 'New', title: 'New Badge' })
      
      // Original should be unchanged
      expect(userKickTalkBadges[0].username).not.toBe('modified')
      expect(userKickTalkBadges[0].badges).not.toContainEqual({ type: 'New', title: 'New Badge' })
    })

    it('should support data transformation for different use cases', () => {
      // Transform to username -> badge types mapping
      const usernameToTypes = userKickTalkBadges.reduce((acc, user) => {
        acc[user.username] = user.badges.map(b => b.type)
        return acc
      }, {})

      expect(usernameToTypes.ftk789).toEqual(['Founder'])
      expect(usernameToTypes.dn9n).toEqual(['BetaTester', 'd9'])

      // Transform to badge type -> count mapping
      const typeToCount = userKickTalkBadges
        .flatMap(user => user.badges)
        .reduce((acc, badge) => {
          acc[badge.type] = (acc[badge.type] || 0) + 1
          return acc
        }, {})

      expect(typeToCount.BetaTester).toBeGreaterThan(10)
      expect(typeToCount.Founder).toBeGreaterThanOrEqual(2)
      expect(typeToCount.d9).toBe(1)
    })
  })
})