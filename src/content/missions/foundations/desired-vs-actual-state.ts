import type { Mission } from "@/lib/domain/mission-types";

export const desiredVsActualState: Mission = {
  slug: ["foundations", "desired-vs-actual-state"],
  section: "Foundations",
  order: 3,
  title: "Desired State vs Actual State",
  coldOpen: {
    goal: "Replace your fragile hand-made Pods with a Deployment that keeps two replicas of `web` alive on its own.",
    clusterNote:
      "Your cluster runs two bare Pods you placed by hand. Nothing replaces them if they die. A Deployment will now own the desired count for you.",
  },
  inheritsCluster: true,
  concepts: ["reconciliation", "deployments", "self-healing"],
  steps: [
    {
      kind: "teach",
      id: "declare-wish",
      idea: "Every managed object carries two halves of a story. spec is what you asked for; status is what Kubernetes currently observes. The whole system is machinery for driving the gap between them to zero, and keeping it there.",
      visual: { mode: "concept", variant: "control-loop", buildToStep: 0 },
      ack: "Show me",
    },
    {
      kind: "teach",
      id: "level-triggered",
      idea: "A controller's loop is level-triggered: it looks at where things ARE, diffs against spec, takes the smallest action to close the gap, then repeats. Delete a managed Pod and it simply gets recreated on the next pass.",
      visual: { mode: "concept", variant: "control-loop", buildToStep: 1 },
    },
    {
      kind: "predict",
      id: "predict-heal",
      visual: { mode: "concept", variant: "control-loop", buildToStep: 2 },
      predict: {
        question:
          "A Deployment declares replicas: 2. Someone deletes one of its Pods. What happens next?",
        options: [
          {
            id: "a",
            text: "The controller creates a replacement to get back to 2",
            correct: true,
            explain:
              "Actual (1) no longer matches desired (2), so the loop creates one more Pod. That is self-healing.",
          },
          {
            id: "b",
            text: "Nothing: a human must notice and recreate it",
            correct: false,
            explain:
              "That would be imperative. The reconciliation loop runs continuously with no human in the way.",
          },
        ],
        reveal:
          "The loop notices replicas dropped below the desired count and recreates a Pod. Drift closes automatically.",
      },
    },
    {
      kind: "teach",
      id: "pets-vs-cattle",
      idea: "A bare Pod is a pet: if it dies, nobody replaces it. A Deployment manages cattle: interchangeable Pods stamped from one template that it recreates on demand. Durable workloads should be cattle, never pets.",
    },
    {
      kind: "check",
      id: "check-scale-up",
      quiz: {
        question: "A Deployment says replicas: 2, but only 1 Pod exists. What should happen next?",
        options: [
          {
            id: "a",
            text: "The controller creates 1 more Pod",
            correct: true,
            explain:
              "The Deployment and ReplicaSet controllers reconcile actual replicas toward the desired count.",
          },
          {
            id: "b",
            text: "kubectl must manually start a container",
            correct: false,
            explain:
              "kubectl only submits desired state; controllers do the ongoing work of closing the gap.",
          },
          {
            id: "c",
            text: "Nothing, until you restart the Deployment",
            correct: false,
            explain: "The loop runs continuously; no restart is needed for reconciliation to act.",
          },
        ],
      },
    },
    {
      kind: "do",
      id: "do-deployment",
      goal: "Apply a Deployment for `web` with replicas: 2. It stamps out two self-healing Pods labeled tier: frontend: the resilient replacement for your hand-made ones.",
      files: [
        {
          path: "web-deployment.yaml",
          initialValue:
            "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\n  labels:\n    app: web\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: web\n      tier: frontend\n  template:\n    metadata:\n      labels:\n        app: web\n        tier: frontend\n    spec:\n      containers:\n        - name: web\n          image: klab/web-app:1.0.0\n          ports:\n            - containerPort: 8080\n",
          language: "yaml",
        },
      ],
      check: { kind: "pods-ready", selector: { app: "web", tier: "frontend" }, minReady: 2 },
      hint: "Apply as-is. The Deployment owns a ReplicaSet, which creates two Pods carrying tier: frontend. Watch the ready count climb to 2.",
      debrief:
        "The Deployment now holds two replicas for you. Your two hand-made Pods (labeled only app: web) are now redundant pets: in a real cluster you would run `kubectl delete pod web web-2` to retire them and let the cattle carry the load.",
    },
    {
      kind: "debrief",
      id: "wrap",
      summary: "A Deployment now owns `web` and keeps two replicas alive without you.",
      commands: ["kubectl get deploy,rs,pods", "kubectl delete pod web web-2"],
      takeaways: [
        "spec is intent you write; status is observed reality Kubernetes writes: never hand-edit status to fix things.",
        "Controllers run a continuous, level-triggered reconciliation loop: observe, diff, act, repeat, so it self-corrects.",
        "Drift closes automatically: delete a managed Pod and the loop recreates it.",
        "Prefer cattle over pets: a Deployment recreates its Pods, a bare Pod is gone for good.",
      ],
    },
  ],
};
