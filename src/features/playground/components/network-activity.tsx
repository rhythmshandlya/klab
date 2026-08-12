"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import { icons } from "@/components/icons";
import type { KubeSimulator, NetworkActivityEvent } from "@/lib/kube/simulator";
import { cn } from "@/lib/utils/cn";

const EMPTY: readonly NetworkActivityEvent[] = [];

const HOP_TONE: Record<NetworkActivityEvent["hops"][number]["kind"], string> = {
  pod: "text-blue",
  service: "text-purple",
  node: "text-subtle",
  external: "text-amber",
};

/**
 * Live feed of requests on the simulated cluster network: every curl, pod-to-pod
 * call, and (optionally) kubelet health probe, with its hop chain and latency.
 * This surfaces Webernetes' in-memory network: traffic that is otherwise invisible.
 */
export function NetworkActivity({ simulator }: { simulator: KubeSimulator }) {
  const subscribe = useCallback(
    (onChange: () => void) => simulator.subscribeNetworkActivity(onChange),
    [simulator],
  );
  const events = useSyncExternalStore(
    subscribe,
    () => simulator.getNetworkActivity(),
    () => EMPTY,
  );
  const [showProbes, setShowProbes] = useState(false);
  const visible = showProbes ? events : events.filter((e) => !e.isProbe);
  const probeCount = events.length - events.filter((e) => !e.isProbe).length;

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex shrink-0 items-center justify-between border-b px-3 py-2">
        <span className="text-subtle text-[11px]">
          Last {events.length} request{events.length === 1 ? "" : "s"}
        </span>
        <label className="text-subtle hover:text-muted flex cursor-pointer items-center gap-1.5 text-[11px]">
          <input
            type="checkbox"
            checked={showProbes}
            onChange={(e) => setShowProbes(e.target.checked)}
            className="accent-blue size-3"
          />
          Show health probes{probeCount > 0 ? ` (${probeCount})` : ""}
        </label>
      </div>
      {visible.length === 0 ? (
        <div className="text-subtle flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-xs">
          <icons.cluster className="size-5" aria-hidden />
          <p>
            No traffic yet. Try{" "}
            <code className="text-blue font-mono">curl http://&lt;svc&gt;/</code> in the terminal:
            every request&apos;s path through the cluster shows up here.
          </p>
        </div>
      ) : (
        <ul className="divide-border min-h-0 flex-1 divide-y overflow-y-auto">
          {visible.map((event) => (
            <li key={event.id} className="space-y-1 px-3 py-2">
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <StatusDot event={event} />
                <span className="text-muted shrink-0">{event.method}</span>
                <span className="text-foreground truncate" title={event.url}>
                  {shortUrl(event.url)}
                </span>
                <span className="text-subtle tabnums ml-auto shrink-0">
                  {event.status ?? "ERR"} · {Math.round(event.latencyMs)}ms
                </span>
              </div>
              {event.hops.length > 0 ? (
                <p className="text-subtle truncate text-[11px]">
                  {event.hops.map((hop, index) => (
                    <span key={`${event.id}-${index}`}>
                      {index > 0 ? <span className="text-subtle/60"> → </span> : null}
                      <span className={cn(HOP_TONE[hop.kind])} title={hop.kind}>
                        {hop.name}
                      </span>
                    </span>
                  ))}
                </p>
              ) : null}
              {event.error ? <p className="text-red text-[11px]">{event.error}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusDot({ event }: { event: NetworkActivityEvent }) {
  const tone =
    event.error || event.status === undefined
      ? "bg-red"
      : event.status >= 500
        ? "bg-red"
        : event.status >= 400
          ? "bg-amber"
          : "bg-green";
  return <span className={cn("size-1.5 shrink-0 rounded-full", tone)} aria-hidden />;
}

function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, "");
}
