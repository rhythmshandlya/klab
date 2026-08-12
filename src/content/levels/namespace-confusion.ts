import type { ProblemLevel } from "@/lib/domain/types";

import { PUBLISHED_PROBLEM_V1 } from "./metadata";

/**
 * Level: Namespace Confusion.
 *
 * checkout moved into its own `shop` namespace, but the storefront (in `default`)
 * still calls `http://checkout-svc/`: a name that only resolves inside `shop`.
 * Teaches namespace-relative DNS. Fix: point UPSTREAM_URL at `checkout-svc.shop`.
 */

const STOREFRONT_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: storefront
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: storefront
  template:
    metadata:
      labels:
        app: storefront
    spec:
      containers:
        - name: storefront
          image: klab/api:1.0.0
          env:
            - name: UPSTREAM_URL
              value: http://checkout-svc/
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

const NAMESPACE_YAML = `apiVersion: v1
kind: Namespace
metadata:
  name: shop
`;

const CHECKOUT_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout
  namespace: shop
spec:
  replicas: 1
  selector:
    matchLabels:
      app: checkout
  template:
    metadata:
      labels:
        app: checkout
    spec:
      containers:
        - name: checkout
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
---
apiVersion: v1
kind: Service
metadata:
  name: checkout-svc
  namespace: shop
spec:
  selector:
    app: checkout
  ports:
    - name: http
      port: 80
      targetPort: 8080
`;

const STOREFRONT_SVC_YAML = `apiVersion: v1
kind: Service
metadata:
  name: storefront-svc
  namespace: default
spec:
  selector:
    app: storefront
  ports:
    - name: http
      port: 80
      targetPort: 8080
`;

export const namespaceConfusion = {
  id: "namespace-confusion",
  slug: "namespace-confusion",
  ...PUBLISHED_PROBLEM_V1,
  title: "Namespace Confusion",
  difficulty: "beginner",
  severity: "medium",
  xp: 100,
  estimatedMinutes: 20,
  successRate: 72,
  concepts: ["namespaces", "dns", "services", "debugging"],
  blurb: "A service moved to its own namespace, and now nobody can find it.",
  story:
    "Platform split checkout into its own namespace last sprint: cleaner ownership, they said. Since the migration, every checkout call from the storefront fails. The checkout pods themselves? Perfectly healthy. The storefront pods? Also healthy. And yet.",
  objective: "Make the storefront reach checkout again (storefront-svc returns HTTP 200).",
  learningObjectives: [
    "Apply Kubernetes search-domain rules to short and qualified Service names.",
    "Debug a dependency that moved across namespace boundaries.",
  ],
  prerequisites: [],
  learningPaths: ["kubernetes-foundations", "networking"],
  capabilities: ["pods", "services", "deployments", "namespaces", "dns", "logs", "http-probes"],
  engine: { kind: "webernetes" },
  constraints: [
    {
      id: "edit-storefront",
      label: "Only edit storefront.yaml",
      kind: "editable-files",
      paths: ["storefront.yaml"],
    },
    {
      id: "keep-namespaces",
      label: "Keep the storefront workload in default and checkout in shop",
      kind: "manifest",
      file: "storefront.yaml",
      resource: { kind: "Deployment", name: "storefront", namespace: "default" },
      exclusive: true,
      assertions: [
        {
          path: "spec.template.spec.containers.0.image",
          operator: "equals",
          value: "klab/api:1.0.0",
        },
        { path: "spec.template.metadata.labels.app", operator: "equals", value: "storefront" },
        { path: "spec.replicas", operator: "gte", value: 1 },
      ],
    },
  ],
  files: [
    {
      path: "storefront.yaml",
      language: "yaml",
      initialValue: STOREFRONT_YAML,
      access: "editable",
      applyAtBoot: true,
    },
    {
      path: "namespace.yaml",
      language: "yaml",
      initialValue: NAMESPACE_YAML,
      access: "hidden",
      applyAtBoot: true,
    },
    {
      path: "checkout.yaml",
      language: "yaml",
      initialValue: CHECKOUT_YAML,
      access: "readonly",
      applyAtBoot: true,
    },
    {
      path: "storefront-svc.yaml",
      language: "yaml",
      initialValue: STOREFRONT_SVC_YAML,
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
        selector: { app: "storefront" },
        prefer: "first",
      },
    },
    { id: "command-3", command: "kubectl get namespaces" },
    { id: "command-4", command: "kubectl get svc -n shop" },
    { id: "command-5", command: "dig checkout-svc" },
  ],
  probeTargets: ["http://storefront-svc/", "http://checkout-svc.shop/"],
  validators: [
    {
      id: "storefront-200",
      title: "Storefront reaches checkout",
      successLabel: "GET / through storefront-svc returns 200",
      failureLabel: "storefront-svc cannot reach its upstream",
      kind: "http-get-through-service",
      namespace: "default",
      service: "storefront-svc",
      port: 80,
      path: "/",
      expectStatus: 200,
    },
    {
      id: "checkout-endpoints",
      title: "Checkout is serving",
      successLabel: "checkout-svc (shop) has ready endpoints",
      failureLabel: "checkout-svc (shop) has no ready endpoints",
      kind: "service-has-ready-endpoints",
      namespace: "shop",
      name: "checkout-svc",
      minReadyEndpoints: 1,
    },
    {
      id: "storefront-ready",
      title: "Storefront pods are Ready",
      successLabel: "The storefront pods are Ready",
      failureLabel: "The storefront pods are not Ready",
      kind: "pod-ready-by-selector",
      namespace: "default",
      selector: { app: "storefront" },
      minReady: 1,
    },
  ],
  hints: [
    {
      id: "hint-1",
      title: "Healthy pods, failing calls",
      body: "Both apps are Ready: the failure is in the storefront's OUTBOUND call. Read what the storefront itself says: `kubectl logs <storefront-pod>`.",
      xpPenalty: 15,
    },
    {
      id: "hint-2",
      title: "Where does checkout actually live?",
      body: "`kubectl get namespaces`, then `kubectl get svc -n shop`. Is checkout-svc where the storefront thinks it is? `dig checkout-svc` shows the full DNS name it resolves to.",
      xpPenalty: 25,
      unlockAfter: ["r-upstream-fail"],
    },
    {
      id: "hint-3",
      title: "DNS is namespace-relative",
      body: "A bare service name like `checkout-svc` only resolves inside its own namespace. From default you must say `checkout-svc.shop`. Update UPSTREAM_URL in storefront.yaml and Apply.",
      xpPenalty: 35,
      unlockAfter: ["r-shop-ns"],
    },
  ],
  evidenceRules: [
    {
      id: "r-pods-ready",
      evidenceId: "pods-ready",
      label: "Storefront pods are Running and Ready",
      hiddenLabel: "Pod status checked",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get pods", outputMatches: "1/1\\s+Running" },
    },
    {
      id: "r-upstream-fail",
      evidenceId: "upstream-fail",
      label: "Storefront logs: the upstream call fails",
      hiddenLabel: "Storefront logs read",
      source: "logs",
      trigger: { type: "log", podMatches: "^storefront-", messageMatches: "upstream call failed" },
    },
    {
      id: "r-502",
      evidenceId: "storefront-502",
      label: "storefront-svc answers 502 Bad Gateway",
      hiddenLabel: "Storefront reachability tested",
      source: "network",
      trigger: { type: "probe", hostMatches: "^storefront-svc$", pathMatches: "^/$", status: 502 },
    },
    {
      id: "r-shop-ns",
      evidenceId: "shop-ns",
      label: "There is a second namespace: shop",
      hiddenLabel: "Cluster namespaces listed",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "get (ns|namespaces)",
        outputMatches: "shop",
      },
    },
    {
      id: "r-checkout-in-shop",
      evidenceId: "checkout-in-shop",
      label: "checkout-svc lives in the shop namespace",
      hiddenLabel: "Services per namespace listed",
      source: "terminal",
      trigger: {
        type: "command",
        commandMatches: "(-n|--namespace[= ])\\s*shop|dig checkout-svc",
        outputMatches: "checkout(-svc)?",
      },
    },
  ],
  postSolveExplanation: {
    rootCause:
      "The storefront called http://checkout-svc/: a bare name that only resolves inside the shop namespace, not from default.",
    whyItFailed:
      "Kubernetes DNS is namespace-relative: `checkout-svc` expands to checkout-svc.<caller's namespace>.svc.cluster.local. From default that name doesn't exist, so every upstream call failed DNS resolution and the storefront returned 502.",
    whatFixedIt:
      "Using the namespace-qualified name (http://checkout-svc.shop/) resolves from anywhere in the cluster. The storefront reached checkout and requests completed.",
    prevention:
      "Treat namespace moves as dependency contract changes, use qualified names across namespaces, and exercise DNS resolution in pre-deploy smoke tests.",
    relatedConcepts: ["namespaces", "dns", "services"],
    recommendedNextSlugs: ["dns-resolution-failure"],
  },
} satisfies ProblemLevel;
