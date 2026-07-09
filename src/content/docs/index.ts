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

function terminalDemo(
  title: string,
  description: string,
  steps: Extract<DocsBlock, { type: "demo" }>["steps"],
): DocsBlock {
  return { type: "demo", title, description, steps };
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
  pods: { title: "Pods", href: "https://kubernetes.io/docs/concepts/workloads/pods/" },
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
  endpointslices: [OFFICIAL_SOURCES.endpointSlices],
  "labels-selectors": [OFFICIAL_SOURCES.objects],
  "readiness-probes": [OFFICIAL_SOURCES.probes],
  "liveness-probes": [OFFICIAL_SOURCES.probes],
  "startup-probes": [OFFICIAL_SOURCES.probes],
  dns: [OFFICIAL_SOURCES.dns],
  namespaces: [OFFICIAL_SOURCES.namespaces],
  rollouts: [OFFICIAL_SOURCES.deployments],
  events: [OFFICIAL_SOURCES.debugPods],
  logs: [OFFICIAL_SOURCES.logging, OFFICIAL_SOURCES.debugPods],
  resources: [OFFICIAL_SOURCES.resources],
  configmaps: [OFFICIAL_SOURCES.configmaps],
  secrets: [OFFICIAL_SOURCES.secrets],
  storage: [OFFICIAL_SOURCES.volumes, OFFICIAL_SOURCES.persistentVolumes],
  "service-accounts": [OFFICIAL_SOURCES.serviceAccounts],
  rbac: [OFFICIAL_SOURCES.rbac],
  "security-contexts": [OFFICIAL_SOURCES.securityContext],
  "network-policies": [OFFICIAL_SOURCES.networkPolicies],
  scheduling: [OFFICIAL_SOURCES.scheduling, OFFICIAL_SOURCES.taints],
  autoscaling: [OFFICIAL_SOURCES.autoscaling],
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
    { type: "heading", id: "mental-model", text: "The mental model" },
    {
      type: "paragraph",
      text: "Kubernetes lets you describe the application state you want: which containers should run, how many copies should exist, how traffic should reach them, and which signals mean they are healthy. The cluster then keeps working to make that state true.",
    },
    { type: "diagram", variant: "cluster-architecture", title: "Cluster building blocks" },
    {
      type: "steps",
      title: "What Kubernetes gives you",
      items: [
        {
          title: "Scheduling",
          text: "It decides which node should run each Pod based on available capacity and constraints.",
        },
        {
          title: "Self-healing",
          text: "It restarts failed containers and replaces missing workload replicas.",
        },
        {
          title: "Service discovery",
          text: "It gives changing Pods stable DNS names and virtual Service addresses.",
        },
        {
          title: "Rollouts",
          text: "It can move traffic from one Pod template to another without replacing everything at once.",
        },
      ],
    },
    quiz("what-is-kubernetes-q1", "Which statement best describes Kubernetes?", [
      qOption(
        "a",
        "A container image registry.",
        false,
        "Registries store images; Kubernetes runs and coordinates workloads.",
      ),
      qOption(
        "b",
        "A control plane that reconciles declared application state.",
        true,
        "Kubernetes stores desired state and runs controllers to make actual state match it.",
      ),
      qOption(
        "c",
        "A single Linux server with Docker installed.",
        false,
        "A cluster can include many machines and many control loops.",
      ),
    ]),
    {
      type: "takeaways",
      items: [
        "Kubernetes is declarative: you describe the goal, not every step.",
        "Pods run containers, Services route to Pods, and controllers keep workloads healthy.",
        "The most useful debugging habit is comparing desired state with actual state.",
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
    { type: "heading", id: "control-plane", text: "Control plane and worker nodes" },
    {
      type: "paragraph",
      text: "A Kubernetes cluster has a control plane that stores state and makes decisions, and worker nodes that run Pods. You usually interact with the API server; controllers, the scheduler, and kubelets do the ongoing work.",
    },
    {
      type: "diagram",
      variant: "cluster-architecture",
      caption: "Most kubectl commands talk to the API server, not directly to a node.",
    },
    terminalDemo(
      "Follow a Pod from YAML to node",
      "This is the sequence Kubernetes runs after you apply a Pod manifest.",
      [
        {
          label: "Submit",
          detail: "kubectl sends YAML to the API server, which validates and stores the object.",
          command: "kubectl apply -f pod.yaml",
          output: "pod/web configured",
        },
        {
          label: "Schedule",
          detail: "The scheduler watches for Pods with no nodeName and binds them to a node.",
          command: "kubectl get pod web -o yaml",
          output: "spec:\n  nodeName: node-1\nstatus:\n  phase: Running",
        },
        {
          label: "Run",
          detail:
            "The kubelet on that node starts containers and reports status back to the API server.",
        },
      ],
    ),
    quiz(
      "cluster-architecture-q1",
      "Which component writes Pod health and container state back to the API server?",
      [
        qOption(
          "a",
          "kubelet",
          true,
          "The kubelet runs on each node and reports observed Pod status.",
        ),
        qOption("b", "etcd", false, "etcd stores data but does not run Pods or health checks."),
        qOption("c", "kubectl", false, "kubectl is a client; it does not reconcile cluster state."),
      ],
    ),
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
    { type: "heading", id: "what-is-desired-state", text: "What is desired state?" },
    {
      type: "paragraph",
      text: "You never tell Kubernetes to start a container step by step. Instead you declare the desired state as an API object and submit it. Kubernetes stores that object and continuously compares it with the actual state of the cluster.",
    },
    {
      type: "diagram",
      variant: "control-loop",
      title: "Desired state meets actual state",
      caption: "Controllers repeat this loop continuously: observe, diff, act.",
    },
    { type: "heading", id: "reconciliation", text: "How reconciliation works" },
    {
      type: "concept",
      term: "Reconciliation loop",
      definition:
        "A controller observes the actual state, diffs it against the desired state, and takes actions to close the gap over and over.",
    },
    {
      type: "callout",
      tone: "key",
      title: "Key idea",
      text: "If actual state drifts from desired state, Kubernetes detects the difference and reconciles it back.",
    },
    { type: "heading", id: "try-it", text: "Try it" },
    {
      type: "paragraph",
      text: "Change replicas from 3 to 5 and apply. Watch the Deployment create more Pods until actual state matches the spec.",
    },
    { type: "lab", labId: "replicas" },
    quiz(
      "desired-q1",
      "A Deployment says replicas: 5, but only 3 Pods exist. What should happen next?",
      [
        qOption(
          "a",
          "The controller creates 2 more Pods.",
          true,
          "The Deployment and ReplicaSet controllers reconcile actual replicas toward desired replicas.",
        ),
        qOption(
          "b",
          "kubectl must manually start 2 containers.",
          false,
          "kubectl submits state; controllers do the ongoing work.",
        ),
        qOption(
          "c",
          "The Service changes its selector.",
          false,
          "Services route traffic but do not create workload replicas.",
        ),
      ],
    ),
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
    { type: "heading", id: "object-shape", text: "Object shape" },
    {
      type: "paragraph",
      text: "The most important object fields are metadata, spec, and status. You write metadata and spec. Kubernetes writes status as it observes the cluster.",
    },
    { type: "diagram", variant: "api-object", title: "Object anatomy" },
    {
      type: "compare",
      caption: "spec is your intent; status is Kubernetes reporting reality.",
      left: { title: "spec", code: "replicas: 3\nselector:\n  app: web" },
      right: { title: "status", code: "readyReplicas: 3\nconditions:\n  - Available" },
    },
    { type: "lab", labId: "object-labels" },
    quiz("api-object-q1", "Which field should your application manifest usually edit?", [
      qOption("a", "status", false, "Status is written by controllers and kubelets."),
      qOption("b", "spec", true, "Spec is the desired state you declare."),
      qOption(
        "c",
        "managedFields",
        false,
        "managedFields tracks ownership metadata; it is not the app intent.",
      ),
    ]),
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

const pods: DocsLesson = {
  slug: ["workloads", "pods"],
  title: "Pods",
  description:
    "A Pod is the smallest schedulable unit in Kubernetes. It wraps one or more containers with shared network and lifecycle.",
  section: "Workloads",
  order: 0,
  concepts: ["pods", "readiness-probes", "logs"],
  content: [
    { type: "heading", id: "pod-basics", text: "What a Pod contains" },
    {
      type: "paragraph",
      text: "A Pod usually runs one application container. Containers in the same Pod share the same network namespace, so they share localhost and ports. You normally manage Pods through controllers, but understanding Pods is required for debugging.",
    },
    { type: "diagram", variant: "pod", title: "Pod anatomy" },
    terminalDemo("Read Pod health", "When a Pod looks broken, inspect both phase and readiness.", [
      {
        label: "List Pods",
        detail: "READY counts containers that pass readiness, while STATUS is the lifecycle phase.",
        command: "kubectl get pods",
        output: "NAME   READY   STATUS    RESTARTS\nweb    1/1     Running   0",
      },
      {
        label: "Describe",
        detail: "Describe shows node placement, probes, events, labels, and recent failures.",
        command: "kubectl describe pod web",
      },
    ]),
    { type: "lab", labId: "pod-ready" },
    quiz("pods-q1", "Why can a Pod be Running but not Ready?", [
      qOption(
        "a",
        "The container process exists, but its readiness condition is failing.",
        true,
        "Running is lifecycle state; Ready controls whether it should receive traffic.",
      ),
      qOption("b", "It has no labels.", false, "Labels affect selection, not the Running phase."),
      qOption(
        "c",
        "It is managed by a Deployment.",
        false,
        "Managed Pods can still be Ready or NotReady.",
      ),
    ]),
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
    { type: "heading", id: "deployment-role", text: "What Deployments do" },
    {
      type: "paragraph",
      text: "A Deployment owns a desired Pod template, a replica count, and rollout strategy. It creates ReplicaSets, which create Pods. You update the Deployment, not each Pod.",
    },
    { type: "diagram", variant: "workload-hierarchy", title: "Deployment hierarchy" },
    { type: "lab", labId: "deployment-scale" },
    quiz("deployments-q1", "What should you edit to change the image for a stateless web app?", [
      qOption(
        "a",
        "Each existing Pod.",
        false,
        "Existing Pods are replaceable output of the controller.",
      ),
      qOption(
        "b",
        "The Deployment Pod template.",
        true,
        "The Deployment template is the desired state used to create new Pods.",
      ),
      qOption(
        "c",
        "The EndpointSlice.",
        false,
        "EndpointSlices are generated from Services and Ready Pods.",
      ),
    ]),
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
    { type: "heading", id: "selectors", text: "Selectors are ownership" },
    {
      type: "paragraph",
      text: "A ReplicaSet counts Pods that match its selector. If too few matching Pods exist, it creates more. If too many exist, it removes some. That makes labels and selectors operationally important.",
    },
    { type: "diagram", variant: "workload-hierarchy", title: "ReplicaSet under a Deployment" },
    terminalDemo(
      "ReplicaSet debugging",
      "ReplicaSet output explains whether the controller is able to create ready Pods.",
      [
        {
          label: "List ReplicaSets",
          detail:
            "DESIRED is the target count. READY shows how many matching Pods are actually ready.",
          command: "kubectl get rs",
          output:
            "NAME              DESIRED   CURRENT   READY\nweb-7d5f6b6c7     3         3         3",
        },
      ],
    ),
    quiz(
      "replicasets-q1",
      "What happens if a Service selector also matches an old orphaned ReplicaSet's Pods?",
      [
        qOption(
          "a",
          "The Service may send traffic to the old Pods.",
          true,
          "Services select by labels, not by Deployment ownership.",
        ),
        qOption(
          "b",
          "The API server blocks all traffic.",
          false,
          "The API server is not in the data path for Service traffic.",
        ),
        qOption(
          "c",
          "The scheduler deletes the old Pods.",
          false,
          "The scheduler places Pods; it does not decide service membership.",
        ),
      ],
    ),
  ],
  labs: [],
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
    { type: "heading", id: "identity", text: "Stable identity" },
    {
      type: "paragraph",
      text: "A StatefulSet gives each replica a stable ordinal name and stable storage identity. Use it when the application cares which replica it is, or when replicas must start and stop in order.",
    },
    {
      type: "steps",
      items: [
        { title: "Deployment", text: "Best for interchangeable stateless replicas." },
        { title: "StatefulSet", text: "Best for stable network identity and per-replica storage." },
        {
          title: "Headless Service",
          text: "Often used so each StatefulSet Pod gets a stable DNS record.",
        },
        {
          title: "Operational warning",
          text: "Storage and identity make rollbacks and deletes more sensitive.",
        },
      ],
    },
    quiz("statefulsets-q1", "When should you prefer a StatefulSet over a Deployment?", [
      qOption(
        "a",
        "When each replica needs stable identity or storage.",
        true,
        "That is the main StatefulSet use case.",
      ),
      qOption(
        "b",
        "Whenever an app has HTTP traffic.",
        false,
        "HTTP stateless apps are usually Deployments.",
      ),
      qOption(
        "c",
        "Only when a Service has no endpoints.",
        false,
        "Endpoint problems are usually selector or readiness issues.",
      ),
    ]),
    {
      type: "takeaways",
      items: [
        "StatefulSet Pods are not interchangeable in the same way Deployment Pods are.",
        "Be careful with deletes because persistent storage can outlive Pods.",
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
    { type: "heading", id: "node-agents", text: "Node-level agents" },
    {
      type: "paragraph",
      text: "Use DaemonSets for log collectors, monitoring agents, storage plugins, and network components that must run on each node. They are scheduled around nodes rather than application replica count.",
    },
    terminalDemo(
      "DaemonSet inspection",
      "The important question is whether every expected node has the agent Pod.",
      [
        {
          label: "Check desired vs ready",
          detail: "kubectl shows desired, current, ready, and available counts.",
          command: "kubectl get daemonset -n kube-system",
          output: "NAME          DESIRED   CURRENT   READY\nlog-agent     3         3         3",
        },
        {
          label: "Debug missing nodes",
          detail:
            "When a node is missing an agent, inspect node selectors, tolerations, and events.",
        },
      ],
    ),
    quiz("daemonsets-q1", "What is a common DaemonSet use case?", [
      qOption(
        "a",
        "A per-node log collector.",
        true,
        "Infrastructure agents often need one Pod per node.",
      ),
      qOption("b", "A web app scaled to user traffic.", false, "That is usually a Deployment."),
      qOption("c", "A one-time database migration.", false, "That is usually a Job."),
    ]),
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
    { type: "heading", id: "completion", text: "Run-to-completion workloads" },
    {
      type: "paragraph",
      text: "Deployments keep Pods running forever. Jobs expect Pods to finish successfully. CronJobs create Jobs on a schedule and need careful concurrency and failure settings.",
    },
    {
      type: "steps",
      items: [
        { title: "Job", text: "Use for migrations, batch processing, and one-off tasks." },
        { title: "CronJob", text: "Use for scheduled recurring tasks such as cleanup or reports." },
        {
          title: "backoffLimit",
          text: "Controls how many failures Kubernetes retries before marking the Job failed.",
        },
        { title: "concurrencyPolicy", text: "Controls whether scheduled runs can overlap." },
      ],
    },
    quiz("jobs-q1", "What should you use for a database migration that must finish once?", [
      qOption("a", "Job", true, "A Job tracks completion and retry behavior."),
      qOption("b", "DaemonSet", false, "DaemonSets run node agents continuously."),
      qOption("c", "Service", false, "Services route traffic; they do not run work."),
    ]),
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
    {
      type: "concept",
      term: "Selector to EndpointSlice",
      definition:
        "The EndpointSlice controller watches Pods matching a Service selector and publishes the Ready Pod IPs as endpoints.",
    },
    { type: "lab", labId: "service-selector" },
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
    { type: "heading", id: "service-dns", text: "Service DNS names" },
    {
      type: "paragraph",
      text: "Inside a cluster, a Service can be reached by short name in the same namespace, or by a fully qualified name across namespaces. DNS gets you to the Service; endpoints still determine whether traffic succeeds.",
    },
    {
      type: "code",
      language: "markdown",
      code: "same namespace:  http://web-svc/\nother namespace: http://web-svc.default.svc.cluster.local/",
    },
    { type: "diagram", variant: "service-routing", title: "DNS plus Service routing" },
    { type: "lab", labId: "dns-chain" },
    quiz("dns-q1", "What does Service DNS resolve to?", [
      qOption(
        "a",
        "The Service's stable cluster address.",
        true,
        "DNS finds the Service. EndpointSlices then decide backend Pod IPs.",
      ),
      qOption(
        "b",
        "A random Pod name.",
        false,
        "Services provide stable names instead of direct Pod names.",
      ),
      qOption(
        "c",
        "Only external public IPs.",
        false,
        "Cluster DNS primarily resolves in-cluster Service names.",
      ),
    ]),
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
    { type: "heading", id: "north-south", text: "North-south HTTP routing" },
    {
      type: "paragraph",
      text: "Ingress is an API object for HTTP routing at the edge of the cluster. It does not send traffic directly to Pods. An ingress controller reads Ingress rules and forwards requests to Services.",
    },
    {
      type: "steps",
      items: [
        { title: "Host", text: "example.com selects a virtual host." },
        { title: "Path", text: "/api routes to one Service while / routes to another." },
        { title: "Service", text: "The backend Service still needs ready endpoints." },
        {
          title: "Controller",
          text: "An ingress controller must be installed for rules to take effect.",
        },
      ],
    },
    quiz(
      "ingress-q1",
      "If an Ingress rule points to a Service with zero endpoints, what happens?",
      [
        qOption(
          "a",
          "The request still fails at the backend.",
          true,
          "Ingress can route to a Service, but the Service still needs ready endpoints.",
        ),
        qOption(
          "b",
          "Kubernetes creates Pods automatically.",
          false,
          "Ingress does not create workload replicas.",
        ),
        qOption(
          "c",
          "DNS is no longer needed.",
          false,
          "External DNS and cluster DNS still matter at different layers.",
        ),
      ],
    ),
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
    { type: "heading", id: "process-output", text: "Use logs for process truth" },
    {
      type: "paragraph",
      text: "When a Pod restarts or serves errors, logs often reveal the application cause. Pair logs with describe output: logs explain the process, events explain the platform reaction.",
    },
    terminalDemo(
      "CrashLoop workflow",
      "The shortest CrashLoop investigation is status, logs, then events.",
      [
        {
          label: "See restarts",
          detail: "A high restart count means the process exits repeatedly.",
          command: "kubectl get pods",
          output:
            "NAME      READY   STATUS             RESTARTS\nworker    0/1     CrashLoopBackOff   4",
        },
        {
          label: "Read logs",
          detail: "Application logs usually explain why the process exited.",
          command: "kubectl logs worker",
          output: "FATAL: DATABASE_URL is not set",
        },
      ],
    ),
    { type: "lab", labId: "worker-logs" },
    quiz("logs-q1", "What should you inspect first when a container exits repeatedly?", [
      qOption(
        "a",
        "The container logs.",
        true,
        "Logs often contain the application-level exit reason.",
      ),
      qOption(
        "b",
        "Only the Service selector.",
        false,
        "Selectors matter for traffic, not why the process exits.",
      ),
      qOption("c", "Only the Ingress host.", false, "Ingress is outside the Pod lifecycle."),
    ]),
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
    { type: "heading", id: "timeline", text: "Events are the platform timeline" },
    {
      type: "paragraph",
      text: "Events answer what Kubernetes tried to do and why it failed or succeeded. They are especially useful for scheduling problems, probe failures, image errors, and restarts.",
    },
    terminalDemo("Read recent events", "Sort events by timestamp when reconstructing a failure.", [
      {
        label: "List recent events",
        detail: "Look for repeated warning reasons tied to the same object.",
        command: "kubectl get events --sort-by=.lastTimestamp",
        output:
          "LAST SEEN   TYPE      REASON      OBJECT\n5s          Warning   Unhealthy   Pod/web",
      },
      {
        label: "Connect to YAML",
        detail:
          "If the event says readiness probe failed, inspect the readinessProbe section in the manifest.",
      },
    ]),
    quiz("events-q1", "What do Kubernetes Events help reconstruct?", [
      qOption(
        "a",
        "The platform's recent decisions and failures.",
        true,
        "Events are a time-ordered record of cluster actions.",
      ),
      qOption(
        "b",
        "The full application database.",
        false,
        "Events are not application data storage.",
      ),
      qOption(
        "c",
        "The source code diff.",
        false,
        "Events explain runtime behavior, not source control.",
      ),
    ]),
  ],
  labs: [],
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
    { type: "heading", id: "readiness-vs-liveness", text: "Readiness vs liveness" },
    { type: "diagram", variant: "probe-gates", title: "Probe gates" },
    {
      type: "callout",
      tone: "warning",
      title: "Common trap",
      text: "Do not use liveness as a dependency check. Restarting a healthy process because a dependency is slow can turn a partial outage into a restart storm.",
    },
    { type: "lab", labId: "readiness" },
    quiz("probes-q1", "Which probe removes a Pod from Service endpoints without restarting it?", [
      qOption("a", "Readiness", true, "Readiness gates traffic."),
      qOption("b", "Liveness", false, "Liveness restarts containers after repeated failures."),
      qOption("c", "DNS", false, "DNS resolves names; it is not a health probe."),
    ]),
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
    { type: "heading", id: "debug-loop", text: "A practical debug loop" },
    { type: "diagram", variant: "debug-loop", title: "Investigation loop" },
    {
      type: "steps",
      items: [
        {
          title: "Start broad",
          text: "kubectl get pods, svc, deploy, endpoints to find what is visibly wrong.",
        },
        {
          title: "Describe the object",
          text: "kubectl describe shows selectors, probes, events, and ownership.",
        },
        {
          title: "Check behavior",
          text: "Use curl or the network probe to confirm what users experience.",
        },
        {
          title: "Patch minimally",
          text: "Change the smallest YAML field that explains the evidence.",
        },
      ],
    },
    quiz("kubectl-debugging-q1", "Why should you run kubectl describe after kubectl get?", [
      qOption(
        "a",
        "describe adds events and detailed fields that table output hides.",
        true,
        "Table output is a summary; describe gives the failure context.",
      ),
      qOption("b", "describe automatically fixes the object.", false, "describe is read-only."),
      qOption("c", "describe deletes failed Pods.", false, "describe does not mutate resources."),
    ]),
  ],
  labs: [],
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
    { type: "heading", id: "rollout-flow", text: "How a rollout moves" },
    {
      type: "paragraph",
      text: "When you change a Deployment Pod template, Kubernetes creates a new ReplicaSet and scales it up while scaling the old one down. Readiness determines when new Pods are safe to count as available.",
    },
    { type: "diagram", variant: "rollout", title: "Old ReplicaSet to new ReplicaSet" },
    { type: "lab", labId: "rollout-image" },
    quiz("rollouts-q1", "What creates the new ReplicaSet during a Deployment update?", [
      qOption(
        "a",
        "The Deployment controller.",
        true,
        "Deployment reconciliation creates and scales ReplicaSets for rollouts.",
      ),
      qOption(
        "b",
        "The Service controller.",
        false,
        "Services publish endpoints but do not manage rollout history.",
      ),
      qOption("c", "The DNS server.", false, "DNS resolves names; it does not create ReplicaSets."),
    ]),
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
    { type: "heading", id: "requests-limits", text: "Requests and limits" },
    {
      type: "paragraph",
      text: "Requests tell the scheduler how much capacity a Pod needs. Limits cap how much it may use at runtime. Bad values can cause Pending Pods, throttling, or evictions.",
    },
    {
      type: "code",
      language: "yaml",
      code: "resources:\n  requests:\n    cpu: 100m\n    memory: 128Mi\n  limits:\n    cpu: 500m\n    memory: 256Mi",
    },
    {
      type: "steps",
      items: [
        { title: "Too low", text: "CPU limits that are too low can throttle a busy app." },
        { title: "Too high", text: "Requests that are too high can keep Pods Pending." },
        {
          title: "Missing",
          text: "No requests makes capacity planning and scheduling less predictable.",
        },
        {
          title: "Debug",
          text: "Use events and metrics to separate scheduling failure from app failure.",
        },
      ],
    },
    quiz("resources-q1", "What do CPU requests primarily influence?", [
      qOption(
        "a",
        "Scheduling decisions.",
        true,
        "The scheduler uses requests to decide whether a node has enough capacity.",
      ),
      qOption("b", "Service DNS names.", false, "DNS names are independent of CPU requests."),
      qOption(
        "c",
        "ReplicaSet names only.",
        false,
        "ReplicaSet names come from workload templates and hashes.",
      ),
    ]),
  ],
  labs: [],
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
    { type: "heading", id: "scope", text: "Namespace scope" },
    {
      type: "paragraph",
      text: "Most names are unique only inside one namespace. A Service called api-svc can exist in team-a and team-b at the same time. Cross-namespace access should use a fully qualified Service name.",
    },
    { type: "diagram", variant: "namespace-boundary", title: "Two namespaces, same local names" },
    { type: "lab", labId: "namespace-dns" },
    quiz("namespaces-q1", "How should a Pod in team-a call web-svc in team-b?", [
      qOption(
        "a",
        "http://web-svc.team-b.svc.cluster.local/",
        true,
        "The namespace segment disambiguates the Service.",
      ),
      qOption(
        "b",
        "http://web-svc/",
        false,
        "Short names resolve in the caller's namespace first.",
      ),
      qOption("c", "http://team-b/", false, "The namespace name alone is not a Service address."),
    ]),
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
    { type: "heading", id: "externalize-config", text: "Externalize configuration" },
    {
      type: "paragraph",
      text: "ConfigMaps store non-confidential configuration data such as flags, URLs, and file content. Secrets are the Kubernetes API object for sensitive data, but you still need cluster-level encryption, access control, and careful handling.",
    },
    {
      type: "compare",
      caption:
        "ConfigMap is for ordinary config. Secret is for sensitive config with tighter access rules.",
      left: {
        title: "ConfigMap",
        code: "kind: ConfigMap\ndata:\n  FEATURE_FLAG: enabled\n  API_URL: http://api-svc/",
      },
      right: {
        title: "Secret",
        code: "kind: Secret\ntype: Opaque\nstringData:\n  DATABASE_URL: postgres://...",
      },
    },
    {
      type: "steps",
      items: [
        {
          title: "Mount or env",
          text: "Config can enter a container as environment variables or mounted files.",
        },
        {
          title: "Restart behavior",
          text: "Environment variables are fixed when the container starts; mounted files can update differently depending on the setup.",
        },
        {
          title: "Least privilege",
          text: "Do not let every workload read every Secret. Scope access with RBAC and service accounts.",
        },
        {
          title: "Audit drift",
          text: "When behavior differs from YAML, compare the live Pod env, mounted config, and expected object.",
        },
      ],
    },
    quiz("configuration-q1", "Where should a non-sensitive feature flag usually live?", [
      qOption(
        "a",
        "ConfigMap",
        true,
        "ConfigMaps are intended for non-confidential configuration data.",
      ),
      qOption("b", "EndpointSlice", false, "EndpointSlices publish Service backends."),
      qOption("c", "Pod status", false, "Status is written by Kubernetes, not used as app config."),
    ]),
  ],
  labs: [],
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
    { type: "heading", id: "pod-storage", text: "Pod storage model" },
    {
      type: "paragraph",
      text: "Containers are replaceable. A plain container filesystem disappears with the container. Kubernetes Volumes provide storage that can be shared by containers in a Pod, and PersistentVolumes provide cluster storage that can outlive a Pod.",
    },
    {
      type: "steps",
      items: [
        {
          title: "Volume",
          text: "A directory made available to containers in a Pod. Lifetime depends on the volume type.",
        },
        {
          title: "PersistentVolume",
          text: "A cluster resource representing durable storage provisioned statically or dynamically.",
        },
        {
          title: "PersistentVolumeClaim",
          text: "A user's request for storage with size, access mode, and storage class needs.",
        },
        {
          title: "StatefulSet",
          text: "Often pairs with volume claim templates to give each replica stable storage.",
        },
      ],
    },
    {
      type: "code",
      language: "yaml",
      code: "apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: data\nspec:\n  accessModes: [ReadWriteOnce]\n  resources:\n    requests:\n      storage: 1Gi",
    },
    quiz("storage-q1", "Why should a database not rely only on a container filesystem?", [
      qOption(
        "a",
        "The filesystem is tied to a replaceable container lifecycle.",
        true,
        "Durable state needs a volume/PV model appropriate to the workload.",
      ),
      qOption(
        "b",
        "Services cannot route to databases.",
        false,
        "Services can route to database Pods, but routing is separate from persistence.",
      ),
      qOption(
        "c",
        "Pods cannot mount any files.",
        false,
        "Pods can mount volumes; the key is choosing the right storage lifetime.",
      ),
    ]),
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
    { type: "heading", id: "identity-and-permission", text: "Identity and permission" },
    {
      type: "paragraph",
      text: "A service account gives a Pod an identity for talking to the Kubernetes API. RBAC then grants permissions through Roles, ClusterRoles, RoleBindings, and ClusterRoleBindings.",
    },
    {
      type: "steps",
      items: [
        { title: "ServiceAccount", text: "The workload identity mounted into a Pod." },
        { title: "Role", text: "Permissions scoped to a namespace." },
        {
          title: "ClusterRole",
          text: "Permissions that can apply cluster-wide or be reused in namespaces.",
        },
        { title: "Binding", text: "Connects a subject, such as a service account, to a role." },
      ],
    },
    {
      type: "code",
      language: "yaml",
      code: 'kind: Role\nrules:\n  - apiGroups: [""]\n    resources: ["pods"]\n    verbs: ["get", "list"]',
    },
    quiz("rbac-q1", "What does a RoleBinding do?", [
      qOption(
        "a",
        "Grants a Role or ClusterRole to a subject.",
        true,
        "Bindings connect permissions to users, groups, or service accounts.",
      ),
      qOption(
        "b",
        "Creates a Pod network route.",
        false,
        "Network routing is handled by Services and networking components.",
      ),
      qOption(
        "c",
        "Stores application passwords.",
        false,
        "Secrets store sensitive values; RBAC controls API access.",
      ),
    ]),
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
    { type: "heading", id: "runtime-constraints", text: "Runtime constraints" },
    {
      type: "paragraph",
      text: "Security context settings let you run containers as non-root users, drop Linux capabilities, prevent privilege escalation, and make root filesystems read-only. These settings reduce blast radius when application code is compromised.",
    },
    {
      type: "code",
      language: "yaml",
      code: 'securityContext:\n  runAsNonRoot: true\n  allowPrivilegeEscalation: false\n  readOnlyRootFilesystem: true\n  capabilities:\n    drop: ["ALL"]',
    },
    {
      type: "callout",
      tone: "info",
      title: "Operational habit",
      text: "Start restrictive, then intentionally allow only what the workload proves it needs.",
    },
    quiz(
      "pod-security-q1",
      "Which setting helps prevent a container process from becoming root through privilege escalation?",
      [
        qOption(
          "a",
          "allowPrivilegeEscalation: false",
          true,
          "This is one of the core security context hardening options.",
        ),
        qOption("b", "replicas: 3", false, "Replica count changes scale, not process privileges."),
        qOption("c", "targetPort: 8080", false, "targetPort controls Service routing."),
      ],
    ),
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
    { type: "heading", id: "traffic-rules", text: "Pod traffic rules" },
    {
      type: "paragraph",
      text: "A NetworkPolicy selects Pods and defines allowed ingress or egress. Policies are label-driven, and enforcement depends on the cluster networking implementation supporting NetworkPolicy.",
    },
    {
      type: "code",
      language: "yaml",
      code: "kind: NetworkPolicy\nspec:\n  podSelector:\n    matchLabels:\n      app: api\n  policyTypes: [Ingress]\n  ingress:\n    - from:\n        - podSelector:\n            matchLabels:\n              app: web",
    },
    quiz("network-policy-q1", "What does a NetworkPolicy select?", [
      qOption(
        "a",
        "Pods, using label selectors.",
        true,
        "NetworkPolicies are label-selector based.",
      ),
      qOption("b", "Only nodes by name.", false, "Pod selection is the core object model here."),
      qOption(
        "c",
        "Only external DNS records.",
        false,
        "NetworkPolicies govern traffic rules, not DNS registration.",
      ),
    ]),
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
    { type: "heading", id: "placement", text: "Placement decisions" },
    {
      type: "paragraph",
      text: "The scheduler watches for Pods that need a node, filters feasible nodes, scores them, and binds the Pod to a node. Requests, node selectors, affinity, taints, and tolerations all affect placement.",
    },
    {
      type: "steps",
      items: [
        { title: "Requests", text: "Reserve capacity and influence whether a node is feasible." },
        { title: "Node selector", text: "Require simple node labels." },
        { title: "Affinity", text: "Express richer required or preferred placement rules." },
        {
          title: "Taints and tolerations",
          text: "Repel Pods from nodes unless they explicitly tolerate the taint.",
        },
      ],
    },
    quiz("scheduling-q1", "What does a taint do?", [
      qOption(
        "a",
        "Repels Pods that do not have a matching toleration.",
        true,
        "Taints are applied to nodes; tolerations let Pods schedule there.",
      ),
      qOption(
        "b",
        "Creates a Service endpoint.",
        false,
        "Endpoint membership comes from Services and Ready Pods.",
      ),
      qOption("c", "Stores a Secret value.", false, "Secrets store sensitive data."),
    ]),
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
    { type: "heading", id: "hpa", text: "Horizontal Pod Autoscaling" },
    {
      type: "paragraph",
      text: "The HorizontalPodAutoscaler adjusts the desired replica count of a scalable workload based on metrics such as CPU utilization. It does not make individual Pods faster; it changes how many replicas should run.",
    },
    {
      type: "compare",
      caption: "HPA changes desired replicas; the Deployment controller still creates Pods.",
      left: { title: "metric", code: "cpu average: 85%\ntarget: 60%" },
      right: { title: "action", code: "replicas: 3 -> 5\nDeployment reconciles" },
    },
    quiz("autoscaling-q1", "What does HPA usually change on a Deployment?", [
      qOption(
        "a",
        "The desired replica count.",
        true,
        "HPA writes a new scale target; controllers reconcile the Pods.",
      ),
      qOption(
        "b",
        "The container image registry.",
        false,
        "HPA is not an image rollout mechanism.",
      ),
      qOption(
        "c",
        "The Service DNS name.",
        false,
        "Replica count and Service DNS are separate concerns.",
      ),
    ]),
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
    { type: "heading", id: "incident-pattern", text: "Incident pattern" },
    {
      type: "paragraph",
      text: "A Service with no endpoints is not a networking mystery at first. It means the EndpointSlice controller could not publish any Ready matching Pods for that Service.",
    },
    { type: "diagram", variant: "service-routing", title: "Where the path breaks" },
    terminalDemo("Triage sequence", "Run these in order to avoid guessing.", [
      {
        label: "Check endpoints",
        detail: "Confirm whether the Service has backends.",
        command: "kubectl get endpoints web-svc",
        output: "NAME      ENDPOINTS\nweb-svc   <none>",
      },
      {
        label: "Describe Service",
        detail: "Read the selector and compare it to Pod labels.",
        command: "kubectl describe svc web-svc",
      },
      {
        label: "Check Pod readiness",
        detail: "Matching Pods are not enough; they must be Ready.",
        command: "kubectl get pods",
      },
    ]),
    quiz(
      "no-endpoints-q1",
      "Which two facts are required for a Pod to become a Service endpoint?",
      [
        qOption(
          "a",
          "It must match the selector and be Ready.",
          true,
          "EndpointSlices contain matching ready backends.",
        ),
        qOption(
          "b",
          "It must have the same name as the Service.",
          false,
          "Services select by labels, not by Pod name.",
        ),
        qOption(
          "c",
          "It must run in kube-system.",
          false,
          "Application Services usually run in application namespaces.",
        ),
      ],
    ),
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
    { type: "heading", id: "symptoms", text: "Symptoms" },
    {
      type: "paragraph",
      text: "CPU throttling often appears as high latency, timeouts, and failing probes even when the process is technically running. The fix is not always more replicas; sometimes each Pod is under-provisioned.",
    },
    {
      type: "steps",
      items: [
        { title: "Confirm user symptom", text: "Requests are slow or timing out." },
        { title: "Check probes", text: "Probe failures may be a symptom of starvation." },
        {
          title: "Inspect limits",
          text: "Look for limits much lower than observed workload needs.",
        },
        {
          title: "Change carefully",
          text: "Raise limits or optimize work, then verify latency and readiness.",
        },
      ],
    },
    quiz("cpu-q1", "Why can a very low CPU limit cause readiness failures?", [
      qOption(
        "a",
        "The app may not get enough CPU time to answer probes quickly.",
        true,
        "Probe timeouts can happen when the process is starved.",
      ),
      qOption(
        "b",
        "The Service selector is deleted automatically.",
        false,
        "CPU limits do not mutate Service selectors.",
      ),
      qOption(
        "c",
        "DNS stops resolving all Services.",
        false,
        "CPU throttling is a runtime resource issue.",
      ),
    ]),
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
    { type: "heading", id: "separate-layers", text: "Separate DNS from routing" },
    {
      type: "paragraph",
      text: "DNS answers the question: what Service address does this name map to? Endpoint routing answers: which Ready Pods back that Service? Debug those layers separately.",
    },
    { type: "diagram", variant: "debug-loop", title: "DNS incident loop" },
    terminalDemo("Layered DNS triage", "Use dig before curl when a name might be wrong.", [
      {
        label: "Resolve",
        detail: "If dig fails, the name or namespace is wrong.",
        command: "dig web-svc",
        output: "web-svc.default.svc.cluster.local  30  IN  A  10.96.0.12",
      },
      {
        label: "Route",
        detail: "If dig succeeds but curl fails, inspect Service endpoints and the app.",
        command: "curl http://web-svc/",
        output: "HTTP 200\nHello from klab.",
      },
    ]),
    quiz("dns-outage-q1", "dig succeeds but curl returns 503. Which layer is most suspicious?", [
      qOption(
        "a",
        "Service endpoints or backend readiness.",
        true,
        "DNS found the Service, so next inspect endpoint routing.",
      ),
      qOption("b", "The local shell prompt.", false, "The prompt does not affect cluster routing."),
      qOption(
        "c",
        "The object metadata.uid.",
        false,
        "UIDs identify objects but do not route traffic.",
      ),
    ]),
  ],
  labs: [],
};

export const DOCS_LESSONS: readonly DocsLesson[] = [
  whatIsKubernetes,
  clusterArchitecture,
  desiredVsActual,
  apiObjects,
  pods,
  deployments,
  replicaSets,
  statefulSets,
  daemonSets,
  jobs,
  services,
  dns,
  ingress,
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
