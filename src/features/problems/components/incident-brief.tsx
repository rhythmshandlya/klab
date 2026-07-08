"use client";

import { icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import type { Severity } from "@/lib/domain/types";

import { useLevelStore } from "../level-store";

const SEVERITY_TONE: Record<Severity, "neutral" | "warning" | "danger"> = {
  low: "neutral",
  medium: "warning",
  high: "danger",
  critical: "danger",
};

export function IncidentBrief() {
  const level = useLevelStore((s) => s.level);
  if (!level) return null;
  const Warning = icons.warning;
  const File = icons.yaml;

  return (
    <Panel>
      <PanelHeader title="Incident Brief" icon={<Warning />} />
      <PanelBody className="space-y-4">
        <div>
          <h2 className="text-foreground text-base font-semibold tracking-tight">{level.title}</h2>
          <div className="mt-2">
            <Badge tone={SEVERITY_TONE[level.severity]}>
              <Warning aria-hidden />
              <span className="capitalize">{level.severity} severity</span>
            </Badge>
          </div>
        </div>

        <p className="text-muted text-sm leading-relaxed">{level.story}</p>

        <Section label="Objective">
          <p className="text-foreground text-sm">{level.objective}</p>
        </Section>

        <Section label="Constraints">
          <ul className="space-y-1.5">
            {level.constraints.map((c) => (
              <li key={c.id} className="text-muted flex items-start gap-2 text-sm">
                <span className="bg-subtle mt-1 size-1 shrink-0 rounded-full" aria-hidden />
                {c.label}
              </li>
            ))}
          </ul>
        </Section>

        <Section label="Editable files">
          <ul className="space-y-1">
            {level.files.map((f) => (
              <li key={f.path} className="text-blue flex items-center gap-2 text-sm">
                <File className="size-3.5" aria-hidden />
                <span className="font-mono text-xs">{f.path}</span>
              </li>
            ))}
          </ul>
        </Section>
      </PanelBody>
    </Panel>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-subtle mb-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}
