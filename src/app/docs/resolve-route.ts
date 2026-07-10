import { getLessonBySlug } from "@/content/docs";
import { getMissionBySlug, MISSIONS } from "@/content/missions";

export type DocsRoute =
  | { kind: "mission"; section: string; slug: string[] }
  | { kind: "legacy" }
  | { kind: "not-found" };

/**
 * Resolves a `/docs/[...slug]` route to either the migrated mission player, the
 * legacy `DocsPage`, or not-found. Pure — no React, no Next.js APIs — so it's
 * unit-testable in isolation from the route component.
 *
 * Mission match wins over a legacy lesson at the same slug: some Foundations
 * lessons haven't been deleted yet and share a slug with their migrated mission,
 * but the whole point of migration is that the mission player takes over.
 */
export function resolveDocsRoute(slug: string[]): DocsRoute {
  const mission = getMissionBySlug(slug);
  if (mission) {
    return { kind: "mission", section: mission.section, slug };
  }

  if (slug.length === 1) {
    const bareSectionMission = MISSIONS.find((m) => m.slug[0] === slug[0]);
    if (bareSectionMission) {
      return { kind: "mission", section: bareSectionMission.section, slug };
    }
  }

  if (getLessonBySlug(slug)) {
    return { kind: "legacy" };
  }

  return { kind: "not-found" };
}
