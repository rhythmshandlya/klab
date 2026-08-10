import { getMissionRun } from "@/content/curriculum/server";

import { MissionWorkspaceCard } from "./mission-workspace-card";

/** Resolve one authored mission on the server before crossing into its client workspace. */
export function MissionEmbed({ missionSlug }: { missionSlug: string }) {
  const run = getMissionRun(missionSlug);
  return run ? <MissionWorkspaceCard run={run} /> : null;
}
