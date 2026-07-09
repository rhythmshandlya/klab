"use client";

import { useState } from "react";

import { icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { ProbeResult } from "@/lib/kube/simulator";
import { cn } from "@/lib/utils/cn";

const DEFAULT_PRESETS = ["http://web-svc/", "http://web-svc/healthz"];

function statusTone(status: number): string {
  if (status === 0) return "text-red";
  if (status >= 500) return "text-red";
  if (status >= 400) return "text-amber";
  if (status >= 200 && status < 300) return "text-green";
  return "text-muted";
}

export function NetworkProbe({
  onProbe,
  presets = DEFAULT_PRESETS,
}: {
  onProbe: (url: string) => Promise<ProbeResult>;
  /** Level-specific starting URLs (service names differ per level). */
  presets?: string[];
}) {
  const [url, setUrl] = useState(presets[0] ?? "");
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const Run = icons.run;

  const probe = async (target: string) => {
    setUrl(target);
    setLoading(true);
    try {
      setResult(await onProbe(target));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 p-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void probe(url);
        }}
        className="flex gap-2"
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="Probe URL"
          name="probe-url"
          spellCheck={false}
          className="border-border bg-code text-foreground focus-visible:ring-ring h-9 flex-1 rounded-md border px-2.5 font-mono text-xs outline-none focus-visible:ring-2"
        />
        <Button type="submit" variant="secondary" size="sm" disabled={loading}>
          <Run aria-hidden />
          Probe
        </Button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => void probe(preset)}
            className="border-border bg-panel-elevated text-subtle hover:border-border-strong hover:text-muted rounded border px-2 py-1 font-mono text-[11px] transition-colors"
          >
            {preset.replace(/^http:\/\//, "")}
          </button>
        ))}
      </div>

      {result ? (
        <div className="border-border bg-code rounded-md border p-3">
          {result.status === 0 ? (
            <p className="text-red text-sm font-medium">Service Unavailable</p>
          ) : (
            <p className={cn("text-sm font-medium", statusTone(result.status))}>
              HTTP {result.status}
            </p>
          )}
          {result.reason ? <p className="text-muted mt-1 text-xs">{result.reason}</p> : null}
          {result.body ? (
            <pre className="text-muted mt-2 max-h-24 overflow-auto font-mono text-[11px]">
              {result.body.trim()}
            </pre>
          ) : null}
        </div>
      ) : (
        <p className="text-subtle text-xs">
          Probe the Service to see whether requests reach a ready pod.
        </p>
      )}
    </div>
  );
}
