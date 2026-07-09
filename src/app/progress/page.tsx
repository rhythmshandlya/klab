import type { Metadata } from "next";

import { ProgressDashboard } from "@/features/progress/components/progress-dashboard";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return <ProgressDashboard />;
}
