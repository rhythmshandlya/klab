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
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const Run = icons.run;

  const probe = async (target: string, samples = 1) => {
    setUrl(target);
    setLoading(true);
    try {
      const next: ProbeResult[] = [];
      for (let index = 0; index < samples; index += 1) next.push(await onProbe(target));
      setResults(next);
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
        className="flex flex-wrap gap-2"
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="Probe URL"
          name="probe-url"
          spellCheck={false}
          className="border-border bg-code text-foreground focus-visible:ring-ring h-9 min-w-44 flex-1 rounded-md border px-2.5 font-mono text-xs outline-none focus-visible:ring-2"
        />
        <Button type="submit" variant="secondary" size="sm" disabled={loading}>
          <Run aria-hidden />
          Probe
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading}
          onClick={() => void probe(url, 6)}
        >
          <Run aria-hidden />
          Sample 6x
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

      {results.length > 0 ? (
        <div className="border-border bg-code rounded-md border p-3">
          {results.length > 1 ? (
            <ProbeSampleSummary results={results} />
          ) : (
            <ProbeResultView result={results[0]!} />
          )}
        </div>
      ) : (
        <p className="text-subtle text-xs">
          Probe the Service to see whether requests reach a ready pod.
        </p>
      )}
    </div>
  );
}

function ProbeResultView({ result }: { result: ProbeResult }) {
  return (
    <>
      {result.status === 0 ? (
        <p className="text-red text-sm font-medium">Service Unavailable</p>
      ) : (
        <p className={cn("text-sm font-medium", statusTone(result.status))}>HTTP {result.status}</p>
      )}
      {result.reason ? <p className="text-muted mt-1 text-xs">{result.reason}</p> : null}
      {result.body ? (
        <pre className="text-muted mt-2 max-h-24 overflow-auto font-mono text-[11px]">
          {result.body.trim()}
        </pre>
      ) : null}
    </>
  );
}

function ProbeSampleSummary({ results }: { results: readonly ProbeResult[] }) {
  const failures = results.filter((result) => !result.ok).length;
  return (
    <div>
      <p className={cn("text-sm font-medium", failures > 0 ? "text-red" : "text-green")}>
        {failures === 0 ? "All samples succeeded" : `${failures}/${results.length} samples failed`}
      </p>
      <ol className="mt-2 space-y-1 font-mono text-[11px]" aria-label="Probe sample results">
        {results.map((result, index) => (
          <li key={index} className="flex min-w-0 items-baseline gap-2">
            <span className="text-subtle tabnums w-4 shrink-0">{index + 1}</span>
            <span className={cn("tabnums w-14 shrink-0", statusTone(result.status))}>
              {result.status === 0 ? "ERR" : result.status}
            </span>
            <span className="text-muted truncate">
              {result.body.trim() || result.reason || "-"}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
