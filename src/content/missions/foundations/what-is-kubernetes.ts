import type { Mission } from "@/lib/domain/mission-types";

export const whatIsKubernetes: Mission = {
  slug: ["foundations", "what-is-kubernetes"],
  section: "Foundations",
  order: 1,
  title: "What is Kubernetes?",
  coldOpen: {
    goal: "Boot your very first workload: get one Pod running in an empty cluster.",
    clusterNote: "You start with an empty cluster. By the end of Foundations it will run a real service.",
  },
  inheritsCluster: false,
  seedManifests: [],
  concepts: ["pods", "declarative-config", "reconciliation"],
  steps: [
    { kind: "teach", id: "intro", idea: "Kubernetes keeps your apps running by constantly comparing what you asked for against what is actually running — and fixing the gap.", visual: { mode: "concept", variant: "control-loop", buildToStep: 0 }, ack: "Show me" },
    { kind: "teach", id: "declare", idea: "You describe desired state in YAML. You never start containers by hand; you declare what should exist.", visual: { mode: "concept", variant: "control-loop", buildToStep: 1 } },
    { kind: "predict", id: "predict-reconcile", visual: { mode: "concept", variant: "control-loop", buildToStep: 2 }, predict: {
      question: "You ask for 3 replicas and one Pod crashes. What does Kubernetes do?",
      options: [
        { id: "a", text: "Nothing — you must restart it", correct: false, explain: "That would be imperative. Kubernetes is declarative." },
        { id: "b", text: "Starts a replacement to get back to 3", correct: true, explain: "Exactly — the control loop reconciles actual back to desired." },
      ],
      reveal: "The controller notices actual (2) ≠ desired (3) and creates a replacement. That is reconciliation.",
    } },
    { kind: "check", id: "check-object", quiz: {
      question: "In an object's YAML, which part do YOU own?",
      options: [
        { id: "a", text: "status", correct: false, explain: "status is written by controllers, not you." },
        { id: "b", text: "spec", correct: true, explain: "spec is your desired state; status is the observed state." },
        { id: "c", text: "both equally", correct: false, explain: "You own spec; the system owns status." },
      ],
    } },
    { kind: "do", id: "do-first-pod", goal: "Apply this Pod and watch it become Ready. This is your cluster's first workload.", files: [
      { path: "pod.yaml", initialValue: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\n  labels:\n    app: web\nspec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      ports:\n        - containerPort: 8080\n", language: "yaml" },
    ], check: { kind: "pods-ready", selector: { app: "web" }, minReady: 1 }, hint: "Click Apply, then watch the Ready Pods metric. No edits needed for your first one.", debrief: "You declared a Pod and the cluster made it real. You did not start a container — you described one, and the control loop did the rest." },
    { kind: "debrief", id: "wrap", summary: "You now have a running Pod in a cluster you will grow across Foundations.", commands: ["kubectl get pods", "kubectl describe pod web"], takeaways: [
      "Kubernetes is declarative: you own spec, controllers own status.",
      "Reconciliation continuously drives actual state toward desired state.",
      "A Pod is the smallest deployable unit — one or more containers sharing a network identity.",
    ] },
  ],
};
