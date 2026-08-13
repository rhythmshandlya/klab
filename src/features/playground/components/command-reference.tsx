"use client";

import { useEffect, useState } from "react";

import { icons } from "@/components/icons";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { COMMAND_REFERENCE, type CommandReferenceEntry } from "@/lib/kube/command-runner";

const CATEGORIES: CommandReferenceEntry["category"][] = [
  "Read",
  "Change",
  "Debug",
  "Network",
  "Shell",
];

/** Searchable command reference powered by shadcn's cmdk-based Command palette. */
export function CommandReference() {
  const [open, setOpen] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const copy = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(command);
      window.setTimeout(
        () => setCopiedCommand((current) => (current === command ? null : current)),
        1200,
      );
    } catch {
      /* Clipboard access is best-effort. */
    }
  };

  return (
    <>
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

      <CommandDialog open={open} onOpenChange={setOpen} title="Supported k8s commands">
        <CommandInput autoFocus placeholder="Search commands… (e.g. scale, rollout, exec)" />
        <CommandList>
          <CommandEmpty>No matching commands.</CommandEmpty>
          {CATEGORIES.map((category) => (
            <CommandGroup key={category} heading={category}>
              {COMMAND_REFERENCE.filter((entry) => entry.category === category).map((entry) => (
                <CommandItem
                  key={entry.command}
                  value={`${entry.command} ${entry.description}`}
                  onSelect={() => void copy(entry.command)}
                  className="group flex-col items-stretch gap-0.5"
                >
                  <span className="flex w-full items-center gap-2">
                    <code className="text-blue min-w-0 flex-1 truncate font-mono text-xs">
                      {entry.command}
                    </code>
                    <CommandShortcut className="opacity-0 transition-opacity group-hover:opacity-100 group-data-[selected=true]:opacity-100">
                      {copiedCommand === entry.command ? "Copied!" : "Copy"}
                    </CommandShortcut>
                  </span>
                  <span className="text-subtle w-full text-[11px]">{entry.description}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
        <div className="border-border text-subtle shrink-0 border-t px-3 py-2 text-[10px]">
          Select a command to copy it, then paste into the terminal. Flags:{" "}
          <code className="font-mono">-n</code>, <code className="font-mono">-A</code>,{" "}
          <code className="font-mono">-l</code>, <code className="font-mono">-o yaml|wide</code>
        </div>
      </CommandDialog>
    </>
  );
}
