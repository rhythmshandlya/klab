import type { ProblemLevel } from "@/lib/domain/types";

/**
 * Level: Service Has No Endpoints.
 *
 * During an incident someone scaled the deployment to zero "temporarily" and never
 * scaled it back. Nothing is red — there are simply no pods at all, which is its own
 * kind of confusing. Fix: replicas back up in deployment.yaml.
 */

const DEPLOYMENT_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: default
spec:
  replicas: 0
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

export const serviceHasNoEndpoints = {
  id: "service-has-no-endpoints",
  slug: "service-has-no-endpoints",
  title: "Service Has No Endpoints",
  difficulty: "intermediate",
  severity: "high",
  xp: 150,
  estimatedMinutes: 25,
  successRate: 63,
  concepts: ["services", "endpoints", "deployments", "debugging"],
  blurb: "A service exists but has no backing endpoints. Restore traffic flow.",
  story:
    "web-svc has served nothing but 503s all weekend. The dashboards show no crashing pods, no failing probes, no warning events — nothing is red. That's because there is nothing. Friday's incident response 'temporarily' scaled the fleet down, and Friday's on-call is on a beach.",
  objective: "Get web-svc serving again (HTTP 200 with ready endpoints).",
  engine: { kind: "webernetes" },
  constraints: [
    {
      id: "edit-deploy-only",
      label: "Only edit deployment.yaml",
      kind: "editable-files",
      paths: ["deployment.yaml"],
    },
    {
      id: "two-replicas",
      label: "Restore at least two replicas without replacing or bypassing the workload",
      kind: "manifest",
      file: "deployment.yaml",
      resource: { kind: "Deployment", name: "web-app" },
      exclusive: true,
      assertions: [
        { path: "spec.replicas", operator: "gte", value: 2 },
        {
          path: "spec.template.spec.containers.0.image",
          operator: "equals",
          value: "klab/web-app:1.0.0",
        },
        { path: "spec.template.spec.containers.0.readinessProbe", operator: "present" },
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
    { id: "command-2", command: "kubectl get deployments" },
    { id: "command-3", command: "kubectl get endpoints web-svc" },
    { id: "command-4", command: "kubectl describe deployment web-app" },
  ],
  probeTargets: ["http://web-svc/", "http://web-svc/healthz"],
  validators: [
    {
      id: "deployment-ready",
      title: "Deployment has ready replicas",
      successLabel: "web-app has at least 2 ready replicas",
      failureLabel: "web-app does not have 2 ready replicas",
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
      title: "Nothing is broken. Nothing is running.",
      body: "Don't hunt for a red pod — count the pods. `kubectl get pods` and `kubectl get endpoints web-svc`. What do you actually have?",
      xpPenalty: 25,
    },
    {
      id: "hint-2",
      title: "Who makes pods?",
      body: "Pods come from the Deployment's replica count. `kubectl get deployments` — read the READY column carefully. 0/0 means it's doing exactly what it was told.",
      xpPenalty: 40,
      unlockAfter: ["r-no-pods"],
    },
    {
      id: "hint-3",
      title: "Scale it back",
      body: "replicas: 0 was Friday's 'temporary' mitigation. Set replicas: 2 in deployment.yaml and Apply.",
      xpPenalty: 60,
      unlockAfter: ["r-scaled-zero"],
    },
  ],
  evidenceRules: [
    {
      id: "r-no-pods",
      evidenceId: "no-pods",
      label: "There are no pods at all",
      hiddenLabel: "Pod inventory checked",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get pods", outputMatches: "No resources found" },
    },
    {
      id: "r-scaled-zero",
      evidenceId: "scaled-zero",
      label: "web-app is scaled to 0/0 replicas",
      hiddenLabel: "Deployment scale inspected",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "get deploy|describe deployment",
        outputMatches: "0/0|0 ready / 0 desired",
      },
    },
    {
      id: "r-no-endpoints",
      evidenceId: "no-endpoints",
      label: "web-svc has zero endpoints",
      hiddenLabel: "Service endpoints inspected",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get endpoints", outputMatches: "<none>" },
    },
    {
      id: "r-dead",
      evidenceId: "svc-dead",
      label: "Requests to web-svc go nowhere",
      hiddenLabel: "Service reachability tested",
      source: "network",
      trigger: { type: "probe", hostMatches: "^web-svc$", pathMatches: "^/$", status: 0 },
    },
    {
      id: "r-dead-503",
      evidenceId: "svc-dead",
      label: "Requests to web-svc go nowhere",
      hiddenLabel: "Service reachability tested",
      source: "network",
      trigger: { type: "probe", hostMatches: "^web-svc$", pathMatches: "^/$", status: 503 },
    },
  ],
  postSolveExplanation: {
    rootCause: "The Deployment was scaled to replicas: 0, so no pods existed to serve web-svc.",
    whyItFailed:
      "A Service is only as alive as the pods its selector matches. With zero replicas the EndpointSlice was empty, and — crucially — nothing looked 'broken': no crash loops, no failing probes, no warning events. Absence doesn't alert.",
    whatFixedIt:
      "Restoring replicas: 2 made the Deployment create pods again; once they passed readiness they were published as endpoints and web-svc served traffic.",
    relatedConcepts: ["deployments", "services", "endpoints"],
  },
} satisfies ProblemLevel;
