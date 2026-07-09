"use client";

import { useEffect, useState } from "react";

import {
  EMPTY_PROGRESS,
  loadProgress,
  PROGRESS_EVENT,
  type Progress,
} from "@/lib/storage/local-progress";

/**
 * Reads local progress and keeps it in sync: re-reads on the progress-changed event
 * (fired when a level is solved / a hint is revealed) and on window focus. Starts at
 * EMPTY_PROGRESS to match SSR, then hydrates on mount (no hydration mismatch).
 */
export function useProgress(): Progress {
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);

  useEffect(() => {
    const read = () => setProgress(loadProgress());
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
