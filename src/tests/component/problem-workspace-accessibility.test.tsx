import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClusterExplorer } from "@/components/object-explorer/cluster-explorer";
import { ObjectDetails } from "@/components/object-explorer/object-details";
import { getLevelBySlug } from "@/content/levels";
import { FailingChecks } from "@/features/problems/components/failing-checks";
import { ValidationDialog } from "@/features/problems/components/validation-dialog";
import { useLevelStore } from "@/features/problems/level-store";
import type { ClusterSnapshot } from "@/lib/kube/simulator";
import type { ValidationReport } from "@/lib/kube/validators";

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

const REPORT: ValidationReport = {
  passed: false,
  results: [
    {
      id: "service-ready",
      title: "Service routes to a Ready backend",
      passed: false,
      detail: "0 Ready endpoints",
      diagnostic: "Expected at least one Ready endpoint.",
      label: "Service still has no Ready endpoints",
    },
  ],
};

afterEach(() => {
  window.localStorage.clear();
});

describe("problem workspace accessibility", () => {
  it("exposes explorer selection and keyboard-operable object view tabs", () => {
    const selected = { kind: "ConfigMap", name: "cleanup-audit", namespace: "previews" };
    const snapshot: ClusterSnapshot = {
      ...EMPTY_SNAPSHOT,
      resources: [
        {
          apiVersion: "v1",
          kind: "ConfigMap",
          metadata: {
            name: "cleanup-audit",
            namespace: "previews",
            labels: { owner: "sre" },
          },
          data: { externalResourcesRemaining: "0" },
        },
      ],
    };

    render(
      <>
        <ClusterExplorer
          snapshot={snapshot}
          namespaces={["previews"]}
          selected={selected}
          onSelect={vi.fn()}
        />
        <ObjectDetails snapshot={snapshot} selected={selected} />
      </>,
    );

    expect(screen.getByRole("button", { name: "cleanup-audit" })).toHaveAttribute(
      "aria-current",
      "true",
    );

    const detailsTab = screen.getByRole("tab", { name: "details" });
    const yamlTab = screen.getByRole("tab", { name: "yaml" });
    const panel = screen.getByRole("tabpanel");
    expect(detailsTab).toHaveAttribute("aria-selected", "true");
    expect(detailsTab).toHaveAttribute("tabindex", "0");
    expect(yamlTab).toHaveAttribute("tabindex", "-1");
    expect(panel).toHaveAttribute("aria-labelledby", detailsTab.id);
    expect(within(panel).getByText("API version")).toBeInTheDocument();
    expect(within(panel).getByText("v1")).toBeInTheDocument();

    fireEvent.keyDown(detailsTab, { key: "ArrowRight" });
    expect(yamlTab).toHaveFocus();
    expect(yamlTab).toHaveAttribute("aria-selected", "true");
    expect(panel).toHaveAttribute("aria-labelledby", yamlTab.id);
    expect(within(panel).getByText(/apiVersion: v1/)).toBeInTheDocument();
  });

  it("announces refresh progress and prefixes each live check with its state", () => {
    const level = getLevelBySlug("service-has-no-endpoints")!;
    useLevelStore.getState().initLevel(level);
    useLevelStore.getState().setChecks(REPORT);

    const { rerender } = render(<FailingChecks onRefresh={vi.fn()} refreshing={false} />);
    expect(screen.getByRole("status")).toHaveTextContent("0/1 passing");
    expect(screen.getByText("Failed:")).toHaveClass("sr-only");

    rerender(<FailingChecks onRefresh={vi.fn()} refreshing />);
    expect(screen.getByRole("status")).toHaveTextContent("Refreshing checks");
    expect(screen.getByRole("button", { name: "Refreshing checks" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("renders explicit per-check pass or fail text in the validation dialog", () => {
    const level = getLevelBySlug("service-has-no-endpoints")!;
    render(<ValidationDialog open onOpenChange={vi.fn()} report={REPORT} level={level} />);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Failed")).toBeVisible();
    expect(within(dialog).getByText("Service routes to a Ready backend")).toBeVisible();
  });
});
