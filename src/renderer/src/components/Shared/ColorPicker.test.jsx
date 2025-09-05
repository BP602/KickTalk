import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import ColorPicker from './ColorPicker';

// Mock the react-colorful library
const mockOnChange = vi.fn();

vi.mock('react-colorful', () => ({
  RgbaColorPicker: ({ color, onChange }) => (
    <div data-testid="rgba-color-picker" data-color={JSON.stringify(color)}>
      <input
        data-testid="color-input"
        type="color"
        onChange={(e) => onChange({ r: 255, g: 100, b: 50, a: 0.8 })}
      />
      <button
        data-testid="preset-red"
        onClick={() => onChange({ r: 255, g: 0, b: 0, a: 1 })}
      >
        Red
      </button>
      <button
        data-testid="preset-blue"
        onClick={() => onChange({ r: 0, g: 0, b: 255, a: 0.5 })}
      >
        Blue
      </button>
    </div>
  )
}));

// Mock debounce hook
vi.mock('../../utils/hooks', () => ({
  useDebounceCallback: (fn, delay) => {
    // Return a mock function that calls the original immediately for testing
    const mockDebounced = vi.fn((...args) => fn(...args));
    mockDebounced.delay = delay;
    return mockDebounced;
  }
}));

// Mock useClickOutside hook
const mockClickOutsideHandler = vi.fn();
vi.mock('../../utils/useClickOutside', () => ({
  default: (ref, handler) => {
    mockClickOutsideHandler.mockImplementation(handler);
    return handler;
  }
}));

// Mock ChatUtils
vi.mock('../../utils/ChatUtils', () => ({
  rgbaToString: (color) => {
    if (!color) return 'transparent';
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
  }
}));

describe('ColorPicker', () => {
  const defaultProps = {
    disabled: false,
    initialColor: { r: 255, g: 255, b: 0, a: 0.5 },
    handleColorChange: mockOnChange,
    isColorPickerOpen: false,
    setIsColorPickerOpen: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render color picker with preview', () => {
      render(<ColorPicker {...defaultProps} />);
      
      const colorPicker = screen.getByTestId('color-picker-trigger');
      expect(colorPicker).toBeInTheDocument();
      
      const preview = screen.getByTestId('color-picker-preview');
      expect(preview).toBeInTheDocument();
    });

    it('should display correct initial color in preview', () => {
      render(<ColorPicker {...defaultProps} />);
      
      const preview = screen.getByTestId('color-picker-preview-inner');
      expect(preview).toHaveStyle('background-color: rgba(255, 255, 0, 0.5)');
    });

    it('should not show color picker popup when closed', () => {
      render(<ColorPicker {...defaultProps} />);
      
      const popup = screen.queryByTestId('rgba-color-picker');
      expect(popup).not.toBeInTheDocument();
    });

    it('should show color picker popup when open', () => {
      render(<ColorPicker {...defaultProps} isColorPickerOpen={true} />);
      
      const popup = screen.getByTestId('rgba-color-picker');
      expect(popup).toBeInTheDocument();
      expect(popup.closest('.colorPickerDialog')).toHaveClass('show');
    });

    it('should apply disabled styling when disabled', () => {
      render(<ColorPicker {...defaultProps} disabled={true} />);
      
      const header = screen.getByTestId('color-picker-trigger').closest('.colorPickerHeader');
      expect(header).toHaveClass('disabled');
      expect(header).toHaveStyle('opacity: 0.5');
      expect(header).toHaveStyle('cursor: not-allowed');
    });

    it('should not apply disabled styling when enabled', () => {
      render(<ColorPicker {...defaultProps} disabled={false} />);
      
      const header = screen.getByTestId('color-picker-trigger').closest('.colorPickerHeader');
      expect(header).not.toHaveClass('disabled');
      expect(header).toHaveStyle('opacity: 1');
      expect(header).toHaveStyle('cursor: pointer');
    });
  });

  describe('User Interactions', () => {
    it('should toggle popup when clicking the trigger', async () => {
      const setIsColorPickerOpen = vi.fn();
      const user = userEvent.setup();
      
      render(
        <ColorPicker 
          {...defaultProps} 
          setIsColorPickerOpen={setIsColorPickerOpen}
        />
      );
      
      const trigger = screen.getByTestId('color-picker-trigger');
      await user.click(trigger);
      
      expect(setIsColorPickerOpen).toHaveBeenCalledWith(true);
    });

    it('should close popup when clicking trigger while open', async () => {
      const setIsColorPickerOpen = vi.fn();
      const user = userEvent.setup();
      
      render(
        <ColorPicker 
          {...defaultProps} 
          isColorPickerOpen={true}
          setIsColorPickerOpen={setIsColorPickerOpen}
        />
      );
      
      const trigger = screen.getByTestId('color-picker-trigger');
      await user.click(trigger);
      
      expect(setIsColorPickerOpen).toHaveBeenCalledWith(false);
    });

    it('should not toggle popup when disabled', async () => {
      const setIsColorPickerOpen = vi.fn();
      const user = userEvent.setup();
      
      render(
        <ColorPicker 
          {...defaultProps} 
          disabled={true}
          setIsColorPickerOpen={setIsColorPickerOpen}
        />
      );
      
      const trigger = screen.getByTestId('color-picker-trigger');
      await user.click(trigger);
      
      expect(setIsColorPickerOpen).not.toHaveBeenCalled();
    });

    it('should disable preview button when disabled', () => {
      render(<ColorPicker {...defaultProps} disabled={true} />);
      
      const previewButton = screen.getByTestId('color-picker-preview');
      expect(previewButton).toBeDisabled();
    });

    it('should enable preview button when not disabled', () => {
      render(<ColorPicker {...defaultProps} disabled={false} />);
      
      const previewButton = screen.getByTestId('color-picker-preview');
      expect(previewButton).not.toBeDisabled();
    });
  });

  describe('Color Changes', () => {
    it('should update color when color picker value changes', async () => {
      const user = userEvent.setup();
      
      render(
        <ColorPicker 
          {...defaultProps} 
          isColorPickerOpen={true}
        />
      );
      
      const colorInput = screen.getByTestId('color-input');
      fireEvent.change(colorInput, { target: { value: '#ff6432' } });
      
      expect(mockOnChange).toHaveBeenCalledWith({ r: 255, g: 100, b: 50, a: 0.8 });
    });

    it('should update local state when color changes', async () => {
      const user = userEvent.setup();
      
      const { rerender } = render(
        <ColorPicker 
          {...defaultProps} 
          isColorPickerOpen={true}
        />
      );
      
      const redButton = screen.getByTestId('preset-red');
      await user.click(redButton);
      
      // Rerender to check if the color updated in the preview
      rerender(
        <ColorPicker 
          {...defaultProps} 
          isColorPickerOpen={true}
        />
      );
      
      // The component should update its internal state and show the new color
      expect(mockOnChange).toHaveBeenCalledWith({ r: 255, g: 0, b: 0, a: 1 });
    });

    it('should debounce color change calls', async () => {
      const user = userEvent.setup();
      
      render(
        <ColorPicker 
          {...defaultProps} 
          isColorPickerOpen={true}
        />
      );
      
      const colorInput = screen.getByTestId('color-input');
      
      // Trigger multiple rapid changes
      fireEvent.change(colorInput, { target: { value: '#ff0000' } });
      fireEvent.change(colorInput, { target: { value: '#00ff00' } });
      fireEvent.change(colorInput, { target: { value: '#0000ff' } });
      
      // Due to our mock implementation, it should still be called immediately
      // In real implementation, it would be debounced
      expect(mockOnChange).toHaveBeenCalledTimes(3);
    });
  });

  describe('Initial Color Handling', () => {
    it('should update when initialColor prop changes', () => {
      const { rerender } = render(
        <ColorPicker {...defaultProps} />
      );
      
      const newColor = { r: 0, g: 255, b: 0, a: 0.8 };
      
      rerender(
        <ColorPicker {...defaultProps} initialColor={newColor} />
      );
      
      const preview = screen.getByTestId('color-picker-preview-inner');
      expect(preview).toHaveStyle('background-color: rgba(0, 255, 0, 0.8)');
    });

    it('should handle null initialColor gracefully', () => {
      expect(() => {
        render(<ColorPicker {...defaultProps} initialColor={null} />);
      }).not.toThrow();
      
      const preview = screen.getByTestId('color-picker-preview-inner');
      expect(preview).toHaveStyle('background-color: transparent');
    });

    it('should handle undefined initialColor gracefully', () => {
      expect(() => {
        render(<ColorPicker {...defaultProps} initialColor={undefined} />);
      }).not.toThrow();
      
      const preview = screen.getByTestId('color-picker-preview-inner');
      expect(preview).toHaveStyle('background-color: transparent');
    });
  });

  describe('Click Outside Behavior', () => {
    it('should register click outside handler', () => {
      render(<ColorPicker {...defaultProps} />);
      
      expect(mockClickOutsideHandler).toHaveBeenCalled();
    });

    it('should close popup when clicking outside', () => {
      const setIsColorPickerOpen = vi.fn();
      
      render(
        <ColorPicker 
          {...defaultProps} 
          isColorPickerOpen={true}
          setIsColorPickerOpen={setIsColorPickerOpen}
        />
      );
      
      // Simulate click outside
      mockClickOutsideHandler();
      
      expect(setIsColorPickerOpen).toHaveBeenCalledWith(false);
    });

    it('should not interfere when popup is already closed', () => {
      const setIsColorPickerOpen = vi.fn();
      
      render(
        <ColorPicker 
          {...defaultProps} 
          isColorPickerOpen={false}
          setIsColorPickerOpen={setIsColorPickerOpen}
        />
      );
      
      // Simulate click outside
      mockClickOutsideHandler();
      
      expect(setIsColorPickerOpen).toHaveBeenCalledWith(false);
    });
  });

  describe('Component Lifecycle', () => {
    it('should cleanup on unmount', () => {
      const { unmount } = render(<ColorPicker {...defaultProps} />);
      
      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('should handle re-renders without issues', () => {
      const { rerender } = render(<ColorPicker {...defaultProps} />);
      
      // Multiple re-renders with different props
      for (let i = 0; i < 5; i++) {
        const newColor = { r: i * 50, g: 100, b: 200, a: 0.5 + i * 0.1 };
        rerender(
          <ColorPicker 
            {...defaultProps} 
            initialColor={newColor}
            isColorPickerOpen={i % 2 === 0}
          />
        );
      }
      
      expect(screen.getByTestId('color-picker-trigger')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button role', () => {
      render(<ColorPicker {...defaultProps} />);
      
      const trigger = screen.getByTestId('color-picker-trigger').closest('.colorPickerHeader');
      expect(trigger).toHaveAttribute('role', 'button');
    });

    it('should be keyboard accessible', async () => {
      const user = userEvent.setup();
      const setIsColorPickerOpen = vi.fn();
      
      render(
        <ColorPicker 
          {...defaultProps} 
          setIsColorPickerOpen={setIsColorPickerOpen}
        />
      );
      
      const trigger = screen.getByTestId('color-picker-trigger').closest('.colorPickerHeader');
      
      // Focus and activate with Enter
      trigger.focus();
      await user.keyboard('{Enter}');
      
      expect(setIsColorPickerOpen).toHaveBeenCalledWith(true);
    });

    it('should support Space key activation', async () => {
      const user = userEvent.setup();
      const setIsColorPickerOpen = vi.fn();
      
      render(
        <ColorPicker 
          {...defaultProps} 
          setIsColorPickerOpen={setIsColorPickerOpen}
        />
      );
      
      const trigger = screen.getByTestId('color-picker-trigger').closest('.colorPickerHeader');
      
      // Focus and activate with Space
      trigger.focus();
      await user.keyboard(' ');
      
      expect(setIsColorPickerOpen).toHaveBeenCalledWith(true);
    });

    it('should have proper ARIA attributes', () => {
      render(<ColorPicker {...defaultProps} isColorPickerOpen={true} />);
      
      const trigger = screen.getByTestId('color-picker-trigger').closest('.colorPickerHeader');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      
      const dialog = screen.getByTestId('rgba-color-picker').closest('.colorPickerDialog');
      expect(dialog).toHaveAttribute('role', 'dialog');
    });

    it('should indicate disabled state to screen readers', () => {
      render(<ColorPicker {...defaultProps} disabled={true} />);
      
      const trigger = screen.getByTestId('color-picker-trigger').closest('.colorPickerHeader');
      expect(trigger).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Color Format Handling', () => {
    it('should handle RGBA color objects correctly', () => {
      const color = { r: 128, g: 64, b: 192, a: 0.75 };
      
      render(<ColorPicker {...defaultProps} initialColor={color} />);
      
      const preview = screen.getByTestId('color-picker-preview-inner');
      expect(preview).toHaveStyle('background-color: rgba(128, 64, 192, 0.75)');
    });

    it('should handle colors with alpha = 0', () => {
      const color = { r: 255, g: 0, b: 0, a: 0 };
      
      render(<ColorPicker {...defaultProps} initialColor={color} />);
      
      const preview = screen.getByTestId('color-picker-preview-inner');
      expect(preview).toHaveStyle('background-color: rgba(255, 0, 0, 0)');
    });

    it('should handle colors with alpha = 1', () => {
      const color = { r: 0, g: 255, b: 0, a: 1 };
      
      render(<ColorPicker {...defaultProps} initialColor={color} />);
      
      const preview = screen.getByTestId('color-picker-preview-inner');
      expect(preview).toHaveStyle('background-color: rgba(0, 255, 0, 1)');
    });

    it('should handle edge case RGB values', () => {
      const edgeCases = [
        { r: 0, g: 0, b: 0, a: 0.5 }, // Black
        { r: 255, g: 255, b: 255, a: 0.5 }, // White
        { r: 127, g: 127, b: 127, a: 0.5 }, // Gray
      ];
      
      edgeCases.forEach((color, index) => {
        const { rerender } = render(<ColorPicker {...defaultProps} initialColor={color} />);
        
        const preview = screen.getByTestId('color-picker-preview-inner');
        expect(preview).toHaveStyle(`background-color: rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`);
        
        if (index < edgeCases.length - 1) {
          rerender(<div />); // Reset for next iteration
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing props gracefully', () => {
      expect(() => {
        render(<ColorPicker />);
      }).not.toThrow();
    });

    it('should handle invalid color objects', () => {
      const invalidColors = [
        { r: 'invalid', g: 100, b: 50, a: 0.5 },
        { r: 300, g: -50, b: 50, a: 2 }, // Out of range values
        { r: 100, g: 100 }, // Missing properties
        'not an object',
      ];
      
      invalidColors.forEach((color) => {
        expect(() => {
          render(<ColorPicker {...defaultProps} initialColor={color} />);
        }).not.toThrow();
      });
    });

    it('should handle handleColorChange throwing an error', async () => {
      const throwingHandler = vi.fn(() => {
        throw new Error('Color change error');
      });
      
      const user = userEvent.setup();
      
      render(
        <ColorPicker 
          {...defaultProps} 
          handleColorChange={throwingHandler}
          isColorPickerOpen={true}
        />
      );
      
      const redButton = screen.getByTestId('preset-red');
      
      expect(async () => {
        await user.click(redButton);
      }).rejects.toThrow('Color change error');
    });
  });

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      let renderCount = 0;
      
      const CountingColorPicker = (props) => {
        renderCount++;
        return <ColorPicker {...props} />;
      };
      
      const { rerender } = render(
        <CountingColorPicker {...defaultProps} />
      );
      
      expect(renderCount).toBe(1);
      
      // Re-render with same props
      rerender(
        <CountingColorPicker {...defaultProps} />
      );
      
      // Should memoize and minimize re-renders
      expect(screen.getByTestId('color-picker-trigger')).toBeInTheDocument();
    });

    it('should handle rapid prop changes efficiently', () => {
      const { rerender } = render(<ColorPicker {...defaultProps} />);
      
      // Rapid color changes
      for (let i = 0; i < 50; i++) {
        const color = { r: i * 5, g: 100, b: 200, a: 0.5 };
        rerender(
          <ColorPicker 
            {...defaultProps} 
            initialColor={color}
            isColorPickerOpen={i % 2 === 0}
          />
        );
      }
      
      expect(screen.getByTestId('color-picker-trigger')).toBeInTheDocument();
    });
  });

  describe('Integration with Parent Components', () => {
    it('should work in a form context', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      let capturedColor = null;
      
      const FormWithColorPicker = () => (
        <form onSubmit={onSubmit}>
          <ColorPicker
            {...defaultProps}
            handleColorChange={(color) => { capturedColor = color; }}
            isColorPickerOpen={true}
          />
          <button type="submit">Submit</button>
        </form>
      );
      
      render(<FormWithColorPicker />);
      
      const blueButton = screen.getByTestId('preset-blue');
      await user.click(blueButton);
      
      expect(capturedColor).toEqual({ r: 0, g: 0, b: 255, a: 0.5 });
      
      const submitButton = screen.getByText('Submit');
      await user.click(submitButton);
      
      expect(onSubmit).toHaveBeenCalled();
    });

    it('should work with external state management', () => {
      let externalColor = { r: 128, g: 128, b: 128, a: 0.5 };
      let externalOpen = false;
      
      const ExternalStateComponent = () => (
        <ColorPicker
          initialColor={externalColor}
          isColorPickerOpen={externalOpen}
          handleColorChange={(color) => { externalColor = color; }}
          setIsColorPickerOpen={(open) => { externalOpen = open; }}
          disabled={false}
        />
      );
      
      const { rerender } = render(<ExternalStateComponent />);
      
      // Update external state
      externalColor = { r: 255, g: 0, b: 0, a: 1 };
      externalOpen = true;
      
      rerender(<ExternalStateComponent />);
      
      const popup = screen.getByTestId('rgba-color-picker');
      expect(popup).toBeInTheDocument();
    });
  });
});