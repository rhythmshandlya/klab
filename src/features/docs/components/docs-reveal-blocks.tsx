"use client";

import { useState } from "react";

import { icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { DocsBlock } from "@/lib/domain/types";

type SpotTheBug = Extract<DocsBlock, { type: "spotTheBug" }>;
type Challenge = Extract<DocsBlock, { type: "challenge" }>;

/**
 * Teaching block: show a broken manifest, hide the reason, let the learner think,
 * then reveal the diagnosis. Trains reading manifests before the lab tests authoring.
 */
export function SpotTheBugBlock({ block }: { block: SpotTheBug }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="border-amber/30 bg-amber/5 overflow-hidden rounded-md border">
      <div className="border-amber/20 flex items-center gap-2 border-b px-4 py-2">
        <icons.warning className="text-amber size-4" aria-hidden />
        <span className="text-amber text-[11px] font-semibold tracking-[0.12em] uppercase">
          Spot the bug
        </span>
      </div>
      <div className="p-4">
        <p className="text-muted text-sm leading-relaxed">{block.prompt}</p>
        <pre className="border-border bg-code text-muted mt-3 overflow-x-auto rounded-md border p-3 font-mono text-xs leading-relaxed">
          {block.code}
        </pre>
        <div className="mt-3">
          {!revealed ? (
            <Button variant="secondary" size="sm" onClick={() => setRevealed(true)}>
              <icons.warning aria-hidden />
              Reveal what&apos;s wrong
            </Button>
          ) : (
            <div className="border-red/30 bg-red/5 rounded-md border p-3">
              <p className="text-red text-sm font-semibold">What&apos;s wrong</p>
              <p className="text-muted mt-1 text-sm leading-relaxed">{block.answer}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Teaching block: ask the learner to author a manifest from a requirement, then
 * reveal a working solution. Bridges "I can read it" -> "I can produce it" without
 * needing the full cluster.
 */
export function ChallengeBlock({ block }: { block: Challenge }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="border-purple/30 bg-purple/5 overflow-hidden rounded-md border">
      <div className="border-purple/20 flex items-center gap-2 border-b px-4 py-2">
        <icons.docsInteractive className="text-purple size-4" aria-hidden />
        <span className="text-purple text-[11px] font-semibold tracking-[0.12em] uppercase">
          Write it yourself
        </span>
      </div>
      <div className="p-4">
        <p className="text-foreground text-sm font-semibold">{block.prompt}</p>
        {block.hint ? (
          <p className="text-subtle mt-1 text-xs leading-relaxed">
            <span className="font-semibold">Hint:</span> {block.hint}
          </p>
        ) : null}
        <div className="mt-3">
          {!revealed ? (
            <Button variant="secondary" size="sm" onClick={() => setRevealed(true)}>
              <icons.success aria-hidden />
              Show solution
            </Button>
          ) : (
            <div>
              <p className="text-green mb-2 text-[11px] font-semibold tracking-[0.12em] uppercase">
                One working solution
              </p>
              <pre className="border-border bg-code text-muted overflow-x-auto rounded-md border p-3 font-mono text-xs leading-relaxed">
                {block.solution}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
