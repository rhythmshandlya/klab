/**
 * Canonical solutions for every level, keyed by slug: the editable files as a learner
 * would leave them after the intended fix. Consumed by the level solvability
 * integration test (broken state must fail validation; this state must pass), and
 * doubling as reviewable documentation of each level's intended fix. Nothing in the
 * app imports this module, so it never reaches the client bundle.
 */

import { ARCHITECTURE_BUILD_SOLUTIONS } from "./architecture";
import { PRODUCTION_REPAIR_SOLUTIONS } from "./production-repairs";

export interface LevelSolution {
  /** Editable file contents after the intended fix, keyed by file path. */
  files: Record<string, string>;
  /** One-line description of the fix, for test failure messages. */
  fix: string;
}

export const LEVEL_SOLUTIONS: Record<string, LevelSolution> = {
  ...Object.fromEntries(
    Object.entries(PRODUCTION_REPAIR_SOLUTIONS).map(([slug, files]) => [
      slug,
      { fix: "Satisfy the incident's production manifest requirements", files },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(ARCHITECTURE_BUILD_SOLUTIONS).map(([slug, files]) => [
      slug,
      { fix: "Complete the reference architecture and satisfy every production gate", files },
    ]),
  ),
  "recreate-strategy-outage": {
    fix: "Switch the Deployment strategy from Recreate to RollingUpdate with maxUnavailable 0",
    files: {
      "deployment.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout
  namespace: default
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
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
          image: klab/checkout:2.1.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 2
`,
    },
  },

  "rollout-cannot-fit-maxsurge": {
    fix: "Set maxSurge 0 and maxUnavailable 1 to roll within cluster capacity",
    files: {
      "deployment.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: analytics
  namespace: default
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 0
      maxUnavailable: 1
  selector:
    matchLabels:
      app: analytics
  template:
    metadata:
      labels:
        app: analytics
        track: v2
    spec:
      containers:
        - name: api
          image: klab/analytics:2.0.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 2
          resources:
            requests:
              cpu: "2"
            limits:
              cpu: "2"
`,
    },
  },

  "immutable-deployment-selector": {
    fix: "Revert the immutable selector and add tier: api to the pod template labels",
    files: {
      "deployment.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: search
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: search
  template:
    metadata:
      labels:
        app: search
        tier: api
    spec:
      containers:
        - name: api
          image: klab/search:1.4.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 2
`,
    },
  },

  "graceful-shutdown-502s": {
    fix: "Delay shutdown for endpoint propagation and extend the total grace period",
    files: {
      "deployment.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: edge-api
  namespace: default
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: edge-api
  template:
    metadata:
      labels:
        app: edge-api
    spec:
      terminationGracePeriodSeconds: 15
      containers:
        - name: api
          image: registry.example/edge-api:2.4.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 2
          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 10"]
`,
    },
  },

  "command-override-crash": {
    fix: "Remove command and args so the image entrypoint runs",
    files: {
      "deployment.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: storefront
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: storefront
  template:
    metadata:
      labels:
        app: storefront
    spec:
      containers:
        - name: storefront
          image: klab/web-app:1.0.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 2
            failureThreshold: 2
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 2
            periodSeconds: 2
            failureThreshold: 2
`,
    },
  },

  "slow-start-without-startup-probe": {
    fix: "Add a startupProbe with enough budget for the five-second warm-up",
    files: {
      "deployment.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: reports-api
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: reports-api
  template:
    metadata:
      labels:
        app: reports-api
    spec:
      containers:
        - name: api
          image: klab/slow-api:1.0.0
          ports:
            - name: http
              containerPort: 8080
          startupProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 1
            failureThreshold: 10
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 1
            failureThreshold: 2
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 1
            failureThreshold: 2
`,
    },
  },

  "probe-hits-wrong-port": {
    fix: "Change the readiness probe port from 9090 to 8080",
    files: {
      "deployment.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: payments-api
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: payments-api
  template:
    metadata:
      labels:
        app: payments-api
    spec:
      containers:
        - name: api
          image: klab/web-app:1.0.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 2
            failureThreshold: 2
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 5
            failureThreshold: 3
`,
    },
  },

  "healthy-app-broken-sidecar": {
    fix: "Set DATABASE_URL on queue-sidecar",
    files: {
      "deployment.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: checkout
  template:
    metadata:
      labels:
        app: checkout
    spec:
      containers:
        - name: checkout
          image: klab/web-app:1.0.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 2
        - name: queue-sidecar
          image: klab/worker:1.0.0
          env:
            - name: PORT
              value: "9090"
            - name: DATABASE_URL
              value: postgres://queue.internal:5432/jobs
`,
    },
  },

  "private-registry-pull-secret": {
    fix: "Attach registry-credentials through imagePullSecrets",
    files: {
      "deployment.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: private-api
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: private-api
  template:
    metadata:
      labels:
        app: private-api
    spec:
      imagePullSecrets:
        - name: registry-credentials
      containers:
        - name: api
          image: registry.example/private/api:1.0.0
          ports:
            - name: http
              containerPort: 8080
`,
    },
  },

  "service-selector-mismatch": {
    fix: "Service selector app: web → app: web-app",
    files: {
      "service.yaml": `apiVersion: v1
kind: Service
metadata:
  name: web-svc
  namespace: default
spec:
  selector:
    app: web-app
  ports:
    - name: http
      port: 80
      targetPort: 8080
`,
    },
  },

  "port-routing-bug": {
    fix: "Service targetPort 3000 → named container port http",
    files: {
      "service.yaml": `apiVersion: v1
kind: Service
metadata:
  name: web-svc
  namespace: default
spec:
  selector:
    app: web-app
  ports:
    - name: http
      port: 80
      targetPort: http
`,
    },
  },

  "broken-readiness-probe": {
    fix: "readinessProbe path /readyz → /healthz",
    files: {
      "pod.yaml": `apiVersion: v1
kind: Pod
metadata:
  name: web-app
  namespace: default
  labels:
    app: web-app
spec:
  containers:
    - name: web-app
      image: klab/web-app:1.0.0
      ports:
        - name: http
          containerPort: 8080
      readinessProbe:
        httpGet:
          path: /healthz
          port: 8080
        initialDelaySeconds: 2
        periodSeconds: 3
        timeoutSeconds: 2
      livenessProbe:
        httpGet:
          path: /healthz
          port: 8080
        initialDelaySeconds: 5
        periodSeconds: 10
        timeoutSeconds: 2
`,
    },
  },

  "namespace-confusion": {
    fix: "UPSTREAM_URL http://checkout-svc/ → http://checkout-svc.shop/",
    files: {
      "storefront.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: storefront
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: storefront
  template:
    metadata:
      labels:
        app: storefront
    spec:
      containers:
        - name: storefront
          image: klab/api:1.0.0
          env:
            - name: UPSTREAM_URL
              value: http://checkout-svc.shop/
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 1
            periodSeconds: 2
            timeoutSeconds: 2
`,
    },
  },

  "service-has-no-endpoints": {
    fix: "Deployment replicas 0 → 2",
    files: {
      "deployment.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
        - name: web-app
          image: klab/web-app:1.0.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 1
            periodSeconds: 2
            timeoutSeconds: 2
`,
    },
  },

  "pod-crashloop-mystery": {
    fix: "Add DATABASE_URL env to the worker container",
    files: {
      "deployment.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: queue-worker
  namespace: default
spec:
  replicas: 2
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
          image: klab/worker:1.0.0
          env:
            - name: DATABASE_URL
              value: postgres://queue-db:5432/jobs
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 1
            periodSeconds: 2
            timeoutSeconds: 2
`,
    },
  },

  "rolling-update-gone-wrong": {
    fix: "Roll image back: klab/web-app:2.0.0 → klab/web-app:1.0.0",
    files: {
      "deployment.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
        - name: web-app
          image: klab/web-app:1.0.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 1
            periodSeconds: 2
            timeoutSeconds: 2
`,
    },
  },

  "dns-resolution-failure": {
    fix: "UPSTREAM_URL http://web-scv/ → http://web-svc/",
    files: {
      "orders-api.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: orders-api
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: orders-api
  template:
    metadata:
      labels:
        app: orders-api
    spec:
      containers:
        - name: orders-api
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
            periodSeconds: 2
            timeoutSeconds: 2
`,
    },
  },

  "liveness-probe-death-spiral": {
    fix: "livenessProbe path /readyz → /healthz",
    files: {
      "deployment.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
        - name: web-app
          image: klab/web-app:1.0.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 1
            periodSeconds: 2
            timeoutSeconds: 2
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 2
            periodSeconds: 2
            timeoutSeconds: 2
            failureThreshold: 2
`,
    },
  },

  "config-drift": {
    fix: "Remove the drifted PORT=9090 env (app returns to its default 8080)",
    files: {
      "deployment.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
        - name: web-app
          image: klab/web-app:1.0.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 1
            periodSeconds: 2
            timeoutSeconds: 2
`,
    },
  },

  "broken-service-chain": {
    fix: "web-svc targetPort 9090 → 8080",
    files: {
      "web-svc.yaml": `apiVersion: v1
kind: Service
metadata:
  name: web-svc
  namespace: default
spec:
  selector:
    app: web-app
  ports:
    - name: http
      port: 80
      targetPort: 8080
`,
    },
  },

  "zombie-replicaset": {
    fix: "Scale the orphaned web-legacy ReplicaSet to 0",
    files: {
      "legacy-rs.yaml": `apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: web-legacy
  namespace: default
spec:
  replicas: 0
  selector:
    matchLabels:
      app: web
      track: legacy
  template:
    metadata:
      labels:
        app: web
        track: legacy
    spec:
      containers:
        - name: web-app
          image: klab/web-app:0.9.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 1
            periodSeconds: 2
            timeoutSeconds: 2
`,
    },
  },
};
