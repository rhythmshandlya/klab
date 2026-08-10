import type { Mission } from "@/lib/domain/mission-types";

export const apiObjects: Mission = {
  slug: ["foundations", "api-objects"],
  section: "Foundations",
  order: 4,
  title: "API Objects",
  coldOpen: {
    goal: "Read your live Deployment's spec against its status, then scale it to three replicas by editing YAML.",
    clusterNote:
      "Your cluster runs the Deployment `web` at two replicas. You will inspect its shape and grow it.",
  },
  inheritsCluster: true,
  concepts: ["api-objects", "spec-vs-status", "gvk"],
  steps: [
    {
      kind: "teach",
      id: "five-fields",
      idea: "Kubernetes has no special-case commands. Every resource is one record shaped the same way: apiVersion and kind name the type, metadata identifies it, spec is your intent, status is observed reality. Read one object and you can read them all.",
      visual: { mode: "concept", variant: "api-object", buildToStep: 0 },
      ack: "Show me",
    },
    {
      kind: "teach",
      id: "spec-vs-status",
      idea: "You author apiVersion, kind, metadata, and spec. You never write status — controllers and the kubelet do. Any status you type into a manifest is discarded on apply.",
      visual: { mode: "concept", variant: "api-object", buildToStep: 1 },
    },
    {
      kind: "check",
      id: "check-which-field",
      quiz: {
        question: "Which field should your application manifest actually edit?",
        options: [
          {
            id: "a",
            text: "status",
            correct: false,
            explain:
              "status is written by controllers and the kubelet; anything you put there on apply is discarded.",
          },
          {
            id: "b",
            text: "spec",
            correct: true,
            explain:
              "spec is the desired state you declare — the one part of the object you are meant to author.",
          },
          {
            id: "c",
            text: "both equally",
            correct: false,
            explain: "You own spec; the system owns status. They are not symmetric.",
          },
        ],
      },
    },
    {
      kind: "teach",
      id: "gvk",
      idea: "apiVersion + kind form the GroupVersionKind that routes your request. Core resources (Pod, Service, ConfigMap) use bare 'v1'; named groups carry a prefix — a Deployment is apps/v1. Get this wrong and the API server cannot even find the type.",
      visual: { mode: "concept", variant: "api-object", buildToStep: 2 },
    },
    {
      kind: "predict",
      id: "predict-status-update",
      predict: {
        question:
          "You raise spec.replicas from 2 to 3 and apply. How does status.readyReplicas reach 3?",
        options: [
          {
            id: "a",
            text: "The controller creates a Pod and updates status as it becomes Ready",
            correct: true,
            explain:
              "status is observed: the controller acts on the new spec, and the count climbs as reality catches up.",
          },
          {
            id: "b",
            text: "You must also set status.readyReplicas: 3 in the manifest",
            correct: false,
            explain: "status is never authored — a value you type there is stripped on apply.",
          },
        ],
        reveal:
          "You only change spec. Controllers create the third Pod, and status.readyReplicas rises to 3 on its own once it is Ready.",
      },
    },
    {
      kind: "do",
      id: "do-scale",
      goal: "The team needs more capacity. Edit spec.replicas from 2 to 3 and apply, then watch status catch up to your new intent.",
      files: [
        {
          path: "web-deployment.yaml",
          initialValue:
            "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\n  labels:\n    app: web\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: web\n      tier: frontend\n  template:\n    metadata:\n      labels:\n        app: web\n        tier: frontend\n    spec:\n      containers:\n        - name: web\n          image: klab/web-app:1.0.0\n          ports:\n            - containerPort: 8080\n",
          language: "yaml",
        },
      ],
      check: { kind: "deployment-available", name: "web", minAvailable: 3 },
      hint: "Find spec.replicas, change 2 to 3, and apply. You never touch status — the controller updates it for you.",
      debrief:
        "You changed one number in spec and the controller did the rest. status.readyReplicas is a readout of reality, not a knob — you moved the intent and the observed state followed.",
    },
    {
      kind: "debrief",
      id: "wrap",
      summary: "Your Deployment now runs three replicas, scaled purely by editing spec.",
      commands: ["kubectl get deployment web -o yaml", "kubectl get pods -l tier=frontend"],
      takeaways: [
        "Every resource shares the same top-level fields: apiVersion, kind, metadata, spec, and (usually) status.",
        "apiVersion + kind form the GVK that routes your request; a Deployment is apps/v1, a Pod is bare v1.",
        "You author metadata and spec; you never write status — controllers report it.",
        "To change behavior, edit spec and apply; status then reports whether reality caught up.",
      ],
    },
  ],
};
