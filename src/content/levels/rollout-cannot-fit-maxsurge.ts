import type { ProblemLevel } from "@/lib/domain/types";

import { PUBLISHED_PROBLEM_V1 } from "./metadata";

/**
 * Level: Rollout Cannot Fit maxSurge.
 *
 * The analytics cluster has exactly enough CPU for the two desired replicas. The team
 * is rolling the broken v1 release forward to v2, but the Deployment asks for
 * maxSurge: 2 / maxUnavailable: 0. The controller tries to create two extra surge pods
 * that the scheduler cannot fit (Pending, Insufficient cpu), and because maxUnavailable
 * is 0 it refuses to terminate an old pod to make room, so the rollout is frozen and
 * the buggy v1 keeps serving 500s. Set maxSurge: 0 with maxUnavailable: 1 so the
 * controller rolls within existing capacity.
 */

const DEPLOYMENT_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: analytics
  namespace: default
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2
      maxUnavailable: 0
  selector:
    matchLabels:
      app: analytics
  template:
    metadata:
      labels:
        app: analytics
        track: v2
    spec:
      containers:
        - name: api
          image: klab/analytics:2.0.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 2
          resources:
            requests:
              cpu: "2"
            limits:
              cpu: "2"
`;

const SERVICE_YAML = `apiVersion: v1
kind: Service
metadata:
  name: analytics-svc
  namespace: default
spec:
  selector:
    app: analytics
  ports:
    - name: http
      port: 80
      targetPort: 8080
`;

const CAPACITY_NOTE = `# Cluster capacity note
#
# The default node pool provides a total of 4 allocatable CPU.
# Each analytics replica requests 2 CPU, so the cluster fits exactly 2 replicas.
# There is no spare capacity for surge pods during a rollout.
`;

export const rolloutCannotFitMaxsurge = {
  id: "rollout-cannot-fit-maxsurge",
  slug: "rollout-cannot-fit-maxsurge",
  ...PUBLISHED_PROBLEM_V1,
  title: "Rollout Cannot Fit maxSurge",
  difficulty: "advanced",
  severity: "high",
  xp: 200,
  estimatedMinutes: 35,
  successRate: 38,
  concepts: ["deployments", "rollouts", "scheduling", "resources", "debugging"],
  blurb:
    "The new release is ready, but the rollout is frozen solid: the cluster cannot spare a single surge pod.",
  story:
    "Analytics v1 has a dependency-schema bug and is serving HTTP 500. The fix is in v2.0.0, which you kicked off ten minutes ago, but the rollout is still at 0% updated. The new ReplicaSet's pods are stuck Pending with Insufficient cpu, and the old ReplicaSet refuses to give up a slot. The cluster is full, and the rollout strategy will not let anything move.",
  objective: "Land the v2.0.0 release by making the rollout fit the cluster's capacity.",
  learningObjectives: [
    "Diagnose a rollout frozen by scheduling pressure (Pending surge pods, maxUnavailable: 0).",
    "Choose surge/availability parameters that roll within actual cluster capacity.",
  ],
  prerequisites: ["rolling-update-gone-wrong", "service-has-no-endpoints"],
  learningPaths: ["reliability", "sre-on-call"],
  capabilities: [
    "pods",
    "services",
    "deployments",
    "replicasets",
    "events",
    "http-probes",
    "rollouts",
    "scheduling",
  ],
  engine: { kind: "scripted", scenarioId: "rollout-maxsurge-capacity" },
  constraints: [
    {
      id: "edit-deploy-only",
      label: "Only edit deployment.yaml; the Service and the v2.0.0 release are correct",
      kind: "editable-files",
      paths: ["deployment.yaml"],
    },
    {
      id: "fit-capacity",
      label: "Roll within capacity: no surge pods, allow at least one old pod to yield",
      kind: "manifest",
      file: "deployment.yaml",
      resource: { kind: "Deployment", name: "analytics" },
      exclusive: true,
      assertions: [
        {
          path: "spec.template.spec.containers[name=api].image",
          operator: "equals",
          value: "klab/analytics:2.0.0",
        },
        { path: "spec.replicas", operator: "gte", value: 2 },
      ],
      // Percentage bounds that resolve to the same peak replica count are equally
      // correct, so the requirement is stated as the capacity the cluster has.
      goals: [{ goal: "rollout-fits-capacity", schedulableReplicas: 2 }],
    },
  ],
  files: [
    {
      path: "deployment.yaml",
      language: "yaml",
      initialValue: DEPLOYMENT_YAML,
      access: "editable",
      applyAtBoot: false,
    },
    {
      path: "service.yaml",
      language: "yaml",
      initialValue: SERVICE_YAML,
      access: "readonly",
      applyAtBoot: true,
    },
    {
      path: "capacity-note.txt",
      language: "markdown",
      initialValue: CAPACITY_NOTE,
      access: "readonly",
      applyAtBoot: false,
    },
  ],
  quickCommands: [
    { id: "command-1", command: "kubectl get pods" },
    { id: "command-2", command: "kubectl get rs" },
    { id: "command-3", command: "kubectl get deployment analytics -o yaml" },
    {
      id: "command-4",
      command: "kubectl describe pod <pod>",
      target: {
        kind: "pod",
        namespace: "default",
        selector: { app: "analytics", track: "v2" },
        prefer: "first",
      },
    },
    { id: "command-5", command: "kubectl get events" },
  ],
  probeTargets: ["http://analytics-svc/", "http://analytics-svc/healthz"],
  validators: [
    {
      id: "analytics-deployment-ready",
      title: "Deployment has ready v2 replicas",
      successLabel: "analytics has 2 ready replicas",
      failureLabel: "analytics replicas are not Ready",
      kind: "deployment-ready",
      namespace: "default",
      name: "analytics",
      minReadyReplicas: 2,
    },
    {
      id: "analytics-service-endpoints",
      title: "Service has ready endpoints",
      successLabel: "analytics-svc has ready endpoints",
      failureLabel: "analytics-svc has zero ready endpoints",
      kind: "service-has-ready-endpoints",
      namespace: "default",
      name: "analytics-svc",
      minReadyEndpoints: 2,
    },
    {
      id: "analytics-http-200",
      title: "Service returns 200",
      successLabel: "GET / through analytics-svc returns 200",
      failureLabel: "GET / through analytics-svc does not return 200",
      kind: "http-get-through-service",
      namespace: "default",
      service: "analytics-svc",
      port: 80,
      path: "/",
      expectStatus: 200,
    },
  ],
  hints: [
    {
      id: "hint-1",
      title: "Why is nothing moving?",
      body: "Read the rollout: the new ReplicaSet's pods are Pending, the old ReplicaSet is unchanged. `kubectl get events` and `kubectl describe pod <pod>` will tell you why the new pods cannot start.",
      xpPenalty: 25,
    },
    {
      id: "hint-2",
      title: "Surge needs spare room",
      body: "maxSurge asks the controller to create extra pods beyond the desired count. When the cluster has no spare capacity, those surge pods stay Pending. With maxUnavailable: 0 the controller also will not free a slot by terminating an old pod.",
      xpPenalty: 40,
      unlockAfter: ["r-failed-scheduling"],
    },
    {
      id: "hint-3",
      title: "Roll within capacity",
      body: "Set maxSurge to 0 and maxUnavailable to 1. The controller will terminate one old pod, schedule one new pod in the freed capacity, wait for it to be Ready, then repeat.",
      xpPenalty: 60,
      unlockAfter: ["r-maxsurge-strategy"],
    },
  ],
  evidenceRules: [
    {
      id: "r-pending-surge",
      evidenceId: "pending-surge",
      label: "The new ReplicaSet's surge pods are stuck Pending",
      hiddenLabel: "Pod status checked",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get pods", outputMatches: "Pending" },
    },
    {
      id: "r-failed-scheduling",
      evidenceId: "failed-scheduling",
      label: "Surge pods fail scheduling: Insufficient cpu",
      hiddenLabel: "Scheduling events reviewed",
      source: "events",
      trigger: {
        type: "event-reason",
        reason: "FailedScheduling",
        messageMatches: "Insufficient cpu",
      },
    },
    {
      id: "r-maxsurge-strategy",
      evidenceId: "maxsurge-strategy",
      label: "The rollout asks for maxSurge: 2 with maxUnavailable: 0",
      hiddenLabel: "Rollout strategy inspected",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "get deployment|describe deployment",
        outputMatches: "maxSurge",
      },
    },
    {
      id: "r-service-500",
      evidenceId: "service-500",
      label: "analytics-svc still returns 500 from the frozen v1 release",
      hiddenLabel: "Service reachability tested",
      source: "network",
      trigger: {
        type: "probe",
        hostMatches: "^analytics-svc$",
        pathMatches: "^/$",
        status: 500,
      },
    },
  ],
  postSolveExplanation: {
    rootCause:
      "The Deployment requested maxSurge: 2 with maxUnavailable: 0 on a cluster that had exactly enough CPU for the desired two replicas and nothing more.",
    whyItFailed:
      "Surge pods are created in addition to the desired replica count. With no spare capacity the scheduler left them Pending (Insufficient cpu), and because maxUnavailable was 0 the controller would not terminate an old pod to make room. The rollout could neither surge forward nor trade an old pod for a new one, so v1 kept serving.",
    whatFixedIt:
      "Setting maxSurge: 0 and maxUnavailable: 1 made the controller roll within existing capacity: terminate one old pod, schedule one new pod in the freed CPU, wait for Ready, then repeat until v2 was fully rolled out.",
    prevention:
      "Match rollout parameters to real capacity. On full or near-full clusters prefer maxSurge: 0 with a small maxUnavailable, size clusters for surge, or add nodes before rolling large or resource-heavy workloads.",
    relatedConcepts: ["deployments", "rollouts", "scheduling", "resources"],
    docsHref: "/docs/workloads/deployments",
    recommendedNextSlugs: ["graceful-shutdown-502s"],
  },
} satisfies ProblemLevel;
