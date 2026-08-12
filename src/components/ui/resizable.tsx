"use client";

import { useCallback, useState } from "react";
import { Group, Panel, Separator, type Layout } from "react-resizable-panels";

import { cn } from "@/lib/utils/cn";

/**
 * Themed wrappers around react-resizable-panels: draggable (and keyboard-operable:
 * the separators are WAI-ARIA `role="separator"` with arrow-key support) split panes
 * for workspace layouts. `usePersistedLayout` remembers a group's layout in
 * localStorage so a user's preferred pane sizes survive reloads.
 */

export { Group as ResizableGroup, Panel as ResizablePane };

export function ResizableHandle({
  orientation,
  "aria-label": ariaLabel,
  className,
}: {
  /** Orientation of the handle STRIP: "vertical" sits between columns, "horizontal" between rows. */
  orientation: "vertical" | "horizontal";
  "aria-label"?: string;
  className?: string;
}) {
  return (
    <Separator
      aria-label={ariaLabel}
      className={cn(
        "group relative flex shrink-0 items-center justify-center outline-none",
        orientation === "vertical" ? "w-3" : "h-3",
        className,
      )}
    >
      <span
        className={cn(
          "bg-border rounded-full transition-colors",
          "group-hover:bg-blue/60 group-active:bg-blue group-focus-visible:bg-blue",
          orientation === "vertical" ? "h-12 w-[3px]" : "h-[3px] w-12",
        )}
        aria-hidden
      />
    </Separator>
  );
}

/**
 * Load/save a Group layout under a localStorage key. Read once on mount (callers are
 * client-only components, so no SSR/hydration concerns) and saved on every completed
 * resize. Pass the result straight to <ResizableGroup>.
 */
export function usePersistedLayout(storageKey: string): {
  defaultLayout: Layout | undefined;
  onLayoutChanged: (layout: Layout) => void;
} {
  const [defaultLayout] = useState<Layout | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return undefined;
      const parsed: unknown = JSON.parse(raw);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
      const entries = Object.entries(parsed as Record<string, unknown>);
      if (!entries.every(([, value]) => typeof value === "number" && Number.isFinite(value))) {
        return undefined;
      }
      return parsed as Layout;
    } catch {
      return undefined;
    }
  });

  const onLayoutChanged = useCallback(
    (layout: Layout) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(layout));
      } catch {
        // Storage full or unavailable: layout persistence is best-effort.
      }
    },
    [storageKey],
  );

  return { defaultLayout, onLayoutChanged };
}
