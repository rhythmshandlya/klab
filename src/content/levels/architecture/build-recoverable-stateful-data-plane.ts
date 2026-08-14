import type { ArchitectureBuildSpec } from "./spec";
import { eq, gte, includes, lengthEquals, lte, matches } from "./spec";

export const buildRecoverableStatefulDataPlane: ArchitectureBuildSpec = {
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
      assertions: [
        eq("metadata.labels.owner", "data-platform"),
        eq("/metadata/labels/pod-security.kubernetes.io~1enforce", "restricted"),
      ],
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
        lengthEquals("spec.ports", 1),
        eq("spec.ports[name=database].port", 5432),
        eq("spec.ports[name=database].targetPort", "database"),
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
      targetPort: database
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
        gte("spec.template.spec.terminationGracePeriodSeconds", 60),
        eq("spec.template.spec.securityContext.runAsNonRoot", true),
        eq("spec.template.spec.securityContext.seccompProfile.type", "RuntimeDefault"),
        {
          path: "/spec/template/spec/nodeSelector/topology.kubernetes.io~1zone",
          operator: "absent",
        },
        matches(
          "spec.template.spec.initContainers[name=verify-data-volume].image",
          "@sha256:[a-f0-9]{64}$",
        ),
        lengthEquals("spec.template.spec.initContainers[name=verify-data-volume].command", 3),
        eq(
          "spec.template.spec.initContainers[name=verify-data-volume].command.2",
          "test -w /var/lib/postgresql/data",
        ),
        eq(
          "spec.template.spec.initContainers[name=verify-data-volume].volumeMounts[name=data].mountPath",
          "/var/lib/postgresql/data",
        ),
        eq(
          "spec.template.spec.initContainers[name=verify-data-volume].securityContext.allowPrivilegeEscalation",
          false,
        ),
        includes(
          "spec.template.spec.initContainers[name=verify-data-volume].securityContext.capabilities.drop",
          "ALL",
        ),
        matches("spec.template.spec.containers[name=database].image", "@sha256:[a-f0-9]{64}$"),
        eq("spec.template.spec.containers[name=database].ports[name=database].containerPort", 5432),
        eq(
          "spec.template.spec.containers[name=database].readinessProbe.exec.command.0",
          "pg_isready",
        ),
        eq(
          "spec.template.spec.containers[name=database].volumeMounts[name=data].mountPath",
          "/var/lib/postgresql/data",
        ),
        eq(
          "spec.template.spec.containers[name=database].securityContext.allowPrivilegeEscalation",
          false,
        ),
        includes(
          "spec.template.spec.containers[name=database].securityContext.capabilities.drop",
          "ALL",
        ),
        lengthEquals("spec.volumeClaimTemplates", 1),
        eq("spec.volumeClaimTemplates.0.metadata.name", "data"),
        eq("spec.volumeClaimTemplates.0.spec.storageClassName", "zonal-rwo"),
        lengthEquals("spec.volumeClaimTemplates.0.spec.accessModes", 1),
        includes("spec.volumeClaimTemplates.0.spec.accessModes", "ReadWriteOnce"),
        eq("spec.volumeClaimTemplates.0.spec.resources.requests.storage", "100Gi"),
      ],
      goals: [
        {
          goal: "spreads-across-topology",
          topologyKey: "topology.kubernetes.io/zone",
          maxSkew: 1,
        },
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
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
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
            - test -w /var/lib/postgresql/data
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
            allowPrivilegeEscalation: false
            capabilities:
              drop: [ALL]
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
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: [ALL]
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
      label: "Retain quorum by keeping two database members available during voluntary disruption",
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
        gte("spec.jobTemplate.spec.activeDeadlineSeconds", 1),
        lte("spec.jobTemplate.spec.activeDeadlineSeconds", 840),
        eq("spec.jobTemplate.spec.template.spec.serviceAccountName", "orders-db-backup"),
        eq("spec.jobTemplate.spec.template.spec.restartPolicy", "Never"),
        eq("spec.jobTemplate.spec.template.spec.securityContext.runAsNonRoot", true),
        eq(
          "spec.jobTemplate.spec.template.spec.securityContext.seccompProfile.type",
          "RuntimeDefault",
        ),
        lengthEquals("spec.jobTemplate.spec.template.spec.containers", 1),
        matches(
          "spec.jobTemplate.spec.template.spec.containers[name=backup].image",
          "@sha256:[a-f0-9]{64}$",
        ),
        lengthEquals("spec.jobTemplate.spec.template.spec.containers[name=backup].args", 3),
        eq("spec.jobTemplate.spec.template.spec.containers[name=backup].args.0", "backup"),
        eq("spec.jobTemplate.spec.template.spec.containers[name=backup].args.1", "orders-db"),
        eq(
          "spec.jobTemplate.spec.template.spec.containers[name=backup].args.2",
          "gs://orders-ledger-backups",
        ),
        eq(
          "spec.jobTemplate.spec.template.spec.containers[name=backup].securityContext.allowPrivilegeEscalation",
          false,
        ),
        includes(
          "spec.jobTemplate.spec.template.spec.containers[name=backup].securityContext.capabilities.drop",
          "ALL",
        ),
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
      activeDeadlineSeconds: 840
      template:
        spec:
          serviceAccountName: orders-db-backup
          restartPolicy: Never
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
            seccompProfile:
              type: RuntimeDefault
          containers:
            - name: backup
              image: registry.example/db-tools@sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd
              args:
                - backup
                - orders-db
                - gs://orders-ledger-backups
              securityContext:
                allowPrivilegeEscalation: false
                capabilities:
                  drop: [ALL]
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
        lengthEquals("spec.accessModes", 1),
        includes("spec.accessModes", "ReadWriteOnce"),
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
        gte("spec.activeDeadlineSeconds", 1),
        lte("spec.activeDeadlineSeconds", 3600),
        eq("spec.template.spec.restartPolicy", "Never"),
        eq("spec.template.spec.serviceAccountName", "orders-db-backup"),
        eq("spec.template.spec.securityContext.runAsNonRoot", true),
        eq("spec.template.spec.securityContext.seccompProfile.type", "RuntimeDefault"),
        lengthEquals("spec.template.spec.volumes", 1),
        eq(
          "spec.template.spec.volumes[name=restore].persistentVolumeClaim.claimName",
          "restore-validation",
        ),
        lengthEquals("spec.template.spec.containers", 1),
        matches("spec.template.spec.containers[name=restore-check].image", "@sha256:[a-f0-9]{64}$"),
        lengthEquals("spec.template.spec.containers[name=restore-check].args", 3),
        eq("spec.template.spec.containers[name=restore-check].args.0", "restore-and-verify"),
        eq("spec.template.spec.containers[name=restore-check].args.1", "latest-backup"),
        eq(
          "spec.template.spec.containers[name=restore-check].args.2",
          "gs://orders-ledger-backups",
        ),
        lengthEquals("spec.template.spec.containers[name=restore-check].volumeMounts", 1),
        eq(
          "spec.template.spec.containers[name=restore-check].volumeMounts[name=restore].mountPath",
          "/restore",
        ),
        eq(
          "spec.template.spec.containers[name=restore-check].securityContext.allowPrivilegeEscalation",
          false,
        ),
        includes(
          "spec.template.spec.containers[name=restore-check].securityContext.capabilities.drop",
          "ALL",
        ),
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
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      volumes:
        - name: restore
          persistentVolumeClaim:
            claimName: restore-validation
      containers:
        - name: restore-check
          image: registry.example/db-tools@sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd
          args:
            - restore-and-verify
            - latest-backup
            - gs://orders-ledger-backups
          volumeMounts:
            - name: restore
              mountPath: /restore
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: [ALL]
`,
    },
  ],
  semanticPolicy: {
    disruptionBudgets: { "orders-db": { baseline: 3, minimumAvailable: 2 } },
  },
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
};
