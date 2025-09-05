import { render } from '@testing-library/react';
import { vi, beforeEach, afterEach } from 'vitest';
import { useRef } from 'react';
import useClickOutside from './useClickOutside';

// Test component that uses the hook
const TestComponent = ({ onClickOutside, disabled = false }) => {
  const ref = useRef(null);
  
  if (!disabled) {
    useClickOutside(ref, onClickOutside);
  }
  
  return (
    <div data-testid="container">
      <div ref={ref} data-testid="target">
        Target Element
        <button data-testid="inside-button">Inside Button</button>
      </div>
      <button data-testid="outside-button">Outside Button</button>
    </div>
  );
};

describe('useClickOutside', () => {
  let mockHandler;
  let container;

  beforeEach(() => {
    mockHandler = vi.fn();
    
    // Mock document methods
    const originalAddEventListener = document.addEventListener;
    const originalRemoveEventListener = document.removeEventListener;
    
    const eventListeners = new Map();
    
    document.addEventListener = vi.fn((event, listener) => {
      if (!eventListeners.has(event)) {
        eventListeners.set(event, []);
      }
      eventListeners.get(event).push(listener);
      originalAddEventListener.call(document, event, listener);
    });
    
    document.removeEventListener = vi.fn((event, listener) => {
      if (eventListeners.has(event)) {
        const listeners = eventListeners.get(event);
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
      originalRemoveEventListener.call(document, event, listener);
    });
    
    // Store reference for cleanup
    document._mockEventListeners = eventListeners;
  });

  afterEach(() => {
    vi.clearAllMocks();
    
    // Clean up event listeners
    if (document._mockEventListeners) {
      document._mockEventListeners.forEach((listeners, event) => {
        listeners.forEach(listener => {
          document.removeEventListener(event, listener);
        });
      });
      delete document._mockEventListeners;
    }
  });

  describe('Event Listener Registration', () => {
    it('should register mousedown, touchstart, and click event listeners', () => {
      render(<TestComponent onClickOutside={mockHandler} />);
      
      expect(document.addEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(document.addEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function));
      expect(document.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(document.addEventListener).toHaveBeenCalledTimes(3);
    });

    it('should remove event listeners on unmount', () => {
      const { unmount } = render(<TestComponent onClickOutside={mockHandler} />);
      
      const addCalls = document.addEventListener.mock.calls;
      
      unmount();
      
      expect(document.removeEventListener).toHaveBeenCalledTimes(3);
      expect(document.removeEventListener).toHaveBeenCalledWith('mousedown', addCalls[0][1]);
      expect(document.removeEventListener).toHaveBeenCalledWith('touchstart', addCalls[1][1]);
      expect(document.removeEventListener).toHaveBeenCalledWith('click', addCalls[2][1]);
    });

    it('should re-register listeners when handler changes', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      const { rerender } = render(<TestComponent onClickOutside={handler1} />);
      
      expect(document.addEventListener).toHaveBeenCalledTimes(3);
      
      rerender(<TestComponent onClickOutside={handler2} />);
      
      // Should remove old listeners and add new ones
      expect(document.removeEventListener).toHaveBeenCalledTimes(3);
      expect(document.addEventListener).toHaveBeenCalledTimes(6); // 3 initial + 3 new
    });
  });

  describe('Click Outside Detection', () => {
    it('should call handler when clicking outside the target element', () => {
      const { container } = render(<TestComponent onClickOutside={mockHandler} />);
      
      const outsideButton = container.querySelector('[data-testid="outside-button"]');
      const target = container.querySelector('[data-testid="target"]');
      
      // Simulate mousedown outside (to set startedInside = false)
      const mousedownEvent = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(mousedownEvent, 'target', { value: outsideButton });
      document.dispatchEvent(mousedownEvent);
      
      // Simulate click outside
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: outsideButton });
      document.dispatchEvent(clickEvent);
      
      expect(mockHandler).toHaveBeenCalledWith(clickEvent);
    });

    it('should not call handler when clicking inside the target element', () => {
      const { container } = render(<TestComponent onClickOutside={mockHandler} />);
      
      const insideButton = container.querySelector('[data-testid="inside-button"]');
      const target = container.querySelector('[data-testid="target"]');
      
      // Simulate mousedown inside (to set startedInside = true)
      const mousedownEvent = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(mousedownEvent, 'target', { value: insideButton });
      document.dispatchEvent(mousedownEvent);
      
      // Simulate click inside
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: insideButton });
      document.dispatchEvent(clickEvent);
      
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should not call handler when clicking on the target element itself', () => {
      const { container } = render(<TestComponent onClickOutside={mockHandler} />);
      
      const target = container.querySelector('[data-testid="target"]');
      
      // Simulate mousedown on target (to set startedInside = true)
      const mousedownEvent = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(mousedownEvent, 'target', { value: target });
      document.dispatchEvent(mousedownEvent);
      
      // Simulate click on target
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: target });
      document.dispatchEvent(clickEvent);
      
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('Interaction Start Validation', () => {
    it('should not trigger on mousedown outside if component was not mounted at start', () => {
      let componentRef = null;
      
      const LateRenderComponent = () => {
        const ref = useRef(null);
        componentRef = ref;
        useClickOutside(ref, mockHandler);
        return <div ref={ref} data-testid="late-target">Late Target</div>;
      };
      
      // Simulate mousedown before component mounts
      const mousedownEvent = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(mousedownEvent, 'target', { value: document.body });
      document.dispatchEvent(mousedownEvent);
      
      // Now mount component
      const { container } = render(<LateRenderComponent />);
      
      // Click outside after mount
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: document.body });
      document.dispatchEvent(clickEvent);
      
      // Should not trigger handler because mousedown happened before mount
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should handle touchstart events the same as mousedown', () => {
      const { container } = render(<TestComponent onClickOutside={mockHandler} />);
      
      const outsideButton = container.querySelector('[data-testid="outside-button"]');
      
      // Simulate touchstart outside (to set startedInside = false)
      const touchstartEvent = new TouchEvent('touchstart', { bubbles: true });
      Object.defineProperty(touchstartEvent, 'target', { value: outsideButton });
      document.dispatchEvent(touchstartEvent);
      
      // Simulate click outside
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: outsideButton });
      document.dispatchEvent(clickEvent);
      
      expect(mockHandler).toHaveBeenCalledWith(clickEvent);
    });

    it('should not trigger when drag starts inside and ends outside', () => {
      const { container } = render(<TestComponent onClickOutside={mockHandler} />);
      
      const insideButton = container.querySelector('[data-testid="inside-button"]');
      const outsideButton = container.querySelector('[data-testid="outside-button"]');
      
      // Simulate mousedown inside (drag start)
      const mousedownEvent = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(mousedownEvent, 'target', { value: insideButton });
      document.dispatchEvent(mousedownEvent);
      
      // Simulate click outside (drag end)
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: outsideButton });
      document.dispatchEvent(clickEvent);
      
      // Should not trigger because interaction started inside
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('Ref State Management', () => {
    it('should handle null ref gracefully', () => {
      const NullRefComponent = () => {
        useClickOutside(null, mockHandler);
        return <div data-testid="no-ref">No Ref</div>;
      };
      
      expect(() => {
        render(<NullRefComponent />);
      }).not.toThrow();
      
      // Simulate click
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: document.body });
      document.dispatchEvent(clickEvent);
      
      // Should not crash or call handler
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should handle ref with null current gracefully', () => {
      const NullCurrentComponent = () => {
        const ref = { current: null };
        useClickOutside(ref, mockHandler);
        return <div data-testid="null-current">Null Current</div>;
      };
      
      expect(() => {
        render(<NullCurrentComponent />);
      }).not.toThrow();
      
      // Simulate click
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: document.body });
      document.dispatchEvent(clickEvent);
      
      // Should not crash or call handler
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should update behavior when ref changes', () => {
      const DynamicRefComponent = ({ useFirstRef }) => {
        const ref1 = useRef(null);
        const ref2 = useRef(null);
        const activeRef = useFirstRef ? ref1 : ref2;
        
        useClickOutside(activeRef, mockHandler);
        
        return (
          <div>
            <div ref={ref1} data-testid="target1">Target 1</div>
            <div ref={ref2} data-testid="target2">Target 2</div>
            <div data-testid="outside">Outside</div>
          </div>
        );
      };
      
      const { container, rerender } = render(<DynamicRefComponent useFirstRef={true} />);
      
      const target1 = container.querySelector('[data-testid="target1"]');
      const target2 = container.querySelector('[data-testid="target2"]');
      const outside = container.querySelector('[data-testid="outside"]');
      
      // Test with first ref
      let mousedownEvent = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(mousedownEvent, 'target', { value: outside });
      document.dispatchEvent(mousedownEvent);
      
      let clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: target2 }); // Click on target2 (should trigger)
      document.dispatchEvent(clickEvent);
      
      expect(mockHandler).toHaveBeenCalledTimes(1);
      mockHandler.mockClear();
      
      // Switch to second ref
      rerender(<DynamicRefComponent useFirstRef={false} />);
      
      // Test with second ref
      mousedownEvent = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(mousedownEvent, 'target', { value: outside });
      document.dispatchEvent(mousedownEvent);
      
      clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: target1 }); // Click on target1 (should trigger)
      document.dispatchEvent(clickEvent);
      
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Handler Function', () => {
    it('should handle missing handler gracefully', () => {
      expect(() => {
        render(<TestComponent onClickOutside={null} />);
      }).not.toThrow();
      
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: document.body });
      
      expect(() => {
        document.dispatchEvent(clickEvent);
      }).not.toThrow();
    });

    it('should handle handler that throws an error', () => {
      const throwingHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      
      const { container } = render(<TestComponent onClickOutside={throwingHandler} />);
      
      const outsideButton = container.querySelector('[data-testid="outside-button"]');
      
      // Simulate mousedown outside
      const mousedownEvent = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(mousedownEvent, 'target', { value: outsideButton });
      document.dispatchEvent(mousedownEvent);
      
      // Simulate click outside
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: outsideButton });
      
      expect(() => {
        document.dispatchEvent(clickEvent);
      }).toThrow('Handler error');
      
      expect(throwingHandler).toHaveBeenCalledWith(clickEvent);
    });

    it('should pass the original event to the handler', () => {
      const { container } = render(<TestComponent onClickOutside={mockHandler} />);
      
      const outsideButton = container.querySelector('[data-testid="outside-button"]');
      
      // Simulate mousedown outside
      const mousedownEvent = new MouseEvent('mousedown', { 
        bubbles: true,
        clientX: 100,
        clientY: 200
      });
      Object.defineProperty(mousedownEvent, 'target', { value: outsideButton });
      document.dispatchEvent(mousedownEvent);
      
      // Simulate click outside
      const clickEvent = new MouseEvent('click', { 
        bubbles: true,
        clientX: 100,
        clientY: 200,
        button: 0
      });
      Object.defineProperty(clickEvent, 'target', { value: outsideButton });
      document.dispatchEvent(clickEvent);
      
      expect(mockHandler).toHaveBeenCalledWith(clickEvent);
      expect(mockHandler.mock.calls[0][0]).toHaveProperty('clientX', 100);
      expect(mockHandler.mock.calls[0][0]).toHaveProperty('clientY', 200);
      expect(mockHandler.mock.calls[0][0]).toHaveProperty('button', 0);
    });
  });

  describe('Complex DOM Scenarios', () => {
    it('should work with nested elements', () => {
      const NestedComponent = ({ onClickOutside }) => {
        const ref = useRef(null);
        useClickOutside(ref, onClickOutside);
        
        return (
          <div data-testid="container">
            <div ref={ref} data-testid="target">
              <div data-testid="level1">
                <div data-testid="level2">
                  <button data-testid="deeply-nested">Deeply Nested</button>
                </div>
              </div>
            </div>
            <button data-testid="outside">Outside</button>
          </div>
        );
      };
      
      const { container } = render(<NestedComponent onClickOutside={mockHandler} />);
      
      const deeplyNested = container.querySelector('[data-testid="deeply-nested"]');
      const outside = container.querySelector('[data-testid="outside"]');
      
      // Click deeply nested element (should not trigger)
      let mousedownEvent = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(mousedownEvent, 'target', { value: deeplyNested });
      document.dispatchEvent(mousedownEvent);
      
      let clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: deeplyNested });
      document.dispatchEvent(clickEvent);
      
      expect(mockHandler).not.toHaveBeenCalled();
      
      // Click outside (should trigger)
      mousedownEvent = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(mousedownEvent, 'target', { value: outside });
      document.dispatchEvent(mousedownEvent);
      
      clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: outside });
      document.dispatchEvent(clickEvent);
      
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    it('should work with dynamically added elements', () => {
      const { container } = render(<TestComponent onClickOutside={mockHandler} />);
      
      const target = container.querySelector('[data-testid="target"]');
      
      // Add dynamic element inside target
      const dynamicElement = document.createElement('button');
      dynamicElement.textContent = 'Dynamic';
      dynamicElement.setAttribute('data-testid', 'dynamic');
      target.appendChild(dynamicElement);
      
      // Click dynamic element (should not trigger handler)
      let mousedownEvent = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(mousedownEvent, 'target', { value: dynamicElement });
      document.dispatchEvent(mousedownEvent);
      
      let clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: dynamicElement });
      document.dispatchEvent(clickEvent);
      
      expect(mockHandler).not.toHaveBeenCalled();
      
      // Add dynamic element outside target
      const outsideDynamic = document.createElement('button');
      outsideDynamic.textContent = 'Outside Dynamic';
      container.appendChild(outsideDynamic);
      
      // Click outside dynamic element (should trigger handler)
      mousedownEvent = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(mousedownEvent, 'target', { value: outsideDynamic });
      document.dispatchEvent(mousedownEvent);
      
      clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: outsideDynamic });
      document.dispatchEvent(clickEvent);
      
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance Considerations', () => {
    it('should not create memory leaks with multiple instances', () => {
      const instances = [];
      
      for (let i = 0; i < 10; i++) {
        const handler = vi.fn();
        const { unmount } = render(<TestComponent onClickOutside={handler} />);
        instances.push({ handler, unmount });
      }
      
      // All instances should have registered listeners
      expect(document.addEventListener).toHaveBeenCalledTimes(30); // 10 instances × 3 events
      
      // Unmount all instances
      instances.forEach(({ unmount }) => unmount());
      
      // All instances should have cleaned up listeners
      expect(document.removeEventListener).toHaveBeenCalledTimes(30); // 10 instances × 3 events
    });

    it('should handle rapid mount/unmount cycles', () => {
      const mountAndUnmount = () => {
        const { unmount } = render(<TestComponent onClickOutside={mockHandler} />);
        unmount();
      };
      
      // Rapid mount/unmount 20 times
      for (let i = 0; i < 20; i++) {
        mountAndUnmount();
      }
      
      expect(document.addEventListener).toHaveBeenCalledTimes(60); // 20 instances × 3 events
      expect(document.removeEventListener).toHaveBeenCalledTimes(60); // 20 instances × 3 events
    });
  });

  describe('Edge Cases', () => {
    it('should handle events with no target', () => {
      render(<TestComponent onClickOutside={mockHandler} />);
      
      // Create event without target
      const clickEvent = new MouseEvent('click', { bubbles: true });
      // Don't set target property
      
      expect(() => {
        document.dispatchEvent(clickEvent);
      }).not.toThrow();
      
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should handle SVG elements', () => {
      const SVGComponent = ({ onClickOutside }) => {
        const ref = useRef(null);
        useClickOutside(ref, onClickOutside);
        
        return (
          <div>
            <svg ref={ref} data-testid="svg-target">
              <circle cx="50" cy="50" r="40" data-testid="svg-circle" />
            </svg>
            <button data-testid="outside">Outside</button>
          </div>
        );
      };
      
      const { container } = render(<SVGComponent onClickOutside={mockHandler} />);
      
      const circle = container.querySelector('[data-testid="svg-circle"]');
      const outside = container.querySelector('[data-testid="outside"]');
      
      // Click SVG circle (should not trigger)
      let mousedownEvent = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(mousedownEvent, 'target', { value: circle });
      document.dispatchEvent(mousedownEvent);
      
      let clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: circle });
      document.dispatchEvent(clickEvent);
      
      expect(mockHandler).not.toHaveBeenCalled();
      
      // Click outside (should trigger)
      mousedownEvent = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(mousedownEvent, 'target', { value: outside });
      document.dispatchEvent(mousedownEvent);
      
      clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: outside });
      document.dispatchEvent(clickEvent);
      
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });
  });
});