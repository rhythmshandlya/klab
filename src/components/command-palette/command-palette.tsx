"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { type ComponentType, useCallback } from "react";

import { icons, type IconName } from "@/components/icons";

interface PaletteCommand {
  id: string;
  label: string;
  icon: IconName;
  keywords?: string[];
  run: (router: ReturnType<typeof useRouter>) => void;
}

interface PaletteGroup {
  heading: string;
  items: PaletteCommand[];
}

const go =
  (href: string): PaletteCommand["run"] =>
  (router) =>
    router.push(href);

const COMMAND_GROUPS: PaletteGroup[] = [
  {
    heading: "Navigate",
    items: [
      { id: "nav-problems", label: "Go to Problems", icon: "problems", run: go("/problems") },
      {
        id: "nav-playground",
        label: "Go to Playground",
        icon: "playground",
        run: go("/playground"),
      },
      { id: "nav-docs", label: "Go to Docs", icon: "docs", run: go("/docs") },
      { id: "nav-progress", label: "Go to Progress", icon: "trophy", run: go("/progress") },
    ],
  },
  {
    heading: "Jump to level",
    items: [
      {
        id: "level-readiness",
        label: "Broken Readiness Probe",
        icon: "problems",
        keywords: ["level", "probe", "readiness", "503"],
        run: go("/problems/broken-readiness-probe"),
      },
    ],
  },
  {
    heading: "Playground templates",
    items: [
      {
        id: "tmpl-deploy-svc",
        label: "Open: Deployment + Service",
        icon: "deployment",
        keywords: ["template", "sandbox"],
        run: go("/playground/deployment-service"),
      },
    ],
  },
  {
    heading: "Docs",
    items: [
      {
        id: "docs-desired-state",
        label: "Desired vs Actual State",
        icon: "docsInteractive",
        keywords: ["reconcile", "control loop"],
        run: go("/docs/foundations/desired-vs-actual-state"),
      },
    ],
  },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  const onSelect = useCallback(
    (command: PaletteCommand) => {
      onOpenChange(false);
      command.run(router);
    },
    [onOpenChange, router],
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          className="anim-content border-border-strong bg-panel-elevated fixed top-[20%] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border shadow-[0_16px_48px_-12px_rgb(0_0_0/0.7)]"
          aria-label="Command palette"
        >
          <Dialog.Title asChild>
            <VisuallyHidden>Command palette</VisuallyHidden>
          </Dialog.Title>
          <Command
            loop
            className="[&_[cmdk-input-wrapper]]:border-border [&_[cmdk-input-wrapper]]:border-b"
          >
            <CommandInput />
            <Command.List className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
              <Command.Empty className="text-subtle py-8 text-center text-sm">
                No matching commands.
              </Command.Empty>
              {COMMAND_GROUPS.map((group) => (
                <Command.Group
                  key={group.heading}
                  heading={group.heading}
                  className="[&_[cmdk-group-heading]]:text-subtle mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:uppercase"
                >
                  {group.items.map((command) => (
                    <PaletteItem key={command.id} command={command} onSelect={onSelect} />
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CommandInput() {
  const SearchIcon = icons.search;
  return (
    <div cmdk-input-wrapper="" className="flex items-center gap-2 px-3">
      <SearchIcon className="text-subtle size-4 shrink-0" aria-hidden />
      <Command.Input
        placeholder="Search commands, levels, docs…"
        className="text-foreground placeholder:text-subtle h-12 w-full bg-transparent text-sm outline-none"
      />
    </div>
  );
}

function PaletteItem({
  command,
  onSelect,
}: {
  command: PaletteCommand;
  onSelect: (command: PaletteCommand) => void;
}) {
  const Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }> = icons[command.icon];
  return (
    <Command.Item
      value={`${command.label} ${command.keywords?.join(" ") ?? ""}`}
      onSelect={() => onSelect(command)}
      className="text-muted data-[selected=true]:bg-panel-hover data-[selected=true]:text-foreground flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm"
    >
      <Icon className="text-subtle size-4 shrink-0" aria-hidden />
      <span className="truncate">{command.label}</span>
    </Command.Item>
  );
}
