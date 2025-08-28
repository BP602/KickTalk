import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import React, { memo, useState } from 'react'
import useCosmeticsStore from './CosmeticsProvider.jsx'

// Mock consumer component that uses the cosmetics store
const CosmeticsConsumer = memo(({ username, onDataReceived }) => {
  const [userStyle, setUserStyle] = useState(null)
  const [badge, setBadge] = useState(null)
  const [paint, setPaint] = useState(null)

  // Use the store methods
  const getUserStyle = useCosmeticsStore(state => state.getUserStyle)
  const getUserBadge = useCosmeticsStore(state => state.getUserBadge)
  const getUserPaint = useCosmeticsStore(state => state.getUserPaint)
  const globalCosmetics = useCosmeticsStore(state => state.globalCosmetics)

  // Subscribe to store updates
  const [, forceUpdate] = useState({})
  
  // Simulate fetching data when username changes
  React.useEffect(() => {
    if (username) {
      const style = getUserStyle(username)
      const userBadge = getUserBadge(username)
      const userPaint = getUserPaint(username)
      
      setUserStyle(style)
      setBadge(userBadge)
      setPaint(userPaint)
      
      // Pass data back to test for assertions
      onDataReceived?.({
        userStyle: style,
        badge: userBadge,
        paint: userPaint,
        globalCosmetics
      })
    }
  }, [username, getUserStyle, getUserBadge, getUserPaint, globalCosmetics, forceUpdate])

  return (
    <div data-testid="cosmetics-consumer">
      <div data-testid="username">{username || 'No user'}</div>
      <div data-testid="has-style">{userStyle ? 'Has style' : 'No style'}</div>
      <div data-testid="has-badge">{badge ? 'Has badge' : 'No badge'}</div>
      <div data-testid="has-paint">{paint ? 'Has paint' : 'No paint'}</div>
      <div data-testid="global-badges-count">{globalCosmetics?.badges?.length || 0}</div>
      <div data-testid="global-paints-count">{globalCosmetics?.paints?.length || 0}</div>
    </div>
  )
})

// Chat message component that shows cosmetics
const MessageWithCosmetics = memo(({ username, message }) => {
  const getUserStyle = useCosmeticsStore(state => state.getUserStyle)
  const userStyle = getUserStyle(username)

  return (
    <div data-testid="message-with-cosmetics">
      <div 
        data-testid="username-display"
        style={{ color: userStyle?.color || 'inherit' }}
      >
        {userStyle?.badge && (
          <img 
            data-testid="badge-icon" 
            src={userStyle.badge.url} 
            alt={userStyle.badge.name}
            style={{ width: '16px', height: '16px', marginRight: '4px' }}
          />
        )}
        {username}
        {userStyle?.paint && (
          <span data-testid="paint-indicator" style={{ color: userStyle.paint.color }}>
            *
          </span>
        )}
      </div>
      <div data-testid="message-content">{message}</div>
    </div>
  )
})

// Emote picker component
const EmotePicker = memo(() => {
  const globalCosmetics = useCosmeticsStore(state => state.globalCosmetics)
  const [selectedCategory, setSelectedCategory] = useState('badges')

  const currentItems = selectedCategory === 'badges' 
    ? globalCosmetics?.badges || []
    : globalCosmetics?.paints || []

  return (
    <div data-testid="emote-picker">
      <div data-testid="category-selector">
        <button 
          data-testid="badges-tab"
          onClick={() => setSelectedCategory('badges')}
          className={selectedCategory === 'badges' ? 'active' : ''}
        >
          Badges ({globalCosmetics?.badges?.length || 0})
        </button>
        <button 
          data-testid="paints-tab"
          onClick={() => setSelectedCategory('paints')}
          className={selectedCategory === 'paints' ? 'active' : ''}
        >
          Paints ({globalCosmetics?.paints?.length || 0})
        </button>
      </div>
      <div data-testid="items-list">
        {currentItems.map((item, index) => (
          <div key={item.id || index} data-testid={`item-${index}`}>
            {item.name} - {item.url || item.color}
          </div>
        ))}
      </div>
    </div>
  )
})

describe('CosmeticsProvider Integration Tests', () => {
  beforeEach(() => {
    vi.useRealTimers()
    
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

  describe('Basic Consumer Integration', () => {
    it('should provide initial empty state to consumer components', () => {
      let capturedData = null

      render(
        <CosmeticsConsumer 
          username="testuser" 
          onDataReceived={(data) => { capturedData = data }}
        />
      )

      expect(screen.getByTestId('username')).toHaveTextContent('testuser')
      expect(screen.getByTestId('has-style')).toHaveTextContent('No style')
      expect(screen.getByTestId('has-badge')).toHaveTextContent('No badge')
      expect(screen.getByTestId('has-paint')).toHaveTextContent('No paint')
      expect(screen.getByTestId('global-badges-count')).toHaveTextContent('0')
      expect(screen.getByTestId('global-paints-count')).toHaveTextContent('0')

      expect(capturedData).toEqual({
        userStyle: null,
        badge: null,
        paint: null,
        globalCosmetics: { badges: [], paints: [] }
      })
    })

    it('should update consumer when cosmetics are added', async () => {
      let capturedData = null

      render(
        <CosmeticsConsumer 
          username="testuser" 
          onDataReceived={(data) => { capturedData = data }}
        />
      )

      // Add global cosmetics
      const mockCosmetics = {
        badges: [
          { id: 'badge1', name: 'Test Badge', url: 'badge1.png' },
          { id: 'badge2', name: 'Another Badge', url: 'badge2.png' }
        ],
        paints: [
          { id: 'paint1', name: 'Test Paint', color: '#ff0000' }
        ]
      }

      act(() => {
        useCosmeticsStore.getState().addCosmetics(mockCosmetics)
      })

      await waitFor(() => {
        expect(screen.getByTestId('global-badges-count')).toHaveTextContent('2')
        expect(screen.getByTestId('global-paints-count')).toHaveTextContent('1')
      })
    })

    it('should update consumer when user style is added', async () => {
      let capturedData = null

      // First add global cosmetics
      const mockCosmetics = {
        badges: [{ id: 'badge1', name: 'Test Badge', url: 'badge1.png' }],
        paints: [{ id: 'paint1', name: 'Test Paint', color: '#ff0000' }]
      }

      act(() => {
        useCosmeticsStore.getState().addCosmetics(mockCosmetics)
      })

      render(
        <CosmeticsConsumer 
          username="testuser" 
          onDataReceived={(data) => { capturedData = data }}
        />
      )

      // Add user style
      const mockUserData = {
        object: {
          user: {
            id: 'user123',
            username: 'testuser',
            style: {
              badge_id: 'badge1',
              paint_id: 'paint1',
              color: '#ffffff'
            },
            connections: [{ type: 'KICK', platform_id: 'kick123' }]
          }
        }
      }

      await act(async () => {
        await useCosmeticsStore.getState().addUserStyle('testuser', mockUserData)
      })

      await waitFor(() => {
        expect(screen.getByTestId('has-style')).toHaveTextContent('Has style')
      })

      expect(capturedData?.userStyle).toEqual({
        badge: { id: 'badge1', name: 'Test Badge', url: 'badge1.png' },
        paint: { id: 'paint1', name: 'Test Paint', color: '#ff0000' },
        color: '#ffffff',
        username: 'testuser'
      })
    })
  })

  describe('Message Component Integration', () => {
    it('should display message without cosmetics for users without styles', () => {
      render(<MessageWithCosmetics username="plainuser" message="Hello world!" />)

      expect(screen.getByTestId('username-display')).toHaveTextContent('plainuser')
      expect(screen.getByTestId('message-content')).toHaveTextContent('Hello world!')
      expect(screen.queryByTestId('badge-icon')).not.toBeInTheDocument()
      expect(screen.queryByTestId('paint-indicator')).not.toBeInTheDocument()
    })

    it('should display message with badge and paint for styled users', async () => {
      // Setup cosmetics and user style
      const mockCosmetics = {
        badges: [{ id: 'badge1', name: 'VIP Badge', url: 'vip.png' }],
        paints: [{ id: 'paint1', name: 'Gold Paint', color: '#ffd700' }]
      }

      act(() => {
        useCosmeticsStore.getState().addCosmetics(mockCosmetics)
      })

      const mockUserData = {
        object: {
          user: {
            id: 'user123',
            username: 'vipuser',
            style: {
              badge_id: 'badge1',
              paint_id: 'paint1',
              color: '#ff6600'
            },
            connections: [{ type: 'KICK' }]
          }
        }
      }

      await act(async () => {
        await useCosmeticsStore.getState().addUserStyle('vipuser', mockUserData)
      })

      render(<MessageWithCosmetics username="vipuser" message="I'm a VIP!" />)

      await waitFor(() => {
        expect(screen.getByTestId('username-display')).toHaveStyle({ color: '#ff6600' })
        expect(screen.getByTestId('badge-icon')).toHaveAttribute('src', 'vip.png')
        expect(screen.getByTestId('badge-icon')).toHaveAttribute('alt', 'VIP Badge')
        expect(screen.getByTestId('paint-indicator')).toHaveStyle({ color: '#ffd700' })
        expect(screen.getByTestId('message-content')).toHaveTextContent("I'm a VIP!")
      })
    })

    it('should handle partial cosmetics (badge without paint)', async () => {
      const mockCosmetics = {
        badges: [{ id: 'badge1', name: 'Subscriber Badge', url: 'sub.png' }],
        paints: []
      }

      act(() => {
        useCosmeticsStore.getState().addCosmetics(mockCosmetics)
      })

      const mockUserData = {
        object: {
          user: {
            id: 'user123',
            username: 'subscriber',
            style: {
              badge_id: 'badge1',
              paint_id: null,
              color: '#0099ff'
            },
            connections: [{ type: 'KICK' }]
          }
        }
      }

      await act(async () => {
        await useCosmeticsStore.getState().addUserStyle('subscriber', mockUserData)
      })

      render(<MessageWithCosmetics username="subscriber" message="Thanks for subbing!" />)

      await waitFor(() => {
        expect(screen.getByTestId('username-display')).toHaveStyle({ color: '#0099ff' })
        expect(screen.getByTestId('badge-icon')).toBeInTheDocument()
        expect(screen.queryByTestId('paint-indicator')).not.toBeInTheDocument()
      })
    })
  })

  describe('Emote Picker Integration', () => {
    it('should display empty picker initially', () => {
      render(<EmotePicker />)

      expect(screen.getByTestId('badges-tab')).toHaveTextContent('Badges (0)')
      expect(screen.getByTestId('paints-tab')).toHaveTextContent('Paints (0)')
      expect(screen.getByTestId('items-list')).toBeEmptyDOMElement()
    })

    it('should update picker when cosmetics are added', async () => {
      render(<EmotePicker />)

      const mockCosmetics = {
        badges: [
          { id: 'badge1', name: 'Moderator', url: 'mod.png' },
          { id: 'badge2', name: 'Subscriber', url: 'sub.png' }
        ],
        paints: [
          { id: 'paint1', name: 'Rainbow', color: 'rainbow' },
          { id: 'paint2', name: 'Gold', color: '#ffd700' },
          { id: 'paint3', name: 'Silver', color: '#c0c0c0' }
        ]
      }

      act(() => {
        useCosmeticsStore.getState().addCosmetics(mockCosmetics)
      })

      await waitFor(() => {
        expect(screen.getByTestId('badges-tab')).toHaveTextContent('Badges (2)')
        expect(screen.getByTestId('paints-tab')).toHaveTextContent('Paints (3)')
      })

      // Check badges are displayed by default
      expect(screen.getByTestId('item-0')).toHaveTextContent('Moderator - mod.png')
      expect(screen.getByTestId('item-1')).toHaveTextContent('Subscriber - sub.png')
    })

    it('should switch categories correctly', async () => {
      const mockCosmetics = {
        badges: [{ id: 'badge1', name: 'VIP', url: 'vip.png' }],
        paints: [
          { id: 'paint1', name: 'Fire', color: '#ff4444' },
          { id: 'paint2', name: 'Ice', color: '#4444ff' }
        ]
      }

      act(() => {
        useCosmeticsStore.getState().addCosmetics(mockCosmetics)
      })

      render(<EmotePicker />)

      // Initially shows badges
      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveTextContent('VIP - vip.png')
      })

      // Switch to paints
      act(() => {
        screen.getByTestId('paints-tab').click()
      })

      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveTextContent('Fire - #ff4444')
        expect(screen.getByTestId('item-1')).toHaveTextContent('Ice - #4444ff')
      })

      // Switch back to badges
      act(() => {
        screen.getByTestId('badges-tab').click()
      })

      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveTextContent('VIP - vip.png')
      })
    })
  })

  describe('Real-time Updates Integration', () => {
    it('should update multiple consumers simultaneously', async () => {
      let consumerData1 = null
      let consumerData2 = null

      render(
        <div>
          <CosmeticsConsumer 
            username="user1" 
            onDataReceived={(data) => { consumerData1 = data }}
          />
          <CosmeticsConsumer 
            username="user2" 
            onDataReceived={(data) => { consumerData2 = data }}
          />
        </div>
      )

      // Add cosmetics - should update both consumers
      const mockCosmetics = {
        badges: [{ id: 'badge1', name: 'Universal Badge', url: 'universal.png' }],
        paints: []
      }

      act(() => {
        useCosmeticsStore.getState().addCosmetics(mockCosmetics)
      })

      // Add style for user1 only
      const mockUser1Data = {
        object: {
          user: {
            id: 'user1',
            username: 'user1',
            style: { badge_id: 'badge1', paint_id: null, color: '#ff0000' },
            connections: [{ type: 'KICK' }]
          }
        }
      }

      await act(async () => {
        await useCosmeticsStore.getState().addUserStyle('user1', mockUser1Data)
      })

      await waitFor(() => {
        // User1 should have style
        expect(consumerData1?.userStyle).toBeTruthy()
        expect(consumerData1?.userStyle.badge.name).toBe('Universal Badge')
        
        // User2 should not have style
        expect(consumerData2?.userStyle).toBeNull()
        
        // Both should see global cosmetics
        expect(consumerData1?.globalCosmetics.badges).toHaveLength(1)
        expect(consumerData2?.globalCosmetics.badges).toHaveLength(1)
      })
    })

    it('should handle cosmetic updates affecting existing users', async () => {
      // Add initial cosmetics
      const initialCosmetics = {
        badges: [{ id: 'badge1', name: 'Old Badge', url: 'old.png' }],
        paints: []
      }

      act(() => {
        useCosmeticsStore.getState().addCosmetics(initialCosmetics)
      })

      // Add user style
      const mockUserData = {
        object: {
          user: {
            id: 'user1',
            username: 'testuser',
            style: { badge_id: 'badge1', paint_id: null, color: '#000000' },
            connections: [{ type: 'KICK' }]
          }
        }
      }

      await act(async () => {
        await useCosmeticsStore.getState().addUserStyle('testuser', mockUserData)
      })

      let capturedData = null
      
      render(
        <CosmeticsConsumer 
          username="testuser" 
          onDataReceived={(data) => { capturedData = data }}
        />
      )

      // Verify initial state
      await waitFor(() => {
        expect(capturedData?.userStyle?.badge?.name).toBe('Old Badge')
      })

      // Update cosmetics (simulate fresh data from server)
      const updatedCosmetics = {
        badges: [
          { id: 'badge1', name: 'Updated Badge', url: 'updated.png' },
          { id: 'badge2', name: 'New Badge', url: 'new.png' }
        ],
        paints: [{ id: 'paint1', name: 'New Paint', color: '#00ff00' }]
      }

      act(() => {
        useCosmeticsStore.getState().addCosmetics(updatedCosmetics)
      })

      // User should see updated badge info
      await waitFor(() => {
        expect(capturedData?.userStyle?.badge?.name).toBe('Updated Badge')
        expect(capturedData?.userStyle?.badge?.url).toBe('updated.png')
        expect(capturedData?.globalCosmetics?.badges).toHaveLength(2)
        expect(capturedData?.globalCosmetics?.paints).toHaveLength(1)
      })
    })
  })

  describe('Error Handling in Components', () => {
    it('should handle store errors gracefully', () => {
      // Temporarily break the store
      const originalGetUserStyle = useCosmeticsStore.getState().getUserStyle
      useCosmeticsStore.setState({
        getUserStyle: () => { throw new Error('Store error') }
      })

      // Component should still render without crashing
      expect(() => {
        render(<MessageWithCosmetics username="erroruser" message="Test message" />)
      }).not.toThrow()

      // Restore store
      useCosmeticsStore.setState({
        getUserStyle: originalGetUserStyle
      })
    })

    it('should handle malformed cosmetics data in components', () => {
      // Add malformed data
      act(() => {
        useCosmeticsStore.setState({
          globalCosmetics: null // This could happen if API returns null
        })
      })

      // Components should handle null gracefully
      render(<EmotePicker />)
      
      expect(screen.getByTestId('badges-tab')).toHaveTextContent('Badges (0)')
      expect(screen.getByTestId('paints-tab')).toHaveTextContent('Paints (0)')
      expect(screen.getByTestId('items-list')).toBeEmptyDOMElement()
    })
  })

  describe('Performance Testing', () => {
    it('should handle frequent cosmetic updates without performance issues', async () => {
      let capturedData = null
      
      render(
        <CosmeticsConsumer 
          username="perfuser" 
          onDataReceived={(data) => { capturedData = data }}
        />
      )

      const startTime = performance.now()

      // Perform 100 cosmetic updates rapidly
      for (let i = 0; i < 100; i++) {
        act(() => {
          useCosmeticsStore.getState().addCosmetics({
            badges: Array.from({ length: i + 1 }, (_, idx) => ({
              id: `badge${idx}`,
              name: `Badge ${idx}`,
              url: `badge${idx}.png`
            })),
            paints: Array.from({ length: i + 1 }, (_, idx) => ({
              id: `paint${idx}`,
              name: `Paint ${idx}`,
              color: `#${idx.toString(16).padStart(6, '0')}`
            }))
          })
        })
      }

      const endTime = performance.now()

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(1000) // 1 second

      // Final state should be correct
      await waitFor(() => {
        expect(capturedData?.globalCosmetics?.badges).toHaveLength(100)
        expect(capturedData?.globalCosmetics?.paints).toHaveLength(100)
      })
    })
  })
})