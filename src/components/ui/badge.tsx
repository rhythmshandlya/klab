import { cva, type VariantProps } from "class-variance-authority";
import { type HTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium [&_svg]:size-3.5",
  {
    variants: {
      /**
       * Tone is paired with an icon or text label at the call site — color is never
       * the sole status indicator (accessibility rule).
       */
      tone: {
        neutral: "border-border bg-panel-elevated text-muted",
        info: "border-blue/30 bg-blue/10 text-blue",
        success: "border-green/30 bg-green/10 text-green",
        warning: "border-amber/30 bg-amber/10 text-amber",
        danger: "border-red/30 bg-red/10 text-red",
        achievement: "border-purple/30 bg-purple/10 text-purple",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { badgeVariants };
