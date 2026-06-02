# Automatic Agent Platform — Module Framework Diagram Collection

> **Version**: v1.5
> **Date**: 2026-05-26
> **Companion documents**: `00-platform-architecture.md` v2.7 · `01-code-structure.md` · `02-code-architecture-reference.md`
> **Description**: This document uses ASCII framework diagrams to present the system overview and the internal structure and interaction relationships of each layer/module; v1.5 has synchronized the latest interface layer, federation governance, Mission/UI contracts, and the writeback of execution/state evidence facade layers.

### Diagram Type Conventions

Each diagram in this document is labeled with its type, and readers should judge the diagram's scope of expression based on this:

| Diagram Type | Meaning | Expresses | Does Not Express |
|--------|------|------|--------|
| **Structure diagram** | Module attribution and logical boundaries | Which plane/layer a module belongs to | Runtime call order |
| **Data flow diagram** | Runtime data/control signal flow | Signal transmission direction and protocol | Module internal implementation |
| **Dependency diagram** | Code-level import direction | Who can depend on whom | Runtime timing |
| **Sequence diagram** | Runtime execution order | Step sequence | Module attribution |
| **Constraint diagram** | Architecture rules and prohibitions | Allowed/prohibited dependency directions | Specific call relationships |

### Naming Convention Unification

The following names are used uniformly in this document, `01-code-structure.md`, and `02-code-architecture-reference.md`:

| Unified Name | Aliases Not Used |
|----------|-------------|
| `emergency/` | emergency-brake/ |
| `workflow-debugger/` | debug-ui/ |
| `platform-ops-agent/` | self-ops-agent/ |
| `resource-manager/` | resource-scheduler/ |
| `goal-decomposer/` | goal-decomposition/ |

### Statistics Calibration Statement

> Some planning-caliber figures are still retained in historical diagrams of this document; new or revised statistics in v1.5 are **2026-05-26 current workspace structure snapshots**. Precise file counts should be based on subsequent structure inventory scripts.

### This Round's Diagram Sync Focus (2026-05-26)

1. P1 has continued to converge from "only admin/internal queries" to "public Layer C `/v1/*` query surface + admin/internal management surface coexisting".
2. `scale-ecosystem/federation/` is now treated as a persistence-based governance capability, no longer understood as a pure in-memory specification diagram.
3. The Electron bridge in `ui/` has entered the formal compatibility contract, no longer just a shell placeholder.
4. P3/P4/P5 have added implementation module calibers such as `full-trajectory-evaluator`, `tool-gateway`, `sandbox-provider`, `memory-gateway`, `receipts`, and `shared/reliability`.

---

## Table of Contents

| Section | Diagram Type | Content |
|------|--------|------|
| §1 | Structure diagram | System overview framework diagram (seven layers + five planes + cross-layer) |
| §2 | Data flow diagram | Layer 1-2 `platform/` five-plane backbone protocol flow |
| §3 | Structure diagram | P1 Interface Plane module attribution diagram |
| §4 | Structure diagram | P2 Control Plane module attribution diagram |
| §5 | Structure diagram | P3 Orchestration Plane module attribution diagram |
| §6 | Structure diagram + sequence diagram | P4 Execution Plane (BC framework + execution timing + tool security) |
| §7 | Structure diagram | P5 State & Evidence Plane (grouped by Bounded Context) |
| §8 | Structure diagram | AI Runtime Support Stack (Model Gateway · Prompt Engine · Compliance) |
| §9 | Data flow diagram | Platform protocol diagram (Contracts cross-plane protocol chain + Shared infrastructure) |
| §10 | Structure diagram | Layer 3 `domains/` business domain access layer |
| §11 | Structure diagram | Layer 4 `interaction/` intelligent interaction layer |
| §12 | Structure diagram | Layer 5 `org-governance/` organizational governance layer |
| §13 | Structure diagram | Layer 6 `scale-ecosystem/` scalable runtime + ecosystem layer |
| §14 | Structure diagram | Layer 7 `ops-maturity/` operations maturity layer |
| §15 | Structure diagram | Cross-layer modules (plugins · sdk · apps) |
| §16 | Data flow diagram | End-to-end data flow overview |
| §17 | Constraint diagram | Dependency direction and layering constraints |
| §18 | Structure diagram | Seven-layer stability model |
| §19 | Structure diagram | P4 Runtime Bounded Context specialized diagram |
| §20 | Structure diagram | P5 Storage Bounded Context specialized diagram |
| §21 | Structure diagram | Cross-cutting capability control plane diagram |
| §22 | Structure diagram | Legacy system modules → new platform landing point diagram |
| §23 | Sequence diagram | Migration wave roadmap |
| §24 | Data flow diagram | Interaction · Governance · Platform three-axis collaboration diagram |
| §25 | Structure diagram + constraint diagram | Cross-platform UI Monorepo and frontend-backend boundary |
| §26 | Structure diagram | Mission · Yono · testing/deployment support increment diagram |

---

## §1 System Overview Framework Diagram

> **Diagram type: Structure diagram** — Expresses the logical attribution relationship of seven layers + five planes + cross-layer. Does not express runtime call order.
>
> **Key understanding**: `platform/` is the foundational core, while `interaction/` · `org-governance/` · `scale-ecosystem/` · `ops-maturity/` are **independent upper-layer systems** (not subcomponents of platform), they interact with the core through contracts and events.

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Automatic Agent Platform v2.7                          │
│                                                                                 │
│  ╔═══════════════════════════════════════════════════════════════════════════╗  │
│  ║  Layer 7: Operations Maturity Layer  ops-maturity/   ← Independent upper   ║  │
│  ║  Explainability · Emergency brake · Agent lifecycle · Edge · Drift · Cost ║  │
│  ╠═══════════════════════════════════════════════════════════════════════════╣  │
│  ║  Layer 6: Scalable Runtime + Ecosystem  scale-ecosystem/  ← Independent  ║  │
│  ║  Multi-region · Resource contention · SLA · Agent marketplace · Feedback ║  │
│  ╠═══════════════════════════════════════════════════════════════════════════╣  │
│  ║  Layer 5: Organizational Governance  org-governance/    ← Independent    ║  │
│  ║  Org hierarchy · Approval routing · SSO/SCIM · Compliance · Knowledge   ║  │
│  ╠═══════════════════════════════════════════════════════════════════════════╣  │
│  ║  Layer 4: Intelligent Interaction  interaction/         ← Independent    ║  │
│  ║  NL entry · Goal decomposition · Proactive Agent · Progressive autonomy ║  │
│  ╠═══════════════════════════════════════════════════════════════════════════╣  │
│  ║  Layer 3: Business Domain Access  domains/              ← Independent    ║  │
│  ║  Domain registry · Risk profile · Knowledge schema · Eval · Prompt · Gov║  │
│  ╚═══════════════════════════════════════════════════════════════════════════╝  │
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  Layer 1-2: Infrastructure + AI Operations  platform/   ← Platform Core  │  │
│  │                                                                           │  │
│  │  ┌────── Five-Plane Core ──────────────────────────────────────────────┐  │  │
│  │  │  P1 Interface │ P2 Control │ P3 Orchestrate │ P4 Execution │ P5 State │ │  │
│  │  └────────────────────────────────────────────────────────────────────┘  │  │
│  │  ┌────── AI Operations Sidecar ────────────────────────────────────────┐  │  │
│  │  │  model-gateway/ · prompt-engine/ · compliance/                     │  │  │
│  │  └────────────────────────────────────────────────────────────────────┘  │  │
│  │  ┌────── Cross-cutting Foundation ─────────────────────────────────────┐  │  │
│  │  │  contracts/ · shared/ (utils · lifecycle · cache · obs · stability)│  │  │
│  │  └────────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                          │
│  │   plugins/   │  │     sdk/     │  │    apps/     │   ← Cross-layer modules  │
│  │ Plugin Ecosystem│  │ SDK & DevEx │  │ Backend App Entries│                    │
│  └──────────────┘  └──────────────┘  └──────────────┘                          │
│                                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │     ui/      │  │   tests/     │  │   config/    │  │   deploy/    │        │
│  │ Cross-platform UI│  │ Auto-acceptance│  │ Versioned Config│  │ Deployment & Ops│   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘        │
│  ┌──────────────┐  ┌──────────────┐                                          │
│  │ src/testing/ │  │src/benchmarks│   ← Test infrastructure and benchmarks   │
│  │ Test Commons │  │ Perf Bench Entry │                                       │
│  └──────────────┘  └──────────────┘                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### X1 Reliability & Security Fabric Definition

X1 is not a separate directory, but a **cross-cutting capability band** jointly formed by the following modules, spanning all five planes and seven layers:

| Capability | Implementation Location |
|------|---------|
| AuthN/Z · Sandbox | `platform/five-plane-control-plane/iam/` |
| Circuit Breaker | `platform/model-gateway/provider-registry/` · `platform/shared/stability/` |
| Rate Limit · Backpressure | `platform/five-plane-interface/ingress/` · `platform/five-plane-execution/dispatcher/` |
| DLQ | `platform/five-plane-state-evidence/dlq/` |
| Secrets · Egress | `platform/five-plane-control-plane/iam/` |
| Observability | `platform/shared/observability/` |
| Recovery · Stability Rehearsal | `platform/five-plane-execution/recovery/` · `platform/shared/stability/` |
| Policy · Compliance | `platform/five-plane-control-plane/policy-center/` · `platform/compliance/` |

---

## §2 Layer 1-2 `platform/` Five-Plane Backbone Protocol Flow

> **Diagram type: Data flow diagram** — Expresses the backbone protocol transmission direction between the five planes, and the lateral support relationship of AI operations modules. Does not express module internal implementation details.

```text
platform/
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │  P1 Interface Plane  Interface Plane                              │      │
│   │  api/ · webhook/ · channel-gateway/ · scheduler/                 │      │
│   │  console-backend/ · ingress/                                     │      │
│   └────────────────────────────────┬─────────────────────────────────┘      │
│                                    │ request-envelope                       │
│   ┌────────────────────────────────▼─────────────────────────────────┐      │
│   │  P2 Control Plane  Control Plane                                  │      │
│   │  tenant/ · iam/ · policy-center/ · approval-center/              │      │
│   │  rollout-controller/ · incident-control/ · replay-repair/        │      │
│   │  config-center/ · audit-export/ · mission/ · risk-control/       │      │
│   └────────────────────────────────┬─────────────────────────────────┘      │
│                                    │ control-directive                      │
│   ┌────────────────────────────────▼─────────────────────────────────┐      │
│   │  P3 Orchestration Plane  Orchestration Plane ◀╌╌╌╌╌╌┐             │      │
│   │  oapeflir/ · planner/ · replan/ · routing/ │ · escalation/ · hitl │      │
│   └────────────────────────────────┬──────────│──────────────────────┘      │
│                                    │ exec-plan│                             │
│   ┌────────────────────────────────▼──────────│──────────────────────┐      │
│   │  P4 Execution Plane  Execution Plane  ◀╌╌╌╌╌╌╌╌╌┘              │      │
│   │  dispatcher/ · lease/ · worker-pool/ · execution-engine/         │      │
│   │  state-transition/ · ha/ · hot-upgrade/ · recovery/              │      │
│   │  tool-executor/ · plugin-executor/ · distributed-lock/           │      │
│   │  queue/ · queue-metrics/ · hibernation/ · resource/ · startup/   │      │
│   └────────────────────────────────┬─────────────────────────────────┘      │
│                                    │ state-command / execution-receipt      │
│   ┌────────────────────────────────▼─────────────────────────────────┐      │
│   │  P5 State & Evidence Plane  State & Evidence Plane               │      │
│   │  truth/ · events/ · projections/ · artifacts/ · memory/          │      │
│   │  knowledge/ · audit/ · incident/ · checkpoints/ · dlq/          │      │
│   │  outbox/ · side-effect-ledger/ · reconciliation/ · compaction/   │      │
│   └──────────────────────────────────────────────────────────────────┘      │
│                                                                             │
│   ┌───── AI Operations (parallel support, non-linear main chain, deeply embedded in multiple planes) ─┐│
│   │  model-gateway/       │  prompt-engine/  │  compliance/          │      │
│   │  Provider·Router·Cost │  Registry·Eval   │  Erasure·Encrypt     │      │
│   │  Fallback·Degradation │  Rollout·Render  │  Residency·Lineage   │      │
│   │  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌   │      │
│   │  Lateral support relationships:                                   │      │
│   │  P3/P4 ◀╌╌╌▶ model-gateway  (model routing + circuit breaker)    │      │
│   │  P3    ◀╌╌╌▶ prompt-engine  (Prompt rendering + evaluation)     │      │
│   │  P2/P5 ◀╌╌╌▶ compliance     (data compliance + audit)           │      │
│   └──────────────────────────────────────────────────────────────────┘      │
│                                                                             │
│   ┌─────────────────────── Cross-plane Foundation ───────────────────────┐      │
│   │  contracts/ (types · errors · envelopes · directives)            │      │
│   │  shared/    (utils · lifecycle · cache · observability · stability)│     │
│   └──────────────────────────────────────────────────────────────────┘      │
│                                                                             │
│   ═══════ X1 Reliability & Security Fabric (cross-cutting all layers, definition in §1) ═══════   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §3 P1 Interface Plane Module Attribution Diagram

> **Diagram type: Structure diagram** — Expresses the module attribution within P1 and the division of three responsibility areas. Does not express runtime call order or code dependencies.

```text
platform/five-plane-interface/
┌─────────────────────────────────────────────────────────────────────┐
│                       P1 Interface Plane                             │
│                                                                      │
│  ┌─────────── A. Ingress & Transport (Protocol Entry) ──────────────┐     │
│  │                                                              │     │
│  │  ┌───────────────┐  ┌──────────────┐  ┌───────────────┐    │     │
│  │  │    api/        │  │  webhook/    │  │   ingress/    │    │     │
│  │  │  http-server   │  │  inbound     │  │  rate-limit   │    │     │
│  │  │  routes        │  │  parser      │  │  routing      │    │     │
│  │  │  oidc/oauth    │  │  verify      │  │  canary       │    │     │
│  │  │  websocket     │  │  dispatch    │  └───────────────┘    │     │
│  │  └───────────────┘  └──────────────┘                        │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌─────────── B. Channel Delivery (Channel Transport) ─────────────────┐     │
│  │                                                              │     │
│  │  ┌───────────────────────────┐                              │     │
│  │  │   channel-gateway/        │                              │     │
│  │  │   telegram · slack        │                              │     │
│  │  │   webhook-out · sse       │                              │     │
│  │  └───────────────────────────┘                              │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌─────────── C. Operator Backend (Ops Backend) ─────────────────┐     │
│  │                                                              │     │
│  │  ┌──────────────┐  ┌───────────────────────────┐            │     │
│  │  │ scheduler/   │  │   console-backend/        │            │     │
│  │  │  cron        │  │   dashboard-api           │            │     │
│  │  │  event       │  │   config-ui               │            │     │
│  │  │  trigger     │  │   monitoring-view         │            │     │
│  │  └──────────────┘  └───────────────────────────┘            │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  Traffic direction:                                                   │
│  External request ──▶ ingress ──▶ api/webhook/channel-gateway         │
│  scheduler ──▶ P3 (scheduled trigger)                                │
│  console-backend ──▶ P5 (query) + P2 (control)                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## §4 P2 Control Plane Module Attribution Diagram

> **Diagram type: Structure diagram** — Expresses the module attribution within P2 and the four responsibility areas. Does not express runtime call order.

```text
platform/five-plane-control-plane/
┌─────────────────────────────────────────────────────────────────────────────┐
│                            P2 Control Plane                                  │
│                                                                              │
│  ┌──────── A. Governance ─────────────────────────────────────────┐      │
│  │  ┌──────────────┐  ┌────────────────────┐  ┌──────────────┐      │      │
│  │  │   tenant/    │  │   policy-center/   │  │approval-ctr/ │      │      │
│  │  │  Tenant Mgmt │  │   Policy Center    │  │  Approval Ctr│      │      │
│  │  └──────────────┘  └────────────────────┘  └──────────────┘      │      │
│  │  ┌─────────────────────────────────────────────────────────┐      │      │
│  │  │ mission/  Long-term Goal Governance                       │      │      │
│  │  │ lifecycle · resolver · governance · budget · live-guard │      │      │
│  │  │ handoff · snapshot · freeze/revoke/budget fail-close    │      │      │
│  │  └─────────────────────────────────────────────────────────┘      │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  ┌──────── B. Security & Access ────────────────────────────────┐      │
│  │  ┌─────────────────────────────────────────────────────────┐      │      │
│  │  │                     iam/                                 │      │      │
│  │  │  sandbox-policy · policy-engine · field-encrypt          │      │      │
│  │  │  data-classify · audit-event · secret-mgmt               │      │      │
│  │  │  network-egress · cve-intel · trusted-context-scanner    │      │      │
│  │  └─────────────────────────────────────────────────────────┘      │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  ┌──────── C. Release & Ops Control ────────────────────────┐      │
│  │  ┌────────────────────┐  ┌──────────────────────────────────┐     │      │
│  │  │rollout-controller/ │  │      incident-control/           │     │      │
│  │  │  traffic-route     │  │  ┌──────────┐ ┌──────────────┐  │     │      │
│  │  │  canary            │  │  │doctor    │ │deployment    │  │     │      │
│  │  │  auto-rollback     │  │  │takeover  │ │stop-loss     │  │     │      │
│  │  └────────────────────┘  │  │ops-gov   │ │release-pipe  │  │     │      │
│  │  ┌────────────────────┐  │  └──────────┘ └──────────────┘  │     │      │
│  │  │replay-repair-ctrl/ │  └──────────────────────────────────┘     │      │
│  │  │  Replay/Repair Ctrl │                                          │      │
│  │  └────────────────────┘                                           │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  ┌──────── D. Config & Audit ───────────────────────────┐      │
│  │  ┌──────────────┐  ┌──────────────┐ ┌──────────────┐              │      │
│  │  │config-center/│  │audit-export/ │ │ risk-control/│              │      │
│  │  │  runtime/env │  │  Audit Export│                               │      │
│  │  │  provider/   │  └──────────────┘                               │      │
│  │  │  model/billing│                                                │      │
│  │  └──────────────┘                                                 │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  Control flow:                                                                │
│  P1 ──▶ iam auth ──▶ mission resolve/snapshot ──▶ policy/risk eval ──▶ approval │
│  ──▶ generate control-directive ──▶ P3                                         │
│  incident-ctrl ◀── P5 events (anomaly trigger control)                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §5 P3 Orchestration Plane Module Attribution Diagram

> **Diagram type: Structure diagram** — Expresses the module attribution and collaboration direction within P3. Does not express runtime call order or code dependencies.

### P3 Module Boundary Rules

| Module | Responsibility | Decides What |
|------|------|---------|
| `routing/` | Task routing | "Who does it" (selecting Agent/Team/Workflow) |
| `planner/` | Task decomposition | "How to break it down" (DAG decomposition + strategy selection) |
| `oapeflir/` | Cognitive loop | "How to loop execution and learning" (8-stage controlled core) |
| `harness/` | Recoverable execution loop | "How to run Plan/Work/Eval in multi-iteration, recoverable, auditable manner" |
| `agent-delegation/` | Agent collaboration protocol | "How to delegate, receive, take over, report evidence" |
| `evaluator/` | Evaluation and acceptance | "Whether the result meets the standard, whether it enters feedback/learning" (includes trajectory-level evaluator) |
| `observer/` | Observation aggregation | "How runtime facts enter timeline/report" |
| `hitl/` | Human-machine collaboration | "Control nodes requiring human participation" (approval/takeover/explanation) |
| `replan/` | Replanning | "How to adjust after context changes" |
| `escalation/` | Escalation handling | "How to escalate when anomalies exceed current capabilities" |

```text
platform/five-plane-orchestration/
┌─────────────────────────────────────────────────────────────────────────────┐
│                       P3 Orchestration Plane                                 │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐        │
│  │  oapeflir/  OAPEFLIR Controlled Cognitive Core                   │        │
│  │                                                                    │        │
│  │  O ──▶ A ──▶ P ──▶ E ──▶ F ──▶ L ──▶ I ──▶ R                    │        │
│  │  Observe  Assess  Plan  Execute  Feedback  Learn  Improve  Rollout│        │
│  │                                                                    │        │
│  │  ┌──────────┐  ┌────────────────┐  ┌───────────────────┐         │        │
│  │  │workflow/ │  │    learn/      │  │ improve-rollout/  │         │        │
│  │  └──────────┘  └────────────────┘  └───────────────────┘         │        │
│  └──────────────────────────────────────────────────────────────────┘        │
│  ┌──────────────────────────────────────────────────────────────────┐        │
│  │  harness/  Durable Harness Runtime                                │        │
│  │  PlanBundle · WorkProduct · EvaluationReport · ContextSnapshot     │        │
│  │  resume · recovery · toolbelt · guardrails · feedback · replay     │        │
│  └──────────────────────────────────────────────────────────────────┘        │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   routing/   │  │   planner/   │  │ escalation/  │  │   replan/    │    │
│  │  "Who does"  │  │  "How break" │  │  "How esc"   │  │  "How adj"   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐      │
│  │ evaluator/   │  │ observer/    │  │ agent-delegation/            │      │
│  │ Quality Eval │  │ timeline     │  │ ACP message · evidence · audit│      │
│  │ traj-eval    │  │ report       │  │ takeover · handoff           │      │
│  └──────────────┘  └──────────────┘  └──────────────────────────────┘      │
│                                                                              │
│  ┌──────────────┐                                                           │
│  │    hitl/     │  Orchestration flow:                                       │
│  │  "Need human"│  control-directive ──▶ routing ──▶ planner ──▶ harness    │
│  └──────────────┘  ──▶ oapeflir/evaluator(full-trajectory) ──▶ P4           │
│                     anomaly ──▶ escalation / replan                          │
│                     need human ──▶ hitl ──▶ P1 push                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §6 P4 Execution Plane Module Framework Diagram

> P4 is the plane with the most modules, displayed below using three different types of diagrams.

### §6.1 P4 Top-level Module Grouping Diagram

> **Diagram type: Structure diagram** — Expresses the capability grouping of the current top-level modules of P4. Does not express runtime call order.

```text
platform/five-plane-execution/
┌─────────────────────────────────────────────────────────────────────┐
│  ┌────── Dispatch & Worker ──────────────────────────────────────┐      │
│  │  dispatcher/  │  lease/  │  worker-pool/  │ queue-metrics/ │      │
│  └───────────────────────────────────────────────────────────┘      │
│  ┌────── Execution Engine ──────────────────────────────────────────┐      │
│  │  execution-engine/ │ state-transition/ │ oapeflir/         │      │
│  │  hibernation/                                             │      │
│  └───────────────────────────────────────────────────────────┘      │
│  ┌────── Reliability & Recovery ──────────────────────────────────────┐      │
│  │  ha/  │  hot-upgrade/  │  recovery/                       │      │
│  └───────────────────────────────────────────────────────────┘      │
│  ┌────── Tool, Secure Execution & Plugins ───────────────────────────────┐      │
│  │  tool-gateway/ │ tool-executor/ │ sandbox-provider/       │      │
│  │  plugin-executor/                                         │      │
│  └───────────────────────────────────────────────────────────┘      │
│  ┌────── Infrastructure ──────────────────────────────────────────┐      │
│  │  distributed-lock/ │ queue/ │ resource/ │ startup/        │      │
│  │  shared/                                                  │      │
│  └───────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

### §6.2 P4 Execution Sequence Diagram

> **Diagram type: Sequence diagram** — Expresses the runtime step sequence of one task execution. Does not express module attribution or code dependencies.

```text
execution-plan (from P3)
    │
    ▼
dispatcher ─── admission control + priority ordering
    │
    ▼
lease ──────── allocate execution lease
    │
    ▼
worker-pool ── select target Worker + handshake
    │
    ▼
execution-engine ── agent-executor → model-call → tool-gateway
    │                   │
    │                   ├── loop-detect (infinite loop detection)
    │                   ├── effect-buffer (side-effect buffer)
    │                   ├── context-compact (context compaction)
    │                   └── sandbox-provider → tool/plugin invocation
    │
    ▼
state-transition ── state machine drives state changes
    │
    ▼
P5 ◀── state-command (persistence)
P5 ◀── receipt/outbox/side-effect-ledger (durable side-effect evidence)
P3 ◀── execution-receipt (receipt)

Anomaly paths:
    stalled-detect ──▶ recovery ──▶ replay/repair
    region-fail ──▶ ha ──▶ failover
    version-change ──▶ hot-upgrade ──▶ graceful-migrate
```

### §6.3 P4 Tool Invocation Security & Durable Side-effect Diagram

> **Diagram type: Data flow diagram** — Expresses security control points and durable side-effect writes in the tool invocation chain. Does not express module attribution.

```text
execution-engine
    │
    ▼
tool-gateway
    ├── prepare/verify/commit/compensate ── tool side-effect facade
    ├── receipt shadow write ────────────── receipt shadow write
    └── durable outbox ─────────────────── durable publish

sandbox-provider
    ├── sandbox-layer resolve ── local/container/browser/microvm/remote
    └── capability/session bind ── tool capability and session constraint

tool-executor
    ├── command-security ─────── command security validation
    ├── tool-contract-validator ─ contract compliance check
    ├── tool-path-scope ──────── path scope restriction
    ├── tool-output-sanitizer ── output sanitization
    ├── mcp-tool-guard ──────── MCP protocol guard
    └── role-tool-exposure ──── role tool visibility

plugin-executor
    ├── runtime-sandbox ─────── sandbox isolated execution
    ├── plugin-host ─────────── subprocess host
    └── plugin-protocol ─────── communication protocol guard

tool-gateway ──▶ P5 receipts/outbox/side-effect-ledger
```

---

## §7 P5 State & Evidence Plane Module Attribution Diagram

> **Diagram type: Structure diagram** — Expresses the module attribution relationships within P5 grouped by 7 Bounded Contexts, and the Truth / Derived / Evidence three-tier data partitioning. Does not express runtime read/write timing and specific table structures.

### §7.1 BC Grouping Structure Diagram

```text
platform/five-plane-state-evidence/
┌─────────────────────────────────────────────────────────────────────────────┐
│                     P5 State & Evidence Plane                                │
│                                                                              │
│  ════════════ Zone A: Truth Authoritative Zone ════════════════════          │
│  (transactional consistency; write path: P4 state-command ──▶ truth + event same-transaction commit)           │
│                                                                              │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │  BC1 Core Task Engine  (~73 methods)│  │  BC2 Worker Infrastructure(~47) │  │
│  │  task · workflow · execution ·  │  │  worker · dispatch · lease ·    │  │
│  │  session                         │  │  lock                           │  │
│  │  ─────────────────────────────  │  │  ─────────────────────────────  │  │
│  │  Task lifecycle · Workflow state │  │  Dispatch assignment · Lease   │  │
│  │  Execution mgmt · Session control│  │  acquire/renew · Dist lock · Worker reg│ │
│  └─────────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │  BC3 Event Infrastructure (~24) │  │  BC4 Billing & Cost (~29)       │  │
│  │  event                           │  │  billing                        │  │
│  │  ─────────────────────────────  │  │  ─────────────────────────────  │  │
│  │  Event publish · Ack · DLQ mgmt│  │  Account · Invoice · Quota ·   │  │
│  │  Durable bus · Type registry     │  │  Usage · Ledger · Entitlement  │  │
│  └─────────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │  BC5 Governance & Compliance    │  │  BC6 Platform & Commerce (~47)  │  │
│  │  (~50)                           │  │  marketplace · release ·        │  │
│  │  approval · organization ·      │  │  division · intelligence ·      │  │
│  │  secret · compliance · ops      │  │  evolution                       │  │
│  │  ─────────────────────────────  │  │  ─────────────────────────────  │  │
│  │  Approval routing · Org hierarchy│  │  Marketplace catalog · Release │  │
│  │  Secret mgmt · Compliance policy│  │  lifecycle · Division mgmt ·   │  │
│  │  Operations governance           │  │  Analytics · Evolution proposal │  │
│  └─────────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────┐                                        │
│  │  BC7 Memory & Artifacts (~10)   │                                        │
│  │  memory · artifacts              │                                        │
│  │  memory-gateway                  │                                        │
│  │  ─────────────────────────────  │                                        │
│  │  Memory CRUD + Quality mgmt ·   │                                        │
│  │  proposal/projection facade ·   │                                        │
│  │  Artifact storage · Versioning   │                                        │
│  └─────────────────────────────────┘                                        │
│                                                                              │
│  ════════════ Zone B: Derived Query Zone ═════════════════════       │
│  (eventually consistent; derived from Truth event stream; idempotent rebuild; does not write back to truth)                     │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                       │
│  │projections/  │  │  knowledge/  │  │reconciliation│                       │
│  │ Query proj view│  │  Knowledge  │  │  Event aggr  │                       │
│  │ query-view    │  │  semantic   │  │  record      │                       │
│  │ rebuild       │  │  keyword    │  │  timeline    │                       │
│  │ event-id dedup │  │  ingest    │  │              │                       │
│  └──────────────┘  └──────────────┘  └──────────────┘                       │
│  ┌──────────────┐                                                           │
│  │  incident/   │  Incident aggregation and operations event view             │
│  └──────────────┘                                                           │
│                                                                              │
│  ════════════ Zone C: Evidence Chain Zone ═════════════════════        │
│  (append-only; for audit/compliance/recovery; forms immutable evidence chain)                          │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   audit/     │  │  artifacts/  │  │checkpoints/  │  │    dlq/      │    │
│  │  Audit Log   │  │  Evidence    │  │  Recovery Ckpt│  │  Dead Letter │    │
│  │  who-what-   │  │  evidence-   │  │  workflow/   │  │  failed-     │    │
│  │  when        │  │  chain       │  │  step-ckpt   │  │  event       │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐                  │
│  │   outbox/    │  │side-effect-ledger│  │  receipts/   │                  │
│  │ Reliable Pub │  │ Ext Side-effect  │  │ Std Receipt  │                  │
│  └──────────────┘  └──────────────────┘  └──────────────┘                  │
│  ┌──────────────┐                                                           │
│  │ compaction/  │  History/context compaction                                  │
│  └──────────────┘                                                           │
│                                                                              │
│  ──────────────────── Infrastructure Layer ────────────────────                        │
│  storage-backend-factory · migration-runner · async-repo-registry           │
│  session-dual-write · storage-quota                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### §7.2 Data Flow Schematic

```text
  P4 state-command
        │
        ▼
  ┌──────────┐    same-tx     ┌──────────┐    reliable pub  ┌──────────┐
  │  Truth   │ ═══════════▶ │  Event   │ ═══════════▶ │ outbox/  │
  │  (BC1-7) │              │  (BC3)   │              │ publish  │
  └──────────┘              └────┬─────┘              └──────────┘
                                 │ async projection
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                   ▼
        ┌──────────┐      ┌──────────┐        ┌──────────┐
        │ Derived  │      │ Evidence │        │ Upper Sys│
        │projection│      │audit/ckpt│        │L4-L7 subs│
        │knowledge │      │artifacts │        │evt cons  │
        │reconcile │      │receipt   │        │          │
        │memory-gw │      │side-effect│       │          │
        └──────────┘      └──────────┘        └──────────┘
```

### §7.3 BC Grouping Boundary Rules

| Rule | Description |
|------|------|
| Inter-BC communication | Only through Event Bus (BC3); direct import between BCs is prohibited |
| Truth write | Must go through state-command contract; each BC manages its own tables |
| Projection rebuild | Any Projection can be idempotently rebuilt from Event Log; rebuild command is a standard ops operation |
| Evidence immutable | audit / artifact / checkpoint are append-only; used for compliance audit and fault recovery |
| Outbox/side-effect | Critical state changes must be visible through outbox or side-effect-ledger, silent external writes are not allowed |
| Migration order | Zone B (Derived) → Zone C (Evidence) → Zone A (Truth); migrate read-heavy, write-light tables first |

---

## §8 AI Runtime Support Stack Module Attribution Diagram

> **Diagram type: Structure diagram** — Expresses the module attribution and responsibility partitioning of the three major components of the AI operations sidecar (Model Gateway · Prompt Engine · Compliance). Does not express model invocation timing and Prompt rendering details.
>
> **Positioning note**: These three components in the §1 overview belong to the "AI operations sidecar" visual band, **parallel support** with the five-plane main core (dashed cross-plane relationship), not submodules of any single plane. P3/P4 invoke model-gateway and prompt-engine through contracts, P5 invokes compliance through contracts.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                     AI Runtime Support Stack                                 │
│               (parallel support, not five-plane subcomponent; serves all planes through contracts)                │
│                                                                              │
│  ┌───────────────────────────────┐  ┌──────────────────────────────────┐    │
│  │     model-gateway/ Model GW    │  │      prompt-engine/              │    │
│  │                                │  │      Prompt Engineering Engine   │    │
│  │  ┌─────────────┐ ┌──────────┐ │  │  ┌──────────┐ ┌──────────────┐  │    │
│  │  │provider-    │ │  router/ │ │  │  │registry/ │ │  renderer/   │  │    │
│  │  │ registry    │ │ cost     │ │  │  │ version  │ │  template    │  │    │
│  │  │ base-chat   │ │ latency  │ │  │  │ history  │ │  variable    │  │    │
│  │  │ unified-chat│ │ capabil  │ │  │  └──────────┘ └──────────────┘  │    │
│  │  │ circuit-    │ └──────────┘ │  │  ┌──────────┐ ┌──────────────┐  │    │
│  │  │  breaker    │ ┌──────────┐ │  │  │rollout/  │ │    eval/     │  │    │
│  │  │ credential- │ │  cache/  │ │  │  │ canary   │ │  llm-eval    │  │    │
│  │  │  pool       │ │ kv-cache │ │  │  │ a/b test │ │  outcome     │  │    │
│  │  └─────────────┘ │ prompt-  │ │  │  │ rollback │ │  quality     │  │    │
│  │  ┌─────────────┐ │  cache   │ │  │  └──────────┘ │  policy-gov  │  │    │
│  │  │cost-tracker │ └──────────┘ │  │               └──────────────┘  │    │
│  │  │ budget-guard│ ┌──────────┐ │  └──────────────────────────────────┘    │
│  │  │ token-meter │ │fallback/ │ │                                          │
│  │  └─────────────┘ │ provider │ │  ┌──────────────────────────────────┐    │
│  │  ┌─────────────┐ │ failover │ │  │      compliance/ Compliance     │    │
│  │  │  messages/  │ └──────────┘ │  │  ┌──────────┐ ┌──────────────┐  │    │
│  │  │ token-est   │              │  │  │ erasure/ │ │ encryption/  │  │    │
│  │  │ message-    │              │  │  │ crypto-  │ │ field-level  │  │    │
│  │  │  parts      │              │  │  │  shred   │ │  encrypt     │  │    │
│  │  └─────────────┘              │  │  └──────────┘ └──────────────┘  │    │
│  └───────────────────────────────┘  │  ┌──────────┐ ┌──────────────┐  │    │
│                                      │  │data-     │ │  lineage/    │  │    │
│  Invocation contracts:                │  │ residency│ │  data-lineage│  │    │
│  P3 ══model-request══▶ model-gw     │  └──────────┘ └──────────────┘  │    │
│  P4 ══model-request══▶ model-gw     └──────────────────────────────────┘    │
│  P3 ══prompt-render══▶ prompt-engine                                        │
│  P5 ══compliance-cmd══▶ compliance                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §9 Platform Protocol Diagram (Contracts Cross-plane Protocol Chain + Shared Infrastructure)

> **Diagram type: Data flow diagram** — Expresses the transmission direction of cross-plane contracts and the service scope of shared infrastructure. Does not express internal field definitions of contracts and implementation details of shared modules.
>
> **Protocol chain core path**: The signal transmission of P1→P2→P3→P4→P5 is linked by 7 contract envelopes, each defining the communication protocol between upstream and downstream planes.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Cross-plane Protocols and Shared Infrastructure                               │
│                                                                              │
│  ┌──────────────────────────────────────────────────────┐                   │
│  │  contracts/  Cross-plane Protocol Chain                              │                   │
│  │                                                        │                   │
│  │  ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────────┐ │                   │
│  │  │types/  │ │errors  │ │constants/│ │result-       │ │                   │
│  │  │domain  │ │.ts     │ │ time.ts  │ │ envelope/    │ │                   │
│  │  │ids     │ └────────┘ └──────────┘ └──────────────┘ │                   │
│  │  │status  │                                            │                   │
│  │  └────────┘ ┌──────────────┐ ┌──────────────────────┐ │                   │
│  │              │request-      │ │control-directive/    │ │                   │
│  │              │ envelope/    │ │ P2 ══▶ P3 Ctrl Xfer │ │                   │
│  │              │ P1 ══▶ P2   │ └──────────────────────┘ │                   │
│  │              └──────────────┘                          │                   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │                   │
│  │  │execution-    │ │execution-    │ │state-        │   │                   │
│  │  │ plan/        │ │ receipt/     │ │ command/     │   │                   │
│  │  │ P3 ══▶ P4   │ │ P4 ══▶ P3   │ │ P4 ══▶ P5   │   │                   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘   │                   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │                   │
│  │  │delegation-   │ │model-        │ │compliance-   │   │                   │
│  │  │ request/     │ │ request/     │ │ command/     │   │                   │
│  │  │ P3 ══▶ HITL │ │ P3/P4 ══▶ AI│ │ P5 ══▶ Comp  │   │                   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘   │                   │
│  │                                                        │                   │
│  │  Protocol chain linkage:                                           │                   │
│  │  request-envelope ──▶ control-directive ──▶            │                   │
│  │  execution-plan ──▶ execution-receipt ──▶              │                   │
│  │  state-command                                         │                   │
│  └──────────────────────────────────────────────────────┘                   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────┐                   │
│  │  shared/  Cross-plane Shared Infrastructure                           │                   │
│  │                                                        │                   │
│  │  ┌──────────┐ ┌───────────┐ ┌────────────────────┐   │                   │
│  │  │ utils/   │ │lifecycle/ │ │      cache/        │   │                   │
│  │  │bounded-  │ │service-   │ │  cache-facade      │   │                   │
│  │  │ cache    │ │ registry  │ │  cache-bootstrap   │   │                   │
│  │  └──────────┘ │evolution  │ │  cache-policy      │   │                   │
│  │                └───────────┘ │  cache-invalidate  │   │                   │
│  │                               │  cache-key-factory│   │                   │
│  │  ┌──────────────────────┐    │  cache-metrics     │   │                   │
│  │  │   observability/     │    └────────────────────┘   │                   │
│  │  │  structured-logger   │                              │                   │
│  │  │  otel-bootstrap      │    ┌────────────────────┐   │                   │
│  │  │  metrics-service     │    │    stability/       │   │                   │
│  │  │  health-service      │    │  golden-task-runner │   │                   │
│  │  │  diagnostics         │    │  vcr-replay         │   │                   │
│  │  │  inspect-service     │    │  stable-acceptance  │   │                   │
│  │  │  sli/slo/anomaly     │    │  30+ rehearsal      │   │                   │
│  │  │  agent-state-view    │    │   scenarios         │   │                   │
│  │  └──────────────────────┘    └────────────────────┘   │                   │
│  └──────────────────────────────────────────────────────┘                   │
│                                                                              │
│  Contract data flow:                                                               │
│  P1 ──request-envelope──▶ P2 ──control-directive──▶ P3                      │
│  P3 ──execution-plan──▶ P4 ──execution-receipt──▶ P3                        │
│  P4 ──state-command──▶ P5                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §10 Layer 3 `domains/` Business Domain Access Layer Framework Diagram

> **Diagram type: Structure diagram** — Expresses the attribution and responsibility partitioning of modules under domains/. Does not express the runtime flow of domain registration and Plugin SPI invocation details.

```text
domains/
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Layer 3: Business Domain Access Layer                                      │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────┐               │
│  │  registry/  Domain Registry (Core Hub)                         │               │
│  │  ┌────────────┐ ┌──────────────┐ ┌──────────────────┐   │               │
│  │  │domain-     │ │contract-     │ │workflow-registry │   │               │
│  │  │ registry   │ │ registry     │ │tool-bundle-      │   │               │
│  │  │domain-     │ │plugin-spi    │ │ registry         │   │               │
│  │  │ model      │ │plugin-spi-   │ │registry-         │   │               │
│  │  │domain-     │ │ registry     │ │ bootstrap        │   │               │
│  │  │ event      │ │plugin-       │ └──────────────────┘   │               │
│  │  │smoke-test  │ │ runtime-host │                         │               │
│  │  └────────────┘ └──────────────┘                         │               │
│  └──────────────────────────────────────────────────────────┘               │
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │risk-profile/ │ │knowledge-    │ │eval-         │ │prompt-       │       │
│  │ Domain Risk  │ │ schema/      │ │ framework/   │ │ library/     │       │
│  │ Profile      │ │ Domain Know  │ │ Domain Eval  │ │ Domain Prompt│       │
│  │ [NEW §37]    │ │ [NEW §37]    │ │ [NEW §37]    │ │ [NEW §37]    │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                        │
│  │recipes/      │ │interaction-  │ │governance/   │                        │
│  │ DomainRecipe │ │ policy/      │ │ Domain Gov   │                        │
│  │ Prototype     │ │ Cross-domain │ │ division-    │                        │
│  │ [NEW §38]    │ │ [NEW §37]    │ │  loader      │                        │
│  └──────────────┘ └──────────────┘ │ hr-role-gov  │                        │
│                                     └──────────────┘                        │
│  ┌──────────────┐ ┌──────────────┐                                         │
│  │  coding/     │ │ operations/  │  Domain Instance Examples                              │
│  │  Code Dev    │ │  Ops Domain  │  (Concrete business domains registered via registry)       │
│  └──────────────┘ └──────────────┘                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                       │
│  │   yono/      │ │financial-    │ │quant-trading/│  Business Domain Instances            │
│  │ Yono Business│ │ services/    │ │ Quant Trading│  Not part of framework infrastructure│
│  └──────────────┘ └──────────────┘ └──────────────┘                       │
│                                                                              │
│  Access flow: business party ──▶ registry(register DomainDescriptor) ──▶                     │
│          risk-profile + knowledge + eval + prompt ──▶                       │
│          recipes(generate Recipe) ──▶ platform/(P3 orchestration available)                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §11 Layer 4 `interaction/` Intelligent Interaction Layer Framework Diagram

> **Diagram type: Structure diagram** — Expresses the attribution and responsibility partitioning of modules under interaction/. Does not express the natural language parsing pipeline and autonomy state machine transition details.
>
> All modules in this layer are newly created (NEW), no legacy migration files.

```text
interaction/
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Layer 4: Intelligent Interaction Layer (User-side OS)                         │
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │   nl-gateway/ [§39]      │  │  goal-decomposer/ [§40]  │                 │
│  │   NL Task Entry        │  │  Goal Decomposition Engine             │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │                 │
│  │  │ intent-parser/     │  │  │  │ planner/           │  │                 │
│  │  │  Intent parsing   │  │  │  │  template/LLM/     │  │                 │
│  │  │ slot-resolver/     │  │  │  │  hybrid/human      │  │                 │
│  │  │  Slot extraction   │  │  │  │ dependency-graph/  │  │                 │
│  │  │ ambiguity-handler/ │  │  │  │  Task Dep DAG     │  │                 │
│  │  │  Disambig dialog   │  │  │  │ validator/         │  │                 │
│  │  └────────────────────┘  │  │  │  Result validation │  │                 │
│  └──────────────────────────┘  │  └────────────────────┘  │                 │
│                                 └──────────────────────────┘                 │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │  proactive-agent/ [§41]  │  │    autonomy/ [§42]       │                 │
│  │  Proactive Agent FW     │  │  Progressive Autonomy Model           │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │                 │
│  │  │ trigger-engine/    │  │  │  │ trust-scorer/      │  │                 │
│  │  │  cron/event/thresh │  │  │  │  Trust scoring     │  │                 │
│  │  │ schedule-manager/  │  │  │  │ level-manager/     │  │                 │
│  │  │  Schedule mgmt     │  │  │  │  Autonomy FSM      │  │                 │
│  │  │ event-watcher/     │  │  │  │ promotion-engine/  │  │                 │
│  │  │  Event-driven wake │  │  │  │  Promo/demote      │  │                 │
│  │  └────────────────────┘  │  │  └────────────────────┘  │                 │
│  └──────────────────────────┘  └──────────────────────────┘                 │
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │   dashboard/ [§43]       │  │      ux/ [§44]           │                 │
│  │   Unified Ops Dashboard  │  │   Non-tech UX            │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │                 │
│  │  │ metric-aggregator/ │  │  │  │ wizard/            │  │                 │
│  │  │  Metric aggreg.    │  │  │  │  Visual domain     │  │                 │
│  │  │ health-scorer/     │  │  │  │  access wizard     │  │                 │
│  │  │  Health scoring    │  │  │  │ template-engine/   │  │                 │
│  │  │ alert-router/      │  │  │  │  Visual workflow   │  │                 │
│  │  │  Alert routing     │  │  │  │  builder           │  │                 │
│  │  └────────────────────┘  │  │  │ onboarding/        │  │                 │
│  └──────────────────────────┘  │  │  First-use guide   │  │                 │
│                                 │  └────────────────────┘  │                 │
│                                 └──────────────────────────┘                 │
│                                                                              │
│  Interaction flow:                                                                    │
│  User NL ──▶ nl-gateway(parse) ──▶ goal-decomposer(decompose)               │
│  ──▶ platform/P3(orchestrate) ──▶ autonomy(autonomy control)                            │
│  proactive-agent(proactive trigger) ──▶ nl-gateway ──▶ orchestration                         │
│  dashboard ◀── P5(aggregate display)   ux ──▶ domains/(guided access)                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §12 Layer 5 `org-governance/` Organizational Governance Layer Framework Diagram

> **Diagram type: Structure diagram** — Expresses the attribution and responsibility partitioning of modules under org-governance/. Does not express approval routing algorithms and SCIM synchronization protocol details.

```text
org-governance/
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Layer 5: Organizational Governance Layer                                     │
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │   org-model/ [§46]       │  │ approval-routing/ [§47]  │                 │
│  │   Org Hierarchy Model    │  │  Org Approval Routing    │                 │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │                 │
│  │  │ hierarchy/         │  │  │  │ route-engine/      │  │                 │
│  │  │  company/division/ │  │  │  │  org-chart/amount/ │  │                 │
│  │  │  department/team   │  │  │  │  SoD routing       │  │                 │
│  │  │ org-node/          │  │  │  │ escalation/        │  │                 │
│  │  │  CRUD + inherit    │  │  │  │  Approval escalat. │  │                 │
│  │  │ sync/              │  │  │  │ delegation/        │  │                 │
│  │  │  SCIM/HR-API/manual│  │  │  │  Leave proxy       │  │                 │
│  │  └────────────────────┘  │  │  └────────────────────┘  │                 │
│  └──────────────────────────┘  └──────────────────────────┘                 │
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │   sso-scim/ [§48]        │  │compliance-engine/ [§49]  │                 │
│  │   SSO/SCIM Integration   │  │  Dept Compliance Policy Engine       │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │                 │
│  │  │ saml/              │  │  │  │ policy-resolver/   │  │                 │
│  │  │  SAML SSO          │  │  │  │  Inherit + override│  │                 │
│  │  │ oidc/              │  │  │  │ inheritance/       │  │                 │
│  │  │  OIDC SSO          │  │  │  │  Child tightens    │  │                 │
│  │  │ scim-sync/         │  │  │  │ audit-enforcer/    │  │                 │
│  │  │  User/group sync   │  │  │  │  Audit enforcement │  │                 │
│  │  └────────────────────┘  │  │  └────────────────────┘  │                 │
│  └──────────────────────────┘  └──────────────────────────┘                 │
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │knowledge-boundary/ [§50] │  │delegated-governance/[§51]│                 │
│  │  Knowledge Isolation &   │  │  Hierarchical Gov Delegation             │
│  │  Controlled Sharing      │  │  ┌────────────────────┐  │                 │
│  │  ┌────────────────────┐  │  │  │ scope-manager/     │  │                 │
│  │  │ boundary-manager/  │  │  │  │  Scope management  │  │                 │
│  │  │  strict/controlled │  │  │  │ delegation-        │  │                 │
│  │  │  /open             │  │  │  │  registry/         │  │                 │
│  │  │ sharing-gate/      │  │  │  │  Delegation reg    │  │                 │
│  │  │  Cross-domain GW   │  │  │  └────────────────────┘  │                 │
│  │  │ access-log/        │  │  └──────────────────────────┘                 │
│  │  │  Access audit      │  │                                                │
│  │  └────────────────────┘  │                                                │
│  └──────────────────────────┘                                                │
│                                                                              │
│  Governance flow:                                                                    │
│  org-model(org tree) ──▶ approval-routing(approval routing)                           │
│  sso-scim(identity sync) ──▶ platform/P2/iam                                    │
│  compliance-engine ──▶ platform/P2/policy-center                           │
│  knowledge-boundary ──▶ platform/P5/knowledge(isolation control)                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §13 Layer 6 `scale-ecosystem/` Scalable Runtime + Ecosystem Layer Framework Diagram

> **Diagram type: Structure diagram** — Expresses the attribution and responsibility partitioning of modules under scale-ecosystem/. Does not express cross-region data synchronization protocols and SLA tiering algorithm details.

```text
scale-ecosystem/
┌─────────────────────────────────────────────────────────────────────────────┐
│                  Layer 6: Scalable Runtime + Ecosystem Layer                                 │
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │  multi-region/ [§52]     │  │ resource-manager/ [§53]  │                 │
│  │  Multi-Region Deployment  │  │  Resource Contention Mgmt             │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │                 │
│  │  │ region-router/     │  │  │  │ fair-queue/        │  │                 │
│  │  │  Region routing    │  │  │  │  Weighted fair Q   │  │                 │
│  │  │ data-replicator/   │  │  │  │ quota-enforcer/    │  │                 │
│  │  │  Cross-region sync │  │  │  │  Quota enforcement │  │                 │
│  │  │ failover-ctrl/     │  │  │  │ preemption/        │  │                 │
│  │  │  Region failover   │  │  │  │  Priority preempt  │  │                 │
│  │  └────────────────────┘  │  │  └────────────────────┘  │                 │
│  └──────────────────────────┘  └──────────────────────────┘                 │
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │   sla-engine/ [§54]      │  │   marketplace/ [§55]     │                 │
│  │   SLA Tiering Engine    │  │   Agent Marketplace & Ecosystem        │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │                 │
│  │  │ tier-resolver/     │  │  │  │ catalog/           │  │                 │
│  │  │  SLA tier resolve  │  │  │  │  Catalog           │  │                 │
│  │  │ resource-allocator/│  │  │  │ certification/     │  │                 │
│  │  │  Resource alloc    │  │  │  │  Cert & sec scan   │  │                 │
│  │  │ breach-detector/   │  │  │  │ publisher/         │  │                 │
│  │  │  SLA breach detect │  │  │  │  Publishing mgmt   │  │                 │
│  │  └────────────────────┘  │  │  │ billing-service    │  │                 │
│  └──────────────────────────┘  │  │ marketplace-gov    │  │                 │
│                                 │  └────────────────────┘  │                 │
│  ┌──────────────────────────┐  └──────────────────────────┘                 │
│  │  feedback-loop/ [§56]    │                                                │
│  │  Feedback-driven CI      │  ┌──────────────────────────┐                 │
│  │  ┌────────────────────┐  │  │  integration/ [§57]      │                 │
│  │  │ collector/         │  │  │  External Sys Integration│                 │
│  │  │  Signal collect    │  │  │  ┌────────────────────┐  │                 │
│  │  │ analyzer/          │  │  │  │ connector-registry/ │  │                 │
│  │  │  Signal analysis   │  │  │  │  Connector registry │  │                 │
│  │  │ improvement-       │  │  │  │ connector-runtime/  │  │                 │
│  │  │  tracker/          │  │  │  │  Connector runtime  │  │                 │
│  │  │  Improvement track │  │  │  │ health-monitor/     │  │                 │
│  │  └────────────────────┘  │  │  │  Connector health   │  │                 │
│  └──────────────────────────┘  │  └────────────────────┘  │                 │
│                                 └──────────────────────────┘                 │
│  Scale flow:                                                                  │
│  multi-region ──▶ platform/P4/ha(cross-region coordination)                           │
│  resource-manager ──▶ platform/P4/dispatcher(quota + preemption)                    │
│  sla-engine ──▶ resource-manager(allocate by SLA)                              │
│  marketplace ──▶ domains/registry(Agent listing)                              │
│  feedback-loop ◀── P5/events(signal collection) ──▶ ops-maturity/(improvement)            │
│  integration ──▶ platform/P4/tool-executor(external connector)                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §14 Layer 7 `ops-maturity/` Operations Maturity Layer Framework Diagram

> **Diagram type: Structure diagram** — Expresses the attribution and responsibility partitioning of 11 modules under ops-maturity/. Does not express evidence chain collection pipeline and drift detection algorithm details.
>
> This layer contains 11 modules, which is the "top-level encapsulation" of system capabilities, mostly newly created.

```text
ops-maturity/
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Layer 7: Operations Maturity Layer                                    │
│                                                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐               │
│  │explainability/  │ │  emergency/     │ │agent-lifecycle/ │               │
│  │ Explain [§59]   │ │  Emer Brake[§60]│ │ Agent Lifecycle │               │
│  │ evidence-       │ │  panic-ctrl     │ │  [§61]          │               │
│  │  collector      │ │  forensic-      │ │ agent-registry  │               │
│  │ causal-chain    │ │   snapshot      │ │ version-mgr     │               │
│  │ explanation-    │ │  resume-        │ │ canary-ctrl     │               │
│  │  renderer/cache │ │   protocol      │ │ retirement      │               │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘               │
│                                                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐               │
│  │ edge-runtime/   │ │drift-detection/ │ │ cost-optimizer/ │               │
│  │  Offline/Edge   │ │ Behavior Drift  │ │ Cost Optimizer  │               │
│  │ [§62]           │ │ [§63]           │ │ [§64]           │               │
│  │ edge-orchestratr│ │ fingerprint     │ │ attribution     │               │
│  │ edge-executor   │ │ changepoint     │ │ recommendation  │               │
│  │ local-model     │ │ cross-agent     │ │ simulator       │               │
│  │ sync-queue      │ │ evolution-*     │ │                 │               │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘               │
│                                                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐               │
│  │workflow-debugger│ │compliance-      │ │capacity-planner/│               │
│  │ Visual Debug    │ │ reporter/ [§66] │ │ Capacity Plan   │               │
│  │ [§65]           │ │                 │ │ [§67]           │               │
│  │ timeline-render │ │ template-reg    │ │ trend-analyzer  │               │
│  │ breakpoint-mgr  │ │ evidence-mapper │ │ forecaster      │               │
│  │ run-comparator  │ │ report-renderer │ │ simulator       │               │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘               │
│                                                                              │
│  ┌─────────────────┐ ┌──────────────────────────────────┐                   │
│  │  multimodal/    │ │   platform-ops-agent/ [§69]      │                   │
│  │  Multimodal     │ │   Platform Self-Ops Agent        │                   │
│  │  [§68]          │ │  ┌─────────────┐ ┌────────────┐  │                   │
│  │ image-processor │ │  │incident-    │ │config-     │  │                   │
│  │ speech-process  │ │  │ diagnoser   │ │ optimizer  │  │                   │
│  │ document-parser │ │  │capacity-    │ │dev-        │  │                   │
│  │ modality-router │ │  │ predictor   │ │ assistant  │  │                   │
│  └─────────────────┘ │  │health-      │ └────────────┘  │                   │
│                       │  │ monitor     │                  │                   │
│                       │  └─────────────┘                  │                   │
│                       └──────────────────────────────────┘                   │
│                                                                              │
│  Operations flow:                                                                    │
│  explainability ◀── P5/events+artifacts(collect evidence chain)                         │
│  emergency ──▶ platform/P2/incident-control(global brake)                       │
│  drift-detection ◀── P5/events(behavior fingerprint comparison)                               │
│  platform-ops-agent ──▶ self-invokes platform/ each plane(self-ops loop)              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §15 Cross-layer Module Framework Diagram (plugins · sdk · apps)

> **Diagram type: Structure diagram** — Expresses the module attribution and cross-layer invocation entry of plugins/ · sdk/ · apps/. Does not express plugin sandbox isolation mechanism and CLI command implementation details.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Cross-layer Modules                                           │
│                                                                              │
│  ┌───────────────────────────────────────┐                                  │
│  │  plugins/  Plugin Ecosystem                │                                  │
│  │                                        │                                  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────┐ │                                  │
│  │  │adapters/ │ │planners/ │ │present-│ │                                  │
│  │  │ asset    │ │ basic-   │ │ ers/   │ │                                  │
│  │  │ crm      │ │ planner  │ │coding  │ │                                  │
│  │  │ game-dev │ └──────────┘ │growth  │ │                                  │
│  │  │ github   │ ┌──────────┐ │ops     │ │                                  │
│  │  │ livestrm │ │retriever│ └────────┘ │                                  │
│  │  └──────────┘ │ asset   │ ┌────────┐ │                                  │
│  │                │ coding  │ │validat-│ │                                  │
│  │                │ game    │ │ ors/   │ │                                  │
│  │                │ growth  │ │basic-  │ │                                  │
│  │                │ livestrm│ │eval    │ │                                  │
│  │                │ ops     │ └────────┘ │                                  │
│  │                └──────────┘            │                                  │
│  │  builtin-plugin-registry               │                                  │
│  └───────────────────────────────────────┘                                  │
│                                                                              │
│  ┌───────────────────────────────────────┐  ┌──────────────────────────┐    │
│  │  sdk/  SDK & DevEx                │  │  apps/  App Entry         │    │
│  │                                        │  │                          │    │
│  │  ┌──────────┐ ┌──────────┐            │  │  ┌────────────────────┐ │    │
│  │  │pack-sdk/ │ │plugin-   │            │  │  │  api/              │ │    │
│  │  │ Pack Dev │ │ sdk/     │            │  │  │  API Server Entry  │ │    │
│  │  │  SDK     │ │ Plugin   │            │  │  ├────────────────────┤ │    │
│  │  └──────────┘ │  Dev SDK │            │  │  │  console/          │ │    │
│  │  ┌──────────┐ └──────────┘            │  │  │  Console UI Entry  │ │    │
│  │  │client-   │ ┌──────────┐            │  │  ├────────────────────┤ │    │
│  │  │ sdk/     │ │  cli/    │            │  │  │  workers/          │ │    │
│  │  │ REST +   │ │  78 CLI  │            │  │  │  Worker Process    │ │    │
│  │  │ WebSocket│ │  scripts │            │  │  └────────────────────┘ │    │
│  │  └──────────┘ └──────────┘            │  └──────────────────────────┘    │
│  └───────────────────────────────────────┘                                  │
│                                                                              │
│  Invocation relationships:                                                                  │
│  apps/api ──▶ platform/P1/api(start HTTP service)                              │
│  apps/workers ──▶ platform/P4/worker-pool(start Worker process)                │
│  apps/console ──▶ platform/P1/console-backend(start console)                  │
│  sdk/cli ──▶ platform/ modules(CLI command entry)                                │
│  plugins/* ──▶ domains/registry(register via SPI)                             │
│             ──▶ platform/P4/plugin-executor(sandbox execution)                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §16 End-to-end Data Flow Overview Diagram

> **Diagram type: Data flow diagram** — Expresses the complete signal transmission path of user requests from P1 to P5, and the event subscription relationships of upper-layer systems. Does not express module internal processing logic and error branches.

```text
                        ┌──────────────┐
                        │   User/Ext   │
                        └──────┬───────┘
                               │ HTTP / WebSocket / Webhook / Channel
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ P1 Interface   ingress ──▶ api / webhook / channel-gateway / scheduler      │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ request-envelope
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ P2 Control     iam(auth) ──▶ policy(eval) ──▶ approval(approval)                │
│                config-center(config) · incident-control(anomaly control)              │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ control-directive
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ P3 Orchestrate routing ──▶ planner ──▶ oapeflir(O-A-P-E-F-L-I-R)           │
│                hitl(human-machine collab) · escalation · replan · prompt-engine · model-gateway│
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ execution-plan
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ P4 Execution   dispatcher ──▶ lease ──▶ worker-pool ──▶ execution-engine    │
│                ──▶ tool-executor / plugin-executor                           │
│                state-transition · recovery · ha · hot-upgrade                │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ state-command / execution-receipt
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ P5 State       truth(persist) ──▶ events(event broadcast) ──▶                        │
│                projections(query view) · artifacts · memory(artifact)        │
│                knowledge · audit · checkpoints(checkpoint)           │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ events / query
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ Layer 4      │ │ Layer 6      │ │ Layer 7      │
    │ interaction/ │ │ scale-       │ │ ops-maturity/ │
    │ dashboard    │ │ ecosystem/   │ │ explainability│
    │ autonomy     │ │ feedback-    │ │ drift-detect  │
    │              │ │  loop        │ │ compliance-rpt│
    └──────────────┘ └──────────────┘ └──────────────┘
```

---

## §17 Dependency Direction and Layering Constraint Diagram

> **Diagram type: Constraint diagram** — Expresses the allowed and prohibited dependency directions between layers, as well as the same-layer decoupling methods. Does not express specific import paths and runtime call chains.

```text
Dependency direction rules: Upper layer can depend on lower layer, lower layer cannot depend on upper layer; same layer is decoupled through events/contracts.

  ┌─────────────────────────────────────────────────┐
  │  Layer 7  ops-maturity/                          │  Can depend on ──▶ L1-6
  │  (ops maturity modules)                          │
  ├─────────────────────────────────────────────────┤
  │  Layer 6  scale-ecosystem/                       │  Can depend on ──▶ L1-5
  │  (scale / ecosystem modules)                     │
  ├─────────────────────────────────────────────────┤
  │  Layer 5  org-governance/                        │  Can depend on ──▶ L1-4
  │  (org governance modules)                        │
  ├─────────────────────────────────────────────────┤
  │  Layer 4  interaction/                           │  Can depend on ──▶ L1-3
  │  (interaction modules)                           │
  ├─────────────────────────────────────────────────┤
  │  Layer 3  domains/                               │  Can depend on ──▶ L1-2
  │  (domain framework + domain instances)           │
  ├─────────────────────────────────────────────────┤
  │  Layer 1-2  platform/                            │  Only depends on contracts/ shared/
  │  (P1-P5 + model-gw + prompt + compliance)        │
  │  (contracts/ + shared/)                          │
  └─────────────────────────────────────────────────┘

  Cross-layer modules:
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ plugins/ │ │   sdk/   │ │  apps/   │  Can depend on any layer (injected through interface)
  └──────────┘ └──────────┘ └──────────┘

  Frontend and testing support:
  ┌──────────┐ ┌──────────────┐ ┌──────────────┐
  │   ui/    │ │    tests/    │ │src/testing/  │
  │ public   │ │ Can scan src │ │src/benchmarks│
  │ API only │ │ No prod dep  │ │ Test/bench   │
  └──────────┘ └──────────────┘ └──────────────┘

  Prohibited directions (✗):
  ✗  platform/ ──▶ interaction/       (lower layer cannot depend on upper layer)
  ✗  platform/ ──▶ org-governance/    (lower layer cannot depend on upper layer)
  ✗  domains/  ──▶ scale-ecosystem/   (lower layer cannot depend on upper layer)
  ✗  ui/       ──▶ src/platform/* private service/truth/worker internals
  ✗  src/*     ──▶ tests/ or ui/        (production code must not depend on test or frontend)

  Same-layer decoupling methods:
  ┌──────────┐  events/contracts   ┌──────────┐
  │ Module A │ ◀═══════════════▶  │ Module B │  (same layer communicates through event bus
  └──────────┘                     └──────────┘   or platform/contracts/)
```

---

## §18 Stability Seven-Layer Model Framework Diagram

> **Diagram type: Structure diagram** — Expresses the layering of the stability seven-layer model and the capability modules contained in each layer. Does not express the runtime trigger order between layers and the degradation decision logic.
>
> The stability seven-layer model cuts across the five planes and is the implementation skeleton of the X1 Reliability & Security Fabric.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Stability Seven-Layer Model (§9)                                     │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────┐       │
│  │  Layer 7: Observability                                             │       │
│  │  structured-logger · otel-tracer · metrics · health · diagnostics │       │
│  │  sli-collection · slo-alerting · anomaly-detection                │       │
│  │  agent-state-view · task-board · situation-report                  │       │
│  ├───────────────────────────────────────────────────────────────────┤       │
│  │  Layer 6: Recovery                                          │       │
│  │  lease-reclaim · execution-recovery · workflow-recovery            │       │
│  │  replay · repair · projection-rebuild · stalled-detection          │       │
│  ├───────────────────────────────────────────────────────────────────┤       │
│  │  Layer 5: Degradation                                       │       │
│  │  full_auto ──▶ supervised_auto ──▶ read_only ──▶ manual_only     │       │
│  │  no-write · no-external-call · no-rollout · incident-mode         │       │
│  ├───────────────────────────────────────────────────────────────────┤       │
│  │  Layer 4: Circuit Breaker                                     │       │
│  │  closed ──▶ open ──▶ half-open (for API/Provider/Tool/Plugin)      │       │
│  │  per-provider · per-tool · per-external-api                       │       │
│  ├───────────────────────────────────────────────────────────────────┤       │
│  │  Layer 3: Timeout & Retry                                 │       │
│  │  step-timeout · attempt-timeout · tool-timeout                    │       │
│  │  exponential-backoff + jitter · max-retries                       │       │
│  ├───────────────────────────────────────────────────────────────────┤       │
│  │  Layer 2: Rate Limiting & Backpressure                    │       │
│  │  per-tenant concurrency · per-workflow active                     │       │
│  │  Level 0(normal) ──▶ Level 1(warn) ──▶ Level 2(limit) ──▶ Level 3(protect) │   │
│  ├───────────────────────────────────────────────────────────────────┤       │
│  │  Layer 1: Isolation                                             │       │
│  │  tenant · project · domain · worker-pool · executor               │       │
│  │  sandbox · process-isolation · network-namespace                   │       │
│  └───────────────────────────────────────────────────────────────────┘       │
│                                                                              │
│  Stability rehearsals (platform/shared/stability/):                                   │
│  30+ rehearsal scenarios:                                                    │
│  golden-task · vcr-replay · dispatch · worker · lease · concurrency         │
│  queue · event · chaos · prompt-injection · rolling-upgrade · rollback       │
│  backup · maintenance · gray-release · db-writability · db-queue-disconnect │
│  migration · runtime-soak · cross-division                                  │
│                                                                              │
│  Trigger methods:                                                                  │
│  CI/CD auto ──▶ golden-task-runner ──▶ stable-acceptance-line              │
│  Manual ──▶ npm run test:golden / npm run *:stable                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §19 P4 Runtime Bounded Context Specialized Diagram

> **Diagram type: Structure diagram** — Expresses the attribution and dependency relationships of splitting `core/runtime/` within P4 Execution Plane into 12 Bounded Contexts. Does not express internal class/method-level implementation details of each BC.
>
> **Background**: The legacy `core/runtime/` is a monolith module (101 files / 30K lines), which needs to be split into independent BCs to reduce coupling. 6 BCs have zero internal dependencies (can be independently extracted), 2 are composition roots (retained in runtime/ core).

### §19.1 BC Attribution and Dependency Diagram

```text
platform/five-plane-execution/
┌─────────────────────────────────────────────────────────────────────────────┐
│                    P4 Execution Plane — 12 Bounded Contexts                  │
│                                                                              │
│  ══════════ Independent Extraction Zone (zero internal dependencies, Wave 1-2 priority extraction) ══════════           │
│                                                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐               │
│  │ BC3 Worker Mgmt │ │ BC5 HA Coord    │ │ BC6 Hot Upgrade │               │
│  │ (10 files)      │ │ (8 files)       │ │ (6 files)       │               │
│  │ worker-registry │ │ leader-election │ │ zero-downtime   │               │
│  │ load-balancing  │ │ cluster-member  │ │ repository      │               │
│  │ health-track    │ │ failover-ctrl   │ │ upgrade-factory │               │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘               │
│                                                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐               │
│  │ BC8 State Trans │ │ BC11 Infra      │ │ BC12 HITL & Gov │               │
│  │ (4 files)       │ │ (13 files)      │ │ (2 files)       │               │
│  │ state-machine   │ │ rate-limiter    │ │ hitl-explain    │               │
│  │ transition-svc  │ │ resource-mon    │ │ call-governance │               │
│  │                 │ │ startup-check   │ │ admission-ctrl  │               │
│  └────────┬────────┘ │ graceful-shutdn │ └─────────────────┘               │
│           │          └─────────────────┘                                     │
│           │ (only depended upon)                                                     │
│  ══════════ Ordered Extraction Zone (limited dependencies, Wave 2-3) ══════════                      │
│           │                                                                  │
│  ┌────────┴────────┐ ┌─────────────────┐                                    │
│  │ BC9 Agent Exec  │ │ BC2 Lease Mgmt  │                                    │
│  │ (12 files)      │ │ (8 files)       │                                    │
│  │ agent-executor  │ │ lease-lifecycle │                                    │
│  │ middleware-chain│ │ lease-compete   │                                    │
│  │ model-call      │ │ lease-repo      │                                    │
│  │ loop-detection  │ └────────┬────────┘                                    │
│  └─────────────────┘          │                                              │
│                                │                                              │
│  ┌─────────────────────────────┴───────────────────────────────┐             │
│  │ BC4 Handshake/Writeback (10 files) — depends on BC1 + BC2        │             │
│  │ worker-handshake · capability-negotiate · result-writeback  │             │
│  └─────────────────────────────────────────────────────────────┘             │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────┐             │
│  │ BC7 Recovery & Repair (13 files) — depends on BC1+BC2+BC5+BC8    │             │
│  │ crash-recovery · stall-detection · orphan-cleanup · replay  │             │
│  │ repair · deviation-detect · escalation                      │             │
│  └─────────────────────────────────────────────────────────────┘             │
│                                                                              │
│  ══════════ Composition Root (retained in runtime/ core, Wave 4 streamline) ══════════           │
│                                                                              │
│  ┌──────────────────────────────┐ ┌──────────────────────────────┐          │
│  │ BC1 Execution Dispatch       │ │ BC10 Multi-Step Orchestration│          │
│  │ (12 files) — Composition Root          │ │ (13 files) — Composition Root           │          │
│  │ dispatch-service · reconcile │ │ phase-mgmt · complexity-route│          │
│  │ dispatch-async · support     │ │ session-lifecycle · planner  │          │
│  └──────────────────────────────┘ │ supervisor · checkpoint      │          │
│                                    └──────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### §19.2 Extraction Wave Plan

```text
Wave 1 (zero risk)    BC3 + BC5 + BC6 + BC8              6,136 lines  20%
                    Verification gate: each BC unit test passes independently
                          │
Wave 2 (low risk)    BC2 + BC9 + BC12 + BC11             6,461 lines  21%
                    Verification gate: Lease/Agent integration test passes
                          │
Wave 3 (medium risk) BC4 + BC7                           5,678 lines  19%
                    Verification gate: Recovery rehearsal scenario passes
                          │
Wave 4 (wrap up)      BC1 + BC10 streamlined to runtime/ core      5,171 lines  17%
                    Verification gate: npm test full regression + stable-* passes
```

---

## §20 P5 Storage Bounded Context Specialized Diagram

> **Diagram type: Structure diagram** — Expresses the attribution and communication rules of splitting `AuthoritativeTaskStore` within P5 State & Evidence Plane into 7 Bounded Contexts. Does not express internal SQL table structure and query details of each BC.
>
> **Background**: The legacy `AuthoritativeTaskStore` is a god object (~278 methods + 21 Repositories + ~123 consumers), which needs to be split into independent BCs and communicate through the Event Bus.

### §20.1 BC Attribution Diagram

```text
platform/five-plane-state-evidence/
┌─────────────────────────────────────────────────────────────────────────────┐
│               P5 — AuthoritativeTaskStore 7 BC Split                          │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ BC1 Core Task Engine (~73 methods)                                      │   │
│  │ Repositories: task · workflow · execution · session                   │   │
│  │ Responsibilities: task lifecycle · workflow state · execution mgmt · session control│   │
│  │ Strategy: retain as core — internal method coupling high, no further split│   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────┐  ┌────────────────────────┐                       │
│  │ BC2 Worker Infra     │  │ BC3 Event Infra (~24)  │                       │
│  │ (~47 methods)            │  │ Repo: event             │                       │
│  │ Repos: worker ·      │  │ Responsibilities: event publish · ack · │                       │
│  │  dispatch · lease ·  │  │  DLQ · durable bus ·     │                       │
│  │  lock                │  │  type registry                │                       │
│  │ Responsibilities: dispatch ·     │  │ Strategy: clear boundaries,         │                       │
│  │  lease · dist lock ·   │  │  direct extraction               │                       │
│  │  Worker registration          │  └────────────────────────┘                       │
│  │  Strategy: independent domain extraction      │                                                    │
│  └──────────────────────┘  ┌────────────────────────┐                       │
│                              │ BC4 Billing & Cost     │                       │
│  ┌──────────────────────┐  │ (~29 methods)              │                       │
│  │ BC5 Governance &     │  │ Repo: billing            │                       │
│  │  Compliance (~50)    │  │ Responsibilities: account · invoice ·     │                       │
│  │  Repos: approval ·   │  │  quota · usage · ledger     │                       │
│  │  organization ·      │  │ Strategy: decouple from core execution     │                       │
│  │  secret · compliance│  └────────────────────────┘                       │
│  │  · operations        │                                                    │
│  │ Responsibilities: approval ·     │  ┌────────────────────────┐                       │
│  │  org hierarchy · secret ·   │  │ BC6 Platform & Commerce│                       │
│  │  compliance · ops governance  │  │ (~47 methods)              │                       │
│  │  Strategy: align with L5        │  │ Repos: marketplace ·   │                       │
│  └──────────────────────┘  │  release · division ·  │                       │
│                              │  intelligence ·        │                       │
│  ┌──────────────────────┐  │  evolution              │                       │
│  │ BC7 Memory &         │  │  Strategy: align with L6-L7       │                       │
│  │  Artifacts (~10)     │  └────────────────────────┘                       │
│  │ Repos: memory ·     │                                                    │
│  │  artifact             │                                                    │
│  │ Responsibilities: memory CRUD ·    │                                                    │
│  │  quality mgmt · artifact ·   │                                                    │
│  │  versioning             │                                                    │
│  │  Strategy: align with L4        │                                                    │
│  └──────────────────────┘                                                    │
│                                                                              │
│  ──── Inter-BC Communication Rules ────                                                     │
│  BC1 ◀══ Event Bus (BC3) ══▶ BC2/BC4/BC5/BC6/BC7                           │
│  Direct import between BCs is prohibited; communicate only through events + contracts                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### §20.2 Split Wave Plan

```text
Wave 1 (low risk)    BC3 Event Infra → BC7 Memory & Artifacts
                    Verification gate: all event-related tests pass
                          │
Wave 2 (medium risk) BC4 Billing & Cost → BC2 Worker Infra
                    Verification gate: all dispatch/lease-related tests pass
                          │
Wave 3 (high risk)   BC5 Governance & Compliance → BC6 Platform & Commerce
                    Verification gate: all organization/approval/marketplace tests pass
                          │
Wave 4 (wrap up)      Remove Facade; BC1 Core Task Engine becomes an independent module
                    Verification gate: npm test all pass + stable-* rehearsals pass
```

---

## §21 Cross-cutting Capability Control Plane Diagram

> **Diagram type: Structure diagram** — Expresses how three types of cross-cutting capabilities (X1 Stability · X2 Observability · X3 Security & Compliance) provide unified services across the five planes. Does not express the internal implementation and configuration parameters of each cross-cutting capability.

```text
                    P1 Interface  P2 Control  P3 Orchestr  P4 Execution  P5 State
                    ───────────  ──────────  ───────────  ────────────  ────────
┌──────────────┐
│ X1 Reliability│   sandbox      incident    escalation    circuit-     recovery
│ & Security    │   rate-limit   policy-     replan        breaker      checkpoint
│ Fabric        │   auth-guard   enforcement               timeout      lease
│               │                                           backpressure
├──────────────┤
│ X2 Observ-   │   access-log   config-     oapeflir-     execution-   event-
│ ability       │   request-     audit       trace         resource-    audit
│ Stack         │    trace                                  monitor      projection
│               │   ingress-     sli/slo     step-trace    worker-      rebuild-
│               │    metrics                                health       job-log
├──────────────┤
│ X3 Compliance│   data-        approval-   prompt-       tool-        erasure
│ & Governance  │    residency   sla         injection-    sandbox-     encryption
│               │   field-       org-policy  guard         policy       data-
│               │    encrypt                                            lineage
└──────────────┘

Cross-cutting capability supply methods:
  X1 → platform/shared/stability/ + platform/five-plane-execution/ each BC embedded
  X2 → platform/shared/observability/ unified injection (structured-logger · otel · metrics)
  X3 → platform/compliance/ + org-governance/compliance-engine/
```

---

## §22 Legacy System Modules → New Platform Landing Point Diagram

> **Diagram type: Structure diagram** — Expresses the landing point mapping of 42 modules in legacy `src/core/` migrating to the new platform 7-layer architecture. Does not express migration steps and time order (see §23).

```text
Legacy src/core/ (42 modules)              New platform src/ (7 layers + cross-layer)
═══════════════════════              ═══════════════════════════

types ─────────────────────────────▶ platform/contracts/types
errors ────────────────────────────▶ platform/contracts/errors
constants ─────────────────────────▶ platform/contracts/constants
results ───────────────────────────▶ platform/contracts/result-envelope
utils ─────────────────────────────▶ platform/shared/utils
lifecycle ─────────────────────────▶ platform/shared/lifecycle
cache ─────────────────────────────▶ platform/shared/cache

config ────────────────────────────▶ platform/five-plane-control-plane/config-center (P2)
api ───────────────────────────────▶ platform/five-plane-interface/api (P1)
storage ───────────────────────────▶ platform/five-plane-state-evidence/ (P5, 7 BC split)
events ────────────────────────────▶ platform/five-plane-state-evidence/events (P5 BC3)
locking ───────────────────────────▶ platform/five-plane-execution/ (P4)
queue ─────────────────────────────▶ platform/five-plane-execution/ (P4)
resource ──────────────────────────▶ platform/five-plane-execution/ (P4)

runtime ───────────────────────────▶ platform/five-plane-execution/ (P4, 12 BC split)
agent-loop ────────────────────────▶ platform/five-plane-orchestration/oapeflir (P3)
planning ──────────────────────────▶ platform/five-plane-orchestration/planner (P3)
orchestration ─────────────────────▶ platform/five-plane-orchestration/routing (P3)
providers ─────────────────────────▶ platform/model-gateway/
tools ─────────────────────────────▶ platform/five-plane-execution/tool-gateway/ + tool-executor/
workflow ──────────────────────────▶ platform/five-plane-orchestration/oapeflir/workflow/
artifacts ─────────────────────────▶ platform/five-plane-state-evidence/artifacts (P5 BC7)
feedback ──────────────────────────▶ scale-ecosystem/feedback-loop (L6)
learning ──────────────────────────▶ scale-ecosystem/feedback-loop (L6)
evaluation ────────────────────────▶ platform/five-plane-orchestration/evaluator/ + prompt-engine/eval/

domain-registry ───────────────────▶ domains/registry (L3)
divisions ─────────────────────────▶ domains/governance (L3)
plugins ───────────────────────────▶ plugins/ (cross-layer)

memory ────────────────────────────▶ platform/five-plane-state-evidence/memory/ (L5)
knowledge ─────────────────────────▶ interaction/knowledge (L4, new wrapper)
messages ──────────────────────────▶ interaction/message (L4)
gateway ───────────────────────────▶ platform/interface (P1) + interaction/nl-gw (L4)

security ──────────────────────────▶ platform/five-plane-control-plane/iam/ (L5)
approvals ─────────────────────────▶ org-governance/approval-routing (L5)
compliance ────────────────────────▶ org-governance/compliance-engine (L5)
cost ──────────────────────────────▶ org-governance/cost (L5)
hr ────────────────────────────────▶ org-governance/org-model (L5)

deployment ────────────────────────▶ scale-ecosystem/multi-region (L6)
improvement ───────────────────────▶ scale-ecosystem/feedback-loop (L6)
product ───────────────────────────▶ scale-ecosystem/marketplace (L6)

observability ─────────────────────▶ ops-maturity/observability (L7, new wrapper)
ops ───────────────────────────────▶ ops-maturity/platform-ops-agent (L7)
stability ─────────────────────────▶ ops-maturity/stability (L7, new wrapper)
evolution ─────────────────────────▶ ops-maturity/evolution (L7)
reliability ───────────────────────▶ platform/shared/reliability (L1-2 shared)

cli ───────────────────────────────▶ sdk/cli (cross-layer)
```

### §22.1 Migration Type Statistics

| Mapping Type | Module Count | Description |
|----------|--------|------|
| 1:1 direct migration | ~8 | types, errors, constants, utils, etc. shared kernel |
| 1:1 modification | ~16 | config, api, security, etc. need to adapt to new contracts |
| 1:N split | 2 | runtime (→12 BC) · storage (→7 BC) |
| Semantic redefinition | ~6 | gateway, evaluation, etc. responsibility boundary redrawn |
| Reference only | ~3 | some module code not migrated, design referenced only |

---

## §23 Migration Wave Roadmap

> **Diagram type: Sequence diagram** — Expresses the order and dependency relationships of the ten-phase code migration. Does not express internal task breakdown of each phase.

```text
         P0 Test Helpers (19 files, 0.5 pd)
          │
          ▼
         P1 Shared Kernel — types/errors/constants/utils/results/lifecycle
          │  (68 files, 1.5 pd)
          │
          ▼
         P2 Infra Foundation — storage/events/config/locking/queue/cache
          │  (325 files, 7 pd)
          │
    ┌─────┴─────┐
    ▼           ▼
   P3 Security   P4 AI Ops Primitives
   & Governance   providers/tools/workflow/artifacts
   (141 files,    (163 files, 4.5 pd)
    3.5 pd)       │
    │             │
    └──────┬──────┘
           ▼
          P5 Runtime Core (12 BC split, 4 sub-waves)
           │  (264 files, 10 pd) ← highest risk phase
           │
           ▼
          P6 OAPEFLIR Pipeline
           │  (119 files, 3.5 pd)
           │
     ┌─────┴─────┐
     ▼           ▼
    P7 Interaction  P8 Business Domain
    Layer            domain-registry/divisions/plugins
    (124 files,      (78 files, 2.5 pd)
     4 pd)           │
     │               │
     └───────┬───────┘
             ▼
            P9 Operational Maturity
             │  (271 files, 7 pd)
             │
             ▼
            P10 CLI + E2E + Golden + Perf
                (146 files, 4 pd)

Total: ~1,868 files / ~406K lines / 70-100 person-days
(excluding 24 new module developments)
```

### §23.1 Dual-track Parallel Strategy

```text
Lane A (Migration)           Lane B (New Capability)
═══════════           ═══════════════
P0-P2 ──────────────▶ P0-base: 6 basic new modules (stub interface first)
P3-P5 ──────────────▶ P1-diff: 10 differentiated new modules
P6-P10 ─────────────▶ P2-enhance: 8 enhanced new modules

New modules that can start early (stub interface):
  org-hierarchy (stub single-level organization)
  autonomy (stub minimum autonomy level)
  nl-gateway (stub pass-through mode)

New modules that must wait for migration completion:
  agent-lifecycle (depends on P6 OAPEFLIR)
  multi-region (depends on P5 HA Coordinator)
  marketplace (depends on P8 domain-registry)
```

---

## §24 Interaction · Governance · Platform Three-Axis Collaboration Diagram

> **Diagram type: Data flow diagram** — Expresses the collaboration signal flow between the three main system axes: interaction (L4) · org-governance (L5) · platform (L1-2). Does not express the call relationships between modules within each axis.

```text
                         ┌──────────────────────┐
                         │   interaction/ (L4)   │
                         │   Intelligent Interaction Layer           │
                         │   nl-gateway           │
                         │   goal-decomposer      │
                         │   proactive-agent      │
                         │   autonomy             │
                         │   dashboard · ux       │
                         └──────────┬─────────────┘
                                    │
               Task request (NL parsed) │  ▲ Status push (dashboard subscribes to P5 events)
                                    │  │
                                    ▼  │
┌──────────────────────┐  Contract call  ┌──┴───────────────────────────────────┐
│  org-governance/ (L5)│ ◀════════▶│           platform/ (L1-2)           │
│  Organizational Gov Layer           │           │           Platform Core                    │
│                       │           │                                      │
│  org-model            │ SSO ID  │  P1 Interface ──▶ P2 Control        │
│  approval-routing ────┼──────────▶│  P2 ──▶ P3 Orchestration            │
│  sso-scim             │ Approval result  │  P3 ──▶ P4 Execution                │
│  compliance-engine ───┼──────────▶│  P4 ──▶ P5 State & Evidence         │
│  knowledge-boundary   │ Compliance policy  │                                      │
│  delegated-governance │           │  AI Runtime Support Stack            │
│                       │           │  (model-gw · prompt · compliance)   │
└──────────────────────┘           │                                      │
                                    └─────────────────────────────────────┘

Signal flow description:
  interaction/ ══task══▶ platform/P1 (user request entry)
  interaction/ ◀══event══ platform/P5 (dashboard data source)
  org-governance/ ══identity══▶ platform/P2/iam (SSO/SCIM sync)
  org-governance/ ══approval══▶ platform/P3/hitl (approval result writeback)
  org-governance/ ══policy══▶ platform/P2/policy-center (compliance policy issuance)
  platform/ ══query══▶ org-governance/knowledge-boundary (knowledge isolation control)

Three-axis collaboration invariants:
  1. interaction/ and org-governance/ do not communicate directly; relayed through platform/
  2. platform/ does not actively call upper-layer systems; only notifies through events
  3. All cross-axis communication uses envelope format defined by platform/contracts/
```

---

## §25 Cross-platform UI Monorepo and Frontend-Backend Boundary Diagram

> **Diagram type: Structure diagram + Constraint diagram** — Expresses the module attribution, six-platform shells, and frontend-backend dependency boundaries of `ui/` Monorepo. Does not express specific page layout.

```text
ui/
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Cross-platform UI Monorepo                           │
│                                                                              │
│  ┌────────────────────────── apps/ Six-Platform Shells ──────────────────────┐       │
│  │  web/        electron-win/      tauri-macos/      tauri-linux/   │       │
│  │  React SPA   Windows shell      macOS shell       Linux shell     │       │
│  │  mobile/     React Native shell                                  │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                  │ Provider injection                              │
│                                  ▼                                           │
│  ┌──────────────────────── shared/ Frontend Core ────────────────────────┐       │
│  │ api-client/ · auth/ · state/ · sync/ · domain/ · platform/        │       │
│  │ i18n/ · telemetry/ · nl-client/ · types/                          │       │
│  │                                                                  │       │
│  │ PlatformAdapter: network · secureStorage · filesystem · clipboard │       │
│  │ lifecycle · shell · deepLink · screenSecurity · haptics           │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                  │ DTO → VM → Props                           │
│                                  ▼                                           │
│  ┌──────────────────────── packages/features/ ──────────────────────┐       │
│  │ dashboard · task-cockpit · workflow-cockpit · approval · hitl     │       │
│  │ settings · domain-wizard · stability · takeover · alerts          │       │
│  │ dispatch · inspect · health · incidents · conversation            │       │
│  │ feature-flags · agent-manager · workflow-builder/debugger         │       │
│  │ explainability · cost-center · marketplace · analytics · governance│      │
│  │                                                                  │       │
│  │ Each feature: web/ · mobile/ · hooks/ · mapper · route · guard    │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                  │                                           │
│  ┌──────────────────────── UI Base Components ─────────────────────────────┐       │
│  │ ui-core/  Web/desktop design system · charts · layout · business widgets   │       │
│  │ ui-mobile/ Mobile components · native-module seam · navigation           │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                  │                                           │
│  ┌──────────────────────── tools + tests ───────────────────────────┐       │
│  │ codegen/ · mock-server/ · e2e/                                    │       │
│  │ tests/unit · integration · features · apps · a11y · playwright    │       │
│  └──────────────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘

Frontend-backend boundary:
  ui/ ──allowed──▶ public API / OpenAPI / generated schemas / typed mock seam
  ui/ ──prohibited──▶ src/platform/* internal implementation, truth store, worker runtime, private service
  feature ──allowed──▶ shared/api-client + hooks returning VM
  feature ──prohibited──▶ directly consume backend DTO or directly call Electron/Tauri/RN API
```

---

## §26 Mission · Yono · Testing/Deployment Support Increment Diagram

> **Diagram type: Structure diagram** — Expresses the new authoritative modules discovered in the v1.3 code structure review, and their attribution relationships with the original seven layers/five planes.

```text
v1.3 Increment Structure
┌─────────────────────────────────────────────────────────────────────────────┐
│  Mission Long-term Goal Governance                                                        │
│                                                                              │
│  platform/contracts/mission/             platform/five-plane-control-plane/mission/
│  ┌──────────────────────────┐            ┌──────────────────────────────┐  │
│  │ MissionRecord            │            │ MissionLifecycleService       │  │
│  │ MissionMembership        │            │ MissionResolver               │  │
│  │ ContextSnapshot          │◀──────────▶│ MissionGovernanceService      │  │
│  │ BudgetEnvelope           │            │ MissionBudgetService          │  │
│  │ Error/Event payload      │            │ MissionLiveGuard / Handoff    │  │
│  └──────────────────────────┘            └──────────────────────────────┘  │
│            │                                            │                   │
│            │ missionRef / snapshotRef                    │ fail-close        │
│            ▼                                            ▼                   │
│      P3 Harness / PlanGraph ───────────────▶ P4 NodeRun / Tool / Provider   │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Yono Business Domain                                                        │
│                                                                              │
│  domains/yono/                                                               │
│  ┌──────────────────────────┐                                                │
│  │ DomainDescriptor          │──▶ registry/                                  │
│  │ workflow/risk/eval/SLA    │──▶ platform/P3/P4                             │
│  │ tool bundle / ownership   │──▶ org-governance + control-plane             │
│  └──────────────────────────┘                                                │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Testing and Deployment Support                                                              │
│                                                                              │
│  src/testing/        tests/invariants/       tests/leaks/                    │
│  Test Commons        Arch Invariant Guard    Memory/Handle Leak Detect     │
│                                                                              │
│  src/benchmarks/     tests/performance/     deploy/                          │
│  Perf Entry          Cap/Perf Bench         Helm · Terraform · Prometheus · Chaos │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Appendix A: Module Statistics Summary

> Statistics calibration: 2026-05-18 current workspace structure snapshot; detailed numbers see `01-code-structure.md` v1.3. Historical planning estimates are no longer used as admission criteria.

| Top-level Directory | Layer | Current Structure Status | Key Additions/Calibrations |
|----------|------|--------------|----------------|
| `platform/` | Layer 1-2 | Authoritative core | Mission, outbox, side-effect-ledger, reconciliation, degradation |
| `domains/` | Layer 3 | Expanded | `yono/` as a business domain instance |
| `interaction/` | Layer 4 | Expanded | dashboard/autonomy/goal/nl/proactive/ux |
| `org-governance/` | Layer 5 | Expanded | approval-routing, SSO/SCIM, delegated governance |
| `scale-ecosystem/` | Layer 6 | Expanded | marketplace, billing, SLA, multi-region, runtime-services |
| `ops-maturity/` | Layer 7 | Expanded | chaos, capacity, edge, debugger, explainability |
| `plugins/` | Cross-layer | Stable | Plugin ecosystem |
| `sdk/` | Cross-layer | Expanded | CLI, admin/harness/workbench SDK |
| `apps/` | Entry | Stable | Backend composition startup |
| `ui/` | Frontend | New authoritative | Web/Electron/Tauri/Mobile + packages/features/shared |
| `tests/` | Test | Expanded | unit/integration/e2e/golden/performance/invariants/leaks |
| `src/testing/` / `src/benchmarks/` | Support | New/calibrated | Test infrastructure and perf entry |

## Appendix B: High-risk Split Statistics

| Split Target | Bounded Contexts | Methods/File Count | Estimated Effort |
|----------|-----------------|------------|----------|
| P4 `core/runtime/` | 12 BC | 101 files / 30K lines | ~20 person-days |
| P5 `AuthoritativeTaskStore` | 7 BC | ~278 methods / 21 repos | ~20 person-days |

## Appendix C: Diagram Collection Index

| Section | Diagram Type | v1.3 Change Description |
|------|--------|--------------|
| §1 | Structure diagram | Fix visual weight; divide into three visual bands |
| §2 | Data flow diagram | Mark AI operations as parallel support |
| §3 | Structure diagram | Split into 3 responsibility areas |
| §4 | Structure diagram | Reorganize into 4 areas |
| §5 | Structure diagram | Add module boundary rules table |
| §6 | Structure + sequence diagram | Split into 3 independent diagrams |
| §7 | Structure diagram | **Rewritten**: 7 BC groups + Truth/Derived/Evidence three zones |
| §8 | Structure diagram | **Rewritten**: Renamed + parallel support positioning description |
| §9 | Data flow diagram | **Rewritten**: Upgraded to platform protocol diagram + protocol chain linkage |
| §10-§15 | Structure diagram | Add "expresses/does not express" statement |
| §16 | Data flow diagram | Add "expresses/does not express" statement |
| §17 | Constraint diagram | Add "expresses/does not express" statement |
| §18 | Structure diagram | Add "expresses/does not express" statement |
| §19 | Structure diagram | **New**: P4 Runtime 12 BC specialized diagram |
| §20 | Structure diagram | **New**: P5 Storage 7 BC specialized diagram |
| §21 | Structure diagram | **New**: Cross-cutting capability control plane diagram |
| §22 | Structure diagram | **New**: Legacy system → new platform landing point diagram |
| §23 | Sequence diagram | **New**: Migration wave roadmap |
| §24 | Data flow diagram | **New**: Three-axis collaboration diagram |
| §25 | Structure + constraint diagram | **New**: Cross-platform UI Monorepo and frontend-backend boundary |
| §26 | Structure diagram | **New**: Mission · Yono · testing/deployment support increment diagram |
