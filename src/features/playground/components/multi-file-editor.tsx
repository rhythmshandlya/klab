"use client";

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
  const removeFile = usePlaygroundStore((s) => s.removeFile);

  const paths = Object.keys(files);
  const File = icons.yaml;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b px-1.5">
        {paths.map((path) => (
          <div
            key={path}
            className={cn(
              "group flex h-9 shrink-0 items-center gap-1.5 border-b-2 px-2 text-xs transition-colors",
              path === activeFilePath
                ? "border-foreground text-foreground"
                : "text-muted hover:text-foreground border-transparent",
            )}
          >
            <button
              type="button"
              onClick={() => setActiveFile(path)}
              className="flex items-center gap-1.5 font-mono"
            >
              <File className="text-subtle size-3.5" aria-hidden />
              {path}
            </button>
            {paths.length > 1 ? (
              <button
                type="button"
                aria-label={`Close ${path}`}
                onClick={() => removeFile(path)}
                className="text-subtle hover:text-foreground rounded opacity-0 transition-opacity group-hover:opacity-100"
              >
                <icons.error className="size-3" aria-hidden />
              </button>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          aria-label="Add file"
          onClick={() => addFile(`resource-${paths.length + 1}.yaml`)}
          className="text-subtle hover:bg-panel-hover hover:text-foreground ml-1 flex size-6 shrink-0 items-center justify-center rounded"
        >
          +
        </button>
      </div>
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
