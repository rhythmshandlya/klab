import { describe, expect, it } from "vitest";

import { getLevelBySlug } from "@/content/levels";
import { LEVEL_SOLUTIONS } from "@/content/levels/solutions";
import type { ProblemLevel } from "@/lib/domain/types";
import { matchEvidence, type InvestigationSignal } from "@/lib/kube/evidence";
import { evaluateLevelConstraints } from "@/lib/kube/manifest-constraints";

function level(slug: string): ProblemLevel {
  const found = getLevelBySlug(slug);
  if (!found) throw new Error(`Unknown level ${slug}`);
  return found;
}

function workspace(problem: ProblemLevel): Record<string, string> {
  return Object.fromEntries(
    problem.files
      .filter((file) => file.access !== "hidden")
      .map((file) => [file.path, file.initialValue]),
  );
}

function constraintFailures(
  problem: ProblemLevel,
  files: Readonly<Record<string, string>>,
): string[] {
  return evaluateLevelConstraints(problem, files)
    .filter((result) => !result.passed)
    .map((result) => result.id);
}

describe("foundation problem acceptance contracts", () => {
  it("accepts a named targetPort when repairing the Service selector", () => {
    const problem = level("service-selector-mismatch");
    const solved = {
      ...workspace(problem),
      ...LEVEL_SOLUTIONS[problem.slug]!.files,
    };
    solved["service.yaml"] = solved["service.yaml"]!.replace(
      "targetPort: 8080",
      "targetPort: http",
    );

    expect(constraintFailures(problem, solved)).toEqual([]);
  });

  it("uses the named container port in the canonical port-routing repair", () => {
    const problem = level("port-routing-bug");
    const solution = LEVEL_SOLUTIONS[problem.slug]!;

    expect(solution.files["service.yaml"]).toContain("targetPort: http");
    expect(constraintFailures(problem, { ...workspace(problem), ...solution.files })).toEqual([]);
  });

  it("accepts qualified checkout DNS forms and rejects unrelated reachable upstreams", () => {
    const problem = level("namespace-confusion");
    const solution = LEVEL_SOLUTIONS[problem.slug]!;
    const canonical = { ...workspace(problem), ...solution.files };

    expect(constraintFailures(problem, canonical)).toEqual([]);

    for (const correctUpstream of [
      "http://checkout-svc.shop:80/",
      "http://checkout-svc.shop.svc/",
      "http://checkout-svc.shop.svc.cluster.local/",
      "http://checkout-svc.shop.svc.cluster.local./",
    ]) {
      const equivalent = {
        ...canonical,
        "storefront.yaml": canonical["storefront.yaml"]!.replace(
          "http://checkout-svc.shop/",
          correctUpstream,
        ),
      };
      expect(constraintFailures(problem, equivalent), correctUpstream).toEqual([]);
    }

    for (const wrongUpstream of [
      "http://checkout-svc/",
      "http://checkout-svc.default/",
      "http://storefront-svc/healthz",
    ]) {
      const bypass = {
        ...canonical,
        "storefront.yaml": canonical["storefront.yaml"]!.replace(
          "http://checkout-svc.shop/",
          wrongUpstream,
        ),
      };
      expect(constraintFailures(problem, bypass), wrongUpstream).toContain(
        "constraint:keep-namespaces",
      );
    }
  });
});

describe("foundation investigation evidence", () => {
  it("uses EndpointSlices or Service status instead of the deprecated Endpoints API", () => {
    for (const slug of [
      "service-selector-mismatch",
      "port-routing-bug",
      "broken-readiness-probe",
      "namespace-confusion",
    ]) {
      expect(
        level(slug).quickCommands.some((quickCommand) =>
          /^kubectl get endpoints(?:\s|$)/.test(quickCommand.command),
        ),
        slug,
      ).toBe(false);
    }
  });

  it("derives readiness evidence from signals available before the Pod is Ready", () => {
    const problem = level("broken-readiness-probe");
    const signals: InvestigationSignal[] = [
      {
        type: "event-reason",
        reason: "Unhealthy",
        message: "Readiness probe failed: HTTP probe failed with statuscode: 404",
        namespace: "default",
      },
      {
        type: "command",
        command: "kubectl describe pod web-app",
        output: [
          "Readiness:      http-get /readyz port 8080",
          "Liveness:       http-get /healthz port 8080",
        ].join("\n"),
      },
      {
        type: "probe",
        method: "GET",
        url: "http://web-svc/",
        host: "web-svc",
        port: 80,
        path: "/",
        status: 503,
        body: "no ready endpoints",
      },
    ];

    expect(matchEvidence(problem.evidenceRules, signals)).toEqual(
      expect.arrayContaining(["readyz-404", "probe-paths", "service-unavailable"]),
    );
    expect(
      problem.evidenceRules.some(
        (rule) =>
          rule.trigger.type === "probe" &&
          rule.trigger.hostMatches === "^web-svc$" &&
          [200, 404].includes(rule.trigger.status),
      ),
    ).toBe(false);
  });

  it("collects log evidence from the terminal quick commands as well as the Logs tab", () => {
    const portProblem = level("port-routing-bug");
    expect(
      matchEvidence(portProblem.evidenceRules, [
        {
          type: "command",
          command: "kubectl logs web-app-abc",
          output: "web-app v1.0.0 starting\nlistening on :8080: health probe at GET /healthz",
        },
      ]),
    ).toContain("listen-8080");

    const namespaceProblem = level("namespace-confusion");
    expect(
      matchEvidence(namespaceProblem.evidenceRules, [
        {
          type: "command",
          command: "kubectl logs storefront-abc",
          output: "upstream call failed: DNS lookup returned NXDOMAIN",
        },
      ]),
    ).toContain("upstream-fail");

    const commands = namespaceProblem.quickCommands.map((command) => command.command);
    expect(commands.indexOf("curl http://storefront-svc/")).toBeLessThan(
      commands.indexOf("kubectl logs <pod>"),
    );
  });

  it("distinguishes the failed short DNS lookup from discovery in shop", () => {
    const problem = level("namespace-confusion");
    const nxdomain: InvestigationSignal = {
      type: "command",
      command: "dig checkout-svc",
      output: "NXDOMAIN",
    };

    expect(matchEvidence(problem.evidenceRules, [nxdomain])).toContain("short-name-nxdomain");
    expect(matchEvidence(problem.evidenceRules, [nxdomain])).not.toContain("checkout-in-shop");

    const investigated: InvestigationSignal[] = [
      {
        type: "command",
        command: "kubectl get svc -n shop",
        output: "NAME           TYPE       CLUSTER-IP\ncheckout-svc   ClusterIP  10.96.0.42",
      },
      {
        type: "command",
        command: "dig checkout-svc.shop",
        output: "checkout-svc.shop.svc.cluster.local 30 IN A 10.96.0.42",
      },
    ];

    expect(matchEvidence(problem.evidenceRules, investigated)).toEqual(
      expect.arrayContaining(["checkout-in-shop", "qualified-name-resolves"]),
    );
    expect(problem.quickCommands.map((command) => command.command)).toEqual(
      expect.arrayContaining([
        "kubectl get pods -n shop",
        "dig checkout-svc",
        "dig checkout-svc.shop",
      ]),
    );
  });
});
