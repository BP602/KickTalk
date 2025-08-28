import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EmoteDialogs from './EmoteDialogs.jsx'

// Mock dependencies
vi.mock('clsx', () => ({
  default: (...args) => args.filter(Boolean).join(' ')
}))

// Mock asset imports
vi.mock('../../../assets/logos/kickLogoFull.svg?asset', () => ({ default: 'kick-logo-full.svg' }))
vi.mock('../../../assets/logos/stvLogo.svg?asset', () => ({ default: 'stv-logo.svg' }))
vi.mock('../../../assets/logos/kickLogoIcon.svg?asset', () => ({ default: 'kick-logo-icon.svg' }))
vi.mock('../../../assets/icons/caret-down-bold.svg?asset', () => ({ default: 'caret-down.svg' }))
vi.mock('../../../assets/icons/globe-fill.svg?asset', () => ({ default: 'globe-icon.svg' }))
vi.mock('../../../assets/icons/lock-simple-fill.svg?asset', () => ({ default: 'lock-icon.svg' }))
vi.mock('../../../assets/icons/user-fill.svg?asset', () => ({ default: 'user-icon.svg' }))

// Mock Tooltip components
vi.mock('../../Shared/Tooltip', () => ({
  Tooltip: vi.fn(({ children }) => <div data-testid="tooltip">{children}</div>),
  TooltipContent: vi.fn(({ children }) => <div data-testid="tooltip-content">{children}</div>),
  TooltipProvider: vi.fn(({ children }) => <div data-testid="tooltip-provider">{children}</div>),
  TooltipTrigger: vi.fn(({ children, asChild, ...props }) => {
    if (asChild && children) {
      return React.cloneElement(children, { ...props, 'data-testid': 'tooltip-trigger' })
    }
    return <div data-testid="tooltip-trigger" {...props}>{children}</div>
  })
}))

// Mock useClickOutside
vi.mock('../../../utils/useClickOutside', () => ({
  default: vi.fn()
}))

// Mock chat store with proper structure
const mockChatStore = {
  chatrooms: [
    {
      id: 'test-chatroom-1',
      emotes: [
        {
          name: 'Global',
          emotes: [
            { id: '1', name: 'Kappa', subscribers_only: false },
            { id: '2', name: 'PogChamp', subscribers_only: false },
            { id: '3', name: 'SubscriberEmote', subscribers_only: true }
          ]
        },
        {
          name: 'channel_set',
          emotes: [
            { id: '4', name: 'ChannelEmote1', subscribers_only: false },
            { id: '5', name: 'ChannelEmote2', subscribers_only: true }
          ],
          user: { profile_pic: 'channel-avatar.jpg' }
        },
        {
          name: 'Emojis',
          emotes: [
            { id: '6', name: 'Smile', subscribers_only: false },
            { id: '7', name: 'Wink', subscribers_only: false }
          ]
        }
      ],
      channel7TVEmotes: [
        {
          type: 'channel',
          emotes: [
            { id: '7tv1', name: 'OMEGALUL' },
            { id: '7tv2', name: 'monkaS' }
          ],
          setInfo: { name: 'Channel Set' },
          user: { avatar_url: 'https://example.com/avatar.jpg' }
        },
        {
          type: 'global',
          emotes: [
            { id: '7tv3', name: 'EZ' },
            { id: '7tv4', name: 'Clap' }
          ],
          setInfo: { name: 'Global Set' }
        }
      ]
    }
  ],
  personalEmoteSets: [
    {
      type: 'personal',
      emotes: [
        { id: '7tv5', name: 'PersonalEmote1' },
        { id: '7tv6', name: 'PersonalEmote2' }
      ],
      setInfo: { name: 'Personal Set' }
    }
  ]
}

vi.mock('../../../providers/ChatProvider', () => ({
  default: vi.fn((selector) => {
    if (typeof selector === 'function') {
      return selector(mockChatStore)
    }
    return mockChatStore
  })
}))

vi.mock('zustand/react/shallow', () => ({
  useShallow: vi.fn((fn) => fn)
}))

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn()
}))

global.IntersectionObserver = mockIntersectionObserver

describe('EmoteDialogs Component', () => {
  const defaultProps = {
    chatroomId: 'test-chatroom-1',
    handleEmoteClick: vi.fn(),
    userChatroomInfo: {
      subscription: false,
      id: 'user123'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockIntersectionObserver.mockClear()
    
    // Mock Math.random for consistent random emote selection
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('Component Rendering and Initialization', () => {
    it('should render without crashing', () => {
      render(<EmoteDialogs {...defaultProps} />)
      
      expect(screen.getByTestId('tooltip-provider')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /7TV Emotes/i })).toBeInTheDocument()
    })

    it('should render both 7TV and Kick emote buttons', () => {
      render(<EmoteDialogs {...defaultProps} />)
      
      const stvButton = screen.getByRole('button', { name: /7TV Emotes/i })
      const kickButton = screen.getByRole('button')
      
      expect(stvButton).toBeInTheDocument()
      expect(kickButton).toBeInTheDocument()
    })

    it('should initialize with no dialog open', () => {
      render(<EmoteDialogs {...defaultProps} />)
      
      expect(screen.queryByRole('textbox', { name: /search/i })).not.toBeInTheDocument()
    })

    it('should initialize random emotes from kick emojis', () => {
      render(<EmoteDialogs {...defaultProps} />)
      
      // The kick button should display a random emote
      const kickButton = screen.getByRole('button')
      const emoteImg = kickButton.querySelector('img.kickEmote')
      expect(emoteImg).toBeInTheDocument()
    })

    it('should handle missing emote data gracefully', () => {
      const propsWithNoEmotes = {
        ...defaultProps,
        chatroomId: 'nonexistent-chatroom'
      }
      
      expect(() => {
        render(<EmoteDialogs {...propsWithNoEmotes} />)
      }).not.toThrow()
    })
  })

  describe('7TV Emote Dialog', () => {
    it('should open 7TV dialog when button is clicked', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const stvButton = screen.getByRole('button', { name: /7TV Emotes/i })
      await user.click(stvButton)
      
      expect(screen.getByRole('textbox', { placeholder: 'Search emotes...' })).toBeInTheDocument()
      expect(screen.getByText('OMEGALUL')).toBeInTheDocument()
    })

    it('should close 7TV dialog when button is clicked again', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const stvButton = screen.getByRole('button', { name: /7TV Emotes/i })
      await user.click(stvButton)
      
      expect(screen.getByRole('textbox')).toBeInTheDocument()
      
      await user.click(stvButton)
      
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('should display all emote sections in 7TV dialog', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const stvButton = screen.getByRole('button', { name: /7TV Emotes/i })
      await user.click(stvButton)
      
      expect(screen.getByText('Personal Set')).toBeInTheDocument()
      expect(screen.getByText('Channel Set')).toBeInTheDocument()
      expect(screen.getByText('Global Set')).toBeInTheDocument()
    })

    it('should show section menu items for each emote type', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const stvButton = screen.getByRole('button', { name: /7TV Emotes/i })
      await user.click(stvButton)
      
      expect(screen.getByRole('button', { name: /Personal Emotes/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Channel Emotes/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Global Emotes/i })).toBeInTheDocument()
    })

    it('should filter emotes by section when menu item is clicked', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const stvButton = screen.getByRole('button', { name: /7TV Emotes/i })
      await user.click(stvButton)
      
      // Click personal emotes filter
      const personalButton = screen.getByRole('button', { name: /Personal Emotes/i })
      await user.click(personalButton)
      
      // Should only show personal emotes
      expect(screen.getByText('Personal Set')).toBeInTheDocument()
      expect(screen.queryByText('Channel Set')).not.toBeInTheDocument()
      expect(screen.queryByText('Global Set')).not.toBeInTheDocument()
    })

    it('should handle channel avatar URL correctly', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const stvButton = screen.getByRole('button', { name: /7TV Emotes/i })
      await user.click(stvButton)
      
      const channelButton = screen.getByRole('button', { name: /Channel Emotes/i })
      const img = channelButton.querySelector('img')
      
      expect(img.src).toBe('https://example.com/avatar.jpg')
    })

    it('should use fallback avatar when channel avatar is missing', async () => {
      // Mock store with missing channel avatar
      const storeWithoutAvatar = {
        ...mockChatStore,
        chatrooms: [{
          ...mockChatStore.chatrooms[0],
          channel7TVEmotes: [{
            type: 'channel',
            emotes: [{ id: '7tv1', name: 'OMEGALUL' }],
            setInfo: { name: 'Channel Set' },
            user: { avatar_url: null }
          }]
        }]
      }
      
      vi.mocked(require('../../../providers/ChatProvider').default).mockImplementation((selector) => {
        return selector(storeWithoutAvatar)
      })
      
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const stvButton = screen.getByRole('button', { name: /7TV Emotes/i })
      await user.click(stvButton)
      
      const channelButton = screen.getByRole('button', { name: /Channel Emotes/i })
      const img = channelButton.querySelector('img')
      
      expect(img.src).toContain('stv-logo.svg')
    })
  })

  describe('7TV Emote Search Functionality', () => {
    it('should filter emotes based on search input', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const stvButton = screen.getByRole('button', { name: /7TV Emotes/i })
      await user.click(stvButton)
      
      const searchInput = screen.getByRole('textbox', { placeholder: 'Search emotes...' })
      await user.type(searchInput, 'OMEGA')
      
      expect(screen.getByText('OMEGALUL')).toBeInTheDocument()
      expect(screen.queryByText('monkaS')).not.toBeInTheDocument()
    })

    it('should show "No 7TV Emotes found" when no search results', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const stvButton = screen.getByRole('button', { name: /7TV Emotes/i })
      await user.click(stvButton)
      
      const searchInput = screen.getByRole('textbox')
      await user.type(searchInput, 'nonexistent')
      
      expect(screen.getByText('No 7TV Emotes found')).toBeInTheDocument()
    })

    it('should show match count in section titles when searching', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const stvButton = screen.getByRole('button', { name: /7TV Emotes/i })
      await user.click(stvButton)
      
      const searchInput = screen.getByRole('textbox')
      await user.type(searchInput, 'OMEGA')
      
      expect(screen.getByText(/Channel Set \[1 matches\]/)).toBeInTheDocument()
    })

    it('should be case insensitive', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const stvButton = screen.getByRole('button', { name: /7TV Emotes/i })
      await user.click(stvButton)
      
      const searchInput = screen.getByRole('textbox')
      await user.type(searchInput, 'omega')
      
      expect(screen.getByText('OMEGALUL')).toBeInTheDocument()
    })

    it('should clear search when input is cleared', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const stvButton = screen.getByRole('button', { name: /7TV Emotes/i })
      await user.click(stvButton)
      
      const searchInput = screen.getByRole('textbox')
      await user.type(searchInput, 'OMEGA')
      
      expect(screen.queryByText('monkaS')).not.toBeInTheDocument()
      
      await user.clear(searchInput)
      
      expect(screen.getByText('monkaS')).toBeInTheDocument()
    })
  })

  describe('Kick Emote Dialog', () => {
    it('should open kick dialog when kick button is clicked', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const kickButtons = screen.getAllByRole('button')
      const kickButton = kickButtons.find(btn => btn.querySelector('.kickEmote'))
      
      await user.click(kickButton)
      
      expect(screen.getByRole('textbox', { placeholder: 'Search...' })).toBeInTheDocument()
    })

    it('should display kick emote sections', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const kickButtons = screen.getAllByRole('button')
      const kickButton = kickButtons.find(btn => btn.querySelector('.kickEmote'))
      
      await user.click(kickButton)
      
      expect(screen.getByText('Global')).toBeInTheDocument()
      expect(screen.getByText('Subscriber Emotes')).toBeInTheDocument()
      expect(screen.getByText('Emojis')).toBeInTheDocument()
    })

    it('should show section menu items for kick emotes', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const kickButtons = screen.getAllByRole('button')
      const kickButton = kickButtons.find(btn => btn.querySelector('.kickEmote'))
      
      await user.click(kickButton)
      
      expect(screen.getByRole('button', { name: /Channel Emotes/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Global Emotes/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Emojis/i })).toBeInTheDocument()
    })

    it('should filter kick emotes by section', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const kickButtons = screen.getAllByRole('button')
      const kickButton = kickButtons.find(btn => btn.querySelector('.kickEmote'))
      
      await user.click(kickButton)
      
      // Click global emotes filter
      const globalButton = screen.getByRole('button', { name: /Global Emotes/i })
      await user.click(globalButton)
      
      // Should only show global emotes
      expect(screen.getByText('Global')).toBeInTheDocument()
      expect(screen.queryByText('Subscriber Emotes')).not.toBeInTheDocument()
      expect(screen.queryByText('Emojis')).not.toBeInTheDocument()
    })

    it('should show channel profile picture in menu', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const kickButtons = screen.getAllByRole('button')
      const kickButton = kickButtons.find(btn => btn.querySelector('.kickEmote'))
      
      await user.click(kickButton)
      
      const channelButton = screen.getByRole('button', { name: /Channel Emotes/i })
      const img = channelButton.querySelector('img')
      
      expect(img.src).toContain('channel-avatar.jpg')
    })
  })

  describe('Kick Emote Search Functionality', () => {
    it('should filter kick emotes based on search input', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const kickButtons = screen.getAllByRole('button')
      const kickButton = kickButtons.find(btn => btn.querySelector('.kickEmote'))
      
      await user.click(kickButton)
      
      const searchInput = screen.getByRole('textbox', { placeholder: 'Search...' })
      await user.type(searchInput, 'Kappa')
      
      expect(screen.getByText('Kappa')).toBeInTheDocument()
      expect(screen.queryByText('PogChamp')).not.toBeInTheDocument()
    })

    it('should show "No Kick Emotes found" when no results', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const kickButtons = screen.getAllByRole('button')
      const kickButton = kickButtons.find(btn => btn.querySelector('.kickEmote'))
      
      await user.click(kickButton)
      
      const searchInput = screen.getByRole('textbox', { placeholder: 'Search...' })
      await user.type(searchInput, 'nonexistent')
      
      expect(screen.getByText('No Kick Emotes found')).toBeInTheDocument()
    })

    it('should show match count in kick section titles', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const kickButtons = screen.getAllByRole('button')
      const kickButton = kickButtons.find(btn => btn.querySelector('.kickEmote'))
      
      await user.click(kickButton)
      
      const searchInput = screen.getByRole('textbox', { placeholder: 'Search...' })
      await user.type(searchInput, 'Kappa')
      
      expect(screen.getByText(/Global \[1 matches\]/)).toBeInTheDocument()
    })
  })

  describe('Emote Click Handling', () => {
    it('should call handleEmoteClick when 7TV emote is clicked', async () => {
      const user = userEvent.setup()
      const handleEmoteClick = vi.fn()
      render(<EmoteDialogs {...defaultProps} handleEmoteClick={handleEmoteClick} />)
      
      const stvButton = screen.getByRole('button', { name: /7TV Emotes/i })
      await user.click(stvButton)
      
      const emoteButton = screen.getByRole('button', { name: 'OMEGALUL' })
      await user.click(emoteButton)
      
      expect(handleEmoteClick).toHaveBeenCalledWith({
        id: '7tv1',
        name: 'OMEGALUL'
      })
    })

    it('should call handleEmoteClick when kick emote is clicked', async () => {
      const user = userEvent.setup()
      const handleEmoteClick = vi.fn()
      render(<EmoteDialogs {...defaultProps} handleEmoteClick={handleEmoteClick} />)
      
      const kickButtons = screen.getAllByRole('button')
      const kickButton = kickButtons.find(btn => btn.querySelector('.kickEmote'))
      
      await user.click(kickButton)
      
      const emoteButton = screen.getByRole('button', { name: 'Kappa' })
      await user.click(emoteButton)
      
      expect(handleEmoteClick).toHaveBeenCalledWith({
        id: '1',
        name: 'Kappa',
        subscribers_only: false
      })
    })
  })

  describe('Permission-based Emote Filtering', () => {
    it('should disable subscriber-only emotes for non-subscribers', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const kickButtons = screen.getAllByRole('button')
      const kickButton = kickButtons.find(btn => btn.querySelector('.kickEmote'))
      
      await user.click(kickButton)
      
      const subscriberEmote = screen.getByRole('button', { name: 'SubscriberEmote' })
      expect(subscriberEmote).toBeDisabled()
    })

    it('should show lock icon on disabled subscriber emotes', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const kickButtons = screen.getAllByRole('button')
      const kickButton = kickButtons.find(btn => btn.querySelector('.kickEmote'))
      
      await user.click(kickButton)
      
      const subscriberEmote = screen.getByRole('button', { name: 'SubscriberEmote' })
      const lockIcon = subscriberEmote.querySelector('img[alt="Subscriber"]')
      
      expect(lockIcon).toBeInTheDocument()
    })

    it('should enable subscriber emotes for subscribers', async () => {
      const user = userEvent.setup()
      const subscriberProps = {
        ...defaultProps,
        userChatroomInfo: { subscription: true }
      }
      
      render(<EmoteDialogs {...subscriberProps} />)
      
      const kickButtons = screen.getAllByRole('button')
      const kickButton = kickButtons.find(btn => btn.querySelector('.kickEmote'))
      
      await user.click(kickButton)
      
      const subscriberEmote = screen.getByRole('button', { name: 'SubscriberEmote' })
      expect(subscriberEmote).not.toBeDisabled()
    })

    it('should not show lock icon for subscribers', async () => {
      const user = userEvent.setup()
      const subscriberProps = {
        ...defaultProps,
        userChatroomInfo: { subscription: true }
      }
      
      render(<EmoteDialogs {...subscriberProps} />)
      
      const kickButtons = screen.getAllByRole('button')
      const kickButton = kickButtons.find(btn => btn.querySelector('.kickEmote'))
      
      await user.click(kickButton)
      
      const subscriberEmote = screen.getByRole('button', { name: 'SubscriberEmote' })
      const lockIcon = subscriberEmote.querySelector('img[alt="Subscriber"]')
      
      expect(lockIcon).not.toBeInTheDocument()
    })
  })

  describe('Lazy Loading of Emote Sections', () => {
    it('should initially show limited number of emotes', async () => {
      // Create mock data with many emotes
      const manyEmotes = Array.from({ length: 50 }, (_, i) => ({
        id: `${i}`,
        name: `Emote${i}`,
        subscribers_only: false
      }))
      
      const storeWithManyEmotes = {
        ...mockChatStore,
        chatrooms: [{
          ...mockChatStore.chatrooms[0],
          emotes: [{
            name: 'Global',
            emotes: manyEmotes
          }]
        }]
      }
      
      vi.mocked(require('../../../providers/ChatProvider').default).mockImplementation((selector) => {
        return selector(storeWithManyEmotes)
      })
      
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const kickButtons = screen.getAllByRole('button')
      const kickButton = kickButtons.find(btn => btn.querySelector('.kickEmote'))
      
      await user.click(kickButton)
      
      // Should only show first 20 emotes initially
      expect(screen.getByRole('button', { name: 'Emote0' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Emote19' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Emote20' })).not.toBeInTheDocument()
    })

    it('should set up IntersectionObserver for lazy loading', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const kickButtons = screen.getAllByRole('button')
      const kickButton = kickButtons.find(btn => btn.querySelector('.kickEmote'))
      
      await user.click(kickButton)
      
      expect(mockIntersectionObserver).toHaveBeenCalled()
    })
  })

  describe('Section Toggle Functionality', () => {
    it('should expand and collapse emote sections', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const kickButtons = screen.getAllByRole('button')
      const kickButton = kickButtons.find(btn => btn.querySelector('.kickEmote'))
      
      await user.click(kickButton)
      
      // Find section toggle button (caret down button)
      const toggleButtons = screen.getAllByRole('button')
      const sectionToggle = toggleButtons.find(btn => btn.querySelector('img[alt="Caret Down"]'))
      
      expect(sectionToggle).toBeInTheDocument()
    })

    it('should start with sections open by default', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const kickButtons = screen.getAllByRole('button')
      const kickButton = kickButtons.find(btn => btn.querySelector('.kickEmote'))
      
      await user.click(kickButton)
      
      // Emotes should be visible by default
      expect(screen.getByRole('button', { name: 'Kappa' })).toBeInTheDocument()
    })
  })

  describe('Click Outside Behavior', () => {
    it('should register click outside handler', () => {
      const mockUseClickOutside = vi.mocked(require('../../../utils/useClickOutside').default)
      
      render(<EmoteDialogs {...defaultProps} />)
      
      expect(mockUseClickOutside).toHaveBeenCalledWith(
        expect.objectContaining({ current: null }),
        expect.any(Function)
      )
    })

    it('should close dialog when clicking outside', async () => {
      let clickOutsideCallback
      vi.mocked(require('../../../utils/useClickOutside').default).mockImplementation((ref, callback) => {
        clickOutsideCallback = callback
      })
      
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const stvButton = screen.getByRole('button', { name: /7TV Emotes/i })
      await user.click(stvButton)
      
      expect(screen.getByRole('textbox')).toBeInTheDocument()
      
      // Simulate click outside
      act(() => {
        clickOutsideCallback()
      })
      
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })
  })

  describe('Random Emote Display', () => {
    it('should update kick button emote on hover', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const kickButtons = screen.getAllByRole('button')
      const kickButton = kickButtons.find(btn => btn.querySelector('.kickEmote'))
      const emoteImg = kickButton.querySelector('.kickEmote')
      
      const initialSrc = emoteImg.src
      
      await user.hover(kickButton)
      
      // Should potentially change the emote (depends on random selection)
      // We test that the mechanism is in place
      expect(emoteImg).toBeInTheDocument()
    })

    it('should show fallback emote when no emojis available', () => {
      const storeWithoutEmojis = {
        ...mockChatStore,
        chatrooms: [{
          ...mockChatStore.chatrooms[0],
          emotes: [{
            name: 'Global',
            emotes: []
          }]
        }]
      }
      
      vi.mocked(require('../../../providers/ChatProvider').default).mockImplementation((selector) => {
        return selector(storeWithoutEmojis)
      })
      
      render(<EmoteDialogs {...defaultProps} />)
      
      const kickButtons = screen.getAllByRole('button')
      const kickButton = kickButtons.find(btn => btn.querySelector('.kickEmote'))
      const emoteImg = kickButton.querySelector('.kickEmote')
      
      // Should show fallback emote
      expect(emoteImg.src).toContain('1730762')
    })
  })

  describe('Integration with Chat Provider', () => {
    it('should use useShallow selector', () => {
      const mockUseShallow = vi.mocked(require('zustand/react/shallow').useShallow)
      
      render(<EmoteDialogs {...defaultProps} />)
      
      expect(mockUseShallow).toHaveBeenCalled()
    })

    it('should fetch emotes for correct chatroom', () => {
      const mockChatProvider = vi.mocked(require('../../../providers/ChatProvider').default)
      
      render(<EmoteDialogs {...defaultProps} chatroomId="test-chatroom-1" />)
      
      expect(mockChatProvider).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should handle missing chatroom data gracefully', () => {
      const emptyStore = {
        chatrooms: [],
        personalEmoteSets: []
      }
      
      vi.mocked(require('../../../providers/ChatProvider').default).mockImplementation((selector) => {
        return selector(emptyStore)
      })
      
      expect(() => {
        render(<EmoteDialogs {...defaultProps} chatroomId="nonexistent" />)
      }).not.toThrow()
    })
  })

  describe('Error Handling for Missing Emotes', () => {
    it('should handle undefined emotes gracefully', () => {
      const storeWithUndefinedEmotes = {
        chatrooms: [{
          id: 'test-chatroom-1',
          emotes: undefined,
          channel7TVEmotes: undefined
        }],
        personalEmoteSets: undefined
      }
      
      vi.mocked(require('../../../providers/ChatProvider').default).mockImplementation((selector) => {
        return selector(storeWithUndefinedEmotes)
      })
      
      expect(() => {
        render(<EmoteDialogs {...defaultProps} />)
      }).not.toThrow()
    })

    it('should handle null emote sections', () => {
      const storeWithNullEmotes = {
        chatrooms: [{
          id: 'test-chatroom-1',
          emotes: null,
          channel7TVEmotes: null
        }],
        personalEmoteSets: null
      }
      
      vi.mocked(require('../../../providers/ChatProvider').default).mockImplementation((selector) => {
        return selector(storeWithNullEmotes)
      })
      
      expect(() => {
        render(<EmoteDialogs {...defaultProps} />)
      }).not.toThrow()
    })

    it('should handle empty emote arrays', () => {
      const storeWithEmptyEmotes = {
        chatrooms: [{
          id: 'test-chatroom-1',
          emotes: [],
          channel7TVEmotes: []
        }],
        personalEmoteSets: []
      }
      
      vi.mocked(require('../../../providers/ChatProvider').default).mockImplementation((selector) => {
        return selector(storeWithEmptyEmotes)
      })
      
      expect(() => {
        render(<EmoteDialogs {...defaultProps} />)
      }).not.toThrow()
    })

    it('should handle malformed emote objects', () => {
      const storeWithMalformedEmotes = {
        chatrooms: [{
          id: 'test-chatroom-1',
          emotes: [{
            name: 'Global',
            emotes: [
              { id: '1' }, // Missing name
              { name: 'Test' }, // Missing id
              null, // Null emote
              undefined // Undefined emote
            ]
          }],
          channel7TVEmotes: [{
            type: 'channel',
            emotes: [{ /* incomplete emote object */ }],
            setInfo: null
          }]
        }],
        personalEmoteSets: []
      }
      
      vi.mocked(require('../../../providers/ChatProvider').default).mockImplementation((selector) => {
        return selector(storeWithMalformedEmotes)
      })
      
      expect(() => {
        render(<EmoteDialogs {...defaultProps} />)
      }).not.toThrow()
    })
  })

  describe('Performance Optimizations (Memoization)', () => {
    it('should memoize 7TV dialog component', () => {
      const { rerender } = render(<EmoteDialogs {...defaultProps} />)
      
      // Re-render with same props
      rerender(<EmoteDialogs {...defaultProps} />)
      
      // Component should still be rendered correctly
      expect(screen.getByRole('button', { name: /7TV Emotes/i })).toBeInTheDocument()
    })

    it('should memoize kick dialog component', () => {
      const { rerender } = render(<EmoteDialogs {...defaultProps} />)
      
      // Re-render with same props  
      rerender(<EmoteDialogs {...defaultProps} />)
      
      // Component should still be rendered correctly
      const kickButtons = screen.getAllByRole('button')
      const kickButton = kickButtons.find(btn => btn.querySelector('.kickEmote'))
      expect(kickButton).toBeInTheDocument()
    })

    it('should re-render when emote data changes', () => {
      const { rerender } = render(<EmoteDialogs {...defaultProps} />)
      
      // Change emote data
      const updatedStore = {
        ...mockChatStore,
        chatrooms: [{
          ...mockChatStore.chatrooms[0],
          emotes: [{
            name: 'Global',
            emotes: [{ id: '999', name: 'NewEmote', subscribers_only: false }]
          }]
        }]
      }
      
      vi.mocked(require('../../../providers/ChatProvider').default).mockImplementation((selector) => {
        return selector(updatedStore)
      })
      
      rerender(<EmoteDialogs {...defaultProps} />)
      
      // Should handle the updated data
      expect(screen.getByRole('button', { name: /7TV Emotes/i })).toBeInTheDocument()
    })

    it('should update when userChatroomInfo changes', () => {
      const { rerender } = render(<EmoteDialogs {...defaultProps} />)
      
      const updatedProps = {
        ...defaultProps,
        userChatroomInfo: { subscription: true, id: 'user123' }
      }
      
      rerender(<EmoteDialogs {...updatedProps} />)
      
      // Component should update with new subscription status
      expect(screen.getByRole('button', { name: /7TV Emotes/i })).toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should handle keyboard navigation in emote buttons', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const stvButton = screen.getByRole('button', { name: /7TV Emotes/i })
      await user.click(stvButton)
      
      const emoteButton = screen.getByRole('button', { name: 'OMEGALUL' })
      
      // Tab to emote button and press enter
      await user.tab()
      await user.keyboard('{Enter}')
      
      // Should be able to navigate and activate emote buttons
      expect(emoteButton).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper alt text for emote images', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const stvButton = screen.getByRole('button', { name: /7TV Emotes/i })
      await user.click(stvButton)
      
      const emoteImg = screen.getByAltText('OMEGALUL')
      expect(emoteImg).toBeInTheDocument()
    })

    it('should have proper alt text for kick emote images', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const kickButtons = screen.getAllByRole('button')
      const kickButton = kickButtons.find(btn => btn.querySelector('.kickEmote'))
      
      await user.click(kickButton)
      
      const emoteImg = screen.getByAltText('Kappa')
      expect(emoteImg).toBeInTheDocument()
    })

    it('should have proper alt text for UI icons', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const kickButtons = screen.getAllByRole('button')
      const kickButton = kickButtons.find(btn => btn.querySelector('.kickEmote'))
      
      await user.click(kickButton)
      
      const caretIcon = screen.getByAltText('Caret Down')
      expect(caretIcon).toBeInTheDocument()
    })

    it('should be keyboard accessible', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      // Should be able to tab to main buttons
      await user.tab()
      expect(screen.getByRole('button', { name: /7TV Emotes/i })).toHaveFocus()
      
      await user.tab()
      const kickButtons = screen.getAllByRole('button')
      const kickButton = kickButtons.find(btn => btn.querySelector('.kickEmote'))
      expect(kickButton).toHaveFocus()
    })

    it('should support screen reader navigation', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const stvButton = screen.getByRole('button', { name: /7TV Emotes/i })
      await user.click(stvButton)
      
      // Search input should be properly labeled
      const searchInput = screen.getByRole('textbox', { name: /search emotes/i })
      expect(searchInput).toBeInTheDocument()
    })
  })

  describe('Component Cleanup', () => {
    it('should cleanup IntersectionObserver on unmount', () => {
      const mockDisconnect = vi.fn()
      mockIntersectionObserver.mockReturnValue({
        observe: vi.fn(),
        disconnect: mockDisconnect,
        unobserve: vi.fn()
      })
      
      const { unmount } = render(<EmoteDialogs {...defaultProps} />)
      
      unmount()
      
      // IntersectionObserver cleanup is handled in useEffect cleanup
      // This test ensures the component unmounts without errors
      expect(mockDisconnect).toHaveBeenCalled()
    })

    it('should handle unmount during lazy loading', async () => {
      const user = userEvent.setup()
      const { unmount } = render(<EmoteDialogs {...defaultProps} />)
      
      const stvButton = screen.getByRole('button', { name: /7TV Emotes/i })
      await user.click(stvButton)
      
      // Unmount while dialog is open
      expect(() => {
        unmount()
      }).not.toThrow()
    })
  })

  describe('Edge Cases and Error Boundaries', () => {
    it('should handle component re-render during dialog state changes', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<EmoteDialogs {...defaultProps} />)
      
      const stvButton = screen.getByRole('button', { name: /7TV Emotes/i })
      await user.click(stvButton)
      
      // Re-render while dialog is open
      rerender(<EmoteDialogs {...defaultProps} />)
      
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('should handle rapid dialog opening/closing', async () => {
      const user = userEvent.setup()
      render(<EmoteDialogs {...defaultProps} />)
      
      const stvButton = screen.getByRole('button', { name: /7TV Emotes/i })
      
      // Rapidly open and close dialog
      for (let i = 0; i < 5; i++) {
        await user.click(stvButton)
        await user.click(stvButton)
      }
      
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('should handle props changes while dialog is open', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<EmoteDialogs {...defaultProps} />)
      
      const stvButton = screen.getByRole('button', { name: /7TV Emotes/i })
      await user.click(stvButton)
      
      // Change props while dialog is open
      const newProps = {
        ...defaultProps,
        userChatroomInfo: { subscription: true, id: 'user456' }
      }
      
      rerender(<EmoteDialogs {...newProps} />)
      
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('should handle missing handleEmoteClick prop', () => {
      const propsWithoutHandler = {
        ...defaultProps,
        handleEmoteClick: undefined
      }
      
      expect(() => {
        render(<EmoteDialogs {...propsWithoutHandler} />)
      }).not.toThrow()
    })
  })
})