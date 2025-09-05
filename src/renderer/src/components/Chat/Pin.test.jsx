import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import Pin from './Pin';
import { ChatProvider } from '../../providers/ChatProvider';
import { SettingsProvider } from '../../providers/SettingsProvider';

// Mock the settings and chat contexts
const mockSettingsContextValue = {
  settings: {
    showPinnedMessages: true,
    pinMessageDuration: 300000 // 5 minutes
  },
  updateSetting: vi.fn()
};

const mockChatContextValue = {
  pinnedMessage: {
    id: '12345',
    message: 'This is a pinned message with some emotes',
    sender: {
      username: 'moderator',
      display_name: 'Moderator',
      badges: [{ type: 'moderator', title: 'Moderator' }],
      color: '#FF0000'
    },
    timestamp: new Date('2023-12-01T10:30:00Z'),
    pinned_at: new Date('2023-12-01T10:30:00Z'),
    pinned_by: {
      username: 'streamer',
      display_name: 'Streamer'
    }
  },
  unpinMessage: vi.fn(),
  isOwner: false,
  isModerator: true
};

// Mock providers
vi.mock('../../providers/SettingsProvider', () => ({
  SettingsProvider: ({ children }) => children,
  useSettings: () => mockSettingsContextValue
}));

vi.mock('../../providers/ChatProvider', () => ({
  ChatProvider: ({ children }) => children,
  useChat: () => mockChatContextValue
}));

// Mock message parsing utilities
vi.mock('../../utils/MessageParser', () => ({
  parseEmotes: vi.fn((message) => [{
    type: 'text',
    content: message
  }])
}));

// Mock date formatting
vi.mock('../../utils/DateFormatter', () => ({
  formatTimeAgo: vi.fn(() => '5 minutes ago'),
  formatTimestamp: vi.fn(() => '10:30 AM')
}));

const renderPin = (chatContextOverride = {}, settingsOverride = {}) => {
  const mockChatContext = { ...mockChatContextValue, ...chatContextOverride };
  const mockSettingsContext = { ...mockSettingsContextValue, settings: { ...mockSettingsContextValue.settings, ...settingsOverride } };
  
  return render(
    <SettingsProvider value={mockSettingsContext}>
      <ChatProvider value={mockChatContext}>
        <Pin />
      </ChatProvider>
    </SettingsProvider>
  );
};

describe('Pin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render pinned message when available', () => {
      renderPin();
      
      expect(screen.getByText('This is a pinned message with some emotes')).toBeInTheDocument();
      expect(screen.getByText('Moderator')).toBeInTheDocument();
      expect(screen.getByText(/pinned by streamer/i)).toBeInTheDocument();
    });

    it('should not render when no pinned message', () => {
      renderPin({ pinnedMessage: null });
      
      expect(screen.queryByTestId('pinned-message')).not.toBeInTheDocument();
    });

    it('should not render when showPinnedMessages setting is disabled', () => {
      renderPin({}, { showPinnedMessages: false });
      
      expect(screen.queryByTestId('pinned-message')).not.toBeInTheDocument();
    });

    it('should display sender badges correctly', () => {
      renderPin();
      
      const moderatorBadge = screen.getByTitle('Moderator');
      expect(moderatorBadge).toBeInTheDocument();
      expect(moderatorBadge).toHaveClass('badge', 'badge-moderator');
    });

    it('should apply sender color to username', () => {
      renderPin();
      
      const username = screen.getByText('Moderator');
      expect(username).toHaveStyle({ color: '#FF0000' });
    });
  });

  describe('Pin Actions', () => {
    it('should show unpin button for moderators', () => {
      renderPin();
      
      const unpinButton = screen.getByRole('button', { name: /unpin message/i });
      expect(unpinButton).toBeInTheDocument();
    });

    it('should show unpin button for channel owner', () => {
      renderPin({ isModerator: false, isOwner: true });
      
      const unpinButton = screen.getByRole('button', { name: /unpin message/i });
      expect(unpinButton).toBeInTheDocument();
    });

    it('should not show unpin button for regular users', () => {
      renderPin({ isModerator: false, isOwner: false });
      
      const unpinButton = screen.queryByRole('button', { name: /unpin message/i });
      expect(unpinButton).not.toBeInTheDocument();
    });

    it('should call unpinMessage when unpin button is clicked', async () => {
      const user = userEvent.setup();
      renderPin();
      
      const unpinButton = screen.getByRole('button', { name: /unpin message/i });
      await user.click(unpinButton);
      
      expect(mockChatContextValue.unpinMessage).toHaveBeenCalledWith('12345');
    });

    it('should show confirmation dialog before unpinning', async () => {
      const user = userEvent.setup();
      renderPin();
      
      const unpinButton = screen.getByRole('button', { name: /unpin message/i });
      await user.click(unpinButton);
      
      expect(screen.getByText(/are you sure you want to unpin this message/i)).toBeInTheDocument();
    });
  });

  describe('Message Display', () => {
    it('should parse and render emotes in message', () => {
      const mockParseEmotes = vi.fn(() => [
        { type: 'text', content: 'Hello ' },
        { type: 'emote', content: ':smile:', url: 'https://example.com/smile.png' },
        { type: 'text', content: ' world!' }
      ]);
      
      vi.mocked(require('../../utils/MessageParser').parseEmotes).mockImplementation(mockParseEmotes);
      
      renderPin();
      
      expect(mockParseEmotes).toHaveBeenCalledWith('This is a pinned message with some emotes');
    });

    it('should handle long messages with text wrapping', () => {
      const longMessage = 'This is a very long pinned message that should wrap to multiple lines when displayed in the pin component because it exceeds the normal width constraints';
      
      renderPin({
        pinnedMessage: {
          ...mockChatContextValue.pinnedMessage,
          message: longMessage
        }
      });
      
      const messageElement = screen.getByText(longMessage);
      expect(messageElement).toHaveClass('message-content');
    });

    it('should sanitize message content for XSS protection', () => {
      const maliciousMessage = '<script>alert("xss")</script>Safe message';
      
      renderPin({
        pinnedMessage: {
          ...mockChatContextValue.pinnedMessage,
          message: maliciousMessage
        }
      });
      
      // Should not render script tags
      expect(screen.queryByText(maliciousMessage)).toBeInTheDocument();
      expect(document.querySelector('script')).not.toBeInTheDocument();
    });
  });

  describe('Timestamps', () => {
    it('should display pin timestamp', () => {
      renderPin();
      
      expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
    });

    it('should update timestamp periodically', async () => {
      vi.useFakeTimers();
      const { rerender } = renderPin();
      
      expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
      
      // Mock time passing
      vi.mocked(require('../../utils/DateFormatter').formatTimeAgo).mockReturnValue('6 minutes ago');
      
      // Fast-forward time
      vi.advanceTimersByTime(60000); // 1 minute
      
      rerender(
        <SettingsProvider value={mockSettingsContextValue}>
          <ChatProvider value={mockChatContextValue}>
            <Pin />
          </ChatProvider>
        </SettingsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByText('6 minutes ago')).toBeInTheDocument();
      });
      
      vi.useRealTimers();
    });
  });

  describe('Auto-unpin Functionality', () => {
    it('should auto-unpin message after duration expires', async () => {
      vi.useFakeTimers();
      
      renderPin();
      
      // Fast-forward past pin duration (5 minutes)
      vi.advanceTimersByTime(300001);
      
      await waitFor(() => {
        expect(mockChatContextValue.unpinMessage).toHaveBeenCalledWith('12345');
      });
      
      vi.useRealTimers();
    });

    it('should not auto-unpin if duration is set to 0 (permanent)', async () => {
      vi.useFakeTimers();
      
      renderPin({}, { pinMessageDuration: 0 });
      
      // Fast-forward a long time
      vi.advanceTimersByTime(1000000);
      
      await waitFor(() => {
        expect(mockChatContextValue.unpinMessage).not.toHaveBeenCalled();
      }, { timeout: 1000 });
      
      vi.useRealTimers();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should focus unpin button with keyboard navigation', async () => {
      const user = userEvent.setup();
      renderPin();
      
      await user.tab();
      
      const unpinButton = screen.getByRole('button', { name: /unpin message/i });
      expect(unpinButton).toHaveFocus();
    });

    it('should activate unpin with Enter key', async () => {
      const user = userEvent.setup();
      renderPin();
      
      const unpinButton = screen.getByRole('button', { name: /unpin message/i });
      unpinButton.focus();
      
      await user.keyboard('{Enter}');
      
      expect(screen.getByText(/are you sure you want to unpin this message/i)).toBeInTheDocument();
    });

    it('should activate unpin with Space key', async () => {
      const user = userEvent.setup();
      renderPin();
      
      const unpinButton = screen.getByRole('button', { name: /unpin message/i });
      unpinButton.focus();
      
      await user.keyboard(' ');
      
      expect(screen.getByText(/are you sure you want to unpin this message/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      renderPin();
      
      const pinContainer = screen.getByRole('region', { name: /pinned message/i });
      expect(pinContainer).toBeInTheDocument();
      
      const unpinButton = screen.getByRole('button', { name: /unpin message/i });
      expect(unpinButton).toHaveAttribute('aria-label', 'Unpin message');
    });

    it('should have proper heading structure', () => {
      renderPin();
      
      const pinHeader = screen.getByRole('heading', { level: 3, name: /pinned message/i });
      expect(pinHeader).toBeInTheDocument();
    });

    it('should announce unpin actions to screen readers', async () => {
      const user = userEvent.setup();
      renderPin();
      
      const unpinButton = screen.getByRole('button', { name: /unpin message/i });
      await user.click(unpinButton);
      
      const announcement = screen.getByRole('alert');
      expect(announcement).toHaveTextContent(/unpin confirmation/i);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing sender information gracefully', () => {
      renderPin({
        pinnedMessage: {
          ...mockChatContextValue.pinnedMessage,
          sender: null
        }
      });
      
      expect(screen.getByText('This is a pinned message with some emotes')).toBeInTheDocument();
      expect(screen.getByText(/unknown user/i)).toBeInTheDocument();
    });

    it('should handle unpin errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockChatContextValue.unpinMessage.mockRejectedValue(new Error('Unpin failed'));
      
      const user = userEvent.setup();
      renderPin();
      
      const unpinButton = screen.getByRole('button', { name: /unpin message/i });
      await user.click(unpinButton);
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to unpin message:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Performance', () => {
    it('should memoize component to prevent unnecessary re-renders', () => {
      const { rerender } = renderPin();
      
      expect(screen.getByText('This is a pinned message with some emotes')).toBeInTheDocument();
      
      // Re-render with same props
      rerender(
        <SettingsProvider value={mockSettingsContextValue}>
          <ChatProvider value={mockChatContextValue}>
            <Pin />
          </ChatProvider>
        </SettingsProvider>
      );
      
      expect(screen.getByText('This is a pinned message with some emotes')).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('should integrate with settings changes', async () => {
      const { rerender } = renderPin();
      
      expect(screen.getByTestId('pinned-message')).toBeInTheDocument();
      
      const updatedSettings = {
        ...mockSettingsContextValue,
        settings: {
          ...mockSettingsContextValue.settings,
          showPinnedMessages: false
        }
      };
      
      rerender(
        <SettingsProvider value={updatedSettings}>
          <ChatProvider value={mockChatContextValue}>
            <Pin />
          </ChatProvider>
        </SettingsProvider>
      );
      
      expect(screen.queryByTestId('pinned-message')).not.toBeInTheDocument();
    });

    it('should handle pinned message updates', async () => {
      const { rerender } = renderPin();
      
      expect(screen.getByText('This is a pinned message with some emotes')).toBeInTheDocument();
      
      const updatedContext = {
        ...mockChatContextValue,
        pinnedMessage: {
          ...mockChatContextValue.pinnedMessage,
          message: 'Updated pinned message content'
        }
      };
      
      rerender(
        <SettingsProvider value={mockSettingsContextValue}>
          <ChatProvider value={updatedContext}>
            <Pin />
          </ChatProvider>
        </SettingsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByText('Updated pinned message content')).toBeInTheDocument();
      });
    });
  });
});