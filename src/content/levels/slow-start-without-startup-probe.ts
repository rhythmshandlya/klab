import type { ProblemLevel } from "@/lib/domain/types";

import { PUBLISHED_PROBLEM_V1 } from "./metadata";

const DEPLOYMENT_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: reports-api
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: reports-api
  template:
    metadata:
      labels:
        app: reports-api
    spec:
      containers:
        - name: api
          image: klab/slow-api:1.0.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 1
            failureThreshold: 2
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 1
            failureThreshold: 2
`;

const SERVICE_YAML = `apiVersion: v1
kind: Service
metadata:
  name: reports-api-svc
  namespace: default
spec:
  selector:
    app: reports-api
  ports:
    - name: http
      port: 80
      targetPort: 8080
`;

export const slowStartWithoutStartupProbe = {
  id: "slow-start-without-startup-probe",
  slug: "slow-start-without-startup-probe",
  ...PUBLISHED_PROBLEM_V1,
  title: "Slow Start Without startupProbe",
  difficulty: "intermediate",
  severity: "high",
  xp: 150,
  estimatedMinutes: 20,
  successRate: 54,
  concepts: [
    "pods",
    "deployments",
    "startup-probes",
    "readiness-probes",
    "liveness-probes",
    "debugging",
  ],
  blurb: "A healthy API is killed during warm-up before it can open its port.",
  story:
    "reports-api now warms a cache before accepting traffic. The rollout never becomes Ready: logs repeatedly begin the warm-up, then stop, and the container restarts. The health endpoint is correct once startup finishes.",
  objective: "Protect the five-second warm-up without weakening steady-state health detection.",
  learningObjectives: [
    "Choose startupProbe when liveness must be delayed until initialization completes.",
    "Keep readiness, liveness, and startup checks responsible for distinct lifecycle decisions.",
  ],
  prerequisites: ["command-override-crash", "broken-readiness-probe"],
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
      id: "add-startup-protection",
      label:
        "Keep the existing steady-state health policy and add a bounded gate for the five-second warm-up",
      kind: "manifest",
      file: "deployment.yaml",
      resource: { kind: "Deployment", name: "reports-api" },
      exclusive: true,
      assertions: [
        {
          path: "spec.template.spec.containers[name=api].image",
          operator: "equals",
          value: "klab/slow-api:1.0.0",
        },
        {
          path: "spec.template.spec.containers[name=api].readinessProbe.httpGet.path",
          operator: "equals",
          value: "/healthz",
        },
        {
          path: "spec.template.spec.containers[name=api].readinessProbe.periodSeconds",
          operator: "equals",
          value: 1,
        },
        {
          path: "spec.template.spec.containers[name=api].readinessProbe.failureThreshold",
          operator: "equals",
          value: 2,
        },
        {
          path: "spec.template.spec.containers[name=api].livenessProbe.httpGet.path",
          operator: "equals",
          value: "/healthz",
        },
        {
          path: "spec.template.spec.containers[name=api].livenessProbe.periodSeconds",
          operator: "equals",
          value: 1,
        },
        {
          path: "spec.template.spec.containers[name=api].livenessProbe.failureThreshold",
          operator: "equals",
          value: 2,
        },
      ],
      goals: [
        {
          goal: "probe-targets-serving-port",
          container: "api",
          servingPort: 8080,
          probe: "readinessProbe",
        },
        {
          goal: "probe-targets-serving-port",
          container: "api",
          servingPort: 8080,
          probe: "livenessProbe",
        },
        {
          goal: "startup-probe-covers-warmup",
          container: "api",
          servingPort: 8080,
          httpPath: "/healthz",
          minBudgetSeconds: 6,
        },
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
        selector: { app: "reports-api" },
        prefer: "highest-restarts",
      },
    },
    {
      id: "logs",
      command: "kubectl logs <pod>",
      target: {
        kind: "pod",
        namespace: "default",
        selector: { app: "reports-api" },
        prefer: "highest-restarts",
      },
    },
    { id: "events", command: "kubectl get events --sort-by=.lastTimestamp" },
    { id: "endpoints", command: "kubectl get endpoints reports-api-svc" },
  ],
  probeTargets: ["http://reports-api-svc/", "http://reports-api-svc/healthz"],
  validators: [
    {
      id: "deployment-ready",
      title: "Reports API is Ready",
      successLabel: "reports-api completed startup and is Ready",
      failureLabel: "reports-api never completes startup",
      kind: "deployment-ready",
      namespace: "default",
      name: "reports-api",
      minReadyReplicas: 1,
    },
    {
      id: "stable-process",
      title: "Warm-up is uninterrupted",
      successLabel: "The API completes warm-up without a restart",
      failureLabel: "The kubelet still restarts the API during warm-up",
      kind: "pod-restarts-below",
      namespace: "default",
      selector: { app: "reports-api" },
      maxRestarts: 0,
    },
    {
      id: "service-endpoints",
      title: "Service has endpoints",
      successLabel: "reports-api-svc has a Ready endpoint",
      failureLabel: "reports-api-svc has no Ready endpoint",
      kind: "service-has-ready-endpoints",
      namespace: "default",
      name: "reports-api-svc",
      minReadyEndpoints: 1,
    },
    {
      id: "http-200",
      title: "Reports API responds",
      successLabel: "GET / through reports-api-svc returns 200",
      failureLabel: "GET / through reports-api-svc does not return 200",
      kind: "http-get-through-service",
      namespace: "default",
      service: "reports-api-svc",
      port: 80,
      path: "/",
      expectStatus: 200,
    },
  ],
  hints: [
    {
      id: "hint-1",
      title: "Compare the two clocks",
      body: "The application tells you how long warm-up takes. Compare that with how quickly liveness is allowed to kill it.",
      xpPenalty: 20,
    },
    {
      id: "hint-2",
      title: "Do not hide deadlocks forever",
      body: "A long liveness delay can mask later failures. Kubernetes has a probe that gates liveness and readiness only during startup.",
      xpPenalty: 30,
      unlockAfter: ["r-warmup"],
    },
    {
      id: "hint-3",
      title: "Budget the warm-up",
      body: "Add startupProbe on /healthz:8080 with periodSeconds 1 and failureThreshold at least 6. Keep the existing readiness and liveness probes.",
      xpPenalty: 45,
      unlockAfter: ["r-liveness-kill"],
    },
  ],
  evidenceRules: [
    {
      id: "r-restarts",
      evidenceId: "startup-restarts",
      label: "The API restarts before becoming Ready",
      hiddenLabel: "Pod lifecycle inspected",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get pods", outputMatches: "0/1" },
    },
    {
      id: "r-warmup",
      evidenceId: "five-second-warmup",
      label: "Logs show a five-second cache warm-up",
      hiddenLabel: "Application startup logs inspected",
      source: "logs",
      trigger: { type: "log", messageMatches: "warming caches for 5 seconds" },
    },
    {
      id: "r-liveness-kill",
      evidenceId: "liveness-kills-startup",
      label: "Liveness failures kill the process during warm-up",
      hiddenLabel: "Kubelet probe events inspected",
      source: "events",
      trigger: { type: "event-reason", reason: "Unhealthy", messageMatches: "Liveness" },
    },
    {
      id: "r-no-endpoints",
      evidenceId: "no-ready-endpoints",
      label: "The Service never receives a Ready endpoint",
      hiddenLabel: "Service endpoints inspected",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get endpoints", outputMatches: "<none>" },
    },
    {
      id: "r-service-down",
      evidenceId: "service-unavailable",
      label: "reports-api-svc returns 503 during the restart loop",
      hiddenLabel: "Service availability tested",
      source: "network",
      trigger: {
        type: "probe",
        hostMatches: "^reports-api-svc$",
        pathMatches: "/",
        status: 503,
      },
    },
  ],
  postSolveExplanation: {
    rootCause:
      "The liveness probe began immediately and exhausted its failure budget before the API's five-second warm-up completed.",
    whyItFailed:
      "During warm-up nothing listened on port 8080. Liveness interpreted that expected startup state as a dead process and restarted it after two failures. Every restart reset the warm-up, creating a permanent loop.",
    whatFixedIt:
      "A startupProbe gave the process a bounded startup budget. Kubernetes withheld readiness and liveness checks until startup succeeded, then resumed the stricter steady-state probes.",
    prevention:
      "Measure cold-start time under realistic load, set a bounded startupProbe budget above its upper percentile, and keep liveness focused on post-start deadlocks.",
    relatedConcepts: ["startup-probes", "liveness-probes", "readiness-probes", "pods"],
    docsHref: "/docs/debugging/readiness-probes",
    recommendedNextSlugs: ["probe-hits-wrong-port", "liveness-probe-death-spiral"],
  },
} satisfies ProblemLevel;
