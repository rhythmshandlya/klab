import type { DocsLesson } from "@/lib/domain/types";

import { compileLessons, WEB_IMAGE, WEB_POD, WEB_DEPLOYMENT, WEB_REPLICASET } from "./authoring";

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
          note: "a list: a Pod can hold more than one container",
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
      text: "The two most confused Pod states are phase and readiness. STATUS in kubectl get pods is the lifecycle phase (Pending, Running, Succeeded, Failed). READY (the 1/1 column) is a separate condition that counts how many containers currently pass their readiness probe. A Pod can sit at Running 1/1 STATUS with 0/1 READY for a long time: the process is alive, but it is telling Kubernetes not to send it traffic yet.",
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
      text: "For a Pod, restartPolicy is Always unless you change it. That is right for long-running servers but wrong for a one-shot task, where you want OnFailure or Never: otherwise a Pod that finishes successfully gets restarted forever.",
    },
    {
      type: "heading",
      id: "multi-container",
      text: "One container or several?",
    },
    {
      type: "paragraph",
      text: "The default and correct shape is one application container per Pod. Reach for a second container only when it must share the first one's network or filesystem and share its lifecycle: a sidecar that ships logs, a proxy, or an init container that runs to completion before the app starts. If two things can scale or fail independently, they belong in separate Pods.",
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
        "A Pod is the smallest schedulable unit: containers in it share one IP, localhost, and lifecycle.",
        "STATUS (phase) and READY (readiness) are independent: a Pod can be Running but NotReady.",
        "Readiness gates traffic; liveness and restartPolicy control restarts. Do not confuse them.",
        "Default to one application container per Pod; add sidecars only when they must share context.",
        "Create bare Pods only for debugging: run real workloads through a controller so they self-heal.",
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
          note: "which Pods this Deployment owns: this is immutable after creation",
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
          note: "never drop below replicas Ready Pods: zero-downtime",
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
          note: "the label the selector matches: the contract's other half",
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
          note: "Minimum shape: kind, a name, and a template with one container. No replicas field defaults to 1. No selector yet: the API server will reject this until a selector is added.",
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
        code: "template:\n  metadata:\n    labels:\n      app: web\n      tier: frontend\n# valid: template adds tier, selector still matched",
      },
    },
    {
      type: "heading",
      id: "rollouts",
      text: "How a rolling update works",
    },
    {
      type: "paragraph",
      text: "Change anything under spec.template: usually the image, and the Deployment computes a new template hash. It creates a fresh ReplicaSet for that hash and scales it up while scaling the old one down, respecting maxSurge and maxUnavailable. When the new ReplicaSet is fully Ready, the old one is scaled to zero but kept for rollback.",
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
      text: "Each superseded ReplicaSet is kept (up to spec.revisionHistoryLimit, default 10) so you can undo a bad release. `kubectl rollout undo deploy/web` scales the previous ReplicaSet back up and the current one down: a rollback is just another rolling update in reverse. `kubectl rollout status deploy/web` watches progress; `kubectl rollout history` lists revisions.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Only template changes trigger a rollout",
      text: "Editing spec.replicas scales the current ReplicaSet: it does NOT create a new revision. Only changes under spec.template (image, env, resources, labels) produce a new ReplicaSet and a rollout. This is why scaling is instant and cheap while an image bump is a controlled, reversible release.",
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
        "The selector requires app: api, but the Pod template labels the Pods app: web. Since matchLabels is not a subset of the template labels, the Deployment could never own the Pods it creates, so the API server rejects it outright. Fix: make them agree: change selector.matchLabels to app: web (or relabel the template to app: api). Because the selector is immutable after creation, getting this right on the first apply matters.",
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
        "A Deployment owns ReplicaSets, which own Pods: you edit the Deployment template, never individual Pods.",
        "spec.selector.matchLabels must be a subset of spec.template.metadata.labels, and the selector is immutable after creation.",
        "Only changes under spec.template create a new ReplicaSet and trigger a rollout; changing replicas just scales the current one.",
        "maxSurge and maxUnavailable govern rollout speed vs. availability: maxUnavailable: 0 buys zero downtime.",
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
          text: "No: scaling adjusts the current ReplicaSet without a new revision.",
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
      text: "A ReplicaSet has one job: keep exactly spec.replicas Pods that match its selector running at all times. Its controller runs a continuous reconcile loop: it counts Pods matching the selector, compares that to the desired count, and takes action. Too few Pods? It creates more from the Pod template. Too many? It deletes the surplus. A Pod crashed, was evicted, or its node died? The count drops, and the controller creates a replacement. The ReplicaSet never heals a Pod; it only maintains a population.",
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
          note: "must satisfy the selector above: this is what links them",
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
      text: "A ReplicaSet does not only manage Pods it created. Any Pod that matches its selector and has no controlling owner gets adopted: the ReplicaSet stamps its ownerReference onto it and counts it toward the replica total. This is why a stray Pod with matching labels can make a ReplicaSet report more replicas than you expected, and why label hygiene matters.",
    },
    {
      type: "callout",
      tone: "key",
      title: "What a Deployment update does to ReplicaSets",
      text: "When you change a Deployment's Pod template (say a new image), the Deployment does not edit the existing ReplicaSet. It creates a brand-new ReplicaSet for the new template: distinguished by a pod-template-hash label the Deployment injects into the selector: scales it up while scaling the old one down to 0. The old ReplicaSet is not deleted; it is kept at replicas: 0 as rollout history so kubectl rollout undo can scale it back up. revisionHistoryLimit (default 10) controls how many of these empty ReplicaSets are retained.",
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
        "The selector requires two labels: app: web AND tier: frontend, but the Pod template only sets app: web. A Pod the ReplicaSet created would not match its own selector, so the API server rejects it at validation time. Every key in matchLabels must appear in template.metadata.labels. Fix: add tier: frontend to the template labels, or drop it from the selector.",
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
        "ReplicaSets own their Pods via ownerReferences and can adopt any matching, unowned Pod, so labels decide membership.",
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
            "Pods are immutable in template terms: the Deployment replaces them by shifting Pods from the old ReplicaSet to a new one, not by editing running Pods.",
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
          note: "MUST name a headless Service (clusterIP: None): it governs the per-Pod DNS domain",
        },
        {
          code: "  replicas: 3",
          note: "creates web-0, web-1, web-2: the ordinals are stable, not random",
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
          note: "a TEMPLATE, not a volume: Kubernetes stamps one PVC per Pod from it",
        },
        {
          code: "    - metadata:",
        },
        {
          code: "        name: data",
          note: "yields PVCs named data-web-0, data-web-1, data-web-2: each bound to one Pod for life",
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
          note: "Kind and template look just like a Deployment. This alone gives you nothing stateful yet: Pods would still be anonymous with no persistent disk.",
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
        "Each StatefulSet Pod gets a stable name of the form <statefulset-name>-<ordinal>, starting at 0: web-0, web-1, web-2. The name is not reused for a different Pod and survives rescheduling: if web-1 dies, its replacement is still named web-1 and reattaches the same storage.",
    },
    {
      type: "concept",
      term: "Headless Service DNS",
      definition:
        "A headless Service (clusterIP: None) named by serviceName gives each Pod its own DNS A record: web-0.web.default.svc.cluster.local. Clients can address a specific member directly instead of load-balancing across all of them: essential for quorum systems where you must reach the primary or a named peer.",
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
      text: "By default (podManagementPolicy: OrderedReady) Kubernetes brings Pods up one at a time in ascending ordinal order, waiting for each to be Running and Ready before starting the next, and tears them down in descending order. Set podManagementPolicy: Parallel when members are independent and start-up order does not matter: it launches and deletes all Pods at once for faster scaling.",
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
        "serviceName must reference a headless Service (clusterIP: None): without it Pods are never created.",
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
      text: "A DaemonSet guarantees that a copy of a Pod runs on every node that matches its scheduling rules. As nodes join the cluster the DaemonSet controller places a Pod on them, and as nodes leave those Pods are garbage collected. You never set a replica count: the fleet size is the number of matching nodes.",
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
      caption: "No replicas field: the controller fans out one Pod per matching node.",
      lines: [
        {
          code: "apiVersion: apps/v1",
        },
        {
          code: "kind: DaemonSet",
          note: "not Deployment: there is no replica count to set",
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
          note: "Start with the object identity. apps/v1 DaemonSet with a name: no spec content yet, so it schedules nothing.",
          code: "apiVersion: apps/v1\nkind: DaemonSet\nmetadata:\n  name: log-agent\nspec: {}",
        },
        {
          label: "Add selector and template",
          note: "The selector must match the template's Pod labels. Now the controller will place one Pod per node, but only on nodes with no blocking taints.",
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
      text: "nodeSelector and node affinity narrow the DaemonSet to a subset of nodes (for example only GPU nodes). Tolerations let its Pods land on tainted nodes such as the control plane. Node resources still apply: a node with no room will show the Pod Pending. Get all three right and coverage matches your intent exactly.",
    },
    {
      type: "callout",
      tone: "info",
      title: "updateStrategy: RollingUpdate vs OnDelete",
      text: "RollingUpdate (the default) replaces Pods node by node when the template changes, bounded by maxUnavailable so the fleet is never fully down. OnDelete makes the controller wait: a node's Pod is only recreated with the new template after you manually delete the old one: useful when node-agent restarts are disruptive and you want to control timing.",
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
        "A DaemonSet has no replica count: its size is the number of nodes that match its scheduling rules.",
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
      text: "A Deployment assumes its Pods should run forever: if one exits, even with exit code 0, the controller restarts it to hold the desired replica count. A Job assumes the opposite. It runs Pods until a fixed number of them exit successfully, then stops and stays finished. This single difference in expectation is why you cannot model a database migration or a nightly report as a Deployment: a Deployment would treat a successful exit as a crash and loop forever.",
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
          note: "MUST be Never or OnFailure on a Job: Always is rejected",
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
      text: "A CronJob does not run Pods itself. On each scheduled tick it stamps out a new Job from its jobTemplate, and that Job runs Pods to completion the same way a hand-written Job would. The schedule uses standard Unix cron syntax with five fields: minute, hour, day-of-month, month, day-of-week: evaluated in the controller's timezone unless you set spec.timeZone.",
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
      text: "When a CronJob's next tick arrives and the previous run has not finished, concurrencyPolicy decides what happens. Allow (the default) lets runs overlap. Forbid skips the new run and waits for the next tick. Replace cancels the still-running Job and starts a fresh one. Reach for Forbid or Replace whenever two copies of the work must never run at once: for example a job that writes to the same file or table.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Missed schedules and the starting deadline",
      text: "If the CronJob controller is down or the cluster is busy, a scheduled tick can be missed. startingDeadlineSeconds is how late a missed run may still be started; past that window the run is skipped and counted as missed. If more than 100 schedules are missed with no deadline set, the controller stops scheduling entirely and logs an error, so set a sane startingDeadlineSeconds on any frequent CronJob.",
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
        "restartPolicy: Always is invalid on a Job. A Job Pod may only use Never or OnFailure. Always would restart the container after every exit, including a successful exit, so the Pod could never reach a terminal Succeeded state and the Job could never be marked Complete. The API server rejects it with a validation error. Fix: use restartPolicy: OnFailure (or Never).",
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
        "A Job Pod's restartPolicy must be Never or OnFailure: Always is rejected by the API server.",
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
      text: "Init containers are the setup crew. Kubernetes starts them one after another in the order they appear under initContainers. Each one must exit 0 before the next begins, and all of them must succeed before the first app container starts. If an init container exits non-zero, the kubelet restarts it according to the Pod's restartPolicy and the Pod stays in Init:Error or Init:CrashLoopBackOff: the app never runs. Use them for work that must be done and finished first: schema migrations, waiting for a dependency to be reachable, or fetching a config bundle into a shared volume.",
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
      text: "A native sidecar is an init container with restartPolicy: Always. That one field changes the rules. Kubernetes still starts it in init order: before the app containers, but instead of waiting for it to exit, it waits for it to start (and pass its startup probe, if defined) and then moves on. The sidecar keeps running for the whole life of the Pod. On shutdown the order reverses: app containers are terminated first, then the sidecars, so a logging or proxy sidecar is still alive to flush the last of the app's traffic. Native sidecars are stable as of Kubernetes 1.29, and they replace the old pattern of adding a helper to the containers list and hoping ordering worked out.",
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
      text: "When a Pod is deleted, the kubelet runs the container's preStop hook first, then sends SIGTERM to the main process. terminationGracePeriodSeconds (default 30) is the total budget from the start of termination. If preStop plus the process's own graceful exit run past that budget, the container is SIGKILLed and in-flight work is dropped. A common pattern is a short preStop sleep so the endpoint is pulled from Service EndpointSlices before the app stops accepting connections, then set the grace period comfortably longer than sleep + real drain time.",
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
        "A native sidecar is just an init container with restartPolicy: Always: it starts before the app and runs alongside it.",
        "On shutdown, app containers stop before native sidecars, so a logging or proxy sidecar can flush or drain last.",
        "preStop runs before SIGTERM, and it shares the terminationGracePeriodSeconds budget: overrun it and the container is SIGKILLed.",
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
            "That field tells Kubernetes to start the container in init order but not wait for it to exit, and to keep it running for the life of the Pod: the definition of a native sidecar (stable since 1.29).",
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

export const WORKLOAD_LESSONS = compileLessons([
  pods,
  deployments,
  replicaSets,
  statefulSets,
  daemonSets,
  jobs,
  podComposition,
]);
