import type { ArchitectureBuildSpec } from "./spec";
import { eq, includes, lengthEquals, present } from "./spec";

const ALL_PRODUCTION_IMAGES =
  "object.spec.template.spec.containers.map(container, container.image) + object.spec.template.spec.?initContainers.orValue([]).map(container, container.image)";
const APPROVED_DIGEST_IMAGES =
  "variables.allImages.all(image, image.matches('^registry[.]example/.+@sha256:[a-f0-9]{64}$'))";
const TRUSTED_SIGNATURES =
  "variables.allImages.map(image, verifyImageSignatures(image, [attestors.trustedCi])).all(result, result > 0)";

export const buildSignedPromotionPipeline: ArchitectureBuildSpec = {
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
    "Production releases must use immutable image digests signed by the trusted CI identity. The normal promoter may update only the checkout Deployment, and admission must reject unsigned, tag-only, or unapproved-registry images. During a verified release outage, an incident commander may use a separate break-glass identity to roll that one Deployment back to a previously verified signed digest. The signature gate remains enforced. The cluster audit policy already streams production Deployment patches to an immutable SIEM, and the access broker issues short-lived bound tokens only when an incident ticket is approved. Tekton is configured to set security contexts on its injected sidecars so TaskRuns satisfy Restricted Pod Security. The platform already operates a registry egress gateway in a trusted namespace, and release automation may reach the registry only through that gateway plus cluster DNS; signature bundles are available with the OCI artifacts for offline verification.",
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
        lengthEquals("spec.params", 1),
        eq("spec.params[name=imageDigest].type", "string"),
        lengthEquals("spec.tasks", 2),
        eq("spec.tasks[name=verify-signature].taskRef.name", "cosign-verify"),
        eq(
          "spec.tasks[name=verify-signature].params[name=image].value",
          "registry.example/checkout@$(params.imageDigest)",
        ),
        eq("spec.tasks[name=promote-checkout].taskRef.name", "patch-deployment-digest"),
        includes("spec.tasks[name=promote-checkout].runAfter", "verify-signature"),
        eq("spec.tasks[name=promote-checkout].params[name=deployment].value", "checkout"),
        eq(
          "spec.tasks[name=promote-checkout].params[name=image].value",
          "registry.example/checkout@$(params.imageDigest)",
        ),
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
        lengthEquals("spec.params", 1),
        eq("spec.params[name=image].type", "string"),
        lengthEquals("spec.steps", 1),
        eq("spec.steps[name=verify].name", "verify"),
        eq(
          "spec.steps[name=verify].image",
          "registry.example/tools/cosign@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        ),
        includes("spec.steps[name=verify].args", "verify"),
        includes(
          "spec.steps[name=verify].args",
          "--certificate-identity=https://github.com/rhythmshandlya/klab/.github/workflows/release.yml@refs/heads/main",
        ),
        includes(
          "spec.steps[name=verify].args",
          "--certificate-oidc-issuer=https://token.actions.githubusercontent.com",
        ),
        includes("spec.steps[name=verify].args", "--offline"),
        includes("spec.steps[name=verify].args", "$(params.image)"),
        eq("spec.stepTemplate.securityContext.allowPrivilegeEscalation", false),
        eq("spec.stepTemplate.securityContext.runAsNonRoot", true),
        includes("spec.stepTemplate.securityContext.capabilities.drop", "ALL"),
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
        - --offline
        - $(params.image)
  stepTemplate:
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop:
          - ALL
      runAsNonRoot: true
      runAsUser: 65532
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
        lengthEquals("spec.params", 1),
        eq(
          "spec.params[name=imageDigest].value",
          "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ),
        eq("spec.taskRunTemplate.podTemplate.securityContext.runAsNonRoot", true),
        eq("spec.taskRunTemplate.podTemplate.securityContext.runAsUser", 65532),
        eq(
          "spec.taskRunTemplate.podTemplate.securityContext.seccompProfile.type",
          "RuntimeDefault",
        ),
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
    podTemplate:
      securityContext:
        runAsNonRoot: true
        runAsUser: 65532
        seccompProfile:
          type: RuntimeDefault
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
        lengthEquals("spec.params", 2),
        eq("spec.params[name=deployment].type", "string"),
        eq("spec.params[name=image].type", "string"),
        lengthEquals("spec.steps", 1),
        eq("spec.steps[name=promote].name", "promote"),
        eq("spec.steps[name=promote].command.0", "kubectl"),
        lengthEquals("spec.steps[name=promote].args", 7),
        eq("spec.steps[name=promote].args.0", "set"),
        eq("spec.steps[name=promote].args.1", "image"),
        eq("spec.steps[name=promote].args.2", "deployment/$(params.deployment)"),
        eq("spec.steps[name=promote].args.3", "checkout=$(params.image)"),
        eq("spec.steps[name=promote].args.4", "-n"),
        eq("spec.steps[name=promote].args.5", "production"),
        eq("spec.steps[name=promote].args.6", "--record=false"),
        eq("spec.stepTemplate.securityContext.allowPrivilegeEscalation", false),
        eq("spec.stepTemplate.securityContext.runAsNonRoot", true),
        includes("spec.stepTemplate.securityContext.capabilities.drop", "ALL"),
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
      command:
        - kubectl
      args:
        - set
        - image
        - deployment/$(params.deployment)
        - checkout=$(params.image)
        - -n
        - production
        - --record=false
  stepTemplate:
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop:
          - ALL
      runAsNonRoot: true
      runAsUser: 65532
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
          "spec.template.spec.containers[name=checkout].image",
          "registry.example/checkout@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ),
        eq("metadata.labels.signaturePolicy", "trusted-ci"),
        present("metadata.labels.sourceRevision"),
        eq("spec.strategy.rollingUpdate.maxUnavailable", 0),
      ],
      goals: [{ goal: "zero-downtime-rollout", maxSurge: 1 }],
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
      securityContext:
        runAsNonRoot: true
        runAsUser: 65532
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: checkout
          image: registry.example/checkout@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /readyz
              port: http
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
            limits:
              cpu: "1"
              memory: 1Gi
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL
`,
    },
    {
      path: "signature-policy.yaml",
      apiVersion: "policies.kyverno.io/v1",
      kind: "ImageValidatingPolicy",
      name: "verify-production-images",
      label: "Enforce signatures from trusted CI for production registry images",
      assertions: [
        lengthEquals("spec.validationActions", 1),
        includes("spec.validationActions", "Deny"),
        eq("spec.failurePolicy", "Fail"),
        eq("spec.matchConstraints.resourceRules.0.apiGroups.0", "apps"),
        eq("spec.matchConstraints.resourceRules.0.apiVersions.0", "v1"),
        includes("spec.matchConstraints.resourceRules.0.operations", "CREATE"),
        includes("spec.matchConstraints.resourceRules.0.operations", "UPDATE"),
        eq("spec.matchConstraints.resourceRules.0.resources.0", "deployments"),
        lengthEquals("spec.matchConstraints.resourceRules", 1),
        lengthEquals("spec.matchConstraints.resourceRules.0.operations", 2),
        lengthEquals("spec.matchConstraints.resourceRules.0.resources", 1),
        lengthEquals("spec.matchConditions", 1),
        eq("spec.matchConditions.0.expression", "object.metadata.namespace == 'production'"),
        eq("spec.matchImageReferences.0.glob", "*"),
        lengthEquals("spec.matchImageReferences", 1),
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
        lengthEquals("spec.attestors", 1),
        lengthEquals("spec.attestors.0.cosign.keyless.identities", 1),
        lengthEquals("spec.variables", 1),
        eq("spec.variables.0.name", "allImages"),
        eq("spec.variables.0.expression", ALL_PRODUCTION_IMAGES),
        lengthEquals("spec.validations", 2),
        eq("spec.validations.0.expression", APPROVED_DIGEST_IMAGES),
        eq("spec.validations.1.expression", TRUSTED_SIGNATURES),
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
  variables:
    - name: allImages
      expression: ${ALL_PRODUCTION_IMAGES}
  validations:
    - expression: ${APPROVED_DIGEST_IMAGES}
      message: Production images must use an approved registry and immutable sha256 digest.
    - expression: ${TRUSTED_SIGNATURES}
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
        eq("roleRef.apiGroup", "rbac.authorization.k8s.io"),
        eq("roleRef.kind", "Role"),
        eq("roleRef.name", "release-promoter"),
        lengthEquals("subjects", 1),
        eq("subjects[name=release-promoter].kind", "ServiceAccount"),
        eq("subjects[name=release-promoter].name", "release-promoter"),
        eq("subjects[name=release-promoter].namespace", "delivery"),
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
        eq("roleRef.apiGroup", "rbac.authorization.k8s.io"),
        eq("roleRef.kind", "Role"),
        eq("roleRef.name", "release-break-glass"),
        lengthEquals("subjects", 1),
        eq("subjects[name=release-break-glass].kind", "ServiceAccount"),
        eq("subjects[name=release-break-glass].name", "release-break-glass"),
        eq("subjects[name=release-break-glass].namespace", "delivery"),
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
        lengthEquals("spec.matchConstraints.resourceRules", 1),
        lengthEquals("spec.matchConstraints.resourceRules.0.operations", 1),
        lengthEquals("spec.matchConstraints.resourceRules.0.resources", 1),
        lengthEquals("spec.matchConditions", 2),
        eq(
          "spec.matchConditions.0.expression",
          "request.userInfo.username == 'system:serviceaccount:delivery:release-break-glass'",
        ),
        eq("spec.matchConditions.1.expression", "object.metadata.name == 'checkout'"),
        eq(
          "spec.validations.0.expression",
          "'incident.klab.dev/ticket' in object.metadata.?annotations.orValue({}) && object.metadata.annotations['incident.klab.dev/ticket'].matches('^INC-[0-9]+$')",
        ),
        lengthEquals("spec.validations", 1),
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
        lengthEquals("spec.validationActions", 1),
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
        eq("spec.egress.0.ports[port=443].port", 443),
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
  semanticPolicy: {
    podSecurity: "hardened",
    rbacContracts: [
      {
        appliesTo: "Role",
        violation: "exceeds checkout-only promotion authority",
        exactRuleCount: 1,
        allowedRules: [
          {
            apiGroups: ["apps"],
            resources: ["deployments"],
            resourceNames: ["checkout"],
            verbs: ["get", "patch"],
          },
        ],
      },
    ],
    taskContracts: [
      {
        task: "cosign-verify",
        stepCount: 1,
        image:
          "registry.example/tools/cosign@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        args: [
          "verify",
          "--certificate-identity=https://github.com/rhythmshandlya/klab/.github/workflows/release.yml@refs/heads/main",
          "--certificate-oidc-issuer=https://token.actions.githubusercontent.com",
          "--offline",
          "$(params.image)",
        ],
        violation: "must verify the submitted image with the trusted CI keyless identity",
      },
      {
        task: "patch-deployment-digest",
        stepCount: 1,
        image:
          "registry.example/tools/kubectl@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        args: [
          "set",
          "image",
          "deployment/$(params.deployment)",
          "checkout=$(params.image)",
          "-n",
          "production",
          "--record=false",
        ],
        violation: "must promote only the submitted digest to checkout in production",
      },
    ],
    pipelineContract: {
      digestParam: "imageDigest",
      pinnedImage: "registry.example/checkout@$(params.imageDigest)",
      tasks: [
        { name: "verify-signature", taskRef: "cosign-verify" },
        { name: "promote-checkout", taskRef: "patch-deployment-digest" },
      ],
      violation: "must verify and promote the same checkout digest in sequence",
    },
    signaturePolicyContract: {
      name: "verify-production-images",
      imageVariable: { name: "allImages", expression: ALL_PRODUCTION_IMAGES },
      validations: [APPROVED_DIGEST_IMAGES, TRUSTED_SIGNATURES],
      violation:
        "must apply the exact trusted-registry and signature checks to every regular and init container image",
    },
    networkPolicyContracts: [
      {
        name: "registry-only-egress",
        namespace: "delivery",
        podSelector: { "tekton.dev/pipelineRun": "signed-promotion-run" },
        policyTypes: ["Egress"],
        egress: [
          {
            namespaceSelector: { "registry-access": "trusted" },
            podSelector: { app: "registry-egress-gateway" },
            port: { protocol: "TCP", port: 443 },
          },
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
    ],
  },
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
};
