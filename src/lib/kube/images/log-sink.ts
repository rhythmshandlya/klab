/**
 * In-memory pod log buffer.
 *
 * SIMULATION DETAIL: Webernetes has no client-side pod-log API, so klab's fake
 * images (which we control) push their stdout here keyed by pod/container. The
 * simulator reads this for `kubectl logs`. A single module-level sink is shared
 * across simulators; entries are keyed by unique pod name and the active simulator
 * clears the sink on reset. This is NOT how real Kubernetes log retrieval works.
 */

export interface LogLine {
  namespace: string;
  pod: string;
  container: string;
  message: string;
  timestampMs: number;
}

type LogListener = (line: LogLine) => void;

class LogSink {
  private lines: LogLine[] = [];
  private readonly listeners = new Set<LogListener>();

  append(entry: Omit<LogLine, "timestampMs"> & { timestampMs?: number }): void {
    const line: LogLine = { ...entry, timestampMs: entry.timestampMs ?? Date.now() };
    this.lines.push(line);
    for (const listener of this.listeners) listener(line);
  }

  forPod(namespace: string, pod: string, container?: string): LogLine[] {
    return this.lines.filter(
      (line) =>
        line.namespace === namespace &&
        line.pod === pod &&
        (container === undefined || line.container === container),
    );
  }

  clear(): void {
    this.lines = [];
  }

  subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const logSink = new LogSink();
