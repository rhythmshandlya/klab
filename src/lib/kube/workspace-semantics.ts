import type { ProblemLevel } from "@/lib/domain/types";

import { parseKubernetesManifests, type ParsedKubernetesManifest } from "./manifest-parser";

const WORKLOAD_KINDS = new Set([
  "Deployment",
  "ReplicaSet",
  "StatefulSet",
  "DaemonSet",
  "Pod",
  "Job",
  "CronJob",
]);

/**
 * Cross-resource checks shared by static incident and architecture assessments.
 * This is deliberately narrower than Kubernetes OpenAPI validation, but it rejects
 * the dangerous false positives a scalar path rubric cannot see: disconnected
 * selectors, missing scale targets, missing RBAC roles, broken governing Services,
 * invalid digest syntax, and changes to well-known immutable fields.
 */
export function evaluateWorkspaceSemantics(
  level: ProblemLevel,
  files: Readonly<Record<string, string>>,
): string[] {
  const parsed = parseWorkspace(level, files);
  if (parsed.errors.length > 0) return parsed.errors;

  const issues: string[] = [];
  const resources = parsed.resources;
  const workloads = resources.filter((resource) => WORKLOAD_KINDS.has(resource.kind));
  const requireClosedGraph = level.challengeMode === "build";
  const restrictedNamespaces = new Set(
    resources
      .filter(
        (resource) =>
          resource.kind === "Namespace" &&
          stringAt(resource.raw, "metadata.labels.securityProfile") === "restricted",
      )
      .map((resource) => resource.name),
  );

  for (const resource of resources) {
    validateImageDigests(resource.raw, `${resource.kind}/${resource.name}`, issues);

    if (
      resource.kind === "Deployment" ||
      resource.kind === "ReplicaSet" ||
      resource.kind === "StatefulSet" ||
      resource.kind === "DaemonSet"
    ) {
      const selector = labelsAt(resource.raw, "spec.selector.matchLabels");
      const labels = workloadLabels(resource.raw, resource.kind);
      if (!selector || Object.keys(selector).length === 0) {
        issues.push(`${resource.kind}/${resource.name} is missing spec.selector.matchLabels`);
      } else if (!labelsMatch(labels, selector)) {
        issues.push(`${resource.kind}/${resource.name} selector does not match its Pod template`);
      }
      for (const [index, spreadValue] of arrayAt(
        resource.raw,
        "spec.template.spec.topologySpreadConstraints",
      ).entries()) {
        const spread = objectValue(spreadValue);
        const spreadSelector = objectValue(spread?.labelSelector)?.matchLabels;
        const selectorLabels = objectValue(spreadSelector);
        if (selectorLabels && !labelsMatch(labels, stringLabels(selectorLabels))) {
          issues.push(
            `${resource.kind}/${resource.name} topology spread rule ${index + 1} selects no Pod template`,
          );
        }
      }
    }

    if (WORKLOAD_KINDS.has(resource.kind)) {
      validateWorkload(level.slug, resource, issues);
    }

    if (resource.kind === "Deployment") {
      const minReadySeconds = valueAt(resource.raw, "spec.minReadySeconds");
      const progressDeadlineSeconds = valueAt(resource.raw, "spec.progressDeadlineSeconds");
      if (
        typeof minReadySeconds === "number" &&
        typeof progressDeadlineSeconds === "number" &&
        progressDeadlineSeconds <= minReadySeconds
      ) {
        issues.push(
          `Deployment/${resource.name} progress deadline must exceed its readiness stability window`,
        );
      }
    }

    if (
      requireClosedGraph &&
      resource.kind === "Namespace" &&
      restrictedNamespaces.has(resource.name) &&
      stringAt(resource.raw, "/metadata/labels/pod-security.kubernetes.io~1enforce") !==
        "restricted"
    ) {
      issues.push(
        `Namespace/${resource.name} advertises restricted security without enforcing Pod Security`,
      );
    }

    if (resource.kind === "Service") {
      const selector = labelsAt(resource.raw, "spec.selector");
      if (
        requireClosedGraph &&
        selector &&
        Object.keys(selector).length > 0 &&
        workloads.length > 0
      ) {
        const matches = workloads.some(
          (workload) =>
            workload.namespace === resource.namespace &&
            labelsMatch(workloadLabels(workload.raw, workload.kind), selector),
        );
        if (!matches) issues.push(`Service/${resource.name} selects no submitted workload`);
      }
    }

    if (resource.kind === "PodDisruptionBudget") {
      const selector = labelsAt(resource.raw, "spec.selector.matchLabels");
      validateDisruptionBudget(level.slug, resource, issues);
      if (requireClosedGraph && selector && workloads.length > 0) {
        const matches = resources.some(
          (candidate) =>
            candidate.namespace === resource.namespace &&
            labelsMatch(producedPodLabels(candidate), selector),
        );
        if (!matches) issues.push(`PodDisruptionBudget/${resource.name} protects no workload`);
      }
    }

    if (requireClosedGraph && resource.kind === "HorizontalPodAutoscaler") {
      const targetApiVersion = stringAt(resource.raw, "spec.scaleTargetRef.apiVersion");
      const targetKind = stringAt(resource.raw, "spec.scaleTargetRef.kind");
      const targetName = stringAt(resource.raw, "spec.scaleTargetRef.name");
      const minReplicas = valueAt(resource.raw, "spec.minReplicas");
      const maxReplicas = valueAt(resource.raw, "spec.maxReplicas");
      if (!targetApiVersion || !targetKind || !targetName) {
        issues.push(`HorizontalPodAutoscaler/${resource.name} has an incomplete scaleTargetRef`);
      }
      if (
        typeof minReplicas !== "number" ||
        typeof maxReplicas !== "number" ||
        minReplicas < 1 ||
        maxReplicas < minReplicas
      ) {
        issues.push(`HorizontalPodAutoscaler/${resource.name} has invalid replica bounds`);
      }
      if (arrayAt(resource.raw, "spec.metrics").length === 0) {
        issues.push(`HorizontalPodAutoscaler/${resource.name} has no scaling metric`);
      }
      if (
        !targetKind ||
        !targetName ||
        !resources.some(
          (candidate) =>
            candidate.kind === targetKind &&
            candidate.name === targetName &&
            candidate.namespace === resource.namespace,
        )
      ) {
        issues.push(`HorizontalPodAutoscaler/${resource.name} has no submitted scale target`);
      }
      const target = resources.find(
        (candidate) =>
          candidate.kind === targetKind &&
          candidate.name === targetName &&
          candidate.namespace === resource.namespace,
      );
      const replicas = target ? valueAt(target.raw, "spec.replicas") : undefined;
      if (
        typeof replicas === "number" &&
        typeof maxReplicas === "number" &&
        (replicas < 1 || replicas > maxReplicas)
      ) {
        issues.push(
          `${targetKind}/${targetName} baseline replicas must be between one and the HPA maximum`,
        );
      }
    }

    if (requireClosedGraph && resource.kind === "StatefulSet") {
      const serviceName = stringAt(resource.raw, "spec.serviceName");
      if (serviceName) {
        const service = resources.find(
          (candidate) =>
            candidate.kind === "Service" &&
            candidate.name === serviceName &&
            candidate.namespace === resource.namespace,
        );
        if (service && stringAt(service.raw, "spec.clusterIP") !== "None") {
          issues.push(`StatefulSet/${resource.name} governing Service must be headless`);
        }
      }
    }

    if (
      requireClosedGraph &&
      (resource.kind === "RoleBinding" || resource.kind === "ClusterRoleBinding")
    ) {
      const roleKind = stringAt(resource.raw, "roleRef.kind");
      const roleName = stringAt(resource.raw, "roleRef.name");
      if (
        roleKind &&
        roleName &&
        !resources.some(
          (candidate) =>
            candidate.kind === roleKind &&
            candidate.name === roleName &&
            (roleKind === "ClusterRole" || candidate.namespace === resource.namespace),
        )
      ) {
        issues.push(`${resource.kind}/${resource.name} references missing ${roleKind}/${roleName}`);
      }
      if (arrayAt(resource.raw, "subjects").length !== 1) {
        issues.push(`${resource.kind}/${resource.name} must bind exactly one intended subject`);
      }
      for (const subjectValue of arrayAt(resource.raw, "subjects")) {
        const subject = objectValue(subjectValue);
        if (subject?.kind !== "ServiceAccount") continue;
        const subjectName = typeof subject.name === "string" ? subject.name : undefined;
        const subjectNamespace =
          typeof subject.namespace === "string" ? subject.namespace : resource.namespace;
        if (
          !subjectName ||
          !resources.some(
            (candidate) =>
              candidate.kind === "ServiceAccount" &&
              candidate.name === subjectName &&
              candidate.namespace === subjectNamespace,
          )
        ) {
          issues.push(
            `${resource.kind}/${resource.name} references missing ServiceAccount/${subjectName ?? "unknown"}`,
          );
        }
      }
    }

    if (resource.kind === "Role" || resource.kind === "ClusterRole") {
      validateRoleSafety(level.slug, resource, issues);
    }

    if (requireClosedGraph && resource.kind === "NetworkPolicy") {
      validateNetworkPolicy(resource, issues);
    }

    if (requireClosedGraph && resource.kind === "HTTPRoute") {
      for (const reference of arrayAt(resource.raw, "spec.parentRefs")) {
        const gateway = objectValue(reference);
        const name = typeof gateway?.name === "string" ? gateway.name : undefined;
        const namespace =
          typeof gateway?.namespace === "string" ? gateway.namespace : resource.namespace;
        if (
          name &&
          !resources.some(
            (candidate) =>
              candidate.kind === "Gateway" &&
              candidate.name === name &&
              candidate.namespace === namespace,
          )
        ) {
          issues.push(`HTTPRoute/${resource.name} references missing Gateway/${name}`);
        }
      }
      for (const ruleValue of arrayAt(resource.raw, "spec.rules")) {
        const rule = objectValue(ruleValue);
        for (const backendValue of Array.isArray(rule?.backendRefs) ? rule.backendRefs : []) {
          const backend = objectValue(backendValue);
          const kind = typeof backend?.kind === "string" ? backend.kind : "Service";
          const name = typeof backend?.name === "string" ? backend.name : undefined;
          const namespace =
            typeof backend?.namespace === "string" ? backend.namespace : resource.namespace;
          if (
            name &&
            !resources.some(
              (candidate) =>
                candidate.kind === kind &&
                candidate.name === name &&
                candidate.namespace === namespace,
            )
          ) {
            issues.push(`HTTPRoute/${resource.name} references missing ${kind}/${name}`);
          }
        }
      }
    }

    if (requireClosedGraph && resource.kind === "Pipeline") {
      for (const taskValue of arrayAt(resource.raw, "spec.tasks")) {
        const task = objectValue(taskValue);
        const taskRef = objectValue(task?.taskRef);
        const taskName = typeof taskRef?.name === "string" ? taskRef.name : undefined;
        const taskKind = typeof taskRef?.kind === "string" ? taskRef.kind : "Task";
        if (
          taskName &&
          !resources.some(
            (candidate) =>
              candidate.kind === taskKind &&
              candidate.name === taskName &&
              candidate.namespace === resource.namespace,
          )
        ) {
          issues.push(`Pipeline/${resource.name} references missing ${taskKind}/${taskName}`);
        }
      }
      if (level.slug === "build-signed-promotion-pipeline") {
        validateSignedPromotionPipeline(resource, issues);
      }
    }

    if (requireClosedGraph && resource.kind === "PipelineRun") {
      const pipelineName = stringAt(resource.raw, "spec.pipelineRef.name");
      const serviceAccount = stringAt(resource.raw, "spec.taskRunTemplate.serviceAccountName");
      if (
        !pipelineName ||
        !resources.some(
          (candidate) =>
            candidate.kind === "Pipeline" &&
            candidate.name === pipelineName &&
            candidate.namespace === resource.namespace,
        )
      ) {
        issues.push(`PipelineRun/${resource.name} references a missing Pipeline`);
      }
      if (
        !serviceAccount ||
        !resources.some(
          (candidate) =>
            candidate.kind === "ServiceAccount" &&
            candidate.name === serviceAccount &&
            candidate.namespace === resource.namespace,
        )
      ) {
        issues.push(`PipelineRun/${resource.name} must use a submitted ServiceAccount`);
      }
    }

    if (requireClosedGraph && resource.kind === "Task") {
      validateTask(level.slug, resource, issues);
    }

    if (
      requireClosedGraph &&
      (resource.kind === "ClusterPolicy" || resource.kind === "ImageValidatingPolicy")
    ) {
      validateSignaturePolicy(resource, issues);
    }

    if (requireClosedGraph && resource.kind === "Prometheus") {
      validatePrometheusSelectors(resource, resources, issues);
    }

    if (resource.kind === "PrometheusRule") {
      for (const groupValue of arrayAt(resource.raw, "spec.groups")) {
        const group = objectValue(groupValue);
        const rules = Array.isArray(group?.rules) ? group.rules : [];
        for (const ruleValue of rules) {
          const rule = objectValue(ruleValue);
          const expression = typeof rule?.expr === "string" ? rule.expr.trim() : "";
          if (!expression || /^vector\(\s*[-+]?\d+(?:\.\d+)?\s*\)$/i.test(expression)) {
            issues.push(`PrometheusRule/${resource.name} contains an ineffective alert expression`);
          }
        }
      }
    }

    if (resource.kind === "ValidatingWebhookConfiguration") {
      for (const [index, webhookValue] of arrayAt(resource.raw, "webhooks").entries()) {
        const webhook = objectValue(webhookValue);
        if (!Array.isArray(webhook?.admissionReviewVersions)) {
          issues.push(
            `ValidatingWebhookConfiguration/${resource.name} webhook ${index + 1} is missing admissionReviewVersions`,
          );
        }
        if (typeof webhook?.sideEffects !== "string") {
          issues.push(
            `ValidatingWebhookConfiguration/${resource.name} webhook ${index + 1} is missing sideEffects`,
          );
        }
      }
    }

    if (resource.kind === "Secret") {
      const data = objectValue(valueAt(resource.raw, "data"));
      for (const [key, value] of Object.entries(data ?? {})) {
        if (typeof value !== "string" || !isBase64(value)) {
          issues.push(`Secret/${resource.name} data.${key} is not valid base64`);
        }
      }
    }
  }

  issues.push(...immutableChangeIssues(level, files));
  return [...new Set(issues)];
}

function parseWorkspace(
  level: ProblemLevel,
  files: Readonly<Record<string, string>>,
): { resources: ParsedKubernetesManifest[]; errors: string[] } {
  const resources: ParsedKubernetesManifest[] = [];
  const errors: string[] = [];
  for (const file of level.files.filter(
    (candidate) => candidate.access === "editable" && candidate.language === "yaml",
  )) {
    const parsed = parseKubernetesManifests(files[file.path] ?? file.initialValue);
    if (!parsed.ok) errors.push(`${file.path}: ${parsed.error.message}`);
    else resources.push(...parsed.value);
  }
  return { resources, errors };
}

function immutableChangeIssues(
  level: ProblemLevel,
  files: Readonly<Record<string, string>>,
): string[] {
  const immutablePaths: Record<string, string[]> = {
    PriorityClass: ["value", "preemptionPolicy"],
    StorageClass: ["volumeBindingMode"],
    StatefulSet: ["spec.podManagementPolicy"],
    Service: ["spec.clusterIP"],
  };
  const issues: string[] = [];

  for (const file of level.files.filter((candidate) => candidate.access === "editable")) {
    const original = parseKubernetesManifests(file.initialValue);
    const current = parseKubernetesManifests(files[file.path] ?? file.initialValue);
    if (!original.ok || !current.ok) continue;
    for (const before of original.value) {
      const after = current.value.find(
        (candidate) =>
          candidate.kind === before.kind &&
          candidate.name === before.name &&
          candidate.namespace === before.namespace,
      );
      if (!after) continue;
      for (const path of immutablePaths[before.kind] ?? []) {
        const beforeValue = valueAt(before.raw, path);
        const afterValue = valueAt(after.raw, path);
        if (
          beforeValue !== undefined &&
          JSON.stringify(beforeValue) !== JSON.stringify(afterValue)
        ) {
          issues.push(`${before.kind}/${before.name} changes immutable field ${path}`);
        }
      }
    }
  }
  return issues;
}

function validatePrometheusSelectors(
  prometheus: ParsedKubernetesManifest,
  resources: readonly ParsedKubernetesManifest[],
  issues: string[],
): void {
  const serviceAccountName = stringAt(prometheus.raw, "spec.serviceAccountName");
  if (
    !serviceAccountName ||
    !resources.some(
      (candidate) =>
        candidate.kind === "ServiceAccount" &&
        candidate.name === serviceAccountName &&
        candidate.namespace === prometheus.namespace,
    )
  ) {
    issues.push(`Prometheus/${prometheus.name} must use a submitted discovery ServiceAccount`);
  } else {
    const hasDiscoveryBinding = resources.some(
      (candidate) =>
        candidate.kind === "ClusterRoleBinding" &&
        arrayAt(candidate.raw, "subjects").some((subjectValue) => {
          const subject = objectValue(subjectValue);
          return (
            subject?.kind === "ServiceAccount" &&
            subject.name === serviceAccountName &&
            subject.namespace === prometheus.namespace
          );
        }),
    );
    if (!hasDiscoveryBinding) {
      issues.push(`Prometheus/${prometheus.name} ServiceAccount has no discovery binding`);
    }
  }

  const podLabels = labelsAt(prometheus.raw, "spec.podMetadata.labels") ?? {};
  for (const [index, spreadValue] of arrayAt(
    prometheus.raw,
    "spec.topologySpreadConstraints",
  ).entries()) {
    const spreadSelector = objectValue(objectValue(spreadValue)?.labelSelector)?.matchLabels;
    const selectorLabels = objectValue(spreadSelector);
    if (selectorLabels && !labelsMatch(podLabels, stringLabels(selectorLabels))) {
      issues.push(
        `Prometheus/${prometheus.name} topology spread rule ${index + 1} selects no Prometheus Pod`,
      );
    }
  }
  const selectors = [
    ["spec.serviceMonitorSelector.matchLabels", "ServiceMonitor"],
    ["spec.probeSelector.matchLabels", "Probe"],
    ["spec.ruleSelector.matchLabels", "PrometheusRule"],
  ] as const;

  for (const [path, kind] of selectors) {
    const selector = labelsAt(prometheus.raw, path);
    if (!selector || Object.keys(selector).length === 0) {
      issues.push(`Prometheus/${prometheus.name} is missing a ${kind} selector`);
      continue;
    }
    const matches = resources.some(
      (candidate) =>
        candidate.kind === kind &&
        candidate.namespace === prometheus.namespace &&
        labelsMatch(labelsAt(candidate.raw, "metadata.labels") ?? {}, selector),
    );
    if (!matches) issues.push(`Prometheus/${prometheus.name} selects no submitted ${kind}`);
  }
}

function validateDisruptionBudget(
  slug: string,
  budget: ParsedKubernetesManifest,
  issues: string[],
): void {
  const minAvailable = valueAt(budget.raw, "spec.minAvailable");
  const maxUnavailable = valueAt(budget.raw, "spec.maxUnavailable");
  if (minAvailable === undefined && maxUnavailable === undefined) {
    issues.push(`PodDisruptionBudget/${budget.name} must set minAvailable or maxUnavailable`);
    return;
  }
  if (minAvailable !== undefined && maxUnavailable !== undefined) {
    issues.push(`PodDisruptionBudget/${budget.name} must not set both disruption bounds`);
    return;
  }

  const requirement = disruptionRequirement(slug, budget.name);
  if (!requirement) return;
  const resolved = resolvedPodCount(
    minAvailable !== undefined ? minAvailable : maxUnavailable,
    requirement.baseline,
  );
  const preserved =
    resolved === undefined
      ? undefined
      : minAvailable !== undefined
        ? resolved
        : requirement.baseline - resolved;
  if (preserved === undefined || preserved < requirement.minimumAvailable) {
    issues.push(
      `PodDisruptionBudget/${budget.name} must preserve at least ${requirement.minimumAvailable} of ${requirement.baseline} baseline replicas`,
    );
  }
}

function disruptionRequirement(
  slug: string,
  name: string,
): { baseline: number; minimumAvailable: number } | undefined {
  const requirements: Record<string, { baseline: number; minimumAvailable: number }> = {
    "build-three-zone-api/checkout-api": { baseline: 4, minimumAvailable: 3 },
    "build-recoverable-stateful-data-plane/orders-db": { baseline: 3, minimumAvailable: 2 },
    "build-flash-sale-scaling-system/sale-api": { baseline: 6, minimumAvailable: 4 },
    "build-flash-sale-scaling-system/sale-worker": { baseline: 10, minimumAvailable: 8 },
    "build-incident-survivable-observability/blackbox-exporter": {
      baseline: 2,
      minimumAvailable: 1,
    },
    "build-incident-survivable-observability/platform-prometheus": {
      baseline: 2,
      minimumAvailable: 1,
    },
  };
  return requirements[`${slug}/${name}`];
}

function resolvedPodCount(value: unknown, baseline: number): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  if (typeof value !== "string") return undefined;
  const match = /^(\d+(?:\.\d+)?)%$/.exec(value);
  if (!match) return undefined;
  return Math.ceil((Number(match[1]) / 100) * baseline);
}

function producedPodLabels(resource: ParsedKubernetesManifest): Record<string, string> {
  if (resource.kind === "Prometheus") {
    return labelsAt(resource.raw, "spec.podMetadata.labels") ?? {};
  }
  return WORKLOAD_KINDS.has(resource.kind) ? workloadLabels(resource.raw, resource.kind) : {};
}

function validateWorkload(
  slug: string,
  resource: ParsedKubernetesManifest,
  issues: string[],
): void {
  const podSpecPath =
    resource.kind === "Pod"
      ? "spec"
      : resource.kind === "CronJob"
        ? "spec.jobTemplate.spec.template.spec"
        : "spec.template.spec";
  const podSpec = objectValue(valueAt(resource.raw, podSpecPath));
  if (!podSpec) {
    issues.push(`${resource.kind}/${resource.name} has no Pod specification`);
    return;
  }

  const containers = Array.isArray(podSpec.containers) ? podSpec.containers : [];
  const auxiliaryContainers = [
    ...(Array.isArray(podSpec.initContainers) ? podSpec.initContainers : []),
    ...(Array.isArray(podSpec.ephemeralContainers) ? podSpec.ephemeralContainers : []),
  ];
  if (containers.length === 0) {
    issues.push(`${resource.kind}/${resource.name} must define at least one container`);
  }
  for (const [index, containerValue] of [...containers, ...auxiliaryContainers].entries()) {
    const container = objectValue(containerValue);
    if (
      !container ||
      typeof container.name !== "string" ||
      container.name.length === 0 ||
      typeof container.image !== "string" ||
      container.image.length === 0
    ) {
      issues.push(
        `${resource.kind}/${resource.name} container ${index + 1} needs a name and image`,
      );
      continue;
    }
    for (const probeName of ["startupProbe", "readinessProbe", "livenessProbe"] as const) {
      if (container[probeName] !== undefined && !hasProbeHandler(container[probeName])) {
        issues.push(
          `${resource.kind}/${resource.name} container ${container.name} has an empty ${probeName}`,
        );
      }
    }
    const resources = objectValue(container.resources);
    for (const section of ["requests", "limits"] as const) {
      const quantities = objectValue(resources?.[section]);
      for (const [name, value] of Object.entries(quantities ?? {})) {
        if (!isPositiveQuantity(value)) {
          issues.push(
            `${resource.kind}/${resource.name} container ${container.name} has non-positive ${section}.${name}`,
          );
        }
      }
    }
  }

  if (slug === "build-hardened-admin-workload") {
    if (podSpec.hostNetwork === true || podSpec.hostPID === true || podSpec.hostIPC === true) {
      issues.push(`${resource.kind}/${resource.name} must not join host namespaces`);
    }
    const podSecurity = objectValue(podSpec.securityContext);
    if (
      podSecurity?.runAsNonRoot !== true ||
      podSecurity?.runAsUser === 0 ||
      stringAt(podSecurity, "seccompProfile.type") !== "RuntimeDefault"
    ) {
      issues.push(`${resource.kind}/${resource.name} lacks the required Pod security context`);
    }
    for (const containerValue of [...containers, ...auxiliaryContainers]) {
      const container = objectValue(containerValue);
      const security = objectValue(container?.securityContext);
      const dropped = stringArray(objectValue(security?.capabilities)?.drop);
      if (
        security?.privileged === true ||
        security?.runAsUser === 0 ||
        security?.allowPrivilegeEscalation !== false ||
        security?.readOnlyRootFilesystem !== true ||
        !dropped.includes("ALL")
      ) {
        issues.push(
          `${resource.kind}/${resource.name} containers must be non-privileged, read-only, and drop all capabilities`,
        );
        break;
      }
      if (
        Array.isArray(container?.ports) &&
        container.ports.some((port) => {
          const hostPort = objectValue(port)?.hostPort;
          return typeof hostPort === "number" && hostPort > 0;
        })
      ) {
        issues.push(`${resource.kind}/${resource.name} containers must not expose host ports`);
        break;
      }
    }
    if (arrayAt(podSpec, "volumes").some((volume) => objectValue(volume)?.hostPath !== undefined)) {
      issues.push(`${resource.kind}/${resource.name} must not mount host paths`);
    }
  }
}

function validateNetworkPolicy(policy: ParsedKubernetesManifest, issues: string[]): void {
  const ingress = arrayAt(policy.raw, "spec.ingress");
  const egress = arrayAt(policy.raw, "spec.egress");
  if (policy.name === "default-deny") {
    if (ingress.length > 0) {
      issues.push(`NetworkPolicy/${policy.name} must not contain allow ingress rules`);
    }
    if (egress.length > 0) {
      issues.push(`NetworkPolicy/${policy.name} must not contain allow egress rules`);
    }
  }

  for (const [direction, rules] of [
    ["ingress", ingress],
    ["egress", egress],
  ] as const) {
    for (const [index, ruleValue] of rules.entries()) {
      const rule = objectValue(ruleValue);
      if (!rule || Object.keys(rule).length === 0) {
        issues.push(
          `NetworkPolicy/${policy.name} contains an allow-all ${direction} rule ${index + 1}`,
        );
        continue;
      }
      const peers = direction === "ingress" ? rule.from : rule.to;
      if (
        Array.isArray(peers) &&
        peers.some((peer) => {
          const object = objectValue(peer);
          const namespaceSelector = objectValue(object?.namespaceSelector);
          const ipBlock = objectValue(object?.ipBlock);
          return (
            !object ||
            Object.keys(object).length === 0 ||
            (namespaceSelector !== undefined && isEmptyLabelSelector(namespaceSelector)) ||
            ipBlock?.cidr === "0.0.0.0/0" ||
            ipBlock?.cidr === "::/0"
          );
        })
      ) {
        issues.push(`NetworkPolicy/${policy.name} contains an unrestricted ${direction} peer`);
      }
    }
  }

  const egressPorts = egress.flatMap((rule) => {
    const values = objectValue(rule)?.ports;
    return Array.isArray(values) ? values : [];
  });
  if (policy.name.includes("dns") || egressPorts.some((port) => objectValue(port)?.port === 53)) {
    const protocols = new Set(
      egressPorts
        .map((port) => objectValue(port))
        .filter((port) => port?.port === 53)
        .map((port) => (typeof port?.protocol === "string" ? port.protocol : "TCP")),
    );
    if (!protocols.has("UDP") || !protocols.has("TCP")) {
      issues.push(`NetworkPolicy/${policy.name} must allow DNS over both UDP and TCP`);
    }
  }
}

function isEmptyLabelSelector(selector: Record<string, unknown>): boolean {
  const matchLabels = objectValue(selector.matchLabels);
  const matchExpressions = Array.isArray(selector.matchExpressions)
    ? selector.matchExpressions
    : undefined;
  return (
    (matchLabels === undefined || Object.keys(matchLabels).length === 0) &&
    (matchExpressions === undefined || matchExpressions.length === 0)
  );
}

function validateTask(slug: string, resource: ParsedKubernetesManifest, issues: string[]): void {
  const steps = arrayAt(resource.raw, "spec.steps");
  if (steps.length === 0) {
    issues.push(`Task/${resource.name} has no executable steps`);
    return;
  }
  for (const [index, stepValue] of steps.entries()) {
    const step = objectValue(stepValue);
    const executable =
      typeof step?.script === "string" ||
      (Array.isArray(step?.command) && step.command.length > 0) ||
      (Array.isArray(step?.args) && step.args.length > 0);
    if (typeof step?.image !== "string" || step.image.length === 0 || !executable) {
      issues.push(`Task/${resource.name} step ${index + 1} needs an image and executable action`);
    }
  }
  if (slug === "build-signed-promotion-pipeline" && resource.name === "cosign-verify") {
    const step = objectValue(steps[0]);
    const args = stringArray(step?.args);
    const expectedArgs = [
      "verify",
      "--certificate-identity=https://github.com/rhythmshandlya/klab/.github/workflows/release.yml@refs/heads/main",
      "--certificate-oidc-issuer=https://token.actions.githubusercontent.com",
      "$(params.image)",
    ];
    if (
      steps.length !== 1 ||
      step?.image !==
        "registry.example/tools/cosign@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" ||
      !sameSet(args, expectedArgs)
    ) {
      issues.push(
        "Task/cosign-verify must verify the submitted image with the trusted CI keyless identity",
      );
    }
  }
  if (slug === "build-signed-promotion-pipeline" && resource.name === "patch-deployment-digest") {
    const step = objectValue(steps[0]);
    const script = typeof step?.script === "string" ? step.script : "";
    if (
      steps.length !== 1 ||
      step?.image !==
        "registry.example/tools/kubectl@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" ||
      !script.includes("deployment/$(params.deployment)") ||
      !script.includes("checkout=$(params.image)") ||
      !script.includes("-n production")
    ) {
      issues.push(
        "Task/patch-deployment-digest must promote only the submitted digest to checkout in production",
      );
    }
  }
}

function validateSignedPromotionPipeline(
  pipeline: ParsedKubernetesManifest,
  issues: string[],
): void {
  const tasks = arrayAt(pipeline.raw, "spec.tasks")
    .map(objectValue)
    .filter((task): task is Record<string, unknown> => task !== undefined);
  const verify = tasks.find((task) => task.name === "verify-signature");
  const promote = tasks.find((task) => task.name === "promote-checkout");
  const pipelineParams = arrayAt(pipeline.raw, "spec.params")
    .map(objectValue)
    .filter((param): param is Record<string, unknown> => param !== undefined);
  const hasDigestParam = pipelineParams.some(
    (param) => param.name === "imageDigest" && param.type === "string",
  );
  const verifyImage = namedParamValue(verify, "image");
  const promoteImage = namedParamValue(promote, "image");
  const expectedImage = "registry.example/checkout@$(params.imageDigest)";
  if (
    tasks.length !== 2 ||
    !hasDigestParam ||
    objectValue(verify?.taskRef)?.name !== "cosign-verify" ||
    objectValue(promote?.taskRef)?.name !== "patch-deployment-digest" ||
    !stringArray(promote?.runAfter).includes("verify-signature") ||
    verifyImage !== expectedImage ||
    promoteImage !== expectedImage
  ) {
    issues.push(
      `Pipeline/${pipeline.name} must verify and promote the same checkout digest in sequence`,
    );
  }
}

function namedParamValue(owner: Record<string, unknown> | undefined, name: string): unknown {
  return arrayAt(owner, "params")
    .map(objectValue)
    .find((param) => param?.name === name)?.value;
}

function validateSignaturePolicy(resource: ParsedKubernetesManifest, issues: string[]): void {
  if (resource.kind === "ImageValidatingPolicy") {
    const required = valueAt(resource.raw, "spec.validationConfigurations.required");
    const verifyDigest = valueAt(resource.raw, "spec.validationConfigurations.verifyDigest");
    const mutateDigest = valueAt(resource.raw, "spec.validationConfigurations.mutateDigest");
    const imageGlobs = arrayAt(resource.raw, "spec.matchImageReferences")
      .map(objectValue)
      .map((matcher) => matcher?.glob)
      .filter((glob): glob is string => typeof glob === "string");
    const attestors = arrayAt(resource.raw, "spec.attestors");
    const validations = arrayAt(resource.raw, "spec.validations");
    if (
      required !== true ||
      verifyDigest !== true ||
      mutateDigest !== false ||
      !imageGlobs.includes("*") ||
      attestors.length === 0
    ) {
      issues.push(
        `ImageValidatingPolicy/${resource.name} must reject tags and verify every image digest with a named attestor`,
      );
    }
    for (const attestorValue of attestors) {
      const attestor = objectValue(attestorValue);
      const identities = arrayAt(attestor, "cosign.keyless.identities");
      if (typeof attestor?.name !== "string" || identities.length === 0) {
        issues.push(
          `ImageValidatingPolicy/${resource.name} must configure a named keyless identity`,
        );
      }
      for (const identityValue of identities) {
        const identity = objectValue(identityValue);
        const subject = typeof identity?.subject === "string" ? identity.subject : "";
        const issuer = typeof identity?.issuer === "string" ? identity.issuer : "";
        if (!subject.startsWith("https://github.com/") || !issuer.startsWith("https://")) {
          issues.push(
            `ImageValidatingPolicy/${resource.name} keyless attestor must bind a repository workflow identity and issuer`,
          );
        }
      }
    }
    const expressions = validations
      .map((validation) => objectValue(validation)?.expression)
      .filter((expression): expression is string => typeof expression === "string");
    const registryRule = expressions.find(
      (expression) => expression.includes("registry.example/") && expression.includes("@sha256:"),
    );
    const signatureRule = expressions.find((expression) =>
      expression.includes("verifyImageSignatures"),
    );
    if (!registryRule || registryRule.includes("||")) {
      issues.push(
        `ImageValidatingPolicy/${resource.name} must restrict every production image to the approved digest registry`,
      );
    }
    if (
      !signatureRule ||
      signatureRule.replaceAll(/\s/g, "") !==
        "images.containers.map(image,verifyImageSignatures(image,[attestors.trustedCi])).all(result,result>0)"
    ) {
      issues.push(
        `ImageValidatingPolicy/${resource.name} must enforce signature verification in CEL`,
      );
    }
    return;
  }

  for (const [ruleIndex, ruleValue] of arrayAt(resource.raw, "spec.rules").entries()) {
    const rule = objectValue(ruleValue);
    const verifyImages = Array.isArray(rule?.verifyImages) ? rule.verifyImages : [];
    for (const [verifyIndex, verifyValue] of verifyImages.entries()) {
      const verify = objectValue(verifyValue);
      const attestors = Array.isArray(verify?.attestors) ? verify.attestors : [];
      if (verify?.required !== true || attestors.length === 0) {
        issues.push(
          `ClusterPolicy/${resource.name} signature rule ${ruleIndex + 1}.${verifyIndex + 1} must require nonempty attestors`,
        );
      }
      for (const attestorValue of attestors) {
        const entries = objectValue(attestorValue)?.entries;
        if (!Array.isArray(entries) || entries.length === 0) {
          issues.push(
            `ClusterPolicy/${resource.name} signature attestors must contain verification entries`,
          );
          continue;
        }
        for (const entryValue of entries) {
          const keyless = objectValue(objectValue(entryValue)?.keyless);
          if (!keyless) continue;
          const subject = typeof keyless.subject === "string" ? keyless.subject : "";
          const issuer = typeof keyless.issuer === "string" ? keyless.issuer : "";
          if (!subject.startsWith("https://github.com/") || !issuer.startsWith("https://")) {
            issues.push(
              `ClusterPolicy/${resource.name} keyless attestor must bind a repository workflow identity and issuer`,
            );
          }
        }
      }
    }
  }
}

function validateRoleSafety(slug: string, role: ParsedKubernetesManifest, issues: string[]): void {
  const rules = arrayAt(role.raw, "rules");
  for (const ruleValue of rules) {
    const rule = objectValue(ruleValue);
    const apiGroups = stringArray(rule?.apiGroups);
    const resources = stringArray(rule?.resources);
    const verbs = stringArray(rule?.verbs);

    if (apiGroups.includes("*") || resources.includes("*") || verbs.includes("*")) {
      issues.push(`${role.kind}/${role.name} contains wildcard authority`);
    }
    if (
      slug === "build-hardened-admin-workload" &&
      !isHardenedAdminRule(apiGroups, resources, stringArray(rule?.resourceNames), verbs)
    ) {
      issues.push(`Role/${role.name} grants authority outside the maintenance contract`);
    }
    if (slug === "build-two-team-platform" && !isTenantDeveloperRule(apiGroups, resources, verbs)) {
      issues.push(`Role/${role.name} crosses the tenant security boundary`);
    }
    if (slug === "build-signed-promotion-pipeline") {
      const resourceNames = stringArray(rule?.resourceNames);
      if (
        !sameSet(apiGroups, ["apps"]) ||
        !sameSet(resources, ["deployments"]) ||
        !sameSet(verbs, ["get", "patch"]) ||
        !sameSet(resourceNames, ["checkout"])
      ) {
        issues.push(`Role/${role.name} exceeds checkout-only promotion authority`);
      }
    }
    if (
      slug === "build-incident-survivable-observability" &&
      role.kind === "ClusterRole" &&
      !isPrometheusDiscoveryRule(apiGroups, resources, verbs)
    ) {
      issues.push(`ClusterRole/${role.name} exceeds read-only target discovery authority`);
    }
  }
  if (
    slug === "build-incident-survivable-observability" &&
    role.kind === "ClusterRole" &&
    rules.length !== 2
  ) {
    issues.push(`ClusterRole/${role.name} must contain exactly two discovery rules`);
  }
}

function isPrometheusDiscoveryRule(
  apiGroups: string[],
  resources: string[],
  verbs: string[],
): boolean {
  if (!sameSet(verbs, ["get", "list", "watch"])) return false;
  if (sameSet(apiGroups, ["discovery.k8s.io"])) {
    return sameSet(resources, ["endpointslices"]);
  }
  if (sameSet(apiGroups, [""])) {
    return sameSet(resources, ["nodes", "nodes/metrics", "pods", "services", "endpoints"]);
  }
  return false;
}

function isHardenedAdminRule(
  apiGroups: string[],
  resources: string[],
  resourceNames: string[],
  verbs: string[],
): boolean {
  if (!sameSet(apiGroups, [""]) || resources.length !== 1) return false;
  if (resources[0] === "secrets") {
    return sameSet(resourceNames, ["maintenance-token"]) && sameSet(verbs, ["get"]);
  }
  if (resources[0] === "configmaps") {
    return sameSet(resourceNames, ["maintenance-window"]) && sameSet(verbs, ["get", "patch"]);
  }
  return false;
}

function isTenantDeveloperRule(apiGroups: string[], resources: string[], verbs: string[]): boolean {
  const allowedVerbs = ["create", "delete", "get", "list", "patch", "update", "watch"];
  if (!sameSet(verbs, allowedVerbs)) return false;
  if (sameSet(apiGroups, ["apps"])) {
    return sameSet(resources, ["deployments", "statefulsets"]);
  }
  if (sameSet(apiGroups, [""])) {
    return sameSet(resources, ["configmaps", "pods", "services"]);
  }
  return false;
}

function sameSet(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length && expected.every((item) => actual.includes(item));
}

function hasProbeHandler(value: unknown): boolean {
  const probe = objectValue(value);
  return Boolean(
    probe &&
    ["httpGet", "tcpSocket", "exec", "grpc"].some(
      (handler) => objectValue(probe[handler]) !== undefined,
    ),
  );
}

function isPositiveQuantity(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value !== "string" || value.trim().length === 0) return false;
  const match = value.trim().match(/^([+]?(?:\d+(?:\.\d+)?|\.\d+))(?:[a-zA-Z]+)?$/);
  return Boolean(match && Number(match[1]) > 0);
}

function workloadLabels(resource: Record<string, unknown>, kind: string): Record<string, string> {
  const path =
    kind === "Pod"
      ? "metadata.labels"
      : kind === "CronJob"
        ? "spec.jobTemplate.spec.template.metadata.labels"
        : "spec.template.metadata.labels";
  return labelsAt(resource, path) ?? {};
}

function labelsMatch(labels: Record<string, string>, selector: Record<string, string>): boolean {
  return Object.entries(selector).every(([key, value]) => labels[key] === value);
}

function labelsAt(root: unknown, path: string): Record<string, string> | undefined {
  const value = valueAt(root, path);
  const object = objectValue(value);
  if (!object) return undefined;
  return Object.fromEntries(
    Object.entries(object).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function stringAt(root: unknown, path: string): string | undefined {
  const value = valueAt(root, path);
  return typeof value === "string" ? value : undefined;
}

function arrayAt(root: unknown, path: string): unknown[] {
  const value = valueAt(root, path);
  return Array.isArray(value) ? value : [];
}

function valueAt(root: unknown, path: string): unknown {
  const segments = path.startsWith("/")
    ? path
        .slice(1)
        .split("/")
        .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"))
    : path.split(".");
  return segments.reduce<unknown>((value, segment) => {
    if (Array.isArray(value) && /^\d+$/.test(segment)) return value[Number(segment)];
    return objectValue(value)?.[segment];
  }, root);
}

function stringLabels(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isBase64(value: string): boolean {
  return (
    value.length > 0 &&
    value.length % 4 === 0 &&
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  );
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function validateImageDigests(root: unknown, owner: string, issues: string[]): void {
  if (typeof root === "string") {
    if (
      /^[A-Za-z0-9][A-Za-z0-9._/:@-]*@sha256:/.test(root) &&
      !/@sha256:[a-f0-9]{64}$/.test(root)
    ) {
      issues.push(`${owner} uses an invalid SHA-256 image digest`);
    }
    return;
  }
  if (Array.isArray(root)) {
    for (const value of root) validateImageDigests(value, owner, issues);
    return;
  }
  const object = objectValue(root);
  if (!object) return;
  for (const value of Object.values(object)) validateImageDigests(value, owner, issues);
}
