# Automatic Agent Platform — Module Framework Diagram Collection

> **Version**: v1.5
> **Date**: 2026-05-26
> **Companion Docs**: `00-platform-architecture.md` v2.7 · `01-code-structure.md` · `02-code-architecture-reference.md`
> **Description**: This document presents system-wide views and internal structure/interaction relationships of each layer and module in ASCII framework diagram format. v1.5 has synchronized recent interface layer, federation governance, Mission/UI contracts, and execution/state evidence facade layer writeback.

### Diagram Type Conventions

Each diagram in this document is annotated with its type, which readers should use to understand its scope of expression:

| Diagram Type | Meaning | Expresses | Does Not Express |
|--------------|---------|----------|-----------------|
| **Structure diagram** | Module ownership and logical boundaries | Which plane/layer a module belongs to | Runtime invocation order |
| **Data flow diagram** | Runtime data/control signal flow | Signal transmission direction and protocol | Module internal implementation |
| **Dependency diagram** | Code-level import direction | Who can depend on whom | Runtime sequencing |
| **Sequence diagram** | Runtime execution order | Step sequence | Module ownership |
| **Constraint diagram** | Architectural rules and prohibitions | Allowed/prohibited dependency directions | Specific invocation relationships |

### Naming Convention Unification

The following names are used consistently across this document, `01-code-structure.md`, and `02-code-architecture-reference.md`:

| Unified Name | Unused Aliases |
|--------------|----------------|
| `emergency/` | emergency-brake/ |
| `workflow-debugger/` | debug-ui/ |
| `platform-ops-agent/` | self-ops-agent/ |
| `resource-manager/` | resource-scheduler/ |
| `goal-decomposer/` | goal-decomposition/ |

### Statistics Scope Declaration

> Historical diagrams in this document still retain some planning-level figures; v1.5 new or rewritten statistics are **2026-05-26 current workspace structure snapshots**. Accurate file counts should follow subsequent structure inventory scripts.

### This Round Diagram Sync Focus (2026-05-26)

1. P1 has continued to converge from "only admin/internal queries" to "public Layer C `/v1/*` query surface + admin/internal management surface coexisting".
2. `scale-ecosystem/federation/` is now viewed as persistent governance capability, no longer understood as pure in-memory spec diagram.
3. `ui/` Electron bridge has entered formal compatibility contract, not just shell placeholder.
4. P3/P4/P5 have been supplemented with actual implemented module authority for `full-trajectory-evaluator`, `tool-gateway`, `sandbox-provider`, `memory-gateway`, `receipts`, `shared/reliability`, etc.

---

## Table of Contents

| Section | Diagram Type | Content |
|---------|--------------|---------|
| §1 | Structure diagram | System overview framework (seven layers + five planes + cross-layer) |
| §2 | Data flow diagram | Layer 1-2 `platform/` five-plane backbone protocol flow |
| §3 | Structure diagram | P1 Interface Plane module ownership diagram |
| §4 | Structure diagram | P2 Control Plane module ownership diagram |
| §5 | Structure diagram | P3 Orchestration Plane module ownership diagram |
| §6 | Structure diagram + Sequence diagram | P4 Execution Plane (BC framework + execution sequence + tool security) |
| §7 | Structure diagram | P5 State & Evidence Plane (grouped by Bounded Context) |
| §8 | Structure diagram | AI Runtime Support Stack (Model Gateway · Prompt Engine · Compliance) |
| §9 | Data flow diagram | Platform protocol diagram (Contracts cross-plane protocol chain + Shared infrastructure) |
| §10 | Structure diagram | Layer 3 `domains/` business domain access layer |
| §11 | Structure diagram | Layer 4 `interaction/` intelligent interaction layer |
| §12 | Structure diagram | Layer 5 `org-governance/` organization governance layer |
| §13 | Structure diagram | Layer 6 `scale-ecosystem/` scale ecosystem + ecology layer |
| §14 | Structure diagram | Layer 7 `ops-maturity/` operations maturity layer |
| §15 | Structure diagram | Cross-layer modules (plugins · sdk · apps) |
| §16 | Data flow diagram | End-to-end data flow overview diagram |
| §17 | Constraint diagram | Dependency direction and layering constraints |
| §18 | Structure diagram | Stability seven-layer model |
| §19 | Structure diagram | P4 Runtime Bounded Context special diagram |
| §20 | Structure diagram | P5 Storage Bounded Context special diagram |
| §21 | Structure diagram | Cross-cutting capability control plane diagram |
| §22 | Structure diagram | Old system modules → new platform landing diagram |
| §23 | Sequence diagram | Migration wave roadmap |
| §24 | Data flow diagram | Interaction · Governance · Platform three-axis collaboration diagram |
| §25 | Structure diagram + Constraint diagram | Cross-platform UI Monorepo and frontend/backend boundary |
| §26 | Structure diagram | Mission · Yono · Test/Deployment support incremental diagram |

---

## §1 System Overview Framework Diagram

> **Diagram type: Structure diagram** — Expresses the logical ownership relationship of seven layers + five planes + cross-layer. Does not express runtime invocation order.
>
> **Key understanding**: `platform/` is the foundational kernel; `interaction/` · `org-governance/` · `scale-ecosystem/` · `ops-maturity/` are **independent upper-layer systems** (not sub-components of platform); they interact with the kernel through contracts and events.

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Automatic Agent Platform v2.7                          │
│                                                                                 │
│  ╔═══════════════════════════════════════════════════════════════════════════╗  │
│  ║  Layer 7: Operations Maturity Layer  ops-maturity/      ← Independent    ║  │
│  ║  upper-layer system                                                        ║  │
│  ║  Explainability · Emergency Brake · Agent Lifecycle · Edge · Drift ·       ║  │
│  ║  Cost · Debug · Compliance                                                 ║  │
│  ╠═══════════════════════════════════════════════════════════════════════════╣  │
│  ║  Layer 6: Scale Ecosystem  scale-ecosystem/       ← Independent upper-  ║  │
│  ║  layer system                                                              ║  │
│  ║  Multi-Region · Resource Competition · SLA · Agent Marketplace ·         ║  │
│  ║  Feedback & Improvement · External Integration                              ║  │
│  ╠═══════════════════════════════════════════════════════════════════════════╣  │
│  ║  Layer 5: Organization Governance  org-governance/  ← Independent upper- ║  │
│  ║  layer system                                                              ║  │
│  ║  Org Hierarchy · Approval Routing · SSO/SCIM · Compliance Engine ·       ║  │
│  ║  Knowledge Isolation · Governance Delegation                              ║  │
│  ╠═══════════════════════════════════════════════════════════════════════════╣  │
│  ║  Layer 4: Intelligent Interaction  interaction/  ← Independent upper-    ║  │
│  ║  layer system                                                             ║  │
│  ║  NL Entry · Goal Decomposition · Proactive Agent · Progressive Autonomy · ║  │
│  ║  Ops Dashboard · UX                                                       ║  │
│  ╠═══════════════════════════════════════════════════════════════════════════╣  │
│  ║  Layer 3: Business Domain Access Layer  domains/  ← Independent upper-  ║  │
│  ║  layer system                                                             ║  │
│  ║  Domain Registry · Risk Profile · Knowledge Structure · Eval Framework ·  ║  │
│  ║  Prompt Library · Recipe · Governance                                      ║  │
│  ╚═══════════════════════════════════════════════════════════════════════════╝  │
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  Layer 1-2: Infrastructure + AI Operations  platform/  ← Platform kernel │  │
│  │                                                                           │  │
│  │  ┌────── Five-plane main kernel ──────────────────────────────────────┐  │  │
│  │  │  P1 Interface │ P2 Control │ P3 Orchestrate │ P4 Execution │ P5 State │ │  │
│  │  └───────────────────────────────────────────────────────────────────┘  │  │
│  │  ┌────── AI Operations side car ─────────────────────────────────────┐  │  │
│  │  │  model-gateway/ · prompt-engine/ · compliance/                     │  │  │
│  │  └───────────────────────────────────────────────────────────────────┘  │  │
│  │  ┌────── Cross-cutting foundation ───────────────────────────────────┐  │  │
│  │  │  contracts/ · shared/ (utils · lifecycle · cache · obs · stability) │  │  │
│  │  └───────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                          │
│  │   plugins/   │  │     sdk/     │  │    apps/     │   ← Cross-layer modules   │
│  │  Plugin      │  │ SDK & DevEx  │  │ App entry    │                           │
│  │  ecosystem   │  │              │  │ points       │                           │
│  └──────────────┘  └──────────────┘  └──────────────┘                          │
│                                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   tests/     │  │   config/    │  │  divisions/  │  │    doc/      │        │
│  │ Test images  │  │ Versioned    │  │ Business     │  │ Design &     │        │
│  │ for src      │  │ config       │  │ division     │  │ contracts    │        │
│  │              │  │               │  │ definitions  │  │              │        │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### X1 Reliability & Security Fabric Definition

X1 is not a separate directory, but rather a **cross-cutting capability band** composed of the following modules, spanning all five planes and seven layers:

| Capability | Implementation Location |
|------------|-------------------------|
| AuthN/Z · Sandbox | `platform/five-plane-control-plane/iam/` |
| Circuit Breaker | `platform/model-gateway/provider-registry/` · `platform/shared/stability/` |
| Rate Limit · Backpressure | `platform/five-plane-interface/ingress/` · `platform/five-plane-execution/dispatcher/` |
| DLQ | `platform/five-plane-state-evidence/dlq/` |
| Secrets · Egress | `platform/five-plane-control-plane/iam/` |
| Observability | `platform/shared/observability/` |
| Recovery · Stability Rehearsal | `platform/five-plane-execution/recovery/` · `platform/shared/stability/` |
| Policy · Compliance | `platform/five-plane-control-plane/policy-center/` · `platform/compliance/` |

---

## §2 Layer 1-2 `platform/` Five-plane Backbone Protocol Flow

> **Diagram type: Data flow diagram** — Expresses the main protocol transmission direction between the five planes, and the lateral support relationship of AI operations modules. Does not express module internal implementation details.

```text
platform/
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │  P1 Interface Plane                                              │      │
│   │  api/ · webhook/ · channel-gateway/ · scheduler/                 │      │
│   │  console-backend/ · ingress/                                     │      │
│   └────────────────────────────────┬─────────────────────────────────┘      │
│                                    │ request-envelope                       │
│   ┌────────────────────────────────▼─────────────────────────────────┐      │
│   │  P2 Control Plane                                                │      │
│   │  tenant/ · iam/ · policy-center/ · approval-center/              │      │
│   │  rollout-controller/ · incident-control/ · replay-repair/       │      │
│   │  config-center/ · audit-export/                                  │      │
│   └────────────────────────────────┬─────────────────────────────────┘      │
│                                    │ control-directive                      │
│   ┌────────────────────────────────▼─────────────────────────────────┐      │
│   │  P3 Orchestration Plane  ◀╌╌╌╌╌╌┐                              │      │
│   │  oapeflir/ · planner/ · replan/ · routing/ │ · escalation/ · hitl │      │
│   └────────────────────────────────┬──────────│──────────────────────┘      │
│                                    │ exec-plan│                             │
│   ┌────────────────────────────────▼──────────│──────────────────────┐      │
│   │  P4 Execution Plane  ◀╌╌╌╌╌╌╌╌╌┘                              │      │
│   │  dispatcher/ · lease/ · worker-pool/ · execution-engine/        │      │
│   │  state-transition/ · ha/ · hot-upgrade/ · recovery/             │      │
│   │  tool-executor/ · plugin-executor/ · distributed-lock/           │      │
│   │  queue/ · resource/ · startup/                                  │      │
│   └────────────────────────────────┬─────────────────────────────────┘      │
│                                    │ state-command / execution-receipt      │
│   ┌────────────────────────────────▼─────────────────────────────────┐      │
│   │  P5 State & Evidence Plane                                       │      │
│   │  truth/ · events/ · projections/ · artifacts/ · memory/         │      │
│   │  knowledge/ · audit/ · incident/ · checkpoints/ · dlq/          │      │
│   └──────────────────────────────────────────────────────────────────┘      │
│                                                                             │
│   ┌───── AI Operations (parallel support, non-linear main chain, deeply ──┐ │
│   │      embedded across planes)                                         │      │
│   │  model-gateway/       │  prompt-engine/  │  compliance/             │      │
│   │  Provider·Router·Cost │  Registry·Render │  Erasure·Encrypt         │      │
│   │  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌   │      │
│   │  Lateral support relationships:                                    │      │
│   │  P3/P4 ◀╌╌╌▶ model-gateway  (model routing + circuit breaker)    │      │
│   │  P3    ◀╌╌╌▶ prompt-engine  (Prompt rendering + evaluation)      │      │
│   │  P2/P5 ◀╌╌╌▶ compliance     (data compliance + audit)            │      │
│   └──────────────────────────────────────────────────────────────────┘      │
│                                                                             │
│   ┌─────────────────────── Cross-plane foundation ─────────────────────────┐ │
│   │  contracts/ (types · errors · envelopes · directives)             │      │
│   │  shared/    (utils · lifecycle · cache · observability · stability)│     │
│   └──────────────────────────────────────────────────────────────────┘      │
│                                                                             │
│   ═══════ X1 Reliability & Security Fabric (crosscuts all layers, see §1) ═══════   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §3 P1 Interface Plane Module Ownership Diagram

> **Diagram type: Structure diagram** — Expresses P1 internal module ownership and the division of three responsibility areas. Does not express runtime invocation order or code dependencies.

```text
platform/five-plane-interface/
┌─────────────────────────────────────────────────────────────────────┐
│                       P1 Interface Plane                             │
│                                                                      │
│  ┌─────────── A. Ingress & Transport (Protocol Entry) ──────────────┐│
│  │                                                              │     │
│  │  ┌───────────────┐  ┌──────────────┐  ┌───────────────┐    │     │
│  │  │    api/        │  │  webhook/    │  │   ingress/    │    │     │
│  │  │  http-server   │  │  inbound     │  │  rate-limit   │    │     │
│  │  │  routes        │  │  parser       │  │  routing      │    │     │
│  │  │  oidc/oauth    │  │  verify       │  │  canary       │    │     │
│  │  │  websocket     │  │  dispatch     │  └───────────────┘    │     │
│  │  └───────────────┘  └──────────────┘                        │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌─────────── B. Channel Delivery ───────────────────────────────┐│
│  │                                                              │     │
│  │  ┌───────────────────────────┐                              │     │
│  │  │   channel-gateway/        │                              │     │
│  │  │   telegram · slack        │                              │     │
│  │  │   webhook-out · sse       │                              │     │
│  │  └───────────────────────────┘                              │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌─────────── C. Operator Backend ──────────────────────────────┐│
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
│  External requests ──▶ ingress ──▶ api/webhook/channel-gateway     │
│  scheduler ──▶ P3 (scheduled triggers)                               │
│  console-backend ──▶ P5 (queries) + P2 (control)                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## §4 P2 Control Plane Module Ownership Diagram

> **Diagram type: Structure diagram** — Expresses P2 internal module ownership and four responsibility areas. Does not express runtime invocation order.

```text
platform/five-plane-control-plane/
┌─────────────────────────────────────────────────────────────────────────────┐
│                            P2 Control Plane                                  │
│                                                                              │
│  ┌──────── A. Governance ──────────────────────────────────────────────┐   │
│  │  ┌──────────────┐  ┌────────────────────┐  ┌──────────────┐        │   │
│  │  │   tenant/    │  │   policy-center/   │  │approval-ctr/ │        │   │
│  │  │  Tenant mgmt  │  │   Policy center    │  │  Approval    │        │   │
│  │  │  CRUD/quota/  │  │  risk-level/        │  │  center      │        │   │
│  │  │  billing      │  │  security/comply    │  │  flow/route/ │        │   │
│  │  └──────────────┘  └────────────────────┘  └──────────────┘        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────── B. Security & Access ───────────────────────────────────────┐   │
│  │  ┌─────────────────────────────────────────────────────────┐        │   │
│  │  │                     iam/                                  │        │   │
│  │  │  sandbox-policy · policy-engine · field-encrypt          │        │   │
│  │  │  data-classify · audit-event · secret-mgmt               │        │   │
│  │  │  network-egress · cve-intel · trusted-context-scanner    │        │   │
│  │  └─────────────────────────────────────────────────────────┘        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────── C. Release & Ops Control ────────────────────────────────────┐   │
│  │  ┌────────────────────┐  ┌──────────────────────────────────┐       │   │
│  │  │rollout-controller/ │  │      incident-control/           │       │   │
│  │  │  traffic-route     │  │  ┌──────────┐ ┌──────────────┐  │       │   │
│  │  │  canary            │  │  │doctor    │ │deployment    │  │       │   │
│  │  │  auto-rollback     │  │  │takeover  │ │stop-loss     │  │       │   │
│  │  └────────────────────┘  │  │ops-gov   │ │release-pipe  │  │       │   │
│  │  ┌────────────────────┐  │  └──────────┘ └──────────────┘  │       │   │
│  │  │replay-repair-ctrl/ │  └──────────────────────────────────┘       │   │
│  │  │  Replay repair     │                                          │       │
│  │  │  control           │                                          │       │
│  │  └────────────────────┘                                           │       │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────── D. Config & Audit ───────────────────────────────────────────┐   │
│  │  ┌──────────────┐  ┌──────────────┐                               │   │
│  │  │config-center/│  │audit-export/ │                               │   │
│  │  │  runtime/env  │  │  Audit export │                               │   │
│  │  │  provider/   │  └──────────────┘                               │   │
│  │  │  model/billing│                                                │   │
│  │  └──────────────┘                                                 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Control flow:                                                           │
│  P1 ──▶ iam authentication ──▶ policy evaluation ──▶ approval           │
│  ──▶ generate control-directive ──▶ P3                                   │
│  incident-ctrl ◀── P5 events (anomaly triggers control)                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §5 P3 Orchestration Plane Module Ownership Diagram

> **Diagram type: Structure diagram** — Expresses P3 internal module ownership and collaboration direction. Does not express runtime invocation order or code dependencies.

### P3 Module Boundary Rules

| Module | Responsibility | Decides What |
|--------|---------------|--------------|
| `routing/` | Task routing | "Who does it" (select Agent/Team/Workflow) |
| `planner/` | Task decomposition | "How to split" (DAG decomposition + strategy selection) |
| `oapeflir/` | Cognitive loop | "How to loop, execute and learn" (8-phase controlled kernel) |
| `hitl/` | Human-machine collaboration | "Control nodes requiring human participation" (approval/takeover/explanation) |
| `replan/` | Re-planning | "How to adjust when context changes" |
| `escalation/` | Escalation handling | "How to escalate when exceptions exceed current capability" |

```text
platform/five-plane-orchestration/
┌─────────────────────────────────────────────────────────────────────────────┐
│                       P3 Orchestration Plane                                 │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐        │
│  │  oapeflir/  OAPEFLIR Controlled Cognitive Kernel                │        │
│  │                                                                    │        │
│  │  O ──▶ A ──▶ P ──▶ E ──▶ F ──▶ L ──▶ I ──▶ R                    │        │
│  │  Observe  Analyze  Plan  Execute  Feedback  Learn  Improve  Rollout│     │
│  │                                                                    │        │
│  │  ┌──────────┐  ┌────────────────┐  ┌───────────────────┐         │        │
│  │  │workflow/ │  │    learn/      │  │ improve-rollout/  │         │        │
│  │  └──────────┘  └────────────────┘  └───────────────────┘         │        │
│  └──────────────────────────────────────────────────────────────────┘        │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   routing/   │  │   planner/   │  │ escalation/  │  │   replan/    │    │
│  │  "Who does" │  │  "How split" │  │  "How to     │  │  "How to     │    │
│  │              │  │              │  │  escalate"  │  │  adjust"     │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
│  ┌──────────────┐                                                         │
│  │    hitl/     │  Orchestration flow:                                     │
│  │  "Requires  │  control-directive ──▶ routing ──▶ planner ──▶ oapeflir   │
│  │  human"     │  ──▶ generate execution-plan ──▶ P4                       │
│  └──────────────┘  Exception ──▶ escalation / replan                      │
│                     Requires human ──▶ hitl ──▶ P1 push                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §6 P4 Execution Plane Module Framework Diagram

> P4 is the plane with the most modules; the following three different types of diagrams are used to show it.

### §6.1 P4 Bounded Context Framework Diagram

> **Diagram type: Structure diagram** — Expresses the ownership and grouping of 14 BC-level modules within P4. Does not express runtime invocation order.

```text
platform/five-plane-execution/
┌─────────────────────────────────────────────────────────────────────┐
│  ┌────── Scheduling & Worker ──────────────────────────────────┐      │
│  │  dispatcher/  │  lease/  │  worker-pool/                    │      │
│  └───────────────────────────────────────────────────────────────┘      │
│  ┌────── Execution Engine ──────────────────────────────────────┐      │
│  │  execution-engine/  │  state-transition/                     │      │
│  └───────────────────────────────────────────────────────────────┘      │
│  ┌────── Reliability ────────────────────────────────────────────┐      │
│  │  ha/  │  hot-upgrade/  │  recovery/                           │      │
│  └───────────────────────────────────────────────────────────────┘      │
│  ┌────── Tools & Plugins ────────────────────────────────────────┐      │
│  │  tool-executor/  │  plugin-executor/                          │      │
│  └───────────────────────────────────────────────────────────────┘      │
│  ┌────── Infrastructure ──────────────────────────────────────────┐      │
│  │  distributed-lock/  │  queue/  │  resource/  │  startup/     │      │
│  └───────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

### §6.2 P4 Execution Sequence Diagram

> **Diagram type: Sequence diagram** — Expresses the runtime step sequence of a single task execution. Does not express module ownership or code dependencies.

```text
execution-plan (from P3)
    │
    ▼
dispatcher ─── Admission control + priority sorting
    │
    ▼
lease ──────── Allocate execution lease
    │
    ▼
worker-pool ── Select target Worker + handshake
    │
    ▼
execution-engine ── agent-executor → model-call → tool/plugin invocation
    │                   │
    │                   ├── loop-detect (infinite loop detection)
    │                   ├── effect-buffer (side effect buffer)
    │                   └── context-compact (context compression)
    │
    ▼
state-transition ── State machine drives state changes
    │
    ▼
P5 ◀── state-command (persistence)
P3 ◀── execution-receipt (receipt)

Exception paths:
    stalled-detect ──▶ recovery ──▶ replay/repair
    region-fail ──▶ ha ──▶ failover
    version-change ──▶ hot-upgrade ──▶ graceful-migrate
```

### §6.3 P4 Tool Invocation Security Diagram

> **Diagram type: Data flow diagram** — Expresses security control points in the tool invocation chain. Does not express module ownership.

```text
execution-engine
    │
    ▼
tool-executor
    ├── command-security ──── Command security validation
    ├── tool-contract-validator ── Contract compliance check
    ├── tool-path-scope ──── Path scope restriction
    ├── tool-output-sanitizer ── Output sanitization
    ├── mcp-tool-guard ──── MCP protocol guard
    └── role-tool-exposure ── Role tool visibility

plugin-executor
    ├── runtime-sandbox ──── Sandbox isolated execution
    ├── plugin-host ──── Subprocess host
    └── plugin-protocol ──── Communication protocol guard
```

---

## §7 P5 State & Evidence Plane Module Ownership Diagram

> **Diagram type: Structure diagram** — Expresses P5 internal module ownership grouped by 7 Bounded Contexts, and the Truth / Derived / Evidence three-tier data partition. Does not express runtime read/write sequencing or specific table structures.

### §7.1 BC Grouping Structure Diagram

```text
platform/five-plane-state-evidence/
┌─────────────────────────────────────────────────────────────────────────────┐
│                     P5 State & Evidence Plane                                │
│                                                                              │
│  ════════════════════ Zone A: Truth Zone ════════════════════                │
│  (Transactional consistency; write path: P4 state-command ──▶ truth + event  │
│  same-transaction commit)                                                     │
│                                                                              │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │  BC1 Core Task Engine  (~73 methods)│  │  BC2 Worker Infrastructure(~47) │  │
│  │  task · workflow · execution ·    │  │  worker · dispatch · lease ·     │  │
│  │  session                        │  │  lock                           │  │
│  │  ─────────────────────────────  │  │  ─────────────────────────────  │  │
│  │  Task lifecycle · Workflow state │  │  Scheduling allocation · Lease  │  │
│  │  · Execution management ·        │  │  acquire/renewal · Distributed  │  │
│  │  Session control               │  │  lock · Worker registration     │  │
│  └─────────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │  BC3 Event Infrastructure (~24)  │  │  BC4 Billing & Cost (~29)         │  │
│  │  event                           │  │  billing                        │  │
│  │  ─────────────────────────────  │  │  ─────────────────────────────  │  │
│  │  Event publish · Acknowledge ·   │  │  Account · Invoice · Quota ·     │  │
│  │  DLQ management · Persistent bus │  │  Usage · Ledger · Entitlements    │  │
│  │  · Type registration            │  │                                 │  │
│  └─────────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │  BC5 Governance & Compliance    │  │  BC6 Platform & Commerce (~47)   │  │
│  │  (~50)                           │  │  marketplace · release ·        │  │
│  │  approval · organization ·       │  │  division · intelligence ·       │  │
│  │  secret · compliance · ops      │  │  evolution                      │  │
│  │  ─────────────────────────────  │  │  ─────────────────────────────  │  │
│  │  Approval routing · Org         │  │  Marketplace listing · Release   │  │
│  │  hierarchy · Secret mgmt ·      │  │  lifecycle · Division mgmt ·     │  │
│  │  Compliance policy · Ops         │  │  Analytics · Evolution proposals │  │
│  │  governance                     │  │                                 │  │
│  └─────────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────┐                                        │
│  │  BC7 Memory & Artifacts (~10)   │                                        │
│  │  memory · artifact               │                                        │
│  │  ─────────────────────────────  │                                        │
│  │  Memory CRUD + quality mgmt ·   │                                        │
│  │  Artifact storage · Version mgmt │                                        │
│  └─────────────────────────────────┘                                        │
│                                                                              │
│  ════════════════════ Zone B: Derived Query Zone ═════════════════════       │
│  (Eventual consistency; derived from Truth event stream; idempotent rebuild; │
│  does not reflect truth)                                                     │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                       │
│  │projections/  │  │  knowledge/  │  │  incident/   │                       │
│  │ Query        │  │  Knowledge   │  │  Event       │                       │
│  │ projection   │  │  retrieval   │  │  aggregation │                       │
│  │ view         │  │  semantic    │  │  record      │                       │
│  │ rebuild      │  │  keyword     │  │  timeline    │                       │
│  │ event-id     │  │  ingest      │  │              │                       │
│  │ dedup        │  │             │  │              │                       │
│  └──────────────┘  └──────────────┘  └──────────────┘                       │
│                                                                              │
│  ════════════════════ Zone C: Evidence Chain Zone ═════════════════════        │
│  (Append-only; audit/compliance/recovery purposes; forms tamper-proof         │
│  evidence chain)                                                             │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   audit/     │  │  artifacts/  │  │checkpoints/  │  │    dlq/      │    │
│  │  Audit logs  │  │  Evidence    │  │  Recovery    │  │  Dead letter │    │
│  │  who-what-   │  │  artifacts   │  │  checkpoints │  │  queue       │    │
│  │  when        │  │  evidence-   │  │  workflow/   │  │  failed-     │    │
│  │              │  │  chain       │  │  step-ckpt   │  │  event       │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
│  ──────────────────── Infrastructure layer ────────────────────             │
│  storage-backend-factory · migration-runner · async-repo-registry            │
│  session-dual-write · storage-quota                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### §7.2 Data Flow Overview Diagram

```text
  P4 state-command
        │
        ▼
  ┌──────────┐    Same transaction     ┌──────────┐
  │  Truth   │ ════════════════════▶   │  Event   │
  │  (BC1-7) │                         │  (BC3)   │
  └──────────┘                         └────┬─────┘
                                            │  Async projection
                         ┌──────────────────┼──────────────────┐
                         ▼                  ▼                   ▼
                   ┌──────────┐      ┌──────────┐        ┌──────────┐
                   │ Derived  │      │ Evidence │        │ Upper    │
                   │projections│     │audit/ckpt│        │ systems  │
                   │knowledge │      │artifacts │        │L4-L7     │
                   │          │      │          │        │subscribe │
                   └──────────┘      └──────────┘        └──────────┘
```

### §7.3 BC Grouping Boundary Rules

| Rule | Description |
|------|-------------|
| BC inter-communication | Only through Event Bus (BC3); prohibit direct import between BCs |
| Truth writes | Must go through state-command contract; each BC manages its own tables |
| Projection rebuild | Any Projection can be idempotently rebuilt from Event Log; rebuild command is standard ops |
| Evidence immutability | audit / artifact / checkpoint are append-only; used for compliance audit and fault recovery |
| Migration order | Zone B (Derived) → Zone C (Evidence) → Zone A (Truth); migrate read-heavy, write-light tables first |

---

## §8 AI Runtime Support Stack Module Ownership Diagram

> **Diagram type: Structure diagram** — Expresses the module ownership and responsibility division of the three AI operations sidecar components (Model Gateway · Prompt Engine · Compliance). Does not express model invocation sequencing or Prompt rendering details.
>
> **Positioning note**: These three components belong to the "AI Operations sidecar" visual band in the §1 overview diagram, **parallel support** (dashed cross-plane relationship) with the five-plane main kernel, not sub-modules of any single plane. P3/P4 call model-gateway and prompt-engine through contracts, P5 calls compliance through contracts.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                     AI Runtime Support Stack                                 │
│         (Parallel support, not sub-components of five planes;              │
│          serves each plane through contracts)                               │
│                                                                              │
│  ┌───────────────────────────────┐  ┌──────────────────────────────────┐    │
│  │     model-gateway/            │  │      prompt-engine/               │    │
│  │      Model Gateway            │  │      Prompt Engineering Engine    │    │
│  │                                │  │                                    │    │
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
│  │  ┌─────────────┐ │ failover │ │  │      compliance/                  │    │
│  │  │  messages/  │ └──────────┘ │  │  ┌──────────┐ ┌──────────────┐  │    │
│  │  │ token-est   │              │  │  │ erasure/ │ │ encryption/  │  │    │
│  │  │ message-    │              │  │  │ crypto-   │ │ field-level  │  │    │
│  │  │  parts      │              │  │  │  shred   │ │  encrypt     │  │    │
│  │  └─────────────┘              │  │  └──────────┘ └──────────────┘  │    │
│  └───────────────────────────────┘  │  ┌──────────┐ ┌──────────────┐  │    │
│                                      │  │data-     │ │  lineage/    │  │    │
│  Invocation contracts:               │  │ residency│ │  data-lineage│  │    │
│  P3 ══model-request══▶ model-gw    │  └──────────┘ └──────────────┘  │    │
│  P4 ══model-request══▶ model-gw    └──────────────────────────────────┘    │
│  P3 ══prompt-render══▶ prompt-engine                                       │
│  P5 ══compliance-cmd══▶ compliance                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §9 Platform Protocol Diagram (Contracts Cross-plane Protocol Chain + Shared Infrastructure)

> **Diagram type: Data flow diagram** — Expresses the transmission direction of cross-plane contracts and the service scope of shared infrastructure. Does not express contract internal field definitions or shared module implementation details.
>
> **Protocol chain core path**: The signal transmission of P1→P2→P3→P4→P5 is linked by 7 contract envelopes, each envelope defines the communication protocol between upstream and downstream planes.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│               Cross-plane Protocols and Shared Infrastructure                 │
│                                                                              │
│  ┌──────────────────────────────────────────────────────┐                   │
│  │  contracts/  Cross-plane Protocol Chain              │                   │
│  │                                                        │                   │
│  │  ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────────┐ │                   │
│  │  │types/  │ │errors  │ │constants/│ │result-       │ │                   │
│  │  │domain   │ │.ts     │ │time.ts   │ │ envelope/   │ │                   │
│  │  │ids      │ └────────┘ └──────────┘ └──────────────┘ │                   │
│  │  │status   │                                            │                   │
│  │  └────────┘ ┌──────────────┐ ┌──────────────────────┐ │                   │
│  │              │request-     │ │control-directive/     │ │                   │
│  │              │ envelope/   │ │P2 ══▶ P3 control     │ │                   │
│  │              │ P1 ══▶ P2   │ │  transmission         │ │                   │
│  │              └──────────────┘ └──────────────────────┘ │                   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │                   │
│  │  │execution-    │ │execution-     │ │state-        │   │                   │
│  │  │ plan/        │ │ receipt/     │ │ command/     │   │                   │
│  │  │ P3 ══▶ P4    │ │ P4 ══▶ P3    │ │ P4 ══▶ P5   │   │                   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘   │                   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │                   │
│  │  │delegation-  │ │model-        │ │compliance-   │   │                   │
│  │  │ request/    │ │ request/     │ │ command/     │   │                   │
│  │  │ P3 ══▶ HITL  │ │ P3/P4 ══▶ AI│ │ P5 ══▶ Comp   │   │                   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘   │                   │
│  │                                                        │                   │
│  │  Protocol chain series:                               │                   │
│  │  request-envelope ──▶ control-directive ──▶           │                   │
│  │  execution-plan ──▶ execution-receipt ──▶             │                   │
│  │  state-command                                         │                   │
│  └──────────────────────────────────────────────────────┘                   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────┐                   │
│  │  shared/  Cross-plane Shared Infrastructure           │                   │
│  │                                                        │                   │
│  │  ┌──────────┐ ┌───────────┐ ┌────────────────────┐   │                   │
│  │  │ utils/   │ │lifecycle/ │ │      cache/        │   │                   │
│  │  │bounded-  │ │service-   │ │  cache-facade      │   │                   │
│  │  │ cache    │ │ registry  │ │  cache-bootstrap   │   │                   │
│  │  └──────────┘ │evolution  │ │  cache-policy       │   │                   │
│  │                └───────────┘ │  cache-invalidate   │   │                   │
│  │                               │  cache-key-factory  │   │                   │
│  │  ┌──────────────────────┐    │  cache-metrics      │   │                   │
│  │  │   observability/     │    └────────────────────┘   │                   │
│  │  │  structured-logger   │                              │                   │
│  │  │  otel-bootstrap        │    ┌────────────────────┐   │                   │
│  │  │  metrics-service      │    │    stability/     │   │                   │
│  │  │  health-service       │    │  golden-task-runner│   │                   │
│  │  │  diagnostics          │    │  vcr-replay        │   │                   │
│  │  │  inspect-service      │    │  stable-acceptance │   │                   │
│  │  │  sli/slo/anomaly       │    │  30+ rehearsal      │   │                   │
│  │  │  agent-state-view      │    │   scenarios         │   │                   │
│  │  └──────────────────────┘    └────────────────────┘   │                   │
│  └──────────────────────────────────────────────────────┘                   │
│                                                                              │
│  Contract data flow:                                                        │
│  P1 ──request-envelope──▶ P2 ──control-directive──▶ P3                    │
│  P3 ──execution-plan──▶ P4 ──execution-receipt──▶ P3                     │
│  P4 ──state-command──▶ P5                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §10 Layer 3 `domains/` Business Domain Access Layer Framework Diagram

> **Diagram type: Structure diagram** — Expresses the ownership and responsibility division of modules under domains/. Does not express the runtime flow of domain registration or Plugin SPI invocation details.

```text
domains/
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Layer 3: Business Domain Access Layer                    │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────┐               │
│  │  registry/  Domain Registry (Core Hub)                   │               │
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
│  │ Domain risk  │ │ schema/      │ │ framework/   │ │ library/     │       │
│  │ profile      │ │ Domain       │ │ Domain eval  │ │ Domain       │       │
│  │ [NEW §37]    │ │ knowledge    │ │ framework    │ │ Prompt lib  │       │
│  │              │ │ structure    │ │ [NEW §37]    │ │ [NEW §37]   │       │
│  │              │ │ [NEW §37]    │ │              │ │              │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                        │
│  │recipes/      │ │interaction-  │ │governance/   │                        │
│  │ DomainRecipe │ │ policy/      │ │ Domain        │                        │
│  │ Prototype    │ │ Cross-domain │ │ governance    │                        │
│  │ templates    │ │ interaction  │ │ division-     │                        │
│  │ [NEW §38]    │ │ policy       │ │  loader        │                        │
│  │              │ │ [NEW §37]    │ │ hr-role-gov   │                        │
│  └──────────────┘ └──────────────┘ └──────────────┘                        │
│  ┌──────────────┐ ┌──────────────┐                                         │
│  │  coding/     │ │ operations/  │  Domain instance examples                │
│  │  Coding      │ │  Operations   │  (Specific business domains based on    │
│  │  domain      │ │  domain       │  registry registration)                 │
│  └──────────────┘ └──────────────┘                                         │
│                                                                              │
│  Access flow: Business side ──▶ registry(register DomainDescriptor) ──▶   │
│          risk-profile + knowledge + eval + prompt ──▶                       │
│          recipes(generate Recipe) ──▶ platform/(P3 orchestration available) │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §11 Layer 4 `interaction/` Intelligent Interaction Layer Framework Diagram

> **Diagram type: Structure diagram** — Expresses the ownership and responsibility division of modules under interaction/. Does not express natural language parsing pipeline and autonomy state machine transition details.
>
> This layer consists entirely of newly built modules (NEW), with no old system migration files.

```text
interaction/
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Layer 4: Intelligent Interaction Layer (User-side OS)          │
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │   nl-gateway/ [§39]      │  │  goal-decomposer/ [§40]  │                 │
│  │   Natural language task   │  │  Goal decomposition      │                 │
│  │   entry                   │  │  engine                   │                 │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │                 │
│  │  │ intent-parser/     │  │  │  │ planner/           │  │                 │
│  │  │  Intent parsing    │  │  │  │  template/LLM/      │  │                 │
│  │  │ slot-resolver/     │  │  │  │  hybrid/human       │  │                 │
│  │  │  Slot extraction   │  │  │  │ dependency-graph/  │  │                 │
│  │  │ ambiguity-handler/ │  │  │  │  Task dependency    │  │                 │
│  │  │  Disambiguation     │  │  │  │  DAG                │  │                 │
│  │  │  dialog             │  │  │  │ validator/          │  │                 │
│  │  └────────────────────┘  │  │  │  Decomposition       │  │                 │
│  └──────────────────────────┘  │  │  result validation  │  │                 │
│                                 └──────────────────────────┘                 │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │  proactive-agent/ [§41]  │  │    autonomy/ [§42]       │                 │
│  │  Proactive Agent         │  │  Progressive autonomy     │                 │
│  │  framework               │  │  model                    │                 │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │                 │
│  │  │ trigger-engine/    │  │  │  │ trust-scorer/      │  │                 │
│  │  │  cron/event/thresh │  │  │  │  Trust scoring      │  │                 │
│  │  │ schedule-manager/  │  │  │  │ level-manager/     │  │                 │
│  │  │  Scheduling mgmt    │  │  │  │  Autonomy level      │  │                 │
│  │  │ event-watcher/     │  │  │  │  state machine      │  │                 │
│  │  │  Event-driven       │  │  │  │ promotion-engine/  │  │                 │
│  │  │  wake-up           │  │  │  │  Upgrade/downgrade   │  │                 │
│  │  └────────────────────┘  │  │  │  rule engine        │  │                 │
│  └──────────────────────────┘  │  └────────────────────┘  │                 │
│                                 └──────────────────────────┘                 │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │   dashboard/ [§43]       │  │      ux/ [§44]           │                 │
│  │   Unified ops dashboard │  │   Non-technical user     │                 │
│  │  ┌────────────────────┐  │  │   experience              │                 │
│  │  │ metric-aggregator/ │  │  │  ┌────────────────────┐  │                 │
│  │  │  Metric           │  │  │  │ wizard/            │  │                 │
│  │  │  aggregation       │  │  │  │  Visual domain     │  │                 │
│  │  │ health-scorer/     │  │  │  │  access wizard     │  │                 │
│  │  │  Health scoring    │  │  │  │ template-engine/   │  │                 │
│  │  │ alert-router/      │  │  │  │  Visual workflow   │  │                 │
│  │  │  Alert routing     │  │  │  │  construction      │  │                 │
│  │  └────────────────────┘  │  │  │ onboarding/        │  │                 │
│  └──────────────────────────┘  │  │  First-time use     │  │                 │
│                                 │  │  guide experience   │  │                 │
│                                 │  └────────────────────┘  │                 │
│                                 └──────────────────────────┘                 │
│                                                                              │
│  Interaction flow:                                                           │
│  User NL ──▶ nl-gateway(parse) ──▶ goal-decomposer(decompose)              │
│  ──▶ platform/P3(orchestrate) ──▶ autonomy(autonomy control)              │
│  proactive-agent(trigger) ──▶ nl-gateway ──▶ orchestrate                   │
│  dashboard ◀── P5(aggregate display)   ux ──▶ domains/(guide access)       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §12 Layer 5 `org-governance/` Organization Governance Layer Framework Diagram

> **Diagram type: Structure diagram** — Expresses the ownership and responsibility division of modules under org-governance/. Does not express approval routing algorithms or SCIM synchronization protocol details.

```text
org-governance/
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Layer 5: Organization Governance Layer                  │
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │   org-model/ [§46]       │  │ approval-routing/ [§47] │                 │
│  │   Organization          │  │  Organization approval   │                 │
│  │   hierarchy model        │  │  routing                  │                 │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │                 │
│  │  │ hierarchy/          │  │  │  │ route-engine/      │  │                 │
│  │  │  company/division/  │  │  │  │  org-chart/amount/ │  │                 │
│  │  │  department/team    │  │  │  │  SoD routing       │  │                 │
│  │  │ org-node/           │  │  │  │ escalation/        │  │                 │
│  │  │  CRUD + inheritance │  │  │  │  Approval          │  │                 │
│  │  │ sync/               │  │  │  │  escalation        │  │                 │
│  │  │  SCIM/HR-API/manual │  │  │  │ delegation/        │  │                 │
│  │  └────────────────────┘  │  │  │  Leave delegation   │  │                 │
│  └──────────────────────────┘  └──────────────────────────┘                 │
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │   sso-scim/ [§48]       │  │compliance-engine/ [§49]  │                 │
│  │   SSO/SCIM integration  │  │  Department-level       │                 │
│  │  ┌────────────────────┐  │  │  compliance policy      │                 │
│  │  │ saml/              │  │  │  engine                │                 │
│  │  │  SAML SSO          │  │  │  ┌────────────────────┐  │                 │
│  │  │ oidc/              │  │  │  │ policy-resolver/   │  │                 │
│  │  │  OIDC SSO          │  │  │  │  Inheritance +      │  │                 │
│  │  │ scim-sync/         │  │  │  │  override           │  │                 │
│  │  │  User/group sync    │  │  │  │ inheritance/        │  │                 │
│  │  └────────────────────┘  │  │  │  Child levels can    │  │                 │
│  └──────────────────────────┘  │  │  │  only tighten       │  │                 │
│                                 │  │  │ audit-enforcer/    │  │                 │
│                                 │  │  │  Compliance audit  │  │                 │
│                                 │  │  │  enforcement       │  │                 │
│                                 │  │  └────────────────────┘  │                 │
│                                 │  └──────────────────────────┘                 │
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │knowledge-boundary/ [§50]│  │delegated-governance/[§51]│                 │
│  │  Knowledge domain       │  │  Hierarchical governance  │                 │
│  │  isolation and          │  │  delegation               │                 │
│  │  controlled sharing      │  │                           │                 │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │                 │
│  │  │ boundary-manager/   │  │  │  │ scope-manager/     │  │                 │
│  │  │  strict/controlled  │  │  │  │  Delegation scope  │  │                 │
│  │  │  /open             │  │  │  │  management        │  │                 │
│  │  │ sharing-gate/       │  │  │  │ delegation-        │  │                 │
│  │  │  Cross-domain       │  │  │  │  registry/         │  │                 │
│  │  │  sharing gateway   │  │  │  │  Delegation        │  │                 │
│  │  │ access-log/        │  │  │  │  registry          │  │                 │
│  │  │  Access audit      │  │  │  └────────────────────┘  │                 │
│  │  └────────────────────┘  │  └──────────────────────────┘                 │
│  └──────────────────────────┘                                                │
│                                                                              │
│  Governance flow:                                                            │
│  org-model(org tree) ──▶ approval-routing(approval routing)                │
│  sso-scim(identity sync) ──▶ platform/P2/iam                                │
│  compliance-engine ──▶ platform/P2/policy-center                           │
│  knowledge-boundary ──▶ platform/P5/knowledge(isolation control)            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §13 Layer 6 `scale-ecosystem/` Scale Ecosystem + Ecology Layer Framework Diagram

> **Diagram type: Structure diagram** — Expresses the ownership and responsibility division of modules under scale-ecosystem/. Does not express cross-Region data synchronization protocol or SLA tiering algorithm details.

```text
scale-ecosystem/
┌─────────────────────────────────────────────────────────────────────────────┐
│                  Layer 6: Scale Ecosystem + Ecology Layer                   │
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │  multi-region/ [§52]      │  │ resource-manager/ [§53]  │                 │
│  │  Multi-Region deployment  │  │  Resource competition     │                 │
│  │  ┌────────────────────┐  │  │  management               │                 │
│  │  │ region-router/      │  │  │  ┌────────────────────┐  │                 │
│  │  │  Region routing   │  │  │  │  │ fair-queue/       │  │                 │
│  │  │  decision         │  │  │  │  │  Weighted fair    │  │                 │
│  │  │ data-replicator/  │  │  │  │  │  queue            │  │                 │
│  │  │  Cross-Region     │  │  │  │  │ quota-enforcer/  │  │                 │
│  │  │  data sync        │  │  │  │  │  Quota           │  │                 │
│  │  │ failover-ctrl/    │  │  │  │  │  enforcement     │  │                 │
│  │  │  Region failover   │  │  │  │  │ preemption/     │  │                 │
│  │  │  control          │  │  │  │  │  Priority         │  │                 │
│  │  └────────────────────┘  │  │  │  │  preemption      │  │                 │
│  └──────────────────────────┘  │  └────────────────────┘  │                 │
│                                 └──────────────────────────┘                 │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │   sla-engine/ [§54]      │  │   marketplace/ [§55]    │                 │
│  │   SLA tiered guarantee   │  │   Agent marketplace and   │                 │
│  │   engine                 │  │   ecosystem               │                 │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │                 │
│  │  │ tier-resolver/    │  │  │  │  │ catalog/          │  │                 │
│  │  │  SLA tier        │  │  │  │  │  Marketplace      │  │                 │
│  │  │  resolution       │  │  │  │  │  catalog          │  │                 │
│  │  │ resource-allocator/│  │  │  │  │ certification/   │  │                 │
│  │  │  Resource         │  │  │  │  │  Certification &  │  │                 │
│  │  │  allocation       │  │  │  │  │  security scan   │  │                 │
│  │  │ breach-detector/ │  │  │  │  │ publisher/       │  │                 │
│  │  │  SLA breach       │  │  │  │  │  Publish mgmt    │  │                 │
│  │  │  detection        │  │  │  │  │ billing-service  │  │                 │
│  │  └────────────────────┘  │  │  │ marketplace-gov   │  │                 │
│  └──────────────────────────┘  │  └────────────────────┘  │                 │
│                                 └──────────────────────────┘                 │
│  ┌──────────────────────────┐                                                │
│  │  feedback-loop/ [§56]    │  ┌──────────────────────────┐                 │
│  │  Feedback-driven          │  │  integration/ [§57]      │                 │
│  │  continuous improvement   │  │  External system         │                 │
│  │  ┌────────────────────┐  │  │  integration framework    │                 │
│  │  │ collector/         │  │  │  ┌────────────────────┐  │                 │
│  │  │  Signal collection  │  │  │  │  │ connector-registry/│  │                 │
│  │  │ analyzer/          │  │  │  │  │  Connector         │  │                 │
│  │  │  Signal analysis   │  │  │  │  │  registration      │  │                 │
│  │  │ improvement-       │  │  │  │  │ connector-runtime/ │  │                 │
│  │  │  tracker/          │  │  │  │  │  Connector runtime  │  │                 │
│  │  │  Improvement       │  │  │  │  │ health-monitor/   │  │                 │
│  │  │  tracking          │  │  │  │  │  │  Connector health  │  │                 │
│  │  └────────────────────┘  │  │  │  │  monitoring       │  │                 │
│  └──────────────────────────┘  │  └────────────────────┘  │                 │
│                                 └──────────────────────────┘                 │
│  Scale flow:                                                                 │
│  multi-region ──▶ platform/P4/ha(cross-Region coordination)                  │
│  resource-manager ──▶ platform/P4/dispatcher(quota+preemption)             │
│  sla-engine ──▶ resource-manager(allocate by SLA)                          │
│  marketplace ──▶ domains/registry(Agent listing)                            │
│  feedback-loop ◀── P5/events(signal collection) ──▶ ops-maturity/(improve)  │
│  integration ──▶ platform/P4/tool-executor(external connectors)              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §14 Layer 7 `ops-maturity/` Operations Maturity Layer Framework Diagram

> **Diagram type: Structure diagram** — Expresses the ownership and responsibility division of 11 modules under ops-maturity/. Does not express evidence chain collection pipeline or drift detection algorithm details.
>
> This layer contains 11 modules and is the "top-level encapsulation" of system capabilities, mostly newly built.

```text
ops-maturity/
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Layer 7: Operations Maturity Layer                      │
│                                                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐               │
│  │explainability/  │ │  emergency/     │ │agent-lifecycle/ │               │
│  │ Explainability  │ │  Emergency      │ │ Agent lifecycle  │               │
│  │ [§59]           │ │  brake [§60]    │ │  [§61]          │               │
│  │ evidence-       │ │  panic-ctrl     │ │ agent-registry  │               │
│  │  collector      │ │  forensic-      │ │ version-mgr     │               │
│  │ causal-chain    │ │   snapshot      │ │ canary-ctrl     │               │
│  │ explanation-    │ │  resume-        │ │ retirement      │               │
│  │  renderer/cache │ │   protocol      │ │                 │               │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘               │
│                                                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐               │
│  │edge-runtime/    │ │drift-detection/ │ │ cost-optimizer/ │               │
│  │  Offline/edge   │ │  Behavior       │ │ Cost optimization│              │
│  │  [§62]         │ │  drift [§63]     │ │  [§64]          │               │
│  │ edge-orchestratr│ │ fingerprint     │ │ attribution     │               │
│  │ edge-executor   │ │ changepoint     │ │ recommendation  │               │
│  │ local-model     │ │ cross-agent     │ │ simulator       │               │
│  │ sync-queue      │ │ evolution-*     │ │                 │               │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘               │
│                                                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐               │
│  │workflow-debugger│ │compliance-      │ │capacity-planner/│               │
│  │ Visual debugging│ │ reporter/ [§66] │ │  Capacity       │               │
│  │ [§65]          │ │                  │ │  planning [§67] │               │
│  │ timeline-render │ │ template-reg    │ │ trend-analyzer  │               │
│  │ breakpoint-mgr  │ │ evidence-mapper │ │ forecaster      │               │
│  │ run-comparator  │ │ report-renderer │ │ simulator       │               │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘               │
│                                                                              │
│  ┌─────────────────┐ ┌──────────────────────────────────┐                   │
│  │  multimodal/    │ │   platform-ops-agent/ [§69]      │                   │
│  │  Multimodal      │ │   Platform self-ops Agent        │                   │
│  │  [§68]         │ │                                   │                   │
│  │ image-processor │ │  ┌─────────────┐ ┌────────────┐  │                   │
│  │ speech-process  │ │  │incident-    │ │config-     │  │                   │
│  │ document-parser │ │  │ diagnoser   │ │ optimizer  │  │                   │
│  │ modality-router │ │  │capacity-    │ │dev-        │  │                   │
│  └─────────────────┘ │  │ predictor    │ │ assistant  │  │                   │
│                      │  │health-       │ └────────────┘  │                   │
│                      │  │ monitor      │                  │                   │
│                      │  └─────────────┘                  │                   │
│                      └──────────────────────────────────┘                   │
│                                                                              │
│  Operations flow:                                                            │
│  explainability ◀── P5/events+artifacts(collect evidence chain)             │
│  emergency ──▶ platform/P2/incident-control(global braking)                │
│  drift-detection ◀── P5/events(behavior fingerprint comparison)           │
│  platform-ops-agent ──▶ platform/ various planes(self-ops closed loop)             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §15 Cross-layer Module Framework Diagram (plugins · sdk · apps)

> **Diagram type: Structure diagram** — Expresses the module ownership of plugins/ · sdk/ · apps/ and cross-layer invocation entry points. Does not express plugin sandbox isolation mechanism or CLI command implementation details.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Cross-layer Modules                                 │
│                                                                              │
│  ┌───────────────────────────────────────┐                                  │
│  │  plugins/  Plugin Ecosystem           │                                  │
│  │                                        │                                  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────┐ │                                  │
│  │  │adapters/ │ │planners/ │ │present-│ │                                  │
│  │  │ asset    │ │ basic-   │ │ ers/   │ │                                  │
│  │  │ crm      │ │ planner  │ │coding  │ │                                  │
│  │  │ game-dev │ └──────────┘ │growth  │ │                                  │
│  │  │ github   │ ┌──────────┐ │ops     │ │                                  │
│  │  │ livestrm │ │retriever│ └────────┘ │                                  │
│  │  └──────────┘ │ asset   │ ┌────────┐ │                                  │
│  │               │ coding  │ │validat-│ │                                  │
│  │               │ game    │ │ ors/   │ │                                  │
│  │               │ growth  │ │basic-  │ │                                  │
│  │               │ livestrm│ │eval    │ │                                  │
│  │               │ ops     │ └────────┘ │                                  │
│  │               └──────────┘            │                                  │
│  │  builtin-plugin-registry               │                                  │
│  └───────────────────────────────────────┘                                  │
│                                                                              │
│  ┌───────────────────────────────────────┐  ┌──────────────────────────┐    │
│  │  sdk/  SDK & Developer Experience     │  │  apps/  Application      │    │
│  │                                        │  │  Entry Points             │    │
│  │  ┌──────────┐ ┌──────────┐            │  │                          │    │
│  │  │pack-sdk/ │ │plugin-    │            │  │  ┌────────────────────┐ │    │
│  │  │ Pack     │ │ sdk/     │            │  │  │  api/              │ │    │
│  │  │  SDK     │ │ Plugin   │            │  │  │  API Server entry  │ │    │
│  │  └──────────┘ └──────────┘            │  │  ├────────────────────┤ │    │
│  │  ┌──────────┐ ┌──────────┐            │  │  │  console/          │ │    │
│  │  │client-   │ │  cli/    │            │  │  │  Console UI entry  │ │    │
│  │  │ sdk/     │ │  CLI     │            │  │  ├────────────────────┤ │    │
│  │  │ REST +   │ │  scripts │            │  │  │  workers/          │ │    │
│  │  │ WebSocket│ │          │            │  │  │  Worker process    │ │    │
│  │  │          │ │          │            │  │  │  entry             │ │    │
│  │  └──────────┘ └──────────┘            │  │  └────────────────────┘ │    │
│  └───────────────────────────────────────┘  └──────────────────────────┘    │
│                                                                              │
│  Invocation relationships:                                                  │
│  apps/api ──▶ platform/P1/api(start HTTP service)                          │
│  apps/workers ──▶ platform/P4/worker-pool(start Worker process)             │
│  apps/console ──▶ platform/P1/console-backend(start console)                │
│  sdk/cli ──▶ platform/ various modules(CLI command entry)                   │
│  plugins/* ──▶ domains/registry(via SPI registration)                      │
│             ──▶ platform/P4/plugin-executor(sandbox execution)               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §16 End-to-End Data Flow Overview Diagram

> **Diagram type: Data flow diagram** — Expresses the complete signal transmission path from P1 to P5 for user requests, and the event subscription relationship of upper-layer systems. Does not express module internal processing logic or error branches.

```text
                        ┌──────────────┐
                        │   User/      │
                        │   External   │
                        └──────┬───────┘
                               │ HTTP / WebSocket / Webhook / Channel
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ P1 Interface   ingress ──▶ api / webhook / channel-gateway / scheduler        │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ request-envelope
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ P2 Control     iam(authentication) ──▶ policy(evaluation) ──▶ approval      │
│                config-center(config) · incident-control(anomaly control)      │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ control-directive
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ P3 Orchestrate routing ──▶ planner ──▶ oapeflir(O-A-P-E-F-L-I-R)            │
│                hitl(HI-machine collaboration) · escalation · replan         │
│                prompt-engine(render Prompt) · model-gateway(select model)    │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ execution-plan
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ P4 Execution   dispatcher ──▶ lease ──▶ worker-pool ──▶ execution-engine   │
│                ──▶ tool-executor / plugin-executor                          │
│                state-transition · recovery · ha · hot-upgrade                │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ state-command / execution-receipt
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ P5 State       truth(persist) ──▶ events(event broadcast) ──▶              │
│                projections(query views) · artifacts(artifacts) · memory      │
│                knowledge · audit · checkpoints                               │
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

## §17 Dependency Direction and Layering Constraints Diagram

> **Diagram type: Constraint diagram** — Expresses the allowed and prohibited dependency directions between layers, and same-layer decoupling methods. Does not express specific import paths or runtime invocation chains.

```text
Dependency direction rules: Upper layers can depend on lower layers, lower layers cannot depend on upper layers; same-layer decoupling via events/contracts.

  ┌─────────────────────────────────────────────────┐
  │  Layer 7  ops-maturity/                          │  Can depend ──▶ L1-6
  │  (11 modules)                                    │
  ├─────────────────────────────────────────────────┤
  │  Layer 6  scale-ecosystem/                       │  Can depend ──▶ L1-5
  │  (6 modules)                                     │
  ├─────────────────────────────────────────────────┤
  │  Layer 5  org-governance/                        │  Can depend ──▶ L1-4
  │  (6 modules)                                     │
  ├─────────────────────────────────────────────────┤
  │  Layer 4  interaction/                           │  Can depend ──▶ L1-3
  │  (6 modules, ALL NEW)                            │
  ├─────────────────────────────────────────────────┤
  │  Layer 3  domains/                               │  Can depend ──▶ L1-2
  │  (10 modules)                                    │
  ├─────────────────────────────────────────────────┤
  │  Layer 1-2  platform/                            │  Only depends on contracts/ shared/
  │  (P1-P5 + model-gw + prompt + compliance)       │
  │  (contracts/ + shared/)                        │
  └─────────────────────────────────────────────────┘

  Cross-layer modules:
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ plugins/ │ │   sdk/   │ │  apps/   │  Can depend on any layer (via interface injection)
  └──────────┘ └──────────┘ └──────────┘

  Prohibited directions (✗):
  ✗  platform/ ──▶ interaction/       (lower cannot depend on upper)
  ✗  platform/ ──▶ org-governance/    (lower cannot depend on upper)
  ✗  domains/  ──▶ scale-ecosystem/   (lower cannot depend on upper)

  Same-layer decoupling methods:
  ┌──────────┐  events/contracts   ┌──────────┐
  │ Module A │ ◀═══════════════▶  │ Module B │  (Same layer communicates via event bus or
  └──────────┘                     └──────────┘   platform/contracts/)
```

---

## §18 Stability Seven-Layer Model Framework Diagram

> **Diagram type: Structure diagram** — Expresses the layer division of the stability seven-layer model and the capability modules contained in each layer. Does not express runtime trigger sequencing between layers or degradation decision logic.
>
> The stability seven-layer model crosses all five planes and is the implementation skeleton of X1 Reliability & Security Fabric.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Stability Seven-Layer Model (§9)                        │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────┐       │
│  │  Layer 7: Observability                                           │       │
│  │  structured-logger · otel-tracer · metrics · health · diagnostics │       │
│  │  sli-collection · slo-alerting · anomaly-detection                │       │
│  │  agent-state-view · task-board · situation-report                  │       │
│  ├───────────────────────────────────────────────────────────────────┤       │
│  │  Layer 6: Recovery Capability                                     │       │
│  │  lease-reclaim · execution-recovery · workflow-recovery            │       │
│  │  replay · repair · projection-rebuild · stalled-detection          │       │
│  ├───────────────────────────────────────────────────────────────────┤       │
│  │  Layer 5: Degradation Mode                                        │       │
│  │  full_auto ──▶ supervised_auto ──▶ read_only ──▶ manual_only     │       │
│  │  no-write · no-external-call · no-rollout · incident-mode         │       │
│  ├───────────────────────────────────────────────────────────────────┤       │
│  │  Layer 4: Circuit Breaker                                          │       │
│  │  closed ──▶ open ──▶ half-open (for API/Provider/Tool/Plugin)     │       │
│  │  per-provider · per-tool · per-external-api                       │       │
│  ├───────────────────────────────────────────────────────────────────┤       │
│  │  Layer 3: Timeout & Retry                                         │       │
│  │  step-timeout · attempt-timeout · tool-timeout                    │       │
│  │  exponential-backoff + jitter · max-retries                       │       │
│  ├───────────────────────────────────────────────────────────────────┤       │
│  │  Layer 2: Rate Limiting & Backpressure                           │       │
│  │  per-tenant concurrency · per-workflow active                     │       │
│  │  Level 0(normal) ──▶ Level 1(warning) ──▶ Level 2(throttle) ──▶  │   │
│  │  Level 3(protect)                                                  │   │
│  ├───────────────────────────────────────────────────────────────────┤       │
│  │  Layer 1: Isolation                                                │       │
│  │  tenant · project · domain · worker-pool · executor              │       │
│  │  sandbox · process-isolation · network-namespace                   │       │
│  └───────────────────────────────────────────────────────────────────┘       │
│                                                                              │
│  Stability rehearsals (platform/shared/stability/):                         │
│  30+ rehearsal scenarios:                                                   │
│  golden-task · vcr-replay · dispatch · worker · lease · concurrency        │
│  queue · event · chaos · prompt-injection · rolling-upgrade · rollback     │
│  backup · maintenance · gray-release · db-writability · db-queue-disconnect │
│  migration · runtime-soak · cross-division                                 │
│                                                                              │
│  Trigger methods:                                                            │
│  CI/CD auto ──▶ golden-task-runner ──▶ stable-acceptance-line              │
│  Manual ──▶ npm run test:golden / npm run *:stable                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §19 P4 Runtime Bounded Context Special Diagram

> **Diagram type: Structure diagram** — Expresses the ownership and dependency relationships of the 12 Bounded Contexts resulting from splitting `core/runtime/` within the P4 Execution Plane. Does not express BC internal class/method-level implementation details.
>
> **Background**: The old system `core/runtime/` is a monolithic module (101 files / 30K lines) that needs to be split into independent BCs to reduce coupling. 6 BCs have zero internal dependencies (can be extracted independently), and 2 are composite roots (remain in runtime/ core).

### §19.1 BC Ownership and Dependency Diagram

```text
platform/five-plane-execution/
┌─────────────────────────────────────────────────────────────────────────────┐
│                    P4 Execution Plane — 12 Bounded Contexts                  │
│                                                                              │
│  ══════════ Independent Extraction Zone (Zero internal dependencies, Wave 1-2 priority) ══════════ │
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
│           │          └─────────────────┘                                   │
│           │ (only dependency target)                                       │
│  ══════════ Ordered Extraction Zone (Limited dependencies, Wave 2-3) ══════════ │
│           │                                                                  │
│  ┌────────┴────────┐ ┌─────────────────┐                                    │
│  │ BC9 Agent Exec  │ │ BC2 Lease Mgmt  │                                    │
│  │ (12 files)      │ │ (8 files)       │                                    │
│  │ agent-executor  │ │ lease-lifecycle │                                    │
│  │ middleware-chain│ │ lease-compete   │                                    │
│  │ model-call      │ │ lease-repo      │                                    │
│  │ loop-detection  │ └────────┬────────┘                                    │
│  └─────────────────┘          │                                             │
│                                │                                             │
│  ┌─────────────────────────────┴───────────────────────────────┐             │
│  │ BC4 Handshake/Writeback (10 files) — depends on BC1 + BC2  │             │
│  │ worker-handshake · capability-negotiate · result-writeback  │             │
│  └─────────────────────────────────────────────────────────────┘             │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────┐             │
│  │ BC7 Recovery & Repair (13 files) — depends on BC1+BC2+BC5+BC8 │             │
│  │ crash-recovery · stall-detection · orphan-cleanup · replay   │             │
│  │ repair · deviation-detect · escalation                       │             │
│  └─────────────────────────────────────────────────────────────┘             │
│                                                                              │
│  ══════════ Composite Roots (Remain in runtime/ core, Wave 4 refinement) ══════════ │
│                                                                              │
│  ┌──────────────────────────────┐ ┌──────────────────────────────┐          │
│  │ BC1 Execution Dispatch        │ │ BC10 Multi-Step Orchestration │          │
│  │ (12 files) — composite root  │ │ (13 files) — composite root   │          │
│  │ dispatch-service · reconcile │ │ phase-mgmt · complexity-route │          │
│  │ dispatch-async · support     │ │ session-lifecycle · planner   │          │
│  └──────────────────────────────┘ │ supervisor · checkpoint       │          │
│                                    └──────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### §19.2 Extraction Wave Plan

```text
Wave 1 (Zero risk)    BC3 + BC5 + BC6 + BC8              6,136 lines  20%
                       Gate: Each BC unit test passes independently
                             │
Wave 2 (Low risk)    BC2 + BC9 + BC12 + BC11             6,461 lines  21%
                       Gate: Lease/Agent integration tests pass
                             │
Wave 3 (Medium risk)  BC4 + BC7                           5,678 lines  19%
                       Gate: Recovery drill scenarios pass
                             │
Wave 4 (Cleanup)      BC1 + BC10 refine as runtime/ core   5,171 lines  17%
                       Gate: npm test full regression + stable-* pass
```

---

## §20 P5 Storage Bounded Context Special Diagram

> **Diagram type: Structure diagram** — Expresses the ownership and communication rules of the 7 Bounded Contexts resulting from splitting `AuthoritativeTaskStore` within the P5 State & Evidence Plane. Does not express BC internal SQL table structure or query details.
>
> **Background**: The old system `AuthoritativeTaskStore` is a god object (~278 methods + 21 Repository + ~123 consumers) that needs to be split into independent BCs communicating via Event Bus.

### §20.1 BC Ownership Diagram

```text
platform/five-plane-state-evidence/
┌─────────────────────────────────────────────────────────────────────────────┐
│               P5 — AuthoritativeTaskStore 7 BC Split                        │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ BC1 Core Task Engine (~73 methods)                                    │   │
│  │ Repositories: task · workflow · execution · session                     │   │
│  │ Responsibilities: Task lifecycle · Workflow state · Execution mgmt ·  │   │
│  │                    Session control                                     │   │
│  │ Strategy: Keep as core — internal method coupling is too high to split │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────┐  ┌────────────────────────┐                       │
│  │ BC2 Worker Infra     │  │ BC3 Event Infra (~24)  │                       │
│  │ (~47 methods)        │  │ Repo: event             │                       │
│  │ Repos: worker ·      │  │ Responsibilities: Event │                       │
│  │  dispatch · lease ·  │  │  publish · Acknowledge │                       │
│  │  lock               │  │  · DLQ · Persistent bus │                       │
│  │ Responsibilities:    │  │  · Type registration   │                       │
│  │  Scheduling alloc · │  │ Strategy: Clear        │                       │
│  │  Lease · Distributed │  │  boundaries, extract   │                       │
│  │  lock · Worker reg  │  │  directly              │                       │
│  │ Strategy: Extract   │  └────────────────────────┘                       │
│  │  as independent     │                                                  │
│  └──────────────────────┘  ┌────────────────────────┐                       │
│                             │ BC4 Billing & Cost     │                       │
│  ┌──────────────────────┐  │ (~29 methods)          │                       │
│  │ BC5 Governance &     │  │ Repo: billing            │                       │
│  │  Compliance (~50)    │  │ Responsibilities:       │                       │
│  │ Repos: approval ·   │  │  Account · Invoice ·     │                       │
│  │  organization ·     │  │  Quota · Usage · Ledger │                       │
│  │  secret · compliance│  │ Strategy: Decouple from │                       │
│  │  · operations      │  │  core execution         │                       │
│  │ Responsibilities:    │  └────────────────────────┘                       │
│  │  Approval routing · │                                                  │
│  │  Org hierarchy ·    │  ┌────────────────────────┐                       │
│  │  Secret mgmt ·      │  │ BC6 Platform & Commerce│                       │
│  │  Compliance policy ·│  │ (~47 methods)          │                       │
│  │  Ops governance     │  │ Repos: marketplace ·   │                       │
│  │ Strategy: Align     │  │  release · division ·  │                       │
│  │  with L5           │  │  intelligence ·        │                       │
│  └──────────────────────┘  │  evolution              │                       │
│                             │ Strategy: Align with   │                       │
│  ┌──────────────────────┐  │  L6-L7                 │                       │
│  │ BC7 Memory &         │  └────────────────────────┘                       │
│  │  Artifacts (~10)     │                                                  │
│  │ Repos: memory ·     │                                                  │
│  │  artifact            │                                                  │
│  │ Responsibilities:    │                                                  │
│  │  Memory CRUD +       │                                                  │
│  │  quality mgmt ·     │                                                  │
│  │  Artifact storage ·  │                                                  │
│  │  Version mgmt        │                                                  │
│  │ Strategy: Align     │                                                  │
│  │  with L4            │                                                  │
│  └──────────────────────┘                                                  │
│                                                                              │
│  ──── BC Inter-communication Rules ────                                      │
│  BC1 ◀══ Event Bus (BC3) ══▶ BC2/BC4/BC5/BC6/BC7                            │
│  Prohibit direct import between BCs; only through events + contracts       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### §20.2 Split Wave Plan

```text
Wave 1 (Low risk)    BC3 Event Infra → BC7 Memory & Artifacts
                       Gate: All event-related tests pass
                             │
Wave 2 (Medium risk)  BC4 Billing & Cost → BC2 Worker Infra
                       Gate: All dispatch/lease-related tests pass
                             │
Wave 3 (High risk)    BC5 Governance & Compliance → BC6 Platform & Commerce
                       Gate: All organization/approval/marketplace tests pass
                             │
Wave 4 (Cleanup)      Remove Facade; BC1 Core Task Engine becomes independent
                       module
                       Gate: npm test full pass + stable-* drills pass
```

---

## §21 Cross-cutting Capability Control Plane Diagram

> **Diagram type: Structure diagram** — Expresses how three types of cross-cutting capabilities (X1 Stability · X2 Observability · X3 Security & Compliance) provide unified services across the five planes. Does not express the internal implementation or configuration parameters of each cross-cutting capability.

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
│ Stack         │    trace                                 monitor      projection
│               │   ingress-     sli/slo     step-trace    worker-      rebuild-
│               │    metrics                                health       job-log
├──────────────┤
│ X3 Compliance│   data-        approval-   prompt-       tool-        erasure
│ & Governance  │    residency   sla         injection-    sandbox-     encryption
│               │   field-       org-policy guard         policy       data-
│               │    encrypt                                           lineage
└──────────────┘

Cross-cutting capability delivery methods:
  X1 → platform/shared/stability/ + platform/five-plane-execution/ various BCs embedded
  X2 → platform/shared/observability/ unified injection (structured-logger · otel · metrics)
  X3 → platform/compliance/ + org-governance/compliance-engine/
```

---

## §22 Old System Modules → New Platform Landing Diagram

> **Diagram type: Structure diagram** — Expresses the landing mapping of 42 old system `src/core/` modules migrating to the new platform's 7-layer architecture. Does not express migration steps or time sequence (see §23).

```text
Old system src/core/ (42 modules)        New platform src/ (7 layers + cross-layer)
═══════════════════════              ═══════════════════════════

types ─────────────────────────────▶ platform/contracts/types
errors ────────────────────────────▶ platform/contracts/errors
constants ─────────────────────────▶ platform/contracts/constants
results ────────────────────────────▶ platform/contracts/result-envelope
utils ─────────────────────────────▶ platform/shared/utils
lifecycle ─────────────────────────▶ platform/shared/lifecycle
cache ─────────────────────────────▶ platform/shared/cache

config ────────────────────────────▶ platform/five-plane-control-plane/config-center (P2)
api ───────────────────────────────▶ platform/five-plane-interface/api (P1)
storage ────────────────────────────▶ platform/five-plane-state-evidence/ (P5, 7 BC split)
events ────────────────────────────▶ platform/five-plane-state-evidence/events (P5 BC3)
locking ────────────────────────────▶ platform/five-plane-execution/ (P4)
queue ─────────────────────────────▶ platform/five-plane-execution/ (P4)
resource ──────────────────────────▶ platform/five-plane-execution/ (P4)

runtime ───────────────────────────▶ platform/five-plane-execution/ (P4, 12 BC split)
agent-loop ────────────────────────▶ platform/five-plane-orchestration/oapeflir (P3)
planning ──────────────────────────▶ platform/five-plane-orchestration/planner (P3)
orchestration ─────────────────────▶ platform/five-plane-orchestration/routing (P3)
providers ─────────────────────────▶ platform/model-gateway/
tools ─────────────────────────────▶ platform/five-plane-execution/tool-executor/
workflow ──────────────────────────▶ platform/five-plane-orchestration/oapeflir/workflow/
artifacts ─────────────────────────▶ platform/five-plane-state-evidence/artifacts (P5 BC7)
feedback ──────────────────────────▶ scale-ecosystem/feedback-loop (L6)
learning ──────────────────────────▶ scale-ecosystem/feedback-loop (L6)
evaluation ────────────────────────▶ platform/prompt-engine/eval/ (L7)

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
reliability ───────────────────────▶ ops-maturity/reliability (L7)

cli ───────────────────────────────▶ sdk/cli (cross-layer)
```

### §22.1 Migration Type Statistics

| Mapping Type | Module Count | Description |
|--------------|--------------|-------------|
| 1:1 Direct migration | ~8 | types, errors, constants, utils, etc. shared kernel |
| 1:1 Adaptation | ~16 | config, api, security, etc. need new contract adaptation |
| 1:N Split | 2 | runtime (→12 BC) · storage (→7 BC) |
| Semantic redefinition | ~6 | gateway, evaluation, etc. responsibility boundary redefined |
| Reference only | ~3 | Some module code not migrated, reference only |

---

## §23 Migration Wave Roadmap

> **Diagram type: Sequence diagram** — Expresses the sequence and dependency relationships of ten-phase code migration. Does not express internal task decomposition of each phase.

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
   & Governance  providers/tools/workflow/artifacts
   (141 files,   (163 files, 4.5 pd)
    3.5 pd)      │
    │            │
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
    Layer           domain-registry/divisions/plugins
    (124 files,     (78 files, 2.5 pd)
     4 pd)         │
     │             │
     └───────┬───────┘
             ▼
            P9 Operational Maturity
             │  (271 files, 7 pd)
             │
             ▼
            P10 CLI + E2E + Golden + Perf
                (146 files, 4 pd)

Total: ~1,868 files / ~406K lines / 70-100 person-days
(excluding 24 brand-new module developments)
```

### §23.1 Dual-track Parallel Strategy

```text
Lane A (Migration)         Lane B (New Capabilities)
══════════════           ════════════════════════
P0-P2 ──────────────────▶ P0-base: 6 basic new modules (stub interfaces first)
P3-P5 ──────────────────▶ P1-diff: 10 differentiated new modules
P6-P10 ─────────────────▶ P2-enhance: 8 enhanced new modules

New modules that can start early (stub interfaces):
  org-hierarchy (stub single-level org)
  autonomy (stub minimum autonomy level)
  nl-gateway (stub direct-through mode)

New modules that must wait for migration completion:
  agent-lifecycle (depends on P6 OAPEFLIR)
  multi-region (depends on P5 HA Coordinator)
  marketplace (depends on P8 domain-registry)
```

---

## §24 Interaction · Governance · Platform Three-axis Collaboration Diagram

> **Diagram type: Data flow diagram** — Expresses the collaboration signal flow between the three main system axes: interaction (L4) · org-governance (L5) · platform (L1-2). Does not express the invocation relationships between modules within each axis.

```text
                         ┌──────────────────────┐
                         │   interaction/ (L4)   │
                         │   Intelligent         │
                         │   Interaction Layer  │
                         │   nl-gateway          │
                         │   goal-decomposer     │
                         │   proactive-agent     │
                         │   autonomy            │
                         │   dashboard · ux      │
                         └──────────┬─────────────┘
                                    │
               Task request (via NL parsing) │  ▲  Status push (dashboard subscribes to P5 events)
                                    │  │
                                    ▼  │
┌──────────────────────┐  Contract call  ┌──┴───────────────────────────────────┐
│  org-governance/ (L5)│ ◀═════════════▶│           platform/ (L1-2)           │
│  Organization        │                │           Platform kernel              │
│  Governance Layer    │                │                                      │
│                      │ SSO identity  │  P1 Interface ──▶ P2 Control         │
│  org-model           │────────────────┼──────────▶│  P2 ──▶ P3 Orchestration │
│  approval-routing ───┼────────────────┼──────────▶│  P3 ──▶ P4 Execution     │
│  sso-scim            │ approval result│                │  P4 ──▶ P5 State & Evidence│
│  compliance-engine ──┼────────────────┼──────────▶│                            │
│  knowledge-boundary  │ compliance     │                │                            │
│  delegated-governance│  policy         │                │                            │
└──────────────────────┘                │  AI Runtime Support Stack             │
                                        │  (model-gw · prompt · compliance)    │
                                        └─────────────────────────────────────┘

Signal flow description:
  interaction/ ══task══▶ platform/P1 (user request entry)
  interaction/ ◀══events══ platform/P5 (dashboard data source)
  org-governance/ ══identity══▶ platform/P2/iam (SSO/SCIM sync)
  org-governance/ ══approval══▶ platform/P3/hitl (approval result write-back)
  org-governance/ ══policy══▶ platform/P2/policy-center (compliance policy push)
  platform/ ══query══▶ org-governance/knowledge-boundary (knowledge isolation control)

Three-axis collaboration invariants:
  1. interaction/ and org-governance/ do not communicate directly; via platform/ relay
  2. platform/ does not actively call upper-layer systems; only through event notifications
  3. All cross-axis communication uses envelope format defined by platform/contracts/
```

---

## Appendix A: Module Statistics Summary

> Statistics scope: Planning-level figures, not final file counts. Include migration mappings and new placeholder module estimates.

| Top-level Directory | Layer | Secondary Modules | Migrated Files | New Files | Total |
|----------------------|-------|-------------------|----------------|-----------|-------|
| `platform/` | Layer 1-2 | 10 (incl. P1-P5 + AI Ops + contracts + shared) | ~608 | ~53 | ~661 |
| `domains/` | Layer 3 | 10 | ~18 | ~8 | ~26 |
| `interaction/` | Layer 4 | 6 | 0 | ~24 | ~24 |
| `org-governance/` | Layer 5 | 6 | ~2 | ~18 | ~20 |
| `scale-ecosystem/` | Layer 6 | 6 | ~27 | ~18 | ~45 |
| `ops-maturity/` | Layer 7 | 11 | ~12 | ~44 | ~56 |
| `plugins/` | Cross-layer | 5 | ~20 | 0 | ~20 |
| `sdk/` | Cross-layer | 4 | ~78 | ~5 | ~83 |
| `apps/` | Entry | 3 | 0 | ~3 | ~3 |
| **src/ Total** | | **61** | **~765** | **~173** | **~938** |

## Appendix B: High-risk Split Statistics

| Split Target | Bounded Contexts | Methods/Files | Estimated Duration |
|--------------|------------------|---------------|---------------------|
| P4 `core/runtime/` | 12 BC | 101 files / 30K lines | ~20 person-days |
| P5 `AuthoritativeTaskStore` | 7 BC | ~278 methods / 21 repos | ~20 person-days |

## Appendix C: Diagram Index

| Section | Diagram Type | v1.5 Change Description |
|---------|--------------|------------------------|
| §1 | Structure diagram | Corrected visual weight; divided into three visual bands |
| §2 | Data flow diagram | Annotated AI operations as parallel support |
| §3 | Structure diagram | Split into 3 responsibility areas |
| §4 | Structure diagram | Reorganized into 4 areas |
| §5 | Structure diagram | Added module boundary rules table |
| §6 | Structure diagram + Sequence diagram | Split into 3 independent diagrams |
| §7 | Structure diagram | **Rewritten**: 7 BC grouping + Truth/Derived/Evidence three zones |
| §8 | Structure diagram | **Rewritten**: Renamed + parallel support positioning note |
| §9 | Data flow diagram | **Rewritten**: Upgraded to platform protocol diagram + protocol chain series |
| §10~§15 | Structure diagram | Added "expresses/does not express" declarations |
| §16 | Data flow diagram | Added "expresses/does not express" declaration |
| §17 | Constraint diagram | Added "expresses/does not express" declaration |
| §18 | Structure diagram | Added "expresses/does not express" declaration |
| §19 | Structure diagram | **New**: P4 Runtime 12 BC special diagram |
| §20 | Structure diagram | **New**: P5 Storage 7 BC special diagram |
| §21 | Structure diagram | **New**: Cross-cutting capability control plane diagram |
| §22 | Structure diagram | **New**: Old system → new platform landing diagram |
| §23 | Sequence diagram | **New**: Migration wave roadmap |
| §24 | Data flow diagram | **New**: Three-axis collaboration diagram |
| §25 | Structure diagram + Constraint diagram | **New**: Cross-platform UI Monorepo and frontend/backend boundary |
| §26 | Structure diagram | **New**: Mission · Yono · Test/Deployment support incremental diagram |
| §25 | Structure diagram + Constraint diagram | **New**: Cross-platform UI Monorepo and frontend/backend boundary |
| §26 | Structure diagram | **New**: Mission · Yono · Test/Deployment support incremental diagram |

---

## §25 Cross-platform UI Monorepo and Frontend/Backend Boundary

> **Diagram type: Structure diagram + Constraint diagram** — Expresses the `ui/` monorepo internal structure and the strict boundary between frontend and backend. Does not express runtime communication protocols.

```text
ui/ Monorepo Structure
═══════════════════════════════════════════════════════════════════
┌─────────────────────────────────────────────────────────────────┐
│ ui/                                                              │
│                                                                  │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────────┐  │
│  │    apps/    │  │   packages/     │  │       tools/        │  │
│  │             │  │                  │  │                     │  │
│  │ web/       │  │ shared/         │  │ codegen/            │  │
│  │ electron-w │  │   platform/      │  │ mock-server/        │  │
│  │ electron-m │  │   api-client/    │  │                     │  │
│  │ tauri-win  │  │   hooks/         │  └─────────────────────┘  │
│  │ tauri-mac  │  │   utils/         │                          │
│  │ react-native│  │   ui-kit/        │  ┌─────────────────────┐  │
│  │            │  │   constants/     │  │       tests/       │  │
│  │            │  │                  │  │                     │  │
│  │            │  ├──────────────────┤  │ unit/               │  │
│  │            │  │   features/      │  │ integration/        │  │
│  │            │  │                  │  │ e2e/                │  │
│  │            │  │  dashboard/     │  │ features/           │  │
│  │            │  │  mission-ctl/   │  │ apps/               │  │
│  │            │  │  workflow-bldr/ │  │ a11y/               │  │
│  │            │  │  evaluations/   │  │ playwright/         │  │
│  │            │  │  settings/      │  │                     │  │
│  └─────────────┘  │  ...           │  └─────────────────────┘  │
│                  └──────────────────┘                           │
└─────────────────────────────────────────────────────────────────┘

Frontend/Backend Boundary Rules:
  ui/ ──allowed──▶ public API / OpenAPI / generated schemas / typed mock seam
  ui/ ──forbidden──▶ src/platform/* internal implementation, truth store, worker runtime, private services
  feature ──allowed──▶ shared/api-client + hooks returning ViewModel
  feature ──forbidden──▶ directly consuming backend DTOs or directly calling Electron/Tauri/RN APIs
```

---

## §26 Mission · Yono · Test/Deployment Support Incremental Diagram

> **Diagram type: Structure diagram** — Expresses the new authoritative modules discovered during v1.3 code structure review, and their ownership relationship with the original seven layers/five planes.

```text
v1.3 Incremental Structure
┌─────────────────────────────────────────────────────────────────────────────┐
│  Mission Long-term Goal Governance                                          │
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
│  Yono Business Domain Instance                                              │
│                                                                              │
│  domains/yono/                                                               │
│  ┌──────────────────────────┐                                                │
│  │ DomainDescriptor          │──▶ registry/                                  │
│  │ workflow/risk/eval/SLA    │──▶ platform/P3/P4                             │
│  │ tool bundle / ownership   │──▶ org-governance + control-plane             │
│  └──────────────────────────┘                                                │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Test and Deployment Support                                                │
│                                                                              │
│  src/testing/        tests/invariants/       tests/leaks/                    │
│  Test Common Fac.   Arch.Invariant Guard   Memory/Handle Leak Detection   │
│                                                                              │
│  src/benchmarks/     tests/performance/     deploy/                          │
│  Performance Entry  Capacity/Benchmark     Helm · Terraform · Prometheus · Chaos │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Appendix A: Module Statistics Summary

> Statistics scope: 2026-05-18 current workspace structure snapshot; detailed figures see `01-code-structure.md` v1.3. Historical planning estimates no longer used as acceptance criteria.

| Top-level Directory | Layer | Current Structure Status | Key Additions/Calibration |
|---------------------|-------|-------------------------|---------------------------|
| `platform/` | Layer 1-2 | Authoritative core area | Mission, outbox, side-effect-ledger, reconciliation, degradation |
| `domains/` | Layer 3 | Expanded | `yono/` as business domain instance |
| `interaction/` | Layer 4 | Expanded | dashboard/autonomy/goal/nl/proactive/ux |
| `org-governance/` | Layer 5 | Expanded | approval-routing, SSO/SCIM, delegated governance |
| `scale-ecosystem/` | Layer 6 | Expanded | marketplace, billing, SLA, multi-region, runtime-services |
| `ops-maturity/` | Layer 7 | Expanded | chaos, capacity, edge, debugger, explainability |
| `plugins/` | Cross-layer | Stable | Plugin ecosystem |
| `sdk/` | Cross-layer | Expanded | CLI, admin/harness/workbench SDK |
| `apps/` | Entry | Stable | Backend composition startup |
| `ui/` | Frontend | New authoritative area | Web/Electron/Tauri/Mobile + packages/features/shared |
| `tests/` | Testing | Expanded | unit/integration/e2e/golden/performance/invariants/leaks |
| `src/testing/` / `src/benchmarks/` | Support | New/Calibrated | Test infrastructure and performance entry |
