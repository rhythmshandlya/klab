import { LEVEL_CATALOG } from "@/content/levels";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ROTATION_EPOCH = Date.UTC(2026, 0, 5);

function mondayUtc(date: Date): Date {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayFromMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - dayFromMonday);
  return start;
}

export interface WeeklyChallenge {
  level: (typeof LEVEL_CATALOG)[number];
  startsAt: Date;
  endsAt: Date;
}

/** Stable catalog rotation: every visitor sees the same challenge for the UTC week. */
export function getWeeklyChallenge(now: Date = new Date()): WeeklyChallenge {
  const startsAt = mondayUtc(now);
  const endsAt = new Date(startsAt.getTime() + WEEK_MS);
  const elapsedWeeks = Math.floor((startsAt.getTime() - ROTATION_EPOCH) / WEEK_MS);
  const index =
    ((elapsedWeeks % LEVEL_CATALOG.length) + LEVEL_CATALOG.length) % LEVEL_CATALOG.length;
  return { level: LEVEL_CATALOG[index]!, startsAt, endsAt };
}
