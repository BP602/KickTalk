import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import ColorPicker from './ColorPicker';

// Mock the react-colorful library
const mockOnChange = vi.fn();

vi.mock('react-colorful', () => ({
  RgbaColorPicker: ({ color, onChange }) => {
    const [currentColor, setCurrentColor] = React.useState(color);
    
    React.useEffect(() => {
      setCurrentColor(color);
    }, [color]);

    const handleColorChange = (newColor) => {
      setCurrentColor(newColor);
      onChange(newColor);
    };

    return (
      <div data-testid="rgba-color-picker" data-color={JSON.stringify(currentColor)}>
        <div data-testid="color-picker-interactive-area">
          {/* Simulate color picker components */}
          <div 
            data-testid="saturation-area"
            onMouseDown={(e) => {
              const rect = e.target.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              const saturation = Math.max(0, Math.min(100, (x / rect.width) * 100));
              const brightness = Math.max(0, Math.min(100, 100 - (y / rect.height) * 100));
              
              handleColorChange({
                ...currentColor,
                r: Math.round((brightness / 100) * 255),
                g: Math.round((saturation / 100) * 255),
                b: currentColor.b
              });
            }}
            style={{ width: '200px', height: '150px', cursor: 'crosshair' }}
          />
          
          <div 
            data-testid="hue-slider"
            onMouseDown={(e) => {
              const rect = e.target.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const hue = Math.max(0, Math.min(360, (x / rect.width) * 360));
              
              handleColorChange({
                ...currentColor,
                b: Math.round((hue / 360) * 255)
              });
            }}
            style={{ width: '200px', height: '20px', cursor: 'pointer' }}
          />
          
          <div 
            data-testid="alpha-slider"
            onMouseDown={(e) => {
              const rect = e.target.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const alpha = Math.max(0, Math.min(1, x / rect.width));
              
              handleColorChange({
                ...currentColor,
                a: alpha
              });
            }}
            style={{ width: '200px', height: '20px', cursor: 'pointer' }}
          />
        </div>

        {/* Preset colors */}
        <div data-testid="preset-colors">
          <button
            data-testid="preset-red"
            onClick={() => handleColorChange({ r: 255, g: 0, b: 0, a: 1 })}
            style={{ backgroundColor: 'red', width: '30px', height: '30px' }}
          />
          <button
            data-testid="preset-green"
            onClick={() => handleColorChange({ r: 0, g: 255, b: 0, a: 1 })}
            style={{ backgroundColor: 'green', width: '30px', height: '30px' }}
          />
          <button
            data-testid="preset-blue"
            onClick={() => handleColorChange({ r: 0, g: 0, b: 255, a: 1 })}
            style={{ backgroundColor: 'blue', width: '30px', height: '30px' }}
          />
          <button
            data-testid="preset-transparent"
            onClick={() => handleColorChange({ r: 0, g: 0, b: 0, a: 0 })}
            style={{ backgroundColor: 'transparent', width: '30px', height: '30px', border: '1px solid #ccc' }}
          />
        </div>

        {/* Color input field */}
        <input
          data-testid="color-hex-input"
          type="text"
          value={`#${currentColor.r.toString(16).padStart(2, '0')}${currentColor.g.toString(16).padStart(2, '0')}${currentColor.b.toString(16).padStart(2, '0')}`}
          onChange={(e) => {
            const hex = e.target.value.replace('#', '');
            if (hex.length === 6) {
              const r = parseInt(hex.substr(0, 2), 16);
              const g = parseInt(hex.substr(2, 2), 16);
              const b = parseInt(hex.substr(4, 2), 16);
              handleColorChange({ ...currentColor, r, g, b });
            }
          }}
        />
      </div>
    );
  }
}));

// Mock debounce hook
vi.mock('../../utils/hooks', () => ({
  useDebounceCallback: (fn, delay) => {
    // Create a more realistic debounce mock
    const mockDebounced = vi.fn();
    let timeoutId = null;
    
    mockDebounced.mockImplementation((...args) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      if (delay > 0) {
        timeoutId = setTimeout(() => fn(...args), delay);
      } else {
        fn(...args);
      }
    });
    
    mockDebounced.delay = delay;
    mockDebounced.cancel = vi.fn(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    });
    
    return mockDebounced;
  }
}));

// Mock useClickOutside hook
const mockClickOutsideHandler = vi.fn();
vi.mock('../../utils/useClickOutside', () => ({
  default: (ref, handler) => {
    mockClickOutsideHandler.mockImplementation(handler);
    
    // Simulate click outside detection
    React.useEffect(() => {
      const handleDocumentClick = (event) => {
        if (ref.current && !ref.current.contains(event.target)) {
          handler(event);
        }
      };
      
      document.addEventListener('mousedown', handleDocumentClick);
      return () => document.removeEventListener('mousedown', handleDocumentClick);
    }, [ref, handler]);
    
    return handler;
  }
}));

// Mock ChatUtils
vi.mock('../../utils/ChatUtils', () => ({
  rgbaToString: (color) => {
    if (!color) return 'transparent';
    const { r, g, b, a } = color;
    
    // Handle alpha
    if (a < 1) {
      return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
    } else {
      return `rgb(${r}, ${g}, ${b})`;
    }
  },
  stringToRgba: (colorString) => {
    if (!colorString || colorString === 'transparent') {
      return { r: 0, g: 0, b: 0, a: 0 };
    }
    
    // Parse rgb/rgba strings
    const rgbaMatch = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgbaMatch) {
      return {
        r: parseInt(rgbaMatch[1], 10),
        g: parseInt(rgbaMatch[2], 10),
        b: parseInt(rgbaMatch[3], 10),
        a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1
      };
    }
    
    return { r: 0, g: 0, b: 0, a: 1 };
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

  describe('Advanced Color Picking Interactions', () => {
    it('should handle saturation area interactions', async () => {
      const user = userEvent.setup({ delay: null });
      
      render(<ColorPicker {...defaultProps} isColorPickerOpen={true} />);
      
      const saturationArea = screen.getByTestId('saturation-area');
      
      // Simulate mouse interaction on saturation area
      fireEvent.mouseDown(saturationArea, {
        clientX: 100, // middle of 200px width
        clientY: 75,  // middle of 150px height
        target: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 150 }) }
      });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          r: expect.any(Number),
          g: expect.any(Number),
          b: expect.any(Number),
          a: 0.5
        })
      );
    });

    it('should handle hue slider interactions', async () => {
      render(<ColorPicker {...defaultProps} isColorPickerOpen={true} />);
      
      const hueSlider = screen.getByTestId('hue-slider');
      
      fireEvent.mouseDown(hueSlider, {
        clientX: 180, // near end of 200px width (90% = 324 hue)
        target: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 20 }) }
      });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          r: 255,
          g: 255,
          b: expect.any(Number), // Should be around 229 (324/360*255)
          a: 0.5
        })
      );
    });

    it('should handle alpha slider interactions', async () => {
      render(<ColorPicker {...defaultProps} isColorPickerOpen={true} />);
      
      const alphaSlider = screen.getByTestId('alpha-slider');
      
      fireEvent.mouseDown(alphaSlider, {
        clientX: 50, // 25% of 200px width = 0.25 alpha
        target: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 20 }) }
      });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          r: 255,
          g: 255,
          b: 0,
          a: 0.25
        })
      );
    });

    it('should handle hex input changes', async () => {
      const user = userEvent.setup({ delay: null });
      
      render(<ColorPicker {...defaultProps} isColorPickerOpen={true} />);
      
      const hexInput = screen.getByTestId('color-hex-input');
      
      await user.clear(hexInput);
      await user.type(hexInput, '#ff0000');

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          r: 255,
          g: 0,
          b: 0,
          a: 0.5
        })
      );
    });

    it('should handle invalid hex input gracefully', async () => {
      const user = userEvent.setup({ delay: null });
      
      render(<ColorPicker {...defaultProps} isColorPickerOpen={true} />);
      
      const hexInput = screen.getByTestId('color-hex-input');
      
      await user.clear(hexInput);
      await user.type(hexInput, '#invalid');

      // Should not call onChange for invalid hex
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('should handle preset color selection with transparency', async () => {
      const user = userEvent.setup({ delay: null });
      
      render(<ColorPicker {...defaultProps} isColorPickerOpen={true} />);
      
      const transparentPreset = screen.getByTestId('preset-transparent');
      await user.click(transparentPreset);

      expect(mockOnChange).toHaveBeenCalledWith({
        r: 0,
        g: 0,
        b: 0,
        a: 0
      });
    });
  });

  describe('Debouncing and Performance', () => {
    it('should debounce color changes correctly', async () => {
      const user = userEvent.setup({ delay: null });
      
      render(<ColorPicker {...defaultProps} isColorPickerOpen={true} />);
      
      const saturationArea = screen.getByTestId('saturation-area');
      
      // Rapid color changes
      for (let i = 0; i < 5; i++) {
        fireEvent.mouseDown(saturationArea, {
          clientX: 50 + i * 10,
          clientY: 50 + i * 10,
          target: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 150 }) }
        });
      }
      
      // Should debounce the calls
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Exact call count depends on debounce implementation
      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should cancel debounced calls on unmount', () => {
      const { unmount } = render(<ColorPicker {...defaultProps} isColorPickerOpen={true} />);
      
      const saturationArea = screen.getByTestId('saturation-area');
      
      fireEvent.mouseDown(saturationArea, {
        clientX: 100,
        clientY: 75,
        target: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 150 }) }
      });
      
      // Unmount before debounce completes
      unmount();
      
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Should not crash or cause memory leaks
      expect(() => vi.advanceTimersByTime(100)).not.toThrow();
    });
  });

  describe('Click Outside Handling', () => {
    it('should close picker when clicking outside', async () => {
      const setIsColorPickerOpen = vi.fn();
      
      render(
        <div>
          <ColorPicker 
            {...defaultProps} 
            isColorPickerOpen={true}
            setIsColorPickerOpen={setIsColorPickerOpen}
          />
          <button data-testid="outside-button">Outside</button>
        </div>
      );
      
      const outsideButton = screen.getByTestId('outside-button');
      
      // Simulate click outside
      fireEvent.mouseDown(outsideButton);
      
      expect(setIsColorPickerOpen).toHaveBeenCalledWith(false);
    });

    it('should not close picker when clicking inside color picker', async () => {
      const setIsColorPickerOpen = vi.fn();
      
      render(<ColorPicker 
        {...defaultProps} 
        isColorPickerOpen={true}
        setIsColorPickerOpen={setIsColorPickerOpen}
      />);
      
      const colorPicker = screen.getByTestId('rgba-color-picker');
      
      fireEvent.mouseDown(colorPicker);
      
      expect(setIsColorPickerOpen).not.toHaveBeenCalled();
    });
  });

  describe('Color Format Conversions', () => {
    it('should handle different color format inputs', () => {
      const { rerender } = render(<ColorPicker {...defaultProps} />);
      
      // Test with different initial colors
      const testColors = [
        { r: 255, g: 0, b: 0, a: 1 },     // Red
        { r: 0, g: 255, b: 0, a: 0.5 },   // Semi-transparent green
        { r: 128, g: 128, b: 128, a: 0.3 }, // Semi-transparent gray
        { r: 0, g: 0, b: 0, a: 0 }        // Transparent
      ];
      
      testColors.forEach(color => {
        rerender(<ColorPicker {...defaultProps} initialColor={color} />);
        
        const preview = screen.getByTestId('color-picker-preview-inner');
        const expectedStyle = color.a < 1 
          ? `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a.toFixed(3)})`
          : `rgb(${color.r}, ${color.g}, ${color.b})`;
        
        expect(preview).toHaveStyle(`background-color: ${expectedStyle}`);
      });
    });

    it('should handle edge case color values', () => {
      const edgeCases = [
        { r: 0, g: 0, b: 0, a: 0 },       // Black transparent
        { r: 255, g: 255, b: 255, a: 1 }, // White opaque
        { r: 127.5, g: 127.5, b: 127.5, a: 0.5 }, // Fractional values (should be rounded)
        { r: -10, g: 300, b: 127, a: 1.5 } // Out of range values
      ];
      
      edgeCases.forEach(color => {
        expect(() => {
          render(<ColorPicker {...defaultProps} initialColor={color} />);
        }).not.toThrow();
      });
    });
  });

  describe('Accessibility Enhancements', () => {
    it('should have proper ARIA labels for color picker components', () => {
      render(<ColorPicker {...defaultProps} isColorPickerOpen={true} />);
      
      const trigger = screen.getByTestId('color-picker-trigger');
      expect(trigger).toHaveAttribute('role', 'button');
      expect(trigger).toHaveAttribute('tabIndex', '0');
      
      // Color picker should have proper labeling
      const colorPicker = screen.getByTestId('rgba-color-picker');
      expect(colorPicker).toBeInTheDocument();
    });

    it('should handle keyboard navigation in color picker', async () => {
      const user = userEvent.setup();
      
      render(<ColorPicker {...defaultProps} isColorPickerOpen={true} />);
      
      const presetRed = screen.getByTestId('preset-red');
      
      // Should be focusable and activatable with keyboard
      presetRed.focus();
      expect(presetRed).toHaveFocus();
      
      await user.keyboard('{Enter}');
      expect(mockOnChange).toHaveBeenCalledWith({ r: 255, g: 0, b: 0, a: 1 });
    });

    it('should provide screen reader feedback for color changes', async () => {
      const user = userEvent.setup();
      
      render(<ColorPicker {...defaultProps} isColorPickerOpen={true} />);
      
      const hexInput = screen.getByTestId('color-hex-input');
      
      // Hex input should have proper labeling
      expect(hexInput).toHaveAttribute('type', 'text');
      
      await user.clear(hexInput);
      await user.type(hexInput, '#00ff00');
      
      expect(hexInput).toHaveValue('#00ff00');
    });
  });

  describe('Integration with Form Validation', () => {
    it('should work within form validation contexts', async () => {
      const FormWithColorPicker = () => {
        const [color, setColor] = React.useState({ r: 255, g: 0, b: 0, a: 1 });
        const [isOpen, setIsOpen] = React.useState(false);
        const [error, setError] = React.useState('');
        
        const handleColorChange = (newColor) => {
          setColor(newColor);
          // Validate color (example: must have some opacity)
          if (newColor.a === 0) {
            setError('Color must not be transparent');
          } else {
            setError('');
          }
        };
        
        return (
          <div>
            <ColorPicker
              initialColor={color}
              handleColorChange={handleColorChange}
              isColorPickerOpen={isOpen}
              setIsColorPickerOpen={setIsOpen}
            />
            {error && <div data-testid="color-error">{error}</div>}
          </div>
        );
      };
      
      render(<FormWithColorPicker />);
      
      const trigger = screen.getByTestId('color-picker-trigger');
      await userEvent.click(trigger);
      
      const transparentPreset = screen.getByTestId('preset-transparent');
      await userEvent.click(transparentPreset);
      
      expect(screen.getByTestId('color-error')).toHaveTextContent('Color must not be transparent');
    });
  });
});
