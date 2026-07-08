"use client";

import { useMemo } from "react";

import { icons } from "@/components/icons";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { cn } from "@/lib/utils/cn";

import { useLevelStore } from "../level-store";

interface EvidenceEntry {
  evidenceId: string;
  label: string;
  source: string;
}

export function EvidenceBoard() {
  const level = useLevelStore((s) => s.level);
  const collected = useLevelStore((s) => s.collectedEvidence);

  const entries = useMemo<EvidenceEntry[]>(() => {
    if (!level) return [];
    const seen = new Map<string, EvidenceEntry>();
    for (const rule of level.evidenceRules) {
      if (!seen.has(rule.evidenceId)) {
        seen.set(rule.evidenceId, {
          evidenceId: rule.evidenceId,
          label: rule.label,
          source: rule.source,
        });
      }
    }
    return [...seen.values()];
  }, [level]);

  if (!level) return null;
  const Check = icons.success;
  const collectedCount = entries.filter((e) => collected.includes(e.evidenceId)).length;

  return (
    <Panel>
      <PanelHeader
        title="Evidence Board"
        icon={<Check />}
        actions={
          <span className="tabnums text-subtle text-[11px]">
            {collectedCount}/{entries.length} collected
          </span>
        }
      />
      <PanelBody className="space-y-1.5">
        {entries.map((entry) => {
          const isCollected = collected.includes(entry.evidenceId);
          return (
            <div
              key={entry.evidenceId}
              className={cn(
                "flex items-start gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                isCollected ? "text-foreground" : "text-subtle",
              )}
            >
              {isCollected ? (
                <Check className="text-green mt-0.5 size-4 shrink-0" aria-hidden />
              ) : (
                <span
                  className="border-border-strong mt-0.5 size-4 shrink-0 rounded-full border"
                  aria-hidden
                />
              )}
              <span className="flex-1">{isCollected ? entry.label : "Not yet discovered"}</span>
              {isCollected ? (
                <span className="text-subtle text-[10px] tracking-wide uppercase">
                  {entry.source}
                </span>
              ) : null}
            </div>
          );
        })}
      </PanelBody>
    </Panel>
  );
}
