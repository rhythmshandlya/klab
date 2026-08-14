import type { ArchitectureBuildSpec } from "./spec";
import { eq, excludes, includes, present, validBase64 } from "./spec";

export const buildHardenedAdminWorkload: ArchitectureBuildSpec = {
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
      assertions: [
        eq("type", "Opaque"),
        validBase64("/data/token"),
        { path: "data", operator: "length-equals", value: 1 },
      ],
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
        { path: "rules", operator: "length-equals", value: 2 },
        excludes("rules.0.verbs", "delete"),
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
        eq("roleRef.apiGroup", "rbac.authorization.k8s.io"),
        { path: "subjects", operator: "length-equals", value: 1 },
        eq("subjects[name=admin-console].kind", "ServiceAccount"),
        eq("subjects[name=admin-console].name", "admin-console"),
        eq("subjects[name=admin-console].namespace", "admin-system"),
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
        eq(
          "spec.template.spec.containers[name=admin].securityContext.readOnlyRootFilesystem",
          true,
        ),
        eq(
          "spec.template.spec.containers[name=admin].securityContext.allowPrivilegeEscalation",
          false,
        ),
        eq("spec.template.spec.containers[name=admin].securityContext.capabilities.drop.0", "ALL"),
        present("spec.template.spec.containers[name=admin].resources.requests.cpu"),
        present("spec.template.spec.containers[name=admin].resources.requests.memory"),
        present("spec.template.spec.containers[name=admin].resources.limits.cpu"),
        present("spec.template.spec.containers[name=admin].resources.limits.memory"),
        { path: "spec.template.spec.volumes", operator: "length-equals", value: 1 },
        eq(
          "spec.template.spec.volumes[name=maintenance-token].secret.secretName",
          "maintenance-token",
        ),
        {
          path: "spec.template.spec.containers[name=admin].volumeMounts",
          operator: "length-equals",
          value: 1,
        },
        eq(
          "spec.template.spec.containers[name=admin].volumeMounts[name=maintenance-token].name",
          "maintenance-token",
        ),
        eq(
          "spec.template.spec.containers[name=admin].volumeMounts[name=maintenance-token].readOnly",
          true,
        ),
        present(
          "spec.template.spec.containers[name=admin].volumeMounts[name=maintenance-token].mountPath",
        ),
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
      assertions: [
        eq("spec.type", "ClusterIP"),
        eq("spec.selector.app", "admin-console"),
        { path: "spec.externalIPs", operator: "absent" },
        { path: "spec.ports", operator: "length-equals", value: 1 },
        eq("spec.ports[name=https].port", 443),
        eq("spec.ports[name=https].targetPort", 8443),
      ],
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
        includes("spec.policyTypes", "Ingress"),
        eq("spec.ingress.0.from.0.namespaceSelector.matchLabels.access", "admin-console"),
        eq("spec.ingress.0.ports[port=8443].port", 8443),
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
  semanticPolicy: {
    podSecurity: "hardened",
    rbacContracts: [
      {
        appliesTo: "Role",
        violation: "grants authority outside the maintenance contract",
        exactRuleCount: 2,
        allowedRules: [
          {
            apiGroups: [""],
            resources: ["secrets"],
            resourceNames: ["maintenance-token"],
            verbs: ["get"],
          },
          {
            apiGroups: [""],
            resources: ["configmaps"],
            resourceNames: ["maintenance-window"],
            verbs: ["get", "patch"],
          },
        ],
      },
    ],
    networkPolicyContracts: [
      {
        name: "admin-console-private",
        namespace: "admin-system",
        podSelector: { app: "admin-console" },
        policyTypes: ["Ingress"],
        ingress: [
          {
            namespaceSelector: { access: "admin-console" },
            port: { protocol: "TCP", port: 8443 },
          },
        ],
      },
    ],
  },
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
};
