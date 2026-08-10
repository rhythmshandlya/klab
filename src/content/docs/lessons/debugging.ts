import type { DocsLesson } from "@/lib/domain/types";

import {
  compileLessons,
  WEB_IMAGE,
  WORKER_IMAGE,
  WEB_POD,
  WEB_SERVICE,
  WORKER_POD_BROKEN,
  WEB_POD_BAD_PROBE,
  WEB_DEPLOYMENT_BAD_PROBE,
} from "./authoring";

const logs: DocsLesson = {
  slug: ["debugging", "logs"],
  title: "Logs",
  description:
    "Container logs tell you what the process did; Kubernetes status tells you what the platform observed.",
  section: "Observability & Debugging",
  order: 0,
  concepts: ["logs", "debugging", "pods"],
  relatedLevelSlug: "pod-crashloop-mystery",
  content: [
    {
      type: "heading",
      id: "process-truth",
      text: "Logs are the process's own account",
    },
    {
      type: "paragraph",
      text: "A container log is simply whatever the process wrote to its standard output and standard error streams. Kubernetes does not parse or understand it — it captures those bytes and hands them back to you. That gives logs a special role in debugging: status and events tell you what the platform observed from the outside, while logs tell you what the application itself claims happened on the inside. When a Pod restarts or serves errors, read both: logs explain the process, events explain the platform reaction.",
    },
    {
      type: "callout",
      tone: "key",
      title: "The stdout/stderr contract",
      text: "The Kubernetes logging convention (and the 12-factor rule) is that a containerized process writes its logs to stdout and stderr and never manages its own log files. The container runtime redirects both streams into a file on the node, and `kubectl logs` reads that file. If your app writes to /var/log/app.log instead, `kubectl logs` sees nothing — the stream, not the file, is the interface.",
    },
    {
      type: "annotatedCode",
      language: "json",
      title: "Anatomy of a structured log line",
      caption:
        "One line of stdout. Structured (JSON) logs are trivial for a node agent to index later.",
      lines: [
        {
          code: "{",
        },
        {
          code: '  "ts": "2026-07-10T09:12:44Z",',
          note: "an explicit timestamp from the app — do not rely on the collector's clock",
        },
        {
          code: '  "level": "error",',
          note: "severity you can filter on: stderr is conventional for warnings and errors",
        },
        {
          code: '  "msg": "connection refused",',
          note: "the human-readable event — this is the line you scan for during an incident",
        },
        {
          code: '  "svc": "checkout",',
          note: "which component emitted it; invaluable once many Pods share a backend",
        },
        {
          code: '  "upstream": "payments:8080",',
          note: "context that turns a vague error into an actionable one",
        },
        {
          code: '  "trace_id": "a1b2c3"',
          note: "correlates this line with the same request across other services",
        },
        {
          code: "}",
        },
      ],
    },
    {
      type: "diagram",
      variant: "debug-loop",
      title: "The logs debugging loop",
      caption:
        "Observe status, read logs for the process cause, confirm with events, then act — and repeat.",
    },
    {
      type: "heading",
      id: "reading-logs",
      text: "Reading logs, flag by flag",
    },
    {
      type: "demo",
      title: "Read a running Pod's logs",
      description:
        "The everyday workflow: confirm the Pod's state, read what it has printed, then follow it live if you need to watch behavior as it happens.",
      steps: [
        {
          label: "Check state first",
          detail:
            "Restart count and status tell you whether you are reading a healthy process or a flapping one.",
          command: "kubectl get pods",
          output:
            "NAME      READY   STATUS    RESTARTS   AGE\nweb       1/1     Running   0          6m",
        },
        {
          label: "Read what it printed",
          detail: "Plain `kubectl logs` dumps the current container instance's stdout and stderr.",
          command: "kubectl logs web",
          output:
            '{"level":"info","msg":"listening on :8080"}\n{"level":"info","msg":"GET /healthz 200"}',
        },
        {
          label: "Follow it live",
          detail:
            "`-f` streams new lines as they are written — the log equivalent of tail -f. Ctrl-C to stop.",
          command: "kubectl logs -f web --since=5m",
          output:
            '{"level":"info","msg":"GET /readyz 404"}\n{"level":"warn","msg":"readiness not yet green"}',
        },
      ],
    },
    {
      type: "buildUp",
      language: "markdown",
      title: "Grow a logs command from blunt to surgical",
      stages: [
        {
          label: "The blunt default",
          note: "Dumps everything the current instance of the (first/default) container has printed. Fine for a small, single-container Pod; overwhelming otherwise.",
          code: "kubectl logs web",
        },
        {
          label: "Target one container, trim the volume",
          note: "In a multi-container Pod you MUST say which container with -c, or kubectl errors / picks only the default one. --tail=100 keeps just the recent lines so you are not scrolling through hours of noise.",
          code: "kubectl logs web -c api --tail=100",
        },
        {
          label: "Scope to the incident, on the instance that crashed",
          note: "--previous reads the terminated instance (the one that actually failed), and --since=1h ignores anything older than the incident window. Note: -f (follow) cannot be combined with --previous — a dead instance produces no new lines.",
          code: "kubectl logs web -c api --previous --since=1h",
        },
      ],
    },
    {
      type: "decisionTable",
      title: "Which flag do I reach for?",
      columns: ["What it does", "Reach for it when"],
      rows: [
        {
          label: "-c <name>",
          cells: [
            "Selects one container in a multi-container Pod",
            "The Pod has an app plus a sidecar or init container",
          ],
        },
        {
          label: "--previous (-p)",
          cells: [
            "Shows the previous, terminated instance's logs",
            "The container just restarted or is in CrashLoopBackOff",
          ],
        },
        {
          label: "-f",
          cells: [
            "Streams new lines live (follow)",
            "You are reproducing a bug and want to watch it happen",
          ],
        },
        {
          label: "--since / --since-time",
          cells: [
            "Only lines newer than a duration or timestamp",
            "You know roughly when the incident began and want to skip old noise",
          ],
        },
        {
          label: "--tail=N",
          cells: [
            "Only the last N lines",
            "The log is huge and you only care about the recent tail",
          ],
        },
      ],
    },
    {
      type: "heading",
      id: "vanishing",
      text: "Why logs vanish after a restart",
    },
    {
      type: "concept",
      term: "--previous (-p)",
      definition:
        "Each time the kubelet restarts a container it is a fresh instance with its own log stream. `kubectl logs` shows the CURRENT instance by default; the instance that actually crashed is the previous one. `kubectl logs --previous` reads that terminated instance's captured output — the only place the fatal error usually lives.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Current logs of a crashing Pod are often empty",
      text: "During CrashLoopBackOff the container spends most of its time waiting to be restarted, so there is no running instance and `kubectl logs` returns little or nothing. The crash message belongs to the instance that already died. Do not conclude 'it crashed silently' — reach for `--previous` before you believe there are no logs.",
    },
    {
      type: "demo",
      title: "Debug a CrashLoopBackOff with --previous",
      description:
        "The current instance has no useful output because it is stuck in backoff. The failure detail is one instance back.",
      steps: [
        {
          label: "Spot the loop",
          detail:
            "A climbing restart count with CrashLoopBackOff means the process starts and exits repeatedly.",
          command: "kubectl get pods",
          output:
            "NAME          READY   STATUS             RESTARTS   AGE\npayment-7d9   0/1     CrashLoopBackOff   5          3m",
        },
        {
          label: "Current logs look empty",
          detail:
            "Between restarts there is no live container, so the default logs command has almost nothing to show.",
          command: "kubectl logs payment-7d9",
          output: "(no output — the container is waiting to be restarted)",
        },
        {
          label: "Read the instance that died",
          detail: "--previous surfaces the fatal line from the instance that actually crashed.",
          command: "kubectl logs payment-7d9 --previous",
          output: "FATAL: could not open config /etc/app/config.yaml: no such file or directory",
        },
      ],
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Spot the debugging mistake",
    },
    {
      type: "spotTheBug",
      language: "markdown",
      prompt:
        "An engineer is investigating a Pod stuck in CrashLoopBackOff. They ran the command below, saw an empty result, and told the channel 'there are no logs, it must be crashing silently before it can log anything.' What did they get wrong, and what should they run?",
      code: "$ kubectl get pod payment-7d9\nNAME          READY   STATUS             RESTARTS   AGE\npayment-7d9   0/1     CrashLoopBackOff   5          3m\n\n$ kubectl logs payment-7d9\n$ ",
      answer:
        "They read the CURRENT container instance, which is sitting in backoff and has not run long enough to print anything — so the empty output is expected, not evidence of a silent crash. The crash happened in the PREVIOUS instance, whose captured stdout/stderr still exists. Run `kubectl logs payment-7d9 --previous` to see the fatal line from the attempt that actually died.",
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write the command yourself",
    },
    {
      type: "challenge",
      language: "markdown",
      prompt:
        "Write a single kubectl command that fetches only the last 50 log lines from the PREVIOUS (crashed) instance of the container named worker inside the Pod batch-job.",
      hint: "You need three flags: one to pick the container, one to reach the crashed instance, and one to limit the line count.",
      solution: "kubectl logs batch-job -c worker --previous --tail=50",
    },
    {
      type: "lab",
      labId: "worker-logs",
    },
    {
      type: "heading",
      id: "architecture",
      text: "Where logs actually live",
    },
    {
      type: "paragraph",
      text: "`kubectl logs` is not magic: the container runtime redirects each container's stdout and stderr into files on the node it runs on, under paths like /var/log/pods and /var/log/containers. When you run the command, the API server asks that node's kubelet to read the relevant file and stream it back. Because the bytes live in node files, they are bounded by disk — which is why long-term logging is done by a separate agent.",
    },
    {
      type: "concept",
      term: "Node-level log rotation",
      definition:
        "The kubelet rotates each container's log file once it hits a size cap (containerLogMaxSize, default 10Mi) and keeps only a limited number of rotated files (containerLogMaxFiles, default 5). Older rotated segments are deleted. So `kubectl logs` can only ever show what has not yet rotated away, and everything for a Pod is deleted when the Pod object is removed.",
    },
    {
      type: "diagram",
      variant: "cluster-architecture",
      title: "Cluster logging pipeline",
      caption:
        "Container stdout/stderr -> node log files (kubelet/runtime) -> node logging agent (DaemonSet) -> central backend.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "Logging sidecar pattern",
      caption:
        "When a legacy app can only write to a file, a sidecar re-streams that file to stdout so kubectl and the node agent can see it.",
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
          code: "  name: app-with-logs",
        },
        {
          code: "spec:",
        },
        {
          code: "  containers:",
        },
        {
          code: "    - name: app",
          note: "the real workload — but it logs to a FILE, not stdout, so kubectl cannot see it directly",
        },
        {
          code: "      image: klab/web-app:1.0.0",
        },
        {
          code: "      volumeMounts:",
        },
        {
          code: "        - name: logs",
          note: "app and sidecar share this volume so both see the same file",
        },
        {
          code: "          mountPath: /var/log/app",
        },
        {
          code: "    - name: log-tailer",
          note: "the sidecar: its only job is to make the file visible on a stream",
        },
        {
          code: "      image: busybox:1.36",
        },
        {
          code: '      args: ["/bin/sh", "-c", "tail -n+1 -F /var/log/app/app.log"]',
          note: "tails the file to ITS OWN stdout, which the runtime now captures normally",
        },
        {
          code: "      volumeMounts:",
        },
        {
          code: "        - name: logs",
        },
        {
          code: "          mountPath: /var/log/app",
        },
        {
          code: "  volumes:",
        },
        {
          code: "    - name: logs",
          note: "an emptyDir is enough — it only needs to outlive neither container, just to be shared between them",
        },
        {
          code: "      emptyDir: {}",
        },
      ],
    },
    {
      type: "takeaways",
      items: [
        "Logs are the process's own account written to stdout/stderr; status and events are the platform's outside view.",
        "On any CrashLoopBackOff, reach for --previous — the current instance is usually empty and the crash detail lives in the terminated one.",
        "In multi-container Pods always pass -c; scope big logs with --tail and --since, and use -f to watch live (never with --previous).",
        "Node log files rotate by size and count and are deleted with the Pod, so ship logs to a backend for retention.",
        "A sidecar can turn a file-logging app into a stdout stream that both kubectl and the node agent can collect.",
      ],
    },
    {
      type: "quiz",
      id: "logs-q1",
      question:
        "A Pod is in CrashLoopBackOff and `kubectl logs <pod>` prints nothing. What is the best next command?",
      options: [
        {
          id: "a",
          text: "kubectl logs <pod> --previous",
          correct: true,
          explanation:
            "The current instance is in backoff and hasn't logged; the crash message belongs to the previous, terminated instance.",
        },
        {
          id: "b",
          text: "Delete the Pod so it restarts cleanly.",
          correct: false,
          explanation:
            "Deleting the Pod discards the very logs you need and usually re-creates the same failure.",
        },
        {
          id: "c",
          text: "kubectl logs -f <pod> and wait.",
          correct: false,
          explanation:
            "Following streams new lines from a live instance, but during backoff there is no running instance to stream from.",
        },
      ],
    },
    {
      type: "quiz",
      id: "logs-q2",
      question:
        "Why might `kubectl logs` fail to show a line your app printed an hour ago, even though the Pod is still running?",
      options: [
        {
          id: "a",
          text: "Node log files rotate by size and count, so older lines can be dropped.",
          correct: true,
          explanation:
            "The kubelet caps each container log file (default ~10Mi, 5 files); once rotated out, `kubectl logs` can no longer show them — a backend is needed for retention.",
        },
        {
          id: "b",
          text: "kubectl logs only ever shows warning and error levels.",
          correct: false,
          explanation:
            "kubectl logs returns the raw stream unfiltered; it does not understand log levels.",
        },
        {
          id: "c",
          text: "Kubernetes stores all logs in etcd, which expires them after an hour.",
          correct: false,
          explanation:
            "Logs are never stored in etcd; they live in files on the node until they rotate or the Pod is deleted.",
        },
      ],
    },
  ],
  labs: [
    {
      id: "worker-logs",
      title: "Find a missing environment variable",
      prompt:
        "The worker starts without DATABASE_URL. Add the env var from the fixed example and apply.",
      files: [{ path: "worker.yaml", language: "yaml", initialValue: WORKER_POD_BROKEN }],
      initialManifests: [],
      registeredImages: [WORKER_IMAGE],
      tryChanging: "Add the DATABASE_URL env block from the lesson text.",
      tasks: [
        "Observe the worker restart.",
        "Open in Playground for logs.",
        "Add DATABASE_URL and apply.",
      ],
      commands: ["kubectl logs worker", "kubectl describe pod worker"],
      debrief:
        "The kubelet restarted the container because the process exited. The log line identifies the missing input.",
    },
  ],
};

const events: DocsLesson = {
  slug: ["debugging", "events"],
  title: "Events",
  description:
    "Events are Kubernetes' timeline of scheduling, pulling, probing, killing, and reconciliation decisions.",
  section: "Observability & Debugging",
  order: 1,
  concepts: ["events", "debugging", "pods"],
  content: [
    {
      type: "heading",
      id: "timeline",
      text: "Events are the cluster's audit trail",
    },
    {
      type: "paragraph",
      text: "An Event is not a log line from your application. It is a short record the platform writes about itself: the scheduler saying where a Pod landed, the kubelet saying it pulled an image, a probe saying a container failed a health check. When something is stuck or broken, events are the fastest way to answer the only question that matters at first: what did Kubernetes try to do, and why did it stop? Events are their own namespaced API objects — each points at a single involved object and carries a Reason, a human Message, a Type of Normal or Warning, and timestamps. Read them time-ordered and they reconstruct the story of a failure step by step.",
    },
    {
      type: "diagram",
      variant: "debug-loop",
      title: "Events feed the debug loop",
      caption:
        "get to see what is wrong, describe to read its events, then patch the smallest field that explains them.",
    },
    {
      type: "heading",
      id: "reading-events",
      text: "Read them in time order",
    },
    {
      type: "paragraph",
      text: "By default kubectl get events returns rows in an unhelpful order. Almost always sort by the last time each event was seen, so the most recent activity sits at the bottom where a terminal naturally shows it. Look for repeated Warning rows tied to the same object — that repetition is usually the smoking gun.",
    },
    {
      type: "demo",
      title: "Sort events by timestamp",
      description: "Reconstruct what happened to a Pod that came up but never went Ready.",
      steps: [
        {
          label: "List events newest-last",
          detail:
            "The scheduling and pull steps succeeded; the readiness probe is the one that keeps failing.",
          command: "kubectl get events --sort-by=.lastTimestamp",
          output:
            'LAST SEEN   TYPE      REASON      OBJECT        MESSAGE\n2m          Normal    Scheduled   pod/web       Successfully assigned default/web to node-1\n2m          Normal    Pulled      pod/web       Container image "klab/web-app:1.0.0" already present on machine\n2m          Normal    Created     pod/web       Created container web\n2m          Normal    Started     pod/web       Started container web\n20s         Warning   Unhealthy   pod/web       Readiness probe failed: HTTP probe failed with statuscode: 404',
        },
        {
          label: "Connect the Reason back to the YAML",
          detail:
            "Unhealthy from a readiness probe means the container is running but failing its check. Open the readinessProbe section of the manifest — a 404 says the path is wrong (this image serves /healthz, not /readyz).",
          command: "kubectl get pod web -o yaml | grep -A5 readinessProbe",
        },
      ],
    },
    {
      type: "concept",
      term: "involvedObject",
      definition:
        "Every event references exactly one object it is about, stored in the involvedObject field. That is what lets kubectl attach an event to the right Pod in describe output, and what you filter on with kubectl events --for.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Events expire, and they are namespaced",
      text: "The API server garbage-collects events roughly an hour after they last fired (the default TTL is one hour). If you look an hour after an incident, the evidence may simply be gone — capture it while it is fresh. Events also live in a namespace: kubectl get events shows only the current namespace unless you add -n <ns> or -A for all namespaces.",
    },
    {
      type: "heading",
      id: "describe-events",
      text: "Events attached to one object",
    },
    {
      type: "paragraph",
      text: "You rarely list the whole namespace first. More often you already suspect one object and run kubectl describe on it. describe ends with an Events section scoped to just that object — the same records, but pre-filtered and already in time order, with an Age column and a From column naming which component wrote each one.",
    },
    {
      type: "demo",
      title: "The Events section of kubectl describe",
      description: "describe pod is where most debugging sessions actually find the answer.",
      steps: [
        {
          label: "Describe the suspect Pod",
          detail:
            "Scroll to the bottom. The From column shows default-scheduler wrote Scheduled and kubelet wrote the rest.",
          command: "kubectl describe pod web",
          output:
            'Events:\n  Type     Reason     Age                From               Message\n  ----     ------     ----               ----               -------\n  Normal   Scheduled  2m                 default-scheduler  Successfully assigned default/web to node-1\n  Normal   Pulled     2m                 kubelet            Container image "klab/web-app:1.0.0" already present on machine\n  Normal   Created    2m                 kubelet            Created container web\n  Normal   Started    2m                 kubelet            Started container web\n  Warning  Unhealthy  10s (x6 over 55s)  kubelet            Readiness probe failed: HTTP probe failed with statuscode: 404',
        },
      ],
    },
    {
      type: "callout",
      tone: "info",
      title: "Read the aggregation count",
      text: "10s (x6 over 55s) is one event row that fired 6 times, most recently 10 seconds ago, spanning 55 seconds. Kubernetes de-duplicates identical repeating events into a single row with a count instead of flooding you. A high, climbing count is itself a signal: the problem is ongoing, not a one-off.",
    },
    {
      type: "heading",
      id: "kubectl-events",
      text: "The kubectl events command",
    },
    {
      type: "paragraph",
      text: "Newer kubectl ships a dedicated kubectl events command (get events still works). It sorts by time by default, formats the age column like describe does, and adds a --for flag to scope to one object and --watch to stream new events live as they arrive — handy while you re-apply a fix and want to see the cluster react.",
    },
    {
      type: "demo",
      title: "Watch one object's events stream",
      description: "Follow a single Pod instead of grepping the whole namespace.",
      steps: [
        {
          label: "Scope to one object and follow",
          detail:
            "--for filters to that Pod's involvedObject; --watch keeps the stream open and prints each new event as it happens.",
          command: "kubectl events --for pod/web --watch",
          output:
            "LAST SEEN   TYPE      REASON      OBJECT    MESSAGE\n2m          Normal    Started     Pod/web   Started container web\n0s          Warning   Unhealthy   Pod/web   Readiness probe failed: HTTP probe failed with statuscode: 404",
        },
      ],
    },
    {
      type: "compare",
      caption:
        "Same events, two lenses: sweep the namespace when you do not yet know the culprit, or pin one object once you do.",
      left: {
        title: "Whole namespace, newest last",
        code: "kubectl get events --sort-by=.lastTimestamp",
      },
      right: {
        title: "One object, live",
        code: "kubectl events --for pod/web --watch",
      },
    },
    {
      type: "heading",
      id: "common-reasons",
      text: "Common reasons and what to do",
    },
    {
      type: "decisionTable",
      title: "Warning reasons you will actually see",
      columns: ["What it means", "Next action"],
      rows: [
        {
          label: "FailedScheduling",
          cells: [
            "The scheduler could not place the Pod on any node.",
            "Read the message for the cause (insufficient cpu/memory, taints, no matching nodeSelector or affinity). Lower requests, add capacity, or fix the constraint.",
          ],
        },
        {
          label: "ImagePullBackOff",
          cells: [
            "The kubelet could not pull the image and is backing off before retrying (often preceded by ErrImagePull).",
            "Check the image name and tag for typos, and whether the registry needs an imagePullSecret.",
          ],
        },
        {
          label: "BackOff",
          cells: [
            "The container keeps exiting and the kubelet is delaying restarts (this is the CrashLoopBackOff you see in Pod status).",
            "kubectl logs --previous to read why the last run crashed; fix the command, config, or missing dependency.",
          ],
        },
        {
          label: "Unhealthy",
          cells: [
            "A liveness or readiness probe failed. The message says which probe and the failure detail.",
            "Match the probe path/port to what the container actually serves; confirm the app is up before blaming the probe.",
          ],
        },
        {
          label: "FailedMount",
          cells: [
            "A volume could not be attached or mounted, so the container never starts.",
            "Check the referenced ConfigMap, Secret, or PVC exists in the same namespace and is bound.",
          ],
        },
      ],
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a broken Pod through its events",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      title: "Why does this Pod never go Ready?",
      prompt:
        "This Pod runs but stays 0/1 Ready, and kubectl describe pod web shows a repeating Warning: Unhealthy — Readiness probe failed: HTTP probe failed with statuscode: 404. The image is klab/web-app:1.0.0. What is wrong, and how do the events prove it?",
      code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\n  labels:\n    app: web\nspec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      ports:\n        - containerPort: 8080\n      readinessProbe:\n        httpGet:\n          path: /readyz\n          port: 8080",
      answer:
        "The readiness probe hits /readyz, but this image returns 404 on /readyz (it serves 200 on /healthz). The container is healthy and running — nothing crashed — so the only symptom is the repeating Unhealthy readiness event and a Pod that never joins Service endpoints. The Reason (Unhealthy, not BackOff or FailedScheduling) tells you it is a probe problem, not a scheduling or image problem. Fix: point the probe at /healthz.",
    },
    {
      type: "heading",
      id: "query-challenge",
      text: "Write the query yourself",
    },
    {
      type: "challenge",
      language: "markdown",
      title: "Find only the recent warnings for one Pod",
      prompt:
        "You are handed a noisy namespace mid-incident. Write the commands to (1) list every event across the namespace sorted so the newest is last, and (2) stream only the events for pod/web as they arrive so you can watch your fix take effect.",
      hint: "Sorting uses --sort-by with a field path like .lastTimestamp. Scoping one object uses kubectl events --for, and live streaming uses --watch.",
      solution:
        "# 1. Whole namespace, newest last\nkubectl get events --sort-by=.lastTimestamp\n\n# 2. One object, live\nkubectl events --for pod/web --watch\n\n# Bonus: only Warnings, across all namespaces\nkubectl get events -A --field-selector type=Warning",
    },
    { type: "lab", labId: "events-unhealthy" },
    {
      type: "takeaways",
      items: [
        "Events are the platform narrating its own decisions — not your app's logs. Read them first.",
        "Always sort by time (kubectl get events --sort-by=.lastTimestamp) and watch for repeated Warning rows on one object.",
        "kubectl describe <object> ends with an Events section already scoped and time-ordered — usually where the answer is.",
        "The Reason field is a diagnosis: FailedScheduling, ImagePullBackOff, BackOff, Unhealthy, and FailedMount each point at a different next command.",
        "Events are namespaced and expire after about an hour — capture the evidence while the incident is live.",
      ],
    },
    {
      type: "quiz",
      id: "events-q1",
      question: "What do Kubernetes Events help you reconstruct?",
      options: [
        {
          id: "a",
          text: "The platform's recent decisions and why they succeeded or failed.",
          correct: true,
          explanation:
            "Events are a time-ordered record of what the scheduler, kubelet, and controllers did to an object.",
        },
        {
          id: "b",
          text: "Your application's request logs and stack traces.",
          correct: false,
          explanation:
            "Those come from kubectl logs. Events describe the platform's actions, not your app's output.",
        },
        {
          id: "c",
          text: "The source-code diff that introduced a bug.",
          correct: false,
          explanation:
            "Events explain runtime behavior in the cluster, not version control history.",
        },
      ],
    },
    {
      type: "quiz",
      id: "events-q2",
      question:
        "You investigate an outage an hour after it happened and kubectl get events shows nothing relevant. What is the most likely reason?",
      options: [
        {
          id: "a",
          text: "Events have a short TTL (about an hour) and the old ones were garbage-collected.",
          correct: true,
          explanation:
            "Events expire by default around an hour after they last fired, so stale incidents lose their evidence.",
        },
        {
          id: "b",
          text: "Events are cluster-wide, so a namespace filter can never hide them.",
          correct: false,
          explanation:
            "Events are namespaced — the wrong namespace can also hide them — but the classic 'nothing an hour later' cause is expiry.",
        },
        {
          id: "c",
          text: "kubectl get events only ever shows Normal events, never Warnings.",
          correct: false,
          explanation: "It shows both Normal and Warning types; there is no such restriction.",
        },
      ],
    },
  ],
  labs: [
    {
      id: "events-unhealthy",
      title: "Read the events a failing Pod emits",
      prompt:
        "Apply a Pod whose readiness probe hits a path the app answers with 404, then read the Events to see why it never becomes Ready.",
      files: [{ path: "pod.yaml", language: "yaml", initialValue: WEB_POD_BAD_PROBE }],
      initialManifests: [],
      registeredImages: [WEB_IMAGE],
      tryChanging: "Change readinessProbe.httpGet.path back to /healthz and apply.",
      tasks: [
        "Apply the Pod.",
        "Run kubectl get events.",
        "Find the Unhealthy readiness-probe events.",
      ],
      commands: ["kubectl get events --sort-by=.lastTimestamp", "kubectl describe pod web"],
      debrief:
        "The readiness probe on /readyz returns 404, so the kubelet emits repeated Unhealthy events and the Pod stays NotReady. Events are the fastest way to see what the cluster is complaining about.",
    },
  ],
};

const probes: DocsLesson = {
  slug: ["debugging", "readiness-probes"],
  title: "Readiness Probes",
  description:
    "Readiness controls traffic; liveness controls restarts; startup protects slow starts.",
  section: "Observability & Debugging",
  order: 2,
  concepts: ["readiness-probes", "liveness-probes", "startup-probes", "services", "debugging"],
  relatedLevelSlug: "liveness-probe-death-spiral",
  content: [
    {
      type: "heading",
      id: "why-probes",
      text: "Why probes exist",
    },
    {
      type: "paragraph",
      text: "A running container is not the same as a working one. A process can be up but still warming a cache, waiting on a migration, or wedged in a deadlock. Probes are how the kubelet asks a container two different questions: 'Are you ready to receive traffic?' and 'Are you alive, or should I restart you?' Getting the two confused is one of the most common — and most damaging — mistakes in production Kubernetes.",
    },
    {
      type: "diagram",
      variant: "probe-gates",
      title: "How probes gate traffic and restarts",
    },
    {
      type: "heading",
      id: "three-probes",
      text: "Three probes, three jobs",
    },
    {
      type: "paragraph",
      text: "Kubernetes has three probe types, and the whole subject becomes clear once you internalize that each has a distinct consequence on failure. Readiness controls Service traffic. Liveness controls restarts. Startup protects slow-booting containers from the other two. They can all point at the same endpoint, but they are decided independently and do completely different things when they fail.",
    },
    {
      type: "concept",
      term: "readinessProbe",
      definition:
        "When it fails, the Pod's IP is removed from its Service EndpointSlices, so new traffic stops arriving — but the container is NOT restarted. When it passes again, the Pod is re-added. Use it to gate traffic during warm-up or while a dependency is unavailable.",
    },
    {
      type: "concept",
      term: "livenessProbe",
      definition:
        "When it fails failureThreshold times in a row, the kubelet KILLS and restarts the container. Use it only to recover a process that is truly stuck (deadlock, hung event loop) and cannot recover on its own. A restart must be the correct remedy.",
    },
    {
      type: "concept",
      term: "startupProbe",
      definition:
        "Runs first for slow starters. Until it succeeds, the readiness and liveness probes are DISABLED. Once it passes, it never runs again and the other two take over. It gives a slow boot a long, generous window without loosening the liveness timing you want during normal operation.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "The most common probe mistake",
      text: "Do not use liveness as a dependency check. If your liveness probe fails because the database is slow, Kubernetes will restart a perfectly healthy process — and every replica at once — turning a partial outage into a cluster-wide restart storm. Dependency health belongs in readiness (stop taking traffic), never in liveness (restart).",
    },
    {
      type: "heading",
      id: "anatomy",
      text: "Anatomy of a container with all three probes",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "One container, three probes",
      caption:
        "Each probe is decided independently. Read them by their failure consequence, not their syntax.",
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
          note: "the label a Service selector matches to route traffic here",
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
          code: "      ports:",
        },
        {
          code: "        - containerPort: 8080",
          note: "the port every probe below targets",
        },
        {
          code: "      startupProbe:",
          note: "runs FIRST; readiness and liveness stay disabled until this passes",
        },
        {
          code: "        httpGet:",
        },
        {
          code: "          path: /healthz",
        },
        {
          code: "          port: 8080",
        },
        {
          code: "        periodSeconds: 10",
        },
        {
          code: "        failureThreshold: 30",
          note: "30 x 10s = up to 300s to finish booting before the container is killed",
        },
        {
          code: "      readinessProbe:",
          note: "GATES TRAFFIC: failing removes the Pod from Service endpoints; it is NOT restarted",
        },
        {
          code: "        httpGet:",
        },
        {
          code: "          path: /readyz",
          note: "a readiness endpoint that also checks critical dependencies",
        },
        {
          code: "          port: 8080",
        },
        {
          code: "        periodSeconds: 5",
          note: "checked often so traffic reacts quickly to readiness changes",
        },
        {
          code: "        failureThreshold: 3",
        },
        {
          code: "      livenessProbe:",
          note: "GATES RESTARTS: failing failureThreshold times kills and restarts the container",
        },
        {
          code: "        httpGet:",
        },
        {
          code: "          path: /healthz",
          note: "a cheap 'is the process responsive' check — no dependency calls",
        },
        {
          code: "          port: 8080",
        },
        {
          code: "        periodSeconds: 10",
        },
        {
          code: "        failureThreshold: 3",
          note: "3 misses at 10s each ~ 30s of being wedged before a restart",
        },
      ],
    },
    {
      type: "heading",
      id: "probe-types",
      text: "Four ways to probe",
    },
    {
      type: "paragraph",
      text: "The httpGet field above is just one of four probe mechanisms. Any of the three probe types can use any mechanism — pick the one that actually reflects your app's health.",
    },
    {
      type: "steps",
      title: "Probe mechanisms",
      items: [
        {
          title: "httpGet",
          text: "The kubelet sends an HTTP GET; any 200-399 status is a pass. The best default for web servers — pair it with a lightweight /healthz handler.",
        },
        {
          title: "tcpSocket",
          text: "The kubelet opens a TCP connection; success = the port accepts it. Good for non-HTTP services like databases or message brokers.",
        },
        {
          title: "exec",
          text: "The kubelet runs a command inside the container; exit code 0 is a pass. Flexible but the most expensive — it forks a process every period.",
        },
        {
          title: "grpc",
          text: "The kubelet calls the standard gRPC health-checking protocol on the given port. Use it for gRPC services instead of shelling out to grpc_health_probe.",
        },
      ],
    },
    {
      type: "heading",
      id: "tuning",
      text: "Tuning the timing",
    },
    {
      type: "callout",
      tone: "key",
      title: "The four numbers that decide behavior",
      text: "initialDelaySeconds: how long to wait before the FIRST probe (0 by default). periodSeconds: how often to probe after that. timeoutSeconds: how long one probe may take before it counts as a failure (1s by default — surprisingly easy to trip). failureThreshold: how many consecutive failures trigger the action. Effective time-to-act = initialDelaySeconds + failureThreshold x periodSeconds. Compute that number before you ship a liveness probe.",
    },
    {
      type: "concept",
      term: "initialDelaySeconds vs startupProbe",
      definition:
        "A large initialDelaySeconds is a blunt fixed pause on every probe. A startupProbe is better for slow boots: it lets the app signal 'I'm up' the instant it is ready, keeps a long safety ceiling via failureThreshold, and does not slow down restart detection once the app is running.",
    },
    {
      type: "heading",
      id: "build-it",
      text: "Build the probes in stages",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "Add probes one job at a time",
      stages: [
        {
          label: "Just a container",
          note: "No probes. Kubernetes assumes the container is Ready as soon as it starts and never restarts it for being unresponsive — only if the process exits.",
          code: "spec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      ports:\n        - containerPort: 8080",
        },
        {
          label: "Add readiness",
          note: "Now the Pod only receives Service traffic once /readyz answers. If it later fails, the Pod is pulled from endpoints but keeps running — no restart, no data loss.",
          code: "spec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      ports:\n        - containerPort: 8080\n      readinessProbe:\n        httpGet:\n          path: /readyz\n          port: 8080\n        periodSeconds: 5\n        failureThreshold: 3",
        },
        {
          label: "Add liveness + startup",
          note: "Liveness recovers a wedged process. The startupProbe wraps a slow boot in a generous window so liveness cannot kill the container before it finishes starting.",
          code: "spec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      ports:\n        - containerPort: 8080\n      startupProbe:\n        httpGet:\n          path: /healthz\n          port: 8080\n        periodSeconds: 10\n        failureThreshold: 30\n      readinessProbe:\n        httpGet:\n          path: /readyz\n          port: 8080\n        periodSeconds: 5\n        failureThreshold: 3\n      livenessProbe:\n        httpGet:\n          path: /healthz\n          port: 8080\n        periodSeconds: 10\n        failureThreshold: 3",
        },
      ],
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Spot the bug: a restart loop",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      title: "Why does this Pod never stay up?",
      prompt:
        "This app needs about 40 seconds to warm its cache before /healthz returns 200. The Pod starts, runs for a bit, gets killed, and repeats forever — a CrashLoop that isn't caused by the app crashing. What is wrong, and how should it be fixed?",
      code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: slow-web\nspec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      ports:\n        - containerPort: 8080\n      livenessProbe:\n        httpGet:\n          path: /healthz\n          port: 8080\n        initialDelaySeconds: 5\n        periodSeconds: 5\n        failureThreshold: 3",
      answer:
        "The liveness probe is policing a slow start. It begins at 5s and, after 3 failures at 5s each, gives up around 20s — but the app needs ~40s to become healthy. The kubelet kills and restarts the container before it can finish booting, forever. Liveness is the wrong tool for a slow start: a restart doesn't help, because restarting just resets the 40s clock. Fix: add a startupProbe with a generous failureThreshold (for example periodSeconds 10, failureThreshold 30 = up to 300s) so liveness stays disabled until the app is up. The slow-boot concern is a startup/readiness problem, never a liveness one.",
    },
    {
      type: "heading",
      id: "decision",
      text: "Which probe for which job?",
    },
    {
      type: "decisionTable",
      title: "Readiness vs liveness vs startup",
      columns: ["On failure", "Reach for it when", "Restarts the container?"],
      rows: [
        {
          label: "readinessProbe",
          cells: [
            "Pod removed from Service endpoints; container keeps running",
            "You want to stop traffic during warm-up or while a dependency is down",
            "No",
          ],
        },
        {
          label: "livenessProbe",
          cells: [
            "Container is killed and restarted after failureThreshold misses",
            "A process can get truly wedged (deadlock) and only a restart recovers it",
            "Yes",
          ],
        },
        {
          label: "startupProbe",
          cells: [
            "Readiness and liveness stay disabled until it passes; container killed only if it never passes in time",
            "The app boots slowly and would otherwise be killed by liveness before it is ready",
            "Only if startup itself never succeeds",
          ],
        },
      ],
    },
    {
      type: "heading",
      id: "write-it",
      text: "Write it yourself",
    },
    {
      type: "challenge",
      language: "yaml",
      title: "Author a safe probe set",
      prompt:
        "Add probes to this container so that: traffic is gated on /readyz, a wedged process is restarted via /healthz, and a slow boot of up to ~120 seconds cannot be killed by liveness. Start from the container below.",
      hint: "You need all three probes. Give the startupProbe periodSeconds and a failureThreshold whose product is at least 120. Keep liveness pointed at a cheap /healthz.",
      solution:
        "spec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      ports:\n        - containerPort: 8080\n      startupProbe:\n        httpGet:\n          path: /healthz\n          port: 8080\n        periodSeconds: 10\n        failureThreshold: 12\n      readinessProbe:\n        httpGet:\n          path: /readyz\n          port: 8080\n        periodSeconds: 5\n        failureThreshold: 3\n      livenessProbe:\n        httpGet:\n          path: /healthz\n          port: 8080\n        periodSeconds: 10\n        failureThreshold: 3",
    },
    {
      type: "lab",
      labId: "readiness",
    },
    {
      type: "takeaways",
      items: [
        "Readiness gates traffic (removes from endpoints, no restart); liveness gates restarts (kills the container); startup protects slow boots and disables the other two until it passes.",
        "Never put a dependency check in a liveness probe — it turns a partial outage into a restart storm. Dependency health belongs in readiness.",
        "Effective time to act = initialDelaySeconds + failureThreshold x periodSeconds. Compute it before shipping a liveness probe.",
        "Prefer a startupProbe over a large initialDelaySeconds for slow starters: generous ceiling, fast reaction once running.",
        "Pick the mechanism that reflects real health: httpGet for web, tcpSocket for raw ports, exec for scripts, grpc for gRPC services.",
      ],
    },
    {
      type: "quiz",
      id: "probes-q1",
      question: "Which probe removes a Pod from Service endpoints without restarting it?",
      options: [
        {
          id: "a",
          text: "Readiness",
          correct: true,
          explanation:
            "Readiness gates traffic: on failure the Pod leaves the EndpointSlices but keeps running.",
        },
        {
          id: "b",
          text: "Liveness",
          correct: false,
          explanation:
            "Liveness restarts the container after repeated failures; it does not just remove traffic.",
        },
        {
          id: "c",
          text: "Startup",
          correct: false,
          explanation:
            "Startup only disables the other probes until the app boots; failing it eventually causes a restart, not endpoint removal.",
        },
      ],
    },
    {
      type: "quiz",
      id: "probes-q2",
      question:
        "An app takes 60s to warm up. Its liveness probe (initialDelaySeconds 5, periodSeconds 5, failureThreshold 3) keeps restarting it. What is the best fix?",
      options: [
        {
          id: "a",
          text: "Add a startupProbe with a generous failureThreshold so liveness is held off until the app is ready.",
          correct: true,
          explanation:
            "The startupProbe gives the slow boot a long window and disables liveness until it passes — exactly what slow starts need.",
        },
        {
          id: "b",
          text: "Delete the readiness probe.",
          correct: false,
          explanation:
            "Readiness is not causing the restarts; liveness is. Removing readiness would only send traffic to a not-ready Pod.",
        },
        {
          id: "c",
          text: "Lower the liveness failureThreshold to 1.",
          correct: false,
          explanation: "That makes the restart loop worse by killing the container even sooner.",
        },
        {
          id: "d",
          text: "Point liveness at the database to confirm dependencies.",
          correct: false,
          explanation:
            "Liveness must never do dependency checks — that causes restart storms and does not address the slow boot.",
        },
      ],
    },
  ],
  labs: [
    {
      id: "readiness",
      title: "Break and fix a readiness probe",
      prompt: "Apply, confirm Ready, then change the probe path to /readyz and re-apply.",
      files: [
        { path: "pod.yaml", language: "yaml", initialValue: WEB_POD },
        { path: "service.yaml", language: "yaml", initialValue: WEB_SERVICE },
      ],
      initialManifests: [],
      registeredImages: [WEB_IMAGE],
      tryChanging: "Change readinessProbe.httpGet.path to /readyz and apply.",
      tasks: [
        "Start from a healthy Pod and Service.",
        "Break the readiness path.",
        "Watch the Service endpoint disappear.",
      ],
      commands: ["kubectl get endpoints web-svc", "kubectl describe pod web"],
      debrief:
        "Readiness gates Service traffic. The Pod can keep running while the Service removes it from endpoints.",
    },
  ],
};

const kubectlDebugging: DocsLesson = {
  slug: ["debugging", "kubectl-debugging"],
  title: "kubectl Debugging",
  description: "A repeatable command sequence turns a vague outage into specific evidence.",
  section: "Observability & Debugging",
  order: 3,
  concepts: ["debugging", "events", "logs", "services"],
  content: [
    {
      type: "heading",
      id: "the-loop",
      text: "One loop for every outage",
    },
    {
      type: "paragraph",
      text: 'Debugging in Kubernetes is not guessing. It is a repeatable loop that turns a vague report ("the site is down") into a specific, provable fact ("the readiness probe returns 404 on /readyz"). Each pass narrows the search: you widen with get, focus with describe, confirm with logs, and reach inside with exec or debug. Every command answers one question and hands you the next one.',
    },
    {
      type: "diagram",
      variant: "debug-loop",
      title: "get -> describe -> logs -> exec/events",
      caption: "Widen, then narrow. Each step produces the evidence that chooses the next step.",
    },
    {
      type: "steps",
      title: "The loop, step by step",
      items: [
        {
          title: "get (widen)",
          text: "kubectl get pods,svc,deploy,endpoints -o wide shows what is visibly wrong: a Pod not Running, a Service with no endpoints, a Deployment short of replicas.",
        },
        {
          title: "describe (focus)",
          text: "kubectl describe on the broken object adds the Events log, container state, exit codes, and the last probe result — the fields the table view hides.",
        },
        {
          title: "logs (listen)",
          text: "kubectl logs is the application's own account of what happened. --previous recovers the words of a container that already crashed.",
        },
        {
          title: "exec / debug (reach in)",
          text: "When you must poke from inside the Pod's network namespace, exec into a shell, port-forward a port to your laptop, or attach an ephemeral debug container to a distroless image.",
        },
        {
          title: "patch (act)",
          text: "Change the smallest field the evidence points at, re-apply, and run the loop again to confirm the symptom is gone.",
        },
      ],
    },
    {
      type: "heading",
      id: "get-wide",
      text: "Start wide with get",
    },
    {
      type: "demo",
      title: "Widen, then narrow with get",
      description:
        "get is the fastest way to see the whole board. -o wide adds the node and Pod IP, --field-selector filters server-side, and -o yaml dumps the full live object when you need a field the table never prints.",
      steps: [
        {
          label: "See everything at once",
          detail:
            "The wide view adds IP and NODE, so you can tell a scheduling problem (no node) from an app problem (has a node but crashing).",
          command: "kubectl get pods -o wide",
          output:
            "NAME                    READY   STATUS             RESTARTS      AGE   IP           NODE     NOMINATED NODE\nweb-7d9c5b8f6c-4x2kd    0/1     CrashLoopBackOff   6 (30s ago)   8m    10.244.1.7   node-1   <none>\nweb-7d9c5b8f6c-lp8qz    1/1     Running            0             8m    10.244.2.3   node-2   <none>",
        },
        {
          label: "Filter server-side",
          detail:
            "--field-selector asks the API server to return only matching objects, instead of piping thousands of lines through grep. Great in busy namespaces.",
          command: "kubectl get pods --field-selector status.phase!=Running",
          output:
            "NAME                    READY   STATUS             RESTARTS      AGE\nweb-7d9c5b8f6c-4x2kd    0/1     CrashLoopBackOff   6 (35s ago)   8m",
        },
        {
          label: "Pull the full object",
          detail:
            "-o yaml prints the live spec AND status the controllers wrote back. status.containerStatuses is where the real reason lives.",
          command: "kubectl get pod web-7d9c5b8f6c-4x2kd -o yaml | grep -A4 'lastState:'",
          output:
            '    lastState:\n      terminated:\n        exitCode: 1\n        reason: Error\n        startedAt: "2026-07-10T09:14:02Z"',
        },
      ],
    },
    {
      type: "callout",
      tone: "info",
      title: "Three output flags worth memorising",
      text: "-o wide adds columns (IP, NODE) without changing what you asked for. -o yaml gives the complete live object including status, ideal for piping into grep or diff. --field-selector filters on a few indexed fields (status.phase, metadata.namespace, spec.nodeName) at the server, which is far cheaper than fetching everything and filtering locally.",
    },
    {
      type: "heading",
      id: "describe-step",
      text: "Describe reads you the events",
    },
    {
      type: "paragraph",
      text: "get tells you a Pod is unhealthy; describe tells you why. It stitches together the container state, restart count, the last probe result, and the Events feed — a timeline of what the scheduler and kubelet did to this object. Read the Events from the bottom up; the newest Warning is usually the headline.",
    },
    {
      type: "demo",
      title: "Describe a crashing Pod",
      description:
        "The interesting parts are the container State/Last State block and the Events at the bottom. Here the app starts, fails its readiness probe with a 404, and the kubelet keeps backing off restarts.",
      steps: [
        {
          label: "Run describe",
          detail:
            "State shows what the container is doing now; Last State shows how it died last time (Exit Code 1 = the app returned an error).",
          command: "kubectl describe pod web-7d9c5b8f6c-4x2kd",
          output:
            "Containers:\n  web:\n    Image:          klab/web-app:1.0.0\n    State:          Waiting\n      Reason:       CrashLoopBackOff\n    Last State:     Terminated\n      Reason:       Error\n      Exit Code:    1\n    Ready:          False\n    Restart Count:  6\n    Readiness:      http-get http://:8080/readyz delay=0s timeout=1s period=10s",
        },
        {
          label: "Read the Events feed",
          detail:
            "The Unhealthy Warning names the exact probe and status code. /readyz returning 404 is why READY stays 0/1 even while the process is up.",
          command: "kubectl describe pod web-7d9c5b8f6c-4x2kd | sed -n '/Events:/,$p'",
          output:
            'Events:\n  Type     Reason     Age                    From     Message\n  ----     ------     ----                   ----     -------\n  Normal   Scheduled  8m                     default-scheduler  Successfully assigned default/web-7d9c5b8f6c-4x2kd to node-1\n  Normal   Pulled     7m (x4 over 8m)        kubelet  Container image "klab/web-app:1.0.0" already present on machine\n  Warning  Unhealthy  6m (x5 over 7m)        kubelet  Readiness probe failed: HTTP probe failed with statuscode: 404\n  Warning  BackOff    45s (x21 over 6m)      kubelet  Back-off restarting failed container web',
        },
      ],
    },
    {
      type: "concept",
      term: "Events are ephemeral and namespaced",
      definition:
        "Events live in a namespace and the API server garbage-collects them (about an hour by default). If describe shows no events, they may have expired — reproduce the failure, or check controller logs. kubectl get events --field-selector reason=Unhealthy --sort-by=.lastTimestamp lists them across a namespace.",
    },
    {
      type: "heading",
      id: "logs-step",
      text: "Logs: the application's own words",
    },
    {
      type: "demo",
      title: "logs, --previous, and following",
      description:
        "logs streams stdout/stderr of one container. The two flags that save outages are --previous (the crashed instance) and -c (which container, when there is more than one).",
      steps: [
        {
          label: "The current container is empty",
          detail:
            "A CrashLoopBackOff Pod may have no running container right now, so plain logs shows nothing useful.",
          command: "kubectl logs web-7d9c5b8f6c-4x2kd",
          output:
            'Error from server (BadRequest): container "web" in pod "web-7d9c5b8f6c-4x2kd" is waiting to start: CrashLoopBackOff',
        },
        {
          label: "Recover the crashed instance",
          detail:
            "--previous prints the logs of the container that already died — usually the actual error message.",
          command: "kubectl logs web-7d9c5b8f6c-4x2kd --previous",
          output:
            "2026-07-10T09:14:01Z INFO  starting web-app 1.0.0 on :8080\n2026-07-10T09:14:02Z FATAL could not open config /etc/app/config.yaml: no such file or directory\nexit status 1",
        },
        {
          label: "Follow a whole Deployment",
          detail:
            "logs accepts a controller and a label selector; -f streams new lines. --tail limits history so you are not flooded.",
          command: "kubectl logs -f deploy/web -c web --tail=20",
          output:
            "Found 2 pods, using pod/web-7d9c5b8f6c-lp8qz\n2026-07-10T09:22:10Z INFO  GET /healthz 200\n2026-07-10T09:22:20Z INFO  GET /healthz 200",
        },
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "CrashLoopBackOff? Reach for --previous first",
      text: "The current container is either not running or is a fresh restart with no useful output yet. kubectl logs --previous is the only way to see what the instance said just before it exited. Without it you will stare at an empty log and conclude, wrongly, that the app is silent.",
    },
    {
      type: "heading",
      id: "exec-forward",
      text: "Reach inside: exec and port-forward",
    },
    {
      type: "demo",
      title: "exec into a shell, port-forward to your laptop",
      description:
        "When you need to test from the Pod's own network namespace (its DNS, its service account, its localhost), exec runs a command inside the container. port-forward tunnels a container port to 127.0.0.1 so your browser or curl can hit it directly, bypassing the Service.",
      steps: [
        {
          label: "Open an interactive shell",
          detail:
            "-i keeps stdin open, -t allocates a TTY. Everything after -- runs inside the container.",
          command: "kubectl exec -it web-7d9c5b8f6c-lp8qz -- sh",
          output:
            "/ # wget -qO- -S localhost:8080/readyz\n  HTTP/1.1 404 Not Found\n/ # wget -qO- -S localhost:8080/healthz\n  HTTP/1.1 200 OK",
        },
        {
          label: "Tunnel a port locally",
          detail:
            "port-forward maps localhost:8080 on your machine straight to the Pod, so you can reproduce a request without a working Service or Ingress.",
          command: "kubectl port-forward pod/web-7d9c5b8f6c-lp8qz 8080:8080",
          output:
            "Forwarding from 127.0.0.1:8080 -> 8080\nForwarding from [::1]:8080 -> 8080\nHandling connection for 8080",
        },
        {
          label: "Confirm from your side of the tunnel",
          detail:
            "Now curl on your laptop reaches the container directly. Same 404 on /readyz — proof the Pod itself is the problem, not the Service or DNS.",
          command: "curl -s -o /dev/null -w '%{http_code}\\n' localhost:8080/readyz",
          output: "404",
        },
      ],
    },
    {
      type: "heading",
      id: "distroless-debug",
      text: "Distroless Pods: kubectl debug",
    },
    {
      type: "callout",
      tone: "key",
      title: "No shell in the image? Bring your own",
      text: 'Distroless and scratch images ship no sh, no ps, no curl — so kubectl exec -- sh fails with "executable file not found". kubectl debug attaches an EPHEMERAL container to the running Pod. It joins the target Pod\'s namespaces (with --target it shares the process namespace too), so your busybox toolbox can see the same network, filesystem mounts, and processes as the crashing app — without rebuilding the image or restarting the Pod.',
    },
    {
      type: "demo",
      title: "Attach a debug container to a distroless Pod",
      description:
        "exec fails because the image has no shell. kubectl debug injects a throwaway container with the tools you need, sharing the target's namespaces.",
      steps: [
        {
          label: "exec has nothing to run",
          detail: "A distroless image contains only the app binary — no /bin/sh to exec into.",
          command: "kubectl exec -it api-6b4f9c7d-2mzql -- sh",
          output:
            'error: Internal error occurred: error executing command in container: failed to exec in container: failed to start exec: exec: "sh": executable file not found in $PATH',
        },
        {
          label: "Attach an ephemeral debug container",
          detail:
            "--image supplies a toolbox; --target=api shares that container's process namespace so you can inspect its PIDs.",
          command: "kubectl debug -it api-6b4f9c7d-2mzql --image=busybox:1.36 --target=api",
          output:
            "Defaulting debug container name to debugger-8xzp1.\nIf you don't see a command prompt, try pressing enter.\n/ #",
        },
        {
          label: "Inspect from inside the shared namespace",
          detail:
            "You can now see the app process and probe its localhost, even though the app image itself has no shell.",
          command: "/ # ps -o pid,args && wget -qO- -S localhost:8080/readyz",
          output: "  PID ARGS\n    1 /app/api --listen :8080\n   14 sh\n  HTTP/1.1 404 Not Found",
        },
      ],
    },
    {
      type: "heading",
      id: "choose-command",
      text: "Pick the command that fits the symptom",
    },
    {
      type: "spotTheBug",
      language: "markdown",
      title: "The wrong tool for the state",
      prompt:
        'An on-call engineer is debugging a Pod stuck in Pending and runs the session below. They conclude "the app logs nothing, it must be broken code." What did they get wrong?',
      code: '$ kubectl get pod worker-0\nNAME       READY   STATUS    RESTARTS   AGE\nworker-0   0/1     Pending   0          4m\n\n$ kubectl logs worker-0\nError from server (BadRequest): container "worker" in pod "worker-0" is waiting to start: ContainerCreating\n\n$ kubectl logs worker-0 --previous\nError from server (BadRequest): previous terminated container "worker" not found',
      answer:
        "A Pending Pod has never been scheduled to a node, so no container has started and there are no logs to read — current or previous. Pending is a scheduling state, not an application state. The right first command is kubectl describe pod worker-0 (or kubectl get events), which reveals the scheduling reason: FailedScheduling with a message like 'insufficient cpu' or 'pod has unbound immediate PersistentVolumeClaims'. Reach for logs only once a container has actually run.",
    },
    {
      type: "challenge",
      language: "markdown",
      title: "Write the investigation",
      prompt:
        "A Service web-svc suddenly returns 503s. Its Pods show 1/1 Running with no restarts. Write the ordered command sequence that proves whether the problem is (a) the Service has no endpoints, or (b) the Pod is up but the app returns errors.",
      hint: "Endpoints tell you if traffic can reach any Pod at all. A port-forward lets you hit the Pod directly, skipping the Service, to isolate app errors from routing errors.",
      solution:
        "# 1. Does the Service actually route anywhere?\nkubectl get endpoints web-svc -o wide\nkubectl describe svc web-svc          # compare selector to Pod labels\n\n# 2. If endpoints exist, hit a Pod directly, bypassing the Service\nkubectl port-forward pod/web-7d9c5b8f6c-lp8qz 8080:8080 &\ncurl -s -o /dev/null -w '%{http_code}\\n' localhost:8080/\n\n# 3. If the direct call also fails, read the app's account\nkubectl logs deploy/web --tail=50\n\n# Zero endpoints => routing/selector problem. Endpoints present but\n# the direct curl 5xx => the app itself is failing, not the Service.",
    },
    {
      type: "decisionTable",
      title: "Symptom -> first command -> what it tells you",
      columns: ["Symptom", "First command", "What it reveals"],
      rows: [
        {
          label: "Pod stuck Pending",
          cells: [
            "STATUS Pending, never Ready",
            "kubectl describe pod (or get events)",
            "FailedScheduling reason: no node fits, unbound PVC, taint/affinity",
          ],
        },
        {
          label: "CrashLoopBackOff",
          cells: [
            "Restarts climbing, STATUS CrashLoopBackOff",
            "kubectl logs <pod> --previous",
            "The crashed instance's final error before it exited",
          ],
        },
        {
          label: "Running but 0/1 Ready",
          cells: [
            "READY 0/1, process is up",
            "kubectl describe pod (Events)",
            "Which probe failed and the exact HTTP status/path",
          ],
        },
        {
          label: "Service returns nothing",
          cells: [
            "Clients time out or get 503",
            "kubectl get endpoints <svc>",
            "Whether any Ready Pod backs the Service at all",
          ],
        },
        {
          label: "ImagePullBackOff",
          cells: [
            "STATUS ImagePullBackOff/ErrImagePull",
            "kubectl describe pod (Events)",
            "Pull error: bad tag, private registry, missing pull secret",
          ],
        },
        {
          label: "Distroless, no shell",
          cells: [
            "exec -- sh fails: no such executable",
            "kubectl debug --image=busybox --target",
            "A toolbox inside the Pod's namespaces without changing the image",
          ],
        },
      ],
    },
    {
      type: "compare",
      caption: "The same outage, two ways. Guessing burns the evidence; the loop preserves it.",
      left: {
        title: "Guess and restart",
        code: "# 'Just bounce it'\nkubectl delete pod web-7d9c5b8f6c-4x2kd\n# Pod restarts, --previous logs and\n# the old Events are now gone.\n# Symptom returns in 5 minutes,\n# and you know nothing new.",
      },
      right: {
        title: "Read the evidence first",
        code: "kubectl get pods -o wide\nkubectl describe pod web-7d9c5b8f6c-4x2kd\nkubectl logs web-7d9c5b8f6c-4x2kd --previous\n# Reason in hand (missing config file),\n# THEN patch the one field that fixes it.",
      },
    },
    { type: "lab", labId: "debug-broken-deploy" },
    {
      type: "takeaways",
      items: [
        "Run the same loop every time: get to widen, describe to focus, logs to listen, exec/debug to reach in, patch to act.",
        "get -o wide separates scheduling problems (no node) from app problems; -o yaml exposes status fields; --field-selector filters cheaply at the server.",
        "describe is where the Events and container exit codes live — read Events newest-first, and remember they expire in about an hour.",
        "CrashLoopBackOff needs kubectl logs --previous; the live container has already died.",
        "Distroless images have no shell: kubectl debug attaches an ephemeral toolbox container that shares the Pod's namespaces.",
      ],
    },
    {
      type: "quiz",
      id: "kubectl-debugging-q1",
      question: "Why should you run kubectl describe after kubectl get?",
      options: [
        {
          id: "a",
          text: "describe adds Events and detailed fields (probe results, exit codes) that table output hides.",
          correct: true,
          explanation:
            "get is a summary table; describe stitches together the container state and the Events timeline that explain the failure.",
        },
        {
          id: "b",
          text: "describe automatically fixes the object.",
          correct: false,
          explanation: "describe is strictly read-only; it never mutates a resource.",
        },
        {
          id: "c",
          text: "describe deletes failed Pods so the controller recreates them.",
          correct: false,
          explanation:
            "describe does not delete or recreate anything; it only reports current state.",
        },
      ],
    },
    {
      type: "quiz",
      id: "kubectl-debugging-q2",
      question:
        "kubectl exec -it into a distroless Pod fails with 'executable file not found in $PATH'. What is the right next step?",
      options: [
        {
          id: "a",
          text: "Use kubectl debug to attach an ephemeral container with a shell that shares the Pod's namespaces.",
          correct: true,
          explanation:
            "Distroless images ship no shell, so debug injects a throwaway toolbox container into the running Pod without rebuilding the image.",
        },
        {
          id: "b",
          text: "Rebuild the image with sh baked in and redeploy before you can investigate.",
          correct: false,
          explanation:
            "That works eventually but is slow and changes the workload; kubectl debug inspects the live Pod immediately.",
        },
        {
          id: "c",
          text: "Run kubectl logs --previous, since exec is impossible on distroless images.",
          correct: false,
          explanation:
            "Logs are useful but answer a different question; they do not give you an interactive shell inside the Pod's namespaces.",
        },
      ],
    },
  ],
  labs: [
    {
      id: "debug-broken-deploy",
      title: "Diagnose a Deployment that never goes Ready",
      prompt:
        "A Deployment rolls out but no Pods become Ready. Use get, describe, and events to find the cause, then fix it.",
      files: [
        { path: "deployment.yaml", language: "yaml", initialValue: WEB_DEPLOYMENT_BAD_PROBE },
      ],
      initialManifests: [],
      registeredImages: [WEB_IMAGE],
      tryChanging: "Fix readinessProbe.httpGet.path to /healthz and re-apply.",
      tasks: [
        "Apply and see 0 Ready Pods.",
        "Describe a Pod and read its events.",
        "Fix the probe path and re-apply.",
      ],
      commands: ["kubectl get pods", "kubectl describe pod <pod>", "kubectl get events"],
      debrief:
        "get shows the symptom (NotReady); describe and events show the cause (readiness probe on /readyz returns 404). The loop is always get to see what, then describe/logs/events to see why.",
    },
  ],
};

export const DEBUGGING_LESSONS = compileLessons([logs, events, probes, kubectlDebugging]);
