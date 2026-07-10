import type { ProblemLevel } from "@/lib/domain/types";

import { PUBLISHED_PROBLEM_V1 } from "./metadata";

/**
 * Level: Liveness Probe Death Spiral.
 *
 * The liveness probe targets /readyz (404 on this app), so the kubelet kills a
 * perfectly healthy container over and over. Readiness (correctly on /healthz) passes
 * between kills, making the service flap. Teaches the readiness-vs-liveness
 * distinction from the sharp end. Fix: point liveness at /healthz.
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
          livenessProbe:
            httpGet:
              path: /readyz
              port: 8080
            initialDelaySeconds: 2
            periodSeconds: 2
            timeoutSeconds: 2
            failureThreshold: 2
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

export const livenessProbeDeathSpiral = {
  id: "liveness-probe-death-spiral",
  slug: "liveness-probe-death-spiral",
  ...PUBLISHED_PROBLEM_V1,
  title: "Liveness Probe Death Spiral",
  difficulty: "advanced",
  severity: "critical",
  xp: 200,
  estimatedMinutes: 30,
  successRate: 42,
  concepts: ["liveness-probes", "readiness-probes", "pods", "events", "debugging"],
  blurb: "An aggressive liveness probe keeps executing perfectly healthy pods.",
  story:
    "web-svc is flapping: up for a few seconds, dead, up again. The app team insists nothing is wrong with the app — and weirdly, they're right. Meanwhile the pods' restart counters are climbing like a countdown. Something in the cluster is killing healthy containers, on schedule.",
  objective: "Stop the restart spiral and keep web-svc stably serving HTTP 200.",
  learningObjectives: [
    "Separate liveness, readiness, and application health semantics.",
    "Correlate probe events with restart counts and intermittent endpoint loss.",
  ],
  prerequisites: ["broken-readiness-probe"],
  learningPaths: ["reliability", "sre-on-call"],
  capabilities: ["pods", "services", "deployments", "events", "http-probes", "container-restarts"],
  engine: { kind: "webernetes" },
  constraints: [
    {
      id: "edit-deploy-only",
      label: "Only edit deployment.yaml",
      kind: "editable-files",
      paths: ["deployment.yaml"],
    },
    {
      id: "keep-liveness",
      label: "Keep both probes and the web-app image; repair the liveness check",
      kind: "manifest",
      file: "deployment.yaml",
      resource: { kind: "Deployment", name: "web-app" },
      exclusive: true,
      assertions: [
        {
          path: "spec.template.spec.containers.0.image",
          operator: "equals",
          value: "klab/web-app:1.0.0",
        },
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
    { id: "command-1", command: "kubectl get pods" },
    {
      id: "command-2",
      command: "kubectl describe pod <pod>",
      target: {
        kind: "pod",
        namespace: "default",
        selector: { app: "web-app" },
        prefer: "highest-restarts",
      },
    },
    { id: "command-3", command: "kubectl get events --sort-by=.lastTimestamp" },
    {
      id: "command-4",
      command: "kubectl logs <pod>",
      target: {
        kind: "pod",
        namespace: "default",
        selector: { app: "web-app" },
        prefer: "highest-restarts",
      },
    },
  ],
  probeTargets: ["http://web-svc/", "http://web-svc/healthz"],
  validators: [
    {
      id: "no-restarts",
      title: "Containers stay alive",
      successLabel: "No pod is being restarted",
      failureLabel: "Containers are still being killed and restarted",
      kind: "pod-restarts-below",
      namespace: "default",
      selector: { app: "web-app" },
      maxRestarts: 0,
    },
    {
      id: "pods-ready",
      title: "App pods are Ready",
      successLabel: "The web-app pods are Ready",
      failureLabel: "The web-app pods are not (stably) Ready",
      kind: "pod-ready-by-selector",
      namespace: "default",
      selector: { app: "web-app" },
      minReady: 2,
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
      title: "Watch it happen twice",
      body: "Run `kubectl get pods`, wait ten seconds, run it again. The RESTARTS column is climbing. Restarting is not crashing — ask what, in Kubernetes, is allowed to kill a container.",
      xpPenalty: 40,
    },
    {
      id: "hint-2",
      title: "Two probes, two powers",
      body: "A failing READINESS probe only removes a pod from Service endpoints. A failing LIVENESS probe KILLS the container. `kubectl describe pod <pod>`: where does each probe point? Which of those paths does this app actually serve?",
      xpPenalty: 60,
      unlockAfter: ["r-restarts"],
    },
    {
      id: "hint-3",
      title: "The executioner is misconfigured",
      body: "Liveness checks /readyz — which this app answers with 404 — so the kubelet executes a healthy container every few seconds. Point the liveness probe at /healthz and Apply.",
      xpPenalty: 80,
      unlockAfter: ["r-liveness-target"],
    },
  ],
  evidenceRules: [
    {
      id: "r-restarts",
      evidenceId: "restarts-climbing",
      label: "Restart count is climbing on healthy pods",
      hiddenLabel: "Restart counter inspected",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "describe pod|get pods",
        outputMatches: "Restart Count:\\s+[1-9]",
      },
    },
    {
      id: "r-kill-event",
      evidenceId: "kill-event",
      label: "Events: the kubelet is killing the container",
      hiddenLabel: "Recent events reviewed",
      source: "events",
      trigger: { type: "event-reason", reason: "Killing" },
    },
    {
      id: "r-kill-event-terminal",
      evidenceId: "kill-event",
      label: "Events: the kubelet is killing the container",
      hiddenLabel: "Recent events reviewed",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "get events",
        outputMatches: "Killing|[Ll]iveness",
      },
    },
    {
      id: "r-liveness-target",
      evidenceId: "liveness-target",
      label: "The liveness probe targets /readyz",
      hiddenLabel: "Probe configuration inspected",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "describe pod",
        outputMatches: "Liveness:\\s+http-get /readyz",
      },
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
      label: "GET /healthz returns 200 — the app is fine",
      hiddenLabel: "Health endpoint tested",
      source: "network",
      trigger: { type: "probe", hostMatches: "^web-svc$", pathMatches: "/healthz", status: 200 },
    },
  ],
  postSolveExplanation: {
    rootCause:
      "The liveness probe targeted /readyz (404 on this app), so the kubelet repeatedly killed healthy containers.",
    whyItFailed:
      "Readiness and liveness answer different questions. Readiness (correctly on /healthz) passed, so pods joined the Service — then liveness (on /readyz) failed twice, the kubelet killed the container, endpoints emptied, and the cycle restarted. From outside it looked like flapping; from inside it was scheduled execution.",
    whatFixedIt:
      "Pointing the liveness probe at /healthz stopped the kills. The rollout produced fresh pods with zero restarts that stayed Ready, and the Service stopped flapping.",
    prevention:
      "Give liveness a deliberately conservative contract, test probe endpoints with the release image, and alert when kubelet restarts rise while application health remains good.",
    relatedConcepts: ["liveness-probes", "readiness-probes", "events"],
    docsHref: "/docs/debugging/readiness-probes",
    recommendedNextSlugs: ["config-drift"],
  },
} satisfies ProblemLevel;
