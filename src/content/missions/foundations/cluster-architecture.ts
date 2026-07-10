import type { Mission } from "@/lib/domain/mission-types";

export const clusterArchitecture: Mission = {
  slug: ["foundations", "cluster-architecture"],
  section: "Foundations",
  order: 2,
  title: "Cluster Architecture",
  coldOpen: {
    goal: "Add a second Pod to your cluster and trace how the control plane schedules and runs it.",
    clusterNote:
      "You inherit the single Pod `web` from mission 1. Now you will watch the machinery that places a second one.",
  },
  inheritsCluster: true,
  concepts: ["cluster-architecture", "scheduling", "reconciliation"],
  steps: [
    {
      kind: "teach",
      id: "intro",
      idea: "A cluster has two halves. The control plane stores state and decides what runs where; the worker nodes actually run your containers. You talk only to the API server.",
      visual: { mode: "concept", variant: "cluster-architecture", buildToStep: 0 },
      ack: "Show me",
    },
    {
      kind: "teach",
      id: "one-gateway",
      idea: "The API server is the single source of truth — the only component that reads and writes etcd. The scheduler, controllers, and kubelets never call each other; they watch the API server and react.",
      visual: { mode: "concept", variant: "cluster-architecture", buildToStep: 1 },
    },
    {
      kind: "predict",
      id: "predict-schedule",
      visual: { mode: "concept", variant: "cluster-architecture", buildToStep: 2 },
      predict: {
        question: "You apply a Pod with no nodeName set. Which component picks the node it runs on?",
        options: [
          { id: "a", text: "The kube-scheduler", correct: true, explain: "The scheduler watches for unbound Pods and writes spec.nodeName. It decides where; it does not start anything." },
          { id: "b", text: "The kubelet on whichever node has room", correct: false, explain: "The kubelet only acts after a node is assigned — it runs containers, it does not choose placement." },
          { id: "c", text: "etcd, since it stores the Pod", correct: false, explain: "etcd only persists data. It makes no scheduling decisions." },
        ],
        reveal: "The scheduler notices the empty nodeName, picks a suitable node, and binds the Pod by writing that one field through the API server.",
      },
    },
    {
      kind: "teach",
      id: "kubelet-runs",
      idea: "Once a node is assigned, the kubelet on that node sees the Pod bound to it, tells the runtime to pull the image and start containers, runs the probes, and reports observed status back to the API server.",
      visual: { mode: "concept", variant: "cluster-architecture", buildToStep: 3 },
    },
    {
      kind: "check",
      id: "check-status-owner",
      quiz: {
        question: "Which component writes Pod health and container state back to the API server?",
        options: [
          { id: "a", text: "kubelet", correct: true, explain: "The kubelet runs on each node and reports observed Pod status, including phase and Ready conditions." },
          { id: "b", text: "etcd", correct: false, explain: "etcd stores data but never runs Pods, executes probes, or reports status." },
          { id: "c", text: "kubectl", correct: false, explain: "kubectl is a client; it submits desired state and does not reconcile or report status." },
        ],
      },
    },
    {
      kind: "do",
      id: "do-second-pod",
      goal: "Apply a second Pod and watch the same pipeline place it: the scheduler binds it, then the kubelet runs it. Your cluster now has two Pods.",
      files: [
        { path: "web-2.yaml", initialValue: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web-2\n  labels:\n    app: web\nspec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      ports:\n        - containerPort: 8080\n", language: "yaml" },
      ],
      check: { kind: "pods-ready", selector: { app: "web" }, minReady: 2 },
      hint: "Apply as-is, then watch the second Pod go Pending (waiting on the scheduler) and then Ready (the kubelet started it). No edits needed.",
      debrief: "Nothing ran the instant you applied. The object was stored, the scheduler bound it to a node, and only then did a kubelet start the container — the same chain every Pod flows through.",
    },
    {
      kind: "debrief",
      id: "wrap",
      summary: "Two Pods now run on your cluster, and you can trace how each one got there.",
      commands: ["kubectl get pods -o wide", "kubectl get events --sort-by=.lastTimestamp"],
      takeaways: [
        "The control plane decides (apiserver, etcd, scheduler, controllers); nodes do the work (kubelet, kube-proxy, runtime).",
        "The API server is the only component that touches etcd — everything else watches and writes through it.",
        "A Pod flows apiserver+etcd store it -> scheduler assigns a node -> kubelet runs it and reports status.",
        "Match a symptom to the component that owns that step: Pending with no node points at the scheduler, not the kubelet.",
      ],
    },
  ],
};
