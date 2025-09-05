import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import Predictions from './Predictions';
import { ChatProvider } from '../../providers/ChatProvider';
import { SettingsProvider } from '../../providers/SettingsProvider';

// Mock the settings and chat contexts
const mockSettingsContextValue = {
  settings: {
    showPredictions: true,
    predictionNotifications: true,
    autoHideCompletedPredictions: false
  },
  updateSetting: vi.fn()
};

const mockPredictionData = {
  id: 'prediction-456',
  title: 'Will I win this round?',
  outcomes: [
    {
      id: 'outcome-1',
      title: 'Yes, victory!',
      points: 15420,
      users: 234,
      color: '#00ff00',
      topPredictors: [
        { username: 'user1', points: 1000 },
        { username: 'user2', points: 500 }
      ]
    },
    {
      id: 'outcome-2',
      title: 'No, defeat...',
      points: 8930,
      users: 156,
      color: '#ff0000',
      topPredictors: [
        { username: 'user3', points: 800 },
        { username: 'user4', points: 600 }
      ]
    }
  ],
  totalPoints: 24350,
  totalUsers: 390,
  status: 'active', // 'locked', 'resolved', 'cancelled'
  lockTime: new Date('2023-12-01T10:35:00Z'),
  endTime: new Date('2023-12-01T10:40:00Z'),
  winningOutcome: null,
  createdBy: {
    username: 'streamer',
    display_name: 'TestStreamer'
  },
  userPrediction: null, // { outcomeId, points, rank }
  minPoints: 10,
  maxPoints: 10000,
  canPredict: true
};

const mockChatContextValue = {
  activePrediction: mockPredictionData,
  placePrediction: vi.fn(),
  isAuthenticated: true,
  currentUser: {
    id: 'user-123',
    username: 'testuser',
    channelPoints: 5000
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
  formatTimeRemaining: vi.fn((endTime) => '3:45'),
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

// Mock number formatting
vi.mock('../../utils/NumberFormatter', () => ({
  formatPoints: vi.fn((points) => points.toLocaleString()),
  formatLargeNumber: vi.fn((num) => num >= 1000 ? `${(num/1000).toFixed(1)}k` : num.toString())
}));

const renderPredictions = (chatContextOverride = {}, settingsOverride = {}) => {
  const mockChatContext = { ...mockChatContextValue, ...chatContextOverride };
  const mockSettingsContext = { ...mockSettingsContextValue, settings: { ...mockSettingsContextValue.settings, ...settingsOverride } };
  
  return render(
    <SettingsProvider value={mockSettingsContext}>
      <ChatProvider value={mockChatContext}>
        <Predictions />
      </ChatProvider>
    </SettingsProvider>
  );
};

describe('Predictions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render prediction when active prediction exists', () => {
      renderPredictions();
      
      expect(screen.getByText('Will I win this round?')).toBeInTheDocument();
      expect(screen.getByText('Yes, victory!')).toBeInTheDocument();
      expect(screen.getByText('No, defeat...')).toBeInTheDocument();
    });

    it('should not render when no active prediction', () => {
      renderPredictions({ activePrediction: null });
      
      expect(screen.queryByTestId('prediction-container')).not.toBeInTheDocument();
    });

    it('should not render when showPredictions setting is disabled', () => {
      renderPredictions({}, { showPredictions: false });
      
      expect(screen.queryByTestId('prediction-container')).not.toBeInTheDocument();
    });

    it('should display prediction creator information', () => {
      renderPredictions();
      
      expect(screen.getByText(/prediction by teststreamer/i)).toBeInTheDocument();
    });

    it('should show total points and users', () => {
      renderPredictions();
      
      expect(screen.getByText(/24,350 total points/i)).toBeInTheDocument();
      expect(screen.getByText(/390 predictors/i)).toBeInTheDocument();
    });

    it('should display time remaining for active predictions', () => {
      renderPredictions();
      
      expect(screen.getByText('3:45')).toBeInTheDocument();
      expect(screen.getByText(/time remaining/i)).toBeInTheDocument();
    });
  });

  describe('Outcome Display', () => {
    it('should display all prediction outcomes with points and user counts', () => {
      renderPredictions();
      
      expect(screen.getByText('Yes, victory!')).toBeInTheDocument();
      expect(screen.getByText('15,420')).toBeInTheDocument();
      expect(screen.getByText('234')).toBeInTheDocument();
      
      expect(screen.getByText('No, defeat...')).toBeInTheDocument();
      expect(screen.getByText('8,930')).toBeInTheDocument();
      expect(screen.getByText('156')).toBeInTheDocument();
    });

    it('should show percentage distribution of points', () => {
      renderPredictions();
      
      // Calculate expected percentages: 15420/24350 ≈ 63.3%, 8930/24350 ≈ 36.7%
      expect(screen.getByText(/63\.3%/)).toBeInTheDocument(); // Yes outcome
      expect(screen.getByText(/36\.7%/)).toBeInTheDocument(); // No outcome
    });

    it('should apply outcome colors to visual elements', () => {
      renderPredictions();
      
      const yesOutcome = screen.getByText('Yes, victory!').closest('.prediction-outcome');
      const noOutcome = screen.getByText('No, defeat...').closest('.prediction-outcome');
      
      expect(yesOutcome.querySelector('.outcome-bar')).toHaveStyle({ backgroundColor: '#00ff00' });
      expect(noOutcome.querySelector('.outcome-bar')).toHaveStyle({ backgroundColor: '#ff0000' });
    });

    it('should show top predictors for each outcome', () => {
      renderPredictions();
      
      expect(screen.getByText('user1')).toBeInTheDocument();
      expect(screen.getByText('1,000')).toBeInTheDocument();
      expect(screen.getByText('user2')).toBeInTheDocument();
      expect(screen.getByText('500')).toBeInTheDocument();
      
      expect(screen.getByText('user3')).toBeInTheDocument();
      expect(screen.getByText('800')).toBeInTheDocument();
      expect(screen.getByText('user4')).toBeInTheDocument();
      expect(screen.getByText('600')).toBeInTheDocument();
    });

    it('should show visual progress bars proportional to points', () => {
      renderPredictions();
      
      const outcomes = screen.getAllByTestId('prediction-outcome-bar');
      expect(outcomes).toHaveLength(2);
      
      // Yes outcome should have wider bar (63.3%)
      const yesBar = screen.getByText('Yes, victory!').closest('.prediction-outcome').querySelector('.outcome-bar');
      expect(yesBar).toHaveStyle({ width: '63.3%' });
      
      // No outcome should have narrower bar (36.7%)
      const noBar = screen.getByText('No, defeat...').closest('.prediction-outcome').querySelector('.outcome-bar');
      expect(noBar).toHaveStyle({ width: '36.7%' });
    });
  });

  describe('Prediction Functionality', () => {
    it('should show prediction interface when user can predict', () => {
      renderPredictions();
      
      const yesButton = screen.getByRole('button', { name: /predict yes, victory!/i });
      const noButton = screen.getByRole('button', { name: /predict no, defeat\.\.\./i });
      
      expect(yesButton).toBeInTheDocument();
      expect(noButton).toBeInTheDocument();
    });

    it('should open prediction modal when outcome is clicked', async () => {
      const user = userEvent.setup();
      renderPredictions();
      
      const yesButton = screen.getByRole('button', { name: /predict yes, victory!/i });
      await user.click(yesButton);
      
      expect(screen.getByText(/place your prediction/i)).toBeInTheDocument();
      expect(screen.getByText(/how many points do you want to wager/i)).toBeInTheDocument();
    });

    it('should show point input with min/max validation', async () => {
      const user = userEvent.setup();
      renderPredictions();
      
      const yesButton = screen.getByRole('button', { name: /predict yes, victory!/i });
      await user.click(yesButton);
      
      const pointsInput = screen.getByRole('spinbutton', { name: /points to wager/i });
      expect(pointsInput).toHaveAttribute('min', '10');
      expect(pointsInput).toHaveAttribute('max', '5000'); // User's available points
    });

    it('should submit prediction with correct parameters', async () => {
      const user = userEvent.setup();
      renderPredictions();
      
      const yesButton = screen.getByRole('button', { name: /predict yes, victory!/i });
      await user.click(yesButton);
      
      const pointsInput = screen.getByRole('spinbutton', { name: /points to wager/i });
      await user.clear(pointsInput);
      await user.type(pointsInput, '500');
      
      const confirmButton = screen.getByRole('button', { name: /confirm prediction/i });
      await user.click(confirmButton);
      
      expect(mockChatContextValue.placePrediction).toHaveBeenCalledWith({
        predictionId: 'prediction-456',
        outcomeId: 'outcome-1',
        points: 500
      });
    });

    it('should show confirmation after successful prediction', async () => {
      const user = userEvent.setup();
      mockChatContextValue.placePrediction.mockResolvedValue({ success: true });
      
      renderPredictions();
      
      const yesButton = screen.getByRole('button', { name: /predict yes, victory!/i });
      await user.click(yesButton);
      
      const pointsInput = screen.getByRole('spinbutton', { name: /points to wager/i });
      await user.clear(pointsInput);
      await user.type(pointsInput, '500');
      
      const confirmButton = screen.getByRole('button', { name: /confirm prediction/i });
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Prediction placed: 500 points on "Yes, victory!"');
      });
    });

    it('should prevent prediction when user has already predicted', () => {
      renderPredictions({
        activePrediction: {
          ...mockPredictionData,
          userPrediction: {
            outcomeId: 'outcome-1',
            points: 1000,
            rank: 15
          }
        }
      });
      
      const predictButtons = screen.getAllByRole('button', { name: /predict/i });
      predictButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
      
      expect(screen.getByText(/you predicted 1,000 points on "yes, victory!"/i)).toBeInTheDocument();
      expect(screen.getByText(/rank: #15/i)).toBeInTheDocument();
    });

    it('should prevent prediction when user is not authenticated', () => {
      renderPredictions({ isAuthenticated: false });
      
      const predictButtons = screen.getAllByRole('button', { name: /predict/i });
      predictButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
      
      expect(screen.getByText(/sign in to predict/i)).toBeInTheDocument();
    });

    it('should prevent prediction when user has insufficient points', () => {
      renderPredictions({
        currentUser: {
          ...mockChatContextValue.currentUser,
          channelPoints: 5
        }
      });
      
      const predictButtons = screen.getAllByRole('button', { name: /predict/i });
      predictButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
      
      expect(screen.getByText(/insufficient channel points/i)).toBeInTheDocument();
    });
  });

  describe('Prediction Status States', () => {
    it('should show locked status when prediction is locked', () => {
      renderPredictions({
        activePrediction: {
          ...mockPredictionData,
          status: 'locked'
        }
      });
      
      expect(screen.getByText(/prediction locked/i)).toBeInTheDocument();
      expect(screen.queryByText(/time remaining/i)).not.toBeInTheDocument();
      
      const predictButtons = screen.getAllByRole('button', { name: /predict/i });
      predictButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });

    it('should show resolved status with winning outcome', () => {
      renderPredictions({
        activePrediction: {
          ...mockPredictionData,
          status: 'resolved',
          winningOutcome: 'outcome-1'
        }
      });
      
      expect(screen.getByText(/prediction resolved/i)).toBeInTheDocument();
      
      const winningOutcome = screen.getByText('Yes, victory!').closest('.prediction-outcome');
      expect(winningOutcome).toHaveClass('winning-outcome');
      
      const losingOutcome = screen.getByText('No, defeat...').closest('.prediction-outcome');
      expect(losingOutcome).toHaveClass('losing-outcome');
    });

    it('should show cancelled status when prediction is cancelled', () => {
      renderPredictions({
        activePrediction: {
          ...mockPredictionData,
          status: 'cancelled'
        }
      });
      
      expect(screen.getByText(/prediction cancelled/i)).toBeInTheDocument();
      expect(screen.getByText(/all points will be refunded/i)).toBeInTheDocument();
    });

    it('should auto-hide completed predictions when setting is enabled', async () => {
      vi.useFakeTimers();
      
      const { rerender } = renderPredictions({}, { autoHideCompletedPredictions: true });
      
      // Update to resolved prediction
      rerender(
        <SettingsProvider value={{
          ...mockSettingsContextValue,
          settings: { ...mockSettingsContextValue.settings, autoHideCompletedPredictions: true }
        }}>
          <ChatProvider value={{
            ...mockChatContextValue,
            activePrediction: {
              ...mockPredictionData,
              status: 'resolved',
              winningOutcome: 'outcome-1'
            }
          }}>
            <Predictions />
          </ChatProvider>
        </SettingsProvider>
      );
      
      expect(screen.getByText(/prediction resolved/i)).toBeInTheDocument();
      
      // Fast forward auto-hide timer (10 seconds)
      vi.advanceTimersByTime(10000);
      
      await waitFor(() => {
        expect(screen.queryByTestId('prediction-container')).not.toBeInTheDocument();
      });
      
      vi.useRealTimers();
    });
  });

  describe('Real-time Updates', () => {
    it('should update points and user counts in real-time', async () => {
      const { rerender } = renderPredictions();
      
      expect(screen.getByText('15,420')).toBeInTheDocument(); // Initial Yes points
      
      // Simulate real-time update
      const updatedPrediction = {
        ...mockPredictionData,
        outcomes: [
          {
            ...mockPredictionData.outcomes[0],
            points: 16420, // +1000 points
            users: 235 // +1 user
          },
          mockPredictionData.outcomes[1]
        ],
        totalPoints: 25350,
        totalUsers: 391
      };
      
      rerender(
        <SettingsProvider value={mockSettingsContextValue}>
          <ChatProvider value={{
            ...mockChatContextValue,
            activePrediction: updatedPrediction
          }}>
            <Predictions />
          </ChatProvider>
        </SettingsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByText('16,420')).toBeInTheDocument();
        expect(screen.getByText('235')).toBeInTheDocument();
        expect(screen.getByText(/25,350 total points/i)).toBeInTheDocument();
        expect(screen.getByText(/391 predictors/i)).toBeInTheDocument();
      });
    });

    it('should update time remaining countdown', async () => {
      vi.useFakeTimers();
      const { rerender } = renderPredictions();
      
      expect(screen.getByText('3:45')).toBeInTheDocument();
      
      // Mock time passing
      vi.mocked(require('../../utils/DateFormatter').formatTimeRemaining).mockReturnValue('3:44');
      
      // Fast-forward 1 second
      vi.advanceTimersByTime(1000);
      
      rerender(
        <SettingsProvider value={mockSettingsContextValue}>
          <ChatProvider value={mockChatContextValue}>
            <Predictions />
          </ChatProvider>
        </SettingsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByText('3:44')).toBeInTheDocument();
      });
      
      vi.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should handle prediction submission errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockChatContextValue.placePrediction.mockRejectedValue(new Error('Prediction failed'));
      
      const user = userEvent.setup();
      renderPredictions();
      
      const yesButton = screen.getByRole('button', { name: /predict yes, victory!/i });
      await user.click(yesButton);
      
      const pointsInput = screen.getByRole('spinbutton', { name: /points to wager/i });
      await user.clear(pointsInput);
      await user.type(pointsInput, '500');
      
      const confirmButton = screen.getByRole('button', { name: /confirm prediction/i });
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Failed to place prediction. Please try again.');
        expect(consoleSpy).toHaveBeenCalledWith('Prediction error:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });

    it('should validate point input bounds', async () => {
      const user = userEvent.setup();
      renderPredictions();
      
      const yesButton = screen.getByRole('button', { name: /predict yes, victory!/i });
      await user.click(yesButton);
      
      const pointsInput = screen.getByRole('spinbutton', { name: /points to wager/i });
      
      // Test below minimum
      await user.clear(pointsInput);
      await user.type(pointsInput, '5');
      
      const confirmButton = screen.getByRole('button', { name: /confirm prediction/i });
      expect(confirmButton).toBeDisabled();
      expect(screen.getByText(/minimum 10 points required/i)).toBeInTheDocument();
      
      // Test above maximum (user's available points)
      await user.clear(pointsInput);
      await user.type(pointsInput, '6000');
      
      expect(confirmButton).toBeDisabled();
      expect(screen.getByText(/insufficient channel points/i)).toBeInTheDocument();
    });

    it('should handle missing prediction data gracefully', () => {
      renderPredictions({
        activePrediction: {
          ...mockPredictionData,
          outcomes: null
        }
      });
      
      expect(screen.getByText(/error loading prediction/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      renderPredictions();
      
      const predictionRegion = screen.getByRole('region', { name: /prediction/i });
      expect(predictionRegion).toBeInTheDocument();
      
      const predictionTitle = screen.getByRole('heading', { level: 3 });
      expect(predictionTitle).toHaveTextContent('Will I win this round?');
      
      const predictButtons = screen.getAllByRole('button', { name: /predict/i });
      expect(predictButtons).toHaveLength(2);
    });

    it('should announce prediction results to screen readers', () => {
      renderPredictions();
      
      const yesOutcome = screen.getByRole('button', { name: /predict yes, victory!/i });
      expect(yesOutcome).toHaveAttribute('aria-describedby', expect.stringContaining('outcome-stats'));
      
      const outcomeStats = screen.getByText('15,420').closest('[id*="outcome-stats"]');
      expect(outcomeStats).toHaveAttribute('aria-label', '15,420 points, 234 users, 63.3 percent');
    });

    it('should indicate prediction status to screen readers', () => {
      renderPredictions();
      
      const statusElement = screen.getByText(/time remaining/i);
      expect(statusElement).toHaveAttribute('aria-live', 'polite');
    });

    it('should make modal dialogs accessible', async () => {
      const user = userEvent.setup();
      renderPredictions();
      
      const yesButton = screen.getByRole('button', { name: /predict yes, victory!/i });
      await user.click(yesButton);
      
      const modal = screen.getByRole('dialog', { name: /place your prediction/i });
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute('aria-modal', 'true');
      
      const pointsInput = screen.getByRole('spinbutton', { name: /points to wager/i });
      expect(pointsInput).toHaveFocus();
    });
  });

  describe('Performance', () => {
    it('should memoize component to prevent unnecessary re-renders', () => {
      const { rerender } = renderPredictions();
      
      expect(screen.getByText('Will I win this round?')).toBeInTheDocument();
      
      // Re-render with same props
      rerender(
        <SettingsProvider value={mockSettingsContextValue}>
          <ChatProvider value={mockChatContextValue}>
            <Predictions />
          </ChatProvider>
        </SettingsProvider>
      );
      
      expect(screen.getByText('Will I win this round?')).toBeInTheDocument();
    });

    it('should efficiently update only changed outcome data', async () => {
      const { rerender } = renderPredictions();
      
      expect(screen.getByText('15,420')).toBeInTheDocument();
      
      // Update only one outcome's data
      const updatedPrediction = {
        ...mockPredictionData,
        outcomes: [
          { ...mockPredictionData.outcomes[0], points: 16420 }, // Changed
          mockPredictionData.outcomes[1] // Unchanged
        ]
      };
      
      rerender(
        <SettingsProvider value={mockSettingsContextValue}>
          <ChatProvider value={{
            ...mockChatContextValue,
            activePrediction: updatedPrediction
          }}>
            <Predictions />
          </ChatProvider>
        </SettingsProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByText('16,420')).toBeInTheDocument();
        // Other outcome should remain unchanged
        expect(screen.getByText('8,930')).toBeInTheDocument();
      });
    });
  });

  describe('Integration', () => {
    it('should integrate with notification settings', async () => {
      const user = userEvent.setup();
      mockChatContextValue.placePrediction.mockResolvedValue({ success: true });
      
      renderPredictions();
      
      const yesButton = screen.getByRole('button', { name: /predict yes, victory!/i });
      await user.click(yesButton);
      
      const pointsInput = screen.getByRole('spinbutton', { name: /points to wager/i });
      await user.clear(pointsInput);
      await user.type(pointsInput, '500');
      
      const confirmButton = screen.getByRole('button', { name: /confirm prediction/i });
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Prediction placed: 500 points on "Yes, victory!"');
      });
    });

    it('should not show notifications when disabled', async () => {
      const user = userEvent.setup();
      mockChatContextValue.placePrediction.mockResolvedValue({ success: true });
      
      renderPredictions({}, { predictionNotifications: false });
      
      const yesButton = screen.getByRole('button', { name: /predict yes, victory!/i });
      await user.click(yesButton);
      
      const pointsInput = screen.getByRole('spinbutton', { name: /points to wager/i });
      await user.clear(pointsInput);
      await user.type(pointsInput, '500');
      
      const confirmButton = screen.getByRole('button', { name: /confirm prediction/i });
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(mockChatContextValue.placePrediction).toHaveBeenCalled();
      });
      
      expect(mockToast.success).not.toHaveBeenCalled();
    });
  });
});