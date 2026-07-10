# Problems Audit And Completion Plan

Status: PR 1-7 complete on main; catalog expansion and release hardening remain
Audit date: 2026-07-10
Scope: /problems, /problems/[levelId], the problem content contract, simulator, progress, authoring workflow, and test coverage

This file is the single source of truth for taking the Problems feature from the
audited 12-level MVP to an end-to-end complete catalog of at least 50 problems.
Findings, required changes, the target catalog, acceptance criteria, sequencing,
and effort estimates are intentionally kept together here.

## 1. Executive Verdict

The feature now has a trustworthy core platform and 13 high-confidence levels,
but it is not yet a complete 50-problem troubleshooting product.

| Area | Current state | Completion verdict |
| --- | --- | --- |
| Catalog | 13 playable levels: 4 beginner, 5 intermediate, 4 advanced | 13 of the proposed 56 total levels are authored (23%); 43 remain |
| /problems | Search, sort, saved/completed tabs, desktop filters, status, stats, locking, and activity rail work | Desktop flow is complete for the current catalog; mobile filters and pagination remain for 50+ |
| /problems/[levelId] | Multi-file workspace, read-only references, two engines, terminal, logs, events, probes, topology, evidence, hints, constraints, and validation | Core workflow is complete for current capabilities; additional resource capability packs remain |
| Existing level correctness | All 13 start broken and accept the canonical solution; every level rejects three generic bypass classes | Current catalog repair is complete |
| Kubernetes coverage | Mostly Services, probes, Deployments, DNS, and ReplicaSets | Too narrow for a representative troubleshooting curriculum |
| Quality gates | 100 unit/component/integration tests, 13 API tests, lint, typecheck, production build, and focused E2E pass | Route smoke, accessibility, and capability-pack E2E coverage must grow with the catalog |

Recommended target: 56 total levels, consisting of the current 13 plus 43 new
levels. This gives enough room for a useful difficulty curve and covers the
important real-world failure families without stopping at 50 exactly.

The recommended hybrid implementation is now in place: Webernetes handles the
resources and controllers it models well, while a deterministic scripted incident
engine handles unsupported behavior through the same ProblemEngine contract.
Extending Webernetes into a full Kubernetes implementation is not a prerequisite.

Remaining recommended effort after PR 1-7:

- 90-142 senior engineer-days to implement the remaining capability packs,
  author and verify 43 levels, scale the catalog UI, and finish release hardening.
- About 18-29 person-weeks for one engineer.
- About 10-16 elapsed weeks for two engineers once capability and content work
  run in parallel.

## 2. What Was Verified

### Baseline repository verification

| Check | Result |
| --- | --- |
| pnpm test | Pass: 18 files, 75 tests |
| pnpm test:api | Pass: 3 files, 12 tests |
| pnpm lint | Pass |
| Source TypeScript check | Pass for 158 root files |
| Normal pnpm typecheck | Blocked by a malformed generated .next/dev/types/validator.ts while an existing dev server was writing .next |
| Fresh interactive browser audit | Not available in this session because the in-app browser connector exposed no browser |
| Existing browser coverage | One E2E solves Broken Readiness Probe; two other E2Es cover Playground and Docs |

The generated .next failure is not currently a source-code diagnostic. A clean
build/typecheck must still be rerun after the active dev process is stopped or in
CI.

### PR 1-7 completion verification

| Check | Final result on 2026-07-10 |
| --- | --- |
| `pnpm test:levels` | Pass: 8 files, 36 tests across all 13 levels and both engines |
| `pnpm test` | Pass: 24 files, 100 tests |
| `pnpm test:api` | Pass: 3 files, 13 tests |
| `pnpm lint` | Pass with zero warnings |
| `pnpm typecheck` | Pass |
| `pnpm build` | Pass; 63 static pages generated, including all 13 problem routes |
| Focused production Playwright E2E | Pass: Broken Readiness Probe full solve |
| Chrome DevTools | Pass: dashboard search/filter, malformed and valid Apply feedback, multi-file read-only state, structured evidence, scripted solve/reset/post-solve, staged old/new ReplicaSets, rollback, and automatic check convergence |

The seven executable defects listed below are closed. They remain recorded as the
original regression probes that the dedicated level suite now protects.

### Executable audit probes

The following were confirmed baseline behaviors, not hypothetical review comments:

1. From namespace default, simulated "dig checkout-svc" incorrectly resolved the
   Service checkout-svc in namespace shop. Fixed in PR 2.
2. Pod CrashLoop Mystery passed all validators if the learner replaced
   klab/worker:1.0.0 with klab/web-app:1.0.0 instead of fixing DATABASE_URL.
   Fixed in PR 3/5.
3. Broken Readiness Probe passed if the readiness probe was deleted. Fixed in PR 3/5.
4. Liveness Probe Death Spiral passed if the liveness probe was deleted. Fixed in PR 3/5.
5. DNS Resolution Failure passed if the API image was replaced with
   the web image, leaving the DNS bug unfixed.
   Fixed in PR 3/5.
6. Namespace Confusion passed with the same image replacement,
   leaving the cross-namespace dependency unfixed.
   Fixed in PR 3/5.
7. Webernetes rejected an immutable ReplicaSet selector edit with HTTP 422, but
   Apply Changes did not surface that error. Fixed in PR 2.

These probes establish that red-to-green canonical solvability alone is not a
sufficient quality gate.

## 3. Baseline Inventory Before PR 1-7

### Catalog distribution

| Metric | Current value |
| --- | --- |
| Levels | 12 |
| Difficulty | 4 beginner, 4 intermediate, 4 advanced |
| Editable files | 12 total; exactly one per level |
| Read-only files | 17 authored, but not rendered as files |
| Unique simulated images | 5 |
| Validators | 36 |
| Evidence rules | 64 rules, 58 distinct evidence items |
| Post-solve docs links | 2 of 12 |

Concept concentration:

| Concept | Level count |
| --- | ---: |
| debugging | 12 |
| services | 8 |
| deployments | 4 |
| endpoints | 4 |
| networking | 4 |
| readiness-probes | 4 |
| dns | 3 |
| pods | 3 |
| events | 2 |
| labels-selectors | 2 |
| replicasets | 2 |
| rollouts | 2 |
| endpointslices | 1 |
| liveness-probes | 1 |
| namespaces | 1 |

Only 15 concepts in the 48-concept taxonomy appear in a problem. There are no
problems for StatefulSets, DaemonSets, Jobs, CronJobs, ConfigMaps, Secrets,
storage, resource management, scheduling, autoscaling, RBAC, security contexts,
NetworkPolicies, Ingress, admission, operators, or disruption budgets.

Validator concentration:

| Validator kind | Use count |
| --- | ---: |
| http-get-through-service | 13 |
| pod-ready-by-selector | 9 |
| service-has-ready-endpoints | 9 |
| deployment-ready | 2 |
| pod-restarts-below | 2 |
| no-pods-matching | 1 |
| no-recent-readiness-failures | 0 |

Evidence source concentration:

| Source | Rule count |
| --- | ---: |
| terminal | 42 |
| network | 17 |
| events | 5 |
| logs tab | 0 |
| object explorer | 0 |
| topology | 0 |
| validator | 0 |

## 4. Blocking Findings

### P0-01: Constraints are display text, not acceptance rules

Level constraints are rendered in Incident Brief, but validation only examines
cluster behavior. The submitted manifests are not checked against the stated
rules. This is the root cause of the five confirmed unintended solutions above.

Relevant code:

- src/lib/domain/types.ts: LevelConstraint only has id and label.
- src/features/problems/components/incident-brief.tsx: constraints are displayed.
- src/lib/kube/validators.ts: validators only inspect snapshots and HTTP probes.

Required fix:

- Introduce machine-readable manifest constraints.
- Run manifest checks and runtime checks as one validation report.
- Support required image, required/forbidden field, allowed edit paths, minimum
  replicas, required probe, fixed resource identity, and exact dependency-chain
  checks.
- Keep human labels as presentation generated from, or paired with, the rule.
- Add negative solution tests for every level.

### P0-02: Namespace Confusion teaches incorrect DNS behavior

src/lib/kube/command-runner.ts:319-337 looks up a Service by name across all
namespaces. It does not use TerminalContext.namespace and it does not validate
the namespace portion of a qualified DNS name.

Real Kubernetes behavior: short Service names resolve in the caller's namespace;
cross-namespace callers must use service.namespace or the full cluster DNS name.

Required fix:

- Resolve an unqualified name only in TerminalContext.namespace.
- Resolve service.namespace and service.namespace.svc.cluster.local explicitly.
- Return NXDOMAIN for a wrong namespace suffix.
- Add unit tests for same namespace, cross namespace, fully qualified, wrong
  namespace, and missing Service cases.
- Re-audit Namespace Confusion evidence and hints after the command is corrected.

### P0-03: Apply failures are invisible

src/features/problems/components/level-workspace.tsx:258 replaces a failed apply
with an empty failed validation object. It does not display the parser/API error
and does not open a useful error surface. useSimulator.error is also not rendered.

Required fix:

- Add an Apply Result surface with success, YAML syntax error, unsupported kind,
  immutable field, and API validation states.
- Preserve the exact useful error message and line number when available.
- Do not represent an apply error as an empty validator report.
- Announce the result accessibly and retain it until the next edit/apply.
- Add E2E cases for invalid YAML and an immutable-field 422.

### P0-04: The simulator contract blocks a representative 50-level catalog

src/lib/kube/manifest-parser.ts supports only Deployment, ReplicaSet, Namespace,
Node, Pod, and Service. The bundled Webernetes README also states that resources,
volumes, affinity, init containers, gRPC probes, LoadBalancer, ExternalName, and
many other behaviors are unsupported.

Required fix:

- Add a scenario engine abstraction.
- Retain a Webernetes engine for current native scenarios.
- Add a scripted engine for deterministic snapshots, events, logs, commands, and
  state transitions for unsupported incident types.
- Declare each level's required capabilities and fail content validation when an
  engine cannot provide them.
- Never present a scripted behavior as a live Kubernetes feature unless its
  contract and output match the pinned Kubernetes version.

### P0-05: Rolling Update Gone Wrong is not a rolling update

The level boots directly into a Deployment using v2.0.0. It does not first run
v1, initiate a rollout, preserve rollout history, or expose rollout status/history.
It is currently a bad-image level with a rollout story.

Required fix:

- Rebuild it as a staged scenario: healthy v1 -> rollout to v2 -> mixed/blocked
  ReplicaSets -> rollback.
- Add kubectl rollout status, history, undo, and/or a manifest rollback path.
- Bound controller churn while the broken release is NotReady.
- Validate the intended Deployment revision and stable availability, not only one
  eventual HTTP 200.

## 5. High-Priority Shared Findings

### P1-01: Multi-file problem editing is not implemented

ProblemLevel allows multiple editable files and level-store exposes setActiveFile,
but LevelWorkspace renders one YamlEditor and never calls setActiveFile. The
Playground already has a MultiFileEditor pattern that can be reused.

Required fix:

- Add editable and read-only file tabs/tree.
- Render authored readonlyFiles.
- Preserve per-file dirty state, validation markers, and diff.
- Apply files in deterministic authored order.
- Define deletion semantics for a removed YAML document.

### P1-02: Several authored fields are dead contracts

The Problems runtime does not consume:

- readonlyFiles as files
- allowedCommands
- registeredImages
- postSolveExplanation.relatedConcepts

Required fix:

- Either implement each field or remove it from the replacement ProblemLevel contract.
- Enforce allowedCommands if the product intends level-scoped commands.
- Register only declared images, or validate declarations against the image
  catalog and document that the runtime is global.
- Render related concepts and related docs after solve.

### P1-03: Evidence identity is under-specified

Probe signals contain only path and status. They omit host, port, method, namespace,
and response body. In multi-service levels, probing any root path can trigger a
rule intended for a different Service.

Logs and Events tabs display evidence without collecting it. Only terminal
commands and Network Probe actions emit signals. Object Explorer and Topology
also cannot emit evidence despite being listed as source types.

Required fix:

- Make probe evidence include URL/host, method, path, status, and optional body match.
- Make log evidence include namespace, pod selector, container, and message.
- Make object evidence include kind, namespace, name, and inspected field.
- Make event evidence collect when the Events tab is actually viewed.
- Make topology evidence collect on an explicit node/edge inspection.
- Add an automated reachability test for every evidence item and hint gate.

### P1-04: Quick command pod resolution is not scenario-aware

The placeholder resolver chooses the first NotReady workload pod, otherwise the
first workload pod across all namespaces. It can choose the wrong tier or choose
a shop pod while emitting a command without "-n shop".

Required fix:

- Replace the generic "<pod>" token with a typed target such as a namespace and
  label selector, or author the command as a function/spec.
- Include the namespace when required.
- Disable a command with an explanatory tooltip until its target exists.
- Test every quick command against each broken state.

### P1-05: Simulator readiness is announced before initial apply completes

src/features/problems/hooks/use-simulator.ts sets status to ready before
applyInitial resolves. The UI can accept commands while the incident state is
still empty or partial.

Required fix:

- Use separate control-plane-ready and scenario-ready states.
- Enable workspace actions only after the initial state is applied.
- Surface an initial apply failure as a fatal scenario error.

### P1-06: Progress hint penalties are not idempotent for guests

The server stores one hint reveal per user/level/hint, but local Progress stores
only an aggregate penalty. Reloading a level lets a guest reveal the same hint
again and increment the penalty again. The UI's session-only revealedHintIds can
also disagree with persisted XP calculations.

Required fix:

- Persist revealed hint IDs locally.
- Make local revealHint idempotent by level and hint ID.
- Hydrate revealed state into the workspace.
- Lock hint penalties after a level is solved or define replay semantics.

### P1-07: Public stats trust client-supplied outcomes

The progress API accepts solved XP, solved day, submission pass/fail, duration,
and checks from the client. The server does not derive XP from the catalog and
the UI does not send a clientMutationId for submissions. Public success rates can
therefore be inflated or duplicated.

Required fix:

- Look up level XP and known hint penalties on the server.
- Reject unknown slugs, hints, and invalid dates/ranges.
- Always send a stable clientMutationId and deduplicate submissions.
- Label low-sample authored values as estimates.
- Treat client validation as untrusted telemetry unless server verification is
  introduced.

### P1-08: The content schema validates shape, not quality

Missing checks include:

- unique level, file, validator, hint, evidence-rule, and constraint IDs
- valid regular expressions
- unique or deliberately aliased evidence IDs
- valid internal docs links
- registered image existence
- every editable file present in the canonical solution
- no extra solution keys or stale levels
- resource identity collisions
- every quick/allowed command parsable
- every evidence rule reachable
- every hint gate reachable
- bounded broken-state materialization

Required fix: replace the current ProblemLevel contract with a semantic validator and
a catalog audit test. This application is pre-production, so the replacement is
atomic: no compatibility aliases, migration layer, or legacy schema remain.

### P1-09: The contributor workflow names the wrong test command

CONTRIBUTING.md and both problem-generation scripts say pnpm test:api runs the
level solvability harness. It only runs DB/API tests. The level harness is in
the main pnpm test suite.

Required fix:

- Add a dedicated test:levels command.
- Update CONTRIBUTING.md, new-problem.mjs, and generate-problems.mjs.
- Make new:problem register the level and a solution stub safely, or print an
  exact verified checklist.
- Ensure a scaffolded level passes the semantic content checks after registration.

### P1-10: Browser coverage is one level deep

Only Broken Readiness Probe is solved through the browser. The catalog gate,
multi-namespace flow, crash/restart flow, intermittent failure flow, advanced
locking, invalid apply, all quick commands, and all level routes lack E2E coverage.

Required fix:

- Add a cheap route/boot smoke for every level.
- Add one full solve E2E per capability pack.
- Add catalog filter, save, lock, daily challenge, mobile filter, invalid apply,
  reset, and progress persistence E2Es.

### P1-11: Checks can freeze on an intermediate reconciliation state

Chrome DevTools exposed this after the staged rollback: the cluster reached two
Ready pods and two Service endpoints, but the status card retained a validation
captured while only one pod was Ready. Two fixed delayed refreshes are not a
reliable synchronization contract.

Resolution: closed. The workspace now debounces validation from actual engine
snapshot updates, while retaining delayed fallbacks for engines that settle
without another snapshot. A browser rollback was observed converging from 1/2 to
5/5 without pressing Refresh.

### Finding resolution ledger

| Finding | Result after PR 1-7 |
| --- | --- |
| P0-01 constraints | Closed by typed edit/manifest constraints, merged reports, and catalog-wide bypass tests |
| P0-02 DNS | Closed by caller-namespace, qualified-name, FQDN, wrong-namespace, and NXDOMAIN behavior |
| P0-03 Apply feedback | Closed by persistent accessible success/error results with exact parser/API messages |
| P0-04 engine ceiling | Core blocker closed by ProblemEngine and the scripted reference; additional capability packs remain catalog work |
| P0-05 rolling update | Closed by ordered healthy-v1 then broken-v2 boot, old/new ReplicaSets, bounded state, and rollback tests |
| P1-01 multi-file | Closed by editable/read-only/hidden file access and tabbed Monaco state |
| P1-02 dead fields | Closed by the atomic contract replacement; unsupported legacy fields were removed and related concepts render |
| P1-03 evidence identity | Closed for the current catalog with structured, source-aware signals and reachability checks |
| P1-04 quick targets | Closed by typed namespace/selector/preference resolution |
| P1-05 readiness race | Closed by scenario-ready boot sequencing and fatal boot errors |
| P1-06 hint idempotency | Closed by per-level/per-hint fact maps locally and on the server |
| P1-07 progress trust | Closed at the supported trust boundary: XP and penalties are catalog-derived, unknown facts are rejected, submission IDs are required, and browser-validated aggregates are labeled as client telemetry |
| P1-08 semantic quality | Closed for the current catalog by the dedicated semantic audit and integration matrix |
| P1-09 contributor command | Closed by `test:levels` and corrected authoring scripts/docs |
| P1-10 browser depth | Partially closed: production full-solve E2E plus DevTools coverage for both engines and the dashboard pass; all-route, mobile, accessibility, and future capability-pack coverage remain before 50+ |
| P1-11 stale checks | Closed by snapshot-driven debounced validation |

## 6. /problems Dashboard Audit

### What is built correctly

- Static typed catalog projection.
- Optional DB aggregate overlays with a minimum sample threshold.
- Search across title, blurb, and concepts.
- Difficulty, status, and topic filters.
- Saved and Completed tabs.
- Sort by XP, time, success, and title.
- Solved/in-progress/locked state.
- Advanced deep-link gate.
- Daily challenge, Continue Learning, recommendations, and progress summary.
- Accessible table headings and save button labels.

### What remains

| Finding | Priority | Required outcome |
| --- | --- | --- |
| Filters are hidden below xl with no mobile replacement | P1 | Add a mobile/tablet filter sheet with active-filter count |
| Activity rail is hidden below 2xl | P2 | Reflow Daily Challenge and progress into main content |
| No pagination or incremental loading | P1 before 50 | Add URL-backed pagination; recommended default 20/page |
| No Study Plan or Incident Inspired views | P1 | Add source and learning-path metadata plus views |
| No learning-path filter/progress | P2 | Add beginner foundations, CKA, app developer, and SRE/on-call paths |
| Daily challenge "Completed today" means solved at any time | P1 | Persist per-day challenge completion or change the label |
| Saved count can include stale removed slugs | P2 | Project progress through the current catalog |
| No source/incident attribution | P1 | Add incident-inspired badge and source link on detail/post-solve |
| Flat unlock rule: every advanced level after two solves | P2 | Add per-level prerequisites or path-based gates |
| No URL-backed filter/search state | P2 | Make filtered views shareable and back-button safe |

Closed during this implementation:

- Daily Challenge selects an unlocked unsolved/in-progress problem before replay.
- Authored success rates and times display as estimates; aggregate overrides display
  as client-validated telemetry with sample size.
- Aggregate DB failures fall back to the static authored catalog without breaking
  the route.

Dashboard definition of done:

- Handles 56 levels without an unbounded page.
- All filters and views work at 360px, 768px, 1280px, and wide desktop.
- Search/filter/sort/page state is represented in the URL.
- Locked, saved, attempted, solved, and stale-progress states are deterministic.
- Daily Challenge never sends a user to an inaccessible level.
- Every incident-inspired level links to its source without implying an exact
  reproduction when the scenario is adapted.

## 7. /problems/[levelId] Workspace Audit

| Component | Status | Required work |
| --- | --- | --- |
| Route generation and 404 | Pass | Add catalog-wide route smoke |
| Client advanced gate | Pass with limits | Move to prerequisite-aware policy |
| Incident Brief | Pass for current contract | Add source, learning objectives, and prerequisites with the catalog metadata phase |
| Editable file editor | Pass | Extend only if folder-scale authoring requires a tree |
| Read-only files | Pass | No current blocker |
| Apply | Pass | Add capability-specific API errors as new engines are introduced |
| Reset | Pass with persistent investigation history | Add replay policy/browser coverage before 50+ |
| Diff | Partial | Per-file and aggregate diff; handle added/deleted docs |
| Terminal | Pass for current capabilities | Add exec, logs --previous, rollout, selectors, and JSONPath only with levels that require them |
| allowedCommands | Removed | Replaced by typed quick commands and engine command contracts |
| Quick commands | Pass | Add target types alongside future resources |
| Logs tab | Pass for current catalog | Add container disambiguation when multi-container levels arrive |
| Events tab | Pass for current catalog | Add cross-namespace filtering with future capability packs |
| Network Probe | Pass for current catalog | Add repeated sampling where intermittent failures require it |
| Cluster Explorer | Pass for both current engines | Add resource adapters with each capability pack |
| Object Details | Partial | Capability-based fields, conditions, owners, events, and safe Secret redaction |
| Topology | Pass for current graphs | Add graph types and focus mode with future capabilities |
| Evidence Board | Pass for current catalog | Add timestamps/replay only if investigation history becomes a product requirement |
| Hints | Pass | Author and audit new gates with every added level |
| Failing Checks | Pass | Manifest constraints and runtime checks share one accurate denominator/report |
| Validation dialog | Pass for current contract | Add source/docs/prevention/next-problem metadata in the catalog phase |
| Progress/XP | Pass at browser-validation trust boundary | Server derives catalog values; future server-side solve verification would raise trust further |
| Responsive layout | Desktop-only | Replace min-width-only behavior with stacked/segmented narrow layouts |

Workspace definition of done for every level:

1. Broken state applies fully before "scenario ready".
2. Broken state reaches a documented, bounded, stable failure state.
3. Every advertised command executes and returns technically correct output.
4. Every evidence item is reachable through its displayed source.
5. Every hint gate can be unlocked without already knowing the solution.
6. Canonical solution passes.
7. At least three likely bypass mutations fail validation.
8. Every stated constraint is machine-enforced.
9. Invalid YAML and invalid Kubernetes edits show actionable errors.
10. Apply, reset, refresh, route navigation, and replay are deterministic.
11. Post-solve content explains root cause, mechanism, fix, prevention, source,
    and related learning.
12. A browser smoke proves the route boots; a capability-pack E2E proves the full
    workflow.

## 8. Baseline Audit Of The Original 12 Levels

Disposition meanings:

- Keep: technically sound after shared platform fixes and small content polish.
- Repair: retain the scenario, but fix validators/evidence/commands.
- Rebuild: the current implementation does not model the title's core behavior.

| # | Level | Audit | Disposition | Level-specific effort |
| ---: | --- | --- | --- | ---: |
| 1 | Service Selector Mismatch | Accurate and diagnostically coherent. Add manifest identity/constraint checks and docs link. | Keep | 0.5-1 day |
| 2 | Port Routing Bug | Behavior is correct. Teach Service port -> targetPort -> process listener; containerPort is declarative metadata, not a third forwarding hop. | Keep | 0.5-1 day |
| 3 | Broken Readiness Probe | Strong reference flow and existing E2E, but deleting readinessProbe passes. Add required-probe constraint and /readyz preset. | Repair | 1-1.5 days |
| 4 | Namespace Confusion | Short-name dig is wrong, generic quick pod can target the shop pod without namespace, events show only default, and image replacement bypasses the dependency. | Repair | 2-3 days |
| 5 | Service Has No Endpoints | Correct but very easy for Intermediate and overlaps earlier endpoint lessons. Reclassify or add a less obvious scale/source-of-truth clue. | Keep | 0.5-1 day |
| 6 | Pod CrashLoop Mystery | Changing the image passes despite "keep image". Logs do not teach --previous. Add image constraint and previous-container logs. | Repair | 1-2 days |
| 7 | Rolling Update Gone Wrong | No rollout is staged and no rollout history exists. The story and implementation diverge. | Rebuild | 2-4 days |
| 8 | DNS Resolution Failure | Core typo scenario is valid, but replacing the API image passes without fixing DNS. Add image/dependency/body constraints. | Repair | 1-1.5 days |
| 9 | Liveness Probe Death Spiral | Failure is valid, but deleting livenessProbe passes. Add required liveness constraint and stable no-restart window. | Repair | 1-2 days |
| 10 | Config Drift | Technically a PORT env mismatch, not ConfigMap drift. Rename to Port Configuration Drift or rebuild after ConfigMap support. | Keep/rename | 0.5-1 day |
| 11 | Broken Service Chain | Useful investigation pattern but repeats Port Routing Bug. Probe evidence is host-ambiguous and generic logs can pick the wrong tier. Add host/body-aware checks and tier-specific commands. | Repair | 1-2 days |
| 12 | Zombie ReplicaSet | Strong, distinctive scenario. Add exact ReplicaSet retirement constraint and repeated HTTP sampling for the one-in-three symptom. | Keep | 0.5-1 day |

Estimated repair cost for the current 12 after shared platform primitives exist:
12-20 engineer-days, including tests and content review.

Implementation result: all 12 repairs/rebuilds are complete. The dedicated suite
boots each broken state, applies each canonical solution, and rejects three generic
bypass mutations per level. Private Registry Pull Secret was then added as the 13th
level and runs through the same contract.

## 9. Target Catalog: 56 Problems

Engine/capability codes:

- BASE: current Webernetes resources plus fixed workspace/validators
- SCRIPTED: deterministic incident snapshots and transitions behind ProblemEngine
- IMG: additional deterministic simulated images and container behavior
- LIFE: startup, multi-container, termination, and lifecycle behavior
- WORK: DaemonSet, Job, and CronJob scripted/native adapters
- CFG: ConfigMap, Secret, Kustomize/GitOps adapters
- NET: headless Service, NetworkPolicy, Ingress, traffic-policy adapters
- SCHED: resources, placement, taints, priority, autoscaling, disruption adapters
- STORE: PV, PVC, StorageClass, zone, and attachment adapters
- AUTH: ServiceAccount, RBAC, security, admission, API-version adapters
- CNI: node labels, networking components, and IP allocation adapters

Source "incident" means the problem is adapted from a public failure story in
the source register below. It must be labeled "inspired by", not presented as an
exact reproduction.

| # | Problem | Difficulty | Primary lesson | Capability | Status/source |
| ---: | --- | --- | --- | --- | --- |
| 1 | Service Selector Mismatch | Beginner | Service selector vs Pod labels | BASE | Current; keep |
| 2 | Port Routing Bug | Beginner | targetPort vs process listener | BASE | Current; keep |
| 3 | Broken Readiness Probe | Beginner | Running is not Ready | BASE | Current; repair |
| 4 | Namespace Confusion | Beginner | Namespace-scoped DNS | BASE | Current; repair |
| 5 | Service Has No Endpoints | Intermediate | Desired replicas and endpoints | BASE | Current; keep |
| 6 | Pod CrashLoop Mystery | Intermediate | CrashLoop logs and required env | BASE, IMG | Current; repair |
| 7 | Rolling Update Gone Wrong | Intermediate | Real rollout diagnosis and rollback | BASE, IMG | Current; rebuild |
| 8 | DNS Resolution Failure | Intermediate | NXDOMAIN from a typo | BASE | Current; repair |
| 9 | Liveness Probe Death Spiral | Advanced | Liveness-induced restarts | BASE, LIFE | Current; repair |
| 10 | Port Configuration Drift | Advanced | Runtime env vs probes/Service | BASE | Current; rename |
| 11 | Broken Service Chain | Advanced | Trace a multi-hop dependency | BASE | Current; repair |
| 12 | Zombie ReplicaSet | Advanced | Labels select orphaned workloads | BASE | Current; keep |
| 13 | Private Registry Pull Secret | Intermediate | Pull events and imagePullSecrets | SCRIPTED, IMG | Current; added in PR 7 |
| 14 | Command Override Crash | Beginner | command/args override the image entrypoint | BASE, IMG | New |
| 15 | Slow Start Without startupProbe | Intermediate | Startup vs liveness/readiness | LIFE, IMG | New |
| 16 | Probe Hits The Wrong Port | Intermediate | Management port vs traffic port | BASE, IMG | New |
| 17 | Healthy App, Broken Sidecar | Advanced | Multi-container readiness and logs | LIFE, IMG | New |
| 18 | Graceful Shutdown 502s | Advanced | preStop and termination grace | LIFE, NET | New; incident Ravelin |
| 19 | Rollout Cannot Fit maxSurge | Advanced | Capacity-aware rolling updates | SCHED | New |
| 20 | Recreate Strategy Outage | Intermediate | Deployment strategy availability | BASE, LIFE | New |
| 21 | Immutable Deployment Selector | Intermediate | API validation and safe migration | BASE | New |
| 22 | DaemonSet Missing A Toleration | Intermediate | DaemonSet placement on tainted nodes | WORK, SCHED | New |
| 23 | Job Restart Storm | Advanced | Job backoff vs Pod restartPolicy | WORK, SCHED | New; incident Universe |
| 24 | Overlapping CronJobs | Intermediate | concurrencyPolicy and deadlines | WORK | New |
| 25 | ConfigMap Key Typo | Beginner | configMapKeyRef and events | CFG | New |
| 26 | ConfigMap Changed, Pods Did Not | Beginner | Config rollout semantics | CFG | New |
| 27 | Secret Key Mismatch | Beginner | Secret references and safe debugging | CFG | New |
| 28 | Secret File Permission Failure | Intermediate | defaultMode, UID, and fsGroup | CFG, AUTH | New |
| 29 | GitOps Template Deletes Namespaces | Advanced | Reconciliation blast radius and prune | CFG | New; incident Skyscanner |
| 30 | Named targetPort Mismatch | Beginner | Named Service ports | BASE | New |
| 31 | Service Selector Is Too Broad | Intermediate | Healthy but incorrect backend selected | BASE, IMG | New |
| 32 | Headless Service Breaks Stateful DNS | Advanced | Headless Service and stable identities | NET, STORE | New |
| 33 | Default-Deny NetworkPolicy | Intermediate | Ingress policy isolation | NET | New |
| 34 | NetworkPolicy Blocks DNS | Intermediate | Egress rules must allow DNS | NET | New |
| 35 | Ingress Rewrite Sends The Wrong Path | Intermediate | Host/path/backend routing | NET | New |
| 36 | externalTrafficPolicy Local Blackhole | Advanced | Node-local endpoints and external traffic | NET | New |
| 37 | CoreDNS OOM And ndots Retry Storm | Advanced | DNS amplification and limits | NET, SCHED | New; incident Zalando |
| 38 | CPU Throttling With Low Average CPU | Advanced | CFS quota and latency | SCHED | New; incident Buffer |
| 39 | Memory Limit OOMKilled | Intermediate | Limits, exit 137, and last state | SCHED, IMG | New |
| 40 | Missing Limits Cause Node SystemOOM | Advanced | Noisy neighbor and all namespaces | SCHED | New; incident Blue Matador |
| 41 | Pod Pending: Insufficient CPU | Beginner | Requests drive scheduling | SCHED | New |
| 42 | Stale Node Label After Upgrade | Advanced | node selectors and component placement | SCHED, CNI | New; incident Reddit |
| 43 | Taint Without Toleration | Beginner | Taints, events, and Pending | SCHED | New |
| 44 | All Replicas On One Failing Node | Intermediate | Anti-affinity and failure domains | SCHED | New; incident Moonlight |
| 45 | PriorityClass Preemption Cascade | Advanced | Priority and cascading eviction | SCHED | New; incident Grafana |
| 46 | PVC Pending: Wrong StorageClass | Beginner | PVC binding and StorageClass | STORE | New |
| 47 | ReadWriteOnce Multi-Attach | Intermediate | Attachment lifecycle after reschedule | STORE | New |
| 48 | Volume And Pod In Different Zones | Advanced | PV node affinity and topology | STORE, SCHED | New |
| 49 | StatefulSet Orphaned PVC | Advanced | Retention, reuse, and data identity | STORE | New |
| 50 | Wrong ServiceAccount, RBAC Forbidden | Beginner | Identity, Role, and RoleBinding | AUTH | New |
| 51 | runAsNonRoot Permission Failure | Intermediate | SecurityContext and image UID | AUTH, IMG | New |
| 52 | Admission Webhook Blocks The API | Advanced | failurePolicy and webhook reachability | AUTH, NET | New; incident Reddit/Jetstack class |
| 53 | Removed API Version After Upgrade | Advanced | Version skew and manifest migration | AUTH | New |
| 54 | Pod CIDR/IP Range Exhausted | Advanced | CNI allocation and autoscaler symptoms | CNI, SCHED | New; incident GKE IP exhaustion |
| 55 | HPA Cannot Compute Replicas | Intermediate | Missing requests/metrics and HPA conditions | SCHED | New |
| 56 | PodDisruptionBudget Blocks Drain | Intermediate | Voluntary disruptions and impossible budgets | SCHED | New |

Catalog balance after implementation:

- 56 total levels.
- 13 beginner, 22 intermediate, 21 advanced.
- 11 explicitly incident-inspired levels.
- Coverage across application, workload, configuration, network, DNS, scheduling,
  resources, storage, security, admission, upgrades, and cluster networking.

Before authoring begins, review the difficulty distribution with target users.
The proposed mix deliberately weights the catalog toward intermediate and tricky
advanced incidents while retaining a 14-level beginner path.

## 10. Replacement ProblemLevel Requirements

The content contract must support:

### Identity and curriculum

- stable slug and content version
- difficulty, severity, estimated time, and XP
- learning objectives
- concepts
- prerequisites and learning paths
- engine and required capabilities
- incident source, adaptation note, and Kubernetes version range
- draft/review/published status

### Files and state

- ordered editable and read-only files
- resource identities per file/document
- staged initial state and optional timed/action-triggered transitions
- declared simulated images or scripted processes
- reset policy

### Typed constraints

- allowed editable JSON/YAML paths
- required and forbidden values/fields
- required resource identity and kind
- minimum/maximum replica count
- required image/probe/dependency
- resources that must remain present/absent
- optional custom constraint adapter

### Validators

- manifest validators
- snapshot/resource validators
- event and condition validators
- log validators
- DNS validators
- sampled HTTP validators with host, method, path, status, body, sample count,
  acceptable error budget, and stability window
- temporal validators such as no restarts for N seconds
- exact workload/controller validators

### Investigation

- typed quick commands with target selectors and namespaces
- allowed command capabilities
- typed probe presets
- evidence rules tied to command, logs, events, probe, object, topology, diff, or
  validator sources
- hint gates referencing reachable evidence IDs

### Post-solve

- root cause
- mechanism
- fix
- prevention/follow-up
- related concepts
- related docs
- incident source and adaptation disclosure
- recommended next problem

## 11. Engine And UI Architecture

### Recommended hybrid engine

Define one ProblemEngine interface used by the workspace:

1. WebernetesEngine
   - Current Pod, Service, Deployment, ReplicaSet, Namespace, and Node behavior.
   - Real reconciliation where supported.

2. ScriptedIncidentEngine
   - Deterministic typed resources, conditions, events, logs, DNS, HTTP, command
     results, and state transitions.
   - Used for resources Webernetes does not model.
   - Must use the same snapshot, apply, reset, probe, exec, and validation contract.

3. Optional future RemoteClusterEngine
   - Real ephemeral cluster backend for advanced or enterprise labs.
   - Not required for the 56-level target.

Rules:

- A level declares its engine; no silent fallback.
- Scripted output is fixture-tested against the pinned Kubernetes documentation.
- Engine capability mismatches fail at build/test time.
- Each scenario is deterministic under a seeded clock/random source.
- Broken states have explicit materialization predicates and timeouts.

### Workspace changes

- Reuse/adapt Playground's multi-file editor.
- Add a file navigator with editable/read-only state.
- Add Apply Result and scenario fatal-error surfaces.
- Make commands and evidence structured, not regexes over unscoped text alone.
- Add repeated probe/sampling controls for intermittent failures.
- Add namespace-aware resource selection in Logs and Events.
- Make Explorer, Details, and Topology adapter-driven by resource kind.
- Add stacked responsive modes for narrow viewports.

### Dashboard changes

- Add pagination and URL-backed query state.
- Add Incident Inspired and Study Plan views.
- Add mobile filter sheet and activity sections.
- Add source, path, prerequisite, and version metadata to LevelSummary.
- Replace the global two-solve gate with prerequisite-aware gates.

## 12. Test And Authoring Requirements

### Required commands

Create these explicit scripts:

- test:unit
- test:levels
- test:api
- test:e2e:smoke
- test:e2e:problems
- audit:problems

### Static catalog audit

audit:problems must fail on:

- fewer than 50 published levels
- duplicate IDs/slugs/paths
- invalid regexes or URLs
- missing/extra canonical solution files
- missing image/capability adapters
- unknown docs/source links
- unparseable quick commands
- unreachable evidence or hint gates
- unsupported resources for the declared engine
- invalid prerequisites or circular learning paths
- unbalanced catalog below agreed minimums

### Per-level integration contract

Every level test must:

1. Boot/reset its declared engine.
2. Apply the exact broken state.
3. Wait for its broken-state predicate.
4. Assert the broken state fails the expected validators.
5. Assert resource/pod count stays bounded.
6. Execute every quick command and collect expected evidence.
7. Exercise every evidence source and unlock every hint.
8. Apply the canonical solution and wait for stability.
9. Assert every validator and constraint passes.
10. Apply at least three authored bypass mutations and assert each fails.

### Browser contract

- Route/boot smoke for all 56 levels, sharded in CI.
- Full solve per capability pack, not necessarily 56 duplicated UI scripts.
- Catalog test with 56 fixtures and pagination.
- Mobile dashboard and narrow workspace test.
- Invalid YAML, immutable edit, reset, save, hint persistence, locking, and replay.
- Axe/accessibility scan for dashboard, workspace, dialogs, filters, and tables.
- Screenshot checks for desktop and mobile layouts.

## Execution Tracker: PR 1-7

The seven scopes below are implemented directly on main, but each retains its own
tests and completion gate. Status is updated here as work progresses.

| Scope | Deliverable | Completion gate | Status |
| --- | --- | --- | --- |
| PR 1 | Dedicated level test command, semantic catalog audit, and regression tests for every confirmed bypass | Tests fail against each old defect and pass only after its owning fix | Complete |
| PR 2 | Namespace-correct DNS, scenario-ready lifecycle, and visible Apply results/errors | DNS matrix, boot race, YAML error, and immutable-field tests pass; DevTools shows actionable UI | Complete |
| PR 3 | Atomic replacement ProblemLevel contract, typed constraints, manifest/runtime validation, and idempotent hint progress | All 12 levels compile on the replacement contract; known image/probe bypasses fail | Complete |
| PR 4 | Multi-file/read-only workspace, typed quick-command targets, and structured evidence from Terminal, Logs, Events, Network, Explorer, and Topology | Every authored file is reachable and every evidence/hint gate has a reachability test | Complete |
| PR 5 | Repair and migrate the 11 retained current levels | Canonical fix passes, three bypasses fail, commands/evidence work, docs/source links resolve | Complete |
| PR 6 | Rebuild Rolling Update Gone Wrong as a staged healthy-v1 to broken-v2 rollout with rollback | Real old/new ReplicaSet state, rollout investigation, bounded failure, and rollback E2E pass | Complete |
| PR 7 | ProblemEngine interface plus a deterministic ScriptedIncidentEngine reference scenario | Workspace runs both engines through one contract; reset/apply/probe/validate behavior is deterministic | Complete |

Implementation rules:

1. Preserve unrelated docs work already present in the worktree.
2. Replace the current problem model in place; do not create a parallel v2 API.
3. Keep every scope green before starting changes owned by the next scope.
4. Use Chrome DevTools after PR 2 and for every subsequent user-facing scope.
5. Update this table immediately when a scope reaches its completion gate.
6. Do not bulk-author the remaining catalog until PR 7 is complete.

### PR 1-7 delivered state

- The old problem model was replaced in place; there is no v2 or compatibility layer.
- Namespace-aware DNS, scenario-ready booting, visible Apply errors, and automatic
  post-reconciliation check refreshes close the shared correctness failures.
- Every level uses machine-readable edit and manifest constraints. The catalog
  suite proves canonical success plus rename, extra-resource, and protected-field
  bypass rejection for every level.
- All authored files render as editable, read-only, or hidden inputs. Apply sends
  only editable files, and the store rejects writes to protected files.
- Quick commands resolve typed targets. Evidence is structured and source-aware
  across terminal, logs, events, network, explorer, topology, and validators.
- Rolling Update Gone Wrong now boots healthy v1, rolls to broken v2 with both
  ReplicaSets visible, and converges after a rollback to the known-good image.
- `ProblemEngine` supports Webernetes and deterministic scripted incidents through
  one boot/reset/apply/probe/validate/command contract. Private Registry Pull Secret
  is the scripted reference level and is included in all catalog gates.
- Hint progress is stored as per-level, per-hint facts, making repeated local/server
  merges idempotent.
- The server derives XP and hint penalties from the catalog, rejects unknown facts,
  and deduplicates required submission IDs. Browser-validated aggregate telemetry
  is visibly labeled instead of being presented as server-verified truth.

Current implementation count: 13 published levels. Remaining to the approved
56-level target: 43 levels.

## 13. Implementation Plan And Estimate

Assumptions:

- Senior TypeScript/React engineer with Kubernetes experience.
- Existing visual language is retained.
- Hybrid engine is accepted.
- Estimates include implementation, focused tests, review fixes, and content QA.
- Estimates exclude a real remote-cluster service and enterprise operations.

| Phase | Deliverable | Remaining estimate |
| --- | --- | ---: |
| 0 | Fix P0 correctness: DNS, apply errors, constraints, and rolling scenario | Complete |
| 1 | Replacement contract, semantic audit, multi-file UI, and engine interface | Complete |
| 2 | Remaining hybrid capability packs needed by the target catalog | 20-35 days |
| 3 | Repair/rebuild the original 12 levels and add one scripted reference | Complete |
| 4 | Author and verify 43 new levels | 48-72 days |
| 5 | Dashboard pagination, mobile filters, paths, sources, prerequisite gates | 7-10 days |
| 6 | Catalog-wide E2E, accessibility, performance, docs, and release hardening | 15-25 days |
|  | Remaining total before overlap | 90-142 days |
|  | Expected remaining total with phases 2-5 parallelized | 75-122 engineer-days |

Recommended delivery slices:

### Milestone A: Trustworthy current catalog

- P0 findings fixed.
- Current 12 constraints enforced.
- Namespace DNS correct.
- Apply errors visible.
- Rolling Update rebuilt.
- All current quick commands/evidence audited.
- Dedicated test:levels command.

Exit target: 12 high-confidence levels.
Status: Complete; the catalog now contains 13 high-confidence levels.

### Milestone B: Authoring platform

- Replacement ProblemLevel contract with no legacy compatibility layer.
- Multi-file/read-only workspace.
- Hybrid engine interface.
- Semantic catalog audit.
- Capability-driven commands, evidence, validators, explorer, and topology.

Exit target: a new capability pack can be added without changing the core workspace.
Status: Complete; the scripted reference scenario proves the extension contract.

### Milestone C: 30-level beta

- Add BASE, IMG, LIFE, CFG, and first NET/SCHED levels.
- Dashboard pagination/mobile filters/source metadata.
- Full E2E per implemented capability pack.

Exit target: broad application troubleshooting beta.
Remaining estimate after B: 33-52 engineer-days.

### Milestone D: 56-level complete release

- Add WORK, remaining NET/SCHED, STORE, AUTH, and CNI levels.
- Study Plans, prerequisites, incident-inspired view.
- Catalog-wide smoke, accessibility, performance, and content review.

Exit target: every acceptance criterion in this document passes.
Estimate after C: 45-70 engineer-days.

## 14. Priority Backlog

### Completed foundation before adding many levels

1. [x] Machine-readable constraints and negative solution tests.
2. [x] Namespace-correct DNS.
3. [x] Visible Apply errors.
4. [x] Multi-file/read-only editor.
5. [x] ProblemEngine abstraction and capability declarations.
6. [x] Structured host/namespace-aware evidence.
7. [x] Scenario-ready state after initial apply.
8. [x] Dedicated `test:levels` and corrected contributor docs.
9. [x] Repair the original 12 and add a scripted reference level.

### Must complete before publishing 50+

1. [ ] Author and pass the semantic catalog audit with at least 50 levels.
2. [ ] Add dashboard pagination and verify mobile filters at catalog scale.
3. [ ] Add incident source and learning-path metadata.
4. [x] Make hint penalties idempotent and derive XP from the trusted catalog.
5. [ ] Test all advertised commands/evidence as each capability pack is added.
6. [ ] Add route smoke for every level and full E2E per capability pack.
7. [ ] Pin the Kubernetes version and complete source review.
8. [ ] Complete accessibility and narrow-layout verification.

### Can follow the 56-level release

- Remote real-cluster engine.
- Multiplayer/team incident mode.
- Leaderboards, only after server-verifiable completion exists.
- Community level marketplace.
- Adaptive recommendations based on concept mastery.
- Full replay timeline and incident analytics.

## 15. Decisions To Lock

Recommended defaults are shown so these do not block implementation:

| Decision | Recommended default |
| --- | --- |
| Target size | 56 published levels |
| Engine | Hybrid Webernetes plus scripted incident engine |
| Kubernetes version | Pin one minor at implementation start; record version range per level |
| Mobile | Full dashboard support; stacked/segmented solving workspace |
| Incident attribution | "Inspired by" with direct primary source |
| Progress trust | Catalog-derived XP; telemetry labeled client-validated |
| Advanced locking | Per-level prerequisites and paths, not a global solved count |
| Content release | Draft -> technical review -> solvability -> investigation QA -> browser smoke -> published |

## 16. Source Register

### Primary Kubernetes references

- [Troubleshooting Applications](https://kubernetes.io/docs/tasks/debug/debug-application/)
- [Debug Pods](https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/)
- [Debug Services](https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/)
- [Service and DNS behavior](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Resource management](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
- [Scheduling, preemption, and eviction](https://kubernetes.io/docs/concepts/scheduling-eviction/)
- [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)

### Failure-story index requested for this audit

- [Kubernetes Failure Stories](https://k8s.af/)

### Primary incident sources selected for the target catalog

- [Reddit Pi-Day outage: upgrade and stale control-plane label](https://www.reddit.com/r/RedditEng/comments/11xx5o0/you_broke_reddit_the_piday_outage/)
- [Skyscanner: templating error and GitOps namespace deletion](https://medium.com/@SkyscannerEng/how-a-couple-of-characters-brought-down-our-site-356ccaf1fbc3)
- [Buffer: CPU limits and latency](https://erickhun.com/posts/kubernetes-faster-services-no-cpu-limits/)
- [GKE pod IP range exhaustion](https://deploy.live/blog/when-gke-ran-out-of-ip-addresses/)
- [Blue Matador: node SystemOOM and missing resource limits](https://www.bluematador.com/blog/post-mortem-kubernetes-node-oom)
- [Ravelin: terminating endpoints and intermittent Ingress 502s](https://philpearl.github.io/post/k8s_ingress/)
- [Grafana: PodPriority preemption cascade](https://grafana.com/blog/how-a-production-outage-was-caused-using-kubernetes-pod-priorities/)
- [Moonlight: replicas concentrated on one failing node](https://updates.moonlightwork.com/outage-post-mortem-87370)
- [Zalando: CoreDNS OOM and ndots amplification](https://github.com/zalando-incubator/kubernetes-on-aws/blob/dev/docs/postmortems/jan-2019-dns-outage.md)
- [Universe: resource-consuming Job restart storm](https://status.universe.com/incidents/115n3vxqwzcf)

## 17. Final Completion Gate

Current result: **not met**. PR 1-7 close the shared platform and current-level
correctness work, but the catalog is 13/56. The remaining release scope is 43
levels, their required capability packs, catalog-scale dashboard behavior,
source/path/version metadata, full route and capability browser coverage,
accessibility, responsive verification, and final content review.

The Problems feature is end-to-end complete only when all of the following are true:

- At least 50 published levels exist; the approved target is 56.
- Every current P0 and P1 finding is closed or explicitly waived with rationale.
- Every level satisfies the per-level integration contract.
- Every stated constraint is machine-enforced.
- Every evidence item and hint gate is reachable.
- No level can be solved by the three authored bypass mutations.
- Dashboard discovery remains usable and responsive with the full catalog.
- Every route boots in browser CI; every capability pack has a full solve E2E.
- Apply and reset failures are visible and actionable.
- Progress, hint penalties, XP, and submissions are idempotent.
- Incident-inspired content has primary-source attribution and an adaptation note.
- The catalog is reviewed against the pinned Kubernetes minor version.
- Lint, source typecheck, unit/component/integration tests, API tests, production
  build, E2E, accessibility, and problem audit all pass from a clean checkout.

Until this gate passes, the feature should be described as a high-confidence
starter catalog rather than a complete Kubernetes incident lab library.
