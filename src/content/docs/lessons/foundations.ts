import type { DocsLesson } from "@/lib/domain/types";

import { compileLessons, WEB_IMAGE, WEB_POD, WEB_DEPLOYMENT } from "./authoring";

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
      text: "A single container on a laptop is easy: you run it and watch it. Production is not that. You have dozens of containers spread over many machines, and each one can crash, get OOM-killed, or land on a node that fills up. If you manage this by hand you are forever answering the same questions, which machine has room, what do I restart when a process dies, how do clients find a container whose IP just changed, and how do I ship a new version without an outage. Container orchestration is the job of answering those questions automatically, continuously, for you.",
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
        "Controllers watch desired vs. observed state and act to close the gap: forever, not once.",
    },
    {
      type: "concept",
      term: "Reconciliation",
      definition:
        "A controller is a loop that reads the desired state, observes the actual state, and takes one step to reduce the difference, then repeats. Nothing runs 'once and done'; the loop keeps running, which is exactly why a Pod you delete out of a managed set comes back.",
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
          text: "A Deployment can shift traffic from an old Pod template to a new one gradually, and roll back if the new version fails its health checks: no big-bang replacement.",
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
      text: "You express desired state as API objects, and every object: Pod, Service, Deployment: shares the same four-part skeleton: apiVersion, kind, metadata, and spec. Learn to read those four fields and you can read any manifest, even for a resource you have never seen.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A minimal Pod",
      caption: "The smallest useful desired-state object: the four fields every manifest carries.",
      lines: [
        {
          code: "apiVersion: v1",
          note: "which API group and version validates this object: a Pod lives in the core group, so it is v1 (not apps/v1)",
        },
        {
          code: "kind: Pod",
          note: "which kind of object you are declaring; the API server routes to the matching controller",
        },
        {
          code: "metadata:",
          note: "identity: name, namespace, and labels: how everything else refers to this object",
        },
        {
          code: "  name: web",
        },
        {
          code: "  labels:",
          note: "arbitrary key:value tags: Services and controllers select objects by these",
        },
        {
          code: "    app: web",
        },
        {
          code: "spec:",
          note: "the DESIRED state: what you want to be true; the cluster works to make it so",
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
          note: "Start with the three fields that name the object, which API version, which kind, and a name. This is not yet runnable: there is no spec, so nothing to run.",
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
        "The imperative script runs once and is forgotten. The declarative object is stored and continuously enforced: that persistence is the whole point.",
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
        "The apiVersion is wrong. A Pod belongs to the core API group, whose version is simply v1: not apps/v1. The apps/v1 group is for higher-level workloads like Deployments, ReplicaSets, and StatefulSets. Change apiVersion: apps/v1 to apiVersion: v1 and the object validates. The kind and apiVersion must together name a real registered resource.",
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
      text: "A Kubernetes cluster splits into two halves. The control plane stores the cluster's state and makes every decision about what should run where. The worker nodes are the machines that actually run your containers. You almost never talk to a node directly: you send a desired state to the API server, and a chain of specialized components turns that intent into running Pods.",
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
      text: "The control plane is not one program: it is a handful of independent components, each with a narrow job. They coordinate entirely through the API server, never by calling each other.",
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
          text: "A consistent, highly-available key-value store. It is the backing store for all cluster data: every Pod, Service, Secret, and ConfigMap lives here. If etcd is lost and unbacked-up, the cluster's state is gone.",
        },
        {
          title: "kube-scheduler",
          text: "Watches for newly created Pods that have no node assigned (empty spec.nodeName) and picks a node for each one, honoring resource requests, affinity, and taints. It decides where; it does not start anything.",
        },
        {
          title: "kube-controller-manager",
          text: "Runs the built-in controllers as continuous reconciliation loops: node, replicaset, deployment, job, endpointslice, service-account, and more. Each loop drives actual state toward desired state.",
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
          text: "The agent on each node. It watches the API server for Pods bound to its node, tells the runtime to start their containers, runs liveness/readiness probes, and reports observed status back to the API server. It never invents work: it executes what the control plane assigned.",
        },
        {
          title: "kube-proxy",
          text: "Programs each node's network rules (iptables or IPVS) so that traffic to a Service's ClusterIP is load-balanced to the current set of Ready backend Pods. Some CNI plugins replace it.",
        },
        {
          title: "container runtime",
          text: "The software that actually runs containers: containerd or CRI-O. The kubelet talks to it through the Container Runtime Interface (CRI) to pull images and manage container lifecycles.",
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
            "The deployment controller sees the new Deployment and creates a ReplicaSet; the ReplicaSet controller then creates the Pods it needs: each with an empty spec.nodeName.",
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
            "The kubelet on node-1 sees a Pod bound to it, has the runtime pull the image and start containers, runs the probes, and reports status.phase: Running back to the API server, which stores it in etcd.",
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
        "A Bind is the tiny API write the scheduler makes to set a Pod's spec.nodeName. Scheduling is literally just choosing a node and writing that one field: the kubelet on that node does everything after.",
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
      caption: "Who wrote each field: you, the scheduler, or the kubelet.",
      lines: [
        {
          code: "apiVersion: v1",
        },
        {
          code: "kind: Pod",
        },
        {
          code: "metadata:",
          note: "you author identity: name and namespace",
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
          note: "your desired containers: the part you actually wrote",
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
          note: "The scheduler chose node-1 and wrote spec.nodeName. Still Pending: nothing has started yet, but the Pod now belongs to a node.",
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
        "spec.nodeName is hard-coded to node-9, which doesn't exist. Setting nodeName yourself bypasses the scheduler and binds the Pod directly to that name, but no kubelet is running as node-9, so nothing ever picks the Pod up and it stays Pending. Remove nodeName and let the scheduler choose a real node (or use nodeSelector/affinity to influence the choice).",
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
      hint: "Use spec.nodeSelector with the label, and leave nodeName unset so the scheduler still does the placement: it just restricts itself to matching nodes.",
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
        "The API server is the only component that touches etcd: everything else watches and writes through the API.",
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
            "Assigning a node is the scheduler's job. An empty nodeName means the Pod was never bound: check for unschedulable resources, taints, or a scheduler that is down.",
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
      text: "Every managed object carries two halves of a story. The spec is what you asked for. The status is what Kubernetes currently observes. The whole system is machinery for driving the gap between those two to zero, and keeping it there.",
    },
    {
      type: "diagram",
      variant: "control-loop",
      title: "The reconciliation control loop",
      caption:
        "Observe actual state, diff it against spec, act to close the gap: forever, not once.",
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
          note: "bumps every time you change spec: the version number of your intent",
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
          note: "observed: only 2 are passing readiness right now: a live gap vs desired",
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
          note: "a rolled-up verdict computed from observed state: you never set this by hand",
        },
      ],
    },
    {
      type: "concept",
      term: "Reconciliation loop",
      definition:
        "A controller's core routine: read the current actual state, diff it against the desired spec, take the smallest actions to close the gap, then repeat. It is level-triggered: it looks at where things ARE, not at a queue of past events, so a missed signal simply gets corrected on the next pass.",
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
      text: "To change what the cluster does, edit the spec of the owning object and apply. Do not hand-edit the Pods a controller created: the controller owns them and will reconcile your change away. The spec is the single source of truth; live objects are just its current shadow.",
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
      text: "The loop enforces the spec even when the spec is what's wrong. If you deploy a broken image, Kubernetes will faithfully keep trying to run it, restarting the crashing Pods forever. Self-healing restores desired state: it does not judge whether your desired state is a good idea.",
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
        "The desired count was written under status instead of spec. status is observed output owned by Kubernetes: the API server ignores (strips) what you put there, so it never becomes intent. With no spec.replicas, the Deployment defaults to 1 and the loop dutifully holds it at 1. Fix: move replicas: 4 up under spec, and delete the status block entirely.",
    },
    {
      type: "heading",
      id: "try-it",
      text: "Try it: watch a gap close",
    },
    {
      type: "paragraph",
      text: "Open the lab below. Change spec.replicas from 3 to 5 and apply. Watch status.readyReplicas climb as the controller creates Pods until actual state matches your declared intent, then try deleting a Pod and watch it come back.",
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
      hint: "You only author metadata and spec. Never write a status block: Kubernetes fills that in. spec needs replicas, selector.matchLabels, and a template whose Pod labels match the selector.",
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
            "The controller recreates it from the same spec: a safe, deliberate self-heal",
          ],
        },
        {
          label: "status shows readyReplicas 2/3",
          cells: [
            "Nothing in status: investigate the lagging Pod",
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
        "spec is intent you write; status is observed reality Kubernetes writes: never hand-edit status to fix things.",
        "Controllers run a continuous reconciliation loop: observe, diff, act, repeat. It is level-triggered, so it self-corrects.",
        "Drift closes automatically: delete a Pod and it comes back, but self-healing enforces even a bad spec.",
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
            "The edit was saved: it was then overwritten by reconciliation because it conflicted with the owner's spec.",
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
      text: "Kubernetes has no special-case commands. A Pod, a Service, a Deployment, a ConfigMap, a Node: all of them are just records in one REST API, stored in etcd, and shaped the same way. Once you can read one object, you can read them all, because every object shares the same five top-level fields.",
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
      text: "Read any manifest through five lenses. apiVersion and kind together name the type (the API server uses them to route the request). metadata carries identity: name, namespace, labels, annotations. spec is the desired state you declare. status is the observed state controllers write back. You author the first four; you never write status.",
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
          note: "queryable identity: selectors and controllers match on these key:value pairs.",
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
          note: "reality caught up with spec.replicas: the Deployment is healthy.",
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
      text: "status is a read-only projection of reality maintained by controllers and the kubelet. Any status you type into a manifest is discarded on apply. When something is wrong, spec is your question and status is Kubernetes' answer: compare the two before you touch anything else.",
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
          note: "The minimum that addresses an object: apiVersion + kind name the type, metadata.name names the instance. This alone is a valid, findable object: it just does nothing yet.",
          code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web",
        },
        {
          label: "Declare intent (spec)",
          note: "Add spec: the desired state. Now the object asks Kubernetes for one container running the web image. The kubelet will try to make this real.",
          code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\nspec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0",
        },
        {
          label: "Status appears (you didn't write it)",
          note: "After you apply, the kubelet reports back. status.phase and podIP show up on their own: proof that status is observed, not authored.",
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
      hint: "ConfigMap is a core-group resource, so its apiVersion is bare 'v1'. It has no spec: its payload lives under a top-level data field.",
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
        "You author apiVersion, kind, metadata, and spec. You never write status: controllers do.",
        "Core resources (Pod, Service, ConfigMap) use bare 'v1' and /api/v1; named groups (apps/v1, batch/v1) use a group prefix and /apis.",
        "kubectl is just a REST client: it maps an object to a URL and a verb to an HTTP method: run with -v=8 to watch it.",
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
            "Spec is the desired state you declare: the one part of the object you are meant to author.",
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
            "This drops the group name and the namespace scoping: it is not a valid resource path.",
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
            "Yes: Services, controllers, kubectl -l, NetworkPolicies",
            "No: never used for selection or routing",
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
        title: "labels: identifying",
        code: "metadata:\n  labels:\n    app: web\n    tier: frontend\n    release: canary",
      },
      right: {
        title: "annotations: non-identifying",
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
          note: "identity within a namespace: controllers generate this suffix, you rarely type it",
        },
        {
          code: "  namespace: default",
        },
        {
          code: "  labels:",
          note: "IDENTIFYING: the only metadata selectors can match on",
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
          note: "NON-identifying: free-form, never selected, can be large",
        },
        {
          code: '    kubectl.kubernetes.io/last-applied-configuration: \'{"apiVersion":"v1",...}\'',
          note: "written by kubectl apply so it can compute a 3-way diff; pure context, never a selector target",
        },
        {
          code: "    checksum/config: 9f2b1c4e",
          note: "a config hash: changing it forces the template to differ so a rollout triggers",
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
          note: "the KIND of the parent: here a Pod is owned by a ReplicaSet",
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
      text: "A selector is a query over labels, and Kubernetes supports two flavors. Equality-based selectors match exact key/value pairs (app=web, tier!=cache): this is what a Service's spec.selector uses. Set-based selectors match membership (environment in (prod, qa)), exclusion (tier notin (cache)), and key existence (partition, or !partition for absence): used by Deployments, kubectl -l, and NetworkPolicies. Multiple requirements are ANDed together, so every clause must hold for an object to match.",
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
      text: "Every clause in a selector must match for an object to be selected, and matching is exact: key AND value, character for character. Extra labels on the object are ignored, but a single typo, a value in annotations instead of labels, or a case mismatch means zero matches. When a Service shows zero endpoints, compare its spec.selector against the Pod's metadata.labels first.",
    },
    {
      type: "heading",
      id: "ownership-and-gc",
      text: "Ownership and garbage collection",
    },
    {
      type: "paragraph",
      text: "You create a Deployment; you never create the Pods. The Deployment controller creates a ReplicaSet, and the ReplicaSet creates Pods, stamping each child with an ownerReference back to its parent. This tree is what the garbage collector walks: delete the Deployment and the collector removes the ReplicaSet it owns, which removes the Pods that ReplicaSet owns. Nothing is deleted by name-guessing: the collector follows ownerReference UIDs. An object whose every owner is gone becomes garbage and is collected automatically.",
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
      text: "Background (the kubectl default): the parent is deleted immediately and the collector removes children asynchronously afterward. Foreground (--cascade=foreground): the parent is marked with a deletion timestamp and is not actually removed until every blockOwnerDeletion child is deleted first: useful when order matters. Orphan (--cascade=orphan): the parent is deleted but ownerReferences are stripped from the children, so they keep running with no owner. Orphaning a ReplicaSet leaves its Pods live and unmanaged: an easy way to leak workloads.",
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
        "tier: frontend is under annotations, not labels. Selectors only match labels, and annotations are never selected on, so the selector tier: frontend matches nothing and the EndpointSlice controller publishes zero endpoints. Move tier: frontend up into metadata.labels (the Pod can keep app: web too: extra labels are ignored by the selector).",
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
        "Selectors are ANDed and exact: one wrong key, value, or a value stranded in annotations means zero matches.",
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
      text: "kubectl apply creates the object if it does not exist and updates it if it does. Running it twice is safe and idempotent: the second run reports 'unchanged' rather than an error. kubectl create, by contrast, errors with AlreadyExists on the second run. That single difference is why apply is the backbone of every GitOps and CI pipeline.",
    },
    {
      type: "heading",
      id: "apply-loop",
      text: "The apply loop",
    },
    {
      type: "paragraph",
      text: "Apply is not a fire-and-forget mutation. It feeds a new desired state into the same reconciliation loop that drives everything else in Kubernetes: the API server records what you want, controllers observe the gap between desired and actual, and they act until the two converge. Your job is to make that desired state deliberate: render it, review the diff, apply it, then verify the real effect.",
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
        "A self-describing manifest: named, labeled, and image-pinned: is the thing you commit to git and apply from CI. Every field is state apply keeps enforcing on each run.",
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
          note: "immutable after creation: apply cannot change it, so get it right the first time",
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
          note: "pin an explicit tag: a floating tag like :latest makes applies non-deterministic and defeats diffs",
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
        "On a client-side apply, kubectl stores the manifest you sent in the annotation kubectl.kubernetes.io/last-applied-configuration and diffs your next file against it to learn which fields YOU manage. A field you dropped from the file is removed; a field a controller added is left alone because it never appeared in your snapshot. This is also why you should apply from the very first run: kubectl create never writes that annotation, so a later apply has no merge base and can mis-handle deletions.",
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
      text: "Apply adds and updates, but by default it never deletes. If you remove a manifest from your directory, the object it created keeps running: orphaned from your source of truth. kubectl apply --prune closes that gap: it deletes objects that match a label selector but are no longer present in the applied set.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "--prune is scoped by a label selector, and that is the trap",
      text: "kubectl apply --prune -l app=web -f dir/ will delete ANY object carrying app=web that is not in dir/, including things you never meant to manage from that directory. A too-broad selector has taken out live workloads. Prune only with a narrow, dedicated label, and diff first.",
    },
    {
      type: "heading",
      id: "kustomize",
      text: "Kustomize: one base, many overlays",
    },
    {
      type: "paragraph",
      text: "Copy-pasting a manifest per environment guarantees they drift apart. Kustomize (built into kubectl via -k) keeps one base and layers small, environment-specific overlays on top. The base holds what every environment shares; each overlay patches only what differs: replica counts, images, resource limits.",
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
          note: "overlays/prod references the base and patches ONLY what prod changes: here, replicas up to 5. The patch matches the base object by kind + name.",
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
            "The live cluster object: nothing on disk",
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
        "Always render, diff, apply, then verify: a clean diff proves intent, not that traffic actually works.",
        "Client-side apply diffs against the last-applied-configuration annotation; server-side apply tracks per-field ownership in managedFields and surfaces conflicts.",
        "Apply never deletes by default: use --prune with a narrow label to remove objects that left the files, and treat the selector scope with respect.",
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
            "create is not idempotent and abandons apply's merge and ownership tracking entirely: it does not fix the underlying disagreement.",
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

export const FOUNDATIONS_LESSONS = compileLessons([
  whatIsKubernetes,
  clusterArchitecture,
  desiredVsActual,
  apiObjects,
  labelsAnnotationsOwnership,
  declarativeWorkflow,
]);
