# Migration Guideline: Old System to New Platform

> **Document Version**: v1.1
> **Document Status**: Draft
> **Scope**: `docs_zh/` (excluding `docs_zh/automatic_agent_platform/`) + `src/` + `config/` + `divisions/` + `tests/`
> **Target System**: "Enterprise Agent Platform Overall Technical Architecture Design Document" v2.7 (Section 1-70, Seven-Layer Architecture)
> **Evaluation Date**: 2026-04-19

---

## 1. Evaluation Purpose

The old system (automatic-agent-system-main) has **797 source files / 174,585 lines of code** and **200+ documentation files**. The new platform architecture design document v2.7 defines a seven-layer enterprise architecture. This document answers:

1. **Which doc files** can be directly migrated, adapted for migration, or archived?
2. **Which code modules** can be directly migrated, adapted for migration, or need rewriting?
3. **What is the migration priority and recommended execution order?**

---

## 2. Evaluation Methodology

### 2.1 Migration Level Definitions

| Level | Tag | Meaning | Typical Modification Scope |
|-------|-----|---------|---------------------------|
| **A1 — Direct Migration** | Green | Zero modification copy-and-use. Interfaces, naming, and dependencies are all compatible with new architecture | 0 — copy + import path update only |
| **A2 — Implementation Reusable but Needs Adapter** | GreenTool | Core implementation unchanged, need adapter/wrapper to align with new architecture extension points | <=15% — add adapter layer or supplement missing interfaces |
| **B — Adapted Migration** | Yellow | Core logic reusable but needs adaptation to new architecture interfaces/naming/layering | 15%-50% — interface refactoring + dependency replacement |
| **C — Reference Value** | Blue | Not directly migrated, but design approach/test cases/competitor analysis have reference value | N/A — reference only, no code migration |
| **D — Archive and Retire** | White | Outdated or replaced by new design, historical archive only | N/A — archive |

### 2.2 Five-Dimensional Assessment Template

Each module/document's level determination must provide five-dimensional assessment evidence:

| Dimension | Meaning | Scoring Standard |
|-----------|---------|------------------|
| **Architecture Alignment** | Interface/layering alignment with v2.7 target architecture | High=direct interface alignment / Medium=needs adapter / Low=interface rewrite needed |
| **Dependency Pollution** | Coupling degree to external modules, affecting independent migration capability | Low=<=2 direct dependencies / Medium=3-5 / High=>=6 or circular dependencies |
| **Interface Stability** | Expected change to public API during migration | High=unchanged / Medium=extension but compatible / Low=breaking changes |
| **Test Completeness** | Coverage of existing tests for core behavior | High=full behavior coverage / Medium=main path coverage / Low=insufficient coverage |
| **Modification Scope** | Proportion of code that needs modification relative to total module size | Small=<=15% / Medium=15%-50% / Large=>=50% |

**Decision Rules**:
- **A1**: All five dimensions are "High/Low/High/High/Small"
- **A2**: Architecture alignment >= Medium, modification scope <=15%, but needs new adapter/wrapper
- **B**: Core reusable but at least one dimension is "Low" or modification scope >15%
- **C**: Architecture alignment is "Low" and modification scope >=50%
- **D**: Explicitly replaced or deprecated by v2.7

### 2.3 New Architecture Seven-Layer Mapping

```
Layer 7 │ Operational Maturity Layer (Explainability · Emergency Brake · Lifecycle · Edge · Drift · Cost · Debug · Compliance · Capacity · Multimodal · Self-Ops)
Layer 6 │ Scaling Operations Layer + Ecosystem Layer (Multi-Region · Resource Competition · SLA · Marketplace · Feedback · Integration)
Layer 5 │ Organization Governance Layer (Organization Hierarchy · Approval Routing · SSO · Compliance · Knowledge Isolation · Delegation)
Layer 4 │ Intelligent Interaction Layer (NL Entry · Goal Decomposition · Proactive Agent · Autonomy · Dashboard · UX)
Layer 3 │ Business Domain Access Layer (DomainDescriptor · Recipe · Runbook)
Layer 2 │ AI Operations Layer (LLM Abstraction · Prompt · Eval · Cost · HITL · SDK)
Layer 1 │ Infrastructure Layer (Five Planes · Stability · Risk · Security · Recovery · Audit)
```

---

## 3. Overview Matrix

### 3.1 Documentation Migration Overview

| Category | File Count | Green Direct | Yellow Adapted | Blue Reference | White Archive |
|----------|------------|--------------|----------------|----------------|---------------|
| Main Documents (docs_zh/architecture/) | 5 | 0 | 5 | 3 | 0 |
| Technical Analysis Documents (docs_zh/analysis/) | 3 | 0 | 2 | 0 | 0 |
| Architecture and Sequence Diagrams | 4 | 0 | 3 | 1 | 0 |
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

### 3.2 Code Migration Overview

| Architecture Layer | Module | File Count | Lines | Green | Yellow | Blue | White |
|-------------------|--------|------------|-------|-------|--------|------|-------|
| Layer 1 Infrastructure | types, errors, storage, events, config, cache, locking, queue, api, lifecycle, constants, utils, resource, results | ~230 | ~50K | 8 modules | 5 modules | 1 module | 0 |
| Layer 2 AI Operations | runtime, agent-loop, planning, tools, providers, workflow, orchestration, artifacts, feedback, learning, evaluation | ~230 | ~58K | 3 modules | 7 modules | 1 module | 0 |
| Layer 3 Business Domain | domain-registry, divisions, plugins | ~38 | ~5.7K | 2 modules | 1 module | 0 | 0 |
| Layer 4 Intelligent Interaction | memory, knowledge, messages, gateway | ~54 | ~10.7K | 1 module | 3 modules | 0 | 0 |
| Layer 5 Organization Governance | security, approvals, compliance, cost, hr | ~28 | ~8.6K | 2 modules | 3 modules | 0 | 0 |
| Layer 6 Scaling | deployment, improvement, product (partial) | ~35 | ~8.4K | 0 | 2 modules | 1 module | 0 |
| Layer 7 Operational Maturity | observability, ops, stability, evolution, reliability | ~106 | ~32.6K | 2 modules | 3 modules | 0 | 0 |
| Cross-layer CLI | cli | 78 | ~6.1K | 0 | 1 (whole) | 0 | 0 |
| **Total** | **43 modules** | **~799** | **~180K** | **18** | **25** | **3** | **0** |

---

## 4. Documentation Migration Detailed Assessment

### 4.1 Main Documents (docs_zh/architecture/)

| File | Lines | Level | Target Architecture Layer | Migration Notes |
|------|-------|-------|---------------------------|-----------------|
| `00-platform-architecture.md` | ~2,000 | Yellow B | Cross-layer | Documentation layering governance model (L0-L10) reusable, needs update to seven-layer architecture documentation system |
| `01-code-structure.md` | ~500 | Yellow B | Layer 1-2 | Directory structure + control-plane role definitions reusable, needs alignment with v2.7 Section 1-5 |
| `02-code-architecture-reference.md` | ~800 | Yellow B | Layer 5 | Agent layering, permissions, security model compatible with v2.7 Section 11 security system, needs organization governance extension |
| `03-module-diagrams.md` | ~400 | Yellow B | Layer 2,4 | Six-layer module diagram and feedback loop compatible, needs KV cache alignment details update |
| `04-runtime-sequence.md` | ~300 | Blue C | Cross-layer | Constraints and anti-pattern list serves as new platform design reference |

### 4.2 Technical Analysis Documents (docs_zh/analysis/)

| File | Lines | Level | Migration Notes |
|------|-------|-------|-----------------|
| `00-architecture-coverage-matrix.md` | ~150 | Yellow B | Coverage matrix, needs update to reflect five-plane module reorganization |
| `01-codebase-vs-design-review.md` | ~2,000 | Yellow B | Code and design difference analysis handbook |
| `02-implementation-progress-tracker.md` | ~100 | Blue C | Implementation progress tracking as reference |

### 4.3 Architecture and Sequence Diagram Documents

| File | Lines | Level | Migration Notes |
|------|-------|-------|-----------------|
| `00-platform-architecture.md` | ~2,000 | Yellow B | Main architecture entry document, SLO quantitative indicators (95%/90%/100%) reusable, needs alignment with v2.7 Section 27 |
| `04-runtime-sequence.md` | ~300 | Yellow B | 4 sets of core runtime sequence diagrams (Intake/Dispatch/Writeback/Recovery) directly migratable, needs OAPEFLIR full cycle sequence supplement |

### 4.4 Contract Documents (docs_zh/contracts/) — 113 Files

**Direct Migration (Green A) — 22 Files**: These contract-defined interfaces are fully compatible with the new architecture.

| Contract | Target Architecture Section |
|----------|----------------------------|
| `state_transition_matrix_contract.md` | Section 9 State Machine |
| `event_bus_contract.md` | Section 4 Event Bus Plane |
| `storage_schema_contract.md` (748 lines) | Section 26 Data Model |
| `sandbox_and_auth_contract.md` | Section 11 Security System |
| `tool_skill_plugin_contract.md` | Section 30 Business Pack |
| `slo_alerting_and_runbook_contract.md` | Section 27 Performance SLO |
| `memory_decay_and_quality_contract.md` | Section 3.5 Memory Quality |
| `release_rollout_and_rollback_contract.md` | Section 32 Deployment |
| `runtime_execution_contract.md` | Section 13 OAPEFLIR |
| `plugin_spi_contract.md` | Section 30 Plugin |
| `knowledge_spi_contract.md` | Section 3.4 Knowledge Plane |
| `ha_coordinator_and_leader_election_contract.md` | Section 31 Disaster Recovery |
| Other 10 basic contracts | Layer 1 various sections |

**Adapted Migration (Yellow B) — 38 Files**: Core constraints reusable, need adaptation to new naming/layering/extension points.

| Contract Category | File Count | Adaptation Points |
|-------------------|------------|-------------------|
| Agent Behavior Contracts | 8 | Need v2.7 Section 42 progressive autonomy + Section 41 proactive Agent constraints |
| OAPEFLIR Loop Contracts | 5 | Need to extend Plan/Learn/Improve/Rollout stage contract details |
| API Contracts | 6 | Need Section 39 NL entry + Section 44 non-technical user endpoints |
| Billing/Tenant Contracts | 4 | Need Section 46 organization hierarchy + Section 54 SLA tiering |
| Security/Compliance Contracts | 5 | Need Section 49 division compliance + Section 52 GDPR cross-border |
| Others | 10 | Naming and reference updates |

**Reference Value (Blue C) — 20 Files**: Design approach referenceable but interfaces superseded by new design.

**Archive and Retire (White D) — 10 Files**: Early v1.x contracts superseded by v2.7.

### 4.5 ADR (docs_zh/adr/) — 38 Files

**Direct Migration (Green A) — 15 Files**:

| ADR | Decision Topic | Target Architecture Section |
|-----|---------------|----------------------------|
| `001-three-layer-architecture.md` | Three-layer architecture | Section 1 Overall Architecture |
| `003-memory-seven-layers.md` | Memory layering | Section 3.5 Memory |
| `005-security-model.md` | Security model | Section 11 Security |
| `006-llm-provider-strategy.md` | LLM strategy | Section 15 Provider |
| `012-sqlite-phase-1-2-primary-store.md` | SQLite selection | Section 26 Storage |
| `016-oapeflir-loop-model.md` | OAPEFLIR model | Section 13 OAPEFLIR |
| `018-rollout-eleven-state-machine.md` | Rollout state machine | Section 32 Deployment |
| `019-agent-handoff-four-layer-protocol.md` | Agent handoff | Section 19 Delegation |
| `020-memory-six-plane-model.md` | Memory six-plane | Section 3.5 |
| `060-explicit-planning-hub.md` | Planning Hub | Section 13 OAPEFLIR-P |
| `071-plugin-spi-framework.md` | Plugin SPI | Section 30 |
| `072-oapeflir-testing-strategy.md` | OAPEFLIR testing | Section 27 |
| `075-controlled-rollout-release.md` | Controlled release | Section 32 |
| `078-knowledge-plane-architecture.md` | Knowledge architecture | Section 3.4 |
| `079-feedback-hub-signals.md` | Feedback signals | Section 56 |

**Adapted Migration (Yellow B) — 8 Files**: Decisions valid but need extension for seven-layer architecture.

| ADR | Adaptation Points |
|-----|-------------------|
| `002-division-system.md` | Need to add Section 46 organization hierarchy impact on Division |
| `004-workflow-routing.md` | Need to adapt Section 40 goal decomposition engine multi-level routing |
| `007-evolution-engine.md` | Need to align with v2.7 Section 65 behavior drift detection |
| `008-cost-model.md` | Need to extend Section 66 cost attribution optimization |
| `009-deployment-ops.md` | Need to add Section 64 edge/offline deployment |
| `011-effect-ts-adoption.md` | Need to re-evaluate Effect-TS adoption decision in new platform |
| `013-eventemitter-phase-2-boundary.md` | Need to evaluate whether Phase 2 continues using EventEmitter |
| `017-knowledge-architecture-refactor.md` | Need to align with v2.7 Section 50 knowledge domain isolation |

**Reference Value (Blue C) — 3 Files**: `010-commercial-model.md`, `014-org-model-code-boundary.md`, `080-learn-hub-pattern-detection.md`

**Archive and Retire (White D) — 2 Files**: `015-unified-extension-marketplace.md` (superseded by v2.7 Section 55), early draft ADRs

### 4.6 Governance Documents (docs_zh/governance/) — 7 Files

| File | Level | Migration Notes |
|------|-------|----------------|
| `source_of_truth.md` | Green A | Data source governance rules directly applicable |
| `change_control.md` | Green A | Change control process directly applicable |
| `naming_and_directory_conventions.md` | Green A | Naming and directory conventions directly applicable |
| `glossary_and_terminology.md` | Green A | Terminology directly applicable, need v2.7 Appendix G terminology supplement |
| `autonomy_boundary_policy.md` | Yellow B | Need to align with v2.7 Section 42 progressive autonomy model |
| `rollout_release_policy.md` | Yellow B | Need to align with v2.7 Section 32 deployment strategy |
| `phase1_scope_freeze.md` | Yellow B | Need to map to new platform Phase definition |
| `README.md` | Blue C | Navigation file reference |

### 4.7 Guide Documents (docs_zh/guides/) — 4 Files

| File | Level | Migration Notes |
|------|-------|----------------|
| `quickstart.md` | Green A | Quickstart guide directly reusable, update ports/config |
| `contributing.md` | Green A | Contributing guide directly applicable |
| `division-authoring.md` | Yellow B | Need update to reflect v2.7 Section 37 DomainDescriptor |
| `skill-authoring.md` | Yellow B | Need update to reflect v2.7 Section 30 Pack lifecycle |

### 4.8 Operations Documents (docs_zh/operations/) — 16 Files

**Direct Migration (Green A) — 5 Files**:

| File | Migration Notes |
|------|----------------|
| `runbooks/database-issues.md` | Database issues operations manual directly applicable |
| `runbooks/memory-pressure.md` | Memory pressure handling directly applicable |
| `runbooks/incident-response-playbook.md` | Incident response playbook directly applicable |
| `test_coverage_baseline_gate.md` | Coverage gate rules directly applicable |
| `src_module_test_matrix.md` (1,455 lines) | Module-test mapping matrix, format reusable, need module list update |

**Adapted Migration (Yellow B) — 10 Files**: Phase plans, Roadmap, implementation plans need remapping to seven-phase roadmap.

**Reference/Archive — 15+ Files**: Historical TODOs, old gap analysis, archived plans under archive/.

### 4.9 Review Documents (docs_zh/reviews/) — 1 File

| Level | File | Notes |
|-------|------|-------|
| Yellow B | `test_strategy_plan.md` (1,957 lines) | Test strategy reusable, need Layer 4-7 extension |
| Yellow B | `authoritative_task_store_refactoring_plan.md` (1,233 lines) | TaskStore refactoring plan has guiding value for new platform storage layer |
| Yellow B | `opeli_detailed_design.md` (4,484 lines) | OAPEFLIR detailed design directly corresponds to v2.7 Section 13 |
| Blue C | `production_gap_detailed_solutions.md` (2,590 lines) | Production gap solutions as reference |
| Blue C | `production_gap_solution_v2.md` (2,598 lines) | Same as above v2 |
| Blue C | `design_gap_analysis.md` (2,424 lines) | Design gap analysis as new platform verification checklist |
| Blue C | Other 9 files | Historical review records as reference |
| White D | 6 files | Old reviews superseded |

### 4.10 Reference Documents (docs_zh/reference/) — 0 Files

| Level | Notes |
|-------|-------|
| Blue C (8 files) | Architecture/module/security/storage/communication chapters mechanically split from old monolith, design approach referenceable |
| White D (9 files) | Old content fully covered by v2.7, archived |

### 4.11 Research Documents (docs_zh/research/) — 0 Files

| Level | Notes |
|-------|-------|
| Blue C (all 28 files) | Competitor analysis (Claude Code/Codex/Goose/Aider/MetaGPT/LangGraph/Temporal/DeerFlow etc.) and reference alignment reviews. Not directly migrated but high reference value for new platform design decisions. Recommend retaining entire `docs_zh/research/` directory and moving to new project |

### 4.12 Archive Documents (docs_zh/archive/) — 0 Files

| Level | Notes |
|-------|-------|
| White D (all 3 files) | `automatic-agent-architecture-monolith-dedup.md` (11,392 lines) etc. are historical archives, retained for audit traceability only |

---

## 5. Code Module Migration Detailed Assessment

### 5.1 Layer 1 — Infrastructure Layer

#### Green Direct Migration (8 Modules)

| Module | Files/Lines | Target Section | Migration Notes |
|--------|-------------|----------------|-----------------|
| `core/types/` | 21 / 2,887 | Section 5 Contracts | Branded ID, state enums, 15+ domain record types. Zero external dependencies, TypeScript strict mode. **Migrate as-is** |
| `core/errors.ts` | 1 / 490 | Section 10 Exceptions | 14-category `AppError` hierarchy + serialization. Zero dependencies. **Migrate as-is** |
| `core/constants/` | 2 / 16 | Cross-layer | Time constants. **Migrate as-is** |
| `core/utils/` | 2 / 109 | Cross-layer | BoundedCache utility class. **Migrate as-is** |
| `core/results/` | 2 / 390 | Section 5 Contracts | ResultEnvelope pattern. **Migrate as-is** |
| `core/locking/` | 8 / 635 | Section 31 Disaster Recovery | Distributed lock abstraction (SQLite/Redis/PG advisory). Clean adapter pattern. **Migrate as-is** |
| `core/queue/` | 6 / 771 | Section 4 Events | Queue abstraction (SQLite/Redis) + factory. **Migrate as-is** |
| `core/lifecycle/` | 3 / 276 | Section 8 Extensions | ServiceRegistry + teardown ordering. **Migrate as-is** |

#### Yellow Adapted Migration (5 Modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|--------|-------------|----------------|-------------------|
| `core/storage/` | 101 / 26,102 | Section 26 Data Model | `AuthoritativeTaskStore` is global data access facade (god object). Core SQL schema/migration reusable, but needs splitting into domain-based Repositories. PG async adapter pattern excellent and retainable |
| `core/events/` | 8 / 1,894 | Section 28 Events | 3-tier DurableEventBus design excellent. Need to add v2.7 Section 28 new 8 event namespaces (delegation.*/hibernation.*/prompt.*/eval.*/cost.*/approval_flow.*/agent_lifecycle.*/circuit_breaker.*) |
| `core/config/` | 27 / 6,776 | Section 24 Config | Zod schema validation + 8-layer config governance reusable. Need to add Section 46 organization hierarchy config + Section 64 edge deployment config |
| `core/cache/` | 27 / 2,518 | Section 26 Cache | L1/L2/L3 multi-level cache + domain policy. Need to add Section 50 knowledge domain isolation cache partition |
| `core/api/` | 30 / 5,006 | Section 6 API | HTTP server + OIDC/OAuth + WebSocket. Need to add Section 39 NL entry endpoint + Section 44 non-technical user API + Section 48 SSO/SCIM endpoints |

#### Blue Reference Value (1 Module)

| Module | Notes |
|--------|-------|
| `core/resource/` | 2 / 361 | ProcessTracker process tracking logic referenceable, but new platform may use different process management model |

### 5.2 Layer 2 — AI Operations Layer

#### Green Direct Migration (3 Modules)

| Module | Files/Lines | Target Section | Migration Notes |
|--------|-------------|----------------|-----------------|
| `core/providers/` | 10 / 4,436 | Section 15 LLM | UnifiedChatProvider (Anthropic/OpenAI/MiniMax) + CircuitBreaker + CredentialPool + ModelRouting. Clean adapter pattern. **A2 Migration**: Core implementation unchanged, need to add Section 15.6 streaming error handling adapter (architecture alignment=Medium, modification scope <=15%) |
| `core/workflow/` | 4 / 1,011 | Section 13 OAPEFLIR | MinimalWorkflow + Validator + OutputSchema + StepRetryPolicy. **Migrate as-is** |
| `core/artifacts/` | 13 / 1,095 | Section 30 Pack | Artifact model/storage/version/release/governance/sensitive content scanning. **A2 Migration**: Need evidence/compliance chain adapter + Section 69 multimodal artifact + Section 55 marketplace release interface (architecture alignment=Medium, modification scope <=15%) |

#### Yellow Adapted Migration (7 Modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|--------|-------------|----------------|-------------------|
| `core/runtime/` | 114 / 30,348 | Section 9,13,31 | **Largest module, highest risk**. ExecutionDispatch/Lease/Worker/HA/Recovery/HotUpgrade core logic reusable. Adaptation points: (1) Split into 5 independent bounded contexts: Dispatch/Lease/Worker/HA/Recovery; (2) Adapt Section 41 proactive Agent scheduling; (3) Add Section 52 multi-Region dispatch; (4) Add Section 53 resource competition management |
| `core/agent-loop/` | 31 / 2,562 | Section 13 OAPEFLIR | OapeflirLoopService + Assessment + Handoff + StageTimeline. Core loop logic complete. Need to add Section 42 autonomy assessment stage + Section 59 explainability output |
| `core/planning/` | 9 / 314 | Section 13 OAPEFLIR-P | PlanBuilder/DAGValidator/StrategySelector. Need to extend Section 40 goal decomposition engine multi-level decomposition capability |
| `core/tools/` | 36 / 13,500 | Section 30 Tools | CommandExecutor/SkillExecution/ToolSanitizer/PathScope/MCPGuard. Security boundaries complete. Need to add Section 69 multimodal tool support + Section 37 domain tool registration |
| `core/orchestration/` | 3 / 1,054 | Section 13 Orchestration | IntakeRouter/WorkflowPlanner/AgentTeamService. Need to adapt Section 39 NL entry + Section 40 goal decomposition + Section 46 organization hierarchy routing |
| `core/feedback/` | 5 / 532 | Section 56 Feedback | FeedbackCollector/SignalPreprocessor. Need to extend Section 56 feedback-driven continuous improvement pipeline full signal types |
| `core/learning/` | 14 / 682 | Section 13 OAPEFLIR-L | FailurePatternMiner/ExperienceDistillation/StrategyLearning + 4 pattern detectors. Need to add Section 65 behavior drift detection patterns |

#### Blue Reference Value (1 Module)

| Module | Notes |
|--------|-------|
| `core/evaluation/` | 6 / 1,429 | PostExecutionQualityGate/LlmEvalService logic referenceable, but v2.7 Section 17 defines more complete model evaluation framework, needs redesign |

### 5.3 Layer 3 — Business Domain Access Layer

#### Green Direct Migration (2 Modules)

| Module | Files/Lines | Target Section | Migration Notes |
|--------|-------------|----------------|-----------------|
| `core/domain-registry/` | 14 / 2,456 | Section 37 Domain Modeling | DomainRegistryService/PluginSpiRegistry/ContractRegistry/ToolBundleRegistry/WorkflowRegistry/PluginRuntimeHost. SPI pattern clean. **Migrate as-is**, need DomainDescriptor registration |
| `core/divisions/` | 4 / 1,632 | Section 37 Domain | DivisionLoader + YAML secure loading + HrRoleGovernance. **Migrate as-is** |

#### Yellow Adapted Migration (1 Module)

| Module | Files/Lines | Target Section | Adaptation Points |
|--------|-------------|----------------|-------------------|
| `plugins/` | 20 / 1,672 | Section 30,55 | 16 builtin plugins (6 domains: coding/ops/growth/game-dev/asset-production/livestream). SPI adapter/presenter/retriever/validator/planner pattern reusable. Need to add Section 55 marketplace ecosystem packaging/release/deprecation lifecycle |

### 5.4 Layer 4 — Intelligent Interaction Layer

#### Green Direct Migration (1 Module)

| Module | Files/Lines | Target Section | Migration Notes |
|--------|-------------|----------------|-----------------|
| `core/messages/` | 2 / 509 | Section 39 Messages | MessageParts + TokenEstimator. **Migrate as-is** |

#### Yellow Adapted Migration (3 Modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|--------|-------------|----------------|-------------------|
| `core/memory/` | 16 / 3,335 | Section 3.5 Memory | Layered memory (session/project/user/global) + consolidation/promotion/retrieval/quality. Need to add Section 50 knowledge domain isolation memory partition + Section 64 edge deployment local memory cache |
| `core/knowledge/` | 23 / 3,443 | Section 3.4 Knowledge | KnowledgePlane/Ingestion/Embedding/VectorStore/Graph/Retrieval + governance. Need to add Section 50 knowledge domain isolation + Section 69 multimodal knowledge indexing |
| `gateway/` | 13 / 3,471 | Section 6,44 | ChannelGateway (Telegram/Slack/Webhook) + WebSocket + SSE. Need to add Section 39 NL channel + Section 44 non-technical user frontend gateway + Section 57 external system integration gateway |

### 5.5 Layer 5 — Organization Governance Layer

#### Green Direct Migration (2 Modules)

| Module | Files/Lines | Target Section | Migration Notes |
|--------|-------------|----------------|-----------------|
| `core/security/` | 19 / 7,125 | Section 11 Security | SandboxPolicy/PolicyEngine/SecretManagement/AuditIntegrity/FieldEncryption/NetworkEgress/CveIntelligence. **A2 Migration**: Core security mechanisms unchanged, need to add Section 49 division security policy engine adapter (architecture alignment=Medium, modification scope <=15%) |
| `core/cost/` | 2 / 64 | Section 18 Cost | BudgetGuard. Lightweight but complete. **Migrate as-is**, need to extend Section 66 cost attribution optimization |

#### Yellow Adapted Migration (3 Modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|--------|-------------|----------------|-------------------|
| `core/approvals/` | 3 / 495 | Section 21 HITL | ApprovalService/TimeoutExecutor. Need to add Section 47 organization hierarchy approval routing + multi-party approval/delegation |
| `core/compliance/` | 2 / 346 | Section 23,68 | AuditExportService. Need to extend Section 68 compliance report auto-generation + Section 52 GDPR cross-border |
| `core/hr/` | 2 / 572 | Section 46 Organization | HrRoleGovernanceService. Need to add Section 46 organization hierarchy model + Section 51 tiered governance delegation |

### 5.6 Layer 6 — Scaling Operations Layer

#### Yellow Adapted Migration (2 Modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|--------|-------------|----------------|-------------------|
| `core/deployment/` | 2 / 502 | Section 32 Deployment | TrafficRoutingService (blue-green/canary). Need to extend Section 52 multi-Region deployment + Section 64 edge deployment |
| `core/improvement/` | 11 / 770 | Section 13 OAPEFLIR-IR | StrategyVersioning/AutonomyBoundary/GuardrailEvaluator/AutoRollback/CanaryRouter/RolloutStateMachine. Need to align with Section 42 progressive autonomy + Section 55 marketplace Agent version management |

#### Blue Reference Value (1 Module)

| Module | Notes |
|--------|-------|
| `core/product/` | 22 / 7,109 | BillingService/Marketplace/TenantPlatform/PMF/EnterpriseCapability. Commercial logic deeply coupled with old system Phase 1-2, needs redesign based on v2.7 Section 54 SLA tiering + Section 55 marketplace ecosystem |

### 5.7 Layer 7 — Operational Maturity Layer

#### Green Direct Migration (2 Modules)

| Module | Files/Lines | Target Section | Migration Notes |
|--------|-------------|----------------|-----------------|
| `core/observability/` | 36 / 8,172 | Section 12,27 | StructuredLogger/HealthService/Prometheus/OpenTelemetry/SLO-Alerting/AnomalyDetection. **Migrate as-is**, need to add Section 67 visual debugging support |
| `core/reliability/` | 8 / 1,112 | Section 10 Risk | FailureClassification/RepairPipeline/PatchBundle/TaskCard. **Migrate as-is** |

#### Yellow Adapted Migration (3 Modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|--------|-------------|----------------|-------------------|
| `core/ops/` | 19 / 8,308 | Section 12,32 | DoctorService/OpsGovernance/EnterpriseGovernance/ReleasePipeline/HumanTakeover/AutoStopLoss. Need to add Section 60 emergency brake + Section 70 platform self-ops Agent |
| `core/stability/` | 31 / 12,789 | Section 27,32 | 20+ stability rehearsal scenarios + evidence bundling. Need to add Section 64 edge deployment rehearsal + Section 65 drift detection rehearsal |
| `core/evolution/` | 12 / 2,268 | Section 65 Drift | EvolutionMVP/Reflection/Proposal/Benchmark/Rollout. Need to align with Section 65 behavior drift detection + Section 61 unified lifecycle management |

### 5.8 Cross-Layer — CLI

#### Yellow Adapted Migration (Whole)

| Module | Files/Lines | Adaptation Points |
|--------|-------------|-------------------|
| `cli/` | 78 / 6,149 | 78 CLI entry points are thin wrapper layers, dependent on underlying service. Migration strategy: **migrate synchronously with service migration**. Need to add Section 39 NL CLI entry + Section 43 operations dashboard CLI + Section 46 organization management CLI |

### 5.9 Supporting Assets

#### config/ — Green Direct Migration

| Directory | File Count | Migration Notes |
|-----------|------------|----------------|
| `config/bootstrap/` | 1 | Phase config directly reusable |
| `config/runtime/` | 6 | Runtime config (with 5 environment variants) directly reusable |
| `config/security/` | 6 | Security config directly reusable |
| `config/providers/` | 3 | Provider + model metadata directly reusable |
| `config/environments/` | 5 | Environment config directly reusable |
| `config/plugins/` | 1 | Plugin config directly reusable |
| `config/domains/` | 1 | Domain config reusable, need DomainDescriptor extension |
| `config/gateways/` | 1 | Gateway config directly reusable |
| `config/workflows/` | 1 | Workflow config directly reusable |
| `config/knowledge/` | 1 | Knowledge config directly reusable |
| `config/product/` | 1 | Product config directly reusable |

#### divisions/ — Yellow Adapted Migration

| Content | Migration Notes |
|---------|----------------|
| 11 division definitions (with YAML + roles/ + workflows/ + schemas/) | Yellow downgrade reason: v2.7 Section 37 DomainDescriptor semantic model has destructive changes to division YAML structure, need to add descriptor metadata fields, domain capability declarations, SLA bindings. YAML schema changes affect all 11 definition files |

#### tests/ — See Section 5.10 Test Migration Detailed Assessment

#### Infrastructure Files — Green Direct Migration

| File | Migration Notes |
|------|----------------|
| `package.json` | Dependency declarations and 110+ npm scripts directly reusable, need to clean up no-longer-needed scripts |
| `tsconfig.json` / `tsconfig.build.json` | TypeScript strict config directly reusable |
| `eslint.config.js` | ESLint 9 flat config directly reusable |
| `.c8rc.json` | Coverage config directly reusable |
| `Dockerfile` | Multi-stage build directly reusable, need edge deployment variant |
| `docker-compose.yml` | Three-service orchestration directly reusable, need Redis cluster variant |
| `.env.example` | 346-line environment variable template directly reusable, need Layer 4-7 config items |
| `.github/workflows/` | 4 CI workflows directly reusable |
| `scripts/` | CI/build scripts directly reusable |
| `deploy/` | Deployment manifests directly reusable |

### 5.10 Test Migration Detailed Assessment

> **Total Test Scale**: 1,069 files / ~229,196 lines

#### Test Infrastructure Dependencies

| Dependency | Notes | Migration Impact |
|------------|-------|------------------|
| Node.js 22 built-in test runner | `import test from "node:test"` + `assert/strict` | Green No migration cost, new platform continues using |
| SQLite (DatabaseSync) | Almost all tests create temp DB via `SqliteDatabase` | Yellow Need to ensure new platform retains SQLite test backend |
| TypeScript ESM | All use `.js` extension ESM imports | Green New platform continues ESM |
| Hand-written Mocks (no external mock library) | `typed-factories.ts` + deterministic bridge pattern | Green Zero external dependencies, directly migratable |
| PostgreSQL (optional) | Only `pg-test-helper.ts` and few storage tests, need `AA_TEST_PG_DSN` env var | Green Optional dependency, doesn't affect main flow |
| Temp filesystem workspace | `createTempWorkspace()` / `cleanupPath()` | Green Directly migratable |

#### 5.10.1 tests/helpers/ — 19 files / ~2,093 lines

| File | Lines | Level | Purpose | Migration Notes |
|------|-------|-------|---------|-----------------|
| `fs.ts` | 21 | Green A | Temp workspace create/cleanup | Almost all tests depend on it, **migrate first** |
| `seed.ts` | 100 | Green A | DB seed data (seedTaskAndExecution) | E2E/golden/integration depend on it |
| `typed-factories.ts` | 143 | Green A | Type-safe mock factories (createPartial/unsafeCast) | Widely used |
| `env.ts` | 53 | Green A | Env var save/restore | Config/CLI tests depend on it |
| `golden.ts` | 80 | Green A | Golden snapshot assertions (supports UPDATE_GOLDEN=1) | Golden tests depend on it |
| `e2e-harness.ts` | 131 | Green A | E2E test fixtures (SQLite + Store + Workspace) | E2E tests depend on it |
| `integration-context.ts` | 131 | Green A | Integration test context | Integration tests depend on it |
| `repository-harness.ts` | 80 | Green A | Repository test fixtures | Storage unit tests depend on it |
| `concurrent-runner.ts` | 158 | Green A | Concurrent operation runner + invariant checks | Concurrent tests depend on it |
| `test-cleanup.ts` | 27 | Green A | Singleton reset + process cleanup | Tests needing isolation depend on it |
| `process-guard.ts` | 90 | Green A | Process leak detection | Runtime/Tool tests depend on it |
| `fixtures/base.ts` | 99 | Green A | Minimal valid record factories | Unit tests depend on it |
| `fixtures/composite.ts` | 227 | Green A | Complex multi-entity state factories | Integration tests depend on it |
| `perception.ts` | 66 | Green A | Perception dataset seed | Product tests depend on it |
| `pmf.ts` | 251 | Green A | PMF validation dataset seed | PMF tests depend on it |
| `billing.ts` | 36 | Green A | Billing dataset seed | Billing tests depend on it |
| `api.ts` | 362 | Yellow B | HTTP API full-stack bootstrap | Need to adapt to new API layer |
| `cli.ts` | 30 | Yellow B | CLI script runner | Need to adapt to new CLI paths |
| `pg-test-helper.ts` | 35 | Yellow B | PostgreSQL test helper | Need to adapt to new PG config |

#### 5.10.2 tests/unit/ — 758 files / ~169,943 lines

Migration assessment by source module:

| Source Module | Test Files | Test Lines | Level | Migrate with Phase |
|---------------|------------|------------|-------|-------------------|
| `types/` | 22 | 5,470 | Green A | Phase 1 |
| `errors.ts` | 1 | 407 | Green A | Phase 1 |
| `constants/` | 3 | 113 | Green A | Phase 1 |
| `utils/` | 3 | 421 | Green A | Phase 1 |
| `results/` | 3 | 806 | Green A | Phase 1 |
| `lifecycle/` | 3 | 443 | Green A | Phase 1 |
| `storage/` | 51 | 18,756 | Yellow B | Phase 2 |
| `events/` | 10 | 1,729 | Green A | Phase 2 |
| `config/` | 37 | 5,935 | Green A | Phase 2 |
| `locking/` | 12 | 1,931 | Green A | Phase 2 |
| `queue/` | 8 | 1,425 | Green A | Phase 2 |
| `cache/` | 34 | 4,675 | Green A | Phase 2 |
| `security/` | 30 | 6,986 | Green A | Phase 3 |
| `approvals/` | 5 | 1,044 | Green A | Phase 3 |
| `cost/` | 4 | 450 | Green A | Phase 3 |
| `compliance/` | 3 | 479 | Green A | Phase 3 |
| `hr/` | 3 | 350 | Green A | Phase 3 |
| `providers/` | 16 | 5,694 | Green A | Phase 4 |
| `tools/` | 48 | 9,959 | Green A | Phase 4 |
| `workflow/` | 10 | 1,572 | Green A | Phase 4 |
| `artifacts/` | 9 | 1,172 | Green A | Phase 4 |
| `runtime/` | 92 | 22,531 | Yellow B | Phase 5 |
| `agent-loop/` | 15 | 3,199 | Green A | Phase 6 |
| `planning/` | 7 | 2,024 | Green A | Phase 6 |
| `feedback/` | 4 | 1,301 | Green A | Phase 6 |
| `learning/` | 12 | 1,928 | Green A | Phase 6 |
| `evaluation/` | 7 | 936 | Green A | Phase 6 |
| `improvement/` | 9 | 2,069 | Green A | Phase 6 |
| `memory/` | 26 | 8,549 | Green A | Phase 7 |
| `knowledge/` | 14 | 3,755 | Green A | Phase 7 |
| `messages/` | 5 | 997 | Green A | Phase 7 |
| `gateway/` | 16 | 3,754 | Green A | Phase 7 |
| `domain-registry/` | 11 | 2,167 | Green A | Phase 8 |
| `divisions/` | 8 | 1,939 | Green A | Phase 8 |
| `plugins/` | 18 | 2,644 | Green A | Phase 8 |
| `observability/` | 35 | 7,556 | Green A | Phase 9 |
| `ops/` | 24 | 4,990 | Green A | Phase 9 |
| `stability/` | 15 | 3,145 | Green A | Phase 9 |
| `evolution/` | 19 | 4,199 | Green A | Phase 9 |
| `reliability/` | 14 | 2,723 | Green A | Phase 9 |
| `product/` | 29 | 7,162 | Green A | Phase 9 |
| `deployment/` | 3 | 536 | Green A | Phase 9 |
| `cli/` | 2 | 346 | Yellow B | Phase 10 |

**Summary**: Among 758 unit test files, **~720 can be directly migrated** (Green), only storage/ (51 files), runtime/ (92 files), and cli/ (2 files) need adaptation (Yellow).

#### 5.10.3 tests/integration/ — 247 files / ~49,342 lines

Grouped by test category:

| Category | Files | Lines | Level | Migration Notes |
|----------|-------|-------|-------|----------------|
| **Security Boundaries** | 64 | 8,929 | Yellow B | Command injection/path traversal/SSRF/data leakage/sandbox escape/JWT algorithm downgrade/container boundaries etc. Coupled with sandbox implementation, need to verify new platform compatibility |
| **CLI Integration** | 32 | 8,998 | Yellow B | Integration tests for 78 CLI commands. Call `dist/` compiled scripts, need to adapt to new CLI paths |
| **Runtime Integration** | 53 | 9,498 | Yellow B | Dispatch/Lease/Worker/Recovery/rehearsal scenarios. Deeply coupled with SQLite storage and runtime lifecycle |
| **Contract Validation** | 5 | 1,459 | Green A | OpenAPI/event schema/Gateway adapter/Provider interfaces/Store facade contracts. **Validates interfaces not implementations, migrate directly** |
| **Data Integrity** | 3 | 1,227 | Yellow B | Approval-execution consistency/event column mapping/memory reference integrity. Depends on SQLite column-level validation |
| **Recovery** | 6 | 1,456 | Yellow B | Approval timeout recovery/schedule compensation/event replay/lease crash recovery/SQLite WAL recovery/writeback compensation. Contains SQLite-specific tests |
| **Concurrency** | 5 | 1,401 | Yellow B | Command concurrency limits/DB busy retry/scheduling race/event concurrency/lease contention. Partially SQLite-specific |
| **Reliability** | 6 | 1,423 | Green A | Degradation behavior/message queue/data lossless/audit/terminal state guarantee. **Validates invariants, migrate directly** |
| **Observability** | 6 | 2,011 | Green A | Approval cascade/health check/metrics/SLI-SLO/task panel/timeline diagnostics. Migrate directly |
| **Other 36 subdirectories** | 67 | ~12,940 | Green A / Yellow B | API(2)/approval(2)/cache(1)/compliance(1)/config(2)/cost(2)/deployment(1)/division(2)/evaluation(1)/events(2)/evolution(1)/gateway(1)/HR(1)/lifecycle(5 Yellow)/locking(1)/memory(1)/messages(2)/migration(3 Yellow)/ops(3 Yellow)/orchestration(1)/product(3)/provider(2)/queue(1)/resource(1)/results(2)/session(1)/smoke(5)/soak(2 Blue)/stability(1)/storage(5 Yellow)/tools(2)/types(2)/toolset(1)/workflow(2) |

**Summary**: Among 247 integration tests, **~150 can be directly migrated** (Green), **~90 need adaptation** (Yellow, mainly security/CLI/Runtime/Recovery/storage), **~7 for reference only** (Blue, soak tests).

#### 5.10.4 tests/golden/ — 8 files / ~1,662 lines

| File | Lines | Level | Migration Notes |
|------|-------|-------|----------------|
| `diagnostics-bundle.test.ts` | 160 | Green A | Diagnostics bundle structure snapshot |
| `openapi-document.test.ts` | 187 | Green A | OpenAPI document snapshot |
| `release-plan-output.test.ts` | 202 | Green A | Release plan Markdown snapshot |
| `session-summary.test.ts` | 148 | Green A | Session summary snapshot |
| `phase1a-golden-tasks.test.ts` | 30 | Green A | Phase1a golden tasks |
| `prompt-assembly.test.ts` | 220 | Green A | Prompt partitioning/cache key snapshots |
| `workflow-validation.test.ts` | 145 | Green A | Workflow validation snapshot |
| `cli-help-text.test.ts` | 238 | Yellow B | CLI help text snapshot. Need to adapt to new CLI command list |
| `snapshots/` (3 files) | 332 | Green A | Snapshot data files |

#### 5.10.5 tests/e2e/ — 10 files / ~2,807 lines

| File | Lines | Level | E2E Flow |
|------|-------|-------|----------|
| `task-lifecycle.test.ts` | 371 | Yellow B | Task full lifecycle: create→schedule→execute→complete. API/model/runtime all changing, need adaptation |
| `multi-step-workflow.test.ts` | 406 | Yellow B | Multi-step workflow: step dependency→output passing→complete. Workflow model extension affects assertions |
| `lease-recovery.test.ts` | 371 | Yellow B | Lease lifecycle: acquire→expire→recover→contention. Runtime split changes lease interface |
| `operator-takeover.test.ts` | 306 | Yellow B | Ops takeover: run→pause→manual control→resume. Section 60 emergency brake introduces new takeover path |
| `error-propagation.test.ts` | 298 | Yellow B | Error propagation: execution failure→terminal state→error code→retry. State machine extension affects terminal state determination |
| `oapeflir-full-loop.test.ts` | 248 | Yellow B | OAPEFLIR 8-stage full loop. Section 42 autonomy assessment adds new stage |
| `session-memory-flow.test.ts` | 237 | Yellow B | Session lifecycle + memory association. Section 50 knowledge domain isolation affects memory access |
| `gateway-webhook-flow.test.ts` | 230 | Yellow B | Webhook trigger→task create→lifecycle transition. Section 39 NL entry changes entry API |
| `streaming-response.test.ts` | 208 | Yellow B | Streaming response: session stream state + backpressure. Section 15.6 streaming error handling extension |
| `approval-event-flow.test.ts` | 132 | Yellow B | Approval event flow: block→Tier1 event→consumer acknowledgment. Section 47 organization approval routing changes |

**Downgrade Note**: v1.0 marked all 10 E2E tests as Green, re-reviewed and downgraded to Yellow. E2E tests run through entire API→model→runtime→storage chain, runtime split, API extensions, state machine changes, organization governance etc. will require test fixtures and assertions to adapt. Core test scenarios (lifecycle/workflow/recovery) reusable, but estimated modification 15%-30%.

#### 5.10.6 tests/performance/ — 6 files / ~874 lines

| File | Lines | P99 Target | Level |
|------|-------|------------|-------|
| `feedback-perf.test.ts` | 118 | <10ms | Green A |
| `handoff-perf.test.ts` | 167 | <5ms | Green A |
| `knowledge-perf.test.ts` | 127 | <100ms/<500ms | Green A |
| `oapeflir-perf.test.ts` | 150 | <30s | Green A |
| `planning-perf.test.ts` | 163 | <50ms | Green A |
| `plugin-perf.test.ts` | 149 | <200ms | Green A |
| `performance.bak/` (10 files) | 2,016 | — | Blue C |

**All 6 performance tests can be directly migrated** Green. 10 deprecated files under `.bak/` for reference only.

#### 5.10.7 tests/fixtures/ — 4 files / ~459 lines

| File | Lines | Level | Migration Notes |
|------|-------|-------|----------------|
| `migration/generate-snapshots.ts` | 134 | Yellow B | SQLite snapshot generation script, need to adapt to new migration version sequence |
| `migration/migration-fixtures.test.ts` | 235 | Yellow B | Migration ledger integrity test |
| `migration/snapshots/manifest.json` | 41 | Yellow B | Snapshot version manifest |
| `migration/README.md` | 49 | Green A | Usage instructions |

#### 5.10.8 Test Migration Summary

| Test Layer | Total Files | Total Lines | Green Direct | Yellow Adapted | Blue Reference |
|------------|-------------|--------------|--------------|----------------|----------------|
| helpers/ | 19 | 2,093 | 16 | 3 | 0 |
| unit/ | 758 | 169,943 | ~720 | ~38 | 0 |
| integration/ | 247 | 49,342 | ~150 | ~90 | ~7 |
| golden/ | 8+3 | 1,662 | 10 | 1 | 0 |
| e2e/ | 10 | 2,807 | 0 | 10 | 0 |
| performance/ | 6+10 | 2,890 | 6 | 0 | 10 |
| fixtures/ | 4 | 459 | 1 | 3 | 0 |
| **Total** | **1,069** | **~229,196** | **~903** | **~145** | **~17** |

#### 5.10.9 Test Phase Migration对照表

| Migration Phase | Source Module | Corresponding Test Directory | Test Files | Test Lines |
|-----------------|---------------|------------------------------|------------|------------|
| **P0 (First)** | — | `tests/helpers/` all | 19 | 2,093 |
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

## 6. Migration Execution Order

### 6.1 Ten-Phase Migration Roadmap

```
Phase │ Content                          │ Files │ Lines   │ Dependencies │ Est. Effort
──────┼───────────────────────────────────┼───────┼─────────┼──────────────┼─────────
  P0  │ Test Helpers (First)              │  19   │  ~2.1K  │ None         │ 0.5 person-days
      │ All tests/helpers/                │       │         │              │
──────┼───────────────────────────────────┼───────┼─────────┼──────────────┼─────────
  1   │ Shared Kernel + Tests            │  ~68  │ ~13.2K  │ P0           │ 1.5 person-days
      │ types/ + errors.ts +             │ src30 │  4.7K   │              │
      │ constants/ + utils/ +            │ test38│  8.5K   │              │
      │ results/ + lifecycle/            │       │         │              │
──────┼───────────────────────────────────┼───────┼─────────┼──────────────┼─────────
  2   │ Infra Foundation + Tests        │  ~325 │ ~71.5K  │ Phase 1      │ 7 person-days
      │ storage/ + events/ + config/    │ src145│ 29.5K   │              │
      │ + locking/ + queue/ + cache/     │ test180│ 42.0K  │              │
      │ + config/ directory + fixtures/ │       │         │              │
──────┼───────────────────────────────────┼───────┼─────────┼──────────────┼─────────
  3   │ Security & Governance + Tests   │  ~141 │ ~28.1K  │ Phase 2      │ 3.5 person-days
      │ security/ + approvals/ +        │  src26│  8.1K   │              │
      │ cost/ + compliance/ + hr/        │ test115│ 20.0K  │              │
──────┼───────────────────────────────────┼───────┼─────────┼──────────────┼─────────
  4   │ AI Ops Primitives + Tests        │  ~163 │ ~41.5K  │ Phase 2      │ 4.5 person-days
      │ providers/ + tools/ +           │  src63│ 19.5K   │              │
      │ workflow/ + artifacts/           │ test100│ 22.0K  │              │
──────┼───────────────────────────────────┼───────┼─────────┼──────────────┼─────────
  5   │ Runtime Core + Tests (Split)     │  ~264 │ ~72.3K  │ Phase 2-4    │ 10 person-days
      │ runtime/ → dispatch/lease/      │ src114│ 30.3K   │              │
      │ worker/ha/recovery/               │ test150│ 42.0K  │              │
──────┼───────────────────────────────────┼───────┼─────────┼──────────────┼─────────
  6   │ OAPEFLIR Pipeline + Tests       │  ~119 │ ~15.5K  │ Phase 4-5    │ 3.5 person-days
      │ agent-loop/ + planning/ +        │  src63│  4.1K   │              │
      │ feedback/ + learning/ +          │ test56 │ 11.4K  │              │
      │ evaluation/ + improvement/       │       │         │              │
──────┼───────────────────────────────────┼───────┼─────────┼──────────────┼─────────
  7   │ Interaction Layer + Tests        │  ~124 │ ~28.8K  │ Phase 5-6    │ 4 person-days
      │ memory/ + knowledge/ +          │  src54│ 10.8K   │              │
      │ messages/ + gateway/             │ test70 │ 18.0K  │              │
──────┼───────────────────────────────────┼───────┼─────────┼──────────────┼─────────
  8   │ Business Domain + Tests        │   ~78 │ ~13.5K  │ Phase 2,7    │ 2.5 person-days
      │ domain-registry/ + plugins/    │  src38│  5.8K   │              │
      │ + divisions/ directory          │ test40 │  7.7K   │              │
──────┼───────────────────────────────────┼───────┼─────────┼──────────────┼─────────
  9   │ Operational Maturity + Tests   │  ~271 │ ~72.6K  │ Phase 5      │ 7 person-days
      │ observability/ + ops/ +        │ src106│ 32.6K   │              │
      │ stability/ + evolution/ +        │ test165│ 40.0K  │              │
      │ reliability/ + product/           │       │         │              │
──────┼───────────────────────────────────┼───────┼─────────┼──────────────┼─────────
 10   │ CLI + E2E + Golden + Perf       │  ~146 │ ~23.6K  │ Phase 1-9    │ 4 person-days
      │ + Infra Files                  │  src78│  6.1K   │              │
      │ cli/ + e2e/ + golden/ +        │ test68 │ 17.5K  │              │
      │ performance/ + smoke/ +          │       │         │              │
      │ contract/ + deploy/ + CI         │       │         │              │
```

**Total**: ~1,868 files (source 799 + tests 1,069) / ~406K lines (source ~177K + tests ~229K) / **~70-100 person-days** (including storage/runtime split, adapter writing, E2E adaptation; excluding 24 new module development)

### 6.2 Documentation Migration Order

```
Batch │ Content                            │ Files │ Priority
──────┼─────────────────────────────────────┼───────┼─────────
 D1   │ Governance docs + Guide docs (Green direct) │ 8 │ P0
 D2   │ Contract docs 22 Green + 15 ADR Green      │ 37 │ P0
 D3   │ Operations manuals 5 Green + runbooks      │  ~8 │ P1
 D4   │ Main docs 5 Yellow + Technical analysis 2  │  7 │ P1
 D5   │ Contract docs 38 Yellow + ADR 8 Yellow     │ 46 │ P2
 D6   │ Review docs 3 Yellow                       │  3 │ P2
 D7   │ Research docs 28 Blue entire move           │ 28 │ P3
 D8   │ Reference/Archive cleanup tagging           │ 29 │ P4
```

---

## 7. Key Risks and Mitigations

### 7.1 High-Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| `runtime/` module too large (114 files / 30K lines) | Migration introduces regression, split destroys interfaces | Before Phase 5, write boundary integration tests first; after split, verify all stable-* rehearsals pass |
| `storage/` AuthoritativeTaskStore is god object | Almost all modules depend on it, modification affects entire system | First abstract Repository interface layer, then gradually migrate direct calls to Repository |
| Event namespace expansion (17→25) | Consumers not updated will miss events | New namespaces first register as Tier 3 (best-effort), upgrade to Tier 1 after confirming consumers ready |
| Capabilities needed by new platform but completely absent in old system | Section 39 NL entry/Section 40 goal decomposition/Section 41 proactive Agent/Section 46 organization hierarchy/Section 64 edge etc. need entirely new development | Migration and new capability development in parallel, migration establishes foundation first |

### 7.2 Capabilities Completely Absent in Old System, Needed for New Platform

| v2.7 Section | Capability | New Module Needed |
|--------------|------------|-------------------|
| Section 39 | Natural language task entry | `core/nl-entry/` — NL parser, intent classification, entity extraction, session management |
| Section 40 | Goal decomposition engine | `core/goal-decomposition/` — Goal graph, subgoal generation, DAG orchestration |
| Section 41 | Proactive Agent | `core/proactive-agent/` — Trigger engine, scheduled execution, event-driven wake-up |
| Section 42 | Progressive autonomy | `core/autonomy/` — Trust scoring, autonomy level state machine, promotion/demotion rules |
| Section 43 | Unified operations dashboard | `core/dashboard/` — Business view aggregation, multi-role dashboard |
| Section 44 | Non-technical user UX | `gateway/user-portal/` — Web UI gateway, drag-and-drop orchestration, wizards |
| Section 46 | Organization hierarchy model | `core/org-hierarchy/` — Organization tree, departments/teams, hierarchical inheritance |
| Section 47 | Organization hierarchy approval routing | Extend `core/approvals/` — Dynamic routing engine |
| Section 48 | SSO/SCIM integration | `core/sso-scim/` — SAML/OIDC SSO, SCIM user sync |
| Section 49 | Division compliance policy | Extend `core/compliance/` — Department-level policy engine |
| Section 50 | Knowledge domain isolation | Extend `core/knowledge/` — namespace isolation, controlled sharing |
| Section 52 | Multi-Region deployment | `core/multi-region/` — Region routing, data sync, failover |
| Section 53 | Resource competition management | `core/resource-scheduler/` — Priority queue, fair scheduling |
| Section 54 | SLA tiering guarantee | `core/sla/` — SLA tier definitions, guarantee policies |
| Section 59 | Agent explainability | `core/explainability/` — Decision tracking, causal chain |
| Section 60 | Emergency brake | `core/emergency-brake/` — Global brake, tiered brake |
| Section 61 | Unified lifecycle management | `core/agent-lifecycle/` — Create→activate→hibernate→retire |
| Section 64 | Edge/offline deployment | `core/edge-runtime/` — Offline cache, sync |
| Section 65 | Behavior drift detection | `core/drift-detection/` — Baseline comparison, alerting |
| Section 66 | Cost attribution optimization | Extend `core/cost/` — Multi-dimensional attribution, optimization suggestions |
| Section 67 | Visual debugging | `core/debug-ui/` — Execution visualization, breakpoints |
| Section 68 | Compliance report auto-generation | Extend `core/compliance/` — Report templates, auto-generation |
| Section 69 | Multimodal capability | `core/multimodal/` — Image/audio/video processing |
| Section 70 | Platform self-ops Agent | `core/self-ops-agent/` — Auto-inspection, auto-repair |

---

## 8. Core Object Migration Matrix

The old system defines ~84 domain entity types (`core/types/`), and the new platform v2.7 introduces many new entities and entity splits in organization governance (Section 46-51), intelligent interaction (Section 39-44), scaling operations (Section 52-57) etc. This section maps old→new entity evolution relationships.

### 8.1 Mapping Type Definitions

| Mapping Type | Symbol | Meaning |
|--------------|--------|---------|
| **1:1 Direct** | → | Field name/semantics unchanged, directly rename or retain |
| **1:1 Enriched** | →+ | Retain original fields, add new required fields |
| **1:N Split** | →⑴⑵… | One old entity split into multiple new entities |
| **N:1 Merge** | ⇒ | Multiple old entities merged into one new entity |
| **Semantic Redefinition** | ⇝ | Same name but fundamentally changed semantics/lifecycle |
| **New** | ★ | No corresponding entity in old system |
| **Retired** | ✕ | No longer needed |

### 8.2 Core Entity Mapping (Grouped by Domain)

#### Task and Execution Domain

| Old Entity | Mapping | New Entity | Risk | Notes |
|------------|---------|------------|------|-------|
| TaskRecord | →+ | task | Low | Added org_node_id, autonomy_level, sla_tier fields |
| ExecutionRecord | →⑴⑵⑶⑷⑸ | execution + execution_step + execution_artifact + execution_metric + execution_decision_log | High | Split from single row to 5 tables, needs data migration script |
| TransitionCommand | ⇝ | state_command + control_directive | High | Fundamental architectural change: commands no longer directly operate state machine, routing indirectly via control_directive |
| SessionRecord | →+ | session | Low | Added channel_type, nl_context fields (Section 39) |
| WorkflowRecord | →+ | workflow_definition | Low | Added goal_decomposition_tree reference (Section 40) |
| WorkflowStepRecord | →+ | workflow_step | Low | Added autonomy_gate, explainability_output fields |
| WorkflowStateRecord | →⑴⑵⑶⑷ | workflow_run + loop_cycle + checkpoint + hibernation_snapshot | High | Loop/checkpoint/hibernate separation |

#### Worker and Scheduling Domain

| Old Entity | Mapping | New Entity | Risk | Notes |
|------------|---------|------------|------|-------|
| WorkerRecord | →+ | worker | Low | Added region_id, capability_vector fields |
| LeaseRecord | →+ | lease | Low | Added sla_priority field |
| DispatchRecord | →+ | dispatch_assignment | Low | Added resource_quota, region_affinity fields (Section 52-53) |
| AgentExecutionRecord | →⑴⑵⑶⑷⑸ | agent_run + agent_step + tool_invocation + llm_call + agent_decision | High | Observability-driven fine-grained split |

#### Organization and Governance Domain

| Old Entity | Mapping | New Entity | Risk | Notes |
|------------|---------|------------|------|-------|
| ApprovalRecord | →⑴⑵⑶⑷ | decision_record + approval_route + approval_sla + decision_comment | High | Organization-aware approval (Section 47), routing rules changed from hardcoded to dynamic |
| OrganizationRecord + TenantRecord | ⇒ | org_node (hierarchical tree) | High | N:1 merge into recursive organization tree (Section 46), tenant becomes top-level org_node |
| HrRoleRecord | →+ | role_assignment | Medium | Added delegation_scope, escalation_chain (Section 51) |
| ComplianceRecord | →+ | compliance_policy | Medium | Added department_scope, geo_region (Section 49, Section 52) |

#### Security Domain

| Old Entity | Mapping | New Entity | Risk | Notes |
|------------|---------|------------|------|-------|
| SandboxPolicy | →+ | sandbox_policy | Low | Added department_override field (Section 49) |
| SecretRecord | → | secret_entry | Low | 1:1 direct |
| AuditRecord | →+ | audit_event | Low | Added compliance_tag, retention_policy fields |

#### Memory and Knowledge Domain

| Old Entity | Mapping | New Entity | Risk | Notes |
|------------|---------|------------|------|-------|
| MemoryRecord | →⑴⑵ | memory_entry + knowledge_document/chunk | High | Need content classifier to distinguish episodic memory and knowledge artifact |
| KnowledgeDocument | →+ | knowledge_document | Medium | Added namespace_id (Section 50 domain isolation), modality field (Section 69) |
| EmbeddingRecord | → | embedding_vector | Low | 1:1 direct |

#### AI Operations Domain

| Old Entity | Mapping | New Entity | Risk | Notes |
|------------|---------|------------|------|-------|
| ProviderConfig | →+ | provider_config | Low | Added streaming_error_policy (Section 15.6) |
| ToolDefinition | →+ | tool_definition | Low | Added modality_support, domain_binding fields |
| PluginManifest | →+ | pack_manifest | Low | Renamed + added marketplace_metadata (Section 55) |
| ArtifactRecord | →+ | artifact | Medium | Added evidence_chain, compliance_tag, modality fields |
| FeedbackSignal | →+ | feedback_signal | Low | Added signal_source_type enum extension |
| EvalResult | ⇝ | eval_result | Medium | Evaluation framework changed from post-hoc to inline (Section 17) |

#### Operational Maturity Domain

| Old Entity | Mapping | New Entity | Risk | Notes |
|------------|---------|------------|------|-------|
| SloDefinition | →+ | slo_definition | Low | Added region_scope field |
| AlertRule | → | alert_rule | Low | 1:1 direct |
| ReleaseRecord | →+ | release | Low | Added canary_config, rollback_policy extensions |
| StabilityScenario | → | rehearsal_scenario | Low | Renamed, semantics unchanged |
| EvolutionProposal | →+ | evolution_proposal | Medium | Added drift_baseline, behavior_fingerprint (Section 65) |

### 8.3 New Entity List (No Old System Equivalent — ★)

| New Entity | v2.7 Section | Domain |
|------------|--------------|--------|
| org_node | Section 46 | Organization Governance |
| delegation_scope | Section 51 | Organization Governance |
| sso_identity | Section 48 | Organization Governance |
| scim_sync_log | Section 48 | Organization Governance |
| nl_intent | Section 39 | Intelligent Interaction |
| goal_tree | Section 40 | Intelligent Interaction |
| proactive_trigger | Section 41 | Intelligent Interaction |
| autonomy_level | Section 42 | Intelligent Interaction |
| trust_score | Section 42 | Intelligent Interaction |
| dashboard_view | Section 43 | Intelligent Interaction |
| user_portal_session | Section 44 | Intelligent Interaction |
| region_config | Section 52 | Scaling Operations |
| resource_quota | Section 53 | Scaling Operations |
| sla_tier | Section 54 | Scaling Operations |
| marketplace_listing | Section 55 | Scaling Operations |
| integration_connector | Section 57 | Scaling Operations |
| explainability_trace | Section 59 | Operational Maturity |
| emergency_brake_event | Section 60 | Operational Maturity |
| agent_lifecycle_state | Section 61 | Operational Maturity |
| edge_deployment | Section 64 | Operational Maturity |
| drift_baseline | Section 65 | Operational Maturity |
| cost_attribution | Section 66 | Operational Maturity |
| debug_session | Section 67 | Operational Maturity |
| compliance_report | Section 68 | Operational Maturity |
| multimodal_asset | Section 69 | Operational Maturity |
| self_ops_task | Section 70 | Operational Maturity |

### 8.4 Migration Statistics

| Mapping Type | Entity Count | Percentage |
|--------------|--------------|------------|
| 1:1 Direct (→) | ~12 | 14% |
| 1:1 Enriched (→+) | ~22 | 26% |
| 1:N Split (→⑴⑵…) | ~5 | 6% |
| N:1 Merge (⇒) | ~2 | 2% |
| Semantic Redefinition (⇝) | ~3 | 4% |
| New (★) | ~26 | 31% |
| Retired (✕) | ~14 | 17% |
| **Total** | **~84** | 100% |

### 8.5 Data Migration Strategy

The object migration matrix defines "what changes to what", this section defines "how to change". According to risk level and data volume, three migration modes are adopted:

#### Migration Mode Definitions

| Mode | Applicable Scenario | Execution Method | Downtime Requirement |
|------|---------------------|------------------|---------------------|
| **One-time Offline Migration** | Low risk, 1:1 direct/enriched mapping | Write migration script, execute once during maintenance window | Short downtime (minute-level) |
| **Dual-Write Transition** | High-risk entity split/merge, business cannot interrupt | Write to both old + new tables simultaneously during write, gradually switch reads to new table, deprecate old table after verifying consistency | Zero downtime |
| **Lazy Migration** | Long-tail low-frequency entities, full migration cost unjustifiable | Check version on access, upgrade to new format on-demand | Zero downtime |

#### Entity Migration Mode Assignment

| Entity | Mapping Type | Migration Mode | Phase | Notes |
|--------|-------------|----------------|-------|-------|
| TaskRecord | →+ | One-time offline | P2 | New fields can have default values, ALTER TABLE + backfill |
| SessionRecord | →+ | One-time offline | P2 | Same as above |
| WorkerRecord | →+ | One-time offline | P2 | Same as above |
| LeaseRecord | →+ | One-time offline | P2 | Same as above |
| ProviderConfig | →+ | One-time offline | P4 | Same as above |
| SecretRecord | → | One-time offline | P3 | 1:1 rename |
| SloDefinition | →+ | One-time offline | P9 | Same as above |
| **ExecutionRecord** | →⑴⑵⑶⑷⑸ | **Dual-write transition** | P2→P5 | 1:5 split, need P2 create new tables start dual-write, P5 verify consistency then switch reads |
| **WorkflowStateRecord** | →⑴⑵⑶⑷ | **Dual-write transition** | P2→P6 | 1:4 split, loop/checkpoint/hibernate separation, switch reads after OAPEFLIR complete |
| **ApprovalRecord** | →⑴⑵⑶⑷ | **Dual-write transition** | P3→P5 | 1:4 split, organization approval routing changes, switch reads after Runtime complete |
| **AgentExecutionRecord** | →⑴⑵⑶⑷⑸ | **Dual-write transition** | P5 | 1:5 split, observability-driven |
| **MemoryRecord** | →⑴⑵ | **Dual-write transition** | P7 | Need content classifier to distinguish episodic memory and knowledge artifact |
| **OrganizationRecord + TenantRecord** | ⇒ | **Dual-write transition** | P3 | N:1 merge into org_node hierarchical tree, read/write path fundamentally changes |
| **TransitionCommand** | ⇝ | **Dual-write transition** | P5 | Semantic redefinition, command routing fundamentally changes |
| EvalResult | ⇝ | Lazy migration | P6 | Evaluation record access frequency low, upgrade on access |
| EvolutionProposal | →+ | Lazy migration | P9 | Historical proposal access upgrade on-demand |
| KnowledgeDocument | →+ | Lazy migration | P7 | Existing document access supplement namespace_id on access |

#### Dual-Write Transition Execution Process

```
Phase 1: Create new tables       → CREATE TABLE new_xxx (new schema)
Phase 2: Enable dual-write       → Write to both old_xxx + new_xxx simultaneously
Phase 3: Shadow reads           → Read from both tables simultaneously, compare results, record differences
Phase 4: Switch primary read     → Switch primary read to new_xxx, old_xxx becomes backup read
Phase 5: Verification period    → Run ≥1 complete Phase cycle, confirm zero differences
Phase 6: Deprecate old table    → DROP TABLE old_xxx
```

Each dual-write object must have an assigned owner, and "dual-write consistency verification passed" must be included in Phase exit conditions.

---

## 9. High-Risk Special: storage / AuthoritativeTaskStore Split

### 9.1 Current Status Analysis

`AuthoritativeTaskStore` (`src/core/storage/authoritative-task-store.ts`) is the global data access facade of the current system:

| Metric | Value |
|--------|-------|
| Public method count | ~278 domain methods + 27 structural properties = ~305 public surface |
| Underlying Repository count | 21 (task, workflow, execution, session, event, worker, approval, billing, lease, lock, memory, artifact, dispatch, division, secret, marketplace, release, organization, intelligence, evolution, operations) |
| Consumer file count | ~123 source files directly dependent (~200+ with tests) |
| Lines of code | 101 files / 26,102 lines in directory |

**Core Problem**: god object anti-pattern — single class takes on data access responsibilities for 21 domains, causing any storage layer change to affect the entire system.

### 9.2 Split Target Modules (7 Bounded Contexts)

| # | Bounded Context | Methods | Contains Repository | Split Strategy |
|---|-----------------|---------|---------------------|----------------|
| 1 | **Core Task Engine** | ~73 | task, workflow, execution, session | Retain as core — high coupling between methods, not suitable for further splitting |
| 2 | **Worker Infrastructure** | ~47 | worker, dispatch, lease, lock | Extract — scheduling/lease/worker lifecycle are independent domains |
| 3 | **Event Infrastructure** | ~24 | event | Extract — event bus already has clear boundaries |
| 4 | **Billing & Cost** | ~29 | billing | Extract — billing logic decoupled from core execution |
| 5 | **Governance & Compliance** | ~50 | approval, organization, secret, compliance, operations | Extract — organization governance is independent domain (aligns with v2.7 Layer 5) |
| 6 | **Platform & Commerce** | ~47 | marketplace, release, division, intelligence, evolution | Extract — platform operations is independent domain (aligns with v2.7 Layer 6-7) |
| 7 | **Memory & Artifacts** | ~10 | memory, artifact | Extract — knowledge/memory is independent domain (aligns with v2.7 Layer 4) |

### 9.3 Split Execution Plan

**Prerequisite**: AuthoritativeTaskStore internally implements via named Repository delegation, split infrastructure already in place, only need to migrate consumers.

| Step | Action | Est. Effort | Risk |
|------|--------|-------------|------|
| S1 | Define TypeScript interfaces (Repository contracts) for 7 bounded contexts | 2 person-days | Low |
| S2 | Implement facade adapter — AuthoritativeTaskStore temporarily delegates to new interface, maintain backward compatibility | 3 person-days | Low |
| S3 | Migrate consumers module by module: replace `store.xxx()` calls with corresponding Repository interface injection | 8 person-days | Medium — each consumer needs verification |
| S4 | Remove AuthoritativeTaskStore facade, each bounded context independently registers to ServiceRegistry | 2 person-days | Medium |
| S5 | Update all unit test/integration test store mocks | 3 person-days | Medium |
| S6 | Run full regression + stable-* rehearsal verification | 2 person-days | Low |
| **Total** | | **~20 person-days** | |

### 9.4 Migration Order Suggestions

```
Wave 1 (Low-risk extraction): Event Infrastructure → Memory & Artifacts
  ↓ Verification: all event-related tests pass
Wave 2 (Medium-risk extraction): Billing & Cost → Worker Infrastructure
  ↓ Verification: all dispatch/lease-related tests pass
Wave 3 (High-risk extraction): Governance & Compliance → Platform & Commerce
  ↓ Verification: all organization/approval/marketplace-related tests pass
Wave 4 (Wrap-up): Remove facade, Core Task Engine becomes independent module
  ↓ Verification: npm test full pass + stable-* rehearsals pass
```

---

## 10. High-Risk Special: runtime/ Bounded Context Split

### 10.1 Current Status Analysis

`src/core/runtime/` is the system's largest module:

| Metric | Value |
|--------|-------|
| File count | 101 .ts files |
| Lines of code | 30,348 lines |
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
| BC11 | Infrastructure | 13 | 2,498 | 0 | Yes — utilities |
| BC12 | HITL & Governance | 2 | 1,166 | 0 | **Yes — zero internal dependencies** |

### 10.3 Extraction Wave Plan

| Wave | Extraction Target | Lines | Percentage | Risk | Verification |
|------|------------------|-------|------------|------|--------------|
| **Wave 1** (Zero risk) | BC3 Worker + BC5 HA + BC6 Hot Upgrade + BC8 State Transition | 6,136 | 20% | Low — zero internal dependencies | Each BC unit tests independently pass |
| **Wave 2** (Low risk) | BC2 Lease + BC9 Agent Execution + BC12 HITL + BC11 Infrastructure | 6,461 | 21% | Low — <=1 dependency | lease/agent integration tests pass |
| **Wave 3** (Medium risk) | BC4 Handshake/Writeback + BC7 Recovery | 5,678 | 19% | Medium — multiple dependencies | recovery rehearsal scenarios pass |
| **Wave 4** (Wrap-up) | BC1 Dispatch + BC10 Orchestration stay as runtime/ core | 5,171 | 17% | Low — reorganization only | npm test full pass |

### 10.4 Estimated Effort

| Action | Effort |
|--------|--------|
| BC interface definitions (12) | 3 person-days |
| Wave 1 extraction + tests | 4 person-days |
| Wave 2 extraction + tests | 5 person-days |
| Wave 3 extraction + tests | 5 person-days |
| Wave 4 wrap-up + full regression | 3 person-days |
| **Total** | **~20 person-days** |

### 10.5 Alignment with New Architecture

| Post-Extraction Module | v2.7 Target Section | New Capabilities |
|----------------------|---------------------|-----------------|
| Worker Management | Section 53 Resource Competition | Fair scheduling, priority queue |
| HA Coordinator | Section 31 Disaster Recovery | Multi-Region leader election (Section 52) |
| State Transition | Section 9 State Machine | Extended state set (hibernation/delegation) |
| Agent Execution | Section 13 OAPEFLIR | Section 42 autonomy assessment stage |
| HITL & Governance | Section 21 HITL | Section 47 organization approval routing |
| Lease Management | Section 31 Lease | Section 54 SLA tier lease priority |

---

## 11. New Module Priority and Dependency Graph

### 11.1 Priority Classification

24 modules completely absent in old system, needed entirely new for new platform, classified by business blocking relationship into P0/P1/P2:

| Priority | Meaning | Count |
|----------|---------|-------|
| **P0 — Foundation Capability** | Without it, new platform cannot be distinguished from old system, blocks upper modules | 6 |
| **P1 — Core Differentiation** | Key new platform capability, but does not block P0 module migration | 10 |
| **P2 — Operational Enhancement** | Nice-to-have, deliverable gradually after platform stabilizes | 8 |

### 11.2 P0 Foundation Capabilities (6)

| Module | v2.7 Section | Dependencies | Notes |
|--------|--------------|--------------|-------|
| `core/org-hierarchy/` | Section 46 | None | Organization hierarchy model is foundation for Section 47-51, develop first |
| `core/nl-entry/` | Section 39 | None | Natural language entry is new platform's core interaction mode |
| `core/goal-decomposition/` | Section 40 | nl-entry | Goal decomposition engine depends on NL intent parsing |
| `core/autonomy/` | Section 42 | org-hierarchy | Autonomy model depends on organization trust chain |
| `core/sso-scim/` | Section 48 | org-hierarchy | SSO/SCIM depends on organization model |
| `core/emergency-brake/` | Section 60 | None | Emergency brake is security foundation, can develop independently |

### 11.3 P1 Core Differentiation (10)

| Module | v2.7 Section | Dependencies | Notes |
|--------|--------------|--------------|-------|
| `core/proactive-agent/` | Section 41 | autonomy, nl-entry | Proactive Agent needs autonomy and NL capabilities |
| `core/agent-lifecycle/` | Section 61 | autonomy | Unified lifecycle depends on autonomy level |
| `core/explainability/` | Section 59 | agent-lifecycle | Explainability depends on lifecycle events |
| `core/multi-region/` | Section 52 | org-hierarchy | Multi-Region depends on organization topology |
| `core/resource-scheduler/` | Section 53 | multi-region | Resource scheduling depends on Region config |
| `core/sla/` | Section 54 | org-hierarchy, resource-scheduler | SLA depends on organization + resources |
| `core/drift-detection/` | Section 65 | agent-lifecycle | Drift detection depends on behavior baseline |
| `core/dashboard/` | Section 43 | org-hierarchy | Dashboard depends on organization view |
| Extend `core/approvals/` | Section 47 | org-hierarchy | Organization approval routing |
| Extend `core/compliance/` | Section 49 | org-hierarchy | Division compliance |

### 11.4 P2 Operational Enhancement (8)

| Module | v2.7 Section | Dependencies | Notes |
|--------|--------------|--------------|-------|
| `gateway/user-portal/` | Section 44 | nl-entry, dashboard | Non-technical user UX |
| `core/marketplace/` | Section 55 | agent-lifecycle | Marketplace ecosystem |
| `core/edge-runtime/` | Section 64 | multi-region | Edge/offline deployment |
| `core/cost-attribution/` | Section 66 | sla, org-hierarchy | Cost attribution optimization |
| `core/debug-ui/` | Section 67 | explainability | Visual debugging |
| `core/compliance-report/` | Section 68 | compliance | Compliance report auto-generation |
| `core/multimodal/` | Section 69 | None | Multimodal capability |
| `core/self-ops-agent/` | Section 70 | agent-lifecycle, drift-detection | Platform self-ops |

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

### 12.1 Migration Principles

1. **Migrate Green direct items first**: Zero modification cost, quickly establish new platform code foundation
2. **Migrate in dependency order**: Shared Kernel → Infrastructure → Security → AI Ops → Runtime → OAPEFLIR → Interaction → Domain → Maturity → CLI
3. **Run corresponding tests after each Phase migration completes**: Ensure no regression introduced
4. **Migrate documentation with code**: Each code Phase's corresponding contracts/ADR migrate simultaneously
5. **New capability development and migration in parallel**: Migration team and new feature team can work simultaneously

### 12.2 Dual-Track Migration Strategy

"Parallel migration and new capability development" requires clear lane division and intersection rules, otherwise easy to block each other.

#### Lane A: Migration Lane

| Responsibility | Content |
|----------------|---------|
| P0-P10 code migration | Execute per Section 6 ten-phase roadmap |
| storage split | Section 9 AuthoritativeTaskStore 4-wave split |
| runtime split | Section 10 runtime 4-wave split |
| Test regression | Each Phase exit gate (Section 13) |
| Contract/documentation migration | Synchronize with code Phase |
| Data migration scripts | Dual-write/offline migration for high-risk entities in Section 8 |

#### Lane B: New Capability Lane

| Responsibility | Content |
|----------------|---------|
| P0 Foundation | org-hierarchy / nl-entry / goal-decomposition / autonomy / sso-scim / emergency-brake |
| P1 Differentiation | proactive-agent / agent-lifecycle / explainability / multi-region / resource-scheduler / sla / drift-detection / dashboard / approval routing extension / division compliance extension |
| P2 Enhancement | user-portal / marketplace / edge-runtime / cost-attribution / debug-ui / compliance-report / multimodal / self-ops-agent |

#### Intersection Points and Dependency Rules

| Intersection | Migration Lane Prerequisites | New Capability Lane Action | Strategy |
|--------------|------------------------------|----------------------------|----------|
| **org-hierarchy integration** | P3 Security complete (hr/approvals migrated) | org-hierarchy module connects to migrated hr/approvals via adapter | New capability lane can first develop with **stub interface**, replace with real implementation after P3 complete |
| **autonomy integration** | P5 Runtime complete (state machine migrated) | autonomy module connects to state-transition BC | New capability lane first defines StateTransition interface stub, integrate after P5 Wave 1 complete |
| **nl-entry integration** | P4 AI Ops complete (providers migrated) | nl-entry uses migrated LLM provider | New capability lane can first develop with mock provider, switch after P4 complete |
| **agent-lifecycle integration** | P6 OAPEFLIR complete | agent-lifecycle extends OAPEFLIR cycle | Must wait P6 complete, cannot stub |
| **multi-region integration** | P5 Runtime complete (HA/dispatch extracted) | multi-region extends extracted HA Coordinator | Must wait P5 Wave 1 complete |
| **Knowledge domain isolation** | P7 Interaction complete (knowledge migrated) | Section 50 knowledge domain isolation extends knowledge module | Must wait P7 complete |

#### Stub Strategy

Modules that can be stubbed first then integrated (new capability lane can start early):
- `org-hierarchy` — stub `OrgNodeRepository` interface, return single-layer organization
- `autonomy` — stub `AutonomyGate`, return LEVEL_1 by default (minimum autonomy)
- `nl-entry` — stub `IntentClassifier`, pass through raw text
- `emergency-brake` — stub `BrakeService`, do not brake by default

Modules that must wait migration complete before integration (hard dependencies):
- `agent-lifecycle` — depends on complete OAPEFLIR cycle (P6)
- `multi-region` — depends on real HA Coordinator (P5)
- `drift-detection` — depends on real behavior baseline data (P9)
- `self-ops-agent` — depends on complete platform capabilities (after P10)

### 12.3 Migration Checklist

Each module migration must complete:

- [ ] Copy source files to new project corresponding directory
- [ ] Update import paths (if path changes after seven-layer directory reorganization)
- [ ] Synchronously copy `tests/unit/<module>/` and `tests/unit/core/<module>/` to new project
- [ ] Synchronously copy `tests/integration/<module>/` to new project
- [ ] Run that module's unit tests, confirm all pass
- [ ] Run related integration tests, confirm all pass
- [ ] If golden test involves that module, update snapshots and verify
- [ ] If e2e test involves that module, verify end-to-end flow passes
- [ ] If performance test involves that module, verify performance baseline meets standard
- [ ] Update module's contract document references (§ numbers)
- [ ] Register in new platform's module-inventory
- [ ] Confirm zero TypeScript compilation errors
- [ ] Run `npm run test:unit` full regression

### 12.4 Non-Migration List

The following are **explicitly not migrated**, archived only:

| Content | Reason |
|---------|--------|
| All `docs_zh/archive/` | Historical archive |
| 9 ⚪ D files in `docs_zh/reference/` | Superseded by v2.7 |
| `docs_zh/automatic_agent_platform/agent_platform.md` (92K lines) | Unexpurged old version, superseded by v2.7 (6.7K lines) |
| Intermediate translation fragment files in `docs_zh/automatic_agent_platform/` | Translation intermediate products chunk_b-j, part1-6 |
| 6 ⚪ D files in `docs_zh/reviews/` | Old reviews |
| 10 ⚪ D contracts in `docs_zh/contracts/` | Early v1.x contracts |

---

## 13. Phase Entry and Exit Criteria

Each migration Phase must meet clear Definition of Ready and Definition of Done; cannot proceed to next Phase without meeting criteria.

| Phase | Entry Criteria | Exit Criteria (Definition of Done) |
|-------|----------------|------------------------------------|
| **P0 Test Helpers** | New project repo initialized, tsconfig/eslint/package.json in place | All 19 helper files pass `tsc --noEmit`; `createTempWorkspace()` available in new project |
| **P1 Shared Kernel** | P0 exit criteria met | types/errors/constants/utils/results/lifecycle all compile; 38 unit tests all green; zero external runtime dependencies |
| **P2 Infra Foundation** | P1 exit criteria met | storage/events/config/locking/queue/cache compile; 180 unit tests + related integration tests all green; SQLite migration ledger integrity verification passed; `npm run test:unit` full regression green |
| **P3 Security** | P2 exit criteria met | security/approvals/cost/compliance/hr compile; 115 tests green; 64 security boundary integration tests all pass (including sandbox escape/path traversal/SSRF rejection paths) |
| **P4 AI Ops** | P2 exit criteria met | providers/tools/workflow/artifacts compile; 100 tests green; Provider CircuitBreaker integration tests pass |
| **P5 Runtime** | P2+P3+P4 exit criteria met | runtime 12 BCs extracted by wave; 150 tests green; stable-* rehearsal scenarios all pass; dispatch/lease/recovery integration tests pass |
| **P6 OAPEFLIR** | P4+P5 exit criteria met | agent-loop/planning/feedback/learning/evaluation/improvement compile; 56 tests green; OAPEFLIR 8-stage full loop E2E pass |
| **P7 Interaction** | P5+P6 exit criteria met | memory/knowledge/messages/gateway compile; 70 tests green; session→memory→retrieval end-to-end pass |
| **P8 Business Domain** | P2+P7 exit criteria met | domain-registry/divisions/plugins compile; 40 tests green; at least 1 division end-to-end load success |
| **P9 Maturity** | P5 exit criteria met | observability/ops/stability/evolution/reliability/product/deployment compile; 165 tests green; health check + SLO alerting integration tests pass |
| **P10 CLI + E2E** | P1-P9 all exit criteria met | CLI 78 entries compile; 10 E2E tests green; 8 golden test snapshots match; 6 performance tests meet standard; `npm test` full regression green; `npm run build` generates dist/ successfully |

### 13.1 Module-Level Deliverable Acceptance Template

Phase DoD defines phase-level gate, but each **module** after migration completes must deliver the following 5 items; incomplete items cannot be marked "Complete":

| Deliverable | Content | Acceptance Criteria |
|-------------|---------|---------------------|
| **Code** | Migrated source code, placed in new project target directory | `tsc --noEmit` zero errors; import paths updated; no references to old project paths |
| **Contract** | interface/schema/contract documents updated | New adapter interfaces have JSDoc; if DB schema change involved, migration files created |
| **Tests** | unit + integration + (if applicable) e2e regression | All tests for that module green; new adapters have corresponding unit tests |
| **Documentation** | module-inventory registration + contract references (§ numbers) updated | Module name/file count/lines/owner registered in new platform module-inventory.md |
| **Migration Notes** | Compatibility/breaking changes record | Record: (1) Interface change list (2) Deprecated APIs (3) New dependencies (4) Config item changes |

**Template Example** (using `core/events/` as example):

```
Module: core/events/
Phase: P2
Deliverable Check:
  [x] Code: 8 files migrated to new-project/src/core/events/, tsc passes
  [x] Contract: New 8 event namespace interfaces added (delegation.*/hibernation.*/...)
  [x] Tests: 10 unit tests + 2 integration tests all green
  [x] Documentation: module-inventory registered, contract references updated to v2.7 Section 28
  [x] Migration Notes: Breaking change — EventBus.emit() signature added namespace parameter
```

### 13.2 Regression Gate

Each Phase exit must run:
1. `tsc --noEmit` — zero compilation errors
2. `npm run test:unit` — full unit tests green
3. That Phase's `npm run test:integration` subset green
4. `npm run build` — dist/ can be generated

### 13.3 Blocking Upgrade Rules

- When any Phase exit criteria unmet, that Phase marked as **BLOCKED**
- BLOCKED Phase's downstream Phases cannot start
- After fix, need to re-run complete exit verification

---

## 14. Migration Freeze Line

During migration, the following tech stack **frozen unchanged**, to avoid introducing additional uncertainty:

| Freeze Item | Current Version/Selection | Freeze Reason |
|-------------|---------------------------|---------------|
| **Test Framework** | Node.js 22 built-in `node:test` + `assert/strict` | 1,069 test files depend on it, switching framework equals rewrite |
| **Module System** | TypeScript ESM (`.js` extension imports) | Full ESM, switching CJS affects all imports |
| **Database Backend** | SQLite (Phase 1-2) + PostgreSQL (optional) | storage layer 101 files + all test fixtures based on SQLite |
| **CLI Framework** | Direct `process.argv` parsing + 78 thin scripts | CLI is thin wrapper of service, changing framework has no benefit |
| **Observability Stack** | OpenTelemetry + Prometheus + StructuredLogger | 36 observability files + SLO alerting depend on it |
| **Config Validation** | Zod schema | 27 config files + 8-layer config governance depend on it |
| **Package Manager** | npm | CI workflow + scripts depend on it |

### 14.1 Freeze Line Change Process

If freeze item change is truly needed:
1. Submit ADR explaining change reason and impact scope
2. Assess affected file count and test count
3. Obtain architecture owner approval
4. Change must complete in independent branch, not cross with migration work

---

## 15. Effort Estimation and Assumptions

### 15.1 Effort Breakdown

| Work Item | Person-days | Notes |
|-----------|--------------|-------|
| P0-P1 File move + compilation fix | 2 | Zero-modification modules |
| P2 Infra (including storage split Section 9) | 27 | storage split 20 person-days + remaining infra 7 person-days |
| P3 Security | 4 | Security test verification as main |
| P4 AI Ops | 5 | providers/tools adapter writing |
| P5 Runtime (including runtime split Section 10) | 30 | runtime split 20 person-days + integration verification 10 person-days |
| P6-P8 OAPEFLIR + Interaction + Domain | 10 | Mainly adaptation work |
| P9 Maturity | 7 | observability/ops/stability |
| P10 CLI + E2E + Full regression | 8 | E2E adaptation + golden update + performance verification |
| Buffer (20%) | 7 | Unforeseen compatibility issues |
| **Migration Total** | **~100 person-days** | |

### 15.2 Assumption Conditions

1. 1 person-day = 8 hours effective development time
2. Team has TypeScript ESM + Node.js 22 experience
3. storage/runtime split can each have 1 dedicated person
4. Migration and 24 new module development **in parallel**, new module development effort not included in this estimate
5. Excluding environment setup, CI configuration, code review and other management overhead
6. v1.0's 48 person-days was pure file migration scope (copy+import fix), not including god object split, adapter writing, E2E test adaptation

---

## Appendix A: Migration Quantification Statistics

| Metric | Value |
|--------|-------|
| **Source Code** | |
| Total source file count | 799 |
| Total source lines | ~174,585 |
| Green direct migration code modules | 18 (~27K lines) |
| Yellow adapted migration code modules | 25 (~147K lines) |
| Blue reference-only code modules | 3 (~8.9K lines) |
| **Tests** | |
| Total test files | 1,069 |
| Total test lines | ~229,196 |
| Green direct migration tests | ~903 files (~192K lines) |
| Yellow adapted migration tests | ~145 files (~34K lines) — storage/runtime/CLI/security/recovery/e2e |
| Blue reference-only tests | ~17 files (~3K lines) — soak tests + performance.bak |
| Test infrastructure (helpers) | 19 files / 2,093 lines — 16 Green + 3 Yellow |
| **Documentation** | |
| Total documentation files | ~243 |
| Green direct migration documentation | ~48 files |
| Yellow adapted migration documentation | ~74 files |
| Blue reference documentation | ~84 files |
| White archive/retire documentation | ~37 files |
| **Other Assets** | |
| config/ directory | 27 JSON files — all direct migration |
| divisions/ directory | 11 division definitions — Yellow adapted (need DomainDescriptor semantic model adaptation) |
| **New Development** | |
| Modules requiring entirely new development for new platform | 24 (v2.7 Section 39-70 absent from old system) |
| **Total** | |
| Total migration files | ~1,868 (source 799 + tests 1,069) |
| Total migration lines | ~406K (source ~177K + tests ~229K) |
| Estimated total migration effort | **~70-100 person-days** (including tests, storage/runtime split adaptation, adapter writing; excluding 24 new function module development. v1.0's 48 person-days was only file migration scope, not including god object split, interface adaptation, E2E test adaptation) |
