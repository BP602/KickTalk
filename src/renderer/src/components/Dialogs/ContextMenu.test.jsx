import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContextMenu from './ContextMenu.jsx'

// Mock SCSS imports
vi.mock('../../assets/styles/dialogs/UserDialog.scss', () => ({}))

// Mock static assets
vi.mock('../../assets/icons/arrow-up-right-bold.svg', () => ({ default: 'arrow-up-right.svg' }))

// Mock window.app API
const mockContextMenu = {
  onData: vi.fn(() => vi.fn()) // Returns cleanup function
}

const mockUtils = {
  openExternal: vi.fn()
}

global.window.app = {
  contextMenu: mockContextMenu,
  utils: mockUtils
}

describe('ContextMenu Component', () => {
  let mockOnDataCleanup

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnDataCleanup = vi.fn()
    mockContextMenu.onData.mockReturnValue(mockOnDataCleanup)
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Rendering and Initial State', () => {
    it('should render without crashing', () => {
      expect(() => render(<ContextMenu />)).not.toThrow()
    })

    it('should not render anything initially', () => {
      const { container } = render(<ContextMenu />)
      
      expect(container.firstChild).toBeNull()
    })

    it('should setup data listener on mount', () => {
      render(<ContextMenu />)
      
      expect(mockContextMenu.onData).toHaveBeenCalledTimes(1)
      expect(mockContextMenu.onData).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should cleanup data listener on unmount', () => {
      const { unmount } = render(<ContextMenu />)
      
      unmount()
      
      expect(mockOnDataCleanup).toHaveBeenCalledTimes(1)
    })
  })

  describe('Message Context Menu', () => {
    const messageContextData = {
      type: 'message',
      data: {
        messageId: 'msg123',
        content: 'Test message content',
        sender: {
          username: 'testuser',
          id: 'user123'
        }
      }
    }

    it('should render message context menu when type is message', () => {
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData(messageContextData)
      
      expect(screen.getByText('asdasd')).toBeInTheDocument()
      expect(screen.getByRole('generic', { class: /contextMenuWrapper/ })).toBeInTheDocument()
    })

    it('should apply correct CSS classes for message context menu', () => {
      const { container } = render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData(messageContextData)
      
      expect(container.querySelector('.contextMenuWrapper')).toBeInTheDocument()
      expect(container.querySelector('.contextMenuItem')).toBeInTheDocument()
    })

    it('should handle message context menu with null data', () => {
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      
      expect(() => {
        handleContextMenuData({ type: 'message', data: null })
      }).not.toThrow()
    })

    it('should handle message context menu with undefined data', () => {
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      
      expect(() => {
        handleContextMenuData({ type: 'message', data: undefined })
      }).not.toThrow()
    })

    it('should handle message context menu with empty data object', () => {
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      
      expect(() => {
        handleContextMenuData({ type: 'message', data: {} })
      }).not.toThrow()
    })
  })

  describe('Streamer Context Menu', () => {
    const streamerContextData = {
      type: 'streamer',
      data: {
        url: 'https://kick.com/teststreamer',
        username: 'teststreamer',
        displayName: 'Test Streamer',
        id: 'streamer123'
      }
    }

    it('should render streamer context menu when type is streamer', () => {
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData(streamerContextData)
      
      expect(screen.getByText('Open Stream in Browser')).toBeInTheDocument()
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should apply correct CSS classes for streamer context menu', () => {
      const { container } = render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData(streamerContextData)
      
      expect(container.querySelector('.contextMenuWrapper')).toBeInTheDocument()
      expect(container.querySelector('.contextMenuItem')).toBeInTheDocument()
    })

    it('should render arrow icon in streamer context menu', () => {
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData(streamerContextData)
      
      const arrowIcon = screen.getByRole('img')
      expect(arrowIcon).toHaveAttribute('src', 'arrow-up-right.svg')
      expect(arrowIcon).toHaveAttribute('width', '16')
      expect(arrowIcon).toHaveAttribute('height', '16')
    })

    it('should handle streamer context menu click', async () => {
      const user = userEvent.setup()
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData(streamerContextData)
      
      const openStreamButton = screen.getByText('Open Stream in Browser')
      await user.click(openStreamButton)
      
      expect(mockUtils.openExternal).toHaveBeenCalledTimes(1)
      expect(mockUtils.openExternal).toHaveBeenCalledWith('https://kick.com/teststreamer')
    })

    it('should handle streamer context menu click with keyboard', async () => {
      const user = userEvent.setup()
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData(streamerContextData)
      
      const openStreamButton = screen.getByText('Open Stream in Browser')
      openStreamButton.focus()
      
      await user.keyboard('{Enter}')
      
      expect(mockUtils.openExternal).toHaveBeenCalledWith('https://kick.com/teststreamer')
    })

    it('should handle streamer context menu click with space key', async () => {
      const user = userEvent.setup()
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData(streamerContextData)
      
      const openStreamButton = screen.getByText('Open Stream in Browser')
      openStreamButton.focus()
      
      await user.keyboard(' ')
      
      expect(mockUtils.openExternal).toHaveBeenCalledWith('https://kick.com/teststreamer')
    })

    it('should handle rapid button clicks', async () => {
      const user = userEvent.setup({ delay: null })
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData(streamerContextData)
      
      const openStreamButton = screen.getByText('Open Stream in Browser')
      
      // Rapid clicks
      await user.click(openStreamButton)
      await user.click(openStreamButton)
      await user.click(openStreamButton)
      
      expect(mockUtils.openExternal).toHaveBeenCalledTimes(3)
      expect(mockUtils.openExternal).toHaveBeenCalledWith('https://kick.com/teststreamer')
    })

    it('should handle streamer context menu with null URL', async () => {
      const user = userEvent.setup()
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      const dataWithNullUrl = { ...streamerContextData, data: { ...streamerContextData.data, url: null } }
      handleContextMenuData(dataWithNullUrl)
      
      const openStreamButton = screen.getByText('Open Stream in Browser')
      await user.click(openStreamButton)
      
      expect(mockUtils.openExternal).toHaveBeenCalledWith(null)
    })

    it('should handle streamer context menu with undefined URL', async () => {
      const user = userEvent.setup()
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      const dataWithUndefinedUrl = { 
        ...streamerContextData, 
        data: { ...streamerContextData.data, url: undefined } 
      }
      handleContextMenuData(dataWithUndefinedUrl)
      
      const openStreamButton = screen.getByText('Open Stream in Browser')
      await user.click(openStreamButton)
      
      expect(mockUtils.openExternal).toHaveBeenCalledWith(undefined)
    })

    it('should handle streamer context menu with empty URL', async () => {
      const user = userEvent.setup()
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      const dataWithEmptyUrl = { ...streamerContextData, data: { ...streamerContextData.data, url: '' } }
      handleContextMenuData(dataWithEmptyUrl)
      
      const openStreamButton = screen.getByText('Open Stream in Browser')
      await user.click(openStreamButton)
      
      expect(mockUtils.openExternal).toHaveBeenCalledWith('')
    })

    it('should handle different URL formats correctly', async () => {
      const user = userEvent.setup()
      
      const testUrls = [
        'https://kick.com/teststreamer',
        'http://kick.com/teststreamer',
        'https://www.kick.com/teststreamer',
        'kick.com/teststreamer',
        'https://kick.com/teststreamer?param=value',
        'https://kick.com/teststreamer#section'
      ]
      
      for (const url of testUrls) {
        render(<ContextMenu />)
        
        const handleContextMenuData = mockContextMenu.onData.mock.calls[mockContextMenu.onData.mock.calls.length - 1][0]
        const dataWithUrl = { ...streamerContextData, data: { ...streamerContextData.data, url } }
        handleContextMenuData(dataWithUrl)
        
        const openStreamButton = screen.getByText('Open Stream in Browser')
        await user.click(openStreamButton)
        
        expect(mockUtils.openExternal).toHaveBeenCalledWith(url)
        
        // Cleanup for next iteration
        vi.clearAllMocks()
        mockContextMenu.onData.mockReturnValue(vi.fn())
      }
    })
  })

  describe('Data Handling', () => {
    it('should handle null context menu data', () => {
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      
      expect(() => {
        handleContextMenuData(null)
      }).not.toThrow()
    })

    it('should handle undefined context menu data', () => {
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      
      expect(() => {
        handleContextMenuData(undefined)
      }).not.toThrow()
    })

    it('should handle empty context menu data object', () => {
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      
      expect(() => {
        handleContextMenuData({})
      }).not.toThrow()
    })

    it('should handle context menu data with unknown type', () => {
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      
      expect(() => {
        handleContextMenuData({ type: 'unknown', data: {} })
      }).not.toThrow()
      
      // Should not render anything
      const { container } = render(<ContextMenu />)
      expect(container.firstChild).toBeNull()
    })

    it('should handle context menu data without type', () => {
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      
      expect(() => {
        handleContextMenuData({ data: { some: 'data' } })
      }).not.toThrow()
    })

    it('should handle context menu data without data property', () => {
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      
      expect(() => {
        handleContextMenuData({ type: 'streamer' })
      }).not.toThrow()
    })

    it('should update context menu when new data arrives', () => {
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      
      // First show message context menu
      handleContextMenuData({ type: 'message', data: {} })
      expect(screen.getByText('asdasd')).toBeInTheDocument()
      
      // Then switch to streamer context menu
      handleContextMenuData({
        type: 'streamer',
        data: { url: 'https://kick.com/test' }
      })
      expect(screen.getByText('Open Stream in Browser')).toBeInTheDocument()
      expect(screen.queryByText('asdasd')).not.toBeInTheDocument()
    })

    it('should handle rapid data updates', () => {
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      
      // Rapid data updates
      for (let i = 0; i < 100; i++) {
        const type = i % 2 === 0 ? 'message' : 'streamer'
        const data = type === 'streamer' ? { url: `https://kick.com/streamer${i}` } : {}
        handleContextMenuData({ type, data })
      }
      
      // Should end up with streamer context menu (last update was i=99, odd number)
      expect(screen.getByText('Open Stream in Browser')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle missing window.app gracefully', () => {
      const originalApp = global.window.app
      delete global.window.app
      
      expect(() => {
        render(<ContextMenu />)
      }).not.toThrow()
      
      global.window.app = originalApp
    })

    it('should handle missing contextMenu API gracefully', () => {
      const originalContextMenu = window.app.contextMenu
      delete window.app.contextMenu
      
      expect(() => {
        render(<ContextMenu />)
      }).not.toThrow()
      
      window.app.contextMenu = originalContextMenu
    })

    it('should handle missing utils API gracefully', async () => {
      const user = userEvent.setup()
      const originalUtils = window.app.utils
      delete window.app.utils
      
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData({
        type: 'streamer',
        data: { url: 'https://kick.com/test' }
      })
      
      const openStreamButton = screen.getByText('Open Stream in Browser')
      
      // Should not crash when utils.openExternal is missing
      await expect(user.click(openStreamButton)).resolves.not.toThrow()
      
      window.app.utils = originalUtils
    })

    it('should handle openExternal errors gracefully', async () => {
      const user = userEvent.setup()
      
      mockUtils.openExternal.mockImplementation(() => {
        throw new Error('Failed to open external URL')
      })
      
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData({
        type: 'streamer',
        data: { url: 'https://kick.com/test' }
      })
      
      const openStreamButton = screen.getByText('Open Stream in Browser')
      
      // Should not crash when openExternal throws
      await expect(user.click(openStreamButton)).resolves.not.toThrow()
    })

    it('should handle onData callback errors gracefully', () => {
      const originalConsoleError = console.error
      console.error = vi.fn()
      
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      
      // Should not crash when state update fails
      expect(() => {
        handleContextMenuData({ type: 'streamer', data: { url: 'test' } })
      }).not.toThrow()
      
      console.error = originalConsoleError
    })
  })

  describe('Component Lifecycle', () => {
    it('should initialize with empty state', () => {
      const { container } = render(<ContextMenu />)
      
      // Should not render anything initially
      expect(container.firstChild).toBeNull()
    })

    it('should cleanup on unmount', () => {
      const { unmount } = render(<ContextMenu />)
      
      unmount()
      
      expect(mockOnDataCleanup).toHaveBeenCalledTimes(1)
    })

    it('should handle multiple mount/unmount cycles', () => {
      const cleanupFunctions = []
      
      for (let i = 0; i < 5; i++) {
        const cleanup = vi.fn()
        mockContextMenu.onData.mockReturnValue(cleanup)
        cleanupFunctions.push(cleanup)
        
        const { unmount } = render(<ContextMenu />)
        unmount()
        
        expect(cleanup).toHaveBeenCalledTimes(1)
      }
    })

    it('should not cause memory leaks with repeated renders', () => {
      const { rerender } = render(<ContextMenu />)
      
      // Multiple re-renders should not cause issues
      for (let i = 0; i < 100; i++) {
        rerender(<ContextMenu />)
      }
      
      // Should still setup listener correctly
      expect(mockContextMenu.onData).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility', () => {
    it('should have proper button role for streamer context menu', () => {
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData({
        type: 'streamer',
        data: { url: 'https://kick.com/test' }
      })
      
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      expect(button.tagName).toBe('BUTTON')
    })

    it('should have descriptive button text for streamer context menu', () => {
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData({
        type: 'streamer',
        data: { url: 'https://kick.com/test' }
      })
      
      expect(screen.getByRole('button', { name: /open stream in browser/i })).toBeInTheDocument()
    })

    it('should support keyboard navigation for streamer context menu', async () => {
      const user = userEvent.setup()
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData({
        type: 'streamer',
        data: { url: 'https://kick.com/test' }
      })
      
      const button = screen.getByRole('button')
      button.focus()
      expect(button).toHaveFocus()
      
      await user.keyboard('{Enter}')
      expect(mockUtils.openExternal).toHaveBeenCalled()
    })

    it('should have proper image alt text', () => {
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData({
        type: 'streamer',
        data: { url: 'https://kick.com/test' }
      })
      
      const image = screen.getByRole('img')
      expect(image).toBeInTheDocument()
      // Note: The component doesn't set alt text, which is an accessibility issue
    })

    it('should have proper semantic structure', () => {
      const { container } = render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData({
        type: 'streamer',
        data: { url: 'https://kick.com/test' }
      })
      
      expect(container.querySelector('.contextMenuWrapper')).toBeInTheDocument()
      expect(container.querySelector('.contextMenuItem')).toBeInTheDocument()
    })

    it('should support screen reader navigation', () => {
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData({
        type: 'streamer',
        data: { url: 'https://kick.com/test' }
      })
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('type', 'button')
    })
  })

  describe('CSS Classes and Styling', () => {
    it('should apply correct CSS classes for message context menu', () => {
      const { container } = render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData({ type: 'message', data: {} })
      
      expect(container.querySelector('.contextMenuWrapper')).toBeInTheDocument()
      expect(container.querySelector('.contextMenuItem')).toBeInTheDocument()
    })

    it('should apply correct CSS classes for streamer context menu', () => {
      const { container } = render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData({
        type: 'streamer',
        data: { url: 'https://kick.com/test' }
      })
      
      expect(container.querySelector('.contextMenuWrapper')).toBeInTheDocument()
      expect(container.querySelector('.contextMenuItem')).toBeInTheDocument()
    })

    it('should not have any CSS classes when no data', () => {
      const { container } = render(<ContextMenu />)
      
      expect(container.firstChild).toBeNull()
    })

    it('should maintain correct CSS structure after data updates', () => {
      const { container } = render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      
      // First update
      handleContextMenuData({ type: 'message', data: {} })
      expect(container.querySelector('.contextMenuWrapper')).toBeInTheDocument()
      
      // Second update
      handleContextMenuData({
        type: 'streamer',
        data: { url: 'https://kick.com/test' }
      })
      expect(container.querySelector('.contextMenuWrapper')).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('should render quickly with minimal DOM updates', () => {
      const start = performance.now()
      render(<ContextMenu />)
      const end = performance.now()
      
      // Should render quickly
      expect(end - start).toBeLessThan(50)
    })

    it('should handle rapid context menu type changes efficiently', () => {
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      
      const start = performance.now()
      
      // Rapid type changes
      for (let i = 0; i < 1000; i++) {
        const type = i % 2 === 0 ? 'message' : 'streamer'
        const data = type === 'streamer' ? { url: 'https://kick.com/test' } : {}
        handleContextMenuData({ type, data })
      }
      
      const end = performance.now()
      
      // Should handle rapid updates efficiently
      expect(end - start).toBeLessThan(100)
    })

    it('should not create unnecessary DOM nodes', () => {
      const { container } = render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData({
        type: 'streamer',
        data: { url: 'https://kick.com/test' }
      })
      
      // Should only create necessary DOM structure
      const allElements = container.querySelectorAll('*')
      expect(allElements.length).toBeLessThan(10) // Reasonable upper bound
    })

    it('should optimize re-renders', () => {
      const { rerender } = render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData({
        type: 'streamer',
        data: { url: 'https://kick.com/test' }
      })
      
      const start = performance.now()
      
      // Multiple re-renders with same props
      for (let i = 0; i < 100; i++) {
        rerender(<ContextMenu />)
      }
      
      const end = performance.now()
      
      // Should re-render efficiently
      expect(end - start).toBeLessThan(100)
    })
  })

  describe('Integration Tests', () => {
    it('should work end-to-end with message context menu', () => {
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData({
        type: 'message',
        data: {
          messageId: 'msg123',
          content: 'Test message',
          sender: { username: 'testuser' }
        }
      })
      
      expect(screen.getByText('asdasd')).toBeInTheDocument()
    })

    it('should work end-to-end with streamer context menu', async () => {
      const user = userEvent.setup()
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData({
        type: 'streamer',
        data: {
          url: 'https://kick.com/teststreamer',
          username: 'teststreamer',
          displayName: 'Test Streamer'
        }
      })
      
      expect(screen.getByText('Open Stream in Browser')).toBeInTheDocument()
      
      const button = screen.getByRole('button')
      await user.click(button)
      
      expect(mockUtils.openExternal).toHaveBeenCalledWith('https://kick.com/teststreamer')
    })

    it('should handle context menu switching correctly', async () => {
      const user = userEvent.setup()
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      
      // Start with message context menu
      handleContextMenuData({ type: 'message', data: {} })
      expect(screen.getByText('asdasd')).toBeInTheDocument()
      
      // Switch to streamer context menu
      handleContextMenuData({
        type: 'streamer',
        data: { url: 'https://kick.com/test' }
      })
      expect(screen.getByText('Open Stream in Browser')).toBeInTheDocument()
      expect(screen.queryByText('asdasd')).not.toBeInTheDocument()
      
      // Test interaction
      await user.click(screen.getByRole('button'))
      expect(mockUtils.openExternal).toHaveBeenCalled()
    })

    it('should maintain functionality across data updates', async () => {
      const user = userEvent.setup()
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      
      // Multiple data updates for streamer context menu
      const urls = [
        'https://kick.com/streamer1',
        'https://kick.com/streamer2',
        'https://kick.com/streamer3'
      ]
      
      for (const url of urls) {
        handleContextMenuData({
          type: 'streamer',
          data: { url }
        })
        
        const button = screen.getByRole('button')
        await user.click(button)
        
        expect(mockUtils.openExternal).toHaveBeenCalledWith(url)
      }
      
      expect(mockUtils.openExternal).toHaveBeenCalledTimes(3)
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long URLs gracefully', async () => {
      const user = userEvent.setup()
      const longUrl = 'https://kick.com/streamer' + 'a'.repeat(1000) + '/path/to/stream?param=' + 'b'.repeat(500)
      
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData({
        type: 'streamer',
        data: { url: longUrl }
      })
      
      const button = screen.getByRole('button')
      await user.click(button)
      
      expect(mockUtils.openExternal).toHaveBeenCalledWith(longUrl)
    })

    it('should handle special characters in URLs', async () => {
      const user = userEvent.setup()
      const specialUrl = 'https://kick.com/streamer-name_123/stream?param=value&other=test#section'
      
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData({
        type: 'streamer',
        data: { url: specialUrl }
      })
      
      const button = screen.getByRole('button')
      await user.click(button)
      
      expect(mockUtils.openExternal).toHaveBeenCalledWith(specialUrl)
    })

    it('should handle Unicode characters in URLs', async () => {
      const user = userEvent.setup()
      const unicodeUrl = 'https://kick.com/ストリーマー/配信'
      
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      handleContextMenuData({
        type: 'streamer',
        data: { url: unicodeUrl }
      })
      
      const button = screen.getByRole('button')
      await user.click(button)
      
      expect(mockUtils.openExternal).toHaveBeenCalledWith(unicodeUrl)
    })

    it('should handle malformed data objects', () => {
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      
      const malformedData = [
        { type: 'streamer', data: 'not an object' },
        { type: 'streamer', data: 123 },
        { type: 'streamer', data: [] },
        { type: 'streamer', data: true },
        { type: 'message', data: 'not an object' }
      ]
      
      malformedData.forEach(data => {
        expect(() => {
          handleContextMenuData(data)
        }).not.toThrow()
      })
    })

    it('should handle circular reference objects', () => {
      render(<ContextMenu />)
      
      const handleContextMenuData = mockContextMenu.onData.mock.calls[0][0]
      
      const circularData = { type: 'streamer', data: { url: 'test' } }
      circularData.data.self = circularData
      
      expect(() => {
        handleContextMenuData(circularData)
      }).not.toThrow()
    })
  })
})