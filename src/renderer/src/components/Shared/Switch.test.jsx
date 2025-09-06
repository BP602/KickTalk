import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Switch } from './Switch.jsx'

// Mock clsx to avoid potential issues with the class name utility
vi.mock('clsx', () => ({
  default: (...args) => args.filter(Boolean).join(' ')
}))

describe('Switch Component', () => {
  it('should render without crashing', () => {
    render(<Switch />)
    
    // Switch should be rendered as a button with role="switch"
    const switchElement = screen.getByRole('switch')
    expect(switchElement).toBeInTheDocument()
  })

  it('should have correct default attributes', () => {
    render(<Switch />)
    
    const switchElement = screen.getByRole('switch')
    expect(switchElement).toHaveAttribute('type', 'button')
    expect(switchElement).toHaveAttribute('role', 'switch')
    expect(switchElement).toHaveAttribute('data-state', 'unchecked')
  })

  it('should apply default CSS classes', () => {
    render(<Switch />)
    
    const switchElement = screen.getByRole('switch')
    expect(switchElement).toHaveClass('switch')
    
    // Check for thumb element
    const thumbElement = switchElement.querySelector('[data-state="unchecked"]')
    expect(thumbElement).toBeInTheDocument()
    expect(thumbElement).toHaveClass('switchThumb')
  })

  it('should apply custom className', () => {
    const customClass = 'custom-switch'
    render(<Switch className={customClass} />)
    
    const switchElement = screen.getByRole('switch')
    expect(switchElement).toHaveClass('switch', customClass)
    
    const thumbElement = switchElement.querySelector('[data-state="unchecked"]')
    expect(thumbElement).toHaveClass('switchThumb', customClass)
  })

  it('should handle checked state', () => {
    render(<Switch defaultChecked />)
    
    const switchElement = screen.getByRole('switch')
    expect(switchElement).toHaveAttribute('data-state', 'checked')
    expect(switchElement).toHaveAttribute('aria-checked', 'true')
    
    const thumbElement = switchElement.querySelector('[data-state="checked"]')
    expect(thumbElement).toBeInTheDocument()
  })

  it('should handle disabled state', () => {
    render(<Switch disabled />)
    
    const switchElement = screen.getByRole('switch')
    expect(switchElement).toBeDisabled()
    expect(switchElement).toHaveAttribute('data-disabled', '')
  })

  it('should call onCheckedChange when clicked', async () => {
    vi.useRealTimers() // Use real timers for user interactions
    const user = userEvent.setup()
    const handleCheckedChange = vi.fn()
    
    render(<Switch onCheckedChange={handleCheckedChange} />)
    
    const switchElement = screen.getByRole('switch')
    
    await user.click(switchElement)
    
    expect(handleCheckedChange).toHaveBeenCalledOnce()
    expect(handleCheckedChange).toHaveBeenCalledWith(true)
  })

  it('should toggle states correctly', async () => {
    vi.useRealTimers() // Use real timers for user interactions
    const user = userEvent.setup()
    const handleCheckedChange = vi.fn()
    
    const { rerender } = render(<Switch onCheckedChange={handleCheckedChange} />)
    
    const switchElement = screen.getByRole('switch')
    
    // First click - should become checked
    await user.click(switchElement)
    expect(handleCheckedChange).toHaveBeenCalledWith(true)
    
    // Reset mock and rerender in checked state
    handleCheckedChange.mockClear()
    rerender(<Switch defaultChecked onCheckedChange={handleCheckedChange} />)
    
    const checkedSwitch = screen.getByRole('switch')
    await user.click(checkedSwitch)
    expect(handleCheckedChange).toHaveBeenCalledWith(false)
  })

  it('should not call onCheckedChange when disabled', async () => {
    vi.useRealTimers() // Use real timers for user interactions
    const user = userEvent.setup()
    const handleCheckedChange = vi.fn()
    
    render(<Switch disabled onCheckedChange={handleCheckedChange} />)
    
    const switchElement = screen.getByRole('switch')
    
    await user.click(switchElement)
    
    expect(handleCheckedChange).not.toHaveBeenCalled()
  })

  it('should handle keyboard interactions', async () => {
    vi.useRealTimers() // Use real timers for user interactions
    const user = userEvent.setup()
    const handleCheckedChange = vi.fn()
    
    render(<Switch onCheckedChange={handleCheckedChange} />)
    
    const switchElement = screen.getByRole('switch')
    switchElement.focus()
    
    // Press Space key
    await user.keyboard(' ')
    expect(handleCheckedChange).toHaveBeenCalledWith(true)
    
    handleCheckedChange.mockClear()
    
    // Press Enter key - this should toggle to false since we're now checked
    await user.keyboard('{Enter}')
    expect(handleCheckedChange).toHaveBeenCalledWith(false)
  })

  it('should forward ref correctly', () => {
    const ref = vi.fn()
    
    render(<Switch ref={ref} />)
    
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement))
  })

  it('should pass through additional props', () => {
    const testId = 'test-switch'
    render(<Switch data-testid={testId} aria-label="Test switch" />)
    
    const switchElement = screen.getByTestId(testId)
    expect(switchElement).toHaveAttribute('aria-label', 'Test switch')
  })

  it('should have correct accessibility attributes', () => {
    render(<Switch aria-describedby="help-text" />)
    
    const switchElement = screen.getByRole('switch')
    expect(switchElement).toHaveAttribute('aria-describedby', 'help-text')
    expect(switchElement).toHaveAttribute('aria-checked', 'false')
  })

  it('should render with different sizes when className indicates size', () => {
    render(<Switch className="switch-large" />)
    
    const switchElement = screen.getByRole('switch')
    expect(switchElement).toHaveClass('switch', 'switch-large')
  })

  describe('Accessibility', () => {
    it('should provide proper ARIA attributes for Switch', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      
      render(
        <div>
          <Switch 
            checked={false} 
            onCheckedChange={handleChange}
            aria-label="Enable dark mode"
            aria-describedby="switch-description"
          />
          <div id="switch-description">
            Toggles between light and dark theme
          </div>
        </div>
      );

      const switchElement = screen.getByRole('switch');
      
      expect(switchElement).toHaveAttribute('role', 'switch');
      expect(switchElement).toHaveAttribute('aria-checked', 'false');
      expect(switchElement).toHaveAttribute('aria-label', 'Enable dark mode');
      expect(switchElement).toHaveAttribute('aria-describedby', 'switch-description');
      
      await user.click(switchElement);
      expect(handleChange).toHaveBeenCalledWith(true);
    });
  });
})
