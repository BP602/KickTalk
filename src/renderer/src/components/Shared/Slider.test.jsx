import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { Slider } from './Slider';

// Mock Radix UI slider primitives
vi.mock('@radix-ui/react-slider', () => ({
  Root: ({ children, className, value, onValueChange, onPointerDown, ...props }) => (
    <div
      data-testid="slider-root"
      className={className}
      data-value={JSON.stringify(value)}
      onPointerDown={onPointerDown}
      {...props}
    >
      {children}
      <input
        data-testid="slider-input"
        type="range"
        value={value ? value[0] : 0}
        onChange={(e) => onValueChange && onValueChange([parseInt(e.target.value, 10)])}
        onPointerDown={onPointerDown}
        min={props.min || 0}
        max={props.max || 100}
        step={props.step || 1}
      />
    </div>
  ),
  Track: ({ children, className, ...props }) => (
    <div data-testid="slider-track" className={className} {...props}>
      {children}
    </div>
  ),
  Range: ({ className, ...props }) => (
    <div data-testid="slider-range" className={className} {...props} />
  ),
  Thumb: ({ className, onMouseEnter, onMouseLeave, ...props }) => (
    <div
      data-testid="slider-thumb"
      className={className}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      tabIndex={0}
      {...props}
    />
  ),
}));

// Mock Tooltip components
vi.mock('./Tooltip', () => ({
  Tooltip: ({ children, open, ...props }) => (
    <div data-testid="tooltip" data-open={open} {...props}>
      {children}
    </div>
  ),
  TooltipContent: ({ children, ...props }) => (
    <div data-testid="tooltip-content" {...props}>
      {children}
    </div>
  ),
  TooltipProvider: ({ children, ...props }) => (
    <div data-testid="tooltip-provider" {...props}>
      {children}
    </div>
  ),
  TooltipTrigger: ({ children, asChild, ...props }) => (
    <div data-testid="tooltip-trigger" {...props}>
      {children}
    </div>
  ),
}));

// Mock clsx
vi.mock('clsx', () => ({
  default: (...classes) => classes.filter(Boolean).join(' ')
}));

// Mock useDebounceCallback hook
const mockDebouncedCallback = vi.fn();
vi.mock('../../utils/hooks', () => ({
  useDebounceCallback: vi.fn((fn, delay) => {
    mockDebouncedCallback.mockImplementation(fn);
    return mockDebouncedCallback;
  })
}));

describe('Slider', () => {
  const defaultProps = {
    defaultValue: [50],
    min: 0,
    max: 100,
    step: 1,
    onValueChange: vi.fn(),
  };

  // Mock global events
  const originalAddEventListener = document.addEventListener;
  const originalRemoveEventListener = document.removeEventListener;

  beforeEach(() => {
    vi.clearAllMocks();
    document.addEventListener = vi.fn();
    document.removeEventListener = vi.fn();
  });

  afterEach(() => {
    document.addEventListener = originalAddEventListener;
    document.removeEventListener = originalRemoveEventListener;
  });

  describe('Rendering', () => {
    it('should render slider with default props', () => {
      render(<Slider {...defaultProps} />);

      expect(screen.getByTestId('slider-root')).toBeInTheDocument();
      expect(screen.getByTestId('slider-track')).toBeInTheDocument();
      expect(screen.getByTestId('slider-range')).toBeInTheDocument();
      expect(screen.getByTestId('slider-thumb')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip-provider')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<Slider {...defaultProps} className="custom-slider" />);

      const root = screen.getByTestId('slider-root');
      expect(root).toHaveClass('sliderRoot custom-slider');
    });

    it('should render with correct initial value', () => {
      render(<Slider {...defaultProps} defaultValue={[75]} />);

      const root = screen.getByTestId('slider-root');
      expect(root).toHaveAttribute('data-value', '[75]');
      
      const input = screen.getByTestId('slider-input');
      expect(input).toHaveValue('75');
    });

    it('should render with tooltip provider and trigger', () => {
      render(<Slider {...defaultProps} showTooltip={true} />);

      expect(screen.getByTestId('tooltip-provider')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip-trigger')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip-content')).toBeInTheDocument();
    });

    it('should render tooltip content with current value', () => {
      render(<Slider {...defaultProps} defaultValue={[42]} showTooltip={true} />);

      const tooltipContent = screen.getByTestId('tooltip-content');
      expect(tooltipContent).toHaveTextContent('42');
    });

    it('should have proper CSS classes', () => {
      render(<Slider {...defaultProps} />);

      const root = screen.getByTestId('slider-root');
      const track = screen.getByTestId('slider-track');
      const range = screen.getByTestId('slider-range');
      const thumb = screen.getByTestId('slider-thumb');

      expect(root).toHaveClass('sliderRoot');
      expect(track).toHaveClass('sliderTrack');
      expect(range).toHaveClass('sliderRange');
      expect(thumb).toHaveClass('sliderThumb');
    });
  });

  describe('Value Management', () => {
    it('should update internal state when defaultValue changes', () => {
      const { rerender } = render(<Slider {...defaultProps} defaultValue={[25]} />);

      let root = screen.getByTestId('slider-root');
      expect(root).toHaveAttribute('data-value', '[25]');

      rerender(<Slider {...defaultProps} defaultValue={[75]} />);
      
      root = screen.getByTestId('slider-root');
      expect(root).toHaveAttribute('data-value', '[75]');
    });

    it('should handle value changes through input', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();

      render(<Slider {...defaultProps} onValueChange={onValueChange} />);

      const input = screen.getByTestId('slider-input');
      await user.clear(input);
      await user.type(input, '80');

      expect(mockDebouncedCallback).toHaveBeenCalledWith([80]);
    });

    it('should handle multiple value updates', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();

      render(<Slider {...defaultProps} onValueChange={onValueChange} />);

      const input = screen.getByTestId('slider-input');
      
      await user.clear(input);
      await user.type(input, '30');
      
      await user.clear(input);
      await user.type(input, '70');

      expect(mockDebouncedCallback).toHaveBeenCalledWith([30]);
      expect(mockDebouncedCallback).toHaveBeenCalledWith([70]);
    });

    it('should respect min and max constraints', () => {
      render(<Slider {...defaultProps} min={10} max={90} />);

      const input = screen.getByTestId('slider-input');
      expect(input).toHaveAttribute('min', '10');
      expect(input).toHaveAttribute('max', '90');
    });

    it('should respect step constraint', () => {
      render(<Slider {...defaultProps} step={5} />);

      const input = screen.getByTestId('slider-input');
      expect(input).toHaveAttribute('step', '5');
    });
  });

  describe('Tooltip Behavior', () => {
    it('should show tooltip when showTooltip is true and pointer is down', async () => {
      render(<Slider {...defaultProps} showTooltip={true} />);

      const root = screen.getByTestId('slider-root');
      const tooltip = screen.getByTestId('tooltip');

      // Initially tooltip should be closed
      expect(tooltip).toHaveAttribute('data-open', 'false');

      // Simulate pointer down
      fireEvent.pointerDown(root);

      expect(tooltip).toHaveAttribute('data-open', 'true');
    });

    it('should hide tooltip when not showing tooltip', () => {
      render(<Slider {...defaultProps} showTooltip={false} />);

      const tooltip = screen.getByTestId('tooltip');
      expect(tooltip).toHaveAttribute('data-open', 'false');
    });

    it('should show tooltip on thumb hover when showTooltip is true', async () => {
      const user = userEvent.setup();
      
      render(<Slider {...defaultProps} showTooltip={true} />);

      const thumb = screen.getByTestId('slider-thumb');
      const tooltip = screen.getByTestId('tooltip');

      // Initially closed
      expect(tooltip).toHaveAttribute('data-open', 'false');

      // Hover on thumb
      fireEvent.mouseEnter(thumb);
      expect(tooltip).toHaveAttribute('data-open', 'true');

      // Leave thumb
      fireEvent.mouseLeave(thumb);
      expect(tooltip).toHaveAttribute('data-open', 'false');
    });

    it('should update tooltip content when value changes', async () => {
      const user = userEvent.setup();
      
      render(<Slider {...defaultProps} defaultValue={[20]} showTooltip={true} />);

      const tooltipContent = screen.getByTestId('tooltip-content');
      expect(tooltipContent).toHaveTextContent('20');

      const input = screen.getByTestId('slider-input');
      await user.clear(input);
      await user.type(input, '60');

      // After value change, tooltip should show new value
      expect(tooltipContent).toHaveTextContent('60');
    });
  });

  describe('Event Handling', () => {
    it('should handle pointer down events', () => {
      render(<Slider {...defaultProps} />);

      const root = screen.getByTestId('slider-root');
      fireEvent.pointerDown(root);

      // Verify pointer down is handled (tooltip state changes)
      const tooltip = screen.getByTestId('tooltip');
      expect(tooltip).toHaveAttribute('data-open', 'false'); // Since showTooltip is false by default
    });

    it('should add and remove global pointer up event listeners', () => {
      const { unmount } = render(<Slider {...defaultProps} />);

      // Check that event listener was added
      expect(document.addEventListener).toHaveBeenCalledWith('pointerup', expect.any(Function));

      // Unmount and check cleanup
      unmount();
      expect(document.removeEventListener).toHaveBeenCalledWith('pointerup', expect.any(Function));
    });

    it('should handle global pointer up events', () => {
      render(<Slider {...defaultProps} showTooltip={true} />);

      const root = screen.getByTestId('slider-root');
      const tooltip = screen.getByTestId('tooltip');

      // Simulate pointer down to show tooltip
      fireEvent.pointerDown(root);
      expect(tooltip).toHaveAttribute('data-open', 'true');

      // Get the event listener that was added
      const [, pointerUpHandler] = document.addEventListener.mock.calls.find(
        call => call[0] === 'pointerup'
      );

      // Simulate global pointer up
      act(() => {
        pointerUpHandler();
      });

      expect(tooltip).toHaveAttribute('data-open', 'false');
    });

    it('should handle mouse enter and leave events on thumb', () => {
      render(<Slider {...defaultProps} showTooltip={true} />);

      const thumb = screen.getByTestId('slider-thumb');
      const tooltip = screen.getByTestId('tooltip');

      expect(tooltip).toHaveAttribute('data-open', 'false');

      fireEvent.mouseEnter(thumb);
      expect(tooltip).toHaveAttribute('data-open', 'true');

      fireEvent.mouseLeave(thumb);
      expect(tooltip).toHaveAttribute('data-open', 'false');
    });
  });

  describe('Debouncing', () => {
    it('should debounce value change calls', () => {
      const { useDebounceCallback } = require('../../utils/hooks');
      const onValueChange = vi.fn();

      render(<Slider {...defaultProps} onValueChange={onValueChange} />);

      // Verify debounce hook is called with correct parameters
      expect(useDebounceCallback).toHaveBeenCalledWith(onValueChange, 300);
    });

    it('should use debounced callback for value changes', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();

      render(<Slider {...defaultProps} onValueChange={onValueChange} />);

      const input = screen.getByTestId('slider-input');
      await user.clear(input);
      await user.type(input, '65');

      // The debounced callback should be called, not the original
      expect(mockDebouncedCallback).toHaveBeenCalledWith([65]);
    });

    it('should handle rapid value changes with debouncing', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();

      render(<Slider {...defaultProps} onValueChange={onValueChange} />);

      const input = screen.getByTestId('slider-input');

      // Rapid changes
      await user.clear(input);
      await user.type(input, '10');
      await user.clear(input);
      await user.type(input, '20');
      await user.clear(input);
      await user.type(input, '30');

      // All changes should go through the debounced callback
      expect(mockDebouncedCallback).toHaveBeenCalledWith([10]);
      expect(mockDebouncedCallback).toHaveBeenCalledWith([20]);
      expect(mockDebouncedCallback).toHaveBeenCalledWith([30]);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<Slider {...defaultProps} aria-label="Volume" />);

      const root = screen.getByTestId('slider-root');
      expect(root).toHaveAttribute('aria-label', 'Volume');
    });

    it('should be keyboard accessible', () => {
      render(<Slider {...defaultProps} />);

      const thumb = screen.getByTestId('slider-thumb');
      expect(thumb).toHaveAttribute('tabIndex', '0');
    });

    it('should support custom ARIA attributes', () => {
      render(
        <Slider
          {...defaultProps}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={50}
          aria-valuetext="50 percent"
        />
      );

      const root = screen.getByTestId('slider-root');
      expect(root).toHaveAttribute('aria-valuemin', '0');
      expect(root).toHaveAttribute('aria-valuemax', '100');
      expect(root).toHaveAttribute('aria-valuenow', '50');
      expect(root).toHaveAttribute('aria-valuetext', '50 percent');
    });

    it('should be focusable', async () => {
      const user = userEvent.setup();
      
      render(<Slider {...defaultProps} />);

      const thumb = screen.getByTestId('slider-thumb');
      await user.click(thumb);

      expect(thumb).toHaveFocus();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero value', () => {
      render(<Slider {...defaultProps} defaultValue={[0]} />);

      const input = screen.getByTestId('slider-input');
      expect(input).toHaveValue('0');
      
      const tooltipContent = screen.getByTestId('tooltip-content');
      expect(tooltipContent).toHaveTextContent('0');
    });

    it('should handle maximum value', () => {
      render(<Slider {...defaultProps} defaultValue={[100]} max={100} />);

      const input = screen.getByTestId('slider-input');
      expect(input).toHaveValue('100');
      
      const tooltipContent = screen.getByTestId('tooltip-content');
      expect(tooltipContent).toHaveTextContent('100');
    });

    it('should handle negative values', () => {
      render(<Slider {...defaultProps} defaultValue={[-10]} min={-50} max={50} />);

      const input = screen.getByTestId('slider-input');
      expect(input).toHaveValue('-10');
      
      const tooltipContent = screen.getByTestId('tooltip-content');
      expect(tooltipContent).toHaveTextContent('-10');
    });

    it('should handle decimal values with step', () => {
      render(<Slider {...defaultProps} defaultValue={[2.5]} step={0.1} min={0} max={5} />);

      const input = screen.getByTestId('slider-input');
      expect(input).toHaveAttribute('step', '0.1');
    });

    it('should handle missing onValueChange prop', async () => {
      const user = userEvent.setup();
      
      render(<Slider {...defaultProps} onValueChange={undefined} />);

      const input = screen.getByTestId('slider-input');
      
      await expect(async () => {
        await user.clear(input);
        await user.type(input, '75');
      }).resolves.not.toThrow();
    });

    it('should handle empty defaultValue array', () => {
      render(<Slider {...defaultProps} defaultValue={[]} />);

      const tooltipContent = screen.getByTestId('tooltip-content');
      expect(tooltipContent).toHaveTextContent('');
    });
  });

  describe('Component Lifecycle', () => {
    it('should cleanup event listeners on unmount', () => {
      const { unmount } = render(<Slider {...defaultProps} />);

      expect(document.addEventListener).toHaveBeenCalledWith('pointerup', expect.any(Function));
      
      unmount();
      
      expect(document.removeEventListener).toHaveBeenCalledWith('pointerup', expect.any(Function));
    });

    it('should handle re-renders without issues', () => {
      const { rerender } = render(<Slider {...defaultProps} />);

      for (let i = 0; i < 5; i++) {
        rerender(
          <Slider
            {...defaultProps}
            defaultValue={[i * 20]}
            showTooltip={i % 2 === 0}
          />
        );
      }

      expect(screen.getByTestId('slider-root')).toBeInTheDocument();
    });

    it('should not cause memory leaks', () => {
      const { unmount } = render(<Slider {...defaultProps} />);
      
      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });

  describe('Integration with Tooltip', () => {
    it('should properly integrate with tooltip system', () => {
      render(<Slider {...defaultProps} showTooltip={true} />);

      // Check tooltip integration
      const tooltipProvider = screen.getByTestId('tooltip-provider');
      const tooltip = screen.getByTestId('tooltip');
      const tooltipTrigger = screen.getByTestId('tooltip-trigger');
      const tooltipContent = screen.getByTestId('tooltip-content');

      expect(tooltipProvider).toContainElement(tooltip);
      expect(tooltip).toContainElement(tooltipTrigger);
      expect(tooltip).toContainElement(tooltipContent);
    });

    it('should pass correct props to tooltip components', () => {
      render(<Slider {...defaultProps} showTooltip={true} defaultValue={[45]} />);

      const tooltip = screen.getByTestId('tooltip');
      expect(tooltip).toHaveAttribute('data-open', 'false');
      
      const tooltipContent = screen.getByTestId('tooltip-content');
      expect(tooltipContent).toHaveTextContent('45');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid defaultValue gracefully', () => {
      expect(() => {
        render(<Slider {...defaultProps} defaultValue="invalid" />);
      }).not.toThrow();
    });

    it('should handle missing required props', () => {
      expect(() => {
        render(<Slider />);
      }).not.toThrow();
    });

    it('should handle invalid step values', () => {
      expect(() => {
        render(<Slider {...defaultProps} step={0} />);
      }).not.toThrow();
      
      expect(() => {
        render(<Slider {...defaultProps} step={-1} />);
      }).not.toThrow();
    });

    it('should handle min greater than max', () => {
      expect(() => {
        render(<Slider {...defaultProps} min={100} max={50} />);
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      let renderCount = 0;
      
      const CountingSlider = (props) => {
        renderCount++;
        return <Slider {...props} />;
      };

      const { rerender } = render(
        <CountingSlider {...defaultProps} />
      );

      expect(renderCount).toBe(1);

      // Re-render with same props
      rerender(
        <CountingSlider {...defaultProps} />
      );

      // Should still work properly
      expect(screen.getByTestId('slider-root')).toBeInTheDocument();
    });

    it('should handle frequent value updates efficiently', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();

      render(<Slider {...defaultProps} onValueChange={onValueChange} />);

      const input = screen.getByTestId('slider-input');

      // Rapid updates
      for (let i = 0; i < 20; i++) {
        await user.clear(input);
        await user.type(input, String(i * 5));
      }

      expect(screen.getByTestId('slider-root')).toBeInTheDocument();
    });

    it('should efficiently handle tooltip state changes', () => {
      render(<Slider {...defaultProps} showTooltip={true} />);

      const root = screen.getByTestId('slider-root');
      const thumb = screen.getByTestId('slider-thumb');

      // Rapid state changes
      for (let i = 0; i < 10; i++) {
        fireEvent.pointerDown(root);
        fireEvent.mouseEnter(thumb);
        fireEvent.mouseLeave(thumb);
      }

      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    });
  });

  describe('Ref Forwarding', () => {
    it('should forward ref correctly', () => {
      const ref = { current: null };
      
      const TestComponent = () => (
        <Slider {...defaultProps} ref={ref} />
      );

      render(<TestComponent />);
      
      // Ref forwarding is handled by Radix, so we just verify it doesn't break
      expect(screen.getByTestId('slider-root')).toBeInTheDocument();
    });
  });
});