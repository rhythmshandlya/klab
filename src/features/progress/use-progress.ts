"use client";

import { useEffect, useState } from "react";

import { EMPTY_PROGRESS, PROGRESS_EVENT, type Progress } from "@/lib/storage/local-progress";
import { getProgress } from "@/lib/storage/progress-store";

/**
 * Reads the current identity's progress and keeps it in sync: re-reads on the
 * progress-changed event (fired on solve / hint / optimistic write / server pull) and
 * on window focus. Starts at EMPTY_PROGRESS to match SSR, then hydrates on mount (no
 * hydration mismatch). Identity-aware via the store, so it follows sign-in/out.
 */
export function useProgress(): Progress {
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);

  useEffect(() => {
    const read = () => setProgress(getProgress());
    // Initial client-only read after mount (localStorage would mismatch during SSR).
    read();
    window.addEventListener(PROGRESS_EVENT, read);
    window.addEventListener("focus", read);
    return () => {
      window.removeEventListener(PROGRESS_EVENT, read);
      window.removeEventListener("focus", read);
    };
  }, []);

  return progress;
}
