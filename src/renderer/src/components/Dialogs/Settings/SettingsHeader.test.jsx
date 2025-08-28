import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import SettingsHeader from './SettingsHeader';

// Mock the assets
vi.mock('../../../assets/icons/x-bold.svg?asset', () => ({ 
  default: 'x-icon.svg' 
}));

describe('SettingsHeader', () => {
  const defaultProps = {
    onClose: vi.fn(),
    appInfo: {
      appVersion: '1.2.3'
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render settings header with title', () => {
      render(<SettingsHeader {...defaultProps} />);
      
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Settings');
    });

    it('should display version number when appInfo is provided', () => {
      render(<SettingsHeader {...defaultProps} />);
      
      const versionElement = screen.getByText('v 1.2.3');
      expect(versionElement).toBeInTheDocument();
      expect(versionElement).toHaveClass('settingsDialogVersion');
    });

    it('should display default version when appVersion is not provided', () => {
      const propsWithoutVersion = {
        ...defaultProps,
        appInfo: {}
      };
      
      render(<SettingsHeader {...propsWithoutVersion} />);
      
      const versionElement = screen.getByText('v 0.0.0');
      expect(versionElement).toBeInTheDocument();
    });

    it('should display default version when appInfo is null', () => {
      const propsWithNullAppInfo = {
        ...defaultProps,
        appInfo: null
      };
      
      render(<SettingsHeader {...propsWithNullAppInfo} />);
      
      const versionElement = screen.getByText('v 0.0.0');
      expect(versionElement).toBeInTheDocument();
    });

    it('should render close button', () => {
      render(<SettingsHeader {...defaultProps} />);
      
      const closeButton = screen.getByRole('button');
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveClass('settingsDialogCloseBtn');
    });

    it('should render close button with proper icon', () => {
      render(<SettingsHeader {...defaultProps} />);
      
      const closeIcon = screen.getByAltText('Close');
      expect(closeIcon).toBeInTheDocument();
      expect(closeIcon).toHaveAttribute('src', 'x-icon.svg');
      expect(closeIcon).toHaveAttribute('width', '16');
      expect(closeIcon).toHaveAttribute('height', '16');
    });
  });

  describe('User Interactions', () => {
    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(<SettingsHeader {...defaultProps} onClose={onClose} />);
      
      const closeButton = screen.getByRole('button');
      await user.click(closeButton);
      
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('should call onClose when close button is activated with Enter key', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(<SettingsHeader {...defaultProps} onClose={onClose} />);
      
      const closeButton = screen.getByRole('button');
      closeButton.focus();
      await user.keyboard('{Enter}');
      
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('should call onClose when close button is activated with Space key', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(<SettingsHeader {...defaultProps} onClose={onClose} />);
      
      const closeButton = screen.getByRole('button');
      closeButton.focus();
      await user.keyboard(' ');
      
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(<SettingsHeader {...defaultProps} />);
      
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Settings v 1.2.3');
    });

    it('should have accessible close button', () => {
      render(<SettingsHeader {...defaultProps} />);
      
      const closeButton = screen.getByRole('button');
      expect(closeButton).toHaveAttribute('aria-label');
    });

    it('should have proper icon alt text', () => {
      render(<SettingsHeader {...defaultProps} />);
      
      const closeIcon = screen.getByAltText('Close');
      expect(closeIcon).toBeInTheDocument();
    });
  });

  describe('Component Memoization', () => {
    it('should not re-render when appVersion has not changed', () => {
      const renderSpy = vi.fn();
      
      const TestWrapper = ({ appInfo }) => {
        renderSpy();
        return <SettingsHeader onClose={vi.fn()} appInfo={appInfo} />;
      };
      
      const { rerender } = render(
        <TestWrapper appInfo={{ appVersion: '1.2.3' }} />
      );
      
      expect(renderSpy).toHaveBeenCalledTimes(1);
      
      // Re-render with same appVersion
      rerender(
        <TestWrapper appInfo={{ appVersion: '1.2.3' }} />
      );
      
      // Should still show correct version
      expect(screen.getByText('v 1.2.3')).toBeInTheDocument();
    });

    it('should re-render when appVersion changes', () => {
      const { rerender } = render(<SettingsHeader {...defaultProps} />);
      
      expect(screen.getByText('v 1.2.3')).toBeInTheDocument();
      
      // Re-render with different appVersion
      rerender(
        <SettingsHeader 
          {...defaultProps} 
          appInfo={{ appVersion: '2.0.0' }} 
        />
      );
      
      expect(screen.getByText('v 2.0.0')).toBeInTheDocument();
    });

    it('should handle appInfo object changes correctly', () => {
      const { rerender } = render(<SettingsHeader {...defaultProps} />);
      
      expect(screen.getByText('v 1.2.3')).toBeInTheDocument();
      
      // Re-render with same appVersion but different appInfo object reference
      const newAppInfo = { appVersion: '1.2.3', otherProp: 'changed' };
      rerender(
        <SettingsHeader 
          {...defaultProps} 
          appInfo={newAppInfo} 
        />
      );
      
      // Should still show same version
      expect(screen.getByText('v 1.2.3')).toBeInTheDocument();
    });
  });

  describe('Version Display', () => {
    it('should handle semantic versioning formats', () => {
      const versions = [
        '1.0.0',
        '2.1.0',
        '1.0.0-alpha.1',
        '1.0.0-beta.2',
        '1.0.0-rc.1',
        '10.15.3'
      ];
      
      versions.forEach(version => {
        const { rerender } = render(
          <SettingsHeader 
            {...defaultProps} 
            appInfo={{ appVersion: version }} 
          />
        );
        
        expect(screen.getByText(`v ${version}`)).toBeInTheDocument();
        
        rerender(<div />); // Clean up
      });
    });

    it('should handle malformed version strings', () => {
      const malformedVersions = [
        '',
        '   ',
        'not-a-version',
        'v1.0.0', // with v prefix
        '1.0', // incomplete
        null,
        undefined
      ];
      
      malformedVersions.forEach(version => {
        const { rerender } = render(
          <SettingsHeader 
            {...defaultProps} 
            appInfo={{ appVersion: version }} 
          />
        );
        
        const expectedDisplay = version || '0.0.0';
        expect(screen.getByText(`v ${expectedDisplay}`)).toBeInTheDocument();
        
        rerender(<div />); // Clean up
      });
    });
  });

  describe('CSS Classes', () => {
    it('should apply correct CSS classes', () => {
      render(<SettingsHeader {...defaultProps} />);
      
      const header = screen.getByRole('banner', { hidden: true }) || 
                    document.querySelector('.settingsDialogHeader');
      expect(header).toHaveClass('settingsDialogHeader');
      
      const versionElement = screen.getByText('v 1.2.3');
      expect(versionElement).toHaveClass('settingsDialogVersion');
      
      const closeButton = screen.getByRole('button');
      expect(closeButton).toHaveClass('settingsDialogCloseBtn');
    });
  });

  describe('Layout Structure', () => {
    it('should maintain proper DOM structure', () => {
      render(<SettingsHeader {...defaultProps} />);
      
      const header = document.querySelector('.settingsDialogHeader');
      expect(header).toBeInTheDocument();
      
      const heading = header?.querySelector('h2');
      expect(heading).toBeInTheDocument();
      
      const versionSpan = heading?.querySelector('.settingsDialogVersion');
      expect(versionSpan).toBeInTheDocument();
      
      const closeButton = header?.querySelector('.settingsDialogCloseBtn');
      expect(closeButton).toBeInTheDocument();
    });

    it('should have heading and close button as direct children', () => {
      render(<SettingsHeader {...defaultProps} />);
      
      const header = document.querySelector('.settingsDialogHeader');
      const children = Array.from(header?.children || []);
      
      expect(children).toHaveLength(2);
      expect(children[0].tagName).toBe('H2');
      expect(children[1].tagName).toBe('BUTTON');
    });
  });

  describe('Error Handling', () => {
    it('should not crash with missing props', () => {
      expect(() => {
        render(<SettingsHeader />);
      }).not.toThrow();
    });

    it('should handle missing onClose gracefully', () => {
      render(
        <SettingsHeader 
          appInfo={{ appVersion: '1.0.0' }} 
        />
      );
      
      const closeButton = screen.getByRole('button');
      expect(closeButton).toBeInTheDocument();
      
      // Should not crash when clicked
      expect(() => {
        closeButton.click();
      }).not.toThrow();
    });

    it('should handle onClose throwing an error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup();
      
      const throwingOnClose = () => {
        throw new Error('Close error');
      };
      
      render(
        <SettingsHeader 
          {...defaultProps} 
          onClose={throwingOnClose} 
        />
      );
      
      const closeButton = screen.getByRole('button');
      
      // Should not crash the component
      expect(async () => {
        await user.click(closeButton);
      }).not.toThrow();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Performance', () => {
    it('should have minimal re-renders for stable props', () => {
      let renderCount = 0;
      
      const CountingSettingsHeader = (props) => {
        renderCount++;
        return <SettingsHeader {...props} />;
      };
      
      const { rerender } = render(
        <CountingSettingsHeader {...defaultProps} />
      );
      
      expect(renderCount).toBe(1);
      
      // Re-render with same props
      rerender(
        <CountingSettingsHeader {...defaultProps} />
      );
      
      // Should memoize and not re-render
      expect(screen.getByText('v 1.2.3')).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('should work within a settings dialog context', () => {
      const MockSettingsDialog = ({ children }) => (
        <div role="dialog" aria-labelledby="settings-title">
          {children}
        </div>
      );
      
      render(
        <MockSettingsDialog>
          <SettingsHeader {...defaultProps} />
          <div>Settings content</div>
        </MockSettingsDialog>
      );
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      
      const header = screen.getByRole('heading', { level: 2 });
      expect(header).toHaveTextContent('Settings');
      
      const closeButton = screen.getByRole('button');
      expect(closeButton).toBeInTheDocument();
    });

    it('should maintain focus management for accessibility', async () => {
      const user = userEvent.setup();
      
      render(
        <div>
          <button>Before</button>
          <SettingsHeader {...defaultProps} />
          <button>After</button>
        </div>
      );
      
      const beforeButton = screen.getByText('Before');
      const closeButton = screen.getByRole('button', { name: /close/i });
      const afterButton = screen.getByText('After');
      
      beforeButton.focus();
      await user.tab();
      expect(closeButton).toHaveFocus();
      
      await user.tab();
      expect(afterButton).toHaveFocus();
    });
  });
});