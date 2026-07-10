import type { ProblemLevel } from "@/lib/domain/types";

import { PUBLISHED_PROBLEM_V1 } from "./metadata";

const DEPLOYMENT_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: payments-api
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: payments-api
  template:
    metadata:
      labels:
        app: payments-api
    spec:
      containers:
        - name: api
          image: klab/web-app:1.0.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 9090
            periodSeconds: 2
            failureThreshold: 2
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 5
            failureThreshold: 3
`;

const SERVICE_YAML = `apiVersion: v1
kind: Service
metadata:
  name: payments-api-svc
  namespace: default
spec:
  selector:
    app: payments-api
  ports:
    - name: http
      port: 80
      targetPort: 8080
`;

export const probeHitsWrongPort = {
  id: "probe-hits-wrong-port",
  slug: "probe-hits-wrong-port",
  ...PUBLISHED_PROBLEM_V1,
  title: "Probe Hits the Wrong Port",
  difficulty: "intermediate",
  severity: "high",
  xp: 150,
  estimatedMinutes: 18,
  successRate: 61,
  concepts: ["deployments", "readiness-probes", "services", "endpointslices", "debugging"],
  blurb: "The health path is correct, but readiness checks an unopened management port.",
  story:
    "payments-api is Running and its logs say it is listening, but the rollout remains 0/2 Ready. A recent template change split traffic and management ports. The Service still targets the application correctly.",
  objective: "Align readiness with the port the application actually serves and restore traffic.",
  learningObjectives: [
    "Trace a probe independently from the Service port and targetPort chain.",
    "Use container logs and Pod events to distinguish a wrong probe port from a wrong path.",
  ],
  prerequisites: ["port-routing-bug", "broken-readiness-probe"],
  learningPaths: ["application-debugging", "reliability"],
  capabilities: ["pods", "services", "deployments", "events", "logs", "http-probes"],
  engine: { kind: "webernetes" },
  constraints: [
    {
      id: "edit-deployment-only",
      label: "Only edit deployment.yaml",
      kind: "editable-files",
      paths: ["deployment.yaml"],
    },
    {
      id: "fix-readiness-port",
      label: "Keep the image and both probes; point readiness at the application listener",
      kind: "manifest",
      file: "deployment.yaml",
      resource: { kind: "Deployment", name: "payments-api" },
      exclusive: true,
      assertions: [
        {
          path: "spec.template.spec.containers.0.image",
          operator: "equals",
          value: "klab/web-app:1.0.0",
        },
        {
          path: "spec.template.spec.containers.0.readinessProbe.httpGet.port",
          operator: "equals",
          value: 8080,
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
    { id: "pods", command: "kubectl get pods" },
    {
      id: "describe",
      command: "kubectl describe pod <pod>",
      target: {
        kind: "pod",
        namespace: "default",
        selector: { app: "payments-api" },
        prefer: "not-ready",
      },
    },
    {
      id: "logs",
      command: "kubectl logs <pod>",
      target: {
        kind: "pod",
        namespace: "default",
        selector: { app: "payments-api" },
        prefer: "not-ready",
      },
    },
    { id: "endpoints", command: "kubectl get endpoints payments-api-svc" },
    { id: "events", command: "kubectl get events --sort-by=.lastTimestamp" },
  ],
  probeTargets: ["http://payments-api-svc/", "http://payments-api-svc/healthz"],
  validators: [
    {
      id: "pods-ready",
      title: "Payments replicas are Ready",
      successLabel: "Both payments-api Pods are Ready",
      failureLabel: "payments-api Pods remain NotReady",
      kind: "pod-ready-by-selector",
      namespace: "default",
      selector: { app: "payments-api" },
      minReady: 2,
    },
    {
      id: "service-endpoints",
      title: "Service has both endpoints",
      successLabel: "payments-api-svc has two Ready endpoints",
      failureLabel: "payments-api-svc is missing Ready endpoints",
      kind: "service-has-ready-endpoints",
      namespace: "default",
      name: "payments-api-svc",
      minReadyEndpoints: 2,
    },
    {
      id: "http-200",
      title: "Payments API responds",
      successLabel: "GET / through payments-api-svc returns 200",
      failureLabel: "GET / through payments-api-svc does not return 200",
      kind: "http-get-through-service",
      namespace: "default",
      service: "payments-api-svc",
      port: 80,
      path: "/",
      expectStatus: 200,
    },
  ],
  hints: [
    {
      id: "hint-1",
      title: "Read the whole probe target",
      body: "An HTTP probe is path plus port. A correct /healthz path can still fail if the kubelet connects to the wrong listener.",
      xpPenalty: 20,
    },
    {
      id: "hint-2",
      title: "Trust the process",
      body: "Application logs state the port the process opened. Compare it with Readiness in kubectl describe pod.",
      xpPenalty: 30,
      unlockAfter: ["r-listener"],
    },
    {
      id: "hint-3",
      title: "Change only readiness",
      body: "The Service and liveness probe already use 8080. Change readinessProbe.httpGet.port from 9090 to 8080.",
      xpPenalty: 45,
      unlockAfter: ["r-probe-port"],
    },
  ],
  evidenceRules: [
    {
      id: "r-not-ready",
      evidenceId: "running-not-ready",
      label: "Both Pods are Running but 0/1 Ready",
      hiddenLabel: "Pod readiness inspected",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get pods", outputMatches: "0/1" },
    },
    {
      id: "r-listener",
      evidenceId: "app-listens-8080",
      label: "The application logs that it listens on port 8080",
      hiddenLabel: "Application listener inspected",
      source: "logs",
      trigger: { type: "log", messageMatches: "listening on :8080" },
    },
    {
      id: "r-probe-port",
      evidenceId: "readiness-uses-9090",
      label: "Readiness probes /healthz on port 9090",
      hiddenLabel: "Probe target inspected",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "describe pod",
        outputMatches: "Readiness:\\s+http-get /healthz port 9090",
      },
    },
    {
      id: "r-probe-failure",
      evidenceId: "readiness-connection-failure",
      label: "Events show readiness cannot reach its target",
      hiddenLabel: "Readiness events inspected",
      source: "events",
      trigger: { type: "event-reason", reason: "Unhealthy", messageMatches: "Readiness" },
    },
    {
      id: "r-no-endpoints",
      evidenceId: "no-ready-endpoints",
      label: "The Service has no Ready endpoints",
      hiddenLabel: "Endpoint membership inspected",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get endpoints", outputMatches: "<none>" },
    },
    {
      id: "r-service-down",
      evidenceId: "service-unavailable",
      label: "payments-api-svc returns 503",
      hiddenLabel: "Service response tested",
      source: "network",
      trigger: {
        type: "probe",
        hostMatches: "^payments-api-svc$",
        pathMatches: "/",
        status: 503,
      },
    },
  ],
  postSolveExplanation: {
    rootCause:
      "The readiness probe connected to port 9090 while the process and Service target both used port 8080.",
    whyItFailed:
      "The kubelet sends probes directly to the Pod IP and the configured probe port; it does not route them through the Service. Nothing listened on 9090, so readiness failed even though /healthz was valid on 8080. NotReady Pods were withheld from the EndpointSlice.",
    whatFixedIt:
      "Changing readinessProbe.httpGet.port to 8080 aligned the kubelet check with the actual listener. Both Pods became Ready and the Service gained two endpoints.",
    prevention:
      "Use named container ports for probes where possible, and contract-test the rendered probe target against the image's declared listeners.",
    relatedConcepts: ["readiness-probes", "services", "endpointslices", "debugging"],
    docsHref: "/docs/debugging/readiness-probes",
    recommendedNextSlugs: ["healthy-app-broken-sidecar", "config-drift"],
  },
} satisfies ProblemLevel;
