import { parseLesson } from "@/lib/domain/schemas";
import type { DocsBlock, DocsLesson, KubernetesConcept } from "@/lib/domain/types";

/**
 * Interactive docs lessons. Content is intentionally typed data rather than MDX:
 * schema validation catches broken lessons at module load, routes are generated
 * from the same data, and labs can hand off directly into the playground.
 */

const WEB_IMAGE = {
  ref: "klab/web-app:1.0.0",
  description: "Web server: /healthz 200, /readyz 404, / 200.",
};

const WEB_V2_IMAGE = {
  ref: "klab/web-app:2.0.0",
  description: "Broken release: starts, but serves 500 everywhere.",
};

const LEGACY_IMAGE = {
  ref: "klab/web-app:0.9.0",
  description: "Legacy build: /healthz 200 but / answers 500.",
};

const API_IMAGE = {
  ref: "klab/api:1.0.0",
  description: "API that calls another service by DNS name.",
};

const WORKER_IMAGE = {
  ref: "klab/worker:1.0.0",
  description: "Queue worker; exits unless DATABASE_URL is set.",
};

const WEB_POD = `apiVersion: v1
kind: Pod
metadata:
  name: web
  namespace: default
  labels:
    app: web
spec:
  containers:
    - name: web
      image: klab/web-app:1.0.0
      ports:
        - name: http
          containerPort: 8080
      readinessProbe:
        httpGet:
          path: /healthz
          port: 8080
        initialDelaySeconds: 1
        periodSeconds: 3
`;

const WEB_SERVICE = `apiVersion: v1
kind: Service
metadata:
  name: web-svc
  namespace: default
spec:
  selector:
    app: web
  ports:
    - name: http
      port: 80
      targetPort: 8080
`;

const WEB_SERVICE_BAD_SELECTOR = `apiVersion: v1
kind: Service
metadata:
  name: web-svc
  namespace: default
spec:
  selector:
    app: api
  ports:
    - name: http
      port: 80
      targetPort: 8080
`;

const WEB_DEPLOYMENT = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: default
  labels:
    app: web
spec:
  replicas: 3
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
          image: klab/web-app:1.0.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 1
            periodSeconds: 3
`;

const API_POD = `apiVersion: v1
kind: Pod
metadata:
  name: api
  namespace: default
  labels:
    app: api
spec:
  containers:
    - name: api
      image: klab/api:1.0.0
      env:
        - name: UPSTREAM_URL
          value: http://web-svc/
      ports:
        - name: http
          containerPort: 8080
      readinessProbe:
        httpGet:
          path: /healthz
          port: 8080
        initialDelaySeconds: 1
        periodSeconds: 3
`;

const API_SERVICE = `apiVersion: v1
kind: Service
metadata:
  name: api-svc
  namespace: default
spec:
  selector:
    app: api
  ports:
    - name: http
      port: 80
      targetPort: 8080
`;

const WORKER_POD_BROKEN = `apiVersion: v1
kind: Pod
metadata:
  name: worker
  namespace: default
  labels:
    app: worker
spec:
  containers:
    - name: worker
      image: klab/worker:1.0.0
`;

const WEB_REPLICASET = `apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: web
  namespace: default
  labels:
    app: web
spec:
  replicas: 3
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
          image: klab/web-app:1.0.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 1
            periodSeconds: 3
`;

const APP_CONFIGMAP = `apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: default
data:
  GREETING: "hello"
  LOG_LEVEL: "info"
`;

const WEB_DEPLOYMENT_ENVFROM = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: default
  labels:
    app: web
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
          image: klab/web-app:1.0.0
          envFrom:
            - configMapRef:
                name: app-config
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 1
            periodSeconds: 3
`;

const WEB_DEPLOYMENT_RESOURCES = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: default
  labels:
    app: web
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
          image: klab/web-app:1.0.0
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 100m
              memory: 128Mi
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 1
            periodSeconds: 3
`;

const WEB_POD_BAD_PROBE = `apiVersion: v1
kind: Pod
metadata:
  name: web
  namespace: default
  labels:
    app: web
spec:
  containers:
    - name: web
      image: klab/web-app:1.0.0
      ports:
        - name: http
          containerPort: 8080
      readinessProbe:
        httpGet:
          path: /readyz
          port: 8080
        initialDelaySeconds: 1
        periodSeconds: 3
`;

const WEB_DEPLOYMENT_BAD_PROBE = WEB_DEPLOYMENT.replace("path: /healthz", "path: /readyz");

const TEAM_A_NAMESPACE = `apiVersion: v1
kind: Namespace
metadata:
  name: team-a
`;

const TEAM_B_NAMESPACE = `apiVersion: v1
kind: Namespace
metadata:
  name: team-b
`;

const TEAM_A_POD = WEB_POD.replace("namespace: default", "namespace: team-a").replace(
  "name: web",
  "name: web-a",
);

const TEAM_B_POD = WEB_POD.replace("namespace: default", "namespace: team-b").replace(
  "name: web",
  "name: web-b",
);

const TEAM_A_SERVICE = WEB_SERVICE.replace("namespace: default", "namespace: team-a");
const TEAM_B_SERVICE = WEB_SERVICE.replace("namespace: default", "namespace: team-b");

function quiz(
  id: string,
  question: string,
  options: Extract<DocsBlock, { type: "quiz" }>["options"],
): DocsBlock {
  return { type: "quiz", id, question, options };
}

function qOption(
  id: string,
  text: string,
  correct: boolean,
  explanation: string,
): { id: string; text: string; correct: boolean; explanation: string } {
  return { id, text, correct, explanation };
}

const OFFICIAL_SOURCES = {
  overview: { title: "Kubernetes overview", href: "https://kubernetes.io/docs/concepts/overview/" },
  components: {
    title: "Kubernetes components",
    href: "https://kubernetes.io/docs/concepts/overview/components/",
  },
  objects: {
    title: "Kubernetes objects",
    href: "https://kubernetes.io/docs/concepts/overview/working-with-objects/",
  },
  labels: {
    title: "Labels and selectors",
    href: "https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/",
  },
  annotations: {
    title: "Annotations",
    href: "https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations/",
  },
  owners: {
    title: "Owners and dependents",
    href: "https://kubernetes.io/docs/concepts/overview/working-with-objects/owners-dependents/",
  },
  objectManagement: {
    title: "Object management",
    href: "https://kubernetes.io/docs/concepts/overview/working-with-objects/object-management/",
  },
  kustomize: {
    title: "Manage objects with Kustomize",
    href: "https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/",
  },
  pods: { title: "Pods", href: "https://kubernetes.io/docs/concepts/workloads/pods/" },
  initContainers: {
    title: "Init containers",
    href: "https://kubernetes.io/docs/concepts/workloads/pods/init-containers/",
  },
  sidecarContainers: {
    title: "Sidecar containers",
    href: "https://kubernetes.io/docs/concepts/workloads/pods/sidecar-containers/",
  },
  lifecycleHooks: {
    title: "Container lifecycle hooks",
    href: "https://kubernetes.io/docs/concepts/containers/container-lifecycle-hooks/",
  },
  deployments: {
    title: "Deployments",
    href: "https://kubernetes.io/docs/concepts/workloads/controllers/deployment/",
  },
  replicasets: {
    title: "ReplicaSets",
    href: "https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/",
  },
  statefulsets: {
    title: "StatefulSets",
    href: "https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/",
  },
  daemonsets: {
    title: "DaemonSets",
    href: "https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/",
  },
  jobs: { title: "Jobs", href: "https://kubernetes.io/docs/concepts/workloads/controllers/job/" },
  cronjobs: {
    title: "CronJobs",
    href: "https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/",
  },
  services: {
    title: "Services",
    href: "https://kubernetes.io/docs/concepts/services-networking/service/",
  },
  endpointSlices: {
    title: "EndpointSlices",
    href: "https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/",
  },
  dns: {
    title: "DNS for Services and Pods",
    href: "https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/",
  },
  ingress: {
    title: "Ingress",
    href: "https://kubernetes.io/docs/concepts/services-networking/ingress/",
  },
  gatewayApi: {
    title: "Gateway API",
    href: "https://kubernetes.io/docs/concepts/services-networking/gateway/",
  },
  probes: {
    title: "Liveness, readiness, and startup probes",
    href: "https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/",
  },
  namespaces: {
    title: "Namespaces",
    href: "https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/",
  },
  resources: {
    title: "Resource management for Pods and containers",
    href: "https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/",
  },
  resourceQuotas: {
    title: "Resource quotas",
    href: "https://kubernetes.io/docs/concepts/policy/resource-quotas/",
  },
  limitRanges: {
    title: "Limit ranges",
    href: "https://kubernetes.io/docs/concepts/policy/limit-range/",
  },
  configmaps: {
    title: "ConfigMaps",
    href: "https://kubernetes.io/docs/concepts/configuration/configmap/",
  },
  secrets: {
    title: "Secrets",
    href: "https://kubernetes.io/docs/concepts/configuration/secret/",
  },
  volumes: { title: "Volumes", href: "https://kubernetes.io/docs/concepts/storage/volumes/" },
  persistentVolumes: {
    title: "Persistent Volumes",
    href: "https://kubernetes.io/docs/concepts/storage/persistent-volumes/",
  },
  serviceAccounts: {
    title: "Service Accounts",
    href: "https://kubernetes.io/docs/concepts/security/service-accounts/",
  },
  rbac: {
    title: "RBAC authorization",
    href: "https://kubernetes.io/docs/reference/access-authn-authz/rbac/",
  },
  securityContext: {
    title: "Configure a Security Context",
    href: "https://kubernetes.io/docs/tasks/configure-pod-container/security-context/",
  },
  networkPolicies: {
    title: "Network Policies",
    href: "https://kubernetes.io/docs/concepts/services-networking/network-policies/",
  },
  scheduling: {
    title: "Kubernetes scheduler",
    href: "https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/",
  },
  taints: {
    title: "Taints and tolerations",
    href: "https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/",
  },
  autoscaling: {
    title: "Horizontal Pod Autoscaling",
    href: "https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/",
  },
  disruptions: {
    title: "Disruptions",
    href: "https://kubernetes.io/docs/concepts/workloads/pods/disruptions/",
  },
  podDisruptionBudgets: {
    title: "Pod Disruption Budgets",
    href: "https://kubernetes.io/docs/tasks/run-application/configure-pdb/",
  },
  customResources: {
    title: "Custom resources",
    href: "https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/",
  },
  operators: {
    title: "Operator pattern",
    href: "https://kubernetes.io/docs/concepts/extend-kubernetes/operator/",
  },
  admissionControllers: {
    title: "Admission controllers",
    href: "https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/",
  },
  debugPods: {
    title: "Debug running Pods",
    href: "https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/",
  },
  debugServices: {
    title: "Debug Services",
    href: "https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/",
  },
  logging: {
    title: "Logging architecture",
    href: "https://kubernetes.io/docs/concepts/cluster-administration/logging/",
  },
} as const;

const SOURCE_BY_CONCEPT: Partial<
  Record<KubernetesConcept, (typeof OFFICIAL_SOURCES)[keyof typeof OFFICIAL_SOURCES][]>
> = {
  pods: [OFFICIAL_SOURCES.pods],
  deployments: [OFFICIAL_SOURCES.deployments],
  replicasets: [OFFICIAL_SOURCES.replicasets],
  statefulsets: [OFFICIAL_SOURCES.statefulsets],
  daemonsets: [OFFICIAL_SOURCES.daemonsets],
  jobs: [OFFICIAL_SOURCES.jobs],
  cronjobs: [OFFICIAL_SOURCES.cronjobs],
  services: [OFFICIAL_SOURCES.services],
  ingress: [OFFICIAL_SOURCES.ingress],
  "gateway-api": [OFFICIAL_SOURCES.gatewayApi],
  endpointslices: [OFFICIAL_SOURCES.endpointSlices],
  "labels-selectors": [OFFICIAL_SOURCES.labels],
  annotations: [OFFICIAL_SOURCES.annotations],
  "owners-gc": [OFFICIAL_SOURCES.owners],
  "readiness-probes": [OFFICIAL_SOURCES.probes],
  "liveness-probes": [OFFICIAL_SOURCES.probes],
  "startup-probes": [OFFICIAL_SOURCES.probes],
  "init-containers": [OFFICIAL_SOURCES.initContainers],
  "sidecar-containers": [OFFICIAL_SOURCES.sidecarContainers],
  "lifecycle-hooks": [OFFICIAL_SOURCES.lifecycleHooks],
  dns: [OFFICIAL_SOURCES.dns],
  namespaces: [OFFICIAL_SOURCES.namespaces],
  rollouts: [OFFICIAL_SOURCES.deployments],
  disruptions: [OFFICIAL_SOURCES.disruptions, OFFICIAL_SOURCES.podDisruptionBudgets],
  events: [OFFICIAL_SOURCES.debugPods],
  logs: [OFFICIAL_SOURCES.logging, OFFICIAL_SOURCES.debugPods],
  resources: [OFFICIAL_SOURCES.resources],
  "resource-quotas": [OFFICIAL_SOURCES.resourceQuotas],
  "limit-ranges": [OFFICIAL_SOURCES.limitRanges],
  configmaps: [OFFICIAL_SOURCES.configmaps],
  secrets: [OFFICIAL_SOURCES.secrets],
  storage: [OFFICIAL_SOURCES.volumes, OFFICIAL_SOURCES.persistentVolumes],
  "service-accounts": [OFFICIAL_SOURCES.serviceAccounts],
  rbac: [OFFICIAL_SOURCES.rbac],
  "security-contexts": [OFFICIAL_SOURCES.securityContext],
  "network-policies": [OFFICIAL_SOURCES.networkPolicies],
  scheduling: [OFFICIAL_SOURCES.scheduling, OFFICIAL_SOURCES.taints],
  autoscaling: [OFFICIAL_SOURCES.autoscaling],
  "object-management": [OFFICIAL_SOURCES.objectManagement],
  kustomize: [OFFICIAL_SOURCES.kustomize],
  crds: [OFFICIAL_SOURCES.customResources],
  operators: [OFFICIAL_SOURCES.operators],
  "admission-controllers": [OFFICIAL_SOURCES.admissionControllers],
  reconciliation: [OFFICIAL_SOURCES.overview, OFFICIAL_SOURCES.components],
  networking: [OFFICIAL_SOURCES.services, OFFICIAL_SOURCES.dns],
  debugging: [OFFICIAL_SOURCES.debugPods, OFFICIAL_SOURCES.debugServices],
};

function withOfficialSources(lesson: DocsLesson): DocsLesson {
  const byHref = new Map<string, { title: string; href: string }>();
  for (const source of lesson.sources ?? []) byHref.set(source.href, source);
  for (const concept of lesson.concepts) {
    for (const source of SOURCE_BY_CONCEPT[concept] ?? []) byHref.set(source.href, source);
  }
  return { ...lesson, sources: Array.from(byHref.values()).slice(0, 5) };
}

const whatIsKubernetes: DocsLesson = {
  slug: ["foundations", "what-is-kubernetes"],
  title: "What is Kubernetes?",
  description: "Kubernetes is a control plane for running containers reliably across machines.",
  section: "Foundations",
  order: 0,
  concepts: ["pods", "services", "deployments", "reconciliation"],
  content: [
    {
      type: "heading",
      id: "the-problem",
      text: "The problem orchestration solves",
    },
    {
      type: "paragraph",
      text: "A single container on a laptop is easy: you run it and watch it. Production is not that. You have dozens of containers spread over many machines, and each one can crash, get OOM-killed, or land on a node that fills up. If you manage this by hand you are forever answering the same questions: which machine has room, what do I restart when a process dies, how do clients find a container whose IP just changed, and how do I ship a new version without an outage. Container orchestration is the job of answering those questions automatically, continuously, for you.",
    },
    {
      type: "heading",
      id: "declarative-model",
      text: "Declarative desired state",
    },
    {
      type: "paragraph",
      text: "Kubernetes' central idea is that you describe the end state you want rather than the steps to get there. You write down: run three copies of this container, expose them behind this stable address, treat a Pod as healthy when this check passes. You hand that description to the cluster and stop. You do not run a sequence of commands; you declare a goal. Kubernetes stores your goal as the desired state and then works to make the observed state match it.",
    },
    {
      type: "diagram",
      variant: "control-loop",
      title: "The reconciliation loop",
      caption:
        "Controllers watch desired vs. observed state and act to close the gap — forever, not once.",
    },
    {
      type: "concept",
      term: "Reconciliation",
      definition:
        "A controller is a loop that reads the desired state, observes the actual state, and takes one step to reduce the difference — then repeats. Nothing runs 'once and done'; the loop keeps running, which is exactly why a Pod you delete out of a managed set comes back.",
    },
    {
      type: "callout",
      tone: "key",
      title: "Why this matters for debugging",
      text: "Almost every Kubernetes problem is a gap between what you declared and what the cluster observes. The most useful habit you can build is to compare the two: what did I ask for (kubectl get -o yaml, the spec) versus what is actually happening (status, events, logs). Find the gap and you have found the bug.",
    },
    {
      type: "heading",
      id: "what-you-get",
      text: "What Kubernetes gives you",
    },
    {
      type: "paragraph",
      text: "Because the cluster continuously reconciles desired state, you get a set of capabilities for free that you would otherwise script by hand. These are the reasons teams adopt Kubernetes at all.",
    },
    {
      type: "steps",
      title: "The capabilities you inherit",
      items: [
        {
          title: "Scheduling",
          text: "The scheduler decides which node runs each Pod based on free CPU/memory, node labels, and constraints you set. You say 'run this'; it decides 'run it here'.",
        },
        {
          title: "Self-healing",
          text: "If a container crashes the kubelet restarts it; if a whole Pod or node is lost, the controller replaces the missing replicas to get back to your declared count.",
        },
        {
          title: "Service discovery",
          text: "Pods are ephemeral and their IPs change. A Service gives them one stable name and virtual IP, and load-balances to the current set of Ready Pods.",
        },
        {
          title: "Rollouts",
          text: "A Deployment can shift traffic from an old Pod template to a new one gradually, and roll back if the new version fails its health checks — no big-bang replacement.",
        },
        {
          title: "Config & secret management",
          text: "ConfigMaps and Secrets let you inject configuration and credentials into containers at runtime, so the same image runs unchanged across dev, staging, and prod.",
        },
      ],
    },
    {
      type: "diagram",
      variant: "cluster-architecture",
      title: "Cluster building blocks",
      caption:
        "You talk to the API server; the scheduler, controllers, and per-node kubelets do the ongoing work.",
    },
    {
      type: "heading",
      id: "object-shape",
      text: "Every object has the same shape",
    },
    {
      type: "paragraph",
      text: "You express desired state as API objects, and every object — Pod, Service, Deployment — shares the same four-part skeleton: apiVersion, kind, metadata, and spec. Learn to read those four fields and you can read any manifest, even for a resource you have never seen.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A minimal Pod",
      caption: "The smallest useful desired-state object — the four fields every manifest carries.",
      lines: [
        {
          code: "apiVersion: v1",
          note: "which API group and version validates this object — a Pod lives in the core group, so it is v1 (not apps/v1)",
        },
        {
          code: "kind: Pod",
          note: "which kind of object you are declaring; the API server routes to the matching controller",
        },
        {
          code: "metadata:",
          note: "identity: name, namespace, and labels — how everything else refers to this object",
        },
        {
          code: "  name: web",
        },
        {
          code: "  labels:",
          note: "arbitrary key:value tags — Services and controllers select objects by these",
        },
        {
          code: "    app: web",
        },
        {
          code: "spec:",
          note: "the DESIRED state — what you want to be true; the cluster works to make it so",
        },
        {
          code: "  containers:",
          note: "the list of containers that make up this Pod (usually one)",
        },
        {
          code: "    - name: web",
        },
        {
          code: "      image: klab/web-app:1.0.0",
          note: "the exact image to run; pin a tag so the desired state is reproducible",
        },
        {
          code: "      ports:",
        },
        {
          code: "        - containerPort: 8080",
          note: "documents the port the app listens on inside the container",
        },
      ],
    },
    {
      type: "heading",
      id: "build-it",
      text: "Build that object up",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "A Pod grows in three steps",
      stages: [
        {
          label: "Identity",
          note: "Start with the three fields that name the object: which API version, which kind, and a name. This is not yet runnable — there is no spec, so nothing to run.",
          code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web",
        },
        {
          label: "Declare what to run",
          note: "Add the spec with one container and an image. Now it is a valid, runnable desired state: 'run klab/web-app:1.0.0 in a container named web'.",
          code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0",
        },
        {
          label: "Make it selectable and expose the port",
          note: "Add a label so a Service can find this Pod, and declare the container port. The Pod is unchanged in behavior but now participates in service discovery.",
          code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\n  labels:\n    app: web\nspec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      ports:\n        - containerPort: 8080",
        },
      ],
    },
    {
      type: "heading",
      id: "imperative-vs-declarative",
      text: "Imperative vs. declarative",
    },
    {
      type: "compare",
      caption:
        "The imperative script runs once and is forgotten. The declarative object is stored and continuously enforced — that persistence is the whole point.",
      left: {
        title: "Imperative (do these steps)",
        code: "# a one-shot sequence of commands\ndocker run -d web-app:1.0.0\n# node dies -> nothing brings it back\n# you re-run the command yourself",
      },
      right: {
        title: "Declarative (store this goal)",
        code: "# describe the goal, hand it over once\nkubectl apply -f pod.yaml\n# node dies -> the controller recreates\n# the Pod to match the stored spec",
      },
    },
    {
      type: "callout",
      tone: "info",
      title: "kubectl apply, not kubectl run",
      text: "You can create objects imperatively (kubectl run, kubectl create), but real usage stores manifests in version control and applies them. The file is the source of truth; the cluster reconciles toward it. That is what makes environments reproducible and reviewable.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a broken manifest",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "You apply this manifest and the API server rejects it with 'no matches for kind Pod in version apps/v1'. The container and image are fine. What is wrong?",
      code: "apiVersion: apps/v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0",
      answer:
        "The apiVersion is wrong. A Pod belongs to the core API group, whose version is simply v1 — not apps/v1. The apps/v1 group is for higher-level workloads like Deployments, ReplicaSets, and StatefulSets. Change apiVersion: apps/v1 to apiVersion: v1 and the object validates. The kind and apiVersion must together name a real registered resource.",
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write one yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Write the smallest valid Pod named cache that runs the image klab/web-app:1.0.0 in a container named cache. No labels or ports required.",
      hint: "You need exactly four top-level fields: apiVersion (core group), kind, metadata.name, and spec.containers with one entry that has a name and an image.",
      solution:
        "apiVersion: v1\nkind: Pod\nmetadata:\n  name: cache\nspec:\n  containers:\n    - name: cache\n      image: klab/web-app:1.0.0",
    },
    {
      type: "heading",
      id: "what-solves-what",
      text: "Which capability solves which problem",
    },
    {
      type: "decisionTable",
      title: "Mapping a problem to the Kubernetes answer",
      columns: ["What handles it"],
      rows: [
        {
          label: "Keep N copies running despite crashes",
          cells: ["A Deployment + self-healing (controllers recreate lost replicas)"],
        },
        {
          label: "One stable address for changing Pods",
          cells: ["A Service (stable name/IP, load-balances to Ready Pods)"],
        },
        {
          label: "Ship a new version without downtime",
          cells: ["A Deployment rollout (gradual template swap, automatic rollback)"],
        },
        {
          label: "Inject config and credentials at runtime",
          cells: ["ConfigMaps and Secrets mounted or set as env vars"],
        },
        {
          label: "Decide which machine runs a workload",
          cells: ["The scheduler (capacity + constraints)"],
        },
      ],
    },
    { type: "mission", missionSlug: "foundations/what-is-kubernetes" },
    {
      type: "quiz",
      id: "what-is-kubernetes-q1",
      question: "Which statement best describes Kubernetes?",
      options: [
        {
          id: "a",
          text: "A container image registry.",
          correct: false,
          explanation:
            "Registries store images; Kubernetes runs and coordinates workloads built from those images.",
        },
        {
          id: "b",
          text: "A control plane that reconciles declared application state.",
          correct: true,
          explanation:
            "You store desired state as objects, and controllers run loops that make the actual state match it.",
        },
        {
          id: "c",
          text: "A single Linux server with Docker installed.",
          correct: false,
          explanation:
            "A cluster spans many machines and runs many control loops; it is not one host.",
        },
      ],
    },
    {
      type: "quiz",
      id: "what-is-kubernetes-q2",
      question: "You delete a Pod that a Deployment manages. What happens next, and why?",
      options: [
        {
          id: "a",
          text: "It stays deleted; you must recreate it manually.",
          correct: false,
          explanation:
            "That would be true for a bare Pod, but a Deployment declares a replica count the controller keeps enforcing.",
        },
        {
          id: "b",
          text: "A new Pod appears, because the controller reconciles toward the declared replica count.",
          correct: true,
          explanation:
            "The observed state (fewer replicas) no longer matches the desired state, so the controller creates a replacement.",
        },
        {
          id: "c",
          text: "The whole cluster restarts to recover.",
          correct: false,
          explanation:
            "Reconciliation is scoped and incremental; a single missing replica is fixed by recreating that Pod, not by restarting anything cluster-wide.",
        },
      ],
    },
    {
      type: "takeaways",
      items: [
        "Kubernetes is declarative: you store the goal as an object, you do not script the steps.",
        "Controllers run reconciliation loops that continuously drive observed state toward desired state.",
        "You inherit scheduling, self-healing, service discovery, rollouts, and config/secret management from that loop.",
        "Every object shares the same skeleton: apiVersion, kind, metadata, spec.",
        "Debugging almost always means finding the gap between what you declared and what the cluster observes.",
      ],
    },
  ],
  labs: [],
};

const clusterArchitecture: DocsLesson = {
  slug: ["foundations", "cluster-architecture"],
  title: "Cluster Architecture",
  description:
    "Understand what the API server, controllers, scheduler, kubelet, and nodes each do.",
  section: "Foundations",
  order: 1,
  concepts: ["pods", "events", "reconciliation"],
  content: [
    {
      type: "heading",
      id: "control-plane",
      text: "Control plane and worker nodes",
    },
    {
      type: "paragraph",
      text: "A Kubernetes cluster splits into two halves. The control plane stores the cluster's state and makes every decision about what should run where. The worker nodes are the machines that actually run your containers. You almost never talk to a node directly — you send a desired state to the API server, and a chain of specialized components turns that intent into running Pods.",
    },
    {
      type: "diagram",
      variant: "cluster-architecture",
      title: "The pieces of a cluster",
      caption:
        "kubectl talks to the API server. The API server is the only thing that talks to etcd. Everything else watches and reacts.",
    },
    {
      type: "heading",
      id: "control-plane-components",
      text: "What each control plane component does",
    },
    {
      type: "paragraph",
      text: "The control plane is not one program — it is a handful of independent components, each with a narrow job. They coordinate entirely through the API server, never by calling each other.",
    },
    {
      type: "steps",
      title: "Control plane components",
      items: [
        {
          title: "kube-apiserver",
          text: "The front door. It authenticates and authorizes every request, runs admission control, validates objects, and persists them. It is the only component that reads and writes etcd, which makes the API the single source of truth.",
        },
        {
          title: "etcd",
          text: "A consistent, highly-available key-value store. It is the backing store for all cluster data — every Pod, Service, Secret, and ConfigMap lives here. If etcd is lost and unbacked-up, the cluster's state is gone.",
        },
        {
          title: "kube-scheduler",
          text: "Watches for newly created Pods that have no node assigned (empty spec.nodeName) and picks a node for each one, honoring resource requests, affinity, and taints. It decides where; it does not start anything.",
        },
        {
          title: "kube-controller-manager",
          text: "Runs the built-in controllers as continuous reconciliation loops — node, replicaset, deployment, job, endpointslice, service-account, and more. Each loop drives actual state toward desired state.",
        },
        {
          title: "cloud-controller-manager",
          text: "Present only on managed/cloud clusters. It runs the controllers that talk to the cloud provider: provisioning LoadBalancer Services, attaching routes, and reconciling node lifecycle with the underlying VMs.",
        },
      ],
    },
    {
      type: "heading",
      id: "node-components",
      text: "What runs on every worker node",
    },
    {
      type: "steps",
      title: "Node components",
      items: [
        {
          title: "kubelet",
          text: "The agent on each node. It watches the API server for Pods bound to its node, tells the runtime to start their containers, runs liveness/readiness probes, and reports observed status back to the API server. It never invents work — it executes what the control plane assigned.",
        },
        {
          title: "kube-proxy",
          text: "Programs each node's network rules (iptables or IPVS) so that traffic to a Service's ClusterIP is load-balanced to the current set of Ready backend Pods. Some CNI plugins replace it.",
        },
        {
          title: "container runtime",
          text: "The software that actually runs containers — containerd or CRI-O. The kubelet talks to it through the Container Runtime Interface (CRI) to pull images and manage container lifecycles.",
        },
      ],
    },
    {
      type: "compare",
      caption:
        "A clean mental split: the control plane decides, the nodes do. Keeping these apart makes debugging much faster.",
      left: {
        title: "Control plane (decides)",
        code: "kube-apiserver   store + gate all state\netcd             the source of truth\nkube-scheduler   choose a node\ncontroller-mgr   create/replace objects",
      },
      right: {
        title: "Nodes (do the work)",
        code: "kubelet          start containers, report status\nkube-proxy       route Service traffic\nruntime          pull images, run containers",
      },
    },
    {
      type: "heading",
      id: "request-flow",
      text: "How a request flows through the cluster",
    },
    {
      type: "paragraph",
      text: "When you apply a manifest, nothing runs immediately. The object is stored, and then independent components each notice it and take one small step. Follow a Deployment from kubectl to a running container.",
    },
    {
      type: "demo",
      title: "From kubectl apply to a running Pod",
      description:
        "Each component watches the API server and reacts to what the previous one wrote. No component calls another directly.",
      steps: [
        {
          label: "Admit + persist",
          detail:
            "kubectl sends the manifest to the API server. It authenticates you, authorizes the action, runs admission, validates the object, and writes it to etcd.",
          command: "kubectl apply -f deploy.yaml",
          output: "deployment.apps/web created",
        },
        {
          label: "Controllers expand it",
          detail:
            "The deployment controller sees the new Deployment and creates a ReplicaSet; the ReplicaSet controller then creates the Pods it needs — each with an empty spec.nodeName.",
          command: "kubectl get rs,pods",
          output:
            "NAME               DESIRED   CURRENT\nreplicaset/web-7d   3         3\nNAME              STATUS\npod/web-7d-abc     Pending",
        },
        {
          label: "Scheduler binds",
          detail:
            "The scheduler watches for Pods with no node, picks a suitable node for each, and writes spec.nodeName back through the API server (a Bind).",
          command: "kubectl get pod web-7d-abc -o jsonpath='{.spec.nodeName}'",
          output: "node-1",
        },
        {
          label: "kubelet runs it",
          detail:
            "The kubelet on node-1 sees a Pod bound to it, has the runtime pull the image and start containers, runs the probes, and reports status.phase: Running back to the API server — which stores it in etcd.",
          command: "kubectl get pod web-7d-abc",
          output: "NAME          READY   STATUS    RESTARTS\nweb-7d-abc    1/1     Running   0",
        },
      ],
    },
    {
      type: "callout",
      tone: "key",
      title: "One gateway, one source of truth",
      text: "The scheduler, controllers, and kubelets never touch etcd and never call each other. They watch the API server and write through it. That single gateway is exactly what makes the API the authoritative record of the cluster.",
    },
    {
      type: "concept",
      term: "Watch",
      definition:
        "Components do not poll the API server on a timer. They open a watch and receive a live stream of add/update/delete events for the objects they care about, then react. This is how the scheduler notices an unscheduled Pod within milliseconds of it being created.",
    },
    {
      type: "concept",
      term: "Binding",
      definition:
        "A Bind is the tiny API write the scheduler makes to set a Pod's spec.nodeName. Scheduling is literally just choosing a node and writing that one field — the kubelet on that node does everything after.",
    },
    {
      type: "heading",
      id: "pod-object",
      text: "Read a Pod as a record of who did what",
    },
    {
      type: "paragraph",
      text: "A live Pod object is a paper trail. You author spec.containers; the scheduler fills spec.nodeName; the kubelet fills the entire status. Learning which component owns which field turns a Pod dump into a diagnosis.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A running Pod, annotated by author",
      caption: "Who wrote each field — you, the scheduler, or the kubelet.",
      lines: [
        {
          code: "apiVersion: v1",
        },
        {
          code: "kind: Pod",
        },
        {
          code: "metadata:",
          note: "you author identity — name and namespace",
        },
        {
          code: "  name: web",
        },
        {
          code: "  namespace: default",
        },
        {
          code: "spec:",
        },
        {
          code: "  nodeName: node-1",
          note: "empty when you submit; the SCHEDULER writes this via a Bind",
        },
        {
          code: "  containers:",
          note: "your desired containers — the part you actually wrote",
        },
        {
          code: "    - name: web",
        },
        {
          code: "      image: klab/web-app:1.0.0",
        },
        {
          code: "status:",
          note: "you never write status; the KUBELET (and control plane) own all of it",
        },
        {
          code: "  phase: Running",
          note: "kubelet reports the observed lifecycle phase",
        },
        {
          code: "  hostIP: 10.0.0.7",
          note: "the IP of node-1, where the Pod landed",
        },
        {
          code: "  podIP: 10.244.1.15",
          note: "assigned when the kubelet sets up the Pod's network sandbox (via the CNI)",
        },
        {
          code: "  conditions:",
        },
        {
          code: "    - type: Ready",
        },
        {
          code: '      status: "True"',
          note: "kubelet flips Ready based on the readiness probe result",
        },
      ],
    },
    {
      type: "heading",
      id: "object-lifecycle",
      text: "Watch the object fill in, stage by stage",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "The same Pod at three points in the pipeline",
      stages: [
        {
          label: "What you submit",
          note: "Your manifest carries only intent: a name and the containers you want. No node, no status. At this instant the Pod exists in etcd but is Pending.",
          code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0",
        },
        {
          label: "After the scheduler",
          note: "The scheduler chose node-1 and wrote spec.nodeName. Still Pending — nothing has started yet — but the Pod now belongs to a node.",
          code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  nodeName: node-1\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0",
        },
        {
          label: "After the kubelet",
          note: "The kubelet on node-1 started the container and reported status. The object now records reality: Running, with an IP and a Ready condition.",
          code: 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  nodeName: node-1\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\nstatus:\n  phase: Running\n  podIP: 10.244.1.15\n  conditions:\n    - type: Ready\n      status: "True"',
        },
      ],
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a Pod that never runs",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "This Pod was accepted by the API server, but it stays Pending forever and never lands on a node. The cluster has healthy nodes named node-1 and node-2. What's wrong?",
      code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  nodeName: node-9\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0",
      answer:
        "spec.nodeName is hard-coded to node-9, which doesn't exist. Setting nodeName yourself bypasses the scheduler and binds the Pod directly to that name — but no kubelet is running as node-9, so nothing ever picks the Pod up and it stays Pending. Remove nodeName and let the scheduler choose a real node (or use nodeSelector/affinity to influence the choice).",
    },
    {
      type: "heading",
      id: "pin-it",
      text: "Pin a Pod the right way",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "A teammate wants a Pod to run only on SSD-backed nodes, without hard-coding a node name. Write a Pod that the scheduler will place only on nodes labeled disktype: ssd.",
      hint: "Use spec.nodeSelector with the label, and leave nodeName unset so the scheduler still does the placement — it just restricts itself to matching nodes.",
      solution:
        "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  nodeSelector:\n    disktype: ssd\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0",
    },
    {
      type: "heading",
      id: "which-component",
      text: "Which component do I blame?",
    },
    {
      type: "decisionTable",
      title: "Symptom to suspect",
      columns: ["What it owns", "Suspect it when"],
      rows: [
        {
          label: "kube-apiserver",
          cells: [
            "Admitting and serving all API requests",
            "kubectl hangs or returns 5xx; nothing can be read or written at all",
          ],
        },
        {
          label: "etcd",
          cells: [
            "Persisting cluster state",
            "The API server is up but slow or read-only, or changes don't persist",
          ],
        },
        {
          label: "kube-scheduler",
          cells: [
            "Choosing a node for each Pod",
            "Pods sit Pending with an empty nodeName and no scheduling events",
          ],
        },
        {
          label: "kube-controller-manager",
          cells: [
            "Creating and replacing objects",
            "A Deployment never creates Pods, or deleted Pods are not replaced",
          ],
        },
        {
          label: "kubelet",
          cells: [
            "Starting containers and reporting status",
            "A Pod has a nodeName but containers never start or status is stale",
          ],
        },
        {
          label: "kube-proxy",
          cells: [
            "Programming Service routing on the node",
            "Pods are Running but a Service ClusterIP is unreachable",
          ],
        },
      ],
    },
    { type: "mission", missionSlug: "foundations/cluster-architecture" },
    {
      type: "takeaways",
      items: [
        "The control plane decides (apiserver, etcd, scheduler, controllers); nodes do the work (kubelet, kube-proxy, runtime).",
        "The API server is the only component that touches etcd — everything else watches and writes through the API.",
        "A request flows apiserver + etcd -> controllers expand it -> scheduler assigns a node -> kubelet runs it and reports status.",
        "You own spec.containers; the scheduler owns spec.nodeName; the kubelet owns the whole status block.",
        "Match a symptom to the component that owns that step: Pending with no node points at the scheduler, not the kubelet.",
      ],
    },
    {
      type: "quiz",
      id: "cluster-architecture-q1",
      question: "Which component writes Pod health and container state back to the API server?",
      options: [
        {
          id: "a",
          text: "kubelet",
          correct: true,
          explanation:
            "The kubelet runs on each node and reports the observed Pod status, including phase and Ready conditions.",
        },
        {
          id: "b",
          text: "etcd",
          correct: false,
          explanation: "etcd stores data but does not run Pods, execute probes, or report status.",
        },
        {
          id: "c",
          text: "kubectl",
          correct: false,
          explanation:
            "kubectl is a client; it submits desired state and does not reconcile or report cluster status.",
        },
      ],
    },
    {
      type: "quiz",
      id: "cluster-architecture-q2",
      question:
        "A Pod has been Pending for minutes with an empty spec.nodeName. Which component is most likely at fault?",
      options: [
        {
          id: "a",
          text: "The kube-scheduler could not (or did not) assign a node.",
          correct: true,
          explanation:
            "Assigning a node is the scheduler's job. An empty nodeName means the Pod was never bound — check for unschedulable resources, taints, or a scheduler that is down.",
        },
        {
          id: "b",
          text: "The kubelet failed to pull the image.",
          correct: false,
          explanation:
            "The kubelet only acts after a node is assigned. With an empty nodeName, no kubelet has even claimed the Pod yet.",
        },
        {
          id: "c",
          text: "etcd rejected the write.",
          correct: false,
          explanation:
            "If etcd had rejected the write the Pod would not exist at all; a stored Pending Pod means it was persisted successfully.",
        },
      ],
    },
  ],
  labs: [],
};

const desiredVsActual: DocsLesson = {
  slug: ["foundations", "desired-vs-actual-state"],
  title: "Desired State vs Actual State",
  description:
    "Kubernetes is declarative: you describe what you want, and the control plane works to make reality match.",
  section: "Foundations",
  order: 2,
  concepts: ["reconciliation", "pods", "deployments"],
  content: [
    {
      type: "heading",
      id: "declarative-model",
      text: "You declare a wish, not a script",
    },
    {
      type: "paragraph",
      text: 'Kubernetes is declarative. You never tell it "start this container, then attach this volume, then open this port." Instead you submit an object that describes the end state you want, and the cluster figures out the steps. Your job is to keep that description accurate; the platform\'s job is to make the world match it.',
    },
    {
      type: "paragraph",
      text: "Every managed object carries two halves of a story. The spec is what you asked for. The status is what Kubernetes currently observes. The whole system is machinery for driving the gap between those two to zero — and keeping it there.",
    },
    {
      type: "diagram",
      variant: "control-loop",
      title: "The reconciliation control loop",
      caption:
        "Observe actual state, diff it against spec, act to close the gap — forever, not once.",
    },
    {
      type: "heading",
      id: "spec-vs-status",
      text: "spec is your intent, status is reality",
    },
    {
      type: "paragraph",
      text: 'You write metadata and spec. Controllers and the kubelet write status. If you ever find yourself wanting to edit status to "fix" something, stop: status is a readout, not a control. Changing it is like moving the needle on a fuel gauge instead of adding fuel.',
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "One Deployment, both halves of the story",
      caption: "Read spec as the request and status as the receipt.",
      lines: [
        {
          code: "apiVersion: apps/v1",
        },
        {
          code: "kind: Deployment",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: web",
        },
        {
          code: "  namespace: default",
        },
        {
          code: "  generation: 4",
          note: "bumps every time you change spec — the version number of your intent",
        },
        {
          code: "spec:",
          note: "YOU own everything under here: this is desired state",
        },
        {
          code: "  replicas: 3",
          note: "desired: run exactly 3 Pods",
        },
        {
          code: "  selector:",
        },
        {
          code: "    matchLabels:",
        },
        {
          code: "      app: web",
        },
        {
          code: "  template:",
          note: "the Pod blueprint the controller stamps out to reach the desired count",
        },
        {
          code: "    metadata:",
        },
        {
          code: "      labels:",
        },
        {
          code: "        app: web",
        },
        {
          code: "    spec:",
        },
        {
          code: "      containers:",
        },
        {
          code: "        - name: web",
        },
        {
          code: "          image: klab/web-app:1.0.0",
        },
        {
          code: "status:",
          note: "KUBERNETES owns everything under here: this is observed actual state",
        },
        {
          code: "  replicas: 3",
          note: "observed: 3 Pods currently exist",
        },
        {
          code: "  readyReplicas: 2",
          note: "observed: only 2 are passing readiness right now — a live gap vs desired",
        },
        {
          code: "  updatedReplicas: 3",
        },
        {
          code: "  observedGeneration: 4",
          note: "the spec generation the controller has actually acted on; if this lags metadata.generation, your change hasn't been processed yet",
        },
        {
          code: "  conditions:",
        },
        {
          code: "    - type: Available",
        },
        {
          code: '      status: "True"',
          note: "a rolled-up verdict computed from observed state — you never set this by hand",
        },
      ],
    },
    {
      type: "concept",
      term: "Reconciliation loop",
      definition:
        "A controller's core routine: read the current actual state, diff it against the desired spec, take the smallest actions to close the gap, then repeat. It is level-triggered — it looks at where things ARE, not at a queue of past events — so a missed signal simply gets corrected on the next pass.",
    },
    {
      type: "heading",
      id: "build-the-spec",
      text: "Build the desired state in stages",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "A Deployment spec grows in three steps",
      stages: [
        {
          label: "Skeleton",
          note: "The minimum valid object: kind, a name, and an empty spec. It declares almost nothing, so the controller has nothing to create yet.",
          code: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec: {}",
        },
        {
          label: "Declare the count and how to find Pods",
          note: "Now you state the desired number of Pods and the label the controller uses to recognize the Pods it owns. The selector is how actual is matched back to desired.",
          code: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: web",
        },
        {
          label: "Add the Pod template",
          note: "The template is the blueprint stamped out to reach the count. With replicas, selector, and template all present, the controller can now drive actual state toward 3 running Pods.",
          code: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: web\n          image: klab/web-app:1.0.0",
        },
      ],
    },
    {
      type: "callout",
      tone: "key",
      title: "Change the spec, not the live objects",
      text: "To change what the cluster does, edit the spec of the owning object and apply. Do not hand-edit the Pods a controller created — the controller owns them and will reconcile your change away. The spec is the single source of truth; live objects are just its current shadow.",
    },
    {
      type: "heading",
      id: "drift-and-self-healing",
      text: "Drift and self-healing",
    },
    {
      type: "paragraph",
      text: "Drift is any gap that opens between actual and desired state: a node dies and takes Pods with it, someone deletes a Pod by hand, a container crashes. Because the loop runs continuously, drift is self-correcting. Delete one of the 3 web Pods and within moments the controller notices replicas dropped to 2, then creates a replacement to get back to 3. Nobody paged anyone; the loop just did its job.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Self-healing cuts both ways",
      text: "The loop enforces the spec even when the spec is what's wrong. If you deploy a broken image, Kubernetes will faithfully keep trying to run it, restarting the crashing Pods forever. Self-healing restores desired state — it does not judge whether your desired state is a good idea.",
    },
    {
      type: "compare",
      caption: "Both aim to run 5 Pods. Only one survives the next reconcile pass.",
      left: {
        title: "Declare intent (durable)",
        code: "# edit the owning object's spec\nkubectl scale deploy/web --replicas=5\n# or edit spec.replicas and re-apply\n# the controller reconciles to 5 and holds",
      },
      right: {
        title: "Poke live objects (reverted)",
        code: '# create Pods by hand to "add capacity"\nkubectl run web-extra --image=klab/web-app:1.0.0\n# not owned by the Deployment, not in its spec\n# → an orphan; the count still says 3, no self-heal',
      },
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a manifest that never scales",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "This Deployment was meant to run 4 replicas, but after applying it only ever runs 1. The YAML is valid and the image is fine. What went wrong?",
      code: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec:\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: web\n          image: klab/web-app:1.0.0\nstatus:\n  replicas: 4",
      answer:
        "The desired count was written under status instead of spec. status is observed output owned by Kubernetes — the API server ignores (strips) what you put there, so it never becomes intent. With no spec.replicas, the Deployment defaults to 1 and the loop dutifully holds it at 1. Fix: move replicas: 4 up under spec, and delete the status block entirely.",
    },
    {
      type: "heading",
      id: "try-it",
      text: "Try it: watch a gap close",
    },
    {
      type: "paragraph",
      text: "Open the lab below. Change spec.replicas from 3 to 5 and apply. Watch status.readyReplicas climb as the controller creates Pods until actual state matches your declared intent — then try deleting a Pod and watch it come back.",
    },
    {
      type: "lab",
      labId: "replicas",
    },
    {
      type: "heading",
      id: "author-it",
      text: "Author a spec yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Write a Deployment named api that declares a desired state of 2 replicas, selects Pods labeled app: api, and runs the container image klab/web-app:1.0.0. Put every field where its owner belongs.",
      hint: "You only author metadata and spec. Never write a status block — Kubernetes fills that in. spec needs replicas, selector.matchLabels, and a template whose Pod labels match the selector.",
      solution:
        "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: api\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: api\n  template:\n    metadata:\n      labels:\n        app: api\n    spec:\n      containers:\n        - name: api\n          image: klab/web-app:1.0.0",
    },
    {
      type: "heading",
      id: "spec-or-live",
      text: "Change the spec, or touch a live object?",
    },
    {
      type: "decisionTable",
      title: "What to change for a given goal",
      columns: ["What to change", "Why"],
      rows: [
        {
          label: "Run more (or fewer) Pods",
          cells: [
            "spec.replicas on the owning object",
            "The loop creates or removes Pods to match, and holds the new count",
          ],
        },
        {
          label: "Ship a new image version",
          cells: [
            "spec.template image, then apply",
            "Triggers a managed rollout; status.observedGeneration tracks progress",
          ],
        },
        {
          label: "A single Pod is wedged",
          cells: [
            "Delete that Pod (kubectl delete pod)",
            "The controller recreates it from the same spec — a safe, deliberate self-heal",
          ],
        },
        {
          label: "status shows readyReplicas 2/3",
          cells: [
            "Nothing in status — investigate the lagging Pod",
            "status is a readout; editing it changes no reality, only the diagnosis matters",
          ],
        },
      ],
    },
    { type: "mission", missionSlug: "foundations/desired-vs-actual-state" },
    {
      type: "heading",
      id: "takeaways",
      text: "Takeaways",
    },
    {
      type: "takeaways",
      items: [
        "Kubernetes is declarative: you submit desired state (spec) and the platform converges reality to it.",
        "spec is intent you write; status is observed reality Kubernetes writes — never hand-edit status to fix things.",
        "Controllers run a continuous reconciliation loop: observe, diff, act, repeat. It is level-triggered, so it self-corrects.",
        "Drift closes automatically — delete a Pod and it comes back — but self-healing enforces even a bad spec.",
        "To change behavior, edit the owning object's spec; poking controller-owned live objects gets reconciled away.",
      ],
    },
    {
      type: "quiz",
      id: "desired-q1",
      question: "A Deployment says replicas: 5, but only 3 Pods exist. What should happen next?",
      options: [
        {
          id: "a",
          text: "The controller creates 2 more Pods.",
          correct: true,
          explanation:
            "The Deployment and ReplicaSet controllers reconcile actual replicas toward the desired count of 5.",
        },
        {
          id: "b",
          text: "kubectl must manually start 2 containers.",
          correct: false,
          explanation:
            "kubectl only submits desired state; controllers do the ongoing work of closing the gap.",
        },
        {
          id: "c",
          text: "The Service changes its selector.",
          correct: false,
          explanation: "Services route traffic but do not create workload replicas.",
        },
        {
          id: "d",
          text: "Nothing, until you restart the Deployment.",
          correct: false,
          explanation:
            "The loop runs continuously; no restart is needed for reconciliation to act.",
        },
      ],
    },
    {
      type: "quiz",
      id: "desired-q2",
      question:
        "You edit a running Pod that a Deployment created, changing its image directly with kubectl edit. Minutes later the change is gone. Why?",
      options: [
        {
          id: "a",
          text: "The Pod is owned by the Deployment, whose spec is unchanged, so the controller reconciled it back.",
          correct: true,
          explanation:
            "Live objects are the shadow of the spec. The desired state still says the old image, so the loop restores it. Change the Deployment's spec.template instead.",
        },
        {
          id: "b",
          text: "kubectl edit never actually saves changes to Pods.",
          correct: false,
          explanation:
            "The edit was saved — it was then overwritten by reconciliation because it conflicted with the owner's spec.",
        },
        {
          id: "c",
          text: "Editing a Pod deletes the Deployment.",
          correct: false,
          explanation:
            "Editing a child Pod does not remove its owner; the owner is exactly what reverts the change.",
        },
        {
          id: "d",
          text: "Status fields are read-only, so the image can't change.",
          correct: false,
          explanation:
            "image lives in spec, not status; the revert is about ownership and reconciliation, not field permissions.",
        },
      ],
    },
  ],
  labs: [
    {
      id: "replicas",
      title: "Play with replicas",
      prompt: "Edit the Deployment replica count and watch Kubernetes reconcile the live cluster.",
      files: [{ path: "deployment.yaml", language: "yaml", initialValue: WEB_DEPLOYMENT }],
      initialManifests: [],
      registeredImages: [WEB_IMAGE],
      tryChanging: "Try setting replicas to 5, then apply changes.",
      tasks: ["Find spec.replicas.", "Change the number.", "Apply and watch Pods appear."],
      commands: ["kubectl get deployments", "kubectl get pods"],
      debrief:
        "The Deployment owns a ReplicaSet, and the ReplicaSet creates or removes Pods until the requested replica count is reached.",
    },
  ],
};

const apiObjects: DocsLesson = {
  slug: ["foundations", "api-objects"],
  title: "API Objects",
  description:
    "Every Kubernetes resource is an API object with metadata, spec, and usually status.",
  section: "Foundations",
  order: 3,
  concepts: ["pods", "labels-selectors", "debugging"],
  content: [
    {
      type: "heading",
      id: "why-api-objects",
      text: "Everything is an API object",
    },
    {
      type: "paragraph",
      text: "Kubernetes has no special-case commands. A Pod, a Service, a Deployment, a ConfigMap, a Node — all of them are just records in one REST API, stored in etcd, and shaped the same way. Once you can read one object, you can read them all, because every object shares the same five top-level fields.",
    },
    {
      type: "diagram",
      variant: "api-object",
      title: "Object anatomy",
      caption:
        "apiVersion + kind say what type it is; metadata identifies it; spec is your intent; status is Kubernetes reporting reality.",
    },
    {
      type: "heading",
      id: "object-anatomy",
      text: "The five top-level fields",
    },
    {
      type: "paragraph",
      text: "Read any manifest through five lenses. apiVersion and kind together name the type (the API server uses them to route the request). metadata carries identity — name, namespace, labels, annotations. spec is the desired state you declare. status is the observed state controllers write back. You author the first four; you never write status.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "One object, all five fields",
      caption: "A Deployment shows every top-level field, including a meaningful status.",
      lines: [
        {
          code: "apiVersion: apps/v1",
          note: "group + version: 'apps' group, version 'v1'. Together with kind this selects the REST endpoint.",
        },
        {
          code: "kind: Deployment",
          note: "the resource type. apiVersion + kind = the GroupVersionKind (GVK) that addresses this object.",
        },
        {
          code: "metadata:",
          note: "IDENTITY: who this object is. Name is required; namespace, labels, and annotations live here.",
        },
        {
          code: "  name: web",
        },
        {
          code: "  namespace: default",
        },
        {
          code: "  labels:",
          note: "queryable identity — selectors and controllers match on these key:value pairs.",
        },
        {
          code: "    app: web",
        },
        {
          code: "spec:",
          note: "INTENT: the desired state YOU declare. Kubernetes' job is to make reality match this.",
        },
        {
          code: "  replicas: 3",
          note: "you want three Pods running.",
        },
        {
          code: "  selector:",
        },
        {
          code: "    matchLabels:",
        },
        {
          code: "      app: web",
        },
        {
          code: "  template:",
          note: "the Pod spec the Deployment stamps out for each replica.",
        },
        {
          code: "    metadata:",
        },
        {
          code: "      labels:",
        },
        {
          code: "        app: web",
        },
        {
          code: "    spec:",
        },
        {
          code: "      containers:",
        },
        {
          code: "        - name: web",
        },
        {
          code: "          image: klab/web-app:1.0.0",
        },
        {
          code: "status:",
          note: "OBSERVED: written by the controller, never by you. If you put it in a manifest it is ignored.",
        },
        {
          code: "  replicas: 3",
        },
        {
          code: "  readyReplicas: 3",
          note: "reality caught up with spec.replicas — the Deployment is healthy.",
        },
        {
          code: "  conditions:",
        },
        {
          code: "    - type: Available",
          note: "controllers report health as conditions, not just counts.",
        },
        {
          code: '      status: "True"',
        },
      ],
    },
    {
      type: "heading",
      id: "spec-vs-status",
      text: "spec is intent, status is reality",
    },
    {
      type: "compare",
      caption:
        "You write the left side and apply it. Kubernetes writes the right side as it observes the cluster. Drift between them is the whole game of reconciliation.",
      left: {
        title: "spec (you declare)",
        code: "spec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: web",
      },
      right: {
        title: "status (Kubernetes reports)",
        code: 'status:\n  replicas: 3\n  readyReplicas: 2\n  conditions:\n    - type: Available\n      status: "False"',
      },
    },
    {
      type: "callout",
      tone: "key",
      title: "Never write status",
      text: "status is a read-only projection of reality maintained by controllers and the kubelet. Any status you type into a manifest is discarded on apply. When something is wrong, spec is your question and status is Kubernetes' answer — compare the two before you touch anything else.",
    },
    {
      type: "heading",
      id: "build-it",
      text: "Build an object from nothing",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "An object grows in three stages",
      stages: [
        {
          label: "Identity (type + name)",
          note: "The minimum that addresses an object: apiVersion + kind name the type, metadata.name names the instance. This alone is a valid, findable object — it just does nothing yet.",
          code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web",
        },
        {
          label: "Declare intent (spec)",
          note: "Add spec — the desired state. Now the object asks Kubernetes for one container running the web image. The kubelet will try to make this real.",
          code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0",
        },
        {
          label: "Status appears (you didn't write it)",
          note: "After you apply, the kubelet reports back. status.phase and podIP show up on their own — proof that status is observed, not authored.",
          code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\nstatus:\n  phase: Running\n  podIP: 10.1.0.7",
        },
      ],
    },
    {
      type: "heading",
      id: "api-groups",
      text: "API groups and versions",
    },
    {
      type: "concept",
      term: "GroupVersionKind (GVK)",
      definition:
        "The triple that uniquely identifies a resource type: group (e.g. apps), version (e.g. v1), and kind (e.g. Deployment). apiVersion in a manifest is the group and version joined by a slash; the core group has an empty name, so its apiVersion is just 'v1'.",
    },
    {
      type: "decisionTable",
      title: "apiVersion for common kinds",
      columns: ["Kind", "apiVersion", "API group"],
      rows: [
        {
          label: "Pod",
          cells: ["Pod", "v1", "core (empty group name)"],
        },
        {
          label: "Service",
          cells: ["Service", "v1", "core"],
        },
        {
          label: "ConfigMap",
          cells: ["ConfigMap", "v1", "core"],
        },
        {
          label: "Deployment",
          cells: ["Deployment", "apps/v1", "apps"],
        },
        {
          label: "ReplicaSet",
          cells: ["ReplicaSet", "apps/v1", "apps"],
        },
        {
          label: "Job",
          cells: ["Job", "batch/v1", "batch"],
        },
        {
          label: "Ingress",
          cells: ["Ingress", "networking.k8s.io/v1", "networking.k8s.io"],
        },
      ],
    },
    {
      type: "callout",
      tone: "info",
      title: "Why the core group looks different",
      text: "The original Kubernetes resources (Pod, Service, ConfigMap, Node) predate API groups, so they live in the unnamed 'core' group. Its apiVersion is bare 'v1' and it is served under /api/v1. Every group added since is named, so its apiVersion carries a group prefix (apps/v1, batch/v1) and it is served under /apis/<group>/<version>.",
    },
    {
      type: "heading",
      id: "kubectl-rest",
      text: "kubectl is just an HTTP client",
    },
    {
      type: "steps",
      title: "What `kubectl get deployment web` actually does",
      items: [
        {
          title: "Resolve the GVR",
          text: "kubectl turns kind Deployment into its group-version-resource: apps/v1/deployments. It learns this by querying the API server's discovery endpoint.",
        },
        {
          title: "Build the URL",
          text: "Named groups are served under /apis; the core group under /api. So this becomes GET /apis/apps/v1/namespaces/default/deployments/web. A Pod would be GET /api/v1/namespaces/default/pods/web.",
        },
        {
          title: "Map the verb to HTTP",
          text: "get -> GET, create -> POST (to the collection), delete -> DELETE, apply -> PATCH (server-side apply). kubectl edit is a GET followed by a PUT of the whole object.",
        },
        {
          title: "Server persists, controllers react",
          text: "The API server validates and defaults the object, writes it to etcd, and returns it. Controllers then watch the change, reconcile spec toward reality, and write status back.",
        },
      ],
    },
    {
      type: "callout",
      tone: "info",
      title: "See the calls yourself",
      text: "Run any command with -v=8 (for example `kubectl get pods -v=8`) and kubectl prints the exact HTTP method, URL, and response for every REST call it makes. It is the fastest way to internalize the object-to-URL mapping.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a broken manifest",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        'This manifest is rejected on apply with: error: unable to recognize "deploy.yaml": no matches for kind "Deployment" in version "v1". Nothing is created. What is wrong?',
      code: "apiVersion: v1\nkind: Deployment\nmetadata:\n  name: web\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: web\n          image: klab/web-app:1.0.0",
      answer:
        "The apiVersion is wrong. Deployment lives in the apps group, so its apiVersion must be apps/v1, not the core 'v1'. There is no Deployment kind in the core group, so the API server cannot resolve the GVK and rejects the object before it is ever stored. Fix: change apiVersion to apps/v1.",
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write one yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Author a minimal but complete ConfigMap named app-config in the default namespace with a single data key GREETING set to hello. Get the apiVersion and kind right.",
      hint: "ConfigMap is a core-group resource, so its apiVersion is bare 'v1'. It has no spec — its payload lives under a top-level data field.",
      solution:
        "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: app-config\n  namespace: default\ndata:\n  GREETING: hello",
    },
    {
      type: "lab",
      labId: "object-labels",
    },
    { type: "mission", missionSlug: "foundations/api-objects" },
    {
      type: "heading",
      id: "takeaways",
      text: "Takeaways",
    },
    {
      type: "takeaways",
      items: [
        "Every Kubernetes resource is an API object with the same top-level fields: apiVersion, kind, metadata, spec, and (usually) status.",
        "apiVersion + kind form the GVK that routes your request; metadata identifies the object; spec is your intent; status is Kubernetes' observed reality.",
        "You author apiVersion, kind, metadata, and spec. You never write status — controllers do.",
        "Core resources (Pod, Service, ConfigMap) use bare 'v1' and /api/v1; named groups (apps/v1, batch/v1) use a group prefix and /apis.",
        "kubectl is just a REST client: it maps an object to a URL and a verb to an HTTP method — run with -v=8 to watch it.",
      ],
    },
    {
      type: "quiz",
      id: "api-object-q1",
      question: "Which field should your application manifest usually edit?",
      options: [
        {
          id: "a",
          text: "status",
          correct: false,
          explanation:
            "Status is written by controllers and the kubelet; anything you put there on apply is discarded.",
        },
        {
          id: "b",
          text: "spec",
          correct: true,
          explanation:
            "Spec is the desired state you declare — the one part of the object you are meant to author.",
        },
        {
          id: "c",
          text: "managedFields",
          correct: false,
          explanation: "managedFields tracks field ownership metadata; it is not the app's intent.",
        },
      ],
    },
    {
      type: "quiz",
      id: "api-object-q2",
      question: "Which REST path does `kubectl get deployment web -n default` hit?",
      options: [
        {
          id: "a",
          text: "GET /api/v1/namespaces/default/deployments/web",
          correct: false,
          explanation:
            "/api/v1 serves only the core group. Deployment is in the apps group, so it is not reachable there.",
        },
        {
          id: "b",
          text: "GET /apis/apps/v1/namespaces/default/deployments/web",
          correct: true,
          explanation:
            "Named groups are served under /apis/<group>/<version>, so apps/v1 Deployments live at /apis/apps/v1/....",
        },
        {
          id: "c",
          text: "GET /apis/v1/deployments/web",
          correct: false,
          explanation:
            "This drops the group name and the namespace scoping — it is not a valid resource path.",
        },
      ],
    },
  ],
  labs: [
    {
      id: "object-labels",
      title: "Edit an object's labels",
      prompt:
        "Change metadata.labels.app from web to frontend and apply. The Pod is recreated with the new declared metadata.",
      files: [{ path: "pod.yaml", language: "yaml", initialValue: WEB_POD }],
      initialManifests: [],
      registeredImages: [WEB_IMAGE],
      tryChanging: "Change metadata.labels.app to frontend.",
      tasks: [
        "Edit metadata.labels.",
        "Apply the manifest.",
        "Notice the object keeps the shape you declared.",
      ],
      commands: ["kubectl get pod web -o yaml"],
      debrief:
        "Labels are metadata used by selectors. Changing them changes which Services or controllers can match the object.",
    },
  ],
};

const labelsAnnotationsOwnership: DocsLesson = {
  slug: ["foundations", "labels-annotations-ownership"],
  title: "Labels, Annotations & Ownership",
  description:
    "Learn the metadata model behind selectors, routing, controller ownership, garbage collection, and safe automation.",
  section: "Foundations",
  order: 4,
  concepts: ["labels-selectors", "annotations", "owners-gc", "reconciliation"],
  content: [
    {
      type: "heading",
      id: "metadata-drives-control",
      text: "Metadata drives control",
    },
    {
      type: "paragraph",
      text: "Every Kubernetes object carries a metadata block, and three fields inside it quietly run the cluster. Labels are queryable identity: Services, ReplicaSets, Jobs, and NetworkPolicies find their targets by matching labels, not names. Annotations are non-identifying data: arbitrary key/value context for tools and humans that Kubernetes never selects on. Owner references wire generated objects back to the controller that created them, which is how a single delete cascades through a whole object tree. Get these three right and selection, routing, and cleanup all fall into place; get them wrong and a healthy Pod can sit invisible to the Service that is supposed to route to it.",
    },
    {
      type: "diagram",
      variant: "api-object",
      title: "Metadata that changes behavior",
      caption:
        "Labels participate in selection. Annotations describe. Owner references model parent-child control and drive garbage collection.",
    },
    {
      type: "heading",
      id: "labels-vs-annotations",
      text: "Labels vs annotations",
    },
    {
      type: "paragraph",
      text: "The single most useful question you can ask about a piece of metadata is: does anything need to SELECT on this? If yes, it is a label. If it is just context that rides along with the object, it is an annotation. Labels are constrained on purpose so selection stays cheap and indexable; annotations are deliberately unconstrained so they can hold large, structured, tool-specific payloads.",
    },
    {
      type: "decisionTable",
      title: "Labels vs annotations at a glance",
      columns: ["Labels", "Annotations"],
      rows: [
        {
          label: "Purpose",
          cells: [
            "Identify and group objects so they can be selected",
            "Attach non-identifying context for tools and humans",
          ],
        },
        {
          label: "Selectable",
          cells: [
            "Yes — Services, controllers, kubectl -l, NetworkPolicies",
            "No — never used for selection or routing",
          ],
        },
        {
          label: "Size and charset",
          cells: [
            "Value <= 63 chars, restricted charset ([a-z0-9A-Z-_.]), optional DNS prefix",
            "No per-key size limit; ~256 KB total metadata; any UTF-8 string",
          ],
        },
        {
          label: "Typical examples",
          cells: [
            "app, tier, release, environment, app.kubernetes.io/name",
            "runbook URLs, checksum/config, last-applied-configuration, sidecar config",
          ],
        },
      ],
    },
    {
      type: "compare",
      caption:
        "Same object, two jobs: labels are what Kubernetes matches on; annotations are what humans and tools read.",
      left: {
        title: "labels — identifying",
        code: "metadata:\n  labels:\n    app: web\n    tier: frontend\n    release: canary",
      },
      right: {
        title: "annotations — non-identifying",
        code: "metadata:\n  annotations:\n    runbook: https://wiki/web-oncall\n    owner: platform-team\n    checksum/config: 9f2b1c4e",
      },
    },
    {
      type: "heading",
      id: "the-metadata-block",
      text: "Anatomy of a metadata block",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "One metadata block, all three roles",
      caption: "Labels select, annotations describe, ownerReferences establish control.",
      lines: [
        {
          code: "metadata:",
        },
        {
          code: "  name: web-7d9f-abcde",
          note: "identity within a namespace — controllers generate this suffix, you rarely type it",
        },
        {
          code: "  namespace: default",
        },
        {
          code: "  labels:",
          note: "IDENTIFYING — the only metadata selectors can match on",
        },
        {
          code: "    app: web",
          note: "the key a Service selector and the ReplicaSet both match against",
        },
        {
          code: "    tier: frontend",
          note: "groups by role for dashboards and set-based selectors",
        },
        {
          code: "    app.kubernetes.io/managed-by: helm",
          note: "a recommended prefixed label; the prefix is a DNS subdomain and does not count toward the 63-char value limit",
        },
        {
          code: "  annotations:",
          note: "NON-identifying — free-form, never selected, can be large",
        },
        {
          code: '    kubectl.kubernetes.io/last-applied-configuration: \'{"apiVersion":"v1",...}\'',
          note: "written by kubectl apply so it can compute a 3-way diff; pure context, never a selector target",
        },
        {
          code: "    checksum/config: 9f2b1c4e",
          note: "a config hash — changing it forces the template to differ so a rollout triggers",
        },
        {
          code: "  ownerReferences:",
          note: "links this object to its parent for garbage collection",
        },
        {
          code: "    - apiVersion: apps/v1",
        },
        {
          code: "      kind: ReplicaSet",
          note: "the KIND of the parent — here a Pod is owned by a ReplicaSet",
        },
        {
          code: "      name: web-7d9f",
        },
        {
          code: "      uid: 2b1c9e77-...",
          note: "the parent's UID; GC uses the UID, not the name, so a recreated parent does not adopt orphans",
        },
        {
          code: "      controller: true",
          note: "marks this owner as THE managing controller (at most one per object)",
        },
        {
          code: "      blockOwnerDeletion: true",
          note: "foreground deletion of the parent waits until this child is gone first",
        },
      ],
    },
    {
      type: "heading",
      id: "build-metadata",
      text: "Build the metadata up",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "Metadata grows in three steps",
      stages: [
        {
          label: "Bare identity",
          note: "A name and namespace make the object addressable, but nothing can select it yet and nothing owns it.",
          code: "metadata:\n  name: web\n  namespace: default",
        },
        {
          label: "Add labels for selection",
          note: "Now a Service selector like app: web can find this object, and controllers can group it. Labels are the first thing that makes an object participate in the cluster.",
          code: "metadata:\n  name: web\n  namespace: default\n  labels:\n    app: web\n    tier: frontend",
        },
        {
          label: "Add annotations and ownership",
          note: "Annotations carry context that must never affect selection; ownerReferences record who created it so cleanup cascades. This is what a controller-managed object actually looks like.",
          code: "metadata:\n  name: web\n  namespace: default\n  labels:\n    app: web\n    tier: frontend\n  annotations:\n    runbook: https://wiki/web-oncall\n  ownerReferences:\n    - apiVersion: apps/v1\n      kind: ReplicaSet\n      name: web-7d9f\n      uid: 2b1c9e77-...\n      controller: true",
        },
      ],
    },
    {
      type: "heading",
      id: "label-selectors",
      text: "Selecting with labels",
    },
    {
      type: "paragraph",
      text: "A selector is a query over labels, and Kubernetes supports two flavors. Equality-based selectors match exact key/value pairs (app=web, tier!=cache) — this is what a Service's spec.selector uses. Set-based selectors match membership (environment in (prod, qa)), exclusion (tier notin (cache)), and key existence (partition, or !partition for absence) — used by Deployments, kubectl -l, and NetworkPolicies. Multiple requirements are ANDed together, so every clause must hold for an object to match.",
    },
    {
      type: "code",
      language: "markdown",
      code: "# equality-based (Service spec.selector, kubectl)\nkubectl get pods -l app=web,tier=frontend\nkubectl get pods -l tier!=cache\n\n# set-based (Deployment matchExpressions, kubectl -l)\nkubectl get pods -l 'environment in (prod, qa)'\nkubectl get pods -l 'tier notin (cache)'\nkubectl get pods -l 'partition'      # key exists\nkubectl get pods -l '!partition'     # key absent",
    },
    {
      type: "callout",
      tone: "key",
      title: "A selector is AND, and it is exact",
      text: "Every clause in a selector must match for an object to be selected, and matching is exact — key AND value, character for character. Extra labels on the object are ignored, but a single typo, a value in annotations instead of labels, or a case mismatch means zero matches. When a Service shows zero endpoints, compare its spec.selector against the Pod's metadata.labels first.",
    },
    {
      type: "heading",
      id: "ownership-and-gc",
      text: "Ownership and garbage collection",
    },
    {
      type: "paragraph",
      text: "You create a Deployment; you never create the Pods. The Deployment controller creates a ReplicaSet, and the ReplicaSet creates Pods, stamping each child with an ownerReference back to its parent. This tree is what the garbage collector walks: delete the Deployment and the collector removes the ReplicaSet it owns, which removes the Pods that ReplicaSet owns. Nothing is deleted by name-guessing — the collector follows ownerReference UIDs. An object whose every owner is gone becomes garbage and is collected automatically.",
    },
    {
      type: "diagram",
      variant: "workload-hierarchy",
      title: "Deployment to ReplicaSet to Pod",
      caption:
        "Each level owns the one below via ownerReferences. Deleting the top cascades cleanup all the way down.",
    },
    {
      type: "concept",
      term: "ownerReference",
      definition:
        "A pointer in a child's metadata.ownerReferences naming a parent by apiVersion, kind, name, and uid. controller: true marks the single managing owner. The garbage collector deletes a child once all its owners are gone, which is why cascading delete works without anyone listing the children explicitly.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Foreground, background, and orphan deletion",
      text: "Background (the kubectl default): the parent is deleted immediately and the collector removes children asynchronously afterward. Foreground (--cascade=foreground): the parent is marked with a deletion timestamp and is not actually removed until every blockOwnerDeletion child is deleted first — useful when order matters. Orphan (--cascade=orphan): the parent is deleted but ownerReferences are stripped from the children, so they keep running with no owner. Orphaning a ReplicaSet leaves its Pods live and unmanaged — an easy way to leak workloads.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a broken Pod",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "A Service selecting tier: frontend has zero endpoints, yet this Pod is Ready and clearly meant to back it. What is wrong?",
      code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\n  labels:\n    app: web\n  annotations:\n    tier: frontend\nspec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0",
      answer:
        "tier: frontend is under annotations, not labels. Selectors only match labels, and annotations are never selected on, so the selector tier: frontend matches nothing and the EndpointSlice controller publishes zero endpoints. Move tier: frontend up into metadata.labels (the Pod can keep app: web too — extra labels are ignored by the selector).",
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write it yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Write the metadata block for a Pod that: (1) is selectable by a Service using app: web AND tier: frontend, (2) records a runbook URL that must NOT affect selection, and (3) is owned by a ReplicaSet named web-rs (uid abc-123) as its managing controller.",
      hint: "Selectable attributes go under labels; context-only data goes under annotations; the parent link goes under ownerReferences with controller: true.",
      solution:
        "metadata:\n  name: web-7d9f-abcde\n  namespace: default\n  labels:\n    app: web\n    tier: frontend\n  annotations:\n    runbook: https://wiki/web-oncall\n  ownerReferences:\n    - apiVersion: apps/v1\n      kind: ReplicaSet\n      name: web-rs\n      uid: abc-123\n      controller: true",
    },
    { type: "mission", missionSlug: "foundations/labels-annotations-ownership" },
    { type: "lab", labId: "ownership-gc" },
    {
      type: "takeaways",
      items: [
        "Ask one question: does anything need to select on this? Yes means label; no means annotation.",
        "Selectors are ANDed and exact — one wrong key, value, or a value stranded in annotations means zero matches.",
        "Set-based selectors add in, notin, and existence (key / !key); equality selectors match exact key=value.",
        "ownerReferences build the Deployment to ReplicaSet to Pod tree that garbage collection walks by UID.",
        "Background delete cleans up asynchronously, foreground waits for children, orphan strips ownership and leaks live workloads.",
      ],
    },
    {
      type: "quiz",
      id: "metadata-q1",
      question: "A Service is not routing to a Pod. Which metadata should you compare first?",
      options: [
        {
          id: "a",
          text: "The Service selector and the Pod labels.",
          correct: true,
          explanation:
            "Services select Pods by matching labels exactly. A name match is not enough, and annotations are never consulted.",
        },
        {
          id: "b",
          text: "Only the Pod's annotations.",
          correct: false,
          explanation:
            "Annotations are non-identifying and are never used for selection or routing.",
        },
        {
          id: "c",
          text: "Only the ownerReferences.",
          correct: false,
          explanation:
            "Ownership explains the control hierarchy and garbage collection, not Service membership.",
        },
      ],
    },
    {
      type: "quiz",
      id: "gc-q1",
      question:
        "You run kubectl delete deployment web with the default cascade policy. What happens to its ReplicaSets and Pods?",
      options: [
        {
          id: "a",
          text: "The garbage collector deletes the owned ReplicaSets and Pods asynchronously in the background.",
          correct: true,
          explanation:
            "Background is the kubectl default: the Deployment is removed immediately and the collector follows ownerReferences to clean up children afterward.",
        },
        {
          id: "b",
          text: "The ReplicaSets and Pods are orphaned and keep running with no owner.",
          correct: false,
          explanation:
            "That is --cascade=orphan, which strips ownerReferences from children. It is not the default.",
        },
        {
          id: "c",
          text: "Nothing is cleaned up; you must delete every Pod by hand.",
          correct: false,
          explanation:
            "Cascading deletion is automatic because children carry ownerReferences pointing back to the Deployment's tree.",
        },
      ],
    },
  ],
  labs: [
    {
      id: "ownership-gc",
      title: "See ownership and garbage collection",
      prompt:
        "Apply a Deployment, follow the ownerReferences chain down to the Pods, then delete the Deployment and watch the ReplicaSet and Pods get garbage-collected.",
      files: [{ path: "deployment.yaml", language: "yaml", initialValue: WEB_DEPLOYMENT }],
      initialManifests: [],
      registeredImages: [WEB_IMAGE],
      tryChanging:
        "Delete the Deployment with kubectl and watch the ReplicaSet and Pods disappear.",
      tasks: [
        "Apply the Deployment.",
        "Describe a Pod and find its ownerReferences.",
        "Delete the Deployment and watch the cascade.",
      ],
      commands: [
        "kubectl get deploy,rs,pods",
        "kubectl describe pod <pod>",
        "kubectl delete deploy web",
      ],
      debrief:
        "Each Pod is owned by the ReplicaSet, which is owned by the Deployment. Deleting an owner triggers cascading garbage collection of everything it owns.",
    },
  ],
};

const declarativeWorkflow: DocsLesson = {
  slug: ["foundations", "declarative-workflow"],
  title: "Declarative Workflow",
  description:
    "Use apply, diff, field ownership, and Kustomize-style overlays to manage Kubernetes safely over time.",
  section: "Foundations",
  order: 5,
  concepts: ["object-management", "kustomize", "debugging"],
  content: [
    {
      type: "heading",
      id: "declare-not-command",
      text: "Declare what you want, not how to get there",
    },
    {
      type: "paragraph",
      text: "There are two ways to talk to Kubernetes. Imperative commands tell the API server to do a specific thing right now: kubectl create, kubectl run, kubectl scale, kubectl edit. Declarative management tells the cluster what the final state should look like and lets controllers work out the steps: you write manifests, then kubectl apply them. The declarative model wins for anything you have to run more than once, because the files become a reviewable, version-controlled source of truth instead of a fading memory of commands you typed.",
    },
    {
      type: "compare",
      caption:
        "The same Deployment, two philosophies. The imperative form is fast to type but leaves no artifact; the declarative form is repeatable and diffable.",
      left: {
        title: "Imperative (do it now)",
        code: "kubectl create deployment web \\\n  --image=klab/web-app:1.0.0 \\\n  --replicas=3\n\nkubectl scale deployment/web --replicas=5\n# state lives only in the cluster",
      },
      right: {
        title: "Declarative (describe the end state)",
        code: "# deployment.yaml, committed to git\nkubectl apply -f deployment.yaml\n\n# bump replicas in the file, then:\nkubectl apply -f deployment.yaml\n# state lives in the file, re-applied safely",
      },
    },
    {
      type: "callout",
      tone: "info",
      title: "apply is create-or-update",
      text: "kubectl apply creates the object if it does not exist and updates it if it does. Running it twice is safe and idempotent — the second run reports 'unchanged' rather than an error. kubectl create, by contrast, errors with AlreadyExists on the second run. That single difference is why apply is the backbone of every GitOps and CI pipeline.",
    },
    {
      type: "heading",
      id: "apply-loop",
      text: "The apply loop",
    },
    {
      type: "paragraph",
      text: "Apply is not a fire-and-forget mutation. It feeds a new desired state into the same reconciliation loop that drives everything else in Kubernetes: the API server records what you want, controllers observe the gap between desired and actual, and they act until the two converge. Your job is to make that desired state deliberate — render it, review the diff, apply it, then verify the real effect.",
    },
    {
      type: "diagram",
      variant: "control-loop",
      title: "apply feeds the reconciliation loop",
      caption:
        "kubectl apply only writes desired state to the API server. Controllers do the work of moving actual state toward it.",
    },
    {
      type: "demo",
      title: "The safe apply loop",
      description:
        "Use this render → diff → apply → verify loop whenever you change objects that matter. The diff step is what turns apply from a leap of faith into a reviewed change.",
      steps: [
        {
          label: "Render",
          detail:
            "Produce the final manifest from your base files and overlays so you review exactly what will be sent.",
          command: "kubectl kustomize overlays/prod",
        },
        {
          label: "Diff",
          detail:
            "Compare the rendered desired state against what is live in the cluster. This mutates nothing.",
          command: "kubectl diff -k overlays/prod",
          output: "spec.replicas:\n-  3\n+  5",
        },
        {
          label: "Apply",
          detail:
            "Submit the desired state. The API server records it and controllers reconcile toward it.",
          command: "kubectl apply -k overlays/prod",
          output: "deployment.apps/web configured",
        },
        {
          label: "Verify",
          detail:
            "A clean apply is not success. Confirm Pods rolled, endpoints are populated, and requests actually work.",
          command: "kubectl rollout status deployment/web",
          output: 'deployment "web" successfully rolled out',
        },
      ],
    },
    {
      type: "heading",
      id: "anatomy",
      text: "A manifest you can apply repeatedly",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A complete, apply-ready Deployment",
      caption:
        "A self-describing manifest — named, labeled, and image-pinned — is the thing you commit to git and apply from CI. Every field is state apply keeps enforcing on each run.",
      lines: [
        {
          code: "apiVersion: apps/v1",
        },
        {
          code: "kind: Deployment",
        },
        {
          code: "metadata:",
          note: "identity apply keys on: name + namespace + kind. Change the name and apply creates a NEW object rather than updating this one.",
        },
        {
          code: "  name: web",
        },
        {
          code: "  namespace: default",
        },
        {
          code: "  labels:",
          note: "labels let selectors, --prune, and dashboards find this object later",
        },
        {
          code: "    app: web",
        },
        {
          code: "spec:",
        },
        {
          code: "  replicas: 3",
          note: "declared desired count. If you kubectl scale imperatively, the next apply resets it back to 3 unless you remove this field.",
        },
        {
          code: "  selector:",
          note: "immutable after creation — apply cannot change it, so get it right the first time",
        },
        {
          code: "    matchLabels:",
        },
        {
          code: "      app: web",
        },
        {
          code: "  template:",
        },
        {
          code: "    metadata:",
          note: "the Pod template; its labels must satisfy the selector above",
        },
        {
          code: "      labels:",
        },
        {
          code: "        app: web",
        },
        {
          code: "    spec:",
        },
        {
          code: "      containers:",
        },
        {
          code: "        - name: web",
        },
        {
          code: "          image: klab/web-app:1.0.0",
          note: "pin an explicit tag — a floating tag like :latest makes applies non-deterministic and defeats diffs",
        },
        {
          code: "          ports:",
        },
        {
          code: "            - containerPort: 8080",
        },
      ],
    },
    {
      type: "heading",
      id: "merge-model",
      text: "How apply merges: client-side vs server-side",
    },
    {
      type: "paragraph",
      text: "Apply has to answer a hard question: given your new file, what should change without clobbering fields someone or something else set? Classic client-side apply solves this with a three-way merge, comparing the last config you applied, the current live object, and the new file. Server-side apply moves that merge into the API server and tracks who owns each field.",
    },
    {
      type: "concept",
      term: "last-applied-configuration (client-side apply)",
      definition:
        "On a client-side apply, kubectl stores the manifest you sent in the annotation kubectl.kubernetes.io/last-applied-configuration and diffs your next file against it to learn which fields YOU manage. A field you dropped from the file is removed; a field a controller added is left alone because it never appeared in your snapshot. This is also why you should apply from the very first run — kubectl create never writes that annotation, so a later apply has no merge base and can mis-handle deletions.",
    },
    {
      type: "concept",
      term: "Field manager (server-side apply)",
      definition:
        "kubectl apply --server-side records field ownership in metadata.managedFields: every field is tagged with the manager (kubectl, a controller, a CI job) that last set it. Two actors can safely own different parts of one object. If your apply tries to set a field another manager owns, the server returns a conflict instead of a silent last-writer-wins overwrite.",
    },
    {
      type: "callout",
      tone: "key",
      title: "Conflicts are a feature, not a nuisance",
      text: "When server-side apply reports a conflict, it is telling you an HPA (or another controller) already owns spec.replicas and your file is fighting it. The right fix is usually to remove that field from your manifest so the controller keeps ownership. Use --force-conflicts only when you deliberately intend to take ownership away.",
    },
    {
      type: "heading",
      id: "prune",
      text: "Pruning: deleting what left the files",
    },
    {
      type: "paragraph",
      text: "Apply adds and updates, but by default it never deletes. If you remove a manifest from your directory, the object it created keeps running — orphaned from your source of truth. kubectl apply --prune closes that gap: it deletes objects that match a label selector but are no longer present in the applied set.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "--prune is scoped by a label selector, and that is the trap",
      text: "kubectl apply --prune -l app=web -f dir/ will delete ANY object carrying app=web that is not in dir/ — including things you never meant to manage from that directory. A too-broad selector has taken out live workloads. Prune only with a narrow, dedicated label, and diff first.",
    },
    {
      type: "heading",
      id: "kustomize",
      text: "Kustomize: one base, many overlays",
    },
    {
      type: "paragraph",
      text: "Copy-pasting a manifest per environment guarantees they drift apart. Kustomize (built into kubectl via -k) keeps one base and layers small, environment-specific overlays on top. The base holds what every environment shares; each overlay patches only what differs — replica counts, images, resource limits.",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "A base plus a prod overlay in three stages",
      stages: [
        {
          label: "Base resource",
          note: "base/deployment.yaml holds the shared, environment-agnostic Deployment. No environment-specific numbers live here.",
          code: "# base/deployment.yaml\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: web\n          image: klab/web-app:1.0.0",
        },
        {
          label: "Base kustomization",
          note: "base/kustomization.yaml just lists the resources it owns. Rendering this base (kubectl kustomize base) emits the Deployment unchanged.",
          code: "# base/kustomization.yaml\napiVersion: kustomize.config.k8s.io/v1beta1\nkind: Kustomization\nresources:\n  - deployment.yaml",
        },
        {
          label: "Prod overlay",
          note: "overlays/prod references the base and patches ONLY what prod changes — here, replicas up to 5. The patch matches the base object by kind + name.",
          code: "# overlays/prod/kustomization.yaml\napiVersion: kustomize.config.k8s.io/v1beta1\nkind: Kustomization\nresources:\n  - ../../base\npatches:\n  - target:\n      kind: Deployment\n      name: web\n    patch: |\n      - op: replace\n        path: /spec/replicas\n        value: 5",
        },
      ],
    },
    {
      type: "heading",
      id: "imperative-vs-declarative",
      text: "Imperative or declarative?",
    },
    {
      type: "decisionTable",
      title: "Imperative vs declarative management",
      columns: ["Command", "Source of truth", "Drift handling", "When to use"],
      rows: [
        {
          label: "Imperative",
          cells: [
            "kubectl create / run / scale / edit",
            "The live cluster object — nothing on disk",
            "Manual: you must remember to re-run and reconcile by hand",
            "Quick experiments, one-off debugging, throwaway resources",
          ],
        },
        {
          label: "Declarative",
          cells: [
            "kubectl apply -f / -k",
            "Version-controlled manifest files",
            "Re-apply the files; diff and prune bring the cluster back in line",
            "Anything durable: production, CI/CD, GitOps, team-owned systems",
          ],
        },
      ],
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Why did the overlay do nothing?",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "An engineer added a prod overlay to raise replicas to 5, applied it with kubectl apply -k overlays/prod, and got 'deployment.apps/web unchanged'. The base Deployment is named web and runs 1 replica. Why is the overlay not taking effect?",
      code: "# overlays/prod/kustomization.yaml\napiVersion: kustomize.config.k8s.io/v1beta1\nkind: Kustomization\nresources:\n  - ../../base\npatches:\n  - target:\n      kind: Deployment\n      name: web-prod\n    patch: |\n      - op: replace\n        path: /spec/replicas\n        value: 5",
      answer:
        "The patch target name is web-prod, but the base Deployment is named web. A patch matches its target by kind + name; since no object named web-prod exists in the rendered base, the patch silently matches nothing and replicas stays at the base value. Fix: set target name to web (or add a namePrefix so the base becomes web-prod). Run kubectl kustomize overlays/prod first to confirm the rendered output actually shows replicas: 5 before applying.",
    },
    {
      type: "heading",
      id: "challenge",
      text: "Author a staging overlay",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Given the base above (Deployment named web, image klab/web-app:1.0.0, replicas 1), write overlays/staging/kustomization.yaml that keeps replicas at 1, deploys into the 'staging' namespace, and pins the image tag to 1.0.0.",
      hint: "Reference ../../base under resources, set namespace: staging, and use an images entry to control the tag. namespace applies to every resource the overlay renders.",
      solution:
        "# overlays/staging/kustomization.yaml\napiVersion: kustomize.config.k8s.io/v1beta1\nkind: Kustomization\nnamespace: staging\nresources:\n  - ../../base\nimages:\n  - name: klab/web-app\n    newTag: 1.0.0",
    },
    { type: "mission", missionSlug: "foundations/declarative-workflow" },
    { type: "lab", labId: "apply-reapply" },
    {
      type: "takeaways",
      items: [
        "Imperative commands mutate the cluster now and leave no artifact; declarative apply enforces files that are your reviewable source of truth.",
        "Always render, diff, apply, then verify — a clean diff proves intent, not that traffic actually works.",
        "Client-side apply diffs against the last-applied-configuration annotation; server-side apply tracks per-field ownership in managedFields and surfaces conflicts.",
        "Apply never deletes by default — use --prune with a narrow label to remove objects that left the files, and treat the selector scope with respect.",
        "Kustomize keeps one base and small per-environment overlays so environments never drift apart.",
      ],
    },
    {
      type: "quiz",
      id: "declarative-workflow-q1",
      question: "Why run kubectl diff before kubectl apply?",
      options: [
        {
          id: "a",
          text: "To preview exactly which fields will change before mutating the cluster.",
          correct: true,
          explanation:
            "diff performs the same merge apply would and shows the resulting changes, catching unintended edits before controllers act.",
        },
        {
          id: "b",
          text: "To restart every node in the cluster.",
          correct: false,
          explanation: "diff is a read-only operation; it never touches nodes.",
        },
        {
          id: "c",
          text: "To bypass the API server and edit etcd directly.",
          correct: false,
          explanation: "diff still goes through the API server and changes nothing.",
        },
      ],
    },
    {
      type: "quiz",
      id: "declarative-workflow-q2",
      question:
        "A server-side apply returns a conflict on spec.replicas, saying another manager owns it. What is usually the right fix?",
      options: [
        {
          id: "a",
          text: "Remove replicas from your manifest so the owning controller (e.g. an HPA) keeps managing it.",
          correct: true,
          explanation:
            "The conflict means a controller already owns that field. Dropping it from your file resolves the fight and respects the autoscaler.",
        },
        {
          id: "b",
          text: "Always pass --force-conflicts so your apply wins.",
          correct: false,
          explanation:
            "Forcing conflicts takes ownership away from the controller and can undo autoscaling; use it only when you deliberately intend to own the field.",
        },
        {
          id: "c",
          text: "Switch to kubectl create so the conflict check is skipped.",
          correct: false,
          explanation:
            "create is not idempotent and abandons apply's merge and ownership tracking entirely — it does not fix the underlying disagreement.",
        },
      ],
    },
  ],
  labs: [
    {
      id: "apply-reapply",
      title: "Apply, edit, re-apply",
      prompt:
        "Apply a Deployment, change its replica count in the manifest, and re-apply to converge the cluster to the new desired state.",
      files: [{ path: "deployment.yaml", language: "yaml", initialValue: WEB_DEPLOYMENT }],
      initialManifests: [],
      registeredImages: [WEB_IMAGE],
      tryChanging: "Change spec.replicas from 3 to 5 and apply again.",
      tasks: [
        "Apply the Deployment.",
        "Edit spec.replicas.",
        "Re-apply and watch the cluster converge.",
      ],
      commands: ["kubectl get deploy", "kubectl get pods"],
      debrief:
        "Declarative apply sends your whole desired manifest; the control plane diffs it against the live object and reconciles. You describe the end state, not the steps to reach it.",
    },
  ],
};

const pods: DocsLesson = {
  slug: ["workloads", "pods"],
  title: "Pods",
  description:
    "A Pod is the smallest schedulable unit in Kubernetes. It wraps one or more containers with shared network and lifecycle.",
  section: "Workloads",
  order: 0,
  concepts: ["pods", "readiness-probes", "logs"],
  content: [
    {
      type: "heading",
      id: "why-pods",
      text: "Why Pods exist",
    },
    {
      type: "paragraph",
      text: "Containers are the unit you build; a Pod is the unit Kubernetes actually schedules and runs. A Pod wraps one or more containers that must live together on the same node, sharing one network identity, one lifecycle, and one set of volumes. You rarely create Pods by hand in production, but every Deployment, StatefulSet, and Job ultimately produces Pods, so a Pod is the object you read when you debug why anything is broken.",
    },
    {
      type: "diagram",
      variant: "pod",
      title: "Pod anatomy",
      caption:
        "One shared network namespace and IP, one or more containers, and volumes the containers can mount.",
    },
    {
      type: "heading",
      id: "shared-context",
      text: "What the containers share",
    },
    {
      type: "paragraph",
      text: "The Pod is a shared context. Every container in a Pod gets the same cluster IP and port space, so they reach each other over localhost and must not claim the same port. They can share volumes for files, and they are scheduled, started, and deleted as one atomic unit. This is why the Pod, not the container, is the smallest thing you can schedule.",
    },
    {
      type: "concept",
      term: "Pod network namespace",
      definition:
        "All containers in a Pod share a single network namespace: one IP address and one localhost. Container A can call container B on 127.0.0.1:PORT, but two containers cannot both bind the same containerPort.",
    },
    {
      type: "heading",
      id: "anatomy",
      text: "Anatomy of a Pod",
    },
    {
      type: "paragraph",
      text: "Read every Pod through four lenses: identity (name, namespace, labels), the container image it runs, the ports it exposes, and the probes that gate its health. The manifest below is the canonical single-container Pod used throughout these labs.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A complete Pod",
      caption: "The klab/web-app image serves /healthz=200 and /=200, but /readyz=404.",
      lines: [
        {
          code: "apiVersion: v1",
        },
        {
          code: "kind: Pod",
        },
        {
          code: "metadata:",
          note: "identity of the object",
        },
        {
          code: "  name: web",
          note: "unique within the namespace",
        },
        {
          code: "  namespace: default",
        },
        {
          code: "  labels:",
          note: "how Services and controllers select this Pod later",
        },
        {
          code: "    app: web",
          note: "a key:value pair a Service selector can match",
        },
        {
          code: "spec:",
        },
        {
          code: "  containers:",
          note: "a list — a Pod can hold more than one container",
        },
        {
          code: "    - name: web",
          note: "container name, unique within the Pod",
        },
        {
          code: "      image: klab/web-app:1.0.0",
          note: "pin an explicit tag, never rely on :latest",
        },
        {
          code: "      ports:",
        },
        {
          code: "        - name: http",
        },
        {
          code: "          containerPort: 8080",
          note: "the port the process inside actually listens on",
        },
        {
          code: "      readinessProbe:",
          note: "decides whether the Pod may receive traffic",
        },
        {
          code: "        httpGet:",
        },
        {
          code: "          path: /healthz",
          note: "returns 200 on this image, so the Pod becomes Ready",
        },
        {
          code: "          port: 8080",
        },
        {
          code: "        initialDelaySeconds: 1",
          note: "wait this long before the first probe",
        },
        {
          code: "        periodSeconds: 3",
          note: "then probe every 3 seconds",
        },
      ],
    },
    {
      type: "heading",
      id: "build-it",
      text: "Build one from scratch",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "A Pod grows in three steps",
      stages: [
        {
          label: "Minimum valid Pod",
          note: "The smallest thing Kubernetes will accept: a kind, a name, and one container with an image. It will schedule and run, but nothing selects it and nothing gates its health.",
          code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0",
        },
        {
          label: "Add labels and a port",
          note: "Labels make the Pod selectable by Services and controllers. The named containerPort documents where the process listens so a Service targetPort can point at it.",
          code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\n  labels:\n    app: web\nspec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      ports:\n        - name: http\n          containerPort: 8080",
        },
        {
          label: "Add a readiness probe",
          note: "Now the Pod tells Kubernetes when it is safe to receive traffic. Until the probe on /healthz passes, the Pod is Running but NotReady and no Service will route to it.",
          code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\n  labels:\n    app: web\nspec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      ports:\n        - name: http\n          containerPort: 8080\n      readinessProbe:\n        httpGet:\n          path: /healthz\n          port: 8080",
        },
      ],
    },
    {
      type: "heading",
      id: "running-vs-ready",
      text: "Running is not Ready",
    },
    {
      type: "paragraph",
      text: "The two most confused Pod states are phase and readiness. STATUS in kubectl get pods is the lifecycle phase (Pending, Running, Succeeded, Failed). READY (the 1/1 column) is a separate condition that counts how many containers currently pass their readiness probe. A Pod can sit at Running 1/1 STATUS with 0/1 READY for a long time — the process is alive, but it is telling Kubernetes not to send it traffic yet.",
    },
    {
      type: "callout",
      tone: "key",
      title: "Two independent signals",
      text: "restartPolicy and liveness probes decide whether a container is restarted. Readiness probes decide only whether the Pod appears in a Service's endpoints. Failing readiness never restarts a container; failing liveness does. Keep them separate in your head or you will chase the wrong fix.",
    },
    {
      type: "callout",
      tone: "info",
      title: "restartPolicy defaults to Always",
      text: "For a Pod, restartPolicy is Always unless you change it. That is right for long-running servers but wrong for a one-shot task, where you want OnFailure or Never — otherwise a Pod that finishes successfully gets restarted forever.",
    },
    {
      type: "heading",
      id: "multi-container",
      text: "One container or several?",
    },
    {
      type: "paragraph",
      text: "The default and correct shape is one application container per Pod. Reach for a second container only when it must share the first one's network or filesystem and share its lifecycle — a sidecar that ships logs, a proxy, or an init container that runs to completion before the app starts. If two things can scale or fail independently, they belong in separate Pods.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a broken Pod",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "This Pod runs the klab/web-app image but never reaches Ready. kubectl shows Running with 0/1 READY, and the events log repeated readiness probe failures. What is wrong?",
      code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\n  labels:\n    app: web\nspec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      ports:\n        - name: http\n          containerPort: 8080\n      readinessProbe:\n        httpGet:\n          path: /readyz\n          port: 8080",
      answer:
        "The readiness probe points at /readyz, which this image returns as 404. A non-2xx response is a failed probe, so the container stays NotReady even though the process is alive and Running. The container is never restarted, because readiness is a traffic gate, not a restart trigger. Fix: change the probe path to /healthz, which returns 200.",
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write one yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Write a Pod named api labeled app: api that runs klab/web-app:1.0.0, exposes containerPort 8080, and only becomes Ready when an HTTP GET to /healthz on 8080 succeeds.",
      hint: "You need metadata.name, metadata.labels, one entry under spec.containers with name/image/ports, and a readinessProbe.httpGet with path and port.",
      solution:
        "apiVersion: v1\nkind: Pod\nmetadata:\n  name: api\n  labels:\n    app: api\nspec:\n  containers:\n    - name: api\n      image: klab/web-app:1.0.0\n      ports:\n        - name: http\n          containerPort: 8080\n      readinessProbe:\n        httpGet:\n          path: /healthz\n          port: 8080",
    },
    {
      type: "lab",
      labId: "pod-ready",
    },
    {
      type: "heading",
      id: "bare-vs-controller",
      text: "Bare Pod vs Pod via a controller",
    },
    {
      type: "compare",
      caption:
        "A bare Pod is disposable and is never recreated. A controller owns a Pod template and keeps the desired number of Pods running.",
      left: {
        title: "Bare Pod (debugging only)",
        code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\n  labels:\n    app: web\nspec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n# node dies -> Pod is gone, nothing replaces it",
      },
      right: {
        title: "Pod via a Deployment (production)",
        code: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: web\n          image: klab/web-app:1.0.0\n# controller recreates and reschedules Pods for you",
      },
    },
    {
      type: "takeaways",
      items: [
        "A Pod is the smallest schedulable unit — containers in it share one IP, localhost, and lifecycle.",
        "STATUS (phase) and READY (readiness) are independent: a Pod can be Running but NotReady.",
        "Readiness gates traffic; liveness and restartPolicy control restarts. Do not confuse them.",
        "Default to one application container per Pod; add sidecars only when they must share context.",
        "Create bare Pods only for debugging — run real workloads through a controller so they self-heal.",
      ],
    },
    {
      type: "quiz",
      id: "pods-q1",
      question: "Why can a Pod be Running but not Ready?",
      options: [
        {
          id: "a",
          text: "The container process exists, but its readiness condition is failing.",
          correct: true,
          explanation:
            "Running is the lifecycle phase; Ready is a separate condition that gates whether the Pod receives traffic.",
        },
        {
          id: "b",
          text: "It has no labels.",
          correct: false,
          explanation:
            "Labels affect selection by Services and controllers, not the Running phase or readiness.",
        },
        {
          id: "c",
          text: "It is managed by a Deployment.",
          correct: false,
          explanation:
            "Managed Pods can still be Ready or NotReady; ownership does not decide readiness.",
        },
      ],
    },
    {
      type: "quiz",
      id: "pods-q2",
      question: "A Pod's readiness probe keeps failing. What does Kubernetes do to the container?",
      options: [
        {
          id: "a",
          text: "Nothing to the container, but it removes the Pod from Service endpoints.",
          correct: true,
          explanation:
            "Readiness is a traffic gate. A failing readiness probe pulls the Pod out of endpoints but never restarts the container.",
        },
        {
          id: "b",
          text: "It restarts the container immediately.",
          correct: false,
          explanation:
            "Restarts come from a failing liveness probe or a crashed process, not from readiness.",
        },
        {
          id: "c",
          text: "It deletes and reschedules the Pod on another node.",
          correct: false,
          explanation:
            "Readiness failure does not evict or reschedule the Pod; the Pod stays where it is, just NotReady.",
        },
      ],
    },
  ],
  labs: [
    {
      id: "pod-ready",
      title: "Start and inspect a Pod",
      prompt: "Apply a single Pod with a readiness probe and watch it move into Ready state.",
      files: [{ path: "pod.yaml", language: "yaml", initialValue: WEB_POD }],
      initialManifests: [],
      registeredImages: [WEB_IMAGE],
      tryChanging: "Change readinessProbe.httpGet.path to /readyz and apply.",
      tasks: ["Start from a healthy Pod.", "Break the readiness path.", "Observe Ready change."],
      commands: ["kubectl get pods", "kubectl describe pod web"],
      debrief:
        "The Pod can keep running while readiness changes. That is why readiness is a traffic gate, not a restart policy.",
    },
  ],
};

const deployments: DocsLesson = {
  slug: ["workloads", "deployments"],
  title: "Deployments",
  description:
    "Deployments manage stateless replicated Pods and coordinate rolling updates through ReplicaSets.",
  section: "Workloads",
  order: 1,
  concepts: ["deployments", "replicasets", "pods", "rollouts"],
  relatedLevelSlug: "rolling-update-gone-wrong",
  content: [
    {
      type: "heading",
      id: "deployment-role",
      text: "What Deployments do",
    },
    {
      type: "paragraph",
      text: "A Deployment is a controller for stateless, interchangeable Pods. It owns a desired Pod template, a replica count, and a rollout strategy. It never runs containers itself: it creates a ReplicaSet, and the ReplicaSet creates and maintains the Pods. You describe the end state you want; three nested controllers keep reality matching it.",
    },
    {
      type: "paragraph",
      text: "The single most important habit: you edit the Deployment, not the Pods. Pods are disposable output. Delete one and the ReplicaSet makes another; hand-edit one and your change vanishes on the next rollout. All durable change flows top-down through the Deployment's template.",
    },
    {
      type: "diagram",
      variant: "workload-hierarchy",
      title: "Deployment owns ReplicaSet owns Pods",
      caption: "One Deployment, one active ReplicaSet per template revision, N identical Pods.",
    },
    {
      type: "heading",
      id: "ownership",
      text: "The ownership chain",
    },
    {
      type: "concept",
      term: "ownerReferences",
      definition:
        "Each Pod carries an ownerReference to its ReplicaSet, and each ReplicaSet to its Deployment. This chain is how kubectl builds the tree, how cascading deletes work (delete the Deployment and its ReplicaSets and Pods are garbage-collected), and how each controller knows which children are its responsibility.",
    },
    {
      type: "heading",
      id: "anatomy",
      text: "Anatomy of a Deployment",
    },
    {
      type: "paragraph",
      text: "Read every Deployment through four lenses: how many copies (replicas), which Pods it adopts (selector.matchLabels), what those Pods look like (template), and how it replaces them (strategy). Get the selector-to-template label contract right and everything else follows.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A complete Deployment",
      caption:
        "The selector.matchLabels MUST be a subset of template.metadata.labels, or the API server rejects the object.",
      lines: [
        {
          code: "apiVersion: apps/v1",
          note: "Deployments live in the apps group, not core v1",
        },
        {
          code: "kind: Deployment",
        },
        {
          code: "metadata:",
          note: "identity of the Deployment object itself",
        },
        {
          code: "  name: web",
        },
        {
          code: "  namespace: default",
        },
        {
          code: "spec:",
        },
        {
          code: "  replicas: 3",
          note: "desired number of Ready Pods the ReplicaSet must keep",
        },
        {
          code: "  selector:",
          note: "which Pods this Deployment owns — this is immutable after creation",
        },
        {
          code: "    matchLabels:",
        },
        {
          code: "      app: web",
          note: "MUST match a label under template.metadata.labels below",
        },
        {
          code: "  strategy:",
          note: "how old Pods are replaced during an update",
        },
        {
          code: "    type: RollingUpdate",
        },
        {
          code: "    rollingUpdate:",
        },
        {
          code: "      maxSurge: 1",
          note: "at most 1 extra Pod above replicas during the rollout",
        },
        {
          code: "      maxUnavailable: 0",
          note: "never drop below replicas Ready Pods — zero-downtime",
        },
        {
          code: "  template:",
          note: "the Pod blueprint; edit here to change every Pod",
        },
        {
          code: "    metadata:",
        },
        {
          code: "      labels:",
        },
        {
          code: "        app: web",
          note: "the label the selector matches — the contract's other half",
        },
        {
          code: "    spec:",
        },
        {
          code: "      containers:",
        },
        {
          code: "        - name: web",
        },
        {
          code: "          image: web:1.0",
          note: "change this value and Kubernetes rolls out a new ReplicaSet",
        },
        {
          code: "          ports:",
        },
        {
          code: "            - containerPort: 8080",
        },
      ],
    },
    {
      type: "heading",
      id: "build-it",
      text: "Build one from scratch",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "A Deployment grows in three steps",
      stages: [
        {
          label: "Skeleton",
          note: "Minimum shape: kind, a name, and a template with one container. No replicas field defaults to 1. No selector yet — the API server will reject this until a selector is added.",
          code: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec:\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: web\n          image: web:1.0",
        },
        {
          label: "Wire the selector",
          note: "Add selector.matchLabels that matches the template's labels. This closes the contract: the Deployment now knows which Pods are its own. This field is required and cannot be changed later.",
          code: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec:\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: web\n          image: web:1.0",
        },
        {
          label: "Scale and set strategy",
          note: "Ask for 3 replicas and a zero-downtime rolling update. Now one ReplicaSet keeps three Ready Pods, and image changes roll out one Pod at a time without dropping below three.",
          code: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: web\n  strategy:\n    type: RollingUpdate\n    rollingUpdate:\n      maxSurge: 1\n      maxUnavailable: 0\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: web\n          image: web:1.0",
        },
      ],
    },
    {
      type: "heading",
      id: "label-contract",
      text: "The selector-template label contract",
    },
    {
      type: "callout",
      tone: "key",
      title: "matchLabels must be a subset of template labels",
      text: "The Deployment adopts Pods whose labels match spec.selector.matchLabels. Those Pods come from spec.template, so the template's metadata.labels must include every key:value in the selector. If they disagree, the API server rejects the Deployment with `selector does not match template labels`. The template may carry extra labels; the selector may not require labels the template lacks.",
    },
    {
      type: "compare",
      caption:
        "The selector is compared against the template's Pod labels, key for key. It may be a subset, never a superset.",
      left: {
        title: "spec.selector.matchLabels",
        code: "selector:\n  matchLabels:\n    app: web",
      },
      right: {
        title: "spec.template.metadata.labels",
        code: "template:\n  metadata:\n    labels:\n      app: web\n      tier: frontend\n# valid — template adds tier, selector still matched",
      },
    },
    {
      type: "heading",
      id: "rollouts",
      text: "How a rolling update works",
    },
    {
      type: "paragraph",
      text: "Change anything under spec.template — usually the image — and the Deployment computes a new template hash. It creates a fresh ReplicaSet for that hash and scales it up while scaling the old one down, respecting maxSurge and maxUnavailable. When the new ReplicaSet is fully Ready, the old one is scaled to zero but kept for rollback.",
    },
    {
      type: "diagram",
      variant: "rollout",
      title: "Old ReplicaSet drains as the new one fills",
      caption: "maxSurge caps how far above replicas you go; maxUnavailable caps how far below.",
    },
    {
      type: "concept",
      term: "maxSurge and maxUnavailable",
      definition:
        "maxSurge is how many Pods above the desired count may exist mid-rollout; maxUnavailable is how many below the desired count of Ready Pods you tolerate. maxUnavailable: 0 with maxSurge: 1 gives strict zero-downtime at the cost of a slower, one-at-a-time rollout. Both accept a count or a percentage.",
    },
    {
      type: "callout",
      tone: "info",
      title: "Revision history and rollback",
      text: "Each superseded ReplicaSet is kept (up to spec.revisionHistoryLimit, default 10) so you can undo a bad release. `kubectl rollout undo deploy/web` scales the previous ReplicaSet back up and the current one down — a rollback is just another rolling update in reverse. `kubectl rollout status deploy/web` watches progress; `kubectl rollout history` lists revisions.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Only template changes trigger a rollout",
      text: "Editing spec.replicas scales the current ReplicaSet — it does NOT create a new revision. Only changes under spec.template (image, env, resources, labels) produce a new ReplicaSet and a rollout. This is why scaling is instant and cheap while an image bump is a controlled, reversible release.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a broken Deployment",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "kubectl apply on this manifest fails with `selector does not match template labels`. The intent is a web Deployment. What is wrong, and how do you fix it?",
      code: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: api\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: web\n          image: web:1.0",
      answer:
        "The selector requires app: api, but the Pod template labels the Pods app: web. Since matchLabels is not a subset of the template labels, the Deployment could never own the Pods it creates, so the API server rejects it outright. Fix: make them agree — change selector.matchLabels to app: web (or relabel the template to app: api). Because the selector is immutable after creation, getting this right on the first apply matters.",
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write one yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Write a Deployment named api that runs 4 replicas of image api:2.1 listening on containerPort 8080, labels its Pods app: api, and rolls updates out with zero downtime (never fewer than 4 Ready Pods, at most 1 extra during a rollout).",
      hint: "Zero downtime means maxUnavailable: 0. Allowing one extra Pod means maxSurge: 1. Remember the selector.matchLabels must match the template's app: api label.",
      solution:
        "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: api\nspec:\n  replicas: 4\n  selector:\n    matchLabels:\n      app: api\n  strategy:\n    type: RollingUpdate\n    rollingUpdate:\n      maxSurge: 1\n      maxUnavailable: 0\n  template:\n    metadata:\n      labels:\n        app: api\n    spec:\n      containers:\n        - name: api\n          image: api:2.1\n          ports:\n            - containerPort: 8080",
    },
    {
      type: "lab",
      labId: "deployment-scale",
    },
    {
      type: "heading",
      id: "which-workload",
      text: "Deployment, StatefulSet, or DaemonSet?",
    },
    {
      type: "paragraph",
      text: "Deployments assume Pods are identical and interchangeable. When identity, stable storage, or one-Pod-per-node matters, reach for a different controller.",
    },
    {
      type: "decisionTable",
      title: "Choosing a workload controller",
      columns: ["Pod identity", "Ordering & storage", "Use it for"],
      rows: [
        {
          label: "Deployment",
          cells: [
            "Interchangeable, random names",
            "No stable identity or per-Pod storage",
            "Stateless web/API servers, workers",
          ],
        },
        {
          label: "StatefulSet",
          cells: [
            "Stable, ordinal names (web-0, web-1)",
            "Ordered rollout, per-Pod PersistentVolume",
            "Databases, quorum/clustered systems",
          ],
        },
        {
          label: "DaemonSet",
          cells: [
            "One Pod per matching node",
            "Scales with nodes, not a replica count",
            "Node agents: logging, metrics, CNI",
          ],
        },
      ],
    },
    {
      type: "heading",
      id: "takeaways",
      text: "Takeaways",
    },
    {
      type: "takeaways",
      items: [
        "A Deployment owns ReplicaSets, which own Pods — you edit the Deployment template, never individual Pods.",
        "spec.selector.matchLabels must be a subset of spec.template.metadata.labels, and the selector is immutable after creation.",
        "Only changes under spec.template create a new ReplicaSet and trigger a rollout; changing replicas just scales the current one.",
        "maxSurge and maxUnavailable govern rollout speed vs. availability — maxUnavailable: 0 buys zero downtime.",
        "Old ReplicaSets are retained (revisionHistoryLimit) so kubectl rollout undo can reverse a bad release.",
      ],
    },
    {
      type: "quiz",
      id: "deployments-q1",
      question: "What should you edit to change the image for a stateless web app?",
      options: [
        {
          id: "a",
          text: "Each existing Pod.",
          correct: false,
          explanation:
            "Pods are disposable controller output; a hand-edit is lost on the next reconcile or rollout.",
        },
        {
          id: "b",
          text: "The Deployment's spec.template.",
          correct: true,
          explanation:
            "The template is the desired state; changing the image there produces a new ReplicaSet and a controlled rollout.",
        },
        {
          id: "c",
          text: "The ReplicaSet directly.",
          correct: false,
          explanation:
            "The Deployment manages ReplicaSets; editing one is overwritten because the Deployment owns the desired state.",
        },
      ],
    },
    {
      type: "quiz",
      id: "deployments-q2",
      question:
        "You run `kubectl scale deploy/web --replicas=5`. Does this create a new revision you can roll back?",
      options: [
        {
          id: "a",
          text: "Yes, every change creates a revision.",
          correct: false,
          explanation:
            "Only changes to spec.template create a new ReplicaSet and revision; scaling is not a template change.",
        },
        {
          id: "b",
          text: "No — scaling adjusts the current ReplicaSet without a new revision.",
          correct: true,
          explanation:
            "Replica count lives outside the Pod template, so scaling resizes the active ReplicaSet in place rather than starting a rollout.",
        },
        {
          id: "c",
          text: "No, because scaling is rejected on RollingUpdate Deployments.",
          correct: false,
          explanation:
            "Scaling is always allowed; it simply is not a rollout-triggering template change.",
        },
      ],
    },
  ],
  labs: [
    {
      id: "deployment-scale",
      title: "Scale a Deployment",
      prompt: "Change replicas and observe the Deployment, ReplicaSet, and Pods converge.",
      files: [{ path: "deployment.yaml", language: "yaml", initialValue: WEB_DEPLOYMENT }],
      initialManifests: [],
      registeredImages: [WEB_IMAGE],
      tryChanging: "Change replicas to 1, then apply.",
      tasks: ["Edit spec.replicas.", "Apply.", "Observe the Pod count shrink or grow."],
      commands: ["kubectl get deploy", "kubectl get rs", "kubectl get pods"],
      debrief:
        "A Deployment does not run containers directly. It delegates Pod creation to ReplicaSets.",
    },
  ],
};

const replicaSets: DocsLesson = {
  slug: ["workloads", "replicasets"],
  title: "ReplicaSets",
  description:
    "ReplicaSets keep a matching set of Pods at a target count, but you usually let Deployments manage them.",
  section: "Workloads",
  order: 2,
  concepts: ["replicasets", "deployments", "labels-selectors"],
  content: [
    {
      type: "heading",
      id: "what-it-guarantees",
      text: "What a ReplicaSet guarantees",
    },
    {
      type: "paragraph",
      text: "A ReplicaSet has one job: keep exactly spec.replicas Pods that match its selector running at all times. Its controller runs a continuous reconcile loop — it counts Pods matching the selector, compares that to the desired count, and takes action. Too few Pods? It creates more from the Pod template. Too many? It deletes the surplus. A Pod crashed, was evicted, or its node died? The count drops, and the controller creates a replacement. The ReplicaSet never heals a Pod; it only maintains a population.",
    },
    {
      type: "paragraph",
      text: "You almost never create a ReplicaSet by hand. A Deployment creates and owns ReplicaSets for you, and layers rolling updates and rollback on top. You still need to understand ReplicaSets because that is what actually schedules your Pods, and it is what you see in kubectl get rs, in ownerReferences, and when a rollout goes wrong.",
    },
    {
      type: "diagram",
      variant: "workload-hierarchy",
      title: "Deployment owns ReplicaSet owns Pods",
      caption:
        "You edit the Deployment. It manages ReplicaSets. Each ReplicaSet keeps its Pods at the target count.",
    },
    {
      type: "heading",
      id: "anatomy",
      text: "Anatomy of a ReplicaSet",
    },
    {
      type: "paragraph",
      text: "Three fields carry all the meaning: replicas (how many), selector (which Pods count toward that number), and template (the Pod to stamp out when it needs more). The one rule that trips people up: every label in spec.selector.matchLabels must also appear in spec.template.metadata.labels, or the API server rejects the object outright.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A complete ReplicaSet",
      caption: "Note how the selector and the template labels are the same set of labels.",
      lines: [
        {
          code: "apiVersion: apps/v1",
          note: "ReplicaSet lives in the apps group, not core v1",
        },
        {
          code: "kind: ReplicaSet",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: web",
        },
        {
          code: "spec:",
        },
        {
          code: "  replicas: 3",
          note: "the desired count the controller drives toward",
        },
        {
          code: "  selector:",
          note: "WHICH Pods this ReplicaSet owns and counts",
        },
        {
          code: "    matchLabels:",
        },
        {
          code: "      app: web",
          note: "every key here must also be present in the template labels",
        },
        {
          code: "  template:",
          note: "the Pod blueprint used to create new replicas",
        },
        {
          code: "    metadata:",
        },
        {
          code: "      labels:",
        },
        {
          code: "        app: web",
          note: "must satisfy the selector above — this is what links them",
        },
        {
          code: "    spec:",
        },
        {
          code: "      containers:",
        },
        {
          code: "        - name: web",
        },
        {
          code: "          image: nginx:1.27",
        },
        {
          code: "          ports:",
        },
        {
          code: "            - containerPort: 80",
        },
      ],
    },
    {
      type: "heading",
      id: "build-it",
      text: "Build one from scratch",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "A ReplicaSet grows in three steps",
      stages: [
        {
          label: "Template first",
          note: "Start with the Pod you want to run, labeled so it can be selected later.",
          code: "apiVersion: apps/v1\nkind: ReplicaSet\nmetadata:\n  name: web\nspec:\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: web\n          image: nginx:1.27",
        },
        {
          label: "Add the selector",
          note: "Tell the controller which Pods to count. It must match the template labels, so app: web ties the two together.",
          code: "apiVersion: apps/v1\nkind: ReplicaSet\nmetadata:\n  name: web\nspec:\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: web\n          image: nginx:1.27",
        },
        {
          label: "Set the count",
          note: "Declare replicas: 3. Now the controller reconciles toward three Ready Pods and replaces any that disappear.",
          code: "apiVersion: apps/v1\nkind: ReplicaSet\nmetadata:\n  name: web\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: web\n          image: nginx:1.27",
        },
      ],
    },
    {
      type: "heading",
      id: "ownership",
      text: "Ownership, adoption, and garbage collection",
    },
    {
      type: "concept",
      term: "ownerReferences",
      definition:
        "Every Pod a ReplicaSet creates gets an ownerReference in its metadata pointing back at the ReplicaSet, with controller: true. This is how kubectl knows which Pods belong to which controller, and how cascading deletion works: delete the ReplicaSet and the garbage collector removes the Pods it owns.",
    },
    {
      type: "callout",
      tone: "info",
      title: "Adoption is by label, not by creation",
      text: "A ReplicaSet does not only manage Pods it created. Any Pod that matches its selector and has no controlling owner gets adopted — the ReplicaSet stamps its ownerReference onto it and counts it toward the replica total. This is why a stray Pod with matching labels can make a ReplicaSet report more replicas than you expected, and why label hygiene matters.",
    },
    {
      type: "callout",
      tone: "key",
      title: "What a Deployment update does to ReplicaSets",
      text: "When you change a Deployment's Pod template (say a new image), the Deployment does not edit the existing ReplicaSet. It creates a brand-new ReplicaSet for the new template — distinguished by a pod-template-hash label the Deployment injects into the selector — scales it up while scaling the old one down to 0. The old ReplicaSet is not deleted; it is kept at replicas: 0 as rollout history so kubectl rollout undo can scale it back up. revisionHistoryLimit (default 10) controls how many of these empty ReplicaSets are retained.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a broken ReplicaSet",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "kubectl apply on this manifest fails with 'selector does not match template labels'. Why?",
      code: "apiVersion: apps/v1\nkind: ReplicaSet\nmetadata:\n  name: web\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: web\n      tier: frontend\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: web\n          image: nginx:1.27",
      answer:
        "The selector requires two labels — app: web AND tier: frontend — but the Pod template only sets app: web. A Pod the ReplicaSet created would not match its own selector, so the API server rejects it at validation time. Every key in matchLabels must appear in template.metadata.labels. Fix: add tier: frontend to the template labels, or drop it from the selector.",
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write one yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Write a ReplicaSet named cache that keeps 2 Pods running. The Pods should be labeled app: cache and run the image redis:7 exposing containerPort 6379.",
      hint: "Remember the rule: the label in spec.selector.matchLabels must also be in spec.template.metadata.labels.",
      solution:
        "apiVersion: apps/v1\nkind: ReplicaSet\nmetadata:\n  name: cache\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: cache\n  template:\n    metadata:\n      labels:\n        app: cache\n    spec:\n      containers:\n        - name: cache\n          image: redis:7\n          ports:\n            - containerPort: 6379",
    },
    {
      type: "heading",
      id: "vs-deployment",
      text: "Directly vs. via a Deployment",
    },
    {
      type: "compare",
      caption:
        "Same Pods, very different operations. Reach for a Deployment unless you have a specific reason not to.",
      left: {
        title: "ReplicaSet directly",
        code: "kind: ReplicaSet\nspec:\n  replicas: 3\n# Changing the image edits the\n# template, but existing Pods are\n# NOT replaced automatically.\n# No rolling update, no revision\n# history, no rollout undo.\n# You manage restarts by hand.",
      },
      right: {
        title: "Via a Deployment",
        code: "kind: Deployment\nspec:\n  replicas: 3\n# Changing the image triggers a\n# rolling update: a new ReplicaSet\n# scales up as the old scales down.\n# Old ReplicaSets are kept for\n# rollback. Use kubectl rollout\n# status / undo to control it.",
      },
    },
    { type: "lab", labId: "replicaset-self-heal" },
    {
      type: "takeaways",
      items: [
        "A ReplicaSet keeps a labeled set of Pods at spec.replicas by continuously reconciling count, not by healing individual Pods.",
        "The selector's matchLabels must be a subset of the template's labels, or the API server rejects the object.",
        "ReplicaSets own their Pods via ownerReferences and can adopt any matching, unowned Pod — so labels decide membership.",
        "A Deployment update creates a new ReplicaSet and scales the old one to 0, keeping it for rollback rather than deleting it.",
        "Create Deployments, not ReplicaSets, unless you have a narrow reason to manage replicas without rollout semantics.",
      ],
    },
    {
      type: "quiz",
      id: "replicasets-q1",
      question:
        "You change a Deployment's container image and the rollout completes. What is true of the ReplicaSet that was serving the old image?",
      options: [
        {
          id: "a",
          text: "It is scaled to 0 replicas but kept, so the change can be rolled back.",
          correct: true,
          explanation:
            "The Deployment creates a new ReplicaSet for the new template and scales the old one down to 0, retaining it as rollout history (up to revisionHistoryLimit) so kubectl rollout undo works.",
        },
        {
          id: "b",
          text: "It is deleted immediately once the new Pods are Ready.",
          correct: false,
          explanation:
            "It is not deleted; it is kept at 0 replicas for rollback. Only revisions beyond revisionHistoryLimit are eventually cleaned up.",
        },
        {
          id: "c",
          text: "Its existing Pods are updated in place to the new image.",
          correct: false,
          explanation:
            "Pods are immutable in template terms — the Deployment replaces them by shifting Pods from the old ReplicaSet to a new one, not by editing running Pods.",
        },
        {
          id: "d",
          text: "The same ReplicaSet is reused with its template rewritten.",
          correct: false,
          explanation:
            "A Deployment never rewrites an existing ReplicaSet's template; each distinct Pod template gets its own ReplicaSet, identified by a pod-template-hash label.",
        },
      ],
    },
  ],
  labs: [
    {
      id: "replicaset-self-heal",
      title: "Watch a ReplicaSet self-heal",
      prompt:
        "Apply a ReplicaSet, delete one of its Pods, and watch the controller replace it to hold the replica count.",
      files: [{ path: "replicaset.yaml", language: "yaml", initialValue: WEB_REPLICASET }],
      initialManifests: [],
      registeredImages: [WEB_IMAGE],
      tryChanging: "Change spec.replicas to 5 and apply, then delete a Pod with kubectl.",
      tasks: [
        "Apply the ReplicaSet and see 3 Pods.",
        "Delete one Pod.",
        "Watch the ReplicaSet recreate it.",
      ],
      commands: ["kubectl get rs", "kubectl get pods", "kubectl delete pod <pod>"],
      debrief:
        "The ReplicaSet controller constantly compares desired replicas to running Pods and creates or deletes Pods to close the gap. You never manage individual Pods directly.",
    },
  ],
};

const statefulSets: DocsLesson = {
  slug: ["workloads", "statefulsets"],
  title: "StatefulSets",
  description:
    "StatefulSets are for ordered, identity-sensitive workloads such as databases and quorum systems.",
  section: "Workloads",
  order: 3,
  concepts: ["pods", "services", "debugging"],
  content: [
    {
      type: "heading",
      id: "why-statefulsets",
      text: "Why StatefulSets exist",
    },
    {
      type: "paragraph",
      text: "A Deployment treats its Pods as interchangeable cattle: any replica can serve any request, names are random, and storage is shared or disposable. Some workloads cannot live like that. A database primary, a Kafka broker, or a Zookeeper node must know which member it is, keep its own data across restarts, and come up in a predictable order. A StatefulSet provides exactly three guarantees a Deployment does not: a stable network identity per replica, stable per-replica storage that survives rescheduling, and ordered, controlled rollout and scaling.",
    },
    {
      type: "diagram",
      variant: "workload-hierarchy",
      title: "Where a StatefulSet sits",
      caption:
        "A StatefulSet owns its Pods directly (no ReplicaSet layer) and pairs with a headless Service plus one PersistentVolumeClaim per replica.",
    },
    {
      type: "heading",
      id: "anatomy",
      text: "Anatomy of a StatefulSet",
    },
    {
      type: "paragraph",
      text: "Read every StatefulSet through the fields that make it stateful, not the ones it shares with a Deployment. The load-bearing additions are serviceName (which headless Service governs Pod DNS) and volumeClaimTemplates (the per-replica storage recipe). Together they turn anonymous replicas into named members with their own disks.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A complete StatefulSet",
      caption:
        "The two fields a Deployment does not have are serviceName and volumeClaimTemplates.",
      lines: [
        {
          code: "apiVersion: apps/v1",
        },
        {
          code: "kind: StatefulSet",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: web",
          note: "this name is the prefix for every Pod: web-0, web-1, web-2",
        },
        {
          code: "spec:",
        },
        {
          code: "  serviceName: web",
          note: "MUST name a headless Service (clusterIP: None) — it governs the per-Pod DNS domain",
        },
        {
          code: "  replicas: 3",
          note: "creates web-0, web-1, web-2 — the ordinals are stable, not random",
        },
        {
          code: "  selector:",
        },
        {
          code: "    matchLabels:",
        },
        {
          code: "      app: web",
          note: "must match the Pod template labels below, like any controller",
        },
        {
          code: "  template:",
        },
        {
          code: "    metadata:",
        },
        {
          code: "      labels:",
        },
        {
          code: "        app: web",
        },
        {
          code: "    spec:",
        },
        {
          code: "      containers:",
        },
        {
          code: "        - name: nginx",
        },
        {
          code: "          image: nginx:1.25",
        },
        {
          code: "          ports:",
        },
        {
          code: "            - containerPort: 80",
        },
        {
          code: "              name: web",
        },
        {
          code: "          volumeMounts:",
        },
        {
          code: "            - name: data",
          note: "mounts the PVC minted from the template below",
        },
        {
          code: "              mountPath: /usr/share/nginx/html",
        },
        {
          code: "  volumeClaimTemplates:",
          note: "a TEMPLATE, not a volume — Kubernetes stamps one PVC per Pod from it",
        },
        {
          code: "    - metadata:",
        },
        {
          code: "        name: data",
          note: "yields PVCs named data-web-0, data-web-1, data-web-2 — each bound to one Pod for life",
        },
        {
          code: "      spec:",
        },
        {
          code: '        accessModes: ["ReadWriteOnce"]',
        },
        {
          code: "        resources:",
        },
        {
          code: "          requests:",
        },
        {
          code: "            storage: 1Gi",
        },
      ],
    },
    {
      type: "heading",
      id: "build-it",
      text: "Build one from a Deployment mindset",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "Turning a plain controller into a StatefulSet",
      stages: [
        {
          label: "Deployment-shaped skeleton",
          note: "Kind and template look just like a Deployment. This alone gives you nothing stateful yet — Pods would still be anonymous with no persistent disk.",
          code: "apiVersion: apps/v1\nkind: StatefulSet\nmetadata:\n  name: web\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: nginx\n          image: nginx:1.25",
        },
        {
          label: "Add serviceName for identity",
          note: "Point at a headless Service. Now each Pod gets a stable DNS record like web-0.web. Without this field the StatefulSet will not create Pods.",
          code: "apiVersion: apps/v1\nkind: StatefulSet\nmetadata:\n  name: web\nspec:\n  serviceName: web\n  replicas: 3\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: nginx\n          image: nginx:1.25",
        },
        {
          label: "Add volumeClaimTemplates for storage",
          note: "Each replica now owns a PVC (data-web-0, data-web-1, data-web-2) that follows it across reschedules. This is the full stateful contract: named, ordered, and durable.",
          code: 'apiVersion: apps/v1\nkind: StatefulSet\nmetadata:\n  name: web\nspec:\n  serviceName: web\n  replicas: 3\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: nginx\n          image: nginx:1.25\n          volumeMounts:\n            - name: data\n              mountPath: /usr/share/nginx/html\n  volumeClaimTemplates:\n    - metadata:\n        name: data\n      spec:\n        accessModes: ["ReadWriteOnce"]\n        resources:\n          requests:\n            storage: 1Gi',
        },
      ],
    },
    {
      type: "heading",
      id: "ordinal-identity",
      text: "Ordinal identity and DNS",
    },
    {
      type: "concept",
      term: "Ordinal index",
      definition:
        "Each StatefulSet Pod gets a stable name of the form <statefulset-name>-<ordinal>, starting at 0: web-0, web-1, web-2. The name is not reused for a different Pod and survives rescheduling — if web-1 dies, its replacement is still named web-1 and reattaches the same storage.",
    },
    {
      type: "concept",
      term: "Headless Service DNS",
      definition:
        "A headless Service (clusterIP: None) named by serviceName gives each Pod its own DNS A record: web-0.web.default.svc.cluster.local. Clients can address a specific member directly instead of load-balancing across all of them — essential for quorum systems where you must reach the primary or a named peer.",
    },
    {
      type: "callout",
      tone: "key",
      title: "PVCs outlive Pods on purpose",
      text: "PersistentVolumeClaims created from volumeClaimTemplates are NOT deleted when you scale down or delete the StatefulSet (the default retention policy). Deleting the StatefulSet leaves data-web-0, data-web-1, data-web-2 behind so a recreated StatefulSet reattaches its data. The trade-off: cleaning up truly means deleting those PVCs by hand, and a leftover PVC can silently rebind stale data to a new Pod.",
    },
    {
      type: "callout",
      tone: "info",
      title: "Ordered vs parallel start-up",
      text: "By default (podManagementPolicy: OrderedReady) Kubernetes brings Pods up one at a time in ascending ordinal order, waiting for each to be Running and Ready before starting the next, and tears them down in descending order. Set podManagementPolicy: Parallel when members are independent and start-up order does not matter — it launches and deletes all Pods at once for faster scaling.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a broken StatefulSet",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "This StatefulSet was applied, but no Pods are ever created and events complain about the Pod's network identity. The image and selector are fine. What is missing?",
      code: "apiVersion: apps/v1\nkind: StatefulSet\nmetadata:\n  name: web\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: nginx\n          image: nginx:1.25",
      answer:
        "There is no serviceName, and no matching headless Service exists. A StatefulSet requires serviceName to point at a headless Service (clusterIP: None) that governs the Pods' stable DNS domain. Without it the controller cannot establish per-Pod network identity and will not create the Pods. Fix: create a Service named web with clusterIP: None selecting app: web, then add spec.serviceName: web.",
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write the headless Service",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Write the headless Service that the StatefulSet above needs. It must be named web, expose port 80, and select Pods labeled app: web, while giving each Pod its own DNS record rather than a single virtual IP.",
      hint: "Headless means spec.clusterIP: None. The Service name must equal the StatefulSet's serviceName.",
      solution:
        "apiVersion: v1\nkind: Service\nmetadata:\n  name: web\nspec:\n  clusterIP: None\n  selector:\n    app: web\n  ports:\n    - port: 80\n      name: web",
    },
    {
      type: "heading",
      id: "choosing",
      text: "Deployment or StatefulSet?",
    },
    {
      type: "decisionTable",
      title: "Deployment vs StatefulSet",
      columns: ["Deployment", "StatefulSet"],
      rows: [
        {
          label: "Pod identity",
          cells: ["Random suffix, interchangeable", "Stable ordinal names web-0..web-N, sticky"],
        },
        {
          label: "Storage",
          cells: ["Shared or ephemeral volumes", "One PVC per replica, reattached on reschedule"],
        },
        {
          label: "Scaling / rollout",
          cells: [
            "All Pods parallel, any order",
            "Ordered by default (ascending up, descending down)",
          ],
        },
        {
          label: "Best for",
          cells: ["Stateless web/API tiers", "Databases, message queues, quorum systems"],
        },
      ],
    },
    {
      type: "takeaways",
      items: [
        "StatefulSets add three guarantees over Deployments: stable network identity, stable per-replica storage, and ordered rollout.",
        "serviceName must reference a headless Service (clusterIP: None) — without it Pods are never created.",
        "volumeClaimTemplates stamp one PVC per Pod (data-web-0, data-web-1, ...) that survives rescheduling.",
        "PVCs are retained on scale-down and delete by default, so cleanup and stale-data reuse need conscious handling.",
        "Reach a specific member via per-Pod DNS like web-0.web.default.svc.cluster.local instead of one virtual IP.",
      ],
    },
    {
      type: "quiz",
      id: "statefulsets-q1",
      question:
        "You delete a StatefulSet named web with three replicas. What happens to its PersistentVolumeClaims by default?",
      options: [
        {
          id: "a",
          text: "The PVCs data-web-0, data-web-1, data-web-2 remain, so data survives and a recreated StatefulSet reattaches it.",
          correct: true,
          explanation:
            "The default PVC retention policy keeps the claims when a StatefulSet is deleted or scaled down, preserving data intentionally.",
        },
        {
          id: "b",
          text: "All PVCs are immediately deleted along with the StatefulSet, discarding the data.",
          correct: false,
          explanation:
            "StatefulSet PVCs are not garbage-collected by default; you must delete them by hand to reclaim the storage.",
        },
        {
          id: "c",
          text: "The PVCs are merged into a single shared volume for the next controller.",
          correct: false,
          explanation:
            "PVCs stay one-per-ordinal and are never merged; each remains bound to its own PersistentVolume.",
        },
        {
          id: "d",
          text: "The PVCs are converted to emptyDir volumes on the node.",
          correct: false,
          explanation:
            "PVCs are cluster resources backed by PersistentVolumes and are never converted to node-local emptyDir volumes.",
        },
      ],
    },
  ],
  labs: [],
};

const daemonSets: DocsLesson = {
  slug: ["workloads", "daemonsets"],
  title: "DaemonSets",
  description: "DaemonSets run one Pod on every matching node, usually for infrastructure agents.",
  section: "Workloads",
  order: 4,
  concepts: ["pods", "events", "debugging"],
  content: [
    {
      type: "heading",
      id: "why-daemonsets",
      text: "One Pod on every node",
    },
    {
      type: "paragraph",
      text: "A DaemonSet guarantees that a copy of a Pod runs on every node that matches its scheduling rules. As nodes join the cluster the DaemonSet controller places a Pod on them, and as nodes leave those Pods are garbage collected. You never set a replica count — the fleet size is the number of matching nodes.",
    },
    {
      type: "paragraph",
      text: "This is the pattern for node-level infrastructure: log collectors that tail every node's container logs, monitoring agents that scrape node metrics, CNI network plugins, storage drivers, and security agents. Each of these must be present wherever workloads land, so they scale with the cluster rather than with traffic.",
    },
    {
      type: "diagram",
      variant: "workload-hierarchy",
      title: "Where a DaemonSet sits among workload controllers",
    },
    {
      type: "heading",
      id: "anatomy",
      text: "Anatomy of a DaemonSet",
    },
    {
      type: "paragraph",
      text: "A DaemonSet looks like a Deployment with the replica count removed. It carries a Pod template and a label selector, but instead of a desired number of Pods it lets the controller derive one Pod per eligible node. Node agents usually also reach into the host, so hostPath volumes and hostNetwork are common here.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A log-collector DaemonSet",
      caption: "No replicas field — the controller fans out one Pod per matching node.",
      lines: [
        {
          code: "apiVersion: apps/v1",
        },
        {
          code: "kind: DaemonSet",
          note: "not Deployment — there is no replica count to set",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: log-agent",
        },
        {
          code: "  namespace: kube-system",
          note: "infrastructure agents usually live in kube-system",
        },
        {
          code: "spec:",
        },
        {
          code: "  selector:",
          note: "must match the template labels below, like a Deployment",
        },
        {
          code: "    matchLabels:",
        },
        {
          code: "      app: log-agent",
        },
        {
          code: "  template:",
        },
        {
          code: "    metadata:",
        },
        {
          code: "      labels:",
        },
        {
          code: "        app: log-agent",
          note: "these labels must satisfy the selector above",
        },
        {
          code: "    spec:",
        },
        {
          code: "      hostNetwork: true",
          note: "share the node's network namespace so the agent sees host-level traffic",
        },
        {
          code: "      tolerations:",
          note: "without a matching toleration the agent skips tainted nodes",
        },
        {
          code: "        - key: node-role.kubernetes.io/control-plane",
        },
        {
          code: "          operator: Exists",
        },
        {
          code: "          effect: NoSchedule",
          note: "lets the agent also land on control-plane nodes",
        },
        {
          code: "      containers:",
        },
        {
          code: "        - name: agent",
        },
        {
          code: "          image: log-agent:v1",
        },
        {
          code: "          volumeMounts:",
        },
        {
          code: "            - name: varlog",
        },
        {
          code: "              mountPath: /var/log",
          note: "read the node's log directory from inside the Pod",
        },
        {
          code: "      volumes:",
        },
        {
          code: "        - name: varlog",
        },
        {
          code: "          hostPath:",
          note: "hostPath binds a directory from the node's filesystem",
        },
        {
          code: "            path: /var/log",
        },
      ],
    },
    {
      type: "heading",
      id: "build-it",
      text: "Build one from scratch",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "A DaemonSet grows in three steps",
      stages: [
        {
          label: "Skeleton",
          note: "Start with the object identity. apps/v1 DaemonSet with a name — no spec content yet, so it schedules nothing.",
          code: "apiVersion: apps/v1\nkind: DaemonSet\nmetadata:\n  name: log-agent\nspec: {}",
        },
        {
          label: "Add selector and template",
          note: "The selector must match the template's Pod labels. Now the controller will place one Pod per node — but only on nodes with no blocking taints.",
          code: "apiVersion: apps/v1\nkind: DaemonSet\nmetadata:\n  name: log-agent\nspec:\n  selector:\n    matchLabels:\n      app: log-agent\n  template:\n    metadata:\n      labels:\n        app: log-agent\n    spec:\n      containers:\n        - name: agent\n          image: log-agent:v1",
        },
        {
          label: "Tolerate control-plane taints",
          note: "Control-plane nodes carry a NoSchedule taint. Add a toleration so the agent also covers those nodes, giving true whole-cluster coverage.",
          code: "apiVersion: apps/v1\nkind: DaemonSet\nmetadata:\n  name: log-agent\nspec:\n  selector:\n    matchLabels:\n      app: log-agent\n  template:\n    metadata:\n      labels:\n        app: log-agent\n    spec:\n      tolerations:\n        - key: node-role.kubernetes.io/control-plane\n          operator: Exists\n          effect: NoSchedule\n      containers:\n        - name: agent\n          image: log-agent:v1",
        },
      ],
    },
    {
      type: "heading",
      id: "scheduling",
      text: "How scheduling differs from replicas",
    },
    {
      type: "concept",
      term: "One Pod per eligible node",
      definition:
        "The DaemonSet controller does not pick a number of Pods; it reconciles one Pod for each node whose labels, taints, and resources satisfy the Pod template. The effective count is the count of eligible nodes, so adding a node grows the DaemonSet automatically.",
    },
    {
      type: "callout",
      tone: "key",
      title: "Three knobs decide which nodes get a Pod",
      text: "nodeSelector and node affinity narrow the DaemonSet to a subset of nodes (for example only GPU nodes). Tolerations let its Pods land on tainted nodes such as the control plane. Node resources still apply — a node with no room will show the Pod Pending. Get all three right and coverage matches your intent exactly.",
    },
    {
      type: "callout",
      tone: "info",
      title: "updateStrategy: RollingUpdate vs OnDelete",
      text: "RollingUpdate (the default) replaces Pods node by node when the template changes, bounded by maxUnavailable so the fleet is never fully down. OnDelete makes the controller wait: a node's Pod is only recreated with the new template after you manually delete the old one — useful when node-agent restarts are disruptive and you want to control timing.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a broken DaemonSet",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "This DaemonSet should run the agent on all nodes including the control plane, but kubectl shows DESIRED and READY at 3 in a 4-node cluster (3 workers, 1 control-plane). The control-plane node has no agent Pod. What's wrong?",
      code: "apiVersion: apps/v1\nkind: DaemonSet\nmetadata:\n  name: node-agent\nspec:\n  selector:\n    matchLabels:\n      app: node-agent\n  template:\n    metadata:\n      labels:\n        app: node-agent\n    spec:\n      containers:\n        - name: agent\n          image: node-agent:v1",
      answer:
        "The control-plane node carries the taint node-role.kubernetes.io/control-plane:NoSchedule, and this Pod template has no matching toleration. The scheduler therefore never considers that node eligible, so DESIRED counts only the 3 tolerable workers. Add a toleration for that key with effect NoSchedule and the control-plane node becomes eligible, raising DESIRED to 4.",
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write one yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Write a DaemonSet named metrics-agent that runs the image metrics-agent:v1 on every node in the cluster, including tainted control-plane nodes. Label the Pods app: metrics-agent.",
      hint: "You need spec.selector.matchLabels to agree with the template labels, and a toleration for node-role.kubernetes.io/control-plane with operator Exists and effect NoSchedule.",
      solution:
        "apiVersion: apps/v1\nkind: DaemonSet\nmetadata:\n  name: metrics-agent\nspec:\n  selector:\n    matchLabels:\n      app: metrics-agent\n  template:\n    metadata:\n      labels:\n        app: metrics-agent\n    spec:\n      tolerations:\n        - key: node-role.kubernetes.io/control-plane\n          operator: Exists\n          effect: NoSchedule\n      containers:\n        - name: agent\n          image: metrics-agent:v1",
    },
    {
      type: "heading",
      id: "deployment-vs-daemonset",
      text: "Deployment or DaemonSet?",
    },
    {
      type: "decisionTable",
      title: "Deployment vs DaemonSet",
      columns: ["Replica model", "Per-node behavior", "Typical use"],
      rows: [
        {
          label: "Deployment",
          cells: [
            "You set replicas; the scheduler places them anywhere",
            "Zero or many Pods per node, wherever they fit",
            "Stateless apps and APIs scaled to traffic",
          ],
        },
        {
          label: "DaemonSet",
          cells: [
            "No replicas; one Pod per eligible node",
            "Exactly one Pod on every matching node",
            "Node agents: logging, monitoring, CNI, storage",
          ],
        },
      ],
    },
    {
      type: "takeaways",
      items: [
        "A DaemonSet has no replica count — its size is the number of nodes that match its scheduling rules.",
        "nodeSelector and affinity narrow the node set; tolerations widen it onto tainted nodes like the control plane.",
        "A missing toleration is the classic reason an agent skips certain nodes, so DESIRED comes up short.",
        "updateStrategy RollingUpdate rolls Pods node by node; OnDelete waits for you to delete each old Pod first.",
        "Reach for a DaemonSet for node-level infrastructure, and a Deployment for traffic-scaled application replicas.",
      ],
    },
    {
      type: "quiz",
      id: "daemonsets-q1",
      question:
        "A DaemonSet shows DESIRED lower than the total number of nodes, and some tainted nodes have no agent Pod. What is the most likely cause?",
      options: [
        {
          id: "a",
          text: "The Pod template is missing a toleration for the taint on those nodes.",
          correct: true,
          explanation:
            "The scheduler excludes tainted nodes from DESIRED unless the Pod tolerates the taint, so those nodes get no Pod.",
        },
        {
          id: "b",
          text: "The replicas field is set too low.",
          correct: false,
          explanation:
            "DaemonSets have no replicas field; the count is derived from eligible nodes, not a number you set.",
        },
        {
          id: "c",
          text: "The Service selector does not match the Pods.",
          correct: false,
          explanation:
            "Services route traffic and have nothing to do with whether a DaemonSet Pod is scheduled onto a node.",
        },
        {
          id: "d",
          text: "The updateStrategy is set to OnDelete.",
          correct: false,
          explanation:
            "OnDelete only affects how existing Pods are updated; it does not stop new nodes from receiving a Pod.",
        },
      ],
    },
  ],
  labs: [],
};

const jobs: DocsLesson = {
  slug: ["workloads", "jobs-cronjobs"],
  title: "Jobs & CronJobs",
  description: "Jobs run work to completion; CronJobs create Jobs on a schedule.",
  section: "Workloads",
  order: 5,
  concepts: ["pods", "events", "logs"],
  content: [
    {
      type: "heading",
      id: "run-to-completion",
      text: "Run to completion, not forever",
    },
    {
      type: "paragraph",
      text: "A Deployment assumes its Pods should run forever: if one exits, even with exit code 0, the controller restarts it to hold the desired replica count. A Job assumes the opposite. It runs Pods until a fixed number of them exit successfully, then stops and stays finished. This single difference in expectation is why you cannot model a database migration or a nightly report as a Deployment — a Deployment would treat a successful exit as a crash and loop forever.",
    },
    {
      type: "heading",
      id: "completions-parallelism",
      text: "Completions and parallelism",
    },
    {
      type: "paragraph",
      text: "A Job is defined by two numbers. completions is how many Pods must exit successfully before the Job is Complete. parallelism is how many Pods the Job may run at the same time. With completions: 5 and parallelism: 2, Kubernetes keeps at most two Pods running until five have succeeded in total. Leave both unset and you get the default: one successful completion, run once. Set parallelism only (no completions) and you get a work-queue style Job that runs until any Pod exits 0.",
    },
    {
      type: "diagram",
      variant: "workload-hierarchy",
      title: "CronJob creates Jobs, Jobs create Pods",
      caption:
        "A CronJob is a factory for Jobs on a schedule; each Job is a factory for Pods that run to completion.",
    },
    {
      type: "heading",
      id: "job-manifest",
      text: "Anatomy of a Job",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A complete Job",
      caption: "The batch/v1 Job with the fields that control completion, retries, and cleanup.",
      lines: [
        {
          code: "apiVersion: batch/v1",
          note: "Jobs and CronJobs live in the batch API group, not v1",
        },
        {
          code: "kind: Job",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: migrate-db",
        },
        {
          code: "spec:",
        },
        {
          code: "  completions: 5",
          note: "the Job is Complete once 5 Pods have exited successfully",
        },
        {
          code: "  parallelism: 2",
          note: "at most 2 Pods run at the same time while working toward completions",
        },
        {
          code: "  backoffLimit: 4",
          note: "total Pod failures tolerated before the Job is marked Failed",
        },
        {
          code: "  ttlSecondsAfterFinished: 3600",
          note: "delete the finished Job (and its Pods) 1 hour after it ends, so old Jobs do not pile up",
        },
        {
          code: "  template:",
        },
        {
          code: "    spec:",
        },
        {
          code: "      restartPolicy: OnFailure",
          note: "MUST be Never or OnFailure on a Job — Always is rejected",
        },
        {
          code: "      containers:",
        },
        {
          code: "        - name: migrate",
        },
        {
          code: "          image: migrate:v1",
        },
      ],
    },
    {
      type: "heading",
      id: "cronjob",
      text: "CronJobs schedule Jobs",
    },
    {
      type: "paragraph",
      text: "A CronJob does not run Pods itself. On each scheduled tick it stamps out a new Job from its jobTemplate, and that Job runs Pods to completion the same way a hand-written Job would. The schedule uses standard Unix cron syntax with five fields — minute, hour, day-of-month, month, day-of-week — evaluated in the controller's timezone unless you set spec.timeZone.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A CronJob",
      caption: "schedule, concurrency, and the deadline for a late start.",
      lines: [
        {
          code: "apiVersion: batch/v1",
          note: "CronJob is stable in batch/v1 since Kubernetes 1.21",
        },
        {
          code: "kind: CronJob",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: nightly-report",
        },
        {
          code: "spec:",
        },
        {
          code: '  schedule: "0 2 * * *"',
          note: "minute hour day-of-month month day-of-week -> 02:00 every day",
        },
        {
          code: "  concurrencyPolicy: Forbid",
          note: "skip a new run while the previous run is still going",
        },
        {
          code: "  startingDeadlineSeconds: 200",
          note: "if the controller misses the tick, only start the run if fewer than 200s late",
        },
        {
          code: "  successfulJobsHistoryLimit: 3",
          note: "keep the last 3 completed Jobs for inspection, then garbage-collect",
        },
        {
          code: "  jobTemplate:",
          note: "the template the CronJob stamps into a real Job each tick",
        },
        {
          code: "    spec:",
        },
        {
          code: "      template:",
        },
        {
          code: "        spec:",
        },
        {
          code: "          restartPolicy: Never",
          note: "same rule as any Job Pod: Never or OnFailure only",
        },
        {
          code: "          containers:",
        },
        {
          code: "            - name: report",
        },
        {
          code: "              image: reporter:v1",
        },
      ],
    },
    {
      type: "heading",
      id: "build-cron",
      text: "Read a cron schedule field by field",
    },
    {
      type: "buildUp",
      language: "markdown",
      title: "The same job, four schedules",
      stages: [
        {
          label: "Every day at 02:00",
          note: "Fields are minute hour day-of-month month day-of-week. A field of * means 'every'. Minute 0, hour 2, every day.",
          code: "0 2 * * *",
        },
        {
          label: "Every 15 minutes",
          note: "*/15 in the minute field means 'every 15th minute'. The other fields stay * so it fires all day, every day.",
          code: "*/15 * * * *",
        },
        {
          label: "Weekdays at 09:00",
          note: "day-of-week 1-5 is Monday through Friday (0 and 7 are both Sunday). Minute 0, hour 9.",
          code: "0 9 * * 1-5",
        },
        {
          label: "First of the month, midnight",
          note: "day-of-month 1 with minute and hour at 0. Runs once a month at 00:00.",
          code: "0 0 1 * *",
        },
      ],
    },
    {
      type: "heading",
      id: "failure-rules",
      text: "backoffLimit and restartPolicy",
    },
    {
      type: "concept",
      term: "backoffLimit vs restartPolicy",
      definition:
        "restartPolicy is a container-level setting that decides what happens inside one Pod: OnFailure restarts the container in place after a non-zero exit; Never lets the Pod fail and leaves a new Pod to the Job controller. backoffLimit is a Job-level counter of how many Pod failures the Job tolerates in total before it gives up and reports Failed. They work together: OnFailure retries cheaply inside a Pod, while backoffLimit caps the blast radius across all Pods with an exponential back-off between attempts.",
    },
    {
      type: "callout",
      tone: "key",
      title: "concurrencyPolicy controls overlap",
      text: "When a CronJob's next tick arrives and the previous run has not finished, concurrencyPolicy decides what happens. Allow (the default) lets runs overlap. Forbid skips the new run and waits for the next tick. Replace cancels the still-running Job and starts a fresh one. Reach for Forbid or Replace whenever two copies of the work must never run at once — for example a job that writes to the same file or table.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Missed schedules and the starting deadline",
      text: "If the CronJob controller is down or the cluster is busy, a scheduled tick can be missed. startingDeadlineSeconds is how late a missed run may still be started; past that window the run is skipped and counted as missed. If more than 100 schedules are missed with no deadline set, the controller stops scheduling entirely and logs an error — so set a sane startingDeadlineSeconds on any frequent CronJob.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a broken Job",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt: "This Job is rejected by the API server the moment you apply it. Why?",
      code: "apiVersion: batch/v1\nkind: Job\nmetadata:\n  name: import-users\nspec:\n  backoffLimit: 3\n  template:\n    spec:\n      restartPolicy: Always\n      containers:\n        - name: import\n          image: importer:v1",
      answer:
        "restartPolicy: Always is invalid on a Job. A Job Pod may only use Never or OnFailure. Always would restart the container after every exit — including a successful exit — so the Pod could never reach a terminal Succeeded state and the Job could never be marked Complete. The API server rejects it with a validation error. Fix: use restartPolicy: OnFailure (or Never).",
    },
    {
      type: "heading",
      id: "write-cron",
      text: "Write one yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Write a CronJob named cleanup that runs every 15 minutes, never lets two runs overlap, and runs a container image cleaner:v1. Use a valid Job restartPolicy.",
      hint: "You need spec.schedule (cron), spec.concurrencyPolicy: Forbid, and a jobTemplate.spec.template.spec with restartPolicy and one container.",
      solution:
        'apiVersion: batch/v1\nkind: CronJob\nmetadata:\n  name: cleanup\nspec:\n  schedule: "*/15 * * * *"\n  concurrencyPolicy: Forbid\n  jobTemplate:\n    spec:\n      template:\n        spec:\n          restartPolicy: OnFailure\n          containers:\n            - name: cleaner\n              image: cleaner:v1',
    },
    {
      type: "heading",
      id: "which-workload",
      text: "Deployment, Job, or CronJob?",
    },
    {
      type: "decisionTable",
      title: "Choosing a workload controller",
      columns: ["Lifecycle", "Restart behavior", "Use case"],
      rows: [
        {
          label: "Deployment",
          cells: [
            "Runs forever toward a desired replica count",
            "Always restarts Pods, even after a clean exit",
            "Long-running services: APIs, web apps, workers",
          ],
        },
        {
          label: "Job",
          cells: [
            "Runs to completion, then stays finished",
            "restartPolicy Never or OnFailure; backoffLimit caps total retries",
            "One-off batch work: migrations, imports, report generation",
          ],
        },
        {
          label: "CronJob",
          cells: [
            "Creates a new Job on each cron tick",
            "Each run inherits Job restart rules; concurrencyPolicy governs overlap",
            "Recurring tasks: backups, cleanup, scheduled reports",
          ],
        },
      ],
    },
    {
      type: "takeaways",
      items: [
        "A Job runs Pods until completions succeed, then stops; a Deployment would restart a successful Pod forever.",
        "completions is how many successes are needed; parallelism is how many Pods run at once.",
        "A Job Pod's restartPolicy must be Never or OnFailure — Always is rejected by the API server.",
        "backoffLimit caps total Pod failures before the Job is marked Failed, with exponential back-off between attempts.",
        "A CronJob stamps out a Job per cron tick; concurrencyPolicy (Allow, Forbid, Replace) decides what happens when runs would overlap.",
        "Use ttlSecondsAfterFinished and history limits so finished Jobs are garbage-collected instead of piling up.",
      ],
    },
    {
      type: "quiz",
      id: "jobs-q1",
      question:
        "A CronJob's job sometimes takes longer than its every-5-minute schedule, and you must never let two runs write to the same table at once. Which setting fixes this?",
      options: [
        {
          id: "a",
          text: "concurrencyPolicy: Forbid",
          correct: true,
          explanation:
            "Forbid skips a new run while the previous run is still going, guaranteeing runs never overlap.",
        },
        {
          id: "b",
          text: "concurrencyPolicy: Allow",
          correct: false,
          explanation:
            "Allow is the default and explicitly permits overlapping runs, which is exactly the problem here.",
        },
        {
          id: "c",
          text: "restartPolicy: Always",
          correct: false,
          explanation:
            "restartPolicy is not valid as Always on a Job, and it controls container restarts within a Pod, not overlap between scheduled runs.",
        },
        {
          id: "d",
          text: "backoffLimit: 0",
          correct: false,
          explanation:
            "backoffLimit caps retries after failures; it does nothing to prevent two concurrent runs from starting.",
        },
      ],
    },
  ],
  labs: [],
};

const podComposition: DocsLesson = {
  slug: ["workloads", "init-sidecars-lifecycle"],
  title: "Init Containers, Sidecars & Lifecycle Hooks",
  description:
    "Compose Pods with startup steps, helper containers, and lifecycle hooks without hiding app behavior.",
  section: "Workloads",
  order: 6,
  concepts: ["pods", "init-containers", "sidecar-containers", "lifecycle-hooks"],
  content: [
    {
      type: "heading",
      id: "pod-composition",
      text: "Pod composition patterns",
    },
    {
      type: "paragraph",
      text: "A Pod is rarely just one process. It is a set of containers that share a network namespace and storage volumes, but that play different lifecycle roles. Init containers run to completion, one at a time, in order, before any app container starts. Native sidecars start before the app and keep running alongside it. Lifecycle hooks let a container run a command right after it starts (postStart) or right before it is asked to stop (preStop). Getting the composition right is mostly about ordering: what must finish first, what must be alive the whole time, and what must happen on the way out.",
    },
    {
      type: "diagram",
      variant: "pod",
      title: "One Pod, three lifecycle roles",
      caption:
        "Init containers finish first, native sidecars run for the Pod's whole life, and preStop hooks fire on the way down.",
    },
    {
      type: "heading",
      id: "init-ordering",
      text: "Init containers run to completion, in order",
    },
    {
      type: "paragraph",
      text: "Init containers are the setup crew. Kubernetes starts them one after another in the order they appear under initContainers. Each one must exit 0 before the next begins, and all of them must succeed before the first app container starts. If an init container exits non-zero, the kubelet restarts it according to the Pod's restartPolicy and the Pod stays in Init:Error or Init:CrashLoopBackOff — the app never runs. Use them for work that must be done and finished first: schema migrations, waiting for a dependency to be reachable, or fetching a config bundle into a shared volume.",
    },
    {
      type: "concept",
      term: "Ordering guarantee",
      definition:
        "Regular init containers are strictly sequential and must each terminate successfully. The app container's start is gated on the last init container's exit code, which is why a hung init container blocks the whole Pod.",
    },
    {
      type: "heading",
      id: "native-sidecars",
      text: "Native sidecars: init containers that stay running",
    },
    {
      type: "paragraph",
      text: "A native sidecar is an init container with restartPolicy: Always. That one field changes the rules. Kubernetes still starts it in init order — before the app containers — but instead of waiting for it to exit, it waits for it to start (and pass its startup probe, if defined) and then moves on. The sidecar keeps running for the whole life of the Pod. On shutdown the order reverses: app containers are terminated first, then the sidecars, so a logging or proxy sidecar is still alive to flush the last of the app's traffic. Native sidecars are stable as of Kubernetes 1.29, and they replace the old pattern of adding a helper to the containers list and hoping ordering worked out.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A Pod with an init container, a native sidecar, and a preStop hook",
      caption:
        "Read the initContainers list top to bottom: run-migrations must finish, then log-agent starts and stays up, then the app runs.",
      lines: [
        {
          code: "apiVersion: v1",
        },
        {
          code: "kind: Pod",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: web",
        },
        {
          code: "spec:",
        },
        {
          code: "  initContainers:",
          note: "runs before spec.containers, in listed order",
        },
        {
          code: "    - name: run-migrations",
          note: "a classic init container: does a job and exits",
        },
        {
          code: "      image: migrate:v1",
        },
        {
          code: '      command: ["/bin/migrate", "up"]',
          note: "must exit 0 or the Pod never leaves Init",
        },
        {
          code: "    - name: log-agent",
          note: "a NATIVE SIDECAR because of the field below",
        },
        {
          code: "      image: fluentbit:v2",
        },
        {
          code: "      restartPolicy: Always",
          note: "the one field that makes this a sidecar: starts before the app, runs alongside it, stops after it",
        },
        {
          code: "  containers:",
        },
        {
          code: "    - name: app",
          note: "starts only after migrations exit and log-agent has started",
        },
        {
          code: "      image: app:v1",
        },
        {
          code: "      lifecycle:",
        },
        {
          code: "        preStop:",
          note: "runs BEFORE SIGTERM is sent to the app process",
        },
        {
          code: "          exec:",
        },
        {
          code: '            command: ["/bin/sh", "-c", "sleep 15"]',
          note: "hold for 15s so the load balancer stops sending new traffic before we exit",
        },
        {
          code: "  terminationGracePeriodSeconds: 30",
          note: "total budget for preStop + graceful exit before SIGKILL",
        },
      ],
    },
    {
      type: "heading",
      id: "build-it",
      text: "Build the Pod up, one role at a time",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "From a bare app to init + sidecar",
      stages: [
        {
          label: "Just the app",
          note: "The starting point: a single application container. It starts immediately, with nothing running before or beside it.",
          code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  containers:\n    - name: app\n      image: app:v1",
        },
        {
          label: "Add an init container",
          note: "run-migrations now runs first and must exit 0. Only then does the app container start. Setup is guaranteed to be done before the app touches the database.",
          code: 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  initContainers:\n    - name: run-migrations\n      image: migrate:v1\n      command: ["/bin/migrate", "up"]\n  containers:\n    - name: app\n      image: app:v1',
        },
        {
          label: "Add a native sidecar",
          note: "log-agent is an init container with restartPolicy: Always. It starts after migrations, before the app, and keeps running the whole time to ship the app's logs.",
          code: 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  initContainers:\n    - name: run-migrations\n      image: migrate:v1\n      command: ["/bin/migrate", "up"]\n    - name: log-agent\n      image: fluentbit:v2\n      restartPolicy: Always\n  containers:\n    - name: app\n      image: app:v1',
        },
      ],
    },
    {
      type: "heading",
      id: "shutdown",
      text: "Graceful shutdown and the grace period",
    },
    {
      type: "callout",
      tone: "key",
      title: "preStop and terminationGracePeriodSeconds share one clock",
      text: "When a Pod is deleted, the kubelet runs the container's preStop hook first, then sends SIGTERM to the main process. terminationGracePeriodSeconds (default 30) is the total budget from the start of termination. If preStop plus the process's own graceful exit run past that budget, the container is SIGKILLed and in-flight work is dropped. A common pattern is a short preStop sleep so the endpoint is pulled from Service EndpointSlices before the app stops accepting connections — then set the grace period comfortably longer than sleep + real drain time.",
    },
    {
      type: "concept",
      term: "Shutdown ordering with sidecars",
      definition:
        "During termination, app containers stop before native sidecars. A log or proxy sidecar therefore outlives the app just long enough to flush buffered data or drain connections, which is exactly why native sidecars beat putting the helper in the plain containers list.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a Pod that never starts",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "This Pod is meant to run an app plus a log-shipping helper, but the app container never starts and the Pod is stuck in Init:0/1. What's wrong?",
      code: 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  initContainers:\n    - name: log-agent\n      image: fluentbit:v2\n      command: ["/fluent-bit/bin/fluent-bit", "-c", "/etc/fluent-bit.conf"]\n  containers:\n    - name: app\n      image: app:v1',
      answer:
        "log-agent is a long-running process placed in initContainers without restartPolicy: Always, so Kubernetes treats it as a regular init container and waits for it to EXIT before starting the app. A log shipper never exits, so the app container is blocked forever. Fix: add restartPolicy: Always to log-agent, making it a native sidecar that starts and runs alongside the app instead of blocking it.",
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write one yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Write a Pod named checkout that waits for the database to be reachable before starting, and runs a metrics-proxy container alongside the app for the Pod's whole life. Use an init container for the wait and a native sidecar for the proxy.",
      hint: "Two entries under initContainers: the wait-for-db one has no restartPolicy (it must exit), the metrics-proxy one has restartPolicy: Always (it must keep running).",
      solution:
        'apiVersion: v1\nkind: Pod\nmetadata:\n  name: checkout\nspec:\n  initContainers:\n    - name: wait-for-db\n      image: busybox:1.36\n      command: ["sh", "-c", "until nc -z db 5432; do sleep 1; done"]\n    - name: metrics-proxy\n      image: metrics-proxy:v1\n      restartPolicy: Always\n  containers:\n    - name: app\n      image: checkout:v1',
    },
    {
      type: "heading",
      id: "which-role",
      text: "Which container role do I need?",
    },
    {
      type: "decisionTable",
      title: "Init container vs native sidecar vs app container",
      columns: ["When it runs", "Lifetime", "Use for"],
      rows: [
        {
          label: "Init container",
          cells: [
            "Before app containers, sequentially",
            "Runs once, must exit 0, then stops",
            "Migrations, waiting for a dependency, seeding a shared volume",
          ],
        },
        {
          label: "Native sidecar (restartPolicy: Always)",
          cells: [
            "Starts in init order, before the app",
            "Runs the whole life of the Pod, stops after app containers",
            "Log shipping, service-mesh proxy, config or secret refreshers",
          ],
        },
        {
          label: "App container",
          cells: [
            "After all init containers and sidecars have started",
            "Runs the whole life of the Pod, stops first on shutdown",
            "The primary workload the Pod exists to run",
          ],
        },
      ],
    },
    {
      type: "takeaways",
      items: [
        "Init containers run sequentially and must each exit 0 before the app starts; a hung init container blocks the entire Pod.",
        "A native sidecar is just an init container with restartPolicy: Always — it starts before the app and runs alongside it.",
        "On shutdown, app containers stop before native sidecars, so a logging or proxy sidecar can flush or drain last.",
        "preStop runs before SIGTERM, and it shares the terminationGracePeriodSeconds budget — overrun it and the container is SIGKILLed.",
        "Putting a long-running helper in initContainers without restartPolicy: Always is a classic mistake that freezes the Pod in Init.",
      ],
    },
    {
      type: "quiz",
      id: "pod-composition-q1",
      question:
        "What single field turns an entry under initContainers into a native sidecar that runs alongside the app container?",
      options: [
        {
          id: "a",
          text: "restartPolicy: Always on the init container",
          correct: true,
          explanation:
            "That field tells Kubernetes to start the container in init order but not wait for it to exit, and to keep it running for the life of the Pod — the definition of a native sidecar (stable since 1.29).",
        },
        {
          id: "b",
          text: "A postStart lifecycle hook",
          correct: false,
          explanation:
            "postStart runs a command after the container starts, but it does not change whether the container is treated as an init container or how long it runs.",
        },
        {
          id: "c",
          text: "Moving the entry into spec.containers",
          correct: false,
          explanation:
            "That makes it an ordinary app container with no guaranteed start ordering relative to other containers, which is exactly the fragile pre-1.29 pattern native sidecars replaced.",
        },
        {
          id: "d",
          text: "Setting terminationGracePeriodSeconds higher",
          correct: false,
          explanation:
            "The grace period only affects how long shutdown may take; it has nothing to do with whether a container is a sidecar.",
        },
      ],
    },
  ],
  labs: [],
};

const services: DocsLesson = {
  slug: ["networking", "services"],
  title: "Services & Endpoints",
  description:
    "A Service is a stable address that load-balances to a changing set of Pods selected by labels.",
  section: "Networking",
  order: 0,
  concepts: ["services", "endpointslices", "labels-selectors", "networking"],
  relatedLevelSlug: "service-selector-mismatch",
  content: [
    { type: "heading", id: "why-services", text: "Why Services exist" },
    {
      type: "paragraph",
      text: "Pods are ephemeral and their IPs change. A Service gives clients one durable name and virtual IP. It selects Pods by label and forwards traffic only to matching Ready Pods.",
    },
    { type: "diagram", variant: "service-routing", title: "Service routing path" },
    { type: "heading", id: "anatomy", text: "Anatomy of a Service" },
    {
      type: "paragraph",
      text: "A Service has only three things that matter: which Pods it routes to (selector), the port clients connect to (port), and the port the container listens on (targetPort). Read every Service through these three lenses.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A complete Service",
      caption: "Every field you need for in-cluster routing.",
      lines: [
        { code: "apiVersion: v1" },
        { code: "kind: Service" },
        {
          code: "metadata:",
          note: "identity: name + namespace — this also becomes the DNS name clients use",
        },
        { code: "  name: web-svc" },
        { code: "  namespace: default" },
        { code: "spec:" },
        {
          code: "  selector:",
          note: "HOW the Service finds Pods — must match a Pod's labels exactly",
        },
        { code: "    app: web", note: "an exact key:value pair from the Pod's metadata.labels" },
        { code: "  ports:" },
        { code: "    - name: http" },
        {
          code: "      port: 80",
          note: "the port CLIENTS connect to (the Service's own port)",
        },
        {
          code: "      targetPort: 8080",
          note: "the port the CONTAINER listens on",
        },
        { code: "      protocol: TCP" },
      ],
    },
    { type: "heading", id: "build-it", text: "Build one from scratch" },
    {
      type: "buildUp",
      language: "yaml",
      title: "A Service grows in three steps",
      stages: [
        {
          label: "Skeleton",
          note: "Minimum valid object: apiVersion, kind, a name, and an empty spec. It routes nowhere yet — no selector, no ports.",
          code: "apiVersion: v1\nkind: Service\nmetadata:\n  name: web-svc\nspec: {}",
        },
        {
          label: "Add a selector",
          note: "Now the Service knows WHICH Pods it cares about (label app: web). Still no port, so no traffic can flow yet.",
          code: "apiVersion: v1\nkind: Service\nmetadata:\n  name: web-svc\nspec:\n  selector:\n    app: web",
        },
        {
          label: "Add ports",
          note: "Wire the ports: clients hit 80, the Service forwards to 8080 on the Pod. Now traffic can flow to matching Ready Pods.",
          code: "apiVersion: v1\nkind: Service\nmetadata:\n  name: web-svc\nspec:\n  selector:\n    app: web\n  ports:\n    - port: 80\n      targetPort: 8080",
        },
      ],
    },
    { type: "heading", id: "selector-mechanics", text: "How the selector matches Pods" },
    {
      type: "concept",
      term: "Selector to EndpointSlice",
      definition:
        "The EndpointSlice controller watches Pods matching a Service selector and publishes the Ready Pod IPs as endpoints.",
    },
    {
      type: "compare",
      caption:
        "The Service selector is compared against Pod labels, key for key. A single mismatch means no match.",
      left: {
        title: "Pod labels",
        code: "metadata:\n  labels:\n    app: web\n    tier: frontend",
      },
      right: {
        title: "Service selector",
        code: "spec:\n  selector:\n    app: web\n# matches — extra Pod labels are ignored",
      },
    },
    {
      type: "callout",
      tone: "key",
      title: "The three ports people confuse",
      text: "containerPort (in the Pod spec) is where the app listens. targetPort (in the Service) is where the Service sends traffic — it usually equals containerPort. port (in the Service) is what clients connect to. Three different numbers that must agree end to end.",
    },
    { type: "heading", id: "spot-the-bug", text: "Read a broken Service" },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "This Service was created for the web app, but it has zero endpoints. The web Pods exist and are Ready. What's wrong?",
      code: "apiVersion: v1\nkind: Service\nmetadata:\n  name: web-svc\nspec:\n  selector:\n    app: api\n  ports:\n    - port: 80\n      targetPort: 8080",
      answer:
        "The selector says app: api, but the web Pods are labeled app: web. The selector matches no Pods, so the EndpointSlice controller publishes zero endpoints. Fix: change app: api to app: web.",
    },
    { type: "heading", id: "write-it", text: "Write one yourself" },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Write a Service named api-svc that routes to Pods labeled app: api. Clients connect on port 80, and the api container listens on 8080.",
      hint: "You need metadata.name, spec.selector, and spec.ports with port and targetPort.",
      solution:
        "apiVersion: v1\nkind: Service\nmetadata:\n  name: api-svc\nspec:\n  selector:\n    app: api\n  ports:\n    - port: 80\n      targetPort: 8080",
    },
    { type: "lab", labId: "service-selector" },
    { type: "heading", id: "service-types", text: "Which Service type?" },
    {
      type: "decisionTable",
      title: "Choosing a Service type",
      columns: ["Reachable from", "Typical use"],
      rows: [
        {
          label: "ClusterIP",
          cells: ["Inside the cluster only", "Default — service-to-service traffic"],
        },
        {
          label: "NodePort",
          cells: ["Inside + a static port per node", "Simple external access, or an LB backend"],
        },
        {
          label: "LoadBalancer",
          cells: [
            "Inside + a cloud load balancer IP",
            "Production external entry (needs a provider)",
          ],
        },
        {
          label: "Headless (clusterIP: None)",
          cells: ["Clients reach Pods directly via DNS", "StatefulSets; per-Pod clients"],
        },
      ],
    },
    quiz("services-q1", "A Service has zero endpoints. What should you check first?", [
      qOption(
        "a",
        "Selector labels and Pod readiness.",
        true,
        "Most Service endpoint failures come from selector mismatches or NotReady Pods.",
      ),
      qOption(
        "b",
        "The API server logo.",
        false,
        "The API server stores objects; Service membership comes from selectors and readiness.",
      ),
      qOption(
        "c",
        "The Deployment name only.",
        false,
        "Services do not select Deployments by name; they select Pods by labels.",
      ),
    ]),
  ],
  labs: [
    {
      id: "service-selector",
      title: "Fix Service endpoints",
      prompt: "Start from a broken selector, then change app: api to app: web and apply.",
      files: [
        { path: "pod.yaml", language: "yaml", initialValue: WEB_POD },
        { path: "service.yaml", language: "yaml", initialValue: WEB_SERVICE_BAD_SELECTOR },
      ],
      initialManifests: [],
      registeredImages: [WEB_IMAGE],
      tryChanging: "In service.yaml, change selector app from api to web.",
      tasks: [
        "Observe zero endpoints.",
        "Fix the selector.",
        "Watch the Service gain a ready endpoint.",
      ],
      commands: ["kubectl get endpoints web-svc", "kubectl describe svc web-svc"],
      debrief:
        "The Service did not care that a Pod existed. It only routed after the Pod labels matched the selector and the Pod was Ready.",
    },
  ],
};

const dns: DocsLesson = {
  slug: ["networking", "dns-in-kubernetes"],
  title: "DNS in Kubernetes",
  description: "Kubernetes DNS turns Services into names like web-svc.default.svc.cluster.local.",
  section: "Networking",
  order: 1,
  concepts: ["dns", "services", "networking", "debugging"],
  relatedLevelSlug: "dns-resolution-failure",
  content: [
    {
      type: "heading",
      id: "why-cluster-dns",
      text: "Why cluster DNS exists",
    },
    {
      type: "paragraph",
      text: "A Service gives you a stable ClusterIP, but nobody wants to hard-code virtual IPs into config. Kubernetes runs an in-cluster DNS server (CoreDNS) that turns Service and Pod objects into names your apps can resolve. CoreDNS runs as a Deployment in kube-system, fronted by a Service (historically named kube-dns) at a fixed ClusterIP such as 10.96.0.10. When a Pod starts, the kubelet writes that DNS IP into the Pod's /etc/resolv.conf, so every process in the Pod resolves Service names automatically. The mental model: DNS answers 'what address is behind this name?' — it does NOT decide whether traffic succeeds. Resolving web-svc gets you the Service's ClusterIP; the Service's EndpointSlices then decide which Ready Pod receives the request. A name can resolve perfectly and still return connection-refused when there are zero endpoints.",
    },
    {
      type: "diagram",
      variant: "service-routing",
      title: "From name to Pod",
      caption:
        "CoreDNS resolves the name to a ClusterIP; the Service then load-balances to a Ready endpoint.",
    },
    {
      type: "heading",
      id: "name-schema",
      text: "The name schema: <svc>.<ns>.svc.cluster.local",
    },
    {
      type: "paragraph",
      text: "Every ClusterIP Service gets a predictable A record following one template: <service>.<namespace>.svc.cluster.local. So a Service named web-svc in the default namespace answers to web-svc.default.svc.cluster.local, and that A record resolves to the Service's ClusterIP. The cluster domain (cluster.local) is configurable at install time, but the shape never changes: service name, then namespace, then the fixed svc marker, then the cluster domain.",
    },
    {
      type: "concept",
      term: "FQDN segments",
      definition:
        "In web-svc.default.svc.cluster.local: 'web-svc' is the Service name, 'default' is its namespace, 'svc' distinguishes Service records from Pod records (which use .pod.), and 'cluster.local' is the cluster domain. A trailing dot (web-svc.default.svc.cluster.local.) makes it fully absolute, telling the resolver to skip search-domain expansion entirely.",
    },
    {
      type: "heading",
      id: "short-names",
      text: "Short names, search domains, and ndots",
    },
    {
      type: "paragraph",
      text: "You rarely type the full name. Inside a Pod you can call http://web-svc/ and it still works, because the kubelet writes a search list and an ndots option into resolv.conf. The resolver appends each search domain in turn until one resolves. This is why a short name only reaches Services in the SAME namespace: the first search domain is <your-namespace>.svc.cluster.local, so web-svc becomes web-svc.<your-namespace>.svc.cluster.local first.",
    },
    {
      type: "annotatedCode",
      language: "markdown",
      title: "A Pod's /etc/resolv.conf",
      caption:
        "For a Pod running in the 'default' namespace. The kubelet injects all of this at Pod start.",
      lines: [
        {
          code: "nameserver 10.96.0.10",
          note: "the CoreDNS Service ClusterIP — every lookup goes here first",
        },
        {
          code: "search default.svc.cluster.local svc.cluster.local cluster.local",
          note: "search domains, tried in order; the FIRST is your own namespace, which is why short names stay namespace-local",
        },
        {
          code: "options ndots:5",
          note: "if a queried name has fewer than 5 dots, the resolver tries it WITH each search domain appended before trying it as an absolute name",
        },
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "The ndots:5 tax",
      text: "Because ndots is 5, a name like api.backend (1 dot) is first tried as api.backend.default.svc.cluster.local, then api.backend.svc.cluster.local, then api.backend.cluster.local — three failing lookups — before it is ever tried as the literal api.backend. For external hostnames this multiplies DNS traffic and adds latency. Fix it by using a fully qualified name with a trailing dot (example.com.), which resolves in one query and skips the search list.",
    },
    {
      type: "heading",
      id: "headless",
      text: "Headless Services return Pod A records",
    },
    {
      type: "paragraph",
      text: "A normal Service publishes one A record pointing at its ClusterIP. Set clusterIP: None and the Service becomes headless: it has no virtual IP, and CoreDNS instead returns one A record per Ready Pod behind the selector. The client sees the actual Pod IPs and connects to them directly. This is how StatefulSets give each Pod a stable name: <pod-name>.<service>.<namespace>.svc.cluster.local resolves to that specific Pod.",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "Turn a Service headless in three steps",
      stages: [
        {
          label: "A normal ClusterIP Service",
          note: "Standard Service: it gets a ClusterIP and one A record. DNS returns the virtual IP, and kube-proxy load-balances behind it.",
          code: "apiVersion: v1\nkind: Service\nmetadata:\n  name: cache\n  namespace: default\nspec:\n  selector:\n    app: redis\n  ports:\n    - port: 6379",
        },
        {
          label: "Make it headless",
          note: "Adding clusterIP: None removes the virtual IP. Now DNS for cache.default.svc.cluster.local returns an A record for EACH Ready Pod IP instead of a single VIP.",
          code: "apiVersion: v1\nkind: Service\nmetadata:\n  name: cache\n  namespace: default\nspec:\n  clusterIP: None\n  selector:\n    app: redis\n  ports:\n    - port: 6379",
        },
        {
          label: "Address individual Pods",
          note: "Pair the headless Service with a StatefulSet (serviceName: cache) and each Pod gets its own name: cache-0.cache.default.svc.cluster.local, cache-1.cache..., letting clients target one replica deterministically.",
          code: "apiVersion: v1\nkind: Service\nmetadata:\n  name: cache\n  namespace: default\nspec:\n  clusterIP: None\n  selector:\n    app: redis\n  ports:\n    - name: redis\n      port: 6379\n# used by: StatefulSet spec.serviceName: cache",
        },
      ],
    },
    {
      type: "compare",
      caption:
        "Same selector, different DNS answer. The clusterIP field is the only change that matters.",
      left: {
        title: "ClusterIP Service — one VIP",
        code: "$ dig +short cache.default.svc.cluster.local\n10.96.42.7\n# one stable virtual IP; kube-proxy balances behind it",
      },
      right: {
        title: "Headless (clusterIP: None) — Pod IPs",
        code: "$ dig +short cache.default.svc.cluster.local\n10.244.1.9\n10.244.2.4\n10.244.3.6\n# one A record per Ready Pod; client picks",
      },
    },
    {
      type: "heading",
      id: "srv-records",
      text: "SRV records for named ports",
    },
    {
      type: "paragraph",
      text: "When a Service port has a name, CoreDNS also publishes an SRV record that advertises both the port number and the target host, so clients can discover the port without hard-coding it. The SRV name is _<port-name>._<protocol>.<service>.<namespace>.svc.cluster.local, so a named 'http' port yields _http._tcp.web-svc.default.svc.cluster.local, whose answer '0 100 80 web-svc.default.svc.cluster.local.' carries the port (80) and target host. This matters most with headless Services, where the SRV targets are the individual Pod hostnames — a client can enumerate every replica and its port in one query.",
    },
    {
      type: "callout",
      tone: "info",
      title: "Pods get DNS too",
      text: "Beyond Services, a Pod can be resolved by its IP under the pod domain: 10-244-1-9.default.pod.cluster.local (dashes, not dots). Pods created by a StatefulSet or given a hostname/subdomain also get proper A records. Which resolver a Pod uses is set by spec.dnsPolicy — the default ClusterFirst sends cluster-suffixed names to CoreDNS and forwards everything else upstream; Default (confusingly) means 'inherit the node's resolv.conf' and skips cluster DNS.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Spot the bug: a cross-namespace call",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "This client Pod lives in the 'frontend' namespace and needs to reach a Service 'web-svc' that lives in the 'backend' namespace. Connections fail with a name-resolution error. What is wrong, and what are two ways to fix it?",
      code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: client\n  namespace: frontend\nspec:\n  containers:\n    - name: app\n      image: klab/web-app:1.0.0\n      env:\n        - name: UPSTREAM_URL\n          value: http://web-svc/",
      answer:
        "The short name web-svc only resolves within the caller's own namespace. The client is in 'frontend', so the resolver expands web-svc to web-svc.frontend.svc.cluster.local (the first search domain) — but the Service is in 'backend', so that record does not exist. Short names never cross namespaces. Fix by qualifying the namespace: http://web-svc.backend/ (which the search list completes to ...svc.cluster.local), or use the full FQDN http://web-svc.backend.svc.cluster.local/ for an unambiguous, search-independent name.",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Write a headless Service named 'cache' in the 'data' namespace that selects Pods labeled app: redis and exposes a named port 'redis' on 6379, so clients receive per-Pod A records instead of a single virtual IP.",
      hint: "Headless means one field: clusterIP: None. Give the port a name so an SRV record is published too.",
      solution:
        "apiVersion: v1\nkind: Service\nmetadata:\n  name: cache\n  namespace: data\nspec:\n  clusterIP: None\n  selector:\n    app: redis\n  ports:\n    - name: redis\n      port: 6379\n      targetPort: 6379",
    },
    {
      type: "decisionTable",
      title: "Which name form should I use?",
      columns: ["Resolves how", "Best for"],
      rows: [
        {
          label: "web-svc (short name)",
          cells: [
            "Expanded via the search list; only finds Services in the caller's namespace",
            "Same-namespace calls where brevity is fine",
          ],
        },
        {
          label: "web-svc.backend",
          cells: [
            "Search list completes it to ...svc.cluster.local; reaches another namespace",
            "Cross-namespace calls in app config",
          ],
        },
        {
          label: "web-svc.backend.svc.cluster.local.",
          cells: [
            "Fully absolute (trailing dot); one query, no search-list expansion",
            "Latency-sensitive or ambiguous names; config that must be portable",
          ],
        },
      ],
    },
    {
      type: "lab",
      labId: "dns-chain",
    },
    {
      type: "takeaways",
      items: [
        "CoreDNS turns Services into names of the form <svc>.<ns>.svc.cluster.local, resolving to the Service ClusterIP.",
        "DNS only finds the address; EndpointSlices still decide whether traffic reaches a Ready Pod.",
        "Short names resolve only within the caller's namespace because the first search domain is <your-ns>.svc.cluster.local — qualify with the namespace to cross it.",
        "ndots:5 makes short and low-dot names trigger several search-domain lookups; a trailing-dot FQDN resolves in one query.",
        "Headless Services (clusterIP: None) return per-Pod A records, and named ports add SRV records for port discovery.",
      ],
    },
    {
      type: "quiz",
      id: "dns-q1",
      question: "What does a normal (ClusterIP) Service DNS name resolve to?",
      options: [
        {
          id: "a",
          text: "The Service's stable ClusterIP.",
          correct: true,
          explanation:
            "CoreDNS returns the Service's virtual IP; EndpointSlices then decide which Ready Pod actually receives the request.",
        },
        {
          id: "b",
          text: "A random Pod name.",
          correct: false,
          explanation:
            "A normal Service gives a stable VIP, not a Pod name. Per-Pod names come from headless Services.",
        },
        {
          id: "c",
          text: "Only external public IPs.",
          correct: false,
          explanation:
            "Cluster DNS primarily resolves in-cluster Service and Pod names, not public IPs.",
        },
      ],
    },
  ],
  labs: [
    {
      id: "dns-chain",
      title: "Trace an API to web Service call",
      prompt: "Run a web Service and an API Pod configured to call it by DNS name.",
      files: [
        { path: "web-pod.yaml", language: "yaml", initialValue: WEB_POD },
        { path: "web-service.yaml", language: "yaml", initialValue: WEB_SERVICE },
        { path: "api-pod.yaml", language: "yaml", initialValue: API_POD },
        { path: "api-service.yaml", language: "yaml", initialValue: API_SERVICE },
      ],
      initialManifests: [],
      registeredImages: [WEB_IMAGE, API_IMAGE],
      tryChanging: "Change UPSTREAM_URL to http://missing-svc/ and apply.",
      tasks: [
        "Start web and api.",
        "Break the upstream DNS name.",
        "Open in Playground to curl api-svc.",
      ],
      commands: ["dig web-svc", "curl http://api-svc/"],
      debrief:
        "DNS resolves a Service name first. A bad name fails before traffic can reach endpoints.",
    },
  ],
};

const ingress: DocsLesson = {
  slug: ["networking", "ingress"],
  title: "Ingress",
  description: "Ingress routes external HTTP traffic to Services using host and path rules.",
  section: "Networking",
  order: 2,
  concepts: ["services", "networking", "debugging"],
  content: [
    {
      type: "heading",
      id: "why-ingress",
      text: "Why Ingress exists",
    },
    {
      type: "paragraph",
      text: "A Service gives you a stable in-cluster address, and a LoadBalancer Service can expose one Service externally. But real sites route many hostnames and URL paths to many Services behind a single external IP. Ingress is the API object for that: L7 HTTP(S) routing at the edge of the cluster, matching on host and path and forwarding to backend Services.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Ingress is inert without a controller",
      text: "An Ingress object is just a set of routing rules stored in the API server. It does nothing on its own. You must install an ingress controller (nginx, Traefik, HAProxy, a cloud provider's, etc.). The controller watches Ingress objects and programs an actual proxy. No controller means your rules are read by nobody and no traffic is routed.",
    },
    {
      type: "diagram",
      variant: "service-routing",
      title: "Client to Ingress to Service to Pod",
      caption:
        "The controller terminates the request, matches host + path, then forwards to a backend Service, which load-balances to Ready Pods.",
    },
    {
      type: "heading",
      id: "anatomy",
      text: "Anatomy of an Ingress",
    },
    {
      type: "paragraph",
      text: "Read every Ingress through four lenses: which controller handles it (ingressClassName), which hostnames and paths it matches (rules), how each path is matched (pathType), and how HTTPS is terminated (tls). Everything below hangs off those.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A complete Ingress",
      caption: "Host + path routing, TLS termination, and a default backend.",
      lines: [
        {
          code: "apiVersion: networking.k8s.io/v1",
          note: "the stable v1 API — older betas (extensions/v1beta1) are gone",
        },
        {
          code: "kind: Ingress",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: shop-ingress",
        },
        {
          code: "  namespace: default",
          note: "an Ingress can only route to Services in its OWN namespace",
        },
        {
          code: "spec:",
        },
        {
          code: "  ingressClassName: nginx",
          note: "WHICH controller owns this Ingress — must match an installed IngressClass",
        },
        {
          code: "  tls:",
          note: "enables HTTPS; the controller terminates TLS here",
        },
        {
          code: "    - hosts:",
        },
        {
          code: "        - shop.example.com",
          note: "must match the SNI/Host the client sends",
        },
        {
          code: "      secretName: shop-tls",
          note: "a kubernetes.io/tls Secret holding tls.crt and tls.key",
        },
        {
          code: "  rules:",
        },
        {
          code: "    - host: shop.example.com",
          note: "virtual-host match; omit host to match ALL hostnames",
        },
        {
          code: "      http:",
        },
        {
          code: "        paths:",
        },
        {
          code: "          - path: /api",
          note: "URL path prefix to match on the incoming request",
        },
        {
          code: "            pathType: Prefix",
          note: "Prefix matches /api and /api/* by path element; also Exact or ImplementationSpecific",
        },
        {
          code: "            backend:",
        },
        {
          code: "              service:",
        },
        {
          code: "                name: api-svc",
          note: "the target Service — it still needs Ready endpoints of its own",
        },
        {
          code: "                port:",
        },
        {
          code: "                  number: 80",
          note: "the Service's port (not the container port)",
        },
        {
          code: "          - path: /",
          note: "a second, less-specific rule; controllers match the longest path first",
        },
        {
          code: "            pathType: Prefix",
        },
        {
          code: "            backend:",
        },
        {
          code: "              service:",
        },
        {
          code: "                name: web-svc",
        },
        {
          code: "                port:",
        },
        {
          code: "                  number: 80",
        },
        {
          code: "  defaultBackend:",
          note: "catch-all for requests that match no rule (e.g. unknown host/path)",
        },
        {
          code: "    service:",
        },
        {
          code: "      name: fallback-svc",
        },
        {
          code: "      port:",
        },
        {
          code: "        number: 80",
        },
      ],
    },
    {
      type: "heading",
      id: "build-it",
      text: "Build one from scratch",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "An Ingress grows in three steps",
      stages: [
        {
          label: "One rule, one Service",
          note: "Start minimal: name a controller with ingressClassName and send every path to a single Service. Because host is omitted, this matches any hostname.",
          code: "apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: shop-ingress\nspec:\n  ingressClassName: nginx\n  rules:\n    - http:\n        paths:\n          - path: /\n            pathType: Prefix\n            backend:\n              service:\n                name: web-svc\n                port:\n                  number: 80",
        },
        {
          label: "Add host + a path split",
          note: "Scope the rule to shop.example.com and split traffic: /api goes to api-svc, everything else to web-svc. The controller prefers the longer matching path, so /api wins over /.",
          code: "apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: shop-ingress\nspec:\n  ingressClassName: nginx\n  rules:\n    - host: shop.example.com\n      http:\n        paths:\n          - path: /api\n            pathType: Prefix\n            backend:\n              service:\n                name: api-svc\n                port:\n                  number: 80\n          - path: /\n            pathType: Prefix\n            backend:\n              service:\n                name: web-svc\n                port:\n                  number: 80",
        },
        {
          label: "Terminate TLS",
          note: "Add a tls block referencing a kubernetes.io/tls Secret. The controller now serves HTTPS for shop.example.com and decrypts before matching rules. The Secret must exist in the same namespace.",
          code: "apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: shop-ingress\nspec:\n  ingressClassName: nginx\n  tls:\n    - hosts:\n        - shop.example.com\n      secretName: shop-tls\n  rules:\n    - host: shop.example.com\n      http:\n        paths:\n          - path: /api\n            pathType: Prefix\n            backend:\n              service:\n                name: api-svc\n                port:\n                  number: 80\n          - path: /\n            pathType: Prefix\n            backend:\n              service:\n                name: web-svc\n                port:\n                  number: 80",
        },
      ],
    },
    {
      type: "heading",
      id: "pathtype",
      text: "How pathType changes matching",
    },
    {
      type: "concept",
      term: "pathType",
      definition:
        "A required field on every path that tells the controller HOW to compare the request path. Prefix matches by whole path segments (/foo matches /foo and /foo/bar but not /foobar). Exact matches the path character-for-character. ImplementationSpecific hands matching to the controller, which may use regex or vendor rules.",
    },
    {
      type: "decisionTable",
      title: "Choosing a pathType",
      columns: ["Matches", "Use when"],
      rows: [
        {
          label: "Prefix",
          cells: [
            "Path split on element boundaries: /api matches /api and /api/v1, not /apifoo",
            "The common case — routing a URL subtree to a Service",
          ],
        },
        {
          label: "Exact",
          cells: [
            "Only the exact path, case-sensitive: /healthz matches nothing else",
            "Pinning one precise URL, e.g. a single health endpoint",
          ],
        },
        {
          label: "ImplementationSpecific",
          cells: [
            "Whatever the controller decides (often regex or annotation-driven)",
            "You need controller-specific features like rewrites or regex paths",
          ],
        },
      ],
    },
    {
      type: "callout",
      tone: "key",
      title: "ingressClassName, not the old annotation",
      text: "Modern Ingress selects its controller with spec.ingressClassName, which references an IngressClass object. The legacy kubernetes.io/ingress.class annotation still works in some controllers but is deprecated. If neither is set and no IngressClass is marked default, no controller claims the Ingress and nothing routes — a silent failure with a healthy-looking object.",
    },
    {
      type: "heading",
      id: "tls",
      text: "TLS termination",
    },
    {
      type: "callout",
      tone: "info",
      title: "The TLS Secret shape",
      text: "The Secret named in spec.tls[].secretName must be type kubernetes.io/tls and contain two keys: tls.crt (the certificate chain) and tls.key (the private key). The controller loads it and terminates HTTPS, then forwards plain HTTP to the backend Service unless you configure backend re-encryption. A missing or malformed Secret means the controller falls back to a fake/default certificate and browsers show a warning.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a broken Ingress",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "This Ingress was applied without error and the object shows up in kubectl get ingress, but requests to shop.example.com never reach any Pod and the ADDRESS column stays empty. The backend Services are healthy with Ready endpoints. What's wrong?",
      code: "apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: shop-ingress\nspec:\n  rules:\n    - host: shop.example.com\n      http:\n        paths:\n          - path: /\n            pathType: Prefix\n            backend:\n              service:\n                name: web-svc\n                port:\n                  number: 80",
      answer:
        "There is no ingressClassName and no IngressClass is marked as the cluster default, so no controller claims this Ingress. The rules are valid but nobody programs a proxy from them, which is why ADDRESS stays empty and traffic is never routed. Fix: set spec.ingressClassName to an installed class (e.g. nginx), and confirm an ingress controller is actually running. The same empty-ADDRESS symptom appears if the class is set but no controller for it is installed.",
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write one yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Write an Ingress named blog-ingress handled by the nginx class. For host blog.example.com, route the exact path /health to health-svc on port 80, and route everything under / (a prefix) to blog-svc on port 80.",
      hint: "You need spec.ingressClassName, one rule with host set, and two paths — one pathType: Exact for /health and one pathType: Prefix for /. Each backend uses service.name and service.port.number.",
      solution:
        "apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: blog-ingress\nspec:\n  ingressClassName: nginx\n  rules:\n    - host: blog.example.com\n      http:\n        paths:\n          - path: /health\n            pathType: Exact\n            backend:\n              service:\n                name: health-svc\n                port:\n                  number: 80\n          - path: /\n            pathType: Prefix\n            backend:\n              service:\n                name: blog-svc\n                port:\n                  number: 80",
    },
    {
      type: "compare",
      caption:
        "pathType is not decoration. The same path string matches different requests depending on it.",
      left: {
        title: "pathType: Prefix, path: /api",
        code: "GET /api        -> match\nGET /api/v1     -> match\nGET /api/v1/x   -> match\nGET /apifoo     -> NO match",
      },
      right: {
        title: "pathType: Exact, path: /api",
        code: "GET /api        -> match\nGET /api/v1     -> NO match\nGET /api/       -> NO match\nGET /apifoo     -> NO match",
      },
    },
    {
      type: "takeaways",
      items: [
        "Ingress is L7 HTTP(S) routing rules; it never touches Pods directly — a controller does the work.",
        "No ingress controller (or no matching IngressClass) means the object exists but nothing routes.",
        "Route with host + path; pathType (Prefix, Exact, ImplementationSpecific) decides how paths are compared.",
        "spec.ingressClassName picks the controller; the kubernetes.io/ingress.class annotation is the deprecated way.",
        "TLS is terminated at the controller using a kubernetes.io/tls Secret named in spec.tls; the backend Service still needs Ready endpoints.",
      ],
    },
    {
      type: "quiz",
      id: "ingress-q1",
      question: "If an Ingress rule points to a Service with zero endpoints, what happens?",
      options: [
        {
          id: "a",
          text: "The request still fails at the backend.",
          correct: true,
          explanation:
            "Ingress routes to a Service, but the Service must still have Ready endpoints for traffic to succeed. Controllers typically return 502/503.",
        },
        {
          id: "b",
          text: "Kubernetes creates Pods automatically.",
          correct: false,
          explanation:
            "Ingress does not create workloads or replicas; it only routes to existing Services.",
        },
        {
          id: "c",
          text: "DNS is no longer needed.",
          correct: false,
          explanation:
            "External DNS still points clients at the controller, and cluster DNS still resolves the backend Service — both layers still matter.",
        },
      ],
    },
    {
      type: "quiz",
      id: "ingress-q2",
      question:
        "An Ingress object exists and looks correct, but ADDRESS is empty and nothing routes. What is the most likely cause?",
      options: [
        {
          id: "a",
          text: "No ingress controller is claiming it — ingressClassName is unset and there is no default IngressClass.",
          correct: true,
          explanation:
            "An Ingress is inert until a controller for its class programs a proxy; with no class and no controller, the rules do nothing.",
        },
        {
          id: "b",
          text: "The backend Service is using ClusterIP instead of NodePort.",
          correct: false,
          explanation:
            "Ingress controllers route to ClusterIP Services fine; the Service type is not why ADDRESS is empty.",
        },
        {
          id: "c",
          text: "The pathType was set to Prefix instead of Exact.",
          correct: false,
          explanation:
            "pathType affects which requests match a path, not whether the Ingress gets an address or is handled at all.",
        },
      ],
    },
  ],
  labs: [],
};

const serviceTypesGateway: DocsLesson = {
  slug: ["networking", "service-types-gateway-api"],
  title: "Service Types & Gateway API",
  description:
    "Choose the right Service exposure model and understand how Gateway API improves edge routing.",
  section: "Networking",
  order: 3,
  concepts: ["services", "ingress", "gateway-api", "networking"],
  content: [
    {
      type: "heading",
      id: "exposure-model",
      text: "How far does traffic need to travel?",
    },
    {
      type: "paragraph",
      text: "Every Service builds on the same core: a selector plus ports. The type field only decides the reach of the stable address it hands out — internal-only, per-node, or a real external load balancer. Pick the type by asking who needs to reach these Pods and from where, not by defaulting to whatever the last manifest used.",
    },
    {
      type: "diagram",
      variant: "service-routing",
      title: "One selector, four ways to expose it",
      caption:
        "ClusterIP is the base. NodePort and LoadBalancer layer wider reach on top of the same routing.",
    },
    {
      type: "heading",
      id: "the-five-types",
      text: "The five exposure models",
    },
    {
      type: "paragraph",
      text: "There are four values for spec.type — ClusterIP, NodePort, LoadBalancer, ExternalName — plus a fifth mode that is not a type at all: a headless Service, created by setting clusterIP: None on an otherwise normal ClusterIP Service. Each raises the reach of its predecessor, except ExternalName and headless, which change the routing behavior entirely.",
    },
    {
      type: "decisionTable",
      title: "Choosing a Service exposure model",
      columns: ["Reachable from", "Typical use", "Notes"],
      rows: [
        {
          label: "ClusterIP",
          cells: [
            "Inside the cluster only, via a virtual IP",
            "Default — service-to-service (east-west) traffic",
            "Gets a stable clusterIP and DNS name; the foundation the other types extend.",
          ],
        },
        {
          label: "NodePort",
          cells: [
            "Inside, plus a static port on every node's IP",
            "Dev/on-prem access, or a backend for an external load balancer",
            "Allocates a port in 30000-32767 by default; also keeps a ClusterIP underneath.",
          ],
        },
        {
          label: "LoadBalancer",
          cells: [
            "Inside, plus an external IP from the platform's load balancer",
            "Production external entry for a single Service",
            "Needs a cloud/MetalLB provider; also allocates a NodePort and ClusterIP under the hood.",
          ],
        },
        {
          label: "ExternalName",
          cells: [
            "Anywhere DNS resolves — points outside the cluster",
            "Alias an in-cluster name to an external hostname",
            "No selector, no ports, no proxying — returns a CNAME record only.",
          ],
        },
        {
          label: "Headless (clusterIP: None)",
          cells: [
            "Clients reach individual Pod IPs directly via DNS",
            "StatefulSets and clients that do their own load balancing",
            "No virtual IP; DNS returns one A record per Ready Pod instead of a single VIP.",
          ],
        },
      ],
    },
    {
      type: "concept",
      term: "ClusterIP is the substrate",
      definition:
        "NodePort and LoadBalancer do not replace ClusterIP — they add to it. A LoadBalancer Service still has a clusterIP and a nodePort; the external load balancer forwards to the nodePort, which forwards to the clusterIP, which balances across endpoints. Removing type: LoadBalancer just peels back the outermost layer.",
    },
    {
      type: "heading",
      id: "nodeport-anatomy",
      text: "Reading a NodePort Service",
    },
    {
      type: "paragraph",
      text: "A NodePort adds exactly one field to a ClusterIP Service — a third port number. Getting the three ports straight is the whole skill: clients hit the nodePort on a node, the node forwards to the Service port, and the Service forwards to targetPort on the Pod.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A NodePort Service",
      caption: "Same selector and ports as a ClusterIP Service, plus type and nodePort.",
      lines: [
        {
          code: "apiVersion: v1",
        },
        {
          code: "kind: Service",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: web-svc",
        },
        {
          code: "spec:",
        },
        {
          code: "  type: NodePort",
          note: "the only thing that turns a ClusterIP Service into a NodePort one",
        },
        {
          code: "  selector:",
          note: "unchanged — reach does not affect which Pods are selected",
        },
        {
          code: "    app: web",
        },
        {
          code: "  ports:",
        },
        {
          code: "    - name: http",
        },
        {
          code: "      port: 80",
          note: "the ClusterIP port — in-cluster clients still use this",
        },
        {
          code: "      targetPort: 8080",
          note: "the container port the Pod listens on",
        },
        {
          code: "      nodePort: 30080",
          note: "the static port opened on EVERY node's IP; omit it and Kubernetes picks one from 30000-32767",
        },
      ],
    },
    {
      type: "heading",
      id: "build-loadbalancer",
      text: "Grow a LoadBalancer Service",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "From internal to external in three steps",
      stages: [
        {
          label: "ClusterIP base",
          note: "A plain internal Service: a selector and a port. Reachable only from inside the cluster on its virtual IP.",
          code: "apiVersion: v1\nkind: Service\nmetadata:\n  name: web-svc\nspec:\n  selector:\n    app: web\n  ports:\n    - port: 80\n      targetPort: 8080",
        },
        {
          label: "Promote to LoadBalancer",
          note: "Adding type: LoadBalancer asks the platform for an external IP. Kubernetes also auto-allocates a NodePort that the load balancer will target.",
          code: "apiVersion: v1\nkind: Service\nmetadata:\n  name: web-svc\nspec:\n  type: LoadBalancer\n  selector:\n    app: web\n  ports:\n    - port: 80\n      targetPort: 8080",
        },
        {
          label: "Restrict the source range",
          note: "loadBalancerSourceRanges narrows who the load balancer will accept from — a common hardening step once external traffic works.",
          code: "apiVersion: v1\nkind: Service\nmetadata:\n  name: web-svc\nspec:\n  type: LoadBalancer\n  loadBalancerSourceRanges:\n    - 203.0.113.0/24\n  selector:\n    app: web\n  ports:\n    - port: 80\n      targetPort: 8080",
        },
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "LoadBalancer needs a provider",
      text: "type: LoadBalancer only provisions an external IP if something is watching for it — a cloud controller manager on a managed cluster, or MetalLB on bare metal. On a plain kind/minikube cluster the Service sits in <pending> forever because no controller fulfills the request. That pending state is not a bug in your manifest.",
    },
    {
      type: "concept",
      term: "ExternalName",
      definition:
        "type: ExternalName has no selector, no ports, and no proxying. It makes the cluster DNS return a CNAME to spec.externalName (e.g. db.example.com), letting in-cluster clients use a stable Service name for something that lives outside the cluster. Because there is no proxy, it cannot rewrite ports or terminate TLS.",
    },
    {
      type: "callout",
      tone: "key",
      title: "Headless is for per-Pod addressing",
      text: "Setting clusterIP: None makes DNS return one A record per Ready Pod instead of a single virtual IP. That is what StatefulSets rely on so each replica gets a stable per-Pod DNS name (pod-0.web-svc...), and what clients that do client-side load balancing want. It is a routing mode, not a value of spec.type.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a broken NodePort",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "This Service is meant to expose the web app on a fixed node port, but kubectl apply is rejected. What is wrong?",
      code: "apiVersion: v1\nkind: Service\nmetadata:\n  name: web-svc\nspec:\n  type: NodePort\n  selector:\n    app: web\n  ports:\n    - port: 80\n      targetPort: 8080\n      nodePort: 8080",
      answer:
        "nodePort: 8080 is outside the allowed node-port range (30000-32767 by default), so the API server rejects it with 'provided port is not in the valid range'. The nodePort must be a high port like 30080 — it is a separate number from port and targetPort. Fix: set nodePort to a value in 30000-32767, or drop the field and let Kubernetes allocate one.",
    },
    {
      type: "heading",
      id: "gateway-api",
      text: "Above Services: Gateway API",
    },
    {
      type: "paragraph",
      text: "Services expose Pods, but HTTP edge routing — host and path rules, header matching, traffic splitting — lives above them. Ingress was the first answer; Gateway API is its successor. The key idea is role separation: instead of one Ingress object owned by everyone, Gateway API splits the concern into three resources owned by three different roles.",
    },
    {
      type: "steps",
      title: "The three Gateway API resources",
      items: [
        {
          title: "GatewayClass",
          text: "Cluster-scoped, owned by the infrastructure provider. Names the controller that implements Gateways — the parallel of IngressClass or StorageClass.",
        },
        {
          title: "Gateway",
          text: "Owned by the cluster operator. Declares the actual listeners: which ports, protocols, and hostnames the edge accepts, plus TLS config.",
        },
        {
          title: "HTTPRoute",
          text: "Owned by the application developer. Attaches to a Gateway via parentRefs and defines the host/path rules that forward to backend Services.",
        },
      ],
    },
    {
      type: "diagram",
      variant: "api-object",
      title: "GatewayClass -> Gateway -> HTTPRoute",
      caption:
        "Each resource has a distinct owner; HTTPRoutes attach to a Gateway rather than redefining the listener.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "An HTTPRoute",
      caption: "The app-developer resource: it attaches to a Gateway and points at a Service.",
      lines: [
        {
          code: "apiVersion: gateway.networking.k8s.io/v1",
          note: "Gateway API is a separate API group, installed via CRDs — not the core v1 group",
        },
        {
          code: "kind: HTTPRoute",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: web-route",
        },
        {
          code: "spec:",
        },
        {
          code: "  parentRefs:",
          note: "which Gateway this route attaches to — the app dev references infra they do not own",
        },
        {
          code: "    - name: prod-gateway",
        },
        {
          code: "  hostnames:",
          note: "the virtual host(s) this route answers for; must be permitted by the Gateway listener",
        },
        {
          code: '    - "shop.example.com"',
        },
        {
          code: "  rules:",
        },
        {
          code: "    - matches:",
        },
        {
          code: "        - path:",
          note: "match rule — PathPrefix /app is explicit and typed, unlike Ingress's controller-specific path semantics",
        },
        {
          code: "            type: PathPrefix",
        },
        {
          code: "            value: /app",
        },
        {
          code: "      backendRefs:",
          note: "where matching traffic goes — a Service and its port; add weight here to split traffic",
        },
        {
          code: "        - name: web-svc",
        },
        {
          code: "          port: 80",
        },
      ],
    },
    {
      type: "compare",
      caption:
        "Ingress packs everything into one object; Gateway API separates infrastructure from application concerns.",
      left: {
        title: "Ingress",
        code: "one object, shared ownership\nhost + path rules\nfeatures via controller-specific\n  annotations\nHTTP(S) only in practice",
      },
      right: {
        title: "Gateway API",
        code: "GatewayClass (infra provider)\nGateway     (cluster operator)\nHTTPRoute   (app developer)\ntyped matches, traffic splitting\nHTTP, TCP, TLS, gRPC routes",
      },
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Write an HTTPRoute named api-route that attaches to a Gateway named prod-gateway, answers for api.example.com, and sends all traffic under the path prefix /v1 to a Service named api-svc on port 8080.",
      hint: "You need spec.parentRefs (the Gateway), spec.hostnames, and one rule with a PathPrefix match plus a backendRefs entry.",
      solution:
        'apiVersion: gateway.networking.k8s.io/v1\nkind: HTTPRoute\nmetadata:\n  name: api-route\nspec:\n  parentRefs:\n    - name: prod-gateway\n  hostnames:\n    - "api.example.com"\n  rules:\n    - matches:\n        - path:\n            type: PathPrefix\n            value: /v1\n      backendRefs:\n        - name: api-svc\n          port: 8080',
    },
    {
      type: "callout",
      tone: "info",
      title: "Gateway API is portable across controllers",
      text: "Because matches, filters, and traffic splitting are first-class fields instead of annotations, an HTTPRoute means the same thing on every conformant controller. That portability — plus role separation — is the main reason Gateway API is the recommended successor to Ingress for new HTTP edge routing.",
    },
    {
      type: "takeaways",
      items: [
        "spec.type sets reach, not routing: ClusterIP (internal), NodePort (per-node port), LoadBalancer (external IP) each layer on top of the last.",
        "ExternalName is a DNS CNAME with no proxy; headless (clusterIP: None) returns per-Pod A records for StatefulSets and client-side balancing.",
        "nodePort must fall in 30000-32767 and is a third number distinct from port and targetPort; LoadBalancer needs a provider or it stays <pending>.",
        "Gateway API splits edge routing into GatewayClass (infra), Gateway (operator), and HTTPRoute (app dev) for clean role separation.",
        "An HTTPRoute attaches to a Gateway via parentRefs and forwards to Services via backendRefs — the typed successor to Ingress.",
      ],
    },
    {
      type: "quiz",
      id: "service-types-q1",
      question: "Which Service type is the default internal-only exposure?",
      options: [
        {
          id: "a",
          text: "ClusterIP",
          correct: true,
          explanation:
            "ClusterIP gives an internal virtual IP and DNS name, reachable only from inside the cluster. It is the default and the base the other types build on.",
        },
        {
          id: "b",
          text: "ExternalName",
          correct: false,
          explanation:
            "ExternalName maps a Service name to an external DNS name via a CNAME; it does not select Pods or route internally.",
        },
        {
          id: "c",
          text: "NodePort",
          correct: false,
          explanation:
            "NodePort extends ClusterIP by opening a static port on every node — it adds external reach rather than being internal-only.",
        },
      ],
    },
    {
      type: "quiz",
      id: "gateway-api-q1",
      question: "In Gateway API, which resource does an application developer typically own?",
      options: [
        {
          id: "a",
          text: "HTTPRoute",
          correct: true,
          explanation:
            "HTTPRoute holds the app-level host/path rules and attaches to a Gateway via parentRefs — the resource meant for application teams.",
        },
        {
          id: "b",
          text: "GatewayClass",
          correct: false,
          explanation:
            "GatewayClass is cluster-scoped and names the implementing controller; it is owned by the infrastructure provider, not app teams.",
        },
        {
          id: "c",
          text: "Gateway",
          correct: false,
          explanation:
            "The Gateway declares listeners (ports, protocols, TLS) and is owned by the cluster operator; app developers attach routes to it rather than defining it.",
        },
      ],
    },
  ],
  labs: [],
};

const logs: DocsLesson = {
  slug: ["debugging", "logs"],
  title: "Logs",
  description:
    "Container logs tell you what the process did; Kubernetes status tells you what the platform observed.",
  section: "Observability & Debugging",
  order: 0,
  concepts: ["logs", "debugging", "pods"],
  relatedLevelSlug: "pod-crashloop-mystery",
  content: [
    {
      type: "heading",
      id: "process-truth",
      text: "Logs are the process's own account",
    },
    {
      type: "paragraph",
      text: "A container log is simply whatever the process wrote to its standard output and standard error streams. Kubernetes does not parse or understand it — it captures those bytes and hands them back to you. That gives logs a special role in debugging: status and events tell you what the platform observed from the outside, while logs tell you what the application itself claims happened on the inside. When a Pod restarts or serves errors, read both: logs explain the process, events explain the platform reaction.",
    },
    {
      type: "callout",
      tone: "key",
      title: "The stdout/stderr contract",
      text: "The Kubernetes logging convention (and the 12-factor rule) is that a containerized process writes its logs to stdout and stderr and never manages its own log files. The container runtime redirects both streams into a file on the node, and `kubectl logs` reads that file. If your app writes to /var/log/app.log instead, `kubectl logs` sees nothing — the stream, not the file, is the interface.",
    },
    {
      type: "annotatedCode",
      language: "json",
      title: "Anatomy of a structured log line",
      caption:
        "One line of stdout. Structured (JSON) logs are trivial for a node agent to index later.",
      lines: [
        {
          code: "{",
        },
        {
          code: '  "ts": "2026-07-10T09:12:44Z",',
          note: "an explicit timestamp from the app — do not rely on the collector's clock",
        },
        {
          code: '  "level": "error",',
          note: "severity you can filter on: stderr is conventional for warnings and errors",
        },
        {
          code: '  "msg": "connection refused",',
          note: "the human-readable event — this is the line you scan for during an incident",
        },
        {
          code: '  "svc": "checkout",',
          note: "which component emitted it; invaluable once many Pods share a backend",
        },
        {
          code: '  "upstream": "payments:8080",',
          note: "context that turns a vague error into an actionable one",
        },
        {
          code: '  "trace_id": "a1b2c3"',
          note: "correlates this line with the same request across other services",
        },
        {
          code: "}",
        },
      ],
    },
    {
      type: "diagram",
      variant: "debug-loop",
      title: "The logs debugging loop",
      caption:
        "Observe status, read logs for the process cause, confirm with events, then act — and repeat.",
    },
    {
      type: "heading",
      id: "reading-logs",
      text: "Reading logs, flag by flag",
    },
    {
      type: "demo",
      title: "Read a running Pod's logs",
      description:
        "The everyday workflow: confirm the Pod's state, read what it has printed, then follow it live if you need to watch behavior as it happens.",
      steps: [
        {
          label: "Check state first",
          detail:
            "Restart count and status tell you whether you are reading a healthy process or a flapping one.",
          command: "kubectl get pods",
          output:
            "NAME      READY   STATUS    RESTARTS   AGE\nweb       1/1     Running   0          6m",
        },
        {
          label: "Read what it printed",
          detail: "Plain `kubectl logs` dumps the current container instance's stdout and stderr.",
          command: "kubectl logs web",
          output:
            '{"level":"info","msg":"listening on :8080"}\n{"level":"info","msg":"GET /healthz 200"}',
        },
        {
          label: "Follow it live",
          detail:
            "`-f` streams new lines as they are written — the log equivalent of tail -f. Ctrl-C to stop.",
          command: "kubectl logs -f web --since=5m",
          output:
            '{"level":"info","msg":"GET /readyz 404"}\n{"level":"warn","msg":"readiness not yet green"}',
        },
      ],
    },
    {
      type: "buildUp",
      language: "markdown",
      title: "Grow a logs command from blunt to surgical",
      stages: [
        {
          label: "The blunt default",
          note: "Dumps everything the current instance of the (first/default) container has printed. Fine for a small, single-container Pod; overwhelming otherwise.",
          code: "kubectl logs web",
        },
        {
          label: "Target one container, trim the volume",
          note: "In a multi-container Pod you MUST say which container with -c, or kubectl errors / picks only the default one. --tail=100 keeps just the recent lines so you are not scrolling through hours of noise.",
          code: "kubectl logs web -c api --tail=100",
        },
        {
          label: "Scope to the incident, on the instance that crashed",
          note: "--previous reads the terminated instance (the one that actually failed), and --since=1h ignores anything older than the incident window. Note: -f (follow) cannot be combined with --previous — a dead instance produces no new lines.",
          code: "kubectl logs web -c api --previous --since=1h",
        },
      ],
    },
    {
      type: "decisionTable",
      title: "Which flag do I reach for?",
      columns: ["What it does", "Reach for it when"],
      rows: [
        {
          label: "-c <name>",
          cells: [
            "Selects one container in a multi-container Pod",
            "The Pod has an app plus a sidecar or init container",
          ],
        },
        {
          label: "--previous (-p)",
          cells: [
            "Shows the previous, terminated instance's logs",
            "The container just restarted or is in CrashLoopBackOff",
          ],
        },
        {
          label: "-f",
          cells: [
            "Streams new lines live (follow)",
            "You are reproducing a bug and want to watch it happen",
          ],
        },
        {
          label: "--since / --since-time",
          cells: [
            "Only lines newer than a duration or timestamp",
            "You know roughly when the incident began and want to skip old noise",
          ],
        },
        {
          label: "--tail=N",
          cells: [
            "Only the last N lines",
            "The log is huge and you only care about the recent tail",
          ],
        },
      ],
    },
    {
      type: "heading",
      id: "vanishing",
      text: "Why logs vanish after a restart",
    },
    {
      type: "concept",
      term: "--previous (-p)",
      definition:
        "Each time the kubelet restarts a container it is a fresh instance with its own log stream. `kubectl logs` shows the CURRENT instance by default; the instance that actually crashed is the previous one. `kubectl logs --previous` reads that terminated instance's captured output — the only place the fatal error usually lives.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Current logs of a crashing Pod are often empty",
      text: "During CrashLoopBackOff the container spends most of its time waiting to be restarted, so there is no running instance and `kubectl logs` returns little or nothing. The crash message belongs to the instance that already died. Do not conclude 'it crashed silently' — reach for `--previous` before you believe there are no logs.",
    },
    {
      type: "demo",
      title: "Debug a CrashLoopBackOff with --previous",
      description:
        "The current instance has no useful output because it is stuck in backoff. The failure detail is one instance back.",
      steps: [
        {
          label: "Spot the loop",
          detail:
            "A climbing restart count with CrashLoopBackOff means the process starts and exits repeatedly.",
          command: "kubectl get pods",
          output:
            "NAME          READY   STATUS             RESTARTS   AGE\npayment-7d9   0/1     CrashLoopBackOff   5          3m",
        },
        {
          label: "Current logs look empty",
          detail:
            "Between restarts there is no live container, so the default logs command has almost nothing to show.",
          command: "kubectl logs payment-7d9",
          output: "(no output — the container is waiting to be restarted)",
        },
        {
          label: "Read the instance that died",
          detail: "--previous surfaces the fatal line from the instance that actually crashed.",
          command: "kubectl logs payment-7d9 --previous",
          output: "FATAL: could not open config /etc/app/config.yaml: no such file or directory",
        },
      ],
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Spot the debugging mistake",
    },
    {
      type: "spotTheBug",
      language: "markdown",
      prompt:
        "An engineer is investigating a Pod stuck in CrashLoopBackOff. They ran the command below, saw an empty result, and told the channel 'there are no logs, it must be crashing silently before it can log anything.' What did they get wrong, and what should they run?",
      code: "$ kubectl get pod payment-7d9\nNAME          READY   STATUS             RESTARTS   AGE\npayment-7d9   0/1     CrashLoopBackOff   5          3m\n\n$ kubectl logs payment-7d9\n$ ",
      answer:
        "They read the CURRENT container instance, which is sitting in backoff and has not run long enough to print anything — so the empty output is expected, not evidence of a silent crash. The crash happened in the PREVIOUS instance, whose captured stdout/stderr still exists. Run `kubectl logs payment-7d9 --previous` to see the fatal line from the attempt that actually died.",
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write the command yourself",
    },
    {
      type: "challenge",
      language: "markdown",
      prompt:
        "Write a single kubectl command that fetches only the last 50 log lines from the PREVIOUS (crashed) instance of the container named worker inside the Pod batch-job.",
      hint: "You need three flags: one to pick the container, one to reach the crashed instance, and one to limit the line count.",
      solution: "kubectl logs batch-job -c worker --previous --tail=50",
    },
    {
      type: "lab",
      labId: "worker-logs",
    },
    {
      type: "heading",
      id: "architecture",
      text: "Where logs actually live",
    },
    {
      type: "paragraph",
      text: "`kubectl logs` is not magic: the container runtime redirects each container's stdout and stderr into files on the node it runs on, under paths like /var/log/pods and /var/log/containers. When you run the command, the API server asks that node's kubelet to read the relevant file and stream it back. Because the bytes live in node files, they are bounded by disk — which is why long-term logging is done by a separate agent.",
    },
    {
      type: "concept",
      term: "Node-level log rotation",
      definition:
        "The kubelet rotates each container's log file once it hits a size cap (containerLogMaxSize, default 10Mi) and keeps only a limited number of rotated files (containerLogMaxFiles, default 5). Older rotated segments are deleted. So `kubectl logs` can only ever show what has not yet rotated away, and everything for a Pod is deleted when the Pod object is removed.",
    },
    {
      type: "diagram",
      variant: "cluster-architecture",
      title: "Cluster logging pipeline",
      caption:
        "Container stdout/stderr -> node log files (kubelet/runtime) -> node logging agent (DaemonSet) -> central backend.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "Logging sidecar pattern",
      caption:
        "When a legacy app can only write to a file, a sidecar re-streams that file to stdout so kubectl and the node agent can see it.",
      lines: [
        {
          code: "apiVersion: v1",
        },
        {
          code: "kind: Pod",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: app-with-logs",
        },
        {
          code: "spec:",
        },
        {
          code: "  containers:",
        },
        {
          code: "    - name: app",
          note: "the real workload — but it logs to a FILE, not stdout, so kubectl cannot see it directly",
        },
        {
          code: "      image: klab/web-app:1.0.0",
        },
        {
          code: "      volumeMounts:",
        },
        {
          code: "        - name: logs",
          note: "app and sidecar share this volume so both see the same file",
        },
        {
          code: "          mountPath: /var/log/app",
        },
        {
          code: "    - name: log-tailer",
          note: "the sidecar: its only job is to make the file visible on a stream",
        },
        {
          code: "      image: busybox:1.36",
        },
        {
          code: '      args: ["/bin/sh", "-c", "tail -n+1 -F /var/log/app/app.log"]',
          note: "tails the file to ITS OWN stdout, which the runtime now captures normally",
        },
        {
          code: "      volumeMounts:",
        },
        {
          code: "        - name: logs",
        },
        {
          code: "          mountPath: /var/log/app",
        },
        {
          code: "  volumes:",
        },
        {
          code: "    - name: logs",
          note: "an emptyDir is enough — it only needs to outlive neither container, just to be shared between them",
        },
        {
          code: "      emptyDir: {}",
        },
      ],
    },
    {
      type: "takeaways",
      items: [
        "Logs are the process's own account written to stdout/stderr; status and events are the platform's outside view.",
        "On any CrashLoopBackOff, reach for --previous — the current instance is usually empty and the crash detail lives in the terminated one.",
        "In multi-container Pods always pass -c; scope big logs with --tail and --since, and use -f to watch live (never with --previous).",
        "Node log files rotate by size and count and are deleted with the Pod, so ship logs to a backend for retention.",
        "A sidecar can turn a file-logging app into a stdout stream that both kubectl and the node agent can collect.",
      ],
    },
    {
      type: "quiz",
      id: "logs-q1",
      question:
        "A Pod is in CrashLoopBackOff and `kubectl logs <pod>` prints nothing. What is the best next command?",
      options: [
        {
          id: "a",
          text: "kubectl logs <pod> --previous",
          correct: true,
          explanation:
            "The current instance is in backoff and hasn't logged; the crash message belongs to the previous, terminated instance.",
        },
        {
          id: "b",
          text: "Delete the Pod so it restarts cleanly.",
          correct: false,
          explanation:
            "Deleting the Pod discards the very logs you need and usually re-creates the same failure.",
        },
        {
          id: "c",
          text: "kubectl logs -f <pod> and wait.",
          correct: false,
          explanation:
            "Following streams new lines from a live instance, but during backoff there is no running instance to stream from.",
        },
      ],
    },
    {
      type: "quiz",
      id: "logs-q2",
      question:
        "Why might `kubectl logs` fail to show a line your app printed an hour ago, even though the Pod is still running?",
      options: [
        {
          id: "a",
          text: "Node log files rotate by size and count, so older lines can be dropped.",
          correct: true,
          explanation:
            "The kubelet caps each container log file (default ~10Mi, 5 files); once rotated out, `kubectl logs` can no longer show them — a backend is needed for retention.",
        },
        {
          id: "b",
          text: "kubectl logs only ever shows warning and error levels.",
          correct: false,
          explanation:
            "kubectl logs returns the raw stream unfiltered; it does not understand log levels.",
        },
        {
          id: "c",
          text: "Kubernetes stores all logs in etcd, which expires them after an hour.",
          correct: false,
          explanation:
            "Logs are never stored in etcd; they live in files on the node until they rotate or the Pod is deleted.",
        },
      ],
    },
  ],
  labs: [
    {
      id: "worker-logs",
      title: "Find a missing environment variable",
      prompt:
        "The worker starts without DATABASE_URL. Add the env var from the fixed example and apply.",
      files: [{ path: "worker.yaml", language: "yaml", initialValue: WORKER_POD_BROKEN }],
      initialManifests: [],
      registeredImages: [WORKER_IMAGE],
      tryChanging: "Add the DATABASE_URL env block from the lesson text.",
      tasks: [
        "Observe the worker restart.",
        "Open in Playground for logs.",
        "Add DATABASE_URL and apply.",
      ],
      commands: ["kubectl logs worker", "kubectl describe pod worker"],
      debrief:
        "The kubelet restarted the container because the process exited. The log line identifies the missing input.",
    },
  ],
};

const events: DocsLesson = {
  slug: ["debugging", "events"],
  title: "Events",
  description:
    "Events are Kubernetes' timeline of scheduling, pulling, probing, killing, and reconciliation decisions.",
  section: "Observability & Debugging",
  order: 1,
  concepts: ["events", "debugging", "pods"],
  content: [
    {
      type: "heading",
      id: "timeline",
      text: "Events are the cluster's audit trail",
    },
    {
      type: "paragraph",
      text: "An Event is not a log line from your application. It is a short record the platform writes about itself: the scheduler saying where a Pod landed, the kubelet saying it pulled an image, a probe saying a container failed a health check. When something is stuck or broken, events are the fastest way to answer the only question that matters at first: what did Kubernetes try to do, and why did it stop? Events are their own namespaced API objects — each points at a single involved object and carries a Reason, a human Message, a Type of Normal or Warning, and timestamps. Read them time-ordered and they reconstruct the story of a failure step by step.",
    },
    {
      type: "diagram",
      variant: "debug-loop",
      title: "Events feed the debug loop",
      caption:
        "get to see what is wrong, describe to read its events, then patch the smallest field that explains them.",
    },
    {
      type: "heading",
      id: "reading-events",
      text: "Read them in time order",
    },
    {
      type: "paragraph",
      text: "By default kubectl get events returns rows in an unhelpful order. Almost always sort by the last time each event was seen, so the most recent activity sits at the bottom where a terminal naturally shows it. Look for repeated Warning rows tied to the same object — that repetition is usually the smoking gun.",
    },
    {
      type: "demo",
      title: "Sort events by timestamp",
      description: "Reconstruct what happened to a Pod that came up but never went Ready.",
      steps: [
        {
          label: "List events newest-last",
          detail:
            "The scheduling and pull steps succeeded; the readiness probe is the one that keeps failing.",
          command: "kubectl get events --sort-by=.lastTimestamp",
          output:
            'LAST SEEN   TYPE      REASON      OBJECT        MESSAGE\n2m          Normal    Scheduled   pod/web       Successfully assigned default/web to node-1\n2m          Normal    Pulled      pod/web       Container image "klab/web-app:1.0.0" already present on machine\n2m          Normal    Created     pod/web       Created container web\n2m          Normal    Started     pod/web       Started container web\n20s         Warning   Unhealthy   pod/web       Readiness probe failed: HTTP probe failed with statuscode: 404',
        },
        {
          label: "Connect the Reason back to the YAML",
          detail:
            "Unhealthy from a readiness probe means the container is running but failing its check. Open the readinessProbe section of the manifest — a 404 says the path is wrong (this image serves /healthz, not /readyz).",
          command: "kubectl get pod web -o yaml | grep -A5 readinessProbe",
        },
      ],
    },
    {
      type: "concept",
      term: "involvedObject",
      definition:
        "Every event references exactly one object it is about, stored in the involvedObject field. That is what lets kubectl attach an event to the right Pod in describe output, and what you filter on with kubectl events --for.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Events expire, and they are namespaced",
      text: "The API server garbage-collects events roughly an hour after they last fired (the default TTL is one hour). If you look an hour after an incident, the evidence may simply be gone — capture it while it is fresh. Events also live in a namespace: kubectl get events shows only the current namespace unless you add -n <ns> or -A for all namespaces.",
    },
    {
      type: "heading",
      id: "describe-events",
      text: "Events attached to one object",
    },
    {
      type: "paragraph",
      text: "You rarely list the whole namespace first. More often you already suspect one object and run kubectl describe on it. describe ends with an Events section scoped to just that object — the same records, but pre-filtered and already in time order, with an Age column and a From column naming which component wrote each one.",
    },
    {
      type: "demo",
      title: "The Events section of kubectl describe",
      description: "describe pod is where most debugging sessions actually find the answer.",
      steps: [
        {
          label: "Describe the suspect Pod",
          detail:
            "Scroll to the bottom. The From column shows default-scheduler wrote Scheduled and kubelet wrote the rest.",
          command: "kubectl describe pod web",
          output:
            'Events:\n  Type     Reason     Age                From               Message\n  ----     ------     ----               ----               -------\n  Normal   Scheduled  2m                 default-scheduler  Successfully assigned default/web to node-1\n  Normal   Pulled     2m                 kubelet            Container image "klab/web-app:1.0.0" already present on machine\n  Normal   Created    2m                 kubelet            Created container web\n  Normal   Started    2m                 kubelet            Started container web\n  Warning  Unhealthy  10s (x6 over 55s)  kubelet            Readiness probe failed: HTTP probe failed with statuscode: 404',
        },
      ],
    },
    {
      type: "callout",
      tone: "info",
      title: "Read the aggregation count",
      text: "10s (x6 over 55s) is one event row that fired 6 times, most recently 10 seconds ago, spanning 55 seconds. Kubernetes de-duplicates identical repeating events into a single row with a count instead of flooding you. A high, climbing count is itself a signal: the problem is ongoing, not a one-off.",
    },
    {
      type: "heading",
      id: "kubectl-events",
      text: "The kubectl events command",
    },
    {
      type: "paragraph",
      text: "Newer kubectl ships a dedicated kubectl events command (get events still works). It sorts by time by default, formats the age column like describe does, and adds a --for flag to scope to one object and --watch to stream new events live as they arrive — handy while you re-apply a fix and want to see the cluster react.",
    },
    {
      type: "demo",
      title: "Watch one object's events stream",
      description: "Follow a single Pod instead of grepping the whole namespace.",
      steps: [
        {
          label: "Scope to one object and follow",
          detail:
            "--for filters to that Pod's involvedObject; --watch keeps the stream open and prints each new event as it happens.",
          command: "kubectl events --for pod/web --watch",
          output:
            "LAST SEEN   TYPE      REASON      OBJECT    MESSAGE\n2m          Normal    Started     Pod/web   Started container web\n0s          Warning   Unhealthy   Pod/web   Readiness probe failed: HTTP probe failed with statuscode: 404",
        },
      ],
    },
    {
      type: "compare",
      caption:
        "Same events, two lenses: sweep the namespace when you do not yet know the culprit, or pin one object once you do.",
      left: {
        title: "Whole namespace, newest last",
        code: "kubectl get events --sort-by=.lastTimestamp",
      },
      right: {
        title: "One object, live",
        code: "kubectl events --for pod/web --watch",
      },
    },
    {
      type: "heading",
      id: "common-reasons",
      text: "Common reasons and what to do",
    },
    {
      type: "decisionTable",
      title: "Warning reasons you will actually see",
      columns: ["What it means", "Next action"],
      rows: [
        {
          label: "FailedScheduling",
          cells: [
            "The scheduler could not place the Pod on any node.",
            "Read the message for the cause (insufficient cpu/memory, taints, no matching nodeSelector or affinity). Lower requests, add capacity, or fix the constraint.",
          ],
        },
        {
          label: "ImagePullBackOff",
          cells: [
            "The kubelet could not pull the image and is backing off before retrying (often preceded by ErrImagePull).",
            "Check the image name and tag for typos, and whether the registry needs an imagePullSecret.",
          ],
        },
        {
          label: "BackOff",
          cells: [
            "The container keeps exiting and the kubelet is delaying restarts (this is the CrashLoopBackOff you see in Pod status).",
            "kubectl logs --previous to read why the last run crashed; fix the command, config, or missing dependency.",
          ],
        },
        {
          label: "Unhealthy",
          cells: [
            "A liveness or readiness probe failed. The message says which probe and the failure detail.",
            "Match the probe path/port to what the container actually serves; confirm the app is up before blaming the probe.",
          ],
        },
        {
          label: "FailedMount",
          cells: [
            "A volume could not be attached or mounted, so the container never starts.",
            "Check the referenced ConfigMap, Secret, or PVC exists in the same namespace and is bound.",
          ],
        },
      ],
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a broken Pod through its events",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      title: "Why does this Pod never go Ready?",
      prompt:
        "This Pod runs but stays 0/1 Ready, and kubectl describe pod web shows a repeating Warning: Unhealthy — Readiness probe failed: HTTP probe failed with statuscode: 404. The image is klab/web-app:1.0.0. What is wrong, and how do the events prove it?",
      code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\n  labels:\n    app: web\nspec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      ports:\n        - containerPort: 8080\n      readinessProbe:\n        httpGet:\n          path: /readyz\n          port: 8080",
      answer:
        "The readiness probe hits /readyz, but this image returns 404 on /readyz (it serves 200 on /healthz). The container is healthy and running — nothing crashed — so the only symptom is the repeating Unhealthy readiness event and a Pod that never joins Service endpoints. The Reason (Unhealthy, not BackOff or FailedScheduling) tells you it is a probe problem, not a scheduling or image problem. Fix: point the probe at /healthz.",
    },
    {
      type: "heading",
      id: "query-challenge",
      text: "Write the query yourself",
    },
    {
      type: "challenge",
      language: "markdown",
      title: "Find only the recent warnings for one Pod",
      prompt:
        "You are handed a noisy namespace mid-incident. Write the commands to (1) list every event across the namespace sorted so the newest is last, and (2) stream only the events for pod/web as they arrive so you can watch your fix take effect.",
      hint: "Sorting uses --sort-by with a field path like .lastTimestamp. Scoping one object uses kubectl events --for, and live streaming uses --watch.",
      solution:
        "# 1. Whole namespace, newest last\nkubectl get events --sort-by=.lastTimestamp\n\n# 2. One object, live\nkubectl events --for pod/web --watch\n\n# Bonus: only Warnings, across all namespaces\nkubectl get events -A --field-selector type=Warning",
    },
    { type: "lab", labId: "events-unhealthy" },
    {
      type: "takeaways",
      items: [
        "Events are the platform narrating its own decisions — not your app's logs. Read them first.",
        "Always sort by time (kubectl get events --sort-by=.lastTimestamp) and watch for repeated Warning rows on one object.",
        "kubectl describe <object> ends with an Events section already scoped and time-ordered — usually where the answer is.",
        "The Reason field is a diagnosis: FailedScheduling, ImagePullBackOff, BackOff, Unhealthy, and FailedMount each point at a different next command.",
        "Events are namespaced and expire after about an hour — capture the evidence while the incident is live.",
      ],
    },
    {
      type: "quiz",
      id: "events-q1",
      question: "What do Kubernetes Events help you reconstruct?",
      options: [
        {
          id: "a",
          text: "The platform's recent decisions and why they succeeded or failed.",
          correct: true,
          explanation:
            "Events are a time-ordered record of what the scheduler, kubelet, and controllers did to an object.",
        },
        {
          id: "b",
          text: "Your application's request logs and stack traces.",
          correct: false,
          explanation:
            "Those come from kubectl logs. Events describe the platform's actions, not your app's output.",
        },
        {
          id: "c",
          text: "The source-code diff that introduced a bug.",
          correct: false,
          explanation:
            "Events explain runtime behavior in the cluster, not version control history.",
        },
      ],
    },
    {
      type: "quiz",
      id: "events-q2",
      question:
        "You investigate an outage an hour after it happened and kubectl get events shows nothing relevant. What is the most likely reason?",
      options: [
        {
          id: "a",
          text: "Events have a short TTL (about an hour) and the old ones were garbage-collected.",
          correct: true,
          explanation:
            "Events expire by default around an hour after they last fired, so stale incidents lose their evidence.",
        },
        {
          id: "b",
          text: "Events are cluster-wide, so a namespace filter can never hide them.",
          correct: false,
          explanation:
            "Events are namespaced — the wrong namespace can also hide them — but the classic 'nothing an hour later' cause is expiry.",
        },
        {
          id: "c",
          text: "kubectl get events only ever shows Normal events, never Warnings.",
          correct: false,
          explanation: "It shows both Normal and Warning types; there is no such restriction.",
        },
      ],
    },
  ],
  labs: [
    {
      id: "events-unhealthy",
      title: "Read the events a failing Pod emits",
      prompt:
        "Apply a Pod whose readiness probe hits a path the app answers with 404, then read the Events to see why it never becomes Ready.",
      files: [{ path: "pod.yaml", language: "yaml", initialValue: WEB_POD_BAD_PROBE }],
      initialManifests: [],
      registeredImages: [WEB_IMAGE],
      tryChanging: "Change readinessProbe.httpGet.path back to /healthz and apply.",
      tasks: [
        "Apply the Pod.",
        "Run kubectl get events.",
        "Find the Unhealthy readiness-probe events.",
      ],
      commands: ["kubectl get events --sort-by=.lastTimestamp", "kubectl describe pod web"],
      debrief:
        "The readiness probe on /readyz returns 404, so the kubelet emits repeated Unhealthy events and the Pod stays NotReady. Events are the fastest way to see what the cluster is complaining about.",
    },
  ],
};

const probes: DocsLesson = {
  slug: ["debugging", "readiness-probes"],
  title: "Readiness Probes",
  description:
    "Readiness controls traffic; liveness controls restarts; startup protects slow starts.",
  section: "Observability & Debugging",
  order: 2,
  concepts: ["readiness-probes", "liveness-probes", "startup-probes", "services", "debugging"],
  relatedLevelSlug: "liveness-probe-death-spiral",
  content: [
    {
      type: "heading",
      id: "why-probes",
      text: "Why probes exist",
    },
    {
      type: "paragraph",
      text: "A running container is not the same as a working one. A process can be up but still warming a cache, waiting on a migration, or wedged in a deadlock. Probes are how the kubelet asks a container two different questions: 'Are you ready to receive traffic?' and 'Are you alive, or should I restart you?' Getting the two confused is one of the most common — and most damaging — mistakes in production Kubernetes.",
    },
    {
      type: "diagram",
      variant: "probe-gates",
      title: "How probes gate traffic and restarts",
    },
    {
      type: "heading",
      id: "three-probes",
      text: "Three probes, three jobs",
    },
    {
      type: "paragraph",
      text: "Kubernetes has three probe types, and the whole subject becomes clear once you internalize that each has a distinct consequence on failure. Readiness controls Service traffic. Liveness controls restarts. Startup protects slow-booting containers from the other two. They can all point at the same endpoint, but they are decided independently and do completely different things when they fail.",
    },
    {
      type: "concept",
      term: "readinessProbe",
      definition:
        "When it fails, the Pod's IP is removed from its Service EndpointSlices, so new traffic stops arriving — but the container is NOT restarted. When it passes again, the Pod is re-added. Use it to gate traffic during warm-up or while a dependency is unavailable.",
    },
    {
      type: "concept",
      term: "livenessProbe",
      definition:
        "When it fails failureThreshold times in a row, the kubelet KILLS and restarts the container. Use it only to recover a process that is truly stuck (deadlock, hung event loop) and cannot recover on its own. A restart must be the correct remedy.",
    },
    {
      type: "concept",
      term: "startupProbe",
      definition:
        "Runs first for slow starters. Until it succeeds, the readiness and liveness probes are DISABLED. Once it passes, it never runs again and the other two take over. It gives a slow boot a long, generous window without loosening the liveness timing you want during normal operation.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "The most common probe mistake",
      text: "Do not use liveness as a dependency check. If your liveness probe fails because the database is slow, Kubernetes will restart a perfectly healthy process — and every replica at once — turning a partial outage into a cluster-wide restart storm. Dependency health belongs in readiness (stop taking traffic), never in liveness (restart).",
    },
    {
      type: "heading",
      id: "anatomy",
      text: "Anatomy of a container with all three probes",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "One container, three probes",
      caption:
        "Each probe is decided independently. Read them by their failure consequence, not their syntax.",
      lines: [
        {
          code: "apiVersion: v1",
        },
        {
          code: "kind: Pod",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: web",
        },
        {
          code: "  labels:",
        },
        {
          code: "    app: web",
          note: "the label a Service selector matches to route traffic here",
        },
        {
          code: "spec:",
        },
        {
          code: "  containers:",
        },
        {
          code: "    - name: web",
        },
        {
          code: "      image: klab/web-app:1.0.0",
        },
        {
          code: "      ports:",
        },
        {
          code: "        - containerPort: 8080",
          note: "the port every probe below targets",
        },
        {
          code: "      startupProbe:",
          note: "runs FIRST; readiness and liveness stay disabled until this passes",
        },
        {
          code: "        httpGet:",
        },
        {
          code: "          path: /healthz",
        },
        {
          code: "          port: 8080",
        },
        {
          code: "        periodSeconds: 10",
        },
        {
          code: "        failureThreshold: 30",
          note: "30 x 10s = up to 300s to finish booting before the container is killed",
        },
        {
          code: "      readinessProbe:",
          note: "GATES TRAFFIC: failing removes the Pod from Service endpoints; it is NOT restarted",
        },
        {
          code: "        httpGet:",
        },
        {
          code: "          path: /readyz",
          note: "a readiness endpoint that also checks critical dependencies",
        },
        {
          code: "          port: 8080",
        },
        {
          code: "        periodSeconds: 5",
          note: "checked often so traffic reacts quickly to readiness changes",
        },
        {
          code: "        failureThreshold: 3",
        },
        {
          code: "      livenessProbe:",
          note: "GATES RESTARTS: failing failureThreshold times kills and restarts the container",
        },
        {
          code: "        httpGet:",
        },
        {
          code: "          path: /healthz",
          note: "a cheap 'is the process responsive' check — no dependency calls",
        },
        {
          code: "          port: 8080",
        },
        {
          code: "        periodSeconds: 10",
        },
        {
          code: "        failureThreshold: 3",
          note: "3 misses at 10s each ~ 30s of being wedged before a restart",
        },
      ],
    },
    {
      type: "heading",
      id: "probe-types",
      text: "Four ways to probe",
    },
    {
      type: "paragraph",
      text: "The httpGet field above is just one of four probe mechanisms. Any of the three probe types can use any mechanism — pick the one that actually reflects your app's health.",
    },
    {
      type: "steps",
      title: "Probe mechanisms",
      items: [
        {
          title: "httpGet",
          text: "The kubelet sends an HTTP GET; any 200-399 status is a pass. The best default for web servers — pair it with a lightweight /healthz handler.",
        },
        {
          title: "tcpSocket",
          text: "The kubelet opens a TCP connection; success = the port accepts it. Good for non-HTTP services like databases or message brokers.",
        },
        {
          title: "exec",
          text: "The kubelet runs a command inside the container; exit code 0 is a pass. Flexible but the most expensive — it forks a process every period.",
        },
        {
          title: "grpc",
          text: "The kubelet calls the standard gRPC health-checking protocol on the given port. Use it for gRPC services instead of shelling out to grpc_health_probe.",
        },
      ],
    },
    {
      type: "heading",
      id: "tuning",
      text: "Tuning the timing",
    },
    {
      type: "callout",
      tone: "key",
      title: "The four numbers that decide behavior",
      text: "initialDelaySeconds: how long to wait before the FIRST probe (0 by default). periodSeconds: how often to probe after that. timeoutSeconds: how long one probe may take before it counts as a failure (1s by default — surprisingly easy to trip). failureThreshold: how many consecutive failures trigger the action. Effective time-to-act = initialDelaySeconds + failureThreshold x periodSeconds. Compute that number before you ship a liveness probe.",
    },
    {
      type: "concept",
      term: "initialDelaySeconds vs startupProbe",
      definition:
        "A large initialDelaySeconds is a blunt fixed pause on every probe. A startupProbe is better for slow boots: it lets the app signal 'I'm up' the instant it is ready, keeps a long safety ceiling via failureThreshold, and does not slow down restart detection once the app is running.",
    },
    {
      type: "heading",
      id: "build-it",
      text: "Build the probes in stages",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "Add probes one job at a time",
      stages: [
        {
          label: "Just a container",
          note: "No probes. Kubernetes assumes the container is Ready as soon as it starts and never restarts it for being unresponsive — only if the process exits.",
          code: "spec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      ports:\n        - containerPort: 8080",
        },
        {
          label: "Add readiness",
          note: "Now the Pod only receives Service traffic once /readyz answers. If it later fails, the Pod is pulled from endpoints but keeps running — no restart, no data loss.",
          code: "spec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      ports:\n        - containerPort: 8080\n      readinessProbe:\n        httpGet:\n          path: /readyz\n          port: 8080\n        periodSeconds: 5\n        failureThreshold: 3",
        },
        {
          label: "Add liveness + startup",
          note: "Liveness recovers a wedged process. The startupProbe wraps a slow boot in a generous window so liveness cannot kill the container before it finishes starting.",
          code: "spec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      ports:\n        - containerPort: 8080\n      startupProbe:\n        httpGet:\n          path: /healthz\n          port: 8080\n        periodSeconds: 10\n        failureThreshold: 30\n      readinessProbe:\n        httpGet:\n          path: /readyz\n          port: 8080\n        periodSeconds: 5\n        failureThreshold: 3\n      livenessProbe:\n        httpGet:\n          path: /healthz\n          port: 8080\n        periodSeconds: 10\n        failureThreshold: 3",
        },
      ],
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Spot the bug: a restart loop",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      title: "Why does this Pod never stay up?",
      prompt:
        "This app needs about 40 seconds to warm its cache before /healthz returns 200. The Pod starts, runs for a bit, gets killed, and repeats forever — a CrashLoop that isn't caused by the app crashing. What is wrong, and how should it be fixed?",
      code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: slow-web\nspec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      ports:\n        - containerPort: 8080\n      livenessProbe:\n        httpGet:\n          path: /healthz\n          port: 8080\n        initialDelaySeconds: 5\n        periodSeconds: 5\n        failureThreshold: 3",
      answer:
        "The liveness probe is policing a slow start. It begins at 5s and, after 3 failures at 5s each, gives up around 20s — but the app needs ~40s to become healthy. The kubelet kills and restarts the container before it can finish booting, forever. Liveness is the wrong tool for a slow start: a restart doesn't help, because restarting just resets the 40s clock. Fix: add a startupProbe with a generous failureThreshold (for example periodSeconds 10, failureThreshold 30 = up to 300s) so liveness stays disabled until the app is up. The slow-boot concern is a startup/readiness problem, never a liveness one.",
    },
    {
      type: "heading",
      id: "decision",
      text: "Which probe for which job?",
    },
    {
      type: "decisionTable",
      title: "Readiness vs liveness vs startup",
      columns: ["On failure", "Reach for it when", "Restarts the container?"],
      rows: [
        {
          label: "readinessProbe",
          cells: [
            "Pod removed from Service endpoints; container keeps running",
            "You want to stop traffic during warm-up or while a dependency is down",
            "No",
          ],
        },
        {
          label: "livenessProbe",
          cells: [
            "Container is killed and restarted after failureThreshold misses",
            "A process can get truly wedged (deadlock) and only a restart recovers it",
            "Yes",
          ],
        },
        {
          label: "startupProbe",
          cells: [
            "Readiness and liveness stay disabled until it passes; container killed only if it never passes in time",
            "The app boots slowly and would otherwise be killed by liveness before it is ready",
            "Only if startup itself never succeeds",
          ],
        },
      ],
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write it yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      title: "Author a safe probe set",
      prompt:
        "Add probes to this container so that: traffic is gated on /readyz, a wedged process is restarted via /healthz, and a slow boot of up to ~120 seconds cannot be killed by liveness. Start from the container below.",
      hint: "You need all three probes. Give the startupProbe periodSeconds and a failureThreshold whose product is at least 120. Keep liveness pointed at a cheap /healthz.",
      solution:
        "spec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      ports:\n        - containerPort: 8080\n      startupProbe:\n        httpGet:\n          path: /healthz\n          port: 8080\n        periodSeconds: 10\n        failureThreshold: 12\n      readinessProbe:\n        httpGet:\n          path: /readyz\n          port: 8080\n        periodSeconds: 5\n        failureThreshold: 3\n      livenessProbe:\n        httpGet:\n          path: /healthz\n          port: 8080\n        periodSeconds: 10\n        failureThreshold: 3",
    },
    {
      type: "lab",
      labId: "readiness",
    },
    {
      type: "takeaways",
      items: [
        "Readiness gates traffic (removes from endpoints, no restart); liveness gates restarts (kills the container); startup protects slow boots and disables the other two until it passes.",
        "Never put a dependency check in a liveness probe — it turns a partial outage into a restart storm. Dependency health belongs in readiness.",
        "Effective time to act = initialDelaySeconds + failureThreshold x periodSeconds. Compute it before shipping a liveness probe.",
        "Prefer a startupProbe over a large initialDelaySeconds for slow starters: generous ceiling, fast reaction once running.",
        "Pick the mechanism that reflects real health: httpGet for web, tcpSocket for raw ports, exec for scripts, grpc for gRPC services.",
      ],
    },
    {
      type: "quiz",
      id: "probes-q1",
      question: "Which probe removes a Pod from Service endpoints without restarting it?",
      options: [
        {
          id: "a",
          text: "Readiness",
          correct: true,
          explanation:
            "Readiness gates traffic: on failure the Pod leaves the EndpointSlices but keeps running.",
        },
        {
          id: "b",
          text: "Liveness",
          correct: false,
          explanation:
            "Liveness restarts the container after repeated failures; it does not just remove traffic.",
        },
        {
          id: "c",
          text: "Startup",
          correct: false,
          explanation:
            "Startup only disables the other probes until the app boots; failing it eventually causes a restart, not endpoint removal.",
        },
      ],
    },
    {
      type: "quiz",
      id: "probes-q2",
      question:
        "An app takes 60s to warm up. Its liveness probe (initialDelaySeconds 5, periodSeconds 5, failureThreshold 3) keeps restarting it. What is the best fix?",
      options: [
        {
          id: "a",
          text: "Add a startupProbe with a generous failureThreshold so liveness is held off until the app is ready.",
          correct: true,
          explanation:
            "The startupProbe gives the slow boot a long window and disables liveness until it passes — exactly what slow starts need.",
        },
        {
          id: "b",
          text: "Delete the readiness probe.",
          correct: false,
          explanation:
            "Readiness is not causing the restarts; liveness is. Removing readiness would only send traffic to a not-ready Pod.",
        },
        {
          id: "c",
          text: "Lower the liveness failureThreshold to 1.",
          correct: false,
          explanation: "That makes the restart loop worse by killing the container even sooner.",
        },
        {
          id: "d",
          text: "Point liveness at the database to confirm dependencies.",
          correct: false,
          explanation:
            "Liveness must never do dependency checks — that causes restart storms and does not address the slow boot.",
        },
      ],
    },
  ],
  labs: [
    {
      id: "readiness",
      title: "Break and fix a readiness probe",
      prompt: "Apply, confirm Ready, then change the probe path to /readyz and re-apply.",
      files: [
        { path: "pod.yaml", language: "yaml", initialValue: WEB_POD },
        { path: "service.yaml", language: "yaml", initialValue: WEB_SERVICE },
      ],
      initialManifests: [],
      registeredImages: [WEB_IMAGE],
      tryChanging: "Change readinessProbe.httpGet.path to /readyz and apply.",
      tasks: [
        "Start from a healthy Pod and Service.",
        "Break the readiness path.",
        "Watch the Service endpoint disappear.",
      ],
      commands: ["kubectl get endpoints web-svc", "kubectl describe pod web"],
      debrief:
        "Readiness gates Service traffic. The Pod can keep running while the Service removes it from endpoints.",
    },
  ],
};

const kubectlDebugging: DocsLesson = {
  slug: ["debugging", "kubectl-debugging"],
  title: "kubectl Debugging",
  description: "A repeatable command sequence turns a vague outage into specific evidence.",
  section: "Observability & Debugging",
  order: 3,
  concepts: ["debugging", "events", "logs", "services"],
  content: [
    {
      type: "heading",
      id: "the-loop",
      text: "One loop for every outage",
    },
    {
      type: "paragraph",
      text: 'Debugging in Kubernetes is not guessing. It is a repeatable loop that turns a vague report ("the site is down") into a specific, provable fact ("the readiness probe returns 404 on /readyz"). Each pass narrows the search: you widen with get, focus with describe, confirm with logs, and reach inside with exec or debug. Every command answers one question and hands you the next one.',
    },
    {
      type: "diagram",
      variant: "debug-loop",
      title: "get -> describe -> logs -> exec/events",
      caption: "Widen, then narrow. Each step produces the evidence that chooses the next step.",
    },
    {
      type: "steps",
      title: "The loop, step by step",
      items: [
        {
          title: "get (widen)",
          text: "kubectl get pods,svc,deploy,endpoints -o wide shows what is visibly wrong: a Pod not Running, a Service with no endpoints, a Deployment short of replicas.",
        },
        {
          title: "describe (focus)",
          text: "kubectl describe on the broken object adds the Events log, container state, exit codes, and the last probe result — the fields the table view hides.",
        },
        {
          title: "logs (listen)",
          text: "kubectl logs is the application's own account of what happened. --previous recovers the words of a container that already crashed.",
        },
        {
          title: "exec / debug (reach in)",
          text: "When you must poke from inside the Pod's network namespace, exec into a shell, port-forward a port to your laptop, or attach an ephemeral debug container to a distroless image.",
        },
        {
          title: "patch (act)",
          text: "Change the smallest field the evidence points at, re-apply, and run the loop again to confirm the symptom is gone.",
        },
      ],
    },
    {
      type: "heading",
      id: "get-wide",
      text: "Start wide with get",
    },
    {
      type: "demo",
      title: "Widen, then narrow with get",
      description:
        "get is the fastest way to see the whole board. -o wide adds the node and Pod IP, --field-selector filters server-side, and -o yaml dumps the full live object when you need a field the table never prints.",
      steps: [
        {
          label: "See everything at once",
          detail:
            "The wide view adds IP and NODE, so you can tell a scheduling problem (no node) from an app problem (has a node but crashing).",
          command: "kubectl get pods -o wide",
          output:
            "NAME                    READY   STATUS             RESTARTS      AGE   IP           NODE     NOMINATED NODE\nweb-7d9c5b8f6c-4x2kd    0/1     CrashLoopBackOff   6 (30s ago)   8m    10.244.1.7   node-1   <none>\nweb-7d9c5b8f6c-lp8qz    1/1     Running            0             8m    10.244.2.3   node-2   <none>",
        },
        {
          label: "Filter server-side",
          detail:
            "--field-selector asks the API server to return only matching objects, instead of piping thousands of lines through grep. Great in busy namespaces.",
          command: "kubectl get pods --field-selector status.phase!=Running",
          output:
            "NAME                    READY   STATUS             RESTARTS      AGE\nweb-7d9c5b8f6c-4x2kd    0/1     CrashLoopBackOff   6 (35s ago)   8m",
        },
        {
          label: "Pull the full object",
          detail:
            "-o yaml prints the live spec AND status the controllers wrote back. status.containerStatuses is where the real reason lives.",
          command: "kubectl get pod web-7d9c5b8f6c-4x2kd -o yaml | grep -A4 'lastState:'",
          output:
            '    lastState:\n      terminated:\n        exitCode: 1\n        reason: Error\n        startedAt: "2026-07-10T09:14:02Z"',
        },
      ],
    },
    {
      type: "callout",
      tone: "info",
      title: "Three output flags worth memorising",
      text: "-o wide adds columns (IP, NODE) without changing what you asked for. -o yaml gives the complete live object including status, ideal for piping into grep or diff. --field-selector filters on a few indexed fields (status.phase, metadata.namespace, spec.nodeName) at the server, which is far cheaper than fetching everything and filtering locally.",
    },
    {
      type: "heading",
      id: "describe-step",
      text: "Describe reads you the events",
    },
    {
      type: "paragraph",
      text: "get tells you a Pod is unhealthy; describe tells you why. It stitches together the container state, restart count, the last probe result, and the Events feed — a timeline of what the scheduler and kubelet did to this object. Read the Events from the bottom up; the newest Warning is usually the headline.",
    },
    {
      type: "demo",
      title: "Describe a crashing Pod",
      description:
        "The interesting parts are the container State/Last State block and the Events at the bottom. Here the app starts, fails its readiness probe with a 404, and the kubelet keeps backing off restarts.",
      steps: [
        {
          label: "Run describe",
          detail:
            "State shows what the container is doing now; Last State shows how it died last time (Exit Code 1 = the app returned an error).",
          command: "kubectl describe pod web-7d9c5b8f6c-4x2kd",
          output:
            "Containers:\n  web:\n    Image:          klab/web-app:1.0.0\n    State:          Waiting\n      Reason:       CrashLoopBackOff\n    Last State:     Terminated\n      Reason:       Error\n      Exit Code:    1\n    Ready:          False\n    Restart Count:  6\n    Readiness:      http-get http://:8080/readyz delay=0s timeout=1s period=10s",
        },
        {
          label: "Read the Events feed",
          detail:
            "The Unhealthy Warning names the exact probe and status code. /readyz returning 404 is why READY stays 0/1 even while the process is up.",
          command: "kubectl describe pod web-7d9c5b8f6c-4x2kd | sed -n '/Events:/,$p'",
          output:
            'Events:\n  Type     Reason     Age                    From     Message\n  ----     ------     ----                   ----     -------\n  Normal   Scheduled  8m                     default-scheduler  Successfully assigned default/web-7d9c5b8f6c-4x2kd to node-1\n  Normal   Pulled     7m (x4 over 8m)        kubelet  Container image "klab/web-app:1.0.0" already present on machine\n  Warning  Unhealthy  6m (x5 over 7m)        kubelet  Readiness probe failed: HTTP probe failed with statuscode: 404\n  Warning  BackOff    45s (x21 over 6m)      kubelet  Back-off restarting failed container web',
        },
      ],
    },
    {
      type: "concept",
      term: "Events are ephemeral and namespaced",
      definition:
        "Events live in a namespace and the API server garbage-collects them (about an hour by default). If describe shows no events, they may have expired — reproduce the failure, or check controller logs. kubectl get events --field-selector reason=Unhealthy --sort-by=.lastTimestamp lists them across a namespace.",
    },
    {
      type: "heading",
      id: "logs-step",
      text: "Logs: the application's own words",
    },
    {
      type: "demo",
      title: "logs, --previous, and following",
      description:
        "logs streams stdout/stderr of one container. The two flags that save outages are --previous (the crashed instance) and -c (which container, when there is more than one).",
      steps: [
        {
          label: "The current container is empty",
          detail:
            "A CrashLoopBackOff Pod may have no running container right now, so plain logs shows nothing useful.",
          command: "kubectl logs web-7d9c5b8f6c-4x2kd",
          output:
            'Error from server (BadRequest): container "web" in pod "web-7d9c5b8f6c-4x2kd" is waiting to start: CrashLoopBackOff',
        },
        {
          label: "Recover the crashed instance",
          detail:
            "--previous prints the logs of the container that already died — usually the actual error message.",
          command: "kubectl logs web-7d9c5b8f6c-4x2kd --previous",
          output:
            "2026-07-10T09:14:01Z INFO  starting web-app 1.0.0 on :8080\n2026-07-10T09:14:02Z FATAL could not open config /etc/app/config.yaml: no such file or directory\nexit status 1",
        },
        {
          label: "Follow a whole Deployment",
          detail:
            "logs accepts a controller and a label selector; -f streams new lines. --tail limits history so you are not flooded.",
          command: "kubectl logs -f deploy/web -c web --tail=20",
          output:
            "Found 2 pods, using pod/web-7d9c5b8f6c-lp8qz\n2026-07-10T09:22:10Z INFO  GET /healthz 200\n2026-07-10T09:22:20Z INFO  GET /healthz 200",
        },
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "CrashLoopBackOff? Reach for --previous first",
      text: "The current container is either not running or is a fresh restart with no useful output yet. kubectl logs --previous is the only way to see what the instance said just before it exited. Without it you will stare at an empty log and conclude, wrongly, that the app is silent.",
    },
    {
      type: "heading",
      id: "exec-forward",
      text: "Reach inside: exec and port-forward",
    },
    {
      type: "demo",
      title: "exec into a shell, port-forward to your laptop",
      description:
        "When you need to test from the Pod's own network namespace (its DNS, its service account, its localhost), exec runs a command inside the container. port-forward tunnels a container port to 127.0.0.1 so your browser or curl can hit it directly, bypassing the Service.",
      steps: [
        {
          label: "Open an interactive shell",
          detail:
            "-i keeps stdin open, -t allocates a TTY. Everything after -- runs inside the container.",
          command: "kubectl exec -it web-7d9c5b8f6c-lp8qz -- sh",
          output:
            "/ # wget -qO- -S localhost:8080/readyz\n  HTTP/1.1 404 Not Found\n/ # wget -qO- -S localhost:8080/healthz\n  HTTP/1.1 200 OK",
        },
        {
          label: "Tunnel a port locally",
          detail:
            "port-forward maps localhost:8080 on your machine straight to the Pod, so you can reproduce a request without a working Service or Ingress.",
          command: "kubectl port-forward pod/web-7d9c5b8f6c-lp8qz 8080:8080",
          output:
            "Forwarding from 127.0.0.1:8080 -> 8080\nForwarding from [::1]:8080 -> 8080\nHandling connection for 8080",
        },
        {
          label: "Confirm from your side of the tunnel",
          detail:
            "Now curl on your laptop reaches the container directly. Same 404 on /readyz — proof the Pod itself is the problem, not the Service or DNS.",
          command: "curl -s -o /dev/null -w '%{http_code}\\n' localhost:8080/readyz",
          output: "404",
        },
      ],
    },
    {
      type: "heading",
      id: "distroless-debug",
      text: "Distroless Pods: kubectl debug",
    },
    {
      type: "callout",
      tone: "key",
      title: "No shell in the image? Bring your own",
      text: 'Distroless and scratch images ship no sh, no ps, no curl — so kubectl exec -- sh fails with "executable file not found". kubectl debug attaches an EPHEMERAL container to the running Pod. It joins the target Pod\'s namespaces (with --target it shares the process namespace too), so your busybox toolbox can see the same network, filesystem mounts, and processes as the crashing app — without rebuilding the image or restarting the Pod.',
    },
    {
      type: "demo",
      title: "Attach a debug container to a distroless Pod",
      description:
        "exec fails because the image has no shell. kubectl debug injects a throwaway container with the tools you need, sharing the target's namespaces.",
      steps: [
        {
          label: "exec has nothing to run",
          detail: "A distroless image contains only the app binary — no /bin/sh to exec into.",
          command: "kubectl exec -it api-6b4f9c7d-2mzql -- sh",
          output:
            'error: Internal error occurred: error executing command in container: failed to exec in container: failed to start exec: exec: "sh": executable file not found in $PATH',
        },
        {
          label: "Attach an ephemeral debug container",
          detail:
            "--image supplies a toolbox; --target=api shares that container's process namespace so you can inspect its PIDs.",
          command: "kubectl debug -it api-6b4f9c7d-2mzql --image=busybox:1.36 --target=api",
          output:
            "Defaulting debug container name to debugger-8xzp1.\nIf you don't see a command prompt, try pressing enter.\n/ #",
        },
        {
          label: "Inspect from inside the shared namespace",
          detail:
            "You can now see the app process and probe its localhost, even though the app image itself has no shell.",
          command: "/ # ps -o pid,args && wget -qO- -S localhost:8080/readyz",
          output: "  PID ARGS\n    1 /app/api --listen :8080\n   14 sh\n  HTTP/1.1 404 Not Found",
        },
      ],
    },
    {
      type: "heading",
      id: "choose-command",
      text: "Pick the command that fits the symptom",
    },
    {
      type: "spotTheBug",
      language: "markdown",
      title: "The wrong tool for the state",
      prompt:
        'An on-call engineer is debugging a Pod stuck in Pending and runs the session below. They conclude "the app logs nothing, it must be broken code." What did they get wrong?',
      code: '$ kubectl get pod worker-0\nNAME       READY   STATUS    RESTARTS   AGE\nworker-0   0/1     Pending   0          4m\n\n$ kubectl logs worker-0\nError from server (BadRequest): container "worker" in pod "worker-0" is waiting to start: ContainerCreating\n\n$ kubectl logs worker-0 --previous\nError from server (BadRequest): previous terminated container "worker" not found',
      answer:
        "A Pending Pod has never been scheduled to a node, so no container has started and there are no logs to read — current or previous. Pending is a scheduling state, not an application state. The right first command is kubectl describe pod worker-0 (or kubectl get events), which reveals the scheduling reason: FailedScheduling with a message like 'insufficient cpu' or 'pod has unbound immediate PersistentVolumeClaims'. Reach for logs only once a container has actually run.",
    },
    {
      type: "challenge",
      language: "markdown",
      title: "Write the investigation",
      prompt:
        "A Service web-svc suddenly returns 503s. Its Pods show 1/1 Running with no restarts. Write the ordered command sequence that proves whether the problem is (a) the Service has no endpoints, or (b) the Pod is up but the app returns errors.",
      hint: "Endpoints tell you if traffic can reach any Pod at all. A port-forward lets you hit the Pod directly, skipping the Service, to isolate app errors from routing errors.",
      solution:
        "# 1. Does the Service actually route anywhere?\nkubectl get endpoints web-svc -o wide\nkubectl describe svc web-svc          # compare selector to Pod labels\n\n# 2. If endpoints exist, hit a Pod directly, bypassing the Service\nkubectl port-forward pod/web-7d9c5b8f6c-lp8qz 8080:8080 &\ncurl -s -o /dev/null -w '%{http_code}\\n' localhost:8080/\n\n# 3. If the direct call also fails, read the app's account\nkubectl logs deploy/web --tail=50\n\n# Zero endpoints => routing/selector problem. Endpoints present but\n# the direct curl 5xx => the app itself is failing, not the Service.",
    },
    {
      type: "decisionTable",
      title: "Symptom -> first command -> what it tells you",
      columns: ["Symptom", "First command", "What it reveals"],
      rows: [
        {
          label: "Pod stuck Pending",
          cells: [
            "STATUS Pending, never Ready",
            "kubectl describe pod (or get events)",
            "FailedScheduling reason: no node fits, unbound PVC, taint/affinity",
          ],
        },
        {
          label: "CrashLoopBackOff",
          cells: [
            "Restarts climbing, STATUS CrashLoopBackOff",
            "kubectl logs <pod> --previous",
            "The crashed instance's final error before it exited",
          ],
        },
        {
          label: "Running but 0/1 Ready",
          cells: [
            "READY 0/1, process is up",
            "kubectl describe pod (Events)",
            "Which probe failed and the exact HTTP status/path",
          ],
        },
        {
          label: "Service returns nothing",
          cells: [
            "Clients time out or get 503",
            "kubectl get endpoints <svc>",
            "Whether any Ready Pod backs the Service at all",
          ],
        },
        {
          label: "ImagePullBackOff",
          cells: [
            "STATUS ImagePullBackOff/ErrImagePull",
            "kubectl describe pod (Events)",
            "Pull error: bad tag, private registry, missing pull secret",
          ],
        },
        {
          label: "Distroless, no shell",
          cells: [
            "exec -- sh fails: no such executable",
            "kubectl debug --image=busybox --target",
            "A toolbox inside the Pod's namespaces without changing the image",
          ],
        },
      ],
    },
    {
      type: "compare",
      caption: "The same outage, two ways. Guessing burns the evidence; the loop preserves it.",
      left: {
        title: "Guess and restart",
        code: "# 'Just bounce it'\nkubectl delete pod web-7d9c5b8f6c-4x2kd\n# Pod restarts, --previous logs and\n# the old Events are now gone.\n# Symptom returns in 5 minutes,\n# and you know nothing new.",
      },
      right: {
        title: "Read the evidence first",
        code: "kubectl get pods -o wide\nkubectl describe pod web-7d9c5b8f6c-4x2kd\nkubectl logs web-7d9c5b8f6c-4x2kd --previous\n# Reason in hand (missing config file),\n# THEN patch the one field that fixes it.",
      },
    },
    { type: "lab", labId: "debug-broken-deploy" },
    {
      type: "takeaways",
      items: [
        "Run the same loop every time: get to widen, describe to focus, logs to listen, exec/debug to reach in, patch to act.",
        "get -o wide separates scheduling problems (no node) from app problems; -o yaml exposes status fields; --field-selector filters cheaply at the server.",
        "describe is where the Events and container exit codes live — read Events newest-first, and remember they expire in about an hour.",
        "CrashLoopBackOff needs kubectl logs --previous; the live container has already died.",
        "Distroless images have no shell: kubectl debug attaches an ephemeral toolbox container that shares the Pod's namespaces.",
      ],
    },
    {
      type: "quiz",
      id: "kubectl-debugging-q1",
      question: "Why should you run kubectl describe after kubectl get?",
      options: [
        {
          id: "a",
          text: "describe adds Events and detailed fields (probe results, exit codes) that table output hides.",
          correct: true,
          explanation:
            "get is a summary table; describe stitches together the container state and the Events timeline that explain the failure.",
        },
        {
          id: "b",
          text: "describe automatically fixes the object.",
          correct: false,
          explanation: "describe is strictly read-only; it never mutates a resource.",
        },
        {
          id: "c",
          text: "describe deletes failed Pods so the controller recreates them.",
          correct: false,
          explanation:
            "describe does not delete or recreate anything; it only reports current state.",
        },
      ],
    },
    {
      type: "quiz",
      id: "kubectl-debugging-q2",
      question:
        "kubectl exec -it into a distroless Pod fails with 'executable file not found in $PATH'. What is the right next step?",
      options: [
        {
          id: "a",
          text: "Use kubectl debug to attach an ephemeral container with a shell that shares the Pod's namespaces.",
          correct: true,
          explanation:
            "Distroless images ship no shell, so debug injects a throwaway toolbox container into the running Pod without rebuilding the image.",
        },
        {
          id: "b",
          text: "Rebuild the image with sh baked in and redeploy before you can investigate.",
          correct: false,
          explanation:
            "That works eventually but is slow and changes the workload; kubectl debug inspects the live Pod immediately.",
        },
        {
          id: "c",
          text: "Run kubectl logs --previous, since exec is impossible on distroless images.",
          correct: false,
          explanation:
            "Logs are useful but answer a different question; they do not give you an interactive shell inside the Pod's namespaces.",
        },
      ],
    },
  ],
  labs: [
    {
      id: "debug-broken-deploy",
      title: "Diagnose a Deployment that never goes Ready",
      prompt:
        "A Deployment rolls out but no Pods become Ready. Use get, describe, and events to find the cause, then fix it.",
      files: [
        { path: "deployment.yaml", language: "yaml", initialValue: WEB_DEPLOYMENT_BAD_PROBE },
      ],
      initialManifests: [],
      registeredImages: [WEB_IMAGE],
      tryChanging: "Fix readinessProbe.httpGet.path to /healthz and re-apply.",
      tasks: [
        "Apply and see 0 Ready Pods.",
        "Describe a Pod and read its events.",
        "Fix the probe path and re-apply.",
      ],
      commands: ["kubectl get pods", "kubectl describe pod <pod>", "kubectl get events"],
      debrief:
        "get shows the symptom (NotReady); describe and events show the cause (readiness probe on /readyz returns 404). The loop is always get to see what, then describe/logs/events to see why.",
    },
  ],
};

const rollingUpdates: DocsLesson = {
  slug: ["operations", "rolling-updates"],
  title: "Rolling Updates",
  description:
    "Rolling updates replace Pods gradually so you can ship changes without dropping all capacity.",
  section: "Operations",
  order: 0,
  concepts: ["rollouts", "deployments", "replicasets", "readiness-probes"],
  relatedLevelSlug: "rolling-update-gone-wrong",
  content: [
    {
      type: "heading",
      id: "rollout-flow",
      text: "How a rollout moves",
    },
    {
      type: "paragraph",
      text: "A Deployment never edits Pods in place. When you change anything under spec.template — usually the container image — Kubernetes computes a new hash, creates a fresh ReplicaSet for that template, and then shifts capacity: it scales the new ReplicaSet up and the old one down, a few Pods at a time. Readiness decides the pace. A new Pod only counts toward the rollout once its readiness probe passes, so a rollout is really a controlled hand-off gated by health, not a bulk restart.",
    },
    {
      type: "diagram",
      variant: "rollout",
      title: "Old ReplicaSet to new ReplicaSet",
      caption:
        "The Deployment scales the new ReplicaSet up as fast as readiness allows and drains the old one down. The old ReplicaSet is not deleted — it is scaled to zero and kept for rollback.",
    },
    {
      type: "heading",
      id: "strategy",
      text: "The RollingUpdate strategy",
    },
    {
      type: "paragraph",
      text: "Two knobs control how aggressively the swap happens. maxSurge is how many Pods you may run ABOVE the desired replica count during the update. maxUnavailable is how many Pods you may be missing BELOW the desired count. Both accept a whole number or a percentage of replicas, and they default to 25%.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A Deployment with an explicit rolling-update strategy",
      caption:
        "Read spec.strategy through two questions: how many extra Pods, and how many missing Pods, are tolerated at once.",
      lines: [
        {
          code: "apiVersion: apps/v1",
        },
        {
          code: "kind: Deployment",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: web",
        },
        {
          code: "spec:",
        },
        {
          code: "  replicas: 4",
          note: "desired steady-state count — the number the rollout math is relative to",
        },
        {
          code: "  strategy:",
        },
        {
          code: "    type: RollingUpdate",
          note: "gradual replacement (the default); the alternative is Recreate",
        },
        {
          code: "    rollingUpdate:",
        },
        {
          code: "      maxSurge: 1",
          note: "may run up to replicas + 1 = 5 Pods briefly, so a new Pod can start before an old one leaves",
        },
        {
          code: "      maxUnavailable: 0",
          note: "never drop below 4 available Pods — full capacity is preserved throughout",
        },
        {
          code: "  minReadySeconds: 5",
          note: "a new Pod must stay Ready this long before it counts as Available — catches crash-on-startup",
        },
        {
          code: "  progressDeadlineSeconds: 120",
          note: "if the rollout makes no progress for this long it is marked ProgressDeadlineExceeded (it does NOT auto-roll-back)",
        },
        {
          code: "  revisionHistoryLimit: 5",
          note: "keep the last 5 old ReplicaSets for `kubectl rollout undo`; older ones are garbage-collected",
        },
        {
          code: "  selector:",
        },
        {
          code: "    matchLabels:",
        },
        {
          code: "      app: web",
        },
        {
          code: "  template:",
        },
        {
          code: "    metadata:",
        },
        {
          code: "      labels:",
        },
        {
          code: "        app: web",
        },
        {
          code: "    spec:",
        },
        {
          code: "      containers:",
        },
        {
          code: "        - name: web",
        },
        {
          code: "          image: klab/web-app:1.0.0",
          note: "changing THIS line is what triggers a new ReplicaSet and a rollout",
        },
        {
          code: "          readinessProbe:",
          note: "the gate — until this passes, the new Pod is not counted as available",
        },
        {
          code: "            httpGet:",
        },
        {
          code: "              path: /healthz",
        },
        {
          code: "              port: 8080",
        },
      ],
    },
    {
      type: "concept",
      term: "maxSurge and maxUnavailable",
      definition:
        "maxSurge is the ceiling of extra Pods above replicas during a rollout; maxUnavailable is the floor of missing Pods below replicas. They cannot both be 0 — that would give the rollout no room to move. maxUnavailable: 0 with maxSurge > 0 is the zero-downtime setting (add before removing); maxUnavailable > 0 with maxSurge: 0 replaces in place without ever exceeding the replica count.",
    },
    {
      type: "callout",
      tone: "key",
      title: "The two knobs set the pace, readiness sets the timing",
      text: "maxSurge and maxUnavailable define the WINDOW the controller may operate in. But the controller only advances a step once new Pods actually become Ready. If Pods never go Ready, the strategy math is irrelevant — the rollout simply waits inside its allowed window.",
    },
    {
      type: "heading",
      id: "readiness-gates",
      text: "Readiness gates every step",
    },
    {
      type: "paragraph",
      text: "This is the single most important thing to internalise: a rolling update is safe only because readiness gates it. A newly created Pod is Running long before it can serve traffic. Until its readiness probe passes it is not added to the Service's endpoints and not counted as available, so the Deployment will not scale the old ReplicaSet down any further. A broken new version therefore stalls the rollout instead of taking down the old one.",
    },
    {
      type: "diagram",
      variant: "probe-gates",
      title: "Readiness gates the rollout step",
      caption:
        "A new Pod joins endpoints and unlocks the next scale-down step only after its readiness probe passes.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "No readiness probe = no real gate",
      text: "With no readinessProbe, a Pod counts as available the moment its container is Running. Kubernetes will happily roll forward onto a version that starts but cannot serve, and route traffic to it. The rolling-update safety net is only as good as your readiness probe.",
    },
    {
      type: "heading",
      id: "recreate-vs-rolling",
      text: "RollingUpdate vs Recreate",
    },
    {
      type: "paragraph",
      text: "RollingUpdate keeps the app available by overlapping old and new Pods. Recreate does the opposite: it terminates every old Pod first, then creates the new ones — a deliberate gap with zero running Pods. Recreate exists for cases where two versions must never run at the same time.",
    },
    {
      type: "decisionTable",
      title: "Which strategy?",
      columns: ["Behavior", "Downtime", "When to choose it"],
      rows: [
        {
          label: "RollingUpdate",
          cells: [
            "Overlaps old and new Pods, gated by readiness",
            "None (with maxUnavailable: 0)",
            "Default; stateless web/API services that tolerate mixed versions",
          ],
        },
        {
          label: "Recreate",
          cells: [
            "Kills all old Pods, then starts new ones",
            "Yes — a full gap",
            "Incompatible schema/versions, single-writer apps, or when two versions must not coexist",
          ],
        },
      ],
    },
    {
      type: "heading",
      id: "build-strategy",
      text: "Build the strategy up",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "From default to a tuned zero-downtime rollout",
      stages: [
        {
          label: "Just a Deployment",
          note: "With no strategy block you still get RollingUpdate with maxSurge: 25% and maxUnavailable: 25% by default. For 4 replicas that means one Pod may be missing and one extra at a time.",
          code: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec:\n  replicas: 4\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: web\n          image: klab/web-app:1.0.0",
        },
        {
          label: "Pin the strategy for zero downtime",
          note: "Set maxUnavailable: 0 so capacity never dips, and maxSurge: 1 so exactly one new Pod is added before an old one is removed. Slower, but never below full strength.",
          code: "spec:\n  replicas: 4\n  strategy:\n    type: RollingUpdate\n    rollingUpdate:\n      maxSurge: 1\n      maxUnavailable: 0",
        },
        {
          label: "Add guards and history",
          note: "minReadySeconds forces a new Pod to prove it stays healthy before counting; progressDeadlineSeconds flags a stuck rollout; revisionHistoryLimit keeps enough old ReplicaSets to undo to.",
          code: "spec:\n  replicas: 4\n  minReadySeconds: 5\n  progressDeadlineSeconds: 120\n  revisionHistoryLimit: 5\n  strategy:\n    type: RollingUpdate\n    rollingUpdate:\n      maxSurge: 1\n      maxUnavailable: 0",
        },
      ],
    },
    {
      type: "heading",
      id: "rollout-commands",
      text: "Driving and inspecting a rollout",
    },
    {
      type: "paragraph",
      text: "The kubectl rollout subcommands are how you watch, audit, pause, and reverse a Deployment update. status blocks until the rollout finishes (or its deadline passes); history lists revisions; undo reverts to a previous revision by re-scaling its ReplicaSet back up.",
    },
    {
      type: "demo",
      title: "kubectl rollout, end to end",
      description: "Trigger an update, watch it, and reverse it if it goes wrong.",
      steps: [
        {
          label: "Trigger the update",
          detail:
            "Editing the image changes the Pod template, so a new ReplicaSet is created and the rollout begins.",
          command: "kubectl set image deploy/web web=klab/web-app:2.0.0",
          output: "deployment.apps/web image updated",
        },
        {
          label: "Watch it progress",
          detail:
            "status streams each step and returns 0 only when every new Pod is available. It exits non-zero on ProgressDeadlineExceeded — useful in CI.",
          command: "kubectl rollout status deploy/web",
          output:
            'Waiting for deployment "web" rollout to finish: 2 of 4 updated replicas are available...\ndeployment "web" successfully rolled out',
        },
        {
          label: "Audit revisions",
          detail:
            "Each rollout is a numbered revision backed by an old ReplicaSet retained up to revisionHistoryLimit.",
          command: "kubectl rollout history deploy/web",
          output: "REVISION  CHANGE-CAUSE\n1         <none>\n2         <none>",
        },
        {
          label: "Roll back a bad release",
          detail:
            "undo re-scales the previous revision's ReplicaSet up and the current one down — the same rolling mechanism, in reverse. It does not delete the failed ReplicaSet.",
          command: "kubectl rollout undo deploy/web",
          output: "deployment.apps/web rolled back",
        },
      ],
    },
    {
      type: "concept",
      term: "Pause and resume",
      definition:
        "kubectl rollout pause deploy/web freezes the Deployment so template edits accumulate without triggering Pods — the basis of a canary or batching several changes into one rollout. kubectl rollout resume deploy/web releases all accumulated changes as a single rollout. Each superseded template is kept as a scaled-to-zero ReplicaSet up to revisionHistoryLimit (default 10), which is exactly the set of revisions undo can return to.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "A rollout that never finishes",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      title: "Stuck at 2 of 4 updated replicas",
      prompt:
        'This Deployment was updated to a new image. kubectl rollout status hangs on "2 of 4 updated replicas are available" and never completes, yet the app keeps serving traffic the whole time. The new Pods show Running but 0/1 READY. What is wrong, and why does the app stay up?',
      code: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec:\n  replicas: 4\n  strategy:\n    type: RollingUpdate\n    rollingUpdate:\n      maxSurge: 1\n      maxUnavailable: 0\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: web\n          image: klab/web-app:2.0.0\n          ports:\n            - containerPort: 8080\n          readinessProbe:\n            httpGet:\n              path: /readyz\n              port: 8080",
      answer:
        "The readiness probe targets /readyz, which this image answers with 404. The probe therefore never passes, so the new Pods stay 0/1 READY and are never counted as available. Because maxUnavailable is 0, the Deployment refuses to scale the old ReplicaSet down past its allowed window — so the old, healthy Pods keep serving and there is zero downtime while the rollout is stuck. After progressDeadlineSeconds the Deployment is marked ProgressDeadlineExceeded, but it does NOT auto-roll-back. Fix the probe path to /healthz (which returns 200) or ship an image that actually serves /readyz; then run kubectl rollout undo if you want to abandon the bad revision. The same symptom appears with a genuinely bad image (ImagePullBackOff / crash) — the new Pods never reach Ready, so the rollout stalls rather than taking the service down.",
    },
    {
      type: "lab",
      labId: "rollout-image",
    },
    {
      type: "heading",
      id: "challenge",
      text: "Author a zero-downtime strategy",
    },
    {
      type: "challenge",
      language: "yaml",
      title: "Tune a Deployment so it never loses capacity",
      prompt:
        "Given a Deployment with replicas: 6, add a strategy stanza so that during an update capacity never drops below 6 available Pods, at most one extra Pod runs at a time, and a new Pod must be Ready for 10 seconds before it counts. Write only the spec fields you add.",
      hint: "maxUnavailable controls the floor, maxSurge controls the ceiling, and minReadySeconds controls how long Ready must hold.",
      solution:
        "spec:\n  replicas: 6\n  minReadySeconds: 10\n  strategy:\n    type: RollingUpdate\n    rollingUpdate:\n      maxSurge: 1\n      maxUnavailable: 0",
    },
    {
      type: "heading",
      id: "takeaways",
      text: "Takeaways",
    },
    {
      type: "takeaways",
      items: [
        "Changing spec.template creates a new ReplicaSet; the Deployment scales it up and the old one down — old ReplicaSets are kept, not deleted.",
        "maxSurge is the ceiling of extra Pods, maxUnavailable is the floor of missing Pods; maxUnavailable: 0 with maxSurge > 0 gives zero downtime.",
        "Readiness gates every step: a new Pod counts only after its readiness probe passes, so a broken version stalls the rollout instead of taking the app down.",
        "Recreate deliberately trades availability for a clean version cut-over; RollingUpdate is the default and preserves capacity.",
        "kubectl rollout status watches, history audits, undo reverts, and pause/resume enable canaries — a stuck rollout hits progressDeadlineSeconds but never auto-rolls-back.",
      ],
    },
    {
      type: "heading",
      id: "check",
      text: "Check yourself",
    },
    {
      type: "quiz",
      id: "rollouts-q1",
      question: "What creates the new ReplicaSet during a Deployment update?",
      options: [
        {
          id: "a",
          text: "The Deployment controller, in response to a changed Pod template.",
          correct: true,
          explanation:
            "A new template hash makes the Deployment controller create and scale a new ReplicaSet.",
        },
        {
          id: "b",
          text: "The Service controller.",
          correct: false,
          explanation:
            "Services publish endpoints; they do not create ReplicaSets or manage rollout history.",
        },
        {
          id: "c",
          text: "The DNS server.",
          correct: false,
          explanation: "DNS resolves names; it plays no part in creating ReplicaSets.",
        },
      ],
    },
    {
      type: "quiz",
      id: "rollouts-q2",
      question:
        "A rollout is stuck: new Pods are Running but 0/1 READY, and the old version is still serving. With maxUnavailable: 0, what happens?",
      options: [
        {
          id: "a",
          text: "The rollout stalls with old Pods still serving; after progressDeadlineSeconds it is marked failed but is not auto-rolled-back.",
          correct: true,
          explanation:
            "Readiness gates the step and maxUnavailable: 0 forbids scaling the old ReplicaSet down, so capacity is preserved while the rollout waits; you must undo it yourself.",
        },
        {
          id: "b",
          text: "Kubernetes deletes the old Pods anyway to make room.",
          correct: false,
          explanation:
            "maxUnavailable: 0 forbids dropping below the desired available count, so the old Pods stay up.",
        },
        {
          id: "c",
          text: "The Deployment automatically rolls back to the previous revision.",
          correct: false,
          explanation:
            "Deployments do not auto-roll-back on failure; they stop at ProgressDeadlineExceeded and wait for kubectl rollout undo.",
        },
      ],
    },
  ],
  labs: [
    {
      id: "rollout-image",
      title: "Change a Deployment image",
      prompt:
        "Change the image from klab/web-app:1.0.0 to klab/web-app:0.9.0 and observe a new Pod template roll out.",
      files: [{ path: "deployment.yaml", language: "yaml", initialValue: WEB_DEPLOYMENT }],
      initialManifests: [],
      registeredImages: [WEB_IMAGE, LEGACY_IMAGE, WEB_V2_IMAGE],
      tryChanging: "Change image to klab/web-app:0.9.0.",
      tasks: ["Edit the container image.", "Apply.", "Watch a new ReplicaSet appear."],
      commands: ["kubectl get deploy", "kubectl get rs", "kubectl get pods"],
      debrief:
        "Changing the Pod template changes the ReplicaSet hash. Kubernetes creates a new ReplicaSet for the new template.",
    },
  ],
};

const resourceManagement: DocsLesson = {
  slug: ["operations", "resource-management"],
  title: "Resource Management",
  description: "Requests, limits, and probes shape scheduling, stability, and performance.",
  section: "Operations",
  order: 1,
  concepts: ["pods", "debugging", "events"],
  relatedLevelSlug: "config-drift",
  content: [
    {
      type: "heading",
      id: "why-resources",
      text: "Why requests and limits exist",
    },
    {
      type: "paragraph",
      text: "A container with no resource declaration is a black box to Kubernetes: the scheduler can't reserve capacity for it, and the kernel has no ceiling to enforce. Requests and limits fix both problems, but they talk to two different audiences. Requests speak to the scheduler at placement time. Limits speak to the node's kernel at runtime. Getting them wrong causes the three failure modes you'll actually see in production: Pods stuck Pending, apps mysteriously throttled, and containers killed with OOMKilled.",
    },
    {
      type: "diagram",
      variant: "pod",
      title: "Resources live per-container inside the Pod spec",
      caption: "Each container declares its own requests and limits; the Pod's totals are the sum.",
    },
    {
      type: "heading",
      id: "requests-vs-limits",
      text: "Requests schedule, limits enforce",
    },
    {
      type: "paragraph",
      text: "A request is a reservation. The scheduler sums the requests of every container in a Pod and only places it on a node whose remaining allocatable capacity can cover that sum. The request is a promise the node keeps for you. A limit is a hard ceiling the node's cgroup enforces while the container runs. Crucially, the request has nothing to do with runtime enforcement, and the limit has nothing to do with scheduling. A Pod can request 100m of CPU and burst up to a 2-core limit; the scheduler still only reserved 100m.",
    },
    {
      type: "callout",
      tone: "key",
      title: "Two numbers, two audiences",
      text: "requests answer 'does this Pod fit on the node?' — read at schedule time, once. limits answer 'how much may this container consume right now?' — enforced continuously by the kernel. Confusing the two is the root of most resource incidents.",
    },
    {
      type: "heading",
      id: "anatomy",
      text: "Anatomy of a resources block",
    },
    {
      type: "paragraph",
      text: "Every field below is load-bearing. Read the block as two pairs: what the scheduler reserves (requests) and what the kernel caps (limits), each split into a compressible resource (cpu) and an incompressible one (memory).",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A fully specified container",
      caption:
        "requests and limits set for both CPU and memory — this is what makes a Pod Guaranteed.",
      lines: [
        {
          code: "apiVersion: v1",
        },
        {
          code: "kind: Pod",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: web",
        },
        {
          code: "  labels:",
        },
        {
          code: "    app: web",
        },
        {
          code: "spec:",
        },
        {
          code: "  containers:",
        },
        {
          code: "    - name: web",
        },
        {
          code: "      image: klab/web-app:1.0.0",
        },
        {
          code: "      resources:",
          note: "resources are per-container, not per-Pod",
        },
        {
          code: "        requests:",
          note: "what the SCHEDULER reserves on the node; also the floor used to rank eviction",
        },
        {
          code: '          cpu: "250m"',
          note: "reserve 0.25 of a core — becomes the container's CPU share weight",
        },
        {
          code: '          memory: "128Mi"',
          note: "reserve 128Mi; nodes evict Pods using memory above their request first",
        },
        {
          code: "        limits:",
          note: "the runtime CEILING the kernel cgroup enforces",
        },
        {
          code: '          cpu: "500m"',
          note: "CPU beyond this is THROTTLED, never killed — CPU is compressible",
        },
        {
          code: '          memory: "256Mi"',
          note: "memory beyond this triggers an OOM kill — memory is incompressible",
        },
      ],
    },
    {
      type: "heading",
      id: "build-it",
      text: "Build the resources block in stages",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "From BestEffort to Guaranteed",
      stages: [
        {
          label: "No resources (BestEffort)",
          note: "A container with no requests or limits. The scheduler assumes it needs ~nothing, so it can land anywhere — and it is first in line to be evicted when the node runs low on memory.",
          code: "spec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0",
        },
        {
          label: "Add requests (Burstable)",
          note: "Now the scheduler reserves 250m CPU and 128Mi memory. The Pod fits only where that capacity exists, and it can still burst above the request since there is no limit yet.",
          code: 'spec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      resources:\n        requests:\n          cpu: "250m"\n          memory: "128Mi"',
        },
        {
          label: "Add matching limits (Guaranteed)",
          note: "Set limits equal to requests for BOTH cpu and memory on every container. Kubernetes now derives QoS class Guaranteed — the last Pods evicted under pressure.",
          code: 'spec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      resources:\n        requests:\n          cpu: "250m"\n          memory: "128Mi"\n        limits:\n          cpu: "250m"\n          memory: "128Mi"',
        },
      ],
    },
    {
      type: "heading",
      id: "compressible",
      text: "Compressible CPU vs incompressible memory",
    },
    {
      type: "paragraph",
      text: "The single most important idea in resource management is that CPU and memory fail differently. CPU is compressible: the kernel can hand a container less of it at any instant with no lasting harm — the app just runs slower. Memory is incompressible: once a byte is allocated, the kernel cannot politely take it back. So exceeding a CPU limit throttles the container, while exceeding a memory limit kills it.",
    },
    {
      type: "concept",
      term: "Compressible resource",
      definition:
        "A resource that can be reclaimed from a container gradually and without terminating it. CPU is compressible (the scheduler throttles it via CFS quota). Memory is not — the only way to reclaim it is to kill the process, which is why over-limit memory ends in OOMKilled.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Over-limit behavior is not symmetric",
      text: "Exceed the CPU limit and your container is throttled: it keeps running but stalls, which you'll see as latency spikes, not restarts. Exceed the memory limit and the kernel OOM killer terminates the process; the container's last state shows reason: OOMKilled and it restarts per restartPolicy — often into CrashLoopBackOff.",
    },
    {
      type: "compare",
      caption: "Same idea — a limit was exceeded — but the outcome depends on which resource.",
      left: {
        title: "CPU over limit -> throttled",
        code: "# limits.cpu: 500m, app wants 900m\n# kernel caps it at 500m\n# result: slow responses, no restart\n# kubectl top pod shows CPU pinned at the cap",
      },
      right: {
        title: "Memory over limit -> OOMKilled",
        code: "# limits.memory: 256Mi, app grows to 300Mi\n# kernel OOM killer terminates the process\n# lastState.terminated.reason: OOMKilled\n# container restarts -> CrashLoopBackOff",
      },
    },
    {
      type: "heading",
      id: "qos",
      text: "QoS classes and how they're derived",
    },
    {
      type: "paragraph",
      text: "You never set a Pod's QoS class directly — Kubernetes derives it from the requests and limits you wrote. The class then decides who gets killed first when a node runs out of memory. There are exactly three classes. Guaranteed: every container in the Pod sets requests equal to limits for both CPU and memory. BestEffort: no container sets any request or limit at all. Burstable: anything in between — at least one request or limit is set, but the Pod doesn't meet the Guaranteed bar.",
    },
    {
      type: "decisionTable",
      title: "The three QoS classes",
      columns: ["How Kubernetes derives it", "Eviction / OOM priority", "Use it when"],
      rows: [
        {
          label: "Guaranteed",
          cells: [
            "Every container sets limits == requests for BOTH cpu and memory",
            "Evicted last; lowest OOM kill priority",
            "Latency-sensitive or critical workloads that must not be throttled or killed",
          ],
        },
        {
          label: "Burstable",
          cells: [
            "At least one request or limit set, but not all equal (doesn't meet Guaranteed)",
            "Evicted after BestEffort; Pods using memory above their request go first",
            "Typical apps that idle low but burst — set a request floor, allow headroom",
          ],
        },
        {
          label: "BestEffort",
          cells: [
            "No container sets any request or limit",
            "Evicted first; highest OOM kill priority",
            "Throwaway or batch work that can tolerate being killed and rescheduled",
          ],
        },
      ],
    },
    {
      type: "callout",
      tone: "info",
      title: "QoS is a consequence, not a setting",
      text: "Check a running Pod with kubectl get pod NAME -o jsonpath='{.status.qosClass}'. If you wanted Guaranteed but see Burstable, a container is missing a limit or a request, or a value doesn't match — check every container, since one BestEffort sidecar can drag the whole Pod down.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a Pod that keeps dying",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "This web app starts, serves a few requests, then restarts over and over into CrashLoopBackOff. kubectl describe shows lastState.terminated.reason: OOMKilled. The image needs about 200Mi of memory at steady state. What's wrong, and how do you fix it?",
      code: 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      resources:\n        requests:\n          cpu: "250m"\n          memory: "64Mi"\n        limits:\n          cpu: "500m"\n          memory: "96Mi"',
      answer:
        "The memory limit (96Mi) is far below what the app actually uses (~200Mi). Memory is incompressible, so when the container grows past 96Mi the kernel OOM killer terminates it — hence reason: OOMKilled and the restart loop. The CPU numbers are irrelevant here; a low CPU limit would only throttle, not kill. Fix: raise limits.memory (and usually requests.memory) above the real working set, e.g. requests 256Mi / limits 320Mi, then confirm the restarts stop.",
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write a Guaranteed Pod",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Write a Pod named api that runs the container image klab/web-app:1.0.0 and is derived as QoS class Guaranteed. Give it 500m of CPU and 256Mi of memory.",
      hint: "For Guaranteed, every container must set limits equal to requests for BOTH cpu and memory. Same numbers in both blocks.",
      solution:
        'apiVersion: v1\nkind: Pod\nmetadata:\n  name: api\nspec:\n  containers:\n    - name: api\n      image: klab/web-app:1.0.0\n      resources:\n        requests:\n          cpu: "500m"\n          memory: "256Mi"\n        limits:\n          cpu: "500m"\n          memory: "256Mi"',
    },
    { type: "lab", labId: "qos-class" },
    {
      type: "takeaways",
      items: [
        "Requests are read once by the scheduler to place the Pod; limits are enforced continuously by the kernel.",
        "CPU is compressible — over-limit means throttling. Memory is incompressible — over-limit means OOMKilled.",
        "QoS class is derived from your requests and limits, never set directly.",
        "Guaranteed (limits == requests everywhere) is evicted last; BestEffort (nothing set) is evicted first.",
        "A restart loop with reason OOMKilled means the memory limit is below the app's real working set.",
      ],
    },
    {
      type: "quiz",
      id: "resources-q1",
      question: "What do a container's CPU and memory requests primarily influence?",
      options: [
        {
          id: "a",
          text: "Which node the scheduler places the Pod on.",
          correct: true,
          explanation:
            "The scheduler sums container requests and only places the Pod where that capacity is available. Requests are a scheduling-time reservation.",
        },
        {
          id: "b",
          text: "The hard runtime ceiling the kernel enforces.",
          correct: false,
          explanation:
            "That's the job of limits, not requests. A container can burst above its request up to its limit.",
        },
        {
          id: "c",
          text: "The Service DNS name the Pod receives.",
          correct: false,
          explanation:
            "DNS names come from Services and namespaces; they're unrelated to resource requests.",
        },
      ],
    },
    {
      type: "quiz",
      id: "resources-q2",
      question:
        "A container repeatedly shows lastState reason: OOMKilled. Which change is most likely to stop it?",
      options: [
        {
          id: "a",
          text: "Raise the memory limit above the app's real working set.",
          correct: true,
          explanation:
            "OOMKilled means the container exceeded its incompressible memory limit. Giving it enough headroom stops the kernel from killing it.",
        },
        {
          id: "b",
          text: "Raise the CPU limit.",
          correct: false,
          explanation:
            "CPU is compressible — an over-limit CPU only throttles the container, it never triggers an OOM kill.",
        },
        {
          id: "c",
          text: "Remove all requests to make the Pod BestEffort.",
          correct: false,
          explanation:
            "That makes things worse: BestEffort Pods are the first evicted and have the highest OOM priority under memory pressure.",
        },
      ],
    },
  ],
  labs: [
    {
      id: "qos-class",
      title: "Set requests and limits, read the QoS class",
      prompt:
        "Apply a Deployment whose container sets equal requests and limits, then confirm Kubernetes assigns it the Guaranteed QoS class.",
      files: [
        { path: "deployment.yaml", language: "yaml", initialValue: WEB_DEPLOYMENT_RESOURCES },
      ],
      initialManifests: [],
      registeredImages: [WEB_IMAGE],
      tryChanging: "Remove the limits block and re-apply — the QoS class drops to Burstable.",
      tasks: [
        "Apply the Deployment.",
        "Describe a Pod and find its QoS Class.",
        "Change the resources and re-observe.",
      ],
      commands: ["kubectl get pods", "kubectl describe pod <pod>"],
      debrief:
        "Equal requests and limits for every resource yields Guaranteed. Requests only (or partial) is Burstable; none is BestEffort. QoS drives the order Pods are evicted under node pressure.",
    },
  ],
};

const namespaces: DocsLesson = {
  slug: ["operations", "namespaces"],
  title: "Namespaces",
  description:
    "Namespaces partition names and policies inside a cluster. They do not create separate clusters.",
  section: "Operations",
  order: 2,
  concepts: ["namespaces", "services", "dns", "debugging"],
  relatedLevelSlug: "namespace-confusion",
  content: [
    {
      type: "heading",
      id: "why-namespaces",
      text: "Why namespaces exist",
    },
    {
      type: "paragraph",
      text: "A namespace is a scope for names inside a single cluster. It lets many teams and apps share one control plane without their object names colliding, and it gives you a handle to attach policy to. A namespace is not a separate cluster: Pods across namespaces share the same nodes and, by default, the same flat network.",
    },
    {
      type: "diagram",
      variant: "namespace-boundary",
      title: "Two namespaces, same local names",
      caption:
        "team-a and team-b each hold a Service named web-svc. The names do not collide because each object is scoped to its namespace.",
    },
    {
      type: "heading",
      id: "scope-of-names",
      text: "What a namespace scopes",
    },
    {
      type: "paragraph",
      text: "Most objects you create every day are namespaced: their name only has to be unique within their namespace. A Service called web-svc can exist in team-a and team-b at the same time. Some objects are cluster-scoped instead — they exist once for the whole cluster and cannot live inside a namespace.",
    },
    {
      type: "concept",
      term: "Namespaced vs cluster-scoped",
      definition:
        "A namespaced resource belongs to exactly one namespace and is addressed as namespace/name. A cluster-scoped resource has no namespace and is addressed by name alone. Run kubectl api-resources --namespaced=true or =false to see which is which for any kind.",
    },
    {
      type: "decisionTable",
      title: "Where common objects live",
      columns: ["Examples", "How you address them"],
      rows: [
        {
          label: "Namespaced",
          cells: [
            "Pod, Deployment, Service, ConfigMap, Secret, Role, RoleBinding, ResourceQuota, NetworkPolicy",
            "namespace + name (kubectl get pods -n team-a)",
          ],
        },
        {
          label: "Cluster-scoped",
          cells: [
            "Node, Namespace, PersistentVolume, StorageClass, ClusterRole, ClusterRoleBinding, CustomResourceDefinition",
            "name only (kubectl get nodes)",
          ],
        },
      ],
    },
    {
      type: "heading",
      id: "policy-boundary",
      text: "A boundary for policy",
    },
    {
      type: "paragraph",
      text: "The real payoff of a namespace is that quotas, RBAC, and network policy attach to it. A ResourceQuota caps the aggregate CPU, memory, and object counts a namespace may consume. A Role plus RoleBinding grants API permissions only inside the namespace. A NetworkPolicy scopes which Pods may talk to the Pods in that namespace. The namespace is the unit these controls latch onto.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A governed namespace",
      caption:
        "The Namespace object itself is tiny — the labels are what turn it into a policy target.",
      lines: [
        {
          code: "apiVersion: v1",
        },
        {
          code: "kind: Namespace",
        },
        {
          code: "metadata:",
          note: "cluster-scoped object — no namespace field of its own",
        },
        {
          code: "  name: team-a",
          note: "this name becomes the DNS segment: <svc>.team-a.svc.cluster.local",
        },
        {
          code: "  labels:",
        },
        {
          code: "    kubernetes.io/metadata.name: team-a",
          note: "auto-set by the API server; lets NetworkPolicy select this namespace by label",
        },
        {
          code: "    pod-security.kubernetes.io/enforce: restricted",
          note: "Pod Security admission uses namespace labels to enforce a security standard on new Pods",
        },
      ],
    },
    {
      type: "heading",
      id: "build-it",
      text: "Turn a namespace into a boundary",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "From empty scope to governed tenant in three steps",
      stages: [
        {
          label: "Just a name",
          note: "A bare Namespace only reserves a scope for names. Objects can be created in it, but nothing limits or protects them yet.",
          code: "apiVersion: v1\nkind: Namespace\nmetadata:\n  name: team-a",
        },
        {
          label: "Add a quota",
          note: "A ResourceQuota lives inside the namespace and caps its total usage. Now team-a cannot exhaust the cluster; requests over the cap are rejected at admission.",
          code: 'apiVersion: v1\nkind: ResourceQuota\nmetadata:\n  name: team-a-quota\n  namespace: team-a\nspec:\n  hard:\n    requests.cpu: "4"\n    requests.memory: 8Gi\n    pods: "20"',
        },
        {
          label: "Add scoped permissions",
          note: "A Role plus RoleBinding grants API access only within team-a. The binding is namespaced, so this power does not leak to other namespaces.",
          code: "apiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata:\n  name: team-a-devs\n  namespace: team-a\nsubjects:\n  - kind: Group\n    name: team-a\n    apiGroup: rbac.authorization.k8s.io\nroleRef:\n  kind: Role\n  name: editor\n  apiGroup: rbac.authorization.k8s.io",
        },
      ],
    },
    {
      type: "heading",
      id: "dns",
      text: "DNS across namespaces",
    },
    {
      type: "paragraph",
      text: "Cluster DNS gives every Service a fully qualified name of the form <service>.<namespace>.svc.cluster.local. A short name works too, but only because the resolver appends search domains — and the caller's own namespace is tried first. That single fact is the source of most cross-namespace call bugs.",
    },
    {
      type: "code",
      language: "markdown",
      code: "same namespace:   http://web-svc/\nother namespace:  http://web-svc.team-b.svc.cluster.local/\nresolver expands: web-svc -> web-svc.<caller-namespace>.svc.cluster.local first",
    },
    {
      type: "callout",
      tone: "key",
      title: "Short names are namespace-relative",
      text: "A short Service name resolves in the CALLER'S namespace, not the target's. To reach a Service in another namespace, use the fully qualified name <service>.<namespace>.svc.cluster.local. Never assume a bare name crosses a namespace.",
    },
    {
      type: "heading",
      id: "not-a-security-boundary",
      text: "Not a hard security boundary",
    },
    {
      type: "paragraph",
      text: "A namespace by itself isolates names, not traffic or trust. On a default cluster every Pod can reach every other Pod across all namespaces, and a ClusterRoleBinding grants permissions everywhere at once. Isolation is something you add on top of the namespace.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "What you must add for real isolation",
      text: "For meaningful separation you layer controls onto the namespace: NetworkPolicy to restrict Pod-to-Pod traffic (default-deny then allow), RBAC scoped to Roles rather than ClusterRoles, ResourceQuota and LimitRange to bound blast radius, and Pod Security admission. A namespace with none of these is a naming convention, not a wall.",
    },
    {
      type: "concept",
      term: "Soft multi-tenancy",
      definition:
        "Separating trusted-ish teams by namespace with policy layered on top. It is not a strong security boundary against hostile tenants — the shared kernel, nodes, and control plane remain. For hostile isolation you reach for separate clusters or stronger runtime sandboxing.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a broken cross-namespace call",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "This api Deployment runs in namespace team-a and is meant to call web-svc, which lives in namespace team-b. Requests fail or hit the wrong backend. What is wrong?",
      code: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: api\n  namespace: team-a\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: api\n  template:\n    metadata:\n      labels:\n        app: api\n    spec:\n      containers:\n        - name: api\n          image: klab/web-app:1.0.0\n          env:\n            - name: UPSTREAM_URL\n              value: http://web-svc/",
      answer:
        "UPSTREAM_URL uses the short name http://web-svc/. From a Pod in team-a the resolver expands that to web-svc.team-a.svc.cluster.local first, so it never reaches team-b. Fix: use the fully qualified name, value: http://web-svc.team-b.svc.cluster.local/.",
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write one yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Author a Namespace named payments, and a ResourceQuota in it that caps the namespace to 10 Pods and 2 CPUs of requests.",
      hint: "The Namespace is cluster-scoped (no namespace field). The ResourceQuota is namespaced — set metadata.namespace: payments and put the caps under spec.hard.",
      solution:
        'apiVersion: v1\nkind: Namespace\nmetadata:\n  name: payments\n---\napiVersion: v1\nkind: ResourceQuota\nmetadata:\n  name: payments-quota\n  namespace: payments\nspec:\n  hard:\n    pods: "10"\n    requests.cpu: "2"',
    },
    {
      type: "lab",
      labId: "namespace-dns",
    },
    {
      type: "compare",
      caption: "The same intent — call a Service in another namespace — written wrong and right.",
      left: {
        title: "Wrong (short name)",
        code: "env:\n  - name: UPSTREAM_URL\n    value: http://web-svc/\n# resolves in the caller's namespace",
      },
      right: {
        title: "Right (fully qualified)",
        code: "env:\n  - name: UPSTREAM_URL\n    value: http://web-svc.team-b.svc.cluster.local/\n# unambiguous across namespaces",
      },
    },
    {
      type: "takeaways",
      items: [
        "A namespace scopes names inside one cluster; it is not a separate cluster and does not isolate the network by default.",
        "Namespaced objects are addressed as namespace/name; cluster-scoped objects (Node, PersistentVolume, ClusterRole, Namespace itself) are not.",
        "Quotas, RBAC Roles, and NetworkPolicy attach to a namespace — that is what makes it a useful boundary.",
        "Short Service names resolve in the caller's namespace; cross-namespace calls need <service>.<namespace>.svc.cluster.local.",
        "Real isolation requires NetworkPolicy, scoped RBAC, quotas, and Pod Security on top of the namespace.",
      ],
    },
    {
      type: "quiz",
      id: "namespaces-q1",
      question: "How should a Pod in team-a call web-svc in team-b?",
      options: [
        {
          id: "a",
          text: "http://web-svc.team-b.svc.cluster.local/",
          correct: true,
          explanation:
            "The fully qualified name pins the target namespace, so the resolver does not fall back to the caller's namespace.",
        },
        {
          id: "b",
          text: "http://web-svc/",
          correct: false,
          explanation:
            "A short name resolves in the caller's namespace (team-a) first, so it will not reach team-b.",
        },
        {
          id: "c",
          text: "http://team-b/",
          correct: false,
          explanation:
            "The namespace name alone is not a Service address; DNS resolves Services, not namespaces.",
        },
      ],
    },
    {
      type: "quiz",
      id: "namespaces-q2",
      question: "Which of these is a cluster-scoped resource that cannot live inside a namespace?",
      options: [
        {
          id: "a",
          text: "PersistentVolume",
          correct: true,
          explanation:
            "PersistentVolumes (like Nodes, ClusterRoles, and StorageClasses) are cluster-scoped; only the PersistentVolumeClaim that binds to one is namespaced.",
        },
        {
          id: "b",
          text: "ConfigMap",
          correct: false,
          explanation: "ConfigMaps are namespaced — each lives in exactly one namespace.",
        },
        {
          id: "c",
          text: "RoleBinding",
          correct: false,
          explanation:
            "A RoleBinding is namespaced; the cluster-wide equivalent is a ClusterRoleBinding.",
        },
      ],
    },
  ],
  labs: [
    {
      id: "namespace-dns",
      title: "Create two same-named Services",
      prompt:
        "Apply two namespaces with a web-svc in each. Notice that names are scoped by namespace.",
      files: [
        {
          path: "team-a.yaml",
          language: "yaml",
          initialValue: [TEAM_A_NAMESPACE, TEAM_A_POD, TEAM_A_SERVICE].join("\n---\n"),
        },
        {
          path: "team-b.yaml",
          language: "yaml",
          initialValue: [TEAM_B_NAMESPACE, TEAM_B_POD, TEAM_B_SERVICE].join("\n---\n"),
        },
      ],
      initialManifests: [],
      registeredImages: [WEB_IMAGE],
      tryChanging: "Rename one Service and apply again.",
      tasks: [
        "Apply both namespaces.",
        "Compare same names in different scopes.",
        "Open in Playground to run kubectl get svc -n team-a.",
      ],
      commands: [
        "kubectl get namespaces",
        "kubectl get svc -n team-a",
        "kubectl get svc -n team-b",
      ],
      debrief:
        "Namespaces isolate names. The same Service name can exist twice because each object lives in a namespace.",
    },
  ],
};

const configuration: DocsLesson = {
  slug: ["operations", "configuration"],
  title: "ConfigMaps & Secrets",
  description:
    "Move environment-specific configuration out of images and manifests, and handle sensitive values deliberately.",
  section: "Operations",
  order: 3,
  concepts: ["configmaps", "secrets", "pods", "debugging"],
  content: [
    {
      type: "heading",
      id: "externalize-config",
      text: "Externalize configuration",
    },
    {
      type: "paragraph",
      text: "A container image should be built once and run everywhere. The thing that differs between dev, staging, and prod is configuration, not code. Kubernetes gives you two objects for this: a ConfigMap holds non-confidential settings (flags, URLs, whole config files), and a Secret holds sensitive values (tokens, passwords, keys). Both are just key/value data in the API; the interesting part is how a Pod consumes them and what happens when they change.",
    },
    {
      type: "diagram",
      variant: "api-object",
      title: "A ConfigMap is a plain API object",
      caption:
        "Config lives in etcd like any other object. A Pod references it; the kubelet delivers the values into the container.",
    },
    {
      type: "concept",
      term: "ConfigMap vs Secret",
      definition:
        "Same shape, different intent. A ConfigMap stores plain string data for ordinary config. A Secret stores base64-encoded data flagged as sensitive, so it gets tighter defaults (kept out of some logs, gated by RBAC, and stored encrypted at rest if you enable it). A Secret is NOT automatically encrypted just by being a Secret.",
    },
    {
      type: "heading",
      id: "configmap-anatomy",
      text: "Anatomy of a ConfigMap",
    },
    {
      type: "paragraph",
      text: "Read every ConfigMap through two questions: what keys does it hold, and are those values small scalars (good as env vars) or whole files (good as mounted volumes)?",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A complete ConfigMap",
      caption:
        "Each key can become an environment variable or a file, depending on how the Pod consumes it.",
      lines: [
        {
          code: "apiVersion: v1",
        },
        {
          code: "kind: ConfigMap",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: app-config",
          note: "the name Pods reference via configMapRef, configMapKeyRef, or a volume",
        },
        {
          code: "  namespace: default",
          note: "a ConfigMap is namespaced — a Pod can only mount one from its own namespace",
        },
        {
          code: "data:",
          note: "string key/value pairs; use binaryData for raw bytes",
        },
        {
          code: "  LOG_LEVEL: info",
          note: "a scalar — natural as an env var OR a file named LOG_LEVEL",
        },
        {
          code: "  API_URL: http://api-svc/",
        },
        {
          code: "  app.conf: |",
          note: "a multi-line value — ideal mounted as a file, awkward as an env var",
        },
        {
          code: "    timeout=30",
        },
        {
          code: "    retries=3",
        },
        {
          code: "immutable: false",
          note: "set true to lock the object; then it can never be edited, only deleted and recreated",
        },
      ],
    },
    {
      type: "heading",
      id: "build-configmap",
      text: "Build a ConfigMap in stages",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "A ConfigMap grows in three steps",
      stages: [
        {
          label: "Skeleton",
          note: "The minimum valid object: apiVersion, kind, and a name. It holds no data yet, so nothing can consume it usefully.",
          code: "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: app-config",
        },
        {
          label: "Add data",
          note: "Now it carries real settings. A Pod can pull LOG_LEVEL and API_URL in as env vars, or mount all keys as files.",
          code: "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: app-config\ndata:\n  LOG_LEVEL: info\n  API_URL: http://api-svc/",
        },
        {
          label: "Make it immutable",
          note: "immutable: true locks the values. Kubernetes can then stop watching it, easing API-server load, and no one can edit it by accident. To change it later you must create a new ConfigMap and roll the Deployment to it.",
          code: "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: app-config\ndata:\n  LOG_LEVEL: info\n  API_URL: http://api-svc/\nimmutable: true",
        },
      ],
    },
    {
      type: "heading",
      id: "consume-config",
      text: "Consume config in a Pod",
    },
    {
      type: "paragraph",
      text: "A ConfigMap does nothing until a Pod references it. There are two delivery mechanisms, and this Deployment uses both so you can see them side by side.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A Deployment consuming the ConfigMap",
      caption:
        "envFrom copies keys into the process environment; a volume mount exposes them as files.",
      lines: [
        {
          code: "apiVersion: apps/v1",
        },
        {
          code: "kind: Deployment",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: web",
        },
        {
          code: "spec:",
        },
        {
          code: "  replicas: 2",
        },
        {
          code: "  selector:",
        },
        {
          code: "    matchLabels:",
        },
        {
          code: "      app: web",
        },
        {
          code: "  template:",
        },
        {
          code: "    metadata:",
        },
        {
          code: "      labels:",
        },
        {
          code: "        app: web",
        },
        {
          code: "    spec:",
        },
        {
          code: "      containers:",
        },
        {
          code: "        - name: web",
        },
        {
          code: "          image: klab/web-app:1.0.0",
        },
        {
          code: "          envFrom:",
          note: "bulk-import every key as an env var, read ONCE when the container starts",
        },
        {
          code: "            - configMapRef:",
        },
        {
          code: "                name: app-config",
          note: "a missing ConfigMap here blocks the container from starting unless marked optional",
        },
        {
          code: "          volumeMounts:",
        },
        {
          code: "            - name: config",
        },
        {
          code: "              mountPath: /etc/app",
          note: "each ConfigMap key appears as a file here; the kubelet refreshes them after an update",
        },
        {
          code: "      volumes:",
        },
        {
          code: "        - name: config",
        },
        {
          code: "          configMap:",
        },
        {
          code: "            name: app-config",
          note: "the same ConfigMap, projected read-only into the volume above",
        },
      ],
    },
    {
      type: "heading",
      id: "env-vs-files",
      text: "Env vars vs mounted files",
    },
    {
      type: "paragraph",
      text: "The two mechanisms differ in one behavior that trips people up constantly: whether a change to the ConfigMap reaches a running container.",
    },
    {
      type: "compare",
      caption:
        "Same ConfigMap, two delivery paths. Only the mounted-file path picks up later edits without a restart.",
      left: {
        title: "As env vars",
        code: "envFrom:\n  - configMapRef:\n      name: app-config\n# copied into the process env at container START\n# a later ConfigMap edit does NOT change them\n# you must roll/restart the Pod to apply",
      },
      right: {
        title: "As mounted files",
        code: "volumeMounts:\n  - name: config\n    mountPath: /etc/app\nvolumes:\n  - name: config\n    configMap:\n      name: app-config\n# files are refreshed by the kubelet after an edit\n# (delayed; and NOT if subPath or immutable)",
      },
    },
    {
      type: "callout",
      tone: "key",
      title: "Config changes do not auto-restart Pods",
      text: "Editing a ConfigMap or Secret never restarts anything. Env-var consumers keep the values they captured at start until the Pod is recreated. Volume-mounted consumers see files updated by the kubelet after a delay (up to about a minute) — but NOT when mounted with subPath and NOT if the object is immutable. To make an env-var change take effect deliberately, run kubectl rollout restart deployment/web, or bump a checksum annotation on the Pod template so the Deployment rolls.",
    },
    {
      type: "decisionTable",
      title: "Choosing env vars vs mounted files",
      columns: ["Env vars (envFrom / valueFrom)", "Volume files (configMap / secret volume)"],
      rows: [
        {
          label: "Live updates to running Pods",
          cells: [
            "No — fixed at container start",
            "Yes — kubelet refreshes files (not subPath, not immutable)",
          ],
        },
        {
          label: "Restart needed to apply a change",
          cells: ["Required (rollout or recreate)", "Not required for the file content itself"],
        },
        {
          label: "Best for",
          cells: [
            "Small scalar settings, 12-factor apps",
            "Whole config files, certificates, large or structured data",
          ],
        },
        {
          label: "How the app reads it",
          cells: ["From process environment", "From the filesystem — ideally re-reading on change"],
        },
        {
          label: "Binary / large data",
          cells: ["Awkward — env values are strings", "Natural — binaryData and file bytes"],
        },
      ],
    },
    {
      type: "heading",
      id: "secrets",
      text: "Secrets: encoding is not encryption",
    },
    {
      type: "paragraph",
      text: "A Secret looks like a ConfigMap whose values are base64-encoded. That base64 is only an encoding for transporting arbitrary bytes as JSON strings — it is trivially reversible and provides zero confidentiality. Anyone who can get the Secret can decode it in one command.",
    },
    {
      type: "code",
      language: "markdown",
      code: "# stringData is written in plaintext; the API server base64-encodes it into .data\n$ kubectl get secret db -o jsonpath='{.data.DATABASE_URL}'\ncG9zdGdyZXM6Ly8uLi4=\n$ echo 'cG9zdGdyZXM6Ly8uLi4=' | base64 -d\npostgres://...        # base64 is encoding, NOT encryption",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Make Secrets actually secret",
      text: "Two things turn a Secret from a labelled field into real protection. First, enable encryption at rest with an EncryptionConfiguration on the kube-apiserver so etcd stores ciphertext instead of plain base64. Second, lock down access with RBAC and per-workload ServiceAccounts so not every Pod can read every Secret. Also prefer stringData for authoring (plaintext in, base64 stored) and keep Secret values out of images and version control.",
    },
    {
      type: "concept",
      term: "Immutable ConfigMaps and Secrets",
      definition:
        "Setting immutable: true prevents any change to data after creation. It guards against accidental edits and lets the kubelet stop watching the object, which reduces load on the API server in large clusters. The trade-off: you can no longer patch it. Rolling out new config means creating a new object (often name-hashed) and updating the Pod template to reference it.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a broken config update",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "A team set LOG_LEVEL: debug in the ConfigMap and ran kubectl apply. Minutes later the running web Pods still log at info. The ConfigMap really does say debug now. Given this Deployment, why didn't the change take effect — and how do you make it apply?",
      code: "spec:\n  template:\n    spec:\n      containers:\n        - name: web\n          image: klab/web-app:1.0.0\n          envFrom:\n            - configMapRef:\n                name: app-config",
      answer:
        "The ConfigMap is consumed via envFrom, so LOG_LEVEL is copied into the process environment ONCE when each container starts. Editing the ConfigMap afterwards does not touch the environment of a container that is already running, and nothing restarts the Pods automatically. The new value only appears in a freshly created Pod. Fix: trigger a rollout with kubectl rollout restart deployment/web (or bump a checksum annotation on the Pod template). If you needed the value to update without a restart, you would mount the ConfigMap as a volume instead of importing it as env vars — and have the app re-read the file.",
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write one yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        'Author a ConfigMap named feature-flags with one key, features.json, holding {"beta": true}. Then write the Pod volume and volumeMount snippet that exposes that key as the file /etc/features/features.json so the app can re-read it after an edit — without a restart.',
      hint: "A whole file belongs in a mounted volume, not an env var. Reference the ConfigMap under spec.volumes, then point a volumeMount at a mountPath. Avoid subPath, or the file will stop auto-updating.",
      solution:
        'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: feature-flags\ndata:\n  features.json: |\n    {"beta": true}\n---\n# in the Pod spec:\n    volumeMounts:\n      - name: flags\n        mountPath: /etc/features\n    volumes:\n      - name: flags\n        configMap:\n          name: feature-flags',
    },
    { type: "lab", labId: "config-envfrom" },
    {
      type: "takeaways",
      items: [
        "ConfigMaps hold ordinary config; Secrets hold sensitive data — same shape, stricter defaults for Secrets.",
        "Env-var config is captured at container start and needs a rollout to change; volume-mounted config is refreshed on disk by the kubelet (unless subPath or immutable).",
        "Editing a ConfigMap or Secret never restarts Pods by itself — use kubectl rollout restart or a template checksum to apply env changes.",
        "A Secret's base64 is encoding, not encryption; enable encryption at rest and RBAC to make it actually confidential.",
        "immutable: true prevents edits and lowers API-server load, at the cost of having to recreate the object to change it.",
      ],
    },
    {
      type: "quiz",
      id: "configuration-q1",
      question: "Where should a non-sensitive feature flag usually live?",
      options: [
        {
          id: "a",
          text: "A ConfigMap",
          correct: true,
          explanation:
            "ConfigMaps are intended for non-confidential configuration data like flags and URLs.",
        },
        {
          id: "b",
          text: "A Secret, because all config is sensitive",
          correct: false,
          explanation:
            "Secrets are for sensitive values; a plain feature flag does not need Secret handling and belongs in a ConfigMap.",
        },
        {
          id: "c",
          text: "Baked into the container image",
          correct: false,
          explanation:
            "Baking config into the image defeats build-once-run-anywhere and forces a rebuild to change a flag.",
        },
      ],
    },
    {
      type: "quiz",
      id: "configuration-q2",
      question:
        "You edit a ConfigMap consumed through envFrom, but the running Pods keep the old values. Why?",
      options: [
        {
          id: "a",
          text: "Environment variables are read once at container start; a ConfigMap edit does not restart running containers, so you must roll the Deployment (e.g. kubectl rollout restart).",
          correct: true,
          explanation:
            "Env vars are captured at startup and never live-update; only recreating the Pod picks up the new values.",
        },
        {
          id: "b",
          text: "The ConfigMap edit was invalid, so it was silently rejected.",
          correct: false,
          explanation:
            "The edit was accepted; the values simply do not propagate into the environment of already-running containers.",
        },
        {
          id: "c",
          text: "Env vars always live-update, so the cache is just slow — wait longer.",
          correct: false,
          explanation:
            "Env vars never live-update from a ConfigMap change; waiting will not help. Only volume-mounted files refresh over time.",
        },
      ],
    },
  ],
  labs: [
    {
      id: "config-envfrom",
      title: "Wire a ConfigMap into a Deployment",
      prompt:
        "Apply a ConfigMap and a Deployment that reads it with envFrom, then confirm the Pods start with that configuration.",
      files: [
        { path: "configmap.yaml", language: "yaml", initialValue: APP_CONFIGMAP },
        { path: "deployment.yaml", language: "yaml", initialValue: WEB_DEPLOYMENT_ENVFROM },
      ],
      initialManifests: [],
      registeredImages: [WEB_IMAGE],
      tryChanging:
        "Change data.LOG_LEVEL to debug, re-apply the ConfigMap, then delete a Pod so a new one picks it up.",
      tasks: [
        "Apply both objects.",
        "Confirm the Pods are Ready.",
        "Edit a ConfigMap value and re-apply.",
      ],
      commands: [
        "kubectl get configmap app-config -o yaml",
        "kubectl get pods",
        "kubectl describe pod <pod>",
      ],
      debrief:
        "envFrom injects the ConfigMap's keys as environment variables when the container starts. Env is read once at start, so editing the ConfigMap does not change running Pods until they are recreated.",
    },
  ],
};

const storage: DocsLesson = {
  slug: ["operations", "storage"],
  title: "Storage: Volumes, PVs, and PVCs",
  description:
    "Understand ephemeral Pod storage, volumes, PersistentVolumes, and PersistentVolumeClaims.",
  section: "Operations",
  order: 4,
  concepts: ["storage", "pods", "statefulsets"],
  content: [
    {
      type: "heading",
      id: "pod-storage",
      text: "The Pod storage model",
    },
    {
      type: "paragraph",
      text: "Containers are cattle, not pets. A container's writable layer lives and dies with that container instance — a crash-restart or a reschedule to another node wipes it. Kubernetes solves this with Volumes: a Volume is a directory mounted into one or more containers in a Pod, and its lifetime is governed by the Volume type, not the container. Choosing storage is really about choosing a lifetime: does the data die with the container, with the Pod, or does it outlive both?",
    },
    {
      type: "heading",
      id: "ephemeral-vs-persistent",
      text: "Ephemeral vs persistent",
    },
    {
      type: "paragraph",
      text: "Ephemeral volumes are tied to the Pod's lifecycle. An emptyDir is created when the Pod is assigned to a node and deleted forever when the Pod is removed — great for scratch space, caches, or sharing files between containers in the same Pod. Persistent volumes live in the cluster independently of any Pod: a PersistentVolume (PV) survives Pod deletion, rescheduling, and even node loss (depending on the backend), so a database re-attaching after a restart finds its data intact.",
    },
    {
      type: "concept",
      term: "emptyDir",
      definition:
        "An ephemeral volume created empty when a Pod lands on a node and deleted with the Pod. Shared by all containers in the Pod. Use it for scratch and inter-container handoff — never for data you cannot lose.",
    },
    {
      type: "compare",
      caption:
        "Same mount, opposite lifetimes. The emptyDir vanishes with the Pod; the PVC-backed volume outlives it.",
      left: {
        title: "Ephemeral (emptyDir)",
        code: "volumes:\n  - name: cache\n    emptyDir: {}\n# gone when the Pod is deleted",
      },
      right: {
        title: "Persistent (PVC)",
        code: "volumes:\n  - name: data\n    persistentVolumeClaim:\n      claimName: data\n# survives Pod deletion + reschedule",
      },
    },
    {
      type: "heading",
      id: "pv-pvc-sc",
      text: "PV, PVC, and StorageClass",
    },
    {
      type: "paragraph",
      text: "Persistent storage is split into three objects so that users and administrators stay decoupled. A PersistentVolume (PV) is a piece of real storage in the cluster — an actual disk. A PersistentVolumeClaim (PVC) is a user's request for storage of a given size and access mode; it does not know or care which disk backs it. A StorageClass describes a 'kind' of storage and names the provisioner that can create PVs on demand. Binding is Kubernetes matching a PVC to a suitable PV.",
    },
    {
      type: "diagram",
      variant: "api-object",
      title: "PVC → PV → StorageClass",
      caption:
        "A Pod references a PVC. The PVC binds to a PV. With dynamic provisioning, a StorageClass creates that PV automatically.",
    },
    {
      type: "concept",
      term: "Dynamic provisioning",
      definition:
        "Instead of an admin pre-creating PVs (static provisioning), a PVC names a StorageClass and the class's provisioner creates a matching PV on demand at bind time. This is how most managed clusters work — the PVC is all you write.",
    },
    {
      type: "callout",
      tone: "info",
      title: "WaitForFirstConsumer",
      text: "A StorageClass with volumeBindingMode: WaitForFirstConsumer delays PV creation until a Pod actually uses the PVC. This lets the scheduler pick a node first, so the disk is provisioned in the same zone as the Pod — critical for zonal block storage that cannot cross availability zones.",
    },
    {
      type: "heading",
      id: "pvc-and-pod",
      text: "A PVC and a Pod that mounts it",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "Claim storage, then mount it",
      caption:
        "The PVC requests storage; the Pod references the claim by name and mounts it at a path.",
      lines: [
        {
          code: "apiVersion: v1",
        },
        {
          code: "kind: PersistentVolumeClaim",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: data",
          note: "the Pod will reference this claim by this exact name",
        },
        {
          code: "spec:",
        },
        {
          code: "  accessModes:",
        },
        {
          code: "    - ReadWriteOnce",
          note: "read-write by Pods on a single node — the common default for a block disk",
        },
        {
          code: "  storageClassName: standard",
          note: "which StorageClass provisions the PV; omit to use the cluster default class",
        },
        {
          code: "  resources:",
        },
        {
          code: "    requests:",
        },
        {
          code: "      storage: 1Gi",
          note: "the minimum capacity you need — the bound PV must be at least this big",
        },
        {
          code: "---",
        },
        {
          code: "apiVersion: v1",
        },
        {
          code: "kind: Pod",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: writer",
        },
        {
          code: "spec:",
        },
        {
          code: "  containers:",
        },
        {
          code: "    - name: app",
        },
        {
          code: "      image: klab/web-app:1.0.0",
        },
        {
          code: "      volumeMounts:",
        },
        {
          code: "        - name: data",
          note: "must match a name in spec.volumes below, NOT the PVC name directly",
        },
        {
          code: "          mountPath: /var/lib/data",
          note: "where inside the container the volume appears",
        },
        {
          code: "  volumes:",
        },
        {
          code: "    - name: data",
          note: "the in-Pod volume name referenced by volumeMounts",
        },
        {
          code: "      persistentVolumeClaim:",
        },
        {
          code: "        claimName: data",
          note: "the link to the PVC object above, by its metadata.name",
        },
      ],
    },
    {
      type: "heading",
      id: "build-pvc",
      text: "Build a PVC from scratch",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "A PVC grows in three steps",
      stages: [
        {
          label: "Skeleton",
          note: "The minimum object: apiVersion, kind, a name, and an empty spec. It requests nothing yet and cannot bind.",
          code: "apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: data\nspec: {}",
        },
        {
          label: "Request size and access mode",
          note: "Now the claim states what it needs: 1Gi of ReadWriteOnce storage. With a default StorageClass this is already enough to bind dynamically.",
          code: "apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: data\nspec:\n  accessModes:\n    - ReadWriteOnce\n  resources:\n    requests:\n      storage: 1Gi",
        },
        {
          label: "Pin the StorageClass",
          note: "Name the class explicitly so the claim does not silently depend on whichever class happens to be the cluster default.",
          code: "apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: data\nspec:\n  accessModes:\n    - ReadWriteOnce\n  storageClassName: standard\n  resources:\n    requests:\n      storage: 1Gi",
        },
      ],
    },
    {
      type: "heading",
      id: "access-modes",
      text: "Access modes",
    },
    {
      type: "paragraph",
      text: "An access mode declares how many nodes (or Pods) may mount a volume and whether writes are allowed. It is a constraint the storage backend must be able to honour — asking for ReadWriteMany on a plain cloud block disk will simply fail to bind. Note the subtlety: ReadWriteOnce is per-node, not per-Pod, so several Pods on the same node can share it.",
    },
    {
      type: "decisionTable",
      title: "The four access modes",
      columns: ["Meaning", "Typical use"],
      rows: [
        {
          label: "ReadWriteOnce (RWO)",
          cells: [
            "Read-write by Pods on a single node",
            "Block disks; most databases and single-node stateful apps",
          ],
        },
        {
          label: "ReadOnlyMany (ROX)",
          cells: [
            "Read-only, mounted by many nodes at once",
            "Shared static content or reference data served read-only",
          ],
        },
        {
          label: "ReadWriteMany (RWX)",
          cells: [
            "Read-write by many nodes at once",
            "Shared filesystems (NFS, CephFS) for multi-writer workloads",
          ],
        },
        {
          label: "ReadWriteOncePod (RWOP)",
          cells: [
            "Read-write by exactly one Pod cluster-wide",
            "Strict single-writer guarantee (K8s 1.22+, GA 1.29)",
          ],
        },
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "The backend must support the mode",
      text: "Access modes are not magic. ReadWriteMany requires a shared filesystem (NFS, CephFS, EFS); a standard cloud block volume only offers ReadWriteOnce. If a PVC asks for a mode the class cannot provide, the PVC stays Pending and any Pod using it stays Pending too — with no obvious error until you describe the PVC.",
    },
    {
      type: "heading",
      id: "reclaim-policies",
      text: "Reclaim policies",
    },
    {
      type: "paragraph",
      text: "A reclaim policy decides what happens to a PV (and its backing disk) when its PVC is deleted. Delete removes both the PV object and the real storage — convenient, and the default for dynamically provisioned volumes. Retain keeps the PV and the data, moving the PV to a Released state that an admin must reclaim by hand. The old Recycle policy is deprecated; use Retain or Delete.",
    },
    {
      type: "compare",
      caption:
        "The reclaimPolicy on the PV (usually inherited from the StorageClass) decides whether deleting a PVC destroys your data.",
      left: {
        title: "Retain — keep the data",
        code: "persistentVolumeReclaimPolicy: Retain\n# PVC delete -> PV goes Released\n# disk + data kept; admin reclaims manually",
      },
      right: {
        title: "Delete — clean up",
        code: "persistentVolumeReclaimPolicy: Delete\n# PVC delete -> PV + backing disk deleted\n# default for dynamic provisioning",
      },
    },
    {
      type: "callout",
      tone: "key",
      title: "Delete is the default — protect real data",
      text: "Dynamically provisioned volumes usually inherit reclaimPolicy: Delete from their StorageClass, so deleting a PVC can permanently destroy the disk. For anything you cannot lose, use a StorageClass (or patch the PV) with Retain.",
    },
    {
      type: "heading",
      id: "statefulset-storage",
      text: "Per-replica storage with volumeClaimTemplates",
    },
    {
      type: "paragraph",
      text: "A Deployment's replicas are interchangeable and share nothing, so they cannot each own a distinct disk. A StatefulSet gives every replica a stable identity and, via volumeClaimTemplates, its own PVC. Kubernetes creates one PVC per replica named <template>-<statefulset>-<ordinal> (for example data-web-0, data-web-1), and a rescheduled Pod re-attaches to the same PVC — so web-0 always gets web-0's data.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "volumeClaimTemplates in a StatefulSet",
      caption: "Each replica gets its own PVC minted from this template.",
      lines: [
        {
          code: "apiVersion: apps/v1",
        },
        {
          code: "kind: StatefulSet",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: web",
        },
        {
          code: "spec:",
        },
        {
          code: "  serviceName: web",
          note: "the headless Service that gives each Pod a stable DNS name",
        },
        {
          code: "  replicas: 3",
        },
        {
          code: "  selector:",
        },
        {
          code: "    matchLabels:",
        },
        {
          code: "      app: web",
        },
        {
          code: "  template:",
        },
        {
          code: "    metadata:",
        },
        {
          code: "      labels:",
        },
        {
          code: "        app: web",
        },
        {
          code: "    spec:",
        },
        {
          code: "      containers:",
        },
        {
          code: "        - name: app",
        },
        {
          code: "          image: klab/web-app:1.0.0",
        },
        {
          code: "          volumeMounts:",
        },
        {
          code: "            - name: data",
          note: "matches the volumeClaimTemplate name below",
        },
        {
          code: "              mountPath: /var/lib/data",
        },
        {
          code: "  volumeClaimTemplates:",
          note: "NOT under template.spec.volumes — it is a top-level StatefulSet field",
        },
        {
          code: "    - metadata:",
        },
        {
          code: "        name: data",
          note: "PVCs are named data-web-0, data-web-1, data-web-2",
        },
        {
          code: "      spec:",
        },
        {
          code: "        accessModes:",
        },
        {
          code: "          - ReadWriteOnce",
        },
        {
          code: "        resources:",
        },
        {
          code: "          requests:",
        },
        {
          code: "            storage: 1Gi",
        },
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "PVCs outlive their StatefulSet",
      text: "By default the PVCs created from volumeClaimTemplates are NOT deleted when you scale down or delete the StatefulSet — this protects data, but leaves orphaned PVCs (and disks, and bills) behind. Kubernetes 1.27+ adds persistentVolumeClaimRetentionPolicy to opt into automatic cleanup on scale-down or delete.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a stuck Pod",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "This Pod is stuck in Pending. The cluster has a default StorageClass that only provisions ReadWriteOnce block disks. kubectl describe pod shows it is waiting for a volume, and the PVC is also Pending. What's wrong?",
      code: "apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: shared\nspec:\n  accessModes:\n    - ReadWriteMany\n  resources:\n    requests:\n      storage: 1Gi",
      answer:
        "The PVC requests ReadWriteMany, but the only available StorageClass provisions ReadWriteOnce block disks. No PV can satisfy the claim, so the PVC stays Pending and the Pod that mounts it stays Pending too. Fix: request ReadWriteOnce (if a single node is fine), or point the PVC at a StorageClass backed by a shared filesystem (NFS/CephFS) that supports RWX.",
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write one yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Write a PersistentVolumeClaim named logs that requests 5Gi of ReadWriteOnce storage from the StorageClass named fast.",
      hint: "You need spec.accessModes, spec.storageClassName, and spec.resources.requests.storage.",
      solution:
        "apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: logs\nspec:\n  accessModes:\n    - ReadWriteOnce\n  storageClassName: fast\n  resources:\n    requests:\n      storage: 5Gi",
    },
    {
      type: "takeaways",
      items: [
        "Choosing storage means choosing a lifetime: emptyDir dies with the Pod; a PV outlives it.",
        "PVC = a request, PV = the real disk, StorageClass = the factory that mints PVs on demand.",
        "Access modes constrain sharing (RWO per-node, ROX read-only many, RWX read-write many, RWOP one Pod) and the backend must support the mode or the PVC hangs Pending.",
        "reclaimPolicy: Delete (the dynamic default) can destroy your disk when the PVC is deleted — use Retain for data you cannot lose.",
        "StatefulSet volumeClaimTemplates give each replica its own stable PVC, and those PVCs are not auto-deleted before 1.27's retention policy.",
      ],
    },
    {
      type: "quiz",
      id: "storage-q1",
      question: "Why should a database not rely only on a container's writable filesystem?",
      options: [
        {
          id: "a",
          text: "The writable layer is tied to a replaceable container instance and is lost on restart or reschedule.",
          correct: true,
          explanation:
            "Durable state needs a Volume/PV whose lifetime is independent of the container.",
        },
        {
          id: "b",
          text: "Services cannot route traffic to database Pods.",
          correct: false,
          explanation: "Services route to database Pods fine; routing is unrelated to persistence.",
        },
        {
          id: "c",
          text: "Pods are not allowed to mount any files.",
          correct: false,
          explanation:
            "Pods mount volumes routinely; the point is choosing storage with the right lifetime.",
        },
      ],
    },
    {
      type: "quiz",
      id: "storage-q2",
      question:
        "A PVC requesting ReadWriteMany sits in Pending forever, and the Pod using it never starts. What is the most likely cause?",
      options: [
        {
          id: "a",
          text: "The only StorageClass provisions ReadWriteOnce block disks, which cannot satisfy RWX.",
          correct: true,
          explanation:
            "RWX needs a shared filesystem backend (NFS, CephFS, EFS); a plain block disk offers only RWO, so no PV can bind.",
        },
        {
          id: "b",
          text: "The requested size of 1Gi is too small to provision.",
          correct: false,
          explanation:
            "Small requests are not a problem; PVs simply must be at least the requested size.",
        },
        {
          id: "c",
          text: "ReadWriteMany requires a StatefulSet to be used.",
          correct: false,
          explanation:
            "Access modes are independent of workload kind; RWX just needs a backend that supports multi-node read-write.",
        },
      ],
    },
  ],
  labs: [],
};

const accessControl: DocsLesson = {
  slug: ["operations", "service-accounts-rbac"],
  title: "Service Accounts & RBAC",
  description: "Give workloads and people the smallest Kubernetes API permissions they need.",
  section: "Operations",
  order: 5,
  concepts: ["service-accounts", "rbac", "security-contexts"],
  content: [
    {
      type: "heading",
      id: "identity-and-permission",
      text: "Identity and permission",
    },
    {
      type: "paragraph",
      text: "Every call to the Kubernetes API answers two questions in order: who are you (authentication), and are you allowed to do this (authorization). A ServiceAccount answers the first for a workload. RBAC answers the second by mapping that identity to a precise set of allowed verbs on specific resources. Keep the two ideas separate: identity says who, RBAC says what.",
    },
    {
      type: "paragraph",
      text: "The default posture is deny. A brand-new ServiceAccount can authenticate to the API server but can do almost nothing until a binding grants it permissions. You build access up rule by rule, never down from wide-open.",
    },
    {
      type: "heading",
      id: "service-accounts",
      text: "ServiceAccounts: identity for Pods",
    },
    {
      type: "paragraph",
      text: "A ServiceAccount is a namespaced identity that a Pod runs as. When you set spec.serviceAccountName on a Pod, the kubelet mounts a short-lived, audience-scoped token into the container at /var/run/secrets/kubernetes.io/serviceaccount/token. Client libraries read that token automatically, so code inside the Pod talks to the API as that ServiceAccount without any hard-coded credentials.",
    },
    {
      type: "concept",
      term: "Projected ServiceAccount token",
      definition:
        "Modern clusters project a bound, time-limited JWT into the Pod via a projected volume. The token is tied to that Pod's lifetime and a specific audience, and the kubelet rotates it before expiry. This replaces the old, non-expiring Secret-based tokens.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A Pod running as a ServiceAccount",
      caption: "The identity is chosen by name; the token is projected in for you.",
      lines: [
        {
          code: "apiVersion: v1",
        },
        {
          code: "kind: ServiceAccount",
        },
        {
          code: "metadata:",
          note: "the identity object itself — namespaced, so it lives in exactly one namespace",
        },
        {
          code: "  name: inspector",
        },
        {
          code: "  namespace: dev",
        },
        {
          code: "---",
        },
        {
          code: "apiVersion: v1",
        },
        {
          code: "kind: Pod",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: inspector-pod",
        },
        {
          code: "  namespace: dev",
        },
        {
          code: "spec:",
        },
        {
          code: "  serviceAccountName: inspector",
          note: "run as this identity — without this the Pod uses the namespace 'default' ServiceAccount",
        },
        {
          code: "  containers:",
        },
        {
          code: "    - name: app",
        },
        {
          code: "      image: klab/web-app:1.0.0",
        },
        {
          code: "  automountServiceAccountToken: true",
          note: "when true (the default) the projected token is mounted; set false to deny API access entirely",
        },
      ],
    },
    {
      type: "callout",
      tone: "info",
      title: "The default ServiceAccount is not special",
      text: "Every namespace has a 'default' ServiceAccount, and Pods that omit serviceAccountName use it. It has no extra powers — it is just an unnamed identity. Give workloads their own named ServiceAccount so you can grant and audit permissions per workload.",
    },
    {
      type: "heading",
      id: "rbac-objects",
      text: "The four RBAC objects",
    },
    {
      type: "paragraph",
      text: "RBAC has exactly two kinds of pieces: things that hold permissions (Role, ClusterRole) and things that hand those permissions to a subject (RoleBinding, ClusterRoleBinding). A Role or ClusterRole on its own grants nothing until a binding connects it to a user, group, or ServiceAccount.",
    },
    {
      type: "diagram",
      variant: "namespace-boundary",
      title: "Where each RBAC object lives",
      caption:
        "Roles and RoleBindings live inside a namespace; ClusterRoles and ClusterRoleBindings live above namespaces.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A Role plus the RoleBinding that activates it",
      caption:
        "Read this as two halves: the Role defines the permission; the RoleBinding assigns it.",
      lines: [
        {
          code: "apiVersion: rbac.authorization.k8s.io/v1",
          note: "all RBAC objects live in this API group",
        },
        {
          code: "kind: Role",
          note: "a namespaced permission set — only valid inside its own namespace",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: pod-reader",
        },
        {
          code: "  namespace: dev",
          note: "the Role only exists here; a binding in another namespace cannot see it",
        },
        {
          code: "rules:",
          note: "an allow-list — RBAC has no deny rules, so anything not listed is forbidden",
        },
        {
          code: '  - apiGroups: [""]',
          note: "the empty string is the core group (pods, services, configmaps, secrets)",
        },
        {
          code: '    resources: ["pods"]',
          note: "WHICH object types this rule covers",
        },
        {
          code: '    verbs: ["get", "list", "watch"]',
          note: "WHICH actions are allowed on those resources",
        },
        {
          code: "---",
        },
        {
          code: "apiVersion: rbac.authorization.k8s.io/v1",
        },
        {
          code: "kind: RoleBinding",
          note: "connects a subject to a Role or ClusterRole, within one namespace",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: read-pods",
        },
        {
          code: "  namespace: dev",
          note: "the binding's namespace decides WHERE the granted permissions apply",
        },
        {
          code: "subjects:",
          note: "WHO receives the permission",
        },
        {
          code: "  - kind: ServiceAccount",
        },
        {
          code: "    name: inspector",
        },
        {
          code: "    namespace: dev",
        },
        {
          code: "roleRef:",
          note: "WHICH permission set — this reference is immutable after creation",
        },
        {
          code: "  kind: Role",
          note: "a Role here is always resolved in the RoleBinding's own namespace",
        },
        {
          code: "  name: pod-reader",
        },
        {
          code: "  apiGroup: rbac.authorization.k8s.io",
        },
      ],
    },
    {
      type: "heading",
      id: "rule-anatomy",
      text: "Reading a rule: apiGroups, resources, verbs",
    },
    {
      type: "paragraph",
      text: 'A rule is the intersection of three lists. A request is allowed only if its API group, its resource, and its verb are all matched by the same rule. apiGroups names the API group ("" is the core group; "apps" holds Deployments and StatefulSets). resources names the object types. verbs names the actions: get, list, watch, create, update, patch, delete, and deletecollection.',
    },
    {
      type: "concept",
      term: "get vs list",
      definition:
        "get retrieves one named object; list enumerates a whole collection. Granting get without list lets a subject read a resource it already knows the name of but not discover what exists. watch streams changes and is what controllers and 'kubectl get -w' rely on.",
    },
    {
      type: "callout",
      tone: "key",
      title: "The empty-string group is not a typo",
      text: 'The core resources (pods, services, configmaps, secrets, nodes) belong to the core group written as apiGroups: [""]. Deployments and ReplicaSets are in "apps"; Jobs in "batch". If a rule targets the wrong group, it silently matches nothing and the request is denied.',
    },
    {
      type: "heading",
      id: "build-a-role",
      text: "Build a Role from scratch",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "A Role grows one dimension at a time",
      stages: [
        {
          label: "Empty allow-list",
          note: "A valid Role with no rules. It grants nothing — a subject bound to it is still fully denied.",
          code: "apiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: pod-reader\n  namespace: dev\nrules: []",
        },
        {
          label: "Name the resources",
          note: "Declare the group and resource this rule covers. Still no verbs, so no action is permitted yet.",
          code: 'apiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: pod-reader\n  namespace: dev\nrules:\n  - apiGroups: [""]\n    resources: ["pods"]',
        },
        {
          label: "Add verbs",
          note: "Now the rule is complete: read-only access to pods in the dev namespace. A binding can hand this to a subject.",
          code: 'apiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: pod-reader\n  namespace: dev\nrules:\n  - apiGroups: [""]\n    resources: ["pods"]\n    verbs: ["get", "list", "watch"]',
        },
      ],
    },
    {
      type: "heading",
      id: "how-authorized",
      text: "How a request gets authorized",
    },
    {
      type: "steps",
      title: "From kubectl to allow or deny",
      items: [
        {
          title: "Authenticate",
          text: "The API server verifies the caller's identity from the ServiceAccount token or client certificate. This produces a username or a ServiceAccount name plus groups.",
        },
        {
          title: "Build the attributes",
          text: "The request is described as (subject, verb, apiGroup, resource, namespace, name) — for example inspector wants to 'list' 'pods' in 'dev'.",
        },
        {
          title: "Check RBAC rules",
          text: "The authorizer looks for any binding that grants this subject a rule whose apiGroups, resources, and verbs all match the request. RBAC is purely additive across all matching bindings.",
        },
        {
          title: "Allow or deny",
          text: "If at least one rule matches, the request is allowed. If none match, it is denied — RBAC never has explicit deny rules, so absence of a grant is the denial.",
        },
      ],
    },
    {
      type: "callout",
      tone: "info",
      title: "Ask the API server directly",
      text: "kubectl auth can-i list pods --as=system:serviceaccount:dev:inspector returns yes or no by running the exact authorization check. It is the fastest way to prove whether a binding actually grants what you intended.",
    },
    {
      type: "heading",
      id: "role-vs-clusterrole",
      text: "Role vs ClusterRole",
    },
    {
      type: "paragraph",
      text: "A Role is confined to its namespace. A ClusterRole is not namespaced and can do two jobs: grant access to cluster-scoped resources (Nodes, PersistentVolumes, Namespaces themselves), or serve as a reusable permission set that many namespaces bind to. How a ClusterRole is bound decides how far its power reaches.",
    },
    {
      type: "decisionTable",
      title: "Choosing between Role and ClusterRole",
      columns: ["Scope", "Binds with", "Typical use"],
      rows: [
        {
          label: "Role",
          cells: [
            "One namespace only",
            "A RoleBinding in the same namespace",
            "Namespaced access: read pods or manage configmaps in a single namespace",
          ],
        },
        {
          label: "ClusterRole",
          cells: [
            "Cluster-wide (no namespace field)",
            "A ClusterRoleBinding (cluster-wide) or a RoleBinding (limited to that namespace)",
            "Cluster-scoped resources like nodes and PVs, or one reusable rule set shared across namespaces",
          ],
        },
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "A ClusterRole bound by a RoleBinding stays local",
      text: "Referencing a ClusterRole from a RoleBinding grants its permissions only inside that RoleBinding's namespace. This is the idiomatic way to reuse one permission definition (for example 'view') across many namespaces without granting it cluster-wide.",
    },
    {
      type: "heading",
      id: "least-privilege",
      text: "Least privilege in practice",
    },
    {
      type: "paragraph",
      text: "Least privilege means the smallest set of verbs on the narrowest set of resources that lets the workload do its job. Wildcards are the enemy: they grant tomorrow's resources you have not thought about yet, and they make an audit meaningless.",
    },
    {
      type: "compare",
      caption:
        "Both bind to the same ServiceAccount. Only one limits the blast radius if that Pod is compromised.",
      left: {
        title: "Too broad",
        code: 'rules:\n  - apiGroups: ["*"]\n    resources: ["*"]\n    verbs: ["*"]\n# cluster-admin over everything —\n# a leaked token owns the cluster',
      },
      right: {
        title: "Scoped to the job",
        code: 'rules:\n  - apiGroups: [""]\n    resources: ["pods"]\n    verbs: ["get", "list", "watch"]\n# read-only pods, one namespace —\n# a leaked token can only look',
      },
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a broken binding",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      title: "The permission never takes effect",
      prompt:
        "The inspector ServiceAccount in the dev namespace still gets 'forbidden' when it lists pods, even though this RoleBinding was applied successfully. The Role pod-reader was created in the prod namespace. What is wrong?",
      code: "apiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata:\n  name: read-pods\n  namespace: dev\nsubjects:\n  - kind: ServiceAccount\n    name: inspector\n    namespace: dev\nroleRef:\n  kind: Role\n  name: pod-reader\n  apiGroup: rbac.authorization.k8s.io",
      answer:
        "A RoleBinding always resolves a Role reference in its OWN namespace. This binding lives in dev, so it looks for a Role named pod-reader in dev — but the Role only exists in prod, so roleRef matches nothing and grants nothing. Kubernetes does not error on the dangling reference. Fix it by either creating the pod-reader Role in dev, or converting pod-reader to a ClusterRole and referencing it (a RoleBinding can bind a ClusterRole, limiting it to dev).",
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write it yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Grant a ServiceAccount named deployer in the 'apps' namespace permission to create and update Deployments (only) in that namespace. Author the Role and the RoleBinding.",
      hint: "Deployments are in the 'apps' API group, not the core group. You need verbs create, update, and get; a Role in namespace apps; and a RoleBinding in the same namespace whose roleRef points at that Role.",
      solution:
        'apiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: deployment-manager\n  namespace: apps\nrules:\n  - apiGroups: ["apps"]\n    resources: ["deployments"]\n    verbs: ["get", "list", "create", "update", "patch"]\n---\napiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata:\n  name: deployer-can-manage\n  namespace: apps\nsubjects:\n  - kind: ServiceAccount\n    name: deployer\n    namespace: apps\nroleRef:\n  kind: Role\n  name: deployment-manager\n  apiGroup: rbac.authorization.k8s.io',
    },
    {
      type: "takeaways",
      items: [
        "A ServiceAccount is a Pod's identity; RBAC decides what that identity may do. Authentication and authorization are separate steps.",
        "Role and RoleBinding are namespaced; ClusterRole and ClusterRoleBinding are not. A RoleBinding always resolves a Role in its own namespace.",
        "A rule is the intersection of apiGroups, resources, and verbs — a request is allowed only if all three match one rule.",
        "RBAC is deny-by-default and purely additive: no explicit deny exists, so a missing grant is the denial.",
        "Prefer narrow Roles over wildcards, and give each workload its own named ServiceAccount so access is auditable.",
      ],
    },
    {
      type: "quiz",
      id: "rbac-q1",
      question: "What does a RoleBinding do?",
      options: [
        {
          id: "a",
          text: "Grants the permissions in a Role or ClusterRole to a subject, within a namespace.",
          correct: true,
          explanation:
            "A RoleBinding connects a subject (user, group, or ServiceAccount) to a permission set, activating it in the binding's namespace.",
        },
        {
          id: "b",
          text: "Defines which verbs and resources are allowed.",
          correct: false,
          explanation:
            "That is what a Role or ClusterRole does. A RoleBinding only assigns an existing permission set to a subject.",
        },
        {
          id: "c",
          text: "Creates a network route between Pods.",
          correct: false,
          explanation:
            "Routing is handled by Services and networking components; RBAC controls API access, not traffic.",
        },
        {
          id: "d",
          text: "Stores the ServiceAccount's token.",
          correct: false,
          explanation:
            "Tokens are projected into Pods by the kubelet; a RoleBinding never holds credentials.",
        },
      ],
    },
    {
      type: "quiz",
      id: "rbac-q2",
      question:
        "You need to grant a ServiceAccount read access to Nodes, which are cluster-scoped resources. Which objects should you use?",
      options: [
        {
          id: "a",
          text: "A ClusterRole plus a ClusterRoleBinding.",
          correct: true,
          explanation:
            "Nodes are not namespaced, so the permission must come from a ClusterRole, and cluster-wide access requires a ClusterRoleBinding.",
        },
        {
          id: "b",
          text: "A Role plus a RoleBinding in the default namespace.",
          correct: false,
          explanation:
            "A namespaced Role cannot grant access to cluster-scoped resources like Nodes, no matter which namespace it lives in.",
        },
        {
          id: "c",
          text: "Only a ServiceAccount with automountServiceAccountToken: true.",
          correct: false,
          explanation:
            "Mounting a token grants identity, not permissions. Without a binding, the ServiceAccount is still denied.",
        },
        {
          id: "d",
          text: 'A wildcard Role with verbs: ["*"].',
          correct: false,
          explanation:
            "A Role is still namespaced even with wildcards, so it cannot cover cluster-scoped Nodes — and wildcards violate least privilege.",
        },
      ],
    },
  ],
  labs: [],
};

const podSecurity: DocsLesson = {
  slug: ["operations", "pod-security"],
  title: "Pod Security Contexts",
  description:
    "Constrain what a container can do at runtime with user, privilege, filesystem, and capability settings.",
  section: "Operations",
  order: 6,
  concepts: ["security-contexts", "pods", "debugging"],
  content: [
    {
      type: "heading",
      id: "why-runtime-hardening",
      text: "Why runtime hardening exists",
    },
    {
      type: "paragraph",
      text: "A container image can ask to run as root, escalate privileges, write anywhere on its filesystem, and hold every Linux capability. Nothing stops it by default. A securityContext narrows those runtime permissions so that if application code is compromised, the attacker inherits a small, boring box instead of a root shell that can touch the node. The goal is least privilege: start locked down, then open only what the workload proves it needs.",
    },
    {
      type: "diagram",
      variant: "pod",
      title: "Where the securityContext applies",
      caption:
        "Pod-level settings apply to every container; container-level settings narrow one container.",
    },
    {
      type: "heading",
      id: "pod-vs-container",
      text: "Pod-level vs container-level",
    },
    {
      type: "paragraph",
      text: "There are two securityContext blocks and they are not the same. spec.securityContext is pod-level: it sets defaults for every container and controls volume ownership (fsGroup). spec.containers[].securityContext is container-level and overrides the pod-level values for that one container. Some fields only exist at one level: fsGroup is pod-only; readOnlyRootFilesystem, allowPrivilegeEscalation, and capabilities are container-only.",
    },
    {
      type: "concept",
      term: "Pod securityContext vs container securityContext",
      definition:
        "Pod-level securityContext (spec.securityContext) sets identity defaults (runAsUser, runAsNonRoot, fsGroup, seccompProfile) for all containers. Container-level securityContext (spec.containers[].securityContext) overrides them per container and owns filesystem and capability controls. When both set the same field, the container-level value wins for that container.",
    },
    {
      type: "heading",
      id: "hardened-manifest",
      text: "A hardened Pod, line by line",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A fully hardened Pod",
      caption: "Every runtime-hardening knob that a restricted namespace expects.",
      lines: [
        {
          code: "apiVersion: v1",
        },
        {
          code: "kind: Pod",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: web",
        },
        {
          code: "  namespace: prod",
          note: "this namespace is labeled to enforce the restricted policy (see below)",
        },
        {
          code: "spec:",
        },
        {
          code: "  securityContext:",
          note: "POD-LEVEL: applies to every container and to volume ownership",
        },
        {
          code: "    runAsNonRoot: true",
          note: "kubelet refuses to start the container if the image would run as UID 0",
        },
        {
          code: "    runAsUser: 1000",
          note: "run the process as this UID; must be non-zero to satisfy runAsNonRoot",
        },
        {
          code: "    fsGroup: 2000",
          note: "pod-only: sets group ownership on mounted volumes so a non-root user can write to them",
        },
        {
          code: "    seccompProfile:",
          note: "restrict which syscalls the kernel accepts from this pod",
        },
        {
          code: "      type: RuntimeDefault",
          note: "use the container runtime's default seccomp profile; 'Unconfined' is rejected by restricted",
        },
        {
          code: "  containers:",
        },
        {
          code: "    - name: app",
        },
        {
          code: "      image: klab/web-app:1.0.0",
        },
        {
          code: "      securityContext:",
          note: "CONTAINER-LEVEL: narrows this one container",
        },
        {
          code: "        allowPrivilegeEscalation: false",
          note: "blocks setuid binaries and file capabilities from granting more privilege than the parent",
        },
        {
          code: "        readOnlyRootFilesystem: true",
          note: "the root filesystem is mounted read-only; writable paths need an explicit volume",
        },
        {
          code: "        capabilities:",
          note: "container-only: control Linux capabilities",
        },
        {
          code: "          drop:",
          note: "remove capabilities from the default set",
        },
        {
          code: "            - ALL",
          note: "drop every capability, then add back only what the app truly needs (often nothing)",
        },
      ],
    },
    {
      type: "heading",
      id: "build-it",
      text: "Build the hardening up in stages",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "From wide-open to locked down",
      stages: [
        {
          label: "Unrestricted",
          note: "A plain Pod with no securityContext. It runs as whatever user the image declares — frequently root (UID 0) — with the full default capability set and a writable root filesystem. This is the blast radius you are trying to shrink.",
          code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  containers:\n    - name: app\n      image: klab/web-app:1.0.0",
        },
        {
          label: "Fix identity",
          note: "Add pod-level identity controls: force a non-root user and pin a UID, and apply the runtime's default seccomp profile. Now the process cannot start as root and its syscalls are filtered.",
          code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  securityContext:\n    runAsNonRoot: true\n    runAsUser: 1000\n    seccompProfile:\n      type: RuntimeDefault\n  containers:\n    - name: app\n      image: klab/web-app:1.0.0",
        },
        {
          label: "Lock the container",
          note: "Add the container-level controls: block privilege escalation, make the root filesystem read-only, and drop every Linux capability. This pod now satisfies the restricted Pod Security Standard.",
          code: 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  securityContext:\n    runAsNonRoot: true\n    runAsUser: 1000\n    seccompProfile:\n      type: RuntimeDefault\n  containers:\n    - name: app\n      image: klab/web-app:1.0.0\n      securityContext:\n        allowPrivilegeEscalation: false\n        readOnlyRootFilesystem: true\n        capabilities:\n          drop: ["ALL"]',
        },
      ],
    },
    {
      type: "callout",
      tone: "key",
      title: "runAsNonRoot is a check, runAsUser is a setting",
      text: "runAsNonRoot: true does not choose a UID — it tells the kubelet to refuse the container if it would resolve to UID 0. runAsUser: 1000 actually sets the UID. If the image's default user is root and you set runAsNonRoot: true without runAsUser, the container fails to start with 'container has runAsNonRoot and image will run as root'. Set both, or bake a non-root USER into the image.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "readOnlyRootFilesystem breaks apps that write to disk",
      text: "Many processes write temp files, caches, or PID files under / at startup. With readOnlyRootFilesystem: true those writes fail with 'read-only file system'. Mount an emptyDir volume at each writable path (for example /tmp) so the app has scratch space while the rest of the filesystem stays immutable.",
    },
    {
      type: "heading",
      id: "pod-security-admission",
      text: "Pod Security Admission enforces the standards",
    },
    {
      type: "paragraph",
      text: "Setting a good securityContext is voluntary — nothing forces a team to do it. Pod Security Admission (PSA) is the built-in admission controller that makes it mandatory per namespace. It checks every incoming Pod against one of three Pod Security Standards and can reject, audit, or warn. You turn it on with labels on the Namespace; no extra install, no webhook.",
    },
    {
      type: "diagram",
      variant: "namespace-boundary",
      title: "PSA gates Pods at the namespace edge",
      caption:
        "The level a namespace enforces is decided by its labels, checked at admission before the Pod is created.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "Labeling a namespace to enforce restricted",
      caption: "PSA reads three modes off the namespace: enforce, audit, warn.",
      lines: [
        {
          code: "apiVersion: v1",
        },
        {
          code: "kind: Namespace",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: prod",
        },
        {
          code: "  labels:",
        },
        {
          code: "    pod-security.kubernetes.io/enforce: restricted",
          note: "REJECT any Pod that violates the restricted standard at create time",
        },
        {
          code: "    pod-security.kubernetes.io/enforce-version: latest",
          note: "pin the policy version; 'latest' tracks the cluster version",
        },
        {
          code: "    pod-security.kubernetes.io/audit: restricted",
          note: "log violations to the audit log without blocking (useful while migrating)",
        },
        {
          code: "    pod-security.kubernetes.io/warn: restricted",
          note: "return a client-visible warning on kubectl apply without blocking",
        },
      ],
    },
    {
      type: "concept",
      term: "enforce vs audit vs warn",
      definition:
        "PSA runs three independent modes. enforce blocks non-compliant Pods at admission. audit records a violation in the audit log but allows the Pod. warn surfaces the violation to the user's client (for example a kubectl warning) but allows the Pod. A common rollout is warn+audit first to find offenders, then flip enforce on.",
    },
    {
      type: "heading",
      id: "the-three-levels",
      text: "The three Pod Security Standards",
    },
    {
      type: "decisionTable",
      title: "Which PSA level for which namespace",
      columns: ["What it allows", "When to use"],
      rows: [
        {
          label: "privileged",
          cells: [
            "Everything — no restrictions at all. Permits privileged containers, host namespaces, host paths, and any capability.",
            "System and infrastructure namespaces (CNI, storage, monitoring agents) that genuinely need node-level access.",
          ],
        },
        {
          label: "baseline",
          cells: [
            "Blocks known privilege escalations (privileged, hostNetwork/hostPID/hostIPC, hostPath, most added capabilities) but still permits running as root.",
            "General application namespaces that need a sane floor with minimal friction for existing workloads.",
          ],
        },
        {
          label: "restricted",
          cells: [
            "Enforces least privilege: requires runAsNonRoot, allowPrivilegeEscalation:false, capabilities drop ALL, and seccompProfile RuntimeDefault/Localhost.",
            "Hardened namespaces for untrusted or internet-facing workloads; the recommended target for new applications.",
          ],
        },
      ],
    },
    {
      type: "compare",
      caption:
        "The same container, before and after hardening — the left form is rejected by a restricted namespace.",
      left: {
        title: "Rejected by restricted",
        code: "containers:\n  - name: app\n    image: klab/web-app:1.0.0\n    # no securityContext\n    # runs as root, keeps all caps",
      },
      right: {
        title: "Accepted by restricted",
        code: 'containers:\n  - name: app\n    image: klab/web-app:1.0.0\n    securityContext:\n      allowPrivilegeEscalation: false\n      capabilities:\n        drop: ["ALL"]\n      # + pod-level runAsNonRoot\n      # + seccompProfile RuntimeDefault',
      },
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a Pod a restricted namespace rejects",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "This Pod is rejected at create time in namespace prod, which is labeled pod-security.kubernetes.io/enforce: restricted. kubectl apply returns an admission error before any Pod object is created. What violates the policy, and what does restricted require instead?",
      code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: legacy\n  namespace: prod\nspec:\n  containers:\n    - name: app\n      image: klab/web-app:1.0.0\n      securityContext:\n        privileged: true",
      answer:
        'privileged: true is a hard violation — restricted (and even baseline) forbid privileged containers outright. But this Pod fails on more than that: restricted also requires runAsNonRoot: true (the image would otherwise run as root), allowPrivilegeEscalation: false, capabilities.drop of ALL, and a seccompProfile of RuntimeDefault or Localhost. PSA rejects the whole Pod at admission, so it never appears in kubectl get pods. Fix: remove privileged, add pod-level runAsNonRoot: true with a non-zero runAsUser and seccompProfile.type: RuntimeDefault, and container-level allowPrivilegeEscalation: false plus capabilities.drop ["ALL"].',
    },
    {
      type: "heading",
      id: "challenge",
      text: "Harden a container yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Start from a bare Pod running klab/web-app:1.0.0 and add exactly the securityContext fields it needs to be admitted into a namespace enforcing the restricted standard. Run as UID 1000.",
      hint: "restricted checks four things: runAsNonRoot true (with a non-zero runAsUser), allowPrivilegeEscalation false, all capabilities dropped, and seccompProfile RuntimeDefault. Split them across the pod-level and container-level securityContext.",
      solution:
        'apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  securityContext:\n    runAsNonRoot: true\n    runAsUser: 1000\n    seccompProfile:\n      type: RuntimeDefault\n  containers:\n    - name: app\n      image: klab/web-app:1.0.0\n      securityContext:\n        allowPrivilegeEscalation: false\n        capabilities:\n          drop: ["ALL"]',
    },
    {
      type: "heading",
      id: "takeaways",
      text: "Takeaways",
    },
    {
      type: "takeaways",
      items: [
        "securityContext narrows runtime privileges; pod-level sets defaults and volume ownership, container-level owns filesystem and capabilities.",
        "runAsNonRoot: true only refuses UID 0 — pair it with runAsUser (non-zero) or a non-root image USER to actually set the identity.",
        "The restricted standard wants runAsNonRoot, allowPrivilegeEscalation: false, drop ALL capabilities, and seccompProfile RuntimeDefault.",
        "Pod Security Admission enforces a standard (privileged, baseline, or restricted) per namespace via labels — enforce blocks, audit logs, warn notifies.",
        "readOnlyRootFilesystem: true is a strong hardening step but not required by restricted; give writable paths an emptyDir volume.",
      ],
    },
    {
      type: "quiz",
      id: "pod-security-q1",
      question:
        "Which setting prevents a container process from gaining more privileges than its parent, for example through a setuid binary?",
      options: [
        {
          id: "a",
          text: "allowPrivilegeEscalation: false",
          correct: true,
          explanation:
            "This blocks the process from acquiring more privileges than the parent, and is one of the fields the restricted standard requires.",
        },
        {
          id: "b",
          text: "replicas: 3",
          correct: false,
          explanation:
            "Replica count changes how many Pods run, not what any process is allowed to do.",
        },
        {
          id: "c",
          text: "targetPort: 8080",
          correct: false,
          explanation:
            "targetPort controls Service routing to a container port; it has nothing to do with process privileges.",
        },
        {
          id: "d",
          text: "readOnlyRootFilesystem: true",
          correct: false,
          explanation:
            "This makes the root filesystem immutable — valuable, but it limits writes, not privilege escalation.",
        },
      ],
    },
    {
      type: "quiz",
      id: "pod-security-q2",
      question:
        "How do you make Kubernetes reject any Pod that violates the restricted Pod Security Standard in the 'prod' namespace?",
      options: [
        {
          id: "a",
          text: "Add the label pod-security.kubernetes.io/enforce: restricted to the prod Namespace.",
          correct: true,
          explanation:
            "Pod Security Admission reads the enforce label off the Namespace and blocks non-compliant Pods at admission — no webhook or install needed.",
        },
        {
          id: "b",
          text: "Set enforce: restricted inside each Pod's spec.securityContext.",
          correct: false,
          explanation:
            "There is no such Pod field; enforcement is configured on the Namespace, not the Pod.",
        },
        {
          id: "c",
          text: "Install a LoadBalancer Service in the namespace.",
          correct: false,
          explanation:
            "Service type governs network exposure and is unrelated to admission or security standards.",
        },
        {
          id: "d",
          text: "Use the warn label — it blocks non-compliant Pods.",
          correct: false,
          explanation:
            "The warn mode only surfaces a client-visible warning and still allows the Pod; enforce is the mode that blocks.",
        },
      ],
    },
  ],
  labs: [],
};

const networkPolicies: DocsLesson = {
  slug: ["operations", "network-policies"],
  title: "Network Policies",
  description:
    "NetworkPolicies describe which Pods may communicate with each other and with other network endpoints.",
  section: "Operations",
  order: 7,
  concepts: ["network-policies", "networking", "pods", "labels-selectors"],
  content: [
    {
      type: "heading",
      id: "why-network-policies",
      text: "Why NetworkPolicies exist",
    },
    {
      type: "paragraph",
      text: "By default, every Pod in a cluster can talk to every other Pod. The Pod network is flat and fully open: no firewall, no segmentation. A NetworkPolicy is how you carve that flat network into allowed conversations. It is a label-driven object that selects Pods and declares which traffic may enter (ingress) or leave (egress) them.",
    },
    {
      type: "concept",
      term: "Default-allow, then default-deny",
      definition:
        "A namespace starts default-allow. The moment ANY NetworkPolicy selects a Pod for a direction (Ingress or Egress), that direction flips to default-deny for that Pod: only traffic matching an allow rule is permitted, everything else is dropped. Policies are additive allow-lists — there is no explicit 'deny' rule.",
    },
    {
      type: "diagram",
      variant: "namespace-boundary",
      title: "Policies segment a flat namespace",
      caption:
        "Without policy, all Pods reach all Pods. A policy selecting a Pod isolates it to explicit allows.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "The CNI must enforce NetworkPolicy",
      text: "A NetworkPolicy is only a declaration. Enforcement is the job of the cluster's CNI plugin (Calico, Cilium, Antrea, Weave, and others). If the installed CNI does not implement NetworkPolicy — plain flannel, for example — the API server accepts your object and reports success, but zero packets are ever filtered. A 'working' policy that does nothing is almost always an unsupported CNI.",
    },
    {
      type: "heading",
      id: "policy-directions",
      text: "Ingress, egress, and policyTypes",
    },
    {
      type: "paragraph",
      text: "A policy governs two independent directions. Ingress rules describe who may connect INTO the selected Pods; egress rules describe where the selected Pods may connect OUT to. The policyTypes list declares which directions this policy is responsible for — and this is where the most useful behavior lives.",
    },
    {
      type: "concept",
      term: "Empty rules mean deny-all for that direction",
      definition:
        "If policyTypes includes Egress but you write no egress rules, every egress from the selected Pods is denied. Kubernetes also auto-populates policyTypes: it infers Ingress if you wrote ingress rules and Egress if you wrote egress rules. To build a pure deny-all baseline you name the direction in policyTypes and provide no matching rules.",
    },
    {
      type: "heading",
      id: "deny-all-baseline",
      text: "The deny-all baseline",
    },
    {
      type: "paragraph",
      text: "The standard pattern is defense in depth: lay down a deny-all baseline for the namespace, then add narrow allow policies on top. Because policies are additive, the baseline sets the floor and each allow policy pokes a specific hole.",
    },
    {
      type: "code",
      language: "yaml",
      code: "apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: default-deny-ingress\n  namespace: default\nspec:\n  podSelector: {}          # selects EVERY Pod in the namespace\n  policyTypes: [Ingress]   # Ingress named, no ingress rules => deny all ingress",
    },
    {
      type: "callout",
      tone: "key",
      title: "podSelector: {} selects all Pods",
      text: "An empty podSelector ({}) is not 'select nothing' — it matches every Pod in the policy's namespace. That is exactly what you want for a namespace-wide baseline, and exactly the surprise that makes a narrow policy accidentally apply to everything. Read {} as 'all Pods here', and read a missing key as a match-nothing typo.",
    },
    {
      type: "heading",
      id: "allow-from-app",
      text: "Adding an allow-from-app policy",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "Allow web -> api on 8080",
      caption: "Sits on top of the deny-all baseline: opens exactly one conversation.",
      lines: [
        {
          code: "apiVersion: networking.k8s.io/v1",
        },
        {
          code: "kind: NetworkPolicy",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: allow-web-to-api",
        },
        {
          code: "  namespace: default",
          note: "policies are namespaced — they only select Pods in this namespace",
        },
        {
          code: "spec:",
        },
        {
          code: "  podSelector:",
          note: "WHICH Pods this policy protects (the destination for ingress)",
        },
        {
          code: "    matchLabels:",
        },
        {
          code: "      app: api",
          note: "this policy applies to Pods labeled app: api",
        },
        {
          code: "  policyTypes: [Ingress]",
          note: "only governs inbound traffic to the api Pods",
        },
        {
          code: "  ingress:",
          note: "the allow-list; anything not listed here is dropped for api Pods",
        },
        {
          code: "    - from:",
          note: "each list item is one allowed source (peers are OR-ed together)",
        },
        {
          code: "        - podSelector:",
          note: "allow Pods matching this label as the source",
        },
        {
          code: "            matchLabels:",
        },
        {
          code: "              app: web",
          note: "only Pods labeled app: web may connect",
        },
        {
          code: "      ports:",
          note: "narrow the allow to specific ports; omit to allow all ports",
        },
        {
          code: "        - protocol: TCP",
        },
        {
          code: "          port: 8080",
          note: "web may reach api ONLY on TCP 8080",
        },
      ],
    },
    {
      type: "heading",
      id: "build-it",
      text: "Build the allow policy in stages",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "An allow policy grows in three steps",
      stages: [
        {
          label: "Select the target Pods",
          note: "Start by choosing WHO this policy protects. With Ingress named but no rules, this already denies all ingress to api Pods — a scoped deny-all.",
          code: "apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-web-to-api\n  namespace: default\nspec:\n  podSelector:\n    matchLabels:\n      app: api\n  policyTypes: [Ingress]",
        },
        {
          label: "Allow a source",
          note: "Add an ingress rule permitting Pods labeled app: web. api now accepts traffic from web on ANY port, but nothing else.",
          code: "apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-web-to-api\n  namespace: default\nspec:\n  podSelector:\n    matchLabels:\n      app: api\n  policyTypes: [Ingress]\n  ingress:\n    - from:\n        - podSelector:\n            matchLabels:\n              app: web",
        },
        {
          label: "Constrain the port",
          note: "Tighten to exactly TCP 8080. Now the only conversation allowed into api is web -> api:8080; everything else stays denied.",
          code: "apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-web-to-api\n  namespace: default\nspec:\n  podSelector:\n    matchLabels:\n      app: api\n  policyTypes: [Ingress]\n  ingress:\n    - from:\n        - podSelector:\n            matchLabels:\n              app: web\n      ports:\n        - protocol: TCP\n          port: 8080",
        },
      ],
    },
    {
      type: "heading",
      id: "peer-selectors",
      text: "Choosing a peer: podSelector, namespaceSelector, ipBlock",
    },
    {
      type: "paragraph",
      text: "Inside a from (ingress) or to (egress) block, each peer describes a source or destination. There are three peer kinds, and a critical subtlety in how they combine.",
    },
    {
      type: "concept",
      term: "AND within a peer, OR across peers",
      definition:
        "Two selectors in the SAME list item are AND-ed: '- namespaceSelector + podSelector' means Pods matching the podSelector that also live in a matching namespace. Split them into TWO list items and they become OR-ed: 'match those Pods anywhere' OR 'any Pod in those namespaces'. A stray dash silently widens your policy.",
    },
    {
      type: "decisionTable",
      title: "Which peer selector?",
      columns: ["Matches", "Use when"],
      rows: [
        {
          label: "podSelector",
          cells: [
            "Pods by label in the policy's own namespace",
            "Same-namespace service-to-service traffic",
          ],
        },
        {
          label: "namespaceSelector",
          cells: [
            "All Pods in namespaces matching a label",
            "Allow a whole tier/team namespace, e.g. ingress-nginx",
          ],
        },
        {
          label: "namespaceSelector + podSelector",
          cells: [
            "Specific Pods within specific namespaces (AND)",
            "A named app in another namespace",
          ],
        },
        {
          label: "ipBlock",
          cells: [
            "A CIDR range, with optional except entries",
            "External / off-cluster IPs and egress to the internet",
          ],
        },
      ],
    },
    {
      type: "compare",
      caption:
        "Ingress lists sources under 'from'; egress lists destinations under 'to'. Same peer shapes, opposite direction.",
      left: {
        title: "ingress (who may connect in)",
        code: "policyTypes: [Ingress]\ningress:\n  - from:\n      - podSelector:\n          matchLabels:\n            app: web\n    ports:\n      - port: 8080",
      },
      right: {
        title: "egress (where it may connect out)",
        code: "policyTypes: [Egress]\negress:\n  - to:\n      - ipBlock:\n          cidr: 10.0.0.0/8\n    ports:\n      - port: 443",
      },
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a broken egress policy",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "This policy is meant to let the web Pods call the api service. After applying it, web can no longer resolve api-svc and every request fails with a DNS lookup error, even though the api Pods are healthy. What's wrong?",
      code: "apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: web-egress\n  namespace: default\nspec:\n  podSelector:\n    matchLabels:\n      app: web\n  policyTypes: [Egress]\n  egress:\n    - to:\n        - podSelector:\n            matchLabels:\n              app: api\n      ports:\n        - protocol: TCP\n          port: 8080",
      answer:
        "The moment this Egress policy selects the web Pods, ALL egress not explicitly allowed is denied — including DNS. Web can only send to api:8080, so its lookups to kube-dns (UDP and TCP port 53 in kube-system) are dropped and 'api-svc' never resolves. Fix: add a second egress rule allowing port 53 to the DNS Pods, e.g. 'to: - namespaceSelector matching kube-system' with 'ports: - {protocol: UDP, port: 53}' and the TCP 53 variant. Whenever a policy governs egress, remember to allow DNS.",
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write it yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Author TWO policies for the default namespace: (1) a deny-all-ingress baseline for every Pod, and (2) an allow policy so Pods labeled app: web may reach Pods labeled app: api on TCP 8080.",
      hint: "The baseline uses podSelector: {} with policyTypes: [Ingress] and no rules. The allow policy selects app: api and lists app: web under ingress.from.",
      solution:
        "apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: default-deny-ingress\n  namespace: default\nspec:\n  podSelector: {}\n  policyTypes: [Ingress]\n---\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-web-to-api\n  namespace: default\nspec:\n  podSelector:\n    matchLabels:\n      app: api\n  policyTypes: [Ingress]\n  ingress:\n    - from:\n        - podSelector:\n            matchLabels:\n              app: web\n      ports:\n        - protocol: TCP\n          port: 8080",
    },
    {
      type: "takeaways",
      items: [
        "A namespace is default-allow until a policy selects a Pod for a direction; then that direction is default-deny for that Pod and only listed traffic is allowed.",
        "Policies are additive allow-lists — no deny rule exists. Build a deny-all baseline, then poke narrow holes with allow policies.",
        "podSelector: {} selects every Pod in the namespace; naming a direction in policyTypes with no rules denies that whole direction.",
        "Peer selectors AND when in the same list item and OR across separate items; podSelector is same-namespace, namespaceSelector spans namespaces, ipBlock covers CIDRs.",
        "Any egress policy that selects a Pod also blocks its DNS — always allow port 53 to kube-dns, and confirm your CNI actually enforces NetworkPolicy.",
      ],
    },
    {
      type: "quiz",
      id: "network-policy-q1",
      question: "A namespace has no NetworkPolicies. What traffic is allowed between its Pods?",
      options: [
        {
          id: "a",
          text: "All traffic — Pods are default-allow until a policy selects them.",
          correct: true,
          explanation:
            "With no policy selecting a Pod, both ingress and egress are unrestricted. Isolation begins only when a policy selects the Pod for that direction.",
        },
        {
          id: "b",
          text: "No traffic — Kubernetes denies all Pod traffic by default.",
          correct: false,
          explanation:
            "The default is the opposite: a flat, fully open Pod network. Deny-all is something you must create with a policy.",
        },
        {
          id: "c",
          text: "Only traffic on port 443.",
          correct: false,
          explanation:
            "Kubernetes applies no default port filtering; ports are only restricted by rules you write.",
        },
      ],
    },
    {
      type: "quiz",
      id: "network-policy-q2",
      question:
        "You add an Egress policy selecting the web Pods and allow only api:8080. Name resolution immediately breaks. Why?",
      options: [
        {
          id: "a",
          text: "The egress policy denies all other outbound traffic, including DNS to kube-dns on port 53.",
          correct: true,
          explanation:
            "Selecting a Pod for Egress flips it to default-deny outbound. Unless you also allow UDP/TCP 53 to the DNS Pods, lookups are dropped.",
        },
        {
          id: "b",
          text: "NetworkPolicies disable CoreDNS for the whole cluster.",
          correct: false,
          explanation:
            "Policies filter packets for selected Pods; they do not turn off the cluster DNS service.",
        },
        {
          id: "c",
          text: "DNS uses a Service, and policies cannot affect Service traffic.",
          correct: false,
          explanation:
            "Policies act on Pod-to-Pod packets, including the traffic to the kube-dns backend Pods behind the DNS Service.",
        },
      ],
    },
  ],
  labs: [],
};

const scheduling: DocsLesson = {
  slug: ["operations", "scheduling"],
  title: "Scheduling, Taints, and Affinity",
  description:
    "Learn how Pods land on nodes and how to influence placement without hard-coding everything.",
  section: "Operations",
  order: 8,
  concepts: ["scheduling", "pods", "resources"],
  content: [
    {
      type: "heading",
      id: "placement",
      text: "How a Pod lands on a node",
    },
    {
      type: "paragraph",
      text: "A Pod's spec.nodeName is empty when you create it. The kube-scheduler watches for exactly these unbound Pods, picks a node for each one, and writes that choice into the Pod's binding. Everything in this lesson — nodeSelector, affinity, taints and tolerations, topology spread — is a way to influence that single decision without hard-coding a node name. Nothing here starts, stops, or moves a container by itself; the scheduler only decides placement, and the kubelet on the chosen node does the running.",
    },
    {
      type: "diagram",
      variant: "cluster-architecture",
      title: "The scheduler picks among nodes",
      caption:
        "The scheduler reads the Pod and the current nodes, then binds the Pod to one feasible, high-scoring node.",
    },
    {
      type: "steps",
      title: "The scheduling cycle, in order",
      items: [
        {
          title: "Filter (feasibility)",
          text: "Hard rules run first and eliminate nodes: does the node have enough allocatable CPU/memory for the Pod's requests, does it match nodeSelector and required node affinity, does the Pod tolerate the node's taints, are required volumes attachable? A node that fails any filter is out. If zero nodes survive, the Pod stays Pending — this is where most 'why won't it schedule' incidents live.",
        },
        {
          title: "Score (ranking)",
          text: "Every surviving node gets a score from 0-100 across several plugins: preferred affinity, spreading, least/most-allocated resources, image locality. Weights combine into one number per node.",
        },
        {
          title: "Bind",
          text: "The highest-scoring node wins (ties broken at random), and the scheduler binds the Pod to it. Only now does that node's kubelet see the Pod and pull/run its containers.",
        },
      ],
    },
    {
      type: "heading",
      id: "node-selector",
      text: "nodeSelector: the blunt instrument",
    },
    {
      type: "paragraph",
      text: "nodeSelector is the simplest placement control: a map of label key/value pairs the node must have. It is exact-match and AND-only — every pair must be present on the node — and it is always a hard requirement with no soft fallback. If nothing matches, the Pod stays Pending. Reach for it only when your rule really is 'this exact label must be present'; the moment you need OR logic, ranges, or a preference, you have outgrown it and want affinity.",
    },
    {
      type: "code",
      language: "yaml",
      code: "spec:\n  nodeSelector:\n    disktype: ssd\n    topology.kubernetes.io/zone: us-east-1a\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0",
    },
    {
      type: "heading",
      id: "affinity",
      text: "Affinity: expressive attraction and repulsion",
    },
    {
      type: "paragraph",
      text: "Affinity comes in two families. Node affinity matches labels on nodes with real operators — In, NotIn, Exists, DoesNotExist, Gt, Lt — so you can say 'a zone in this set' or 'a GPU count greater than 0'. Pod affinity and anti-affinity instead match labels on other Pods already running in a topology domain, letting you co-locate related Pods or, far more commonly, spread replicas apart with anti-affinity. Both families offer a required form (a hard filter) and a preferred form (a soft score with a weight from 1-100). The clumsy suffix requiredDuringSchedulingIgnoredDuringExecution means the rule is enforced at scheduling time but ignored afterward: relabel a node and an already-running Pod is not evicted.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "Node affinity plus a toleration on one Pod",
      caption:
        "Affinity chooses which node; the toleration is a separate permission slip for a taint.",
      lines: [
        {
          code: "apiVersion: v1",
        },
        {
          code: "kind: Pod",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: web",
        },
        {
          code: "  labels:",
        },
        {
          code: "    app: web",
        },
        {
          code: "spec:",
        },
        {
          code: "  affinity:",
        },
        {
          code: "    nodeAffinity:",
          note: "match on NODE labels (pod affinity would match other Pods' labels)",
        },
        {
          code: "      requiredDuringSchedulingIgnoredDuringExecution:",
          note: "HARD: a filter — no matching node means the Pod stays Pending",
        },
        {
          code: "        nodeSelectorTerms:",
          note: "the list of terms is OR'd together",
        },
        {
          code: "          - matchExpressions:",
          note: "expressions within one term are AND'd together",
        },
        {
          code: "              - key: disktype",
        },
        {
          code: "                operator: In",
          note: "In/NotIn/Exists/DoesNotExist/Gt/Lt — richer than nodeSelector's exact match",
        },
        {
          code: "                values:",
        },
        {
          code: "                  - ssd",
        },
        {
          code: "      preferredDuringSchedulingIgnoredDuringExecution:",
          note: "SOFT: adds score, never blocks scheduling",
        },
        {
          code: "        - weight: 50",
          note: "1-100; higher weight tilts scoring harder toward matching nodes",
        },
        {
          code: "          preference:",
        },
        {
          code: "            matchExpressions:",
        },
        {
          code: "              - key: topology.kubernetes.io/zone",
        },
        {
          code: "                operator: In",
        },
        {
          code: "                values:",
        },
        {
          code: "                  - us-east-1a",
        },
        {
          code: "  tolerations:",
          note: "lets this Pod schedule onto nodes carrying a matching taint",
        },
        {
          code: "    - key: dedicated",
        },
        {
          code: "      operator: Equal",
          note: "Equal needs key+value+effect to match; Exists ignores value",
        },
        {
          code: "      value: web",
        },
        {
          code: "      effect: NoSchedule",
          note: "must equal the taint's effect (or omit effect to tolerate all effects for that key)",
        },
        {
          code: "  containers:",
        },
        {
          code: "    - name: web",
        },
        {
          code: "      image: klab/web-app:1.0.0",
        },
      ],
    },
    {
      type: "callout",
      tone: "key",
      title: "Required is a wall; preferred is a nudge",
      text: "requiredDuringScheduling... is evaluated during filtering — if no node satisfies it, the Pod never schedules and sits Pending indefinitely; the scheduler will not relax it. preferredDuringScheduling... is evaluated during scoring — unmatched nodes simply get fewer points, so the Pod still lands somewhere. Use required for genuine hard constraints (GPU present, correct architecture) and preferred for 'nice to have' placement, so a full or missing preferred zone degrades gracefully instead of wedging the Pod.",
    },
    {
      type: "concept",
      term: "topologyKey (pod (anti-)affinity)",
      definition:
        "Pod affinity and anti-affinity are always relative to a topology domain named by topologyKey — a node label such as kubernetes.io/hostname (per-node) or topology.kubernetes.io/zone (per-zone). 'Anti-affinity with topologyKey: kubernetes.io/hostname against app=web' means: do not place two web Pods on the same node. Get the topologyKey wrong and you spread across the wrong dimension (e.g. per-node when you meant per-zone).",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "Grow a placement policy in three stages",
      stages: [
        {
          label: "Start with a hard requirement",
          note: "The workload must run on SSD nodes, full stop. A required node affinity makes that a filter — no SSD node, no scheduling.",
          code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  affinity:\n    nodeAffinity:\n      requiredDuringSchedulingIgnoredDuringExecution:\n        nodeSelectorTerms:\n          - matchExpressions:\n              - key: disktype\n                operator: In\n                values:\n                  - ssd\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0",
        },
        {
          label: "Add a soft preference",
          note: "Among the SSD nodes, we would rather use zone us-east-1a — but we are fine elsewhere if it is full. That is a preferred rule with a weight, so it only shifts the score.",
          code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  affinity:\n    nodeAffinity:\n      requiredDuringSchedulingIgnoredDuringExecution:\n        nodeSelectorTerms:\n          - matchExpressions:\n              - key: disktype\n                operator: In\n                values:\n                  - ssd\n      preferredDuringSchedulingIgnoredDuringExecution:\n        - weight: 50\n          preference:\n            matchExpressions:\n              - key: topology.kubernetes.io/zone\n                operator: In\n                values:\n                  - us-east-1a\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0",
        },
        {
          label: "Tolerate the reserved-node taint",
          note: "The SSD nodes are tainted dedicated=web:NoSchedule so only this app uses them. Affinity alone still cannot land there — add a matching toleration to get past the taint.",
          code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  affinity:\n    nodeAffinity:\n      requiredDuringSchedulingIgnoredDuringExecution:\n        nodeSelectorTerms:\n          - matchExpressions:\n              - key: disktype\n                operator: In\n                values:\n                  - ssd\n      preferredDuringSchedulingIgnoredDuringExecution:\n        - weight: 50\n          preference:\n            matchExpressions:\n              - key: topology.kubernetes.io/zone\n                operator: In\n                values:\n                  - us-east-1a\n  tolerations:\n    - key: dedicated\n      operator: Equal\n      value: web\n      effect: NoSchedule\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0",
        },
      ],
    },
    {
      type: "heading",
      id: "taints-tolerations",
      text: "Taints and tolerations: nodes push back",
    },
    {
      type: "paragraph",
      text: "Affinity and nodeSelector are the Pod reaching toward nodes. Taints are the opposite: a property on a node that repels Pods unless they carry a matching toleration. You taint a node with kubectl taint nodes node1 dedicated=web:NoSchedule. The effect is the important part. NoSchedule blocks new Pods without a matching toleration but leaves already-running Pods alone. PreferNoSchedule is the soft version — the scheduler avoids the node during scoring but will use it if it must. NoExecute is the strong one: it blocks new Pods AND evicts already-running Pods that do not tolerate it, honoring an optional tolerationSeconds grace period before eviction. Control-plane nodes and not-ready/unreachable nodes carry these taints by default.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "A toleration permits, it does not attract",
      text: "Tolerating a taint only removes the barrier — it does not make the scheduler prefer that node. A Pod that merely tolerates dedicated=web can still be placed anywhere else in the cluster. To truly reserve a node for one workload you need BOTH: a taint to keep everyone else off, and nodeSelector or node affinity on the intended Pods to pull them onto it. And beware NoExecute: adding that taint (or using kubectl taint with :NoExecute) will evict running Pods that lack the toleration.",
    },
    {
      type: "heading",
      id: "topology-spread",
      text: "topologySpreadConstraints: even distribution",
    },
    {
      type: "paragraph",
      text: "Anti-affinity can say 'not two on the same node', but it is coarse. topologySpreadConstraints express balance directly: keep the number of matching Pods within maxSkew across a set of topology domains. maxSkew: 1 over topology.kubernetes.io/zone means the busiest and least-busy zone may differ by at most one Pod. whenUnsatisfiable decides how hard the rule is: DoNotSchedule makes it a filter (a Pod that would violate the skew stays Pending), while ScheduleAnyway makes it a scoring preference. labelSelector defines which Pods count toward the skew — usually your own workload's labels.",
    },
    {
      type: "code",
      language: "yaml",
      code: "spec:\n  topologySpreadConstraints:\n    - maxSkew: 1\n      topologyKey: topology.kubernetes.io/zone\n      whenUnsatisfiable: DoNotSchedule\n      labelSelector:\n        matchLabels:\n          app: web\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0",
    },
    {
      type: "heading",
      id: "choosing",
      text: "Which knob for which job",
    },
    {
      type: "decisionTable",
      title: "nodeSelector vs affinity vs taints & tolerations",
      columns: ["What it does", "Hard or soft", "Lives on / targets", "Reach for it when"],
      rows: [
        {
          label: "nodeSelector",
          cells: [
            "Pod schedules only on nodes whose labels exactly match every key/value you list",
            "Hard only — no soft variant",
            "Pod spec, targets node labels",
            "The rule is a simple, exact label match and you never need a fallback",
          ],
        },
        {
          label: "Affinity / anti-affinity",
          cells: [
            "Attract or repel using operators against node labels (node affinity) or other Pods' labels in a topology domain (pod affinity)",
            "Both — required (hard filter) or preferred (soft, weighted 1-100)",
            "Pod spec, targets node labels or co-located Pods",
            "You need OR logic, ranges, co-location, spreading, or a graceful soft preference",
          ],
        },
        {
          label: "Taints & tolerations",
          cells: [
            "Node repels Pods that lack a matching toleration; the Pod is permitted, not pulled, onto the node",
            "NoSchedule/NoExecute are hard; PreferNoSchedule is soft",
            "Taint on the node, toleration in the Pod spec",
            "You want to fence off or reserve nodes (dedicated hardware, control plane, special pools)",
          ],
        },
      ],
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "A Pod stuck Pending",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "This Pod stays Pending. kubectl describe pod web shows: 'FailedScheduling: 0/3 nodes are available: 3 node(s) didn't match Pod's node affinity/selector.' Every node in the cluster is labeled disktype=hdd. What is wrong, and how do you fix it?",
      code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  affinity:\n    nodeAffinity:\n      requiredDuringSchedulingIgnoredDuringExecution:\n        nodeSelectorTerms:\n          - matchExpressions:\n              - key: disktype\n                operator: In\n                values:\n                  - ssd\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0",
      answer:
        "The rule is requiredDuringScheduling..., which the scheduler evaluates during the filtering phase. It demands a node labeled disktype=ssd, but all three nodes are disktype=hdd, so every node is filtered out as infeasible and the Pod never reaches scoring — it sits Pending forever, and nothing self-heals it. Fixes, in order of least surprise: label a node to match (kubectl label node <name> disktype=ssd); or relax the rule to preferredDuringScheduling... so an hdd node is merely down-ranked instead of rejected; or correct the values to a label your nodes actually have. The same Pending pattern appears with taints — if the only ssd node were tainted and this Pod had no matching toleration, describe would instead read 'node(s) had untolerated taint {…}'. Always read the FailedScheduling message: it names the exact filter that rejected each node.",
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write one yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Author a Pod named batch that must run only on nodes labeled workload=batch (use required node affinity, not nodeSelector) and can also schedule onto a node tainted dedicated=batch:NoSchedule. Run image klab/web-app:1.0.0.",
      hint: "Two separate mechanisms: the required node affinity picks the node, and the toleration gets you past the taint. Reserving a node usually needs both, because a toleration alone never attracts a Pod.",
      solution:
        "apiVersion: v1\nkind: Pod\nmetadata:\n  name: batch\nspec:\n  affinity:\n    nodeAffinity:\n      requiredDuringSchedulingIgnoredDuringExecution:\n        nodeSelectorTerms:\n          - matchExpressions:\n              - key: workload\n                operator: In\n                values:\n                  - batch\n  tolerations:\n    - key: dedicated\n      operator: Equal\n      value: batch\n      effect: NoSchedule\n  containers:\n    - name: batch\n      image: klab/web-app:1.0.0",
    },
    {
      type: "compare",
      caption:
        "The same zone rule, expressed as required vs preferred node affinity — very different failure behavior.",
      left: {
        title: "required (hard)",
        code: "requiredDuringScheduling\n  IgnoredDuringExecution:\n    nodeSelectorTerms:\n      - matchExpressions:\n          - key: zone\n            operator: In\n            values: [us-east-1a]\n# No node in us-east-1a?\n# Pod stays Pending. Forever.",
      },
      right: {
        title: "preferred (soft)",
        code: "preferredDuringScheduling\n  IgnoredDuringExecution:\n    - weight: 50\n      preference:\n        matchExpressions:\n          - key: zone\n            operator: In\n            values: [us-east-1a]\n# No node in us-east-1a?\n# Scheduled on the next-best node.",
      },
    },
    {
      type: "takeaways",
      items: [
        "The scheduler runs one decision per unbound Pod: filter nodes to the feasible set, score the survivors, bind the best — hard rules filter, soft rules score.",
        "nodeSelector is exact-match and hard-only; node affinity adds operators and both required (hard) and preferred (soft, weighted) forms.",
        "Pod affinity/anti-affinity work relative to a topologyKey; topologySpreadConstraints (maxSkew + whenUnsatisfiable) express even distribution directly.",
        "Taints repel Pods; a toleration only permits, it never attracts — reserving a node needs a taint AND affinity/nodeSelector on the intended Pods.",
        "NoSchedule blocks new Pods, PreferNoSchedule is a soft avoid, and NoExecute also evicts running Pods that lack the toleration.",
        "A Pod stuck Pending is almost always a hard rule with no feasible node — read the FailedScheduling event to see which filter rejected each node.",
      ],
    },
    {
      type: "quiz",
      id: "scheduling-q1",
      question: "What does a taint on a node do?",
      options: [
        {
          id: "a",
          text: "It repels Pods that do not carry a matching toleration.",
          correct: true,
          explanation:
            "Taints are applied to nodes and push Pods away; only Pods with a matching toleration may schedule there (and with NoExecute, running Pods without a toleration are evicted).",
        },
        {
          id: "b",
          text: "It attracts Pods that carry a matching toleration onto that node.",
          correct: false,
          explanation:
            "A toleration only permits scheduling past the taint; it does not attract. To pull Pods onto a node you also need nodeSelector or node affinity.",
        },
        {
          id: "c",
          text: "It creates a Service endpoint for the Pods on that node.",
          correct: false,
          explanation:
            "Endpoint membership comes from Services selecting Ready Pods and has nothing to do with taints.",
        },
        {
          id: "d",
          text: "It reserves CPU and memory on the node for system daemons.",
          correct: false,
          explanation:
            "Resource reservation is done with kube-reserved/system-reserved and requests, not taints.",
        },
      ],
    },
    {
      type: "quiz",
      id: "scheduling-q2",
      question:
        "A Pod is Pending. kubectl describe shows: 'FailedScheduling: 0/4 nodes are available: 4 node(s) didn't match Pod's node affinity/selector.' What is the most likely cause?",
      options: [
        {
          id: "a",
          text: "A required node affinity (or nodeSelector) demands a label that no node in the cluster has.",
          correct: true,
          explanation:
            "That message is the affinity/selector filter rejecting every node. A hard requirement with no matching node leaves the Pod Pending until you add the label, relax it to preferred, or fix the values.",
        },
        {
          id: "b",
          text: "The nodes are out of CPU or memory for the Pod's requests.",
          correct: false,
          explanation:
            "Insufficient capacity produces a different message such as 'Insufficient cpu' / 'Insufficient memory', not 'didn't match node affinity/selector'.",
        },
        {
          id: "c",
          text: "Every node has a taint the Pod does not tolerate.",
          correct: false,
          explanation:
            "An untolerated taint reports 'node(s) had untolerated taint {…}', a distinct reason from an affinity/selector mismatch.",
        },
        {
          id: "d",
          text: "The Pod's readiness probe is failing.",
          correct: false,
          explanation:
            "Readiness affects endpoint membership after the Pod runs; it plays no part in scheduling, and a Pending Pod has not been placed or started yet.",
        },
      ],
    },
  ],
  labs: [],
};

const autoscaling: DocsLesson = {
  slug: ["operations", "autoscaling"],
  title: "Autoscaling",
  description:
    "Autoscaling changes replica counts based on observed demand, but it depends on good metrics and resource requests.",
  section: "Operations",
  order: 9,
  concepts: ["autoscaling", "deployments", "resources", "pods"],
  content: [
    {
      type: "heading",
      id: "why-autoscale",
      text: "Why autoscaling exists",
    },
    {
      type: "paragraph",
      text: "Demand is not constant, and hand-editing replica counts does not survive a traffic spike at 2am. Kubernetes ships three autoscalers, each acting on a different axis: the HorizontalPodAutoscaler changes how MANY Pods run, the VerticalPodAutoscaler changes how BIG each Pod is (its requests/limits), and the Cluster Autoscaler changes how many NODES exist to hold those Pods. They are separate controllers with separate scopes; confusing them is the most common autoscaling mistake.",
    },
    {
      type: "diagram",
      variant: "control-loop",
      title: "HPA is a control loop",
      caption:
        "Observe a metric, compare to a target, write a new replica count, let the Deployment controller reconcile — then repeat.",
    },
    {
      type: "heading",
      id: "hpa-model",
      text: "The HPA mental model",
    },
    {
      type: "paragraph",
      text: "An HPA does not make an individual Pod faster and it does not create Pods itself. On each sync (about every 15 seconds) it reads a metric, computes a desired replica count, and writes that number to the target's scale subresource. The Deployment controller then adds or removes ReplicaSet Pods to match. The core formula is desiredReplicas = ceil(currentReplicas * currentMetricValue / targetMetricValue), clamped to minReplicas..maxReplicas.",
    },
    {
      type: "concept",
      term: "Utilization is relative, not absolute",
      definition:
        "When you target CPU 'Utilization', the number is a percentage of each Pod's CPU REQUEST — not of the node, not of a core. averageUtilization: 60 means 'keep average CPU near 60% of the requested amount'. This is why a resource request is mandatory: with no request there is no denominator, so utilization is undefined.",
    },
    {
      type: "heading",
      id: "hpa-anatomy",
      text: "Anatomy of an HPA",
    },
    {
      type: "paragraph",
      text: "Read every HPA through four lenses: what it scales (scaleTargetRef), the floor and ceiling (minReplicas/maxReplicas), the signal (metrics), and how eagerly it reacts (behavior). The autoscaling/v2 API is the current one — v1 only supported a single CPU target.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A complete HorizontalPodAutoscaler",
      caption: "An HPA targeting a Deployment on average CPU utilization.",
      lines: [
        {
          code: "apiVersion: autoscaling/v2",
          note: "use v2 — it supports memory, multiple metrics, and scaling behavior",
        },
        {
          code: "kind: HorizontalPodAutoscaler",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: web-hpa",
        },
        {
          code: "  namespace: default",
        },
        {
          code: "spec:",
        },
        {
          code: "  scaleTargetRef:",
          note: "WHAT to scale — must point at an object with a scale subresource (Deployment, ReplicaSet, StatefulSet)",
        },
        {
          code: "    apiVersion: apps/v1",
        },
        {
          code: "    kind: Deployment",
        },
        {
          code: "    name: web",
          note: "the Deployment name — NOT a label selector; the HPA drives its replica count directly",
        },
        {
          code: "  minReplicas: 2",
          note: "the floor — the HPA will never scale below this, even at zero load",
        },
        {
          code: "  maxReplicas: 10",
          note: "the ceiling — a hard cap that protects the cluster from a runaway scale-up",
        },
        {
          code: "  metrics:",
          note: "the signal(s) — if multiple are listed the HPA takes the LARGEST resulting replica count",
        },
        {
          code: "    - type: Resource",
        },
        {
          code: "      resource:",
        },
        {
          code: "        name: cpu",
          note: "the built-in per-Pod CPU metric, read from metrics-server",
        },
        {
          code: "        target:",
        },
        {
          code: "          type: Utilization",
          note: "compare against a PERCENTAGE of the Pod's CPU request (use AverageValue for an absolute figure)",
        },
        {
          code: "          averageUtilization: 60",
          note: "keep average CPU near 60% of requested CPU across all Pods",
        },
      ],
    },
    {
      type: "heading",
      id: "build-hpa",
      text: "Build one from scratch",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "An HPA grows in three stages",
      stages: [
        {
          label: "Bind to a target",
          note: "Point at the Deployment and set a floor and ceiling. This is already valid, but with no metrics it just holds replicas between 2 and 10 — it will not react to load yet.",
          code: "apiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: web-hpa\nspec:\n  scaleTargetRef:\n    apiVersion: apps/v1\n    kind: Deployment\n    name: web\n  minReplicas: 2\n  maxReplicas: 10",
        },
        {
          label: "Add a metric",
          note: "Now it reacts. The HPA reads average CPU utilization and scales replicas to keep it near 60% of each Pod's CPU request. This requires the target's containers to declare resources.requests.cpu.",
          code: "apiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: web-hpa\nspec:\n  scaleTargetRef:\n    apiVersion: apps/v1\n    kind: Deployment\n    name: web\n  minReplicas: 2\n  maxReplicas: 10\n  metrics:\n    - type: Resource\n      resource:\n        name: cpu\n        target:\n          type: Utilization\n          averageUtilization: 60",
        },
        {
          label: "Tune the behavior",
          note: "Add a stabilization window so a brief dip does not immediately shrink the fleet. Scale-down waits 5 minutes of sustained low load before acting, which prevents thrashing; scale-up stays fast by default.",
          code: "apiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: web-hpa\nspec:\n  scaleTargetRef:\n    apiVersion: apps/v1\n    kind: Deployment\n    name: web\n  minReplicas: 2\n  maxReplicas: 10\n  metrics:\n    - type: Resource\n      resource:\n        name: cpu\n        target:\n          type: Utilization\n          averageUtilization: 60\n  behavior:\n    scaleDown:\n      stabilizationWindowSeconds: 300",
        },
      ],
    },
    {
      type: "callout",
      tone: "key",
      title: "No requests, no utilization",
      text: "CPU/memory Utilization targets are a percentage of the container's resources.requests. If the target Deployment's containers do not set requests.cpu, the HPA has nothing to divide by: kubectl get hpa shows TARGETS as <unknown>/60% and the HPA refuses to scale on that metric. Setting requests is a prerequisite, not an optimization.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Thrashing and the stabilization window",
      text: "Without tuning, a spiky metric can make the HPA add and remove Pods repeatedly. behavior.scaleDown.stabilizationWindowSeconds (default 300s) makes scale-down consider the highest recommendation over the window, so it only shrinks after load is genuinely low. Scale-up stabilization defaults to 0s so you respond to spikes quickly.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a broken autoscaler",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "This HPA targets 60% CPU but never scales. kubectl get hpa shows TARGETS as <unknown>/60% no matter how hard the app is hit. The Deployment is running and healthy. What is wrong?",
      code: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: web\n          image: klab/web-app:1.0.0\n          # no resources.requests set\n---\napiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: web-hpa\nspec:\n  scaleTargetRef:\n    apiVersion: apps/v1\n    kind: Deployment\n    name: web\n  minReplicas: 2\n  maxReplicas: 10\n  metrics:\n    - type: Resource\n      resource:\n        name: cpu\n        target:\n          type: Utilization\n          averageUtilization: 60",
      answer:
        "The container declares no resources.requests.cpu. A Utilization target is a percentage of the requested CPU, so with no request there is no denominator and the HPA cannot compute utilization — TARGETS reports <unknown>/60% and it will not scale on that metric. Fix: add resources.requests.cpu (for example 100m) to the container. Once a request exists, metrics-server-reported usage divided by the request gives a real percentage and the HPA starts scaling.",
    },
    {
      type: "heading",
      id: "vpa-and-ca",
      text: "The other two autoscalers",
    },
    {
      type: "paragraph",
      text: "The VerticalPodAutoscaler recommends and (in Auto mode) applies better CPU/memory requests by evicting and recreating Pods with new values — it right-sizes Pods rather than adding them. The Cluster Autoscaler works one level down: when Pods are stuck Pending because no node has room, it asks the cloud provider to add nodes, and it removes nodes that stay underutilized. HPA reacts in seconds, VPA over minutes, and the Cluster Autoscaler on the timescale of provisioning a VM.",
    },
    {
      type: "decisionTable",
      title: "HPA vs VPA vs Cluster Autoscaler",
      columns: ["Scales what", "Triggers when", "Typical use"],
      rows: [
        {
          label: "HorizontalPodAutoscaler",
          cells: [
            "Number of Pod replicas",
            "A per-Pod metric (CPU/memory/custom) drifts from its target",
            "Stateless web/API tiers that scale out under load",
          ],
        },
        {
          label: "VerticalPodAutoscaler",
          cells: [
            "Each Pod's CPU/memory requests (and limits)",
            "Observed usage no longer matches the configured requests",
            "Workloads that are hard to replicate — right-sizing requests",
          ],
        },
        {
          label: "Cluster Autoscaler",
          cells: [
            "Number of nodes in the cluster",
            "Pods are Pending for lack of room, or nodes sit underutilized",
            "Giving the scheduler capacity so HPA/VPA changes can actually land",
          ],
        },
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Do not point HPA and VPA at the same resource",
      text: "If an HPA scales on CPU and a VPA in Auto mode also adjusts CPU requests, they fight: the HPA changes replica count based on utilization while the VPA moves the request that utilization is measured against. Run VPA on memory while HPA scales on CPU, or drive the HPA from a custom/external metric, or keep VPA in recommendation-only (Off) mode.",
    },
    {
      type: "compare",
      caption:
        "Same overload, two different remedies. HPA spreads load across more Pods; VPA makes each Pod bigger.",
      left: {
        title: "HPA response",
        code: "cpu utilization: 90% (target 60%)\nreplicas: 3 -> 5\nrequests unchanged",
      },
      right: {
        title: "VPA response",
        code: "cpu request: 100m too small\nrequest: 100m -> 300m\nPod recreated, replicas unchanged",
      },
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write one yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Write an autoscaling/v2 HorizontalPodAutoscaler named api-hpa that scales a Deployment named api between 3 and 12 replicas, targeting 70% average CPU utilization.",
      hint: "You need spec.scaleTargetRef (apiVersion apps/v1, kind Deployment, name api), spec.minReplicas, spec.maxReplicas, and a Resource metric for cpu with target type Utilization. Remember the api container must set resources.requests.cpu for this to work.",
      solution:
        "apiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: api-hpa\nspec:\n  scaleTargetRef:\n    apiVersion: apps/v1\n    kind: Deployment\n    name: api\n  minReplicas: 3\n  maxReplicas: 12\n  metrics:\n    - type: Resource\n      resource:\n        name: cpu\n        target:\n          type: Utilization\n          averageUtilization: 70",
    },
    {
      type: "takeaways",
      items: [
        "HPA changes replica count, VPA changes per-Pod requests, Cluster Autoscaler changes node count — three axes, three controllers.",
        "A Utilization target is a percentage of the Pod's CPU/memory request, so the target's containers MUST declare requests or the HPA reports <unknown> and never scales.",
        "desiredReplicas = ceil(currentReplicas * currentMetric / targetMetric), always clamped to minReplicas..maxReplicas.",
        "Use behavior.scaleDown.stabilizationWindowSeconds to stop thrashing; scale-up stays fast by default.",
        "Never point an HPA and an Auto-mode VPA at the same metric/resource — they will fight over the same signal.",
      ],
    },
    {
      type: "quiz",
      id: "autoscaling-q1",
      question: "What does an HPA actually change on a Deployment?",
      options: [
        {
          id: "a",
          text: "The desired replica count, via the scale subresource.",
          correct: true,
          explanation:
            "The HPA writes a new replica number and the Deployment controller reconciles the Pods.",
        },
        {
          id: "b",
          text: "The container image registry.",
          correct: false,
          explanation: "HPA is not an image or rollout mechanism.",
        },
        {
          id: "c",
          text: "The CPU/memory requests of each Pod.",
          correct: false,
          explanation: "That is the VerticalPodAutoscaler's job, not the HPA's.",
        },
        {
          id: "d",
          text: "The number of nodes in the cluster.",
          correct: false,
          explanation: "Adding nodes is the Cluster Autoscaler's responsibility.",
        },
      ],
    },
    {
      type: "quiz",
      id: "autoscaling-q2",
      question:
        "An HPA with a CPU Utilization target shows TARGETS as <unknown>/60% and never scales. What is the most likely cause?",
      options: [
        {
          id: "a",
          text: "The target Deployment's containers do not set resources.requests.cpu.",
          correct: true,
          explanation:
            "Utilization is a percentage of the request; with no request there is no denominator, so utilization is undefined.",
        },
        {
          id: "b",
          text: "minReplicas is set higher than maxReplicas.",
          correct: false,
          explanation:
            "That is a validation error, and it would not produce an <unknown> metric reading.",
        },
        {
          id: "c",
          text: "The Deployment has too many replicas already.",
          correct: false,
          explanation:
            "Replica count does not make a metric unreadable; <unknown> means the metric cannot be computed.",
        },
        {
          id: "d",
          text: "The Service in front of the Deployment has no endpoints.",
          correct: false,
          explanation:
            "Service endpoints are unrelated to how the HPA reads per-Pod CPU from metrics-server.",
        },
      ],
    },
  ],
  labs: [],
};

const disruptionsAvailability: DocsLesson = {
  slug: ["operations", "disruptions-pdbs"],
  title: "Disruptions & Pod Disruption Budgets",
  description: "Keep voluntary maintenance from taking down too many replicas at once.",
  section: "Operations",
  order: 10,
  concepts: ["disruptions", "rollouts", "deployments", "pods"],
  content: [
    {
      type: "heading",
      id: "voluntary-vs-involuntary",
      text: "Voluntary vs involuntary disruption",
    },
    {
      type: "paragraph",
      text: "Every running Pod eventually goes away, but the cause matters. Involuntary disruptions are things nobody scheduled: a node kernel panic, hardware loss, the network partitioning, or the kubelet evicting under memory pressure. Voluntary disruptions are actions an operator or controller deliberately takes: draining a node for a kernel upgrade, scaling the cluster down, or deleting a Pod during a rollout. A PodDisruptionBudget (PDB) is the one lever you have to say how much voluntary disruption an application can absorb at once — and it does nothing about the involuntary kind.",
    },
    {
      type: "diagram",
      variant: "api-object",
      title: "The PDB as an eviction gate",
      caption:
        "The eviction API consults the PDB before letting a voluntary eviction proceed. Involuntary loss never asks.",
    },
    {
      type: "heading",
      id: "eviction-api",
      text: "How kubectl drain asks permission",
    },
    {
      type: "paragraph",
      text: "kubectl drain does two things: it cordons the node (marks it unschedulable) and then evicts every Pod on it. Crucially, drain does not DELETE Pods directly — it POSTs to the eviction subresource (the Eviction API). For each request, the API server checks whether removing that Pod would violate any PDB matching it. If it would, the API returns 429 Too Many Requests and drain backs off and retries. So a PDB never blocks the failure itself; it throttles the rate at which cooperative tooling is allowed to take Pods down.",
    },
    {
      type: "concept",
      term: "Eviction API",
      definition:
        "A special subresource (pods/eviction) that gracefully removes a Pod only if doing so respects every matching PodDisruptionBudget. Drain, cluster-autoscaler scale-down, and other well-behaved tools use it. A plain kubectl delete pod bypasses it entirely and ignores PDBs.",
    },
    {
      type: "decisionTable",
      title: "Does the PDB protect this disruption?",
      columns: ["Type", "Cause", "PDB protects?"],
      rows: [
        {
          label: "Node drain for an upgrade",
          cells: ["Voluntary", "kubectl drain routes through the eviction API", "Yes"],
        },
        {
          label: "Cluster-autoscaler scale-down",
          cells: ["Voluntary", "Autoscaler evicts Pods via the eviction API", "Yes"],
        },
        {
          label: "kubectl delete pod",
          cells: [
            "Operator action",
            "Direct DELETE, not the eviction subresource",
            "No — bypasses the PDB",
          ],
        },
        {
          label: "Node kernel panic / hardware loss",
          cells: ["Involuntary", "Node stops reporting; its Pods are simply gone", "No"],
        },
        {
          label: "Node-pressure eviction (OOM)",
          cells: ["Involuntary", "kubelet evicts Pods under memory pressure", "No"],
        },
      ],
    },
    {
      type: "heading",
      id: "anatomy-pdb",
      text: "Anatomy of a PodDisruptionBudget",
    },
    {
      type: "paragraph",
      text: "A PDB has exactly two moving parts: which Pods it guards (selector) and how many must stay up (a budget expressed as either minAvailable or maxUnavailable — never both). The selector, like a Service selector, matches Pod labels, not Deployments or ReplicaSets by name.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A complete PodDisruptionBudget",
      caption: "Guarantees at least two web Pods survive any voluntary eviction.",
      lines: [
        {
          code: "apiVersion: policy/v1",
          note: "policy/v1 is the GA API (since Kubernetes 1.21); policy/v1beta1 is removed",
        },
        {
          code: "kind: PodDisruptionBudget",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: web-pdb",
        },
        {
          code: "  namespace: default",
          note: "a PDB only guards Pods in its own namespace",
        },
        {
          code: "spec:",
        },
        {
          code: "  minAvailable: 2",
          note: "at least 2 matching Pods must stay available; the eviction API refuses drops below this. Use minAvailable OR maxUnavailable, not both",
        },
        {
          code: "  selector:",
          note: "HOW the PDB finds Pods — must match the workload's Pod labels exactly",
        },
        {
          code: "    matchLabels:",
        },
        {
          code: "      app: web",
          note: "an exact key:value pair from the Pods' metadata.labels",
        },
      ],
    },
    {
      type: "heading",
      id: "build-pdb",
      text: "Build one from scratch",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "A PDB grows in three steps",
      stages: [
        {
          label: "Skeleton",
          note: "A valid object shell: the GA apiVersion, the kind, and a name. It guards nothing yet — no selector and no budget.",
          code: "apiVersion: policy/v1\nkind: PodDisruptionBudget\nmetadata:\n  name: web-pdb",
        },
        {
          label: "Add a selector",
          note: "Now the PDB knows WHICH Pods it protects (label app: web). Still no budget, so it does not yet constrain evictions.",
          code: "apiVersion: policy/v1\nkind: PodDisruptionBudget\nmetadata:\n  name: web-pdb\nspec:\n  selector:\n    matchLabels:\n      app: web",
        },
        {
          label: "Add the budget",
          note: "maxUnavailable: 1 lets a drain take one web Pod at a time and no more. This is the safest default for a scalable Deployment because it stays correct as replica count changes.",
          code: "apiVersion: policy/v1\nkind: PodDisruptionBudget\nmetadata:\n  name: web-pdb\nspec:\n  maxUnavailable: 1\n  selector:\n    matchLabels:\n      app: web",
        },
      ],
    },
    {
      type: "callout",
      tone: "key",
      title: "minAvailable and maxUnavailable are mirror images",
      text: "minAvailable: 2 with 5 replicas means up to 3 can be evicted at once. maxUnavailable: 1 with 5 replicas means only 1 at a time — the other 4 must stay up. Both accept an integer or a percentage (maxUnavailable: 25%). Percentages are rounded, and maxUnavailable rounds so that at least one Pod is always kept available. Prefer maxUnavailable for autoscaled workloads so the budget stays correct when the replica count moves.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Watch status.disruptionsAllowed",
      text: "kubectl get pdb shows ALLOWED DISRUPTIONS — roughly (current healthy Pods) minus minAvailable. When it reads 0, the next eviction returns 429 and a drain will hang indefinitely. Also note only Ready Pods count toward availability, so a workload stuck NotReady can silently freeze all maintenance.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a broken PDB",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "An operator ran kubectl drain node-1 to patch it, but the command has been hanging for 20 minutes and one web Pod refuses to evict. The Deployment runs 2 replicas. What's wrong with this PDB?",
      code: "apiVersion: policy/v1\nkind: PodDisruptionBudget\nmetadata:\n  name: web-pdb\nspec:\n  minAvailable: 2\n  selector:\n    matchLabels:\n      app: web\n---\n# Deployment (for context)\nspec:\n  replicas: 2",
      answer:
        "minAvailable: 2 equals the replica count of 2. disruptionsAllowed is 2 - 2 = 0, so the eviction API returns 429 for every attempt and the drain deadlocks — there is never a spare Pod to give up. The budget is mathematically impossible to satisfy while evicting anything. Fix it by loosening the budget (minAvailable: 1, or better maxUnavailable: 1) so one Pod can move at a time, or by scaling the Deployment above the floor before draining.",
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write one yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "A payments Deployment runs 6 replicas of Pods labeled app: payments. Write a PDB named payments-pdb that lets a node drain proceed one Pod at a time but no faster, and that keeps working correctly if the team later scales replicas up or down.",
      hint: "An absolute maxUnavailable stays correct across replica changes; minAvailable percentages can drift. You want the eviction API to permit exactly one unavailable Pod.",
      solution:
        "apiVersion: policy/v1\nkind: PodDisruptionBudget\nmetadata:\n  name: payments-pdb\nspec:\n  maxUnavailable: 1\n  selector:\n    matchLabels:\n      app: payments",
    },
    {
      type: "compare",
      caption:
        "Same intent, opposite outcomes. The left budget drains safely; the right budget can never be satisfied.",
      left: {
        title: "Drains cleanly",
        code: "spec:\n  maxUnavailable: 1\n  selector:\n    matchLabels:\n      app: web\n# 1 Pod at a time; the rest stay up",
      },
      right: {
        title: "Blocks every drain",
        code: "spec:\n  minAvailable: 100%\n  selector:\n    matchLabels:\n      app: web\n# 0 disruptions allowed, ever",
      },
    },
    {
      type: "takeaways",
      items: [
        "PDBs constrain only voluntary disruptions (drain, autoscaler scale-down, evictions); node crashes and OOM kills ignore them.",
        "kubectl drain evicts through the eviction API, which returns 429 when a removal would breach a PDB, so drain waits instead of forcing.",
        "Set minAvailable OR maxUnavailable, never both; prefer maxUnavailable for autoscaled apps so the budget tracks replica changes.",
        "minAvailable equal to (or 100% of) the replica count sets disruptionsAllowed to 0 and deadlocks every drain.",
        "kubectl delete pod bypasses the eviction API and ignores PDBs — only cooperative tooling honors the budget.",
      ],
    },
    {
      type: "quiz",
      id: "pdb-q1",
      question: "What does a PodDisruptionBudget primarily control?",
      options: [
        {
          id: "a",
          text: "Voluntary Pod evictions during operations like node drain.",
          correct: true,
          explanation:
            "PDBs gate the eviction API, throttling voluntary disruptions against the selected Pods.",
        },
        {
          id: "b",
          text: "All possible node hardware failures.",
          correct: false,
          explanation:
            "Involuntary losses like a kernel panic never consult the PDB — the Pods are simply gone.",
        },
        {
          id: "c",
          text: "Service DNS records.",
          correct: false,
          explanation: "DNS resolution is unrelated to eviction policy.",
        },
      ],
    },
    {
      type: "quiz",
      id: "pdb-q2",
      question:
        "A Deployment has 3 replicas and a PDB with minAvailable: 3. You run kubectl drain on a node hosting one of its Pods. What happens?",
      options: [
        {
          id: "a",
          text: "The drain hangs; the eviction is rejected with 429 because disruptionsAllowed is 0.",
          correct: true,
          explanation:
            "3 healthy minus a floor of 3 leaves zero allowed disruptions, so the eviction API refuses and drain retries forever until you loosen the budget or add capacity.",
        },
        {
          id: "b",
          text: "The Pod is evicted immediately because drain always wins.",
          correct: false,
          explanation: "Drain uses the eviction API and respects PDBs; it does not force deletion.",
        },
        {
          id: "c",
          text: "Kubernetes automatically adds a fourth replica to satisfy the budget.",
          correct: false,
          explanation: "A PDB never creates capacity; it only constrains voluntary removals.",
        },
      ],
    },
  ],
  labs: [],
};

const quotasLimitRanges: DocsLesson = {
  slug: ["operations", "quotas-limitranges"],
  title: "ResourceQuotas & LimitRanges",
  description:
    "Control namespace resource consumption and set defaults so teams cannot accidentally starve the cluster.",
  section: "Operations",
  order: 11,
  concepts: ["resource-quotas", "limit-ranges", "resources", "namespaces"],
  content: [
    {
      type: "heading",
      id: "namespace-guardrails",
      text: "Two guardrails for a shared namespace",
    },
    {
      type: "paragraph",
      text: "When many teams share one cluster, one namespace can accidentally consume everything: too many Pods, too much CPU, runaway memory. Kubernetes gives you two guardrails that work at different scopes. A ResourceQuota caps the total the whole namespace may consume. A LimitRange constrains each individual object and fills in sensible defaults when authors forget them. They are most powerful together.",
    },
    {
      type: "diagram",
      variant: "namespace-boundary",
      title: "Two guardrails around a namespace",
      caption: "ResourceQuota bounds the namespace total; LimitRange bounds each object inside it.",
    },
    {
      type: "heading",
      id: "aggregate-vs-per-object",
      text: "Aggregate vs per-object",
    },
    {
      type: "paragraph",
      text: "The single most important distinction: a ResourceQuota sums usage across every object in the namespace and rejects the request that would push the total past its hard limits. A LimitRange never looks at the total — it inspects one container or Pod at a time and applies defaults or min/max bounds to that object alone.",
    },
    {
      type: "compare",
      caption: "Read a quota as a namespace-wide ceiling; read a LimitRange as a per-object rule.",
      left: {
        title: "ResourceQuota (namespace aggregate)",
        code: 'spec:\n  hard:\n    requests.cpu: "4"      # sum across ALL pods\n    requests.memory: 8Gi   # sum across ALL pods\n    pods: "20"             # total object count',
      },
      right: {
        title: "LimitRange (per object)",
        code: "spec:\n  limits:\n    - type: Container\n      defaultRequest:        # applied to EACH container\n        cpu: 100m\n      max:                   # ceiling for EACH container\n        memory: 1Gi",
      },
    },
    {
      type: "concept",
      term: "Aggregate vs per-object enforcement",
      definition:
        "ResourceQuota tracks the running total for the namespace and rejects creation when the total would exceed hard. LimitRange evaluates a single object and either mutates it (defaults) or rejects it (min/max) — it has no notion of the namespace total.",
    },
    {
      type: "heading",
      id: "read-a-quota",
      text: "Read a ResourceQuota",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A ResourceQuota with compute, storage, and object counts",
      caption: "hard is a map of resource name to the maximum the namespace total may reach.",
      lines: [
        {
          code: "apiVersion: v1",
        },
        {
          code: "kind: ResourceQuota",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: team-quota",
        },
        {
          code: "  namespace: team-a",
          note: "a quota only governs the namespace it lives in",
        },
        {
          code: "spec:",
        },
        {
          code: "  hard:",
          note: "each entry is a ceiling on the SUM across the whole namespace",
        },
        {
          code: '    requests.cpu: "4"',
          note: "combined CPU requests of all pods may not exceed 4 cores",
        },
        {
          code: "    requests.memory: 8Gi",
          note: "combined memory requests may not exceed 8Gi",
        },
        {
          code: '    limits.cpu: "8"',
          note: "combined CPU limits may not exceed 8 cores",
        },
        {
          code: "    limits.memory: 16Gi",
          note: "combined memory limits may not exceed 16Gi",
        },
        {
          code: '    pods: "20"',
          note: "object-count quota: at most 20 non-terminal pods at once",
        },
        {
          code: '    persistentvolumeclaims: "5"',
          note: "object-count quota also caps PVCs, services, configmaps, etc.",
        },
      ],
    },
    {
      type: "callout",
      tone: "key",
      title: "A compute quota makes requests/limits mandatory",
      text: "This is the rule people trip over. The moment a namespace has a ResourceQuota that tracks a compute resource (requests.cpu, requests.memory, limits.cpu, or limits.memory), the quota admission controller must be able to count every new Pod — so it REQUIRES each container to declare the matching request/limit. A Pod that omits them is rejected with a Forbidden error, even if the namespace is nearly empty.",
    },
    {
      type: "heading",
      id: "build-a-quota",
      text: "Build a quota in stages",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "A ResourceQuota grows in three steps",
      stages: [
        {
          label: "Skeleton",
          note: "A valid but empty quota: it names a namespace but enforces nothing yet because hard has no entries.",
          code: "apiVersion: v1\nkind: ResourceQuota\nmetadata:\n  name: team-quota\n  namespace: team-a\nspec:\n  hard: {}",
        },
        {
          label: "Add a compute ceiling",
          note: "Now the namespace total for CPU/memory requests is bounded. Side effect: because a compute resource is tracked, every new Pod must now specify requests.cpu and requests.memory or it is rejected.",
          code: 'apiVersion: v1\nkind: ResourceQuota\nmetadata:\n  name: team-quota\n  namespace: team-a\nspec:\n  hard:\n    requests.cpu: "4"\n    requests.memory: 8Gi',
        },
        {
          label: "Add object counts",
          note: "Cap how many objects can exist regardless of their size. This stops a runaway controller from creating thousands of Pods or PVCs.",
          code: 'apiVersion: v1\nkind: ResourceQuota\nmetadata:\n  name: team-quota\n  namespace: team-a\nspec:\n  hard:\n    requests.cpu: "4"\n    requests.memory: 8Gi\n    pods: "20"\n    persistentvolumeclaims: "5"',
        },
      ],
    },
    {
      type: "heading",
      id: "read-a-limitrange",
      text: "Read a LimitRange",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A LimitRange with defaults and bounds",
      caption: "Each entry under limits applies to a type of object — here, every Container.",
      lines: [
        {
          code: "apiVersion: v1",
        },
        {
          code: "kind: LimitRange",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: team-defaults",
        },
        {
          code: "  namespace: team-a",
          note: "like quotas, a LimitRange is namespaced",
        },
        {
          code: "spec:",
        },
        {
          code: "  limits:",
        },
        {
          code: "    - type: Container",
          note: "these rules apply to each container (Pod and PersistentVolumeClaim are other valid types)",
        },
        {
          code: "      default:",
          note: "LIMITS injected when a container omits resources.limits",
        },
        {
          code: "        cpu: 500m",
        },
        {
          code: "        memory: 512Mi",
        },
        {
          code: "      defaultRequest:",
          note: "REQUESTS injected when a container omits resources.requests",
        },
        {
          code: "        cpu: 100m",
        },
        {
          code: "        memory: 128Mi",
        },
        {
          code: "      max:",
          note: "a container declaring more than this is rejected",
        },
        {
          code: '        cpu: "2"',
        },
        {
          code: "        memory: 2Gi",
        },
        {
          code: "      min:",
          note: "a container requesting less than this is rejected",
        },
        {
          code: "        cpu: 50m",
        },
        {
          code: "        memory: 64Mi",
        },
      ],
    },
    {
      type: "concept",
      term: "Admission order: LimitRange before ResourceQuota",
      definition:
        "During admission the LimitRange runs first and MUTATES the Pod, injecting its default/defaultRequest into containers that omitted them. Only afterward does the ResourceQuota VALIDATE the (now-filled-in) Pod against the namespace total. That ordering is exactly why a LimitRange lets you satisfy a compute quota without every author writing requests by hand.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Quotas are not retroactive",
      text: "Creating or tightening a ResourceQuota only affects future create/update requests. Pods that already exceed the new limits keep running — Kubernetes will not evict them. To reclaim over-quota usage you must delete or rescale the offending workloads yourself. Check current usage with kubectl describe resourcequota team-quota -n team-a.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a rejected Pod",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      title: "Why won't this Pod create?",
      prompt:
        "Namespace team-a has a ResourceQuota that tracks requests.cpu and limits.memory. This Pod is rejected at creation with a Forbidden error mentioning the quota. The image and namespace are correct. What is wrong, and how do you fix it without deleting the quota?",
      code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: worker\n  namespace: team-a\nspec:\n  containers:\n    - name: app\n      image: klab/web-app:1.0.0\n      # no resources block at all",
      answer:
        'The container declares no resources.requests or resources.limits. Because the namespace has a compute ResourceQuota, the quota admission controller must count this Pod\'s CPU/memory usage and cannot — so it rejects it: pods "worker" is forbidden: failed quota: team-quota: must specify limits.memory,requests.cpu. Two fixes: (1) add an explicit resources block with requests and limits to the container, or (2) create a LimitRange with defaultRequest and default in team-a. The LimitRange mutates the Pod at admission, filling in the missing values before the quota is checked, so it succeeds automatically.',
    },
    {
      type: "heading",
      id: "choose",
      text: "When to use which",
    },
    {
      type: "decisionTable",
      title: "ResourceQuota vs LimitRange",
      columns: ["Scope", "Enforces", "Rejects a request when"],
      rows: [
        {
          label: "ResourceQuota",
          cells: [
            "Whole namespace (aggregate total)",
            "Total requests/limits and object counts",
            "The namespace total would exceed hard, or a Pod omits a tracked compute request/limit",
          ],
        },
        {
          label: "LimitRange",
          cells: [
            "Each object (per container or per Pod)",
            "Per-object defaults plus min/max bounds",
            "A single container exceeds max or falls below min (and it silently fills defaults otherwise)",
          ],
        },
      ],
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write a quota yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      title: "Author a CI namespace quota",
      prompt:
        "Write a ResourceQuota named ci-quota in namespace ci that caps total CPU requests at 2 cores, total memory requests at 4Gi, and allows at most 10 Pods at once.",
      hint: "You need metadata.name, metadata.namespace, and a spec.hard map with requests.cpu, requests.memory, and pods. Quote the plain numeric values.",
      solution:
        'apiVersion: v1\nkind: ResourceQuota\nmetadata:\n  name: ci-quota\n  namespace: ci\nspec:\n  hard:\n    requests.cpu: "2"\n    requests.memory: 4Gi\n    pods: "10"',
    },
    {
      type: "takeaways",
      items: [
        "ResourceQuota bounds the namespace aggregate (total requests/limits and object counts); LimitRange bounds and defaults each object.",
        "A compute ResourceQuota makes requests/limits mandatory: any Pod that omits a tracked resource is rejected with a Forbidden error.",
        "A LimitRange with default/defaultRequest satisfies that requirement automatically, because it mutates Pods at admission before the quota validates them.",
        "Quotas apply only to new create/update requests — they never evict Pods that already exceed the limits.",
        "Inspect live usage with kubectl describe resourcequota; read the Forbidden error text to see exactly which resource was missing or exhausted.",
      ],
    },
    {
      type: "quiz",
      id: "quota-q1",
      question: "Which object caps the total resource usage across an entire namespace?",
      options: [
        {
          id: "a",
          text: "ResourceQuota",
          correct: true,
          explanation:
            "ResourceQuota sums usage across all objects in the namespace and rejects the request that would exceed its hard limits.",
        },
        {
          id: "b",
          text: "LimitRange",
          correct: false,
          explanation:
            "A LimitRange constrains and defaults each object individually; it has no view of the namespace total.",
        },
        {
          id: "c",
          text: "HorizontalPodAutoscaler",
          correct: false,
          explanation:
            "An HPA changes replica counts based on metrics; it does not enforce namespace ceilings.",
        },
      ],
    },
    {
      type: "quiz",
      id: "quota-q2",
      question:
        "A namespace has a ResourceQuota on requests.cpu, and Pods that omit CPU requests are being rejected. What is the cleanest cluster-side fix that keeps the guardrail?",
      options: [
        {
          id: "a",
          text: "Add a LimitRange with defaultRequest so omitted requests are filled in at admission.",
          correct: true,
          explanation:
            "The LimitRange mutates each Pod before the quota validates it, so authors no longer need to hand-write requests and the quota stays in force.",
        },
        {
          id: "b",
          text: "Delete the ResourceQuota so Pods stop being rejected.",
          correct: false,
          explanation:
            "That removes the guardrail entirely — the namespace could then consume unbounded resources.",
        },
        {
          id: "c",
          text: "Grant the Pod's ServiceAccount cluster-admin RBAC.",
          correct: false,
          explanation:
            "RBAC controls who may perform API actions; it does not bypass quota admission checks on resource requests.",
        },
      ],
    },
  ],
  labs: [],
};

const extendingKubernetes: DocsLesson = {
  slug: ["operations", "crds-operators-admission"],
  title: "CRDs, Operators & Admission Control",
  description:
    "Understand how Kubernetes becomes a platform: new APIs, custom controllers, and policy before objects persist.",
  section: "Operations",
  order: 12,
  concepts: ["crds", "operators", "admission-controllers", "reconciliation"],
  content: [
    {
      type: "heading",
      id: "platform-extension",
      text: "Extending the API",
    },
    {
      type: "paragraph",
      text: "Kubernetes is not a fixed set of objects — it is an extensible API server with a control-loop model. Three mechanisms turn it into a platform. A CustomResourceDefinition (CRD) teaches the API server a brand-new object kind. A controller (often called an Operator) watches instances of that kind and reconciles the real world toward them. Admission controllers sit on the write path and can mutate or reject any request before it is stored. Together they let you manage databases, backups, or certificates with the same kubectl apply workflow you already use for Pods.",
    },
    {
      type: "steps",
      items: [
        {
          title: "CRD",
          text: "Registers a new resource type with a group, versions, a schema, and an API path — so the API server can store and serve it.",
        },
        {
          title: "Custom resource",
          text: "An instance of that new type, such as a BackupPolicy or DatabaseCluster object, stored in etcd like any built-in object.",
        },
        {
          title: "Operator",
          text: "A controller that watches those custom resources and drives external or complex state to match — the CRD is data, the Operator is behavior.",
        },
        {
          title: "Admission",
          text: "Webhooks that run after authentication and authorization but before persistence, to default, mutate, or validate every write.",
        },
      ],
    },
    {
      type: "heading",
      id: "crd-anatomy",
      text: "Anatomy of a CRD",
    },
    {
      type: "paragraph",
      text: "A CRD is itself a normal Kubernetes object (kind: CustomResourceDefinition) that describes a new kind. The load-bearing parts are the group, the names (plural, singular, kind), the scope, the versions, and the OpenAPI schema the API server uses to validate instances. Get the group and names right and the API server will serve /apis/<group>/<version>/<plural> immediately.",
    },
    {
      type: "diagram",
      variant: "api-object",
      title: "A CRD registers a new kind",
      caption:
        "After the CRD is established, custom resources are stored and served by the same API server as built-in objects.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A complete CustomResourceDefinition",
      caption: "Everything the API server needs to serve a new BackupPolicy kind.",
      lines: [
        {
          code: "apiVersion: apiextensions.k8s.io/v1",
          note: "CRDs live in the apiextensions group — this manifest creates the type, not an instance",
        },
        {
          code: "kind: CustomResourceDefinition",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: backuppolicies.ops.klab.io",
          note: "MUST be exactly <spec.names.plural>.<spec.group> — the API server rejects any other name",
        },
        {
          code: "spec:",
        },
        {
          code: "  group: ops.klab.io",
          note: "the API group; instances get apiVersion ops.klab.io/<version>",
        },
        {
          code: "  scope: Namespaced",
          note: "Namespaced or Cluster — decides whether instances live in a namespace",
        },
        {
          code: "  names:",
        },
        {
          code: "    plural: backuppolicies",
          note: "used in the REST path and in kubectl get backuppolicies",
        },
        {
          code: "    singular: backuppolicy",
        },
        {
          code: "    kind: BackupPolicy",
          note: "the CamelCase kind used in the 'kind:' field of instances",
        },
        {
          code: "    shortNames:",
        },
        {
          code: "      - bp",
          note: "optional alias, so kubectl get bp works",
        },
        {
          code: "  versions:",
        },
        {
          code: "    - name: v1",
          note: "one entry per API version this type serves",
        },
        {
          code: "      served: true",
          note: "the API server answers requests for this version",
        },
        {
          code: "      storage: true",
          note: "EXACTLY ONE version has storage: true — the form persisted in etcd",
        },
        {
          code: "      schema:",
        },
        {
          code: "        openAPIV3Schema:",
          note: "structural schema — the API server validates instances against it and prunes unknown fields",
        },
        {
          code: "          type: object",
        },
        {
          code: "          properties:",
        },
        {
          code: "            spec:",
        },
        {
          code: "              type: object",
        },
        {
          code: "              properties:",
        },
        {
          code: "                schedule:",
        },
        {
          code: "                  type: string",
        },
        {
          code: "                retain:",
        },
        {
          code: "                  type: integer",
        },
        {
          code: "              required:",
        },
        {
          code: "                - schedule",
          note: "instances missing spec.schedule are rejected at admission time",
        },
      ],
    },
    {
      type: "heading",
      id: "custom-resource",
      text: "A custom resource instance",
    },
    {
      type: "paragraph",
      text: "Once the CRD is established, an instance looks like any other object. Its apiVersion is <group>/<version> and its kind matches names.kind. The API server validates it against the CRD schema and stores it — but nothing acts on it until a controller is watching.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A BackupPolicy instance",
      caption: "An instance of the type the CRD defined.",
      lines: [
        {
          code: "apiVersion: ops.klab.io/v1",
          note: "<group>/<version> from the CRD — NOT v1 and NOT apiextensions.k8s.io",
        },
        {
          code: "kind: BackupPolicy",
          note: "must equal spec.names.kind in the CRD",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: nightly",
        },
        {
          code: "  namespace: default",
          note: "allowed because the CRD scope is Namespaced",
        },
        {
          code: "spec:",
        },
        {
          code: '  schedule: "0 2 * * *"',
          note: "required by the schema — omit it and the create is rejected",
        },
        {
          code: "  retain: 7",
          note: "must be an integer per the schema; a string here would be pruned or rejected",
        },
      ],
    },
    {
      type: "heading",
      id: "build-crd",
      text: "Build a CRD from scratch",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "A CRD grows in three stages",
      stages: [
        {
          label: "Identity",
          note: "Name the type: the metadata.name must be <plural>.<group>, and names.kind is what instances use. Not servable yet — no versions.",
          code: "apiVersion: apiextensions.k8s.io/v1\nkind: CustomResourceDefinition\nmetadata:\n  name: backuppolicies.ops.klab.io\nspec:\n  group: ops.klab.io\n  scope: Namespaced\n  names:\n    plural: backuppolicies\n    singular: backuppolicy\n    kind: BackupPolicy",
        },
        {
          label: "Add a served version",
          note: "Declare v1 as both served and storage. Now the API server exposes /apis/ops.klab.io/v1/backuppolicies, but instances accept any shape.",
          code: "apiVersion: apiextensions.k8s.io/v1\nkind: CustomResourceDefinition\nmetadata:\n  name: backuppolicies.ops.klab.io\nspec:\n  group: ops.klab.io\n  scope: Namespaced\n  names:\n    plural: backuppolicies\n    singular: backuppolicy\n    kind: BackupPolicy\n  versions:\n    - name: v1\n      served: true\n      storage: true",
        },
        {
          label: "Add a schema",
          note: "The structural openAPIV3Schema makes the type safe: fields are typed, schedule is required, and unknown fields are pruned. v1 requires this schema.",
          code: "apiVersion: apiextensions.k8s.io/v1\nkind: CustomResourceDefinition\nmetadata:\n  name: backuppolicies.ops.klab.io\nspec:\n  group: ops.klab.io\n  scope: Namespaced\n  names:\n    plural: backuppolicies\n    singular: backuppolicy\n    kind: BackupPolicy\n  versions:\n    - name: v1\n      served: true\n      storage: true\n      schema:\n        openAPIV3Schema:\n          type: object\n          properties:\n            spec:\n              type: object\n              properties:\n                schedule: { type: string }\n                retain: { type: integer }\n              required: [schedule]",
        },
      ],
    },
    {
      type: "heading",
      id: "operator-pattern",
      text: "Controllers make it live",
    },
    {
      type: "paragraph",
      text: "A CRD by itself only lets you store and retrieve objects — it is inert. The Operator pattern adds a controller that runs a reconciliation loop: watch BackupPolicy objects, compare desired state (the spec) to observed reality, and take action (create a CronJob, call a backup API, update status). This is the exact same control-loop model the built-in Deployment and ReplicaSet controllers use — just aimed at a custom domain.",
    },
    {
      type: "diagram",
      variant: "control-loop",
      title: "Operator as another controller",
      caption:
        "Watch the custom resource, diff desired vs actual, act, and record status — then repeat.",
    },
    {
      type: "concept",
      term: "Reconciliation loop",
      definition:
        "A controller repeatedly observes the desired state (spec) and actual state, then acts to close the gap. It is level-triggered, not edge-triggered: it converges on the current spec even if it missed intermediate events or restarts.",
    },
    {
      type: "compare",
      caption:
        "Same pattern, different home: built-in controllers ship with the control plane; Operators are software you deploy.",
      left: {
        title: "Built-in controller",
        code: "runs inside kube-controller-manager\nreconciles core types\n(Deployment, ReplicaSet, Job)\nshipped and upgraded with Kubernetes",
      },
      right: {
        title: "Custom Operator",
        code: "runs as a Pod you deploy\nreconciles your CRD instances\n(BackupPolicy, DatabaseCluster)\nyou own its RBAC, image, and lifecycle",
      },
    },
    {
      type: "callout",
      tone: "key",
      title: "CRD is data, Operator is behavior",
      text: "Installing a CRD only adds a new API type — kubectl apply of a custom resource will succeed and store the object even if nothing ever acts on it. The Operator (a controller watching that type) is what turns the stored intent into real changes. Missing behavior almost always means the controller is not running, not that the CRD is wrong.",
    },
    {
      type: "quiz",
      id: "extension-q1",
      question:
        "You applied a CRD and created a BackupPolicy, but no backups ever run. What is the most likely cause?",
      options: [
        {
          id: "a",
          text: "No controller/Operator is watching the BackupPolicy type.",
          correct: true,
          explanation:
            "A CRD only stores data. Without a controller running the reconciliation loop, the object sits inert.",
        },
        {
          id: "b",
          text: "The API server never stored the object.",
          correct: false,
          explanation:
            "If kubectl apply succeeded and the schema passed, the object is stored — storage is not the missing piece.",
        },
        {
          id: "c",
          text: "CRDs bypass the API server, so writes are lost.",
          correct: false,
          explanation:
            "Custom resources go through the same API server and etcd as built-in objects.",
        },
        {
          id: "d",
          text: "BackupPolicy is a Service type that needs a selector.",
          correct: false,
          explanation: "It is a custom kind defined by a CRD, unrelated to Service exposure modes.",
        },
      ],
    },
    {
      type: "heading",
      id: "admission-control",
      text: "Admission: policy on the write path",
    },
    {
      type: "paragraph",
      text: "Every create/update/delete travels a fixed pipeline inside the API server: authentication, then authorization, then the admission chain, then persistence to etcd. Admission is where policy lives. Dynamic admission uses webhooks — external HTTPS endpoints the API server calls. Mutating webhooks run first and may patch the object (inject a sidecar, set a default). Then the object is checked against the OpenAPI/structural schema. Finally validating webhooks run and may only accept or reject. Nothing reaches etcd until the whole chain passes.",
    },
    {
      type: "callout",
      tone: "info",
      title: "Ordering: mutating before validating",
      text: "The API server always runs mutating admission webhooks before validating ones. This ordering matters: a mutating webhook might add the very label a validating webhook then requires. If you validated first, you would reject an object the mutation would have fixed.",
    },
    {
      type: "decisionTable",
      title: "Mutating vs validating admission webhooks",
      columns: ["When it runs", "Can change the object?", "Use it for"],
      rows: [
        {
          label: "Mutating webhook",
          cells: [
            "First — before schema validation and validating webhooks",
            "Yes — returns a JSON patch that modifies the object",
            "Injecting sidecars, setting defaults, adding labels/annotations",
          ],
        },
        {
          label: "Validating webhook",
          cells: [
            "Last — after mutation and schema validation",
            "No — may only allow or deny",
            "Enforcing policy: block privileged Pods, require limits, reject bad configs",
          ],
        },
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Webhooks are on the critical path",
      text: "A webhook with failurePolicy: Fail that becomes unreachable will block every matching write cluster-wide. Scope webhook rules narrowly, set sane timeouts, and exclude critical namespaces (like kube-system) so a broken webhook cannot lock you out of your own cluster.",
    },
    {
      type: "quiz",
      id: "admission-q2",
      question:
        "A mutating webhook adds the label tier=backend, and a validating webhook rejects any Pod missing tier. An operator applies a Pod with no tier label. What happens?",
      options: [
        {
          id: "a",
          text: "The Pod is admitted — mutation adds the label before validation checks it.",
          correct: true,
          explanation:
            "Mutating webhooks always run first, so the label exists by the time the validating webhook inspects the object.",
        },
        {
          id: "b",
          text: "The Pod is rejected — validation runs before mutation.",
          correct: false,
          explanation: "Ordering is the reverse: mutating admission precedes validating admission.",
        },
        {
          id: "c",
          text: "Both webhooks are skipped because the label was missing.",
          correct: false,
          explanation:
            "Webhook rules match on resource/operation, not on whether a field is already present.",
        },
        {
          id: "d",
          text: "The object is stored first, then labeled afterward.",
          correct: false,
          explanation:
            "Admission runs before persistence; nothing reaches etcd until the chain passes.",
        },
      ],
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a broken CRD",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "This CRD is rejected by the API server with an error about metadata.name. The group and names look reasonable. What is wrong?",
      code: "apiVersion: apiextensions.k8s.io/v1\nkind: CustomResourceDefinition\nmetadata:\n  name: backuppolicy.ops.klab.io\nspec:\n  group: ops.klab.io\n  scope: Namespaced\n  names:\n    plural: backuppolicies\n    singular: backuppolicy\n    kind: BackupPolicy\n  versions:\n    - name: v1\n      served: true\n      storage: true",
      answer:
        "The metadata.name must be exactly <spec.names.plural>.<spec.group>. Here the plural is 'backuppolicies' and the group is 'ops.klab.io', so the name must be 'backuppolicies.ops.klab.io' — but it says 'backuppolicy.ops.klab.io' (the singular). Change metadata.name to backuppolicies.ops.klab.io.",
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write one yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Author a CRD for a new namespaced kind CacheCluster in group cache.klab.io. It should serve a single version v1 (served and stored) and expose the short name cc. A schema is not required for this exercise.",
      hint: "Remember metadata.name must be <plural>.<group>, exactly one version has storage: true, and names needs plural, singular, and kind.",
      solution:
        "apiVersion: apiextensions.k8s.io/v1\nkind: CustomResourceDefinition\nmetadata:\n  name: cacheclusters.cache.klab.io\nspec:\n  group: cache.klab.io\n  scope: Namespaced\n  names:\n    plural: cacheclusters\n    singular: cachecluster\n    kind: CacheCluster\n    shortNames:\n      - cc\n  versions:\n    - name: v1\n      served: true\n      storage: true",
    },
    {
      type: "takeaways",
      items: [
        "A CRD teaches the API server a new object kind; its metadata.name must be <plural>.<group>, and exactly one version is the storage version.",
        "A custom resource is inert data until a controller (Operator) runs a reconciliation loop over it — the CRD is data, the Operator is behavior.",
        "Operators use the same level-triggered control-loop as built-in controllers; the difference is they run as Pods you deploy and own.",
        "Admission webhooks run on the write path before persistence: mutating first (can patch), then schema validation, then validating (accept or reject only).",
        "Webhooks are on the critical path — a broken one with failurePolicy: Fail can block writes cluster-wide, so scope and time them out carefully.",
      ],
    },
  ],
  labs: [],
};

const serviceHadNoEndpoints: DocsLesson = {
  slug: ["incidents", "service-had-no-endpoints"],
  title: "Service Had No Endpoints",
  description:
    "A realistic incident pattern: the Service exists, Pods exist, but no traffic can flow.",
  section: "Real Incidents",
  order: 0,
  concepts: ["services", "endpointslices", "labels-selectors", "readiness-probes"],
  relatedLevelSlug: "service-has-no-endpoints",
  content: [
    {
      type: "heading",
      id: "incident-summary",
      text: "Incident summary",
    },
    {
      type: "paragraph",
      text: "At 02:14 UTC the checkout page started returning HTTP 503 for every request. The web-svc Service existed, the Deployment reported all replicas Available, and nothing had obviously crashed. But `kubectl get endpoints web-svc` showed a single word: <none>. A Service with no endpoints has nowhere to send traffic, so every request failed at the front door. This postmortem walks the timeline, finds the root cause, and turns it into prevention.",
    },
    {
      type: "callout",
      tone: "info",
      title: "Impact",
      text: "Duration 21 minutes. 100% of checkout requests failed with 503. Root cause: a label refactor changed the Deployment's Pod template labels but not the Service selector, so the EndpointSlice controller could not match any Pods. No data was lost — this was a pure routing outage.",
    },
    {
      type: "diagram",
      variant: "debug-loop",
      title: "The endpoints debugging loop",
    },
    {
      type: "heading",
      id: "timeline",
      text: "Timeline",
    },
    {
      type: "demo",
      title: "How the incident unfolded",
      description:
        "Each step is a real command an on-call engineer ran, in order. Notice how the evidence narrows the search instead of guessing.",
      steps: [
        {
          label: "02:14 — Alert fires",
          detail:
            "Synthetic checkout probe reports 503s. The Service DNS name resolved fine, so this was not a DNS problem — the request reached the Service and died there.",
          command: "curl -s -o /dev/null -w '%{http_code}\\n' http://web-svc/",
          output: "503",
        },
        {
          label: "02:16 — Check endpoints first",
          detail:
            "Before touching pods, ask whether the Service has any backends at all. This one had none.",
          command: "kubectl get endpoints web-svc",
          output: "NAME      ENDPOINTS   AGE\nweb-svc   <none>      42d",
        },
        {
          label: "02:18 — Describe the Service",
          detail: "Read the selector the Service is actually using. It selects app=web.",
          command: "kubectl describe svc web-svc",
          output:
            "Name:       web-svc\nSelector:   app=web\nType:       ClusterIP\nPort:       http 80/TCP\nTargetPort: 8080/TCP\nEndpoints:  <none>",
        },
        {
          label: "02:21 — Inspect the Pods and their labels",
          detail:
            "The Pods are Running and Ready — but their labels read app=web-frontend, not app=web. That single mismatch is the whole outage.",
          command: "kubectl get pods --show-labels",
          output:
            "NAME                   READY   STATUS    LABELS\nweb-7d9c8b6f5-abcde    1/1     Running   app=web-frontend,pod-template-hash=7d9c8b6f5\nweb-7d9c8b6f5-fghij    1/1     Running   app=web-frontend,pod-template-hash=7d9c8b6f5",
        },
        {
          label: "02:33 — Recovery",
          detail:
            "After aligning the Service selector to app=web-frontend and re-applying, the EndpointSlice controller published two Ready endpoints and 503s stopped immediately.",
          command: "kubectl get endpoints web-svc",
          output:
            "NAME      ENDPOINTS                        AGE\nweb-svc   10.244.1.7:8080,10.244.2.4:8080  42d",
        },
      ],
    },
    {
      type: "heading",
      id: "how-endpoints-work",
      text: "Why the Service had nowhere to send traffic",
    },
    {
      type: "paragraph",
      text: "A Service does not know about Pods directly. The EndpointSlice controller continuously watches for Pods whose labels match the Service's selector AND that report Ready, then publishes their IPs as endpoints. kube-proxy programs those endpoints into the dataplane. Break either link — the label match or the readiness gate — and the endpoint list goes empty. Empty endpoints is the symptom; a selector mismatch or NotReady Pods is the cause.",
    },
    {
      type: "concept",
      term: "EndpointSlice controller",
      definition:
        "The control-plane controller that reconciles Service selectors against Pod labels and readiness. It publishes only Pods that BOTH match the selector and are Ready. If it can find none, the Service's endpoint set is empty and traffic has no backend.",
    },
    {
      type: "diagram",
      variant: "service-routing",
      title: "Where the routing path broke",
    },
    {
      type: "heading",
      id: "broken-manifest",
      text: "The manifest that shipped",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "Deployment + Service as deployed (buggy)",
      caption: "A label-rename refactor touched the Pod template but not the Service selector.",
      lines: [
        {
          code: "apiVersion: apps/v1",
        },
        {
          code: "kind: Deployment",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: web",
        },
        {
          code: "spec:",
        },
        {
          code: "  replicas: 2",
        },
        {
          code: "  selector:",
        },
        {
          code: "    matchLabels:",
        },
        {
          code: "      app: web-frontend",
          note: "the refactor renamed the Pod label here",
        },
        {
          code: "  template:",
        },
        {
          code: "    metadata:",
        },
        {
          code: "      labels:",
        },
        {
          code: "        app: web-frontend",
          note: "Pods now carry app=web-frontend — the new name",
        },
        {
          code: "    spec:",
        },
        {
          code: "      containers:",
        },
        {
          code: "        - name: web",
        },
        {
          code: "          image: klab/web-app:1.0.0",
        },
        {
          code: "          ports:",
        },
        {
          code: "            - containerPort: 8080",
        },
        {
          code: "---",
        },
        {
          code: "apiVersion: v1",
        },
        {
          code: "kind: Service",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: web-svc",
        },
        {
          code: "spec:",
        },
        {
          code: "  selector:",
        },
        {
          code: "    app: web",
          note: "STILL the old name — matches zero Pods, so endpoints = <none>",
        },
        {
          code: "  ports:",
        },
        {
          code: "    - port: 80",
        },
        {
          code: "      targetPort: 8080",
        },
      ],
    },
    {
      type: "heading",
      id: "root-cause",
      text: "Root cause",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      title: "Find the mismatch",
      prompt:
        "The Deployment is healthy and its two Pods are Running and Ready. The Service exists. Yet `kubectl get endpoints web-svc` shows <none>. Where is the fault?",
      code: "# Pod template labels\nlabels:\n  app: web-frontend\n---\n# Service selector\nspec:\n  selector:\n    app: web",
      answer:
        "The Service selector is app=web, but the Pods are labeled app=web-frontend. Selector matching is exact and key-for-key, so the EndpointSlice controller finds no matching Pods and publishes zero endpoints. The Pods being Ready is irrelevant — they were never candidates. Fix: change the Service selector to app: web-frontend (or re-align the Pod labels back to app: web), so the two agree.",
    },
    {
      type: "heading",
      id: "the-fix",
      text: "The fix",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "Aligned Service (fixed)",
      caption: "The selector now matches the Pod template labels exactly. Nothing else changed.",
      lines: [
        {
          code: "apiVersion: v1",
        },
        {
          code: "kind: Service",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: web-svc",
        },
        {
          code: "spec:",
        },
        {
          code: "  selector:",
        },
        {
          code: "    app: web-frontend",
          note: "now identical to the Pod template label — endpoints populate within a second",
        },
        {
          code: "  ports:",
        },
        {
          code: "    - port: 80",
          note: "client-facing port; unchanged",
        },
        {
          code: "      targetPort: 8080",
          note: "matches containerPort — unchanged, and never the real fault here",
        },
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Lesson learned",
      text: "Labels are an API contract between objects, not free-form metadata. A Service selector and the Pods it targets are coupled: renaming a label on one side silently unroutes the other. The Deployment stayed 'green' the whole time because a Deployment measures its own Pods' health, not whether any Service can find them.",
    },
    {
      type: "callout",
      tone: "key",
      title: "Two ways to get empty endpoints",
      text: "Selector mismatch (no Pod matches) and readiness failure (Pods match but none are Ready) produce the identical <none> symptom. `kubectl get pods --show-labels` distinguishes them: if labels don't match the selector it's a selector bug; if they match but READY shows 0/1 it's a readiness bug — check the readinessProbe path and target port.",
    },
    {
      type: "compare",
      caption:
        "The only difference that matters: do the Service selector and the Pod template labels agree?",
      left: {
        title: "Drifted (0 endpoints)",
        code: "# Pod template\nlabels:\n  app: web-frontend\n---\n# Service\nselector:\n  app: web",
      },
      right: {
        title: "Aligned (endpoints flow)",
        code: "# Pod template\nlabels:\n  app: web-frontend\n---\n# Service\nselector:\n  app: web-frontend",
      },
    },
    {
      type: "heading",
      id: "prevention",
      text: "Prevention",
    },
    {
      type: "decisionTable",
      title: "Empty-endpoints failure modes and how to prevent them",
      columns: ["How you spot it", "How to prevent it"],
      rows: [
        {
          label: "Selector / label mismatch",
          cells: [
            "describe svc selector differs from Pod --show-labels",
            "Define the label once (a shared value/anchor) and reference it in both selector and template; add a CI check that a Service's selector matches its workload's template labels",
          ],
        },
        {
          label: "All Pods NotReady",
          cells: [
            "Pods match the selector but READY shows 0/1",
            "Point readinessProbe at a real ready endpoint (klab/web-app:1.0.0 returns 200 on /healthz but 404 on /readyz — a probe on /readyz keeps every Pod NotReady forever)",
          ],
        },
        {
          label: "Wrong targetPort / named port",
          cells: [
            "Endpoints exist but connections refuse or hang",
            "Keep targetPort equal to containerPort, or use a named port so a port renumber can't drift",
          ],
        },
        {
          label: "Service in the wrong namespace",
          cells: [
            "Endpoints empty; Pods live in another namespace",
            "Deploy Service and workload from the same namespaced manifest set; selectors never cross namespaces",
          ],
        },
      ],
    },
    {
      type: "heading",
      id: "practice",
      text: "Practice the fix",
    },
    {
      type: "challenge",
      language: "yaml",
      title: "Ship a routable pair",
      prompt:
        "Write a Deployment named api (2 replicas, image klab/web-app:1.0.0, containerPort 8080) and a Service named api-svc that will actually gain endpoints. Clients connect on port 80. Make the labels agree.",
      hint: "The Service selector, the Deployment's spec.selector.matchLabels, and the Pod template labels must all use the same key:value. Keep targetPort equal to containerPort (8080).",
      solution:
        "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: api\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: api\n  template:\n    metadata:\n      labels:\n        app: api\n    spec:\n      containers:\n        - name: api\n          image: klab/web-app:1.0.0\n          ports:\n            - containerPort: 8080\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: api-svc\nspec:\n  selector:\n    app: api\n  ports:\n    - port: 80\n      targetPort: 8080",
    },
    {
      type: "takeaways",
      items: [
        "Empty endpoints is a symptom; the cause is always either 'no Pod matches the selector' or 'no matching Pod is Ready'.",
        "Debug in order: get endpoints -> describe svc (read the selector) -> get pods --show-labels (compare labels and READY).",
        "A Service selector and the target Pod labels are a coupled contract — change one side and you must change the other.",
        "A Deployment reporting Available says nothing about whether a Service can route to its Pods.",
        "Prevent it with label discipline (single source of truth) and readiness probes that point at a genuinely-ready endpoint.",
      ],
    },
    {
      type: "quiz",
      id: "no-endpoints-q1",
      question: "Which two facts are BOTH required for a Pod to appear as a Service endpoint?",
      options: [
        {
          id: "a",
          text: "It must match the Service selector and be Ready.",
          correct: true,
          explanation:
            "The EndpointSlice controller publishes only Pods that both match the selector and pass their readiness gate.",
        },
        {
          id: "b",
          text: "It must have the same name as the Service.",
          correct: false,
          explanation: "Services select Pods by labels, never by Pod or Deployment name.",
        },
        {
          id: "c",
          text: "It must run in the kube-system namespace.",
          correct: false,
          explanation:
            "Application Pods and their Services live together in application namespaces; selectors don't cross namespaces.",
        },
        {
          id: "d",
          text: "Its Deployment must report all replicas Available.",
          correct: false,
          explanation:
            "Deployment availability tracks Pod health, not label matching. Our Deployment was fully Available while endpoints were empty.",
        },
      ],
    },
    {
      type: "quiz",
      id: "no-endpoints-q2",
      question:
        "`kubectl get pods --show-labels` shows Pods labeled app=web-frontend that are READY 1/1, but `describe svc` shows Selector: app=web and Endpoints: <none>. What is the fix?",
      options: [
        {
          id: "a",
          text: "Align the selector and Pod labels — set the Service selector to app=web-frontend (or relabel the Pods to app=web).",
          correct: true,
          explanation:
            "The mismatch is the whole bug. Once selector and labels agree, the controller matches the Ready Pods and endpoints populate.",
        },
        {
          id: "b",
          text: "Restart the Pods so they become Ready.",
          correct: false,
          explanation:
            "The Pods are already Ready (1/1). Readiness was never the problem here; the labels don't match the selector.",
        },
        {
          id: "c",
          text: "Scale the Deployment to more replicas.",
          correct: false,
          explanation:
            "More Pods with the wrong label still match zero — scaling can't fix a selector mismatch.",
        },
        {
          id: "d",
          text: "Change the Service targetPort to 80.",
          correct: false,
          explanation:
            "targetPort controls where matched endpoints receive traffic; it can't create endpoints when the selector matches nothing.",
        },
      ],
    },
  ],
  labs: [],
};

const cpuThrottling: DocsLesson = {
  slug: ["incidents", "cpu-throttling-incident"],
  title: "CPU Throttling Incident",
  description: "How a resource limit can make an otherwise healthy app slow or flaky.",
  section: "Real Incidents",
  order: 1,
  concepts: ["debugging", "events", "pods"],
  content: [
    {
      type: "heading",
      id: "incident-summary",
      text: "Incident summary",
    },
    {
      type: "paragraph",
      text: "At 14:02 the pager fired: checkout p99 latency jumped from 80ms to 900ms and a fraction of requests began timing out. No deploy had gone out. CPU dashboards looked calm — average utilisation across the Pods sat near 20% of their limit. Adding replicas barely helped. The culprit was not a lack of Pods; it was a CPU limit throttling each Pod for tens of milliseconds at a time. This postmortem walks the timeline, the root cause, the fix, and how to stop it recurring.",
    },
    {
      type: "demo",
      title: "Incident timeline",
      description:
        "How the on-call engineer went from a latency alert to the throttling root cause.",
      steps: [
        {
          label: "14:02 — Alert",
          detail: "p99 latency SLO breached. Error rate climbing from client-side timeouts.",
          command: "kubectl -n shop get deploy checkout",
          output:
            "NAME       READY   UP-TO-DATE   AVAILABLE   AGE\ncheckout   6/6     6            6           40d",
        },
        {
          label: "14:06 — Rule out a bad rollout",
          detail:
            "No recent change; all Pods Ready. Average CPU is well under the limit, so this does not look like classic saturation.",
          command: "kubectl -n shop top pod -l app=checkout",
          output:
            "NAME             CPU(cores)   MEMORY\ncheckout-7c...   58m          210Mi\ncheckout-9d...   61m          208Mi",
        },
        {
          label: "14:11 — Scaling up does little",
          detail:
            "More replicas spread load but each Pod is still individually throttled during request bursts, so tail latency stays high.",
          command: "kubectl -n shop scale deploy checkout --replicas=10",
          output: "deployment.apps/checkout scaled",
        },
        {
          label: "14:18 — Read the throttling metric",
          detail:
            "Inside a Pod, the cgroup CPU stats show the container is being throttled in most scheduling periods.",
          command: "kubectl -n shop exec checkout-7c... -- cat /sys/fs/cgroup/cpu.stat",
          output: "nr_periods 48210\nnr_throttled 41880\nthrottled_usec 903221000",
        },
        {
          label: "14:25 — Root cause + fix",
          detail:
            "The Deployment set cpu limit 250m. Bursty request handling exhausted the CFS quota each period. Raised the request and removed the tight limit; latency recovered within a minute.",
          command: "kubectl -n shop rollout status deploy checkout",
          output: 'deployment "checkout" successfully rolled out',
        },
      ],
    },
    {
      type: "diagram",
      variant: "debug-loop",
      title: "Throttling triage loop",
      caption:
        "Latency spike, calm average CPU, and high throttled-period ratio point to CFS throttling rather than saturation.",
    },
    {
      type: "heading",
      id: "compressible-vs-incompressible",
      text: "CPU is compressible; memory is not",
    },
    {
      type: "paragraph",
      text: "The reason this incident looked so confusing is that CPU and memory fail in completely different ways. Kubernetes treats CPU as a compressible resource: when a container wants more than its limit, the kernel simply pauses it — it slows down but keeps running. Memory is incompressible: there is no way to give a process 'less' of the memory it already wrote, so exceeding a memory limit ends with the kernel killing the container (OOMKilled).",
    },
    {
      type: "concept",
      term: "Compressible resource",
      definition:
        "A resource that can be throttled and handed back over time without destroying work in progress. CPU is compressible — the scheduler withholds CPU time and the process stalls, then resumes. Because it is never killed for exceeding a CPU limit, the symptom is latency, not a crash.",
    },
    {
      type: "callout",
      tone: "key",
      title: "The one-line mental model",
      text: "Over a CPU limit → the container is THROTTLED (paused by CFS, still Running, no restart). Over a memory limit → the container is OOMKilled and restarts (you would see Reason: OOMKilled and a rising restart count). A slow-but-alive Pod with zero restarts is the fingerprint of CPU throttling.",
    },
    {
      type: "heading",
      id: "how-cfs-throttles",
      text: "How a CPU limit actually throttles",
    },
    {
      type: "paragraph",
      text: "A CPU limit is enforced by the Linux CFS bandwidth controller, not by a magic average. The kernel divides time into periods (default 100ms) and grants the container a quota of CPU-time per period equal to its limit. A limit of 250m means 0.25 CPU-seconds per second, i.e. 25ms of CPU time in every 100ms period. Once the container spends that 25ms, it is throttled — frozen until the next period begins. Requests behave differently: a request is used for scheduling and to set the container's relative CPU weight; it does not cap anything.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "The misconfigured Deployment",
      caption: "The limit that caused the incident. Read the resources block line by line.",
      lines: [
        {
          code: "apiVersion: apps/v1",
        },
        {
          code: "kind: Deployment",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: checkout",
        },
        {
          code: "  namespace: shop",
        },
        {
          code: "spec:",
        },
        {
          code: "  replicas: 6",
        },
        {
          code: "  selector:",
        },
        {
          code: "    matchLabels:",
        },
        {
          code: "      app: checkout",
        },
        {
          code: "  template:",
        },
        {
          code: "    metadata:",
        },
        {
          code: "      labels:",
        },
        {
          code: "        app: checkout",
        },
        {
          code: "    spec:",
        },
        {
          code: "      containers:",
        },
        {
          code: "        - name: web",
          note: "single container; a request handler that bursts CPU per call",
        },
        {
          code: "          image: klab/web-app:1.0.0",
        },
        {
          code: "          resources:",
        },
        {
          code: "            requests:",
        },
        {
          code: "              cpu: 100m",
          note: "scheduling + relative weight only; this never caps usage",
        },
        {
          code: "              memory: 128Mi",
        },
        {
          code: "            limits:",
        },
        {
          code: "              cpu: 250m",
          note: "THE BUG: 25ms of CPU per 100ms period — a short burst blows the quota and stalls the Pod for the rest of the period",
        },
        {
          code: "              memory: 256Mi",
          note: "memory limit is fine to keep — it protects the node and OOMKills a leak instead of throttling",
        },
        {
          code: "          readinessProbe:",
        },
        {
          code: "            httpGet:",
        },
        {
          code: "              path: /readyz",
          note: "if the handler is throttled mid-burst, even the probe can time out and evict the Pod from Endpoints",
        },
        {
          code: "              port: 8080",
        },
      ],
    },
    {
      type: "heading",
      id: "throttled-below-limit",
      text: "Why it throttles even 'below' the limit",
    },
    {
      type: "paragraph",
      text: "The dashboards showed ~60m average against a 250m limit, so the team assumed there was headroom. But averages hide bursts. Real CPU usage is spiky: a single checkout request might need a 40ms burst on one core. Within a 100ms period the container spends its 25ms quota after 25ms of that burst and is throttled for the remaining ~75ms — adding tens of milliseconds of pure wait to that request. Averaged over a whole second, utilisation still looks like 20% while p99 latency has quietly exploded.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Average CPU is the wrong signal",
      text: "Throttling is a per-period phenomenon; a low one-second average tells you nothing about it. The signal that matters is the throttled-period ratio: container_cpu_cfs_throttled_periods_total / container_cpu_cfs_periods_total. If that ratio is meaningfully above zero, requests are being paused mid-flight regardless of how idle the average looks. In the incident it was 41880 / 48210 ≈ 87% of periods throttled.",
    },
    {
      type: "code",
      language: "markdown",
      code: "throttle ratio = container_cpu_cfs_throttled_periods_total\n              -------------------------------------------\n                 container_cpu_cfs_periods_total\n\n# inside the container (cgroup v2):\ncat /sys/fs/cgroup/cpu.stat   ->  nr_periods / nr_throttled / throttled_usec\n\n# alert when the ratio stays above ~0.25 for a workload that owns its latency SLO",
    },
    {
      type: "heading",
      id: "root-cause",
      text: "Root cause: read the broken spec",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      title: "Find the field that caused the latency",
      prompt:
        "This app is Running with zero restarts, average CPU near 20% of its limit, yet p99 latency is 10x normal and readiness flaps. What in this spec explains it?",
      code: "resources:\n  requests:\n    cpu: 100m\n    memory: 128Mi\n  limits:\n    cpu: 250m\n    memory: 256Mi",
      answer:
        "The cpu limit of 250m is the problem. It caps the container at 25ms of CPU per 100ms CFS period. A bursty request handler exhausts that quota partway through a burst and is throttled (paused) for the rest of the period, adding large tail latency and occasionally starving the readiness probe — all while the one-second average stays low and the container is never killed. Zero restarts + high throttled-period ratio confirms throttling, not OOM. Fix: raise the request to match real steady-state need and raise or remove the CPU limit.",
    },
    {
      type: "heading",
      id: "the-fix",
      text: "The fix",
    },
    {
      type: "paragraph",
      text: "Two changes fixed it. First, the request was raised to reflect what a Pod actually needs at steady state, so the scheduler places it on a node with real CPU to give and its relative weight under contention is honest. Second, the punishingly tight CPU limit was removed — for a latency-sensitive service that already has an honest request, a CPU limit mostly buys throttling with no upside. The memory limit stayed, because memory is incompressible and you still want a leak to be OOMKilled rather than take down the node.",
    },
    {
      type: "compare",
      caption: "Same workload, resources rewritten. Left throttles; right does not.",
      left: {
        title: "Before — throttled",
        code: "resources:\n  requests:\n    cpu: 100m\n    memory: 128Mi\n  limits:\n    cpu: 250m      # 25ms / 100ms\n    memory: 256Mi",
      },
      right: {
        title: "After — right-sized",
        code: "resources:\n  requests:\n    cpu: 500m      # honest steady-state\n    memory: 256Mi\n  limits:\n    # cpu limit removed on purpose\n    memory: 512Mi  # keep the memory limit",
      },
    },
    {
      type: "callout",
      tone: "info",
      title: "Removing the CPU limit is not 'no limits'",
      text: "The request still guarantees CPU under contention and drives scheduling and the CPU weight, so a Pod without a CPU limit cannot freely starve its neighbours — it only gets to use idle CPU that would otherwise go to waste. If your platform requires limits (e.g. a Guaranteed QoS mandate, where limits must equal requests), set the CPU limit generously above the observed p99 burst rather than at the average. Keep the memory limit either way.",
    },
    {
      type: "heading",
      id: "prevention",
      text: "Prevention",
    },
    {
      type: "decisionTable",
      title: "Sizing CPU vs memory to avoid this class of incident",
      columns: ["CPU (compressible)", "Memory (incompressible)"],
      rows: [
        {
          label: "Failure mode when over budget",
          cells: [
            "Throttled — paused by CFS, stays Running, latency spikes",
            "OOMKilled — container terminated and restarted",
          ],
        },
        {
          label: "Set the request to",
          cells: [
            "Real steady-state usage (drives scheduling + weight)",
            "Real working-set size so scheduling is accurate",
          ],
        },
        {
          label: "Set the limit to",
          cells: [
            "High above burst, or omit it for latency-sensitive apps",
            "Always set it — it caps a leak and protects the node",
          ],
        },
        {
          label: "Metric to alert on",
          cells: [
            "throttled_periods / periods ratio",
            "OOMKilled events + restart count + working set vs limit",
          ],
        },
      ],
    },
    {
      type: "heading",
      id: "practice",
      text: "Practice: right-size it",
    },
    {
      type: "challenge",
      language: "yaml",
      title: "Rewrite the resources block",
      prompt:
        "A latency-sensitive service bursts to ~450m during a request and sits around 300m at steady state; its working set is ~300Mi. Write a resources block that will not throttle it while still protecting the node's memory.",
      hint: "Set the CPU request to the honest steady-state figure, avoid a tight CPU limit, and keep a memory limit above the working set.",
      solution:
        "resources:\n  requests:\n    cpu: 300m\n    memory: 300Mi\n  limits:\n    # no cpu limit: bursts use idle CPU without being paused\n    memory: 512Mi",
    },
    {
      type: "takeaways",
      items: [
        "CPU is compressible: exceeding a CPU limit throttles (pauses) the container — it stays Running with zero restarts. Memory is incompressible: exceeding a memory limit OOMKills it.",
        "A CPU limit is CFS quota per 100ms period; bursty work can be throttled hard even while the one-second average sits far below the limit.",
        "Alert on the throttled-period ratio, not average CPU. High ratio + high tail latency + no restarts = throttling.",
        "Fix by right-sizing the request to real steady-state need and raising or removing the CPU limit; keep the memory limit.",
        "Throttling can starve readiness probes, evicting Pods from Endpoints and turning a latency problem into an availability one.",
      ],
    },
    {
      type: "quiz",
      id: "cpu-q1",
      question:
        "A Pod is Running with zero restarts and ~20% average CPU, yet p99 latency spiked and readiness is flapping. What is the most likely cause?",
      options: [
        {
          id: "a",
          text: "A tight CPU limit is throttling bursts, so requests (and probes) get paused mid-flight even though the average looks idle.",
          correct: true,
          explanation:
            "CFS enforces the limit per 100ms period, so bursty work is throttled regardless of a low average. Zero restarts rules out OOMKilled.",
        },
        {
          id: "b",
          text: "The container is out of memory and being OOMKilled.",
          correct: false,
          explanation:
            "OOMKilled terminates and restarts the container; you would see a rising restart count and Reason: OOMKilled, not a Running Pod with zero restarts.",
        },
        {
          id: "c",
          text: "The Service selector no longer matches the Pods.",
          correct: false,
          explanation:
            "A selector mismatch drops endpoints entirely; it does not produce slow-but-alive responses with high CPU throttling.",
        },
        {
          id: "d",
          text: "Cluster DNS stopped resolving the Service name.",
          correct: false,
          explanation:
            "DNS failure causes name-resolution errors before traffic flows, not per-request latency that tracks CPU bursts.",
        },
      ],
    },
    {
      type: "quiz",
      id: "cpu-q2",
      question: "Which single metric best confirms CPU throttling as the root cause?",
      options: [
        {
          id: "a",
          text: "container_cpu_cfs_throttled_periods_total divided by container_cpu_cfs_periods_total.",
          correct: true,
          explanation:
            "That ratio measures the fraction of scheduling periods in which the container was paused — the direct fingerprint of throttling.",
        },
        {
          id: "b",
          text: "Average CPU utilisation over the last minute.",
          correct: false,
          explanation:
            "Averages hide bursts; a workload can be throttled in most periods while its one-second average stays low.",
        },
        {
          id: "c",
          text: "The Pod restart count.",
          correct: false,
          explanation:
            "Restarts indicate crashes or OOMKills, not throttling — a throttled container keeps running.",
        },
        {
          id: "d",
          text: "Number of replicas in the Deployment.",
          correct: false,
          explanation:
            "Replica count is about horizontal capacity; per-Pod throttling persists no matter how many replicas you add.",
        },
      ],
    },
  ],
  labs: [],
};

const dnsOutage: DocsLesson = {
  slug: ["incidents", "dns-outage-postmortem"],
  title: "DNS Outage Postmortem",
  description:
    "A structured way to debug DNS name failures without confusing them with Service endpoint failures.",
  section: "Real Incidents",
  order: 2,
  concepts: ["dns", "services", "networking", "debugging"],
  relatedLevelSlug: "dns-resolution-failure",
  content: [
    {
      type: "heading",
      id: "incident-summary",
      text: "Incident summary",
    },
    {
      type: "paragraph",
      text: "At 14:02 every workload in the payments namespace started failing at once: API calls to in-cluster Services and to external providers both returned 'Could not resolve host'. It looked cluster-wide, but nothing had been deployed to the apps. Ten minutes earlier a platform engineer had rolled out a default-deny NetworkPolicy to the namespace. The policy enabled Egress but never allowed traffic to CoreDNS on port 53, so every DNS query in the namespace was silently dropped. This postmortem walks the timeline, the investigation, the root cause, the fix, and how to keep DNS from becoming a single point of failure.",
    },
    {
      type: "diagram",
      variant: "debug-loop",
      title: "DNS incident triage loop",
      caption:
        "Prove resolution (dig) before reachability (curl). A name that will not resolve fails before any Service endpoint is ever consulted.",
    },
    {
      type: "heading",
      id: "timeline",
      text: "Timeline of the outage",
    },
    {
      type: "steps",
      title: "What happened, in order",
      items: [
        {
          title: "13:52 — NetworkPolicy applied",
          text: "A default-deny egress policy is rolled out to the payments namespace to lock down outbound traffic ahead of an audit. It allows egress to the ledger app on TCP 8080 and nothing else.",
        },
        {
          title: "14:02 — Alerts fire",
          text: "Every payments Pod reports request failures. Error rate for the namespace hits 100%. On-call is paged with 'payments down'.",
        },
        {
          title: "14:06 — First wrong theory",
          text: "The team suspects CoreDNS crashed. But CoreDNS Pods in kube-system are Running, 0 restarts, and Pods in other namespaces resolve names fine. The blast radius is exactly one namespace.",
        },
        {
          title: "14:14 — Real cause found",
          text: "A shell inside a payments Pod shows dig timing out against 10.96.0.10:53. The recently applied NetworkPolicy has no egress rule for port 53 to kube-dns.",
        },
        {
          title: "14:19 — Mitigation",
          text: "An allow-dns egress rule permitting UDP and TCP 53 to CoreDNS is applied. Resolution recovers within seconds; error rate returns to zero.",
        },
      ],
    },
    {
      type: "heading",
      id: "investigation",
      text: "The investigation",
    },
    {
      type: "demo",
      title: "Layered triage: resolution before reachability",
      description:
        "The fastest way to localize a name failure is to separate DNS from routing. dig answers 'does the name resolve?'; curl answers 'does traffic reach a Ready endpoint?'.",
      steps: [
        {
          label: "Confirm the blast radius",
          detail:
            "CoreDNS is healthy and other namespaces are fine, so this is not a control-plane outage. The problem is scoped to one namespace.",
          command: "kubectl -n kube-system get pods -l k8s-app=kube-dns",
          output:
            "NAME                       READY   STATUS    RESTARTS   AGE\ncoredns-5d78c9b4c7-abcde   1/1     Running   0          9d\ncoredns-5d78c9b4c7-fghij   1/1     Running   0          9d",
        },
        {
          label: "Try to resolve from inside a payments Pod",
          detail:
            "dig hangs and returns no answer. The query to the cluster DNS ServiceIP never gets a response — a classic dropped-packet signature, not NXDOMAIN.",
          command: "kubectl -n payments exec deploy/checkout -- dig +time=2 web-svc",
          output: ";; connection timed out; no servers could be reached",
        },
        {
          label: "Check what governs egress",
          detail:
            "A NetworkPolicy selecting all Pods with Egress in policyTypes is present. Enabling Egress flips the namespace to deny-by-default for outbound traffic.",
          command: "kubectl -n payments get networkpolicy",
          output: "NAME               POD-SELECTOR   AGE\npayments-egress    <none>         12m",
        },
        {
          label: "Confirm the fix restores resolution",
          detail:
            "After allowing UDP/TCP 53 to kube-dns, dig returns the Service ClusterIP immediately and curl reaches a Ready endpoint.",
          command: "kubectl -n payments exec deploy/checkout -- dig +short web-svc",
          output: "10.96.0.12",
        },
      ],
    },
    {
      type: "heading",
      id: "root-cause",
      text: "Root cause: a default-deny policy ate DNS",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      title: "The policy that took down the namespace",
      prompt:
        "This NetworkPolicy was meant to restrict outbound traffic to just the ledger service. Instead it broke all DNS resolution for every Pod in the namespace. What is wrong?",
      code: "apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: payments-egress\n  namespace: payments\nspec:\n  podSelector: {}\n  policyTypes:\n    - Egress\n  egress:\n    - to:\n        - podSelector:\n            matchLabels:\n              app: ledger\n      ports:\n        - protocol: TCP\n          port: 8080",
      answer:
        "podSelector: {} selects every Pod in the namespace, and listing Egress in policyTypes switches the namespace from allow-all-egress to deny-all-egress-except-what-is-listed. The only allowed egress is TCP 8080 to app: ledger. DNS lives in kube-system (CoreDNS, reached on UDP/TCP port 53 via the kube-dns ServiceIP) and is not in the allow list, so every DNS query is dropped. Applications cannot resolve any name — internal or external. The fix is to add an egress rule permitting UDP and TCP port 53 to the kube-dns Pods before applying any default-deny egress policy.",
    },
    {
      type: "callout",
      tone: "key",
      title: "The one rule every egress policy needs",
      text: "The moment you put Egress in a NetworkPolicy's policyTypes, that namespace denies all outbound traffic that is not explicitly allowed — and DNS is outbound traffic. Always pair a default-deny egress policy with an allow rule for UDP and TCP port 53 to CoreDNS, or nothing in the namespace will resolve a name.",
    },
    {
      type: "heading",
      id: "the-fix",
      text: "The fix: explicitly allow DNS egress",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "allow-dns egress policy",
      caption:
        "Apply this alongside any default-deny egress policy so Pods can always reach CoreDNS.",
      lines: [
        {
          code: "apiVersion: networking.k8s.io/v1",
        },
        {
          code: "kind: NetworkPolicy",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: allow-dns",
        },
        {
          code: "  namespace: payments",
          note: "policies are namespaced — this only affects Pods in payments",
        },
        {
          code: "spec:",
        },
        {
          code: "  podSelector: {}",
          note: "empty selector = applies to every Pod in the namespace",
        },
        {
          code: "  policyTypes:",
        },
        {
          code: "    - Egress",
          note: "this policy only adds egress allowances; it does not touch ingress",
        },
        {
          code: "  egress:",
        },
        {
          code: "    - to:",
        },
        {
          code: "        - namespaceSelector:",
          note: "target the kube-system namespace where CoreDNS runs",
        },
        {
          code: "            matchLabels:",
        },
        {
          code: "              kubernetes.io/metadata.name: kube-system",
          note: "auto-applied label on every namespace (1.21+) — reliable to select kube-system",
        },
        {
          code: "          podSelector:",
          note: "in the SAME peer object, so namespace AND pod are ANDed together",
        },
        {
          code: "            matchLabels:",
        },
        {
          code: "              k8s-app: kube-dns",
          note: "the label CoreDNS Pods carry — narrows egress to just the DNS Pods",
        },
        {
          code: "      ports:",
        },
        {
          code: "        - protocol: UDP",
          note: "the primary DNS transport — most queries go over UDP 53",
        },
        {
          code: "          port: 53",
        },
        {
          code: "        - protocol: TCP",
          note: "required too: large answers and zone transfers fall back to TCP 53",
        },
        {
          code: "          port: 53",
        },
      ],
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "Building the allow-dns rule in three stages",
      stages: [
        {
          label: "Skeleton (danger: deny-all)",
          note: "podSelector {} plus Egress in policyTypes. On its own this is a namespace-wide egress kill switch: it allows nothing outbound. Never ship this without an allow rule.",
          code: "apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-dns\n  namespace: payments\nspec:\n  podSelector: {}\n  policyTypes:\n    - Egress",
        },
        {
          label: "Point at CoreDNS",
          note: "Add an egress peer that selects the kube-dns Pods inside kube-system. namespaceSelector and podSelector in one peer object are ANDed, so this matches only CoreDNS.",
          code: "apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-dns\n  namespace: payments\nspec:\n  podSelector: {}\n  policyTypes:\n    - Egress\n  egress:\n    - to:\n        - namespaceSelector:\n            matchLabels:\n              kubernetes.io/metadata.name: kube-system\n          podSelector:\n            matchLabels:\n              k8s-app: kube-dns",
        },
        {
          label: "Open port 53 on both transports",
          note: "Allow UDP 53 (normal queries) and TCP 53 (large answers / retries). Omitting TCP causes intermittent failures that are painful to diagnose later.",
          code: "apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-dns\n  namespace: payments\nspec:\n  podSelector: {}\n  policyTypes:\n    - Egress\n  egress:\n    - to:\n        - namespaceSelector:\n            matchLabels:\n              kubernetes.io/metadata.name: kube-system\n          podSelector:\n            matchLabels:\n              k8s-app: kube-dns\n      ports:\n        - protocol: UDP\n          port: 53\n        - protocol: TCP\n          port: 53",
        },
      ],
    },
    {
      type: "heading",
      id: "amplifier",
      text: "The hidden amplifier: ndots and search domains",
    },
    {
      type: "paragraph",
      text: "Even after DNS egress was restored, the incident review found CoreDNS was running hot — far more queries than the traffic justified. The cause is how Kubernetes builds a Pod's /etc/resolv.conf. Each query name is expanded against a list of search domains, and the ndots option decides when. With ndots:5, any name containing fewer than 5 dots is first tried as a relative name against every search domain before it is ever tried as an absolute name. That is great for short in-cluster names but expensive for external ones.",
    },
    {
      type: "annotatedCode",
      language: "markdown",
      title: "A Pod's /etc/resolv.conf",
      caption:
        "Injected by the kubelet. The search list and ndots value drive how many lookups each name generates.",
      lines: [
        {
          code: "nameserver 10.96.0.10",
          note: "the cluster DNS ServiceIP (kube-dns) — all queries go here",
        },
        {
          code: "search payments.svc.cluster.local svc.cluster.local cluster.local",
          note: "suffixes tried, in order, for relative names — this is why 'web-svc' resolves",
        },
        {
          code: "options ndots:5",
          note: "names with fewer than 5 dots are tried against every search suffix FIRST, then as absolute",
        },
      ],
    },
    {
      type: "compare",
      caption:
        "For 'api.stripe.com' (2 dots, below ndots:5) each search suffix is tried first, so one external name becomes several failed lookups. A trailing dot forces a single absolute query.",
      left: {
        title: "Relative: api.stripe.com",
        code: "1) api.stripe.com.payments.svc.cluster.local -> NXDOMAIN\n2) api.stripe.com.svc.cluster.local          -> NXDOMAIN\n3) api.stripe.com.cluster.local              -> NXDOMAIN\n4) api.stripe.com                            -> answer\n# x2 for A + AAAA = 8 queries for one name",
      },
      right: {
        title: "Absolute: api.stripe.com.",
        code: "1) api.stripe.com   -> answer\n# trailing dot means ndots is ignored\n# 1 query (x2 for A + AAAA) — no wasted lookups",
      },
    },
    {
      type: "callout",
      tone: "warning",
      title: "ndots:5 multiplies external lookups",
      text: "Every external hostname with fewer than 5 dots generates one query per search domain before the real one — often 4x the traffic, doubled again for A and AAAA records. On a busy namespace this can push CoreDNS into throttling. Use a trailing dot on known-external names (api.stripe.com.) or lower ndots via dnsConfig for Pods that mostly talk to the internet.",
    },
    {
      type: "challenge",
      language: "yaml",
      title: "Tune ndots for an external-heavy workload",
      prompt:
        "The checkout Pod mostly calls external payment APIs and rarely uses short in-cluster names. Add a dnsConfig that lowers ndots to 2 so external names skip most search-domain expansion.",
      hint: "spec.dnsConfig.options is a list of { name, value } pairs, and value must be a string.",
      solution:
        'apiVersion: v1\nkind: Pod\nmetadata:\n  name: checkout\n  namespace: payments\nspec:\n  dnsConfig:\n    options:\n      - name: ndots\n        value: "2"\n  containers:\n    - name: checkout\n      image: klab/web-app:1.0.0',
    },
    {
      type: "heading",
      id: "prevention",
      text: "Prevention",
    },
    {
      type: "decisionTable",
      title: "Hardening cluster DNS",
      columns: ["What it does", "Watch out for"],
      rows: [
        {
          label: "Allow DNS in every egress policy",
          cells: [
            "Whitelists UDP/TCP 53 to kube-dns so default-deny never breaks resolution",
            "Easy to forget — bake it into policy templates and CI checks",
          ],
        },
        {
          label: "NodeLocal DNSCache",
          cells: [
            "Per-node caching DNS agent that answers most queries locally",
            "Cuts CoreDNS QPS and avoids conntrack races; needs a DaemonSet and resolv.conf wiring",
          ],
        },
        {
          label: "Lower ndots / use FQDNs",
          cells: [
            "Fewer wasted search-domain lookups for external names",
            "Too aggressive and short in-cluster names may stop resolving",
          ],
        },
        {
          label: "Autoscale CoreDNS",
          cells: [
            "Scales DNS replicas with cluster size so it is not a bottleneck",
            "Watch memory and cache size; pair with the cluster-proportional autoscaler",
          ],
        },
      ],
    },
    {
      type: "takeaways",
      items: [
        "Listing Egress in a NetworkPolicy's policyTypes makes the namespace deny outbound by default — forget UDP/TCP 53 to kube-dns and every name in the namespace stops resolving.",
        "Triage DNS and routing as separate layers: dig proves resolution, curl proves reachability. A timeout on dig points at drops (policy/CNI), NXDOMAIN points at a wrong name.",
        "ndots:5 turns each external hostname into a burst of search-domain lookups; a trailing dot or a lower ndots removes the waste.",
        "CoreDNS is a shared, cluster-wide dependency — cache it with NodeLocal DNSCache and scale it before it becomes a single point of failure.",
        "When failures feel cluster-wide and hit everything at once, suspect a shared layer (DNS, CNI, the API server) before blaming individual apps.",
      ],
    },
    {
      type: "quiz",
      id: "dns-outage-q1",
      question: "dig succeeds but curl returns 503. Which layer is most suspicious?",
      options: [
        {
          id: "a",
          text: "Service endpoints or backend readiness.",
          correct: true,
          explanation:
            "DNS already found the Service address, so the next layer is endpoint routing: check for zero endpoints or NotReady backend Pods.",
        },
        {
          id: "b",
          text: "The local shell prompt.",
          correct: false,
          explanation: "The prompt does not affect cluster routing.",
        },
        {
          id: "c",
          text: "The object metadata.uid.",
          correct: false,
          explanation: "UIDs identify objects but do not route traffic.",
        },
      ],
    },
    {
      type: "quiz",
      id: "dns-outage-q2",
      question:
        "Right after a NetworkPolicy rollout, every Pod in one namespace can no longer resolve any DNS name, while other namespaces are fine and CoreDNS is healthy. Most likely cause?",
      options: [
        {
          id: "a",
          text: "The policy enabled Egress but did not allow UDP/TCP 53 to kube-dns.",
          correct: true,
          explanation:
            "Enabling Egress flips the namespace to deny-by-default outbound; without an allow rule for port 53 to CoreDNS, every DNS query is dropped.",
        },
        {
          id: "b",
          text: "CoreDNS was deleted by the scheduler.",
          correct: false,
          explanation:
            "CoreDNS is healthy and other namespaces resolve fine, so the DNS service itself is up — the blast radius is one namespace.",
        },
        {
          id: "c",
          text: "The Service selector was changed.",
          correct: false,
          explanation:
            "A selector change affects which Pods a Service routes to, not whether names resolve. This failure is at the resolution layer, before routing.",
        },
      ],
    },
  ],
  labs: [],
};

export const DOCS_LESSONS: readonly DocsLesson[] = [
  whatIsKubernetes,
  clusterArchitecture,
  desiredVsActual,
  apiObjects,
  labelsAnnotationsOwnership,
  declarativeWorkflow,
  pods,
  deployments,
  replicaSets,
  statefulSets,
  daemonSets,
  jobs,
  podComposition,
  services,
  dns,
  ingress,
  serviceTypesGateway,
  logs,
  events,
  probes,
  kubectlDebugging,
  rollingUpdates,
  resourceManagement,
  namespaces,
  configuration,
  storage,
  accessControl,
  podSecurity,
  networkPolicies,
  scheduling,
  autoscaling,
  disruptionsAvailability,
  quotasLimitRanges,
  extendingKubernetes,
  serviceHadNoEndpoints,
  cpuThrottling,
  dnsOutage,
]
  .map(withOfficialSources)
  .map(parseLesson);

export function lessonHref(lesson: DocsLesson): string {
  return `/docs/${lesson.slug.join("/")}`;
}

export function getLessonBySlug(slug: string[]): DocsLesson | undefined {
  const key = slug.join("/");
  return DOCS_LESSONS.find((l) => l.slug.join("/") === key);
}

export const DEFAULT_LESSON_SLUG = desiredVsActual.slug;

/** Sections in display order, each with its lessons ordered by lesson.order. */
export interface DocsSection {
  title: string;
  lessons: DocsLesson[];
}

const SECTION_ORDER = [
  "Foundations",
  "Workloads",
  "Networking",
  "Observability & Debugging",
  "Operations",
  "Real Incidents",
];

export const DOCS_NAV: DocsSection[] = SECTION_ORDER.map((title) => ({
  title,
  lessons: DOCS_LESSONS.filter((l) => l.section === title).sort((a, b) => a.order - b.order),
})).filter((s) => s.lessons.length > 0);
