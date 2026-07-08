import { type HTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

/** Loading placeholder. Respects reduced-motion (pulse is disabled globally). */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("bg-panel-hover animate-pulse rounded-md", className)}
      {...props}
    />
  );
}
