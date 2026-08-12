import type { DocsLesson } from "@/lib/domain/types";

import { compileLessons } from "./authoring";

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
      text: "Duration 21 minutes. 100% of checkout requests failed with 503. Root cause: a label refactor changed the Deployment's Pod template labels but not the Service selector, so the EndpointSlice controller could not match any Pods. No data was lost: this was a pure routing outage.",
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
          label: "02:14: Alert fires",
          detail:
            "Synthetic checkout probe reports 503s. The Service DNS name resolved fine, so this was not a DNS problem: the request reached the Service and died there.",
          command: "curl -s -o /dev/null -w '%{http_code}\\n' http://web-svc/",
          output: "503",
        },
        {
          label: "02:16: Check endpoints first",
          detail:
            "Before touching pods, ask whether the Service has any backends at all. This one had none.",
          command: "kubectl get endpoints web-svc",
          output: "NAME      ENDPOINTS   AGE\nweb-svc   <none>      42d",
        },
        {
          label: "02:18: Describe the Service",
          detail: "Read the selector the Service is actually using. It selects app=web.",
          command: "kubectl describe svc web-svc",
          output:
            "Name:       web-svc\nSelector:   app=web\nType:       ClusterIP\nPort:       http 80/TCP\nTargetPort: 8080/TCP\nEndpoints:  <none>",
        },
        {
          label: "02:21: Inspect the Pods and their labels",
          detail:
            "The Pods are Running and Ready, but their labels read app=web-frontend, not app=web. That single mismatch is the whole outage.",
          command: "kubectl get pods --show-labels",
          output:
            "NAME                   READY   STATUS    LABELS\nweb-7d9c8b6f5-abcde    1/1     Running   app=web-frontend,pod-template-hash=7d9c8b6f5\nweb-7d9c8b6f5-fghij    1/1     Running   app=web-frontend,pod-template-hash=7d9c8b6f5",
        },
        {
          label: "02:33: Recovery",
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
      text: "A Service does not know about Pods directly. The EndpointSlice controller continuously watches for Pods whose labels match the Service's selector AND that report Ready, then publishes their IPs as endpoints. kube-proxy programs those endpoints into the dataplane. Break either link: the label match or the readiness gate, and the endpoint list goes empty. Empty endpoints is the symptom; a selector mismatch or NotReady Pods is the cause.",
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
          note: "Pods now carry app=web-frontend: the new name",
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
          note: "STILL the old name: matches zero Pods, so endpoints = <none>",
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
        "The Service selector is app=web, but the Pods are labeled app=web-frontend. Selector matching is exact and key-for-key, so the EndpointSlice controller finds no matching Pods and publishes zero endpoints. The Pods being Ready is irrelevant: they were never candidates. Fix: change the Service selector to app: web-frontend (or re-align the Pod labels back to app: web), so the two agree.",
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
          note: "now identical to the Pod template label: endpoints populate within a second",
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
          note: "matches containerPort: unchanged, and never the real fault here",
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
      text: "Selector mismatch (no Pod matches) and readiness failure (Pods match but none are Ready) produce the identical <none> symptom. `kubectl get pods --show-labels` distinguishes them: if labels don't match the selector it's a selector bug; if they match but READY shows 0/1 it's a readiness bug: check the readinessProbe path and target port.",
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
            "Point readinessProbe at a real ready endpoint (klab/web-app:1.0.0 returns 200 on /healthz but 404 on /readyz: a probe on /readyz keeps every Pod NotReady forever)",
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
        "A Service selector and the target Pod labels are a coupled contract: change one side and you must change the other.",
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
          text: "Align the selector and Pod labels: set the Service selector to app=web-frontend (or relabel the Pods to app=web).",
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
            "More Pods with the wrong label still match zero: scaling can't fix a selector mismatch.",
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
      text: "At 14:02 the pager fired: checkout p99 latency jumped from 80ms to 900ms and a fraction of requests began timing out. No deploy had gone out. CPU dashboards looked calm: average utilisation across the Pods sat near 20% of their limit. Adding replicas barely helped. The culprit was not a lack of Pods; it was a CPU limit throttling each Pod for tens of milliseconds at a time. This postmortem walks the timeline, the root cause, the fix, and how to stop it recurring.",
    },
    {
      type: "demo",
      title: "Incident timeline",
      description:
        "How the on-call engineer went from a latency alert to the throttling root cause.",
      steps: [
        {
          label: "14:02: Alert",
          detail: "p99 latency SLO breached. Error rate climbing from client-side timeouts.",
          command: "kubectl -n shop get deploy checkout",
          output:
            "NAME       READY   UP-TO-DATE   AVAILABLE   AGE\ncheckout   6/6     6            6           40d",
        },
        {
          label: "14:06: Rule out a bad rollout",
          detail:
            "No recent change; all Pods Ready. Average CPU is well under the limit, so this does not look like classic saturation.",
          command: "kubectl -n shop top pod -l app=checkout",
          output:
            "NAME             CPU(cores)   MEMORY\ncheckout-7c...   58m          210Mi\ncheckout-9d...   61m          208Mi",
        },
        {
          label: "14:11: Scaling up does little",
          detail:
            "More replicas spread load but each Pod is still individually throttled during request bursts, so tail latency stays high.",
          command: "kubectl -n shop scale deploy checkout --replicas=10",
          output: "deployment.apps/checkout scaled",
        },
        {
          label: "14:18: Read the throttling metric",
          detail:
            "Inside a Pod, the cgroup CPU stats show the container is being throttled in most scheduling periods.",
          command: "kubectl -n shop exec checkout-7c... -- cat /sys/fs/cgroup/cpu.stat",
          output: "nr_periods 48210\nnr_throttled 41880\nthrottled_usec 903221000",
        },
        {
          label: "14:25: Root cause + fix",
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
      text: "The reason this incident looked so confusing is that CPU and memory fail in completely different ways. Kubernetes treats CPU as a compressible resource: when a container wants more than its limit, the kernel simply pauses it: it slows down but keeps running. Memory is incompressible: there is no way to give a process 'less' of the memory it already wrote, so exceeding a memory limit ends with the kernel killing the container (OOMKilled).",
    },
    {
      type: "concept",
      term: "Compressible resource",
      definition:
        "A resource that can be throttled and handed back over time without destroying work in progress. CPU is compressible: the scheduler withholds CPU time and the process stalls, then resumes. Because it is never killed for exceeding a CPU limit, the symptom is latency, not a crash.",
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
      text: "A CPU limit is enforced by the Linux CFS bandwidth controller, not by a magic average. The kernel divides time into periods (default 100ms) and grants the container a quota of CPU-time per period equal to its limit. A limit of 250m means 0.25 CPU-seconds per second, i.e. 25ms of CPU time in every 100ms period. Once the container spends that 25ms, it is throttled: frozen until the next period begins. Requests behave differently: a request is used for scheduling and to set the container's relative CPU weight; it does not cap anything.",
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
          note: "THE BUG: 25ms of CPU per 100ms period: a short burst blows the quota and stalls the Pod for the rest of the period",
        },
        {
          code: "              memory: 256Mi",
          note: "memory limit is fine to keep: it protects the node and OOMKills a leak instead of throttling",
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
      text: "The dashboards showed ~60m average against a 250m limit, so the team assumed there was headroom. But averages hide bursts. Real CPU usage is spiky: a single checkout request might need a 40ms burst on one core. Within a 100ms period the container spends its 25ms quota after 25ms of that burst and is throttled for the remaining ~75ms: adding tens of milliseconds of pure wait to that request. Averaged over a whole second, utilisation still looks like 20% while p99 latency has quietly exploded.",
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
        "The cpu limit of 250m is the problem. It caps the container at 25ms of CPU per 100ms CFS period. A bursty request handler exhausts that quota partway through a burst and is throttled (paused) for the rest of the period, adding large tail latency and occasionally starving the readiness probe: all while the one-second average stays low and the container is never killed. Zero restarts + high throttled-period ratio confirms throttling, not OOM. Fix: raise the request to match real steady-state need and raise or remove the CPU limit.",
    },
    {
      type: "heading",
      id: "the-fix",
      text: "The fix",
    },
    {
      type: "paragraph",
      text: "Two changes fixed it. First, the request was raised to reflect what a Pod actually needs at steady state, so the scheduler places it on a node with real CPU to give and its relative weight under contention is honest. Second, the punishingly tight CPU limit was removed: for a latency-sensitive service that already has an honest request, a CPU limit mostly buys throttling with no upside. The memory limit stayed, because memory is incompressible and you still want a leak to be OOMKilled rather than take down the node.",
    },
    {
      type: "compare",
      caption: "Same workload, resources rewritten. Left throttles; right does not.",
      left: {
        title: "Before: throttled",
        code: "resources:\n  requests:\n    cpu: 100m\n    memory: 128Mi\n  limits:\n    cpu: 250m      # 25ms / 100ms\n    memory: 256Mi",
      },
      right: {
        title: "After: right-sized",
        code: "resources:\n  requests:\n    cpu: 500m      # honest steady-state\n    memory: 256Mi\n  limits:\n    # cpu limit removed on purpose\n    memory: 512Mi  # keep the memory limit",
      },
    },
    {
      type: "callout",
      tone: "info",
      title: "Removing the CPU limit is not 'no limits'",
      text: "The request still guarantees CPU under contention and drives scheduling and the CPU weight, so a Pod without a CPU limit cannot freely starve its neighbours: it only gets to use idle CPU that would otherwise go to waste. If your platform requires limits (e.g. a Guaranteed QoS mandate, where limits must equal requests), set the CPU limit generously above the observed p99 burst rather than at the average. Keep the memory limit either way.",
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
            "Throttled: paused by CFS, stays Running, latency spikes",
            "OOMKilled: container terminated and restarted",
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
            "Always set it: it caps a leak and protects the node",
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
        "CPU is compressible: exceeding a CPU limit throttles (pauses) the container: it stays Running with zero restarts. Memory is incompressible: exceeding a memory limit OOMKills it.",
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
            "That ratio measures the fraction of scheduling periods in which the container was paused: the direct fingerprint of throttling.",
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
            "Restarts indicate crashes or OOMKills, not throttling: a throttled container keeps running.",
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
          title: "13:52: NetworkPolicy applied",
          text: "A default-deny egress policy is rolled out to the payments namespace to lock down outbound traffic ahead of an audit. It allows egress to the ledger app on TCP 8080 and nothing else.",
        },
        {
          title: "14:02: Alerts fire",
          text: "Every payments Pod reports request failures. Error rate for the namespace hits 100%. On-call is paged with 'payments down'.",
        },
        {
          title: "14:06: First wrong theory",
          text: "The team suspects CoreDNS crashed. But CoreDNS Pods in kube-system are Running, 0 restarts, and Pods in other namespaces resolve names fine. The blast radius is exactly one namespace.",
        },
        {
          title: "14:14: Real cause found",
          text: "A shell inside a payments Pod shows dig timing out against 10.96.0.10:53. The recently applied NetworkPolicy has no egress rule for port 53 to kube-dns.",
        },
        {
          title: "14:19: Mitigation",
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
            "dig hangs and returns no answer. The query to the cluster DNS ServiceIP never gets a response: a classic dropped-packet signature, not NXDOMAIN.",
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
        "podSelector: {} selects every Pod in the namespace, and listing Egress in policyTypes switches the namespace from allow-all-egress to deny-all-egress-except-what-is-listed. The only allowed egress is TCP 8080 to app: ledger. DNS lives in kube-system (CoreDNS, reached on UDP/TCP port 53 via the kube-dns ServiceIP) and is not in the allow list, so every DNS query is dropped. Applications cannot resolve any name: internal or external. The fix is to add an egress rule permitting UDP and TCP port 53 to the kube-dns Pods before applying any default-deny egress policy.",
    },
    {
      type: "callout",
      tone: "key",
      title: "The one rule every egress policy needs",
      text: "The moment you put Egress in a NetworkPolicy's policyTypes, that namespace denies all outbound traffic that is not explicitly allowed, and DNS is outbound traffic. Always pair a default-deny egress policy with an allow rule for UDP and TCP port 53 to CoreDNS, or nothing in the namespace will resolve a name.",
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
          note: "policies are namespaced: this only affects Pods in payments",
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
          note: "auto-applied label on every namespace (1.21+): reliable to select kube-system",
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
          note: "the label CoreDNS Pods carry: narrows egress to just the DNS Pods",
        },
        {
          code: "      ports:",
        },
        {
          code: "        - protocol: UDP",
          note: "the primary DNS transport: most queries go over UDP 53",
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
      text: "Even after DNS egress was restored, the incident review found CoreDNS was running hot: far more queries than the traffic justified. The cause is how Kubernetes builds a Pod's /etc/resolv.conf. Each query name is expanded against a list of search domains, and the ndots option decides when. With ndots:5, any name containing fewer than 5 dots is first tried as a relative name against every search domain before it is ever tried as an absolute name. That is great for short in-cluster names but expensive for external ones.",
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
          note: "the cluster DNS ServiceIP (kube-dns): all queries go here",
        },
        {
          code: "search payments.svc.cluster.local svc.cluster.local cluster.local",
          note: "suffixes tried, in order, for relative names: this is why 'web-svc' resolves",
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
        code: "1) api.stripe.com   -> answer\n# trailing dot means ndots is ignored\n# 1 query (x2 for A + AAAA): no wasted lookups",
      },
    },
    {
      type: "callout",
      tone: "warning",
      title: "ndots:5 multiplies external lookups",
      text: "Every external hostname with fewer than 5 dots generates one query per search domain before the real one: often 4x the traffic, doubled again for A and AAAA records. On a busy namespace this can push CoreDNS into throttling. Use a trailing dot on known-external names (api.stripe.com.) or lower ndots via dnsConfig for Pods that mostly talk to the internet.",
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
            "Easy to forget: bake it into policy templates and CI checks",
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
        "Listing Egress in a NetworkPolicy's policyTypes makes the namespace deny outbound by default: forget UDP/TCP 53 to kube-dns and every name in the namespace stops resolving.",
        "Triage DNS and routing as separate layers: dig proves resolution, curl proves reachability. A timeout on dig points at drops (policy/CNI), NXDOMAIN points at a wrong name.",
        "ndots:5 turns each external hostname into a burst of search-domain lookups; a trailing dot or a lower ndots removes the waste.",
        "CoreDNS is a shared, cluster-wide dependency: cache it with NodeLocal DNSCache and scale it before it becomes a single point of failure.",
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
            "CoreDNS is healthy and other namespaces resolve fine, so the DNS service itself is up: the blast radius is one namespace.",
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

export const INCIDENT_LESSONS = compileLessons([serviceHadNoEndpoints, cpuThrottling, dnsOutage]);
