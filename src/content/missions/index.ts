import type { Mission } from "@/lib/domain/mission-types";
import { assertMissionInvariants, parseMission } from "@/lib/domain/mission-schema";
import { whatIsKubernetes } from "./foundations/what-is-kubernetes";
import { clusterArchitecture } from "./foundations/cluster-architecture";
import { desiredVsActualState } from "./foundations/desired-vs-actual-state";
import { apiObjects } from "./foundations/api-objects";
import { labelsAnnotationsOwnership } from "./foundations/labels-annotations-ownership";
import { declarativeWorkflow } from "./foundations/declarative-workflow";

const RAW: Mission[] = [
  whatIsKubernetes,
  clusterArchitecture,
  desiredVsActualState,
  apiObjects,
  labelsAnnotationsOwnership,
  declarativeWorkflow,
];

export const MISSIONS: Mission[] = RAW.map((m) => {
  const parsed = parseMission(m);
  assertMissionInvariants(parsed);
  return parsed;
});

export const MISSION_SECTIONS = ["Foundations"]; // grows as sections are migrated

export function isMissionSection(section: string): boolean {
  return MISSION_SECTIONS.includes(section);
}
export function getMissionsBySection(section: string): Mission[] {
  return MISSIONS.filter((m) => m.section === section).sort((a, b) => a.order - b.order);
}
export function getMissionBySlug(slug: string[]): Mission | undefined {
  const key = slug.join("/");
  return MISSIONS.find((m) => m.slug.join("/") === key);
}
export function missionHref(m: Mission): string {
  return `/docs/${m.slug.join("/")}`;
}

/**
 * Manifests that reconstruct the cluster state a mission expects on entry: the section's
 * seed plus every earlier mission's do-step files. Known approximation: a do-step's
 * initialValue is its STARTING yaml, not necessarily the learner's solved state: keep
 * do-step files authored so that applying them as-is yields the intended durable objects.
 */
export function accumulatedSeedManifests(mission: Mission): string[] {
  const section = getMissionsBySection(mission.section);
  const seeds: string[] = [...(section[0]?.seedManifests ?? [])];
  for (const prior of section) {
    if (prior.order >= mission.order) break;
    for (const step of prior.steps) {
      if (step.kind === "do") seeds.push(...step.files.map((f) => f.initialValue));
    }
  }
  return seeds;
}
