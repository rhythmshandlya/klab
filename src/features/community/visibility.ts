import type { LeaderboardEntry } from "@/lib/db/community-repo";

export const COMMUNITY_COMPETITION_MIN_PLAYERS = 3;

/** Avoid presenting a one-person leaderboard as community competition. */
export function isCommunityCompetitionReady(
  leaderboard: readonly Pick<LeaderboardEntry, "userId">[],
): boolean {
  return (
    new Set(leaderboard.map((entry) => entry.userId)).size >= COMMUNITY_COMPETITION_MIN_PLAYERS
  );
}
