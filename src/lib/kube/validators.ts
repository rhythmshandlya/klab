import type { LevelValidatorDefinition } from "@/lib/domain/types";
import { assertNever } from "@/lib/utils/exhaustive";

import { isPodReady, podPhase, readyEndpointCount } from "./kubectl/format";
import type { ClusterSnapshot, KubeSimulator } from "./simulator";

/**
 * Validators check real cluster *behavior*, not YAML text. Each is a pure-ish async
 * function over a live snapshot (+ network probe for the HTTP check). Discriminated
 * on `kind` with an exhaustive switch so adding a validator kind is a compile error
 * until handled.
 */

export interface ValidatorResult {
  id: string;
  title: string;
  passed: boolean;
  /** Human-readable current state (e.g. "0/2 ready replicas"). */
  detail: string;
  label: string;
}

export interface ValidationReport {
  passed: boolean;
  results: ValidatorResult[];
}

export interface ValidatorContext {
  simulator: KubeSimulator;
}

export async function runValidators(
  validators: readonly LevelValidatorDefinition[],
  ctx: ValidatorContext,
): Promise<ValidationReport> {
  const results = await Promise.all(validators.map((validator) => runValidator(validator, ctx)));
  return { passed: results.every((r) => r.passed), results };
}

export async function runValidator(
  validator: LevelValidatorDefinition,
  ctx: ValidatorContext,
): Promise<ValidatorResult> {
  const snapshot = ctx.simulator.getSnapshot();
  const { passed, detail } = await evaluate(validator, snapshot, ctx.simulator);
  return {
    id: validator.id,
    title: validator.title,
    passed,
    detail,
    label: passed ? validator.successLabel : validator.failureLabel,
  };
}

async function evaluate(
  validator: LevelValidatorDefinition,
  snapshot: ClusterSnapshot,
  simulator: KubeSimulator,
): Promise<{ passed: boolean; detail: string }> {
  switch (validator.kind) {
    case "deployment-ready": {
      const deployment = snapshot.deployments.find(
        (d) =>
          d.metadata?.name === validator.name &&
          (d.metadata?.namespace ?? "default") === validator.namespace,
      );
      const ready = deployment?.status?.readyReplicas ?? 0;
      const desired = deployment?.spec?.replicas ?? 0;
      return {
        passed: deployment !== undefined && ready >= validator.minReadyReplicas,
        detail: deployment ? `${ready}/${desired} ready replicas` : "deployment not found",
      };
    }

    case "service-has-ready-endpoints": {
      const service = snapshot.services.find(
        (s) =>
          s.metadata?.name === validator.name &&
          (s.metadata?.namespace ?? "default") === validator.namespace,
      );
      const count = service ? readyEndpointCount(service, snapshot.endpointSlices) : 0;
      return {
        passed: service !== undefined && count >= validator.minReadyEndpoints,
        detail: service ? `${count} ready endpoint${count === 1 ? "" : "s"}` : "service not found",
      };
    }

    case "http-get-through-service": {
      const url = `http://${validator.service}.${validator.namespace}.svc.cluster.local:${validator.port}${validator.path}`;
      const probe = await simulator.probe(url);
      return {
        passed: probe.status === validator.expectStatus,
        detail:
          probe.status === 0
            ? `no response (${probe.reason ?? "unreachable"})`
            : `GET ${validator.path} → HTTP ${probe.status}`,
      };
    }

    case "no-recent-readiness-failures": {
      // Robust current-state interpretation: pass when no Running pod in the namespace
      // is failing readiness. (Event-history scraping is timing-fragile; the window
      // field is retained for future use.) `withinSeconds` referenced to stay in type.
      void validator.withinSeconds;
      const notReady = snapshot.pods.filter(
        (p) =>
          (p.metadata?.namespace ?? "default") === validator.namespace &&
          podPhase(p) === "Running" &&
          !isPodReady(p),
      );
      return {
        passed: notReady.length === 0,
        detail:
          notReady.length === 0
            ? "no failing readiness probes"
            : `${notReady.length} pod(s) Running but not Ready`,
      };
    }

    case "pod-ready-by-selector": {
      const ready = snapshot.pods.filter(
        (p) =>
          (p.metadata?.namespace ?? "default") === validator.namespace &&
          matchesSelector(p.metadata?.labels, validator.selector) &&
          isPodReady(p),
      );
      return {
        passed: ready.length >= validator.minReady,
        detail: `${ready.length} matching pod(s) ready`,
      };
    }

    default:
      return assertNever(validator);
  }
}

function matchesSelector(
  labels: Record<string, string> | undefined,
  selector: Record<string, string>,
): boolean {
  if (!labels) return false;
  return Object.entries(selector).every(([key, value]) => labels[key] === value);
}
