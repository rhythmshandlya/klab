"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from "react";

import { icons } from "@/components/icons";
import { cn } from "@/lib/utils/cn";

export const Command = forwardRef<
  ElementRef<typeof CommandPrimitive>,
  ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "bg-panel text-foreground flex h-full w-full flex-col overflow-hidden",
      className,
    )}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

export function CommandDialog({
  children,
  title = "Command palette",
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Root> & {
  children: ReactNode;
  title?: string;
}) {
  return (
    <DialogPrimitive.Root {...props}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="anim-overlay fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="anim-content border-border-strong bg-panel fixed top-[10%] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-lg border shadow-[0_24px_64px_-16px_rgb(0_0_0/0.8)]"
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <Command>{children}</Command>
          <DialogPrimitive.Close
            aria-label="Close command palette"
            className="text-subtle hover:bg-panel-hover hover:text-foreground absolute top-2.5 right-2.5 z-10 rounded p-1 transition-colors"
          >
            <icons.close className="size-4" aria-hidden />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const CommandInput = forwardRef<
  ElementRef<typeof CommandPrimitive.Input>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="border-border flex items-center border-b px-3" cmdk-input-wrapper="">
    <icons.search className="text-subtle mr-2 size-4 shrink-0" aria-hidden />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "placeholder:text-subtle h-11 w-full min-w-0 bg-transparent pr-8 text-sm outline-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = CommandPrimitive.Input.displayName;

export const CommandList = forwardRef<
  ElementRef<typeof CommandPrimitive.List>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-[min(32rem,65dvh)] overflow-x-hidden overflow-y-auto p-2", className)}
    {...props}
  />
));
CommandList.displayName = CommandPrimitive.List.displayName;

export const CommandEmpty = forwardRef<
  ElementRef<typeof CommandPrimitive.Empty>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty ref={ref} className="text-subtle py-8 text-center text-sm" {...props} />
));
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

export const CommandGroup = forwardRef<
  ElementRef<typeof CommandPrimitive.Group>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "text-foreground [&_[cmdk-group-heading]]:text-subtle overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.1em] [&_[cmdk-group-heading]]:uppercase",
      className,
    )}
    {...props}
  />
));
CommandGroup.displayName = CommandPrimitive.Group.displayName;

export const CommandItem = forwardRef<
  ElementRef<typeof CommandPrimitive.Item>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "data-[selected=true]:bg-panel-hover data-[selected=true]:text-foreground relative flex cursor-default items-center rounded-md px-2 py-2 text-sm outline-none select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
      className,
    )}
    {...props}
  />
));
CommandItem.displayName = CommandPrimitive.Item.displayName;

export const CommandSeparator = forwardRef<
  ElementRef<typeof CommandPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("bg-border -mx-1 h-px", className)}
    {...props}
  />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

export function CommandShortcut({ className, ...props }: ComponentPropsWithoutRef<"span">) {
  return <span className={cn("text-subtle ml-auto shrink-0 text-[10px]", className)} {...props} />;
}
