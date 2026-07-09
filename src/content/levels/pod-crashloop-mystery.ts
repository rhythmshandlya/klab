import type { ProblemLevel } from "@/lib/domain/types";

/**
 * Level: Pod CrashLoop Mystery.
 *
 * The worker image requires DATABASE_URL and exits(1) without it. The deployment
 * doesn't set it, so the pods crash-loop. The container's "last words" are in its
 * logs. Fix: add the env var to the container spec.
 */

const DEPLOYMENT_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: queue-worker
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: queue-worker
  template:
    metadata:
      labels:
        app: queue-worker
    spec:
      containers:
        - name: worker
          image: klab/worker:1.0.0
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
  name: worker-svc
  namespace: default
spec:
  selector:
    app: queue-worker
  ports:
    - name: http
      port: 80
      targetPort: 8080
`;

export const podCrashloopMystery = {
  id: "pod-crashloop-mystery",
  slug: "pod-crashloop-mystery",
  title: "Pod CrashLoop Mystery",
  difficulty: "intermediate",
  severity: "high",
  xp: 150,
  estimatedMinutes: 25,
  successRate: 58,
  concepts: ["pods", "debugging", "events", "deployments"],
  blurb: "The worker pods keep crashing, seconds after every restart.",
  story:
    "The queue-worker fleet was migrated to the new cluster this morning. Since then the job queue has only grown: the workers start, die within seconds, and the kubelet dutifully restarts them into the same wall. Jobs are piling up — find out what the workers are missing.",
  objective: "Get the queue-worker pods Running, Ready, and staying up.",
  constraints: [
    { id: "edit-deploy-only", label: "Only edit deployment.yaml" },
    { id: "keep-image", label: "Keep the klab/worker:1.0.0 image" },
  ],
  files: [{ path: "deployment.yaml", language: "yaml", initialValue: DEPLOYMENT_YAML }],
  readonlyFiles: [{ path: "service.yaml", language: "yaml", value: SERVICE_YAML }],
  initialManifests: [SERVICE_YAML],
  registeredImages: [
    {
      ref: "klab/worker:1.0.0",
      description: "Queue worker — requires DATABASE_URL, exits immediately without it.",
    },
  ],
  allowedCommands: [
    "kubectl get pods",
    "kubectl logs <pod>",
    "kubectl describe pod <name>",
    "kubectl get events",
    "kubectl get events --sort-by=.lastTimestamp",
  ],
  quickCommands: [
    "kubectl get pods",
    "kubectl logs <pod>",
    "kubectl describe pod <pod>",
    "kubectl get events",
  ],
  probeTargets: ["http://worker-svc/healthz", "http://worker-svc/"],
  validators: [
    {
      id: "pods-ready",
      title: "Worker pods are Ready",
      successLabel: "The queue-worker pods are Ready",
      failureLabel: "The queue-worker pods are not Ready",
      kind: "pod-ready-by-selector",
      namespace: "default",
      selector: { app: "queue-worker" },
      minReady: 2,
    },
    {
      id: "no-restarts",
      title: "Workers stay up",
      successLabel: "No worker pod is restarting",
      failureLabel: "Worker pods are still restarting",
      kind: "pod-restarts-below",
      namespace: "default",
      selector: { app: "queue-worker" },
      maxRestarts: 0,
    },
    {
      id: "http-200",
      title: "Worker service answers",
      successLabel: "GET /healthz through worker-svc returns 200",
      failureLabel: "worker-svc is not answering",
      kind: "http-get-through-service",
      namespace: "default",
      service: "worker-svc",
      port: 80,
      path: "/healthz",
      expectStatus: 200,
    },
  ],
  hints: [
    {
      id: "hint-1",
      title: "Read the STATUS column, not just Running",
      body: "`kubectl get pods` — a status like CrashLoopBackOff means the process EXITS and Kubernetes keeps restarting it. This isn't a probe problem; the app itself is dying.",
      xpPenalty: 25,
    },
    {
      id: "hint-2",
      title: "Ask the container why it died",
      body: "A crashing container almost always prints its reason before exiting. `kubectl logs <pod>` shows its last words.",
      xpPenalty: 40,
      unlockAfter: ["r-crashloop"],
    },
    {
      id: "hint-3",
      title: "Give it what it asks for",
      body: "The worker exits because DATABASE_URL is not set. Add it to the container spec (env: - name: DATABASE_URL, value: any DSN like postgres://queue-db:5432/jobs) and Apply.",
      xpPenalty: 60,
      unlockAfter: ["r-fatal-log"],
    },
  ],
  evidenceRules: [
    {
      id: "r-crashloop",
      evidenceId: "crashloop",
      label: "Pods are in CrashLoopBackOff",
      hiddenLabel: "Pod status checked",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "get pods",
        outputMatches: "CrashLoopBackOff|Error",
      },
    },
    {
      id: "r-restarts",
      evidenceId: "restarts-climbing",
      label: "Restart count is climbing",
      hiddenLabel: "Restart counter inspected",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "describe pod|get pods",
        outputMatches: "Restart Count:\\s+[1-9]",
      },
    },
    {
      id: "r-fatal-log",
      evidenceId: "fatal-log",
      label: "Logs: FATAL — DATABASE_URL is not set",
      hiddenLabel: "Container logs read",
      source: "terminal",
      trigger: { type: "command", commandMatches: "logs", outputMatches: "DATABASE_URL is not set" },
    },
    {
      id: "r-backoff-event",
      evidenceId: "backoff-event",
      label: "Events show restart back-off",
      hiddenLabel: "Recent events reviewed",
      source: "events",
      trigger: { type: "event-reason", reason: "BackOff" },
    },
    {
      id: "r-backoff-event-terminal",
      evidenceId: "backoff-event",
      label: "Events show restart back-off",
      hiddenLabel: "Recent events reviewed",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get events", outputMatches: "Back-?[Oo]ff" },
    },
  ],
  postSolveExplanation: {
    rootCause: "The worker requires a DATABASE_URL env var, and the Deployment never set it.",
    whyItFailed:
      "On startup the worker checked its configuration, logged 'FATAL: DATABASE_URL is not set' and exited 1. The kubelet restarted it with exponential back-off — CrashLoopBackOff — but restarts can't fix missing configuration, so the loop never ended.",
    whatFixedIt:
      "Adding the DATABASE_URL env var to the container spec rolled out new pods that started cleanly, passed readiness, and stayed up with zero restarts.",
    relatedConcepts: ["pods", "debugging", "events"],
  },
} satisfies ProblemLevel;
