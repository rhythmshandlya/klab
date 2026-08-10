import type { ProblemLevel } from "@/lib/domain/types";

import { PUBLISHED_PROBLEM_V1 } from "./metadata";

/**
 * Level: Recreate Strategy Outage.
 *
 * The checkout Deployment uses strategy: Recreate, so a rollout terminates every old
 * pod before any new pod is created. The new release needs a warm-up window to pass
 * readiness, and with no old pods left to serve traffic the Service drops to zero
 * ready endpoints for the whole window. Switch to RollingUpdate (maxUnavailable: 0)
 * so the controller keeps old pods serving until the new ones are Ready.
 */

const DEPLOYMENT_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout
  namespace: default
spec:
  replicas: 2
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: checkout
  template:
    metadata:
      labels:
        app: checkout
    spec:
      containers:
        - name: api
          image: klab/checkout:2.1.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 2
`;

const SERVICE_YAML = `apiVersion: v1
kind: Service
metadata:
  name: checkout-svc
  namespace: default
spec:
  selector:
    app: checkout
  ports:
    - name: http
      port: 80
      targetPort: 8080
`;

export const recreateStrategyOutage = {
  id: "recreate-strategy-outage",
  slug: "recreate-strategy-outage",
  ...PUBLISHED_PROBLEM_V1,
  title: "Recreate Strategy Outage",
  difficulty: "intermediate",
  severity: "critical",
  xp: 150,
  estimatedMinutes: 25,
  successRate: 52,
  concepts: ["deployments", "rollouts", "disruptions", "debugging"],
  blurb:
    "Every release takes checkout offline for half a minute. The release is fine; the strategy is not.",
  story:
    "Checkout shipped v2.1.0 an hour ago. The release itself is healthy, but for ~40 seconds during the rollout the Service returned 503 to every customer. On-call traced it to the Deployment: the old ReplicaSet was scaled to zero before a single new pod was Ready. The Deployment is still on the Recreate strategy left over from early prototyping.",
  objective: "Make checkout-svc stay available during a rollout by using a zero-downtime strategy.",
  learningObjectives: [
    "Distinguish Recreate (kill-all-then-start) from RollingUpdate (overlap old and new).",
    "Tune maxUnavailable so availability is never sacrificed during a rollout.",
  ],
  prerequisites: ["rolling-update-gone-wrong"],
  learningPaths: ["reliability", "sre-on-call"],
  capabilities: [
    "pods",
    "services",
    "deployments",
    "replicasets",
    "events",
    "logs",
    "http-probes",
    "rollouts",
    "container-lifecycle",
  ],
  engine: { kind: "scripted", scenarioId: "recreate-strategy-outage" },
  constraints: [
    {
      id: "edit-deploy-only",
      label: "Only edit deployment.yaml; the Service and the v2.1.0 release are correct",
      kind: "editable-files",
      paths: ["deployment.yaml"],
    },
    {
      id: "keep-zero-downtime",
      label: "Use a zero-downtime RollingUpdate strategy and keep the v2.1.0 release",
      kind: "manifest",
      file: "deployment.yaml",
      resource: { kind: "Deployment", name: "checkout" },
      exclusive: true,
      assertions: [
        {
          path: "spec.strategy.type",
          operator: "equals",
          value: "RollingUpdate",
        },
        {
          path: "spec.strategy.rollingUpdate.maxUnavailable",
          operator: "equals",
          value: 0,
        },
        {
          path: "spec.template.spec.containers.0.image",
          operator: "equals",
          value: "klab/checkout:2.1.0",
        },
        { path: "spec.replicas", operator: "gte", value: 2 },
      ],
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
  ],
  quickCommands: [
    { id: "command-1", command: "kubectl get pods" },
    { id: "command-2", command: "kubectl get rs" },
    { id: "command-3", command: "kubectl get deployment checkout -o yaml" },
    {
      id: "command-4",
      command: "kubectl describe pod <pod>",
      target: {
        kind: "pod",
        namespace: "default",
        selector: { app: "checkout" },
        prefer: "not-ready",
      },
    },
    { id: "command-5", command: "kubectl get events" },
  ],
  probeTargets: ["http://checkout-svc/", "http://checkout-svc/healthz"],
  validators: [
    {
      id: "checkout-deployment-ready",
      title: "Deployment has ready replicas",
      successLabel: "checkout has 2 ready replicas",
      failureLabel: "checkout has no ready replicas",
      kind: "deployment-ready",
      namespace: "default",
      name: "checkout",
      minReadyReplicas: 2,
    },
    {
      id: "checkout-service-endpoints",
      title: "Service has ready endpoints",
      successLabel: "checkout-svc has ready endpoints",
      failureLabel: "checkout-svc has zero ready endpoints",
      kind: "service-has-ready-endpoints",
      namespace: "default",
      name: "checkout-svc",
      minReadyEndpoints: 2,
    },
    {
      id: "checkout-http-200",
      title: "Service returns 200",
      successLabel: "GET / through checkout-svc returns 200",
      failureLabel: "GET / through checkout-svc does not return 200",
      kind: "http-get-through-service",
      namespace: "default",
      service: "checkout-svc",
      port: 80,
      path: "/",
      expectStatus: 200,
    },
  ],
  hints: [
    {
      id: "hint-1",
      title: "Read the strategy, not the pods",
      body: "The new pods eventually pass readiness — the outage is the gap while the old ones are already gone. What Deployment strategy kills old pods before creating new ones?",
      xpPenalty: 25,
    },
    {
      id: "hint-2",
      title: "Recreate vs RollingUpdate",
      body: "strategy: type: Recreate scales the old ReplicaSet to zero first, then creates new pods. RollingUpdate overlaps them so traffic never has zero healthy backends.",
      xpPenalty: 40,
      unlockAfter: ["r-recreate-strategy"],
    },
    {
      id: "hint-3",
      title: "Keep availability during the rollout",
      body: "Set strategy.type to RollingUpdate and rollingUpdate.maxUnavailable to 0 so the controller never removes an old pod until a new one is Ready.",
      xpPenalty: 60,
      unlockAfter: ["r-scaling-event"],
    },
  ],
  evidenceRules: [
    {
      id: "r-no-ready-pods",
      evidenceId: "no-ready-pods",
      label: "checkout pods are Running but never Ready during the rollout",
      hiddenLabel: "Pod readiness inspected",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get pods", outputMatches: "0/1\\s+Running" },
    },
    {
      id: "r-recreate-strategy",
      evidenceId: "recreate-strategy",
      label: "The Deployment uses strategy: type: Recreate",
      hiddenLabel: "Deployment strategy inspected",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "get deployment|describe deployment",
        outputMatches: "Recreate",
      },
    },
    {
      id: "r-scaling-event",
      evidenceId: "scaling-event",
      label: "An event shows the old ReplicaSet scaled to 0 before new pods were Ready",
      hiddenLabel: "Recent events reviewed",
      source: "events",
      trigger: { type: "event-reason", reason: "ScalingReplicaSet", messageMatches: "Recreate" },
    },
    {
      id: "r-service-503",
      evidenceId: "service-503",
      label: "checkout-svc returns 503 — no ready backends during the recreate window",
      hiddenLabel: "Service reachability tested",
      source: "network",
      trigger: {
        type: "probe",
        hostMatches: "^checkout-svc$",
        pathMatches: "^/$",
        status: 503,
      },
    },
  ],
  postSolveExplanation: {
    rootCause:
      "The Deployment used strategy: type: Recreate, so the controller terminated every old pod before it created any replacement.",
    whyItFailed:
      "Recreate has no overlap: the old ReplicaSet reaches zero replicas while the new ReplicaSet's pods are still starting. Because the new release needs a warm-up window to pass readiness, the Service spent that entire window with zero ready endpoints and returned 503.",
    whatFixedIt:
      "Switching to RollingUpdate with maxUnavailable: 0 makes the controller keep old pods serving until new ones are Ready, so traffic always has healthy backends during the rollout.",
    prevention:
      "Default to RollingUpdate for any user-facing Deployment, set maxUnavailable: 0 for zero-downtime SLOs, and alert on any rollout that drops ready endpoints to zero.",
    relatedConcepts: ["deployments", "rollouts", "disruptions"],
    recommendedNextSlugs: ["rollout-cannot-fit-maxsurge"],
  },
} satisfies ProblemLevel;
