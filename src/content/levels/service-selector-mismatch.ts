import type { ProblemLevel } from "@/lib/domain/types";

/**
 * Level: Service Selector Mismatch.
 *
 * The Service selects `app: web`, but every pod the Deployment creates is labeled
 * `app: web-app`. The pods are Running and Ready the whole time — the outage lives
 * entirely in the wiring between Service and pods. Fix: make the selector match the
 * real pod labels (service.yaml is the editable file).
 */

const SERVICE_YAML = `apiVersion: v1
kind: Service
metadata:
  name: web-svc
  namespace: default
spec:
  selector:
    app: web
  ports:
    - name: http
      port: 80
      targetPort: 8080
`;

const DEPLOYMENT_YAML = `apiVersion: apps/v1
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

export const serviceSelectorMismatch = {
  id: "service-selector-mismatch",
  slug: "service-selector-mismatch",
  title: "Service Selector Mismatch",
  difficulty: "beginner",
  severity: "high",
  xp: 100,
  estimatedMinutes: 20,
  successRate: 78,
  concepts: ["services", "labels-selectors", "endpoints", "debugging"],
  blurb: "Traffic isn't reaching your pods, even though every pod is healthy.",
  story:
    "The 09:12 deploy went green, the pods came up healthy — and then every request to web-svc started timing out. Monitoring shows the pods serving nothing at all. Something between the Service and the pods is broken.",
  objective: "Make web-svc route traffic to the running web-app pods (HTTP 200).",
  constraints: [
    { id: "edit-svc-only", label: "Only edit service.yaml — the Deployment is correct" },
    { id: "keep-pods", label: "Do not relabel or restart the pods" },
  ],
  files: [{ path: "service.yaml", language: "yaml", initialValue: SERVICE_YAML }],
  readonlyFiles: [{ path: "deployment.yaml", language: "yaml", value: DEPLOYMENT_YAML }],
  initialManifests: [DEPLOYMENT_YAML],
  registeredImages: [
    {
      ref: "klab/web-app:1.0.0",
      description: "Web server — answers /healthz with 200 and / with 200.",
    },
  ],
  allowedCommands: [
    "kubectl get pods",
    "kubectl describe pod <name>",
    "kubectl describe svc web-svc",
    "kubectl get endpoints web-svc",
    "kubectl get events",
    "curl <url>",
  ],
  quickCommands: [
    "kubectl get pods",
    "kubectl get endpoints web-svc",
    "kubectl describe svc web-svc",
    "kubectl describe pod <pod>",
  ],
  probeTargets: ["http://web-svc/", "http://web-svc/healthz"],
  validators: [
    {
      id: "pods-ready",
      title: "App pods are Ready",
      successLabel: "The web-app pods are Ready",
      failureLabel: "The web-app pods are not Ready",
      kind: "pod-ready-by-selector",
      namespace: "default",
      selector: { app: "web-app" },
      minReady: 2,
    },
    {
      id: "service-endpoints",
      title: "Service has ready endpoints",
      successLabel: "web-svc has ready endpoints",
      failureLabel: "web-svc has zero ready endpoints",
      kind: "service-has-ready-endpoints",
      namespace: "default",
      name: "web-svc",
      minReadyEndpoints: 2,
    },
    {
      id: "http-200",
      title: "Service returns 200",
      successLabel: "GET / through web-svc returns 200",
      failureLabel: "GET / through web-svc does not return 200",
      kind: "http-get-through-service",
      namespace: "default",
      service: "web-svc",
      port: 80,
      path: "/",
      expectStatus: 200,
    },
  ],
  hints: [
    {
      id: "hint-1",
      title: "Trust the pods, check the wiring",
      body: "The pods are Running AND Ready — so the app isn't the problem. When healthy pods get no traffic, look at how the Service decides which pods to send traffic to: `kubectl describe svc web-svc`.",
      xpPenalty: 15,
    },
    {
      id: "hint-2",
      title: "Selectors are exact-match",
      body: "A Service only routes to pods whose labels match its selector exactly. Compare the `Selector:` line from `describe svc` with the `Labels:` line from `describe pod`. Do they agree?",
      xpPenalty: 25,
      unlockAfter: ["r-selector"],
    },
    {
      id: "hint-3",
      title: "One of them is lying",
      body: "The Service wants app=web, but the pods carry app=web-app. The constraint says the Deployment is correct — so fix the selector in service.yaml to match the real pod labels, then Apply.",
      xpPenalty: 35,
      unlockAfter: ["r-pod-labels"],
    },
  ],
  evidenceRules: [
    {
      id: "r-pods-ready",
      evidenceId: "pods-ready",
      label: "Pods are Running and Ready (1/1)",
      hiddenLabel: "Pod status checked",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get pods", outputMatches: "1/1\\s+Running" },
    },
    {
      id: "r-no-endpoints",
      evidenceId: "svc-no-endpoints",
      label: "web-svc has no endpoints at all",
      hiddenLabel: "Service endpoints inspected",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "get endpoints|describe (svc|service)",
        outputMatches: "<none>",
      },
    },
    {
      id: "r-selector",
      evidenceId: "svc-selector",
      label: "web-svc selects app=web",
      hiddenLabel: "Service selector inspected",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "describe (svc|service)",
        outputMatches: "Selector:\\s+app=web\\s",
      },
    },
    {
      id: "r-pod-labels",
      evidenceId: "pod-labels",
      label: "Pods are labeled app=web-app",
      hiddenLabel: "Pod labels inspected",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "describe pod",
        outputMatches: "app=web-app",
      },
    },
    {
      id: "r-unreachable",
      evidenceId: "svc-unreachable",
      label: "Requests to web-svc never reach a pod",
      hiddenLabel: "Service reachability tested",
      source: "network",
      trigger: { type: "probe", pathMatches: "^/$", status: 0 },
    },
    {
      id: "r-unreachable-503",
      evidenceId: "svc-unreachable",
      label: "Requests to web-svc never reach a pod",
      hiddenLabel: "Service reachability tested",
      source: "network",
      trigger: { type: "probe", pathMatches: "^/$", status: 503 },
    },
  ],
  postSolveExplanation: {
    rootCause: "The Service's selector (app=web) matched no pods — they're labeled app=web-app.",
    whyItFailed:
      "Label selection is exact. The EndpointSlice controller continuously looks for Ready pods whose labels match the Service selector; with app=web it found none, so web-svc had zero endpoints and every request died at the Service.",
    whatFixedIt:
      "Changing the selector to app=web-app made it match the Deployment's pods. The EndpointSlice controller immediately published their addresses and traffic flowed.",
    relatedConcepts: ["services", "labels-selectors", "endpoints"],
  },
} satisfies ProblemLevel;
