import { parseTemplate } from "@/lib/domain/schemas";
import type { PlaygroundTemplate } from "@/lib/domain/types";

/**
 * Playground starter templates. Each is validated against the Zod schema at module
 * load (build-time validation). Templates ship HEALTHY manifests so the cluster
 * reconciles cleanly: a never-Ready Deployment would make the simulator churn pods,
 * so probe paths point at the app's real endpoints.
 */

const WEB_IMAGE = { ref: "klab/web-app:1.0.0", description: "Web server: /healthz 200, / 200." };
const API_IMAGE = { ref: "klab/api:1.0.0", description: "Calls another Service by DNS name." };

const DEPLOYMENT = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp
  namespace: default
  labels:
    app: webapp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: webapp
  template:
    metadata:
      labels:
        app: webapp
    spec:
      containers:
        - name: webapp
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

const DEPLOYMENT_SERVICE = `apiVersion: v1
kind: Service
metadata:
  name: webapp-svc
  namespace: default
spec:
  selector:
    app: webapp
  ports:
    - name: http
      port: 80
      targetPort: 8080
`;

const POD = `apiVersion: v1
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

const POD_SERVICE = `apiVersion: v1
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

const PROBES_POD = `apiVersion: v1
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
      # readiness gates traffic; liveness restarts the container. Try pointing
      # readiness at /readyz (which this app answers 404) and re-applying.
      readinessProbe:
        httpGet:
          path: /healthz
          port: 8080
        initialDelaySeconds: 1
        periodSeconds: 3
      livenessProbe:
        httpGet:
          path: /healthz
          port: 8080
        initialDelaySeconds: 5
        periodSeconds: 10
`;

const NAMESPACE = `apiVersion: v1
kind: Namespace
metadata:
  name: team-a
`;

const NAMESPACE_POD = `apiVersion: v1
kind: Pod
metadata:
  name: web
  namespace: team-a
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

const DNS_BACKEND = `apiVersion: v1
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
---
apiVersion: v1
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

const DNS_CLIENT = `apiVersion: v1
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
          value: http://web-svc.default.svc.cluster.local/
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

const EMPTY_FILE = `# Empty cluster: only the control plane is running.
# Add manifests here (or open a template from the sidebar) and click Apply.
#
# Try:
#   apiVersion: v1
#   kind: Pod
#   metadata: { name: web, labels: { app: web } }
#   spec:
#     containers:
#       - name: web
#         image: klab/web-app:1.0.0
#         ports: [{ containerPort: 8080 }]
`;

const RAW_TEMPLATES: PlaygroundTemplate[] = [
  {
    id: "empty",
    title: "Empty Cluster",
    description: "A running control plane and nothing else. Start from scratch.",
    concepts: ["reconciliation"],
    files: [{ path: "manifest.yaml", language: "yaml", initialValue: EMPTY_FILE }],
    initialManifests: [],
    registeredImages: [WEB_IMAGE],
  },
  {
    id: "pod-service",
    title: "Pod + Service",
    description: "A single Pod exposed by a Service. The simplest routable workload.",
    concepts: ["pods", "services", "endpointslices", "labels-selectors"],
    files: [
      { path: "pod.yaml", language: "yaml", initialValue: POD },
      { path: "service.yaml", language: "yaml", initialValue: POD_SERVICE },
    ],
    initialManifests: [],
    registeredImages: [WEB_IMAGE],
  },
  {
    id: "deployment-service",
    title: "Deployment + Service",
    description:
      "A Deployment managing replicas behind a Service. Scale it, then break the selector and watch endpoints drop.",
    concepts: ["deployments", "replicasets", "services", "labels-selectors", "endpointslices"],
    files: [
      { path: "deployment.yaml", language: "yaml", initialValue: DEPLOYMENT },
      { path: "service.yaml", language: "yaml", initialValue: DEPLOYMENT_SERVICE },
    ],
    initialManifests: [],
    registeredImages: [WEB_IMAGE],
  },
  {
    id: "probes",
    title: "Readiness / Liveness Probes",
    description:
      "A Pod with both probes. Experiment: point readiness at /readyz (404) and re-apply to see it go NotReady.",
    concepts: ["readiness-probes", "liveness-probes", "pods", "debugging"],
    files: [{ path: "pod.yaml", language: "yaml", initialValue: PROBES_POD }],
    initialManifests: [],
    registeredImages: [WEB_IMAGE],
  },
  {
    id: "namespaces",
    title: "Namespaces",
    description: "Create a namespace and place a workload in it. Try `kubectl get pods -n team-a`.",
    concepts: ["namespaces", "pods"],
    files: [
      { path: "namespace.yaml", language: "yaml", initialValue: NAMESPACE },
      { path: "pod.yaml", language: "yaml", initialValue: NAMESPACE_POD },
    ],
    initialManifests: [],
    registeredImages: [WEB_IMAGE],
  },
  {
    id: "dns",
    title: "DNS / Service Discovery",
    description:
      "An api Pod calls web-svc by its DNS name. curl the api and watch it resolve and proxy.",
    concepts: ["dns", "services", "networking"],
    files: [
      { path: "backend.yaml", language: "yaml", initialValue: DNS_BACKEND },
      { path: "client.yaml", language: "yaml", initialValue: DNS_CLIENT },
    ],
    initialManifests: [],
    registeredImages: [WEB_IMAGE, API_IMAGE],
  },
];

/** All templates, validated at module load. */
export const PLAYGROUND_TEMPLATES: readonly PlaygroundTemplate[] = RAW_TEMPLATES.map(parseTemplate);

export const DEFAULT_TEMPLATE_ID = "deployment-service";

export function getTemplateById(id: string): PlaygroundTemplate | undefined {
  return PLAYGROUND_TEMPLATES.find((t) => t.id === id);
}
