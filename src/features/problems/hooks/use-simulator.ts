"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ProblemLevel } from "@/lib/domain/types";
import {
  KubeSimulator,
  type AppliedResourceRef,
  type ClusterSnapshot,
  type ProbeResult,
  type SimulatorStatus,
} from "@/lib/kube/simulator";
import { applyProblemBoot, type ProblemBootSpec } from "@/lib/kube/problem-boot";
import { runLevelValidation, type ValidationReport } from "@/lib/kube/validators";
import type { Result } from "@/lib/utils/result";

const EMPTY: ClusterSnapshot = {
  pods: [],
  services: [],
  deployments: [],
  replicaSets: [],
  endpointSlices: [],
  namespaces: [],
  nodes: [],
  events: [],
};

function joinDocs(docs: string[]): string {
  return docs.filter((d) => d.trim() !== "").join("\n---\n");
}

/**
 * Minimal boot payload the hook needs. Both `ProblemLevel` and `PlaygroundTemplate`
 * satisfy it, so the same hook powers Problems and Playground.
 */
export type SimulatorBootSpec = ProblemBootSpec;

function applyInitial(
  sim: KubeSimulator,
  spec: SimulatorBootSpec,
): Promise<Result<AppliedResourceRef[], string>> {
  return applyProblemBoot(sim, spec);
}

export interface UseSimulator {
  status: SimulatorStatus;
  ready: boolean;
  error: string | null;
  snapshot: ClusterSnapshot;
  simulator: KubeSimulator;
  applyFiles: (files: Record<string, string>) => Promise<Result<AppliedResourceRef[], string>>;
  reset: () => Promise<void>;
  probe: (url: string) => Promise<ProbeResult>;
  validate: (
    level: ProblemLevel,
    files: Readonly<Record<string, string>>,
  ) => Promise<ValidationReport>;
}

/**
 * Owns a KubeSimulator for the lifetime of a level mount: boots the cluster, applies
 * the initial broken state, streams live snapshots into React state, and tears down
 * on unmount. The instance is created once (useState initializer) so state is only
 * ever mutated from async callbacks/subscriptions, never synchronously in an effect.
 * Webernetes only loads inside `boot()` (client-side).
 */
export function useSimulator(level: SimulatorBootSpec | null): UseSimulator {
  const [simulator] = useState(() => new KubeSimulator());
  const [status, setStatus] = useState<SimulatorStatus>("booting");
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ClusterSnapshot>(EMPTY);

  // Read the level via a ref so the boot effect depends only on the stable simulator
  // instance. Otherwise a change in the `level` prop identity would tear the cluster
  // down (cleanup calls close()) mid-session — emptying it while validators run.
  const levelRef = useRef(level);
  useEffect(() => {
    levelRef.current = level;
  });

  useEffect(() => {
    const lvl = levelRef.current;
    if (!lvl) return;
    let cancelled = false;
    const unsubscribe = simulator.subscribe((next) => {
      if (!cancelled) setSnapshot(next);
    });

    void (async () => {
      setError(null);
      const booted = await simulator.boot();
      if (cancelled) return;
      if (!booted.ok) {
        setStatus("error");
        setError(booted.error);
        return;
      }
      const applied = await applyInitial(simulator, lvl);
      if (cancelled) return;
      if (!applied.ok) {
        setStatus("error");
        setError(applied.error);
        return;
      }
      // "Ready" means both the control plane and the authored incident state are ready.
      setStatus("ready");
    })();

    return () => {
      cancelled = true;
      unsubscribe();
      void simulator.close();
    };
    // Boot once for the lifetime of this simulator instance; never re-run on level
    // identity changes (see levelRef above).
  }, [simulator]);

  const applyFiles = useCallback(
    async (files: Record<string, string>) => {
      if (!level) return { ok: false as const, error: "Simulator not ready." };
      return simulator.applyYaml(joinDocs(Object.values(files)));
    },
    [simulator, level],
  );

  const reset = useCallback(async () => {
    if (!level) return;
    setStatus("booting");
    setError(null);
    const result = await simulator.reset();
    if (!result.ok) {
      setStatus("error");
      setError(result.error);
      return;
    }
    const applied = await applyInitial(simulator, level);
    if (!applied.ok) {
      setStatus("error");
      setError(applied.error);
      return;
    }
    setStatus("ready");
  }, [simulator, level]);

  const probe = useCallback((url: string) => simulator.probe(url), [simulator]);

  const validate = useCallback(
    (problem: ProblemLevel, files: Readonly<Record<string, string>>) =>
      runLevelValidation(problem, files, { simulator }),
    [simulator],
  );

  return {
    status,
    ready: status === "ready",
    error,
    snapshot,
    simulator,
    applyFiles,
    reset,
    probe,
    validate,
  };
}
