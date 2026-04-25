# Legacy System to New Platform Migration Assessment Document

> **Document Version**: v1.1
> **Document Status**: Draft
> **Assessment Scope**: `docs_zh/` (excluding `docs_zh/automatic_agent_platform/`) + `src/` + `config/` + `divisions/` + `tests/`
> **Target System**: "Enterprise Agent Platform Overall Technical Architecture Design Document" v2.7 (§1-§70, Seven-Layer Architecture)
> **Assessment Date**: 2026-04-19

---

## 1. Assessment Purpose

The legacy system (automatic-agent-system-main) contains **797 source files / 174,585 lines of code** and **200+ documentation files**. The new platform architecture design document v2.7 defines a seven-layer enterprise architecture. This document answers:

1. **Which doc files** can be directly ported, adapted for porting, or archived?
2. **Which code modules** can be directly ported, adapted for porting, or need to be rewritten?
3. **What is the porting priority and recommended execution order?**

---

## 2. Assessment Methodology

### 2.1 Porting Level Definitions

| Level | Tag | Meaning | Typical Modification Scope |
|-------|-----|---------|--------------------------|
| **A1 — Direct Port** | 🟢 | Zero modification copy-and-use. Interfaces, naming, and dependencies are all compatible with the new architecture | 0 — Copy only + import path update |
| **A2 — Direct Reuse with Adapter** | 🟢🔧 | Core implementation unchanged, needs adapter/wrapper to align with new architecture extension points | ≤15% — Add adapter layer or supplement missing interfaces |
| **B — Adapted Port** | 🟡 | Core logic reusable but needs adaptation to new architecture interfaces/naming/layering | 15%-50% — Interface refactoring + dependency replacement |
| **C — Reference Value** | 🔵 | Not directly ported, but design approach/test cases/competitive analysis have reference value | N/A — Reference only, no code migration |
| **D — Archive and Retire** | ⚪ | Outdated or replaced by new design, for historical archiving only | N/A — Archive |

### 2.2 Five-Dimension Decision Template

Each module/document's level determination must provide evidence across five dimensions:

| Dimension | Meaning | Scoring Criteria |
|-----------|---------|------------------|
| **Architecture Alignment** | Degree of interface/layer alignment with v2.7 target architecture | High=interfaces directly aligned / Medium=needs adapter / Low=needs interface rewrite |
| **Dependency Pollution** | Coupling degree to external modules, affecting independent porting capability | Low=≤2 direct dependencies / Medium=3-5 / High=≥6 or circular dependencies |
| **Interface Stability** | Expected changes to public APIs during migration | High=unchanged / Medium=compatible extension / Low=breaking changes |
| **Test Coverage** | Existing test coverage of core behavior | High=full behavior coverage / Medium=main path coverage / Low=insufficient coverage |
| **Modification Scope** | Proportion of code that needs modification relative to total module size | Small=≤15% / Medium=15%-50% / Large=≥50% |

**Decision Rules**:
- **A1**: All five dimensions are "High/Low/High/High/Small"
- **A2**: Architecture alignment ≥ Medium, modification scope ≤15%, but needs new adapter/wrapper
- **B**: Core reusable but at least one dimension is "Low" or modification scope >15%
- **C**: Architecture alignment is "Low" and modification scope ≥50%
- **D**: Explicitly replaced or deprecated by v2.7

### 2.3 New Architecture Seven-Layer Mapping

```
Layer 7 │ Operations Maturity Layer (Explainability·Emergency Brake·Lifecycle·Edge·Drift·Cost·Debugging·Compliance·Capacity·Multimodal·Self-Ops)
Layer 6 │ Scale & Ecosystem Layer (Multi-Region·Resource Competition·SLA·Marketplace·Feedback·Integration)
Layer 5 │ Organization Governance Layer (Org Hierarchy·Approval Routing·SSO·Compliance·Knowledge Isolation·Delegation)
Layer 4 │ Intelligent Interaction Layer (NL Entry·Goal Decomposition·Proactive Agent·Autonomy·Dashboard·UX)
Layer 3 │ Business Domain Access Layer (DomainDescriptor·Recipe·Runbook)
Layer 2 │ AI Operations Layer (LLM Abstraction·Prompt·Eval·Cost·HITL·SDK)
Layer 1 │ Infrastructure Layer (Five Planes·Stability·Risk·Security·Recovery·Audit)
```

---

## 3. Overview Matrix

### 3.1 Documentation Porting Overview

| Category | File Count | 🟢 Direct | 🟡 Adapted | 🔵 Reference | ⚪ Archive |
|----------|-----------|-----------|------------|-------------|------------|
| Main Documents (docs_zh/architecture/) | 5 | 0 | 5 | 3 | 0 |
| Technical Analysis Documents (docs_zh/analysis/) | 3 | 0 | 2 | 0 | 0 |
| Architecture & Sequence Diagrams | 4 | 0 | 3 | 1 | 0 |
| Contract Documents (docs_zh/contracts/) | 113 | 22 | 38 | 20 | 10 |
| ADR (docs_zh/adr/) | 38 | 15 | 8 | 3 | 2 |
| Operations Documents (docs_zh/operations/) | 16 | 5 | 10 | 8 | 7+ |
| Review Documents (docs_zh/reviews/) | 1 | 0 | 3 | 12 | 6 |
| Governance Documents (docs_zh/governance/) | 7 | 4 | 3 | 1 | 0 |
| Guide Documents (docs_zh/guides/) | 4 | 2 | 2 | 0 | 0 |
| Reference Documents (docs_zh/reference/) | 0 | 0 | 0 | 8 | 9 |
| Research Documents (docs_zh/research/) | 0 | 0 | 0 | 28 | 0 |
| Archive Documents (docs_zh/archive/) | 0 | 0 | 0 | 0 | 3 |
| **Total** | **~243** | **~48** | **~74** | **~84** | **~37** |

### 3.2 Code Porting Overview

| Architecture Layer | Module | File Count | Lines | 🟢 | 🟡 | 🔵 | ⚪ |
|--------------------|--------|-----------|-------|-----|-----|-----|-----|
| Layer 1 Infrastructure | types, errors, storage, events, config, cache, locking, queue, api, lifecycle, constants, utils, resource, results | ~230 | ~50K | 8 modules | 5 modules | 1 module | 0 |
| Layer 2 AI Operations | runtime, agent-loop, planning, tools, providers, workflow, orchestration, artifacts, feedback, learning, evaluation | ~230 | ~58K | 3 modules | 7 modules | 1 module | 0 |
| Layer 3 Business Domain | domain-registry, divisions, plugins | ~38 | ~5.7K | 2 modules | 1 module | 0 | 0 |
| Layer 4 Intelligent Interaction | memory, knowledge, messages, gateway | ~54 | ~10.7K | 1 module | 3 modules | 0 | 0 |
| Layer 5 Organization Governance | security, approvals, compliance, cost, hr | ~28 | ~8.6K | 2 modules | 3 modules | 0 | 0 |
| Layer 6 Scale | deployment, improvement, product (partial) | ~35 | ~8.4K | 0 | 2 modules | 1 module | 0 |
| Layer 7 Operations Maturity | observability, ops, stability, evolution, reliability | ~106 | ~32.6K | 2 modules | 3 modules | 0 | 0 |
| Cross-Layer CLI | cli | 78 | ~6.1K | 0 | 1 (whole) | 0 | 0 |
| **Total** | **43 modules** | **~799** | **~180K** | **18** | **25** | **3** | **0** |

---

## 4. Documentation Porting Detailed Assessment

### 4.1 Main Documents (docs_zh/architecture/)

| File | Lines | Level | Target Architecture Layer | Porting Notes |
|------|-------|-------|--------------------------|---------------|
| `00-platform-architecture.md` | ~2,000 | 🟡 B | Cross-layer | Document layering governance model (L0-L10) reusable, needs update to seven-layer architecture document system |
| `01-code-structure.md` | ~500 | 🟡 B | Layer 1-2 | Directory structure + control-plane role definition reusable, needs alignment with v2.7 §1-§5 |
| `02-code-architecture-reference.md` | ~800 | 🟡 B | Layer 5 | Agent layering, permissions, security model compatible with v2.7 §11 security system, needs expansion of organization governance section |
| `03-module-diagrams.md` | ~400 | 🟡 B | Layer 2,4 | Six-layer module diagram with feedback loop compatible, needs KV cache alignment details update |
| `04-runtime-sequence.md` | ~300 | 🔵 C | Cross-layer | Constraints and anti-pattern lists serve as new platform design reference |

### 4.2 Technical Analysis Documents (docs_zh/analysis/)

| File | Lines | Level | Porting Notes |
|------|-------|-------|---------------|
| `00-architecture-coverage-matrix.md` | ~150 | 🟡 B | Coverage matrix, needs update to reflect five-plane module reorganization |
| `01-codebase-vs-design-review.md` | ~2,000 | 🟡 B | Code vs design discrepancy analysis handbook |
| `02-implementation-progress-tracker.md` | ~100 | 🔵 C | Implementation progress tracking as reference |

### 4.3 Architecture & Sequence Diagram Documents

| File | Lines | Level | Porting Notes |
|------|-------|-------|---------------|
| `00-platform-architecture.md` | ~2,000 | 🟡 B | Main architecture entry document, SLO quantitative metrics (95%/90%/100%) reusable, needs alignment with v2.7 §27 |
| `04-runtime-sequence.md` | ~300 | 🟡 B | 4 sets of core runtime sequence diagrams (Intake/Dispatch/Writeback/Recovery) directly portable, needs OAPEFLIR full-cycle sequence supplement |

### 4.4 Contract Documents (docs_zh/contracts/) — 113 Files

**Direct Port (🟢 A) — 22 Files**: These contract-defined interfaces are fully compatible with the new architecture.

| Contract | Target Architecture Section |
|----------|----------------------------|
| `state_transition_matrix_contract.md` | §9 State Machine |
| `event_bus_contract.md` | §4 Event Bus Plane |
| `storage_schema_contract.md` (748 lines) | §26 Data Model |
| `sandbox_and_auth_contract.md` | §11 Security System |
| `tool_skill_plugin_contract.md` | §30 Business Pack |
| `slo_alerting_and_runbook_contract.md` | §27 Performance SLO |
| `memory_decay_and_quality_contract.md` | §3.5 Memory Quality |
| `release_rollout_and_rollback_contract.md` | §32 Deployment |
| `runtime_execution_contract.md` | §13 OAPEFLIR |
| `plugin_spi_contract.md` | §30 Plugin |
| `knowledge_spi_contract.md` | §3.4 Knowledge Plane |
| `ha_coordinator_and_leader_election_contract.md` | §31 HA |
| Other 10 basic contracts | Layer 1 various sections |

**Adapted Port (🟡 B) — 38 Files**: Core constraints reusable, needs adaptation to new naming/layering/extension points.

| Contract Category | File Count | Adaptation Points |
|-------------------|------------|-------------------|
| Agent Behavior Contracts | 8 | Need to add v2.7 §42 Gradual Autonomy + §41 Proactive Agent constraints |
| OAPEFLIR Cycle Contracts | 5 | Need to extend Plan/Learn/Improve/Rollout stage contract details |
| API Contracts | 6 | Need to add §39 NL Entry + §44 Non-Technical User Endpoints |
| Billing/Tenant Contracts | 4 | Need to add §46 Organization Hierarchy + §54 SLA Tiering |
| Security/Compliance Contracts | 5 | Need to add §49 Department Compliance + §52 GDPR Cross-Border |
| Others | 10 | Naming and reference updates |

**Reference Value (🔵 C) — 20 Files**: Design approach referenceable but interfaces already covered by new design.

**Archive and Retire (⚪ D) — 10 Files**: Early v1.x contracts replaced by v2.7.

### 4.5 ADR (docs_zh/adr/) — 38 Files

**Direct Port (🟢 A) — 15 Files**:

| ADR | Decision Topic | Target Architecture Section |
|-----|---------------|---------------------------|
| `001-three-layer-architecture.md` | Three-Layer Architecture | §1 Overall Architecture |
| `003-memory-seven-layers.md` | Memory Layering | §3.5 Memory |
| `005-security-model.md` | Security Model | §11 Security |
| `006-llm-provider-strategy.md` | LLM Provider Strategy | §15 Provider |
| `012-sqlite-phase-1-2-primary-store.md` | SQLite Selection | §26 Storage |
| `016-oapeflir-loop-model.md` | OAPEFLIR Model | §13 OAPEFLIR |
| `018-rollout-eleven-state-machine.md` | Rollout State Machine | §32 Deployment |
| `019-agent-handoff-four-layer-protocol.md` | Agent Handoff | §19 Delegation |
| `020-memory-six-plane-model.md` | Memory Six-Plane | §3.5 |
| `060-explicit-planning-hub.md` | Planning Hub | §13 OAPEFLIR-P |
| `066-plugin-spi-framework.md` | Plugin SPI | §30 |
| `072-oapeflir-testing-strategy.md` | OAPEFLIR Testing | §27 |
| `075-controlled-rollout-release.md` | Controlled Release | §32 |
| `078-knowledge-plane-architecture.md` | Knowledge Architecture | §3.4 |
| `079-feedback-hub-signals.md` | Feedback Signals | §56 |

**Adapted Port (🟡 B) — 8 Files**: Decisions valid but need expansion to adapt to seven-layer architecture.

| ADR | Adaptation Points |
|-----|-----------------|
| `002-division-system.md` | Need to add §46 Organization Hierarchy impact on Division |
| `004-workflow-routing.md` | Need to adapt multi-level routing of §40 Goal Decomposition Engine |
| `007-evolution-engine.md` | Need to align with v2.7 §65 Behavior Drift Detection |
| `008-cost-model.md` | Need to expand §66 Cost Attribution Optimization |
| `009-deployment-ops.md` | Need to add §64 Edge/Offline Deployment |
| `011-effect-ts-adoption.md` | Need to re-evaluate Effect-TS adoption decision in new platform |
| `013-eventemitter-phase-2-boundary.md` | Need to evaluate whether Phase 2 continues with EventEmitter |
| `017-knowledge-architecture-refactor.md` | Need to align with v2.7 §50 Knowledge Domain Isolation |

**Reference Value (🔵 C) — 3 Files**: `010-commercial-model.md`, `014-org-model-code-boundary.md`, `080-learn-hub-pattern-detection.md`

**Archive and Retire (⚪ D) — 2 Files**: `015-unified-extension-marketplace.md` (replaced by v2.7 §55), early draft ADRs

### 4.6 Governance Documents (docs_zh/governance/) — 7 Files

| File | Level | Porting Notes |
|------|-------|---------------|
| `source_of_truth.md` | 🟢 A | Data source governance rules directly applicable |
| `change_control.md` | 🟢 A | Change control process directly applicable |
| `naming_and_directory_conventions.md` | 🟢 A | Naming and directory conventions directly applicable |
| `glossary_and_terminology.md` | 🟢 A | Terminology directly applicable, need to supplement v2.7 Appendix G terms |
| `autonomy_boundary_policy.md` | 🟡 B | Need to align with v2.7 §42 Gradual Autonomy Model |
| `rollout_release_policy.md` | 🟡 B | Need to align with v2.7 §32 Deployment Strategy |
| `phase1_scope_freeze.md` | 🟡 B | Need to map to new platform Phase definition |
| `README.md` | 🔵 C | Navigation file reference |

### 4.7 Guide Documents (docs_zh/guides/) — 4 Files

| File | Level | Porting Notes |
|------|-------|---------------|
| `quickstart.md` | 🟢 A | Quick start guide directly reusable, update ports/config |
| `contributing.md` | 🟢 A | Contributing guide directly applicable |
| `division-authoring.md` | 🟡 B | Need to update to reflect v2.7 §37 DomainDescriptor |
| `skill-authoring.md` | 🟡 B | Need to update to reflect v2.7 §30 Pack lifecycle |

### 4.8 Operations Documents (docs_zh/operations/) — 16 Files

**Direct Port (🟢 A) — 5 Files**:

| File | Porting Notes |
|------|---------------|
| `runbooks/database-issues.md` | Database issues operations manual directly applicable |
| `runbooks/memory-pressure.md` | Memory pressure handling directly applicable |
| `runbooks/incident-response-playbook.md` | Incident response playbook directly applicable |
| `test_coverage_baseline_gate.md` | Coverage gate rules directly applicable |
| `src_module_test_matrix.md` (1,455 lines) | Module-test mapping matrix, format directly reusable, need to update module list |

**Adapted Port (🟡 B) — 10 Files**: Phase plans, Roadmap, implementation plans need to be remapped to seven-stage roadmap.

**Reference/Archive — 15+ Files**: Historical TODOs, old gap analysis, archived plans under archive/.

### 4.9 Review Documents (docs_zh/reviews/) — 1 File

| Level | File | Notes |
|-------|------|-------|
| 🟡 B | `test_strategy_plan.md` (1,957 lines) | Test strategy reusable, need to expand Layer 4-7 |
| 🟡 B | `authoritative_task_store_refactoring_plan.md` (1,233 lines) | TaskStore refactoring plan has guiding value for new platform storage layer |
| 🟡 B | `opeli_detailed_design.md` (4,484 lines) | OAPEFLIR detailed design directly corresponds to v2.7 §13 |
| 🔵 C | `production_gap_detailed_solutions.md` (2,590 lines) | Production gap solutions as reference |
| 🔵 C | `production_gap_solution_v2.md` (2,598 lines) | Same as above v2 |
| 🔵 C | `design_gap_analysis.md` (2,424 lines) | Design gap analysis as new platform verification checklist |
| 🔵 C | Other 9 files | Historical review records as reference |
| ⚪ D | 6 files | Old reviews replaced |

### 4.10 Reference Documents (docs_zh/reference/) — 0 Files

| Level | Notes |
|-------|-------|
| 🔵 C (8 files) | Architecture/module/security/storage/communication chapters mechanically split from old monolith, design approach referenceable |
| ⚪ D (9 files) | Old content completely covered by v2.7, archived |

### 4.11 Research Documents (docs_zh/research/) — 0 Files

| Level | Notes |
|-------|-------|
| 🔵 C (all 28 files) | Competitive analysis (Claude Code/Codex/Goose/Aider/MetaGPT/LangGraph/Temporal/DeerFlow etc.) and reference alignment reviews. Not directly ported but high reference value for new platform design decisions. Recommend moving entire `docs_zh/research/` directory to new project |

### 4.12 Archive Documents (docs_zh/archive/) — 0 Files

| Level | Notes |
|-------|-------|
| ⚪ D (all 3 files) | `automatic-agent-architecture-monolith-dedup.md` (11,392 lines) etc. are historical archives, retained for audit traceability only |

---

## 5. Code Module Porting Detailed Assessment

### 5.1 Layer 1 — Infrastructure Layer

#### 🟢 Direct Port (8 Modules)

| Module | Files/Lines | Target Section | Porting Notes |
|--------|-------------|----------------|---------------|
| `core/types/` | 21 / 2,887 | §5 Contracts | Branded ID, state enums, 15+ domain record types. Zero external dependencies, TypeScript strict mode. **Port as-is** |
| `core/errors.ts` | 1 / 490 | §10 Exceptions | 14-category `AppError` hierarchy + serialization. Zero dependencies. **Port as-is** |
| `core/constants/` | 2 / 16 | Cross-layer | Time constants. **Port as-is** |
| `core/utils/` | 2 / 109 | Cross-layer | BoundedCache utility class. **Port as-is** |
| `core/results/` | 2 / 390 | §5 Contracts | ResultEnvelope pattern. **Port as-is** |
| `core/locking/` | 8 / 635 | §31 HA | Distributed lock abstraction (SQLite/Redis/PG advisory). Clean adapter pattern. **Port as-is** |
| `core/queue/` | 6 / 771 | §4 Events | Queue abstraction (SQLite/Redis) + factory. **Port as-is** |
| `core/lifecycle/` | 3 / 276 | §8 Extensions | ServiceRegistry + teardown ordering. **Port as-is** |

#### 🟡 Adapted Port (5 Modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|--------|-------------|----------------|-------------------|
| `core/storage/` | 101 / 26,102 | §26 Data Model | `AuthoritativeTaskStore` is the global data access facade (god object). Core SQL schema/migration reusable, but needs splitting into domain-based Repositories. PG async adapter pattern excellent, retain |
| `core/events/` | 8 / 1,894 | §28 Events | 3-tier DurableEventBus design excellent. Need to add 8 new event namespaces from v2.7 §28 (delegation.*/hibernation.*/prompt.*/eval.*/cost.*/approval_flow.*/agent_lifecycle.*/circuit_breaker.*) |
| `core/config/` | 27 / 6,776 | §24 Config | Zod schema validation + 8-layer config governance reusable. Need to add §46 Organization Hierarchy config + §64 Edge deployment config |
| `core/cache/` | 27 / 2,518 | §26 Cache | L1/L2/L3 multi-level cache + domain strategy. Need to add §50 knowledge domain isolation cache partitioning |
| `core/api/` | 30 / 5,006 | §6 API | HTTP server + OIDC/OAuth + WebSocket. Need to add §39 NL entry endpoints + §44 Non-Technical User API + §48 SSO/SCIM endpoints |

#### 🔵 Reference Value (1 Module)

| Module | Notes |
|--------|-------|
| `core/resource/` | 2 / 361 | ProcessTracker process tracking logic referenceable, but new platform may use different process management model |

### 5.2 Layer 2 — AI Operations Layer

#### 🟢 Direct Port (3 Modules)

| Module | Files/Lines | Target Section | Porting Notes |
|--------|-------------|----------------|---------------|
| `core/providers/` | 10 / 4,436 | §15 LLM | UnifiedChatProvider (Anthropic/OpenAI/MiniMax) + CircuitBreaker + CredentialPool + ModelRouting. Clean adapter pattern. **A2 Port**: Core implementation unchanged, need to add §15.6 streaming error handling adapter (architecture alignment=medium, modification scope ≤15%) |
| `core/workflow/` | 4 / 1,011 | §13 OAPEFLIR | MinimalWorkflow + Validator + OutputSchema + StepRetryPolicy. **Port as-is** |
| `core/artifacts/` | 13 / 1,095 | §30 Pack | Artifact model/storage/version/release/governance/sensitive content scanning. **A2 Port**: Need to add evidence/compliance chain adapter + §69 multimodal artifact + §55 marketplace release interface (architecture alignment=medium, modification scope ≤15%) |

#### 🟡 Adapted Port (7 Modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|--------|-------------|----------------|-------------------|
| `core/runtime/` | 114 / 30,348 | §9,§13,§31 | **Largest module, highest risk**. ExecutionDispatch/Lease/Worker/HA/Recovery/HotUpgrade core logic reusable. Adaptation points: (1) Split into five independent bounded contexts - Dispatch/Lease/Worker/HA/Recovery; (2) Adapt §41 Proactive Agent scheduling; (3) Add §52 multi-Region dispatch; (4) Add §53 resource competition management |
| `core/agent-loop/` | 31 / 2,562 | §13 OAPEFLIR | OapeflirLoopService + Assessment + Handoff + StageTimeline. Core loop logic complete. Need to add §42 autonomy assessment stage + §59 explainability output |
| `core/planning/` | 9 / 314 | §13 OAPEFLIR-P | PlanBuilder/DAGValidator/StrategySelector. Need to expand §40 Goal Decomposition Engine multi-level decomposition capability |
| `core/tools/` | 36 / 13,500 | §30 Tools | CommandExecutor/SkillExecution/ToolSanitizer/PathScope/MCPGuard. Security boundary complete. Need to add §69 multimodal tool support + §37 domain tool registration |
| `core/orchestration/` | 3 / 1,054 | §13 Orchestration | IntakeRouter/WorkflowPlanner/AgentTeamService. Need to adapt §39 NL entry + §40 Goal decomposition + §46 Organization hierarchy routing |
| `core/feedback/` | 5 / 532 | §56 Feedback | FeedbackCollector/SignalPreprocessor. Need to expand §56 complete signal types for feedback-driven continuous improvement pipeline |
| `core/learning/` | 14 / 682 | §13 OAPEFLIR-L | FailurePatternMiner/ExperienceDistillation/StrategyLearning + 4 pattern detectors. Need to add §65 behavior drift detection patterns |

#### 🔵 Reference Value (1 Module)

| Module | Notes |
|--------|-------|
| `core/evaluation/` | 6 / 1,429 | PostExecutionQualityGate/LlmEvalService logic referenceable, but v2.7 §17 defines more complete model evaluation framework, needs redesign |

### 5.3 Layer 3 — Business Domain Access Layer

#### 🟢 Direct Port (2 Modules)

| Module | Files/Lines | Target Section | Porting Notes |
|--------|-------------|----------------|---------------|
| `core/domain-registry/` | 14 / 2,456 | §37 Domain Modeling | DomainRegistryService/PluginSpiRegistry/ContractRegistry/ToolBundleRegistry/WorkflowRegistry/PluginRuntimeHost. SPI pattern clean. **Port as-is**, need to add DomainDescriptor registration |
| `core/divisions/` | 4 / 1,632 | §37 Domain | DivisionLoader + YAML secure loading + HrRoleGovernance. **Port as-is** |

#### 🟡 Adapted Port (1 Module)

| Module | Files/Lines | Target Section | Adaptation Points |
|--------|-------------|----------------|-------------------|
| `plugins/` | 20 / 1,672 | §30,§55 | 16 builtin plugins (6 domains: coding/ops/growth/game-dev/asset-production/livestream). SPI adapter/presenter/retriever/validator/planner pattern reusable. Need to add §55 marketplace ecosystem pack/release/deprecation lifecycle |

### 5.4 Layer 4 — Intelligent Interaction Layer

#### 🟢 Direct Port (1 Module)

| Module | Files/Lines | Target Section | Porting Notes |
|--------|-------------|----------------|---------------|
| `core/messages/` | 2 / 509 | §39 Messages | MessageParts + TokenEstimator. **Port as-is** |

#### 🟡 Adapted Port (3 Modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|--------|-------------|----------------|-------------------|
| `core/memory/` | 16 / 3,335 | §3.5 Memory | Layered memory (session/project/user/global) + consolidation/promotion/retrieval/quality. Need to add §50 knowledge domain isolation memory partitioning + §64 edge deployment local memory cache |
| `core/knowledge/` | 23 / 3,443 | §3.4 Knowledge | KnowledgePlane/Ingestion/Embedding/VectorStore/Graph/Retrieval + governance. Need to add §50 knowledge domain isolation + §69 multimodal knowledge indexing |
| `gateway/` | 13 / 3,471 | §6,§44 | ChannelGateway (Telegram/Slack/Webhook) + WebSocket + SSE. Need to add §39 NL channel + §44 Non-Technical User frontend gateway + §57 External system integration gateway |

### 5.5 Layer 5 — Organization Governance Layer

#### 🟢 Direct Port (2 Modules)

| Module | Files/Lines | Target Section | Porting Notes |
|--------|-------------|----------------|---------------|
| `core/security/` | 19 / 7,125 | §11 Security | SandboxPolicy/PolicyEngine/SecretManagement/AuditIntegrity/FieldEncryption/NetworkEgress/CveIntelligence. **A2 Port**: Core security mechanisms unchanged, need to add §49 department-level security policy engine adapter (architecture alignment=medium, modification scope ≤15%) |
| `core/cost/` | 2 / 64 | §18 Cost | BudgetGuard. Lightweight but complete. **Port as-is**, need to expand §66 cost attribution optimization |

#### 🟡 Adapted Port (3 Modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|--------|-------------|----------------|-------------------|
| `core/approvals/` | 3 / 495 | §21 HITL | ApprovalService/TimeoutExecutor. Need to add §47 Organization structure approval routing + multi-party approval/delegation |
| `core/compliance/` | 2 / 346 | §23,§68 | AuditExportService. Need to expand §68 compliance report auto-generation + §52 GDPR cross-border |
| `core/hr/` | 2 / 572 | §46 Organization | HrRoleGovernanceService. Need to add §46 Organization hierarchy model + §51 tiered governance delegation |

### 5.6 Layer 6 — Scale & Ecosystem Layer

#### 🟡 Adapted Port (2 Modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|--------|-------------|----------------|-------------------|
| `core/deployment/` | 2 / 502 | §32 Deployment | TrafficRoutingService (blue-green/canary). Need to expand §52 multi-Region deployment + §64 edge deployment |
| `core/improvement/` | 11 / 770 | §13 OAPEFLIR-IR | StrategyVersioning/AutonomyBoundary/GuardrailEvaluator/AutoRollback/CanaryRouter/RolloutStateMachine. Need to align §42 Gradual Autonomy + §55 marketplace Agent version management |

#### 🔵 Reference Value (1 Module)

| Module | Notes |
|--------|-------|
| `core/product/` | 22 / 7,109 | BillingService/Marketplace/TenantPlatform/PMF/EnterpriseCapability. Commercial logic tightly coupled with old system Phase 1-2, needs redesign based on v2.7 §54 SLA tiering + §55 marketplace ecosystem |

### 5.7 Layer 7 — Operations Maturity Layer

#### 🟢 Direct Port (2 Modules)

| Module | Files/Lines | Target Section | Porting Notes |
|--------|-------------|----------------|---------------|
| `core/observability/` | 36 / 8,172 | §12,§27 | StructuredLogger/HealthService/Prometheus/OpenTelemetry/SLO-Alerting/AnomalyDetection. **Port as-is**, need to add §67 visualization debugging support |
| `core/reliability/` | 8 / 1,112 | §10 Risk | FailureClassification/RepairPipeline/PatchBundle/TaskCard. **Port as-is** |

#### 🟡 Adapted Port (3 Modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|--------|-------------|----------------|-------------------|
| `core/ops/` | 19 / 8,308 | §12,§32 | DoctorService/OpsGovernance/EnterpriseGovernance/ReleasePipeline/HumanTakeover/AutoStopLoss. Need to add §60 emergency brake + §70 platform self-ops Agent |
| `core/stability/` | 31 / 12,789 | §27,§32 | 20+ stability rehearsal scenarios + evidence bundling. Need to add §64 edge deployment rehearsal + §65 drift detection rehearsal |
| `core/evolution/` | 12 / 2,268 | §65 Drift | EvolutionMVP/Reflection/Proposal/Benchmark/Rollout. Need to align §65 behavior drift detection + §61 unified lifecycle management |

### 5.8 Cross-Layer — CLI

#### 🟡 Adapted Port (Whole)

| Module | Files/Lines | Adaptation Points |
|--------|-------------|-------------------|
| `cli/` | 78 / 6,149 | 78 CLI entry points are thin wrapper layers, depend on underlying services. Porting strategy: **port synchronously with service migration**. Need to add §39 NL CLI entry + §43 operations dashboard CLI + §46 organization management CLI |

### 5.9 Supporting Assets

#### config/ — 🟢 Direct Port

| Directory | File Count | Porting Notes |
|-----------|------------|---------------|
| `config/bootstrap/` | 1 | Phase config directly reusable |
| `config/runtime/` | 6 | Runtime config (with 5 environment variants) directly reusable |
| `config/security/` | 6 | Security config directly reusable |
| `config/providers/` | 3 | Provider + model metadata directly reusable |
| `config/environments/` | 5 | Environment config directly reusable |
| `config/plugins/` | 1 | Plugin config directly reusable |
| `config/domains/` | 1 | Domain config directly reusable, need to expand DomainDescriptor |
| `config/gateways/` | 1 | Gateway config directly reusable |
| `config/workflows/` | 1 | Workflow config directly reusable |
| `config/knowledge/` | 1 | Knowledge config directly reusable |
| `config/product/` | 1 | Product config directly reusable |

#### divisions/ — 🟡 Adapted Port

| Content | Porting Notes |
|---------|---------------|
| 11 division definitions (including YAML + roles/ + workflows/ + schemas/) | 🟡 Demotion reason: v2.7 §37 DomainDescriptor semantic model has breaking changes to division YAML structure, need to add descriptor metadata fields, domain capability declarations, SLA bindings. YAML schema changes affect all 11 definition files |

#### tests/ — See §5.10 Test Porting Detailed Assessment

#### Infrastructure Files — 🟢 Direct Port

| File | Porting Notes |
|------|---------------|
| `package.json` | Dependency declarations and 110+ npm scripts directly reusable, need to clean up no-longer-needed scripts |
| `tsconfig.json` / `tsconfig.build.json` | TypeScript strict config directly reusable |
| `eslint.config.js` | ESLint 9 flat config directly reusable |
| `.c8rc.json` | Coverage config directly reusable |
| `Dockerfile` | Multi-stage build directly reusable, need to add edge deployment variant |
| `docker-compose.yml` | Three-service orchestration directly reusable, need to add Redis cluster variant |
| `.env.example` | 346-line environment variable template directly reusable, need to add Layer 4-7 config items |
| `.github/workflows/` | 4 CI workflows directly reusable |
| `scripts/` | CI/build scripts directly reusable |
| `deploy/` | Deployment manifests directly reusable |

### 5.10 Test Porting Detailed Assessment

> **Total Test Scale**: 1,069 files / ~229,196 lines

#### Test Infrastructure Dependencies

| Dependency | Notes | Porting Impact |
|------------|-------|----------------|
| Node.js 22 built-in test runner | `import test from "node:test"` + `assert/strict` | 🟢 No migration cost, new platform continues using |
| SQLite (DatabaseSync) | Almost all tests create temp DB via `SqliteDatabase` | 🟡 Need to ensure new platform retains SQLite test backend |
| TypeScript ESM | All use `.js` extension ESM imports | 🟢 New platform continues ESM |
| Hand-written Mocks (no external mock library) | `typed-factories.ts` + deterministic bridge pattern | 🟢 Zero external dependencies, direct port |
| PostgreSQL (optional) | Only `pg-test-helper.ts` and few storage tests, need `AA_TEST_PG_DSN` env var | 🟢 Optional dependency, does not affect main flow |
| Temp filesystem workspace | `createTempWorkspace()` / `cleanupPath()` | 🟢 Direct port |

#### 5.10.1 tests/helpers/ — 19 Files / ~2,093 Lines

| File | Lines | Level | Purpose | Porting Notes |
|------|-------|-------|---------|---------------|
| `fs.ts` | 21 | 🟢 A | Temp workspace create/cleanup | Almost all tests depend, **port first** |
| `seed.ts` | 100 | 🟢 A | DB seed data (seedTaskAndExecution) | E2E/golden/integration depend |
| `typed-factories.ts` | 143 | 🟢 A | Type-safe mock factories (createPartial/unsafeCast) | Widely used |
| `env.ts` | 53 | 🟢 A | Env var save/restore | Config/CLI tests depend |
| `golden.ts` | 80 | 🟢 A | Golden snapshot assertions (supports UPDATE_GOLDEN=1) | Golden tests depend |
| `e2e-harness.ts` | 131 | 🟢 A | E2E test harness (SQLite + Store + Workspace) | E2E tests depend |
| `integration-context.ts` | 131 | 🟢 A | Integration test context | Integration tests depend |
| `repository-harness.ts` | 80 | 🟢 A | Repository test harness | Storage unit tests depend |
| `concurrent-runner.ts` | 158 | 🟢 A | Concurrent operation runner + invariant checks | Concurrency tests depend |
| `test-cleanup.ts` | 27 | 🟢 A | Singleton reset + process cleanup | Tests needing isolation depend |
| `process-guard.ts` | 90 | 🟢 A | Process leak detection | Runtime/Tool tests depend |
| `fixtures/base.ts` | 99 | 🟢 A | Minimal valid record factory | Unit tests depend |
| `fixtures/composite.ts` | 227 | 🟢 A | Complex multi-entity state factory | Integration tests depend |
| `perception.ts` | 66 | 🟢 A | Perception dataset seed | Product tests depend |
| `pmf.ts` | 251 | 🟢 A | PMF validation dataset seed | PMF tests depend |
| `billing.ts` | 36 | 🟢 A | Billing dataset seed | Billing tests depend |
| `api.ts` | 362 | 🟡 B | Full-stack HTTP API harness | Need to adapt to new API layer |
| `cli.ts` | 30 | 🟡 B | CLI script runner | Need to adapt to new CLI paths |
| `pg-test-helper.ts` | 35 | 🟡 B | PostgreSQL test helper | Need to adapt to new PG config |

#### 5.10.2 tests/unit/ — 758 Files / ~169,943 Lines

Porting assessment grouped by source module:

| Source Module | Test File Count | Test Lines | Level | Port with Phase |
|---------------|----------------|------------|-------|-----------------|
| `types/` | 22 | 5,470 | 🟢 A | Phase 1 |
| `errors.ts` | 1 | 407 | 🟢 A | Phase 1 |
| `constants/` | 3 | 113 | 🟢 A | Phase 1 |
| `utils/` | 3 | 421 | 🟢 A | Phase 1 |
| `results/` | 3 | 806 | 🟢 A | Phase 1 |
| `lifecycle/` | 3 | 443 | 🟢 A | Phase 1 |
| `storage/` | 51 | 18,756 | 🟡 B | Phase 2 |
| `events/` | 10 | 1,729 | 🟢 A | Phase 2 |
| `config/` | 37 | 5,935 | 🟢 A | Phase 2 |
| `locking/` | 12 | 1,931 | 🟢 A | Phase 2 |
| `queue/` | 8 | 1,425 | 🟢 A | Phase 2 |
| `cache/` | 34 | 4,675 | 🟢 A | Phase 2 |
| `security/` | 30 | 6,986 | 🟢 A | Phase 3 |
| `approvals/` | 5 | 1,044 | 🟢 A | Phase 3 |
| `cost/` | 4 | 450 | 🟢 A | Phase 3 |
| `compliance/` | 3 | 479 | 🟢 A | Phase 3 |
| `hr/` | 3 | 350 | 🟢 A | Phase 3 |
| `providers/` | 16 | 5,694 | 🟢 A | Phase 4 |
| `tools/` | 48 | 9,959 | 🟢 A | Phase 4 |
| `workflow/` | 10 | 1,572 | 🟢 A | Phase 4 |
| `artifacts/` | 9 | 1,172 | 🟢 A | Phase 4 |
| `runtime/` | 92 | 22,531 | 🟡 B | Phase 5 |
| `agent-loop/` | 15 | 3,199 | 🟢 A | Phase 6 |
| `planning/` | 7 | 2,024 | 🟢 A | Phase 6 |
| `feedback/` | 4 | 1,301 | 🟢 A | Phase 6 |
| `learning/` | 12 | 1,928 | 🟢 A | Phase 6 |
| `evaluation/` | 7 | 936 | 🟢 A | Phase 6 |
| `improvement/` | 9 | 2,069 | 🟢 A | Phase 6 |
| `memory/` | 26 | 8,549 | 🟢 A | Phase 7 |
| `knowledge/` | 14 | 3,755 | 🟢 A | Phase 7 |
| `messages/` | 5 | 997 | 🟢 A | Phase 7 |
| `gateway/` | 16 | 3,754 | 🟢 A | Phase 7 |
| `domain-registry/` | 11 | 2,167 | 🟢 A | Phase 8 |
| `divisions/` | 8 | 1,939 | 🟢 A | Phase 8 |
| `plugins/` | 18 | 2,644 | 🟢 A | Phase 8 |
| `observability/` | 35 | 7,556 | 🟢 A | Phase 9 |
| `ops/` | 24 | 4,990 | 🟢 A | Phase 9 |
| `stability/` | 15 | 3,145 | 🟢 A | Phase 9 |
| `evolution/` | 19 | 4,199 | 🟢 A | Phase 9 |
| `reliability/` | 14 | 2,723 | 🟢 A | Phase 9 |
| `product/` | 29 | 7,162 | 🟢 A | Phase 9 |
| `deployment/` | 3 | 536 | 🟢 A | Phase 9 |
| `cli/` | 2 | 346 | 🟡 B | Phase 10 |

**Summary**: Of 758 unit test files, **~720 can be directly ported** (🟢). Only storage/ (51 files), runtime/ (92 files), and cli/ (2 files) need adaptation (🟡).

#### 5.10.3 tests/integration/ — 247 Files / ~49,342 Lines

Grouped by test category:

| Category | File Count | Lines | Level | Porting Notes |
|----------|-----------|-------|-------|---------------|
| **Security Boundary** | 64 | 8,929 | 🟡 B | Command injection/path traversal/SSRF/data leakage/sandbox escape/JWT algorithm downgrade/container boundary etc. Coupled with sandbox implementation, need to verify new platform compatibility |
| **CLI Integration** | 32 | 8,998 | 🟡 B | Integration tests for 78 CLI commands. Call `dist/` compiled scripts, need to adapt to new CLI paths |
| **Runtime Integration** | 53 | 9,498 | 🟡 B | Dispatch/Lease/Worker/Recovery/rehearsal scenarios. Deeply coupled with SQLite storage and runtime lifecycle |
| **Contract Verification** | 5 | 1,459 | 🟢 A | OpenAPI/event schema/Gateway adapter/Provider interface/Store facade contracts. **Verifies interfaces not implementations, direct port** |
| **Data Integrity** | 3 | 1,227 | 🟡 B | Approval-execution consistency/event column mapping/memory reference integrity. Depends on SQLite column-level validation |
| **Recovery** | 6 | 1,456 | 🟡 B | Approval timeout recovery/scheduling compensation/event replay/lease crash recovery/SQLite WAL recovery/writeback compensation. Contains SQLite-specific tests |
| **Concurrency** | 5 | 1,401 | 🟡 B | Command concurrency limit/DB busy retry/scheduling race/event concurrency/lease contention. Partially SQLite-specific |
| **Reliability** | 6 | 1,423 | 🟢 A | Degradation behavior/message queue/data integrity/audit/terminal state guarantee. **Verifies invariants, direct port** |
| **Observability** | 6 | 2,011 | 🟢 A | Approval cascading/health checks/metrics/SLI-SLO/task panel/timeline diagnostics. Direct port |
| **Other 36 subdirectories** | 67 | ~12,940 | 🟢 A / 🟡 B | API(2)/approval(2)/cache(1)/compliance(1)/config(2)/cost(2)/deployment(1)/division(2)/evaluation(1)/events(2)/evolution(1)/gateway(1)/HR(1)/lifecycle(5🟡)/locks(1)/memory(1)/messages(2)/migration(3🟡)/ops(3🟡)/orchestration(1)/product(3)/provider(2)/queue(1)/resource(1)/results(2)/session(1)/smoke(5)/soak(2🔵)/stability(1)/storage(5🟡)/tools(2)/types(2)/toolset(1)/workflow(2) |

**Summary**: Of 247 integration tests, **~150 can be directly ported** (🟢), **~90 need adaptation** (🟡, concentrated in security/CLI/Runtime/Recovery/storage), **~7 for reference only** (🔵, soak tests).

#### 5.10.4 tests/golden/ — 8 Files / ~1,662 Lines

| File | Lines | Level | Porting Notes |
|------|-------|-------|---------------|
| `diagnostics-bundle.test.ts` | 160 | 🟢 A | Diagnostics bundle structure snapshot |
| `openapi-document.test.ts` | 187 | 🟢 A | OpenAPI document snapshot |
| `release-plan-output.test.ts` | 202 | 🟢 A | Release plan Markdown snapshot |
| `session-summary.test.ts` | 148 | 🟢 A | Session summary snapshot |
| `phase1a-golden-tasks.test.ts` | 30 | 🟢 A | Phase1a golden tasks |
| `prompt-assembly.test.ts` | 220 | 🟢 A | Prompt partitioning/cache key snapshot |
| `workflow-validation.test.ts` | 145 | 🟢 A | Workflow validation snapshot |
| `cli-help-text.test.ts` | 238 | 🟡 B | CLI help text snapshot. Need to adapt to new CLI command list |
| `snapshots/` (3 files) | 332 | 🟢 A | Snapshot data files |

#### 5.10.5 tests/e2e/ — 10 Files / ~2,807 Lines

| File | Lines | Level | E2E Flow |
|------|-------|-------|----------|
| `task-lifecycle.test.ts` | 371 | 🟡 B | Full task lifecycle: create→schedule→execute→complete. API/model/runtime all changed, need adaptation |
| `multi-step-workflow.test.ts` | 406 | 🟡 B | Multi-step workflow: step dependencies→output passing→complete. Workflow model expansion affects assertions |
| `lease-recovery.test.ts` | 371 | 🟡 B | Lease lifecycle: acquire→expire→recover→contention. Runtime split changes lease interface |
| `operator-takeover.test.ts` | 306 | 🟡 B | Ops takeover: run→pause→manual control→resume. §60 emergency brake introduces new takeover path |
| `error-propagation.test.ts` | 298 | 🟡 B | Error propagation: execution failure→terminal state→error code→retry. State machine expansion affects terminal state determination |
| `oapeflir-full-loop.test.ts` | 248 | 🟡 B | OAPEFLIR 8-stage full cycle. §42 autonomy assessment adds new stage |
| `session-memory-flow.test.ts` | 237 | 🟡 B | Session lifecycle + memory association. §50 knowledge domain isolation affects memory access |
| `gateway-webhook-flow.test.ts` | 230 | 🟡 B | Webhook trigger→task create→lifecycle transition. §39 NL entry changes entry API |
| `streaming-response.test.ts` | 208 | 🟡 B | Streaming response: session stream state + backpressure. §15.6 streaming error handling expansion |
| `approval-event-flow.test.ts` | 132 | 🟡 B | Approval event flow: block→Tier1 event→consumer ack. §47 organization approval routing changes |

**Demotion Note**: v1.0 marked all 10 E2E tests as 🟢, demoted to 🟡 after review. E2E tests traverse entire API→model→runtime→storage chain; runtime split, API expansion, state machine changes, organization governance changes will require test harness and assertion adaptation. Core test scenarios (lifecycle/workflow/recovery) reusable, but estimated modification 15%-30%.

#### 5.10.6 tests/performance/ — 6 Files / ~874 Lines

| File | Lines | P99 Target | Level |
|------|-------|------------|-------|
| `feedback-perf.test.ts` | 118 | <10ms | 🟢 A |
| `handoff-perf.test.ts` | 167 | <5ms | 🟢 A |
| `knowledge-perf.test.ts` | 127 | <100ms/<500ms | 🟢 A |
| `oapeflir-perf.test.ts` | 150 | <30s | 🟢 A |
| `planning-perf.test.ts` | 163 | <50ms | 🟢 A |
| `plugin-perf.test.ts` | 149 | <200ms | 🟢 A |
| `performance.bak/` (10 files) | 2,016 | — | 🔵 C |

**All 6 performance tests can be directly ported** 🟢. 10 deprecated files under `.bak/` for reference only.

#### 5.10.7 tests/fixtures/ — 4 Files / ~459 Lines

| File | Lines | Level | Porting Notes |
|------|-------|-------|---------------|
| `migration/generate-snapshots.ts` | 134 | 🟡 B | SQLite snapshot generation script, need to adapt to new migration version sequence |
| `migration/migration-fixtures.test.ts` | 235 | 🟡 B | Migration ledger integrity test |
| `migration/snapshots/manifest.json` | 41 | 🟡 B | Snapshot version manifest |
| `migration/README.md` | 49 | 🟢 A | Usage instructions |

#### 5.10.8 Test Porting Summary

| Test Layer | Total Files | Total Lines | 🟢 Direct | 🟡 Adapted | 🔵 Reference |
|------------|------------|-------------|----------|------------|-------------|
| helpers/ | 19 | 2,093 | 16 | 3 | 0 |
| unit/ | 758 | 169,943 | ~720 | ~38 | 0 |
| integration/ | 247 | 49,342 | ~150 | ~90 | ~7 |
| golden/ | 8+3 | 1,662 | 10 | 1 | 0 |
| e2e/ | 10 | 2,807 | 0 | 10 | 0 |
| performance/ | 6+10 | 2,890 | 6 | 0 | 10 |
| fixtures/ | 4 | 459 | 1 | 3 | 0 |
| **Total** | **1,069** | **~229,196** | **~903** | **~145** | **~17** |

#### 5.10.9 Test Port with Code Phase Mapping

| Porting Phase | Source Module | Corresponding Test Directory | Test File Count | Test Lines |
|---------------|---------------|---------------------------|-----------------|------------|
| **P0 (先行)** | — | All `tests/helpers/` | 19 | 2,093 |
| **P1 Shared Kernel** | types, errors, constants, utils, results, lifecycle | `unit/types/` `unit/core/types/` `unit/core/errors.test.ts` `unit/constants/` `unit/utils/` `unit/results/` `unit/lifecycle/` + integration corresponding | ~38 | ~8,500 |
| **P2 Infra Foundation** | storage, events, config, locking, queue, cache | `unit/storage/` `unit/core/storage/` `unit/events/` `unit/config/` `unit/locking/` `unit/queue/` `unit/cache/` + `integration/storage/` `integration/events/` `integration/config/` `integration/cache/` `integration/locking/` `integration/queue/` `integration/migration/` `integration/concurrency/` + `fixtures/migration/` | ~180 | ~42,000 |
| **P3 Security** | security, approvals, cost, compliance, hr | `unit/security/` `unit/approvals/` `unit/cost/` `unit/compliance/` `unit/hr/` + `integration/security/` (64 files!) `integration/approvals/` `integration/compliance/` `integration/cost/` `integration/hr/` | ~115 | ~20,000 |
| **P4 AI Ops Primitives** | providers, tools, workflow, artifacts | `unit/providers/` `unit/tools/` `unit/workflow/` `unit/artifacts/` + `integration/providers/` `integration/tools/` `integration/workflow/` | ~100 | ~22,000 |
| **P5 Runtime** | runtime | `unit/runtime/` `unit/core/runtime/` + `integration/runtime/` `integration/recovery/` `integration/reliability/` `integration/data-integrity/` | ~150 | ~42,000 |
| **P6 OAPEFLIR** | agent-loop, planning, feedback, learning, evaluation, improvement | `unit/core/agent-loop/` `unit/core/planning/` `unit/core/feedback/` `unit/core/learning/` `unit/core/evaluation/` `unit/core/improvement/` | ~56 | ~11,400 |
| **P7 Interaction** | memory, knowledge, messages, gateway | `unit/memory/` `unit/core/memory/` `unit/knowledge/` `unit/core/knowledge/` `unit/messages/` `unit/gateway/` + `integration/memory/` `integration/gateway/` `integration/messages/` | ~70 | ~18,000 |
| **P8 Business Domain** | domain-registry, divisions, plugins | `unit/core/domain-registry/` `unit/divisions/` `unit/plugins/` + `integration/divisions/` | ~40 | ~7,700 |
| **P9 Maturity** | observability, ops, stability, evolution, reliability, product, deployment | `unit/observability/` `unit/ops/` `unit/stability/` `unit/evolution/` `unit/reliability/` `unit/product/` `unit/deployment/` + `integration/observability/` `integration/ops/` `integration/stability/` `integration/evolution/` `integration/product/` `integration/deployment/` | ~165 | ~40,000 |
| **P10 CLI + E2E + Golden** | cli, e2e flows | `unit/cli/` `integration/cli/` (32 files) + `e2e/` (10 files) + `golden/` (8 files) + `performance/` (6 files) + `integration/smoke/` (5 files) + `integration/contract/` (5 files) | ~68 | ~17,500 |

---

## 6. Porting Execution Order

### 6.1 Ten-Phase Porting Roadmap

```
Phase │ Content                          │ Files │ Lines   │ Prerequisites │ Est. Effort
──────┼───────────────────────────────────┼───────┼─────────┼───────────────┼────────────
  P0  │ Test Helpers (先行)                │   19  │  ~2.1K  │ None          │ 0.5 person-days
      │ All tests/helpers/                │       │         │               │
──────┼───────────────────────────────────┼───────┼─────────┼───────────────┼────────────
  1   │ Shared Kernel + Tests             │  ~68  │ ~13.2K  │ P0            │ 1.5 person-days
      │ types/ + errors.ts +              │ src30 │  4.7K   │               │
      │ constants/ + utils/ +             │ test38│  8.5K   │               │
      │ results/ + lifecycle/            │       │         │               │
──────┼───────────────────────────────────┼───────┼─────────┼───────────────┼────────────
  2   │ Infra Foundation + Tests          │ ~325  │ ~71.5K  │ Phase 1       │ 7 person-days
      │ storage/ + events/ + config/      │ src145│ 29.5K   │               │
      │ + locking/ + queue/ + cache/      │ test180│ 42.0K   │               │
      │ + config/ directory + fixtures/   │       │         │               │
──────┼───────────────────────────────────┼───────┼─────────┼───────────────┼────────────
  3   │ Security & Governance + Tests     │ ~141  │ ~28.1K  │ Phase 2       │ 3.5 person-days
      │ security/ + approvals/ +          │  src26│  8.1K   │               │
      │ cost/ + compliance/ + hr/        │ test115│ 20.0K   │               │
──────┼───────────────────────────────────┼───────┼─────────┼───────────────┼────────────
  4   │ AI Ops Primitives + Tests         │ ~163  │ ~41.5K  │ Phase 2       │ 4.5 person-days
      │ providers/ + tools/ +             │  src63│ 19.5K   │               │
      │ workflow/ + artifacts/            │ test100│ 22.0K   │               │
──────┼───────────────────────────────────┼───────┼─────────┼───────────────┼────────────
  5   │ Runtime Core + Tests (after split)│ ~264  │ ~72.3K  │ Phase 2-4     │ 10 person-days
      │ runtime/ → dispatch/lease/        │ src114│ 30.3K   │               │
      │ worker/ha/recovery/              │ test150│ 42.0K   │               │
──────┼───────────────────────────────────┼───────┼─────────┼───────────────┼────────────
  6   │ OAPEFLIR Pipeline + Tests        │ ~119  │ ~15.5K  │ Phase 4-5     │ 3.5 person-days
      │ agent-loop/ + planning/ +         │  src63│  4.1K   │               │
      │ feedback/ + learning/ +          │ test56 │ 11.4K   │               │
      │ evaluation/ + improvement/        │       │         │               │
──────┼───────────────────────────────────┼───────┼─────────┼───────────────┼────────────
  7   │ Interaction Layer + Tests         │ ~124  │ ~28.8K  │ Phase 5-6     │ 4 person-days
      │ memory/ + knowledge/ +           │  src54│ 10.8K   │               │
      │ messages/ + gateway/             │ test70 │ 18.0K   │               │
──────┼───────────────────────────────────┼───────┼─────────┼───────────────┼────────────
  8   │ Business Domain + Tests           │  ~78  │ ~13.5K  │ Phase 2,7     │ 2.5 person-days
      │ domain-registry/ + plugins/       │  src38│  5.8K   │               │
      │ + divisions/ directory           │ test40 │  7.7K   │               │
──────┼───────────────────────────────────┼───────┼─────────┼───────────────┼────────────
  9   │ Operational Maturity + Tests      │ ~271  │ ~72.6K  │ Phase 5       │ 7 person-days
      │ observability/ + ops/ +          │ src106│ 32.6K   │               │
      │ stability/ + evolution/ +        │ test165│ 40.0K   │               │
      │ reliability/ + product/          │       │         │               │
──────┼───────────────────────────────────┼───────┼─────────┼───────────────┼────────────
 10   │ CLI + E2E + Golden + Perf        │ ~146  │ ~23.6K  │ Phase 1-9     │ 4 person-days
      │ + Infra Files                    │  src78│  6.1K   │               │
      │ cli/ + e2e/ + golden/ +          │ test68 │ 17.5K   │               │
      │ performance/ + smoke/ +          │       │         │               │
      │ contract/ + deploy/ + CI         │       │         │               │
```

**Total**: ~1,868 files (source 799 + test 1,069) / ~406K lines (source ~177K + test ~229K) / **~70-100 person-days** (including storage/runtime split, adapter writing, E2E adaptation; excluding 24 new module development)

### 6.2 Documentation Porting Order

```
Batch │ Content                            │ Files │ Priority
──────┼─────────────────────────────────────┼───────┼─────────
 D1   │ Governance + Guide docs (🟢 direct) │   8   │ P0
 D2   │ Contract docs 22 🟢 + ADR 15 🟢      │  37   │ P0
 D3   │ Ops manuals 5 🟢 + ops runbooks      │  ~8   │ P1
 D4   │ Main docs 5 🟡 + tech analysis 2     │   7   │ P1
 D5   │ Contract docs 38 🟡 + ADR 8 🟡      │  46   │ P2
 D6   │ Review docs 3 🟡                     │   3   │ P2
 D7   │ Research docs 28 🔵 move entire      │  28   │ P3
 D8   │ Reference/Archive cleanup标记          │  29   │ P4
```

---

## 7. Key Risks and Mitigations

### 7.1 High-Risk Items

| Risk | Impact | Mitigation |
|------|--------|-----------|
| `runtime/` module too large (114 files / 30K lines) | Regression introduction during porting, interface breakage during split | Before Phase 5, write boundary integration tests; after split, verify all stable-* rehearsals pass |
| `storage/` AuthoritativeTaskStore is god object | Almost all modules depend on it, modification impact enormous | First abstract Repository interface layer, then gradually migrate direct calls to Repository |
| Event namespace expansion (17→25) | Unupdated consumers will miss events | New namespaces first register as Tier 3 (best-effort), upgrade to Tier 1 after confirming consumers are ready |
| Modules needed by new platform but completely missing from old system | §39 NL entry/§40 Goal decomposition/§41 Proactive Agent/§46 Organization hierarchy/§64 Edge etc. need entirely new development | Porting and new feature development in parallel; porting first to establish foundation |

### 7.2 Capabilities Completely Missing from Old System, Needed by New Platform

| v2.7 Section | Capability | New Module Needed |
|--------------|------------|-------------------|
| §39 | Natural Language Task Entry | `core/nl-entry/` — NL parser, intent classification, entity extraction, session management |
| §40 | Goal Decomposition Engine | `core/goal-decomposition/` — Goal graph, subgoal generation, DAG orchestration |
| §41 | Proactive Agent | `core/proactive-agent/` — Trigger engine, scheduled dispatch, event-driven wakeup |
| §42 | Gradual Autonomy | `core/autonomy/` — Trust score, autonomy level state machine, promotion/demotion rules |
| §43 | Unified Operations Dashboard | `core/dashboard/` — Business view aggregation, multi-role dashboard |
| §44 | Non-Technical User UX | `gateway/user-portal/` — Web UI gateway, drag-and-drop orchestration, wizards |
| §46 | Organization Hierarchy Model | `core/org-hierarchy/` — Organization tree, department/team, hierarchy inheritance |
| §47 | Organization Structure Approval Routing | Extend `core/approvals/` — Dynamic routing engine |
| §48 | SSO/SCIM Integration | `core/sso-scim/` — SAML/OIDC SSO, SCIM user sync |
| §49 | Department-Level Compliance Policy | Extend `core/compliance/` — Department-level policy engine |
| §50 | Knowledge Domain Isolation | Extend `core/knowledge/` — Namespace isolation, controlled sharing |
| §52 | Multi-Region Deployment | `core/multi-region/` — Region routing, data sync, failover |
| §53 | Resource Competition Management | `core/resource-scheduler/` — Priority queue, fair scheduling |
| §54 | SLA Tiering Guarantee | `core/sla/` — SLA tier definitions, guarantee policies |
| §59 | Agent Explainability | `core/explainability/` — Decision tracking, causal chain |
| §60 | Emergency Brake | `core/emergency-brake/` — Global brake, tiered brake |
| §61 | Unified Lifecycle Management | `core/agent-lifecycle/` — Create→activate→hibernate→decommission |
| §64 | Edge/Offline Deployment | `core/edge-runtime/` — Offline cache, sync |
| §65 | Behavior Drift Detection | `core/drift-detection/` — Baseline comparison, alerts |
| §66 | Cost Attribution Optimization | Extend `core/cost/` — Multi-dimensional attribution, optimization suggestions |
| §67 | Visualization Debugging | `core/debug-ui/` — Execution visualization, breakpoints |
| §68 | Compliance Report Auto-Generation | Extend `core/compliance/` — Report templates, auto-generation |
| §69 | Multimodal Capability | `core/multimodal/` — Image/audio/video processing |
| §70 | Platform Self-Ops Agent | `core/self-ops-agent/` — Auto inspection, auto repair |

---

## 8. Core Object Migration Matrix

The old system defines ~84 domain entity types (`core/types/`). The new platform v2.7 introduces many new entities and entity splits in organization governance (§46-§51), intelligent interaction (§39-§44), and scale & ecosystem (§52-§57). This section maps old→new entity evolution relationships.

### 8.1 Mapping Type Definitions

| Mapping Type | Symbol | Meaning |
|--------------|--------|---------|
| **1:1 Direct** | → | Field name/semantics unchanged, directly rename or retain |
| **1:1 Enriched** | →+ | Retain original fields, add new required fields |
| **1:N Split** | →⑴⑵… | One old entity split into multiple new entities |
| **N:1 Merge** | ⇒ | Multiple old entities merged into one new entity |
| **Semantic Redefinition** | ⇝ | Same name but fundamental semantic/lifecycle change |
| **New** | ★ | No corresponding entity in old system |
| **Retired** | ✕ | No longer needed |

### 8.2 Core Entity Mapping (Grouped by Domain)

#### Task & Execution Domain

| Old Entity | Mapping | New Entity | Risk | Notes |
|------------|---------|------------|------|-------|
| TaskRecord | →+ | task | Low | Added org_node_id, autonomy_level, sla_tier fields |
| ExecutionRecord | →⑴⑵⑶⑷⑸ | execution + execution_step + execution_artifact + execution_metric + execution_decision_log | High | Split from single row to 5 tables, need data migration script |
| TransitionCommand | ⇝ | state_command + control_directive | High | Fundamental architecture change: commands no longer directly operate on state machine, indirect routing via control_directive |
| SessionRecord | →+ | session | Low | Added channel_type, nl_context fields (§39) |
| WorkflowRecord | →+ | workflow_definition | Low | Added goal_decomposition_tree reference (§40) |
| WorkflowStepRecord | →+ | workflow_step | Low | Added autonomy_gate, explainability_output fields |
| WorkflowStateRecord | →⑴⑵⑶⑷ | workflow_run + loop_cycle + checkpoint + hibernation_snapshot | High | Loop/checkpoint/hibernation separated |

#### Worker & Scheduling Domain

| Old Entity | Mapping | New Entity | Risk | Notes |
|------------|---------|------------|------|-------|
| WorkerRecord | →+ | worker | Low | Added region_id, capability_vector fields |
| LeaseRecord | →+ | lease | Low | Added sla_priority field |
| DispatchRecord | →+ | dispatch_assignment | Low | Added resource_quota, region_affinity fields (§52-§53) |
| AgentExecutionRecord | →⑴⑵⑶⑷⑸ | agent_run + agent_step + tool_invocation + llm_call + agent_decision | High | Observability requirements-driven fine-grained split |

#### Organization & Governance Domain

| Old Entity | Mapping | New Entity | Risk | Notes |
|------------|---------|------------|------|-------|
| ApprovalRecord | →⑴⑵⑶⑷ | decision_record + approval_route + approval_sla + decision_comment | High | Organization structure-aware approval (§47), routing rules changed from hardcoded to dynamic |
| OrganizationRecord + TenantRecord | ⇒ | org_node (hierarchical tree) | High | N:1 merge into recursive organization tree (§46), tenant becomes top-level org_node |
| HrRoleRecord | →+ | role_assignment | Medium | Added delegation_scope, escalation_chain (§51) |
| ComplianceRecord | →+ | compliance_policy | Medium | Added department_scope, geo_region (§49, §52) |

#### Security Domain

| Old Entity | Mapping | New Entity | Risk | Notes |
|------------|---------|------------|------|-------|
| SandboxPolicy | →+ | sandbox_policy | Low | Added department_override field (§49) |
| SecretRecord | → | secret_entry | Low | 1:1 direct |
| AuditRecord | →+ | audit_event | Low | Added compliance_tag, retention_policy fields |

#### Memory & Knowledge Domain

| Old Entity | Mapping | New Entity | Risk | Notes |
|------------|---------|------------|------|-------|
| MemoryRecord | →⑴⑵ | memory_entry + knowledge_document/chunk | High | Need content classifier to distinguish episodic memory and knowledge artifact |
| KnowledgeDocument | →+ | knowledge_document | Medium | Added namespace_id (§50 domain isolation), modality field (§69) |
| EmbeddingRecord | → | embedding_vector | Low | 1:1 direct |

#### AI Operations Domain

| Old Entity | Mapping | New Entity | Risk | Notes |
|------------|---------|------------|------|-------|
| ProviderConfig | →+ | provider_config | Low | Added streaming_error_policy (§15.6) |
| ToolDefinition | →+ | tool_definition | Low | Added modality_support, domain_binding fields |
| PluginManifest | →+ | pack_manifest | Low | Renamed + added marketplace_metadata (§55) |
| ArtifactRecord | →+ | artifact | Medium | Added evidence_chain, compliance_tag, modality fields |
| FeedbackSignal | →+ | feedback_signal | Low | Added signal_source_type enum expansion |
| EvalResult | ⇝ | eval_result | Medium | Evaluation framework changed from post-hoc to inline (§17) |

#### Operations Maturity Domain

| Old Entity | Mapping | New Entity | Risk | Notes |
|------------|---------|------------|------|-------|
| SloDefinition | →+ | slo_definition | Low | Added region_scope field |
| AlertRule | → | alert_rule | Low | 1:1 direct |
| ReleaseRecord | →+ | release | Low | Added canary_config, rollback_policy expansion |
| StabilityScenario | → | rehearsal_scenario | Low | Renamed, semantics unchanged |
| EvolutionProposal | →+ | evolution_proposal | Medium | Added drift_baseline, behavior_fingerprint (§65) |

### 8.3 New Entity List (No Old System Correspondence — ★)

| New Entity | v2.7 Section | Domain |
|------------|--------------|--------|
| org_node | §46 | Organization Governance |
| delegation_scope | §51 | Organization Governance |
| sso_identity | §48 | Organization Governance |
| scim_sync_log | §48 | Organization Governance |
| nl_intent | §39 | Intelligent Interaction |
| goal_tree | §40 | Intelligent Interaction |
| proactive_trigger | §41 | Intelligent Interaction |
| autonomy_level | §42 | Intelligent Interaction |
| trust_score | §42 | Intelligent Interaction |
| dashboard_view | §43 | Intelligent Interaction |
| user_portal_session | §44 | Intelligent Interaction |
| region_config | §52 | Scale & Ecosystem |
| resource_quota | §53 | Scale & Ecosystem |
| sla_tier | §54 | Scale & Ecosystem |
| marketplace_listing | §55 | Scale & Ecosystem |
| integration_connector | §57 | Scale & Ecosystem |
| explainability_trace | §59 | Operations Maturity |
| emergency_brake_event | §60 | Operations Maturity |
| agent_lifecycle_state | §61 | Operations Maturity |
| edge_deployment | §64 | Operations Maturity |
| drift_baseline | §65 | Operations Maturity |
| cost_attribution | §66 | Operations Maturity |
| debug_session | §67 | Operations Maturity |
| compliance_report | §68 | Operations Maturity |
| multimodal_asset | §69 | Operations Maturity |
| self_ops_task | §70 | Operations Maturity |

### 8.4 Migration Statistics

| Mapping Type | Entity Count | Percentage |
|--------------|-------------|------------|
| 1:1 Direct (→) | ~12 | 14% |
| 1:1 Enriched (→+) | ~22 | 26% |
| 1:N Split (→⑴⑵…) | ~5 | 6% |
| N:1 Merge (⇒) | ~2 | 2% |
| Semantic Redefinition (⇝) | ~3 | 4% |
| New (★) | ~26 | 31% |
| Retired (✕) | ~14 | 17% |
| **Total** | **~84** | 100% |

### 8.5 Data Migration Strategy

The object migration matrix defines "what changes to what". This section defines "how to change". Based on risk level and data volume, three migration modes are adopted:

#### Migration Mode Definitions

| Mode | Applicable Scenario | Execution Method | Downtime Requirement |
|------|---------------------|------------------|---------------------|
| **One-time Offline Migration** | Low-risk, 1:1 direct/enriched mapping | Write migration script, execute once during maintenance window | Short downtime (minutes) |
| **Dual-Write Transition** | High-risk entity split/merge, business cannot be interrupted | Write to both old+new tables simultaneously during write, gradually switch reads to new table, deprecate old table after verifying consistency | Zero downtime |
| **Lazy Migration** | Long-tail low-frequency objects, full migration cost unjustifiable | Check version on access, upgrade to new format on-demand | Zero downtime |

#### Entity Migration Mode Assignment

| Entity | Mapping Type | Migration Mode | Phase | Notes |
|--------|-------------|----------------|-------|-------|
| TaskRecord | →+ | One-time offline | P2 | New fields can have defaults, ALTER TABLE + backfill |
| SessionRecord | →+ | One-time offline | P2 | Same as above |
| WorkerRecord | →+ | One-time offline | P2 | Same as above |
| LeaseRecord | →+ | One-time offline | P2 | Same as above |
| ProviderConfig | →+ | One-time offline | P4 | Same as above |
| SecretRecord | → | One-time offline | P3 | 1:1 rename |
| SloDefinition | →+ | One-time offline | P9 | Same as above |
| **ExecutionRecord** | →⑴⑵⑶⑷⑸ | **Dual-write transition** | P2→P5 | 1:5 split, create new tables at P2, start dual-write, switch reads at P5 after verifying consistency |
| **WorkflowStateRecord** | →⑴⑵⑶⑷ | **Dual-write transition** | P2→P6 | 1:4 split, loop/checkpoint/hibernation separated, switch reads after OAPEFLIR complete |
| **ApprovalRecord** | →⑴⑵⑶⑷ | **Dual-write transition** | P3→P5 | 1:4 split, organization approval routing changed, switch reads after Runtime complete |
| **AgentExecutionRecord** | →⑴⑵⑶⑷⑸ | **Dual-write transition** | P5 | 1:5 split, observability-driven |
| **MemoryRecord** | →⑴⑵ | **Dual-write transition** | P7 | Need content classifier to distinguish episodic memory and knowledge artifact |
| **OrganizationRecord + TenantRecord** | ⇒ | **Dual-write transition** | P3 | N:1 merge into org_node hierarchical tree, read/write paths fundamentally changed |
| **TransitionCommand** | ⇝ | **Dual-write transition** | P5 | Semantic redefinition, command routing fundamentally changed |
| EvalResult | ⇝ | Lazy migration | P6 | Evaluation record access frequency low, upgrade on access |
| EvolutionProposal | →+ | Lazy migration | P9 | Historical proposals upgraded on access |
| KnowledgeDocument | →+ | Lazy migration | P7 | Existing documents supplement namespace_id on access |

#### Dual-Write Transition Execution Process

```
Phase 1: Create new tables       → CREATE TABLE new_xxx (new schema)
Phase 2: Enable dual-write       → Write to both old_xxx + new_xxx simultaneously
Phase 3: Shadow reads            → Read both tables simultaneously, compare results, log differences
Phase 4: Switch primary reads     → Primary reads switch to new_xxx, old_xxx becomes secondary
Phase 5: Verification period      → Run ≥1 complete Phase cycle, confirm zero discrepancies
Phase 6: Deprecate old table      → DROP TABLE old_xxx
```

Each dual-write object must have an assigned owner, and Phase exit conditions must include "dual-write consistency verification passed".

---

## 9. High-Risk Special: storage / AuthoritativeTaskStore Split

### 9.1 Current State Analysis

`AuthoritativeTaskStore` (`src/core/storage/authoritative-task-store.ts`) is the current system's global data access facade:

| Metric | Value |
|--------|-------|
| Public method count | ~278 domain methods + 27 structural properties = ~305 public surface |
| Underlying Repository count | 21 (task, workflow, execution, session, event, worker, approval, billing, lease, lock, memory, artifact, dispatch, division, secret, marketplace, release, organization, intelligence, evolution, operations) |
| Consumer file count | ~123 source files directly depend (with tests 200+) |
| Code lines | 101 files / 26,102 lines in directory |

**Core Problem**: god object anti-pattern — single class bears data access responsibility for 21 domains, causing any storage layer change to impact entire system.

### 9.2 Split Target Modules (7 Bounded Contexts)

| # | Bounded Context | Method Count | Contained Repositories | Split Strategy |
|---|-----------------|-------------|------------------------|----------------|
| 1 | **Core Task Engine** | ~73 | task, workflow, execution, session | Retain as core — high inter-method coupling,不宜进一步拆分 |
| 2 | **Worker Infrastructure** | ~47 | worker, dispatch, lease, lock | Extract — scheduling/lease/worker lifecycle are independent domains |
| 3 | **Event Infrastructure** | ~24 | event | Extract — event bus already has clear boundary |
| 4 | **Billing & Cost** | ~29 | billing | Extract — billing logic decoupled from core execution |
| 5 | **Governance & Compliance** | ~50 | approval, organization, secret, compliance, operations | Extract — organization governance independent domain (align with v2.7 Layer 5) |
| 6 | **Platform & Commerce** | ~47 | marketplace, release, division, intelligence, evolution | Extract — platform operations independent domain (align with v2.7 Layer 6-7) |
| 7 | **Memory & Artifacts** | ~10 | memory, artifact | Extract — knowledge/memory independent domain (align with v2.7 Layer 4) |

### 9.3 Split Execution Plan

**Prerequisite**: AuthoritativeTaskStore internally delegates via named Repositories, splitting infrastructure already in place, only need to migrate consumers.

| Step | Action | Est. Effort | Risk |
|------|--------|-------------|------|
| S1 | Define TypeScript interfaces for 7 bounded contexts (Repository contracts) | 2 person-days | Low |
| S2 | Implement facade adapter — AuthoritativeTaskStore temporarily delegates to new interface, maintain backward compatibility | 3 person-days | Low |
| S3 | Migrate consumers module by module: replace `store.xxx()` calls with corresponding Repository interface injection | 8 person-days | Medium — each consumer needs verification |
| S4 | Remove AuthoritativeTaskStore facade, each bounded context independently registers to ServiceRegistry | 2 person-days | Medium |
| S5 | Update all unit/integration test store mocks | 3 person-days | Medium |
| S6 | Run full regression + stable-* rehearsal verification | 2 person-days | Low |
| **Total** | | **~20 person-days** | |

### 9.4 Migration Sequence Recommendation

```
Wave 1 (低风险提取): Event Infrastructure → Memory & Artifacts
  ↓ Verification: all event-related tests pass
Wave 2 (中风险提取): Billing & Cost → Worker Infrastructure
  ↓ Verification: all dispatch/lease-related tests pass
Wave 3 (高风险提取): Governance & Compliance → Platform & Commerce
  ↓ Verification: all organization/approval/marketplace-related tests pass
Wave 4 (收尾): Remove facade, Core Task Engine becomes independent module
  ↓ Verification: npm test full pass + stable-* rehearsals pass
```

---

## 10. High-Risk Special: runtime/ Bounded Context Split

### 10.1 Current State Analysis

`src/core/runtime/` is the system's largest module:

| Metric | Value |
|--------|-------|
| File count | 101 .ts files |
| Code lines | 30,348 lines |
| Identified bounded contexts | 12 |

### 10.2 Bounded Context Decomposition

| BC# | Bounded Context | Files | Lines | Internal Dependencies | Can Extract Independently |
|-----|-----------------|-------|-------|---------------------|-------------------------|
| BC1 | Execution Dispatch | 12 | 2,744 | 3 | No — composition root |
| BC2 | Lease Management | 8 | 1,807 | 1 | Yes — clean repo pattern |
| BC3 | Worker Management | 10 | 1,434 | 0 | **Yes — zero internal dependencies, best extraction target** |
| BC4 | Handshake/Writeback | 10 | 2,058 | 2 | No — depends on BC1+BC2 |
| BC5 | HA Coordinator | 8 | 1,849 | 0 | **Yes — zero internal dependencies** |
| BC6 | Hot Upgrade | 6 | 1,952 | 0 | **Yes — zero internal dependencies** |
| BC7 | Recovery & Repair | 13 | 3,620 | 4 | No — depends on multiple BCs |
| BC8 | State Transition | 4 | 901 | 0 | **Yes — zero internal dependencies** |
| BC9 | Agent Execution Engine | 12 | 2,990 | 1 | Yes — only depends on BC8 |
| BC10 | Multi-Step Orchestration | 13 | 2,427 | 5 | No — composition root, stay in runtime/ |
| BC11 | Infrastructure | 13 | 2,498 | 0 | Yes — utility classes |
| BC12 | HITL & Governance | 2 | 1,166 | 0 | **Yes — zero internal dependencies** |

### 10.3 Extraction Wave Plan

| Wave | Extraction Target | Lines | Percentage | Risk | Verification |
|------|------------------|-------|------------|------|--------------|
| **Wave 1** (零风险) | BC3 Worker + BC5 HA + BC6 Hot Upgrade + BC8 State Transition | 6,136 | 20% | Low — zero internal dependencies | Each BC unit tests independently pass |
| **Wave 2** (低风险) | BC2 Lease + BC9 Agent Execution + BC12 HITL + BC11 Infrastructure | 6,461 | 21% | Low — ≤1 dependency | lease/agent integration tests pass |
| **Wave 3** (中风险) | BC4 Handshake/Writeback + BC7 Recovery | 5,678 | 19% | Medium — multiple dependencies | recovery rehearsal scenarios pass |
| **Wave 4** (收尾) | BC1 Dispatch + BC10 Orchestration stay as runtime/ core | 5,171 | 17% | Low — only reorganization | npm test full pass |

### 10.4 Est. Effort

| Action | Effort |
|--------|--------|
| BC interface definition (12) | 3 person-days |
| Wave 1 extraction + tests | 4 person-days |
| Wave 2 extraction + tests | 5 person-days |
| Wave 3 extraction + tests | 5 person-days |
| Wave 4 wrap-up + full regression | 3 person-days |
| **Total** | **~20 person-days** |

### 10.5 Alignment with New Architecture

| Post-Extraction Module | v2.7 Target Section | New Capability |
|----------------------|---------------------|----------------|
| Worker Management | §53 Resource Competition | Fair scheduling, priority queue |
| HA Coordinator | §31 HA | Multi-Region leader election (§52) |
| State Transition | §9 State Machine | Extended state set (hibernation/delegation) |
| Agent Execution | §13 OAPEFLIR | §42 Autonomy assessment stage |
| HITL & Governance | §21 HITL | §47 Organization approval routing |
| Lease Management | §31 Lease | §54 SLA tiered lease priority |

---

## 11. New Module Priority and Dependency Graph

### 11.1 Priority Classification

24 modules completely missing from old system, needed by new platform, classified by business blocking relationship into P0/P1/P2:

| Priority | Meaning | Count |
|----------|---------|-------|
| **P0 — Foundation Capability** | Without these, new platform cannot be distinguished from old system, blocks upper modules | 6 |
| **P1 — Core Differentiation** | Key new platform capabilities, but does not block P0 module porting | 10 |
| **P2 — Operational Enhancement** | Nice-to-have, can be delivered gradually after platform stabilizes | 8 |

### 11.2 P0 Foundation Capabilities (6)

| Module | v2.7 Section | Dependencies | Notes |
|--------|--------------|--------------|-------|
| `core/org-hierarchy/` | §46 | None | Organization hierarchy model is foundation for §47-§51, develop first |
| `core/nl-entry/` | §39 | None | Natural language entry is new platform's core interaction mode |
| `core/goal-decomposition/` | §40 | nl-entry | Goal decomposition engine depends on NL intent parsing |
| `core/autonomy/` | §42 | org-hierarchy | Autonomy model depends on organizational trust chain |
| `core/sso-scim/` | §48 | org-hierarchy | SSO/SCIM depends on organization model |
| `core/emergency-brake/` | §60 | None | Emergency brake is security foundation, can develop independently |

### 11.3 P1 Core Differentiation (10)

| Module | v2.7 Section | Dependencies | Notes |
|--------|--------------|--------------|-------|
| `core/proactive-agent/` | §41 | autonomy, nl-entry | Proactive Agent needs autonomy and NL capabilities |
| `core/agent-lifecycle/` | §61 | autonomy | Unified lifecycle depends on autonomy level |
| `core/explainability/` | §59 | agent-lifecycle | Explainability depends on lifecycle events |
| `core/multi-region/` | §52 | org-hierarchy | Multi-Region depends on organization topology |
| `core/resource-scheduler/` | §53 | multi-region | Resource scheduling depends on Region config |
| `core/sla/` | §54 | org-hierarchy, resource-scheduler | SLA depends on organization + resources |
| `core/drift-detection/` | §65 | agent-lifecycle | Drift detection depends on behavior baseline |
| `core/dashboard/` | §43 | org-hierarchy | Dashboard depends on organization view |
| Extend `core/approvals/` | §47 | org-hierarchy | Organization approval routing |
| Extend `core/compliance/` | §49 | org-hierarchy | Department-level compliance |

### 11.4 P2 Operational Enhancement (8)

| Module | v2.7 Section | Dependencies | Notes |
|--------|--------------|--------------|-------|
| `gateway/user-portal/` | §44 | nl-entry, dashboard | Non-technical user UX |
| `core/marketplace/` | §55 | agent-lifecycle | Marketplace ecosystem |
| `core/edge-runtime/` | §64 | multi-region | Edge/offline deployment |
| `core/cost-attribution/` | §66 | sla, org-hierarchy | Cost attribution optimization |
| `core/debug-ui/` | §67 | explainability | Visualization debugging |
| `core/compliance-report/` | §68 | compliance | Compliance report auto-generation |
| `core/multimodal/` | §69 | None | Multimodal capability |
| `core/self-ops-agent/` | §70 | agent-lifecycle, drift-detection | Platform self-ops |

### 11.5 Dependency Graph

```
                    ┌─ org-hierarchy (P0) ─────────────────────────────────┐
                    │        │            │           │          │         │
                    │    sso-scim(P0)  autonomy(P0) multi-region(P1)  dashboard(P1)
                    │                     │    │         │          approvals(P1)
                    │               proactive(P1) agent-lifecycle(P1)  compliance(P1)
                    │                     │         │        │           sla(P1)
                    │                     │   explainability(P1)  drift-detection(P1)
                    │                     │         │                    │
                    │                     │    debug-ui(P2)    self-ops-agent(P2)
                    │                     │
 nl-entry (P0) ────┤                     │
      │            │               resource-scheduler(P1)
 goal-decomp(P0)   │                     │
      │            │              edge-runtime(P2)
 user-portal(P2)   │
                    │         marketplace(P2)  cost-attribution(P2)
                    │
 emergency-brake(P0) ── 独立，无依赖
 multimodal(P2) ──── 独立，无依赖
 compliance-report(P2) ── 依赖 compliance(P1)
```

---

## 12. Execution Recommendations

### 12.1 Porting Principles

1. **Port 🟢 Direct Port items first**: Zero modification cost, quickly establish new platform code foundation
2. **Port in dependency order**: Shared Kernel → Infrastructure → Security → AI Ops → Runtime → OAPEFLIR → Interaction → Domain → Maturity → CLI
3. **Run corresponding tests after each Phase port completion**: Ensure no regression introduced
4. **Port documentation and code synchronously**: Each code Phase's corresponding contracts/ADRs move together
5. **Parallel new feature development and porting**: Porting team and new feature team can work simultaneously

### 12.2 Dual-Track Migration Strategy

"Parallel porting and new feature development" requires clear lane division and intersection rules, otherwise easy to block each other.

#### Lane A: Migration Lane

| Responsibility | Content |
|----------------|---------|
| P0-P10 Code Migration | Execute per §6 ten-phase roadmap |
| Storage Split | §9 AuthoritativeTaskStore 4-wave split |
| Runtime Split | §10 runtime 4-wave split |
| Test Regression | Each Phase exit gate (§13) |
| Contract/Documentation Migration | Synchronize with code Phase |
| Data Migration Scripts | Dual-write/offline migration for high-risk entities in §8 |

#### Lane B: New Capability Lane

| Responsibility | Content |
|----------------|---------|
| P0 Foundation | org-hierarchy / nl-entry / goal-decomposition / autonomy / sso-scim / emergency-brake |
| P1 Differentiation | proactive-agent / agent-lifecycle / explainability / multi-region / resource-scheduler / sla / drift-detection / dashboard / approval routing extension / department compliance extension |
| P2 Enhancement | user-portal / marketplace / edge-runtime / cost-attribution / debug-ui / compliance-report / multimodal / self-ops-agent |

#### Intersection Points and Dependency Rules

| Intersection | Migration Lane Prerequisite | New Capability Lane Action | Strategy |
|--------------|---------------------------|---------------------------|----------|
| **org-hierarchy integration** | P3 Security complete (hr/approvals migrated) | org-hierarchy module connects via adapter to migrated hr/approvals | New capability lane can develop with **stub interface** first, replace with real implementation after P3 |
| **autonomy integration** | P5 Runtime complete (state machine migrated) | autonomy module connects to state-transition BC | New capability lane defines StateTransition interface stub first, integrate after P5 Wave 1 complete |
| **nl-entry integration** | P4 AI Ops complete (providers migrated) | nl-entry uses migrated LLM provider | New capability lane can develop with mock provider first, switch after P4 |
| **agent-lifecycle integration** | P6 OAPEFLIR complete | agent-lifecycle extends OAPEFLIR loop | Must wait for P6, cannot stub |
| **multi-region integration** | P5 Runtime complete (HA/dispatch extracted) | multi-region extends extracted HA Coordinator | Must wait for P5 Wave 1 complete |
| **Knowledge domain isolation** | P7 Interaction complete (knowledge migrated) | §50 knowledge domain isolation extends knowledge module | Must wait for P7 complete |

#### Stub Strategy

Modules that can be stubbed first then integrated later (new capability lane can start early):
- `org-hierarchy` — stub `OrgNodeRepository` interface, return single-layer organization
- `autonomy` — stub `AutonomyGate`, return LEVEL_1 (lowest autonomy) by default
- `nl-entry` — stub `IntentClassifier`, pass through original text
- `emergency-brake` — stub `BrakeService`, no brake by default

Modules that must wait for migration complete before integration (hard dependencies):
- `agent-lifecycle` — depends on complete OAPEFLIR loop (P6)
- `multi-region` — depends on real HA Coordinator (P5)
- `drift-detection` — depends on real behavior baseline data (P9)
- `self-ops-agent` — depends on complete platform capability (after P10)

### 12.3 Porting Checklist

For each module port, complete:

- [ ] Copy source files to new project corresponding directory
- [ ] Update import path (if path changed after seven-layer directory reorganization)
- [ ] Synchronously copy `tests/unit/<module>/` and `tests/unit/core/<module>/` to new project
- [ ] Synchronously copy `tests/integration/<module>/` to new project
- [ ] Run that module's unit tests, confirm all pass
- [ ] Run related integration tests, confirm all pass
- [ ] If golden test involves that module, update snapshot and verify
- [ ] If e2e test involves that module, verify end-to-end flow passes
- [ ] If performance test involves that module, verify performance baseline met
- [ ] Update module's contract document references (§ numbering)
- [ ] Register in new platform's module-inventory
- [ ] Confirm zero TypeScript compilation errors
- [ ] Run `npm run test:unit` full regression

### 12.4 Do-Not-Port List

The following content is **explicitly not ported**, archived only:

| Content | Reason |
|---------|--------|
| All `docs_zh/archive/` | Historical archive |
| 9 ⚪ D files in `docs_zh/reference/` | Replaced by v2.7 |
| `docs_zh/automatic_agent_platform/agent_platform.md` (92K lines) | Unexpurgated old version, replaced by v2.7 (6.7K lines) |
| Intermediate translation fragment files in `docs_zh/automatic_agent_platform/` | chunk_b-j, part1-6 are translation intermediate products |
| 6 ⚪ D files in `docs_zh/reviews/` | Old reviews |
| 10 ⚪ D contracts in `docs_zh/contracts/` | Early v1.x contracts |

---

## 13. Phase Entry and Exit Criteria

Each porting Phase must meet clear entry conditions (Definition of Ready) and exit conditions (Definition of Done). Cannot proceed to next Phase without meeting criteria.

| Phase | Entry Conditions | Exit Conditions (Definition of Done) |
|-------|-----------------|--------------------------------------|
| **P0 Test Helpers** | New project repo initialized, tsconfig/eslint/package.json in place | All 19 helper files pass `tsc --noEmit`; `createTempWorkspace()` available in new project |
| **P1 Shared Kernel** | P0 exit criteria met | types/errors/constants/utils/results/lifecycle all compile; 38 unit tests all green; zero external runtime dependencies |
| **P2 Infra Foundation** | P1 exit criteria met | storage/events/config/locking/queue/cache compile; 180 unit tests + related integration tests all green; SQLite migration ledger integrity verified; `npm run test:unit` full regression green |
| **P3 Security** | P2 exit criteria met | security/approvals/cost/compliance/hr compile; 115 tests green; 64 security boundary integration tests all pass (including sandbox escape/path traversal/SSRF rejection paths) |
| **P4 AI Ops** | P2 exit criteria met | providers/tools/workflow/artifacts compile; 100 tests green; Provider CircuitBreaker integration tests pass |
| **P5 Runtime** | P2+P3+P4 exit criteria met | runtime 12 BCs extracted by wave; 150 tests green; stable-* rehearsal scenarios all pass; dispatch/lease/recovery integration tests pass |
| **P6 OAPEFLIR** | P4+P5 exit criteria met | agent-loop/planning/feedback/learning/evaluation/improvement compile; 56 tests green; OAPEFLIR 8-stage full cycle E2E passes |
| **P7 Interaction** | P5+P6 exit criteria met | memory/knowledge/messages/gateway compile; 70 tests green; session→memory→retrieval end-to-end passes |
| **P8 Business Domain** | P2+P7 exit criteria met | domain-registry/divisions/plugins compile; 40 tests green; at least 1 division end-to-end loads successfully |
| **P9 Maturity** | P5 exit criteria met | observability/ops/stability/evolution/reliability/product/deployment compile; 165 tests green; health check + SLO alerting integration tests pass |
| **P10 CLI + E2E** | P1-P9 all exit criteria met | CLI 78 entries compile; 10 E2E tests green; 8 golden test snapshots match; 6 performance tests meet baseline; `npm test` full regression green; `npm run build` generates dist/ successfully |

### 13.1 Module-Level Deliverable Acceptance Template

Phase DoD defines phase-wide gate, but each **module** after migration completion must deliver the following 5 items, incomplete items cannot be marked "complete":

| Deliverable | Content | Acceptance Criteria |
|-------------|---------|---------------------|
| **Code** | Migrated source code, placed in new project target directory | `tsc --noEmit` zero errors; import paths updated; no references to old project paths |
| **Contract** | interface/schema/contract document updates | New adapter interfaces have JSDoc; if DB schema changes involved, migration files created |
| **Tests** | unit + integration + (if applicable) e2e regression | All tests for that module green; new adapters have corresponding unit tests |
| **Documentation** | module-inventory registration + contract references (§ numbering) update | Module name/file count/lines/owner registered in new platform module-inventory.md |
| **Migration Notes** | Compatibility/breaking change records | Record: (1) interface change list (2) deprecated APIs (3) new dependencies (4) config item changes |

**Template Example** (using `core/events/` as example):

```
Module: core/events/
Phase: P2
Deliverable Checklist:
  [x] Code: 8 files migrated to new-project/src/core/events/, tsc passes
  [x] Contract: Added 8 event namespace interfaces (delegation.*/hibernation.*/...)
  [x] Tests: 10 unit tests + 2 integration tests all green
  [x] Documentation: module-inventory registered, contract references updated to v2.7 §28
  [x] Migration Notes: Breaking change — EventBus.emit() signature added namespace parameter
```

### 13.2 Regression Gate

At each Phase exit, run:
1. `tsc --noEmit` — zero compilation errors
2. `npm run test:unit` — full unit tests green
3. Subset of `npm run test:integration` for that Phase green
4. `npm run build` — dist/ can be generated

### 13.3 Blocking Escalation Rules

- When any Phase exit criteria unmet, that Phase marked **BLOCKED**
- BLOCKED Phase's downstream Phases cannot start
- After fix, need to run complete exit verification again

---

## 14. Migration Freeze Line

During migration, the following tech stack **frozen unchanged**, to avoid introducing extra uncertainty:

| Frozen Item | Current Version/Selection | Freeze Reason |
|-------------|--------------------------|---------------|
| **Test Framework** | Node.js 22 built-in `node:test` + `assert/strict` | 1,069 test files depend, switching framework equals rewrite |
| **Module System** | TypeScript ESM (`.js` extension imports) | Full ESM, switching CJS affects all imports |
| **Database Backend** | SQLite (Phase 1-2) + PostgreSQL (optional) | storage layer 101 files + all test fixtures based on SQLite |
| **CLI Framework** | Direct `process.argv` parsing + 78 thin scripts | CLI is thin wrapper of service, changing framework brings no benefit |
| **Observability Stack** | OpenTelemetry + Prometheus + StructuredLogger | 36 observability files + SLO alerting depend |
| **Config Validation** | Zod schema | 27 config files + 8-layer config governance depend |
| **Package Manager** | npm | CI workflows + scripts depend |

### 14.1 Freeze Line Change Process

If change to frozen item truly necessary:
1. Submit ADR explaining change reason and impact scope
2. Evaluate affected file count and test count
3. Obtain architecture owner approval
4. Changes must be completed on independent branch, not crossing with porting work

---

## 15. Effort Estimation and Assumptions

### 15.1 Effort Breakdown

| Work Item | Person-days | Notes |
|-----------|-------------|-------|
| P0-P1 file move + compilation fix | 2 | Zero-modification modules |
| P2 Infra (including storage split §9) | 27 | storage split 20 person-days + remaining infra 7 person-days |
| P3 Security | 4 | Security test verification为主 |
| P4 AI Ops | 5 | providers/tools adapter writing |
| P5 Runtime (including runtime split §10) | 30 | runtime split 20 person-days + integration verification 10 person-days |
| P6-P8 OAPEFLIR + Interaction + Domain | 10 | Mainly adaptation work |
| P9 Maturity | 7 | observability/ops/stability |
| P10 CLI + E2E + Full Regression | 8 | E2E adaptation + golden updates + performance verification |
| Buffer (20%) | 7 | Unforeseen compatibility issues |
| **Porting Total** | **~100 person-days** | |

### 15.2 Assumptions

1. 1 person-day = 8 hours effective development time
2. Team has TypeScript ESM + Node.js 22 experience
3. storage/runtime split can each assign 1 dedicated person
4. Porting and 24 new module development **in parallel**, new module development effort not included in this estimate
5. Does not include environment setup, CI configuration, code review and other management overhead
6. v1.0's 48 person-days was pure file move scope (copy+import fix), does not include god object split, adapter writing, E2E test adaptation

---

## Appendix A: Porting Quantification Statistics

| Metric | Value |
|--------|-------|
| **Source Code** | |
| Total source file count | 799 |
| Total source lines | ~174,585 |
| 🟢 Direct port code modules | 18 (~27K lines) |
| 🟡 Adapted port code modules | 25 (~147K lines) |
| 🔵 Reference-only code modules | 3 (~8.9K lines) |
| **Tests** | |
| Total test files | 1,069 |
| Total test lines | ~229,196 |
| 🟢 Direct port tests | ~903 files (~192K lines) |
| 🟡 Adapted port tests | ~145 files (~34K lines) — storage/runtime/CLI/security/recovery/e2e |
| 🔵 Reference-only tests | ~17 files (~3K lines) — soak tests + performance.bak |
| Test infrastructure (helpers) | 19 files / 2,093 lines — 16 🟢 + 3 🟡 |
| **Documentation** | |
| Total doc files | ~243 |
| 🟢 Direct port docs | ~48 files |
| 🟡 Adapted port docs | ~74 files |
| 🔵 Reference-value docs | ~84 files |
| ⚪ Archive/retire docs | ~37 files |
| **Other Assets** | |
| config/ directory | 27 JSON files — all direct port |
| divisions/ directory | 11 division definitions — 🟡 adapted port (need DomainDescriptor semantic model adaptation) |
| **New Development** | |
| Modules needing entirely new development for new platform | 24 (missing from old system in v2.7 §39-§70) |
| **Total** | |
| Total porting files | ~1,868 (source 799 + test 1,069) |
| Total porting lines | ~406K (source ~177K + test ~229K) |
| Est. total porting effort | **~70-100 person-days** (including tests, storage/runtime split adaptation, adapter writing; excluding 24 new feature module development. v1.0's 48 person-days was only file move scope, did not include god object split, interface adaptation, E2E test adaptation) |
