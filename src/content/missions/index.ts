import type { Mission } from "@/lib/domain/mission-types";
import { assertMissionInvariants, parseMission } from "@/lib/domain/mission-schema";
import { whatIsKubernetes } from "./foundations/what-is-kubernetes";
import { clusterArchitecture } from "./foundations/cluster-architecture";
import { desiredVsActualState } from "./foundations/desired-vs-actual-state";
import { apiObjects } from "./foundations/api-objects";

const RAW: Mission[] = [whatIsKubernetes, clusterArchitecture, desiredVsActualState, apiObjects];

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
