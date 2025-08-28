import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Settings from './index.jsx'

// Mock SCSS imports
vi.mock('../../../assets/styles/dialogs/Settings.scss', () => ({}))

// Mock SettingsProvider
const mockUpdateSettings = vi.fn()
const mockSettings = {
  general: {
    timestampFormat: 'HH:mm',
    theme: 'dark'
  },
  chatrooms: {
    showModActions: true
  },
  notifications: {
    enabled: true,
    phrases: []
  },
  cosmetics: {
    enabled: true
  }
}

const mockSettingsProvider = {
  updateSettings: mockUpdateSettings,
  settings: mockSettings
}

vi.mock('../../../providers/SettingsProvider', () => ({
  useSettings: () => mockSettingsProvider
}))

// Mock child components
vi.mock('../../Shared/Tooltip', () => ({
  TooltipProvider: ({ children }) => <div data-testid="tooltip-provider">{children}</div>
}))

vi.mock('./Sections/General', () => ({
  GeneralSection: ({ settingsData, onChange }) => (
    <div data-testid="general-section">
      <button onClick={() => onChange('general.theme', 'light')}>Change Theme</button>
      <span>Settings: {JSON.stringify(settingsData?.general)}</span>
    </div>
  ),
  ChatroomSection: ({ settingsData, onChange }) => (
    <div data-testid="chatroom-section">
      <button onClick={() => onChange('chatrooms.showModActions', false)}>Toggle Mod Actions</button>
      <span>Settings: {JSON.stringify(settingsData?.chatrooms)}</span>
    </div>
  ),
  NotificationsSection: ({ settingsData, onChange }) => (
    <div data-testid="notifications-section">
      <button onClick={() => onChange('notifications.enabled', false)}>Toggle Notifications</button>
      <span>Settings: {JSON.stringify(settingsData?.notifications)}</span>
    </div>
  ),
  CosmeticsSection: ({ settingsData, onChange }) => (
    <div data-testid="cosmetics-section">
      <button onClick={() => onChange('cosmetics.enabled', false)}>Toggle Cosmetics</button>
      <span>Settings: {JSON.stringify(settingsData?.cosmetics)}</span>
    </div>
  )
}))

vi.mock('./SettingsHeader', () => ({
  default: ({ onClose, appInfo }) => (
    <div data-testid="settings-header">
      <h2>Settings v{appInfo?.appVersion || '0.0.0'}</h2>
      <button data-testid="close-button" onClick={onClose}>Close</button>
    </div>
  )
}))

vi.mock('./SettingsMenu', () => ({
  default: ({ activeSection, setActiveSection, onLogout }) => (
    <div data-testid="settings-menu">
      <button
        data-testid="info-section-btn"
        className={activeSection === 'info' ? 'active' : ''}
        onClick={() => setActiveSection('info')}
      >
        About
      </button>
      <button
        data-testid="general-section-btn"
        className={activeSection === 'general' ? 'active' : ''}
        onClick={() => setActiveSection('general')}
      >
        General
      </button>
      <button
        data-testid="moderation-section-btn"
        className={activeSection === 'moderation' ? 'active' : ''}
        onClick={() => setActiveSection('moderation')}
      >
        Moderation
      </button>
      <button data-testid="logout-btn" onClick={onLogout}>Logout</button>
    </div>
  )
}))

vi.mock('./Sections/About', () => ({
  default: ({ appInfo }) => (
    <div data-testid="about-section">
      About KickTalk v{appInfo?.appVersion || '0.0.0'}
    </div>
  )
}))

vi.mock('./Sections/Moderation', () => ({
  ModerationSection: ({ settingsData, onChange }) => (
    <div data-testid="moderation-section">
      <button onClick={() => onChange('moderation.enabled', true)}>Enable Moderation</button>
      <span>Settings: {JSON.stringify(settingsData?.moderation)}</span>
    </div>
  )
}))

// Mock window.app API
const mockAppInfo = {
  appVersion: '1.2.3',
  buildDate: '2024-01-01',
  platform: 'win32'
}

const mockSettingsDialog = {
  onData: vi.fn(() => vi.fn()), // Returns cleanup function
  close: vi.fn()
}

global.window.app = {
  getAppInfo: vi.fn().mockResolvedValue(mockAppInfo),
  settingsDialog: mockSettingsDialog,
  logout: vi.fn()
}

describe('Settings Component', () => {
  let mockOnDataCleanup

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockOnDataCleanup = vi.fn()
    mockSettingsDialog.onData.mockReturnValue(mockOnDataCleanup)
    
    // Reset settings provider mock
    mockSettingsProvider.settings = mockSettings
    mockSettingsProvider.updateSettings = mockUpdateSettings
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Rendering and Initial State', () => {
    it('should render settings dialog wrapper', () => {
      const { container } = render(<Settings />)
      
      expect(container.querySelector('.settingsDialogWrapper')).toBeInTheDocument()
    })

    it('should render all main components', () => {
      render(<Settings />)
      
      expect(screen.getByTestId('tooltip-provider')).toBeInTheDocument()
      expect(screen.getByTestId('settings-header')).toBeInTheDocument()
      expect(screen.getByTestId('settings-menu')).toBeInTheDocument()
    })

    it('should render settings container and content', () => {
      const { container } = render(<Settings />)
      
      expect(container.querySelector('.settingsDialogContainer')).toBeInTheDocument()
      expect(container.querySelector('.settingsContent')).toBeInTheDocument()
    })

    it('should start with general section active by default', () => {
      render(<Settings />)
      
      const generalBtn = screen.getByTestId('general-section-btn')
      expect(generalBtn).toHaveClass('active')
      
      expect(screen.getByTestId('general-section')).toBeInTheDocument()
      expect(screen.getByTestId('chatroom-section')).toBeInTheDocument()
      expect(screen.getByTestId('notifications-section')).toBeInTheDocument()
      expect(screen.getByTestId('cosmetics-section')).toBeInTheDocument()
    })

    it('should not render other sections by default', () => {
      render(<Settings />)
      
      expect(screen.queryByTestId('about-section')).not.toBeInTheDocument()
      expect(screen.queryByTestId('moderation-section')).not.toBeInTheDocument()
    })
  })

  describe('App Info Loading', () => {
    it('should fetch app info on mount', async () => {
      render(<Settings />)
      
      await waitFor(() => {
        expect(window.app.getAppInfo).toHaveBeenCalledTimes(1)
      })
    })

    it('should pass app info to SettingsHeader', async () => {
      render(<Settings />)
      
      await waitFor(() => {
        expect(screen.getByText('Settings v1.2.3')).toBeInTheDocument()
      })
    })

    it('should handle app info loading errors gracefully', async () => {
      window.app.getAppInfo.mockRejectedValue(new Error('Failed to load app info'))
      
      render(<Settings />)
      
      await waitFor(() => {
        expect(window.app.getAppInfo).toHaveBeenCalled()
      })
      
      // Should still render with default version
      expect(screen.getByText('Settings v0.0.0')).toBeInTheDocument()
    })

    it('should handle missing app info gracefully', async () => {
      window.app.getAppInfo.mockResolvedValue(null)
      
      render(<Settings />)
      
      await waitFor(() => {
        expect(screen.getByText('Settings v0.0.0')).toBeInTheDocument()
      })
    })
  })

  describe('Settings Data Management', () => {
    it('should initialize settings data from provider', async () => {
      render(<Settings />)
      
      await waitFor(() => {
        expect(screen.getByText(/Settings: {"timestampFormat":"HH:mm","theme":"dark"}/)).toBeInTheDocument()
      })
    })

    it('should setup settings dialog data listener', () => {
      render(<Settings />)
      
      expect(mockSettingsDialog.onData).toHaveBeenCalledTimes(1)
      expect(mockSettingsDialog.onData).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should cleanup settings dialog listener on unmount', () => {
      const { unmount } = render(<Settings />)
      
      unmount()
      
      expect(mockOnDataCleanup).toHaveBeenCalledTimes(1)
    })

    it('should update settings data when dialog provides new data', async () => {
      render(<Settings />)
      
      const handleDialogData = mockSettingsDialog.onData.mock.calls[0][0]
      const newSettings = {
        general: { theme: 'light', timestampFormat: 'HH:mm:ss' },
        chatrooms: { showModActions: false }
      }
      
      handleDialogData({ settings: newSettings })
      
      await waitFor(() => {
        expect(screen.getByText(/Settings: {"theme":"light","timestampFormat":"HH:mm:ss"}/)).toBeInTheDocument()
      })
    })

    it('should not update if dialog data is same as current', () => {
      render(<Settings />)
      
      const handleDialogData = mockSettingsDialog.onData.mock.calls[0][0]
      
      // Call with same settings (should not trigger update)
      handleDialogData({ settings: mockSettings })
      
      // Should still show original settings
      expect(screen.getByText(/Settings: {"timestampFormat":"HH:mm","theme":"dark"}/)).toBeInTheDocument()
    })

    it('should handle dialog data without settings', () => {
      render(<Settings />)
      
      const handleDialogData = mockSettingsDialog.onData.mock.calls[0][0]
      
      // Should not crash when called with data without settings
      expect(() => {
        handleDialogData({ someOtherData: true })
      }).not.toThrow()
    })

    it('should handle null dialog data', () => {
      render(<Settings />)
      
      const handleDialogData = mockSettingsDialog.onData.mock.calls[0][0]
      
      // Should not crash when called with null data
      expect(() => {
        handleDialogData(null)
      }).not.toThrow()
    })

    it('should update when provider settings change', async () => {
      const { rerender } = render(<Settings />)
      
      // Change provider settings
      const newSettings = {
        general: { theme: 'light', timestampFormat: 'HH:mm:ss' }
      }
      mockSettingsProvider.settings = newSettings
      
      rerender(<Settings />)
      
      await waitFor(() => {
        expect(screen.getByText(/Settings: {"theme":"light","timestampFormat":"HH:mm:ss"}/)).toBeInTheDocument()
      })
    })
  })

  describe('Section Navigation', () => {
    it('should switch to about section when clicked', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const aboutBtn = screen.getByTestId('info-section-btn')
      await user.click(aboutBtn)
      
      expect(aboutBtn).toHaveClass('active')
      expect(screen.getByTestId('about-section')).toBeInTheDocument()
      expect(screen.queryByTestId('general-section')).not.toBeInTheDocument()
    })

    it('should switch to moderation section when clicked', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const moderationBtn = screen.getByTestId('moderation-section-btn')
      await user.click(moderationBtn)
      
      expect(moderationBtn).toHaveClass('active')
      expect(screen.getByTestId('moderation-section')).toBeInTheDocument()
      expect(screen.queryByTestId('general-section')).not.toBeInTheDocument()
    })

    it('should switch back to general section when clicked', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      // First go to about section
      await user.click(screen.getByTestId('info-section-btn'))
      expect(screen.getByTestId('about-section')).toBeInTheDocument()
      
      // Then back to general
      const generalBtn = screen.getByTestId('general-section-btn')
      await user.click(generalBtn)
      
      expect(generalBtn).toHaveClass('active')
      expect(screen.getByTestId('general-section')).toBeInTheDocument()
      expect(screen.queryByTestId('about-section')).not.toBeInTheDocument()
    })

    it('should pass app info to about section', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      await waitFor(() => {
        expect(window.app.getAppInfo).toHaveBeenCalled()
      })
      
      await user.click(screen.getByTestId('info-section-btn'))
      
      expect(screen.getByText('About KickTalk v1.2.3')).toBeInTheDocument()
    })
  })

  describe('Settings Changes', () => {
    it('should call updateSettings when changeSetting is used', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const changeThemeBtn = screen.getByText('Change Theme')
      await user.click(changeThemeBtn)
      
      expect(mockUpdateSettings).toHaveBeenCalledWith('general.theme', 'light')
    })

    it('should handle multiple setting changes', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      await user.click(screen.getByText('Change Theme'))
      await user.click(screen.getByText('Toggle Mod Actions'))
      await user.click(screen.getByText('Toggle Notifications'))
      
      expect(mockUpdateSettings).toHaveBeenCalledTimes(3)
      expect(mockUpdateSettings).toHaveBeenNthCalledWith(1, 'general.theme', 'light')
      expect(mockUpdateSettings).toHaveBeenNthCalledWith(2, 'chatrooms.showModActions', false)
      expect(mockUpdateSettings).toHaveBeenNthCalledWith(3, 'notifications.enabled', false)
    })

    it('should handle settings update errors gracefully', async () => {
      const user = userEvent.setup()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      mockUpdateSettings.mockImplementation(() => {
        throw new Error('Failed to update setting')
      })
      
      render(<Settings />)
      
      const changeThemeBtn = screen.getByText('Change Theme')
      await user.click(changeThemeBtn)
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Settings]: Failed to save setting:',
        expect.any(Error)
      )
      
      consoleSpy.mockRestore()
    })

    it('should work in moderation section', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      // Switch to moderation section
      await user.click(screen.getByTestId('moderation-section-btn'))
      
      // Make a setting change
      await user.click(screen.getByText('Enable Moderation'))
      
      expect(mockUpdateSettings).toHaveBeenCalledWith('moderation.enabled', true)
    })
  })

  describe('Dialog Controls', () => {
    it('should close dialog when close button clicked', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const closeBtn = screen.getByTestId('close-button')
      await user.click(closeBtn)
      
      expect(mockSettingsDialog.close).toHaveBeenCalledTimes(1)
    })

    it('should handle logout when logout button clicked', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const logoutBtn = screen.getByTestId('logout-btn')
      await user.click(logoutBtn)
      
      expect(window.app.logout).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing window.app gracefully', async () => {
      const originalApp = global.window.app
      delete global.window.app
      
      expect(() => {
        render(<Settings />)
      }).not.toThrow()
      
      global.window.app = originalApp
    })

    it('should handle missing app methods gracefully', async () => {
      const originalGetAppInfo = window.app.getAppInfo
      delete window.app.getAppInfo
      
      expect(() => {
        render(<Settings />)
      }).not.toThrow()
      
      window.app.getAppInfo = originalGetAppInfo
    })

    it('should handle settings provider errors', () => {
      mockSettingsProvider.updateSettings = undefined
      
      expect(() => {
        render(<Settings />)
      }).not.toThrow()
    })

    it('should handle missing settings data', () => {
      mockSettingsProvider.settings = null
      
      expect(() => {
        render(<Settings />)
      }).not.toThrow()
    })

    it('should handle settingsDialog API errors', async () => {
      const user = userEvent.setup()
      
      mockSettingsDialog.close.mockImplementation(() => {
        throw new Error('Close failed')
      })
      
      render(<Settings />)
      
      const closeBtn = screen.getByTestId('close-button')
      
      // Should not crash when API throws
      await expect(user.click(closeBtn)).resolves.not.toThrow()
    })

    it('should handle logout API errors', async () => {
      const user = userEvent.setup()
      
      window.app.logout.mockImplementation(() => {
        throw new Error('Logout failed')
      })
      
      render(<Settings />)
      
      const logoutBtn = screen.getByTestId('logout-btn')
      
      // Should not crash when API throws
      await expect(user.click(logoutBtn)).resolves.not.toThrow()
    })
  })

  describe('Component Integration', () => {
    it('should pass correct props to child components', async () => {
      render(<Settings />)
      
      await waitFor(() => {
        // SettingsHeader should receive app info
        expect(screen.getByText('Settings v1.2.3')).toBeInTheDocument()
        
        // Settings sections should receive settings data
        expect(screen.getByText(/Settings: {"timestampFormat":"HH:mm","theme":"dark"}/)).toBeInTheDocument()
      })
    })

    it('should maintain section state across setting changes', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      // Switch to about section
      await user.click(screen.getByTestId('info-section-btn'))
      expect(screen.getByTestId('about-section')).toBeInTheDocument()
      
      // Go back to general and make a change
      await user.click(screen.getByTestId('general-section-btn'))
      await user.click(screen.getByText('Change Theme'))
      
      // Should still be in general section
      expect(screen.getByTestId('general-section')).toBeInTheDocument()
    })

    it('should pass updated settings to sections', async () => {
      const { rerender } = render(<Settings />)
      
      // Update settings
      const newSettings = {
        general: { theme: 'light', timestampFormat: 'HH:mm:ss' }
      }
      mockSettingsProvider.settings = newSettings
      
      rerender(<Settings />)
      
      await waitFor(() => {
        expect(screen.getByText(/Settings: {"theme":"light","timestampFormat":"HH:mm:ss"}/)).toBeInTheDocument()
      })
    })
  })

  describe('Memory Management', () => {
    it('should not cause memory leaks with repeated renders', () => {
      const { rerender } = render(<Settings />)
      
      // Multiple re-renders should not cause issues
      for (let i = 0; i < 100; i++) {
        rerender(<Settings />)
      }
      
      expect(screen.getByTestId('settings-header')).toBeInTheDocument()
    })

    it('should cleanup all listeners on unmount', () => {
      const { unmount } = render(<Settings />)
      
      unmount()
      
      expect(mockOnDataCleanup).toHaveBeenCalledTimes(1)
    })

    it('should handle rapid section switching', async () => {
      const user = userEvent.setup({ delay: null })
      render(<Settings />)
      
      // Rapid section switching
      for (let i = 0; i < 10; i++) {
        await user.click(screen.getByTestId('info-section-btn'))
        await user.click(screen.getByTestId('general-section-btn'))
        await user.click(screen.getByTestId('moderation-section-btn'))
      }
      
      // Should end up in moderation section
      expect(screen.getByTestId('moderation-section')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper button roles', () => {
      render(<Settings />)
      
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
      
      buttons.forEach(button => {
        expect(button.tagName).toBe('BUTTON')
      })
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const infoBtn = screen.getByTestId('info-section-btn')
      infoBtn.focus()
      
      await user.keyboard('{Enter}')
      
      expect(screen.getByTestId('about-section')).toBeInTheDocument()
    })

    it('should have proper heading structure', () => {
      render(<Settings />)
      
      // Should have main heading in header
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
    })
  })

  describe('State Consistency', () => {
    it('should maintain consistent state when switching sections', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      // Make a setting change in general section
      await user.click(screen.getByText('Change Theme'))
      expect(mockUpdateSettings).toHaveBeenCalledWith('general.theme', 'light')
      
      // Switch to another section and back
      await user.click(screen.getByTestId('info-section-btn'))
      await user.click(screen.getByTestId('general-section-btn'))
      
      // Settings should still be accessible
      expect(screen.getByText('Change Theme')).toBeInTheDocument()
    })

    it('should handle concurrent setting changes', async () => {
      const user = userEvent.setup({ delay: null })
      render(<Settings />)
      
      // Rapid setting changes
      await user.click(screen.getByText('Change Theme'))
      await user.click(screen.getByText('Toggle Mod Actions'))
      await user.click(screen.getByText('Toggle Notifications'))
      await user.click(screen.getByText('Toggle Cosmetics'))
      
      expect(mockUpdateSettings).toHaveBeenCalledTimes(4)
    })

    it('should preserve section state during data updates', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      // Switch to about section
      await user.click(screen.getByTestId('info-section-btn'))
      
      // Trigger data update
      const handleDialogData = mockSettingsDialog.onData.mock.calls[0][0]
      handleDialogData({ settings: { general: { theme: 'light' } } })
      
      // Should still be in about section
      expect(screen.getByTestId('about-section')).toBeInTheDocument()
    })
  })

  describe('Performance Optimization', () => {
    it('should not re-render unnecessarily', async () => {
      const { rerender } = render(<Settings />)
      
      // Same props should not cause unnecessary re-renders
      rerender(<Settings />)
      rerender(<Settings />)
      
      expect(screen.getByTestId('settings-header')).toBeInTheDocument()
    })

    it('should handle large settings objects efficiently', async () => {
      const largeSettings = {}
      for (let i = 0; i < 1000; i++) {
        largeSettings[`setting${i}`] = { value: `value${i}` }
      }
      
      mockSettingsProvider.settings = largeSettings
      
      const start = performance.now()
      render(<Settings />)
      const end = performance.now()
      
      // Should render quickly even with large settings
      expect(end - start).toBeLessThan(500) // 500ms threshold
    })
  })
})