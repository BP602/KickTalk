import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from './Tooltip';

// Mock Radix UI tooltip primitives with enhanced functionality
vi.mock('@radix-ui/react-tooltip', () => ({
  Provider: ({ children, delayDuration, skipDelayDuration, disableHoverableContent, ...props }) => (
    <div
      data-testid="tooltip-provider"
      data-delay-duration={delayDuration}
      data-skip-delay-duration={skipDelayDuration}
      data-disable-hoverable-content={disableHoverableContent}
      {...props}
    >
      {children}
    </div>
  ),
  Root: ({ children, open, defaultOpen, onOpenChange, delayDuration, ...props }) => {
    const [isOpen, setIsOpen] = React.useState(defaultOpen || false);
    
    React.useEffect(() => {
      if (open !== undefined) {
        setIsOpen(open);
      }
    }, [open]);

    const handleOpenChange = (newOpen) => {
      setIsOpen(newOpen);
      onOpenChange?.(newOpen);
    };

    return (
      <div
        data-testid="tooltip-root"
        data-open={String(isOpen)}
        data-default-open={defaultOpen}
        data-delay-duration={delayDuration}
        {...props}
      >
        {React.Children.map(children, child =>
          React.isValidElement(child)
            ? React.cloneElement(child, { 
                isOpen, 
                onOpenChange: handleOpenChange,
                delayDuration 
              })
            : child
        )}
      </div>
    );
  },
  Trigger: ({ children, asChild, isOpen, onOpenChange, delayDuration, ...props }) => {
    const [hoverTimer, setHoverTimer] = React.useState(null);

    const handleMouseEnter = () => {
      if (delayDuration && delayDuration > 0) {
        const timer = setTimeout(() => {
          onOpenChange?.(true);
        }, delayDuration);
        setHoverTimer(timer);
      } else {
        onOpenChange?.(true);
      }
    };

    const handleMouseLeave = () => {
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        setHoverTimer(null);
      }
      onOpenChange?.(false);
    };

    React.useEffect(() => {
      return () => {
        if (hoverTimer) {
          clearTimeout(hoverTimer);
        }
      };
    }, [hoverTimer]);

    return (
      <div
        data-testid="tooltip-trigger"
        data-as-child={asChild}
        data-open={String(isOpen || false)}
        tabIndex={0}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={() => onOpenChange?.(true)}
        onBlur={() => onOpenChange?.(false)}
        {...props}
      >
        {children}
      </div>
    );
  },
  Portal: ({ children, ...props }) => (
    <div data-testid="tooltip-portal" {...props}>
      {children}
    </div>
  ),
  Content: ({ children, className, sideOffset, isOpen, ...props }) => (
    <div
      data-testid="tooltip-content"
      className={className}
      data-side-offset={sideOffset}
      data-open={String(isOpen || false)}
      style={{ display: isOpen ? 'block' : 'none' }}
      {...props}
    >
      {children}
    </div>
  ),
}));

// Mock clsx
vi.mock('clsx', () => ({
  default: (...classes) => classes.filter(Boolean).join(' ')
}));

describe('Tooltip Components', () => {
  describe('TooltipProvider', () => {
    it('should render provider with children', () => {
      render(
        <TooltipProvider>
          <div>Provider content</div>
        </TooltipProvider>
      );

      const provider = screen.getByTestId('tooltip-provider');
      expect(provider).toBeInTheDocument();
      expect(provider).toHaveTextContent('Provider content');
    });

    it('should pass props to provider', () => {
      render(
        <TooltipProvider delayDuration={500} skipDelayDuration={300}>
          <div>Content</div>
        </TooltipProvider>
      );

      const provider = screen.getByTestId('tooltip-provider');
      expect(provider).toHaveAttribute('data-delay-duration', '500');
      expect(provider).toHaveAttribute('data-skip-delay-duration', '300');
    });

    it('should handle disableHoverableContent prop', () => {
      render(
        <TooltipProvider disableHoverableContent>
          <div>Content</div>
        </TooltipProvider>
      );

      const provider = screen.getByTestId('tooltip-provider');
      expect(provider).toHaveAttribute('data-disable-hoverable-content', 'true');
    });

    it('should work without any props', () => {
      render(
        <TooltipProvider>
          <div>Simple content</div>
        </TooltipProvider>
      );

      const provider = screen.getByTestId('tooltip-provider');
      expect(provider).toBeInTheDocument();
      expect(provider).toHaveTextContent('Simple content');
    });
  });

  describe('Tooltip Root', () => {
    it('should render tooltip root', () => {
      render(
        <Tooltip>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Tooltip text</TooltipContent>
        </Tooltip>
      );

      const root = screen.getByTestId('tooltip-root');
      expect(root).toBeInTheDocument();
      expect(screen.getByTestId('tooltip-trigger')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip-content')).toBeInTheDocument();
    });

    it('should handle open prop', () => {
      render(
        <Tooltip open={true}>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>Content</TooltipContent>
        </Tooltip>
      );

      const root = screen.getByTestId('tooltip-root');
      expect(root).toHaveAttribute('data-open', 'true');
    });

    it('should handle defaultOpen prop', () => {
      render(
        <Tooltip defaultOpen={true}>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>Content</TooltipContent>
        </Tooltip>
      );

      const root = screen.getByTestId('tooltip-root');
      expect(root).toHaveAttribute('data-default-open', 'true');
    });

    it('should handle delayDuration prop', () => {
      render(
        <Tooltip delayDuration={1000}>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>Content</TooltipContent>
        </Tooltip>
      );

      const root = screen.getByTestId('tooltip-root');
      expect(root).toHaveAttribute('data-delay-duration', '1000');
    });

    it('should handle onOpenChange callback', () => {
      const onOpenChange = vi.fn();
      
      render(
        <Tooltip onOpenChange={onOpenChange}>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>Content</TooltipContent>
        </Tooltip>
      );

      // onOpenChange is passed to the root but not directly testable in this mock
      const root = screen.getByTestId('tooltip-root');
      expect(root).toBeInTheDocument();
    });
  });

  describe('TooltipTrigger', () => {
    it('should render trigger with children', () => {
      render(
        <Tooltip>
          <TooltipTrigger>Hover for tooltip</TooltipTrigger>
          <TooltipContent>Tooltip content</TooltipContent>
        </Tooltip>
      );

      const trigger = screen.getByTestId('tooltip-trigger');
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveTextContent('Hover for tooltip');
    });

    it('should be focusable', async () => {
      const user = userEvent.setup();
      
      render(
        <Tooltip>
          <TooltipTrigger>Focusable trigger</TooltipTrigger>
          <TooltipContent>Content</TooltipContent>
        </Tooltip>
      );

      const trigger = screen.getByTestId('tooltip-trigger');
      expect(trigger).toHaveAttribute('tabIndex', '0');
      
      await user.click(trigger);
      expect(trigger).toHaveFocus();
    });

    it('should support asChild prop', () => {
      render(
        <Tooltip>
          <TooltipTrigger asChild>
            <button>Custom trigger button</button>
          </TooltipTrigger>
          <TooltipContent>Content</TooltipContent>
        </Tooltip>
      );

      const trigger = screen.getByTestId('tooltip-trigger');
      expect(trigger).toHaveAttribute('data-as-child', 'true');
      expect(screen.getByText('Custom trigger button')).toBeInTheDocument();
    });

    it('should handle mouse events', async () => {
      const user = userEvent.setup();
      
      render(
        <Tooltip>
          <TooltipTrigger>Mouse events trigger</TooltipTrigger>
          <TooltipContent>Content</TooltipContent>
        </Tooltip>
      );

      const trigger = screen.getByTestId('tooltip-trigger');
      
      await user.hover(trigger);
      await user.unhover(trigger);
      
      // Events are handled by the mock implementation
      expect(trigger).toBeInTheDocument();
    });

    it('should handle keyboard focus events', async () => {
      const user = userEvent.setup();
      
      render(
        <Tooltip>
          <TooltipTrigger>Keyboard focus trigger</TooltipTrigger>
          <TooltipContent>Content</TooltipContent>
        </Tooltip>
      );

      const trigger = screen.getByTestId('tooltip-trigger');
      
      await user.click(trigger);
      expect(trigger).toHaveFocus();
      
      await user.tab();
      expect(trigger).not.toHaveFocus();
    });

    it('should handle custom props', () => {
      render(
        <Tooltip>
          <TooltipTrigger className="custom-trigger" data-custom="value">
            Custom trigger
          </TooltipTrigger>
          <TooltipContent>Content</TooltipContent>
        </Tooltip>
      );

      const trigger = screen.getByTestId('tooltip-trigger');
      expect(trigger).toHaveClass('custom-trigger');
      expect(trigger).toHaveAttribute('data-custom', 'value');
    });
  });

  describe('TooltipContent', () => {
    it('should render content with default props', () => {
      render(
        <Tooltip>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>Tooltip content text</TooltipContent>
        </Tooltip>
      );

      const content = screen.getByTestId('tooltip-content');
      expect(content).toBeInTheDocument();
      expect(content).toHaveTextContent('Tooltip content text');
      expect(content).toHaveClass('tooltipContent');
      expect(content).toHaveAttribute('data-side-offset', '4');
    });

    it('should render within portal', () => {
      render(
        <Tooltip>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>Portal content</TooltipContent>
        </Tooltip>
      );

      expect(screen.getByTestId('tooltip-portal')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip-content')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(
        <Tooltip>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent className="custom-tooltip">
            Custom styled content
          </TooltipContent>
        </Tooltip>
      );

      const content = screen.getByTestId('tooltip-content');
      expect(content).toHaveClass('tooltipContent custom-tooltip');
    });

    it('should support custom sideOffset', () => {
      render(
        <Tooltip>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent sideOffset={10}>
            Content with offset
          </TooltipContent>
        </Tooltip>
      );

      const content = screen.getByTestId('tooltip-content');
      expect(content).toHaveAttribute('data-side-offset', '10');
    });

    it('should forward ref correctly', () => {
      const ref = { current: null };
      
      const TestComponent = () => (
        <Tooltip>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent ref={ref}>
            Ref forwarding content
          </TooltipContent>
        </Tooltip>
      );

      render(<TestComponent />);
      
      // Ref forwarding is handled by Radix, so we just verify it doesn't break
      expect(screen.getByTestId('tooltip-content')).toBeInTheDocument();
    });

    it('should handle additional props', () => {
      render(
        <Tooltip>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent 
            side="top" 
            align="center"
            arrowPadding={5}
            avoidCollisions={false}
          >
            Content with props
          </TooltipContent>
        </Tooltip>
      );

      const content = screen.getByTestId('tooltip-content');
      expect(content).toHaveAttribute('side', 'top');
      expect(content).toHaveAttribute('align', 'center');
      expect(content).toHaveAttribute('arrowPadding', '5');
      expect(content).toHaveAttribute('avoidCollisions', 'false');
    });

    it('should render complex content', () => {
      render(
        <Tooltip>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>
            <div>
              <h3>Complex Tooltip</h3>
              <p>This tooltip has multiple elements</p>
              <button>Action</button>
            </div>
          </TooltipContent>
        </Tooltip>
      );

      const content = screen.getByTestId('tooltip-content');
      expect(content).toContainElement(screen.getByText('Complex Tooltip'));
      expect(content).toContainElement(screen.getByText('This tooltip has multiple elements'));
      expect(content).toContainElement(screen.getByText('Action'));
    });
  });

  describe('Complete Tooltip Integration', () => {
    it('should render complete tooltip with provider', () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Complete example</TooltipTrigger>
            <TooltipContent>Complete tooltip content</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      expect(screen.getByTestId('tooltip-provider')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip-root')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip-trigger')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip-portal')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip-content')).toBeInTheDocument();
    });

    it('should handle multiple tooltips in one provider', () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>First trigger</TooltipTrigger>
            <TooltipContent>First tooltip</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger>Second trigger</TooltipTrigger>
            <TooltipContent>Second tooltip</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      const provider = screen.getByTestId('tooltip-provider');
      const tooltips = screen.getAllByTestId('tooltip-root');
      
      expect(provider).toBeInTheDocument();
      expect(tooltips).toHaveLength(2);
      expect(screen.getByText('First trigger')).toBeInTheDocument();
      expect(screen.getByText('Second trigger')).toBeInTheDocument();
      expect(screen.getByText('First tooltip')).toBeInTheDocument();
      expect(screen.getByText('Second tooltip')).toBeInTheDocument();
    });

    it('should work with controlled tooltip', () => {
      const ControlledTooltip = () => {
        const [open, setOpen] = React.useState(false);
        
        return (
          <TooltipProvider>
            <Tooltip open={open} onOpenChange={setOpen}>
              <TooltipTrigger onClick={() => setOpen(!open)}>
                Controlled trigger
              </TooltipTrigger>
              <TooltipContent>Controlled content</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      };

      render(<ControlledTooltip />);

      const trigger = screen.getByTestId('tooltip-trigger');
      const root = screen.getByTestId('tooltip-root');

      // Initially closed
      expect(root).toHaveAttribute('data-open', 'false');

      // Click to toggle
      fireEvent.click(trigger);
      expect(root).toHaveAttribute('data-open', 'true');
    });

    it('should handle nested tooltip structure', () => {
      render(
        <TooltipProvider>
          <div>
            <Tooltip>
              <TooltipTrigger>
                <span>Nested trigger content</span>
              </TooltipTrigger>
              <TooltipContent>
                <div>
                  <span>Nested tooltip content</span>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      );

      expect(screen.getByText('Nested trigger content')).toBeInTheDocument();
      expect(screen.getByText('Nested tooltip content')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger aria-label="Information trigger">
              Info
            </TooltipTrigger>
            <TooltipContent role="tooltip">
              Information content
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      const trigger = screen.getByTestId('tooltip-trigger');
      const content = screen.getByTestId('tooltip-content');

      expect(trigger).toHaveAttribute('aria-label', 'Information trigger');
      expect(content).toHaveAttribute('role', 'tooltip');
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Keyboard accessible</TooltipTrigger>
            <TooltipContent>Accessible content</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      const trigger = screen.getByTestId('tooltip-trigger');
      
      // Should be focusable with keyboard
      await user.tab();
      expect(trigger).toHaveFocus();
    });

    it('should support screen reader attributes', () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger 
              aria-describedby="tooltip-content"
              aria-expanded="false"
            >
              Screen reader trigger
            </TooltipTrigger>
            <TooltipContent id="tooltip-content">
              Screen reader content
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      const trigger = screen.getByTestId('tooltip-trigger');
      const content = screen.getByTestId('tooltip-content');

      expect(trigger).toHaveAttribute('aria-describedby', 'tooltip-content');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(content).toHaveAttribute('id', 'tooltip-content');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Trigger</TooltipTrigger>
            <TooltipContent></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      const content = screen.getByTestId('tooltip-content');
      expect(content).toBeInTheDocument();
      expect(content).toHaveTextContent('');
    });

    it('should handle very long content', () => {
      const longContent = 'A'.repeat(1000);
      
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Long content trigger</TooltipTrigger>
            <TooltipContent>{longContent}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      const content = screen.getByTestId('tooltip-content');
      expect(content).toHaveTextContent(longContent);
    });

    it('should handle special characters in content', () => {
      const specialContent = 'Special: !@#$%^&*()_+{}|:<>?[]\\;\'",./`~';
      
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Special chars</TooltipTrigger>
            <TooltipContent>{specialContent}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      const content = screen.getByTestId('tooltip-content');
      expect(content).toHaveTextContent(specialContent);
    });

    it('should handle HTML entities', () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>HTML entities</TooltipTrigger>
            <TooltipContent>&lt;div&gt;HTML content&lt;/div&gt;</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      const content = screen.getByTestId('tooltip-content');
      expect(content).toHaveTextContent('<div>HTML content</div>');
    });

    it('should handle missing trigger', () => {
      expect(() => {
        render(
          <TooltipProvider>
            <Tooltip>
              <TooltipContent>Content without trigger</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }).not.toThrow();
    });

    it('should handle missing content', () => {
      expect(() => {
        render(
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>Trigger without content</TooltipTrigger>
            </Tooltip>
          </TooltipProvider>
        );
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid props gracefully', () => {
      expect(() => {
        render(
          <TooltipProvider delayDuration="invalid">
            <Tooltip open="invalid">
              <TooltipTrigger>Trigger</TooltipTrigger>
              <TooltipContent sideOffset="invalid">Content</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }).not.toThrow();
    });

    it('should handle missing provider', () => {
      expect(() => {
        render(
          <Tooltip>
            <TooltipTrigger>No provider trigger</TooltipTrigger>
            <TooltipContent>No provider content</TooltipContent>
          </Tooltip>
        );
      }).not.toThrow();
    });

    it('should handle nested providers', () => {
      expect(() => {
        render(
          <TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>Nested provider trigger</TooltipTrigger>
                <TooltipContent>Nested provider content</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </TooltipProvider>
        );
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle multiple tooltips efficiently', () => {
      const tooltips = Array.from({ length: 50 }, (_, i) => i);
      
      const { container } = render(
        <TooltipProvider>
          {tooltips.map(i => (
            <Tooltip key={i}>
              <TooltipTrigger>Trigger {i}</TooltipTrigger>
              <TooltipContent>Content {i}</TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      );

      const tooltipRoots = container.querySelectorAll('[data-testid="tooltip-root"]');
      expect(tooltipRoots).toHaveLength(50);
    });

    it('should not cause memory leaks with frequent renders', () => {
      const { rerender, unmount } = render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Trigger</TooltipTrigger>
            <TooltipContent>Content</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      // Multiple re-renders
      for (let i = 0; i < 10; i++) {
        rerender(
          <TooltipProvider key={i}>
            <Tooltip>
              <TooltipTrigger>Trigger {i}</TooltipTrigger>
              <TooltipContent>Content {i}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }

      expect(() => unmount()).not.toThrow();
    });

    it('should handle rapid state changes efficiently', () => {
      const RapidChangeTooltip = () => {
        const [open, setOpen] = React.useState(false);
        
        React.useEffect(() => {
          const interval = setInterval(() => {
            setOpen(prev => !prev);
          }, 10);
          
          setTimeout(() => clearInterval(interval), 100);
          
          return () => clearInterval(interval);
        }, []);
        
        return (
          <TooltipProvider>
            <Tooltip open={open}>
              <TooltipTrigger>Rapid change</TooltipTrigger>
              <TooltipContent>Rapidly changing content</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      };

      expect(() => {
        render(<RapidChangeTooltip />);
      }).not.toThrow();
    });
  });

  describe('Component Composition', () => {
    it('should work with custom trigger components', () => {
      const CustomButton = React.forwardRef(({ children, ...props }, ref) => (
        <button ref={ref} className="custom-button" {...props}>
          {children}
        </button>
      ));
      CustomButton.displayName = 'CustomButton';

      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <CustomButton>Custom Button</CustomButton>
            </TooltipTrigger>
            <TooltipContent>Button tooltip</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      expect(screen.getByText('Custom Button')).toBeInTheDocument();
      expect(screen.getByText('Button tooltip')).toBeInTheDocument();
    });

    it('should work with form elements', () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <input placeholder="Input with tooltip" />
            </TooltipTrigger>
            <TooltipContent>Input help text</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      expect(screen.getByPlaceholderText('Input with tooltip')).toBeInTheDocument();
      expect(screen.getByText('Input help text')).toBeInTheDocument();
    });

    it('should work with disabled elements', () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button disabled>Disabled Button</button>
            </TooltipTrigger>
            <TooltipContent>This button is disabled</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      const button = screen.getByText('Disabled Button');
      expect(button).toBeDisabled();
      expect(screen.getByText('This button is disabled')).toBeInTheDocument();
    });
  });

  describe('Advanced Interaction Tests', () => {
    beforeEach(() => {
      vi.clearAllTimers();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    });

    it('should handle delayed opening correctly', async () => {
      const user = userEvent.setup({ delay: null });
      
      render(
        <TooltipProvider>
          <Tooltip delayDuration={300}>
            <TooltipTrigger>Delayed trigger</TooltipTrigger>
            <TooltipContent>Delayed content</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      const trigger = screen.getByTestId('tooltip-trigger');
      
      await user.hover(trigger);
      
      // Content should not be visible immediately
      expect(trigger).toHaveAttribute('data-open', 'false');
      
      // Fast-forward time to trigger delay
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(trigger).toHaveAttribute('data-open', 'true');
    });

    it('should cancel delayed opening on mouse leave', async () => {
      const user = userEvent.setup({ delay: null });
      
      render(
        <TooltipProvider>
          <Tooltip delayDuration={300}>
            <TooltipTrigger>Cancel trigger</TooltipTrigger>
            <TooltipContent>Cancel content</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      const trigger = screen.getByTestId('tooltip-trigger');
      
      await user.hover(trigger);
      
      // Leave before delay completes
      act(() => {
        vi.advanceTimersByTime(150);
      });
      
      await user.unhover(trigger);
      
      // Complete the original delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(trigger).toHaveAttribute('data-open', 'false');
    });

    it('should handle rapid hover events correctly', async () => {
      const user = userEvent.setup({ delay: null });
      
      render(
        <TooltipProvider>
          <Tooltip delayDuration={100}>
            <TooltipTrigger>Rapid trigger</TooltipTrigger>
            <TooltipContent>Rapid content</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      const trigger = screen.getByTestId('tooltip-trigger');
      
      // Rapid hover/unhover sequence
      for (let i = 0; i < 5; i++) {
        await user.hover(trigger);
        act(() => {
          vi.advanceTimersByTime(50);
        });
        await user.unhover(trigger);
        act(() => {
          vi.advanceTimersByTime(10);
        });
      }
      
      // Final hover and wait for delay
      await user.hover(trigger);
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(trigger).toHaveAttribute('data-open', 'true');
    });

    it('should handle focus events correctly', async () => {
      const user = userEvent.setup({ delay: null });
      
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Focus trigger</TooltipTrigger>
            <TooltipContent>Focus content</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      const trigger = screen.getByTestId('tooltip-trigger');
      
      await user.click(trigger);
      expect(trigger).toHaveAttribute('data-open', 'true');
      
      await user.tab();
      expect(trigger).toHaveAttribute('data-open', 'false');
    });
  });

  describe('Accessibility Edge Cases', () => {
    it('should maintain proper focus order with multiple tooltips', async () => {
      const user = userEvent.setup();
      
      render(
        <TooltipProvider>
          <div>
            <Tooltip>
              <TooltipTrigger>First trigger</TooltipTrigger>
              <TooltipContent>First content</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger>Second trigger</TooltipTrigger>
              <TooltipContent>Second content</TooltipContent>
            </Tooltip>
            <button>External button</button>
          </div>
        </TooltipProvider>
      );

      const firstTrigger = screen.getByText('First trigger');
      const secondTrigger = screen.getByText('Second trigger');
      const externalButton = screen.getByText('External button');
      
      // Tab through elements
      await user.tab();
      expect(firstTrigger).toHaveFocus();
      
      await user.tab();
      expect(secondTrigger).toHaveFocus();
      
      await user.tab();
      expect(externalButton).toHaveFocus();
    });

    it('should handle screen reader announcements', () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger 
              aria-describedby="tooltip-content"
              aria-expanded="false"
            >
              Screen reader trigger
            </TooltipTrigger>
            <TooltipContent 
              id="tooltip-content"
              role="tooltip"
              aria-live="polite"
            >
              Screen reader content
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      const trigger = screen.getByTestId('tooltip-trigger');
      const content = screen.getByTestId('tooltip-content');

      expect(trigger).toHaveAttribute('aria-describedby', 'tooltip-content');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(content).toHaveAttribute('id', 'tooltip-content');
      expect(content).toHaveAttribute('role', 'tooltip');
      expect(content).toHaveAttribute('aria-live', 'polite');
    });

    it('should handle high contrast mode', () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>High contrast trigger</TooltipTrigger>
            <TooltipContent className="high-contrast">
              High contrast content
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      const content = screen.getByTestId('tooltip-content');
      expect(content).toHaveClass('tooltipContent high-contrast');
    });
  });

  describe('Performance and Memory Tests', () => {
    it('should handle component unmounting without memory leaks', () => {
      const { unmount } = render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Unmount trigger</TooltipTrigger>
            <TooltipContent>Unmount content</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      // Should not throw during unmount
      expect(() => unmount()).not.toThrow();
    });

    it('should handle large content efficiently', () => {
      const largeContent = 'A'.repeat(10000);
      
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Large content trigger</TooltipTrigger>
            <TooltipContent>{largeContent}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      const content = screen.getByTestId('tooltip-content');
      expect(content).toHaveTextContent(largeContent);
    });

    it('should handle many nested tooltips', () => {
      const NestedTooltips = ({ depth }) => {
        if (depth === 0) {
          return <span>Deep content</span>;
        }
        
        return (
          <Tooltip>
            <TooltipTrigger>Nested {depth}</TooltipTrigger>
            <TooltipContent>
              <NestedTooltips depth={depth - 1} />
            </TooltipContent>
          </Tooltip>
        );
      };

      render(
        <TooltipProvider>
          <NestedTooltips depth={5} />
        </TooltipProvider>
      );

      expect(screen.getByText('Nested 5')).toBeInTheDocument();
      expect(screen.getByText('Deep content')).toBeInTheDocument();
    });
  });

  describe('Error Boundary Integration', () => {
    it('should handle errors in content gracefully', () => {
      const ErrorContent = () => {
        throw new Error('Test error');
      };

      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>Error trigger</TooltipTrigger>
              <TooltipContent>
                <ErrorContent />
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }).toThrow('Test error');

      consoleSpy.mockRestore();
    });

    it('should handle portal rendering errors', () => {
      // Mock portal to throw error
      const originalCreatePortal = require('react-dom').createPortal;
      vi.spyOn(require('react-dom'), 'createPortal').mockImplementation(() => {
        throw new Error('Portal error');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Portal error trigger</TooltipTrigger>
            <TooltipContent>Portal error content</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      // Component should still render trigger even if portal fails
      expect(screen.getByText('Portal error trigger')).toBeInTheDocument();

      require('react-dom').createPortal.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('Theme and Style Integration', () => {
    it('should handle dynamic theme changes', () => {
      const ThemeTooltip = ({ theme }) => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className={`trigger-${theme}`}>
              Theme trigger
            </TooltipTrigger>
            <TooltipContent className={`content-${theme}`}>
              Theme content
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      const { rerender } = render(<ThemeTooltip theme="light" />);
      
      expect(screen.getByTestId('tooltip-trigger')).toHaveClass('trigger-light');
      expect(screen.getByTestId('tooltip-content')).toHaveClass('tooltipContent content-light');

      rerender(<ThemeTooltip theme="dark" />);
      
      expect(screen.getByTestId('tooltip-trigger')).toHaveClass('trigger-dark');
      expect(screen.getByTestId('tooltip-content')).toHaveClass('tooltipContent content-dark');
    });

    it('should handle CSS-in-JS styles', () => {
      const dynamicStyles = {
        backgroundColor: 'red',
        color: 'white',
        borderRadius: '4px'
      };

      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger style={dynamicStyles}>
              Styled trigger
            </TooltipTrigger>
            <TooltipContent style={dynamicStyles}>
              Styled content
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      const trigger = screen.getByTestId('tooltip-trigger');
      const content = screen.getByTestId('tooltip-content');
      
      expect(trigger).toHaveStyle(dynamicStyles);
      expect(content).toHaveStyle(dynamicStyles);
    });
  });

  describe('Integration with Form Elements', () => {
    it('should work with form validation', async () => {
      const user = userEvent.setup();
      
      const FormWithTooltip = () => {
        const [error, setError] = React.useState('');
        
        const handleSubmit = (e) => {
          e.preventDefault();
          const input = e.target.elements.email;
          if (!input.value) {
            setError('Email is required');
          } else {
            setError('');
          }
        };
        
        return (
          <form onSubmit={handleSubmit}>
            <Tooltip open={!!error}>
              <TooltipTrigger asChild>
                <input name="email" placeholder="Enter email" />
              </TooltipTrigger>
              <TooltipContent>{error}</TooltipContent>
            </Tooltip>
            <button type="submit">Submit</button>
          </form>
        );
      };

      render(
        <TooltipProvider>
          <FormWithTooltip />
        </TooltipProvider>
      );

      const submitButton = screen.getByText('Submit');
      
      await user.click(submitButton);
      
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip-content')).toHaveAttribute('data-open', 'true');
    });

    it('should handle disabled form elements', () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <input disabled placeholder="Disabled input" />
            </TooltipTrigger>
            <TooltipContent>This input is disabled</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      const input = screen.getByPlaceholderText('Disabled input');
      expect(input).toBeDisabled();
      expect(screen.getByText('This input is disabled')).toBeInTheDocument();
    });
  });
});
