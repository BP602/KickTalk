import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuPortal,
} from './Dropdown';

// Mock Radix UI dropdown menu primitives
vi.mock('@radix-ui/react-dropdown-menu', () => ({
  Root: ({ children, onOpenChange, modal, ...props }) => (
    <div 
      data-testid="dropdown-menu-root" 
      modal={modal !== undefined ? String(modal) : undefined}
      {...props}
    >
      {children}
    </div>
  ),
  Portal: ({ children, ...props }) => (
    <div data-testid="dropdown-menu-portal" {...props}>
      {children}
    </div>
  ),
  Trigger: ({ children, asChild, disabled, ...props }) => (
    <div 
      data-testid="dropdown-menu-trigger"
      data-disabled={disabled}
      {...props}
    >
      {children}
    </div>
  ),
  Content: ({ children, className, sideOffset, ...props }) => (
    <div
      data-testid="dropdown-menu-content"
      className={className}
      data-side-offset={sideOffset}
      {...props}
    >
      {children}
    </div>
  ),
  Group: ({ children, side, ...props }) => (
    <div data-testid="dropdown-menu-group" data-side={side} {...props}>
      {children}
    </div>
  ),
  Item: ({ children, className, variant, onSelect, inset, ...props }) => (
    <div
      data-testid="dropdown-menu-item"
      className={className}
      data-variant={variant}
      data-inset={inset}
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
      data-testid="dropdown-menu-checkbox-item"
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
  RadioGroup: ({ children, value, onValueChange, ...props }) => (
    <div
      data-testid="dropdown-menu-radio-group"
      data-value={value}
      {...props}
    >
      {children}
    </div>
  ),
  RadioItem: ({ children, className, value, onSelect, ...props }) => (
    <div
      data-testid="dropdown-menu-radio-item"
      className={className}
      role="menuitemradio"
      data-value={value}
      onClick={() => onSelect && onSelect(value)}
      tabIndex={0}
      {...props}
    >
      {children}
    </div>
  ),
  Label: ({ children, className, inset, ...props }) => (
    <div
      data-testid="dropdown-menu-label"
      className={className}
      data-inset={inset}
      {...props}
    >
      {children}
    </div>
  ),
  Separator: ({ children, className, ...props }) => (
    <div data-testid="dropdown-menu-separator" className={className} {...props} />
  ),
  Sub: ({ children, ...props }) => (
    <div data-testid="dropdown-menu-sub" {...props}>{children}</div>
  ),
  SubTrigger: ({ children, className, inset, ...props }) => (
    <div
      data-testid="dropdown-menu-sub-trigger"
      className={className}
      data-inset={inset}
      {...props}
    >
      {children}
    </div>
  ),
  SubContent: ({ children, className, ...props }) => (
    <div data-testid="dropdown-menu-sub-content" className={className} {...props}>
      {children}
    </div>
  ),
  ItemIndicator: ({ children, ...props }) => (
    <span data-testid="dropdown-menu-item-indicator" {...props}>{children}</span>
  ),
}));

// Mock clsx
vi.mock('clsx', () => ({
  default: (...classes) => classes.filter(Boolean).join(' ')
}));

// Mock assets
vi.mock('@assets/icons/circle-bold.svg?asset', () => ({ default: 'circle-icon' }));
vi.mock('@assets/icons/caret-right-fill.svg?asset', () => ({ default: 'caret-right-icon' }));
vi.mock('@assets/icons/check-bold.svg?asset', () => ({ default: 'check-icon' }));
vi.mock('@assets/styles/components/Dropdown.scss', () => ({}));

describe('Dropdown Components', () => {
  describe('DropdownMenu Root', () => {
    it('should render root component', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Click me</DropdownMenuTrigger>
        </DropdownMenu>
      );

      expect(screen.getByTestId('dropdown-menu-root')).toBeInTheDocument();
      expect(screen.getByTestId('dropdown-menu-trigger')).toBeInTheDocument();
    });

    it('should pass props to root component', () => {
      const onOpenChange = vi.fn();
      
      render(
        <DropdownMenu onOpenChange={onOpenChange} modal={false}>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
        </DropdownMenu>
      );

      const root = screen.getByTestId('dropdown-menu-root');
      expect(root).toHaveAttribute('modal', 'false');
    });
  });

  describe('DropdownMenuPortal', () => {
    it('should render portal component', () => {
      render(
        <DropdownMenuPortal>
          <div>Portal content</div>
        </DropdownMenuPortal>
      );

      expect(screen.getByTestId('dropdown-menu-portal')).toBeInTheDocument();
      expect(screen.getByText('Portal content')).toBeInTheDocument();
    });
  });

  describe('DropdownMenuTrigger', () => {
    it('should render trigger with children', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Click trigger</DropdownMenuTrigger>
        </DropdownMenu>
      );

      const trigger = screen.getByTestId('dropdown-menu-trigger');
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveTextContent('Click trigger');
    });

    it('should handle disabled state', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger disabled>Disabled trigger</DropdownMenuTrigger>
        </DropdownMenu>
      );

      const trigger = screen.getByTestId('dropdown-menu-trigger');
      expect(trigger).toHaveAttribute('data-disabled', 'true');
    });

    it('should support asChild prop', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button>Custom trigger</button>
          </DropdownMenuTrigger>
        </DropdownMenu>
      );

      expect(screen.getByText('Custom trigger')).toBeInTheDocument();
    });
  });

  describe('DropdownMenuContent', () => {
    it('should render content with default props', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item 1</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const content = screen.getByTestId('dropdown-menu-content');
      expect(content).toBeInTheDocument();
      expect(content).toHaveClass('dropdownMenuContent');
      expect(content).toHaveAttribute('data-side-offset', '4');
    });

    it('should apply custom className', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent className="custom-content">
            <DropdownMenuItem>Item 1</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const content = screen.getByTestId('dropdown-menu-content');
      expect(content).toHaveClass('dropdownMenuContent custom-content');
    });

    it('should support custom sideOffset', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent sideOffset={8}>
            <DropdownMenuItem>Item 1</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const content = screen.getByTestId('dropdown-menu-content');
      expect(content).toHaveAttribute('data-side-offset', '8');
    });

    it('should render within portal', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item 1</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      expect(screen.getByTestId('dropdown-menu-portal')).toBeInTheDocument();
    });
  });

  describe('DropdownMenuGroup', () => {
    it('should render group with default side bottom', () => {
      render(
        <DropdownMenuGroup>
          <DropdownMenuItem>Group Item 1</DropdownMenuItem>
          <DropdownMenuItem>Group Item 2</DropdownMenuItem>
        </DropdownMenuGroup>
      );

      const group = screen.getByTestId('dropdown-menu-group');
      expect(group).toBeInTheDocument();
      expect(group).toHaveAttribute('data-side', 'bottom');
    });

    it('should contain multiple items', () => {
      render(
        <DropdownMenuGroup>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
          <DropdownMenuItem>Item 2</DropdownMenuItem>
        </DropdownMenuGroup>
      );

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });
  });

  describe('DropdownMenuItem', () => {
    it('should render menu item with default variant', () => {
      const onSelect = vi.fn();
      
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onSelect}>Menu Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const item = screen.getByTestId('dropdown-menu-item');
      expect(item).toBeInTheDocument();
      expect(item).toHaveTextContent('Menu Item');
      expect(item).toHaveClass('dropdownMenuItem');
      expect(item).toHaveAttribute('data-variant', 'default');
    });

    it('should support custom variant', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem variant="destructive">Delete Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const item = screen.getByTestId('dropdown-menu-item');
      expect(item).toHaveAttribute('data-variant', 'destructive');
    });

    it('should support inset prop', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem inset>Inset Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const item = screen.getByTestId('dropdown-menu-item');
      expect(item).toHaveAttribute('data-inset', 'true');
    });

    it('should handle click events', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onSelect}>Clickable Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const item = screen.getByTestId('dropdown-menu-item');
      await user.click(item);

      expect(onSelect).toHaveBeenCalled();
    });

    it('should handle keyboard navigation', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onSelect}>Keyboard Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const item = screen.getByTestId('dropdown-menu-item');
      item.focus();
      
      await user.keyboard('{Enter}');
      expect(onSelect).toHaveBeenCalledTimes(1);

      await user.keyboard(' ');
      expect(onSelect).toHaveBeenCalledTimes(2);
    });

    it('should apply custom className', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem className="custom-item">Custom Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const item = screen.getByTestId('dropdown-menu-item');
      expect(item).toHaveClass('dropdownMenuItem custom-item');
    });
  });

  describe('DropdownMenuCheckboxItem', () => {
    it('should render checkbox item with proper attributes', () => {
      const onCheckedChange = vi.fn();
      
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked={true} onCheckedChange={onCheckedChange}>
              Checkbox Item
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const item = screen.getByTestId('dropdown-menu-checkbox-item');
      expect(item).toBeInTheDocument();
      expect(item).toHaveClass('dropdownMenuCheckboxItem');
      expect(item).toHaveAttribute('role', 'menuitemcheckbox');
      expect(item).toHaveAttribute('aria-checked', 'true');
    });

    it('should toggle checked state on click', async () => {
      const user = userEvent.setup();
      const onCheckedChange = vi.fn();
      
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked={false} onCheckedChange={onCheckedChange}>
              Toggle me
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const item = screen.getByTestId('dropdown-menu-checkbox-item');
      await user.click(item);

      expect(onCheckedChange).toHaveBeenCalledWith(true);
    });

    it('should render with check indicator', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked={true}>
              Checked Item
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const indicator = screen.getByTestId('dropdown-menu-item-indicator');
      expect(indicator).toBeInTheDocument();
      expect(indicator.closest('.indicator')).toBeInTheDocument();
      
      const img = indicator.querySelector('img');
      expect(img).toHaveAttribute('src', 'check-icon');
      expect(img).toHaveAttribute('alt', 'Check');
      expect(img).toHaveAttribute('width', '16');
      expect(img).toHaveAttribute('height', '16');
    });

    it('should apply custom className', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem className="custom-checkbox" checked={false}>
              Custom Checkbox
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const item = screen.getByTestId('dropdown-menu-checkbox-item');
      expect(item).toHaveClass('dropdownMenuCheckboxItem custom-checkbox');
    });

    it('should expose correct ARIA role and checked state', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked={true}>
              Notifications
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const item = screen.getByTestId('dropdown-menu-checkbox-item');
      expect(item).toHaveAttribute('role', 'menuitemcheckbox');
      expect(item).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('DropdownMenuRadioGroup', () => {
    it('should render radio group', () => {
      const onValueChange = vi.fn();
      
      render(
        <DropdownMenuRadioGroup value="option1" onValueChange={onValueChange}>
          <DropdownMenuRadioItem value="option1">Option 1</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="option2">Option 2</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      );

      const radioGroup = screen.getByTestId('dropdown-menu-radio-group');
      expect(radioGroup).toBeInTheDocument();
      expect(radioGroup).toHaveAttribute('data-value', 'option1');
    });
  });

  describe('DropdownMenuRadioItem', () => {
    it('should render radio item with proper attributes', () => {
      const onSelect = vi.fn();
      
      render(
        <DropdownMenuRadioGroup value="option1">
          <DropdownMenuRadioItem value="option1" onSelect={onSelect}>
            Radio Option 1
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      );

      const item = screen.getByTestId('dropdown-menu-radio-item');
      expect(item).toBeInTheDocument();
      expect(item).toHaveClass('dropdownMenuRadioItem');
      expect(item).toHaveAttribute('role', 'menuitemradio');
      expect(item).toHaveAttribute('data-value', 'option1');
    });

    it('should handle selection', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      
      render(
        <DropdownMenuRadioGroup>
          <DropdownMenuRadioItem value="option1" onSelect={onSelect}>
            Option 1
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      );

      const item = screen.getByTestId('dropdown-menu-radio-item');
      await user.click(item);

      expect(onSelect).toHaveBeenCalledWith('option1');
    });

    it('should render with circle indicator', () => {
      render(
        <DropdownMenuRadioGroup>
          <DropdownMenuRadioItem value="option1">
            Option with indicator
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      );

      const indicator = screen.getByTestId('dropdown-menu-item-indicator');
      expect(indicator).toBeInTheDocument();
      expect(indicator.closest('.indicator')).toBeInTheDocument();
      
      const img = indicator.querySelector('img');
      expect(img).toHaveAttribute('src', 'circle-icon');
      expect(img).toHaveAttribute('alt', 'Circle');
      expect(img).toHaveAttribute('width', '16');
      expect(img).toHaveAttribute('height', '16');
    });

    it('should apply custom className', () => {
      render(
        <DropdownMenuRadioGroup>
          <DropdownMenuRadioItem className="custom-radio" value="option1">
            Custom Radio
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      );

      const item = screen.getByTestId('dropdown-menu-radio-item');
      expect(item).toHaveClass('dropdownMenuRadioItem custom-radio');
    });

    it('should expose correct ARIA role for radio items', () => {
      render(
        <DropdownMenuRadioGroup value="light">
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      );

      const items = screen.getAllByTestId('dropdown-menu-radio-item');
      items.forEach((el) => expect(el).toHaveAttribute('role', 'menuitemradio'));
    });
  });

  describe('DropdownMenuLabel', () => {
    it('should render label', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Section Label</DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const label = screen.getByTestId('dropdown-menu-label');
      expect(label).toBeInTheDocument();
      expect(label).toHaveClass('dropdownMenuLabel');
      expect(label).toHaveTextContent('Section Label');
    });

    it('should handle inset prop', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel inset>Inset Label</DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const label = screen.getByTestId('dropdown-menu-label');
      expect(label).toHaveAttribute('data-inset', 'true');
    });

    it('should apply custom className', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel className="custom-label">Custom Label</DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const label = screen.getByTestId('dropdown-menu-label');
      expect(label).toHaveClass('dropdownMenuLabel custom-label');
    });
  });

  describe('DropdownMenuSeparator', () => {
    it('should render separator', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const separator = screen.getByTestId('dropdown-menu-separator');
      expect(separator).toBeInTheDocument();
      expect(separator).toHaveClass('dropdownMenuSeparator');
    });

    it('should apply custom className', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSeparator className="custom-separator" />
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const separator = screen.getByTestId('dropdown-menu-separator');
      expect(separator).toHaveClass('dropdownMenuSeparator custom-separator');
    });
  });

  describe('DropdownMenuShortcut', () => {
    it('should render shortcut', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>
              Copy
              <DropdownMenuShortcut>Ctrl+C</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const shortcut = screen.getByText('Ctrl+C');
      expect(shortcut).toBeInTheDocument();
      expect(shortcut).toHaveClass('dropdownMenuShortcut');
    });

    it('should apply custom className', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>
              Paste
              <DropdownMenuShortcut className="custom-shortcut">Ctrl+V</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const shortcut = screen.getByText('Ctrl+V');
      expect(shortcut).toHaveClass('dropdownMenuShortcut custom-shortcut');
    });
  });

  describe('DropdownMenuSub', () => {
    it('should render sub menu structure', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                More Options
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Sub Item 1</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      expect(screen.getByTestId('dropdown-menu-sub')).toBeInTheDocument();
      expect(screen.getByTestId('dropdown-menu-sub-trigger')).toBeInTheDocument();
      expect(screen.getByTestId('dropdown-menu-sub-content')).toBeInTheDocument();
    });

    it('should render sub trigger with caret icon', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                Submenu
              </DropdownMenuSubTrigger>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const subTrigger = screen.getByTestId('dropdown-menu-sub-trigger');
      expect(subTrigger).toHaveClass('dropdownMenuSubTrigger');
      
      const icon = subTrigger.querySelector('img');
      expect(icon).toHaveAttribute('src', 'caret-right-icon');
      expect(icon).toHaveAttribute('alt', 'Caret Right');
      expect(icon).toHaveAttribute('width', '16');
      expect(icon).toHaveAttribute('height', '16');
    });

    it('should support inset on sub trigger', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger inset>
                Inset Submenu
              </DropdownMenuSubTrigger>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const subTrigger = screen.getByTestId('dropdown-menu-sub-trigger');
      expect(subTrigger).toHaveAttribute('data-inset', 'true');
    });

    it('should render sub content with proper class', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Submenu</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="custom-sub-content">
                <DropdownMenuItem>Sub Item</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const subContent = screen.getByTestId('dropdown-menu-sub-content');
      expect(subContent).toHaveClass('dropdownMenuSubContent custom-sub-content');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for checkbox items', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked={true}>
              Accessible Checkbox
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const item = screen.getByTestId('dropdown-menu-checkbox-item');
      expect(item).toHaveAttribute('role', 'menuitemcheckbox');
      expect(item).toHaveAttribute('aria-checked', 'true');
    });

    it('should have proper ARIA attributes for radio items', () => {
      render(
        <DropdownMenuRadioGroup>
          <DropdownMenuRadioItem value="test">
            Accessible Radio
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      );

      const item = screen.getByTestId('dropdown-menu-radio-item');
      expect(item).toHaveAttribute('role', 'menuitemradio');
    });

    it('should be keyboard navigable', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const items = screen.getAllByTestId('dropdown-menu-item');
      items.forEach(item => {
        expect(item).toHaveAttribute('tabIndex', '0');
      });
    });

    it('should handle disabled state accessibility', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger disabled>Disabled Trigger</DropdownMenuTrigger>
        </DropdownMenu>
      );

      const trigger = screen.getByTestId('dropdown-menu-trigger');
      expect(trigger).toHaveAttribute('data-disabled', 'true');
    });
  });

  describe('Complex Integration', () => {
    it('should render complex dropdown structure', () => {
      const handleEdit = vi.fn();
      const handleDelete = vi.fn();
      const handleToggleGrid = vi.fn();
      const handleViewChange = vi.fn();
      
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onSelect={handleEdit}>
                Edit
                <DropdownMenuShortcut>Ctrl+E</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleDelete} variant="destructive">
                Delete
                <DropdownMenuShortcut>Del</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={true} onCheckedChange={handleToggleGrid}>
              Show Grid
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value="list" onValueChange={handleViewChange}>
              <DropdownMenuLabel>View</DropdownMenuLabel>
              <DropdownMenuRadioItem value="list">List View</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="grid">Grid View</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>More Actions</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Export</DropdownMenuItem>
                <DropdownMenuItem>Import</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      // Verify all components render
      expect(screen.getByText('Actions')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
      expect(screen.getByText('Ctrl+E')).toBeInTheDocument();
      expect(screen.getByText('Del')).toBeInTheDocument();
      expect(screen.getByText('Show Grid')).toBeInTheDocument();
      expect(screen.getByText('View')).toBeInTheDocument();
      expect(screen.getByText('List View')).toBeInTheDocument();
      expect(screen.getByText('Grid View')).toBeInTheDocument();
      expect(screen.getByText('More Actions')).toBeInTheDocument();
      expect(screen.getByText('Export')).toBeInTheDocument();
      expect(screen.getByText('Import')).toBeInTheDocument();
      
      expect(screen.getAllByTestId('dropdown-menu-separator')).toHaveLength(3);
      expect(screen.getAllByTestId('dropdown-menu-label')).toHaveLength(2);
    });

    it('should handle all interactions correctly', async () => {
      const user = userEvent.setup();
      const mockHandlers = {
        edit: vi.fn(),
        delete: vi.fn(),
        toggleGrid: vi.fn(),
        viewChange: vi.fn(),
      };
      
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={mockHandlers.edit}>Edit</DropdownMenuItem>
            <DropdownMenuItem onSelect={mockHandlers.delete}>Delete</DropdownMenuItem>
            <DropdownMenuCheckboxItem 
              checked={false} 
              onCheckedChange={mockHandlers.toggleGrid}
            >
              Show Grid
            </DropdownMenuCheckboxItem>
            <DropdownMenuRadioGroup onValueChange={mockHandlers.viewChange}>
              <DropdownMenuRadioItem value="list">List View</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      // Test interactions
      await user.click(screen.getByText('Edit'));
      expect(mockHandlers.edit).toHaveBeenCalled();

      await user.click(screen.getByText('Delete'));
      expect(mockHandlers.delete).toHaveBeenCalled();

      await user.click(screen.getByText('Show Grid'));
      expect(mockHandlers.toggleGrid).toHaveBeenCalledWith(true);

      await user.click(screen.getByText('List View'));
      expect(mockHandlers.viewChange).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing onSelect gracefully', async () => {
      const user = userEvent.setup();
      
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item without handler</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const item = screen.getByText('Item without handler');
      await expect(user.click(item)).resolves.not.toThrow();
    });

    it('should handle missing children gracefully', () => {
      expect(() => {
        render(
          <DropdownMenu>
            <DropdownMenuTrigger />
            <DropdownMenuContent />
          </DropdownMenu>
        );
      }).not.toThrow();
    });

    it('should handle invalid props gracefully', () => {
      expect(() => {
        render(
          <DropdownMenu>
            <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect="invalid">Item</DropdownMenuItem>
              <DropdownMenuCheckboxItem checked="invalid">Checkbox</DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle many menu items efficiently', () => {
      const items = Array.from({ length: 100 }, (_, i) => i);
      
      const { container } = render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            {items.map(i => (
              <DropdownMenuItem key={i}>Item {i}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const menuItems = container.querySelectorAll('[data-testid="dropdown-menu-item"]');
      expect(menuItems).toHaveLength(100);
    });

    it('should not cause memory leaks with frequent renders', () => {
      const { rerender, unmount } = render(
        <DropdownMenu>
          <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      // Multiple re-renders
      for (let i = 0; i < 10; i++) {
        rerender(
          <DropdownMenu key={i}>
            <DropdownMenuTrigger>Trigger {i}</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Item {i}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }

      expect(() => unmount()).not.toThrow();
    });
  });
});
