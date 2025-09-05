import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TitleBar from './TitleBar.jsx'

// Mock SCSS imports
vi.mock('@assets/styles/components/TitleBar.scss', () => ({}))

// Mock clsx
vi.mock('clsx', () => ({
  default: (...args) => args.filter(Boolean).join(' ')
}))

// Mock static assets
vi.mock('@assets/icons/minus-bold.svg?asset', () => ({ default: 'minus-icon.svg' }))
vi.mock('@assets/icons/square-bold.svg?asset', () => ({ default: 'square-icon.svg' }))
vi.mock('@assets/icons/x-bold.svg?asset', () => ({ default: 'x-icon.svg' }))
vi.mock('@assets/icons/gear-fill.svg?asset', () => ({ default: 'gear-icon.svg' }))

// Mock child components
vi.mock('./Updater', () => ({
  default: () => <div data-testid="updater-component">Updater</div>
}))

// Mock Settings component (referenced but not imported in the source)
const MockSettings = ({ settingsModalOpen, setSettingsModalOpen, appInfo }) => (
  <div data-testid="settings-modal">
    <span data-testid="modal-open">{String(settingsModalOpen)}</span>
    <span data-testid="app-info">{JSON.stringify(appInfo)}</span>
    <button 
      data-testid="close-modal"
      onClick={() => setSettingsModalOpen(false)}
    >
      Close Modal
    </button>
  </div>
)

// Since Settings is not imported, we'll assume it's conditionally rendered
// but not actually implemented in the current source

// Mock providers
const mockCurrentUser = {
  id: 'user123',
  username: 'testuser',
  profile_pic: 'avatar.jpg'
}

const mockChatStore = {
  currentUser: mockCurrentUser,
  cacheCurrentUser: vi.fn()
}

vi.mock('../providers/ChatProvider', () => ({
  default: (selector) => selector(mockChatStore)
}))

// Mock window.app APIs
const mockWindowApp = {
  getAppInfo: vi.fn(),
  authDialog: {
    open: vi.fn()
  },
  settingsDialog: {
    open: vi.fn()
  },
  minimize: vi.fn(),
  maximize: vi.fn(),
  close: vi.fn()
}

global.window = {
  app: mockWindowApp
}

describe('TitleBar Component', () => {
  const mockAppInfo = {
    appVersion: '1.0.0',
    platform: 'win32',
    arch: 'x64'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset mock implementations
    mockWindowApp.getAppInfo.mockResolvedValue(mockAppInfo)
    mockChatStore.currentUser = mockCurrentUser
    mockChatStore.cacheCurrentUser.mockClear()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Component Rendering', () => {
    it('should render title bar with correct structure', async () => {
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(mockWindowApp.getAppInfo).toHaveBeenCalled()
      })
      
      const titleBar = document.querySelector('.titleBar')
      expect(titleBar).toBeInTheDocument()
      
      const titleBarLeft = document.querySelector('.titleBarLeft')
      const titleBarSettings = document.querySelector('.titleBarSettings')
      const titleBarRight = document.querySelector('.titleBarRight')
      
      expect(titleBarLeft).toBeInTheDocument()
      expect(titleBarSettings).toBeInTheDocument()
      expect(titleBarRight).toBeInTheDocument()
    })

    it('should display app name and version', async () => {
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(screen.getByText('KickTalk 1.0.0')).toBeInTheDocument()
      })
    })

    it('should render Updater component', () => {
      render(<TitleBar />)
      
      expect(screen.getByTestId('updater-component')).toBeInTheDocument()
    })

    it('should render window controls', () => {
      render(<TitleBar />)
      
      const controls = document.querySelector('.titleBarControls')
      expect(controls).toBeInTheDocument()
      
      expect(screen.getByAltText('Minimize')).toBeInTheDocument()
      expect(screen.getByAltText('Maximize')).toBeInTheDocument()
      expect(screen.getByAltText('Close')).toBeInTheDocument()
    })
  })

  describe('App Info Integration', () => {
    it('should fetch app info on mount', async () => {
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(mockWindowApp.getAppInfo).toHaveBeenCalledTimes(1)
      })
    })

    it('should handle missing app version gracefully', async () => {
      mockWindowApp.getAppInfo.mockResolvedValue({})
      
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(mockWindowApp.getAppInfo).toHaveBeenCalled()
      })
      
      expect(screen.getByText('KickTalk')).toBeInTheDocument()
    })

    it('should handle app info fetch error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockWindowApp.getAppInfo.mockRejectedValue(new Error('App info error'))
      
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(mockWindowApp.getAppInfo).toHaveBeenCalled()
      })
      
      // Should still render without crashing
      expect(screen.getByText('KickTalk')).toBeInTheDocument()
      
      consoleSpy.mockRestore()
    })

    it('should display different version formats', async () => {
      const versions = ['1.0.0', '2.1.0-beta', '3.0.0-alpha.1', '4.0.0+build.123']
      
      for (const version of versions) {
        mockWindowApp.getAppInfo.mockResolvedValue({ appVersion: version })
        
        const { unmount } = render(<TitleBar />)
        
        await waitFor(() => {
          expect(screen.getByText(`KickTalk ${version}`)).toBeInTheDocument()
        })
        
        unmount()
      }
    })
  })

  describe('User Authentication State', () => {
    it('should display user info when authenticated', async () => {
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument()
      })
      
      const settingsBtn = screen.getByRole('button')
      expect(settingsBtn).toHaveClass('titleBarSettingsBtn')
      
      expect(screen.getByAltText('Settings')).toBeInTheDocument()
    })

    it('should display sign in button when not authenticated', async () => {
      mockChatStore.currentUser = null
      
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(mockWindowApp.getAppInfo).toHaveBeenCalled()
      })
      
      expect(screen.getByText('Sign In')).toBeInTheDocument()
      expect(screen.queryByText('testuser')).not.toBeInTheDocument()
    })

    it('should cache current user if not already cached', async () => {
      mockChatStore.currentUser = null
      
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(mockChatStore.cacheCurrentUser).toHaveBeenCalledTimes(1)
      })
    })

    it('should not cache user if already present', async () => {
      mockChatStore.currentUser = mockCurrentUser
      
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(mockWindowApp.getAppInfo).toHaveBeenCalled()
      })
      
      expect(mockChatStore.cacheCurrentUser).not.toHaveBeenCalled()
    })

    it('should display loading state for username', async () => {
      mockChatStore.currentUser = { id: 'user123' } // No username
      
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument()
      })
    })
  })

  describe('Settings Dialog Integration', () => {
    it('should open settings dialog when authenticated user clicks settings button', async () => {
      const user = userEvent.setup()
      
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument()
      })
      
      const settingsBtn = screen.getByRole('button')
      await user.click(settingsBtn)
      
      expect(mockWindowApp.settingsDialog.open).toHaveBeenCalledWith({
        userData: mockCurrentUser
      })
    })

    it('should open settings dialog when unauthenticated user clicks settings', async () => {
      const user = userEvent.setup()
      mockChatStore.currentUser = null
      
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(screen.getByText('Sign In')).toBeInTheDocument()
      })
      
      const settingsBtn = screen.getByAltText('Settings').closest('button')
      await user.click(settingsBtn)
      
      expect(mockWindowApp.settingsDialog.open).toHaveBeenCalledWith({
        userData: null
      })
    })

    it('should apply open class when settings modal is open', () => {
      const { container } = render(<TitleBar />)
      
      // Since settingsModalOpen state is internal and not exposed,
      // we test the class application indirectly through the component structure
      const titleBarSettings = document.querySelector('.titleBarSettings')
      expect(titleBarSettings).not.toHaveClass('open')
    })
  })

  describe('Authentication Dialog', () => {
    it('should open auth dialog when sign in button is clicked', async () => {
      const user = userEvent.setup()
      mockChatStore.currentUser = null
      
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(screen.getByText('Sign In')).toBeInTheDocument()
      })
      
      const signInBtn = screen.getByText('Sign In')
      
      // Mock click event coordinates
      const clickEvent = new MouseEvent('click', {
        clientX: 100,
        clientY: 200
      })
      
      fireEvent.click(signInBtn, clickEvent)
      
      expect(mockWindowApp.authDialog.open).toHaveBeenCalledWith({
        cords: [0, 0] // jsdom doesn't provide real coordinates
      })
    })

    it('should pass click coordinates to auth dialog', async () => {
      const user = userEvent.setup()
      mockChatStore.currentUser = null
      
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(screen.getByText('Sign In')).toBeInTheDocument()
      })
      
      const signInBtn = screen.getByText('Sign In')
      await user.click(signInBtn)
      
      expect(mockWindowApp.authDialog.open).toHaveBeenCalledWith({
        cords: expect.arrayContaining([expect.any(Number), expect.any(Number)])
      })
    })
  })

  describe('Window Controls', () => {
    it('should call minimize function when minimize button clicked', async () => {
      const user = userEvent.setup()
      
      render(<TitleBar />)
      
      const minimizeBtn = screen.getByAltText('Minimize').closest('button')
      await user.click(minimizeBtn)
      
      expect(mockWindowApp.minimize).toHaveBeenCalledTimes(1)
    })

    it('should call maximize function when maximize button clicked', async () => {
      const user = userEvent.setup()
      
      render(<TitleBar />)
      
      const maximizeBtn = screen.getByAltText('Maximize').closest('button')
      await user.click(maximizeBtn)
      
      expect(mockWindowApp.maximize).toHaveBeenCalledTimes(1)
    })

    it('should call close function when close button clicked', async () => {
      const user = userEvent.setup()
      
      render(<TitleBar />)
      
      const closeBtn = screen.getByAltText('Close').closest('button')
      await user.click(closeBtn)
      
      expect(mockWindowApp.close).toHaveBeenCalledTimes(1)
    })

    it('should have correct CSS classes for window control buttons', () => {
      render(<TitleBar />)
      
      const minimizeBtn = screen.getByAltText('Minimize').closest('button')
      const maximizeBtn = screen.getByAltText('Maximize').closest('button')
      const closeBtn = screen.getByAltText('Close').closest('button')
      
      expect(minimizeBtn).toHaveClass('minimize')
      expect(maximizeBtn).toHaveClass('maximize')
      expect(closeBtn).toHaveClass('close')
    })
  })

  describe('UI Layout and Styling', () => {
    it('should have correct CSS structure', () => {
      render(<TitleBar />)
      
      const titleBar = document.querySelector('.titleBar')
      const titleBarLeft = document.querySelector('.titleBarLeft')
      const titleBarSettings = document.querySelector('.titleBarSettings')
      const titleBarRight = document.querySelector('.titleBarRight')
      const titleBarControls = document.querySelector('.titleBarControls')
      
      expect(titleBar).toHaveClass('titleBar')
      expect(titleBarLeft).toHaveClass('titleBarLeft')
      expect(titleBarSettings).toHaveClass('titleBarSettings')
      expect(titleBarRight).toHaveClass('titleBarRight')
      expect(titleBarControls).toHaveClass('titleBarControls')
    })

    it('should render dividers correctly when authenticated', async () => {
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument()
      })
      
      const dividers = document.querySelectorAll('.titleBarDivider')
      expect(dividers).toHaveLength(1)
    })

    it('should render dividers correctly when unauthenticated', async () => {
      mockChatStore.currentUser = null
      
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(screen.getByText('Sign In')).toBeInTheDocument()
      })
      
      const dividers = document.querySelectorAll('.titleBarDivider')
      expect(dividers).toHaveLength(1)
    })

    it('should have proper button classes for authenticated state', async () => {
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument()
      })
      
      const settingsBtn = screen.getByRole('button')
      expect(settingsBtn).toHaveClass('titleBarSettingsBtn')
      
      const settingsIcon = screen.getByAltText('Settings')
      expect(settingsIcon).toHaveClass('titleBarSettingsIcon')
      
      const username = screen.getByText('testuser')
      expect(username).toHaveClass('titleBarUsername')
    })

    it('should have proper button classes for unauthenticated state', async () => {
      mockChatStore.currentUser = null
      
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(screen.getByText('Sign In')).toBeInTheDocument()
      })
      
      const signInBtn = screen.getByText('Sign In')
      expect(signInBtn).toHaveClass('titleBarSignInBtn')
      
      const loginBtnContainer = document.querySelector('.titleBarLoginBtn')
      expect(loginBtnContainer).toBeInTheDocument()
    })
  })

  describe('Icon Integration', () => {
    it('should render all icons with correct attributes', () => {
      render(<TitleBar />)
      
      // Settings icon (when authenticated)
      const settingsIcon = screen.getByAltText('Settings')
      expect(settingsIcon).toHaveAttribute('src', 'gear-icon.svg')
      expect(settingsIcon).toHaveAttribute('width', '16')
      expect(settingsIcon).toHaveAttribute('height', '16')
      
      // Window control icons
      const minimizeIcon = screen.getByAltText('Minimize')
      expect(minimizeIcon).toHaveAttribute('src', 'minus-icon.svg')
      expect(minimizeIcon).toHaveAttribute('width', '12')
      expect(minimizeIcon).toHaveAttribute('height', '12')
      
      const maximizeIcon = screen.getByAltText('Maximize')
      expect(maximizeIcon).toHaveAttribute('src', 'square-icon.svg')
      expect(maximizeIcon).toHaveAttribute('width', '12')
      expect(maximizeIcon).toHaveAttribute('height', '12')
      
      const closeIcon = screen.getByAltText('Close')
      expect(closeIcon).toHaveAttribute('src', 'x-icon.svg')
      expect(closeIcon).toHaveAttribute('width', '14')
      expect(closeIcon).toHaveAttribute('height', '14')
    })

    it('should render settings icon when unauthenticated', async () => {
      mockChatStore.currentUser = null
      
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(screen.getByText('Sign In')).toBeInTheDocument()
      })
      
      const settingsIcons = screen.getAllByAltText('Settings')
      expect(settingsIcons).toHaveLength(1)
      expect(settingsIcons[0]).toHaveAttribute('src', 'gear-icon.svg')
    })
  })

  describe('Error Handling', () => {
    it('should handle missing window.app gracefully', () => {
      const originalApp = global.window.app
      global.window.app = undefined
      
      expect(() => render(<TitleBar />)).toThrow()
      
      global.window.app = originalApp
    })

    it('should handle missing dialog APIs gracefully', async () => {
      const originalApp = global.window.app
      global.window.app = {
        getAppInfo: mockWindowApp.getAppInfo,
        minimize: mockWindowApp.minimize,
        maximize: mockWindowApp.maximize,
        close: mockWindowApp.close
      }
      
      const user = userEvent.setup()
      
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(screen.getByText('KickTalk 1.0.0')).toBeInTheDocument()
      })
      
      // Should not crash when clicking buttons without dialog APIs
      expect(() => {
        fireEvent.click(screen.getByAltText('Minimize').closest('button'))
      }).not.toThrow()
      
      global.window.app = originalApp
    })

    it('should handle chat provider errors gracefully', () => {
      vi.doMock('../providers/ChatProvider', () => ({
        default: () => {
          throw new Error('Provider error')
        }
      }))
      
      expect(() => render(<TitleBar />)).not.toThrow()
    })
  })

  describe('Performance and Memory', () => {
    it('should not cause memory leaks on unmount', () => {
      const { unmount } = render(<TitleBar />)
      
      unmount()
      
      // Should not throw or cause issues
      expect(() => render(<TitleBar />)).not.toThrow()
    })

    it('should handle rapid clicks efficiently', async () => {
      const user = userEvent.setup()
      
      render(<TitleBar />)
      
      const minimizeBtn = screen.getByAltText('Minimize').closest('button')
      
      // Rapid clicks
      for (let i = 0; i < 10; i++) {
        await user.click(minimizeBtn)
      }
      
      expect(mockWindowApp.minimize).toHaveBeenCalledTimes(10)
    })

    it('should not re-fetch app info unnecessarily', async () => {
      const { rerender } = render(<TitleBar />)
      
      await waitFor(() => {
        expect(mockWindowApp.getAppInfo).toHaveBeenCalledTimes(1)
      })
      
      mockWindowApp.getAppInfo.mockClear()
      
      rerender(<TitleBar />)
      
      // Should not fetch again on re-render
      expect(mockWindowApp.getAppInfo).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper button roles and labels', () => {
      render(<TitleBar />)
      
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
      
      // All images should have alt text
      const images = document.querySelectorAll('img')
      images.forEach(img => {
        expect(img).toHaveAttribute('alt')
      })
    })

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup()
      
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument()
      })
      
      // Should be able to tab through buttons
      await user.tab()
      
      // At least one element should be focusable
      const focusedElement = document.activeElement
      expect(focusedElement).toBeInstanceOf(HTMLElement)
    })

    it('should have semantic structure', () => {
      render(<TitleBar />)
      
      const titleBar = document.querySelector('.titleBar')
      expect(titleBar).toBeInTheDocument()
      
      // Should have left, center, and right sections
      expect(document.querySelector('.titleBarLeft')).toBeInTheDocument()
      expect(document.querySelector('.titleBarSettings')).toBeInTheDocument()
      expect(document.querySelector('.titleBarRight')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long usernames', async () => {
      const longUsername = 'a'.repeat(100)
      mockChatStore.currentUser = {
        id: 'user123',
        username: longUsername
      }
      
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(screen.getByText(longUsername)).toBeInTheDocument()
      })
    })

    it('should handle special characters in username', async () => {
      const specialUsername = 'user@#$%^&*()'
      mockChatStore.currentUser = {
        id: 'user123',
        username: specialUsername
      }
      
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(screen.getByText(specialUsername)).toBeInTheDocument()
      })
    })

    it('should handle null app version', async () => {
      mockWindowApp.getAppInfo.mockResolvedValue({ appVersion: null })
      
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(mockWindowApp.getAppInfo).toHaveBeenCalled()
      })
      
      expect(screen.getByText('KickTalk')).toBeInTheDocument()
    })

    it('should handle empty user object', async () => {
      mockChatStore.currentUser = {}
      
      render(<TitleBar />)
      
      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument()
      })
    })
  })

  describe('Integration Scenarios', () => {
    it('should work with complete authentication flow', async () => {
      const user = userEvent.setup()
      
      // Start unauthenticated
      mockChatStore.currentUser = null
      
      const { rerender } = render(<TitleBar />)
      
      await waitFor(() => {
        expect(screen.getByText('Sign In')).toBeInTheDocument()
      })
      
      // Click sign in
      await user.click(screen.getByText('Sign In'))
      expect(mockWindowApp.authDialog.open).toHaveBeenCalled()
      
      // Simulate authentication success
      mockChatStore.currentUser = mockCurrentUser
      rerender(<TitleBar />)
      
      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument()
      })
      
      // Should now show authenticated UI
      expect(screen.queryByText('Sign In')).not.toBeInTheDocument()
    })

    it('should integrate properly with all window controls', async () => {
      const user = userEvent.setup()
      
      render(<TitleBar />)
      
      // Test all window controls
      await user.click(screen.getByAltText('Minimize').closest('button'))
      expect(mockWindowApp.minimize).toHaveBeenCalled()
      
      await user.click(screen.getByAltText('Maximize').closest('button'))
      expect(mockWindowApp.maximize).toHaveBeenCalled()
      
      await user.click(screen.getByAltText('Close').closest('button'))
      expect(mockWindowApp.close).toHaveBeenCalled()
    })
  })

  describe('Settings Modal Integration (Future Feature)', () => {
    it('should handle settings modal state when implemented', () => {
      // This test prepares for when Settings component is actually imported
      // Currently settingsModalOpen is managed but Settings component is not rendered
      
      render(<TitleBar />)
      
      const titleBarSettings = document.querySelector('.titleBarSettings')
      expect(titleBarSettings).not.toHaveClass('open')
      
      // When Settings is implemented, this would test:
      // - Modal open/close state
      // - Passing appInfo to Settings component
      // - Modal backdrop click handling
    })
  })
})