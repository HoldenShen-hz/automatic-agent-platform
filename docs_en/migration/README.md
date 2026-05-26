# Legacy System → New Platform Migration Assessment Document

> **Document Version**: v1.1
> **Document Status**: Draft
> **Assessment Scope**: `docs_zh/` (excluding `docs_zh/automatic_agent_platform/`) + `src/` + `config/` + `divisions/` + `tests/`
> **Target System**: "Enterprise-Level Agent Platform Overall Technical Architecture Design Document" v2.7 (§1-§70, seven-layer architecture)
> **Assessment Date**: 2026-04-19

---

## 1. Assessment Purpose

The legacy system (automatic-agent-system-main) has **797 source files / 174,585 lines of code** and **200+ document files**. The new platform architecture design document v2.7 defines a seven-layer enterprise architecture. This document answers:

1. **Which doc files** can be directly ported, adapted and ported, or archived?
2. **Which code modules** can be directly ported, adapted and ported, or need rewriting?
3. **What is the migration priority and recommended execution order?**

---

## 2. Assessment Methodology

### 2.1 Migration Tier Definitions

| Tier | Tag | Meaning | Typical Adaptation Scope |
|------|-----|---------|--------------------------|
| **A1 — Direct Port** | 🟢 | Zero modification copy-and-use. Interfaces, naming, and dependencies are all compatible with new architecture | 0 — copy + import path update only |
| **A2 — Implementation Reuse with Adapter** | 🟢🔧 | Core implementation unchanged, need adapter/wrapper to align with new architecture extension points | ≤15% — add adapter layer or supplement missing interfaces |
| **B — Adapted Port** | 🟡 | Core logic reusable, but needs adaptation to new architecture interfaces/naming/layering | 15%-50% — interface refactor + dependency replacement |
| **C — Reference Value** | 🔵 | Not directly ported, but design concepts/test cases/competitive analysis have reference value | N/A — reference only, no code migration |
| **D — Archive/Retire** | ⚪ | Obsolete or replaced by new design, historical archiving only | N/A — archive |

### 2.2 Five-Dimensional Judgment Template

Each module/document's tier determination must provide evidence across five dimensions:

| Dimension | Meaning | Scoring Criteria |
|-----------|---------|------------------|
| **Architecture Alignment** | Degree of interface/layer alignment with v2.7 target architecture | High=direct interface alignment / Medium=needs adapter / Low=needs rewrite |
| **Dependency Pollution** | Coupling degree to external modules, affecting independent porting capability | Low=≤2 direct dependencies / Medium=3-5 / High=≥6 or circular dependencies |
| **Interface Stability** | Expected change to public APIs during migration | High=unchanged / Medium=extension but compatible / Low=breaking changes |
| **Test Coverage** | Existing tests' coverage of core behavior | High=full behavior coverage / Medium=main path coverage / Low=insufficient coverage |
| **Adaptation Scope** | Proportion of code needing changes relative to total module size | Small=≤15% / Medium=15%-50% / Large=≥50% |

**Judgment Rules**:
- **A1**: All five dimensions are "High/Low/High/High/Small"
- **A2**: Architecture alignment ≥ Medium, adaptation scope ≤15%, but needs new adapter/wrapper
- **B**: Core reusable but at least one dimension is "Low" or adaptation scope >15%
- **C**: Architecture alignment is "Low" and adaptation scope ≥50%
- **D**: Explicitly replaced or deprecated by v2.7

### 2.3 New Architecture Seven-Layer Mapping

```
Layer 7 │ Operational Maturity Layer (Explainability · Emergency Brake · Lifecycle · Edge · Drift · Cost · Debug · Compliance · Capacity · Multimodal · Self-Ops)
Layer 6 │ Scale Operations Layer + Ecosystem Layer (Multi-Region · Resource Competition · SLA · Marketplace · Feedback · Integration)
Layer 5 │ Organization Governance Layer (Org Hierarchy · Approval Routing · SSO · Compliance · Knowledge Isolation · Delegation)
Layer 4 │ Intelligent Interaction Layer (NL Entry · Goal Decomposition · Proactive Agent · Autonomy · Dashboard · UX)
Layer 3 │ Business Domain Access Layer (DomainDescriptor · Recipe · Runbook)
Layer 2 │ AI Operations Layer (LLM Abstraction · Prompt · Eval · Cost · HITL · SDK)
Layer 1 │ Infrastructure Layer (Five-Plane · Stability · Risk · Security · Recovery · Audit)
```

---

## 3. Overview Matrix

### 3.1 Document Port Overview

| Category | File Count | 🟢 Direct | 🟡 Adapted | 🔵 Reference | ⚪ Archive |
|----------|-----------|-----------|-----------|--------------|------------|
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

### 3.2 Code Port Overview

| Architecture Layer | Module | File Count | Lines | 🟢 | 🟡 | 🔵 | ⚪ |
|--------|------|--------|------|-----|-----|-----|-----|
| Layer 1 Infrastructure | types, errors, storage, events, config, cache, locking, queue, api, lifecycle, constants, utils, resource, results | ~230 | ~50K | 8 modules | 5 modules | 1 module | 0 |
| Layer 2 AI Operations | runtime, agent-loop, planning, tools, providers, workflow, orchestration, artifacts, feedback, learning, evaluation | ~230 | ~58K | 3 modules | 7 modules | 1 module | 0 |
| Layer 3 Business Domain | domain-registry, divisions, plugins | ~38 | ~5.7K | 2 modules | 1 module | 0 | 0 |
| Layer 4 Intelligent Interaction | memory, knowledge, messages, gateway | ~54 | ~10.7K | 1 module | 3 modules | 0 | 0 |
| Layer 5 Organization Governance | security, approvals, compliance, cost, hr | ~28 | ~8.6K | 2 modules | 3 modules | 0 | 0 |
| Layer 6 Scale Operations | deployment, improvement, product (partial) | ~35 | ~8.4K | 0 | 2 modules | 1 module | 0 |
| Layer 7 Operational Maturity | observability, ops, stability, evolution, reliability | ~106 | ~32.6K | 2 modules | 3 modules | 0 | 0 |
| Cross-layer CLI | cli | 78 | ~6.1K | 0 | 1 (entire) | 0 | 0 |
| **Total** | **43 modules** | **~799** | **~180K** | **18** | **25** | **3** | **0** |

---

## 4. Document Port Detailed Assessment

### 4.1 Main Documents (docs_zh/architecture/)

| File | Lines | Tier | Target Architecture Layer | Port Notes |
|------|------|------|--------------------------|------------|
| `00-platform-architecture.md` | ~2,000 | 🟡 B | Cross-layer | Document layering governance model (L0-L10) reusable, need to update to seven-layer architecture document system |
| `01-code-structure.md` | ~500 | 🟡 B | Layer 1-2 | Directory structure + control-plane role definition reusable, need to align with v2.7 §1-§5 |
| `02-code-architecture-reference.md` | ~800 | 🟡 B | Layer 5 | Agent layering, permissions, and security model compatible with v2.7 §11 security system, need to extend organization governance section |
| `03-module-diagrams.md` | ~400 | 🟡 B | Layer 2,4 | Six-layer module diagram and feedback loop compatible, need to update KV cache alignment details |
| `04-runtime-sequence.md` | ~300 | 🔵 C | Cross-layer | Constraints and anti-pattern list serves as new platform design reference |

### 4.2 Technical Analysis Documents (docs_zh/analysis/)

| File | Lines | Tier | Port Notes |
|------|------|------|------------|
| `00-architecture-coverage-matrix.md` | ~150 | 🟡 B | Coverage matrix, need to update to reflect five-plane module reorganization |
| `01-codebase-vs-design-review.md` | ~2,000 | 🟡 B | Code and design difference analysis handbook |
| `02-implementation-progress-tracker.md` | ~100 | 🔵 C | Implementation progress tracker as reference |

### 4.3 Architecture & Sequence Diagram Documents

| File | Lines | Tier | Port Notes |
|------|------|------|------------|
| `00-platform-architecture.md` | ~2,000 | 🟡 B | Main architecture entry document, SLO quantitative indicators (95%/90%/100%) reusable, need to align with v2.7 §27 |
| `04-runtime-sequence.md` | ~300 | 🟡 B | 4 sets of core runtime sequence diagrams (Intake/Dispatch/Writeback/Recovery) directly portable, need to supplement OAPEFLIR full-cycle sequence |

### 4.4 Contract Documents (docs_zh/contracts/) — 113 files

**Direct Port (🟢 A) — 22 files**: Contract interfaces defined here are fully compatible with the new architecture.

| Contract | Target Architecture Section |
|----------|---------------------------|
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
| `ha_coordinator_and_leader_election_contract.md` | §31 Disaster Recovery |
| Other 10 basic contracts | Layer 1 various sections |

**Adapted Port (🟡 B) — 38 files**: Core constraints reusable, need to adapt new naming/layering/extension points.

| Contract Category | File Count | Adaptation Points |
|------------------|-----------|-------------------|
| Agent Behavior Contracts | 8 | Need to add v2.7 §42 progressive autonomy + §41 proactive Agent constraints |
| OAPEFLIR Loop Contracts | 5 | Need to extend Plan/Learn/Improve/Rollout stage contract details |
| API Contracts | 6 | Need to add §39 NL entry + §44 non-technical user endpoints |
| Billing/Tenant Contracts | 4 | Need to add §46 org hierarchy + §54 SLA tiering |
| Security/Compliance Contracts | 5 | Need to add §49 department compliance + §52 GDPR cross-border |
| Others | 10 | Naming and reference updates |

**Reference Value (🔵 C) — 20 files**: Design concepts can be referenced but interfaces have been superseded by new design.

**Archive/Retire (⚪ D) — 10 files**: Early v1.x contracts superseded by v2.7.

### 4.5 ADR (docs_zh/adr/) — 38 files

**Direct Port (🟢 A) — 15 files**:

| ADR | Decision Topic | Target Architecture Section |
|-----|---------------|---------------------------|
| `001-three-layer-architecture.md` | Three-layer architecture | §1 Overall Architecture |
| `003-memory-six-layers.md` | Memory layering | §3.5 Memory |
| `005-security-model.md` | Security model | §11 Security |
| `006-llm-provider-strategy.md` | LLM strategy | §15 Provider |
| `012-sqlite-phase-1-2-primary-store.md` | SQLite selection | §26 Storage |
| `016-oapeflir-loop-model.md` | OAPEFLIR model | §13 OAPEFLIR |
| `018-rollout-eleven-state-machine.md` | Rollout state machine | §32 Deployment |
| `019-agent-handoff-four-layer-protocol.md` | Agent handoff | §19 Delegation |
| `020-memory-six-plane-model.md` | Memory six-plane | §3.5 |
| `060-explicit-planning-hub.md` | Planning Hub | §13 OAPEFLIR-P |
| `071-plugin-spi-framework.md` | Plugin SPI | §30 |
| `072-oapeflir-testing-strategy.md` | OAPEFLIR testing | §27 |
| `075-controlled-rollout-release.md` | Controlled release | §32 |
| `078-knowledge-plane-architecture.md` | Knowledge architecture | §3.4 |
| `079-feedback-hub-signals.md` | Feedback signals | §56 |

**Adapted Port (🟡 B) — 8 files**: Decisions valid but need to extend to adapt to seven-layer architecture.

| ADR | Adaptation Points |
|-----|------------------|
| `002-division-system.md` | Need to add impact of §46 org hierarchy on Division |
| `004-workflow-routing.md` | Need to adapt multi-level routing of §40 goal decomposition engine |
| `007-evolution-engine.md` | Need to align with v2.7 §65 behavior drift detection |
| `008-cost-model.md` | Need to extend §66 cost attribution optimization |
| `009-deployment-ops.md` | Need to add §64 edge/offline deployment |
| `011-effect-ts-adoption.md` | Need to re-evaluate Effect-TS adoption decision in new platform |
| `013-eventemitter-phase-2-boundary.md` | Need to evaluate whether Phase 2 continues using EventEmitter |
| `017-knowledge-architecture-refactor.md` | Need to align with v2.7 §50 knowledge domain isolation |

**Reference Value (🔵 C) — 3 files**: `010-commercial-model.md`, `014-org-model-code-boundary.md`, `080-learn-hub-pattern-detection.md`

**Archive/Retire (⚪ D) — 2 files**: `015-unified-extension-marketplace.md` (superseded by v2.7 §55), early draft ADRs

### 4.6 Governance Documents (docs_zh/governance/) — 7 files

| File | Tier | Port Notes |
|------|------|------------|
| `source_of_truth.md` | 🟢 A | Data source governance rules directly applicable |
| `change_control.md` | 🟢 A | Change control process directly applicable |
| `naming_and_directory_conventions.md` | 🟢 A | Naming and directory conventions directly applicable |
| `glossary_and_terminology.md` | 🟢 A | Glossary directly applicable, need to supplement v2.7 Appendix G terminology |
| `autonomy_boundary_policy.md` | 🟡 B | Need to align with v2.7 §42 progressive autonomy model |
| `rollout_release_policy.md` | 🟡 B | Need to align with v2.7 §32 deployment strategy |
| `phase1_scope_freeze.md` | 🟡 B | Need to map to new platform Phase definition |
| `README.md` | 🔵 C | Navigation file reference |

### 4.7 Guide Documents (docs_zh/guides/) — 4 files

| File | Tier | Port Notes |
|------|------|------------|
| `quickstart.md` | 🟢 A | Quick start guide directly reusable, update ports/configuration |
| `contributing.md` | 🟢 A | Contributing guide directly applicable |
| `division-authoring.md` | 🟡 B | Need to update to reflect v2.7 §37 DomainDescriptor |
| `skill-authoring.md` | 🟡 B | Need to update to reflect v2.7 §30 Pack lifecycle |

### 4.8 Operations Documents (docs_zh/operations/) — 16 files

**Direct Port (🟢 A) — 5 files**:

| File | Port Notes |
|------|------------|
| `runbooks/database-issues.md` | Database issues operations handbook directly applicable |
| `runbooks/memory-pressure.md` | Memory pressure handling directly applicable |
| `runbooks/incident-response-playbook.md` | Incident response playbook directly applicable |
| `test_coverage_baseline_gate.md` | Coverage gate rules directly applicable |
| `src_module_test_matrix.md` (1,455 lines) | Module-test mapping matrix, need to update module list but format directly reusable |

**Adapted Port (🟡 B) — 10 files**: Phase plans, roadmaps, and implementation plans need to remap to seven-stage roadmap.

**Reference/Archive — 15+ files**: Historical TODOs, old gap analyses, archived plans under archive/.

### 4.9 Review Documents (docs_zh/reviews/) — 1 file

| Tier | File | Description |
|------|------|-------------|
| 🟡 B | `test_strategy_plan.md` (1,957 lines) | Test strategy reusable, need to extend Layer 4-7 |
| 🟡 B | `authoritative_task_store_refactoring_plan.md` (1,233 lines) | TaskStore refactoring plan has guiding value for new platform storage layer |
| 🟡 B | `opeli_detailed_design.md` (4,484 lines) | OAPEFLIR detailed design directly corresponds to v2.7 §13 |
| 🔵 C | `production_gap_detailed_solutions.md` (2,590 lines) | Production gap solutions as reference |
| 🔵 C | `production_gap_solution_v2.md` (2,598 lines) | Same as above v2 |
| 🔵 C | `design_gap_analysis.md` (2,424 lines) | Design gap analysis as new platform validation checklist |
| 🔵 C | Other 9 files | Historical review records as reference |
| ⚪ D | 6 files | Old reviews superseded |

### 4.10 Reference Documents (docs_zh/reference/) — 0 files

| Tier | Description |
|------|-------------|
| 🔵 C (8 files) | Architecture/module/security/storage/communication chapters mechanically split from old monolith, design concepts can be referenced |
| ⚪ D (9 files) | Old content fully superseded by v2.7, archived |

### 4.11 Research Documents (docs_zh/research/) — 0 files

| Tier | Description |
|------|-------------|
| 🔵 C (all 28 files) | Competitive analysis (Claude Code/Codex/Goose/Aider/MetaGPT/LangGraph/Temporal/DeerFlow, etc.) and reference alignment reviews. Not directly ported but high reference value for new platform design decisions. Recommend retaining entire `docs_zh/research/` directory and moving to new project |

### 4.12 Archive Documents (docs_zh/archive/) — 0 files

| Tier | Description |
|------|-------------|
| ⚪ D (all 3 files) | `automatic-agent-architecture-monolith-dedup.md` (11,392 lines), etc. are historical archives, retained for audit traceability only |

---

## 5. Code Module Port Detailed Assessment

### 5.1 Layer 1 — Infrastructure Layer

#### 🟢 Direct Port (8 modules)

| Module | Files/Lines | Target Section | Port Notes |
|--------|-------------|----------------|------------|
| `core/types/` | 21 / 2,887 | §5 Contracts | Branded IDs, state enums, 15+ domain record types. Zero external dependencies, TypeScript strict mode. **Port as-is** |
| `core/errors.ts` | 1 / 490 | §10 Exceptions | 14-category `AppError` hierarchy + serialization. Zero dependencies. **Port as-is** |
| `core/constants/` | 2 / 16 | Cross-layer | Time constants. **Port as-is** |
| `core/utils/` | 2 / 109 | Cross-layer | BoundedCache utility class. **Port as-is** |
| `core/results/` | 2 / 390 | §5 Contracts | ResultEnvelope pattern. **Port as-is** |
| `core/locking/` | 8 / 635 | §31 Disaster Recovery | Distributed lock abstraction (SQLite/Redis/PG advisory). Clean adapter pattern. **Port as-is** |
| `core/queue/` | 6 / 771 | §4 Events | Queue abstraction (SQLite/Redis) + factory. **Port as-is** |
| `core/lifecycle/` | 3 / 276 | §8 Extensions | ServiceRegistry + teardown ordering. **Port as-is** |

#### 🟡 Adapted Port (5 modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|--------|-------------|----------------|-------------------|
| `core/storage/` | 101 / 26,102 | §26 Data Model | `AuthoritativeTaskStore` is global data access facade (god object). Core SQL schema/migration reusable, but need to split into domain-based Repositories. PG async adapter pattern excellent, retain |
| `core/events/` | 8 / 1,894 | §28 Events | 3-tier DurableEventBus design excellent. Need to add 8 new event namespaces from v2.7 §28 (delegation.*/hibernation.*/prompt.*/eval.*/cost.*/approval_flow.*/agent_lifecycle.*/circuit_breaker.*) |
| `core/config/` | 27 / 6,776 | §24 Configuration | Zod schema validation + 8-layer configuration governance reusable. Need to add §46 org hierarchy configuration + §64 edge deployment configuration |
| `core/cache/` | 27 / 2,518 | §26 Cache | L1/L2/L3 multi-level cache + domain strategy. Need to add §50 knowledge domain isolation cache partitioning |
| `core/api/` | 30 / 5,006 | §6 API | HTTP server + OIDC/OAuth + WebSocket. Need to add §39 NL entry endpoints + §44 non-technical user API + §48 SSO/SCIM endpoints |

#### 🔵 Reference Value (1 module)

| Module | Description |
|--------|-------------|
| `core/resource/` | 2 / 361 | ProcessTracker process tracking logic can be referenced, but new platform may adopt different process management model |

### 5.2 Layer 2 — AI Operations Layer

#### 🟢 Direct Port (3 modules)

| Module | Files/Lines | Target Section | Port Notes |
|--------|-------------|----------------|------------|
| `core/providers/` | 10 / 4,436 | §15 LLM | UnifiedChatProvider (Anthropic/OpenAI/MiniMax) + CircuitBreaker + CredentialPool + ModelRouting. Clean adapter pattern. **A2 Port**: Core implementation unchanged, need to add §15.6 streaming error handling adapter (architecture alignment=medium, adaptation scope ≤15%) |
| `core/workflow/` | 4 / 1,011 | §13 OAPEFLIR | MinimalWorkflow + Validator + OutputSchema + StepRetryPolicy. **Port as-is** |
| `core/artifacts/` | 13 / 1,095 | §30 Pack | Artifact model/storage/version/release/governance/sensitive content scanning. **A2 Port**: Need to add evidence/compliance chain adapter + §69 multimodal artifact + §55 marketplace publish interface (architecture alignment=medium, adaptation scope ≤15%) |

#### 🟡 Adapted Port (7 modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|--------|-------------|----------------|-------------------|
| `core/runtime/` | 114 / 30,348 | §9,§13,§31 | **Largest module, highest risk**. ExecutionDispatch/Lease/Worker/HA/Recovery/HotUpgrade core logic reusable. Adaptation points: (1) Split into five independent bounded contexts: Dispatch/Lease/Worker/HA/Recovery; (2) Adapt §41 proactive Agent scheduling; (3) Add §52 multi-Region dispatch; (4) Add §53 resource competition management |
| `core/agent-loop/` | 31 / 2,562 | §13 OAPEFLIR | OapeflirLoopService + Assessment + Handoff + StageTimeline. Core loop logic complete. Need to add §42 autonomy assessment stage + §59 explainability output |
| `core/planning/` | 9 / 314 | §13 OAPEFLIR-P | PlanBuilder/DAGValidator/StrategySelector. Need to extend §40 goal decomposition engine multi-level decomposition capability |
| `core/tools/` | 36 / 13,500 | §30 Tools | CommandExecutor/SkillExecution/ToolSanitizer/PathScope/MCPGuard. Security boundary complete. Need to add §69 multimodal tool support + §37 domain tool registration |
| `core/orchestration/` | 3 / 1,054 | §13 Orchestration | IntakeRouter/WorkflowPlanner/AgentTeamService. Need to adapt §39 NL entry + §40 goal decomposition + §46 org hierarchy routing |
| `core/feedback/` | 5 / 532 | §56 Feedback | FeedbackCollector/SignalPreprocessor. Need to extend §56 feedback-driven continuous improvement pipeline full signal types |
| `core/learning/` | 14 / 682 | §13 OAPEFLIR-L | FailurePatternMiner/ExperienceDistillation/StrategyLearning + 4 pattern detectors. Need to add §65 behavior drift detection patterns |

#### 🔵 Reference Value (1 module)

| Module | Description |
|--------|-------------|
| `core/evaluation/` | 6 / 1,429 | PostExecutionQualityGate/LlmEvalService logic can be referenced, but v2.7 §17 defines a more complete model evaluation framework, needs redesign |

### 5.3 Layer 3 — Business Domain Access Layer

#### 🟢 Direct Port (2 modules)

| Module | Files/Lines | Target Section | Port Notes |
|--------|-------------|----------------|------------|
| `core/domain-registry/` | 14 / 2,456 | §37 Domain Modeling | DomainRegistryService/PluginSpiRegistry/ContractRegistry/ToolBundleRegistry/WorkflowRegistry/PluginRuntimeHost. SPI pattern clean. **Port as-is**, need to add DomainDescriptor registration |
| `core/divisions/` | 4 / 1,632 | §37 Domain | DivisionLoader + YAML safe loading + HrRoleGovernance. **Port as-is** |

#### 🟡 Adapted Port (1 module)

| Module | Files/Lines | Target Section | Adaptation Points |
|--------|-------------|----------------|-------------------|
| `plugins/` | 20 / 1,672 | §30,§55 | 16 builtin plugins (6 domains: coding/ops/growth/game-dev/asset-production/livestream). SPI adapter/presenter/retriever/validator/planner pattern reusable. Need to add §55 marketplace ecosystem packaging/release/deprecation lifecycle |

### 5.4 Layer 4 — Intelligent Interaction Layer

#### 🟢 Direct Port (1 module)

| Module | Files/Lines | Target Section | Port Notes |
|--------|-------------|----------------|------------|
| `core/messages/` | 2 / 509 | §39 Messages | MessageParts + TokenEstimator. **Port as-is** |

#### 🟡 Adapted Port (3 modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|--------|-------------|----------------|-------------------|
| `core/memory/` | 16 / 3,335 | §3.5 Memory | Layered memory (session/project/user/global) + consolidation/promotion/retrieval/quality. Need to add §50 knowledge domain isolation memory partitioning + §64 edge deployment local memory cache |
| `core/knowledge/` | 23 / 3,443 | §3.4 Knowledge | KnowledgePlane/Ingestion/Embedding/VectorStore/Graph/Retrieval + governance. Need to add §50 knowledge domain isolation + §69 multimodal knowledge indexing |
| `gateway/` | 13 / 3,471 | §6,§44 | ChannelGateway (Telegram/Slack/Webhook) + WebSocket + SSE. Need to add §39 NL channel + §44 non-technical user frontend gateway + §57 external system integration gateway |

### 5.5 Layer 5 — Organization Governance Layer

#### 🟢 Direct Port (2 modules)

| Module | Files/Lines | Target Section | Port Notes |
|--------|-------------|----------------|------------|
| `core/security/` | 19 / 7,125 | §11 Security | SandboxPolicy/PolicyEngine/SecretManagement/AuditIntegrity/FieldEncryption/NetworkEgress/CveIntelligence. **A2 Port**: Core security mechanism unchanged, need to add §49 department-level security policy engine adapter (architecture alignment=medium, adaptation scope ≤15%) |
| `core/cost/` | 2 / 64 | §18 Cost | BudgetGuard. Lightweight but complete. **Port as-is**, need to extend §66 cost attribution optimization |

#### 🟡 Adapted Port (3 modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|--------|-------------|----------------|-------------------|
| `core/approvals/` | 3 / 495 | §21 HITL | ApprovalService/TimeoutExecutor. Need to add §47 org architecture approval routing + multi-party approval/delegation |
| `core/compliance/` | 2 / 346 | §23,§68 | AuditExportService. Need to extend §68 compliance report auto-generation + §52 GDPR cross-border |
| `core/hr/` | 2 / 572 | §46 Org | HrRoleGovernanceService. Need to add §46 org hierarchy model + §51 tiered governance delegation |

### 5.6 Layer 6 — Scale Operations Layer

#### 🟡 Adapted Port (2 modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|--------|-------------|----------------|-------------------|
| `core/deployment/` | 2 / 502 | §32 Deployment | TrafficRoutingService (blue-green/canary). Need to extend §52 multi-Region deployment + §64 edge deployment |
| `core/improvement/` | 11 / 770 | §13 OAPEFLIR-IR | StrategyVersioning/AutonomyBoundary/GuardrailEvaluator/AutoRollback/CanaryRouter/RolloutStateMachine. Need to align §42 progressive autonomy + §55 marketplace Agent version management |

#### 🔵 Reference Value (1 module)

| Module | Description |
|--------|-------------|
| `core/product/` | 22 / 7,109 | BillingService/Marketplace/TenantPlatform/PMF/EnterpriseCapability. Business logic deeply coupled with legacy system Phase 1-2, needs redesign per v2.7 §54 SLA tiering + §55 marketplace ecosystem |

### 5.7 Layer 7 — Operational Maturity Layer

#### 🟢 Direct Port (2 modules)

| Module | Files/Lines | Target Section | Port Notes |
|--------|-------------|----------------|------------|
| `core/observability/` | 36 / 8,172 | §12,§27 | StructuredLogger/HealthService/Prometheus/OpenTelemetry/SLO-Alerting/AnomalyDetection. **Port as-is**, need to add §67 visualization debugging support |
| `core/reliability/` | 8 / 1,112 | §10 Risk | FailureClassification/RepairPipeline/PatchBundle/TaskCard. **Port as-is** |

#### 🟡 Adapted Port (3 modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|--------|-------------|----------------|-------------------|
| `core/ops/` | 19 / 8,308 | §12,§32 | DoctorService/OpsGovernance/EnterpriseGovernance/ReleasePipeline/HumanTakeover/AutoStopLoss. Need to add §60 emergency brake + §70 platform self-ops Agent |
| `core/stability/` | 31 / 12,789 | §27,§32 | 20+ stability rehearsal scenarios + evidence bundling. Need to add §64 edge deployment rehearsal + §65 drift detection rehearsal |
| `core/evolution/` | 12 / 2,268 | §65 Drift | EvolutionMVP/Reflection/Proposal/Benchmark/Rollout. Need to align §65 behavior drift detection + §61 unified lifecycle management |

### 5.8 Cross-layer — CLI

#### 🟡 Adapted Port (entire)

| Module | Files/Lines | Adaptation Points |
|--------|-----------|-------------------|
| `cli/` | 78 / 6,149 | 78 CLI entry points are thin wrappers, depend on underlying service. Port strategy: **port synchronously with service migration**. Need to add §39 NL CLI entry + §43 operations dashboard CLI + §46 org management CLI |

### 5.9 Auxiliary Assets

#### config/ — 🟢 Direct Port

| Directory | File Count | Port Notes |
|-----------|-----------|------------|
| `config/bootstrap/` | 1 | Phase configuration directly reusable |
| `config/runtime/` | 6 | Runtime configuration (with 5 environment variants) directly reusable |
| `config/security/` | 6 | Security configuration directly reusable |
| `config/providers/` | 3 | Provider + model metadata directly reusable |
| `config/environments/` | 5 | Environment configuration directly reusable |
| `config/plugins/` | 1 | Plugin configuration directly reusable |
| `config/domains/` | 1 | Domain configuration directly reusable, need to extend DomainDescriptor |
| `config/gateways/` | 1 | Gateway configuration directly reusable |
| `config/workflows/` | 1 | Workflow configuration directly reusable |
| `config/knowledge/` | 1 | Knowledge configuration directly reusable |
| `config/product/` | 1 | Product configuration directly reusable |

#### divisions/ — 🟡 Adapted Port

| Content | Port Notes |
|---------|------------|
| 11 division definitions (with YAML + roles/ + workflows/ + schemas/) | 🟡 Downgrade reason: v2.7 §37 DomainDescriptor semantic model has breaking changes to division YAML structure, need to add descriptor metadata fields, domain capability declarations, SLA bindings. YAML schema changes affect all 11 definition files |

#### tests/ — See §5.10 Test Port Detailed Assessment

#### Infrastructure Files — 🟢 Direct Port

| File | Port Notes |
|------|------------|
| `package.json` | Dependency declarations and 110+ npm scripts directly reusable, need to clean up scripts no longer needed |
| `tsconfig.json` / `tsconfig.build.json` | TypeScript strict configuration directly reusable |
| `eslint.config.js` | ESLint 9 flat config directly reusable |
| `.c8rc.json` | Coverage configuration directly reusable |
| `Dockerfile` | Multi-stage build directly reusable, need to add edge deployment variant |
| `docker-compose.yml` | Three-service orchestration directly reusable, need to add Redis cluster variant |
| `.env.example` | 346-line environment variable template directly reusable, need to add Layer 4-7 configuration items |
| `.github/workflows/` | 4 CI workflows directly reusable |
| `scripts/` | CI/build scripts directly reusable |
| `deploy/` | Deployment manifests directly reusable |

### 5.10 Test Port Detailed Assessment

> **Test Total Scale**: 1,069 files / ~229,196 lines

#### Test Infrastructure Dependencies

| Dependency | Description | Port Impact |
|------------|-------------|-------------|
| Node.js 22 built-in test runner | `import test from "node:test"` + `assert/strict` | 🟢 No migration cost, new platform continues using |
| SQLite (DatabaseSync) | Almost all tests create temporary DB via `SqliteDatabase` | 🟡 Need to ensure new platform retains SQLite test backend |
| TypeScript ESM | All use `.js` extension ESM imports | 🟢 New platform continues ESM |
| Handwritten Mocks (no external mock library) | `typed-factories.ts` + deterministic bridge pattern | 🟢 Zero external dependencies, direct port |
| PostgreSQL (optional) | Only `pg-test-helper.ts` and few storage tests, need `AA_TEST_PG_DSN` env var | 🟢 Optional dependency, does not affect main flow |
| Temporary filesystem workspace | `createTempWorkspace()` / `cleanupPath()` | 🟢 Direct port |

#### 5.10.1 tests/helpers/ — 19 files / ~2,093 lines

| File | Lines | Tier | Purpose | Port Notes |
|------|-------|------|---------|------------|
| `fs.ts` | 21 | 🟢 A | Temp workspace create/cleanup | Almost all tests depend, **port first** |
| `seed.ts` | 100 | 🟢 A | DB seed data (seedTaskAndExecution) | E2E/golden/integration depend |
| `typed-factories.ts` | 143 | 🟢 A | Type-safe mock factories (createPartial/unsafeCast) | Widely used |
| `env.ts` | 53 | 🟢 A | Environment variable save/restore | Config/CLI tests depend |
| `golden.ts` | 80 | 🟢 A | Golden snapshot assertions (supports UPDATE_GOLDEN=1) | Golden tests depend |
| `e2e-harness.ts` | 131 | 🟢 A | E2E test fixture (SQLite + Store + Workspace) | E2E tests depend |
| `integration-context.ts` | 131 | 🟢 A | Integration test context | Integration tests depend |
| `repository-harness.ts` | 80 | 🟢 A | Repository test fixture | Storage unit tests depend |
| `concurrent-runner.ts` | 158 | 🟢 A | Concurrent operation runner + invariant checks | Concurrency tests depend |
| `test-cleanup.ts` | 27 | 🟢 A | Singleton reset + process cleanup | Tests needing isolation depend |
| `process-guard.ts` | 90 | 🟢 A | Process leak detection | Runtime/Tool tests depend |
| `fixtures/base.ts` | 99 | 🟢 A | Minimal valid record factory | Unit tests depend |
| `fixtures/composite.ts` | 227 | 🟢 A | Complex multi-entity state factory | Integration tests depend |
| `perception.ts` | 66 | 🟢 A | Perception dataset seed | Product tests depend |
| `pmf.ts` | 251 | 🟢 A | PMF validation dataset seed | PMF tests depend |
| `billing.ts` | 36 | 🟢 A | Billing dataset seed | Billing tests depend |
| `api.ts` | 362 | 🟡 B | HTTP API full-stack bootstrap | Need to adapt new API layer |
| `cli.ts` | 30 | 🟡 B | CLI script runner | Need to adapt new CLI paths |
| `pg-test-helper.ts` | 35 | 🟡 B | PostgreSQL test helper | Need to adapt new PG configuration |

#### 5.10.2 tests/unit/ — 758 files / ~169,943 lines

Port assessment grouped by source module:

| Source Module | Test File Count | Test Lines | Tier | Port with Phase |
|--------|-----------|---------|------|-------------|
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

**Summary**: Out of 758 unit test files, **~720 can be directly ported** (🟢), only storage/ (51 files), runtime/ (92 files), and cli/ (2 files) need adaptation (🟡).

#### 5.10.3 tests/integration/ — 247 files / ~49,342 lines

Grouped by test category:

| Category | File Count | Lines | Tier | Port Notes |
|----------|-----------|--------|------|------------|
| **Security Boundaries** | 64 | 8,929 | 🟡 B | Command injection/path traversal/SSRF/data leak/sandbox escape/JWT algorithm downgrade/container boundary, etc. Coupled with sandbox implementation, need to verify new platform compatibility |
| **CLI Integration** | 32 | 8,998 | 🟡 B | Integration tests for 78 CLI commands. Call `dist/` compiled scripts, need to adapt new CLI paths |
| **Runtime Integration** | 53 | 9,498 | 🟡 B | Dispatch/Lease/Worker/Recovery/rehearsal scenarios. Deeply coupled with SQLite storage and runtime lifecycle |
| **Contract Validation** | 5 | 1,459 | 🟢 A | OpenAPI/event schema/Gateway adapter/Provider interface/Store facade contracts. **Validates interfaces not implementations, direct port** |
| **Data Integrity** | 3 | 1,227 | 🟡 B | Approval-execution consistency/event column mapping/memory reference integrity. Depends on SQLite column-level validation |
| **Recovery** | 6 | 1,456 | 🟡 B | Approval timeout recovery/scheduling compensation/event replay/lease crash recovery/SQLite WAL recovery/writeback compensation. Contains SQLite-specific tests |
| **Concurrency** | 5 | 1,401 | 🟡 B | Command concurrency limit/DB busy retry/scheduling race/event concurrency/lease contention. Partially SQLite-specific |
| **Reliability** | 6 | 1,423 | 🟢 A | Degraded behavior/message queue/data loss-free/audit/terminal state guarantee. **Validates invariants, direct port** |
| **Observability** | 6 | 2,011 | 🟢 A | Approval cascading/health checks/metrics/SLI-SLO/task panel/timeline diagnostics. Direct port |
| **Other 36 subdirectories** | 67 | ~12,940 | 🟢 A / 🟡 B | API(2)/Approval(2)/Cache(1)/Compliance(1)/Config(2)/Cost(2)/Deployment(1)/Division(2)/Evaluation(1)/Events(2)/Evolution(1)/Gateway(1)/HR(1)/Lifecycle(5🟡)/Lock(1)/Memory(1)/Messages(2)/Migration(3🟡)/Ops(3🟡)/Orchestration(1)/Product(3)/Provider(2)/Queue(1)/Resource(1)/Results(2)/Session(1)/Smoke(5)/Soak(2🔵)/Stability(1)/Storage(5🟡)/Tools(2)/Types(2)/Toolset(1)/Workflow(2) |

**Summary**: Out of 247 integration tests, **~150 can be directly ported** (🟢), **~90 need adaptation** (🟡, concentrated in security/CLI/Runtime/Recovery/storage), **~7 for reference only** (🔵, soak tests).

#### 5.10.4 tests/golden/ — 8 files / ~1,662 lines

| File | Lines | Tier | Port Notes |
|------|-------|------|------------|
| `diagnostics-bundle.test.ts` | 160 | 🟢 A | Diagnostics bundle structure snapshot |
| `openapi-document.test.ts` | 187 | 🟢 A | OpenAPI document snapshot |
| `release-plan-output.test.ts` | 202 | 🟢 A | Release plan Markdown snapshot |
| `session-summary.test.ts` | 148 | 🟢 A | Session summary snapshot |
| `phase1a-golden-tasks.test.ts` | 30 | 🟢 A | Phase1a golden tasks |
| `prompt-assembly.test.ts` | 220 | 🟢 A | Prompt partitioning/cache key snapshot |
| `workflow-validation.test.ts` | 145 | 🟢 A | Workflow validation snapshot |
| `cli-help-text.test.ts` | 238 | 🟡 B | CLI help text snapshot. Need to adapt new CLI command list |
| `snapshots/` (3 files) | 332 | 🟢 A | Snapshot data files |

#### 5.10.5 tests/e2e/ — 10 files / ~2,807 lines

| File | Lines | Tier | E2E Flow |
|------|-------|------|----------|
| `task-lifecycle.test.ts` | 371 | 🟡 B | Task full lifecycle: create→schedule→execute→complete. API/model/runtime all have changes, need to adapt |
| `multi-step-workflow.test.ts` | 406 | 🟡 B | Multi-step workflow: step dependencies→output passing→complete. Workflow model extension affects assertions |
| `lease-recovery.test.ts` | 371 | 🟡 B | Lease lifecycle: acquire→expire→recover→contention. Runtime split lease interface changed |
| `operator-takeover.test.ts` | 306 | 🟡 B | Ops takeover: run→pause→manual control→resume. §60 emergency brake introduces new takeover path |
| `error-propagation.test.ts` | 298 | 🟡 B | Error propagation: execution failure→terminal state→error code→retry. State machine extension affects terminal state judgment |
| `oapeflir-full-loop.test.ts` | 248 | 🟡 B | OAPEFLIR 8-stage full loop. §42 autonomy assessment adds new stage |
| `session-memory-flow.test.ts` | 237 | 🟡 B | Session lifecycle + memory association. §50 knowledge domain isolation affects memory access |
| `gateway-webhook-flow.test.ts` | 230 | 🟡 B | Webhook trigger→task create→lifecycle transition. §39 NL entry changes entry API |
| `streaming-response.test.ts` | 208 | 🟡 B | Streaming response: session streaming state + backpressure. §15.6 streaming error handling extension |
| `approval-event-flow.test.ts` | 132 | 🟡 B | Approval event flow: block→Tier1 event→consumer ack. §47 org approval routing changed |

**Downgrade note**: v1.0 marked all 10 E2E tests as 🟢, re-review downgraded to 🟡. E2E tests run through API→model→runtime→storage entire chain, runtime split, API extensions, state machine changes, and org governance modifications will require adaptation to test fixtures and assertions. Core test scenarios (lifecycle/workflow/recovery) reusable, but estimated adaptation 15%-30%.

#### 5.10.6 tests/performance/ — 6 files / ~874 lines

| File | Lines | P99 Target | Tier |
|------|-------|-----------|------|
| `feedback-perf.test.ts` | 118 | <10ms | 🟢 A |
| `handoff-perf.test.ts` | 167 | <5ms | 🟢 A |
| `knowledge-perf.test.ts` | 127 | <100ms/<500ms | 🟢 A |
| `oapeflir-perf.test.ts` | 150 | <30s | 🟢 A |
| `planning-perf.test.ts` | 163 | <50ms | 🟢 A |
| `plugin-perf.test.ts` | 149 | <200ms | 🟢 A |
| `performance.bak/` (10 files) | 2,016 | — | 🔵 C |

**All 6 performance tests can be directly ported** 🟢. 10 deprecated files under `.bak/` for reference only.

#### 5.10.7 tests/fixtures/ — 4 files / ~459 lines

| File | Lines | Tier | Port Notes |
|------|-------|------|------------|
| `migration/generate-snapshots.ts` | 134 | 🟡 B | SQLite snapshot generation script, need to adapt new migration version sequence |
| `migration/migration-fixtures.test.ts` | 235 | 🟡 B | Migration ledger integrity test |
| `migration/snapshots/manifest.json` | 41 | 🟡 B | Snapshot version manifest |
| `migration/README.md` | 49 | 🟢 A | Usage instructions |

#### 5.10.8 Test Port Summary

| Test Layer | Total Files | Total Lines | 🟢 Direct | 🟡 Adapted | 🔵 Reference |
|--------|--------|--------|---------|---------|------------|
| helpers/ | 19 | 2,093 | 16 | 3 | 0 |
| unit/ | 758 | 169,943 | ~720 | ~38 | 0 |
| integration/ | 247 | 49,342 | ~150 | ~90 | ~7 |
| golden/ | 8+3 | 1,662 | 10 | 1 | 0 |
| e2e/ | 10 | 2,807 | 0 | 10 | 0 |
| performance/ | 6+10 | 2,890 | 6 | 0 | 10 |
| fixtures/ | 4 | 459 | 1 | 3 | 0 |
| **Total** | **1,069** | **~229,196** | **~903** | **~145** | **~17** |

#### 5.10.9 Test Port Follow Code Phase Mapping

| Port Phase | Source Module | Corresponding Test Directory | Test File Count | Test Lines |
|-----------|--------|------------|-----------|---------|
| **P0 (Advance)** | — | All `tests/helpers/` | 19 | 2,093 |
| **P1 Shared Kernel** | types, errors, constants, utils, results, lifecycle | `unit/types/` `unit/core/types/` `unit/core/errors.test.ts` `unit/constants/` `unit/utils/` `unit/results/` `unit/lifecycle/` + corresponding integration | ~38 | ~8,500 |
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

## 6. Port Execution Order

### 6.1 Ten-Phase Port Roadmap

```
Phase │ Content                          │ Files │ Lines   │ Dependencies │ Est. Effort
──────┼───────────────────────────────────┼────────┼─────────┼──────────────┼─────────
  P0  │ Test Helpers (Advance)            │   19   │  ~2.1K │ None         │ 0.5 person-days
      │ All tests/helpers/                │        │        │              │
──────┼───────────────────────────────────┼────────┼─────────┼──────────────┼─────────
  1   │ Shared Kernel + Tests             │  ~68   │ ~13.2K │ P0           │ 1.5 person-days
      │ types/ + errors.ts +              │ src30  │  4.7K  │              │
      │ constants/ + utils/ +             │ test38 │  8.5K  │              │
      │ results/ + lifecycle/            │        │        │              │
──────┼───────────────────────────────────┼────────┼─────────┼──────────────┼─────────
  2   │ Infra Foundation + Tests          │ ~325   │ ~71.5K │ Phase 1     │ 7 person-days
      │ storage/ + events/ + config/     │ src145 │ 29.5K  │              │
      │ + locking/ + queue/ + cache/     │ test180│ 42.0K  │              │
      │ + config/ directory + fixtures/  │        │        │              │
──────┼───────────────────────────────────┼────────┼─────────┼──────────────┼─────────
  3   │ Security & Governance + Tests    │ ~141   │ ~28.1K │ Phase 2     │ 3.5 person-days
      │ security/ + approvals/ +         │  src26 │  8.1K  │              │
      │ cost/ + compliance/ + hr/        │ test115│ 20.0K  │              │
──────┼───────────────────────────────────┼────────┼─────────┼──────────────┼─────────
  4   │ AI Ops Primitives + Tests         │ ~163   │ ~41.5K │ Phase 2     │ 4.5 person-days
      │ providers/ + tools/ +            │  src63 │ 19.5K  │              │
      │ workflow/ + artifacts/           │ test100│ 22.0K  │              │
──────┼───────────────────────────────────┼────────┼─────────┼──────────────┼─────────
  5   │ Runtime Core + Tests (After Split) │ ~264   │ ~72.3K │ Phase 2-4   │ 10 person-days
      │ runtime/ → dispatch/lease/       │ src114 │ 30.3K  │              │
      │ worker/ha/recovery/              │ test150│ 42.0K  │              │
──────┼───────────────────────────────────┼────────┼─────────┼──────────────┼─────────
  6   │ OAPEFLIR Pipeline + Tests         │ ~119   │ ~15.5K │ Phase 4-5   │ 3.5 person-days
      │ agent-loop/ + planning/ +        │  src63 │  4.1K  │              │
      │ feedback/ + learning/ +          │ test56 │ 11.4K  │              │
      │ evaluation/ + improvement/      │        │        │              │
──────┼───────────────────────────────────┼────────┼─────────┼──────────────┼─────────
  7   │ Interaction Layer + Tests          │ ~124   │ ~28.8K │ Phase 5-6   │ 4 person-days
      │ memory/ + knowledge/ +           │  src54 │ 10.8K  │              │
      │ messages/ + gateway/             │ test70 │ 18.0K  │              │
──────┼───────────────────────────────────┼────────┼─────────┼──────────────┼─────────
  8   │ Business Domain + Tests           │  ~78   │ ~13.5K │ Phase 2,7   │ 2.5 person-days
      │ domain-registry/ + plugins/      │  src38 │  5.8K  │              │
      │ + divisions/ directory           │ test40 │  7.7K  │              │
──────┼───────────────────────────────────┼────────┼─────────┼──────────────┼─────────
  9   │ Operational Maturity + Tests      │ ~271   │ ~72.6K │ Phase 5     │ 7 person-days
      │ observability/ + ops/ +          │ src106 │ 32.6K  │              │
      │ stability/ + evolution/ +        │ test165│ 40.0K  │              │
      │ reliability/ + product/         │        │        │              │
──────┼───────────────────────────────────┼────────┼─────────┼──────────────┼─────────
 10   │ CLI + E2E + Golden + Perf         │ ~146   │ ~23.6K │ Phase 1-9   │ 4 person-days
      │ + Infra Files                    │  src78 │  6.1K  │              │
      │ cli/ + e2e/ + golden/ +          │ test68 │ 17.5K  │              │
      │ performance/ + smoke/ +          │        │        │              │
      │ contract/ + deploy/ + CI          │        │        │              │
```

**Total**: ~1,868 files (source 799 + test 1,069) / ~406K lines (source ~177K + test ~229K) / **~70-100 person-days** (including storage/runtime split, adapter writing, E2E adaptation; excluding 24 new module development)

### 6.2 Document Port Order

```
Batch │ Content                           │ Files │ Priority
─────┼────────────────────────────────────┼────────┼─────────
 D1  │ Governance + Guide docs (🟢 direct) │   8   │ P0
 D2  │ Contract docs 22 🟢 + 15 ADR 🟢     │  37   │ P0
 D3  │ Ops manuals 5 🟢 + ops runbooks    │  ~8   │ P1
 D4  │ Main docs 5 🟡 + tech analysis 2   │   7   │ P1
 D5  │ Contract docs 38 🟡 + ADR 8 🟡    │  46   │ P2
 D6  │ Review docs 3 🟡                  │   3   │ P2
 D7  │ Research docs 28 🔵 bulk move      │  28   │ P3
 D8  │ Reference/archive cleanup tag       │  29   │ P4
```

---

## 7. Key Risks and Mitigation

### 7.1 High-Risk Items

| Risk | Impact | Mitigation |
|------|--------|-----------|
| `runtime/` module too large (114 files / 30K lines) | Regression during port, split breaks interfaces | Before Phase 5, write boundary integration tests; after split, verify all stable-* rehearsals pass |
| `storage/` AuthoritativeTaskStore is god object | Almost all modules depend on it, change impact huge | First abstract Repository interface layer, then gradually migrate direct calls to Repository |
| Event namespace expansion (17→25) | Consumers not updated will miss events | New namespaces first register as Tier 3 (best-effort), upgrade to Tier 1 after confirming consumers are ready |
| Modules needed by new platform but completely missing from legacy | §39 NL entry/§40 goal decomposition/§41 proactive Agent/§46 org hierarchy/§64 edge, etc. need entirely new development | Port and new feature development in parallel, port first to establish foundation |

### 7.2 Capabilities Completely Missing in Legacy, New Platform Needs

| v2.7 Section | Capability | New Module Needed |
|-------------|------------|-------------------|
| §39 | Natural language task entry | `core/nl-entry/` — NL parser, intent classification, entity extraction, session management |
| §40 | Goal decomposition engine | `core/goal-decomposition/` — Goal graph, subgoal generation, DAG orchestration |
| §41 | Proactive Agent | `core/proactive-agent/` — Trigger engine, scheduled dispatch, event-driven wake-up |
| §42 | Progressive autonomy | `core/autonomy/` — Trust score, autonomy level state machine, upgrade/degrade rules |
| §43 | Unified operations dashboard | `core/dashboard/` — Business view aggregation, multi-role dashboard |
| §44 | Non-technical user UX | `gateway/user-portal/` — Web UI gateway, drag-and-drop orchestration, wizard |
| §46 | Org hierarchy model | `core/org-hierarchy/` — Org tree, department/team, hierarchical inheritance |
| §47 | Org architecture approval routing | Extend `core/approvals/` — Dynamic routing engine |
| §48 | SSO/SCIM integration | `core/sso-scim/` — SAML/OIDC SSO, SCIM user sync |
| §49 | Department-level compliance policy | Extend `core/compliance/` — Department-level policy engine |
| §50 | Knowledge domain isolation | Extend `core/knowledge/` — namespace isolation, controlled sharing |
| §52 | Multi-Region deployment | `core/multi-region/` — Region routing, data sync, failover |
| §53 | Resource competition management | `core/resource-scheduler/` — Priority queue, fair scheduling |
| §54 | SLA tier guarantee | `core/sla/` — SLA tier definition, guarantee policy |
| §59 | Agent explainability | `core/explainability/` — Decision trace, causal chain |
| §60 | Emergency brake | `core/emergency-brake/` — Global brake, tiered brake |
| §61 | Unified lifecycle management | `core/agent-lifecycle/` — Create→activate→hibernate→decommission |
| §64 | Edge/offline deployment | `core/edge-runtime/` — Offline cache, sync |
| §65 | Behavior drift detection | `core/drift-detection/` — Baseline comparison, alerting |
| §66 | Cost attribution optimization | Extend `core/cost/` — Multi-dimensional attribution, optimization suggestions |
| §67 | Visualization debugging | `core/debug-ui/` — Execution visualization, breakpoints |
| §68 | Compliance report auto-generation | Extend `core/compliance/` — Report templates, auto-generation |
| §69 | Multimodal capability | `core/multimodal/` — Image/audio/video processing |
| §70 | Platform self-ops Agent | `core/self-ops-agent/` — Auto-inspection, auto-repair |

---

## 8. Core Object Migration Matrix

Legacy defines ~84 domain entity types (`core/types/`), new platform v2.7 introduces many new entities and entity splits in org governance (§46-§51), intelligent interaction (§39-§44), and scale operations (§52-§57). This section maps legacy→new entity evolution relationships.

### 8.1 Mapping Type Definitions

| Mapping Type | Symbol | Meaning |
|----------|------|---------|
| **1:1 Direct** | → | Field name/semantics unchanged, rename or retain directly |
| **1:1 Enriched** | →+ | Retain original fields, add new required fields |
| **1:N Split** | →⑴⑵… | One legacy entity split into multiple new entities |
| **N:1 Merge** | ⇒ | Multiple legacy entities merged into one new entity |
| **Semantic Redefinition** | ⇝ | Same name but semantics/lifecycle fundamentally changed |
| **Brand New** | ★ | No corresponding entity in legacy |
| **Retired** | ✕ | No longer needed |

### 8.2 Core Entity Mapping (Grouped by Domain)

#### Task & Execution Domain

| Legacy Entity | Mapping | New Entity | Risk | Description |
|--------|------|--------|------|------|
| TaskRecord | →+ | task | Low | New fields: org_node_id, autonomy_level, sla_tier |
| ExecutionRecord | →⑴⑵⑶⑷⑸ | execution + execution_step + execution_artifact + execution_metric + execution_decision_log | High | Split from single row to 5 tables, need data migration script |
| TransitionCommand | ⇝ | state_command + control_directive | High | Fundamental architecture change: commands no longer directly operate state machine, routing through control_directive indirectly |
| SessionRecord | →+ | session | Low | New fields: channel_type, nl_context (§39) |
| WorkflowRecord | →+ | workflow_definition | Low | New reference: goal_decomposition_tree (§40) |
| WorkflowStepRecord | →+ | workflow_step | Low | New fields: autonomy_gate, explainability_output |
| WorkflowStateRecord | →⑴⑵⑶⑷ | workflow_run + loop_cycle + checkpoint + hibernation_snapshot | High | Loop/checkpoint/hibernation separation |

#### Worker & Scheduling Domain

| Legacy Entity | Mapping | New Entity | Risk | Description |
|--------|------|--------|------|------|
| WorkerRecord | →+ | worker | Low | New fields: region_id, capability_vector |
| LeaseRecord | →+ | lease | Low | New field: sla_priority |
| DispatchRecord | →+ | dispatch_assignment | Low | New fields: resource_quota, region_affinity (§52-§53) |
| AgentExecutionRecord | →⑴⑵⑶⑷⑸ | agent_run + agent_step + tool_invocation + llm_call + agent_decision | High | Observability-driven fine-grained split |

#### Organization & Governance Domain

| Legacy Entity | Mapping | New Entity | Risk | Description |
|--------|------|--------|------|------|
| ApprovalRecord | →⑴⑵⑶⑷ | decision_record + approval_route + approval_sla + decision_comment | High | Org-aware approval (§47), routing rules changed from hardcoded to dynamic |
| OrganizationRecord + TenantRecord | ⇒ | org_node (hierarchical tree) | High | N:1 merged into recursive org tree (§46), tenant becomes top-level org_node |
| HrRoleRecord | →+ | role_assignment | Medium | New fields: delegation_scope, escalation_chain (§51) |
| ComplianceRecord | →+ | compliance_policy | Medium | New fields: department_scope, geo_region (§49, §52) |

#### Security Domain

| Legacy Entity | Mapping | New Entity | Risk | Description |
|--------|------|--------|------|------|
| SandboxPolicy | →+ | sandbox_policy | Low | New field: department_override (§49) |
| SecretRecord | → | secret_entry | Low | 1:1 direct |
| AuditRecord | →+ | audit_event | Low | New fields: compliance_tag, retention_policy |

#### Memory & Knowledge Domain

| Legacy Entity | Mapping | New Entity | Risk | Description |
|--------|------|--------|------|------|
| MemoryRecord | →⑴⑵ | memory_entry + knowledge_document/chunk | High | Need content classifier to distinguish episodic memory and knowledge artifact |
| KnowledgeDocument | →+ | knowledge_document | Medium | New fields: namespace_id (§50 domain isolation), modality (§69) |
| EmbeddingRecord | → | embedding_vector | Low | 1:1 direct |

#### AI Operations Domain

| Legacy Entity | Mapping | New Entity | Risk | Description |
|--------|------|--------|------|------|
| ProviderConfig | →+ | provider_config | Low | New field: streaming_error_policy (§15.6) |
| ToolDefinition | →+ | tool_definition | Low | New fields: modality_support, domain_binding |
| PluginManifest | →+ | pack_manifest | Low | Rename + new field: marketplace_metadata (§55) |
| ArtifactRecord | →+ | artifact | Medium | New fields: evidence_chain, compliance_tag, modality |
| FeedbackSignal | →+ | feedback_signal | Low | New enum extension: signal_source_type |
| EvalResult | ⇝ | eval_result | Medium | Evaluation framework changed from post-hoc to inline (§17) |

#### Operational Maturity Domain

| Legacy Entity | Mapping | New Entity | Risk | Description |
|--------|------|--------|------|------|
| SloDefinition | →+ | slo_definition | Low | New field: region_scope |
| AlertRule | → | alert_rule | Low | 1:1 direct |
| ReleaseRecord | →+ | release | Low | New extension fields: canary_config, rollback_policy |
| StabilityScenario | → | rehearsal_scenario | Low | Rename, semantics unchanged |
| EvolutionProposal | →+ | evolution_proposal | Medium | New fields: drift_baseline, behavior_fingerprint (§65) |

### 8.3 Brand New Entity List (No Legacy Correspondence — ★)

| New Entity | v2.7 Section | Domain |
|--------|-----------|--------|
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
| region_config | §52 | Scale Operations |
| resource_quota | §53 | Scale Operations |
| sla_tier | §54 | Scale Operations |
| marketplace_listing | §55 | Scale Operations |
| integration_connector | §57 | Scale Operations |
| explainability_trace | §59 | Operational Maturity |
| emergency_brake_event | §60 | Operational Maturity |
| agent_lifecycle_state | §61 | Operational Maturity |
| edge_deployment | §64 | Operational Maturity |
| drift_baseline | §65 | Operational Maturity |
| cost_attribution | §66 | Operational Maturity |
| debug_session | §67 | Operational Maturity |
| compliance_report | §68 | Operational Maturity |
| multimodal_asset | §69 | Operational Maturity |
| self_ops_task | §70 | Operational Maturity |

### 8.4 Migration Statistics

| Mapping Type | Entity Count | Percentage |
|----------|--------|--------|
| 1:1 Direct (→) | ~12 | 14% |
| 1:1 Enriched (→+) | ~22 | 26% |
| 1:N Split (→⑴⑵…) | ~5 | 6% |
| N:1 Merge (⇒) | ~2 | 2% |
| Semantic Redefinition (⇝) | ~3 | 4% |
| Brand New (★) | ~26 | 31% |
| Retired (✕) | ~14 | 17% |
| **Total** | **~84** | 100% |

### 8.5 Data Migration Strategy

The object migration matrix defines "what changes to what", this section defines "how to change". According to risk level and data volume, three migration modes are adopted:

#### Migration Mode Definitions

| Mode | Applicable Scenario | Execution Method | Downtime Required |
|------|---------|---------|---------|
| **One-time Offline Migration** | Low risk, 1:1 direct/enriched mapping | Write migration script, execute once during maintenance window | Short downtime (minutes) |
| **Dual-write Transition** | High risk object split/merge, business cannot be interrupted | Write to both old + new tables simultaneously during write, gradually switch reads to new table, deprecate old table after verifying consistency | Zero downtime |
| **Lazy Migration** | Long-tail low-frequency objects, full migration cost not worthwhile | On access, check version, upgrade to new format on demand | Zero downtime |

#### Entity Migration Mode Assignment

| Entity | Mapping Type | Migration Mode | Phase | Description |
|------|---------|---------|-------|---------|
| TaskRecord | →+ | One-time offline | P2 | New fields can have defaults, ALTER TABLE + backfill |
| SessionRecord | →+ | One-time offline | P2 | Same as above |
| WorkerRecord | →+ | One-time offline | P2 | Same as above |
| LeaseRecord | →+ | One-time offline | P2 | Same as above |
| ProviderConfig | →+ | One-time offline | P4 | Same as above |
| SecretRecord | → | One-time offline | P3 | 1:1 rename |
| SloDefinition | →+ | One-time offline | P9 | Same as above |
| **ExecutionRecord** | →⑴⑵⑶⑷⑸ | **Dual-write** | P2→P5 | 1:5 split, need P2 new table + dual-write, P5 verify and switch reads |
| **WorkflowStateRecord** | →⑴⑵⑶⑷ | **Dual-write** | P2→P6 | 1:4 split, loop/checkpoint/hibernation separation, switch reads after OAPEFLIR complete |
| **ApprovalRecord** | →⑴⑵⑶⑷ | **Dual-write** | P3→P5 | 1:4 split, org approval routing changed, switch reads after Runtime complete |
| **AgentExecutionRecord** | →⑴⑵⑶⑷⑸ | **Dual-write** | P5 | 1:5 split, observability-driven |
| **MemoryRecord** | →⑴⑵ | **Dual-write** | P7 | Need content classifier to distinguish episodic memory and knowledge artifact |
| **OrganizationRecord + TenantRecord** | ⇒ | **Dual-write** | P3 | N:1 merged into org_node hierarchical tree, read/write path fundamentally changed |
| **TransitionCommand** | ⇝ | **Dual-write** | P5 | Semantic redefinition, command routing fundamentally changed |
| EvalResult | ⇝ | Lazy migration | P6 | Evaluation records low access frequency, upgrade on access |
| EvolutionProposal | →+ | Lazy migration | P9 | Historical proposals upgrade on demand when accessed |
| KnowledgeDocument | →+ | Lazy migration | P7 | Existing documents supplement namespace_id on access |

#### Dual-write Transition Execution Flow

```
Phase 1: Create new table       → CREATE TABLE new_xxx (new schema)
Phase 2: Enable dual-write      → Write to both old_xxx + new_xxx simultaneously
Phase 3: Shadow reads          → Read both tables simultaneously, compare results, record differences
Phase 4: Switch primary read    → Primary read switches to new_xxx, old_xxx becomes secondary
Phase 5: Verification period    → Run ≥1 complete Phase cycle, confirm zero differences
Phase 6: Deprecate old table    → DROP TABLE old_xxx
```

Each dual-write object must have an assigned owner, and "dual-write consistency verified" must be included in Phase exit conditions.

---

## 9. High-Risk Special: storage / AuthoritativeTaskStore Split

### 9.1 Current State Analysis

`AuthoritativeTaskStore` (`src/core/storage/authoritative-task-store.ts`) is the global data access facade of the current system:

| Metric | Value |
|------|------|
| Public method count | ~278 domain methods + 27 structural properties = ~305 public surface |
| Underlying Repository count | 21 (task, workflow, execution, session, event, worker, approval, billing, lease, lock, memory, artifact, dispatch, division, secret, marketplace, release, organization, intelligence, evolution, operations) |
| Consumer file count | ~123 source files directly depend (with tests 200+) |
| Lines of code | 101 files / 26,102 lines in directory |

**Core problem**: god object anti-pattern — single class bears data access responsibility for 21 domains, any storage layer change affects entire system.

### 9.2 Split Target Modules (7 Bounded Contexts)

| # | Bounded Context | Method Count | Contains Repositories | Split Strategy |
|---|-----------|--------|-----------------|---------|
| 1 | **Core Task Engine** | ~73 | task, workflow, execution, session | Keep as core — high coupling between methods,不宜进一步拆分 |
| 2 | **Worker Infrastructure** | ~47 | worker, dispatch, lease, lock | Extract — scheduling/lease/worker lifecycle is independent domain |
| 3 | **Event Infrastructure** | ~24 | event | Extract — event bus already has clear boundary |
| 4 | **Billing & Cost** | ~29 | billing | Extract — billing logic decoupled from core execution |
| 5 | **Governance & Compliance** | ~50 | approval, organization, secret, compliance, operations | Extract — org governance is independent domain (aligns with v2.7 Layer 5) |
| 6 | **Platform & Commerce** | ~47 | marketplace, release, division, intelligence, evolution | Extract — platform operations is independent domain (aligns with v2.7 Layer 6-7) |
| 7 | **Memory & Artifacts** | ~10 | memory, artifact | Extract — knowledge/memory is independent domain (aligns with v2.7 Layer 4) |

### 9.3 Split Execution Plan

**Prerequisite**: AuthoritativeTaskStore internally uses named Repository delegation, split infrastructure already in place, only need to migrate consumers.

| Step | Action | Est. Effort | Risk |
|------|------|-----------|------|
| S1 | Define TypeScript interfaces for 7 bounded contexts (Repository contracts) | 2 person-days | Low |
| S2 | Implement facade adapter — AuthoritativeTaskStore temporarily delegates to new interface, maintain backward compatibility | 3 person-days | Low |
| S3 | Migrate consumers module by module: replace `store.xxx()` calls with corresponding Repository interface injection | 8 person-days | Medium — each consumer needs verification |
| S4 | Remove AuthoritativeTaskStore facade, each bounded context independently registers to ServiceRegistry | 2 person-days | Medium |
| S5 | Update all unit test/integration test store mocks | 3 person-days | Medium |
| S6 | Run full regression + stable-* rehearsal verification | 2 person-days | Low |
| **Total** | | **~20 person-days** | |

### 9.4 Migration Sequence Recommendation

```
Wave 1 (Low-risk extraction): Event Infrastructure → Memory & Artifacts
  ↓ Verification point: all event-related tests pass
Wave 2 (Medium-risk extraction): Billing & Cost → Worker Infrastructure  
  ↓ Verification point: all dispatch/lease-related tests pass
Wave 3 (High-risk extraction): Governance & Compliance → Platform & Commerce
  ↓ Verification point: all org/approval/marketplace-related tests pass
Wave 4 (Wrap-up): Remove facade, Core Task Engine becomes independent module
  ↓ Verification point: npm test full pass + stable-* rehearsals pass
```

---

## 10. High-Risk Special: runtime/ Bounded Context Split

### 10.1 Current State Analysis

`src/core/runtime/` is the system's largest module:

| Metric | Value |
|------|------|
| File count | 101 .ts files |
| Lines of code | 30,348 lines |
| Identified bounded contexts | 12 |

### 10.2 Bounded Context Decomposition

| BC# | Bounded Context | Files | Lines | Internal Dependencies | Can Extract Independently |
|-----|-----------|--------|------|-----------|-----------|
| BC1 | Execution Dispatch | 12 | 2,744 | 3 | No — composition root |
| BC2 | Lease Management | 8 | 1,807 | 1 | Yes — clean repo pattern |
| BC3 | Worker Management | 10 | 1,434 | 0 | **Yes — zero internal dependencies, best extraction target** |
| BC4 | Handshake/Writeback | 10 | 2,058 | 2 | No — depends on BC1+BC2 |
| BC5 | HA Coordinator | 8 | 1,849 | 0 | **Yes — zero internal dependencies** |
| BC6 | Hot Upgrade | 6 | 1,952 | 0 | **Yes — zero internal dependencies** |
| BC7 | Recovery & Repair | 13 | 3,620 | 4 | No — depends on multiple BCs |
| BC8 | State Transition | 4 | 901 | 0 | **Yes — zero internal dependencies** |
| BC9 | Agent Execution Engine | 12 | 2,990 | 1 | Yes — only depends on BC8 |
| BC10 | Multi-Step Orchestration | 13 | 2,427 | 5 | No — composition root, stays in runtime/ |
| BC11 | Infrastructure | 13 | 2,498 | 0 | Yes — utilities |
| BC12 | HITL & Governance | 2 | 1,166 | 0 | **Yes — zero internal dependencies** |

### 10.3 Extraction Wave Plan

| Wave | Extraction Target | Lines | % | Risk | Verification Point |
|------|---------|------|------|------|--------|
| **Wave 1** (Zero risk) | BC3 Worker + BC5 HA + BC6 Hot Upgrade + BC8 State Transition | 6,136 | 20% | Low — zero internal dependencies | Each BC unit test independently passes |
| **Wave 2** (Low risk) | BC2 Lease + BC9 Agent Execution + BC12 HITL + BC11 Infrastructure | 6,461 | 21% | Low — ≤1 dependency | lease/agent integration tests pass |
| **Wave 3** (Medium risk) | BC4 Handshake/Writeback + BC7 Recovery | 5,678 | 19% | Medium — multiple dependencies | recovery rehearsal scenarios pass |
| **Wave 4** (Wrap-up) | BC1 Dispatch + BC10 Orchestration stay as runtime/ core | 5,171 | 17% | Low — reorganization only | npm test full pass |

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
|-----------|-------------|---------|
| Worker Management | §53 Resource Competition | Fair scheduling, priority queue |
| HA Coordinator | §31 Disaster Recovery | Multi-Region leader election (§52) |
| State Transition | §9 State Machine | Extended state set (hibernation/delegation) |
| Agent Execution | §13 OAPEFLIR | §42 autonomy assessment stage |
| HITL & Governance | §21 HITL | §47 org approval routing |
| Lease Management | §31 Lease | §54 SLA tier lease priority |

---

## 11. New Module Priority and Dependency Graph

### 11.1 Priority Classification

24 modules completely missing from legacy, new platform needs to develop entirely, divided into P0/P1/P2 by business blocking relationships:

| Priority | Meaning | Count |
|---------|---------|-------|
| **P0 — Foundation Capability** | Without this, new platform cannot be distinguished from legacy system, blocks upper modules | 6 |
| **P1 — Core Differentiation** | Key capabilities of new platform, but does not block P0 module porting | 10 |
| **P2 — Operational Enhancement** | Nice to have, can be delivered gradually after platform stabilizes | 8 |

### 11.2 P0 Foundation Capabilities (6)

| Module | v2.7 Section | Dependency | Description |
|------|-----------|------|---------|
| `core/org-hierarchy/` | §46 | None | Org hierarchy model is foundation of §47-§51, develop first |
| `core/nl-entry/` | §39 | None | NL entry is core interaction mode of new platform |
| `core/goal-decomposition/` | §40 | nl-entry | Goal decomposition engine depends on NL intent parsing |
| `core/autonomy/` | §42 | org-hierarchy | Autonomy model depends on org trust chain |
| `core/sso-scim/` | §48 | org-hierarchy | SSO/SCIM depends on org model |
| `core/emergency-brake/` | §60 | None | Emergency brake is security foundation, can develop independently |

### 11.3 P1 Core Differentiation (10)

| Module | v2.7 Section | Dependency | Description |
|------|-----------|------|---------|
| `core/proactive-agent/` | §41 | autonomy, nl-entry | Proactive Agent needs autonomy + NL capability |
| `core/agent-lifecycle/` | §61 | autonomy | Unified lifecycle depends on autonomy level |
| `core/explainability/` | §59 | agent-lifecycle | Explainability depends on lifecycle events |
| `core/multi-region/` | §52 | org-hierarchy | Multi-Region depends on org topology |
| `core/resource-scheduler/` | §53 | multi-region | Resource scheduler depends on Region configuration |
| `core/sla/` | §54 | org-hierarchy, resource-scheduler | SLA depends on org + resources |
| `core/drift-detection/` | §65 | agent-lifecycle | Drift detection depends on behavior baseline |
| `core/dashboard/` | §43 | org-hierarchy | Dashboard depends on org views |
| Extend `core/approvals/` | §47 | org-hierarchy | Org approval routing |
| Extend `core/compliance/` | §49 | org-hierarchy | Department compliance |

### 11.4 P2 Operational Enhancement (8)

| Module | v2.7 Section | Dependency | Description |
|------|-----------|------|---------|
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
 emergency-brake(P0) ── Independent, no dependencies
 multimodal(P2) ──── Independent, no dependencies
 compliance-report(P2) ── Depends on compliance(P1)
```

---

## 12. Execution Recommendations

### 12.1 Port Principles

1. **Port 🟢 direct port items first**: Zero adaptation cost, quickly establish new platform code foundation
2. **Port by dependency order**: Shared Kernel → Infrastructure → Security → AI Ops → Runtime → OAPEFLIR → Interaction → Domain → Maturity → CLI
3. **Run corresponding tests after each Phase port completes**: Ensure no regression introduced
4. **Port documents and code synchronously**: Each code Phase's corresponding contracts/ADRs move together
5. **New feature development and port in parallel**: Port team and new feature team can work simultaneously

### 12.2 Dual-Track Migration Strategy

"Port and new feature in parallel" requires clear lane division and intersection rules, otherwise easy to block each other.

#### Lane A: Migration Lane

| Responsibility | Content |
|------|---------|
| P0-P10 code migration | Execute per §6 ten-phase roadmap |
| storage split | §9 AuthoritativeTaskStore 4-wave split |
| runtime split | §10 runtime 4-wave split |
| Test regression | Each Phase exit gate (§13) |
| Contract/document migration | Synchronize with code Phase |
| Data migration scripts | §8 high-risk entity dual-write/offline migration |

#### Lane B: New Capability Lane

| Responsibility | Content |
|------|---------|
| P0 foundation | org-hierarchy / nl-entry / goal-decomposition / autonomy / sso-scim / emergency-brake |
| P1 differentiation | proactive-agent / agent-lifecycle / explainability / multi-region / resource-scheduler / sla / drift-detection / dashboard / approval routing extension / department compliance extension |
| P2 enhancement | user-portal / marketplace / edge-runtime / cost-attribution / debug-ui / compliance-report / multimodal / self-ops-agent |

#### Intersection Points and Dependency Rules

| Intersection | Migration Lane Prerequisite | New Capability Lane Action | Strategy |
|--------|-------------|---------------|------|
| **org-hierarchy integration** | P3 Security complete (hr/approvals migrated) | org-hierarchy module integrates with migrated hr/approvals via adapter | New capability lane can first develop with **stub interface**, replace with real implementation after P3 |
| **autonomy integration** | P5 Runtime complete (state machine migrated) | autonomy module integrates with state-transition BC | New capability lane first defines StateTransition interface stub, integrate after P5 Wave 1 complete |
| **nl-entry integration** | P4 AI Ops complete (providers migrated) | nl-entry uses migrated LLM provider | New capability lane can first develop with mock provider, switch after P4 complete |
| **agent-lifecycle integration** | P6 OAPEFLIR complete | agent-lifecycle extends OAPEFLIR loop | Must wait for P6 complete, cannot stub |
| **multi-region integration** | P5 Runtime complete (HA/dispatch extracted) | multi-region extends extracted HA Coordinator | Must wait for P5 Wave 1 complete |
| **Knowledge domain isolation** | P7 Interaction complete (knowledge migrated) | §50 knowledge domain isolation extends knowledge module | Must wait for P7 complete |

#### Stub Strategy

Modules that can stub first then integrate (new capability lane can start early):
- `org-hierarchy` — stub `OrgNodeRepository` interface, return single-layer org
- `autonomy` — stub `AutonomyGate`, default return LEVEL_1 (lowest autonomy)
- `nl-entry` — stub `IntentClassifier`, pass through raw text
- `emergency-brake` — stub `BrakeService`, default no braking

Modules that must wait for migration complete before integration (hard dependencies):
- `agent-lifecycle` — depends on complete OAPEFLIR loop (P6)
- `multi-region` — depends on real HA Coordinator (P5)
- `drift-detection` — depends on real behavior baseline data (P9)
- `self-ops-agent` — depends on complete platform capabilities (after P10)

### 12.3 Port Checklist

For each module port, complete the following:

- [ ] Copy source files to new project corresponding directory
- [ ] Update import paths (if seven-layer directory reorganization changes paths)
- [ ] Synchronously copy `tests/unit/<module>/` and `tests/unit/core/<module>/` to new project
- [ ] Synchronously copy `tests/integration/<module>/` to new project
- [ ] Run that module's unit tests, confirm all pass
- [ ] Run related integration tests, confirm all pass
- [ ] If golden test involves this module, update snapshots and verify
- [ ] If e2e test involves this module, verify end-to-end flow passes
- [ ] If performance test involves this module, verify performance baseline met
- [ ] Update module's contract document references (§ numbering)
- [ ] Register in new platform's module-inventory
- [ ] Confirm zero TypeScript compilation errors
- [ ] Run `npm run test:unit` full regression

### 12.4 Non-Port List

The following content is **explicitly not ported**, archived only:

| Content | Reason |
|------|------|
| All `docs_zh/archive/` | Historical archive |
| 9 ⚪ D files in `docs_zh/reference/` | Superseded by v2.7 |
| `docs_zh/automatic_agent_platform/agent_platform.md` (92K lines) | Unexpurgated old version, superseded by v2.7 (6.7K lines) |
| Middle translation fragment files in `docs_zh/automatic_agent_platform/` | chunk_b-j, part1-6 are translation intermediate products |
| 6 ⚪ D files in `docs_zh/reviews/` | Old reviews |
| 10 ⚪ D contracts in `docs_zh/contracts/` | Early v1.x contracts |

---

## 13. Phase Entry and Exit Criteria

Each port Phase must meet clear Definition of Ready and Definition of Done, cannot proceed to next Phase if not met.

| Phase | Entry Criteria | Exit Criteria (Definition of Done) |
|-------|---------|-------------------------------|
| **P0 Test Helpers** | New project repo initialized, tsconfig/eslint/package.json in place | All 19 helper files pass `tsc --noEmit`; `createTempWorkspace()` available in new project |
| **P1 Shared Kernel** | P0 exit criteria met | types/errors/constants/utils/results/lifecycle all compile; 38 unit tests all green; zero external runtime dependencies |
| **P2 Infra Foundation** | P1 exit criteria met | storage/events/config/locking/queue/cache compile; 180 unit tests + related integration tests all green; SQLite migration ledger integrity verified; `npm run test:unit` full regression green |
| **P3 Security** | P2 exit criteria met | security/approvals/cost/compliance/hr compile; 115 tests green; 64 security boundary integration tests all pass (including sandbox escape/path traversal/SSRF rejection paths) |
| **P4 AI Ops** | P2 exit criteria met | providers/tools/workflow/artifacts compile; 100 tests green; Provider CircuitBreaker integration test passes |
| **P5 Runtime** | P2+P3+P4 exit criteria met | runtime 12 BCs extracted by wave; 150 tests green; stable-* rehearsal scenarios all pass; dispatch/lease/recovery integration tests pass |
| **P6 OAPEFLIR** | P4+P5 exit criteria met | agent-loop/planning/feedback/learning/evaluation/improvement compile; 56 tests green; OAPEFLIR 8-stage full loop E2E passes |
| **P7 Interaction** | P5+P6 exit criteria met | memory/knowledge/messages/gateway compile; 70 tests green; session→memory→retrieval end-to-end passes |
| **P8 Business Domain** | P2+P7 exit criteria met | domain-registry/divisions/plugins compile; 40 tests green; at least 1 division end-to-end loads successfully |
| **P9 Maturity** | P5 exit criteria met | observability/ops/stability/evolution/reliability/product/deployment compile; 165 tests green; health check + SLO alerting integration test passes |
| **P10 CLI + E2E** | P1-P9 all exit criteria met | CLI 78 entries compile; 10 E2E tests green; 8 golden test snapshots match; 6 performance tests meet baseline; `npm test` full regression green; `npm run build` generates dist/ successfully |

### 13.1 Module-Level Deliverable Acceptance Template

Phase DoD defines phase-wide gate, but each **module** after migration completes must deliver the following 5 items, incomplete cannot mark as "complete":

| Deliverable | Content | Acceptance Criteria |
|--------|------|---------|
| **Code** | Migrated source code, placed in new project target directory | `tsc --noEmit` zero errors; import paths updated; no references to old project paths |
| **Contract** | interface/schema/contract documents updated | New adapter interfaces have JSDoc; if DB schema changes involved, migration files created |
| **Tests** | unit + integration + (if involved) e2e regression | All tests for this module green; new adapters have corresponding unit tests |
| **Documentation** | module-inventory registration + contract references (§ numbering) updated | Module name/file count/lines/owner registered in new platform module-inventory.md |
| **Migration Notes** | Compatibility/breaking change records | Record: (1) Interface change list (2) Deprecated APIs (3) New dependencies (4) Configuration changes |

**Template example** (using `core/events/` as example):

```
Module: core/events/
Phase: P2
Deliverables check:
  [x] Code: 8 files migrated to new-project/src/core/events/, tsc passes
  [x] Contract: 8 new event namespace interfaces added (delegation.*/hibernation.*/...)
  [x] Tests: 10 unit tests + 2 integration tests all green
  [x] Documentation: module-inventory registered, contract references updated to v2.7 §28
  [x] Migration notes: Breaking change — EventBus.emit() signature adds namespace parameter
```

### 13.2 Regression Gate

Each Phase exit must run:
1. `tsc --noEmit` — zero compilation errors
2. `npm run test:unit` — full unit tests green
3. That Phase's `npm run test:integration` subset green
4. `npm run build` — dist/ can be generated

### 13.3 Block Upgrade Rule

- When any Phase exit criteria not met, that Phase marked **BLOCKED**
- BLOCKED Phase's downstream Phases cannot start
- After fix, need to run complete exit verification again

---

## 14. Migration Freeze Line

During migration, the following technology stack is **frozen unchanged** to avoid introducing additional uncertainty:

| Frozen Item | Current Version/Selection | Freeze Reason |
|--------|-------------|---------|
| **Test framework** | Node.js 22 built-in `node:test` + `assert/strict` | 1,069 test files depend, switching framework equals rewriting tests |
| **Module system** | TypeScript ESM (`.js` extension imports) | Full ESM, switching CJS affects all imports |
| **Database backend** | SQLite (Phase 1-2) + PostgreSQL (optional) | storage layer 101 files + all test fixtures based on SQLite |
| **CLI framework** | Direct `process.argv` parsing + 78 thin scripts | CLI is thin wrapper of service, switching framework has no benefit |
| **Observability stack** | OpenTelemetry + Prometheus + StructuredLogger | 36 observability files + SLO alerting depend |
| **Configuration validation** | Zod schema | 27 configuration files + 8-layer configuration governance depend |
| **Package manager** | npm | CI workflows + scripts depend |

### 14.1 Freeze Line Change Process

If frozen item truly needs to change:
1. Submit ADR explaining change reason and impact scope
2. Evaluate affected file count and test count
3. Obtain architecture owner approval
4. Changes must be completed on separate branch, not intermixing with port work

---

## 15. Effort Estimation and Assumptions

### 15.1 Effort Breakdown

| Work Item | Person-days | Description |
|--------|------|---------|
| P0-P1 file move + compilation fix | 2 | Zero-modification modules |
| P2 Infra (including storage split §9) | 27 | storage split 20 person-days + remaining infra 7 person-days |
| P3 Security | 4 | Security test validation mainly |
| P4 AI Ops | 5 | providers/tools adapter writing |
| P5 Runtime (including runtime split §10) | 30 | runtime split 20 person-days + integration validation 10 person-days |
| P6-P8 OAPEFLIR + Interaction + Domain | 10 | Mainly adaptation work |
| P9 Maturity | 7 | observability/ops/stability |
| P10 CLI + E2E + full regression | 8 | E2E adaptation + golden update + performance validation |
| Buffer (20%) | 7 | Unforeseen compatibility issues |
| **Port total** | **~100 person-days** | |

### 15.2 Assumptions

1. 1 person-day = 8 hours effective development time
2. Team has TypeScript ESM + Node.js 22 experience
3. storage/runtime split can each have dedicated person
4. Port and 24 new module development **in parallel**, new module development effort not included in this estimate
5. Excludes environment setup, CI configuration, code review and other management overhead
6. v1.0's 48 person-days is pure file搬运口径 (copy+import fix), does not include god object split, adapter writing, E2E test adaptation

---

## Appendix A: Port Quantification Statistics

| Metric | Value |
|------|------|
| **Source code** | |
| Source code total file count | 799 |
| Source code total lines | ~174,585 |
| 🟢 Direct port code modules | 18 modules (~27K lines) |
| 🟡 Adapted port code modules | 25 modules (~147K lines) |
| 🔵 Reference-only code modules | 3 modules (~8.9K lines) |
| **Tests** | |
| Test file total | 1,069 |
| Test total lines | ~229,196 |
| 🟢 Direct port tests | ~903 files (~192K lines) |
| 🟡 Adapted port tests | ~145 files (~34K lines) — storage/runtime/CLI/security/recovery/e2e |
| 🔵 Reference-only tests | ~17 files (~3K lines) — soak tests + performance.bak |
| Test infrastructure (helpers) | 19 files / 2,093 lines — 16 🟢 + 3 🟡 |
| **Documents** | |
| Document total file count | ~243 |
| 🟢 Direct port documents | ~48 files |
| 🟡 Adapted port documents | ~74 files |
| 🔵 Reference value documents | ~84 files |
| ⚪ Archive/retire documents | ~37 files |
| **Other assets** | |
| config/ directory | 27 JSON files — all direct port |
| divisions/ directory | 11 division definitions — 🟡 adapted port (need to adapt DomainDescriptor semantic model) |
| **New development** | |
| Modules new platform needs to develop entirely | 24 (missing from legacy in v2.7 §39-§70) |
| **Total** | |
| Port total file count | ~1,868 (source 799 + test 1,069) |
| Port total lines | ~406K (source ~177K + test ~229K) |
| Est. port total effort | **~70-100 person-days** (including tests, storage/runtime split adaptation, adapter writing; excluding 24 new feature module development. v1.0's 48 person-days is only file搬运口径, does not include god object split, interface adaptation, E2E test adaptation) |