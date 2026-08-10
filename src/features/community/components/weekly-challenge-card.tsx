import Link from "next/link";

import { icons } from "@/components/icons";
import type { WeeklyChallenge } from "@/features/community/weekly-challenge";

export function WeeklyChallengeCard({
  challenge,
  completions,
}: {
  challenge: WeeklyChallenge;
  completions: number;
}) {
  const Challenge = icons.challenge;
  const Arrow = icons.arrowRight;
  const resetLabel = challenge.endsAt.toLocaleDateString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <section
      aria-labelledby="weekly-challenge-heading"
      className="border-blue/25 bg-blue/[0.06] relative overflow-hidden rounded-xl border p-5"
    >
      <div className="bg-blue/10 pointer-events-none absolute -top-12 -right-12 size-36 rounded-full blur-3xl" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-blue/12 text-blue flex size-8 items-center justify-center rounded-lg">
              <Challenge className="size-4" aria-hidden />
            </span>
            <div>
              <p className="text-blue text-[10px] font-semibold tracking-[0.12em] uppercase">
                Weekly challenge
              </p>
              <h2 id="weekly-challenge-heading" className="text-foreground text-base font-semibold">
                {challenge.level.title}
              </h2>
            </div>
          </div>
          <span className="border-border bg-panel text-muted rounded-full border px-2.5 py-1 text-xs capitalize">
            {challenge.level.difficulty}
          </span>
        </div>

        <p className="text-muted mt-4 max-w-xl text-sm leading-relaxed">{challenge.level.blurb}</p>

        <div className="text-subtle mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span>{challenge.level.xp} XP</span>
          <span>~{challenge.level.estimatedMinutes} min</span>
          <span>
            {completions} {completions === 1 ? "completion" : "completions"} this week
          </span>
          <span>Resets {resetLabel} UTC</span>
        </div>

        <Link
          href={`/problems/${challenge.level.slug}`}
          className="bg-primary text-primary-foreground hover:bg-primary/90 mt-5 inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors"
        >
          Start challenge
          <Arrow className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
