"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import {
  getLevelBySlug,
  isLevelLocked,
  missingPrerequisites,
  type LevelSummary,
} from "@/content/levels";
import type { Difficulty, KubernetesConcept, ProblemLearningPath } from "@/lib/domain/types";
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
type Tab = "all" | "architects" | "incidents" | "saved" | "completed";
type Sort = "featured" | "xp" | "time" | "success" | "title";
type PathFilter = "all" | ProblemLearningPath;

const PAGE_SIZE = 20;

const DIFFICULTY_META: Record<
  Difficulty,
  { label: string; dot: string; tone: "success" | "warning" | "danger" | "achievement" }
> = {
  beginner: { label: "Beginner", dot: "bg-green", tone: "success" },
  intermediate: { label: "Intermediate", dot: "bg-amber", tone: "warning" },
  advanced: { label: "Advanced", dot: "bg-red", tone: "danger" },
  architect: { label: "Architect", dot: "bg-purple", tone: "achievement" },
};

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced", "architect"];

const LEARNING_PATH_LABELS: Record<ProblemLearningPath, string> = {
  "kubernetes-foundations": "Foundations",
  "application-debugging": "App debugging",
  networking: "Networking",
  reliability: "Reliability",
  "sre-on-call": "SRE / on-call",
  "platform-architect": "Platform architect",
};
const LEARNING_PATHS = Object.keys(LEARNING_PATH_LABELS) as ProblemLearningPath[];

const CONCEPT_LABELS: Record<KubernetesConcept, string> = {
  pods: "Pods",
  deployments: "Deployments",
  replicasets: "ReplicaSets",
  statefulsets: "StatefulSets",
  daemonsets: "DaemonSets",
  jobs: "Jobs",
  cronjobs: "CronJobs",
  services: "Services",
  ingress: "Ingress",
  "gateway-api": "Gateway API",
  endpoints: "Endpoints",
  endpointslices: "EndpointSlices",
  "labels-selectors": "Selectors",
  annotations: "Annotations",
  "owners-gc": "Ownership",
  "readiness-probes": "Readiness Probes",
  "liveness-probes": "Liveness Probes",
  "startup-probes": "Startup Probes",
  "init-containers": "Init Containers",
  "sidecar-containers": "Sidecars",
  "lifecycle-hooks": "Lifecycle Hooks",
  dns: "DNS",
  namespaces: "Namespaces",
  rollouts: "Rollouts",
  disruptions: "Disruptions",
  events: "Events",
  logs: "Logs",
  resources: "Resources",
  "resource-quotas": "Resource Quotas",
  "limit-ranges": "LimitRanges",
  configmaps: "ConfigMaps",
  secrets: "Secrets",
  storage: "Storage",
  "service-accounts": "Service Accounts",
  rbac: "RBAC",
  "security-contexts": "Security Contexts",
  "network-policies": "Network Policies",
  scheduling: "Scheduling",
  autoscaling: "Autoscaling",
  "object-management": "Object Management",
  kustomize: "Kustomize",
  crds: "CRDs",
  operators: "Operators",
  "admission-controllers": "Admission",
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const progress = useProgress();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [tab, setTab] = useState<Tab>(() =>
    readChoice(
      searchParams.get("view"),
      ["all", "architects", "incidents", "saved", "completed"],
      "all",
    ),
  );
  const [sort, setSort] = useState<Sort>(() =>
    readChoice(
      searchParams.get("sort"),
      ["featured", "xp", "time", "success", "title"],
      "featured",
    ),
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() =>
    readChoice(
      searchParams.get("status"),
      ["all", "solved", "in-progress", "unsolved", "locked"],
      "all",
    ),
  );
  const [difficultyFilter, setDifficultyFilter] = useState<Set<Difficulty>>(() =>
    readSet(searchParams.get("difficulty"), DIFFICULTIES),
  );
  const [topicFilter, setTopicFilter] = useState<Set<KubernetesConcept>>(() =>
    readSet(searchParams.get("topic"), Object.keys(CONCEPT_LABELS) as KubernetesConcept[]),
  );
  const [pathFilter, setPathFilter] = useState<PathFilter>(() =>
    readChoice(searchParams.get("path"), ["all", ...LEARNING_PATHS], "all"),
  );
  const [page, setPage] = useState(() => positiveInt(searchParams.get("page")));
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
      if (isLevelLocked(level, solved)) return "locked";
      if (attempted.has(level.slug)) return "in-progress";
      return "unsolved";
    },
    [solved, attempted],
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
    const counts: Record<Difficulty, number> = {
      beginner: 0,
      intermediate: 0,
      advanced: 0,
      architect: 0,
    };
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

  const pathCounts = useMemo(() => {
    const counts = Object.fromEntries(LEARNING_PATHS.map((path) => [path, 0])) as Record<
      ProblemLearningPath,
      number
    >;
    for (const level of catalog) {
      for (const path of level.learningPaths) counts[path] += 1;
    }
    return counts;
  }, [catalog]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let entries = catalog.map((level) => ({ level, status: statusOf(level) }));

    if (tab === "saved") entries = entries.filter((e) => saved.has(e.level.slug));
    if (tab === "completed") entries = entries.filter((e) => e.status === "solved");
    if (tab === "architects") entries = entries.filter((e) => e.level.challengeMode === "build");
    if (tab === "incidents") entries = entries.filter((e) => e.level.incidentSource);
    if (statusFilter !== "all") entries = entries.filter((e) => e.status === statusFilter);
    if (difficultyFilter.size > 0)
      entries = entries.filter((e) => difficultyFilter.has(e.level.difficulty));
    if (topicFilter.size > 0)
      entries = entries.filter((e) => e.level.concepts.some((c) => topicFilter.has(c)));
    if (pathFilter !== "all")
      entries = entries.filter((e) => e.level.learningPaths.includes(pathFilter));
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
  }, [
    catalog,
    query,
    tab,
    sort,
    statusFilter,
    difficultyFilter,
    topicFilter,
    pathFilter,
    saved,
    statusOf,
  ]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    const syncFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      setQuery(params.get("q") ?? "");
      setTab(
        readChoice<Tab>(
          params.get("view"),
          ["all", "architects", "incidents", "saved", "completed"],
          "all",
        ),
      );
      setSort(
        readChoice<Sort>(
          params.get("sort"),
          ["featured", "xp", "time", "success", "title"],
          "featured",
        ),
      );
      setStatusFilter(
        readChoice<StatusFilter>(
          params.get("status"),
          ["all", "solved", "in-progress", "unsolved", "locked"],
          "all",
        ),
      );
      setDifficultyFilter(readSet(params.get("difficulty"), DIFFICULTIES));
      setTopicFilter(
        readSet(params.get("topic"), Object.keys(CONCEPT_LABELS) as KubernetesConcept[]),
      );
      setPathFilter(readChoice<PathFilter>(params.get("path"), ["all", ...LEARNING_PATHS], "all"));
      setPage(positiveInt(params.get("page")));
    };

    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = new URLSearchParams();
      if (query.trim()) next.set("q", query.trim());
      if (tab !== "all") next.set("view", tab);
      if (sort !== "featured") next.set("sort", sort);
      if (statusFilter !== "all") next.set("status", statusFilter);
      if (difficultyFilter.size > 0) next.set("difficulty", [...difficultyFilter].sort().join(","));
      if (topicFilter.size > 0) next.set("topic", [...topicFilter].sort().join(","));
      if (pathFilter !== "all") next.set("path", pathFilter);
      if (currentPage > 1) next.set("page", String(currentPage));
      const queryString = next.toString();
      if (queryString !== window.location.search.slice(1)) {
        router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [
    query,
    tab,
    sort,
    statusFilter,
    difficultyFilter,
    topicFilter,
    pathFilter,
    currentPage,
    pathname,
    router,
  ]);

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setDifficultyFilter(new Set());
    setTopicFilter(new Set());
    setPathFilter("all");
    setTab("all");
    setPage(1);
  };

  const toggleBookmark = (slug: string) => {
    // Identity-aware: writes localStorage optimistically and (when signed in) syncs
    // the bookmark to the server as a named idempotent intent.
    mutateProgress({ kind: "setSaved", slug, saved: !saved.has(slug) });
  };

  const unlockedUnsolved = catalog.filter(
    (l) => statusOf(l) === "unsolved" || statusOf(l) === "in-progress",
  );
  const dailyChallenge =
    unlockedUnsolved.length > 0
      ? unlockedUnsolved[hashString(localDay()) % unlockedUnsolved.length]
      : catalog[hashString(localDay()) % Math.max(1, catalog.length)];
  const continueLearning = catalog
    .filter((l) => attempted.has(l.slug) && !solved.has(l.slug))
    .slice(0, 3);
  const recommended = catalog
    .filter(
      (l) => !solved.has(l.slug) && !isLevelLocked(l, solved) && l.slug !== dailyChallenge?.slug,
    )
    .slice(0, 3);

  const topicsShown = showAllTopics ? topicCounts : topicCounts.slice(0, 8);
  const activeFilterCount =
    difficultyFilter.size +
    topicFilter.size +
    (statusFilter === "all" ? 0 : 1) +
    (pathFilter === "all" ? 0 : 1);
  const filterControlsProps: ProblemFilterControlsProps = {
    difficultyFilter,
    difficultyCounts,
    onToggleDifficulty: (difficulty) => {
      setDifficultyFilter(toggleSet(difficultyFilter, difficulty));
      setPage(1);
    },
    statusFilter,
    statusCounts,
    onStatusChange: (status) => {
      setStatusFilter(status);
      setPage(1);
    },
    topicFilter,
    topicsShown,
    topicCount: topicCounts.length,
    showAllTopics,
    onToggleTopic: (topic) => {
      setTopicFilter(toggleSet(topicFilter, topic));
      setPage(1);
    },
    onToggleAllTopics: () => setShowAllTopics((value) => !value),
    pathFilter,
    pathCounts,
    onPathChange: (path) => {
      setPathFilter(path);
      setPage(1);
    },
    onClear: clearFilters,
  };
  const playerLevel = Math.floor(progress.xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = progress.xp % XP_PER_LEVEL;

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-8 lg:px-6">
      <div className="grid gap-6 xl:grid-cols-[230px_minmax(0,1fr)] 2xl:grid-cols-[230px_minmax(0,1fr)_310px]">
        {/* ------------------------------------------------ Left rail: filters */}
        <aside aria-label="Problem filters" className="hidden xl:block">
          <div className="sticky top-20">
            <ProblemFilterControls {...filterControlsProps} />
          </div>
        </aside>

        {/* ------------------------------------------------ Main column */}
        <main className="min-w-0">
          <header>
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">Problems</h1>
            <p className="text-muted mt-1 text-[15px]">
              Repair production incidents, then build complete Kubernetes systems.
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
          <div
            className="border-border mt-6 flex items-center gap-1 overflow-x-auto border-b"
            role="tablist"
            aria-label="Problem views"
          >
            {(
              [
                { id: "all", label: "All Problems", count: catalog.length },
                {
                  id: "architects",
                  label: "Final Boss",
                  count: catalog.filter((level) => level.challengeMode === "build").length,
                },
                {
                  id: "incidents",
                  label: "Incident Inspired",
                  count: catalog.filter((level) => level.incidentSource).length,
                },
                { id: "saved", label: "Saved", count: saved.size },
                { id: "completed", label: "Completed", count: solvedCount },
              ] as { id: Tab; label: string; count: number }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => {
                  setTab(t.id);
                  setPage(1);
                }}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
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
            <MobileProblemFilters activeFilterCount={activeFilterCount} {...filterControlsProps} />
            <div className="border-border bg-panel focus-within:ring-ring flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border px-2.5 focus-within:ring-2">
              <icons.search className="text-subtle size-4 shrink-0" aria-hidden />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
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
                onChange={(event) => {
                  setSort(event.target.value as Sort);
                  setPage(1);
                }}
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
                  <Th className="hidden w-36 md:table-cell">Success</Th>
                  <Th className="hidden w-20 md:table-cell">Est.</Th>
                  <Th className="w-10 pr-3">
                    <span className="sr-only">Save</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.length === 0 ? (
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
                  pagedRows.map(({ level, status }) => (
                    <ProblemRow
                      key={level.slug}
                      level={level}
                      status={status}
                      saved={saved.has(level.slug)}
                      onToggleSaved={() => toggleBookmark(level.slug)}
                      solvedSlugs={solved}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-subtle text-xs">
              Showing {rows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}-
              {Math.min(currentPage * PAGE_SIZE, rows.length)} of {rows.length} matching problems
              {rows.length !== catalog.length ? ` (${catalog.length} total)` : ""}
            </p>
            {pageCount > 1 ? (
              <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} />
            ) : null}
          </div>
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
                        <span className="text-foreground block truncate text-sm">
                          {level.title}
                        </span>
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
                        <span className="text-foreground block truncate text-sm">
                          {level.title}
                        </span>
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
              <Link href="/community" className="text-blue text-xs hover:underline">
                View all
              </Link>
            }
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <ProgressRing
                  fraction={solvedCount / Math.max(1, catalog.length)}
                  size={72}
                  stroke={7}
                />
                <span className="text-foreground absolute inset-0 flex items-center justify-center text-sm font-semibold">
                  {Math.round((solvedCount / Math.max(1, catalog.length)) * 100)}%
                </span>
              </div>
              <ul className="flex-1 space-y-1 text-xs">
                <ProgressLegend color="bg-green" label="Solved" value={statusCounts.solved} />
                <ProgressLegend
                  color="bg-blue"
                  label="In progress"
                  value={statusCounts["in-progress"]}
                />
                <ProgressLegend
                  color="bg-border-strong"
                  label="Unsolved"
                  value={statusCounts.unsolved}
                />
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

interface ProblemFilterControlsProps {
  difficultyFilter: ReadonlySet<Difficulty>;
  difficultyCounts: Record<Difficulty, number>;
  onToggleDifficulty: (difficulty: Difficulty) => void;
  statusFilter: StatusFilter;
  statusCounts: Record<StatusFilter, number>;
  onStatusChange: (status: StatusFilter) => void;
  topicFilter: ReadonlySet<KubernetesConcept>;
  topicsShown: [KubernetesConcept, number][];
  topicCount: number;
  showAllTopics: boolean;
  onToggleTopic: (topic: KubernetesConcept) => void;
  onToggleAllTopics: () => void;
  pathFilter: PathFilter;
  pathCounts: Record<ProblemLearningPath, number>;
  onPathChange: (path: PathFilter) => void;
  onClear: () => void;
}

function ProblemFilterControls({
  difficultyFilter,
  difficultyCounts,
  onToggleDifficulty,
  statusFilter,
  statusCounts,
  onStatusChange,
  topicFilter,
  topicsShown,
  topicCount,
  showAllTopics,
  onToggleTopic,
  onToggleAllTopics,
  pathFilter,
  pathCounts,
  onPathChange,
  onClear,
}: ProblemFilterControlsProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-subtle flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase">
          <icons.filter className="size-3.5" aria-hidden />
          Filters
        </p>
        <button
          type="button"
          onClick={onClear}
          className="text-subtle hover:text-foreground text-xs transition-colors"
        >
          Clear all
        </button>
      </div>

      <FilterGroup label="Study path">
        <select
          value={pathFilter}
          onChange={(event) => onPathChange(event.target.value as PathFilter)}
          aria-label="Study path"
          className="border-border bg-panel text-foreground h-9 w-full rounded-md border px-2 text-sm"
        >
          <option value="all">All paths</option>
          {LEARNING_PATHS.map((path) => (
            <option key={path} value={path}>
              {LEARNING_PATH_LABELS[path]} ({pathCounts[path]})
            </option>
          ))}
        </select>
      </FilterGroup>

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
                onChange={() => onToggleDifficulty(difficulty)}
                className="accent-primary size-3.5"
              />
              <span className={cn("size-2 rounded-full", meta.dot)} aria-hidden />
              <span className={cn("flex-1", active && "text-foreground")}>{meta.label}</span>
              <span className="tabnums text-subtle text-xs">{difficultyCounts[difficulty]}</span>
            </label>
          );
        })}
      </FilterGroup>

      <FilterGroup label="Status">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status.id}
            type="button"
            onClick={() => onStatusChange(status.id)}
            aria-pressed={statusFilter === status.id}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              statusFilter === status.id
                ? "bg-panel-hover text-foreground"
                : "text-muted hover:bg-panel-hover hover:text-foreground",
            )}
          >
            {status.label}
            <span className="tabnums text-subtle text-xs">{statusCounts[status.id]}</span>
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
                onChange={() => onToggleTopic(concept)}
                className="accent-primary size-3.5"
              />
              <span className={cn("flex-1", active && "text-foreground")}>
                {CONCEPT_LABELS[concept]}
              </span>
              <span className="tabnums text-subtle text-xs">{count}</span>
            </label>
          );
        })}
        {topicCount > 8 ? (
          <button
            type="button"
            onClick={onToggleAllTopics}
            className="text-blue px-2 py-1 text-xs hover:underline"
          >
            {showAllTopics ? "Show fewer" : `Show all ${topicCount}`}
          </button>
        ) : null}
      </FilterGroup>
    </div>
  );
}

function MobileProblemFilters({
  activeFilterCount,
  ...filters
}: ProblemFilterControlsProps & { activeFilterCount: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="border-border bg-panel text-foreground hover:bg-panel-hover inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors xl:hidden"
        >
          <icons.filter className="size-4" aria-hidden />
          Filters
          {activeFilterCount > 0 ? (
            <span className="bg-blue text-primary-foreground tabnums inline-flex size-5 items-center justify-center rounded-full text-[10px]">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-black/70 backdrop-blur-sm xl:hidden" />
        <Dialog.Content className="anim-drawer-left border-border bg-panel-elevated fixed inset-y-0 left-0 z-50 flex w-[min(21rem,88vw)] flex-col border-r shadow-2xl xl:hidden">
          <div className="border-border flex h-14 shrink-0 items-center justify-between border-b px-4">
            <Dialog.Title className="text-foreground font-semibold">Problem filters</Dialog.Title>
            <Dialog.Description className="sr-only">
              Filter the catalog by study path, difficulty, status, and topic.
            </Dialog.Description>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close problem filters"
                className="text-muted hover:bg-panel-hover hover:text-foreground inline-flex size-8 items-center justify-center rounded-md transition-colors"
              >
                <icons.close className="size-4" aria-hidden />
              </button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <ProblemFilterControls {...filters} />
          </div>
          <div className="border-border shrink-0 border-t p-4">
            <Dialog.Close asChild>
              <button
                type="button"
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 w-full rounded-md text-sm font-medium transition-colors"
              >
                Show matching problems
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Pagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <nav aria-label="Problem pages" className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous problem page"
        className="border-border bg-panel text-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-md border transition-colors disabled:opacity-40"
      >
        <icons.chevronLeft className="size-4" aria-hidden />
      </button>
      {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
        <button
          key={number}
          type="button"
          onClick={() => onPageChange(number)}
          aria-current={number === page ? "page" : undefined}
          className={cn(
            "tabnums inline-flex size-8 items-center justify-center rounded-md border text-xs transition-colors",
            number === page
              ? "border-blue bg-blue/10 text-foreground"
              : "border-border bg-panel text-muted hover:text-foreground",
          )}
        >
          {number}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page === pageCount}
        aria-label="Next problem page"
        className="border-border bg-panel text-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-md border transition-colors disabled:opacity-40"
      >
        <icons.chevronRight className="size-4" aria-hidden />
      </button>
    </nav>
  );
}

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
  solvedSlugs,
}: {
  level: LevelSummary;
  status: LevelStatus;
  saved: boolean;
  onToggleSaved: () => void;
  solvedSlugs: ReadonlySet<string>;
}) {
  const meta = DIFFICULTY_META[level.difficulty];
  const locked = status === "locked";
  const missing = missingPrerequisites(level, solvedSlugs);
  const firstMissing = missing[0] ? getLevelBySlug(missing[0]) : undefined;
  const statsLabel =
    level.statsSource === "client-validated"
      ? `Client-validated telemetry, n=${level.statsSampleSize ?? 0}`
      : "Authored estimate";

  const title = (
    <>
      <span
        className={cn(
          "flex flex-wrap items-center gap-1.5 text-sm font-medium",
          locked ? "text-muted" : "text-foreground",
        )}
      >
        <span>{level.title}</span>
        {level.challengeMode === "build" ? (
          <span className="text-purple inline-flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase">
            <icons.cluster className="size-3" aria-hidden />
            System build
          </span>
        ) : null}
        {level.incidentSource ? (
          <span className="text-amber inline-flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase">
            <icons.challenge className="size-3" aria-hidden />
            Incident inspired
          </span>
        ) : null}
      </span>
      <span className="text-subtle mt-0.5 block truncate text-xs">
        {locked
          ? `Locked — complete ${firstMissing?.title ?? missing[0]}${missing.length > 1 ? ` +${missing.length - 1}` : ""}`
          : level.blurb}
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
        <span className="flex flex-col gap-1" title={statsLabel}>
          <span className="flex items-center gap-2">
            <span className="tabnums text-muted w-9 text-xs">
              {level.statsSource === "authored-estimate" ? "~" : ""}
              {level.successRate}%
            </span>
            <span className="bg-panel-elevated h-1 w-14 overflow-hidden rounded-full">
              <span
                className={cn(
                  "block h-full rounded-full",
                  level.successRate >= 60
                    ? "bg-green"
                    : level.successRate >= 45
                      ? "bg-amber"
                      : "bg-red",
                )}
                style={{ width: `${level.successRate}%` }}
              />
            </span>
          </span>
          <span className="text-subtle text-[10px] leading-none">
            {level.statsSource === "client-validated"
              ? `client n=${level.statsSampleSize ?? 0}`
              : "estimate"}
          </span>
        </span>
      </td>
      <td className="hidden px-3 py-3 align-middle md:table-cell">
        <span className="text-muted flex items-center gap-1 text-xs">
          <icons.clock className="size-3.5" aria-hidden />
          {level.statsSource === "authored-estimate" ? "~" : ""}
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
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
      className="-rotate-90"
    >
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

function readChoice<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value && allowed.includes(value as T) ? (value as T) : fallback;
}

function readSet<T extends string>(value: string | null, allowed: readonly T[]): Set<T> {
  if (!value) return new Set();
  const allowedValues = new Set(allowed);
  return new Set(value.split(",").filter((entry): entry is T => allowedValues.has(entry as T)));
}

function positiveInt(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function toggleSet<T>(current: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
