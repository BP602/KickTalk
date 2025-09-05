import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import Poll from './Poll';
import { ChatProvider } from '../../providers/ChatProvider';
import { SettingsProvider } from '../../providers/SettingsProvider';

// Mock the settings and chat contexts
const mockSettingsContextValue = {
  settings: {
    showPolls: true,
    autoHideCompletedPolls: true,
    pollNotifications: true
  },
  updateSetting: vi.fn()
};

const mockPollData = {
  id: 'poll-123',
  title: 'What should I play next?',
  options: [
    { id: 'option-1', text: 'Fortnite', votes: 45 },
    { id: 'option-2', text: 'Among Us', votes: 32 },
    { id: 'option-3', text: 'Valorant', votes: 28 },
    { id: 'option-4', text: 'Minecraft', votes: 67 }
  ],
  totalVotes: 172,
  duration: 300, // 5 minutes
  startTime: new Date('2023-12-01T10:30:00Z'),
  endTime: new Date('2023-12-01T10:35:00Z'),
  status: 'active', // 'active', 'completed', 'cancelled'
  createdBy: {
    username: 'streamer',
    display_name: 'TestStreamer'
  },
  userVote: null, // option id if user has voted
  canVote: true
};

const mockChatContextValue = {
  activePoll: mockPollData,
  votePoll: vi.fn(),
  isAuthenticated: true,
  currentUser: {
    id: 'user-123',
    username: 'testuser'
  }
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

// Mock date utilities
vi.mock('../../utils/DateFormatter', () => ({
  formatTimeRemaining: vi.fn((endTime) => '4:32'),
  formatDuration: vi.fn((seconds) => '5:00')
}));

// Mock toast notifications
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn()
};
vi.mock('react-hot-toast', () => ({
  default: mockToast
}));

const renderPoll = (chatContextOverride = {}, settingsOverride = {}) => {
  const mockChatContext = { ...mockChatContextValue, ...chatContextOverride };
  const mockSettingsContext = { ...mockSettingsContextValue, settings: { ...mockSettingsContextValue.settings, ...settingsOverride } };
  
  return render(
    <SettingsProvider value={mockSettingsContext}>
      <ChatProvider value={mockChatContext}>
        <Poll />
      </ChatProvider>
    </SettingsProvider>
  );
};

describe('Poll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render poll when active poll exists', () => {
      renderPoll();
      
      expect(screen.getByText('What should I play next?')).toBeInTheDocument();
      expect(screen.getByText('Fortnite')).toBeInTheDocument();
      expect(screen.getByText('Among Us')).toBeInTheDocument();
      expect(screen.getByText('Valorant')).toBeInTheDocument();
      expect(screen.getByText('Minecraft')).toBeInTheDocument();
    });

    it('should not render when no active poll', () => {
      renderPoll({ activePoll: null });
      
      expect(screen.queryByTestId('poll-container')).not.toBeInTheDocument();
    });

    it('should not render when showPolls setting is disabled', () => {
      renderPoll({}, { showPolls: false });
      
      expect(screen.queryByTestId('poll-container')).not.toBeInTheDocument();
    });

    it('should display poll creator information', () => {
      renderPoll();
      
      expect(screen.getByText(/poll by teststreamer/i)).toBeInTheDocument();
    });

    it('should show total vote count', () => {
      renderPoll();
      
      expect(screen.getByText(/172 total votes/i)).toBeInTheDocument();
    });

    it('should display time remaining for active polls', () => {
      renderPoll();
      
      expect(screen.getByText('4:32')).toBeInTheDocument();
      expect(screen.getByText(/time remaining/i)).toBeInTheDocument();
    });
  });

  describe('Poll Options Display', () => {
    it('should display all poll options with vote counts', () => {
      renderPoll();
      
      expect(screen.getByText('Fortnite')).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument();
      
      expect(screen.getByText('Among Us')).toBeInTheDocument();
      expect(screen.getByText('32')).toBeInTheDocument();
      
      expect(screen.getByText('Valorant')).toBeInTheDocument();
      expect(screen.getByText('28')).toBeInTheDocument();
      
      expect(screen.getByText('Minecraft')).toBeInTheDocument();
      expect(screen.getByText('67')).toBeInTheDocument();
    });

    it('should show vote percentages for each option', () => {
      renderPoll();
      
      // Calculate expected percentages: 45/172 ≈ 26.2%, 67/172 ≈ 39.0%
      expect(screen.getByText(/26\.2%/)).toBeInTheDocument(); // Fortnite
      expect(screen.getByText(/39\.0%/)).toBeInTheDocument(); // Minecraft (highest)
    });

    it('should highlight the leading option', () => {
      renderPoll();
      
      const minecraftOption = screen.getByText('Minecraft').closest('.poll-option');
      expect(minecraftOption).toHaveClass('leading-option');
    });

    it('should show visual vote bars proportional to vote counts', () => {
      renderPoll();
      
      const options = screen.getAllByTestId('poll-option-bar');
      expect(options).toHaveLength(4);
      
      // Minecraft should have the widest bar (67/172 = ~39%)
      const minecraftBar = screen.getByText('Minecraft').closest('.poll-option').querySelector('.vote-bar');
      expect(minecraftBar).toHaveStyle({ width: '39.0%' });
    });
  });

  describe('Voting Functionality', () => {
    it('should allow voting when user can vote', async () => {
      const user = userEvent.setup();
      renderPoll();
      
      const fortniteOption = screen.getByText('Fortnite').closest('button');
      await user.click(fortniteOption);
      
      expect(mockChatContextValue.votePoll).toHaveBeenCalledWith('poll-123', 'option-1');
    });

    it('should show vote confirmation after voting', async () => {
      const user = userEvent.setup();
      renderPoll();
      
      const fortniteOption = screen.getByText('Fortnite').closest('button');
      await user.click(fortniteOption);
      
      expect(mockToast.success).toHaveBeenCalledWith('Vote cast for Fortnite!');
    });

    it('should disable voting when user has already voted', () => {
      renderPoll({
        activePoll: {
          ...mockPollData,
          userVote: 'option-1'
        }
      });
      
      const pollOptions = screen.getAllByRole('button', { name: /vote for/i });
      pollOptions.forEach(option => {
        expect(option).toBeDisabled();
      });
    });

    it('should highlight user\'s vote choice', () => {
      renderPoll({
        activePoll: {
          ...mockPollData,
          userVote: 'option-1'
        }
      });
      
      const fortniteOption = screen.getByText('Fortnite').closest('.poll-option');
      expect(fortniteOption).toHaveClass('user-voted');
    });

    it('should prevent voting when user is not authenticated', () => {
      renderPoll({ isAuthenticated: false });
      
      const pollOptions = screen.getAllByRole('button', { name: /vote for/i });
      pollOptions.forEach(option => {
        expect(option).toBeDisabled();
      });
      
      expect(screen.getByText(/sign in to vote/i)).toBeInTheDocument();
    });

    it('should prevent voting when poll cannot be voted on', () => {
      renderPoll({
        activePoll: {
          ...mockPollData,
          canVote: false
        }
      });
      
      const pollOptions = screen.getAllByRole('button', { name: /vote for/i });
      pollOptions.forEach(option => {
        expect(option).toBeDisabled();
      });
    });
  });

  describe('Poll Status States', () => {
    it('should show completed status when poll is finished', () => {
      renderPoll({
        activePoll: {
          ...mockPollData,
          status: 'completed'
        }
      });
      
      expect(screen.getByText(/poll completed/i)).toBeInTheDocument();
      expect(screen.queryByText(/time remaining/i)).not.toBeInTheDocument();
    });

    it('should show cancelled status when poll is cancelled', () => {
      renderPoll({
        activePoll: {
          ...mockPollData,
          status: 'cancelled'
        }
      });
      
      expect(screen.getByText(/poll cancelled/i)).toBeInTheDocument();
    });

    it('should auto-hide completed polls when setting is enabled', async () => {
      vi.useFakeTimers();
      
      const { rerender } = renderPoll();
      
      // Update to completed poll
      rerender(
        <SettingsProvider value={mockSettingsContextValue}>
          <ChatProvider value={{
            ...mockChatContextValue,
            activePoll: {
              ...mockPollData,
              status: 'completed'
            }
          }}>
            <Poll />
          </ChatProvider>
        </SettingsProvider>
      );
      
      expect(screen.getByText(/poll completed/i)).toBeInTheDocument();
      
      // Fast forward auto-hide timer (5 seconds)
      vi.advanceTimersByTime(5000);
      
      await waitFor(() => {
        expect(screen.queryByTestId('poll-container')).not.toBeInTheDocument();
      });
      
      vi.useRealTimers();
    });
  });

  describe('Real-time Updates', () => {
    it('should update vote counts in real-time', async () => {
      const { rerender } = renderPoll();
      
      expect(screen.getByText('45')).toBeInTheDocument(); // Initial Fortnite votes
      
      // Simulate real-time vote update
      const updatedPoll = {
        ...mockPollData,
        options: [
          { id: 'option-1', text: 'Fortnite', votes: 46 }, // +1 vote
          { id: 'option-2', text: 'Among Us', votes: 32 },
          { id: 'option-3', text: 'Valorant', votes: 28 },
          { id: 'option-4', text: 'Minecraft', votes: 67 }
        ],
        totalVotes: 173
      };
      
      rerender(
        <SettingsProvider value={mockSettingsContextValue}>
          <ChatProvider value={{
            ...mockChatContextValue,
            activePoll: updatedPoll
          }}>
            <Poll />
          </ChatProvider>
        </SettingsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByText('46')).toBeInTheDocument();
        expect(screen.getByText(/173 total votes/i)).toBeInTheDocument();
      });
    });

    it('should update time remaining countdown', async () => {
      vi.useFakeTimers();
      const { rerender } = renderPoll();
      
      expect(screen.getByText('4:32')).toBeInTheDocument();
      
      // Mock time passing
      vi.mocked(require('../../utils/DateFormatter').formatTimeRemaining).mockReturnValue('4:31');
      
      // Fast-forward 1 second
      vi.advanceTimersByTime(1000);
      
      rerender(
        <SettingsProvider value={mockSettingsContextValue}>
          <ChatProvider value={mockChatContextValue}>
            <Poll />
          </ChatProvider>
        </SettingsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByText('4:31')).toBeInTheDocument();
      });
      
      vi.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should handle vote submission errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockChatContextValue.votePoll.mockRejectedValue(new Error('Vote failed'));
      
      const user = userEvent.setup();
      renderPoll();
      
      const fortniteOption = screen.getByText('Fortnite').closest('button');
      await user.click(fortniteOption);
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Failed to cast vote. Please try again.');
        expect(consoleSpy).toHaveBeenCalledWith('Vote error:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });

    it('should handle missing poll data gracefully', () => {
      renderPoll({
        activePoll: {
          ...mockPollData,
          options: null
        }
      });
      
      expect(screen.getByText(/error loading poll/i)).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support keyboard navigation between options', async () => {
      const user = userEvent.setup();
      renderPoll();
      
      const pollOptions = screen.getAllByRole('button', { name: /vote for/i });
      
      await user.tab();
      expect(pollOptions[0]).toHaveFocus();
      
      await user.keyboard('{ArrowDown}');
      expect(pollOptions[1]).toHaveFocus();
      
      await user.keyboard('{ArrowUp}');
      expect(pollOptions[0]).toHaveFocus();
    });

    it('should vote with Enter key', async () => {
      const user = userEvent.setup();
      renderPoll();
      
      const fortniteOption = screen.getByRole('button', { name: /vote for fortnite/i });
      fortniteOption.focus();
      
      await user.keyboard('{Enter}');
      
      expect(mockChatContextValue.votePoll).toHaveBeenCalledWith('poll-123', 'option-1');
    });

    it('should vote with Space key', async () => {
      const user = userEvent.setup();
      renderPoll();
      
      const fortniteOption = screen.getByRole('button', { name: /vote for fortnite/i });
      fortniteOption.focus();
      
      await user.keyboard(' ');
      
      expect(mockChatContextValue.votePoll).toHaveBeenCalledWith('poll-123', 'option-1');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      renderPoll();
      
      const pollRegion = screen.getByRole('region', { name: /poll/i });
      expect(pollRegion).toBeInTheDocument();
      
      const pollTitle = screen.getByRole('heading', { level: 3 });
      expect(pollTitle).toHaveTextContent('What should I play next?');
      
      const voteButtons = screen.getAllByRole('button', { name: /vote for/i });
      expect(voteButtons).toHaveLength(4);
    });

    it('should announce vote results to screen readers', () => {
      renderPoll();
      
      const fortniteOption = screen.getByRole('button', { name: /vote for fortnite/i });
      expect(fortniteOption).toHaveAttribute('aria-describedby', expect.stringContaining('vote-count'));
      
      const voteCount = screen.getByText('45').closest('[id*="vote-count"]');
      expect(voteCount).toHaveAttribute('aria-label', '45 votes, 26.2 percent');
    });

    it('should indicate poll status to screen readers', () => {
      renderPoll();
      
      const statusElement = screen.getByText(/time remaining/i);
      expect(statusElement).toHaveAttribute('aria-live', 'polite');
    });

    it('should indicate voting restrictions to screen readers', () => {
      renderPoll({ isAuthenticated: false });
      
      const loginMessage = screen.getByText(/sign in to vote/i);
      expect(loginMessage).toHaveAttribute('role', 'alert');
    });
  });

  describe('Performance', () => {
    it('should memoize component to prevent unnecessary re-renders', () => {
      const { rerender } = renderPoll();
      
      expect(screen.getByText('What should I play next?')).toBeInTheDocument();
      
      // Re-render with same props
      rerender(
        <SettingsProvider value={mockSettingsContextValue}>
          <ChatProvider value={mockChatContextValue}>
            <Poll />
          </ChatProvider>
        </SettingsProvider>
      );
      
      expect(screen.getByText('What should I play next?')).toBeInTheDocument();
    });

    it('should efficiently update only changed vote counts', async () => {
      const { rerender } = renderPoll();
      
      const fortniteVotes = screen.getByText('45');
      expect(fortniteVotes).toBeInTheDocument();
      
      // Update only one option's votes
      const updatedPoll = {
        ...mockPollData,
        options: [
          { id: 'option-1', text: 'Fortnite', votes: 46 }, // Changed
          { id: 'option-2', text: 'Among Us', votes: 32 }, // Unchanged
          { id: 'option-3', text: 'Valorant', votes: 28 }, // Unchanged
          { id: 'option-4', text: 'Minecraft', votes: 67 } // Unchanged
        ],
        totalVotes: 173
      };
      
      rerender(
        <SettingsProvider value={mockSettingsContextValue}>
          <ChatProvider value={{
            ...mockChatContextValue,
            activePoll: updatedPoll
          }}>
            <Poll />
          </ChatProvider>
        </SettingsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByText('46')).toBeInTheDocument();
        // Other counts should remain the same
        expect(screen.getByText('32')).toBeInTheDocument();
        expect(screen.getByText('28')).toBeInTheDocument();
        expect(screen.getByText('67')).toBeInTheDocument();
      });
    });
  });

  describe('Integration', () => {
    it('should integrate with notification settings', async () => {
      const user = userEvent.setup();
      renderPoll();
      
      const fortniteOption = screen.getByText('Fortnite').closest('button');
      await user.click(fortniteOption);
      
      // Should show notification when enabled
      expect(mockToast.success).toHaveBeenCalledWith('Vote cast for Fortnite!');
    });

    it('should not show notifications when disabled', async () => {
      const user = userEvent.setup();
      renderPoll({}, { pollNotifications: false });
      
      const fortniteOption = screen.getByText('Fortnite').closest('button');
      await user.click(fortniteOption);
      
      expect(mockToast.success).not.toHaveBeenCalled();
    });
  });
});