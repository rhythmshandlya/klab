"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { icons } from "@/components/icons";
import { PLAYGROUND_TEMPLATES } from "@/content/playground-templates";
import { usePlaygroundsStore } from "@/features/playground/labs-store";
import { useSession } from "@/lib/auth/client";
import type { PublicPlaygroundEntry } from "@/lib/db/community-repo";
import { cn } from "@/lib/utils/cn";

import { timeAgo } from "../format";
import { PersonAvatar } from "./person";

export function PublicPlaygrounds({
  entries,
  authEnabled,
  now,
}: {
  entries: readonly PublicPlaygroundEntry[];
  authEnabled: boolean;
  now: string;
}) {
  const Playground = icons.playground;
  const Arrow = icons.arrowRight;

  return (
    <section aria-labelledby="public-playgrounds-heading">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Playground className="text-green size-4" aria-hidden />
            <h2 id="public-playgrounds-heading" className="text-foreground text-sm font-semibold">
              Community Playgrounds
            </h2>
          </div>
          <p className="text-subtle mt-1 text-xs">
            Reproducible Kubernetes setups you can fork into your private workspace.
          </p>
        </div>
        <Link
          href="/playground"
          className="text-blue inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          Build your own
          <Arrow className="size-3.5" aria-hidden />
        </Link>
      </div>

      {entries.length > 0 ? (
        <ul className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <PublicPlaygroundCard entry={entry} authEnabled={authEnabled} now={now} />
            </li>
          ))}
        </ul>
      ) : (
        <StarterPlaygrounds />
      )}
    </section>
  );
}

function PublicPlaygroundCard({
  entry,
  authEnabled,
  now,
}: {
  entry: PublicPlaygroundEntry;
  authEnabled: boolean;
  now: string;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const forkPublic = usePlaygroundsStore((state) => state.forkPublic);
  const [signInOpen, setSignInOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Copy = icons.copy;

  const fork = async () => {
    if (!authEnabled || !session?.user?.id) {
      setSignInOpen(true);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const created = await forkPublic(entry.id);
      router.push(`/playground/p/${created.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not fork this Playground.");
      setPending(false);
    }
  };

  return (
    <article className="border-border bg-panel hover:border-border-strong flex h-full flex-col rounded-xl border p-4 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-foreground truncate text-sm font-semibold">{entry.name}</h3>
          <p className="text-subtle mt-0.5 text-xs">{entry.fileCount} YAML files</p>
        </div>
        <span className="border-green/25 bg-green/10 text-green rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase">
          Public
        </span>
      </div>
      <p className="text-muted mt-3 line-clamp-3 min-h-12 text-sm leading-relaxed">
        {entry.description || "A reproducible Kubernetes Playground shared with the community."}
      </p>
      <div className="mt-auto pt-4">
        <div className="flex items-center gap-2">
          <PersonAvatar name={entry.authorName} image={entry.authorImage} isAnonymous={false} />
          <p className="text-subtle min-w-0 truncate text-xs">
            {entry.authorName} · {timeAgo(entry.publishedAt, new Date(now))}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fork()}
          disabled={pending}
          className="border-border bg-panel-elevated text-foreground hover:bg-panel-hover mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors disabled:opacity-60"
        >
          <Copy className="size-3.5" aria-hidden />
          {pending ? "Forking…" : `Fork${entry.forkCount > 0 ? ` · ${entry.forkCount}` : ""}`}
        </button>
        {error ? <p className="text-red mt-2 text-xs">{error}</p> : null}
      </div>
      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
    </article>
  );
}

function StarterPlaygrounds() {
  const starters = PLAYGROUND_TEMPLATES.slice(0, 3);
  const Arrow = icons.arrowRight;
  return (
    <div className="border-border bg-panel mt-3 rounded-xl border p-5">
      <div className="max-w-xl">
        <p className="text-foreground text-sm font-medium">
          The community library is getting started
        </p>
        <p className="text-muted mt-1 text-sm leading-relaxed">
          Be the first to publish a useful setup. Until then, these official starters are ready to
          experiment with and autosave privately.
        </p>
      </div>
      <ul className="mt-4 grid gap-2 md:grid-cols-3">
        {starters.map((template) => (
          <li key={template.id}>
            <Link
              href={`/playground/${template.id}`}
              className={cn(
                "border-border bg-panel-elevated hover:border-blue/40 block h-full rounded-lg border p-3 transition-colors",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              )}
            >
              <span className="text-foreground flex items-center justify-between gap-2 text-sm font-medium">
                {template.title}
                <Arrow className="text-blue size-3.5 shrink-0" aria-hidden />
              </span>
              <span className="text-subtle mt-1 line-clamp-2 block text-xs leading-relaxed">
                {template.description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
