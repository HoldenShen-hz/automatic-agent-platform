# "Enterprise-Grade Agent Platform Overall Technical Architecture Design Document"

> **Document version**: v4.3
> **Document status**: Archived historical version (not the current authoritative source)
> **Document positioning**: Enterprise / platform-grade Agent System overall technical architecture design document (stability-first · complete AI operations · complete business domain onboarding · complete vertical business domain deepening (24 domains) · unified domain meta-model · multi-Agent collaboration protocol · complete intelligent interaction · complete organizational governance · complete scaled ecosystem · complete operational maturity · Harness authoritative runtime · OAPEFLIR controlled cognitive framework · minimal production closed loop · three-ring implementation priority · implementation-oriented version)
> **Intended audience**: Architecture committee, platform R&D team, Runtime team, SRE, security team, governance team, business domain onboarding team, AI/ML engineering team, business line owners, non-technical business operators, organizational management, compliance/audit team, ecosystem partners, edge/field operations team, **vertical business domain architects (quantitative trading · e-commerce · advertising · finance · data · code · operations · industry research · academic research · knowledge base · finance · legal · online live streaming · ad creative · game development · game publishing · human resources · supply chain · healthcare · education & training · customer service · content moderation · IT operations · marketing)**
> **Design goal**: Build an enterprise-grade Agent platform that takes stability, risk control, security, reliability, and exception handling as its first principles, so that Agents as high-risk automation units can run long term in enterprise environments in a controllable, recoverable, and auditable manner; at the same time, possess complete AI operations capabilities (LLM abstraction, Prompt governance, model quality, cost control) to ensure the platform is equally controllable and evolvable at the AI level; provide a structured business domain modeling and onboarding framework; build an intelligent interaction layer for non-technical users; establish a complete organizational governance system and scaled runtime ecosystem layer; complete the operational maturity layer; **and use HarnessRuntime as the only executable runtime, converging OAPEFLIR into a controlled cognitive and governance framework, so that Agents upgrade from "one-off model invocations" to "constrained, graph-planned, recoverable, auditable, and operable" production-grade systems**
> **v4.3 version positioning**: Spec-frozen version. This version converges authoritative objects, MVP physical boundaries, runtime naming, and testable invariants; historical v4.1 and OAPEFLIR v4.4 Executable Spec are used only as migration input. Implementation priority is governed by §33 MVP / Hardening / Enterprise three rings. HarnessRuntime is the only executable entry, HarnessRun is the only authoritative Run, PlanGraphBundle is the P3 → P4 canonical execution contract, OAPEFLIR stages only exist as StageRationale / TraceProjection / Audit View; default uses Trace Replay, does not assume LLM can deterministically replay.

> **Authoritative source model**: Executable Runtime Contract, Schema / Zod / OpenAPI / Event Registry are the machine-acceptance authority; this document is the human-architecture authority; ADR is the change-adjudication authority. If the machine contract conflicts with this document, the document or schema must be corrected in the same PR/ADR; implementations are not allowed to silently override; for security, risk, compliance, and data protection conflicts, the stricter interpretation wins without changing the authority-object ownership.

---

## Archive Notes (2026-05-26)

1. This document has been moved into `docs_zh/architecture/archive/`, preserving its historical design semantics, section numbers, and migration background, and is no longer the sole upstream design source of the current system.
2. For the current authoritative architecture document, please first read:
   - [00-platform-architecture.md](../00-platform-architecture.md)
   - [01-code-structure.md](../01-code-structure.md)
   - [03-module-diagrams.md](../03-module-diagrams.md)
   - [04-runtime-sequence.md](../04-runtime-sequence.md)
   - [05-cross-platform-ui-architecture.md](../05-cross-platform-ui-architecture.md)
3. If this document conflicts with the current implementation, the current authoritative document, machine contracts, OpenAPI, Schema, and Review write-backs prevail.

### Key Differences from Current Implementation

| Topic | Historical Stance in This Archive | Current System Stance |
|---|---|---|
| Architectural authority | This document, as the "overall technical architecture design document", directly carries the top-level authority | The current sole upstream design source is [00-platform-architecture.md](../00-platform-architecture.md); this file is preserved only as a historical archive |
| UI common query layer | Historically allowed expressing some admin-plane capabilities via `/api/v1/admin/workers`, `/api/v1/admin/*` | The current public UI contract has converged to Layer C entry points such as `/v1/workers`, `/v1/queues`, `/v1/agents`, `/v1/dashboard/metrics` |
| Frontend API path scheme | Historical body text often describes frontend-backend interfaces directly via `/api/v1/*` | The current frontend runtime defaults to `baseUrl=/api`, with endpoint catalog unified as `/v1/*`, concatenated to form `/api/v1/*` |
| Federation governance persistence | Federation audit and trust relationship in the archived version are more like spec commitments | The current implementation has completed the persistence, recovery, archival, and policy enforcement of `FederationAudit` and `TrustRelationship` |
| Event reliability | Archived version emphasizes Tier-1 event reliability and failure visibility | The current implementation has fixed the issue of `DurableEventBusAsync` swallowing async failures; failures are re-handled on the main chain |
| Electron platform bridge | Desktop bridge naming differences were not solidified in the archive period | The current implementation has unified the `AA_ELECTRON` / `__AA_ELECTRON__` bridge compatibility layer |

### Current Implementation Evidence Entry Points

1. System-level review and fix write-back: [system-review-2026-05-26.md](../../reviews/system-review-2026-05-26.md)
2. Current architecture directory index: [README.md](../README.md)
3. Current public API and route export surface: `src/platform/five-plane-interface/api/http-server/`, `src/platform/five-plane-interface/api/openapi-document.ts`

---

# Table of Contents

> This document is organized by a **ten-layer architecture** into 11 Parts; section numbers are kept stable for compatibility with historical references.

**Preface (§1-§3)**

1. [Document Overview](#1-document-overview)
2. [Platform Root Assumptions and Design Goals](#2-platform-root-assumptions-and-design-goals)
3. [Platform Definition and Non-Goals](#3-platform-definition-and-non-goals)

**Part I — Infrastructure Layer (§4-§14, §24-§32)**
4. [Overall Architecture: Five Planes + One Cross-Cutting Control Fabric](#4-overall-architecture-five-planes--one-cross-cutting-control-fabric)
5. [Inter-Plane Communication Contracts](#5-inter-plane-communication-contracts)
6. [API Contracts and Versioned Architecture](#6-api-contracts-and-versioned-architecture)
7. [Service Communication Architecture](#7-service-communication-architecture)
8. [Scalability Architecture](#8-scalability-architecture)
9. [Stability Architecture](#9-stability-architecture)
10. [Risk Control Architecture](#10-risk-control-architecture)
11. [Security and Reliability Architecture](#11-security-and-reliability-architecture)
12. [Exception Event Handling Architecture](#12-exception-event-handling-architecture)
13. [OAPEFLIR Controlled Cognitive Framework](#13-oapeflir-controlled-cognitive-framework)
14. [Runtime Execution Plane](#14-runtime-execution-plane)
24. [Configuration Governance Architecture](#24-configuration-governance-architecture)
25. [Data and State Consistency Architecture](#25-data-and-state-consistency-architecture)
26. [Storage Architecture](#26-storage-architecture)
27. [Performance Architecture and SLO](#27-performance-architecture-and-slo)
28. [Event Registry / Projection / Incident / DLQ Model](#28-event-registry--projection--incident--dlq-model)
29. [Knowledge / Memory / Artifact / Learning Boundaries](#29-knowledge--memory--artifact--learning-boundaries)
30. [Business Onboarding Constraints and Business Pack Model](#30-business-onboarding-constraints-and-business-pack-model)
31. [Disaster Recovery and High-Availability Architecture](#31-disaster-recovery-and-high-availability-architecture)
32. [Deployment Architecture](#32-deployment-architecture)

**Part II — AI Operations Layer (§15-§23)**
15. [LLM Provider Abstraction and Failover Architecture](#15-llm-provider-abstraction-and-failover-architecture)
16. [Prompt Management and Versioned Architecture](#16-prompt-management-and-versioned-architecture)
17. [Model Evaluation and Quality Gate Architecture](#17-model-evaluation-and-quality-gate-architecture)
18. [Cost Management and Token Metering Architecture](#18-cost-management-and-token-metering-architecture)
19. [Inter-Agent Delegation and Collaboration Architecture](#19-inter-agent-delegation-and-collaboration-architecture)
20. [Long-Running Task and Workflow Sleep Architecture](#20-long-running-task-and-workflow-sleep-architecture)
21. [Human-Machine Collaboration Mode Architecture](#21-human-machine-collaboration-mode-architecture)
22. [SDK and Developer Experience Architecture](#22-sdk-and-developer-experience-architecture)
23. [Compliance and Data Governance Architecture](#23-compliance-and-data-governance-architecture)

**Part III — Business Domain Onboarding Layer (§37-§38)**
37. [Business Domain Modeling and Onboarding Architecture](#37-business-domain-modeling-and-onboarding-architecture)
38. [Business Domain Onboarding Runbook](#38-business-domain-onboarding-runbook)

**Part IV — Vertical Business Domain Deepening Layer (§71-§94)**
71. [Quantitative Trading Domain Architecture](#71-quantitative-trading-domain-architecture)
72. [E-Commerce Domain Architecture](#72-e-commerce-domain-architecture)
73. [Advertising Promotion Domain Architecture](#73-advertising-promotion-domain-architecture)
74. [Financial Services Domain Architecture](#74-financial-services-domain-architecture)
75. [Data Processing Domain Architecture](#75-data-processing-domain-architecture)
76. [Code Development Domain Architecture](#76-code-development-domain-architecture)
77. [User Operations Domain Architecture](#77-user-operations-domain-architecture)
78. [Industry Research Domain Architecture](#78-industry-research-domain-architecture)
79. [Academic Research Domain Architecture](#79-academic-research-domain-architecture)
80. [Enterprise Knowledge Base Domain Architecture](#80-enterprise-knowledge-base-domain-architecture)
81. [Finance Domain Architecture](#81-finance-domain-architecture)
82. [Legal Domain Architecture](#82-legal-domain-architecture)
83. [Online Live Streaming Domain Architecture](#83-online-live-streaming-domain-architecture)
84. [Ad Creative Production Domain Architecture](#84-ad-creative-production-domain-architecture)
85. [Game Development Domain Architecture](#85-game-development-domain-architecture)
86. [Game Publishing Domain Architecture](#86-game-publishing-domain-architecture)
87. [Human Resources Domain Architecture](#87-human-resources-domain-architecture)
88. [Supply Chain and Logistics Domain Architecture](#88-supply-chain-and-logistics-domain-architecture)
89. [Healthcare Domain Architecture](#89-healthcare-domain-architecture)
90. [Education and Training Domain Architecture](#90-education-and-training-domain-architecture)
91. [Customer Service Domain Architecture](#91-customer-service-domain-architecture)
92. [Content Moderation and Security Domain Architecture](#92-content-moderation-and-security-domain-architecture)
93. [IT Operations SRE/DevOps Domain Architecture](#93-it-operations-sredevops-domain-architecture)
94. [Marketing and Brand Domain Architecture](#94-marketing-and-brand-domain-architecture)

**Part V — Intelligent Interaction Layer (§39-§44)**
39. [Natural Language Task Entry Architecture](#39-natural-language-task-entry-architecture)
40. [Goal Decomposition Engine Architecture](#40-goal-decomposition-engine-architecture)
41. [Proactive Agent Framework](#41-proactive-agent-framework)
42. [Progressive Autonomy Model](#42-progressive-autonomy-model)
43. [Unified Operations Dashboard Architecture](#43-unified-operations-dashboard-architecture)
44. [Non-Technical User Experience Architecture](#44-non-technical-user-experience-architecture)

**Part VI — Harness Authoritative Runtime and Eight-Pillar Deepening Layer (§45, §58)**
45. [Harness Runtime Authoritative Execution Model](#45-harness-runtime-authoritative-execution-model)
58. [Harness Cross-Cutting Concerns](#58-harness-cross-cutting-concerns)

**Part VII — Organizational Governance Layer (§46-§51)**
46. [Organizational Hierarchy Model](#46-organizational-hierarchy-model)
47. [Organizational Approval Routing](#47-organizational-approval-routing)
48. [Enterprise SSO/SCIM Integration Architecture](#48-enterprise-ssoscim-integration-architecture)
49. [Department Compliance Policy Engine](#49-department-compliance-policy-engine)
50. [Knowledge Domain Isolation and Controlled Sharing](#50-knowledge-domain-isolation-and-controlled-sharing)
51. [Tiered Governance Delegation](#51-tiered-governance-delegation)

**Part VIII — Scaled Runtime Layer and Ecosystem Layer (§52-§57)**
52. [Multi-Region Deployment Architecture](#52-multi-region-deployment-architecture)
53. [Scaled Resource Contention Management](#53-scaled-resource-contention-management)
54. [SLA Tiered Assurance](#54-sla-tiered-assurance)
55. [Agent Marketplace and Ecosystem](#55-agent-marketplace-and-ecosystem)
56. [Feedback-Driven Continuous Improvement Pipeline](#56-feedback-driven-continuous-improvement-pipeline)
57. [External System Integration Framework](#57-external-system-integration-framework)

**Part IX — Operational Maturity Layer (§59-§69)**
59. [Agent Explainability and Decision Transparency Architecture](#59-agent-explainability-and-decision-transparency-architecture)
60. [Emergency Brake and Global Circuit Breaker Architecture](#60-emergency-brake-and-global-circuit-breaker-architecture)
61. [Agent Unified Lifecycle Management Architecture](#61-agent-unified-lifecycle-management-architecture)
62. [Offline and Edge Deployment Architecture](#62-offline-and-edge-deployment-architecture)
63. [Agent Behavior Drift Detection Architecture](#63-agent-behavior-drift-detection-architecture)
64. [Cost Attribution and Optimization Engine](#64-cost-attribution-and-optimization-engine)
65. [Workflow Visual Debugger Architecture](#65-workflow-visual-debugger-architecture)
66. [Compliance Report Auto-Generation Engine](#66-compliance-report-auto-generation-engine)
67. [Capacity Planning and Cost Forecasting Engine](#67-capacity-planning-and-cost-forecasting-engine)
68. [Multimodal Capability Architecture](#68-multimodal-capability-architecture)
69. [Platform Self-Operations Agent Architecture](#69-platform-self-operations-agent-architecture)

**Part X — Implementation Roadmap and Summary (§33-§36)**
33. [Phased Implementation Roadmap](#33-phased-implementation-roadmap)
34. [ADR Freeze Recommendations](#34-adr-freeze-recommendations)
35. [Recommended Code Directory](#35-recommended-code-directory)
36. [Risks, Constraints, and Success Criteria](#36-risks-constraints-and-success-criteria)

**Part XI — Conclusion and Appendix**
70. [Conclusion](#70-conclusion)
[Appendix G: Glossary and Abbreviation Index](#appendix-g-glossary-and-abbreviation-index)
[Appendix H: OAPEFLIR v4.4 Executable Spec and v4.2 Convergence Rules](#appendix-h-oapeflir-v44-executable-spec-and-v42-convergence-rules)
[Appendix A: Version Change History](#appendix-a-version-change-history)

---

# Overview of Main Skeleton

This section summarizes the core structure of the entire architecture document with five diagrams; readers can first build a global picture and then dive in as needed.

### Figure 1 — Static Architecture (Five Planes + Cross-Cutting Fabric)

```text
┌─────────────────────────────────────────────────────────┐
│                   P1  Interface Plane                    │  §5-§7, §39, §44
├─────────────────────────────────────────────────────────┤
│                   P2  Control Plane                      │  §10, §12, §24, §46-§51, §60
├─────────────────────────────────────────────────────────┤
│         P3  Orchestration Plane (Harness Runtime)        │  §13, §19-§21, §40-§42, §45, §58
├─────────────────────────────────────────────────────────┤
│                   P4  Execution Plane                    │  §14, §45, §57
├─────────────────────────────────────────────────────────┤
│                   P5  Evidence Plane                     │  §25-§29
├─────────────────────────────────────────────────────────┤
│  X1 Reliability Fabric (cross five planes: retry/breaker/isolation/audit) │  §9-§12, §31-§32, §52, §60
└─────────────────────────────────────────────────────────┘
```

### Figure 2 — Runtime Main Chain (Typical Path of One Task)

```text
Request
  ─→ ConstraintPack
  ─→ Observe / Assess
  ─→ PlanGraph
  ─→ Deterministic Graph Scheduler
  ─→ Node Execution Runtime
  ─→ SideEffect Manager / HITL / Reconciliation
  ─→ Evaluator
  ─→ HarnessDecision
  ─→ Result + Evidence
```

### Figure 3 — Governance Closed Loop (Continuous Improvement Cycle)

```text
Run ──→ Evidence ──→ Feedback ──→ Learn/Drift-Detect
 ↑                                        │
 └── Release ← Improve ← Evaluation ←────┘
```

### Figure 4 — Evolution Roadmap (Phase Overview, see §33 for details)

```text
Ring 1 MVP Slice (8-12w)
  HarnessRuntime entry · PlanGraphBundle · NodeRun · BudgetReservation
  SideEffectManager · HITL basic · Trace Replay · CLI inspect
        │
        ▼
Ring 2 Hardening (3-6m)
  Recovery · Projection rebuild · Incident/DLQ · Config governance
  Org approval · Prompt/Eval rollout · Domain pilots
        │
        ▼
Ring 3 Enterprise (6-18m)
  Multi-region · Marketplace · Edge · Advanced domains

Old Phase 1-9 only serves as historical schedule mapping; Phase 8a-8d has been split into Ring 1/2 delivery packages.
```

### Figure 5 — HarnessRuntime + OAPEFLIR Semantic Projection

```text
RequestEnvelope
   │
   ▼
HarnessRun admitted
   │
   ▼
OAPEFLIR StageRationale: Observe ─→ Assess ─→ PlanGraph
                                      │
                                      ▼
                         Graph Normalize / Validate / Risk Propagate
                                      │
                                      ▼
                           Deterministic Graph Scheduler
                                      │
                                      ▼
                               Node Execution
                                      │
                  ┌───────────────────┼───────────────────┐
                  ▼                   ▼                   ▼
              Tool / LLM          HITL Wait          Subgraph
                  │                   │                   │
                  ▼                   ▼                   ▼
            SideEffect Manager   HumanDecision       Child HarnessRun
                  │
                  ▼
         Confirm / Reconcile / Compensate
                  │
                  ▼
              Evaluator
                  │
       accept / retry / replan / escalate / abort
                  │
                  ▼
          Feedback → Learn → Improve → Release
```

---

# 1. Document Overview

## 1.1 Background

Enterprise expectations for Agents have evolved from "question-answering systems" to "intelligent automation platforms that can connect to systems, run processes, perform execution, be governed, be audited, and continuously evolve".

However, most Agent systems still have obvious engineering shortcomings:

- Default trust in model output
- Default assumption that tool calls will succeed
- Default assumption that external systems are available
- Default assumption that workflows will run once orchestrated
- Default assumption that exceptions only need to be logged
- Default assumption that post-launch behavior is acceptable

These assumptions do not hold in enterprise production environments.

The first challenge for an enterprise-grade Agent platform is not "insufficient capability" but "uncontrollable risk is too high".
Therefore, this version of the architecture elevates the following questions to primary design objects:

- How does the system not lose control when it fails
- How are high-risk actions identified and converged
- How to degrade when external dependencies are abnormal
- How to recover after a worker crashes
- How side effects are controlled and held accountable
- How to roll back when a release fails
- How to rebuild projection when it deviates
- How does the system safely stop when approvals are delayed

## 1.2 Document Goals

- Define a stability-first overall architecture for the enterprise-grade Agent platform
- Establish design principles premised on "untrusted by default, will fail by default"
- Elevate stability, risk, security, and exception handling to platform primary architecture
- Clarify the system structure of five planes + cross-cutting fabric, **and define formal inter-plane interface protocols**
- Refactor Runtime into a recoverable, degradable, auditable, controlled execution system
- **Provide a practical, progressive evolution path** rather than an ideal end-state
- Provide a baseline for subsequent detailed design, Schema, ADR, and phased implementation

## 1.3 Non-Goals

- Prompt details of a single business Agent
- Interface implementation notes for a single plugin or adapter
- UI interaction visual mockups
- Special access implementation for a specific model provider
- Complete domain model for a single business domain
- Infrastructure physical topology and procurement plans

## 1.4 Implementation Boundary Statement

This document describes the target-state architecture, but the v4.2 implementation boundary is governed by §33 Ring 1 / MVP Slice. Sections not in MVP Slice are only for compatibility design and evolution reservation, and must not block the delivery of HarnessRuntime, PlanGraphBundle, NodeRun, BudgetReservation, SideEffectManager, HITL basic, Trace Replay, and the Evidence closed loop.

Document split goal: The current `00-platform-architecture.md` serves as the main index and human architecture authority; subsequent authoritative content should converge into six documents: `00-core-architecture.md`, `01-runtime-executable-contract.md`, `02-state-event-evidence.md`, `03-ai-ops-governance.md`, `04-domain-framework.md`, `05-enterprise-operations.md`. Before the split is complete, this file preserves stable section numbers and migration indexes.

Capabilities in the body are marked with one of four maturity levels:

| Label | Meaning |
| --- | --- |
| MVP | Must be delivered in Ring 1; missing it means the platform cannot go to production |
| Hardening | Completed in Ring 2; for production reliability and enterprise governance |
| Enterprise | Completed in Ring 3; for scaling, multi-domain, and multi-Region |
| Future | Target-state reservation; not a current implementation commitment |

## 1.5 v4.3 Contract Freeze Scope

v4.3 freezes no new platform capabilities; it only freezes the minimal executable contract that the implementation team must collectively comply with. The following contracts must have Zod/JSON Schema, state machine, event catalog, Repository API, contract test, replay behavior, and failure behavior; missing any one of them is not allowed to enter implementation freeze.

| Frozen Contract | Authoritative Section |
| --- | --- |
| TaskDraft / ConfirmedTaskSpec / RequestEnvelope | §5 / §6 / §39 |
| HarnessRun | §5 / §25 / §45 |
| PlanGraphBundle / PlanGraph / PlanNode / PlanEdge | §5 / §13 / §45 |
| GraphPatch / GraphPatchOperation | §13 / §58 |
| NodeRun / NodeAttempt / AttemptLineage | §14 / §25 |
| NodeAttemptReceipt | §5 / §14 / §45 |
| SideEffectRecord / ReconciliationRecord / CompensationRecord | §14 / §25 / §57 |
| BudgetLedger / BudgetReservation / BudgetSettlement | §18 / §25 / §26 |
| RunVersionLock / ArtifactVersionLockSet | §20 / §25 / §29 |
| DecisionInputBundle / HarnessDecision | §45 / §58 |
| HumanResponsibilityRecord | §21 / §45 / §47 |
| EventEnvelope / PlatformFactEvent / OapeflirViewEvent | §28 / §58 |

---

# 2. Platform Root Assumptions and Design Goals

## 2.1 Platform Root Assumptions

The platform defaults to the following events all happening:

- Agents will make mistakes
- Tools will fail
- External systems will time out
- Workers will crash
- Models will produce incorrect output
- Configuration will be misconfigured
- Approvals will be delayed
- Events will duplicate
- Projections will lag
- Releases will be rolled back

Therefore, the platform must be designed around one sentence:

> **Untrusted by default, will fail by default, must be controllable, recoverable, and auditable by default.**

## 2.2 Platform Design Constitution

### Untrusted by Default

- Model output is untrusted
- Plugins are untrusted
- External dependencies are untrusted
- Input is untrusted
- Knowledge may be stale
- Learning results may carry noise

### Will Fail by Default

- Remote calls will time out
- Workers will lose heartbeats
- Event fanout will fail
- Projections will be delayed
- Rollouts will fail
- Repair / replay may also fail

### Default to Convergence

Actions not explicitly allowed default to the conservative path: deny / degrade / require approval / supervised / no-write / no-external-call / manual-only.

### Recoverability Before Automation

Automation that lacks replay / repair / rebuild / rollback capability should not enter critical flows.

### State and Evidence Are Equally Important

The platform must not only "get it done" but also record: who triggered it, why it executed, what context was used, which systems were called, what side effects were produced, and how to recover from failure.

## 2.3 Eight Hard Goals

1. **Stable operation**: Even if some components fail, the platform must not lose control overall
2. **Risk isolation**: High-risk actions must be identified, tiered, isolated, approved, and rollbackable
3. **Safe-by-default convergence**: Capabilities not explicitly allowed are prohibited by default; no fail-open
4. **Recoverable exceptions**: After important link interruption, either recovery continues, or safe termination, or handoff to humans
5. **Traceable data**: Every key action can be traced back to its trigger, basis, context, result, and side effects
6. **Controllable release**: Changes to workflow, agent, pack, plugin, policy must be grayed-out and rollbackable
7. **Multi-tenant security**: Different tenants, teams, projects, business domains must not mix data, permissions, or execution environments
8. **Business extensible but not core-intrusive**: New business onboarding must not break the platform's stability and security model

## 2.4 ArchitectureInvariantRegistry

The design constitution must land on testable invariants. Each invariant must declare at least an enforcement point, failure behavior, test reference, and phase; principles missing these fields cannot be used as implementation acceptance criteria.

```yaml
id: INV-STATE-001
statement: Every HarnessRun/NodeRun truth mutation must append an event in the same transaction
enforcement_point: StateStore.UnitOfWork
test_ref: tests/invariants/truth-event-atomicity.test.ts
failure_behavior: reject mutation and emit incident
phase: MVP
```

v4.2 non-degradable core invariants:

| Invariant | Enforcement point | Phase |
| --- | --- | --- |
| HarnessRuntime is the only execution entry; P4 does not accept bypass execution | P1/P2 admission + P4 dispatch guard | MVP |
| The P3 → P4 canonical contract can only be `PlanGraphBundle` | PlanGraph validator + dispatch schema | MVP |
| Budget reserve must precede LLM / Tool / SideEffect / Evaluation | BudgetLedger guard | MVP |
| SideEffect ambiguous must not be treated as success | SideEffectManager + ReconciliationWorker | MVP |
| Replay must not produce real external side effects | ReplaySandboxPolicy | MVP |
| Panic must not be TTL-auto-released; recovery requires manual confirmation | PanicController | MVP |
| `oapeflir.*` events must not serve as truth source | EventRegistry consumer contract tests | MVP |
| TrustScore must not lower inherent risk | RiskEngine policy test | Hardening |

### NonOverridableInvariantRegistry

Once RuntimeInvariant, SecurityInvariant, and AuditInvariant enter `NonOverridableInvariantRegistry`, they must not be turned off by any administrator, domain owner, Pack, or emergency override. `super_admin` can only submit policy proposals or tighten policies; temporary exceptions must go through break-glass, dual control, forensic logging, expiry, and post-review, and must not bypass RuntimeStateMachine, SideEffectManager, BudgetAllocator, Event/Audit append.

### Invariant Coverage Matrix

Each design constitution principle and hard goal must map to executable checks. Entries in `ArchitectureInvariantRegistry` missing `test_ref`, `failure_behavior`, `owner`, or `phase` can only be treated as design intent, not as acceptance items or release gates.

| Principle / Hard Goal | Invariant ID | Enforcement point | Test ref | Failure behavior | Owner | Phase |
| --- | --- | --- | --- | --- | --- | --- |
| State and evidence are equally important | INV-STATE-001 | StateStore.UnitOfWork | `tests/invariants/truth-event-atomicity.test.ts` | reject mutation + incident | Runtime | MVP |
| HarnessRuntime is the only execution entry | INV-RUN-001 | AdmissionController + DispatchGuard | `tests/invariants/harness-run-authority.test.ts` | reject bypass dispatch | Runtime | MVP |
| PlanGraphBundle is the only P3→P4 execution contract | INV-GRAPH-001 | PlanGraph validator + dispatch schema | `tests/invariants/plan-graph-only-dispatch.test.ts` | reject dispatch | Orchestration | MVP |
| Budget reserve precedes any execution cost | INV-BUDGET-001 | BudgetLedger guard | `tests/invariants/budget-reserve-before-execute.test.ts` | fail closed + release partial reservation | Finance Platform | MVP |
| Replay does not produce real side effects | INV-REPLAY-001 | ReplaySandboxPolicy | `tests/invariants/no-side-effect-in-replay.test.ts` | abort replay + incident | Evidence | MVP |
| SideEffect ambiguous is not equivalent to success | INV-SIDEEFFECT-001 | SideEffectManager | `tests/invariants/side-effect-ambiguous-reconciles.test.ts` | enter reconciliation | Execution | MVP |
| Default safe convergence | INV-POLICY-001 | PolicyEngine + CapabilityGate | `tests/invariants/deny-by-default.test.ts` | deny / require approval | Security | MVP |
| High-risk domain responsibility boundary | INV-DOMAIN-001 | DomainRiskSpec validator | `tests/invariants/high-risk-domain-boundary.test.ts` | block domain release | Domain Platform | Hardening |
| TrustScore does not lower inherent risk | INV-RISK-001 | RiskEngine | `tests/invariants/trust-score-no-risk-lowering.test.ts` | ignore trust downgrade + audit | Risk | Hardening |

## 2.5 Architecture Design Review Resolution Matrix

Design review items in `docs_zh/reviews/architecture-design-review.md` must be absorbed via "authoritative contract → enforcement point → test gate". This document does not take scattered recommendations as implementation basis; the table below is the entry index for subsequent ADR, contract, code, and tests.

| Review Topic | Architecture Decision | Body Position | Required Gate |
| --- | --- | --- | --- |
| OAPEFLIR vs Harness state authority | HarnessRuntime is the only runtime state authority; OAPEFLIR is only a semantic projection | §13, §45.22, §58.6 | State machine invariant + projection consumer test |
| MVP and long-term roadmap | First deliver the P1 + P3 + P4 + P5 minimum closed loop; Enterprise / Marketplace / Multi-Region are deferred | §1.4, §33, three-ring priority | MVP closure checklist |
| SLA and failover | Default 99.95; 99.99 can only be bound to auto-failover, quorum, and drill evidence | §31, §52, §54 | DR drill pass/fail + SLA eligibility test |
| Call depth contradiction | `call_depth` global hard cap = 8, not multiplied with goal decomposition and delegation local caps | §19.2, §40 | delegation depth test |
| Phase 1 storage scope | SQLite only carries MVP table subset; complete logical model is enabled with Phase | §26.2, §26.3, §33 | migration subset test |
| Cross-Region truth writes | truth / budget / side effect only allow single-leader writes; CRDT only for non-critical statistics | §25.11, §52.3 | fencing epoch + failover reconciliation test |
| Low-latency business vs LLM calls | Realtime / quant hot paths use offline planning + deterministic execution; LLM is not in microsecond hot path | §15, §37, §71 | domain latency mode validation |
| Replay determinism | Trace Replay only replays recorded facts; Re-execution Replay must declare non-determinism | §45.24, §58.4, §65 | no-side-effect replay test |
| Budget race | All cost resources first atomic reserve, then execute, then settle/release | §18.3, §25.9, §36.2 | concurrent hard-cap test |
| TrustScore permission boundary | TrustScore only reduces approval friction, not lowers inherent risk or expands permissions | §42.5, §10 | risk policy test |

### Systemic Failure Mode Guardrails

The following systemic topics are non-negligible architectural gaps and must be explicitly modeled in implementation:

- **Multi-step governance operations must be Saga-ized**: OrgTree cascading, Chinese Wall lifting, governance delegation revocation, SCIM deprovisioning, approval reroute all must include prepare / commit / compensate / audit four-segment semantics, prohibiting "partially completed but uncompensated" governance writes.
- **Positive feedback loops must be breakable**: Memory self-reinforcement, Guardrail replan oscillation, Priority auto-upgrade inflation, Trust-maintenance low-value tasks must have `loop_counter`, `cooldown`, `promotion_budget`, `human_breaker`, or statistical anomaly detection.
- **Bottlenecks must have backpressure models**: Evaluator, BudgetAllocator, ApprovalQueue, DispatchQueue must all declare `max_queue_depth`, admission rejection semantics, degradation modes, and DLQ/incident paths.
- **Resource release must be terminal-state driven**: Run terminal state, NodeRun terminal state, Plugin crash, TaskDraft expiry, Secret lease, ContextSnapshot retention all must be closed by sweeper or terminal cleanup protocol.

---

# 3. Platform Definition and Non-Goals

## 3.1 Platform Definition

> A controlled automation platform for enterprise environments, with stability-first as its core principle.
> It treats Agents as high-risk automation units, and strictly controls, isolates, recovers, audits, and governs them through five architectural planes and one cross-cutting control fabric.

## 3.2 What It Is Not

- **Not a single chatbot** — Chat is only one of the entry points
- **Not a pure Workflow Engine** — Workflow does not solve governance, recovery, approval, auditing
- **Not a pure Tool Calling shell** — Tools are only an execution means
- **Not a thin "Prompt + model + a few tools" application** — Lacks isolation, governance, recovery
- **Not a "more automation is better" system** — The platform pursues **controlled automation**
- **Not a medical diagnosis principal, legal opinion principal, financial final credit principal, or securities trading hot-path execution engine** — The platform can only assist in generating recommendations, evidence, plans, and candidate actions; final responsibility in high-risk domains is borne by legally qualified or organizationally authorized persons/systems
- **Not a replacement for ultra-low-latency deterministic systems** — Trading matching, real-time bidding, emergency response, live streaming cut-off and other hot paths must not depend on general LLM/Harness loops; only deterministic policies, compiled artifacts, pre-approved rules, or offline planning results can be used

All high/critical domains must explicitly declare `advisory_only`, `human_accountable`, `deterministic_hot_path_only` or equivalent responsibility boundary in DomainRiskSpec; when not declared, the platform processes in the more conservative mode and does not allow `full_auto` by default.

---

# Part I — Infrastructure Layer (§4-§14, §24-§32)

---

# 4. Overall Architecture: Five Planes + One Cross-Cutting Control Fabric

## 4.1 Architecture Overview Diagram

```text
┌──────────────────────────────────────────────────────────────┐
│                    P1 Interface Plane                         │
│     API Gateway · Webhook · Scheduler · Console · Ingress    │
├──────────────────────────────────────────────────────────────┤
│                    P2 Control Plane                           │
│     Policy · Approval · Rollout · Incident · Config          │
├──────────────────────────────────────────────────────────────┤
│                P3 Orchestration Plane                         │
│     HarnessRuntime · Planning · Evaluation · Routing          │
├──────────────────────────────────────────────────────────────┤
│                 P4 Execution Plane                            │
│     Dispatcher · Workers · Tools · Plugins · Recovery        │
├──────────────────────────────────────────────────────────────┤
│             P5 State & Evidence Plane                         │
│     Truth · Events · Projections · Artifacts · Audit         │
├──────────────────────────────────────────────────────────────┤
│         X1 Reliability & Security Fabric (cross-cutting)     │
│     AuthN/Z · Sandbox · Circuit Breaker · DLQ · Backpressure │
└──────────────────────────────────────────────────────────────┘
```

## 4.2 P1 Interface Plane

The external access layer.

**Includes**: API Gateway / Webhook / Scheduler trigger / Admin Console backend / External event ingress

**Responsibilities**: Input validation · identity authentication · rate limiting · request deduplication · basic routing · attachment referencing · idempotency key handling

**Not responsible for**: Executing business logic · modifying core state · bypassing the control plane to directly invoke executors

P1 must expose standardized API contracts (see §6). Natural language, Webhook, UI forms, or external events must not directly generate executable RequestEnvelope; they must first enter the `RawInput → TaskDraft → ClarificationSession → ConfirmedTaskSpec → RequestEnvelope` intake pipeline. Only `ConfirmedTaskSpec` can generate RequestEnvelope, and it must include trace_id, idempotency_key, principal, tenant_id.

## 4.3 P2 Control Plane

The control and governance layer, which is the platform's governance shell.

**Includes**: policy engine / approval engine / rollout control / replay & repair control / incident control / tenant admin / audit export / config center / exception management

**Responsibilities**: Definition and version governance · approval and autonomy boundary control · risk and budget guard · release, graying-out, rollback · incident escalation and handling · repair / replay / rebuild operations control

P2 sends directives to P3/P4 via `OperationalDirective` or `DecisionDirective`, not by directly manipulating underlying state. The old name `ControlDirective` is only kept as a deprecated alias and must not appear in new schema, API, or events.

## 4.4 P3 Orchestration Plane

The orchestration and decision layer.

**Includes**: P3a HarnessRuntime coordination entry / P3b Planning Services / P3c Evaluation Services / P3d Routing & Escalation Services / OAPEFLIR trace projection adapter

**Responsibilities**: Decide what to do · decide who executes next · decide when to pause · decide when to hand over to humans · decide when to replan, degrade, or terminate

P3 outputs standardized `PlanGraphBundle` (see §13). `ExecutionPlan` is a deprecated alias, only allowed in historical compatibility adapters, glossary, and migration notes; new implementations must not consume linear `steps`.

## 4.5 P4 Execution Plane

The unified execution layer.

**Includes**: scheduler / dispatcher / execution engine / worker pool / tool executor / plugin executor / adapter executor / browser executor / human wait executor / recovery workers

**Responsibilities**: Actually execute actions · acquire and maintain leases · write back execution results · propose and commit side effects · trigger recovery actions on failure

P4 must report execution results to P3/P5 via `NodeAttemptReceipt`; Receipt uses `attemptId` + `nodeRunId` as primary keys, including harnessRunId / planGraphId / graphVersion / nodeRunId / attemptId / status / duration / side_effects / evidence_refs / error_detail. The old `ExecutionReceipt` and `stepId` are only allowed in legacy adapter or projection, and must not serve as P4 execution receipt fields.

## 4.6 P5 State & Evidence Plane

The state and evidence plane.

**Includes**: truth tables / event log / artifact store / memory / knowledge / audit / projections / checkpoints / evidence bundles / incident records / DLQ records

**Responsibilities**: Save current control truth · preserve historical change trajectories · support recovery and replay · preserve audit evidence · support console queries

P5 exposes itself through a unified Repository interface; upper layers do not directly manipulate storage implementations. The Repository interface supports multi-backend switching (see §26).

P5 must be internally divided into modules by lifecycle and consistency boundary: P5a truth-store, P5b event-store, P5c projection-store, P5d artifact-store, P5e audit-store. A shared Repository facade can be exposed uniformly, but transaction semantics, retention, GC, legal hold, and rebuild policies must not be mixed.

## 4.7 X1 Reliability & Security Fabric

The life-support system spanning all planes.

**Includes**: authn/authz / sandbox / secrets / egress control / quotas / circuit breakers / timeouts / retries / rate limits / health checks / anomaly detection / backpressure / DLQ / incident hooks

**Positioning**: This is not an auxiliary capability, but the platform's basic life support system. X1 capabilities must declare their landing form: library middleware, sidecar / interceptor, or central service. Default to library / interceptor; only capabilities requiring centralized coordination such as cross-process shared state, global quotas, Panic, and secret lease should be implemented as central services.

`X1DeploymentMatrix`:

| Capability | Landing Form | State Source | Failure Policy |
| --- | --- | --- | --- |
| AuthZ / Policy check | library interceptor + P2 policy cache | PolicyOutcome / EffectivePolicySnapshot | fail closed |
| Budget reserve | central service + library client | BudgetLedger / BudgetAllocator | fail closed / queue |
| Panic / Kill switch | central service + plane local handler | PlatformPanicDirective | fail closed / isolate |
| RateLimit / Backpressure | library + gateway interceptor | Quota / ResourceVector | reject / degrade |
| CircuitBreaker | library + telemetry feed | CircuitBreakerState | degrade / no-external-call |
| SecretLease | central service + short lease client | KMS/Vault lease registry | revoke / awaiting_hitl |
| EgressControl | sidecar / network policy + library guard | EgressPolicy / destination registry | deny + incident |

---

# 5. Inter-Plane Communication Contracts

> Define interface protocols between the five planes, formalizing inter-plane communication.

## 5.1 Design Principles

- Planes can only communicate via **formal contract objects**; they cannot directly call each other's internal implementations
- Each contract object is **serializable, auditable, and replayable**
- Synchronous calls use typed interfaces; asynchronous notifications use domain events

## 5.2 Inter-Plane Contract Matrix

| Caller → Callee | Contract Object | Communication Mode | Description |
| --------------- | ---------------- | --------- | ---------------------------------------------------------- |
| P1 → P2         | `RequestEnvelope`  | Synchronous      | All requests first go through P2 for policy/admission checks                            |
| P2 → P3         | `OperationalDirective` | Synchronous/Event | Mode switching, pause, resume, quota adjustment, rollout control                |
| HITL/Approval → P3/P4 | `DecisionDirective` | Synchronous/Event | approve / deny / override / expire_approval and other business decisions      |
| P3 → P4         | `PlanGraphDispatch` (`PlanGraphBundle`) | Synchronous | Canonical graph plan output from orchestration to execution                       |
| P4 → P3         | `NodeAttemptReceipt` | Synchronous      | NodeAttempt execution result reported to orchestration                           |
| P4 → P5         | `TransitionCommand` (`RuntimeStateMachine.transition`) | Synchronous  | Advance truth state, must append platform fact event in same transaction          |
| P4/P5 → EventLog | `EventAppendCommand` | Synchronous/Transactional | Append fact events or projection events                                     |
| P4/P5 → Audit   | `AuditAppendCommand` | Synchronous/Transactional | Append audit records                                               |
| P3 → P5         | `EvidenceRecord`   | Asynchronous      | Decision evidence write                                               |
| P2 → P4         | `OperationalDirective(type=kill)` | Synchronous | Only for emergency brake directly to execution layer (§60)                              |
| P5 → P2         | `ProjectionUpdate` | Event      | Projection change notification to control plane                                  |
| Any → X1       | Middleware injection    | Cross-cutting      | Not via explicit calls, but via decorators/interceptors                          |

### ContractEnvelope

All inter-plane commands, events, and audit appends use a unified envelope; business payloads are only placed in `body`:

| Field | Requirement |
| --- | --- |
| schemaVersion / commandId | Required, support versioning and idempotency |
| tenantId / runId / traceId | Required, support isolation and tracing |
| correlationId / causationId | Required, support causal chain and replay |
| issuedBy / issuedAt / expiresAt | Required, expired commands must be rejected |
| idempotencyKey | Required for write operations |
| signature | Required across processes or trust boundaries |

## 5.3 Core Contract Object Definitions

### Intake Pipeline and RequestEnvelope

The standard request envelope from P1 → P2 only accepts confirmed tasks. Inbound requests must advance in the following state:

```text
RawInput → TaskDraft → ClarificationSession → ConfirmedTaskSpec → RequestEnvelope
```

`RawInput` can come from natural language, Webhook, UI, CLI, or scheduled triggers; `TaskDraft` is only used for clarification, risk preview, and draft saving; `ClarificationSession` collects missing intent and high-risk confirmations; `ConfirmedTaskSpec` is the only pre-object that can be converted to RequestEnvelope. high/critical tasks must have explicit `UserConfirmationReceipt`; low risk can use safe defaults by `ambiguity_policy`; medium requires confirmation of key parameters.

RequestEnvelope encapsulates metadata and task specification for confirmed tasks.

| Field         | Type          | Description                                     |
| ------------ | ------------- | ---------------------------------------- |
| requestId    | string (UUID) | Unique request identifier                             |
| tenantId     | string        | Tenant ID, used for multi-tenant isolation                  |
| confirmedTaskSpecId | string | Associated ConfirmedTaskSpec, does not directly accept RawInput |
| taskSpec     | ConfirmedTaskSpec | Confirmed task specification (goal, input, constraints)       |
| priority     | enum          | Priority (critical / high / normal / low) |
| traceContext | TraceContext  | Distributed tracing context, spans the entire link             |
| principal    | Principal     | Initiator identity and permission declaration                     |
| timestamp    | ISO-8601      | Request initiation timestamp                           |

### OperationalDirective / DecisionDirective

Control directives from P2 → P3/P4, used for policy enforcement, approval decisions, and emergency braking.

From v4.2, `ControlDirective` is only a deprecated alias. New contracts must explicitly use the following two object types, to avoid mixing runtime control with business decisions in the same enumeration:

| Category | Typical Type | Scope | Constraint |
| --- | --- | --- | --- |
| OperationalDirective | pause / resume / abort / rollback / kill / mode_switch / quota_adjust | HarnessRun, NodeRun, Plane, Tenant, Region | Only changes runtime control state, does not express business approve / deny |
| DecisionDirective | approve / deny / override / request_changes / expire_approval | decisionId, sideEffectId, hitlTaskId, budgetReservationId | Can only be generated by HITL / Policy / Approval processes, must declare scope and expiresAt |

The direct P2 → P4 control is only allowed for `OperationalDirective(type=kill)`, and only used for §60 PlatformPanicDirective or equivalent P0 security events; regular approvals must not bypass HarnessRuntime.

| Field        | Type          | Description                                                                  |
| ----------- | ------------- | --------------------------------------------------------------------- |
| directiveId | string (UUID) | Unique directive identifier                                                          |
| category    | enum          | operational / decision                                                |
| type        | enum          | Directive type within the category                                                        |
| targetRunId | string        | Target run instance ID                                                       |
| reason      | string        | Directive reason (for audit)                                                    |
| issuedBy    | Principal     | Issuer identity                                                            |
| traceId     | string        | Associated trace ID                                                           |

### PlanGraphBundle

Standard execution plan from P3 → P4. `PlanGraphBundle` is the canonical contract; `ExecutionPlan` is no longer a new implementation contract name, only as a deprecated alias mapped to `PlanGraphBundle`. All tasks, including simple ones, are issued to P4 in PlanGraph form; simple tasks degenerate into single-node graphs. The Graph Scheduler schedules NodeRun by deterministic policy.

| Field             | Type             | Description                                 |
| ---------------- | ---------------- | ------------------------------------ |
| planId           | string (UUID)    | Unique plan identifier                         |
| planGraphId      | string (UUID)    | Unique graph plan identifier                       |
| graphVersion     | number           | Graph version, incremented after GraphPatch            |
| graph            | PlanGraph        | Executable graph, includes node / edge / entry / terminal |
| schedulerPolicy  | ReadyNodeSchedulingPolicy | Deterministic scheduling policy for ready nodes |
| toolRequirements | ToolRef[]        | Required tool declarations                         |
| budget           | BudgetEnvelope   | Budget constraints (token / time / cost)      |
| riskProfile      | RiskProfile      | Risk assessment summary                         |
| validationReport | GraphValidationReport | Graph validation result                      |
| riskPropagationReport | GraphRiskPropagationReport | Risk propagation result              |
| worstPathAnalysis | GraphWorstPathAnalysis | Worst path time, cost, risk analysis |
| rollbackStrategy | RollbackStrategy | Rollback strategy (step-by-step / full / none) |
| evidenceRefs     | string[]         | Plan generation, validation, evaluation evidence             |

**PlanGraph Hard Rules**:

1. Simple tasks can degenerate into single-node PlanGraph.
2. Complex tasks must not use linear `steps` for direct execution.
3. PlanGraph must go through Normalize → Validate → Risk Propagation → Worst-Path Analysis before entering ready.
4. P4 must not execute PlanGraph with `validationReport.valid=false`.

### NodeAttemptReceipt

Execution receipt from P4 → P3/P5, recording the execution result and telemetry data of a single NodeAttempt. Receipt no longer uses step as the authoritative object; HarnessStep is only a semantic/presentation layer, NodeRun / NodeAttempt is the execution layer fact. The old `ExecutionReceipt` is only derived by legacy adapter.

| Field        | Type          | Description                                   |
| ----------- | ------------- | -------------------------------------- |
| receiptId   | string (UUID) | Unique receipt identifier                           |
| harnessRunId | string       | Associated HarnessRun                        |
| planGraphId | string        | Associated PlanGraphBundle / PlanGraph       |
| graphVersion | number       | PlanGraph version corresponding to the receipt              |
| nodeRunId   | string        | Associated NodeRun, canonical key for P4 receipt   |
| attemptId   | string        | Associated NodeAttempt / AttemptLineage       |
| status      | enum          | Execution status (success / failed / skipped) |
| artifacts   | Artifact[]    | Output list (files, variables, etc.)             |
| telemetry   | Telemetry     | Telemetry data (latency, token usage, retry count) |
| sideEffects | SideEffect[]  | Side effect declarations (file writes, API calls, etc.)     |
| error       | ErrorDetail?  | Error details (only on failure)                   |
| duration    | number (ms)   | Execution duration                               |

### RuntimeStateMachine.transition(command)

`RuntimeStateMachine.transition(command)` is the only formal entry for advancing HarnessRun / NodeRun / SideEffect / Budget states. P2/P3/P4/Recovery/HITL must not directly update truth tables; they can only submit TransitionCommand, and RuntimeStateMachine uniformly validates state machine, CAS, active lease, fencing token, RunVersionLock, policy guard, budget precondition, and side-effect safety.

| Field            | Type          | Description                                          |
| --------------- | ------------- | --------------------------------------------- |
| commandId       | string (UUID) | Unique command identifier                                  |
| entityType      | string        | harness_run / node_run / side_effect / budget_reservation |
| entityId        | string        | Target entity ID                                   |
| transition      | enum          | State transition action                                  |
| expectedStatus  | enum          | Expected state                                      |
| nextStatus      | enum          | Target state                                      |
| leaseId         | string?       | Required for execution-state transitions                                |
| fencingToken    | string?       | Required for execution-state transitions                                |
| event           | EventEnvelope | Fact event appended in the same transaction as truth mutation        |
| payload         | JSON          | Write data                                      |
| expectedVersion | number        | Expected version number (CAS optimistic lock)                      |
| principal       | Principal     | Operator identity                                |
| traceId         | string        | Associated trace ID                                |

The old `StateMutationCommand` is only allowed as an internal compatibility wrapper for `RuntimeStateMachine.transition(command)`, and must not serve as a public API for new modules to directly write truth.

### EventAppendCommand / AuditAppendCommand / ArtifactWriteCommand

| Command | Transaction Semantics | Description |
| --- | --- | --- |
| EventAppendCommand | Same transaction as truth mutation or outbox same transaction | Both fact events and OAPEFLIR projection events must be registered in Event Registry |
| AuditAppendCommand | Append-only, allowed to commit in the same transaction as business | Record who / what / why / policy outcome |
| ArtifactWriteCommand | Content-addressed, write artifact first then write ref | Large objects must not be inlined into event or truth payload |

## 5.4 Contract Compliance Rules

1. **Cannot be bypassed**: P1 cannot skip P2 to directly call P4
2. **P5 passive principle**: P5 cannot issue directives to P3/P4 (can only be read/written); P5 → P2 is limited to ProjectionUpdate event notification, cannot send OperationalDirective or trigger state changes
3. **P2 → P4 only via emergency channel**: P2 can bypass P3 in emergency braking (§60) scenarios to send `OperationalDirective(type=kill)` directly to P4; this path is limited to `PlatformPanicDirective` scenarios, regular directives must still go through P3 orchestration
4. **Must be signed**: Each contract object must contain principal and trace_id
5. **Must be idempotent**: All StateMutationCommand must use expected_version for CAS
6. **Must be replayable**: All contract objects must be serializable to JSON

## 5.5 Canonical Runtime Object Map

| Object | Authoritative State | Sole Responsibility | Non-Authoritative/Legacy Usage |
| --- | --- | --- | --- |
| TaskDraft | canonical pre-admission | NL / UI draft, clarification, risk preview | Must not enter P4 |
| RequestEnvelope | canonical ingress | Standard envelope for confirmed requests entering P1/P2 | Does not carry execution state |
| HarnessRun | canonical run truth | The only authoritative Run for a complete run | workflow_run is only query projection |
| HarnessStep | semantic projection | Semantic steps for users / explanation / product | P4 does not consume HarnessStep for execution |
| PlanBundle | product/debug wrapper | Product wrapper for goal, taskGraph, successCriteria | Not as P3→P4 execution contract |
| PlanGraphBundle | canonical execution contract | The only P3→P4 execution plan | ExecutionPlan is deprecated alias |
| NodeRun | canonical execution truth | Minimal executable unit that can be leased, retried, audited | stepId only legacy projection |
| NodeAttempt | canonical attempt lineage | Append-only attempt for retry/redrive | Does not overwrite NodeRun history |
| SideEffectRecord | canonical side effect truth | External side effect lifecycle and reconciliation fact | Tool success does not equal side effect success |
| BudgetReservation | canonical budget gate | Pre-budget hard gate before LLM/Tool/SideEffect/Eval | Invoice reconciliation is not admission basis |
| NodeAttemptReceipt | canonical P4 result | NodeAttempt result receipt | Old ExecutionReceipt is only legacy adapter |
| EventEnvelope | canonical event fact | State change, audit, projection rebuild input | `oapeflir.view.*` / `oapeflir.rationale.*` are only projection events |

---

# 6. API Contracts and Versioned Architecture

> Treat API as a first-class architectural concern.

## 6.1 API Layering

| API Layer       | Audience             | Protocol                                       | Authentication Method             |
| ------------ | ---------------- | ------------------------------------------ | -------------------- |
| Public API   | Business systems, CI/CD  | REST + WebSocket                           | API Key + JWT        |
| Admin API    | Ops personnel, console | REST                                       | JWT + RBAC           |
| Internal API | Inter-plane calls       | Typed interface (in-process) or gRPC (cross-process) | mTLS / service token |
| Plugin API   | Plugin / adapter   | IPC / sandbox boundary                     | capability token     |

## 6.2 Public API Design Specifications

- Resource naming uses kebab-case plural form; canonical execution entry uses `/api/v1/harness-runs`
- All write operations must carry `Idempotency-Key` header
- All responses include `X-Request-Id` and `X-Trace-Id`
- Error responses use a unified structure:

```json
{
  "error_code": "PLATFORM.P4.TOOL.TIMEOUT",
  "message": "human readable summary",
  "retryable": true,
  "recoverability": "retry|replan|compensate|manual_review|abort",
  "side_effect_state": "none|proposed|committing|ambiguous|confirmed|compensation_required",
  "severity": "warning|error|critical",
  "user_action": "retry later or contact operator",
  "operator_action": "inspect nodeRunId and reconciliation status",
  "trace_id": "trace-..."
}
```

## 6.3 API Resource Overview

| Resource                               | Method                | Description                   |
| ---------------------------------- | ------------------- | ---------------------- |
| `/api/v1/harness-runs`             | POST / GET          | Canonical run creation and query |
| `/api/v1/harness-runs/{id}`        | GET                 | Query HarnessRun truth / summary |
| `/api/v1/harness-runs/{id}/abort-requests` | POST      | Request safe abort, regular cancel semantics |
| `/api/v1/harness-runs/{id}/pause-requests` | POST      | Request safe pause, not equivalent to panic kill |
| `/api/v1/tasks`                    | POST / GET          | Compatibility layer; must be converted to HarnessRun after creation |
| `/api/v1/tasks/{id}`               | GET                 | Query TaskDraft / compatibility projection |
| `/api/v1/workflow-runs`            | GET                 | Legacy query projection, read-only |
| `/api/v1/workflow-runs/{id}`       | GET                 | Legacy query projection, read-only |
| `/api/v1/harness-runs/{id}/plan-graph` | GET             | Query authoritative PlanGraphBundle |
| `/api/v1/harness-runs/{id}/node-runs` | GET              | Query NodeRun list and status |
| `/api/v1/harness-runs/{id}/side-effects` | GET           | Query side effect records and reconciliation status |
| `/api/v1/harness-runs/{id}/budget-reservations` | GET    | Query budget reservations, settlement, and release |
| `/api/v1/harness-runs/{id}/node-runs/{nodeRunId}/attempts` | GET | Query NodeAttempt and NodeAttemptReceipt |
| `/api/v1/harness-runs/{id}/forensic-snapshot` | GET      | Query forensic snapshot reference       |
| `/api/v1/replay-sessions`          | POST                | Create Trace / Re-execution Replay |
| `/api/v1/replay-sessions/{id}`     | GET                 | Query ReplaySession     |
| `/api/v1/approvals`                | GET                 | Pending approval list             |
| `/api/v1/approvals/{id}`           | POST                | Submit approval decision           |
| `/api/v1/incidents`                | GET                 | Incident list          |
| `/api/v1/knowledge`                | GET / POST          | Knowledge query/write    |
| `/api/v1/packs`                    | GET / POST          | Pack registration and query        |
| `/api/v1/packs/{id}/versions`      | GET / POST          | Pack version management          |
| `/api/v1/plugins`                  | GET / POST          | Plugin registration and query      |
| `/api/v1/prompts`                  | GET                 | Prompt version query        |
| `/api/v1/cost-reports`             | GET                 | Cost report query           |
| `/api/v1/webhooks`                 | GET / POST / DELETE | Webhook subscription management       |
| `/api/v1/admin/workers`            | GET                 | Worker status            |
| `/api/v1/admin/config`             | GET / PUT           | Configuration management               |
| `/api/v1/admin/rollouts`           | GET / POST          | Rollout management           |
| `/api/v1/admin/tenants`            | GET / POST / PUT    | Tenant management            |
| `/api/v1/admin/budgets`            | GET / PUT           | Budget configuration               |
| `/api/v1/admin/panic-directives`   | POST                | Issue PlatformPanicDirective |
| `/api/v1/admin/resume-directives`  | POST                | Issue PlatformResumeDirective |
| `/ws/v1/stream`                    | WebSocket           | Real-time event stream             |

`/api/v1/workflow-runs/{id}/steps` is only kept as legacy projection; new consoles and SDKs must prioritize reading NodeRun and PlanGraph. `DELETE /tasks/{id}` no longer expresses ambiguous cancel semantics; callers must choose abort, pause, or panic kill explicit control endpoints.

## 6.8 Canonical API vs Legacy Projection

| Category | Endpoint | Semantics |
| --- | --- | --- |
| Canonical execution | `POST /api/v1/harness-runs` | The only execution entry to create HarnessRun |
| Canonical control | `/harness-runs/{id}/abort-requests`, `/pause-requests` | Runtime control under P2/HarnessRuntime |
| Canonical read | `/harness-runs/{id}/plan-graph`, `/node-runs`, `/side-effects`, `/budget-reservations` | Read authoritative run objects or their controlled projection |
| Compatibility | `/api/v1/tasks` | Compatible with old callers; must land as TaskDraft or HarnessRun |
| Legacy projection | `/api/v1/workflow-runs*` | Read-only query projection, must not serve as truth or execution entry |

The API compatibility layer must not re-elevate `workflow_run`, `task`, or `stepId` to authoritative objects. All compatibility handlers must generate or resolve `harnessRunId`, `planGraphId`, `nodeRunId` at the entry, and mark the source of old fields with `legacyProjection=true` in the response.

## 6.4 Version Compatibility Strategy

- API versions are distinguished by URL path (`/api/v1/`, `/api/v2/`)
- Within the same major version, only **backward-compatible** changes (add fields, add endpoints)
- Breaking changes must bump the major version; the old version is maintained for at least 6 months
- Event schema uses `schema_version` field; consumers dispatch by version
- Schema diff gate must prevent deprecated terms from entering new write paths; CI must include `contract-naming-consistency.test.ts`, scanning OpenAPI, Zod schema, Event Registry, SDK types, and runtime-contracts, ensuring `ExecutionPlan`, `ControlDirective`, `StateCommand`, `stepId` only appear in the glossary, migration notes, or legacy projection adapter
- Internal TypeScript interface changes use Zod schema for runtime validation

## 6.5 Authentication Flow

**API Key + JWT dual mode**:

| Scenario         | Authentication Method                               | Description                         |
| ------------ | -------------------------------------- | ---------------------------- |
| Inter-service calls   | API Key (Header: `X-API-Key`)         | Has expiration time, scope, and last use time, issued by tenant |
| User operation     | JWT (Header: `Authorization: Bearer`) | OAuth2 / OIDC issued, short-term validity |
| Console       | JWT + CSRF token                       | Browser security protection               |
| Webhook callback | HMAC signature verification                          | `X-Signature-256` header     |

**Token lifecycle**: access_token TTL = 15min, refresh_token TTL = 24h. API keys must declare `expiresAt`, `scopes`, `lastUsedAt`, `createdBy`, and `rotationPolicy`; abnormal sources, leak signs, or scope drift trigger automatic revocation; manual rotation is only a supplementary capability.

## 6.6 Pagination and Filtering

- List APIs uniformly use cursor-based pagination: `?cursor=xxx&limit=20`
- Response includes `next_cursor`; null indicates the last page
- Filtering uses query parameters: `?status=running&tenant_id=xxx&created_after=2026-01-01`
- Sorting: `?sort=created_at:desc`
- Maximum 100 items per page

## 6.7 Webhook Delivery Guarantees

- Delivery uses at-least-once semantics (outbox pattern)
- Each delivery includes `X-Webhook-Id` (idempotency key) and `X-Signature-256` (HMAC signature)
- 2xx response from target is considered success; otherwise retry policy is applied

Webhook retry policy:

| Response/Error | Strategy |
| --- | --- |
| 429 | Comply with `Retry-After`; if missing, use 5xx strategy |
| 5xx / timeout | Exponential backoff + jitter, max interval 15min |
| 4xx permanent | Disable subscription after 10 consecutive failures, notify tenant admin |
| signature mismatch | Immediately disable and generate security incident |

---

# 7. Service Communication Architecture

> Clarify three communication modes and their applicable scenarios.

## 7.1 Three Communication Modes

### Synchronous Request/Response

Applicable to: P1→P2 admission check, P3→P4 dispatch, P4→P5 truth write

Requirements:

- Must set timeout (default 5s, max 30s)
- Must have fallback (degrade / reject / queue)
- Must be protected by circuit breaker

### Asynchronous Event Notification

Applicable to: P4→P5 event append, P5→P2 projection update, P4→X1 incident hook

Requirements:

- Use outbox pattern to guarantee at-least-once
- Consumer must use `event_inbox` for idempotent consumption (deduplicate based on event_id / dedupe_key)
- Failed events enter DLQ
- Projection, webhook, DLQ redrive, external callback consumers must not each write their own deduplication logic; must record consumerId, eventId, dedupeKey, processedAt, and failure reason through `EventInbox.consumeOnce`

### Streaming Push

Applicable to: P5→P1 real-time event stream (WebSocket), worker heartbeat

Requirements:

- Auto-reconnect on disconnection + recover from last_event_id
- Server-side backpressure (drop low-priority events when buffer is full)
- Execute delta replay when `last_event_id` is within the 24h retention window
- Return snapshot + delta recovery instruction when `last_event_id` expires
- Send `stream_gap` event when event gap is detected; client must re-synchronize
- WebSocket / SSE subscription must bind authenticated principal, tenantId, allowed domains, and projection scope; server performs tenantId / scope filtering on every event, must not only rely on client filtering. Cross-tenant event hits subscription filter must be dropped and generate security telemetry

## 7.2 Communication Topology

```text
                     Normal path
P1 ──sync──> P2 ──sync/event──> P3 ──sync──> P4
                                              │
                                              ▼
                                    P4 ──sync──> P5 (RuntimeStateMachine.transition)
                                    P4 ──event─> P5 (event append)

                     Feedback path
P5 ──event──> P2 (ProjectionUpdate notification)
P5 ──stream─> P1 (WebSocket real-time push)
P4 ──sync──> P3 (NodeAttemptReceipt report)

                     Emergency channel (only §60 PlatformPanic)
P2 ──sync──> P4 (OperationalDirective kill)

                     Cross-cutting injection
X1 ──middleware──> P1, P2, P3, P4, P5
```

## 7.3 Outbox Pattern Design

All events that need delivery guarantees use the outbox pattern:

1. Business operation and event write are completed in the **same database transaction**
2. Independent outbox poller asynchronously reads unsent events
3. Mark as sent after successful delivery
4. Move to DLQ when delivery failure exceeds the threshold
5. The poller itself uses lease to guarantee single-instance operation

Poller operating constraints:

```yaml
outbox_poller:
  lease_ttl_seconds: 10
  heartbeat_interval_seconds: 3
  standby_pollers: 1
  max_delivery_gap_p99_seconds: 10
  max_batch_size: 500
```

Standby poller can only take over after lease TTL expires and fencing epoch is updated. Projection lag ≤5s is the normal path target; after poller failover, delivery must be restored within `max_delivery_gap_p99_seconds`, otherwise trigger incident.

High-throughput deployment must use partitioned outbox: partition by tenant / aggregate shard, each shard has independent lease, fencing token, and retry cursor. Ordering is only guaranteed within the same aggregate; cross-aggregate does not promise total ordering, only uses causationId, correlationId, and occurredAt for causal association.

## 7.4 In-Process vs Cross-Process

| Phase                | Communication Method                    | Description               |
| ------------------- | --------------------------- | ------------------ |
| Phase 1 (Monolith)     | In-process typed interface calls | All planes in the same process |
| Phase 2 (Initial split) | In-process + Redis pub/sub      | Event channel async   |
| Phase 3 (Microservices) | gRPC + event bus            | Planes deployed independently     |

This guarantees smooth evolution from monolith to microservices, rather than requiring 18 services from the start.

Redis / pub-sub can only be used for cache, ephemeral queue, leader hint, or low-risk notification; must not carry truth, budget hard cap, side effect commit, approval decision, or audit evidence. Any Redis data loss must not cause HarnessRun / NodeRun / Budget / SideEffect truth loss.

---

# 8. Scalability Architecture

> Define scaling strategies from single node to cluster.

## 8.1 Scaling Dimensions

| Dimension            | Scaling Strategy                        | Trigger Condition                        |
| --------------- | ------------------------------- | ------------------------------- |
| Worker concurrency     | Add worker processes/containers           | Queue backlog > threshold                 |
| Storage capacity        | SQLite → PostgreSQL → Sharding/archiving | Data volume > threshold                   |
| Event throughput      | Partition by tenant_id          | Event rate > single poller processing capability |
| API throughput        | API Gateway horizontal scaling            | QPS > single instance limit                |
| Projection latency | Add projector instances             | Projection lag > SLO            |

## 8.2 Statelessness Principles

- P1 / P3 / P4 are designed to be stateless; all persistent state is stored in P5
- Workers use lease mechanism to avoid state binding
- Session state is persisted through checkpoint, not maintained in memory
- Any process can be killed and restored on another node

WorkerDrainProtocol is a required protocol for scaling, release, and panic propagation: after a worker enters `draining`, it must not acquire new leases; checkpointable NodeRuns write checkpoint first then release lease; NodeRuns in side effect commit window can only complete the current fenced commit or enter reconciliation, must not be hard-killed; after drain deadline, `RunTerminationCleanup` and RecoveryWorker take over. Each drain must record drain reason, deadline, active leases, forced handoff count, and cleanup result.

## 8.3 Sharding Strategy

When a single node is insufficient, shard by the following dimensions:

- **dispatch queue**: shard by tenant_id hash
- **event outbox**: partition by aggregate_type
- **projection rebuild**: parallel by projection_name
- **worker pool**: pool by capability_class (coding / operations / browser)

`PartitioningSpec` must declare:

| Field | Description |
| --- | --- |
| partition_key | Combination of tenant_id / aggregate_id / region / capability |
| hot_partition_detection | Hot spot threshold, window, minimum sample size, and owner |
| split_merge_protocol | split plan, shadow route, dual read compare, cutover, cleanup |
| rebalance_read_strategy | Rules for reading old/new/shadow projection during rebalancing |
| rebalance_write_strategy | Write leader, fencing, and idempotency processing during rebalancing |
| rollback_policy | Recovery, event compensation, and projection rebuild strategy after cutover failure |

## 8.4 Scaling Phases

| Phase      | Architecture                            | Supported Scale                   | Notes                                                                            |
| --------- | ------------------------------- | -------------------------- | ------------------------------------------------------------------------------- |
| S1 Monolith   | Single process + SQLite                 | 10 concurrent workflows, 5 workers | Corresponds to implementation Phase 1-2                                                              |
| S2 Multi-process | Main process + worker process + Redis    | 50 concurrent, 20 workers         | Corresponds to implementation Phase 3-4                                                              |
| S3a Distributed | Microservices + PostgreSQL + event bus | 200 concurrent, 50 workers       | Corresponds to Hardening pressure test baseline                                                          |
| S3b Distributed | Microservices + PostgreSQL + event bus | 500 concurrent, 100 workers      | Corresponds to Enterprise pre-pressure test                                                         |
| S4 Cluster   | Kubernetes + PG sharding + multi-AZ    | 5000+ concurrent                 | Requires multi-tenant scheduler (§53) + cross-Pod coordination mechanism + multi-Region deployment (§52), corresponds to implementation Phase 6 |

Shard rebalancing must follow `ShardRebalanceProtocol`: detect hot partition → create split plan → shadow route → dual read compare → cutover → cleanup. Stateful workers (Browser Session, long-running tool, EdgeRuntime) must declare `stateful=true`, `lease_migration_supported`, and `checkpoint_required_before_preempt`, and must not be overridden by normal stateless scheduling assumptions.

---

# 9. Stability Architecture

> Seven-layer stability model; each layer defines **automation mechanisms** and **trigger rules**.

## 9.1 Stability Layer 1: Isolation

**Isolation dimensions**: tenant · project · domain · worker pool · executor · adapter · browser session · plugin process

**Design requirements**: coding and operations pool separately · high-risk adapter has independent pool · browser executor does not mix with normal tool executor · high-risk tenant can have dedicated resource pool

When a tenant's failure rate > 30% and `min_sample_size` is met, automatically isolate that tenant to an independent worker pool, not affecting other tenants. Low-traffic tenants are not automatically isolated due to 1-2 failures; when sample is insufficient, only alert and throttle.

## 9.2 Stability Layer 2: Rate Limiting and Backpressure

**Rate limiting points**: API ingress rate limit · per-tenant concurrency · per-workflow active · per-worker max concurrency · per-adapter QPS · per-tool burst · approval queue inflow

Rate limiting must be declared by endpoint class, must not allow expensive endpoints and cheap queries to share the same bucket. At least distinguish: `read_query`, `create_run`, `control_command`, `side_effect_commit`, `webhook_ingress`, `admin_mutation`, `debug_replay`. Each type of endpoint must declare `rate_limit`, `burst`, `cost_weight`, `max_queue_depth`, `overflow_policy`, and `retry_after_policy`.

**Backpressure strategy**: queue delay → reject low priority → degrade to supervised → stop non-critical workflows → freeze rollout → restrict external calls

Backpressure strategy auto-escalates by **gradient**:

```text
Level 0 (normal)     → queue_lag < 10s
Level 1 (warning)     → queue_lag 10-30s → delay low priority
Level 2 (limit)     → queue_lag 30-60s → reject low priority + supervised mode
Level 3 (protect)     → queue_lag > 60s  → only allow critical workflow + manual_only
```

Queue backpressure must not only look at lag; Admission Controller must also check `queue_depth >= max_queue_depth`, oldest age, worker health, approval capacity, budget allocator latency, and evaluator capacity. When reaching `max_queue_depth`, must fail closed: low priority requests return 429 / `retry_after`, internal events that cannot be dropped enter bounded DLQ and generate incident. Different bottlenecks use different degradation: Evaluator bottleneck degrades to deterministic validators + HITL; Budget bottleneck rejects new cost reservations; Approval bottleneck pauses high-risk new runs; Dispatch bottleneck stops non-critical workflow admission.

## 9.3 Stability Layer 3: Timeout and Retry

**Three-layer timeout**: step timeout · attempt timeout · tool/adapter timeout

**Retry rules**:

- Only retryable failure auto-retries
- Only idempotent operations allow auto-retry
- Backoff strategy: exponential backoff with jitter, base=1s, max=60s
- After retries are exhausted, enter explicit `retry_exhausted` state, triggering escalation

## 9.4 Stability Layer 4: Circuit Breaker

**Circuit breaker targets**: third-party API · external adapter · model provider · high-failure-rate tool · plugin runtime

**State machine**: closed → open (failure_rate > 50% in 60s window) → half-open (small traffic probe after 30s) → closed

Circuit breaker state changes must emit `circuit_breaker.state_changed` event, triggering alerts and mode switching evaluation.

## 9.5 Stability Layer 5: Degradation Modes

**Formal modes**: full_auto · supervised_auto · read_only · no-write · no-external-call · no-rollout · manual_only · incident-mode

Mode switching is issued via `OperationalDirective`, supporting automatic trigger rules:

| Trigger Condition                      | Auto Switch To                     |
| ----------------------------- | ------------------------------ |
| worker pool unhealthy > 50%   | supervised_auto                |
| external adapter circuit open | no-external-call               |
| security incident detected    | incident-mode                  |
| rollout guardrail breach      | no-rollout                     |
| approval_backlog / approval_processing_capacity > threshold | manual_only (pause new workflows) |

Mode composition priority is fixed as:

```text
incident-mode > manual_only > no-write > no-external-call > read_only > supervised_auto > full_auto
```

ModeScope priority is fixed as:

```text
platform > region > tenant > domain > run > node
```

The final execution mode is determined jointly by scope priority and mode strictness: the tightening strategy of higher-priority scope takes precedence; within the same scope, the stricter mode is taken. Lower-priority scope must not relax the restrictions of higher-priority scope.

Auto switching must declare `min_sample_size`, `window`, `cooldown_window`, `stable_recovery_window`, `owner`, and `manual_override`; before recovery conditions are met, must not oscillate repeatedly.

## 9.6 Stability Layer 6: Recovery Capability

**Recovery components**: lease reclaim · execution recovery · workflow recovery · replay · repair · projection rebuild · stuck-run sweeper

Each recovery component must have independent health check, and report recovery success rate to Control Plane via `RecoveryReport`.

## 9.7 Stability Layer 7: Observability

**Minimum capabilities**: metrics · structured logs · traces · audit · event timeline · health snapshot

Define core observability indicators (see §27 Performance and SLO).

---

# 10. Risk Control Architecture

> Four-class risk model, with **risk scoring algorithm** and **automated risk control engine**.

## 10.1 Four-Class Risk Model

- **R1 Execution risk**: Wrong execution · repeated execution · concurrency conflict · stale write
- **R2 Business risk**: Wrong code change · wrong traffic switching · wrong notification · wrong release
- **R3 Security risk**: Unauthorized access · data leakage · secret exposure · unauthorized external connection
- **R4 Platform risk**: Rollout out of control · projection distortion · replay misoperation · worker pool avalanche

## 10.2 Risk Scoring Algorithm

> Define the risk scoring formula to quantify the four levels "low/medium/high/critical".

```text
risk_score = Σ(factor_weight × factor_value) / max_possible_score

Factor weights:
  impact:               weight=4
  irreversibility:      weight=4
  external_side_effect: weight=4
  data_sensitivity:     weight=3
  regulatory_exposure:  weight=3
  financial_exposure:   weight=3
  operator_scope:       weight=2
  model_uncertainty:    weight=2

Mapping:
  0.0 - 0.25  →  low
  0.25 - 0.50 →  medium
  0.50 - 0.75 →  high
  0.75 - 1.00 →  critical
```

`RiskCalibrationGuide` must provide both normalized 0 / 25 / 50 / 75 / 100 anchors and implementation-side 0 / 1 / 3 / 5 scoring tables, including positive/negative examples, approvers, evidence requirements, domain override reasons, and review owner. Cross-domain relaxation of risk anchors must go through P2 policy approval; high/critical domains calibrate quarterly.

| factor_value | Normalized Anchor | Meaning | Evidence Requirement |
| --- | --- | --- | --- |
| 0 | 0 | No substantial impact, no sensitive data, no external write | Auto record |
| 1 | 25 | Reversible low impact or read-only sensitive context | evidence_ref + policy check |
| 3 | 50/75 | Limited external write, limited financial/compliance impact, compensable | HITL or deterministic guard |
| 5 | 100 | Irreversible, high amount, regulated, cross-tenant, or security impact | high/critical gate + responsibility record |

## 10.3 Automated Risk Control Engine

v4.2 separates inherent risk, trust score, and approval policy modeling:

```text
inherent_risk = f(operation, domain, data_class, blast_radius, reversibility)
automation_mode = f(trust_score, domain_cap, policy)
approval_policy = f(inherent_risk, automation_mode, org_policy)
```

Hard constraints:

- `trust_score` must not lower `inherent_risk`; it can only reduce the confirmation frequency, queue friction, or manual review intensity of low-risk tasks
- `trust_score` must not bypass compliance approval, data classification, sandbox, egress control, budget hard cap, or irreversible side effect confirmation
- DomainRiskProfile can raise inherent risk, and can also tighten approval; relaxing platform default risk must have audit reason and P2 policy approval

TrustScore can only affect: low-risk confirmation frequency, queue priority within the same risk tier, post-execution sampling rate. Must not affect: approval required threshold, sandbox level, egress policy, budget hard cap, irreversible side effect confirmation.

```text
RiskAssessmentRequest
  → Calculate risk_score
  → Query tenant risk policy override
  → Determine risk_level
  → Match risk_action_rule
  → Output RiskDecision { level, actions[], requires_approval, evidence_level }
```

**Risk Control Action Matrix**:

| risk_level | Auto Execute | Log Level | Approval        | side effect | evidence |
| ---------- | -------- | -------- | ----------- | ----------- | -------- |
| low        | ✅       | info     | No          | Normal        | Basic     |
| medium     | ✅       | warn     | No          | Normal + validation | Enhanced     |
| high       | ❌       | error    | Required        | Restricted        | Complete     |
| critical   | ❌       | critical | break-glass | Default prohibited; only restricted accountable actions allowed | Legal-grade   |

critical defaults to deny. break-glass can only allow controlled action requests under time-limited, scope-limited, dual-control, forensic logging, and post-review conditions; must not bypass SideEffectManager, BudgetAllocator, RuntimeStateMachine, or NonOverridableInvariantRegistry; irreversible side effects still require confirmation / reconciliation / compensation paths.

## 10.4 Risk Mitigation Mechanisms

sandbox mode · read_only mode · write_limited mode · approval gate · dry_run · shadow mode · canary · rollback plan mandatory · evidence bundle mandatory

---

# 11. Security and Reliability Architecture

## 11.1 Unified Identity Model

All actions must have a principal.

**Principal types**: user · service · agent · worker · plugin · system

**Requirements**: All event / audit / decision / incident are associated with principal. All incidents can trace principal chain.

## 11.2 Unified Authorization Model

Three layers:

- **RBAC**: Role-level permissions
- **Capability**: Capability-level permissions (can_run_browser / can_use_prod_adapter / can_approve_release / can_replay_events)
- **Context-aware policy**: Combine tenant / project / workflow / environment / risk level / data class for dynamic decisions

Authorization decisions are recorded as `PolicyOutcome`, including decision / matched_rules / evaluation_duration, supporting audit and policy tuning.

## 11.3 Secret Security

- Secrets are only allowed to be referenced, not passed in plaintext
- Secret injection is short-term effective (TTL ≤ 300s)
- Secrets do not enter memory / knowledge
- Secret scan is performed before artifact output
- logs / traces / audit uniformly perform secret redaction

## 11.4 Sandbox Security

Four tiers: read_only · workspace_write · scoped_external_access · restricted_exec

Any high-risk action should not directly have full access.

**Technical Implementation Specifications**:

| Sandbox Tier           | Isolation Technology         | File System                | Network                  | Process   | Resource Limit    |
| ---------------------- | ---------------- | ----------------------- | --------------------- | ------ | ----------- |
| read_only              | Child process + seccomp | Read-only mount                | Prohibited                  | Single process | 256MB / 10s |
| workspace_write        | Child process + seccomp | tmpfs write + workspace write | Prohibited                  | Single process | 512MB / 30s |
| scoped_external_access | Container (optional)     | tmpfs write                | Egress allowlist only | Multi-process | 1GB / 60s   |
| restricted_exec        | Container             | overlay fs              | Egress allowlist      | Multi-process | 2GB / 300s  |

Each sandbox tier must declare the achievable method for Linux / macOS / Windows / Kubernetes, the degradation strategy when unavailable, and escape test cases. When equivalent isolation cannot be provided, can only degrade to stricter mode or refuse execution; must not silently use host full access.

## 11.5 Network Egress Security

All external calls go through egress control. Control dimensions: destination allowlist · adapter binding · credential binding · data class · environment · operation type. Egress deny must be recorded as a formal security event.

## 11.6 Data Classification

Basic classification: public · internal · confidential · restricted

Extended labels: pii · regulated · secret-bearing

Classification affects: whether it can enter the model · whether it can be sent out · whether it can enter knowledge · whether approval is required

DataTaintPropagation hard rule: The data_class of any output, artifact, memory candidate, tool result, or summary must not be lower than the highest data_class in its input set, unless there is explicit desensitization proof, field-level redaction report, and reviewer / policy evidence. taint_labels must be propagated with DelegationResult, ToolOutput, PromptExecutionRecord, MemoryWriteRequest, and Explanation artifact.

## 11.7 Plugin Security

Plugins are treated as untrusted extensions. Requirements: independent process · resource limits · IPC boundary · capability whitelist · output validation · crash isolation · quarantineable · hot-disableable.

Supply chain security baseline: plugin signing, SBOM required, dependency vulnerability scan, runtime minimum privilege, sandbox egress allowlist, prompt-injection-to-tool-call attack simulation. Third-party plugins without signature, without SBOM, or with high-risk dependencies unhandled must not enter production registry.

`PluginTrustStore` must declare trust root, signing key rotation, signature revocation list, security advisory channel, and quarantine policy. When signing key is leaked, SBOM high-risk unpatched, or advisory forced patch triggered, the platform must support freezing new installations, isolating active runs, generating tenant impact report, and retaining read-only export and rollback instructions.

Secret lease rules: checkpoint never stores secret value; resume must request new secret lease; secret lease renewal requires active run + policy recheck; renewal failure must recycle credentials and transition NodeRun to awaiting_hitl or failed-safe state.

Plugin crash or quarantine must trigger cleanup hook: close file handles, sockets, temporary directories, browser sessions, secret lease, and external callback subscription. After cleanup hook timeout, PluginSupervisor forcibly isolates the process, and appends plugin cleanup receipt to `RunTerminationCleanup`; crashed plugins must not be allowed to continue holding external resources until TTL naturally expires.

## 11.8 Threat Model (STRIDE)

| Threat                       | Attack Surface                        | Mitigation Measures                                                |
| -------------------------- | ----------------------------- | ------------------------------------------------------- |
| **S**poofing       | API calls, Agent identity          | JWT/API Key authentication + Principal chain tracing                     |
| **T**ampering      | event log, artifact, prompt   | Append-only event + CAS + content hash verification             |
| **R**epudiation    | Operations untraceable                  | Full-link audit + evidence bundle + immutable audit log         |
| **I**nformation Disclosure | Prompt leak, Secret leak, PII | Secret redaction + data classification + Prompt not exposed to terminal       |
| **D**enial of Service      | API overload, worker exhaustion         | Rate limit + backpressure + tenant quota + circuit breaker          |
| **E**levation of Privilege | Plugin overreach, Agent privilege escalation       | Sandbox tier + capability whitelist + context-aware policy |

**Additional Threats**:

| Threat                      | Attack Surface                     | Mitigation Measures                                        |
| ------------------------- | -------------------------- | ----------------------------------------------- |
| Prompt Injection          | User input injects malicious instructions       | Input sanitization + output validation + Sandbox restriction  |
| Model Manipulation        | Malicious fine-tune / jailbreak | Quality gate (§17) + output safety check                   |
| Data Exfiltration via LLM | Model memorizes sensitive data           | data_classification routing (§15.3) + PII does not enter model |

## 11.9 Encryption Strategy

Transport encryption, storage encryption, and Key management are detailed in §23.5 Encryption Architecture. This section emphasizes the security layer constraints:

- All inter-plane communication must use TLS 1.3 (except in-process)
- PII fields stored in P5 must be application-level encrypted (not relying on database TDE)
- Secret storage integrates Vault (or equivalent KMS); application layer only holds references
- Audit logs must contain integrity signature (HMAC) to prevent post-hoc tampering

---

# 12. Exception Event Handling Architecture

> E1-E6 classification and SEV1-4 grading, with **observability data model** and **automatic detection rules**.

## 12.1 Exception Event Classification

- **E1 Business exception**: validation fail · wrong output · no result · low confidence
- **E2 Execution exception**: timeout · worker crash · lease expired · retry exhausted
- **E3 External dependency exception**: adapter failure · provider timeout · rate limit · circuit open
- **E4 Security exception**: unauthorized access · secret leak risk · egress deny · policy violation
- **E5 Data exception**: stale projection · event append failure · invariant break · replay inconsistency
- **E6 Governance exception**: rollout guardrail violated · approval overdue · exception expired · knowledge conflict

## 12.2 Exception Levels

- SEV4: Local minor, auto-recoverable
- SEV3: Single workflow / single worker impact
- SEV2: Single business domain / single tenant significantly affected
- SEV1: Platform-level impact / security incident / serious production risk

## 12.3 Exception Detection Rule Engine

> Upgrade exception detection from "hardcoded" to "rule engine".

**Built-in Rule Examples**:

| Rule                      | Condition                       | Level | Action                                         |
| ------------------------- | -------------------------- | ---- | -------------------------------------------- |
| worker_heartbeat_missing  | heartbeat_gap > 30s        | SEV3 | create_incident + lease_reclaim              |
| execution_timeout_spike   | timeout_rate > 20% in 5min | SEV3 | notify + mode_switch(supervised)             |
| projection_lag_high       | lag > 30s                  | SEV3 | notify + rebuild_trigger                     |
| security_policy_violation | any violation              | SEV2 | create_incident + quarantine                 |
| platform_wide_failure     | error_rate > 50% in 1min   | SEV1 | create_incident + mode_switch(incident-mode) |

## 12.4 Observability Data Model

> Define specific observability indicators.

### Core Metrics

| Metric Name                         | Type      | Labels               | Description            |
| ------------------------------ | --------- | ------------------ | --------------- |
| `harness.run.total`             | counter   | tenant, status     | Total HarnessRuns |
| `harness.run.duration_ms`       | histogram | tenant, run_type   | End-to-end run duration  |
| `harness.node_run.duration_ms`  | histogram | tenant, node_kind  | NodeRun execution duration |
| `harness.node_attempt.failure_rate` | gauge | tenant, error_type | Attempt failure rate  |
| `harness.dispatch.queue_depth`  | gauge     | queue_class        | Queue depth        |
| `harness.dispatch.queue_max_depth` | gauge   | queue_class        | Queue hard upper limit      |
| `harness.dispatch.latency_ms`   | histogram | queue_class        | Dispatch latency        |
| `harness.worker.active`         | gauge     | pool, capability   | Active worker count  |
| `harness.projection.lag_seconds` | gauge    | projection_name    | Projection delay |
| `harness.approval.pending_count` | gauge    | severity           | Pending approval count        |
| `harness.budget.orphaned_reservation_count` | gauge | tenant, resource_type | Number of budget reservations exceeding TTL and not settled/released |
| `harness.circuit_breaker.state` | gauge     | target             | Circuit breaker state      |
| `harness.dlq.depth`             | gauge     | category           | DLQ depth        |

Legacy `agent.*` / `workflow_run.*` / `step.*` metrics can only be derived by compatibility adapter from harness metrics, and must not serve as data source for new alerts, SLO, or capacity planning.

### Structured Log Specifications

Each log must be in JSON format and contain the following required fields:

| Field                | Type    | Description                                              |
| ------------------- | ------- | ------------------------------------------------- |
| `timestamp`         | ISO8601 | Millisecond precision, UTC timezone                                |
| `traceId`           | string  | Associated distributed Trace (§12.7)                         |
| `spanId`            | string  | Current Span identifier                                    |
| `level`             | enum    | DEBUG / INFO / WARN / ERROR / FATAL               |
| `service`           | string  | Service name that issued the log                                  |
| `plane`             | enum    | P1-P5 / X1, identifies the owning plane                          |
| `crosscutting_fabric` | enum? | reliability / security / governance, only used for X1 logs |
| `message`           | string  | Human-readable brief description                                |
| `structuredPayload` | object  | Business context key-value pairs (tenantId, domainId, taskId, etc.) |

**Log Level Usage Guidelines**: DEBUG only for local development; INFO records normal business flow; WARN records auto-recoverable exceptions; ERROR records failures requiring human intervention; FATAL records serious errors that cause process exit. The default level in production environment is INFO.

## 12.5 DLQ and Incident

**DLQ must have**: category · reason · retry_count · first_failed_at · last_failed_at · operator_action_log · reopen_status. DLQ is not a trash can; it must be operable.

State Machine:

```text
IncidentState = detected → triaged → mitigating → resolved → reviewed → closed
DLQState = recorded → claimed → replaying → resolved | discarded | escalated
```

Each exception class must bind `error_code_namespace`, `incident_severity`, `mode_switch_rule`, `owner_team`, `replay_allowed`, and `side_effect_safe_to_replay`. When DLQ redrive may retrigger external side effects, it must first enter simulation or complete idempotency confirmation.

**Incident must associate**: affected workflows · affected aggregates · related rollout · related workers · repair/replay jobs · evidence bundle · final resolution.

## 12.6 Alert Routing Architecture

> After an Incident is generated, it must be routed to the correct person.

| SEV Level | Notification Channel              | Response SLA   | Escalation Rule              |
| -------- | --------------------- | ---------- | --------------------- |
| SEV4     | Platform console + log     | Next business day | None                    |
| SEV3     | IM notification (Slack/Feishu) | 4h         | 4h no response → SEV2      |
| SEV2     | IM + Email + on-call  | 1h         | 1h no response → SEV1      |
| SEV1     | IM + Phone + All-staff broadcast  | 15min      | 15min no response → Management |

**External Integration**: Connect to PagerDuty / OpsGenie / enterprise IM via Webhook. The platform does not have built-in alert channel implementation; it only defines routing rules and delivery interfaces.

Alert routing must support dedupe, suppression, maintenance window, and escalation cooldown; duplicate alerts of the same root cause must not bypass the cooldown window and escalate directly.

## 12.7 Distributed Tracing Architecture

> Define the trace → span → log → metric correlation model.

**Span Hierarchy**:

```text
Trace (harnessRunId)
  └─ Span: harness_run
       ├─ Span: stage_rationale.observe
       ├─ Span: stage_rationale.assess
       ├─ Span: plan_graph
       │    └─ Span: llm_call (model_gateway)
       ├─ Span: dispatch
       ├─ Span: node_run
       │    └─ Span: node_attempt
       │         └─ Span: tool_call / llm_call / hitl_wait / side_effect
       └─ Span: state_write
```

**Correlation Rules**:

- All StructuredLogs must include trace_id + span_id (already)
- Metrics associate with trace_id via exemplar (high cardinality indicator sampling)
- Incident associates trigger trace_id, supports tracing from incident to complete call chain
- Sampling strategy: error trace 100% collection, normal trace configured by tenant (default 10%)

---

# 13. OAPEFLIR Controlled Cognitive Framework

> v4.2 convergence stance: OAPEFLIR is a cognitive and governance framework of Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release, not an execution engine. The only executable runtime entry is HarnessRuntime, the only authoritative run entity is HarnessRun. OAPEFLIR stages can only exist as StageRationale, TraceProjection, Audit View, and explanation view, and do not have independent execution rights.

Summary in one sentence:

```text
OAPEFLIR v4.2 = Controlled Cognitive/Governance Semantics over HarnessRuntime
```

## 13.1 Positioning: Semantic Framework, Not Execution Engine

OAPEFLIR defines the stage semantics of each HarnessRun in cognition, governance, feedback, and release. It does not create independent Runs, does not directly drive state transitions, does not directly schedule workers, and does not directly submit side effects.

**Mandatory Invariants**:

1. Any task can only create one HarnessRun.
2. OAPEFLIR does not create independent Runs.
3. OAPEFLIR stage states can only exist as trace / projection / rationale.
4. HarnessRun state transition is the only executable state transition.
5. OapeflirTraceProjection can be derived from HarnessRun / HarnessStep / NodeRun events, but must not drive execution in reverse.

OAPEFLIR is only allowed to produce the following projection objects: `StageRationale`, `AssessmentSummary`, `PlanRationale`, `FeedbackSummary`, `LearningCandidate`, `ImprovementProposal`, `ReleaseDecisionView`. OAPEFLIR is prohibited from owning run status, step status, lease, retry counter, side effect commit state, or budget state.

Learn / Improve / Release attribution: Learn only generates candidates; Improve only prepares proposals; Release is a P2 Release Governance decision, not OAPEFLIR self-publishing.

## 13.1.1 OAPEFLIR → HarnessRun Projection Relationship

| OAPEFLIR Stage | Harness Authoritative Object | Record Form |
| --- | --- | --- |
| Observe | HarnessRun.input / ContextSnapshot | StageRationale + observation projection |
| Assess | ConstraintPack / RiskAssessment / PolicyOutcome | StageRationale + risk/audit projection |
| Plan | HarnessRun.plannerOutput.planGraphBundle | StageRationale + plan graph artifact |
| Execute | HarnessStep / NodeRun / ToolCall / SideEffectRecord | execution trace + node events |
| Feedback | EvaluationReport / HarnessDecision | feedback envelope + decision record |
| Learn | LearningCandidate | async intelligence job + quarantine state |
| Improve | ImprovementChangeSet | proposed change artifact |
| Release | P2 ReleaseRecord / EvaluationGate | rollout / approval / audit projection |

## 13.2 Eight-Stage Responsibility Boundary

| Stage | Responsibility | Standard Output | Can Directly Produce Side Effects |
| --- | --- | --- | --- |
| Observe | Observe input, events, context, goals | ObservationBundle | No |
| Assess | Risk, permission, feasibility, budget, policy evaluation | AssessmentBundle | No |
| Plan | Generate executable PlanGraph | PlanGraphBundle | No |
| Execute | Execute Graph Node, call tool / LLM / HITL / Subgraph | NodeRun / NodeAttemptReceipt | Controlled |
| Feedback | Feedback on execution result, deviation, quality, risk | FeedbackEnvelope | No |
| Learn | Extract candidate experience from feedback | LearningCandidate | No |
| Improve | Generate Prompt / Policy / Tool / Domain improvement candidates | ImprovementChangeSet | No |
| Release | Evaluation, approval, graying-out, release, rollback | ReleaseRecord | Yes, limited to config release |

## 13.3 OAPEFLIR and Five Planes Relationship

| Plane | OAPEFLIR-Harness Relationship | Key Contracts |
| --- | --- | --- |
| P1 Interface | Input uniformly enters RequestEnvelope, does not pass raw natural language directly to Runtime | RequestEnvelope, SessionContext |
| P2 Control | Provide policy, approval, budget, version lock, and release governance | EffectivePolicySnapshot, OperationalDirective, DecisionDirective, EvaluationGate |
| P3 Orchestration | Carries Observe / Assess / Plan / Feedback / Learn / Improve / Release semantics | HarnessRun, PlanGraphBundle, DecisionInputBundle, OapeflirTraceProjection |
| P4 Execution | Execute ready NodeRun, cannot bypass Graph validation and side effect governance | NodeRun, SideEffectRecord, ReconciliationRecord |
| P5 State & Evidence | Save truth, event, checkpoint, artifact, audit, support replay and lineage query | Event Registry, BudgetLedger, RunVersionLock |

## 13.4 Inter-Stage Data Flow
```text
RequestEnvelope
  └─→ Observe ─→ ObservationBundle
        └─→ Assess ─→ AssessmentBundle + EffectivePolicySnapshot
              └─→ Plan ─→ PlanGraphBundle
                    └─→ Normalize / Validate / Risk Propagate / Worst-Path
                          └─→ Graph Scheduler ─→ NodeRun
                                ├─→ Tool / LLM / HITL / Subgraph
                                ├─→ SideEffect Manager
                                ├─→ Reconciliation / Compensation
                                └─→ NodeAttemptReceipt
                                      └─→ Feedback ─→ HarnessDecision
                                            ├─ accept
                                            ├─ retry_same_plan
                                            ├─ replan → GraphPatch
                                            ├─ escalate_to_human
                                            ├─ downgrade_mode
                                            └─ abort

FeedbackEnvelope ─→ Learn ─→ LearningCandidate
                         └─→ Improve ─→ ImprovementChangeSet
                                  └─→ Release ─→ EvaluationGate / Approval / Canary / Rollback
```

## 13.5 Harness External Semantic Mapping

The OAPEFLIR eight stages are the platform's internal cognitive kernel. For product, business, and multi-Agent collaboration scenarios, a simplified **Harness role mapping** is provided:

| Harness Role        | OAPEFLIR Stage Mapping                       | Responsibility Boundary                                                                     |
| ------------------- | --------------------------------------- | ---------------------------------------------------------------------------- |
| **Planner**         | Observe + Assess + Plan                 | Understand goals, decompose tasks, identify risks, generate execution plans, choose tools and resource budgets, produce acceptance criteria |
| **Generator**       | Execute (delegate to P4)                      | Call tools, execute steps, write back evidence, generate intermediate results, request help when blocked rather than forcing through     |
| **Evaluator**       | Feedback + local evaluation + quality gate            | Judge result quality, check goal deviation, check risk elevation, decide pass/redo/downgrade/escalate to HITL     |
| **Loop Controller** | Learn + Improve + Replan + Release gate | Control loop count, decide when to replan, when to approve, when to terminate, when to release improvements      |

```text
            ┌─────────────────────────────────┐
            │       Harness Runtime (§45)      │
            │                                  │
            │  ┌─────────┐    ┌───────────┐   │
 Request ──>│  │ Planner │───>│ Generator │   │
            │  │(O+A+P)  │    │(Execute)  │   │
            │  └────┬────┘    └─────┬─────┘   │
            │       │               │          │
            │       │    ┌──────────▼────────┐ │
            │       │    │    Evaluator      │ │
            │       │    │(Feedback+Quality) │ │
            │       │    └──────────┬────────┘ │
            │       │               │          │
            │  ┌────▼───────────────▼────────┐ │
            │  │     Loop Controller         │ │
            │  │  (Learn+Improve+Replan+     │ │
            │  │   Release gate)             │ │──> Result
            │  └─────────────────────────────┘ │
            └─────────────────────────────────┘
```

Significance of the two-layer mapping:

- **Internal**: OAPEFLIR maintains fine-grained stage control, with each stage having independent interface contracts and Zod validation
- **External**: Harness four-role semantics are easier to understand, facilitating multi-Agent collaboration protocol standardization
- **For debugging**: Can observe the full chain at Harness granularity, and can also drill down to a single OAPEFLIR stage

**Two-Model Usage Hard Rule**: External protocols uniformly use Harness role semantics (Planner/Generator/Evaluator/Decision); internal implementation is allowed to continue subdividing into OAPEFLIR eight stages.

| Audience Perspective    | Model Used               | Typical Scenario                             |
| ----------- | ---------------------- | ------------------------------------ |
| Product/Business   | Harness four roles         | Requirement communication, capability introduction, API documentation         |
| Runtime/Scheduling | HarnessRun / PlanGraph | Execution engine, LoopController, state machine advancement |
| Audit/Compliance   | HarnessRun/HarnessStep | Run evidence chain, compliance reports, approval records       |
| ML/Algorithm     | OAPEFLIR eight stages        | Model evaluation, prompt tuning, stage performance analysis  |

## 13.6 OAPEFLIR-Harness Core Invariants

1. HarnessRun / NodeRun state machine must be closed; terminal states must not be exited.
2. All state transitions must be event-driven, and truth update and event append must be in the same transaction.
3. The Plan of complex tasks must be a Graph; linear `steps` can only be used as single-node or legacy display.
4. Before Graph execution, Normalize, Validate, Risk Propagation, and Worst-Path Analysis must be completed.
5. Graph Scheduler must be deterministic; each ready node selection must write an event, supporting Trace Replay.
6. Retry / Redrive must append AttemptLineage, must not overwrite old attempts.
7. Budget must be reserved before LLM / Tool / SideEffect / Evaluation; budget exhausted takes priority over retry / replan.
8. SideEffect ambiguous must not be automatically treated as success; irreversible side effects must have confirmation / reconciliation / manual review.
9. Replay must not produce real side effects.
10. Learn / Improve must not go live directly, must enter EvaluationGate and P2 Release governance.

## 13.7 Plan Must Be a Graph

PlanGraph is the main execution structure of HarnessRun plannerOutput, and also the projection view of the OAPEFLIR Plan stage. It explicitly expresses concurrency, dependencies, joins, terminals, compensation, and risk propagation boundaries, avoiding linear `steps` hiding real dependencies.

**Graph Hard Rules**:

- Each PlanGraph must have at least one entry node and one terminal node.
- All nodeId / edgeId must be stable, for easy reference by event, checkpoint, and lineage.
- Concurrency is only expressed by ready node set; workers are not allowed to infer on their own.
- High-risk nodes must carry `riskProfile`, `approvalRequirement`, and `compensationPolicy`.
- Subtasks, delegation, and multi-Agent collaboration must be explicitly modeled as Subgraph or ChildRun.

## 13.8 PlanGraph Contract

| Object | Required Content | Description |
| --- | --- | --- |
| PlanGraphBundle | planGraphId, graphVersion, graph, schedulerPolicy, budget, riskProfile, validationReport, evidenceRefs | Formal execution plan carrier from P3 → P4 |
| PlanGraph | nodes, edges, entryNodeIds, terminalNodeIds, graphMetadata | Executable graph itself |
| PlanNode | nodeId, kind, inputs, expectedOutputs, toolPolicy, riskProfile, budgetReservationHint | Minimum execution unit |
| PlanEdge | edgeId, from, to, condition, edgeKind | Dependencies, conditions, compensation, failure paths |
| GraphPatch | baseGraphVersion, operations, compatibilityReport, reason, auditRef | Replan's append-only change |

## 13.9 Graph Normalization

Normalization converges Planner output into an executable graph:

- Generate stable nodeId / edgeId
- Fill in entry / terminal / failure terminal
- Convert implicit serial order to explicit edge
- Mark high-risk nodes with approval / compensation / sandbox
- Split budget hints to node-level reservation hint

Normalization must output `GraphNormalizationReport` and save it as evidence.

## 13.10 Graph Validation

Validation is the mandatory admission gate before P4 execution. Must at least verify:

- DAG / controlled loop legality
- entry / terminal exist and are reachable
- no deadlock / no orphan / no impossible join
- node kind has corresponding executor or HITL handler
- Risk, budget, tool, sandbox, approval configuration is complete
- Irreversible side effects have confirmation / reconciliation / manual review paths
- GraphPatch is compatible with baseGraphVersion

Graphs with `validationReport.valid=false` must not enter `ready`, only replan, escalate, or abort.

Controlled loops must be explicitly modeled as `LoopNode`, not expressed via implicit edge cycle. LoopNode must declare `max_iterations`, `budget_per_iteration`, `termination_condition`, `loop_evidence_ref`, `state_carryover_policy`, and `timeout_action`; Graph Validation fails if any field is missing.

## 13.11 Graph Risk Propagation

Risk is not a local attribute of a node. GraphRiskPropagator must propagate risk along dependency edges, computing:

- Highest risk of the entire graph
- Accumulated risk of each path
- Taint of high-risk nodes on downstream output / memory / side effect
- Node set requiring approval, isolated worker, or degraded mode

## 13.12 Graph Worst-Path Analysis

Worst-Path Analysis estimates the worst path's time, cost, token, tool calls, approval waits, and compensation cost before execution. Unknown probability is worst-case; optional branches take the maximum cost path; parallel join uses max latency + sum cost; LoopNode is estimated by max_iterations. If the worst path exceeds the hard upper limit of ConstraintPack or BudgetLedger, PlanGraph must not execute, must replan or escalate.

## 13.13 GraphPatch and Replan

Replan does not overwrite the old graph, but appends GraphPatch:

```text
PlanGraph(v1) + GraphPatch(v2 operations) → PlanGraph(v2)
```

GraphPatch must declare baseGraphVersion, patch reason, affected node/edge, compatibility report, and audit reference. Nodes that have completed or committed irreversible side effects must not be silently deleted; they can only be handled through compensation, skipping subsequent paths, appending repair nodes, or manual takeover.

`GraphPatchOperation` is a closed enumeration, custom string extensions are prohibited:

| operation | Description | Hard Constraint |
| --- | --- | --- |
| add_node | Append new node | Must declare node kind, budget hint, risk class |
| add_edge | Append dependency edge | Must not form unauthorized cycle |
| disable_edge | Disable edge on unexecuted path | Must prove it will not skip compensation path of committed side effects |
| add_compensation_node | Append compensation node | Must associate sideEffectId / compensationPlanRef |
| add_failure_path | Append failure handling path | Must connect to failure terminal or HITL |
| mark_skipped | Mark unexecuted node as skipped | Can only be used for unleased / running / terminal nodes |
| append_subgraph | Append subgraph | Subgraph must pass complete Graph Validation |

GraphPatch schema must contain: `patchId`, `baseGraphVersion`, `newGraphVersion`, `operations[]`, `affectedExecutedNodes[]`, `affectedSideEffects[]`, `compatibilityClass`, `compensationPlanRef?`, `policyProofRef`, `auditRef`. `compatibilityClass` can only be `safe_append / requires_checkpoint_revalidation / requires_human_approval / incompatible_restart_required`. The semantics of executed nodes, existing NodeAttemptReceipt, and confirmed/ambiguous SideEffect must not be rewritten.

## 13.14 Closed-Loop Relationship between OAPEFLIR and Evaluation / Learning / Release

Feedback only produces facts and suggestions; Learn only produces LearningCandidate; Improve only produces ImprovementChangeSet. Any Prompt / Policy / Tool / Domain improvement must enter EvaluationGate, and can only be Released after passing offline evaluation, regression set, risk scan, approval, graying-out, and rollback strategy. LLM-as-Judge can be used as auxiliary scoring, but cannot override deterministic failure, policy rejection, security violation, budget exhaustion, or replay inconsistency.

---

# 14. Runtime Execution Plane

> Core responsibility definition, with **execution strategy mode** and **Executor registration mechanism**.

## 14.1 Core Responsibilities

HarnessRun / PlanGraph / NodeRun / NodeAttempt lifecycle · dispatch / queue / worker scheduling · lease / fencing · executor call · side effect controlled commit · retry / timeout / recovery · mode-aware execution · NodeAttemptReceipt report · platform fact event emission

## 14.2 Dispatcher Intelligent Scheduling

Dispatcher is simultaneously a risk isolation point; scheduling decision matrix:

| Factor                | Impact                             |
| ------------------- | -------------------------------- |
| worker capability   | Match node required capability               |
| worker health       | Exclude unhealthy worker                |
| queue class         | priority / standard / background |
| node risk class     | High-risk nodes assigned to isolated pool or HITL |
| node budget state   | Nodes without active reservation must not be scheduled |
| tenant quota        | Single tenant must not exceed quota             |
| sandbox requirement | Match sandbox tier                |

## 14.3 Execution Strategy Mode

> Upgrade execution strategy from hardcoded to configurable mode.

Each Business Pack can declare its own ExecutionStrategy to override the default.

## 14.4 Executor Registration Mechanism

> Upgrade executor from hardcoded to pluggable registration.

**Built-in Executor types**: ToolExecutor · PluginExecutor · AdapterExecutor · BrowserExecutor · HumanWaitExecutor · SubWorkflowExecutor

## 14.5 Side Effect Proposal and Commit Entry

1. Executor returns proposed side effect
2. Policy / approval decides whether to allow entering commit
3. SideEffect Manager records delivery semantics and confirmation strategy
4. After commit, enter confirmation / reconciliation / compensation (see §14.11-§14.13)

> Tool execution success is not equivalent to side effect being officially effective; only confirmed side effects can serve as success facts.

## 14.6 HumanWait Is a Formal Executor

Approval wait is not a bypass. HumanWait is responsible for: creates decision → blocks execution → waits resolution → resumes flow.

## 14.7 Recovery Worker Family

LeaseReclaimer · ExecutionRecoveryWorker · WorkflowRepairWorker · ProjectionRebuildWorker · ReplayWorker · StuckRunSweeper

Each Recovery Worker must declare its own `RecoveryCadence` (check interval, maximum concurrent recovery count, timeout), and report results via `RecoveryReport`.

## 14.8 Runtime Mode Switching

**Canonical mode set** (consistent with §9.5): full_auto · supervised_auto · read_only · no-write · no-external-call · no-rollout · manual_only · incident-mode

Among them, `full_auto` corresponds to the old name `normal`, `supervised_auto` corresponds to the old name `degraded`/`supervised`. All runtime modes must use this canonical enumeration.

Mode switching authority belongs to P2 Control Plane, issued via `OperationalDirective(type: "mode_switch")`.

## 14.9 Deterministic Graph Scheduler

P4 no longer consumes implicitly ordered steps, but consumes `PlanGraphBundle`. Graph Scheduler only schedules ready nodes that satisfy dependencies, policies, budget, lease, worker capability, and risk isolation, and sorts by deterministic policy.

| Policy Factor | Description |
| --- | --- |
| priority | Node explicit priority, higher value means scheduled first |
| risk_class | High-risk nodes prioritize entering isolated queue or HITL |
| critical_path_rank | Nodes on worst path can prioritize reducing tail latency |
| created_order | As stable tie-breaker, guarantees replay consistency |
| scheduler_seed | Same graph + policy + recorded ready set produces the same scheduling order; scheduling decisions must write events |

Scheduler must not determine order based on worker local time, random numbers, or non-replayable external state; all scheduling choices must be written to events.

Scheduler event must record:

```yaml
ready_set:
selected_node_ids:
ordering_policy_version:
worker_pool_snapshot_ref:
decision_reason:
queue_class:
queue_depth_before:
max_queue_depth:
```

DispatchQueue must be a bounded queue. When `queue_depth >= max_queue_depth`, must not continue receiving ordinary NodeRuns; critical NodeRuns can only use independent emergency lane, and lane must also have a hard upper limit. Retryable scheduling requests exceeding the hard upper limit enter `dispatch_backpressure_rejected` event; non-discardable events are written to DLQ, waiting for operator redrive.

## 14.10 NodeRun State Machine

`NodeRun` is the minimum execution state entity of P4. Standard states:

```text
created → ready
ready → leased → running → succeeded
                         ├→ failed
                         ├→ retry_wait → ready
                         ├→ awaiting_hitl
                         ├→ reconciling
                         ├→ dependency_failed
                         ├→ policy_blocked
                         └→ cancelled / aborted
```

The terminal state set is `succeeded / failed / skipped / cancelled / dependency_failed / policy_blocked / aborted`. Nodes with unmet dependencies or not selected by scheduling must not disguise themselves as executable NodeRuns in `blocked/queued`; they should be kept in the PlanGraph scheduling view, and only instantiated as `NodeRun` and enter `ready` when executable. `retry_wait` is a non-terminal state, must record `wakeAt`, `retryPolicyRef`, `attemptId`, and backoff reason, and can only be transitioned back to ready via RuntimeStateMachine after expiration, or enter failed/aborted. Compensation is not a NodeRun success terminal state; compensation facts must be recorded in SideEffectRecord / CompensationRecord. Terminal states must not be exited; retry / redrive must create a new attempt and append AttemptLineage. All state transitions must be based on RuntimeStateMachine + CAS + active lease + fencing token.

Entity boundary: `HarnessStep` is a semantic step, can be expanded into one or more `NodeRun`s; `NodeRun` is an executable graph node instance; `NodeAttempt` is a retry / redrive attempt under `NodeRun`. Retries must not create a new NodeRun, unless GraphPatch explicitly appends a new node.

### RunTerminationCleanup

After HarnessRun or NodeRun enters terminal state, must synchronously trigger `RunTerminationCleanup`, and use cleanup receipt as part of terminal evidence. The cleanup sequence is fixed as:

```text
stop new leases
→ revoke active secret leases
→ release / settle open budget reservations
→ close plugin/browser/file/socket resources
→ cancel pending timers and callbacks
→ mark pending HITL / approval scopes expired
→ compact or schedule-retain ContextSnapshot
→ emit cleanup_completed or cleanup_failed
```

Any cleanup step failure must not roll back terminal state; must generate `cleanup_failed` incident, and RecoveryWorker / Sweeper retries by idempotency key. Secret lease and budget reservation release must be in the same transaction as cleanup event or guaranteed final visibility via outbox.

## 14.15 NodeRun Terminal Reason Codes

| reasonCode | Applicable State | Description |
| --- | --- | --- |
| `success_criteria_met` | succeeded | Node succeeds and acceptance conditions are met |
| `tool_error_retry_exhausted` | failed | Retryable tool error exhausted |
| `schema_validation_failed` | failed / policy_blocked | Output or input schema is invalid |
| `policy_denied` | policy_blocked | P2 / Guardrail explicitly rejects |
| `budget_exhausted` | failed / aborted | Budget exhausted and cannot continue |
| `dependency_failed` | dependency_failed | Upstream required node fails |
| `condition_not_met` | skipped | Branch condition not hit |
| `human_cancelled` | cancelled | Manual cancellation or termination after takeover |
| `panic_aborted` | aborted | PlatformPanic / kill directive abort |
| `compensation_completed_after_failure` | failed / aborted | Original action failed or was aborted, associated CompensationRecord has been completed; NodeRun state is not rewritten to compensated |

Failure, skip, cancel, and policy block must be distinguished by terminal reason code; it is prohibited to put all non-success into `failed`.

## 14.11 SideEffect Manager v4.4

Side effect has been upgraded from "two-phase recording" to a complete state machine with delivery semantics:

```text
proposed
  → approved
      ├→ committing
      │    → committed
      │    → confirming
      │    → confirmed
      ├→ revoked
      └→ expired

committing / confirming
  → ambiguous
  → reconciling
  → confirmed | compensation_required | manual_review_required
```

**Side Effect Hard Rules**:

- Tool returning success is not equivalent to side effect being confirmed.
- `ambiguous` must not be automatically treated as success.
- `approved` is only an authorization window, not a commit fact; when approval expires, is withdrawn, or scope does not match, must enter `expired` / `revoked`, both are non-committable terminal states; if need to continue execution, must recreate SideEffectRecord or re-approve.
- Before commit, must re-verify: approval still valid, budget reservation held, policy still compatible, risk not elevated or explicitly accepted, operator scope covers this side effect.
- Irreversible side effects must have confirmation, reconciliation, or manual review.
- Compensation can only append compensation records, not delete original side effect evidence.
- Replay / simulation environments must disable real side effects, can only produce simulated receipts.

## 14.12 Reconciliation Worker

When external system timeout, connection interruption, commit receipt loss, or idempotency key state is unknown, Reconciliation Worker takes over reconciliation:

| Status | Trigger | Subsequent Action |
| --- | --- | --- |
| pending | SideEffect ambiguous | Query external status or idempotency key |
| matched | External status matches expectation | Mark as confirmed |
| diverged | External status differs from expectation | Create incident + compensation_required |
| unknown | Cannot confirm | Escalate to manual_review_required |
| expired | Reconciliation window expires | Escalate / abort / compensate by risk level |

Reconciliation results must associate with original SideEffectRecord, NodeRun, traceId, external idempotency key, and evidence bundle.

## 14.13 Compensation Manager

Compensation Manager manages reversible, side-effect compensation, and manual repair paths. Compensation is not rolling back database state, but appending an auditable repair action to the external world. Non-compensable side effects must be marked as `irreversible` in the PlanGraph stage, and raise approval and confirmation requirements before execution.

Compensation state machine:

```text
compensation_required
  → compensation_planned
  → compensation_approved
  → compensation_committing
  → compensation_confirmed | compensation_failed | manual_review_required
```

Compensation failure must not delete original side effect; must retain original evidence, compensation attempt, external response, and manual confirmation record.

## 14.14 Retry / Redrive / AttemptLineage

Retry is the automatic retry strategy of the same NodeRun; Redrive is a new attempt triggered by manual or recovery processes. Both must append AttemptLineage:

| Field | Description |
| --- | --- |
| attemptId | Single attempt unique identifier |
| parentAttemptId | retry / redrive source |
| reason | timeout / transient_error / operator_redrive / reconciliation_fix |
| inputSnapshotRef | Frozen input used by this attempt |
| outputRef | Output or error reference |
| budgetReservationRef | Budget reservation record |
| terminalStatus | This attempt's terminal status |

AttemptLineage is the source of fact for audit and replay, must not be overwritten, compressed, or deleted.

---

# 24. Configuration Governance Architecture

> Define a complete configuration governance model.

## 24.1 Configuration Layering

| Layer         | Example                          | Change Frequency | Approval Requirement    |
| ---------- | ----------------------------- | -------- | ----------- |
| Platform default   | retry_max=3, timeout=5000ms   | Very low     | ADR level      |
| Environment override   | prod.timeout=10000ms          | Low       | P2 approval     |
| Tenant override   | tenant_A.max_concurrent=50    | Medium       | Tenant administrator  |
| Business pack override | coding.retry_max=5            | Medium       | Pack owner |
| Runtime dynamic | circuit_breaker.threshold=0.3 | High       | Auto rules    |

Runtime configuration is further divided by effective boundary:

| Type | Description |
| --- | --- |
| admission_locked_config | Frozen into RunVersionLock when run is admitted, unchanged during run |
| checkpoint_revalidated_config | Re-verified on resume / redrive / checkpoint recovery |
| hot_reloadable_config | Hot-reloadable, but must not change semantics of already running NodeRun |
| emergency_override_config | Safety emergency override; can only tighten policies and append P0 audit and Evidence |

`emergency_override_config` can only perform tightening actions such as deny, pause, egress block, sandbox harden, secret revoke, admission stop, forced pause/abort; must not relax policies, expand capabilities, switch to more dangerous tools, lower sandbox tier, raise budget hard cap, or bypass RunVersionLock. hot_reloadable can only affect new admissions or next checkpoint revalidation, must not change semantics of running NodeRuns.

## 24.2 Configuration Versioning

- Each configuration change generates a new version, preserving complete history
- Support diff: show differences between two versions
- Support rollback: one-click rollback to any historical version
- Configuration change emits `config.changed` event, triggering related component hot-reload

Runtime must periodically execute `ConfigDriftReconciler`: compare versioned defaults, environment overrides, tenant overrides, actual process loaded values, and frozen values in RunVersionLock. When unauthorized drift, hot-reload failure, inconsistent worker pool configuration, or emergency override expiration not recovered is detected, generate `config.drift_detected` incident; drift affecting security, budget, egress, sandbox, or approval must fail closed.

## 24.3 Configuration Graying-Out

High-risk configuration changes (such as timeout, rate limit threshold) support graying-out:

1. First apply to canary environment
2. Observe 30 minutes without exception
3. Expand to 10% traffic
4. Full release

Configuration graying-out must declare rollback guardrail:

```yaml
rollback_metrics:
  max_error_rate:
  max_policy_denial_spike:
  max_latency_regression:
  max_incident_rate:
```

## 24.4 Configuration Security

- Sensitive configuration (secret, credential) only stores references, not plaintext
- Configuration change audit, recording who / when / what / why
- Critical configuration (sandbox tier, egress allowlist) changes must be approved by P2

`ConfigImpactAnalyzer` is a mandatory gate before high-risk configuration release, must list affected tenants, active HarnessRuns, domains, packs, connectors, policies, budgets, and approval routes. If affecting high/critical run, egress, sandbox, secret, budget, or policy strictness, must block direct full release, redirect to canary / checkpoint revalidation / explicit override.

---

# 25. Data and State Consistency Architecture

The platform's state is divided into five layers, from top to bottom serving control, execution, context, knowledge, and evidence respectively. Each layer has different requirements for isolation, lifecycle, and consistency:

```text
┌─────────────────────────────────────────────────────┐
│  L1  Control State    (Policy/Approval/Budget)     │  §11-§13, §45.20
│      Lifecycle: cross-run · strong consistency · changes require approval          │
├─────────────────────────────────────────────────────┤
│  L2  Execution State  (HarnessRun/NodeRun/Checkpoint)│  §14-§16, §45.15
│      Lifecycle: single run · transactional consistency · checkpoint recoverable  │
├─────────────────────────────────────────────────────┤
│  L3  Context State    (Session/Turn/Variables)     │  §45.5 ContextManager
│      Lifecycle: single session · eventual consistency · can be snapshotted         │
├─────────────────────────────────────────────────────┤
│  L4  Knowledge State  (Working/Long-term/Shared)   │  §45.16 Memory Namespace
│      Lifecycle: cross-run/cross-agent · async sync · promotable   │
├─────────────────────────────────────────────────────┤
│  L5  Evidence State   (Event/Trace/Metric/Audit)   │  §25-§29, §58-§59
│      Lifecycle: permanent append · immutable · replayable for reconstruction         │
└─────────────────────────────────────────────────────┘
```

Key invariants between the five layers: Every state change in L2 must synchronously append L5 event; L3→L4 promotion is decided by Evaluator (§45.16); L1 changes must be approved by P2 before they can act on L2/L3.

## 25.1 Consistency Principles

Do not pursue global strong consistency, pursue: truth state transactional consistency · event append same transaction · projection eventual consistency · replay rebuildable · side effect auditable.

## 25.2 Truth Table + Event Log Dual Model

- Truth table saves current state (read-optimized)
- Event log saves historical changes (audit/replay-optimized)
- Both update in the same transaction, ensuring consistency

## 25.3 CAS + Lease + Fencing

All critical updates must be based on: expected status CAS · active lease · fencing token. This is the hard constraint of execution layer consistency.

All truth writes must go through the unique transaction entry:

```text
RuntimeStateMachine.transition(command)
```

This entry must, in the same transaction, verify expectedStatus, active lease, fencing token, RunVersionLock, policy guard, budget precondition, and side-effect safety, and synchronously write truth update + platform fact event + outbox + audit ref. Bypassing this entry to directly update truth table is considered an invariant violation.

## 25.4 Projection Must Be Rebuildable

All projections must: idempotent · replay-safe · event_id deduped · support rebuild · not write back to truth.

## 25.5 State & Evidence Layering

| Layer         | Content         | Purpose                                     |
| ---------- | ------------ | ---------------------------------------- |
| Truth      | Current control truth | State judgment, concurrency control, scheduling advance             |
| Event      | Historical change trajectory | Timeline reconstruction, replay, failure explanation               |
| Projection | Query model     | Console, reports, approval queue                  |
| Audit      | Audit record     | Who did what to what                         |
| Artifact   | Large object content   | observation/plan/log/evidence/screenshot |
| Checkpoint | Execution recovery point   | Breakpoint recovery, repair, replay starting point            |

## 25.6 Consistency Model and Assurance Level

| Operation              | Consistency Guarantee                    | Implementation Mechanism                                  |
| ----------------- | ----------------------------- | ----------------------------------------- |
| Truth table write  | Strong consistency (single-partition linearizable)      | CAS + fencing token + same-transaction event append |
| Event append      | Strong consistency (same transaction as truth)     | outbox pattern (§7.3)                    |
| Projection read   | Eventual consistency (lag ≤ 5s SLO, §27) | Async projector + event_id dedup            |
| Cross-tenant query | Eventual consistency                      | Projection aggregation, no cross-truth transactions          |
| Cross-region replication | Eventual consistency (lag ≤ 30s, §52)    | Async replication + failover reconciliation for unreplicated leader writes |

**Read-your-own-writes guarantee**: After writing the truth table, the same principal's subsequent read requests directly read the truth table via the read-after-write token, not depending on projection. The projection path does not guarantee read-your-own-writes.

**Projection eventual consistency window**: Normal operation lag ≤ 5s; when event bus has backpressure, lag can reach 60s (trigger Level 2 alert, §9.2); during Projection rebuild, specific projection is temporarily unavailable, Console shows stale mark.

Read path matrix:

| Scenario | Read Source |
| --- | --- |
| approval decision page | truth, prohibit stale projection |
| dashboard aggregate | projection, can show freshness |
| run detail after mutation | truth + read-after-write token |
| audit report | event/audit store |
| incident forensic view | truth + event + artifact evidence |

CAS hotspot retry strategy: `max_retries=3`, backoff = `20ms, 50ms, 100ms + jitter`; if still fails, requeue scheduler tick, must not busy-wait.

## 25.7 Schema Migration Strategy

The current `SchemaInventoryService` aggregates the complete logical table inventory (§26.3) from authoritative schema and extension DDL, but MVP delivery must not use the full inventory as acceptance criteria. Ring 1 only allows using the MVP table set in §26.5; remaining tables must be marked with Phase/Ring before migration.

- **Backward compatible changes** (add column, add index): Online migration, no downtime
- **Breaking changes** (column rename, type change, table split): Dual-write window (old schema + new schema write simultaneously → switch read path → stop writing old schema → cleanup)
- **Migration version tracking**: Each migration script has monotonic version, tracking executed versions via `schema_migrations` table
- **Rollback capability**: Each migration must have corresponding rollback script
- **Storage evolution association**: Schema migration strategy aligns with storage evolution path (§26.2 E1→E4) — E1/E2 uses SQLite migration, E3/E4 uses PostgreSQL migration

## 25.8 HarnessRun / NodeRun State Consistency

v4.2 takes HarnessRun and NodeRun states as first-class objects of P5 truth. OAPEFLIR stage state is only derived as `OapeflirTraceProjection`, and does not participate in executable state transitions. All state transitions must satisfy:

- expected status CAS success
- active lease not expired
- fencing token match
- state transition is within state machine allowed set
- truth update and event append are completed in the same transaction

`HarnessRun` standard states: created · admitted · planning · ready · running · pausing · paused · resuming · replanning · compensating · completed · failed · aborted.

`NodeRun` standard states: created · ready · leased · running · retry_wait · awaiting_hitl · reconciling · succeeded · failed · skipped · cancelled · dependency_failed · policy_blocked · aborted.

Terminal state closure rule: completed / failed / aborted / succeeded / skipped / cancelled / dependency_failed / policy_blocked, as terminal states, must not be exited; any repair must be expressed via redrive, compensation, GraphPatch, or child run append. `retry_wait`, `awaiting_hitl`, `reconciling` are non-terminal waiting states, must have wake condition or external resolution record.

## 25.9 Budget Ledger Consistency

Budget Ledger is the source of run-level budget facts, no longer relying on scattered token statistics. Actions that may consume budget such as LLM, Tool, SideEffect, Evaluation, HITL must first reserve, then consume or release.

```text
reserve → consume
        └→ release
        └→ expire
```

Budget hard rules:

- budget exhausted has higher priority than retry / replan / evaluator accept.
- reservation must bind runId, nodeRunId, attemptId, principal, reason.
- consume must not exceed reservation; overage must create incident or require approval.
- replay defaults to use shadow ledger, does not affect real budget.

## 25.10 RunVersionLock

Each HarnessRun freezes `RunVersionLock` when admitted, locking the Prompt, Policy, Tool, Domain, Model, Eval, Guardrail, RuntimeProfile, and schema version used by this run. Configuration release during run must not change the semantics of already running run; can only use new version via explicit GraphPatch, OperationalDirective, or redrive.

RunVersionLock goals:

- Support Trace Replay and incident audit
- Avoid half-way Prompt / Policy drift
- Support incident audit and release rollback
- Clarify source version when learn / improve generates candidates

### VersionLockOverridePolicy

When GraphPatch conflicts with RunVersionLock, must be handled according to the following strategy:

| Strategy | Description |
| --- | --- |
| inherit_lock | GraphPatch must use original version |
| compatible_minor_only | Only allow compatible minor versions |
| explicit_override | Can break through lock, but must HITL + Evidence + Replay Isolation |
| force_restart | Patch not allowed, must create new HarnessRun |

Default strategy: low / medium risk uses `compatible_minor_only`; high / critical risk uses `inherit_lock`.

## 25.11 Multi-Region Write Boundary

v4.2 does not promise multi-master truth writes. CAS, Lease, Fencing, Budget Ledger, and SideEffect Commit are only valid within partition leader:

```text
single-leader per partition
follower reads
async replication
controlled failover
```

Hard rules:

- Follower region does not accept truth writes.
- After failover, generate new fencing epoch.
- After old leader recovers, must join as follower.
- CRDT is only allowed for non-critical, non-financial, non-side-effect statistical aggregates.

---

# 26. Storage Architecture

> First define the **storage abstraction layer**, then provide a **progressive evolution path**.

## 26.1 Repository Abstraction Layer

All upper-layer code accesses storage through Repository interface, not directly operating the database.

Significance of this layer:

- Upper layer does not care whether underlying is SQLite / PostgreSQL / other
- Can use in-memory implementation for unit testing
- Can progressively migrate from SQLite to PostgreSQL

## 26.2 Storage Evolution Path

| Phase          | Storage Engine              | Applicable Scenario         | Switch Method            |
| ------------- | --------------------- | ---------------- | ------------------- |
| E1 Development/Prototype  | SQLite (WAL mode)     | Single node, 10 concurrent  | Default                |
| E2 Small-scale production | SQLite + Redis cache  | Single node, 50 concurrent  | Configuration switch            |
| E3 Medium-scale production | PostgreSQL            | Multi-node, 500 concurrent | Repository implementation replacement |
| E4 Large-scale production | PostgreSQL + Sharding/archiving | Cluster, 5000+ concurrent | Schema evolution         |

**Switch Principle**: Repository interface unchanged, only replace implementation. First migrate read-heavy write-light tables (projection, audit), then migrate core write paths (truth, event).

## 26.3 Core Table Design (Logical Model)

> The current repo maintains the authoritative table inventory via `src/platform/five-plane-state-evidence/truth/schema-inventory-service.ts`. The document retains two complementary views: one serving migration execution, one serving architecture communication.

**Execution/Migration View (4 Categories)**:

- `core_truth`: 55 tables
- `runtime_extension`: 18 tables
- `governance_extension`: 9 tables
- `reliability_extension`: 4 tables

**Architecture/Cognitive View (7 Groups)**:

### Group 1: Workflow & Execution (21 tables)

Tasks, execution, leases, events, sessions, worker, and workflow main chain.
Representative tables: tasks · executions · execution_* · workflow_* · sessions · session_events · worker_snapshots · outbox

### Group 2: Decision & Policy (12 tables)

Approval, policy, quota, governance gate, and operation decisions.
Representative tables: approvals · action_proposals · entitlement_decisions · governance_gate_events · quota_counters · skill_execution_policies

### Group 3: Knowledge & Artifact (13 tables)

artifact, memory, experience cache, pack/prompt resources, marketplace listing, and perception data.
Representative tables: artifacts · memories · experience_cache · pack_* · prompt_* · marketplace_listings · perception_sources

### Group 4: Ops & Governance (10 tables)

DLQ, dead letter, instance snapshot, remote log, secret lease, and enterprise governance reports.
Representative tables: dead_letters · dlq_records · event_dead_letters · secret_leases · remote_log_entries · enterprise_governance_reports

### Group 5: AI Operations (9 tables)

Evaluation, cost, usage, and analysis facts.
Representative tables: eval_* · cost_* · usage_events · analytics_facts · pmf_validation_reports

### Group 6: Domain & Organization (12 tables)

Tenant, organization, namespace, billing, and deployment binding.
Representative tables: tenants · tenant_* · organizations · workspaces · data_namespaces · deployment_bindings · billing_*

### Group 7: Maturity & Lifecycle (9 tables)

Release, archival, evolution, environment promotion, data migration, and replay datasets.
Representative tables: release_* · archive_bundles · evolution_logs · environment_promotion_history · replay_datasets

**The complete inventory currently has 86 logical tables**. This number is only used for architecture communication and schema inventory golden test, not the MVP build target. Implement progressively by `category`, `documentedGroup`, and delivery ring; tables not marked with Ring/Phase, owner, migration, rollback, and test_ref must not enter the mainline migration.

## 26.4 v4.2 Runtime Table Placement

After v4.2 convergence, Harness / OAPEFLIR run objects must have clear placement in the storage layer. Prioritize reusing existing truth / event / execution tables during implementation; if new tables must be materialized, must simultaneously update `SchemaInventoryService`, migration version, §26.3 inventory, and rollback script.

| Run Entity | Recommended Table / Repository | Storage Strategy | Owning Group | Migration Phase |
| --- | --- | --- | --- | --- |
| HarnessRun | `harness_run` | The only authoritative run truth; OAPEFLIR only generates trace projection | Group 1 | E1 |
| NodeRun | `node_run` | NodeRun as minimum execution truth; old step projection derived by adapter | Group 1 | E1 |
| NodeAttempt / AttemptLineage | `node_attempt` | append-only, associate nodeRunId / parentAttemptId | Group 1 | E1 |
| PlanGraphBundle | `plan_graph` + artifact ref | graph JSON stored in artifact, truth table stores id/version/hash/status | Group 1 / Group 3 | E1 |
| GraphPatch | `graph_patch` | append-only, baseGraphVersion + operations + auditRef | Group 1 | E1 |
| BudgetLedger | `budget_ledger` + `budget_reservation` | reservation / consume / release write event in same transaction; real LLM/tool pre-front for MVP | Group 2 / Group 5 | E1 |
| RunVersionLock | `run_version_lock` | Frozen at admission, read-only afterwards | Group 7 | E1 |
| SideEffectRecord | `side_effect` | proposed→confirmed state machine, unique index on external idempotency key | Group 1 / Group 4 | E1 |
| ReconciliationRecord | `reconciliation_record` | Created after ambiguous, reconciliation result append-only; must be online before real external write | Group 4 | E2 |
| DecisionInputBundle | artifact ref + `decision_record` | bundle large object into artifact, decision summary into truth | Group 2 / Group 3 | E1/E2 |
| HumanResponsibilityRecord | `human_responsibility_record` | Manual operation responsibility boundary, associate with audit log | Group 2 / Group 4 | E1 |
| LearningCandidate | `learning_candidates` extension or `oapeflir_learning_candidates` | quarantine / approved / rejected / released state machine | Group 5 / Group 7 | E3 |
| Event Registry Metadata | `event_registry_entries` | Event type, schemaVersion, replayBehavior registry | Group 4 | E1/E2 |

**Migration Constraints**:

- v4.3 first batch of migration must cover HarnessRun, NodeRun, NodeAttempt, PlanGraphBundle, GraphPatch, BudgetLedger, BudgetReservation, Event Registry Metadata, RunVersionLock.
- BudgetLedger, SideEffectRecord must complete before any LLM/tool/side effect execution; ReconciliationRecord must complete before any real external write goes online.
- Old workflow / execution tables, after entering compatibility period, only allow adapter read/write, must not add new execution paths that bypass NodeRun.
- If new tables cause inventory statistics changes, must update §26.3, version history, and schema inventory golden test in the same PR.

## 26.5 MVP Table Set Trimming

v4.3 MVP does not use the full 86-table model as the delivery target, but uses within 22 tables to complete the minimum production closed loop:

```text
tenant
principal
task_draft
confirmed_task_spec
idempotency_record
harness_run
plan_graph
graph_patch
node_run
node_attempt
lease_record
budget_ledger
budget_reservation
side_effect
approval_request
decision_record
human_responsibility_record
event_log
event_outbox
event_inbox
checkpoint
artifact_record
audit_record
tool_definition
tool_call
```

`task` is not an MVP truth table; `task_draft` and `confirmed_task_spec` are pre-admission intake truth, used to prevent unconfirmed natural language from directly entering RequestEnvelope. `lease_record` is an MVP required truth, used for NodeRun active lease, fencing token, expiration scan, and worker crash recovery. If must strictly be ≤20 tables, can merge `task_draft + confirmed_task_spec`, `event_inbox + event_outbox`, `approval_request + decision_record`, but it is not recommended to delete `lease_record`, `graph_patch`, or `human_responsibility_record`.

`lease_record` minimum index:

```text
primary key (lease_id)
unique active lease (entity_type, entity_id) where status = 'active'
index (expires_at, status)
index (worker_id, status)
```

Hardening Ring appended tables:

```text
worker
dlq_record
incident
recovery_job
reconciliation_job
compensation_record
projection_rebuild_job
config_version
prompt_version
model_provider
usage_record
health_snapshot
```

Remaining tables enter Enterprise Ring. Any new table must be marked with owning ring, owner, migration, rollback, and golden test.

## 26.6 MVP Physical Schema Baseline

The first batch of MVP migration must establish real physical boundaries around Intake / HarnessRun / PlanGraphBundle / GraphPatch / NodeRun / NodeAttempt / Lease / Event Inbox-Outbox / Budget / SideEffect / HITL / Audit. The following table is the minimum acceptance for the first batch of schemas, does not require implementing 86 logical tables at once.

| Table | Required Fields | Required Indexes / Constraints | Write Entry |
| --- | --- | --- | --- |
| `task_draft` | `task_draft_id`, `tenant_id`, `raw_input_ref`, `risk_preview`, `clarification_state`, `status` | `(tenant_id, status)` | `IntakeService.createDraft/clarify` |
| `confirmed_task_spec` | `confirmed_task_spec_id`, `task_draft_id`, `confirmation_receipt_ref`, `task_spec_hash`, `status` | unique `(task_draft_id)` | `IntakeService.confirm` |
| `harness_run` | `harness_run_id`, `tenant_id`, `status`, `confirmed_task_spec_id`, `request_hash`, `constraint_pack_ref`, `version_lock_id` | `(tenant_id, status)`, `request_hash` idempotency index | `RuntimeStateMachine.transition` |
| `plan_graph` | `plan_graph_id`, `harness_run_id`, `graph_version`, `artifact_ref`, `graph_hash`, `status` | unique `(harness_run_id, graph_version)` | `PlanGraphRepository.appendVersion` |
| `graph_patch` | `graph_patch_id`, `harness_run_id`, `base_graph_version`, `new_graph_version`, `operations_ref`, `compatibility_class`, `affected_side_effects_ref` | unique `(harness_run_id, new_graph_version)` | `PlanGraphRepository.appendPatch` |
| `node_run` | `node_run_id`, `harness_run_id`, `plan_graph_id`, `node_id`, `status`, `attempt_count`, `terminal_reason` | unique `(harness_run_id, node_id)`, `(status, updated_at)` | `RuntimeStateMachine.transition` |
| `node_attempt` | `attempt_id`, `node_run_id`, `attempt_no`, `started_at`, `finished_at`, `result_ref` | unique `(node_run_id, attempt_no)` | `NodeAttemptRepository.record` |
| `lease_record` | `lease_id`, `entity_type`, `entity_id`, `worker_id`, `fencing_token`, `expires_at`, `status` | unique active `(entity_type, entity_id)`, `(expires_at, status)` | `LeaseManager.acquire/renew/release` |
| `event_log` | `event_id`, `aggregate_type`, `aggregate_id`, `aggregate_seq`, `event_type`, `payload_hash`, `occurred_at` | unique `(aggregate_type, aggregate_id, aggregate_seq)` | `RuntimeStateMachine.appendPlatformFact` |
| `event_outbox` | `outbox_id`, `partition_key`, `event_id`, `status`, `lease_id`, `next_attempt_at` | `(partition_key, status, next_attempt_at)` | `OutboxPublisher.enqueue` |
| `event_inbox` | `inbox_id`, `consumer_id`, `event_id`, `dedupe_key`, `status`, `processed_at` | unique `(consumer_id, event_id)`, unique `(consumer_id, dedupe_key)` | `EventInbox.consumeOnce` |
| `budget_ledger` | `ledger_id`, `subject_id`, `limit_amount`, `allocated`, `reserved`, `settled`, `currency`, `period` | unique `(subject_id, period)` | `BudgetAllocator.allocate/settle` |
| `budget_reservation` | `reservation_id`, `harness_run_id`, `node_run_id`, `bucket_id`, `amount`, `currency`, `status` | `(bucket_id, status)`, `(harness_run_id, status)` | `BudgetAllocator.reserve/release/settle` |
| `side_effect` | `side_effect_id`, `node_run_id`, `external_idempotency_key`, `status`, `confirmation_ref`, `compensation_ref` | unique `(connector_id, external_idempotency_key)` | `SideEffectManager` |
| `approval_request` | `approval_id`, `harness_run_id`, `node_run_id`, `route_snapshot_id`, `status`, `expires_at` | `(status, expires_at)` | `HITLRuntime` |
| `human_responsibility_record` | `responsibility_id`, `approval_id`, `principal_id`, `decision_type`, `scope`, `evidence_ref` | `(principal_id, decision_type)` | `HITLRuntime.recordResponsibility` |
| `audit_record` | `audit_id`, `principal_id`, `action`, `resource_ref`, `evidence_ref`, `created_at` | `(principal_id, created_at)`, `(resource_ref)` | `AuditLogger` |

Any MVP schema PR must simultaneously provide migration, rollback, repository contract test, and `runtime-contracts` corresponding schema; cannot only modify database or only modify document.

---

# 27. Performance Architecture and SLO

v4.2 splits the metric calibration into three categories, to avoid P95/P99 mixing:

| Metric Type | Calibration | Purpose |
| --- | --- | --- |
| Internal Platform SLO | P99 | Platform internal components, scheduling, writing, recovery, projection |
| User-visible E2E SLA | P95/P99 by tier | User-perceived end-to-end experience, including LLM/tool provider latency |
| Provider Observed SLO | provider latency/error rate | LLM, tool, external system availability and routing basis |

## 27.1 OAPEFLIR Stage Performance Goals

| Stage     | P99 Goal     | Description                                |
| -------- | ------------ | ----------------------------------- |
| Observe  | < 50ms       | Signal collection and aggregation (excluding external calls)      |
| Assess   | < 30ms       | Evaluation decision (excluding LLM calls)           |
| Plan     | < 100ms      | DAG construction and policy selection (excluding LLM calls) |
| Execute  | Depends on tool | Constrained by external dependencies, no unified target        |
| Feedback | < 10ms       | Signal preprocessing and deduplication                    |
| Learn    | < 500ms      | Pattern detection (async, does not block main chain)        |
| Improve  | < 1s         | Candidate generation (async)              |

## 27.2 Runtime SLO

The following SLO is the target for D3/S3b and above deployment; D1/D2 must not be blocked by Enterprise P99. MVP acceptance prioritizes functional correctness, state consistency, replay availability, and steady-state thresholds.

| Metric                 | P99 Goal | Degradation Threshold                 |
| -------------------- | -------- | ------------------------ |
| Dispatch latency     | < 200ms  | > 1s triggers alert            |
| Lease acquisition    | < 50ms   | > 200ms triggers alert         |
| Heartbeat round-trip | < 100ms  | > 500ms marks unhealthy   |
| Recovery detection   | < 30s    | > 60s triggers SEV3 incident |
| Projection lag       | < 5s     | > 30s triggers rebuild       |
| Checkpoint write     | < 20ms   | > 100ms triggers alert         |
| Event append         | < 10ms   | > 50ms triggers alert          |

## 27.8 Deployment-tier SLO Matrix

| Metric | D1 Monolith / MVP | D2 Worker Separation | D3 Plane Separation | S4 Cluster / Enterprise |
| --- | --- | --- | --- | --- |
| Event append P99 | Functional correct + <100ms steady state | <50ms | <20ms | <10ms |
| Checkpoint write P99 | Functional correct + <200ms steady state | <100ms | <50ms | <20ms |
| Lease acquisition P99 | <200ms | <100ms | <50ms | <30ms |
| Dispatch latency P99 | <1s | <500ms | <200ms | <100ms |
| Projection lag P99 | <30s | <15s | <5s | <3s |
| Trace Replay rebuild | Can rebuild single run | Can rebuild batch runs | Can rebuild projection slice | Can support audit batch replay |

D1 only promises single-tenant controlled production; regulated/high-risk domains must be D3+, cross-Region SLA must be S4 + §52 multi-Region rules.

## 27.3 Availability Goals

| Component            | Availability | Degradation Strategy                  |
| --------------- | ------ | ------------------------- |
| API Gateway     | 99.95% | Static error page                |
| Control Plane   | 99.9%  | Read-only degradation     |
| Execution Plane | 99.9%  | Worker pool failover      |
| State Plane     | 99.95% | WAL + checkpoint recovery; 99.99% requires auto failover + quorum + warm standby |
| Observability   | 99.5%  | Can drop metrics, cannot drop audit      |

## 27.4 Capacity Planning

| Dimension          | S1 Monolith    | S2 Multi-process   | S3a Distributed | S3b Distributed | S4 Cluster |
| ------------- | ---------- | ----------- | ---------- | ---------- | ------- |
| Concurrent workflows | 10         | 50          | 200        | 500        | 1000+   |
| Active workers   | 5          | 20          | 50         | 100        | 200+    |
| Event/s       | 100        | 500         | 2,000      | 5,000      | 10,000+ |
| Storage          | 1GB SQLite | 10GB SQLite | 50GB PG    | 100GB+ PG  | PG sharding |

## 27.5 Performance Test Requirements

- Must run load test before each major change
- Load test scenarios: normal load / peak load / degradation / recovery
- Results are recorded as evidence, associated with rollout

## 27.6 Error Budget Strategy

> Define organizational response when SLO is violated.

**Error Budget Definition**: Availability SLO 99.9% → monthly Error Budget = 43.2 minutes of unavailable time.

| Budget Consumption | Status | Response                                      |
| ----------- | ---- | ----------------------------------------- |
| 0-50%       | Normal | Normal release rhythm                              |
| 50-80%      | Warning | Slow down non-urgent change releases                        |
| 80-100%     | Frozen | Only allow fix releases, suspend feature rollout    |
| > 100%      | Exceeded | Full freeze + dedicated reliability fix + management review |

**Burn Rate Alert**:

- 1h burn rate > 14.4x (consume 2% budget in 1h) → SEV2 alert
- 6h burn rate > 6x (consume 5% budget in 6h) → SEV3 alert
- Use multi-window strategy to reduce false positives

## 27.7 LLM Latency Decomposition

LLM calls usually dominate end-to-end latency. Must model separately:

| Latency Component                        | P99 Goal | Description                                   |
| ------------------------------- | -------- | -------------------------------------- |
| Prompt rendering                     | < 5ms    | Template filling + variable injection                    |
| ModelGateway routing               | < 10ms   | Provider selection + budget check               |
| LLM TTFT (Time to First Token) | < 2s     | Provider SLA, uncontrollable                   |
| LLM complete generation                    | < 30s    | Depends on output length, set max_tokens limit |
| Response parsing + verification            | < 20ms   | JSON parse + Zod verification                  |
| Total LLM call                     | < 35s    | Exceed then timeout                         |

**LLM latency is not counted in Internal Platform SLO**, but must be counted in User-visible E2E SLA, and independently monitored as Provider Observed SLO. When LLM P99 latency > 200% of baseline, trigger ModelGateway degradation strategy (see §15.4).

---

# 28. Event Registry / Projection / Incident / DLQ Model

## 28.1 Event Registry Design Principles

Event Registry is the platform's registration table for fact events and OAPEFLIR semantic view events' types, payload schema, replay behavior, and projection consumption rules. All events must be verifiable, replayable, dedupable, and traceable.

Hard rules:

- Fact event names use `platform.object.action`, e.g., `platform.node_run.succeeded`; OAPEFLIR can only use `oapeflir.view.*` or `oapeflir.rationale.*`, must not use truth-like `oapeflir.node.*`, `oapeflir.side_effect.*`, `oapeflir.budget.*`.
- Each event must declare schemaVersion, aggregateId, runId, sequence, traceId.
- Each event type must declare `source_of_truth`, `replayable`, `side_effect_safe_to_replay`, `schema_owner`, and `consumer_contract_tests`.
- Within run, sequence monotonically increases; consumer must deduplicate based on eventId.
- replayBehavior must be explicitly declared: `replay_as_fact`, `skip_side_effect`, `simulate`, `forbidden`.
- Event append is in the same transaction as truth update; outbox delivery failure enters DLQ, does not affect truth consistency.

## 28.2 Event Registry Layering and Compatibility Strategy

After v4.3, Event Registry is divided into three layers: `EventEnvelope` is the unified event envelope, `platform.*` retains platform-level fact events, `oapeflir.view.*` / `oapeflir.rationale.*` only carries OAPEFLIR semantic projection events. All layers share eventId, traceId, replayBehavior, schemaVersion, and projection subscription model, but the authoritative input of truth projection can only be platform facts.

| Layer | Event Scope | Purpose |
| --- | --- | --- |
| EventEnvelope | eventId, eventType, aggregateId, runId, sequence, traceId, schemaVersion, replayBehavior | Unified envelope and verification entry for all events |
| PlatformEvent (`platform.*`) | harness_run, node_run, tool_call, side_effect, budget, approval_flow, rollout, incident, dlq, cost, circuit_breaker, config | Source of fact for truth projection, incident, dashboard, billing, ops link |
| OapeflirViewEvent (`oapeflir.view.*` / `oapeflir.rationale.*`) | stage, graph, attempt, decision, hitl, memory, eval, learning, semantic_view | OAPEFLIR stage explanation, audit view, semantic projection; must not be used as truth source |

**Compatibility Mapping**:

| legacy / platform event | v4.2 fact event | OAPEFLIR Projection | Handling |
| --- | --- | --- | --- |
| workflow_run.created / failed / completed | platform.harness_run.created / failed / completed | oapeflir.view.run_lifecycle.* | truth projection consumes platform.harness_run; OAPEFLIR run event only serves as lifecycle explanation |
| step_run.* / execution.* | platform.node_run.* | oapeflir.view.node_lifecycle.* | New implementation uses NodeRun platform fact as truth; old step projection derived by adapter |
| step_attempt.* | platform.node_attempt.* | oapeflir.view.attempt_lineage.* | retry / redrive uniformly converted to AttemptLineage, OAPEFLIR only explains causal chain |
| tool_call.succeeded / failed | platform.tool_call.* | oapeflir.view.tool_output.* | Tool call facts retain platform events, node semantic projection derived by adapter |
| side_effect.proposed / committed | platform.side_effect.* | oapeflir.view.side_effect.* | After committed, still need confirmed / reconciliation to serve as success fact |
| decision.requested / approved | platform.decision.* / platform.approval_flow.* | oapeflir.rationale.decision.* / oapeflir.view.hitl.* | Auto decision and manual responsibility record split |
| rollout.* / eval.* | platform.rollout.* / platform.eval.* | oapeflir.view.eval.* | Release governance retains platform rollout, evaluation gate can derive OAPEFLIR eval projection |
| cost.* | platform.cost.* / platform.budget.* | oapeflir.view.budget.* | Financial billing and run budget facts retain platform events, OAPEFLIR only projects budget stage |
| circuit_breaker.* / config.changed | platform.* | None or oapeflir.view.stage.* | Not migrated into OAPEFLIR truth, only affects HarnessRun via OperationalDirective |

Migration hard rules: truth projection must prioritize subscribing to `platform.harness_run.*`, `platform.node_run.*`, `platform.side_effect.*`, `platform.budget.*` and other fact events; `oapeflir.view.*` / `oapeflir.rationale.*` can only be used for stage explanation, audit view, and semantic projection. Old projections, during migration period, derive legacy events from platform facts through adapter, adapter events must mark `derivedFromEventId`; the same fact must not be double-counted by platform and OAPEFLIR view.

## 28.3 OapeflirEvent Standard Structure

| Field | Type | Description |
| --- | --- | --- |
| eventId | string | Globally unique event ID |
| eventType | OapeflirEventType | Registry event type |
| schemaVersion | number | payload schema version |
| runId | string | Associated HarnessRun |
| nodeRunId | string? | Associated NodeRun |
| aggregateId | string | truth aggregate ID |
| sequence | number | within-run monotonic sequence number |
| occurredAt | ISO8601 | Occurrence time |
| principal | Principal | Trigger principal |
| traceId | string | Distributed tracing ID |
| payload | object | Event payload |
| replayBehavior | enum | Replay behavior |
| evidenceRefs | string[] | Associated evidence |

sequence is aggregate-local sequence, not global sequence number. Concurrent NodeRuns can only depend on sequence within the same aggregate to judge order; cross-aggregate can only use causationId, correlationId, traceId, and occurredAt to infer causality, does not promise total order.

## 28.4 OapeflirViewEventType Registry

| Namespace | Representative Event | Description |
| --- | --- | --- |
| oapeflir.view.run_lifecycle | created / admitted / paused / resumed / completed / failed / aborted | HarnessRun lifecycle projection event, does not represent independent OAPEFLIR run entity |
| oapeflir.view.stage | observing / assessed / planned / feedback_recorded / learned / improved / released | Eight-stage progress |
| oapeflir.view.graph | normalized / validated / validation_failed / risk_propagated / patch_applied | PlanGraph lifecycle |
| oapeflir.view.node_lifecycle | ready / leased / started / succeeded / failed / awaiting_hitl / reconciling | NodeRun semantic view |
| oapeflir.view.attempt_lineage | started / retry_scheduled / redriven / exhausted | AttemptLineage |
| oapeflir.view.budget | reserved / consumed / released / exhausted | Budget stage view |
| oapeflir.view.side_effect | proposed / approved / committed / ambiguous / confirmed / compensation_required | Side effect governance view |
| oapeflir.view.reconciliation | started / matched / diverged / unknown / expired | Reconciliation status view |
| oapeflir.rationale.decision | input_frozen / accepted / retry_requested / replan_requested / escalated / aborted | Decision Engine rationale |
| oapeflir.view.llm | response_recorded / schema_validated / guardrail_blocked | Recorded LLM output and validation result |
| oapeflir.view.tool_output | recorded / tainted / rejected | Recorded tool output and taint propagation |
| oapeflir.view.scheduler | decision_recorded / lease_assigned / ready_set_evaluated | Replayable scheduling decision view |
| oapeflir.view.hitl | lock_acquired / requested / approved / rejected / overridden / takeover / timed_out | HITL Runtime view |
| oapeflir.view.memory | write_requested / approved / rejected / promoted | Memory Governance view |
| oapeflir.view.eval | gate_started / gate_passed / gate_failed / regression_detected | EvaluationGate view |
| oapeflir.view.learning | candidate_created / quarantined / approved / rejected / released | LearningCandidate view |

## 28.5 Event Replay Semantics

Replay is divided into three categories:

| Type | Purpose | Side Effect Behavior |
| --- | --- | --- |
| projection_replay | Rebuild query model | Only apply projection, do not call external systems |
| trace_replay | Audit, incident review, debugging, projection rebuild | Replay recorded events / LLM output / Tool output / Scheduler decisions, do not initiate new calls |
| re_execution_replay | Regression test, Prompt comparison, tool migration simulation | Can re-call LLM / Tool, must mark nondeterministic, do not write production truth |

Default audit capability is Trace Replay, does not assume LLM can be deterministically replayed. Re-execution Replay output can only enter isolated evidence namespace, must not overwrite original HarnessRun evidence. Replay must never actually send emails, make payments, deploy, write external systems, or modify production environments. When external state needs to be verified, can only create ReconciliationRecord or manual review task.

## 28.6 Projection (9 of them)

workflow_run_projection · workflow_timeline_projection · approval_queue_projection · tool_usage_projection · worker_status_projection · incident_projection · artifact_catalog_projection · risk_action_projection · governance_projection

Projection must be idempotent · replay-safe · event_id dedupe · rebuildable · not write back to truth.

Projection rebuild process is fixed as: build shadow projection → compare counts/hash → cutover → retain old projection for rollback. During rebuild, API must return freshness/stale marker, must not silently read half-built projection.

## 28.7 Incident Constraints

incident must link to: affected workflows / executions / workers / rollout / repair jobs / replay jobs / evidence bundles / resolution record. v4.2 runtime incident must also associate HarnessRun runId, nodeRunId, attemptId, eventId, sideEffectId, or reconciliationId (if applicable).

## 28.8 DLQ Constraints

DLQ must have: category · reason · retry_count · first_failed_at · last_failed_at · operator_action_log · reopen_status. DLQ is not a trash can, must support inspect, redrive, discard with approval, and incident linking.

---

# 29. Knowledge / Memory / Artifact / Learning Boundaries

This section is managed by four contracts: `MemoryContract`, `KnowledgeTrustContract`, `ArtifactContract`, `LearningCandidateContract`. All four can be read by P3/P4, but only P5 truth/event/audit is the source of control fact.

## 29.1 Knowledge

Shared facts, rules, processes, stable patterns.

**Levels**: Personal → Team → Company

**Trust Level**: private_unverified → team_reviewed → official → authoritative

**Promotion**: personal → team → company. Retain lineage / reviewer decision / trust change / audit event.

In Knowledge contested state, can still be retrieved by default, but must lower trust, force display of dispute source, and prohibit as the sole basis for high/critical automatic execution. authoritative knowledge downgrade must emit `knowledge.trust_downgraded` event to notify consumers.

## 29.2 Memory

Runtime short-to-medium-term context. Will decay · will compress · will be overwritten · used for context assembly.

Memory is clearly divided into 6 layers: working → session → episodic → semantic → procedural → meta. Each layer has independent TTL, compression, and eviction strategy.

Default eviction order:

| Layer | Strategy |
| --- | --- |
| working | facts cannot be silently dropped; compress with loss report |
| procedural | never drop, summarize if needed |
| semantic | rank by trust + relevance + freshness |
| episodic | summarize first, then evict |
| session | bounded by session policy |
| meta | policy-controlled |

ContextAssembly must output `ContextTruncationReport`, recording compressed, excluded, down-weighted context refs, reasons, data level, and whether it affects high/critical decisions. working facts cannot be silently dropped; if token budget is insufficient, must require replan, summarize-with-evidence, or escalate.

## 29.3 Artifact

Execution output and large objects, do not undertake control truth responsibility. Associate with HarnessRun / NodeRun / NodeAttempt via reference (artifact_ref), not inlined into event.

Artifact must be immutable, content-addressed, and record hash, signature, creator, data_class, retention, legal_hold, provenance, and redaction policy. Object storage GC must not delete artifacts still referenced by event/audit/legal hold.

## 29.4 Learning

Extract candidate patterns from feedback. Learn does not directly change online behavior. LearningObject must go through Improve → Validation → Approval → Rollout to take effect.

LearningCandidate defaults to quarantine. Candidate samples must pass taint prevention, PII/secret scan, holdout deduplication, diversity check, and manual/evaluation approval; unpublished candidates must not affect production routing, Prompt, or Memory promotion.

---

# 30. Business Onboarding Constraints and Business Pack Model

> Business Pack must associate with DomainDescriptor(§37), Pack's risk control, knowledge retrieval, and evaluation strategy are driven by the domain descriptor.

## 30.1 Platform Capabilities Business Pack Cannot Bypass

policy engine · approval engine · lease / fencing · artifact ref · audit · event log · projection contract · **domain descriptor(§37)**

## 30.2 Each Business Pack Must Declare

> **Constraint**: `domain_id` is a required field, must point to a registered DomainDescriptor with Active status. Platform automatically verifies `domain_id` validity during Pack registration, and applies DomainRiskProfile's risk override on top of Pack's risk_matrix.

PackCapabilityProfile is a strong schema, must not be replaced with free text:

```yaml
PackCapabilityProfile:
  tools:
  side_effects:
  data_classes:
  max_risk_class:
  requires_human_roles:
  supported_execution_modes:
```

Pack / Plugin / Connector lifecycle boundary: Pack is the business capability package, Plugin is the extension code constrained by sandbox, Connector is the external system action boundary. Pack can depend on Plugin and Connector, but must not bypass Connector action-level risk profile or Plugin security authentication.

`BusinessPackManifest.v1` must be a strong schema, at least contains:

| Field | Description |
| --- | --- |
| pack_id / version | Pack identity and semver |
| domain_id | Associated Active DomainCoreDescriptor / DomainDescriptor |
| capabilities | Structured PackCapabilityProfile, free text not allowed |
| tools / connectors / plugins | Dependencies, version range, permission and sandbox requirements |
| side_effects | action-level SideEffect type, idempotency key, compensation and reconciliation strategy |
| data_classes | Processable data level, PII/secret/regulated labels |
| eval_requirements | Pre-release eval dataset, golden set, and denial-path tests |
| compatibility | platform_min_version, schema version, migration policy |

## 30.3 High-Risk Business Defaults to Supervised

operations · growth write actions · production release · finance-like actions → first stage defaults to supervised, full_auto not allowed.

Pack emergency disable strategy:

| Situation | Handling |
| --- | --- |
| new run | blocked |
| in-flight low risk | continue until next checkpoint |
| in-flight high risk | pause at checkpoint |
| critical security disable | abort immediately + revoke credentials |

## 30.4 Pack Lifecycle

> Define the complete process of Pack from development to deprecation.

| Phase | Description                                 | Requirements                     | Output                           |
| ---- | ------------------------------------ | ------------------------ | ------------------------------ |
| Development | Use Pack SDK for local development               | Follow Manifest schema     | Code + Manifest + eval dataset |
| Testing | Local mock test + staging integration test    | Coverage ≥ 80% + eval pass | TestReport                     |
| Certification | Security review + risk assessment + platform compatibility check | Pass Pack checklist       | CertificationRecord            |
| Release | Register to Pack Registry + rollout       | semver versioning            | RolloutRecord                  |
| Runtime | Execute under platform governance constraints                   | Continuous quality monitoring             | metrics + incidents            |
| Deprecation | Mark deprecated + migration guide           | Maintain at least 6 months          | DeprecationNotice              |

## 30.5 Pack API Compatibility Contract

- Pack Manifest schema follows semver: minor version only adds fields, major version allows breaking changes
- Platform upgrade must run Pack compatibility test suite
- Breaking changes issue deprecation warning 2 minor versions in advance
- Provide `agent-platform pack migrate` command to assist Pack upgrade

Pack compatibility test suite is owned by Platform SDK team, and generated by `PackCompatibilityTestGenerator` from Manifest, OpenAPI, Event Registry, Contract Schema, and declared capabilities. Each Pack release must save generator version, fixture version, and test report; if platform upgrade cannot generate or run compatibility suite, upgrade gate fails closed.

## 30.6 Plugin Governance

| Governance Dimension | Strategy                                      |
| -------- | ----------------------------------------- |
| Version management | semver + Plugin Registry                  |
| Dependency management | Declarative dependencies + conflict detection                     |
| Security certification | Automatic security scan + manual review (high-privilege plugin)  |
| Deprecation strategy | deprecated mark → 3-month migration period → archived |
| Compatibility   | Each plugin declares min_platform_version     |

---

# 31. Disaster Recovery and High-Availability Architecture

> Define high-availability strategy from single node to multi-AZ.

## 31.1 Single Point of Failure Elimination

| Component         | Single Point Risk | Elimination Strategy                                  |
| ------------ | -------- | ----------------------------------------- |
| API Gateway  | Process crash | Multi-instance + load balancing                         |
| Dispatcher   | Scheduling interruption | Leader election (lease-based)            |
| Worker       | Execution interruption | Lease timeout → auto reclaim                 |
| Event Poller | Event accumulation | Lease-based single instance + health check             |
| Database     | Data loss | WAL + scheduled backup / PG streaming replication |

## 31.2 High-Availability Tiers

| Tier      | Architecture                                 | RTO     | RPO           |
| --------- | ------------------------------------ | ------- | ------------- |
| HA-1 Basic | Single node + scheduled backup                    | < 1h    | < 15min       |
| HA-2 Standard | Dual node active-passive + WAL shipping | < 10min | < 1min        |
| HA-3 Enterprise | Multi-AZ active-passive / single leader + sync replication | < 1min  | 0 (sync replication) |

HA-3's RPO=0 only applies to in-region multi-AZ sync replication; cross-region failover defaults to RPO>0, and only allows metadata-only pre-replication or replication by data residency policy. Must not write cross-Region data residency scenario as RPO=0.

Each leader switch or failover must generate `FailoverRecord`, `FencingEpochChanged`, and `RecoveryValidationReport`. The new leader can only accept writes after fencing epoch is updated, old lease is invalidated, and truth/event consistency verification passes.

Cross-Region failover must also generate `FailoverReconciliationJob`, listing unreplicated writes, open budget reservations, ambiguous side effects, pending approvals, outbox gaps, and projection freshness watermark. Before this job completes, can only enter restricted write mode: prohibit irreversible side effect, budget upper limit raise, and policy relaxation.

Under read-only degraded mode, only retain query, audit export, forensic inspection, status dashboard, and manual recovery operations; prohibit new HarnessRun admission, external side effect, budget change, policy relaxation, and Pack release.

## 31.3 Backup and Recovery

- **Data Backup**: Use `.backup()` API for SQLite phase, pg_basebackup for PG phase
- **Event Replay**: Rebuild all projection and artifact catalog from event_log
- **Configuration Backup**: config_version table has its own history, can roll back to any
- **Disaster Recovery Drill**: At least once per quarter, record actual RTO/RPO values
- **Recovery Verification**: Each recovery must verify truth/event/projection count, hash, watermark, and sampled business objects, and write the report to Evidence Plane

DR drill pass/fail criteria:

| Check Item | Pass Condition |
| --- | --- |
| RTO/RPO | Actual value does not exceed declared tier |
| Fencing | Old leader cannot continue to write truth / budget / side effect |
| Event replay | After projection rebuild, hash, watermark, and sampled objects are consistent |
| Open obligations | budget reservation, pending approval, ambiguous side effect all have reconciliation results |
| Evidence | `RecoveryValidationReport` and operator signoff written to P5 |

Event replay does not assume infinite log retention. P5 must be retained in layers: truth/event minimum recoverable window, audit legal hold, artifact retention, projection rebuildable cache. GDPR / PIPL deletion is executed through tombstone, irreversible digest, and crypto-shredding; tombstone retains minimum audit fields, does not contain PII/PHI/secret, used during replay to prove the object has been deleted rather than restoring the original text.

## 31.4 Data Integrity Protection

- All write operations protected by CAS + Lease + Fencing
- Event log uses append-only mode, does not allow modifying historical events
- Checkpoint uses WAL protection, can recover after process crash
- Truth table and event log update in the same transaction

---

# 32. Deployment Architecture

> Adopt **monolith-first, progressive split** strategy.

## 32.1 Deployment Evolution

The deployment form must explicitly declare security isolation level, tenant isolation level, worker isolation level, supported risk tier, and not supported capabilities; must not describe the logical isolation of the monolith phase as production strong isolation.

### Phase D1: Modular Monolith

```text
┌─────────────────────────────────────────┐
│            Agent Platform (single process)        │
│                                          │
│  P1 Interface  ──→  P2 Control           │
│       │               │                  │
│       ▼               ▼                  │
│  P3 Orchestration ──→ P4 Execution       │
│       │               │                  │
│       ▼               ▼                  │
│          P5 State & Evidence             │
│                                          │
│        X1 Fabric (middleware)            │
│                                          │
│  [SQLite]  [Redis (optional)]            │
└─────────────────────────────────────────┘
```

Applicable to: Development, testing, small-scale production (≤10 concurrent). D1 only provides logical isolation, does not support regulated critical domains, untrusted third-party plugin, multi-tenant strong isolation, cross-tenant shared marketplace, and high-risk browser/database write automation.

### Phase D2: Worker Separation

```text
┌─────────────────────┐     ┌──────────────────┐
│   Main Process       │     │  Worker Process   │
│   P1 + P2 + P3 + P5 │────→│  P4 Execution     │
│   + X1               │     │  + tool executors  │
└─────────────────────┘     └──────────────────┘
        │
   [SQLite / PG]  [Redis]
```

Applicable to: Medium-scale production (≤50 concurrent), workers can scale horizontally. D2 supports worker-level isolation and partial high-risk pool, but does not promise multi-AZ disaster recovery, cross-Region failover, or third-party plugin strong sandbox.

### Phase D3: Plane Separation

```text
┌──────────┐  ┌─────────────┐  ┌──────────────┐
│ API GW   │→│ Control +     │→│ Execution    │
│ (P1)     │  │ Orchestration │  │ Workers (P4) │
└──────────┘  │ (P2 + P3)    │  └──────────────┘
              └─────────────┘
                    │
              ┌─────────────┐
              │ State (P5)   │
              │ [PostgreSQL] │
              └─────────────┘
```

Applicable to: Large-scale production (≤500 concurrent), each plane scales independently. D3 is the first to allow strong multi-tenant isolation, regulated high-risk domains, untrusted plugin sandbox, browser executor independent pool, and cross-AZ HA; before entering S4/Kubernetes multi-Region, must complete state migration drill and rollback plan.

| Deployment Form | security isolation | tenant isolation | worker isolation | supported risk tier | not supported capabilities |
| --- | --- | --- | --- | --- | --- |
| D1 | In-process logical isolation | Single tenant/weak multi-tenant | Shared worker | low/medium | critical regulated, untrusted plugin, strong multi-tenant |
| D2 | Process/worker isolation | tenant logical partition | Independent worker pool | low/high (limited) | Multi-AZ RPO/RTO, cross-Region, third-party strong sandbox |
| D3 | Service/network/pool isolation | tenant partition + policy enforcement | High-risk/browser/plugin pool isolation | high/critical (requires dedicated pool) | Global multi-Region truth failover |
| S4 | Kubernetes + multi-AZ + sharding | Strong multi-tenant + home region | Pod/Sandbox/dedicated pool | enterprise critical | Requires §52 multi-Region rules constraint |

## 32.2 Environment Division

| Environment     | Purpose           | Deployment Form           | Data Isolation                |
| -------- | -------------- | ------------------ | ----------------------- |
| dev      | Development debugging       | Local process /Docker   | No isolation, shared development DB     |
| test     | Unit/integration test  | CI environment, single node    | Test tenant data isolation        |
| staging  | Pre-release verification     | K8s single cluster         | Partitioned by tenant          |
| pre-prod | Formal release pre-graying-out | K8s multi-cluster         | Production-level isolation              |
| prod     | Formal production environment   | Multi-Region K8s cluster | Strong tenant isolation + cross-AZ disaster recovery |

**Environment Promotion Strategy**:

```
dev → test → staging → pre-prod → prod
```

- Code merged to main automatically deploys to dev
- PR passes deploys to test
- Release tag triggers staging deployment
- After pre-release verification, manually promote to pre-prod, then confirm prod

Each promotion must bind rollback runbook: rollback target version, schema rollback/forward-fix strategy, config rollback, worker drain, event consumer compatibility, projection rebuild, and customer impact notice. D1 → D2 → D3 evolution is not a unidirectional linear process; any environment's guardrail breach must allow rollback to the previous available deployment form or enter read-only degraded.

Emergency hotfix can bypass the regular wait window, but must not bypass security scan, schema compatibility, contract tests, dual approval, blast radius limit, and post-deploy verification. hotfix promotion must declare expiry, follow-up release, and evidence bundle; if not supplemented with formal release within the window, automatically trigger incident.

## 32.3 Resource Pool Isolation

Worker Pool implements multi-level isolation, ensuring that different risk levels and tenant businesses do not affect each other:

| Pool Name                 | Purpose                                   | Isolation Level | Resource Quota         |
| ------------------------- | -------------------------------------- | -------- | ---------------- |
| read-only worker pool     | Read-only operation tasks (data query, report generation)     | Low risk   | Shared but rate-limited       |
| write-enabled worker pool | Write operation tasks (state change, data modification)       | Medium risk   | Independent resource pool       |
| high-risk isolated pool   | High-risk operations (delete, batch modify, external call) | High risk   | Independent cluster + rate limit    |
| browser worker pool       | Browser automation tasks (Web scraping, UI test)  | Independent     | Independent worker process |
| plugin isolated pool      | Third-party plugin execution                         | Strongest isolation | Independent Pod/Sandbox |

**Isolation Principles**:

- **Network isolation** between different pools, cross-pool communication needs to go through API Gateway
- High-risk tenant can apply for **dedicated worker pool**, exclusive physical resources
- Inter-pool scheduling managed via **priority queue**, preventing low priority starvation
- All pools support **horizontal scaling**, auto-scaling based on queue depth
- Cross-process communication between Worker pool and P1/P2/P3/P5 must use mTLS + service identity; each worker lease binds identity, pool, capability, and fencing token. When identity does not match or certificate expires, must not pick up NodeRun.

---

# Part II — AI Operations Layer (§15-§23)

---

# 15. LLM Provider Abstraction and Failover Architecture

> Treat LLM as the platform's most critical external dependency, define provider abstraction, routing policy, and degradation mode when unavailable.

## 15.1 Design Principles

- Platform is not bound to any single LLM provider
- All LLM calls go through unified ModelGateway, upper layer does not directly call provider SDK
- ModelGateway is part of X1 Fabric, cross-cuts P3 Orchestration and P4 Execution
- LLM calls are treated as **high-risk external dependencies**, must have timeout, circuit breaker, fallback, cost tracking

## 15.2 ModelGateway Interface

ModelGateway is the only exit for all LLM calls, upper layer services are prohibited from directly calling provider SDK.

| Method         | Parameters                                                 | Return                              | Description                    |
| ------------ | ---------------------------------------------------- | ----------------------------------- | ----------------------- |
| `chat()`     | modelId, messages[], temperature, maxTokens, timeout | ModelResponse (choices + usage)     | Multi-turn dialogue, most common entry    |
| `complete()` | modelId, prompt, temperature, maxTokens, timeout     | ModelResponse (text + usage)        | Single completion, suitable for generation scenarios  |
| `stream()`   | modelId, messages/prompt, maxTokens, timeout, abortSignal | AsyncIterable<ModelStreamChunk> | Streaming output, chunk must carry sequence, usageDelta, finishReason, validationState |
| `embed()`    | modelId, input (string \| string[]), timeout         | EmbeddingResponse (vectors + usage) | Vectorization, for retrieval/similarity |

ModelResponse uniformly contains: `requestId`, `model`, `choices`, `usage { promptTokens, completionTokens, totalTokens, estimatedCost }` and `latencyMs`. ModelStreamChunk must support abort, incremental reserve/settle, and partial validation; resume can only recover transmission, must not treat unverified partial as business output. All calls automatically attach traceId, tenantId, costTag, and are incorporated into §18 cost metering.

## 15.3 Provider Registration and Routing

**Routing Policy**:

| Policy              | Applicable Scenario          | Description                             |
| ----------------- | ----------------- | -------------------------------- |
| priority          | Default              | Sort by priority, prefer highest priority |
| cost_optimized    | Batch/low priority task | Select lowest unit price available provider      |
| latency_optimized | Real-time interaction          | Select lowest P99 latency provider     |
| data_residency    | Compliance requirement          | Only select providers satisfying data residency    |
| capability_match  | Special capability          | Match required_capabilities       |

Provider routing must input the following constraints, must not select model only by price or latency:

```yaml
data_residency:
pii_input_detected:
pii_output_possible:
model_training_opt_out_required:
judge_independence_required:
latency_tier:
cost_tier:
```

## 15.4 Failover Chain

```text
Primary Provider
  │ timeout / error / circuit_open
  ▼
Secondary Provider (fallback)
  │ timeout / error / circuit_open
  ▼
Tertiary Provider (emergency)
  │ timeout / error / circuit_open
  ▼
Degradation Mode (see §15.5)
```

**Switching Rules**:

- Single request timeout (default 30s) → auto switch to next provider and retry
- Consecutive failures > 5 times (60s window) → trigger circuit breaker, provider marked as unhealthy
- All providers unhealthy → enter LLM Degradation Mode
- After provider recovery, automatically rise through half-open probe

## 15.5 LLM Unavailable Degradation Mode

When all LLM providers are unavailable, the platform must have a clear degradation strategy, rather than simply reporting an error:

| Degradation Level | Trigger Condition                          | Platform Behavior                                                  |
| -------- | ----------------------------------- | --------------------------------------------------------- |
| D0 Normal  | At least one provider healthy         | Normal routing                                                  |
| D1 Limited  | primary down, secondary available | Auto switch + alert + limit new workflow startup rate                |
| D2 Cache  | All providers unhealthy, cache available | Return cache result for exact cache hit; semantic cache not used for MVP by default        |
| D3 Static  | Cache unavailable                        | Use preset static fallback plan (low-risk tasks only)           |
| D4 Pause  | All degradation unavailable                    | Pause all new workflows, protect in-flight workflow checkpoint, handoff to human |

**Cache Design**:

- `ExactPromptCache`: Based on `prompt_ref + canonical params hash + model routing constraints`, only hits when input is fully normalized and consistent
- `SemanticCache`: Based on embedding similarity + safe class + human-approved domain; must have similarity threshold, tenant/data domain isolation, cache poisoning prevention, and manual approval
- MVP defaults to only implementing ExactPromptCache, prohibits using "semantic similar request reuse" as deterministic cache use
- TTL is graded by data_classification: public=1h, internal=15min, confidential=do not cache
- Cache hit must mark `cached: true`, not counted into model quality evaluation

Cache warming is part of the startup gate: After each release, provider failover, or model route change, the platform must warm up health prompt, critical static fallback plan, low-risk template, and contract test prompts. If cache is not warmed up, D2/D3 must not be counted as available degradation capability in SLA; can only be marked as `degradation_unready` and enter D4/HITL path.

## 15.6 Streaming Response and Error Handling

Additional constraints for `ModelGateway.stream()`:

| Concern         | Handling Strategy                                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Stream interruption         | Received tokens can only be saved as partial artifact; usability is determined by Output Completeness Validator, must not use length ratio heuristic                              |
| Token limit pre-check | Before sending, estimate input token count based on `ModelRequest.messages`, if > provider's `context_window - max_tokens` then reject and return `TOKEN_LIMIT_EXCEEDED`   |
| Response format verification   | After stream completes, perform Zod schema verification on complete output; verification failure triggers one retry (with format reminder); second failure records as `llm.response.validation_failed` |
| Timeout           | Streaming first token timeout (TTFT > 10s) triggers provider switch; total time timeout executed by `ModelConstraints.max_latency_ms`                                       |
| Backpressure           | When consumer processing speed < production speed, pause stream reading (backpressure), do not drop token                                                                        |

## 15.8 Output Completeness Validators

Streaming partial response can only enter subsequent execution after passing format-aware integrity verification; otherwise can only serve as debug artifact, must not be used for PlanGraph, SQL, code, decision, or side effect.

| Output Type | Integrity Verification |
| --- | --- |
| JSON / schema output | JSON parse success + Zod/schema valid |
| PlanGraphBundle | graph schema valid + at least one entry/terminal + terminal reachable |
| SQL | parser/AST parse success + read-only/write policy verification + statement complete termination |
| Code/Patch | AST or patch parser success + file boundary complete + test/scan gate runnable |
| Markdown / text | terminal marker or provider finish reason normal; low-confidence partial must be explicitly marked |
| HarnessDecision | Enumeration legal + DecisionInputBundle ref exists + precedence policy verifiable |

## 15.7 Observability

| Metric                     | Type      | Description                     |
| ------------------------ | --------- | ------------------------ |
| `llm.request.total`      | counter   | By provider/model/tenant |
| `llm.request.latency_ms` | histogram | By provider/model        |
| `llm.request.error_rate` | gauge     | By provider/error_type   |
| `llm.token.usage`        | counter   | By provider/model/tenant |
| `llm.cost.total`         | counter   | By provider/tenant       |
| `llm.cache.hit_rate`     | gauge     | Cache hit rate               |
| `llm.fallback.triggered` | counter   | Degradation trigger count             |

---

# 16. Prompt Management and Versioned Architecture

> Prompt is the "source code" of Agent, as a first-class architectural concern, defines storage, versioning, graying-out release, and rollback mechanism.
## 16.1 Design Principles

- Prompts are not inlined in code, but managed independently as **versioned resources**
- Each Prompt has a complete lifecycle: draft → review → staging → canary → stable → deprecated
- Prompt changes are equivalent to code changes and must pass the quality gate (see §17)
- The combination of Prompt and model forms the core of Agent behavior; both changes need coordinated management

## 16.2 Prompt Data Model

Each Prompt uses PromptTemplate as the storage unit, supporting multi-version management:

| Field        | Type                                                          | Description                               |
| ----------- | ------------------------------------------------------------- | ---------------------------------- |
| `promptId`  | string (ULID)                                                 | Globally unique identifier                       |
| `version`   | number                                                        | Incrementing version number, +1 on each change            |
| `role`      | enum: planner / generator / evaluator / system                | Identifies the purpose in Harness            |
| `content`   | string                                                        | Template body, using `{{variable}}` placeholders |
| `variables` | VariableDef[]                                                 | Variable name, type, required, default     |
| `metadata`  | object                                                        | Author, description, tags, expected token range  |
| `domainId`  | string                                                        | Owning business domain, controls visibility and permissions       |
| `status`    | enum: draft / review / staging / canary / stable / deprecated | Lifecycle status                       |

The same `promptId` can have multiple versions, but only one version is in `stable` state at any given time.

## 16.3 Release and Graying-Out

**Release Process**:

```text
draft → [review] → staging → [eval gate §17] → canary(5%) → canary(20%) → stable
                                                    │
                                                    ▼ (quality not met)
                                               rolled_back
```

- The staging phase must pass the eval gate (see §17)
- The canary phase runs in parallel with the stable version, with proportional traffic splitting
- During canary, continuously compare quality metrics of new and old versions
- Manual or automatic rollback to the previous stable version can be triggered at any time

## 16.4 Prompt Combination Management

An OAPEFLIR loop involves multiple stages of Prompts, which must be managed as **atomic combinations**:

**Constraint**: All stages within the same workflow run use the same PromptBundle version, no switching in the middle.

PromptBundle must declare `PromptBundleCompatibilityMatrix`, covering Tool schema, Evaluator schema, DomainDescriptor schema, and Model routing profile. rollback or revocation defaults to only affecting new runs; in-flight runs are protected by RunVersionLock, unless `BundleRevocationEvent` is triggered and goes through HITL / P2 emergency override.

`BundleRevocationSeverity`:

| severity | Impact Scope | Applicable Scenario |
| --- | --- | --- |
| soft_new_only | Only block new admission | Normal quality rollback |
| checkpoint_switch | Switch after next checkpoint revalidation | medium risk compatible fix |
| forced_pause | high/critical in-flight run paused and awaiting review | Injection, leak, bad canary |
| forced_abort | Immediately abort affected run | Confirmed security/compliance incident |

forced_pause / forced_abort must generate platform fact event, incident link, and affected HarnessRun list; must not silently change the Prompt semantics of already running nodes.

Full prompt logging follows `PromptLogRedactionPolicy`: secret, PII, and customer-proprietary payload in logs and artifacts must be desensitized or referenced first; it is prohibited to fully record sensitive prompts for debugging purposes.

## 16.5 Prompt Security and Injection Defense

### 16.5.1 Prompt Injection Defense Architecture

```text
User input / external data
    │
    ▼
┌──────────────────┐
│ Input Sanitizer  │  Regex + blacklist + Unicode normalization
├──────────────────┤
│ Injection        │  Classifier-based injection pattern detection
│ Detector (ML)    │  (system/user boundary confusion, instruction override, role impersonation)
├──────────────────┤
│ Prompt Assembler │  system/user/assistant segments strictly separated
│                  │  User content only injected into user segment, never into system segment
├──────────────────┤
│ Output Validator │  Detect exfiltration attempts in LLM output
│                  │  (URL injection, Markdown link leak, covert instruction relay)
└──────────────────┘
```

### 16.5.2 Defense Strategies

| Layer   | Strategy                 | Description                                                                           |
| ------ | -------------------- | ------------------------------------------------------------------------------ |
| Input layer | Variable Escaping    | All user input variables undergo XML/Markdown escaping before injection, eliminating control characters                       |
| Input layer | Boundary Markers     | system and user segments use LLM provider native role separation, not relying on text markers              |
| Detection layer | Injection Classifier | Lightweight classification model scores injection probability; can only trigger sanitize / escalate / require_human, must not alone serve as production hard deny |
| Detection layer | Canary Token         | Embed canary token in system prompt; if LLM output contains the token, judge as injection |
| Output layer | Output Sanitizer     | LLM output undergoes URL/link filtering, PII detection, instruction pattern detection                             |
| Audit layer | Full Prompt Logging  | Complete prompt rendered each time saved as artifact (confidential level and above can be optionally turned off)         |

`PromptInjectionDefenseChain` does not only belong to Prompt management, must be linked with Tool Guardrails, Egress Control, Context Assembly, and Output Validator. If Injection Classifier does not have training data, false positive rate, false negative rate, and update process records, it can only be used as auxiliary signal; blocking must be based on rules, permissions, data classification, egress, tool capability, sandbox, and least privilege engineering defense lines.

### 16.5.3 Basic Principles

- Prompt content is not exposed to end users (preventing information leakage)
- Prompt variables must be sanitized before injection
- Variables containing secret / PII are redacted in artifacts
- Historical assistant messages in multi-turn dialogue cannot be tampered with by users
- External tool return values are treated as untrusted input, also undergo sanitization before injection

---

# 17. Model Evaluation and Quality Gate Architecture

> An Agent platform without evaluation capability is equivalent to "going live naked". Define the quality gate framework for model/Prompt changes.

## 17.1 Evaluation Levels

| Level     | Trigger Timing                | Evaluation Content                   | Blocking Capability      |
| -------- | ----------------------- | -------------------------- | ------------- |
| Offline Evaluation | Prompt/Model change submission | Standard eval dataset regression test | Block release      |
| Graying-Out Evaluation | During canary             | Real-time quality comparison of new and old versions       | Auto rollback |
| Online Monitoring | Continuous operation                | Quality metric drift detection           | Trigger alert/degradation |

## 17.2 Eval Dataset Management

EvalDataset is the core input of the quality gate (§17.3), maintained independently by business domain:

| Field        | Type                         | Description                                         |
| ----------- | ---------------------------- | -------------------------------------------- |
| `datasetId` | string (ULID)                | Globally unique identifier                                 |
| `taskType`  | string                       | Associated task type (e.g., summarization, routing)  |
| `samples`   | Sample[]                     | Each includes input, expectedOutput, evalCriteria |
| `version`   | number                       | Dataset version, incremented after change                       |
| `domainId`  | string                       | Owning business domain                                   |
| `split`     | enum: train / eval / holdout | Dataset split, holdout only used for final release gate       |

**Management Requirements**: The eval set is graded by risk to determine minimum size; holdout set is only automatically called by quality gate, prohibited from use in development/debugging phases; dataset changes require domain_owner approval.

| Risk Level | Minimum Eval Samples | Additional Requirements |
| --- | --- | --- |
| low | ≥ 50 | Cover main paths and common failures |
| medium | ≥ 200 | Cover boundary input, permission denial, and cost anomalies |
| high | ≥ 500 | Add adversarial samples, manual annotation review, and regression holdout |
| critical | Domain expert set + adversarial set + holdout (recommended ≥ 1000) | Must include regulatory/security/misuse cases, manual signoff before release |

## 17.3 Quality Gate Rules

**Built-in Gate Rules**:

| Rule                 | Condition                | Description                              |
| -------------------- | ------------------- | --------------------------------- |
| regression_pass_rate | >= 95%              | eval dataset pass rate not lower than baseline     |
| critical_case_pass   | == 100%             | Cases marked critical must all pass |
| latency_regression   | <= 120% of baseline | Latency not exceeding 120% of baseline             |
| cost_regression      | <= 150% of baseline | Cost not exceeding 150% of baseline             |
| quality_score_delta  | >= -0.05            | Quality score not lower than baseline by 5 percentage points       |

Release gate must satisfy all of the following simultaneously:

```text
offline_eval_pass
critical_case_pass
online_canary_no_regression
domain_owner_approval
rollback_plan_present
```

## 17.4 Online Quality Monitoring

**Drift Detection**:

- Sliding window (1h/24h) statistics of quality distribution
- When 24h window quality mean drops > 10%, trigger SEV3 alert
- When 1h window quality mean drops > 20%, trigger auto-degradation to supervised mode
- All quality signals written to P5 Evidence Plane, supporting pattern extraction in Learn stage

## 17.5 LLM-as-Judge

For quality scenarios that cannot be judged by rules (such as "is the answer reasonable"), use LLM-as-Judge:

- Judge independence graded by risk: low can use same model; medium must use different model; high must use different model family; critical must use different provider + deterministic checks
- Judge result cache (same input+output not repeatedly evaluated)
- Judge call itself has cost budget limit (see §18)
- Judge evaluation results incorporated into quality gate, but can only supplement quality judgment, not override deterministic failure
- LLM-as-Judge cannot serve as regulatory-level evidence, only as auxiliary quality signal; regulatory, financial, healthcare, legal, and other critical conclusions must bind to deterministic checks, manual signoff, or external authoritative evidence

When Judge provider, judge model family, or Evaluation Harness is unavailable, canary must not continue auto-ramp. low/medium risk can degrade to D1 deterministic checks + manual sampling; high/critical must pause canary, retain old version, or rollback, until independent judge recovers and completes evaluation evidence.

**Non-overridable failures**: policy deny · schema validation failure · budget exhausted · security violation · state-machine invalid · replay mismatch · event append failure · side effect ambiguous · secret / PII leakage. When any non-overridable failure appears, EvaluationGate must fail closed; LLM-as-Judge must not pass it as approved through weighted average, manual invisible threshold, or secondary review.

---

# 18. Cost Management and Token Metering Architecture

> LLM call cost dominates platform OPEX. Define tenant-level metering, budget enforcement, and chargeback mechanisms.

## 18.1 Metering Model

**Metering Point**: ModelGateway synchronously writes UsageRecord after each LLM call completes, as provider usage evidence. Run budget facts are based on BudgetLedger / BudgetSettlement; chargeback is based on settlement as financial fact, provider invoice and UsageRecord are only used for reconciliation, must not reversely raise budget hard cap.

`UsageRecord` must support multi-currency, internal compute, human review, and provider invoice reconciliation:

| Field | Description |
| --- | --- |
| currency | Original fee currency |
| fx_snapshot | Exchange rate, source, and time used when converting to base_currency |
| cost_source | provider_invoice / internal_compute / human_review / storage / egress |
| provider_invoice_reconciliation_id | Reference for reconciliation with provider invoice or internal billing |

## 18.2 Budget Levels

| Level    | Budget Subject           | Control Granularity             | Over-Budget Behavior                         |
| ------- | ------------------ | -------------------- | ---------------------------------- |
| Platform-level  | Entire platform           | Monthly total             | SEV1 alert + new workflow pause       |
| Tenant-level  | Single tenant        | Monthly quota             | Alert + that tenant workflow queue slowdown |
| Pack-level | Single Business Pack | Per workflow upper limit   | That workflow degrades to supervised      |
| Step-level | Single step          | Per step token/cost upper limit | step abort + replan                 |

## 18.3 Budget Enforcement

```text
ModelRequest
  → estimate cost / tokens / duration
  → atomic reserve
    → If used + reserved + estimate > limit → reject request / degradation strategy
  → Execute LLM call
  → settle actual
  → release unused reservation
```

Budget enforcement must use atomic reservation to prevent concurrent LLM / Tool / Replan from breaking through the upper limit between check and consumption. Standard process:

```text
estimate → atomic reserve → execute → settle actual → release unused
```

BudgetReservation state machine:

```text
reserved → settled
reserved → partially_settled → settled
reserved → released
reserved → expired
reserved → cancelled
```

Key fields: reservationId, subjectId, runId, nodeRunId, attemptId, resource_type, estimatedCost, estimatedInputTokens, estimatedOutputTokens, expiresAt, status, settledCost, releasedCost, traceId. `resource_type` must be money / model_tokens / context_tokens / output_tokens / tool_calls / human_review / duration_ms. Reservation expiration is released by Sweeper, release and event write must be in the same transaction. Sweeper must use database time or monotonic lease time, and retain clock skew safety margin; must not release active reservations early due to a single worker's local clock being fast.

Concurrent budget arbitration must be done within BudgetLedger, example SQL:

```sql
UPDATE budget_ledger
SET reserved = reserved + :estimate
WHERE subject_id = :tenant_id
  AND used + reserved + :estimate <= limit;
```

Affected hard upper limits must be split into `max_cost`, `max_model_tokens`, `max_context_tokens`, `max_output_tokens`, `max_steps`, `max_duration_ms`. `max_cost` cannot replace token or latency upper limits.

Hot tenant budget ledger must support `BudgetAllocator` + `budget_sub_ledger` / `reservation_shard`, e.g., `tenant_monthly_budget → tenant_budget_bucket[0..N]`. The atomic boundary of global hard cap is in BudgetAllocator, not within each bucket; Allocator first allocates quota to buckets, buckets can only atomic reserve within allocated quota, periodic reconciliation is only used for calibration and reclaim, must not replace hard cap check.

BudgetAllocator hard rules:

```text
tenant hard cap
  → allocator atomic allocate bucket quota
  → bucket atomic reserve
  → settle/release
  → allocator reclaim unused quota
```

Any bucket reservation must not cause `allocated_total > tenant_limit`; Allocator write hotspot can be partitioned for read, but quota commit must go through single leader / fencing protection. For streaming LLM or segmented tool execution, must do incremental reserve / settle every N tokens or every provider chunk; over limit must stop generation and record partial output as debug artifact, must not enter PlanGraph, code, SQL, decision, or side effect. All streaming partial settlement must record `reservation_estimation_error_metric`; underestimation triggers overrun_policy, when overestimation causes false exhaustion, must be able to auto-release or re-estimate.

## 18.4 Chargeback Reports

- Aggregate by tenant / pack / model / provider dimension
- Daily + monthly reports auto-generated
- Support export to CSV / JSON
- Integrate with Admin API: `/api/v1/admin/cost-reports`
- Reports must simultaneously display original currency, base currency, FX snapshot, and invoice reconciliation status, to avoid multi-currency cost being untraceable during audit

## 18.5 Cost Optimization Strategies

| Strategy           | Description                                         | Applicable Scenario               |
| -------------- | -------------------------------------------- | ---------------------- |
| Prompt cache    | ExactPromptCache by default; SemanticCache only for human-approved safe domains (see §15.5) | read-only / low-change scenarios |
| Token budget trimming | Auto compress memory/knowledge input when context is too long           | Large context tasks           |
| Model downgrade     | Auto select low-cost model for low-risk tasks               | background queue       |
| Batch merging       | Merge multiple similar steps into one LLM call            | Batch analysis scenarios           |

---

# 19. Inter-Agent Delegation and Collaboration Architecture

> Complex enterprise tasks require multiple Agents to collaborate. Define inter-Agent delegation protocol, context transfer, and authorization model.

## 19.1 Delegation Model

Agents perform task dispatching through standard delegation protocol, supporting three modes:

| Mode     | Description                                             |
| -------- | ------------------------------------------------ |
| Synchronous delegation | Delegator blocks waiting for delegatee's result, suitable for short-time subtasks |
| Asynchronous delegation | Delegator continues execution after submission, gets result via callback or polling     |
| Broadcast delegation | Delegator initiates requests to multiple Agents simultaneously, aggregates best result    |

Delegation request (DelegationRequest) contains: delegator (delegator ID), delegate (delegatee ID), taskScope (task scope), constraints (constraint conditions), timeout (timeout limit). Delegation receipt (DelegationReceipt) contains: result (execution result), telemetry (telemetry data), artifacts (output list). All delegation chains must comply with the topology constraints in §19.2.

Delegation state machine:

```text
created → capability_discovery? → task_proposal → bid/decline? → award? → accepted/rejected → child_run_created → running → reported → verified → closed
                                                                                              ├→ timed_out
                                                                                              └→ cancelled
```

Delegation messages must carry `messageId`, `idempotency_key`, `delegationId`, `parentRunId`, `childRunId`, `sequence_no`, `expectedPreviousSequence`, `capabilityIntersection`, `budgetCap`, `dataBoundary`, and `deadline`. Out-of-order, duplicate, budget overflow, or empty capability intersection is rejected for delegation. The scope of `idempotency_key` is parentRunId + delegationId + message type; duplicate messages only return original processing result, must not repeatedly deduct budget, repeatedly create child run, or repeatedly settle.

If multi-candidate bidding is needed, must use independent discovery/bid/award process: `capability_discovery → task_proposal → bid/decline → award → accept → child_run_created → report → verify → close`. Default delegation protocol does not include child proactive offer, avoiding out-of-order semantics before parent has selected child. Broadcast delegation must declare `AggregationPolicy = first_valid | best_score | majority | human_arbitration`; without aggregation strategy, must not auto-select result.

When delegation deadline expires, must enter `timed_out` terminal state, release child run's unused budget, close pending approval, cancel incomplete bids, and append `delegation.timed_out` event to parent run. When broadcast delegation does not reach quorum, handle according to `AggregationPolicy`'s `quorum_failure_policy = abort | best_available | human_arbitration | retry_once`; lost bids' discovery / proposal token cost is counted into parent run, must not lose cost attribution.

## 19.2 Delegation Topology Constraints

- **Depth Limit**: Maximum delegation chain depth = 3 (preventing infinite recursion)
- **Interaction with Goal Decomposition**: Goal decomposition engine (§40) recursion depth upper limit = 5, delegation chain maximum depth = 3, but the two must not multiply to expand. Platform implements **global call depth hard upper limit = 8** (`call_depth` field propagates with trace), each decompose, delegate, or enter subgraph +1; when any local or global upper limit triggers, reject new delegation and trigger escalation
- **Cycle Detection**: The same pack_id cannot appear twice in the same delegation chain
- **Isolation**: Child workflow has independent lease, independent checkpoint, does not share state with parent workflow
- **Budget Inheritance**: Child workflow budget is deducted from parent workflow's remaining budget
- **Permission Shrinking**: Child workflow permissions ≤ parent workflow permissions (least privilege principle)

## 19.3 Context Transfer Security

- Parent → child: Only transfer references declared in DelegationContext, not original data
- Child → parent: Only return through DelegationResult, containing summary, artifact_refs, trust_level, taint_labels, evidence_refs, and policy_outcome
- Cross-tenant delegation: Prohibited by default, requires explicit P2 authorization
- Data classification upward compatibility: Child workflow output data classification ≥ input data classification

## 19.4 Collaboration Modes

| Mode     | Description                          | Applicable Scenario          |
| -------- | ----------------------------- | ----------------- |
| Serial delegation | A delegates to B, continues after B completes     | Simple subtask        |
| Parallel fan-out | A simultaneously delegates to B1/B2/B3, aggregates results | Parallel analysis          |
| Pipeline     | A → B → C, chain transfer           | Multi-stage processing        |
| Negotiation     | A and B alternately execute, sharing context   | Code review + fix |

## 19.5 Multi-Agent Collaboration Protocol (Agent Collaboration Protocol)

When the platform evolves from single Agent Runtime to multi-Agent Runtime, there must be a standardized collaboration protocol to prevent permission leakage, budget out of control, and audit chain break. This protocol defines message types, mandatory fields, and non-violation rules, executed in coordination with §45 Harness Runtime and §19.2 delegation topology constraints.

### Message Types

| Message Type             | Direction           | Semantics         | Trigger Condition                              |
| -------------------- | -------------- | ------------ | ------------------------------------- |
| `capability_discovery` | parent → candidates | Capability discovery | Only bidding/multi-candidate mode                    |
| `task_proposal`      | parent → child | Initiate task proposal | Planner decomposes subtask                  |
| `task_accept`        | child → parent | Accept delegation     | child evaluates capability, budget, permissions and replies      |
| `task_reject`        | child → parent | Reject delegation     | child capability/budget/permission insufficient              |
| `partial_result`     | child → parent | Intermediate result report | child completes phased output                  |
| `escalation_request` | child → parent | Request escalation     | child encounters decision exceeding autonomy authority          |
| `completion_report`  | child → parent | Task completion report | child completes all work                    |
| `verification_report` | parent → child/P2 | Verification result | parent verifies child result                     |
| `close_notice`       | parent → child | Close delegation     | Result accepted or terminated                      |
| `takeover_notice`    | parent → child | Takeover notification     | parent takes over subtask due to timeout/exception/manual intervention |
| `bid`                | child → parent | Bid response     | Only used in discovery/bid/award mode       |
| `decline`            | child → parent | Bid rejection     | Only used in discovery/bid/award mode       |
| `award`              | parent → child | Award bid     | parent selects child from multiple bids        |
| `child_run_created`  | child → parent | Child run created  | child has created controlled HarnessRun           |

### Mandatory Fields

Each collaboration message must carry the following fields, missing any field will cause the message to be rejected:

| Field                | Type         | Source                      | Purpose                                |
| ------------------- | ------------ | ------------------------- | ----------------------------------- |
| `correlation_id`    | UUID         | First task_request generated    | Associate all messages in same collaboration session          |
| `parent_run_id`     | HarnessRunId | §45.13 HarnessRun         | Associate parent execution context                  |
| `depth`             | uint8        | Inherited from §19.2 global call depth | Prevent recursion explosion (≤ call_depth hard cap) |
| `sender_agent_id`   | AgentId      | Sender                    | Identity identification and audit                      |
| `receiver_agent_id` | AgentId      | Receiver                    | Routing and permission verification                      |
| `domain_id`         | DomainId     | §37 DomainDescriptor      | Domain-level policy matching                        |
| `risk_level`        | RiskScore    | Highest risk operation in message payload    | Trigger approval/HITL                       |
| `budget_remaining`  | TokenBudget  | Inherited from parent budget            | Prevent child Agent overspending                   |
| `trace_id`          | TraceId      | §12 Distributed Tracing        | Full-link observability                      |

### Collaboration Invariants

The following rules are enforced by Harness Runtime when sending and receiving messages, violating any rule causes the message to be rejected and triggers Incident:

| #   | Rule                                                                                  | Verification Timing             | Violation Consequence                 |
| --- | ------------------------------------------------------------------------------------- | -------------------- | ------------------------ |
| C1  | Child Agent must not expand permissions—child.permissions ⊆ parent.permissions                         | At task_accept       | Reject delegation + alert          |
| C2  | Child Agent must not elevate risk mode—child.risk_mode ≤ parent.risk_mode                         | At task_accept       | Reject delegation + alert          |
| C3  | Child Agent must not bypass parent ConstraintPack—child.constraints ⊇ parent.constraints       | At task_request construction  | Message rejected                 |
| C4  | Child Agent output must be reviewable by parent Evaluator—completion_report must include evidence field | At completion_report | Result not adopted             |
| C5  | Any takeover must write audit—takeover_notice triggers immutable audit record                      | At takeover_notice   | Platform forces write (cannot skip) |
| C6  | budget_remaining must not exceed parent remaining budget                                             | At task_request      | Message rejected                 |
| C7  | depth must not exceed call_depth hard cap (defined in §19.2, default 8)                              | At task_request      | Message rejected + escalation    |

### Relationship with Existing Architecture

- **§19.1-19.4**: This protocol upgrades the existing delegation model from "convention" to "mandatory protocol", all delegation messages must follow the format in this section
- **§45 Harness Runtime**: HarnessLoopController automatically constructs task_request conforming to this protocol when initiating subtasks
- **§58.6 HarnessDecision**: Child Agent's Evaluator decision is returned through completion_report, parent Evaluator can perform secondary decision on it
- **§12 Exception Event Handling**: Collaboration message timeout/rejection/violation all map to Incident, go through unified alert routing

---

# 20. Long-Running Task and Workflow Sleep Architecture

> In enterprise scenarios, workflows may last hours or even days (waiting for approval, waiting for external system callbacks). Define sleep/wake mechanism.

## 20.1 Long-Running Task Classification

| Type     | Duration  | Reason                    | Example               |
| -------- | --------- | ----------------------- | ------------------ |
| Approval wait | Minutes → days   | HumanWait executor blocks | High-risk operation approval     |
| External callback | Minutes → hours | Wait for third-party system completion        | CI/CD build complete callback |
| Scheduled | Specific time  | Wait for specific time window        | Non-working hours execution     |
| Multi-stage   | Days → weeks     | Business process multi-stage approval      | Release approval chain         |

## 20.2 Workflow Sleep Mechanism

**Sleep Process**:

1. NodeRun enters wait state → create complete checkpoint
2. Release worker lease (worker no longer occupied)
3. Create HibernationRecord, register wake_conditions
4. HarnessRun state set to `paused` or `hibernated`
5. All in-memory context persisted to P5

**Wake Process**:

1. wake_condition satisfied → WakeEngine triggers
2. Execute `ResumeCompatibilityCheck`
3. Restore workflow context from checkpoint
4. Re-apply worker lease
5. Continue execution from breakpoint

`ResumeCompatibilityCheck` must cover: RunVersionLock, Prompt/Model/Tool/Policy version lock, DomainDescriptor/Domain Spec version, connector auth and action schema, secret lease reacquire, approval validity, budget reservation refresh, external callback signature, policy diff, provider/model/prompt deprecation. Any high/critical compatibility failure must enter `require_revalidation` or `abort_on_resume`, must not silently continue.

`ResumeCompatibilityCheck` must have total timeout (default 30s, can be tightened or relaxed to maximum 5min by domain policy). Check timeout must not default to recovery; must enter `resume_check_timed_out`, and choose supervised resume, require_revalidation, or abort_on_resume according to risk tier. Runs that hibernate longer than DomainDescriptor compatibility window must force generate `ResumeDiffReport`, decided by owner for migration, replanning, or termination.

MVP only promises approval_request + checkpoint supports basic HITL wait and safe recovery after process restart; general long-term sleep, complex wake_conditions, calendar timer, and provider callback resume enter Hardening, and require independent `hibernation_record` / timer tables. If a deployment does not enable hibernation_record, long-term waits exceeding checkpoint TTL must enter `paused_requires_operator`, must not silently recover.

## 20.3 Persistent Timers

- Timers are persisted to database, not dependent on process memory
- TimerPoller (similar to outbox poller) periodically scans for expired timers
- Timers are not lost after process restart
- Timer precision: ± 30s (non-real-time system, does not pursue millisecond-level)
- IT operations, customer service, or trading control tasks requiring <30s SLO must declare `high_precision_timer=true`, use independent high-precision scheduler and smaller scan window; when not declared, must not promise sub-30s wake-up

## 20.4 TTL and Timeout Protection

- Each hibernation must have TTL (default 7 days, max 30 days)
- After TTL expires, execute timeout_action
- Extra-long workflows send `workflow.still_hibernated` health event every 24h
- Hibernations exceeding 50% of TTL trigger reminder notification
- **Extra-long approval scenarios**: Regulatory approval chains may need months, extended through `renewal` mechanism—auto request domain_owner confirmation for renewal 24h before TTL expires (each renewal maximum 30 days), total renewal count upper limit controlled by DomainGovernancePolicy(§37.9) `max_hibernation_renewals` (default 6, i.e., longest ~210 days), exceeding upper limit forces termination and notifies initiator

## 20.5 Cross-Deployment Security

- Checkpoint format backward compatible (versioned schema)
- When platform upgrades deployment, hibernated workflow is not affected
- If checkpoint schema is incompatible, workflow enters `recovery_needed` state, handled by Recovery Worker

---

# 21. Human-Machine Collaboration Mode Architecture

> Define complete HITL mode catalog.

## 21.1 HITL Mode Catalog

| Mode     | Description                             | Trigger Condition                 | Timeout Behavior           |
| -------- | -------------------------------- | ------------------------ | ------------------ |
| Single approval | One approver decides                   | risk_level ≥ high        | Timeout → escalate        |
| Multi-party approval | Multiple independent approvals, vote decision           | critical operation / cross-domain impact | Timeout → auto reject    |
| Delegated approval | Approver can delegate to others                 | Original approver offline           | Delegation resets TTL    |
| Iterative feedback | Person gives modification opinion, Agent redoes       | Output unsatisfied               | Terminate after max iterations |
| Collaborative editing | Person and Agent alternately modify same artifact | Code/document collaboration            | No timeout, manually end   |
| notification_only | Only notify, no approval needed                 | no-side-effect or low-risk reversible action | Auto-pass           |
| Circuit breaker manual | Transfer to manual decision when LLM unavailable           | D4 degradation mode (see §15.5)  | Manual timeout → abort   |

## 21.2 Approval Flow Engine

ApprovalFlow defines the complete execution structure of one approval:

| Field                | Type                                 | Description                                           |
| ------------------- | ------------------------------------ | ---------------------------------------------- |
| `flowId`            | string (ULID)                        | Approval flow unique identifier                                 |
| `steps`             | ApprovalStep[]                       | Ordered step list, supports sequential and parallel modes |
| `approvers`         | Dynamic resolution                             | Real-time calculation by §47 approval routing engine based on organization architecture        |
| `timeout_per_step`  | Duration                             | Single step timeout (default 24h), timeout triggers escalation      |
| `escalation_policy` | enum: upgrade_sev / delegate / abort | Timeout escalation policy                                 |
| `delegation_rules`  | DelegationRule[]                     | Proxy rules when not on site (see §47.3)                 |

Approval flow engine supports inter-step conditional branching (e.g., risk amount determines whether to add high-level approval), parallel joint sign-off (all must pass to release), and any-pass (one pass to release) three decision modes.

## 21.3 Iterative Feedback Loop

**Process**: Agent produces output → person reviews → gives guidance → Agent replan + redo → loop, until approve or reach max_iterations.

Collaborative editing uses strict turn-taking token by default, avoiding Agent and person simultaneously modifying the same artifact. Manual intervention commands must be standardized:

```yaml
interventionType: inspect | patch | override | takeover | resume
authority:
scope:
expiresAt:
auditReason:
```

After manual `takeover`, Agent must not continue autonomous execution, unless receiving scope-matching and unexpired `resume` DecisionDirective.

`notification_only` is not an approval bypass mechanism, can only be used for no-side-effect or low-risk reversible actions. Any writing truth, sending out data, submitting side effect, changing budget, expanding permission, or irreversible operation must use approval / HITL mode.

Approval delegation TTL reset must be constrained by `max_delegation_chain_length` and `max_total_approval_wait`; each delegation must re-execute ConflictOfInterestFilter, SoD check, and scope shrinking. After reaching chain length or total wait upper limit, can only escalate or abort, must not infinitely re-delegate.

## 21.4 Notification and Channels

| Channel                  | Purpose                | Integration Method           |
| --------------------- | ------------------- | ------------------ |
| Platform console            | Default approval interface        | Built-in               |
| Webhook               | External system integration        | Outbound HTTP          |
| Email                 | Async notification            | SMTP adapter       |
| IM (Slack/Feishu/WeChat Work) | Instant notification + quick approval | Webhook + callback API |

---

# 22. SDK and Developer Experience Architecture

> A platform without SDK cannot be adopted by business teams. Define Pack development toolchain and local development experience.

## 22.1 SDK Layering

| SDK Layer     | Audience   | Function                                        |
| ---------- | ---------- | ------------------------------------------- |
| Pack SDK   | Business developer | Create/test/publish Business Pack                |
| Plugin SDK | Plugin developer | Develop tool / adapter / retriever / evaluator |
| Client SDK | External integrator | Call platform Public API                         |
| Admin SDK  | Operations team   | Call Admin API, scripted operations                  |

## 22.2 Pack SDK Core Capabilities

Pack SDK provides business developers with a complete toolchain from creation to release:

| Capability             | Description                                                          |
| ---------------- | ------------------------------------------------------------- |
| Scaffold CLI     | `pack create` generates standard directory structure, Manifest template, and sample code       |
| Local Dev Server | Built-in lightweight runtime, supports hot reload, simulates P3/P4 execution flow               |
| Type-safe API    | Provides type-safe definition interface for Tool, Prompt, Eval, compile-time contract verification    |
| Test Harness     | Integrates MockModelGateway and MockToolExecutor, supports recording/replay testing  |
| Publish CLI      | `pack publish` one-click packaging, verify Manifest compliance and push to target environment |
| Versioning       | Based on semver automatic version management, mandatory changelog on release                |

MVP SDK scope is limited to: `create-pack`, `validate-manifest`, `run-local-simulation`, `generate-contract-tests`, `publish-dry-run`. Other IDE, Playground, marketplace release experience enter Hardening / Enterprise.

SDK compatibility contract:

| Field | Description |
| --- | --- |
| sdk_semver | SDK own semantic version |
| platform_min_version / platform_max_version | Supported platform version window |
| contract_test_generator | Generate contract tests based on Manifest / OpenAPI / Event Registry |
| plugin_sandbox_test_harness | Plugin sandbox, egress, secret, filesystem, and symlink denial-path tests |
| deprecation_policy | SDK API deprecation window, migration hints, and CI warning rules |

All SDK requests must send `X-Platform-Version`, `X-SDK-Version`, and `X-Contract-Version`. Platform performs version handshake before admission: below min version returns `upgrade_required`, exceeding max tested version returns `compatibility_warning` or requires dry-run; deprecated APIs can only be called within deprecation window, and return migration hint in response. SDK must not silently call legacy projection write paths.

## 22.3 Local Development Environment

- `agent-platform dev` — Start local platform (SQLite + in-process workers)
- `agent-platform pack create` — Create Pack scaffolding
- `agent-platform pack test` — Run Pack test (mock LLM + mock tools)
- `agent-platform pack validate` — Verify Manifest compliance
- `agent-platform pack publish --target staging` — Publish to staging environment

**Local Simulator**:

- Built-in MockModelGateway: Returns pre-configured LLM response, for deterministic testing
- Built-in MockToolExecutor: Simulates tool execution results
- Test recording/replay: Records real LLM calls as fixtures, subsequent tests replay (does not consume tokens)

record/replay fixture must auto-desensitize: redact secrets, hash PII, strip proprietary payload unless approved. Local simulation can only verify contract and deterministic logic, cannot prove production SideEffect safety.

## 22.4 Plugin Lifecycle

| Phase | Description                        | Requirements                     |
| ---- | --------------------------- | ------------------------ |
| Development | Local development + Plugin SDK       | Must declare PluginManifest  |
| Testing | Unit testing + sandbox integration testing | Coverage ≥ 80%             |
| Certification | Security scan + capability review         | Pass Plugin security checklist |
| Release | Register to Plugin Registry      | Semantic versioning (semver)     |
| Runtime | Execute under sandbox constraints         | Resource limit + capability whitelist    |
| Deprecation | Mark deprecated + migration guide  | Maintain at least 3 months          |

## 22.5 Documentation and Examples

- Each SDK must have API reference (auto-generated from TypeScript types)
- Provide 3 standard example Packs: simple-qa / coding-fix / operations-resolve
- Provide Playground environment: online trial Pack development (optional, Phase 4)

---

# 23. Compliance and Data Governance Architecture

> Enterprise platform must meet compliance requirements. Define GDPR/SOC2 related data governance architecture.

## 23.1 Data Lifecycle Management

| Data Type     | Retention Policy              | Deletion Method                | Description                      |
| ------------ | --------------------- | ----------------------- | ------------------------- |
| Truth table  | As business requires            | Logical delete + periodic physical cleanup | Control truth                  |
| Event log    | Default 365 days           | Archive then delete              | append-only, archive to cold storage |
| Audit record | Default 3 years             | Cannot be deleted (compliance requirements)    | Legal retention period                |
| Artifact     | Default 90 days            | Physical delete                | Large object                    |
| Memory       | Auto cleanup by TTL       | Physical delete                | Runtime short-term data            |
| Knowledge    | Differentiated by trust level | Logical delete                | Long-term shared data              |
| LLM call records | Default 90 days            | Physical delete                | Contains prompt/completion      |
| Cost record  | Default 3 years             | Archive                    | Financial audit                  |

## 23.2 Right-to-Erasure (GDPR Art.17)

append-only event log has architectural conflict with right-to-erasure. Solution:

**Crypto-shredding**:

1. Each tenant's PII data is encrypted with independent data encryption key (DEK) before storage
2. DEK is managed by key management service, associated with tenant_id
3. When deletion request arrives, destroy that tenant's DEK
4. Encrypted data in event log becomes undecryptable (logically equivalent to deletion)
5. Audit record retains the record of deletion operation itself

Boundary between deletion right and immutable audit: destroy encrypted payload, retain non-PII audit envelope, retain hash/digest for integrity. After deletion, generate `ErasureTombstone`, cannot be referenced by Memory/Knowledge/Prompt fixture again.

Erasure state machine:

```text
requested → classified → payload_shredded → backup_expiry_wait → tombstoned → verified
       └──────────────→ legal_hold_exception
```

`legal_hold_exception` must record hold reason, legal owner, review date, and visibility restriction; after lifting legal hold, return to `classified` to continue deletion process. Payload in backup does not require immediate physical overwriting, but must have expiry wait, key destruction proof, and final verified evidence.

## 23.3 Data Residency

- Each tenant can configure data_residency constraint (e.g., "CN" / "EU" / "US")
- LLM calls must route to providers satisfying data residency (see §15.3 data_residency routing)
- Storage engine shards by region (Phase S3+ supports)
- Cross-region data transfer prohibited by default, requires explicit authorization

Cross-border and legal basis must be materialized as evidence objects: `DataTransferRecord`, `LegalBasisRecord`, `RetentionOverride`, `TenantNeutralAuditDigest`. Legal hold takes priority over normal retention/delete request, but only retains necessary envelope and digest, sensitive payload is encrypted and sealed according to legal basis.

## 23.4 SOC2 Control Mapping

| SOC2 Control Domain    | Platform Corresponding Capability                     | Evidence Source                        |
| -------------- | -------------------------------- | ------------------------------- |
| CC6.1 Logical access | §11 Unified identity and authorization               | PolicyOutcome + audit record    |
| CC6.3 Encryption     | §23.5 Encryption architecture                   | key rotation log                |
| CC7.2 Monitoring     | §12 Exception event detection                 | incident + metrics              |
| CC8.1 Change management | §24 Configuration governance + §16 Prompt versioning | config_version + prompt_version |
| CC9.1 Risk mitigation | §10 Risk scoring engine                 | RiskDecision + evidence bundle  |
| A1.2 Disaster recovery      | §31 Disaster recovery architecture                     | DR drill report                     |

## 23.5 Encryption Architecture

| Layer         | Strategy           | Implementation                                              |
| ------------ | -------------- | ------------------------------------------------- |
| Transport encryption     | TLS 1.3 mandatory   | All HTTP/gRPC/WebSocket connections                     |
| Storage encryption     | AES-256        | Database-level TDE or application-level field encryption                     |
| PII field encryption | Per-tenant DEK | Support crypto-shredding                             |
| Secret storage  | Vault integration     | Reference-based access, TTL ≤ 300s                            |
| Key rotation     | Auto 90 days     | DEK rotation does not affect historical data decryption (envelope encryption) |

## 23.6 Data Lineage

Each decision and output can be traced back to its data source:

```text
Knowledge chunk → Observe (UnifiedObservation)
  → Assess (UnifiedAssessment) → Plan (PlanGraphBundle)
    → Execute (NodeAttemptReceipt) → Side Effect
```

- Build lineage chain through trace_id + evidence_refs
- Support forward query (which decisions a certain knowledge influenced) and reverse query (which inputs a certain side effect depends on)
- Lineage data is written to P5 Evidence Plane, not built into separate storage

---

# Part III — Business Domain Onboarding Layer (§37-§38)

---

# 37. Business Domain Modeling and Onboarding Architecture

> Solve the core question of "platform is built, how to undertake diverse enterprise internal business".
> Related: §30 Business Pack model · §22 SDK/DX · §10 Risk control · §16 Prompt management · §17 Model evaluation · §29 Knowledge/Memory

## 37.1 Problem Statement

The 24 vertical business lines within the enterprise have fundamental differences in the following dimensions:

| Dimension       | Quantitative Trading          | E-Commerce              | Advertising          | Financial Services            | Data Processing        | Code Development         |
| ---------- | ----------------- | ----------------- | ----------------- | ------------------- | --------------- | ---------------- |
| Risk level   | Critical (capital)  | High (oversell/pricing) | Medium (budget)    | Critical (compliance)    | Medium (data)  | High (production change) |
| Time sensitivity | Microsecond ~ millisecond       | Second level (search/risk control) | Hour level (bidding)    | Second ~ day level             | SLA-driven        | Minute level           |
| Knowledge freshness   | Real-time quote Tick    | Inventory/price minute level   | Delivery data hour level    | Credit/regulation quarterly     | Schema on demand     | Code repository real-time       |
| Evaluation dimension   | Sharpe/drawdown/slippage  | GMV/conversion rate/CSAT   | ROAS/CPA/CTR      | Gini/KS/loss rate      | SLA achievement/quality | Compile+test+security   |
| Approval requirement   | Strategy online mandatory approval  | Large amount price change approval  | Delivery launch+creative approval | Over-threshold loan/SAR mandatory | Schema migration approval | Code Review      |
| Reversibility     | Close position (with cost)    | Refund/compensation         | Pause delivery          | Reversal (limited)        | Roll back to good data  | Git revert       |
| HITL intensity  | High                | Medium                | Medium                | Extremely high                | Medium              | High               |
| Latency tier   | Ultra-low latency (<10ms) | Real-time (<1s)       | Near real-time (<5min)   | Real-time ~ batch processing         | SLA-driven        | Real-time (<1s)      |

| Dimension       | User Operations        | Industry Research          | Academic Research          | Enterprise Knowledge Base        | Finance             | Legal               |
| ---------- | --------------- | ----------------- | ----------------- | ----------------- | ---------------- | ------------------ |
| Risk level   | Medium (privacy)  | Low (information)       | Low (academic reputation)   | Medium (leakage)    | Critical (capital) | Critical (legal)   |
| Time sensitivity | Minute level (trigger)  | Hour ~ day level         | Day ~ week level           | Second level (search)      | Day level (monthly)     | Hour ~ day level          |
| Knowledge freshness   | User behavior real-time    | Report quarterly level        | Paper monthly level          | Document weekly level          | Regulation quarterly level       | Regulation/case monthly level      |
| Evaluation dimension   | Retention rate/LTV/NPS  | Fact accuracy/coverage | Citation accuracy/reproducibility | MRR/faithfulness/coverage | Accuracy/compliance/timeliness | Recall/accuracy/timeliness |
| Approval requirement   | Activity content approval    | Pre-release manual review    | All manual review      | Access control/error correction     | Four eyes + SoD    | **All lawyer review**   |
| Reversibility     | Stop activity        | Correction statement          | Errata/retraction         | Version rollback          | Reversal/reconciliation        | Irreversible (effective)   |
| HITL intensity  | Medium              | High                | High                | Medium                | Extremely high             | **Highest**           |
| Latency tier   | Near real-time (<5min) | Batch processing            | Batch processing            | Real-time (<1s)       | Batch processing           | Batch processing             |

| Dimension       | Online Live Streaming            | Ad Creative Production        | Game Development        | Game Publishing            | Human Resources           | Supply Chain & Logistics      |
| ---------- | ------------------- | ------------------- | --------------- | ------------------- | ------------------ | ----------------- |
| Risk level   | High (regulation/public opinion)   | Medium (brand/copyright) | Medium (quality)  | High (compliance/rating)   | High (privacy/discrimination)  | High (capital/operation) |
| Time sensitivity | Millisecond ~ second level (real-time stream) | Hour ~ day level           | Minute ~ hour level     | Day level (review cycle)    | Day level (recruitment process)   | Hour level (scheduling)    |
| Knowledge freshness   | Real-time (danmaku/screen)   | Creative library weekly level          | Code repository/engine real-time | Platform policy monthly level        | Regulation/policy quarterly level    | Inventory/logistics real-time     |
| Evaluation dimension   | Violation detection rate/latency     | Creative quality/compliance rate     | Compile/test/performance  | First-pass rate/time-to-online | Recruitment cycle/AIR       | Prediction accuracy/cost   |
| Approval requirement   | Violation handling approval        | Creative release approval        | Version release approval    | Per-platform compliance approval      | Hiring/promotion approval      | Large purchase approval      |
| Reversibility     | Stream cut (irreversible broadcast)  | Version rollback            | Git revert      | Takedown (has time window)  | Withdraw offer (limited) | Return/transfer         |
| HITL intensity  | High                  | Medium                  | Medium              | High                  | High                 | Medium                |
| Latency tier   | Real-time (<2s)         | Batch processing              | Real-time (<1s)     | Batch processing              | Batch processing             | Near real-time (<5min)   |

| Dimension       | Healthcare             | Education & Training            | Customer Service       | Content Moderation              | IT Operations SRE      | Marketing            |
| ---------- | -------------------- | ------------------- | -------------- | --------------------- | ---------------- | ------------------- |
| Risk level   | **Critical (life)** | Medium (privacy/education) | Medium (reputation) | High (legal/security)     | High (availability)   | Medium (brand/legal) |
| Time sensitivity | Minute level (emergency) ~ day level  | Day ~ week level (course)     | Second level (dialogue)   | Millisecond ~ second level (real-time moderation) | Second level (alert response) | Hour level (public opinion)      |
| Knowledge freshness   | Guideline/drug monthly level        | Textbook semester level          | FAQ/knowledge base weekly level | Policy/regulation monthly level         | Configuration/topology real-time    | Market data daily level        |
| Evaluation dimension   | Diagnosis accuracy/safety    | Learning effect/completion rate     | CSAT/FCR/AHT   | Recall/precision/latency    | MTTR/MTTD/availability | ROAS/SOV/interaction rate     |
| Approval requirement   | **All doctor review**     | Course content review        | Over-permission commitment approval | Disposal appeal approval          | Change window approval     | Brand content review        |
| Reversibility     | Irreversible (executed medical order) | Course adjustment            | Compensation/refund      | Unblock/recover             | Rollback change         | Withdrawal/correction           |
| HITL intensity  | **Highest**             | Medium                  | Medium             | High                    | High               | Medium                  |
| Latency tier   | Real-time ~ batch processing          | Batch processing              | Real-time (<1s)    | Real-time (<2s)           | Real-time (<1s)      | Near real-time (<15min)    |

**Current §30 Business Pack compresses the above differences into a flat `BusinessPackManifest`**, which cannot express domain semantics, cannot drive differentiated risk control, cannot guide domain Prompt strategy. v3.0 deepens the original 12 vertical domains one by one through §71-§82, and v3.1 expands to 24 vertical domains for full coverage through §83-§94.

## 37.2 DomainDescriptor — Domain Descriptor

Each business domain must provide a structured domain descriptor when onboarding the platform, as the basis for the platform to understand, constrain, and optimize that domain's Agent behavior:

**Design Decision**: DomainDescriptor does not replace BusinessPackManifest(§30), but serves as the **domain semantics layer** of the Pack. A Pack associates with one DomainDescriptor, multiple Packs can share the same DomainDescriptor (e.g., "HR Onboarding Pack" and "HR Compensation Pack" share `domain_id: "hr"`).

v4.3 splits the single large DomainDescriptor into multiple independently versionable Domain Specs, avoiding one schema carrying too much semantics. `DomainCoreDescriptor` only retains domain identity and association index, other capabilities are associated through dedicated specs through the same `domainId`:

| Spec | Responsibility | Versioning Strategy |
| --- | --- | --- |
| DomainCoreDescriptor | domainId, owner, primary entities, recipe archetype, lifecycle | 2 version support windows |
| DomainExecutionProfile | execution_mode, latency tier, hot path, compiled artifact | Hot path change requires recertification |
| DomainRiskSpec | Risk override, side effect, approval threshold, liability owner | high/critical change requires P2 approval |
| DomainKnowledgeSpec | knowledge source, ACL, freshness, conflict policy | Can gray-out independently |
| DomainEvalSpec | eval baseline, critical cases, acceptance threshold | Release gate input |
| DomainGovernanceSpec | HITL, policy, recertification, waiver | Can only tighten superior policy |
| DomainInteractionSpec | NL, dashboard, proactive trigger, user experience strategy | Must not bypass execution constraints |

During compatibility period, `DomainDescriptor` can be retained as aggregate view, but new implementations must read/write the above decomposed specs.

The main architecture document only retains domain hard constraints, meta-model, and a few representative examples; the executable spec entry for the 24 vertical domains has been split into `docs_zh/domains/<domain>/domain-spec.md`, maintained by domain owner. §71-§94 is retained as historical compatibility chapter and migration index, not as blocker for core platform milestone.

Each independent Domain Spec must at least declare the following machine contracts, main document only retains index:

| Domain Type | Required Machine Contract Example |
| --- | --- |
| Trading/Financial/Finance | StrategyArtifact / PreTradeRiskCheck / monetary FX snapshot / SoD / adverse-action evidence |
| E-commerce/Advertising/Customer Service | InventoryReservation / SpendReconciliation / PromiseAndRemedyPolicy / refund compensation |
| Data/Code/Knowledge Base | lineage / schema compatibility / CODEOWNER + SAST/license/dependency scan / principal-aware ACL |
| Healthcare/Legal/HR/Education | professional signoff / bias audit / consent record / advisory_only boundary |
| Live Streaming/Content Moderation/Multimodal Creative | StreamInterventionStateMachine / jurisdiction escalation / provenance / similarity/license evidence |
| Supply Chain/IT Operations/Marketing | export/hazmat policy / CMDB blast radius / rollback window / claim evidence source |

Each Domain Spec must pass `domain lint` before entering Gate 2: risk action coverage, HITL coverage, tool permission coverage, eval coverage, SLO profile, data boundary lint, critical action responsibility record coverage must all be machine-verifiable. Each critical action in critical domain must bind HITL + HumanResponsibilityRecord; when missing, DomainReleaseGate fails closed.

v4.3 retains execution mode field, used to distinguish LLM-assisted planning from deterministic hot path execution:

```yaml
schemaVersion:
domainId:
execution_mode:
  planning_mode: llm_assisted | deterministic_only
  hot_path_mode: deterministic_only | llm_allowed
  llm_in_hot_path_allowed: boolean
  max_hot_path_latency_ms: number
riskProfile:
dataClasses:
sideEffectTypes:
humanReviewPolicy:
sloProfile:
conflictResolutionPolicy:
```

High-risk or ultra-low latency hot paths (such as quantitative order placement, real-time risk control, live stream cut, IT auto-repair) must use `hot_path_mode: deterministic_only`. LLM can participate in offline planning, candidate solution generation, explanation, and review, but must not enter execution hot paths requiring determinism, microsecond/millisecond-level latency, or irreversible side effects.

`conflictResolutionPolicy` must reference platform supported enumeration or registered plugin interface, must not fill in free text. DomainDescriptor schema support window is 2 versions; before `cdm-v1`, `cdm-v2` parallel period ends, migration must be completed, otherwise new run admission is rejected.

`CompiledPlanArtifact` is used for deterministic hot path:

| Field | Description |
| --- | --- |
| sourceGraphRef | Source PlanGraph / strategy graph |
| compilerVersion | Compiler and rule version |
| signature | artifact signature and publisher |
| policyProofRef | Risk, permission, budget, data boundary proof |
| dryRunEvidenceRef | dry-run / replay / shadow compare evidence |
| runtimeLimits | latency, parallelism, notional, blast radius, side effect limit |

## 37.3 DomainRiskProfile — Domain Risk Profile

Universal risk matrix(§10) provides platform-level default values, DomainRiskProfile provides **domain-level override**, so that the same action triggers different risk control policies under different business domains:

**Domain Risk Profile Application Example**:

| Scenario              | Platform Default Risk | Domain Override Risk               | Result             |
| ----------------- | ------------- | --------------------------- | ---------------- |
| `tool.http.post`  | 60            | Finance domain → 90                 | Mandatory four-eye approval     |
| `tool.http.post`  | 60            | Customer service domain → 40                 | Auto execute         |
| `tool.file.write` | 50            | Code R&D domain → 70 (production branch) | Code Review gate |
| `tool.file.write` | 50            | Creative production domain → 30             | Auto save draft     |

## 37.4 DomainKnowledgeSchema — Domain Knowledge Structure

Define each business domain's knowledge retrieval strategy, timeliness requirement, and conflict resolution rules, connecting with §29 Knowledge/Memory layer:

**Domain Knowledge Difference Example**:

| Business Domain     | Retrieval Mode                   | Timeliness Requirement            | Conflict Strategy                        |
| ---------- | -------------------------- | ------------------- | ------------------------------- |
| Quantitative trading   | api_realtime (quote Tick)   | Microsecond ~ millisecond level         | source_priority (exchange first)   |
| E-commerce       | api_realtime (inventory/price)   | Minute level              | source_priority (inventory system first) |
| Financial services   | structured_query (credit API) | Day ~ quarter level           | human_review                    |
| Code R&D   | structured_query (AST/Git) | Real-time (HEAD commit) | timestamp_latest                |
| Academic research   | semantic_search (paper library)   | Monthly level                | citation_count_priority         |
| Enterprise knowledge base | hybrid (semantic + keyword)       | Weekly level                | domain_rule (highest version first)   |
| Finance       | structured_query (ERP API) | Day level (T+1 reconciliation)    | human_review                    |
| Legal       | structured_query (legal library)  | Monthly level                | jurisdiction_priority           |

## 37.5 DomainEvalFramework — Domain Evaluation Framework

Universal model evaluation(§17) provides platform-level quality gate, DomainEvalFramework defines **domain-specific quality axes and evaluation standards**:

**Domain Evaluation Dimension Difference**:

| Business Domain     | Core Quality Axis                       | Automatic Check                      | Regression Data Source         |
| ---------- | -------------------------------- | ----------------------------- | -------------------- |
| Quantitative trading   | Sharpe/drawdown/slippage, execution quality       | Pre-market rationality check + risk control limit verification | Backtest performance baseline         |
| E-commerce       | GMV/conversion rate/CSAT, inventory accuracy      | Price rationality + inventory sync verification     | A/B test historical data     |
| Advertising promotion   | ROAS/CPA/CTR, budget compliance, creative compliance | Budget upper limit check + advertising regulation check   | A/B test historical data     |
| Financial services   | Gini/KS/loss rate, AML detection rate       | Fairness test + PSI monitoring         | Expert annotation + regulatory feedback    |
| Code R&D   | Compile pass, test coverage, security scan     | AST lint + unit test run           | PR review passed code |
| Academic research   | Citation accuracy, statistical correctness, reproducibility | DOI verification + duplicate check               | Published papers           |
| Enterprise knowledge base | MRR/faithfulness/coverage, access control compliance  | Citation verification + permission check           | Manual annotation QA pair           |
| Finance       | Numerical accuracy, compliance, audit traceability   | Amount verification + regulation rule engine       | Expert audit samples         |
| Legal       | Risk clause recall, case accuracy       | Legal database cross-verification            | Lawyer review annotation         |

## 37.6 DomainPromptLibrary — Domain Prompt Library

Connecting with §16 Prompt management system, provides **domain-level Prompt assets** for each business domain, avoiding scattered Prompt fragments:

**Relationship between Prompt Library and Prompt Management System(§16)**: DomainPromptLibrary is domain-level Prompt assets, registered to PromptRegistry in §16. Prompt's versioning, graying-out, rollback capabilities are provided by §16, domain Prompt library only handles **content definition and domain adaptation**.

## 37.7 DomainRecipe — Domain Template and Archetype

Common business domains are summarized as twelve **archetype templates**, new business onboarding selects the closest archetype, quickly generates DomainDescriptor skeleton based on template:

| Archetype                            | Core Pattern                     | Applicable Business Domain                                         | Typical Workflow                           |
| ------------------------------- | ---------------------------- | -------------------------------------------------- | --------------------------------------- |
| **CRUD-heavy**                  | Read→Query→Modify→Confirm                | Enterprise knowledge base, user operations, human resources                     | Issue acceptance→Query→Handle→Feedback                 |
| **Analytics**                   | Collect→Analyze→Visualize→Decide        | Industry research, user operations, advertising reports, marketing             | Data query→Analyze→Generate report→Recommend action         |
| **Creative**                    | Generate→Review→Iterate→Publish          | Advertising, e-commerce (product description), ad creative production, game development | Requirement understanding→Generate→Manual review→Iterate→Publish        |
| **Realtime**                    | Monitor→Detect→Respond→Record          | Quantitative trading, e-commerce (risk control), online live streaming                   | Event stream monitoring→Anomaly detection→Auto response→Post-review   |
| **Trading**                     | Signal→Risk control→Execute→Settle          | Quantitative trading, financial services                                 | Signal generation→Pre-market risk control→Order execution→Position settlement     |
| **Compliance**                  | Monitor→Detect→Evaluate→Report          | Financial services, finance, legal, game publishing                     | Rule monitoring→Anomaly detection→Compliance evaluation→Regulatory report     |
| **Research**                    | Collect→Analyze→Synthesize→Publish          | Industry research, academic research                                 | Multi-source collection→Structured analysis→Synthesis→Review and publish       |
| **Adversarial**                 | Attack surface→Defense→Audit→Fix        | Code development (security), legal (litigation)                     | Threat/risk identification→Defense measure→Audit verification→Fix    |
| **Moderation** (v3.1 new)     | Ingest→Multimodal detection→Handle→Appeal    | Content moderation and security, online live streaming (moderation link)               | Content ingest→AI detection→Tiered handling→Manual appeal review  |
| **Logistics** (v3.1 new)      | Predict→Optimize→Schedule→Track→Exception handling | Supply chain and logistics, game publishing (release scheduling)                 | Demand forecast→Path optimization→Schedule execution→Real-time tracking     |
| **Conversational** (v3.1 new) | Intent recognition→Knowledge retrieval→Answer→Feedback  | Customer service, education & training (tutoring), healthcare (triage)       | User intent→Knowledge base retrieval→Generate answer→Satisfaction feedback |
| **IncidentOps** (v3.1 new)    | Alert→Diagnose→Fix→Review→Prevent     | IT Operations SRE/DevOps                                 | Alert reception→Root cause diagnosis→Auto fix→Post-review     |

**Usage Process**:

1. Business party selects archetype through CLI (12 options): `agent-platform domain init --archetype=crud_heavy --name=hr`
2. System generates DomainDescriptor skeleton, marks all `customization_points`
3. Business party fills in required items (entity, tool binding, approval rules, etc.)
4. CLI runs `agent-platform domain validate` to verify completeness
5. After passing, enter §38 Onboarding Runbook process

## 37.8 DomainInteractionPolicy — Cross-Domain Interaction Policy

When multiple business domain Agents need to collaborate (e.g., advertising domain Agent calls data analysis domain Agent to generate reports), need clear **boundary policies and compensation mechanisms**:

**Cross-Domain Interaction Matrix Example**:

| Source Domain → Target Domain       | Data Flow Direction           | Delegation                     | Failure Strategy                |
| ------------------- | ------------------ | ------------------------ | ----------------------- |
| Advertising → Data Analysis     | Aggregated data, no PII   | Allow (depth=1)            | retry(3) → human_review |
| HR → Finance           | Salary data, encrypted transmission | Allow (depth=1, intersect) | rollback_source         |
| Live Streaming → Inventory         | Real-time inventory query       | Prohibit (read-only API)           | fallback cache           |
| Code R&D → Security Operations | Code scan results       | Allow (depth=1)            | log_and_continue        |

## 37.9 DomainGovernancePolicy — Domain Governance Model

Each business domain must have clear **governance ownership**, including ownership, SLO, budget, and change management:

**Governance Model and Platform Capability Mapping**:

| Governance Dimension    | Platform Capability Connection                    | Automation Degree          |
| ----------- | ------------------------------- | ------------------- |
| Ownership   | §6 API permission + §11 IAM           | Fully automatic (RBAC)      |
| SLO         | §27 SLO monitoring + Error Budget     | Fully automatic (alert+degradation) |
| Budget      | §18 Token metering + budget enforcement       | Fully automatic (quota+circuit breaker) |
| Change Mgmt | §16 Prompt graying-out + §30 Pack release | Semi-automatic (approval+graying-out) |

## 37.10 DomainDescriptor Registration and Lifecycle

```text
┌─────────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Draft      │────▶│  Validated   │────▶│  Registered  │────▶│   Active     │
│ (Business party writes) │     │ (CLI verify)   │     │ (Platform register)    │     │ (Production run)   │
└─────────────┘     └─────────────┘     └──────────────┘     └──────┬───────┘
                                                                     │
                         ┌──────────────┐     ┌──────────────┐      │
                         │  Deprecated   │◀────│  Updating    │◀─────┘
                         │ (Deprecating)   │     │ (Version upgrading)  │
                         └──────┬───────┘     └──────────────┘
                                │
                         ┌──────▼───────┐
                         │   Archived   │
                         │ (Archive read-only)    │
                         └──────────────┘
```

**State Transition Rules**:

| Current State   | Can Transition To   | Conditions                                      |
| ---------- | ---------- | ----------------------------------------- |
| Draft      | Validated  | `agent-platform domain validate` all pass |
| Validated  | Registered | Security review + platform compatibility check pass             |
| Registered | Active     | At least one associated Pack released successfully                |
| Active     | Updating   | Business party submits new version descriptor               |
| Updating   | Active     | New version verification+register pass                       |
| Active     | Deprecated | domain_owner initiates deprecation, approval passes           |
| Deprecated | Archived   | All associated Packs migrated or offline completed              |

## 37.11 Canonical Domain Meta-Model — Unified Domain Meta-Model

Each vertical business domain, when onboarding the platform, must use the unified meta-model to answer the following **15 standard questions**. This meta-model is the foundation of the platform's "domain configuration driven", and is also the data source for unified generation of dashboards, approvals, risks, and evaluations. When adding the 25th domain, simply fill in the same template to complete onboarding definition.

### Meta-Model 15 Questions

| #   | Meta-Model Question                 | Corresponding Platform Concept                              | Filling Specification                     |
| --- | -------------------------- | ----------------------------------------- | ---------------------------- |
| Q1  | What are the domain primary entities           | DomainDescriptor.primary_entities         | List 3-5 core business entities      |
| Q2  | What are the high-risk actions           | DomainRiskProfile (operations with risk ≥ 70)     | Extract from DomainRiskProfile table  |
| Q3  | What is the default autonomy level         | DomainDescriptor.default_autonomy         | L0-L4 (reference §42)            |
| Q4  | What are the default HITL nodes       | DomainInteractionPolicy.hitl_points       | List mandatory manual decision nodes         |
| Q5  | What are the key external systems         | DomainDescriptor.external_dependencies    | List core upstream and downstream systems           |
| Q6  | What are the key read-only tools         | DomainRiskProfile (risk < 40 and no side effect) | Extract from DomainRiskProfile table  |
| Q7  | What are the key write tools           | DomainRiskProfile (risk ≥ 40 or has side effect) | Extract from DomainRiskProfile table  |
| Q8  | What are the irreversible actions           | DomainDescriptor.irreversible_actions     | List all non-rollback operations         |
| Q9  | What are the core quality metrics         | DomainEvalFramework.primary_metrics       | List 3-5 core KPIs          |
| Q10 | What are the core compliance constraints         | DomainGovernancePolicy.compliance_rules   | List applicable regulations and mandatory rules       |
| Q11 | What is the minimum launch capability set         | DomainDescriptor.mvp_capabilities         | List minimum necessary features for graying-out launch |
| Q12 | What certifications must be completed before graying-out launch | §38 Gate3 SecurityCert + domain special check       | List certifications/reviews that must pass    |
| Q13 | Who is the responsibility subject               | DomainRiskSpec.liability_owner            | Legal qualification, business owner, approval responsibility |
| Q14 | What is the failure compensation/rollback model       | DomainRiskSpec.compensation_model         | refund, reversal, appeal, manual repair |
| Q15 | What are the red team/adversarial scenarios        | DomainEvalSpec.adversarial_scenarios      | prompt injection, unauthorized access, fraud, extreme input |

### 24 Domain Meta-Model Filling Matrix (Q1-Q6)

| Domain         | Q1 Primary Entity                           | Q2 High-Risk Action                                                 | Q3 Default Autonomy | Q4 Default HITL Node                           | Q5 Key External System                | Q6 Read-Only Tool                    |
| ---------- | ----------------------------------- | ------------------------------------------------------------- | ----------- | ------------------------------------------- | ------------------------------ | ------------------------------ |
| Quantitative trading   | Strategy, order, position, market, risk limit        | order.submit · strategy.deploy · risk_limit.modify            | L1          | Strategy launch, risk limit change, fund allocation              | Exchange, market source, risk system         | market_data.read               |
| E-commerce       | Product, order, inventory, price, refund            | price.update · refund.issue · listing.publish                 | L2          | Over-threshold price change, over-amount refund, controlled category listing        | ERP, WMS, payment gateway, search engine      | inventory.sync                 |
| Advertising promotion   | Campaign, creative, audience, bid, budget            | campaign.launch · creative.publish · audience.create          | L2          | Launch start, creative online, sensitive category audience targeting          | Ad platform API, DMP, creative tool       | —                              |
| Financial services   | Credit application, KYC record, insurance policy, claim, SAR    | credit.approve · sar.submit · claim.adjudicate · model.deploy | L0          | Over-threshold loan, SAR report, model deployment, adverse credit decision    | Credit system, core bank, regulatory report     | —                              |
| Data processing   | Pipeline, Schema, dataset, lineage, quality rule    | schema.migrate · pipeline.deploy_prod · data.delete           | L2          | Schema migration, production deployment, data deletion, sensitive data access   | Data warehouse, compute engine, scheduling system         | pipeline.retry                 |
| Code development   | Code repository, PR, CI pipeline, vulnerability, dependency          | code.merge · deploy.production · security.fix                 | L1          | Code merge, production deployment, security vulnerability fix, architecture decision     | Git, CI/CD, SAST/DAST, artifact repository     | —                              |
| User operations   | User segment, campaign, notification, A/B test, LTV      | campaign.send · segment.create                                | L2          | Campaign content, sensitive attribute segment, notification frequency, incentive budget     | CDP, push platform, analysis system          | —                              |
| Industry research   | Report, data source, trend, competitor, regulatory policy      | report.publish · data.scrape                                  | L1          | Research release, forward-looking statement, copyright compliance                | Industry database, news API, regulatory website    | alert.send                     |
| Academic research   | Literature, hypothesis, experiment, manuscript, citation            | manuscript.submit · citation.insert · analysis.run            | L1          | Publication review, hypothesis selection, experiment design, statistical method         | Academic database, DOI registration, duplicate check system    | literature.search              |
| Enterprise knowledge base | Document, knowledge graph, FAQ, permission, retrieval index     | document.ingest · answer.synthesize · content.retire          | L2          | New document source access, low-confidence answer, content retirement          | Document system, SSO, search engine          | search.query                   |
| Finance       | Invoice, voucher, GL, tax, budget              | journal.post · financial.signoff · tax.file                   | L0          | Over-threshold voucher, report signoff, tax filing, bad debt write-off       | ERP, golden tax system, bank interface, audit system | —                              |
| Legal       | Contract, case, litigation, IP, compliance record          | legal_opinion.draft · contract.review · ediscovery.classify   | L0          | **All output** (practicing lawyer review)                | Legal database, e-discovery, contract management   | ip.search                      |
| Online live streaming   | Live stream, danmaku, product, anchor, review record      | moderation.realtime · commerce.shelf · stream.publish         | L1          | Political/terrorism related stream cut,带货 violation handling, large event launch     | Push CDN, e-commerce system, moderation platform      | danmaku.filter                 |
| Ad creative   | Creative, brand asset, template, effect data         | brand.compliance · creative.generate                          | L2          | Brand category creative, strong regulation industry creative, celebrity portrait          | DAM, delivery system, brand management          | asset.adapt                    |
| Game development   | Design document, art asset, code, value configuration, Bug | game.asset_generate · game.balance_sim                        | L2          | Core gameplay, art style, version release, P0/P1 Bug fix    | Game engine, art tool, CI/CD        | game.qa_run                    |
| Game publishing   | Version package, submission material, localization, event configuration     | store.submit · compliance.check · liveops.config                                 | L1          | Version number submission, major version, large event, sensitive localization       | Store API, payment channel, rating agency      | localization.translate         |
| Human resources   | Resume, Offer, salary, performance, contract           | offer_generate · payroll_calc · resume_screen                 | L0          | Offer issuance, termination, performance rating, salary adjustment, organizational change   | HCM, recruitment platform, salary system, background check     | —                              |
| Supply chain     | Purchase order, inventory, transportation route, customs, supplier  | customs_declare · route_plan · inventory_optimize             | L1          | Large purchase, new supplier access, customs anomaly, dangerous goods transportation   | ERP, WMS, TMS, customs system           | scm.forecast                   |
| Healthcare   | Medical record, prescription, imaging, triage, drug interaction        | clinical.diagnose · drug.interaction_check · imaging.analyze  | L0          | **All clinical decisions** (practicing doctor confirmation)            | HIS, PACS, drug database, medical insurance system   | —                              |
| Education & training   | Course, question bank, learning path, learning status, evaluation        | content_generate · assess · tutor                             | L2          | Content online, subjective question scoring, sensitive topics, minor data   | LMS, question bank, learning status system, parent platform     | learning_path                  |
| Customer service   | Ticket, dialogue, knowledge base, routing, quality inspection record      | cs.respond · cs.quality_score                                 | L2          | Over-permission refund, complaint escalation, legal issues, VIP anomaly        | CRM, knowledge base, ticket system, CTI        | cs.route · cs.knowledge_search |
| Content moderation   | Content item, review record, policy rule, appeal, report  | moderation.classify · moderation.appeal · compliance.report   | L1          | CSAM immediate handling, appeal ruling, policy change, boundary case     | Review platform, legal compliance, reporting system     | —                              |
| IT operations     | Alert, event, deployment, change, vulnerability            | ops.deploy · ops.incident_respond · security_scan             | L1          | High-risk change CAB, security event, new fix strategy, budget procurement  | Monitoring system, CMDB, CI/CD, SIEM       | ops.capacity_plan              |
| Marketing   | Campaign, brand asset, SEO, social content, public opinion | social.publish · marketing.campaign                           | L2          | External content review, brand crisis takeover, marketing budget, brand cooperation | Ad platform, social API, public opinion system      | brand.monitor · seo.optimize   |

### 24 Domain Meta-Model Filling Matrix (Q7-Q12)

| Domain         | Q7 Write Tool                                                                        | Q8 Irreversible Action                          | Q9 Core Quality Metric                        | Q10 Core Compliance Constraint                  | Q11 Minimum Launch Capability Set          | Q12 Pre-Graying-Out Certification                |
| ---------- | -------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------- | --------------------------------- | --------------------------- | ----------------------------- |
| Quantitative trading   | order.submit · strategy.deploy · risk_limit.modify                               | Order submission (position close has cost), strategy deployment       | Sharpe, max drawdown, risk control compliance rate         | CSRC/SEC/MiFID II               | Signal generation+risk control+execution link      | Risk system integration, exchange sandbox verification   |
| E-commerce       | price.update · refund.issue · listing.publish                                    | Price publication (bottom price constraint), refund payment         | GMV, conversion rate, CSAT                    | E-commerce law/Consumer Protection law/PCI-DSS             | Product listing+pricing+basic customer service      | Payment security scan, pressure test             |
| Advertising promotion   | campaign.launch · bid.adjust · creative.publish · audience.create                | Delivery budget consumption (spent, non-recoverable)         | ROAS, CPA, CTR                       | Advertising law/Platform policy/GDPR              | Delivery creation+bidding+basic report      | Advertising law compliance check, budget control verification   |
| Financial services   | credit.approve · sar.submit · claim.adjudicate · model.deploy                    | Loan disbursement, SAR submission, claim payment              | Gini/KS, loss rate, PSI                 | Basel III/AML law/EU AI Act      | Credit assessment+KYC+risk control           | Fairness test, regulatory report integration       |
| Data processing   | schema.migrate · pipeline.deploy_prod · data.delete                              | Data deletion (non-recoverable), Schema destructive change | SLA achievement rate, data quality pass rate             | GDPR deletion right/data residency               | Pipeline orchestration+quality check+lineage      | Data security classification, access control verification     |
| Code development   | code.merge · deploy.production · code.generate · security.fix                    | Production deployment (requires rollback), dependency version lock       | Test pass rate, bug detection rate, adoption rate        | License/SOC2                       | Code generation+review+CI integration        | Security scan, license compliance           |
| User operations   | campaign.send · segment.create · notification.push · ab_test.launch              | Batch notification push (sent, cannot be withdrawn)           | Retention rate, LTV/CAC, NPS                 | PIPL/GDPR/CAN-SPAM                | Segmentation+campaign push+basic analysis      | Privacy compliance, opt-out mechanism verification         |
| Industry research   | report.publish · data.scrape · forecast.generate                                 | Report publication (affects decision)                   | Fact correctness rate, source citation rate                | Securities law/data license/copyright              | Data collection+report generation+review flow    | Data source license, copyright compliance           |
| Academic research   | manuscript.submit · citation.insert · analysis.run                               | Paper submission (reputation impact)                   | Citation accuracy 100%, reproducibility              | Research ethics/publication ethics                 | Literature review+writing assistance+citation verification  | DOI verification, duplicate check system integration          |
| Enterprise knowledge base | document.ingest · answer.synthesize · content.retire                             | Content retirement (knowledge loss risk)               | MRR/NDCG, answer faithfulness                  | Data retention/access control                 | Document processing+semantic search+permission      | Access control verification, search quality baseline     |
| Finance       | journal.post · financial.signoff · tax.file                                      | Tax filing submission, GL posting (requires reversal)          | Straight-through processing rate, GL accuracy, audit findings     | CAS/SOX/Golden Tax Phase IV                  | Invoice processing+voucher+reconciliation          | Audit compliance, SoD verification         |
| Legal       | legal_opinion.draft · contract.review · ediscovery.classify                      | Legal opinion issuance (legal consequences)               | Risk clause recall, case accuracy            | Civil Code/professional ethics/GDPR              | Contract review+case retrieval+compliance      | Legal database integration, privilege detection verification   |
| Online live streaming   | moderation.realtime · commerce.shelf · stream.publish                            | Live stream cut (affects user experience), violation handling     | Violation detection rate, handling latency<3s, GPM         | Internet live streaming management regulations/Minor Protection Law | Push+real-time moderation+danmaku filtering      | Multimodal moderation model, stream cut recovery drill   |
| Ad creative   | creative.generate · brand.compliance                                             | Creative release (brand impact)                   | Brand compliance pass rate, platform audit first-pass rate    | Advertising law/copyright law/portrait right              | Text generation+image generation+compliance check  | Advertising law vocabulary, brand asset library integration     |
| Game development   | game.asset_generate · game.balance_sim · game.design_assist                      | Version release (player experience impact)               | Style consistency (FID), bug detection rate            | Version number/anti-addiction/content review              | QA automation+art generation+value simulation  | Content review pre-screening, anti-addiction verification       |
| Game publishing   | store.submit · compliance.check · liveops.config                                 | Version number submission (zero tolerance), version online           | Submission first-pass rate>90%, DAU/retention          | Version number/rating/anti-addiction/PIPL             | Submission automation+compliance check+graying-out    | Rating compliance matrix, anti-addiction link       |
| Human resources   | resume_screen · offer_generate · payroll_calc · compliance_check                 | Offer issuance, termination execution, salary payment            | Recruitment cycle, salary fairness, bias audit       | Labor law/PIPL/EU AI Act             | Resume screening+offer generation+compliance check | Bias detection, fairness test, explainability  |
| Supply chain     | inventory_optimize · route_plan · customs_declare                                | Purchase order submission, customs declaration, dangerous goods transportation       | MAPE, OTIF, HS classification accuracy             | Customs law/export control/dangerous goods/ESG        | Demand forecast+inventory optimization+path planning  | Export control list integration, dangerous goods compliance   |
| Healthcare   | clinical.diagnose · drug.interaction_check · imaging.analyze · triage.assess     | Diagnostic suggestion issuance (patient safety), prescription issuance     | Diagnostic sensitivity, lesion recall, drug interaction recall | Medical device regulation/HIPAA/FDA SaMD       | Triage+drug interaction check+auxiliary diagnosis  | SaMD certification, clinical verification, data encryption    |
| Education & training   | content_generate · assess · tutor                                                | Score publication (affects academics), inappropriate content exposure     | Knowledge point mastery rate, score consistency (κ≥0.8)       | Minor Protection Law/FERPA/COPPA        | Content generation+intelligent evaluation+tutoring      | Content safety filtering, minor protection verification |
| Customer service   | cs.respond · cs.quality_score                                                    | Refund payment, wrong commitment (hallucination)              | CSAT, FCR, AI independent resolution rate, hallucination rate     | Consumer Protection law/TCPA/GDPR                  | Multi-channel dialogue+routing+knowledge retrieval    | Hallucination rate baseline, emotion detection verification       |
| Content moderation   | moderation.classify · moderation.appeal · adversarial.detect · compliance.report | CSAM report submission, content deletion                  | Precision/recall, violation online duration           | Cybersecurity law/DSA/CSAM mandatory report       | Text moderation+image moderation+policy engine  | Multi-model cross-validation, red team testing       |
| IT operations     | ops.incident_respond · ops.deploy · security_scan                                | Production change (requires rollback), security fix           | MTTR, MTTD, SLO achievement rate                | MLPS 2.0/ISO 27001/SOC 2           | Incident response+deployment automation+monitoring    | Change management process, blast radius verification     |
| Marketing   | social.publish · marketing.campaign                                              | External content release (brand impact), budget consumption       | ROAS, SOV, interaction rate, crisis warning accuracy rate   | Advertising law/FTC/GDPR/CAN-SPAM          | Campaign orchestration+brand monitoring+SEO   | Advertising law compliance, brand tone baseline       |

### Production Responsibility Supplementary Matrix (Q13-Q15)

| Question | Machine Contract Anchor | Filling Requirement |
| --- | --- | --- |
| Q13 Who is the responsibility subject | `DomainRiskSpec.liability_owner` | Specify business owner, legally qualified responsible person, approval responsible person, and incident response owner; critical domain must not use team email as the only owner |
| Q14 What is the failure compensation/rollback model | `DomainRiskSpec.compensation_model` | Each irreversible or external write action must declare refund / reversal / appeal / manual repair / no_compensation, and bind to SideEffect compensation policy |
| Q15 What are the red team/adversarial scenarios | `DomainEvalSpec.adversarial_scenarios` | At least cover prompt injection, unauthorized access, fraud/abuse, extreme input, cross-domain data leak, and high-cost trigger; high/critical domain must have independent holdout |

### Platform Value of Meta-Model

- **Templated Domain Onboarding**: When adding the 25th domain, filling the 15-question meta-model completes 80% of onboarding definition
- **Configuration-Driven Kernel**: Platform kernel reads meta-model fields, automatically configures ConstraintPack · Toolbelt · EvalFramework · ApprovalRoute
- **Unified Dashboard Generation**: §43 Operations dashboard automatically aggregates domain-level views based on meta-model fields (risk heatmap, quality trend, compliance status)
- **Approval Routing Automation**: §47 Approval routing automatically generates domain-level approval chains based on Q2/Q4
- **Evaluation Automation**: §17 Model evaluation automatically generates domain-level evaluation suites based on Q9
- **Documentation Consistency**: 24 domain descriptions are structurally unified, will not diverge as the number of domains grows

---

# 38. Business Domain Onboarding Runbook

> Define the standardized onboarding process from zero to production for new business domains.
> Related: §37 Business domain modeling · §37.11 Unified domain meta-model · §30 Business Pack · §22 SDK/DX · §34 ADR

## 38.1 Onboarding Four-Phase Overview

```text
Phase 1              Phase 2              Phase 3              Phase 4
Domain Modeling      Development & Verification      Security Certification      Graying-Out Launch
(1-2 weeks)             (2-4 weeks)             (1 week)               (1-2 weeks)
┌──────────┐        ┌──────────┐        ┌──────────┐        ┌──────────┐
│ Domain    │───────▶│ Pack     │───────▶│ Security │───────▶│ Rollout  │
│ Modeling  │  Gate1 │ Dev+Test │  Gate2 │ Cert     │  Gate3 │ Canary   │
└──────────┘        └──────────┘        └──────────┘        └──────────┘
```

| Phase    | Responsible Party                | Output                                            | Gate Condition                                |
| ------- | --------------------- | ------------------------------------------------- | --------------------------------------- |
| Phase 1 | Business party + Platform Liaison | DomainDescriptor + RiskProfile + GovernancePolicy | Platform architecture review passes                        |
| Phase 2 | Business party                | Pack code + unit tests + integration tests + eval dataset    | Test coverage ≥ 80% + eval passes              |
| Phase 3 | Security team + Platform team   | CertificationRecord + risk review record                | Security scan no Critical/High + risk review passes |
| Phase 4 | Platform SRE + Business party     | RolloutRecord + monitoring Dashboard                    | canary 7 days no P0/P1 + eval quality not regressed   |

Onboarding path is layered by risk: low = fast-track, medium = standard, high = enhanced, critical = regulated. low-risk internal domain can merge some manual review meetings; critical regulated domain must add domain experts, compliance team, and production drill signoff.

| Risk Path | Target Cycle | Description |
| --- | --- | --- |
| low | 1-2 weeks | Read-only/low-risk internal processes, can merge manual meetings |
| medium | 3-6 weeks | Standard four-phase gate |
| high | 6-10 weeks | Add security, red team, rollback drill, and domain_owner signoff |
| critical | 3-6 months | Domain experts, legal/compliance, production drill, and regulatory evidence must be complete before graying-out |

Each Gate must declare `automated_check`, `human_signoff`, `evidence_required`, and `waiver_policy`, and output machine-readable `DomainCertificationRecord`. waiver can only have expiry, owner, compensating control, and audit record, cannot waive machine invariants.

## 38.2 Phase 1: Domain Modeling

**Goal**: Business party and platform team collaborate to produce structured DomainDescriptor.

**Steps**:

| #   | Activity                     | Executor        | Output                    | Tool                             |
| --- | ------------------------ | ------------- | ----------------------- | -------------------------------- |
| 1   | Select domain archetype(§37.7)      | Business party        | Recipe selection             | `agent-platform domain init`     |
| 2   | Fill domain entities and capabilities       | Business party        | entities + capabilities | YAML/JSON editor                   |
| 3   | Define domain risk profile         | Business party + Security | DomainRiskProfile       | Risk assessment template                     |
| 4   | Define knowledge source and retrieval strategy   | Business party + Data | DomainKnowledgeSchema   | Knowledge source checklist template                   |
| 5   | Define evaluation dimensions and standards       | Business party + AI   | DomainEvalFramework     | eval template                        |
| 6   | Build domain Prompt library       | Business party + AI   | DomainPromptLibrary     | Prompt engineering template                  |
| 7   | Determine governance ownership             | Business lead    | DomainGovernancePolicy  | Governance contract template                       |
| 8   | Fill 15-question meta-model(§37.11) | Business party + Platform | Meta-Model filling table       | Meta-model template                       |
| 9   | Verify completeness               | Business party        | Verification report                | `agent-platform domain validate` |

**Gate 1 Checklist**:

- [ ] All required fields of DomainDescriptor are filled
- [ ] At least 5 few-shot examples are annotated
- [ ] Risk profile has been initially reviewed by security team
- [ ] Knowledge source confirmed accessible and authorized
- [ ] eval dataset meets §17 risk grading lower limit: low ≥50, medium ≥200, high ≥500, critical recommended ≥1000 + expert signoff + holdout
- [ ] Governance contract signed by domain_owner
- [ ] Cross-domain interaction policy confirmed with related domains (if any)
- [ ] 15-question meta-model(§37.11) all filled and passed verification
- [ ] Platform architecture review meeting passed
- [ ] **Vertical domain special**: Latency tier declaration complete; Critical risk domain (quantitative trading/financial services/finance/legal/healthcare) must additionally submit regulatory compliance mapping table and HITL coverage plan; High risk domain (human resources/online live streaming/content moderation/IT operations/game publishing) must submit domain-specific risk control plan

## 38.3 Phase 2: Development & Verification

**Goal**: Develop Business Pack based on DomainDescriptor, pass local and staging environment verification.

**Steps**:

| #   | Activity              | Executor       | Output             | Tool                                       |
| --- | ----------------- | ------------ | ---------------- | ------------------------------------------ |
| 1   | Initialize Pack project  | Business party       | Pack code skeleton    | `agent-platform pack create --domain=<id>` |
| 2   | Implement Tool adapter  | Business party       | Tool bundle code | Pack SDK(§22)                              |
| 3   | Write unit tests      | Business party       | Test cases         | Standard test framework                               |
| 4   | Local Mock test    | Business party       | Local test report     | `agent-platform pack test --local`         |
| 5   | Build eval dataset | Business party + AI  | Evaluation dataset       | eval toolchain                                |
| 6   | Staging integration test  | Business party + SRE | Integration test report     | staging environment                               |
| 7   | Run domain evaluation      | Business party       | eval quality report    | `agent-platform eval run --domain=<id>`    |

**Gate 2 Checklist**:

- [ ] Unit test coverage ≥ 80%
- [ ] All integration tests pass
- [ ] All quality axes of domain eval meet acceptance_threshold
- [ ] No known P0/P1 Bug
- [ ] Pack Manifest and DomainDescriptor consistency verification pass
- [ ] Tool permission declaration matches risk profile
- [ ] **Vertical domain special**: All domain-specific evaluation metrics have automatic check implementation; Critical risk domain must pass domain expert (lawyer/risk controller/auditor/practicing doctor) review; human resources domain must pass bias audit

## 38.4 Phase 3: Security Certification

**Goal**: Security team and platform team conduct security review and risk assessment of Pack.

| #   | Check Item                | Executor   | Standard                       |
| --- | --------------------- | -------- | -------------------------- |
| 1   | Static code scan          | Automation   | No Critical/High vulnerabilities      |
| 2   | Dependency vulnerability scan          | Automation   | No known CVE (Critical)     |
| 3   | Sandbox escape test      | Security team | No escape path                 |
| 4   | Prompt Injection test | Security team | Injection protection effective               |
| 5   | Data leak test          | Security team | No PII/credential leak            |
| 6   | Risk profile consistency        | Platform team | RiskProfile matches actual behavior |
| 7   | Cross-domain policy compliance          | Security team | DataFlowRule executes correctly      |
| 8   | Compliance review(§23)       | Compliance team | Meet industry regulatory requirements           |

**Gate 3 Checklist**:

- [ ] All security scans pass
- [ ] Prompt Injection protection coverage 100%
- [ ] Risk profile review record archived
- [ ] CertificationRecord issued
- [ ] Compliance team no blocking opinion
- [ ] **Vertical domain special**: Quantitative trading domain completes pre-market risk control pressure test; Financial services domain completes AML detection coverage verification; Legal domain completes privilege classification accuracy test; Finance domain completes SoD mandatory check; Healthcare domain completes doctor review coverage verification; Content moderation domain completes CSAM report timeliness test; Human resources domain completes recruitment bias audit; IT operations domain completes blast radius limit verification; Online live streaming domain completes real-time moderation latency pressure test

## 38.5 Phase 4: Graying-Out Launch

**Goal**: Ensure production environment stability through progressive graying-out release.

**Graying-Out Strategy**:

```text
Day 1-2     Day 3-5     Day 6-7     Day 8+
Canary 1%   Canary 10%  Canary 50%  GA 100%
┌─────┐    ┌──────┐    ┌──────┐    ┌──────┐
│ Internal │───▶│ Small range│───▶│ Half │───▶│ Full │
│ Test │    │ Real  │    │ Real │    │ Release │
└─────┘    └──────┘    └──────┘    └──────┘
   ▲           ▲           ▲           ▲
   │           │           │           │
  Manual verify   Auto metrics   Auto metrics   SLO reach
  + eval     + eval     + eval     confirm
```

**Per-Phase Automatic Check**:

| Metric              | Threshold                   | Non-compliance Action          |
| ----------------- | ---------------------- | ------------------- |
| Error rate        | < 1%                   | Auto rollback            |
| P95 latency       | < domain SLO           | Alert + manual decision     |
| Eval quality      | ≥ acceptance_threshold | Auto rollback            |
| Token cost        | < budget × (canary%)   | Alert + manual decision     |
| User feedback negative | < 5%                   | Pause graying-out + manual review |

**Gate 4 (GA Admission) Checklist**:

- [ ] Canary 7 days no P0/P1 Incident
- [ ] All SLO metrics meet target
- [ ] Eval quality not lower than Gate 2 baseline
- [ ] Token cost within budget
- [ ] Monitoring Dashboard configured and alerts routed
- [ ] Runbook (fault handling manual) written and delivered to SRE
- [ ] Domain Owner signs GA confirmation

## 38.6 Continuous Operation After Onboarding

After business domain goes live, enter **continuous operation mode**, platform automatically executes the following periodic activities:

| Activity                  | Frequency                | Responsible Party                    | Trigger Condition             |
| --------------------- | ------------------- | ------------------------- | -------------------- |
| Eval regression test         | Daily                | Auto                      | Scheduled + after Prompt change |
| Cost report              | Weekly                | Auto → domain_owner       | Scheduled                 |
| SLO report              | Monthly                | Auto → domain_owner + SRE | Scheduled                 |
| Security scan              | Monthly                | Auto                      | Scheduled + when dependencies update    |
| DomainDescriptor review | Quarterly              | Business party + Platform             | Scheduled                 |
| Knowledge source timeliness check      | By freshness_policy | Auto                      | Continuous                 |
| Cross-domain policy review          | Quarterly              | Security team                  | Scheduled + when new domain onboards    |

Continuous governance status includes: initial certification, periodic recertification, incident-triggered recertification, domain descriptor drift review. When DomainDescriptor and Pack behavior drift, platform can pause new run admission until review is complete.

---

# Part IV — Vertical Business Domain Deepening Layer (§71-§94)

This Part retains architecture overview of 24 domains, used to show the mapping of Domain Meta-Model in high-risk industries. v4.2 implementation does not require creating 24 domain production implementation directories at once; productized domain spec entry has been split into `docs_zh/domains/<domain>/domain-spec.md`, main document only maintains cross-domain invariants, representative constraints, and migration index.

## Part IV Domain Special Hard Constraints Summary Table

| Domain | Special Constraints That Must Be Absorbed |
| --- | --- |
| Quantitative trading | LLM is only used for offline research, strategy explanation, and candidate plans; order hot path must not pass through general Harness loop, LLM, or HITL; online objects must be signed compiled strategy artifacts, with backtest evidence, pre-market deterministic risk control, hard limits, kill switch, and post-market audit |
| E-commerce | Pricing, inventory, refund all managed as SideEffect; must have price floor, inventory reservation, refund threshold, campaign rollback window, and oversell incident workflow |
| Advertising promotion | Ad consumption uses independent `ad_spend_ledger`; creative approval and delivery execution separated; real-time bidding uses deterministic policy and bid adjustment bounds, not dependent on LLM hot path |
| Financial services | Adverse credit/credit decision must generate adverse action explanation, fairness assessment package, and regulatory evidence package; LLM-as-Judge must not serve as final compliance decision; high-risk actions require licensed/authorized reviewer signoff |
| Data processing | Sink must declare idempotency contract; Replay must be lineage-aware; data quality rules are versioned assets; destructive migration requires shadow compare and manual approval |
| Code development | Agent written code defaults to branch-only; merge must pass PR, CI, SAST, dependency/license/secret scan, and CODEOWNER review |
| User operations | Reach frequency control is platform hard limit; segmentation needs sensitive attribute/proxy variable detection; experiments need consent, holdout protection, and ethical boundary |
| Industry research | Each fact assertion default requires citation; source must pass license/ToS check; prediction output must give confidence interval or uncertainty description |
| Academic research | Citations must be verified by DOI/CrossRef/PubMed and other resolvers; statistical analysis output reproducible notebook artifact; must execute plagiarism/authorship policy |
| Enterprise knowledge base | Real-time ACL check when querying; answer default carries citation; permission mirror has freshness SLO; expired knowledge triggers stale alert and trust downgrade |
| Finance | Multi-currency actions must record base_currency and FX snapshot; four-eye approval/SoD is platform-level capability; voucher, report, and financial evidence package immutable with signoff chain |
| Legal | Default only provides legal information; before forming legal advice, outbound text, or actionable output, must have attorney review; privilege, jurisdiction, legal hold are first-class classification fields |
| Online live streaming | Real-time moderation hot path prioritizes edge/deterministic moderation; stream cut is high-risk side effect, must have stream kill switch, appeal/reinstate workflow, and minor protection strategy |
| Ad creative production | Generated assets must carry provenance, C2PA, watermark, copyright/trademark similarity scan, and brand rule version; must not directly publish to external channels |
| Game development | Assets need IP similarity scan; value balance configuration must not auto-write to production; QA evidence binds to release gate |
| Game publishing | Each platform independent compliance matrix; age rating, anti-addiction, payment, regional policy versioned; LiveOps configuration needs approval |
| Human resources | Recruitment/promotion output recommendation-only, must not auto-eliminate; must conduct bias audit and protected attribute handling; HR data default does not enter long-term/shared memory |
| Supply chain & logistics | Large purchase, dangerous goods, export control trigger hard approval; forecast anomaly trigger circuit breaker; offline side effect submitted by dependency graph topology |
| Healthcare | Platform only provides clinical decision support, not diagnosis principal; PHI strong isolation; diagnosis and treatment suggestion needs physician signoff; emergency/urgent path must not depend on LLM; medical evidence package immutable |
| Education & training | Minor data needs guardian/school consent; provide content by age tier strategy; default Socratic tutoring mode; academic integrity guardrail prevents direct homework |
| Customer service | Business commitment needs promise checker; refund/compensation by threshold approval; `max_unresolved_turns = 3` then transfer to manual; negative emotion triggers escalation |
| Content moderation & security | CSAM/extreme content reported by jurisdiction process; appeal and evidence retention have dedicated state machine; reviewer protection recorded as governance requirement |
| IT operations SRE/DevOps | Auto fix only allowed for known-runbook-only; blast radius limit is single node/single service; comply with change window; platform failure needs out-of-band break-glass |
| Marketing & brand | External content needs brand consistency, advertising law/industry law check, claim evidence, and crisis PR escalation path |

---

# 71. Quantitative Trading Domain Architecture

> Related: §37 Business domain modeling · §30 Business Pack · §10 Risk control · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §1

**DomainDescriptor Mapping**:

- `domain_id`: `quant-trading` · `recipe_archetype`: Trading + Realtime
- `risk_level`: Critical · `latency_tier`: ultra_low (execution path <10ms)
- `hitl_intensity`: High · `regulatory_density`: Critical (CSRC/SEC/MiFID II)

**Core Agent Roles**: Signal generation · backtest · execution · risk management · portfolio optimization

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| ------------------------- | ------------- | ----------- | ------------------------ |
| `tool.order.submit` | 60 | 95 | Mandatory pre-market risk control+position limit check |
| `tool.strategy.deploy` | 50 | 90 | Manual approval + backtest verification |
| `tool.risk_limit.modify` | 50 | 95 | domain_owner + risk manager dual approval |
| `tool.market_data.read` | 20 | 20 | Auto execute |

**DomainEvalFramework**: Sharpe Ratio ≥ threshold · Max drawdown ≤ limit · Implementation Shortfall · Risk limit compliance rate · System availability 99.99%

**DomainKnowledgeSchema**: Market data real-time API · Risk parameter structured query · Strategy configuration versioning · Conflict strategy source_priority (exchange > backup source)

**HITL Strategy**: Strategy launch/risk limit change/fund allocation change mandatory manual approval; real-time P&L dashboard + one-click kill-switch; post-market compliance review daily signoff

**Key Guardrails**: Pre-market rationality check (max single volume/max notional/rate limit) · Hard position limit cannot be overridden by Agent · Data source stale >N seconds auto close position · Circuit breaker

**Agent Workflow (Detailed)**:

- Signal Generation Agent: Data ingest → feature engineering → model inference → signal ranking → risk control filter → order generation
- Backtest Agent: Strategy definition → historical replay → simulated execution (including slippage/fees) → performance report
- Execution Agent: Target portfolio → execution plan (TWAP/VWAP/IS) → cross-exchange routing → execution monitoring → algorithm parameter real-time adjustment
- Risk Management Agent: Continuous exposure monitoring (industry/factor/Greeks) → position limit → circuit breaker → VaR/CVaR → margin call notification
- Portfolio Optimization Agent: Mean variance/Black-Litterman/risk parity → constraints (turnover/industry cap/ESG)

**Key Tools/Integrations**:
| Category | Specific Tools |
| -------- | ---- |
| Market data | Bloomberg B-PIPE, Refinitiv Elektron, Wind, CTP/FEMAS, IEX Cloud, Polygon.io |
| Trade execution | FIX 4.2/4.4 gateway, broker OMS/EMS API (IB/CITIC/Huatai PB), DMA direct connection |
| Backtest engine | Zipline, Backtrader, QuantConnect, self-developed event-driven engine |
| Risk control | RiskMetrics, Axioma, Barra factor model, internal VaR engine |
| Infrastructure | KDB+/q time-series database, Redis, Kafka, FPGA/kernel bypass |

**Data Sensitivity Classification**:

- Extremely confidential: Trading strategy, alpha signal, position, P&L (core IP)
- Confidential: Backtest result, risk control parameters, customer portfolio configuration
- Internal: Market data (license restricted redistribution), execution analysis

**Performance/Latency Budget**:

- Market processing: HFT <1ms tick-to-signal; mid-frequency <100ms
- Order placement: Single-digit microseconds (FPGA) to low millisecond level
- Risk control check: Pre-market check <50μs added latency
- Backtest: Years of Tick data minute-level replay (parallelized)
- Availability: Trading hours 99.99%

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Data source damage/delay | Switch backup source, stale data detection, gap >N seconds auto close position |
| Strategy generates extreme signal | Pre-market rationality check, circuit breaker |
| Execution venue disconnection | Auto route backup venue, order queuing, notify manual |
| Risk limit breach | Immediately close position, disable strategy, notify risk manager |
| Model overfitting | Online monitor signal decay, auto lower weight, regime detection |

---

# 72. E-commerce Domain Architecture

> Related: §37 Business domain modeling · §30 Business Pack · §21 HITL · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §2

**DomainDescriptor Mapping**:

- `domain_id`: `ecommerce` · `recipe_archetype`: CRUD-heavy + Realtime
- `risk_level`: High · `latency_tier`: realtime (search/recommendation <200ms, risk control <500ms)
- `hitl_intensity`: Medium · `regulatory_density`: Medium (e-commerce law/consumer protection law/PCI-DSS)

**Core Agent Roles**: Product listing · pricing · inventory fulfillment · customer service · recommendation · transaction risk control

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| ----------------------- | ------------- | ----------- | --------------------- |
| `tool.price.update` | 40 | 80 | Over-threshold change manual approval |
| `tool.refund.issue` | 50 | 70 | Over-amount threshold manual approval |
| `tool.listing.publish` | 30 | 60 | Controlled category manual review |
| `tool.inventory.sync` | 30 | 30 | Auto execute |

**DomainEvalFramework**: GMV · conversion rate · CSAT/NPS · inventory turnover rate · risk control precision/recall · recommendation CTR

**HITL Strategy**: Price change >X% manual approval · Over-threshold refund manual approval · Controlled category listing review · Customer service first N reply training period review

**Key Guardrails**: Bottom price constraint (prevent pricing ¥0.01) · inventory safety buffer · customer service reply based on policy retrieval (prevent hallucination commitment) · multi-PSP payment switching

**Agent Workflow (Detailed)**:

- Product Listing Agent: Generate description → title SEO → classification → image attribute extraction → multi-platform listing (Tmall/JD/Amazon)
- Pricing Agent: Competitor monitoring → dynamic pricing model (elasticity/inventory/profit) → discount/promotion execution
- Inventory Fulfillment Agent: Demand forecast → replenishment trigger → warehouse allocation → third-party logistics coordination → split shipping
- Customer Service Agent: Pre-sales consultation → after-sales processing → complex case escalation → reply template generation
- Recommendation Agent: User profile → collaborative filtering/hybrid model → personalization → A/B test
- Risk Control Agent: Real-time scoring (rate/device/address) → suspicious order marking → chargeback dispute

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Platform | Shopify API, Tmall/Taobao Open Platform, JD Kepler, Amazon SP-API, Pinduoduo |
| Payment | Alipay, WeChat Pay, Stripe, PayPal, Adyen |
| Logistics | SF Express API, Cainiao, FedEx/UPS/DHL, WMS (Manhattan, Blue Yonder) |
| Search/Recommendation | Elasticsearch, Algolia, Pinecone, TensorFlow Recommenders |
| CRM | Salesforce, HubSpot, Youzan, Weimob |

**Data Sensitivity Classification**:

- PII (high): Customer name, address, mobile phone, payment information (PCI-DSS scope)
- Confidential: Pricing strategy, supplier cost, profit data, inventory level
- Internal: Product catalog, aggregated sales data, A/B test results

**Performance/Latency Budget**:

- Search/recommendation: p99 <200ms
- Price update: Competition response <5 minutes, planned promotion batch
- Risk control scoring: Per transaction <500ms (synchronous checkout)
- Customer service: Chat first response <3s, ticket <2h
- Inventory sync: Multi-channel <1 minute

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Price bot war | Bottom price constraint, profit guardrail, threshold manual alert |
| Inventory sync delay causing oversell | Reserve inventory management, safety inventory buffer, auto compensation |
| Customer service Agent hallucination policy | Grounded generation based on policy retrieval, force cite policy document |
| Recommendation cold start | Popular product fallback, demographic default value, preference collection |
| Payment gateway failure | Multi-PSP switch, queue retry, customer notification |

---

# 73. Advertising Promotion Domain Architecture

> Related: §37 Business domain modeling · §18 Cost management · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §3

**DomainDescriptor Mapping**:

- `domain_id`: `advertising` · `recipe_archetype`: Creative + Analytics
- `risk_level`: Medium · `latency_tier`: near_realtime (bidding <100ms, report 15min delay acceptable)
- `hitl_intensity`: Medium · `regulatory_density`: Medium (advertising law/platform policy/GDPR tracking consent)

**Core Agent Roles**: Delivery planning · creative generation · bid optimization · audience management · attribution report

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| ------------------------- | ------------- | ----------- | -------------------------- |
| `tool.campaign.launch` | 40 | 75 | Budget commitment + creative approval |
| `tool.bid.adjust` | 30 | 50 | Over-budget threshold manual approval |
| `tool.creative.publish` | 30 | 70 | Brand/legal review before online |
| `tool.audience.create` | 20 | 50 | Sensitive attribute targeting needs privacy review |

**DomainEvalFramework**: ROAS · CPA · CTR · brand uplift · budget pacing accuracy · creative quality score · attribution accuracy

**HITL Strategy**: Delivery launch approval (budget commitment) · Creative online pre-brand/legal review · Sensitive category audience targeting review · Budget increase >X% approval

**Key Guardrails**: Hard daily/hourly budget upper limit · Pre-submission compliance check (advertising law absolute wording detection) · Auto audience expansion fallback · Frequency upper limit mandatory

**Agent Workflow (Detailed)**:

- Delivery Planning Agent: Business goal analysis → media plan (channel/budget/schedule/targeting)
- Creative Generation Agent: Platform specification adaptation (Douyin vertical/WeChat Moments card/Google adaptive) → A/B variants
- Bid Optimization Agent: Cross-DSP real-time bidding → conversion probability/budget pacing/competition adjustment → target CPA/ROAS
- Audience Management Agent: First-party/second-party/third-party data build segment → Lookalike → frequency upper limit → cross-device connection
- Attribution & Report Agent: Cross-touchpoint conversion collection → multi-touch attribution (Shapley/Markov) → effect dashboard

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Ad platform | Google Ads, Meta Marketing, Ocean Engine, Tencent Ads, Baidu Marketing, Kuaishou Magnet |
| DSP | The Trade Desk, DV360, MediaMath |
| Creative | Canva API, Figma API, Midjourney/DALL-E, RunwayML |
| Analytics | Google Analytics, Adobe Analytics, AppsFlyer/Adjust |
| Brand safety | IAS, DoubleVerify, MOAT |

**Data Sensitivity Classification**:

- PII (high): Customer email list, CRM data, device ID
- Confidential: Delivery effect, bidding strategy, customer acquisition cost, creative test results
- Internal: Aggregated reach/frequency data, market benchmark

**Performance/Latency Budget**:

- Bidding decision: RTB <100ms
- Delivery adjustment: Hourly budget pacing, daily bid optimization
- Creative generation: Copy minute level, image/video hour level (async)
- Report: Near real-time dashboard 15 minute delay

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Bidding error causing budget overspend | Hard daily/hourly budget upper limit, real-time spend monitoring auto pause |
| Creative rejected by platform | Pre-submission compliance check Agent, already reviewed template library |
| Audience too narrow to deliver | Auto audience expansion trigger, Lookalike fallback |
| Attribution data loss | Modeled conversion, MMM backup |
| Ad fatigue | Auto creative rotation, frequency upper limit mandatory, refresh trigger |

---

# 74. Financial Services Domain Architecture

> Related: §37 Business domain modeling · §23 Compliance · §49 Compliance policy engine · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §4

**DomainDescriptor Mapping**:

- `domain_id`: `financial-services` · `recipe_archetype`: Compliance + Trading
- `risk_level`: Critical · `latency_tier`: realtime~batch (fraud <200ms, KYC <30s, regulatory report batch processing)
- `hitl_intensity`: Critical · `regulatory_density`: Critical (Basel III/AML law/Solvency II/EU AI Act)

**Core Agent Roles**: Credit assessment · KYC/AML · insurance underwriting · claim processing · regulatory report

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| ------------------------- | ------------- | ----------- | ---------------------------- |
| `tool.credit.approve` | 50 | 95 | Over-threshold mandatory manual approval + explainability |
| `tool.sar.submit` | 50 | 95 | Legally required manual review |
| `tool.claim.adjudicate` | 50 | 80 | Over-auto-decision limit manual review |
| `tool.model.deploy` | 50 | 90 | Fairness test + manual approval |

**DomainEvalFramework**: Gini coefficient/KS statistic · SAR quality (regulatory feedback) · loss rate/composite cost rate · model stability (PSI) · regulatory inspection findings

**HITL Strategy**: Over-threshold loan approval mandatory · SAR/STR report legal required manual review · Model deployment/retraining mandatory approval · Adverse credit decision must be reviewable · Many jurisdictions require "meaningful human involvement"

**Key Guardrails**: Fairness test (disparate impact analysis) · PSI monitoring auto rollback · reconciliation check + data lineage tracking · multi-factor KYC verification

**Agent Workflow (Detailed)**:
- Credit Assessment Agent: Applicant data collection → scorecard/ML scoring → approval suggestion+explanation → loan term structuring
- KYC/AML Agent: ID OCR+liveness detection → sanctions list screening (OFAC/UN/EU) → suspicious transaction monitoring → SAR/STR report
- Insurance Underwriting Agent: Risk factor analysis → policy pricing → exclusions → policy document generation
- Claim Processing Agent: Application reception → coverage verification → fraud detection → claim estimation → routing for review or auto approval
- Regulatory Report Agent: Cross-system aggregation → report generation (Basel III/CCAR) → integrity verification → submission

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Credit reporting | PBOC Credit, Experian, Equifax, TransUnion, Baihang Credit |
| Sanctions/AML | World-Check, Dow Jones, OFAC SDN, Chainalysis |
| Document processing | ABBYY, Tesseract OCR, AWS Textract |
| Core banking | Temenos, FIS, Sunline, GienTech |
| Insurance platform | Guidewire, Duck Creek, Sinosoft |

**Data Sensitivity Classification**:

- Extremely sensitive (PII+financial): ID number/SSN, bank account, credit report, medical record (insurance), tax filing
- Confidential: Risk model, pricing algorithm, position information, customer list
- Regulated: All transaction data retained 5-7 years

**Performance/Latency Budget**:

- Fraud scoring: <200ms · Credit pre-approval: <5s
- KYC verification: Auto <30s, enhanced due diligence <24h
- Claim processing: Simple auto decision <1min, complex with manual <48h
- Regulatory report: Batch processing, strict deadline (T+1 or monthly)

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Model drift causing bad credit | PSI monitoring, champion-challenger test, auto rollback |
| AML false positive overload | Risk-based priority sorting, feedback loop optimization, layered review |
| Regulatory report data inconsistency | Reconciliation check, data lineage tracking, pre-submission verification |
| Deploying biased model | Pre-deployment fairness test, continuous monitoring by protected group |
| KYC document forgery | Multi-factor verification, liveness detection, government database cross-check |

---

# 75. Data Processing Domain Architecture

> Related: §37 Business domain modeling · §29 Knowledge/Memory · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §5

**DomainDescriptor Mapping**:

- `domain_id`: `data-engineering` · `recipe_archetype`: Analytics + CRUD-heavy
- `risk_level`: Medium · `latency_tier`: sla_driven (batch processing SLA-driven, stream processing sub-second)
- `hitl_intensity`: Medium · `regulatory_density`: Medium (data governance/GDPR deletion right/data residency)

**Core Agent Roles**: Pipeline orchestration · data quality · Schema management · data lineage · anomaly detection

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --------------------------- | ------------- | ----------- | -------------------------- |
| `tool.schema.migrate` | 50 | 85 | Destructive change mandatory manual approval |
| `tool.pipeline.deploy_prod` | 50 | 75 | Code review before first production run |
| `tool.data.delete` | 60 | 90 | Data deletion request mandatory approval |
| `tool.pipeline.retry` | 20 | 20 | Auto execute (idempotency guarantee) |

**DomainEvalFramework**: SLA achievement rate · data quality check pass rate · pipeline generation correctness rate · compute cost trend · lineage coverage

**HITL Strategy**: Schema migration approval (destructive change) · production pipeline deployment · data deletion request · sensitive dataset access authorization

**Key Guardrails**: Schema drift detection · idempotent write mode · budget alert + pre-execution query cost estimation · sensitive data minimization access

**Agent Workflow (Detailed)**:

- Pipeline Orchestration Agent: Natural language requirement → DAG generation (Airflow/Dagster) → scheduling/retry/dependency management
- Data Quality Agent: Inbound profiling → validation rules (Schema/range/uniqueness/referential integrity) → bad record isolation → quality report
- Schema Management Agent: Source system change detection → migration script → downstream impact assessment → Schema registry
- Data Lineage Agent: Source to consumption tracking → lineage graph → impact analysis → audit trail
- Anomaly Detection Agent: Data volume/freshness/distribution drift/pipeline latency monitoring → root cause alert

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Orchestration | Apache Airflow, Dagster, Prefect, dbt, Luigi |
| Stream processing | Kafka, Flink, Spark Structured Streaming, Pulsar |
| Storage | Snowflake, Databricks, BigQuery, Delta Lake, Iceberg |
| Quality | Great Expectations, dbt tests, Monte Carlo, Soda |
| Catalog/Lineage | Apache Atlas, DataHub, Amundsen, OpenLineage |

**Data Sensitivity Classification**:

- High: PII columns (must desensitize/tokenize), financial data, health data
- Medium: Business metrics, operational data
- Low: Public datasets, reference data
- Agent needs to access metadata, should minimize access to actual sensitive data

**Performance/Latency Budget**:

- Batch processing pipeline: SLA-driven (e.g., daily aggregation ready before 6am)
- Stream processing: Real-time sub-second, near real-time second level
- Data quality check: Does not add >10% pipeline runtime
- Lineage query: Impact analysis <5s
- Agent response: Pipeline generation second level, complex optimization minute level

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Pipeline running failure | Checkpoint, idempotent operation, auto backoff retry |
| Source Schema change interruption | Drift detection, new field auto-adaptation, destructive change manual review |
| Data quality regression | Auto isolate bad batch, rollback to last good data, SLA violation alert |
| Cost out of control | Budget alert, scaling limit, query cost estimation |
| Retry causing duplicates | Idempotent write (upsert/dedupe key), exactly-once semantics |

---

# 76. Code Development Domain Architecture

> Related: §37 Business domain modeling · §30 Business Pack · §11 Security · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §6
> Existing instance: `src/domains/coding/`

**DomainDescriptor Mapping**:

- `domain_id`: `coding` · `recipe_archetype`: Creative + Adversarial
- `risk_level`: High · `latency_tier`: realtime (completion <500ms, review <5min)
- `hitl_intensity`: High · `regulatory_density`: Low-Medium (license/SOC2/industry-specific)

**Core Agent Roles**: Code generation · code review · testing · CI/CD · security scan · debugging

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| ------------------------- | ------------- | ----------- | -------------------------- |
| `tool.code.merge` | 50 | 80 | Mandatory manual developer review |
| `tool.deploy.production` | 60 | 90 | Manual approval + security scan pass |
| `tool.code.generate` | 30 | 40 | Manual review required before merge |
| `tool.security.fix` | 40 | 60 | Security team approval |

**DomainEvalFramework**: Generated code test pass rate · bug detection true positive rate · suggestion adoption rate · vulnerability detection rate · license compliance rate

**HITL Strategy**: All generated code must be manually reviewed before merge · production deployment requires manual approval · security vulnerability fix decision · architecture decision

**Key Guardrails**: Pre-commit security scan hook · license compliance check · lock dependency version verification · scope-limited context window

**Agent Workflow (Detailed)**:

- Code Generation Agent: Natural language requirement → understand codebase context → generate implementation + tests
- Code Review Agent: PR analysis → bug/security vulnerability/style/performance/architecture issues → line-level comments + fix suggestions
- Testing Agent: Unit/integration/E2E test generation → untested path identification → fixtures and Mocks → coverage target
- CI/CD Agent: Build pipeline management · failure interpretation · deployment orchestration · feature flags · canary analysis
- Security Scan Agent: SAST/DAST/SCA → classification → reduce false positive → fix suggestion → vulnerability lifecycle
- Debugging Agent: Error log/stack trace analysis → root cause hypothesis → fix suggestion → test environment reproduction

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Version control | GitHub, GitLab, Bitbucket API |
| CI/CD | GitHub Actions, Jenkins, GitLab CI, CircleCI, ArgoCD |
| Security | Snyk, SonarQube, Semgrep, Trivy, Dependabot, CodeQL |
| Testing | Jest, Pytest, JUnit, Playwright, Cypress, k6 |
| Code analysis | Tree-sitter, Language Servers (LSP), ESLint, Ruff |
| Monitoring | Sentry, Datadog, PagerDuty, Grafana |

**Data Sensitivity Classification**:

- Extremely sensitive: Source code (core IP), keys/credentials, deployment configuration
- Confidential: Build logs, security scan results, architecture diagrams
- Internal: Public dependency information, common coding standards

**Performance/Latency Budget**:

- Code completion: Inline suggestion <500ms (IDE experience)
- Code review: Typical PR <5 minutes (async acceptable)
- Test generation: Single function second level, module minute level
- Security scan: Incremental minute level, full codebase hour level
- CI/CD: Build/test should not be Agent bottleneck

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Generated code cannot compile | Iterative fix loop: compile→parse error→fix→retry (up to N times) |
| Agent suggests deprecated API | Lock dependency version, verify actual installed package API |
| Introducing security vulnerability | Pre-commit security scan hook, sensitive file mandatory security review |
| Test instability | Deterministic test mode, explicit Mock, retry detection marker |
| Modifying wrong scope | Scope-limited context window, multi-file change confirmation prompt |

---

# 77. User Operations Domain Architecture

> Related: §37 Business domain modeling · §23 Compliance (PIPL/GDPR) · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §7

**DomainDescriptor Mapping**:

- `domain_id`: `user-operations` · `recipe_archetype`: Analytics + CRUD-heavy
- `risk_level`: Medium · `latency_tier`: near_realtime (trigger campaign <5min, batch segmentation daily)
- `hitl_intensity`: Medium · `regulatory_density`: Medium (PIPL/GDPR/CAN-SPAM/TCPA)

**Core Agent Roles**: Segmentation · lifecycle management · churn prediction · marketing automation · group analysis

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| -------------------------- | ------------- | ----------- | -------------------------- |
| `tool.campaign.send` | 30 | 60 | Campaign content approval |
| `tool.segment.create` | 20 | 50 | Sensitive attribute segmentation needs privacy review |
| `tool.notification.push` | 20 | 40 | Frequency upper limit mandatory |
| `tool.ab_test.launch` | 30 | 40 | A/B test launch review |

**DomainEvalFramework**: Retention rate (D1/D7/D30) · churn rate · LTV/CAC ratio · campaign open rate/CTR · NPS/CSAT

**HITL Strategy**: Campaign content approval · sensitive attribute new segment review · notification frequency policy change · incentive campaign budget allocation

**Key Guardrails**: Frequency upper limit mandatory · engagement score gating · pre-send segment size validation · real-time preference center sync · opt-out list hard mandatory

**Agent Workflow (Detailed)**:

- Segmentation Agent: Behavior data analysis (event/transaction/interaction) → RFM/behavioral clustering/predictive attribute → dynamic segmentation
- Lifecycle Management Agent: Acquire→activate→retain→monetize→refer → stage intervention → personalized touchpoint
- Churn Prediction Agent: Behavior signal (engagement decline/ticket/feature abandonment) → churn model → high-risk list + intervention suggestion
- Marketing Automation Agent: Multi-touchpoint campaign (Push/email/in-app/SMS) → send time optimization → frequency upper limit
- Group Analysis Agent: Acquisition channel/time/behavior → retention curve → high-value group identification → insight report

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| CDP/Analytics | Segment, Amplitude, Mixpanel, Sensors Data, GrowingIO, Umeng |
| Marketing automation | Braze, CleverTap, JIGUANG, Getui, Iterable |
| Communication | Twilio (SMS), SendGrid (email), APNs/FCM, WeChat/WeChat Work API |
| A/B testing | Optimizely, LaunchDarkly, Firebase Remote Config |
| Data warehouse | Snowflake, BigQuery, ClickHouse |

**Data Sensitivity Classification**:

- PII (high): User profile, contact information, behavior data associated with identifiable users
- Sensitive behavior: Location, health/fitness, financial behavior, browsing history
- Aggregated (low): Group-level metrics, anonymous funnel data

**Performance/Latency Budget**:

- Segmentation update: Triggered <5 minute delay, batch daily
- Campaign trigger: Real-time event to message delivery <1 minute
- Churn prediction: Daily scoring, high-value user real-time
- A/B test result: Statistical significance monitoring, daily report

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Notification fatigue (unsubscribe surge) | Frequency upper limit, engagement score gating, auto cool-down |
| Wrong personalization | Content safety review, fallback to general message, sensitive topic detection |
| Churn model false positive | Tiered intervention (low cost first), A/B test intervention, feedback to model |
| Send to wrong segment | Pre-send segment size validation, sandbox test, progressive release |
| Not respecting opt-out preference | Real-time preference center sync, hard opt-out mandatory at send layer |

---

# 78. Industry Research Domain Architecture

> Related: §37 Business domain modeling · §29 Knowledge/Memory · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §8

**DomainDescriptor Mapping**:

- `domain_id`: `industry-research` · `recipe_archetype`: Research + Analytics
- `risk_level`: Low · `latency_tier`: batch (report hour~day, breaking alert <15min)
- `hitl_intensity`: High · `regulatory_density`: Low (securities law/data license/copyright)

**Core Agent Roles**: Market analysis · competitive intelligence · trend prediction · report generation · regulatory tracking

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| -------------------------- | ------------- | ----------- | -------------------------- |
| `tool.report.publish` | 30 | 80 | Manual analyst review required before release |
| `tool.data.scrape` | 40 | 60 | Copyright/license compliance check |
| `tool.forecast.generate` | 30 | 50 | Forward-looking statements must add disclaimer |
| `tool.alert.send` | 20 | 30 | Auto execute (low-risk information push) |

**DomainEvalFramework**: Fact correctness rate · source citation rate · insight output time · related source coverage · analyst satisfaction

**HITL Strategy**: All published research must be manually reviewed by analyst · quantitative claims must cite source · forward-looking statements must add disclaimer

**Key Guardrails**: All quantitative claims mandatory source citation · data timestamp + freshness check · rewrite ratio monitoring (prevent copyright infringement) · counter-evidence section requirement

**Agent Workflow (Detailed)**:

- Market Analysis Agent: Multi-source data collection (financial database/news/statistics/report) → market size/growth/competitive landscape → structured report
- Competitive Intelligence Agent: Competitor activity monitoring (product/pricing/recruitment/patent/regulation) → competitor profile → change alert
- Trend Prediction Agent: Patent/paper/financing/social/policy signal → emerging trend identification → confidence forward-looking
- Report Generation Agent: Finding→structured report (executive summary/methodology/recommendation) → multi-format → rigorous citation
- Regulatory Tracking Agent: Cross-jurisdiction regulatory change → business impact assessment → compliance gap analysis → change calendar

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Data source | Wind, Bloomberg, Statista, IBISWorld, National Bureau of Statistics, Euromonitor |
| News/Media | NewsAPI, GDELT, Caixin/36kr API, social listening |
| Patent | WIPO, USPTO, CNIPA, Google Patents |
| Financial report | SEC EDGAR, Cninfo, ExFact |
| NLP | Sentiment analysis, NER, summary generation |

**Data Sensitivity Classification**:

- Confidential: Proprietary research findings, customer-specific analysis, competitive strategy recommendations
- Licensed: Third-party data (Bloomberg/Wind) license restricted redistribution
- Public: Government statistics, published reports, public news

**Performance/Latency Budget**:

- Alert generation: Breaking news/regulatory change <15 minutes
- Report generation: Hour to day level (async), comprehensive report may take hours
- Data refresh: Market daily, competitor weekly, deep quarterly

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Hallucinated statistical data | All quantitative claims mandatory source citation, validation Agent cross-check |
| Stale data treated as current | All data points add timestamp, freshness check, over-threshold marker |
| Copyright infringement | Attribution summary, fair use guide, rewrite ratio monitoring |
| Missing key competitors | Multi-source cross-reference, gap detection checklist, manual scope review |
| Trend identification bias | Counter-evidence requirement, multi-perspective prompting, uncertainty quantification |

---

# 79. Academic Research Domain Architecture

> Related: §37 Business domain modeling · §29 Knowledge/Memory · §23 Compliance · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §9

**DomainDescriptor Mapping**:

- `domain_id`: `academic-research` · `recipe_archetype`: Research
- `risk_level`: Low · `latency_tier`: batch (literature review hour~day, writing assistance real-time)
- `hitl_intensity`: High · `regulatory_density`: Medium (research ethics/publication ethics/data regulations)

**Core Agent Roles**: Literature review · hypothesis generation · experiment design · data analysis · writing and publication

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| -------------------------- | ------------- | ----------- | -------------------------- |
| `tool.manuscript.submit` | 30 | 90 | Manual researcher complete review |
| `tool.citation.insert` | 10 | 70 | Every citation must be DOI verified |
| `tool.analysis.run` | 20 | 50 | Assumption check + manual statistician review |
| `tool.literature.search` | 10 | 10 | Auto execute |

**DomainEvalFramework**: Citation accuracy 100% (zero fabrication) · statistical correctness · reproducibility · literature coverage · writing quality

**HITL Strategy**: All published content must be manually reviewed by researcher · hypothesis selection/experiment design approval · statistical method selection · researcher must bear intellectual responsibility

**Key Guardrails**: Every citation automatic DOI/database verification · duplicate check tool integration · assumption check Agent layer · isolated processing environment (prevent data leak)

**Agent Workflow (Detailed)**:

- Literature Review Agent: Academic database search (Semantic Scholar/PubMed/CNKI/arXiv) → ranking → key finding extraction → research gap → standardized citation management
- Hypothesis Generation Agent: Cross-paper finding analysis → contradiction/unexplored intersection → testable hypothesis + experiment method suggestion
- Experiment Design Agent: Sample size calculation → control group → statistical test → confounding variable → pre-registration document
- Data Analysis Agent: Statistical analysis (regression/ANOVA/survival analysis) → visualization → common error check (p-hacking/multiple comparison)
- Writing and Publication Agent: Journal formatting → summary generation → references (BibTeX/EndNote) → submission package

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Academic database | Semantic Scholar, PubMed/MEDLINE, arXiv, CNKI, Web of Science, Scopus |
| Citation management | Zotero, Mendeley, EndNote |
| Data analysis | R, Python (scipy/statsmodels/pandas), SPSS, Stata |
| LaTeX | Overleaf API, LaTeX compilation toolchain |
| Reproducibility | Jupyter, R Markdown, Docker, DVC, MLflow |
| Pre-registration | OSF, AsPredicted |

**Data Sensitivity Classification**:

- High: Human subject data (IRB), patient data (HIPAA), unpublished results, grant applications
- Medium: Pre-publication manuscripts, preliminary results, peer review opinions
- Low: Published papers, public datasets

**Performance/Latency Budget**:

- Literature search: Initial <30s, comprehensive search minute level
- Statistical analysis: Second to minute level
- Writing assistance: Real-time or near real-time
- Complete literature review: Hour to day level (async)

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Citation fabrication | Every citation automatic DOI/database verification |
| Statistical method misuse | Assumption check layer, diagnostic test, manual statistician review |
| Generated text plagiarism | Integrate duplicate check (Turnitin/iThenticate), originality scoring |
| Missing related literature | Multi-database search, citation chain tracking, expert coverage review |
| Unpublished result leak | Strict access control, isolated processing environment |

---

# 80. Enterprise Knowledge Base Domain Architecture

> Related: §37 Business domain modeling · §50 Knowledge domain isolation · §11 Security · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §10

**DomainDescriptor Mapping**:

- `domain_id`: `knowledge-base` · `recipe_archetype`: CRUD-heavy
- `risk_level`: Medium · `latency_tier`: realtime (search <2s, comprehensive answer <5s)
- `hitl_intensity`: Medium · `regulatory_density`: Medium (data retention/access control/privacy)

**Core Agent Roles**: Document processing · knowledge graph · semantic search · FAQ generation · knowledge gap analysis

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| ---------------------------- | ------------- | ----------- | -------------------------- |
| `tool.search.query` | 10 | 40 | Real-time access permission check when querying |
| `tool.document.ingest` | 20 | 50 | New document source access needs approval |
| `tool.answer.synthesize` | 20 | 60 | Low confidence answer "I don't know" |
| `tool.content.retire` | 30 | 70 | Content retirement needs domain_owner decision |

**DomainEvalFramework**: MRR/NDCG/precision@k · answer faithfulness · citation accuracy · coverage · zero unauthorized access events

**HITL Strategy**: Access control policy definition · sensitive document classification · error correction when Agent answer is wrong · content retirement decision

**Key Guardrails**: Source system permission mirror + access check at query time · mandatory citation with verifiable link · document freshness tracking + stale alert · hierarchical chunking

**Agent Workflow (Detailed)**:

- Document Processing Agent: Multi-format ingest (PDF/Word/PPT/Confluence/email/meeting minutes) → structured extraction → chunking → metadata maintenance
- Knowledge Graph Agent: NLP entity/relationship extraction → graph construction (person/project/technology/process) → disambiguation → cross-domain association
- Semantic Search Agent: Natural language query → hybrid search (keyword+vector) → re-ranking → comprehensive answer with citation
- FAQ Generation Agent: High-frequency question identification (ticket/chat/search) → FAQ generation and maintenance → outdated detection
- Knowledge Gap Analysis Agent: Undocumented process → stale content → contradiction → continuously unmatched query

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Document source | Confluence, SharePoint, Google Drive, Notion, Feishu, DingTalk |
| Vector database | Pinecone, Weaviate, Milvus, Qdrant, pgvector |
| Knowledge graph | Neo4j, Amazon Neptune, TigerGraph |
| Embedding model | OpenAI Embeddings, BGE, Cohere Embed, Jina |
| Document parsing | Unstructured.io, LlamaParse, Adobe PDF Services |
| Search engine | Elasticsearch, OpenSearch, Typesense |

**Data Sensitivity Classification**:

- Extremely confidential: Executive strategy document, M&A material, personnel file, legal opinion
- Confidential: Internal policy, technical architecture, project document, financial data
- Internal: General process, training material, product document
- Must implement document-level access control consistent with source system permission

**Performance/Latency Budget**:

- Search/query: Result <2s, LLM comprehensive answer <5s
- Document ingest: Minute to hour level (batch acceptable)
- Knowledge graph update: Key document near real-time, general daily batch
- Availability: Working hours 99.9%

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Search leaking confidential | Source system permission mirror, query-time access check, audit log |
| Hallucinated answer | Mandatory citation link, faithfulness score, low confidence answer "I don't know" |
| Returning stale content | Freshness tracking, auto stale alert, deprecation workflow |
| Poor chunking quality | Hierarchical chunking with overlap, parent-child retrieval, rich metadata |
| Knowledge graph inconsistency | Conflict detection, source tracking, manual arbitration workflow |

---

# 81. Finance Domain Architecture

> Related: §37 Business domain modeling · §23 Compliance · §49 Compliance policy engine · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §11

**DomainDescriptor Mapping**:

- `domain_id`: `finance-accounting` · `recipe_archetype`: Compliance + CRUD-heavy
- `risk_level`: Critical · `latency_tier`: batch (monthly close window driven, ad hoc query <30s)
- `hitl_intensity`: Critical · `regulatory_density`: Critical (CAS/US GAAP/SOX/Golden Tax Phase IV/IFRS)

**Core Agent Roles**: Invoice processing · expense control · financial report · tax compliance · reconciliation · budget forecast

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| -------------------------- | ------------- | ----------- | ---------------------------- |
| `tool.journal.post` | 50 | 85 | Over-threshold voucher mandatory approval |
| `tool.financial.signoff` | 50 | 95 | CFO/Controller signoff |
| `tool.tax.file` | 50 | 95 | Tax filing submission mandatory manual approval |
| `tool.invoice.process` | 30 | 50 | Auto post after three-way match passes |

**DomainEvalFramework**: Straight-through processing rate · GL posting accuracy · reconciliation match rate · month close days · audit findings · SoD violation count

**HITL Strategy**: Over-threshold voucher approval · financial statement signoff (CFO/Controller) · tax filing submission · bad debt write-off · SOX required documented review · SoD enforcement

**Key Guardrails**: OCR confidence score + below-threshold manual review · three-way match verification · duplicate payment detection · exchange rate source verification (central bank/ECB) · period-end cutoff rules

**Agent Workflow (Detailed)**:

- Invoice Processing Agent: Reception (email/scan/electronic invoice) → OCR → three-way match → approval routing → ERP posting
- Expense Control Agent: Expense report policy compliance review → exception marker → auto approve within compliance → exception manual routing
- Financial Report Agent: Sub-ledger aggregation → consolidation (multi-entity/multi-currency) → three-statement generation → variance analysis
- Tax Compliance Agent: Tax liability calculation (VAT/income tax/withholding) → tax filing → transfer pricing documentation
- Reconciliation Agent: Cross-system matching (bank vs GL/inter-company/sub-ledger) → variance identification → resolution suggestion
- Budget and Forecast Agent: History+driver → forecast → scenario analysis → budget vs actual → rolling forecast

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| ERP | SAP S/4HANA, Oracle ERP Cloud, Yonyou U8/NC, Kingdee K/3/Cloud |
| Expense control | SAP Concur, Expensify, Ramp |
| Tax | Thomson Reuters ONESOURCE, Avalara, Aisino (Golden Tax System) |
| Banking | Bank API (PSD2/Open Banking), SWIFT, Bank-Enterprise Direct |
| OCR | ABBYY, Kofax, Baidu AI/Tencent AI OCR |
| BI | Tableau, Power BI, Fanruan FineReport |

**Data Sensitivity Classification**:

- Extremely confidential: Undisclosed financial results, executive compensation, M&A valuation, tax position
- Confidential: GL data, supplier contract, employee reimbursement, bank account
- Regulated: All financial records SOX/audit retention (7-10 years)

**Performance/Latency Budget**:

- Invoice processing: OCR+match <1min, same-day posting
- Monthly close: Target 3-5 days (from 10+ days shortened), batch processing within monthly close window
- Tax filing: Strict regulatory deadline (China VAT before 15th of each month)
- Reconciliation: Bank daily, other monthly
- Report: Ad hoc <30s, scheduled report within batch processing window

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| OCR misreading invoice amount | Confidence score+low-threshold manual review, three-way match verification |
| Wrong accounting period attribution | Period-end cutoff rules, verification with purchase/delivery date, reversing entry |
| Consolidation exchange rate error | Exchange rate source verification (central bank/ECB), translation and remeasurement reconciliation |
| Tax calculation error | Multi-method verification, prior period comparison, tax rate table verification |
| Duplicate payment | Duplicate detection (supplier+amount+date+invoice number), approval workflow |

---

# 82. Legal Domain Architecture

> Related: §37 Business domain modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §12

**DomainDescriptor Mapping**:

- `domain_id`: `legal` · `recipe_archetype`: Compliance + Adversarial
- `risk_level`: Critical · `latency_tier`: batch (contract review <1h, e-discovery throughput first)
- `hitl_intensity`: **Highest** (all output must be reviewed by practicing lawyer) · `regulatory_density`: Critical (Civil Code/Antitrust Law/GDPR/professional ethics)

**Core Agent Roles**: Contract review · regulatory compliance · litigation support · IP management · due diligence · policy drafting

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| -------------------------- | ------------- | ----------- | ------------------------------ |
| `tool.contract.review` | 30 | 80 | All results must be reviewed by lawyer |
| `tool.legal_opinion.draft` | 50 | 99 | Never auto send out, mandatory lawyer review |
| `tool.ediscovery.classify` | 40 | 85 | Privilege determination mandatory manual review |
| `tool.ip.search` | 20 | 30 | Auto execute (auxiliary information collection) |

**DomainEvalFramework**: Risk clause detection recall (must capture all) · case citation accuracy · e-discovery recall · review time reduction · deadline compliance

**HITL Strategy**: **All legal output must be reviewed by practicing lawyer before being acted upon**——This domain's HITL requirement is the highest among 24 domains (tied with healthcare domain). Contract negotiation · litigation strategy · regulatory filing · legal opinion · privilege determination all mandatory manual. Agent only provides "legal information" not "legal advice".

**Key Guardrails**: Conservative strategy (mark all abnormal content) · case citation must be verified by legal database · multi-factor privilege detection · explicit jurisdiction annotation · regulatory calendar + multi-source redundant alert

**Agent Workflow (Detailed)**:

- Contract Review Agent: Article-by-article vs standard clause manual → deviation identification → risk marking (unlimited liability/unfavorable compensation/auto-renewal) → negotiation suggestion → redline marking
- Regulatory Compliance Agent: Cross-jurisdiction regulation change monitoring → regulation→business process mapping → gap analysis → rectification tracking
- Litigation Support Agent: E-discovery document review → relevance/privilege classification → case timeline → legal research
- IP Management Agent: Trademark/patent monitoring → renewal tracking → FTO search → infringement identification → portfolio management
- Due Diligence Agent: Target company document review → key clause extraction → liability/contingency → red flag
- Policy Drafting Agent: Jurisdiction requirement → privacy policy/ToS/compliance policy → version management

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Contract management | DocuSign CLM, Ironclad, Fada, Shangshangqian, Icertis |
| Legal research | Westlaw, LexisNexis, PKU Law, Wolters Kluwer |
| E-discovery | Relativity, Nuix, Logikcull, DISCO |
| Intellectual property | Thomson Reuters IP, MaxVal, National Intellectual Property Administration |
| Compliance | OneTrust, LogicGate, SAI360 |

**Data Sensitivity Classification**:

- Attorney-client privilege: Legal opinion, litigation strategy, settlement discussion—highest protection
- Extremely confidential: M&A document, regulatory investigation, IP trade secret, labor dispute
- Confidential: Standard contract, policy, compliance record
- Regulated: Court document (partially public), regulatory submission

**Performance/Latency Budget**:

- Contract review: Standard <1h, complex multi-party <24h
- Regulatory monitoring: Daily scan, key change real-time alert
- E-discovery: Thousands of documents per hour (throughput > latency)
- Legal research: Initial case <30s, complete memo minute level

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Missing key contract clause | Mark all anomalies, comprehensive clause manual, all contracts manual review |
| Fabricated case citation | Mandatory legal database verification, never present unverified citation |
| Wrong privilege classification | Multi-factor detection, all privilege determination manual review |
| Jurisdiction mismatch | Explicit jurisdiction annotation, jurisdiction-specific clause manual, conflict marker |
| Missed regulation change | Multi-source monitoring, redundant alert, regulatory calendar with manual responsibility |

---

# 83. Online Live Streaming Domain Architecture

> Related: §37 Business domain modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §13

**DomainDescriptor Mapping**:

- `domain_id`: `live-streaming` · `recipe_archetype`: Realtime + Moderation
- `risk_level`: High · `latency_tier`: realtime (push stream <1s, danmaku moderation <200ms)
- `hitl_intensity`: **High** (political/terrorism moderation, live e-commerce violation handling) · `regulatory_density`: High (Internet Live Streaming Service Management Regulations/Minor Protection Law/Advertising Law)

**Core Agent Roles**: Live streaming orchestration · interactive operation · real-time content moderation · e-commerce conversion · data analysis

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.stream.publish` | 25 | 60 | Need to verify anchor qualification and content tag before push stream |
| `tool.moderation.realtime` | 40 | 95 | Political/terrorism/minor-related content immediate cut, mandatory manual review |
| `tool.commerce.shelf` | 30 | 70 | Product listing needs compliance check, prohibited items auto intercept |
| `tool.danmaku.filter` | 20 | 50 | Sensitive word real-time filter, edge case manual spot check |

**DomainEvalFramework**: Violation detection rate (political/pornographic/minor-related zero miss) · false positive rate (<2% to avoid misjudging normal content) · handling latency (cut stream <3s) · GPM (revenue per 1000 views) · push stream success rate

**HITL Strategy**: Political/terrorism/minor-related content mandatory manual review before live stream can be restored; live e-commerce violation handling needs operation confirmation; large event pre-launch pre-review mandatory manual signoff. Agent undertakes real-time initial screening and orchestration scheduling, final handling decision authority belongs to moderation operation team.

**Key Guardrails**: Multimodal real-time moderation pipeline (audio+video+text parallel) · minor protection period hard limit · sensitive period auto raise moderation level · stream cut circuit breaker mechanism (misjudgment can be quickly restored) · e-commerce compliance dual verification (platform rules + advertising law)

**Agent Workflow (Detailed)**:

- Live Streaming Orchestration Agent: Push stream initialization → multi-platform distribution (Douyin/Kuaishou/Bilibili/Video Account) → transcoding configuration → CDN scheduling → quality monitoring → replay generation
- Interactive Operation Agent: Danmaku sentiment analysis → interactive gameplay (red packet/quiz/poll/connection) → popularity curve adjustment → fan level system
- Real-time Moderation Agent: Multimodal stream sampling (video/audio/danmaku) → AI classification → risk score → handling (warning/mute/stream cut)
- Live E-commerce Agent: Product listing rhythm → coupon timing → inventory lock → real-time sales dashboard → promotion dynamic adjustment
- Data Analysis Agent: Real-time metric tracking (online/interactive/conversion/gift/GPM) → review report → historical comparison → optimization suggestion

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Live platform | Douyin/Kuaishou/Bilibili/Video Account/Taobao Live/YouTube Live/Twitch API |
| Push stream/Transcoding | OBS SDK, FFmpeg, SRS, Alibaba Cloud Live, Tencent Cloud Live, Agora |
| Content moderation | Alibaba Cloud Lvwang, Tencent Tianyu, Baidu Content Security, Amazon Rekognition |
| E-commerce | Douyin Store, Kuaishou Store, Taobao Alliance, Youzan |
| Data | Chanmama, Feigua Data, ClickHouse, Apache Flink |

**Data Sensitivity Classification**:

- High (PII+financial): User real-name information, payment account, tip/transaction record, anchor income
- Confidential: Operation strategy, product selection data, MCN contract, revenue sharing, recommendation parameter
- Internal: Aggregated viewing data, interaction statistics, public replay
- Real-time stream data contains anchor portrait/environment information, needs to be classified by scenario

**Performance/Latency Budget**:

- Push stream: Low latency <1s, ultra-low latency (connection) <400ms, standard <3s
- Moderation: Video frame <500ms, danmaku <200ms (synchronous filter)
- Interaction: Red packet/poll/connection <1s
- E-commerce: Product listing <2s, inventory lock <500ms
- Availability: During live streaming 99.99%

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Push stream interruption/CDN failure | Auto switch backup address and CDN, stream cut reconnect, viewer side seamless switch |
| Moderation missing violation | Multi-model cascade, manual patrol fallback, post-event tracing, real-time report channel |
| Live e-commerce inventory oversell | Inventory pre-lock, safety inventory buffer, oversell auto compensation |
| Tip system anomaly | Idempotency design, real-time reconciliation check, exception freeze+manual review |
| Large-scale concurrent overload | Elastic scaling, rate limit degradation, core link protection (push stream first) |

---

# 84. Ad Creative Production Domain Architecture

> Related: §37 Business domain modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §14

**DomainDescriptor Mapping**:

- `domain_id`: `creative-production` · `recipe_archetype`: Creative
- `risk_level`: Medium · `latency_tier`: near-realtime (text <10s, image <30s, compliance check <5s)
- `hitl_intensity`: **Medium** (brand creative pre-release approval, medical/financial creative legal review) · `regulatory_density`: Medium (Advertising Law/Copyright Law/Portrait Right)

**Core Agent Roles**: Creative generation · brand compliance check · creative adaptation · effect prediction · workflow management

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.creative.generate` | 25 | 55 | Generated creative auto mark AI generated watermark, brand creative needs manual approval |
| `tool.brand.compliance` | 30 | 75 | Medical/financial/education industry creative mandatory legal review |
| `tool.asset.adapt` | 15 | 25 | Size/format adaptation auto execute |
| `tool.creative.predict` | 20 | 35 | Effect prediction result for reference only, does not auto trigger delivery decision |

**DomainEvalFramework**: Brand compliance pass rate (brand tone consistency) · platform audit first-pass rate (>95%) · CTR/CVR prediction accuracy · creative output speed (efficiency multiplier vs manual)

**HITL Strategy**: Performance creative batch generation can auto flow to delivery system; brand creative, medical/financial/education and other strong regulation industry creative pre-release mandatory manual approval. Celebrity portrait or third-party copyright creative needs legal to confirm authorization chain integrity.

**Key Guardrails**: Copyright creative source tracing chain (all referenced creative can trace authorization) · absolute wording auto detection (advertising law prohibited word library real-time update) · portrait right use authorization verification · industry sensitive word filter (medical/financial/education tiered word library) · generated content AI watermark mandatory injection

**Agent Workflow (Detailed)**:

- Creative Generation Agent: Brief parsing → creative strategy → multi-format creative (text/image/video script/landing page) → brand verification → A/B variant
- Brand Compliance Check Agent: Creative ingest → brand specification match (logo/color/font/tone) → advertising law check → risk annotation → modification suggestion
- Creative Adaptation Agent: Source creative parsing → platform specification match (9:16/1:1/16:9/3:4) → smart crop/rearrange → batch output
- Effect Prediction Agent: History+creative feature (color tone/emotion/CTA/people proportion) → CTR/CVR prediction → ranking → optimization direction
- Workflow Management Agent: Requirement pool → task assignment → approval flow → version management → creative asset library → full-link status

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Image generation | Midjourney, DALL-E 3, Stable Diffusion, Adobe Firefly, Jimeng AI |
| Video production | RunwayML, Pika, Sora, Jianying API, Adobe Premiere SDK |
| Design | Figma API, Canva API, Adobe CC SDK, Lanhu |
| Text generation | GPT-4, Claude, Ernie Bot, Tongyi Qianwen |
| DAM | Bynder, Brandfolder, Adobe AEM Assets |
| Effect analysis | Ocean Engine Creative, Tencent Ad Creative Center, Google Ads Creative Studio |

**Data Sensitivity Classification**:

- Confidential: Unreleased creative strategy, brand specification manual, competitor analysis, prediction model parameter
- Internal: Released creative, delivery effect data, A/B test result, creative asset library
- Low: Public ad creative, industry creative reference

**Performance/Latency Budget**:

- Text generation: Single <10s, batch (100 variants) <5min
- Image generation: Single <30s, batch adaptation (10 sizes) <3min
- Video generation: 15-second short video <10min, long video hour level (async)
- Brand compliance check: Single creative <5s
- Effect prediction: Batch scoring <1min

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Generated creative infringing copyright | Similarity detection (compare copyright image library), source watermark, infringement auto takedown |
| Brand specification deviation | Specification embedded Prompt, style reference image constraint, multi-round verification |
| Advertising law violation text | Prohibited word library real-time filter, compliance Agent pre-audit, violation auto replace |
| Batch quality out of control | Quality score threshold filter, sampling manual review, low score auto reject |
| Effect prediction inaccuracy | Continuous A/B calibration, model periodic retraining, bias monitoring |

---

# 85. Game Development Domain Architecture

> Related: §37 Business domain modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §15

**DomainDescriptor Mapping**:

- `domain_id`: `game-dev` · `recipe_archetype`: Creative + Research
- `risk_level`: Medium · `latency_tier`: batch (QA <2h, value simulation <10min)
- `hitl_intensity`: **High** (core gameplay design/art style finalization/version release approval) · `regulatory_density`: High (version number/anti-addiction/content review/ESRB/PEGI)

**Core Agent Roles**: Design assistance · art asset generation · QA automation · value balance · code generation

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.game.design_assist` | 20 | 40 | Design suggestion for reference only, core gameplay decision mandatory manual |
| `tool.game.asset_generate` | 25 | 65 | Art asset needs lead artist to confirm style consistency before storage |
| `tool.game.qa_run` | 15 | 20 | Automated test auto execute, Bug report auto archive |
| `tool.game.balance_sim` | 30 | 55 | Value adjustment suggestion needs planner review, does not auto write configuration table |

**DomainEvalFramework**: Art style consistency (FID/CLIP-Score) · bug detection rate (automated vs manual comparison) · code generation adoption rate · Gini coefficient (economy/value balance)

**HITL Strategy**: Core gameplay design, art style finalization, version release approval are mandatory manual decision nodes. Value balance simulation result needs planner team confirmation before application. QA automation can execute independently, but P0/P1 Bug fix plan needs development lead signoff.

**Key Guardrails**: Generated asset copyright compliance check (with known IP similarity detection) · content review pre-screening (version number filing compliance pre-verification) · anti-addiction mechanism pre-embedding verification · code generation security scan (injection/vulnerability auto detection) · value simulation outlier circuit breaker

**Agent Workflow (Detailed)**:

- Design Assistance Agent: Design intent → reference analysis → system design (gameplay loop/level/economy/narrative) → value framework → GDD
- Art Generation Agent: Style reference → asset requirement parsing → generation (concept/2D/3D/UI/scene) → style consistency verification → format export
- QA Agent: Functional test (task/UI/save) → performance test (frame rate/memory/load) → compatibility test → crash analysis → Bug report
- Value Balance Agent: Economic system/attribute/difficulty curve → Monte Carlo simulation → balance evaluation → strategy cracking detection
- Code Generation Agent: Gameplay/Shader/AI behavior tree/network sync → engine adaptation (Unity/Unreal) → code specification

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Engine | Unity (C#), Unreal (C++/Blueprint), Godot, Cocos Creator |
| Art | Midjourney, Stable Diffusion (ControlNet/LoRA), Substance 3D, Meshy |
| Version control | Perforce Helix Core, Git LFS, PlasticSCM |
| Testing | Unity Test Framework, Unreal Automation, Appium, GameBench |
| Value | Python (NumPy/SciPy), MATLAB, self-developed simulator |

**Data Sensitivity Classification**:

- Extremely confidential: Unpublished GDD, core gameplay patent, source code, unreleased art asset
- Confidential: Internal test data, performance benchmark, value model, project schedule
- Internal: Published preview material, developer blog, online asset

**Performance/Latency Budget**:

- Art generation: Concept image <30s, 2D batch <5min, 3D prompt <1min
- QA test: Single round regression <2h (parallel), crash analysis <5min
- Value simulation: Single <10min (10,000 Monte Carlo), parameter scan hour level
- Code generation: Single function <10s, module <2min
- Build: Incremental <5min, complete <1h

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Art style deviation | ControlNet/LoRA constraint, Art Director review gate |
| Value simulation bias | Online A/B verification, player data feedback, hot update adjustment |
| Auto test miss detection | Multi-strategy combination (random+directional+exploration), manual supplement, player feedback |
| Generated code performance issue | Profiling auto integration, performance budget gating |
| Procedural content repetition | Mutation seed diversification, manual+generated hybrid ratio, freshness monitoring |

---

# 86. Game Publishing Domain Architecture

> Related: §37 Business domain modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §16

**DomainDescriptor Mapping**:

- `domain_id`: `game-publishing` · `recipe_archetype`: Compliance + Logistics
- `risk_level`: High · `latency_tier`: near-realtime (Live Ops <5min, submission <1h)
- `hitl_intensity`: **High** (version number submission material/major version release/large event configuration/sensitive localization) · `regulatory_density`: Critical (version number/rating/anti-addiction/PIPL/GDPR/payment compliance)

**Core Agent Roles**: Store submission automation · compliance review · localization · Live Ops · data analysis

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.store.submit` | 35 | 85 | Submission material mandatory manual final review, version number related content zero tolerance |
| `tool.compliance.check` | 40 | 90 | Anti-addiction/payment compliance/privacy agreement auto check+manual review |
| `tool.localization.translate` | 20 | 45 | Regular text auto execute, cultural sensitive/legal text mandatory manual |
| `tool.liveops.config` | 25 | 65 | Large event configuration needs product+operation dual approval |

**DomainEvalFramework**: Submission first-pass rate (>90% as target) · DAU/retention rate (version health) · event participation rate · ASO ranking (store optimization effect) · LQA Bug density (localization quality)

**HITL Strategy**: Version number submission material, major version release, large event configuration are mandatory manual approval nodes. Sensitive region localization content needs local legal+cultural consultant dual signoff. Payment related configuration change needs financial compliance confirmation. Live Ops regular event can go online automatically, abnormal metrics trigger manual intervention.

**Key Guardrails**: Multi-region tiered compliance matrix (auto match target market regulation) · anti-addiction real-name authentication link verification · payment compliance multi-currency audit · localization cultural sensitive word library (religion/politics/history) · version rollback hot backup mechanism (abnormal metric auto trigger)

**Agent Workflow (Detailed)**:

- Submission Automation Agent: Material preparation → platform specification adaptation (App Store/Google Play/Steam/TapTap) → auto submission → status tracking → rejection analysis and resubmit
- Compliance Review Agent: Version number material preparation → rating assessment (ESRB/PEGI/CERO) → content sensitivity check → compliance gap report
- Localization Agent: UI translation → voice coordination → cultural adaptation (festival/naming/visual) → terminology consistency → LQA test
- Live Ops Agent: Version update plan → event configuration (limited time/season/festival) → announcement → server management → hot update
- Data Analysis Agent: Download/DAU/MAU/retention/payment/LTV → review trend → competitor benchmark → operation suggestion

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| App store | App Store Connect, Google Play Console, Steamworks, TapTap, Huawei AppGallery |
| Data | data.ai, Sensor Tower, GameAnalytics, Firebase, ThinkingData |
| Localization | Crowdin, Lokalise, Transifex, memoQ |
| Operation | Firebase Remote Config, LaunchDarkly, Apollo Configuration Center |
| CI/CD | Jenkins, Fastlane, Unity Cloud Build |

**Data Sensitivity Classification**:

- Extremely confidential: Version number application material, unpublished release plan, contract/revenue sharing, user payment data
- Confidential: Operation data, event configuration, A/B result, competitor analysis
- Internal: Published store page, public review, industry benchmark

**Performance/Latency Budget**:

- Submission processing: Material preparation <1h, auto submission <5min, status polling hourly
- Localization: UI text <24h (auto translation+manual review)
- Live Ops: Event online/offline <5min (hot update), emergency offline <1min
- Data analysis: Real-time dashboard <5min delay, daily report auto generated

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Platform review rejection | Rejection auto classification+solution recommendation, historical Case library, quick resubmit |
| Live Ops configuration error | Dual review, graying-out release (1% verification), emergency rollback, compensation plan |
| Localization error causing bad review | Feedback classification, hot update fix, LQA strengthen, community quick response |
| Version number approval delay | Compliance risk pre-position, alternative plan (overseas first), pre-review service |
| Major version causing player churn | A/B pre-verification, graying-out monitoring retention, quick rollback, communication plan |

---

# 87. Human Resources Domain Architecture

> Related: §37 Business domain modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §17

**DomainDescriptor Mapping**:

- `domain_id`: `human-resources` · `recipe_archetype`: CRUD-heavy + Compliance
- `risk_level`: High · `latency_tier`: near-realtime (resume screening <5s) + batch (salary calculation <2h)
- `hitl_intensity`: **Extremely High** (Offer/termination/performance rating/salary adjustment/organizational structure change) · `regulatory_density`: Critical (Labor Law/Labor Contract Law/PIPL/GDPR/EU AI Act)

**Core Agent Roles**: Recruitment · onboarding · performance analysis · salary modeling · compliance monitoring

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.hr.resume_screen` | 35 | 80 | Screening result is recommendation ranking only, auto elimination prohibited, needs HR review |
| `tool.hr.offer_generate` | 40 | 95 | Offer content mandatory HRBP+legal dual approval before sending |
| `tool.hr.payroll_calc` | 45 | 90 | Salary calculation result needs finance+HR dual signoff, abnormal deviation auto intercept |
| `tool.hr.compliance_check` | 30 | 70 | Contract clause compliance auto check, risk clause manual review |

**DomainEvalFramework**: Recruitment cycle (Time-to-Hire) · Offer acceptance rate · salary fairness index (gender/age/ethnicity dimension) · labor arbitration case count (trend monitoring) · bias audit pass rate (EU AI Act compliance)

**HITL Strategy**: Offer issuance, termination decision, performance rating, salary adjustment, organizational structure change all mandatory manual decision. Resume screening Agent only provides ranking suggestion, final interview invitation is confirmed by HR. EU AI Act requires high-risk AI system transparency, all algorithm decisions need to be explainable.

**Key Guardrails**: Bias detection pipeline (gender/age/education and other protected attribute desensitization+fairness metric monitoring) · salary data encryption isolation (least privilege access) · employee data PIPL/GDPR compliant storage and deletion · termination decision audit log immutable · algorithm decision explainability report auto generated

**Agent Workflow (Detailed)**:

- Recruitment Agent: Requirement collection → JD generation → resume screening scoring → interview coordination → question generation → assessment summary → Offer approval
- Onboarding Agent: Material collection → IT account opening → training plan → mentor matching → probation target → experience tracking
- Performance Analysis Agent: OKR/KPI assistance → data collection → 360-degree summary → performance calibration suggestion → improvement plan
- Salary Modeling Agent: Market benchmark → salary band model → adjustment/bonus simulation (budget+fairness) → report
- Compliance Monitoring Agent: Labor contract expiration tracking → social security and housing fund → work hour management → leave balance → risk warning

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| HCM/HRIS | Workday, SAP SuccessFactors, Oracle HCM, Beisen, Yonyou HR Cloud, DingTalk |
| Recruitment | LinkedIn Recruiter, Boss Zhipin, Liepin, Greenhouse, Lever |
| Salary data | Mercer, Aon/Radford, CIIC Salary, LinkedIn Salary |
| Learning | Cornerstone, Cloud School, Cool School, LinkedIn Learning |
| Signing | DocuSign, Fada, eSign |

**Data Sensitivity Classification**:

- Extremely sensitive (PII+): ID number, bank account, salary, medical check, background check, disciplinary action
- Confidential: Performance evaluation, promotion candidate, organizational adjustment, labor arbitration
- Internal: Organizational structure, job description, training catalog, attendance summary

**Performance/Latency Budget**:

- Resume screening: Single <5s, batch (1000) <30min
- Salary calculation: Monthly <2h (batch), individual query <3s
- Compliance check: Contract expiration 30-day advance warning, work hour exceed real-time alert
- Onboarding: IT account <1h, training plan <5min

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Resume screening bias | Periodic bias audit, multi-dimensional evaluation, manual review low score sample |
| Salary calculation error | Dual track verification, outlier marker, pre-issue spot check |
| Labor contract expiration not renewed | 90/60/30-day three-level warning, auto renewal trigger, legal escalation |
| Employee data leak | Field-level encryption, access audit, abnormal alert, emergency plan |
| Performance evaluation dispute | Appeal process trigger, data complete traceback, independent review committee |

---

# 88. Supply Chain and Logistics Domain Architecture

> Related: §37 Business domain modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §18

**DomainDescriptor Mapping**:

- `domain_id`: `supply-chain` · `recipe_archetype`: Logistics + Analytics
- `risk_level`: High · `latency_tier`: near-realtime (route reroute <30s) + batch (demand forecast daily)
- `hitl_intensity`: **High** (large purchase/new supplier access/customs anomaly/dangerous goods transportation/supply chain interruption emergency) · `regulatory_density`: High (Customs Law/Export Control/Dangerous Goods Transportation/ESG)

**Core Agent Roles**: Demand forecast · inventory optimization · route planning · supplier assessment · customs compliance

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.scm.forecast` | 20 | 35 | Forecast result auto flow into inventory system, abnormal fluctuation alert manual review |
| `tool.scm.inventory_optimize` | 30 | 60 | Regular replenishment auto execute, large purchase order mandatory approval |
| `tool.scm.route_plan` | 25 | 70 | Dangerous goods transportation route mandatory manual review, regular route auto execute |
| `tool.scm.customs_declare` | 40 | 90 | HS code classification needs customs specialist confirmation, export control commodity mandatory compliance review |

**DomainEvalFramework**: MAPE/WMAPE (demand forecast accuracy) · inventory turnover rate · on-time delivery rate (OTIF) · HS classification accuracy · tariff optimization savings (tax optimization under compliance premise)

**HITL Strategy**: Large purchase decision, new supplier access assessment, customs anomaly handling, dangerous goods transportation approval, supply chain interruption emergency response are mandatory manual decision nodes. Regular replenishment and route planning auto execute within threshold, exceed threshold auto escalate to supply chain manager. Export control list match result zero tolerance, mandatory compliance officer signoff.

**Key Guardrails**: Export control entity list real-time sync (BIS/OFAC/EU) · dangerous goods transportation compliance matrix (UN number+transportation mode cross check) · supplier ESG score continuous monitoring · demand forecast abnormal fluctuation circuit breaker (prevent bullwhip effect amplification) · customs declaration data immutable audit chain

**Agent Workflow (Detailed)**:

- Demand Forecast Agent: History+trend+promotion+weather/holiday → forecast model (ARIMA/Prophet/DeepAR) → multi-level forecast → safety stock suggestion
- Inventory Optimization Agent: Forecast+supply constraint → reorder point/EOQ/safety stock → multi-warehouse transfer · turnover vs service level balance
- Route Planning Agent: Order pool → constraint modeling (vehicle/time window/traffic/cost) → VRP solution → scheduling → real-time reroute
- Supplier Assessment Agent: Multi-dimensional assessment (quality/delivery/price/response/ESG) → risk analysis (finance/geography/single source) → purchase assistance
- Customs Compliance Agent: HS code classification → tariff calculation → origin verification → sanction screening → customs declaration → trade agreement optimization

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| ERP/SCM | SAP SCM/IBP, Oracle SCM Cloud, Blue Yonder, Kingdee/Yonyou Supply Chain |
| WMS | Manhattan, Blue Yonder WMS, SAP EWM, Fuller FLUX |
| TMS | Oracle TMS, SAP TM, G7, Yunmanman/Huochebang |
| Forecast | Amazon Forecast, Vertex AI, Prophet, self-developed ML |
| Customs | Descartes, Thomson Reuters, Single Window (China Customs) |
| IoT | GPS/temperature humidity sensor, RFID, Alibaba Cloud/AWS IoT |

**Data Sensitivity Classification**:

- Confidential: Supplier contract/pricing, purchase cost, inventory strategy, forecast model
- Business sensitive: Inventory level, logistics route, warehouse layout, supplier assessment
- Regulated: Customs declaration, origin certificate, dangerous goods transportation record (5-10 years)
- IoT: GPS trajectory, temperature humidity—may involve location privacy

**Performance/Latency Budget**:

- Demand forecast: Daily batch, emergency event trigger instant recalculation <30min
- Inventory optimization: Daily replenishment suggestion, emergency replenishment <1h
- Route planning: Initial <5min (hundreds of orders), real-time reroute <30s
- Customs declaration: Single ticket <10min, batch hour level
- IoT monitoring: Abnormal alert <1min

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Demand forecast serious deviation | Forecast vs actual monitoring, deviation alert, manual correction, safety stock buffer |
| Supply chain interruption | Multi-source supply, safety stock pre-position, alternative supplier activation, emergency logistics |
| Route anomaly causing delay | Real-time GPS, dynamic reroute, preset emergency route, customer notification |
| HS code classification error | Multi-model cross verification, historical comparison, customs pre-ruling, customs officer review |
| Warehouse physical inconsistency | Periodic/cycle inventory, RFID auto inventory, difference alert, freeze investigation |

---

# 89. Healthcare Domain Architecture

> Related: §37 Business domain modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §19

**DomainDescriptor Mapping**:

- `domain_id`: `healthcare` · `recipe_archetype`: Compliance + Conversational
- `risk_level`: Critical · `latency_tier`: realtime (triage <5s, drug check <2s) + batch (imaging analysis <5min)
- `hitl_intensity`: **Highest** (all diagnostic suggestion/prescription/imaging report must be confirmed by practicing doctor) · `regulatory_density`: Critical (Medical Device Supervision and Administration Regulations/HIPAA/FDA SaMD/EU MDR/NMPA)

**Core Agent Roles**: Clinical decision support · smart triage · medical record analysis · drug interaction check · medical imaging analysis

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.clinical.diagnose` | 50 | 99 | Never auto output diagnostic conclusion, mandatory practicing doctor review |
| `tool.triage.assess` | 40 | 85 | High-risk level mandatory manual review, low-risk can assist auto |
| `tool.drug.interaction_check` | 35 | 90 | All contraindication/serious interaction mandatory pharmacist confirmation |
| `tool.imaging.analyze` | 45 | 95 | Imaging report only as auxiliary reference, must be issued by imaging doctor |

**DomainEvalFramework**: Diagnostic sensitivity/specificity · lesion detection recall (zero tolerance for miss) · drug interaction recall · triage consistency rate (compared with senior doctor) · imaging analysis false negative rate

**HITL Strategy**: **All clinical decision output must be confirmed by practicing doctor before being used for patient diagnosis and treatment**——This domain ties with legal domain for highest HITL requirement. Diagnostic suggestion · prescription issuance · imaging report · triage grading · drug plan all mandatory manual. Agent only provides "clinical decision auxiliary information" not "medical diagnosis".

**Key Guardrails**: High sensitivity priority strategy (better false positive than miss) · drug interaction multi-source database cross verification · patient data end-to-end encryption and minimization access · imaging analysis confidence threshold below 95% mandatory manual · emergency scene circuit breaker fallback to manual channel

**Agent Workflow (Detailed)**:

- Clinical Decision Support Agent: Medical record ingest → structured extraction → clinical reasoning → guideline match (UpToDate/clinical pathway) → differential diagnosis ranking → doctor review
- Smart Triage Agent: Symptom self-report → standardized consultation → ESI/Manchester assessment → triage level → department routing
- Medical Record Analysis Agent: Unstructured medical record NLP extraction (diagnosis/medication/surgery/allergy) → timeline → missing information/contradiction → structured summary
- Drug Interaction Agent: Medication list+new prescription → DrugBank/MCDEX → interaction severity → liver/kidney contraindication → dose rationality
- Imaging Analysis Agent: DICOM reception → pre-trained model (lung nodule/fracture/fundus) → suspicious area annotation → report draft

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| EMR | Epic, Cerner, Winning Health, Donghua Software, Chuangye Huikang, OpenMRS |
| Clinical knowledge base | UpToDate, DXplain, China Clinical Pathway, NICE, Cochrane |
| Drug database | DrugBank, MCDEX, Lexicomp, PASS |
| Imaging | DICOM, PACS (GE/Philips/Siemens), MONAI, 3D Slicer |
| Interoperability | HL7 FHIR R4, ICD-10/11, SNOMED CT, LOINC, DRG/DIP |

**Data Sensitivity Classification**:

- Extremely sensitive (PHI): Patient identity, diagnosis, genome, psychiatry/HIV/reproduction (special protection)
- Confidential: Clinical model parameter, hospital operation, research intermediate data, doctor performance
- Internal: Desensitized aggregate statistics, public guideline, drug instruction

**Performance/Latency Budget**:

- Emergency triage: Danger signal <5s (zero latency tolerance), complete <30s
- Drug interaction: Prescription check <2s (embedded in order synchronous flow)
- Imaging analysis: X-ray <30s, CT sequence <5min (GPU accelerated)
- Clinical decision: Suggestion <10s (outpatient wait time limited)
- Availability: 99.99% (emergency 7x24)

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Imaging systematic miss detection | Multi-model ensemble voting, new annotation data regression, miss feedback closed loop |
| Drug database update delay | Multi-data source cross verification, listing announcement trigger refresh |
| EMR integration interruption | Local cache key data, degrade to manual input, auto reconnect sync |
| Triage insufficient for rare emergency | Danger signal hard-coded fallback, low confidence mandatory manual review |
| PHI data exposure | Real-time PHI detection desensitization, access audit, 72h regulatory notification |

---

# 90. Education and Training Domain Architecture

> Related: §37 Business domain modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §20

**DomainDescriptor Mapping**:

- `domain_id`: `education` · `recipe_archetype`: Conversational + Creative
- `risk_level`: Medium · `latency_tier`: realtime (tutoring <3s, test <1s) + batch (content generation)
- `hitl_intensity`: **High** (course content pre-online teacher review/subjective question scoring spot check/minor data use needs parent consent) · `regulatory_density`: High (Minor Protection Law/FERPA/COPPA/EU AI Act)

**Core Agent Roles**: Learning path optimization · content generation · smart evaluation · smart tutoring · learning status analysis

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.edu.learning_path` | 20 | 45 | Path recommendation can auto execute, periodic teacher review |
| `tool.edu.content_generate` | 30 | 70 | All generated content must be teacher reviewed before online |
| `tool.edu.assess` | 35 | 75 | Subjective question scoring mandatory spot check, objective question can auto |
| `tool.edu.tutor` | 25 | 60 | Real-time tutoring allows auto, sensitive topic triggers manual intervention |

**DomainEvalFramework**: Knowledge point mastery rate improvement · scoring consistency (Cohen's Kappa ≥ 0.8) · completion rate · Socratic guidance ratio (guidance not direct answer) · content accuracy

**HITL Strategy**: Course content must be reviewed by subject teacher before release, minor scenario implements most strict data protection. Content generation · subjective question scoring · major learning path adjustment · sensitive topic tutoring mandatory manual intervention. Involving minor personal data collection needs parent explicit consent. Agent positioned as "learning auxiliary tool" not "teacher replacement".

**Key Guardrails**: Minor content safety filter (violence/pornography/improper value zero tolerance) · answer leak protection (guidance priority over direct answer) · age tier content strategy · data minimization collection and parent informed consent · academic integrity detection integration

**Agent Workflow (Detailed)**:

- Learning Path Agent: Pre-test/history assessment → knowledge graph → personalized path (knowledge point sequence/difficulty/resource) → dynamic adjustment
- Content Generation Agent: Teaching outline+knowledge point → handout/exercise/case/courseware → multi-difficulty/multi-language → Bloom level
- Evaluation Agent: Question generation (choice/fill/subjective/programming) → auto scoring → personalized feedback → weak item → CAT
- Tutoring Agent: One-on-one dialogue → Socratic question → confusion point identification → step-by-step explanation and analogy
- Learning Status Analysis Agent: Learning behavior summary (duration/completion/wrong question/participation) → learner portrait → risk prediction → intervention suggestion

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| LMS | Moodle, Canvas, Blackboard, Xuetang Online, China University MOOC, Coursera |
| Knowledge graph | Neo4j, self-built subject knowledge graph, ConceptNet |
| Evaluation | Gradescope, Turnitin, CodeGrader, OJ system |
| Video/Live | Zoom SDK, Tencent Meeting, DingTalk Classroom, OBS |
| Data analysis | xAPI/LRS, Amplitude, self-built learning status dashboard |

**Data Sensitivity Classification**:

- High (minor data): Student identity, learning behavior, grade, psychological assessment
- Confidential: Question bank (unpublished), scoring standard, teaching algorithm parameter
- Internal: Course outline, published material, aggregate statistics

**Performance/Latency Budget**:

- Tutoring dialogue: Response <3s (timeout attention loss)
- Adaptive test: Question recommendation <1s
- Content generation: Single knowledge point <1min, complete course hour level (async)
- Evaluation scoring: Objective question instant, subjective question <30s/paper

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Content with knowledge error | Subject knowledge base verification, teacher review workflow, learner error correction feedback |
| Subjective question scoring deviation | Calibration (benchmark sample), low confidence to manual, multi-dimensional scoring scale |
| Learning path dead loop | Mastery threshold adjustment, path diversity constraint, manual skip |
| Tutoring directly give answer | Teaching strategy guardrail (mandatory guidance), homework scene detection, answer filter |
| High concurrent exam overload | Elastic scaling, question local cache, degrade to offline exam |

---

# 91. Customer Service Domain Architecture

> Related: §37 Business domain modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §21

**DomainDescriptor Mapping**:

- `domain_id`: `customer-service` · `recipe_archetype`: Conversational
- `risk_level`: Medium · `latency_tier`: realtime (chat <3s, routing <1s)
- `hitl_intensity`: **Medium** (over-permission refund approval/complaint escalation/legal issue/VIP abnormal ticket/low confidence to manual) · `regulatory_density`: Medium (Consumer Rights Protection Law/TCPA/GDPR)

**Core Agent Roles**: Multi-channel dialogue · smart routing · knowledge retrieval · quality inspection scoring · escalation management

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.cs.respond` | 20 | 40 | Regular consultation auto reply, low confidence to manual |
| `tool.cs.route` | 15 | 25 | Auto execute smart routing, VIP ticket priority queue |
| `tool.cs.knowledge_search` | 10 | 15 | Auto execute (auxiliary information retrieval) |
| `tool.cs.quality_score` | 25 | 55 | Quality inspection score for reference, appeal/dispute needs manual review |

**DomainEvalFramework**: CSAT (customer satisfaction) · FCR (first contact resolution) · AI independent resolution rate · hallucination rate (strict trend to zero) · AHT (average handling time) · escalation rate

**HITL Strategy**: Over-permission operation and high-risk scenario mandatory manual intervention, regular consultation allows fully automatic closed loop. Refund over threshold · legal/regulatory issue · complaint escalation · VIP abnormal ticket · confidence below threshold auto transfer to manual agent. Agent must clarify AI identity at dialogue start, user can request manual service at any time.

**Key Guardrails**: Emotion detection and escalation circuit breaker (detect anger/threat immediately transfer to manual) · commitment consistency check (do not commit content exceeding policy scope) · multi-channel context sync · sensitive information desensitization display · refund/compensation operation amount tiered approval

**Agent Workflow (Detailed)**:

- Multi-channel Dialogue Agent: Channel access (chat/phone ASR/email/social) → intent recognition → knowledge retrieval → answer generation → satisfaction confirmation → ticket archive
- Smart Routing Agent: Ticket content (intent/emotion/urgency) + customer attribute (VIP/history/LTV) + agent status → optimal routing → queue/overflow
- Knowledge Retrieval Agent: Semantic search+exact match hybrid → product/service knowledge base → answer with citation → knowledge gap identification
- Quality Inspection Scoring Agent: Full auto quality inspection (compliance language/attitude/resolution/process) → score card → low score marker manual recheck
- Escalation Management Agent: Scene detection (emotional agitation/over-permission/technical issue/complaint) → auto escalate to supervisor/expert/cross-department → SLA guarantee

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Omnichannel | Zendesk, Salesforce Service Cloud, Freshdesk, NetEase Qiyu, Zhichi, Udesk |
| Voice/CTI | Genesys Cloud, Avaya, Amazon Connect, Twilio Voice, Heliyi Jie |
| Knowledge base | Confluence, Guru, self-built RAG (Pinecone/Milvus + LLM) |
| NLP | Intent classification, sentiment analysis (BERT fine-tuning), ASR (iFlytek/Google) |
| CRM | Salesforce, HubSpot, Fenxiao Xiaoke |

**Data Sensitivity Classification**:

- PII (high): Customer name/phone/address/account, payment/order data in dialogue
- Confidential: Pricing strategy, compensation permission matrix, unpublished product plan, complaint details
- Internal: Aggregated service metric, FAQ content, training material

**Performance/Latency Budget**:

- Online chat: First response <3s, subsequent each turn <5s
- Phone IVR: Intent recognition <2s, routing <1s
- Email: Auto reply <30min, with manual <4h
- Quality inspection: Real-time lag <5min, daily report next morning
- Knowledge retrieval: With LLM answer <3s

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Commitment non-existent refund policy | RAG grounded generation, policy compliance check, commitment type mandatory manual confirmation |
| Peak system overload | Elastic scaling, queue callback, overflow outsourcing agent |
| Emotion misjudgment causing complaint escalation | Multi-dimensional detection (text+tone), negative threshold lowering trigger |
| Knowledge base expired | Freshness tracking, product/policy change trigger update, version marker |
| Cross-channel context loss | Unified session management, omnichannel history sync, unified identity |

---

# 92. Content Moderation and Security Domain Architecture

> Related: §37 Business domain modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §22

**DomainDescriptor Mapping**:

- `domain_id`: `content-moderation` · `recipe_archetype`: Moderation + Adversarial
- `risk_level`: High · `latency_tier`: realtime (text <500ms, image <1s, video <30s)
- `hitl_intensity`: **High** (appeal ruling/CSAM case/boundary case/policy change), reviewer mental health protection · `regulatory_density`: Critical (Cybersecurity Law/Section 230/DSA/CSAM mandatory report)

**Core Agent Roles**: Multimodal moderation · policy engine · appeal handling · adversarial detection · compliance report

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.moderation.classify` | 30 | 65 | Clear violation auto handle, boundary case mandatory manual review |
| `tool.moderation.appeal` | 40 | 85 | All appeal ruling must be final review by manual reviewer |
| `tool.adversarial.detect` | 35 | 75 | Adversarial sample detection result needs security team confirmation before storage |
| `tool.compliance.report` | 25 | 90 | CSAM and other mandatory report scene immediately report and lock evidence chain |

**DomainEvalFramework**: Precision/recall/F1 · violation content average online duration (trend to zero) · adversarial sample detection rate · appeal handling timeliness · misjudgment rate (over-moderation monitoring)

**HITL Strategy**: CSAM and extreme violence content mandatory immediate manual handling and report by law, boundary case enters manual queue. Appeal ruling · policy rule change · new violation pattern definition · cross-cultural sensitive content all mandatory manual. Reviewer exposure protection mechanism: content blur preview · rotation system · mental health periodic assessment · extreme content exposure duration limit.

**Key Guardrails**: Multi-model cross verification reducing single model bias · adversarial attack continuous red team test · evidence chain integrity guarantee (immutable audit log) · jurisdiction differentiated policy engine · reviewer mental health protection mandatory execution · misjudgment auto appeal channel

**Agent Workflow (Detailed)**:

- Multimodal Moderation Agent: Content reception → format parsing → multi-model parallel (text/image/video/audio) → rule engine overlay → confidence grading → handling
- Policy Engine Agent: Moderation policy management (platform/regulation/advertiser) → version management → graying-out/A/B → regulation→rule auto conversion
- Appeal Handling Agent: Appeal reception → original content re-review → supplementary information → review suggestion (maintain/revoke/modify)
- Adversarial Detection Agent: Evasion method identification (homophone/pinyin/image embedded text/semantic disguise) → continuous learning → rule auto update
- Compliance Report Agent: Generate report by regulatory requirement (moderation volume/violation distribution/timeliness/appeal) → regulatory connection → evidence retention

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Text | Self-developed NLP (BERT fine-tuning), Alibaba Lvwang, Tencent Tianyu, Perspective API |
| Image/Video | Self-developed CV, PhotoDNA (CSAM), AWS Rekognition, CLIP |
| Audio | ASR (iFlytek/Google/Whisper), audio classification |
| Policy engine | Self-built rule engine (Drools/DSL), feature platform, real-time decision |
| Regulatory connection | Cyberspace Administration Reporting Center, NCMEC CyberTipline, DSA Transparency Report |

**Data Sensitivity Classification**:

- Extremely sensitive: CSAM—legally mandatory report, dedicated process, strict access control
- High: User content raw data (including PII), moderation decision, reporter information
- Confidential: Moderation policy rule (leakage will be exploited for evasion), adversarial model parameter
- Internal: Aggregate statistics, model performance, public community guidelines

**Performance/Latency Budget**:

- Pre-publish moderation: Text <500ms, image <1s, short video <30s
- Throughput: Hundreds of millions daily, peak elastic scaling
- Adversarial response: New pattern discovery to rule online <4h (emergency) / <24h (regular)
- Appeal: Auto review <1h, with manual <24h
- CSAM: Zero latency—detection is block+immediate report

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| New adversarial large-scale bypass | Real-time sample collection, emergency rule hot update, temporary increase strictness |
| Model update causing misjudge surge | Graying-out release (1%→100%), auto rollback, A/B verification |
| Moderation system downtime | Degrade (high risk queue/low risk release), multi-AZ disaster recovery |
| Manual review queue too long | Dynamic priority, temporary expansion, AI pre-sort acceleration |
| CSAM miss detection | PhotoDNA+multi-model redundancy, hash library update, periodic red team test |

---

# 93. IT Operations SRE/DevOps Domain Architecture

> Related: §37 Business domain modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §23

**DomainDescriptor Mapping**:

- `domain_id`: `it-operations` · `recipe_archetype`: IncidentOps
- `risk_level`: High · `latency_tier`: realtime (alert analysis <30s, auto fix <2min)
- `hitl_intensity`: **High** (high-risk change CAB approval/security incident forensics/auto fix strategy online/budget procurement) · `regulatory_density`: High (MLPS 2.0/ISO 27001/SOC 2/PCI-DSS/NIST)

**Core Agent Roles**: Incident response · monitoring analysis · deployment automation · capacity planning · security operation

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.ops.incident_respond` | 35 | 70 | Known Runbook auto execute, unknown pattern mandatory manual |
| `tool.ops.deploy` | 40 | 80 | Production environment deployment must CAB approval + graying-out verification |
| `tool.ops.capacity_plan` | 20 | 35 | Auto generate planning suggestion, procurement decision needs management approval |
| `tool.ops.security_scan` | 25 | 60 | Scan auto execute, high-risk vulnerability fix plan needs security team confirmation |

**DomainEvalFramework**: MTTR (mean time to repair) · MTTD (mean time to detect) · SLO achievement rate · auto fix success rate · deployment failure rate · alert noise ratio (signal-to-noise optimization)

**HITL Strategy**: Production environment high-risk change mandatory CAB approval, security incident mandatory security team intervention. Runbook covered known failure can auto fix, but needs post-event audit. Deployment rollback · security incident forensics · capacity procurement · new auto fix strategy online all mandatory manual. Agent operation range strictly limited to pre-authorized resources.

**Key Guardrails**: Blast radius control (auto fix limited to single node/single service, cross-domain operation needs manual) · change window mandatory execution · operation audit full link immutable · security scan result tiered response · auto fix circuit breaker (consecutive failure auto stop and alert)

**Agent Workflow (Detailed)**:

- Incident Response Agent: Alert reception (Prometheus/PagerDuty) → aggregation → topology association → root cause hypothesis → auto fix (Runbook) → escalation/closure
- Monitoring Analysis Agent: Indicator/log/link tracing continuous analysis → dynamic baseline → anomaly detection → alert denoising
- Deployment Automation Agent: CI/CD pipeline → canary release (progressive traffic+indicator monitoring) → rollback → feature switch → dependency orchestration
- Capacity Planning Agent: Historical load+growth forecast → resource modeling → scaling suggestion → budget forecast → waste identification
- Security Operation Agent: IDS/IPS/WAF/vulnerability scan → threat intelligence match → auto response (IP ban/account lock) → vulnerability fix priority

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Monitoring | Prometheus, Grafana, Datadog, New Relic, Splunk, Zabbix |
| Log | ELK, Loki, Splunk, Fluentd/Fluent Bit |
| Link tracing | Jaeger, Zipkin, SkyWalking, Datadog APM |
| Incident management | PagerDuty, OpsGenie, VictorOps |
| Deployment/IaC | Kubernetes, ArgoCD, Terraform, Ansible, Helm |
| Security | CrowdStrike, Snort/Suricata, Cloudflare WAF, Nessus/Qualys |

**Data Sensitivity Classification**:

- Extremely sensitive: Production credentials (SSH/API Key/database password), vulnerability details, penetration test
- Confidential: System architecture topology, IP segment, capacity data, incident review, security policy
- Internal: Aggregate performance indicator, deployment history, public monitoring dashboard
- Log: May contain PII (needs desensitization), subject to retention/audit constraints

**Performance/Latency Budget**:

- Alert response: Trigger to Agent analysis <30s, auto fix <2min
- Monitoring collection: Indicator 15-60s interval, log <10s delay
- Deployment: CI build+test <15min, canary observation window configurable
- Security detection: Real-time intrusion <1s, vulnerability scan daily/weekly
- Monitoring system availability: 99.99%

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Auto fix causing cascade failure | Impact scope limit, operation reversible, single time only N% instance, circuit breaker |
| Alert storm overwhelming response | Aggregation deduplication, topology aware suppression, dynamic suppression rule |
| Canary not detecting chronic defect | Multi-dimensional indicator monitoring, extended observation window, Sticky Canary |
| Monitoring own failure | Independent meta-monitoring, multi-path alert (SMS/phone/IM) |
| Security event credential leak | Auto credential rotation, Vault/KMS, leak instant revoke re-sign |

---

# 94. Marketing and Brand Domain Architecture

> Related: §37 Business domain modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data see `v3.0-domain-research.md` §24

**DomainDescriptor Mapping**:

- `domain_id`: `marketing` · `recipe_archetype`: Analytics + Creative
- `risk_level`: Medium · `latency_tier`: near-realtime (public opinion <15min) + batch (Campaign report)
- `hitl_intensity`: **Medium** (brand communication content approval/marketing budget approval/brand crisis PR takeover/legal risk content legal review) · `regulatory_density`: Medium (Advertising Law/Internet Advertising Management Measures/FTC/GDPR/CAN-SPAM)

**Core Agent Roles**: Campaign orchestration · brand monitoring · SEO/SEM optimization · social media management · customer segmentation analysis

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.marketing.campaign` | 25 | 55 | Delivery strategy auto optimization, budget over threshold needs approval |
| `tool.brand.monitor` | 15 | 30 | Auto execute public opinion monitoring, crisis signal immediate alert |
| `tool.seo.optimize` | 20 | 35 | Auto execute keyword and content optimization suggestion |
| `tool.social.publish` | 30 | 70 | All outbound content must be reviewed by brand team before release |

**DomainEvalFramework**: ROAS (return on ad spend) · CPA/CPL · brand SOV (share of voice) · interaction rate · crisis warning accuracy · content compliance pass rate

**HITL Strategy**: All outbound content mandatory brand team review, brand crisis event immediately PR team takeover. Marketing budget change · brand cooperation approval · legal risk content legal review · crisis PR statement all mandatory manual. Data analysis · public opinion monitoring · SEO suggestion can auto execute. Agent generated content is only as draft for manual optimization.

**Key Guardrails**: Advertising law compliance auto detection (absolute wording/false propaganda/comparative advertising) · brand tone consistency check · competitor data collection compliance boundary · user portrait data anonymization · crisis public opinion tiered response plan · marketing email opt-out compliance (CAN-SPAM/GDPR)

**Agent Workflow (Detailed)**:

- Campaign Orchestration Agent: Marketing goal → cross-channel plan (timeline/channel/budget/audience) → content coordination → effect monitoring → dynamic adjustment
- Brand Monitoring Agent: Whole network brand mention monitoring (social/news/forum/short video) → sentiment analysis/topic clustering → crisis detection → health report
- SEO/SEM Agent: Ranking+traffic analysis → keyword research → content optimization + technical SEO → SEM bidding → ranking monitoring
- Social Media Agent: Multi-platform release (WeChat Official Account/Weibo/Douyin/Xiaohongshu/LinkedIn) → adaptive content → release time → interaction management
- Customer Segmentation Agent: Multi-source data (CRM/behavior/transaction/social) → clustering+RFM → high-value group → targeting suggestion

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Marketing automation | HubSpot, Marketo, Pardot, ZhiQuBaiChuan, Jingshuo |
| Social media | WeChat Official Platform, Weibo, Douyin/Ocean Engine, Xiaohongshu, Hootsuite |
| SEO/SEM | Google Search Console, SEMrush, Ahrefs, Baidu Search, 5118 |
| Public opinion | Qingbo Big Data, Xinbang, Brandwatch, Meltwater |
| Data | GA4, Adobe Analytics, Sensors Data, GrowingIO |

**Data Sensitivity Classification**:

- PII (high): Customer contact information, behavior portrait, CRM transaction record and preference
- Confidential: Brand strategy, unpublished listing plan, marketing budget, competitor analysis
- Internal: Content calendar, A/B plan, aggregate marketing metric

**Performance/Latency Budget**:

- Public opinion monitoring: Negative detection <15min (golden response time), regular hourly
- Social release: Content generation <5min/piece, image/video hour level
- SEO: Ranking tracking daily, technical audit weekly
- Campaign report: Near real-time <15min delay
- Customer segmentation: Batch daily, triggered <5min

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Public opinion crisis period auto release | Crisis detection all channel pause, notify PR team, plan response template |
| Content violating advertising law | Pre-release compliance scan (absolute/false statement), legal review flow |
| SEO strategy causing search penalty | White hat SEO guardrail, ranking abnormal monitoring, penalty recovery process |
| Attribution model distortion | Multi-attribution model comparison, increment test calibration |
| Cross-platform release failure | Queue retry, specification adaptive conversion, multi-platform status monitoring |

---

# Part V — Intelligent Interaction Layer (§39-§44)

---

# 39. Natural Language Task Entry Architecture

> Enable non-technical users to directly interact with the platform through natural language, replacing handwritten JSON/API calls.
> Related: §6 API contract · §13 OAPEFLIR · §37 Business domain modeling · §40 Goal decomposition · §44 Non-technical user experience

## 39.1 Design Principles

- Natural language is a **first-class interaction mode**, equal to REST API, not syntactic sugar on top of API
- All NL interactions first convert to `TaskDraft`; only user-confirmed `TaskSpec` can enter the standard `RequestEnvelope`(§5.3), reusing existing control plane and execution plane
- Ambiguity must be explicitly resolved, not guessing user intent—better to ask one more question than to mis-execute high-risk actions
- Dialogue context is persisted to Memory(§29.2), recoverable across sessions
- Intent Parser output must go through schema validation, risk preview, and policy check; must not directly trust LLM-generated TaskSpec
- high/critical natural language instructions must first generate dry-run preview, after user confirmation still needs to go through §10/§47 risk and approval

## 39.2 NL Interaction Pipeline

```text
User input (natural language)
    │
    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Intent Parser │────▶│ Domain Router│────▶│ TaskDraft    │
│ (Intent recognition) │     │ (Domain routing)     │     │ (Task construction)    │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
    ┌──────────────┐     ┌──────────────┐        │
    │ Clarification│◀────│ Ambiguity    │◀───────┘
    │ Dialog       │     │ Detector     │   Loop back when ambiguous
    └──────┬───────┘     └──────────────┘
           │ User confirmation
           ▼
    ┌──────────────┐     ┌──────────────┐
    │ Risk Preview │────▶│ Confirmation │────▶│ RequestEnvelope │──▶ P1
    │ (Risk preview)   │     │ Receipt      │     │ (Standard contract)      │
    └──────────────┘     └──────────────┘     └──────────────┘
```

NL entry admission boundary:

```text
TaskDraft + ClarificationState + RiskPreview
  → UserConfirmationReceipt
  → confirmed TaskSpec
  → RequestEnvelope
```

`TaskDraft` and `ClarificationState` are pre-admission objects, must not enter P4, must not create HarnessRun. High-risk, incomplete permission, missing slot, or policy uncertain drafts must stay in clarification/confirmation state.

## 39.3 Core Components

| Component              | Responsibility                                                |
| ----------------- | --------------------------------------------------- |
| IntentParser      | Parse user natural language input, extract intent label and confidence          |
| TaskSpecBuilder   | Map confirmed TaskDraft to TaskSpec(§6), fill domain, parameter and constraint |
| AmbiguityResolver | Generate clarification question when confidence is below threshold, strategy see §39.4        |
| ContextEnricher   | Inject user role, historical dialogue, domain context and other environment information          |
| ResponseFormatter | Convert execution result to user-friendly natural language reply or structured card  |

| pre-admission object | Responsibility | Enter RequestEnvelope Condition |
| --- | --- | --- |
| TaskDraft | Save parsed goal, slot, candidate domain, risk preview and missing item | None; can only generate confirmed TaskSpec |
| ClarificationState | Save follow-up round, pending question, user answer and confidence | All required slot resolved |
| UserConfirmationReceipt | Save user confirmation text, risk preview version, scope, time and actor | receipt valid and scope matches TaskSpec |

Confidence threshold default values: `intent_confidence_threshold=0.80`, `slot_confidence_threshold=0.85`. Below threshold must enter Clarification Dialog; when involving high-risk action, threshold cannot be relaxed by domain configuration.

## 39.4 Ambiguity Resolution Strategy
| Ambiguity Type | Example               | Resolution Method                                           |
| -------- | ------------------ | -------------------------------------------------- |
| Domain ambiguity | "Make a report"       | Follow up "Financial report or advertising report?"                     |
| Scope ambiguity | "Clean up expired data"     | Follow up "Which domain's data? Time range?"                 |
| Risk ambiguity | "Update product price"     | Show risk preview + confirm "This will affect X products online"         |
| Time ambiguity | "Complete ASAP"         | Map to urgency=high, notify expected completion time              |
| Permission ambiguity | "Help me approve these requests" | Check permissions, prompt "You don't have approval permission, need to forward to X" when no permission |

## 39.5 Multi-Turn Dialogue State Machine

```text
         ┌─────┐
         │ Idle │◀──────────────────────────┐
         └──┬──┘                            │
            │ User input                       │ Task complete/cancel
            ▼                               │
    ┌───────────────┐                       │
    │ Intent Parsing │                      │
    └───────┬───────┘                       │
            │                               │
     ┌──────┴──────┐                        │
     │Ambiguous?     │                        │
     ▼ Yes         ▼ No                     │
┌──────────┐  ┌──────────┐                  │
│Clarifying│  │ Building │                  │
│(In follow-up)   │ (Task construction) │                  │
└────┬─────┘  └────┬─────┘                  │
     │ User answer      │                       │
     └──────┬──────┘                        │
            ▼                               │
    ┌───────────────┐                       │
    │ Confirming    │                       │
    │ (Risk preview+confirm)│                       │
    └───────┬───────┘                       │
            │ User confirmation                       │
            ▼                               │
    ┌───────────────┐     ┌────────────┐    │
    │ Executing     │────▶│ Reporting  │────┘
    │ (Executing)      │     │ (Result report)  │
    └───────────────┘     └────────────┘    │
```

## 39.6 Security Constraints

- All outputs from NL entry must pass Prompt Injection protection(§16.5)
- High-risk intent (risk ≥ high) **must** be explicitly confirmed, NL is not allowed to trigger directly
- Only confirmed TaskSpec can generate RequestEnvelope; TaskDraft, ClarificationState, and input not matching UserConfirmationReceipt must fail closed
- Dialogue history is constrained by data classification(§11.6), confidential/restricted content is not echoed back
- NL entry permission is equivalent to caller's API permission, no additional privilege elevation
- Multi-turn context before entering memory must do data classification according to §29 MemoryContract; restricted/regulated dialogue defaults to only storing session memory, not entering long-term/shared memory

## 39.7 Multilingual and Internationalization (i18n)

| Level                 | Internationalization Strategy                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| Intent Parser        | Multilingual intent recognition: through ModelGateway(§15) call LLM that supports multiple languages; after language detection, route to corresponding locale Prompt template |
| Clarification Dialog | Response language follows user input language (auto-detect), or follows `preferred_locale` setting in user profile                |
| Risk Preview         | Risk description, cost estimate use user locale currency/date format                                                       |
| NL Status Summary(§43)     | Dashboard summary generated according to user locale; amount/date/number follow ICU format                                                 |
| Error message             | Platform standard error code mapped to multilingual message catalog; fallback language is en-US                                       |

---

# 40. Goal Decomposition Engine Architecture

> Add a Goal → Task decomposition layer on top of OAPEFLIR(§13), enabling users to describe business goals rather than single tasks.
> Related: §13 OAPEFLIR · §19 Agent delegation · §37 Business domain modeling · §39 NL entry · §41 Proactive Agent

## 40.1 Three-Layer Decomposition Model

```text
Goal (business goal)
  "Launch spring marketing campaign for product X"
    │
    ▼  GoalDecomposer
TaskGraph (domain task graph)                       ← New layer
  ├── [content-production] Create 3 sets of ad creative
  ├── [advertising] Configure and launch ad campaign
  ├── [data-analysis] Set up ROI tracking dashboard
  └── [legal] Review ad compliance
    │
    ▼  OAPEFLIR/Harness Planner (§13/§45)
PlanGraphBundle (execution graph)                   ← P4's only execution input
  ├── tool.design.generate_creative
  ├── tool.ad_platform.create_campaign
  └── ...
```

## 40.2 GoalDecomposer Interface

Core method `decompose(goal, constraints) → GoalGraphDraft → TaskGraphDraft`, decomposing high-level goals into verifiable drafts. GoalDecomposer does not directly produce executable PlanGraphBundle; drafts must be handed to Harness Planner to execute Normalize / Validate / Risk Propagation / Worst-Path Analysis before forming PlanGraphBundle.

| Parameter/Feature   | Description                                                    |
| ----------- | ------------------------------------------------------- |
| goal        | Structured goal description, containing goal text, owning domain and priority              |
| constraints | Decomposition constraints: max depth (default 5), budget upper limit(§18), deadline     |
| Return value      | GoalGraphDraft / TaskGraphDraft——nodes are TaskSpec drafts, edges are dependency relationships          |
| Cycle detection      | When constructing TaskGraph, automatically perform topological sort, if cycle detected, reject and report error |
| Budget allocation    | Allocate total budget to each node according to subtask estimated cost ratio                |

Goal decomposition must propagate budget, risk, permission, data boundary and capability constraints; LLM decomposition result must pass deterministic DAG validation, capability validation, risk propagation and budget propagation before entering Harness Planner. Only the PlanGraphBundle output by Planner is P4 executable input.

## 40.3 Decomposition Strategies

| Strategy         | Applicable Scenario                                    | Mechanism                                                      |
| ------------ | ------------------------------------------- | --------------------------------------------------------- |
| **Template matching** | Goal matches existing DomainRecipe(§37.7) or cross-domain template | Directly instantiate template, fill parameters                                  |
| **LLM planning** | New scenario without matching template                          | Call ModelGateway(§15) for decomposition, constrained by DomainDescriptor |
| **Hybrid**   | Partial match                                    | Template skeleton + LLM fills missing links                               |
| **Human-assisted** | Confidence < 0.7 or involves critical risk           | Generate preliminary decomposition plan, request manual review and adjustment                      |

## 40.4 Cross-Domain Dependency Graph Management

```text
[content-production]──▶[legal]──▶[advertising]──▶[data-analysis]
     Creative production              Compliance review       Launch online          Effect tracking
         │                                  │
         └──────────parallel────────────────┘
                 (Creative production and delivery config can run in parallel)
```

- Dependency graph automatic topological sort, identify tasks that can run in parallel
- **Circular dependency detection**: After decomposition, perform DAG verification on dependency_graph, if cycle is detected, reject execution and return cycle path to user/GoalDecomposer for retry
- Critical path calculation, estimate total duration
- When a single Task fails, decide according to dependency type: `blocks` → block downstream, `soft_dependency` → alert but continue
- Cross-domain data transfer follows DomainInteractionPolicy(§37.8)

## 40.5 Goal Lifecycle

| State                | Description                     | Can Transition To                               |
| ------------------- | ------------------------ | -------------------------------------- |
| draft               | Goal created, not yet decomposed       | decomposing, cancelled                 |
| decomposing         | Decomposing into Task          | decomposed, failed                     |
| decomposed          | Decomposition complete, waiting for confirmation       | executing, cancelled                   |
| executing           | Task executing          | completed, partially_completed, failed |
| completed           | All Task + success criteria met | archived                               |
| partially_completed | Part of Task completed, part failed | executing(retry), completed, cancelled |
| failed              | Decomposition or execution failed           | decomposing(retry), cancelled          |
| cancelled           | User cancelled                 | archived                               |

---

# 41. Proactive Agent Framework

> Enable Agent to proactively initiate tasks based on event triggers and scheduled scheduling, not just responding to API calls.
> Related: §4.2 P1 Interface Plane · §20 Long-running task · §37 Business domain modeling · §40 Goal decomposition

## 41.1 Design Principles

- Proactive Agent is **controlled automation**, not unconstrained autonomous behavior
- All triggers must be declared in DomainDescriptor(§37), undeclared triggers are not allowed to register
- Tasks generated by triggers go through **exactly the same risk control pipeline** as API-created tasks(§10)
- Cost generated by proactive behavior counts into corresponding domain's budget(§18)
- Proactive tasks must not preempt user task reserved budget; `user_task_budget_reserve >= 60%`
- medium+ proactive actions default to suggestion mode, not direct execution

## 41.2 Trigger Model

Each trigger is described by `TriggerDefinition`, must be declared in DomainDescriptor(§37) when registering:

| Field         | Type                                   | Description                                           |
| ------------ | -------------------------------------- | ---------------------------------------------- |
| triggerId    | string                                 | Globally unique identifier                                   |
| type         | schedule / event / condition / webhook | Trigger method: scheduled, event-driven, conditional expression, external callback |
| filter       | object                                 | Event filter condition or cron expression                     |
| cooldown     | duration                               | Minimum trigger interval, preventing high-frequency repeated triggers                 |
| maxFireCount | number \| null                         | Maximum trigger count, null means unlimited                    |
| boundAgentId | string                                 | Bound execution Agent, handled by this Agent after trigger        |

## 41.3 Trigger Modes

| Mode         | Behavior                                   | Applicable Scenario                                  | Risk Control                                    |
| ------------ | -------------------------------------- | ----------------------------------------- | ------------------------------------------- |
| **Auto execute** | Directly create task after trigger                     | Low-risk scheduled tasks (daily report generation, data sync)      | require_confirmation=false + risk_level=low |
| **Suggestion mode** | Push suggestion to user after trigger, execute after user confirmation   | Medium-high risk event response (CTR decline → suggest bid adjustment) | require_confirmation=true                   |
| **Silent record** | Only record event and analysis result after trigger, do not actively notify | Data accumulation (user behavior pattern recognition)              | action_type=update_dashboard                |

## 41.4 Trigger Storm Protection

- **max_fire_rate**: Each trigger has maximum trigger frequency, exceeding auto-degrades to silent record
- **cooldown**: Force cooldown between two triggers, preventing repeated execution
- **batch_window**: Event trigger can configure batch window, merging multiple events in short time into one trigger
- **circuit_breaker**: After N consecutive trigger task failures, automatically disable trigger and alert
- **Global trigger budget**: Each domain has maximum daily auto-trigger count, preventing runaway
- **proactive_budget_cap**: Set proactive task cost upper limit by tenant/domain, after exceeding only generate suggestion
- **ProactiveBudgetPool**: Proactive tasks use independent budget pool, must not consume user-initiated task reserved budget
- **UserInitiatedReserveRatio**: User-initiated task budget reserve ratio default ≥ 60%, triggers cannot break through
- **feedback loop detection**: If triggers form mutually triggering closed loop, automatically disable related triggers and create incident

## 41.5 Proactive Suggestion Pipeline

```text
Trigger fire
    │
    ▼
┌────────────────┐     ┌──────────────┐
│ Context Builder │────▶│ Suggestion   │
│ (Context building)    │ Generator    │
└────────────────┘     └──────┬───────┘
                              │
                       ┌──────▼───────┐
                       │ Suggestion   │
                       │ Queue        │──▶ User dashboard(§43) / Push notification
                       └──────┬───────┘
                              │ User confirmation
                       ┌──────▼───────┐
                       │ Task/Goal    │──▶ Standard execution pipeline
                       │ Creator      │
                       └──────────────┘
```

---

# 42. Progressive Autonomy Model

> Based on historical performance data, drive Agent autonomy dynamic promotion/demotion, reduce manual supervision burden.
> Related: §10 Risk control · §17 Model evaluation · §21 Human-machine collaboration · §37.2 DomainCapability · §41 Proactive Agent

## 42.1 Trust Score Model

Each Agent maintains a `TrustScore` record, driving promotion and demotion of autonomy level(§42.2):

| Field          | Type                                            | Description                                         |
| ------------- | ----------------------------------------------- | -------------------------------------------- |
| agentId       | string                                          | Unique identifier of associated Agent                        |
| currentScore  | number (0-1000)                                 | Current trust score, accumulated from execution success/failure/override events |
| level         | suggestion / supervised / semi_auto / full_auto | Current autonomy level, mapped by score range               |
| historyWindow | duration (default 90d)                             | Sliding window length used to calculate score, use continuous weight rather than cliff window |
| decayRate     | number (default 0.05)                              | Decay coefficient per cycle with no activity, see §42.3 for details         |

## 42.2 Autonomy Promotion/Demotion Rules

**Default Promotion Ladder**:

| Current Level   | Promote To     | Condition                                                            | Approval          |
| ---------- | ---------- | --------------------------------------------------------------- | ------------- |
| suggestion | supervised | ≥ 50 executions + success rate ≥ 95% + 0 incident(30d)                    | domain_owner  |
| supervised | semi_auto  | ≥ 200 executions + success rate ≥ 98% + manual override rate < 5% + 0 incident(60d) | domain_owner  |
| semi_auto  | full_auto  | ≥ 500 executions + success rate ≥ 99% + manual override rate < 1% + 0 incident(90d) | platform_team |

**Instant Demotion Triggers**:

| Event             | Demotion Action            | Recovery Condition                      |
| ---------------- | ------------------- | ----------------------------- |
| Trigger P0 Incident | Directly down to suggestion | Manual investigation + platform_team approval |
| Trigger P1 Incident | Down one level              | 30d no incident               |
| Consecutive 3 failures    | Down one level              | 10 consecutive successes                 |
| Cost over budget 200%  | Down to supervised     | Budget adjustment + domain_owner confirmation  |

## 42.3 Trust Score Decay Mechanism

Long-term non-executing Agent trust score should gradually decay, avoiding historical high-trust Agent still holding too high autonomy after behavior environment changes:

| Condition | Decay Behavior | Description |
| --- | --- | --- |
| Consecutive no execution | Daily smooth decay by `decayRate`, minimum not lower than current level lower limit | Avoid 90d cliff-style production mutation |
| 30d no execution | Trigger reminder + freeze promotion | Not auto demote |
| 90d no execution and risk-weighted sample insufficient | Demote one level needs platform policy allow and record reason | High-risk Agent default first enter supervised review |
| 180d no execution | Autonomy down to suggestion | Agent treated as "dormant state", needs domain_owner to reactivate |

Decay assessment is run daily by `TrustDecayWorker`, changes record `agent.autonomy.decayed` event to event_log(§28). domain_owner can tighten decay parameters through DomainGovernancePolicy(§37.9), but cannot exempt platform-level max autonomy cap, risk-weighted trust score, or high/critical side effect manual confirmation.

## 42.4 Autonomy Change Audit

All autonomy changes record to event_log(§28):

Before auto demote or suspend, must generate `AutonomyChangeImpactReport`, explaining affected active run, SLA, approval queue, budget, and business owner. Key business can configure grace period or manual confirmation; except P0/P1 security events, must immediately demote or suspend.

## 42.5 Integration with Existing Architecture

| Existing Component               | Integration Method                                                                  |
| ---------------------- | ------------------------------------------------------------------------- |
| §10 Risk control           | trust_score only affects automation_mode and review friction, not lower inherent_risk       |
| §17 Model evaluation           | eval quality degradation auto trigger trust demotion                                             |
| §21 HITL               | Autonomy determines HITL mode——suggestion level must manual confirm, full_auto level silent execution     |
| §37.2 DomainCapability | `max_automation_level` as ceiling——trust no matter how high cannot exceed domain set upper limit         |
| §41 Proactive Agent         | Only semi_auto and above allow auto execute trigger, otherwise go suggestion mode                   |

---

# 43. Unified Operations Dashboard Architecture

> Provide layered operations view for one-person company to ten-thousand-person enterprise, replace SRE-oriented infrastructure-level metrics.
> Related: §12 Exception event · §18 Cost management · §27 SLO · §37.9 Governance · §42 Autonomy

## 43.1 Dashboard Layering

```text
┌─────────────────────────────────────────┐
│  L1 Operator View (One-person company / Business owner) │  "Is everything normal? What needs my attention?"
├─────────────────────────────────────────┤
│  L2 Domain Management View (Department Agent administrator)        │  "What Agents does my domain have? How is performance?"
├─────────────────────────────────────────┤
│  L3 Platform Operations View (Platform SRE team)         │  "Infrastructure health? Resource utilization?"
├─────────────────────────────────────────┤
│  L4 Fleet Management View (Ten-thousand-person enterprise platform team)       │  "Which department has problems? Global capacity?"
└─────────────────────────────────────────┘
```

All dashboard metrics must register to `MetricRegistry`, declaring metric_owner, source_of_truth, freshness_slo, actionability, permission_filter, and stale_behavior. L1/L2 natural language summary must first do redaction, prohibiting leakage of hidden knowledge, cross-tenant information, or approval details.

## 43.2 L1 Operator View

Business-oriented view for non-technical users:

| Panel         | Content                                       | Refresh Frequency |
| ------------ | ------------------------------------------ | -------- |
| My Task Status | In progress / completed / failed task list and progress percentage | Real-time     |
| Recent Results | Recent 24h completed task summary and output link        | 5min     |
| Pending Approval   | Approval requests needing current user confirmation, sorted by urgency   | Real-time     |
| Agent Health   | Availability rate of owned domain Agent and current autonomy level(§42) | 1min     |
| Budget Overview     | This month used quota / remaining quota(§18)               | 1h       |

## 43.3 L2 Domain Management View

Domain operations view for department Agent administrators:

| Panel          | Content                                                  | Refresh Frequency |
| ------------- | ----------------------------------------------------- | -------- |
| Domain Task Throughput  | Task submission count and completion count trend by hour/day                   | 5min     |
| Agent Utilization  | Each Agent execution proportion, queue depth, idle rate             | 1min     |
| Domain-level SLO Achievement | P50/P95 latency, success rate compared with DomainDescriptor(§37) SLO | 5min     |
| Top Failed Tasks  | Task types sorted by failure count, including root cause classification and related Incident   | 5min     |
| Cost Distribution      | Domain budget consumption detail: model call / tool call / storage(§18)       | 1h       |

## 43.4 L3 Platform Operations View

Infrastructure operations view for SRE team:

| Panel            | Content                                                | Refresh Frequency |
| --------------- | --------------------------------------------------- | -------- |
| Five-Plane Health      | P1-P5 Plane(§4) respective alive status and component Ready proportion     | 10s      |
| Resource Utilization      | CPU / memory / GPU / queue depth cluster-level heat map           | 30s     |
| Error Rate Trend      | 4xx/5xx error rate by service dimension and ring comparison change               | 1min     |
| Latency Distribution        | P50/P95/P99 latency, broken down by Interface→Execution→Model | 1min     |
| Incident Timeline | Active Incident list and auto fix progress(§26)               | Real-time     |

## 43.5 L4 Fleet Management View

Global operations view for ten-thousand-person enterprise platform team:

| Panel         | Content                                             | Refresh Frequency |
| ------------ | ------------------------------------------------ | -------- |
| Cross-Region Status   | Each Region cluster availability, sync latency, and failover readiness | 1min     |
| Fleet Cost Overview | Whole organization cost distribution by domain/region/tenant and ring trend(§18)    | 1h       |
| Tenant Comparison     | Tenant-level QPS, success rate, resource consumption horizontal comparison ranking       | 5min     |
| Capacity Forecast     | 7d/30d resource demand forecast and scaling suggestion based on historical trend     | 6h       |
| Compliance Posture     | Audit policy coverage rate, sensitive operation approval rate, compliance deviation count(§10)  | 1h       |

## 43.6 NL Status Summary Generation

Dashboard supports natural language summary, generated by ModelGateway(§15):

- **Daily brief**: "Today 5 Agents completed 23 tasks (success rate 96%), spent ¥45. Advertising domain Agent performed excellently (ROI 2.8x). There are 2 approvals waiting for you to handle, 1 budget alert needs attention."
- **Exception brief**: "Past 1 hour, customer service domain Agent success rate dropped from 95% to 78%, main reason is knowledge base API response slowed. Has auto-degraded to cache mode. Suggest you check knowledge base service status."
- **Away return brief**: "During the 8 hours you were away: completed 12 tasks, spent ¥80. Finance domain has 1 P1 Incident (auto recovered). 3 approvals have timed out and been auto handled. No immediate action needed."

Dashboard operation buttons must not directly trigger high-risk OperationalDirective or DecisionDirective. Any operation that writes truth, sends out data, submits side effect, changes budget, or affects mode must go through dashboard action risk gate, secondary confirmation, and audit.

Every LLM-generated summary must carry evidence_refs, freshness, confidence, redaction_policy, and source_projection_version; when evidence is missing or freshness expires, only display "insufficient evidence", must not generate deterministic conclusion.

---

# 44. Non-Technical User Experience Architecture

> Enable non-developers (business owners, independent operators) to use all platform capabilities through visual interface.
> Related: §22 SDK/DX · §38 Onboarding Runbook · §39 NL entry · §43 Dashboard

## 44.1 User Role Layering

| Role         | Technical Level | Main Interaction Method                 | Dashboard Level |
| ------------ | -------- | ---------------------------- | -------- |
| Independent operator   | Non-technical   | NL dialogue(§39) + L1 dashboard(§43)  | L1       |
| Business line owner | Non-technical   | L1 dashboard + visual configuration         | L1       |
| Domain administrator     | Low-code   | Visual configuration + occasional CLI        | L2       |
| Pack developer  | Technical     | SDK + CLI(§22)               | L2/L3    |
| Platform SRE     | Technical     | CLI + Admin API + L3/L4 dashboard | L3/L4    |

## 44.2 Visual Domain Onboarding Wizard

Replace the §38 CLI + YAML flow for technical personnel:

```text
Step 1               Step 2               Step 3               Step 4
Choose business type          Configure core capabilities          Set risk control rules          Activate
┌──────────┐        ┌──────────┐        ┌──────────┐        ┌──────────┐
│ "What type│        │ Drag and  │        │ Risk control│        │ One-click  │
│  of business│───────▶│ choose needed│───────▶│ Approval rules│───────▶│ Gray-out │
│  is yours?"│        │ capabilities│        │ [Preset templates]│        │ [Progress bar]  │
│ [Card selection]│        │ [Tool panel]│        │         │        │
└──────────┘        └──────────┘        └──────────┘        └──────────┘
```

| Traditional Method(§38)                                       | Visual Method(§44)             |
| --------------------------------------------------- | --------------------------- |
| `agent-platform domain init --archetype=crud_heavy` | Card selection "Customer service type"        |
| Manually edit DomainDescriptor YAML                      | Form filling + intelligent recommendation         |
| `agent-platform domain validate`                    | Real-time verification + traffic light prompt       |
| Multi-team collaboration 5-9 weeks                                   | Wizard guidance 1-3 days (low-risk domain) |

Visual domain onboarding wizard only applies to low-risk fast-track. medium/high/critical domain can only show read-only configuration, pending gate, and evidence status; UI must not provide "risk slider" to lower inherent risk, risk can only be calculated by DomainRiskSpec and PolicyEngine.

## 44.3 Visual Workflow Builder

Workflow orchestration interface for non-technical users:

Visual builder must be the projection/editor of PlanGraph, not another DSL. Before saving, must pass Graph Normalize / Validate / Risk Propagation / Worst-Path Analysis; any UI node must be able to map to PlanGraph node, edge, ConstraintPack, or HITL decision.

## 44.4 Intelligent Guided Onboarding

```text
First login
    │
    ▼
┌──────────────────┐
│ "Hello! I am your  │
│  AI business assistant.   │
│  What do you want to use me for?"│
└───────┬──────────┘
        │ User describes business
        ▼
┌──────────────────┐
│ Auto recommendation          │
│ • Suitable domain templates    │
│ • Needed integrations      │
│ • Estimated cost        │
└───────┬──────────┘
        │ User confirmation
        ▼
┌──────────────────┐
│ One-click configuration          │
│ • Create Domain     │
│ • Install basic Pack   │
│ • Set default risk control    │
│ • Activate first Agent  │
└───────┬──────────┘
        │ 3 minutes later
        ▼
┌──────────────────┐
│ "Your first Agent │
│  is ready! Try saying:  │
│ 'Help me...'        │
└──────────────────┘
```

## 44.5 Single-Person Mode vs Enterprise Mode

Platform auto-adjusts UX complexity based on user count:

| Dimension     | Single-Person Mode                                    | Enterprise Mode            |
| -------- | ------------------------------------------- | ------------------- |
| Tenant     | Auto create single tenant, hide tenant concept            | Complete multi-tenant management      |
| Approval     | Self-approval (low/medium risk auto pass, high risk popup confirmation) | Complete approval flow engine(§21) |
| Security Review | Built-in security check auto run, no manual security team needed      | Independent security team review    |
| Onboarding Process | Wizard guidance 3 minutes                             | Four-phase Runbook(§38) |
| Dashboard     | L1 operator view only                          | L1-L4 all levels        |
| Cost     | Personal budget view + money-saving suggestion                     | Department-level chargeback   |
| Governance     | Simplified (self is domain_owner)                 | Complete organizational governance        |

Single-person mode high-risk action still must dry-run + cooldown + rollback/compensation window; irreversible or regulated action must not directly full_auto through self-approval.

## 44.6 Accessibility (WCAG 2.1 AA)

| WCAG Principle | Platform Implementation                                                                           |
| --------- | ---------------------------------------------------------------------------------- |
| Perceivable    | All charts provide alt text / data table alternative view; color not as only information carrier (paired with shape/label)    |
| Operable    | All functions operable via keyboard (Tab order, Enter confirm, Esc cancel); NL entry supports voice input(§68) |
| Understandable    | Error message clearly states problem and fix suggestion; form label and input explicitly associated                             |
| Robust    | Semantic HTML; ARIA annotation for key interactive controls (dashboard card, approval button, workflow canvas node)        |

**Audit and Test**: Auto run axe-core scan before each frontend release; WCAG AA violation is treated as release blocker.

**Frontend Implementation Requirements**: WCAG 2.1 AA compliance requires actual frontend UI implementation (React/Vue/Angular and other frameworks). Platform TypeScript code provides data model, color contrast tokens (`getSeverityColorTokens()`), and accessibility label building function (`buildAccessibleLabel()`), but actual UI components must be implemented in specific frontend framework. §21 HITL notification component (`src/platform/five-plane-interface/console/hitl/notification.ts`) provides TypeScript logic, color values meet WCAG AA contrast requirement (≥4.5:1), but rendering and interaction implementation is the responsibility of the frontend.

---

# Part VI — Harness Engineering and Eight-Pillar Deepening Layer (§45, §58)

---

# 45. Harness Runtime Authoritative Execution Model

> Converge the platform's scattered constraints, tools, context, feedback capabilities into a unified Harness Runtime—a standardized Agent running base. Fuse the three industry schools' eight-pillar model: Anthropic role-based closed loop, LangGraph durable runtime, OpenAI governance and Guardrails primitives. HarnessRuntime does not replace business modules; but replaces all scattered execution entries, becomes the only execution entry, and orchestrates existing modules into a closed-loop runtime.
> Related: §13 OAPEFLIR · §5 Inter-plane communication contract · §10 Risk control · §14 Execution Plane · §19.5 Multi-Agent collaboration protocol · §21 HITL · §29 Memory/Knowledge · §37 Business domain modeling · §42 Progressive autonomy

## 45.1 Harness Core Axioms

> **Eight Pillars**: Constraints · Tools · State/Memory · Feedback · Durability · Evaluation Harness · HITL Runtime · Observability/Replay

Harness upgrades one-off model invocations to "constrained, executable, memorable, feedback-able, recoverable, evaluable, intervenable, observable" closed-loop system. The eight-pillar extension comes from the unified abstraction of three industry schools: Anthropic's harness/eval harness (role-based closed loop + evaluation runtime), LangGraph's durable runtime (durable execution + memory layering + HITL interrupt/resume), OpenAI's agents primitives/guardrails (tool governance + layered guardrails + orchestration).

| Pillar                 | Responsibility                                                   | Core Module                                            |
| -------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| Constraints          | Unified constraints (Policy/Approval/Risk/Sandbox/Budget/Org)    | §45.3 ConstraintPack · §45.20 Guardrails            |
| Tools                | Unified tools (Executor/Plugin/Connector/MCP)              | §45.4 ToolbeltAssembler · §45.17 Tool Harness       |
| State/Memory         | Unified state (Truth/Event/Checkpoint/Memory/Knowledge)    | §45.5 HarnessContext · §45.16 Memory Namespace      |
| Feedback             | Unified feedback (Step/Task/Workflow/System level)               | §45.6 FeedbackEnvelope                              |
| Durability           | Unified durable execution (checkpoint/pause/resume/replay)         | §45.11 Recovery Controller · §45.15 Durable Harness |
| Evaluation Harness   | Unified evaluation (runtime decision + offline evaluation + version comparison)           | §45.10 Evaluator Agent · §45.14 Evaluation Harness  |
| HITL Runtime         | Unified human-machine collaboration (inspect/patch/override/takeover/resume) | §21 HITL approval · §45.18 HITL Runtime                 |
| Observability/Replay | Unified observability and replay (run trace + replay + audit)         | §58.1/§58.4 · §45.19 Async Harness                  |

Every task run goes through HarnessRuntime unified entry, assembles constraints, tools, context, drives Planner→Generator→Evaluator multi-round closed loop, produces final result and evidence chain. From v4.2, HarnessRuntime is the only executable runtime, HarnessRun is the only authoritative Run; OAPEFLIR only provides StageRationale, TraceProjection, and Audit View, does not create independent run entities. `PlanBundle` in Harness is the product layer wrapper, internal canonical execution contract must be `PlanGraphBundle`; P4 only executes tasks according to PlanGraph / NodeRun semantics.

Planner, Generator, Evaluator in this chapter by default represent Runtime Role, not required to deploy as three independent Agents. Only in multi-Agent deployment, they map to independent Agent instances; regardless of deployment form, Prompt, ContextAssemblyContract, Evidence, and responsibility subject must be isolated by role.

## 45.1.1 Single Definition Table

To avoid drift caused by repeated definitions in §13, §14, §25, §28, §45, §58, the following objects have only one specification anchor, other chapters can only reference or describe projection:

| Concept | Specification Anchor | Other Chapter Role |
| --- | --- | --- |
| HarnessRun / HarnessStep | §45.13 | §13/§58 only explain semantics and observation |
| PlanGraphBundle / PlanGraph | §5.3 / §13.8 | §40/§44 only produce draft or projection |
| NodeRun / NodeAttempt | §14.10 / §14.15 | §25/§28 only describe state persistence and events |
| SideEffectRecord | §14.11 | §57 only declares connector action contract |
| BudgetReservation | §18.3 | §25/§58 only reference budget facts |
| Event Registry | §28 | §58 Runtime Test Matrix only defines test coverage |
| HarnessDecision / DecisionInputBundle | §58.6 / §45.25 | §21/§47 only consume decision and human responsibility |

**Harness Positioning in Five Planes**: Harness is the unified runtime kernel of P3 Orchestration Plane, through protocol sinks to P4, through state aggregates to P5, through governance is controlled by P2.

| Plane             | Harness Interaction Method             | Key Protocol/Data                                                  |
| ---------------- | ---------------------------- | -------------------------------------------------------------- |
| P1 Interface     | Receive request envelope                 | RequestEnvelope, SessionContext                                |
| P2 Control       | Consume governance directive                 | OperationalDirective, DecisionDirective, Policy, Approval, Budget, Guardrails(§45.20) |
| P3 Orchestration | **Harness is P3 unified orchestrator** | HarnessRuntime, Planner/Generator/Evaluator closed loop               |
| P4 Execution     | Issue execution plan                 | PlanGraphBundle, NodeRun, ToolCall, HITLWait, AsyncDispatch |
| P5 Evidence      | Write run evidence                 | HarnessRun, HarnessStep, NodeRun, OapeflirTraceProjection, ContextSnapshot, Evidence |

## 45.2 HarnessRuntime Overall Architecture

```text
User / API / Webhook / Scheduler
        ↓
  P1 Interface Plane
        ↓
┌───────────────────────────────────────────────────────────┐
│                    Harness Runtime                         │
│                                                           │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────────────┐ │
│  │  Constraint   │ │  Tool        │ │  Context          │ │
│  │  Engine +     │ │  Harness +   │ │  Assembler +      │ │
│  │  Guardrails   │ │  Toolbelt    │ │  Memory Namespace │ │
│  └──────┬───────┘ └──────┬───────┘ └─────────┬─────────┘ │
│         │                │                    │           │
│         ▼                ▼                    ▼           │
│  ┌───────────────────────────────────────────────────┐   │
│  │            HarnessLoopController                  │   │
│  │                                                    │   │
│  │  ┌──────────┐  ┌───────────┐  ┌────────────────┐ │   │
│  │  │ Planner  │─>│ Generator │─>│   Evaluator    │ │   │
│  │  │ Agent    │  │ Agent     │  │ Agent + Eval   │ │   │
│  │  └────┬─────┘  └───────────┘  │ Harness        │ │   │
│  │       │                        └───────┬────────┘ │   │
│  │       │         ┌──────────┐           │          │   │
│  │       │         │ HITL     │◀──escalate┘          │   │
│  │       │         │ Runtime  │                      │   │
│  │       │         └────┬─────┘                      │   │
│  │       └── replan ◄───┴── resume ──────────────────┘   │
│  └───────────────────────────────────────────────────┘   │
│         │                    │                            │
│  ┌──────▼──────┐     ┌──────▼──────┐                     │
│  │  Durable     │     │  Recovery    │                     │
│  │  Harness     │     │  Controller  │                     │
│  └─────────────┘     └──────────────┘                     │
└───────────────────────────────────────────────────────────┘
        ↓                    ↓                 ↓
  P4 Execution        P5 State &         P2 Control
  Plane               Evidence           Plane
```

## 45.3 ConstraintPack — Task-Level Constraint Envelope

Each task run carries an explicit constraint package, making constraints from implicit logic to first-class input:

| Constraint Dimension      | Description                                                         | Source                                             |
| ------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| autonomy_mode | suggestion / supervised / semi_auto / full_auto              | §42 Progressive autonomy + §37.2 DomainCapability ceiling |
| budget        | max_cost / max_model_tokens / max_context_tokens / max_output_tokens / max_steps / max_duration_ms | §18 Cost management + §37.9 DomainGovernancePolicy |
| tool_policy   | allowed/denied tools + network/filesystem policy             | §11 Security + §30 Pack Manifest + DomainDescriptor  |
| risk_policy   | max_risk_level + approval_required_at                        | §10 Risk control + §37.3 DomainRiskProfile           |
| output_policy | require_evidence / require_evaluation / require_human_review | §21 HITL + §59 Explainability                          |

ConstraintPack is assembled by ConstraintEngine at HarnessRuntime entry, merging platform default policy, tenant override, business domain override, and task-level override (priority increasing).

**Existing Module Mapping**: PolicyCenterService · ApprovalService · RiskEvaluationEngine · CostAlertService

## 45.4 ToolbeltAssembler — Task-Level Tool Assembly

According to task type, business domain, risk level, tenant policy, and current context, assemble minimum usable tool set:

**Assembly Process**:

1. Get domain allowed tool list from DomainDescriptor(§37)
2. Filter according to ConstraintPack.tool_policy
3. Exclude high-risk tools according to risk level (exclude all write tools in read_only mode)
4. Exclude over-budget tools according to tenant budget
5. Add safety guard (input schema validation, output secret scan, sandbox tier binding)
6. Add tool reliability profile (success rate, average latency, circuit breaker state), for Planner selection reference

**Tool Evidence Standard**: Each tool execution auto produces input summary, output summary, telemetry, artifact_ref, error_class, retryability, incorporated into Evidence Plane(§P5).

**Existing Module Mapping**: ToolExecutor · PluginExecutor · BrowserExecutor · AdapterExecutor

## 45.5 HarnessContext — Unified Runtime Context

Unify scattered state/memory/knowledge/artifact into runtime context object, assembled by ContextAssembler at the start of each round of loop:

**Four Types of Context**:

| Context               | Content                                                        | Lifecycle |
| -------------------- | ----------------------------------------------------------- | -------- |
| Conversation Context | User dialogue, instruction, preference, NL raw input(§39)                      | Session-level   |
| Task Context         | Current task goal, PlanGraphBundle, NodeRun state, completed node Receipt | Task-level   |
| Memory Context       | Historical experience, long-term memory, Agent behavior pattern(§29)                     | Persistent   |
| Knowledge Context    | External knowledge, document, retrieval result, DomainKnowledgeSchema(§37.4)      | On-demand retrieval |

**Context Budget**: Not all content can be stuffed into the model. ContextAssembler executes for each round of loop context:

- Token budget trimming (total token budget = ConstraintPack.budget.max_cost conversion)
- Relevance score ranking (relevance to current step goal)
- Freshness score ranking (recent context preferred)
- Trust score filtering (untrusted source knowledge marked with confidence)

**Context Snapshot**: Each round of loop saves `ContextSnapshot` to P5 Checkpoint, used for crash recovery, replay, difference analysis, debugger time travel(§65).

**Existing Module Mapping**: MemoryPlaneService · KnowledgePlaneService · AuthoritativeTaskStore · ArtifactStore

## 45.6 FeedbackEnvelope — Unified Feedback Protocol

Converge scattered feedback signals into standardized envelope, establish four-segment feedback closed loop:

**Four-Segment Closed Loop**:

| Feedback Level    | Trigger Timing                   | Evaluation Content                               | Output                                |
| ----------- | -------------------------- | -------------------------------------- | ----------------------------------- |
| Step level     | After single tool/model call completion    | Output quality, latency, cost, deviation from expectation     | Immediate judgment: continue / retry / replan |
| Task level     | After all steps of a Task complete | Whether Task goal achieved, whether acceptance criteria met   | Aggregated score + improvement suggestion                 |
| Workflow level | After multi-step flow all complete         | Whether business goal achieved, end-to-end quality           | Final evaluation report                        |
| System level   | After accumulating enough feedback signals (async) | Whether need to update prompt/policy/tool_config | LearningCandidate / ImprovementChangeSet → P2 Release |

Step level feedback is produced real-time by Evaluator Agent; Task/Workflow level is aggregated by Evaluator; System level is handled async by Learn/Improve(§13.2).

**Existing Module Mapping**: FeedbackCollector · PostExecutionQualityGate · StrategyLearningService · ApprovalContextSummaryService

## 45.7 HarnessLoopController — Unified Closed-Loop Control

Converge loop control logic from scattered multiple services into a single controller:

**Control Decision Matrix**:

| Evaluator Output | Loop Behavior                 | Condition                        |
| -------------- | ------------------------- | --------------------------- |
| accept         | Advance to next step (or complete)    | score ≥ quality_threshold   |
| retry_same_plan | Retry current step (same plan) | retry_count < max_retries   |
| replan         | Trigger Planner to replan and generate GraphPatch / new graphVersion | replan_count < max_replans  |
| escalate_to_human | Transfer to human(§21 HITL)       | risk elevated / confidence too low |
| downgrade_mode | Degrade runtime mode              | Cost/risk approaching threshold           |
| abort          | Safe termination + record evidence       | Budget exhausted / unrecoverable error     |

**Loop Guard**:

- Maximum loop count (default 10, constrained by ConstraintPack.budget.max_steps)
- Maximum replan count (default 3)
- Total time upper limit (constrained by ConstraintPack.budget.max_duration_ms)
- Total cost upper limit (constrained by ConstraintPack.budget.max_cost)
- Any guard triggers → force terminate + escalate

**Existing Module Mapping**: OapeflirLoopService · RolloutStateMachine · TransitionService

## 45.8 Planner Agent — Planning Responsibility

Planner Agent is responsible for understanding goals, decomposing tasks, identifying risks, generating execution plans.

**Standardized Output PlanBundle / PlanGraphBundle**:

`PlanBundle` is the wrapper for product, debugging, and explanation layer; `PlanGraphBundle` is the canonical execution contract from P3→P4. Planner can first generate GoalSpec / task_graph / success_criteria, but before entering execution must convert to PlanGraphBundle, and complete Normalize / Validate / Risk Propagation / Worst-Path Analysis.

| Field             | Description                                    |
| ---------------- | --------------------------------------- |
| goal             | Original goal + structured GoalSpec              |
| task_graph       | Task dependency DAG (reuse §40 GoalDecomposer) |
| plan_graph_bundle | Executable PlanGraphBundle (P4's only execution input) |
| execution_budget | Step/time/cost budget allocation                  |
| risk_profile     | Risk assessment snapshot (reuse §10 RiskAssessment) |
| success_criteria | Quantifiable acceptance criteria list                    |
| evaluator_hints  | Evaluation hints for Evaluator (which metrics to focus on) |

**Prompt Separation**: Planner uses dedicated Planner Prompt (obtained from DomainPromptLibrary §37.6), does not share template with Generator/Evaluator.

**Existing Reusable Module**: IntakeRouter · AssessmentService · PlanGraphBuilder · GraphNormalizer · GoalDecomposer · PolicyCenterService

## 45.9 Generator Agent — Execution Responsibility

Generator Agent is responsible for calling tools, executing steps, writing back evidence, generating intermediate results.

**Standardized Output WorkProduct**:

| Field           | Description                                         |
| -------------- | -------------------------------------------- |
| harnessStepId  | Current execution semantic step ID (consistent with §45.13)         |
| artifacts      | Produced artifact reference list                           |
| observations   | Observation records during execution                         |
| result_summary | Result summary (for Evaluator evaluation)                |
| telemetry      | Step-level telemetry (latency, token consumption, tool call count) |

**Key Behavior Constraints**:

- When encountering blocking (tool unavailable, insufficient permission, external timeout), request help (trigger escalate), not force through
- All tool calls go through Toolbelt filter, cannot directly call unassembled tools
- Each step execution auto produces evidence (input/output/side_effect), writes to P5

**Existing Reusable Module**: ExecutionDispatchService · MultiStepSupervisor · ToolExecutor · PluginExecutor · UnifiedChatProvider

## 45.10 Evaluator Agent — Evaluation Responsibility

Evaluator Agent is responsible for judging result quality, checking goal deviation, deciding next action.

**Standardized Output EvaluationReport**:

| Field           | Description                                       |
| -------------- | ------------------------------------------ |
| passed         | Whether passed                                   |
| score          | Quality score 0-100                             |
| issues         | List of found issues (type + severity + position)   |
| recommendation | accept / retry / replan / escalate / abort |
| confidence     | Evaluation confidence 0.0-1.0                         |

**Evaluation Dimensions**:

- **Goal deviation**: Distance between current result and PlanBundle.success_criteria / PlanGraph terminal criteria
- **Quality gate**: Reuse §17 model evaluation + DomainEvalFramework(§37.5)
- **Risk change**: Whether risk elevated after execution (compare PlanGraphBundle.riskProfile with GraphRiskPropagationReport)
- **Cost rationality**: Whether actual token/time consumption within budget

**Prompt Separation**: Evaluator uses dedicated Evaluator Prompt, does not share with Planner/Generator.

**Existing Reusable Module**: FeedbackCollector · StrategyLearningService · PostExecutionQualityGate · ApprovalContextSummaryService · SloAlertingService

## 45.11 Recovery Controller

When Harness running process encounters failure (worker crash, external timeout, model unavailable), Recovery Controller performs recovery based on ContextSnapshot(§45.5):

| Failure Type            | Recovery Strategy                                                    |
| ------------------- | ----------------------------------------------------------- |
| Worker crash         | Recover from recent ContextSnapshot, re-apply lease, continue from breakpoint     |
| LLM Provider unavailable | Trigger ModelGateway(§15) fallback chain, switch provider and continue |
| Tool timeout            | LoopController decides retry (same tool) or replan (replace tool) |
| Budget exhausted            | Safe termination + save current state + notify user                          |
| PlatformPanic(§60)  | Immediately serialize complete state to checkpoint, wait for platform recovery and continue         |

Reuse existing Recovery Workers (LeaseReclaimer · StuckRunSweeper) and Checkpoint mechanism(§14).

## 45.12 Integration with Existing Architecture

| Existing Component            | Harness Integration Method                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------- |
| §5 Inter-plane contract       | HarnessRuntime as unified entry of P3 Orchestration, receives RequestEnvelope, outputs PlanGraphBundle |
| §10 Risk control        | ConstraintPack.risk_policy assembled by RiskAssessmentEngine                                   |
| §13 OAPEFLIR        | Planner/Generator/Evaluator/Loop is external simplified mapping of OAPEFLIR eight stages(§13.5)                  |
| §14 Execution Plane | Generator Agent executes through standard PlanGraphBundle → Graph Scheduler → NodeRun → NodeAttemptReceipt path |
| §21 HITL            | LoopController's escalate path directly calls HITL approval flow                                       |
| §37 Business domain modeling      | DomainDescriptor drives ConstraintPack/Toolbelt/Context domain-level configuration                          |
| §42 Progressive autonomy    | ConstraintPack.autonomy_mode determined by AgentTrustProfile                                    |
| §59 Explainability        | Each round of loop PlanBundle/PlanGraphBundle/WorkProduct/EvaluationReport auto incorporated into explanation pipeline      |
| §65 Debugger          | ContextSnapshot sequence supports time travel debugging                                                      |

## 45.13 HarnessRun / HarnessStep — Unified Run Contract

> Define run entity and step entity as first-class contracts.

**HarnessRun** represents one complete Harness task run:

| Field             | Description                                                      |
| ---------------- | --------------------------------------------------------- |
| runId            | Globally unique run identifier                                         |
| tenantId         | Tenant                                                      |
| goal             | Original goal + structured GoalSpec                                |
| mode             | sync / async（§45.19）                                    |
| riskLevel        | Runtime risk level (determined by ConstraintPack)                  |
| budget           | max_cost / max_model_tokens / max_context_tokens / max_output_tokens / max_steps / max_duration_ms |
| constraintPack   | This run's constraint snapshot(§45.3)                              |
| plannerOutput    | PlanBundle / PlanGraphBundle（§45.8）                     |
| steps            | HarnessStep sequence                                          |
| currentIteration | Current loop round                                            |
| maxIterations    | Constrained by ConstraintPack                                    |
| finalDecision    | See §58.6 HarnessDecision: six basic decisions + four extended decisions     |
| status           | pending / running / paused / completed / failed / aborted |
| traceId          | Distributed trace association                                         |
| ownership        | Owning agent / tenant / domain                              |
| auditRefs        | Audit evidence reference list                                          |

**HarnessStep** represents an execution step:

| Field         | Description                                                                      |
| ------------ | ------------------------------------------------------------------------- |
| harnessStepId | Semantic step identifier; must not serve as P4 execution or receipt primary key                                 |
| nodeRunRefs  | Associated one or more NodeRuns; execution fact is based on NodeRun                         |
| phase        | plan / execute / evaluate / hitl / decision                               |
| role         | planner / generator / evaluator / hitl_operator / loop_controller         |
| inputs       | Step input (context snapshot reference)                                                |
| outputs      | Step output (PlanBundle / PlanGraphBundle / GraphPatch / WorkProduct / EvaluationReport / HarnessDecision) |
| rationale    | Decision rationale (incorporated into §59 explainability)                                             |
| evidenceRefs | P5 evidence reference                                                               |
| toolCalls    | Tool call record list                                                          |
| latency      | Step latency                                                                  |
| cost         | token/API cost                                                            |
| error        | Error information (if any)                                                          |
| nextAction   | Next action (determined by HarnessDecision)                                       |

**HarnessDecision** adopts §58.6 unified decision protocol: six basic decisions `accept / retry_same_plan / replan / escalate_to_human / downgrade_mode / abort`, and allows production extended decisions `quarantine / revoke_approval / pause_for_external / require_revalidation`.

MVP Harness slice only requires: ConstraintPack, minimal Toolbelt, minimal ContextSnapshot, PlanGraphBundle, NodeRun, basic Evaluator, HITL approval, Trace Replay. Complete Memory Namespace, Learning pipeline, IDE Debugger, and advanced Evaluation Harness deferred to Hardening/Enterprise.

**Existing Module Mapping**: AuthoritativeTaskStore · NodeAttemptReceipt · OapeflirViewProjectionService · AuditService. Old ExecutionReceipt / OapeflirLoopService only used by migration period adapter.

## 45.14 Evaluation Harness — Unified Evaluation Runtime

> §45.10 Evaluator Agent is responsible for runtime decision. This section completes **offline evaluation, pre-release evaluation, version comparison** three types of evaluation capabilities, forming complete Evaluation Harness.
> Industry reference: Anthropic "outcome is more important than transcript"; evaluation harness should run tasks in controlled environment, observe environment state, aggregate results.

**Three Evaluation Modes**:

| Evaluation Mode     | Trigger Timing                                      | Evaluation Content                                               | Output                         |
| ------------ | --------------------------------------------- | ------------------------------------------------------ | ---------------------------- |
| Runtime evaluation   | After each step / each task completion                           | Evaluator Agent real-time decision（§45.10）                     | EvaluationReport             |
| Pre-release evaluation   | Before new Prompt/Planner/Evaluator/ToolBundle online | Run standard task set in isolated sandbox                             | Pass rate / regression comparison / quality distribution |
| Version comparison evaluation | Periodic / during graying-out                               | Compare new and old version success rate/iteration count/cost/failure pattern/human upgrade rate | Comparison report + graying-out decision suggestion      |

**Evaluation Focus——Outcome not Transcript**:

- Whether task is truly complete (whether environment state reaches target state)
- Whether governance and compliance violated
- Whether more stable than old version
- End-to-end cost and efficiency

**Evaluation Runtime Components**:

- EvalRunService: Manage evaluation task creation, scheduling, isolated execution
- TaskOutcomeGrader: Score based on success_criteria and environment state assertions
- EnvironmentStateAssertionService: Verify final state in controlled environment
- AgentTrajectoryRecorder: Record complete execution trajectory for replay analysis
- EvalAggregationService: Aggregate multi-task evaluation results, generate statistical report

**Existing Module Mapping**: PostExecutionQualityGate · §17 model evaluation · DomainEvalFramework(§37.5)

## 45.15 Durable Harness — Durable Execution Pillar

> §45.11 Recovery Controller handles failure recovery. This section upgrades durable execution from recovery strategy to first-class pillar——checkpoint/pause/resume is Harness's basic capability, not additional capability.
> Industry reference: LangGraph "durable execution = process saves progress at key points, can pause and resume from original position later".

**Pause Reason Registry**:

| pauseReason                  | Description                   | Typical Scenario                       |
| ---------------------------- | ---------------------- | ------------------------------ |
| waiting_for_human            | Waiting for human approval/intervention      | HITL Runtime(§45.18) escalate  |
| waiting_for_external_event   | Waiting for external system callback       | Webhook / third-party approval / CI result |
| waiting_for_budget_reset     | Budget exhausted, waiting for next cycle | Token/cost budget hit ceiling             |
| waiting_for_policy_clearance | Waiting for policy review pass       | High-risk action needs P2 approval           |
| waiting_for_dependency       | Waiting for upstream task/data ready  | DAG dependency not met                 |

**Resume Strategy**:

| resumeStrategy     | Description                         | Applicable Scenario                   |
| ------------------ | ---------------------------- | -------------------------- |
| resume_same_state  | Recover from exact breakpoint, state unchanged     | Manual approval pass, external callback arrives |
| resume_with_replan | Trigger Planner to replan when resuming  | Context changed, policy updated   |
| resume_supervised  | Enter supervised mode after resume   | High-risk recovery, trust demotion       |
| abort_on_resume    | Judge cannot continue when resuming, safe termination | Timeout too long, environment irreversible     |

**Key Mechanism**:

- Each round of loop ContextSnapshot(§45.5) is the persistence foundation of Durable Harness
- §20 long-running task sleep mechanism as Durable Harness's underlying implementation
- Serialize complete HarnessRun state to P5 Checkpoint on pause
- When resuming, ResumeStrategyService selects strategy based on pauseReason + current environment

**Existing Module Mapping**: HibernationService · RecoveryWorker · LeaseReclaimer · StuckRunSweeper · CheckpointService

## 45.16 Memory Namespace and Strategy

> §45.5 HarnessContext treats memory as context type. This section completes three-layer memory namespace and promotion strategy.
> Industry reference: LangGraph explicitly distinguishes thread-scoped short-term memory and cross-thread long-term memory; OpenAI takes state/memory as core primitive.

**Three-Layer Memory Namespace**:

| Layer                    | Scope                    | Content                                                                                     | Lifecycle                         |
| ----------------------- | ------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------- |
| Working Memory          | Current run / current iteration | Current goal summary, plan summary, problem list, budget remaining, risk and mode, selected tools, recent failure reason, key evidence | Archived after run end                   |
| Long-term Memory        | Cross run / cross project       | Historical experience, Agent behavior pattern, task success/failure pattern, common tool combination                                | Persistent, expire by retention policy |
| Shared Knowledge Memory | Knowledge layer promotable to general experience  | Best practices across agent / across domain, recovery plans for common failures, evaluation rule suggestions                        | Need manual review to promote                        |

**Memory Promotion Strategy**:

- Working → Long-term: After run end, Evaluator marked as "valuable" observation auto candidate promotion, reviewed by MemoryPromotionPolicy
- Long-term → Shared Knowledge: After N times cross agent verification candidate promotion, needs manual review
- Reverse demotion: Long-term consecutive M times no reference entries auto mark as stale, expire and clean
- Anti-self-reinforcement: Evaluator cannot alone promote its just-generated judgment to Long-term Memory; must go through one of holdout task, different model/different judge, or manual review. Memory marked contested, low confidence, from failed run, or from unverified tool output can only enter quarantine, must not affect subsequent Evaluator.

**ContextSnapshot retention / compaction**:

- Each round of loop must write checkpoint, but long-term retention is layered by tier: most recent N complete snapshots, key decision snapshots, terminal snapshots, others compressed into summary + hash + artifact refs
- After retention expires, perform compaction, do not delete legal hold, audit evidence, HITL responsibility record, and side effect evidence
- ContextEvictionPolicy fixed priority: policy/approval/budget/risk > current truth > confirmed user spec > recent evidence > memory > knowledge retrieval > generated summary

**Namespace Isolation**:

- Tenant isolation: Different tenant's Long-term Memory physically isolated
- Domain isolation: Same tenant different domain's Working Memory logically isolated
- Cross-domain sharing: Need to go through §50 Knowledge domain isolation and controlled sharing access control

**Existing Module Mapping**: MemoryPlaneService · KnowledgePlaneService · §29 Memory/Knowledge boundary · §50 Knowledge domain isolation

## 45.17 Tool Harness — Tool Governance

> §45.4 ToolbeltAssembler is responsible for assembling tool subset by task. This section upgrades tools from "callable" to "governed first-class resource".
> Industry reference: OpenAI/Anthropic both point out that tool's schema, applicable boundary, credibility, call cost, and failure semantics should all be governed.

**Tool Capability Profile**:
Each registered tool must be accompanied by:

| Profile Field            | Description                                                         |
| ------------------- | ------------------------------------------------------------ |
| toolId              | Globally unique identifier                                                 |
| capabilityType      | read / write / compute / network / filesystem / browser / db |
| riskLevel           | low / medium / high / critical                               |
| expectedLatency     | P50/P99 expected latency                                             |
| expectedCost        | Token/API cost estimate per call                                |
| reliabilityScore    | Historical success rate (dynamically updated)                                       |
| requiredPermissions | Required permission list                                                 |
| allowedDataClasses  | Allowed data class (PII/confidential/public)                |
| allowedTenants      | Tenant whitelist (empty = all)                                        |
| allowedDomains      | Domain whitelist (empty = all)                                          |
| outputTrustLevel    | Output trust level (verified / unverified / untrusted)          |

**Tool Call Governance Record**:
Each tool call auto records:

- Selection reason (which reasoning step of Planner/Generator selected)
- Call result (success/partial success/failure)
- Whether output is trustworthy
- Whether enter Long-term Memory
- Whether trigger fallback
- Whether trigger Guardrails(§45.20)

**Tool Lifecycle**: registered → active → deprecated → retired, aligned with §30 Pack lifecycle.

**Existing Module Mapping**: ToolExecutor · PluginExecutor · BrowserExecutor · AdapterExecutor · §30 Pack Manifest

**Tool Selection Governance**:

Tool call is not free choice, but a three-stage process constrained by governance:

| Phase     | Object                   | Description                                                    |
| -------- | ---------------------- | ------------------------------------------------------- |
| Candidate selection | ToolSelectionCandidate | Available tool set after ConstraintPack + domain + risk-tier filtering  |
| Selection decision | ToolSelectionDecision  | Record Planner/Generator reasoning basis and alternatives for selecting this tool     |
| Fallback strategy | ToolFallbackPolicy     | Fallback chain when tool call fails (degraded tool → manual → abort) |

Four hard rules:

1. Planner can only select tools from ToolSelectionCandidate set, cannot jump out of constraint boundary
2. Generator cannot bypass Planner's selection result to directly call unselected tools
3. Evaluator post-evaluates tool selection rationality, can require Planner to reselect when unreasonable
4. risk-tier ≥ high tools must configure ToolFallbackPolicy, otherwise ConstraintPack verification fails

## 45.18 HITL Runtime — Human-Machine Collaboration Runtime

> §21 defines HITL approval mode, §45.7 LoopController provides escalate path. This section upgrades HITL from approval flow to Harness native runtime——human is not only approving at process edge, but can also see state, change state, continue execution during running.
> Industry reference: LangGraph "checkpointer lets human check, interrupt, approve, modify state during running and then resume"; OpenAI "guardrails and human review jointly determine when run continues, pauses, or stops".

**Five Types of HITL Capabilities**:

| Capability     | Description                                                                   | Trigger Method                       |
| -------- | ---------------------------------------------------------------------- | ------------------------------ |
| Inspect  | View current run state, plan, context, evaluator findings                   | Active view / dashboard(§43) entry      |
| Patch    | Modify planner output / working context / constraints / success criteria | Manual modification in HITL interface then write back     |
| Override | Override evaluator recommendation / mode / budget / selected tools         | Manual override decision                   |
| Takeover | Direct manual takeover execution, Generator pause                                       | High-risk / insufficient trust / emergency scenario   |
| Resume   | Resume auto run after manual processing (related to §45.15 resumeStrategy)                   | Triggered after Patch/Override/Takeover |

**HITL and Durable Harness Relationship**:

- HITL trigger → Durable Harness pause (pauseReason = waiting_for_human)
- Manual complete → Durable Harness resume (resumeStrategy manually selected or auto recommended)
- All HITL operations write to audit log (§12 audit + §59 explainability)

**HITL Timeout Strategy**:

- Default wait duration configured by §21 HITL mode
- After timeout, escalate to higher approval layer or abort according to ConstraintPack's escalation_policy

**Existing Module Mapping**: ApprovalService · TakeoverController · §21 HITL mode · §47 Approval routing

**HITL State Machine**:

```text
                      ┌──────────────────────────────────────────┐
                      │                                          │
   ┌─────────┐  HITL trigger  ┌──────────────────┐                   │
   │ Running │──────────→│ Paused_for_Human │                    │
   └─────────┘           └────────┬─────────┘                    │
                                 │                               │
              ┌──────────┬───────┼────────┬──────────┐          │
              ↓          ↓       ↓        ↓          ↓          │
         Inspecting  Patched  Overridden  Manual   Timeout      │
              │          │       │      Takeover     │          │
              │          │       │        │          │
              └──────────┴───────┴────────┘          │          │
                         │                           ↓          │
                    resume/approve              Escalate/Abort  │
                         │                           │          │
                         ↓                           ↓          │
                    ┌─────────┐              ┌───────────┐      │
                    │ Resumed │              │  Aborted  │      │
                    └────┬────┘              └───────────┘      │
                         │                                      │
                         └──────────────────────────────────────┘
                                  Back to Running
```

**State Transition Rules**:

| Operation     | Pre-State                           | Post-State                      | Impact Scope                            |
| -------- | ---------------------------------- | ----------------------------- | ----------------------------------- |
| Inspect  | Paused_for_Human                   | Inspecting → Paused_for_Human | Read-only, does not change run state               |
| Patch    | Paused_for_Human                   | Patched → wait for resume         | Modify context/variables, does not change plan |
| Override | Paused_for_Human                   | Overridden → wait for resume      | Replace current plan or step result          |
| Takeover | Paused_for_Human                   | Manual_Takeover → wait for resume | Manual full takeover, agent pause inference        |
| Resume   | Patched/Overridden/Manual_Takeover | Resumed → Running             | Resume auto execution, carry manual modification          |
| Abort    | Any Paused sub-state                 | Aborted                       | Terminate run, record termination reason              |

## 45.19 Async Harness — Async Run Mode

> Complete async run mode, adapt to enterprise multi-hour/multi-round/multi-approval async work scenarios.
> Industry reference: Anthropic "pre-built, configurable, running in managed infrastructure agent harness, suitable for long-running tasks and async work".

**Two Run Modes**:

| Mode          | Applicable Scenario                                                           | Interaction Method                                   |
| ------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| Sync Harness  | Second-level task, in-session response, simple tool chain                                   | Request-response, block waiting for result                    |
| Async Harness | Multi-hour task, multi-round collaboration, multiple approvals, long-time analysis, automation pipeline, batch task group | Create run → poll/subscribe → mid-way intervention → final result |

**Async Harness Capabilities**:

- create_run: Create async HarnessRun, return runId
- poll_status: Query current state and progress by runId
- subscribe_events: Subscribe to run event stream through Webhook/SSE
- inspect_step: View any step's detailed information
- intervene_mid_run: Trigger any operation of HITL Runtime(§45.18) mid-way
- replay_after_completion: Replay analysis after completion（§58.4）

**Async and Durable Relationship**: Async Harness depends on Durable Harness(§45.15) checkpoint/pause/resume mechanism. Each Async run naturally supports interrupt and resume.

**Existing Module Mapping**: §20 long-running task · WebhookDeliveryService · §43 dashboard · EventBus

## 45.20 Guardrails Layered Architecture

> §45.3 ConstraintPack converges constraints to task-level envelope. This section establishes five-layer Guardrails on top of ConstraintPack, making guardrails run through Harness entire process.
> Industry reference: OpenAI "guardrails should not only do unified risk assessment at entry, but should layer into the entire process".

**Five-Layer Guardrails**:

| Layer                | Check Timing            | Check Content                                                             | Intercept Action               |
| ------------------- | ------------------- | -------------------------------------------------------------------- | ---------------------- |
| Input Guardrails    | Before request enters Harness | prompt injection · sensitive request classification · unsupported target detection · input format validation    | Reject / rewrite / degrade     |
| Planning Guardrails | After Planner output      | Prohibited plan pattern · unauthorized delegation · too wide tool range · unsafe goal decomposition        | Require replan / escalate |
| Tool Guardrails     | Before and after tool call        | Untrusted tool output · unsafe API target · too wide file/DB access · high-risk action upgrade | Intercept / downgrade / require confirmation |
| Memory Guardrails   | Memory read/write time          | Prohibited retention content · unsafe Long-term promotion · cross-tenant leak · boundary violation       | Reject write / desensitize        |
| Output Guardrails   | Before result return          | Policy violation · unsafe execution suggestion · regulated content · too high confidence groundless declaration        | Filter / rewrite / annotate     |

**Guardrails and ConstraintPack Relationship**: ConstraintPack defines "what the constraints are", Guardrails defines "where the constraints execute, how to intercept". The two complement: ConstraintPack is static constraint envelope, Guardrails is dynamic execution checkpoint.

Guardrail conflict adopts strictest wins: `abort > deny > escalate > replan > filter > allow`. Each run must maintain `guardrail_action_count`, `last_guardrail_signature`, and `guardrail_cooldown_until`; same signature consecutively triggers exceeding upper limit means guardrail vibration, must abort or escalate_to_human, cannot continue replan consuming budget.

**Existing Module Mapping**: §10 Risk control · §11 Security · §16.5 Prompt injection defense · §23 Compliance · §68 Multimodal security

## 45.21 Harness Ten Invariants

> The bottom line rule for enterprise-grade Harness running. Any implementation and configuration cannot bypass.

1. Any complex task must first have PlannerOutput, prohibited from directly executing without plan
2. Any GeneratorOutput must correspond to EvaluatorReport, prohibited from skipping evaluation
3. Any retry / replan / escalate / abort must record HarnessDecision and reason
4. Any long task (duration > 60s or steps > 3) must have iteration checkpoint
5. Any tool output before entering Long-term Memory must pass trust/promotion rules（§45.16/§45.17）
6. Any human override must write to audit log, associate traceId and operator identity
7. Any multi-agent run must clearly define planner/generator/evaluator/controller responsibility subject
8. Any async run must support state query (poll_status) and mid-way intervention (intervene_mid_run)
9. Any high-risk run (risk_level ≥ high) must support downgrade_mode or HITL escalate
10. Any harness run must be traceable（§58.1）、replayable（§58.4）、auditable（§12）

## 45.22 OAPEFLIR-Harness Convergence Contract

Harness is the only executable runtime; OAPEFLIR is run semantics, governance stages, and explanation projection. The convergence relationship between the two:

| Harness Object | OAPEFLIR v4.2 Projection / Contract | Description |
| --- | --- | --- |
| HarnessRun | OapeflirTraceProjection | OAPEFLIR stage view is derived from HarnessRun / HarnessStep / NodeRun events |
| HarnessStep / NodeRun | Execute stage projection | Step and node are authoritative execution entities, OAPEFLIR only explains their stage semantics |
| PlanBundle / PlanGraphBundle | Plan stage output view | Planner output must be graphed, verified, risk propagated, PlanGraph belongs to `HarnessRun.plannerOutput` |
| HarnessDecision | DecisionInputBundle + Decision Engine | Freeze input before decision, event-ize after decision |
| ContextSnapshot | ContextAssemblyContract output | Each round of context assembly is replayable |
| Evaluation Harness | EvaluationGate | Runtime evaluation and pre-release gate unified |
| HITL Runtime | HumanResponsibilityRecord | Manual approval scope and responsibility boundary explicitly recorded |

Harness Runtime cannot bypass PlanGraph, Event Registry, Budget Ledger, SideEffect Manager, and EvaluationGate; OAPEFLIR projection also cannot drive HarnessRun state transition in reverse.

## 45.23 Context Assembly Contract

Planner, Generator, Evaluator must use independent ContextAssemblyContract, avoiding inter-role context pollution.

| Field | Description |
| --- | --- |
| role | planner / generator / evaluator |
| inputRefs | Request, Observation, Assessment, PlanGraph, NodeRun, Artifact, Memory reference |
| taintPolicy | Tool output, user input, external knowledge taint propagation rules |
| budget | token / latency / retrieval count budget |
| rankingPolicy | relevance / freshness / trust / recency ranking |
| redactionPolicy | secret / PII / regulated data desensitization rules |
| outputSnapshotRef | Frozen context snapshot |

Context assembly must output auditable snapshot; LLM call only consumes snapshot, does not directly read any runtime state object.

ContextAssemblyContract must declare input source priority, token budget, eviction / truncation report, taint propagation, PII/secret redaction, and loss impact. Default input priority: policy / approval / budget / risk > current NodeRun truth > user confirmed TaskSpec > recent evidence > memory > knowledge retrieval > model-generated summary.

## 45.24 Prompt Execution Contract

Before Prompt execution, must freeze the following information:

- promptId, promptVersion, role, model policy, output schema
- contextSnapshotRef, toolOutputTaint, memoryReadRefs
- budgetReservationRef, traceId, runVersionLockRef
- recorded output refs required for trace replay, scheduler decision refs, or non-determinism declaration for re-execution replay

Planner / Generator / Evaluator Prompt must be independently versioned, independently rolled out, independently evaluated. LLM output must pass schema validation, guardrail, taint propagation, and Evaluation constraints before entering next stage.

Each Prompt call must generate `PromptExecutionRecord`:

| Field | Description |
| --- | --- |
| promptVersion | PromptBundle / role prompt frozen version |
| modelRoute | ModelGateway routing, provider, model, and fallback path |
| inputHash / outputHash | Input output hash, supporting Trace Replay and tamper detection |
| contextSnapshotRef | This call consumed context snapshot |
| guardrailResult | Input, output, and tool guardrail results |
| usage | token, latency, cost, currency, and BudgetReservation reference |

## 45.25 DecisionInputBundle

Decision Engine must freeze DecisionInputBundle before decision:

| Input | Source |
| --- | --- |
| evaluatorReport | Evaluator Agent / Evaluation Harness |
| policyOutcome | P2 Policy Center |
| budgetState | Budget Ledger |
| riskState | Assess + Graph Risk Propagation |
| nodeState | NodeRun truth |
| sideEffectState | SideEffect / Reconciliation |
| hitlState | HITL Runtime |
| guardrailFindings | Five-layer Guardrails |

DecisionInputBundle is HITL / Evaluator / Audit's unified evidence artifact, must be referenceable in §6 API, §26 table anchor, and §58 Trace Replay.

Decision priority: deterministic failure / policy deny / budget exhausted / critical guardrail block takes priority over LLM evaluator accept. LLM-as-Judge cannot override deterministic failure.

Guardrail conflict priority fixed as: `abort > deny > escalate > replan > filter > allow`. Each run must set `guardrail_action_count` upper limit; exceeding upper limit means loop cannot converge, must abort or escalate_to_human.

## 45.26 Memory Write Governance

Memory write is not Generator's free side effect. Any request to write Long-term Memory or Shared Knowledge must form `MemoryWriteRequest`, containing source, confidence, taint, data class, TTL, promotion target, and reviewer policy. Prohibited secret, un-redacted PII, holdout eval data, low-confidence tool output directly entering long-term memory.

## 45.27 HITL Responsibility Record

Each human approve, reject, patch, override, takeover, resume must generate HumanResponsibilityRecord:

| Field | Description |
| --- | --- |
| actor | Human subject and organization ownership |
| action | approve / reject / patch / override / takeover / resume |
| scope | This approval or override affected run / node / sideEffect / budget / policy scope |
| rationale | Human decision reason |
| beforeRef / afterRef | Before/after snapshot of change |
| expiresAt | Authorization validity period |
| auditRef | Audit record |

HITL approve only approves declared scope, cannot implicitly expand to subsequent node, child run, or irreversible side effect.

---

# 58. Harness Cross-Cutting Concerns

> Harness Runtime(§45) introduces cross-cutting engineering requirements——Harness-level observability, Prompt layered governance, Failure-to-Learning pipeline, Replay/Simulation, architecture legacy issues convergence, and unified decision protocol.
> Related: §45 Harness Runtime · §12 Exception event · §16 Prompt management · §27 SLO · §65 Debugger

## 58.1 Harness-Level Observability

Existing observability(§9.7, §12, §27) is oriented towards infrastructure and plane granularity. Harness needs **run granularity** to observe the full link:

| Metric                              | Description                              | SLO                                         |
| --------------------------------- | --------------------------------- | ------------------------------------------- |
| harness.run.duration              | Single HarnessRun end-to-end latency        | default P99 < 60s, or use DomainDescriptor.sloProfile override |
| harness.loop.count                | Loop count of single run             | mean < 3, max ≤ ConstraintPack.max_steps    |
| harness.replan.count              | Replan count                        | mean < 1                                    |
| harness.evaluator.score           | Evaluator score distribution                | P50 ≥ 80                                    |
| harness.constraint.rejection_rate | ConstraintPack rejection rate             | < 5% (too high means constraint too strict or task description unclear)      |
| harness.context.token_utilization | Context token budget utilization           | 60%-90% (too low wastes, too high may truncate key context) |
| harness.tool.reliability          | Real-time reliability profile of each tool in Toolbelt | Success rate ≥ 95%                                |

All metrics are auto-collected through Harness Telemetry Middleware, written to P5 Evidence Plane, for §43 dashboard and §65 debugger to consume.

If DomainDescriptor does not define SLO, default uses §27 deployment-tier SLO fallback; "business domain not defined" must not be interpreted as no SLO or best effort. Harness metrics must record used slo_source = domain_override / platform_tier_default / emergency_override.

## 58.2 Prompt Layered Governance

Harness three types of Agents each need independent Prompt strategy, cannot mix:

| Prompt Type      | Responsibility                                   | Governance Requirements                                                        |
| ---------------- | -------------------------------------- | --------------------------------------------------------------- |
| Planner Prompt   | Goal understanding, task decomposition, risk identification, plan generation | Must pass §17 quality gate before release; associate with DomainPromptLibrary(§37.6) |
| Generator Prompt | Tool selection, step execution, result generation           | Independently versioned; full release only after A/B test pass                              |
| Evaluator Prompt | Quality judgment, goal deviation detection, improvement suggestion       | Independent from evaluated object; cannot share version with Generator Prompt              |

Prompt layering incorporated into §16 Prompt management system, each type of Prompt has independent rollout channel.

## 58.3 Failure-to-Learning Pipeline

Auto accumulate failure samples as platform knowledge assets:

```text
Step failure
  → FeedbackEnvelope(outcome=failed)
    → Failure mode classification (error_class + root_cause_category)
      → Auto generate candidate:
         ├── Recovery Playbook (recovery operation manual)
         ├── Prompt Patch Candidate (Prompt patch suggestion)
         ├── Risk Rule Candidate (risk rule suggestion)
         └── Evaluator Rule Candidate (evaluation rule suggestion)
      → Manual review → P2 Release governance → Graying-out online
```

Key constraint: All candidates are only suggestions, must go through §34 ADR-Quality-Gate-Before-Prompt-Release and P2 approval before taking effect. LearningCandidate must pass quality gate: bias check, diversity check, pollution prevention, PII/secret scan, holdout isolation, and domain_owner review.

## 58.4 Harness Replay and Simulation

Based on Event Registry, ContextSnapshot sequence(§45.5), and recorded LLM/Tool/Scheduler output, support:

| Capability         | Description                                              | Purpose               |
| ------------ | ------------------------------------------------- | ------------------ |
| Trace Replay | Reconstruct completed HarnessRun by event, recorded output, and scheduling decision | Fault location, audit forensics, projection rebuild |
| Strategy comparison     | Re-execute in isolated environment with different ConstraintPack          | Constraint tuning           |
| Prompt A/B   | Re-execute in isolated environment with different Planner/Generator/Evaluator Prompt | Prompt optimization |
| Tool replacement simulation | Re-execute after replacing tool in Toolbelt                  | Tool migration assessment       |
| What-if analysis | Re-execute after modifying a value in ContextSnapshot           | Root cause analysis           |

Default Replay is Trace Replay: does not re-call LLM / Tool, does not write production truth, does not produce real SideEffect. ReplaySession must declare `sideEffectMode=disabled/simulated/mock_only`, default `disabled`; any replay that does not explicitly declare must not touch external systems. Strategy comparison, Prompt A/B, tool replacement simulation, and What-if belong to Re-execution Replay, must mark nondeterministic, run in isolated sandbox(§34 ADR-Workflow-Debug-Session-Isolated), results must not overwrite original HarnessRun evidence.

ReplaySandboxPolicy: All Re-execution Replay uses independent budget, independent data namespace, read-only production evidence, simulated external side effect, and explicitly marks `nondeterministic=true`. Strategy comparison, Prompt A/B, and tool replacement results can only serve as proposal evidence.

## 58.5 Architecture Legacy Issues Convergence

Converge the following cross-chapter legacy issues:

This table is only kept as a readability index; long-term governance must migrate to `LegacyResolutionRegistry` / ADR / issue registry, to avoid the body permanently carrying historical debt.

| Issue                                                                   | Location     | Convergence Method                                                                                                                                                                                                         |
| ---------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §21 HITL approval vs §47 organizational approval routing responsibility overlap                              | §21, §47     | §21 defines HITL mode and approval semantics; §47 defines approval routing resolution——§21 decides "whether approval is needed, what mode", §47 decides "who is the approver, route to where"                                                                                             |
| §23 compliance architecture vs §49 departmental compliance engine responsibility overlap                             | §23, §49     | §23 defines platform-level compliance framework (GDPR/SOC2/encryption/lineage); §49 defines organizational-level compliance policy distribution——§23 is "compliance capability", §49 is "compliance policy inheritance and differentiation on organization tree"                                                                            |
| §31 HA architecture vs §52 multi-Region architecture scope overlap                              | §31, §52     | §31 defines single Region internal HA-1/HA-2/HA-3 tiering; §52 defines cross-Region deployment. Mapping relationship: HA-1 = single node single Region, HA-2 = dual node single Region, HA-3 = multi-AZ single Region, §52 = multi-Region single write authority + follower read + controlled failover |
| §32 deployment phases D1-D3 vs §8.4 scaling phases S1-S4 vs §33 implementation Phase 1-7 no mapping | §8, §32, §33 | Mapping: D1+S1 = Phase 1-2, D2+S2 = Phase 3-4, D3+S3 = Phase 5-6, S4 = Phase 6-7. The three classifications have different perspectives——D looks at deployment form, S looks at scaling capability, Phase looks at delivery rhythm                                                                  |
| No unified error classification system                                                     | §6.2         | Error code organized by layer: `PLATFORM.{plane}.{component}.{category}`, e.g., `PLATFORM.P4.TOOL.TIMEOUT`, `PLATFORM.P2.POLICY.DENIED`. OAPEFLIR can only serve as tag / trace projection field, not enter error code namespace. Each error code associates retryable/severity/user_message triple                                  |
| §61 AgentDefinition.autonomy_config vs §42 progressive autonomy no explicit association      | §42, §61     | autonomy_config is generated by §42 AgentTrustProfile drive, autonomy_config in AgentDefinition is snapshot——get initial value from TrustProfile when creating, dynamically updated by §42 TrustScorer at runtime                                              |

## 58.6 HarnessDecision — Unified Decision Protocol

> The decision of LoopController(§45.7) is upgraded to first-class protocol. Six basic decisions are accept/retry/replan/escalate/downgrade_mode/abort; production extended decisions are used for isolation, revocation of authorization, waiting for external system, and re-validation.

**Ten Decisions (Six Basic + Four Extended)**:

| Decision              | Semantics                      | Trigger Condition                               | Subsequent Action                                        |
| ----------------- | ------------------------- | -------------------------------------- | ----------------------------------------------- |
| accept            | Current step/task passes         | score ≥ threshold, no critical issues  | Advance to next step or complete run                            |
| retry_same_plan   | Retry current step with same plan  | Transient failure, tool timeout, retry_count < max  | Generator re-execute same step                      |
| replan            | Trigger Planner to replan     | Goal deviation, risk elevated, replan_count < max | Planner generates GraphPatch or new PlanGraphBundle    |
| escalate_to_human | Transfer to HITL Runtime(§45.18) | risk elevated / confidence too low / policy required | Durable Harness pause + HITL intervention               |
| downgrade_mode    | Degrade runtime mode              | Insufficient trust / tight budget / risk approaching threshold     | autonomy_mode down one level (e.g., semi_auto→supervised) |
| abort             | Safe termination                  | Budget exhausted / unrecoverable error / policy prohibited     | Save state + record evidence + notify user                  |
| quarantine        | Isolate run / agent / pack   | Pollution, leak, supply chain or behavior drift risk       | Stop new execution + enter safety review                       |
| revoke_approval   | Revoke approved authorization            | Scope mismatch, approval expired, risk elevated  | SideEffect enters revoked / expired              |
| pause_for_external | Wait for external system or human window    | External system not queryable, compliance wait, maintenance window    | Durable Harness pause                           |
| require_revalidation | Require re-validation            | version/policy/domain/config drift       | Re-run Validation / Policy / Budget checks    |

**HarnessDecision Standardized Fields**:

- decision: One of §58.6 unified decisions (six basic or four extended)
- reason: Structured reason (error_class + root_cause_category)
- evaluatorReport: EvaluationReport reference that triggers decision
- confidence: Decision confidence 0.0-1.0
- suggestedNextAction: Suggestion for next step (for LoopController reference)
- auditRef: Audit evidence reference

## 58.7 Runtime Metrics

v4.2 runtime metrics use HarnessRun / NodeRun as primary key, at least include:

| Metric | Description | Trigger Use |
| --- | --- | --- |
| runtime.run.admission_latency | RequestEnvelope to HarnessRun admitted latency | Admission bottleneck investigation |
| runtime.graph.ready_queue_depth | PlanGraph ready node queue depth | Scheduling congestion judgment |
| runtime.budget.reservation_conflict_rate | Budget atomic reserve conflict rate | Budget race and capacity warning |
| runtime.side_effect.ambiguous_rate | Side effect ambiguous proportion | External system reliability and reconciliation alert |
| runtime.trace_replay.success_rate | Trace Replay successful reconstruction proportion | Audit and incident review health |
| runtime.re_execution.drift_rate | Re-execution and original evidence difference proportion | Prompt / Tool change risk |

## 58.8 Incident Rules

The following events must auto generate Incident or upgrade existing Incident:

| Rule | Trigger Condition | Default Level |
| --- | --- | --- |
| replay_mismatch | Trace Replay cannot reconstruct original projection or evidence hash inconsistent | P1 |
| budget_reservation_stuck | reservation exceeds TTL not settled / released | P2 |
| side_effect_ambiguous_timeout | ambiguous exceeds reconciliation SLA | P1 |
| scheduler_nondeterministic | Same ready set scheduler decision missing or not replayable | P1 |
| panic_incomplete | PlatformPanicDirective not received all plane acks | P0 |
| policy_bypass_attempt | P4 receives regular execution request not authorized by P3/HarnessRuntime | P0 |

## 58.9 Error Code Taxonomy

Platform error code named according to the following format:

```text
PLATFORM.{plane}.{component}.{category}
```

Example:

- `PLATFORM.P3.GRAPH.VALIDATION.NO_ENTRY_NODE`
- `PLATFORM.P3.GRAPH.VALIDATION.UNBOUNDED_LOOP`
- `PLATFORM.P4.NODE.STATE.INVALID_TRANSITION`
- `PLATFORM.P4.SIDEEFFECT.CONFIRMATION.TIMEOUT`
- `PLATFORM.P3.HITL.LOCK.CONFLICT`
- `PLATFORM.P5.REPLAY.NONDETERMINISTIC_INPUT`
- `PLATFORM.P2.LEARNING.CANDIDATE.PII_DETECTED`

Each error code must declare retryable, severity, userMessage, operatorAction, incidentRule, and replayBehavior.

## 58.10 Runtime Test Matrix

OAPEFLIR-Harness minimum test matrix:

| Test Category | Coverage |
| --- | --- |
| State machine test | HarnessRun / NodeRun legal transition, illegal transition, terminal closed |
| Graph test | DAG validation, deadlock, join, risk propagation, worst-path, GraphPatch |
| Scheduler test | deterministic scheduling, Trace Replay schedule consistency |
| SideEffect test | proposed→approved→committed→confirmed, ambiguous, reconciliation, compensation |
| Guardrail test | critical block priority, LLM judge cannot override deterministic failure |
| HITL test | lock, scope approval, timeout escalation, manual takeover |
| Learning test | holdout contamination, PII/secret block, EvaluationGate |
| Fault Injection | worker crash, LLM timeout, tool timeout after commit, event append failure, checkpoint restore |

This matrix is the Phase 8d acceptance baseline, must also be incorporated into executable runtime contract and CI required release gate; any runtime schema, state machine, event registry, budget, or side effect change must update corresponding tests.

## 58.11 Executable Runtime Contract Package

Machine acceptance entry must land in `runtime-contracts/`, document only describes intent; schema, state machine, and invariant test are the implementation freeze basis. Minimum directory:

```text
runtime-contracts/
  task-draft.schema.ts
  confirmed-task-spec.schema.ts
  harness-run.schema.ts
  plan-graph-bundle.schema.ts
  graph-patch.schema.ts
  node-run.schema.ts
  node-attempt.schema.ts
  node-attempt-receipt.schema.ts
  side-effect.schema.ts
  reconciliation-record.schema.ts
  compensation-record.schema.ts
  budget-ledger.schema.ts
  budget-reservation.schema.ts
  budget-settlement.schema.ts
  event-envelope.schema.ts
  platform-fact-event.schema.ts
  oapeflir-view-event.schema.ts
  decision-input-bundle.schema.ts
  decision-directive.schema.ts
  operational-directive.schema.ts
  human-responsibility-record.schema.ts
  replay-session.schema.ts
  invariants/
    truth-event-atomicity.test.ts
    no-side-effect-in-replay.test.ts
    budget-reserve-before-execute.test.ts
    node-terminal-closed.test.ts
    contract-naming-consistency.test.ts
    event-consumer-platform-facts-only.test.ts
    graph-patch-side-effect-safety.test.ts
    hitl-responsibility-record.test.ts
    budget-concurrency-hard-cap.test.ts
```

Release gate:

| Gate | Must Check | Failure Handling |
| --- | --- | --- |
| Schema diff gate | OpenAPI / Zod / SDK types consistent with runtime-contracts | block merge |
| Naming consistency | Deprecated term not entering new write path | block merge |
| State-machine invariant | HarnessRun / NodeRun / SideEffect terminal closed | block release |
| Replay safety | Replay does not call real LLM, Tool, Connector, or external write API | block release + incident |
| Budget precondition | Active reservation before LLM / Tool / SideEffect / Eval | block release |
| Event atomicity | truth mutation and event append same transaction | block merge |
| Event consumer safety | truth projector only consumes platform facts, not oapeflir view events | block merge |
| GraphPatch safety | Executed nodes cannot be deleted; affectedSideEffects must be declared | block merge |
| HITL responsibility | approve / override / takeover / resume all generate HumanResponsibilityRecord | block release |
| Budget concurrency | 1000 concurrent reserve does not penetrate tenant hard cap | block release |

---

# Part VII — Organizational Governance Layer (§46-§51)

---

# 46. Organizational Hierarchy Model

> Layer company/division/department/team organization architecture on top of tenant/domain/pack, drive approval, budget, isolation, compliance layered governance.
> Related: §11 Security · §18 Cost · §21 HITL · §37 Business domain · §47 Approval routing · §48 SSO/SCIM

## 46.1 Organization Model

OrgNode is the basic unit of organization architecture, forming a tree structure (OrgTree):

| Field       | Type                                         | Description                                 |
| ---------- | -------------------------------------------- | ------------------------------------ |
| `nodeId`   | string (ULID)                                | Globally unique identifier                         |
| `type`     | enum: company / division / department / team | Organization level type                         |
| `parentId` | string \| null                               | Parent node ID, company node is null       |
| `name`     | string                                       | Organization unit name                         |
| `metadata` | object                                       | Extended attributes (cost center, region, owner, etc.) |

OrgTree supports dynamic reorganization——node add/delete/modify auto triggers downstream permission refresh, approval route recompute (§47), and budget reallocation. All changes record audit log.

## 46.2 Organization Level and Platform Level Mapping

```text
Organization architecture                  Platform architecture
company ──────────────────── platform (single instance)
  ├── division ────────────── tenant_group (budget summary)
  │   ├── department ──────── tenant (isolation unit)
  │   │   ├── team ────────── domain + pack_group
  │   │   └── team ────────── domain + pack_group
  │   └── department ──────── tenant
  └── division ────────────── tenant_group
```

| Organization Level   | Platform Mapping        | Governance Permission                           |
| ---------- | --------------- | ---------------------------------- |
| company    | platform config | Global policy, platform-level SLO, compliance master plan     |
| division   | tenant_group    | Division budget, cross-department workflow policy   |
| department | tenant          | Department budget, department SLO, domain management, approval chain |
| team       | domain/pack     | Domain configuration, Pack development, daily operation        |

`LegalEntityBoundary` exists independently of OrgNode tree, used to mark legal entity, country/region, and regulatory boundary. Cross legal entity or cross country data, approval, budget, knowledge sharing default to cross-tenant handling, must go through §50 controlled sharing, §52 cross-border compliance, and §47 approval routing.

## 46.3 Organization Change Auto Adaptation

| Organization Change Event | Platform Auto Response                                                      |
| ------------ | ----------------------------------------------------------------- |
| Employee onboarding     | SCIM sync → create principal → assign to team → inherit team permission         |
| Employee transfer     | Update reporting_chain → adjust tenant/domain permission → migrate approval delegation     |
| Employee offboarding     | SCIM deprovisioning → revoke all permissions → transfer domain_owner → audit record |
| Department merge     | Merge tenant → merge budget → recompute SLO → migrate Pack ownership            |
| Organization restructuring     | Rebuild reporting_chain → refresh approval route → notify affected domain_owner   |

Organization change must generate `OrgMergeConflictReport`, `ApprovalRerouteOnOrgChange`, or `OrphanAgentFreezePolicy` (as needed). Unmanaged owned Agent default freezes new run admission; in-flight approval reroutes but retains original approval evidence.

Employee offboarding, deactivation, or high-risk position change must trigger revoke sessions, reassign pending approvals, cancel secret leases, freeze delegated authority, and owned Agent admission freeze; after completion output `IdentityDeprovisioningReport`.

OrgTree cascade change must go through `OrgGovernanceSaga` execution: prepare stage freeze orgVersion, impact scope, budget/approval/knowledge boundary diff; commit stage update identity, approval route, budget owner, domain owner, and agent ownership in fixed order; compensate stage rollback incomplete sub-steps or freeze affected resources; audit stage output `OrgGovernanceSagaReceipt`. Department merge with domain policy conflict fixed using stricter wins; incomparable policy enters compliance approval, cannot auto merge.

---

# 47. Organizational Approval Routing

> Dynamic approval routing based on org-chart, replacing static approver list.
> Related: §21 HITL · §46 Organizational hierarchy · §10 Risk control

## 47.1 Dynamic Approval Routing Engine

Approval routing engine dynamically computes approval chain based on request context, replacing static approver list:

| Routing Factor | Description                                      |
| -------- | ----------------------------------------- |
| Risk level | risk_level(§10) the higher, the higher the approval level       |
| Cost threshold | Match approval quota matrix(§47.2) by §18 cost estimate  |
| Organization Level | Search up the OrgTree (§46) for the corresponding level approver |
| Delegation rule | Auto route to proxy when approver is absent (§47.3)   |

Engine supports multi-approver joint sign-off (parallel) and step-by-step approval (sequential) two modes. Each step has independent timeout, after timeout according to escalation_policy auto escalate to higher organization level. SoD (Separation of Duties) check is executed by policy engine, not limited to requester != approver, must also cover conflict of interest, same approval chain mutual approval, budget owner and execution owner conflict.

## 47.2 Approval Quota Matrix

| Risk Amount  | Auto | Manager | Director | VP  | CFO/CTO |
| --------- | ---- | ------- | -------- | --- | ------- |
| < ¥1,000  | ✓    |         |          |     |         |
| ¥1K-10K   |      | ✓       |          |     |         |
| ¥10K-100K |      |         | ✓        |     |         |
| ¥100K-1M  |      |         |          | ✓   |         |
| > ¥1M     |      |         |          |     | ✓       |

Multi-currency approval must be unified to `base_currency + FX snapshot` then compare threshold; approval record saves FX rate, rate source, and snapshot time.

## 47.3 Absence Auto Proxy

When approver is absent, system finds proxy by following priority:

1. Explicit delegated proxy (DelegationOfAuthority)
2. Up one level in org-chart (skip-level manager)
3. Same level same department peer (if configuration allows)
4. After timeout, execute ApprovalTimeoutPolicy(§21)

Peer delegate must pass ConflictOfInterestFilter. All approvals must have expiry, revocation, and commit-time revalidation; before SideEffect commit, must confirm approval still within validity period and scope matches.

When creating approval, must freeze `ApprovalRouteSnapshot`, containing org chart version, approver set, SoD/COI check result, base_currency + FX snapshot, route policy version, and evidence refs. Organization change only affects new approval or checkpoint revalidation, must not rewrite historical approval chain in place.

---

# 48. Enterprise SSO/SCIM Integration Architecture

> Integrate with enterprise identity provider, implement automatic user lifecycle management.
> Related: §6.5 Authentication · §11 Security · §46 Organizational hierarchy

## 48.1 Identity Integration Protocol

| Protocol         | Purpose                     | Priority |
| ------------ | ------------------------ | ------ |
| **OIDC**     | SSO login (already §6.5)    | Supported |
| **SAML 2.0** | SSO login (legacy enterprise IdP) | Required   |
| **SCIM 2.0** | User/group auto sync          | Required   |
| **HR API**   | Organization architecture sync (optional)     | Optional   |

## 48.2 SCIM Integration Model

Platform implements SCIM 2.0 Server endpoint, receiving user and group changes pushed by enterprise IdP:

| Endpoint      | Supported Operations                          | Description                                     |
| --------- | --------------------------------- | ---------------------------------------- |
| `/Users`  | GET / POST / PUT / PATCH / DELETE | User CRUD, maps to platform principal       |
| `/Groups` | GET / POST / PUT / PATCH / DELETE | Group CRUD, maps to OrgNode (§46)'s team |

SCIM sync auto maintains principal ↔ OrgNode association. When user is deactivated (deprovisioning), immediately revoke active sessions and pause their owned Agents, ensuring zero residual access. All sync operations record audit log, in conflict, IdP is the authority. IdP sync exception enters `identity_sync_dlq`, and generates SCIM conflict report.

`identity_sync_dlq` must have retry/backoff and periodic reconciliation: 429 follows Retry-After, 5xx uses exponential backoff, schema/conflict errors enter manual processing; daily reconciliation compares IdP group/user snapshot with platform principal/org mapping, finds drift and generates `IdentityReconciliationReport`. deprovisioning is security-critical path, DLQ must not block session revoke and secret lease cancel.

## 48.3 User Lifecycle Automation

```text
IdP event                    Platform response
─────────                   ────────
User Created ──────────▶ Create principal + assign role + join org_node + welcome guide
User Updated ──────────▶ Sync attributes + update reporting_chain + adjust permissions
User Deactivated ──────▶ Immediately revoke all active sessions + pause all owned Agents
User Deleted ──────────▶ Transfer domain_owner + archive audit record + trigger data_retention
Group Changed ─────────▶ Batch update role mapping + refresh approval routing(§47)
```

Session revocation SLO: Regular offboarding < 5min, security incident deactivation < 60s. shared/team agent must declare owner fallback; no fallback enters paused/frozen.

---

# 49. Department Compliance Policy Engine

> Enable different departments to execute different compliance frameworks (SOX + HIPAA + PCI-DSS + GDPR coexist).
> Related: §23 Compliance · §37.3 DomainRiskProfile · §46 Organizational hierarchy

## 49.1 Compliance Framework Registry

ComplianceFramework defines activatable compliance frameworks, supports multi-framework coexistence:

| Field                | Type                                             | Description                         |
| ------------------- | ------------------------------------------------ | ---------------------------- |
| `frameworkId`       | string (ULID)                                    | Globally unique identifier                 |
| `type`              | enum: GDPR / SOC2 / PIPL / HIPAA / SOX / PCI_DSS | Compliance framework type                 |
| `rules`             | ComplianceRule[]                                 | Specific control item list               |
| `auditRequirements` | AuditSpec[]                                      | Audit frequency, evidence type, retention period |
| `reportTemplate`    | string                                           | Compliance report template ID              |

Framework activated at tenant granularity——different departments in the same platform can execute different compliance combinations (§49.2 inheritance mechanism). Framework change requires platform_admin approval, after activation auto inject corresponding ConstraintPack constraints.

## 49.2 Compliance Policy Inheritance

```text
company:  [Base security policy] + [Data classification policy]
    │
    ├── finance_division:  Inherit + [SOX]
    │   ├── accounting_dept: Inherit + [SOX-404 enhanced]
    │   └── payment_dept:   Inherit + [PCI-DSS]
    │
    ├── healthcare_division: Inherit + [HIPAA]
    │
    └── eu_operations:      Inherit + [GDPR]
```

Rule: child node **inherits** parent node all compliance constraints, can **append** but cannot **relax**. Policy merge semantics fixed as: deny overrides allow; security/compliance dimension stricter wins; structural conflicts such as quota, organization structure, data boundary must enter ADR or compliance approval, cannot rely on "stricter" auto-guessing. Because strictness is not always totally ordered, each type of policy must provide `PolicyStrictnessComparator`; when incomparable, execute according to stricter path or require compliance approval.

## 49.3 Automatic Compliance Evidence Collection

| Compliance Control         | Evidence Source                   | Collection Method                 |
| ---------------- | -------------------------- | ------------------------ |
| SOX access review     | §11.2 RBAC + §28 audit log | Quarterly auto export access permission snapshot |
| SOX separation of duties     | §47 SodRouting             | Auto verify approval chain no violation     |
| HIPAA data encryption   | §23.5 Encryption architecture             | Continuous monitor encryption status         |
| PCI-DSS scope limit | §46 tenant isolation            | Auto verify CDE boundary        |
| GDPR deletion right      | §23.2 crypto-shredding     | Auto record deletion execution evidence     |

Compliance exception must go through `ComplianceExceptionWorkflow`, containing scope, expiresAt, approver, compensating controls, and auditRef. Compliance operation metrics include `EvidenceQualityScore` and `ControlCoverageReport`.

---

# 50. Knowledge Domain Isolation and Controlled Sharing

> Force isolation of different departments' knowledge assets, provide approval-style cross-domain sharing.
> Related: §29 Knowledge/Memory · §37.4 DomainKnowledgeSchema · §46 Organizational hierarchy · §11 Security

## 50.1 Knowledge Isolation Model

KnowledgeBoundary defines isolation boundary of knowledge assets, default reject cross-domain access:

| Field               | Type                      | Description                                         |
| ------------------ | ------------------------- | -------------------------------------------- |
| `boundaryId`       | string (ULID)             | Boundary unique identifier                                 |
| `ownerOrgNode`     | string                    | Owning organization node (§46), determines ownership                |
| `accessPolicy`     | enum: strict / controlled | strict = fully isolated, controlled = sharable after approval     |
| `allowedConsumers` | OrgNodeRef[]              | Authorized consumer list (only effective in controlled mode) |
| `auditOnAccess`    | boolean (default true)       | Whether each access writes to audit log                     |

All knowledge queries force verify boundary through KnowledgeFederator (§50.2) at execution time. Unauthorized cross-boundary request is not only rejected, but also does not expose target knowledge's existence.

## 50.2 Knowledge Federated Search

When Agent searches knowledge, KnowledgeFederator filters results by permission:

```text
Agent search request
    │
    ▼
┌────────────────┐
│ Knowledge      │
│ Federator      │
└───┬────────────┘
    │
    ├──▶ [Knowledge within boundary] → Direct return
    ├──▶ [controlled boundary knowledge] → Check CrossBoundaryRule → Return if authorized (may undergo transform)
    └──▶ [strict boundary knowledge] → Completely invisible (not even "existence" exposed)
```

## 50.3 Information Isolation Wall (Chinese Wall)

Financial services scenario requirements:

- M&A team's knowledge **completely invisible** to other departments
- Same person cannot simultaneously access knowledge of conflict-of-interest parties
- Once accessed Party A's knowledge, automatically prohibited from accessing Party B's knowledge (dynamic isolation wall)

Chinese Wall must have `WallExpiryPolicy` / reset process, avoiding user long-term use permission only tighten not recoverable. Release or expiry must go through compliance officer approval, cooling period, full audit, and data residue scan; audit/debug needs satisfied by `ComplianceOfficerAuditView`, not expose knowledge existence to ordinary callers. controlled sharing must do desensitization, summary, and field-level filtering through `CrossBoundaryTransform`.

Chinese Wall grant/release must use two-phase commit: prepare first locks subject, conflict set, knowledge boundary, and expiry; commit simultaneously writes boundary state and audit event; when failing, keep original isolation wall unchanged and generate reconciliation task. release must not first delete restriction then add audit; when audit write fails, release fails.

---

# 51. Tiered Governance Delegation

> Enable department administrators to self-govern within guardrails set by platform team, platform team is no longer bottleneck of all governance changes.
> Related: §24 Configuration governance · §37.9 DomainGovernancePolicy · §46 Organizational hierarchy

## 51.1 Governance Permission Layering

GovernancePermission defines each organization level's governance operation permission:

| Field           | Type                                       | Description                          |
| -------------- | ------------------------------------------ | ----------------------------- |
| `permissionId` | string (ULID)                              | Permission unique identifier                  |
| `scope`        | { orgNode: string, resourceType: string }  | Effect scope: organization node + resource type |
| `level`        | enum: view / operate / admin / super_admin | Permission level, increasing step by step            |
| `delegatable`  | boolean                                    | Whether allow delegation downward              |
| `expiresAt`    | ISO8601 \| null                            | Expiration time, null means permanent       |

Permission follows least privilege principle: view only views; operate can execute daily operations; admin can modify domain-level policies; super_admin can modify global guardrails. Delegated permission cannot exceed delegator's own level.

RuntimeInvariant cannot be overridden by any admin, including super_admin. super_admin can only submit policy proposal; temporary exception to not downgrade invariant must go through break-glass, dual control, post-review, and auto recovery window, not allowed to directly close. Governance delegation must declare DelegationScope, DelegationExpiry, revocation policy, and PolicyComparator; after expiry or revocation, all derived permissions immediately lose effect.

Delegation revocation must have bounded propagation SLO: regular governance permission < 5min, high-risk or security event < 60s. Revocation cascades to derived delegation, pending approval, active session, secret lease, worker lease, and scheduled trigger through `GovernanceDelegationRevocationSaga`; unconfirmable downstream resources enter frozen/quarantined, cannot continue executing.

## 51.2 Governance Inheritance and Override Rules

```text
platform_team sets global guardrails
    │
    ▼ Inherit (cannot relax)
division_admin sets division policy
    │
    ▼ Inherit (cannot relax) + can append
department_admin sets department policy
    │
    ▼ Inherit (cannot relax) + can append
team_lead daily operation configuration
```

| Operation                      | Superior can            | Subordinate can            |
| ------------------------- | ----------------- | ----------------- |
| Tighten policy (lower max_risk) | ✓                 | ✓                 |
| Relax policy (raise max_risk) | ✓                 | ✗                 |
| Append constraint                  | ✓                 | ✓                 |
| Delete superior constraint              | ✓ (own set)     | ✗                 |
| Allocate budget                  | ✓ (within own quota) | ✓ (within own quota) |

## 51.3 Self-Governance Operation Console

| Function                   | Department Administrator Available      | Platform Team Available |
| ---------------------- | ------------------- | ------------ |
| Domain Onboarding Wizard(§44.2)      | ✓ (low/medium risk domain)    | ✓ (all domains)  |
| Modify approval rules           | ✓ (within quota upper limit)   | ✓ (unlimited)  |
| Release Pack              | ✓ (after auto security scan) | ✓            |
| Adjust Agent Autonomy(§42) | ✓ (not exceeding domain upper limit)   | ✓            |
| Create Trigger(§41)        | ✓ (low/medium risk)      | ✓            |
| Modify global guardrails           | ✗                   | ✓            |
| Cross-department policy             | ✗                   | ✓            |

---

# Part VIII — Scaled Runtime Layer and Ecosystem Layer (§52-§57)

---

# 52. Multi-Region Deployment Architecture

> Support global enterprise cross-Region compliance operation, data sovereignty, traffic routing, fault isolation.
> Related: §31 Disaster recovery · §32 Deployment · §23 Compliance · §46 Organizational hierarchy

## 52.1 Region Model

| Field                | Type                        | Description                                               |
| ------------------- | --------------------------- | -------------------------------------------------- |
| regionId            | string                      | Globally unique, e.g., `cn-east-1`, `eu-west-1`              |
| provider            | AWS / GCP / Azure / private | Underlying infrastructure provider                                 |
| status              | active / standby / draining | active is primary; standby preheated waiting for switch; draining migrating out |
| endpoints           | `{ api, ws, internal }[]`   | Each plane entry address                                     |
| dataResidencyPolicy | string                      | Allowed residence data jurisdiction, e.g., `EU-only`, `CN-only`        |

Multi-Region deployment requires each Region to reach at least §31 HA-3 level (multi-AZ deployment), but v4.2 does not promise multi-master truth writes. Each tenant / partition at the same time can only have one write leader, other Regions provide follower read, async replication, and controlled failover.

## 52.2 Region-Aware Architecture

```text
                    ┌──────────────────────┐
                    │  Global Control Plane │ (metadata-only federation)
                    │  Region routing · policy sync │
                    └──────────┬───────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │ CN Region     │ │ EU Region     │ │ US Region     │
    │ ┌───────────┐ │ │ ┌───────────┐ │ │ ┌───────────┐ │
    │ │ P1-P5     │ │ │ │ P1-P5     │ │ │ │ P1-P5     │ │
    │ │ Complete five planes │ │ │ Complete five planes │ │ │ Complete five planes │ │
    │ └───────────┘ │ │ └───────────┘ │ │ └───────────┘ │
    │ Data residence: CN  │ │ Data residence: EU  │ │ Data residence: US  │
    │ Compliance: PIPL    │ │ Compliance: GDPR    │ │ Compliance: SOX     │
    └───────────────┘ └───────────────┘ └───────────────┘
```

## 52.3 Cross-Region Workflow Routing

| Scenario                                | Routing Strategy                        | Data Processing                     |
| ----------------------------------- | ------------------------------- | ---------------------------- |
| User in EU, task only involves EU data       | Region affinity, stay in EU            | Local processing                     |
| User in CN, needs to call US LLM       | CN executes, LLM request routes to US      | Input scan + output scan both confirm no PII/regulated data allows cross-border |
| Cross-Region collaboration (EU market + US engineering) | Each Region executes, metadata sync | Only exchange anonymized/aggregated data        |
| Region failure failover                | Manual/semi-auto switch to backup Region    | Metadata pre-replication, business data not cross-border |

Write boundary:

- CAS, Lease, Fencing, Budget Ledger, SideEffect Commit, and HarnessRun truth update only allowed to execute within partition leader.
- follower Region can only read projection, submit pending routing request, or take over new leader epoch after failover.
- failover must promote fencing epoch; after old leader recovers, can only join as follower, unconfirmed replicated writes enter reconciliation.
- CRDT / multi-master only usable for non-critical statistics, cache, or aggregated telemetry, must not carry truth, budget, or side effect commit.
- Global Control Plane only saves metadata, routing policy, region health, and home-region mapping; must not save business payload, PII, PHI, secret, or tenant truth. Each tenant/partition must declare home region and failover tier. metadata must have quorum/backup, home-region mapping restore process, and routing policy version lock; after failover routing must not read unlocked policy.

## 52.4 Cross-Border Data Transfer Compliance

| Jurisdiction       | Compliance Framework                                             | Platform Mechanism                                                                                                  |
| ---------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| EU → Non-EU  | GDPR Chapter V — SCCs (Standard Contractual Clauses) | Cross-Region LLM call auto attach SCC data processing agreement reference; pre-transfer DPIA (Data Protection Impact Assessment) auto assessment |
| EU → US    | EU-US Data Privacy Framework                         | Verify whether provider is in DPF list; if not listed fall back to SCC                                                         |
| CN → Overseas  | PIPL Article 38 — Security assessment / Standard contract                  | Pre-cross-border auto trigger data volume assessment; over-threshold needs security assessment record                                                            |
| Intra-group Cross-Border | BCRs (Binding Corporate Rules)                       | Enterprise-level BCR template, platform auto reference BCR number in cross-border transfer and record                                                  |

**Cross-Border Transfer Control Chain**:

```text
Cross-Region data request
    │
    ▼
┌──────────────────┐
│ Jurisdiction      │  Identify source/target jurisdiction
│ Classifier        │
├──────────────────┤
│ Transfer Impact   │  Auto DPIA score; high impact → manual approval
│ Assessor          │
├──────────────────┤
│ Mechanism         │  Select compliance mechanism: SCC / BCR / DPF / Security assessment
│ Selector          │
├──────────────────┤
│ Data Minimizer    │  Only transfer necessary fields; PII desensitization/pseudonymization
├──────────────────┤
│ Output Scanner    │  Scan LLM/tool output for PII/regulated data; if hit, block cross-border return and generate incident
├──────────────────┤
│ Transfer Logger   │  Complete record transfer log (source, target, legal basis, data volume, time)
└──────────────────┘
```

---

# 53. Scaled Resource Contention Management

> Fair scheduling, priority preemption, capacity guarantee under 5000+ concurrent workflow scenario.
> Related: §8 Scalability · §9 Stability · §14 Runtime · §46 Organizational hierarchy · §54 SLA

## 53.1 Scheduling Hierarchy

```text
┌─────────────────────────────────┐
│  Admission Controller           │  Global admission control
│  (Reject requests exceeding platform capacity)         │
├─────────────────────────────────┤
│  Quota Manager                  │  Department-level quota management
│  (Guarantee/limit each department's resource share)     │
├─────────────────────────────────┤
│  Priority Scheduler             │  Priority scheduling
│  (SLA-aware + preemption)              │
├─────────────────────────────────┤
│  Worker Pool                    │  Execution layer
└─────────────────────────────────┘
```

## 53.2 Resource Quota Model

| Field           | Type                                  | Description                                       |
| -------------- | ------------------------------------- | ------------------------------------------ |
| quotaId        | string                                | Quota unique identifier                               |
| tenantId       | string                                | Owning department/tenant                              |
| resourceVector | `MultiResourceQuotaVector`            | worker, tool QPS, model TPM/RPM, budget, approval capacity combination vector |
| limit          | `Map<ResourceKind, number>`           | Each resource upper limit value                               |
| used           | `Map<ResourceKind, number>`           | Current used (real-time update)                     |
| reserved       | `Map<ResourceKind, number>`           | Reserved but not settled resources                       |
| period         | hourly / daily / monthly              | Quota period, auto reset used at period end            |
| overflowPolicy | queue / reject / burst                | Over-quota strategy: queue wait, direct reject, allow short burst |

`ResourceKind` at least includes: `worker_concurrency`, `tool_qps`, `model_tpm`, `model_rpm`, `budget_amount`, `approval_capacity`, `storage_io`. Admission Controller only allows entering queue when entire `resourceVector` is satisfiable, avoiding any dimension of token, approval seat, or budget being implicitly burst. `approval_capacity` must also reserve/release; when high-risk run has no approval capacity, must admission deny or queue, cannot execute first then wait for human.

## 53.3 Priority Preemption

| Priority          | Scenario              | Preemption Strategy              | Startup SLA |
| --------------- | ----------------- | --------------------- | -------- |
| critical(1000)  | Online incident fix      | Can preempt all non critical | < 10s    |
| high(800)       | E-commerce order processing      | Can preempt standard and below  | < 30s    |
| standard(500)   | Daily business workflow | Does not preempt                | < 5min   |
| background(200) | Batch analysis / report   | Does not preempt, runs when idle    | Best effort     |
| best_effort(0)  | Experimental task        | Does not preempt, can be preempted at any time  | No guarantee   |

## 53.4 Fair Scheduling

- **Weighted Fair Queuing**: Each department gets weight according to guaranteed quota
- **Borrowing**: When department does not use up guaranteed quota, idle resources can be burst-used by other departments
- **Reclaim**: When original department needs, borrowed resources are returned after current step completes (graceful reclaim)
- **Weighted Aging**: Queue time calculated by `effective_priority = base_priority * sla_weight + aging_factor`, aging only promotes scheduling order, not change SLA Tier or risk level
- **Promotion Budget**: Each tenant has independent `promotion_budget` per day/hour, queue upgrade consumes this budget; after budget exhausted, only alert and expansion suggestion, prevent all tasks from being upgraded to high under high load
- **Checkpoint-before-preempt**: Before preempting any durable run, must complete checkpoint, and record `preempted_by`, `checkpoint_ref`, `resume_policy`; non-checkpointable side effect window prohibits preemption, can only rate limit or drain
- **Starvation Prevention**: After standard task queue exceeds threshold, enter weighted aging, cannot directly upgrade to high without quota

---

# 54. SLA Tiered Assurance

> Provide differentiated SLA assurance for different business importance, including resource reservation and breach response.
> Related: §27 SLO · §37.9 DomainGovernancePolicy · §53 Resource contention

## 54.1 SLA Tier Model

| Field           | Type                                    | Description                                    |
| -------------- | --------------------------------------- | --------------------------------------- |
| tierId         | string                                  | Tier unique identifier                           |
| name           | platinum / gold / silver / bronze       | Tier name, corresponding to §54.2 matrix            |
| availability   | number (%)                              | Committed availability; manual/semi-auto failover default maximum 99.95% |
| externalP95Latency | number (ms)                         | User-visible P95 latency upper limit                   |
| internalP99Latency | number (ms)                         | Platform internal P99 latency upper limit                   |
| approvalLatencySlo | duration                            | Approval wait target                            |
| incidentResponseSlo | duration                           | Incident response target                       |
| priorityWeight | number (1-100)                          | Scheduling priority weight, Platinum=100, Bronze=10 |
| costMultiplier | number                                  | Resource cost coefficient relative to Bronze              |
| supportLevel   | 24x7_dedicated / 24x7 / 8x5 / community | Corresponding support level                            |

## 54.2 SLA Tier Matrix

| Tier         | Availability | E2E P95 Latency | Internal P99 Latency | Queue Upper Limit | Recovery Priority | Applicable Scenario           |
| ------------ | ------ | ------------ | ----------------- | -------- | -------- | ------------------ |
| **Platinum** | 99.95% | < 2s         | < 500ms           | < 5s     | Highest     | Online transaction, real-time risk control |
| **Gold**     | 99.9%  | < 5s         | < 1s              | < 30s    | High       | Core business workflow  |
| **Silver**   | 99.5%  | < 15s        | < 2s              | < 5min   | Medium       | Daily operation           |
| **Bronze**   | best effort | < 60s   | < 5s              | < 30min  | Low       | Internal tool, experiment     |

99.99% only allowed in dedicated deployment tier that passes auto failover, quorum write, hot spare capacity, and cross-Region drill, not as v4.2 default SLA Tier.

SLA must be split by workflow class: deterministic can commit low second level; LLM-assisted only commits platform internal scheduling/queue SLO, model latency counted separately; HITL-waiting does not count human wait as platform failure, but must commit notification, reminder, and escalation time limit.

## 54.3 SLA-Aware Scheduling

Dispatcher(§14.2) considers SLA Tier when scheduling:

1. **Queue check**: When workflow queue time approaches `max_queue_time`, auto upgrade priority
2. **Latency prediction**: Based on historical data predict whether workflow will violate SLA, pre-scale or preempt
3. **Resource reservation**: Platinum/Gold tier `resource_reservation` always reserved for them, cannot be burst-occupied
4. **Breach response**: When SLA violated, auto execute according to `ViolationResponse` (alert/scale/preempt/escalate)

---

# 55. Agent Marketplace and Ecosystem

> MVP only builds internal Pack Registry; external Marketplace, commercial distribution, and revenue settlement are Enterprise/Future capabilities.
> Related: §30 Business Pack · §37.7 DomainRecipe · §22 SDK/DX

## 55.1 Registry / Marketplace Layering

```text
┌───────────────────────────────────────────┐
│  Internal Pack Registry [MVP]             │
│  ├── Pack Store      (Business domain Pack)        │
│  ├── Connector Store (Internal connector)          │
│  ├── Template Store  (Workflow template)       │
│  └── Eval Store      (Evaluation dataset)          │
├───────────────────────────────────────────┤
│  Quality & Security Gate [MVP]            │
│  Auto scan · SBOM · signing · compatibility test · sandbox verification │
├───────────────────────────────────────────┤
│  External Marketplace [Enterprise/Future] │
│  Third-party release · rating · commercial terms · recommendation       │
└───────────────────────────────────────────┘
```

MVP prohibits treating external third-party Pack as default installation source. Third-party Pack/Plugin/Connector before entering any production tenant, must pass §11 security baseline: SBOM, artifact signing, provenance, sandbox certification, egress policy, secret access review, and least privilege Capability Profile.

## 55.2 Market Entry Model

| Field                | Type                               | Description                            |
| ------------------- | ---------------------------------- | ------------------------------- |
| entryId             | string                             | Entry unique identifier                    |
| packId              | string                             | Associated Pack/Plugin/Connector ID |
| publisher           | string                             | Publisher (organization or individual)            |
| version             | semver                             | Current published version                    |
| pricing             | free / enterprise_included / paid  | Pricing model, see §55.4 for details            |
| rating              | number (0-5)                       | User overall rating                    |
| installCount        | number                             | Cumulative install count                      |
| certificationStatus | uncertified / verified / certified | Platform certification status                    |
| dependencies        | `{ item_id, version_range }[]`     | Dependency list, see §55.6 for details          |

## 55.3 Installation and Governance

| Publisher Type           | Installation Approval              | Security Requirement                | Update Strategy   |
| -------------------- | --------------------- | ----------------------- | ---------- |
| platform_official    | Auto install              | Platform team has reviewed          | Auto update   |
| enterprise_internal  | Department administrator approval        | Auto security scan            | Auto after notification |
| verified_third_party | Department administrator + security team | Auto scan + manual review     | Manual confirmation   |
| community            | Platform team approval          | Complete security review + sandbox test | Manual confirmation   |

## 55.4 Commercial Terms Boundary

Revenue sharing, billing settlement, credit points, and external commercial rules do not belong to core runtime architecture, must not affect Pack installation, execution, permission, or security decision. Enterprise/Future Marketplace can define `CommercialTerms` in independent commercial specification, but core platform only consumes certification status, version, dependency, permission, and security metadata.

## 55.5 Entry Deprecation Lifecycle

| Phase       | Trigger Condition                                                 | Platform Action                                                         |
| ---------- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| active     | Normal operation                                                 | —                                                                |
| deprecated | publisher marks deprecated or 90 days no maintenance update + known security vulnerability | Install page shows deprecation warning; new install needs confirmation; recommend alternative                   |
| sunset     | 180 days after deprecated                                     | Block new install; installed send migration notice (30-day countdown)                    |
| removed    | sunset countdown ends + migration threshold met                         | Remove from Registry; installed instance freeze (no new task execution), data retained 90 days |

Before entering `removed`, must satisfy `migration_threshold`: no critical business Agent still depends on this entry; migrated install count ≥ 95%; remaining install all have explicit risk acceptance record; security vulnerability scenario can emergency freeze execution, but must retain read-only data and migration export capability.

## 55.6 Dependency Management

- Each MarketplaceItem declares `dependencies: { item_id: string; version_range: string }[]`
- Auto resolve dependency tree when installing, detect version conflict (similar to npm/cargo resolution)
- When uninstalling, check reverse dependency, if other items depend, block uninstall and prompt
- When dependency is deprecated, auto notify all dependent party publisher and installing user
- Marketplace must maintain dependency graph, security advisory, forced patch, quarantine, and tenant impact report. critical advisory can force freeze or patch upgrade, but must retain read-only export, rollback instructions, and tenant impact list.

---

# 56. Feedback-Driven Continuous Improvement Pipeline

> Materialize the §13 Learn/Improve black-box interface into a runnable auto improvement pipeline.
> Related: §13 OAPEFLIR L-I-R · §17 Model evaluation · §37.5 DomainEvalFramework · §42 Progressive autonomy

## 56.1 Improvement Pipeline Overview

```text
Production execution data
    │
    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Signal       │────▶│ Analysis     │────▶│ Improvement  │
│ Collector    │     │ Engine       │     │ Generator    │
│ (Signal collection)  │     │ (Pattern analysis)  │     │ (Improvement generation)    │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                           ┌──────▼───────┐
                                           │ Quality Gate │
                                           │ (Quality gate)    │──▶ §17 Eval
                                           └──────┬───────┘
                                                  │ Pass
                                           ┌──────▼───────┐
                                           │ Gradual      │
                                           │ Rollout      │──▶ §16 Prompt graying-out
                                           └──────────────┘
```

## 56.2 Signal Collection

**Design Decision: 3D FeedbackSignal Structure vs Flat Enumeration**

The `FeedbackSignalType` in the above architecture document uses a flat 9-type enumeration. The actual implementation (`src/platform/five-plane-orchestration/oapeflir/types/feedback-signal.ts`) adopts 3D orthogonal structure:

**Why use 3D instead of flat 9-type enumeration**:

| Design Consideration | Flat Enumeration                   | 3D Orthogonal Structure                            |
| -------- | -------------------------- | -------------------------------------- |
| Combinability | 9 fixed combinations               | 5×5×4=100 potential combinations                   |
| Extensibility   | New type needs to modify enumeration           | Independently extend any dimension                       |
| Filter query | Need N OR conditions          | Can independently filter by source/category/severity  |
| Empty combination | May have meaningless "legal" combinations | Business logic decides which combinations are valid               |

This design enables FeedbackSignal to express more fine-grained feedback, while maintaining orthogonality between dimensions, facilitating analysis and routing. The flat enumeration in the architecture document is used for conceptual illustration, the actual implementation follows the 3D structure.

Each FeedbackSignal must be accompanied by `FeedbackTrustScore`: source credibility, historical accuracy, whether authenticated, whether from same attack surface, whether overlap with holdout/eval data. Low-trust feedback can enter analysis queue, but must not directly generate launch candidate.

Training sample selection simultaneously calculates `CandidateDataQualityScore`, `CandidateDiversityScore`, `ContaminationScanResult`, and `HoldoutCheckResult`, covering tenant, domain, language, task difficulty, failure type, and risk level, avoiding only learning from most active users or single failure mode. Any candidate that hits PII, secret, restricted data, holdout contamination, or eval leakage, must enter quarantine and block release.

Feedback Analysis must include collective anomaly detection: when feedback within same tenant, same organization, same external source, or same time window is highly homogeneous and pushes same policy relaxation, candidate enters `bias_suspected` / quarantined, by manual review. Low-trust feedback must not affect holdout, risk threshold, or autonomy promotion.

## 56.3 Automatic Improvement Types

| Improvement Type          | Trigger Condition                         | Automation Degree                       | Output                                   |
| ----------------- | -------------------------------- | -------------------------------- | -------------------------------------- |
| **Few-shot harvesting** | User approval accumulation > 10       | Fully automatic                           | Add few-shot example to PromptLibrary |
| **Prompt tuning**   | Same type user_correction > 5      | Semi-automatic (generate candidate → manual review)      | Prompt modification suggestion                        |
| **Model route optimization**  | cost_anomaly or latency_anomaly  | Fully automatic                           | ModelGateway route rule update              |
| **Risk control rule adjustment**  | Consecutive false positive approval > 10 times | Semi-automatic (suggestion → domain_owner confirmation) | Risk threshold adjustment suggestion                       |
| **Knowledge base update**    | quality_drift + knowledge source expired       | Fully automatic                           | Trigger knowledge source refresh                         |
| **Autonomy adjustment**    | Cumulative performance data meets promotion condition         | Per §42 rules                      | Autonomy promotion/demotion                        |

Model route optimization must use `DataResidencyConstrainedOptimization`: candidate provider, region, cache, fallback, and training/log usage all first pass data residency, customer contract, model independence, and compliance policy filtering, then calculate cost or latency benefit. Optimization suggestion must not bypass §15 ModelGateway, §17 EvaluationGate, or §23 data governance.

## 56.4 Improvement Candidate State Machine

```text
collected → analyzed → candidate_generated → quarantined
                                  │
                                  ▼
                             eval_pending → eval_passed → approval_pending → rollout_canary → released → rollback_pending → rolled_back
                                  │              │                 │
                                  ▼              ▼                 ▼
                              rejected      rejected          rejected
```

`ImprovementCandidateStateMachine` shares the same release gate with §16 Prompt Rollout, §17 EvaluationGate, §34 ADR, and §42 autonomy promotion. Any candidate before launch must lock input sample, evaluation version, policy version, Prompt/Model/Tool/Domain version, and approval responsible person.

released is not an irreversible terminal state. Any candidate after release must retain rollback target, release evidence, impact window, and automatic rollback metrics; when quality, cost, security, human upgrade rate, or complaint metric triggers threshold, enter `rollback_pending`, after rollback completes enter `rolled_back` and generate postmortem. rollback must not delete original released event, only append compensation facts.

## 56.5 Safety Guardrails

- Automatic improvement **can never** relax security policy or compliance control
- Fully automatic improvement only limited to **non-risk changes** (few-shot addition, route optimization, knowledge refresh)
- Changes involving Prompt core logic or risk control rules must pass manual review
- All automatic improvements record to event_log, auditable and rollback-able

---

# 57. External System Integration Framework

> Provide standardized connector framework and pre-built connector catalog, enable Agent to connect to real business systems.
> Related: §14.4 Executor · §11.5 Egress control · §37.4 KnowledgeSource · §55 Marketplace

## 57.1 Connector Abstraction

| Interface Method                  | Description                                           |
| ------------------------- | ---------------------------------------------- |
| `connect(config)`         | Establish connection, pass credential and endpoint configuration                   |
| `execute(action, params)` | Execute specified operation (CRUD/query/call), return standardized result |
| `healthCheck()`           | Active probe detection, return connection state and latency                   |
| `disconnect()`            | Gracefully close connection, release resources                         |

Supported protocols: REST / gRPC / MCP / Database (JDBC/ODBC) / File (S3/NFS) / Browser (Headless). Each connector comes with `ConnectorManifest`, declaring supported action list, authentication method, rate limit, and required permission, for Toolbelt(§14.4) dynamic discovery.

`ConnectorManifest` must contain `ConnectorCapabilityProfile`:

| Field | Description |
| --- | --- |
| actionRiskProfiles | `ActionRiskProfile[]`, each action's read/write/delete/payment/egress/irreversible risk, approval requirement, and SideEffect semantics |
| permissionProbes | `PermissionProbe[]`, verify identity, scope, object-level permission, tenant boundary, and least privilege still valid |
| quotaProbes | Verify external API quota, rate limit, concurrency, and provider circuit breaker state |
| businessCapabilityProbes | Verify key business capabilities available, e.g., order writable, refund switch, approval callback, schema version |
| credentialRotationPolicy | `CredentialRotationPolicy`, aligned with §11 Secret Lease's rotation cycle, dual-write window, failure detection, and auto revocation rules |

`healthCheck()` must not only return network connectivity; must cover permission, quota, and business capability. Any connector with missing action-level profile must not be assembled to production task by ToolbeltAssembler.

Each write action must declare idempotency key semantics, external status query, compensation availability, and reconciliation timeout. Action that cannot query external state and has no compensation path defaults to risk ≥ high, and force HITL.

## 57.2 Connector Risk Layering

| Connector Type | Risk Focus | Default Limit |
| --- | --- | --- |
| HTTP/REST/gRPC | Egress, authentication scope, idempotency | Must declare idempotency, retry, and response schema |
| Database | Large-scale read/write, schema drift, transaction boundary | Default read-only; write needs action-level approval and row/table scope |
| Browser | Visual misjudgment, session hijacking, unpredictable DOM | Isolated session, screen recording audit, prohibit default credential save |
| MCP | Tool capability dynamic exposure, remote trust boundary | Must fix server identity, capability allowlist, and signing manifest |
| File/S3/NFS | Data exfiltration, path traversal, batch delete | Force content scan, path allowlist, delete threshold approval |

## 57.3 Connector Lifecycle

```text
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Install  │────▶│ Configure│────▶│ Authorize│────▶│ Active   │
│ (Install)    │     │ (Configure)    │     │ (Authorize)    │     │ (Active)  │
└──────────┘     └──────────┘     └──────────┘     └────┬─────┘
                                                        │
                                                 ┌──────▼─────┐
                                                 │ Monitor    │
                                                 │ (Health monitor)  │
                                                 └──────┬─────┘
                                                        │ Exception
                                                 ┌──────▼─────┐
                                                 │ Degrade/   │
                                                 │ Reconnect  │
                                                 └────────────┘
```

## 57.4 Pre-Built Connector Catalog (Phase 1)

| Category   | Connector           | Priority | Capability                         |
| ------ | ---------------- | ------ | ---------------------------- |
| Communication   | Feishu/WeChat Work/DingTalk   | P0     | Message sending, approval push, calendar reading |
| Communication   | Email (SMTP/IMAP)  | P0     | Send, receive, search             |
| Storage   | Alibaba Cloud OSS / S3  | P0     | Upload, download, list             |
| Development   | GitHub/GitLab    | P0     | PR, Issue, code search          |
| Database | MySQL/PostgreSQL | P0     | Query, write                   |
| Social   | WeChat Official Account       | P1     | Message push, menu management           |
| E-commerce   | Youzan             | P1     | Order query, product management           |
| Finance   | Yonyou             | P1     | Voucher query, report export           |
| Analytics   | Sensors Data             | P1     | Event query, user portrait           |
| Payment   | Alipay/WeChat Pay  | P2     | Order, refund, query             |

## 57.5 Connector SDK

Community and enterprise internal teams can develop custom connectors through Connector SDK, publish to Marketplace(§55).

---

# Part IX — Operational Maturity Layer (§59-§69)

---

# 59. Agent Explainability and Decision Transparency Architecture

> Build user-facing causal explanation capability for each Agent decision, satisfy EU AI Act / GDPR Article 22 compliance requirements, and provide trust foundation for progressive autonomy(§42).
> Related: §12.7 Tracing · §13 OAPEFLIR · §17 Quality gate · §23.6 Data lineage · §39 NL entry · §42 Progressive autonomy

## 59.1 Design Principles

- Each OAPEFLIR loop's each stage **must** generate `DecisionRationale` / `StageRationale` record **at decision time**, not allowed to let LLM guess reason after the fact
- Explanation generated on demand (lazy), does not increase normal execution path overhead
- Explanation depth by domain configuration: finance needs forensic-level, customer service needs summary-level
- Explanation cache avoids repeated LLM call
- Explanation immutable, incorporated into Evidence Plane
- Explanation must be permission-aware: same run for different viewers can return different evidence visibility set, but must not change underlying immutable rationale
- Explanation must distinguish recorded facts, model rationale, and inferred summary. UI must not treat LLM post-rendered reason as recorded fact; all inferred summary must display evidence_refs and confidence.

## 59.2 Explanation Pipeline

```text
User asks "why?"
    │
    ▼
ExplanationRequest { harnessRunId, harnessStepId?, depth }
    │
    ▼
┌─────────────────┐
│ EvidenceCollector│  ← From P5 collect frozen-at-decision-time Rationale + ToolCallLog + KnowledgeCitation
└────────┬────────┘
         ▼
┌─────────────────┐
│ CausalChainBuilder│  ← Build causal chain of Observe→Assess→Plan→Execute
└────────┬────────┘
         ▼
┌─────────────────┐
│ ExplanationRenderer│  ← Render as NL text by depth and locale
└────────┬────────┘
         ▼
ExplanationResponse { summary, causal_chain[], evidence_refs[], confidence }
```

## 59.3 StageRationale Data Model

| Field                | Type            | Description                                                    |
| ------------------- | --------------- | ------------------------------------------------------- |
| rationaleId         | string          | Unique identifier                                                |
| stageId             | string          | Associated OAPEFLIR stage ID                                 |
| decision            | string          | Decision made at this stage (e.g., tool selected, plan generated)            |
| reason              | string          | Structured description of decision reason                                    |
| alternatives        | `Alternative[]` | Discarded alternatives and discard reasons                              |
| confidence          | number (0-1)    | Decision confidence                                              |
| evidenceRefs        | `string[]`      | Evidence references supporting decision (ToolCallLog, KnowledgeCitation, etc.) |
| decisionInputRef    | string          | Frozen DecisionInputBundle reference at decision time                   |
| versionLockRef      | string          | Prompt/Policy/PlanGraph/Tool/Model/Domain version lock reference    |
| visibilityLabels    | `string[]`      | Permission filter label, explanation render filter by user permission                  |
| renderedExplanation | string (lazy)   | User-facing natural language explanation, on-demand render and cache                  |

## 59.4 Explanation Depth Tiering

| Depth         | Applicable Scenario                 | Content                                                  |
| ------------ | ------------------------ | ----------------------------------------------------- |
| L1 Summary   | Non-technical user daily viewing       | One-sentence summary: "Because detected abnormal traffic, auto-scaled 2 instances" |
| L2 Reasoning | Business owner review           | Causal chain + key data points + alternatives                        |
| L3 Forensic  | Compliance audit / Incident investigation | Complete evidence chain + all input output + knowledge reference + model call detail   |

## 59.5 Integration with NL Entry

§39 NL interaction pipeline adds `why` Intent type:

User can ask in natural language "why was the last release rolled back?", system parses as WhyQuery and calls explanation pipeline.

## 59.6 Explanation Cache and Security

- L1/L2 explanation cache TTL = 24h, L3 not cached (ensure latest evidence)
- Explanation content constrained by §50 knowledge domain isolation——can only see evidence with own permission
- Explanation log itself incorporated into audit(§23), recording who viewed what explanation when
- L3 forensic explanation must first pass `forensic_explanation_budget` reservation, when over budget return evidence index and segmented generation plan, must not squeeze P4 execution budget during incident
- Explanation renderer can only work based on `versionLockRef` corresponding Prompt/Policy/PlanGraph version; post-run policy change cannot rewrite historical explanation, can only append new version explanation view

---

# 60. Emergency Brake and Global Circuit Breaker Architecture

> Provide single atomic operation to quickly block entry and make execution surface silent, for emergency scenarios like security incident, Prompt injection attack, Agent escape.
> Related: §9 Stability · §10 Risk control · §11 Security · §12 Exception event · §52 Multi-Region

## 60.1 PlatformPanicDirective

| Field              | Type                     | Description                                               |
| ----------------- | ------------------------ | -------------------------------------------------- |
| directiveId       | string                   | Directive unique identifier                                       |
| severity          | full / partial           | full = whole platform stop; partial = limited scope stop          |
| scope             | global / tenant / domain | Circuit breaker effective scope                                       |
| reason            | string                   | Trigger reason (security incident description)                           |
| issuedBy          | string                   | Initiator identity                                         |
| requiredApprovers | string[] (min 2)         | Dual approval requirement, prevent single point misoperation                       |
| reconfirmationAfterSeconds | number          | After expiry trigger reconfirmation reminder, not auto release circuit breaker             |
| rollbackStrategy  | freeze / graceful_drain  | freeze immediate freeze; graceful_drain wait for in-progress step to complete |

Platform Panic default indefinite effective. `reconfirmationAfterSeconds` only triggers reconfirmation, escalation reminder, and evidence snapshot refresh, must not auto release circuit breaker; recovery must go through §60.3 `PlatformResumeDirective` and satisfy dual approval.

## 60.2 Circuit Breaker Propagation Mechanism

```text
PlatformPanicDirective
    │
    ├──▶ P1 Interface Plane: Reject all new requests(503), close WebSocket
    │
    ├──▶ P2 Control Plane: Revoke all active Agent tokens
    │
    ├──▶ P3 Orchestration Plane: Suspend all in-flight HarnessRuns and OAPEFLIR projection updates
    │
    ├──▶ P4 Execution Plane: Halt new side effect, reconciliation for ambiguous side effect, support compensation when possible
    │
    ├──▶ P5 State Plane: Generate ForensicSnapshot, set read-only mode
    │
    └──▶ X1 Fabric: Block all egress, trigger alert to all channels
```

**SLA**: Split into two metrics: `ingress_block_time < 5s` (same Region) / `<15s` (cross-Region); `execution_quiescence_time` defined by deployment form, D1 < 10s, D2 < 30s, D3/S4 < 120s. Must not mix entry block and all worker stopped as one metric.

Each plane must return `PanicAcknowledgment`:

| Field | Description |
| --- | --- |
| directiveId | Corresponding PlatformPanicDirective |
| plane | P1 / P2 / P3 / P4 / P5 / X1 |
| status | ack / failed / timeout |
| localStopState | This plane's actual stop scope and incomplete items |
| timestamp | Acknowledgment time |
| evidenceRef | Local forensic snapshot or log reference |

If any plane failed / timeout, must generate `panic_incomplete` P0 incident, and trigger infrastructure-level kill, network isolation, or credential revocation and other external stop-bleeding actions.

## 60.3 Safe Recovery Protocol

| Step | Operation                         | Requirements                                               |
| ---- | ---------------------------- | -------------------------------------------------- |
| 1    | ForensicSnapshot review        | Security team confirms threat eliminated                             |
| 2    | PlatformResumeDirective issued | Need ≥ 2 platform_admin dual approval                |
| 3    | Progressive recovery                     | First restore read-only query → low-risk workflow → full recovery |
| 4    | Post-incident report                     | Publish Post-Incident Report within 72h                    |

**Admin Unavailable Degradation Plan**: If platform_admin less than 2 people online exceeds 4 hours, enable following degradation recovery path:

1. System sends multi-channel emergency notification to all platform_admin (SMS + phone + WeChat Work/Feishu/DingTalk)
2. Exceed 4h no response, authorize `break_glass` mechanism——any 1 platform_admin + 1 security_team member combination approval can replace dual admin approval
3. Exceed 8h still no response, only allow restore forensic / monitoring / read-only inspection; prohibit new workflow, write operation, external side effect, and policy relaxation, complete recovery still needs dual approval
4. All `break_glass` recovery operations record as P0-level audit event, must supplement platform_admin review within 72h

## 60.4 Periodic Drill

- At least one emergency brake drill per quarter (select tenant scope)
- Drill results incorporated into §36 success criteria
- ForensicSnapshot generated during drill used to verify forensic integrity
- Each drill outputs `PanicDrillReport`, at least containing ingress_block_time, execution_quiescence_time, egress_block_time, credential_revoke_time, plane_ack_success_rate, manual_recovery_time, and unresolved_findings.

---

# 61. Agent Unified Lifecycle Management Architecture

> Model Agent as first-class entity——composite of Pack + Prompt Bundle + Model Binding + Trust Profile + Trigger Set + Autonomy Config, manage complete lifecycle from creation to retirement.
> Related: §16 Prompt · §30 Pack · §42 Progressive autonomy · §41 Proactive Agent · §55 Marketplace

## 61.1 AgentDefinition Composite Entity

AgentDefinition is Agent's complete definition, composed of following components:

| Component              | Source               | Description                                    |
| ----------------- | ------------------ | --------------------------------------- |
| Pack              | §30 Business Pack  | Business domain capability package                            |
| PromptSet         | §16 Prompt Library | Planner/Generator/Evaluator Prompt set |
| ModelBinding      | §15 ModelGateway   | Model routing configuration (primary + fallback)       |
| TrustProfile      | §42 Progressive autonomy   | Trust level and autonomy configuration                    |
| TriggerPolicy     | §41 Proactive Agent   | Trigger condition and scheduling policy                      |
| ConnectorBindings | §57 Connector framework     | Bound external system connectors                    |

AgentDefinition is immutable by version——any component change produces new AgentVersion.

## 61.2 AgentVersion Snapshot

| Field           | Type                                           | Description                                  |
| -------------- | ---------------------------------------------- | ------------------------------------- |
| versionId      | string                                         | Version unique identifier                          |
| agentId        | string                                         | Owning Agent ID                         |
| definition     | AgentDefinition (snapshot)                     | Complete definition snapshot of this version, immutable          |
| status         | draft / testing / staging / canary / active / paused / deprecated / archived / removed | Version status, see §61.3 state machine for details |
| compatibilityMatrix | `ComponentCompatibilityMatrix`           | Pack, Prompt, Model, Tool, Policy, Domain, Eval, connector action schema version compatibility |
| publishedAt    | timestamp                                      | Publish time                              |
| publishedBy    | string                                         | Publisher identity                            |
| rollbackTarget | versionId?                                     | Rollback target version, for one-click composite rollback(§61.4) |

## 61.3 Lifecycle State Machine

```text
draft ◀──▶ testing ◀──▶ staging ──▶ canary ──▶ active
                                              │
                          paused ◀────────────┘
                            │
                        deprecated ──▶ archived ──▶ removed
```

| Conversion                | Trigger Condition          | Gate                                 |
| ------------------- | ----------------- | ------------------------------------ |
| draft→testing       | Developer submission        | All component versions locked                     |
| testing→staging     | Test pass          | §17 quality gate + security scan              |
| staging→canary      | Pre-release approval        | Domain administrator approval                         |
| canary→active       | Graying-out metrics meet target      | Auto promote (error rate < threshold + performance meets) |
| active→paused       | Manual/auto pause     | Behavior drift detection(§63) trigger or manual operation      |
| paused→active/canary | Resume operation          | resume revalidation: re-evaluate trust, policy, DomainDescriptor, Connector permission, budget, and incident status |
| active→deprecated   | Version replacement/business change | Responsibility transfer to new version completes                 |
| deprecated→archived | TTL expires          | All historical references marked as archived          |
| archived→removed    | Clean up resources          | No critical business dependency, migration threshold met, read-only export available |

## 61.4 Composite Graying-Out Release

Agent graying-out is in unit of AgentVersion (not single component):

- **Traffic split**: Canary version receives 5%→20%→50%→100% traffic
- **Composite rollback**: One-click rollback to previous AgentVersion (all components atomic rollback)
- **Comparison test**: Run two AgentVersions simultaneously for same input, compare output difference

## 61.5 Agent Retirement and Responsibility Transfer

| Phase      | Action                                   | Time Requirement      |
| --------- | -------------------------------------- | ------------- |
| deprecate | Mark version as deprecated, publish deprecation notice    | T+0           |
| notify    | Notify all downstream consumers and dependencies             | T+0 ~ T+7d    |
| migrate   | Migrate in-progress tasks to alternative Agent/version      | T+7d ~ T+25d  |
| transfer  | Transfer knowledge assets, historical context to successor       | T+25d ~ T+28d |
| archive   | Freeze execution capability, retain read-only historical data         | T+30d         |
| delete    | Clean up runtime resources, historical data retained by retention policy | T+30d+        |

Force **30-day deprecation window period**, during which old version can still process existing tasks, ensuring business continuity.

Critical business Agent not allowed from `deprecated` directly to `removed`. Must first complete migration report: downstream dependency list, in-progress run handling, alternative version verification result, rollback window, business owner signoff, and data retention policy.

---

# 62. Offline and Edge Deployment Architecture

> Support Agent execution in intermittent connection scenarios like factory floor, retail store, mobile device, run in local-first + eventual sync mode.
> Related: §15 ModelGateway · §32 Deployment · §52 Multi-Region · §10 Risk control

## 62.1 EdgeRuntime Minimalized Runtime

```text
┌─────────────────────────────────────────┐
│  EdgeRuntime (Local device/Store server)          │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌────────┐│
│  │P3-Lite   │  │P4-Lite   │  │P5-Local││
│  │Orchestr. │  │Execution │  │State   ││
│  └──────────┘  └──────────┘  └────────┘│
│  ┌──────────┐  ┌──────────┐            │
│  │LocalModel│  │SyncQueue │            │
│  │(sLLM)   │  │(offline) │            │
│  └──────────┘  └──────────┘            │
└─────────────────────────────────────────┘
         ▲ When connection restored ▼
┌─────────────────────────────────────────┐
│  Central Platform (Cloud)               │
│  P1 + P2 + P3 + P4 + P5 + X1           │
└─────────────────────────────────────────┘
```

## 62.2 Offline Execution Constraints

| Constraint       | Description                                                            |
| ---------- | --------------------------------------------------------------- |
| Risk upper limit   | Offline mode only allows executing actions with risk_level ≤ medium                   |
| Model downgrade   | Use local sLLM (e.g., Qwen-7B/Llama-3-8B), do not call cloud ModelGateway |
| Side effect queue | All side effect writes to local SyncQueue, batch commit after connection restored         |
| Approval suspend   | Steps requiring approval enter pending state, wait for connection restored                   |
| Cache plan   | EdgeRuntime periodically pre-fetch PlanGraphBundle templates from Central          |
| Device identity   | Each device must have hardware/software binding device identity, prohibit sync after certificate revocation |
| Local encryption   | Secret, PII, PHI, and SyncQueue encrypted on local disk, key controlled by lease and remote revocation |
| Tamper proofing   | Devices supporting secure boot / attestation must enable; when not supported, degrade to read-only or low-risk mode |
| Offline duration   | Each EdgeRuntime must declare offline max duration; after exceeding only read or freeze |
| Secret lease   | After local key lease expires, prohibit continuing to execute write actions; before connection restored must re-attestation and revocation check |

## 62.3 Sync Protocol

**Conflict Resolution Principle**: Central state is authority source; side effects during offline that conflict with Central, default Central wins + generate Incident for manual review.

SyncQueue must be signed append-only queue, each record contains `device_id`, `sequence_no`, `prev_hash`, `side_effect_dependency_refs`, `signature`, and `local_time_offset`. After connection restored, submit by side effect dependency graph topology; subsequent side effects with unconfirmed dependencies remain pending, must not submit out of order.

Model, Prompt, rule, and connector manifest edge updates must be signed, support staged rollout and rollback. Central can issue `remote_wipe` or `edge_quarantine` directive; devices when coming back online must first execute revocation check, then upload business changes.

## 62.4 Deployment Mode

| Mode          | Hardware Requirement                | Applicable Scenario                 |
| ------------- | ----------------------- | ------------------------ |
| Edge-Micro    | ARM/x86 single board, 4GB RAM | Retail store POS, IoT gateway   |
| Edge-Standard | 8C/32GB server          | Factory floor, warehouse           |
| Edge-Mobile   | iOS/Android App         | Mobile field service, on-site service       |
| Hybrid        | Local GPU server         | High-throughput scenario requiring local inference |

---

# 63. Agent Behavior Drift Detection Architecture

> Beyond single-dimension quality metrics, establish multi-dimensional behavior profile and long-period change point detection, send warning before Agent behavior gradual change leads to business risk.
> Related: §17 Quality gate · §42 Progressive autonomy · §43 Dashboard · §56 Feedback improvement

## 63.1 Behavior Fingerprint Model

| Field                    | Type                 | Description                                        |
| ----------------------- | -------------------- | ------------------------------------------- |
| agentId                 | string               | Target Agent                                  |
| window                  | 1h / 7d / 30d / 90d  | Fingerprint statistical window                                |
| tool_usage_distribution | `Map<toolId, ratio>` | Tool call distribution, detect tool preference drift              |
| avg_step_count          | number               | Average step count, detect complexity change                  |
| avg_cost                | number               | Average cost, detect cost anomaly                      |
| success_rate            | number (0-1)         | Success rate                                      |
| risk_distribution       | `Map<level, ratio>`  | Risk level distribution                                |
| driftScore              | number (0-1)         | Current window and baseline comprehensive drift score, >0.7 triggers alert |

## 63.2 Change Point Detection Engine

| Window     | Detection Algorithm                    | Sensitivity | Use                            |
| -------- | --------------------------- | ------ | ------------------------------- |
| 1h sliding window  | Z-Score anomaly detection            | High     | Sudden change (after model update, Prompt change) |
| 7d sliding window  | CUSUM                       | Medium     | Short-term trend (knowledge base change impact)      |
| 30d sliding window | Bayesian Online Changepoint | Medium     | Monthly drift (business environment change)        |
| 90d sliding window | Drift Distance (KL/JS divergence) | Low     | Long-term baseline drift                    |

MVP only mandatory to implement simple threshold and trend indicators: `success_rate_drop`, `override_rate_spike`, `cost_spike`, `tool_usage_shift`, `incident_count`. CUSUM, Bayesian Online Changepoint, KL/JS and other advanced statistics belong to Hardening/Enterprise, must not block MVP.

All thresholds must declare sample size, distribution assumption, and false positive handling strategy; must not treat "deviation > 2σ" as sole success criterion for non-normal business data. Drift response default first alert, slow down or require manual review; auto degradation must consider business continuity and SLA.

## 63.3 Drift Response Strategy

```text
BehaviorDriftAlert { agent_id, dimension, severity, drift_score }
    │
    ├── severity=low  → Record to §43 dashboard, mark "drift_warning"
    │
    ├── severity=medium → require_review + slow down/suggestion mode, default not directly degrade
    │
    └── severity=high → Pause Agent(§61 paused) + trigger Incident(§12) + require manual review
```

## 63.4 Cross-Agent Anomaly Detection

Multiple Agents under same DomainDescriptor form control group. When one Agent's behavior fingerprint significantly deviates from control group, even if that Agent itself did not trigger single Agent threshold, should send `CrossAgentDriftAlert`.

Anti-gaming requirement: Behavior fingerprint must distinguish real user task, synthetic evaluation task, and low-value "keep-alive" task; TrustScore, drift baseline, and promotion statistics must not be driven by unverified fake tasks alone.

---

# 64. Cost Attribution and Optimization Engine

> On the basis of §18 cost metering, add decision-level cost attribution, automatic optimization suggestion, What-if simulation, making cost data from "viewable" to "actionable".
> Related: §18 Cost management · §15 ModelGateway · §43 Dashboard · §54 SLA

## 64.1 Decision-Level Cost Attribution

| Field         | Type                           | Description                                        |
| ------------ | ------------------------------ | ------------------------------------------- |
| decisionId   | string                         | Associated HarnessDecision ID                   |
| llmCost      | number                         | LLM call cost generated by this decision                   |
| toolCost     | number                         | External tool/API call cost                       |
| computeCost  | number                         | Compute resource (Worker time) cost                 |
| storageCost  | number                         | artifact, event, projection, checkpoint storage cost |
| egressCost   | number                         | Cross-Region / external network transfer cost                |
| humanReviewCost | number                      | Approval, review, reviewer processing cost                  |
| totalCost    | number                         | Sum of items                                    |
| attributedTo | agent / tenant / domain / task | Cost attribution dimension, supports multi-dimensional drill-down                  |
| qualityRisk  | low / medium / high            | Quality risk label of this decision, used for cost-quality tradeoff analysis |

Cost fact source is §18 `BudgetReservation`, settlement and release records; metric aggregation must not directly derive single run cost from provider invoice in reverse. `totalCost = llm + tool + worker + storage + egress + human_review`.

## 64.2 Automatic Optimization Suggestion

| Suggestion Type       | Detection Condition                             | Suggestion Content                               | Expected Savings |
| -------------- | ------------------------------------ | -------------------------------------- | -------- |
| ModelDowngrade | Low-risk step uses high-end model             | Switch to cost_optimized routing             | 30-60%   |
| CacheHit       | Same query repeated call                  | Enable ExactPromptCache; SemanticCache only for human-approved safe domain | 40-80%   |
| TokenTrim      | Average input_tokens > 4x output_tokens | Optimize Prompt or enable context compression | 20-40%   |
| BatchMerge     | Multiple independent steps can be merged                 | Merge into single LLM call                    | 50-70%   |
| ScheduleShift  | Non-urgent tasks execute in peak time             | Schedule to low-cost time period                       | 10-30%   |

## 64.3 What-If Cost Simulation

Support cost impact simulation for following change scenarios:

| Simulation Scenario    | Input Parameter                    | Output                         |
| ----------- | --------------------------- | ---------------------------- |
| Model switch    | Target model, applicable step range    | projectedCost, quality impact estimate  |
| Prompt change | New Prompt token length change | Token cost change, call count impact |
| Tool replacement    | Alternative tool and unit price            | Tool cost difference, latency impact       |
| Concurrency adjustment  | Target concurrency                  | Compute resource cost, queue time change   |

Each simulation outputs `projectedCost`, `qualityImpact`, `qualityRisk`, `slaImpact`, `regressionTestRequirement`, and `recommendation` (recommend / not recommend / need further verification).

All automatic optimization suggestions must be constrained by policy, data residency, quality gate, SLA, and compliance. What-if output is only advisory, must not directly modify ModelGateway routing, Prompt, Tool, or budget configuration; launch still goes through §16/§17/§24/§56 release gate.

## 64.4 Cost Dashboard Integration

§43 unified operations dashboard adds "Cost Intelligence" panel:

- This month Top 10 high-cost Agent / Domain / Workflow
- Actionable savings opportunities (sorted by expected savings)
- Cost trend and budget comparison
- What-if simulation entry

---

# 65. Workflow Visual Debugger Architecture

> Provide visual debugging and inspection capability for running/completed workflow, support real-time execution tracking, OAPEFLIR step-in debugging, time travel replay.
> Related: §12.7 Tracing · §13 OAPEFLIR · §44.3 Workflow Builder · §59 Explainability

## 65.1 Debugger Capability Matrix

Debugger has three tiers by maturity:

| Tier | Capability Boundary | Launch Phase |
| --- | --- | --- |
| Debug Lite | timeline, evidence inspect, rationale view, read-only log | MVP/Hardening |
| Debug Pro | Trace Replay, run compare, side effect diff, regression marker | Hardening |
| Debug IDE | replay breakpoint, replay variable inspect, step_replay, variable check | Enterprise, only replay sandbox |

| Capability          | Running Workflow | Completed Workflow | Description                                          |
| ------------- | --------------- | --------------- | --------------------------------------------- |
| Execution Timeline    | ✓ (real-time)        | ✓               | Each step's start/end/state visualization              |
| OAPEFLIR Step-In | ✓               | ✓               | Expand single step to view O/A/P/E/F/L/I/R each stage detail |
| Data Flow View    | ✓               | ✓               | Input/output data flow between steps                      |
| Side Effect Diff   | ✗               | ✓               | Expected side effect vs actual side effect comparison                  |
| Breakpoint Debug      | ✗               | sandbox only    | Only Replay Sandbox supports, does not pause production run        |
| Time Travel      | ✗               | ✓               | Based on Trace Replay rebuild, does not write back truth            |
| Run Compare      | ✗               | ✓               | Two runs side-by-side comparison                            |

## 65.2 Real-Time Execution Flow

```text
WebSocket /ws/v1/debug/{workflow_id}
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│  Timeline View                                           │
│  ┌────┐  ┌────┐  ┌────┐  ┌─────┐  ┌────┐               │
│  │ S1 │─▶│ S2 │─▶│ S3 │─▶│ S4  │─▶│ S5 │  ← Current execution position│
│  │ ✓  │  │ ✓  │  │ ▶  │  │ ... │  │ ...│               │
│  └────┘  └────┘  └────┘  └─────┘  └────┘               │
│                     │                                    │
│              ┌──────┴──────┐                             │
│              │ OAPEFLIR Expand│                             │
│              │ O: Collected 3 signals                          │
│              │ A: Risk score 0.4 (medium)                    │
│              │ P: Chose plan B (reason:...)                     │
│              │ E: ▶ Executing...                              │
│              └─────────────┘                             │
└──────────────────────────────────────────────────────────┘
```

## 65.3 ReplaySandbox Breakpoint API

Breakpoint API only belongs to ReplaySandbox / Debug IDE, does not act on production HarnessRun.

| Breakpoint Type | Description | Operation |
| --- | --- | --- |
| replay-step | Stop at specified PlanGraph node / HarnessStep in replay | set / remove / list |
| replay-condition | Stop when replay evidence satisfies condition (on error / risk ≥ threshold / cost ≥ threshold) | set(condition) / remove |
| replay-variable | Only observe variables or context diff in sandbox | inspect / diff |

After breakpoint hit, only sandbox session enters paused, push `breakpoint_hit` event through WebSocket. Debugger can check ContextSnapshot then execute `resume_replay`, `step_replay`, or `abort_replay`; these operations must not modify production truth, trigger real Tool/LLM/SideEffect, or change original HarnessRun state.

Production run only supports `inspect`, `safe_pause_request`, and `abort_request`, and must go through §6 canonical control API, §21 HITL / §47 approval and audit. Production run does not support breakpoint hit pause, interactive single-step, variable watchpoint, or variable hot modification. Debugger permission equivalent to high-sensitivity evidence access: must two-factor authentication, least privilege, short-term session, full audit, and export watermark. Any re-execution replay must run under ReplaySandboxPolicy, real external side effect forced to be replaced by mock/recorded adapter.

## 65.4 Run Compare

Support side-by-side compare analysis of two HarnessRuns:

| Compare Dimension      | Description                              |
| ------------- | --------------------------------- |
| step diff     | Step count, order, added/missing steps     |
| decision diff | Each step's HarnessDecision difference |
| cost diff     | Each stage and total cost comparison                |
| duration diff | End-to-end duration and each step duration comparison      |
| outcome diff  | Final result difference, quality score difference        |

Support regression detection: when new version's key metrics are worse than old version, auto mark `regression_detected`.

---

# 66. Compliance Report Auto-Generation Engine

> Auto assemble platform-collected evidence into audit-ready compliance reports, support SOC2 Type II / SOX / HIPAA / GDPR / PCI-DSS and other multi-frameworks.
> Related: §23 Compliance · §49 Department compliance · §12 Exception event · §50 Knowledge isolation

## 66.1 Report Template Registration

| Field                | Type                             | Description                                          |
| ------------------- | -------------------------------- | --------------------------------------------- |
| templateId          | string                           | Template unique identifier                                  |
| framework           | GDPR / SOC2 / SOX / HIPAA / PIPL | Corresponding compliance framework                                  |
| version             | semver                           | Template version, sync iteration when framework updates                  |
| sections            | `Section[]`                      | Report section definition (control point mapping + evidence requirement)         |
| requiredDataSources | `string[]`                       | Required data sources (audit_log / metrics / config etc.) |
| outputFormat        | PDF / HTML / JSON                | Supported output format                                |
| lockedOnGeneration  | boolean                          | Lock template snapshot after generation, ensure audit traceability            |
| reportVersionLock   | `ReportVersionLock`              | Lock schema, policy, data snapshot, template, renderer version |

`ComplianceTemplateRegistry` must additionally save legal_version, change_source, effective_date, and migration_rule. Legal or framework change must not only update template text; must generate impact analysis, migration task, and old report applicability description.

## 66.2 Report Generation Pipeline

```text
ScheduledTrigger / OnDemandRequest
    │
    ▼
┌─────────────────┐
│ EvidenceCollector│  ← From P5, audit log, config snapshot, metrics collect evidence
└────────┬────────┘
         ▼
┌─────────────────┐
│ ControlMapper   │  ← Map evidence to control point, mark pass/fail/partial
└────────┬────────┘
         ▼
┌─────────────────┐
│ GapAnalyzer     │  ← Identify control points with insufficient evidence, generate remediation suggestion
└────────┬────────┘
         ▼
┌─────────────────┐
│ ReportRenderer  │  ← Generate PDF + CSV + JSON by framework template
└────────┬────────┘
         ▼
ComplianceReport { framework, period, controls_passed, controls_failed, gaps[], export_urls }
```

Report auto-generation is not equivalent to compliance confirmation. `ComplianceReport` after entering `generated` must pass `HumanSignoff` before marking as `attested` or providing externally. Report simultaneously outputs `EvidenceQualityScore` (completeness, freshness, source credibility, immutability) and `ControlCoverageReport` (pass/fail/partial/not_applicable, evidence gap, remediation owner).

`HumanSignoff` must declare `signoff_due_at`, escalation owner, and timeout action. Reports staying in `generated` after deadline enter `signoff_overdue`, auto remind responsible person and escalate to compliance owner; after exceeding max wait window, mark `not_attested_expired`, must not be published as confirmed report externally.

Evidence control mapping must be machine verifiable:

| Field | Description |
| --- | --- |
| controlId | Compliance control point ID |
| evidenceType | audit_log / metric / config_snapshot / approval / report / artifact |
| freshness | Evidence max allowed age and actual collection time |
| owner | Evidence responsible person or system owner |
| exception | Exception, compensating control, and expiration time |

## 66.3 Report Type and Frequency

| Framework         | Frequency | Scope   | Typical Consumer     |
| ------------ | ---- | ------ | -------------- |
| SOC2 Type II | Quarterly | Whole platform | Auditor / customer  |
| SOX 302/404  | Quarterly | Finance domain | CFO / External auditor |
| HIPAA        | Monthly | Healthcare domain | HIPAA Officer  |
| GDPR         | Monthly | Whole platform | DPO            |
| PCI-DSS      | Quarterly | Payment domain | QSA            |
| ISO 27001    | Half year | Whole platform | CISO           |

## 66.4 Auditor Read-Only Access

Auditor obtains limited read-only view through `AuditorAccess`:

- **Visible scope**: runs / decisions / evidence / compliance reports, filter by tenant + timeRange + framework
- **Permission control**: only read operation, cannot modify, delete, or export original data
- **PII protection**: Return data passes §23 data classification check, fields not passing classification review auto desensitized
- **Audit tracking**: Auditor's each query operation itself incorporated into audit log(§23), record query person, time, scope
- **Least privilege**: AuditorAccess authorized by framework, tenant, timeRange, controlId, and evidence type, default invisible business original text, secret, PHI, and cross-tenant evidence
- **Version freeze**: Signed report can only append supplementary description or errata, must not overwrite in place; regenerate must produce new report version

---

# 67. Capacity Planning and Cost Forecasting Engine

> Predictive capacity modeling based on historical trend, support expansion timing suggestion, cost trend forecast, and What-if capacity simulation.
> Related: §18 Cost · §27 SLO · §43 Dashboard · §54 SLA · §64 Cost optimization

## 67.1 Resource Dimension Tracking

| Dimension              | Collection Source           | Alert Threshold               |
| ----------------- | ------------------ | ---------------------- |
| Worker concurrency     | P4 Execution Plane | Current capacity 80%           |
| Storage usage          | P5 State Plane     | Current capacity 85%           |
| LLM Token consumption/day | §18 CostTracker    | Monthly budget 70%           |
| API QPS           | P1 Interface Plane | Current capacity 75%           |
| Event Log growth rate  | P5 Event Store     | Storage capacity 80%           |
| Queue depth          | P4 Fair Queue      | Average wait time > SLA 50% |

## 67.2 Forecasting Model

MVP capacity planning does not depend on advanced forecasting models, only five mandatory capabilities: threshold alert, trend projection, queue depth forecast, provider quota monitor, failover capacity reserve. Complex forecasting accuracy metrics belong to Hardening/Enterprise acceptance, must not serve as MVP exit condition.

| Forecast Target     | Algorithm                         | Forecast Period       |
| ------------ | ---------------------------- | -------------- |
| Token consumption | Linear regression + seasonal decomposition        | 7d / 30d / 90d |
| Compute resource usage | Linear regression + seasonal decomposition        | 7d / 30d / 90d |
| Storage growth     | Exponential smoothing + capacity upper limit extrapolation      | 30d / 90d      |
| Concurrent run demand | Peak regression + workday/holiday correction | 7d / 30d       |

Forecast result auto inputs §67.1 alert threshold judgment, when forecast value will break capacity threshold within forecast period, generate `CapacityAlert`.

Capacity suggestion must simultaneously check SLA Tier, queue latency, budget, approval capacity, provider quota, and Region failover reserve. Enterprise SLA tenant admission must use N+1 / failover capacity reserve as hard gate; when any key provider quota approaches upper limit, system generates degradation/rate limit suggestion, not just expand Worker.

After each forecast window ends, must record forecast vs actual: error, underestimate/overestimate direction, triggered expansion action, and business impact. When two consecutive windows exceed error threshold, ForecastModel enters `needs_recalibration`, capacity suggestion degrades to manual review, must not continue auto expansion or auto shrink.

## 67.3 What-If Capacity Simulation

Support capacity impact simulation for following scenarios:

| Simulation Scenario        | Input Parameter                    | Output                                 |
| --------------- | --------------------------- | ------------------------------------ |
| New tenant online      | Estimated usage, SLA Tier          | Required additional capacity, cost increment               |
| Traffic peak        | Peak multiplier, duration          | Bottleneck resource, expansion suggestion                   |
| Region failover        | Failed Region, traffic migration proportion   | Target Region remaining capacity, whether need pre-expansion |
| Model migration        | New model token efficiency, latency change | Token consumption change, Worker concurrency impact      |

Each simulation outputs `requiredCapacity`, `estimatedCost`, `bottleneckWarnings`.

## 67.4 Financial Budget Support

- Monthly cost trend report (actual vs budget vs forecast)
- Quarterly capacity planning suggestion (for finance team to approve budget)
- Annual TCO forecast (including hardware + LLM API + labor cost)

---

# 68. Multimodal Capability Architecture

> Extend ModelGateway to support image, voice, document and other multimodal input/output, enable platform to undertake scenarios like creative production, customer service image processing, voice interaction.
> Related: §15 ModelGateway · §26 Storage · §37 Business domain · §39 NL entry

## 68.1 Multimodal ModelGateway Extension

Extend multimodal capability on §15 ModelGateway basis:

- **Modality detection**: Auto identify input modality contained in request (text / image / audio / video / document)
- **Capability routing**: Auto select Provider supporting that modality based on needed modality (see §68.3 ModalityRouter for details)
- **Format conversion**: Auto convert when input/output format inconsistent between Providers (e.g., base64 ↔ URL ↔ binary)
- **Fallback chain**: Degrade according to §68.3 Fallback configuration when multimodal Provider unavailable

## 68.2 Multimodal ModelRequest Extension

Add multimodal field on standard ModelRequest basis:

| Field             | Type            | Description                                          |
| ---------------- | --------------- | --------------------------------------------- |
| inputModalities  | `string[]`      | Input modality list contained in request                        |
| outputModalities | `string[]`      | Expected output modality list                            |
| contentParts     | `ContentPart[]` | Mixed content block (text + image + audio can be interleaved) |

Each modality independently executes safety check (§68.4), any modality not passing check then entire request rejected.

`ContentPart` schema:

| Field | Type | Description |
| --- | --- | --- |
| partId | string | Content block unique identifier |
| modality | text / image / audio / video / document | Modality |
| text | string? | Only allow small text inline |
| artifactRef | string? | Binary or large object must reference §26 Artifact, must not inline base64 |
| mimeType | string | Media type |
| provenance | `ProvenanceMetadata` | Source, generation method, C2PA/watermark, license, hash |
| safetyLabels | `string[]` | Content safety scan label |
| costKey | string | modality cost ledger billing key |

## 68.3 ModalityRouter

| Modality             | Default Provider                 | Fallback                       | Cost Model      |
| ---------------- | ----------------------------- | ------------------------------ | ------------- |
| Text LLM         | GPT-4o / Claude               | Qwen / DeepSeek                | per-token     |
| Image Analysis   | GPT-4o Vision / Claude Vision | Qwen-VL                        | per-image     |
| Image Generation | DALL-E 3 / Midjourney API     | Stable Diffusion (self-hosted) | per-image     |
| Speech-to-Text   | Whisper API                   | Paraformer (self-hosted)       | per-minute    |
| Text-to-Speech   | Azure TTS / ElevenLabs        | CosyVoice (self-hosted)        | per-character |
| Document Parse   | Document Intelligence         | Marker / Docling (self-hosted) | per-page      |

## 68.4 Multimodal Security

- Image input passes content moderation (pornography/violence/sensitive information detection)
- Generated image carries C2PA metadata watermark
- Voice input PII detection (phone number, ID number auto desensitization)
- Document parse result constrained by §50 knowledge domain isolation
- Video, audio, image, document respectively use modality-specific guardrails, must not reuse text safety threshold
- All generated or converted binary output first write to Artifact Store, after safety scan, provenance write, and cost settlement, then return artifact_ref

`ModalitySafetyResult` schema:

| Field | Description |
| --- | --- |
| labels | Detected safety labels |
| confidence | Each label's confidence |
| provider | Safety check provider / model |
| policyDecision | allow / filter / escalate / deny |
| appealPath | Appeal or manual review path |

## 68.5 Multimodal Cost Tracking

§18 CostTracker extends `modality` dimension:

| Field | Description |
| --- | --- |
| modality | text / image / audio / video / document |
| unit | token / image / second / minute / page / byte |
| providerCost | Provider original billing |
| processingCost | Transcoding, OCR, vectorization, safety scan cost |
| storageCost | Artifact storage and egress cost |

---

# 69. Platform Self-Operations Agent Architecture

> Platform uses its own Agent capability for self-operations (dog-fooding), covering Incident auto diagnosis, common fault self-repair, configuration optimization suggestion, developer Q&A.
> Related: §12 Exception event · §14 Execution · §37 Business domain · §41 Proactive Agent · §43 Dashboard

## 69.1 PlatformOps DomainDescriptor

Platform self-operations registers to §37 domain framework as a special business domain:

| Field          | Value                                                                  |
| ------------- | ------------------------------------------------------------------- |
| domain        | `platform_ops`                                                      |
| riskProfile   | High (involves production environment write operations)                                          |
| tools         | `metrics_query`, `config_patch`, `restart_service`, `scale_replica` |
| evalFramework | SLO-based (uses §27 SLO achievement rate as Agent performance evaluation standard)               |
| autonomy_cap  | Read-only operation max auto; write operation max supervised (§42)                     |

PlatformOps must explicitly declare ops data boundary: can only read platform operations data (metrics, logs, traces, config, deployment, incident, capacity), default cannot read business payload, customer original text, PHI/PII, or cross-tenant evidence. When need to associate business evidence, only read desensitized summary and evidence_ref.

## 69.2 Self-Operations Agent Catalog

| Agent             | Trigger Condition            | Capability                             | Autonomy Upper Limit  |
| ----------------- | ------------------- | -------------------------------- | ----------- |
| IncidentDiagnoser | Incident creation event   | Collect logs, analyze root cause, generate diagnostic report | semi_auto   |
| ConfigOptimizer   | Weekly scheduled + performance deviation | Analyze config, suggest optimization, estimate impact     | supervised  |
| CapacityPredictor | Daily scheduled            | Analyze trend, predict bottleneck, suggest expansion     | supervised  |
| DevAssistant      | Developer question          | Query document, search code, generate example     | semi_auto   |
| HealthMonitor     | Continuous operation            | Inspect platform health, generate daily report           | auto (read-only) |

## 69.3 Safety Guardrails

- All production environment write operations **must** pass manual approval
- PlatformOps Agent's ModelGateway call has independent cost budget and rate limit
- PlatformOps Agent cannot access business domain data, can only access platform operations data
- PlatformOps Agent's all operations incorporated into independent audit flow(§23), isolated from business audit
- Default read-only; write actions such as `config_patch`, `restart_service`, `scale_replica`, `failover` must bind runbook, approval, blast radius, and rollback plan
- Self-operations must not become the only recovery path. Each P0/P1 platform failure must have out-of-band recovery runbook, can be executed by human and infrastructure control plane when Chat, Agent, ModelGateway, or any of P1/P3/P4/P5 planes is unavailable

## 69.4 Self-Operations Maturity Level

| Level | Description | Acceptance Boundary |
| ---- | ---- | -------- |
| L0   | Pure manual operation, Agent only assists document query | Does not touch production control plane |
| L1   | Agent generates diagnostic report, daily report, capacity trend, and read-only Q&A | Does not execute production write operation |
| L2   | Agent generates repair plan, config patch candidate and pre-execute verification | After manual approval, execute by standard change system |
| L3   | Agent auto handles limited P3/P4 level issues | Only known-runbook, low blast radius, rollback-able action, and needs post-review |

Initial deployment starts from L0, gradually promote according to §42 progressive autonomy.

---

# Part X — Implementation Roadmap and Summary (§33-§36)

---

## Three-Ring Implementation Priority

v4.2 converges the historical big platform blueprint into MVP / Hardening / Enterprise three production delivery rings, clarifying "first do minimum production closed loop → then do runtime hardening → finally do enterprise expansion". Three rings are §33's authoritative implementation model, priority divided by **capability dimension** rather than **time dimension**.

### First Ring: Platform Survival Ring

> **No first ring, no large-scale onboarding.** First ring is not the sum of complete Phase 1 / Phase 2 / Phase 8a / Phase 8d, but the MVP slice cut from these Phases. Goal is 8-12 weeks to deliver runnable, auditable, stoppable, Trace Replay-able minimum production closed loop; each Phase's complete capability enters Hardening Ring extension.

**MVP Slice Boundary**:

| Source Phase | First Ring Must Deliver | Deferred to Hardening Ring |
| --- | --- | --- |
| Phase 1 | harness_run, node_run, event_log, checkpoint, lease, CAS, idempotency, minimum CLI inspect | Complete schema inventory, all Group 1/2 tables, complex projection rebuild |
| Phase 2 | Harness main chain minimum O→A→P→E→F, risk/approval basic, SideEffect proposed→committed→confirmed minimum chain | Multi-Pack extension, complete recovery worker, complex degradation strategy |
| Phase 8a | HarnessRuntime.run() entry, ConstraintPack, Planner/Generator/Evaluator separation, HarnessDecision six decisions | Complete Memory Namespace, complete Toolbelt profile, complex feedback pipeline |
| Phase 8d | PlanGraph DAG, NodeRun state machine, Event Registry facts, Budget atomic reserve, Trace Replay, SideEffect Reconciliation baseline | Complete GraphPatch strategy, LearningCandidate, EvaluationGate full matrix, complete Runtime Test Matrix |

Minimum closed loop capability set that must be delivered first, missing any one means platform cannot go to production:

| Capability                                       | Corresponding Section         | Delivery Standard                                  |
| ------------------------------------------ | ---------------- | ----------------------------------------- |
| P1-P5 core link                             | §4-§7, §14       | Five plane communication end-to-end reachable                      |
| ConstraintPack                             | §45.3            | Task-level constraint envelope loadable and verifiable              |
| HarnessRun / HarnessStep / HarnessDecision | §45.13, §58.6    | Planner→Generator→Evaluator closed loop runnable    |
| PlanGraph / Event Registry / SideEffect Reconciliation | §13, §14, §28 | Complex task graphed, state evented, side effect reconcilable |
| Risk / Approval / Audit                    | §10, §47, §23    | Risk score→approval routing→audit write full link          |
| Lease / CAS / Checkpoint / Recovery        | §14, §25, §45.15 | State persistence, fault recovery demonstrable                |
| Panic / Incident / Replay                  | §9, §12, §60     | Emergency brake triggerable, events replayable                |
| ModelGateway / Prompt / Eval Gate          | §15, §16, §17    | LLM call has gateway, Prompt has version, quality has gate |

**First Ring Acceptance Gate**: Can run one Agent task end-to-end in controlled environment (from entry to result output), complex tasks executed by PlanGraph, budget atomic reservation effective, task can be interrupted, resumed, audited, Trace Replay, and real side effect will not repeat in replay. First ring explicitly does not contain Multi-Region, Marketplace, 24 vertical domains, Edge Runtime, PlatformOps Agent, complete Evaluation Harness, complete organizational governance, complete multimodal, or complete compliance report.

MVP Eval Gate only requires deterministic contract tests + small golden set + denial-path regression; complete Prompt canary, cross-model evaluation, and large-scale holdout enter Hardening.

### Second Ring: Platform Usability Ring

> **Achieve second ring, platform can support real business pilot.** Corresponds to §33 Phase 3-5 + Phase 8b-8c. Phase 8c's governance and evaluation must be accepted after Phase 8d's PlanGraph / Event / SideEffect / Budget baseline completes.

Build closed loop for users and enterprises on first ring basis:

| Capability                                                  | Corresponding Section          | Delivery Standard                                                            |
| ----------------------------------------------------- | ----------------- | ------------------------------------------------------------------- |
| NL entry                                               | §39               | Natural language task submission available                                                |
| Goal Decomposition                                    | §40               | Goal decomposition engine can decompose composite tasks                                        |
| HITL Runtime                                          | §45.18            | inspect / patch / override / takeover / resume five manual intervention modes available |
| Async Harness                                         | §45.19            | Long-time task can sleep/wake                                                 |
| Dashboard                                             | §43               | L0/L1 dashboard view available                                                  |
| Org / SSO / Approval Routing                          | §46-§48           | Organization hierarchy→approval routing→SSO integration                                          |
| DomainDescriptor / DomainRecipe / DomainEvalFramework | §37, §37.7, §37.5 | Domain modeling framework available, at least 2 domains complete onboarding                                 |
| Canonical Domain Meta-Model                           | §37.11            | Meta-model 15-question template can be filled and verified                                      |
| Agent Collaboration Protocol                          | §19.5             | Multi-Agent collaboration message can be sent and received, non-violation rules verifiable                         |

**Second Ring Acceptance Gate**: At least 2 vertical domains (recommended 1 Critical + 1 Medium risk domain) complete pilot launch, non-technical user can submit task through NL entry, approval and HITL process can pass.

### Third Ring: Platform Expansion Ring

> **Achieve third ring, can talk about 24-domain scaling.** Corresponds to §33 Phase 6-9.

Build scaling and continuous optimization capability on first two rings basis:

| Capability                     | Corresponding Section | Delivery Standard                                      |
| ------------------------ | -------- | --------------------------------------------- |
| Marketplace              | §55      | Agent Marketplace can release/subscribe/deprecate                    |
| Multi-Region             | §52      | At least 2 Regions can deploy                          |
| Edge Runtime             | §62      | Offline/edge scenario can run                           |
| Cost Optimizer           | §64      | Cost attributed to domain/Agent/task level                   |
| Behavior Drift Detection | §63      | Drift detection baseline established, alert triggerable                  |
| Compliance Reporter      | §66      | Compliance report can be auto-generated                            |
| 24 Domain Packs          | §71-§94  | All 24 domains complete meta-model filling and pass §38 four-phase gate |

**Third Ring Acceptance Gate**: ≥ 12 domains running in production, cross-Region failover drill passes, platform self-operations Agent (§69) can handle P3/P4 level issues.

### Three Rings and §33 Phase Mapping

```text
First Ring (Survival)    Second Ring (Usability)         Third Ring (Expansion)
 Phase 1/2/8a/8d   Phase 3-5+8b/8c        Phase 6-9
 MVP slices only
 ┌─────────┐      ┌───────────────┐      ┌────────────────────────┐
 │ Skeleton+  │─────▶│ NL entry+HITL+  │─────▶│ Marketplace+Multi-     │
 │ Harness   │      │ Org+domain pilot+   │      │ Region+Edge+Cost+      │
 │ core+Trace │      │ Collaboration protocol+evaluation │      │ Drift+24 domains full coverage       │
 └─────────┘      └───────────────┘      └────────────────────────┘
 ~ 8-12 weeks          ~ 12-24 weeks             ~ 24 weeks later
```

### Implementation Decision Suggestions

- **Limited resources**: Only do first ring + DomainDescriptor/HITL from second ring, sufficient to support POC
- **Tight timeline**: Second ring's NL entry can use simplified version (structured form) alternative, Dashboard can be deferred
- **Domain count scalable**: Third ring's 24 domains can be launched in batches according to §33 Phase 9's 6-batch rhythm, no need to deliver all at once

---

# 33. Phased Implementation Roadmap

> v4.2 uses three rings as authoritative delivery model: MVP 8-12 weeks, Hardening 3-6 months, Enterprise 6-18 months. Old Phase 1-9 only as historical mapping and detailed breakdown, no longer as parallel roadmap; Phase 8a-8d has been split into Ring 1/2 delivery package, Phase 9 domain waves do not block platform core milestone.

This section's Ring is the only authoritative implementation roadmap; subsequent Phase 1-9 are historical mapping and detailed breakdown, not as backlog source or parallel roadmap.

## 33.0 v4.2 Authoritative Delivery Ring

| Ring | Time Window | Must Deliver | Non-Blocking Items |
| --- | --- | --- | --- |
| MVP Slice | 8-12 weeks | HarnessRuntime entry, PlanGraphBundle, NodeRun, BudgetReservation, SideEffectManager, HITL basic, Trace Replay, CLI inspect | Marketplace, 24 domains, Edge, PlatformOps, complete UI |
| Hardening | 3-6 months | Recovery, Projection rebuild, Incident/DLQ, Config governance, Org approval, Prompt/Eval rollout, Domain pilots | Multi-region GA, external marketplace, IDE debugger |
| Enterprise | 6-18 months | Multi-region, Marketplace, Edge, Advanced domains, Compliance reporter, Cost optimizer | No longer expand core runtime semantics |

Platform milestone is accepted by capability, not by domain count. Phase 9 changes to independent domain waves: platform goal is `N/24 domains GA`, single domain delay cannot block Harness / State / Evidence / Governance main chain.

### 33.0.1 Operational Readiness Matrix

Operational readiness accepts progressively by Ring, avoiding MVP being dragged down by Enterprise goals, and also avoiding Enterprise claiming production-grade but missing operations closed loop.

| Capability | MVP | Hardening | Enterprise |
| --- | --- | --- | --- |
| Incident | Manual create + linked evidence | Auto detect + routing | SLO / error budget linkage |
| DLQ | inspect + discard | redrive + simulation | bulk remediation |
| Replay | trace replay, no real side effect | replay compare + deterministic diff | simulation lab |
| Panic | local kill / admission block | plane ack + safe recovery | cross-region drill |
| Budget | run / node reserve | sub-ledger + allocator bucket | cross-region reconciliation |
| Domain | 2 pilot specs | 6-12 domains with gate evidence | 24 domain waves |
| Config | versioned defaults + manual rollback | ConfigImpactAnalyzer + canary | cross-region rollout lock |
| Approval | basic approve / deny | capacity reserve / route snapshot | delegated authority simulation |
| Evidence | event + audit + artifact refs | control mapping + quality score | compliance package generation |

## Phase 1: Steady-State Skeleton (8 weeks)

### Deliverables

- HarnessRun / NodeRun truth tables + event log + UoW (MVP physical schema)
- lease / fencing / CAS
- idempotency
- artifact ref
- policy outcome + decision model (Group 2 tables)
- Minimum operations CLI (doctor / inspect)
- Unit test ≥ 80% coverage

### Acceptance Gate

- [ ] HarnessRun can be stably created and advanced (no degradation)
- [ ] Lease auto reclaim after timeout
- [ ] CAS conflict correctly rejected
- [ ] Event append and truth table in same transaction

### Dependencies

No external dependencies. SQLite + Node.js can start.

## Phase 2: Controlled Automation (8 weeks)

### Deliverables

- HarnessRuntime main chain + OAPEFLIR StageRationale projection
- risk assessment engine
- approval gates (basic)
- side effect tracking
- recovery workers (LeaseReclaimer + StuckRunSweeper)
- 2 Business Packs: coding.fix_bug + operations.resolve_incident

### Acceptance Gate

- [ ] Main chain end-to-end running (task create → execute → complete)
- [ ] High-risk step triggers approval block
- [ ] Worker recovers within 30s after crash
- [ ] Side effect queryable and auditable

### Dependencies

All Phase 1 acceptance passed.

## Phase 3: Enterprise Reliability (12 weeks)

### Deliverables

- Feedback / Learn / Improve / Release governance closed loop
- circuit breaker + degradation mode switching
- backpressure (4 modes)
- incident management + DLQ operations
- projection rebuild
- replay / repair
- configuration governance (versioned + graying-out)
- multi-tenant isolation hardening
- PostgreSQL migration (optional)

### Acceptance Gate

- [ ] External dependency circuit breaker auto degrade, auto recover after recovery
- [ ] DLQ queryable, retryable, closeable
- [ ] Incident closed-loop processing chain open
- [ ] Projection rebuild data consistent after
- [ ] Configuration change rollbackable

### Dependencies

All Phase 2 acceptance passed.

## Phase 4: Scaled Expansion (Continuous)

### Deliverables

- Worker separation deployment (Phase D2)
- More Business Packs
- Browser execution deepening
- Plugin ecosystem
- SLO automated monitoring
- Compliance export
- Disaster recovery drill

### Acceptance Gate

- [ ] 50 concurrent workflows stably running
- [ ] Multi-tenant isolation verification passed
- [ ] Load test meets §27 SLO
- [ ] DR drill RTO < 10min

## Phase 5: Intelligent Interaction + Organizational Governance + Domain Onboarding Framework (12 weeks)

> Intelligent interaction layer + organizational governance layer + unified domain meta-model + multi-Agent collaboration protocol.

### Deliverables

- Natural language task entry(§39) + Goal decomposition engine(§40)
- Proactive Agent framework(§41) + Progressive autonomy model(§42)
- Unified operations dashboard(§43) + Non-technical user experience(§44)
- Organizational hierarchy model(§46) + Approval routing(§47) + SSO/SCIM(§48)
- Compliance policy engine(§49) + Knowledge domain isolation(§50) + Governance delegation(§51)
- Unified domain meta-model 15-question template and validation tool(§37.11)
- Multi-Agent collaboration protocol message format and non-violation rule validation(§19.5)

### Acceptance Gate

- [ ] Non-technical user can create and manage tasks through natural language
- [ ] Goal decomposition engine auto decomposes business goal into executable task graph
- [ ] Progressive autonomy L0→L3 upgrade path end-to-end verified
- [ ] Organization three-level hierarchy correctly drives approval routing
- [ ] SSO/SCIM auto sync users and deactivation account takes effect < 5min
- [ ] Knowledge domain isolation zero leak, controlled sharing audit complete
- [ ] 15-question meta-model template fillable, verifiable, at least 2 domains complete filling
- [ ] Multi-Agent collaboration message send/receive end-to-end reachable, 7 non-violation rules auto verify

### Dependencies

All Phase 4 acceptance passed.

## Phase 6: Scaling and Ecosystem (12 weeks)

> Scaled runtime layer + ecosystem layer.

### Deliverables

- Multi-Region deployment(§52) + Resource contention management(§53) + SLA tiered(§54)
- Internal Pack Registry(§55) + Feedback improvement pipeline(§56) + External integration framework(§57)

### Acceptance Gate

- [ ] Dual Region single leader / follower read deployment, controlled failover drill passes, single Region failure RTO < 5min
- [ ] active-active only used for non-truth cache, telemetry, or aggregate statistics, does not carry HarnessRun / Budget / SideEffect writes
- [ ] 1000 concurrent workflows, high priority tasks not starved
- [ ] SLA Tier P0 tasks 99.9% completed within committed time
- [ ] Internal Pack Registry at least 3 core Packs pass certification; external Marketplace 20 certified Packs as Enterprise/Future independent acceptance
- [ ] User feedback → improvement closed loop < 7 days

### Dependencies

All Phase 5 acceptance passed.

## Phase 7: Operational Maturity (Continuous)

> Operational maturity layer.

### Deliverables

- Explainability(§59) + Emergency brake(§60) + Lifecycle management(§61)
- Offline/edge deployment(§62) + Behavior drift detection(§63) + Cost optimization(§64)
- Visual debugger(§65) + Compliance report(§66) + Capacity planning(§67)
- Multimodal capability(§68) + Platform self-operations Agent(§69)

### Acceptance Gate

- [ ] User can query explanation for any step, L1 latency < 2s
- [ ] Emergency brake drill: whole platform stop < 5s, recovery < 30min
- [ ] EdgeRuntime offline 24h, zero data loss after recovery
- [ ] Behavior drift > 2σ 100% triggers alert
- [ ] Compliance report SOC2 Type II control point coverage ≥ 95%
- [ ] PlatformOps Agent L1 maturity verification passes

### Dependencies

All Phase 6 acceptance passed.

## Phase 8a: Harness Unified Runtime Protocol (8 weeks)

> Harness engineering layer. Can start in parallel with Phase 3.

### Deliverables

- HarnessRun/HarnessStep unified contract(§45.13) + HarnessDecision(§58.6)
- Harness Runtime main entry + HarnessLoopController(§45.7)
- ConstraintPack assembly engine(§45.3) + ToolbeltAssembler(§45.4)
- ContextAssembler + ContextSnapshot(§45.5) + minimum Working Memory(§45.16)
- Planner/Generator/Evaluator Agent role separation(§45.8-45.10)
- FeedbackEnvelope four-segment closed loop(§45.6)
- Basic Evaluator (runtime decision)

### Acceptance Gate

- [ ] All task execution through HarnessRuntime.run() entry, no bypass
- [ ] ConstraintPack correctly merges platform→tenant→domain→task four-level constraints
- [ ] Planner/Generator/Evaluator use independent Prompts, not shared
- [ ] After each step execution Evaluator evaluation pass rate ≥ 95%
- [ ] HarnessRun/HarnessStep contract completely covers all runs and steps
- [ ] HarnessDecision six decisions all have test coverage

## Phase 8b: Harness Long-Running and Human-Machine (6 weeks)

> Eight-pillar deepening. Depends on Phase 8a completion.

### Deliverables

- Durable Harness persistent execution(§45.15): pauseReason registry + resumeStrategy
- HITL Runtime(§45.18): inspect/patch/override/takeover/resume five types of capabilities
- Async Harness(§45.19): create_run/poll_status/subscribe_events/intervene_mid_run
- Memory Namespace(§45.16): Working/Long-term/Shared Knowledge three layers + promotion strategy
- Harness Prompt layered governance(§58.2)
- Failure-to-Learning pipeline(§58.3)
- Online feedback closed loop

### Acceptance Gate

- [ ] ContextSnapshot supports crash recovery, state consistent after recovery
- [ ] Durable Harness supports 5 pauseReasons and 4 resumeStrategies
- [ ] HITL Runtime's inspect/patch/override operable in §43 dashboard
- [ ] Async run supports poll_status and intervene_mid_run
- [ ] Memory three-layer namespace isolation passes tenant/domain isolation test

## Phase 8c: Harness Governance and Evaluation (6 weeks)

> Eight-pillar deepening. Depends on Phase 8b + Phase 8d completion.

### Deliverables

- Evaluation Harness(§45.14): pre-release evaluation + version comparison evaluation
- Tool Harness(§45.17): tool capability profile + tool call governance record
- Guardrails layered(§45.20): input/planning/tool/memory/output five layers
- Harness Replay/Simulation(§58.4)
- Harness ten invariants(§45.21) mandatory check
- Harness-level metrics visible in §43 dashboard(§58.1)

### Acceptance Gate

- [ ] Evaluation Harness can run standard task set in sandbox and output comparison report
- [ ] Tool Harness's Capability Profile covers all registered tools
- [ ] Guardrails five layers all have interception test coverage
- [ ] Harness Replay can completely replay completed run
- [ ] Ten invariants have corresponding automated checks (violation means CI failure)

### Dependencies

Phase 8a → Phase 8d; Phase 8d → Phase 8b; Phase 8b + Phase 8d → Phase 8c. Phase 8a can advance in parallel with Phase 3-7; Phase 8d is the runtime semantics baseline for Phase 8b/8c. Phase 8c must complete before Phase 5.

## Phase 8d: OAPEFLIR-Harness Convergence Runtime Contract (8 weeks)

> OAPEFLIR-Harness convergence contract. Depends on Phase 8a, is the runtime semantics baseline for Phase 8b/8c; Phase 8b's long-running/HITL capabilities can be locally developed in parallel, but acceptance must be based on Phase 8d's HarnessRun / NodeRun / Event / SideEffect / Budget contract.

### Deliverables

- HarnessRun / NodeRun State Machine
- Event Registry + Trace Replay Semantics
- PlanGraph + GraphPatch
- Graph Normalizer / Validator / Risk Propagator / Worst-Path Analyzer
- Deterministic Graph Scheduler decision recording
- Budget Ledger
- SideEffect Manager + Reconciliation State Machine + Compensation Manager
- DecisionInputBundle + Decision Engine precedence
- ContextAssemblyContract + PromptExecutionContract
- HITL Responsibility Record
- Memory Write Governance
- EvaluationGate + LearningCandidate State Machine
- Runtime Test Matrix

### Acceptance Gate

- [ ] All state transitions have unit test coverage, terminal states cannot be exited.
- [ ] PlanGraph validation can intercept deadlock / missing terminal / missing compensation.
- [ ] Same graph's scheduler decision is Trace Replay-able; Re-execution Replay marked nondeterministic.
- [ ] SideEffect ambiguous can enter reconciliation, will not be misjudged as success.
- [ ] Budget exhausted can block retry / replan.
- [ ] HITL approve scope effective, will not expand authorization.
- [ ] LearningCandidate pollution check can block holdout / PII / secret.
- [ ] EvaluationGate can block non-compliant Prompt / Policy / Tool / Domain release.
- [ ] Replay does not produce real side effect.

## Phase 9: Vertical Business Domain Deepening Implementation (48 weeks, in 6 batches)

> 24 vertical business domains' DomainDescriptor instantiation, domain tool integration, domain evaluation baseline establishment, and graying-out online. Depends on Phase 5 + Phase 8c completion. First 3 batches cover original 12 domains (v3.0), last 3 batches cover new 12 domains (v3.1).

### Phase 9a: High Priority Domains (8 weeks) — Code Development · Data Processing · Enterprise Knowledge Base · User Operations

Selection criteria: Platform already has coding/operations instances, risk controllable, can quickly verify domain framework.

#### Deliverables

- 4 domains' DomainDescriptor instances (including RiskProfile/KnowledgeSchema/EvalFramework/PromptLibrary/GovernancePolicy)
- 4 domains' Business Packs (at least 2 core Workflows each)
- 4 domains pass §38 four-phase gate (modeling→development→certification→graying-out)
- Domain-level evaluation baseline and regression dataset

#### Acceptance Gate

- [ ] All 4 domains reach GA state
- [ ] Each domain eval all quality axes meet acceptance_threshold
- [ ] Domain-level SLO achievement rate ≥ 95%
- [ ] Cross-domain interaction policy verification passed (code development↔data processing)

### Phase 9b: Medium Priority Domains (8 weeks) — Quantitative Trading · Financial Services · E-commerce · Advertising

Selection criteria: High business value, Critical risk domains need stricter certification.

#### Deliverables

- 4 domains' DomainDescriptor instances (including domain-specific risk control rules and compliance mapping)
- Trading/Compliance prototype template verification
- Quantitative trading domain ultra-low latency path verification
- Financial services domain regulatory report Agent end-to-end verification

#### Acceptance Gate

- [ ] All 4 domains reach GA state
- [ ] Critical risk domains (quantitative trading/financial services) HITL coverage 100%
- [ ] Quantitative trading domain execution path latency < 10ms (excluding LLM)
- [ ] Financial services domain AML/KYC compliance check passes

### Phase 9c: Refinement Domains (8 weeks) — Industry Research · Academic Research · Finance · Legal

Selection criteria: High HITL requirement, regulation-intensive, need lawyer/auditor participation verification.

#### Deliverables

- 4 domains' DomainDescriptor instances
- Research/Adversarial prototype template verification
- Legal domain lawyer review workflow end-to-end verification
- Finance domain SOX compliance audit trail verification

#### Acceptance Gate

- [ ] All 4 domains reach GA state
- [ ] Legal domain all output 100% reviewed by lawyer
- [ ] Finance domain audit trail integrity check passes
- [ ] Academic research domain citation accuracy 100% (zero fabrication)
- [ ] First 12 domains all running online, cross-domain interaction matrix verification passed

### Phase 9d: High Priority New Domains (8 weeks) — Customer Service · IT Operations SRE/DevOps · Content Moderation and Security · Online Live Streaming

Selection criteria: Operations essential, real-time requirement high, mature tool ecosystem available for integration.

#### Deliverables

- 4 domains' DomainDescriptor instances (including RiskProfile/KnowledgeSchema/EvalFramework/PromptLibrary/GovernancePolicy)
- Customer service domain multi-turn dialogue closed loop end-to-end verification
- IT operations domain alert→diagnose→fix automation chain verification
- Content moderation domain CSAM immediate report compliance process verification
- Online live streaming domain real-time stream moderation latency < 2s verification

#### Acceptance Gate

- [ ] All 4 domains reach GA state
- [ ] Customer service domain first resolution rate ≥ 70%, CSAT ≥ 4.0
- [ ] IT operations domain MTTR reduce ≥ 30% (compared to manual baseline)
- [ ] Content moderation domain violation content recall rate ≥ 99.5%, CSAM 100% immediate report
- [ ] Online live streaming domain real-time stream moderation end-to-end latency < 2s

### Phase 9e: Medium Priority New Domains (8 weeks) — Healthcare · Human Resources · Supply Chain and Logistics · Education and Training

Selection criteria: High compliance requirement, strong HITL domain, need domain expert deep participation certification.

#### Deliverables

- 4 domains' DomainDescriptor instances (including domain-specific compliance mapping and approval workflow)
- Healthcare domain practicing doctor review workflow end-to-end verification
- Human resources domain recruitment bias audit passes
- Supply chain domain demand forecast→scheduling→exception handling chain verification
- Education and training domain personalized learning path recommendation verification

#### Acceptance Gate

- [ ] All 4 domains reach GA state
- [ ] Healthcare domain all diagnosis suggestions 100% reviewed by practicing doctor
- [ ] Human resources domain recruitment process bias audit passes (Adverse Impact Ratio ≥ 0.8)
- [ ] Supply chain domain demand forecast accuracy ≥ 85% (MAPE ≤ 15%)
- [ ] Education and training domain learning effect improvement ≥ 15% (compared to baseline)

### Phase 9f: Refinement New Domains (8 weeks) — Ad Creative Production · Game Development · Game Publishing · Marketing and Brand

Selection criteria: Creative-intensive, complex release process, need multi-party collaboration verification.

#### Deliverables

- 4 domains' DomainDescriptor instances
- Ad creative domain multimodal generation→compliance review→iteration chain verification
- Game development domain code generation→test→performance verification chain verification
- Game publishing domain multi-platform compliance check→submission→monitoring chain verification
- Marketing domain Campaign orchestration→delivery→effect analysis closed loop verification

#### Acceptance Gate

- [ ] All 4 domains reach GA state
- [ ] Ad creative domain creative compliance pass rate ≥ 95% (first submission)
- [ ] Game development domain code generation compile pass rate ≥ 90%
- [ ] Game publishing domain multi-platform compliance first-pass rate ≥ 85%
- [ ] All 24 domains running online, cross-domain interaction matrix 24×24 verification passed

### Dependencies

Phase 9a depends on Phase 5 + Phase 8c completion. Phase 9a→9b→9c→9d→9e→9f linear advance, totaling 48 weeks. Phase 9d can start immediately after Phase 9c completion.

## 33.1 Legacy Phase Dependency Graph (Mapping Only)

The following graph only retains historical reference compatibility, not as v4.2 implementation order authority; actual delivery is accepted by §33.0 three rings.

```text
Phase 1 (Steady-State Skeleton)
    │
    ▼
Phase 2 (Controlled Automation)
    ├──────────────────────────────┐
    │                              │
    ▼                              ▼
Phase 3 (Enterprise Reliability)    Phase 8a (Unified Runtime Protocol)
    │                              │
    ▼                              ▼
Phase 4 (Scaled Expansion)    Phase 8d (OAPEFLIR-Harness)
    │                              ├──────────────┐
    ▼                              ▼              │
Phase 5 (Intelligent Interaction and Org Governance) ◄─ Phase 8b (Long-Running and Human-Machine)
                                   │
                                   ▼
                          Phase 8c (Governance and Evaluation)
    │                              │
    ├──────────────────────────────┘
    │
    ▼
Phase 6 (Scaling and Ecosystem)
    │
    ▼
Phase 7 (Operational Maturity)
    │
    ▼
Phase 9a (High Priority Domains: Code·Data·Knowledge Base·Operations)
    │
    ▼
Phase 9b (Medium Priority Domains: Quant·Finance·E-commerce·Advertising)
    │
    ▼
Phase 9c (Refinement Domains: Research·Academic·Finance·Legal)
    │
    ▼
Phase 9d (High Priority New Domains: Customer Service·IT Operations·Content Moderation·Live Streaming)
    │
    ▼
Phase 9e (Medium Priority New Domains: Healthcare·HR·Supply Chain·Education)
    │
    ▼
Phase 9f (Refinement New Domains: Creative·Game Dev·Game Publishing·Marketing)
```

Phase 9a can start from Phase 5 + Phase 8c completion (can advance preparation work in parallel with Phase 6-7). Phase 9a→9b→9c→9d→9e→9f linear advance, totaling 48 weeks.

## 33.2 Production Minimum Closure

To ensure platform can be delivered in batches and enter production validation as soon as possible, divide functionality into three delivery batches:

**Batch A — Controllable Runtime Closed Loop** (Phase 1-2 deliver):
P1-P5 plane skeleton · OAPEFLIR/Harness main chain · ConstraintPack · Toolbelt · Evaluator basic decision · Checkpoint/Recovery · Approval/Policy/Audit basic process. After delivery, can run end-to-end tasks in controlled environment.

**Batch B — Enterprise Runtime Closed Loop** (Phase 3-4 deliver):
Async Harness · HITL Runtime · Memory Namespace · Tool Harness governance · Guardrails five layers · Multi-tenant/Org/Compliance · Drift Detection basic. After delivery, can support enterprise multi-team, multi-approval, long-running task scenarios.

**Batch C — Platform Optimization Closed Loop** (Phase 5-8c deliver):
Evaluation Harness (offline evaluation + version comparison) · Replay/Simulation · Cost optimization · Drift auto-repair · PlatformOps Agent · Marketplace. After delivery, platform has self-operations and continuous improvement capability.

Each batch delivery standard: full-link smoke pass · key path E2E test coverage · security scan no P0/P1 · operations manual ready.

---

# 34. ADR Freeze Recommendations

Total 123 ADRs:

ADRs are no longer frozen by "the more the better". v4.2 only freezes decisions that affect runtime contract, state truth, safety governance, and domain compliance boundary; product experience, commercial terms, example implementation, and future capabilities must not enter P0/P1 ADR blocking mainline.

ADR freeze divided into three categories: `MVP-blocking` must be frozen before Ring 1; `Hardening-before-production` must be frozen before real production tenant; `Enterprise-before-scale` must be frozen before multi-Region / Marketplace / 24 domain scaling. Only freezing MVP-blocking does not mean other ADRs can be bypassed, but rather avoiding ADR count reversely blocking minimum production closed loop.

## 34.0 ADR Metadata Template and Priority

Each ADR must include the following fields, ADRs missing runtime/schema/test mapping can only be in `draft`:

```yaml
adr_id:
phase: MVP | Hardening | Enterprise | Future
priority: P0 Runtime | P1 State/Evidence | P2 Safety/Governance | P3 Domain | P4 Product
freeze_class: MVP-blocking | Hardening-before-production | Enterprise-before-scale | Future
status: proposed | accepted | superseded | deprecated
decision:
runtime_contract_ref:
schema_ref:
test_ref:
supersedes:
owner:
review_after:
trigger:
linked_invariant:
linked_test:
```

ADR grouping rules:

| Priority | Freeze Scope | Example |
| --- | --- | --- |
| P0 Runtime | HarnessRun, PlanGraph, NodeRun, SideEffect, Budget, Replay and other unbypassable runtime contracts | Change needs sync schema, API, tests |
| P1 State/Evidence | truth/event/projection/artifact/audit consistency and evidence semantics | Change needs migration + rebuild strategy |
| P2 Safety/Governance | policy, approval, panic, secret, egress, tenant isolation | Change needs denial-path regression |
| P3 Domain | High-risk domain boundary, regulatory evidence, HITL/qualification requirement | Change needs domain owner signoff |
| P4 Product | UI, commercial, recommendation, marketplace experience | Does not block MVP runtime |

**Platform Foundation (19)**:
ADR-Platform-Layering · ADR-Control-Runtime-Intelligence-Separation · ADR-Domain-Onboarding-Model · ADR-Memory-vs-Knowledge-Boundary · ADR-Contracts-as-Single-Source · ADR-State-Machine-Canonical-Map · ADR-Governance-as-First-Class-Plane · ADR-Integration-Through-Adapters-Only · ADR-Reliability-Fabric-as-Crosscutting-System · ADR-Risk-Assessment-Mandatory-Before-High-Risk-Actions · ADR-SideEffect-Two-Phase-Commit-Style · ADR-HumanWait-as-Formal-Executor · ADR-Incident-as-First-Class-Object · ADR-Projection-Rebuild-Mandatory · ADR-Platform-Mode-Switching · ADR-DLQ-Handling-Model · ADR-Egress-Control-Mandatory · ADR-Security-Classification-Policy · ADR-Runtime-Checkpoint-Boundaries

**Plane Communication and Deployment (4)**:

- **ADR-Plane-Communication-Contracts** — Five planes must communicate through formal contract objects
- **ADR-Repository-Abstraction-Layer** — All storage access through Repository interface
- **ADR-Single-Process-First** — Deployment starts from monolith, verify before split
- **ADR-API-Versioning-Strategy** — API versioning and backward compatibility strategy

**AI Operations (9)**:

- **ADR-ModelGateway-As-Single-LLM-Entry** — All LLM calls must go through ModelGateway, prohibit direct call to provider SDK
- **ADR-Prompt-As-Versioned-Resource** — Prompts not inlined in code, managed independently as versioned resources
- **ADR-Quality-Gate-Before-Prompt-Release** — Prompt/Model changes must pass quality gate
- **ADR-Per-Tenant-Cost-Metering** — All LLM cost must be metered by tenant
- **ADR-Delegation-Depth-Limit** — Inter-Agent delegation max depth = 3
- **ADR-Workflow-Hibernation-Model** — Long-time waiting workflow must release worker and persist state
- **ADR-Crypto-Shredding-For-Erasure** — GDPR deletion implemented through crypto-shredding
- **ADR-Pack-Semver-Compatibility** — Pack Manifest API follows semver compatibility contract
- **ADR-LLM-Latency-Excluded-From-Platform-SLO** — LLM latency monitored independently, not counted in platform's own SLO

**Business Domain Onboarding (4)**:

- **ADR-Domain-Descriptor-As-Semantic-Layer** — Each Business Pack must associate DomainDescriptor, domain semantics not embedded in Pack code
- **ADR-Domain-Risk-Override-Over-Platform-Default** — Domain risk profile override takes priority over platform default risk matrix, override needs audit reason
- **ADR-Domain-Recipe-As-Onboarding-Accelerator** — New business domain must start from one of twelve prototype templates, prohibited blank onboarding
- **ADR-Four-Phase-Domain-Onboarding** — Business domain onboarding must pass four-phase gate (modeling→development→certification→graying-out), not allowed to skip

**Intelligent Interaction (6)**:

- **ADR-NL-Intent-Must-Resolve-To-Confirmed-TaskSpec** — Natural language input must go through Intent parsing to generate TaskDraft, after clarification and user confirmation, can form TaskSpec / RequestEnvelope(§5.3), prohibit raw text directly to Agent
- **ADR-Goal-Decomposition-Max-Depth** — Goal decomposition engine recursion depth upper limit = 5, exceeding needs manual confirmation of decomposition plan
- **ADR-Proactive-Agent-Must-Have-Trigger-Policy** — Proactive Agent must bind TriggerPolicy, prohibit unconditional polling
- **ADR-Autonomy-Level-Guarded-Progression** — Progressive autonomy level default monotonically increasing (promotion needs score threshold + approval); demotion only occurs under safety trigger conditions defined in §42.2 (P0 Incident / consecutive failures / cost over limit), after demotion execution must have manual approval confirmation and record reason, recovery path follows promotion rules
- **ADR-Dashboard-Metric-Source-Of-Truth** — Unified operations dashboard data must come from State & Evidence Plane, prohibit direct read of Runtime internal state
- **ADR-No-Code-UX-Maps-To-Standard-API** — Non-technical user interface operation must map to standard Public API, prohibit bypass

**Organizational Governance (6)**:

- **ADR-Org-Hierarchy-As-First-Class-Model** — Organizational hierarchy (enterprise→division→department→team) as first-class model, all resource ownership must associate OrgNode
- **ADR-Approval-Route-From-Org-Chart** — Approval routing must be dynamically derived from organization architecture, prohibit hardcoded approver list
- **ADR-SSO-As-Single-Identity-Source** — Enterprise SSO as single identity source, platform does not maintain independent user password
- **ADR-Compliance-Policy-Inherits-Down** — Compliance policy inherits down along organization tree, child node can only tighten not relax
- **ADR-Knowledge-Boundary-Default-Deny** — Knowledge domain default isolation, cross-department sharing needs explicit authorization and audit log record
- **ADR-Governance-Delegation-Requires-Scope** — Governance delegation must limit scope (resource type + OrgNode range), prohibit global delegation

**Scaling and Ecosystem (6)**:

- **ADR-Multi-Region-Single-Leader-Per-Partition** — Multi-Region adopts single leader write per partition, follower read + async replication + controlled failover, prohibit multi-master truth write
- **ADR-Resource-Contention-Fair-Queue** — Scaled deployment must use weighted fair queue, prohibit simple FIFO causing high priority task starvation
- **ADR-SLA-Tier-Determines-Resource-Allocation** — SLA tier determines resource quota, queue priority, and fault recovery order
- **ADR-Marketplace-Pack-Must-Pass-Certification** — Agent marketplace-listed Pack must pass platform certification (security scan + sandbox test + performance baseline)
- **ADR-Feedback-Loop-Closed-Within-SLA** — User feedback must form closed loop within SLA-defined time window (collect→analyze→improve→verify)
- **ADR-Integration-Through-Unified-Connector** — External system integration must go through unified Connector framework, prohibit business code directly calling external API

**Operational Maturity (11)**:

- **ADR-Every-Decision-Must-Have-Rationale** — OAPEFLIR each stage must generate StageRationale, decision explanation rendered on demand
- **ADR-Platform-Panic-Atomic-Halt** — PlatformPanicDirective must atomically stop whole platform within 5 seconds, recovery needs dual approval
- **ADR-Agent-As-Composite-Entity** — Agent as Pack+Prompt+Model+Trust+Trigger composite entity, with AgentVersion as release and rollback unit
- **ADR-Edge-Runtime-Risk-Ceiling** — Offline EdgeRuntime only allows executing actions with risk_level ≤ medium, high-risk actions wait for connection restore
- **ADR-Behavior-Fingerprint-Mandatory** — Each Agent must maintain BehaviorFingerprint, drift detection covers 1h/7d/30d/90d four windows
- **ADR-Cost-Attribution-Per-Decision** — Cost attribution must be precise to decision level (single LLM call), optimization suggestion must attach quality_risk assessment
- **ADR-Workflow-Debug-Session-Isolated** — Debug session runs in isolated sandbox, breakpoint pause does not affect other workflows
- **ADR-Compliance-Report-Template-Versioned** — Compliance report template must be versioned, lock template version when report generated
- **ADR-Capacity-Forecast-Drives-Scaling** — Capacity forecast result must associate with expansion suggestion, expansion suggestion must attach cost impact estimate
- **ADR-Multimodal-Safety-Check-Before-Output** — Multimodal output (image/voice) must pass content safety check before delivery to user
- **ADR-PlatformOps-Agent-Read-Only-Default** — Platform self-operations Agent default read-only, production write operations must pass manual approval

**Harness Engineering (7)**:

- **ADR-Harness-As-First-Class-Runtime** — Harness Runtime as first-class architecture object, all task execution must go through HarnessRuntime.run() entry, prohibit bypassing Harness to directly call P4
- **ADR-ConstraintPack-Per-Run** — Each HarnessRun must carry explicit ConstraintPack, constraint sources merge by platform→tenant→domain→task priority
- **ADR-Planner-Generator-Evaluator-Prompt-Isolation** — Planner/Generator/Evaluator three types of Agents' Prompts must be independently versioned and rolled out, prohibit shared Prompt template
- **ADR-Step-Level-Evaluation-Mandatory** — After each step execution completion must pass Evaluator evaluation, prohibit skipping evaluation to directly advance to next step
- **ADR-Toolbelt-Minimum-Privilege** — Toolbelt assembled by least privilege, only contains tool subset allowed by current task + domain + risk level
- **ADR-ContextSnapshot-Per-Loop** — Each round of Harness loop must save ContextSnapshot to P5 Checkpoint, supporting crash recovery and Replay
- **ADR-Global-Call-Depth-Limit** — Goal decomposition (depth≤5), delegation chain (depth≤3), global call depth hard upper limit = 8; decompose / delegate / subgraph all +1, local upper limits cannot multiply

**Harness Eight Pillars (9)**:

- **ADR-Harness-Eight-Pillar-Model** — Harness upgraded from quintuple to eight pillars (Constraints · Tools · State/Memory · Feedback · Durability · Evaluation Harness · HITL Runtime · Observability/Replay), all pillars must have independent acceptance gate
- **ADR-HarnessRun-As-First-Class-Entity** — HarnessRun as first-class entity, with complete lifecycle (pending→running→paused→completed/failed/aborted), all state transitions must write to audit log
- **ADR-HarnessDecision-Six-Way** — HarnessDecision fixed six decisions (accept/retry_same_plan/replan/escalate_to_human/downgrade_mode/abort), prohibit custom decision types
- **ADR-Evaluation-Harness-Outcome-Over-Transcript** — Evaluation uses final outcome (whether environment state reaches target state) as primary metric, transcript only as auxiliary
- **ADR-Durable-Harness-Pause-Resume** — All async run must support explicit pause/resume, complete serialization to P5 Checkpoint when paused
- **ADR-Memory-Three-Namespace-Isolation** — Working/Long-term/Shared Knowledge three-layer memory must be namespace isolated, cross-layer promotion needs policy review
- **ADR-Tool-Capability-Profile-Mandatory** — Each registered tool must attach Capability Profile, tools without profile prohibited from being assembled by ToolbeltAssembler
- **ADR-HITL-As-Runtime-Primitive** — HITL as Harness native runtime step type (phase=hitl), not only escalation path
- **ADR-Guardrails-Five-Layer** — Guardrails divided into input/planning/tool/memory/output five layers, each layer independent configuration, independent interception, independent audit

**OAPEFLIR-Harness Convergence Runtime Specification (18)**:

- **ADR-OAPEFLIR-Plan-Is-Graph** — Complex task Plan must be PlanGraph, linear steps only as legacy display or single-node degenerate form
- **ADR-OAPEFLIR-Event-Registry-As-Source-Of-Replay** — Event Registry is event fact source for replay, projection rebuild, causal lineage
- **ADR-OAPEFLIR-Deterministic-Graph-Scheduler** — Graph Scheduler decision must be recorded and Trace Replay-able, not dependent on non-reproducible external state
- **ADR-OAPEFLIR-Terminal-State-Immutability** — HarnessRun / NodeRun terminal state cannot be exited, fix can only be expressed as redrive, compensation, or GraphPatch append
- **ADR-OAPEFLIR-Retry-Append-Only-Lineage** — Retry / Redrive must append AttemptLineage, must not overwrite historical attempt
- **ADR-OAPEFLIR-SideEffect-Delivery-Semantics** — All side effects must declare delivery semantics and confirmation mechanism
- **ADR-OAPEFLIR-Reconciliation-For-Ambiguous-External-State** — External state uncertainty must enter Reconciliation, must not be misjudged as success
- **ADR-OAPEFLIR-DecisionInputBundle-Frozen-Before-Decision** — Decision Engine must freeze DecisionInputBundle before decision
- **ADR-OAPEFLIR-Budget-Reservation-Before-LLM-And-Tool** — Must reserve budget before LLM / Tool / SideEffect / Evaluation
- **ADR-OAPEFLIR-ContextAssembly-Per-Role** — Planner / Generator / Evaluator must use independent context assembly contract
- **ADR-OAPEFLIR-Prompt-Role-Isolation** — Planner / Generator / Evaluator Prompt independently versioned, evaluated, and released
- **ADR-OAPEFLIR-Memory-Write-Governance** — Long-term memory and shared knowledge write must go through MemoryWriteGovernance
- **ADR-OAPEFLIR-HITL-Responsibility-Record** — Human approve / override / takeover must record scope and responsibility boundary
- **ADR-OAPEFLIR-Run-Version-Lock** — Each Run freezes Prompt / Policy / Tool / Model / Domain / Eval version when admitted
- **ADR-OAPEFLIR-Learning-Quarantine-Before-Release** — LearningCandidate must be quarantined, evaluated, approved before entering release
- **ADR-OAPEFLIR-Evaluation-Gate-Before-Online-Change** — Prompt / Policy / Tool / Domain improvement must pass EvaluationGate before going online
- **ADR-OAPEFLIR-LLM-Judge-Cannot-Override-Deterministic-Failure** — LLM-as-Judge cannot override policy rejection, security violation, budget exhaustion, state machine illegal and other deterministic failures
- **ADR-OAPEFLIR-Replay-Never-Produces-Real-SideEffect** — Replay / Simulation must never produce real external side effect

**Vertical Business Domain Deepening (24)**:

- **ADR-Domain-Recipe-Twelve-Archetypes** — DomainRecipe extended from eight to twelve prototypes (CRUD-heavy/Analytics/Creative/Realtime/Trading/Compliance/Research/Adversarial/Moderation/Logistics/Conversational/IncidentOps), covering 24 vertical domain workflow patterns
- **ADR-Quant-Trading-Pre-Trade-Risk-Mandatory** — Quantitative trading domain all orders must pass pre-trade risk check, risk check latency must not >50μs, hard position/loss limit cannot be overridden by Agent
- **ADR-Financial-Services-Explainable-Decisions** — Financial services domain all adverse credit decisions must attach explainable rejection reason, complying with fair lending regulations
- **ADR-Legal-Output-Attorney-Review-Mandatory** — Legal domain all Agent output must be reviewed by practicing lawyer before being sent out or acted upon, Agent only provides "legal information" not "legal opinion"
- **ADR-Finance-Accounting-Segregation-Of-Duties** — Finance domain must enforce segregation of duties (creator≠approver), complying with SOX internal control requirements
- **ADR-Ecommerce-Price-Change-Guardrail** — E-commerce domain price change exceeding current price X% must trigger manual approval, preventing mispricing
- **ADR-Academic-Research-Zero-Citation-Fabrication** — Academic research domain every citation must be resolvable to real paper (DOI/database verification), zero fabrication tolerance
- **ADR-Knowledge-Base-Source-Permission-Mirroring** — Enterprise knowledge base domain must mirror source system document-level permission, execute real-time access check at query
- **ADR-Advertising-Budget-Hard-Cap** — Advertising domain must have platform-level hard daily/hourly budget upper limit, bidding errors cannot break through upper limit
- **ADR-Data-Engineering-Schema-Migration-Approval** — Data processing domain destructive Schema change must pass manual approval, auto assess downstream impact
- **ADR-User-Operations-Frequency-Cap-Mandatory** — User operations domain all message reach must execute frequency upper limit, preventing notification fatigue
- **ADR-Domain-Latency-Tier-Classification** — Each domain must declare latency tier (ultra-low latency/real-time/near real-time/batch), platform allocates resources and scheduling strategy accordingly
- **ADR-Healthcare-Physician-Review-Mandatory** — Healthcare domain all diagnosis suggestions must be reviewed by practicing doctor before presented to patient, Agent only provides "medical information" not "medical opinion"
- **ADR-Content-Moderation-CSAM-Immediate-Report** — Content moderation domain upon detecting CSAM content must report to designated agency within 1 minute, zero tolerance zero delay
- **ADR-HR-Bias-Audit-Mandatory** — Human resources domain recruitment/promotion decision must pass bias audit (Adverse Impact Ratio ≥ 0.8), prohibit automated decision without audit
- **ADR-Supply-Chain-Forecast-Approval-Before-Procurement** — Supply chain domain large purchase orders must be based on approved demand forecast, prohibit Agent from triggering over-threshold purchase on own
- **ADR-Live-Streaming-Realtime-Moderation-SLA** — Online live streaming domain real-time stream moderation latency must be < 2s, violation content must execute takedown/stream cut within 5s after detection
- **ADR-Game-Publishing-Multi-Platform-Compliance** — Game publishing domain each target platform must independently pass compliance check (age rating/content review/payment compliance), prohibit cross-platform reuse of review result
- **ADR-Customer-Service-Escalation-Timeout** — Customer service domain Agent cannot solve problem within 3 rounds of dialogue must auto transfer to manual agent, prohibit infinite loop
- **ADR-IT-Operations-Blast-Radius-Limit** — IT operations domain auto-repair operation blast radius limited to single node/single service, cross-domain operation must pass manual approval
- **ADR-Education-Minor-Data-Protection** — Education and training domain involving minor data must follow COPPA/Minor Protection Law, data collection minimized and needs guardian consent
- **ADR-Creative-Production-IP-Verification** — Ad creative production domain all AI-generated content must pass copyright/trademark infringement check, prohibit using unauthorized creative
- **ADR-Game-Dev-IP-Similarity-Check** — Game development domain AI-generated art assets must pass known IP similarity detection, preventing copyright infringement
- **ADR-Marketing-Brand-Consistency-Check** — Marketing domain all external content must pass brand tone consistency check and advertising law compliance detection

---

# 35. Recommended Code Directory

Directory tree is target-state index, not one-time scaffold checklist. MVP only creates directories actually needed for delivery, avoiding 24 domains and future modules producing empty shells.

MVP directory subset:

```text
src/platform/contracts
src/platform/five-plane-orchestration/harness
src/platform/five-plane-orchestration/harness/runtime
src/platform/five-plane-orchestration/harness/eval-harness
src/platform/five-plane-orchestration/harness/durable
src/platform/five-plane-orchestration/harness/hitl-runtime
src/platform/execution
src/platform/state-evidence
src/platform/control-plane
src/platform/model-gateway
src/domains/registry
src/domains/business-pack
src/packs/core
tests/invariants
tests/contracts
tests/replay
tests/side_effects
tests/budget
```

Hardening incremental directories only created when corresponding capability enters implementation:

```text
src/platform/incident
src/platform/projections
src/platform/config-center
src/org-governance
src/interaction
tests/dlq
tests/projection_rebuild
tests/org_governance
```

Enterprise incremental directories only created when scaling capability enters implementation:

```text
src/scale-ecosystem
src/ops-maturity
src/domains/<domain>
tests/multi_region
tests/marketplace
tests/edge_runtime
```

24 vertical domain directories created according to productization onboarding rhythm; domains not entering pilot only retain documentation specification and DomainDescriptor example, do not create empty implementation directories.

```text
src/
  apps/                # Application-level entry and aggregation
  benchmarks/          # Benchmark testing and performance experiments
  core/                # Universal runtime abstraction/compatibility layer
  platform/
    interface/          # P1
      api/
      webhook/
      scheduler/
      console-backend/
      ingress/

    control-plane/      # P2
      tenant/
      iam/
      policy-center/
      approval-center/
      rollout-controller/
      incident-control/
      replay-repair-control/
      config-center/
      audit-export/
      shared/

    orchestration/      # P3
      oapeflir/          # OAPEFLIR semantic framework and projection adapter (canonical path)
        stage-rationale/
        trace-projection/
        semantic-contracts/
        audit-view/
        harness-adapter/
      planner/
      replan/
      routing/
      escalation/
      hitl/
      agent-delegation/
      harness/            # Harness Runtime (P3 only executable runtime subdomain)
        runtime/            # HarnessRuntime main entry
        protocol/           # Harness contract (HarnessRun/HarnessStep/HarnessDecision/PlanBundle/WorkProduct/EvaluationReport/FeedbackEnvelope)
        planner/            # Planner Agent implementation
        generator/          # Generator Agent implementation
        evaluator/          # Evaluator Agent implementation
        eval-harness/       # Evaluation Harness (pre-release evaluation/version comparison/TaskOutcomeGrader)
        loop/               # HarnessLoopController
        context/            # ContextAssembler + ContextSnapshot
        memory-namespace/   # Working/Long-term/Shared Knowledge three-layer memory + MemoryPromotionPolicy
        constraints/        # ConstraintEngine + ConstraintPack assembly
        guardrails/         # Five-layer Guardrails (input/planning/tool/memory/output)
        toolbelt/           # ToolbeltAssembler + tool reliability profile
        hitl-runtime/       # HITL Runtime (inspect/patch/override/takeover/resume)
        durable/            # Durable Harness (pause/resume/checkpoint strategy)
        async/              # Async Harness (create_run/poll/subscribe/intervene)
        recovery/           # Harness Recovery Controller
        runtime/plan-graph-harness-runtime.ts # PlanGraph / scheduler / NodeRun MVP runtime
        runtime/intake-admission-service.ts   # RequestEnvelope admission
        runtime/runtime-entry-guard.ts        # legacy bypass guard

    oapeflir/           # deprecated re-export barrel (if exists, only forward to orchestration/oapeflir)
      index.ts

    execution/          # P4
      dispatcher/
      execution-engine/
      worker-pool/
      tool-executor/
      plugin-executor/
      adapter-executor/
      browser-executor/
      human-wait-executor/
      recovery/
      # Note: scheduler under interface/scheduler/

    state-evidence/     # P5
      truth/
      events/
      projections/
      artifacts/
      memory/
      knowledge/
      audit/
      incident/        # (planned)
      checkpoints/     # (planned)
      dlq/             # (planned)

    shared/             # X1 cross-cutting fabric (observability, cache, event bus, reliability)
    cost-management/    # Cost governance and budget guardrail
    prompt-registry/    # Prompt resource registry compatibility layer
    stability/          # Stability/degradation/fault tolerance strategy

    model-gateway/      # LLM abstraction layer
      provider-registry/
      router/
      cache/
      cost-tracker/
      fallback/

    prompt-engine/      # Prompt management
      registry/
      renderer/
      rollout/
      eval/

    compliance/         # Compliance and data governance
      crypto-shredding/
      data-residency/  # (planned)
      erasure/          # (planned)
      encryption/       # (planned)
      lineage/          # (planned)

    contracts/          # Inter-plane contracts
      request-envelope/
      control-directive/
      execution-plan/
      execution-receipt/
      state-command/
      delegation-request/
      model-request/

  domains/                # Business domain modeling
    registry/             # DomainDescriptor registration and lifecycle
    risk-profile/         # DomainRiskProfile domain risk profile
    knowledge-schema/     # DomainKnowledgeSchema domain knowledge structure
    eval-framework/       # DomainEvalFramework domain evaluation
    prompt-library/       # DomainPromptLibrary domain Prompt library
    recipes/              # DomainRecipe prototype template
    interaction-policy/   # DomainInteractionPolicy cross-domain policy
    governance/           # DomainGovernancePolicy domain governance
    coding/               # Code R&D domain instance
    operations/           # General operations domain instance (distinguished from it-operations SRE/DevOps specialized domain)
    quant-trading/        # Quantitative trading domain instance (§71)
    ecommerce/            # E-commerce domain instance (§72)
    advertising/          # Advertising promotion domain instance (§73)
    financial-services/   # Financial services domain instance (§74)
    data-engineering/     # Data processing domain instance (§75)
    user-operations/      # User operations domain instance (§77)
    industry-research/    # Industry research domain instance (§78)
    academic-research/    # Academic research domain instance (§79)
    knowledge-base/       # Enterprise knowledge base domain instance (§80)
    finance-accounting/   # Finance domain instance (§81)
    legal/                # Legal domain instance (§82)
    live-streaming/       # Online live streaming domain instance (§83)
    creative-production/  # Ad creative production domain instance (§84)
    game-dev/             # Game development domain instance (§85)
    game-publishing/      # Game publishing domain instance (§86)
    human-resources/      # Human resources domain instance (§87)
    supply-chain/         # Supply chain and logistics domain instance (§88)
    healthcare/           # Healthcare domain instance (§89)
    education/            # Education and training domain instance (§90)
    customer-service/     # Customer service domain instance (§91)
    content-moderation/   # Content moderation and security domain instance (§92)
    it-operations/        # IT operations SRE/DevOps domain instance (§93)
    marketing/            # Marketing and brand domain instance (§94)
    agriculture/          # Incubation domain: agriculture
    executive-assistant/  # Incubation domain: executive assistant
    facilities/           # Incubation domain: facilities/park
    manufacturing/        # Incubation domain: manufacturing
    product-management/   # Incubation domain: product management
    project-management/   # Incubation domain: project management
    quality-assurance/    # Incubation domain: quality assurance
    business-pack/        # Meta-domain: Business Pack runtime model
    canonical-meta-model/ # Meta-domain: normalized meta-model
    roadmap/              # Roadmap and implementation choreography

  interaction/            # Intelligent interaction layer
    nl-gateway/           # Natural language task entry
      intent-parser/
      slot-resolver/
      ambiguity-handler/
    goal-decomposer/      # Goal decomposition engine
      planner/
      dependency-graph/
      validator/
    proactive-agent/      # Proactive Agent framework
      trigger-engine/
      schedule-manager/
      event-watcher/
    autonomy/             # Progressive autonomy
      trust-scorer/
      level-manager/
      promotion-engine/
    dashboard/            # Unified operations dashboard
      metric-aggregator/
      health-scorer/
      alert-router/
    ux/                   # Non-technical user experience
      wizard/
      template-engine/
      onboarding/

  org-governance/         # Organizational governance layer
    org-model/            # Organizational hierarchy model
      hierarchy/
      org-node/
      sync/
    approval-routing/     # Organizational architecture approval routing
      route-engine/
      escalation/
      delegation/
    sso-scim/             # SSO/SCIM integration
      saml/
      oidc/
      scim-sync/
    compliance-engine/    # Department compliance policy engine
      policy-resolver/
      inheritance/
      audit-enforcer/
    knowledge-boundary/   # Knowledge domain isolation and controlled sharing
      boundary-manager/
      sharing-gate/
      access-log/
    delegated-governance/ # Tiered governance delegation
      scope-manager/
      delegation-registry/

  scale-ecosystem/        # Scaled runtime layer + ecosystem layer
    multi-region/         # Multi-Region deployment
      region-router/
      data-replicator/
      failover-controller/
    resource-manager/     # Resource contention management
      fair-queue/
      quota-enforcer/
      preemption/
    sla-engine/           # SLA tiered assurance
      tier-resolver/
      resource-allocator/
      breach-detector/
    marketplace/          # Agent marketplace and ecosystem
      catalog/
      certification/
      publisher/
    feedback-loop/        # Feedback-driven continuous improvement
      collector/
      analyzer/
      improvement-tracker/
    integration/          # External system integration framework
      connector-registry/
      connector-runtime/
      health-monitor/

  ops-maturity/           # Operational maturity layer
    explainability/       # Agent explainability
      evidence-collector/
      causal-chain-builder/
      explanation-renderer/
      explanation-cache/
    emergency/            # Emergency brake
      panic-controller/
      forensic-snapshot/
      resume-protocol/
    agent-lifecycle/      # Agent unified lifecycle
      agent-registry/
      version-manager/
      canary-controller/
      retirement/
    edge-runtime/         # Offline and edge deployment
      edge-orchestrator/
      edge-executor/
      local-model/
      sync-queue/
    drift-detection/      # Behavior drift detection
      fingerprint-builder/
      changepoint-detector/
      cross-agent-analyzer/
    cost-optimizer/       # Cost attribution and optimization
      attribution-engine/
      recommendation-engine/
      simulator/
    workflow-debugger/    # Visual debugger
      timeline-renderer/
      breakpoint-manager/
      run-comparator/
    compliance-reporter/  # Compliance report engine
      template-registry/
      evidence-mapper/
      report-renderer/
    capacity-planner/     # Capacity planning
      trend-analyzer/
      forecaster/
      simulator/
    multimodal/           # Multimodal capability
      image-processor/
      speech-processor/
      document-parser/
      modality-router/
    platform-ops-agent/   # Platform self-operations Agent
      incident-diagnoser/
      config-optimizer/
      capacity-predictor/
      dev-assistant/
      health-monitor/

  plugins/
    adapters/
    retrievers/
    planners/
    evaluators/
    presenters/

  sdk/                  # SDK
    pack-sdk/
    plugin-sdk/
    client-sdk/
    cli/

  apps/
    api/
    console/
    workers/
  testing/
  types/
```

Supplementary notes:

- `src/platform/five-plane-orchestration/harness/` is the canonical implementation path of P3 Harness Runtime, carrying HarnessRun, PlanGraph, NodeRun, Budget, SideEffect, Replay and other production semantics; new Harness runtime implementation must not be written to `src/platform/harness/`.
- `src/platform/five-plane-orchestration/oapeflir/` is the canonical path for OAPEFLIR semantic framework, StageRationale, TraceProjection, and audit view.
- If `src/platform/oapeflir/` exists, can only be kept as deprecated re-export barrel, new implementation must not be written to this directory.
- `§71-§94` only serves as historical compatibility chapter and example index for **24 productized vertical domains**; executable domain spec entry is based on independent Domain Spec at `docs_zh/domains/<domain>/domain-spec.md`.
- Additional directories in `src/domains/` belong to incubation domains, meta-domains, or platform support directories, not required to correspond one-to-one with `§71-§94`.

---

# 36. Risks, Constraints, and Success Criteria

## 36.1 Main Risks

The following list is risk catalog; when entering implementation backlog must convert to `RiskRegister` record:

```yaml
risk_id:
severity: P0 | P1 | P2 | P3
likelihood: low | medium | high
impact:
owner:
mitigation:
test_or_drill:
status: open | mitigated | accepted | transferred
review_after:
trigger:
linked_invariant:
linked_test:
```

- Model output unstable
- Tool side effect uncontrollable
- Recovery link insufficient causing automation cannot be trusted
- Projection deviation misidentified as truth
- Mis-learning causing behavior drift
- Multi-tenant isolation incomplete
- Pack model not converging causing platform being reverse-invaded by business
- Budget out of control
- Replay / rebuild misoperation amplifying problem
- **PlanGraph validation insufficient causing deadlock, unreachable terminal or missing compensation path**
- **Graph Scheduler non-determinism causing replay and online execution inconsistent**
- **SideEffect ambiguous being misjudged as success causing external state drift**
- **Budget reservation missing causing retry / replan amplifying cost**
- **RunVersionLock missing causing incident replay unable to reproduce**
- **LearningCandidate polluting holdout, PII or secret then going online**
- **LLM provider comprehensively unavailable causing platform paralysis**
- **Prompt change introducing behavior regression**
- **LLM cost out of control (token overspend)**
- **Agent delegation chain recursion out of control**
- **NL Intent parsing ambiguity causing wrong task creation**
- **Goal decomposition recursion too deep causing task explosion**
- **Proactive Agent unlimited trigger forming storm**
- **Progressive autonomy mis-promotion causing high-risk action out of control**
- **Organization architecture change sync delay causing approval routing error**
- **Knowledge isolation configuration error causing cross-department data leak**
- **Governance delegation scope too large causing security degradation**
- **Cross-Region data replication delay causing consistency issue**
- **Resource contention management failure causing high priority task starvation**
- **Marketplace malicious Pack causing security incident after certification**
- **Explanation pipeline LLM call cost out of control (frequent forensic-level explanation)**
- **Emergency brake mis-trigger causing whole platform unplanned stop**
- **Agent composite version graying-out test coverage insufficient causing combination defect escape**
- **EdgeRuntime offline state accumulating large number of side effects, conflict explosion when connection restored**
- **Behavior drift detection false positive causing Agent frequent degradation affecting business**
- **Multimodal content safety check miss causing violation content output**
- **Quantitative trading domain Agent wrong order causing catastrophic financial loss (mispricing)**
- **Financial services domain AML miss detection causing huge regulatory fine**
- **Legal domain Agent output being used as legal opinion (unauthorized practice risk)**
- **E-commerce domain pricing Agent setting extreme low price legally constituting binding force**
- **Academic research domain citation fabrication constituting academic fraud**
- **Finance domain wrong bookkeeping causing financial misstatement and audit failure**
- **Enterprise knowledge base domain permission leak causing confidential document being retrieved by unauthorized user**
- **Advertising domain bidding error causing budget exhausted on low-quality traffic**
- **Healthcare domain Agent output being used as diagnosis opinion causing misdiagnosis/delayed treatment (life safety risk)**
- **Content moderation domain miss detecting CSAM and other illegal content causing criminal responsibility and platform shutdown**
- **Human resources domain recruitment Agent algorithm bias causing systemic discrimination and legal litigation**
- **Online live streaming domain violation content not timely taken down causing regulatory penalty and social public opinion event**
- **Supply chain domain demand forecast severe deviation causing large-scale inventory backlog or stockout**
- **IT operations domain auto-repair operation spreading causing cascade failure (blast radius out of control)**
- **Customer service domain Agent providing wrong information or commitment causing enterprise legal and economic risk**
- **Education and training domain minor data leak causing COPPA/Minor Protection Law violation**
- **Game development domain AI-generated asset infringing existing IP copyright causing legal dispute**
- **Game publishing domain age rating error causing minor exposure to inappropriate content**
- **Marketing domain brand crisis PR mishandling causing irreversible damage to corporate reputation**

## 36.2 Hard Constraints

Hard constraints layered by execution method, avoiding mixing machine verifiable invariants, policy rules, manual processes, and domain compliance into one category:

| Layer | Execution Method | Example |
| --- | --- | --- |
| machine-enforced invariant | Code, schema, state machine, CI auto reject | CAS + Lease + Fencing, Replay does not produce real side effect, terminal state cannot be exited |
| policy-enforced rule | Policy Engine / Approval Engine decision | High-risk action approval, data residency, budget upper limit, egress allowlist |
| human-governed process | Manual signoff, drill, review, incident report | break-glass review, compliance report signoff, lawyer/doctor review |
| domain-specific compliance | Domain specification and regulatory evidence | CSAM report, SOX SoD, PHI isolation, trading hot path without LLM |

- Runtime only consumes published state definition
- Projection does not write back truth
- Learn does not directly drive online change
- Secret does not enter Memory / Knowledge / external Artifact
- All outbound calls go through egress control
- All side effects must be objectified and recorded
- High-risk actions must be approved or explicitly denied
- CAS + Lease + Fencing are hard constraints for write-back
- Inter-plane communication must go through formal contract objects
- **All LLM calls must go through ModelGateway**
- **Prompt changes must pass quality gate**
- **LLM cost must be metered by tenant**
- **Agent delegation depth ≤ 3**
- **PII data deletion implemented through crypto-shredding**
- **NL input must go through Intent parsing to generate TaskDraft, and form TaskSpec / RequestEnvelope(§5.3) after user confirmation, prohibit raw text direct transmission**
- **Goal decomposition recursion depth ≤ 5**
- **Proactive Agent must bind TriggerPolicy**
- **Autonomy level default monotonically increasing; demotion only under §42.2 safety trigger conditions, after execution must have manual approval confirmation**
- **All resource ownership must associate OrgNode**
- **Compliance policy inherits down along organization tree, child node can only tighten**
- **Knowledge domain default isolation, cross-department sharing needs explicit authorization**
- **SSO as single identity source**
- **Each tenant must designate Home Region**
- **Marketplace Pack must pass certification before listing**
- **External system integration must go through unified Connector framework**
- **OAPEFLIR each stage must generate StageRationale**
- **PlatformPanicDirective same Region < 5s, cross-Region < 15s stop whole platform**
- **Agent release and rollback in unit of AgentVersion (composite snapshot)**
- **EdgeRuntime offline mode risk_level ≤ medium**
- **Each Agent must maintain BehaviorFingerprint**
- **Multimodal output must pass content safety check**
- **PlatformOps Agent default read-only, production write operations need manual approval**
- **Quantitative trading domain must have pre-trade risk control check and hard position/loss limit**
- **Financial services domain all adverse credit decisions must be explainable and manually reviewable**
- **Legal domain all Agent output must be reviewed by practicing lawyer before being sent out**
- **Finance domain must enforce segregation of duties (creator≠approver)**
- **E-commerce domain price change over threshold must be manually approved**
- **Academic research domain citation must be resolvable to real paper (zero fabrication tolerance)**
- **Enterprise knowledge base domain must mirror source system document-level permission**
- **Healthcare domain all diagnosis suggestions must be reviewed by practicing doctor, Agent cannot replace medical order**
- **Content moderation domain CSAM detection must report within 1 minute, zero tolerance zero delay**
- **Human resources domain recruitment/promotion decision must pass bias audit (AIR ≥ 0.8)**
- **Online live streaming domain violation content detection must execute takedown/stream cut within 5s**
- **Supply chain domain over-threshold purchase order must be based on approved demand forecast**
- **IT operations domain auto-repair blast radius limited to single node/single service**
- **Customer service domain 3 rounds unresolved must transfer to manual agent**
- **Education and training domain involving minor data needs guardian consent and minimize collection**
- **Game publishing domain each target platform must independently pass compliance check**
- **Ad creative domain AI-generated content must pass copyright/trademark infringement check**
- **Marketing domain external content must pass brand tone consistency check and advertising law compliance detection**
- **Complex task Plan must be PlanGraph, prohibit linear steps direct execution**
- **PlanGraph must pass Normalize / Validate / Risk Propagation / Worst-Path Analysis**
- **Graph Scheduler decision must be Trace Replay-able**
- **All HarnessRun / NodeRun state transitions must be Event-driven**
- **Terminal state HarnessRun / NodeRun cannot be exited**
- **Retry / Redrive must append AttemptLineage, must not overwrite old records**
- **LLM / Tool / SideEffect / Evaluation must reserve budget before**
- **SideEffect ambiguous must not be automatically treated as success**
- **Irreversible side effects must support confirmation / reconciliation / manual review**
- **Replay must not produce real side effects**
- **DecisionInputBundle must be frozen before decision**
- **Planner / Generator / Evaluator must use independent ContextAssemblyContract**
- **Prompt / Policy / Tool / Domain improvement must not bypass EvaluationGate to go online directly**

## 36.3 Success Criteria

All success criteria must be able to map to automated testing, drill records, audit evidence, or manual signoff records; unverifiable description can only serve as goal description, not as gate.

Platform success criteria and domain success criteria separated: platform core only looks at Harness / State / Evidence / Governance runnable closed loop; 24 domains, 12 prototypes, and domain GA count accepted by domain wave, must not reversely block core platform production.

Ring 1 / Ring 2 / Ring 3a / Ring 3b / Ring 3c are the authoritative gate names of this section; old Phase 1-9 only retained as historical mapping. MVP only requires the minimum slice in Ring 1 related to Harness executable closed loop; 24 domains GA belongs to Ring 3c expansion gate, with `N/24 domains GA` as progress indicator, does not block core platform production.

### Phase 1 Success Criteria

- HarnessRun can be stably created and advanced; workflow_run only serves as read-only projection queryable
- Lease timeout auto reclaim
- CAS conflict correctly rejected

### Phase 2 Success Criteria

- HarnessRuntime main chain end-to-end running, OAPEFLIR StageRationale can be generated by event projection
- Worker recovers within 30s after crash
- High-risk actions can be blocked by approval

### Phase 3 Success Criteria

- Incident / replay / repair / DLQ operable
- External dependency circuit breaker→degrade→recovery automation
- Projection rebuildable and data consistent

### Phase 4 Success Criteria

- 50 concurrent workflows stably running
- Load test meets SLO
- DR drill RTO < 10min

### Phase 5 Success Criteria

- Non-technical user can create and manage tasks through natural language
- Goal decomposition engine auto decomposes business goal into executable task graph
- Proactive Agent auto triggers by TriggerPolicy and no storm
- Progressive autonomy Level 0→3 upgrade path end-to-end verified
- Organization three-level hierarchy (enterprise→department→team) correctly drives approval routing
- SSO/SCIM auto sync users and deactivation account takes effect < 5min
- Knowledge domain isolation zero leak, controlled sharing audit complete

### Ring 3a Success Criteria (Historical Phase 6)

- Dual Region single leader / follower read deployment, controlled failover drill passes, single Region failure RTO < 5min
- active-active only used for non-truth cache, telemetry, or aggregate statistics
- 1000 concurrent workflows, high priority tasks not starved
- SLA Tier P0 tasks 99.9% completed within committed time
- Internal Pack Registry at least 3 core Packs pass certification; external Marketplace 20 certified Packs as Enterprise/Future independent gate
- User feedback → improvement closed loop < 7 days
- Pre-built Connector covers all P0 category systems

### Ring 3b Success Criteria (Historical Phase 7)

- User can query explanation for any workflow step, L1 latency < 2s, L3 latency < 10s
- Emergency brake drill: same Region whole platform stop < 5s, recovery < 30min
- AgentVersion composite graying-out release end-to-end verification (canary→active auto promote)
- EdgeRuntime recovers after offline 24h, zero data loss
- Behavior drift detection covers five MVP metrics: success_rate_drop, override_rate_spike, cost_spike, tool_usage_shift, incident_count; advanced statistical thresholds need to declare sample size and false positive handling
- Cost optimization suggestion savings rate ≥ 20% (compared to unoptimized baseline)
- Compliance report SOC2 Type II fully auto-generated, control point coverage ≥ 95%
- Capacity forecast 30-day accuracy ≥ 85%
- Multimodal: image analysis + speech-to-text end-to-end available
- PlatformOps Agent L1 maturity verification: auto diagnostic report generation < 5min

### Ring 1 / Ring 2 Success Criteria (Historical Phase 8)

- Harness Runtime end-to-end runnable: ConstraintPack loading + Planner→Generator→Evaluator closed loop + HarnessDecision ruling
- HarnessRun / HarnessStep all fields persisted and queryable
- Durable Harness 5 pauseReasons all have test coverage
- HITL Runtime 5 intervention modes (inspect/patch/override/takeover/resume) available
- Async Harness sleep/wake end-to-end verified
- Evaluation Harness sandbox evaluation + version comparison report can be generated
- Guardrails five layers all have interception test coverage
- Harness Replay can completely replay completed run
- Ten invariants automated check passes (violation means CI failure)
- Tool Harness Capability Profile covers all registered tools
- Phase 8d acceptance: HarnessRun / NodeRun state machine, PlanGraph, Event Registry, Budget Ledger, SideEffect Reconciliation, EvaluationGate, Runtime Test Matrix all have automated coverage
- Replay verified not to produce real side effect, and Trace Replay can rebuild scheduler decision

### Ring 3c Success Criteria (Historical Phase 9)

- 24 vertical business domains all reach GA state (pass §38 four-phase gate)
- 12 DomainRecipe prototype templates all have at least one domain instance verification passed
- Critical risk domains (quantitative trading/financial services/finance/legal/healthcare) HITL coverage 100%
- Cross-domain interaction matrix 24×24 verification passed, no unauthorized data flow
- Each domain's eval all quality axes meet respective acceptance_threshold
- Quantitative trading domain ultra-low latency path < 10ms (excluding LLM call)
- Legal domain all output 100% reviewed by practicing lawyer before can be sent out
- Academic research domain citation accuracy 100% (zero fabrication)
- Healthcare domain all diagnosis suggestions 100% reviewed by practicing doctor
- Content moderation domain CSAM report 100% completed within 1 minute
- Human resources domain recruitment process bias audit all pass (AIR ≥ 0.8)
- IT operations domain auto-repair MTTR reduce ≥ 30%
- Customer service domain first resolution rate ≥ 70%

---

# Part XI — Conclusion and Appendix

---

# 70. Conclusion

This is not "an Agent platform that automatically does things", but rather:

> **An enterprise operating system that treats Agent as high-risk automation unit for strict control, isolation, recovery, audit, and governance——from one-person company to ten-thousand-person enterprise, with ten-layer architecture covering infrastructure, AI operations, business domain onboarding, vertical business domain deepening, intelligent interaction, Harness engineering, Harness eight-pillar deepening, organizational governance, scaled ecosystem, and operational maturity full-stack capability.**

Its core is not "multi-intelligence", but rather:

- Default conservative
- High-risk must be controlled
- Exceptions must be classified and handled
- Execution must be recoverable
- State must be replayable
- Behavior must be auditable
- Platform must be degradable
- Business must be pluggable but not bypass the base
- **Business domain must be structured understood, not treated as opaque black box**
- **Non-technical user must be able to use directly, without understanding underlying architecture**
- **Organizational governance must adapt to enterprise hierarchy, not assume flat structure**
- **Scaled runtime must have resource fair scheduling and SLA differentiated assurance**
- **Agent decision must be explainable, behavior drift must be detectable**
- **Platform must be able to emergency brake, Agent must have unified lifecycle**
- **Offline/edge scenario must be runnable, disconnected does not mean stop**
- **Multimodal input/output must be incorporated into unified safety control, cannot bypass content review**
- **Agent capability must be engineered——one-off model call must be upgraded to constrained, executable, memorable, feedback-able, recoverable, evaluable, intervenable, observable Harness eight-pillar closed-loop system**
- **OAPEFLIR must be able to land as Harness semantic constraint and audit projection——complex task's cognitive stage, stage reason, risk propagation, reconciliation explanation and learning release governance must be derivable from HarnessRun / PlanGraph / Event Registry, not form second set of execution runtime**
- **Business domain must be described with unified meta-model (§37.11)——15-question template ensures 24 domain structure consistent, configuration driven, new domain can be templated onboarded**
- **Multi-Agent collaboration must follow mandatory protocol (§19.5)——permission not expanded, risk not elevated, constraint not bypassed, audit not broken**
- **Implementation must advance in rings——survival ring to protect bottom, usability ring to pilot, expansion ring to scale, avoiding all-encompassing leading to none landing**

v4.3 success is not one-time coverage of all domains, all marketplace capabilities, and all operational maturity, but first form stable Harness + State + Evidence + Governance minimum closed loop; only when this closed loop is testable, auditable, recoverable, do 24 domain and ecosystem expansion have safety foundation.

### Ten-Layer Architecture Overview

| Layer                  | Problem Solved                    | Core Section                | Document Part  |
| --------------------- | --------------------------- | ----------------------- | --------- |
| Infrastructure Layer            | How to build the platform                  | §4-§14, §24-§32         | Part I    |
| AI Operations Layer             | How to operate AI                 | §15-§23                 | Part II   |
| Business Domain Onboarding Layer          | How to onboard business                  | §37-§38                 | Part III  |
| **Vertical Business Domain Deepening Layer**  | **How to deepen 24 vertical domains** | **§71-§94**             | Part IV   |
| Intelligent Interaction Layer            | How users use it                  | §39-§44                 | Part V    |
| Harness Engineering Layer      | How to converge capabilities                | §45.1-45.12, §58.1-58.5 | Part VI   |
| Harness Eight-Pillar Deepening Layer  | How to deepen capabilities                | §45.13-45.21, §58.6     | Part VI   |
| Organizational Governance Layer            | How to manage organization                  | §46-§51                 | Part VII  |
| Scaled Runtime Layer + Ecosystem Layer | How to handle scale + how to build ecosystem     | §52-§57                 | Part VIII |
| Operational Maturity Layer          | How to use well + how to run safely     | §59-§69                 | Part IX   |

### Harness Eight-Pillar Capability Summary

| Question                     | Before                                                                | Now                                                                |
| ------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------- |
| Harness definition model?       | Quintuple (Constraints+Tools+Context+Feedback+Recovery) | Eight pillars (+Durability+Evaluation Harness+HITL Runtime+Observability) |
| Does run and step have first-class contract? | Only HarnessRunRequest                                  | §45.13 HarnessRun/HarnessStep complete lifecycle                          |
| Does decision have unified protocol?       | LoopController five outputs                               | §58.6 HarnessDecision six decision standardization                                |
| Offline evaluation capability?           | Only runtime Evaluator                                    | §45.14 Evaluation Harness (pre-release+version comparison+outcome assertion)           |
| How to pause/resume long-running tasks?   | Recovery Controller fault recovery                          | §45.15 Durable Harness (5 pauseReasons + 4 resumeStrategies)    |
| How to layer manage memory?       | HarnessContext four contexts                             | §45.16 Memory Namespace (Working/Long-term/Shared + promotion strategy)      |
| How is tool governed?         | ToolbeltAssembler assembly                                | §45.17 Tool Harness (Capability Profile + lifecycle + trust level)       |
| What level is human-machine collaboration?     | escalate to §21 HITL                                  | §45.18 HITL Runtime (inspect/patch/override/takeover/resume)       |
| How to manage async tasks?       | No explicit async mode                                        | §45.19 Async Harness (create/poll/subscribe/intervene)             |
| Where do guardrails execute?         | Implicit in ConstraintPack                                 | §45.20 Guardrails five layers (input/planning/tool/memory/output)         |
| Are there bottom-line rules?           | Scattered in various ADRs                                          | §45.21 ten invariants                                                   |
| Is OAPEFLIR executable?    | Controlled cognitive process                                          | Not as independent execution runtime; execution authority is HarnessRuntime, OAPEFLIR only provides StageRationale / TraceProjection / Audit View |
| What if side effect state is uncertain? | Tool success treated as complete                                    | SideEffect Manager + Reconciliation + Compensation, ambiguous not treated as success |

Only when simultaneously possessing **infrastructure layer's stability**, **AI operations layer's controllability**, **business domain onboarding layer's structured-ness**, **vertical business domain deepening layer's domain specialization**, **intelligent interaction layer's ease-of-use**, **Harness engineering layer's standardization**, **Harness eight-pillar deepening layer's deepening**, **organizational governance layer's adaptability**, **scaled runtime layer's scalability**, and **operational maturity layer's producibility**, can enterprise upgrade Agent platform from architecture design to truly covering one-person company to ten-thousand-person enterprise, 24 vertical business line enterprise-grade productivity operating system.

---

# Appendix G: Glossary and Abbreviation Index

Term governance status:

| term | status | canonical_term | runtime_entity | owner_section |
| --- | --- | --- | --- | --- |
| PlanGraphBundle | canonical | PlanGraphBundle | true | §5 / §13 |
| PlanGraph | canonical | PlanGraph | true | §13 |
| NodeRun | canonical | NodeRun | true | §14 |
| NodeAttempt | canonical | NodeAttempt | true | §14 |
| HarnessStep | semantic_projection | NodeRun for execution | false | §14 / §45 |
| PlanBundle | alias | PlanGraphBundle for execution; PlanBundle only for product/debug wrapper | false | §45 |
| ExecutionPlan | deprecated | PlanGraphBundle | false | §5 |
| ControlDirective | deprecated | OperationalDirective / DecisionDirective | false | §5 |
| workflow step | deprecated | HarnessStep projection or NodeRun depending context | false | §14 |

New schema, API, events, and code directories must not add deprecated terms; can only appear in compatibility adapters, migration scripts, historical ADRs, and glossaries.

| Abbreviation/Term                | Full Name                                                       | Description                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| OAPEFLIR                 | Observe-Assess-Plan-Execute-Feedback-Learn-Improve-Release | Eight stages of Agent core loop(§13)                                                                                                                       |
| PlanGraph                | Harness Plan Graph                                         | Graph structure plan model of HarnessRun plannerOutput, also projection view of OAPEFLIR Plan stage, replacing linear steps in complex tasks(§13.7)                                      |
| Graph Scheduler          | Deterministic Graph Scheduler                              | Deterministic graph scheduler based on ready node, scheduling decision written as event and Trace Replay-able(§14.9)                                                                            |
| GraphPatch               | PlanGraph Patch                                            | Controlled append-only change to running or paused PlanGraph(§13.13)                                                                                                  |
| Event Registry           | Platform + OAPEFLIR Event Registry                         | platform.* and oapeflir.* event type, payload, replay behavior and projection consumption rule registry(§28)                                                            |
| AttemptLineage           | Attempt Lineage                                            | Append-only execution lineage of retry / redrive(§14.14)                                                                                                             |
| Budget Ledger            | Runtime Budget Ledger                                      | Runtime ledger of budget reservation, consumption, release, and exhaustion(§25.9)                                                                                                          |
| SideEffect Delivery Semantics | SideEffect Delivery Semantics                        | Side effect at-most-once / at-least-once / effectively-once and confirmation/reconciliation semantics(§14.11)                                                                       |
| Reconciliation           | Reconciliation State Machine                               | Reconciliation mechanism when external side effect state is uncertain(§14.12)                                                                                                             |
| ContextAssemblyContract  | Context Assembly Contract                                  | Context assembly contract for Planner / Generator / Evaluator(§45.23)                                                                                        |
| PromptExecutionContract  | Prompt Execution Contract                                  | Execution contract for Prompt role, version, context taint, output schema(§45.24)                                                                                      |
| DecisionInputBundle      | Decision Input Bundle                                      | Unified decision input after DecisionEngine freezes(§45.25)                                                                                                          |
| HumanResponsibilityRecord | Human Responsibility Record                               | Responsibility boundary record after human approval, override, takeover(§45.27)                                                                                                         |
| EvaluationGate           | Evaluation Gate                                            | Pre-release quality, cost, security, regression gate(§45.14, §58.10)                                                                                                     |
| LearningCandidate        | Learning Candidate                                         | Candidate experience object generated by Learn stage, needs quarantine, evaluation, approval before going online(§13.14)                                                                                   |
| HITL                     | Human-In-The-Loop                                          | Human-machine collaboration mode, human participates in Agent decision chain(§21)                                                                                                            |
| DLQ                      | Dead Letter Queue                                          | Dead letter queue, temporary storage area for unprocessable messages/events(§28.8)                                                                                                        |
| CAS                      | Compare-And-Swap                                           | Optimistic concurrency control primitive, for StateMutationCommand idempotent write(§5.4)                                                                                          |
| SLO / SLA                | Service Level Objective / Agreement                        | Service level objective/agreement(§27, §54)                                                                                                                         |
| SEV1-4                   | Severity 1-4                                               | Event severity level (1 highest)(§12)                                                                                                                         |
| TTFT                     | Time To First Token                                        | First token arrival latency in LLM streaming response(§27.7)                                                                                                              |
| SCC                      | Standard Contractual Clauses                               | GDPR standard contract clauses, cross-border data transfer legal mechanism(§52.4)                                                                                                      |
| BCR                      | Binding Corporate Rules                                    | Binding corporate rules, intra-group cross-border data transfer mechanism(§52.4)                                                                                                       |
| DPIA                     | Data Protection Impact Assessment                          | Data protection impact assessment(§52.4)                                                                                                                             |
| PIPL                     | Personal Information Protection Law                        | China Personal Information Protection Law(§52)                                                                                                                             |
| WCAG                     | Web Content Accessibility Guidelines                       | Accessibility guidelines(§44.6)                                                                                                                               |
| SCIM                     | System for Cross-domain Identity Management                | Cross-domain identity management protocol(§48)                                                                                                                               |
| SSO                      | Single Sign-On                                             | Single sign-on(§48)                                                                                                                                       |
| RBAC                     | Role-Based Access Control                                  | Role-based access control(§11)                                                                                                                             |
| DAG                      | Directed Acyclic Graph                                     | Directed acyclic graph, for goal decomposition and task dependency(§40)                                                                                                             |
| Pack                     | Business Pack                                              | Business domain capability package, Agent's deployable unit(§30)                                                                                                               |
| UoW                      | Unit of Work                                               | Unit of work, atomic boundary for transactional operations                                                                                                                      |
| WAL                      | Write-Ahead Log                                            | Write-ahead log, persistence mechanism for crash recovery(§31)                                                                                                             |
| P1-P5                    | Plane 1-5                                                  | Five-plane architecture (Interface·Control·Orchestration·Execution·State & Evidence)(§4)                                                                        |
| X1                       | Cross-cutting Fabric                                       | Cross-cutting concerns (Reliability·Governance·Intelligence)(§4)                                                                                               |
| NL                       | Natural Language                                           | Natural language(§39)                                                                                                                                       |
| sLLM                     | Small LLM                                                  | Small localized language model, for edge/offline scenarios(§62)                                                                                                          |
| RTO / RPO                | Recovery Time / Point Objective                            | Recovery time/point objective(§31)                                                                                                                                |
| Harness                  | Agent Harness Runtime                                      | Eight-pillar runtime (Constraints·Tools·State/Memory·Feedback·Durability·Evaluation·Human-machine·Observability)(§45)                                                                         |
| PlanBundle               | Planner Agent standardized output                                   | Contains goal/taskGraph/budget/riskProfile/successCriteria(§45.8)                                                                                       |
| WorkProduct              | Generator Agent standardized output                                 | Contains nodeRunId/artifacts/observations/telemetry(§45.9)                                                                                              |
| EvaluationReport         | Evaluator Agent standardized output                                 | Contains passed/score/issues/recommendation/confidence(§45.10)                                                                                          |
| FeedbackEnvelope         | Unified feedback envelope                                               | Standardized output of four-segment feedback closed loop (Step/Task/Workflow/System level)(§45.6)                                                                                     |
| ConstraintPack           | Task-level constraint package                                               | Explicit constraint envelope carried by each HarnessRun(§45.3)                                                                                                           |
| Toolbelt                 | Task-level tool set                                               | Tool subset assembled by least privilege principle(§45.4)                                                                                                                 |
| HarnessRun               | Harness run entity                                           | First-class entity of one complete Harness task run, with lifecycle and audit(§45.13)                                                                                       |
| HarnessStep              | Harness step entity                                           | Single execution step contract, contains phase/role/inputs/outputs/rationale(§45.13)                                                                                    |
| HarnessDecision          | Harness unified decision                                           | Six decisions: accept/retry/replan/escalate/downgrade/abort(§58.6)                                                                                       |
| Evaluation Harness       | Unified evaluation runtime                                             | Evaluation system of runtime decision+pre-release evaluation+version comparison(§45.14)                                                                                                    |
| Durable Harness          | Durable execution pillar                                               | checkpoint/pause/resume as Harness basic capability(§45.15)                                                                                               |
| Memory Namespace         | Memory namespace                                               | Working/Long-term/Shared Knowledge three-layer isolation and promotion(§45.16)                                                                                           |
| Tool Harness             | Tool governance layer                                                 | Tool Capability Profile + lifecycle + trust level governance(§45.17)                                                                                             |
| HITL Runtime             | Human-machine collaboration runtime                                             | inspect/patch/override/takeover/resume five types of capabilities(§45.18)                                                                                             |
| Async Harness            | Async run mode                                               | Multi-hour/multi-round/multi-approval async Harness execution mode(§45.19)                                                                                                   |
| Guardrails               | Layered guardrails                                                   | input/planning/tool/memory/output five-layer dynamic checkpoint(§45.20)                                                                                            |
| DomainRecipe             | Domain template prototype                                               | Twelve prototypes (CRUD-heavy/Analytics/Creative/Realtime/Trading/Compliance/Research/Adversarial/Moderation/Logistics/Conversational/IncidentOps)(§37.7) |
| Trading Archetype        | Trading prototype                                                   | Signal→risk control→execute→settle workflow pattern(§37.7, §71, §74)                                                                                                      |
| Compliance Archetype     | Compliance prototype                                                   | Monitor→detect→evaluate→report workflow pattern(§37.7, §74, §81, §82)                                                                                                 |
| Research Archetype       | Research prototype                                                   | Collect→analyze→synthesize→publish workflow pattern(§37.7, §78, §79)                                                                                                      |
| Adversarial Archetype    | Adversarial prototype                                                   | Attack surface→defense→audit→fix workflow pattern(§37.7, §76, §82)                                                                                                    |
| FTO                      | Freedom-to-Operate                                         | Freedom-to-operate search, intellectual property domain term(§82)                                                                                                                 |
| SAR/STR                  | Suspicious Activity/Transaction Report                     | Suspicious activity/transaction report, AML legal requirement(§74)                                                                                                              |
| PSI                      | Population Stability Index                                 | Model stability index, financial service model monitoring metric(§74)                                                                                                           |
| VaR/CVaR                 | Value at Risk / Conditional VaR                            | Value at risk/conditional value at risk, quantitative trading risk control metric(§71)                                                                                                        |
| ROAS                     | Return on Ad Spend                                         | Return on ad spend(§73)                                                                                                                                 |
| MRR                      | Mean Reciprocal Rank                                       | Mean reciprocal rank, search quality metric(§80)                                                                                                                     |
| NDCG                     | Normalized Discounted Cumulative Gain                      | Normalized discounted cumulative gain, search ranking metric(§80)                                                                                                               |
| Moderation Archetype     | Moderation prototype                                                   | Content ingest→multimodal detection→handle→appeal workflow pattern(§37.7, §83, §92)                                                                                            |
| Logistics Archetype      | Logistics prototype                                                   | Predict→optimize→schedule→track→exception handling workflow pattern(§37.7, §86, §88)                                                                                             |
| Conversational Archetype | Conversational prototype                                                   | Intent recognition→knowledge retrieval→answer→feedback workflow pattern(§37.7, §89, §90, §91)                                                                                         |
| IncidentOps Archetype    | Incident operations prototype                                               | Alert→diagnose→fix→review→prevent workflow pattern(§37.7, §93)                                                                                                      |
| CSAM                     | Child Sexual Abuse Material                                | Child sexual abuse material, content moderation domain legally mandatory report content(§92)                                                                                                   |
| AIR                      | Adverse Impact Ratio                                       | Adverse impact ratio, HR recruitment fairness metric, compliance requirement ≥ 0.8(§87)                                                                                                |
| MTTR                     | Mean Time To Repair/Resolve                                | Mean time to repair, IT operations core efficiency metric(§93)                                                                                                              |
| MTTD                     | Mean Time To Detect                                        | Mean time to detect, IT operations alert efficiency metric(§93)                                                                                                              |
| FCR                      | First Contact Resolution                                   | First contact resolution rate, customer service core quality metric(§91)                                                                                                               |
| AHT                      | Average Handle Time                                        | Average handle time, customer service efficiency metric(§91)                                                                                                                     |
| COPPA                    | Children's Online Privacy Protection Act                   | US Children's Online Privacy Protection Act(§90)                                                                                                                         |
| SOV                      | Share of Voice                                             | Brand share of voice, marketing effect metric(§94)                                                                                                                 |
| CDM                      | Canonical Domain Meta-Model                                | Unified domain meta-model, 24 domains use same 15-question template to describe(§37.11)                                                                                                 |
| ACP                      | Agent Collaboration Protocol                               | Multi-Agent collaboration protocol, defines 8 message types + 7 non-violation rules(§19.5)                                                                                      |
| Three-Ring Implementation Priority               | Three-Ring Implementation Priority                         | Survival ring→usability ring→expansion ring layered implementation priority(Part X preface)                                                                                                     |

---

# Appendix H: OAPEFLIR v4.4 Executable Spec and v4.2 Convergence Rules

OAPEFLIR v4.4 Executable Spec is the historical input and migration source of v4.2, no longer as direct implementation authority. v4.2's runtime contract takes body text, Executable Runtime Contract, Schema / Zod / OpenAPI / Event Registry as standard; Appendix H is only used to illustrate which body sections v4.4 capabilities have landed in.

Conflict adjudication order:

1. Executable Runtime Contract
2. Schema / Zod / OpenAPI / Event Registry
3. Core Architecture (this document)
4. ADR
5. Domain Spec
6. Example / Appendix / historical spec

Structural conflicts adjudicated by the above order; for security, risk, compliance, and data protection conflicts, the stricter interpretation wins without changing the authority-object ownership.

## H.1 Body Section Anchors

| v4.4 Capability | Main Document Anchor |
| --- | --- |
| Eight-stage responsibility, PlanGraph, GraphPatch, risk propagation, worst path analysis | §13 |
| Graph Scheduler, NodeRun, SideEffect, Reconciliation, Compensation, AttemptLineage | §14 |
| HarnessRun / NodeRun state consistency, Budget Ledger, RunVersionLock | §25 |
| Event Registry, Replay Semantics, Projection, Incident, DLQ | §28 |
| ContextAssemblyContract, PromptExecutionContract, DecisionInputBundle, Memory Governance, HITL Responsibility | §45 |
| Error Code Taxonomy, Runtime Test Matrix | §58 |
| Phase 8d, ADR, code directory, hard constraints, success criteria | §33-§36 |

## H.2 v4.4 Complete Specification Chapter Index

| Specification Chapter | Topic |
| --- | --- |
| 0-3 | Core conclusion, design goal, eight stages, overall runtime architecture |
| 4-5 | HarnessRun converged RunStatus projection, NodeRun state machine |
| 6-13 | PlanGraph, Graph Normalization, Validation, Risk Propagation, Worst-Path, Scheduler, GraphPatch |
| 14-17 | Event Registry, Budget Ledger, SideEffect Manager, Reconciliation State Machine |
| 18-24 | Context Assembly, Prompt Execution, LLM Decision Record, Tool Output Taint, Memory Governance, Guardrails, Decision Engine |
| 25-30 | Runtime Mode, HITL, Final Output, Causal Lineage, Run Version Lock, Effective Policy Snapshot |
| 31-33 | Learning Candidate, Evaluation Harness, Release Pipeline |
| 34-38 | Error Code Taxonomy, Observability Metrics, Incident Rules, Capability Matrix, Runtime Test Matrix |
| 39-42 | Implementation directory, minimum landing roadmap, ADR, final judgment |

## H.3 v4.4 Object Convergence Mapping

v4.4 objects do not directly become v4.2 authoritative implementation objects by original name; the following mapping is used to confirm the contract boundary of "absorbed but renamed/degraded/projected".

| v4.4 Object | v4.2 Converged Object / Status | Main Document Anchor |
| --- | --- | --- |
| OapeflirRun | HarnessRun; old name no longer serves as authoritative run entity | §13, §45.13, §25.9 |
| RunStatus | HarnessRun status + OapeflirTraceProjection stage view | §25.9, §13 |
| NodeRun / NodeRunStatus | NodeRun + NodeAttempt state machine | §14.1, §25.9 |
| AttemptLineage | retry / redrive append-only lineage | §14.14, §28 |
| ObservationBundle / AssessmentBundle | Observation/Assessment projection object, does not own state | §13.2, §13.5 |
| PlanGraphBundle / PlanGraph / PlanNode / PlanEdge | canonical execution contract | §5.3, §13.6-§13.12 |
| GraphNormalizationReport | PlanGraph normalize output | §13.8 |
| GraphValidationReport | PlanGraph validate output | §13.9 |
| GraphRiskPropagationReport | Graph risk propagation output | §13.10 |
| GraphWorstPathAnalysis | Worst path analysis output | §13.11 |
| ReadyNodeSchedulingPolicy | Graph Scheduler policy | §13.12, §14.3 |
| GraphPatch / GraphPatchOperation / GraphPatchCompatibilityReport | Append-only Replan contract | §13.13 |
| OapeflirEvent / OapeflirEventType | `oapeflir.*` projection event; truth can only come from `platform.*` facts | §28.2-§28.4 |
| BudgetLedger / BudgetReservation | Budget ledger and atomic reservation | §18, §25.10 |
| SideEffectRecord / SideEffectType / SideEffectStatus | SideEffect truth + state machine | §14.5, §28 |
| SideEffectExecutionContract / ReversibilityProfile | SideEffect delivery semantics and reversibility profile | §14.5 |
| ReconciliationRecord / ReconciliationStatus | Reconciliation state machine | §14.6 |
| ContextAssemblyContract / ContextItemRef | Role-isolated context assembly contract | §45.23 |
| PromptExecutionContract | Prompt execution contract | §45.24 |
| LlmDecisionRecord / DeterministicRuntimeSeed | LLM recorded output and Trace Replay seed; default replay reuses recorded output | §45.24, §58.4 |
| ToolOutputTaint | Tool output taint label and taint propagation | §45.23, §45.24, §45.26 |
| MemoryWriteRequest | Memory Write Governance input | §45.26 |
| GuardrailHookResult | Five-layer Guardrails hook result | §45.20, §58.10 |
| DecisionInputBundle | Decision Engine frozen input | §45.25 |
| HarnessDecision | Unified decision protocol, including production extended decisions | §58.6 |
| RuntimeProfile / RuntimeMode / AutonomyMode | RuntimeProfile, runtime protection mode, autonomy mode three-way separation | §14.8, §42, §45.3 |
| HitlLock / HitlEscalationPolicy | HITL lock, timeout, escalation policy | §21, §45.18 |
| HumanResponsibilityRecord / HumanDecision | Human responsibility record and DecisionDirective | §45.27, §5.3 |
| FinalOutputContract | Final output / artifact / evidence output contract | §45.9, §59, §68 |
| CausalLineageQuery | lineage / explanation / forensic query capability | §23.6, §28, §59 |
| RunVersionLock | Version frozen at admitted time | §25.10 |
| EffectivePolicySnapshot | Effective policy snapshot | §13.5, §24, §45.25 |
| LearningCandidate / LearningCandidateType | LearningCandidate quarantine / release gate | §13.14, §29.4, §56 |
| EvaluationGate / EvaluationReport | Pre-release and runtime evaluation gate | §17, §45.10, §58.10 |
| ReleaseRecord | P2 Release Governance / rollout record | §13.2, §16, §56 |
| RepairRecord | repair / redrive / recovery append evidence | §12, §14.14, §31 |
| ResumeCompatibilityPolicy | pause/resume version compatibility policy | §20, §25.10, §45.15 |
| VerificationResult | deterministic verification / EvaluationReport input | §13.9, §45.25 |
| PrincipalRef | Principal / issuedBy / actor unified identity reference | §5, §6.5, §45.27 |

## H.4 Non-Degradable Terms

The following terms are non-degradable; among them, Run authority object is converged to HarnessRun according to v4.2, and has been moved into §2.4 ArchitectureInvariantRegistry:

1. Complex task Plan must be PlanGraph.
2. Graph Scheduler decision must be Trace Replay-able.
3. HarnessRun / NodeRun terminal state cannot be exited.
4. Event append and truth update must be in same transaction.
5. SideEffect ambiguous must not be treated as success.
6. Trace Replay must not re-call LLM / Tool; any Replay must not produce real side effect.
7. LearningCandidate must not directly go online.
8. LLM-as-Judge must not override deterministic failure.

---

# Appendix A: Version Change History

| Version | Date       | Change Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.0 | 2026-04    | Initial five-plane architecture + stability seven layers + OAPEFLIR concept design                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| v1.1 | 2026-04    | Add risk matrix, DLQ model, deployment suggestions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| v1.2 | 2026-04    | Add data model 44 tables, event namespace, ADR suggestions, recommended directory                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| v2.0 | 2026-04-18 | **Infrastructure Improvement Version**: Add inter-plane communication contract(§5), API contract(§6), service communication(§7), scalability(§8), configuration governance(§24), performance SLO(§27), disaster recovery high availability(§31); improve risk score(§10), OAPEFLIR interface(§13), storage abstraction(§26), deployment(§32), roadmap(§33); solve v1.2's 14 design defects                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| v2.1 | 2026-04-19 | **AI Operations Complete Version**: Add LLM Provider abstraction and failover(§15), Prompt management and versioning(§16), model evaluation and quality gate(§17), cost management and Token metering(§18), inter-Agent delegation and collaboration(§19), long-running task and Workflow sleep(§20), human-machine collaboration mode(§21), SDK and developer experience(§22), compliance and data governance(§23); improve API authentication and Webhook(§6), security threat model(§11), alert routing and distributed Tracing(§12), Error Budget and LLM latency(§27), Pack lifecycle and Plugin governance(§30); add 9 ADRs; solve v2.0's 14 AI operations layer defects                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| v2.2 | 2026-04-19 | **Business Domain Onboarding Complete Version**: Add business domain modeling and onboarding architecture(§37)——DomainDescriptor structured domain modeling, DomainRiskProfile domain risk profile, DomainKnowledgeSchema domain knowledge structure, DomainEvalFramework domain evaluation framework, DomainPromptLibrary domain Prompt library, DomainRecipe domain template prototype, DomainInteractionPolicy cross-domain interaction policy, DomainGovernancePolicy domain governance model; add business domain onboarding Runbook(§38)——four-phase gate process (modeling→development→certification→graying-out); improve Business Pack model(§30) associate DomainDescriptor; add 4 ADRs; solve v2.1's 10 business domain onboarding layer defects                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| v2.3 | 2026-04-19 | **Intelligent Interaction Complete Version**: Add natural language task entry architecture(§39), goal decomposition engine architecture(§40), proactive Agent framework(§41), progressive autonomy model(§42), unified operations dashboard architecture(§43), non-technical user experience architecture(§44); add 6 ADRs; upgrade platform from "Agent infrastructure" to non-technical user-facing "Agent operating system"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| v2.4 | 2026-04-19 | **Organizational Governance Complete Version**: Add organizational hierarchy model(§46), organizational architecture approval routing(§47), enterprise SSO/SCIM integration(§48), department compliance policy engine(§49), knowledge domain isolation and controlled sharing(§50), tiered governance delegation(§51); add 6 ADRs; enable platform to adapt from one-person company to ten-thousand-person enterprise organizational complexity                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| v2.5 | 2026-04-19 | **Scaled Ecosystem Complete Version**: Add multi-Region deployment architecture(§52), scaled resource contention management(§53), SLA tiered assurance(§54), Agent marketplace and ecosystem(§55), feedback-driven continuous improvement pipeline(§56), external system integration framework(§57); add 6 ADRs; complete cross-Region HA, resource fair scheduling, SLA differentiated assurance, open ecosystem, and continuous self-improvement capability                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| v2.6 | 2026-04-19 | **Operational Maturity Complete Version**: Add Agent explainability and decision transparency(§59), emergency brake and global circuit breaker(§60), Agent unified lifecycle management(§61), offline and edge deployment(§62), Agent behavior drift detection(§63), cost attribution and optimization engine(§64), workflow visual debugger(§65), compliance report auto-generation engine(§66), capacity planning and cost forecasting(§67), multimodal capability(§68), platform self-operations Agent(§69); add 11 ADRs; complete from "complete architecture design" to "producible operation" operational maturity layer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| v2.7 | 2026-04-19 | **Quality Fix Version**: Fix ADR autonomy level contradiction (monotonic→guarded progression); unify §9.5/§14.8 mode enumeration as 8 mode canonical set; complete missing principal/trace_id fields in ExecutionPlan/StateCommand; extend Prompt injection defense architecture(§16.5); fix ADR-NL TaskSpec→RequestEnvelope reference; complete §26 data model (44→71 tables) and §28 event namespace (17→25); complete §33 roadmap Phase 5-7; complete §43 L2/L3 dashboard view definition; add §39.7 i18n, §44.6 WCAG, §52.4 GDPR cross-border transfer, §55.4-55.6 marketplace revenue/deprecation/dependency management, §15.6 streaming error handling; add §40 circular dependency detection, §5.2 P2→P4 communication path; fix §62 typo and §70 conclusion omission; add Appendix G glossary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| v2.8 | 2026-04-21 | **Harness Engineering Version**: Add Harness Runtime architecture(§45)——HarnessRuntime unified entry, ConstraintPack task-level constraint envelope, ToolbeltAssembler dynamic tool assembly, HarnessContext unified context and token budget, FeedbackEnvelope four-segment feedback closed loop, HarnessLoopController unified closed-loop control, Planner/Generator/Evaluator three types of Agent role standardization, Recovery Controller fault recovery; add Harness cross-cutting concerns(§58)——Harness-level observability, Prompt layered governance, Failure-to-Learning pipeline, Replay/Simulation capability, architecture legacy issues convergence (§21/§47 approval boundary, §23/§49 compliance boundary, §31/§52 HA mapping, §32/§8/§33 stage comparison, unified error classification, §42/§61 autonomy association); add §13.5 OAPEFLIR→Harness external semantic mapping; add 7 ADRs; complete §25.6 consistency model and assurance level, §25.7 Schema migration strategy; fix §5.4 P5 communication integrity rule, §7.2 communication topology diagram, §8.4 S4 phase TODO, §19.2 global call depth upper limit, §20.4 extra-long approval renewal mechanism, §42.3 trust score decay mechanism, §60.3 Admin unavailable degradation plan; update §33 roadmap add Phase 8 + parallel dependency graph; update §35 code directory add harness/; update Appendix G glossary add 9 Harness terms                                                                                                                                                                                                                                                                                                                           |
| v2.9 | 2026-04-21 | **Harness Eight-Pillar Deepening Version**: Harness upgraded from quintuple to eight-pillar model (Constraints·Tools·State/Memory·Feedback·Durability·Evaluation Harness·HITL Runtime·Observability/Replay), fusing Anthropic role-based closed loop, LangGraph durable runtime, OpenAI governance and Guardrails primitives three industry schools; add §45.13 HarnessRun/HarnessStep unified run contract, §45.14 Evaluation Harness unified evaluation runtime (pre-release evaluation+version comparison+outcome assertion), §45.15 Durable Harness durable execution pillar (5 pauseReasons+4 resumeStrategies), §45.16 Memory Namespace three-layer memory namespace (Working/Long-term/Shared Knowledge+promotion strategy), §45.17 Tool Harness tool governance (Capability Profile+lifecycle+trust level), §45.18 HITL Runtime human-machine collaboration runtime (inspect/patch/override/takeover/resume), §45.19 Async Harness async run mode, §45.20 Guardrails five-layer architecture (input/planning/tool/memory/output), §45.21 ten invariants; add §58.6 HarnessDecision unified decision protocol (six decisions standardization); update §45.1 core axiom upgrade eight pillars+industry mapping table, §45.2 overall architecture diagram add new components; update §33 roadmap Phase 8 split into 8a/8b/8c three stages (20 weeks); add 9 ADRs (total 81); update §35 code directory add 7 harness subdirectories; update §70 conclusion upgrade nine-layer architecture; update Appendix G glossary add 11 Harness terms                                                                                                                                           |
| v3.0 | 2026-04-22 | **Vertical Business Domain Deepening Version**: Add 12 vertical business domain architecture chapters(§71-§82)——quantitative trading·e-commerce·advertising·financial services·data processing·code development·user operations·industry research·academic research·enterprise knowledge base·finance·legal; DomainRecipe extended from 4 prototypes to 8 (add Trading/Compliance/Research/Adversarial); §37.1 problem statement table extended to 12 domain×8 dimension panoramic comparison; §37.4/§37.5 knowledge and evaluation tables extended to cover 12 domain representative scenarios; §33 roadmap add Phase 9 (vertical business domain deepening implementation, 3 batches×8 weeks=24 weeks) with Phase dependency graph update; §34 add 12 domain-specific ADRs (total 93); §35 code directory add 11 domain instance directories; §36 add 8 domain-specific risks and 7 domain-specific hard constraints; §38 onboarding Runbook three Gates add vertical domain special checklist; §70 conclusion upgrade from nine-layer to ten-layer architecture (add vertical business domain deepening layer); Appendix G add 13 domain-specific terms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| v3.1 | 2026-04-22 | **24 Domain Full Coverage Version**: Add 12 vertical business domain architecture chapters(§83-§94)——online live streaming·ad creative production·game development·game publishing·human resources·supply chain and logistics·healthcare·education and training·customer service·content moderation and security·IT operations SRE/DevOps·marketing and brand; DomainRecipe extended from 8 prototypes to 12 (add Moderation/Logistics/Conversational/IncidentOps); §37.1 problem statement table extended to 24 domain×8 dimension panoramic comparison (4 tables); §33 roadmap Phase 9 extended from 3 batches to 6 batches (9a-9f, totaling 48 weeks) with dependency graph update; §34 add 12 domain-specific ADRs (total 105); §35 code directory add 12 domain instance directories; §36 add 11 domain-specific risks and 11 domain-specific hard constraints; §36.3 Phase 9 success criteria extended to 24 domains; §38 onboarding Runbook three Gates extend Critical/High risk domain checklist; §70 conclusion 12→24 vertical domains; Appendix G add 13 domain-specific terms (4 new prototypes + CSAM/AIR/MTTR/MTTD/FCR/AHT/COPPA/SOV/SOV); **Structural Restructuring**: Full text rearranged as Part I-XI sub-section structure according to ten-layer architecture——Infrastructure Layer(§4-§14,§24-§32) integrated as Part I, §58 Harness cross-cutting merged after §45 (Part VI), §71-§94 vertical domains moved after §38 (Part IV), §33-§36 implementation summary moved to Part X, §70 conclusion moved to end of full text (Part XI); chapter numbering kept stable for historical reference compatibility                                                                                                                                                                                                                                                                                                                                                                                                                |
| v3.2 | 2026-04-22 | **Architecture Deepening Version**: Add unified domain meta-model(§37.11)——Canonical Domain Meta-Model defines 15-question standard template, 24 domain filling matrix (Q1-Q6 + Q7-Q12 two tables), enabling new domain onboarding templated, platform kernel configuration driven, dashboard/approval/evaluation unified generation; add multi-Agent collaboration protocol(§19.5)——Agent Collaboration Protocol defines 8 message types (task_request/task_offer/task_accept/task_reject/partial_result/escalation_request/completion_report/takeover_notice), 9 mandatory fields, 7 non-violation rules (permission not expanded/risk not elevated/constraint not bypassed/output reviewable/takeover must audit/budget not over-spent/depth not over limit), upgrading §19.1-19.4 delegation model from convention to mandatory protocol; add three-ring implementation priority (Part X preface)——first ring platform survival ring (P1-P5+ConstraintPack+HarnessRun+Risk/Audit+Lease/Recovery+Panic/Incident+ModelGateway, corresponding to Phase 1-2+8a, about 16 weeks), second ring platform usability ring (NL entry+GoalDecomposition+HITL+AsyncHarness+Dashboard+Org/SSO+DomainDescriptor+meta-model+collaboration protocol, corresponding to Phase 3-5+8b/8c, about 24 weeks), third ring platform expansion ring (Marketplace+MultiRegion+Edge+CostOptimizer+BehaviorDrift+ComplianceReporter+24 DomainPacks, corresponding to Phase 6-9, about 40+ weeks); update §70 conclusion add 3 core principles (meta-model unified·collaboration protocol mandatory·ring-based implementation); **Review Fix**: §38 onboarding Runbook add meta-model step and gate items(§37.11), §45 Harness Runtime add collaboration protocol association(§19.5), §33 Phase 5 deliverables add meta-model+collaboration protocol, §33 dependency Phase 8b→8c fix, §36.3 complete Phase 8 success criteria, §34 domain ADR label 12→24+complete game development domain ADR (total 105), §36.1 complete game development domain risk (total 11), §82 legal domain 12→24 domain fix, three-ring Phase mapping fix |
| v3.3 | 2026-04-22 | **Domain Chapter Deepening Version**: 24 vertical business domain chapters(§71-§94) extended from ~28 lines template to ~65 lines, each domain adds 5 subsections: Agent Workflow (Detailed)——complete multi-step process of each Agent; Key Tools/Integrations——specific products and APIs by category; Data Sensitivity Classification——data type divided by confidentiality level; Performance/Latency Budget——per-operation SLA indicator; Common Failures and Recovery——5-row failure mode×recovery strategy table. Content sourced from v3.0-domain-research.md research data, totaling ~895 lines added                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| v4.0 | 2026-04-27 | **OAPEFLIR v4.4 Executable Runtime Specification Integration Version**: Upgrade OAPEFLIR from "controlled cognitive kernel" to "executable Runtime Spec". Add PlanGraph as internal structure of ExecutionPlan; introduce Graph Normalization, Graph Validation, Graph Risk Propagation, Worst-Path Analysis, Deterministic Graph Scheduler, GraphPatch; add Run / Node state machine terminal state closed rule, AttemptLineage, Event Registry, Event Replay Semantics, Budget Ledger, SideEffect Delivery Semantics, Reconciliation State Machine, ContextAssemblyContract, PromptExecutionContract, DecisionInputBundle, HITL Responsibility Record, Memory Write Governance, LearningCandidate, EvaluationGate, Runtime Test Matrix; complete Phase 8d three-ring mapping, PlanBundle/PlanGraphBundle compatibility semantics, platform.* and oapeflir.* event compatibility layer, v4.0 Runtime table placement, LLM-as-Judge cannot override failure; update §5, §13, §14, §17, §25, §26, §28, §45, §58, §33, §34, §35, §36, §70 and Appendix G/H. |
| v4.1 | 2026-04-27 | **OAPEFLIR-Harness Convergence Version + Minimum Production Closed Loop Version**: Clarify HarnessRuntime is the only executable runtime, HarnessRun is the only authoritative Run, OAPEFLIR only serves as StageRationale / TraceProjection / Audit View; converge Replay to default Trace Replay and isolated Re-execution Replay; strengthen Budget atomic reservation, SideEffect revoked/expired and pre-commit re-verification, Panic ack / resume rules, TrustScore not lowering inherent risk, hot path deterministic execution, multi-Region single leader write, SLA default 99.95 upper limit, global call depth 8; update §5, §10, §14, §18, §19, §28, §31, §37, §42, §45, §52, §54, §58, §60, §33-§36 and Appendix H. |
| v4.2 | 2026-04-27 | **Implementable Specification Convergence Version**: Unify v4.1/v4.4 authority relationship, clarify body text and runtime/schema/event registry as implementation authority; deprecate `ExecutionPlan` canonical name and converge to `PlanGraphBundle`; split `ControlDirective` into `OperationalDirective` / `DecisionDirective`; complete core runtime object API, Webhook retry, Outbox poller failover, SLO P95/P99 calibration, §25 read path matrix, §26 MVP 20 table upper limit, §29 Memory/Knowledge/Artifact/Learning contract, §33 MVP/Hardening/Enterprise three-ring roadmap and Appendix H conflict adjudication rules. |
