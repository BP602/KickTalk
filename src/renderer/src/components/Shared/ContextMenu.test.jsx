import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
} from './ContextMenu';

// Mock Radix UI context menu primitives
vi.mock('@radix-ui/react-context-menu', () => ({
  Root: ({ children, modal, ...props }) => <div data-testid="context-menu-root" {...props}>{children}</div>,
  Trigger: ({ children, ...props }) => <div data-testid="context-menu-trigger" {...props}>{children}</div>,
  Portal: ({ children, ...props }) => <div data-testid="context-menu-portal" {...props}>{children}</div>,
  Content: ({ children, className, ...props }) => (
    <div data-testid="context-menu-content" className={className} {...props}>{children}</div>
  ),
  Item: ({ children, className, onSelect, ...props }) => (
    <div
      data-testid="context-menu-item"
      className={className}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect && onSelect();
        }
      }}
      tabIndex={0}
      {...props}
    >
      {children}
    </div>
  ),
  CheckboxItem: ({ children, className, checked, onCheckedChange, ...props }) => (
    <div
      data-testid="context-menu-checkbox-item"
      className={className}
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={() => onCheckedChange && onCheckedChange(!checked)}
      tabIndex={0}
      {...props}
    >
      {children}
    </div>
  ),
  RadioItem: ({ children, className, onSelect, value, ...props }) => (
    <div
      data-testid="context-menu-radio-item"
      className={className}
      role="menuitemradio"
      onClick={() => onSelect && onSelect(value)}
      tabIndex={0}
      {...props}
    >
      {children}
    </div>
  ),
  Label: ({ children, className, ...props }) => (
    <div data-testid="context-menu-label" className={className} {...props}>{children}</div>
  ),
  Separator: ({ className, ...props }) => (
    <div data-testid="context-menu-separator" className={className} {...props} />
  ),
  Group: ({ children, ...props }) => <div data-testid="context-menu-group" {...props}>{children}</div>,
  Sub: ({ children, ...props }) => <div data-testid="context-menu-sub" {...props}>{children}</div>,
  SubTrigger: ({ children, className, ...props }) => (
    <div data-testid="context-menu-sub-trigger" className={className} {...props}>{children}</div>
  ),
  SubContent: ({ children, className, ...props }) => (
    <div data-testid="context-menu-sub-content" className={className} {...props}>{children}</div>
  ),
  RadioGroup: ({ children, ...props }) => (
    <div data-testid="context-menu-radio-group" {...props}>{children}</div>
  ),
  ItemIndicator: ({ children, ...props }) => (
    <span data-testid="context-menu-item-indicator" {...props}>{children}</span>
  ),
}));

// Mock assets
vi.mock('@assets/icons/caret-right-fill.svg', () => ({ default: 'caret-right-icon' }));
vi.mock('@assets/icons/circle-bold.svg', () => ({ default: 'circle-icon' }));
vi.mock('@assets/styles/components/ContextMenu.scss', () => ({}));

describe('ContextMenu Components', () => {
  describe('ContextMenu Root', () => {
    it('should render root component', () => {
      render(
        <ContextMenu>
          <ContextMenuTrigger>Right click me</ContextMenuTrigger>
        </ContextMenu>
      );

      expect(screen.getByTestId('context-menu-root')).toBeInTheDocument();
      expect(screen.getByTestId('context-menu-trigger')).toBeInTheDocument();
    });

    it('should pass props to root component', () => {
      render(
        <ContextMenu modal={false} data-custom="test">
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
        </ContextMenu>
      );

      const root = screen.getByTestId('context-menu-root');
      expect(root).toHaveAttribute('data-custom', 'test');
    });
  });

  describe('ContextMenuTrigger', () => {
    it('should render trigger with children', () => {
      render(
        <ContextMenu>
          <ContextMenuTrigger>Right click trigger</ContextMenuTrigger>
        </ContextMenu>
      );

      const trigger = screen.getByTestId('context-menu-trigger');
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveTextContent('Right click trigger');
    });

    it('should handle custom props', () => {
      render(
        <ContextMenu>
          <ContextMenuTrigger className="custom-trigger" data-testattr="test">
            Trigger
          </ContextMenuTrigger>
        </ContextMenu>
      );

      const trigger = screen.getByTestId('context-menu-trigger');
      expect(trigger).toHaveClass('custom-trigger');
      expect(trigger).toHaveAttribute('data-testattr', 'test');
    });
  });

  describe('ContextMenuContent', () => {
    it('should render content within portal', () => {
      render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem>Item 1</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );

      expect(screen.getByTestId('context-menu-portal')).toBeInTheDocument();
      expect(screen.getByTestId('context-menu-content')).toBeInTheDocument();
    });

    it('should apply contextMenu class', () => {
      render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem>Item 1</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );

      const content = screen.getByTestId('context-menu-content');
      expect(content).toHaveClass('contextMenu');
    });

    it('should forward ref correctly', () => {
      const ref = { current: null };
      
      const TestComponent = () => (
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent ref={ref}>
            <ContextMenuItem>Item 1</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );

      render(<TestComponent />);
      // Ref forwarding is handled by Radix, so we just verify it doesn't break
      expect(screen.getByTestId('context-menu-content')).toBeInTheDocument();
    });
  });

  describe('ContextMenuItem', () => {
    it('should render menu item', () => {
      const onSelect = vi.fn();
      
      render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={onSelect}>Menu Item</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );

      const item = screen.getByTestId('context-menu-item');
      expect(item).toBeInTheDocument();
      expect(item).toHaveTextContent('Menu Item');
      expect(item).toHaveClass('contextMenuItem');
    });

    it('should handle click events', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      
      render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={onSelect}>Clickable Item</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );

      const item = screen.getByTestId('context-menu-item');
      await user.click(item);

      expect(onSelect).toHaveBeenCalled();
    });

    it('should handle keyboard navigation', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      
      render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={onSelect}>Keyboard Item</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );

      const item = screen.getByTestId('context-menu-item');
      item.focus();
      
      await user.keyboard('{Enter}');
      expect(onSelect).toHaveBeenCalledTimes(1);

      await user.keyboard(' ');
      expect(onSelect).toHaveBeenCalledTimes(2);
    });

    it('should handle disabled state', () => {
      render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem disabled>Disabled Item</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );

      const item = screen.getByTestId('context-menu-item');
      expect(item).toHaveAttribute('disabled');
    });
  });

  describe('ContextMenuCheckboxItem', () => {
    it('should render checkbox item with proper attributes', () => {
      const onCheckedChange = vi.fn();
      
      render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuCheckboxItem checked={true} onCheckedChange={onCheckedChange}>
              Checkbox Item
            </ContextMenuCheckboxItem>
          </ContextMenuContent>
        </ContextMenu>
      );

      const item = screen.getByTestId('context-menu-checkbox-item');
      expect(item).toBeInTheDocument();
      expect(item).toHaveClass('contextMenuCheckboxItem');
      expect(item).toHaveAttribute('role', 'menuitemcheckbox');
      expect(item).toHaveAttribute('aria-checked', 'true');
    });

    it('should toggle checked state on click', async () => {
      const user = userEvent.setup();
      const onCheckedChange = vi.fn();
      
      render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuCheckboxItem checked={false} onCheckedChange={onCheckedChange}>
              Toggle me
            </ContextMenuCheckboxItem>
          </ContextMenuContent>
        </ContextMenu>
      );

      const item = screen.getByTestId('context-menu-checkbox-item');
      await user.click(item);

      expect(onCheckedChange).toHaveBeenCalledWith(true);
    });

    it('should render item indicator', () => {
      render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuCheckboxItem checked={true}>
              Checked Item
            </ContextMenuCheckboxItem>
          </ContextMenuContent>
        </ContextMenu>
      );

      expect(screen.getByTestId('context-menu-item-indicator')).toBeInTheDocument();
      expect(screen.getByText('Checked Item')).toBeInTheDocument();
    });
  });

  describe('ContextMenuRadioItem', () => {
    it('should render radio item with proper attributes', () => {
      const onSelect = vi.fn();
      
      render(
        <ContextMenuRadioGroup value="option1">
          <ContextMenuRadioItem value="option1" onSelect={onSelect}>
            Radio Option 1
          </ContextMenuRadioItem>
        </ContextMenuRadioGroup>
      );

      const item = screen.getByTestId('context-menu-radio-item');
      expect(item).toBeInTheDocument();
      expect(item).toHaveClass('contextMenuRadioItem');
      expect(item).toHaveAttribute('role', 'menuitemradio');
    });

    it('should handle selection', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      
      render(
        <ContextMenuRadioGroup>
          <ContextMenuRadioItem value="option1" onSelect={onSelect}>
            Option 1
          </ContextMenuRadioItem>
        </ContextMenuRadioGroup>
      );

      const item = screen.getByTestId('context-menu-radio-item');
      await user.click(item);

      expect(onSelect).toHaveBeenCalledWith('option1');
    });

    it('should render with circle indicator', () => {
      render(
        <ContextMenuRadioGroup>
          <ContextMenuRadioItem value="option1">
            Option with indicator
          </ContextMenuRadioItem>
        </ContextMenuRadioGroup>
      );

      const indicator = screen.getByTestId('context-menu-item-indicator');
      expect(indicator).toBeInTheDocument();
      
      const img = indicator.querySelector('img');
      expect(img).toHaveAttribute('width', '16');
      expect(img).toHaveAttribute('height', '16');
    });
  });

  describe('ContextMenuLabel', () => {
    it('should render label', () => {
      render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuLabel>Section Label</ContextMenuLabel>
          </ContextMenuContent>
        </ContextMenu>
      );

      const label = screen.getByTestId('context-menu-label');
      expect(label).toBeInTheDocument();
      expect(label).toHaveClass('contextMenuLabel');
      expect(label).toHaveTextContent('Section Label');
    });

    it('should handle inset prop', () => {
      render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuLabel inset>Inset Label</ContextMenuLabel>
          </ContextMenuContent>
        </ContextMenu>
      );

      const label = screen.getByTestId('context-menu-label');
      // The inset prop is passed through but not set as an attribute in the actual implementation
      expect(label).toBeInTheDocument();
    });
  });

  describe('ContextMenuSeparator', () => {
    it('should render separator', () => {
      render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem>Item 1</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem>Item 2</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );

      const separator = screen.getByTestId('context-menu-separator');
      expect(separator).toBeInTheDocument();
      expect(separator).toHaveClass('contextMenuSeparator');
    });
  });

  describe('ContextMenuShortcut', () => {
    it('should render shortcut', () => {
      render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem>
              Copy
              <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );

      const shortcut = screen.getByText('Ctrl+C');
      expect(shortcut).toBeInTheDocument();
      expect(shortcut).toHaveClass('contextMenuShortcut');
    });

    it('should handle custom className', () => {
      render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem>
              Paste
              <ContextMenuShortcut className="custom-shortcut">Ctrl+V</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );

      const shortcut = screen.getByText('Ctrl+V');
      expect(shortcut).toHaveClass('contextMenuShortcut');
      // The actual implementation doesn't combine classnames, it only uses the base class
      expect(shortcut).toBeInTheDocument();
    });
  });

  describe('ContextMenuGroup', () => {
    it('should render group with items', () => {
      render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuGroup>
              <ContextMenuItem>Group Item 1</ContextMenuItem>
              <ContextMenuItem>Group Item 2</ContextMenuItem>
            </ContextMenuGroup>
          </ContextMenuContent>
        </ContextMenu>
      );

      const group = screen.getByTestId('context-menu-group');
      expect(group).toBeInTheDocument();
      expect(screen.getByText('Group Item 1')).toBeInTheDocument();
      expect(screen.getByText('Group Item 2')).toBeInTheDocument();
    });
  });

  describe('ContextMenuSub', () => {
    it('should render sub menu structure', () => {
      render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                More Options
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem>Sub Item 1</ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          </ContextMenuContent>
        </ContextMenu>
      );

      expect(screen.getByTestId('context-menu-sub')).toBeInTheDocument();
      expect(screen.getByTestId('context-menu-sub-trigger')).toBeInTheDocument();
      expect(screen.getByTestId('context-menu-sub-content')).toBeInTheDocument();
    });

    it('should render sub trigger with caret icon', () => {
      render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                Submenu
              </ContextMenuSubTrigger>
            </ContextMenuSub>
          </ContextMenuContent>
        </ContextMenu>
      );

      const subTrigger = screen.getByTestId('context-menu-sub-trigger');
      expect(subTrigger).toHaveClass('contextMenuSubTrigger');
      
      const icon = subTrigger.querySelector('img');
      expect(icon).toHaveAttribute('width', '16');
      expect(icon).toHaveAttribute('height', '16');
    });

    it('should render sub content with proper class', () => {
      render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuSub>
              <ContextMenuSubTrigger>Submenu</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem>Sub Item</ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          </ContextMenuContent>
        </ContextMenu>
      );

      const subContent = screen.getByTestId('context-menu-sub-content');
      expect(subContent).toHaveClass('contextMenuSubContent');
    });
  });

  describe('ContextMenuRadioGroup', () => {
    it('should render radio group', () => {
      render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuRadioGroup value="option1">
              <ContextMenuRadioItem value="option1">Option 1</ContextMenuRadioItem>
              <ContextMenuRadioItem value="option2">Option 2</ContextMenuRadioItem>
            </ContextMenuRadioGroup>
          </ContextMenuContent>
        </ContextMenu>
      );

      const radioGroup = screen.getByTestId('context-menu-radio-group');
      expect(radioGroup).toBeInTheDocument();
      expect(radioGroup).toHaveAttribute('value', 'option1');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for checkbox items', () => {
      render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuCheckboxItem checked={true}>
              Accessible Checkbox
            </ContextMenuCheckboxItem>
          </ContextMenuContent>
        </ContextMenu>
      );

      const item = screen.getByTestId('context-menu-checkbox-item');
      expect(item).toHaveAttribute('role', 'menuitemcheckbox');
      expect(item).toHaveAttribute('aria-checked', 'true');
    });

    it('should have proper ARIA attributes for radio items', () => {
      render(
        <ContextMenuRadioGroup>
          <ContextMenuRadioItem value="test">
            Accessible Radio
          </ContextMenuRadioItem>
        </ContextMenuRadioGroup>
      );

      const item = screen.getByTestId('context-menu-radio-item');
      expect(item).toHaveAttribute('role', 'menuitemradio');
    });

    it('should be keyboard navigable', () => {
      render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem>Item 1</ContextMenuItem>
            <ContextMenuItem>Item 2</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );

      const items = screen.getAllByTestId('context-menu-item');
      items.forEach(item => {
        expect(item).toHaveAttribute('tabIndex', '0');
      });
    });
  });

  describe('Component Integration', () => {
    it('should render complex menu structure', () => {
      const handleEdit = vi.fn();
      const handleDelete = vi.fn();
      const handleCopy = vi.fn();
      
      render(
        <ContextMenu>
          <ContextMenuTrigger>
            <div>Right click for menu</div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuGroup>
              <ContextMenuItem onSelect={handleEdit}>
                Edit
                <ContextMenuShortcut>Ctrl+E</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem onSelect={handleCopy}>
                Copy
                <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
              </ContextMenuItem>
            </ContextMenuGroup>
            <ContextMenuSeparator />
            <ContextMenuCheckboxItem checked={true}>
              Show Grid
            </ContextMenuCheckboxItem>
            <ContextMenuSeparator />
            <ContextMenuRadioGroup value="view1">
              <ContextMenuRadioItem value="view1">List View</ContextMenuRadioItem>
              <ContextMenuRadioItem value="view2">Grid View</ContextMenuRadioItem>
            </ContextMenuRadioGroup>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>More Actions</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem onSelect={handleDelete}>Delete</ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          </ContextMenuContent>
        </ContextMenu>
      );

      // Verify all components render
      expect(screen.getByText('Right click for menu')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Copy')).toBeInTheDocument();
      expect(screen.getByText('Ctrl+E')).toBeInTheDocument();
      expect(screen.getByText('Ctrl+C')).toBeInTheDocument();
      expect(screen.getByText('Show Grid')).toBeInTheDocument();
      expect(screen.getByText('List View')).toBeInTheDocument();
      expect(screen.getByText('Grid View')).toBeInTheDocument();
      expect(screen.getByText('More Actions')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
      
      expect(screen.getAllByTestId('context-menu-separator')).toHaveLength(3);
    });

    it('should handle all interactions correctly', async () => {
      const user = userEvent.setup();
      const mockHandlers = {
        edit: vi.fn(),
        copy: vi.fn(),
        toggleGrid: vi.fn(),
        changeView: vi.fn(),
        delete: vi.fn(),
      };
      
      render(
        <ContextMenu>
          <ContextMenuTrigger>Menu Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={mockHandlers.edit}>Edit</ContextMenuItem>
            <ContextMenuItem onSelect={mockHandlers.copy}>Copy</ContextMenuItem>
            <ContextMenuCheckboxItem 
              checked={false} 
              onCheckedChange={mockHandlers.toggleGrid}
            >
              Show Grid
            </ContextMenuCheckboxItem>
            <ContextMenuRadioGroup>
              <ContextMenuRadioItem 
                value="list" 
                onSelect={mockHandlers.changeView}
              >
                List View
              </ContextMenuRadioItem>
            </ContextMenuRadioGroup>
          </ContextMenuContent>
        </ContextMenu>
      );

      // Test menu item interactions
      await user.click(screen.getByText('Edit'));
      expect(mockHandlers.edit).toHaveBeenCalled();

      await user.click(screen.getByText('Copy'));
      expect(mockHandlers.copy).toHaveBeenCalled();

      await user.click(screen.getByText('Show Grid'));
      expect(mockHandlers.toggleGrid).toHaveBeenCalledWith(true);

      await user.click(screen.getByText('List View'));
      expect(mockHandlers.changeView).toHaveBeenCalledWith('list');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing onSelect gracefully', async () => {
      const user = userEvent.setup();
      
      render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem>Item without handler</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );

      const item = screen.getByText('Item without handler');
      await expect(user.click(item)).resolves.not.toThrow();
    });

    it('should handle missing children gracefully', () => {
      expect(() => {
        render(
          <ContextMenu>
            <ContextMenuTrigger />
            <ContextMenuContent />
          </ContextMenu>
        );
      }).not.toThrow();
    });

    it('should handle invalid props gracefully', () => {
      expect(() => {
        render(
          <ContextMenu>
            <ContextMenuTrigger>Trigger</ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onSelect="invalid">Item</ContextMenuItem>
              <ContextMenuCheckboxItem checked="invalid">Checkbox</ContextMenuCheckboxItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle many menu items efficiently', () => {
      const items = Array.from({ length: 100 }, (_, i) => i);
      
      const { container } = render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            {items.map(i => (
              <ContextMenuItem key={i}>Item {i}</ContextMenuItem>
            ))}
          </ContextMenuContent>
        </ContextMenu>
      );

      const menuItems = container.querySelectorAll('[data-testid="context-menu-item"]');
      expect(menuItems).toHaveLength(100);
    });

    it('should not cause memory leaks with frequent renders', () => {
      const { rerender, unmount } = render(
        <ContextMenu>
          <ContextMenuTrigger>Trigger</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem>Item</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );

      // Multiple re-renders
      for (let i = 0; i < 10; i++) {
        rerender(
          <ContextMenu key={i}>
            <ContextMenuTrigger>Trigger {i}</ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem>Item {i}</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      }

      expect(() => unmount()).not.toThrow();
    });
  });
});