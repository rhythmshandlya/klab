"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { ADVANCED_UNLOCK_SOLVES, isLevelLocked, type LevelSummary } from "@/content/levels";
import type { Difficulty, KubernetesConcept } from "@/lib/domain/types";
import { mutateProgress } from "@/lib/storage/progress-store";
import { useProgress } from "@/features/progress/use-progress";
import { cn } from "@/lib/utils/cn";

/**
 * The /problems dashboard (reference: referance-images/problem-dashboard.png).
 * The catalog itself is static and arrives from the server component as props;
 * everything client-side here is presentation + local progress (filters, solved
 * state, bookmarks) read from localStorage.
 */

type LevelStatus = "solved" | "in-progress" | "unsolved" | "locked";
type StatusFilter = "all" | LevelStatus;
type Tab = "all" | "saved" | "completed";
type Sort = "featured" | "xp" | "time" | "success" | "title";

const DIFFICULTY_META: Record<Difficulty, { label: string; dot: string; tone: "success" | "warning" | "danger" }> = {
  beginner: { label: "Beginner", dot: "bg-green", tone: "success" },
  intermediate: { label: "Intermediate", dot: "bg-amber", tone: "warning" },
  advanced: { label: "Advanced", dot: "bg-red", tone: "danger" },
};

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"];

const CONCEPT_LABELS: Record<KubernetesConcept, string> = {
  pods: "Pods",
  deployments: "Deployments",
  replicasets: "ReplicaSets",
  services: "Services",
  endpoints: "Endpoints",
  endpointslices: "EndpointSlices",
  "labels-selectors": "Selectors",
  "readiness-probes": "Readiness Probes",
  "liveness-probes": "Liveness Probes",
  dns: "DNS",
  namespaces: "Namespaces",
  rollouts: "Rollouts",
  events: "Events",
  reconciliation: "Reconciliation",
  networking: "Networking",
  debugging: "Debugging",
};

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All problems" },
  { id: "solved", label: "Solved" },
  { id: "in-progress", label: "In progress" },
  { id: "unsolved", label: "Unsolved" },
  { id: "locked", label: "Locked" },
];

/** XP needed per player level (display only). */
const XP_PER_LEVEL = 500;

function hashString(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) hash = (hash * 33) ^ value.charCodeAt(i);
  return Math.abs(hash);
}

function localDay(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function ProblemsDashboard({ catalog }: { catalog: LevelSummary[] }) {
  const progress = useProgress();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<Sort>("featured");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<Set<Difficulty>>(new Set());
  const [topicFilter, setTopicFilter] = useState<Set<KubernetesConcept>>(new Set());
  const [showAllTopics, setShowAllTopics] = useState(false);

  const solved = useMemo(() => new Set(progress.solvedLevelSlugs), [progress.solvedLevelSlugs]);
  const attempted = useMemo(
    () => new Set(progress.attemptedLevelSlugs),
    [progress.attemptedLevelSlugs],
  );
  const saved = useMemo(() => new Set(progress.savedProblemSlugs), [progress.savedProblemSlugs]);
  const solvedCount = catalog.filter((l) => solved.has(l.slug)).length;

  const statusOf = useCallback(
    (level: LevelSummary): LevelStatus => {
      if (solved.has(level.slug)) return "solved";
      if (isLevelLocked(level.difficulty, solvedCount)) return "locked";
      if (attempted.has(level.slug)) return "in-progress";
      return "unsolved";
    },
    [solved, attempted, solvedCount],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: catalog.length,
      solved: 0,
      "in-progress": 0,
      unsolved: 0,
      locked: 0,
    };
    for (const level of catalog) counts[statusOf(level)] += 1;
    return counts;
  }, [catalog, statusOf]);

  const difficultyCounts = useMemo(() => {
    const counts = { beginner: 0, intermediate: 0, advanced: 0 };
    for (const level of catalog) counts[level.difficulty] += 1;
    return counts;
  }, [catalog]);

  const topicCounts = useMemo(() => {
    const counts = new Map<KubernetesConcept, number>();
    for (const level of catalog) {
      for (const concept of level.concepts) {
        counts.set(concept, (counts.get(concept) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [catalog]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let entries = catalog.map((level) => ({ level, status: statusOf(level) }));

    if (tab === "saved") entries = entries.filter((e) => saved.has(e.level.slug));
    if (tab === "completed") entries = entries.filter((e) => e.status === "solved");
    if (statusFilter !== "all") entries = entries.filter((e) => e.status === statusFilter);
    if (difficultyFilter.size > 0)
      entries = entries.filter((e) => difficultyFilter.has(e.level.difficulty));
    if (topicFilter.size > 0)
      entries = entries.filter((e) => e.level.concepts.some((c) => topicFilter.has(c)));
    if (q !== "")
      entries = entries.filter(
        (e) =>
          e.level.title.toLowerCase().includes(q) ||
          e.level.blurb.toLowerCase().includes(q) ||
          e.level.concepts.some((c) => CONCEPT_LABELS[c].toLowerCase().includes(q)),
      );

    const sorted = [...entries];
    if (sort === "xp") sorted.sort((a, b) => b.level.xp - a.level.xp);
    if (sort === "time") sorted.sort((a, b) => a.level.estimatedMinutes - b.level.estimatedMinutes);
    if (sort === "success") sorted.sort((a, b) => b.level.successRate - a.level.successRate);
    if (sort === "title") sorted.sort((a, b) => a.level.title.localeCompare(b.level.title));
    return sorted;
  }, [catalog, query, tab, sort, statusFilter, difficultyFilter, topicFilter, saved, statusOf]);

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setDifficultyFilter(new Set());
    setTopicFilter(new Set());
    setTab("all");
  };

  const toggleBookmark = (slug: string) => {
    // Identity-aware: writes localStorage optimistically and (when signed in) syncs
    // the bookmark to the server as a named idempotent intent.
    mutateProgress({ kind: "setSaved", slug, saved: !saved.has(slug) });
  };

  const unlockedUnsolved = catalog.filter((l) => statusOf(l) === "unsolved" || statusOf(l) === "in-progress");
  const dailyChallenge =
    unlockedUnsolved.length > 0
      ? unlockedUnsolved[hashString(localDay()) % unlockedUnsolved.length]
      : catalog[hashString(localDay()) % Math.max(1, catalog.length)];
  const continueLearning = catalog
    .filter((l) => attempted.has(l.slug) && !solved.has(l.slug))
    .slice(0, 3);
  const recommended = catalog
    .filter(
      (l) =>
        !solved.has(l.slug) &&
        !isLevelLocked(l.difficulty, solvedCount) &&
        l.slug !== dailyChallenge?.slug,
    )
    .slice(0, 3);

  const topicsShown = showAllTopics ? topicCounts : topicCounts.slice(0, 8);
  const playerLevel = Math.floor(progress.xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = progress.xp % XP_PER_LEVEL;

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-8 lg:px-6">
      <div className="grid gap-6 xl:grid-cols-[230px_minmax(0,1fr)] 2xl:grid-cols-[230px_minmax(0,1fr)_310px]">
        {/* ------------------------------------------------ Left rail: filters */}
        <aside aria-label="Problem filters" className="hidden xl:block">
          <div className="sticky top-20 space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-subtle flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase">
                <icons.filter className="size-3.5" aria-hidden />
                Filters
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="text-subtle hover:text-foreground text-xs transition-colors"
              >
                Clear all
              </button>
            </div>

            <FilterGroup label="Difficulty">
              {DIFFICULTIES.map((difficulty) => {
                const meta = DIFFICULTY_META[difficulty];
                const active = difficultyFilter.has(difficulty);
                return (
                  <label
                    key={difficulty}
                    className="text-muted hover:text-foreground flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => {
                        const next = new Set(difficultyFilter);
                        if (next.has(difficulty)) next.delete(difficulty);
                        else next.add(difficulty);
                        setDifficultyFilter(next);
                      }}
                      className="accent-primary size-3.5"
                    />
                    <span className={cn("size-2 rounded-full", meta.dot)} aria-hidden />
                    <span className={cn("flex-1", active && "text-foreground")}>{meta.label}</span>
                    <span className="tabnums text-subtle text-xs">
                      {difficultyCounts[difficulty]}
                    </span>
                  </label>
                );
              })}
            </FilterGroup>

            <FilterGroup label="Status">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStatusFilter(s.id)}
                  aria-pressed={statusFilter === s.id}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                    statusFilter === s.id
                      ? "bg-panel-hover text-foreground"
                      : "text-muted hover:bg-panel-hover hover:text-foreground",
                  )}
                >
                  {s.label}
                  <span className="tabnums text-subtle text-xs">{statusCounts[s.id]}</span>
                </button>
              ))}
            </FilterGroup>

            <FilterGroup label="Topics">
              {topicsShown.map(([concept, count]) => {
                const active = topicFilter.has(concept);
                return (
                  <label
                    key={concept}
                    className="text-muted hover:text-foreground flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => {
                        const next = new Set(topicFilter);
                        if (next.has(concept)) next.delete(concept);
                        else next.add(concept);
                        setTopicFilter(next);
                      }}
                      className="accent-primary size-3.5"
                    />
                    <span className={cn("flex-1", active && "text-foreground")}>
                      {CONCEPT_LABELS[concept]}
                    </span>
                    <span className="tabnums text-subtle text-xs">{count}</span>
                  </label>
                );
              })}
              {topicCounts.length > 8 ? (
                <button
                  type="button"
                  onClick={() => setShowAllTopics((v) => !v)}
                  className="text-blue px-2 py-1 text-xs hover:underline"
                >
                  {showAllTopics ? "Show fewer" : `Show all ${topicCounts.length}`}
                </button>
              ) : null}
            </FilterGroup>
          </div>
        </aside>

        {/* ------------------------------------------------ Main column */}
        <main className="min-w-0">
          <header>
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">Problems</h1>
            <p className="text-muted mt-1 text-[15px]">
              Master Kubernetes by solving real incident-inspired challenges.
            </p>
          </header>

          {/* Stat cards */}
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            <StatCard
              label="Total problems"
              value={String(catalog.length)}
              caption={`Across ${topicCounts.length} topics`}
              icon={<icons.problems className="text-blue size-4" aria-hidden />}
            />
            <StatCard
              label="Solved"
              value={String(solvedCount)}
              caption={`${Math.round((solvedCount / Math.max(1, catalog.length)) * 100)}% of total`}
              icon={<icons.success className="text-green size-4" aria-hidden />}
            />
            <StatCard
              label="In progress"
              value={String(statusCounts["in-progress"])}
              caption={statusCounts["in-progress"] > 0 ? "Keep going!" : "Pick one below"}
              icon={<icons.circle className="text-blue size-4" aria-hidden />}
            />
            <StatCard
              label="Completion"
              value={`${Math.round((solvedCount / Math.max(1, catalog.length)) * 100)}%`}
              caption={`${solvedCount} of ${catalog.length} solved`}
              icon={
                <ProgressRing
                  fraction={solvedCount / Math.max(1, catalog.length)}
                  size={18}
                  stroke={3}
                />
              }
            />
            <StatCard
              label="Day streak"
              value={String(progress.streakDays)}
              caption={progress.streakDays > 0 ? "Days in a row" : "Solve one today"}
              icon={<icons.streak className="text-amber size-4" aria-hidden />}
            />
          </div>

          {/* Tabs + search + sort */}
          <div className="border-border mt-6 flex items-center gap-1 border-b" role="tablist" aria-label="Problem views">
            {(
              [
                { id: "all", label: "All Problems", count: catalog.length },
                { id: "saved", label: "Saved", count: saved.size },
                { id: "completed", label: "Completed", count: solvedCount },
              ] as { id: Tab; label: string; count: number }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  tab === t.id
                    ? "border-blue text-foreground"
                    : "text-muted hover:text-foreground border-transparent",
                )}
              >
                {t.label}
                <span className="tabnums text-subtle text-xs">{t.count}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="border-border bg-panel focus-within:ring-ring flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border px-2.5 focus-within:ring-2">
              <icons.search className="text-subtle size-4 shrink-0" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search problems…"
                aria-label="Search problems"
                name="problem-search"
                className="text-foreground placeholder:text-subtle w-full min-w-0 bg-transparent text-sm outline-none"
              />
            </div>
            <label className="text-subtle flex items-center gap-2 text-xs">
              Sort by
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="border-border bg-panel text-foreground h-9 rounded-md border px-2 text-sm"
              >
                <option value="featured">Featured</option>
                <option value="xp">XP</option>
                <option value="time">Est. time</option>
                <option value="success">Success rate</option>
                <option value="title">Title</option>
              </select>
            </label>
          </div>

          {/* Problem table */}
          <div className="border-border mt-4 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-border bg-panel border-b">
                  <Th className="w-12 pl-4">Status</Th>
                  <Th>Title</Th>
                  <Th className="w-28">Difficulty</Th>
                  <Th className="hidden w-44 lg:table-cell">Topics</Th>
                  <Th className="w-16">XP</Th>
                  <Th className="hidden w-32 md:table-cell">Success</Th>
                  <Th className="hidden w-20 md:table-cell">Est.</Th>
                  <Th className="w-10 pr-3">
                    <span className="sr-only">Save</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-muted px-4 py-10 text-center text-sm">
                      No problems match these filters.
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="text-blue ml-2 hover:underline"
                      >
                        Clear filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  rows.map(({ level, status }) => (
                    <ProblemRow
                      key={level.slug}
                      level={level}
                      status={status}
                      saved={saved.has(level.slug)}
                      onToggleSaved={() => toggleBookmark(level.slug)}
                      solvedCount={solvedCount}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-subtle mt-3 text-xs">
            Showing {rows.length} of {catalog.length} problems
            {statusCounts.locked > 0
              ? ` · Advanced problems unlock after ${ADVANCED_UNLOCK_SOLVES} solves`
              : ""}
          </p>
        </main>

        {/* ------------------------------------------------ Right rail */}
        <aside aria-label="Your activity" className="hidden space-y-4 2xl:block">
          {/* Daily challenge */}
          {dailyChallenge ? (
            <RailCard
              title="Daily Challenge"
              icon={<icons.challenge className="text-amber size-4" aria-hidden />}
            >
              {solved.has(dailyChallenge.slug) ? (
                <p className="text-green mb-2 flex items-center gap-1.5 text-xs font-medium">
                  <icons.success className="size-3.5" aria-hidden />
                  Completed today
                </p>
              ) : null}
              <p className="text-foreground text-sm font-semibold">{dailyChallenge.title}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <Badge tone={DIFFICULTY_META[dailyChallenge.difficulty].tone}>
                  {DIFFICULTY_META[dailyChallenge.difficulty].label}
                </Badge>
                <span className="text-purple flex items-center gap-1 text-xs font-medium">
                  <icons.xp className="size-3" aria-hidden />+{dailyChallenge.xp} XP
                </span>
              </div>
              <p className="text-muted mt-2 text-xs leading-relaxed">{dailyChallenge.blurb}</p>
              <Link
                href={`/problems/${dailyChallenge.slug}`}
                className="bg-primary text-primary-foreground hover:bg-primary/90 mt-3 flex h-8 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors"
              >
                View Challenge
                <icons.arrowRight className="size-3.5" aria-hidden />
              </Link>
            </RailCard>
          ) : null}

          {/* Continue learning */}
          {continueLearning.length > 0 ? (
            <RailCard
              title="Continue Learning"
              icon={<icons.run className="text-blue size-4" aria-hidden />}
            >
              <ul className="space-y-1">
                {continueLearning.map((level) => (
                  <li key={level.slug}>
                    <Link
                      href={`/problems/${level.slug}`}
                      className="hover:bg-panel-hover group flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors"
                    >
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          DIFFICULTY_META[level.difficulty].dot,
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-foreground block truncate text-sm">{level.title}</span>
                        <span className="text-subtle text-xs">
                          {DIFFICULTY_META[level.difficulty].label} · in progress
                        </span>
                      </span>
                      <icons.arrowRight
                        className="text-subtle size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </RailCard>
          ) : null}

          {/* Recommended */}
          {recommended.length > 0 ? (
            <RailCard
              title="Recommended for You"
              icon={<icons.docsInteractive className="text-purple size-4" aria-hidden />}
            >
              <p className="text-subtle mb-2 text-xs">Based on your progress</p>
              <ul className="space-y-1">
                {recommended.map((level) => (
                  <li key={level.slug}>
                    <Link
                      href={`/problems/${level.slug}`}
                      className="hover:bg-panel-hover group flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="text-foreground block truncate text-sm">{level.title}</span>
                        <span className="text-subtle text-xs">
                          {DIFFICULTY_META[level.difficulty].label} · ~{level.estimatedMinutes}m
                        </span>
                      </span>
                      <span className="text-purple flex shrink-0 items-center gap-1 text-xs">
                        <icons.xp className="size-3" aria-hidden />+{level.xp}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </RailCard>
          ) : null}

          {/* Your progress */}
          <RailCard
            title="Your Progress"
            icon={<icons.trophy className="text-green size-4" aria-hidden />}
            action={
              <Link href="/progress" className="text-blue text-xs hover:underline">
                View all
              </Link>
            }
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <ProgressRing fraction={solvedCount / Math.max(1, catalog.length)} size={72} stroke={7} />
                <span className="text-foreground absolute inset-0 flex items-center justify-center text-sm font-semibold">
                  {Math.round((solvedCount / Math.max(1, catalog.length)) * 100)}%
                </span>
              </div>
              <ul className="flex-1 space-y-1 text-xs">
                <ProgressLegend color="bg-green" label="Solved" value={statusCounts.solved} />
                <ProgressLegend color="bg-blue" label="In progress" value={statusCounts["in-progress"]} />
                <ProgressLegend color="bg-border-strong" label="Unsolved" value={statusCounts.unsolved} />
                <ProgressLegend color="bg-amber" label="Locked" value={statusCounts.locked} />
              </ul>
            </div>
            <div className="border-border mt-4 border-t pt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">
                  <span className="tabnums text-foreground font-medium">{progress.xp}</span> /{" "}
                  {playerLevel * XP_PER_LEVEL} XP to Level {playerLevel + 1}
                </span>
                <Badge tone="info">Level {playerLevel}</Badge>
              </div>
              <div
                className="bg-panel-elevated mt-2 h-1.5 overflow-hidden rounded-full"
                role="progressbar"
                aria-label={`XP toward level ${playerLevel + 1}`}
                aria-valuenow={xpIntoLevel}
                aria-valuemin={0}
                aria-valuemax={XP_PER_LEVEL}
              >
                <div
                  className="bg-blue h-full rounded-full transition-all"
                  style={{ width: `${(xpIntoLevel / XP_PER_LEVEL) * 100}%` }}
                />
              </div>
            </div>
          </RailCard>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-subtle mb-1 px-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  caption,
  icon,
}: {
  label: string;
  value: string;
  caption: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="border-border bg-panel rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-subtle text-xs">{label}</p>
        {icon}
      </div>
      <p className="tabnums text-foreground mt-2 text-2xl font-semibold">{value}</p>
      <p className="text-subtle mt-0.5 truncate text-xs">{caption}</p>
    </div>
  );
}

function Th({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className={cn(
        "text-subtle px-3 py-2.5 text-[11px] font-semibold tracking-[0.06em] uppercase",
        className,
      )}
    >
      {children}
    </th>
  );
}

function StatusIcon({ status }: { status: LevelStatus }) {
  if (status === "solved")
    return <icons.success className="text-green size-4" aria-label="Solved" />;
  if (status === "locked") return <icons.lock className="text-subtle size-4" aria-label="Locked" />;
  if (status === "in-progress")
    return (
      <span
        className="border-blue flex size-4 items-center justify-center rounded-full border-2"
        aria-label="In progress"
      >
        <span className="bg-blue size-1.5 rounded-full" />
      </span>
    );
  return (
    <span
      className="border-border-strong block size-4 rounded-full border-2"
      aria-label="Unsolved"
    />
  );
}

function ProblemRow({
  level,
  status,
  saved,
  onToggleSaved,
  solvedCount,
}: {
  level: LevelSummary;
  status: LevelStatus;
  saved: boolean;
  onToggleSaved: () => void;
  solvedCount: number;
}) {
  const meta = DIFFICULTY_META[level.difficulty];
  const locked = status === "locked";
  const remaining = Math.max(0, ADVANCED_UNLOCK_SOLVES - solvedCount);

  const title = (
    <>
      <span className={cn("block text-sm font-medium", locked ? "text-muted" : "text-foreground")}>
        {level.title}
      </span>
      <span className="text-subtle mt-0.5 block truncate text-xs">
        {locked ? `Locked — solve ${remaining} more problem${remaining === 1 ? "" : "s"}` : level.blurb}
      </span>
    </>
  );

  return (
    <tr
      className={cn(
        "border-border border-b transition-colors last:border-b-0",
        locked ? "opacity-60" : "hover:bg-panel-hover",
      )}
    >
      <td className="py-3 pr-1 pl-4 align-middle">
        <StatusIcon status={status} />
      </td>
      <td className="max-w-0 px-3 py-3 align-middle">
        {locked ? (
          title
        ) : (
          <Link href={`/problems/${level.slug}`} className="group block">
            {title}
          </Link>
        )}
      </td>
      <td className="px-3 py-3 align-middle">
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </td>
      <td className="hidden px-3 py-3 align-middle lg:table-cell">
        <span className="flex flex-wrap gap-1">
          {level.concepts.slice(0, 2).map((concept) => (
            <span
              key={concept}
              className="border-border bg-panel-elevated text-subtle rounded border px-1.5 py-0.5 text-[11px] whitespace-nowrap"
            >
              {CONCEPT_LABELS[concept]}
            </span>
          ))}
        </span>
      </td>
      <td className="px-3 py-3 align-middle">
        <span className="text-purple flex items-center gap-1 text-sm font-medium">
          <icons.xp className="size-3.5" aria-hidden />
          <span className="tabnums">{level.xp}</span>
        </span>
      </td>
      <td className="hidden px-3 py-3 align-middle md:table-cell">
        <span className="flex items-center gap-2">
          <span className="tabnums text-muted w-8 text-xs">{level.successRate}%</span>
          <span className="bg-panel-elevated h-1 w-14 overflow-hidden rounded-full">
            <span
              className={cn(
                "block h-full rounded-full",
                level.successRate >= 60 ? "bg-green" : level.successRate >= 45 ? "bg-amber" : "bg-red",
              )}
              style={{ width: `${level.successRate}%` }}
            />
          </span>
        </span>
      </td>
      <td className="hidden px-3 py-3 align-middle md:table-cell">
        <span className="text-muted flex items-center gap-1 text-xs">
          <icons.clock className="size-3.5" aria-hidden />
          {level.estimatedMinutes}m
        </span>
      </td>
      <td className="py-3 pr-3 pl-1 align-middle">
        <button
          type="button"
          onClick={onToggleSaved}
          aria-label={saved ? `Remove ${level.title} from saved` : `Save ${level.title}`}
          aria-pressed={saved}
          className={cn(
            "hover:text-blue rounded p-1 transition-colors",
            saved ? "text-blue" : "text-subtle",
          )}
        >
          <icons.bookmark className={cn("size-4", saved && "fill-current")} aria-hidden />
        </button>
      </td>
    </tr>
  );
}

function RailCard({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-panel rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ProgressRing({
  fraction,
  size,
  stroke,
}: {
  fraction: number;
  size: number;
  stroke: number;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        className="stroke-panel-elevated"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${clamped * circumference} ${circumference}`}
        className="stroke-green"
      />
    </svg>
  );
}

function ProgressLegend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <li className="flex items-center gap-2">
      <span className={cn("size-2 rounded-full", color)} aria-hidden />
      <span className="text-muted flex-1">{label}</span>
      <span className="tabnums text-foreground">{value}</span>
    </li>
  );
}
