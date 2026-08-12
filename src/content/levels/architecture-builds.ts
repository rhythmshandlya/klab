import type {
  KubernetesConcept,
  LevelConstraint,
  ManifestAssertion,
  ProblemCapability,
  ProblemLevel,
} from "@/lib/domain/types";

import { CURRENT_KUBERNETES_RANGE } from "./metadata";

interface ArchitectureFileSpec {
  path: string;
  apiVersion: string;
  kind: string;
  name: string;
  namespace?: string;
  label: string;
  assertions: ManifestAssertion[];
  solution: string;
}

interface ArchitectureBuildSpec {
  id: string;
  title: string;
  severity: "high" | "critical";
  estimatedMinutes: number;
  successRate: number;
  concepts: KubernetesConcept[];
  capabilities: ProblemCapability[];
  blurb: string;
  story: string;
  objective: string;
  learningObjectives: string[];
  prerequisites: string[];
  files: ArchitectureFileSpec[];
  hintBodies: [string, string, string];
  review: {
    risk: string;
    reasoning: string;
    accepted: string;
    tradeoffs: string;
  };
  docsHref?: string;
  recommendedNextSlugs: string[];
}

const eq = (path: string, value: string | number | boolean): ManifestAssertion => ({
  path,
  operator: "equals",
  value,
});

const gte = (path: string, value: number): ManifestAssertion => ({
  path,
  operator: "gte",
  value,
});

const lte = (path: string, value: number): ManifestAssertion => ({
  path,
  operator: "lte",
  value,
});

const includes = (path: string, value: string): ManifestAssertion => ({
  path,
  operator: "array-contains",
  value,
});

const present = (path: string): ManifestAssertion => ({ path, operator: "present" });

const emptyObject = (path: string): ManifestAssertion => ({ path, operator: "empty-object" });

const validBase64 = (path: string): ManifestAssertion => ({ path, operator: "base64" });

const notMatches = (path: string, value: string): ManifestAssertion => ({
  path,
  operator: "not-matches",
  value,
});

const matches = (path: string, value: string): ManifestAssertion => ({
  path,
  operator: "matches",
  value,
});

const excludes = (path: string, value: string): ManifestAssertion => ({
  path,
  operator: "array-not-contains",
  value,
});

function starterManifest(file: ArchitectureFileSpec): string {
  return `# ${file.label}
# Author this Kubernetes resource from scratch.
`;
}

function buildConstraints(files: readonly ArchitectureFileSpec[]): LevelConstraint[] {
  return [
    {
      id: "architecture-files",
      label: "Keep every architecture artifact in the submitted workspace",
      kind: "editable-files",
      paths: files.map((file) => file.path),
    },
    ...files.map((file): LevelConstraint => ({
      id: `architecture-${file.path.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
      label: file.label,
      kind: "manifest",
      file: file.path,
      resource: {
        kind: file.kind,
        name: file.name,
        ...(file.namespace ? { namespace: file.namespace } : {}),
      },
      exclusive: true,
      assertions: [eq("apiVersion", file.apiVersion), ...file.assertions],
    })),
  ];
}

function buildLevel(spec: ArchitectureBuildSpec): ProblemLevel {
  return {
    id: spec.id,
    slug: spec.id,
    contentVersion: 1,
    publicationStatus: "published",
    challengeMode: "build",
    title: spec.title,
    difficulty: "architect",
    severity: spec.severity,
    xp: 500,
    estimatedMinutes: spec.estimatedMinutes,
    successRate: spec.successRate,
    concepts: spec.concepts,
    blurb: spec.blurb,
    story: spec.story,
    objective: spec.objective,
    learningObjectives: spec.learningObjectives,
    prerequisites: spec.prerequisites,
    learningPaths: ["platform-architect"],
    capabilities: spec.capabilities,
    kubernetesVersion: CURRENT_KUBERNETES_RANGE,
    engine: { kind: "scripted", scenarioId: "manifest-assessment" },
    constraints: buildConstraints(spec.files),
    files: spec.files.map((file) => ({
      path: file.path,
      language: "yaml",
      initialValue: starterManifest(file),
      access: "editable",
      applyAtBoot: false,
    })),
    quickCommands: [
      { id: "assessment-pod", command: "kubectl get pods" },
      { id: "assessment-events", command: "kubectl get events" },
      { id: "assessment-deployment", command: "kubectl describe deployment manifest-assessment" },
      { id: "assessment-logs", command: "kubectl logs manifest-assessment" },
    ],
    probeTargets: ["http://assessment-svc/"],
    validators: [
      {
        id: "architecture-ready",
        title: "Static manifest assessment is Ready",
        successLabel: "Every machine-checked manifest requirement is satisfied",
        failureLabel: "The manifests still violate one or more static requirements",
        kind: "pod-ready-by-selector",
        namespace: "default",
        selector: { app: "manifest-assessment" },
        minReady: 1,
      },
      {
        id: "architecture-contract",
        title: "Static architecture contract is accepted",
        successLabel: "The submitted manifests pass the static design review",
        failureLabel: "The submitted manifests do not pass the static design review",
        kind: "http-get-through-service",
        namespace: "default",
        service: "assessment-svc",
        port: 80,
        path: "/",
        expectStatus: 200,
      },
    ],
    hints: [
      {
        id: "design-review-1",
        title: "Review the failure boundary",
        body: spec.hintBodies[0],
        xpPenalty: 50,
      },
      {
        id: "design-review-2",
        title: "Review the operating contract",
        body: spec.hintBodies[1],
        xpPenalty: 75,
        unlockAfter: ["architecture-rejection"],
      },
      {
        id: "design-review-3",
        title: "Review the tradeoff",
        body: spec.hintBodies[2],
        xpPenalty: 100,
        unlockAfter: ["architecture-probe"],
      },
    ],
    evidenceRules: [
      {
        id: "architecture-pod",
        evidenceId: "architecture-pod-not-ready",
        label: "The policy assessment Pod is Running but not Ready",
        hiddenLabel: "Assessment workload status reviewed",
        source: "terminal",
        trigger: {
          type: "command",
          commandMatches: "get pods",
          outputMatches: "0/1|Running",
        },
      },
      {
        id: "architecture-rejection",
        evidenceId: "architecture-config-rejected",
        label: "The submitted repository does not meet every machine-checked requirement",
        hiddenLabel: "Policy assessment event reviewed",
        source: "events",
        trigger: { type: "event-reason", reason: "ConfigRejected" },
      },
      {
        id: "architecture-topology",
        evidenceId: "architecture-assessor-inspected",
        label: "The architecture assessment workload is the active policy gate",
        hiddenLabel: "Assessment topology inspected",
        source: "topology",
        trigger: {
          type: "topology-view",
          kind: "Deployment",
          nameMatches: "^manifest-assessment$",
          namespace: "default",
        },
      },
      {
        id: "architecture-probe",
        evidenceId: "architecture-contract-rejected",
        label: "The static assessment endpoint returns HTTP 422",
        hiddenLabel: "Static assessment endpoint tested",
        source: "network",
        trigger: {
          type: "probe",
          hostMatches: "^assessment-svc$",
          pathMatches: "^/$",
          status: 422,
        },
      },
    ],
    postSolveExplanation: {
      rootCause: spec.review.risk,
      whyItFailed: spec.review.reasoning,
      whatFixedIt: spec.review.accepted,
      prevention: spec.review.tradeoffs,
      relatedConcepts: spec.concepts,
      ...(spec.docsHref ? { docsHref: spec.docsHref } : {}),
      recommendedNextSlugs: spec.recommendedNextSlugs,
    },
  };
}

const BUILD_SPECS: readonly ArchitectureBuildSpec[] = [
  {
    id: "build-three-zone-api",
    title: "Build a Three-Zone API",
    severity: "critical",
    estimatedMinutes: 65,
    successRate: 31,
    concepts: [
      "deployments",
      "services",
      "scheduling",
      "disruptions",
      "autoscaling",
      "resources",
      "readiness-probes",
    ],
    capabilities: ["pods", "services", "deployments", "scheduling", "http-probes", "rollouts"],
    blurb:
      "Design an API that keeps serving through a zone loss without buying unlimited idle capacity.",
    story:
      "A checkout API must sustain 900 requests per second at normal load and three times that rate during promotions. The error budget permits less than one minute of unavailability per month. One availability zone may disappear without warning, and the platform budget allows four baseline replicas with growth to twelve. Build the workload, traffic, disruption, placement, and scaling contracts from an empty repository.",
    objective:
      "Deliver a three-zone API design with four baseline replicas, zero-unavailable rollouts, safe voluntary disruption, even zone placement, and bounded autoscaling from four to twelve replicas.",
    learningObjectives: [
      "Translate availability and traffic targets into replica, disruption, and autoscaling policy.",
      "Combine topology spread with a PodDisruptionBudget without making drains impossible.",
      "Bound capacity cost while keeping enough headroom for a full zone failure.",
    ],
    prerequisites: [
      "rollout-cannot-fit-maxsurge",
      "recreate-strategy-outage",
      "slow-start-without-startup-probe",
      "graceful-shutdown-502s",
    ],
    files: [
      {
        path: "namespace.yaml",
        apiVersion: "v1",
        kind: "Namespace",
        name: "resilient-api",
        label: "Place the API in a restricted, explicitly owned namespace",
        assertions: [
          eq("metadata.labels.securityProfile", "restricted"),
          eq("/metadata/labels/pod-security.kubernetes.io~1enforce", "restricted"),
          eq("metadata.labels.owner", "checkout-platform"),
        ],
        solution: `apiVersion: v1
kind: Namespace
metadata:
  name: resilient-api
  labels:
    owner: checkout-platform
    securityProfile: restricted
    pod-security.kubernetes.io/enforce: restricted
`,
      },
      {
        path: "deployment.yaml",
        apiVersion: "apps/v1",
        kind: "Deployment",
        name: "checkout-api",
        namespace: "resilient-api",
        label: "Run four bounded replicas across zones with safe probes and rollout capacity",
        assertions: [
          gte("spec.replicas", 4),
          lte("spec.replicas", 12),
          eq("spec.strategy.rollingUpdate.maxUnavailable", 0),
          eq(
            "spec.template.spec.topologySpreadConstraints.0.topologyKey",
            "topology.kubernetes.io/zone",
          ),
          eq("spec.template.spec.topologySpreadConstraints.0.maxSkew", 1),
          present("spec.template.spec.containers.0.readinessProbe"),
          present("spec.template.spec.containers.0.resources.requests.cpu"),
          present("spec.template.spec.containers.0.resources.limits.memory"),
        ],
        solution: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout-api
  namespace: resilient-api
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  selector:
    matchLabels:
      app: checkout-api
  template:
    metadata:
      labels:
        app: checkout-api
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: checkout-api
      containers:
        - name: api
          image: registry.example/checkout-api@sha256:1111111111111111111111111111111111111111111111111111111111111111
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /readyz
              port: http
          livenessProbe:
            httpGet:
              path: /healthz
              port: http
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: "1"
              memory: 1Gi
`,
      },
      {
        path: "service.yaml",
        apiVersion: "v1",
        kind: "Service",
        name: "checkout-api",
        namespace: "resilient-api",
        label: "Expose only Ready checkout-api Pods through a stable internal address",
        assertions: [
          eq("spec.type", "ClusterIP"),
          eq("spec.selector.app", "checkout-api"),
          eq("spec.ports.0.port", 80),
          eq("spec.ports.0.targetPort", "http"),
        ],
        solution: `apiVersion: v1
kind: Service
metadata:
  name: checkout-api
  namespace: resilient-api
spec:
  type: ClusterIP
  selector:
    app: checkout-api
  ports:
    - name: http
      port: 80
      targetPort: http
`,
      },
      {
        path: "pdb.yaml",
        apiVersion: "policy/v1",
        kind: "PodDisruptionBudget",
        name: "checkout-api",
        namespace: "resilient-api",
        label: "Keep at least three API replicas available during voluntary disruption",
        assertions: [eq("spec.selector.matchLabels.app", "checkout-api")],
        solution: `apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: checkout-api
  namespace: resilient-api
spec:
  minAvailable: 3
  selector:
    matchLabels:
      app: checkout-api
`,
      },
      {
        path: "hpa.yaml",
        apiVersion: "autoscaling/v2",
        kind: "HorizontalPodAutoscaler",
        name: "checkout-api",
        namespace: "resilient-api",
        label: "Scale between the four-replica failure floor and the twelve-replica budget ceiling",
        assertions: [
          eq("spec.minReplicas", 4),
          eq("spec.maxReplicas", 12),
          eq("spec.scaleTargetRef.apiVersion", "apps/v1"),
          eq("spec.scaleTargetRef.kind", "Deployment"),
          eq("spec.scaleTargetRef.name", "checkout-api"),
          eq("spec.metrics.0.resource.target.averageUtilization", 60),
        ],
        solution: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: checkout-api
  namespace: resilient-api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: checkout-api
  minReplicas: 4
  maxReplicas: 12
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
`,
      },
    ],
    hintBodies: [
      "Model the loss of one zone before choosing replicas. The surviving zones must retain enough Ready capacity while the disruption budget still permits routine maintenance.",
      "The autoscaler needs resource requests to interpret utilization. Its minimum is also the failure-capacity floor, not just an idle-cost preference.",
      "A hard zone spread protects availability but can leave Pods Pending during a zone outage. That is acceptable here because four replicas and two surviving zones retain the SLO while capacity recovers.",
    ],
    review: {
      risk: "The starter repository had no capacity, placement, or disruption contract, so a single-zone loss could remove the entire API or a drain could consume the error budget.",
      reasoning:
        "Healthy Pods alone do not prove zonal resilience. Replica count, rollout surge, scheduling spread, resource requests, autoscaling, and voluntary disruption must agree on the same failure model.",
      accepted:
        "The accepted design establishes four baseline replicas, zone-aware placement, three required available replicas, zero-unavailable rollout behavior, and bounded scaling to twelve.",
      tradeoffs:
        "Hard zone spread may delay replacement Pods while a zone is absent, and minAvailable three may slow drains. Those constraints intentionally favor the availability SLO over fastest maintenance while the HPA ceiling protects the budget.",
    },
    docsHref: "/docs/operations/scheduling",
    recommendedNextSlugs: ["build-default-deny-service-graph"],
  },
  {
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
          present("spec.template.spec.containers.0.resources.requests.cpu"),
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
          present("spec.template.spec.containers.0.readinessProbe"),
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
        assertions: [eq("spec.selector.app", "orders"), eq("spec.ports.0.targetPort", "http")],
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
          eq("spec.policyTypes.0", "Ingress"),
          eq("spec.policyTypes.1", "Egress"),
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
          eq("spec.ingress.0.ports.0.port", 8080),
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
  },
  {
    id: "build-multi-team-gateway",
    title: "Build a Multi-Team Gateway",
    severity: "high",
    estimatedMinutes: 70,
    successRate: 27,
    concepts: ["gateway-api", "ingress", "services", "namespaces", "secrets", "networking"],
    capabilities: ["services", "namespaces", "secrets", "network-policy", "http-probes"],
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
        assertions: [eq("metadata.labels.owner", "platform-networking")],
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
        assertions: [eq("metadata.labels.gateway-access", "shared-edge")],
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
        assertions: [eq("metadata.labels.gateway-access", "shared-edge")],
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
          present("spec.template.spec.containers.0.readinessProbe.httpGet"),
          present("spec.template.spec.containers.0.resources.requests.cpu"),
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
          present("spec.template.spec.containers.0.readinessProbe.httpGet"),
          present("spec.template.spec.containers.0.resources.requests.cpu"),
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
        assertions: [eq("spec.selector.app", "catalog-api"), eq("spec.ports.0.port", 8080)],
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
        assertions: [eq("spec.selector.app", "payments-api"), eq("spec.ports.0.port", 8080)],
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
          eq("spec.dnsNames.0", "catalog.example.com"),
          eq("spec.dnsNames.1", "pay.example.com"),
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
          eq("spec.listeners.0.protocol", "HTTPS"),
          eq("spec.listeners.0.port", 443),
          eq("spec.listeners.0.tls.certificateRefs.0.name", "shared-edge-tls"),
          eq("spec.listeners.0.allowedRoutes.namespaces.from", "Selector"),
          eq(
            "spec.listeners.0.allowedRoutes.namespaces.selector.matchLabels.gateway-access",
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
          eq("spec.parentRefs.0.name", "shared-edge"),
          eq("spec.parentRefs.0.namespace", "gateway-system"),
          eq("spec.hostnames.0", "catalog.example.com"),
          eq("spec.rules.0.backendRefs.0.name", "catalog-api"),
          eq("spec.rules.0.backendRefs.0.port", 8080),
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
          eq("spec.parentRefs.0.name", "shared-edge"),
          eq("spec.parentRefs.0.namespace", "gateway-system"),
          eq("spec.hostnames.0", "pay.example.com"),
          eq("spec.rules.0.backendRefs.0.name", "payments-api"),
          eq("spec.rules.0.backendRefs.0.port", 8080),
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
  },
  {
    id: "build-recoverable-stateful-data-plane",
    title: "Build a Recoverable Stateful Data Plane",
    severity: "critical",
    estimatedMinutes: 85,
    successRate: 22,
    concepts: [
      "statefulsets",
      "storage",
      "services",
      "scheduling",
      "disruptions",
      "cronjobs",
      "jobs",
      "init-containers",
    ],
    capabilities: ["pods", "services", "workload-controllers", "scheduling", "container-lifecycle"],
    blurb:
      "Preserve quorum, stable identity, and restorable data through rescheduling and zone loss.",
    story:
      "An order ledger on GKE needs three stable database members, a recovery point no older than fifteen minutes, and a sixty-minute recovery objective. A node or zone may fail while the cluster is serving traffic. Storage cost is capped at one 100 GiB volume per member plus one isolated restore volume. The encrypted gs://orders-ledger-backups bucket and its GCP service account already exist. Build identity, topology-aware storage, quorum protection, scheduled backups, and a restore verification path from scratch.",
    objective:
      "Deliver a three-member stateful data plane with stable network identity, delayed volume binding, zone spread, two-member availability during disruption, non-overlapping backups, and an isolated restore check.",
    learningObjectives: [
      "Coordinate StatefulSet identity, headless discovery, and per-replica persistent claims.",
      "Align storage binding and Pod placement with zone failure domains.",
      "Design backup and restore as tested runtime paths with explicit RPO and RTO targets.",
    ],
    prerequisites: [
      "pod-crashloop-mystery",
      "graceful-shutdown-502s",
      "rollout-cannot-fit-maxsurge",
      "zombie-replicaset",
    ],
    files: [
      {
        path: "namespace.yaml",
        apiVersion: "v1",
        kind: "Namespace",
        name: "data-plane",
        label: "Create a restricted, explicitly owned namespace for the stateful data plane",
        assertions: [eq("metadata.labels.owner", "data-platform")],
        solution: `apiVersion: v1
kind: Namespace
metadata:
  name: data-plane
  labels:
    owner: data-platform
    pod-security.kubernetes.io/enforce: restricted
`,
      },
      {
        path: "storage-class.yaml",
        apiVersion: "storage.k8s.io/v1",
        kind: "StorageClass",
        name: "zonal-rwo",
        label:
          "Delay volume binding until the scheduler chooses the Pod zone and retain recovered data",
        assertions: [
          eq("provisioner", "pd.csi.storage.gke.io"),
          eq("volumeBindingMode", "WaitForFirstConsumer"),
          eq("reclaimPolicy", "Retain"),
          eq("allowVolumeExpansion", true),
        ],
        solution: `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: zonal-rwo
provisioner: pd.csi.storage.gke.io
volumeBindingMode: WaitForFirstConsumer
reclaimPolicy: Retain
allowVolumeExpansion: true
`,
      },
      {
        path: "headless-service.yaml",
        apiVersion: "v1",
        kind: "Service",
        name: "orders-db",
        namespace: "data-plane",
        label: "Provide stable per-member DNS without a virtual Service IP",
        assertions: [
          eq("spec.clusterIP", "None"),
          eq("spec.publishNotReadyAddresses", true),
          eq("spec.selector.app", "orders-db"),
        ],
        solution: `apiVersion: v1
kind: Service
metadata:
  name: orders-db
  namespace: data-plane
spec:
  clusterIP: None
  publishNotReadyAddresses: true
  selector:
    app: orders-db
  ports:
    - name: database
      port: 5432
`,
      },
      {
        path: "statefulset.yaml",
        apiVersion: "apps/v1",
        kind: "StatefulSet",
        name: "orders-db",
        namespace: "data-plane",
        label: "Run three zone-spread members with one retained 100 GiB claim per identity",
        assertions: [
          eq("spec.serviceName", "orders-db"),
          eq("spec.replicas", 3),
          eq(
            "spec.template.spec.topologySpreadConstraints.0.topologyKey",
            "topology.kubernetes.io/zone",
          ),
          present("spec.template.spec.containers.0.readinessProbe"),
          eq("spec.template.spec.initContainers.0.name", "verify-data-volume"),
          eq("spec.volumeClaimTemplates.0.spec.storageClassName", "zonal-rwo"),
          eq("spec.volumeClaimTemplates.0.spec.accessModes.0", "ReadWriteOnce"),
          eq("spec.volumeClaimTemplates.0.spec.resources.requests.storage", "100Gi"),
        ],
        solution: `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: orders-db
  namespace: data-plane
spec:
  serviceName: orders-db
  replicas: 3
  selector:
    matchLabels:
      app: orders-db
  updateStrategy:
    type: RollingUpdate
  template:
    metadata:
      labels:
        app: orders-db
    spec:
      terminationGracePeriodSeconds: 60
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: orders-db
      initContainers:
        - name: verify-data-volume
          image: registry.example/db-tools@sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd
          command:
            - sh
            - -ec
            - test -d /var/lib/postgresql/data
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
      containers:
        - name: database
          image: registry.example/orders-db@sha256:2222222222222222222222222222222222222222222222222222222222222222
          ports:
            - name: database
              containerPort: 5432
          readinessProbe:
            exec:
              command:
                - pg_isready
                - -U
                - orders
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        storageClassName: zonal-rwo
        accessModes:
          - ReadWriteOnce
        resources:
          requests:
            storage: 100Gi
`,
      },
      {
        path: "pdb.yaml",
        apiVersion: "policy/v1",
        kind: "PodDisruptionBudget",
        name: "orders-db",
        namespace: "data-plane",
        label:
          "Retain quorum by keeping two database members available during voluntary disruption",
        assertions: [eq("spec.selector.matchLabels.app", "orders-db")],
        solution: `apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: orders-db
  namespace: data-plane
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: orders-db
`,
      },
      {
        path: "backup-service-account.yaml",
        apiVersion: "v1",
        kind: "ServiceAccount",
        name: "orders-db-backup",
        namespace: "data-plane",
        label: "Use GKE Workload Identity for the pre-provisioned encrypted backup bucket",
        assertions: [
          eq(
            "/metadata/annotations/iam.gke.io~1gcp-service-account",
            "orders-backup@platform-prod.iam.gserviceaccount.com",
          ),
          eq("automountServiceAccountToken", true),
        ],
        solution: `apiVersion: v1
kind: ServiceAccount
metadata:
  name: orders-db-backup
  namespace: data-plane
  annotations:
    iam.gke.io/gcp-service-account: orders-backup@platform-prod.iam.gserviceaccount.com
automountServiceAccountToken: true
`,
      },
      {
        path: "backup-cronjob.yaml",
        apiVersion: "batch/v1",
        kind: "CronJob",
        name: "orders-db-backup",
        namespace: "data-plane",
        label: "Take bounded non-overlapping backups every fifteen minutes",
        assertions: [
          eq("spec.schedule", "*/15 * * * *"),
          eq("spec.concurrencyPolicy", "Forbid"),
          eq("spec.startingDeadlineSeconds", 300),
          eq("spec.jobTemplate.spec.backoffLimit", 2),
          eq("spec.jobTemplate.spec.template.spec.serviceAccountName", "orders-db-backup"),
        ],
        solution: `apiVersion: batch/v1
kind: CronJob
metadata:
  name: orders-db-backup
  namespace: data-plane
spec:
  schedule: "*/15 * * * *"
  concurrencyPolicy: Forbid
  startingDeadlineSeconds: 300
  successfulJobsHistoryLimit: 4
  failedJobsHistoryLimit: 4
  jobTemplate:
    spec:
      backoffLimit: 2
      template:
        spec:
          serviceAccountName: orders-db-backup
          restartPolicy: Never
          containers:
            - name: backup
              image: registry.example/db-tools:1.0.0
              args:
                - backup
                - orders-db
                - gs://orders-ledger-backups
`,
      },
      {
        path: "restore-volume.yaml",
        apiVersion: "v1",
        kind: "PersistentVolumeClaim",
        name: "restore-validation",
        namespace: "data-plane",
        label: "Reserve an isolated restore volume so validation cannot overwrite the primary",
        assertions: [
          eq("spec.storageClassName", "zonal-rwo"),
          eq("spec.accessModes.0", "ReadWriteOnce"),
          eq("spec.resources.requests.storage", "100Gi"),
        ],
        solution: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: restore-validation
  namespace: data-plane
spec:
  storageClassName: zonal-rwo
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
`,
      },
      {
        path: "restore-check.yaml",
        apiVersion: "batch/v1",
        kind: "Job",
        name: "restore-validation",
        namespace: "data-plane",
        label:
          "Restore into the isolated claim and validate ledger identity within the recovery objective",
        assertions: [
          eq("spec.backoffLimit", 1),
          eq("spec.template.spec.restartPolicy", "Never"),
          eq("spec.template.spec.serviceAccountName", "orders-db-backup"),
          eq("spec.template.spec.volumes.0.persistentVolumeClaim.claimName", "restore-validation"),
          eq("spec.template.spec.containers.0.args.0", "restore-and-verify"),
        ],
        solution: `apiVersion: batch/v1
kind: Job
metadata:
  name: restore-validation
  namespace: data-plane
  labels:
    purpose: disaster-recovery-test
spec:
  backoffLimit: 1
  activeDeadlineSeconds: 3600
  template:
    spec:
      serviceAccountName: orders-db-backup
      restartPolicy: Never
      volumes:
        - name: restore
          persistentVolumeClaim:
            claimName: restore-validation
      containers:
        - name: restore-check
          image: registry.example/db-tools:1.0.0
          args:
            - restore-and-verify
            - latest-backup
            - gs://orders-ledger-backups
          volumeMounts:
            - name: restore
              mountPath: /restore
`,
      },
    ],
    hintBodies: [
      "Treat identity, quorum, and storage topology as one system. A three-member StatefulSet is not zone-safe if every claim binds before scheduling into the same zone.",
      "A backup schedule is only an RPO claim until a separate restore path proves the artifact can recover data without touching the primary claims.",
      "Retained volumes reduce accidental data loss but increase cleanup cost and may preserve stale state. Document ownership and tested restoration before automating deletion.",
    ],
    review: {
      risk: "The starter repository made no promises about identity, quorum, storage placement, backups, or safe restoration, so ordinary rescheduling could become permanent data loss.",
      reasoning:
        "Stateful availability depends on coordinated controller identity, headless DNS, topology-aware volume binding, disruption limits, and a restore process validated against independent storage.",
      accepted:
        "The accepted design gives three stable members retained 100 GiB claims, spreads them across zones, protects quorum, backs up every fifteen minutes, and validates recovery on a separate claim.",
      tradeoffs:
        "Synchronous quorum and retained volumes favor durability but cost capacity and can slow maintenance. The isolated restore volume adds storage cost, but it is the evidence that the stated RPO and RTO are operationally credible.",
    },
    docsHref: "/docs/workloads/statefulsets",
    recommendedNextSlugs: ["build-hardened-admin-workload"],
  },
  {
    id: "build-hardened-admin-workload",
    title: "Build a Hardened Admin Workload",
    severity: "critical",
    estimatedMinutes: 70,
    successRate: 25,
    concepts: [
      "service-accounts",
      "rbac",
      "secrets",
      "security-contexts",
      "network-policies",
      "namespaces",
    ],
    capabilities: ["pods", "services", "deployments", "namespaces", "secrets", "network-policy"],
    blurb:
      "Give an internal administrator exactly one authority path without granting a cluster foothold.",
    story:
      "Operations needs an internal administration service that reads one maintenance Secret and patches one ConfigMap. It must never be publicly exposed. A compromised process must run without root or Linux capabilities, have a read-only filesystem, remain resource-bounded, and lack permission to enumerate other Secrets. Only Pods from the labeled ops namespace may connect.",
    objective:
      "Build a private admin workload with restricted runtime security, a mounted single-purpose Secret, resource-name-scoped RBAC, and network ingress limited to the ops namespace.",
    learningObjectives: [
      "Combine runtime hardening with least-privilege Kubernetes API authorization.",
      "Scope Secret consumption and RBAC permissions to named resources.",
      "Keep an administrative surface private with both Service type and network policy.",
    ],
    prerequisites: [
      "private-registry-pull-secret",
      "namespace-confusion",
      "command-override-crash",
      "healthy-app-broken-sidecar",
    ],
    files: [
      {
        path: "namespace.yaml",
        apiVersion: "v1",
        kind: "Namespace",
        name: "admin-system",
        label: "Enforce the restricted Pod Security profile for the admin boundary",
        assertions: [
          eq("metadata.labels.securityProfile", "restricted"),
          eq("/metadata/labels/pod-security.kubernetes.io~1enforce", "restricted"),
          eq("metadata.labels.owner", "platform-operations"),
        ],
        solution: `apiVersion: v1
kind: Namespace
metadata:
  name: admin-system
  labels:
    owner: platform-operations
    securityProfile: restricted
    pod-security.kubernetes.io/enforce: restricted
`,
      },
      {
        path: "service-account.yaml",
        apiVersion: "v1",
        kind: "ServiceAccount",
        name: "admin-console",
        namespace: "admin-system",
        label: "Use a dedicated workload identity instead of the default ServiceAccount",
        assertions: [
          eq("automountServiceAccountToken", true),
          eq("metadata.labels.owner", "platform-operations"),
        ],
        solution: `apiVersion: v1
kind: ServiceAccount
metadata:
  name: admin-console
  namespace: admin-system
  labels:
    owner: platform-operations
automountServiceAccountToken: true
`,
      },
      {
        path: "maintenance-secret.yaml",
        apiVersion: "v1",
        kind: "Secret",
        name: "maintenance-token",
        namespace: "admin-system",
        label: "Store only the maintenance credential consumed by the admin workload",
        assertions: [eq("type", "Opaque"), validBase64("/data/token")],
        solution: `apiVersion: v1
kind: Secret
metadata:
  name: maintenance-token
  namespace: admin-system
type: Opaque
data:
  token: cmVkYWN0ZWQ=
`,
      },
      {
        path: "maintenance-window.yaml",
        apiVersion: "v1",
        kind: "ConfigMap",
        name: "maintenance-window",
        namespace: "admin-system",
        label: "Create the single named maintenance control the admin workload may patch",
        assertions: [eq("data.status", "closed"), eq("metadata.labels.owner", "operations")],
        solution: `apiVersion: v1
kind: ConfigMap
metadata:
  name: maintenance-window
  namespace: admin-system
  labels:
    owner: operations
data:
  status: closed
`,
      },
      {
        path: "role.yaml",
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "Role",
        name: "admin-console",
        namespace: "admin-system",
        label: "Allow only reading the named Secret and patching the named maintenance ConfigMap",
        assertions: [
          eq("rules.0.resources.0", "secrets"),
          eq("rules.0.resourceNames.0", "maintenance-token"),
          eq("rules.0.verbs.0", "get"),
          excludes("rules.0.verbs", "delete"),
          eq("rules.1.resources.0", "configmaps"),
          eq("rules.1.resourceNames.0", "maintenance-window"),
          eq("rules.1.verbs.0", "patch"),
          excludes("rules.1.verbs", "delete"),
        ],
        solution: `apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: admin-console
  namespace: admin-system
rules:
  - apiGroups:
      - ""
    resources:
      - secrets
    resourceNames:
      - maintenance-token
    verbs:
      - get
  - apiGroups:
      - ""
    resources:
      - configmaps
    resourceNames:
      - maintenance-window
    verbs:
      - patch
      - get
`,
      },
      {
        path: "role-binding.yaml",
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "RoleBinding",
        name: "admin-console",
        namespace: "admin-system",
        label: "Bind the scoped Role only to the admin-console ServiceAccount",
        assertions: [
          eq("roleRef.kind", "Role"),
          eq("roleRef.name", "admin-console"),
          eq("subjects.0.kind", "ServiceAccount"),
          eq("subjects.0.name", "admin-console"),
        ],
        solution: `apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: admin-console
  namespace: admin-system
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: admin-console
subjects:
  - kind: ServiceAccount
    name: admin-console
    namespace: admin-system
`,
      },
      {
        path: "deployment.yaml",
        apiVersion: "apps/v1",
        kind: "Deployment",
        name: "admin-console",
        namespace: "admin-system",
        label:
          "Run the admin process non-root with no capabilities, a read-only root, seccomp, and resource bounds",
        assertions: [
          eq("spec.template.spec.serviceAccountName", "admin-console"),
          eq("spec.template.spec.securityContext.runAsNonRoot", true),
          eq("spec.template.spec.securityContext.seccompProfile.type", "RuntimeDefault"),
          eq("spec.template.spec.containers.0.securityContext.readOnlyRootFilesystem", true),
          eq("spec.template.spec.containers.0.securityContext.allowPrivilegeEscalation", false),
          eq("spec.template.spec.containers.0.securityContext.capabilities.drop.0", "ALL"),
          present("spec.template.spec.containers.0.resources.requests.cpu"),
          eq("spec.template.spec.volumes.0.secret.secretName", "maintenance-token"),
        ],
        solution: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: admin-console
  namespace: admin-system
spec:
  replicas: 2
  selector:
    matchLabels:
      app: admin-console
  template:
    metadata:
      labels:
        app: admin-console
    spec:
      serviceAccountName: admin-console
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
        seccompProfile:
          type: RuntimeDefault
      volumes:
        - name: maintenance-token
          secret:
            secretName: maintenance-token
      containers:
        - name: admin
          image: registry.example/admin-console@sha256:3333333333333333333333333333333333333333333333333333333333333333
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
          volumeMounts:
            - name: maintenance-token
              mountPath: /var/run/admin-secrets
              readOnly: true
`,
      },
      {
        path: "service.yaml",
        apiVersion: "v1",
        kind: "Service",
        name: "admin-console",
        namespace: "admin-system",
        label: "Expose the admin console only through an internal ClusterIP",
        assertions: [eq("spec.type", "ClusterIP"), eq("spec.selector.app", "admin-console")],
        solution: `apiVersion: v1
kind: Service
metadata:
  name: admin-console
  namespace: admin-system
spec:
  type: ClusterIP
  selector:
    app: admin-console
  ports:
    - name: https
      port: 443
      targetPort: 8443
`,
      },
      {
        path: "network-policy.yaml",
        apiVersion: "networking.k8s.io/v1",
        kind: "NetworkPolicy",
        name: "admin-console-private",
        namespace: "admin-system",
        label: "Allow admin ingress only from namespaces explicitly labeled for operations access",
        assertions: [
          eq("spec.podSelector.matchLabels.app", "admin-console"),
          eq("spec.policyTypes.0", "Ingress"),
          eq("spec.ingress.0.from.0.namespaceSelector.matchLabels.access", "admin-console"),
          eq("spec.ingress.0.ports.0.port", 8443),
        ],
        solution: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: admin-console-private
  namespace: admin-system
spec:
  podSelector:
    matchLabels:
      app: admin-console
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              access: admin-console
      ports:
        - protocol: TCP
          port: 8443
`,
      },
    ],
    hintBodies: [
      "Separate three boundaries in the review: who may connect, what the process may do to the node, and what its ServiceAccount may do to the Kubernetes API.",
      "A Role that permits get on Secrets without resourceNames still permits reading every Secret in the namespace. Scope both verbs and named objects.",
      "A private ClusterIP is necessary but not sufficient. NetworkPolicy provides the explicit caller boundary, while Pod Security and the container security context limit damage after compromise.",
    ],
    review: {
      risk: "The starter repository provided no network, runtime, credential, or authorization boundary for a highly privileged administrative surface.",
      reasoning:
        "Administrative workloads require defense in depth because one control cannot contain every compromise path. Private routing, policy identity, restricted execution, named Secret mounts, and resource-scoped RBAC cover different layers.",
      accepted:
        "The accepted design exposes only an internal Service, admits labeled ops namespaces, runs a non-root restricted container, mounts one Secret, and grants only two named API operations.",
      tradeoffs:
        "Resource-name-scoped RBAC is safer but increases operational work when credentials or configuration names rotate. The correct response is automated, reviewed binding updates rather than broad wildcard permissions.",
    },
    docsHref: "/docs/operations/pod-security",
    recommendedNextSlugs: ["build-flash-sale-scaling-system"],
  },
  {
    id: "build-flash-sale-scaling-system",
    title: "Build a Flash-Sale Scaling System",
    severity: "critical",
    estimatedMinutes: 80,
    successRate: 21,
    concepts: [
      "deployments",
      "services",
      "autoscaling",
      "resources",
      "disruptions",
      "scheduling",
      "configmaps",
    ],
    capabilities: [
      "pods",
      "services",
      "deployments",
      "configmaps",
      "scheduling",
      "rollouts",
      "http-probes",
    ],
    blurb:
      "Scale an API and queue workers for a 20x burst without abandoning cost or disruption controls.",
    story:
      "A ticket sale jumps from 300 to 6,000 requests per second in under two minutes. The API must keep p95 latency below 300 ms while workers drain the purchase queue within five minutes. Finance caps the system at thirty API Pods and sixty workers. The platform already exposes purchase_queue_depth through its external-metrics adapter. A node drain may overlap the sale, so baseline headroom, bounded resources, queue-aware worker scaling, and disruption protection must work together.",
    objective:
      "Build a flash-sale system with six warm API replicas, ten warm workers, independent bounded autoscalers, resource requests, queue-depth scaling, priority, and a four-available API disruption floor.",
    learningObjectives: [
      "Choose warm capacity and scale ceilings from burst, latency, drain, and budget constraints.",
      "Scale request-serving and queue-consuming workloads from different demand signals.",
      "Protect critical capacity during disruption without making cluster operations impossible.",
    ],
    prerequisites: [
      "rollout-cannot-fit-maxsurge",
      "recreate-strategy-outage",
      "graceful-shutdown-502s",
      "liveness-probe-death-spiral",
    ],
    files: [
      {
        path: "namespace.yaml",
        apiVersion: "v1",
        kind: "Namespace",
        name: "commerce",
        label: "Create an owned restricted namespace for the sale workloads",
        assertions: [eq("metadata.labels.owner", "commerce-platform")],
        solution: `apiVersion: v1
kind: Namespace
metadata:
  name: commerce
  labels:
    owner: commerce-platform
    pod-security.kubernetes.io/enforce: restricted
`,
      },
      {
        path: "scaling-contract.yaml",
        apiVersion: "v1",
        kind: "ConfigMap",
        name: "flash-sale-contract",
        namespace: "commerce",
        label:
          "Record the traffic, latency, queue, and budget assumptions used by both autoscalers",
        assertions: [
          eq("data.peakRps", "6000"),
          eq("data.p95LatencyMs", "300"),
          eq("data.queueDrainMinutes", "5"),
          eq("data.maxPods", "90"),
        ],
        solution: `apiVersion: v1
kind: ConfigMap
metadata:
  name: flash-sale-contract
  namespace: commerce
data:
  peakRps: "6000"
  p95LatencyMs: "300"
  queueDrainMinutes: "5"
  maxPods: "90"
`,
      },
      {
        path: "api-deployment.yaml",
        apiVersion: "apps/v1",
        kind: "Deployment",
        name: "sale-api",
        namespace: "commerce",
        label: "Keep six warm, resource-bounded API replicas ready for the first burst",
        assertions: [
          eq("spec.replicas", 6),
          eq("spec.strategy.rollingUpdate.maxUnavailable", 0),
          present("spec.template.spec.containers.0.readinessProbe"),
          present("spec.template.spec.containers.0.resources.requests.cpu"),
          eq("spec.template.spec.priorityClassName", "sale-critical"),
          eq(
            "spec.template.spec.topologySpreadConstraints.0.topologyKey",
            "topology.kubernetes.io/zone",
          ),
        ],
        solution: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: sale-api
  namespace: commerce
spec:
  replicas: 6
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 2
  selector:
    matchLabels:
      app: sale-api
  template:
    metadata:
      labels:
        app: sale-api
    spec:
      priorityClassName: sale-critical
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: sale-api
      containers:
        - name: api
          image: registry.example/sale-api:2.0.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /readyz
              port: http
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: "1"
              memory: 1Gi
`,
      },
      {
        path: "api-service.yaml",
        apiVersion: "v1",
        kind: "Service",
        name: "sale-api",
        namespace: "commerce",
        label: "Route sale traffic to the warm API pool through named ports",
        assertions: [eq("spec.selector.app", "sale-api"), eq("spec.ports.0.targetPort", "http")],
        solution: `apiVersion: v1
kind: Service
metadata:
  name: sale-api
  namespace: commerce
spec:
  selector:
    app: sale-api
  ports:
    - name: http
      port: 80
      targetPort: http
`,
      },
      {
        path: "worker-deployment.yaml",
        apiVersion: "apps/v1",
        kind: "Deployment",
        name: "sale-worker",
        namespace: "commerce",
        label: "Keep ten bounded queue workers warm without giving them API priority",
        assertions: [
          eq("spec.replicas", 10),
          eq("spec.template.metadata.labels.app", "sale-worker"),
          present("spec.template.spec.containers.0.resources.requests.cpu"),
          present("spec.template.spec.containers.0.resources.limits.memory"),
          eq(
            "spec.template.spec.topologySpreadConstraints.0.topologyKey",
            "topology.kubernetes.io/zone",
          ),
        ],
        solution: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: sale-worker
  namespace: commerce
spec:
  replicas: 10
  selector:
    matchLabels:
      app: sale-worker
  template:
    metadata:
      labels:
        app: sale-worker
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: sale-worker
      containers:
        - name: worker
          image: registry.example/sale-worker:2.0.0
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: "1"
              memory: 512Mi
`,
      },
      {
        path: "api-hpa.yaml",
        apiVersion: "autoscaling/v2",
        kind: "HorizontalPodAutoscaler",
        name: "sale-api",
        namespace: "commerce",
        label:
          "Scale the API from six to thirty replicas on utilization while preserving warm headroom",
        assertions: [
          eq("spec.minReplicas", 6),
          eq("spec.maxReplicas", 30),
          eq("spec.scaleTargetRef.name", "sale-api"),
          eq("spec.metrics.0.resource.target.averageUtilization", 55),
        ],
        solution: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: sale-api
  namespace: commerce
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: sale-api
  minReplicas: 6
  maxReplicas: 30
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 30
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 55
`,
      },
      {
        path: "worker-hpa.yaml",
        apiVersion: "autoscaling/v2",
        kind: "HorizontalPodAutoscaler",
        name: "sale-worker",
        namespace: "commerce",
        label: "Scale workers from ten to sixty against purchase queue depth",
        assertions: [
          eq("spec.minReplicas", 10),
          eq("spec.maxReplicas", 60),
          eq("spec.scaleTargetRef.name", "sale-worker"),
          eq("spec.metrics.0.external.metric.name", "purchase_queue_depth"),
          eq("spec.metrics.0.external.target.averageValue", "20"),
        ],
        solution: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: sale-worker
  namespace: commerce
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: sale-worker
  minReplicas: 10
  maxReplicas: 60
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
  metrics:
    - type: External
      external:
        metric:
          name: purchase_queue_depth
        target:
          type: AverageValue
          averageValue: "20"
`,
      },
      {
        path: "api-pdb.yaml",
        apiVersion: "policy/v1",
        kind: "PodDisruptionBudget",
        name: "sale-api",
        namespace: "commerce",
        label: "Keep four API replicas serving during a voluntary disruption",
        assertions: [eq("spec.selector.matchLabels.app", "sale-api")],
        solution: `apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: sale-api
  namespace: commerce
spec:
  minAvailable: 4
  selector:
    matchLabels:
      app: sale-api
`,
      },
      {
        path: "worker-pdb.yaml",
        apiVersion: "policy/v1",
        kind: "PodDisruptionBudget",
        name: "sale-worker",
        namespace: "commerce",
        label: "Keep eight warm workers available during voluntary disruption",
        assertions: [eq("spec.selector.matchLabels.app", "sale-worker")],
        solution: `apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: sale-worker
  namespace: commerce
spec:
  minAvailable: 8
  selector:
    matchLabels:
      app: sale-worker
`,
      },
      {
        path: "priority-class.yaml",
        apiVersion: "scheduling.k8s.io/v1",
        kind: "PriorityClass",
        name: "sale-critical",
        label: "Prioritize request admission without making the class a global default",
        assertions: [
          eq("value", 100000),
          eq("globalDefault", false),
          eq("preemptionPolicy", "PreemptLowerPriority"),
        ],
        solution: `apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: sale-critical
value: 100000
globalDefault: false
preemptionPolicy: PreemptLowerPriority
description: Preserve customer request admission during the bounded sale window.
`,
      },
    ],
    hintBodies: [
      "Separate first-minute headroom from eventual autoscaling. The warm replica floor must absorb metric and provisioning delay before new Pods can become Ready.",
      "CPU is a useful API demand signal, but queue workers should scale from outstanding work. Give each workload its own ceiling so their combined maximum stays inside the ninety-Pod budget.",
      "Priority protects the customer-facing API under pressure but can evict lower-priority work. Keep it non-default, bound resources, and preserve enough worker capacity to avoid moving the outage into the queue.",
    ],
    review: {
      risk: "The starter repository had no warm capacity, scaling signals, priority, disruption floor, or cost ceiling, so the initial traffic step could overload the API before autoscaling reacted.",
      reasoning:
        "Burst resilience needs capacity already running, valid resource requests, separate synchronous and asynchronous demand signals, and explicit maximums that fit the budget.",
      accepted:
        "The accepted design starts six API replicas and ten workers, scales them independently to thirty and sixty, protects four API replicas during drains, and records the operating contract.",
      tradeoffs:
        "Warm replicas cost money outside sale windows and high priority can displace other workloads. Those costs are bounded and deliberate because cold autoscaling cannot satisfy the two-minute arrival curve or the latency SLO alone.",
    },
    docsHref: "/docs/operations/autoscaling",
    recommendedNextSlugs: ["build-incident-survivable-observability"],
  },
  {
    id: "build-incident-survivable-observability",
    title: "Build Incident-Survivable Observability",
    severity: "critical",
    estimatedMinutes: 75,
    successRate: 24,
    concepts: [
      "deployments",
      "daemonsets",
      "services",
      "network-policies",
      "storage",
      "logs",
      "resources",
    ],
    capabilities: [
      "pods",
      "services",
      "deployments",
      "logs",
      "http-probes",
      "network-policy",
      "workload-controllers",
    ],
    blurb: "Make monitoring survive the same application and cluster failures it must explain.",
    story:
      "Checkout has a 99.95 percent availability target, but its existing dashboards disappear when the application namespace or in-cluster request path fails. Operators need a black-box probe deployed in the independent observability namespace, independent platform alerts, fifteen days of retained metrics, node-level collection, and a runbook contract. The central Prometheus pair may consume at most 8 CPU cores and 16 GiB of memory at peak. Node collectors are budgeted separately at no more than 250 millicores and 256 MiB per Linux worker.",
    objective:
      "Build layered observability with application metrics, node collection, an external probe, independent alerts, durable fifteen-day retention, restricted scrape access, and an owned runbook contract.",
    learningObjectives: [
      "Separate user-visible black-box monitoring from application-emitted white-box telemetry.",
      "Keep alert evaluation and retention independent of the workload failure domain.",
      "Control observability access, cardinality, storage, and resource cost as production requirements.",
    ],
    prerequisites: [
      "broken-service-chain",
      "healthy-app-broken-sidecar",
      "config-drift",
      "liveness-probe-death-spiral",
    ],
    files: [
      {
        path: "namespace.yaml",
        apiVersion: "v1",
        kind: "Namespace",
        name: "observability",
        label: "Keep monitoring in a failure domain separate from checkout",
        assertions: [
          eq("metadata.labels.owner", "sre"),
          eq("metadata.labels.failureDomain", "platform"),
          eq("metadata.labels.access", "checkout-metrics"),
        ],
        solution: `apiVersion: v1
kind: Namespace
metadata:
  name: observability
  labels:
    owner: sre
    failure-domain: platform
    failureDomain: platform
    access: checkout-metrics
`,
      },
      {
        path: "blackbox-exporter.yaml",
        apiVersion: "apps/v1",
        kind: "Deployment",
        name: "blackbox-exporter",
        namespace: "observability",
        label: "Run the black-box probe path independently from checkout",
        assertions: [
          eq("spec.replicas", 2),
          eq("spec.selector.matchLabels.app", "blackbox-exporter"),
          present("spec.template.spec.containers.0.resources.requests.cpu"),
          eq("spec.template.spec.containers.0.ports.0.containerPort", 9115),
          eq(
            "spec.template.spec.topologySpreadConstraints.0.topologyKey",
            "topology.kubernetes.io/zone",
          ),
          present("spec.template.spec.containers.0.readinessProbe.httpGet"),
        ],
        solution: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: blackbox-exporter
  namespace: observability
spec:
  replicas: 2
  selector:
    matchLabels:
      app: blackbox-exporter
  template:
    metadata:
      labels:
        app: blackbox-exporter
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: blackbox-exporter
      containers:
        - name: exporter
          image: quay.io/prometheus/blackbox-exporter:v0.27.0
          ports:
            - name: http
              containerPort: 9115
          resources:
            requests:
              cpu: 100m
              memory: 64Mi
            limits:
              cpu: 500m
              memory: 256Mi
          readinessProbe:
            httpGet:
              path: /-/healthy
              port: http
`,
      },
      {
        path: "blackbox-pdb.yaml",
        apiVersion: "policy/v1",
        kind: "PodDisruptionBudget",
        name: "blackbox-exporter",
        namespace: "observability",
        label: "Keep one independent probe available during voluntary disruption",
        assertions: [eq("spec.selector.matchLabels.app", "blackbox-exporter")],
        solution: `apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: blackbox-exporter
  namespace: observability
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: blackbox-exporter
`,
      },
      {
        path: "blackbox-service.yaml",
        apiVersion: "v1",
        kind: "Service",
        name: "blackbox-exporter",
        namespace: "observability",
        label: "Expose the independent probe endpoint only inside the cluster",
        assertions: [
          eq("spec.selector.app", "blackbox-exporter"),
          eq("spec.ports.0.port", 9115),
          eq("spec.ports.0.targetPort", "http"),
        ],
        solution: `apiVersion: v1
kind: Service
metadata:
  name: blackbox-exporter
  namespace: observability
spec:
  selector:
    app: blackbox-exporter
  ports:
    - name: http
      port: 9115
      targetPort: http
`,
      },
      {
        path: "node-collector.yaml",
        apiVersion: "apps/v1",
        kind: "DaemonSet",
        name: "node-collector",
        namespace: "observability",
        label: "Collect bounded node signals from every Linux worker",
        assertions: [
          eq("spec.selector.matchLabels.app", "node-collector"),
          eq("spec.template.spec.nodeSelector.nodeClass", "linux-worker"),
          eq("spec.template.spec.containers.0.ports.0.containerPort", 9100),
          eq("spec.template.spec.containers.0.volumeMounts.0.mountPath", "/host/proc"),
          eq("spec.template.spec.containers.0.volumeMounts.1.mountPath", "/host/sys"),
          present("spec.template.spec.containers.0.resources.requests.cpu"),
          present("spec.template.spec.containers.0.resources.limits.memory"),
        ],
        solution: `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-collector
  namespace: observability
spec:
  selector:
    matchLabels:
      app: node-collector
  template:
    metadata:
      labels:
        app: node-collector
    spec:
      hostNetwork: true
      hostPID: true
      nodeSelector:
        kubernetes.io/os: linux
        nodeClass: linux-worker
      containers:
        - name: collector
          image: quay.io/prometheus/node-exporter:v1.9.1
          args:
            - --path.procfs=/host/proc
            - --path.sysfs=/host/sys
            - --path.rootfs=/host/root
          ports:
            - name: metrics
              containerPort: 9100
          volumeMounts:
            - name: proc
              mountPath: /host/proc
              readOnly: true
            - name: sys
              mountPath: /host/sys
              readOnly: true
            - name: root
              mountPath: /host/root
              readOnly: true
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 250m
              memory: 256Mi
      volumes:
        - name: proc
          hostPath:
            path: /proc
            type: Directory
        - name: sys
          hostPath:
            path: /sys
            type: Directory
        - name: root
          hostPath:
            path: /
            type: Directory
`,
      },
      {
        path: "node-collector-service.yaml",
        apiVersion: "v1",
        kind: "Service",
        name: "node-collector",
        namespace: "observability",
        label: "Expose the node metrics port for discovery by Prometheus Operator",
        assertions: [
          eq("spec.selector.app", "node-collector"),
          eq("spec.ports.0.name", "metrics"),
          eq("spec.ports.0.port", 9100),
        ],
        solution: `apiVersion: v1
kind: Service
metadata:
  name: node-collector
  namespace: observability
  labels:
    app: node-collector
spec:
  selector:
    app: node-collector
  ports:
    - name: metrics
      port: 9100
      targetPort: metrics
`,
      },
      {
        path: "node-collector-monitor.yaml",
        apiVersion: "monitoring.coreos.com/v1",
        kind: "ServiceMonitor",
        name: "node-collector",
        namespace: "observability",
        label: "Scrape the node collector through its selected metrics Service",
        assertions: [
          eq("metadata.labels.monitoring", "platform"),
          eq("spec.selector.matchLabels.app", "node-collector"),
          eq("spec.endpoints.0.port", "metrics"),
          eq("spec.endpoints.0.interval", "30s"),
        ],
        solution: `apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: node-collector
  namespace: observability
  labels:
    monitoring: platform
spec:
  selector:
    matchLabels:
      app: node-collector
  endpoints:
    - port: metrics
      interval: 30s
      scrapeTimeout: 10s
`,
      },
      {
        path: "checkout-service-monitor.yaml",
        apiVersion: "monitoring.coreos.com/v1",
        kind: "ServiceMonitor",
        name: "checkout",
        namespace: "observability",
        label: "Scrape checkout metrics at a bounded interval through the named metrics port",
        assertions: [
          eq("metadata.labels.monitoring", "platform"),
          eq("spec.selector.matchLabels.app", "checkout"),
          eq("spec.namespaceSelector.matchNames.0", "checkout"),
          eq("spec.endpoints.0.port", "metrics"),
          eq("spec.endpoints.0.interval", "30s"),
        ],
        solution: `apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: checkout
  namespace: observability
  labels:
    monitoring: platform
spec:
  namespaceSelector:
    matchNames:
      - checkout
  selector:
    matchLabels:
      app: checkout
  endpoints:
    - port: metrics
      interval: 30s
      scrapeTimeout: 10s
`,
      },
      {
        path: "external-probe.yaml",
        apiVersion: "monitoring.coreos.com/v1",
        kind: "Probe",
        name: "checkout-external",
        namespace: "observability",
        label: "Probe checkout from an independent black-box path every thirty seconds",
        assertions: [
          eq("metadata.labels.monitoring", "platform"),
          eq("spec.interval", "30s"),
          eq("spec.module", "http_2xx"),
          eq("spec.prober.url", "blackbox-exporter.observability.svc:9115"),
          eq("spec.jobName", "checkout-external"),
          eq("spec.targets.staticConfig.static.0", "https://checkout.example.com/healthz"),
          eq("spec.targets.staticConfig.labels.probe", "checkout-external"),
        ],
        solution: `apiVersion: monitoring.coreos.com/v1
kind: Probe
metadata:
  name: checkout-external
  namespace: observability
  labels:
    monitoring: platform
spec:
  jobName: checkout-external
  interval: 30s
  module: http_2xx
  prober:
    url: blackbox-exporter.observability.svc:9115
  targets:
      staticConfig:
        static:
          - https://checkout.example.com/healthz
        labels:
          probe: checkout-external
`,
      },
      {
        path: "alerts.yaml",
        apiVersion: "monitoring.coreos.com/v1",
        kind: "PrometheusRule",
        name: "checkout-independent-alerts",
        namespace: "observability",
        label: "Alert separately on user-visible failure and missing internal telemetry",
        assertions: [
          eq("metadata.labels.monitoring", "platform"),
          eq("spec.groups.0.rules.0.alert", "CheckoutExternalProbeFailed"),
          eq("spec.groups.0.rules.0.expr", 'probe_success{probe="checkout-external"} == 0'),
          eq("spec.groups.0.rules.0.for", "2m"),
          eq("spec.groups.0.rules.1.alert", "CheckoutTelemetryMissing"),
          eq("spec.groups.0.rules.1.expr", 'absent(up{service="checkout"} == 1)'),
          eq("spec.groups.0.rules.1.for", "5m"),
        ],
        solution: `apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: checkout-independent-alerts
  namespace: observability
  labels:
    monitoring: platform
spec:
  groups:
    - name: checkout.slo
      rules:
        - alert: CheckoutExternalProbeFailed
          expr: probe_success{probe="checkout-external"} == 0
          for: 2m
          labels:
            severity: page
        - alert: CheckoutTelemetryMissing
          expr: absent(up{service="checkout"} == 1)
          for: 5m
          labels:
            severity: ticket
`,
      },
      {
        path: "prometheus-service-account.yaml",
        apiVersion: "v1",
        kind: "ServiceAccount",
        name: "platform-prometheus",
        namespace: "observability",
        label: "Give Prometheus a dedicated discovery identity",
        assertions: [eq("automountServiceAccountToken", true)],
        solution: `apiVersion: v1
kind: ServiceAccount
metadata:
  name: platform-prometheus
  namespace: observability
automountServiceAccountToken: true
`,
      },
      {
        path: "prometheus-discovery-role.yaml",
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "ClusterRole",
        name: "platform-prometheus-discovery",
        label: "Grant read-only Kubernetes target discovery without wildcard authority",
        assertions: [
          includes("rules.0.resources", "nodes"),
          includes("rules.0.resources", "pods"),
          includes("rules.0.resources", "services"),
          includes("rules.0.verbs", "get"),
          includes("rules.0.verbs", "list"),
          includes("rules.0.verbs", "watch"),
          includes("rules.1.resources", "endpointslices"),
        ],
        solution: `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: platform-prometheus-discovery
rules:
  - apiGroups: [""]
    resources: ["nodes", "nodes/metrics", "pods", "services", "endpoints"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["discovery.k8s.io"]
    resources: ["endpointslices"]
    verbs: ["get", "list", "watch"]
`,
      },
      {
        path: "prometheus-discovery-binding.yaml",
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "ClusterRoleBinding",
        name: "platform-prometheus-discovery",
        label: "Bind discovery authority only to the platform Prometheus identity",
        assertions: [
          eq("roleRef.kind", "ClusterRole"),
          eq("roleRef.name", "platform-prometheus-discovery"),
          eq("subjects.0.kind", "ServiceAccount"),
          eq("subjects.0.name", "platform-prometheus"),
          eq("subjects.0.namespace", "observability"),
        ],
        solution: `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: platform-prometheus-discovery
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: platform-prometheus-discovery
subjects:
  - kind: ServiceAccount
    name: platform-prometheus
    namespace: observability
`,
      },
      {
        path: "metrics-retention.yaml",
        apiVersion: "monitoring.coreos.com/v1",
        kind: "Prometheus",
        name: "platform",
        namespace: "observability",
        label: "Retain fifteen days of metrics on bounded persistent storage",
        assertions: [
          eq("spec.retention", "15d"),
          eq("spec.replicas", 2),
          eq("spec.serviceAccountName", "platform-prometheus"),
          eq("spec.resources.requests.cpu", "2"),
          eq("spec.resources.limits.cpu", "4"),
          eq("spec.resources.limits.memory", "8Gi"),
          eq("spec.storage.volumeClaimTemplate.spec.resources.requests.storage", "200Gi"),
          eq("spec.serviceMonitorSelector.matchLabels.monitoring", "platform"),
          eq("spec.probeSelector.matchLabels.monitoring", "platform"),
          eq("spec.ruleSelector.matchLabels.monitoring", "platform"),
        ],
        solution: `apiVersion: monitoring.coreos.com/v1
kind: Prometheus
metadata:
  name: platform
  namespace: observability
spec:
  replicas: 2
  serviceAccountName: platform-prometheus
  retention: 15d
  podMetadata:
    labels:
      prometheus: platform
  topologySpreadConstraints:
    - maxSkew: 1
      topologyKey: topology.kubernetes.io/zone
      whenUnsatisfiable: DoNotSchedule
      labelSelector:
        matchLabels:
          prometheus: platform
  serviceMonitorSelector:
    matchLabels:
      monitoring: platform
  probeSelector:
    matchLabels:
      monitoring: platform
  ruleSelector:
    matchLabels:
      monitoring: platform
  resources:
    requests:
      cpu: "2"
      memory: 4Gi
    limits:
      cpu: "4"
      memory: 8Gi
  storage:
    volumeClaimTemplate:
      spec:
        accessModes:
          - ReadWriteOnce
        resources:
          requests:
            storage: 200Gi
`,
      },
      {
        path: "prometheus-pdb.yaml",
        apiVersion: "policy/v1",
        kind: "PodDisruptionBudget",
        name: "platform-prometheus",
        namespace: "observability",
        label: "Keep one Prometheus evaluator available during voluntary disruption",
        assertions: [eq("spec.selector.matchLabels.prometheus", "platform")],
        solution: `apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: platform-prometheus
  namespace: observability
spec:
  minAvailable: 1
  selector:
    matchLabels:
      prometheus: platform
`,
      },
      {
        path: "scrape-policy.yaml",
        apiVersion: "networking.k8s.io/v1",
        kind: "NetworkPolicy",
        name: "checkout-metrics-ingress",
        namespace: "checkout",
        label: "Allow metrics ingress only from the observability namespace",
        assertions: [
          eq("spec.podSelector.matchLabels.app", "checkout"),
          eq("spec.ingress.0.from.0.namespaceSelector.matchLabels.access", "checkout-metrics"),
          eq("spec.ingress.0.ports.0.port", 9090),
        ],
        solution: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: checkout-metrics-ingress
  namespace: checkout
spec:
  podSelector:
    matchLabels:
      app: checkout
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              access: checkout-metrics
      ports:
        - protocol: TCP
          port: 9090
`,
      },
      {
        path: "runbook-contract.yaml",
        apiVersion: "v1",
        kind: "ConfigMap",
        name: "checkout-observability-contract",
        namespace: "observability",
        label: "Record SLO ownership, retention, and independent incident signals",
        assertions: [
          eq("data.owner", "checkout-sre"),
          eq("data.availabilitySlo", "99.95%"),
          eq("data.metricsRetention", "15d"),
          eq("data.primaryPage", "CheckoutExternalProbeFailed"),
        ],
        solution: `apiVersion: v1
kind: ConfigMap
metadata:
  name: checkout-observability-contract
  namespace: observability
data:
  owner: checkout-sre
  availabilitySlo: "99.95%"
  metricsRetention: 15d
  primaryPage: CheckoutExternalProbeFailed
  investigationOrder: external-probe,service-metrics,node-signals,application-logs
`,
      },
    ],
    hintBodies: [
      "Ask which monitoring path still works when checkout DNS, its namespace, or its Service path is the failure. At least one user-visible signal must be outside that dependency chain.",
      "An external probe reports impact, while service metrics and node collection localize cause. Alert separately when the impact path fails and when internal telemetry disappears.",
      "Retention and collection are capacity choices. Bound scrape interval, replica count, persistent storage, CPU, memory, and network access rather than treating observability as free infrastructure.",
    ],
    review: {
      risk: "The starter repository had no independent signal or durable evidence, so the same failure that harmed checkout could also erase the information needed to diagnose it.",
      reasoning:
        "Incident-survivable observability separates impact detection, cause localization, alert evaluation, and retention across different paths and failure domains.",
      accepted:
        "The accepted design combines an external probe, internal service metrics, node collection, independent alerts, fifteen-day retained metrics, restricted scraping, and an explicit SLO owner.",
      tradeoffs:
        "Longer retention and redundant evaluators consume storage and compute, while broad collection can create cardinality cost. The chosen bounds preserve fifteen days of evidence inside the stated resource budget.",
    },
    docsHref: "/docs/debugging/logs",
    recommendedNextSlugs: ["build-two-team-platform"],
  },
  {
    id: "build-two-team-platform",
    title: "Build a Two-Team Platform",
    severity: "critical",
    estimatedMinutes: 90,
    successRate: 19,
    concepts: [
      "namespaces",
      "rbac",
      "service-accounts",
      "resource-quotas",
      "limit-ranges",
      "security-contexts",
      "network-policies",
      "dns",
      "resources",
    ],
    capabilities: [
      "pods",
      "namespaces",
      "secrets",
      "configmaps",
      "network-policy",
      "scheduling",
      "dns",
    ],
    blurb:
      "Give two teams independent delivery boundaries without shared authority or unbounded resource consumption.",
    story:
      "The platform must onboard the atlas and beacon teams into one cluster. Each team receives a restricted namespace, bounded compute and storage, safe default container resources, an OIDC developer group, a separate workload automation identity, and default-deny traffic. Teams may manage ordinary workloads in their own namespace but cannot read Secrets, change RBAC, reach each other, or exhaust the cluster. The platform budget permits equal fixed quotas and no dedicated nodes.",
    objective:
      "Build symmetric namespace, quota, limit, identity, RBAC, Pod Security, and default-deny network guardrails for atlas and beacon.",
    learningObjectives: [
      "Combine namespace isolation, RBAC, network policy, and Pod Security into one tenant boundary.",
      "Use ResourceQuota and LimitRange to prevent noisy-neighbor failures while preserving team autonomy.",
      "Create symmetric, reviewable guardrails that do not grant Secret or RBAC administration.",
    ],
    prerequisites: [
      "namespace-confusion",
      "dns-resolution-failure",
      "private-registry-pull-secret",
      "rollout-cannot-fit-maxsurge",
    ],
    files: [
      ...(["atlas", "beacon"] as const).flatMap((team): ArchitectureFileSpec[] => [
        {
          path: `${team}-namespace.yaml`,
          apiVersion: "v1",
          kind: "Namespace",
          name: team,
          label: `Create the restricted ${team} tenant boundary with stable ownership labels`,
          assertions: [
            eq("metadata.labels.team", team),
            eq("metadata.labels.securityProfile", "restricted"),
            eq("/metadata/labels/pod-security.kubernetes.io~1enforce", "restricted"),
            eq("metadata.labels.tenantBoundary", "enforced"),
          ],
          solution: `apiVersion: v1
kind: Namespace
metadata:
  name: ${team}
  labels:
    team: ${team}
    securityProfile: restricted
    tenantBoundary: enforced
    kubernetes.io/metadata.name: ${team}
    pod-security.kubernetes.io/enforce: restricted
`,
        },
        {
          path: `${team}-quota.yaml`,
          apiVersion: "v1",
          kind: "ResourceQuota",
          name: "team-budget",
          namespace: team,
          label: `Cap ${team} at 20 CPU, 40 GiB memory, and 100 Pods`,
          assertions: [
            eq("/spec/hard/requests.cpu", "20"),
            eq("/spec/hard/requests.memory", "40Gi"),
            eq("/spec/hard/limits.cpu", "40"),
            eq("/spec/hard/limits.memory", "80Gi"),
            eq("spec.hard.pods", "100"),
            eq("spec.hard.secrets", "50"),
            eq("/spec/hard/requests.storage", "500Gi"),
            eq("spec.hard.persistentvolumeclaims", "20"),
            eq("/spec/hard/requests.ephemeral-storage", "200Gi"),
            eq("/spec/hard/limits.ephemeral-storage", "400Gi"),
            eq("spec.hard.services", "30"),
            eq("/spec/hard/services.loadbalancers", "2"),
          ],
          solution: `apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-budget
  namespace: ${team}
  labels:
    cpuBudget: "20"
    memoryBudget: 40Gi
spec:
  hard:
    requests.cpu: "20"
    requests.memory: 40Gi
    limits.cpu: "40"
    limits.memory: 80Gi
    pods: "100"
    secrets: "50"
    requests.storage: 500Gi
    persistentvolumeclaims: "20"
    requests.ephemeral-storage: 200Gi
    limits.ephemeral-storage: 400Gi
    services: "30"
    services.loadbalancers: "2"
`,
        },
        {
          path: `${team}-limits.yaml`,
          apiVersion: "v1",
          kind: "LimitRange",
          name: "container-defaults",
          namespace: team,
          label: `Provide safe request and limit defaults for ${team} containers`,
          assertions: [
            eq("spec.limits.0.type", "Container"),
            eq("spec.limits.0.defaultRequest.cpu", "100m"),
            eq("spec.limits.0.defaultRequest.memory", "128Mi"),
            eq("spec.limits.0.default.cpu", "1"),
            eq("spec.limits.0.default.memory", "1Gi"),
          ],
          solution: `apiVersion: v1
kind: LimitRange
metadata:
  name: container-defaults
  namespace: ${team}
spec:
  limits:
    - type: Container
      defaultRequest:
        cpu: 100m
        memory: 128Mi
      default:
        cpu: "1"
        memory: 1Gi
`,
        },
        {
          path: `${team}-automation-identity.yaml`,
          apiVersion: "v1",
          kind: "ServiceAccount",
          name: "team-automation",
          namespace: team,
          label: `Create a dedicated ${team} workload automation identity without automatic token mounting`,
          assertions: [
            eq("automountServiceAccountToken", false),
            eq("metadata.labels.team", team),
            eq("metadata.labels.purpose", "workload-automation"),
          ],
          solution: `apiVersion: v1
kind: ServiceAccount
metadata:
  name: team-automation
  namespace: ${team}
  labels:
    team: ${team}
    purpose: workload-automation
automountServiceAccountToken: false
`,
        },
        {
          path: `${team}-role.yaml`,
          apiVersion: "rbac.authorization.k8s.io/v1",
          kind: "Role",
          name: "team-developer",
          namespace: team,
          label: `Let ${team} manage workloads without Secret or RBAC authority`,
          assertions: [
            eq("rules.0.apiGroups.0", "apps"),
            includes("rules.0.resources", "deployments"),
            includes("rules.0.resources", "statefulsets"),
            includes("rules.0.verbs", "get"),
            includes("rules.0.verbs", "patch"),
            includes("rules.1.resources", "services"),
            includes("rules.1.resources", "configmaps"),
            includes("rules.1.resources", "pods"),
          ],
          solution: `apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: team-developer
  namespace: ${team}
rules:
  - apiGroups:
      - apps
    resources:
      - deployments
      - statefulsets
    verbs:
      - get
      - list
      - watch
      - create
      - update
      - patch
      - delete
  - apiGroups:
      - ""
    resources:
      - services
      - configmaps
      - pods
    verbs:
      - get
      - list
      - watch
      - create
      - update
      - patch
      - delete
`,
        },
        {
          path: `${team}-role-binding.yaml`,
          apiVersion: "rbac.authorization.k8s.io/v1",
          kind: "RoleBinding",
          name: "team-developer",
          namespace: team,
          label: `Bind only the ${team} developer identity to its namespace Role`,
          assertions: [
            eq("roleRef.kind", "Role"),
            eq("roleRef.name", "team-developer"),
            eq("subjects.0.kind", "Group"),
            eq("subjects.0.name", `${team}-developers`),
            eq("subjects.0.apiGroup", "rbac.authorization.k8s.io"),
          ],
          solution: `apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: team-developer
  namespace: ${team}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: team-developer
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: ${team}-developers
`,
        },
        {
          path: `${team}-automation-binding.yaml`,
          apiVersion: "rbac.authorization.k8s.io/v1",
          kind: "RoleBinding",
          name: "team-automation",
          namespace: team,
          label: `Bind the ${team} automation identity to the same bounded workload contract`,
          assertions: [
            eq("roleRef.kind", "Role"),
            eq("roleRef.name", "team-developer"),
            eq("subjects.0.kind", "ServiceAccount"),
            eq("subjects.0.name", "team-automation"),
            eq("subjects.0.namespace", team),
          ],
          solution: `apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: team-automation
  namespace: ${team}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: team-developer
subjects:
  - kind: ServiceAccount
    name: team-automation
    namespace: ${team}
`,
        },
        {
          path: `${team}-default-deny.yaml`,
          apiVersion: "networking.k8s.io/v1",
          kind: "NetworkPolicy",
          name: "default-deny",
          namespace: team,
          label: `Deny unspecified ingress and egress for every ${team} Pod`,
          assertions: [
            emptyObject("spec.podSelector"),
            eq("spec.policyTypes.0", "Ingress"),
            eq("spec.policyTypes.1", "Egress"),
          ],
          solution: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: ${team}
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
`,
        },
        {
          path: `${team}-dns-egress.yaml`,
          apiVersion: "networking.k8s.io/v1",
          kind: "NetworkPolicy",
          name: "allow-cluster-dns",
          namespace: team,
          label: `Preserve DNS for ${team} without opening arbitrary egress`,
          assertions: [
            emptyObject("spec.podSelector"),
            eq(
              "/spec/egress/0/to/0/namespaceSelector/matchLabels/kubernetes.io~1metadata.name",
              "kube-system",
            ),
            eq("/spec/egress/0/to/0/podSelector/matchLabels/k8s-app", "kube-dns"),
            eq("spec.egress.0.ports.0.port", 53),
            eq("spec.egress.0.ports.0.protocol", "UDP"),
            eq("spec.egress.0.ports.1.protocol", "TCP"),
          ],
          solution: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-cluster-dns
  namespace: ${team}
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
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
      ]),
    ],
    hintBodies: [
      "Review each tenant across four independent controls: API authorization, network reachability, admission security, and resource consumption. A namespace alone provides none of these guarantees.",
      "Make atlas and beacon symmetric. Shared Role definitions are useful, but each RoleBinding and namespaced resource must remain inside its own tenant boundary.",
      "Default resource limits protect the cluster but can surprise workloads. Publish the defaults, let teams override them inside quota, and alert before quota saturation becomes a deployment outage.",
    ],
    review: {
      risk: "The starter repository treated namespaces as complete isolation, leaving both teams able to consume unbounded resources and without explicit authorization, security, or network defaults.",
      reasoning:
        "Safe multi-tenancy is the intersection of API, network, runtime, and capacity boundaries. Weakness in any one plane lets a tenant affect another team or the shared cluster.",
      accepted:
        "The accepted design gives atlas and beacon symmetric restricted namespaces, fixed budgets, container defaults, scoped workload-management roles, dedicated identities, default-deny networking, and narrow cluster DNS access.",
      tradeoffs:
        "Equal fixed quotas are predictable but may strand capacity when one team is idle. Start with explicit budgets and usage telemetry, then adjust through reviewed policy rather than relying on unrestricted bursting.",
    },
    docsHref: "/docs/operations/quotas-limitranges",
    recommendedNextSlugs: ["build-signed-promotion-pipeline"],
  },
  {
    id: "build-signed-promotion-pipeline",
    title: "Build a Signed Promotion Pipeline",
    severity: "critical",
    estimatedMinutes: 90,
    successRate: 18,
    concepts: [
      "secrets",
      "service-accounts",
      "rbac",
      "admission-controllers",
      "rollouts",
      "network-policies",
      "reconciliation",
    ],
    capabilities: ["pods", "deployments", "secrets", "image-pulls", "network-policy", "rollouts"],
    blurb:
      "Promote only signed immutable artifacts while retaining an auditable, tightly bounded emergency path.",
    story:
      "Production releases must use immutable image digests signed by the trusted CI identity. The normal promoter may update only the checkout Deployment, and admission must reject unsigned, tag-only, or unapproved-registry images. During a verified release outage, an incident commander may use a separate break-glass identity to roll that one Deployment back to a previously verified signed digest. The signature gate remains enforced. The cluster audit policy already streams production Deployment patches to an immutable SIEM, and the access broker issues short-lived bound tokens only when an incident ticket is approved. The platform already operates a registry egress gateway in a trusted namespace, and release automation may reach the registry only through that gateway plus cluster DNS.",
    objective:
      "Build a promotion pipeline, digest-pinned workload, signature admission policy, least-privilege promoter, registry-only egress, and a distinct resource-scoped break-glass path.",
    learningObjectives: [
      "Separate build, verification, promotion, admission, and emergency authorization responsibilities.",
      "Use immutable digests and signature verification to bind deployment intent to a reviewed artifact.",
      "Design break-glass access as narrow, separate, and auditable instead of disabling policy globally.",
    ],
    prerequisites: [
      "private-registry-pull-secret",
      "rolling-update-gone-wrong",
      "immutable-deployment-selector",
      "graceful-shutdown-502s",
    ],
    files: [
      {
        path: "namespace.yaml",
        apiVersion: "v1",
        kind: "Namespace",
        name: "delivery",
        label: "Create an owned restricted boundary for release automation",
        assertions: [
          eq("metadata.labels.owner", "release-engineering"),
          eq("metadata.labels.securityProfile", "restricted"),
          eq("/metadata/labels/pod-security.kubernetes.io~1enforce", "restricted"),
        ],
        solution: `apiVersion: v1
kind: Namespace
metadata:
  name: delivery
  labels:
    owner: release-engineering
    securityProfile: restricted
    pod-security.kubernetes.io/enforce: restricted
`,
      },
      {
        path: "production-namespace.yaml",
        apiVersion: "v1",
        kind: "Namespace",
        name: "production",
        label: "Create the restricted target boundary for production workloads",
        assertions: [
          eq("metadata.labels.environment", "production"),
          eq("metadata.labels.securityProfile", "restricted"),
          eq("/metadata/labels/pod-security.kubernetes.io~1enforce", "restricted"),
        ],
        solution: `apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    environment: production
    securityProfile: restricted
    pod-security.kubernetes.io/enforce: restricted
`,
      },
      {
        path: "pipeline.yaml",
        apiVersion: "tekton.dev/v1",
        kind: "Pipeline",
        name: "signed-promotion",
        namespace: "delivery",
        label: "Resolve a digest, verify its signature, and promote only the verified result",
        assertions: [
          eq("spec.params.0.name", "imageDigest"),
          eq("spec.tasks.0.name", "verify-signature"),
          eq("spec.tasks.0.taskRef.name", "cosign-verify"),
          eq("spec.tasks.0.params.0.value", "registry.example/checkout@$(params.imageDigest)"),
          eq("spec.tasks.1.name", "promote-checkout"),
          eq("spec.tasks.1.runAfter.0", "verify-signature"),
          eq("spec.tasks.1.taskRef.name", "patch-deployment-digest"),
          eq("spec.tasks.1.params.1.value", "registry.example/checkout@$(params.imageDigest)"),
        ],
        solution: `apiVersion: tekton.dev/v1
kind: Pipeline
metadata:
  name: signed-promotion
  namespace: delivery
spec:
  params:
    - name: imageDigest
      type: string
  tasks:
    - name: verify-signature
      taskRef:
        name: cosign-verify
      params:
        - name: image
          value: registry.example/checkout@$(params.imageDigest)
    - name: promote-checkout
      runAfter:
        - verify-signature
      taskRef:
        name: patch-deployment-digest
      params:
        - name: deployment
          value: checkout
        - name: image
          value: registry.example/checkout@$(params.imageDigest)
`,
      },
      {
        path: "cosign-verify-task.yaml",
        apiVersion: "tekton.dev/v1",
        kind: "Task",
        name: "cosign-verify",
        namespace: "delivery",
        label: "Provide the concrete signature-verification task referenced by the pipeline",
        assertions: [
          eq("spec.params.0.name", "image"),
          eq("spec.steps.0.name", "verify"),
          eq(
            "spec.steps.0.image",
            "registry.example/tools/cosign@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          ),
          includes("spec.steps.0.args", "verify"),
          includes(
            "spec.steps.0.args",
            "--certificate-identity=https://github.com/rhythmshandlya/klab/.github/workflows/release.yml@refs/heads/main",
          ),
          includes(
            "spec.steps.0.args",
            "--certificate-oidc-issuer=https://token.actions.githubusercontent.com",
          ),
          includes("spec.steps.0.args", "$(params.image)"),
        ],
        solution: `apiVersion: tekton.dev/v1
kind: Task
metadata:
  name: cosign-verify
  namespace: delivery
spec:
  params:
    - name: image
      type: string
  steps:
    - name: verify
      image: registry.example/tools/cosign@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
      args:
        - verify
        - --certificate-identity=https://github.com/rhythmshandlya/klab/.github/workflows/release.yml@refs/heads/main
        - --certificate-oidc-issuer=https://token.actions.githubusercontent.com
        - $(params.image)
`,
      },
      {
        path: "pipeline-run.yaml",
        apiVersion: "tekton.dev/v1",
        kind: "PipelineRun",
        name: "signed-promotion-run",
        namespace: "delivery",
        label: "Run the promotion pipeline with the dedicated promoter identity",
        assertions: [
          eq("spec.pipelineRef.name", "signed-promotion"),
          eq("spec.taskRunTemplate.serviceAccountName", "release-promoter"),
          eq("metadata.labels.promotion", "signed"),
          matches("spec.params.0.value", "^sha256:[a-f0-9]{64}$"),
        ],
        solution: `apiVersion: tekton.dev/v1
kind: PipelineRun
metadata:
  name: signed-promotion-run
  namespace: delivery
  labels:
    promotion: signed
spec:
  pipelineRef:
    name: signed-promotion
  taskRunTemplate:
    serviceAccountName: release-promoter
  params:
    - name: imageDigest
      value: sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
`,
      },
      {
        path: "patch-deployment-task.yaml",
        apiVersion: "tekton.dev/v1",
        kind: "Task",
        name: "patch-deployment-digest",
        namespace: "delivery",
        label: "Provide the resource-scoped promotion task referenced by the pipeline",
        assertions: [
          eq("spec.params.0.name", "deployment"),
          eq("spec.params.1.name", "image"),
          eq("spec.steps.0.name", "promote"),
          notMatches("spec.steps.0.script", "kubectl apply"),
        ],
        solution: `apiVersion: tekton.dev/v1
kind: Task
metadata:
  name: patch-deployment-digest
  namespace: delivery
spec:
  params:
    - name: deployment
      type: string
    - name: image
      type: string
  steps:
    - name: promote
      image: registry.example/tools/kubectl@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
      script: |
        kubectl set image deployment/$(params.deployment) checkout=$(params.image) -n production
`,
      },
      {
        path: "checkout-deployment.yaml",
        apiVersion: "apps/v1",
        kind: "Deployment",
        name: "checkout",
        namespace: "production",
        label: "Deploy checkout by immutable digest with provenance annotations",
        assertions: [
          eq(
            "spec.template.spec.containers.0.image",
            "registry.example/checkout@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          ),
          eq("metadata.labels.signaturePolicy", "trusted-ci"),
          present("metadata.labels.sourceRevision"),
          eq("spec.strategy.rollingUpdate.maxUnavailable", 0),
        ],
        solution: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout
  namespace: production
  labels:
    signaturePolicy: trusted-ci
    sourceRevision: 8f31c2a
  annotations:
    klab.dev/signature-policy: trusted-ci
    klab.dev/source-revision: 8f31c2a
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
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
          image: registry.example/checkout@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
`,
      },
      {
        path: "signature-policy.yaml",
        apiVersion: "policies.kyverno.io/v1",
        kind: "ImageValidatingPolicy",
        name: "verify-production-images",
        label: "Enforce signatures from trusted CI for production registry images",
        assertions: [
          includes("spec.validationActions", "Deny"),
          eq("spec.failurePolicy", "Fail"),
          eq("spec.matchConstraints.resourceRules.0.apiGroups.0", "apps"),
          eq("spec.matchConstraints.resourceRules.0.apiVersions.0", "v1"),
          includes("spec.matchConstraints.resourceRules.0.operations", "CREATE"),
          includes("spec.matchConstraints.resourceRules.0.operations", "UPDATE"),
          eq("spec.matchConstraints.resourceRules.0.resources.0", "deployments"),
          eq("spec.matchConditions.0.expression", "object.metadata.namespace == 'production'"),
          eq("spec.matchImageReferences.0.glob", "*"),
          eq("spec.validationConfigurations.mutateDigest", false),
          eq("spec.validationConfigurations.required", true),
          eq("spec.validationConfigurations.verifyDigest", true),
          eq(
            "spec.attestors.0.cosign.keyless.identities.0.subject",
            "https://github.com/rhythmshandlya/klab/.github/workflows/release.yml@refs/heads/main",
          ),
          eq(
            "spec.attestors.0.cosign.keyless.identities.0.issuer",
            "https://token.actions.githubusercontent.com",
          ),
          eq(
            "spec.validations.0.expression",
            "object.spec.template.spec.containers.all(container, container.image.startsWith('registry.example/') && container.image.contains('@sha256:'))",
          ),
          eq(
            "spec.validations.1.expression",
            "images.containers.map(image, verifyImageSignatures(image, [attestors.trustedCi])).all(result, result > 0)",
          ),
        ],
        solution: `apiVersion: policies.kyverno.io/v1
kind: ImageValidatingPolicy
metadata:
  name: verify-production-images
  annotations:
    policies.klab.dev/owner: supply-chain-security
spec:
  validationActions:
    - Deny
  failurePolicy: Fail
  evaluation:
    background:
      enabled: true
  matchConstraints:
    resourceRules:
      - apiGroups:
          - apps
        apiVersions:
          - v1
        operations:
          - CREATE
          - UPDATE
        resources:
          - deployments
  matchConditions:
    - name: production-only
      expression: object.metadata.namespace == 'production'
  matchImageReferences:
    - glob: "*"
  validationConfigurations:
    mutateDigest: false
    required: true
    verifyDigest: true
  attestors:
    - name: trustedCi
      cosign:
        keyless:
          identities:
            - subject: https://github.com/rhythmshandlya/klab/.github/workflows/release.yml@refs/heads/main
              issuer: https://token.actions.githubusercontent.com
        ctlog:
          url: https://rekor.sigstore.dev
  validations:
    - expression: object.spec.template.spec.containers.all(container, container.image.startsWith('registry.example/') && container.image.contains('@sha256:'))
      message: Production images must use an approved registry and immutable sha256 digest.
    - expression: images.containers.map(image, verifyImageSignatures(image, [attestors.trustedCi])).all(result, result > 0)
      message: Production images must carry a valid trusted CI signature.
`,
      },
      {
        path: "promoter-service-account.yaml",
        apiVersion: "v1",
        kind: "ServiceAccount",
        name: "release-promoter",
        namespace: "delivery",
        label: "Use a dedicated identity for routine signed promotion",
        assertions: [
          eq("automountServiceAccountToken", true),
          eq("metadata.labels.purpose", "signed-promotion"),
        ],
        solution: `apiVersion: v1
kind: ServiceAccount
metadata:
  name: release-promoter
  namespace: delivery
  labels:
    purpose: signed-promotion
automountServiceAccountToken: true
`,
      },
      {
        path: "promoter-role.yaml",
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "Role",
        name: "release-promoter",
        namespace: "production",
        label: "Allow routine promotion to patch only the checkout Deployment",
        assertions: [
          eq("rules.0.apiGroups.0", "apps"),
          eq("rules.0.resources.0", "deployments"),
          eq("rules.0.resourceNames.0", "checkout"),
          includes("rules.0.verbs", "get"),
          includes("rules.0.verbs", "patch"),
        ],
        solution: `apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: release-promoter
  namespace: production
rules:
  - apiGroups:
      - apps
    resources:
      - deployments
    resourceNames:
      - checkout
    verbs:
      - get
      - patch
`,
      },
      {
        path: "promoter-binding.yaml",
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "RoleBinding",
        name: "release-promoter",
        namespace: "production",
        label: "Bind routine production patch authority only to the release-promoter identity",
        assertions: [
          eq("roleRef.name", "release-promoter"),
          eq("subjects.0.name", "release-promoter"),
          eq("subjects.0.namespace", "delivery"),
        ],
        solution: `apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: release-promoter
  namespace: production
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: release-promoter
subjects:
  - kind: ServiceAccount
    name: release-promoter
    namespace: delivery
`,
      },
      {
        path: "break-glass-service-account.yaml",
        apiVersion: "v1",
        kind: "ServiceAccount",
        name: "release-break-glass",
        namespace: "delivery",
        label: "Keep emergency promotion identity separate and visibly owned by incident command",
        assertions: [
          eq("automountServiceAccountToken", false),
          eq("metadata.labels.purpose", "break-glass"),
          eq("metadata.labels.audit", "required"),
        ],
        solution: `apiVersion: v1
kind: ServiceAccount
metadata:
  name: release-break-glass
  namespace: delivery
  labels:
    purpose: break-glass
    audit: required
  annotations:
    klab.dev/audit: required
automountServiceAccountToken: false
`,
      },
      {
        path: "break-glass-role.yaml",
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "Role",
        name: "release-break-glass",
        namespace: "production",
        label: "Scope emergency patch authority to the checkout Deployment only",
        assertions: [
          eq("rules.0.resources.0", "deployments"),
          eq("rules.0.resourceNames.0", "checkout"),
          includes("rules.0.verbs", "get"),
          includes("rules.0.verbs", "patch"),
        ],
        solution: `apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: release-break-glass
  namespace: production
rules:
  - apiGroups:
      - apps
    resources:
      - deployments
    resourceNames:
      - checkout
    verbs:
      - get
      - patch
`,
      },
      {
        path: "break-glass-binding.yaml",
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "RoleBinding",
        name: "release-break-glass",
        namespace: "production",
        label: "Bind the emergency Role only to the separately audited break-glass identity",
        assertions: [
          eq("roleRef.name", "release-break-glass"),
          eq("subjects.0.name", "release-break-glass"),
          eq("subjects.0.namespace", "delivery"),
        ],
        solution: `apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: release-break-glass
  namespace: production
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: release-break-glass
subjects:
  - kind: ServiceAccount
    name: release-break-glass
    namespace: delivery
`,
      },
      {
        path: "break-glass-ticket-policy.yaml",
        apiVersion: "admissionregistration.k8s.io/v1",
        kind: "ValidatingAdmissionPolicy",
        name: "require-break-glass-incident-ticket",
        label: "Require an incident ticket on every emergency checkout change",
        assertions: [
          eq("spec.failurePolicy", "Fail"),
          eq(
            "spec.matchConditions.0.expression",
            "request.userInfo.username == 'system:serviceaccount:delivery:release-break-glass'",
          ),
          eq("spec.matchConditions.1.expression", "object.metadata.name == 'checkout'"),
          eq(
            "spec.validations.0.expression",
            "'incident.klab.dev/ticket' in object.metadata.?annotations.orValue({}) && object.metadata.annotations['incident.klab.dev/ticket'].matches('^INC-[0-9]+$')",
          ),
        ],
        solution: `apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: require-break-glass-incident-ticket
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: ["apps"]
        apiVersions: ["v1"]
        operations: ["UPDATE"]
        resources: ["deployments"]
  matchConditions:
    - name: break-glass-identity
      expression: request.userInfo.username == 'system:serviceaccount:delivery:release-break-glass'
    - name: checkout-only
      expression: object.metadata.name == 'checkout'
  validations:
    - expression: "'incident.klab.dev/ticket' in object.metadata.?annotations.orValue({}) && object.metadata.annotations['incident.klab.dev/ticket'].matches('^INC-[0-9]+$')"
      message: Break-glass changes require an approved INC ticket annotation.
`,
      },
      {
        path: "break-glass-ticket-binding.yaml",
        apiVersion: "admissionregistration.k8s.io/v1",
        kind: "ValidatingAdmissionPolicyBinding",
        name: "require-break-glass-incident-ticket",
        label: "Enforce the incident-ticket policy for production workloads",
        assertions: [
          eq("spec.policyName", "require-break-glass-incident-ticket"),
          includes("spec.validationActions", "Deny"),
          eq("spec.matchResources.namespaceSelector.matchLabels.environment", "production"),
        ],
        solution: `apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: require-break-glass-incident-ticket
spec:
  policyName: require-break-glass-incident-ticket
  validationActions:
    - Deny
  matchResources:
    namespaceSelector:
      matchLabels:
        environment: production
`,
      },
      {
        path: "registry-egress.yaml",
        apiVersion: "networking.k8s.io/v1",
        kind: "NetworkPolicy",
        name: "registry-only-egress",
        namespace: "delivery",
        label: "Permit release automation egress only to the trusted registry gateway",
        assertions: [
          eq("/spec/podSelector/matchLabels/tekton.dev~1pipelineRun", "signed-promotion-run"),
          eq("spec.policyTypes.0", "Egress"),
          eq("spec.egress.0.to.0.namespaceSelector.matchLabels.registry-access", "trusted"),
          eq("spec.egress.0.to.0.podSelector.matchLabels.app", "registry-egress-gateway"),
          eq("spec.egress.0.ports.0.port", 443),
          eq(
            "/spec/egress/1/to/0/namespaceSelector/matchLabels/kubernetes.io~1metadata.name",
            "kube-system",
          ),
          eq("spec.egress.1.ports.0.port", 53),
        ],
        solution: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: registry-only-egress
  namespace: delivery
spec:
  podSelector:
    matchLabels:
      tekton.dev/pipelineRun: signed-promotion-run
  policyTypes:
    - Egress
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              registry-access: trusted
          podSelector:
            matchLabels:
              app: registry-egress-gateway
      ports:
        - protocol: TCP
          port: 443
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
    ],
    hintBodies: [
      "Follow the artifact identity from pipeline parameter to Deployment image. A mutable tag anywhere in that chain breaks the reviewed-artifact guarantee.",
      "Signature admission and RBAC solve different problems. Admission verifies what may run, while the promoter Role limits who may change the one production target.",
      "Break glass must be narrower and more visible than normal access, not a signature-policy disable. Limit it to a previously signed digest, separate the identity, scope it by resource name, and require audit metadata for every use.",
    ],
    review: {
      risk: "The starter repository had no immutable artifact identity, signature gate, promotion authority boundary, or controlled emergency path, allowing unreviewed images or broad production patches.",
      reasoning:
        "Supply-chain integrity requires an unbroken chain from digest resolution through signature verification, admission enforcement, resource-scoped promotion, and auditable emergency rollback.",
      accepted:
        "The accepted design verifies a digest before promotion, pins checkout to that digest, enforces trusted signatures, limits normal and emergency patch rights to one Deployment, and restricts registry egress.",
      tradeoffs:
        "Strict signature enforcement blocks new releases when signing infrastructure fails. The separate break-glass account can restore only a previously signed digest for one named workload, preserving the trust boundary while reducing recovery time.",
    },
    docsHref: "/docs/operations/crds-operators-admission",
    recommendedNextSlugs: [],
  },
];

export const ARCHITECTURE_BUILD_LEVELS: ProblemLevel[] = BUILD_SPECS.map(buildLevel);

export const ARCHITECTURE_BUILD_SOLUTIONS: Record<
  string,
  Record<string, string>
> = Object.fromEntries(
  BUILD_SPECS.map((spec) => [
    spec.id,
    Object.fromEntries(spec.files.map((file) => [file.path, file.solution])),
  ]),
);
