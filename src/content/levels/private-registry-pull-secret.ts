import type { ProblemLevel } from "@/lib/domain/types";

const DEPLOYMENT_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: private-api
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: private-api
  template:
    metadata:
      labels:
        app: private-api
    spec:
      containers:
        - name: api
          image: registry.example/private/api:1.0.0
          ports:
            - name: http
              containerPort: 8080
`;

const SECRET_YAML = `apiVersion: v1
kind: Secret
metadata:
  name: registry-credentials
  namespace: default
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: <redacted>
`;

export const privateRegistryPullSecret = {
  id: "private-registry-pull-secret",
  slug: "private-registry-pull-secret",
  title: "Private Registry Pull Secret",
  difficulty: "intermediate",
  severity: "high",
  xp: 150,
  estimatedMinutes: 25,
  successRate: 54,
  concepts: ["pods", "deployments", "secrets", "events", "debugging"],
  blurb: "The image exists and the credentials exist, but the kubelet cannot use either.",
  story:
    "A private API release is stuck before the process can start. The registry team confirms the image and credentials are valid. Kubernetes keeps backing off the pull because the Pod was never told which credential Secret to use.",
  objective: "Make the private-api Pod pull its image, become Ready, and serve HTTP 200.",
  engine: { kind: "scripted", scenarioId: "private-registry-pull" },
  constraints: [
    {
      id: "edit-deployment-only",
      label: "Only edit deployment.yaml; the registry credential Secret is correct",
      kind: "editable-files",
      paths: ["deployment.yaml"],
    },
    {
      id: "keep-private-image",
      label: "Keep the private image and attach the existing registry credential",
      kind: "manifest",
      file: "deployment.yaml",
      resource: { kind: "Deployment", name: "private-api" },
      exclusive: true,
      assertions: [
        {
          path: "spec.template.spec.containers.0.image",
          operator: "equals",
          value: "registry.example/private/api:1.0.0",
        },
        {
          path: "spec.template.spec.imagePullSecrets.0.name",
          operator: "equals",
          value: "registry-credentials",
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
      path: "registry-credentials.yaml",
      language: "yaml",
      initialValue: SECRET_YAML,
      access: "readonly",
      applyAtBoot: false,
    },
  ],
  quickCommands: [
    { id: "pods", command: "kubectl get pods" },
    {
      id: "describe-pod",
      command: "kubectl describe pod <pod>",
      target: {
        kind: "pod",
        namespace: "default",
        selector: { app: "private-api" },
        prefer: "not-ready",
      },
    },
    { id: "events", command: "kubectl get events" },
    { id: "deployment", command: "kubectl describe deployment private-api" },
  ],
  probeTargets: ["http://private-api-svc/"],
  validators: [
    {
      id: "private-api-ready",
      title: "Private API Pod is Ready",
      successLabel: "The private-api Pod is Ready",
      failureLabel: "The private-api Pod cannot start",
      kind: "pod-ready-by-selector",
      namespace: "default",
      selector: { app: "private-api" },
      minReady: 1,
    },
    {
      id: "private-api-endpoint",
      title: "Service has a ready endpoint",
      successLabel: "private-api-svc has a ready endpoint",
      failureLabel: "private-api-svc has no ready endpoint",
      kind: "service-has-ready-endpoints",
      namespace: "default",
      name: "private-api-svc",
      minReadyEndpoints: 1,
    },
    {
      id: "private-api-http",
      title: "Private API serves traffic",
      successLabel: "GET / through private-api-svc returns 200",
      failureLabel: "private-api-svc returns 503",
      kind: "http-get-through-service",
      namespace: "default",
      service: "private-api-svc",
      port: 80,
      path: "/",
      expectStatus: 200,
    },
  ],
  hints: [
    {
      id: "hint-1",
      title: "The process never starts",
      body: "A Pending Pod with ImagePullBackOff has not reached your entrypoint. Inspect Pod status and pull events before looking for application logs.",
      xpPenalty: 25,
    },
    {
      id: "hint-2",
      title: "The Secret is not automatic",
      body: "A docker-registry Secret can exist in the namespace without being used. The Pod spec must reference it for image pulls.",
      xpPenalty: 40,
      unlockAfter: ["r-pull-event"],
    },
    {
      id: "hint-3",
      title: "Pod-level pull credentials",
      body: "Add imagePullSecrets under spec.template.spec and reference registry-credentials by name.",
      xpPenalty: 60,
      unlockAfter: ["r-secret-view"],
    },
  ],
  evidenceRules: [
    {
      id: "r-image-pull-backoff",
      evidenceId: "image-pull-backoff",
      label: "The Pod is blocked in ImagePullBackOff",
      hiddenLabel: "Pod status checked",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "get pods",
        outputMatches: "ImagePullBackOff|Pending",
      },
    },
    {
      id: "r-pull-event",
      evidenceId: "pull-event",
      label: "Kubelet cannot find registry-credentials while pulling the image",
      hiddenLabel: "Image pull events reviewed",
      source: "events",
      trigger: { type: "event-reason", reason: "Failed", messageMatches: "registry-credentials" },
    },
    {
      id: "r-secret-view",
      evidenceId: "secret-reference-missing",
      label: "The private-api Pod has no image pull Secret attached",
      hiddenLabel: "Pod configuration inspected",
      source: "object-explorer",
      trigger: {
        type: "object-view",
        kind: "Pod",
        nameMatches: "^private-api-",
        namespace: "default",
      },
    },
    {
      id: "r-service-503",
      evidenceId: "service-503",
      label: "private-api-svc has no ready backend",
      hiddenLabel: "Service reachability tested",
      source: "network",
      trigger: {
        type: "probe",
        hostMatches: "^private-api-svc$",
        pathMatches: "^/$",
        status: 503,
      },
    },
  ],
  postSolveExplanation: {
    rootCause:
      "The Deployment referenced a private image but its Pod template did not reference the existing docker-registry Secret.",
    whyItFailed:
      "Image pulls happen before the container starts. Without imagePullSecrets, the kubelet attempted an anonymous registry pull, received an authorization failure, and backed off. No application logs could exist yet.",
    whatFixedIt:
      "Attaching registry-credentials through spec.template.spec.imagePullSecrets let the kubelet authenticate, pull the image, and start the Pod.",
    relatedConcepts: ["pods", "secrets", "events"],
  },
} satisfies ProblemLevel;
