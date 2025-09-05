import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import Updater from './Updater'
import log from 'electron-log'

// Mock SCSS imports
vi.mock('@assets/styles/components/Updater.scss', () => ({}))

// Mock clsx
vi.mock('clsx', () => ({
  default: (...args) => args.filter(Boolean).join(' ')
}))

// Mock static assets
vi.mock('@assets/icons/cloud-arrow-down-fill.svg?asset', () => ({ 
  default: 'cloud-arrow-down-icon.svg' 
}))

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}))

// Mock window.app.update API
const mockUpdateAPI = {
  onUpdate: vi.fn(),
  onDismiss: vi.fn(),
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn(),
  installUpdate: vi.fn()
}

global.window = {
  app: {
    update: mockUpdateAPI
  }
}

describe('Updater Component', () => {
  let mockCleanupUpdate
  let mockCleanupDismiss

  beforeEach(() => {
    // Use real timers for this test to avoid environment conflicts
    vi.useRealTimers()
    vi.clearAllMocks()
    
    // Reset mock functions
    mockCleanupUpdate = vi.fn()
    mockCleanupDismiss = vi.fn()
    
    mockUpdateAPI.onUpdate.mockReturnValue(mockCleanupUpdate)
    mockUpdateAPI.onDismiss.mockReturnValue(mockCleanupDismiss)
    
    mockUpdateAPI.checkForUpdates.mockResolvedValue({ success: true })
    mockUpdateAPI.downloadUpdate.mockResolvedValue({ success: true })
    mockUpdateAPI.installUpdate.mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Component Initialization', () => {
    it('should render without crashing when no updates available', () => {
      render(<Updater />)
      
      // Should not show update UI when idle
      expect(document.querySelector('.updater')).toBeInTheDocument()
      expect(document.querySelector('.updateAvailable')).not.toBeInTheDocument()
    })

    it('should set up update event listeners on mount', () => {
      render(<Updater />)
      
      expect(mockUpdateAPI.onUpdate).toHaveBeenCalledWith(expect.any(Function))
      expect(mockUpdateAPI.onDismiss).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should clean up event listeners on unmount', () => {
      const { unmount } = render(<Updater />)
      
      unmount()
      
      expect(mockCleanupUpdate).toHaveBeenCalledTimes(1)
      expect(mockCleanupDismiss).toHaveBeenCalledTimes(1)
    })

    it('should have correct initial state', () => {
      render(<Updater />)
      
      const updaterContainer = document.querySelector('.updater')
      expect(updaterContainer).toBeInTheDocument()
      expect(updaterContainer).not.toHaveClass('updateAvailable')
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('Update Event Handling', () => {
    it('should handle ready state update event', () => {
      let updateCallback

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      render(<Updater />)

      act(() => {
        updateCallback({ 
          event: 'ready',
          version: '2.0.0',
          files: ['update.exe']
        })
      })

      expect(screen.getByText('Update Now')).toBeInTheDocument()
      expect(screen.getByText('v 2.0.0')).toBeInTheDocument()
    })

    it('should handle download-failed state update event', () => {
      let updateCallback

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      render(<Updater />)

      act(() => {
        updateCallback({ 
          event: 'download-failed',
          version: '2.0.0',
          error: 'Network error'
        })
      })

      expect(screen.getByText('Retry Update')).toBeInTheDocument()
      expect(screen.getByText('v 2.0.0')).toBeInTheDocument()
    })

    it('should handle error state update event', () => {
      let updateCallback

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      render(<Updater />)

      act(() => {
        updateCallback({ 
          event: 'error',
          version: '2.0.0',
          error: 'Update check failed'
        })
      })

      expect(screen.getByText('Error - Retry Update')).toBeInTheDocument()
      expect(screen.getByText('v 2.0.0')).toBeInTheDocument()
    })

    it('should handle update event with undefined data', () => {
      let updateCallback

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      render(<Updater />)

      act(() => {
        updateCallback(undefined)
      })

      // Should not crash and remain in idle state
      expect(document.querySelector('.updater')).not.toHaveClass('updateAvailable')
    })

    it('should handle update event with null data', () => {
      let updateCallback

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      render(<Updater />)

      act(() => {
        updateCallback(null)
      })

      // Should not crash and remain in idle state
      expect(document.querySelector('.updater')).not.toHaveClass('updateAvailable')
    })
  })

  describe('Dismiss Event Handling', () => {
    it('should reset to idle state when dismiss event is received', () => {
      let dismissCallback
      let updateCallback

      mockUpdateAPI.onDismiss.mockImplementation((callback) => {
        dismissCallback = callback
        return mockCleanupDismiss
      })

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      render(<Updater />)

      // First set an update state
      act(() => {
        updateCallback({ 
          event: 'ready',
          version: '2.0.0',
          files: ['update.exe']
        })
      })

      expect(screen.getByText('Update Now')).toBeInTheDocument()

      // Now dismiss
      act(() => {
        dismissCallback()
      })

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      expect(document.querySelector('.updater')).not.toHaveClass('updateAvailable')
    })
  })

  describe('Button Interactions', () => {
    it('should install update when ready button is clicked', () => {
      let updateCallback

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      render(<Updater />)

      // Set ready state
      act(() => {
        updateCallback({ 
          event: 'ready',
          version: '2.0.0',
          files: ['update.exe']
        })
      })

      const installButton = screen.getByText('Update Now')
      fireEvent.click(installButton)

      expect(mockUpdateAPI.installUpdate).toHaveBeenCalledTimes(1)
    })

    it('should check for updates when error retry button is clicked', () => {
      let updateCallback

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      render(<Updater />)

      // Set error state
      act(() => {
        updateCallback({ 
          event: 'error',
          version: '2.0.0',
          error: 'Previous error'
        })
      })

      const retryButton = screen.getByText('Error - Retry Update')
      fireEvent.click(retryButton)

      expect(mockUpdateAPI.checkForUpdates).toHaveBeenCalledTimes(1)
    })

    it('should download update when download retry button is clicked', () => {
      let updateCallback

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      render(<Updater />)

      // Set download-failed state
      act(() => {
        updateCallback({ 
          event: 'download-failed',
          version: '2.0.0',
          error: 'Download failed'
        })
      })

      const retryButton = screen.getByText('Retry Update')
      fireEvent.click(retryButton)

      expect(mockUpdateAPI.downloadUpdate).toHaveBeenCalledTimes(1)
    })
  })

  describe('UI Rendering and Classes', () => {
    it('should apply updateAvailable class when update is ready', () => {
      let updateCallback

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      render(<Updater />)

      act(() => {
        updateCallback({ 
          event: 'ready',
          version: '2.0.0',
          files: ['update.exe']
        })
      })

      const updaterContainer = document.querySelector('.updater')
      expect(updaterContainer).toHaveClass('updateAvailable')
    })

    it('should display correct version number', () => {
      let updateCallback

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      render(<Updater />)

      act(() => {
        updateCallback({ 
          event: 'ready',
          version: '3.1.0-beta',
          files: ['update.exe']
        })
      })

      expect(screen.getByText('v 3.1.0-beta')).toBeInTheDocument()
    })

    it('should render download icon', () => {
      let updateCallback

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      render(<Updater />)

      act(() => {
        updateCallback({ 
          event: 'ready',
          version: '2.0.0',
          files: ['update.exe']
        })
      })

      const downloadIcon = screen.getByAltText('download')
      expect(downloadIcon).toBeInTheDocument()
      expect(downloadIcon).toHaveAttribute('src', 'cloud-arrow-down-icon.svg')
    })

    it('should have correct CSS structure', () => {
      let updateCallback

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      render(<Updater />)

      act(() => {
        updateCallback({ 
          event: 'ready',
          version: '2.0.0',
          files: ['update.exe']
        })
      })

      const updaterContainer = document.querySelector('.updater')
      const button = screen.getByRole('button')
      const mainContent = document.querySelector('.updaterMainContent')

      expect(updaterContainer).toHaveClass('updater', 'updateAvailable')
      expect(button).toBeInTheDocument()
      expect(mainContent).toBeInTheDocument()
      expect(mainContent).toHaveClass('updaterMainContent')
    })

    it('should handle missing version gracefully', () => {
      let updateCallback

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      render(<Updater />)

      act(() => {
        updateCallback({ 
          event: 'ready',
          files: ['update.exe']
        })
      })

      expect(screen.getByText('v')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle checkForUpdates network error', async () => {
      let updateCallback

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      const networkError = new Error('Network error')
      mockUpdateAPI.checkForUpdates.mockRejectedValue(networkError)

      render(<Updater />)

      // Set error state to show retry button
      act(() => {
        updateCallback({ 
          event: 'error',
          version: '2.0.0',
          error: 'Previous error'
        })
      })

      const retryButton = screen.getByText('Error - Retry Update')
      fireEvent.click(retryButton)

      await waitFor(() => {
        expect(log.error).toHaveBeenCalledWith(
          '[Updater] Error checking for updates:',
          networkError
        )
      })
    })

    it('should handle download update network error', async () => {
      let updateCallback

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      const networkError = new Error('Network timeout')
      mockUpdateAPI.downloadUpdate.mockRejectedValue(networkError)

      render(<Updater />)

      // Set download-failed state
      act(() => {
        updateCallback({ 
          event: 'download-failed',
          version: '2.0.0',
          error: 'Previous download failed'
        })
      })

      const retryButton = screen.getByText('Retry Update')
      fireEvent.click(retryButton)

      await waitFor(() => {
        expect(log.error).toHaveBeenCalledWith(
          '[Updater] Error downloading update:',
          networkError
        )
      })
    })
  })

  describe('Button State Management', () => {
    it('should show correct button for ready state', () => {
      let updateCallback

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      render(<Updater />)

      act(() => {
        updateCallback({ 
          event: 'ready',
          version: '2.0.0',
          files: ['update.exe']
        })
      })

      const button = screen.getByRole('button')
      expect(button).toHaveTextContent('Update Now')
      expect(button).not.toBeDisabled()
    })

    it('should show correct button for download-failed state', () => {
      let updateCallback

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      render(<Updater />)

      act(() => {
        updateCallback({ 
          event: 'download-failed',
          version: '2.0.0',
          error: 'Download failed'
        })
      })

      const button = screen.getByRole('button')
      expect(button).toHaveTextContent('Retry Update')
      expect(button).not.toBeDisabled()
    })

    it('should show correct button for error state', () => {
      let updateCallback

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      render(<Updater />)

      act(() => {
        updateCallback({ 
          event: 'error',
          version: '2.0.0',
          error: 'Check failed'
        })
      })

      const button = screen.getByRole('button')
      expect(button).toHaveTextContent('Error - Retry Update')
      expect(button).not.toBeDisabled()
    })

    it('should not show button for checking state', () => {
      let updateCallback

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      render(<Updater />)

      act(() => {
        updateCallback({ 
          event: 'checking',
          version: null
        })
      })

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('should not show button for downloading state', () => {
      let updateCallback

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      render(<Updater />)

      act(() => {
        updateCallback({ 
          event: 'downloading',
          percent: 50
        })
      })

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('should not show button for idle state', () => {
      render(<Updater />)

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long version strings', () => {
      let updateCallback

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      render(<Updater />)

      const longVersion = '1.0.0-very-long-prerelease-identifier-that-might-break-layout'

      act(() => {
        updateCallback({ 
          event: 'ready',
          version: longVersion,
          files: ['update.exe']
        })
      })

      expect(screen.getByText(`v ${longVersion}`)).toBeInTheDocument()
    })

    it('should handle special characters in version', () => {
      let updateCallback

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      render(<Updater />)

      const specialVersion = '2.0.0+build.123-αβγ'

      act(() => {
        updateCallback({ 
          event: 'ready',
          version: specialVersion,
          files: ['update.exe']
        })
      })

      expect(screen.getByText(`v ${specialVersion}`)).toBeInTheDocument()
    })
  })

  describe('Integration Flow', () => {
    it('should handle complete update flow', () => {
      let updateCallback

      mockUpdateAPI.onUpdate.mockImplementation((callback) => {
        updateCallback = callback
        return mockCleanupUpdate
      })

      render(<Updater />)

      // 1. Error state - retry check
      act(() => {
        updateCallback({ 
          event: 'error',
          version: '2.0.0',
          error: 'Initial error'
        })
      })

      fireEvent.click(screen.getByText('Error - Retry Update'))
      expect(mockUpdateAPI.checkForUpdates).toHaveBeenCalled()

      // 2. Download failed - retry download
      act(() => {
        updateCallback({ 
          event: 'download-failed',
          version: '2.0.0',
          error: 'Download error'
        })
      })

      fireEvent.click(screen.getByText('Retry Update'))
      expect(mockUpdateAPI.downloadUpdate).toHaveBeenCalled()

      // 3. Ready - install
      act(() => {
        updateCallback({ 
          event: 'ready',
          version: '2.0.0',
          files: ['update.exe']
        })
      })

      fireEvent.click(screen.getByText('Update Now'))
      expect(mockUpdateAPI.installUpdate).toHaveBeenCalled()
    })
  })
})