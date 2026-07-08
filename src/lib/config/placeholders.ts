/**
 * TEMPORARY placeholder data.
 *
 * These stand in for values that will later come from real local progress
 * persistence (streak/XP) and an eventual auth/profile layer (see PROMPT.md:
 * "Clear TODOs for future backend/auth"). They are centralized here so no mock
 * data is copy-pasted into components. Replace when Phase 6 wiring lands.
 */

export const PLACEHOLDER_USER = {
  name: "Guest Operator",
  initials: "GO",
  level: 1,
} as const;

/** Starting demo stats shown in the top nav until real progress is loaded. */
export const PLACEHOLDER_STATS = {
  streakDays: 0,
  xp: 0,
} as const;
