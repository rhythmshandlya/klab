import type { ProblemLevel } from "@/lib/domain/types";

/**
 * Level: Zombie ReplicaSet.
 *
 * An orphaned ReplicaSet from a pre-Deployment era still runs one legacy pod. Its
 * /healthz passes (so it's READY and joins web-svc), but every real request answers
 * 500 — poisoning a share of traffic. Teaches: Services select by LABELS, not by
 * ownership; count your endpoints. Fix: scale the zombie to 0 (or delete it).
 *
 * (The reference design lists "StatefulSet Orphaned PVCs" in this slot — the
 * simulator has no StatefulSet/PVC support, so the same "orphaned workload
 * haunts production" lesson is told through a ReplicaSet.)
 */

const LEGACY_RS_YAML = `apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: web-legacy
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: web
      track: legacy
  template:
    metadata:
      labels:
        app: web
        track: legacy
    spec:
      containers:
        - name: web-app
          image: klab/web-app:0.9.0
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

const DEPLOYMENT_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
      track: stable
  template:
    metadata:
      labels:
        app: web
        track: stable
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
    app: web
  ports:
    - name: http
      port: 80
      targetPort: 8080
`;

export const zombieReplicaset = {
  id: "zombie-replicaset",
  slug: "zombie-replicaset",
  title: "Zombie ReplicaSet",
  difficulty: "advanced",
  severity: "critical",
  xp: 200,
  estimatedMinutes: 35,
  successRate: 39,
  concepts: ["replicasets", "labels-selectors", "services", "rollouts", "debugging"],
  blurb: "Roughly a third of requests fail. The other two thirds are perfect.",
  story:
    "Support tickets say checkout 'sometimes' errors — retry and it works. Your dashboards agree: a stubborn ~33% error rate, day and night. The web Deployment is green: 2/2 Ready, all probes passing. But web-svc keeps answering 500 to every third visitor, like something is haunting the rotation.",
  objective: "Make EVERY request through web-svc return 200 — retire whatever is poisoning it.",
  engine: { kind: "webernetes" },
  constraints: [
    {
      id: "edit-legacy",
      label: "Only edit legacy-rs.yaml — the Deployment and Service are correct",
      kind: "editable-files",
      paths: ["legacy-rs.yaml"],
    },
    {
      id: "keep-capacity",
      label: "Retire the legacy ReplicaSet without relabeling or replacing it",
      kind: "manifest",
      file: "legacy-rs.yaml",
      resource: { kind: "ReplicaSet", name: "web-legacy" },
      exclusive: true,
      assertions: [
        { path: "spec.replicas", operator: "lte", value: 0 },
        { path: "spec.selector.matchLabels.app", operator: "equals", value: "web" },
        { path: "spec.selector.matchLabels.track", operator: "equals", value: "legacy" },
        { path: "spec.template.metadata.labels.track", operator: "equals", value: "legacy" },
        {
          path: "spec.template.spec.containers.0.image",
          operator: "equals",
          value: "klab/web-app:0.9.0",
        },
      ],
    },
  ],
  files: [
    {
      path: "legacy-rs.yaml",
      language: "yaml",
      initialValue: LEGACY_RS_YAML,
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
    { id: "command-2", command: "kubectl get rs" },
    { id: "command-3", command: "kubectl get endpoints web-svc" },
    { id: "command-4", command: "kubectl describe svc web-svc" },
  ],
  probeTargets: ["http://web-svc/", "http://web-svc/healthz"],
  validators: [
    {
      id: "zombie-gone",
      title: "Legacy workload retired",
      successLabel: "No legacy (track=legacy) pods remain",
      failureLabel: "A legacy pod is still running and selected",
      kind: "no-pods-matching",
      namespace: "default",
      selector: { app: "web", track: "legacy" },
    },
    {
      id: "stable-ready",
      title: "Stable pods keep serving",
      successLabel: "The stable web pods are Ready",
      failureLabel: "The stable web pods are not Ready",
      kind: "pod-ready-by-selector",
      namespace: "default",
      selector: { app: "web", track: "stable" },
      minReady: 2,
    },
    {
      id: "http-200",
      title: "Service returns 200",
      successLabel: "GET / through web-svc returns 200",
      failureLabel: "web-svc is still serving errors",
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
      title: "A third of what, exactly?",
      body: "A steady one-in-N error rate smells like one bad backend in a rotation of N. Count the backends: `kubectl get endpoints web-svc` versus what the Deployment says it runs (2 replicas). Do the numbers match?",
      xpPenalty: 40,
    },
    {
      id: "hint-2",
      title: "Who owns the extra pod?",
      body: "There's a third pod behind web-svc that the Deployment doesn't own. `kubectl get pods` and `kubectl get rs` — Services select by LABELS (app=web), not by owner. Something old still matches.",
      xpPenalty: 60,
      unlockAfter: ["r-three-endpoints"],
    },
    {
      id: "hint-3",
      title: "Retire the zombie",
      body: "web-legacy is an orphaned ReplicaSet running the retired 0.9.0 build — healthy enough to pass probes, broken for real traffic. Scale it to replicas: 0 in legacy-rs.yaml and Apply (deleting it works too).",
      xpPenalty: 80,
      unlockAfter: ["r-legacy-rs"],
    },
  ],
  evidenceRules: [
    {
      id: "r-500",
      evidenceId: "flaky-500",
      label: "web-svc answers 500 for some requests",
      hiddenLabel: "Service responses sampled",
      source: "network",
      trigger: { type: "probe", hostMatches: "^web-svc$", pathMatches: "^/$", status: 500 },
    },
    {
      id: "r-three-endpoints",
      evidenceId: "three-endpoints",
      label: "web-svc has THREE endpoints — the Deployment only runs two",
      hiddenLabel: "Endpoint count audited",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "get endpoints|describe (svc|service)",
        outputMatches: "(\\d+\\.\\d+\\.\\d+\\.\\d+,){2}\\d+\\.\\d+\\.\\d+\\.\\d+",
      },
    },
    {
      id: "r-legacy-rs",
      evidenceId: "legacy-rs",
      label: "An orphaned ReplicaSet web-legacy still exists",
      hiddenLabel: "ReplicaSets audited",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "get rs|get replicasets",
        outputMatches: "web-legacy",
      },
    },
    {
      id: "r-legacy-pod",
      evidenceId: "legacy-pod",
      label: "A web-legacy pod is Running and Ready",
      hiddenLabel: "Pod inventory checked",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get pods", outputMatches: "web-legacy" },
    },
    {
      id: "r-legacy-build",
      evidenceId: "legacy-build",
      label: "The extra pod runs the retired 0.9.0 build",
      hiddenLabel: "Pod image inspected",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "describe pod|logs",
        outputMatches: "0\\.9\\.0|legacy",
      },
    },
    {
      id: "r-three-endpoints-topology",
      evidenceId: "three-endpoints",
      label: "web-svc has three endpoints while the Deployment owns two pods",
      hiddenLabel: "Endpoint count audited",
      source: "topology",
      trigger: {
        type: "topology-view",
        kind: "Service",
        nameMatches: "^web-svc$",
        namespace: "default",
      },
    },
    {
      id: "r-legacy-rs-explorer",
      evidenceId: "legacy-rs",
      label: "An orphaned ReplicaSet web-legacy still exists",
      hiddenLabel: "ReplicaSets audited",
      source: "object-explorer",
      trigger: {
        type: "object-view",
        kind: "ReplicaSet",
        nameMatches: "^web-legacy$",
        namespace: "default",
      },
    },
  ],
  postSolveExplanation: {
    rootCause:
      "An orphaned ReplicaSet (web-legacy) kept one retired 0.9.0 pod alive, and web-svc's selector (app=web) matched it.",
    whyItFailed:
      "Services route by labels, not by ownership. The legacy pod's /healthz still returned 200, so it was Ready and took a full share of traffic — then answered 500 to every real request. Three endpoints, one poisoned: a stable ~33% error rate that no Deployment dashboard would ever show.",
    whatFixedIt:
      "Scaling web-legacy to zero removed the poisoned pod from the EndpointSlice, leaving only the stable pods behind web-svc. Every request now returns 200. (Longer term: delete the orphan and tighten the Service selector, e.g. app=web,track=stable.)",
    relatedConcepts: ["replicasets", "labels-selectors", "services"],
  },
} satisfies ProblemLevel;
