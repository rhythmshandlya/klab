"use client";

import { useRouter } from "next/navigation";

import { icons } from "@/components/icons";
import { setPlaygroundHandoff } from "@/lib/storage/playground-handoff";

const CLASS =
  "border-blue/40 bg-blue/10 text-foreground hover:bg-blue/15 inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors";

/**
 * "Open in Playground" for a lesson. If the lesson ships a lab, its manifest files are
 * stashed as a one-shot handoff so the playground opens pre-loaded with them; otherwise
 * it just opens an empty playground.
 */
export function OpenInPlayground({ files }: { files?: Record<string, string> }) {
  const router = useRouter();

  const go = () => {
    if (files && Object.keys(files).length > 0) setPlaygroundHandoff(files);
    router.push("/playground");
  };

  return (
    <button type="button" onClick={go} className={CLASS}>
      <icons.playground className="text-blue size-4" aria-hidden />
      {files ? "Open lab in Playground" : "Open in Playground"}
    </button>
  );
}
