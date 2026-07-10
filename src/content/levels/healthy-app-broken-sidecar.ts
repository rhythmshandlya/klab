import type { ProblemLevel } from "@/lib/domain/types";

import { PUBLISHED_PROBLEM_V1 } from "./metadata";

const DEPLOYMENT_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: checkout
  template:
    metadata:
      labels:
        app: checkout
    spec:
      containers:
        - name: checkout
          image: klab/web-app:1.0.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 2
        - name: queue-sidecar
          image: klab/worker:1.0.0
          env:
            - name: PORT
              value: "9090"
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

export const healthyAppBrokenSidecar = {
  id: "healthy-app-broken-sidecar",
  slug: "healthy-app-broken-sidecar",
  ...PUBLISHED_PROBLEM_V1,
  title: "Healthy App, Broken Sidecar",
  difficulty: "advanced",
  severity: "critical",
  xp: 200,
  estimatedMinutes: 25,
  successRate: 43,
  concepts: ["pods", "deployments", "sidecar-containers", "readiness-probes", "logs", "debugging"],
  blurb: "The application container is healthy, but its Pod never becomes Ready.",
  story:
    "checkout logs show a healthy listener and its readiness probe passes, yet checkout-svc has no endpoints. The Pod reports 1/2 Ready and one restart counter keeps climbing after a sidecar was added for queue draining.",
  objective: "Repair the failing sidecar without removing it or changing the healthy application.",
  learningObjectives: [
    "Diagnose readiness at both Pod and individual container scope.",
    "Select the correct container when reading logs from a multi-container Pod.",
  ],
  prerequisites: ["pod-crashloop-mystery", "probe-hits-wrong-port"],
  learningPaths: ["application-debugging", "reliability", "sre-on-call"],
  capabilities: [
    "pods",
    "services",
    "deployments",
    "events",
    "logs",
    "http-probes",
    "container-restarts",
    "container-lifecycle",
    "multi-container",
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
      id: "repair-sidecar",
      label: "Keep both containers and images; configure the queue sidecar",
      kind: "manifest",
      file: "deployment.yaml",
      resource: { kind: "Deployment", name: "checkout" },
      exclusive: true,
      assertions: [
        {
          path: "spec.template.spec.containers.0.image",
          operator: "equals",
          value: "klab/web-app:1.0.0",
        },
        {
          path: "spec.template.spec.containers.1.image",
          operator: "equals",
          value: "klab/worker:1.0.0",
        },
        {
          path: "spec.template.spec.containers.1.env.0.name",
          operator: "equals",
          value: "PORT",
        },
        {
          path: "spec.template.spec.containers.1.env.0.value",
          operator: "equals",
          value: "9090",
        },
        {
          path: "spec.template.spec.containers.1.env.1.name",
          operator: "equals",
          value: "DATABASE_URL",
        },
        {
          path: "spec.template.spec.containers.1.env.1.value",
          operator: "equals",
          value: "postgres://queue.internal:5432/jobs",
        },
        { path: "spec.template.spec.containers.0.readinessProbe", operator: "present" },
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
        selector: { app: "checkout" },
        prefer: "highest-restarts",
      },
    },
    {
      id: "app-logs",
      command: "kubectl logs <pod> -c checkout",
      target: {
        kind: "pod",
        namespace: "default",
        selector: { app: "checkout" },
        prefer: "highest-restarts",
      },
    },
    {
      id: "sidecar-logs",
      command: "kubectl logs <pod> -c queue-sidecar",
      target: {
        kind: "pod",
        namespace: "default",
        selector: { app: "checkout" },
        prefer: "highest-restarts",
      },
    },
    { id: "endpoints", command: "kubectl get endpoints checkout-svc" },
    { id: "events", command: "kubectl get events --sort-by=.lastTimestamp" },
  ],
  probeTargets: ["http://checkout-svc/", "http://checkout-svc/healthz"],
  validators: [
    {
      id: "pod-ready",
      title: "The whole Pod is Ready",
      successLabel: "Both checkout containers are Ready",
      failureLabel: "At least one checkout container is not Ready",
      kind: "pod-ready-by-selector",
      namespace: "default",
      selector: { app: "checkout" },
      minReady: 1,
    },
    {
      id: "sidecar-stable",
      title: "Sidecar remains stable",
      successLabel: "No checkout container is restarting",
      failureLabel: "A checkout container is still restarting",
      kind: "pod-restarts-below",
      namespace: "default",
      selector: { app: "checkout" },
      maxRestarts: 0,
    },
    {
      id: "service-endpoints",
      title: "Service has an endpoint",
      successLabel: "checkout-svc has a Ready endpoint",
      failureLabel: "checkout-svc has no Ready endpoint",
      kind: "service-has-ready-endpoints",
      namespace: "default",
      name: "checkout-svc",
      minReadyEndpoints: 1,
    },
    {
      id: "http-200",
      title: "Checkout serves traffic",
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
      title: "Read the READY fraction",
      body: "1/2 means one container is Ready, not that the Pod is half healthy. Describe the Pod and compare each container's state and restart count.",
      xpPenalty: 25,
    },
    {
      id: "hint-2",
      title: "Choose a container",
      body: "The default logs show the healthy checkout process. Run kubectl logs with -c queue-sidecar to inspect the container that is restarting.",
      xpPenalty: 40,
      unlockAfter: ["r-one-of-two"],
    },
    {
      id: "hint-3",
      title: "Supply the missing contract",
      body: "queue-sidecar already has its own PORT. Add DATABASE_URL only to the second container with value postgres://queue.internal:5432/jobs.",
      xpPenalty: 55,
      unlockAfter: ["r-sidecar-fatal"],
    },
  ],
  evidenceRules: [
    {
      id: "r-one-of-two",
      evidenceId: "one-of-two-ready",
      label: "The Pod is Running but only 1/2 containers are Ready",
      hiddenLabel: "Multi-container readiness inspected",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get pods", outputMatches: "1/2" },
    },
    {
      id: "r-app-healthy",
      evidenceId: "main-container-healthy",
      label: "The checkout container listens normally on port 8080",
      hiddenLabel: "Main-container logs inspected",
      source: "logs",
      trigger: { type: "log", messageMatches: "listening on :8080", podMatches: "checkout" },
    },
    {
      id: "r-sidecar-fatal",
      evidenceId: "sidecar-missing-database",
      label: "queue-sidecar exits because DATABASE_URL is missing",
      hiddenLabel: "Sidecar logs inspected",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "logs.*-c queue-sidecar",
        outputMatches: "DATABASE_URL is not set",
      },
    },
    {
      id: "r-backoff",
      evidenceId: "sidecar-backoff",
      label: "Events show the failing container is backing off",
      hiddenLabel: "Container restart events inspected",
      source: "events",
      trigger: { type: "event-reason", reason: "BackOff" },
    },
    {
      id: "r-no-endpoints",
      evidenceId: "pod-withheld-from-service",
      label: "checkout-svc has no endpoints while one container fails",
      hiddenLabel: "Service endpoint eligibility inspected",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get endpoints", outputMatches: "<none>" },
    },
    {
      id: "r-service-down",
      evidenceId: "checkout-unavailable",
      label: "checkout-svc returns 503",
      hiddenLabel: "Checkout availability tested",
      source: "network",
      trigger: { type: "probe", hostMatches: "^checkout-svc$", pathMatches: "/", status: 503 },
    },
  ],
  postSolveExplanation: {
    rootCause:
      "queue-sidecar required DATABASE_URL but the second container had no value, so it exited and entered CrashLoopBackOff.",
    whyItFailed:
      "Pod readiness is the conjunction of its regular containers' readiness. The checkout process was healthy, but the failed sidecar kept the Pod at 1/2 Ready. EndpointSlice therefore withheld the entire Pod from checkout-svc.",
    whatFixedIt:
      "Adding DATABASE_URL to queue-sidecar let the worker remain running. Both containers became Ready, the Pod entered the EndpointSlice, and checkout traffic resumed.",
    prevention:
      "Define and validate configuration contracts per container, alert with container labels, and always include -c when collecting logs from multi-container Pods.",
    relatedConcepts: ["sidecar-containers", "logs", "readiness-probes", "pods"],
    docsHref: "/docs/workloads/init-sidecars-lifecycle",
    recommendedNextSlugs: ["broken-service-chain", "zombie-replicaset"],
  },
} satisfies ProblemLevel;
