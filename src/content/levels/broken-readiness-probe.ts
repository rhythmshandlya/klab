import type { ProblemLevel } from "@/lib/domain/types";

/**
 * Level: Broken Readiness Probe (the fully-authored reference level).
 *
 * The bug lives in `deployment.yaml`: the readiness probe targets `/readyz`, which the
 * `klab/web-app` image answers with 404. The container is healthy (`/healthz` → 200) so
 * it keeps running, but the kubelet marks it NotReady, the EndpointSlice controller
 * drops it, and the Service ends up with zero endpoints → 503s.
 *
 * The fix (never stated outright to the learner) is to point the readiness probe at
 * `/healthz`. Evidence exposes the signals; the learner connects them.
 */

const DEPLOYMENT_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: default
  labels:
    app: web-app
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
              path: /readyz
              port: 8080
            initialDelaySeconds: 3
            periodSeconds: 5
            timeoutSeconds: 2
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 2
`;

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
      targetPort: 8080
`;

export const brokenReadinessProbe = {
  id: "broken-readiness-probe",
  slug: "broken-readiness-probe",
  title: "Broken Readiness Probe",
  difficulty: "intermediate",
  severity: "high",
  xp: 300,
  concepts: ["readiness-probes", "services", "endpointslices", "endpoints", "pods", "debugging"],
  story:
    "On-call paged you: users are getting intermittent 503s from web-svc. The pods look like they started fine, but traffic isn't flowing. Figure out why the Service isn't serving.",
  objective: "Restore stable traffic through web-svc so it returns HTTP 200 again.",
  constraints: [
    { id: "edit-deployment-only", label: "Only edit deployment.yaml" },
    { id: "keep-replicas", label: "Keep at least 2 replicas" },
  ],
  files: [{ path: "deployment.yaml", language: "yaml", initialValue: DEPLOYMENT_YAML }],
  readonlyFiles: [{ path: "service.yaml", language: "yaml", value: SERVICE_YAML }],
  initialManifests: [SERVICE_YAML],
  registeredImages: [
    {
      ref: "klab/web-app:1.0.0",
      description: "Web server — answers /healthz with 200 and /readyz with 404.",
    },
  ],
  allowedCommands: [
    "kubectl get pods",
    "kubectl describe pod <name>",
    "kubectl get endpoints web-svc",
    "kubectl get endpointslices",
    "kubectl get events",
    "kubectl logs <pod>",
    "curl <url>",
    "dig web-svc",
  ],
  validators: [
    {
      id: "deployment-ready",
      title: "Deployment has ready replicas",
      successLabel: "Deployment reports ready replicas",
      failureLabel: "Deployment has no ready replicas",
      kind: "deployment-ready",
      namespace: "default",
      name: "web-app",
      minReadyReplicas: 2,
    },
    {
      id: "service-endpoints",
      title: "Service has ready endpoints",
      successLabel: "web-svc has at least one ready endpoint",
      failureLabel: "web-svc has zero ready endpoints",
      kind: "service-has-ready-endpoints",
      namespace: "default",
      name: "web-svc",
      minReadyEndpoints: 1,
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
    {
      id: "no-readiness-failures",
      title: "No failing readiness probes",
      successLabel: "No pods are failing readiness",
      failureLabel: "A pod is Running but not Ready",
      kind: "no-recent-readiness-failures",
      namespace: "default",
      withinSeconds: 30,
    },
  ],
  hints: [
    {
      id: "hint-1",
      title: "Start with the pods",
      body: "Are the pods Running? Are they Ready? Those are different things. `kubectl get pods` shows the READY column — check what it says.",
      xpPenalty: 50,
    },
    {
      id: "hint-2",
      title: "Ask why it isn't Ready",
      body: "A pod that is Running but not Ready usually failed a readiness probe. `kubectl describe pod <name>` and `kubectl get events` will tell you which probe failed, and with what HTTP status.",
      xpPenalty: 100,
      unlockAfter: ["r-pod-not-ready"],
    },
    {
      id: "hint-3",
      title: "Compare what the app serves",
      body: "The container answers /healthz with 200 but /readyz with 404. Probe both with curl. Then look closely at which path your readiness probe is checking.",
      xpPenalty: 150,
      unlockAfter: ["r-readyz-404"],
    },
  ],
  evidenceRules: [
    {
      id: "r-pod-running",
      evidenceId: "pod-running",
      label: "Pod is Running",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get pods", outputMatches: "Running" },
    },
    {
      id: "r-pod-not-ready",
      evidenceId: "pod-not-ready",
      label: "Pod is Running but not Ready (0/1)",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get pods", outputMatches: "0/1" },
    },
    {
      id: "r-no-endpoints",
      evidenceId: "svc-no-endpoints",
      label: "Service has zero ready endpoints",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get endpoints", outputMatches: "<none>" },
    },
    {
      id: "r-probe-event",
      evidenceId: "probe-failed-event",
      label: "Events show the readiness probe failed",
      source: "events",
      trigger: { type: "event-reason", reason: "Unhealthy" },
    },
    {
      id: "r-readyz-404",
      evidenceId: "readyz-404",
      label: "GET /readyz returns 404",
      source: "network",
      trigger: { type: "probe", pathMatches: "/readyz", status: 404 },
    },
    {
      id: "r-healthz-200",
      evidenceId: "healthz-200",
      label: "GET /healthz returns 200",
      source: "network",
      trigger: { type: "probe", pathMatches: "/healthz", status: 200 },
    },
  ],
  postSolveExplanation: {
    rootCause: "The readiness probe targeted /readyz, a path the app answers with 404.",
    whyItFailed:
      "The container was healthy (/healthz → 200) so it kept running, but the kubelet's readiness probe hit /readyz and got 404. It marked the pod NotReady. The EndpointSlice controller only publishes Ready pods, so web-svc had zero endpoints and returned 503 to every request.",
    whatFixedIt:
      "Pointing the readiness probe at /healthz (which returns 200) let the pods report Ready. They were then added to the Service's EndpointSlice, and traffic flowed again.",
    relatedConcepts: ["readiness-probes", "endpointslices", "services"],
    docsHref: "/docs/debugging/readiness-probes",
  },
} satisfies ProblemLevel;
