import type { ProblemLevel } from "@/lib/domain/types";

import { PUBLISHED_PROBLEM_V1 } from "./metadata";

/**
 * Level: Immutable Deployment Selector.
 *
 * The routing team updated search-svc to select pods carrying `tier: api`. The search
 * pods lack that label, so the Service has no endpoints. A teammate tried to add the
 * label by editing the Deployment's spec.selector, but Deployment selectors are
 * immutable, so the apply was rejected. The fix is to leave the selector alone and add
 * `tier: api` to the pod template labels, which the controller then propagates.
 */

const DEPLOYMENT_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: search
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: search
  template:
    metadata:
      labels:
        app: search
    spec:
      containers:
        - name: api
          image: klab/search:1.4.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 2
`;

const SERVICE_YAML = `apiVersion: v1
kind: Service
metadata:
  name: search-svc
  namespace: default
spec:
  selector:
    app: search
    tier: api
  ports:
    - name: http
      port: 80
      targetPort: 8080
`;

export const immutableDeploymentSelector = {
  id: "immutable-deployment-selector",
  slug: "immutable-deployment-selector",
  ...PUBLISHED_PROBLEM_V1,
  title: "Immutable Deployment Selector",
  difficulty: "intermediate",
  severity: "high",
  xp: 150,
  estimatedMinutes: 25,
  successRate: 47,
  concepts: ["deployments", "labels-selectors", "rollouts", "debugging"],
  blurb:
    "The teammate edited the wrong field and the API pushed back. The pods are healthy: they just aren't selected.",
  story:
    "The routing team moved search-svc onto a tier-based contract so only API pods receive traffic. A teammate tried to update the search Deployment selector, but the API rejected the apply with `field is immutable`. The existing pods remain Running and Ready while search-svc has no endpoints and returns 503.",
  objective:
    "Restore search-svc routing while preserving both the existing Deployment selector and the Service contract.",
  learningObjectives: [
    "Recognize that a Deployment's spec.selector is immutable after creation.",
    "Migrate labels safely through the pod template rather than the selector.",
  ],
  prerequisites: ["rolling-update-gone-wrong", "service-selector-mismatch"],
  learningPaths: ["application-debugging", "reliability"],
  capabilities: ["pods", "services", "deployments", "http-probes", "rollouts"],
  engine: { kind: "scripted", scenarioId: "immutable-selector" },
  constraints: [
    {
      id: "edit-deploy-only",
      label: "Only edit deployment.yaml; the Service selector and image are correct",
      kind: "editable-files",
      paths: ["deployment.yaml"],
    },
    {
      id: "keep-selector-add-template-label",
      label:
        "Keep the Deployment identity, immutable selector, image, and Service contract; make new pods satisfy routing",
      kind: "manifest",
      file: "deployment.yaml",
      resource: { kind: "Deployment", name: "search" },
      exclusive: true,
      assertions: [
        { path: "spec.replicas", operator: "gte", value: 2 },
        {
          path: "spec.selector.matchLabels.app",
          operator: "equals",
          value: "search",
        },
        {
          path: "spec.selector.matchLabels.tier",
          operator: "absent",
        },
        {
          path: "spec.selector.matchExpressions",
          operator: "absent",
        },
        {
          path: "spec.template.metadata.labels.app",
          operator: "equals",
          value: "search",
        },
        {
          path: "spec.template.metadata.labels.tier",
          operator: "equals",
          value: "api",
        },
        {
          path: "spec.template.spec.containers[name=api].image",
          operator: "equals",
          value: "klab/search:1.4.0",
        },
        {
          path: "spec.template.spec.containers[name=api].readinessProbe.httpGet.path",
          operator: "equals",
          value: "/healthz",
        },
      ],
      goals: [
        {
          goal: "probe-targets-serving-port",
          container: "api",
          servingPort: 8080,
          probe: "readinessProbe",
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
      applyAtBoot: false,
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
    { id: "command-2", command: "kubectl get endpoints search-svc" },
    { id: "command-3", command: "kubectl get deployment search -o yaml" },
    { id: "command-4", command: "kubectl describe deployment search" },
    { id: "command-5", command: "kubectl get service search-svc -o yaml" },
  ],
  probeTargets: ["http://search-svc/", "http://search-svc/healthz"],
  validators: [
    {
      id: "search-deployment-ready",
      title: "Deployment has ready replicas",
      successLabel: "search has 2 ready replicas",
      failureLabel: "search replicas are not Ready",
      kind: "deployment-ready",
      namespace: "default",
      name: "search",
      minReadyReplicas: 2,
    },
    {
      id: "search-service-endpoints",
      title: "Service has ready endpoints",
      successLabel: "search-svc has ready endpoints",
      failureLabel: "search-svc matches no pods",
      kind: "service-has-ready-endpoints",
      namespace: "default",
      name: "search-svc",
      minReadyEndpoints: 2,
    },
    {
      id: "search-http-200",
      title: "Service returns 200",
      successLabel: "GET / through search-svc returns 200",
      failureLabel: "GET / through search-svc does not return 200",
      kind: "http-get-through-service",
      namespace: "default",
      service: "search-svc",
      port: 80,
      path: "/",
      expectStatus: 200,
    },
  ],
  hints: [
    {
      id: "hint-1",
      title: "The pods are fine, the Service is empty",
      body: "`kubectl get pods` shows Ready pods, but `kubectl get endpoints search-svc` is empty. The Service selector and the pod labels do not agree, which label is missing on the pods?",
      xpPenalty: 25,
    },
    {
      id: "hint-2",
      title: "You cannot edit the selector",
      body: "A Deployment's spec.selector is immutable. Trying to change it returns `field is immutable`. Labels are added to pods through the pod template (spec.template.metadata.labels), not the selector.",
      xpPenalty: 40,
      unlockAfter: ["r-empty-endpoints"],
    },
    {
      id: "hint-3",
      title: "Label the pods, not the selector",
      body: "Leave spec.selector.matchLabels as {app: search} and add tier: api to spec.template.metadata.labels. New pods then carry tier: api and match the Service.",
      xpPenalty: 60,
      unlockAfter: ["r-immutable-selector"],
    },
  ],
  evidenceRules: [
    {
      id: "r-ready-no-traffic",
      evidenceId: "ready-no-traffic",
      label: "search pods are Running and Ready but receive no traffic",
      hiddenLabel: "Pod readiness inspected",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get pods", outputMatches: "Running" },
    },
    {
      id: "r-empty-endpoints",
      evidenceId: "empty-endpoints",
      label: "search-svc has zero endpoints despite Ready pods",
      hiddenLabel: "Service endpoints inspected",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "get (endpoints|ep) search-svc",
        outputMatches: "<none>",
      },
    },
    {
      id: "r-immutable-selector",
      evidenceId: "immutable-selector",
      label: "The Deployment still owns pods through its stable app=search selector",
      hiddenLabel: "Deployment selector inspected",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "get deployment|describe deployment",
        outputMatches: "Selector:\\s+app=search|matchLabels:\\s+app:\\s+search",
      },
    },
    {
      id: "r-service-503",
      evidenceId: "service-503",
      label: "search-svc returns 503: no pods match its selector",
      hiddenLabel: "Service reachability tested",
      source: "network",
      trigger: {
        type: "probe",
        hostMatches: "^search-svc$",
        pathMatches: "^/$",
        status: 503,
      },
    },
  ],
  postSolveExplanation: {
    rootCause:
      "The search pods lacked the `tier: api` label that search-svc selects, so the Service had no ready endpoints.",
    whyItFailed:
      "A teammate reached for spec.selector to add the label, but Deployment selectors are immutable: Kubernetes rejected the apply with `field is immutable`, and the pod template was never updated. The selector lives in two places: the immutable selector (which pods the Deployment adopts) and the mutable template labels (which labels new pods receive). Only the template can be changed.",
    whatFixedIt:
      "Leaving spec.selector as {app: search} and adding tier: api to spec.template.metadata.labels let the controller create pods that carry tier: api, which then matched search-svc.",
    prevention:
      "Design selectors up front (ideally a single stable label like app) and propagate routing or tier labels through the pod template. Never attempt to mutate a Deployment selector in place: if it must change, migrate to a new Deployment.",
    relatedConcepts: ["deployments", "labels-selectors", "rollouts"],
    recommendedNextSlugs: ["zombie-replicaset"],
  },
} satisfies ProblemLevel;
