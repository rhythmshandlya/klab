import { parseLesson } from "@/lib/domain/schemas";
import type { DocsLesson } from "@/lib/domain/types";

/**
 * Interactive docs lessons. Content is typed blocks (no MDX build step); every lesson
 * is validated against the Zod schema at module load. Labs use bare Pods so they
 * reconcile promptly in-browser (Deployment ready-count lags — see PROGRESS.md).
 */

const WEB_IMAGE = {
  ref: "klab/web-app:1.0.0",
  description: "Web server: /healthz 200, /readyz 404, / 200.",
};

const POD = `apiVersion: v1
kind: Pod
metadata:
  name: web
  namespace: default
  labels:
    app: web
spec:
  containers:
    - name: web
      image: klab/web-app:1.0.0
      ports:
        - name: http
          containerPort: 8080
      readinessProbe:
        httpGet:
          path: /healthz
          port: 8080
        initialDelaySeconds: 1
        periodSeconds: 3
`;

const SERVICE = `apiVersion: v1
kind: Service
metadata:
  name: web-svc
  namespace: default
spec:
  selector:
    app: web
  ports:
    - name: http
      port: 80
      targetPort: 8080
`;

const desiredVsActual: DocsLesson = {
  slug: ["foundations", "desired-vs-actual-state"],
  title: "Desired State vs Actual State",
  description:
    "Kubernetes is declarative: you describe what you want, and the control plane works to make reality match.",
  section: "Foundations",
  order: 0,
  concepts: ["reconciliation", "pods"],
  content: [
    { type: "heading", id: "what-is-desired-state", text: "What is desired state?" },
    {
      type: "paragraph",
      text: "You never tell Kubernetes to 'start a container' step by step. Instead you declare the desired state — an object describing what should exist — and submit it. Kubernetes stores it and continuously compares it against the actual state of the cluster.",
    },
    {
      type: "compare",
      caption: "You declare the left; the control plane makes the right true.",
      left: {
        title: "Desired (you write)",
        code: "kind: Pod\nspec:\n  containers:\n    - image: web:1",
      },
      right: {
        title: "Actual (the cluster)",
        code: "status:\n  phase: Running\n  conditions:\n    - Ready: True",
      },
    },
    { type: "heading", id: "reconciliation", text: "How reconciliation works" },
    {
      type: "concept",
      term: "Reconciliation loop",
      definition:
        "A controller observes the actual state, diffs it against the desired state, and takes actions to close the gap — over and over. Observe → diff → act.",
    },
    {
      type: "callout",
      tone: "key",
      title: "Key idea",
      text: "If actual state drifts from desired (a pod dies, a probe fails), the control plane notices and reacts. You manage the goal, not the steps.",
    },
    { type: "heading", id: "try-it", text: "Try it" },
    {
      type: "paragraph",
      text: "Apply the Pod below and watch its actual status converge to the desired spec: Pending → Running → Ready.",
    },
    { type: "lab", labId: "reconcile" },
  ],
  labs: [
    {
      id: "reconcile",
      title: "Watch a Pod reconcile",
      prompt: "Apply the Pod and watch its status converge toward Ready.",
      files: [{ path: "pod.yaml", language: "yaml", initialValue: POD }],
      initialManifests: [],
      registeredImages: [WEB_IMAGE],
      tryChanging: "Change metadata.labels.app and re-apply — the Pod is recreated to match.",
    },
  ],
};

const services: DocsLesson = {
  slug: ["networking", "services"],
  title: "Services & Endpoints",
  description:
    "A Service is a stable address that load-balances to a changing set of Pods selected by labels.",
  section: "Networking",
  order: 0,
  concepts: ["services", "endpointslices", "labels-selectors", "networking"],
  relatedLevelSlug: "broken-readiness-probe",
  content: [
    { type: "heading", id: "why-services", text: "Why Services exist" },
    {
      type: "paragraph",
      text: "Pods are ephemeral and their IPs change. A Service gives you one durable name and virtual IP. It selects Pods by label and forwards traffic only to the ones that are Ready.",
    },
    {
      type: "concept",
      term: "Selector → EndpointSlice",
      definition:
        "The EndpointSlice controller watches Pods matching the Service's selector and publishes the Ready ones as endpoints. No matching Ready Pods → no endpoints → requests fail.",
    },
    {
      type: "callout",
      tone: "info",
      text: "A Service with zero ready endpoints returns 503. Two common causes: the selector matches nothing, or the matching Pods are not Ready.",
    },
    { type: "heading", id: "try-it", text: "Try it" },
    {
      type: "paragraph",
      text: "Apply the Pod and Service, then run `kubectl get endpoints web-svc`. Then break the Service selector and watch the endpoints disappear.",
    },
    { type: "lab", labId: "svc" },
  ],
  labs: [
    {
      id: "svc",
      title: "Service selectors & endpoints",
      prompt: "Apply both manifests, then break the selector and observe the endpoints.",
      files: [
        { path: "pod.yaml", language: "yaml", initialValue: POD },
        { path: "service.yaml", language: "yaml", initialValue: SERVICE },
      ],
      initialManifests: [],
      registeredImages: [WEB_IMAGE],
      tryChanging: "Change the Service selector to app=api and re-apply — endpoints go empty.",
    },
  ],
};

const readinessProbes: DocsLesson = {
  slug: ["debugging", "readiness-probes"],
  title: "Readiness Probes",
  description:
    "Readiness gates traffic. A Pod that isn't Ready is pulled out of its Service's endpoints — even while it keeps running.",
  section: "Observability & Debugging",
  order: 0,
  concepts: ["readiness-probes", "liveness-probes", "endpointslices", "debugging"],
  relatedLevelSlug: "broken-readiness-probe",
  content: [
    { type: "heading", id: "readiness-vs-liveness", text: "Readiness vs liveness" },
    {
      type: "concept",
      term: "Readiness probe",
      definition:
        "Decides whether a Pod should receive traffic. Failing readiness removes the Pod from Service endpoints but does NOT restart it.",
    },
    {
      type: "concept",
      term: "Liveness probe",
      definition:
        "Decides whether a container is healthy. Failing liveness restarts the container.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Common trap",
      text: "If the readiness probe points at a path the app doesn't serve, the Pod stays Running but never Ready — so its Service quietly has zero endpoints and returns 503s.",
    },
    { type: "heading", id: "try-it", text: "Try it" },
    {
      type: "paragraph",
      text: "This Pod's readiness probe hits /healthz (200) and is Ready. Point it at /readyz (which this app answers 404) and re-apply to watch it drop out of the Service.",
    },
    { type: "lab", labId: "readiness" },
  ],
  labs: [
    {
      id: "readiness",
      title: "Break and fix a readiness probe",
      prompt: "Apply, confirm Ready, then change the probe path to /readyz and re-apply.",
      files: [
        { path: "pod.yaml", language: "yaml", initialValue: POD },
        { path: "service.yaml", language: "yaml", initialValue: SERVICE },
      ],
      initialManifests: [],
      registeredImages: [WEB_IMAGE],
      tryChanging:
        "Change readinessProbe.httpGet.path to /readyz and re-apply — the Pod goes NotReady.",
    },
  ],
};

export const DOCS_LESSONS: readonly DocsLesson[] = [desiredVsActual, services, readinessProbes].map(
  parseLesson,
);

export function lessonHref(lesson: DocsLesson): string {
  return `/docs/${lesson.slug.join("/")}`;
}

export function getLessonBySlug(slug: string[]): DocsLesson | undefined {
  const key = slug.join("/");
  return DOCS_LESSONS.find((l) => l.slug.join("/") === key);
}

export const DEFAULT_LESSON_SLUG = desiredVsActual.slug;

/** Sections in display order, each with its lessons (ordered). */
export interface DocsSection {
  title: string;
  lessons: DocsLesson[];
}

const SECTION_ORDER = [
  "Foundations",
  "Workloads",
  "Networking",
  "Observability & Debugging",
  "Operations",
  "Real Incidents",
];

export const DOCS_NAV: DocsSection[] = SECTION_ORDER.map((title) => ({
  title,
  lessons: DOCS_LESSONS.filter((l) => l.section === title).sort((a, b) => a.order - b.order),
})).filter((s) => s.lessons.length > 0);
