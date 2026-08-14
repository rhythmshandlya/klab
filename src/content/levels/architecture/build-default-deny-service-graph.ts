import type { ArchitectureBuildSpec } from "./spec";
import { emptyObject, eq, gte, includes, present } from "./spec";

export const buildDefaultDenyServiceGraph: ArchitectureBuildSpec = {
  id: "build-default-deny-service-graph",
  title: "Build a Default-Deny Service Graph",
  severity: "critical",
  estimatedMinutes: 70,
  successRate: 28,
  concepts: ["network-policies", "namespaces", "dns", "services", "labels-selectors"],
  capabilities: ["pods", "services", "deployments", "namespaces", "network-policy", "dns"],
  blurb: "Express a least-connectivity service graph where every unspecified path is denied.",
  story:
    "A retail namespace runs a web frontend and an orders API. Security requires default-deny ingress and egress, but the frontend must resolve DNS and call only the orders Service. Orders must accept traffic only from the frontend. The policy set must fail closed without silently breaking name resolution, and it must not permit broad namespace access.",
  objective:
    "Build the two-service workload and a default-deny policy set that permits frontend-to-orders traffic and DNS while denying every other ingress and egress path.",
  learningObjectives: [
    "Translate a service dependency graph into selecting and peer NetworkPolicies.",
    "Preserve DNS under default-deny egress without opening arbitrary network access.",
    "Use stable workload and namespace labels as enforceable security identities.",
  ],
  prerequisites: ["namespace-confusion", "dns-resolution-failure", "broken-service-chain"],
  files: [
    {
      path: "namespace.yaml",
      apiVersion: "v1",
      kind: "Namespace",
      name: "shop",
      label: "Label the isolated workload namespace for explicit policy selection",
      assertions: [
        eq("metadata.labels.isolation", "default-deny"),
        eq("metadata.labels.owner", "retail"),
      ],
      solution: `apiVersion: v1
kind: Namespace
metadata:
  name: shop
  labels:
    kubernetes.io/metadata.name: shop
    owner: retail
    isolation: default-deny
`,
    },
    {
      path: "frontend.yaml",
      apiVersion: "apps/v1",
      kind: "Deployment",
      name: "frontend",
      namespace: "shop",
      label: "Give the frontend a stable identity and bounded runtime",
      assertions: [
        gte("spec.replicas", 2),
        eq("spec.template.metadata.labels.app", "frontend"),
        present("spec.template.spec.containers[name=web].resources.requests.cpu"),
      ],
      solution: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: shop
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: web
          image: registry.example/frontend:1.0.0
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
`,
    },
    {
      path: "orders.yaml",
      apiVersion: "apps/v1",
      kind: "Deployment",
      name: "orders",
      namespace: "shop",
      label: "Give the orders API a distinct policy identity and readiness contract",
      assertions: [
        gte("spec.replicas", 2),
        eq("spec.template.metadata.labels.app", "orders"),
        present("spec.template.spec.containers[name=api].readinessProbe"),
      ],
      solution: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: orders
  namespace: shop
spec:
  replicas: 2
  selector:
    matchLabels:
      app: orders
  template:
    metadata:
      labels:
        app: orders
    spec:
      containers:
        - name: api
          image: registry.example/orders:1.0.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /readyz
              port: http
`,
    },
    {
      path: "orders-service.yaml",
      apiVersion: "v1",
      kind: "Service",
      name: "orders",
      namespace: "shop",
      label: "Route orders traffic only to Pods carrying the orders identity",
      assertions: [
        eq("spec.selector.app", "orders"),
        eq("spec.ports[name=http].targetPort", "http"),
      ],
      solution: `apiVersion: v1
kind: Service
metadata:
  name: orders
  namespace: shop
spec:
  selector:
    app: orders
  ports:
    - name: http
      port: 80
      targetPort: http
`,
    },
    {
      path: "default-deny.yaml",
      apiVersion: "networking.k8s.io/v1",
      kind: "NetworkPolicy",
      name: "default-deny",
      namespace: "shop",
      label: "Select every Pod and deny both ingress and egress by default",
      assertions: [
        emptyObject("spec.podSelector"),
        includes("spec.policyTypes", "Ingress"),
        includes("spec.policyTypes", "Egress"),
      ],
      solution: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: shop
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
`,
    },
    {
      path: "frontend-egress.yaml",
      apiVersion: "networking.k8s.io/v1",
      kind: "NetworkPolicy",
      name: "frontend-egress",
      namespace: "shop",
      label: "Permit frontend egress only to orders and cluster DNS",
      assertions: [
        eq("spec.podSelector.matchLabels.app", "frontend"),
        eq("spec.egress.0.to.0.podSelector.matchLabels.app", "orders"),
        eq("spec.egress.1.ports.0.port", 53),
        eq("spec.egress.1.ports.0.protocol", "UDP"),
      ],
      solution: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: frontend-egress
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: frontend
  policyTypes:
    - Egress
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: orders
      ports:
        - protocol: TCP
          port: 8080
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53
`,
    },
    {
      path: "orders-ingress.yaml",
      apiVersion: "networking.k8s.io/v1",
      kind: "NetworkPolicy",
      name: "orders-ingress",
      namespace: "shop",
      label: "Permit orders ingress only from the frontend identity on the API port",
      assertions: [
        eq("spec.podSelector.matchLabels.app", "orders"),
        eq("spec.ingress.0.from.0.podSelector.matchLabels.app", "frontend"),
        eq("spec.ingress.0.ports[port=8080].port", 8080),
      ],
      solution: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: orders-ingress
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: orders
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - protocol: TCP
          port: 8080
`,
    },
  ],
  semanticPolicy: {
    networkPolicyContracts: [
      {
        name: "default-deny",
        namespace: "shop",
        podSelector: {},
        policyTypes: ["Ingress", "Egress"],
      },
      {
        name: "frontend-egress",
        namespace: "shop",
        podSelector: { app: "frontend" },
        policyTypes: ["Egress"],
        egress: [
          { podSelector: { app: "orders" }, port: { protocol: "TCP", port: 8080 } },
          {
            namespaceSelector: { "kubernetes.io/metadata.name": "kube-system" },
            podSelector: { "k8s-app": "kube-dns" },
            port: { protocol: "UDP", port: 53 },
          },
          {
            namespaceSelector: { "kubernetes.io/metadata.name": "kube-system" },
            podSelector: { "k8s-app": "kube-dns" },
            port: { protocol: "TCP", port: 53 },
          },
        ],
      },
      {
        name: "orders-ingress",
        namespace: "shop",
        podSelector: { app: "orders" },
        policyTypes: ["Ingress"],
        ingress: [{ podSelector: { app: "frontend" }, port: { protocol: "TCP", port: 8080 } }],
      },
    ],
  },
  hintBodies: [
    "Start with the negative contract. Select every Pod for both policy directions, then add only the edges shown in the service graph.",
    "A DNS name is not a network-policy peer. Allow the kube-system DNS Pods on both UDP and TCP port 53 while keeping other destinations closed.",
    "Ingress permission on orders does not grant frontend egress. Both selected Pods must have the direction required by the connection once default deny is active.",
  ],
  review: {
    risk: "The starter repository had no enforceable trust boundaries, so any compromised Pod could scan peers, reach orders, or exfiltrate data.",
    reasoning:
      "NetworkPolicy is additive and directional. Default deny creates the boundary, while separate ingress and egress rules must deliberately reconstruct DNS and the one approved frontend-to-orders edge.",
    accepted:
      "The accepted graph isolates the namespace, grants frontend DNS and orders access, and grants orders ingress only from the labeled frontend workload.",
    tradeoffs:
      "Label identity is simple and auditable but depends on admission controls preventing untrusted workloads from claiming privileged labels. Production platforms should pair these policies with namespace and workload governance.",
  },
  docsHref: "/docs/operations/network-policies",
  recommendedNextSlugs: ["build-multi-team-gateway"],
};
