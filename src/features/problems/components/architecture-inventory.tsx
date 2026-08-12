"use client";

import { useMemo } from "react";

import { icons } from "@/components/icons";
import type { ProblemLevel } from "@/lib/domain/types";
import { parseKubernetesManifests } from "@/lib/kube/manifest-parser";

interface InventoryItem {
  file: string;
  kind: string;
  name: string;
  namespace: string;
  relationship?: string;
}

const CLUSTER_SCOPED_KINDS = new Set([
  "ClusterPolicy",
  "ClusterRole",
  "ClusterRoleBinding",
  "CustomResourceDefinition",
  "GatewayClass",
  "ImageValidatingPolicy",
  "Namespace",
  "Node",
  "PersistentVolume",
  "PriorityClass",
  "StorageClass",
  "ValidatingWebhookConfiguration",
]);

export function ArchitectureInventory({
  level,
  files,
}: {
  level: ProblemLevel;
  files: Readonly<Record<string, string>>;
}) {
  const { items, errors } = useMemo(() => {
    const nextItems: InventoryItem[] = [];
    const nextErrors: string[] = [];

    for (const file of level.files.filter(
      (candidate) => candidate.access !== "hidden" && candidate.language === "yaml",
    )) {
      const source = files[file.path] ?? file.initialValue;
      const authoredContent = source
        .split("\n")
        .some((line) => line.trim().length > 0 && !line.trimStart().startsWith("#"));
      if (!authoredContent) continue;
      const parsed = parseKubernetesManifests(source);
      if (!parsed.ok) {
        nextErrors.push(`${file.path}: ${parsed.error.message}`);
        continue;
      }
      for (const manifest of parsed.value) {
        nextItems.push({
          file: file.path,
          kind: manifest.kind,
          name: manifest.name,
          namespace: CLUSTER_SCOPED_KINDS.has(manifest.kind)
            ? "cluster-scoped"
            : manifest.namespace,
          relationship: describeRelationship(manifest.raw),
        });
      }
    }

    return { items: nextItems, errors: nextErrors };
  }, [files, level.files]);

  return (
    <div className="h-full overflow-auto p-3">
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        {items.map((item) => (
          <article
            key={`${item.file}:${item.kind}:${item.namespace}:${item.name}`}
            className="border-border bg-panel-elevated rounded-md border p-2.5"
          >
            <div className="flex min-w-0 items-center gap-2">
              <icons.cluster className="text-blue size-3.5 shrink-0" aria-hidden />
              <p className="text-foreground truncate text-xs font-semibold">{item.name}</p>
              <span className="text-subtle ml-auto shrink-0 text-[10px] font-medium tracking-wide uppercase">
                {item.kind}
              </span>
            </div>
            <p className="text-subtle mt-1 truncate font-mono text-[10px]">
              {item.namespace}/{item.file}
            </p>
            {item.relationship ? (
              <p className="text-muted mt-1.5 text-[11px] leading-relaxed">{item.relationship}</p>
            ) : null}
          </article>
        ))}
      </div>

      {items.length === 0 && errors.length === 0 ? (
        <p className="text-subtle py-6 text-center text-xs">
          Add Kubernetes resources to start the architecture.
        </p>
      ) : null}

      {errors.length > 0 ? (
        <div className="border-red/30 bg-red/10 text-red mt-3 rounded-md border p-2 text-xs">
          <p className="font-medium">The design contains invalid YAML</p>
          {errors.map((error) => (
            <p key={error} className="mt-1 font-mono text-[10px]">
              {error}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function describeRelationship(resource: Record<string, unknown>): string | undefined {
  const spec = objectValue(resource.spec);
  const selector = objectValue(spec?.selector);
  const scaleTargetRef = objectValue(spec?.scaleTargetRef);
  const roleRef = objectValue(spec?.roleRef);
  const parentRefs = Array.isArray(spec?.parentRefs) ? spec.parentRefs : [];
  const rules = Array.isArray(spec?.rules) ? spec.rules : [];

  if (typeof scaleTargetRef?.name === "string") {
    return `Scales ${String(scaleTargetRef.kind ?? "workload")}/${scaleTargetRef.name}`;
  }
  if (typeof spec?.serviceName === "string") {
    return `Uses governing Service ${spec.serviceName}`;
  }
  if (typeof roleRef?.name === "string") {
    return `Binds ${String(roleRef.kind ?? "role")}/${roleRef.name}`;
  }
  const parent = objectValue(parentRefs[0]);
  if (typeof parent?.name === "string") {
    const backends = rules.flatMap((rule) => {
      const backendRefs = objectValue(rule)?.backendRefs;
      return Array.isArray(backendRefs) ? backendRefs : [];
    });
    const backendNames = backends
      .map((backend) => objectValue(backend)?.name)
      .filter((name): name is string => typeof name === "string");
    return `Routes through Gateway ${parent.name}${
      backendNames.length > 0 ? ` to ${backendNames.join(", ")}` : ""
    }`;
  }
  if (selector) {
    const labels = objectValue(selector.matchLabels) ?? selector;
    const entries = Object.entries(labels)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([key, value]) => `${key}=${value}`);
    if (entries.length > 0) return `Selects ${entries.join(", ")}`;
  }
  if (typeof spec?.gatewayClassName === "string") {
    return `Uses GatewayClass ${spec.gatewayClassName}`;
  }
  return undefined;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
