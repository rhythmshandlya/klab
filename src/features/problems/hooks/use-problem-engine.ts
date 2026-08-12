"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ProblemLevel } from "@/lib/domain/types";
import { createProblemEngine, type ProblemEngine } from "@/lib/kube/problem-engine";
import type {
  AppliedResourceRef,
  ClusterSnapshot,
  ProbeResult,
  SimulatorStatus,
} from "@/lib/kube/simulator";
import type { ValidationReport } from "@/lib/kube/validators";
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

export interface UseProblemEngine {
  status: SimulatorStatus;
  ready: boolean;
  error: string | null;
  snapshot: ClusterSnapshot;
  engine: ProblemEngine;
  applyFiles(
    files: Readonly<Record<string, string>>,
  ): Promise<Result<AppliedResourceRef[], string>>;
  reset(): Promise<Result<AppliedResourceRef[], string>>;
  probe(url: string): Promise<ProbeResult>;
  validate(level: ProblemLevel, files: Readonly<Record<string, string>>): Promise<ValidationReport>;
}

export function useProblemEngine(level: ProblemLevel): UseProblemEngine {
  // Client navigation can replace the level without remounting the workspace.
  // Recreate the runtime so engine state never leaks across two problem routes.
  const engine = useMemo(() => createProblemEngine(level.engine), [level.engine]);
  const [status, setStatus] = useState<SimulatorStatus>("booting");
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ClusterSnapshot>(EMPTY);
  const levelRef = useRef(level);
  useEffect(() => {
    levelRef.current = level;
  });

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = engine.subscribe((next) => {
      if (!cancelled) setSnapshot(next);
    });
    void (async () => {
      setStatus("booting");
      setError(null);
      const booted = await engine.boot(levelRef.current);
      if (cancelled) return;
      if (!booted.ok) {
        setStatus("error");
        setError(booted.error);
        return;
      }
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
      unsubscribe();
      void engine.close();
    };
  }, [engine]);

  const applyFiles = useCallback(
    (files: Readonly<Record<string, string>>) => engine.applyFiles(files),
    [engine],
  );
  const reset = useCallback(async () => {
    setStatus("booting");
    setError(null);
    const result = await engine.reset(levelRef.current);
    if (!result.ok) {
      setStatus("error");
      setError(result.error);
      return result;
    }
    setStatus("ready");
    return result;
  }, [engine]);
  const probe = useCallback((url: string) => engine.probe(url), [engine]);
  const validate = useCallback(
    (problem: ProblemLevel, files: Readonly<Record<string, string>>) =>
      engine.validate(problem, files),
    [engine],
  );

  return {
    status,
    ready: status === "ready",
    error,
    snapshot,
    engine,
    applyFiles,
    reset,
    probe,
    validate,
  };
}
