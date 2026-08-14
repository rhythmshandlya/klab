"use client";

import { icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { BRAND } from "@/config/brand";
import type { ProblemLearningPath, ProblemLevel, Severity } from "@/lib/domain/types";

import { useLevelStore } from "../level-store";

const SEVERITY_TONE: Record<Severity, "neutral" | "warning" | "danger"> = {
  low: "neutral",
  medium: "warning",
  high: "danger",
  critical: "danger",
};

const PATH_LABELS: Record<ProblemLearningPath, string> = {
  "kubernetes-foundations": "Foundations",
  "application-debugging": "App debugging",
  networking: "Networking",
  reliability: "Reliability",
  "sre-on-call": "SRE / on-call",
  "platform-architect": "Platform architect",
};

/**
 * Say exactly how real this cluster is. A single "static review" banner used to sit
 * on every repair level, including the ones running a live in-browser control plane —
 * telling learners their changes would not reconcile when in fact they would. What a
 * learner can trust from an exercise depends entirely on which engine it runs.
 */
function fidelityNotice(level: ProblemLevel): { title: string; body: string } {
  if (level.challengeMode === "build") {
    return {
      title: "Static architecture review",
      body: `${BRAND.name} checks submitted manifests, required fields, and resource relationships. It does not provision a real cluster or prove the stated SLO and failure scenarios.`,
    };
  }
  if (level.engine.kind === "webernetes") {
    return {
      title: "Live cluster simulation",
      body: `${BRAND.name} runs a Kubernetes control plane in your browser. Applying a manifest triggers real reconciliation, so probes, endpoints, and restarts respond the way they would in a cluster.`,
    };
  }
  return {
    title: "Modelled incident",
    body: `This incident is authored rather than reconciled: ${BRAND.name} shows the cluster in its failing and repaired states and checks your fix against the production requirements. Use the runbook below to investigate the equivalent incident for real.`,
  };
}

export function IncidentBrief() {
  const level = useLevelStore((s) => s.level);
  if (!level) return null;
  const Warning = icons.warning;
  const fidelity = fidelityNotice(level);
  const File = icons.yaml;

  return (
    <Panel>
      <PanelHeader
        title={level.challengeMode === "build" ? "Architecture Brief" : "Incident Brief"}
        icon={<Warning />}
      />
      <PanelBody className="space-y-4">
        <div>
          <h2 className="text-foreground text-base font-semibold tracking-tight">{level.title}</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={SEVERITY_TONE[level.severity]}>
              <Warning aria-hidden />
              <span className="capitalize">
                {level.severity} {level.challengeMode === "build" ? "criticality" : "severity"}
              </span>
            </Badge>
            <Badge tone="neutral">
              Kubernetes {level.kubernetesVersion.min}-{level.kubernetesVersion.max}
            </Badge>
            {level.learningPaths.map((path) => (
              <Badge key={path} tone="neutral">
                {PATH_LABELS[path]}
              </Badge>
            ))}
          </div>
        </div>

        <p className="text-muted text-sm leading-relaxed">{level.story}</p>

        <div className="border-blue/30 bg-blue/10 rounded-md border p-3">
          <p className="text-foreground text-xs font-semibold">{fidelity.title}</p>
          <p className="text-muted mt-1 text-xs leading-relaxed">{fidelity.body}</p>
        </div>

        <Section label="Objective">
          <p className="text-foreground text-sm">{level.objective}</p>
        </Section>

        <Section label="You will practice">
          <ul className="space-y-1.5">
            {level.learningObjectives.map((objective) => (
              <li key={objective} className="text-muted flex items-start gap-2 text-sm">
                <span className="bg-blue mt-1.5 size-1 shrink-0 rounded-full" aria-hidden />
                {objective}
              </li>
            ))}
          </ul>
        </Section>

        {level.incidentSource ? (
          <Section label="Incident source">
            <a
              href={level.incidentSource.href}
              target="_blank"
              rel="noreferrer"
              className="text-blue text-sm font-medium hover:underline"
            >
              Inspired by {level.incidentSource.title}
            </a>
            <p className="text-subtle mt-1 text-xs leading-relaxed">
              {level.incidentSource.adaptationNote}
            </p>
          </Section>
        ) : null}

        {level.referenceCommands?.length ? (
          <Section label="Production runbook">
            <p className="text-subtle mb-2 text-xs leading-relaxed">
              Reference commands for a real cluster. The simulated terminal inspects this
              incident&apos;s modelled cluster, which covers the observations these commands would
              surface but not their full output.
            </p>
            <ul className="space-y-1.5">
              {level.referenceCommands.map((command) => (
                <li
                  key={command}
                  className="border-border bg-panel-elevated text-muted overflow-x-auto rounded border px-2 py-1.5 font-mono text-[11px]"
                >
                  {command}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section label={level.challengeMode === "build" ? "Acceptance criteria" : "Constraints"}>
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
            {level.files
              .filter((file) => file.access === "editable")
              .map((f) => (
                <li key={f.path} className="text-blue flex items-center gap-2 text-sm">
                  <File className="size-3.5" aria-hidden />
                  <span className="font-mono text-xs">{f.path}</span>
                </li>
              ))}
          </ul>
        </Section>

        {level.files.some((file) => file.access === "readonly") ? (
          <Section label="Reference files">
            <ul className="space-y-1">
              {level.files
                .filter((file) => file.access === "readonly")
                .map((file) => (
                  <li key={file.path} className="text-muted flex items-center gap-2 text-sm">
                    <icons.lock className="text-subtle size-3.5" aria-hidden />
                    <span className="font-mono text-xs">{file.path}</span>
                  </li>
                ))}
            </ul>
          </Section>
        ) : null}
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
