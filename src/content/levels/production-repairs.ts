import type { ProblemLevel } from "@/lib/domain/types";

import { PUBLISHED_PROBLEM_V1 } from "./metadata";

type ManifestConstraint = Extract<ProblemLevel["constraints"][number], { kind: "manifest" }>;

interface ProductionRepairSpec {
  number: number;
  slug: string;
  title: string;
  difficulty: "intermediate" | "advanced";
  severity: ProblemLevel["severity"];
  estimatedMinutes: number;
  successRate: number;
  concepts: ProblemLevel["concepts"];
  learningPaths: ProblemLevel["learningPaths"];
  capabilities: ProblemLevel["capabilities"];
  blurb: string;
  story: string;
  objective: string;
  learningObjectives: string[];
  file: string;
  readonlyFiles?: Array<{
    path: string;
    initialValue: string;
  }>;
  resource: ManifestConstraint["resource"];
  initial: string;
  solution: string;
  assertions: ManifestConstraint["assertions"];
  commands: [string, string, string, string];
  symptom: string;
  finding: string;
  fix: string;
  prevention: string;
  hints: [string, string, string];
  docsHref: string;
  incidentSource?: NonNullable<ProblemLevel["incidentSource"]>;
}

const fictionalAdaptation = (detail: string): string =>
  `This is a fictional KLab adaptation inspired by the source. It is not an exact reproduction. ${detail}`;

const incident = (
  title: string,
  href: string,
  detail: string,
): NonNullable<ProblemLevel["incidentSource"]> => ({
  title,
  href,
  attribution: "inspired-by",
  adaptationNote: fictionalAdaptation(detail),
});

const SPECS: ProductionRepairSpec[] = [
  {
    number: 22,
    slug: "all-replicas-one-failure-domain",
    title: "All Replicas, One Failure Domain",
    difficulty: "intermediate",
    severity: "critical",
    estimatedMinutes: 30,
    successRate: 49,
    concepts: ["deployments", "scheduling", "disruptions", "debugging"],
    learningPaths: ["reliability", "sre-on-call"],
    capabilities: ["deployments", "pods", "nodes", "scheduling", "events"],
    blurb: "Three replicas looked redundant until one zone failure removed all three.",
    story:
      "A checkout API has three healthy replicas, but the scheduler placed every Pod in zone-a. A routine zone interruption now causes a complete outage even though the replica count and readiness dashboard looked healthy.",
    objective:
      "Require checkout replicas to spread across zones so one failure domain cannot remove the entire service.",
    learningObjectives: [
      "Distinguish replica count from failure-domain redundancy.",
      "Configure topology spread with a schedulable fallback policy.",
    ],
    file: "deployment.yaml",
    resource: { kind: "Deployment", name: "checkout", namespace: "payments" },
    initial: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout
  namespace: payments
spec:
  replicas: 3
  selector:
    matchLabels:
      app: checkout
  template:
    metadata:
      labels:
        app: checkout
    spec:
      containers:
        - name: api
          image: registry.example/checkout@sha256:4c104c104c104c104c104c104c104c104c104c104c104c104c104c104c104c10
`,
    solution: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout
  namespace: payments
spec:
  replicas: 3
  selector:
    matchLabels:
      app: checkout
  template:
    metadata:
      labels:
        app: checkout
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: checkout
      containers:
        - name: api
          image: registry.example/checkout@sha256:4c104c104c104c104c104c104c104c104c104c104c104c104c104c104c104c10
`,
    assertions: [
      {
        path: "spec.template.spec.topologySpreadConstraints.0.maxSkew",
        operator: "equals",
        value: 1,
      },
      {
        path: "spec.template.spec.topologySpreadConstraints.0.topologyKey",
        operator: "equals",
        value: "topology.kubernetes.io/zone",
      },
      {
        path: "spec.template.spec.topologySpreadConstraints.0.whenUnsatisfiable",
        operator: "equals",
        value: "DoNotSchedule",
      },
    ],
    commands: [
      "kubectl get pods -n payments -o wide",
      "kubectl get nodes -L topology.kubernetes.io/zone",
      "kubectl describe deployment checkout -n payments",
      "kubectl get events -n payments --sort-by=.lastTimestamp",
    ],
    symptom: "all checkout Pod IPs map to nodes in zone-a",
    finding: "the Deployment has no topology spread or anti-affinity rule",
    fix: "add a zone topology spread constraint with maxSkew 1",
    prevention:
      "Test zone-loss behavior and alert when production replicas collapse into one failure domain.",
    hints: [
      "List Pods with node names, then label the nodes by zone.",
      "Replicas only provide zone resilience when scheduling expresses that intent.",
      "Use topologySpreadConstraints on topology.kubernetes.io/zone with maxSkew 1.",
    ],
    docsHref:
      "https://kubernetes.io/docs/concepts/scheduling-eviction/topology-spread-constraints/",
    incidentSource: incident(
      "Moonlight outage postmortem",
      "https://updates.moonlightwork.com/outage-post-mortem-87370",
      "The names, topology, workload, timeline, and remediation were synthesized for a deterministic scheduling exercise.",
    ),
  },
  {
    number: 23,
    slug: "priority-preemption-cascade",
    title: "Priority Preemption Cascade",
    difficulty: "advanced",
    severity: "critical",
    estimatedMinutes: 40,
    successRate: 34,
    concepts: ["scheduling", "resources", "disruptions", "debugging"],
    learningPaths: ["reliability", "sre-on-call"],
    capabilities: ["pods", "deployments", "nodes", "scheduling", "events"],
    blurb: "A batch workload can evict customer-facing services because its priority is backwards.",
    story:
      "During a reporting burst, batch Pods enter the cluster with a priority higher than the public API. The scheduler preempts API replicas, replacement Pods cannot fit, and a background task becomes the cause of a customer outage.",
    objective:
      "Move reporting Pods from the platform-critical class to the existing non-preempting batch class.",
    learningObjectives: [
      "Read scheduler preemption events as a resource-allocation chain.",
      "Migrate workloads between reviewed PriorityClasses without mutating immutable class fields.",
    ],
    file: "reporting-deployment.yaml",
    resource: { kind: "Deployment", name: "reporting", namespace: "analytics" },
    initial: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: reporting
  namespace: analytics
spec:
  replicas: 8
  selector:
    matchLabels:
      app: reporting
  template:
    metadata:
      labels:
        app: reporting
    spec:
      priorityClassName: platform-critical
      containers:
        - name: reporter
          image: registry.example/reporter:2.4.0
`,
    solution: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: reporting
  namespace: analytics
spec:
  replicas: 8
  selector:
    matchLabels:
      app: reporting
  template:
    metadata:
      labels:
        app: reporting
    spec:
      priorityClassName: batch-low
      containers:
        - name: reporter
          image: registry.example/reporter:2.4.0
`,
    assertions: [
      { path: "spec.replicas", operator: "equals", value: 8 },
      {
        path: "spec.template.spec.priorityClassName",
        operator: "equals",
        value: "batch-low",
      },
    ],
    commands: [
      "kubectl get priorityclass",
      "kubectl get pods -A -o custom-columns=NAME:.metadata.name,PRIORITY:.spec.priority",
      "kubectl get events -A --field-selector reason=Preempted",
      "kubectl describe priorityclass batch-low",
    ],
    symptom: "API Pods are preempted whenever reporting jobs arrive",
    finding: "the optional reporting Deployment incorrectly uses platform-critical priority",
    fix: "move reporting to the reviewed batch-low PriorityClass",
    prevention:
      "Review priority tiers centrally and exercise capacity pressure before enabling preemption.",
    hints: [
      "Correlate Preempted events with the priority values of both workloads.",
      "PriorityClass fields are immutable, so repair the workload reference instead of patching the class.",
      "Set the reporting Pod template priorityClassName to batch-low.",
    ],
    docsHref: "https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/",
    incidentSource: incident(
      "Grafana Labs pod priorities outage",
      "https://grafana.com/blog/how-a-production-outage-was-caused-using-kubernetes-pod-priorities/",
      "The workload identities, values, cluster pressure, and learner repair are fictionalized for this lab.",
    ),
  },
  {
    number: 25,
    slug: "conntrack-ghost",
    title: "The Conntrack Ghost",
    difficulty: "advanced",
    severity: "high",
    estimatedMinutes: 40,
    successRate: 31,
    concepts: ["dns", "networking", "deployments", "debugging"],
    learningPaths: ["networking", "sre-on-call"],
    capabilities: ["dns", "nodes", "pods", "events", "scheduling"],
    blurb: "DNS is healthy, except for queries pinned to an address from a terminated replica.",
    story:
      "CoreDNS scaled down during a quiet period. Some nodes retained stale UDP conntrack entries for the removed endpoint, so only Pods on those nodes time out while direct queries to healthy DNS replicas succeed.",
    objective:
      "Keep CoreDNS stable at three replicas during the known load window while conntrack is remediated.",
    learningObjectives: [
      "Recognize node-local DNS failure patterns that survive healthy control-plane checks.",
      "Use replica stability as a mitigation while fixing stale network state.",
    ],
    file: "coredns-deployment.yaml",
    resource: { kind: "Deployment", name: "coredns", namespace: "kube-system" },
    initial: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: coredns
  namespace: kube-system
spec:
  replicas: 1
  selector:
    matchLabels:
      k8s-app: kube-dns
  template:
    metadata:
      labels:
        k8s-app: kube-dns
    spec:
      containers:
        - name: coredns
          image: registry.k8s.io/coredns/coredns:v1.12.0
`,
    solution: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: coredns
  namespace: kube-system
spec:
  replicas: 3
  selector:
    matchLabels:
      k8s-app: kube-dns
  template:
    metadata:
      labels:
        k8s-app: kube-dns
    spec:
      containers:
        - name: coredns
          image: registry.k8s.io/coredns/coredns:v1.12.0
`,
    assertions: [{ path: "spec.replicas", operator: "gte", value: 3 }],
    commands: [
      "kubectl get pods -n kube-system -o wide",
      "kubectl get endpointslice -n kube-system -l kubernetes.io/service-name=kube-dns",
      "kubectl exec dns-test -- nslookup kubernetes.default",
      "kubectl get deployment coredns -n kube-system -o yaml",
    ],
    symptom: "DNS timeouts follow particular nodes after a CoreDNS scale-down",
    finding: "the DNS deployment was reduced to one replica during an active incident",
    fix: "hold CoreDNS at three replicas while stale conntrack state is cleared",
    prevention:
      "Monitor DNS by node and avoid rapid endpoint churn until conntrack behavior is verified.",
    hints: [
      "Compare successful and failing DNS clients by node, not only by namespace.",
      "Inspect the current and recently removed kube-dns endpoints.",
      "Restore three CoreDNS replicas to stop endpoint churn during mitigation.",
    ],
    docsHref: "https://kubernetes.io/docs/tasks/administer-cluster/dns-debugging-resolution/",
    incidentSource: incident(
      "Preply DNS postmortem",
      "https://medium.com/preply-engineering/dns-postmortem-e169efd45afd",
      "The traffic pattern, node set, replica count, and mitigation are fictional teaching adaptations.",
    ),
  },
  {
    number: 26,
    slug: "pod-ip-pool-exhausted",
    title: "Pod IP Pool Exhausted",
    difficulty: "advanced",
    severity: "critical",
    estimatedMinutes: 45,
    successRate: 29,
    concepts: ["networking", "scheduling", "pods", "debugging"],
    learningPaths: ["networking", "platform-architect"],
    capabilities: ["pods", "nodes", "scheduling", "events", "network-policy"],
    blurb:
      "New nodes join successfully, but Pods remain Pending because the secondary address range is full.",
    story:
      "The node autoscaler adds capacity during a launch, yet sandbox creation fails across the new nodes. The network team has already added the non-overlapping secondary range pods-expansion-2026 to the subnet, but the GKE cluster is not configured to consume it.",
    objective:
      "Attach the pre-provisioned additional Pod range to the GKE cluster without changing its Service range.",
    learningObjectives: [
      "Separate node capacity from Pod network address capacity.",
      "Repair CNI allocation while preserving non-overlapping cluster ranges.",
    ],
    file: "container-cluster.yaml",
    resource: { kind: "ContainerCluster", name: "production", namespace: "config-control" },
    initial: `apiVersion: container.cnrm.cloud.google.com/v1beta1
kind: ContainerCluster
metadata:
  name: production
  namespace: config-control
spec:
  location: us-central1
  ipAllocationPolicy:
    clusterSecondaryRangeName: pods-primary
    servicesSecondaryRangeName: services
`,
    solution: `apiVersion: container.cnrm.cloud.google.com/v1beta1
kind: ContainerCluster
metadata:
  name: production
  namespace: config-control
spec:
  location: us-central1
  ipAllocationPolicy:
    clusterSecondaryRangeName: pods-primary
    servicesSecondaryRangeName: services
    additionalPodRangesConfig:
      podRangeNames:
        - pods-expansion-2026
`,
    assertions: [
      {
        path: "spec.ipAllocationPolicy.additionalPodRangesConfig.podRangeNames.0",
        operator: "equals",
        value: "pods-expansion-2026",
      },
      {
        path: "spec.ipAllocationPolicy.servicesSecondaryRangeName",
        operator: "equals",
        value: "services",
      },
    ],
    commands: [
      "kubectl get pods -A --field-selector=status.phase=Pending",
      "kubectl get events -A --sort-by=.lastTimestamp",
      "kubectl get nodes",
      "kubectl get containercluster production -n config-control -o yaml",
    ],
    symptom: "Pod sandbox creation reports exhausted IP space despite idle CPU",
    finding: "the cluster does not consume the subnet's additional Pod secondary range",
    fix: "attach pods-expansion-2026 through additionalPodRangesConfig",
    prevention:
      "Capacity-plan Pod IPs alongside nodes and alert before address utilization reaches exhaustion.",
    hints: [
      "Read the sandbox creation event instead of treating every Pending Pod as a CPU problem.",
      "Confirm the additional secondary range already exists on the cluster subnet.",
      "Add pods-expansion-2026 under additionalPodRangesConfig and preserve the Service range.",
    ],
    docsHref: "https://cloud.google.com/kubernetes-engine/docs/how-to/multi-pod-cidr",
    incidentSource: incident(
      "When GKE ran out of IP addresses",
      "https://deploy.live/blog/when-gke-ran-out-of-ip-addresses/",
      "The range names, Config Connector workflow, application launch, and required correction were created specifically for KLab.",
    ),
  },
  {
    number: 28,
    slug: "ndots-retry-storm",
    title: "ndots Retry Storm",
    difficulty: "advanced",
    severity: "high",
    estimatedMinutes: 40,
    successRate: 33,
    concepts: ["dns", "networking", "resources", "debugging"],
    learningPaths: ["networking", "sre-on-call"],
    capabilities: ["pods", "dns", "events", "logs"],
    blurb: "External lookups expand into a search-path query storm that overwhelms cluster DNS.",
    story:
      "A telemetry agent calls dotted external names at high volume. With ndots set to 5, each name is tried through every cluster search suffix before the absolute query, multiplying traffic until CoreDNS latency and memory climb sharply.",
    objective:
      "Make the telemetry agent treat dotted external names as absolute before search expansion.",
    learningObjectives: [
      "Explain how ndots and search suffixes amplify DNS traffic.",
      "Scope a DNS policy change to the offending workload.",
    ],
    file: "telemetry-daemonset.yaml",
    resource: { kind: "DaemonSet", name: "telemetry-agent", namespace: "observability" },
    initial: `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: telemetry-agent
  namespace: observability
spec:
  selector:
    matchLabels:
      app: telemetry-agent
  template:
    metadata:
      labels:
        app: telemetry-agent
    spec:
      dnsConfig:
        options:
          - name: ndots
            value: "5"
      containers:
        - name: agent
          image: registry.example/telemetry@sha256:aa21aa21aa21aa21aa21aa21aa21aa21aa21aa21aa21aa21aa21aa21aa21aa21
`,
    solution: `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: telemetry-agent
  namespace: observability
spec:
  selector:
    matchLabels:
      app: telemetry-agent
  template:
    metadata:
      labels:
        app: telemetry-agent
    spec:
      dnsConfig:
        options:
          - name: ndots
            value: "1"
      containers:
        - name: agent
          image: registry.example/telemetry@sha256:aa21aa21aa21aa21aa21aa21aa21aa21aa21aa21aa21aa21aa21aa21aa21aa21
`,
    assertions: [
      { path: "spec.template.spec.dnsConfig.options.0.name", operator: "equals", value: "ndots" },
      { path: "spec.template.spec.dnsConfig.options.0.value", operator: "equals", value: "1" },
    ],
    commands: [
      "kubectl top pods -n kube-system -l k8s-app=kube-dns",
      "kubectl logs -n kube-system -l k8s-app=kube-dns",
      "kubectl get daemonset telemetry-agent -n observability -o yaml",
      "kubectl exec -n observability daemonset/telemetry-agent -- cat /etc/resolv.conf",
    ],
    symptom: "one external lookup produces multiple search-suffix queries",
    finding: "the high-volume agent inherits ndots:5",
    fix: "set ndots to 1 for the telemetry DaemonSet",
    prevention:
      "Measure DNS query amplification and prefer fully qualified names in high-volume clients.",
    hints: [
      "Inspect the agent resolv.conf and count the configured search suffixes.",
      "A dotted external hostname is still expanded when it has fewer dots than ndots.",
      "Set the Pod dnsConfig ndots option to 1 for this workload.",
    ],
    docsHref: "https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/",
    incidentSource: incident(
      "Zalando Kubernetes DNS outage",
      "https://github.com/zalando-incubator/kubernetes-on-aws/blob/dev/docs/postmortems/jan-2019-dns-outage.md",
      "The client, traffic volume, resource names, and single-manifest repair are fictionalized for interactive learning.",
    ),
  },
  {
    number: 29,
    slug: "hostnetwork-lost-cluster-dns",
    title: "hostNetwork Lost Cluster DNS",
    difficulty: "intermediate",
    severity: "high",
    estimatedMinutes: 25,
    successRate: 52,
    concepts: ["dns", "networking", "pods", "debugging"],
    learningPaths: ["networking", "application-debugging"],
    capabilities: ["pods", "dns", "events", "logs"],
    blurb: "A node agent can reach the internet but cannot resolve Kubernetes Services.",
    story:
      "A security agent was moved onto the host network to observe node traffic. It starts normally and resolves public domains, but calls to policy-api.security fail because the Pod no longer receives the cluster DNS policy.",
    objective: "Restore cluster Service discovery while keeping host networking enabled.",
    learningObjectives: [
      "Understand DNS policy defaults for hostNetwork Pods.",
      "Use ClusterFirstWithHostNet for node-level agents that call Services.",
    ],
    file: "security-agent.yaml",
    resource: { kind: "DaemonSet", name: "security-agent", namespace: "security" },
    initial: `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: security-agent
  namespace: security
spec:
  selector:
    matchLabels:
      app: security-agent
  template:
    metadata:
      labels:
        app: security-agent
    spec:
      hostNetwork: true
      dnsPolicy: Default
      containers:
        - name: agent
          image: registry.example/security-agent@sha256:71ef71ef71ef71ef71ef71ef71ef71ef71ef71ef71ef71ef71ef71ef71ef71ef
`,
    solution: `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: security-agent
  namespace: security
spec:
  selector:
    matchLabels:
      app: security-agent
  template:
    metadata:
      labels:
        app: security-agent
    spec:
      hostNetwork: true
      dnsPolicy: ClusterFirstWithHostNet
      containers:
        - name: agent
          image: registry.example/security-agent@sha256:71ef71ef71ef71ef71ef71ef71ef71ef71ef71ef71ef71ef71ef71ef71ef71ef
`,
    assertions: [
      { path: "spec.template.spec.hostNetwork", operator: "equals", value: true },
      {
        path: "spec.template.spec.dnsPolicy",
        operator: "equals",
        value: "ClusterFirstWithHostNet",
      },
    ],
    commands: [
      "kubectl logs -n security -l app=security-agent",
      "kubectl get daemonset security-agent -n security -o yaml",
      "kubectl exec -n security daemonset/security-agent -- cat /etc/resolv.conf",
      "kubectl exec -n security daemonset/security-agent -- nslookup policy-api.security",
    ],
    symptom: "only cluster-local names fail from the hostNetwork agent",
    finding: "dnsPolicy is Default even though hostNetwork remains required",
    fix: "use ClusterFirstWithHostNet",
    prevention:
      "Include cluster Service resolution in readiness tests for every host-networked component.",
    hints: [
      "Compare this Pod's resolv.conf with a normal application Pod.",
      "hostNetwork changes which DNS policy is needed for cluster-first resolution.",
      "Keep hostNetwork true and set dnsPolicy to ClusterFirstWithHostNet.",
    ],
    docsHref:
      "https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/#pod-s-dns-policy",
  },
  {
    number: 30,
    slug: "stateful-peers-cannot-discover",
    title: "Stateful Peers Cannot Discover Each Other",
    difficulty: "advanced",
    severity: "critical",
    estimatedMinutes: 40,
    successRate: 36,
    concepts: ["statefulsets", "services", "dns", "storage"],
    learningPaths: ["reliability", "platform-architect"],
    capabilities: ["pods", "services", "dns", "workload-controllers"],
    blurb:
      "Database replicas have stable names, but bootstrap peers disappear from DNS until Ready.",
    story:
      "A three-member consensus database starts with stable StatefulSet Pod names. The governing Service is headless, but it publishes only Ready endpoints. Every member waits for its peers before becoming Ready, so the bootstrap dependency becomes circular.",
    objective: "Publish not-ready bootstrap peers through the existing headless governing Service.",
    learningObjectives: [
      "Connect StatefulSet serviceName with a governing headless Service.",
      "Diagnose stable identity failures separately from storage and process health.",
    ],
    file: "database-service.yaml",
    resource: { kind: "Service", name: "database", namespace: "data" },
    initial: `apiVersion: v1
kind: Service
metadata:
  name: database
  namespace: data
spec:
  clusterIP: None
  publishNotReadyAddresses: false
  selector:
    app: database
  ports:
    - name: peer
      port: 7000
`,
    solution: `apiVersion: v1
kind: Service
metadata:
  name: database
  namespace: data
spec:
  clusterIP: None
  publishNotReadyAddresses: true
  selector:
    app: database
  ports:
    - name: peer
      port: 7000
`,
    assertions: [
      { path: "spec.clusterIP", operator: "equals", value: "None" },
      { path: "spec.publishNotReadyAddresses", operator: "equals", value: true },
    ],
    commands: [
      "kubectl get statefulset -n data",
      "kubectl get service database -n data -o yaml",
      "kubectl get endpointslice -n data -l kubernetes.io/service-name=database",
      "kubectl exec -n data database-0 -- nslookup database-1.database",
    ],
    symptom: "peer-specific DNS queries return no usable records during bootstrap",
    finding: "the headless governing Service hides not-ready peers during bootstrap",
    fix: "enable publishNotReadyAddresses without replacing the Service",
    prevention: "Test member discovery from a cold cluster before shipping any StatefulSet change.",
    hints: [
      "Inspect the StatefulSet serviceName and the Service endpoint publication policy together.",
      "Consensus members may need DNS records before they can report Ready.",
      "Keep clusterIP: None and set publishNotReadyAddresses to true.",
    ],
    docsHref: "https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/",
  },
  {
    number: 31,
    slug: "orphaned-ingress",
    title: "The Orphaned Ingress",
    difficulty: "intermediate",
    severity: "high",
    estimatedMinutes: 30,
    successRate: 51,
    concepts: ["ingress", "services", "annotations", "networking"],
    learningPaths: ["networking", "application-debugging"],
    capabilities: ["services", "pods", "events", "network-policy"],
    blurb: "The Ingress exists, but no controller claims it after the platform migration.",
    story:
      "The edge team migrated from a legacy controller to ingress-nginx. The storefront Ingress still uses the retired class, so its status remains empty and public traffic receives the default backend even though the Service works inside the cluster.",
    objective: "Assign the storefront Ingress to the active nginx IngressClass.",
    learningObjectives: [
      "Distinguish Service reachability from Ingress reconciliation.",
      "Use spec.ingressClassName instead of relying on a cluster default.",
    ],
    file: "ingress.yaml",
    resource: { kind: "Ingress", name: "storefront", namespace: "shop" },
    initial: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: storefront
  namespace: shop
spec:
  ingressClassName: legacy-edge
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: storefront
                port:
                  number: 80
`,
    solution: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: storefront
  namespace: shop
spec:
  ingressClassName: nginx
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: storefront
                port:
                  number: 80
`,
    assertions: [
      { path: "spec.ingressClassName", operator: "equals", value: "nginx" },
      { path: "spec.rules.0.host", operator: "equals", value: "shop.example.com" },
    ],
    commands: [
      "kubectl get ingressclass",
      "kubectl describe ingress storefront -n shop",
      "kubectl get service storefront -n shop",
      "kubectl get events -n shop --sort-by=.lastTimestamp",
    ],
    symptom: "the Ingress address is empty while the backing Service is healthy",
    finding: "ingressClassName points at the retired legacy-edge controller",
    fix: "change the class to nginx",
    prevention:
      "Inventory class references before controller migrations and alert on unreconciled Ingress objects.",
    hints: [
      "Confirm the Service works, then inspect whether any controller accepted the Ingress.",
      "List installed IngressClasses and compare their names with the manifest.",
      "Set spec.ingressClassName to nginx without changing the host or backend.",
    ],
    docsHref: "https://kubernetes.io/docs/concepts/services-networking/ingress/",
  },
  {
    number: 32,
    slug: "local-traffic-black-hole",
    title: "Local Traffic Black Hole",
    difficulty: "advanced",
    severity: "critical",
    estimatedMinutes: 40,
    successRate: 35,
    concepts: ["services", "endpointslices", "networking", "scheduling"],
    learningPaths: ["networking", "sre-on-call"],
    capabilities: ["services", "pods", "nodes", "scheduling", "events"],
    blurb:
      "A LoadBalancer preserves client IPs but drops traffic on nodes without a local endpoint.",
    story:
      "Fraud detection normally needs the real client IP, so the payments Service uses externalTrafficPolicy Local. The load balancer still sends traffic to every node, but payments Pods run on only two of six nodes. Incident command has approved a temporary client-IP exception to restore checkout while the load balancer health checks are repaired.",
    objective:
      "Restore reliable external traffic immediately by allowing cluster-wide endpoint forwarding.",
    learningObjectives: [
      "Explain the availability tradeoff of externalTrafficPolicy Local.",
      "Correlate node-level traffic failures with local endpoint placement.",
    ],
    file: "payments-service.yaml",
    resource: { kind: "Service", name: "payments-public", namespace: "payments" },
    initial: `apiVersion: v1
kind: Service
metadata:
  name: payments-public
  namespace: payments
spec:
  type: LoadBalancer
  externalTrafficPolicy: Local
  selector:
    app: payments
  ports:
    - port: 443
      targetPort: 8443
`,
    solution: `apiVersion: v1
kind: Service
metadata:
  name: payments-public
  namespace: payments
  annotations:
    incident-exception: client-ip-loss-approved
spec:
  type: LoadBalancer
  externalTrafficPolicy: Cluster
  selector:
    app: payments
  ports:
    - port: 443
      targetPort: 8443
`,
    assertions: [
      { path: "spec.externalTrafficPolicy", operator: "equals", value: "Cluster" },
      { path: "spec.type", operator: "equals", value: "LoadBalancer" },
      {
        path: "metadata.annotations.incident-exception",
        operator: "equals",
        value: "client-ip-loss-approved",
      },
    ],
    commands: [
      "kubectl get service payments-public -n payments -o yaml",
      "kubectl get pods -n payments -o wide",
      "kubectl get endpointslice -n payments -l kubernetes.io/service-name=payments-public",
      "kubectl get nodes",
    ],
    symptom: "external failures correlate with nodes that have no payments Pod",
    finding: "Local traffic policy forbids forwarding to endpoints on other nodes",
    fix: "record the approved exception and switch to Cluster as a time-bounded mitigation",
    prevention:
      "Use health-check-aware load balancer targeting or schedule local endpoints before choosing Local.",
    hints: [
      "Map failed load balancer targets to the nodes hosting ready endpoints.",
      "Local preserves source IP by refusing a cross-node hop.",
      "Record the client-IP exception and use Cluster only until load balancer targeting is repaired.",
    ],
    docsHref: "https://kubernetes.io/docs/tutorials/services/source-ip/",
  },
  {
    number: 34,
    slug: "volume-bound-wrong-zone",
    title: "Volume Bound in the Wrong Zone",
    difficulty: "advanced",
    severity: "high",
    estimatedMinutes: 40,
    successRate: 32,
    concepts: ["storage", "scheduling", "statefulsets", "events"],
    learningPaths: ["reliability", "sre-on-call"],
    capabilities: ["pods", "nodes", "scheduling", "events", "workload-controllers"],
    blurb:
      "Immediate volume binding chose a zone before the database Pod had a scheduling decision.",
    story:
      "A database PVC bound in zone-a as soon as it was created, but the Pod's required node pool is in zone-b. The scheduler cannot satisfy both constraints, so the Pod remains Pending while the volume and compute capacity each appear healthy.",
    objective:
      "Create a replacement StorageClass for topology-aware claims; do not mutate the immutable class backing the stuck claim.",
    learningObjectives: [
      "Trace a Pending Pod through PV node affinity and Pod scheduling constraints.",
      "Use WaitForFirstConsumer for topology-aware dynamic provisioning.",
    ],
    file: "storage-class.yaml",
    resource: { kind: "StorageClass", name: "regional-ssd-delayed" },
    initial: `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: regional-ssd
provisioner: pd.csi.storage.gke.io
volumeBindingMode: Immediate
allowVolumeExpansion: true
`,
    solution: `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: regional-ssd-delayed
provisioner: pd.csi.storage.gke.io
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
`,
    assertions: [
      { path: "volumeBindingMode", operator: "equals", value: "WaitForFirstConsumer" },
      { path: "allowVolumeExpansion", operator: "equals", value: true },
    ],
    commands: [
      "kubectl describe pod database-0 -n data",
      "kubectl get pvc,pv -n data -o wide",
      "kubectl get storageclass regional-ssd -o yaml",
      "kubectl get nodes -L topology.kubernetes.io/zone",
    ],
    symptom: "scheduler events report a volume node-affinity conflict",
    finding: "the existing regional-ssd class binds before the scheduler knows consumer topology",
    fix: "create regional-ssd-delayed with WaitForFirstConsumer for a controlled claim migration",
    prevention:
      "Use delayed binding for topology-constrained storage and validate restore paths in every supported zone.",
    hints: [
      "Inspect both the Pod scheduling event and the bound PV node affinity.",
      "The provisioner chose a location before the scheduler chose a node.",
      "Create regional-ssd-delayed with WaitForFirstConsumer, then migrate data to a new claim.",
    ],
    docsHref: "https://kubernetes.io/docs/concepts/storage/storage-classes/#volume-binding-mode",
  },
  {
    number: 35,
    slug: "volume-attach-storm",
    title: "The Volume Attach Storm",
    difficulty: "advanced",
    severity: "critical",
    estimatedMinutes: 45,
    successRate: 28,
    concepts: ["storage", "statefulsets", "rollouts", "disruptions"],
    learningPaths: ["reliability", "sre-on-call"],
    capabilities: ["pods", "nodes", "events", "workload-controllers", "scheduling"],
    blurb:
      "An automatic StatefulSet rollout keeps adding volume work to an already saturated storage control plane.",
    story:
      "After a regional recovery, an automatic search rollout continues while the CSI controller is saturated. Each replacement adds detach and attach work before operators can verify the previous shard, amplifying retries exactly when recovery needs deliberate pacing.",
    objective:
      "Pause automatic StatefulSet replacement and hand control to the recovery runbook so operators advance one verified shard at a time.",
    learningObjectives: [
      "Relate StatefulSet update strategy to storage control-plane pressure.",
      "Prefer controlled recovery over maximum concurrency for attached state.",
    ],
    file: "search-statefulset.yaml",
    resource: { kind: "StatefulSet", name: "search", namespace: "search" },
    initial: `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: search
  namespace: search
spec:
  serviceName: search
  replicas: 12
  podManagementPolicy: Parallel
  updateStrategy:
    type: RollingUpdate
  selector:
    matchLabels:
      app: search
  template:
    metadata:
      labels:
        app: search
    spec:
      containers:
        - name: search
          image: registry.example/search@sha256:19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd
`,
    solution: `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: search
  namespace: search
spec:
  serviceName: search
  replicas: 12
  podManagementPolicy: Parallel
  updateStrategy:
    type: OnDelete
  selector:
    matchLabels:
      app: search
  template:
    metadata:
      labels:
        app: search
    spec:
      containers:
        - name: search
          image: registry.example/search@sha256:19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd
`,
    assertions: [
      { path: "spec.podManagementPolicy", operator: "equals", value: "Parallel" },
      { path: "spec.updateStrategy.type", operator: "equals", value: "OnDelete" },
    ],
    commands: [
      "kubectl get pods -n search -w",
      "kubectl get volumeattachment",
      "kubectl logs -n kube-system -l app=csi-controller",
      "kubectl get statefulset search -n search -o yaml",
    ],
    symptom: "many shards wait on concurrent attach and mount retries",
    finding: "the automatic RollingUpdate continues adding volume transitions during recovery",
    fix: "switch the mutable update strategy to OnDelete and advance shards through the runbook",
    prevention:
      "Set recovery concurrency from measured CSI limits and rehearse regional restart procedures.",
    hints: [
      "Order Pod creation timestamps beside VolumeAttachment events.",
      "The storage controller is saturated by replacement concurrency, not a single corrupt disk.",
      "Use updateStrategy: OnDelete temporarily and delete only the next verified shard.",
    ],
    docsHref:
      "https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/#pod-management-policies",
    incidentSource: incident(
      "Render extended service disruption",
      "https://render.com/blog/root-cause-analysis-extended-service-disruption-3-26-24",
      "The StatefulSet, shard count, CSI behavior, and ordered-recovery solution are fictional simplifications.",
    ),
  },
  {
    number: 37,
    slug: "operator-cannot-update-status",
    title: "Operator Cannot Update Status",
    difficulty: "intermediate",
    severity: "high",
    estimatedMinutes: 30,
    successRate: 48,
    concepts: ["operators", "crds", "rbac", "reconciliation"],
    learningPaths: ["application-debugging", "platform-architect"],
    capabilities: ["pods", "events", "logs", "workload-controllers"],
    blurb: "The operator creates resources correctly but every status update is forbidden.",
    story:
      "The database operator reconciles StatefulSets, then fails to write the Database status subresource. Users see stale Pending conditions even when instances are healthy, and the controller repeats the same work on every watch event.",
    objective:
      "Grant the operator update and patch access only to the databases/status subresource.",
    learningObjectives: [
      "Recognize status as an RBAC subresource with separate permissions.",
      "Extend a controller Role without granting broad wildcard access.",
    ],
    file: "operator-role.yaml",
    resource: { kind: "Role", name: "database-operator", namespace: "data" },
    initial: `apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: database-operator
  namespace: data
rules:
  - apiGroups: ["database.example.com"]
    resources: ["databases"]
    verbs: ["get", "list", "watch", "update", "patch"]
`,
    solution: `apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: database-operator
  namespace: data
rules:
  - apiGroups: ["database.example.com"]
    resources: ["databases"]
    verbs: ["get", "list", "watch", "update", "patch"]
  - apiGroups: ["database.example.com"]
    resources: ["databases/status"]
    verbs: ["get", "update", "patch"]
`,
    assertions: [
      { path: "rules.1.apiGroups.0", operator: "equals", value: "database.example.com" },
      { path: "rules.1.resources.0", operator: "equals", value: "databases/status" },
      { path: "rules.1.verbs.1", operator: "equals", value: "update" },
      { path: "rules.1.verbs.2", operator: "equals", value: "patch" },
      { path: "rules.2", operator: "absent" },
    ],
    commands: [
      "kubectl logs -n data deployment/database-operator",
      "kubectl auth can-i update databases.database.example.com --subresource=status --as=system:serviceaccount:data:database-operator -n data",
      "kubectl get role database-operator -n data -o yaml",
      "kubectl get database -n data -o yaml",
    ],
    symptom: "reconcile logs contain Forbidden errors only for status updates",
    finding: "the Role covers databases but omits databases/status",
    fix: "add narrowly scoped get, update, and patch verbs for databases/status",
    prevention:
      "Test controller permissions with impersonated auth checks for every required subresource.",
    hints: [
      "Read the full resource string in the Forbidden error.",
      "The main custom resource and its status subresource have distinct RBAC names.",
      "Add a rule for databases/status with get, update, and patch.",
    ],
    docsHref: "https://kubernetes.io/docs/reference/access-authn-authz/rbac/",
  },
  {
    number: 38,
    slug: "admission-webhook-deadlock",
    title: "Admission Webhook Deadlocks the Cluster",
    difficulty: "advanced",
    severity: "critical",
    estimatedMinutes: 45,
    successRate: 27,
    concepts: ["admission-controllers", "networking", "rbac", "debugging"],
    learningPaths: ["sre-on-call", "platform-architect"],
    capabilities: ["services", "pods", "events", "network-policy"],
    blurb: "An unavailable webhook rejects the Pods needed to restore that same webhook.",
    story:
      "A policy webhook loses all endpoints during a node drain. Its fail-closed rule matches every Pod in every namespace, including the webhook Deployment itself, so the API server cannot admit replacement replicas and recovery is circular.",
    objective: "Limit the webhook blast radius and fail open while its availability is restored.",
    learningObjectives: [
      "Identify circular dependencies in admission control.",
      "Scope webhooks and choose failure policy according to workload risk.",
    ],
    file: "validating-webhook.yaml",
    resource: { kind: "ValidatingWebhookConfiguration", name: "workload-policy" },
    initial: `apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: workload-policy
webhooks:
  - name: policy.platform.example.com
    admissionReviewVersions: ["v1"]
    sideEffects: None
    failurePolicy: Fail
    timeoutSeconds: 30
    namespaceSelector: {}
    rules:
      - apiGroups: [""]
        apiVersions: ["v1"]
        operations: ["CREATE"]
        resources: ["pods"]
    clientConfig:
      service:
        namespace: policy-system
        name: workload-policy
        path: /validate
`,
    solution: `apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: workload-policy
webhooks:
  - name: policy.platform.example.com
    admissionReviewVersions: ["v1"]
    sideEffects: None
    failurePolicy: Ignore
    timeoutSeconds: 3
    namespaceSelector:
      matchExpressions:
        - key: kubernetes.io/metadata.name
          operator: NotIn
          values: ["policy-system"]
    rules:
      - apiGroups: [""]
        apiVersions: ["v1"]
        operations: ["CREATE"]
        resources: ["pods"]
    clientConfig:
      service:
        namespace: policy-system
        name: workload-policy
        path: /validate
`,
    assertions: [
      { path: "webhooks.0.failurePolicy", operator: "equals", value: "Ignore" },
      { path: "webhooks.0.timeoutSeconds", operator: "lte", value: 3 },
      {
        path: "webhooks.0.namespaceSelector.matchExpressions.0.key",
        operator: "equals",
        value: "kubernetes.io/metadata.name",
      },
      {
        path: "webhooks.0.namespaceSelector.matchExpressions.0.operator",
        operator: "equals",
        value: "NotIn",
      },
      {
        path: "webhooks.0.namespaceSelector.matchExpressions.0.values.0",
        operator: "equals",
        value: "policy-system",
      },
      { path: "webhooks.0.admissionReviewVersions.0", operator: "equals", value: "v1" },
      { path: "webhooks.0.sideEffects", operator: "equals", value: "None" },
      {
        path: "webhooks.0.namespaceSelector.matchExpressions.0.values.1",
        operator: "absent",
      },
      { path: "webhooks.1", operator: "absent" },
    ],
    commands: [
      "kubectl get validatingwebhookconfiguration workload-policy -o yaml",
      "kubectl get endpoints -n policy-system workload-policy",
      "kubectl get events -A --sort-by=.lastTimestamp",
      "kubectl auth can-i create pods -n policy-system",
    ],
    symptom: "Pod creates time out while the webhook Service has no endpoints",
    finding: "a global fail-closed webhook also controls its own recovery namespace",
    fix: "use a short fail-open policy and an explicit namespace exemption selector",
    prevention:
      "Run multiple webhook replicas, exclude recovery paths, and monitor admission latency and rejections.",
    hints: [
      "Check API create failures alongside the webhook EndpointSlice.",
      "Ask whether the webhook can block creation of its own replacement Pod.",
      "Set failurePolicy to Ignore, shorten timeoutSeconds, and add the exemption selector.",
    ],
    docsHref:
      "https://kubernetes.io/docs/concepts/cluster-administration/admission-webhooks-good-practices/",
  },
  {
    number: 40,
    slug: "low-cpu-terrible-latency",
    title: "Low CPU, Terrible Latency",
    difficulty: "advanced",
    severity: "high",
    estimatedMinutes: 40,
    successRate: 30,
    concepts: ["resources", "deployments", "debugging"],
    learningPaths: ["reliability", "sre-on-call"],
    capabilities: ["pods", "deployments", "logs", "events"],
    blurb: "Average CPU is low, but tight CFS quota creates periodic latency cliffs.",
    story:
      "The recommendation API uses short CPU bursts to rank results. Its average utilization remains below 200m, yet a 200m CPU limit exhausts quota early in each period and throttles request workers, producing p99 latency spikes with no saturation alert.",
    objective: "Remove the CPU limit while retaining a realistic CPU request and memory boundary.",
    learningObjectives: [
      "Distinguish CPU throttling from high average utilization.",
      "Choose requests and limits based on workload behavior rather than symmetry.",
    ],
    file: "recommendation-deployment.yaml",
    resource: { kind: "Deployment", name: "recommendation", namespace: "store" },
    initial: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: recommendation
  namespace: store
spec:
  replicas: 3
  selector:
    matchLabels:
      app: recommendation
  template:
    metadata:
      labels:
        app: recommendation
    spec:
      containers:
        - name: api
          image: registry.example/recommendation@sha256:21ab21ab21ab21ab21ab21ab21ab21ab21ab21ab21ab21ab21ab21ab21ab21ab
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
            limits:
              cpu: 200m
              memory: 512Mi
`,
    solution: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: recommendation
  namespace: store
spec:
  replicas: 3
  selector:
    matchLabels:
      app: recommendation
  template:
    metadata:
      labels:
        app: recommendation
    spec:
      containers:
        - name: api
          image: registry.example/recommendation@sha256:21ab21ab21ab21ab21ab21ab21ab21ab21ab21ab21ab21ab21ab21ab21ab21ab
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
            limits:
              memory: 512Mi
`,
    assertions: [
      {
        path: "spec.template.spec.containers.0.resources.requests.cpu",
        operator: "equals",
        value: "200m",
      },
      { path: "spec.template.spec.containers.0.resources.limits.cpu", operator: "absent" },
      {
        path: "spec.template.spec.containers.0.resources.limits.memory",
        operator: "equals",
        value: "512Mi",
      },
    ],
    commands: [
      "kubectl top pods -n store -l app=recommendation",
      "kubectl get deployment recommendation -n store -o yaml",
      "kubectl exec -n store deployment/recommendation -- cat /sys/fs/cgroup/cpu.stat",
      "kubectl logs -n store -l app=recommendation",
    ],
    symptom: "latency spikes align with throttled periods, not high average CPU",
    finding: "the CPU request is also enforced as a tight CPU limit",
    fix: "remove only the CPU limit while preserving scheduling and memory controls",
    prevention:
      "Alert on throttling counters and load-test bursty services before imposing CPU limits.",
    hints: [
      "Look beyond kubectl top and inspect CPU throttling counters.",
      "CPU requests affect scheduling; CPU limits enforce runtime quota.",
      "Keep the 200m request and memory limit, but remove limits.cpu.",
    ],
    docsHref: "https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/",
    incidentSource: incident(
      "Buffer faster services without CPU limits",
      "https://erickhun.com/posts/kubernetes-faster-services-no-cpu-limits/",
      "The service, resource values, traffic pattern, and acceptance rule are fictional KLab material.",
    ),
  },
  {
    number: 41,
    slug: "logging-agent-system-oom",
    title: "Logging Agent Takes Down the Node",
    difficulty: "advanced",
    severity: "critical",
    estimatedMinutes: 40,
    successRate: 32,
    concepts: ["daemonsets", "resources", "logs", "scheduling"],
    learningPaths: ["sre-on-call", "reliability"],
    capabilities: ["pods", "nodes", "logs", "events", "scheduling"],
    blurb:
      "An unbounded node logging agent consumes memory until the kernel kills unrelated workloads.",
    story:
      "A malformed log line makes the collector buffer aggressively. The DaemonSet has no requests or limits, so it grows outside admission planning and triggers node SystemOOM, taking healthy customer Pods with it.",
    objective:
      "Bound the collector's memory and reserve enough resources for predictable placement.",
    learningObjectives: [
      "Connect a node OOM to an unbounded DaemonSet rather than the evicted application.",
      "Set asymmetric requests and limits for infrastructure agents.",
    ],
    file: "log-collector.yaml",
    resource: { kind: "DaemonSet", name: "log-collector", namespace: "observability" },
    initial: `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: log-collector
  namespace: observability
spec:
  selector:
    matchLabels:
      app: log-collector
  template:
    metadata:
      labels:
        app: log-collector
    spec:
      containers:
        - name: collector
          image: registry.example/log-collector@sha256:0f140f140f140f140f140f140f140f140f140f140f140f140f140f140f140f14
`,
    solution: `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: log-collector
  namespace: observability
spec:
  selector:
    matchLabels:
      app: log-collector
  template:
    metadata:
      labels:
        app: log-collector
    spec:
      containers:
        - name: collector
          image: registry.example/log-collector@sha256:0f140f140f140f140f140f140f140f140f140f140f140f140f140f140f140f14
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              memory: 768Mi
`,
    assertions: [
      {
        path: "spec.template.spec.containers.0.resources.limits.memory",
        operator: "equals",
        value: "768Mi",
      },
      {
        path: "spec.template.spec.containers.0.resources.requests.cpu",
        operator: "equals",
        value: "100m",
      },
    ],
    commands: [
      "kubectl describe node worker-3",
      "kubectl top pods -A --sort-by=memory",
      "kubectl get daemonset log-collector -n observability -o yaml",
      "kubectl get events -A --field-selector reason=SystemOOM",
    ],
    symptom: "SystemOOM events follow runaway collector memory on each affected node",
    finding: "the log collector has no resource request or memory limit",
    fix: "add a 256Mi memory request, 768Mi memory limit, and 100m CPU request",
    prevention: "Bound every node agent and alert on its memory slope before kernel-level OOM.",
    hints: [
      "Sort usage across all namespaces, including infrastructure DaemonSets.",
      "A workload without requests can consume memory the scheduler never reserved.",
      "Add the required CPU and memory requests plus a 768Mi memory limit.",
    ],
    docsHref: "https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/",
    incidentSource: incident(
      "Blue Matador Kubernetes node OOM postmortem",
      "https://www.bluematador.com/blog/post-mortem-kubernetes-node-oom",
      "The collector, memory quantities, node identity, and repair workflow are fictionalized for KLab.",
    ),
  },
  {
    number: 42,
    slug: "diskpressure-runaway-logs",
    title: "DiskPressure from Runaway Logs",
    difficulty: "intermediate",
    severity: "high",
    estimatedMinutes: 30,
    successRate: 45,
    concepts: ["resources", "logs", "scheduling", "events"],
    learningPaths: ["sre-on-call", "application-debugging"],
    capabilities: ["pods", "nodes", "events", "logs", "scheduling"],
    blurb: "A chatty worker fills node ephemeral storage and causes unrelated Pod evictions.",
    story:
      "A failed queue message is logged in a tight loop. The worker declares CPU and memory but no ephemeral-storage budget. Node disk crosses the eviction threshold, and kubelet removes other Pods before anyone connects the incident to log growth.",
    objective:
      "Give the worker an explicit ephemeral-storage request and limit to contain disk consumption.",
    learningObjectives: [
      "Trace DiskPressure and eviction events to container writable data and logs.",
      "Declare ephemeral storage as a schedulable, enforceable resource.",
    ],
    file: "worker-deployment.yaml",
    resource: { kind: "Deployment", name: "queue-worker", namespace: "jobs" },
    initial: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: queue-worker
  namespace: jobs
spec:
  replicas: 4
  selector:
    matchLabels:
      app: queue-worker
  template:
    metadata:
      labels:
        app: queue-worker
    spec:
      containers:
        - name: worker
          image: registry.example/worker@sha256:900d900d900d900d900d900d900d900d900d900d900d900d900d900d900d900d
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
`,
    solution: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: queue-worker
  namespace: jobs
spec:
  replicas: 4
  selector:
    matchLabels:
      app: queue-worker
  template:
    metadata:
      labels:
        app: queue-worker
    spec:
      containers:
        - name: worker
          image: registry.example/worker@sha256:900d900d900d900d900d900d900d900d900d900d900d900d900d900d900d900d
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
              ephemeral-storage: 512Mi
            limits:
              ephemeral-storage: 2Gi
`,
    assertions: [
      {
        path: "spec.template.spec.containers.0.resources.requests.ephemeral-storage",
        operator: "equals",
        value: "512Mi",
      },
      {
        path: "spec.template.spec.containers.0.resources.limits.ephemeral-storage",
        operator: "equals",
        value: "2Gi",
      },
    ],
    commands: [
      "kubectl describe node worker-5",
      "kubectl get events -A --field-selector reason=Evicted",
      "kubectl logs -n jobs -l app=queue-worker --tail=100",
      "kubectl get deployment queue-worker -n jobs -o yaml",
    ],
    symptom: "DiskPressure and eviction events follow unbounded worker log growth",
    finding: "the worker declares no ephemeral-storage request or limit",
    fix: "add a 512Mi request and 2Gi limit for ephemeral storage",
    prevention:
      "Rate-limit repetitive logs, rotate node logs, and monitor ephemeral-storage consumption by Pod.",
    hints: [
      "Inspect the node condition and eviction message before changing memory.",
      "Container logs count toward local ephemeral storage.",
      "Add ephemeral-storage under both resources.requests and resources.limits.",
    ],
    docsHref: "https://kubernetes.io/docs/concepts/storage/ephemeral-storage/",
  },
  {
    number: 43,
    slug: "hpa-cannot-compute-replicas",
    title: "HPA Cannot Compute Replicas",
    difficulty: "intermediate",
    severity: "high",
    estimatedMinutes: 30,
    successRate: 47,
    concepts: ["autoscaling", "resources", "deployments", "events"],
    learningPaths: ["reliability", "application-debugging"],
    capabilities: ["pods", "deployments", "events", "scheduling"],
    blurb:
      "Metrics exist, but utilization has no denominator because the container lacks a CPU request.",
    story:
      "Traffic climbs and CPU samples arrive, yet the HorizontalPodAutoscaler reports FailedGetResourceMetric and stays at two replicas. The API container has a CPU limit but no request, so percentage utilization cannot be calculated.",
    objective:
      "Add the CPU request the HPA needs while preserving the existing memory and CPU limits.",
    learningObjectives: [
      "Explain why resource-utilization HPA targets require requests.",
      "Read HPA conditions before blaming the metrics pipeline.",
    ],
    file: "api-deployment.yaml",
    resource: { kind: "Deployment", name: "catalog-api", namespace: "store" },
    initial: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: catalog-api
  namespace: store
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
        - name: api
          image: registry.example/catalog@sha256:39ca39ca39ca39ca39ca39ca39ca39ca39ca39ca39ca39ca39ca39ca39ca39ca
          resources:
            limits:
              cpu: "1"
              memory: 512Mi
`,
    solution: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: catalog-api
  namespace: store
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
        - name: api
          image: registry.example/catalog@sha256:39ca39ca39ca39ca39ca39ca39ca39ca39ca39ca39ca39ca39ca39ca39ca39ca
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: "1"
              memory: 512Mi
`,
    assertions: [
      {
        path: "spec.template.spec.containers.0.resources.requests.cpu",
        operator: "equals",
        value: "250m",
      },
      {
        path: "spec.template.spec.containers.0.resources.requests.memory",
        operator: "equals",
        value: "256Mi",
      },
      {
        path: "spec.template.spec.containers.0.resources.limits.cpu",
        operator: "equals",
        value: "1",
      },
    ],
    commands: [
      "kubectl describe hpa catalog-api -n store",
      "kubectl top pods -n store -l app=catalog-api",
      "kubectl get deployment catalog-api -n store -o yaml",
      "kubectl get events -n store --sort-by=.lastTimestamp",
    ],
    symptom: "the HPA reports missing request for cpu while metrics are present",
    finding: "the target container has a CPU limit but no CPU request",
    fix: "add the 250m CPU request required by the utilization target",
    prevention:
      "Enforce resource requests on every container targeted by utilization-based autoscaling.",
    hints: [
      "Read the HPA condition message and identify which value is missing.",
      "CPU utilization is usage divided by the requested CPU, not the limit.",
      "Add requests.cpu: 250m to the API container; memory sizing is a separate capacity decision.",
    ],
    docsHref: "https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/",
  },
  {
    number: 44,
    slug: "sidecar-poisons-scaling-signal",
    title: "Sidecar Poisons the Scaling Signal",
    difficulty: "advanced",
    severity: "high",
    estimatedMinutes: 40,
    successRate: 31,
    concepts: ["autoscaling", "sidecar-containers", "resources", "debugging"],
    learningPaths: ["reliability", "sre-on-call"],
    capabilities: ["pods", "deployments", "multi-container", "scheduling", "events"],
    blurb: "A busy metrics sidecar drives whole-Pod CPU scaling while the application is idle.",
    story:
      "The orders API exports a high-cardinality metrics stream through a sidecar. A Pod-level CPU utilization target combines both containers, so telemetry CPU keeps the HPA at maximum replicas even when request traffic is quiet.",
    objective: "Scale from the api container's CPU rather than aggregate Pod CPU.",
    learningObjectives: [
      "Identify multi-container distortion in autoscaling signals.",
      "Use ContainerResource metrics when one container represents demand.",
    ],
    file: "orders-hpa.yaml",
    resource: { kind: "HorizontalPodAutoscaler", name: "orders-api", namespace: "orders" },
    initial: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: orders-api
  namespace: orders
spec:
  minReplicas: 3
  maxReplicas: 30
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: orders-api
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 65
`,
    solution: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: orders-api
  namespace: orders
spec:
  minReplicas: 3
  maxReplicas: 30
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: orders-api
  metrics:
    - type: ContainerResource
      containerResource:
        name: cpu
        container: api
        target:
          type: Utilization
          averageUtilization: 65
`,
    assertions: [
      { path: "spec.metrics.0.type", operator: "equals", value: "ContainerResource" },
      { path: "spec.metrics.0.containerResource.name", operator: "equals", value: "cpu" },
      { path: "spec.metrics.0.containerResource.container", operator: "equals", value: "api" },
      {
        path: "spec.metrics.0.containerResource.target.type",
        operator: "equals",
        value: "Utilization",
      },
      {
        path: "spec.metrics.0.containerResource.target.averageUtilization",
        operator: "equals",
        value: 65,
      },
    ],
    commands: [
      "kubectl describe hpa orders-api -n orders",
      "kubectl top pod -n orders --containers",
      "kubectl get hpa orders-api -n orders -o yaml",
      "kubectl get deployment orders-api -n orders -o yaml",
    ],
    symptom: "replica count tracks sidecar CPU instead of request volume",
    finding: "the HPA uses aggregate Resource CPU for a multi-container Pod",
    fix: "switch to a ContainerResource CPU metric for the api container",
    prevention:
      "Choose metrics that represent demand and review scaling behavior whenever sidecars change.",
    hints: [
      "Compare CPU by container, not only total CPU by Pod.",
      "The sidecar is legitimate work, but it is not the demand signal for API replicas.",
      "Use a ContainerResource metric with container: api and the same target value.",
    ],
    docsHref:
      "https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/#container-resource-metrics",
  },
  {
    number: 46,
    slug: "ten-percent-pods-all-traffic",
    title: "Ten Percent of Pods Get All Traffic",
    difficulty: "advanced",
    severity: "critical",
    estimatedMinutes: 40,
    successRate: 30,
    concepts: ["deployments", "labels-selectors", "rollouts", "services"],
    learningPaths: ["reliability", "sre-on-call"],
    capabilities: ["pods", "services", "deployments", "rollouts", "events"],
    blurb: "A rollout selector routes production traffic only to canary Pods and overloads them.",
    story:
      "A canary introduced a track label. During rollout, the production Service selector was changed to track=canary while nine stable replicas remained healthy. One canary Pod receives every request and saturates, creating intermittent 5xx errors.",
    objective:
      "Route production traffic to all checkout Pods by selecting only the stable application identity.",
    learningObjectives: [
      "Diagnose traffic imbalance through selectors and EndpointSlices.",
      "Keep release labels separate from the stable Service identity.",
    ],
    file: "checkout-service.yaml",
    resource: { kind: "Service", name: "checkout", namespace: "payments" },
    initial: `apiVersion: v1
kind: Service
metadata:
  name: checkout
  namespace: payments
spec:
  selector:
    app: checkout
    track: canary
  ports:
    - name: http
      port: 80
      targetPort: 8080
`,
    solution: `apiVersion: v1
kind: Service
metadata:
  name: checkout
  namespace: payments
spec:
  selector:
    app: checkout
  ports:
    - name: http
      port: 80
      targetPort: 8080
`,
    assertions: [
      { path: "spec.selector.app", operator: "equals", value: "checkout" },
      { path: "spec.selector.track", operator: "absent" },
      { path: "spec.ports.0.targetPort", operator: "equals", value: 8080 },
    ],
    commands: [
      "kubectl get pods -n payments --show-labels",
      "kubectl get endpointslice -n payments -l kubernetes.io/service-name=checkout -o yaml",
      "kubectl describe service checkout -n payments",
      "kubectl rollout status deployment/checkout -n payments",
    ],
    symptom: "the Service publishes only the single canary endpoint",
    finding: "track=canary was added to the stable production selector",
    fix: "remove the track selector and retain app=checkout",
    prevention:
      "Model canary routing with a separate Service or traffic-splitting controller and test endpoint counts.",
    hints: [
      "Count Ready Pods, then count endpoints behind the production Service.",
      "Compare every Service selector key with labels on stable and canary Pods.",
      "Remove spec.selector.track while keeping the app selector and port contract.",
    ],
    docsHref: "https://kubernetes.io/docs/concepts/services-networking/service/",
    incidentSource: incident(
      "Grafana Cloud label selector outage",
      "https://grafana.com/blog/how-adding-kubernetes-label-selectors-caused-an-outage-in-grafana-cloud-logs-and-how-we-resolved-it/",
      "The checkout service, ten-percent distribution, labels, and exact repair are fictionalized for KLab.",
    ),
  },
  {
    number: 47,
    slug: "pdb-makes-drain-impossible",
    title: "PDB Makes Drain Impossible",
    difficulty: "intermediate",
    severity: "high",
    estimatedMinutes: 30,
    successRate: 45,
    concepts: ["disruptions", "deployments", "scheduling", "resources"],
    learningPaths: ["reliability", "sre-on-call"],
    capabilities: ["pods", "deployments", "nodes", "scheduling", "events"],
    blurb: "A budget requires all three replicas available, leaving no legal voluntary eviction.",
    story:
      "Operations must drain a node for a security patch. The ledger API has three replicas and a PodDisruptionBudget with minAvailable 3. Eviction retries forever because the policy permits zero simultaneous disruptions.",
    objective: "Allow one voluntary disruption while preserving two available replicas.",
    learningObjectives: [
      "Calculate allowed disruptions from replicas and PDB policy.",
      "Balance maintenance progress with application quorum requirements.",
    ],
    file: "ledger-pdb.yaml",
    resource: { kind: "PodDisruptionBudget", name: "ledger-api", namespace: "payments" },
    initial: `apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: ledger-api
  namespace: payments
spec:
  minAvailable: 3
  selector:
    matchLabels:
      app: ledger-api
`,
    solution: `apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: ledger-api
  namespace: payments
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: ledger-api
`,
    assertions: [
      { path: "spec.minAvailable", operator: "equals", value: 2 },
      { path: "spec.selector.matchLabels.app", operator: "equals", value: "ledger-api" },
    ],
    commands: [
      "kubectl get pdb ledger-api -n payments",
      "kubectl describe pdb ledger-api -n payments",
      "kubectl get pods -n payments -l app=ledger-api -o wide",
      "kubectl get events -n payments --sort-by=.lastTimestamp",
    ],
    symptom: "the drain reports Cannot evict pod because it would violate the budget",
    finding: "minAvailable equals the full replica count",
    fix: "set minAvailable to 2",
    prevention:
      "Continuously test voluntary eviction and review PDB math whenever replica counts change.",
    hints: [
      "Check ALLOWED DISRUPTIONS on the PDB.",
      "Three desired replicas with minAvailable three permits no eviction.",
      "Set minAvailable to 2 and keep the selector unchanged.",
    ],
    docsHref: "https://kubernetes.io/docs/tasks/run-application/configure-pdb/",
  },
  {
    number: 48,
    slug: "delayed-crash-escapes-rollout-gate",
    title: "Delayed Crash Escapes the Rollout Gate",
    difficulty: "advanced",
    severity: "critical",
    estimatedMinutes: 40,
    successRate: 32,
    concepts: ["rollouts", "liveness-probes", "readiness-probes", "deployments"],
    learningPaths: ["reliability", "application-debugging"],
    capabilities: ["pods", "deployments", "rollouts", "container-restarts", "events"],
    blurb:
      "New Pods become Ready briefly, then crash after the rollout has already been declared complete.",
    story:
      "Version 4 of the pricing API becomes Ready in five seconds but crashes after loading a corrupt model at forty seconds. The Deployment uses minReadySeconds 0, so each transiently ready replica advances the rollout and replaces the last healthy version.",
    objective:
      "Require each new replica to remain Ready for sixty seconds before rollout progress counts it available.",
    learningObjectives: [
      "Understand the gap between momentary readiness and rollout availability.",
      "Use minReadySeconds and a progress deadline to catch delayed startup failures.",
    ],
    file: "pricing-deployment.yaml",
    resource: { kind: "Deployment", name: "pricing-api", namespace: "store" },
    initial: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: pricing-api
  namespace: store
spec:
  replicas: 4
  minReadySeconds: 0
  progressDeadlineSeconds: 600
  selector:
    matchLabels:
      app: pricing-api
  template:
    metadata:
      labels:
        app: pricing-api
    spec:
      containers:
        - name: api
          image: registry.example/pricing:v4
`,
    solution: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: pricing-api
  namespace: store
spec:
  replicas: 4
  minReadySeconds: 60
  progressDeadlineSeconds: 300
  selector:
    matchLabels:
      app: pricing-api
  template:
    metadata:
      labels:
        app: pricing-api
    spec:
      containers:
        - name: api
          image: registry.example/pricing:v4
`,
    assertions: [
      { path: "spec.minReadySeconds", operator: "gte", value: 60 },
      { path: "spec.progressDeadlineSeconds", operator: "gte", value: 61 },
      { path: "spec.progressDeadlineSeconds", operator: "lte", value: 300 },
    ],
    commands: [
      "kubectl rollout status deployment/pricing-api -n store",
      "kubectl get pods -n store -l app=pricing-api -w",
      "kubectl describe deployment pricing-api -n store",
      "kubectl get events -n store --sort-by=.lastTimestamp",
    ],
    symptom: "each v4 Pod becomes Ready before restarting around forty seconds",
    finding: "the Deployment counts a Pod available immediately at minReadySeconds zero",
    fix: "set minReadySeconds to 60 and tighten progressDeadlineSeconds to 300",
    prevention:
      "Set rollout gates beyond known delayed initialization risks and canary the artifact under real data.",
    hints: [
      "Compare time-to-ready with time-to-crash on a new replica.",
      "The rollout controller needs a stability window longer than forty seconds.",
      "Set minReadySeconds to at least 60 and progressDeadlineSeconds to no more than 300.",
    ],
    docsHref:
      "https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#min-ready-seconds",
  },
  {
    number: 49,
    slug: "finalizer-never-finishes",
    title: "Finalizer That Never Finishes",
    difficulty: "intermediate",
    severity: "medium",
    estimatedMinutes: 30,
    successRate: 43,
    concepts: ["operators", "crds", "object-management", "owners-gc", "reconciliation"],
    learningPaths: ["application-debugging", "sre-on-call"],
    capabilities: ["events", "logs", "workload-controllers"],
    blurb:
      "A custom resource remains Terminating because its retired controller owns the finalizer.",
    story:
      "A preview environment cannot be deleted. Its Preview resource has a deletion timestamp and the finalizer previews.platform.example.com/cleanup, but that operator was removed last week. No controller remains to complete cleanup and clear the key.",
    objective:
      "Remove the orphaned finalizer after verifying the external preview resources are already gone.",
    learningObjectives: [
      "Explain why deletion timestamps do not remove finalizer-protected objects.",
      "Use manual finalizer removal only after validating external cleanup.",
    ],
    file: "preview.yaml",
    resource: { kind: "Preview", name: "checkout-pr-184", namespace: "previews" },
    initial: `apiVersion: platform.example.com/v1
kind: Preview
metadata:
  name: checkout-pr-184
  namespace: previews
  finalizers:
    - previews.platform.example.com/cleanup
spec:
  pullRequest: 184
`,
    solution: `apiVersion: platform.example.com/v1
kind: Preview
metadata:
  name: checkout-pr-184
  namespace: previews
spec:
  pullRequest: 184
`,
    assertions: [
      { path: "metadata.finalizers", operator: "absent" },
      { path: "spec.pullRequest", operator: "equals", value: 184 },
    ],
    commands: [
      "kubectl get preview checkout-pr-184 -n previews -o yaml",
      "kubectl get events -n previews --sort-by=.lastTimestamp",
      "kubectl get deployment -n platform-system",
      "kubectl api-resources | findstr Preview",
    ],
    symptom: "the Preview has a deletion timestamp but never disappears",
    finding: "an orphaned operator finalizer remains after external cleanup completed",
    fix: "remove the previews.platform.example.com/cleanup finalizer",
    prevention:
      "Ship controller retirement runbooks that drain finalizers before removing an operator.",
    hints: [
      "Inspect metadata.deletionTimestamp and metadata.finalizers.",
      "Confirm no external resource remains before bypassing cleanup logic.",
      "Remove the orphaned finalizers field without changing the Preview specification.",
    ],
    docsHref: "https://kubernetes.io/docs/concepts/overview/working-with-objects/finalizers/",
  },
  {
    number: 50,
    slug: "conversion-webhook-locks-crs",
    title: "Conversion Webhook Locks Every CR",
    difficulty: "advanced",
    severity: "critical",
    estimatedMinutes: 45,
    successRate: 26,
    concepts: ["crds", "admission-controllers", "operators", "reconciliation"],
    learningPaths: ["platform-architect", "sre-on-call"],
    capabilities: ["services", "events", "logs", "workload-controllers"],
    blurb: "An unreachable conversion service makes reads of every stored custom resource fail.",
    story:
      "Two Widget API versions use an identical schema, but the CRD still calls an external conversion webhook. The service was deleted during an operator upgrade, so list and get requests fail even though no conversion logic is actually needed.",
    objective: "Use the built-in None conversion strategy for the equivalent API versions.",
    learningObjectives: [
      "Understand when CRD reads invoke conversion.",
      "Remove an unnecessary availability dependency when versions share a schema.",
    ],
    file: "widgets-crd.yaml",
    resource: { kind: "CustomResourceDefinition", name: "widgets.platform.example.com" },
    initial: `apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: widgets.platform.example.com
spec:
  group: platform.example.com
  scope: Namespaced
  names:
    plural: widgets
    singular: widget
    kind: Widget
  conversion:
    strategy: Webhook
    webhook:
      conversionReviewVersions: ["v1"]
      clientConfig:
        service:
          namespace: platform-system
          name: missing-converter
          path: /convert
  versions:
    - name: v1alpha1
      served: true
      storage: false
      schema:
        openAPIV3Schema:
          type: object
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
`,
    solution: `apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: widgets.platform.example.com
spec:
  group: platform.example.com
  scope: Namespaced
  names:
    plural: widgets
    singular: widget
    kind: Widget
  conversion:
    strategy: None
  versions:
    - name: v1alpha1
      served: true
      storage: false
      schema:
        openAPIV3Schema:
          type: object
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
`,
    assertions: [
      { path: "spec.conversion.strategy", operator: "equals", value: "None" },
      { path: "spec.conversion.webhook", operator: "absent" },
      { path: "spec.versions.0.name", operator: "equals", value: "v1alpha1" },
      { path: "spec.versions.1.name", operator: "equals", value: "v1" },
    ],
    commands: [
      "kubectl get crd widgets.platform.example.com -o yaml",
      "kubectl get widgets -A",
      "kubectl get service missing-converter -n platform-system",
      "kubectl get events -A --sort-by=.lastTimestamp",
    ],
    symptom: "all Widget reads fail on a missing conversion webhook endpoint",
    finding: "the equivalent versions use Webhook conversion unnecessarily",
    fix: "set conversion.strategy to None and remove webhook configuration",
    prevention:
      "Treat conversion services as control-plane dependencies and exercise outage behavior before API upgrades.",
    hints: [
      "Read the API error for the service name called during a get operation.",
      "Confirm the served and stored schemas do not require semantic conversion.",
      "Set spec.conversion.strategy to None and remove spec.conversion.webhook.",
    ],
    docsHref:
      "https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definition-versioning/",
  },
  {
    number: 51,
    slug: "informer-oomloop",
    title: "The Informer OOMLoop",
    difficulty: "advanced",
    severity: "critical",
    estimatedMinutes: 45,
    successRate: 28,
    concepts: ["operators", "resources", "reconciliation", "namespaces"],
    learningPaths: ["sre-on-call", "platform-architect"],
    capabilities: ["pods", "deployments", "logs", "container-restarts", "namespaces"],
    blurb:
      "A namespace controller accidentally watches the whole cluster and exhausts memory rebuilding its cache.",
    story:
      "The invoice operator should manage only the billing namespace. An empty WATCH_NAMESPACE value starts cluster-wide informers over millions of objects. The cache exceeds its memory limit, restarts, relists, and repeats the load indefinitely.",
    objective: "Scope the operator watch to billing and keep the existing memory safety boundary.",
    learningObjectives: [
      "Connect informer scope with cache memory and API list pressure.",
      "Repair controller configuration without hiding the issue by only raising limits.",
    ],
    file: "invoice-operator.yaml",
    resource: { kind: "Deployment", name: "invoice-operator", namespace: "billing" },
    initial: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: invoice-operator
  namespace: billing
spec:
  replicas: 1
  selector:
    matchLabels:
      app: invoice-operator
  template:
    metadata:
      labels:
        app: invoice-operator
    spec:
      containers:
        - name: manager
          image: registry.example/invoice-operator@sha256:8c738c738c738c738c738c738c738c738c738c738c738c738c738c738c738c73
          env:
            - name: WATCH_NAMESPACE
              value: ""
          resources:
            limits:
              memory: 512Mi
`,
    solution: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: invoice-operator
  namespace: billing
spec:
  replicas: 1
  selector:
    matchLabels:
      app: invoice-operator
  template:
    metadata:
      labels:
        app: invoice-operator
    spec:
      containers:
        - name: manager
          image: registry.example/invoice-operator@sha256:8c738c738c738c738c738c738c738c738c738c738c738c738c738c738c738c73
          env:
            - name: WATCH_NAMESPACE
              value: billing
          resources:
            limits:
              memory: 512Mi
`,
    assertions: [
      {
        path: "spec.template.spec.containers.0.env.0.name",
        operator: "equals",
        value: "WATCH_NAMESPACE",
      },
      { path: "spec.template.spec.containers.0.env.0.value", operator: "equals", value: "billing" },
      {
        path: "spec.template.spec.containers.0.resources.limits.memory",
        operator: "equals",
        value: "512Mi",
      },
    ],
    commands: [
      "kubectl logs -n billing deployment/invoice-operator --previous",
      "kubectl get pod -n billing -l app=invoice-operator",
      "kubectl get deployment invoice-operator -n billing -o yaml",
      "kubectl get --raw /metrics | findstr apiserver_request_total",
    ],
    symptom: "the manager OOMs after cluster-wide list operations on every restart",
    finding: "WATCH_NAMESPACE is empty, enabling cluster-scoped informers",
    fix: "set WATCH_NAMESPACE to billing and preserve the memory limit",
    prevention:
      "Load-test informer scope and expose cache size, list volume, and restart-loop alerts.",
    hints: [
      "Inspect the final log lines before OOM and the namespaces in list requests.",
      "Raising memory delays the loop but does not correct an unintended cluster-wide watch.",
      "Set WATCH_NAMESPACE to billing and leave the 512Mi limit in place.",
    ],
    docsHref:
      "https://kubernetes.io/docs/reference/using-api/api-concepts/#efficient-detection-of-changes",
    incidentSource: incident(
      "Red Hat operator informer cache OOM analysis",
      "https://developers.redhat.com/articles/2026/06/01/protect-your-kubernetes-operator-oomkill",
      "The source analyzes an unfiltered object cache. This lab adapts the same memory failure to an accidentally cluster-scoped namespace watch; the operator and values are fictional.",
    ),
  },
  {
    number: 53,
    slug: "prometheus-user-id-cardinality",
    title: "User IDs Take Prometheus Down",
    difficulty: "advanced",
    severity: "high",
    estimatedMinutes: 40,
    successRate: 29,
    concepts: ["annotations", "resources", "debugging"],
    learningPaths: ["sre-on-call", "platform-architect"],
    capabilities: ["configmaps", "pods", "logs", "events"],
    blurb: "A user_id metric label creates an unbounded time-series explosion.",
    story:
      "A new payments metric labels every request by user_id. Prometheus series count and memory rise with customer traffic, queries time out, and the monitoring system fails during the incident it should explain.",
    objective:
      "Drop the unbounded user_id label at scrape time while retaining route and status dimensions.",
    learningObjectives: [
      "Recognize cardinality as the product of label value combinations.",
      "Use metric relabeling to contain a dangerous label without losing the metric.",
    ],
    file: "service-monitor.yaml",
    resource: { kind: "ServiceMonitor", name: "payments-api", namespace: "observability" },
    initial: `apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: payments-api
  namespace: observability
spec:
  selector:
    matchLabels:
      app: payments-api
  endpoints:
    - port: metrics
      interval: 15s
`,
    solution: `apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: payments-api
  namespace: observability
spec:
  selector:
    matchLabels:
      app: payments-api
  endpoints:
    - port: metrics
      interval: 15s
      metricRelabelings:
        - action: labeldrop
          regex: user_id
`,
    assertions: [
      {
        path: "spec.endpoints.0.metricRelabelings.0.action",
        operator: "equals",
        value: "labeldrop",
      },
      { path: "spec.endpoints.0.metricRelabelings.0.regex", operator: "equals", value: "user_id" },
    ],
    commands: [
      "kubectl get servicemonitor payments-api -n observability -o yaml",
      "kubectl top pod -n observability -l app.kubernetes.io/name=prometheus",
      "kubectl logs -n observability -l app.kubernetes.io/name=prometheus",
      "kubectl port-forward -n observability svc/prometheus 9090:9090",
    ],
    symptom: "active series and memory grow in proportion to unique users",
    finding: "user_id is retained as an unbounded metric label",
    fix: "drop user_id using metricRelabelings",
    prevention:
      "Review metric label cardinality in CI and budget series before enabling new instrumentation.",
    hints: [
      "Find which label has nearly as many values as there are users.",
      "Keep the metric and bounded labels; remove only the identity dimension.",
      "Add a labeldrop metricRelabeling whose regex is user_id.",
    ],
    docsHref: "https://prometheus.io/docs/practices/instrumentation/",
  },
  {
    number: 54,
    slug: "etcd-nospace-freezes-writes",
    title: "etcd NOSPACE Freezes Cluster Writes",
    difficulty: "advanced",
    severity: "critical",
    estimatedMinutes: 45,
    successRate: 24,
    concepts: ["storage", "object-management", "debugging"],
    learningPaths: ["sre-on-call", "platform-architect"],
    capabilities: ["pods", "events", "logs"],
    blurb:
      "Reads still work, but etcd has raised a NOSPACE alarm and the API cannot persist changes.",
    story:
      "A controller generated and deleted millions of objects. The logical data shrank, but the etcd backend file stayed large and crossed quota. Cluster reads continue while writes fail because the NOSPACE alarm remains active. SSH and console access to a control-plane node still work, and a recovery manifest can be placed directly in the kubelet static Pod directory without an API write.",
    objective:
      "Author an out-of-band static Pod recovery manifest that discovers the live revision, compacts, defragments every member, and only then disarms NOSPACE.",
    learningObjectives: [
      "Separate etcd logical history from physical backend size.",
      "Recover from NOSPACE in the safe order before disarming the alarm.",
    ],
    file: "etcd-recovery-static-pod.yaml",
    resource: { kind: "Pod", name: "etcd-maintenance", namespace: "kube-system" },
    initial: `apiVersion: v1
kind: Pod
metadata:
  name: etcd-maintenance
  namespace: kube-system
spec:
  restartPolicy: Never
  containers:
    - name: etcdctl
      image: registry.k8s.io/etcd:3.6.0-0
      command: ["sh", "-c", "etcdctl alarm disarm"]
`,
    solution: `apiVersion: v1
kind: Pod
metadata:
  name: etcd-maintenance
  namespace: kube-system
  labels:
    recovery.klab.dev/mode: out-of-band-static-pod
spec:
  hostNetwork: true
  restartPolicy: Never
  containers:
    - name: etcdctl
      image: registry.k8s.io/etcd:3.6.0-0
      env:
        - name: ETCDCTL_API
          value: "3"
        - name: ETCDCTL_ENDPOINTS
          value: https://127.0.0.1:2379
        - name: ETCDCTL_CACERT
          value: /etc/kubernetes/pki/etcd/ca.crt
        - name: ETCDCTL_CERT
          value: /etc/kubernetes/pki/etcd/healthcheck-client.crt
        - name: ETCDCTL_KEY
          value: /etc/kubernetes/pki/etcd/healthcheck-client.key
      command:
        - sh
        - -ec
        - |
          revision="$(etcdctl endpoint status --write-out=fields | awk -F': ' '/Revision/ {print $2; exit}')"
          test -n "$revision"
          etcdctl compact "$revision"
          etcdctl defrag --cluster
          etcdctl alarm disarm
      volumeMounts:
        - name: etcd-pki
          mountPath: /etc/kubernetes/pki/etcd
          readOnly: true
  volumes:
    - name: etcd-pki
      hostPath:
        path: /etc/kubernetes/pki/etcd
        type: Directory
`,
    assertions: [
      {
        path: "spec.containers.0.command.2",
        operator: "matches",
        value: "endpoint status[\\s\\S]*compact[\\s\\S]*defrag --cluster[\\s\\S]*alarm disarm",
      },
      { path: "spec.restartPolicy", operator: "equals", value: "Never" },
      { path: "spec.hostNetwork", operator: "equals", value: true },
      { path: "spec.containers.0.env.0.name", operator: "equals", value: "ETCDCTL_API" },
      { path: "spec.containers.0.env.1.name", operator: "equals", value: "ETCDCTL_ENDPOINTS" },
      { path: "spec.containers.0.env.2.name", operator: "equals", value: "ETCDCTL_CACERT" },
      { path: "spec.containers.0.env.3.name", operator: "equals", value: "ETCDCTL_CERT" },
      { path: "spec.containers.0.env.4.name", operator: "equals", value: "ETCDCTL_KEY" },
      {
        path: "spec.containers.0.image",
        operator: "equals",
        value: "registry.k8s.io/etcd:3.6.0-0",
      },
      { path: "spec.containers.0.env.0.value", operator: "equals", value: "3" },
      {
        path: "spec.containers.0.env.1.value",
        operator: "equals",
        value: "https://127.0.0.1:2379",
      },
      {
        path: "spec.containers.0.env.2.value",
        operator: "equals",
        value: "/etc/kubernetes/pki/etcd/ca.crt",
      },
      {
        path: "spec.containers.0.env.3.value",
        operator: "equals",
        value: "/etc/kubernetes/pki/etcd/healthcheck-client.crt",
      },
      {
        path: "spec.containers.0.env.4.value",
        operator: "equals",
        value: "/etc/kubernetes/pki/etcd/healthcheck-client.key",
      },
      { path: "spec.containers.0.volumeMounts.0.name", operator: "equals", value: "etcd-pki" },
      {
        path: "spec.containers.0.volumeMounts.0.mountPath",
        operator: "equals",
        value: "/etc/kubernetes/pki/etcd",
      },
      { path: "spec.containers.0.volumeMounts.0.readOnly", operator: "equals", value: true },
      { path: "spec.volumes.0.name", operator: "equals", value: "etcd-pki" },
      {
        path: "spec.volumes.0.hostPath.path",
        operator: "equals",
        value: "/etc/kubernetes/pki/etcd",
      },
      { path: "spec.volumes.0.hostPath.type", operator: "equals", value: "Directory" },
    ],
    commands: [
      "kubectl get --raw '/readyz?verbose'",
      "sudo crictl ps -a --name etcd",
      "sudo install -m 0600 etcd-recovery-static-pod.yaml /etc/kubernetes/manifests/etcd-recovery.yaml",
      "sudo crictl logs $(sudo crictl ps -a -q --name etcdctl | head -1); sudo rm -f /etc/kubernetes/manifests/etcd-recovery.yaml",
    ],
    symptom: "API writes fail with mvcc database space exceeded while reads continue",
    finding:
      "the proposed static Pod has no endpoint or TLS identity and disarms protection before reclaiming space",
    fix: "discover the live revision, compact it, defragment the member set, and disarm last",
    prevention:
      "Monitor backend quota, object churn, database size, and scheduled compaction health.",
    hints: [
      "Treat the alarm as protection, not the root cause to remove first.",
      "Logical compaction and physical defragmentation solve different parts of the space problem.",
      "Place the authenticated recovery Pod in the control-plane static manifest directory, then compact, defrag --cluster, and disarm.",
    ],
    docsHref: "https://etcd.io/docs/v3.6/op-guide/maintenance/",
  },
  {
    number: 55,
    slug: "certificates-expired-overnight",
    title: "The Certificates Expired Overnight",
    difficulty: "advanced",
    severity: "critical",
    estimatedMinutes: 40,
    successRate: 27,
    concepts: ["reconciliation", "security-contexts", "object-management"],
    learningPaths: ["sre-on-call", "platform-architect"],
    capabilities: ["nodes", "events", "logs", "workload-controllers"],
    blurb: "Control-plane certificates age silently because no rollout is scheduled before expiry.",
    story:
      "An AWS workload cluster created by Cluster API reaches its certificate anniversary. The machine template has no rollout-before policy, so API server and kubelet client certificates expire before machines are replaced.",
    objective: "Schedule control-plane replacement thirty days before certificate expiry.",
    learningObjectives: [
      "Treat certificate lifecycle as a reconciled control-plane operation.",
      "Configure preventive rotation rather than relying on outage-time renewal.",
    ],
    file: "control-plane.yaml",
    resource: {
      kind: "KubeadmControlPlane",
      name: "production-control-plane",
      namespace: "clusters",
    },
    initial: `apiVersion: controlplane.cluster.x-k8s.io/v1beta2
kind: KubeadmControlPlane
metadata:
  name: production-control-plane
  namespace: clusters
spec:
  replicas: 3
  version: v1.36.0
  machineTemplate:
    spec:
      infrastructureRef:
        apiGroup: infrastructure.cluster.x-k8s.io
        kind: AWSMachineTemplate
        name: production-control-plane
  rollout:
    strategy:
      type: RollingUpdate
`,
    solution: `apiVersion: controlplane.cluster.x-k8s.io/v1beta2
kind: KubeadmControlPlane
metadata:
  name: production-control-plane
  namespace: clusters
spec:
  replicas: 3
  version: v1.36.0
  machineTemplate:
    spec:
      infrastructureRef:
        apiGroup: infrastructure.cluster.x-k8s.io
        kind: AWSMachineTemplate
        name: production-control-plane
  rollout:
    before:
      certificatesExpiryDays: 30
    strategy:
      type: RollingUpdate
`,
    assertions: [
      {
        path: "spec.machineTemplate.spec.infrastructureRef.apiGroup",
        operator: "equals",
        value: "infrastructure.cluster.x-k8s.io",
      },
      {
        path: "spec.machineTemplate.spec.infrastructureRef.kind",
        operator: "equals",
        value: "AWSMachineTemplate",
      },
      {
        path: "spec.machineTemplate.spec.infrastructureRef.name",
        operator: "equals",
        value: "production-control-plane",
      },
      { path: "spec.rollout.before.certificatesExpiryDays", operator: "gte", value: 30 },
      { path: "spec.replicas", operator: "gte", value: 3 },
      { path: "spec.rollout.strategy.type", operator: "equals", value: "RollingUpdate" },
    ],
    commands: [
      "kubectl get kubeadmcontrolplane -n clusters",
      "kubectl describe kubeadmcontrolplane production-control-plane -n clusters",
      "ssh <control-plane-node> sudo kubeadm certs check-expiration",
      "kubectl get machines -n clusters",
    ],
    symptom: "certificate expiry is near but no control-plane rollout is planned",
    finding: "the KubeadmControlPlane lacks a rollout.before certificate policy",
    fix: "set certificatesExpiryDays to 30",
    prevention:
      "Alert months before expiry and continuously verify automated rotation in non-production clusters.",
    hints: [
      "Check certificate dates and then inspect the controller's rollout policy.",
      "A healthy three-replica control plane can still share one lifecycle deadline.",
      "Add spec.rollout.before.certificatesExpiryDays: 30.",
    ],
    docsHref: "https://cluster-api.sigs.k8s.io/tasks/certs/auto-rotate-certificates-in-kcp",
  },
  {
    number: 56,
    slug: "control-plane-upgrade-breaks-data-plane",
    title: "Control-Plane Upgrade Breaks the Data Plane",
    difficulty: "advanced",
    severity: "critical",
    estimatedMinutes: 45,
    successRate: 25,
    concepts: ["daemonsets", "networking", "rollouts", "scheduling"],
    learningPaths: ["networking", "sre-on-call"],
    capabilities: ["pods", "nodes", "rollouts", "network-policy", "events"],
    blurb:
      "The API upgrade succeeds, but an old CNI DaemonSet cannot initialize networking on replaced nodes.",
    story:
      "The control plane reaches Kubernetes 1.36 and node replacement begins. The pinned network agent release is incompatible with the new node image, so fresh nodes stay NetworkUnavailable and application Pods cannot create sandboxes.",
    objective:
      "Roll the network agent to the approved compatible image before node replacement continues.",
    learningObjectives: [
      "Treat CNI compatibility as a prerequisite for cluster upgrades.",
      "Read node and sandbox symptoms as a data-plane component failure.",
    ],
    file: "network-agent.yaml",
    resource: { kind: "DaemonSet", name: "network-agent", namespace: "kube-system" },
    initial: `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: network-agent
  namespace: kube-system
spec:
  updateStrategy:
    type: OnDelete
  selector:
    matchLabels:
      app: network-agent
  template:
    metadata:
      labels:
        app: network-agent
    spec:
      containers:
        - name: agent
          image: registry.example/network-agent:v3.22.0
`,
    solution: `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: network-agent
  namespace: kube-system
spec:
  updateStrategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
  selector:
    matchLabels:
      app: network-agent
  template:
    metadata:
      labels:
        app: network-agent
    spec:
      containers:
        - name: agent
          image: registry.example/network-agent@sha256:136c136c136c136c136c136c136c136c136c136c136c136c136c136c136c136c
`,
    assertions: [
      { path: "spec.updateStrategy.type", operator: "equals", value: "RollingUpdate" },
      { path: "spec.updateStrategy.rollingUpdate.maxUnavailable", operator: "equals", value: 1 },
      {
        path: "spec.template.spec.containers.0.image",
        operator: "equals",
        value:
          "registry.example/network-agent@sha256:136c136c136c136c136c136c136c136c136c136c136c136c136c136c136c136c",
      },
    ],
    commands: [
      "kubectl get nodes",
      "kubectl get daemonset network-agent -n kube-system -o wide",
      "kubectl logs -n kube-system -l app=network-agent",
      "kubectl get events -A --sort-by=.lastTimestamp",
    ],
    symptom: "new nodes are NetworkUnavailable and Pod sandbox creation fails",
    finding: "the network agent is an incompatible floating version with OnDelete updates",
    fix: "use the approved digest and a one-at-a-time RollingUpdate",
    prevention:
      "Preflight CNI, CSI, ingress, and admission compatibility before every control-plane upgrade.",
    hints: [
      "Compare old and new nodes by the network agent Pod status.",
      "A successful API server upgrade does not prove data-plane compatibility.",
      "Pin image digest 136c and use RollingUpdate with maxUnavailable 1.",
    ],
    docsHref: "https://kubernetes.io/docs/tasks/administer-cluster/cluster-upgrade/",
    incidentSource: incident(
      "Production cluster CNI version mismatch postmortem",
      "https://hackmd.io/@n6YCqowrQduQ5u25wSoRXw/SkWpH9L-C",
      "The lab adapts the postmortem's CNI compatibility failure to a staged node replacement. Product names, versions, images, and rollout policy are fictional.",
    ),
  },
  {
    number: 58,
    slug: "quota-without-defaults-blocks-pods",
    title: "Quota Without Defaults Blocks Every Pod",
    difficulty: "intermediate",
    severity: "high",
    estimatedMinutes: 30,
    successRate: 46,
    concepts: ["resource-quotas", "limit-ranges", "namespaces", "resources"],
    learningPaths: ["platform-architect", "kubernetes-foundations"],
    capabilities: ["namespaces", "pods", "events", "scheduling"],
    blurb:
      "A namespace quota requires requests and limits, but no defaults exist for ordinary workloads.",
    story:
      "Platform engineering enables CPU and memory quota for team-blue. Existing deployment templates omit resource fields, and every Pod admission now fails because quota cannot account for missing requests and limits.",
    objective:
      "Provide safe namespace defaults through a LimitRange so ordinary Pods satisfy quota accounting.",
    learningObjectives: [
      "Explain how ResourceQuota changes admission requirements.",
      "Use LimitRange defaults without removing namespace safeguards.",
    ],
    file: "team-blue-limits.yaml",
    resource: { kind: "LimitRange", name: "container-defaults", namespace: "team-blue" },
    initial: `apiVersion: v1
kind: LimitRange
metadata:
  name: container-defaults
  namespace: team-blue
spec:
  limits:
    - type: Container
      max:
        cpu: "2"
        memory: 2Gi
`,
    solution: `apiVersion: v1
kind: LimitRange
metadata:
  name: container-defaults
  namespace: team-blue
spec:
  limits:
    - type: Container
      defaultRequest:
        cpu: 100m
        memory: 128Mi
      default:
        cpu: 500m
        memory: 512Mi
      max:
        cpu: "2"
        memory: 2Gi
`,
    assertions: [
      { path: "spec.limits.0.defaultRequest.cpu", operator: "equals", value: "100m" },
      { path: "spec.limits.0.defaultRequest.memory", operator: "equals", value: "128Mi" },
      { path: "spec.limits.0.default.cpu", operator: "equals", value: "500m" },
      { path: "spec.limits.0.default.memory", operator: "equals", value: "512Mi" },
    ],
    commands: [
      "kubectl describe resourcequota -n team-blue",
      "kubectl get limitrange container-defaults -n team-blue -o yaml",
      "kubectl get events -n team-blue --sort-by=.lastTimestamp",
      "kubectl run quota-test -n team-blue --image=nginx --dry-run=server -o yaml",
    ],
    symptom: "admission rejects Pods for missing cpu and memory requests and limits",
    finding: "quota is active but the LimitRange supplies no defaults",
    fix: "add bounded defaultRequest and default values",
    prevention:
      "Roll out quotas with LimitRange defaults, template validation, and a namespace admission smoke test.",
    hints: [
      "Read the quota admission error for each required resource field.",
      "Do not remove the quota; provide namespace-level defaults for omitted values.",
      "Add the required defaultRequest and default CPU and memory values to the Container limit.",
    ],
    docsHref: "https://kubernetes.io/docs/concepts/policy/limit-range/",
  },
  {
    number: 59,
    slug: "mutable-tag-split-brain",
    title: "Mutable Tag Split-Brain",
    difficulty: "intermediate",
    severity: "critical",
    estimatedMinutes: 30,
    successRate: 44,
    concepts: ["deployments", "rollouts", "object-management", "kustomize", "debugging"],
    learningPaths: ["reliability", "platform-architect"],
    capabilities: ["pods", "deployments", "image-pulls", "rollouts", "events"],
    blurb: "Pods with the same image tag run different bytes after a registry tag is overwritten.",
    story:
      "A hotfix overwrites registry.example/api:production. The production Kustomize overlay still selects that mutable tag, so existing Pods keep the cached old image while newly scheduled Pods pull different bytes under the same release name. The reusable base already contains the six-replica public-api Deployment and must remain unchanged.",
    objective:
      "Make the production overlay render the approved immutable digest without forking or editing the reusable base.",
    learningObjectives: [
      "Distinguish image tags from immutable content identities.",
      "Use a Kustomize image transform to promote a digest without copying the base manifest.",
      "Make rollout and rollback evidence reproducible from rendered configuration.",
    ],
    file: "overlays/production/kustomization.yaml",
    readonlyFiles: [
      {
        path: "base/kustomization.yaml",
        initialValue: `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
`,
      },
      {
        path: "base/deployment.yaml",
        initialValue: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: public-api
spec:
  replicas: 6
  selector:
    matchLabels:
      app: public-api
  template:
    metadata:
      labels:
        app: public-api
    spec:
      containers:
        - name: api
          image: registry.example/api:production
`,
      },
    ],
    resource: { kind: "Kustomization", name: "production" },
    initial: `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
metadata:
  name: production
namespace: production
resources:
  - ../../base
images:
  - name: registry.example/api
    newName: registry.example/api
    newTag: production
`,
    solution: `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
metadata:
  name: production
namespace: production
resources:
  - ../../base
images:
  - name: registry.example/api
    newName: registry.example/api
    digest: sha256:4d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b91
`,
    assertions: [
      {
        path: "images.0.digest",
        operator: "equals",
        value: "sha256:4d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b91",
      },
      { path: "images.0.name", operator: "equals", value: "registry.example/api" },
      { path: "images.0.newName", operator: "equals", value: "registry.example/api" },
      { path: "images.0.newTag", operator: "absent" },
      { path: "resources.0", operator: "equals", value: "../../base" },
      { path: "namespace", operator: "equals", value: "production" },
    ],
    commands: [
      "kubectl kustomize overlays/production",
      "kubectl diff -k overlays/production",
      'kubectl get pods -n production -l app=public-api -o jsonpath={range .items[*]}{.metadata.name}{" "}{.status.containerStatuses[0].imageID}{"\\n"}{end}',
      "kubectl rollout history deployment/public-api -n production",
    ],
    symptom: "Pods sharing the production tag report different imageID digests",
    finding: "the production overlay promotes a mutable tag instead of an immutable digest",
    fix: "replace the Kustomize newTag transform with the approved digest transform",
    prevention:
      "Render and diff overlays in CI, promote immutable digests, sign artifacts, and reject floating production tags through policy.",
    hints: [
      "Compare image with imageID across every replica.",
      "A tag is a registry pointer and can move without changing the overlay revision.",
      "Remove newTag, set the approved digest in images, then inspect the rendered Deployment before applying it.",
    ],
    docsHref: "https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/",
  },
];

const REPAIR_PREREQUISITES: Record<string, string[]> = {
  "all-replicas-one-failure-domain": ["rollout-cannot-fit-maxsurge", "zombie-replicaset"],
  "priority-preemption-cascade": ["all-replicas-one-failure-domain", "rollout-cannot-fit-maxsurge"],
  "conntrack-ghost": ["dns-resolution-failure", "broken-service-chain"],
  "pod-ip-pool-exhausted": ["conntrack-ghost", "all-replicas-one-failure-domain"],
  "ndots-retry-storm": ["dns-resolution-failure", "namespace-confusion"],
  "hostnetwork-lost-cluster-dns": ["ndots-retry-storm", "dns-resolution-failure"],
  "stateful-peers-cannot-discover": ["hostnetwork-lost-cluster-dns", "namespace-confusion"],
  "orphaned-ingress": ["port-routing-bug", "broken-service-chain"],
  "local-traffic-black-hole": ["service-has-no-endpoints", "all-replicas-one-failure-domain"],
  "volume-bound-wrong-zone": ["all-replicas-one-failure-domain", "immutable-deployment-selector"],
  "volume-attach-storm": ["volume-bound-wrong-zone", "all-replicas-one-failure-domain"],
  "operator-cannot-update-status": ["immutable-deployment-selector", "config-drift"],
  "admission-webhook-deadlock": ["operator-cannot-update-status", "namespace-confusion"],
  "low-cpu-terrible-latency": ["config-drift", "slow-start-without-startup-probe"],
  "logging-agent-system-oom": ["low-cpu-terrible-latency", "all-replicas-one-failure-domain"],
  "diskpressure-runaway-logs": ["logging-agent-system-oom", "pod-crashloop-mystery"],
  "hpa-cannot-compute-replicas": ["low-cpu-terrible-latency", "rollout-cannot-fit-maxsurge"],
  "sidecar-poisons-scaling-signal": ["hpa-cannot-compute-replicas", "healthy-app-broken-sidecar"],
  "ten-percent-pods-all-traffic": ["rolling-update-gone-wrong", "service-selector-mismatch"],
  "pdb-makes-drain-impossible": ["all-replicas-one-failure-domain", "rollout-cannot-fit-maxsurge"],
  "delayed-crash-escapes-rollout-gate": [
    "rolling-update-gone-wrong",
    "slow-start-without-startup-probe",
  ],
  "finalizer-never-finishes": ["operator-cannot-update-status", "config-drift"],
  "conversion-webhook-locks-crs": ["finalizer-never-finishes", "admission-webhook-deadlock"],
  "informer-oomloop": ["operator-cannot-update-status", "logging-agent-system-oom"],
  "prometheus-user-id-cardinality": ["logging-agent-system-oom", "diskpressure-runaway-logs"],
  "etcd-nospace-freezes-writes": ["prometheus-user-id-cardinality", "admission-webhook-deadlock"],
  "certificates-expired-overnight": ["etcd-nospace-freezes-writes", "admission-webhook-deadlock"],
  "control-plane-upgrade-breaks-data-plane": ["certificates-expired-overnight", "conntrack-ghost"],
  "quota-without-defaults-blocks-pods": ["hpa-cannot-compute-replicas", "namespace-confusion"],
  "mutable-tag-split-brain": ["private-registry-pull-secret", "rolling-update-gone-wrong"],
};

const REPAIR_RECOMMENDATIONS: Record<string, string[]> = {
  "all-replicas-one-failure-domain": ["priority-preemption-cascade"],
  "priority-preemption-cascade": ["build-three-zone-api"],
  "conntrack-ghost": ["pod-ip-pool-exhausted"],
  "pod-ip-pool-exhausted": ["build-three-zone-api"],
  "ndots-retry-storm": ["hostnetwork-lost-cluster-dns"],
  "hostnetwork-lost-cluster-dns": ["stateful-peers-cannot-discover"],
  "stateful-peers-cannot-discover": ["build-recoverable-stateful-data-plane"],
  "orphaned-ingress": ["build-multi-team-gateway"],
  "local-traffic-black-hole": ["build-default-deny-service-graph"],
  "volume-bound-wrong-zone": ["volume-attach-storm"],
  "volume-attach-storm": ["build-recoverable-stateful-data-plane"],
  "operator-cannot-update-status": ["admission-webhook-deadlock"],
  "admission-webhook-deadlock": ["finalizer-never-finishes"],
  "low-cpu-terrible-latency": ["hpa-cannot-compute-replicas"],
  "logging-agent-system-oom": ["diskpressure-runaway-logs"],
  "diskpressure-runaway-logs": ["prometheus-user-id-cardinality"],
  "hpa-cannot-compute-replicas": ["sidecar-poisons-scaling-signal"],
  "sidecar-poisons-scaling-signal": ["build-flash-sale-scaling-system"],
  "ten-percent-pods-all-traffic": ["delayed-crash-escapes-rollout-gate"],
  "pdb-makes-drain-impossible": ["build-three-zone-api"],
  "delayed-crash-escapes-rollout-gate": ["build-flash-sale-scaling-system"],
  "finalizer-never-finishes": ["conversion-webhook-locks-crs"],
  "conversion-webhook-locks-crs": ["informer-oomloop"],
  "informer-oomloop": ["build-incident-survivable-observability"],
  "prometheus-user-id-cardinality": ["build-incident-survivable-observability"],
  "etcd-nospace-freezes-writes": ["certificates-expired-overnight"],
  "certificates-expired-overnight": ["control-plane-upgrade-breaks-data-plane"],
  "control-plane-upgrade-breaks-data-plane": ["build-signed-promotion-pipeline"],
  "quota-without-defaults-blocks-pods": ["build-two-team-platform"],
  "mutable-tag-split-brain": ["build-signed-promotion-pipeline"],
};

function makeLevel(spec: ProductionRepairSpec): ProblemLevel {
  const xp = spec.difficulty === "advanced" ? 200 : 150;
  const apiVersion = /^apiVersion:\s*(\S+)/m.exec(spec.solution)?.[1];
  if (!apiVersion) throw new Error(`${spec.slug} solution is missing apiVersion`);
  return {
    id: `problem-${spec.number}`,
    slug: spec.slug,
    ...PUBLISHED_PROBLEM_V1,
    title: spec.title,
    difficulty: spec.difficulty,
    severity: spec.severity,
    xp,
    estimatedMinutes: spec.estimatedMinutes,
    successRate: spec.successRate,
    concepts: spec.concepts,
    blurb: spec.blurb,
    story: spec.story,
    objective: spec.objective,
    learningObjectives: spec.learningObjectives,
    prerequisites: REPAIR_PREREQUISITES[spec.slug] ?? ["immutable-deployment-selector"],
    learningPaths: spec.learningPaths,
    capabilities: spec.capabilities,
    incidentSource: spec.incidentSource,
    engine: { kind: "scripted", scenarioId: "manifest-assessment" },
    constraints: [
      {
        id: "editable-workspace",
        label: `Only edit ${spec.file}; preserve the named production resource`,
        kind: "editable-files",
        paths: [spec.file],
      },
      {
        id: "production-requirements",
        label: spec.objective,
        kind: "manifest",
        file: spec.file,
        resource: spec.resource,
        exclusive: true,
        assertions: [
          { path: "apiVersion", operator: "equals", value: apiVersion },
          ...spec.assertions,
        ],
      },
    ],
    files: [
      {
        path: spec.file,
        language: "yaml",
        initialValue: spec.initial,
        access: "editable",
        applyAtBoot: false,
      },
      ...(spec.readonlyFiles ?? []).map((file) => ({
        path: file.path,
        language: "yaml" as const,
        initialValue: file.initialValue,
        access: "readonly" as const,
        applyAtBoot: false,
      })),
    ],
    quickCommands: [
      { id: "assessment-pods", command: "kubectl get pods" },
      { id: "assessment-events", command: "kubectl get events" },
      {
        id: "assessment-deployment",
        command: "kubectl describe deployment manifest-assessment",
      },
      { id: "assessment-logs", command: "kubectl logs manifest-assessment" },
    ],
    referenceCommands: spec.commands,
    probeTargets: ["http://assessment-svc/"],
    validators: [
      {
        id: "assessment-ready",
        title: "Production requirements pass",
        successLabel: `${spec.title} configuration passes assessment`,
        failureLabel: `${spec.title} still violates a production requirement`,
        kind: "deployment-ready",
        namespace: "default",
        name: "manifest-assessment",
        minReadyReplicas: 1,
      },
      {
        id: "assessment-endpoint",
        title: "Assessment publishes a ready endpoint",
        successLabel: "The repaired manifest has a ready assessment endpoint",
        failureLabel: "The failing manifest has no ready assessment endpoint",
        kind: "service-has-ready-endpoints",
        namespace: "default",
        name: "assessment-svc",
        minReadyEndpoints: 1,
      },
      {
        id: "assessment-http",
        title: "Assessment API accepts the manifest",
        successLabel: "The manifest assessment returns HTTP 200",
        failureLabel: "The manifest assessment returns HTTP 422",
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
        id: "hint-1",
        title: "Start from the incident boundary",
        body: spec.hints[0],
        xpPenalty: spec.difficulty === "advanced" ? 30 : 20,
      },
      {
        id: "hint-2",
        title: "Connect the evidence",
        body: spec.hints[1],
        xpPenalty: spec.difficulty === "advanced" ? 50 : 35,
        unlockAfter: ["r-symptom"],
      },
      {
        id: "hint-3",
        title: "Apply the narrow repair",
        body: spec.hints[2],
        xpPenalty: spec.difficulty === "advanced" ? 70 : 50,
        unlockAfter: ["r-policy"],
      },
    ],
    evidenceRules: [
      {
        id: "r-symptom",
        evidenceId: `${spec.slug}-symptom`,
        label: `The submitted ${spec.file} fails static production review`,
        hiddenLabel: "Static review failure reproduced",
        source: "network",
        trigger: {
          type: "probe",
          hostMatches: "^assessment-svc$",
          pathMatches: "^/$",
          status: 422,
        },
      },
      {
        id: "r-policy",
        evidenceId: `${spec.slug}-policy`,
        label: "ConfigRejected identifies an unmet manifest requirement",
        hiddenLabel: "Rejected configuration inspected",
        source: "events",
        trigger: {
          type: "event-reason",
          reason: "ConfigRejected",
          messageMatches: "production requirements",
        },
      },
      {
        id: "r-assessor-log",
        evidenceId: `${spec.slug}-assessor-log`,
        label: "The static review engine rejected the submitted configuration",
        hiddenLabel: "Assessment log reviewed",
        source: "logs",
        trigger: {
          type: "log",
          podMatches: "^manifest-assessment$",
          namespace: "default",
          messageMatches: "configuration rejected",
        },
      },
      {
        id: "r-validator",
        evidenceId: `${spec.slug}-validator`,
        label: `The current ${spec.file} fails its production acceptance gate`,
        hiddenLabel: "Acceptance gate checked",
        source: "validator",
        trigger: { type: "validator", validatorId: "assessment-ready", passed: false },
      },
    ],
    postSolveExplanation: {
      rootCause: spec.finding,
      whyItFailed: `${spec.story} In a real cluster, the decisive symptom is that ${spec.symptom}.`,
      whatFixedIt: `The accepted repair was to ${spec.fix}.`,
      prevention: spec.prevention,
      relatedConcepts: spec.concepts,
      docsHref: spec.docsHref,
      recommendedNextSlugs: REPAIR_RECOMMENDATIONS[spec.slug] ?? [],
    },
  };
}

export const PRODUCTION_REPAIR_LEVELS: ProblemLevel[] = SPECS.map(makeLevel);

export const PRODUCTION_REPAIR_SOLUTIONS: Record<
  string,
  Record<string, string>
> = Object.fromEntries(SPECS.map((spec) => [spec.slug, { [spec.file]: spec.solution }]));
