# Operations Roadmap

> This file consolidates 4 roadmap documents under `docs_zh/operations/`.
> Generated from task 9A of `research/reference-alignment/reference_cross_analysis_and_todolist.md`.
> Original files: development_sequence_roadmap.md, architecture_upgrade_roadmap.md, industrial_production_readiness_roadmap.md, system_improvement_roadmap.md

---

## 1. Development Sequence Roadmap

Source: `development_sequence_roadmap.md`

### 1.1 Goal

Transform all stabilization backlogs from "issue lists" into "development sequence", answering:

- If starting implementation now, which batch first
- What can run in parallel
- What must wait for prerequisites
- How far each batch must go before entering the next batch

### 1.2 Usage Principles

- High priority does not mean can do immediately, must follow dependency order
- First do foundation that reduces system instability, then do capability enhancements
- If a batch's exit criteria not met, should not enter the next batch
- Before Stable Core is stable, do not expand to remote workers, marketplace, multi-tenant or complex evolution

### 1.3 Overall Rhythm

```
Week 1:  State / Event / Workflow
Week 2:  Runtime / Tool / Cancel
Week 3:  DB / Recovery / Reconcile
Week 4:  Observability / Ops / Takeover
Week 5:  Quality Gates / Golden Tasks / Rollback
Phase 1b Batch 1: Orchestration / Task Board
Phase 1b Batch 2: Compaction / Edit
Phase 1b Batch 3: Replay / Backpressure
Week 6+:  Remote / PG-Redis / Enterprise Prep
```

### 1.4 Batch Status Enum

| Status | Meaning |
| --- | --- |
| `not_started` | Not yet entered that phase or batch |
| `ready` | Passed gate, can start, but not yet started |
| `in_progress` | Started, pushing forward |
| `blocked` | Started but has blockers |
| `done` | Reached current phase acceptance line |

---

## 2. Architecture Upgrade Roadmap

Source: `architecture_upgrade_roadmap.md`

### 2.1 Goal

Define the 4 priority architecture upgrade lines when advancing from current Phase 1a baseline to the final platform goal.

### 2.2 Current Priority

1. `runtime → execution plane`
2. `transaction storage → data plane`
3. `approval/sandbox/budget → governance control plane`
4. `billing/tenant → tenant and monetization plane`

### 2.3 Overall Principles

- First clarify platform layer design, then enter corresponding implementation
- Each upgrade line must have contract, phase goals and exit criteria
- Not allowed to directly do long-term platformization implementation without upper-level contract

---

## 3. Industrial Production Readiness Roadmap

Source: `industrial_production_readiness_roadmap.md`

### 3.1 Goal

Define the advancement path from "runnable framework" to "industrial-grade production system".

Supplementary notes:

- This section describes industrial-grade target state roadmap, not current phase1-4 authoritative release level.
- Items involving `blue-green / canary / staged / auto rollback` should be viewed as industrial-grade or `M2` expansion goals in current repository口径; must not be inversely interpreted as current `off / suggest / shadow` release level completion.

### 3.2 Core Principles

- First supplement reliability, operations, security, rollback and manual takeover
- Do not substitute production survival capabilities by continuing to expand business features
- Any "industrial-grade" declaration must have contract, runbook, alerts and rollback path support

### 3.3 P0 Roadmap (Production Blockers)

1. Task lease + fencing token
2. PostgreSQL / Redis production roadmap
3. Distributed locks
4. Idempotency and side effects system
5. SLO / Alerts / Runbook
6. Blue-green / canary / rollback
7. Enterprise secret management
8. Audit chain and retention policy
9. Administrator control plane and manual takeover
10. Prompt / Model / Policy governance
11. LLM recommendations, code adjudication boundaries

### 3.4 P1 Roadmap (Enterprise Governance and Isolation Strengthening)

- Multi-tenant isolation strengthening
- Data classification and grading
- Compliance evidence chain
- Resource pool and tenant quota isolation
- On-call and handover system
- Environment layering and configuration center governance
- Architecture governance and schema version governance
- Supply chain and dependency security

### 3.5 Capacity Planning Deliverables

- `CapacityForecast`: Enters weekly operations rhythm in form of auditable forecast results.
- `CapacityScenario`: Records scaling/shrinking assumptions and impact scope, avoids verbal deduction.
- `CapacityAlert`: Triggers alerts when forecast values approach thresholds, not just after resource exhaustion.
- `CapacityRecommendation`: Structures recommendation actions for shared operator and self-service paths.
- trace / RCA / business-technical dual dashboard
- Workflow static analysis and compensation closed-loop

### 3.5 P2 Roadmap (Scale and HA Enhancement)

- HA coordinator
- Hot-upgrade and lossless migration
- Anomaly detection
- Automatic止损
- Cross-region deployment
- Remote coordination and remote disaster recovery
- Memory quality and decay governance
- License / capability engineering layering
- More mature HITL experience and explainability

### 3.6 Roadmap

```
Phase 1a/1b: Runnable Foundation
        ↓
P0: Production Survival Capabilities
        ↓
P1: Enterprise Governance and Isolation Strengthening
        ↓
P2: Scale and HA Enhancement
```

---

## 4. System Improvement Roadmap

Source: `system_improvement_roadmap.md`

### 4.1 Goal

Organize current system-level improvement recommendations into formal advancement roadmap, avoid improvement items staying only in chat conclusions.

### 4.2 Execution Principles

- First tighten the 5 foundations: status, errors, events, recovery, security
- First clear the instability sources most likely to cause production incidents, then consider feature expansion
- First stabilize capabilities truly needed for current phase, then enter next phase
- Any beyond-phase capability not entering formal phase goals defaults to not implemented

### 4.3 Improvement Priority

**P0 (Must do first)**:

- Status machine and transition audit
- Error code normalization
- Event reliability (Tier-1/Tier-2)
- Recovery and replay completeness

**P1 (High priority support items)**:

- Session / Execution unified model
- Multi-tenant isolation
- Resource limits and budget control

**P2 (Do after stable)**:

- Complex orchestration and multi-agent
- External provider extension
- Cross-region deployment

---

## 5. Unified Status Enum (Cross-document Consistency)

| Planning Status | Meaning |
| --- | --- |
| `not_started` | Not yet entered that phase or batch |
| `ready` | Passed gate, can start, but not yet started |
| `in_progress` | Started, pushing forward |
| `blocked` | Started but has blockers |
| `done` | Reached current phase acceptance line |

| Todo List Status | Meaning |
| --- | --- |
| `[todo]` | Scheduled but not yet started |
| `[doing]` | Being implemented |
| `[blocked]` | Has blockers |
| `[done]` | Completed and wrote back progress |

---

## 6. Planning Document Maintenance Rules

- On phase boundaries, non-goals, allowed scope changes → modify `implementation_plan.md`
- On development sequence, dependencies, batch switches → modify `development_sequence_roadmap.md` (integrated into this document)
- On actual status changes → update `project_progress_tracker.md`
- Current short-term active items → maintain current snapshot in `project_progress_tracker.md`

---

## 7. Reference Documents

- Platform skeleton: `docs_zh/architecture/00-platform-architecture.md`
- Migration boundaries: `docs_zh/migration/01-migration-scope.md`
- Code architecture reference: `docs_zh/architecture/02-code-architecture-reference.md`
- Coverage matrix: `docs_zh/analysis/00-architecture-coverage-matrix.md`