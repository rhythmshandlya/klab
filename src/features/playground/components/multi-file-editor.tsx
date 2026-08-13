"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { icons } from "@/components/icons";
import { YamlEditor } from "@/components/editor/yaml-editor";
import { cn } from "@/lib/utils/cn";

import { usePlaygroundStore } from "../playground-store";

export function MultiFileEditor() {
  const files = usePlaygroundStore((s) => s.files);
  const activeFilePath = usePlaygroundStore((s) => s.activeFilePath);
  const setFile = usePlaygroundStore((s) => s.setFile);
  const setActiveFile = usePlaygroundStore((s) => s.setActiveFile);
  const addFile = usePlaygroundStore((s) => s.addFile);
  const renameFile = usePlaygroundStore((s) => s.renameFile);
  const restoreFile = usePlaygroundStore((s) => s.restoreFile);
  const removeFile = usePlaygroundStore((s) => s.removeFile);

  const paths = Object.keys(files);
  const File = icons.yaml;
  const tabStripRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);

  useEffect(() => {
    activeTabRef.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activeFilePath]);

  const addNewFile = () => {
    let suffix = paths.length + 1;
    while (files[`resource-${suffix}.yaml`] !== undefined) suffix += 1;
    addFile(`resource-${suffix}.yaml`);
  };

  const startRename = (path: string) => {
    setActiveFile(path);
    setRenamingPath(path);
    setDraftName(path);
    setRenameError(null);
  };

  const cancelRename = () => {
    setRenamingPath(null);
    setRenameError(null);
  };

  const commitRename = () => {
    if (!renamingPath) return;

    const result = renameFile(renamingPath, draftName);
    if (result === "renamed" || result === "unchanged" || result === "missing") {
      cancelRename();
      return;
    }

    setRenameError(
      result === "exists"
        ? "A file with that name already exists."
        : "Enter a file name up to 260 characters.",
    );
  };

  const deleteFile = (path: string) => {
    const contents = files[path];
    if (contents === undefined) return;

    const index = paths.indexOf(path);
    const wasActive = path === activeFilePath;
    removeFile(path);
    toast(`Deleted ${path}`, {
      duration: 5_000,
      action: {
        label: "Undo",
        onClick: () => {
          if (!restoreFile(path, contents, index, wasActive)) {
            toast.error(`Could not restore ${path}: that name is already in use.`);
          }
        },
      },
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border flex h-9 min-w-0 shrink-0 overflow-hidden border-b">
        <div
          ref={tabStripRef}
          role="tablist"
          aria-label="Manifest files"
          className="flex h-full min-w-0 flex-1 [scrollbar-width:none] items-center gap-1 overflow-x-auto overflow-y-hidden px-1.5 [&::-webkit-scrollbar]:hidden"
          onWheel={(event) => {
            const strip = tabStripRef.current;
            if (!strip || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
            const previous = strip.scrollLeft;
            strip.scrollLeft += event.deltaY;
            if (strip.scrollLeft !== previous) event.preventDefault();
          }}
        >
          {paths.map((path) => {
            const active = path === activeFilePath;
            const renaming = path === renamingPath;

            return (
              <div
                key={path}
                className={cn(
                  "group flex h-9 max-w-64 shrink-0 items-center gap-1.5 border-b-2 px-2 text-xs transition-colors",
                  active
                    ? "border-foreground text-foreground"
                    : "text-muted hover:text-foreground border-transparent",
                )}
              >
                <File className="text-subtle size-3.5 shrink-0" aria-hidden />
                {renaming ? (
                  <input
                    autoFocus
                    value={draftName}
                    aria-label={`New name for ${path}`}
                    onChange={(event) => {
                      setDraftName(event.target.value);
                      setRenameError(null);
                    }}
                    onFocus={(event) => event.currentTarget.select()}
                    onBlur={commitRename}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitRename();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelRename();
                      }
                    }}
                    className="bg-code ring-ring h-6 w-40 min-w-24 rounded px-1.5 font-mono ring-2 outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    ref={active ? activeTabRef : undefined}
                    role="tab"
                    aria-selected={active}
                    title={`${path} (double-click to rename)`}
                    onClick={() => setActiveFile(path)}
                    onDoubleClick={() => startRename(path)}
                    onKeyDown={(event) => {
                      if (event.key === "F2") {
                        event.preventDefault();
                        startRename(path);
                      }
                    }}
                    className="min-w-0 flex-1 truncate text-left font-mono"
                  >
                    {path}
                  </button>
                )}
                {paths.length > 1 && !renaming ? (
                  <button
                    type="button"
                    aria-label={`Close ${path}`}
                    onClick={() => deleteFile(path)}
                    className="text-subtle hover:text-foreground rounded opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <icons.error className="size-3" aria-hidden />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="border-border bg-panel flex h-full shrink-0 items-center border-l px-1.5">
          <button
            type="button"
            aria-label="Add file"
            onClick={addNewFile}
            className="text-subtle hover:bg-panel-hover hover:text-foreground flex size-6 items-center justify-center rounded"
          >
            +
          </button>
        </div>
      </div>
      {renameError ? (
        <p
          className="border-border bg-panel-elevated text-red shrink-0 border-b px-3 py-1 text-xs"
          role="alert"
        >
          {renameError}
        </p>
      ) : null}
      <div className="min-h-0 flex-1">
        {activeFilePath ? (
          <YamlEditor
            path={activeFilePath}
            value={files[activeFilePath] ?? ""}
            onChange={(value) => setFile(activeFilePath, value)}
          />
        ) : (
          <p className="text-subtle p-4 text-sm">No files. Add one with the + button.</p>
        )}
      </div>
    </div>
  );
}
