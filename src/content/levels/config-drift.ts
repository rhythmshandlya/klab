import type { ProblemLevel } from "@/lib/domain/types";

import { PUBLISHED_PROBLEM_V1 } from "./metadata";

/**
 * Level: Config Drift.
 *
 * A config change set PORT=9090 on the container, but everything else: probes,
 * containerPort, Service targetPort: still says 8080. The app honestly reports its
 * port in the logs; nothing else agrees with it. Teaches coherence between env
 * config, probes, and Service ports. Fix: remove (or correct) the drifted PORT env.
 *
 * (The reference design calls this slot "ConfigMap Drift": the simulator has no
 * ConfigMap support, so the same drift story is told through env config.)
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
          env:
            - name: PORT
              value: "9090"
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

export const configDrift = {
  id: "config-drift",
  slug: "config-drift",
  ...PUBLISHED_PROBLEM_V1,
  title: "Config Drift",
  difficulty: "advanced",
  severity: "high",
  xp: 200,
  estimatedMinutes: 30,
  successRate: 37,
  concepts: ["deployments", "networking", "readiness-probes", "debugging"],
  blurb: "One config value moved and nothing else was told. Now nothing agrees.",
  story:
    "A 'standardization' PR from three weeks ago is finally rolling out, and web-app is down. The manifest looks textbook: probe on 8080, containerPort 8080, Service targeting 8080: all beautifully consistent. The app disagrees with all of them, and it left you a note saying exactly where it went.",
  objective: "Bring the app, its probes, and the Service back into agreement (HTTP 200).",
  learningObjectives: [
    "Compare declared ports with the process's observed listener.",
    "Repair one source of configuration drift without weakening readiness checks.",
  ],
  prerequisites: ["port-routing-bug", "broken-readiness-probe"],
  learningPaths: ["application-debugging", "reliability"],
  capabilities: ["pods", "services", "deployments", "events", "logs", "http-probes"],
  engine: { kind: "webernetes" },
  constraints: [
    {
      id: "edit-deploy-only",
      label: "Only edit deployment.yaml",
      kind: "editable-files",
      paths: ["deployment.yaml"],
    },
    {
      id: "keep-ports",
      label: "Keep the image, probe, and container port on the intended contract",
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
        {
          path: "spec.template.spec.containers.0.ports.0.containerPort",
          operator: "equals",
          value: 8080,
        },
        {
          path: "spec.template.spec.containers.0.readinessProbe.httpGet.path",
          operator: "equals",
          value: "/healthz",
        },
        {
          path: "spec.template.spec.containers.0.readinessProbe.httpGet.port",
          operator: "equals",
          value: 8080,
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
    { id: "command-1", command: "kubectl get pods" },
    {
      id: "command-2",
      command: "kubectl logs <pod>",
      target: {
        kind: "pod",
        namespace: "default",
        selector: { app: "web-app" },
        prefer: "not-ready",
      },
    },
    {
      id: "command-3",
      command: "kubectl describe pod <pod>",
      target: {
        kind: "pod",
        namespace: "default",
        selector: { app: "web-app" },
        prefer: "not-ready",
      },
    },
    { id: "command-4", command: "kubectl get endpoints web-svc" },
  ],
  probeTargets: ["http://web-svc/", "http://web-svc/healthz"],
  validators: [
    {
      id: "pods-ready",
      title: "App pods are Ready",
      successLabel: "The web-app pods are Ready",
      failureLabel: "The web-app pods are not Ready",
      kind: "pod-ready-by-selector",
      namespace: "default",
      selector: { app: "web-app" },
      minReady: 2,
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
      title: "The manifest can be consistent AND wrong",
      body: "Probe, containerPort, Service: all say 8080, all agree. The only voice missing is the app's own. `kubectl logs <pod>`, which port does it SAY it's listening on?",
      xpPenalty: 40,
    },
    {
      id: "hint-2",
      title: "Who told it 9090?",
      body: "The app reads a PORT environment variable. `kubectl describe pod <pod>` shows the container's env. Compare that with everything else in the spec.",
      xpPenalty: 60,
      unlockAfter: ["r-listen-9090"],
    },
    {
      id: "hint-3",
      title: "Undo the drift",
      body: 'PORT=9090 overrides the app\'s default of 8080, while probes and the Service still point at 8080. Remove the PORT env (or set it to "8080") in deployment.yaml and Apply.',
      xpPenalty: 80,
      unlockAfter: ["r-port-env"],
    },
  ],
  evidenceRules: [
    {
      id: "r-not-ready",
      evidenceId: "not-ready",
      label: "Pods are Running but never Ready",
      hiddenLabel: "Pod readiness inspected",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get pods", outputMatches: "0/1\\s+Running" },
    },
    {
      id: "r-listen-9090",
      evidenceId: "listen-9090",
      label: "The app logs: listening on :9090",
      hiddenLabel: "App logs read",
      source: "logs",
      trigger: { type: "log", podMatches: "^web-app-", messageMatches: "listening on :9090" },
    },
    {
      id: "r-probe-8080",
      evidenceId: "probe-8080",
      label: "The readiness probe targets port 8080",
      hiddenLabel: "Probe configuration inspected",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "describe pod",
        outputMatches: "Readiness:\\s+http-get /healthz port 8080",
      },
    },
    {
      id: "r-port-env",
      evidenceId: "port-env",
      label: "The container env sets PORT: 9090",
      hiddenLabel: "Container environment inspected",
      source: "terminal",
      trigger: { type: "command", commandMatches: "describe pod", outputMatches: "PORT:\\s+9090" },
    },
    {
      id: "r-probe-event",
      evidenceId: "probe-failing",
      label: "Readiness probes are failing (nothing answers on 8080)",
      hiddenLabel: "Recent events reviewed",
      source: "events",
      trigger: { type: "event-reason", reason: "Unhealthy" },
    },
  ],
  postSolveExplanation: {
    rootCause:
      "A PORT=9090 env var made the app listen on 9090 while the probe, containerPort, and Service all still pointed at 8080.",
    whyItFailed:
      "Config drift: one value moved and its dependents didn't. The app (honestly) bound :9090; the kubelet probed :8080 and found nothing, so pods never went Ready and the Service had no endpoints. Every declared port agreed with every other declared port: just not with reality.",
    whatFixedIt:
      "Removing the drifted PORT env restored the app's default of 8080, matching the probe and the Service's targetPort. Pods went Ready and traffic flowed.",
    prevention:
      "Own runtime ports in one configuration source, render probes and Services from it, and verify the live listener during rollout smoke tests.",
    relatedConcepts: ["deployments", "readiness-probes", "networking"],
    recommendedNextSlugs: ["broken-service-chain"],
  },
} satisfies ProblemLevel;
