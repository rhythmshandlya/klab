"use client";

import Link from "next/link";
import { useMemo } from "react";

import { icons } from "@/components/icons";
import { getMissionsBySection, MISSION_SECTIONS, missionHref } from "@/content/missions";
import { useProgress } from "@/features/progress/use-progress";
import type { Mission } from "@/lib/domain/mission-types";
import { cn } from "@/lib/utils/cn";

type MissionStatus = "done" | "current" | "upcoming";

function statusFor(index: number, currentIndex: number): MissionStatus {
  if (index < currentIndex) return "done";
  if (index === currentIndex) return "current";
  return "upcoming";
}

/**
 * Ordered "mission path" home for a migrated docs section: a vertical route of
 * mission nodes (done / current / upcoming) with a connecting line, replacing the
 * flat lesson checklist. Mirrors DocsHome's visual language (border-border,
 * bg-panel, Badge-free but same spacing/typography rhythm).
 */
export function JourneyHome() {
  const progress = useProgress();
  const completed = useMemo(
    () => new Set(progress.completedLessonSlugs),
    [progress.completedLessonSlugs],
  );

  return (
    <div className="space-y-8">
      {MISSION_SECTIONS.map((section) => (
        <SectionPath key={section} section={section} completed={completed} />
      ))}
    </div>
  );
}

function SectionPath({ section, completed }: { section: string; completed: Set<string> }) {
  const missions = getMissionsBySection(section);
  const doneCount = missions.filter((m) => completed.has(m.slug.join("/"))).length;
  // First incomplete mission in order is "current"; if all are done, there is no
  // current node (every node renders as done).
  const currentIndex = missions.findIndex((m) => !completed.has(m.slug.join("/")));

  if (missions.length === 0) return null;

  return (
    <section className="border-border bg-panel rounded-lg border p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-foreground text-sm font-semibold tracking-tight">{section}</h2>
        <span className="text-subtle text-xs">
          {doneCount} of {missions.length} missions
        </span>
      </div>

      <ol className="relative">
        {missions.map((mission, index) => {
          const status = statusFor(index, currentIndex === -1 ? missions.length : currentIndex);
          const isLast = index === missions.length - 1;
          return (
            <li key={mission.slug.join("/")} className="relative flex gap-3 pb-6 last:pb-0">
              {!isLast ? (
                <span
                  className={cn(
                    "absolute top-7 left-[11px] w-px",
                    status === "done" ? "bg-green/50" : "bg-border",
                  )}
                  style={{ height: "calc(100% - 0.25rem)" }}
                  aria-hidden
                />
              ) : null}

              <MissionNode mission={mission} status={status} number={index + 1} />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function MissionNode({
  mission,
  status,
  number,
}: {
  mission: Mission;
  status: MissionStatus;
  number: number;
}) {
  return (
    <Link
      href={missionHref(mission)}
      data-testid={`mission-node-${mission.slug.join("/")}`}
      data-status={status}
      className="group hover:bg-panel-hover relative z-10 flex min-w-0 flex-1 items-start gap-3 rounded-md p-1.5 transition-colors"
    >
      <StatusDot status={status} number={number} />
      <div className="min-w-0 flex-1 pt-0.5">
        <p
          className={cn(
            "text-sm font-medium",
            status === "upcoming" ? "text-subtle" : "text-foreground",
          )}
        >
          {mission.title}
        </p>
        <p className="text-muted mt-0.5 line-clamp-2 text-xs leading-relaxed">
          {mission.coldOpen.goal}
        </p>
      </div>
      <icons.arrowRight
        className="text-subtle mt-1 size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />
    </Link>
  );
}

function StatusDot({ status, number }: { status: MissionStatus; number: number }) {
  if (status === "done") {
    return (
      <icons.success
        className="text-green size-6 shrink-0"
        aria-label={`Mission ${number} completed`}
      />
    );
  }
  if (status === "current") {
    return (
      <span
        className="bg-blue/15 border-blue text-blue relative flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold"
        aria-label={`Mission ${number}, current`}
      >
        <span
          className="bg-blue/30 absolute inline-flex size-full animate-ping rounded-full"
          aria-hidden
        />
        <span className="relative">{number}</span>
      </span>
    );
  }
  return (
    <span
      className="border-border text-subtle flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold"
      aria-label={`Mission ${number}, not yet reached`}
    >
      {number}
    </span>
  );
}
