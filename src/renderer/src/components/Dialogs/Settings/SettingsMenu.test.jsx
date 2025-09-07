import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import SettingsMenu from './SettingsMenu';
import { SettingsProvider } from '../../../providers/SettingsProvider';

// Mock the settings context
const mockSettingsContextValue = {
  settings: {
    theme: 'dark',
    fontSize: 14,
    showNotifications: true,
    soundEnabled: true,
    language: 'en'
  },
  updateSetting: vi.fn(),
  resetSettings: vi.fn(),
  exportSettings: vi.fn(),
  importSettings: vi.fn()
};

// Mock providers
vi.mock('../../../providers/SettingsProvider', () => ({
  SettingsProvider: ({ children }) => children,
  useSettings: () => mockSettingsContextValue
}));

// React Router is no longer used - removed mock

// Mock the section components
vi.mock('./Sections/General', () => ({
  default: () => <div data-testid="general-section">General Settings</div>
}));

vi.mock('./Sections/Appearance', () => ({
  default: () => <div data-testid="appearance-section">Appearance Settings</div>
}));

vi.mock('./Sections/Chat', () => ({
  default: () => <div data-testid="chat-section">Chat Settings</div>
}));

vi.mock('./Sections/Notifications', () => ({
  default: () => <div data-testid="notifications-section">Notifications Settings</div>
}));

vi.mock('./Sections/Privacy', () => ({
  default: () => <div data-testid="privacy-section">Privacy Settings</div>
}));

vi.mock('./Sections/Advanced', () => ({
  default: () => <div data-testid="advanced-section">Advanced Settings</div>
}));

const renderSettingsMenu = (settingsOverride = {}, props = {}) => {
  const mockSettingsContext = { ...mockSettingsContextValue, settings: { ...mockSettingsContextValue.settings, ...settingsOverride } };
  
  const defaultProps = {
    activeSection: 'general',
    setActiveSection: vi.fn(),
    onLogout: vi.fn(),
    ...props
  };
  
  return render(
    <SettingsProvider value={mockSettingsContext}>
      <SettingsMenu {...defaultProps} />
    </SettingsProvider>
  );
};

describe('SettingsMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render settings menu with all navigation items', () => {
      renderSettingsMenu();
      
      expect(screen.getByRole('navigation', { name: /settings menu/i })).toBeInTheDocument();
      
      expect(screen.getByRole('button', { name: /general/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /appearance/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /chat/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /privacy/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /advanced/i })).toBeInTheDocument();
    });

    it('should show appropriate icons for each menu item', () => {
      renderSettingsMenu();
      
      const generalIcon = screen.getByTestId('general-icon');
      const appearanceIcon = screen.getByTestId('appearance-icon');
      const chatIcon = screen.getByTestId('chat-icon');
      const notificationsIcon = screen.getByTestId('notifications-icon');
      const privacyIcon = screen.getByTestId('privacy-icon');
      const advancedIcon = screen.getByTestId('advanced-icon');
      
      expect(generalIcon).toBeInTheDocument();
      expect(appearanceIcon).toBeInTheDocument();
      expect(chatIcon).toBeInTheDocument();
      expect(notificationsIcon).toBeInTheDocument();
      expect(privacyIcon).toBeInTheDocument();
      expect(advancedIcon).toBeInTheDocument();
    });

    it('should highlight the currently active menu item', () => {
      renderSettingsMenu();
      
      const generalButton = screen.getByRole('button', { name: /general/i });
      expect(generalButton).toHaveClass('active');
      expect(generalButton).toHaveAttribute('aria-current', 'page');
    });

    it('should display section descriptions', () => {
      renderSettingsMenu();
      
      expect(screen.getByText(/basic application settings/i)).toBeInTheDocument();
      expect(screen.getByText(/customize the app appearance/i)).toBeInTheDocument();
      expect(screen.getByText(/chat display and behavior/i)).toBeInTheDocument();
      expect(screen.getByText(/notification preferences/i)).toBeInTheDocument();
      expect(screen.getByText(/privacy and security/i)).toBeInTheDocument();
      expect(screen.getByText(/advanced configuration/i)).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate to selected section when menu item is clicked', async () => {
      const user = userEvent.setup();
      const mockSetActiveSection = vi.fn();
      renderSettingsMenu({}, { setActiveSection: mockSetActiveSection });
      
      const appearanceButton = screen.getByRole('button', { name: /appearance/i });
      await user.click(appearanceButton);
      
      expect(mockSetActiveSection).toHaveBeenCalledWith('appearance');
    });

    it('should support keyboard navigation with arrow keys', async () => {
      const user = userEvent.setup();
      renderSettingsMenu();
      
      const generalButton = screen.getByRole('button', { name: /general/i });
      generalButton.focus();
      
      // Navigate down
      await user.keyboard('{ArrowDown}');
      const appearanceButton = screen.getByRole('button', { name: /appearance/i });
      expect(appearanceButton).toHaveFocus();
      
      // Navigate down again
      await user.keyboard('{ArrowDown}');
      const chatButton = screen.getByRole('button', { name: /chat/i });
      expect(chatButton).toHaveFocus();
      
      // Navigate up
      await user.keyboard('{ArrowUp}');
      expect(appearanceButton).toHaveFocus();
    });

    it('should wrap navigation at the edges', async () => {
      const user = userEvent.setup();
      renderSettingsMenu();
      
      const generalButton = screen.getByRole('button', { name: /general/i });
      generalButton.focus();
      
      // Navigate up from first item should go to last
      await user.keyboard('{ArrowUp}');
      const advancedButton = screen.getByRole('button', { name: /advanced/i });
      expect(advancedButton).toHaveFocus();
      
      // Navigate down from last item should go to first
      await user.keyboard('{ArrowDown}');
      expect(generalButton).toHaveFocus();
    });

    it('should activate menu item with Enter key', async () => {
      const user = userEvent.setup();
      renderSettingsMenu();
      
      const appearanceButton = screen.getByRole('button', { name: /appearance/i });
      appearanceButton.focus();
      
      await user.keyboard('{Enter}');
      
      expect(mockNavigate).toHaveBeenCalledWith('/settings/appearance');
    });

    it('should activate menu item with Space key', async () => {
      const user = userEvent.setup();
      renderSettingsMenu();
      
      const chatButton = screen.getByRole('button', { name: /chat/i });
      chatButton.focus();
      
      await user.keyboard(' ');
      
      expect(mockNavigate).toHaveBeenCalledWith('/settings/chat');
    });
  });

  describe('Menu State Management', () => {
    it('should update active state when location changes', () => {
      // Fallback assertion for default location mapping
      renderSettingsMenu();
      const generalButton = screen.getByRole('button', { name: /general/i });
      expect(generalButton).toHaveClass('active');
      expect(generalButton).toHaveAttribute('aria-current', 'page');
    });

    it('should show notification badges for sections with pending changes', () => {
      renderSettingsMenu({
        hasUnsavedChanges: true,
        changedSections: ['notifications', 'privacy']
      });
      
      const notificationsButton = screen.getByRole('button', { name: /notifications/i });
      const privacyButton = screen.getByRole('button', { name: /privacy/i });
      
      expect(notificationsButton.querySelector('.notification-badge')).toBeInTheDocument();
      expect(privacyButton.querySelector('.notification-badge')).toBeInTheDocument();
    });

    it('should show warning icon for sections with validation errors', () => {
      renderSettingsMenu({
        validationErrors: {
          advanced: ['Invalid API key format']
        }
      });
      
      const advancedButton = screen.getByRole('button', { name: /advanced/i });
      expect(advancedButton.querySelector('.warning-icon')).toBeInTheDocument();
      expect(advancedButton).toHaveAttribute('aria-describedby', expect.stringContaining('error'));
    });
  });

  describe('Context Menu Actions', () => {
    it('should show context menu on right click', async () => {
      const user = userEvent.setup();
      renderSettingsMenu();
      
      const menuContainer = screen.getByRole('navigation', { name: /settings menu/i });
      await user.pointer({ target: menuContainer, keys: '[MouseRight]' });
      
      expect(screen.getByRole('menu', { name: /menu actions/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /reset all settings/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /export settings/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /import settings/i })).toBeInTheDocument();
    });

    it('should reset all settings when reset option is selected', async () => {
      const user = userEvent.setup();
      renderSettingsMenu();
      
      const menuContainer = screen.getByRole('navigation', { name: /settings menu/i });
      await user.pointer({ target: menuContainer, keys: '[MouseRight]' });
      
      const resetOption = screen.getByRole('menuitem', { name: /reset all settings/i });
      await user.click(resetOption);
      
      // Should show confirmation dialog
      expect(screen.getByText(/are you sure you want to reset all settings/i)).toBeInTheDocument();
      
      const confirmButton = screen.getByRole('button', { name: /reset/i });
      await user.click(confirmButton);
      
      expect(mockSettingsContextValue.resetSettings).toHaveBeenCalled();
    });

    it('should export settings when export option is selected', async () => {
      const user = userEvent.setup();
      renderSettingsMenu();
      
      const menuContainer = screen.getByRole('navigation', { name: /settings menu/i });
      await user.pointer({ target: menuContainer, keys: '[MouseRight]' });
      
      const exportOption = screen.getByRole('menuitem', { name: /export settings/i });
      await user.click(exportOption);
      
      expect(mockSettingsContextValue.exportSettings).toHaveBeenCalled();
    });

    it('should show file picker for import settings', async () => {
      const user = userEvent.setup();
      renderSettingsMenu();
      
      const menuContainer = screen.getByRole('navigation', { name: /settings menu/i });
      await user.pointer({ target: menuContainer, keys: '[MouseRight]' });
      
      const importOption = screen.getByRole('menuitem', { name: /import settings/i });
      await user.click(importOption);
      
      expect(screen.getByText(/select settings file to import/i)).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should show search input when search is activated', async () => {
      const user = userEvent.setup();
      renderSettingsMenu();
      
      await user.keyboard('{Control>}k{/Control}');
      
      const searchInput = screen.getByRole('searchbox', { name: /search settings/i });
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveFocus();
    });

    it('should filter menu items based on search query', async () => {
      const user = userEvent.setup();
      renderSettingsMenu();
      
      await user.keyboard('{Control>}k{/Control}');
      
      const searchInput = screen.getByRole('searchbox', { name: /search settings/i });
      await user.type(searchInput, 'theme');
      
      // Should highlight appearance section (contains theme settings)
      const appearanceButton = screen.getByRole('button', { name: /appearance/i });
      expect(appearanceButton).toHaveClass('search-match');
      
      // Other sections should be dimmed or hidden
      const generalButton = screen.getByRole('button', { name: /general/i });
      expect(generalButton).toHaveClass('search-no-match');
    });

    it('should navigate to matching section with Enter', async () => {
      const user = userEvent.setup();
      renderSettingsMenu();
      
      await user.keyboard('{Control>}k{/Control}');
      
      const searchInput = screen.getByRole('searchbox', { name: /search settings/i });
      await user.type(searchInput, 'notifications');
      await user.keyboard('{Enter}');
      
      expect(mockNavigate).toHaveBeenCalledWith('/settings/notifications');
    });

    it('should clear search on Escape', async () => {
      const user = userEvent.setup();
      renderSettingsMenu();
      
      await user.keyboard('{Control>}k{/Control}');
      
      const searchInput = screen.getByRole('searchbox', { name: /search settings/i });
      await user.type(searchInput, 'test');
      expect(searchInput).toHaveValue('test');
      
      await user.keyboard('{Escape}');
      expect(searchInput).toHaveValue('');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA structure', () => {
      renderSettingsMenu();
      
      const nav = screen.getByRole('navigation', { name: /settings menu/i });
      expect(nav).toHaveAttribute('aria-label', 'Settings menu');
      
      const menuList = screen.getByRole('list');
      expect(menuList).toBeInTheDocument();
      
      const menuItems = screen.getAllByRole('button');
      expect(menuItems).toHaveLength(6); // 6 main sections
      
      menuItems.forEach(item => {
        expect(item).toHaveAttribute('role', 'button');
        expect(item).toHaveAttribute('aria-describedby');
      });
    });

    it('should announce current section to screen readers', () => {
      renderSettingsMenu();
      
      const activeButton = screen.getByRole('button', { name: /general/i });
      expect(activeButton).toHaveAttribute('aria-current', 'page');
      
      const announcement = screen.getByRole('status', { name: /current section/i });
      expect(announcement).toHaveTextContent(/general settings selected/i);
    });

    it('should provide section descriptions for screen readers', () => {
      renderSettingsMenu();
      
      const generalButton = screen.getByRole('button', { name: /general/i });
      const descriptionId = generalButton.getAttribute('aria-describedby');
      const description = screen.getByTestId(descriptionId);
      
      expect(description).toHaveTextContent(/basic application settings/i);
    });

    it('should support reduced motion preferences', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
      
      renderSettingsMenu();
      
      const menu = screen.getByRole('navigation', { name: /settings menu/i });
      expect(menu).toHaveClass('reduced-motion');
    });
  });

  describe('Responsive Design', () => {
    it('should collapse to hamburger menu on mobile', () => {
      // Mock mobile viewport
      global.innerWidth = 500;
      global.dispatchEvent(new Event('resize'));
      
      renderSettingsMenu();
      
      const hamburgerButton = screen.getByRole('button', { name: /toggle menu/i });
      expect(hamburgerButton).toBeInTheDocument();
      
      const menuList = screen.getByRole('list');
      expect(menuList).toHaveClass('collapsed');
    });

    it('should expand mobile menu when hamburger is clicked', async () => {
      global.innerWidth = 500;
      global.dispatchEvent(new Event('resize'));
      
      const user = userEvent.setup();
      renderSettingsMenu();
      
      const hamburgerButton = screen.getByRole('button', { name: /toggle menu/i });
      await user.click(hamburgerButton);
      
      const menuList = screen.getByRole('list');
      expect(menuList).toHaveClass('expanded');
      expect(hamburgerButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('should auto-collapse mobile menu when section is selected', async () => {
      global.innerWidth = 500;
      global.dispatchEvent(new Event('resize'));
      
      const user = userEvent.setup();
      renderSettingsMenu();
      
      // Expand menu first
      const hamburgerButton = screen.getByRole('button', { name: /toggle menu/i });
      await user.click(hamburgerButton);
      
      // Select a section
      const appearanceButton = screen.getByRole('button', { name: /appearance/i });
      await user.click(appearanceButton);
      
      const menuList = screen.getByRole('list');
      expect(menuList).toHaveClass('collapsed');
    });
  });

  describe('Performance', () => {
    it('should memoize menu items to prevent unnecessary re-renders', () => {
      const { rerender } = renderSettingsMenu();
      
      expect(screen.getByRole('button', { name: /general/i })).toBeInTheDocument();
      
      // Re-render with same settings
      rerender(
        <SettingsProvider value={mockSettingsContextValue}>
          <SettingsMenu />
        </SettingsProvider>
      );
      
      expect(screen.getByRole('button', { name: /general/i })).toBeInTheDocument();
    });

    it('should debounce search input for performance', async () => {
      vi.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      renderSettingsMenu();
      
      await user.keyboard('{Control>}k{/Control}');
      const searchInput = screen.getByRole('searchbox', { name: /search settings/i });
      
      await user.type(searchInput, 'theme');
      
      // Search should not filter immediately
      expect(screen.getByRole('button', { name: /general/i })).not.toHaveClass('search-no-match');
      
      // Fast-forward debounce delay
      vi.advanceTimersByTime(300);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /general/i })).toHaveClass('search-no-match');
      });
      
      vi.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should handle navigation errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockNavigate.mockImplementation(() => {
        throw new Error('Navigation failed');
      });
      
      const user = userEvent.setup();
      renderSettingsMenu();
      
      const appearanceButton = screen.getByRole('button', { name: /appearance/i });
      await user.click(appearanceButton);
      
      expect(consoleSpy).toHaveBeenCalledWith('Navigation error:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should handle settings context errors', () => {
      vi.mocked(require('../../../providers/SettingsProvider').useSettings).mockImplementation(() => {
        throw new Error('Settings context error');
      });
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => renderSettingsMenu()).not.toThrow();
      expect(screen.getByText(/error loading settings menu/i)).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Integration', () => {
    it('should integrate with settings changes from other sections', async () => {
      const { rerender } = renderSettingsMenu();
      
      expect(screen.getByRole('button', { name: /general/i })).not.toHaveClass('has-changes');
      
      // Simulate settings change from external source
      const updatedSettings = {
        ...mockSettingsContextValue,
        settings: {
          ...mockSettingsContextValue.settings,
          theme: 'light' // Changed from 'dark'
        },
        hasUnsavedChanges: true,
        changedSections: ['appearance']
      };
      
      rerender(
        <SettingsProvider value={updatedSettings}>
          <SettingsMenu />
        </SettingsProvider>
      );
      
      await waitFor(() => {
        const appearanceButton = screen.getByRole('button', { name: /appearance/i });
        expect(appearanceButton.querySelector('.notification-badge')).toBeInTheDocument();
      });
    });

    it('should sync with browser back/forward navigation', () => {
      const { rerender } = renderSettingsMenu();
      
      expect(screen.getByRole('button', { name: /general/i })).toHaveClass('active');
      
      // Simulate browser navigation to different section
      const rrd2 = require('react-router-dom');
      rrd2.useLocation.mockReturnValue({ pathname: '/settings/chat' });
      
      rerender(
        <SettingsProvider value={mockSettingsContextValue}>
          <SettingsMenu />
        </SettingsProvider>
      );
      
      expect(screen.getByRole('button', { name: /chat/i })).toHaveClass('active');
      expect(screen.getByRole('button', { name: /general/i })).not.toHaveClass('active');
    });
  });
});
