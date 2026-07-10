import type { ProblemLevel } from "@/lib/domain/types";

import { PUBLISHED_PROBLEM_V1 } from "./metadata";

/**
 * Level: Broken Readiness Probe.
 *
 * The bug lives in `pod.yaml`: the readiness probe targets `/readyz`, which the
 * `klab/web-app` image answers with 404. The container is healthy (`/healthz` → 200) so
 * it keeps running, but the kubelet marks it NotReady, the EndpointSlice controller
 * drops it, and the Service ends up with zero endpoints → 503s.
 *
 * The fix (never stated outright to the learner) is to point the readiness probe at
 * `/healthz`. Evidence exposes the signals; the learner connects them.
 */

const POD_YAML = `apiVersion: v1
kind: Pod
metadata:
  name: web-app
  namespace: default
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
        initialDelaySeconds: 2
        periodSeconds: 3
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
  ...PUBLISHED_PROBLEM_V1,
  title: "Broken Readiness Probe",
  difficulty: "beginner",
  severity: "high",
  xp: 100,
  estimatedMinutes: 15,
  successRate: 76,
  concepts: ["readiness-probes", "pods", "services", "endpointslices", "debugging"],
  blurb: "Pods run but never go Ready, and the Service serves 503s.",
  story:
    "On-call paged you: users are getting 503s from web-svc. The pod looks like it started fine, but traffic isn't flowing. Figure out why the Service isn't serving.",
  objective: "Restore traffic through web-svc so it returns HTTP 200 again.",
  learningObjectives: [
    "Distinguish a Running container from a Ready Pod.",
    "Connect readiness failures to EndpointSlice membership and Service availability.",
  ],
  prerequisites: [],
  learningPaths: ["kubernetes-foundations", "reliability"],
  capabilities: ["pods", "services", "events", "http-probes"],
  engine: { kind: "webernetes" },
  constraints: [
    {
      id: "edit-pod-only",
      label: "Only edit pod.yaml",
      kind: "editable-files",
      paths: ["pod.yaml"],
    },
    {
      id: "keep-image",
      label: "Keep the web-app image and readiness probe; fix the probe configuration",
      kind: "manifest",
      file: "pod.yaml",
      resource: { kind: "Pod", name: "web-app" },
      exclusive: true,
      assertions: [
        { path: "spec.containers.0.image", operator: "equals", value: "klab/web-app:1.0.0" },
        { path: "spec.containers.0.readinessProbe", operator: "present" },
        { path: "spec.containers.0.livenessProbe", operator: "present" },
      ],
    },
  ],
  files: [
    {
      path: "pod.yaml",
      language: "yaml",
      initialValue: POD_YAML,
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
    { id: "command-1", command: "kubectl get pods" },
    {
      id: "command-2",
      command: "kubectl describe pod <pod>",
      target: {
        kind: "pod",
        namespace: "default",
        selector: { app: "web-app" },
        prefer: "not-ready",
      },
    },
    { id: "command-3", command: "kubectl get endpoints web-svc" },
    { id: "command-4", command: "kubectl get events" },
    {
      id: "command-5",
      command: "kubectl logs <pod>",
      target: {
        kind: "pod",
        namespace: "default",
        selector: { app: "web-app" },
        prefer: "not-ready",
      },
    },
  ],
  probeTargets: ["http://web-svc/", "http://web-svc/healthz"],
  validators: [
    {
      id: "pod-ready",
      title: "App pod is Ready",
      successLabel: "At least one web-app pod is Ready",
      failureLabel: "No web-app pod is Ready",
      // Validate by actual ready pods rather than Deployment.status.readyReplicas:
      // the simulator does not always aggregate ready pods into the Deployment status,
      // but pod readiness (the thing this level teaches) is reported reliably.
      kind: "pod-ready-by-selector",
      namespace: "default",
      selector: { app: "web-app" },
      minReady: 1,
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
  ],
  hints: [
    {
      id: "hint-1",
      title: "Start with the pods",
      body: "Are the pods Running? Are they Ready? Those are different things. `kubectl get pods` shows the READY column — check what it says.",
      xpPenalty: 15,
    },
    {
      id: "hint-2",
      title: "Ask why it isn't Ready",
      body: "A pod that is Running but not Ready usually failed a readiness probe. `kubectl describe pod <name>` and `kubectl get events` will tell you which probe failed, and with what HTTP status.",
      xpPenalty: 25,
      unlockAfter: ["r-pod-not-ready"],
    },
    {
      id: "hint-3",
      title: "Compare what the app serves",
      body: "The container answers /healthz with 200 but /readyz with 404. Probe both with curl. Then look closely at which path your readiness probe is checking.",
      xpPenalty: 35,
      unlockAfter: ["r-readyz-404"],
    },
  ],
  evidenceRules: [
    {
      id: "r-pod-running",
      evidenceId: "pod-running",
      label: "Pod is Running",
      hiddenLabel: "Pod status checked",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get pods", outputMatches: "Running" },
    },
    {
      id: "r-pod-not-ready",
      evidenceId: "pod-not-ready",
      label: "Pod is Running but not Ready (0/1)",
      hiddenLabel: "Pod readiness inspected",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get pods", outputMatches: "0/1" },
    },
    {
      id: "r-no-endpoints",
      evidenceId: "svc-no-endpoints",
      label: "Service has zero ready endpoints",
      hiddenLabel: "Service endpoints inspected",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get endpoints", outputMatches: "<none>" },
    },
    {
      id: "r-probe-event",
      evidenceId: "probe-failed-event",
      label: "Events show the readiness probe failed",
      hiddenLabel: "Recent events reviewed",
      source: "events",
      trigger: { type: "event-reason", reason: "Unhealthy" },
    },
    {
      id: "r-readyz-404",
      evidenceId: "readyz-404",
      label: "GET /readyz returns 404",
      hiddenLabel: "Probe endpoint tested",
      source: "network",
      trigger: { type: "probe", hostMatches: "^web-svc$", pathMatches: "/readyz", status: 404 },
    },
    {
      id: "r-healthz-200",
      evidenceId: "healthz-200",
      label: "GET /healthz returns 200",
      hiddenLabel: "Health endpoint tested",
      source: "network",
      trigger: { type: "probe", hostMatches: "^web-svc$", pathMatches: "/healthz", status: 200 },
    },
  ],
  postSolveExplanation: {
    rootCause: "The readiness probe targeted /readyz, a path the app answers with 404.",
    whyItFailed:
      "The container was healthy (/healthz → 200) so it kept running, but the kubelet's readiness probe hit /readyz and got 404. It marked the pod NotReady. The EndpointSlice controller only publishes Ready pods, so web-svc had zero endpoints and returned 503 to every request.",
    whatFixedIt:
      "Pointing the readiness probe at /healthz (which returns 200) let the pods report Ready. They were then added to the Service's EndpointSlice, and traffic flowed again.",
    prevention:
      "Contract-test probe paths against the built image and monitor Ready replicas and endpoints independently from container liveness.",
    relatedConcepts: ["readiness-probes", "endpointslices", "services"],
    docsHref: "/docs/debugging/readiness-probes",
    recommendedNextSlugs: ["liveness-probe-death-spiral"],
  },
} satisfies ProblemLevel;
