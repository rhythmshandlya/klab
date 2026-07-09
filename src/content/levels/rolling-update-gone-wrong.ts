import type { ProblemLevel } from "@/lib/domain/types";

/**
 * Level: Rolling Update Gone Wrong.
 *
 * v2.0.0 shipped with a broken build: the process runs but serves 500 on every path,
 * including /healthz — so with a CORRECT readiness probe the new pods never become
 * Ready. The probe isn't the bug; the release is. Fix: roll the image back to 1.0.0.
 */

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
          image: klab/web-app:2.0.0
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

export const rollingUpdateGoneWrong = {
  id: "rolling-update-gone-wrong",
  slug: "rolling-update-gone-wrong",
  title: "Rolling Update Gone Wrong",
  difficulty: "intermediate",
  severity: "critical",
  xp: 150,
  estimatedMinutes: 30,
  successRate: 49,
  concepts: ["deployments", "rollouts", "replicasets", "readiness-probes", "debugging"],
  blurb: "Last night's release never went Ready, and the rollout took the site with it.",
  story:
    "v2.0.0 went out at 23:40. The rollout replaced the old pods — and the new ones have been 'starting' for nine hours, never turning Ready. Customers get 503s, the release channel is on fire, and the author of v2.0.0 is unreachable. Stop the bleeding first; blame later.",
  objective: "Restore web-svc to serving HTTP 200 with all replicas Ready.",
  constraints: [
    { id: "edit-deploy-only", label: "Only edit deployment.yaml" },
    { id: "keep-probe", label: "The readiness probe is correct — leave it as is" },
  ],
  files: [{ path: "deployment.yaml", language: "yaml", initialValue: DEPLOYMENT_YAML }],
  readonlyFiles: [{ path: "service.yaml", language: "yaml", value: SERVICE_YAML }],
  initialManifests: [SERVICE_YAML],
  registeredImages: [
    {
      ref: "klab/web-app:2.0.0",
      description: "Last night's release. Starts, but something is off with the build.",
    },
    {
      ref: "klab/web-app:1.0.0",
      description: "The previous, known-good release.",
    },
  ],
  allowedCommands: [
    "kubectl get pods",
    "kubectl get rs",
    "kubectl describe pod <name>",
    "kubectl logs <pod>",
    "kubectl get events",
    "curl <url>",
  ],
  quickCommands: [
    "kubectl get pods",
    "kubectl get rs",
    "kubectl describe pod <pod>",
    "kubectl logs <pod>",
    "kubectl get events",
  ],
  probeTargets: ["http://web-svc/", "http://web-svc/healthz"],
  validators: [
    {
      id: "deployment-ready",
      title: "Deployment has ready replicas",
      successLabel: "web-app has 2 ready replicas",
      failureLabel: "web-app replicas are not Ready",
      kind: "deployment-ready",
      namespace: "default",
      name: "web-app",
      minReadyReplicas: 2,
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
      title: "What changed nine hours ago?",
      body: "A rollout means new pods from a new template. `kubectl describe pod <pod>` — which image are the stuck pods actually running?",
      xpPenalty: 25,
    },
    {
      id: "hint-2",
      title: "Is the app itself healthy?",
      body: "The readiness probe only reports what the app tells it. Read the app's own logs (`kubectl logs <pod>`) and probe /healthz yourself. Is the probe wrong — or is the app really failing?",
      xpPenalty: 40,
      unlockAfter: ["r-v2-image"],
    },
    {
      id: "hint-3",
      title: "Roll it back",
      body: "v2.0.0 logs a FATAL build error and serves 500 on every path — no probe setting can fix a broken release. Set the image back to klab/web-app:1.0.0 and Apply.",
      xpPenalty: 60,
      unlockAfter: ["r-fatal-log"],
    },
  ],
  evidenceRules: [
    {
      id: "r-not-ready",
      evidenceId: "not-ready",
      label: "New pods are Running but never Ready (0/1)",
      hiddenLabel: "Pod readiness inspected",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get pods", outputMatches: "0/1\\s+Running" },
    },
    {
      id: "r-v2-image",
      evidenceId: "v2-image",
      label: "The stuck pods run klab/web-app:2.0.0",
      hiddenLabel: "Pod image inspected",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "describe pod|get pods.*-o yaml",
        outputMatches: "web-app:2\\.0\\.0",
      },
    },
    {
      id: "r-fatal-log",
      evidenceId: "fatal-log",
      label: "v2.0.0 logs a FATAL build error on startup",
      hiddenLabel: "Container logs read",
      source: "terminal",
      trigger: { type: "command", commandMatches: "logs", outputMatches: "FATAL" },
    },
    {
      id: "r-unhealthy",
      evidenceId: "probe-failing",
      label: "Readiness probes are failing against the new pods",
      hiddenLabel: "Recent events reviewed",
      source: "events",
      trigger: { type: "event-reason", reason: "Unhealthy" },
    },
    {
      id: "r-healthz-500",
      evidenceId: "healthz-500",
      label: "GET /healthz returns 500 — the app really is sick",
      hiddenLabel: "Health endpoint tested",
      source: "network",
      trigger: { type: "probe", pathMatches: "/healthz", status: 500 },
    },
  ],
  postSolveExplanation: {
    rootCause:
      "v2.0.0 shipped with a broken build (missing asset manifest) that made /healthz — and everything else — return 500.",
    whyItFailed:
      "The readiness probe was configured correctly and did its job: it refused to mark broken pods Ready, so they never joined the Service. But the rollout had already replaced the old pods, leaving zero healthy endpoints. The probe wasn't the bug; the release was.",
    whatFixedIt:
      "Rolling the image back to klab/web-app:1.0.0 created pods that passed /healthz, became Ready, and restored the Service. In real life you'd follow up by fixing the v2 build — after the incident is over.",
    relatedConcepts: ["deployments", "rollouts", "readiness-probes"],
  },
} satisfies ProblemLevel;
