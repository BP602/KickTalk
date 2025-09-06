import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useClickOutside from './useClickOutside'

// Mock DOM methods
const mockAddEventListener = vi.fn()
const mockRemoveEventListener = vi.fn()

describe('useClickOutside', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock document.addEventListener and removeEventListener
    Object.defineProperty(document, 'addEventListener', {
      value: mockAddEventListener,
      writable: true
    })
    
    Object.defineProperty(document, 'removeEventListener', {
      value: mockRemoveEventListener,
      writable: true
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Functionality', () => {
    it('should register event listeners on mount', () => {
      // Arrange
      const mockRef = { current: document.createElement('div') }
      const mockHandler = vi.fn()

      // Act
      renderHook(() => useClickOutside(mockRef, mockHandler))

      // Assert
      expect(mockAddEventListener).toHaveBeenCalledTimes(3)
      expect(mockAddEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function))
      expect(mockAddEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function))
      expect(mockAddEventListener).toHaveBeenCalledWith('click', expect.any(Function))
    })

    it('should remove event listeners on unmount', () => {
      // Arrange
      const mockRef = { current: document.createElement('div') }
      const mockHandler = vi.fn()

      // Act
      const { unmount } = renderHook(() => useClickOutside(mockRef, mockHandler))
      unmount()

      // Assert
      expect(mockRemoveEventListener).toHaveBeenCalledTimes(3)
      expect(mockRemoveEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function))
      expect(mockRemoveEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function))
      expect(mockRemoveEventListener).toHaveBeenCalledWith('click', expect.any(Function))
    })

    it('should call handler when clicking outside element', () => {
      // Arrange
      const mockElement = document.createElement('div')
      const mockRef = { current: mockElement }
      const mockHandler = vi.fn()
      const mockEvent = new MouseEvent('click', { bubbles: true })

      renderHook(() => useClickOutside(mockRef, mockHandler))

      // Get the registered click listener
      const clickListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1]

      // Mock contains to return false (click outside)
      mockElement.contains = vi.fn().mockReturnValue(false)

      // Act - simulate click event
      act(() => {
        clickListener(mockEvent)
      })

      // Assert
      expect(mockHandler).toHaveBeenCalledWith(mockEvent)
    })

    it('should not call handler when clicking inside element', () => {
      // Arrange
      const mockElement = document.createElement('div')
      const mockRef = { current: mockElement }
      const mockHandler = vi.fn()
      const mockEvent = new MouseEvent('click', { bubbles: true })

      renderHook(() => useClickOutside(mockRef, mockHandler))

      // Get the registered click listener
      const clickListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1]

      // Mock contains to return true (click inside)
      mockElement.contains = vi.fn().mockReturnValue(true)

      // Act
      act(() => {
        clickListener(mockEvent)
      })

      // Assert
      expect(mockHandler).not.toHaveBeenCalled()
    })
  })

  describe('Event Validation Logic', () => {
    it('should not call handler if interaction started inside element', () => {
      // Arrange
      const mockElement = document.createElement('div')
      const mockRef = { current: mockElement }
      const mockHandler = vi.fn()
      
      renderHook(() => useClickOutside(mockRef, mockHandler))

      // Get event listeners
      const mousedownListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'mousedown'
      )[1]
      const clickListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1]

      const mousedownEvent = new MouseEvent('mousedown', { bubbles: true })
      const clickEvent = new MouseEvent('click', { bubbles: true })

      // Mock contains for mousedown (inside) and click (outside)
      mockElement.contains = vi.fn()
        .mockReturnValueOnce(true)  // mousedown inside
        .mockReturnValueOnce(false) // click outside

      // Act
      act(() => {
        mousedownListener(mousedownEvent) // Start inside
        clickListener(clickEvent) // End outside
      })

      // Assert
      expect(mockHandler).not.toHaveBeenCalled()
    })

    it('should call handler if interaction started outside and ended outside', () => {
      // Arrange
      const mockElement = document.createElement('div')
      const mockRef = { current: mockElement }
      const mockHandler = vi.fn()
      
      renderHook(() => useClickOutside(mockRef, mockHandler))

      const mousedownListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'mousedown'
      )[1]
      const clickListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1]

      const mousedownEvent = new MouseEvent('mousedown', { bubbles: true })
      const clickEvent = new MouseEvent('click', { bubbles: true })

      // Both events outside
      mockElement.contains = vi.fn().mockReturnValue(false)

      // Act
      act(() => {
        mousedownListener(mousedownEvent)
        clickListener(clickEvent)
      })

      // Assert
      expect(mockHandler).toHaveBeenCalledWith(clickEvent)
    })

    it('should handle touchstart events correctly', () => {
      // Arrange
      const mockElement = document.createElement('div')
      const mockRef = { current: mockElement }
      const mockHandler = vi.fn()
      
      renderHook(() => useClickOutside(mockRef, mockHandler))

      const touchstartListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'touchstart'
      )[1]
      const clickListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1]

      const touchEvent = new TouchEvent('touchstart', { bubbles: true })
      const clickEvent = new MouseEvent('click', { bubbles: true })

      mockElement.contains = vi.fn().mockReturnValue(false)

      // Act
      act(() => {
        touchstartListener(touchEvent)
        clickListener(clickEvent)
      })

      // Assert
      expect(mockHandler).toHaveBeenCalledWith(clickEvent)
    })

    it('should not call handler if element was not mounted when interaction started', () => {
      // Arrange
      const mockRef = { current: null } // Not mounted
      const mockHandler = vi.fn()
      
      renderHook(() => useClickOutside(mockRef, mockHandler))

      const mousedownListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'mousedown'
      )[1]
      const clickListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1]

      const mousedownEvent = new MouseEvent('mousedown', { bubbles: true })
      const clickEvent = new MouseEvent('click', { bubbles: true })

      // Act
      act(() => {
        mousedownListener(mousedownEvent) // Element not mounted
        // Now mount the element
        mockRef.current = document.createElement('div')
        mockRef.current.contains = vi.fn().mockReturnValue(false)
        clickListener(clickEvent)
      })

      // Assert
      expect(mockHandler).not.toHaveBeenCalled()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle null ref gracefully', () => {
      // Arrange
      const mockHandler = vi.fn()

      // Act & Assert - should not throw
      expect(() => {
        renderHook(() => useClickOutside(null, mockHandler))
      }).not.toThrow()
    })

    it('should handle undefined ref gracefully', () => {
      // Arrange
      const mockHandler = vi.fn()

      // Act & Assert - should not throw
      expect(() => {
        renderHook(() => useClickOutside(undefined, mockHandler))
      }).not.toThrow()
    })

    it('should handle ref with null current gracefully', () => {
      // Arrange
      const mockRef = { current: null }
      const mockHandler = vi.fn()

      // Act & Assert - should not throw
      expect(() => {
        renderHook(() => useClickOutside(mockRef, mockHandler))
      }).not.toThrow()
    })

    it('should handle handler that throws an error gracefully', () => {
      // Arrange
      const mockElement = document.createElement('div')
      const mockRef = { current: mockElement }
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error')
      })

      renderHook(() => useClickOutside(mockRef, errorHandler))

      const clickListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1]

      mockElement.contains = vi.fn().mockReturnValue(false)
      const clickEvent = new MouseEvent('click', { bubbles: true })

      // Act & Assert - should not throw, error is caught
      expect(() => {
        act(() => {
          clickListener(clickEvent)
        })
      }).not.toThrow()

      expect(errorHandler).toHaveBeenCalledWith(clickEvent)
    })

    it('should handle null handler gracefully', () => {
      // Arrange
      const mockElement = document.createElement('div')
      const mockRef = { current: mockElement }

      renderHook(() => useClickOutside(mockRef, null))

      const clickListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1]

      mockElement.contains = vi.fn().mockReturnValue(false)
      const clickEvent = new MouseEvent('click', { bubbles: true })

      // Act & Assert - should not throw
      expect(() => {
        act(() => {
          clickListener(clickEvent)
        })
      }).not.toThrow()
    })

    it('should handle undefined handler gracefully', () => {
      // Arrange
      const mockElement = document.createElement('div')
      const mockRef = { current: mockElement }

      renderHook(() => useClickOutside(mockRef, undefined))

      const clickListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1]

      mockElement.contains = vi.fn().mockReturnValue(false)
      const clickEvent = new MouseEvent('click', { bubbles: true })

      // Act & Assert - should not throw
      expect(() => {
        act(() => {
          clickListener(clickEvent)
        })
      }).not.toThrow()
    })

    it('should handle element without contains method', () => {
      // Arrange
      const mockElement = {} // No contains method
      const mockRef = { current: mockElement }
      const mockHandler = vi.fn()

      renderHook(() => useClickOutside(mockRef, mockHandler))

      const clickListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1]

      const clickEvent = new MouseEvent('click', { bubbles: true })

      // Act & Assert - should not throw
      expect(() => {
        act(() => {
          clickListener(clickEvent)
        })
      }).not.toThrow()
    })
  })

  describe('Dynamic Ref Changes', () => {
    it('should work when ref.current changes', () => {
      // Arrange
      const mockElement1 = document.createElement('div')
      const mockElement2 = document.createElement('div')
      const mockRef = { current: mockElement1 }
      const mockHandler = vi.fn()

      renderHook(() => useClickOutside(mockRef, mockHandler))

      const clickListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1]

      // Setup first element
      mockElement1.contains = vi.fn().mockReturnValue(true)
      mockElement2.contains = vi.fn().mockReturnValue(false)

      const clickEvent = new MouseEvent('click', { bubbles: true })

      // Act - click with first element (inside)
      act(() => {
        clickListener(clickEvent)
      })
      expect(mockHandler).not.toHaveBeenCalled()

      // Change ref to second element
      mockRef.current = mockElement2

      // Act - click with second element (outside)
      act(() => {
        clickListener(clickEvent)
      })

      // Assert
      expect(mockHandler).toHaveBeenCalledWith(clickEvent)
    })

    it('should handle ref changing to null', () => {
      // Arrange
      const mockElement = document.createElement('div')
      const mockRef = { current: mockElement }
      const mockHandler = vi.fn()

      renderHook(() => useClickOutside(mockRef, mockHandler))

      const clickListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1]

      // Change ref to null
      mockRef.current = null

      const clickEvent = new MouseEvent('click', { bubbles: true })

      // Act & Assert - should not throw
      expect(() => {
        act(() => {
          clickListener(clickEvent)
        })
      }).not.toThrow()

      expect(mockHandler).toHaveBeenCalledWith(clickEvent)
    })
  })

  describe('Dynamic Handler Changes', () => {
    it('should use the latest handler', () => {
      // Arrange
      const mockElement = document.createElement('div')
      const mockRef = { current: mockElement }
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      const { rerender } = renderHook(
        ({ handler }) => useClickOutside(mockRef, handler),
        { initialProps: { handler: handler1 } }
      )

      const clickListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1]

      mockElement.contains = vi.fn().mockReturnValue(false)
      const clickEvent = new MouseEvent('click', { bubbles: true })

      // Act - use first handler
      act(() => {
        clickListener(clickEvent)
      })

      expect(handler1).toHaveBeenCalledWith(clickEvent)
      expect(handler2).not.toHaveBeenCalled()

      // Change handler
      rerender({ handler: handler2 })

      // Act - use second handler
      act(() => {
        clickListener(clickEvent)
      })

      // Assert
      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledWith(clickEvent)
    })

    it('should handle handler changing to null', () => {
      // Arrange
      const mockElement = document.createElement('div')
      const mockRef = { current: mockElement }
      const handler = vi.fn()

      const { rerender } = renderHook(
        ({ handler }) => useClickOutside(mockRef, handler),
        { initialProps: { handler } }
      )

      const clickListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1]

      mockElement.contains = vi.fn().mockReturnValue(false)
      const clickEvent = new MouseEvent('click', { bubbles: true })

      // Change handler to null
      rerender({ handler: null })

      // Act & Assert - should not throw
      expect(() => {
        act(() => {
          clickListener(clickEvent)
        })
      }).not.toThrow()
    })
  })

  describe('Event Target Handling', () => {
    it('should handle events with null target', () => {
      // Arrange
      const mockElement = document.createElement('div')
      const mockRef = { current: mockElement }
      const mockHandler = vi.fn()

      renderHook(() => useClickOutside(mockRef, mockHandler))

      const clickListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1]

      const clickEvent = new MouseEvent('click', { bubbles: true })
      Object.defineProperty(clickEvent, 'target', { value: null })

      // Act & Assert - should not throw
      expect(() => {
        act(() => {
          clickListener(clickEvent)
        })
      }).not.toThrow()
    })

    it('should handle events with undefined target', () => {
      // Arrange
      const mockElement = document.createElement('div')
      const mockRef = { current: mockElement }
      const mockHandler = vi.fn()

      renderHook(() => useClickOutside(mockRef, mockHandler))

      const clickListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1]

      const clickEvent = new MouseEvent('click', { bubbles: true })
      Object.defineProperty(clickEvent, 'target', { value: undefined })

      // Act & Assert - should not throw
      expect(() => {
        act(() => {
          clickListener(clickEvent)
        })
      }).not.toThrow()
    })

    it('should work with nested elements', () => {
      // Arrange
      const parentElement = document.createElement('div')
      const childElement = document.createElement('span')
      parentElement.appendChild(childElement)
      
      const mockRef = { current: parentElement }
      const mockHandler = vi.fn()

      renderHook(() => useClickOutside(mockRef, mockHandler))

      const clickListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1]

      // Mock contains to return true for child element
      parentElement.contains = vi.fn().mockReturnValue(true)

      const clickEvent = new MouseEvent('click', { bubbles: true })
      Object.defineProperty(clickEvent, 'target', { value: childElement })

      // Act
      act(() => {
        clickListener(clickEvent)
      })

      // Assert
      expect(mockHandler).not.toHaveBeenCalled()
      expect(parentElement.contains).toHaveBeenCalledWith(childElement)
    })
  })

  describe('Performance Considerations', () => {
    it('should not add duplicate event listeners on re-renders', () => {
      // Arrange
      const mockElement = document.createElement('div')
      const mockRef = { current: mockElement }
      const mockHandler = vi.fn()

      // Act
      const { rerender } = renderHook(() => useClickOutside(mockRef, mockHandler))
      
      const initialCallCount = mockAddEventListener.mock.calls.length

      // Multiple re-renders
      rerender()
      rerender()
      rerender()

      // Assert - should not add more listeners
      expect(mockAddEventListener.mock.calls.length).toBe(initialCallCount)
    })

    it('should handle rapid event firing', () => {
      // Arrange
      const mockElement = document.createElement('div')
      const mockRef = { current: mockElement }
      const mockHandler = vi.fn()

      renderHook(() => useClickOutside(mockRef, mockHandler))

      const mousedownListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'mousedown'
      )[1]
      const clickListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1]

      mockElement.contains = vi.fn().mockReturnValue(false)

      // Act - rapid events
      const events = Array.from({ length: 100 }, () => new MouseEvent('click', { bubbles: true }))
      
      act(() => {
        events.forEach(event => {
          mousedownListener(event)
          clickListener(event)
        })
      })

      // Assert
      expect(mockHandler).toHaveBeenCalledTimes(100)
    })
  })

  describe('Integration with Real DOM', () => {
    it('should work with actual DOM elements', () => {
      // Arrange
      document.body.innerHTML = `
        <div id="container">
          <div id="inside">Inside content</div>
        </div>
        <div id="outside">Outside content</div>
      `

      const containerElement = document.getElementById('container')
      const outsideElement = document.getElementById('outside')
      const mockRef = { current: containerElement }
      const mockHandler = vi.fn()

      // Restore real addEventListener for this test
      const originalAddEventListener = document.addEventListener
      const originalRemoveEventListener = document.removeEventListener
      
      Object.defineProperty(document, 'addEventListener', {
        value: originalAddEventListener,
        writable: true
      })
      Object.defineProperty(document, 'removeEventListener', {
        value: originalRemoveEventListener,
        writable: true
      })

      renderHook(() => useClickOutside(mockRef, mockHandler))

      // Create real events
      const clickEvent = new MouseEvent('click', { bubbles: true })
      Object.defineProperty(clickEvent, 'target', { value: outsideElement })

      // Act - dispatch real event
      act(() => {
        document.dispatchEvent(clickEvent)
      })

      // Assert
      expect(mockHandler).toHaveBeenCalledWith(clickEvent)

      // Cleanup
      document.body.innerHTML = ''
    })
  })

  describe('Memory Management', () => {
    it('should clean up properly on unmount', () => {
      // Arrange
      const mockElement = document.createElement('div')
      const mockRef = { current: mockElement }
      const mockHandler = vi.fn()

      // Act
      const { unmount } = renderHook(() => useClickOutside(mockRef, mockHandler))
      
      // Verify listeners were added
      expect(mockAddEventListener).toHaveBeenCalledTimes(3)
      
      unmount()

      // Assert - all listeners should be removed
      expect(mockRemoveEventListener).toHaveBeenCalledTimes(3)
      expect(mockRemoveEventListener.mock.calls).toEqual(mockAddEventListener.mock.calls)
    })

    it('should handle multiple mount/unmount cycles', () => {
      // Arrange
      const mockElement = document.createElement('div')
      const mockRef = { current: mockElement }
      const mockHandler = vi.fn()

      // Act - multiple mount/unmount cycles
      for (let i = 0; i < 5; i++) {
        const { unmount } = renderHook(() => useClickOutside(mockRef, mockHandler))
        unmount()
      }

      // Assert - should have equal add/remove calls
      expect(mockAddEventListener.mock.calls.length).toBe(15) // 3 events × 5 cycles
      expect(mockRemoveEventListener.mock.calls.length).toBe(15)
    })
  })

  describe('Type Safety and Input Validation', () => {
    it('should handle non-DOM elements in ref', () => {
      // Arrange
      const mockRef = { current: { notADOMElement: true } }
      const mockHandler = vi.fn()

      // Act & Assert - should not throw during registration
      expect(() => {
        renderHook(() => useClickOutside(mockRef, mockHandler))
      }).not.toThrow()
    })

    it('should handle complex handler functions', () => {
      // Arrange
      const mockElement = document.createElement('div')
      const mockRef = { current: mockElement }
      
      // Complex handler with multiple operations
      const complexHandler = vi.fn((event) => {
        console.log('Event:', event.type)
        return { handled: true, timestamp: Date.now() }
      })

      renderHook(() => useClickOutside(mockRef, complexHandler))

      const clickListener = mockAddEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1]

      mockElement.contains = vi.fn().mockReturnValue(false)
      const clickEvent = new MouseEvent('click', { bubbles: true })

      // Act
      act(() => {
        clickListener(clickEvent)
      })

      // Assert
      expect(complexHandler).toHaveBeenCalledWith(clickEvent)
    })
  })
})