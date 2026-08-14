import type { ArchitectureBuildSpec } from "./spec";
import { eq, includes, lengthEquals, present } from "./spec";

export const buildIncidentSurvivableObservability: ArchitectureBuildSpec = {
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
    "Checkout has a 99.95 percent availability target, but its existing dashboards disappear when the application namespace or Service path fails. Operators need a black-box probe of the public endpoint from the independent observability namespace, independent platform alerts, fifteen days of retained metrics, node-level collection, and a runbook contract. Each black-box replica is limited to 500 millicores and 256 MiB. Each of the two Prometheus replicas may consume at most 4 CPU cores and 8 GiB of memory and receives 200 GiB of persistent storage. Node collectors are budgeted separately at no more than 250 millicores and 256 MiB per Linux worker.",
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
        eq("metadata.labels.failure-domain", "platform"),
        eq("metadata.labels.access", "checkout-metrics"),
      ],
      solution: `apiVersion: v1
kind: Namespace
metadata:
  name: observability
  labels:
    owner: sre
    failure-domain: platform
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
        eq("spec.template.metadata.labels.app", "blackbox-exporter"),
        present("spec.template.spec.containers[name=exporter].image"),
        present("spec.template.spec.containers[name=exporter].resources.requests.cpu"),
        present("spec.template.spec.containers[name=exporter].resources.requests.memory"),
        present("spec.template.spec.containers[name=exporter].resources.limits.cpu"),
        present("spec.template.spec.containers[name=exporter].resources.limits.memory"),
        eq("spec.template.spec.containers[name=exporter].ports[name=http].containerPort", 9115),
        eq(
          "spec.template.spec.topologySpreadConstraints[topologyKey=topology.kubernetes.io/zone].topologyKey",
          "topology.kubernetes.io/zone",
        ),
        eq(
          "spec.template.spec.topologySpreadConstraints[topologyKey=topology.kubernetes.io/zone].maxSkew",
          1,
        ),
        eq(
          "spec.template.spec.topologySpreadConstraints[topologyKey=topology.kubernetes.io/zone].whenUnsatisfiable",
          "DoNotSchedule",
        ),
        eq(
          "spec.template.spec.topologySpreadConstraints[topologyKey=topology.kubernetes.io/zone].labelSelector.matchLabels.app",
          "blackbox-exporter",
        ),
        present("spec.template.spec.containers[name=exporter].readinessProbe.httpGet"),
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
        {
          path: "spec.type",
          operator: "not-matches",
          value: "^(NodePort|LoadBalancer|ExternalName)$",
        },
        eq("spec.selector.app", "blackbox-exporter"),
        eq("spec.ports[name=http].port", 9115),
        eq("spec.ports[name=http].targetPort", "http"),
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
        eq("spec.template.metadata.labels.app", "node-collector"),
        eq("/spec/template/spec/nodeSelector/kubernetes.io~1os", "linux"),
        eq("spec.template.spec.hostNetwork", true),
        eq("spec.template.spec.hostPID", true),
        present("spec.template.spec.containers[name=collector].image"),
        eq("spec.template.spec.containers[name=collector].ports[name=metrics].containerPort", 9100),
        includes("spec.template.spec.containers[name=collector].args", "--path.procfs=/host/proc"),
        includes("spec.template.spec.containers[name=collector].args", "--path.sysfs=/host/sys"),
        includes("spec.template.spec.containers[name=collector].args", "--path.rootfs=/host/root"),
        eq(
          "spec.template.spec.containers[name=collector].volumeMounts[mountPath=/host/proc].mountPath",
          "/host/proc",
        ),
        eq(
          "spec.template.spec.containers[name=collector].volumeMounts[mountPath=/host/sys].mountPath",
          "/host/sys",
        ),
        eq(
          "spec.template.spec.containers[name=collector].volumeMounts[mountPath=/host/root].mountPath",
          "/host/root",
        ),
        eq(
          "spec.template.spec.containers[name=collector].volumeMounts[mountPath=/host/proc].readOnly",
          true,
        ),
        eq(
          "spec.template.spec.containers[name=collector].volumeMounts[mountPath=/host/sys].readOnly",
          true,
        ),
        eq(
          "spec.template.spec.containers[name=collector].volumeMounts[mountPath=/host/root].readOnly",
          true,
        ),
        eq("spec.template.spec.volumes[name=proc].hostPath.path", "/proc"),
        eq("spec.template.spec.volumes[name=sys].hostPath.path", "/sys"),
        eq("spec.template.spec.volumes[name=root].hostPath.path", "/"),
        present("spec.template.spec.containers[name=collector].resources.requests.cpu"),
        present("spec.template.spec.containers[name=collector].resources.requests.memory"),
        present("spec.template.spec.containers[name=collector].resources.limits.cpu"),
        present("spec.template.spec.containers[name=collector].resources.limits.memory"),
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
        {
          path: "spec.type",
          operator: "not-matches",
          value: "^(NodePort|LoadBalancer|ExternalName)$",
        },
        eq("spec.selector.app", "node-collector"),
        eq("spec.ports[name=metrics].name", "metrics"),
        eq("spec.ports[name=metrics].port", 9100),
        eq("spec.ports[name=metrics].targetPort", "metrics"),
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
        lengthEquals("spec.endpoints", 1),
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
        lengthEquals("spec.namespaceSelector.matchNames", 1),
        eq("spec.namespaceSelector.matchNames.0", "checkout"),
        {
          path: "spec.namespaceSelector.any",
          operator: "not-equals",
          value: true,
        },
        lengthEquals("spec.endpoints", 1),
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
        lengthEquals("spec.targets.staticConfig.static", 1),
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
        lengthEquals("spec.groups", 1),
        eq("spec.groups.0.name", "checkout.slo"),
        lengthEquals("spec.groups.0.rules", 2),
        eq(
          "spec.groups.0.rules[alert=CheckoutExternalProbeFailed].expr",
          '(probe_success{probe="checkout-external"} == 0) or absent(probe_success{probe="checkout-external"})',
        ),
        eq("spec.groups.0.rules[alert=CheckoutExternalProbeFailed].for", "2m"),
        eq("spec.groups.0.rules[alert=CheckoutExternalProbeFailed].labels.severity", "page"),
        eq(
          "spec.groups.0.rules[alert=CheckoutTelemetryMissing].expr",
          'absent(up{service="checkout"} == 1)',
        ),
        eq("spec.groups.0.rules[alert=CheckoutTelemetryMissing].for", "5m"),
        eq("spec.groups.0.rules[alert=CheckoutTelemetryMissing].labels.severity", "ticket"),
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
          expr: (probe_success{probe="checkout-external"} == 0) or absent(probe_success{probe="checkout-external"})
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
        eq("subjects[name=platform-prometheus].kind", "ServiceAccount"),
        eq("subjects[name=platform-prometheus].name", "platform-prometheus"),
        eq("subjects[name=platform-prometheus].namespace", "observability"),
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
        present("spec.resources.requests.cpu"),
        present("spec.resources.requests.memory"),
        present("spec.resources.limits.cpu"),
        present("spec.resources.limits.memory"),
        eq("spec.storage.volumeClaimTemplate.spec.resources.requests.storage", "200Gi"),
        includes("spec.storage.volumeClaimTemplate.spec.accessModes", "ReadWriteOnce"),
        eq("spec.serviceMonitorSelector.matchLabels.monitoring", "platform"),
        eq("spec.probeSelector.matchLabels.monitoring", "platform"),
        eq("spec.ruleSelector.matchLabels.monitoring", "platform"),
        eq("spec.topologySpreadConstraints[topologyKey=topology.kubernetes.io/zone].maxSkew", 1),
        eq(
          "spec.topologySpreadConstraints[topologyKey=topology.kubernetes.io/zone].whenUnsatisfiable",
          "DoNotSchedule",
        ),
        eq(
          "spec.topologySpreadConstraints[topologyKey=topology.kubernetes.io/zone].labelSelector.matchLabels.prometheus",
          "platform",
        ),
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
        eq("spec.ingress.0.ports[port=9090].port", 9090),
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
  semanticPolicy: {
    disruptionBudgets: {
      "blackbox-exporter": { baseline: 2, minimumAvailable: 1 },
      "platform-prometheus": { baseline: 2, minimumAvailable: 1 },
    },
    rbacContracts: [
      {
        appliesTo: "ClusterRole",
        violation: "exceeds read-only target discovery authority",
        exactRuleCount: 2,
        allowedRules: [
          {
            apiGroups: ["discovery.k8s.io"],
            resources: ["endpointslices"],
            verbs: ["get", "list", "watch"],
          },
          {
            apiGroups: [""],
            resources: ["nodes", "nodes/metrics", "pods", "services", "endpoints"],
            verbs: ["get", "list", "watch"],
          },
        ],
      },
    ],
    networkPolicyContracts: [
      {
        name: "checkout-metrics-ingress",
        namespace: "checkout",
        podSelector: { app: "checkout" },
        policyTypes: ["Ingress"],
        ingress: [
          {
            namespaceSelector: { access: "checkout-metrics" },
            port: { protocol: "TCP", port: 9090 },
          },
        ],
      },
    ],
    resourceBudgets: [
      {
        kind: "Deployment",
        name: "blackbox-exporter",
        namespace: "observability",
        container: "exporter",
        maxRequestCpu: "500m",
        maxRequestMemory: "256Mi",
        maxLimitCpu: "500m",
        maxLimitMemory: "256Mi",
      },
      {
        kind: "DaemonSet",
        name: "node-collector",
        namespace: "observability",
        container: "collector",
        maxRequestCpu: "250m",
        maxRequestMemory: "256Mi",
        maxLimitCpu: "250m",
        maxLimitMemory: "256Mi",
      },
      {
        kind: "Prometheus",
        name: "platform",
        namespace: "observability",
        container: "prometheus",
        resourcesPath: "spec.resources",
        maxRequestCpu: "4",
        maxRequestMemory: "8Gi",
        maxLimitCpu: "4",
        maxLimitMemory: "8Gi",
      },
    ],
  },
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
};
