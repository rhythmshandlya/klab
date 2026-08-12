import type { Mission } from "@/lib/domain/mission-types";

export const declarativeWorkflow: Mission = {
  slug: ["foundations", "declarative-workflow"],
  section: "Foundations",
  order: 6,
  title: "Declarative Workflow",
  coldOpen: {
    goal: "Right-size the Deployment to its reviewed production baseline of two replicas using the diff-then-apply loop.",
    clusterNote:
      "Your cluster's Deployment `web` runs three replicas after the last scale-up. You will bring it to its declared baseline of two.",
  },
  inheritsCluster: true,
  concepts: ["object-management", "apply-diff", "declarative-config"],
  steps: [
    {
      kind: "teach",
      id: "declare-not-command",
      idea: "Imperative commands (create, run, scale, edit) mutate the cluster now and leave no artifact. Declarative apply describes the end state in files that become your reviewable, version-controlled source of truth.",
      visual: { mode: "concept", variant: "control-loop", buildToStep: 0 },
      ack: "Show me",
    },
    {
      kind: "teach",
      id: "apply-loop",
      idea: "apply is not fire-and-forget: it writes desired state into the same reconciliation loop that drives everything. Make the change deliberate: render, diff, apply, then verify. The diff step turns apply from a leap of faith into a reviewed change.",
      visual: { mode: "concept", variant: "control-loop", buildToStep: 1 },
    },
    {
      kind: "predict",
      id: "predict-idempotent",
      predict: {
        question:
          "You run `kubectl apply -f web.yaml` twice with no change to the file. What does the second run report?",
        options: [
          {
            id: "a",
            text: "unchanged: apply is idempotent",
            correct: true,
            explain:
              "apply is create-or-update: with nothing to change, it reports 'unchanged' rather than erroring.",
          },
          {
            id: "b",
            text: "an AlreadyExists error",
            correct: false,
            explain:
              "That is kubectl create. apply updates in place, which is exactly why it backs every GitOps pipeline.",
          },
        ],
        reveal:
          "apply creates the object if absent and updates it if present. Re-running is safe: the backbone of CI and GitOps.",
      },
    },
    {
      kind: "teach",
      id: "prune-and-kustomize",
      idea: "apply never deletes by default: removing a manifest orphans its object, so use --prune with a narrow, dedicated label. And keep one base with small per-environment overlays (Kustomize) so environments never drift apart.",
      visual: { mode: "concept", variant: "control-loop", buildToStep: 2 },
    },
    {
      kind: "check",
      id: "check-diff",
      quiz: {
        question: "Why run `kubectl diff` before `kubectl apply`?",
        options: [
          {
            id: "a",
            text: "To preview exactly which fields will change before mutating the cluster",
            correct: true,
            explain:
              "diff performs the same merge apply would and shows the resulting changes, catching unintended edits before controllers act.",
          },
          {
            id: "b",
            text: "To restart every node in the cluster",
            correct: false,
            explain: "diff is read-only; it never touches nodes.",
          },
          {
            id: "c",
            text: "To edit etcd directly, bypassing the API server",
            correct: false,
            explain: "diff still goes through the API server and changes nothing.",
          },
        ],
      },
    },
    {
      kind: "do",
      id: "do-baseline",
      goal: "Three replicas was a temporary bump. Edit spec.replicas from 3 down to the reviewed baseline of 2 and apply: the diff should read a clean -3 +2 before you commit to it.",
      files: [
        {
          path: "web-deployment.yaml",
          initialValue:
            "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\n  labels:\n    app: web\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: web\n      tier: frontend\n  template:\n    metadata:\n      labels:\n        app: web\n        tier: frontend\n    spec:\n      containers:\n        - name: web\n          image: klab/web-app:1.0.0\n          ports:\n            - containerPort: 8080\n",
          language: "yaml",
        },
      ],
      check: { kind: "deployment-replicas", name: "web", replicas: 2 },
      hint: "Change spec.replicas from 3 to 2 and apply. The image tag stays pinned to 1.0.0 so the diff is deterministic: only the replica count should change. Applying without the edit keeps desired at 3, so the check will hold until you actually right-size it.",
      debrief:
        "You fed a deliberate, diffable change into the reconciliation loop, and it converged to a healthy two-replica Deployment. This same render-diff-apply-verify loop is how every durable change to a cluster should be made.",
    },
    {
      kind: "debrief",
      id: "wrap",
      summary:
        "Foundations complete: your cluster runs a healthy, self-healing two-replica Deployment managed entirely from a version-controlled manifest: the baseline the Workloads section builds on.",
      commands: [
        "kubectl diff -f web-deployment.yaml",
        "kubectl apply -f web-deployment.yaml",
        "kubectl rollout status deployment/web",
      ],
      takeaways: [
        "Imperative commands mutate the cluster now and leave no artifact; declarative apply enforces files that are your source of truth.",
        "Always render, diff, apply, then verify: a clean diff proves intent, not that traffic actually works.",
        "apply is create-or-update and idempotent; it never deletes by default (use --prune with a narrow label).",
        "Kustomize keeps one base and small per-environment overlays so environments never drift apart.",
      ],
    },
  ],
};
