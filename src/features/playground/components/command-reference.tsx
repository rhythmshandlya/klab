"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";

import { icons } from "@/components/icons";
import { Kbd } from "@/components/ui/kbd";
import { COMMAND_REFERENCE, type CommandReferenceEntry } from "@/lib/kube/command-runner";

const CATEGORIES: CommandReferenceEntry["category"][] = [
  "Read",
  "Change",
  "Debug",
  "Network",
  "Shell",
];

/**
 * Searchable reference of every command the simulated shell supports, opened with
 * Ctrl/⌘+K anywhere in the playground or from the sidebar button. Clicking a row
 * copies the command so it can be pasted straight into the terminal.
 */
export function CommandReference() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = COMMAND_REFERENCE.filter(
      (entry) =>
        q === "" ||
        entry.command.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q),
    );
    return CATEGORIES.map((category) => ({
      category,
      entries: matches.filter((entry) => entry.category === category),
    })).filter((group) => group.entries.length > 0);
  }, [query]);

  const copy = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(command);
      setTimeout(() => setCopiedCommand((current) => (current === command ? null : current)), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <>
      {/* Trigger follows the sidebar's list-row idiom (same as template links). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted hover:bg-panel-hover hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
      >
        <icons.terminal className="text-subtle size-3.5" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-left">All k8s commands</span>
        <span className="flex shrink-0 items-center gap-0.5">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
          <Dialog.Content
            aria-describedby={undefined}
            className="anim-content border-border-strong bg-panel fixed top-[8%] left-1/2 z-50 flex max-h-[80dvh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 flex-col overflow-hidden rounded-lg border shadow-[0_24px_64px_-16px_rgb(0_0_0/0.8)]"
          >
            <Dialog.Title className="sr-only">Supported k8s commands</Dialog.Title>
            <div className="border-border flex shrink-0 items-center gap-2 border-b px-3 py-2.5">
              <icons.search className="text-subtle size-4 shrink-0" aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands… (e.g. scale, rollout, exec)"
                className="text-foreground placeholder:text-subtle min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className="text-subtle hover:text-foreground rounded p-1"
                >
                  <icons.close className="size-4" aria-hidden />
                </button>
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {groups.length === 0 ? (
                <p className="text-subtle p-4 text-center text-xs">
                  No commands match &quot;{query}&quot;.
                </p>
              ) : (
                groups.map((group) => (
                  <div key={group.category} className="mb-2">
                    <p className="text-subtle px-2 py-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase">
                      {group.category}
                    </p>
                    <ul>
                      {group.entries.map((entry) => (
                        <li key={entry.command}>
                          <button
                            type="button"
                            onClick={() => void copy(entry.command)}
                            title="Click to copy"
                            className="hover:bg-panel-hover group flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors"
                          >
                            <span className="flex w-full items-center gap-2">
                              <code className="text-blue min-w-0 flex-1 truncate font-mono text-xs">
                                {entry.command}
                              </code>
                              <span className="text-subtle shrink-0 text-[10px] opacity-0 transition-opacity group-hover:opacity-100">
                                {copiedCommand === entry.command ? "Copied!" : "Copy"}
                              </span>
                            </span>
                            <span className="text-subtle text-[11px]">{entry.description}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
            <div className="border-border text-subtle shrink-0 border-t px-3 py-2 text-[10px]">
              Click a command to copy it, then paste into the terminal. Flags:{" "}
              <code className="font-mono">-n</code>, <code className="font-mono">-A</code>,{" "}
              <code className="font-mono">-l</code>, <code className="font-mono">-o yaml|wide</code>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
