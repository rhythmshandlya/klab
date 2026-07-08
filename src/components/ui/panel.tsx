import { type HTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Panel — the primary surface for the workspace columns. A bordered container with
 * an optional labeled header (small, uppercase, letter-spaced) and a right-aligned
 * actions slot. Mirrors the "INCIDENT BRIEF" / "CLUSTER EXPLORER" headers in the
 * reference layouts.
 */
export function Panel({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section
      className={cn(
        "border-border bg-panel flex min-h-0 flex-col overflow-hidden rounded-lg border",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  icon,
  actions,
  className,
}: {
  title: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "border-border flex h-10 shrink-0 items-center justify-between gap-2 border-b px-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {icon ? <span className="text-subtle [&_svg]:size-3.5">{icon}</span> : null}
        <span className="text-subtle truncate text-[11px] font-semibold tracking-[0.08em] uppercase">
          {title}
        </span>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </header>
  );
}

export function PanelBody({
  className,
  scroll = true,
  ...props
}: HTMLAttributes<HTMLDivElement> & { scroll?: boolean }) {
  return (
    <div className={cn("min-h-0 flex-1 p-3", scroll && "overflow-y-auto", className)} {...props} />
  );
}
