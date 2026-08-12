import { describe, expect, it } from "vitest";

import { getLevelBySlug, LEVELS } from "@/content/levels";
import { LEVEL_SOLUTIONS } from "@/content/levels/solutions";
import { evaluateLevelConstraints } from "@/lib/kube/manifest-constraints";
import { parseKubernetesManifests, stringifyManifest } from "@/lib/kube/manifest-parser";
import { evaluateWorkspaceSemantics } from "@/lib/kube/workspace-semantics";

function filesFor(slug: string): Record<string, string> {
  const level = getLevelBySlug(slug);
  if (!level) throw new Error(`Unknown level ${slug}`);
  return Object.fromEntries(
    level.files
      .filter((file) => file.access !== "hidden")
      .map((file) => [file.path, file.initialValue]),
  );
}

function solvedFilesFor(slug: string): Record<string, string> {
  return { ...filesFor(slug), ...LEVEL_SOLUTIONS[slug]?.files };
}

function parsedResource(yaml: string): Record<string, unknown> {
  const parsed = parseKubernetesManifests(yaml);
  if (!parsed.ok || !parsed.value[0]) throw new Error("Expected one parsed Kubernetes resource");
  return structuredClone(parsed.value[0].raw);
}

function expectConstraintFailure(slug: string, files: Record<string, string>, id: string): void {
  const level = getLevelBySlug(slug);
  if (!level) throw new Error(`Unknown level ${slug}`);
  const result = evaluateLevelConstraints(level, files).find(
    (candidate) => candidate.id === `constraint:${id}`,
  );
  expect(result, `${slug}/${id}`).toBeDefined();
  expect(result?.passed, `${slug}/${id}: ${result?.detail}`).toBe(false);
}

function expectSemanticIssue(
  slug: string,
  file: string,
  mutate: (resource: Record<string, unknown>) => void,
  expected: string,
): void {
  const level = getLevelBySlug(slug)!;
  const files = solvedFilesFor(slug);
  const resource = parsedResource(files[file]!);
  mutate(resource);
  files[file] = stringifyManifest(resource);
  expect(evaluateWorkspaceSemantics(level, files)).toContain(expected);
}

function mutatePath(
  root: Record<string, unknown>,
  path: string,
  replacement: unknown,
  remove = false,
): void {
  const segments = path.split(".");
  let current: unknown = root;
  for (const segment of segments.slice(0, -1)) {
    current = Array.isArray(current)
      ? current[Number(segment)]
      : (current as Record<string, unknown>)[segment];
  }
  const leaf = segments.at(-1)!;
  if (Array.isArray(current)) {
    if (remove) current.splice(Number(leaf), 1);
    else current[Number(leaf)] = replacement;
  } else if (remove) {
    delete (current as Record<string, unknown>)[leaf];
  } else {
    (current as Record<string, unknown>)[leaf] = replacement;
  }
}

describe("machine-enforced problem constraints", () => {
  it("accepts every canonical solution", () => {
    for (const level of LEVELS) {
      const solution = LEVEL_SOLUTIONS[level.slug];
      const results = evaluateLevelConstraints(level, {
        ...filesFor(level.slug),
        ...solution?.files,
      });
      expect(
        results.every((result) => result.passed),
        `${level.slug}: ${results
          .filter((result) => !result.passed)
          .map((result) => result.detail)
          .join(" | ")}`,
      ).toBe(true);
    }
  });

  it("accepts every canonical static-assessment workspace semantically", () => {
    for (const level of LEVELS.filter(
      (candidate) =>
        candidate.engine.kind === "scripted" &&
        candidate.engine.scenarioId === "manifest-assessment",
    )) {
      const issues = evaluateWorkspaceSemantics(level, solvedFilesFor(level.slug));
      expect(issues, `${level.slug}: ${issues.join(" | ")}`).toEqual([]);
    }
  });

  it("rejects disconnected and weakened architecture designs", () => {
    const zonalLevel = getLevelBySlug("build-three-zone-api")!;
    const zonalFiles = solvedFilesFor(zonalLevel.slug);
    const deploymentPath = zonalLevel.constraints.find(
      (constraint) => constraint.kind === "manifest" && constraint.resource.kind === "Deployment",
    );
    expect(deploymentPath?.kind).toBe("manifest");
    if (deploymentPath?.kind === "manifest") {
      const deployment = parsedResource(zonalFiles[deploymentPath.file]!);
      const spread = (
        ((deployment.spec as Record<string, unknown>).template as Record<string, unknown>)
          .spec as Record<string, unknown>
      ).topologySpreadConstraints as Array<Record<string, unknown>>;
      (
        (spread[0]!.labelSelector as Record<string, unknown>).matchLabels as Record<string, unknown>
      )["app"] = "does-not-exist";
      zonalFiles[deploymentPath.file] = stringifyManifest(deployment);
      expect(evaluateWorkspaceSemantics(zonalLevel, zonalFiles)).toContain(
        "Deployment/checkout-api topology spread rule 1 selects no Pod template",
      );
    }

    const hardenedLevel = getLevelBySlug("build-hardened-admin-workload")!;
    const hardenedFiles = solvedFilesFor(hardenedLevel.slug);
    const role = parsedResource(hardenedFiles["role.yaml"]!);
    (role.rules as unknown[]).push({
      apiGroups: [""],
      resources: ["configmaps"],
      verbs: ["delete"],
    });
    hardenedFiles["role.yaml"] = stringifyManifest(role);
    expect(evaluateWorkspaceSemantics(hardenedLevel, hardenedFiles)).toContain(
      "Role/admin-console grants authority outside the maintenance contract",
    );

    const observabilityLevel = getLevelBySlug("build-incident-survivable-observability")!;
    const observabilityFiles = solvedFilesFor(observabilityLevel.slug);
    const alerts = parsedResource(observabilityFiles["alerts.yaml"]!);
    const rules = ((
      (alerts.spec as Record<string, unknown>).groups as Array<Record<string, unknown>>
    )[0]!.rules ?? []) as Array<Record<string, unknown>>;
    for (const rule of rules) rule.expr = "vector(0)";
    observabilityFiles["alerts.yaml"] = stringifyManifest(alerts);
    expect(evaluateWorkspaceSemantics(observabilityLevel, observabilityFiles)).toContain(
      "PrometheusRule/checkout-independent-alerts contains an ineffective alert expression",
    );
  });

  it("rejects architecture escape hatches and unsafe scalar values", () => {
    expectSemanticIssue(
      "build-default-deny-service-graph",
      "frontend-egress.yaml",
      (resource) => {
        ((resource.spec as Record<string, unknown>).egress as unknown[]).push({});
      },
      "NetworkPolicy/frontend-egress contains an allow-all egress rule 3",
    );
    expectSemanticIssue(
      "build-default-deny-service-graph",
      "frontend-egress.yaml",
      (resource) => {
        const egress = (resource.spec as Record<string, unknown>).egress as Array<
          Record<string, unknown>
        >;
        (egress[0]!.to as unknown[]).push({ ipBlock: { cidr: "0.0.0.0/0" } });
      },
      "NetworkPolicy/frontend-egress contains an unrestricted egress peer",
    );
    expectSemanticIssue(
      "build-default-deny-service-graph",
      "frontend-egress.yaml",
      (resource) => {
        const egress = (resource.spec as Record<string, unknown>).egress as Array<
          Record<string, unknown>
        >;
        egress[1]!.ports = (egress[1]!.ports as Array<Record<string, unknown>>).filter(
          (port) => port.protocol !== "TCP",
        );
      },
      "NetworkPolicy/frontend-egress must allow DNS over both UDP and TCP",
    );
    expectSemanticIssue(
      "build-default-deny-service-graph",
      "frontend-egress.yaml",
      (resource) => {
        const egress = (resource.spec as Record<string, unknown>).egress as unknown[];
        egress.push({
          to: [{ namespaceSelector: { matchLabels: {} } }],
          ports: [{ protocol: "TCP", port: 443 }],
        });
      },
      "NetworkPolicy/frontend-egress contains an unrestricted egress peer",
    );
    expectSemanticIssue(
      "build-hardened-admin-workload",
      "deployment.yaml",
      (resource) => {
        const podSpec = (
          (resource.spec as Record<string, unknown>).template as Record<string, unknown>
        ).spec as Record<string, unknown>;
        podSpec.hostNetwork = true;
        podSpec.hostPID = true;
      },
      "Deployment/admin-console must not join host namespaces",
    );
    expectSemanticIssue(
      "build-hardened-admin-workload",
      "deployment.yaml",
      (resource) => {
        const podSpec = (
          (resource.spec as Record<string, unknown>).template as Record<string, unknown>
        ).spec as Record<string, unknown>;
        podSpec.initContainers = [
          {
            name: "unsafe-init",
            image: "busybox:1.36",
            command: ["true"],
            securityContext: { privileged: true },
          },
        ];
      },
      "Deployment/admin-console containers must be non-privileged, read-only, and drop all capabilities",
    );
    expectSemanticIssue(
      "build-hardened-admin-workload",
      "role.yaml",
      (resource) => {
        (resource.rules as unknown[]).push({
          apiGroups: [""],
          resources: ["pods/exec"],
          verbs: ["create"],
        });
      },
      "Role/admin-console grants authority outside the maintenance contract",
    );
    expectSemanticIssue(
      "build-three-zone-api",
      "deployment.yaml",
      (resource) => {
        (resource.spec as Record<string, unknown>).replicas = 1000;
      },
      "Deployment/checkout-api baseline replicas must be between one and the HPA maximum",
    );
    expectSemanticIssue(
      "build-three-zone-api",
      "deployment.yaml",
      (resource) => {
        const container = (
          (
            ((resource.spec as Record<string, unknown>).template as Record<string, unknown>)
              .spec as Record<string, unknown>
          ).containers as Array<Record<string, unknown>>
        )[0]!;
        container.readinessProbe = {};
        container.resources = { requests: { cpu: "0" }, limits: { memory: "0" } };
      },
      "Deployment/checkout-api container api has an empty readinessProbe",
    );
    expectSemanticIssue(
      "build-three-zone-api",
      "namespace.yaml",
      (resource) => {
        const metadata = resource.metadata as Record<string, unknown>;
        const labels = metadata.labels as Record<string, unknown>;
        delete labels["pod-security.kubernetes.io/enforce"];
      },
      "Namespace/resilient-api advertises restricted security without enforcing Pod Security",
    );
    expectSemanticIssue(
      "build-two-team-platform",
      "atlas-dns-egress.yaml",
      (resource) => {
        const egress = (resource.spec as Record<string, unknown>).egress as Array<
          Record<string, unknown>
        >;
        egress[0]!.ports = (egress[0]!.ports as Array<Record<string, unknown>>).filter(
          (port) => port.protocol !== "TCP",
        );
      },
      "NetworkPolicy/allow-cluster-dns must allow DNS over both UDP and TCP",
    );
  });

  it("rejects incomplete cross-resource and supply-chain contracts", () => {
    expectSemanticIssue(
      "build-recoverable-stateful-data-plane",
      "statefulset.yaml",
      (resource) => {
        const template = (
          (resource.spec as Record<string, unknown>).template as Record<string, unknown>
        ).metadata as Record<string, unknown>;
        const labels = template.labels as Record<string, unknown>;
        labels.app = "does-not-match";
      },
      "StatefulSet/orders-db selector does not match its Pod template",
    );
    expectSemanticIssue(
      "build-three-zone-api",
      "hpa.yaml",
      (resource) => {
        delete (
          (resource.spec as Record<string, unknown>).scaleTargetRef as Record<string, unknown>
        ).apiVersion;
      },
      "HorizontalPodAutoscaler/checkout-api has an incomplete scaleTargetRef",
    );
    expectSemanticIssue(
      "build-hardened-admin-workload",
      "role-binding.yaml",
      (resource) => {
        (resource.subjects as unknown[]).push({ kind: "Group", name: "cluster-admins" });
      },
      "RoleBinding/admin-console must bind exactly one intended subject",
    );
    expectSemanticIssue(
      "build-incident-survivable-observability",
      "alerts.yaml",
      (resource) => {
        const group = (
          (resource.spec as Record<string, unknown>).groups as Array<Record<string, unknown>>
        )[0]!;
        (group.rules as Array<Record<string, unknown>>)[0]!.expr = "vector(1)";
      },
      "PrometheusRule/checkout-independent-alerts contains an ineffective alert expression",
    );
    expectSemanticIssue(
      "build-signed-promotion-pipeline",
      "cosign-verify-task.yaml",
      (resource) => {
        const steps = (resource.spec as Record<string, unknown>).steps as Array<
          Record<string, unknown>
        >;
        delete steps[0]!.image;
      },
      "Task/cosign-verify step 1 needs an image and executable action",
    );
    expectSemanticIssue(
      "build-signed-promotion-pipeline",
      "signature-policy.yaml",
      (resource) => {
        const spec = resource.spec as Record<string, unknown>;
        (spec.validationConfigurations as Record<string, unknown>).required = false;
        spec.attestors = [];
      },
      "ImageValidatingPolicy/verify-production-images must reject tags and verify every image digest with a named attestor",
    );
  });

  it("enforces one immutable artifact identity through signed promotion", () => {
    expectSemanticIssue(
      "build-signed-promotion-pipeline",
      "pipeline.yaml",
      (resource) => {
        const tasks = (resource.spec as Record<string, unknown>).tasks as Array<
          Record<string, unknown>
        >;
        const params = tasks[0]!.params as Array<Record<string, unknown>>;
        params[0]!.value = "registry.example/unrelated@$(params.imageDigest)";
      },
      "Pipeline/signed-promotion must verify and promote the same checkout digest in sequence",
    );
    expectSemanticIssue(
      "build-signed-promotion-pipeline",
      "pipeline.yaml",
      (resource) => {
        const tasks = (resource.spec as Record<string, unknown>).tasks as Array<
          Record<string, unknown>
        >;
        for (const task of tasks) {
          const params = task.params as Array<Record<string, unknown>>;
          const image = params.find((param) => param.name === "image");
          if (image) image.value = "registry.example/checkout:latest";
        }
      },
      "Pipeline/signed-promotion must verify and promote the same checkout digest in sequence",
    );
    expectSemanticIssue(
      "build-signed-promotion-pipeline",
      "cosign-verify-task.yaml",
      (resource) => {
        const steps = (resource.spec as Record<string, unknown>).steps as Array<
          Record<string, unknown>
        >;
        steps[0]!.args = ["verify", "--insecure-ignore-tlog=true", "$(params.image)"];
      },
      "Task/cosign-verify must verify the submitted image with the trusted CI keyless identity",
    );
    expectSemanticIssue(
      "build-signed-promotion-pipeline",
      "patch-deployment-task.yaml",
      (resource) => {
        const steps = (resource.spec as Record<string, unknown>).steps as Array<
          Record<string, unknown>
        >;
        steps[0]!.script =
          "kubectl set image deployment/$(params.deployment) checkout=registry.example/checkout:latest -n production";
      },
      "Task/patch-deployment-digest must promote only the submitted digest to checkout in production",
    );
    expectSemanticIssue(
      "build-signed-promotion-pipeline",
      "signature-policy.yaml",
      (resource) => {
        const validations = (resource.spec as Record<string, unknown>).validations as Array<
          Record<string, unknown>
        >;
        validations[1]!.expression =
          "true || images.containers.map(image, verifyImageSignatures(image, [attestors.trustedCi])).all(result, result > 0)";
      },
      "ImageValidatingPolicy/verify-production-images must enforce signature verification in CEL",
    );
  });

  it("rejects unsafe shortcuts in production repair scenarios", () => {
    const operatorLevel = getLevelBySlug("operator-cannot-update-status")!;
    const operatorFiles = solvedFilesFor(operatorLevel.slug);
    const role = parsedResource(operatorFiles["operator-role.yaml"]!);
    (role.rules as unknown[]).push({ apiGroups: ["*"], resources: ["*"], verbs: ["*"] });
    operatorFiles["operator-role.yaml"] = stringifyManifest(role);
    expect(evaluateWorkspaceSemantics(operatorLevel, operatorFiles)).toContain(
      "Role/database-operator contains wildcard authority",
    );

    const webhookFiles = solvedFilesFor("admission-webhook-deadlock");
    const webhook = parsedResource(webhookFiles["validating-webhook.yaml"]!);
    (webhook.webhooks as unknown[]).push(structuredClone((webhook.webhooks as unknown[])[0]));
    webhookFiles["validating-webhook.yaml"] = stringifyManifest(webhook);
    expectConstraintFailure("admission-webhook-deadlock", webhookFiles, "production-requirements");

    const hpaFiles = solvedFilesFor("sidecar-poisons-scaling-signal");
    const hpa = parsedResource(hpaFiles["orders-hpa.yaml"]!);
    const metric = (
      (hpa.spec as Record<string, unknown>).metrics as Array<Record<string, unknown>>
    )[0]!;
    delete ((metric.containerResource as Record<string, unknown>).target as Record<string, unknown>)
      .type;
    hpaFiles["orders-hpa.yaml"] = stringifyManifest(hpa);
    expectConstraintFailure("sidecar-poisons-scaling-signal", hpaFiles, "production-requirements");

    const etcdFiles = solvedFilesFor("etcd-nospace-freezes-writes");
    const etcd = parsedResource(etcdFiles["etcd-recovery-static-pod.yaml"]!);
    const container = (
      (etcd.spec as Record<string, unknown>).containers as Array<Record<string, unknown>>
    )[0]!;
    container.image = "busybox:1.36";
    etcdFiles["etcd-recovery-static-pod.yaml"] = stringifyManifest(etcd);
    expectConstraintFailure("etcd-nospace-freezes-writes", etcdFiles, "production-requirements");
  });

  it("ships the mutable-tag incident as a complete Kustomize overlay workspace", () => {
    const level = getLevelBySlug("mutable-tag-split-brain")!;
    expect(level.files.map((file) => [file.path, file.access])).toEqual([
      ["overlays/production/kustomization.yaml", "editable"],
      ["base/kustomization.yaml", "readonly"],
      ["base/deployment.yaml", "readonly"],
    ]);
    expect(level.files[0]?.initialValue).toContain("../../base");
    expect(level.files[2]?.initialValue).toContain("replicas: 6");
  });

  it("accepts an equivalent maxUnavailable disruption budget", () => {
    const level = getLevelBySlug("build-three-zone-api")!;
    const files = solvedFilesFor(level.slug);
    const pdb = parsedResource(files["pdb.yaml"]!);
    const spec = pdb.spec as Record<string, unknown>;
    delete spec.minAvailable;
    spec.maxUnavailable = 1;
    files["pdb.yaml"] = stringifyManifest(pdb);

    expect(evaluateLevelConstraints(level, files).every((result) => result.passed)).toBe(true);
    expect(evaluateWorkspaceSemantics(level, files)).toEqual([]);

    const observability = getLevelBySlug("build-incident-survivable-observability")!;
    const observabilityFiles = solvedFilesFor(observability.slug);
    for (const path of ["blackbox-pdb.yaml", "prometheus-pdb.yaml"]) {
      const budget = parsedResource(observabilityFiles[path]!);
      const budgetSpec = budget.spec as Record<string, unknown>;
      delete budgetSpec.minAvailable;
      budgetSpec.maxUnavailable = 1;
      observabilityFiles[path] = stringifyManifest(budget);
    }
    expect(
      evaluateLevelConstraints(observability, observabilityFiles).every((result) => result.passed),
    ).toBe(true);
    expect(evaluateWorkspaceSemantics(observability, observabilityFiles)).toEqual([]);
  });

  it("rejects swapping the crash-looping worker for an unrelated healthy image", () => {
    const files = filesFor("pod-crashloop-mystery");
    files["deployment.yaml"] = files["deployment.yaml"]!.replace(
      "klab/worker:1.0.0",
      "klab/web-app:1.0.0",
    );
    expectConstraintFailure("pod-crashloop-mystery", files, "keep-image");
  });

  it("rejects deleting readiness or liveness probes", () => {
    const readiness = filesFor("broken-readiness-probe");
    readiness["pod.yaml"] = readiness["pod.yaml"]!.replace(
      /      readinessProbe:[\s\S]*?(?=      livenessProbe:)/,
      "",
    );
    expectConstraintFailure("broken-readiness-probe", readiness, "keep-image");

    const liveness = filesFor("liveness-probe-death-spiral");
    liveness["deployment.yaml"] = liveness["deployment.yaml"]!.replace(
      /          livenessProbe:[\s\S]*$/,
      "",
    );
    expectConstraintFailure("liveness-probe-death-spiral", liveness, "keep-liveness");
  });

  it("rejects bypassing DNS configuration by replacing the application image", () => {
    const files = filesFor("dns-resolution-failure");
    files["orders-api.yaml"] = files["orders-api.yaml"]!.replace(
      "klab/api:1.0.0",
      "klab/web-app:1.0.0",
    );
    expectConstraintFailure("dns-resolution-failure", files, "no-renames");
  });

  it("rejects extra resources and edits outside the declared editable file set", () => {
    const files = filesFor("service-selector-mismatch");
    files["service.yaml"] +=
      "\n---\napiVersion: v1\nkind: Pod\nmetadata:\n  name: helper\nspec:\n  containers:\n    - name: helper\n      image: klab/web-app:1.0.0\n";
    expectConstraintFailure("service-selector-mismatch", files, "keep-pods");

    const level = getLevelBySlug("service-selector-mismatch")!;
    const readonlyChanged = filesFor(level.slug);
    readonlyChanged["deployment.yaml"] += "\n# changed";
    expectConstraintFailure(level.slug, readonlyChanged, "edit-svc-only");
  });

  it("rejects three independent bypass classes for every authored level", () => {
    for (const level of LEVELS) {
      const constraint = level.constraints.find((candidate) => candidate.kind === "manifest");
      expect(constraint, `${level.slug} manifest constraint`).toBeDefined();
      if (!constraint || constraint.kind !== "manifest") continue;
      const canonical = { ...filesFor(level.slug), ...LEVEL_SOLUTIONS[level.slug]?.files };
      const parsed = parseKubernetesManifests(canonical[constraint.file]!);
      expect(parsed.ok, `${level.slug} canonical parse`).toBe(true);
      if (!parsed.ok) continue;

      const renamed = structuredClone(parsed.value[0]!.raw);
      (renamed.metadata as Record<string, unknown>).name = `${constraint.resource.name}-bypass`;
      expectConstraintFailure(
        level.slug,
        { ...canonical, [constraint.file]: stringifyManifest(renamed) },
        constraint.id,
      );

      expectConstraintFailure(
        level.slug,
        {
          ...canonical,
          [constraint.file]: `${canonical[constraint.file]}\n---\napiVersion: v1\nkind: Pod\nmetadata:\n  name: helper\nspec:\n  containers:\n    - name: helper\n      image: klab/web-app:1.0.0\n`,
        },
        constraint.id,
      );

      const assertion = constraint.assertions[0]!;
      const mutated = structuredClone(parsed.value[0]!.raw);
      const replacement =
        assertion.operator === "gte"
          ? Number(assertion.value) - 1
          : assertion.operator === "lte"
            ? Number(assertion.value) + 1
            : assertion.operator === "not-equals"
              ? assertion.value
              : assertion.operator === "equals"
                ? typeof assertion.value === "number"
                  ? assertion.value + 1
                  : typeof assertion.value === "boolean"
                    ? !assertion.value
                    : `${assertion.value}-bypass`
                : "__bypass__";
      mutatePath(mutated, assertion.path, replacement, assertion.operator === "present");
      expectConstraintFailure(
        level.slug,
        { ...canonical, [constraint.file]: stringifyManifest(mutated) },
        constraint.id,
      );
    }
  });
});
