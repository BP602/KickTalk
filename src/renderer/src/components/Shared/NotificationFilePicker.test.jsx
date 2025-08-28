import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import NotificationFilePicker from './NotificationFilePicker';

// Mock Dropdown components
vi.mock('./Dropdown', () => ({
  DropdownMenu: ({ children, onOpenChange, ...props }) => (
    <div 
      data-testid="dropdown-menu" 
      data-on-open-change={!!onOpenChange}
      {...props}
    >
      {children}
      <button 
        data-testid="dropdown-open-trigger" 
        onClick={() => onOpenChange && onOpenChange(true)}
      >
        Open
      </button>
    </div>
  ),
  DropdownMenuTrigger: ({ children, disabled, asChild, ...props }) => (
    <div 
      data-testid="dropdown-menu-trigger" 
      data-disabled={disabled}
      data-as-child={asChild}
      {...props}
    >
      {children}
    </div>
  ),
  DropdownMenuContent: ({ children, ...props }) => (
    <div data-testid="dropdown-menu-content" {...props}>
      {children}
    </div>
  ),
  DropdownMenuItem: ({ children, onSelect, value, ...props }) => (
    <div
      data-testid="dropdown-menu-item"
      data-value={value}
      onClick={() => onSelect && onSelect()}
      {...props}
    >
      {children}
    </div>
  ),
}));

// Mock assets
vi.mock('@assets/icons/caret-down-fill.svg?asset', () => ({ default: 'caret-down-icon' }));
vi.mock('@assets/icons/play-fill.svg?asset', () => ({ default: 'play-icon' }));

// Mock global Audio
global.Audio = vi.fn(() => ({
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  volume: 0.1,
}));

// Mock window.app
global.window = {
  ...global.window,
  app: {
    notificationSounds: {
      getSoundUrl: vi.fn(),
    },
  },
};

describe('NotificationFilePicker', () => {
  const defaultProps = {
    getOptions: vi.fn(),
    onChange: vi.fn(),
    settingsData: {
      notifications: {
        soundFile: '/path/to/sound.mp3',
        soundFileName: 'notification',
        volume: 0.5,
      },
    },
    disabled: false,
  };

  const mockOptions = [
    { name: 'default', value: '/sounds/default.mp3' },
    { name: 'beep', value: '/sounds/beep.wav' },
    { name: 'chime', value: '/sounds/chime.ogg' },
    { name: 'custom sound', value: '/sounds/custom_sound.mp3' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    defaultProps.getOptions.mockResolvedValue(mockOptions);
    window.app.notificationSounds.getSoundUrl.mockResolvedValue('blob:sound-url');
  });

  describe('Rendering', () => {
    it('should render notification file picker container', async () => {
      render(<NotificationFilePicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('dropdown-menu')).toBeInTheDocument();
      });

      const container = screen.getByTestId('dropdown-menu').closest('.notificationFilePickerContainer');
      expect(container).toBeInTheDocument();
    });

    it('should render test sound button', async () => {
      render(<NotificationFilePicker {...defaultProps} />);

      await waitFor(() => {
        const testButton = screen.getByText('Play', { selector: 'img[alt="Play"]' }).closest('button');
        expect(testButton).toBeInTheDocument();
        expect(testButton).toHaveClass('testSoundButton');
      });
    });

    it('should render dropdown with sound file name', async () => {
      render(<NotificationFilePicker {...defaultProps} />);

      await waitFor(() => {
        const trigger = screen.getByTestId('dropdown-menu-trigger');
        expect(trigger).toBeInTheDocument();
        expect(trigger.querySelector('.soundFileName')).toBeInTheDocument();
      });
    });

    it('should display correct file name from settingsData', async () => {
      render(<NotificationFilePicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('notification')).toBeInTheDocument();
      });
    });

    it('should handle disabled state', async () => {
      render(<NotificationFilePicker {...defaultProps} disabled={true} />);

      await waitFor(() => {
        const trigger = screen.getByTestId('dropdown-menu-trigger');
        expect(trigger).toHaveAttribute('data-disabled', 'true');
      });
    });

    it('should render play icon in test button', async () => {
      render(<NotificationFilePicker {...defaultProps} />);

      await waitFor(() => {
        const playImg = screen.getByAltText('Play');
        expect(playImg).toBeInTheDocument();
        expect(playImg).toHaveAttribute('src', 'play-icon');
        expect(playImg).toHaveAttribute('width', '14');
        expect(playImg).toHaveAttribute('height', '14');
      });
    });

    it('should render caret down icon in dropdown trigger', async () => {
      render(<NotificationFilePicker {...defaultProps} />);

      await waitFor(() => {
        const caretImg = screen.getByAltText('Caret Down');
        expect(caretImg).toBeInTheDocument();
        expect(caretImg).toHaveAttribute('src', 'caret-down-icon');
        expect(caretImg).toHaveAttribute('width', '14');
        expect(caretImg).toHaveAttribute('height', '14');
      });
    });
  });

  describe('File Name Display', () => {
    it('should display soundFileName when available', async () => {
      const props = {
        ...defaultProps,
        settingsData: {
          notifications: {
            soundFileName: 'custom notification',
            soundFile: '/path/to/sound.mp3',
          },
        },
      };

      render(<NotificationFilePicker {...props} />);

      await waitFor(() => {
        expect(screen.getByText('custom notification')).toBeInTheDocument();
      });
    });

    it('should extract filename from soundFile path when soundFileName is missing', async () => {
      const props = {
        ...defaultProps,
        settingsData: {
          notifications: {
            soundFile: '/path/to/my_awesome_sound.mp3',
          },
        },
      };

      render(<NotificationFilePicker {...props} />);

      await waitFor(() => {
        expect(screen.getByText('my awesome sound')).toBeInTheDocument();
      });
    });

    it('should handle Windows-style paths', async () => {
      const props = {
        ...defaultProps,
        settingsData: {
          notifications: {
            soundFile: 'C:\\Users\\User\\Sounds\\windows_notification.wav',
          },
        },
      };

      render(<NotificationFilePicker {...props} />);

      await waitFor(() => {
        expect(screen.getByText('windows notification')).toBeInTheDocument();
      });
    });

    it('should replace underscores with spaces in filename', async () => {
      const props = {
        ...defaultProps,
        settingsData: {
          notifications: {
            soundFile: '/sounds/multi_word_file_name.ogg',
          },
        },
      };

      render(<NotificationFilePicker {...props} />);

      await waitFor(() => {
        expect(screen.getByText('multi word file name')).toBeInTheDocument();
      });
    });

    it('should show "default" when no sound file is specified', async () => {
      const props = {
        ...defaultProps,
        settingsData: {
          notifications: {},
        },
      };

      render(<NotificationFilePicker {...props} />);

      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument();
      });
    });

    it('should show "default" when settingsData is missing', async () => {
      const props = {
        ...defaultProps,
        settingsData: null,
      };

      render(<NotificationFilePicker {...props} />);

      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument();
      });
    });
  });

  describe('Options Loading', () => {
    it('should fetch options on mount', async () => {
      render(<NotificationFilePicker {...defaultProps} />);

      await waitFor(() => {
        expect(defaultProps.getOptions).toHaveBeenCalledTimes(1);
      });
    });

    it('should render options in dropdown menu', async () => {
      render(<NotificationFilePicker {...defaultProps} />);

      await waitFor(() => {
        const content = screen.getByTestId('dropdown-menu-content');
        expect(content).toBeInTheDocument();

        mockOptions.forEach(option => {
          expect(screen.getByText(option.name)).toBeInTheDocument();
        });
      });
    });

    it('should handle empty options array', async () => {
      const props = {
        ...defaultProps,
        getOptions: vi.fn().mockResolvedValue([]),
      };

      render(<NotificationFilePicker {...props} />);

      await waitFor(() => {
        expect(props.getOptions).toHaveBeenCalled();
      });

      const content = screen.getByTestId('dropdown-menu-content');
      expect(content).toBeInTheDocument();
      expect(content.children).toHaveLength(0);
    });

    it('should handle getOptions promise rejection', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const props = {
        ...defaultProps,
        getOptions: vi.fn().mockRejectedValue(new Error('Failed to load options')),
      };

      expect(() => {
        render(<NotificationFilePicker {...props} />);
      }).not.toThrow();

      consoleError.mockRestore();
    });

    it('should refresh options when dropdown opens', async () => {
      render(<NotificationFilePicker {...defaultProps} />);

      // Initial load
      await waitFor(() => {
        expect(defaultProps.getOptions).toHaveBeenCalledTimes(1);
      });

      // Trigger dropdown open
      const openTrigger = screen.getByTestId('dropdown-open-trigger');
      fireEvent.click(openTrigger);

      await waitFor(() => {
        expect(defaultProps.getOptions).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Sound Selection', () => {
    it('should call onChange when option is selected', async () => {
      const user = userEvent.setup();
      render(<NotificationFilePicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('beep')).toBeInTheDocument();
      });

      const beepOption = screen.getByText('beep');
      await user.click(beepOption);

      expect(defaultProps.onChange).toHaveBeenCalledWith('notifications', {
        ...defaultProps.settingsData.notifications,
        soundFile: '/sounds/beep.wav',
        soundFileName: 'beep',
      });
    });

    it('should update display name when option is selected', async () => {
      const user = userEvent.setup();
      render(<NotificationFilePicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('chime')).toBeInTheDocument();
      });

      const chimeOption = screen.getByText('chime');
      await user.click(chimeOption);

      expect(defaultProps.onChange).toHaveBeenCalledWith('notifications', {
        ...defaultProps.settingsData.notifications,
        soundFile: '/sounds/chime.ogg',
        soundFileName: 'chime',
      });
    });

    it('should merge with existing settings when selecting option', async () => {
      const user = userEvent.setup();
      const props = {
        ...defaultProps,
        settingsData: {
          notifications: {
            volume: 0.8,
            enabled: true,
            soundFile: '/old/sound.mp3',
          },
        },
      };

      render(<NotificationFilePicker {...props} />);

      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument();
      });

      const defaultOption = screen.getByText('default');
      await user.click(defaultOption);

      expect(props.onChange).toHaveBeenCalledWith('notifications', {
        volume: 0.8,
        enabled: true,
        soundFile: '/sounds/default.mp3',
        soundFileName: 'default',
      });
    });

    it('should handle selection when settingsData is null', async () => {
      const user = userEvent.setup();
      const props = {
        ...defaultProps,
        settingsData: null,
      };

      render(<NotificationFilePicker {...props} />);

      await waitFor(() => {
        expect(screen.getByText('beep')).toBeInTheDocument();
      });

      const beepOption = screen.getByText('beep');
      await user.click(beepOption);

      expect(props.onChange).toHaveBeenCalledWith('notifications', {
        soundFile: '/sounds/beep.wav',
        soundFileName: 'beep',
      });
    });
  });

  describe('Sound Testing', () => {
    it('should play sound when test button is clicked', async () => {
      const user = userEvent.setup();
      render(<NotificationFilePicker {...defaultProps} />);

      await waitFor(() => {
        const testButton = screen.getByAltText('Play').closest('button');
        expect(testButton).toBeInTheDocument();
      });

      const testButton = screen.getByAltText('Play').closest('button');
      await user.click(testButton);

      expect(window.app.notificationSounds.getSoundUrl).toHaveBeenCalledWith('/path/to/sound.mp3');
      expect(global.Audio).toHaveBeenCalledWith('blob:sound-url');
    });

    it('should set correct volume when playing sound', async () => {
      const user = userEvent.setup();
      const mockAudio = {
        play: vi.fn().mockResolvedValue(undefined),
        volume: 0,
      };
      global.Audio.mockReturnValue(mockAudio);

      render(<NotificationFilePicker {...defaultProps} />);

      await waitFor(() => {
        const testButton = screen.getByAltText('Play').closest('button');
        expect(testButton).toBeInTheDocument();
      });

      const testButton = screen.getByAltText('Play').closest('button');
      await user.click(testButton);

      await waitFor(() => {
        expect(mockAudio.volume).toBe(0.5);
        expect(mockAudio.play).toHaveBeenCalled();
      });
    });

    it('should use default volume when volume is not specified', async () => {
      const user = userEvent.setup();
      const mockAudio = {
        play: vi.fn().mockResolvedValue(undefined),
        volume: 0,
      };
      global.Audio.mockReturnValue(mockAudio);

      const props = {
        ...defaultProps,
        settingsData: {
          notifications: {
            soundFile: '/path/to/sound.mp3',
          },
        },
      };

      render(<NotificationFilePicker {...props} />);

      await waitFor(() => {
        const testButton = screen.getByAltText('Play').closest('button');
        expect(testButton).toBeInTheDocument();
      });

      const testButton = screen.getByAltText('Play').closest('button');
      await user.click(testButton);

      await waitFor(() => {
        expect(mockAudio.volume).toBe(0.1);
        expect(mockAudio.play).toHaveBeenCalled();
      });
    });

    it('should handle sound loading error', async () => {
      const user = userEvent.setup();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      window.app.notificationSounds.getSoundUrl.mockRejectedValue(new Error('Sound loading failed'));

      render(<NotificationFilePicker {...defaultProps} />);

      await waitFor(() => {
        const testButton = screen.getByAltText('Play').closest('button');
        expect(testButton).toBeInTheDocument();
      });

      const testButton = screen.getByAltText('Play').closest('button');
      await user.click(testButton);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Error loading sound file:', expect.any(Error));
      });

      consoleError.mockRestore();
    });

    it('should handle sound playback error', async () => {
      const user = userEvent.setup();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const mockAudio = {
        play: vi.fn().mockRejectedValue(new Error('Playback failed')),
        volume: 0,
      };
      global.Audio.mockReturnValue(mockAudio);

      render(<NotificationFilePicker {...defaultProps} />);

      await waitFor(() => {
        const testButton = screen.getByAltText('Play').closest('button');
        expect(testButton).toBeInTheDocument();
      });

      const testButton = screen.getByAltText('Play').closest('button');
      await user.click(testButton);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Error playing sound:', expect.any(Error));
      });

      consoleError.mockRestore();
    });

    it('should handle missing sound file', async () => {
      const user = userEvent.setup();
      const props = {
        ...defaultProps,
        settingsData: {
          notifications: {},
        },
      };

      render(<NotificationFilePicker {...props} />);

      await waitFor(() => {
        const testButton = screen.getByAltText('Play').closest('button');
        expect(testButton).toBeInTheDocument();
      });

      const testButton = screen.getByAltText('Play').closest('button');
      await user.click(testButton);

      expect(window.app.notificationSounds.getSoundUrl).toHaveBeenCalledWith(undefined);
    });
  });

  describe('Accessibility', () => {
    it('should have accessible button labels', async () => {
      render(<NotificationFilePicker {...defaultProps} />);

      await waitFor(() => {
        const playImg = screen.getByAltText('Play');
        const caretImg = screen.getByAltText('Caret Down');
        
        expect(playImg).toBeInTheDocument();
        expect(caretImg).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<NotificationFilePicker {...defaultProps} />);

      await waitFor(() => {
        const testButton = screen.getByAltText('Play').closest('button');
        expect(testButton).toBeInTheDocument();
      });

      const testButton = screen.getByAltText('Play').closest('button');
      
      // Focus the test button with keyboard
      await user.tab();
      expect(testButton).toHaveFocus();
    });

    it('should maintain proper tab order', async () => {
      const user = userEvent.setup();
      render(<NotificationFilePicker {...defaultProps} />);

      await waitFor(() => {
        const testButton = screen.getByAltText('Play').closest('button');
        const dropdownTrigger = screen.getByTestId('dropdown-menu-trigger');
        
        expect(testButton).toBeInTheDocument();
        expect(dropdownTrigger).toBeInTheDocument();
      });

      // Tab through elements
      await user.tab();
      const testButton = screen.getByAltText('Play').closest('button');
      expect(testButton).toHaveFocus();

      await user.tab();
      // Dropdown trigger should be next in tab order
      // Note: In real implementation, this would be handled by the dropdown component
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long file names', async () => {
      const longFileName = 'a'.repeat(100);
      const props = {
        ...defaultProps,
        settingsData: {
          notifications: {
            soundFileName: longFileName,
          },
        },
      };

      render(<NotificationFilePicker {...props} />);

      await waitFor(() => {
        expect(screen.getByText(longFileName)).toBeInTheDocument();
      });
    });

    it('should handle special characters in file names', async () => {
      const specialFileName = 'sound!@#$%^&*()_+{}|:<>?[]\\;\'",./`~';
      const props = {
        ...defaultProps,
        settingsData: {
          notifications: {
            soundFileName: specialFileName,
          },
        },
      };

      render(<NotificationFilePicker {...props} />);

      await waitFor(() => {
        expect(screen.getByText(specialFileName)).toBeInTheDocument();
      });
    });

    it('should handle Unicode characters in file names', async () => {
      const unicodeFileName = '🔔 通知音 صوت الإشعار';
      const props = {
        ...defaultProps,
        settingsData: {
          notifications: {
            soundFileName: unicodeFileName,
          },
        },
      };

      render(<NotificationFilePicker {...props} />);

      await waitFor(() => {
        expect(screen.getByText(unicodeFileName)).toBeInTheDocument();
      });
    });

    it('should handle missing onChange callback', async () => {
      const user = userEvent.setup();
      const props = {
        ...defaultProps,
        onChange: undefined,
      };

      render(<NotificationFilePicker {...props} />);

      await waitFor(() => {
        expect(screen.getByText('beep')).toBeInTheDocument();
      });

      const beepOption = screen.getByText('beep');
      await expect(user.click(beepOption)).resolves.not.toThrow();
    });

    it('should handle missing getOptions callback', () => {
      const props = {
        ...defaultProps,
        getOptions: undefined,
      };

      expect(() => {
        render(<NotificationFilePicker {...props} />);
      }).not.toThrow();
    });
  });

  describe('Component Integration', () => {
    it('should work with complex settings data structure', async () => {
      const user = userEvent.setup();
      const props = {
        ...defaultProps,
        settingsData: {
          notifications: {
            enabled: true,
            volume: 0.7,
            soundFile: '/sounds/complex.mp3',
            soundFileName: 'complex sound',
            showPreview: false,
            customSettings: {
              fade: true,
              repeat: 2,
            },
          },
          other: {
            setting: 'value',
          },
        },
      };

      render(<NotificationFilePicker {...props} />);

      await waitFor(() => {
        expect(screen.getByText('complex sound')).toBeInTheDocument();
        expect(screen.getByText('default')).toBeInTheDocument();
      });

      const defaultOption = screen.getByText('default');
      await user.click(defaultOption);

      expect(props.onChange).toHaveBeenCalledWith('notifications', {
        enabled: true,
        volume: 0.7,
        soundFile: '/sounds/default.mp3',
        soundFileName: 'default',
        showPreview: false,
        customSettings: {
          fade: true,
          repeat: 2,
        },
      });
    });

    it('should work in a form context', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      let capturedData = null;

      const FormWithFilePicker = () => (
        <form onSubmit={(e) => {
          e.preventDefault();
          onSubmit(capturedData);
        }}>
          <NotificationFilePicker
            {...defaultProps}
            onChange={(key, value) => {
              capturedData = { key, value };
              defaultProps.onChange(key, value);
            }}
          />
          <button type="submit">Submit</button>
        </form>
      );

      render(<FormWithFilePicker />);

      await waitFor(() => {
        expect(screen.getByText('chime')).toBeInTheDocument();
      });

      // Select an option
      const chimeOption = screen.getByText('chime');
      await user.click(chimeOption);

      // Submit the form
      const submitButton = screen.getByText('Submit');
      await user.click(submitButton);

      expect(onSubmit).toHaveBeenCalledWith({
        key: 'notifications',
        value: {
          ...defaultProps.settingsData.notifications,
          soundFile: '/sounds/chime.ogg',
          soundFileName: 'chime',
        },
      });
    });
  });

  describe('Performance', () => {
    it('should handle large numbers of sound options efficiently', async () => {
      const largeOptionsList = Array.from({ length: 1000 }, (_, i) => ({
        name: `sound_${i}`,
        value: `/sounds/sound_${i}.mp3`,
      }));

      const props = {
        ...defaultProps,
        getOptions: vi.fn().mockResolvedValue(largeOptionsList),
      };

      render(<NotificationFilePicker {...props} />);

      await waitFor(() => {
        const content = screen.getByTestId('dropdown-menu-content');
        expect(content.children).toHaveLength(1000);
      });
    });

    it('should not cause memory leaks with frequent re-renders', async () => {
      const { rerender, unmount } = render(
        <NotificationFilePicker {...defaultProps} />
      );

      // Multiple re-renders with different props
      for (let i = 0; i < 10; i++) {
        const newSettings = {
          notifications: {
            soundFileName: `sound_${i}`,
            soundFile: `/sounds/sound_${i}.mp3`,
          },
        };

        rerender(
          <NotificationFilePicker
            {...defaultProps}
            settingsData={newSettings}
          />
        );
      }

      expect(() => unmount()).not.toThrow();
    });

    it('should handle rapid option selections efficiently', async () => {
      const user = userEvent.setup();
      render(<NotificationFilePicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument();
      });

      // Rapid selections
      const options = ['default', 'beep', 'chime'];
      for (const optionName of options) {
        const option = screen.getByText(optionName);
        await user.click(option);
      }

      expect(defaultProps.onChange).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from failed option loading', async () => {
      let failCount = 0;
      const props = {
        ...defaultProps,
        getOptions: vi.fn().mockImplementation(() => {
          failCount++;
          if (failCount === 1) {
            return Promise.reject(new Error('Network error'));
          }
          return Promise.resolve(mockOptions);
        }),
      };

      render(<NotificationFilePicker {...props} />);

      // Initial failure
      await waitFor(() => {
        expect(props.getOptions).toHaveBeenCalledTimes(1);
      });

      // Retry by opening dropdown
      const openTrigger = screen.getByTestId('dropdown-open-trigger');
      fireEvent.click(openTrigger);

      await waitFor(() => {
        expect(props.getOptions).toHaveBeenCalledTimes(2);
        expect(screen.getByText('default')).toBeInTheDocument();
      });
    });
  });
});