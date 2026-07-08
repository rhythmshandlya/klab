"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { LevelValidatorDefinition, ProblemLevel } from "@/lib/domain/types";
import {
  KubeSimulator,
  type ClusterSnapshot,
  type ProbeResult,
  type SimulatorStatus,
} from "@/lib/kube/simulator";
import { runValidators, type ValidationReport } from "@/lib/kube/validators";
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

function applyInitial(sim: KubeSimulator, level: ProblemLevel): Promise<Result<unknown, string>> {
  const docs = [...level.initialManifests, ...level.files.map((f) => f.initialValue)];
  return sim.applyYaml(joinDocs(docs));
}

export interface UseSimulator {
  status: SimulatorStatus;
  ready: boolean;
  error: string | null;
  snapshot: ClusterSnapshot;
  simulator: KubeSimulator;
  applyFiles: (files: Record<string, string>) => Promise<Result<unknown, string>>;
  reset: () => Promise<void>;
  probe: (url: string) => Promise<ProbeResult>;
  validate: (validators: readonly LevelValidatorDefinition[]) => Promise<ValidationReport>;
}

/**
 * Owns a KubeSimulator for the lifetime of a level mount: boots the cluster, applies
 * the initial broken state, streams live snapshots into React state, and tears down
 * on unmount. The instance is created once (useState initializer) so state is only
 * ever mutated from async callbacks/subscriptions, never synchronously in an effect.
 * Webernetes only loads inside `boot()` (client-side).
 */
export function useSimulator(level: ProblemLevel | null): UseSimulator {
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
      const booted = await simulator.boot();
      if (cancelled) return;
      if (!booted.ok) {
        setStatus("error");
        setError(booted.error);
        return;
      }
      setStatus("ready");
      const applied = await applyInitial(simulator, lvl);
      if (!cancelled && !applied.ok) setError(applied.error);
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
      return simulator.applyYaml(joinDocs([...level.initialManifests, ...Object.values(files)]));
    },
    [simulator, level],
  );

  const reset = useCallback(async () => {
    if (!level) return;
    setStatus("booting");
    const result = await simulator.reset();
    if (!result.ok) {
      setStatus("error");
      setError(result.error);
      return;
    }
    setStatus("ready");
    const applied = await applyInitial(simulator, level);
    if (!applied.ok) setError(applied.error);
  }, [simulator, level]);

  const probe = useCallback((url: string) => simulator.probe(url), [simulator]);

  const validate = useCallback(
    (validators: readonly LevelValidatorDefinition[]) => runValidators(validators, { simulator }),
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
