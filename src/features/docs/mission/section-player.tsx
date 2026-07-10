"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { icons } from "@/components/icons";
import { getMissionsBySection, missionHref } from "@/content/missions";
import type { Mission } from "@/lib/domain/mission-types";
import {
  useSimulator,
  type SimulatorBootSpec,
  type UseSimulator,
} from "@/features/problems/hooks/use-simulator";
import { cn } from "@/lib/utils/cn";

import { MissionRunner } from "./mission-runner";

/**
 * Index of the mission in `missions` whose slug (joined with "/") matches `slug`.
 * Falls back to 0 (the section's first mission) when there is no slug, or the slug
 * doesn't match any mission in this section (e.g. a deep-link into another section).
 * Pure so it is unit-testable without booting a simulator.
 */
export function initialMissionIndex(missions: Mission[], slug?: string[]): number {
  if (!slug || slug.length === 0) return 0;
  const key = slug.join("/");
  const found = missions.findIndex((mission) => mission.slug.join("/") === key);
  return found >= 0 ? found : 0;
}

/**
 * Applies the accumulated state of every mission before `upToIndex` so a learner who
 * deep-links into mission N sees the cluster missions 1..N-1 would have built.
 *
 * Approximation: a `do` step's `files[].initialValue` is the *starting* YAML shown to
 * the learner, not necessarily the solved state (some `do` steps ask the learner to
 * edit the file before applying). Re-applying the starting YAML is a reasonable stand-in
 * for the pilot — the cluster ends up close to, but not always exactly, what a learner
 * who played the mission live would have produced. If a mission type later exposes a
 * "solved manifest" alongside `initialValue`, swap it in here.
 */
async function catchUpPriorMissions(
  sim: UseSimulator,
  missions: Mission[],
  upToIndex: number,
): Promise<void> {
  for (let i = 0; i < upToIndex; i++) {
    const mission = missions[i];
    if (!mission) continue;
    for (const step of mission.steps) {
      if (step.kind !== "do") continue;
      const files = Object.fromEntries(step.files.map((file) => [file.path, file.initialValue]));
      await sim.applyFiles(files);
    }
  }
}

function BootingPanel({ status }: { status: UseSimulator["status"] }) {
  const label = status === "error" ? "Simulator error" : "Booting simulator...";
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 px-5 py-24 text-center">
      <span
        className={cn(
          "size-2 animate-pulse rounded-full",
          status === "error" ? "bg-red" : "bg-amber",
        )}
        aria-hidden
      />
      <p className={cn("text-sm font-medium", status === "error" ? "text-red" : "text-subtle")}>
        {label}
      </p>
    </div>
  );
}

function SectionCompletePanel({
  section,
  sim,
}: {
  section: string;
  sim: UseSimulator;
}) {
  const { snapshot } = sim;
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16 text-center">
      <Badge tone="success">{section}</Badge>
      <h1 className="text-foreground mt-4 text-2xl font-semibold tracking-tight">
        {section} complete
      </h1>
      <p className="text-subtle mt-2 text-sm">
        Every mission in this section is done. Here's the cluster you built along the way.
      </p>
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Pods", value: snapshot.pods.length },
          { label: "Deployments", value: snapshot.deployments.length },
          { label: "Services", value: snapshot.services.length },
          { label: "Namespaces", value: snapshot.namespaces.length },
        ].map((metric) => (
          <div key={metric.label} className="border-border bg-panel rounded-md border px-3 py-3">
            <p className="tabnums text-foreground text-lg font-semibold leading-none">
              {metric.value}
            </p>
            <p className="text-muted mt-1 text-[11px]">{metric.label}</p>
          </div>
        ))}
      </dl>
      <div className="mt-8 flex justify-center">
        <Button variant="primary" size="sm" asChild>
          <Link href="/docs">
            Back to docs
            <icons.arrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Owns ONE `KubeSimulator` for the lifetime of a whole section (via `useSimulator`,
 * which boots once per mount and never re-boots on prop changes). Missions within the
 * section are swapped client-side by advancing `index` and re-keying `MissionRunner` —
 * the page never remounts `SectionPlayer` itself, so the cluster persists and grows as
 * the learner completes each mission, instead of being torn down and rebuilt.
 */
export function SectionPlayer({
  section,
  initialSlug,
}: {
  section: string;
  initialSlug?: string[];
}) {
  const missions = useMemo(() => getMissionsBySection(section), [section]);
  const [index, setIndex] = useState(() => initialMissionIndex(missions, initialSlug));
  const [sectionComplete, setSectionComplete] = useState(false);

  // Boot the section's cluster once from the first mission's seed manifests. Later
  // missions apply their own incremental manifests via `sim.applyFiles` on top of the
  // same running simulator — they never cause a re-boot.
  const bootSpec: SimulatorBootSpec = useMemo(
    () => ({ files: [], initialManifests: missions[0]?.seedManifests ?? [] }),
    [missions],
  );
  const sim = useSimulator(missions.length > 0 ? bootSpec : null);

  // Deep-link catch-up: if the learner lands directly on mission N (index > 0), the
  // cluster the boot spec produced only reflects mission 1's seed. Once the simulator
  // is ready, replay every prior mission's `do` steps once so the cluster matches what
  // it would be after playing the section in order. Guarded by a ref so this runs at
  // most once per SectionPlayer mount, even as `sim.ready` stays true afterward.
  const caughtUpRef = useRef(false);
  useEffect(() => {
    if (!sim.ready || caughtUpRef.current) return;
    caughtUpRef.current = true;
    if (index > 0) {
      void catchUpPriorMissions(sim, missions, index);
    }
  }, [sim, sim.ready, missions, index]);

  if (missions.length === 0) return null;

  if (!sim.ready) {
    return <BootingPanel status={sim.status} />;
  }

  if (sectionComplete) {
    return <SectionCompletePanel section={section} sim={sim} />;
  }

  const mission = missions[index];
  if (!mission) return null;

  const handleMissionComplete = () => {
    const nextIndex = index + 1;
    const nextMission = missions[nextIndex];
    if (nextMission) {
      setIndex(nextIndex);
      // Update the URL without navigating through the App Router: `router.push`/
      // `router.replace` would trigger a route transition that remounts this page's
      // client tree (and with it, `useSimulator`'s once-per-mount boot effect),
      // tearing down the cluster we just spent this mission building on. Mutating
      // history directly keeps this exact `SectionPlayer` instance mounted while
      // still giving the URL bar (and deep-linking / back-forward) the right slug.
      window.history.replaceState(null, "", missionHref(nextMission));
    } else {
      setSectionComplete(true);
    }
  };

  return (
    <MissionRunner
      key={mission.slug.join("/")}
      mission={mission}
      sim={sim}
      onMissionComplete={handleMissionComplete}
    />
  );
}
