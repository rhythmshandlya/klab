import type { FixturePod, FixtureResource, ProblemLevel } from "@/lib/domain/types";
import { BRAND } from "@/config/brand";

import { PUBLISHED_PROBLEM_V1 } from "./metadata";
import {
  buildRepairFixture,
  repairObservedResource,
  repairWorkloadSelector,
  type RepairClusterOverrides,
} from "./repair-fixture";

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
  /**
   * Outcome-level requirements. Prefer these over path assertions for whatever the
   * incident is actually about: they accept any Kubernetes expression that fixes it.
   */
  goals?: ManifestConstraint["goals"];
  /** Cross-resource or least-privilege rules that cannot be expressed as scalar paths. */
  semanticPolicy?: ProblemLevel["semanticPolicy"];
  commands: [string, string, string, string];
  /** Extra shortcuts for incident-specific supporting objects exposed by the fixture. */
  quickCommands?: string[];
  symptom: string;
  finding: string;
  fix: string;
  prevention: string;
  hints: [string, string, string];
  /** Event reason the broken cluster raises, matching what the incident would emit. */
  eventReason?: string;
  /** Pod-state detail the manifest cannot express (placement, pending, restarts). */
  cluster?: RepairClusterOverrides;
  /** Selector for supporting incident Pods when the edited resource does not own them. */
  podSelector?: Record<string, string>;
  /** Evidence Pod regex when supporting Pods do not share the edited resource name. */
  logPodMatches?: string;
  docsHref: string;
  incidentSource?: NonNullable<ProblemLevel["incidentSource"]>;
}

const fictionalAdaptation = (detail: string): string =>
  `This is a fictional ${BRAND.name} adaptation inspired by the source. It is not an exact reproduction. ${detail}`;

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

const PRIORITY_CLASS_RESOURCES: FixtureResource[] = [
  {
    apiVersion: "scheduling.k8s.io/v1",
    kind: "PriorityClass",
    metadata: { name: "platform-critical" },
    value: 1_000_000,
    globalDefault: false,
    preemptionPolicy: "PreemptLowerPriority",
    description: "Reserved for platform-critical control-plane workloads.",
  },
  {
    apiVersion: "scheduling.k8s.io/v1",
    kind: "PriorityClass",
    metadata: { name: "customer-serving" },
    value: 100_000,
    globalDefault: false,
    preemptionPolicy: "PreemptLowerPriority",
    description: "Customer-facing workloads that may displace optional batch work.",
  },
  {
    apiVersion: "scheduling.k8s.io/v1",
    kind: "PriorityClass",
    metadata: { name: "batch-low" },
    value: 1_000,
    globalDefault: false,
    preemptionPolicy: "Never",
    description: "Optional batch work that must never preempt serving workloads.",
  },
];

const POLICY_API_POD: FixturePod = {
  name: "policy-api-7d4f9",
  labels: { app: "policy-api" },
  nodeName: "node-1",
  podIP: "10.29.0.20",
  ready: true,
  containers: [
    {
      name: "policy-api",
      image:
        "registry.example/policy-api@sha256:2929292929292929292929292929292929292929292929292929292929292929",
      port: { name: "https", containerPort: 8443 },
    },
  ],
  logs: [{ message: "policy API serving normally" }],
};

function publicApiPod(index: number, ready: boolean): FixturePod {
  return {
    name: `public-api-${index + 1}`,
    labels: { app: "public-api", tier: "customer-serving" },
    priorityClassName: "customer-serving",
    priority: 100_000,
    ...(ready
      ? {
          nodeName: `worker-${index + 1}`,
          podIP: `10.20.0.${20 + index}`,
          phase: "Running" as const,
        }
      : { phase: "Pending" as const }),
    ready,
    containers: [
      {
        name: "api",
        image: "registry.example/public-api:5.8.0",
        ready,
        ...(!ready ? { waitingReason: "Unschedulable" } : {}),
      },
    ],
    logs: ready ? [{ message: "public API serving normally" }] : [],
  };
}

function checkoutTrafficPod(index: number, track: "stable" | "canary"): FixturePod {
  return {
    name: `checkout-${track}-${index + 1}`,
    namespace: "payments",
    labels: { app: "checkout", track },
    nodeName: `payments-node-${(index % 3) + 1}`,
    podIP: `10.46.0.${10 + index}`,
    phase: "Running",
    ready: true,
    containers: [
      {
        name: "checkout",
        image: `registry.example/checkout:${track === "canary" ? "8.1.0" : "8.0.0"}`,
        port: { name: "http", containerPort: 8080 },
        ready: true,
      },
    ],
    logs: [{ message: `${track} checkout replica serving normally` }],
  };
}

function ledgerPod(index: number): FixturePod {
  return {
    name: `ledger-api-${index + 1}`,
    namespace: "payments",
    labels: { app: "ledger-api" },
    nodeName: `ledger-node-${index + 1}`,
    podIP: `10.47.0.${10 + index}`,
    phase: "Running",
    ready: true,
    containers: [{ name: "api", image: "registry.example/ledger-api:5.4.0", ready: true }],
    logs: [{ message: "ledger API serving normally" }],
  };
}

function pricingPod(index: number, version: "v3" | "v4", crashing: boolean): FixturePod {
  const ready = !crashing;
  return {
    name: `pricing-api-${version}-${index + 1}`,
    namespace: "store",
    labels: { app: "pricing-api", version },
    nodeName: `store-node-${(index % 2) + 1}`,
    podIP: `10.48.${version === "v4" ? 4 : 3}.${10 + index}`,
    phase: "Running",
    ready,
    containers: [
      {
        name: "api",
        image: `registry.example/pricing:${version}`,
        ready,
        ...(crashing ? { restartCount: 4, waitingReason: "CrashLoopBackOff" } : {}),
      },
    ],
    logs: [
      {
        message: crashing
          ? "model load failed after 40 seconds; restarting"
          : "pricing API serving normally",
      },
    ],
  };
}

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
      "A zone-loss exercise took checkout completely offline. After zone-a recovered, all three replicas became healthy again, but the scheduler placed every replacement back in zone-a. The green replica dashboard has restored service, not resilience; another zone interruption would repeat the outage.",
    objective:
      "Require checkout replicas to spread across zones so one failure domain cannot remove the entire service.",
    learningObjectives: [
      "Distinguish replica count from failure-domain redundancy.",
      "Configure a hard topology spread policy and understand its scheduling tradeoff.",
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
    // Graded as an outcome: a required podAntiAffinity on the zone key spreads these
    // replicas just as well as a topology spread rule, and must be accepted.
    assertions: [
      { path: "spec.replicas", operator: "equals", value: 3 },
      { path: "spec.selector.matchLabels.app", operator: "equals", value: "checkout" },
      { path: "spec.template.metadata.labels.app", operator: "equals", value: "checkout" },
      {
        path: "spec.template.spec.containers[name=api].image",
        operator: "equals",
        value:
          "registry.example/checkout@sha256:4c104c104c104c104c104c104c104c104c104c104c104c104c104c104c104c10",
      },
    ],
    goals: [
      { goal: "spreads-across-topology", topologyKey: "topology.kubernetes.io/zone", maxSkew: 1 },
    ],
    commands: [
      "kubectl get pods -n payments -o wide",
      "kubectl get nodes -L topology.kubernetes.io/zone",
      "kubectl describe deployment checkout -n payments",
      "kubectl get events -n payments --sort-by=.lastTimestamp",
    ],
    quickCommands: [
      "kubectl describe node zone-a-1",
      "kubectl describe node zone-b-1",
      "kubectl describe node zone-c-1",
    ],
    symptom: "all checkout Pod IPs map to nodes in zone-a",
    finding: "the Deployment has no topology spread or anti-affinity rule",
    fix: "add a zone topology spread constraint with maxSkew 1",
    prevention:
      "Test zone-loss behavior and alert when production replicas collapse into one failure domain.",
    hints: [
      "List Pods with node names, then inspect each node's existing zone label.",
      "Replicas only provide zone resilience when scheduling expresses that intent.",
      "Use topologySpreadConstraints on topology.kubernetes.io/zone with maxSkew 1.",
    ],
    eventReason: "TopologySkew",
    cluster: {
      nodes: [
        { name: "zone-a-1", labels: { "topology.kubernetes.io/zone": "zone-a" } },
        { name: "zone-b-1", labels: { "topology.kubernetes.io/zone": "zone-b" } },
        { name: "zone-c-1", labels: { "topology.kubernetes.io/zone": "zone-c" } },
      ],
      brokenNodeNames: ["zone-a-1", "zone-a-1", "zone-a-1"],
      healthyNodeNames: ["zone-a-1", "zone-b-1", "zone-c-1"],
    },
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
      { path: "spec.selector.matchLabels.app", operator: "equals", value: "reporting" },
      { path: "spec.template.metadata.labels.app", operator: "equals", value: "reporting" },
      {
        path: "spec.template.spec.priorityClassName",
        operator: "equals",
        value: "batch-low",
      },
      {
        path: "spec.template.spec.containers[name=reporter].image",
        operator: "equals",
        value: "registry.example/reporter:2.4.0",
      },
    ],
    readonlyFiles: [
      {
        path: "priority-classes.yaml",
        initialValue: `apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: platform-critical
value: 1000000
globalDefault: false
preemptionPolicy: PreemptLowerPriority
description: Reserved for platform-critical control-plane workloads.
---
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: customer-serving
value: 100000
globalDefault: false
preemptionPolicy: PreemptLowerPriority
description: Customer-facing workloads that may displace optional batch work.
---
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: batch-low
value: 1000
globalDefault: false
preemptionPolicy: Never
description: Optional batch work that must never preempt serving workloads.
`,
      },
    ],
    commands: [
      "kubectl get priorityclass",
      "kubectl get pods -A -o custom-columns=NAME:.metadata.name,PRIORITY:.spec.priority",
      "kubectl get events -A --field-selector reason=Preempted",
      "kubectl describe priorityclass batch-low",
    ],
    quickCommands: [
      "kubectl get deployment reporting -n analytics -o yaml",
      "kubectl get priorityclass",
      "kubectl describe priorityclass platform-critical",
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
    eventReason: "Preempted",
    cluster: {
      resources: PRIORITY_CLASS_RESOURCES,
      nodes: [{ name: "worker-1" }, { name: "worker-2" }],
      additionalBrokenPods: [publicApiPod(0, false), publicApiPod(1, false)],
      additionalHealthyPods: [publicApiPod(0, true), publicApiPod(1, true)],
      brokenEvents: [
        {
          reason: "FailedScheduling",
          type: "Warning",
          message:
            "public-api replacements cannot fit while reporting occupies the available capacity",
          involvedObject: { kind: "Deployment", name: "public-api" },
        },
      ],
    },
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
    assertions: [
      { path: "spec.replicas", operator: "equals", value: 3 },
      { path: "spec.selector.matchLabels.k8s-app", operator: "equals", value: "kube-dns" },
      {
        path: "spec.template.metadata.labels.k8s-app",
        operator: "equals",
        value: "kube-dns",
      },
      {
        path: "spec.template.spec.containers[name=coredns].image",
        operator: "equals",
        value: "registry.k8s.io/coredns/coredns:v1.12.0",
      },
    ],
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
    eventReason: "DNSResolutionFailed",
    cluster: {
      nodes: [
        { name: "dns-node-a", labels: { "topology.kubernetes.io/zone": "us-central1-a" } },
        { name: "dns-node-b", labels: { "topology.kubernetes.io/zone": "us-central1-b" } },
        { name: "dns-node-c", labels: { "topology.kubernetes.io/zone": "us-central1-c" } },
      ],
      brokenNodeNames: ["dns-node-a"],
      healthyNodeNames: ["dns-node-a", "dns-node-b", "dns-node-c"],
    },
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
    capabilities: ["pods", "nodes", "scheduling", "events"],
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
        path: "spec.ipAllocationPolicy.additionalPodRangesConfig.podRangeNames",
        operator: "array-contains",
        value: "pods-expansion-2026",
      },
      { path: "spec.location", operator: "equals", value: "us-central1" },
      {
        path: "spec.ipAllocationPolicy.clusterSecondaryRangeName",
        operator: "equals",
        value: "pods-primary",
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
    eventReason: "FailedCreatePodSandBox",
    cluster: {
      nodes: [{ name: "worker-a" }, { name: "worker-b" }, { name: "worker-c" }],
      brokenPods: [
        {
          name: "checkout-7d4f9",
          labels: { app: "checkout" },
          phase: "Pending",
          ready: false,
          containers: [
            {
              name: "checkout",
              image: "registry.example/checkout:6.1.0",
              ready: false,
              waitingReason: "ContainerCreating",
            },
          ],
          logs: [],
        },
        {
          name: "checkout-6c2b8",
          labels: { app: "checkout" },
          phase: "Pending",
          ready: false,
          containers: [
            {
              name: "checkout",
              image: "registry.example/checkout:6.1.0",
              ready: false,
              waitingReason: "ContainerCreating",
            },
          ],
          logs: [],
        },
      ],
      healthyPods: [
        {
          name: "checkout-7d4f9",
          labels: { app: "checkout" },
          nodeName: "worker-b",
          podIP: "10.42.1.20",
          phase: "Running",
          ready: true,
          containers: [{ name: "checkout", image: "registry.example/checkout:6.1.0", ready: true }],
          logs: [{ message: "checkout serving normally" }],
        },
        {
          name: "checkout-6c2b8",
          labels: { app: "checkout" },
          nodeName: "worker-c",
          podIP: "10.43.1.21",
          phase: "Running",
          ready: true,
          containers: [{ name: "checkout", image: "registry.example/checkout:6.1.0", ready: true }],
          logs: [{ message: "checkout serving normally" }],
        },
      ],
      brokenEvents: [
        {
          reason: "FailedCreatePodSandBox",
          type: "Warning",
          message: "failed to allocate for range 0: no IP addresses available in pods-primary",
          involvedObject: { kind: "Pod", name: "checkout-7d4f9" },
        },
      ],
    },
    docsHref: "https://cloud.google.com/kubernetes-engine/docs/how-to/multi-pod-cidr",
    incidentSource: incident(
      "When GKE ran out of IP addresses",
      "https://deploy.live/blog/when-gke-ran-out-of-ip-addresses/",
      `The range names, Config Connector workflow, application launch, and required correction were created specifically for ${BRAND.name}.`,
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
      {
        path: "spec.selector.matchLabels.app",
        operator: "equals",
        value: "telemetry-agent",
      },
      {
        path: "spec.template.metadata.labels.app",
        operator: "equals",
        value: "telemetry-agent",
      },
      { path: "spec.template.spec.dnsPolicy", operator: "absent" },
      {
        path: "spec.template.spec.dnsConfig.options[name=ndots].name",
        operator: "equals",
        value: "ndots",
      },
      {
        path: "spec.template.spec.dnsConfig.options[name=ndots].value",
        operator: "equals",
        value: "1",
      },
      {
        path: "spec.template.spec.containers[name=agent].image",
        operator: "equals",
        value:
          "registry.example/telemetry@sha256:aa21aa21aa21aa21aa21aa21aa21aa21aa21aa21aa21aa21aa21aa21aa21aa21",
      },
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
    concepts: ["dns", "networking", "services", "pods", "debugging"],
    learningPaths: ["networking", "application-debugging"],
    capabilities: ["pods", "services", "dns", "events", "logs"],
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
      { path: "spec.template.spec.dnsConfig", operator: "absent" },
      {
        path: "spec.selector.matchLabels.app",
        operator: "equals",
        value: "security-agent",
      },
      {
        path: "spec.template.metadata.labels.app",
        operator: "equals",
        value: "security-agent",
      },
      {
        path: "spec.template.spec.containers[name=agent].image",
        operator: "equals",
        value:
          "registry.example/security-agent@sha256:71ef71ef71ef71ef71ef71ef71ef71ef71ef71ef71ef71ef71ef71ef71ef71ef",
      },
    ],
    quickCommands: [
      "kubectl get service policy-api -n security -o yaml",
      "kubectl get endpointslice -n security -l kubernetes.io/service-name=policy-api",
    ],
    commands: [
      "kubectl logs -n security security-agent-7d4f9",
      "kubectl get daemonset security-agent -n security -o yaml",
      "kubectl get service policy-api -n security -o yaml",
      "kubectl get endpointslice -n security -l kubernetes.io/service-name=policy-api",
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
    eventReason: "DNSResolutionFailed",
    cluster: {
      services: [
        {
          name: "policy-api",
          clusterIP: "10.96.29.10",
          selector: { app: "policy-api" },
          ports: [{ name: "https", port: 443, targetPort: 8443 }],
        },
      ],
      additionalBrokenPods: [POLICY_API_POD],
      additionalHealthyPods: [POLICY_API_POD],
    },
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
    capabilities: ["pods", "services", "dns", "logs", "workload-controllers"],
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
  type: ClusterIP
  clusterIP: None
  publishNotReadyAddresses: false
  selector:
    app: database
  ports:
    - name: peer
      port: 7000
      protocol: TCP
`,
    solution: `apiVersion: v1
kind: Service
metadata:
  name: database
  namespace: data
spec:
  type: ClusterIP
  clusterIP: None
  publishNotReadyAddresses: true
  selector:
    app: database
  ports:
    - name: peer
      port: 7000
      protocol: TCP
`,
    assertions: [
      { path: "spec.type", operator: "equals", value: "ClusterIP" },
      { path: "spec.clusterIP", operator: "equals", value: "None" },
      { path: "spec.publishNotReadyAddresses", operator: "equals", value: true },
      { path: "spec.selector.app", operator: "equals", value: "database" },
      { path: "spec.ports[name=peer].port", operator: "equals", value: 7000 },
      { path: "spec.ports[name=peer].protocol", operator: "equals", value: "TCP" },
    ],
    quickCommands: [
      "kubectl get statefulset database -n data -o yaml",
      "kubectl get endpointslice -n data -l kubernetes.io/service-name=database",
    ],
    commands: [
      "kubectl get statefulset -n data",
      "kubectl get service database -n data -o yaml",
      "kubectl get endpointslice -n data -l kubernetes.io/service-name=database",
      "kubectl logs -n data database-0",
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
    eventReason: "Unhealthy",
    cluster: {
      resources: [
        {
          apiVersion: "apps/v1",
          kind: "StatefulSet",
          metadata: { name: "database", namespace: "data" },
          spec: {
            serviceName: "database",
            podManagementPolicy: "Parallel",
            replicas: 3,
            selector: { matchLabels: { app: "database" } },
            template: {
              metadata: { labels: { app: "database" } },
              spec: {
                containers: [
                  {
                    name: "database",
                    image:
                      "registry.example/database@sha256:3030303030303030303030303030303030303030303030303030303030303030",
                    ports: [{ name: "peer", containerPort: 7000 }],
                  },
                ],
              },
            },
          },
        },
      ],
      nodes: [{ name: "data-1" }, { name: "data-2" }, { name: "data-3" }],
      brokenPods: [
        {
          name: "database-0",
          labels: { app: "database" },
          nodeName: "data-1",
          podIP: "10.30.0.10",
          ready: false,
          containers: [
            {
              name: "database",
              image:
                "registry.example/database@sha256:3030303030303030303030303030303030303030303030303030303030303030",
              port: { name: "peer", containerPort: 7000 },
            },
          ],
          logs: [
            {
              message:
                "peer-specific DNS queries return no usable records; waiting for database-1.database and database-2.database",
            },
          ],
        },
        {
          name: "database-1",
          labels: { app: "database" },
          nodeName: "data-2",
          podIP: "10.30.0.11",
          ready: false,
          containers: [
            {
              name: "database",
              image:
                "registry.example/database@sha256:3030303030303030303030303030303030303030303030303030303030303030",
              port: { name: "peer", containerPort: 7000 },
            },
          ],
          logs: [{ message: "waiting for database-0.database and database-2.database" }],
        },
        {
          name: "database-2",
          labels: { app: "database" },
          nodeName: "data-3",
          podIP: "10.30.0.12",
          ready: false,
          containers: [
            {
              name: "database",
              image:
                "registry.example/database@sha256:3030303030303030303030303030303030303030303030303030303030303030",
              port: { name: "peer", containerPort: 7000 },
            },
          ],
          logs: [{ message: "waiting for database-0.database and database-1.database" }],
        },
      ],
      healthyPods: [
        {
          name: "database-0",
          labels: { app: "database" },
          nodeName: "data-1",
          podIP: "10.30.0.10",
          ready: true,
          containers: [
            {
              name: "database",
              image:
                "registry.example/database@sha256:3030303030303030303030303030303030303030303030303030303030303030",
              port: { name: "peer", containerPort: 7000 },
            },
          ],
          logs: [{ message: "consensus member database-0 joined the cluster" }],
        },
        {
          name: "database-1",
          labels: { app: "database" },
          nodeName: "data-2",
          podIP: "10.30.0.11",
          ready: true,
          containers: [
            {
              name: "database",
              image:
                "registry.example/database@sha256:3030303030303030303030303030303030303030303030303030303030303030",
              port: { name: "peer", containerPort: 7000 },
            },
          ],
          logs: [{ message: "consensus member database-1 joined the cluster" }],
        },
        {
          name: "database-2",
          labels: { app: "database" },
          nodeName: "data-3",
          podIP: "10.30.0.12",
          ready: true,
          containers: [
            {
              name: "database",
              image:
                "registry.example/database@sha256:3030303030303030303030303030303030303030303030303030303030303030",
              port: { name: "peer", containerPort: 7000 },
            },
          ],
          logs: [{ message: "consensus member database-2 joined the cluster" }],
        },
      ],
    },
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
    capabilities: ["services", "pods", "events"],
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
      {
        path: "spec.rules[host=shop.example.com].http.paths[path=/].pathType",
        operator: "equals",
        value: "Prefix",
      },
      {
        path: "spec.rules[host=shop.example.com].http.paths[path=/].backend.service.name",
        operator: "equals",
        value: "storefront",
      },
      {
        path: "spec.rules[host=shop.example.com].http.paths[path=/].backend.service.port.number",
        operator: "equals",
        value: 80,
      },
    ],
    quickCommands: [
      "kubectl get ingressclass",
      "kubectl get service storefront -n shop -o yaml",
      "kubectl get endpointslice -n shop -l kubernetes.io/service-name=storefront",
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
    eventReason: "IngressClassNotFound",
    cluster: {
      resources: [
        {
          apiVersion: "networking.k8s.io/v1",
          kind: "IngressClass",
          metadata: { name: "nginx" },
          spec: { controller: "k8s.io/ingress-nginx" },
        },
      ],
      services: [
        {
          name: "storefront",
          clusterIP: "10.96.31.20",
          selector: { app: "storefront" },
          ports: [{ name: "http", port: 80, targetPort: 8080 }],
        },
      ],
      brokenPods: [
        {
          name: "storefront-7d4f9",
          labels: { app: "storefront" },
          nodeName: "shop-1",
          podIP: "10.31.0.10",
          ready: true,
          containers: [
            {
              name: "storefront",
              image:
                "registry.example/storefront@sha256:3131313131313131313131313131313131313131313131313131313131313131",
              port: { name: "http", containerPort: 8080 },
            },
          ],
        },
        {
          name: "storefront-6c2b8",
          labels: { app: "storefront" },
          nodeName: "shop-2",
          podIP: "10.31.0.11",
          ready: true,
          containers: [
            {
              name: "storefront",
              image:
                "registry.example/storefront@sha256:3131313131313131313131313131313131313131313131313131313131313131",
              port: { name: "http", containerPort: 8080 },
            },
          ],
        },
      ],
      healthyPods: [
        {
          name: "storefront-7d4f9",
          labels: { app: "storefront" },
          nodeName: "shop-1",
          podIP: "10.31.0.10",
          ready: true,
          containers: [
            {
              name: "storefront",
              image:
                "registry.example/storefront@sha256:3131313131313131313131313131313131313131313131313131313131313131",
              port: { name: "http", containerPort: 8080 },
            },
          ],
        },
        {
          name: "storefront-6c2b8",
          labels: { app: "storefront" },
          nodeName: "shop-2",
          podIP: "10.31.0.11",
          ready: true,
          containers: [
            {
              name: "storefront",
              image:
                "registry.example/storefront@sha256:3131313131313131313131313131313131313131313131313131313131313131",
              port: { name: "http", containerPort: 8080 },
            },
          ],
        },
      ],
      nodes: [{ name: "shop-1" }, { name: "shop-2" }],
    },
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
      protocol: TCP
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
      protocol: TCP
`,
    assertions: [
      { path: "spec.type", operator: "equals", value: "LoadBalancer" },
      { path: "spec.selector.app", operator: "equals", value: "payments" },
      { path: "spec.ports[port=443].targetPort", operator: "equals", value: 8443 },
      { path: "spec.ports[port=443].protocol", operator: "equals", value: "TCP" },
      {
        path: "metadata.annotations.incident-exception",
        operator: "equals",
        value: "client-ip-loss-approved",
      },
    ],
    goals: [{ goal: "external-traffic-routes-cluster-wide" }],
    quickCommands: [
      "kubectl get endpointslice -n payments -l kubernetes.io/service-name=payments-public",
      "kubectl get nodes",
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
    eventReason: "ExternalTrafficDropped",
    cluster: {
      nodes: [
        { name: "payments-1" },
        { name: "payments-2" },
        { name: "payments-3" },
        { name: "payments-4" },
        { name: "payments-5" },
        { name: "payments-6" },
      ],
      brokenPods: [
        {
          name: "payments-7d4f9",
          labels: { app: "payments" },
          nodeName: "payments-1",
          podIP: "10.32.0.10",
          ready: true,
          containers: [
            {
              name: "payments",
              image:
                "registry.example/payments@sha256:3232323232323232323232323232323232323232323232323232323232323232",
              port: { name: "https", containerPort: 8443 },
            },
          ],
        },
        {
          name: "payments-6c2b8",
          labels: { app: "payments" },
          nodeName: "payments-2",
          podIP: "10.32.0.11",
          ready: true,
          containers: [
            {
              name: "payments",
              image:
                "registry.example/payments@sha256:3232323232323232323232323232323232323232323232323232323232323232",
              port: { name: "https", containerPort: 8443 },
            },
          ],
        },
      ],
      healthyPods: [
        {
          name: "payments-7d4f9",
          labels: { app: "payments" },
          nodeName: "payments-1",
          podIP: "10.32.0.10",
          ready: true,
          containers: [
            {
              name: "payments",
              image:
                "registry.example/payments@sha256:3232323232323232323232323232323232323232323232323232323232323232",
              port: { name: "https", containerPort: 8443 },
            },
          ],
        },
        {
          name: "payments-6c2b8",
          labels: { app: "payments" },
          nodeName: "payments-2",
          podIP: "10.32.0.11",
          ready: true,
          containers: [
            {
              name: "payments",
              image:
                "registry.example/payments@sha256:3232323232323232323232323232323232323232323232323232323232323232",
              port: { name: "https", containerPort: 8443 },
            },
          ],
        },
      ],
    },
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
      "On GKE, a database PVC using the zonal-ssd class bound in zone-a as soon as it was created, but the Pod's required node pool is in zone-b. The scheduler cannot satisfy both constraints, so the Pod remains Pending while the volume and compute capacity each appear healthy. The bound claim and the old StorageClass are immutable migration inputs, not objects to rewrite in place.",
    objective:
      "Create a retained, topology-aware replacement StorageClass for the controlled claim migration; do not mutate the class backing the stuck claim.",
    learningObjectives: [
      "Trace a Pending Pod through PV node affinity and Pod scheduling constraints.",
      "Use WaitForFirstConsumer for topology-aware dynamic provisioning.",
    ],
    file: "storage-class.yaml",
    readonlyFiles: [
      {
        path: "database-statefulset.yaml",
        initialValue: `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: database
  namespace: data
spec:
  serviceName: database
  replicas: 1
  selector:
    matchLabels:
      app: database
  template:
    metadata:
      labels:
        app: database
    spec:
      nodeSelector:
        node-pool: database-zone-b
      containers:
        - name: database
          image: registry.example/database@sha256:abababababababababababababababababababababababababababababababab
          volumeMounts:
            - name: data
              mountPath: /var/lib/database
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        storageClassName: zonal-ssd
        accessModes: [ReadWriteOnce]
        resources:
          requests:
            storage: 100Gi
`,
      },
      {
        path: "bound-claim.yaml",
        initialValue: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data-database-0
  namespace: data
spec:
  storageClassName: zonal-ssd
  volumeName: pv-database-0
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 100Gi
status:
  phase: Bound
`,
      },
      {
        path: "bound-volume.yaml",
        initialValue: `apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-database-0
spec:
  storageClassName: zonal-ssd
  persistentVolumeReclaimPolicy: Retain
  capacity:
    storage: 100Gi
  accessModes: [ReadWriteOnce]
  claimRef:
    namespace: data
    name: data-database-0
  csi:
    driver: pd.csi.storage.gke.io
    volumeHandle: projects/platform-prod/zones/zone-a/disks/database-0
  nodeAffinity:
    required:
      nodeSelectorTerms:
        - matchExpressions:
            - key: topology.kubernetes.io/zone
              operator: In
              values: [zone-a]
status:
  phase: Bound
`,
      },
    ],
    resource: { kind: "StorageClass", name: "zonal-ssd-delayed" },
    initial: `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: zonal-ssd
provisioner: pd.csi.storage.gke.io
parameters:
  type: pd-ssd
volumeBindingMode: Immediate
reclaimPolicy: Retain
allowVolumeExpansion: true
`,
    solution: `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: zonal-ssd-delayed
provisioner: pd.csi.storage.gke.io
parameters:
  type: pd-ssd
volumeBindingMode: WaitForFirstConsumer
reclaimPolicy: Retain
allowVolumeExpansion: true
`,
    assertions: [
      { path: "provisioner", operator: "equals", value: "pd.csi.storage.gke.io" },
      { path: "parameters.type", operator: "equals", value: "pd-ssd" },
      { path: "volumeBindingMode", operator: "equals", value: "WaitForFirstConsumer" },
      { path: "reclaimPolicy", operator: "equals", value: "Retain" },
      { path: "allowVolumeExpansion", operator: "equals", value: true },
    ],
    commands: [
      "kubectl describe pod database-0 -n data",
      "kubectl get persistentvolumeclaim data-database-0 -n data -o yaml",
      "kubectl get persistentvolumes -A",
      "kubectl get node database-b-1 -o yaml",
    ],
    quickCommands: [
      "kubectl get persistentvolumeclaim data-database-0 -n data -o yaml",
      "kubectl get persistentvolumes -A",
      "kubectl get storageclass zonal-ssd -n default -o yaml",
      "kubectl get node database-b-1 -o yaml",
    ],
    eventReason: "FailedScheduling",
    symptom: "scheduler reports a volume node-affinity conflict between zone-a and zone-b",
    finding: "the existing zonal-ssd class binds before the scheduler knows consumer topology",
    fix: "create zonal-ssd-delayed with WaitForFirstConsumer, retain its volumes, and use it for the controlled claim migration",
    prevention:
      "Use delayed binding for topology-constrained storage and validate restore paths in every supported zone.",
    hints: [
      "Inspect both the Pod scheduling event and the bound PV node affinity.",
      "The provisioner chose a location before the scheduler chose a node.",
      "Create zonal-ssd-delayed with WaitForFirstConsumer and Retain, then copy and verify data through a new claim; the old bound claim does not move zones.",
    ],
    cluster: {
      namespace: "data",
      nodes: [
        {
          name: "general-a-1",
          labels: { "topology.kubernetes.io/zone": "zone-a", "node-pool": "general" },
        },
        {
          name: "database-b-1",
          labels: {
            "topology.kubernetes.io/zone": "zone-b",
            "node-pool": "database-zone-b",
          },
        },
      ],
      brokenResources: [
        {
          apiVersion: "apps/v1",
          kind: "StatefulSet",
          metadata: { name: "database", namespace: "data" },
          spec: {
            serviceName: "database",
            replicas: 1,
            selector: { matchLabels: { app: "database" } },
            template: {
              metadata: { labels: { app: "database" } },
              spec: { nodeSelector: { "node-pool": "database-zone-b" } },
            },
          },
        },
        {
          apiVersion: "v1",
          kind: "PersistentVolumeClaim",
          metadata: { name: "data-database-0", namespace: "data" },
          spec: { storageClassName: "zonal-ssd", volumeName: "pv-database-0" },
          status: { phase: "Bound" },
        },
        {
          apiVersion: "v1",
          kind: "PersistentVolume",
          metadata: { name: "pv-database-0" },
          spec: {
            storageClassName: "zonal-ssd",
            nodeAffinity: {
              required: {
                nodeSelectorTerms: [
                  {
                    matchExpressions: [
                      {
                        key: "topology.kubernetes.io/zone",
                        operator: "In",
                        values: ["zone-a"],
                      },
                    ],
                  },
                ],
              },
            },
          },
          status: { phase: "Bound" },
        },
      ],
      healthyResources: [
        {
          apiVersion: "apps/v1",
          kind: "StatefulSet",
          metadata: { name: "database", namespace: "data" },
          spec: {
            serviceName: "database",
            replicas: 1,
            selector: { matchLabels: { app: "database" } },
            template: {
              metadata: { labels: { app: "database" } },
              spec: { nodeSelector: { "node-pool": "database-zone-b" } },
            },
            volumeClaimTemplates: [
              { metadata: { name: "data-v2" }, spec: { storageClassName: "zonal-ssd-delayed" } },
            ],
          },
        },
        {
          apiVersion: "v1",
          kind: "PersistentVolumeClaim",
          metadata: { name: "data-v2-database-0", namespace: "data" },
          spec: { storageClassName: "zonal-ssd-delayed", volumeName: "pv-database-v2-0" },
          status: { phase: "Bound" },
        },
        {
          apiVersion: "v1",
          kind: "PersistentVolume",
          metadata: { name: "pv-database-v2-0" },
          spec: {
            storageClassName: "zonal-ssd-delayed",
            nodeAffinity: {
              required: {
                nodeSelectorTerms: [
                  {
                    matchExpressions: [
                      {
                        key: "topology.kubernetes.io/zone",
                        operator: "In",
                        values: ["zone-b"],
                      },
                    ],
                  },
                ],
              },
            },
          },
          status: { phase: "Bound" },
        },
      ],
      brokenPods: [
        {
          name: "database-0",
          labels: { app: "database" },
          phase: "Pending",
          ready: false,
          containers: [
            {
              name: "database",
              image:
                "registry.example/database@sha256:abababababababababababababababababababababababababababababababab",
              ready: false,
            },
          ],
        },
      ],
      healthyPods: [
        {
          name: "database-0",
          labels: { app: "database" },
          nodeName: "database-b-1",
          podIP: "10.34.0.10",
          ready: true,
          containers: [
            {
              name: "database",
              image:
                "registry.example/database@sha256:abababababababababababababababababababababababababababababababab",
              ready: true,
            },
          ],
        },
      ],
    },
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
      "An automatic StatefulSet update advances as shards recover, denying a saturated storage control plane a deliberate pause.",
    story:
      "After a regional recovery, an ordered search RollingUpdate is still active while stale detach and attach retries saturate the CSI controller. Whenever the current replacement becomes Ready, the controller automatically deletes the next ordinal before operators can hold and verify the recovered shard. The StatefulSet's Parallel podManagementPolicy affects scaling, not rolling-update order, and is immutable; the recovery lever is the mutable update strategy.",
    objective:
      "Pause automatic StatefulSet replacement and hand control to the recovery runbook so operators advance one verified shard at a time.",
    learningObjectives: [
      "Relate StatefulSet update strategy to storage control-plane pressure.",
      "Distinguish pod management policy for scaling from update strategy for replacement.",
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
      { path: "spec.serviceName", operator: "equals", value: "search" },
      { path: "spec.replicas", operator: "equals", value: 12 },
      { path: "spec.podManagementPolicy", operator: "equals", value: "Parallel" },
      { path: "spec.updateStrategy.type", operator: "equals", value: "OnDelete" },
      { path: "spec.selector.matchLabels.app", operator: "equals", value: "search" },
      { path: "spec.template.metadata.labels.app", operator: "equals", value: "search" },
      { path: "spec.template.spec.containers", operator: "length-equals", value: 1 },
      {
        path: "spec.template.spec.containers[name=search].image",
        operator: "equals",
        value:
          "registry.example/search@sha256:19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd",
      },
    ],
    commands: [
      "kubectl get pods -n search -o wide",
      "kubectl get volumeattachments -A",
      "kubectl get events -n search --sort-by=.lastTimestamp",
      "kubectl get statefulset search -n search -o yaml",
    ],
    quickCommands: [
      "kubectl get volumeattachments -A",
      "kubectl get statefulset search -n search -o yaml",
    ],
    eventReason: "FailedAttachVolume",
    symptom: "the next search shard is stuck in repeated attach retries while stale requests drain",
    finding:
      "the automatic RollingUpdate advances to each next ordinal as recovery succeeds, leaving no operator-controlled pause between volume transitions",
    fix: "switch the mutable update strategy to OnDelete and advance shards through the runbook",
    prevention:
      "Set recovery concurrency from measured CSI limits and rehearse regional restart procedures.",
    hints: [
      "Compare the one not-Ready ordinal with failed and stale VolumeAttachment objects.",
      "Parallel podManagementPolicy controls scaling and is immutable. RollingUpdate still advances automatically, one Ready ordinal at a time.",
      "Temporarily use updateStrategy: OnDelete; after the current attach settles, delete only the next shard authorized by the recovery runbook.",
    ],
    cluster: {
      nodes: [
        { name: "search-a-1", labels: { "topology.kubernetes.io/zone": "zone-a" } },
        { name: "search-b-1", labels: { "topology.kubernetes.io/zone": "zone-b" } },
        { name: "search-c-1", labels: { "topology.kubernetes.io/zone": "zone-c" } },
      ],
      brokenResources: Array.from({ length: 4 }, (_unused, offset): FixtureResource => {
        const ordinal = 8 + offset;
        return {
          apiVersion: "storage.k8s.io/v1",
          kind: "VolumeAttachment",
          metadata: { name: `csi-search-${ordinal}` },
          spec: {
            attacher: "pd.csi.storage.gke.io",
            nodeName: `search-${["a", "b", "c"][ordinal % 3]}-1`,
            source: { persistentVolumeName: `pv-search-${ordinal}` },
          },
          status: {
            attached: false,
            attachError: { message: "DeadlineExceeded while waiting for a stale detach" },
          },
        };
      }),
      healthyResources: Array.from({ length: 12 }, (_unused, ordinal): FixtureResource => ({
        apiVersion: "storage.k8s.io/v1",
        kind: "VolumeAttachment",
        metadata: { name: `csi-search-${ordinal}` },
        spec: {
          attacher: "pd.csi.storage.gke.io",
          nodeName: `search-${["a", "b", "c"][ordinal % 3]}-1`,
          source: { persistentVolumeName: `pv-search-${ordinal}` },
        },
        status: { attached: true },
      })),
      brokenPods: Array.from({ length: 12 }, (_unused, ordinal): FixturePod => {
        const waiting = ordinal === 11;
        return {
          name: `search-${ordinal}`,
          labels: {
            app: "search",
            "controller-revision-hash": waiting ? "search-new" : "search-old",
          },
          nodeName: `search-${["a", "b", "c"][ordinal % 3]}-1`,
          ...(waiting ? {} : { podIP: `10.35.${ordinal}.10` }),
          phase: waiting ? "Pending" : "Running",
          ready: !waiting,
          containers: [
            {
              name: "search",
              image:
                "registry.example/search@sha256:19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd",
              ready: !waiting,
              ...(waiting ? { waitingReason: "ContainerCreating" } : {}),
            },
          ],
        };
      }),
      healthyPods: Array.from({ length: 12 }, (_unused, ordinal): FixturePod => ({
        name: `search-${ordinal}`,
        labels: { app: "search", "controller-revision-hash": "search-new" },
        nodeName: `search-${["a", "b", "c"][ordinal % 3]}-1`,
        podIP: `10.35.${ordinal}.20`,
        ready: true,
        containers: [
          {
            name: "search",
            image:
              "registry.example/search@sha256:19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd19bd",
            ready: true,
          },
        ],
      })),
      brokenEvents: [
        {
          reason: "FailedAttachVolume",
          type: "Warning",
          message: "AttachVolume.Attach failed for search-11: DeadlineExceeded",
          involvedObject: { kind: "Pod", name: "search-11" },
        },
      ],
    },
    docsHref:
      "https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/#update-strategies",
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
    assertions: [{ path: "rules", operator: "length-equals", value: 2 }],
    semanticPolicy: {
      rbacContracts: [
        {
          appliesTo: "Role",
          violation: "grants authority outside the database reconciliation contract",
          exactRuleCount: 2,
          allowedRules: [
            {
              apiGroups: ["database.example.com"],
              resources: ["databases"],
              verbs: ["get", "list", "watch", "update", "patch"],
              resourceNames: [],
            },
            {
              apiGroups: ["database.example.com"],
              resources: ["databases/status"],
              verbs: ["get", "update", "patch"],
              resourceNames: [],
            },
          ],
        },
      ],
    },
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
    eventReason: "ReconcileError",
    cluster: {
      brokenPods: [
        {
          name: "database-operator-7d4f9",
          labels: { app: "database-operator" },
          nodeName: "worker-1",
          podIP: "10.37.0.10",
          phase: "Running",
          ready: true,
          containers: [
            {
              name: "manager",
              image: "registry.example/database-operator:2.8.0",
              ready: true,
            },
          ],
          logs: [
            {
              message:
                "reconcile logs contain Forbidden errors only for status updates: databases/status is forbidden",
            },
          ],
        },
      ],
      healthyPods: [
        {
          name: "database-operator-7d4f9",
          labels: { app: "database-operator" },
          nodeName: "worker-1",
          podIP: "10.37.0.10",
          phase: "Running",
          ready: true,
          containers: [
            {
              name: "manager",
              image: "registry.example/database-operator:2.8.0",
              ready: true,
            },
          ],
          logs: [{ message: "database status updated successfully" }],
        },
      ],
    },
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
      {
        path: "webhooks[name=policy.platform.example.com].failurePolicy",
        operator: "equals",
        value: "Ignore",
      },
      {
        path: "webhooks[name=policy.platform.example.com].timeoutSeconds",
        operator: "lte",
        value: 3,
      },
      {
        path: "webhooks[name=policy.platform.example.com].timeoutSeconds",
        operator: "gte",
        value: 1,
      },
      {
        path: "webhooks[name=policy.platform.example.com].namespaceSelector.matchExpressions[key=kubernetes.io/metadata.name].key",
        operator: "equals",
        value: "kubernetes.io/metadata.name",
      },
      {
        path: "webhooks[name=policy.platform.example.com].namespaceSelector.matchExpressions[key=kubernetes.io/metadata.name].operator",
        operator: "equals",
        value: "NotIn",
      },
      {
        path: "webhooks[name=policy.platform.example.com].namespaceSelector.matchExpressions[key=kubernetes.io/metadata.name].values.0",
        operator: "equals",
        value: "policy-system",
      },
      {
        path: "webhooks[name=policy.platform.example.com].admissionReviewVersions.0",
        operator: "equals",
        value: "v1",
      },
      {
        path: "webhooks[name=policy.platform.example.com].sideEffects",
        operator: "equals",
        value: "None",
      },
      {
        path: "webhooks[name=policy.platform.example.com].rules.0.apiGroups",
        operator: "array-contains",
        value: "",
      },
      {
        path: "webhooks[name=policy.platform.example.com].rules.0.apiVersions",
        operator: "array-contains",
        value: "v1",
      },
      {
        path: "webhooks[name=policy.platform.example.com].rules.0.operations",
        operator: "array-contains",
        value: "CREATE",
      },
      {
        path: "webhooks[name=policy.platform.example.com].rules.0.resources",
        operator: "array-contains",
        value: "pods",
      },
      {
        path: "webhooks[name=policy.platform.example.com].clientConfig.service.namespace",
        operator: "equals",
        value: "policy-system",
      },
      {
        path: "webhooks[name=policy.platform.example.com].clientConfig.service.name",
        operator: "equals",
        value: "workload-policy",
      },
      {
        path: "webhooks[name=policy.platform.example.com].clientConfig.service.path",
        operator: "equals",
        value: "/validate",
      },
      {
        path: "webhooks[name=policy.platform.example.com].namespaceSelector.matchExpressions[key=kubernetes.io/metadata.name].values.1",
        operator: "absent",
      },
      { path: "webhooks.1", operator: "absent" },
    ],
    commands: [
      "kubectl get validatingwebhookconfiguration workload-policy -o yaml",
      "kubectl get endpointslice -n policy-system -l kubernetes.io/service-name=workload-policy",
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
    eventReason: "FailedCallingWebhook",
    quickCommands: [
      "kubectl get service workload-policy -n policy-system -o yaml",
      "kubectl get endpointslice -n policy-system -l kubernetes.io/service-name=workload-policy",
    ],
    cluster: {
      nodes: [{ name: "policy-node-1" }, { name: "policy-node-2" }],
      services: [
        {
          name: "workload-policy",
          namespace: "policy-system",
          clusterIP: "10.96.38.10",
          selector: { app: "workload-policy" },
          ports: [{ name: "https", port: 443, targetPort: 9443 }],
        },
      ],
      brokenPods: [
        {
          name: "workload-policy-7d4f9",
          namespace: "policy-system",
          labels: { app: "workload-policy" },
          phase: "Pending",
          ready: false,
          containers: [
            {
              name: "webhook",
              image: "registry.example/workload-policy:1.4.0",
              port: { name: "https", containerPort: 9443 },
              ready: false,
              waitingReason: "AdmissionWebhookBlocked",
            },
          ],
          logs: [],
        },
      ],
      healthyPods: [
        {
          name: "workload-policy-7d4f9",
          namespace: "policy-system",
          labels: { app: "workload-policy" },
          nodeName: "policy-node-1",
          podIP: "10.38.0.10",
          phase: "Running",
          ready: true,
          containers: [
            {
              name: "webhook",
              image: "registry.example/workload-policy:1.4.0",
              port: { name: "https", containerPort: 9443 },
              ready: true,
            },
          ],
          logs: [{ message: "admission webhook serving normally" }],
        },
      ],
    },
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
      { path: "spec.replicas", operator: "equals", value: 3 },
      { path: "spec.selector.matchLabels.app", operator: "equals", value: "recommendation" },
      {
        path: "spec.template.metadata.labels.app",
        operator: "equals",
        value: "recommendation",
      },
      {
        path: "spec.template.spec.containers[name=api].image",
        operator: "equals",
        value:
          "registry.example/recommendation@sha256:21ab21ab21ab21ab21ab21ab21ab21ab21ab21ab21ab21ab21ab21ab21ab21ab",
      },
      {
        path: "spec.template.spec.containers[name=api].resources.requests.cpu",
        operator: "equals",
        value: "200m",
      },
      {
        path: "spec.template.spec.containers[name=api].resources.requests.memory",
        operator: "equals",
        value: "256Mi",
      },
      { path: "spec.template.spec.containers[name=api].resources.limits.cpu", operator: "absent" },
      {
        path: "spec.template.spec.containers[name=api].resources.limits.memory",
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
      `The service, resource values, traffic pattern, and acceptance rule are fictional ${BRAND.name} material.`,
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
        path: "spec.selector.matchLabels.app",
        operator: "equals",
        value: "log-collector",
      },
      {
        path: "spec.template.metadata.labels.app",
        operator: "equals",
        value: "log-collector",
      },
      {
        path: "spec.template.spec.containers[name=collector].image",
        operator: "equals",
        value:
          "registry.example/log-collector@sha256:0f140f140f140f140f140f140f140f140f140f140f140f140f140f140f140f14",
      },
      {
        path: "spec.template.spec.containers[name=collector].resources.limits.memory",
        operator: "equals",
        value: "768Mi",
      },
      {
        path: "spec.template.spec.containers[name=collector].resources.requests.cpu",
        operator: "equals",
        value: "100m",
      },
      {
        path: "spec.template.spec.containers[name=collector].resources.requests.memory",
        operator: "equals",
        value: "256Mi",
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
    eventReason: "SystemOOM",
    cluster: {
      nodes: [{ name: "worker-2" }, { name: "worker-3" }],
      brokenNodeNames: ["worker-2", "worker-3"],
      healthyNodeNames: ["worker-2", "worker-3"],
      additionalBrokenPods: [
        {
          name: "checkout-api-evicted",
          labels: { app: "checkout-api" },
          nodeName: "worker-3",
          phase: "Failed",
          ready: false,
          containers: [
            {
              name: "api",
              image: "registry.example/checkout-api:8.2.0",
              ready: false,
              waitingReason: "Evicted",
            },
          ],
          logs: [],
        },
      ],
      additionalHealthyPods: [
        {
          name: "checkout-api-7d4f9",
          labels: { app: "checkout-api" },
          nodeName: "worker-3",
          podIP: "10.41.0.30",
          phase: "Running",
          ready: true,
          containers: [{ name: "api", image: "registry.example/checkout-api:8.2.0", ready: true }],
          logs: [{ message: "checkout API serving normally" }],
        },
      ],
      brokenEvents: [
        {
          reason: "Evicted",
          type: "Warning",
          message: "checkout-api-evicted was removed after the node encountered SystemOOM",
          involvedObject: { kind: "Pod", name: "checkout-api-evicted" },
        },
      ],
    },
    docsHref: "https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/",
    incidentSource: incident(
      "Blue Matador Kubernetes node OOM postmortem",
      "https://www.bluematador.com/blog/post-mortem-kubernetes-node-oom",
      `The collector, memory quantities, node identity, and repair workflow are fictionalized for ${BRAND.name}.`,
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
      { path: "spec.replicas", operator: "equals", value: 4 },
      { path: "spec.selector.matchLabels.app", operator: "equals", value: "queue-worker" },
      {
        path: "spec.template.metadata.labels.app",
        operator: "equals",
        value: "queue-worker",
      },
      {
        path: "spec.template.spec.containers[name=worker].image",
        operator: "equals",
        value:
          "registry.example/worker@sha256:900d900d900d900d900d900d900d900d900d900d900d900d900d900d900d900d",
      },
      {
        path: "spec.template.spec.containers[name=worker].resources.requests.cpu",
        operator: "equals",
        value: "200m",
      },
      {
        path: "spec.template.spec.containers[name=worker].resources.requests.memory",
        operator: "equals",
        value: "256Mi",
      },
      {
        path: "spec.template.spec.containers[name=worker].resources.requests.ephemeral-storage",
        operator: "equals",
        value: "512Mi",
      },
      {
        path: "spec.template.spec.containers[name=worker].resources.limits.ephemeral-storage",
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
    eventReason: "Evicted",
    cluster: {
      nodes: [{ name: "worker-4" }, { name: "worker-5" }],
      brokenNodeNames: ["worker-4", "worker-5", "worker-4", "worker-5"],
      healthyNodeNames: ["worker-4", "worker-5", "worker-4", "worker-5"],
      additionalBrokenPods: [
        {
          name: "payments-api-evicted",
          labels: { app: "payments-api" },
          nodeName: "worker-5",
          phase: "Failed",
          ready: false,
          containers: [
            {
              name: "api",
              image: "registry.example/payments-api:4.9.0",
              ready: false,
              waitingReason: "Evicted",
            },
          ],
          logs: [],
        },
      ],
      additionalHealthyPods: [
        {
          name: "payments-api-7d4f9",
          labels: { app: "payments-api" },
          nodeName: "worker-5",
          podIP: "10.42.0.40",
          phase: "Running",
          ready: true,
          containers: [{ name: "api", image: "registry.example/payments-api:4.9.0", ready: true }],
          logs: [{ message: "payments API serving normally" }],
        },
      ],
      brokenEvents: [
        {
          reason: "NodeHasDiskPressure",
          type: "Warning",
          message: "worker-5 has DiskPressure from container log storage consumption",
          involvedObject: { kind: "Node", name: "worker-5" },
        },
      ],
    },
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
      { path: "spec.replicas", operator: "equals", value: 2 },
      { path: "spec.selector.matchLabels.app", operator: "equals", value: "catalog-api" },
      {
        path: "spec.template.metadata.labels.app",
        operator: "equals",
        value: "catalog-api",
      },
      {
        path: "spec.template.spec.containers[name=api].image",
        operator: "equals",
        value:
          "registry.example/catalog@sha256:39ca39ca39ca39ca39ca39ca39ca39ca39ca39ca39ca39ca39ca39ca39ca39ca",
      },
      {
        path: "spec.template.spec.containers[name=api].resources.requests.cpu",
        operator: "equals",
        value: "250m",
      },
      {
        path: "spec.template.spec.containers[name=api].resources.requests.memory",
        operator: "equals",
        value: "256Mi",
      },
      {
        path: "spec.template.spec.containers[name=api].resources.limits.cpu",
        operator: "equals",
        value: "1",
      },
      {
        path: "spec.template.spec.containers[name=api].resources.limits.memory",
        operator: "equals",
        value: "512Mi",
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
    eventReason: "FailedGetResourceMetric",
    quickCommands: [
      "kubectl get hpa catalog-api -n store -o yaml",
      "kubectl describe hpa catalog-api -n store",
    ],
    cluster: {
      brokenResources: [
        {
          apiVersion: "autoscaling/v2",
          kind: "HorizontalPodAutoscaler",
          metadata: { name: "catalog-api", namespace: "store" },
          spec: {
            minReplicas: 2,
            maxReplicas: 20,
            scaleTargetRef: { apiVersion: "apps/v1", kind: "Deployment", name: "catalog-api" },
            metrics: [
              {
                type: "Resource",
                resource: {
                  name: "cpu",
                  target: { type: "Utilization", averageUtilization: 70 },
                },
              },
            ],
          },
          status: {
            currentReplicas: 2,
            desiredReplicas: 2,
            conditions: [
              {
                type: "ScalingActive",
                status: "False",
                reason: "FailedGetResourceMetric",
                message: "missing request for cpu in container api",
              },
            ],
          },
        },
      ],
      healthyResources: [
        {
          apiVersion: "autoscaling/v2",
          kind: "HorizontalPodAutoscaler",
          metadata: { name: "catalog-api", namespace: "store" },
          spec: {
            minReplicas: 2,
            maxReplicas: 20,
            scaleTargetRef: { apiVersion: "apps/v1", kind: "Deployment", name: "catalog-api" },
            metrics: [
              {
                type: "Resource",
                resource: {
                  name: "cpu",
                  target: { type: "Utilization", averageUtilization: 70 },
                },
              },
            ],
          },
          status: {
            currentReplicas: 2,
            desiredReplicas: 4,
            conditions: [
              {
                type: "ScalingActive",
                status: "True",
                reason: "ValidMetricFound",
                message: "the HPA successfully calculated a replica count from CPU utilization",
              },
            ],
          },
        },
      ],
    },
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
      { path: "spec.minReplicas", operator: "equals", value: 3 },
      { path: "spec.maxReplicas", operator: "equals", value: 30 },
      { path: "spec.scaleTargetRef.apiVersion", operator: "equals", value: "apps/v1" },
      { path: "spec.scaleTargetRef.kind", operator: "equals", value: "Deployment" },
      { path: "spec.scaleTargetRef.name", operator: "equals", value: "orders-api" },
      { path: "spec.metrics", operator: "length-equals", value: 1 },
      {
        path: "spec.metrics[type=ContainerResource].type",
        operator: "equals",
        value: "ContainerResource",
      },
      {
        path: "spec.metrics[type=ContainerResource].containerResource.name",
        operator: "equals",
        value: "cpu",
      },
      {
        path: "spec.metrics[type=ContainerResource].containerResource.container",
        operator: "equals",
        value: "api",
      },
      {
        path: "spec.metrics[type=ContainerResource].containerResource.target.type",
        operator: "equals",
        value: "Utilization",
      },
      {
        path: "spec.metrics[type=ContainerResource].containerResource.target.averageUtilization",
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
    eventReason: "ScalingSignalSkew",
    quickCommands: ["kubectl get deployment orders-api -n orders -o yaml"],
    cluster: {
      resources: [
        {
          apiVersion: "apps/v1",
          kind: "Deployment",
          metadata: { name: "orders-api", namespace: "orders" },
          spec: {
            replicas: 3,
            selector: { matchLabels: { app: "orders-api" } },
            template: {
              metadata: { labels: { app: "orders-api" } },
              spec: {
                containers: [
                  {
                    name: "api",
                    image: "registry.example/orders-api:7.2.0",
                    resources: { requests: { cpu: "300m" } },
                  },
                  {
                    name: "metrics",
                    image: "registry.example/metrics-exporter:2.1.0",
                    resources: { requests: { cpu: "100m" } },
                  },
                ],
              },
            },
          },
        },
      ],
      nodes: [{ name: "orders-node-1" }, { name: "orders-node-2" }],
      brokenPods: [
        {
          name: "orders-api-7d4f9",
          labels: { app: "orders-api" },
          nodeName: "orders-node-1",
          podIP: "10.44.0.10",
          phase: "Running",
          ready: true,
          containers: [
            { name: "api", image: "registry.example/orders-api:7.2.0", ready: true },
            { name: "metrics", image: "registry.example/metrics-exporter:2.1.0", ready: true },
          ],
        },
        {
          name: "orders-api-6c2b8",
          labels: { app: "orders-api" },
          nodeName: "orders-node-2",
          podIP: "10.44.0.11",
          phase: "Running",
          ready: true,
          containers: [
            { name: "api", image: "registry.example/orders-api:7.2.0", ready: true },
            { name: "metrics", image: "registry.example/metrics-exporter:2.1.0", ready: true },
          ],
        },
      ],
      healthyPods: [
        {
          name: "orders-api-7d4f9",
          labels: { app: "orders-api" },
          nodeName: "orders-node-1",
          podIP: "10.44.0.10",
          phase: "Running",
          ready: true,
          containers: [
            { name: "api", image: "registry.example/orders-api:7.2.0", ready: true },
            { name: "metrics", image: "registry.example/metrics-exporter:2.1.0", ready: true },
          ],
        },
        {
          name: "orders-api-6c2b8",
          labels: { app: "orders-api" },
          nodeName: "orders-node-2",
          podIP: "10.44.0.11",
          phase: "Running",
          ready: true,
          containers: [
            { name: "api", image: "registry.example/orders-api:7.2.0", ready: true },
            { name: "metrics", image: "registry.example/metrics-exporter:2.1.0", ready: true },
          ],
        },
      ],
    },
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
      { path: "spec.selector", operator: "length-equals", value: 1 },
      { path: "spec.selector.track", operator: "absent" },
      { path: "spec.ports", operator: "length-equals", value: 1 },
      { path: "spec.ports[name=http].port", operator: "equals", value: 80 },
      {
        path: "spec.ports[name=http].targetPort",
        operator: "matches",
        value: "^(8080|http)$",
      },
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
    eventReason: "EndpointSkew",
    cluster: {
      nodes: [
        { name: "payments-node-1" },
        { name: "payments-node-2" },
        { name: "payments-node-3" },
      ],
      resources: [
        {
          apiVersion: "apps/v1",
          kind: "Deployment",
          metadata: { name: "checkout", namespace: "payments" },
          spec: {
            replicas: 10,
            selector: { matchLabels: { app: "checkout" } },
            template: {
              metadata: { labels: { app: "checkout" } },
              spec: {
                containers: [
                  {
                    name: "checkout",
                    image: "registry.example/checkout:8.0.0",
                    ports: [{ name: "http", containerPort: 8080 }],
                  },
                ],
              },
            },
          },
        },
      ],
      brokenPods: [
        ...Array.from({ length: 9 }, (_unused, index) => checkoutTrafficPod(index, "stable")),
        checkoutTrafficPod(9, "canary"),
      ],
      healthyPods: [
        ...Array.from({ length: 9 }, (_unused, index) => checkoutTrafficPod(index, "stable")),
        checkoutTrafficPod(9, "canary"),
      ],
    },
    docsHref: "https://kubernetes.io/docs/concepts/services-networking/service/",
    incidentSource: incident(
      "Grafana Cloud label selector outage",
      "https://grafana.com/blog/how-adding-kubernetes-label-selectors-caused-an-outage-in-grafana-cloud-logs-and-how-we-resolved-it/",
      `The checkout service, ten-percent distribution, labels, and exact repair are fictionalized for ${BRAND.name}.`,
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
      { path: "spec.selector.matchLabels.app", operator: "equals", value: "ledger-api" },
    ],
    goals: [
      {
        goal: "disruption-budget-window",
        replicas: 3,
        minimumAvailable: 2,
        minimumDisruptions: 1,
      },
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
    eventReason: "EvictionBlocked",
    cluster: {
      nodes: [{ name: "ledger-node-1" }, { name: "ledger-node-2" }, { name: "ledger-node-3" }],
      resources: [
        {
          apiVersion: "apps/v1",
          kind: "Deployment",
          metadata: { name: "ledger-api", namespace: "payments" },
          spec: {
            replicas: 3,
            selector: { matchLabels: { app: "ledger-api" } },
            template: {
              metadata: { labels: { app: "ledger-api" } },
              spec: {
                containers: [{ name: "api", image: "registry.example/ledger-api:5.4.0" }],
              },
            },
          },
        },
      ],
      brokenPods: [ledgerPod(0), ledgerPod(1), ledgerPod(2)],
      healthyPods: [ledgerPod(0), ledgerPod(1), ledgerPod(2)],
    },
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
      { path: "spec.replicas", operator: "equals", value: 4 },
      { path: "spec.selector.matchLabels.app", operator: "equals", value: "pricing-api" },
      {
        path: "spec.template.metadata.labels.app",
        operator: "equals",
        value: "pricing-api",
      },
      {
        path: "spec.template.spec.containers[name=api].image",
        operator: "equals",
        value: "registry.example/pricing:v4",
      },
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
    eventReason: "BackOff",
    cluster: {
      nodes: [{ name: "store-node-1" }, { name: "store-node-2" }],
      brokenResources: [
        {
          apiVersion: "apps/v1",
          kind: "ReplicaSet",
          metadata: { name: "pricing-api-v3", namespace: "store" },
          spec: { replicas: 0, selector: { matchLabels: { app: "pricing-api", version: "v3" } } },
        },
        {
          apiVersion: "apps/v1",
          kind: "ReplicaSet",
          metadata: { name: "pricing-api-v4", namespace: "store" },
          spec: { replicas: 4, selector: { matchLabels: { app: "pricing-api", version: "v4" } } },
        },
      ],
      healthyResources: [
        {
          apiVersion: "apps/v1",
          kind: "ReplicaSet",
          metadata: { name: "pricing-api-v3", namespace: "store" },
          spec: { replicas: 3, selector: { matchLabels: { app: "pricing-api", version: "v3" } } },
        },
        {
          apiVersion: "apps/v1",
          kind: "ReplicaSet",
          metadata: { name: "pricing-api-v4", namespace: "store" },
          spec: { replicas: 1, selector: { matchLabels: { app: "pricing-api", version: "v4" } } },
        },
      ],
      brokenPods: [
        pricingPod(0, "v4", true),
        pricingPod(1, "v4", true),
        pricingPod(2, "v4", true),
        pricingPod(3, "v4", true),
      ],
      healthyPods: [
        pricingPod(0, "v3", false),
        pricingPod(1, "v3", false),
        pricingPod(2, "v3", false),
        pricingPod(0, "v4", true),
      ],
    },
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
    capabilities: ["configmaps", "events", "workload-controllers"],
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
  deletionTimestamp: "2026-08-14T03:25:00Z"
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
      {
        path: "metadata.finalizers",
        operator: "array-not-contains",
        value: "previews.platform.example.com/cleanup",
      },
      { path: "spec.pullRequest", operator: "equals", value: 184 },
    ],
    commands: [
      "kubectl get preview checkout-pr-184 -n previews -o yaml",
      "kubectl get events -n previews --sort-by=.lastTimestamp",
      "kubectl get deployment -n platform-system",
      "kubectl api-resources | findstr Preview",
    ],
    quickCommands: ["kubectl get configmap checkout-pr-184-cleanup-audit -n previews -o yaml"],
    symptom: "the Preview has a deletion timestamp but never disappears",
    finding: "an orphaned operator finalizer remains after external cleanup completed",
    fix: "remove the previews.platform.example.com/cleanup finalizer",
    prevention:
      "Ship controller retirement runbooks that drain finalizers before removing an operator.",
    hints: [
      "Inspect metadata.deletionTimestamp and metadata.finalizers.",
      "Read checkout-pr-184-cleanup-audit and confirm the external resource count is zero before bypassing cleanup logic.",
      "Remove the orphaned finalizers field without changing the Preview specification.",
    ],
    eventReason: "FinalizerBlocked",
    cluster: {
      omitHealthyTargetResource: true,
      resources: [
        {
          apiVersion: "v1",
          kind: "ConfigMap",
          metadata: { name: "checkout-pr-184-cleanup-audit", namespace: "previews" },
          data: {
            preview: "checkout-pr-184",
            externalResourcesRemaining: "0",
            verification: "complete",
          },
        },
      ],
    },
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
    capabilities: ["services", "events", "workload-controllers"],
    blurb: "An unreachable conversion service makes reads of every stored custom resource fail.",
    story:
      "Two Widget API versions use an identical schema, but the CRD still calls an external conversion webhook. The converter Service has no Ready endpoints after an operator upgrade, so list and get requests fail even though no conversion logic is actually needed.",
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
      { path: "spec.group", operator: "equals", value: "platform.example.com" },
      { path: "spec.scope", operator: "equals", value: "Namespaced" },
      { path: "spec.names.plural", operator: "equals", value: "widgets" },
      { path: "spec.names.singular", operator: "equals", value: "widget" },
      { path: "spec.names.kind", operator: "equals", value: "Widget" },
      { path: "spec.conversion.strategy", operator: "equals", value: "None" },
      { path: "spec.conversion.webhook", operator: "absent" },
      { path: "spec.versions", operator: "length-equals", value: 2 },
      { path: "spec.versions[name=v1alpha1].name", operator: "equals", value: "v1alpha1" },
      { path: "spec.versions[name=v1alpha1].served", operator: "equals", value: true },
      { path: "spec.versions[name=v1alpha1].storage", operator: "equals", value: false },
      {
        path: "spec.versions[name=v1alpha1].schema.openAPIV3Schema.type",
        operator: "equals",
        value: "object",
      },
      {
        path: "spec.versions[name=v1alpha1].schema.openAPIV3Schema",
        operator: "length-equals",
        value: 1,
      },
      { path: "spec.versions[name=v1].name", operator: "equals", value: "v1" },
      { path: "spec.versions[name=v1].served", operator: "equals", value: true },
      { path: "spec.versions[name=v1].storage", operator: "equals", value: true },
      {
        path: "spec.versions[name=v1].schema.openAPIV3Schema.type",
        operator: "equals",
        value: "object",
      },
      {
        path: "spec.versions[name=v1].schema.openAPIV3Schema",
        operator: "length-equals",
        value: 1,
      },
    ],
    commands: [
      "kubectl get crd widgets.platform.example.com -o yaml",
      "kubectl get widgets -A",
      "kubectl get service missing-converter -n platform-system",
      "kubectl get events -A --sort-by=.lastTimestamp",
    ],
    quickCommands: [
      "kubectl describe service missing-converter -n platform-system",
      "kubectl get endpointslices -n platform-system -l kubernetes.io/service-name=missing-converter",
    ],
    symptom: "all Widget reads fail on a missing conversion webhook endpoint",
    finding: "the equivalent versions use Webhook conversion unnecessarily",
    fix: "set conversion.strategy to None and remove webhook configuration",
    prevention:
      "Treat conversion services as control-plane dependencies and exercise outage behavior before API upgrades.",
    hints: [
      "Read the API error, then inspect missing-converter and confirm that it has no Ready endpoints.",
      "Confirm the served and stored schemas do not require semantic conversion.",
      "Set spec.conversion.strategy to None and remove spec.conversion.webhook.",
    ],
    eventReason: "ConversionWebhookCallFailed",
    cluster: {
      services: [
        {
          name: "missing-converter",
          namespace: "platform-system",
          clusterIP: "10.96.0.150",
          selector: { app: "widget-converter" },
          ports: [{ name: "https", port: 443, targetPort: 9443 }],
        },
      ],
    },
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
      { path: "spec.replicas", operator: "equals", value: 1 },
      { path: "spec.selector.matchLabels.app", operator: "equals", value: "invoice-operator" },
      {
        path: "spec.template.metadata.labels.app",
        operator: "equals",
        value: "invoice-operator",
      },
      {
        path: "spec.template.spec.containers[name=manager].image",
        operator: "equals",
        value:
          "registry.example/invoice-operator@sha256:8c738c738c738c738c738c738c738c738c738c738c738c738c738c738c738c73",
      },
      {
        path: "spec.template.spec.containers[name=manager].env[name=WATCH_NAMESPACE].name",
        operator: "equals",
        value: "WATCH_NAMESPACE",
      },
      {
        path: "spec.template.spec.containers[name=manager].env[name=WATCH_NAMESPACE].value",
        operator: "equals",
        value: "billing",
      },
      {
        path: "spec.template.spec.containers[name=manager].resources.limits.memory",
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
    eventReason: "BackOff",
    cluster: {
      brokenPhase: "Running",
      brokenWaitingReason: "CrashLoopBackOff",
      brokenLastTerminationReason: "OOMKilled",
      brokenRestarts: 7,
      brokenLogs: ["informer cache exceeded 512Mi while relisting resources across all namespaces"],
    },
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
    capabilities: ["services", "pods", "logs", "events"],
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
      { path: "spec.selector.matchLabels.app", operator: "equals", value: "payments-api" },
      { path: "spec.endpoints", operator: "length-equals", value: 1 },
      { path: "spec.endpoints[port=metrics].port", operator: "equals", value: "metrics" },
      { path: "spec.endpoints[port=metrics].interval", operator: "equals", value: "15s" },
      {
        path: "spec.endpoints[port=metrics].metricRelabelings",
        operator: "length-equals",
        value: 1,
      },
      {
        path: "spec.endpoints[port=metrics].metricRelabelings[action=labeldrop].action",
        operator: "equals",
        value: "labeldrop",
      },
      {
        path: "spec.endpoints[port=metrics].metricRelabelings[action=labeldrop].regex",
        operator: "equals",
        value: "user_id",
      },
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
    eventReason: "BackOff",
    podSelector: { "app.kubernetes.io/name": "prometheus" },
    logPodMatches: "^prometheus-",
    quickCommands: [
      "kubectl get service prometheus -n observability -o yaml",
      "kubectl get pod prometheus-main-0 -n observability -o wide",
    ],
    cluster: {
      nodes: [{ name: "observability-node-1" }, { name: "observability-node-2" }],
      services: [
        {
          name: "prometheus",
          namespace: "observability",
          clusterIP: "10.96.53.10",
          selector: { "app.kubernetes.io/name": "prometheus" },
          ports: [{ name: "web", port: 9090, targetPort: 9090 }],
        },
      ],
      brokenPods: [
        {
          name: "prometheus-main-0",
          namespace: "observability",
          labels: { "app.kubernetes.io/name": "prometheus" },
          nodeName: "observability-node-1",
          podIP: "10.53.0.10",
          phase: "Running",
          ready: false,
          containers: [
            {
              name: "prometheus",
              image: "quay.io/prometheus/prometheus:v3.5.0",
              port: { name: "web", containerPort: 9090 },
              ready: false,
              restartCount: 5,
              waitingReason: "CrashLoopBackOff",
              lastTerminationReason: "OOMKilled",
            },
          ],
          logs: [
            {
              message:
                "active series and memory grow in proportion to unique users; head series exceeded the safe budget",
            },
          ],
        },
      ],
      healthyPods: [
        {
          name: "prometheus-main-0",
          namespace: "observability",
          labels: { "app.kubernetes.io/name": "prometheus" },
          nodeName: "observability-node-1",
          podIP: "10.53.0.10",
          phase: "Running",
          ready: true,
          containers: [
            {
              name: "prometheus",
              image: "quay.io/prometheus/prometheus:v3.5.0",
              port: { name: "web", containerPort: 9090 },
              ready: true,
            },
          ],
          logs: [{ message: "series cardinality is within the monitoring budget" }],
        },
      ],
    },
    docsHref:
      "https://prometheus.io/docs/prometheus/latest/configuration/configuration/#metric_relabel_configs",
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
        path: "/metadata/labels/recovery.klab.dev~1mode",
        operator: "equals",
        value: "out-of-band-static-pod",
      },
      { path: "spec.containers", operator: "length-equals", value: 1 },
      { path: "spec.containers[name=etcdctl].command", operator: "length-equals", value: 3 },
      {
        path: "spec.containers[name=etcdctl].command.2",
        operator: "matches",
        value: "endpoint status[\\s\\S]*compact[\\s\\S]*defrag --cluster[\\s\\S]*alarm disarm",
      },
      {
        path: "spec.containers[name=etcdctl].command.2",
        operator: "not-matches",
        value: "alarm disarm[\\s\\S]*(endpoint status|compact|defrag)",
      },
      { path: "spec.restartPolicy", operator: "equals", value: "Never" },
      { path: "spec.hostNetwork", operator: "equals", value: true },
      {
        path: "spec.containers[name=etcdctl].env[name=ETCDCTL_API].name",
        operator: "equals",
        value: "ETCDCTL_API",
      },
      {
        path: "spec.containers[name=etcdctl].env[name=ETCDCTL_ENDPOINTS].name",
        operator: "equals",
        value: "ETCDCTL_ENDPOINTS",
      },
      {
        path: "spec.containers[name=etcdctl].env[name=ETCDCTL_CACERT].name",
        operator: "equals",
        value: "ETCDCTL_CACERT",
      },
      {
        path: "spec.containers[name=etcdctl].env[name=ETCDCTL_CERT].name",
        operator: "equals",
        value: "ETCDCTL_CERT",
      },
      {
        path: "spec.containers[name=etcdctl].env[name=ETCDCTL_KEY].name",
        operator: "equals",
        value: "ETCDCTL_KEY",
      },
      { path: "spec.containers[name=etcdctl].env", operator: "length-equals", value: 5 },
      {
        path: "spec.containers[name=etcdctl].image",
        operator: "equals",
        value: "registry.k8s.io/etcd:3.6.0-0",
      },
      {
        path: "spec.containers[name=etcdctl].env[name=ETCDCTL_API].value",
        operator: "equals",
        value: "3",
      },
      {
        path: "spec.containers[name=etcdctl].env[name=ETCDCTL_ENDPOINTS].value",
        operator: "equals",
        value: "https://127.0.0.1:2379",
      },
      {
        path: "spec.containers[name=etcdctl].env[name=ETCDCTL_CACERT].value",
        operator: "equals",
        value: "/etc/kubernetes/pki/etcd/ca.crt",
      },
      {
        path: "spec.containers[name=etcdctl].env[name=ETCDCTL_CERT].value",
        operator: "equals",
        value: "/etc/kubernetes/pki/etcd/healthcheck-client.crt",
      },
      {
        path: "spec.containers[name=etcdctl].env[name=ETCDCTL_KEY].value",
        operator: "equals",
        value: "/etc/kubernetes/pki/etcd/healthcheck-client.key",
      },
      {
        path: "spec.containers[name=etcdctl].volumeMounts[mountPath=/etc/kubernetes/pki/etcd].name",
        operator: "equals",
        value: "etcd-pki",
      },
      {
        path: "spec.containers[name=etcdctl].volumeMounts",
        operator: "length-equals",
        value: 1,
      },
      {
        path: "spec.containers[name=etcdctl].volumeMounts[mountPath=/etc/kubernetes/pki/etcd].mountPath",
        operator: "equals",
        value: "/etc/kubernetes/pki/etcd",
      },
      {
        path: "spec.containers[name=etcdctl].volumeMounts[mountPath=/etc/kubernetes/pki/etcd].readOnly",
        operator: "equals",
        value: true,
      },
      { path: "spec.volumes", operator: "length-equals", value: 1 },
      { path: "spec.volumes[name=etcd-pki].name", operator: "equals", value: "etcd-pki" },
      {
        path: "spec.volumes[name=etcd-pki].hostPath.path",
        operator: "equals",
        value: "/etc/kubernetes/pki/etcd",
      },
      { path: "spec.volumes[name=etcd-pki].hostPath.type", operator: "equals", value: "Directory" },
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
    eventReason: "NOSPACE",
    logPodMatches: "^etcd-maintenance$",
    cluster: {
      nodes: [{ name: "control-plane-1" }],
      brokenPods: [
        {
          name: "etcd-maintenance",
          namespace: "kube-system",
          labels: { app: "etcd-maintenance" },
          nodeName: "control-plane-1",
          phase: "Failed",
          ready: false,
          containers: [
            {
              name: "etcdctl",
              image: "registry.k8s.io/etcd:3.6.0-0",
              ready: false,
              waitingReason: "Error",
            },
          ],
          logs: [
            {
              message: "API writes fail with mvcc database space exceeded while reads continue",
            },
          ],
        },
      ],
      healthyPods: [
        {
          name: "etcd-maintenance",
          namespace: "kube-system",
          labels: { app: "etcd-maintenance" },
          nodeName: "control-plane-1",
          phase: "Succeeded",
          ready: false,
          containers: [{ name: "etcdctl", image: "registry.k8s.io/etcd:3.6.0-0", ready: false }],
          logs: [{ message: "compaction and cluster defragmentation completed; alarm disarmed" }],
        },
      ],
    },
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
    capabilities: ["nodes", "pods", "events", "logs", "workload-controllers"],
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
      { path: "spec.rollout.before.certificatesExpiryDays", operator: "equals", value: 30 },
      { path: "spec.replicas", operator: "equals", value: 3 },
      { path: "spec.version", operator: "equals", value: "v1.36.0" },
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
    eventReason: "CertificateExpirationWarning",
    podSelector: { component: "kube-apiserver" },
    logPodMatches: "^kube-apiserver-",
    quickCommands: ["kubectl get machine production-control-plane-1 -n clusters -o yaml"],
    cluster: {
      resources: [0, 1, 2].map((index) => ({
        apiVersion: "cluster.x-k8s.io/v1beta2",
        kind: "Machine",
        metadata: {
          name: `production-control-plane-${index + 1}`,
          namespace: "clusters",
          labels: { "cluster.x-k8s.io/control-plane": "" },
        },
        spec: { clusterName: "production", version: "v1.36.0" },
        status: {
          conditions: [
            {
              type: "CertificatesAvailable",
              status: "True",
              reason: "CertificatesExpiringSoon",
              message: "control-plane certificates are approaching their expiry window",
            },
          ],
        },
      })),
      nodes: [
        { name: "control-plane-1", labels: { "node-role.kubernetes.io/control-plane": "" } },
        { name: "control-plane-2", labels: { "node-role.kubernetes.io/control-plane": "" } },
        { name: "control-plane-3", labels: { "node-role.kubernetes.io/control-plane": "" } },
      ],
      brokenPods: [0, 1, 2].map((index) => ({
        name: `kube-apiserver-control-plane-${index + 1}`,
        namespace: "kube-system",
        labels: { component: "kube-apiserver", tier: "control-plane" },
        nodeName: `control-plane-${index + 1}`,
        podIP: `10.55.0.${10 + index}`,
        phase: "Running" as const,
        ready: true,
        containers: [
          {
            name: "kube-apiserver",
            image: "registry.k8s.io/kube-apiserver:v1.36.0",
            ready: true,
          },
        ],
        logs: [
          {
            message: "certificate expiry is near but no control-plane rollout is planned",
          },
        ],
      })),
      healthyPods: [0, 1, 2].map((index) => ({
        name: `kube-apiserver-control-plane-${index + 1}`,
        namespace: "kube-system",
        labels: { component: "kube-apiserver", tier: "control-plane" },
        nodeName: `control-plane-${index + 1}`,
        podIP: `10.55.0.${10 + index}`,
        phase: "Running" as const,
        ready: true,
        containers: [
          {
            name: "kube-apiserver",
            image: "registry.k8s.io/kube-apiserver:v1.36.0",
            ready: true,
          },
        ],
        logs: [{ message: "control-plane certificate rotation is scheduled" }],
      })),
    },
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
    capabilities: ["pods", "nodes", "rollouts", "events", "logs"],
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
      { path: "spec.selector.matchLabels.app", operator: "equals", value: "network-agent" },
      {
        path: "spec.template.metadata.labels.app",
        operator: "equals",
        value: "network-agent",
      },
      { path: "spec.updateStrategy.type", operator: "equals", value: "RollingUpdate" },
      { path: "spec.updateStrategy.rollingUpdate.maxUnavailable", operator: "equals", value: 1 },
      { path: "spec.updateStrategy.rollingUpdate.maxSurge", operator: "absent" },
      {
        path: "spec.template.spec.containers[name=agent].image",
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
    eventReason: "FailedCreatePodSandBox",
    cluster: {
      nodes: [
        { name: "old-node-1", labels: { "node.kubernetes.io/image-generation": "old" } },
        { name: "new-node-1", labels: { "node.kubernetes.io/image-generation": "new" } },
      ],
      brokenPods: [
        {
          name: "network-agent-old-node-1",
          namespace: "kube-system",
          labels: { app: "network-agent" },
          nodeName: "old-node-1",
          podIP: "10.56.0.10",
          phase: "Running",
          ready: true,
          containers: [
            {
              name: "agent",
              image: "registry.example/network-agent:v3.22.0",
              ready: true,
            },
          ],
          logs: [{ message: "network initialized on legacy node image" }],
        },
        {
          name: "network-agent-new-node-1",
          namespace: "kube-system",
          labels: { app: "network-agent" },
          nodeName: "new-node-1",
          phase: "Running",
          ready: false,
          containers: [
            {
              name: "agent",
              image: "registry.example/network-agent:v3.22.0",
              ready: false,
              restartCount: 6,
              waitingReason: "CrashLoopBackOff",
            },
          ],
          logs: [{ message: "new nodes are NetworkUnavailable and Pod sandbox creation fails" }],
        },
      ],
      healthyPods: [
        {
          name: "network-agent-old-node-1",
          namespace: "kube-system",
          labels: { app: "network-agent" },
          nodeName: "old-node-1",
          podIP: "10.56.0.10",
          phase: "Running",
          ready: true,
          containers: [
            {
              name: "agent",
              image:
                "registry.example/network-agent@sha256:136c136c136c136c136c136c136c136c136c136c136c136c136c136c136c136c",
              ready: true,
            },
          ],
          logs: [{ message: "network initialized" }],
        },
        {
          name: "network-agent-new-node-1",
          namespace: "kube-system",
          labels: { app: "network-agent" },
          nodeName: "new-node-1",
          podIP: "10.56.0.11",
          phase: "Running",
          ready: true,
          containers: [
            {
              name: "agent",
              image:
                "registry.example/network-agent@sha256:136c136c136c136c136c136c136c136c136c136c136c136c136c136c136c136c",
              ready: true,
            },
          ],
          logs: [{ message: "network initialized" }],
        },
      ],
      additionalBrokenPods: [
        {
          name: "storefront-pending",
          namespace: "store",
          labels: { app: "storefront" },
          phase: "Pending",
          ready: false,
          containers: [
            {
              name: "storefront",
              image: "registry.example/storefront:6.0.0",
              ready: false,
              waitingReason: "ContainerCreating",
            },
          ],
          logs: [],
        },
      ],
      additionalHealthyPods: [
        {
          name: "storefront-7d4f9",
          namespace: "store",
          labels: { app: "storefront" },
          nodeName: "new-node-1",
          podIP: "10.56.1.20",
          phase: "Running",
          ready: true,
          containers: [
            { name: "storefront", image: "registry.example/storefront:6.0.0", ready: true },
          ],
          logs: [{ message: "storefront serving normally" }],
        },
      ],
    },
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
    readonlyFiles: [
      {
        path: "team-blue-quota.yaml",
        initialValue: `apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-blue-compute
  namespace: team-blue
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
`,
      },
      {
        path: "web-deployment.yaml",
        initialValue: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: team-blue
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: registry.example/web:2.4.0
`,
      },
    ],
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
      { path: "spec.limits", operator: "length-equals", value: 1 },
      { path: "spec.limits.0.type", operator: "equals", value: "Container" },
      { path: "spec.limits.0.defaultRequest.cpu", operator: "equals", value: "100m" },
      { path: "spec.limits.0.defaultRequest.memory", operator: "equals", value: "128Mi" },
      { path: "spec.limits.0.default.cpu", operator: "equals", value: "500m" },
      { path: "spec.limits.0.default.memory", operator: "equals", value: "512Mi" },
      { path: "spec.limits.0.max.cpu", operator: "equals", value: "2" },
      { path: "spec.limits.0.max.memory", operator: "equals", value: "2Gi" },
    ],
    commands: [
      "kubectl describe resourcequota team-blue-compute -n team-blue",
      "kubectl get limitrange container-defaults -n team-blue -o yaml",
      "kubectl get events -n team-blue --sort-by=.lastTimestamp",
      "kubectl describe deployment web -n team-blue",
    ],
    quickCommands: [
      "kubectl get resourcequota team-blue-compute -n team-blue -o yaml",
      "kubectl get deployment web -n team-blue -o yaml",
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
    eventReason: "FailedCreate",
    cluster: {
      namespace: "team-blue",
      resources: [
        {
          apiVersion: "v1",
          kind: "ResourceQuota",
          metadata: { name: "team-blue-compute", namespace: "team-blue" },
          spec: {
            hard: {
              "requests.cpu": "4",
              "requests.memory": "8Gi",
              "limits.cpu": "8",
              "limits.memory": "16Gi",
            },
          },
        },
        {
          apiVersion: "apps/v1",
          kind: "Deployment",
          metadata: { name: "web", namespace: "team-blue", labels: { app: "web" } },
          spec: {
            replicas: 2,
            selector: { matchLabels: { app: "web" } },
            template: {
              metadata: { labels: { app: "web" } },
              spec: {
                containers: [{ name: "web", image: "registry.example/web:2.4.0" }],
              },
            },
          },
        },
      ],
      workloads: [{ name: "web", replicas: 2, selector: { app: "web" } }],
      brokenPods: [],
      healthyPods: [
        {
          name: "web-1",
          labels: { app: "web" },
          nodeName: "node-1",
          podIP: "10.58.0.21",
          ready: true,
          containers: [{ name: "web", image: "registry.example/web:2.4.0", ready: true }],
        },
        {
          name: "web-2",
          labels: { app: "web" },
          nodeName: "node-2",
          podIP: "10.58.0.22",
          ready: true,
          containers: [{ name: "web", image: "registry.example/web:2.4.0", ready: true }],
        },
      ],
      brokenEvents: [
        {
          reason: "FailedCreate",
          message:
            "pods web is forbidden: failed quota team-blue-compute: must specify requests.cpu, requests.memory, limits.cpu and limits.memory",
          involvedObject: { kind: "ReplicaSet", name: "web-7d4f9" },
        },
      ],
    },
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
      { path: "images", operator: "length-equals", value: 1 },
      {
        path: "images.0.digest",
        operator: "equals",
        value: "sha256:4d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b91",
      },
      { path: "images.0.name", operator: "equals", value: "registry.example/api" },
      { path: "images.0.newName", operator: "equals", value: "registry.example/api" },
      { path: "images.0.newTag", operator: "absent" },
      { path: "resources.0", operator: "equals", value: "../../base" },
      { path: "resources", operator: "length-equals", value: 1 },
      { path: "namespace", operator: "equals", value: "production" },
    ],
    commands: [
      "kubectl kustomize overlays/production",
      "kubectl get pod public-api-1 -n production -o yaml",
      "kubectl get pod public-api-4 -n production -o yaml",
      "kubectl get deployment public-api -n production -o yaml",
    ],
    quickCommands: ["kubectl get deployment public-api -n production -o yaml"],
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
    eventReason: "ImageIdentityDrift",
    cluster: {
      namespace: "production",
      workloads: [{ name: "public-api", replicas: 6, selector: { app: "public-api" } }],
      brokenResources: [
        {
          apiVersion: "apps/v1",
          kind: "Deployment",
          metadata: { name: "public-api", namespace: "production" },
          spec: {
            replicas: 6,
            selector: { matchLabels: { app: "public-api" } },
            template: {
              metadata: { labels: { app: "public-api" } },
              spec: {
                containers: [{ name: "api", image: "registry.example/api:production" }],
              },
            },
          },
        },
      ],
      healthyResources: [
        {
          apiVersion: "apps/v1",
          kind: "Deployment",
          metadata: { name: "public-api", namespace: "production" },
          spec: {
            replicas: 6,
            selector: { matchLabels: { app: "public-api" } },
            template: {
              metadata: { labels: { app: "public-api" } },
              spec: {
                containers: [
                  {
                    name: "api",
                    image:
                      "registry.example/api@sha256:4d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b91",
                  },
                ],
              },
            },
          },
        },
      ],
      brokenPods: Array.from({ length: 6 }, (_, index) => ({
        name: `public-api-${index + 1}`,
        labels: { app: "public-api" },
        nodeName: `node-${(index % 2) + 1}`,
        podIP: `10.59.0.${21 + index}`,
        ready: true,
        containers: [
          {
            name: "api",
            image: "registry.example/api:production",
            imageID:
              index < 3
                ? "registry.example/api@sha256:1111111111111111111111111111111111111111111111111111111111111111"
                : "registry.example/api@sha256:4d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b91",
            ready: true,
          },
        ],
      })),
      healthyPods: Array.from({ length: 6 }, (_, index) => ({
        name: `public-api-${index + 1}`,
        labels: { app: "public-api" },
        nodeName: `node-${(index % 2) + 1}`,
        podIP: `10.59.0.${21 + index}`,
        ready: true,
        containers: [
          {
            name: "api",
            image:
              "registry.example/api@sha256:4d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b91",
            imageID:
              "registry.example/api@sha256:4d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b91",
            ready: true,
          },
        ],
      })),
    },
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

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/** Enough of the symptom to match reliably, short enough to survive light rewording. */
function firstWords(sentence: string, count = 6): string {
  return sentence.split(/\s+/).slice(0, count).join(" ");
}

function makeLevel(spec: ProductionRepairSpec): ProblemLevel {
  const xp = spec.difficulty === "advanced" ? 200 : 150;
  const apiVersion = /^apiVersion:\s*(\S+)/m.exec(spec.solution)?.[1];
  if (!apiVersion) throw new Error(`${spec.slug} solution is missing apiVersion`);
  const namespace = spec.cluster?.namespace ?? spec.resource.namespace ?? "default";
  const observed = repairObservedResource({ manifest: spec.initial, resource: spec.resource });
  const fixture = buildRepairFixture({
    manifest: spec.initial,
    repairedManifest: spec.solution,
    resource: spec.resource,
    symptom: spec.symptom,
    eventReason: spec.eventReason,
    overrides: spec.cluster,
  });
  const hasModelledPods = fixture.broken.pods.length > 0;
  const podNamespace = fixture.broken.pods[0]?.namespace ?? namespace;
  const podSelector =
    spec.podSelector ?? repairWorkloadSelector({ manifest: spec.initial, resource: spec.resource });
  const quickCommands: ProblemLevel["quickCommands"] = [
    {
      id: "target-describe",
      command: `kubectl describe ${observed.kind.toLowerCase()} ${observed.name} -n ${observed.namespace}`,
    },
    { id: "incident-events", command: `kubectl get events -n ${namespace}` },
  ];
  if (spec.capabilities.includes("pods") && hasModelledPods) {
    quickCommands.push({
      id: "incident-pods",
      command: `kubectl get pods -n ${podNamespace} -o wide`,
    });
  }
  if (spec.capabilities.includes("logs") && hasModelledPods) {
    quickCommands.push({
      id: "incident-logs",
      command: `kubectl logs <pod> -n ${podNamespace}`,
      target: {
        kind: "pod",
        namespace: podNamespace,
        selector: podSelector,
        prefer: "not-ready",
      },
    });
  }
  for (const [index, command] of (spec.quickCommands ?? []).entries()) {
    quickCommands.push({ id: `incident-specific-${index + 1}`, command });
  }

  const evidenceRules: ProblemLevel["evidenceRules"] = [
    {
      id: "r-symptom",
      evidenceId: `${spec.slug}-symptom`,
      label: `The cluster reports that ${spec.symptom}`,
      hiddenLabel: "Namespace events reviewed",
      source: "events",
      trigger: {
        type: "event-reason",
        reason: spec.eventReason ?? "IncidentDetected",
        messageMatches: escapeRegExp(firstWords(spec.symptom)),
      },
    },
    {
      id: "r-policy",
      evidenceId: `${spec.slug}-policy`,
      label: `${observed.kind}/${observed.name} inspected in ${observed.namespace}`,
      hiddenLabel: "Affected Kubernetes object inspected",
      source: "object-explorer",
      trigger: {
        type: "object-view",
        kind: observed.kind,
        nameMatches: `^${escapeRegExp(observed.name)}$`,
        namespace: observed.namespace,
      },
    },
  ];
  if (spec.capabilities.includes("logs") && hasModelledPods) {
    evidenceRules.push({
      id: "r-workload-log",
      evidenceId: `${spec.slug}-workload-log`,
      label: `Incident logs report: ${spec.symptom}`,
      hiddenLabel: "Incident logs read",
      source: "logs",
      trigger: {
        type: "log",
        podMatches: spec.logPodMatches ?? `^${escapeRegExp(spec.resource.name)}-`,
        namespace: podNamespace,
        messageMatches: escapeRegExp(firstWords(spec.symptom)),
      },
    });
  }
  evidenceRules.push({
    id: "r-validator",
    evidenceId: `${spec.slug}-validator`,
    label: "The incident state still fails its production acceptance gate",
    hiddenLabel: "Acceptance gate checked",
    source: "validator",
    trigger: { type: "validator", validatorId: "incident-state", passed: false },
  });

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
    engine: {
      kind: "fixture",
      fixture,
    },
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
        ...(spec.goals ? { goals: spec.goals } : {}),
      },
    ],
    semanticPolicy: spec.semanticPolicy,
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
    // Every shortcut executes against an object the fixture actually exposes. Logs
    // and Pod views appear only when the level declares those investigation surfaces.
    quickCommands,
    referenceCommands: spec.commands,
    // These incidents cover scheduling, admission, storage, operators, and policy;
    // inventing an HTTP Service for every one made the model contradict the brief.
    probeTargets: [],
    validators: [
      {
        id: "incident-state",
        title: "The modelled incident has cleared",
        successLabel: "No active Warning events remain",
        failureLabel: "The cluster still reports the incident",
        kind: "no-warning-events",
        namespace,
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
    // Evidence is tied to the authored object and incident event, never to a fake
    // assessment Service. This keeps hint unlocks reachable and incident-specific.
    evidenceRules,
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
