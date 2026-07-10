import type { ProblemLevel } from "@/lib/domain/types";

import { PUBLISHED_PROBLEM_V1 } from "./metadata";

/**
 * Level: Broken Service Chain.
 *
 * Three tiers: frontend → orders-svc → web-svc. The break is on the LAST hop
 * (web-svc targets port 9090, container listens on 8080), but the symptoms are
 * masked upstream: the frontend proudly returns HTTP 200 with a failing status in
 * its body, orders answers 502, and only web-svc is truly dead. Teaches tracing a
 * request chain hop by hop instead of trusting the edge. Fix: web-svc targetPort.
 *
 * (The reference design lists "Network Policy Meltdown" in this slot — the simulator
 * has no NetworkPolicy support, so the multi-hop "traffic silently dies mid-chain"
 * lesson is told through a service chain.)
 */

const WEB_SVC_YAML = `apiVersion: v1
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
      targetPort: 9090
`;

const WEB_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: default
spec:
  replicas: 2
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
`;

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
              value: http://web-svc/
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

const FRONTEND_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: frontend
          image: klab/api:1.0.0
          env:
            - name: UPSTREAM_URL
              value: http://orders-svc/
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
  name: frontend-svc
  namespace: default
spec:
  selector:
    app: frontend
  ports:
    - name: http
      port: 80
      targetPort: 8080
`;

export const brokenServiceChain = {
  id: "broken-service-chain",
  slug: "broken-service-chain",
  ...PUBLISHED_PROBLEM_V1,
  title: "Broken Service Chain",
  difficulty: "advanced",
  severity: "critical",
  xp: 200,
  estimatedMinutes: 35,
  successRate: 33,
  concepts: ["services", "networking", "dns", "endpoints", "debugging"],
  blurb: "The frontend says 200, the API says 502, the web tier says nothing at all.",
  story:
    "Checkout is down, but the synthetic monitor on the frontend is green — it returns 200, after all. Dig one layer and orders-svc is throwing 502s. Dig another and web-svc doesn't answer at all. Three tiers, three different stories. Somewhere in frontend → orders → web, one hop is lying and one is dead.",
  objective: "Trace the chain and restore it end to end: orders-svc and web-svc must return 200.",
  learningObjectives: [
    "Trace an outage through multiple Service hops instead of stopping at the edge status.",
    "Use scoped probes and tier-specific logs to identify the failing dependency.",
  ],
  prerequisites: ["port-routing-bug", "dns-resolution-failure"],
  learningPaths: ["networking", "sre-on-call"],
  capabilities: ["pods", "services", "deployments", "logs", "http-probes"],
  engine: { kind: "webernetes" },
  constraints: [
    {
      id: "edit-web-svc",
      label: "Only edit web-svc.yaml — every Deployment is correct",
      kind: "editable-files",
      paths: ["web-svc.yaml"],
    },
    {
      id: "keep-chain",
      label: "Keep the frontend to orders to web Service contract intact",
      kind: "manifest",
      file: "web-svc.yaml",
      resource: { kind: "Service", name: "web-svc" },
      exclusive: true,
      assertions: [
        { path: "spec.selector.app", operator: "equals", value: "web-app" },
        { path: "spec.ports.0.port", operator: "equals", value: 80 },
      ],
    },
  ],
  files: [
    {
      path: "web-svc.yaml",
      language: "yaml",
      initialValue: WEB_SVC_YAML,
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
      path: "orders.yaml",
      language: "yaml",
      initialValue: ORDERS_YAML,
      access: "readonly",
      applyAtBoot: true,
    },
    {
      path: "frontend.yaml",
      language: "yaml",
      initialValue: FRONTEND_YAML,
      access: "readonly",
      applyAtBoot: true,
    },
  ],
  quickCommands: [
    { id: "command-1", command: "curl http://frontend-svc/" },
    { id: "command-2", command: "curl http://orders-svc/" },
    { id: "command-3", command: "curl http://web-svc/" },
    { id: "command-4", command: "kubectl describe svc web-svc" },
    {
      id: "command-5",
      command: "kubectl logs <pod>",
      target: {
        kind: "pod",
        namespace: "default",
        selector: { app: "orders-api" },
        prefer: "first",
      },
    },
  ],
  probeTargets: ["http://frontend-svc/", "http://orders-svc/", "http://web-svc/"],
  validators: [
    {
      id: "web-200",
      title: "Web tier answers",
      successLabel: "GET / through web-svc returns 200",
      failureLabel: "web-svc does not answer",
      kind: "http-get-through-service",
      namespace: "default",
      service: "web-svc",
      port: 80,
      path: "/",
      expectStatus: 200,
    },
    {
      id: "orders-200",
      title: "Orders tier reaches the web tier",
      successLabel: "GET / through orders-svc returns 200",
      failureLabel: "orders-svc still reports an upstream failure",
      kind: "http-get-through-service",
      namespace: "default",
      service: "orders-svc",
      port: 80,
      path: "/",
      expectStatus: 200,
    },
    {
      id: "web-endpoints",
      title: "Web tier has ready endpoints",
      successLabel: "web-svc has ready endpoints",
      failureLabel: "web-svc has no ready endpoints",
      kind: "service-has-ready-endpoints",
      namespace: "default",
      name: "web-svc",
      minReadyEndpoints: 2,
    },
  ],
  hints: [
    {
      id: "hint-1",
      title: "200 is not health — read the body",
      body: "The frontend returns 200 because it successfully reports its upstream's FAILURE. Don't trust the edge: curl each tier in order — frontend-svc, orders-svc, web-svc — and note where the story changes.",
      xpPenalty: 40,
    },
    {
      id: "hint-2",
      title: "The last hop is the dead one",
      body: "orders-svc's 502 is just it relaying that web-svc never answers. Everything about the web DEPLOYMENT is healthy (pods Ready, endpoints published) — so inspect the web SERVICE: `kubectl describe svc web-svc`. Follow the ports.",
      xpPenalty: 60,
      unlockAfter: ["r-web-dead"],
    },
    {
      id: "hint-3",
      title: "9090 vs 8080",
      body: "web-svc forwards to targetPort 9090, but the web-app container listens on 8080 (its logs say so). Fix targetPort in web-svc.yaml and Apply — the whole chain heals from the bottom.",
      xpPenalty: 80,
      unlockAfter: ["r-targetport"],
    },
  ],
  evidenceRules: [
    {
      id: "r-orders-502",
      evidenceId: "orders-502",
      label: "orders-svc answers 502 — its upstream call fails",
      hiddenLabel: "Middle tier tested",
      source: "network",
      trigger: { type: "probe", hostMatches: "^orders-svc$", pathMatches: "^/$", status: 502 },
    },
    {
      id: "r-web-dead",
      evidenceId: "web-dead",
      label: "web-svc doesn't answer at all",
      hiddenLabel: "Web tier tested",
      source: "network",
      trigger: { type: "probe", hostMatches: "^web-svc$", pathMatches: "^/$", status: 0 },
    },
    {
      id: "r-web-dead-503",
      evidenceId: "web-dead",
      label: "web-svc doesn't answer at all",
      hiddenLabel: "Web tier tested",
      source: "network",
      trigger: { type: "probe", hostMatches: "^web-svc$", pathMatches: "^/$", status: 503 },
    },
    {
      id: "r-upstream-logs",
      evidenceId: "upstream-logs",
      label: "orders-api logs: calls to web-svc fail",
      hiddenLabel: "Orders logs read",
      source: "logs",
      trigger: { type: "log", podMatches: "^orders-api-", messageMatches: "upstream call failed" },
    },
    {
      id: "r-targetport",
      evidenceId: "targetport-9090",
      label: "web-svc forwards to targetPort 9090",
      hiddenLabel: "Web service ports inspected",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "describe (svc|service) web-svc",
        outputMatches: "TargetPort:\\s+9090",
      },
    },
    {
      id: "r-listen-8080",
      evidenceId: "listen-8080",
      label: "web-app logs: listening on :8080",
      hiddenLabel: "Web tier logs read",
      source: "logs",
      trigger: { type: "log", podMatches: "^web-app-", messageMatches: "listening on :8080" },
    },
  ],
  postSolveExplanation: {
    rootCause:
      "web-svc's targetPort (9090) didn't match the web container's port (8080), killing the chain at its final hop.",
    whyItFailed:
      "Each tier reported only its own hop: the frontend returned 200 (it successfully relayed a failure), orders returned 502 (its upstream call failed), and web-svc silently refused connections. Edge monitoring saw 'healthy'; only walking the chain hop by hop exposed where traffic actually died.",
    whatFixedIt:
      "Correcting web-svc's targetPort to 8080 reconnected the last hop. orders-svc immediately started getting 200s from web-svc, and the frontend's body flipped from status: 502 to status: 200 — the whole chain healed from the bottom.",
    prevention:
      "Monitor dependency-level outcomes, keep request context across hops, and continuously probe each internal Service contract as well as the public edge.",
    relatedConcepts: ["services", "networking", "endpoints"],
    recommendedNextSlugs: ["zombie-replicaset"],
  },
} satisfies ProblemLevel;
