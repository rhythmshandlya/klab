import type { DocsLesson } from "@/lib/domain/types";

import {
  compileLessons,
  WEB_IMAGE,
  API_IMAGE,
  WEB_POD,
  WEB_SERVICE,
  WEB_SERVICE_BAD_SELECTOR,
  API_POD,
  API_SERVICE,
  quiz,
  qOption,
} from "./authoring";

const services: DocsLesson = {
  slug: ["networking", "services"],
  title: "Services & Endpoints",
  description:
    "A Service is a stable address that load-balances to a changing set of Pods selected by labels.",
  section: "Networking",
  order: 0,
  concepts: ["services", "endpointslices", "labels-selectors", "networking"],
  relatedLevelSlug: "service-selector-mismatch",
  content: [
    { type: "heading", id: "why-services", text: "Why Services exist" },
    {
      type: "paragraph",
      text: "Pods are ephemeral and their IPs change. A Service gives clients one durable name and virtual IP. It selects Pods by label and forwards traffic only to matching Ready Pods.",
    },
    { type: "diagram", variant: "service-routing", title: "Service routing path" },
    { type: "heading", id: "anatomy", text: "Anatomy of a Service" },
    {
      type: "paragraph",
      text: "A Service has only three things that matter: which Pods it routes to (selector), the port clients connect to (port), and the port the container listens on (targetPort). Read every Service through these three lenses.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A complete Service",
      caption: "Every field you need for in-cluster routing.",
      lines: [
        { code: "apiVersion: v1" },
        { code: "kind: Service" },
        {
          code: "metadata:",
          note: "identity: name + namespace — this also becomes the DNS name clients use",
        },
        { code: "  name: web-svc" },
        { code: "  namespace: default" },
        { code: "spec:" },
        {
          code: "  selector:",
          note: "HOW the Service finds Pods — must match a Pod's labels exactly",
        },
        { code: "    app: web", note: "an exact key:value pair from the Pod's metadata.labels" },
        { code: "  ports:" },
        { code: "    - name: http" },
        {
          code: "      port: 80",
          note: "the port CLIENTS connect to (the Service's own port)",
        },
        {
          code: "      targetPort: 8080",
          note: "the port the CONTAINER listens on",
        },
        { code: "      protocol: TCP" },
      ],
    },
    { type: "heading", id: "build-it", text: "Build one from scratch" },
    {
      type: "buildUp",
      language: "yaml",
      title: "A Service grows in three steps",
      stages: [
        {
          label: "Skeleton",
          note: "Minimum valid object: apiVersion, kind, a name, and an empty spec. It routes nowhere yet — no selector, no ports.",
          code: "apiVersion: v1\nkind: Service\nmetadata:\n  name: web-svc\nspec: {}",
        },
        {
          label: "Add a selector",
          note: "Now the Service knows WHICH Pods it cares about (label app: web). Still no port, so no traffic can flow yet.",
          code: "apiVersion: v1\nkind: Service\nmetadata:\n  name: web-svc\nspec:\n  selector:\n    app: web",
        },
        {
          label: "Add ports",
          note: "Wire the ports: clients hit 80, the Service forwards to 8080 on the Pod. Now traffic can flow to matching Ready Pods.",
          code: "apiVersion: v1\nkind: Service\nmetadata:\n  name: web-svc\nspec:\n  selector:\n    app: web\n  ports:\n    - port: 80\n      targetPort: 8080",
        },
      ],
    },
    { type: "heading", id: "selector-mechanics", text: "How the selector matches Pods" },
    {
      type: "concept",
      term: "Selector to EndpointSlice",
      definition:
        "The EndpointSlice controller watches Pods matching a Service selector and publishes the Ready Pod IPs as endpoints.",
    },
    {
      type: "compare",
      caption:
        "The Service selector is compared against Pod labels, key for key. A single mismatch means no match.",
      left: {
        title: "Pod labels",
        code: "metadata:\n  labels:\n    app: web\n    tier: frontend",
      },
      right: {
        title: "Service selector",
        code: "spec:\n  selector:\n    app: web\n# matches — extra Pod labels are ignored",
      },
    },
    {
      type: "callout",
      tone: "key",
      title: "The three ports people confuse",
      text: "containerPort (in the Pod spec) is where the app listens. targetPort (in the Service) is where the Service sends traffic — it usually equals containerPort. port (in the Service) is what clients connect to. Three different numbers that must agree end to end.",
    },
    { type: "heading", id: "spot-the-bug", text: "Read a broken Service" },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "This Service was created for the web app, but it has zero endpoints. The web Pods exist and are Ready. What's wrong?",
      code: "apiVersion: v1\nkind: Service\nmetadata:\n  name: web-svc\nspec:\n  selector:\n    app: api\n  ports:\n    - port: 80\n      targetPort: 8080",
      answer:
        "The selector says app: api, but the web Pods are labeled app: web. The selector matches no Pods, so the EndpointSlice controller publishes zero endpoints. Fix: change app: api to app: web.",
    },
    { type: "heading", id: "write-it", text: "Write one yourself" },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Write a Service named api-svc that routes to Pods labeled app: api. Clients connect on port 80, and the api container listens on 8080.",
      hint: "You need metadata.name, spec.selector, and spec.ports with port and targetPort.",
      solution:
        "apiVersion: v1\nkind: Service\nmetadata:\n  name: api-svc\nspec:\n  selector:\n    app: api\n  ports:\n    - port: 80\n      targetPort: 8080",
    },
    { type: "lab", labId: "service-selector" },
    { type: "heading", id: "service-types", text: "Which Service type?" },
    {
      type: "decisionTable",
      title: "Choosing a Service type",
      columns: ["Reachable from", "Typical use"],
      rows: [
        {
          label: "ClusterIP",
          cells: ["Inside the cluster only", "Default — service-to-service traffic"],
        },
        {
          label: "NodePort",
          cells: ["Inside + a static port per node", "Simple external access, or an LB backend"],
        },
        {
          label: "LoadBalancer",
          cells: [
            "Inside + a cloud load balancer IP",
            "Production external entry (needs a provider)",
          ],
        },
        {
          label: "Headless (clusterIP: None)",
          cells: ["Clients reach Pods directly via DNS", "StatefulSets; per-Pod clients"],
        },
      ],
    },
    quiz("services-q1", "A Service has zero endpoints. What should you check first?", [
      qOption(
        "a",
        "Selector labels and Pod readiness.",
        true,
        "Most Service endpoint failures come from selector mismatches or NotReady Pods.",
      ),
      qOption(
        "b",
        "The API server logo.",
        false,
        "The API server stores objects; Service membership comes from selectors and readiness.",
      ),
      qOption(
        "c",
        "The Deployment name only.",
        false,
        "Services do not select Deployments by name; they select Pods by labels.",
      ),
    ]),
  ],
  labs: [
    {
      id: "service-selector",
      title: "Fix Service endpoints",
      prompt: "Start from a broken selector, then change app: api to app: web and apply.",
      files: [
        { path: "pod.yaml", language: "yaml", initialValue: WEB_POD },
        { path: "service.yaml", language: "yaml", initialValue: WEB_SERVICE_BAD_SELECTOR },
      ],
      initialManifests: [],
      registeredImages: [WEB_IMAGE],
      tryChanging: "In service.yaml, change selector app from api to web.",
      tasks: [
        "Observe zero endpoints.",
        "Fix the selector.",
        "Watch the Service gain a ready endpoint.",
      ],
      commands: ["kubectl get endpoints web-svc", "kubectl describe svc web-svc"],
      debrief:
        "The Service did not care that a Pod existed. It only routed after the Pod labels matched the selector and the Pod was Ready.",
    },
  ],
};

const dns: DocsLesson = {
  slug: ["networking", "dns-in-kubernetes"],
  title: "DNS in Kubernetes",
  description: "Kubernetes DNS turns Services into names like web-svc.default.svc.cluster.local.",
  section: "Networking",
  order: 1,
  concepts: ["dns", "services", "networking", "debugging"],
  relatedLevelSlug: "dns-resolution-failure",
  content: [
    {
      type: "heading",
      id: "why-cluster-dns",
      text: "Why cluster DNS exists",
    },
    {
      type: "paragraph",
      text: "A Service gives you a stable ClusterIP, but nobody wants to hard-code virtual IPs into config. Kubernetes runs an in-cluster DNS server (CoreDNS) that turns Service and Pod objects into names your apps can resolve. CoreDNS runs as a Deployment in kube-system, fronted by a Service (historically named kube-dns) at a fixed ClusterIP such as 10.96.0.10. When a Pod starts, the kubelet writes that DNS IP into the Pod's /etc/resolv.conf, so every process in the Pod resolves Service names automatically. The mental model: DNS answers 'what address is behind this name?' — it does NOT decide whether traffic succeeds. Resolving web-svc gets you the Service's ClusterIP; the Service's EndpointSlices then decide which Ready Pod receives the request. A name can resolve perfectly and still return connection-refused when there are zero endpoints.",
    },
    {
      type: "diagram",
      variant: "service-routing",
      title: "From name to Pod",
      caption:
        "CoreDNS resolves the name to a ClusterIP; the Service then load-balances to a Ready endpoint.",
    },
    {
      type: "heading",
      id: "name-schema",
      text: "The name schema: <svc>.<ns>.svc.cluster.local",
    },
    {
      type: "paragraph",
      text: "Every ClusterIP Service gets a predictable A record following one template: <service>.<namespace>.svc.cluster.local. So a Service named web-svc in the default namespace answers to web-svc.default.svc.cluster.local, and that A record resolves to the Service's ClusterIP. The cluster domain (cluster.local) is configurable at install time, but the shape never changes: service name, then namespace, then the fixed svc marker, then the cluster domain.",
    },
    {
      type: "concept",
      term: "FQDN segments",
      definition:
        "In web-svc.default.svc.cluster.local: 'web-svc' is the Service name, 'default' is its namespace, 'svc' distinguishes Service records from Pod records (which use .pod.), and 'cluster.local' is the cluster domain. A trailing dot (web-svc.default.svc.cluster.local.) makes it fully absolute, telling the resolver to skip search-domain expansion entirely.",
    },
    {
      type: "heading",
      id: "short-names",
      text: "Short names, search domains, and ndots",
    },
    {
      type: "paragraph",
      text: "You rarely type the full name. Inside a Pod you can call http://web-svc/ and it still works, because the kubelet writes a search list and an ndots option into resolv.conf. The resolver appends each search domain in turn until one resolves. This is why a short name only reaches Services in the SAME namespace: the first search domain is <your-namespace>.svc.cluster.local, so web-svc becomes web-svc.<your-namespace>.svc.cluster.local first.",
    },
    {
      type: "annotatedCode",
      language: "markdown",
      title: "A Pod's /etc/resolv.conf",
      caption:
        "For a Pod running in the 'default' namespace. The kubelet injects all of this at Pod start.",
      lines: [
        {
          code: "nameserver 10.96.0.10",
          note: "the CoreDNS Service ClusterIP — every lookup goes here first",
        },
        {
          code: "search default.svc.cluster.local svc.cluster.local cluster.local",
          note: "search domains, tried in order; the FIRST is your own namespace, which is why short names stay namespace-local",
        },
        {
          code: "options ndots:5",
          note: "if a queried name has fewer than 5 dots, the resolver tries it WITH each search domain appended before trying it as an absolute name",
        },
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "The ndots:5 tax",
      text: "Because ndots is 5, a name like api.backend (1 dot) is first tried as api.backend.default.svc.cluster.local, then api.backend.svc.cluster.local, then api.backend.cluster.local — three failing lookups — before it is ever tried as the literal api.backend. For external hostnames this multiplies DNS traffic and adds latency. Fix it by using a fully qualified name with a trailing dot (example.com.), which resolves in one query and skips the search list.",
    },
    {
      type: "heading",
      id: "headless",
      text: "Headless Services return Pod A records",
    },
    {
      type: "paragraph",
      text: "A normal Service publishes one A record pointing at its ClusterIP. Set clusterIP: None and the Service becomes headless: it has no virtual IP, and CoreDNS instead returns one A record per Ready Pod behind the selector. The client sees the actual Pod IPs and connects to them directly. This is how StatefulSets give each Pod a stable name: <pod-name>.<service>.<namespace>.svc.cluster.local resolves to that specific Pod.",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "Turn a Service headless in three steps",
      stages: [
        {
          label: "A normal ClusterIP Service",
          note: "Standard Service: it gets a ClusterIP and one A record. DNS returns the virtual IP, and kube-proxy load-balances behind it.",
          code: "apiVersion: v1\nkind: Service\nmetadata:\n  name: cache\n  namespace: default\nspec:\n  selector:\n    app: redis\n  ports:\n    - port: 6379",
        },
        {
          label: "Make it headless",
          note: "Adding clusterIP: None removes the virtual IP. Now DNS for cache.default.svc.cluster.local returns an A record for EACH Ready Pod IP instead of a single VIP.",
          code: "apiVersion: v1\nkind: Service\nmetadata:\n  name: cache\n  namespace: default\nspec:\n  clusterIP: None\n  selector:\n    app: redis\n  ports:\n    - port: 6379",
        },
        {
          label: "Address individual Pods",
          note: "Pair the headless Service with a StatefulSet (serviceName: cache) and each Pod gets its own name: cache-0.cache.default.svc.cluster.local, cache-1.cache..., letting clients target one replica deterministically.",
          code: "apiVersion: v1\nkind: Service\nmetadata:\n  name: cache\n  namespace: default\nspec:\n  clusterIP: None\n  selector:\n    app: redis\n  ports:\n    - name: redis\n      port: 6379\n# used by: StatefulSet spec.serviceName: cache",
        },
      ],
    },
    {
      type: "compare",
      caption:
        "Same selector, different DNS answer. The clusterIP field is the only change that matters.",
      left: {
        title: "ClusterIP Service — one VIP",
        code: "$ dig +short cache.default.svc.cluster.local\n10.96.42.7\n# one stable virtual IP; kube-proxy balances behind it",
      },
      right: {
        title: "Headless (clusterIP: None) — Pod IPs",
        code: "$ dig +short cache.default.svc.cluster.local\n10.244.1.9\n10.244.2.4\n10.244.3.6\n# one A record per Ready Pod; client picks",
      },
    },
    {
      type: "heading",
      id: "srv-records",
      text: "SRV records for named ports",
    },
    {
      type: "paragraph",
      text: "When a Service port has a name, CoreDNS also publishes an SRV record that advertises both the port number and the target host, so clients can discover the port without hard-coding it. The SRV name is _<port-name>._<protocol>.<service>.<namespace>.svc.cluster.local, so a named 'http' port yields _http._tcp.web-svc.default.svc.cluster.local, whose answer '0 100 80 web-svc.default.svc.cluster.local.' carries the port (80) and target host. This matters most with headless Services, where the SRV targets are the individual Pod hostnames — a client can enumerate every replica and its port in one query.",
    },
    {
      type: "callout",
      tone: "info",
      title: "Pods get DNS too",
      text: "Beyond Services, a Pod can be resolved by its IP under the pod domain: 10-244-1-9.default.pod.cluster.local (dashes, not dots). Pods created by a StatefulSet or given a hostname/subdomain also get proper A records. Which resolver a Pod uses is set by spec.dnsPolicy — the default ClusterFirst sends cluster-suffixed names to CoreDNS and forwards everything else upstream; Default (confusingly) means 'inherit the node's resolv.conf' and skips cluster DNS.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Spot the bug: a cross-namespace call",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "This client Pod lives in the 'frontend' namespace and needs to reach a Service 'web-svc' that lives in the 'backend' namespace. Connections fail with a name-resolution error. What is wrong, and what are two ways to fix it?",
      code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: client\n  namespace: frontend\nspec:\n  containers:\n    - name: app\n      image: klab/web-app:1.0.0\n      env:\n        - name: UPSTREAM_URL\n          value: http://web-svc/",
      answer:
        "The short name web-svc only resolves within the caller's own namespace. The client is in 'frontend', so the resolver expands web-svc to web-svc.frontend.svc.cluster.local (the first search domain) — but the Service is in 'backend', so that record does not exist. Short names never cross namespaces. Fix by qualifying the namespace: http://web-svc.backend/ (which the search list completes to ...svc.cluster.local), or use the full FQDN http://web-svc.backend.svc.cluster.local/ for an unambiguous, search-independent name.",
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Write a headless Service named 'cache' in the 'data' namespace that selects Pods labeled app: redis and exposes a named port 'redis' on 6379, so clients receive per-Pod A records instead of a single virtual IP.",
      hint: "Headless means one field: clusterIP: None. Give the port a name so an SRV record is published too.",
      solution:
        "apiVersion: v1\nkind: Service\nmetadata:\n  name: cache\n  namespace: data\nspec:\n  clusterIP: None\n  selector:\n    app: redis\n  ports:\n    - name: redis\n      port: 6379\n      targetPort: 6379",
    },
    {
      type: "decisionTable",
      title: "Which name form should I use?",
      columns: ["Resolves how", "Best for"],
      rows: [
        {
          label: "web-svc (short name)",
          cells: [
            "Expanded via the search list; only finds Services in the caller's namespace",
            "Same-namespace calls where brevity is fine",
          ],
        },
        {
          label: "web-svc.backend",
          cells: [
            "Search list completes it to ...svc.cluster.local; reaches another namespace",
            "Cross-namespace calls in app config",
          ],
        },
        {
          label: "web-svc.backend.svc.cluster.local.",
          cells: [
            "Fully absolute (trailing dot); one query, no search-list expansion",
            "Latency-sensitive or ambiguous names; config that must be portable",
          ],
        },
      ],
    },
    {
      type: "lab",
      labId: "dns-chain",
    },
    {
      type: "takeaways",
      items: [
        "CoreDNS turns Services into names of the form <svc>.<ns>.svc.cluster.local, resolving to the Service ClusterIP.",
        "DNS only finds the address; EndpointSlices still decide whether traffic reaches a Ready Pod.",
        "Short names resolve only within the caller's namespace because the first search domain is <your-ns>.svc.cluster.local — qualify with the namespace to cross it.",
        "ndots:5 makes short and low-dot names trigger several search-domain lookups; a trailing-dot FQDN resolves in one query.",
        "Headless Services (clusterIP: None) return per-Pod A records, and named ports add SRV records for port discovery.",
      ],
    },
    {
      type: "quiz",
      id: "dns-q1",
      question: "What does a normal (ClusterIP) Service DNS name resolve to?",
      options: [
        {
          id: "a",
          text: "The Service's stable ClusterIP.",
          correct: true,
          explanation:
            "CoreDNS returns the Service's virtual IP; EndpointSlices then decide which Ready Pod actually receives the request.",
        },
        {
          id: "b",
          text: "A random Pod name.",
          correct: false,
          explanation:
            "A normal Service gives a stable VIP, not a Pod name. Per-Pod names come from headless Services.",
        },
        {
          id: "c",
          text: "Only external public IPs.",
          correct: false,
          explanation:
            "Cluster DNS primarily resolves in-cluster Service and Pod names, not public IPs.",
        },
      ],
    },
  ],
  labs: [
    {
      id: "dns-chain",
      title: "Trace an API to web Service call",
      prompt: "Run a web Service and an API Pod configured to call it by DNS name.",
      files: [
        { path: "web-pod.yaml", language: "yaml", initialValue: WEB_POD },
        { path: "web-service.yaml", language: "yaml", initialValue: WEB_SERVICE },
        { path: "api-pod.yaml", language: "yaml", initialValue: API_POD },
        { path: "api-service.yaml", language: "yaml", initialValue: API_SERVICE },
      ],
      initialManifests: [],
      registeredImages: [WEB_IMAGE, API_IMAGE],
      tryChanging: "Change UPSTREAM_URL to http://missing-svc/ and apply.",
      tasks: [
        "Start web and api.",
        "Break the upstream DNS name.",
        "Open in Playground to curl api-svc.",
      ],
      commands: ["dig web-svc", "curl http://api-svc/"],
      debrief:
        "DNS resolves a Service name first. A bad name fails before traffic can reach endpoints.",
    },
  ],
};

const ingress: DocsLesson = {
  slug: ["networking", "ingress"],
  title: "Ingress",
  description: "Ingress routes external HTTP traffic to Services using host and path rules.",
  section: "Networking",
  order: 2,
  concepts: ["services", "networking", "debugging"],
  content: [
    {
      type: "heading",
      id: "why-ingress",
      text: "Why Ingress exists",
    },
    {
      type: "paragraph",
      text: "A Service gives you a stable in-cluster address, and a LoadBalancer Service can expose one Service externally. But real sites route many hostnames and URL paths to many Services behind a single external IP. Ingress is the API object for that: L7 HTTP(S) routing at the edge of the cluster, matching on host and path and forwarding to backend Services.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Ingress is inert without a controller",
      text: "An Ingress object is just a set of routing rules stored in the API server. It does nothing on its own. You must install an ingress controller (nginx, Traefik, HAProxy, a cloud provider's, etc.). The controller watches Ingress objects and programs an actual proxy. No controller means your rules are read by nobody and no traffic is routed.",
    },
    {
      type: "diagram",
      variant: "service-routing",
      title: "Client to Ingress to Service to Pod",
      caption:
        "The controller terminates the request, matches host + path, then forwards to a backend Service, which load-balances to Ready Pods.",
    },
    {
      type: "heading",
      id: "anatomy",
      text: "Anatomy of an Ingress",
    },
    {
      type: "paragraph",
      text: "Read every Ingress through four lenses: which controller handles it (ingressClassName), which hostnames and paths it matches (rules), how each path is matched (pathType), and how HTTPS is terminated (tls). Everything below hangs off those.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A complete Ingress",
      caption: "Host + path routing, TLS termination, and a default backend.",
      lines: [
        {
          code: "apiVersion: networking.k8s.io/v1",
          note: "the stable v1 API — older betas (extensions/v1beta1) are gone",
        },
        {
          code: "kind: Ingress",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: shop-ingress",
        },
        {
          code: "  namespace: default",
          note: "an Ingress can only route to Services in its OWN namespace",
        },
        {
          code: "spec:",
        },
        {
          code: "  ingressClassName: nginx",
          note: "WHICH controller owns this Ingress — must match an installed IngressClass",
        },
        {
          code: "  tls:",
          note: "enables HTTPS; the controller terminates TLS here",
        },
        {
          code: "    - hosts:",
        },
        {
          code: "        - shop.example.com",
          note: "must match the SNI/Host the client sends",
        },
        {
          code: "      secretName: shop-tls",
          note: "a kubernetes.io/tls Secret holding tls.crt and tls.key",
        },
        {
          code: "  rules:",
        },
        {
          code: "    - host: shop.example.com",
          note: "virtual-host match; omit host to match ALL hostnames",
        },
        {
          code: "      http:",
        },
        {
          code: "        paths:",
        },
        {
          code: "          - path: /api",
          note: "URL path prefix to match on the incoming request",
        },
        {
          code: "            pathType: Prefix",
          note: "Prefix matches /api and /api/* by path element; also Exact or ImplementationSpecific",
        },
        {
          code: "            backend:",
        },
        {
          code: "              service:",
        },
        {
          code: "                name: api-svc",
          note: "the target Service — it still needs Ready endpoints of its own",
        },
        {
          code: "                port:",
        },
        {
          code: "                  number: 80",
          note: "the Service's port (not the container port)",
        },
        {
          code: "          - path: /",
          note: "a second, less-specific rule; controllers match the longest path first",
        },
        {
          code: "            pathType: Prefix",
        },
        {
          code: "            backend:",
        },
        {
          code: "              service:",
        },
        {
          code: "                name: web-svc",
        },
        {
          code: "                port:",
        },
        {
          code: "                  number: 80",
        },
        {
          code: "  defaultBackend:",
          note: "catch-all for requests that match no rule (e.g. unknown host/path)",
        },
        {
          code: "    service:",
        },
        {
          code: "      name: fallback-svc",
        },
        {
          code: "      port:",
        },
        {
          code: "        number: 80",
        },
      ],
    },
    {
      type: "heading",
      id: "build-it",
      text: "Build one from scratch",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "An Ingress grows in three steps",
      stages: [
        {
          label: "One rule, one Service",
          note: "Start minimal: name a controller with ingressClassName and send every path to a single Service. Because host is omitted, this matches any hostname.",
          code: "apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: shop-ingress\nspec:\n  ingressClassName: nginx\n  rules:\n    - http:\n        paths:\n          - path: /\n            pathType: Prefix\n            backend:\n              service:\n                name: web-svc\n                port:\n                  number: 80",
        },
        {
          label: "Add host + a path split",
          note: "Scope the rule to shop.example.com and split traffic: /api goes to api-svc, everything else to web-svc. The controller prefers the longer matching path, so /api wins over /.",
          code: "apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: shop-ingress\nspec:\n  ingressClassName: nginx\n  rules:\n    - host: shop.example.com\n      http:\n        paths:\n          - path: /api\n            pathType: Prefix\n            backend:\n              service:\n                name: api-svc\n                port:\n                  number: 80\n          - path: /\n            pathType: Prefix\n            backend:\n              service:\n                name: web-svc\n                port:\n                  number: 80",
        },
        {
          label: "Terminate TLS",
          note: "Add a tls block referencing a kubernetes.io/tls Secret. The controller now serves HTTPS for shop.example.com and decrypts before matching rules. The Secret must exist in the same namespace.",
          code: "apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: shop-ingress\nspec:\n  ingressClassName: nginx\n  tls:\n    - hosts:\n        - shop.example.com\n      secretName: shop-tls\n  rules:\n    - host: shop.example.com\n      http:\n        paths:\n          - path: /api\n            pathType: Prefix\n            backend:\n              service:\n                name: api-svc\n                port:\n                  number: 80\n          - path: /\n            pathType: Prefix\n            backend:\n              service:\n                name: web-svc\n                port:\n                  number: 80",
        },
      ],
    },
    {
      type: "heading",
      id: "pathtype",
      text: "How pathType changes matching",
    },
    {
      type: "concept",
      term: "pathType",
      definition:
        "A required field on every path that tells the controller HOW to compare the request path. Prefix matches by whole path segments (/foo matches /foo and /foo/bar but not /foobar). Exact matches the path character-for-character. ImplementationSpecific hands matching to the controller, which may use regex or vendor rules.",
    },
    {
      type: "decisionTable",
      title: "Choosing a pathType",
      columns: ["Matches", "Use when"],
      rows: [
        {
          label: "Prefix",
          cells: [
            "Path split on element boundaries: /api matches /api and /api/v1, not /apifoo",
            "The common case — routing a URL subtree to a Service",
          ],
        },
        {
          label: "Exact",
          cells: [
            "Only the exact path, case-sensitive: /healthz matches nothing else",
            "Pinning one precise URL, e.g. a single health endpoint",
          ],
        },
        {
          label: "ImplementationSpecific",
          cells: [
            "Whatever the controller decides (often regex or annotation-driven)",
            "You need controller-specific features like rewrites or regex paths",
          ],
        },
      ],
    },
    {
      type: "callout",
      tone: "key",
      title: "ingressClassName, not the old annotation",
      text: "Modern Ingress selects its controller with spec.ingressClassName, which references an IngressClass object. The legacy kubernetes.io/ingress.class annotation still works in some controllers but is deprecated. If neither is set and no IngressClass is marked default, no controller claims the Ingress and nothing routes — a silent failure with a healthy-looking object.",
    },
    {
      type: "heading",
      id: "tls",
      text: "TLS termination",
    },
    {
      type: "callout",
      tone: "info",
      title: "The TLS Secret shape",
      text: "The Secret named in spec.tls[].secretName must be type kubernetes.io/tls and contain two keys: tls.crt (the certificate chain) and tls.key (the private key). The controller loads it and terminates HTTPS, then forwards plain HTTP to the backend Service unless you configure backend re-encryption. A missing or malformed Secret means the controller falls back to a fake/default certificate and browsers show a warning.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a broken Ingress",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "This Ingress was applied without error and the object shows up in kubectl get ingress, but requests to shop.example.com never reach any Pod and the ADDRESS column stays empty. The backend Services are healthy with Ready endpoints. What's wrong?",
      code: "apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: shop-ingress\nspec:\n  rules:\n    - host: shop.example.com\n      http:\n        paths:\n          - path: /\n            pathType: Prefix\n            backend:\n              service:\n                name: web-svc\n                port:\n                  number: 80",
      answer:
        "There is no ingressClassName and no IngressClass is marked as the cluster default, so no controller claims this Ingress. The rules are valid but nobody programs a proxy from them, which is why ADDRESS stays empty and traffic is never routed. Fix: set spec.ingressClassName to an installed class (e.g. nginx), and confirm an ingress controller is actually running. The same empty-ADDRESS symptom appears if the class is set but no controller for it is installed.",
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
        "Write an Ingress named blog-ingress handled by the nginx class. For host blog.example.com, route the exact path /health to health-svc on port 80, and route everything under / (a prefix) to blog-svc on port 80.",
      hint: "You need spec.ingressClassName, one rule with host set, and two paths — one pathType: Exact for /health and one pathType: Prefix for /. Each backend uses service.name and service.port.number.",
      solution:
        "apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: blog-ingress\nspec:\n  ingressClassName: nginx\n  rules:\n    - host: blog.example.com\n      http:\n        paths:\n          - path: /health\n            pathType: Exact\n            backend:\n              service:\n                name: health-svc\n                port:\n                  number: 80\n          - path: /\n            pathType: Prefix\n            backend:\n              service:\n                name: blog-svc\n                port:\n                  number: 80",
    },
    {
      type: "compare",
      caption:
        "pathType is not decoration. The same path string matches different requests depending on it.",
      left: {
        title: "pathType: Prefix, path: /api",
        code: "GET /api        -> match\nGET /api/v1     -> match\nGET /api/v1/x   -> match\nGET /apifoo     -> NO match",
      },
      right: {
        title: "pathType: Exact, path: /api",
        code: "GET /api        -> match\nGET /api/v1     -> NO match\nGET /api/       -> NO match\nGET /apifoo     -> NO match",
      },
    },
    {
      type: "takeaways",
      items: [
        "Ingress is L7 HTTP(S) routing rules; it never touches Pods directly — a controller does the work.",
        "No ingress controller (or no matching IngressClass) means the object exists but nothing routes.",
        "Route with host + path; pathType (Prefix, Exact, ImplementationSpecific) decides how paths are compared.",
        "spec.ingressClassName picks the controller; the kubernetes.io/ingress.class annotation is the deprecated way.",
        "TLS is terminated at the controller using a kubernetes.io/tls Secret named in spec.tls; the backend Service still needs Ready endpoints.",
      ],
    },
    {
      type: "quiz",
      id: "ingress-q1",
      question: "If an Ingress rule points to a Service with zero endpoints, what happens?",
      options: [
        {
          id: "a",
          text: "The request still fails at the backend.",
          correct: true,
          explanation:
            "Ingress routes to a Service, but the Service must still have Ready endpoints for traffic to succeed. Controllers typically return 502/503.",
        },
        {
          id: "b",
          text: "Kubernetes creates Pods automatically.",
          correct: false,
          explanation:
            "Ingress does not create workloads or replicas; it only routes to existing Services.",
        },
        {
          id: "c",
          text: "DNS is no longer needed.",
          correct: false,
          explanation:
            "External DNS still points clients at the controller, and cluster DNS still resolves the backend Service — both layers still matter.",
        },
      ],
    },
    {
      type: "quiz",
      id: "ingress-q2",
      question:
        "An Ingress object exists and looks correct, but ADDRESS is empty and nothing routes. What is the most likely cause?",
      options: [
        {
          id: "a",
          text: "No ingress controller is claiming it — ingressClassName is unset and there is no default IngressClass.",
          correct: true,
          explanation:
            "An Ingress is inert until a controller for its class programs a proxy; with no class and no controller, the rules do nothing.",
        },
        {
          id: "b",
          text: "The backend Service is using ClusterIP instead of NodePort.",
          correct: false,
          explanation:
            "Ingress controllers route to ClusterIP Services fine; the Service type is not why ADDRESS is empty.",
        },
        {
          id: "c",
          text: "The pathType was set to Prefix instead of Exact.",
          correct: false,
          explanation:
            "pathType affects which requests match a path, not whether the Ingress gets an address or is handled at all.",
        },
      ],
    },
  ],
  labs: [],
};

const serviceTypesGateway: DocsLesson = {
  slug: ["networking", "service-types-gateway-api"],
  title: "Service Types & Gateway API",
  description:
    "Choose the right Service exposure model and understand how Gateway API improves edge routing.",
  section: "Networking",
  order: 3,
  concepts: ["services", "ingress", "gateway-api", "networking"],
  content: [
    {
      type: "heading",
      id: "exposure-model",
      text: "How far does traffic need to travel?",
    },
    {
      type: "paragraph",
      text: "Every Service builds on the same core: a selector plus ports. The type field only decides the reach of the stable address it hands out — internal-only, per-node, or a real external load balancer. Pick the type by asking who needs to reach these Pods and from where, not by defaulting to whatever the last manifest used.",
    },
    {
      type: "diagram",
      variant: "service-routing",
      title: "One selector, four ways to expose it",
      caption:
        "ClusterIP is the base. NodePort and LoadBalancer layer wider reach on top of the same routing.",
    },
    {
      type: "heading",
      id: "the-five-types",
      text: "The five exposure models",
    },
    {
      type: "paragraph",
      text: "There are four values for spec.type — ClusterIP, NodePort, LoadBalancer, ExternalName — plus a fifth mode that is not a type at all: a headless Service, created by setting clusterIP: None on an otherwise normal ClusterIP Service. Each raises the reach of its predecessor, except ExternalName and headless, which change the routing behavior entirely.",
    },
    {
      type: "decisionTable",
      title: "Choosing a Service exposure model",
      columns: ["Reachable from", "Typical use", "Notes"],
      rows: [
        {
          label: "ClusterIP",
          cells: [
            "Inside the cluster only, via a virtual IP",
            "Default — service-to-service (east-west) traffic",
            "Gets a stable clusterIP and DNS name; the foundation the other types extend.",
          ],
        },
        {
          label: "NodePort",
          cells: [
            "Inside, plus a static port on every node's IP",
            "Dev/on-prem access, or a backend for an external load balancer",
            "Allocates a port in 30000-32767 by default; also keeps a ClusterIP underneath.",
          ],
        },
        {
          label: "LoadBalancer",
          cells: [
            "Inside, plus an external IP from the platform's load balancer",
            "Production external entry for a single Service",
            "Needs a cloud/MetalLB provider; also allocates a NodePort and ClusterIP under the hood.",
          ],
        },
        {
          label: "ExternalName",
          cells: [
            "Anywhere DNS resolves — points outside the cluster",
            "Alias an in-cluster name to an external hostname",
            "No selector, no ports, no proxying — returns a CNAME record only.",
          ],
        },
        {
          label: "Headless (clusterIP: None)",
          cells: [
            "Clients reach individual Pod IPs directly via DNS",
            "StatefulSets and clients that do their own load balancing",
            "No virtual IP; DNS returns one A record per Ready Pod instead of a single VIP.",
          ],
        },
      ],
    },
    {
      type: "concept",
      term: "ClusterIP is the substrate",
      definition:
        "NodePort and LoadBalancer do not replace ClusterIP — they add to it. A LoadBalancer Service still has a clusterIP and a nodePort; the external load balancer forwards to the nodePort, which forwards to the clusterIP, which balances across endpoints. Removing type: LoadBalancer just peels back the outermost layer.",
    },
    {
      type: "heading",
      id: "nodeport-anatomy",
      text: "Reading a NodePort Service",
    },
    {
      type: "paragraph",
      text: "A NodePort adds exactly one field to a ClusterIP Service — a third port number. Getting the three ports straight is the whole skill: clients hit the nodePort on a node, the node forwards to the Service port, and the Service forwards to targetPort on the Pod.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "A NodePort Service",
      caption: "Same selector and ports as a ClusterIP Service, plus type and nodePort.",
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
          code: "  type: NodePort",
          note: "the only thing that turns a ClusterIP Service into a NodePort one",
        },
        {
          code: "  selector:",
          note: "unchanged — reach does not affect which Pods are selected",
        },
        {
          code: "    app: web",
        },
        {
          code: "  ports:",
        },
        {
          code: "    - name: http",
        },
        {
          code: "      port: 80",
          note: "the ClusterIP port — in-cluster clients still use this",
        },
        {
          code: "      targetPort: 8080",
          note: "the container port the Pod listens on",
        },
        {
          code: "      nodePort: 30080",
          note: "the static port opened on EVERY node's IP; omit it and Kubernetes picks one from 30000-32767",
        },
      ],
    },
    {
      type: "heading",
      id: "build-loadbalancer",
      text: "Grow a LoadBalancer Service",
    },
    {
      type: "buildUp",
      language: "yaml",
      title: "From internal to external in three steps",
      stages: [
        {
          label: "ClusterIP base",
          note: "A plain internal Service: a selector and a port. Reachable only from inside the cluster on its virtual IP.",
          code: "apiVersion: v1\nkind: Service\nmetadata:\n  name: web-svc\nspec:\n  selector:\n    app: web\n  ports:\n    - port: 80\n      targetPort: 8080",
        },
        {
          label: "Promote to LoadBalancer",
          note: "Adding type: LoadBalancer asks the platform for an external IP. Kubernetes also auto-allocates a NodePort that the load balancer will target.",
          code: "apiVersion: v1\nkind: Service\nmetadata:\n  name: web-svc\nspec:\n  type: LoadBalancer\n  selector:\n    app: web\n  ports:\n    - port: 80\n      targetPort: 8080",
        },
        {
          label: "Restrict the source range",
          note: "loadBalancerSourceRanges narrows who the load balancer will accept from — a common hardening step once external traffic works.",
          code: "apiVersion: v1\nkind: Service\nmetadata:\n  name: web-svc\nspec:\n  type: LoadBalancer\n  loadBalancerSourceRanges:\n    - 203.0.113.0/24\n  selector:\n    app: web\n  ports:\n    - port: 80\n      targetPort: 8080",
        },
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "LoadBalancer needs a provider",
      text: "type: LoadBalancer only provisions an external IP if something is watching for it — a cloud controller manager on a managed cluster, or MetalLB on bare metal. On a plain kind/minikube cluster the Service sits in <pending> forever because no controller fulfills the request. That pending state is not a bug in your manifest.",
    },
    {
      type: "concept",
      term: "ExternalName",
      definition:
        "type: ExternalName has no selector, no ports, and no proxying. It makes the cluster DNS return a CNAME to spec.externalName (e.g. db.example.com), letting in-cluster clients use a stable Service name for something that lives outside the cluster. Because there is no proxy, it cannot rewrite ports or terminate TLS.",
    },
    {
      type: "callout",
      tone: "key",
      title: "Headless is for per-Pod addressing",
      text: "Setting clusterIP: None makes DNS return one A record per Ready Pod instead of a single virtual IP. That is what StatefulSets rely on so each replica gets a stable per-Pod DNS name (pod-0.web-svc...), and what clients that do client-side load balancing want. It is a routing mode, not a value of spec.type.",
    },
    {
      type: "heading",
      id: "spot-the-bug",
      text: "Read a broken NodePort",
    },
    {
      type: "spotTheBug",
      language: "yaml",
      prompt:
        "This Service is meant to expose the web app on a fixed node port, but kubectl apply is rejected. What is wrong?",
      code: "apiVersion: v1\nkind: Service\nmetadata:\n  name: web-svc\nspec:\n  type: NodePort\n  selector:\n    app: web\n  ports:\n    - port: 80\n      targetPort: 8080\n      nodePort: 8080",
      answer:
        "nodePort: 8080 is outside the allowed node-port range (30000-32767 by default), so the API server rejects it with 'provided port is not in the valid range'. The nodePort must be a high port like 30080 — it is a separate number from port and targetPort. Fix: set nodePort to a value in 30000-32767, or drop the field and let Kubernetes allocate one.",
    },
    {
      type: "heading",
      id: "gateway-api",
      text: "Above Services: Gateway API",
    },
    {
      type: "paragraph",
      text: "Services expose Pods, but HTTP edge routing — host and path rules, header matching, traffic splitting — lives above them. Ingress was the first answer; Gateway API is its successor. The key idea is role separation: instead of one Ingress object owned by everyone, Gateway API splits the concern into three resources owned by three different roles.",
    },
    {
      type: "steps",
      title: "The three Gateway API resources",
      items: [
        {
          title: "GatewayClass",
          text: "Cluster-scoped, owned by the infrastructure provider. Names the controller that implements Gateways — the parallel of IngressClass or StorageClass.",
        },
        {
          title: "Gateway",
          text: "Owned by the cluster operator. Declares the actual listeners: which ports, protocols, and hostnames the edge accepts, plus TLS config.",
        },
        {
          title: "HTTPRoute",
          text: "Owned by the application developer. Attaches to a Gateway via parentRefs and defines the host/path rules that forward to backend Services.",
        },
      ],
    },
    {
      type: "diagram",
      variant: "api-object",
      title: "GatewayClass -> Gateway -> HTTPRoute",
      caption:
        "Each resource has a distinct owner; HTTPRoutes attach to a Gateway rather than redefining the listener.",
    },
    {
      type: "annotatedCode",
      language: "yaml",
      title: "An HTTPRoute",
      caption: "The app-developer resource: it attaches to a Gateway and points at a Service.",
      lines: [
        {
          code: "apiVersion: gateway.networking.k8s.io/v1",
          note: "Gateway API is a separate API group, installed via CRDs — not the core v1 group",
        },
        {
          code: "kind: HTTPRoute",
        },
        {
          code: "metadata:",
        },
        {
          code: "  name: web-route",
        },
        {
          code: "spec:",
        },
        {
          code: "  parentRefs:",
          note: "which Gateway this route attaches to — the app dev references infra they do not own",
        },
        {
          code: "    - name: prod-gateway",
        },
        {
          code: "  hostnames:",
          note: "the virtual host(s) this route answers for; must be permitted by the Gateway listener",
        },
        {
          code: '    - "shop.example.com"',
        },
        {
          code: "  rules:",
        },
        {
          code: "    - matches:",
        },
        {
          code: "        - path:",
          note: "match rule — PathPrefix /app is explicit and typed, unlike Ingress's controller-specific path semantics",
        },
        {
          code: "            type: PathPrefix",
        },
        {
          code: "            value: /app",
        },
        {
          code: "      backendRefs:",
          note: "where matching traffic goes — a Service and its port; add weight here to split traffic",
        },
        {
          code: "        - name: web-svc",
        },
        {
          code: "          port: 80",
        },
      ],
    },
    {
      type: "compare",
      caption:
        "Ingress packs everything into one object; Gateway API separates infrastructure from application concerns.",
      left: {
        title: "Ingress",
        code: "one object, shared ownership\nhost + path rules\nfeatures via controller-specific\n  annotations\nHTTP(S) only in practice",
      },
      right: {
        title: "Gateway API",
        code: "GatewayClass (infra provider)\nGateway     (cluster operator)\nHTTPRoute   (app developer)\ntyped matches, traffic splitting\nHTTP, TCP, TLS, gRPC routes",
      },
    },
    {
      type: "challenge",
      language: "yaml",
      prompt:
        "Write an HTTPRoute named api-route that attaches to a Gateway named prod-gateway, answers for api.example.com, and sends all traffic under the path prefix /v1 to a Service named api-svc on port 8080.",
      hint: "You need spec.parentRefs (the Gateway), spec.hostnames, and one rule with a PathPrefix match plus a backendRefs entry.",
      solution:
        'apiVersion: gateway.networking.k8s.io/v1\nkind: HTTPRoute\nmetadata:\n  name: api-route\nspec:\n  parentRefs:\n    - name: prod-gateway\n  hostnames:\n    - "api.example.com"\n  rules:\n    - matches:\n        - path:\n            type: PathPrefix\n            value: /v1\n      backendRefs:\n        - name: api-svc\n          port: 8080',
    },
    {
      type: "callout",
      tone: "info",
      title: "Gateway API is portable across controllers",
      text: "Because matches, filters, and traffic splitting are first-class fields instead of annotations, an HTTPRoute means the same thing on every conformant controller. That portability — plus role separation — is the main reason Gateway API is the recommended successor to Ingress for new HTTP edge routing.",
    },
    {
      type: "takeaways",
      items: [
        "spec.type sets reach, not routing: ClusterIP (internal), NodePort (per-node port), LoadBalancer (external IP) each layer on top of the last.",
        "ExternalName is a DNS CNAME with no proxy; headless (clusterIP: None) returns per-Pod A records for StatefulSets and client-side balancing.",
        "nodePort must fall in 30000-32767 and is a third number distinct from port and targetPort; LoadBalancer needs a provider or it stays <pending>.",
        "Gateway API splits edge routing into GatewayClass (infra), Gateway (operator), and HTTPRoute (app dev) for clean role separation.",
        "An HTTPRoute attaches to a Gateway via parentRefs and forwards to Services via backendRefs — the typed successor to Ingress.",
      ],
    },
    {
      type: "quiz",
      id: "service-types-q1",
      question: "Which Service type is the default internal-only exposure?",
      options: [
        {
          id: "a",
          text: "ClusterIP",
          correct: true,
          explanation:
            "ClusterIP gives an internal virtual IP and DNS name, reachable only from inside the cluster. It is the default and the base the other types build on.",
        },
        {
          id: "b",
          text: "ExternalName",
          correct: false,
          explanation:
            "ExternalName maps a Service name to an external DNS name via a CNAME; it does not select Pods or route internally.",
        },
        {
          id: "c",
          text: "NodePort",
          correct: false,
          explanation:
            "NodePort extends ClusterIP by opening a static port on every node — it adds external reach rather than being internal-only.",
        },
      ],
    },
    {
      type: "quiz",
      id: "gateway-api-q1",
      question: "In Gateway API, which resource does an application developer typically own?",
      options: [
        {
          id: "a",
          text: "HTTPRoute",
          correct: true,
          explanation:
            "HTTPRoute holds the app-level host/path rules and attaches to a Gateway via parentRefs — the resource meant for application teams.",
        },
        {
          id: "b",
          text: "GatewayClass",
          correct: false,
          explanation:
            "GatewayClass is cluster-scoped and names the implementing controller; it is owned by the infrastructure provider, not app teams.",
        },
        {
          id: "c",
          text: "Gateway",
          correct: false,
          explanation:
            "The Gateway declares listeners (ports, protocols, TLS) and is owned by the cluster operator; app developers attach routes to it rather than defining it.",
        },
      ],
    },
  ],
  labs: [],
};

export const NETWORKING_LESSONS = compileLessons([services, dns, ingress, serviceTypesGateway]);
