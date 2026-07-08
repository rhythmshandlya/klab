import { type HTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

/** Renders a keyboard shortcut chip, e.g. <Kbd>⌘</Kbd><Kbd>K</Kbd>. */
export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "border-border bg-panel-elevated text-muted inline-flex h-5 min-w-5 items-center justify-center rounded border px-1.5 font-mono text-[10px] font-medium",
        className,
      )}
      {...props}
    />
  );
}
