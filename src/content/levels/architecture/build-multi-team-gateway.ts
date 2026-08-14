import type { ArchitectureBuildSpec } from "./spec";
import { eq, gte, includes, lengthEquals, matches, present } from "./spec";

export const buildMultiTeamGateway: ArchitectureBuildSpec = {
  id: "build-multi-team-gateway",
  title: "Build a Multi-Team Gateway",
  severity: "high",
  estimatedMinutes: 70,
  successRate: 27,
  concepts: ["gateway-api", "ingress", "services", "namespaces", "secrets", "networking"],
  capabilities: ["services", "namespaces", "secrets", "http-probes"],
  blurb: "Share one TLS edge while preserving team ownership and route isolation.",
  story:
    "Platform engineering must provide one managed HTTPS gateway for the catalog and payments teams. Each team owns its route in its own namespace, while the platform owns TLS and listener policy. The cluster already has Envoy Gateway, cert-manager, and a ClusterIssuer named letsencrypt-prod. Envoy Gateway is configured with its default controller name. The edge must reject plain HTTP, isolate hostnames, and prevent one team from silently attaching routes outside the approved namespace set. The monthly gateway budget permits one shared data plane, not a gateway per team.",
  objective:
    "Build a shared Gateway API edge with platform-owned TLS, namespace-scoped route delegation, and independent catalog and payments host routing.",
  learningObjectives: [
    "Separate Gateway infrastructure ownership from application route ownership.",
    "Use listener allowedRoutes and namespace labels to enforce delegation boundaries.",
    "Attach TLS and host-specific HTTPRoutes without granting teams access to the certificate Secret.",
  ],
  prerequisites: ["port-routing-bug", "namespace-confusion", "broken-service-chain"],
  files: [
    {
      path: "gateway-class.yaml",
      apiVersion: "gateway.networking.k8s.io/v1",
      kind: "GatewayClass",
      name: "klab-managed",
      label: "Select the platform-managed Gateway controller",
      assertions: [eq("spec.controllerName", "gateway.envoyproxy.io/gatewayclass-controller")],
      solution: `apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: klab-managed
spec:
  controllerName: gateway.envoyproxy.io/gatewayclass-controller
`,
    },
    {
      path: "gateway-namespace.yaml",
      apiVersion: "v1",
      kind: "Namespace",
      name: "gateway-system",
      label: "Create the restricted platform namespace that owns the shared Gateway",
      assertions: [
        eq("metadata.labels.owner", "platform-networking"),
        eq("/metadata/labels/pod-security.kubernetes.io~1enforce", "restricted"),
        { path: "metadata.labels.gateway-access", operator: "absent" },
      ],
      solution: `apiVersion: v1
kind: Namespace
metadata:
  name: gateway-system
  labels:
    owner: platform-networking
    pod-security.kubernetes.io/enforce: restricted
`,
    },
    {
      path: "catalog-namespace.yaml",
      apiVersion: "v1",
      kind: "Namespace",
      name: "catalog-team",
      label: "Mark the catalog namespace as approved to attach application routes",
      assertions: [
        eq("metadata.labels.gateway-access", "shared-edge"),
        eq("metadata.labels.owner", "catalog"),
      ],
      solution: `apiVersion: v1
kind: Namespace
metadata:
  name: catalog-team
  labels:
    gateway-access: shared-edge
    owner: catalog
`,
    },
    {
      path: "payments-namespace.yaml",
      apiVersion: "v1",
      kind: "Namespace",
      name: "payments-team",
      label: "Mark the payments namespace as approved to attach application routes",
      assertions: [
        eq("metadata.labels.gateway-access", "shared-edge"),
        eq("metadata.labels.owner", "payments"),
      ],
      solution: `apiVersion: v1
kind: Namespace
metadata:
  name: payments-team
  labels:
    gateway-access: shared-edge
    owner: payments
`,
    },
    {
      path: "catalog-deployment.yaml",
      apiVersion: "apps/v1",
      kind: "Deployment",
      name: "catalog-api",
      namespace: "catalog-team",
      label: "Run a Ready catalog backend carrying the Service identity",
      assertions: [
        gte("spec.replicas", 2),
        eq("spec.template.metadata.labels.app", "catalog-api"),
        matches("spec.template.spec.containers[name=catalog].image", "@sha256:[a-f0-9]{64}$"),
        lengthEquals("spec.template.spec.containers[name=catalog].ports", 1),
        eq("spec.template.spec.containers[name=catalog].ports[name=http].containerPort", 8080),
        eq("spec.template.spec.containers[name=catalog].readinessProbe.httpGet.path", "/readyz"),
        eq("spec.template.spec.containers[name=catalog].readinessProbe.httpGet.port", "http"),
        present("spec.template.spec.containers[name=catalog].resources.requests.cpu"),
      ],
      solution: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: catalog-api
  namespace: catalog-team
spec:
  replicas: 2
  selector:
    matchLabels:
      app: catalog-api
  template:
    metadata:
      labels:
        app: catalog-api
    spec:
      containers:
        - name: catalog
          image: registry.example/catalog@sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /readyz
              port: http
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
      path: "payments-deployment.yaml",
      apiVersion: "apps/v1",
      kind: "Deployment",
      name: "payments-api",
      namespace: "payments-team",
      label: "Run a Ready payments backend carrying the Service identity",
      assertions: [
        gte("spec.replicas", 2),
        eq("spec.template.metadata.labels.app", "payments-api"),
        matches("spec.template.spec.containers[name=payments].image", "@sha256:[a-f0-9]{64}$"),
        lengthEquals("spec.template.spec.containers[name=payments].ports", 1),
        eq("spec.template.spec.containers[name=payments].ports[name=http].containerPort", 8080),
        eq("spec.template.spec.containers[name=payments].readinessProbe.httpGet.path", "/readyz"),
        eq("spec.template.spec.containers[name=payments].readinessProbe.httpGet.port", "http"),
        present("spec.template.spec.containers[name=payments].resources.requests.cpu"),
      ],
      solution: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: payments-api
  namespace: payments-team
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
        - name: payments
          image: registry.example/payments@sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /readyz
              port: http
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
      path: "catalog-service.yaml",
      apiVersion: "v1",
      kind: "Service",
      name: "catalog-api",
      namespace: "catalog-team",
      label: "Provide the declared catalog HTTPRoute backend on its named port",
      assertions: [
        eq("spec.selector.app", "catalog-api"),
        matches("spec.type", "^(?:ClusterIP)?$"),
        lengthEquals("spec.ports", 1),
        eq("spec.ports[name=http].port", 8080),
        eq("spec.ports[name=http].targetPort", "http"),
      ],
      solution: `apiVersion: v1
kind: Service
metadata:
  name: catalog-api
  namespace: catalog-team
spec:
  selector:
    app: catalog-api
  ports:
    - name: http
      port: 8080
      targetPort: http
`,
    },
    {
      path: "payments-service.yaml",
      apiVersion: "v1",
      kind: "Service",
      name: "payments-api",
      namespace: "payments-team",
      label: "Provide the declared payments HTTPRoute backend on its named port",
      assertions: [
        eq("spec.selector.app", "payments-api"),
        matches("spec.type", "^(?:ClusterIP)?$"),
        lengthEquals("spec.ports", 1),
        eq("spec.ports[name=http].port", 8080),
        eq("spec.ports[name=http].targetPort", "http"),
      ],
      solution: `apiVersion: v1
kind: Service
metadata:
  name: payments-api
  namespace: payments-team
spec:
  selector:
    app: payments-api
  ports:
    - name: http
      port: 8080
      targetPort: http
`,
    },
    {
      path: "certificate.yaml",
      apiVersion: "cert-manager.io/v1",
      kind: "Certificate",
      name: "shared-edge-tls",
      namespace: "gateway-system",
      label: "Issue and renew the shared edge certificate in the platform namespace",
      assertions: [
        eq("spec.secretName", "shared-edge-tls"),
        eq("spec.issuerRef.kind", "ClusterIssuer"),
        eq("spec.issuerRef.name", "letsencrypt-prod"),
        lengthEquals("spec.dnsNames", 2),
        includes("spec.dnsNames", "catalog.example.com"),
        includes("spec.dnsNames", "pay.example.com"),
      ],
      solution: `apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: shared-edge-tls
  namespace: gateway-system
spec:
  secretName: shared-edge-tls
  issuerRef:
    kind: ClusterIssuer
    name: letsencrypt-prod
  dnsNames:
    - catalog.example.com
    - pay.example.com
`,
    },
    {
      path: "gateway.yaml",
      apiVersion: "gateway.networking.k8s.io/v1",
      kind: "Gateway",
      name: "shared-edge",
      namespace: "gateway-system",
      label: "Expose one HTTPS listener with TLS and label-based route delegation",
      assertions: [
        eq("spec.gatewayClassName", "klab-managed"),
        lengthEquals("spec.listeners", 1),
        eq("spec.listeners[name=https].protocol", "HTTPS"),
        eq("spec.listeners[name=https].port", 443),
        eq("spec.listeners[name=https].tls.mode", "Terminate"),
        lengthEquals("spec.listeners[name=https].tls.certificateRefs", 1),
        matches("spec.listeners[name=https].tls.certificateRefs.0.group", "^$"),
        matches("spec.listeners[name=https].tls.certificateRefs.0.kind", "^(?:Secret)?$"),
        eq("spec.listeners[name=https].tls.certificateRefs.0.name", "shared-edge-tls"),
        eq("spec.listeners[name=https].allowedRoutes.namespaces.from", "Selector"),
        eq(
          "spec.listeners[name=https].allowedRoutes.namespaces.selector.matchLabels.gateway-access",
          "shared-edge",
        ),
      ],
      solution: `apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: shared-edge
  namespace: gateway-system
spec:
  gatewayClassName: klab-managed
  listeners:
    - name: https
      protocol: HTTPS
      port: 443
      tls:
        mode: Terminate
        certificateRefs:
          - kind: Secret
            name: shared-edge-tls
      allowedRoutes:
        namespaces:
          from: Selector
          selector:
            matchLabels:
              gateway-access: shared-edge
`,
    },
    {
      path: "catalog-route.yaml",
      apiVersion: "gateway.networking.k8s.io/v1",
      kind: "HTTPRoute",
      name: "catalog",
      namespace: "catalog-team",
      label: "Route only catalog.example.com to the catalog Service",
      assertions: [
        lengthEquals("spec.parentRefs", 1),
        eq("spec.parentRefs[name=shared-edge].name", "shared-edge"),
        eq("spec.parentRefs[name=shared-edge].namespace", "gateway-system"),
        matches(
          "spec.parentRefs[name=shared-edge].group",
          "^(?:gateway\\.networking\\.k8s\\.io)?$",
        ),
        matches("spec.parentRefs[name=shared-edge].kind", "^(?:Gateway)?$"),
        eq("spec.parentRefs[name=shared-edge].sectionName", "https"),
        lengthEquals("spec.hostnames", 1),
        includes("spec.hostnames", "catalog.example.com"),
        lengthEquals("spec.rules", 1),
        lengthEquals("spec.rules.0.backendRefs", 1),
        eq("spec.rules.0.backendRefs[name=catalog-api].name", "catalog-api"),
        matches("spec.rules.0.backendRefs[name=catalog-api].group", "^$"),
        matches("spec.rules.0.backendRefs[name=catalog-api].kind", "^(?:Service)?$"),
        eq("spec.rules.0.backendRefs[name=catalog-api].port", 8080),
      ],
      solution: `apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: catalog
  namespace: catalog-team
spec:
  parentRefs:
    - name: shared-edge
      namespace: gateway-system
      sectionName: https
  hostnames:
    - catalog.example.com
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: catalog-api
          port: 8080
`,
    },
    {
      path: "payments-route.yaml",
      apiVersion: "gateway.networking.k8s.io/v1",
      kind: "HTTPRoute",
      name: "payments",
      namespace: "payments-team",
      label: "Route only pay.example.com to the payments Service",
      assertions: [
        lengthEquals("spec.parentRefs", 1),
        eq("spec.parentRefs[name=shared-edge].name", "shared-edge"),
        eq("spec.parentRefs[name=shared-edge].namespace", "gateway-system"),
        matches(
          "spec.parentRefs[name=shared-edge].group",
          "^(?:gateway\\.networking\\.k8s\\.io)?$",
        ),
        matches("spec.parentRefs[name=shared-edge].kind", "^(?:Gateway)?$"),
        eq("spec.parentRefs[name=shared-edge].sectionName", "https"),
        lengthEquals("spec.hostnames", 1),
        includes("spec.hostnames", "pay.example.com"),
        lengthEquals("spec.rules", 1),
        lengthEquals("spec.rules.0.backendRefs", 1),
        eq("spec.rules.0.backendRefs[name=payments-api].name", "payments-api"),
        matches("spec.rules.0.backendRefs[name=payments-api].group", "^$"),
        matches("spec.rules.0.backendRefs[name=payments-api].kind", "^(?:Service)?$"),
        eq("spec.rules.0.backendRefs[name=payments-api].port", 8080),
      ],
      solution: `apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: payments
  namespace: payments-team
spec:
  parentRefs:
    - name: shared-edge
      namespace: gateway-system
      sectionName: https
  hostnames:
    - pay.example.com
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: payments-api
          port: 8080
`,
    },
  ],
  hintBodies: [
    "Treat the Gateway as platform infrastructure and HTTPRoutes as team-owned attachments. The namespace selector is the delegation boundary.",
    "TLS belongs on the listener. Route owners should reference the listener, not copy or read the certificate Secret into their namespaces.",
    "Sharing one data plane saves cost but expands blast radius. Host isolation, route status alerts, and a platform-owned listener policy are required compensating controls.",
  ],
  review: {
    risk: "The empty design had no ownership or attachment boundary, so teams could require duplicate gateways or attach unreviewed routes to a shared edge.",
    reasoning:
      "Gateway API separates infrastructure, listener, and route concerns. Namespace labels and allowedRoutes let the platform delegate application routing without delegating TLS custody.",
    accepted:
      "The accepted design creates one managed HTTPS Gateway, keeps the certificate in gateway-system, and gives each approved team an isolated hostname and backend route.",
    tradeoffs:
      "A shared gateway is cheaper and easier to standardize but is a common failure domain. Capacity, certificate expiry, rejected route status, and per-host error rates must be independently alerted.",
  },
  docsHref: "/docs/networking/service-types-gateway-api",
  recommendedNextSlugs: ["build-recoverable-stateful-data-plane"],
};
