import type { ProblemLevel } from "@/lib/domain/types";

import { PUBLISHED_PROBLEM_V1 } from "./metadata";

const DEPLOYMENT_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: storefront
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: storefront
  template:
    metadata:
      labels:
        app: storefront
    spec:
      containers:
        - name: storefront
          image: klab/web-app:1.0.0
          command: ["sleep"]
          args: ["3600"]
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 2
            failureThreshold: 2
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 2
            periodSeconds: 2
            failureThreshold: 2
`;

const SERVICE_YAML = `apiVersion: v1
kind: Service
metadata:
  name: storefront-svc
  namespace: default
spec:
  selector:
    app: storefront
  ports:
    - name: http
      port: 80
      targetPort: 8080
`;

export const commandOverrideCrash = {
  id: "command-override-crash",
  slug: "command-override-crash",
  ...PUBLISHED_PROBLEM_V1,
  title: "Command Override Crash",
  difficulty: "beginner",
  severity: "high",
  xp: 100,
  estimatedMinutes: 15,
  successRate: 68,
  concepts: ["pods", "deployments", "lifecycle-hooks", "liveness-probes", "debugging"],
  blurb: "The expected image is deployed, but its web process never starts.",
  story:
    "A maintenance change reached storefront just before traffic dropped to zero. The image is still the approved release, yet every health check fails and the container keeps restarting. Find what Kubernetes is actually launching.",
  objective: "Restore the image's normal entrypoint and return HTTP 200 through storefront-svc.",
  learningObjectives: [
    "Explain how Pod command and args replace an image's ENTRYPOINT and CMD.",
    "Separate a correct image reference from the process Kubernetes launches inside it.",
  ],
  prerequisites: ["broken-readiness-probe"],
  learningPaths: ["kubernetes-foundations", "application-debugging"],
  capabilities: [
    "pods",
    "services",
    "deployments",
    "events",
    "logs",
    "http-probes",
    "container-restarts",
    "container-lifecycle",
  ],
  engine: { kind: "webernetes" },
  constraints: [
    {
      id: "edit-deployment-only",
      label: "Only edit deployment.yaml",
      kind: "editable-files",
      paths: ["deployment.yaml"],
    },
    {
      id: "restore-entrypoint",
      label: "Keep the workload and image; restore the image-defined command",
      kind: "manifest",
      file: "deployment.yaml",
      resource: { kind: "Deployment", name: "storefront" },
      exclusive: true,
      assertions: [
        {
          path: "spec.template.spec.containers.0.image",
          operator: "equals",
          value: "klab/web-app:1.0.0",
        },
        { path: "spec.template.spec.containers.0.command", operator: "absent" },
        { path: "spec.template.spec.containers.0.args", operator: "absent" },
        { path: "spec.template.spec.containers.0.readinessProbe", operator: "present" },
        { path: "spec.template.spec.containers.0.livenessProbe", operator: "present" },
      ],
    },
  ],
  files: [
    {
      path: "deployment.yaml",
      language: "yaml",
      initialValue: DEPLOYMENT_YAML,
      access: "editable",
      applyAtBoot: true,
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
    { id: "pods", command: "kubectl get pods" },
    {
      id: "describe",
      command: "kubectl describe pod <pod>",
      target: {
        kind: "pod",
        namespace: "default",
        selector: { app: "storefront" },
        prefer: "highest-restarts",
      },
    },
    {
      id: "logs",
      command: "kubectl logs <pod>",
      target: {
        kind: "pod",
        namespace: "default",
        selector: { app: "storefront" },
        prefer: "highest-restarts",
      },
    },
    { id: "endpoints", command: "kubectl get endpoints storefront-svc" },
    { id: "events", command: "kubectl get events --sort-by=.lastTimestamp" },
  ],
  probeTargets: ["http://storefront-svc/", "http://storefront-svc/healthz"],
  validators: [
    {
      id: "deployment-ready",
      title: "Storefront is Ready",
      successLabel: "The storefront Deployment has one Ready replica",
      failureLabel: "The storefront Deployment has no Ready replicas",
      kind: "deployment-ready",
      namespace: "default",
      name: "storefront",
      minReadyReplicas: 1,
    },
    {
      id: "stable-process",
      title: "Process remains stable",
      successLabel: "The storefront container is not restarting",
      failureLabel: "The storefront container is still restarting",
      kind: "pod-restarts-below",
      namespace: "default",
      selector: { app: "storefront" },
      maxRestarts: 0,
    },
    {
      id: "service-endpoints",
      title: "Service has endpoints",
      successLabel: "storefront-svc has a Ready endpoint",
      failureLabel: "storefront-svc has no Ready endpoints",
      kind: "service-has-ready-endpoints",
      namespace: "default",
      name: "storefront-svc",
      minReadyEndpoints: 1,
    },
    {
      id: "http-200",
      title: "Storefront serves traffic",
      successLabel: "GET / through storefront-svc returns 200",
      failureLabel: "GET / through storefront-svc does not return 200",
      kind: "http-get-through-service",
      namespace: "default",
      service: "storefront-svc",
      port: 80,
      path: "/",
      expectStatus: 200,
    },
  ],
  hints: [
    {
      id: "hint-1",
      title: "Inspect the launched process",
      body: "The image tag alone does not tell you which process is running. Describe the Pod and compare Command and Args with the manifest.",
      xpPenalty: 15,
    },
    {
      id: "hint-2",
      title: "Interpret the empty logs",
      body: "The web-app normally logs its version and listening port immediately. No application logs plus a sleep command means the application entrypoint never ran.",
      xpPenalty: 25,
      unlockAfter: ["r-command"],
    },
    {
      id: "hint-3",
      title: "Restore image defaults",
      body: "Remove both command and args from the container so Kubernetes uses the command built into klab/web-app:1.0.0.",
      xpPenalty: 35,
      unlockAfter: ["r-no-logs"],
    },
  ],
  evidenceRules: [
    {
      id: "r-restarts",
      evidenceId: "container-restarts",
      label: "The storefront container is restarting",
      hiddenLabel: "Pod restart state inspected",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get pods", outputMatches: "0/1" },
    },
    {
      id: "r-command",
      evidenceId: "command-overridden",
      label: "The container command is sleep 3600",
      hiddenLabel: "Container launch configuration inspected",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "describe pod",
        outputMatches: "Command:\\s+sleep[\\s\\S]*Args:\\s+3600",
      },
    },
    {
      id: "r-no-logs",
      evidenceId: "application-never-started",
      label: "The expected web-app startup logs are absent",
      hiddenLabel: "Application logs inspected",
      source: "terminal",
      trigger: { type: "command", commandMatches: "logs", outputMatches: "No logs yet" },
    },
    {
      id: "r-no-endpoints",
      evidenceId: "no-ready-endpoints",
      label: "storefront-svc has no Ready endpoints",
      hiddenLabel: "Service endpoints inspected",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get endpoints", outputMatches: "<none>" },
    },
    {
      id: "r-unhealthy",
      evidenceId: "liveness-failures",
      label: "Events show repeated liveness probe failures",
      hiddenLabel: "Kubelet events inspected",
      source: "events",
      trigger: { type: "event-reason", reason: "Unhealthy", messageMatches: "Liveness" },
    },
    {
      id: "r-service-down",
      evidenceId: "service-503",
      label: "The Service returns 503 with no endpoints",
      hiddenLabel: "Service response tested",
      source: "network",
      trigger: { type: "probe", hostMatches: "^storefront-svc$", pathMatches: "/", status: 503 },
    },
  ],
  postSolveExplanation: {
    rootCause:
      "The Pod-level command and args replaced the image entrypoint with sleep 3600, so the web server never started.",
    whyItFailed:
      "Kubernetes maps container command to the image ENTRYPOINT and args to CMD. The override launched sleep instead of web-app. Nothing listened on port 8080, health probes failed, the kubelet restarted the container, and the Service never gained a Ready endpoint.",
    whatFixedIt:
      "Removing command and args restored the image-defined web-app process. It opened port 8080, passed both probes, and became eligible for Service traffic.",
    prevention:
      "Treat command and args changes as executable-code changes: review them explicitly and test the rendered Pod spec in a rollout environment.",
    relatedConcepts: ["pods", "deployments", "lifecycle-hooks", "liveness-probes"],
    docsHref: "/docs/workloads/pods",
    recommendedNextSlugs: ["slow-start-without-startup-probe", "pod-crashloop-mystery"],
  },
} satisfies ProblemLevel;
