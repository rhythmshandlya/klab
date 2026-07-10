import type { ProblemLevel } from "@/lib/domain/types";

/**
 * Level: Port Routing Bug.
 *
 * The Service's targetPort is 3000 but the container listens on 8080. Selection works
 * (endpoints exist, pods Ready) — the request dies on the last hop, connecting to a
 * port nothing listens on. Teaches the port chain: Service port → targetPort →
 * containerPort. Fix: targetPort 8080 in service.yaml.
 */

const SERVICE_YAML = `apiVersion: v1
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
      targetPort: 3000
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

export const portRoutingBug = {
  id: "port-routing-bug",
  slug: "port-routing-bug",
  title: "Port Routing Bug",
  difficulty: "beginner",
  severity: "medium",
  xp: 100,
  estimatedMinutes: 18,
  successRate: 81,
  concepts: ["services", "networking", "endpoints", "debugging"],
  blurb: "Requests hit the Service, the Service has endpoints — and then nothing.",
  story:
    "After a config cleanup PR, web-svc went dark. The strange part: the pods are Ready, and the Service even lists endpoints. Requests just… never come back. The wiring looks fine until the very last hop.",
  objective: "Make requests through web-svc reach the app again (HTTP 200).",
  engine: { kind: "webernetes" },
  constraints: [
    {
      id: "edit-svc-only",
      label: "Only edit service.yaml — the Deployment is correct",
      kind: "editable-files",
      paths: ["service.yaml"],
    },
    {
      id: "keep-port-80",
      label: "Keep web-svc on port 80 and selecting the existing web-app pods",
      kind: "manifest",
      file: "service.yaml",
      resource: { kind: "Service", name: "web-svc" },
      exclusive: true,
      assertions: [
        { path: "spec.ports.0.port", operator: "equals", value: 80 },
        { path: "spec.selector.app", operator: "equals", value: "web-app" },
      ],
    },
  ],
  files: [
    {
      path: "service.yaml",
      language: "yaml",
      initialValue: SERVICE_YAML,
      access: "editable",
      applyAtBoot: true,
    },
    {
      path: "deployment.yaml",
      language: "yaml",
      initialValue: DEPLOYMENT_YAML,
      access: "readonly",
      applyAtBoot: true,
    },
  ],
  quickCommands: [
    { id: "command-1", command: "kubectl get pods" },
    { id: "command-2", command: "kubectl get endpoints web-svc" },
    { id: "command-3", command: "kubectl describe svc web-svc" },
    {
      id: "command-4",
      command: "kubectl logs <pod>",
      target: { kind: "pod", namespace: "default", selector: { app: "web-app" }, prefer: "first" },
    },
  ],
  probeTargets: ["http://web-svc/", "http://web-svc/healthz"],
  validators: [
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
      id: "pods-ready",
      title: "App pods are Ready",
      successLabel: "The web-app pods are Ready",
      failureLabel: "The web-app pods are not Ready",
      kind: "pod-ready-by-selector",
      namespace: "default",
      selector: { app: "web-app" },
      minReady: 2,
    },
  ],
  hints: [
    {
      id: "hint-1",
      title: "Ready, selected… and still dead",
      body: "Endpoints exist and pods are Ready, so label selection works. What's left between a Service and a container? Ports. Trace the whole chain: Service port → targetPort → the port the app actually listens on.",
      xpPenalty: 15,
    },
    {
      id: "hint-2",
      title: "Ask both sides",
      body: "`kubectl describe svc web-svc` shows which TargetPort the Service forwards to. `kubectl logs <pod>` shows which port the app says it's listening on. Compare them.",
      xpPenalty: 25,
      unlockAfter: ["r-targetport"],
    },
    {
      id: "hint-3",
      title: "3000 goes nowhere",
      body: "The Service forwards to port 3000, but the container listens on 8080. Fix targetPort in service.yaml and Apply.",
      xpPenalty: 35,
      unlockAfter: ["r-listen-8080"],
    },
  ],
  evidenceRules: [
    {
      id: "r-pods-ready",
      evidenceId: "pods-ready",
      label: "Pods are Running and Ready",
      hiddenLabel: "Pod status checked",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get pods", outputMatches: "1/1\\s+Running" },
    },
    {
      id: "r-endpoints-exist",
      evidenceId: "endpoints-exist",
      label: "web-svc HAS endpoints — selection is fine",
      hiddenLabel: "Service endpoints inspected",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "get endpoints",
        outputMatches: "\\d+\\.\\d+\\.\\d+\\.\\d+",
      },
    },
    {
      id: "r-targetport",
      evidenceId: "targetport-3000",
      label: "web-svc forwards to targetPort 3000",
      hiddenLabel: "Service port chain inspected",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "describe (svc|service)",
        outputMatches: "TargetPort:\\s+3000",
      },
    },
    {
      id: "r-listen-8080",
      evidenceId: "listen-8080",
      label: "The app logs say it listens on :8080",
      hiddenLabel: "App logs read",
      source: "logs",
      trigger: { type: "log", podMatches: "^web-app-", messageMatches: "listening on :8080" },
    },
    {
      id: "r-refused",
      evidenceId: "svc-refused",
      label: "Requests through web-svc are refused",
      hiddenLabel: "Service reachability tested",
      source: "network",
      trigger: { type: "probe", hostMatches: "^web-svc$", pathMatches: "^/$", status: 0 },
    },
    {
      id: "r-refused-503",
      evidenceId: "svc-refused",
      label: "Requests through web-svc are refused",
      hiddenLabel: "Service reachability tested",
      source: "network",
      trigger: { type: "probe", hostMatches: "^web-svc$", pathMatches: "^/$", status: 503 },
    },
  ],
  postSolveExplanation: {
    rootCause: "The Service's targetPort (3000) didn't match the container's port (8080).",
    whyItFailed:
      "Readiness and endpoint selection don't validate ports — the pods probed healthy on 8080 and were published as endpoints. But every request forwarded by the Service went to port 3000, where nothing was listening, so connections were refused.",
    whatFixedIt:
      "Setting targetPort to 8080 pointed the Service at the port the container actually binds. The port chain (80 → 8080 → 8080) lined up and requests completed.",
    relatedConcepts: ["services", "networking", "endpoints"],
  },
} satisfies ProblemLevel;
