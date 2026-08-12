import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ClusterSnapshot } from "@/lib/kube/simulator";

const { fitView } = vi.hoisted(() => ({
  fitView: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@xyflow/react", () => ({
  Background: () => null,
  ReactFlow: ({
    children,
    onInit,
  }: {
    children?: ReactNode;
    onInit?: (instance: { fitView: typeof fitView }) => void;
  }) => {
    const initialized = useRef(false);
    useEffect(() => {
      if (initialized.current) return;
      initialized.current = true;
      onInit?.({ fitView });
    }, [onInit]);
    return <div>{children}</div>;
  },
}));

import { ServiceTopology } from "@/components/topology/service-topology";

const EMPTY_SNAPSHOT: ClusterSnapshot = {
  pods: [],
  services: [],
  deployments: [],
  replicaSets: [],
  endpointSlices: [],
  namespaces: [],
  nodes: [],
  events: [],
};

function snapshotWithPods(names: string[], ready = false): ClusterSnapshot {
  return {
    ...EMPTY_SNAPSHOT,
    pods: names.map((name) => ({
      metadata: { name, namespace: "default", labels: { app: "web" } },
      status: {
        conditions: [{ type: "Ready", status: ready ? "True" : "False" }],
        containerStatuses: [],
      },
    })) as ClusterSnapshot["pods"],
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ServiceTopology viewport", () => {
  it("fits real topology changes and panel resizes without reacting to status-only updates", () => {
    vi.useFakeTimers();

    let resizeCallback: ResizeObserverCallback | undefined;
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    const { rerender } = render(
      <ServiceTopology snapshot={snapshotWithPods(["web-1"])} namespace="default" />,
    );
    act(() => vi.runAllTimers());

    expect(fitView).toHaveBeenCalledTimes(1);
    expect(fitView).toHaveBeenLastCalledWith({
      padding: 0.16,
      minZoom: 0.2,
      maxZoom: 1,
      duration: 180,
    });

    rerender(<ServiceTopology snapshot={snapshotWithPods(["web-1"], true)} namespace="default" />);
    act(() => vi.runAllTimers());
    expect(fitView).toHaveBeenCalledTimes(1);

    rerender(
      <ServiceTopology snapshot={snapshotWithPods(["web-1", "web-2"], true)} namespace="default" />,
    );
    act(() => vi.runAllTimers());
    expect(fitView).toHaveBeenCalledTimes(2);

    act(() => {
      resizeCallback?.(
        [{ contentRect: { width: 420, height: 280 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
      vi.advanceTimersByTime(RESIZE_DELAY_MS - 1);
    });
    expect(fitView).toHaveBeenCalledTimes(2);

    act(() => vi.advanceTimersByTime(1));
    expect(fitView).toHaveBeenCalledTimes(3);
  });
});

const RESIZE_DELAY_MS = 120;
