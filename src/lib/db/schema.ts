import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Postgres schema (Drizzle). Two groups:
 *
 *  1. Better Auth core tables (`user`/`session`/`account`/`verification`) — the
 *     property keys MUST match Better Auth's field names (camelCase) so its Drizzle
 *     adapter resolves them; SQL column names are snake_case. Shapes mirror
 *     @better-auth/core 1.6.x exactly (+ the anonymous plugin's `isAnonymous`).
 *     Reconcile with `pnpm dlx @better-auth/cli generate` if Better Auth is upgraded.
 *
 *  2. klab app tables — USER DATA ONLY. Problems live in code and are referenced by
 *     `level_slug` (text, no FK). XP / streak / per-slug hint penalty are NOT stored;
 *     they are derived from these grow-only rows so every write is an idempotent,
 *     commutative upsert (safe under concurrent devices and guest→account merge).
 */

// ---------------------------------------------------------------------------
// Better Auth core
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  isAnonymous: boolean("is_anonymous").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// klab app tables (user data only)
// ---------------------------------------------------------------------------

/** One row per (user, solved level). XP is snapshotted at solve time, never mutated. */
export const progressSolved = pgTable(
  "progress_solved",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    levelSlug: text("level_slug").notNull(),
    awardedXp: integer("awarded_xp").notNull(),
    /** Client-local calendar day (YYYY-MM-DD) — streaks derive from the distinct set. */
    solvedDay: text("solved_day").notNull(),
    solvedAt: timestamp("solved_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.levelSlug] })],
);

/** One row per (user, attempted level). Marks "in progress". */
export const progressAttempted = pgTable(
  "progress_attempted",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    levelSlug: text("level_slug").notNull(),
    firstAttemptAt: timestamp("first_attempt_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.levelSlug] })],
);

/** One row per (user, completed docs lesson). Grow-only; drives docs progress + checkmarks. */
export const progressCompletedLessons = pgTable(
  "progress_completed_lessons",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lessonSlug: text("lesson_slug").notNull(),
    completedAt: timestamp("completed_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonSlug] })],
);

/** Bookmarked problems (the catalog "Saved" tab). Absolute membership, not a toggle. */
export const bookmarks = pgTable(
  "bookmarks",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    levelSlug: text("level_slug").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.levelSlug] })],
);

/**
 * One row per revealed hint. Per-slug penalty = SUM(penalty). Imported guest penalties
 * (which lack hint ids) use the synthetic hintId "__imported__".
 */
export const hintReveals = pgTable(
  "hint_reveals",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    levelSlug: text("level_slug").notNull(),
    hintId: text("hint_id").notNull(),
    penalty: integer("penalty").notNull(),
    revealedAt: timestamp("revealed_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.levelSlug, t.hintId] })],
);

/** Append-only browser-validated telemetry for qualified success/time aggregates. */
export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    levelSlug: text("level_slug").notNull(),
    passed: boolean("passed").notNull(),
    checksTotal: integer("checks_total").notNull(),
    checksPassed: integer("checks_passed").notNull(),
    /** Time from level-open to this submit, ms (null if not measured). */
    durationMs: integer("duration_ms"),
    hintsRevealed: integer("hints_revealed"),
    /** Full validator results + submitted files snapshot for replay. */
    results: jsonb("results"),
    /** Dedupe key for at-least-once client retries. */
    clientMutationId: text("client_mutation_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("submissions_client_mutation_id_key").on(t.clientMutationId),
    index("submissions_level_passed_idx").on(t.levelSlug, t.passed),
    index("submissions_level_created_idx").on(t.levelSlug, t.createdAt),
    index("submissions_user_level_idx").on(t.userId, t.levelSlug),
  ],
);

/** Named playground saves (arbitrary manifest sets), synced for signed-in users. */
export const sandboxes = pgTable(
  "sandboxes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    templateId: text("template_id").notNull(),
    files: jsonb("files").notNull(),
    savedAt: timestamp("saved_at").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sandboxes_user_name_key").on(t.userId, t.name)],
);

/** Guards guest→account imports from double-counting on repeat. */
export const mergeLog = pgTable(
  "merge_log",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.fingerprint] })],
);

/** Full schema object for the Drizzle adapter + query builder. */
export const schema = {
  user,
  session,
  account,
  verification,
  progressSolved,
  progressAttempted,
  progressCompletedLessons,
  bookmarks,
  hintReveals,
  submissions,
  sandboxes,
  mergeLog,
};
