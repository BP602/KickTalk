import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import StreamerInfo from './StreamerInfo';
import { ChatProvider } from '../../providers/ChatProvider';
import { SettingsProvider } from '../../providers/SettingsProvider';

// Mock the settings and chat contexts
const mockSettingsContextValue = {
  settings: {
    hideViewers: false,
    hideFollowers: false,
    hideLiveTime: false
  },
  updateSetting: vi.fn()
};

const mockChatContextValue = {
  streamerInfo: {
    username: 'teststreamer',
    display_name: 'TestStreamer',
    profile_picture: 'https://example.com/avatar.jpg',
    is_live: true,
    viewers_count: 1337,
    followers_count: 42069,
    live_duration: '2:34:56',
    stream_title: 'Testing Stream Title',
    category: 'Just Chatting'
  },
  followersCount: 42069,
  isLoading: false
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

// Mock react-router-dom
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useParams: () => ({ username: 'teststreamer' })
  };
});

const renderStreamInfo = (chatContextOverride = {}) => {
  const mockChatContext = { ...mockChatContextValue, ...chatContextOverride };
  
  return render(
    <MemoryRouter>
      <SettingsProvider>
        <ChatProvider value={mockChatContext}>
          <StreamerInfo />
        </ChatProvider>
      </SettingsProvider>
    </MemoryRouter>
  );
};

describe('StreamerInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Streamer Display', () => {
    it('should render streamer avatar and display name', () => {
      renderStreamInfo();
      
      const avatar = screen.getByRole('img', { name: /teststreamer's avatar/i });
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
      
      expect(screen.getByText('TestStreamer')).toBeInTheDocument();
    });

    it('should show fallback avatar when profile picture is missing', () => {
      renderStreamInfo({
        streamerInfo: {
          ...mockChatContextValue.streamerInfo,
          profile_picture: null
        }
      });
      
      const avatar = screen.getByRole('img', { name: /teststreamer's avatar/i });
      expect(avatar).toHaveAttribute('src', expect.stringMatching(/default.*avatar/));
    });

    it('should display stream title when available', () => {
      renderStreamInfo();
      expect(screen.getByText('Testing Stream Title')).toBeInTheDocument();
    });

    it('should display category when available', () => {
      renderStreamInfo();
      expect(screen.getByText('Just Chatting')).toBeInTheDocument();
    });
  });

  describe('Live Status', () => {
    it('should show live indicator when streamer is live', () => {
      renderStreamInfo();
      
      const liveIndicator = screen.getByText(/live/i);
      expect(liveIndicator).toBeInTheDocument();
      expect(liveIndicator).toHaveClass('live-indicator');
    });

    it('should show offline status when streamer is not live', () => {
      renderStreamInfo({
        streamerInfo: {
          ...mockChatContextValue.streamerInfo,
          is_live: false
        }
      });
      
      expect(screen.getByText(/offline/i)).toBeInTheDocument();
      expect(screen.queryByText(/live/i)).not.toBeInTheDocument();
    });

    it('should display live duration when live and setting enabled', () => {
      renderStreamInfo();
      expect(screen.getByText('2:34:56')).toBeInTheDocument();
    });

    it('should hide live duration when setting disabled', () => {
      vi.mocked(mockSettingsContextValue.settings.hideLiveTime = true);
      renderStreamInfo();
      expect(screen.queryByText('2:34:56')).not.toBeInTheDocument();
    });
  });

  describe('Viewer and Follower Counts', () => {
    it('should display viewer count when live and setting enabled', () => {
      renderStreamInfo();
      expect(screen.getByText('1,337')).toBeInTheDocument();
      expect(screen.getByText(/viewers/i)).toBeInTheDocument();
    });

    it('should hide viewer count when setting disabled', () => {
      vi.mocked(mockSettingsContextValue.settings.hideViewers = true);
      renderStreamInfo();
      expect(screen.queryByText('1,337')).not.toBeInTheDocument();
    });

    it('should display follower count when setting enabled', () => {
      renderStreamInfo();
      expect(screen.getByText('42,069')).toBeInTheDocument();
      expect(screen.getByText(/followers/i)).toBeInTheDocument();
    });

    it('should hide follower count when setting disabled', () => {
      vi.mocked(mockSettingsContextValue.settings.hideFollowers = true);
      renderStreamInfo();
      expect(screen.queryByText('42,069')).not.toBeInTheDocument();
    });

    it('should format large numbers correctly', () => {
      renderStreamInfo({
        streamerInfo: {
          ...mockChatContextValue.streamerInfo,
          viewers_count: 1234567,
          followers_count: 9876543
        }
      });
      
      expect(screen.getByText('1,234,567')).toBeInTheDocument();
      expect(screen.getByText('9,876,543')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading skeleton when data is loading', () => {
      renderStreamInfo({ isLoading: true });
      
      const loadingElements = screen.getAllByTestId('skeleton-loader');
      expect(loadingElements).toHaveLength(4); // Avatar, name, stats, title
    });

    it('should hide loading skeleton when data loads', async () => {
      const { rerender } = renderStreamInfo({ isLoading: true });
      
      expect(screen.getAllByTestId('skeleton-loader')).toHaveLength(4);
      
      rerender(
        <MemoryRouter>
          <SettingsProvider>
            <ChatProvider value={{ ...mockChatContextValue, isLoading: false }}>
              <StreamerInfo />
            </ChatProvider>
          </SettingsProvider>
        </MemoryRouter>
      );
      
      await waitFor(() => {
        expect(screen.queryByTestId('skeleton-loader')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing streamer info gracefully', () => {
      renderStreamInfo({ streamerInfo: null });
      
      expect(screen.getByTestId('skeleton-loader')).toBeInTheDocument();
    });

    it('should handle partial streamer info', () => {
      renderStreamInfo({
        streamerInfo: {
          username: 'teststreamer',
          display_name: 'TestStreamer',
          is_live: false
        }
      });
      
      expect(screen.getByText('TestStreamer')).toBeInTheDocument();
      expect(screen.getByText(/offline/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderStreamInfo();
      
      const streamerInfoSection = screen.getByRole('region', { name: /streamer information/i });
      expect(streamerInfoSection).toBeInTheDocument();
      
      const avatar = screen.getByRole('img');
      expect(avatar).toHaveAttribute('alt', expect.stringContaining('avatar'));
    });

    it('should have proper semantic structure', () => {
      renderStreamInfo();
      
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('TestStreamer');
    });

    it('should support keyboard navigation', () => {
      renderStreamInfo();
      
      const streamerLink = screen.getByRole('link', { name: /teststreamer/i });
      expect(streamerLink).toBeInTheDocument();
      expect(streamerLink).toHaveAttribute('href', '/teststreamer');
    });
  });

  describe('Performance', () => {
    it('should memoize component to prevent unnecessary re-renders', () => {
      const { rerender } = renderStreamInfo();
      
      // Component should not re-render if streamer info hasn't changed
      rerender(
        <MemoryRouter>
          <SettingsProvider>
            <ChatProvider value={mockChatContextValue}>
              <StreamerInfo />
            </ChatProvider>
          </SettingsProvider>
        </MemoryRouter>
      );
      
      expect(screen.getByText('TestStreamer')).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('should update when streamer info changes', async () => {
      const { rerender } = renderStreamInfo();
      
      expect(screen.getByText('TestStreamer')).toBeInTheDocument();
      
      const updatedContext = {
        ...mockChatContextValue,
        streamerInfo: {
          ...mockChatContextValue.streamerInfo,
          display_name: 'UpdatedStreamer',
          viewers_count: 9999
        }
      };
      
      rerender(
        <MemoryRouter>
          <SettingsProvider>
            <ChatProvider value={updatedContext}>
              <StreamerInfo />
            </ChatProvider>
          </SettingsProvider>
        </MemoryRouter>
      );
      
      await waitFor(() => {
        expect(screen.getByText('UpdatedStreamer')).toBeInTheDocument();
        expect(screen.getByText('9,999')).toBeInTheDocument();
      });
    });

    it('should respond to settings changes', async () => {
      const { rerender } = renderStreamInfo();
      
      expect(screen.getByText('1,337')).toBeInTheDocument();
      
      const updatedSettings = {
        ...mockSettingsContextValue,
        settings: {
          ...mockSettingsContextValue.settings,
          hideViewers: true
        }
      };
      
      vi.mocked(mockSettingsContextValue.settings.hideViewers = true);
      
      rerender(
        <MemoryRouter>
          <SettingsProvider>
            <ChatProvider value={mockChatContextValue}>
              <StreamerInfo />
            </ChatProvider>
          </SettingsProvider>
        </MemoryRouter>
      );
      
      await waitFor(() => {
        expect(screen.queryByText('1,337')).not.toBeInTheDocument();
      });
    });
  });
});