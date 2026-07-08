import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/ui/section-placeholder";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return (
    <SectionPlaceholder
      icon="trophy"
      eyebrow="Your journey"
      title="Progress"
      description="Track XP, streaks, solved incidents, and earned badges. Progress is persisted locally in your browser — no account required."
      phase="Phase 6"
      planned={[
        "XP & level progression",
        "Daily streak tracking",
        "Solved-incident history",
        "Achievement badges",
        "Per-concept mastery",
      ]}
      cta={{ href: "/problems", label: "Start earning XP" }}
    />
  );
}
