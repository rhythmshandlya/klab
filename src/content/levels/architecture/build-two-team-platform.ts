import type { ArchitectureBuildSpec, ArchitectureFileSpec } from "./spec";
import { emptyObject, eq, includes, lengthEquals } from "./spec";

export const buildTwoTeamPlatform: ArchitectureBuildSpec = {
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
          lengthEquals("spec.limits", 1),
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
          eq("roleRef.apiGroup", "rbac.authorization.k8s.io"),
          eq("roleRef.kind", "Role"),
          eq("roleRef.name", "team-developer"),
          lengthEquals("subjects", 1),
          eq(`subjects[name=${team}-developers].kind`, "Group"),
          eq(`subjects[name=${team}-developers].name`, `${team}-developers`),
          eq(`subjects[name=${team}-developers].apiGroup`, "rbac.authorization.k8s.io"),
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
          eq("roleRef.apiGroup", "rbac.authorization.k8s.io"),
          eq("roleRef.kind", "Role"),
          eq("roleRef.name", "team-developer"),
          lengthEquals("subjects", 1),
          eq("subjects[name=team-automation].kind", "ServiceAccount"),
          eq("subjects[name=team-automation].name", "team-automation"),
          eq("subjects[name=team-automation].namespace", team),
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
  semanticPolicy: {
    rbacContracts: [
      {
        appliesTo: "Role",
        violation: "crosses the tenant security boundary",
        exactRuleCount: 2,
        allowedRules: [
          {
            apiGroups: ["apps"],
            resources: ["deployments", "statefulsets"],
            verbs: ["create", "delete", "get", "list", "patch", "update", "watch"],
          },
          {
            apiGroups: [""],
            resources: ["configmaps", "pods", "services"],
            verbs: ["create", "delete", "get", "list", "patch", "update", "watch"],
          },
        ],
      },
    ],
    networkPolicyContracts: (["atlas", "beacon"] as const).flatMap((team) => [
      {
        name: "default-deny",
        namespace: team,
        podSelector: {},
        policyTypes: ["Ingress", "Egress"] as const,
        ingress: [],
        egress: [],
      },
      {
        name: "allow-cluster-dns",
        namespace: team,
        podSelector: {},
        policyTypes: ["Egress"] as const,
        egress: [
          {
            namespaceSelector: { "kubernetes.io/metadata.name": "kube-system" },
            podSelector: { "k8s-app": "kube-dns" },
            port: { protocol: "UDP" as const, port: 53 },
          },
          {
            namespaceSelector: { "kubernetes.io/metadata.name": "kube-system" },
            podSelector: { "k8s-app": "kube-dns" },
            port: { protocol: "TCP" as const, port: 53 },
          },
        ],
      },
    ]),
  },
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
};
