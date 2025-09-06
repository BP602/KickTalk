import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { GeneralSection, ChatroomSection, CosmeticsSection, NotificationsSection } from './General';
import { DEFAULT_CHAT_HISTORY_LENGTH } from '@utils/constants';

// Mock external dependencies
vi.mock('@utils/constants', () => ({
  DEFAULT_CHAT_HISTORY_LENGTH: 400
}));

// Mock child components
vi.mock('../../../Shared/Switch', () => ({
  Switch: ({ checked, onCheckedChange, ...props }) => (
    <button
      {...props}
      data-testid="switch"
      data-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      aria-pressed={checked}
    >
      {checked ? 'ON' : 'OFF'}
    </button>
  )
}));

vi.mock('../../../Shared/Slider', () => ({
  Slider: ({ defaultValue, onValueChange, min, max, step, disabled, showTooltip, className }) => (
    <input
      data-testid="slider"
      type="range"
      min={min}
      max={max}
      step={step}
      defaultValue={defaultValue?.[0] || 0}
      disabled={disabled}
      className={className}
      data-show-tooltip={showTooltip}
      onChange={(e) => onValueChange([parseFloat(e.target.value)])}
    />
  )
}));

vi.mock('../../../Shared/Tooltip', () => ({
  Tooltip: ({ children, delayDuration }) => (
    <div data-testid="tooltip" data-delay={delayDuration}>{children}</div>
  ),
  TooltipContent: ({ children }) => <div data-testid="tooltip-content">{children}</div>,
  TooltipTrigger: ({ asChild, children }) => asChild ? children : <div data-testid="tooltip-trigger">{children}</div>
}));

vi.mock('../../../Shared/Dropdown', () => ({
  DropdownMenu: ({ children, value }) => (
    <div data-testid="dropdown-menu" data-value={value}>{children}</div>
  ),
  DropdownMenuContent: ({ children, side }) => (
    <div data-testid="dropdown-content" data-side={side}>{children}</div>
  ),
  DropdownMenuItem: ({ children, onClick, value }) => (
    <button data-testid="dropdown-item" data-value={value} onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuTrigger: ({ asChild, children }) => 
    asChild ? children : <div data-testid="dropdown-trigger">{children}</div>
}));

vi.mock('../../../Shared/ColorPicker', () => ({
  default: ({ initialColor, handleColorChange, isColorPickerOpen, setIsColorPickerOpen, disabled }) => (
    <div data-testid="color-picker" data-disabled={disabled}>
      <button
        onClick={() => !disabled && setIsColorPickerOpen(!isColorPickerOpen)}
        data-testid="color-picker-trigger"
      >
        Color Picker
      </button>
      {isColorPickerOpen && (
        <div data-testid="color-picker-popup">
          <button onClick={() => handleColorChange({ r: 255, g: 0, b: 0, a: 0.5 })}>
            Set Red
          </button>
        </div>
      )}
    </div>
  )
}));

vi.mock('../../../Shared/NotificationFilePicker', () => ({
  default: ({ disabled, getOptions }) => {
    // Invoke getOptions on render so tests can assert the API is called
    try { getOptions?.() } catch {}
    return (
      <div data-testid="notification-file-picker" data-disabled={disabled}>
        <button disabled={disabled}>Select File</button>
      </div>
    )
  }
}));

// Mock assets
vi.mock('../../../../assets/icons/info-fill.svg?asset', () => ({ default: 'info-icon.svg' }));
vi.mock('../../../../assets/icons/caret-down-fill.svg?asset', () => ({ default: 'caret-down-icon.svg' }));
vi.mock('../../../../assets/icons/folder-open-fill.svg?asset', () => ({ default: 'folder-icon.svg' }));
vi.mock('../../../../assets/icons/play-fill.svg?asset', () => ({ default: 'play-icon.svg' }));

// Mock window.app (do not replace the window object)
if (!global.window) {
  // In jsdom this should already exist, but guard just in case
  // eslint-disable-next-line no-global-assign
  global.window = {}
}
global.window.app = {
  ...(global.window.app || {}),
  notificationSounds: {
    getAvailable: vi.fn().mockResolvedValue(['sound1.mp3', 'sound2.wav']),
    openFolder: vi.fn()
  }
};

describe('GeneralSection', () => {
  const defaultSettings = {
    general: {
      alwaysOnTop: false,
      autoUpdate: true,
      wrapChatroomsList: false,
      compactChatroomsList: false,
      showTabImages: true,
      timestampFormat: 'h:mm'
    },
    customTheme: {
      current: 'default'
    }
  };

  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render general section with all settings', () => {
      render(<GeneralSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      expect(screen.getByText('General')).toBeInTheDocument();
      expect(screen.getByText('Select what general app settings you want to change.')).toBeInTheDocument();
      
      expect(screen.getByText('Always on Top')).toBeInTheDocument();
      expect(screen.getByText('Auto Update')).toBeInTheDocument();
      expect(screen.getByText('Wrap Chatrooms List')).toBeInTheDocument();
      expect(screen.getByText('Compact Chatroom List')).toBeInTheDocument();
      expect(screen.getByText('Show Tab Images')).toBeInTheDocument();
      expect(screen.getByText('Show Timestamps')).toBeInTheDocument();
      expect(screen.getByText('Theme')).toBeInTheDocument();
    });

    it('should display correct switch states based on settings', () => {
      render(<GeneralSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const switches = screen.getAllByTestId('switch');
      
      // Always on Top - should be OFF (false)
      expect(switches[0]).toHaveAttribute('data-checked', 'false');
      
      // Auto Update - should be ON (true) 
      expect(switches[1]).toHaveAttribute('data-checked', 'true');
      
      // Wrap Chatrooms List - should be OFF (false)
      expect(switches[2]).toHaveAttribute('data-checked', 'false');
      
      // Compact Chatroom List - should be OFF (false)
      expect(switches[3]).toHaveAttribute('data-checked', 'false');
      
      // Show Tab Images - should be ON (true)
      expect(switches[4]).toHaveAttribute('data-checked', 'true');
    });

    it('should show tooltips for all settings', () => {
      render(<GeneralSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const tooltips = screen.getAllByTestId('tooltip');
      expect(tooltips.length).toBeGreaterThan(5);
      
      // Check for info icons
      const infoIcons = screen.getAllByAltText('Info');
      expect(infoIcons.length).toBeGreaterThan(5);
    });
  });

  describe('Switch Interactions', () => {
    it('should handle always on top toggle', async () => {
      const user = userEvent.setup();
      render(<GeneralSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const alwaysOnTopSwitch = screen.getAllByTestId('switch')[0];
      await user.click(alwaysOnTopSwitch);
      
      expect(mockOnChange).toHaveBeenCalledWith('general', {
        ...defaultSettings.general,
        alwaysOnTop: true
      });
    });

    it('should handle auto update toggle', async () => {
      const user = userEvent.setup();
      render(<GeneralSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const autoUpdateSwitch = screen.getAllByTestId('switch')[1];
      await user.click(autoUpdateSwitch);
      
      expect(mockOnChange).toHaveBeenCalledWith('general', {
        ...defaultSettings.general,
        autoUpdate: false
      });
    });

    it('should handle wrap chatrooms list toggle', async () => {
      const user = userEvent.setup();
      render(<GeneralSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const wrapChatroomsSwitch = screen.getAllByTestId('switch')[2];
      await user.click(wrapChatroomsSwitch);
      
      expect(mockOnChange).toHaveBeenCalledWith('general', {
        ...defaultSettings.general,
        wrapChatroomsList: true
      });
    });

    it('should handle compact chatroom list toggle', async () => {
      const user = userEvent.setup();
      render(<GeneralSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const compactListSwitch = screen.getAllByTestId('switch')[3];
      await user.click(compactListSwitch);
      
      expect(mockOnChange).toHaveBeenCalledWith('general', {
        ...defaultSettings.general,
        compactChatroomsList: true
      });
    });

    it('should handle show tab images toggle', async () => {
      const user = userEvent.setup();
      render(<GeneralSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const showTabImagesSwitch = screen.getAllByTestId('switch')[4];
      await user.click(showTabImagesSwitch);
      
      expect(mockOnChange).toHaveBeenCalledWith('general', {
        ...defaultSettings.general,
        showTabImages: false
      });
    });
  });

  describe('Dropdown Interactions', () => {
    it('should display current timestamp format', () => {
      render(<GeneralSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const dropdowns = screen.getAllByTestId('dropdown-menu');
      const timestampDropdown = dropdowns.find(d => d.getAttribute('data-value') === 'h:mm');
      expect(timestampDropdown).toBeInTheDocument();
    });

    it('should handle timestamp format changes', async () => {
      const user = userEvent.setup();
      render(<GeneralSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const timestampOptions = screen.getAllByTestId('dropdown-item');
      const hhmmOption = timestampOptions.find(option => option.getAttribute('data-value') === 'hh:mm');
      
      await user.click(hhmmOption);
      
      expect(mockOnChange).toHaveBeenCalledWith('general', {
        ...defaultSettings.general,
        timestampFormat: 'hh:mm'
      });
    });

    it('should display current theme', () => {
      const customSettings = {
        ...defaultSettings,
        customTheme: { current: 'dark' }
      };
      
      render(<GeneralSection settingsData={customSettings} onChange={mockOnChange} />);
      
      const themeDropdowns = screen.getAllByTestId('dropdown-menu');
      const themeDropdown = themeDropdowns.find(dropdown => 
        dropdown.getAttribute('data-value') === 'dark'
      );
      expect(themeDropdown).toBeInTheDocument();
    });

    it('should handle theme changes', async () => {
      const user = userEvent.setup();
      render(<GeneralSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const themeOptions = screen.getAllByTestId('dropdown-item');
      const darkThemeOption = themeOptions.find(option => 
        option.getAttribute('data-value') === 'dark'
      );
      
      await user.click(darkThemeOption);
      
      expect(mockOnChange).toHaveBeenCalledWith('customTheme', {
        ...defaultSettings.customTheme,
        current: 'dark'
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing general settings gracefully', () => {
      const incompleteSettings = {
        customTheme: { current: 'default' }
      };
      
      expect(() => {
        render(<GeneralSection settingsData={incompleteSettings} onChange={mockOnChange} />);
      }).not.toThrow();
    });

    it('should handle undefined settings gracefully', () => {
      expect(() => {
        render(<GeneralSection settingsData={undefined} onChange={mockOnChange} />);
      }).not.toThrow();
    });

    it('should handle null onChange gracefully', () => {
      expect(() => {
        render(<GeneralSection settingsData={defaultSettings} onChange={null} />);
      }).not.toThrow();
    });
  });
});

describe('ChatroomSection', () => {
  const defaultSettings = {
    chatrooms: {
      batching: false,
      batchingInterval: 500,
      showModActions: true,
      showInfoBar: false
    },
    chatHistory: {
      chatHistoryLength: DEFAULT_CHAT_HISTORY_LENGTH
    }
  };

  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render chatroom section with all settings', () => {
      render(<ChatroomSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      expect(screen.getByText('Chatroom')).toBeInTheDocument();
      expect(screen.getByText('Select what chatroom settings you want to change.')).toBeInTheDocument();
      
      expect(screen.getByText('Enable Batching')).toBeInTheDocument();
      expect(screen.getByText('Batching Interval')).toBeInTheDocument();
      expect(screen.getByText('Show Mod Actions')).toBeInTheDocument();
      expect(screen.getByText('Show Chat Mode Info Bar')).toBeInTheDocument();
      expect(screen.getByText('Chat History Length')).toBeInTheDocument();
    });

    it('should show slider for batching interval', () => {
      render(<ChatroomSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const slider = screen.getByTestId('slider');
      expect(slider).toBeInTheDocument();
      expect(slider).toHaveAttribute('min', '0');
      expect(slider).toHaveAttribute('max', '1000');
      expect(slider).toHaveAttribute('step', '100');
      // Default value should be reflected as the input's current value (string in DOM)
      expect(slider).toHaveValue('500');
    });

    it('should show numeric input for chat history length', () => {
      render(<ChatroomSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const numericInput = screen.getByDisplayValue('400');
      expect(numericInput).toBeInTheDocument();
      expect(numericInput).toHaveAttribute('type', 'number');
      expect(numericInput).toHaveAttribute('min', '1');
      expect(numericInput).toHaveAttribute('max', '2000');
    });
  });

  describe('Interactions', () => {
    it('should handle batching toggle', async () => {
      const user = userEvent.setup();
      render(<ChatroomSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const batchingSwitch = screen.getAllByTestId('switch')[0];
      await user.click(batchingSwitch);
      
      expect(mockOnChange).toHaveBeenCalledWith('chatrooms', {
        ...defaultSettings.chatrooms,
        batching: true
      });
    });

    it('should handle batching interval slider changes', () => {
      render(<ChatroomSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const slider = screen.getByTestId('slider');
      fireEvent.change(slider, { target: { value: '800' } });
      
      expect(mockOnChange).toHaveBeenCalledWith('chatrooms', {
        ...defaultSettings.chatrooms,
        batchingInterval: 800
      });
    });

    it('should disable batching interval when batching is off', () => {
      render(<ChatroomSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const slider = screen.getByTestId('slider');
      expect(slider).toBeDisabled();
    });

    it('should handle chat history length changes', async () => {
      render(<ChatroomSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const input = screen.getByDisplayValue('400');
      fireEvent.change(input, { target: { value: '600' } });
      
      await waitFor(() => {
        const called = mockOnChange.mock.calls.some(([section, payload]) =>
          section === 'chatHistory' && payload?.chatHistoryLength === 600
        )
        expect(called).toBe(true)
      });
    });

    it('should enforce chat history length bounds', async () => {
      render(<ChatroomSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const input = screen.getByDisplayValue('400');
      
      // Test upper bound
      fireEvent.change(input, { target: { value: '3000' } });
      await waitFor(() => {
        const calledMax = mockOnChange.mock.calls.some(([section, payload]) =>
          section === 'chatHistory' && payload?.chatHistoryLength === 2000
        )
        expect(calledMax).toBe(true)
      });
      
      // Test lower bound
      fireEvent.change(input, { target: { value: '0' } });
      await waitFor(() => {
        const calledMin = mockOnChange.mock.calls.some(([section, payload]) =>
          section === 'chatHistory' && payload?.chatHistoryLength === 1
        )
        expect(calledMin).toBe(true)
      });
    });
  });
});

describe('CosmeticsSection', () => {
  const defaultSettings = {
    sevenTV: {
      emotes: true,
      paints: false,
      badges: false
    }
  };

  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render cosmetics section', () => {
      render(<CosmeticsSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      expect(screen.getByText('Cosmetics')).toBeInTheDocument();
      expect(screen.getByText('Select what cosmetics you want rendered in the chatrooms.')).toBeInTheDocument();
      expect(screen.getByText('7TV Emotes')).toBeInTheDocument();
    });

    it('should show 7TV emotes switch', () => {
      render(<CosmeticsSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const switch7TV = screen.getByTestId('switch');
      expect(switch7TV).toHaveAttribute('data-checked', 'true');
    });
  });

  describe('Interactions', () => {
    it('should handle 7TV emotes toggle', async () => {
      const user = userEvent.setup();
      render(<CosmeticsSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const switch7TV = screen.getByTestId('switch');
      await user.click(switch7TV);
      
      expect(mockOnChange).toHaveBeenCalledWith('sevenTV', {
        ...defaultSettings.sevenTV,
        emotes: false
      });
    });
  });
});

describe('NotificationsSection', () => {
  const defaultSettings = {
    notifications: {
      enabled: true,
      sound: false,
      volume: 0.5,
      background: true,
      backgroundRgba: { r: 255, g: 255, b: 0, a: 0.5 },
      phrases: ['test phrase']
    },
    telemetry: {
      enabled: false
    }
  };

  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render notifications section', () => {
      render(<NotificationsSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText('Select what notifications you want to receive.')).toBeInTheDocument();
      
      expect(screen.getByText('Enable Notifications')).toBeInTheDocument();
      expect(screen.getByText('Play Sound')).toBeInTheDocument();
      expect(screen.getByText('Show Highlights')).toBeInTheDocument();
    });

    it('should render telemetry section', () => {
      render(<NotificationsSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      expect(screen.getByText('Telemetry & Analytics')).toBeInTheDocument();
      expect(screen.getByText('Enable Telemetry')).toBeInTheDocument();
    });

    it('should show color picker for highlights', () => {
      render(<NotificationsSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const colorPicker = screen.getByTestId('color-picker');
      expect(colorPicker).toBeInTheDocument();
    });

    it('should show existing highlight phrases', () => {
      render(<NotificationsSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      expect(screen.getByText('test phrase')).toBeInTheDocument();
    });

    it('should show no phrases message when empty', () => {
      const emptySettings = {
        ...defaultSettings,
        notifications: {
          ...defaultSettings.notifications,
          phrases: []
        }
      };
      
      render(<NotificationsSection settingsData={emptySettings} onChange={mockOnChange} />);
      
      expect(screen.getByText('No highlight phrases added.')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should handle notifications enable toggle', async () => {
      const user = userEvent.setup();
      render(<NotificationsSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const notificationsSwitch = screen.getAllByTestId('switch')[0];
      await user.click(notificationsSwitch);
      
      expect(mockOnChange).toHaveBeenCalledWith('notifications', {
        ...defaultSettings.notifications,
        enabled: false
      });
    });

    it('should handle sound toggle', async () => {
      const user = userEvent.setup();
      render(<NotificationsSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const soundSwitch = screen.getAllByTestId('switch')[1];
      await user.click(soundSwitch);
      
      expect(mockOnChange).toHaveBeenCalledWith('notifications', {
        ...defaultSettings.notifications,
        sound: true
      });
    });

    it('should handle volume slider changes', () => {
      const settingsWithSound = {
        ...defaultSettings,
        notifications: { ...defaultSettings.notifications, sound: true }
      };
      render(<NotificationsSection settingsData={settingsWithSound} onChange={mockOnChange} />);
      
      const slider = screen.getByTestId('slider');
      fireEvent.change(slider, { target: { value: '0.8' } });
      
      expect(mockOnChange).toHaveBeenCalledWith('notifications', {
        ...settingsWithSound.notifications,
        volume: 0.8
      });
    });

    it('should handle color picker changes', async () => {
      const user = userEvent.setup();
      render(<NotificationsSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const colorPickerTrigger = screen.getByTestId('color-picker-trigger');
      await user.click(colorPickerTrigger);
      
      const setRedButton = screen.getByText('Set Red');
      await user.click(setRedButton);
      
      expect(mockOnChange).toHaveBeenCalledWith('notifications', {
        ...defaultSettings.notifications,
        backgroundRgba: { r: 255, g: 0, b: 0, a: 0.5 }
      });
    });

    it('should handle adding highlight phrases', async () => {
      const user = userEvent.setup();
      render(<NotificationsSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const phraseInput = screen.getByPlaceholderText('Add new phrase...');
      await user.type(phraseInput, 'new phrase{Enter}');
      
      expect(mockOnChange).toHaveBeenCalledWith('notifications', {
        ...defaultSettings.notifications,
        phrases: ['test phrase', 'new phrase']
      });
    });

    it('should handle removing highlight phrases', async () => {
      const user = userEvent.setup();
      render(<NotificationsSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const removeButton = screen.getByText('×');
      await user.click(removeButton);
      
      expect(mockOnChange).toHaveBeenCalledWith('notifications', {
        ...defaultSettings.notifications,
        phrases: []
      });
    });

    it('should open notification sounds folder', async () => {
      const user = userEvent.setup();
      const settingsWithSound = {
        ...defaultSettings,
        notifications: { ...defaultSettings.notifications, sound: true }
      };
      render(<NotificationsSection settingsData={settingsWithSound} onChange={mockOnChange} />);
      
      // Disambiguate between two "Select File" buttons rendered
      const soundFileButton = document.querySelector('.soundFileName');
      await user.click(soundFileButton);
      
      expect(window.app.notificationSounds.openFolder).toHaveBeenCalled();
    });

    it('should handle telemetry toggle', async () => {
      const user = userEvent.setup();
      render(<NotificationsSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const telemetrySwitch = screen.getAllByTestId('switch')[3]; // Last switch
      await user.click(telemetrySwitch);
      
      expect(mockOnChange).toHaveBeenCalledWith('telemetry', {
        ...defaultSettings.telemetry,
        enabled: true
      });
    });
  });

  describe('Conditional Rendering', () => {
    it('should disable volume slider when sound is off', () => {
      render(<NotificationsSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const slider = screen.getByTestId('slider');
      expect(slider).toBeDisabled();
    });

    it('should disable color picker when highlights are off', () => {
      const settingsWithoutHighlights = {
        ...defaultSettings,
        notifications: {
          ...defaultSettings.notifications,
          background: false
        }
      };
      
      render(<NotificationsSection settingsData={settingsWithoutHighlights} onChange={mockOnChange} />);
      
      const colorPicker = screen.getByTestId('color-picker');
      expect(colorPicker).toHaveAttribute('data-disabled', 'true');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid phrase input', async () => {
      const user = userEvent.setup();
      render(<NotificationsSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const phraseInput = screen.getByPlaceholderText('Add new phrase...');
      
      // Try to add empty phrase
      await user.type(phraseInput, '   {Enter}');
      
      // Should not call onChange for empty/whitespace phrases
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('should handle duplicate phrases', async () => {
      const user = userEvent.setup();
      render(<NotificationsSection settingsData={defaultSettings} onChange={mockOnChange} />);
      
      const phraseInput = screen.getByPlaceholderText('Add new phrase...');
      
      // Try to add existing phrase
      await user.type(phraseInput, 'test phrase{Enter}');
      
      // Should not call onChange for duplicate phrases
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('should handle notification sounds API errors', async () => {
      window.app.notificationSounds.getAvailable.mockRejectedValue(new Error('API Error'));
      render(<NotificationsSection settingsData={defaultSettings} onChange={mockOnChange} />);
      await waitFor(() => {
        expect(window.app.notificationSounds.getAvailable).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for complex controls', async () => {
      render(<NotificationsSection settingsData={defaultSettings} onChange={mockOnChange} />);
      await waitFor(() => {
        const switches = screen.getAllByTestId('switch');
        switches.forEach(switchElement => {
          expect(switchElement).toHaveAttribute('aria-pressed');
        });
        const slider = screen.getByTestId('slider');
        expect(slider).toHaveAttribute('type', 'range');
      });
    });

    it('should provide tooltips for all settings', async () => {
      render(<NotificationsSection settingsData={defaultSettings} onChange={mockOnChange} />);
      await waitFor(() => {
        const tooltips = screen.getAllByTestId('tooltip');
        expect(tooltips.length).toBeGreaterThan(5);
      });
    });
  });
});
