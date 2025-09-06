import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Loader from './Loader.jsx'

// Mock CSS import
vi.mock('@assets/styles/loader.css', () => ({}))

// Mock static assets
vi.mock('@assets/icons/K.svg', () => ({ default: 'k-logo.svg' }))

// Mock clsx
vi.mock('clsx', () => ({
  default: (...args) => args.filter(Boolean).join(' ')
}))

// Mock window.app for getAppInfo
const mockGetAppInfo = vi.fn()
global.window = {
  ...global.window,
  app: {
    getAppInfo: mockGetAppInfo
  }
}

describe('Loader Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    // Default mock implementation
    mockGetAppInfo.mockResolvedValue({ appVersion: '1.0.0' })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render loader container with correct initial state', () => {
      render(<Loader />)
      
      const loaderContainer = document.querySelector('.loaderContainer')
      expect(loaderContainer).toBeInTheDocument()
      expect(loaderContainer).not.toHaveClass('slideUp')
      
      const logoWrapper = document.querySelector('.logoWrapper')
      expect(logoWrapper).toBeInTheDocument()
      expect(logoWrapper).not.toHaveClass('logoWrapperFadeOut')
    })

    it('should render logo image with correct attributes', () => {
      render(<Loader />)
      
      const logoImage = screen.getByAltText('Loader Logo')
      expect(logoImage).toBeInTheDocument()
      expect(logoImage).toHaveAttribute('src', 'k-logo.svg')
      expect(logoImage).toHaveAttribute('width', '200')
      expect(logoImage).toHaveAttribute('height', '200')
      expect(logoImage).toHaveClass('logoImage')
    })

    it('should not show text initially', () => {
      render(<Loader />)
      
      expect(screen.queryByText(/Created by/)).not.toBeInTheDocument()
      expect(screen.queryByText(/DRKNESS/)).not.toBeInTheDocument()
      expect(screen.queryByText(/ftk789/)).not.toBeInTheDocument()
    })

    it('should not show app version initially', () => {
      render(<Loader />)
      
      expect(screen.queryByText(/v1.0.0/)).not.toBeInTheDocument()
    })
  })

  describe('Animation Timing', () => {
    it('should show text after 100ms delay', async () => {
      render(<Loader />)
      
      // Text should not be visible initially
      expect(screen.queryByText(/Created by/)).not.toBeInTheDocument()
      
      // Fast forward 100ms
      await act(async () => {
        vi.advanceTimersByTime(100)
      })
      
      // Text should now be visible
      expect(screen.getByText('Created by')).toBeInTheDocument()
      expect(screen.getByText('DRKNESS')).toBeInTheDocument()
      expect(screen.getByText('ftk789')).toBeInTheDocument()
    })

    it('should call onFinish after 1500ms delay', async () => {
      const onFinish = vi.fn()
      
      render(<Loader onFinish={onFinish} />)
      
      // onFinish should not be called initially
      expect(onFinish).not.toHaveBeenCalled()
      
      // Fast forward 1500ms (should trigger hideLoader)
      await act(async () => {
        vi.advanceTimersByTime(1500)
      })
      
      // Check that slide animation classes are applied
      const loaderContainer = document.querySelector('.loaderContainer')
      expect(loaderContainer).toHaveClass('slideUp')
      
      const logoWrapper = document.querySelector('.logoWrapper')
      expect(logoWrapper).toHaveClass('logoWrapperFadeOut')
      
      // Fast forward additional 1000ms for onFinish call
      await act(async () => {
        vi.advanceTimersByTime(1000)
      })
      
      expect(onFinish).toHaveBeenCalledTimes(1)
    })

    it('should apply slideUp class at correct timing', async () => {
      render(<Loader />)
      
      const loaderContainer = document.querySelector('.loaderContainer')
      
      // Should not have slideUp class initially
      expect(loaderContainer).not.toHaveClass('slideUp')
      
      // Fast forward to trigger hideLoader (1500ms)
      await act(async () => {
        vi.advanceTimersByTime(1500)
      })
      
      // Should now have slideUp class
      expect(loaderContainer).toHaveClass('slideUp')
    })

    it('should apply logoWrapperFadeOut class at correct timing', async () => {
      render(<Loader />)
      
      const logoWrapper = document.querySelector('.logoWrapper')
      
      // Should not have fadeOut class initially
      expect(logoWrapper).not.toHaveClass('logoWrapperFadeOut')
      
      // Fast forward to trigger hideLoader (1500ms)
      await act(async () => {
        vi.advanceTimersByTime(1500)
      })
      
      // Should now have fadeOut class
      expect(logoWrapper).toHaveClass('logoWrapperFadeOut')
    })
  })

  describe('App Version Display', () => {
    it('should fetch and display app version', async () => {
      mockGetAppInfo.mockResolvedValue({ appVersion: '1.2.3' })
      
      render(<Loader />)
      
      await waitFor(() => {
        expect(mockGetAppInfo).toHaveBeenCalledTimes(1)
      })
      
      // Show text first
      await act(async () => {
        vi.advanceTimersByTime(100)
      })
      
      await waitFor(() => {
        expect(screen.getByText('v1.2.3')).toBeInTheDocument()
      })
    })

    it('should handle missing app version gracefully', async () => {
      mockGetAppInfo.mockResolvedValue({})
      
      render(<Loader />)
      
      await waitFor(() => {
        expect(mockGetAppInfo).toHaveBeenCalledTimes(1)
      })
      
      // Show text
      await act(async () => {
        vi.advanceTimersByTime(100)
      })
      
      // Should show creator text but no version
      expect(screen.getByText('Created by')).toBeInTheDocument()
      expect(screen.queryByText(/^v/)).not.toBeInTheDocument()
    })

    it('should handle app version fetch error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGetAppInfo.mockRejectedValue(new Error('Fetch error'))
      
      render(<Loader />)
      
      await waitFor(() => {
        expect(mockGetAppInfo).toHaveBeenCalledTimes(1)
      })
      
      // Show text
      await act(async () => {
        vi.advanceTimersByTime(100)
      })
      
      // Should still show creator text
      expect(screen.getByText('Created by')).toBeInTheDocument()
      expect(screen.queryByText(/^v/)).not.toBeInTheDocument()
      
      consoleSpy.mockRestore()
    })

    it('should only show version when text is visible and version is available', async () => {
      mockGetAppInfo.mockResolvedValue({ appVersion: '2.0.0' })
      
      render(<Loader />)
      
      // Version should not be visible before text shows
      expect(screen.queryByText('v2.0.0')).not.toBeInTheDocument()
      
      // Wait for app version to be fetched
      await waitFor(() => {
        expect(mockGetAppInfo).toHaveBeenCalledTimes(1)
      })
      
      // Show text
      await act(async () => {
        vi.advanceTimersByTime(100)
      })
      
      // Now version should be visible
      await waitFor(() => {
        expect(screen.getByText('v2.0.0')).toBeInTheDocument()
      })
    })
  })

  describe('Text Content and Structure', () => {
    it('should display correct creator text', () => {
      render(<Loader />)
      
      act(() => {
        vi.advanceTimersByTime(100)
      })
      
      expect(screen.getByText('Created by')).toBeInTheDocument()
      
      // Check that creator names are in spans
      const drkness = screen.getByText('DRKNESS')
      const ftk789 = screen.getByText('ftk789')
      
      expect(drkness.tagName).toBe('SPAN')
      expect(ftk789.tagName).toBe('SPAN')
      
      // Check for "and" text
      expect(screen.getByText(/and/)).toBeInTheDocument()
    })

    it('should structure text container correctly', () => {
      render(<Loader />)
      
      act(() => {
        vi.advanceTimersByTime(100)
      })
      
      const textContainer = document.querySelector('.textContainer')
      expect(textContainer).toBeInTheDocument()
      
      const creatorText = document.querySelector('.creatorText')
      expect(creatorText).toBeInTheDocument()
      expect(textContainer).toContainElement(creatorText)
    })

    it('should display app version in correct container', async () => {
      mockGetAppInfo.mockResolvedValue({ appVersion: '1.5.0' })
      
      render(<Loader />)
      
      await waitFor(() => {
        expect(mockGetAppInfo).toHaveBeenCalledTimes(1)
      })
      
      act(() => {
        vi.advanceTimersByTime(100)
      })
      
      const appVersionElement = screen.getByText('v1.5.0')
      expect(appVersionElement).toHaveClass('appVersion')
      
      const textContainer = document.querySelector('.textContainer')
      expect(textContainer).toContainElement(appVersionElement)
    })
  })

  describe('Event Handling and Callbacks', () => {
    it('should handle missing onFinish callback gracefully', () => {
      expect(() => render(<Loader />)).not.toThrow()
      
      // Fast forward through all timers
      act(() => {
        vi.advanceTimersByTime(5000)
      })
      
      // Should not throw when onFinish is undefined
    })

    it('should call onFinish only once', () => {
      const onFinish = vi.fn()
      
      render(<Loader onFinish={onFinish} />)
      
      // Fast forward past finish time multiple times
      act(() => {
        vi.advanceTimersByTime(2500)
        vi.advanceTimersByTime(1000)
        vi.advanceTimersByTime(1000)
      })
      
      expect(onFinish).toHaveBeenCalledTimes(1)
    })

    it('should pass no arguments to onFinish', () => {
      const onFinish = vi.fn()
      
      render(<Loader onFinish={onFinish} />)
      
      act(() => {
        vi.advanceTimersByTime(2500)
      })
      
      expect(onFinish).toHaveBeenCalledWith()
    })
  })

  describe('CSS Classes and Styling', () => {
    it('should apply correct CSS classes initially', () => {
      render(<Loader />)
      
      const loaderContainer = document.querySelector('.loaderContainer')
      expect(loaderContainer).toHaveClass('loaderContainer')
      expect(loaderContainer).not.toHaveClass('slideUp')
      
      const logoWrapper = document.querySelector('.logoWrapper')
      expect(logoWrapper).toHaveClass('logoWrapper')
      expect(logoWrapper).not.toHaveClass('logoWrapperFadeOut')
      
      const logoImage = screen.getByAltText('Loader Logo')
      expect(logoImage).toHaveClass('logoImage')
    })

    it('should apply conditional classes based on hideLoader state', () => {
      render(<Loader />)
      
      const loaderContainer = document.querySelector('.loaderContainer')
      const logoWrapper = document.querySelector('.logoWrapper')
      
      // Before hide animation
      expect(loaderContainer).toHaveClass('loaderContainer')
      expect(logoWrapper).toHaveClass('logoWrapper')
      
      // Trigger hide animation
      act(() => {
        vi.advanceTimersByTime(1500)
      })
      
      // After hide animation starts
      expect(loaderContainer).toHaveClass('loaderContainer', 'slideUp')
      expect(logoWrapper).toHaveClass('logoWrapper', 'logoWrapperFadeOut')
    })

    it('should conditionally render text container', async () => {
      render(<Loader />)
      
      // Text container should not exist initially
      expect(document.querySelector('.textContainer')).not.toBeInTheDocument()
      
      // Show text
      await act(async () => {
        vi.advanceTimersByTime(100)
      })
      
      // Text container should now exist with correct classes
      const textContainer = document.querySelector('.textContainer')
      expect(textContainer).toBeInTheDocument()
      expect(textContainer).toHaveClass('textContainer')
      
      const creatorText = document.querySelector('.creatorText')
      expect(creatorText).toBeInTheDocument()
      expect(creatorText).toHaveClass('creatorText')
    })

    it('should apply app version class correctly', async () => {
      mockGetAppInfo.mockResolvedValue({ appVersion: '1.0.0' })
      
      render(<Loader />)
      
      await waitFor(() => {
        expect(mockGetAppInfo).toHaveBeenCalledTimes(1)
      })
      
      act(() => {
        vi.advanceTimersByTime(100)
      })
      
      const appVersionElement = screen.getByText('v1.0.0')
      expect(appVersionElement).toHaveClass('appVersion')
    })
  })

  describe('Timer Management and Cleanup', () => {
    it('should cleanup timers on unmount', () => {
      const onFinish = vi.fn()
      const { unmount } = render(<Loader onFinish={onFinish} />)
      
      // Unmount before timers complete
      unmount()
      
      // Fast forward past when timers would have fired
      act(() => {
        vi.advanceTimersByTime(5000)
      })
      
      // onFinish should not be called after unmount
      expect(onFinish).not.toHaveBeenCalled()
    })

    it('should handle rapid mount/unmount cycles', () => {
      const onFinish = vi.fn()
      
      for (let i = 0; i < 5; i++) {
        const { unmount } = render(<Loader onFinish={onFinish} />)
        unmount()
      }
      
      // Should not cause any issues
      expect(onFinish).not.toHaveBeenCalled()
    })

    it('should handle component unmounting during different timer phases', () => {
      const onFinish = vi.fn()
      
      // Test unmounting during text show timer
      const { unmount: unmount1 } = render(<Loader onFinish={onFinish} />)
      act(() => {
        vi.advanceTimersByTime(50) // Mid text timer
      })
      unmount1()
      
      // Test unmounting during finish timer
      const { unmount: unmount2 } = render(<Loader onFinish={onFinish} />)
      act(() => {
        vi.advanceTimersByTime(1750) // Mid finish timer
      })
      unmount2()
      
      expect(onFinish).not.toHaveBeenCalled()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle window.app being undefined', () => {
      const originalWindow = global.window
      global.window = { ...global.window }
      delete global.window.app
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      expect(() => {
        render(<Loader />)
      }).not.toThrow()
      
      consoleSpy.mockRestore()
      global.window = originalWindow
    })

    it('should handle getAppInfo being undefined', async () => {
      const originalApp = global.window.app
      global.window.app = {}
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      expect(() => render(<Loader />)).not.toThrow()
      
      consoleSpy.mockRestore()
      // Restore
      global.window.app = originalApp
    })

    it('should handle very long app version strings', async () => {
      const longVersion = 'a'.repeat(100)
      mockGetAppInfo.mockResolvedValue({ appVersion: longVersion })
      
      render(<Loader />)
      
      await waitFor(() => {
        expect(mockGetAppInfo).toHaveBeenCalledTimes(1)
      })
      
      act(() => {
        vi.advanceTimersByTime(100)
      })
      
      expect(screen.getByText(`v${longVersion}`)).toBeInTheDocument()
    })

    it('should handle special characters in app version', async () => {
      const specialVersion = '1.0.0-beta.1+build.123'
      mockGetAppInfo.mockResolvedValue({ appVersion: specialVersion })
      
      render(<Loader />)
      
      await waitFor(() => {
        expect(mockGetAppInfo).toHaveBeenCalledTimes(1)
      })
      
      act(() => {
        vi.advanceTimersByTime(100)
      })
      
      expect(screen.getByText(`v${specialVersion}`)).toBeInTheDocument()
    })

    it('should handle null app version', async () => {
      mockGetAppInfo.mockResolvedValue({ appVersion: null })
      
      render(<Loader />)
      
      await waitFor(() => {
        expect(mockGetAppInfo).toHaveBeenCalledTimes(1)
      })
      
      act(() => {
        vi.advanceTimersByTime(100)
      })
      
      // Should not show version text
      expect(screen.queryByText(/^v/)).not.toBeInTheDocument()
      expect(screen.getByText('Created by')).toBeInTheDocument()
    })
  })

  describe('Performance Considerations', () => {
    it('should not cause excessive re-renders', () => {
      const renderSpy = vi.fn()
      const TestLoader = (props) => {
        renderSpy()
        return <Loader {...props} />
      }
      
      render(<TestLoader />)
      
      const initialRenderCount = renderSpy.mock.calls.length
      
      // Fast forward through timers
      act(() => {
        vi.advanceTimersByTime(100)
      })
      
      act(() => {
        vi.advanceTimersByTime(1400)
      })
      
      // Should have reasonable number of renders
      expect(renderSpy.mock.calls.length).toBeGreaterThan(initialRenderCount)
      expect(renderSpy.mock.calls.length).toBeLessThan(10) // Should not be excessive
    })

    it('should handle concurrent async operations properly', async () => {
      mockGetAppInfo.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ appVersion: '1.0.0' }), 50)
        )
      )
      
      render(<Loader />)
      
      // Fast forward past text show time but not past getAppInfo resolution
      act(() => {
        vi.advanceTimersByTime(100)
      })
      
      // Text should show but version might not be ready yet
      expect(screen.getByText('Created by')).toBeInTheDocument()
      
      // Wait for getAppInfo to resolve
      await waitFor(() => {
        expect(screen.queryByText('v1.0.0')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper alt text for logo', () => {
      render(<Loader />)
      
      const logo = screen.getByAltText('Loader Logo')
      expect(logo).toBeInTheDocument()
    })

    it('should have semantic structure for text content', () => {
      render(<Loader />)
      
      act(() => {
        vi.advanceTimersByTime(100)
      })
      
      const creatorText = screen.getByText('Created by')
      expect(creatorText.tagName).toBe('P')
      
      // Creator names should be in spans for styling
      expect(screen.getByText('DRKNESS').tagName).toBe('SPAN')
      expect(screen.getByText('ftk789').tagName).toBe('SPAN')
    })

    it('should maintain readable text hierarchy', async () => {
      mockGetAppInfo.mockResolvedValue({ appVersion: '1.0.0' })
      
      render(<Loader />)
      
      await waitFor(() => {
        expect(mockGetAppInfo).toHaveBeenCalledTimes(1)
      })
      
      act(() => {
        vi.advanceTimersByTime(100)
      })
      
      const creatorText = screen.getByText('Created by')
      const versionText = screen.getByText('v1.0.0')
      
      expect(creatorText.tagName).toBe('P')
      expect(versionText.tagName).toBe('P')
    })
  })

  describe('Integration Scenarios', () => {
    it('should work correctly with onFinish callback integration', async () => {
      const mockOnFinish = vi.fn()
      
      render(<Loader onFinish={mockOnFinish} />)
      
      // Should show initial state
      expect(screen.getByAltText('Loader Logo')).toBeInTheDocument()
      expect(screen.queryByText('Created by')).not.toBeInTheDocument()
      
      // Should show text after delay
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(screen.getByText('Created by')).toBeInTheDocument()
      
      // Should trigger slide animation and call onFinish
      act(() => {
        vi.advanceTimersByTime(1400) // Total 1500ms
      })
      
      const loaderContainer = document.querySelector('.loaderContainer')
      expect(loaderContainer).toHaveClass('slideUp')
      
      act(() => {
        vi.advanceTimersByTime(1000) // Additional 1000ms for onFinish
      })
      
      expect(mockOnFinish).toHaveBeenCalledTimes(1)
    })

    it('should handle complete loading sequence with app version', async () => {
      mockGetAppInfo.mockResolvedValue({ appVersion: '2.1.0' })
      const onFinish = vi.fn()
      
      render(<Loader onFinish={onFinish} />)
      
      // Wait for app version fetch
      await waitFor(() => {
        expect(mockGetAppInfo).toHaveBeenCalledTimes(1)
      })
      
      // Complete the full sequence
      act(() => {
        vi.advanceTimersByTime(100) // Show text
      })
      expect(screen.getByText('Created by')).toBeInTheDocument()
      expect(screen.getByText('v2.1.0')).toBeInTheDocument()
      
      act(() => {
        vi.advanceTimersByTime(1400) // Trigger hide
      })
      expect(document.querySelector('.loaderContainer')).toHaveClass('slideUp')
      
      act(() => {
        vi.advanceTimersByTime(1000) // Call onFinish
      })
      expect(onFinish).toHaveBeenCalledTimes(1)
    })
  })
})