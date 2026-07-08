"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { palette } from "@/lib/design/tokens";

// Monaco is large and browser-only: load it lazily, never during SSR.
const MonacoEditor = dynamic(() => import("@monaco-editor/react").then((m) => m.Editor), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});

export interface YamlEditorProps {
  value: string;
  onChange?: (value: string) => void;
  path?: string;
  readOnly?: boolean;
}

export function YamlEditor({ value, onChange, path = "manifest.yaml", readOnly }: YamlEditorProps) {
  // Latest onChange in a ref so the onMount listener never goes stale.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  return (
    <MonacoEditor
      path={path}
      language="yaml"
      value={value}
      theme="klab-dark"
      options={{
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        fontSize: 13,
        lineHeight: 20,
        minimap: { enabled: true, scale: 1 },
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        padding: { top: 12, bottom: 12 },
        tabSize: 2,
        renderLineHighlight: "line",
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        automaticLayout: true,
        fixedOverflowWidgets: true,
        readOnly: readOnly ?? false,
      }}
      beforeMount={(monaco) => {
        monaco.editor.defineTheme("klab-dark", {
          base: "vs-dark",
          inherit: true,
          rules: [],
          colors: {
            "editor.background": palette.codeBackground,
            "editorGutter.background": palette.codeBackground,
            "editor.lineHighlightBackground": "#12141a",
            "editorLineNumber.foreground": palette.textSubtle,
            "editorLineNumber.activeForeground": palette.textMuted,
            "editorWidget.background": palette.panelElevated,
          },
        });
      }}
      onMount={(editor) => {
        // Wire change events directly off the editor instance. This is more reliable
        // than the library's `onChange` prop, which did not consistently fire for us.
        editor.onDidChangeModelContent(() => {
          onChangeRef.current?.(editor.getValue());
        });
      }}
      loading={<EditorSkeleton />}
    />
  );
}

function EditorSkeleton() {
  return (
    <div className="flex h-full flex-col gap-2 p-3" aria-label="Loading editor">
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton key={i} className="h-3.5" style={{ width: `${40 + ((i * 13) % 55)}%` }} />
      ))}
    </div>
  );
}
