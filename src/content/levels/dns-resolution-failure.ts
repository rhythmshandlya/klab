import type { ProblemLevel } from "@/lib/domain/types";

import { PUBLISHED_PROBLEM_V1 } from "./metadata";

/**
 * Level: DNS Resolution Failure.
 *
 * orders-api calls its upstream at `http://web-scv/`: a one-letter typo of `web-svc`.
 * The name simply doesn't exist in DNS, so every upstream call fails and orders-svc
 * answers 502. Teaches dig/NXDOMAIN debugging. Fix: correct the URL in the env var.
 */

const ORDERS_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: orders-api
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: orders-api
  template:
    metadata:
      labels:
        app: orders-api
    spec:
      containers:
        - name: orders-api
          image: klab/api:1.0.0
          env:
            - name: UPSTREAM_URL
              value: http://web-scv/
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 1
            periodSeconds: 2
            timeoutSeconds: 2
`;

const WEB_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
        - name: web-app
          image: klab/web-app:1.0.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 1
            periodSeconds: 2
            timeoutSeconds: 2
---
apiVersion: v1
kind: Service
metadata:
  name: web-svc
  namespace: default
spec:
  selector:
    app: web-app
  ports:
    - name: http
      port: 80
      targetPort: 8080
`;

const ORDERS_SVC_YAML = `apiVersion: v1
kind: Service
metadata:
  name: orders-svc
  namespace: default
spec:
  selector:
    app: orders-api
  ports:
    - name: http
      port: 80
      targetPort: 8080
`;

export const dnsResolutionFailure = {
  id: "dns-resolution-failure",
  slug: "dns-resolution-failure",
  ...PUBLISHED_PROBLEM_V1,
  title: "DNS Resolution Failure",
  difficulty: "intermediate",
  severity: "high",
  xp: 150,
  estimatedMinutes: 25,
  successRate: 51,
  concepts: ["dns", "networking", "services", "debugging"],
  blurb: "The orders API can't resolve an internal service that clearly exists.",
  story:
    "Orders stopped processing after this morning's 'no-op' config refactor. The orders-api pods are healthy, web-svc is healthy, and yet orders-svc answers nothing but 502s. The API swears it can't find its upstream: a service you can see right there in the cluster.",
  objective: "Make orders-svc return HTTP 200 by restoring its upstream connection.",
  learningObjectives: [
    "Distinguish NXDOMAIN from connection and application failures.",
    "Trace a misspelled Service dependency from logs to workload configuration.",
  ],
  prerequisites: ["namespace-confusion"],
  learningPaths: ["networking", "application-debugging"],
  capabilities: ["pods", "services", "deployments", "dns", "logs", "http-probes"],
  engine: { kind: "webernetes" },
  constraints: [
    {
      id: "edit-orders",
      label: "Only edit orders-api.yaml",
      kind: "editable-files",
      paths: ["orders-api.yaml"],
    },
    {
      id: "no-renames",
      label: "Keep the orders workload and Service identities; repair only its upstream config",
      kind: "manifest",
      file: "orders-api.yaml",
      resource: { kind: "Deployment", name: "orders-api" },
      exclusive: true,
      assertions: [
        {
          path: "spec.template.spec.containers[name=orders-api].image",
          operator: "equals",
          value: "klab/api:1.0.0",
        },
        { path: "spec.template.metadata.labels.app", operator: "equals", value: "orders-api" },
        {
          path: "spec.template.spec.containers[name=orders-api].readinessProbe",
          operator: "present",
        },
      ],
      goals: [
        {
          goal: "connects-to-service",
          container: "orders-api",
          env: "UPSTREAM_URL",
          service: "web-svc",
          namespace: "default",
          port: 80,
          path: "/",
        },
      ],
    },
  ],
  files: [
    {
      path: "orders-api.yaml",
      language: "yaml",
      initialValue: ORDERS_YAML,
      access: "editable",
      applyAtBoot: true,
    },
    {
      path: "web.yaml",
      language: "yaml",
      initialValue: WEB_YAML,
      access: "readonly",
      applyAtBoot: true,
    },
    {
      path: "orders-svc.yaml",
      language: "yaml",
      initialValue: ORDERS_SVC_YAML,
      access: "readonly",
      applyAtBoot: true,
    },
  ],
  quickCommands: [
    { id: "command-1", command: "kubectl get pods" },
    {
      id: "command-2",
      command: "kubectl logs <pod>",
      target: {
        kind: "pod",
        namespace: "default",
        selector: { app: "orders-api" },
        prefer: "first",
      },
    },
    { id: "command-3", command: "kubectl get svc" },
    { id: "command-4", command: "dig web-scv" },
    { id: "command-5", command: "dig web-svc" },
  ],
  probeTargets: ["http://orders-svc/", "http://web-svc/"],
  validators: [
    {
      id: "orders-200",
      title: "Orders API reaches its upstream",
      successLabel: "GET / through orders-svc returns 200",
      failureLabel: "orders-svc cannot reach its upstream",
      kind: "http-get-through-service",
      namespace: "default",
      service: "orders-svc",
      port: 80,
      path: "/",
      expectStatus: 200,
    },
    {
      id: "web-endpoints",
      title: "Upstream is serving",
      successLabel: "web-svc has ready endpoints",
      failureLabel: "web-svc has no ready endpoints",
      kind: "service-has-ready-endpoints",
      namespace: "default",
      name: "web-svc",
      minReadyEndpoints: 1,
    },
    {
      id: "orders-ready",
      title: "Orders pods are Ready",
      successLabel: "The orders-api pods are Ready",
      failureLabel: "The orders-api pods are not Ready",
      kind: "pod-ready-by-selector",
      namespace: "default",
      selector: { app: "orders-api" },
      minReady: 1,
    },
  ],
  hints: [
    {
      id: "hint-1",
      title: "Believe the logs",
      body: "The orders pods are healthy; their OUTBOUND calls are not. `kubectl logs <orders-pod>`: what exactly does it say it's calling?",
      xpPenalty: 25,
    },
    {
      id: "hint-2",
      title: "Test the name, not the service",
      body: "Take the hostname from the logs and resolve it yourself: `dig <name>`. NXDOMAIN means DNS has never heard of it. Then compare with the services that actually exist (`kubectl get svc`).",
      xpPenalty: 40,
      unlockAfter: ["r-upstream-fail"],
    },
    {
      id: "hint-3",
      title: "svc, not scv",
      body: "The UPSTREAM_URL says web-scv: a typo of web-svc. Fix the env var in orders-api.yaml and Apply.",
      xpPenalty: 60,
      unlockAfter: ["r-nxdomain"],
    },
  ],
  evidenceRules: [
    {
      id: "r-502",
      evidenceId: "orders-502",
      label: "orders-svc answers 502 Bad Gateway",
      hiddenLabel: "Orders reachability tested",
      source: "network",
      trigger: { type: "probe", hostMatches: "^orders-svc$", pathMatches: "^/$", status: 502 },
    },
    {
      id: "r-upstream-fail",
      evidenceId: "upstream-fail",
      label: "orders-api logs: upstream call failed",
      hiddenLabel: "Orders logs read",
      source: "logs",
      trigger: { type: "log", podMatches: "^orders-api-", messageMatches: "upstream call failed" },
    },
    {
      id: "r-nxdomain",
      evidenceId: "nxdomain",
      label: "web-scv does not resolve (NXDOMAIN)",
      hiddenLabel: "Upstream hostname resolved",
      source: "terminal",
      trigger: { type: "command", commandMatches: "dig web-scv", outputMatches: "NXDOMAIN" },
    },
    {
      id: "r-web-svc-exists",
      evidenceId: "web-svc-exists",
      label: "The real service is named web-svc",
      hiddenLabel: "Cluster services listed",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "get (svc|services)|dig web-svc",
        outputMatches: "web-svc",
      },
    },
  ],
  postSolveExplanation: {
    rootCause: "UPSTREAM_URL pointed at web-scv: a typo. That name doesn't exist in DNS.",
    whyItFailed:
      "Service discovery in Kubernetes is DNS. A typo'd name isn't 'slow' or 'flaky': it's NXDOMAIN, every single time. The orders-api's fetch failed resolution before a connection was ever attempted, and the API surfaced that as 502.",
    whatFixedIt:
      "Correcting the env var to http://web-svc/ let DNS resolve to the Service's cluster IP, and the proxied requests immediately succeeded.",
    prevention:
      "Generate internal Service URLs from deployment metadata, validate them with DNS smoke tests, and preserve NXDOMAIN detail in application telemetry.",
    relatedConcepts: ["dns", "services", "networking"],
    recommendedNextSlugs: ["broken-service-chain"],
  },
} satisfies ProblemLevel;
