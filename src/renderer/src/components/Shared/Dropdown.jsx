"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { CircleIcon, CaretRightIcon, CheckIcon } from "@phosphor-icons/react";
import clsx from "clsx";

import "@assets/styles/components/Dropdown.scss";

function DropdownMenu({ ...props }) {
  return <DropdownMenuPrimitive.Root {...props} />;
}

function DropdownMenuPortal({ ...props }) {
  return <DropdownMenuPrimitive.Portal {...props} />;
}

function DropdownMenuTrigger({ ...props }) {
  return <DropdownMenuPrimitive.Trigger {...props} />;
}

function DropdownMenuContent({ className, sideOffset = 4, ...props }) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content sideOffset={sideOffset} className={clsx("dropdownMenuContent", className)} {...props} />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuGroup({ ...props }) {
  return <DropdownMenuPrimitive.Group side="bottom" {...props} />;
}

function DropdownMenuItem({ className, inset, variant = "default", ...props }) {
  return (
    <DropdownMenuPrimitive.Item
      data-inset={inset}
      data-variant={variant}
      className={clsx("dropdownMenuItem", className)}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({ className, children, checked, ...props }) {
  return (
    <DropdownMenuPrimitive.CheckboxItem className={clsx("dropdownMenuCheckboxItem", className)} checked={checked} {...props}>
      <span className="indicator">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon weight="bold" size={16} aria-label="Check" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup({ ...props }) {
  return <DropdownMenuPrimitive.RadioGroup {...props} />;
}

function DropdownMenuRadioItem({ className, children, ...props }) {
  return (
    <DropdownMenuPrimitive.RadioItem className={clsx("dropdownMenuRadioItem", className)} {...props}>
      <span className="indicator">
        <DropdownMenuPrimitive.ItemIndicator>
          <CircleIcon weight="bold" size={16} aria-label="CircleIcon" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

function DropdownMenuLabel({ className, inset, ...props }) {
  return <DropdownMenuPrimitive.Label data-inset={inset} className={clsx("dropdownMenuLabel", className)} {...props} />;
}

function DropdownMenuSeparator({ className, ...props }) {
  return <DropdownMenuPrimitive.Separator className={clsx("dropdownMenuSeparator", className)} {...props} />;
}

function DropdownMenuShortcut({ className, ...props }) {
  return <span className={clsx("dropdownMenuShortcut", className)} {...props} />;
}

function DropdownMenuSub({ ...props }) {
  return <DropdownMenuPrimitive.Sub {...props} />;
}

function DropdownMenuSubTrigger({ className, inset, children, ...props }) {
  return (
    <DropdownMenuPrimitive.SubTrigger data-inset={inset} className={clsx("dropdownMenuSubTrigger", className)} {...props}>
      {children}
      <CaretRightIcon weight="fill" size={16} aria-label="Caret Right" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

function DropdownMenuSubContent({ className, ...props }) {
  return <DropdownMenuPrimitive.SubContent className={clsx("dropdownMenuSubContent", className)} {...props} />;
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
