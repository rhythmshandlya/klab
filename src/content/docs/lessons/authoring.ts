import { parseLesson } from "@/lib/domain/schemas";
import type { DocsBlock, DocsLesson, KubernetesConcept } from "@/lib/domain/types";

/**
 * Interactive docs lessons. Content is intentionally typed data rather than MDX:
 * schema validation catches broken lessons at module load, routes are generated
 * from the same data, and labs can hand off directly into the playground.
 */

export const WEB_IMAGE = {
  ref: "klab/web-app:1.0.0",
  description: "Web server: /healthz 200, /readyz 404, / 200.",
};

export const WEB_V2_IMAGE = {
  ref: "klab/web-app:2.0.0",
  description: "Broken release: starts, but serves 500 everywhere.",
};

export const LEGACY_IMAGE = {
  ref: "klab/web-app:0.9.0",
  description: "Legacy build: /healthz 200 but / answers 500.",
};

export const API_IMAGE = {
  ref: "klab/api:1.0.0",
  description: "API that calls another service by DNS name.",
};

export const WORKER_IMAGE = {
  ref: "klab/worker:1.0.0",
  description: "Queue worker; exits unless DATABASE_URL is set.",
};

export const WEB_POD = `apiVersion: v1
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

export const WEB_SERVICE = `apiVersion: v1
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

export const WEB_SERVICE_BAD_SELECTOR = `apiVersion: v1
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

export const WEB_DEPLOYMENT = `apiVersion: apps/v1
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

export const API_POD = `apiVersion: v1
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

export const API_SERVICE = `apiVersion: v1
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

export const WORKER_POD_BROKEN = `apiVersion: v1
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

export const WEB_REPLICASET = `apiVersion: apps/v1
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

export const APP_CONFIGMAP = `apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: default
data:
  GREETING: "hello"
  LOG_LEVEL: "info"
`;

export const WEB_DEPLOYMENT_ENVFROM = `apiVersion: apps/v1
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

export const WEB_DEPLOYMENT_RESOURCES = `apiVersion: apps/v1
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

export const WEB_POD_BAD_PROBE = `apiVersion: v1
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

export const WEB_DEPLOYMENT_BAD_PROBE = WEB_DEPLOYMENT.replace("path: /healthz", "path: /readyz");

export const TEAM_A_NAMESPACE = `apiVersion: v1
kind: Namespace
metadata:
  name: team-a
`;

export const TEAM_B_NAMESPACE = `apiVersion: v1
kind: Namespace
metadata:
  name: team-b
`;

export const TEAM_A_POD = WEB_POD.replace("namespace: default", "namespace: team-a").replace(
  "name: web",
  "name: web-a",
);

export const TEAM_B_POD = WEB_POD.replace("namespace: default", "namespace: team-b").replace(
  "name: web",
  "name: web-b",
);

export const TEAM_A_SERVICE = WEB_SERVICE.replace("namespace: default", "namespace: team-a");
export const TEAM_B_SERVICE = WEB_SERVICE.replace("namespace: default", "namespace: team-b");

export function quiz(
  id: string,
  question: string,
  options: Extract<DocsBlock, { type: "quiz" }>["options"],
): DocsBlock {
  return { type: "quiz", id, question, options };
}

export function qOption(
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

/** Validate and enrich one authored section behind the Curriculum implementation. */
export function compileLessons(lessons: readonly DocsLesson[]): DocsLesson[] {
  return lessons.map(withOfficialSources).map(parseLesson);
}
