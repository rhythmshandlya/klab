import type { V1Pod } from "@ngrok/webernetes";

import type { QuickCommand } from "@/lib/domain/types";

import { isPodReady, podRestarts } from "./kubectl/format";

export function resolveQuickCommand(
  quickCommand: QuickCommand,
  pods: readonly V1Pod[],
): string | null {
  if (!quickCommand.command.includes("<pod>")) return quickCommand.command;
  if (!quickCommand.target) return null;

  const candidates = pods.filter(
    (pod) =>
      Boolean(pod.metadata?.name) &&
      (pod.metadata?.namespace ?? "default") === quickCommand.target?.namespace &&
      Object.entries(quickCommand.target?.selector ?? {}).every(
        ([key, value]) => pod.metadata?.labels?.[key] === value,
      ),
  );

  const target =
    quickCommand.target.prefer === "not-ready"
      ? (candidates.find((pod) => !isPodReady(pod)) ?? candidates[0])
      : quickCommand.target.prefer === "highest-restarts"
        ? [...candidates].sort((a, b) => podRestarts(b) - podRestarts(a))[0]
        : candidates[0];
  const name = target?.metadata?.name;
  return name ? quickCommand.command.replaceAll("<pod>", name) : null;
}
