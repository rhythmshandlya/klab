"use client";

import { useState } from "react";

import { icons } from "@/components/icons";
import { cn } from "@/lib/utils/cn";

/**
 * Copy-to-clipboard affordance for docs code blocks. Sits in the top-right of a code
 * panel; shows a transient "Copied" state. Silently no-ops if the Clipboard API is
 * unavailable (e.g. non-secure context) rather than throwing.
 */
export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable: nothing to do.
    }
  };

  const Icon = copied ? icons.success : icons.diff;
  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={copied ? "Copied" : "Copy code"}
      className={cn(
        "text-subtle hover:text-foreground hover:bg-panel-hover flex items-center gap-1 rounded border border-transparent px-1.5 py-1 text-[11px] transition-colors",
        copied && "text-green",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
