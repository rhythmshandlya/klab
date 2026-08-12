import type { DocsLesson } from "@/lib/domain/types";

import {
  compileLessons,
  WEB_IMAGE,
  WEB_V2_IMAGE,
  LEGACY_IMAGE,
  WEB_DEPLOYMENT,
  APP_CONFIGMAP,
  WEB_DEPLOYMENT_ENVFROM,
  WEB_DEPLOYMENT_RESOURCES,
  TEAM_A_NAMESPACE,
  TEAM_B_NAMESPACE,
  TEAM_A_POD,
  TEAM_B_POD,
  TEAM_A_SERVICE,
  TEAM_B_SERVICE,
} from "./authoring";

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
      text: "A Deployment never edits Pods in place. When you change anything under spec.template: usually the container image: Kubernetes computes a new hash, creates a fresh ReplicaSet for that template, and then shifts capacity: it scales the new ReplicaSet up and the old one down, a few Pods at a time. Readiness decides the pace. A new Pod only counts toward the rollout once its readiness probe passes, so a rollout is really a controlled hand-off gated by health, not a bulk restart.",
    },
    {
      type: "diagram",
      variant: "rollout",
      title: "Old ReplicaSet to new ReplicaSet",
      caption:
        "The Deployment scales the new ReplicaSet up as fast as readiness allows and drains the old one down. The old ReplicaSet is not deleted: it is scaled to zero and kept for rollback.",
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
          note: "desired steady-state count: the number the rollout math is relative to",
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
          note: "never drop below 4 available Pods: full capacity is preserved throughout",
        },
        {
          code: "  minReadySeconds: 5",
          note: "a new Pod must stay Ready this long before it counts as Available: catches crash-on-startup",
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
          note: "the gate: until this passes, the new Pod is not counted as available",
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
        "maxSurge is the ceiling of extra Pods above replicas during a rollout; maxUnavailable is the floor of missing Pods below replicas. They cannot both be 0: that would give the rollout no room to move. maxUnavailable: 0 with maxSurge > 0 is the zero-downtime setting (add before removing); maxUnavailable > 0 with maxSurge: 0 replaces in place without ever exceeding the replica count.",
    },
    {
      type: "callout",
      tone: "key",
      title: "The two knobs set the pace, readiness sets the timing",
      text: "maxSurge and maxUnavailable define the WINDOW the controller may operate in. But the controller only advances a step once new Pods actually become Ready. If Pods never go Ready, the strategy math is irrelevant: the rollout simply waits inside its allowed window.",
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
      text: "RollingUpdate keeps the app available by overlapping old and new Pods. Recreate does the opposite: it terminates every old Pod first, then creates the new ones: a deliberate gap with zero running Pods. Recreate exists for cases where two versions must never run at the same time.",
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
            "Yes: a full gap",
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
            "status streams each step and returns 0 only when every new Pod is available. It exits non-zero on ProgressDeadlineExceeded: useful in CI.",
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
            "undo re-scales the previous revision's ReplicaSet up and the current one down: the same rolling mechanism, in reverse. It does not delete the failed ReplicaSet.",
          command: "kubectl rollout undo deploy/web",
          output: "deployment.apps/web rolled back",
        },
      ],
    },
    {
      type: "concept",
      term: "Pause and resume",
      definition:
        "kubectl rollout pause deploy/web freezes the Deployment so template edits accumulate without triggering Pods: the basis of a canary or batching several changes into one rollout. kubectl rollout resume deploy/web releases all accumulated changes as a single rollout. Each superseded template is kept as a scaled-to-zero ReplicaSet up to revisionHistoryLimit (default 10), which is exactly the set of revisions undo can return to.",
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
        "The readiness probe targets /readyz, which this image answers with 404. The probe therefore never passes, so the new Pods stay 0/1 READY and are never counted as available. Because maxUnavailable is 0, the Deployment refuses to scale the old ReplicaSet down past its allowed window, so the old, healthy Pods keep serving and there is zero downtime while the rollout is stuck. After progressDeadlineSeconds the Deployment is marked ProgressDeadlineExceeded, but it does NOT auto-roll-back. Fix the probe path to /healthz (which returns 200) or ship an image that actually serves /readyz; then run kubectl rollout undo if you want to abandon the bad revision. The same symptom appears with a genuinely bad image (ImagePullBackOff / crash): the new Pods never reach Ready, so the rollout stalls rather than taking the service down.",
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
        "Changing spec.template creates a new ReplicaSet; the Deployment scales it up and the old one down: old ReplicaSets are kept, not deleted.",
        "maxSurge is the ceiling of extra Pods, maxUnavailable is the floor of missing Pods; maxUnavailable: 0 with maxSurge > 0 gives zero downtime.",
        "Readiness gates every step: a new Pod counts only after its readiness probe passes, so a broken version stalls the rollout instead of taking the app down.",
        "Recreate deliberately trades availability for a clean version cut-over; RollingUpdate is the default and preserves capacity.",
        "kubectl rollout status watches, history audits, undo reverts, and pause/resume enable canaries: a stuck rollout hits progressDeadlineSeconds but never auto-rolls-back.",
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
      text: "requests answer 'does this Pod fit on the node?': read at schedule time, once. limits answer 'how much may this container consume right now?': enforced continuously by the kernel. Confusing the two is the root of most resource incidents.",
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
        "requests and limits set for both CPU and memory: this is what makes a Pod Guaranteed.",
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
          note: "reserve 0.25 of a core: becomes the container's CPU share weight",
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
          note: "CPU beyond this is THROTTLED, never killed: CPU is compressible",
        },
        {
          code: '          memory: "256Mi"',
          note: "memory beyond this triggers an OOM kill: memory is incompressible",
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
          note: "A container with no requests or limits. The scheduler assumes it needs ~nothing, so it can land anywhere, and it is first in line to be evicted when the node runs low on memory.",
          code: "spec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0",
        },
        {
          label: "Add requests (Burstable)",
          note: "Now the scheduler reserves 250m CPU and 128Mi memory. The Pod fits only where that capacity exists, and it can still burst above the request since there is no limit yet.",
          code: 'spec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      resources:\n        requests:\n          cpu: "250m"\n          memory: "128Mi"',
        },
        {
          label: "Add matching limits (Guaranteed)",
          note: "Set limits equal to requests for BOTH cpu and memory on every container. Kubernetes now derives QoS class Guaranteed: the last Pods evicted under pressure.",
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
      text: "The single most important idea in resource management is that CPU and memory fail differently. CPU is compressible: the kernel can hand a container less of it at any instant with no lasting harm: the app just runs slower. Memory is incompressible: once a byte is allocated, the kernel cannot politely take it back. So exceeding a CPU limit throttles the container, while exceeding a memory limit kills it.",
    },
    {
      type: "concept",
      term: "Compressible resource",
      definition:
        "A resource that can be reclaimed from a container gradually and without terminating it. CPU is compressible (the scheduler throttles it via CFS quota). Memory is not: the only way to reclaim it is to kill the process, which is why over-limit memory ends in OOMKilled.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Over-limit behavior is not symmetric",
      text: "Exceed the CPU limit and your container is throttled: it keeps running but stalls, which you'll see as latency spikes, not restarts. Exceed the memory limit and the kernel OOM killer terminates the process; the container's last state shows reason: OOMKilled and it restarts per restartPolicy: often into CrashLoopBackOff.",
    },
    {
      type: "compare",
      caption: "Same idea: a limit was exceeded, but the outcome depends on which resource.",
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
      text: "You never set a Pod's QoS class directly: Kubernetes derives it from the requests and limits you wrote. The class then decides who gets killed first when a node runs out of memory. There are exactly three classes. Guaranteed: every container in the Pod sets requests equal to limits for both CPU and memory. BestEffort: no container sets any request or limit at all. Burstable: anything in between: at least one request or limit is set, but the Pod doesn't meet the Guaranteed bar.",
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
            "Typical apps that idle low but burst: set a request floor, allow headroom",
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
      text: "Check a running Pod with kubectl get pod NAME -o jsonpath='{.status.qosClass}'. If you wanted Guaranteed but see Burstable, a container is missing a limit or a request, or a value doesn't match: check every container, since one BestEffort sidecar can drag the whole Pod down.",
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
        "The memory limit (96Mi) is far below what the app actually uses (~200Mi). Memory is incompressible, so when the container grows past 96Mi the kernel OOM killer terminates it: hence reason: OOMKilled and the restart loop. The CPU numbers are irrelevant here; a low CPU limit would only throttle, not kill. Fix: raise limits.memory (and usually requests.memory) above the real working set, e.g. requests 256Mi / limits 320Mi, then confirm the restarts stop.",
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
        "CPU is compressible: over-limit means throttling. Memory is incompressible: over-limit means OOMKilled.",
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
            "CPU is compressible: an over-limit CPU only throttles the container, it never triggers an OOM kill.",
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
      tryChanging: "Remove the limits block and re-apply: the QoS class drops to Burstable.",
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
      text: "Most objects you create every day are namespaced: their name only has to be unique within their namespace. A Service called web-svc can exist in team-a and team-b at the same time. Some objects are cluster-scoped instead: they exist once for the whole cluster and cannot live inside a namespace.",
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
        "The Namespace object itself is tiny: the labels are what turn it into a policy target.",
      lines: [
        {
          code: "apiVersion: v1",
        },
        {
          code: "kind: Namespace",
        },
        {
          code: "metadata:",
          note: "cluster-scoped object: no namespace field of its own",
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
      text: "Cluster DNS gives every Service a fully qualified name of the form <service>.<namespace>.svc.cluster.local. A short name works too, but only because the resolver appends search domains, and the caller's own namespace is tried first. That single fact is the source of most cross-namespace call bugs.",
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
        "Separating trusted-ish teams by namespace with policy layered on top. It is not a strong security boundary against hostile tenants: the shared kernel, nodes, and control plane remain. For hostile isolation you reach for separate clusters or stronger runtime sandboxing.",
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
      hint: "The Namespace is cluster-scoped (no namespace field). The ResourceQuota is namespaced: set metadata.namespace: payments and put the caps under spec.hard.",
      solution:
        'apiVersion: v1\nkind: Namespace\nmetadata:\n  name: payments\n---\napiVersion: v1\nkind: ResourceQuota\nmetadata:\n  name: payments-quota\n  namespace: payments\nspec:\n  hard:\n    pods: "10"\n    requests.cpu: "2"',
    },
    {
      type: "lab",
      labId: "namespace-dns",
    },
    {
      type: "compare",
      caption: "The same intent: call a Service in another namespace: written wrong and right.",
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
        "Quotas, RBAC Roles, and NetworkPolicy attach to a namespace: that is what makes it a useful boundary.",
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
          explanation: "ConfigMaps are namespaced: each lives in exactly one namespace.",
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
          note: "a ConfigMap is namespaced: a Pod can only mount one from its own namespace",
        },
        {
          code: "data:",
          note: "string key/value pairs; use binaryData for raw bytes",
        },
        {
          code: "  LOG_LEVEL: info",
          note: "a scalar: natural as an env var OR a file named LOG_LEVEL",
        },
        {
          code: "  API_URL: http://api-svc/",
        },
        {
          code: "  app.conf: |",
          note: "a multi-line value: ideal mounted as a file, awkward as an env var",
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
      text: "Editing a ConfigMap or Secret never restarts anything. Env-var consumers keep the values they captured at start until the Pod is recreated. Volume-mounted consumers see files updated by the kubelet after a delay (up to about a minute), but NOT when mounted with subPath and NOT if the object is immutable. To make an env-var change take effect deliberately, run kubectl rollout restart deployment/web, or bump a checksum annotation on the Pod template so the Deployment rolls.",
    },
    {
      type: "decisionTable",
      title: "Choosing env vars vs mounted files",
      columns: ["Env vars (envFrom / valueFrom)", "Volume files (configMap / secret volume)"],
      rows: [
        {
          label: "Live updates to running Pods",
          cells: [
            "No: fixed at container start",
            "Yes: kubelet refreshes files (not subPath, not immutable)",
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
          cells: ["From process environment", "From the filesystem: ideally re-reading on change"],
        },
        {
          label: "Binary / large data",
          cells: ["Awkward: env values are strings", "Natural: binaryData and file bytes"],
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
      text: "A Secret looks like a ConfigMap whose values are base64-encoded. That base64 is only an encoding for transporting arbitrary bytes as JSON strings: it is trivially reversible and provides zero confidentiality. Anyone who can get the Secret can decode it in one command.",
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
        "A team set LOG_LEVEL: debug in the ConfigMap and ran kubectl apply. Minutes later the running web Pods still log at info. The ConfigMap really does say debug now. Given this Deployment, why didn't the change take effect, and how do you make it apply?",
      code: "spec:\n  template:\n    spec:\n      containers:\n        - name: web\n          image: klab/web-app:1.0.0\n          envFrom:\n            - configMapRef:\n                name: app-config",
      answer:
        "The ConfigMap is consumed via envFrom, so LOG_LEVEL is copied into the process environment ONCE when each container starts. Editing the ConfigMap afterwards does not touch the environment of a container that is already running, and nothing restarts the Pods automatically. The new value only appears in a freshly created Pod. Fix: trigger a rollout with kubectl rollout restart deployment/web (or bump a checksum annotation on the Pod template). If you needed the value to update without a restart, you would mount the ConfigMap as a volume instead of importing it as env vars, and have the app re-read the file.",
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
        'Author a ConfigMap named feature-flags with one key, features.json, holding {"beta": true}. Then write the Pod volume and volumeMount snippet that exposes that key as the file /etc/features/features.json so the app can re-read it after an edit: without a restart.',
      hint: "A whole file belongs in a mounted volume, not an env var. Reference the ConfigMap under spec.volumes, then point a volumeMount at a mountPath. Avoid subPath, or the file will stop auto-updating.",
      solution:
        'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: feature-flags\ndata:\n  features.json: |\n    {"beta": true}\n---\n# in the Pod spec:\n    volumeMounts:\n      - name: flags\n        mountPath: /etc/features\n    volumes:\n      - name: flags\n        configMap:\n          name: feature-flags',
    },
    { type: "lab", labId: "config-envfrom" },
    {
      type: "takeaways",
      items: [
        "ConfigMaps hold ordinary config; Secrets hold sensitive data: same shape, stricter defaults for Secrets.",
        "Env-var config is captured at container start and needs a rollout to change; volume-mounted config is refreshed on disk by the kubelet (unless subPath or immutable).",
        "Editing a ConfigMap or Secret never restarts Pods by itself: use kubectl rollout restart or a template checksum to apply env changes.",
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
          text: "Env vars always live-update, so the cache is just slow: wait longer.",
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
      text: "Containers are cattle, not pets. A container's writable layer lives and dies with that container instance: a crash-restart or a reschedule to another node wipes it. Kubernetes solves this with Volumes: a Volume is a directory mounted into one or more containers in a Pod, and its lifetime is governed by the Volume type, not the container. Choosing storage is really about choosing a lifetime: does the data die with the container, with the Pod, or does it outlive both?",
    },
    {
      type: "heading",
      id: "ephemeral-vs-persistent",
      text: "Ephemeral vs persistent",
    },
    {
      type: "paragraph",
      text: "Ephemeral volumes are tied to the Pod's lifecycle. An emptyDir is created when the Pod is assigned to a node and deleted forever when the Pod is removed: great for scratch space, caches, or sharing files between containers in the same Pod. Persistent volumes live in the cluster independently of any Pod: a PersistentVolume (PV) survives Pod deletion, rescheduling, and even node loss (depending on the backend), so a database re-attaching after a restart finds its data intact.",
    },
    {
      type: "concept",
      term: "emptyDir",
      definition:
        "An ephemeral volume created empty when a Pod lands on a node and deleted with the Pod. Shared by all containers in the Pod. Use it for scratch and inter-container handoff: never for data you cannot lose.",
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
      text: "Persistent storage is split into three objects so that users and administrators stay decoupled. A PersistentVolume (PV) is a piece of real storage in the cluster: an actual disk. A PersistentVolumeClaim (PVC) is a user's request for storage of a given size and access mode; it does not know or care which disk backs it. A StorageClass describes a 'kind' of storage and names the provisioner that can create PVs on demand. Binding is Kubernetes matching a PVC to a suitable PV.",
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
        "Instead of an admin pre-creating PVs (static provisioning), a PVC names a StorageClass and the class's provisioner creates a matching PV on demand at bind time. This is how most managed clusters work: the PVC is all you write.",
    },
    {
      type: "callout",
      tone: "info",
      title: "WaitForFirstConsumer",
      text: "A StorageClass with volumeBindingMode: WaitForFirstConsumer delays PV creation until a Pod actually uses the PVC. This lets the scheduler pick a node first, so the disk is provisioned in the same zone as the Pod: critical for zonal block storage that cannot cross availability zones.",
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
          note: "read-write by Pods on a single node: the common default for a block disk",
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
          note: "the minimum capacity you need: the bound PV must be at least this big",
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
      text: "An access mode declares how many nodes (or Pods) may mount a volume and whether writes are allowed. It is a constraint the storage backend must be able to honour: asking for ReadWriteMany on a plain cloud block disk will simply fail to bind. Note the subtlety: ReadWriteOnce is per-node, not per-Pod, so several Pods on the same node can share it.",
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
      text: "Access modes are not magic. ReadWriteMany requires a shared filesystem (NFS, CephFS, EFS); a standard cloud block volume only offers ReadWriteOnce. If a PVC asks for a mode the class cannot provide, the PVC stays Pending and any Pod using it stays Pending too: with no obvious error until you describe the PVC.",
    },
    {
      type: "heading",
      id: "reclaim-policies",
      text: "Reclaim policies",
    },
    {
      type: "paragraph",
      text: "A reclaim policy decides what happens to a PV (and its backing disk) when its PVC is deleted. Delete removes both the PV object and the real storage: convenient, and the default for dynamically provisioned volumes. Retain keeps the PV and the data, moving the PV to a Released state that an admin must reclaim by hand. The old Recycle policy is deprecated; use Retain or Delete.",
    },
    {
      type: "compare",
      caption:
        "The reclaimPolicy on the PV (usually inherited from the StorageClass) decides whether deleting a PVC destroys your data.",
      left: {
        title: "Retain: keep the data",
        code: "persistentVolumeReclaimPolicy: Retain\n# PVC delete -> PV goes Released\n# disk + data kept; admin reclaims manually",
      },
      right: {
        title: "Delete: clean up",
        code: "persistentVolumeReclaimPolicy: Delete\n# PVC delete -> PV + backing disk deleted\n# default for dynamic provisioning",
      },
    },
    {
      type: "callout",
      tone: "key",
      title: "Delete is the default: protect real data",
      text: "Dynamically provisioned volumes usually inherit reclaimPolicy: Delete from their StorageClass, so deleting a PVC can permanently destroy the disk. For anything you cannot lose, use a StorageClass (or patch the PV) with Retain.",
    },
    {
      type: "heading",
      id: "statefulset-storage",
      text: "Per-replica storage with volumeClaimTemplates",
    },
    {
      type: "paragraph",
      text: "A Deployment's replicas are interchangeable and share nothing, so they cannot each own a distinct disk. A StatefulSet gives every replica a stable identity and, via volumeClaimTemplates, its own PVC. Kubernetes creates one PVC per replica named <template>-<statefulset>-<ordinal> (for example data-web-0, data-web-1), and a rescheduled Pod re-attaches to the same PVC, so web-0 always gets web-0's data.",
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
          note: "NOT under template.spec.volumes: it is a top-level StatefulSet field",
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
      text: "By default the PVCs created from volumeClaimTemplates are NOT deleted when you scale down or delete the StatefulSet: this protects data, but leaves orphaned PVCs (and disks, and bills) behind. Kubernetes 1.27+ adds persistentVolumeClaimRetentionPolicy to opt into automatic cleanup on scale-down or delete.",
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
        "reclaimPolicy: Delete (the dynamic default) can destroy your disk when the PVC is deleted: use Retain for data you cannot lose.",
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
          note: "the identity object itself: namespaced, so it lives in exactly one namespace",
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
          note: "run as this identity: without this the Pod uses the namespace 'default' ServiceAccount",
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
      text: "Every namespace has a 'default' ServiceAccount, and Pods that omit serviceAccountName use it. It has no extra powers: it is just an unnamed identity. Give workloads their own named ServiceAccount so you can grant and audit permissions per workload.",
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
          note: "a namespaced permission set: only valid inside its own namespace",
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
          note: "an allow-list: RBAC has no deny rules, so anything not listed is forbidden",
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
          note: "WHICH permission set: this reference is immutable after creation",
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
          note: "A valid Role with no rules. It grants nothing: a subject bound to it is still fully denied.",
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
          text: "The request is described as (subject, verb, apiGroup, resource, namespace, name): for example inspector wants to 'list' 'pods' in 'dev'.",
        },
        {
          title: "Check RBAC rules",
          text: "The authorizer looks for any binding that grants this subject a rule whose apiGroups, resources, and verbs all match the request. RBAC is purely additive across all matching bindings.",
        },
        {
          title: "Allow or deny",
          text: "If at least one rule matches, the request is allowed. If none match, it is denied: RBAC never has explicit deny rules, so absence of a grant is the denial.",
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
        code: 'rules:\n  - apiGroups: ["*"]\n    resources: ["*"]\n    verbs: ["*"]\n# cluster-admin over everything: \n# a leaked token owns the cluster',
      },
      right: {
        title: "Scoped to the job",
        code: 'rules:\n  - apiGroups: [""]\n    resources: ["pods"]\n    verbs: ["get", "list", "watch"]\n# read-only pods, one namespace: \n# a leaked token can only look',
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
        "A RoleBinding always resolves a Role reference in its OWN namespace. This binding lives in dev, so it looks for a Role named pod-reader in dev, but the Role only exists in prod, so roleRef matches nothing and grants nothing. Kubernetes does not error on the dangling reference. Fix it by either creating the pod-reader Role in dev, or converting pod-reader to a ClusterRole and referencing it (a RoleBinding can bind a ClusterRole, limiting it to dev).",
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
        "A rule is the intersection of apiGroups, resources, and verbs: a request is allowed only if all three match one rule.",
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
            "A Role is still namespaced even with wildcards, so it cannot cover cluster-scoped Nodes, and wildcards violate least privilege.",
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
          note: "A plain Pod with no securityContext. It runs as whatever user the image declares: frequently root (UID 0): with the full default capability set and a writable root filesystem. This is the blast radius you are trying to shrink.",
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
      text: "runAsNonRoot: true does not choose a UID: it tells the kubelet to refuse the container if it would resolve to UID 0. runAsUser: 1000 actually sets the UID. If the image's default user is root and you set runAsNonRoot: true without runAsUser, the container fails to start with 'container has runAsNonRoot and image will run as root'. Set both, or bake a non-root USER into the image.",
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
      text: "Setting a good securityContext is voluntary: nothing forces a team to do it. Pod Security Admission (PSA) is the built-in admission controller that makes it mandatory per namespace. It checks every incoming Pod against one of three Pod Security Standards and can reject, audit, or warn. You turn it on with labels on the Namespace; no extra install, no webhook.",
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
            "Everything: no restrictions at all. Permits privileged containers, host namespaces, host paths, and any capability.",
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
        "The same container, before and after hardening: the left form is rejected by a restricted namespace.",
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
        'privileged: true is a hard violation: restricted (and even baseline) forbid privileged containers outright. But this Pod fails on more than that: restricted also requires runAsNonRoot: true (the image would otherwise run as root), allowPrivilegeEscalation: false, capabilities.drop of ALL, and a seccompProfile of RuntimeDefault or Localhost. PSA rejects the whole Pod at admission, so it never appears in kubectl get pods. Fix: remove privileged, add pod-level runAsNonRoot: true with a non-zero runAsUser and seccompProfile.type: RuntimeDefault, and container-level allowPrivilegeEscalation: false plus capabilities.drop ["ALL"].',
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
        "runAsNonRoot: true only refuses UID 0: pair it with runAsUser (non-zero) or a non-root image USER to actually set the identity.",
        "The restricted standard wants runAsNonRoot, allowPrivilegeEscalation: false, drop ALL capabilities, and seccompProfile RuntimeDefault.",
        "Pod Security Admission enforces a standard (privileged, baseline, or restricted) per namespace via labels: enforce blocks, audit logs, warn notifies.",
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
            "This makes the root filesystem immutable: valuable, but it limits writes, not privilege escalation.",
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
            "Pod Security Admission reads the enforce label off the Namespace and blocks non-compliant Pods at admission: no webhook or install needed.",
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
          text: "Use the warn label: it blocks non-compliant Pods.",
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
        "A namespace starts default-allow. The moment ANY NetworkPolicy selects a Pod for a direction (Ingress or Egress), that direction flips to default-deny for that Pod: only traffic matching an allow rule is permitted, everything else is dropped. Policies are additive allow-lists: there is no explicit 'deny' rule.",
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
      text: "A NetworkPolicy is only a declaration. Enforcement is the job of the cluster's CNI plugin (Calico, Cilium, Antrea, Weave, and others). If the installed CNI does not implement NetworkPolicy: plain flannel, for example: the API server accepts your object and reports success, but zero packets are ever filtered. A 'working' policy that does nothing is almost always an unsupported CNI.",
    },
    {
      type: "heading",
      id: "policy-directions",
      text: "Ingress, egress, and policyTypes",
    },
    {
      type: "paragraph",
      text: "A policy governs two independent directions. Ingress rules describe who may connect INTO the selected Pods; egress rules describe where the selected Pods may connect OUT to. The policyTypes list declares which directions this policy is responsible for, and this is where the most useful behavior lives.",
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
      text: "An empty podSelector ({}) is not 'select nothing': it matches every Pod in the policy's namespace. That is exactly what you want for a namespace-wide baseline, and exactly the surprise that makes a narrow policy accidentally apply to everything. Read {} as 'all Pods here', and read a missing key as a match-nothing typo.",
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
          note: "policies are namespaced: they only select Pods in this namespace",
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
          note: "Start by choosing WHO this policy protects. With Ingress named but no rules, this already denies all ingress to api Pods: a scoped deny-all.",
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
        "The moment this Egress policy selects the web Pods, ALL egress not explicitly allowed is denied, including DNS. Web can only send to api:8080, so its lookups to kube-dns (UDP and TCP port 53 in kube-system) are dropped and 'api-svc' never resolves. Fix: add a second egress rule allowing port 53 to the DNS Pods, e.g. 'to: - namespaceSelector matching kube-system' with 'ports: - {protocol: UDP, port: 53}' and the TCP 53 variant. Whenever a policy governs egress, remember to allow DNS.",
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
        "Policies are additive allow-lists: no deny rule exists. Build a deny-all baseline, then poke narrow holes with allow policies.",
        "podSelector: {} selects every Pod in the namespace; naming a direction in policyTypes with no rules denies that whole direction.",
        "Peer selectors AND when in the same list item and OR across separate items; podSelector is same-namespace, namespaceSelector spans namespaces, ipBlock covers CIDRs.",
        "Any egress policy that selects a Pod also blocks its DNS: always allow port 53 to kube-dns, and confirm your CNI actually enforces NetworkPolicy.",
      ],
    },
    {
      type: "quiz",
      id: "network-policy-q1",
      question: "A namespace has no NetworkPolicies. What traffic is allowed between its Pods?",
      options: [
        {
          id: "a",
          text: "All traffic: Pods are default-allow until a policy selects them.",
          correct: true,
          explanation:
            "With no policy selecting a Pod, both ingress and egress are unrestricted. Isolation begins only when a policy selects the Pod for that direction.",
        },
        {
          id: "b",
          text: "No traffic: Kubernetes denies all Pod traffic by default.",
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
      text: "A Pod's spec.nodeName is empty when you create it. The kube-scheduler watches for exactly these unbound Pods, picks a node for each one, and writes that choice into the Pod's binding. Everything in this lesson: nodeSelector, affinity, taints and tolerations, topology spread: is a way to influence that single decision without hard-coding a node name. Nothing here starts, stops, or moves a container by itself; the scheduler only decides placement, and the kubelet on the chosen node does the running.",
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
          text: "Hard rules run first and eliminate nodes: does the node have enough allocatable CPU/memory for the Pod's requests, does it match nodeSelector and required node affinity, does the Pod tolerate the node's taints, are required volumes attachable? A node that fails any filter is out. If zero nodes survive, the Pod stays Pending: this is where most 'why won't it schedule' incidents live.",
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
      text: "nodeSelector is the simplest placement control: a map of label key/value pairs the node must have. It is exact-match and AND-only: every pair must be present on the node, and it is always a hard requirement with no soft fallback. If nothing matches, the Pod stays Pending. Reach for it only when your rule really is 'this exact label must be present'; the moment you need OR logic, ranges, or a preference, you have outgrown it and want affinity.",
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
      text: "Affinity comes in two families. Node affinity matches labels on nodes with real operators: In, NotIn, Exists, DoesNotExist, Gt, Lt, so you can say 'a zone in this set' or 'a GPU count greater than 0'. Pod affinity and anti-affinity instead match labels on other Pods already running in a topology domain, letting you co-locate related Pods or, far more commonly, spread replicas apart with anti-affinity. Both families offer a required form (a hard filter) and a preferred form (a soft score with a weight from 1-100). The clumsy suffix requiredDuringSchedulingIgnoredDuringExecution means the rule is enforced at scheduling time but ignored afterward: relabel a node and an already-running Pod is not evicted.",
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
          note: "HARD: a filter: no matching node means the Pod stays Pending",
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
          note: "In/NotIn/Exists/DoesNotExist/Gt/Lt: richer than nodeSelector's exact match",
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
      text: "requiredDuringScheduling... is evaluated during filtering: if no node satisfies it, the Pod never schedules and sits Pending indefinitely; the scheduler will not relax it. preferredDuringScheduling... is evaluated during scoring: unmatched nodes simply get fewer points, so the Pod still lands somewhere. Use required for genuine hard constraints (GPU present, correct architecture) and preferred for 'nice to have' placement, so a full or missing preferred zone degrades gracefully instead of wedging the Pod.",
    },
    {
      type: "concept",
      term: "topologyKey (pod (anti-)affinity)",
      definition:
        "Pod affinity and anti-affinity are always relative to a topology domain named by topologyKey: a node label such as kubernetes.io/hostname (per-node) or topology.kubernetes.io/zone (per-zone). 'Anti-affinity with topologyKey: kubernetes.io/hostname against app=web' means: do not place two web Pods on the same node. Get the topologyKey wrong and you spread across the wrong dimension (e.g. per-node when you meant per-zone).",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "Grow a placement policy in three stages",
      stages: [
        {
          label: "Start with a hard requirement",
          note: "The workload must run on SSD nodes, full stop. A required node affinity makes that a filter: no SSD node, no scheduling.",
          code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  affinity:\n    nodeAffinity:\n      requiredDuringSchedulingIgnoredDuringExecution:\n        nodeSelectorTerms:\n          - matchExpressions:\n              - key: disktype\n                operator: In\n                values:\n                  - ssd\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0",
        },
        {
          label: "Add a soft preference",
          note: "Among the SSD nodes, we would rather use zone us-east-1a, but we are fine elsewhere if it is full. That is a preferred rule with a weight, so it only shifts the score.",
          code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  affinity:\n    nodeAffinity:\n      requiredDuringSchedulingIgnoredDuringExecution:\n        nodeSelectorTerms:\n          - matchExpressions:\n              - key: disktype\n                operator: In\n                values:\n                  - ssd\n      preferredDuringSchedulingIgnoredDuringExecution:\n        - weight: 50\n          preference:\n            matchExpressions:\n              - key: topology.kubernetes.io/zone\n                operator: In\n                values:\n                  - us-east-1a\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0",
        },
        {
          label: "Tolerate the reserved-node taint",
          note: "The SSD nodes are tainted dedicated=web:NoSchedule so only this app uses them. Affinity alone still cannot land there: add a matching toleration to get past the taint.",
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
      text: "Affinity and nodeSelector are the Pod reaching toward nodes. Taints are the opposite: a property on a node that repels Pods unless they carry a matching toleration. You taint a node with kubectl taint nodes node1 dedicated=web:NoSchedule. The effect is the important part. NoSchedule blocks new Pods without a matching toleration but leaves already-running Pods alone. PreferNoSchedule is the soft version: the scheduler avoids the node during scoring but will use it if it must. NoExecute is the strong one: it blocks new Pods AND evicts already-running Pods that do not tolerate it, honoring an optional tolerationSeconds grace period before eviction. Control-plane nodes and not-ready/unreachable nodes carry these taints by default.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "A toleration permits, it does not attract",
      text: "Tolerating a taint only removes the barrier: it does not make the scheduler prefer that node. A Pod that merely tolerates dedicated=web can still be placed anywhere else in the cluster. To truly reserve a node for one workload you need BOTH: a taint to keep everyone else off, and nodeSelector or node affinity on the intended Pods to pull them onto it. And beware NoExecute: adding that taint (or using kubectl taint with :NoExecute) will evict running Pods that lack the toleration.",
    },
    {
      type: "heading",
      id: "topology-spread",
      text: "topologySpreadConstraints: even distribution",
    },
    {
      type: "paragraph",
      text: "Anti-affinity can say 'not two on the same node', but it is coarse. topologySpreadConstraints express balance directly: keep the number of matching Pods within maxSkew across a set of topology domains. maxSkew: 1 over topology.kubernetes.io/zone means the busiest and least-busy zone may differ by at most one Pod. whenUnsatisfiable decides how hard the rule is: DoNotSchedule makes it a filter (a Pod that would violate the skew stays Pending), while ScheduleAnyway makes it a scoring preference. labelSelector defines which Pods count toward the skew: usually your own workload's labels.",
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
            "Hard only: no soft variant",
            "Pod spec, targets node labels",
            "The rule is a simple, exact label match and you never need a fallback",
          ],
        },
        {
          label: "Affinity / anti-affinity",
          cells: [
            "Attract or repel using operators against node labels (node affinity) or other Pods' labels in a topology domain (pod affinity)",
            "Both: required (hard filter) or preferred (soft, weighted 1-100)",
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
        "The rule is requiredDuringScheduling..., which the scheduler evaluates during the filtering phase. It demands a node labeled disktype=ssd, but all three nodes are disktype=hdd, so every node is filtered out as infeasible and the Pod never reaches scoring: it sits Pending forever, and nothing self-heals it. Fixes, in order of least surprise: label a node to match (kubectl label node <name> disktype=ssd); or relax the rule to preferredDuringScheduling... so an hdd node is merely down-ranked instead of rejected; or correct the values to a label your nodes actually have. The same Pending pattern appears with taints: if the only ssd node were tainted and this Pod had no matching toleration, describe would instead read 'node(s) had untolerated taint {…}'. Always read the FailedScheduling message: it names the exact filter that rejected each node.",
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
        "The same zone rule, expressed as required vs preferred node affinity: very different failure behavior.",
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
        "The scheduler runs one decision per unbound Pod: filter nodes to the feasible set, score the survivors, bind the best: hard rules filter, soft rules score.",
        "nodeSelector is exact-match and hard-only; node affinity adds operators and both required (hard) and preferred (soft, weighted) forms.",
        "Pod affinity/anti-affinity work relative to a topologyKey; topologySpreadConstraints (maxSkew + whenUnsatisfiable) express even distribution directly.",
        "Taints repel Pods; a toleration only permits, it never attracts: reserving a node needs a taint AND affinity/nodeSelector on the intended Pods.",
        "NoSchedule blocks new Pods, PreferNoSchedule is a soft avoid, and NoExecute also evicts running Pods that lack the toleration.",
        "A Pod stuck Pending is almost always a hard rule with no feasible node: read the FailedScheduling event to see which filter rejected each node.",
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
        "Observe a metric, compare to a target, write a new replica count, let the Deployment controller reconcile, then repeat.",
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
        "When you target CPU 'Utilization', the number is a percentage of each Pod's CPU REQUEST: not of the node, not of a core. averageUtilization: 60 means 'keep average CPU near 60% of the requested amount'. This is why a resource request is mandatory: with no request there is no denominator, so utilization is undefined.",
    },
    {
      type: "heading",
      id: "hpa-anatomy",
      text: "Anatomy of an HPA",
    },
    {
      type: "paragraph",
      text: "Read every HPA through four lenses: what it scales (scaleTargetRef), the floor and ceiling (minReplicas/maxReplicas), the signal (metrics), and how eagerly it reacts (behavior). The autoscaling/v2 API is the current one: v1 only supported a single CPU target.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A complete HorizontalPodAutoscaler",
      caption: "An HPA targeting a Deployment on average CPU utilization.",
      lines: [
        {
          code: "apiVersion: autoscaling/v2",
          note: "use v2: it supports memory, multiple metrics, and scaling behavior",
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
          note: "WHAT to scale: must point at an object with a scale subresource (Deployment, ReplicaSet, StatefulSet)",
        },
        {
          code: "    apiVersion: apps/v1",
        },
        {
          code: "    kind: Deployment",
        },
        {
          code: "    name: web",
          note: "the Deployment name: NOT a label selector; the HPA drives its replica count directly",
        },
        {
          code: "  minReplicas: 2",
          note: "the floor: the HPA will never scale below this, even at zero load",
        },
        {
          code: "  maxReplicas: 10",
          note: "the ceiling: a hard cap that protects the cluster from a runaway scale-up",
        },
        {
          code: "  metrics:",
          note: "the signal(s): if multiple are listed the HPA takes the LARGEST resulting replica count",
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
          note: "Point at the Deployment and set a floor and ceiling. This is already valid, but with no metrics it just holds replicas between 2 and 10: it will not react to load yet.",
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
        "The container declares no resources.requests.cpu. A Utilization target is a percentage of the requested CPU, so with no request there is no denominator and the HPA cannot compute utilization: TARGETS reports <unknown>/60% and it will not scale on that metric. Fix: add resources.requests.cpu (for example 100m) to the container. Once a request exists, metrics-server-reported usage divided by the request gives a real percentage and the HPA starts scaling.",
    },
    {
      type: "heading",
      id: "vpa-and-ca",
      text: "The other two autoscalers",
    },
    {
      type: "paragraph",
      text: "The VerticalPodAutoscaler recommends and (in Auto mode) applies better CPU/memory requests by evicting and recreating Pods with new values: it right-sizes Pods rather than adding them. The Cluster Autoscaler works one level down: when Pods are stuck Pending because no node has room, it asks the cloud provider to add nodes, and it removes nodes that stay underutilized. HPA reacts in seconds, VPA over minutes, and the Cluster Autoscaler on the timescale of provisioning a VM.",
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
            "Workloads that are hard to replicate: right-sizing requests",
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
        "HPA changes replica count, VPA changes per-Pod requests, Cluster Autoscaler changes node count: three axes, three controllers.",
        "A Utilization target is a percentage of the Pod's CPU/memory request, so the target's containers MUST declare requests or the HPA reports <unknown> and never scales.",
        "desiredReplicas = ceil(currentReplicas * currentMetric / targetMetric), always clamped to minReplicas..maxReplicas.",
        "Use behavior.scaleDown.stabilizationWindowSeconds to stop thrashing; scale-up stays fast by default.",
        "Never point an HPA and an Auto-mode VPA at the same metric/resource: they will fight over the same signal.",
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
      text: "Every running Pod eventually goes away, but the cause matters. Involuntary disruptions are things nobody scheduled: a node kernel panic, hardware loss, the network partitioning, or the kubelet evicting under memory pressure. Voluntary disruptions are actions an operator or controller deliberately takes: draining a node for a kernel upgrade, scaling the cluster down, or deleting a Pod during a rollout. A PodDisruptionBudget (PDB) is the one lever you have to say how much voluntary disruption an application can absorb at once, and it does nothing about the involuntary kind.",
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
      text: "kubectl drain does two things: it cordons the node (marks it unschedulable) and then evicts every Pod on it. Crucially, drain does not DELETE Pods directly: it POSTs to the eviction subresource (the Eviction API). For each request, the API server checks whether removing that Pod would violate any PDB matching it. If it would, the API returns 429 Too Many Requests and drain backs off and retries. So a PDB never blocks the failure itself; it throttles the rate at which cooperative tooling is allowed to take Pods down.",
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
            "No: bypasses the PDB",
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
      text: "A PDB has exactly two moving parts, which Pods it guards (selector) and how many must stay up (a budget expressed as either minAvailable or maxUnavailable: never both). The selector, like a Service selector, matches Pod labels, not Deployments or ReplicaSets by name.",
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
          note: "HOW the PDB finds Pods: must match the workload's Pod labels exactly",
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
          note: "A valid object shell: the GA apiVersion, the kind, and a name. It guards nothing yet: no selector and no budget.",
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
      text: "minAvailable: 2 with 5 replicas means up to 3 can be evicted at once. maxUnavailable: 1 with 5 replicas means only 1 at a time: the other 4 must stay up. Both accept an integer or a percentage (maxUnavailable: 25%). Percentages are rounded, and maxUnavailable rounds so that at least one Pod is always kept available. Prefer maxUnavailable for autoscaled workloads so the budget stays correct when the replica count moves.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Watch status.disruptionsAllowed",
      text: "kubectl get pdb shows ALLOWED DISRUPTIONS: roughly (current healthy Pods) minus minAvailable. When it reads 0, the next eviction returns 429 and a drain will hang indefinitely. Also note only Ready Pods count toward availability, so a workload stuck NotReady can silently freeze all maintenance.",
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
        "minAvailable: 2 equals the replica count of 2. disruptionsAllowed is 2 - 2 = 0, so the eviction API returns 429 for every attempt and the drain deadlocks: there is never a spare Pod to give up. The budget is mathematically impossible to satisfy while evicting anything. Fix it by loosening the budget (minAvailable: 1, or better maxUnavailable: 1) so one Pod can move at a time, or by scaling the Deployment above the floor before draining.",
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
        "kubectl delete pod bypasses the eviction API and ignores PDBs: only cooperative tooling honors the budget.",
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
            "Involuntary losses like a kernel panic never consult the PDB: the Pods are simply gone.",
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
      text: "The single most important distinction: a ResourceQuota sums usage across every object in the namespace and rejects the request that would push the total past its hard limits. A LimitRange never looks at the total: it inspects one container or Pod at a time and applies defaults or min/max bounds to that object alone.",
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
        "ResourceQuota tracks the running total for the namespace and rejects creation when the total would exceed hard. LimitRange evaluates a single object and either mutates it (defaults) or rejects it (min/max): it has no notion of the namespace total.",
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
      text: "This is the rule people trip over. The moment a namespace has a ResourceQuota that tracks a compute resource (requests.cpu, requests.memory, limits.cpu, or limits.memory), the quota admission controller must be able to count every new Pod, so it REQUIRES each container to declare the matching request/limit. A Pod that omits them is rejected with a Forbidden error, even if the namespace is nearly empty.",
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
          note: "Now the namespace total for CPU/memory requests is bounded. Side effect, because a compute resource is tracked, every new Pod must now specify requests.cpu and requests.memory or it is rejected.",
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
      caption: "Each entry under limits applies to a type of object: here, every Container.",
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
      text: "Creating or tightening a ResourceQuota only affects future create/update requests. Pods that already exceed the new limits keep running: Kubernetes will not evict them. To reclaim over-quota usage you must delete or rescale the offending workloads yourself. Check current usage with kubectl describe resourcequota team-quota -n team-a.",
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
        'The container declares no resources.requests or resources.limits. Because the namespace has a compute ResourceQuota, the quota admission controller must count this Pod\'s CPU/memory usage and cannot, so it rejects it: pods "worker" is forbidden: failed quota: team-quota: must specify limits.memory,requests.cpu. Two fixes: (1) add an explicit resources block with requests and limits to the container, or (2) create a LimitRange with defaultRequest and default in team-a. The LimitRange mutates the Pod at admission, filling in the missing values before the quota is checked, so it succeeds automatically.',
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
        "Quotas apply only to new create/update requests: they never evict Pods that already exceed the limits.",
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
            "That removes the guardrail entirely: the namespace could then consume unbounded resources.",
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
      text: "Kubernetes is not a fixed set of objects: it is an extensible API server with a control-loop model. Three mechanisms turn it into a platform. A CustomResourceDefinition (CRD) teaches the API server a brand-new object kind. A controller (often called an Operator) watches instances of that kind and reconciles the real world toward them. Admission controllers sit on the write path and can mutate or reject any request before it is stored. Together they let you manage databases, backups, or certificates with the same kubectl apply workflow you already use for Pods.",
    },
    {
      type: "steps",
      items: [
        {
          title: "CRD",
          text: "Registers a new resource type with a group, versions, a schema, and an API path, so the API server can store and serve it.",
        },
        {
          title: "Custom resource",
          text: "An instance of that new type, such as a BackupPolicy or DatabaseCluster object, stored in etcd like any built-in object.",
        },
        {
          title: "Operator",
          text: "A controller that watches those custom resources and drives external or complex state to match: the CRD is data, the Operator is behavior.",
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
          note: "CRDs live in the apiextensions group: this manifest creates the type, not an instance",
        },
        {
          code: "kind: CustomResourceDefinition",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: backuppolicies.ops.klab.io",
          note: "MUST be exactly <spec.names.plural>.<spec.group>: the API server rejects any other name",
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
          note: "Namespaced or Cluster: decides whether instances live in a namespace",
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
          note: "EXACTLY ONE version has storage: true: the form persisted in etcd",
        },
        {
          code: "      schema:",
        },
        {
          code: "        openAPIV3Schema:",
          note: "structural schema: the API server validates instances against it and prunes unknown fields",
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
      text: "Once the CRD is established, an instance looks like any other object. Its apiVersion is <group>/<version> and its kind matches names.kind. The API server validates it against the CRD schema and stores it, but nothing acts on it until a controller is watching.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A BackupPolicy instance",
      caption: "An instance of the type the CRD defined.",
      lines: [
        {
          code: "apiVersion: ops.klab.io/v1",
          note: "<group>/<version> from the CRD: NOT v1 and NOT apiextensions.k8s.io",
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
          note: "required by the schema: omit it and the create is rejected",
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
          note: "Name the type: the metadata.name must be <plural>.<group>, and names.kind is what instances use. Not servable yet: no versions.",
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
      text: "A CRD by itself only lets you store and retrieve objects: it is inert. The Operator pattern adds a controller that runs a reconciliation loop: watch BackupPolicy objects, compare desired state (the spec) to observed reality, and take action (create a CronJob, call a backup API, update status). This is the exact same control-loop model the built-in Deployment and ReplicaSet controllers use: just aimed at a custom domain.",
    },
    {
      type: "diagram",
      variant: "control-loop",
      title: "Operator as another controller",
      caption:
        "Watch the custom resource, diff desired vs actual, act, and record status, then repeat.",
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
      text: "Installing a CRD only adds a new API type: kubectl apply of a custom resource will succeed and store the object even if nothing ever acts on it. The Operator (a controller watching that type) is what turns the stored intent into real changes. Missing behavior almost always means the controller is not running, not that the CRD is wrong.",
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
            "If kubectl apply succeeded and the schema passed, the object is stored: storage is not the missing piece.",
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
      text: "Every create/update/delete travels a fixed pipeline inside the API server: authentication, then authorization, then the admission chain, then persistence to etcd. Admission is where policy lives. Dynamic admission uses webhooks: external HTTPS endpoints the API server calls. Mutating webhooks run first and may patch the object (inject a sidecar, set a default). Then the object is checked against the OpenAPI/structural schema. Finally validating webhooks run and may only accept or reject. Nothing reaches etcd until the whole chain passes.",
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
            "First: before schema validation and validating webhooks",
            "Yes: returns a JSON patch that modifies the object",
            "Injecting sidecars, setting defaults, adding labels/annotations",
          ],
        },
        {
          label: "Validating webhook",
          cells: [
            "Last: after mutation and schema validation",
            "No: may only allow or deny",
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
          text: "The Pod is admitted: mutation adds the label before validation checks it.",
          correct: true,
          explanation:
            "Mutating webhooks always run first, so the label exists by the time the validating webhook inspects the object.",
        },
        {
          id: "b",
          text: "The Pod is rejected: validation runs before mutation.",
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
        "The metadata.name must be exactly <spec.names.plural>.<spec.group>. Here the plural is 'backuppolicies' and the group is 'ops.klab.io', so the name must be 'backuppolicies.ops.klab.io', but it says 'backuppolicy.ops.klab.io' (the singular). Change metadata.name to backuppolicies.ops.klab.io.",
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
        "A custom resource is inert data until a controller (Operator) runs a reconciliation loop over it: the CRD is data, the Operator is behavior.",
        "Operators use the same level-triggered control-loop as built-in controllers; the difference is they run as Pods you deploy and own.",
        "Admission webhooks run on the write path before persistence: mutating first (can patch), then schema validation, then validating (accept or reject only).",
        "Webhooks are on the critical path: a broken one with failurePolicy: Fail can block writes cluster-wide, so scope and time them out carefully.",
      ],
    },
  ],
  labs: [],
};

export const OPERATIONS_LESSONS = compileLessons([
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
]);
