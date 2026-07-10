import type { Mission } from "@/lib/domain/mission-types";

export const labelsAnnotationsOwnership: Mission = {
  slug: ["foundations", "labels-annotations-ownership"],
  section: "Foundations",
  order: 5,
  title: "Labels, Annotations & Ownership",
  coldOpen: {
    goal: "Fix a mislabeled Pod so the frontend selector can finally see it and route to it.",
    clusterNote:
      "Your cluster runs the Deployment `web` at three replicas, all labeled tier: frontend. A new Pod was added to join them — but its label has a typo.",
  },
  inheritsCluster: true,
  concepts: ["labels-selectors", "annotations", "owners-gc"],
  steps: [
    {
      kind: "teach",
      id: "metadata-roles",
      idea: "Three fields inside metadata quietly run the cluster. Labels are queryable identity — the only thing selectors match on. Annotations are non-identifying context. Owner references wire a child back to the controller that created it.",
      visual: { mode: "concept", variant: "api-object", buildToStep: 0 },
      ack: "Show me",
    },
    {
      kind: "teach",
      id: "label-or-annotation",
      idea: "Ask one question: does anything need to SELECT on this? If yes, it is a label. If it is just context riding along, it is an annotation. A selector is ANDed and exact — key and value, character for character.",
      visual: { mode: "concept", variant: "api-object", buildToStep: 1 },
    },
    {
      kind: "predict",
      id: "predict-selector",
      predict: {
        question: "A Service selects tier: frontend, but a Pod puts tier: frontend under annotations instead of labels. Does the Service route to it?",
        options: [
          { id: "a", text: "No — annotations are never selected on, so it matches nothing", correct: true, explain: "Selectors only read labels. A value stranded in annotations is invisible to selection." },
          { id: "b", text: "Yes — Kubernetes checks both labels and annotations", correct: false, explain: "Annotations are non-identifying by design and are never consulted for selection or routing." },
        ],
        reveal: "The EndpointSlice controller publishes zero endpoints for that Pod. When a selector finds nothing, compare it against the Pod's metadata.labels first.",
      },
    },
    {
      kind: "teach",
      id: "ownership",
      idea: "You create a Deployment; it creates a ReplicaSet; the ReplicaSet creates Pods — each child stamped with an ownerReference to its parent. Deleting the top cascades cleanup down the tree, following UIDs, not names.",
      visual: { mode: "concept", variant: "workload-hierarchy", buildToStep: 2 },
    },
    {
      kind: "check",
      id: "check-cascade",
      quiz: {
        question: "You run `kubectl delete deployment web` with the default cascade policy. What happens to its ReplicaSet and Pods?",
        options: [
          { id: "a", text: "The garbage collector deletes the owned ReplicaSet and Pods in the background", correct: true, explain: "Background is the default: the Deployment is removed immediately and the collector follows ownerReferences to clean up children." },
          { id: "b", text: "They are orphaned and keep running with no owner", correct: false, explain: "That is --cascade=orphan, which strips ownerReferences. It is not the default." },
          { id: "c", text: "Nothing; you must delete every Pod by hand", correct: false, explain: "Cascading deletion is automatic because children carry ownerReferences back up the tree." },
        ],
      },
    },
    {
      kind: "do",
      id: "do-fix-label",
      goal: "This extra Pod should join the frontend, but its label reads tier: fronted — a typo the selector will never match. Fix the label so it becomes the fourth frontend Pod.",
      files: [
        { path: "web-extra.yaml", initialValue: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web-extra\n  labels:\n    app: web\n    tier: fronted\n  annotations:\n    owner: platform-team\nspec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      ports:\n        - containerPort: 8080\n", language: "yaml" },
      ],
      check: { kind: "pods-ready", selector: { app: "web", tier: "frontend" }, minReady: 4 },
      hint: "The three Deployment Pods already carry tier: frontend. Change this Pod's tier: fronted to tier: frontend so the selector counts four. The annotation stays untouched — it is not selected on.",
      debrief: "One character of metadata decided whether this Pod was visible. Selectors match labels exactly; a typo, or a value placed in annotations, means zero matches — which is why a Service with no endpoints is almost always a label problem.",
    },
    {
      kind: "debrief",
      id: "wrap",
      summary: "Four frontend Pods now match the selector, and you know why the fourth was hiding.",
      commands: ["kubectl get pods -l app=web,tier=frontend", "kubectl describe pod web-extra"],
      takeaways: [
        "Ask one question: does anything need to select on this? Yes means label; no means annotation.",
        "Selectors are ANDed and exact — one wrong key or value, or a value stranded in annotations, means zero matches.",
        "ownerReferences build the Deployment -> ReplicaSet -> Pod tree that garbage collection walks by UID.",
        "A Service with no endpoints is almost always a labels-vs-selector mismatch — compare them first.",
      ],
    },
  ],
};
