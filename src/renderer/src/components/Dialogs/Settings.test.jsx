import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Settings from './Settings.jsx'

// Mock SCSS imports
vi.mock('../../assets/styles/dialogs/Settings.scss', () => ({}))

// Mock static assets
vi.mock('../../assets/icons/x-bold.svg?asset', () => ({ default: 'x-icon.svg' }))
vi.mock('../../assets/icons/info-fill.svg?asset', () => ({ default: 'info-icon.svg' }))
vi.mock('../../assets/logos/KickTalkLogo.svg?asset', () => ({ default: 'kicktalk-logo.svg' }))
vi.mock('../../assets/icons/sign-out-bold.svg?asset', () => ({ default: 'sign-out-icon.svg' }))
vi.mock('../../assets/app/darkProfilePic.jpg', () => ({ default: 'dark-profile.jpg' }))
vi.mock('../../assets/app/ftk789ProfilePic.jpg', () => ({ default: 'ftk-profile.jpg' }))
vi.mock('../../assets/logos/XLogo.svg?asset', () => ({ default: 'x-logo.svg' }))
vi.mock('../../assets/logos/kickLogoIcon.svg?asset', () => ({ default: 'kick-logo-icon.svg' }))

// Mock SettingsProvider
const mockUpdateSettings = vi.fn()
const mockSettings = {
  general: {
    alwaysOnTop: false,
    wrapChatroomsList: true,
    showTabImages: true,
    showTimestamps: false,
    timestampFormat: 'h:mm a'
  },
  chatrooms: {
    showModActions: true
  },
  notifications: {
    enabled: false,
    sound: true,
    volume: 0.5,
    background: false,
    backgroundColour: '#ff0000',
    phrases: ['test phrase', 'another phrase']
  },
  sevenTV: {
    emotes: true,
    paints: false,
    badges: false
  }
}

vi.mock('../../providers/SettingsProvider', () => ({
  useSettings: () => ({
    updateSettings: mockUpdateSettings,
    settings: mockSettings
  })
}))

// Mock child components
vi.mock('../Shared/Switch', () => ({
  Switch: ({ checked, onCheckedChange, disabled }) => (
    <button
      data-testid="switch"
      data-checked={checked}
      data-disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
    >
      {checked ? 'ON' : 'OFF'}
    </button>
  )
}))

vi.mock('../Shared/Slider', () => ({
  Slider: ({ defaultValue, onValueChange, disabled, min, max, step, showTooltip }) => (
    <input
      data-testid="slider"
      type="range"
      defaultValue={defaultValue?.[0] || 0}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      data-show-tooltip={showTooltip}
      onChange={(e) => onValueChange([parseFloat(e.target.value)])}
    />
  )
}))

vi.mock('../Shared/Tooltip', () => ({
  TooltipProvider: ({ children }) => <div data-testid="tooltip-provider">{children}</div>,
  Tooltip: ({ children, delayDuration }) => <div data-testid="tooltip" data-delay={delayDuration}>{children}</div>,
  TooltipTrigger: ({ children, asChild }) => (
    asChild ? children : <div data-testid="tooltip-trigger">{children}</div>
  ),
  TooltipContent: ({ children }) => <div data-testid="tooltip-content">{children}</div>
}))

vi.mock('../Shared/ColorPicker', () => ({
  default: ({ initialColor, isColorPickerOpen, setIsColorPickerOpen, handleColorChange, disabled }) => (
    <div data-testid="color-picker">
      <button
        data-testid="color-picker-button"
        disabled={disabled}
        onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
        style={{ backgroundColor: initialColor }}
      >
        Color Picker
      </button>
      {isColorPickerOpen && (
        <input
          data-testid="color-input"
          type="color"
          value={initialColor}
          onChange={(e) => handleColorChange(e.target.value)}
        />
      )}
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

describe('Settings Dialog Component', () => {
  let mockOnDataCleanup

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockOnDataCleanup = vi.fn()
    mockSettingsDialog.onData.mockReturnValue(mockOnDataCleanup)
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Rendering and Initial State', () => {
    it('should render settings dialog wrapper', () => {
      const { container } = render(<Settings />)
      
      expect(container.querySelector('.settingsDialogWrapper')).toBeInTheDocument()
    })

    it('should render header with title and close button', () => {
      render(<Settings />)
      
      expect(screen.getByText('Settings')).toBeInTheDocument()
      expect(screen.getByAltText('Close')).toBeInTheDocument()
    })

    it('should render all main sections', () => {
      const { container } = render(<Settings />)
      
      expect(container.querySelector('.settingsDialogContainer')).toBeInTheDocument()
      expect(container.querySelector('.settingsMenu')).toBeInTheDocument()
      expect(container.querySelector('.settingsContent')).toBeInTheDocument()
    })

    it('should start with general section active by default', () => {
      render(<Settings />)
      
      const generalButton = screen.getByText('General')
      expect(generalButton.parentElement).toHaveClass('active')
      expect(screen.getByText('Select what general app settings you want to change.')).toBeInTheDocument()
    })

    it('should render tooltip provider', () => {
      render(<Settings />)
      
      expect(screen.getByTestId('tooltip-provider')).toBeInTheDocument()
    })

    it('should render menu items correctly', () => {
      render(<Settings />)
      
      expect(screen.getByText('About KickTalk')).toBeInTheDocument()
      expect(screen.getByText('General')).toBeInTheDocument()
      expect(screen.getByText('Sign Out')).toBeInTheDocument()
    })

    it('should render disabled chat menu items', () => {
      render(<Settings />)
      
      const commandsBtn = screen.getByText('Commands')
      const highlightsBtn = screen.getByText('Highlights')
      const filtersBtn = screen.getByText('Filters')
      
      expect(commandsBtn).toBeDisabled()
      expect(highlightsBtn).toBeDisabled()
      expect(filtersBtn).toBeDisabled()
    })
  })

  describe('App Info Loading', () => {
    it('should fetch app info on mount', async () => {
      render(<Settings />)
      
      await waitFor(() => {
        expect(window.app.getAppInfo).toHaveBeenCalledTimes(1)
      })
    })

    it('should display app version in about section', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      await waitFor(() => {
        expect(window.app.getAppInfo).toHaveBeenCalled()
      })
      
      // Switch to about section
      await user.click(screen.getByText('About KickTalk'))
      
      expect(screen.getByText('1.2.3')).toBeInTheDocument()
    })

    it('should handle app info loading errors gracefully', async () => {
      window.app.getAppInfo.mockRejectedValue(new Error('Failed to load app info'))
      
      const user = userEvent.setup()
      render(<Settings />)
      
      await waitFor(() => {
        expect(window.app.getAppInfo).toHaveBeenCalled()
      })
      
      // Should still be able to switch to about section
      await user.click(screen.getByText('About KickTalk'))
      expect(screen.getByText('About KickTalk')).toBeInTheDocument()
    })

    it('should handle null app info gracefully', async () => {
      window.app.getAppInfo.mockResolvedValue(null)
      
      const user = userEvent.setup()
      render(<Settings />)
      
      await user.click(screen.getByText('About KickTalk'))
      expect(screen.getByText('About KickTalk')).toBeInTheDocument()
    })
  })

  describe('Settings Data Management', () => {
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
      const newSettingsData = {
        userData: { username: 'testuser' },
        settings: {
          general: { alwaysOnTop: true },
          notifications: { enabled: true }
        }
      }
      
      handleDialogData(newSettingsData)
      
      await waitFor(() => {
        // Should show updated settings in UI
        const alwaysOnTopSwitch = screen.getAllByTestId('switch').find(
          switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Always on Top')
        )
        expect(alwaysOnTopSwitch).toHaveAttribute('data-checked', 'true')
      })
    })

    it('should handle dialog data without settings', () => {
      render(<Settings />)
      
      const handleDialogData = mockSettingsDialog.onData.mock.calls[0][0]
      
      // Should not crash when called with data without settings
      expect(() => {
        handleDialogData({ userData: { username: 'test' } })
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
      
      // Mock new settings from provider
      const newMockSettings = {
        ...mockSettings,
        general: { ...mockSettings.general, alwaysOnTop: true }
      }
      
      vi.mocked(require('../../providers/SettingsProvider').useSettings).mockReturnValue({
        updateSettings: mockUpdateSettings,
        settings: newMockSettings
      })
      
      rerender(<Settings />)
      
      await waitFor(() => {
        const alwaysOnTopSwitch = screen.getAllByTestId('switch').find(
          switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Always on Top')
        )
        expect(alwaysOnTopSwitch).toHaveAttribute('data-checked', 'true')
      })
    })
  })

  describe('Section Navigation', () => {
    it('should switch to about section when clicked', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const aboutBtn = screen.getByText('About KickTalk')
      await user.click(aboutBtn)
      
      expect(aboutBtn.parentElement).toHaveClass('active')
      expect(screen.getByText('A chat client for Kick.com.')).toBeInTheDocument()
      expect(screen.getByText('Meet the Creators')).toBeInTheDocument()
    })

    it('should switch back to general section when clicked', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      // First go to about section
      await user.click(screen.getByText('About KickTalk'))
      expect(screen.getByText('Meet the Creators')).toBeInTheDocument()
      
      // Then back to general
      const generalBtn = screen.getByText('General')
      await user.click(generalBtn)
      
      expect(generalBtn.parentElement).toHaveClass('active')
      expect(screen.getByText('Select what general app settings you want to change.')).toBeInTheDocument()
    })

    it('should show developer information in about section', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      await user.click(screen.getByText('About KickTalk'))
      
      expect(screen.getByText('DRKNESS_x')).toBeInTheDocument()
      expect(screen.getByText('ftk789')).toBeInTheDocument()
      expect(screen.getByText('Developer & Designer')).toBeInTheDocument()
      expect(screen.getByText('Developer')).toBeInTheDocument()
    })

    it('should show app version in about section', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      await waitFor(() => {
        expect(window.app.getAppInfo).toHaveBeenCalled()
      })
      
      await user.click(screen.getByText('About KickTalk'))
      
      expect(screen.getByText('Current Version:')).toBeInTheDocument()
      expect(screen.getByText('1.2.3')).toBeInTheDocument()
    })

    it('should show social media links in about section', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      await user.click(screen.getByText('About KickTalk'))
      
      const twitterLinks = screen.getAllByText('Open Twitter')
      const kickLinks = screen.getAllByText('Open Channel')
      
      expect(twitterLinks).toHaveLength(2)
      expect(kickLinks).toHaveLength(2)
      
      // Check href attributes
      expect(twitterLinks[0].closest('a')).toHaveAttribute('href', 'https://x.com/drkerco')
      expect(twitterLinks[1].closest('a')).toHaveAttribute('href', 'https://x.com/ftk789yt')
      expect(kickLinks[0].closest('a')).toHaveAttribute('href', 'https://kick.com/drkness-x')
      expect(kickLinks[1].closest('a')).toHaveAttribute('href', 'https://kick.com/ftk789')
    })
  })

  describe('General Settings', () => {
    it('should render all general setting options', () => {
      render(<Settings />)
      
      expect(screen.getByText('Always on Top')).toBeInTheDocument()
      expect(screen.getByText('Wrap Chatrooms List')).toBeInTheDocument()
      expect(screen.getByText('Show Tab Images')).toBeInTheDocument()
      expect(screen.getByText('Show Timestamps')).toBeInTheDocument()
    })

    it('should show correct initial values for general settings', () => {
      render(<Settings />)
      
      const switches = screen.getAllByTestId('switch')
      const alwaysOnTopSwitch = switches.find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Always on Top')
      )
      const wrapChatroomsSwitch = switches.find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Wrap Chatrooms List')
      )
      const showTabImagesSwitch = switches.find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Show Tab Images')
      )
      const showTimestampsSwitch = switches.find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Show Timestamps')
      )
      
      expect(alwaysOnTopSwitch).toHaveAttribute('data-checked', 'false')
      expect(wrapChatroomsSwitch).toHaveAttribute('data-checked', 'true')
      expect(showTabImagesSwitch).toHaveAttribute('data-checked', 'true')
      expect(showTimestampsSwitch).toHaveAttribute('data-checked', 'false')
    })

    it('should update always on top setting', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const alwaysOnTopSwitch = screen.getAllByTestId('switch').find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Always on Top')
      )
      
      await user.click(alwaysOnTopSwitch)
      
      expect(mockUpdateSettings).toHaveBeenCalledWith('general', {
        ...mockSettings.general,
        alwaysOnTop: true
      })
    })

    it('should update wrap chatrooms list setting', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const wrapChatroomsSwitch = screen.getAllByTestId('switch').find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Wrap Chatrooms List')
      )
      
      await user.click(wrapChatroomsSwitch)
      
      expect(mockUpdateSettings).toHaveBeenCalledWith('general', {
        ...mockSettings.general,
        wrapChatroomsList: false
      })
    })

    it('should update show tab images setting', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const showTabImagesSwitch = screen.getAllByTestId('switch').find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Show Tab Images')
      )
      
      await user.click(showTabImagesSwitch)
      
      expect(mockUpdateSettings).toHaveBeenCalledWith('general', {
        ...mockSettings.general,
        showTabImages: false
      })
    })

    it('should update show timestamps setting', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const showTimestampsSwitch = screen.getAllByTestId('switch').find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Show Timestamps')
      )
      
      await user.click(showTimestampsSwitch)
      
      expect(mockUpdateSettings).toHaveBeenCalledWith('general', {
        ...mockSettings.general,
        showTimestamps: true
      })
    })

    it('should handle timestamp format selection', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const timestampSelect = screen.getByDisplayValue('h:mm a')
      await user.selectOptions(timestampSelect, 'HH:mm')
      
      expect(mockUpdateSettings).toHaveBeenCalledWith('general', {
        ...mockSettings.general,
        timestampFormat: 'HH:mm'
      })
    })

    it('should disable timestamp format when timestamps are disabled', () => {
      render(<Settings />)
      
      const timestampSelect = screen.getByDisplayValue('h:mm a')
      expect(timestampSelect).toBeDisabled()
    })

    it('should show all timestamp format options', () => {
      render(<Settings />)
      
      const timestampSelect = screen.getByDisplayValue('h:mm a')
      const options = Array.from(timestampSelect.options).map(option => option.value)
      
      expect(options).toEqual([
        'disabled',
        'h:mm',
        'hh:mm',
        'h:mm a',
        'hh:mm a',
        'h:mm:ss',
        'hh:mm:ss',
        'h:mm:ss a',
        'hh:mm:ss a'
      ])
    })
  })

  describe('Chatroom Settings', () => {
    it('should render chatroom section', () => {
      render(<Settings />)
      
      expect(screen.getByText('Chatroom')).toBeInTheDocument()
      expect(screen.getByText('Select what chatroom settings you want to change.')).toBeInTheDocument()
      expect(screen.getByText('Show Mod Actions')).toBeInTheDocument()
    })

    it('should show correct initial value for mod actions', () => {
      render(<Settings />)
      
      const modActionsSwitch = screen.getAllByTestId('switch').find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Show Mod Actions')
      )
      
      expect(modActionsSwitch).toHaveAttribute('data-checked', 'true')
    })

    it('should update show mod actions setting', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const modActionsSwitch = screen.getAllByTestId('switch').find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Show Mod Actions')
      )
      
      await user.click(modActionsSwitch)
      
      expect(mockUpdateSettings).toHaveBeenCalledWith('chatrooms', {
        ...mockSettings.chatrooms,
        showModActions: false
      })
    })
  })

  describe('Cosmetics Settings', () => {
    it('should render cosmetics section', () => {
      render(<Settings />)
      
      expect(screen.getByText('Cosmetics')).toBeInTheDocument()
      expect(screen.getByText('Select what cosmetics you want rendered in the chatrooms.')).toBeInTheDocument()
      expect(screen.getByText('7TV Emotes')).toBeInTheDocument()
    })

    it('should show correct initial value for 7TV emotes', () => {
      render(<Settings />)
      
      const sevenTVSwitch = screen.getAllByTestId('switch').find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('7TV Emotes')
      )
      
      expect(sevenTVSwitch).toHaveAttribute('data-checked', 'true')
    })

    it('should update 7TV emotes setting', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const sevenTVSwitch = screen.getAllByTestId('switch').find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('7TV Emotes')
      )
      
      await user.click(sevenTVSwitch)
      
      expect(mockUpdateSettings).toHaveBeenCalledWith('sevenTV', {
        ...mockSettings.sevenTV,
        emotes: false
      })
    })
  })

  describe('Notifications Settings', () => {
    it('should render notifications section', () => {
      render(<Settings />)
      
      expect(screen.getByText('Notifications')).toBeInTheDocument()
      expect(screen.getByText('Select what notifications you want to receive.')).toBeInTheDocument()
      expect(screen.getByText('Enable Notifications')).toBeInTheDocument()
      expect(screen.getByText('Play Sound')).toBeInTheDocument()
      expect(screen.getByText('Show Highlights')).toBeInTheDocument()
    })

    it('should show correct initial values for notifications', () => {
      render(<Settings />)
      
      const enableNotificationsSwitch = screen.getAllByTestId('switch').find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Enable Notifications')
      )
      const playSoundSwitch = screen.getAllByTestId('switch').find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Play Sound')
      )
      const showHighlightsSwitch = screen.getAllByTestId('switch').find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Show Highlights')
      )
      
      expect(enableNotificationsSwitch).toHaveAttribute('data-checked', 'false')
      expect(playSoundSwitch).toHaveAttribute('data-checked', 'true')
      expect(showHighlightsSwitch).toHaveAttribute('data-checked', 'false')
    })

    it('should update enable notifications setting', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const enableNotificationsSwitch = screen.getAllByTestId('switch').find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Enable Notifications')
      )
      
      await user.click(enableNotificationsSwitch)
      
      expect(mockUpdateSettings).toHaveBeenCalledWith('notifications', {
        ...mockSettings.notifications,
        enabled: true
      })
    })

    it('should update play sound setting', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const playSoundSwitch = screen.getAllByTestId('switch').find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Play Sound')
      )
      
      await user.click(playSoundSwitch)
      
      expect(mockUpdateSettings).toHaveBeenCalledWith('notifications', {
        ...mockSettings.notifications,
        sound: false
      })
    })

    it('should update show highlights setting', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const showHighlightsSwitch = screen.getAllByTestId('switch').find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Show Highlights')
      )
      
      await user.click(showHighlightsSwitch)
      
      expect(mockUpdateSettings).toHaveBeenCalledWith('notifications', {
        ...mockSettings.notifications,
        background: true
      })
    })

    it('should handle volume slider changes', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const volumeSlider = screen.getByTestId('slider')
      
      await user.clear(volumeSlider)
      await user.type(volumeSlider, '0.8')
      fireEvent.change(volumeSlider, { target: { value: '0.8' } })
      
      expect(mockUpdateSettings).toHaveBeenCalledWith('notifications', {
        ...mockSettings.notifications,
        volume: 0.8
      })
    })

    it('should disable volume slider when sound is disabled', () => {
      // Mock settings with sound disabled
      const settingsWithSoundDisabled = {
        ...mockSettings,
        notifications: { ...mockSettings.notifications, sound: false }
      }
      
      vi.mocked(require('../../providers/SettingsProvider').useSettings).mockReturnValue({
        updateSettings: mockUpdateSettings,
        settings: settingsWithSoundDisabled
      })
      
      render(<Settings />)
      
      const volumeSlider = screen.getByTestId('slider')
      expect(volumeSlider).toBeDisabled()
    })

    it('should render color picker for highlight color', () => {
      render(<Settings />)
      
      expect(screen.getByTestId('color-picker')).toBeInTheDocument()
      expect(screen.getByTestId('color-picker-button')).toBeInTheDocument()
    })

    it('should disable color picker when highlights are disabled', () => {
      render(<Settings />)
      
      const colorPickerButton = screen.getByTestId('color-picker-button')
      expect(colorPickerButton).toBeDisabled()
    })

    it('should handle color changes', async () => {
      const user = userEvent.setup()
      
      // Mock settings with highlights enabled
      const settingsWithHighlights = {
        ...mockSettings,
        notifications: { ...mockSettings.notifications, background: true }
      }
      
      vi.mocked(require('../../providers/SettingsProvider').useSettings).mockReturnValue({
        updateSettings: mockUpdateSettings,
        settings: settingsWithHighlights
      })
      
      render(<Settings />)
      
      const colorPickerButton = screen.getByTestId('color-picker-button')
      await user.click(colorPickerButton)
      
      const colorInput = screen.getByTestId('color-input')
      await user.clear(colorInput)
      await user.type(colorInput, '#00ff00')
      fireEvent.change(colorInput, { target: { value: '#00ff00' } })
      
      expect(mockUpdateSettings).toHaveBeenCalledWith('notifications', {
        ...settingsWithHighlights.notifications,
        backgroundColour: '#00ff00'
      })
    })

    it('should render highlight phrases section', () => {
      render(<Settings />)
      
      expect(screen.getByText('Highlight Phrases')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Add new phrase...')).toBeInTheDocument()
      expect(screen.getByText('test phrase')).toBeInTheDocument()
      expect(screen.getByText('another phrase')).toBeInTheDocument()
    })

    it('should add new phrase on Enter key', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const phraseInput = screen.getByPlaceholderText('Add new phrase...')
      await user.type(phraseInput, 'new phrase')
      await user.keyboard('{Enter}')
      
      expect(mockUpdateSettings).toHaveBeenCalledWith('notifications', {
        ...mockSettings.notifications,
        phrases: ['test phrase', 'another phrase', 'new phrase']
      })
    })

    it('should not add duplicate phrases', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const phraseInput = screen.getByPlaceholderText('Add new phrase...')
      await user.type(phraseInput, 'test phrase')
      await user.keyboard('{Enter}')
      
      // Should not call updateSettings since phrase already exists
      expect(mockUpdateSettings).not.toHaveBeenCalled()
    })

    it('should not add empty phrases', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const phraseInput = screen.getByPlaceholderText('Add new phrase...')
      await user.keyboard('{Enter}')
      
      expect(mockUpdateSettings).not.toHaveBeenCalled()
    })

    it('should remove phrase on click', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const removeButtons = screen.getAllByText('×')
      await user.click(removeButtons[0])
      
      expect(mockUpdateSettings).toHaveBeenCalledWith('notifications', {
        ...mockSettings.notifications,
        phrases: ['another phrase'] // First phrase removed
      })
    })

    it('should remove phrase on middle mouse button', async () => {
      render(<Settings />)
      
      const phraseElements = screen.getByText('test phrase').closest('.highlightPhrase')
      fireEvent.mouseDown(phraseElements, { button: 1 }) // Middle click
      
      expect(mockUpdateSettings).toHaveBeenCalledWith('notifications', {
        ...mockSettings.notifications,
        phrases: ['another phrase']
      })
    })

    it('should show empty state when no phrases', () => {
      const settingsWithNoPhrases = {
        ...mockSettings,
        notifications: { ...mockSettings.notifications, phrases: [] }
      }
      
      vi.mocked(require('../../providers/SettingsProvider').useSettings).mockReturnValue({
        updateSettings: mockUpdateSettings,
        settings: settingsWithNoPhrases
      })
      
      render(<Settings />)
      
      expect(screen.getByText('No highlight phrases added.')).toBeInTheDocument()
    })
  })

  describe('Dialog Controls', () => {
    it('should close dialog when close button clicked', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const closeButton = screen.getByAltText('Close')
      await user.click(closeButton)
      
      expect(mockSettingsDialog.close).toHaveBeenCalledTimes(1)
    })

    it('should handle logout when logout button clicked', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const logoutButton = screen.getByText('Sign Out')
      await user.click(logoutButton)
      
      expect(window.app.logout).toHaveBeenCalledTimes(1)
    })
  })

  describe('Settings Update Errors', () => {
    it('should handle settings update errors gracefully', async () => {
      const user = userEvent.setup()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      mockUpdateSettings.mockImplementation(() => {
        throw new Error('Failed to update setting')
      })
      
      render(<Settings />)
      
      const alwaysOnTopSwitch = screen.getAllByTestId('switch').find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Always on Top')
      )
      
      await user.click(alwaysOnTopSwitch)
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Settings]: Failed to save setting:',
        expect.any(Error)
      )
      
      consoleSpy.mockRestore()
    })

    it('should continue working after settings errors', async () => {
      const user = userEvent.setup()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      // Mock first call to throw, second to succeed
      mockUpdateSettings
        .mockImplementationOnce(() => {
          throw new Error('First call failed')
        })
        .mockImplementationOnce(() => {})
      
      render(<Settings />)
      
      const alwaysOnTopSwitch = screen.getAllByTestId('switch').find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Always on Top')
      )
      const wrapChatroomsSwitch = screen.getAllByTestId('switch').find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Wrap Chatrooms List')
      )
      
      // First click should error but not crash
      await user.click(alwaysOnTopSwitch)
      expect(consoleSpy).toHaveBeenCalled()
      
      // Second click should work normally
      await user.click(wrapChatroomsSwitch)
      expect(mockUpdateSettings).toHaveBeenCalledTimes(2)
      
      consoleSpy.mockRestore()
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
      const user = userEvent.setup()
      const originalGetAppInfo = window.app.getAppInfo
      const originalLogout = window.app.logout
      
      delete window.app.getAppInfo
      delete window.app.logout
      
      render(<Settings />)
      
      // Should still be able to click logout button without crashing
      const logoutButton = screen.getByText('Sign Out')
      await expect(user.click(logoutButton)).resolves.not.toThrow()
      
      window.app.getAppInfo = originalGetAppInfo
      window.app.logout = originalLogout
    })

    it('should handle settingsDialog API errors', async () => {
      const user = userEvent.setup()
      
      mockSettingsDialog.close.mockImplementation(() => {
        throw new Error('Close failed')
      })
      
      render(<Settings />)
      
      const closeButton = screen.getByAltText('Close')
      
      // Should not crash when API throws
      await expect(user.click(closeButton)).resolves.not.toThrow()
    })

    it('should handle null settings gracefully', () => {
      vi.mocked(require('../../providers/SettingsProvider').useSettings).mockReturnValue({
        updateSettings: mockUpdateSettings,
        settings: null
      })
      
      expect(() => {
        render(<Settings />)
      }).not.toThrow()
    })

    it('should handle undefined settings gracefully', () => {
      vi.mocked(require('../../providers/SettingsProvider').useSettings).mockReturnValue({
        updateSettings: mockUpdateSettings,
        settings: undefined
      })
      
      expect(() => {
        render(<Settings />)
      }).not.toThrow()
    })

    it('should handle settings with missing sections', () => {
      const partialSettings = {
        general: { alwaysOnTop: true }
        // Missing other sections
      }
      
      vi.mocked(require('../../providers/SettingsProvider').useSettings).mockReturnValue({
        updateSettings: mockUpdateSettings,
        settings: partialSettings
      })
      
      expect(() => {
        render(<Settings />)
      }).not.toThrow()
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

    it('should have proper heading structure', () => {
      render(<Settings />)
      
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Settings')
      
      const h4Headings = screen.getAllByRole('heading', { level: 4 })
      expect(h4Headings.some(h => h.textContent === 'General')).toBe(true)
      expect(h4Headings.some(h => h.textContent === 'Chatroom')).toBe(true)
      expect(h4Headings.some(h => h.textContent === 'Cosmetics')).toBe(true)
      expect(h4Headings.some(h => h.textContent === 'Notifications')).toBe(true)
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const aboutButton = screen.getByText('About KickTalk')
      aboutButton.focus()
      
      await user.keyboard('{Enter}')
      
      expect(screen.getByText('Meet the Creators')).toBeInTheDocument()
    })

    it('should have alt text for images', () => {
      render(<Settings />)
      
      expect(screen.getByAltText('Close')).toBeInTheDocument()
      expect(screen.getByAltText('KickTalk Logo')).toBeInTheDocument()
      expect(screen.getByAltText('Sign Out')).toBeInTheDocument()
    })

    it('should have proper form labels via info tooltips', () => {
      render(<Settings />)
      
      const infoIcons = screen.getAllByAltText('Info')
      expect(infoIcons.length).toBeGreaterThan(0)
    })

    it('should have proper select labels', () => {
      render(<Settings />)
      
      const timestampSelect = screen.getByDisplayValue('h:mm a')
      expect(timestampSelect.closest('.settingsExtendedItem')).toBeInTheDocument()
    })

    it('should have proper input labels', () => {
      render(<Settings />)
      
      const phraseInput = screen.getByPlaceholderText('Add new phrase...')
      expect(phraseInput.type).toBe('text')
    })
  })

  describe('Performance and Memory Management', () => {
    it('should not cause memory leaks with repeated renders', () => {
      const { rerender } = render(<Settings />)
      
      // Multiple re-renders should not cause issues
      for (let i = 0; i < 100; i++) {
        rerender(<Settings />)
      }
      
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('should cleanup all listeners on unmount', () => {
      const { unmount } = render(<Settings />)
      
      unmount()
      
      expect(mockOnDataCleanup).toHaveBeenCalledTimes(1)
    })

    it('should handle rapid setting changes', async () => {
      const user = userEvent.setup({ delay: null })
      render(<Settings />)
      
      const switches = screen.getAllByTestId('switch')
      
      // Rapid setting changes
      for (let i = 0; i < 5; i++) {
        await user.click(switches[0])
      }
      
      expect(mockUpdateSettings).toHaveBeenCalledTimes(5)
    })

    it('should handle rapid section switching', async () => {
      const user = userEvent.setup({ delay: null })
      render(<Settings />)
      
      // Rapid section switching
      for (let i = 0; i < 10; i++) {
        await user.click(screen.getByText('About KickTalk'))
        await user.click(screen.getByText('General'))
      }
      
      // Should end up in general section
      expect(screen.getByText('Select what general app settings you want to change.')).toBeInTheDocument()
    })

    it('should render quickly with large amounts of phrases', () => {
      const manyPhrases = Array.from({ length: 100 }, (_, i) => `phrase${i}`)
      const settingsWithManyPhrases = {
        ...mockSettings,
        notifications: { ...mockSettings.notifications, phrases: manyPhrases }
      }
      
      vi.mocked(require('../../providers/SettingsProvider').useSettings).mockReturnValue({
        updateSettings: mockUpdateSettings,
        settings: settingsWithManyPhrases
      })
      
      const start = performance.now()
      render(<Settings />)
      const end = performance.now()
      
      // Should render quickly even with many phrases
      expect(end - start).toBeLessThan(500) // 500ms threshold
      expect(screen.getByText('phrase0')).toBeInTheDocument()
      expect(screen.getByText('phrase99')).toBeInTheDocument()
    })
  })

  describe('State Management', () => {
    it('should maintain component state across interactions', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      // Make setting changes
      const alwaysOnTopSwitch = screen.getAllByTestId('switch').find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Always on Top')
      )
      await user.click(alwaysOnTopSwitch)
      
      // Switch sections and back
      await user.click(screen.getByText('About KickTalk'))
      await user.click(screen.getByText('General'))
      
      // Switch should still be available for interaction
      expect(screen.getAllByTestId('switch').find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Always on Top')
      )).toBeInTheDocument()
    })

    it('should preserve section state during data updates', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      // Switch to about section
      await user.click(screen.getByText('About KickTalk'))
      
      // Trigger data update
      const handleDialogData = mockSettingsDialog.onData.mock.calls[0][0]
      handleDialogData({ settings: { general: { theme: 'light' } } })
      
      // Should still be in about section
      expect(screen.getByText('Meet the Creators')).toBeInTheDocument()
    })

    it('should handle concurrent updates correctly', () => {
      render(<Settings />)
      
      const handleDialogData = mockSettingsDialog.onData.mock.calls[0][0]
      
      // Multiple rapid updates
      handleDialogData({ settings: { general: { alwaysOnTop: true } } })
      handleDialogData({ settings: { general: { alwaysOnTop: false } } })
      handleDialogData({ settings: { general: { alwaysOnTop: true } } })
      
      // Should handle all updates without crashing
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })
  })

  describe('Integration with Settings Provider', () => {
    it('should use settings from provider correctly', () => {
      render(<Settings />)
      
      // Should show initial settings from provider
      const alwaysOnTopSwitch = screen.getAllByTestId('switch').find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Always on Top')
      )
      expect(alwaysOnTopSwitch).toHaveAttribute('data-checked', String(mockSettings.general.alwaysOnTop))
    })

    it('should call updateSettings with correct parameters', async () => {
      const user = userEvent.setup()
      render(<Settings />)
      
      const alwaysOnTopSwitch = screen.getAllByTestId('switch').find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Always on Top')
      )
      
      await user.click(alwaysOnTopSwitch)
      
      expect(mockUpdateSettings).toHaveBeenCalledWith('general', {
        ...mockSettings.general,
        alwaysOnTop: !mockSettings.general.alwaysOnTop
      })
    })

    it('should handle provider settings changes reactively', () => {
      const { rerender } = render(<Settings />)
      
      // Change provider settings
      const newSettings = {
        ...mockSettings,
        general: { ...mockSettings.general, alwaysOnTop: true }
      }
      
      vi.mocked(require('../../providers/SettingsProvider').useSettings).mockReturnValue({
        updateSettings: mockUpdateSettings,
        settings: newSettings
      })
      
      rerender(<Settings />)
      
      const alwaysOnTopSwitch = screen.getAllByTestId('switch').find(
        switch_ => switch_.closest('.settingSwitchItem')?.textContent?.includes('Always on Top')
      )
      expect(alwaysOnTopSwitch).toHaveAttribute('data-checked', 'true')
    })
  })
})