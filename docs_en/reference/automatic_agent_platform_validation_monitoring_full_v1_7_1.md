# Automatic Agent Platform — Complete Validation and Real-Time Monitoring Plan

> **Version**: v1.7.5 — Product Validation Closure / v2.0 Baseline Candidate
> **Status**: `repo_validation_tasks_implemented`
> **Applicable System**: Automatic Agent Platform
> **First Validation Business**: LLM Research Intelligence Mission
> **Core Goal**: Prove that the platform possesses quasi-production capability in the Research Intelligence scenario that is executable, observable, auditable, replayable, blockable, signable, and reviewable.
> **Terminology Strategy**: Weaken `Step`; uniformly use `PlanGraphBundle / NodeRun / NodeAttempt` to describe execution units. `Step` is only allowed to appear in legacy compatibility, external document references, or migration descriptions.
> **Roadmap Stage and Validation Phase Separation**: Roadmap Stage represents product/business advancement stages; Validation Phase represents validation phases; Runtime Ring / Release Ring represents runtime release levels. The three must not be mixed.

---

## Changelog

| Version | Changes |
| --- | --- |
| v1.0 | Established the main framework of the Research Intelligence Mission validation plan |
| v1.1 | Added Skills / Plugins / Tool Registry / Connector Runtime |
| v1.2 | Added RTM, Evidence Bundle, CI/CD, OTel, data governance, quality scoring, stress testing, status matrix, DR, Incident, RACI |
| v1.3 | Added OAPEFLIR stage matrix, Mission/Task/Session creation strategy, Security/IAM, Operator Cockpit, Metric Definition, Example Validation Run |
| v1.4 | Added RSM/CAS/Lease/Fencing, SideEffect, Config, Model Gateway, Persistence, SLO, Tenant Scheduling, Event/Gate/Metric Registry, Freeze Checklist |
| v1.5 | Fixed event naming, plugin signature rules, RTM Gate/Metric alignment; added Dispatch, Test Quality, Autonomy, Rollout, Docs Drift |
| v1.6 | Completed closed loops for Gate/Metric/Event/CI/Runbook five Registry categories; added Artifact lifecycle, L40S conditional validation, Cost attribution extension |
| **v1.7** | **Completed data governance Gate/Metric/CI/Runbook, Evidence Bundle tamper resistance, Event Payload Schema Registry, Runbook machine metadata, Mission-specific SLO, UI permission chain, full metric closed loop** |
| **v1.7.1** | **Freeze Patch: merged Evidence Bundle Gate sub-items, completed hitl-e2e CI Job, clarified eventName segment regex, clarified that `aa.*` span names do not enter Metric Registry Closure** |
| **v1.7.2** | **Review Patch: distinguished target state from current in-repo executable baseline; corrected Mission attribution rules, CI Job Registry, machine Registry artifacts, and over-completion wording of metric definitions** |
| **v1.7.3** | **Repo Closure Patch: implemented platform validation machine registry, CI job scripts, registry artifact exporter, monitoring metric map, and exporter/alert/dashboard guarding tests** |
| **v1.7.4** | **Machine Artifact Closure: exported schemas, event payload schema refs, generated registry types, closure reports, and extended Evidence Bundle closed-loop validation to machine artifact integrity** |
| **v1.7.5** | **Product Validation Closure: completed Dashboard/UI acceptance matrix, Research governance/rubric/golden/reviewer artifacts, observability semantic checker, capacity/soak/GPU validator, scorecard/freeze readiness reports** |

## Review Patch Conclusion

This review concludes: this document is suitable as a **Validation / Monitoring target plan**, but in v1.7.1, some "should-have-before-freeze" design items were written as "already-in-repo-and-accepted" acceptance facts. To prevent testing, release, and operations from advancing based on non-existent commands or artifacts, this document uniformly adopts a three-layer scope:

| Layer | Meaning | Allowed Wording |
| --- | --- | --- |
| Current In-Repo Baseline | Code, scripts, configurations, or tests already in the repository and directly locatable | `exists`, `executable`, `in-repo baseline` |
| Pre-Freeze Target | Machine contracts that must be completed or exported before freeze/sign-off | `must be completed`, `target state`, `pre-freeze` |
| External Acceptance | Depends on real environment, real credentials, real on-call, or external systems | `environment acceptance`, `external wiring`, `cannot be proven by this document alone` |

### Findings and Revisions in This Review Round

| Issue | Root Cause | Revision Conclusion | In-Repo Basis |
| --- | --- | --- | --- |
| Document top directly marked as `freeze_ready_candidate` | The target Gate/Registry table is complete, but machine registry artifacts and a batch of CI job commands have not yet formed one-to-one implementations in the repo | In-repo tasks have landed, status changed to `repo_validation_tasks_implemented`; the actual freeze is still only established after the Chapter 51 environment conditions are met | `package.json`, `config/validation/platform-validation-registry.json`, `scripts/validation/platform-validation-closure.mjs` |
| CI Job Registry wrote a large number of currently non-existent `npm run ...` commands | Expected job names were directly written as existing scripts | Chapter 33 has added real package scripts and machine registry; `tests/unit/scripts/platform-validation-closure.test.ts` will prevent job/script mapping from mismatching again | `package.json`, `config/validation/platform-validation-registry.json` |
| Unattributed Task automatically fell to `default_system_mission` | Wording lagged behind MissionResolver's current implementation | Low/medium risk without Mission can create ad hoc Mission; high-risk and side-effect tasks without Mission must fail-closed | `src/platform/five-plane-interface/api/http-server/task-routes.ts`, Mission E2E |
| `aa.*` Metric Registry was written as the sole current source of truth for the exporter's metrics | Target observability semantics were mixed with Prometheus exporter / alert rules current exposure names | Chapter 48 declares that `aa.*` is the target validation registry; the current runtime monitoring baseline is based on the exporter, Prometheus rules, and Grafana dashboard | `src/platform/shared/observability/prometheus-metrics-exporter.ts`, `deploy/prometheus/rules/automatic-agent.yml` |
| Prometheus names and unit mapping have not become explicit freeze conditions | Exporter, dashboard, and alert rules each evolved; the document only registered target metrics | Metric map and closure test have been added; HTTP latency, queue, worker, DLQ, outbox, OAPEFLIR latency alerts are all bound to the current exporter exposure names, no longer referencing stale metrics | `config/validation/platform-monitoring-metric-map.json`, `automatic-agent.yml`, `prometheus-alerts.test.ts` |
| Machine Event/Gate/Metric/Runbook Registry artifacts were written as already-existing premises | Design tables and appendices landed before machine artifacts | Machine registry, closure, and artifact exporter have been added; the TypeScript event registry is still the event source of truth; exported snapshots, schemas, generated registry types, and closure reports are all generated by the export chain | `src/platform/five-plane-state-evidence/events/event-registry.ts`, `scripts/validation/export-platform-validation-artifacts.ts` |

> This document still retains the complete target design; the purpose of the review patch is not to delete the target, but to prevent "document closed-loop" from being misread as "code, CI, environment, and signoff are all closed-loop."

## Per-Chapter Implementation Confirmation

Marking rule: only chapters where in-repo code, configuration, script, or test evidence can be located are appended with `done` after the title. Boundary descriptions, schematic diagrams, RACI, examples, freeze/sign-off, and acceptance chapters that depend on real environment do not mistake "document is written" for "implementation is complete".

| Chapter | Conclusion | Verification Basis |
| --- | --- | --- |
| 1 Document Goal and Validation Boundary | Descriptive chapter | Defines validation scope, not an implementation task |
| 2 First Validation Business Selection | Descriptive chapter | Business selection description, not an implementation task |
| 3 Core Object Relationship | done | `src/platform/contracts/executable-contracts/`, Mission/Harness/Node contract tests |
| 4 Mission / Task / Session Creation Strategy | done | `src/platform/five-plane-control-plane/mission/`, task routes, Mission E2E |
| 5 Validation Principles | done | event truth, budget, evidence, audit, replay, tool/plugin validation tests |
| 6 Roadmap Stage and Validation Phase | Descriptive chapter | Stage definition enters subsequent gate/registry, not implemented separately |
| 7 System Overall Architecture Diagram | Descriptive chapter | Architecture diagram, not implemented separately |
| 8 Real-time Monitoring System | done | Prometheus exporter, Grafana dashboard, validation metric map |
| 9 Dashboard Design | done | Dashboard VM/Web displays validation drilldown trail and operator workflow checks; product validation exports UI report |
| 10 Alert System | done | `deploy/prometheus/rules/automatic-agent.yml`, Alertmanager, golden tests |
| 11 Full Coverage Validation Method | done | layered tests, coverage manual, registry gates, validation jobs |
| 12 Test System | done | `package.json` validation scripts, unit/integration/e2e/invariant/perf/golden suites |
| 13 Quality Scorecard | done | `platform-validation-readiness.ts` provides weights, hard gates, and scorecard decision; `validation:product` exports scorecard report |
| 14 Release / Graduation Gate | done | Release/freeze conditions are uniformly evaluated by scorecard/freeze readiness service and registry/evidence reports |
| 15 Blocking Strategy | done | Gate Registry, Mission live guard, budget/sideeffect/security/runtime guard tests |
| 16 Evidence Bundle | done | stable evidence bundle, validation artifact exporter, bundle closure tests |
| 17 OAPEFLIR Stage-level Validation | done | OAPEFLIR stage emitter/FSM, research E2E, event registry |
| 18 Skills / Plugins / Tool Registry / Connector Runtime Validation | done | plugin SPI/executor, tool registry, connector framework, sandbox/egress tests |
| 19 Security / Tenant / IAM Validation | done | IAM, egress, tenant isolation, crypto/security validation tests |
| 20 Operator Cockpit / UI Validation | done | Dashboard/Task/Workflow/HITL/Incident surfaces and workflow matrix are guarded by UI report and feature tests |
| 21 Runtime State / CAS / Lease / Fencing Validation | done | runtime state machine, CAS/fencing/lease services and tests |
| 22 SideEffect / Reconciliation Validation | done | SideEffect lifecycle/reconciliation invariants and E2E |
| 23 Config Center / Drift / Rollout Validation | done | config center, drift, impact, hot reload, rollout tests |
| 24 Model Gateway Provider / Streaming Validation | done | model gateway provider routing/streaming/fallback/budget tests |
| 25 Persistence / Repository / Migration Validation | done | SQLite/PG repositories, migration/portability/replay/parity tests |
| 26 Dispatch / Queue / Worker Pool Validation | done | dispatcher, worker pool, queue/backpressure/fair ordering tests |
| 27 Test Quality Governance | done | exclusion/hygiene/quality audits, mutation entrypoints, reality tests |
| 28 Autonomy / Runtime Mode Validation | done | autonomy validation and runtime-mode propagation tests |
| 29 Prompt / Skill / Knowledge Rollout Validation | done | prompt rollout, learning/promotion, improve rollout services/tests |
| 30 Documentation / ADR / Contract Drift Validation | done | docs canonical/drift/registry scripts and tests |
| 31 Requirement Traceability Matrix | done | Gate/metric/job registry closure protects RTM references |
| 32 Metric Summary | done | Metric Registry and runtime monitoring metric map |
| 33 CI/CD Validation Pipeline | done | machine CI registry plus package scripts |
| 34 Observability Semantic Convention | done | validation semantic conventions solidify span names, required attributes, and high-cardinality label guard |
| 35 Research Data Governance | done | ResearchSourceGovernance strict schema, gate decision, schema artifact and data governance tests |
| 36 Research Output Quality Rubric and Feedback Loop | done | rubric scorer, golden set, reviewer agreement/drift reports and product validation evidence |
| 37 Load / Stress / Capacity Validation | done | capacity validation report solidifies smoke/pilot/stress/soak/spike/backpressure profiles and binds `soak:stable` |
| 38 Lifecycle Transition Matrix | done | Mission/NodeRun/Plugin/Artifact lifecycle services and exported lifecycle matrix |
| 39 Backup / Restore / DR Validation | done | stable restore/replay/backup rehearsal paths and DR validation jobs |
| 40 Incident Lifecycle / Postmortem | done | incident-control services, incident E2E, postmortem artifact/template coverage |
| 41 SLO / Error Budget / Burn-rate Validation | done | SLO alerting/tracking and burn-rate tests |
| 42 Tenant Quota / Fair Scheduling Validation | done | fair scheduling, tenant isolation/quota/noisy-neighbor services/tests |
| 43 Local Model / L40S GPU Capacity Validation | done | local GPU capacity validator covers L40S admission, watermark, queue isolation, OOM/unload/fallback report |
| 44 Example Validation Run | Example chapter | Example event sequence, does not represent that the validation run has been signed |
| 45 RACI / Sign-off Matrix | Descriptive chapter | Role and sign-off matrix, not code implementation |
| 46 Event Naming / Event Schema Registry | done | event registry, payload validators, artifact exporter |
| 47 Gate Registry | done | machine gate registry and closure |
| 48 Metric Registry | done | target metric registry export and runtime metric map closure |
| 49 Runbook Registry | done | machine runbook registry and appendix/runbook closure |
| 50 Artifact Lifecycle / Integrity Validation | done | artifact repository/governance/integrity tests |
| 51 Freeze Checklist | done | freeze readiness report checks registry, evidence, projection, SLO, external signoff refs |
| 52 Final Acceptance Criteria | done | scorecard/freeze evaluator consolidates final acceptance conditions into machine decision; real environment results are input through report refs |
| 53 Appendix A: Canonical Event List | Read-only appendix | machine registry source of truth has been implemented, the appendix list itself is not separately marked as implementation complete |
| 54 Appendix B: Test List | done | UI/product/research/capacity/GPU validation tests and scripts complete this appendix's remaining items |
| 55 Appendix C: Dashboard Field List | done | Dashboard product report, UI drilldown trail and runtime dashboard baseline jointly guard the field surface |
| 56 Appendix D: Runbook Registry | done | runbook registry closure validates every `D.*` mapping |
| 57 Appendix E: Machine-Executable Artifact List | done | artifact exporter emits contracts/schemas/generated/reports |

---

## Table of Contents

1. Document Goal and Validation Boundary
2. First Validation Business Selection
3. Core Object Relationship
4. Mission / Task / Session Creation Strategy
5. Validation Principles
6. Roadmap Stage and Validation Phase
7. System Overall Architecture Diagram
8. Real-time Monitoring System
9. Dashboard Design
10. Alert System
11. Full Coverage Validation Method
12. Test System
13. Quality Scorecard
14. Release / Graduation Gate
15. Blocking Strategy
16. Evidence Bundle
17. OAPEFLIR Stage-level Validation
18. Skills / Plugins / Tool Registry / Connector Runtime Validation
19. Security / Tenant / IAM Validation
20. Operator Cockpit / UI Validation
21. Runtime State / CAS / Lease / Fencing Validation
22. SideEffect / Reconciliation Validation
23. Config Center / Drift / Rollout Validation
24. Model Gateway Provider / Streaming Validation
25. Persistence / Repository / Migration Validation
26. Dispatch / Queue / Worker Pool Validation
27. Test Quality Governance
28. Autonomy / Runtime Mode Validation
29. Prompt / Skill / Knowledge Rollout Validation
30. Documentation / ADR / Contract Drift Validation
31. Requirement Traceability Matrix
32. Metric Summary
33. CI/CD Validation Pipeline
34. Observability Semantic Convention
35. Research Data Governance
36. Research Output Quality Rubric and Feedback Loop
37. Load / Stress / Capacity Validation
38. Lifecycle Transition Matrix
39. Backup / Restore / DR Validation
40. Incident Lifecycle / Postmortem
41. SLO / Error Budget / Burn-rate Validation
42. Tenant Quota / Fair Scheduling Validation
43. Local Model / L40S GPU Capacity Validation
44. Example Validation Run
45. RACI / Sign-off Matrix
46. Event Naming / Event Schema Registry
47. Gate Registry
48. Metric Registry
49. Runbook Registry
50. Artifact Lifecycle / Integrity Validation
51. Freeze Checklist
52. Final Acceptance Criteria
53. Appendix A: Canonical Event List
54. Appendix B: Test List
55. Appendix C: Dashboard Field List
56. Appendix D: Runbook Registry
57. Appendix E: Machine-Executable Artifact List

---

# 1. Document Goal and Validation Boundary

## 1.1 Validation Goal

This plan is used to validate whether the Automatic Agent Platform possesses quasi-production capability to carry the first phase of business. Validation is not aimed at "being able to run a Demo", but at the following capabilities:

| Capability | Validation Question |
| --- | --- |
| Correctness | Whether state, budget, evidence, permissions, and output conform to the contract |
| Reliability | Whether worker crash, provider failure, event lag, DB restore can be recovered |
| Security | Whether tenant isolation, IAM, secret, sandbox, egress fail-closed |
| Auditability | Whether every key decision has principal, trace, auditRef, evidenceRef |
| Replayability | Whether Event → Truth → Projection can be rebuilt with diff=0 |
| Observability | Whether trace / metric / log / dashboard can judge system status in real time |
| Extensibility | Whether Skills / Plugins / Tools / Connectors can be safely extended |
| Governability | Whether Prompt / Skill / Knowledge / Config / Policy can be gradually rolled out and rolled back |
| Sign-off | Whether each validation forms an archivable, verifiable Evidence Bundle |

## 1.2 Validation Boundary

The first phase validation uses the **LLM Research Intelligence Mission** as the business carrier, covering the platform's core foundation, and does not cover a fully open third-party Marketplace.

| Scope | Included in v1.7 |
| --- | ---: |
| Mission / Task / Session / Harness / PlanGraph / NodeRun | Yes |
| OAPEFLIR eight stages | Yes |
| Tool Registry / First-party Skills / First-party Plugins / Connectors | Yes |
| Model Gateway / Budget / Cost Attribution | Yes |
| EventBus / Truth / Projection / CAS / Lease / Fencing | Yes |
| HITL / Governance / Knowledge Promotion | Yes |
| Operator Cockpit / Dashboard / Alert / Runbook | Yes |
| Data Governance / Evidence Integrity / Artifact Integrity | Yes |
| Third-party Marketplace | Disabled by default, only validate "must not be enabled early" Gate |
| External Business Mission | Validated in subsequent Roadmap Stages |

---

# 2. First Validation Business Selection

## 2.1 Recommended First Business: LLM Research Intelligence Mission

Selection reasons:

1. **Low side effects**: Main outputs are reports, knowledge entries, evidence packages, with fewer external destructive side effects.
2. **Wide coverage**: Can cover paper ingestion, web scraping, LLM review, evidence linking, knowledge accumulation, HITL, publication governance.
3. **High business value**: Can support research accumulation of Reasoning / Code / Function Call / Agent / Token Efficiency.
4. **Suitable for validating the Mission concept**: Research tasks are usually long-term goals, not a single Agent Session.
5. **Suitable for gradually introducing Skills / Plugins**: Paper Reader, Web Search, Evidence Extractor, Knowledge Writer, Report Generator can all serve as first-party skills.

## 2.2 Not Recommended as the First Business

| Business | Reason for Not Recommending |
| --- | --- |
| Code Agent automatically modifying code | Higher side effects, requires PR sandbox, repo writeback, CI rollback |
| Engineering Ops automated operations | Easily triggers production environment side effects, requires stronger incident governance |
| Quant Trading / Legal / YONO prediction business | High domain risk, requires additional supervision, compliance, business model validation |
| Third-party Marketplace | Complex supply chain and plugin isolation, should be advanced after the core platform is stable |

---

# 3. Core Object Relationship done

## 3.1 Object Definition

| Object | Definition | Authoritative |
| --- | --- | ---: |
| Mission | Long-term goal, continuous workflow, business unit spanning multiple Tasks | Yes |
| Task | Single executable work request under Mission | Yes |
| Session | Human-machine interaction context, can produce Task, but not equal to Task | Partially authoritative |
| HarnessRun | A controlled execution loop, bound to Task / PlanGraph / Budget / Risk | Yes |
| PlanGraphBundle | DAG plan structure, replacing linear `steps[]` | Yes |
| NodeRun | A node's running instance in PlanGraph, replacing legacy step execution | Yes |
| NodeAttempt | One attempt of NodeRun, retryable, multiple attempts | Yes |
| BudgetReservation | Budget reservation before LLM/tool/connector call | Yes |
| SideEffectRecord | Side effect record for all external writes/publications/notifications/connector calls | Yes |
| EvidenceRef | Evidence reference bound to conclusion, decision, output | Yes |
| ArtifactRef | Reference to products such as reports, files, snapshots, evidence packages | Yes |
| SkillDefinition | Reusable platform capability definition, such as Paper Review, Evidence Link | Yes |
| PluginManifest | Plugin/adapter artifact metadata, signature, SBOM, sandbox declaration | Yes |
| ToolInvocationReceipt | Tool invocation audit receipt | Yes |
| ConnectorBinding | External system connector binding and permission boundary | Yes |

## 3.2 Object Relationship Diagram

```mermaid
flowchart TB
    U[User / Operator / Scheduler] --> S[Session]
    U --> M[Mission]
    S -->|create task| T[Task]
    M -->|contains| T

    T --> H[HarnessRun]
    H --> PGB[PlanGraphBundle DAG]
    PGB --> NR[NodeRun]
    NR --> NA[NodeAttempt]

    H --> B[BudgetEnvelope]
    NA --> BR[BudgetReservation]
    NA --> TR[ToolInvocationReceipt]
    NA --> SE[SideEffectRecord]
    NA --> EV[EvidenceRef]
    H --> AR[ArtifactRef]

    Skill[SkillDefinition] --> Tool[ToolDefinition]
    Plugin[PluginManifest] --> Tool
    Connector[ConnectorBinding] --> Tool
    Tool --> TR

    H --> EventBus[Durable Event Bus]
    EventBus --> Truth[Runtime Truth Store]
    EventBus --> Projection[Projection Store]
    Truth --> Dashboard[Operator Cockpit]
    Projection --> Dashboard
```

---

# 4. Mission / Task / Session Creation Strategy done

## 4.1 Creation Rules

| Input Type | Created Object | Rule |
| --- | --- | --- |
| Long-term goal, continuous tracking, cross-task goal | Mission | Must explicitly create Mission |
| Single completable work | Task | Must be parsed by MissionResolver for Mission before dispatch; low/medium risk can be bound to existing Mission or create ad hoc Mission |
| Human-machine dialog, clarification, review | Session | Session can create Task, but cannot replace Task |
| Scheduled research summary | Scheduled Task | Belongs to Research Mission |
| Temporary operator query | Session only | Does not create Task unless execution actions are produced |
| P0 incident repair | Task | Belongs to explicit Incident Mission; dispatch is rejected without authorized Mission |
| High-risk or side-effect one-time request | Task | Must explicitly bind Mission, missionless dispatch is prohibited |
| Low/medium risk unattributed one-time request | Task | MissionResolver can automatically create ad hoc Mission, orphan task is prohibited |

## 4.2 Prohibited Objects

| Prohibited Item | Reason |
| --- | --- |
| Orphan Task | Cannot do budget, evidence, archiving, accountability; current intake should fail-closed when resolution fails |
| Session directly executing side effects | Bypasses Mission/Task/Harness governance |
| PlanStep[] as execution contract | Conflicts with PlanGraphBundle |
| Step as main UI terminology | Should display NodeRun / NodeAttempt |
| Task directly writing Truth bypassing RSM | Violates state machine and event-driven invariants |

---

# 5. Validation Principles done

## 5.1 All Validation Must Be Event-Driven

All authoritative state changes must produce `PlatformFactEvent`, and Truth / Projection can be rebuilt from events.

## 5.2 All Execution Must Be Budget-First

Whenever an LLM / tool / connector / embedding / reranker / external API call occurs in any stage, `reserveBudget()` must be called first, and `settleBudget()` after completion.

## 5.3 All Conclusions Must Be Evidence-Bound

Research conclusions, risk judgments, quality scores, knowledge promotion, release decisions must be bound to EvidenceRef.

## 5.4 All Validation Must Be Replayable

Validation results must be reviewable through Event Log, Truth Snapshot, Artifact, and Evidence Bundle.

## 5.5 All Writes Must Be Auditable

Writes must include principal, tenantId, traceId, auditRef, expectedVersion, leaseId / fencingToken.

## 5.6 Capability Extension Layer Is a First-Class Validation Object

Skill, Tool, Plugin, Connector are not auxiliary capabilities but core objects that must be tested in Phase 1.

---

# 6. Roadmap Stage and Validation Phase

## 6.1 Roadmap Stage

| Roadmap Stage | Business Scope |
| --- | --- |
| Stage 1 | Research Intelligence Mission |
| Stage 2 | Supervised Code Agent Mission |
| Stage 3 | Engineering Ops Mission |
| Stage 4 | External Business Mission |
| Stage 5 | Marketplace / Third-party Ecosystem |

## 6.2 Validation Phase

| Validation Phase | Goal | Pass Condition |
| --- | --- | --- |
| validation_phase_0 | Static / Contract / Schema | Contract, schema, types, event, metric, gate registry all pass |
| validation_phase_1 | Single Task E2E | A single Research Task passes the full link from input to Evidence Bundle |
| validation_phase_2 | Multi-task Mission | Multi-task Research Mission runs stably |
| validation_phase_3 | Reliability / Security / Chaos | Failure, attack, recovery, replay, DR pass |
| validation_phase_4 | Pre-production Soak | Continuous operation, monitoring, alerting, SLO, cost, quality meet standards |

---

# 7. System Overall Architecture Diagram

```mermaid
flowchart LR
    subgraph Interface["Interface Plane"]
        NL[NL Gateway]
        API[HTTP API]
        WS[WebSocket / SSE]
        UI[Operator Cockpit]
    end

    subgraph Control["Control Plane"]
        IAM[IAM / RBAC / Tenant]
        Policy[Policy Engine]
        Risk[Risk Engine]
        HITL[HITL / Approval]
        Config[Config Center]
        Budget[Budget Guard]
    end

    subgraph Orchestration["Orchestration Plane"]
        Mission[Mission Manager]
        Task[Task Manager]
        OAPEFLIR[OAPEFLIR FSM]
        Harness[Harness Runtime]
        Planner[PlanGraph Builder]
        SkillReg[Skill Registry]
    end

    subgraph Execution["Execution Plane"]
        Dispatch[Dispatcher / Queue]
        Worker[Worker Pool]
        RSM[Runtime State Machine]
        ToolReg[Tool Registry]
        ModelGW[Model Gateway]
        Sandbox[Sandbox / Egress]
        SideEffect[SideEffect Manager]
    end

    subgraph State["State & Evidence Plane"]
        EventBus[Durable Event Bus]
        Truth[Truth Store]
        Projection[Projections]
        Evidence[Evidence Store]
        Artifact[Artifact Store]
        Knowledge[Knowledge Store]
        CAS[CAS / Lease / Fencing]
    end

    subgraph Reliability["Reliability / Security Fabric"]
        Metrics[Metrics]
        Traces[Traces]
        Logs[Structured Logs]
        Alerts[Alerts]
        Runbooks[Runbooks]
        DR[Backup / Restore / Replay]
    end

    NL --> API --> Policy
    UI --> API
    API --> Mission --> Task --> Harness
    Policy --> Risk --> HITL
    Harness --> OAPEFLIR --> Planner --> Dispatch
    Dispatch --> Worker --> RSM
    Worker --> ToolReg --> Sandbox
    Worker --> ModelGW
    ToolReg --> SideEffect
    RSM --> EventBus --> Truth
    EventBus --> Projection
    Worker --> Evidence
    Harness --> Artifact
    Evidence --> Knowledge
    CAS --> RSM
    Metrics --> Alerts --> Runbooks
    EventBus --> DR
```

---

# 8. Real-time Monitoring System done

## 8.1 Monitoring Layering

| Layer | Monitoring Object |
| --- | --- |
| Business | Mission success, Research quality, Evidence coverage |
| Runtime | HarnessRun, NodeRun, NodeAttempt, Worker, Queue |
| Governance | HITL, Policy, Risk, Autonomy, Config drift |
| Extension | Skill, Tool, Plugin, Connector, Sandbox, Egress |
| State | EventBus, Truth, Projection, CAS, Lease, Fencing |
| Provider | Model Gateway, usage, finish_reason, fallback, cost |
| Security | Tenant isolation, IAM, Secret, PII, Data governance |
| UI | Operator action latency, permission rendering, dashboard freshness |

---

# 9. Dashboard Design done

The Dashboard must support drilldown from Mission to:

```text
Mission → Task → HarnessRun → PlanGraphBundle → NodeRun → NodeAttempt → Tool/Model/Connector → Evidence/Artifact
```

## 9.1 Core Panels

| Panel | Content |
| --- | --- |
| Mission Overview | active/completed/failed missions, SLO, quality, cost |
| Runtime Execution | HarnessRun, NodeRun, queue, worker, lease, stuck runtime |
| OAPEFLIR Stage | stage progress, stage failure, stage skip, replan |
| Tool / Plugin Runtime | tool qps, receipt coverage, sandbox violation, signature failure |
| Model Gateway | provider latency, streaming completion, usage coverage, fallback |
| Evidence / Knowledge | evidence coverage, knowledge promotion, artifact integrity |
| Security / Tenant | cross-tenant denial, secret access, data governance |
| CI / Validation | gate status, test quality, mutation score, registry closure |
| Operator Cockpit | HITL queue, P0 alerts, runbook links, action latency |

---

# 10. Alert System done

Alert is only used for runtime trigger description; the formal blocking conditions are subject to the **Gate Registry**.

| Severity | Response Goal | Example |
| --- | --- | --- |
| P0 | Immediate block / fail-closed | cross-tenant read, stale fencing write, budget missing before tool |
| P1 | Degrade / pause rollout / human intervention | projection lag, provider streaming missing usage |
| P2 | Observe / schedule fix | dashboard stale, low mutation score on noncritical module |
| P3 | Statistical optimization | cost trend, quality drift warning |

---

# 11. Full Coverage Validation Method done

The "full coverage" in this document refers to **risk, contract, lifecycle, observability, and acceptance evidence coverage**, not a claim that the current repository has reached 100% code coverage. Code coverage facts, test exclusion audits, and supplementary testing routes are subject to `docs_zh/quality/00-full-coverage-test-manual.md`, coverage reports, and CI gate.

## 11.1 Coverage by Five Planes

| Plane | Validation Object |
| --- | --- |
| Interface | API, WS, NL Gateway, Operator Cockpit |
| Control | IAM, Policy, Risk, HITL, Budget, Config |
| Orchestration | Mission, Task, OAPEFLIR, Harness, PlanGraph |
| Execution | Dispatcher, Worker, RSM, Tool, Model, Sandbox |
| State & Evidence | EventBus, Truth, Projection, Evidence, Knowledge, Artifact |

## 11.2 Coverage by Lifecycle

All core objects must cover:

```text
created → validated → active/running → blocked/retrying → terminal → archived/replayed
```

## 11.3 Coverage by Capability Extension Layer

Must cover:

```text
SkillDefinition
SkillRegistry
ToolDefinition
ToolRegistry
ToolInvocationRequest
ToolInvocationReceipt
PluginManifest
PluginLifecycle
ConnectorBinding
ConnectorRuntime
SandboxPolicy
EgressPolicy
CapabilityProfile
```

---

# 12. Test System done

| Test Type | Goal |
| --- | --- |
| Unit | Single module behavior correctness |
| Contract | Type, schema, event, API, registry alignment |
| Integration | Multiple real services combined, pure mocks pretending to be integration is prohibited |
| E2E | Research Mission full link |
| Replay | Event → Truth → Projection rebuild diff=0 |
| Chaos | provider failure, worker crash, DB restore, network failure |
| Security | tenant isolation, SSRF, path traversal, secret leak, PII redaction |
| Test Quality | no-op assertion, fake concurrency, mutation score, fixture schema |
| UI E2E | operator workflow, permission rendering, HITL, dashboard freshness |
| Load / Soak | concurrency, backpressure, memory growth, long-term stability |

---

# 13. Quality Scorecard done

Scorecard is used for comprehensive judgment, but **any P0 hard gate failure overrides the Scorecard score**.

| Dimension | Weight |
| --- | ---: |
| Functional correctness | 20 |
| Runtime reliability | 15 |
| State / Event / Replay consistency | 15 |
| Security / Tenant / IAM | 15 |
| Evidence / Research quality | 10 |
| Extension runtime safety | 10 |
| Observability / Runbook readiness | 10 |
| Cost / Budget attribution | 5 |

Judgment:

```text
score >= 90 and no P0/P1 open issue → pass
score >= 85 and only P2 waiver → conditional pass
any P0 hard gate failure → fail
```

---

# 14. Release / Graduation Gate done

## 14.1 Roadmap Stage 1 Entering Quasi-Production

Must pass:

```text
validation_phase_0 ~ validation_phase_4
Gate Registry all P0/P1 pass
Metric / Event / Runbook / CI / Evidence Bundle registry closed loop
SLO profile for Research Intelligence Mission meets standard
```

## 14.2 Entry Conditions for Subsequent Roadmap Stages

Code Agent, Engineering Ops, External Business Mission must additionally pass their respective side effects, permissions, rollback, and domain compliance Gates.

---

# 15. Blocking Strategy done

All blocking strategies are subject to Gate Registry. The following situations must fail-closed:

```text
cross-tenant read/write
secret access without audit
tool/model call without budget
external side effect without SideEffectRecord
state write without CAS / lease / fencing
plugin signature/provenance/SBOM/sandbox failure
data governance P0 violation
event/truth/projection replay diff
P0 alert without runbook
```

---

# 16. Evidence Bundle done

## 16.1 ValidationEvidenceBundle

```ts
type ValidationEvidenceBundle = {
  validationRunId: string;
  missionId: string;
  taskIds: string[];
  validationPhase:
    | "validation_phase_0"
    | "validation_phase_1"
    | "validation_phase_2"
    | "validation_phase_3"
    | "validation_phase_4";

  roadmapStage:
    | "stage_1_research"
    | "stage_2_code"
    | "stage_3_ops"
    | "stage_4_business"
    | "stage_5_marketplace";
  runtimeRing?: string;

  sourceDatasetVersion: string;
  gitCommitSha: string;
  configVersion: string;
  contractSchemaVersion: string;

  eventRegistryVersion: string;
  gateRegistryVersion: string;
  metricRegistryVersion: string;
  ciJobRegistryVersion: string;
  runbookRegistryVersion: string;

  eventRegistryHash: string;
  gateRegistryHash: string;
  metricRegistryHash: string;
  ciJobRegistryHash: string;
  runbookRegistryHash: string;

  testReportRefs: string[];
  coverageReportRefs: string[];
  mutationReportRefs: string[];
  scorecardRef: string;
  dashboardSnapshotRefs: string[];
  eventTruthConsistencyReportRef: string;
  projectionRebuildReportRef: string;
  budgetAuditReportRef: string;
  hitlAuditReportRef: string;
  securityScanReportRef: string;
  pluginRuntimeReportRef: string;
  dataGovernanceReportRef: string;
  artifactIntegrityReportRef: string;

  bundleHash: string;
  signature: string;
  signedBy: string[];
  signedAt: string;

  decision: "pass" | "fail" | "conditional_pass";
  approvedBy: string[];
  createdAt: string;
};
```

## 16.2 Evidence Bundle Gate

The integrity of the Evidence Bundle is uniformly managed by `GATE-EVIDENCE-BUNDLE-001`, to avoid Registry drift caused by splitting the same evidence package integrity requirement into multiple Gates.

| Gate | Blocking Condition |
| --- | --- |
| GATE-EVIDENCE-BUNDLE-001 | registry snapshot/version/hash/signature missing or mismatched; evidence package not bound to git/config/contract/event/gate/metric/CI/runbook versions; `bundleHash` validation failed; signature invalid; `signedBy/signedAt` missing |

---

# 17. OAPEFLIR Stage-level Validation done

## 17.1 Stage Matrix

| Stage | Must Validate | Budget Semantics | Evidence | Gate |
| --- | --- | --- | --- | --- |
| Observe | Input normalization, tenant/principal/source binding | The stage itself can have no budget; if parser/tool/model is called, must reserve | source evidence | GATE-OAPEFLIR-001 |
| Assess | Risk, complexity, routing, budget feasibility | Budget estimation required; model call must reserve | assessment evidence | GATE-OAPEFLIR-001 |
| Plan | Output PlanGraphBundle DAG, PlanStep[] prohibited | worst-path budget | plan validation report | GATE-OAPEFLIR-002 |
| Execute | NodeRun / NodeAttempt execution | Every model/tool/connector must reserve | execution receipt | GATE-RUNTIME-001 |
| Feedback | Quality assessment, failure classification, replan/HITL/terminate | evaluator/model call must reserve | quality report | GATE-OAPEFLIR-003 |
| Learn | LearningObject isolation, validation, promotion candidate | embedding/model/write call must reserve | learning evidence | GATE-ROLLOUT-001 |
| Improve | improvement proposal, rollout proposal | Cost estimation required | improvement evidence | GATE-ROLLOUT-001 |
| Release | artifact/knowledge/report release | settle + side-effect record | release evidence | GATE-SIDEEFFECT-001 |

## 17.2 Canonical Stage Event

Use unified event names, distinguish stages through payload:

```text
oapeflir.stage.started
oapeflir.stage.completed
oapeflir.stage.failed
oapeflir.stage.skipped
oapeflir.stage.blocked
oapeflir.stage.replanned
```

Payload must include:

```ts
type OapeflirStageEventPayload = {
  stage:
    | "observe"
    | "assess"
    | "plan"
    | "execute"
    | "feedback"
    | "learn"
    | "improve"
    | "release";
  missionId: string;
  taskId: string;
  harnessRunId: string;
  traceId: string;
  principalId: string;
  tenantId: string;
  startedAt?: string;
  completedAt?: string;
  skipReason?: string;
  failureReason?: string;
  evidenceRefs: string[];
  budgetReservationIds: string[];
  auditRef: string;
};
```

---

# 18. Skills / Plugins / Tool Registry / Connector Runtime Validation done

## 18.1 First-Class Validation Objects

| Object | Description |
| --- | --- |
| SkillDefinition | Platform capability abstraction |
| ToolDefinition | Tool schema and execution strategy |
| PluginManifest | Plugin artifact, signature, SBOM, sandbox |
| ConnectorBinding | External system connection configuration |
| ToolInvocationReceipt | All tool invocation audit receipts |

## 18.2 Plugin Lifecycle

```text
registered
→ manifest_validated
→ signature_verified
→ sbom_scanned
→ sandbox_validated
→ loaded
→ active
→ suspended
→ deprecated
→ archived

Exception paths:
signature_failed → rejected
sandbox_violation → suspended / quarantined
critical_cve_detected → revoked
```

## 18.3 Plugin Signature Rules

Three paths are allowed:

```text
1. signature verified
2. first-party signed build provenance verified
3. explicit temporary waiver with owner + expiry + risk acceptance
```

Restrictions:

```text
waiver must not bypass sandbox / egress / capability / SBOM gate
waiver must not be used for third-party marketplace plugin production activation
waiver must have owner, expiry, risk acceptance, auditRef
```

---

# 19. Security / Tenant / IAM Validation done

| Domain | Must Validate |
| --- | --- |
| Tenant Isolation | tenantId required, cross-tenant read/write deny |
| IAM / RBAC | principal capability, role, policy decision |
| Secret Access | secret read audit, rotation, redaction |
| OAuth / SSO | PKCE, token storage, session expiry |
| Sandbox | filesystem/network/process/resource |
| Egress | allowlist, DNS rebinding, SSRF |
| Encryption | AES-GCM/KMS/BYOK, key rotation |
| Audit Integrity | append-only, hash chain, tamper detection |
| Data Classification | public/internal/confidential/restricted |
| Prompt Injection | input/output guardrail |

---

# 20. Operator Cockpit / UI Validation done

## 20.1 Workflows That Must Be Tested

```text
Mission list filter
Task detail drilldown
PlanGraph DAG visualization
NodeRun receipt/error/evidence
HITL approve/reject/request_more_context/escalate
Knowledge promotion review
P0 alert → runbook → affected objects
Projection degraded UI warning
offline/reconnect replay
```

## 20.2 UI Permission Chain Matrix

| UI Action | API | Policy Action | Required Capability | Audit Event |
| --- | --- | --- | --- | --- |
| approve HITL | `POST /hitl/:id/decision` | `approve_hitl` | `hitl.approve` | `hitl.decision.recorded` |
| reject HITL | `POST /hitl/:id/decision` | `reject_hitl` | `hitl.reject` | `hitl.decision.recorded` |
| request more context | `POST /hitl/:id/request-context` | `request_hitl_context` | `hitl.request_context` | `hitl.context.requested` |
| retry NodeRun | `POST /node-runs/:id/retry` | `retry_node_run` | `runtime.retry` | `node.run.retrying` |
| pause Mission | `POST /missions/:id/pause` | `pause_mission` | `mission.pause` | `mission.paused` |
| resume Mission | `POST /missions/:id/resume` | `resume_mission` | `mission.resume` | `mission.resumed` |
| suspend plugin | `POST /plugins/:id/suspend` | `suspend_plugin` | `plugin.admin` | `plugin.suspended` |
| approve rollout | `POST /rollouts/:id/approve` | `approve_rollout` | `rollout.approve` | `rollout.approved` |
| change policy | `PATCH /policies/:id` | `modify_policy` | `policy.admin` | `policy.updated` |

## 20.3 UI SLO

| Metric | Target |
| --- | ---: |
| `aa.ui.operator.action_latency_ms` | p95 < 800ms |
| `aa.ui.permission.render_mismatch.count` | 0 |
| `aa.ui.dashboard.staleness_ms` | p95 < 5000ms |

---

# 21. Runtime State / CAS / Lease / Fencing Validation done

| Capability | Validation Requirement |
| --- | --- |
| RSM | All state changes must go through RuntimeTransitionCommand |
| CAS | expectedVersion mismatch must be rejected |
| Lease | Expired lease cannot write |
| Fencing | stale fencingToken must be rejected |
| Terminal | completed/failed/cancelled cannot be reversed |
| Recovery | recovery worker must also carry lease + fencing |
| Concurrent terminal | Concurrent terminal transition only one succeeds |

---

# 22. SideEffect / Reconciliation Validation done

| Capability | Validation Requirement |
| --- | --- |
| SideEffectRecord | Every external write must be registered first |
| Idempotency | Retry cannot submit duplicates |
| State machine | proposed → reserved → committing → committed / failed / unknown / compensated |
| Pre-commit revalidation | Re-check policy/budget/lease/fencing before commit |
| Reconciliation | Periodically probe external state and reconcile |
| Compensation | Failure must have compensation or HITL |
| Replay safety | replay/time-travel must not produce real side effects |

---

# 23. Config Center / Drift / Rollout Validation done

| Capability | Validation Requirement |
| --- | --- |
| Config Schema | strict schema |
| Config Version | Each release has configVersion |
| Impact Analyzer | High-risk config must have impact analysis before release |
| Canary Config Rollout | canary / rollback |
| Drift Detection | security/budget/egress/sandbox drift fail-closed |
| Hot Reload | Hot update failure must not contaminate running state |
| Audit | All changes have principal/auditRef |
| Lifecycle | draft → validated → canary → active → rolled_back / archived |

---

# 24. Model Gateway Provider / Streaming Validation done

| Scenario | Validation Point |
| --- | --- |
| Non-streaming | response schema, usage, finish reason |
| Streaming | final chunk, finish_reason, usage accumulation, error propagation |
| Retry | Only retry 429/5xx/timeout, not retry 4xx |
| Circuit breaker | open/half-open/closed state accuracy |
| Fallback | fallback decision event |
| Budget | Reserve before each model call, settle after |
| Version Lock | Conclusion bound to model/prompt/config version |
| Credential | 401/403 key disable/cooldown |

---

# 25. Persistence / Repository / Migration Validation done

| Capability | Validation Requirement |
| --- | --- |
| SQLite / PG parity | Same repository test runs on both backends |
| SQL Parameterization | String concatenation of user input is prohibited |
| Transaction Boundary | event + truth write in same transaction |
| Migration | up/down dry-run, backup, rollback |
| Optimistic Locking | version/CAS |
| Pagination | cursor pagination |
| Retention / Compaction | event/projection/inbox must not grow unbounded |

---

# 26. Dispatch / Queue / Worker Pool Validation done

| Capability | Validation Requirement |
| --- | --- |
| Dispatch Ticket | Creation, invalidation, replacement must be atomic |
| Queue Admission | Check tenant quota, budget, risk, priority before enqueue |
| Worker Claim | claim + lease must be equivalently atomic |
| Worker Capacity | Concurrency must not exceed capacity |
| Backpressure | queue/event/worker saturation throttling |
| Preemption | critical/high correctly preempts, protected task not preempted |
| Reconciliation | stale ticket, lost claim, orphan lease can be repaired |
| Ordering | same aggregate / same NodeRun write order controlled |

---

# 27. Test Quality Governance done

| Item | Requirement |
| --- | --- |
| No-op Assertion Scan | Prohibit `assert.ok(true)`, `x >= 0` constant-true assertions |
| Catch Swallow Scan | Prohibit `catch { assert.ok(true) }` |
| Integration Reality | integration must import real services or lightweight real implementations |
| E2E Concurrency Reality | Concurrency must use Promise.all / worker / race harness |
| Mutation Testing | critical modules must meet the standard |
| Fixture Validation | Test fixture must schema validate |
| Coverage Quality | Line coverage + branch + mutation + invariant coverage |

## 27.1 Mutation Score Layering

| Module | Minimum mutation score |
| --- | ---: |
| RSM / CAS / Lease / Fencing | ≥90% |
| Budget / Risk / Policy / HITL | ≥85% |
| Tool Registry / Sandbox / Egress | ≥85% |
| Dispatch / Worker claim / SideEffect | ≥85% |
| Research quality rubric | ≥75% |
| UI components | mutation not enforced, use interaction + visual regression |

---

# 28. Autonomy / Runtime Mode Validation done

| Scenario | Requirement |
| --- | --- |
| High risk write | At most supervised / manual approval |
| P0/P1 incident | Automatically downgrade to suggestion / supervised |
| frozen | Restricted state, must not be regarded as higher than full_auto |
| full_auto | Cannot bypass risk / budget / HITL |
| propagation | RequestEnvelope → Task → HarnessRun → NodeRun → tool/model call |
| override | Must have policy decision + auditRef |
| recover from frozen | Must have manual approval |

---

# 29. Prompt / Skill / Knowledge Rollout Validation done

| Object | Validation Requirement |
| --- | --- |
| PromptBundle | version lock, eval gate, canary, rollback |
| SkillDefinition | schema compatibility, runtime compatibility, deprecation |
| KnowledgeObject | quarantine, validation, promotion, rollback |
| LearningObject | trust state, evidence refs, conflict handling |
| ImprovementCandidate | source evidence, guardrail, rollout level |
| ReleaseRecord | metrics, triggeredBy, auditContext, rollbackRef |

---

# 30. Documentation / ADR / Contract Drift Validation done

Must validate:

```text
docs contracts vs TS schemas
ADR canonical objects vs exported types
event list vs Event Registry
metric names vs Metric Registry
gate names vs Gate Registry
deprecated terms scan: WorkflowStep / PlanStep[] / WorkflowState / ControlDirective
```

---

# 31. Requirement Traceability Matrix done

> In RTM, Gates must reference Gate Registry ID; Metrics must reference the formal `aa.*` names registered in Metric Registry.

| Requirement ID | Requirement | Test | Metric | Gate |
| --- | --- | --- | --- | --- |
| INV-STATE-001 | State changes must be event-driven | state-transition.e2e | `aa.truth.atomicity.violation.count` | GATE-STATE-001 |
| INV-RSM-001 | All state changes go through RSM | rsm-contract | `aa.rsm.bypass.count` | GATE-RSM-001 |
| INV-CAS-001 | Authoritative writes must have expectedVersion | cas-concurrency | `aa.cas.conflict.rejected.count` | GATE-CAS-001 |
| INV-LEASE-001 | Writes must verify active lease | lease-expiry | `aa.lease.expired_write.rejected.count` | GATE-LEASE-001 |
| INV-FENCING-001 | stale fencingToken rejected | fencing-stale | `aa.fencing.stale_write.rejected.count` | GATE-FENCING-001 |
| INV-TERMINAL-001 | terminal state immutable | terminal-cas | `aa.terminal.reverse_transition.count` | GATE-TERMINAL-001 |
| INV-BUDGET-001 | reserve budget before LLM/tool | budget-invariant | `aa.budget.reservation.missing.count` | GATE-BUDGET-001 |
| INV-EVIDENCE-001 | Conclusion bound to evidence | evidence-link | `aa.evidence.ref.coverage_ratio` | GATE-EVIDENCE-001 |
| INV-TOOL-001 | Tool must go through Tool Registry | tool-registry | `aa.tool.direct_invocation.count` | GATE-TOOL-001 |
| INV-PLUGIN-001 | Plugin must have signature/provenance/SBOM/sandbox | plugin-validate | `aa.plugin.signature.failed.count` | GATE-PLUGIN-001 |
| INV-CONNECTOR-001 | Connector egress must have allowlist | connector-egress | `aa.connector.egress.denied.count` | GATE-CONNECTOR-001 |
| INV-HITL-001 | HITL decision must be authorized and idempotent | hitl-e2e | `aa.hitl.double_decision.count` | GATE-HITL-001 |
| INV-OAPEFLIR-001 | Each stage boundary must emit event | oapeflir-stage | `aa.oapeflir.stage.event_missing.count` | GATE-OAPEFLIR-001 |
| INV-OAPEFLIR-002 | Plan outputs PlanGraphBundle | plan-graph | `aa.oapeflir.plan.linear_plan.count` | GATE-OAPEFLIR-002 |
| INV-OAPEFLIR-003 | Feedback fail must replan/HITL/terminate | feedback-gate | `aa.oapeflir.feedback.unresolved.count` | GATE-OAPEFLIR-003 |
| INV-TENANT-001 | All objects tenant scoped | tenant-isolation | `aa.tenant.cross_access.denied.count` | GATE-TENANT-001 |
| INV-SECURITY-001 | Secret read needs policy + audit | secret-audit | `aa.secret.access.without_audit.count` | GATE-SECURITY-001 |
| INV-SIDEEFFECT-001 | External side effect must have SideEffectRecord | sideeffect-e2e | `aa.side_effect.without_record.count` | GATE-SIDEEFFECT-001 |
| INV-CONFIG-001 | High-risk config needs impact analysis | config-validate | `aa.config.impact_analysis.missing.count` | GATE-CONFIG-001 |
| INV-CONFIG-002 | Security drift fail-closed | config-drift | `aa.config.security_drift.failopen.count` | GATE-CONFIG-002 |
| INV-MODEL-001 | model call bound to budget | model-provider | `aa.model.request.without_budget.count` | GATE-MODEL-001 |
| INV-STORE-001 | SQLite/PG parity | repo-parity | `aa.repository.parity.diff.count` | GATE-STORE-001 |
| INV-DISPATCH-001 | worker claim must bind lease | dispatch-validate | `aa.worker.claim.without_lease.count` | GATE-DISPATCH-001 |
| INV-TEST-001 | No-op test prohibited | test-quality | `aa.test.noop_assertion.count` | GATE-TEST-001 |
| INV-AUTONOMY-001 | high-risk write cannot full_auto bypass HITL | autonomy-validate | `aa.autonomy.high_risk_full_auto.count` | GATE-AUTONOMY-001 |
| INV-DOCS-001 | docs/contracts must not reference non-canonical execution object | docs-canonical | `aa.docs.noncanonical_reference.count` | GATE-DOCS-001 |
| INV-DATA-001 | Research data must have license/retention/classification | data-governance | `aa.data.source.license_missing.count` | GATE-DATA-001 |
| INV-EVIDENCE-BUNDLE-001 | Evidence Bundle must verify signature and contain registry digest | evidence-bundle | `aa.evidence_bundle.signature.invalid.count` | GATE-EVIDENCE-BUNDLE-001 |
| INV-OBS-001 | P0 Alert must have trace/log/metric/runbook | observability-smoke | `aa.observability.runbook_missing.count` | GATE-OBS-001 |
| INV-DR-001 | Projection diff=0 after Restore | dr-restore | `aa.projection.rebuild.diff.count` | GATE-DR-001 |

---

# 32. Metric Summary done

This chapter only provides core metric summaries. **The formal definition takes Chapter 48 Metric Registry as the sole source.**

Core categories:

```text
runtime / state / budget / evidence / tool / plugin / connector / model
security / tenant / data / side_effect / config / dispatch / test / autonomy
docs / artifact / gpu / ui / slo / evidence_bundle
```

---

# 33. CI/CD Validation Pipeline done

## 33.1 CI Stage

| Stage | Goal |
| --- | --- |
| CI-1 Static | lint, typecheck, schema, docs drift |
| CI-2 Contract | API/Event/Gate/Metric/Runbook registry |
| CI-3 Unit | unit + mutation |
| CI-4 Integration | real service integration |
| CI-5 E2E | Research Mission E2E |
| CI-6 Replay / DR | projection rebuild, restore drill |
| CI-7 Security | tenant/IAM/sandbox/egress/data governance |
| CI-8 Evidence | Evidence Bundle generation + signature |

## 33.2 Current In-Repo Executable CI / Validation Baseline

The main validation entry points already provided by the current repository are as follows. They are the **current baseline** that can be directly executed or connected to CI during review; finer validation jobs can be split on this basis, but commands not yet implemented must not be written as existing scripts.

| Baseline Entry | Current Command | Current Use |
| --- | --- | --- |
| Type and Static Check | `npm run typecheck`, `npm run lint` | Type, static rules, basic drift discovery |
| Layered Tests | `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, `npm run test:invariants` | Current unit, integration, E2E, invariant validation |
| Output and Performance | `npm run test:golden`, `npm run test:performance` | Golden output stability and performance regression |
| Full-Layer Validation | `npm run test:layers:full` | Current in-repo full-layer test aggregation entry |
| Coverage and Mutation | `npm run coverage:gate`, `npm run test:mutation` | Coverage ratchet and mutation testing |
| Test Exclusion and Repo Hygiene | `npm run audit:test-exclusions`, `npm run audit:repo-hygiene` | skip/exclusion, review samples, supply chain check |
| Mission operating model closure | `npm run registry:closure`, `npm run playbook:validate`, `npm run mission-outcome:validate` | Current Mission registry/playbook/outcome closed-loop scripts |
| Stability Evidence Baseline | `npm run evidence:stable`, `npm run gate:stable`, `npm run validate:stable` | Current stable evidence / gate / validate CLI paths |

> `deploy/prometheus/`, `deploy/grafana/`, and `deploy/runbooks/` provide the runtime observability baseline; configuration file correctness is guarded by existing deploy golden tests. Real scrape, notification delivery, and on-call drills still belong to environment acceptance.

## 33.3 Machine-readable CI Job Registry

The table below describes the job granularity and artifacts used by freeze/sign-off. The current repository has provided corresponding scripts in `package.json` and saved job, gate, and runbook machine mappings in `config/validation/platform-validation-registry.json`; `npm run platform-registry:closure` and `tests/unit/scripts/platform-validation-closure.test.ts` will validate the mapping existence.

| CI Job | Command | Artifact | Required |
| --- | --- | --- | --- |
| contract-validate | `npm run contract:validate` | `contract-report.json` | PR |
| schema-strict | `npm run schema:strict` | `schema-report.json` | PR |
| unit-test | `npm run test:unit` | `unit-report.json` | PR |
| mutation-critical | `npm run test:mutation:critical` | `mutation-report.json` | PR/main |
| integration-test | `npm run test:integration` | `integration-report.json` | main |
| research-e2e | `npm run test:e2e:research` | `research-e2e-report.json` | staging |
| hitl-e2e | `npm run test:e2e:hitl` | `hitl-e2e-report.json` | staging |
| projection-replay | `npm run test:replay` | `projection-diff.json` | staging |
| dr-restore | `npm run test:dr:restore` | `restore-report.json` | weekly/staging |
| tool-registry-validate | `npm run tool-registry:validate` | `tool-registry-audit.json` | PR |
| plugin-validate | `npm run plugin:validate` | `plugin-validation.json` | PR |
| connector-egress | `npm run connector:egress:test` | `connector-egress.json` | main |
| security-scan | `npm run security:scan` | `security-report.json` | PR |
| security-tenant | `npm run security:tenant` | `tenant-isolation.json` | main |
| data-governance | `npm run data-governance:validate` | `data-governance-report.json` | PR/main |
| budget-invariant | `npm run budget:invariant` | `budget-report.json` | PR |
| rsm-contract | `npm run rsm:contract` | `rsm-report.json` | PR |
| cas-concurrency | `npm run cas:concurrency` | `cas-report.json` | main |
| lease-fencing | `npm run lease:fencing` | `lease-fencing-report.json` | main |
| sideeffect-e2e | `npm run sideeffect:e2e` | `sideeffect-report.json` | staging |
| config-validate | `npm run config:validate` | `config-report.json` | PR |
| config-drift | `npm run config:drift` | `config-drift-report.json` | main |
| model-provider | `npm run model:provider:test` | `model-provider-report.json` | main |
| repo-parity | `npm run repo:parity` | `repo-parity-report.json` | main |
| dispatch-validate | `npm run dispatch:validate` | `dispatch-report.json` | main |
| test-quality | `npm run test:quality` | `test-quality-report.json` | PR |
| test-reality | `npm run test:reality` | `test-reality-report.json` | main |
| autonomy-validate | `npm run autonomy:validate` | `autonomy-report.json` | PR |
| rollout-validate | `npm run rollout:validate` | `rollout-report.json` | main |
| docs-canonical | `npm run docs:canonical` | `docs-canonical-report.json` | PR |
| contract-drift | `npm run contract:drift` | `contract-drift-report.json` | PR |
| docs-registry | `npm run docs:registry` | `docs-registry-report.json` | PR |
| observability-smoke | `npm run observability:smoke` | `observability-report.json` | main |
| evidence-bundle | `npm run validation:bundle` | `validation-bundle.json` | staging |
| artifact-integrity | `npm run artifact:integrity` | `artifact-integrity-report.json` | staging |
| gpu-capacity | `npm run gpu:capacity` | `gpu-capacity-report.json` | conditional |

### 33.3.1 Script mapping closure

This round has added real script entries for validation jobs that previously lacked direct script mappings, including contract/schema, research/HITL E2E, replay/restore, tool/plugin/connector/security/data governance, docs registry, observability smoke, validation bundle, and artifact integrity. Environment-related jobs still need CI runners to save real artifacts; `gpu:capacity` remains as a conditional validation entry.

---

# 34. Observability Semantic Convention done

## 34.1 Span Names

```text
aa.mission.run
aa.task.run
aa.harness.run
aa.oapeflir.stage
aa.plangraph.validate
aa.node.run
aa.node.attempt
aa.tool.invoke
aa.model.request
aa.budget.reserve
aa.budget.settle
aa.hitl.request
aa.hitl.decision
aa.knowledge.promote
aa.event.publish
aa.projection.rebuild
aa.side_effect.commit
```

Description: The above `aa.*` are OTel span names, not metric names. Metric Registry Closure only scans `aa.*` names marked as `Metric`, `指标` (metric), `Alert Metric`, Dashboard metric, RTM Metric, and Runbook linkedMetrics; span names are managed by this chapter and do not enter Chapter 48 Metric Registry.

## 34.2 Required Attributes

```text
trace_id
span_id
tenant_id
mission_id
task_id
harness_run_id
plan_graph_id
node_run_id
node_attempt_id
principal_id
runtime_mode
risk_level
budget_reservation_id
tool_name
model_provider
model_name
prompt_bundle_version
evidence_ref_count
artifact_ref_count
```

## 34.3 Prohibited Items

```text
Prohibit prompt / secret / PII from entering normal logs
Prohibit high-cardinality fields as metric labels
Large fields must enter artifact/evidence store, logs only store ref
```

---

# 35. Research Data Governance done

## 35.1 Data Governance Fields

```ts
type ResearchSourceGovernance = {
  sourceId: string;
  sourceType:
    | "paper"
    | "blog"
    | "webpage"
    | "internal_report"
    | "benchmark"
    | "experiment_log";
  license?: string;
  copyrightBoundary:
    | "summary_only"
    | "short_excerpt_allowed"
    | "internal_fulltext_allowed"
    | "restricted";
  dataClass: "public" | "internal" | "confidential" | "restricted";
  retentionPolicy: string;
  contaminationTag?:
    | "benchmark"
    | "train_candidate"
    | "do_not_train"
    | "unknown";
  piiDetected: boolean;
  redactionApplied: boolean;
  tenantId: string;
  accessPolicyRef: string;
};
```

## 35.2 Data Governance Gate

All Research data sources must have:

```text
license / source attribution
copyright boundary
retention policy
contamination tag
PII scan / redaction
tenant scoped access
```

---

# 36. Research Output Quality Rubric and Feedback Loop done

## 36.1 Rubric

| Dimension | Score |
| --- | ---: |
| Claim Faithfulness | 0-5 |
| Evidence Precision | 0-5 |
| Method Understanding | 0-5 |
| Experiment Reliability | 0-5 |
| Self-research Relevance | 0-5 |
| Actionability | 0-5 |
| Risk Awareness | 0-5 |
| Novelty Detection | 0-5 |
| Contradiction Handling | 0-5 |

## 36.2 Feedback Loop

```mermaid
flowchart LR
    Output[Research Output] --> Review[Human / Expert Review]
    Review --> Score[Quality Score]
    Score --> Pattern[Failure Pattern]
    Pattern --> Candidate[Improvement Candidate]
    Candidate --> Eval[Eval Gate]
    Eval --> Rollout[Prompt / Skill / Model Rollout]
    Rollout --> Monitor[Quality Trend Monitor]
```

## 36.3 Golden Set

Must maintain:

```text
golden paper set
golden claim/evidence set
expert-labeled benchmark
inter-reviewer agreement report
reviewer drift detection report
```

---

# 37. Load / Stress / Capacity Validation done

| Level | Goal |
| --- | --- |
| Smoke Load | 10 concurrent tasks |
| Pilot Load | 50 concurrent tasks |
| Stress Load | 200 concurrent tasks |
| Soak Test | 7 days of continuous running |
| Spike Test | 10x task surge within 5 minutes |
| Backpressure Test | Throttling after EventBus / WorkerPool queue accumulation |

---

# 38. Lifecycle Transition Matrix done

## 38.1 Mission

| From | To | Allowed | Guard |
| --- | --- | ---: | --- |
| draft | active | yes | owner + budget + policy |
| active | paused | yes | operator permission |
| paused | active | yes | resume approval |
| active | completed | yes | all required tasks terminal |
| active | failed | yes | failure evidence |
| completed | active | no | terminal immutable |

## 38.2 NodeRun

| From | To | Allowed | Guard |
| --- | --- | ---: | --- |
| queued | running | yes | worker claim + lease |
| running | completed | yes | lease + fencing + receipt |
| running | failed | yes | error + evidence |
| running | retrying | yes | retry budget |
| completed | running | no | terminal immutable |
| failed | completed | no | terminal immutable |

## 38.3 Plugin

| From | To | Allowed | Guard |
| --- | --- | ---: | --- |
| registered | manifest_validated | yes | schema strict |
| manifest_validated | signature_verified | yes | signature/provenance |
| signature_verified | sbom_scanned | yes | SBOM scan |
| sbom_scanned | sandbox_validated | yes | sandbox policy |
| sandbox_validated | loaded | yes | lifecycle hook |
| loaded | active | yes | health check |
| active | suspended | yes | operator/security |
| suspended | active | yes | revalidation |
| active | revoked | yes | critical CVE/security |
| active | archived | no | must deprecate first |

## 38.4 ArtifactRef

| From | To | Allowed | Guard |
| --- | --- | ---: | --- |
| created | verified | yes | content hash |
| verified | published | yes | access policy + audit |
| published | deprecated | yes | replacement/ref |
| deprecated | archived | yes | retention policy |
| published | recalled | yes | security/compliance incident |
| archived | published | no | immutable archive |

---

# 39. Backup / Restore / DR Validation done

Must validate:

```text
Event log backup
Truth store backup
Artifact / Evidence store backup
Knowledge store backup
Config snapshot backup
Restore to staging
Projection rebuild after restore
RPO / RTO measurement
```

---

# 40. Incident Lifecycle / Postmortem done

```text
detected
→ triaged
→ mitigated
→ root_caused
→ fixed
→ verified
→ closed
→ postmortem_published
```

Each P0/P1 must have:

```text
incidentId
severity
impact
affectedMissionIds
affectedTaskIds
timeline
rootCause
mitigation
permanentFix
regressionTest
owner
deadline
postmortemRef
```

---

# 41. SLO / Error Budget / Burn-rate Validation done

## 41.1 Mission-specific SLO Profiles

| SLO | Research Mission | Code Agent Mission | Ops Mission |
| --- | ---: | ---: | ---: |
| Evidence coverage | 100% | 100% | 100% |
| Tool receipt coverage | 100% | 100% | 100% |
| Budget attribution coverage | 100% | 100% | 100% |
| Harness completion | ≥95% | ≥90% | ≥98% |
| HITL SLA | 24h | 2h | 15min |
| Recovery RTO | 4h | 1h | 15min |
| Projection lag p95 | <5s | <5s | <2s |
| API availability | ≥99.9% | ≥99.9% | ≥99.95% |

## 41.2 Burn-rate

```text
burn_rate = actual_error_rate / allowed_error_rate
```

| Window | Alert |
| --- | --- |
| 1h burn_rate > 14x | P1 |
| 6h burn_rate > 6x | P1 |
| 24h burn_rate > 3x | P2 |

---

# 42. Tenant Quota / Fair Scheduling Validation done

Must validate:

```text
per-tenant budget
per-tenant concurrency
per-tenant rate limit
worker pool fairness
noisy neighbor isolation
preemption
priority scheduling
protected/system task not evicted
```

---

# 43. Local Model / L40S GPU Capacity Validation done

> Conditional chapter: if Roadmap Stage 1 uses local embedding/reranker/local LLM, this chapter must be enabled.

Must validate:

```text
single L40S GPU admission control
GPU memory watermark alert
embedding queue isolation
reranker queue isolation
local model OOM recovery
model unload / evict policy
local vs remote provider fallback
GPU capacity report in Evidence Bundle
```

---

# 44. Example Validation Run

Input: a Reasoning RL paper.

```text
Mission: LLM Research Intelligence Mission
Task: Paper Review Task
PlanGraph nodes:
  source_ingest
  pdf_parse
  claim_extract
  evidence_link
  research_review
  quality_score
  hitl_review
  knowledge_promotion
```

Canonical event sequence example:

```text
oapeflir.stage.started(stage=observe)
oapeflir.stage.completed(stage=observe)
oapeflir.stage.started(stage=assess)
oapeflir.stage.completed(stage=assess)
oapeflir.stage.started(stage=plan)
oapeflir.stage.completed(stage=plan)
oapeflir.stage.started(stage=execute)
node.run.started(node=source_ingest)
tool.invocation.started(tool=paper_fetch)
tool.invocation.completed(tool=paper_fetch)
node.run.completed(node=source_ingest)
node.run.started(node=claim_extract)
model.request.started(provider=...)
model.request.completed(provider=...)
node.run.completed(node=claim_extract)
oapeflir.stage.completed(stage=execute)
oapeflir.stage.started(stage=feedback)
oapeflir.stage.completed(stage=feedback)
oapeflir.stage.started(stage=learn)
oapeflir.stage.completed(stage=learn)
oapeflir.stage.started(stage=release)
artifact.published
oapeflir.stage.completed(stage=release)
validation.evidence_bundle.signed
```

Outputs:

```text
Trace tree
Budget ledger
ToolInvocationReceipt
Model usage receipt
Evidence Bundle
Research Quality Scorecard
Knowledge Promotion Record
Dashboard Snapshot
```

---

# 45. RACI / Sign-off Matrix

| Module | Owner | Reviewer | Sign-off |
| --- | --- | --- | --- |
| Contract / Schema | Platform Architect | Runtime Owner | Tech Lead |
| EventBus / Truth | State-Evidence Owner | QA | Platform Lead |
| Model Gateway / Budget | Model Infra Owner | FinOps | Platform Lead |
| Skills / Plugins | Extension Runtime Owner | Security | Platform Lead |
| Security / Tenant / IAM | Security Owner | Compliance | CISO/Tech Lead |
| HITL / Governance | Control Plane Owner | Compliance | Product Owner |
| Research Quality | Research Lead | Human Reviewer | Business Owner |
| UI Dashboard | Frontend Owner | Operator | Product Owner |
| CI / Test Quality | QA Owner | Platform Owner | Engineering Lead |
| Data Governance | Data Owner | Legal/Compliance | Business Owner |

---

# 46. Event Naming / Event Schema Registry done

## 46.1 Naming Convention

```text
<domain>.<object>.<verb>
```

Examples:

```text
oapeflir.stage.completed
tool.invocation.completed
plugin.signature.verified
connector.egress.denied
budget.reservation.created
side_effect.committed
```

Rules:

```text
eventName must use dot-separated canonical form
each segment must match ^[a-z][a-z0-9_]*$
snake_case is allowed within segments, e.g. side_effect, critical_cve, rate_limited
kebab-case, camelCase, empty segment, consecutive dots, leading/trailing dots are prohibited
payload fields can use camelCase or snake_case, but must be consistent within the same schema
event schema must be managed by machine-readable registry
```

Therefore, `tool.schema.validation_failed`, `plugin.critical_cve.detected`, `connector.side_effect.recorded` are legal event names; `tool.schemaValidationFailed`, `plugin-critical-cve.detected`, `connector..egress.denied` are illegal.

## 46.2 Machine-readable Event Registry

The current in-repo event registration source of truth is:

```text
src/platform/five-plane-state-evidence/events/event-registry.ts
src/platform/five-plane-state-evidence/events/event-registry-payloads.ts
src/platform/five-plane-state-evidence/events/event-types.ts
```

These source files already carry typed event metadata, payload validator, replay metadata, and legacy/canonical dual-track for the compatibility period. `npm run validation:artifacts` will export the current baseline of event/gate/metric/CI/runbook to `artifacts/validation/platform/contracts/`; the Event snapshot is generated from the above TypeScript registry and does not replace the source of truth in reverse.

```text
event-registry.canonical.json
event-payload-schemas/*.schema.json
typed-event-payloads.generated.ts
event-registry.hash
```

Appendix A is only a reading list. CI uses the machine registry as the source.

Each event must define:

```text
eventName
producer
consumers
payloadSchemaRef
requiredFields
compatibilityPolicy
replayBehavior
retentionPolicy
piiPolicy
```

---

# 47. Gate Registry done

> Gate Registry is the only formal source of blocking conditions. Other chapters can only reference Gate IDs.

## 47.1 Gate Severity Model

Each Gate must define:

```yaml
gateId: string
defaultSeverity: P0 | P1 | P2 | P3
escalationRules:
  - condition: string
    severity: P0 | P1 | P2 | P3
blocking: true | false
ciJob: string
runbookId: string
owner: string
```

## 47.2 Core Gate Registry

| Gate ID | Name | Default Severity | Blocking Condition | CI Job | Runbook |
| --- | --- | ---: | --- | --- | --- |
| GATE-PRIORITY-001 | P0 hard gate priority | P0 | any P0 hard gate failed | evidence-bundle | D.1 |
| GATE-STATE-001 | Event/Truth atomicity | P0 | event/truth diff > 0 | projection-replay | D.1 |
| GATE-RSM-001 | RSM transition | P0 | state write bypass RSM | rsm-contract | D.6 |
| GATE-CAS-001 | CAS write | P0 | expectedVersion bypass | cas-concurrency | D.7 |
| GATE-LEASE-001 | Lease validation | P0 | expired lease write accepted | lease-fencing | D.8 |
| GATE-FENCING-001 | Fencing validation | P0 | stale token write accepted | lease-fencing | D.9 |
| GATE-TERMINAL-001 | Terminal immutability | P0 | terminal reverse transition | rsm-contract | D.10 |
| GATE-BUDGET-001 | Budget reservation | P0 | model/tool/connector without reservation | budget-invariant | D.2 |
| GATE-EVIDENCE-001 | Evidence coverage | P0 | claim without evidence | research-e2e | D.11 |
| GATE-EVIDENCE-BUNDLE-001 | Evidence bundle integrity | P0 | missing registry hash/signature | evidence-bundle | D.12 |
| GATE-TOOL-001 | Tool registry | P0 | direct tool invocation | tool-registry-validate | D.13 |
| GATE-PLUGIN-001 | Plugin validation | P0 | signature/provenance/SBOM/sandbox fail | plugin-validate | D.5 |
| GATE-CONNECTOR-001 | Connector egress | P0 | egress bypass allowlist | connector-egress | D.14 |
| GATE-HITL-001 | HITL decision | P0 | unauthorized/double decision | hitl-e2e | D.4 |
| GATE-OAPEFLIR-001 | Stage event | P0 | stage boundary event missing | research-e2e | D.15 |
| GATE-OAPEFLIR-002 | PlanGraph | P0 | linear PlanStep[] used | research-e2e | D.16 |
| GATE-OAPEFLIR-003 | Feedback resolution | P1 | failed feedback unresolved | research-e2e | D.17 |
| GATE-TENANT-001 | Tenant isolation | P0 | cross-tenant access | security-tenant | D.18 |
| GATE-SECURITY-001 | Secret/IAM | P0 | secret access without audit | security-scan | D.19 |
| GATE-DATA-001 | Data governance | P0 | license/retention/PII/classification missing | data-governance | D.26 |
| GATE-SIDEEFFECT-001 | Side effect record | P0 | external write without SideEffectRecord | sideeffect-e2e | D.20 |
| GATE-CONFIG-001 | Config impact | P1 | high-risk config without impact analysis | config-validate | D.22 |
| GATE-CONFIG-002 | Security drift fail-closed | P0 | security drift fail-open | config-drift | D.22 |
| GATE-CONFIG-003 | Budget/egress/sandbox drift | P1 | governance drift unresolved | config-drift | D.22 |
| GATE-CONFIG-004 | Config rollback | P1 | rollout without rollback | config-validate | D.22 |
| GATE-CONFIG-005 | Hot reload safety | P1 | hot reload corrupts runtime | config-validate | D.22 |
| GATE-MODEL-001 | Model provider | P1 | missing usage/finish_reason/version lock | model-provider | D.23 |
| GATE-STORE-001 | Repository parity | P1 | SQLite/PG diff | repo-parity | D.24 |
| GATE-DISPATCH-001 | Dispatch/worker claim | P0 | claim without lease / duplicate active ticket | dispatch-validate | D.21 |
| GATE-RUNTIME-001 | Stuck runtime | P1 | stuck NodeRun over threshold | dispatch-validate | D.3 |
| GATE-TEST-001 | No-op test | P0 | no-op assertion detected | test-quality | D.27 |
| GATE-TEST-002 | Integration reality | P1 | integration uses only mocks/literals | test-reality | D.27 |
| GATE-TEST-003 | Mutation threshold | P1 | mutation score below module threshold | mutation-critical | D.27 |
| GATE-AUTONOMY-001 | Autonomy boundary | P0 | high-risk write full_auto without HITL | autonomy-validate | D.28 |
| GATE-ROLLOUT-001 | Rollout eval/rollback | P1 | release without eval/canary/rollback | rollout-validate | D.29 |
| GATE-DOCS-001 | Docs canonical | P1 | docs mention non-canonical object | docs-canonical | D.30 |
| GATE-DOCS-002 | Duplicate contract | P1 | duplicate incompatible types | contract-drift | D.30 |
| GATE-DOCS-003 | Registry drift | P1 | docs event/metric/gate not registered | docs-registry | D.30 |
| GATE-OBS-001 | Observability/runbook | P0 | P0 alert without runbook/trace/metric | observability-smoke | D.25 |
| GATE-DR-001 | Restore/replay | P0 | restore projection diff > 0 | dr-restore | D.31 |
| GATE-ARTIFACT-001 | Artifact integrity | P1 | hash mismatch / access without policy | artifact-integrity | D.32 |
| GATE-GPU-001 | Local GPU capacity | P1 | local model OOM/admission failure | gpu-capacity | D.33 |
| GATE-MARKETPLACE-OFF-001 | Marketplace disabled | P0 | third-party marketplace enabled in Stage 1 | config-validate | D.34 |

---

# 48. Metric Registry done

> Metric Registry is the sole formal metric source for validation target semantics. All `aa.*` target metrics that appear in the main text, Runbook, Dashboard, and RTM must be registered in this chapter.

The current in-repo runtime monitoring baseline is still based on the Prometheus metrics exposed by `src/platform/shared/observability/prometheus-metrics-exporter.ts`, `deploy/prometheus/rules/automatic-agent.yml`, and `deploy/grafana/dashboards/automatic-agent.json`, such as `http_requests_total`, `queued_tasks`, `redis_connection_errors`, `event_loop_lag_ms`, `disk_used_ratio`. The `aa.*` in this chapter represents the validation semantic registry; the runtime exporter mapping is managed by `config/validation/platform-monitoring-metric-map.json`.

This round has converged the HTTP latency alert query to the `_ms` histogram, and the queue, worker, DLQ, outbox, OAPEFLIR latency alerts to the exporter's current exposure names. `npm run observability:smoke` will verify that **exporter exposure names, dashboard query, alert query, and unit threshold** no longer drift.

Metric Closure scanning rules: only scan `aa.*` names whose column names or field names are explicitly marked as `Metric`, `指标` (metric), `Alert Metric`, `linkedMetrics`, `RTM Metric`, `Dashboard Metric`. The OTel span names listed in Chapter 34 also use the `aa.*` prefix but are not metrics and do not need to enter this chapter.

Fields:

| Field | Description |
| --- | --- |
| Metric | Metric name |
| Type | counter / gauge / histogram |
| Formula | Calculation definition |
| Window | Aggregation window |
| Labels | Allowed labels |
| Source | Data source |
| Dashboard | Belonging panel |
| Alert | Associated Alert/Gate |
| Owner | Responsible person |
| Target | Target |

## 48.1 Core Metrics

| Metric | Type | Formula | Window | Labels | Source | Dashboard | Alert | Owner | Target |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `aa.truth.atomicity.violation.count` | counter | event/truth mismatch | real-time | tenant,aggregate | Truth/Event audit | State | GATE-STATE-001 | State Owner | 0 |
| `aa.rsm.bypass.count` | counter | state writes not via RSM | real-time | aggregate | RSM audit | Runtime | GATE-RSM-001 | Runtime Owner | 0 |
| `aa.cas.conflict.rejected.count` | counter | CAS conflicts rejected | real-time | aggregate | CAS | Runtime | GATE-CAS-001 | Runtime Owner | >=0 |
| `aa.lease.expired_write.rejected.count` | counter | expired lease writes rejected | real-time | worker,node | Lease service | Runtime | GATE-LEASE-001 | Runtime Owner | >=0 |
| `aa.fencing.stale_write.rejected.count` | counter | stale token writes rejected | real-time | worker,node | Fencing | Runtime | GATE-FENCING-001 | Runtime Owner | >=0 |
| `aa.terminal.reverse_transition.count` | counter | terminal reverse attempts | real-time | object | RSM | Runtime | GATE-TERMINAL-001 | Runtime Owner | 0 accepted |
| `aa.budget.reservation.missing.count` | counter | calls without budgetReservationId | real-time | stage,kind | Budget audit | Budget | GATE-BUDGET-001 | FinOps | 0 |
| `aa.model.request.without_budget.count` | counter | model calls without budget | real-time | provider,model | ModelGateway | Model | GATE-MODEL-001 | Model Infra | 0 |
| `aa.model.usage.missing.count` | counter | model response missing usage | real-time | provider,model | ModelGateway | Model | GATE-MODEL-001 | Model Infra | 0 |
| `aa.model.streaming.finish_reason.missing.count` | counter | streaming missing finish reason | real-time | provider,model | ModelGateway | Model | GATE-MODEL-001 | Model Infra | 0 |
| `aa.model.version_lock.missing.count` | counter | output missing model/prompt/config version | per task | provider | Model receipts | Model | GATE-MODEL-001 | Model Infra | 0 |
| `aa.evidence.ref.coverage_ratio` | gauge | claims_with_evidence / total_claims | per task | mission,domain | EvidenceStore | Evidence | GATE-EVIDENCE-001 | Research Owner | 1.0 |
| `aa.evidence_bundle.signature.invalid.count` | counter | invalid bundle signature/hash | per validation | phase | EvidenceBundle | Validation | GATE-EVIDENCE-BUNDLE-001 | QA Owner | 0 |
| `aa.tool.direct_invocation.count` | counter | tool invoked outside registry | real-time | tool | Tool audit | Tool | GATE-TOOL-001 | Extension Owner | 0 |
| `aa.tool.invocation.without_receipt.count` | counter | tool call missing receipt | real-time | tool | ToolRegistry | Tool | GATE-TOOL-001 | Extension Owner | 0 |
| `aa.plugin.signature.failed.count` | counter | signature/provenance failed | real-time | plugin | PluginRegistry | Plugin | GATE-PLUGIN-001 | Extension Owner | 0 active |
| `aa.plugin.sandbox_violation.count` | counter | sandbox violation | real-time | plugin | Sandbox | Plugin | GATE-PLUGIN-001 | Security | 0 |
| `aa.plugin.sbom.scan_failed.count` | counter | SBOM scan failed | per plugin | plugin | SBOM scanner | Plugin | GATE-PLUGIN-001 | Security | 0 active |
| `aa.connector.egress.denied.count` | counter | egress denied | real-time | connector,domain | Egress policy | Connector | GATE-CONNECTOR-001 | Security | >=0 |
| `aa.hitl.unauthorized_decision.count` | counter | unauthorized HITL decision | real-time | tenant | HITL audit | HITL | GATE-HITL-001 | Control Owner | 0 |
| `aa.hitl.double_decision.count` | counter | repeated terminal decision | real-time | request | HITL audit | HITL | GATE-HITL-001 | Control Owner | 0 |
| `aa.oapeflir.stage.event_missing.count` | counter | missing stage event | per run | stage | Stage audit | OAPEFLIR | GATE-OAPEFLIR-001 | Orchestration | 0 |
| `aa.oapeflir.plan.linear_plan.count` | counter | PlanStep[] detected | per plan | mission | Plan validator | OAPEFLIR | GATE-OAPEFLIR-002 | Orchestration | 0 |
| `aa.oapeflir.feedback.unresolved.count` | counter | feedback fail without action | per run | stage | Harness | OAPEFLIR | GATE-OAPEFLIR-003 | Orchestration | 0 |
| `aa.tenant.cross_access.denied.count` | counter | cross-tenant attempts denied | real-time | tenant | IAM | Security | GATE-TENANT-001 | Security | >=0 |
| `aa.secret.access.without_audit.count` | counter | secret read missing audit | real-time | principal | IAM | Security | GATE-SECURITY-001 | Security | 0 |
| `aa.data.source.license_missing.count` | counter | source without license metadata | per source | sourceType | Data governance | Data | GATE-DATA-001 | Data Owner | 0 |
| `aa.data.source.retention_policy_missing.count` | counter | missing retention policy | per source | sourceType | Data governance | Data | GATE-DATA-001 | Data Owner | 0 |
| `aa.data.pii.redaction_missing.count` | counter | PII detected without redaction | per source | dataClass | PII scanner | Data | GATE-DATA-001 | Security | 0 |
| `aa.data.contamination_tag_missing.count` | counter | benchmark/train tag missing | per source | sourceType | Data governance | Data | GATE-DATA-001 | Data Owner | 0 |
| `aa.data.copyright_boundary_violation.count` | counter | content exceeds allowed boundary | per output | sourceType | Data governance | Data | GATE-DATA-001 | Legal | 0 |
| `aa.data.restricted_access_bypass.count` | counter | restricted data access bypass | real-time | tenant | IAM/Data | Security | GATE-DATA-001 | Security | 0 |
| `aa.side_effect.without_record.count` | counter | external effect without record | real-time | connector | SideEffectMgr | SideEffect | GATE-SIDEEFFECT-001 | Runtime | 0 |
| `aa.side_effect.unknown.count` | gauge | unknown side effects | 5m | connector | Reconciliation | SideEffect | GATE-SIDEEFFECT-001 | Runtime | 0 |
| `aa.side_effect.reconciliation.lag_ms` | histogram | now - last reconciliation | 5m | connector | Reconciliation | SideEffect | GATE-SIDEEFFECT-001 | Runtime | p95 < 5m |
| `aa.config.impact_analysis.missing.count` | counter | high-risk config without impact | per rollout | configType | ConfigCenter | Config | GATE-CONFIG-001 | Control | 0 |
| `aa.config.security_drift.failopen.count` | counter | security drift did not fail-close | real-time | configType | Config drift | Config | GATE-CONFIG-002 | Security | 0 |
| `aa.repository.parity.diff.count` | counter | SQLite/PG behavior diff | per test | repo | Repo parity | Storage | GATE-STORE-001 | Storage | 0 |
| `aa.dispatch.ticket.duplicate.count` | counter | duplicate active ticket | real-time | queue | Dispatcher | Dispatch | GATE-DISPATCH-001 | Runtime | 0 |
| `aa.worker.claim.without_lease.count` | counter | worker claim without lease | real-time | worker | Dispatcher | Dispatch | GATE-DISPATCH-001 | Runtime | 0 |
| `aa.queue.backpressure.active` | gauge | queue/event/worker backpressure active | real-time | queue | Queue | Dispatch | GATE-DISPATCH-001 | Runtime | expected under saturation |
| `aa.node.run.stuck.count` | gauge | running NodeRun older than timeout | 1m | tenant,risk | Truth/Dispatcher | Runtime | GATE-RUNTIME-001 | Runtime | 0 |
| `aa.node.run.stuck.duration_ms` | histogram | now - startedAt for stuck NodeRun | 1m | tenant,risk | Truth | Runtime | GATE-RUNTIME-001 | Runtime | p95 within SLA |
| `aa.node.run.recovery.success_ratio` | gauge | recovered / stuck | 1h | tenant | Recovery | Runtime | GATE-RUNTIME-001 | Runtime | >=0.95 |
| `aa.test.noop_assertion.count` | counter | no-op assertions detected | per CI | file | Static scan | CI | GATE-TEST-001 | QA | 0 |
| `aa.test.catch_swallow.count` | counter | catch swallowing failures | per CI | file | Static scan | CI | GATE-TEST-001 | QA | 0 |
| `aa.test.fake_concurrency.count` | counter | fake concurrency tests | per CI | file | Test audit | CI | GATE-TEST-002 | QA | 0 |
| `aa.test.mutation.score` | gauge | mutation score | per module | module | Mutation | CI | GATE-TEST-003 | QA | threshold |
| `aa.autonomy.high_risk_full_auto.count` | counter | high-risk full_auto without HITL | real-time | domain | Autonomy | Governance | GATE-AUTONOMY-001 | Control | 0 |
| `aa.autonomy.override_without_audit.count` | counter | runtime mode override without audit | real-time | principal | Autonomy | Governance | GATE-AUTONOMY-001 | Control | 0 |
| `aa.docs.noncanonical_reference.count` | counter | docs legacy object refs | per CI | doc | Docs scan | Docs | GATE-DOCS-001 | Architect | 0 |
| `aa.docs.unregistered_metric.count` | counter | metric in docs not in registry | per CI | doc | Docs registry scan | Docs | GATE-DOCS-003 | Architect | 0 |
| `aa.docs.unregistered_gate.count` | counter | gate in docs not in registry | per CI | doc | Docs registry scan | Docs | GATE-DOCS-003 | Architect | 0 |
| `aa.observability.trace_missing.count` | counter | required trace missing | per validation | span | OTel audit | Observability | GATE-OBS-001 | SRE | 0 |
| `aa.observability.runbook_missing.count` | counter | P0 alert missing runbook | per validation | gate | Runbook registry | Observability | GATE-OBS-001 | SRE | 0 |
| `aa.projection.rebuild.diff.count` | counter | projection diff after replay | per replay | projection | Replay job | State | GATE-DR-001 | State | 0 |
| `aa.dr.restore_success.count` | counter | successful restore drills | weekly | env | DR job | DR | GATE-DR-001 | SRE | >=1/week |
| `aa.research.quality.score` | gauge | rubric weighted score | per output | mission | Review | Research | Quality gate | Research | >= target |
| `aa.cost.attribution.coverage_ratio` | gauge | attributed_cost / total_cost | per mission | provider,stage | CostTracker | Cost | GATE-BUDGET-001 | FinOps | 1.0 |
| `aa.artifact.hash_mismatch.count` | counter | artifact hash mismatch | per artifact | artifactType | ArtifactStore | Artifact | GATE-ARTIFACT-001 | State | 0 |
| `aa.artifact.recall.propagation_lag_ms` | histogram | recall propagation lag | per recall | artifactType | ArtifactStore | Artifact | GATE-ARTIFACT-001 | State | p95 < 1h |
| `aa.artifact.access_without_policy.count` | counter | artifact access without policy | real-time | tenant | IAM/Artifact | Artifact | GATE-ARTIFACT-001 | Security | 0 |
| `aa.gpu.memory.watermark_ratio` | gauge | used / total gpu memory | 1m | gpu,model | GPU monitor | GPU | GATE-GPU-001 | Infra | <0.9 |
| `aa.gpu.oom.count` | counter | GPU OOM events | real-time | model | GPU monitor | GPU | GATE-GPU-001 | Infra | 0 in validation |
| `aa.ui.operator.action_latency_ms` | histogram | user action to acknowledged response | 5m | action,role | UI telemetry | UI | UI SLO | Frontend | p95 < 800ms |
| `aa.ui.permission.render_mismatch.count` | counter | UI allowed but backend denied or inverse | per test | role,action | UI E2E | UI | UI Gate | Frontend | 0 |
| `aa.ui.dashboard.staleness_ms` | histogram | now - last projection update | 1m | dashboard | UI telemetry | UI | UI Gate | Frontend | p95 < 5000ms |

---

# 49. Runbook Registry done

> Runbook Registry has been incorporated into `config/validation/platform-validation-registry.json`; the current repository retains `deploy/runbooks/` production manuals and Appendix D's detailed human-readable runbooks. Closure will validate that the runbook id referenced by each Gate has an appendix paragraph and machine mapping; the Evidence Bundle is output by `validation:bundle` with the registry snapshot.

Each runbook must have:

```yaml
runbookId: string
title: string
severity: P0 | P1 | P2 | P3
owner: string
linkedGates: string[]
linkedMetrics: string[]
automationAllowed: none | partial | full
requiresHumanApproval: boolean
rollbackSupported: boolean
lastReviewedAt: string
```

---

# 50. Artifact Lifecycle / Integrity Validation done

Must validate:

```text
artifact content hash
artifact storage backend
artifact immutability
artifact retention
artifact recall propagation
artifact access policy
artifact export audit
```

---

# 51. Freeze Checklist done

## 51.1 Registry Closure

| Registry | Must Satisfy |
| --- | --- |
| Gate Registry | All Gates referenced in the main text are registered and can export machine snapshots |
| Metric Registry | All `aa.*` target metrics in the main text / Runbook / Dashboard / RTM are registered and have current exporter or collection mapping |
| Event Registry | The current source code registry is consistent with the exported snapshot; canonical events have payload schema, legacy events have compatibility strategy |
| CI Job Registry | All CI jobs referenced in Gates are registered and can be mapped to real scripts or CI workflows |
| Runbook Registry | Each P0 Gate is bound to a runbook, machine registry has no drift with `deploy/runbooks/` / Appendix D |
| Evidence Bundle | Contains all registry version/hash/signature; only uses `GATE-EVIDENCE-BUNDLE-001` as the unified integrity Gate |

## 51.2 Final Freeze Conditions

```text
All P0 Gates pass
All P1 Gates pass or have owner+expiry+waiver
Scorecard >= 90
Research Mission SLO meets standard
Evidence Bundle signature verification passed
Projection rebuild diff = 0
Data Governance Gate pass
Runbook Registry closure pass
Each required job in CI Job Registry has real execution mapping
Metric Registry and Prometheus exporter/alert mapping have been reviewed
```

---

# 52. Final Acceptance Criteria done

After v1.7 passes, it can be frozen as:

```text
v2.0 — Automatic Agent Platform Validation Baseline
```

Admission conditions:

1. Research Intelligence Mission complete E2E passes.
2. Mission / Task / HarnessRun / PlanGraph / NodeRun / NodeAttempt full link is traceable.
3. All state changes are event-driven and replayable.
4. All LLM / tool / connector calls are budget-reserved first.
5. All conclusions and releases are bound to EvidenceRef / ArtifactRef.
6. Skills / Plugins / Tool Registry pass signature, SBOM, sandbox, egress, receipt validation.
7. Security / Tenant / IAM / Data Governance all P0 Gates pass.
8. RSM / CAS / Lease / Fencing all concurrency validation passes.
9. Dispatch / Worker / Queue / Backpressure validation passes.
10. Model Gateway streaming / usage / fallback / version lock passes.
11. Persistence / Migration / DR restore / Projection rebuild diff=0.
12. CI/CD, Gate, Metric, Event, Runbook, Evidence Bundle five Registry closed loops.
13. Operator Cockpit can complete real governance operations and pass permission chain validation.
14. Evidence Bundle signature verification passes and can be archived for review.

---

# 53. Appendix A: Canonical Event List

## A.1 OAPEFLIR

```text
oapeflir.stage.started
oapeflir.stage.completed
oapeflir.stage.failed
oapeflir.stage.skipped
oapeflir.stage.blocked
oapeflir.stage.replanned
```

## A.2 Runtime

```text
mission.created
mission.activated
mission.paused
mission.resumed
mission.completed
mission.failed
task.created
task.accepted
task.running
task.completed
task.failed
harness.run.created
harness.run.started
harness.run.blocked
harness.run.completed
node.run.queued
node.run.started
node.run.retrying
node.run.completed
node.run.failed
node.attempt.started
node.attempt.completed
node.attempt.failed
```

## A.3 Budget / Cost

```text
budget.reservation.created
budget.reservation.denied
budget.reservation.settled
budget.reservation.expired
cost.attribution.recorded
```

## A.4 Tool

```text
tool.registered
tool.resolved
tool.invocation.requested
tool.invocation.started
tool.invocation.completed
tool.invocation.failed
tool.schema.validation_failed
tool.policy.denied
tool.budget.denied
```

## A.5 Plugin

```text
plugin.registered
plugin.manifest.validated
plugin.signature.verified
plugin.signature.failed
plugin.sbom.scanned
plugin.sbom.scan_failed
plugin.sandbox.validated
plugin.sandbox.violation
plugin.loaded
plugin.activated
plugin.suspended
plugin.deprecated
plugin.archived
plugin.rejected
plugin.quarantined
plugin.revoked
plugin.critical_cve.detected
```

## A.6 Connector

```text
connector.bound
connector.health.changed
connector.egress.allowed
connector.egress.denied
connector.rate_limited
connector.circuit.opened
connector.side_effect.recorded
```

## A.7 Evidence / Artifact / Knowledge

```text
evidence.ref.created
evidence.bundle.created
evidence.bundle.signed
artifact.created
artifact.verified
artifact.published
artifact.deprecated
artifact.archived
artifact.recalled
knowledge.object.quarantined
knowledge.object.validated
knowledge.object.promoted
knowledge.object.rollback_requested
```

## A.8 Data Governance

```text
data.source.registered
data.source.classified
data.source.license.missing
data.pii.detected
data.pii.redacted
data.retention.applied
data.contamination.tagged
data.governance.failed
```

---

# 54. Appendix B: Test List done

```text
B.1 Mission / Task / Session Tests
B.2 OAPEFLIR Stage Tests
B.3 PlanGraph / DAG Tests
B.4 RSM / CAS / Lease / Fencing Tests
B.5 Budget / Cost Tests
B.6 Tool Registry Tests
B.7 Plugin Runtime Tests
B.8 Connector Runtime Tests
B.9 Sandbox / Egress Tests
B.10 Model Gateway / Streaming Tests
B.11 EventBus / Truth / Projection Tests
B.12 SideEffect / Reconciliation Tests
B.13 Config / Drift / Rollout Tests
B.14 Persistence / Migration Tests
B.15 Dispatch / Worker / Queue Tests
B.16 Test Quality Governance Tests
B.17 Autonomy / Runtime Mode Tests
B.18 Prompt / Skill / Knowledge Rollout Tests
B.19 Docs / ADR / Contract Drift Tests
B.20 Data Governance Tests
B.21 Evidence Bundle Integrity Tests
B.22 UI Operator Cockpit Tests
B.23 DR / Restore Tests
B.24 GPU Capacity Tests
```

---

# 55. Appendix C: Dashboard Field List done

```text
Mission:
  active_missions
  failed_missions
  mission_slo_status
  research_quality_score

Runtime:
  harness_runs
  node_runs
  stuck_node_runs
  worker_claims
  queue_depth
  backpressure_active

OAPEFLIR:
  stage_status
  stage_failure_count
  stage_skip_count
  replan_count

Tool / Plugin / Connector:
  tool_invocation_qps
  tool_receipt_coverage
  plugin_signature_failed_count
  plugin_sandbox_violation_count
  connector_egress_denied_count

Model:
  model_usage_missing_count
  streaming_finish_reason_missing_count
  fallback_count
  cost_attribution_ratio

Security / Data:
  cross_tenant_denied_count
  secret_access_without_audit
  data_license_missing_count
  pii_redaction_missing_count

Artifact / Evidence:
  evidence_coverage_ratio
  artifact_hash_mismatch_count
  evidence_bundle_signature_status

CI / Registry:
  gate_closure_status
  metric_registry_closure_status
  event_schema_registry_status
  runbook_registry_closure_status
```

---

# 56. Appendix D: Runbook Registry done

## D.1 Event / Truth Inconsistency

```yaml
runbookId: D.1
title: Event / Truth Inconsistency
severity: P0
owner: State-Evidence Owner
linkedGates: [GATE-STATE-001, GATE-PRIORITY-001]
linkedMetrics: [aa.truth.atomicity.violation.count]
automationAllowed: partial
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.2 Budget Missing / Overspend

```yaml
runbookId: D.2
title: Budget Missing / Overspend
severity: P0
owner: FinOps Owner
linkedGates: [GATE-BUDGET-001]
linkedMetrics:
  [aa.budget.reservation.missing.count, aa.cost.attribution.coverage_ratio]
automationAllowed: partial
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.3 Stuck NodeRun

```yaml
runbookId: D.3
title: Stuck NodeRun
severity: P1
owner: Runtime Owner
linkedGates: [GATE-RUNTIME-001]
linkedMetrics:
  [
    aa.node.run.stuck.count,
    aa.node.run.stuck.duration_ms,
    aa.node.run.recovery.success_ratio,
  ]
automationAllowed: partial
requiresHumanApproval: false
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.4 HITL Timeout / Invalid Decision

```yaml
runbookId: D.4
title: HITL Timeout / Invalid Decision
severity: P0
owner: Control Plane Owner
linkedGates: [GATE-HITL-001]
linkedMetrics:
  [aa.hitl.unauthorized_decision.count, aa.hitl.double_decision.count]
automationAllowed: partial
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.5 Plugin Sandbox Violation

```yaml
runbookId: D.5
title: Plugin Sandbox Violation
severity: P0
owner: Extension Runtime Owner
linkedGates: [GATE-PLUGIN-001]
linkedMetrics:
  [aa.plugin.sandbox_violation.count, aa.plugin.signature.failed.count]
automationAllowed: partial
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.6 RSM Bypass

```yaml
runbookId: D.6
title: Runtime State Machine Bypass
severity: P0
owner: Runtime Owner
linkedGates: [GATE-RSM-001]
linkedMetrics: [aa.rsm.bypass.count]
automationAllowed: none
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.7 CAS Conflict / Bypass

```yaml
runbookId: D.7
title: CAS Conflict / Bypass
severity: P0
owner: Runtime Owner
linkedGates: [GATE-CAS-001]
linkedMetrics: [aa.cas.conflict.rejected.count]
automationAllowed: partial
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.8 Lease Expired Write

```yaml
runbookId: D.8
title: Lease Expired Write
severity: P0
owner: Runtime Owner
linkedGates: [GATE-LEASE-001]
linkedMetrics: [aa.lease.expired_write.rejected.count]
automationAllowed: partial
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.9 Fencing Stale Write

```yaml
runbookId: D.9
title: Fencing Stale Write
severity: P0
owner: Runtime Owner
linkedGates: [GATE-FENCING-001]
linkedMetrics: [aa.fencing.stale_write.rejected.count]
automationAllowed: partial
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.10 Terminal Reverse Transition

```yaml
runbookId: D.10
title: Terminal Reverse Transition
severity: P0
owner: Runtime Owner
linkedGates: [GATE-TERMINAL-001]
linkedMetrics: [aa.terminal.reverse_transition.count]
automationAllowed: none
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.11 Evidence Coverage Failure

```yaml
runbookId: D.11
title: Evidence Coverage Failure
severity: P0
owner: Research Owner
linkedGates: [GATE-EVIDENCE-001]
linkedMetrics: [aa.evidence.ref.coverage_ratio]
automationAllowed: partial
requiresHumanApproval: true
rollbackSupported: false
lastReviewedAt: "YYYY-MM-DD"
```

## D.12 Evidence Bundle Integrity Failure

```yaml
runbookId: D.12
title: Evidence Bundle Integrity Failure
severity: P0
owner: QA Owner
linkedGates: [GATE-EVIDENCE-BUNDLE-001]
linkedMetrics: [aa.evidence_bundle.signature.invalid.count]
automationAllowed: none
requiresHumanApproval: true
rollbackSupported: false
lastReviewedAt: "YYYY-MM-DD"
```

## D.13 Tool Registry Bypass

```yaml
runbookId: D.13
title: Tool Registry Bypass
severity: P0
owner: Extension Runtime Owner
linkedGates: [GATE-TOOL-001]
linkedMetrics:
  [aa.tool.direct_invocation.count, aa.tool.invocation.without_receipt.count]
automationAllowed: partial
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.14 Connector Egress Denied / Bypass

```yaml
runbookId: D.14
title: Connector Egress Policy Failure
severity: P0
owner: Security Owner
linkedGates: [GATE-CONNECTOR-001]
linkedMetrics: [aa.connector.egress.denied.count]
automationAllowed: partial
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.15 OAPEFLIR Stage Event Missing

```yaml
runbookId: D.15
title: OAPEFLIR Stage Event Missing
severity: P0
owner: Orchestration Owner
linkedGates: [GATE-OAPEFLIR-001]
linkedMetrics: [aa.oapeflir.stage.event_missing.count]
automationAllowed: partial
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.16 Linear Plan Detected

```yaml
runbookId: D.16
title: Linear Plan Detected
severity: P0
owner: Orchestration Owner
linkedGates: [GATE-OAPEFLIR-002]
linkedMetrics: [aa.oapeflir.plan.linear_plan.count]
automationAllowed: none
requiresHumanApproval: true
rollbackSupported: false
lastReviewedAt: "YYYY-MM-DD"
```

## D.17 Feedback Gate Unresolved

```yaml
runbookId: D.17
title: Feedback Gate Unresolved
severity: P1
owner: Orchestration Owner
linkedGates: [GATE-OAPEFLIR-003]
linkedMetrics: [aa.oapeflir.feedback.unresolved.count]
automationAllowed: partial
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.18 Tenant Isolation Breach

```yaml
runbookId: D.18
title: Tenant Isolation Breach
severity: P0
owner: Security Owner
linkedGates: [GATE-TENANT-001]
linkedMetrics: [aa.tenant.cross_access.denied.count]
automationAllowed: none
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.19 Secret / IAM Audit Failure

```yaml
runbookId: D.19
title: Secret / IAM Audit Failure
severity: P0
owner: Security Owner
linkedGates: [GATE-SECURITY-001]
linkedMetrics: [aa.secret.access.without_audit.count]
automationAllowed: none
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.20 SideEffect Duplicate / Missing Record

```yaml
runbookId: D.20
title: SideEffect Duplicate / Missing Record
severity: P0
owner: Runtime Owner
linkedGates: [GATE-SIDEEFFECT-001]
linkedMetrics:
  [
    aa.side_effect.without_record.count,
    aa.side_effect.unknown.count,
    aa.side_effect.reconciliation.lag_ms,
  ]
automationAllowed: partial
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.21 Dispatch Ticket / Worker Claim Failure

```yaml
runbookId: D.21
title: Dispatch Ticket / Worker Claim Failure
severity: P0
owner: Runtime Owner
linkedGates: [GATE-DISPATCH-001]
linkedMetrics:
  [
    aa.dispatch.ticket.duplicate.count,
    aa.worker.claim.without_lease.count,
    aa.queue.backpressure.active,
  ]
automationAllowed: partial
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.22 Config Drift / Rollout Failure

```yaml
runbookId: D.22
title: Config Drift / Rollout Failure
severity: P0
owner: Control Plane Owner
linkedGates:
  [
    GATE-CONFIG-001,
    GATE-CONFIG-002,
    GATE-CONFIG-003,
    GATE-CONFIG-004,
    GATE-CONFIG-005,
  ]
linkedMetrics:
  [
    aa.config.impact_analysis.missing.count,
    aa.config.security_drift.failopen.count,
  ]
automationAllowed: partial
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.23 Model Gateway Provider Failure

```yaml
runbookId: D.23
title: Model Gateway Provider Failure
severity: P1
owner: Model Infra Owner
linkedGates: [GATE-MODEL-001]
linkedMetrics:
  [
    aa.model.request.without_budget.count,
    aa.model.usage.missing.count,
    aa.model.streaming.finish_reason.missing.count,
    aa.model.version_lock.missing.count,
  ]
automationAllowed: partial
requiresHumanApproval: false
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.24 Repository Parity / Migration Failure

```yaml
runbookId: D.24
title: Repository Parity / Migration Failure
severity: P1
owner: Storage Owner
linkedGates: [GATE-STORE-001]
linkedMetrics: [aa.repository.parity.diff.count]
automationAllowed: partial
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.25 Observability / Runbook Missing

```yaml
runbookId: D.25
title: Observability / Runbook Missing
severity: P0
owner: SRE Owner
linkedGates: [GATE-OBS-001]
linkedMetrics:
  [aa.observability.trace_missing.count, aa.observability.runbook_missing.count]
automationAllowed: partial
requiresHumanApproval: true
rollbackSupported: false
lastReviewedAt: "YYYY-MM-DD"
```

## D.26 Data Governance / Retention / Contamination Failure

```yaml
runbookId: D.26
title: Data Governance / Retention / Contamination Failure
severity: P0
owner: Data Governance Owner
linkedGates: [GATE-DATA-001]
linkedMetrics:
  [
    aa.data.source.license_missing.count,
    aa.data.source.retention_policy_missing.count,
    aa.data.pii.redaction_missing.count,
    aa.data.contamination_tag_missing.count,
    aa.data.copyright_boundary_violation.count,
    aa.data.restricted_access_bypass.count,
  ]
automationAllowed: partial
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.27 Test Quality Failure

```yaml
runbookId: D.27
title: Test Quality Failure
severity: P0
owner: QA Owner
linkedGates: [GATE-TEST-001, GATE-TEST-002, GATE-TEST-003]
linkedMetrics:
  [
    aa.test.noop_assertion.count,
    aa.test.catch_swallow.count,
    aa.test.fake_concurrency.count,
    aa.test.mutation.score,
  ]
automationAllowed: partial
requiresHumanApproval: false
rollbackSupported: false
lastReviewedAt: "YYYY-MM-DD"
```

## D.28 Autonomy Boundary Failure

```yaml
runbookId: D.28
title: Autonomy Boundary Failure
severity: P0
owner: Control Plane Owner
linkedGates: [GATE-AUTONOMY-001]
linkedMetrics:
  [
    aa.autonomy.high_risk_full_auto.count,
    aa.autonomy.override_without_audit.count,
  ]
automationAllowed: partial
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.29 Rollout Gate Failure

```yaml
runbookId: D.29
title: Rollout Gate Failure
severity: P1
owner: Release Owner
linkedGates: [GATE-ROLLOUT-001]
linkedMetrics: []
automationAllowed: partial
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.30 Documentation / Contract Drift

```yaml
runbookId: D.30
title: Documentation / Contract Drift
severity: P1
owner: Platform Architect
linkedGates: [GATE-DOCS-001, GATE-DOCS-002, GATE-DOCS-003]
linkedMetrics:
  [
    aa.docs.noncanonical_reference.count,
    aa.docs.unregistered_metric.count,
    aa.docs.unregistered_gate.count,
  ]
automationAllowed: partial
requiresHumanApproval: false
rollbackSupported: false
lastReviewedAt: "YYYY-MM-DD"
```

## D.31 Restore / Replay Failure

```yaml
runbookId: D.31
title: Restore / Replay Failure
severity: P0
owner: SRE Owner
linkedGates: [GATE-DR-001]
linkedMetrics: [aa.projection.rebuild.diff.count, aa.dr.restore_success.count]
automationAllowed: partial
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.32 Artifact Integrity Failure

```yaml
runbookId: D.32
title: Artifact Integrity Failure
severity: P1
owner: State-Evidence Owner
linkedGates: [GATE-ARTIFACT-001]
linkedMetrics:
  [
    aa.artifact.hash_mismatch.count,
    aa.artifact.recall.propagation_lag_ms,
    aa.artifact.access_without_policy.count,
  ]
automationAllowed: partial
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.33 Local GPU Capacity Failure

```yaml
runbookId: D.33
title: Local GPU Capacity Failure
severity: P1
owner: Infra Owner
linkedGates: [GATE-GPU-001]
linkedMetrics: [aa.gpu.memory.watermark_ratio, aa.gpu.oom.count]
automationAllowed: partial
requiresHumanApproval: false
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

## D.34 Marketplace Premature Enablement

```yaml
runbookId: D.34
title: Marketplace Premature Enablement
severity: P0
owner: Platform Owner
linkedGates: [GATE-MARKETPLACE-OFF-001]
linkedMetrics: []
automationAllowed: partial
requiresHumanApproval: true
rollbackSupported: true
lastReviewedAt: "YYYY-MM-DD"
```

---

# 57. Appendix E: Machine-Executable Artifact List done

## E.1 Current In-Repo Existing Baseline

Implementations and configuration baselines that can be directly located during review include:

```text
src/platform/five-plane-state-evidence/events/event-registry.ts
src/platform/shared/observability/prometheus-metrics-exporter.ts
deploy/prometheus/rules/automatic-agent.yml
deploy/prometheus/alertmanager.yml
deploy/grafana/dashboards/automatic-agent.json
deploy/runbooks/
config/validation/mission-operating-model-registry.json
config/validation/platform-validation-registry.json
config/validation/platform-monitoring-metric-map.json
config/validation/platform-lifecycle-matrix.json
scripts/validation/mission-operating-model-closure.mjs
scripts/validation/platform-validation-closure.mjs
scripts/validation/export-platform-validation-artifacts.ts
scripts/validation/platform-product-validation.ts
scripts/run-layered-tests.mjs
```

## E.2 Exportable Machine Artifacts

`npm run validation:artifacts` currently exports Event/Gate/Metric/CI/Runbook snapshots to `artifacts/validation/platform/contracts/`, and simultaneously exports the `schemas/` and `generated/` artifacts listed in this section; `npm run validation:bundle` will validate these artifacts after the registry snapshot, and then execute evidence bundle targeted validation. `platform-validation-closure` simultaneously generates closure reports under `reports/`:

```text
contracts/
  event-registry.canonical.json
  gate-registry.canonical.json
  metric-registry.canonical.json
  runbook-registry.canonical.yaml
  ci-job-registry.canonical.json
  lifecycle-matrix.canonical.json

schemas/
  event-payload-schemas/*.schema.json
  validation-evidence-bundle.schema.json
  plugin-manifest.schema.json
  tool-definition.schema.json
  data-governance.schema.json

generated/
  typed-event-payloads.generated.ts
  gate-registry.generated.ts
  metric-registry.generated.ts

reports/
  contract-report.json
  metric-registry-closure-report.json
  gate-registry-closure-report.json
  event-schema-coverage-report.json
  runbook-registry-closure-report.json
  validation-bundle.json
  ui-validation-report.json
  research-validation-report.json
  observability-validation-report.json
  capacity-validation-report.json
  gpu-validation-report.json
  scorecard-validation-report.json
  freeze-validation-report.json
