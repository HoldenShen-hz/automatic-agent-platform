# Legacy System to New Platform: Porting Assessment Document

> **Document Version**: v1.1
> **Document Status**: Draft
> **Assessment Scope**: `doc/` (excluding `doc/automatic_agent_platform/`) + `src/` + `config/` + `divisions/` + `tests/`
> **Target System**: "Enterprise Agent Platform Overall Technical Architecture Design Document" v2.7 (§1-§70, Seven-Layer Architecture)
> **Assessment Date**: 2026-04-19

---

## 1. Assessment Purpose

The legacy system (automatic-agent-system-main) contains **797 source files / 174,585 lines of code** and **200+ documentation files**. The new platform architecture design document v2.7 defines a seven-layer enterprise architecture. This document answers:

1. **Which doc files** can be directly ported, transformed for porting, or archived?
2. **Which code modules** can be directly ported, transformed for porting, or require rewriting?
3. **What is the porting priority and recommended execution order?**

---

## 2. Assessment Methodology

### 2.1 Porting Level Definitions

| Level | Tag | Meaning | Typical Modification Scope |
|-------|-----|---------|---------------------------|
| **A1 — Direct Port** | Green | Zero modification, copy and use. Interfaces, naming, and dependencies are all compatible with the new architecture | 0 — copy only + import path update |
| **A2 — Core Reuse With Adapter** | GreenWrench | Core implementation unchanged, need adapter/wrapper to align with new architecture extension points | ≤15% — add adapter layer or supplement missing interfaces |
| **B — Transform and Port** | Yellow | Core logic can be reused, but requires adaptation to new architecture interfaces/naming/layers | 15%-50% — interface refactoring + dependency replacement |
| **C — Reference Value** | Blue | Not ported directly, but design approach/test cases/competitive analysis have reference value | N/A — reference only, do not move code |
| **D — Archive and Retire** | White | Outdated or replaced by new design, for historical archiving only | N/A — archive |

### 2.2 Five-Dimension Judgment Template

For each module/document's level determination, provide five-dimensional assessment evidence:

| Dimension | Meaning | Scoring Standard |
|-----------|---------|------------------|
| **Architecture Fit** | Compatibility of interfaces/layers with v2.7 target architecture | High=direct interface alignment / Medium=needs adapter / Low=interfaces need rewriting |
| **Dependency Pollution** | Coupling to external modules, affects independent porting capability | Low=≤2 direct dependencies / Medium=3-5 / High=≥6 or circular dependencies |
| **Interface Stability** | Expected change to public API during migration | High=unchanged / Medium=compatible extension / Low=breaking changes |
| **Test Coverage** | Existing tests' coverage of core behavior | High=full behavior coverage / Medium=main path coverage / Low=insufficient coverage |
| **Modification Scope** | Proportion of code in module that needs changes | Small=≤15% / Medium=15%-50% / Large=≥50% |

**Judgment Rules**:

- **A1**: All five dimensions are "High/Low/High/High/Small"
- **A2**: Architecture fit ≥ Medium, modification scope ≤15%, but needs new adapter/wrapper
- **B**: Core reusable but at least one dimension is "Low" or modification scope >15%
- **C**: Architecture fit is "Low" and modification scope ≥50%
- **D**: Explicitly replaced or deprecated by v2.7

### 2.3 New Architecture Seven-Layer Mapping

```
Layer 7 │ Operational Maturity Layer (explainability·emergency brake·lifecycle·edge·drift·cost·debugging·compliance·capacity·multimodal·self-ops)
Layer 6 │ Scale & Ecosystem Layer (multi-region·resource competition·SLA·marketplace·feedback·integration)
Layer 5 │ Organization Governance Layer (org hierarchy·approval routing·SSO·compliance·knowledge isolation·delegation)
Layer 4 │ Intelligent Interaction Layer (NL entry·goal decomposition·proactive agent·autonomy·dashboard·UX)
Layer 3 │ Business Domain Access Layer (DomainDescriptor·Recipe·Runbook)
Layer 2 │ AI Operations Layer (LLM abstraction·Prompt·Eval·Cost·HITL·SDK)
Layer 1 │ Infrastructure Layer (five planes·stability·risk·security·recovery·audit)
```

---

## 3. Overview Matrix

### 3.1 Documentation Porting Overview

| Category | File Count | Green Direct | Yellow Transform | Blue Reference | White Archive |
|----------|------------|--------------|-------------------|----------------|---------------|
| Main Documents (doc/00-07) | 8 | 0 | 5 | 3 | 0 |
| Technical Analysis Docs (doc/18, 19) | 2 | 0 | 2 | 0 | 0 |
| Architecture & Sequence Diagrams | 4 | 0 | 3 | 1 | 0 |
| Contract Documents (doc/contracts/) | 90 | 22 | 38 | 20 | 10 |
| ADR (doc/adr/) | 28 | 15 | 8 | 3 | 2 |
| Operations Documents (doc/operations/) | 30+ | 5 | 10 | 8 | 7+ |
| Review Documents (doc/reviews/) | 21 | 0 | 3 | 12 | 6 |
| Governance Documents (doc/governance/) | 8 | 4 | 3 | 1 | 0 |
| Guide Documents (doc/guides/) | 4 | 2 | 2 | 0 | 0 |
| Reference Documents (doc/reference/) | 17 | 0 | 0 | 8 | 9 |
| Research Documents (doc/research/) | 28 | 0 | 0 | 28 | 0 |
| Archive Documents (doc/archive/) | 3 | 0 | 0 | 0 | 3 |
| **Total** | **~243** | **~48** | **~74** | **~84** | **~37** |

### 3.2 Code Porting Overview

| Architecture Layer | Modules | File Count | Lines | Green | Yellow | Blue | White |
|--------|------|--------|------|-----|-----|-----|-----|
| Layer 1 Infrastructure | types, errors, storage, events, config, cache, locking, queue, api, lifecycle, constants, utils, resource, results | ~230 | ~50K | 8 modules | 5 modules | 1 module | 0 |
| Layer 2 AI Operations | runtime, agent-loop, planning, tools, providers, workflow, orchestration, artifacts, feedback, learning, evaluation | ~230 | ~58K | 3 modules | 7 modules | 1 module | 0 |
| Layer 3 Business Domain | domain-registry, divisions, plugins | ~38 | ~5.7K | 2 modules | 1 module | 0 | 0 |
| Layer 4 Intelligent Interaction | memory, knowledge, messages, gateway | ~54 | ~10.7K | 1 module | 3 modules | 0 | 0 |
| Layer 5 Organization Governance | security, approvals, compliance, cost, hr | ~28 | ~8.6K | 2 modules | 3 modules | 0 | 0 |
| Layer 6 Scale | deployment, improvement, product (partial) | ~35 | ~8.4K | 0 | 2 modules | 1 module | 0 |
| Layer 7 Operational Maturity | observability, ops, stability, evolution, reliability | ~106 | ~32.6K | 2 modules | 3 modules | 0 | 0 |
| Cross-Layer CLI | cli | 78 | ~6.1K | 0 | 1 (whole) | 0 | 0 |
| **Total** | **43 modules** | **~799** | **~180K** | **18** | **25** | **3** | **0** |

---

## 4. Documentation Porting Detailed Assessment

### 4.1 Main Documents (doc/00-07)

| File | Lines | Level | Target Architecture Layer | Porting Notes |
|------|------|-------|---------------------------|---------------|
| `00_document_architecture_and_source_of_truth.md` | 192 | Yellow B | Cross-layer | Document hierarchical governance model (L0-L10) is reusable, needs update to seven-layer architecture documentation system |
| `01_architecture_and_technical_design.md` | 153 | Yellow B | Layer 1-2 | Three-layer platform architecture + control-plane role definition is reusable, needs alignment with v2.7 §1-§5 |
| `02_agents_governance_and_security.md` | 83 | Yellow B | Layer 5 | Agent hierarchy, permissions, and security model are compatible with v2.7 §11 security system, needs expansion on organization governance |
| `03_data_feedback_and_learning.md` | 107 | Yellow B | Layer 2,4 | 6-layer memory + feedback cycle is compatible with v2.7 §56 feedback pipeline, needs update to align KV cache details |
| `04_product_growth_and_strategy.md` | 76 | Blue C | Layer 6 | Commercial positioning and growth strategy serve as reference for new platform product planning |
| `05_delivery_scope_and_milestones.md` | 120 | Yellow B | Cross-layer | Phase roadmap (1a→4) needs remapping to v2.7 §33 seven-phase roadmap |
| `06_testing_release_and_operations.md` | 107 | Blue C | Layer 7 | Test baseline and release gate logic can be referenced, but needs complete rewrite to adapt to v2.7 §27/§32 |
| `07_constraints_roadmap_and_appendix.md` | 98 | Blue C | Cross-layer | Constraints and anti-pattern list serve as reference for new platform design |

### 4.2 Technical Analysis Documents

| File | Lines | Level | Porting Notes |
|------|------|-------|---------------|
| `18_code_architecture.md` | 1,541 | Yellow B | v9 code architecture static analysis, module inventory/dependency graph/quality matrix can be directly used as new platform code architecture baseline, needs update to reflect seven-layer module reorganization |
| `19_full_coverage_test_manual.md` | 2,082 | Yellow B | v1.2 test methodology manual, OAPEFLIR coverage matrix / golden test / mutation testing (Stryker) chapters can be directly reused, needs supplementary Layer 4-7 testing strategy |

### 4.3 Architecture & Sequence Diagram Documents

| File | Lines | Level | Porting Notes |
|------|------|-------|---------------|
| `automatic-agent-architecture.md` | 166 | Yellow B | Main architecture entry document, SLO quantitative metrics (95%/90%/100%) are reusable, needs alignment with v2.7 §27 |
| `runtime-sequence.md` | 291 | Yellow B | 4 sets of core runtime sequence diagrams (Intake/Dispatch/Writeback/Recovery) can be directly ported, needs supplementary OAPEFLIR full-cycle sequence |
| `module-inventory.md` | 317 | Yellow B | Module maturity snapshot, needs update to seven-layer classification |
| `system-status-matrix.md` | 294 | Blue C | Capability status matrix serves as reference, new platform needs to establish its own status tracking |

### 4.4 Contract Documents (doc/contracts/) — 90 Files

**Direct Port (Green A) — 22 Files**: These contract-defined interfaces are fully compatible with the new architecture.

| Contract | Target Architecture Section |
|----------|------------------------------|
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
| Other 10 base contracts | Layer 1 respective sections |

**Transform and Port (Yellow B) — 38 Files**: Core constraints are reusable, need adaptation to new naming/layering/extension points.

| Contract Category | File Count | Key Transformation Points |
|-------------------|------------|---------------------------|
| Agent Behavior Contracts | 8 | Need to add v2.7 §42 Progressive Autonomy + §41 Proactive Agent constraints |
| OAPEFLIR Loop Contracts | 5 | Need to extend Plan/Learn/Improve/Rollout phase contract details |
| API Contracts | 6 | Need to add §39 NL entry + §44 Non-technical user endpoints |
| Billing/Tenant Contracts | 4 | Need to add §46 Org hierarchy + §54 SLA tiering |
| Security/Compliance Contracts | 5 | Need to add §49 Department compliance + §52 GDPR cross-border |
| Others | 10 | Naming and reference updates |

**Reference Value (Blue C) — 20 Files**: Design approach can be referenced but interfaces are covered by new design.

**Archive and Retire (White D) — 10 Files**: Early v1.x contracts replaced by v2.7.

### 4.5 ADR (doc/adr/) — 28 Files

**Direct Port (Green A) — 15 Files**:

| ADR | Decision Topic | Target Architecture Section |
|-----|---------|------------------------------|
| `001-three-layer-architecture.md` | Three-layer architecture | §1 Overall Architecture |
| `003-memory-seven-layers.md` | Memory layering | §3.5 Memory |
| `005-security-model.md` | Security model | §11 Security |
| `006-llm-provider-strategy.md` | LLM strategy | §15 Provider |
| `012-sqlite-phase-1-2-primary-store.md` | SQLite selection | §26 Storage |
| `016-oapeflir-loop-model.md` | OAPEFLIR model | §13 OAPEFLIR |
| `018-rollout-eleven-state-machine.md` | Rollout state machine | §32 Deployment |
| `019-agent-handoff-four-layer-protocol.md` | Agent handoff | §19 Delegation |
| `020-memory-six-plane-model.md` | Memory six-plane | §3.5 |
| `060-explicit-planning-hub.md` | Planning Hub | §13 OAPEFLIR-P |
| `066-plugin-spi-framework.md` | Plugin SPI | §30 |
| `072-oapeflir-testing-strategy.md` | OAPEFLIR testing | §27 |
| `075-controlled-rollout-release.md` | Controlled release | §32 |
| `078-knowledge-plane-architecture.md` | Knowledge architecture | §3.4 |
| `079-feedback-hub-signals.md` | Feedback signals | §56 |

**Transform and Port (Yellow B) — 8 Files**: Decisions are valid but need expansion to adapt to seven-layer architecture.

| ADR | Transformation Points |
|-----|----------------------|
| `002-division-system.md` | Need to add impact of §46 Org hierarchy on Division |
| `004-workflow-routing.md` | Need to adapt multi-level routing of §40 Goal Decomposition Engine |
| `007-evolution-engine.md` | Need to align with v2.7 §65 Behavior drift detection |
| `008-cost-model.md` | Need to expand §66 Cost attribution optimization |
| `009-deployment-ops.md` | Need to add §64 Edge/offline deployment |
| `011-effect-ts-adoption.md` | Need to re-evaluate Effect-TS adoption decision in new platform |
| `013-eventemitter-phase-2-boundary.md` | Need to evaluate whether EventEmitter continues in Phase 2 |
| `017-knowledge-architecture-refactor.md` | Need to align with v2.7 §50 Knowledge domain isolation |

**Reference Value (Blue C) — 3 Files**: `010-commercial-model.md`, `014-org-model-code-boundary.md`, `080-learn-hub-pattern-detection.md`

**Archive and Retire (White D) — 2 Files**: `015-unified-extension-marketplace.md` (replaced by v2.7 §55), early draft ADRs

### 4.6 Governance Documents (doc/governance/) — 8 Files

| File | Level | Porting Notes |
|------|-------|---------------|
| `source_of_truth.md` | Green A | Data source governance rules directly applicable |
| `change_control.md` | Green A | Change control process directly applicable |
| `naming_and_directory_conventions.md` | Green A | Naming and directory conventions directly applicable |
| `glossary_and_terminology.md` | Green A | Glossary directly applicable, need to supplement v2.7 Appendix G terminology |
| `autonomy_boundary_policy.md` | Yellow B | Need to align with v2.7 §42 Progressive autonomy model |
| `rollout_release_policy.md` | Yellow B | Need to align with v2.7 §32 Deployment strategy |
| `phase1_scope_freeze.md` | Yellow B | Need to map to new platform Phase definitions |
| `README.md` | Blue C | Navigation file reference |

### 4.7 Guide Documents (doc/guides/) — 4 Files

| File | Level | Porting Notes |
|------|-------|---------------|
| `quickstart.md` | Green A | Quickstart guide directly reusable, update ports/config |
| `contributing.md` | Green A | Contributing guide directly applicable |
| `division-authoring.md` | Yellow B | Need update to reflect v2.7 §37 DomainDescriptor |
| `skill-authoring.md` | Yellow B | Need update to reflect v2.7 §30 Pack lifecycle |

### 4.8 Operations Documents (doc/operations/) — 30+ Files

**Direct Port (Green A) — 5 Files**:

| File | Porting Notes |
|------|---------------|
| `runbooks/database-issues.md` | Database issues operations manual directly applicable |
| `runbooks/memory-pressure.md` | Memory pressure handling directly applicable |
| `runbooks/incident-response-playbook.md` | Incident response playbook directly applicable |
| `test_coverage_baseline_gate.md` | Coverage gate rules directly applicable |
| `src_module_test_matrix.md` (1,455 lines) | Module-test mapping matrix, format directly reusable, update module list |

**Transform and Port (Yellow B) — 10 Files**: Phase plans, Roadmap, and implementation plans need remapping to seven-phase roadmap.

**Reference/Archive — 15+ Files**: Historical TODOs, old gap analyses, archived plans under archive/.

### 4.9 Review Documents (doc/reviews/) — 21 Files

| Level | File | Notes |
|-------|------|-------|
| Yellow B | `test_strategy_plan.md` (1,957 lines) | Test strategy reusable, needs expansion to Layer 4-7 |
| Yellow B | `authoritative_task_store_refactoring_plan.md` (1,233 lines) | TaskStore refactoring plan has guiding value for new platform storage layer |
| Yellow B | `opeli_detailed_design.md` (4,484 lines) | OAPEFLIR detailed design directly corresponds to v2.7 §13 |
| Blue C | `production_gap_detailed_solutions.md` (2,590 lines) | Production gap solutions as reference |
| Blue C | `production_gap_solution_v2.md` (2,598 lines) | Same as above v2 |
| Blue C | `design_gap_analysis.md` (2,424 lines) | Design gap analysis as new platform verification checklist |
| Blue C | Other 9 files | Historical review records as reference |
| White D | 6 files | Old reviews replaced |

### 4.10 Reference Documents (doc/reference/) — 17 Files

| Level | Notes |
|-------|-------|
| Blue C (8 files) | Architecture/module/security/storage/communication chapters mechanically split from old monolith, design approach can be referenced |
| White D (9 files) | Old content fully covered by v2.7, archive |

### 4.11 Research Documents (doc/research/) — 28 Files

| Level | Notes |
|-------|-------|
| Blue C (all 28 files) | Competitive analysis (Claude Code/Codex/Goose/Aider/MetaGPT/LangGraph/Temporal/DeerFlow etc.) and reference alignment reviews. Not directly ported but high reference value for new platform design decisions. Recommend moving entire `doc/research/` directory into new project |

### 4.12 Archive Documents (doc/archive/) — 3 Files

| Level | Notes |
|-------|-------|
| White D (all 3 files) | `automatic-agent-architecture-monolith-dedup.md` (11,392 lines) etc. are historical archives, retained for audit traceability only |

---

## 5. Code Module Porting Detailed Assessment

### 5.1 Layer 1 — Infrastructure Layer

#### Green Direct Port (8 Modules)

| Module | Files/Lines | Target Section | Porting Notes |
|--------|-------------|----------------|---------------|
| `core/types/` | 21 / 2,887 | §5 Contracts | Branded IDs, state enums, 15+ domain record types. Zero external dependencies, TypeScript strict mode. **Port as-is** |
| `core/errors.ts` | 1 / 490 | §10 Exceptions | 14-category `AppError` hierarchy + serialization. Zero dependencies. **Port as-is** |
| `core/constants/` | 2 / 16 | Cross-layer | Time constants. **Port as-is** |
| `core/utils/` | 2 / 109 | Cross-layer | BoundedCache utility class. **Port as-is** |
| `core/results/` | 2 / 390 | §5 Contracts | ResultEnvelope pattern. **Port as-is** |
| `core/locking/` | 8 / 635 | §31 Disaster Recovery | Distributed lock abstraction (SQLite/Redis/PG advisory). Clean adapter pattern. **Port as-is** |
| `core/queue/` | 6 / 771 | §4 Events | Queue abstraction (SQLite/Redis) + factory. **Port as-is** |
| `core/lifecycle/` | 3 / 276 | §8 Extensions | ServiceRegistry + teardown ordering. **Port as-is** |

#### Yellow Transform and Port (5 Modules)

| Module | Files/Lines | Target Section | Transformation Points |
|--------|-------------|----------------|------------------------|
| `core/storage/` | 101 / 26,102 | §26 Data Model | `AuthoritativeTaskStore` is the global data access facade (god object). Core SQL schema/migration reusable, but needs splitting into domain-based Repositories. PG async adapter pattern excellent, retain |
| `core/events/` | 8 / 1,894 | §28 Events | 3-tier DurableEventBus design is excellent. Need to add 8 new event namespaces from v2.7 §28 (delegation.*/hibernation.*/prompt.*/eval.*/cost.*/approval_flow.*/agent_lifecycle.*/circuit_breaker.*) |
| `core/config/` | 27 / 6,776 | §24 Configuration | Zod schema validation + 8-layer configuration governance reusable. Need to add §46 Org hierarchy configuration + §64 Edge deployment configuration |
| `core/cache/` | 27 / 2,518 | §26 Cache | L1/L2/L3 multi-level cache + domain policies. Need to add §50 Knowledge domain isolation cache partitioning |
| `core/api/` | 30 / 5,006 | §6 API | HTTP server + OIDC/OAuth + WebSocket. Need to add §39 NL entry endpoints + §44 Non-technical user API + §48 SSO/SCIM endpoints |

#### Blue Reference Value (1 Module)

| Module | Notes |
|--------|-------|
| `core/resource/` | 2 / 361 | ProcessTracker process tracking logic can be referenced, but new platform may use different process management model |

### 5.2 Layer 2 — AI Operations Layer

#### Green Direct Port (3 Modules)

| Module | Files/Lines | Target Section | Porting Notes |
|--------|-------------|----------------|---------------|
| `core/providers/` | 10 / 4,436 | §15 LLM | UnifiedChatProvider (Anthropic/OpenAI/MiniMax) + CircuitBreaker + CredentialPool + ModelRouting. Clean adapter pattern. **A2 Port**: Core implementation unchanged, need to add §15.6 streaming error handling adapter (architecture fit=medium, modification scope ≤15%) |
| `core/workflow/` | 4 / 1,011 | §13 OAPEFLIR | MinimalWorkflow + Validator + OutputSchema + StepRetryPolicy. **Port as-is** |
| `core/artifacts/` | 13 / 1,095 | §30 Pack | Artifact model/storage/version/release/governance/sensitive content scanning. **A2 Port**: Need to add evidence/compliance chain adapter + §69 multimodal artifact + §55 marketplace publishing interface (architecture fit=medium, modification scope ≤15%) |

#### Yellow Transform and Port (7 Modules)

| Module | Files/Lines | Target Section | Transformation Points |
|--------|-------------|----------------|------------------------|
| `core/runtime/` | 114 / 30,348 | §9,§13,§31 | **Largest module, highest risk**. ExecutionDispatch/Lease/Worker/HA/Recovery/HotUpgrade core logic reusable. Transformation: (1) Split into five independent bounded contexts: Dispatch/Lease/Worker/HA/Recovery; (2) Adapt to §41 Proactive Agent scheduling; (3) Add §52 multi-Region dispatch; (4) Add §53 resource competition management |
| `core/agent-loop/` | 31 / 2,562 | §13 OAPEFLIR | OapeflirLoopService + Assessment + Handoff + StageTimeline. Core loop logic complete. Need to add §42 Autonomy assessment phase + §59 Explainability output |
| `core/planning/` | 9 / 314 | §13 OAPEFLIR-P | PlanBuilder/DAGValidator/StrategySelector. Need to expand §40 Goal Decomposition Engine multi-level decomposition capability |
| `core/tools/` | 36 / 13,500 | §30 Tools | CommandExecutor/SkillExecution/ToolSanitizer/PathScope/MCPGuard. Security boundaries complete. Need to add §69 Multimodal tool support + §37 Domain tool registration |
| `core/orchestration/` | 3 / 1,054 | §13 Orchestration | IntakeRouter/WorkflowPlanner/AgentTeamService. Need to adapt §39 NL entry + §40 Goal decomposition + §46 Org hierarchy routing |
| `core/feedback/` | 5 / 532 | §56 Feedback | FeedbackCollector/SignalPreprocessor. Need to expand §56 Feedback-driven continuous improvement pipeline complete signal types |
| `core/learning/` | 14 / 682 | §13 OAPEFLIR-L | FailurePatternMiner/ExperienceDistillation/StrategyLearning + 4 pattern detectors. Need to add §65 Behavior drift detection patterns |

#### Blue Reference Value (1 Module)

| Module | Notes |
|--------|-------|
| `core/evaluation/` | 6 / 1,429 | PostExecutionQualityGate/LlmEvalService logic can be referenced, but v2.7 §17 defines a more complete model evaluation framework, needs redesign |

### 5.3 Layer 3 — Business Domain Access Layer

#### Green Direct Port (2 Modules)

| Module | Files/Lines | Target Section | Porting Notes |
|--------|-------------|----------------|---------------|
| `core/domain-registry/` | 14 / 2,456 | §37 Domain Modeling | DomainRegistryService/PluginSpiRegistry/ContractRegistry/ToolBundleRegistry/WorkflowRegistry/PluginRuntimeHost. SPI pattern clean. **Port as-is**, need to add DomainDescriptor registration |
| `core/divisions/` | 4 / 1,632 | §37 Domain | DivisionLoader + YAML safe loading + HrRoleGovernance. **Port as-is** |

#### Yellow Transform and Port (1 Module)

| Module | Files/Lines | Target Section | Transformation Points |
|--------|-------------|----------------|------------------------|
| `plugins/` | 20 / 1,672 | §30,§55 | 16 builtin plugins (6 domains: coding/ops/growth/game-dev/asset-production/livestream). SPI adapter/presenter/retriever/validator/planner pattern reusable. Need to add §55 Marketplace ecosystem pack/release/deprecation lifecycle |

### 5.4 Layer 4 — Intelligent Interaction Layer

#### Green Direct Port (1 Module)

| Module | Files/Lines | Target Section | Porting Notes |
|--------|-------------|----------------|---------------|
| `core/messages/` | 2 / 509 | §39 Messages | MessageParts + TokenEstimator. **Port as-is** |

#### Yellow Transform and Port (3 Modules)

| Module | Files/Lines | Target Section | Transformation Points |
|--------|-------------|----------------|------------------------|
| `core/memory/` | 16 / 3,335 | §3.5 Memory | Hierarchical memory (session/project/user/global) + consolidation/promotion/retrieval/quality. Need to add §50 Knowledge domain isolation memory partitioning + §64 Edge deployment local memory cache |
| `core/knowledge/` | 23 / 3,443 | §3.4 Knowledge | KnowledgePlane/Ingestion/Embedding/VectorStore/Graph/Retrieval + governance. Need to add §50 Knowledge domain isolation + §69 Multimodal knowledge indexing |
| `gateway/` | 13 / 3,471 | §6,§44 | ChannelGateway (Telegram/Slack/Webhook) + WebSocket + SSE. Need to add §39 NL channel + §44 Non-technical user frontend gateway + §57 External system integration gateway |

### 5.5 Layer 5 — Organization Governance Layer

#### Green Direct Port (2 Modules)

| Module | Files/Lines | Target Section | Porting Notes |
|--------|-------------|----------------|---------------|
| `core/security/` | 19 / 7,125 | §11 Security | SandboxPolicy/PolicyEngine/SecretManagement/AuditIntegrity/FieldEncryption/NetworkEgress/CveIntelligence. **A2 Port**: Core security mechanisms unchanged, need to add §49 Department-level security policy engine adapter (architecture fit=medium, modification scope ≤15%) |
| `core/cost/` | 2 / 64 | §18 Cost | BudgetGuard. Lightweight but complete. **Port as-is**, need to expand §66 Cost attribution optimization |

#### Yellow Transform and Port (3 Modules)

| Module | Files/Lines | Target Section | Transformation Points |
|--------|-------------|----------------|------------------------|
| `core/approvals/` | 3 / 495 | §21 HITL | ApprovalService/TimeoutExecutor. Need to add §47 Org structure approval routing + multi-party approval/delegation |
| `core/compliance/` | 2 / 346 | §23,§68 | AuditExportService. Need to expand §68 Compliance report auto-generation + §52 GDPR cross-border |
| `core/hr/` | 2 / 572 | §46 Organization | HrRoleGovernanceService. Need to add §46 Org hierarchy model + §51 Hierarchical governance delegation |

### 5.6 Layer 6 — Scale & Ecosystem Layer

#### Yellow Transform and Port (2 Modules)

| Module | Files/Lines | Target Section | Transformation Points |
|--------|-------------|----------------|------------------------|
| `core/deployment/` | 2 / 502 | §32 Deployment | TrafficRoutingService (blue-green/canary). Need to expand §52 Multi-region deployment + §64 Edge deployment |
| `core/improvement/` | 11 / 770 | §13 OAPEFLIR-IR | StrategyVersioning/AutonomyBoundary/GuardrailEvaluator/AutoRollback/CanaryRouter/RolloutStateMachine. Need to align §42 Progressive autonomy + §55 Marketplace Agent version management |

#### Blue Reference Value (1 Module)

| Module | Notes |
|--------|-------|
| `core/product/` | 22 / 7,109 | BillingService/Marketplace/TenantPlatform/PMF/EnterpriseCapability. Business logic deeply coupled with old system Phase 1-2, needs redesign based on v2.7 §54 SLA tiering + §55 Marketplace ecosystem |

### 5.7 Layer 7 — Operational Maturity Layer

#### Green Direct Port (2 Modules)

| Module | Files/Lines | Target Section | Porting Notes |
|--------|-------------|----------------|---------------|
| `core/observability/` | 36 / 8,172 | §12,§27 | StructuredLogger/HealthService/Prometheus/OpenTelemetry/SLO-Alerting/AnomalyDetection. **Port as-is**, need to add §67 Visual debugging support |
| `core/reliability/` | 8 / 1,112 | §10 Risk | FailureClassification/RepairPipeline/PatchBundle/TaskCard. **Port as-is** |

#### Yellow Transform and Port (3 Modules)

| Module | Files/Lines | Target Section | Transformation Points |
|--------|-------------|----------------|------------------------|
| `core/ops/` | 19 / 8,308 | §12,§32 | DoctorService/OpsGovernance/EnterpriseGovernance/ReleasePipeline/HumanTakeover/AutoStopLoss. Need to add §60 Emergency brake + §70 Platform self-ops Agent |
| `core/stability/` | 31 / 12,789 | §27,§32 | 20+ stability rehearsal scenarios + evidence bundling. Need to add §64 Edge deployment rehearsal + §65 Drift detection rehearsal |
| `core/evolution/` | 12 / 2,268 | §65 Drift | EvolutionMVP/Reflection/Proposal/Benchmark/Rollout. Need to align §65 Behavior drift detection + §61 Unified lifecycle management |

### 5.8 Cross-Layer — CLI

#### Yellow Transform and Port (Whole)

| Module | Files/Lines | Transformation Points |
|--------|-------------|------------------------|
| `cli/` | 78 / 6,149 | 78 CLI entry points are thin wrapper layers, depending on underlying services. Porting strategy: **port synchronously with service migration**. Need to add §39 NL CLI entry + §43 Operations dashboard CLI + §46 Org management CLI |

### 5.9 Supporting Assets

#### config/ — Green Direct Port

| Directory | File Count | Porting Notes |
|-----------|------------|---------------|
| `config/bootstrap/` | 1 | Phase configuration directly reusable |
| `config/runtime/` | 6 | Runtime configuration (with 5 environment variants) directly reusable |
| `config/security/` | 6 | Security configuration directly reusable |
| `config/providers/` | 3 | Provider + model metadata directly reusable |
| `config/environments/` | 5 | Environment configuration directly reusable |
| `config/plugins/` | 1 | Plugin configuration directly reusable |
| `config/domains/` | 1 | Domain configuration directly reusable, need to expand DomainDescriptor |
| `config/gateways/` | 1 | Gateway configuration directly reusable |
| `config/workflows/` | 1 | Workflow configuration directly reusable |
| `config/knowledge/` | 1 | Knowledge configuration directly reusable |
| `config/product/` | 1 | Product configuration directly reusable |

#### divisions/ — Yellow Transform and Port

| Content | Porting Notes |
|---------|---------------|
| 11 division definitions (with YAML + roles/ + workflows/ + schemas/) | Yellow downgrade reason: v2.7 §37 DomainDescriptor semantic model has breaking changes to division YAML structure, need to add descriptor metadata fields, domain capability declarations, SLA bindings. YAML schema changes affect all 11 definition files |

#### tests/ — See §5.10 Test Porting Detailed Assessment

#### Infrastructure Files — Green Direct Port

| File | Porting Notes |
|------|---------------|
| `package.json` | Dependency declarations and 110+ npm scripts directly reusable, need to clean up no-longer-needed scripts |
| `tsconfig.json` / `tsconfig.build.json` | TypeScript strict configuration directly reusable |
| `eslint.config.js` | ESLint 9 flat config directly reusable |
| `.c8rc.json` | Coverage configuration directly reusable |
| `Dockerfile` | Multi-stage build directly reusable, need to add edge deployment variant |
| `docker-compose.yml` | Three-service orchestration directly reusable, need to add Redis cluster variant |
| `.env.example` | 346-line environment variable template directly reusable, need to add Layer 4-7 configuration items |
| `.github/workflows/` | 4 CI workflows directly reusable |
| `scripts/` | CI/build scripts directly reusable |
| `deploy/` | Deployment manifests directly reusable |

### 5.10 Test Porting Detailed Assessment

> **Total Test Scale**: 1,069 files / ~229,196 lines

#### Test Infrastructure Dependencies

| Dependency | Notes | Porting Impact |
|------------|-------|----------------|
| Node.js 22 built-in test runner | `import test from "node:test"` + `assert/strict` | Green no migration cost, new platform continues using |
| SQLite (DatabaseSync) | Almost all tests create temporary DB via `SqliteDatabase` | Yellow need to ensure new platform retains SQLite test backend |
| TypeScript ESM | All use `.js` extension ESM imports | Green new platform continues ESM |
| Handwritten mocks (no external mock library) | `typed-factories.ts` + deterministic bridge pattern | Green zero external dependencies, port directly |
| PostgreSQL (optional) | Only `pg-test-helper.ts` and few storage tests, need `AA_TEST_PG_DSN` env var | Green optional dependency, does not affect main flow |
| Temporary filesystem workspace | `createTempWorkspace()` / `cleanupPath()` | Green port directly |

#### 5.10.1 tests/helpers/ — 19 files / ~2,093 lines

| File | Lines | Level | Purpose | Porting Notes |
|------|-------|-------|---------|---------------|
| `fs.ts` | 21 | Green A | Temporary workspace create/cleanup | Almost all tests depend on it, **port first** |
| `seed.ts` | 100 | Green A | Database seed data (seedTaskAndExecution) | E2E/golden/integration depend on it |
| `typed-factories.ts` | 143 | Green A | Type-safe mock factories (createPartial/unsafeCast) | Widely used |
| `env.ts` | 53 | Green A | Environment variable save/restore | Config/CLI tests depend on it |
| `golden.ts` | 80 | Green A | Golden snapshot assertions (supports UPDATE_GOLDEN=1) | Golden tests depend on it |
| `e2e-harness.ts` | 131 | Green A | E2E test harness (SQLite + Store + Workspace) | E2E tests depend on it |
| `integration-context.ts` | 131 | Green A | Integration test context | Integration tests depend on it |
| `repository-harness.ts` | 80 | Green A | Repository test harness | Storage unit tests depend on it |
| `concurrent-runner.ts` | 158 | Green A | Concurrent operations runner + invariant checks | Concurrent tests depend on it |
| `test-cleanup.ts` | 27 | Green A | Singleton reset + process cleanup | Tests needing isolation depend on it |
| `process-guard.ts` | 90 | Green A | Process leak detection | Runtime/Tool tests depend on it |
| `fixtures/base.ts` | 99 | Green A | Minimal valid record factory | Unit tests depend on it |
| `fixtures/composite.ts` | 227 | Green A | Complex multi-entity state factory | Integration tests depend on it |
| `perception.ts` | 66 | Green A | Perception dataset seed | Product tests depend on it |
| `pmf.ts` | 251 | Green A | PMF validation dataset seed | PMF tests depend on it |
| `billing.ts` | 36 | Green A | Billing dataset seed | Billing tests depend on it |
| `api.ts` | 362 | Yellow B | HTTP API full-stack bootstrap | Need to adapt to new API layer |
| `cli.ts` | 30 | Yellow B | CLI script runner | Need to adapt to new CLI paths |
| `pg-test-helper.ts` | 35 | Yellow B | PostgreSQL test helper | Need to adapt to new PG configuration |

#### 5.10.2 tests/unit/ — 758 files / ~169,943 lines

Porting assessment grouped by source module:

| Source Module | Test Files | Test Lines | Level | Port With Phase |
|---------------|-----------|------------|-------|-----------------|
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

**Summary**: Out of 758 unit test files, **~720 can be directly ported** (Green), only storage/ (51 files), runtime/ (92 files), and cli/ (2 files) need transformation adaptation (Yellow).

#### 5.10.3 tests/integration/ — 247 files / ~49,342 lines

Grouped by test category:

| Category | Files | Lines | Level | Porting Notes |
|----------|-------|-------|-------|---------------|
| **Security boundaries** | 64 | 8,929 | Yellow B | Command injection/path traversal/SSRF/data leakage/sandbox escape/JWT algorithm downgrade/container boundaries etc. Coupled with sandbox implementation, need to verify new platform compatibility |
| **CLI integration** | 32 | 8,998 | Yellow B | Integration tests for 78 CLI commands. Call `dist/` compiled scripts, need to adapt to new CLI paths |
| **Runtime integration** | 53 | 9,498 | Yellow B | Dispatch/Lease/Worker/Recovery/rehearsal scenarios. Deeply coupled with SQLite storage and runtime lifecycle |
| **Contract verification** | 5 | 1,459 | Green A | OpenAPI/event schema/Gateway adapter/Provider interface/Store facade contracts. **Verify interfaces not implementations, port directly** |
| **Data integrity** | 3 | 1,227 | Yellow B | Approval-execution consistency/event column mapping/memory reference integrity. Depends on SQLite column-level validation |
| **Recovery** | 6 | 1,456 | Yellow B | Approval timeout recovery/scheduling compensation/event replay/lease crash recovery/SQLite WAL recovery/writeback compensation. Contains SQLite-specific tests |
| **Concurrency** | 5 | 1,401 | Yellow B | Command concurrency limits/DB busy retry/scheduling race conditions/event concurrency/lease contention. Partially SQLite-specific |
| **Reliability** | 6 | 1,423 | Green A | Degraded behavior/message queue/data loss-free/audit/terminal state guarantees. **Verify invariants, port directly** |
| **Observability** | 6 | 2,011 | Green A | Approval cascading/health checks/metrics/SLI-SLO/task panel/timeline diagnostics. Port directly |
| **Other 36 subdirectories** | 67 | ~12,940 | Green A / Yellow B | API(2)/approval(2)/cache(1)/compliance(1)/config(2)/cost(2)/deployment(1)/Division(2)/evaluation(1)/events(2)/evolution(1)/gateway(1)/HR(1)/lifecycle(5 Yellow)/locking(1)/memory(1)/messages(2)/migration(3 Yellow)/ops(3 Yellow)/orchestration(1)/product(3)/Provider(2)/queue(1)/resource(1)/results(2)/session(1)/smoke(5)/soak(2 Blue)/stability(1)/storage(5 Yellow)/tools(2)/types(2)/toolset(1)/workflow(2) |

**Summary**: Out of 247 integration test files, **~150 can be directly ported** (Green), **~90 need transformation** (Yellow, concentrated in security/CLI/Runtime/Recovery/storage), **~7 for reference only** (Blue, soak tests).

#### 5.10.4 tests/golden/ — 8 files / ~1,662 lines

| File | Lines | Level | Porting Notes |
|------|-------|-------|---------------|
| `diagnostics-bundle.test.ts` | 160 | Green A | Diagnostics bundle structure snapshot |
| `openapi-document.test.ts` | 187 | Green A | OpenAPI document snapshot |
| `release-plan-output.test.ts` | 202 | Green A | Release plan Markdown snapshot |
| `session-summary.test.ts` | 148 | Green A | Session summary snapshot |
| `phase1a-golden-tasks.test.ts` | 30 | Green A | Phase1a golden tasks |
| `prompt-assembly.test.ts` | 220 | Green A | Prompt partition/cache key snapshot |
| `workflow-validation.test.ts` | 145 | Green A | Workflow validation snapshot |
| `cli-help-text.test.ts` | 238 | Yellow B | CLI help text snapshot. Need to adapt to new CLI command list |
| `snapshots/` (3 files) | 332 | Green A | Snapshot data files |

#### 5.10.5 tests/e2e/ — 10 files / ~2,807 lines

| File | Lines | Level | E2E Flow |
|------|-------|-------|----------|
| `task-lifecycle.test.ts` | 371 | Yellow B | Task full lifecycle: create→schedule→execute→complete. API/model/runtime all have changes, need to adapt |
| `multi-step-workflow.test.ts` | 406 | Yellow B | Multi-step workflow: step dependency→output passing→complete. Workflow model expansion affects assertions |
| `lease-recovery.test.ts` | 371 | Yellow B | Lease lifecycle: acquire→expire→recover→compete. Runtime split lease interface changes |
| `operator-takeover.test.ts` | 306 | Yellow B | Ops takeover: run→pause→human control→resume. §60 Emergency brake introduces new takeover path |
| `error-propagation.test.ts` | 298 | Yellow B | Error propagation: execution failure→terminal state→error code→retry. State machine expansion affects terminal state judgment |
| `oapeflir-full-loop.test.ts` | 248 | Yellow B | OAPEFLIR 8-stage full loop. §42 Autonomy assessment adds new stage |
| `session-memory-flow.test.ts` | 237 | Yellow B | Session lifecycle + memory association. §50 Knowledge domain isolation affects memory access |
| `gateway-webhook-flow.test.ts` | 230 | Yellow B | Webhook trigger→task creation→lifecycle transition. §39 NL entry changes entry API |
| `streaming-response.test.ts` | 208 | Yellow B | Streaming response: session streaming state + backpressure. §15.6 Streaming error handling expansion |
| `approval-event-flow.test.ts` | 132 | Yellow B | Approval event flow: block→Tier1 event→consumer acknowledgment. §47 Org approval routing changes |

**Downgrade notes**: All 10 E2E tests were marked Green in v1.0, downgraded to Yellow after review. E2E tests traverse the full chain of API→model→runtime→storage, and runtime split, API expansion, state machine changes, and org governance modifications will require test harness and assertion adaptation. Core test scenarios (lifecycle/workflow/recovery) are reusable, but estimated modification volume is 15%-30%.

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

**All 6 performance tests can be directly ported** Green. The 10 deprecated files under `.bak/` are for reference only.

#### 5.10.7 tests/fixtures/ — 4 files / ~459 lines

| File | Lines | Level | Porting Notes |
|------|-------|-------|---------------|
| `migration/generate-snapshots.ts` | 134 | Yellow B | SQLite snapshot generation script, need to adapt to new migration version sequence |
| `migration/migration-fixtures.test.ts` | 235 | Yellow B | Migration ledger integrity test |
| `migration/snapshots/manifest.json` | 41 | Yellow B | Snapshot version manifest |
| `migration/README.md` | 49 | Green A | Usage instructions |

#### 5.10.8 Test Porting Summary

| Test Layer | Total Files | Total Lines | Green Direct | Yellow Transform | Blue Reference |
|------------|-------------|-------------|--------------|-------------------|----------------|
| helpers/ | 19 | 2,093 | 16 | 3 | 0 |
| unit/ | 758 | 169,943 | ~720 | ~38 | 0 |
| integration/ | 247 | 49,342 | ~150 | ~90 | ~7 |
| golden/ | 8+3 | 1,662 | 10 | 1 | 0 |
| e2e/ | 10 | 2,807 | 0 | 10 | 0 |
| performance/ | 6+10 | 2,890 | 6 | 0 | 10 |
| fixtures/ | 4 | 459 | 1 | 3 | 0 |
| **Total** | **1,069** | **~229,196** | **~903** | **~145** | **~17** |

#### 5.10.9 Test Phase Migration Mapping Table

| Porting Phase | Source Modules | Corresponding Test Directory | Test Files | Test Lines |
|---------------|----------------|------------------------------|------------|------------|
| **P0 (Advance)** | — | All `tests/helpers/` | 19 | 2,093 |
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
──────┼───────────────────────────────────┼────────┼─────────┼───────────────┼──────────
  P0  │ Test Helpers (Advance)            │   19  │  ~2.1K  │ None          │ 0.5 person-days
      │ All tests/helpers/                │       │         │               │
──────┼───────────────────────────────────┼────────┼─────────┼───────────────┼──────────
  1   │ Shared Kernel + Tests             │  ~68  │ ~13.2K  │ P0            │ 1.5 person-days
      │ types/ + errors.ts +             │ src30 │  4.7K   │               │
      │ constants/ + utils/ +            │ test38│  8.5K   │               │
      │ results/ + lifecycle/            │       │         │               │
──────┼───────────────────────────────────┼────────┼─────────┼───────────────┼──────────
  2   │ Infra Foundation + Tests          │ ~325  │ ~71.5K  │ Phase 1       │ 7 person-days
      │ storage/ + events/ + config/     │ src145│ 29.5K   │               │
      │ + locking/ + queue/ + cache/     │ test180│ 42.0K  │               │
      │ + config/ dir + fixtures/        │       │         │               │
──────┼───────────────────────────────────┼────────┼─────────┼───────────────┼──────────
  3   │ Security & Governance + Tests    │ ~141  │ ~28.1K  │ Phase 2       │ 3.5 person-days
      │ security/ + approvals/ +         │ src26 │  8.1K   │               │
      │ cost/ + compliance/ + hr/       │ test115│ 20.0K  │               │
──────┼───────────────────────────────────┼────────┼─────────┼───────────────┼──────────
  4   │ AI Ops Primitives + Tests        │ ~163  │ ~41.5K  │ Phase 2       │ 4.5 person-days
      │ providers/ + tools/ +            │ src63 │ 19.5K   │               │
      │ workflow/ + artifacts/           │ test100│ 22.0K  │               │
──────┼───────────────────────────────────┼────────┼─────────┼───────────────┼──────────
  5   │ Runtime Core + Tests (After Split)│ ~264 │ ~72.3K  │ Phase 2-4      │ 10 person-days
      │ runtime/ → dispatch/lease/       │ src114│ 30.3K   │               │
      │ worker/ha/recovery/              │ test150│ 42.0K  │               │
──────┼───────────────────────────────────┼────────┼─────────┼───────────────┼──────────
  6   │ OAPEFLIR Pipeline + Tests        │ ~119  │ ~15.5K  │ Phase 4-5      │ 3.5 person-days
      │ agent-loop/ + planning/ +        │  src63│  4.1K   │               │
      │ feedback/ + learning/ +          │ test56 │ 11.4K  │               │
      │ evaluation/ + improvement/      │       │         │               │
──────┼───────────────────────────────────┼────────┼─────────┼───────────────┼──────────
  7   │ Interaction Layer + Tests         │ ~124  │ ~28.8K  │ Phase 5-6      │ 4 person-days
      │ memory/ + knowledge/ +           │  src54│ 10.8K   │               │
      │ messages/ + gateway/             │ test70│ 18.0K   │               │
──────┼───────────────────────────────────┼────────┼─────────┼───────────────┼──────────
  8   │ Business Domain + Tests           │  ~78  │ ~13.5K  │ Phase 2,7      │ 2.5 person-days
      │ domain-registry/ + plugins/     │  src38│  5.8K   │               │
      │ + divisions/ dir                │ test40│  7.7K   │               │
──────┼───────────────────────────────────┼────────┼─────────┼───────────────┼──────────
  9   │ Operational Maturity + Tests      │ ~271  │ ~72.6K  │ Phase 5        │ 7 person-days
      │ observability/ + ops/ +          │ src106│ 32.6K   │               │
      │ stability/ + evolution/ +        │ test165│ 40.0K  │               │
      │ reliability/ + product/          │       │         │               │
──────┼───────────────────────────────────┼────────┼─────────┼───────────────┼──────────
 10   │ CLI + E2E + Golden + Perf        │ ~146  │ ~23.6K  │ Phase 1-9      │ 4 person-days
      │ + Infra Files                    │  src78│  6.1K   │               │
      │ cli/ + e2e/ + golden/ +         │ test68│ 17.5K   │               │
      │ performance/ + smoke/ +           │       │         │               │
      │ contract/ + deploy/ + CI        │       │         │               │
```

**Total**: ~1,868 files (source 799 + tests 1,069) / ~406K lines (source ~177K + tests ~229K) / **~70-100 person-days** (including storage/runtime split, adapter writing, E2E transformation; excluding 24 new module developments)

### 6.2 Documentation Porting Order

```
Batch │ Content                           │ Files │ Priority
──────┼───────────────────────────────────┼────────┼─────────
 D1   │ Governance + Guide docs (Green direct) │  8  │ P0
 D2   │ Contract docs 22 Green + 15 ADR Green  │ 37  │ P0
 D3   │ Operations manuals 5 Green + runbooks │ ~8  │ P1
 D4   │ Main docs 5 Yellow + Technical 2       │  7  │ P1
 D5   │ Contract docs 38 Yellow + ADR 8 Yellow │ 46  │ P2
 D6   │ Review docs 3 Yellow                  │  3  │ P2
 D7   │ Research docs 28 Blue move entire     │ 28  │ P3
 D8   │ Reference/Archive cleanup marks       │ 29  │ P4
```

---

## 7. Key Risks and Mitigations

### 7.1 High-Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| `runtime/` module too large (114 files / 30K lines) | Migration introduces regression, split breaks interfaces | Before Phase 5, write boundary integration tests; after split verify all stable-* rehearsals pass |
| `storage/` AuthoritativeTaskStore is a god object | Almost all modules depend on it, changes have huge impact | First abstract Repository interface layer, then gradually migrate direct calls to Repository |
| Event namespace expansion (17→25) | Consumers not updated will lose events | New namespaces first register as Tier 3 (best-effort), upgrade to Tier 1 after confirming consumers are ready |
| Modules needed by new platform but completely absent from old system | §39 NL entry/§40 Goal decomposition/§41 Proactive Agent/§46 Org hierarchy/§64 Edge etc. need all-new development | Porting and new feature development in parallel, porting first to establish foundation |

### 7.2 Capabilities Completely Absent from Old System, Need New Development in New Platform

| v2.7 Section | Capability | New Modules Needed |
|--------------|------------|-------------------|
| §39 | Natural language task entry | `core/nl-entry/` — NL parser, intent classification, entity extraction, session management |
| §40 | Goal decomposition engine | `core/goal-decomposition/` — Goal graph, subgoal generation, DAG orchestration |
| §41 | Proactive agent | `core/proactive-agent/` — Trigger engine, timed scheduling, event-driven wakeup |
| §42 | Progressive autonomy | `core/autonomy/` — Trust scoring, autonomy level state machine, promotion/demotion rules |
| §43 | Unified operations dashboard | `core/dashboard/` — Business view aggregation, multi-role dashboards |
| §44 | Non-technical user UX | `gateway/user-portal/` — Web UI gateway, drag-and-drop orchestration, wizards |
| §46 | Org hierarchy model | `core/org-hierarchy/` — Org tree, departments/teams, hierarchical inheritance |
| §47 | Org structure approval routing | Extend `core/approvals/` — Dynamic routing engine |
| §48 | SSO/SCIM integration | `core/sso-scim/` — SAML/OIDC SSO, SCIM user sync |
| §49 | Department-level compliance policy | Extend `core/compliance/` — Department-level policy engine |
| §50 | Knowledge domain isolation | Extend `core/knowledge/` — namespace isolation, controlled sharing |
| §52 | Multi-region deployment | `core/multi-region/` — Region routing, data sync, failover |
| §53 | Resource competition management | `core/resource-scheduler/` — Priority queue, fair scheduling |
| §54 | SLA tiering | `core/sla/` — SLA tier definitions, guarantee policies |
| §59 | Agent explainability | `core/explainability/` — Decision tracking, causal chains |
| §60 | Emergency brake | `core/emergency-brake/` — Global brake, tiered brake |
| §61 | Unified lifecycle management | `core/agent-lifecycle/` — Create→activate→hibernate→decommission |
| §64 | Edge/offline deployment | `core/edge-runtime/` — Offline cache, sync |
| §65 | Behavior drift detection | `core/drift-detection/` — Baseline comparison, alerting |
| §66 | Cost attribution optimization | Extend `core/cost/` — Multi-dimensional attribution, optimization suggestions |
| §67 | Visual debugging | `core/debug-ui/` — Execution visualization, breakpoints |
| §68 | Compliance report auto-generation | Extend `core/compliance/` — Report templates, auto-generation |
| §69 | Multimodal capabilities | `core/multimodal/` — Image/audio/video processing |
| §70 | Platform self-ops agent | `core/self-ops-agent/` — Auto-inspection, auto-repair |

---

## 8. Core Object Migration Matrix

The old system defines ~84 domain entity types (`core/types/`). The new platform v2.7 introduces many new entities and entity splits in layers such as Organization Governance (§46-§51), Intelligent Interaction (§39-§44), and Scale & Ecosystem (§52-§57). This section maps old→new entity evolution relationships.

### 8.1 Mapping Type Definitions

| Mapping Type | Symbol | Meaning |
|--------------|--------|---------|
| **1:1 Direct** | → | Field name/semantics unchanged, directly rename or retain |
| **1:1 Enrich** | →+ | Retain original fields, add new required fields |
| **1:N Split** | →⑴⑵… | One old entity splits into multiple new entities |
| **N:1 Merge** | ⇒ | Multiple old entities merge into one new entity |
| **Semantic Redefinition** | ⇝ | Same name but semantics/lifecycle fundamentally changed |
| **New** | ★ | No corresponding entity in old system |
| **Retired** | ✕ | No longer needed |

### 8.2 Core Entity Mapping (Grouped by Domain)

#### Task & Execution Domain

| Old Entity | Mapping | New Entity | Risk | Notes |
|------------|---------|------------|------|-------|
| TaskRecord | →+ | task | Low | New fields: org_node_id, autonomy_level, sla_tier |
| ExecutionRecord | →⑴⑵⑶⑷⑸ | execution + execution_step + execution_artifact + execution_metric + execution_decision_log | High | Splits from single row to 5 tables, needs data migration script |
| TransitionCommand | ⇝ | state_command + control_directive | High | Fundamental architectural change: commands no longer directly operate state machine, route indirectly through control_directive |
| SessionRecord | →+ | session | Low | New fields: channel_type, nl_context (§39) |
| WorkflowRecord | →+ | workflow_definition | Low | New field: goal_decomposition_tree reference (§40) |
| WorkflowStepRecord | →+ | workflow_step | Low | New fields: autonomy_gate, explainability_output |
| WorkflowStateRecord | →⑴⑵⑶⑷ | workflow_run + loop_cycle + checkpoint + hibernation_snapshot | High | Loop/checkpoint/hibernation separation |

#### Worker & Scheduling Domain

| Old Entity | Mapping | New Entity | Risk | Notes |
|------------|---------|------------|------|-------|
| WorkerRecord | →+ | worker | Low | New fields: region_id, capability_vector |
| LeaseRecord | →+ | lease | Low | New field: sla_priority |
| DispatchRecord | →+ | dispatch_assignment | Low | New fields: resource_quota, region_affinity (§52-§53) |
| AgentExecutionRecord | →⑴⑵⑶⑷⑸ | agent_run + agent_step + tool_invocation + llm_call + agent_decision | High | Observability-driven fine-grained split |

#### Organization & Governance Domain

| Old Entity | Mapping | New Entity | Risk | Notes |
|------------|---------|------------|------|-------|
| ApprovalRecord | →⑴⑵⑶⑷ | decision_record + approval_route + approval_sla + decision_comment | High | Org-structure-aware approval (§47), routing rules change from hardcoded to dynamic |
| OrganizationRecord + TenantRecord | ⇒ | org_node (hierarchical tree) | High | N:1 merge into recursive org tree (§46), tenant becomes top-level org_node |
| HrRoleRecord | →+ | role_assignment | Medium | New fields: delegation_scope, escalation_chain (§51) |
| ComplianceRecord | →+ | compliance_policy | Medium | New fields: department_scope, geo_region (§49, §52) |

#### Security Domain

| Old Entity | Mapping | New Entity | Risk | Notes |
|------------|---------|------------|------|-------|
| SandboxPolicy | →+ | sandbox_policy | Low | New field: department_override (§49) |
| SecretRecord | → | secret_entry | Low | 1:1 direct |
| AuditRecord | →+ | audit_event | Low | New fields: compliance_tag, retention_policy |

#### Memory & Knowledge Domain

| Old Entity | Mapping | New Entity | Risk | Notes |
|------------|---------|------------|------|-------|
| MemoryRecord | →⑴⑵ | memory_entry + knowledge_document/chunk | High | Needs content classifier to distinguish episodic memory and knowledge artifact |
| KnowledgeDocument | →+ | knowledge_document | Medium | New fields: namespace_id (§50 domain isolation), modality (§69) |
| EmbeddingRecord | → | embedding_vector | Low | 1:1 direct |

#### AI Operations Domain

| Old Entity | Mapping | New Entity | Risk | Notes |
|------------|---------|------------|------|-------|
| ProviderConfig | →+ | provider_config | Low | New field: streaming_error_policy (§15.6) |
| ToolDefinition | →+ | tool_definition | Low | New fields: modality_support, domain_binding |
| PluginManifest | →+ | pack_manifest | Low | Rename + new field: marketplace_metadata (§55) |
| ArtifactRecord | →+ | artifact | Medium | New fields: evidence_chain, compliance_tag, modality |
| FeedbackSignal | →+ | feedback_signal | Low | New field: signal_source_type enum expansion |
| EvalResult | ⇝ | eval_result | Medium | Evaluation framework changed from post-hoc to inline (§17) |

#### Operational Maturity Domain

| Old Entity | Mapping | New Entity | Risk | Notes |
|------------|---------|------------|------|-------|
| SloDefinition | →+ | slo_definition | Low | New field: region_scope |
| AlertRule | → | alert_rule | Low | 1:1 direct |
| ReleaseRecord | →+ | release | Low | New fields: canary_config, rollback_policy extension |
| StabilityScenario | → | rehearsal_scenario | Low | Rename, semantics unchanged |
| EvolutionProposal | →+ | evolution_proposal | Medium | New fields: drift_baseline, behavior_fingerprint (§65) |

### 8.3 New Entity List (No Old System Equivalent — ★)

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
|--------------|--------------|------------|
| 1:1 Direct (→) | ~12 | 14% |
| 1:1 Enrich (→+) | ~22 | 26% |
| 1:N Split (→⑴⑵…) | ~5 | 6% |
| N:1 Merge (⇒) | ~2 | 2% |
| Semantic Redefinition (⇝) | ~3 | 4% |
| New (★) | ~26 | 31% |
| Retired (✕) | ~14 | 17% |
| **Total** | **~84** | 100% |

### 8.5 Data Migration Strategy

The object migration matrix defines "what changes to what," this section defines "how to change." Based on risk level and data volume, three migration modes are employed:

#### Migration Mode Definitions

| Mode | Applicable Scenario | Execution | Downtime Required |
|------|---------------------|-----------|-------------------|
| **One-time offline migration** | Low risk, 1:1 direct/enrich mapping | Write migration script, execute once during maintenance window | Short downtime (minutes) |
| **Dual-write transition** | High risk entity split/merge, business cannot be interrupted | Write to both old + new tables simultaneously, gradually switch reads to new table, deprecate old after verifying consistency | Zero downtime |
| **Lazy migration** | Long-tail low-frequency entities, full migration cost unjustified | Check version on access, upgrade to new format on demand | Zero downtime |

#### Entity Migration Mode Assignment

| Entity | Mapping Type | Migration Mode | Phase | Notes |
|--------|-------------|---------------|-------|-------|
| TaskRecord | →+ | One-time offline | P2 | New fields can have defaults, ALTER TABLE + backfill |
| SessionRecord | →+ | One-time offline | P2 | Same as above |
| WorkerRecord | →+ | One-time offline | P2 | Same as above |
| LeaseRecord | →+ | One-time offline | P2 | Same as above |
| ProviderConfig | →+ | One-time offline | P4 | Same as above |
| SecretRecord | → | One-time offline | P3 | 1:1 rename |
| SloDefinition | →+ | One-time offline | P9 | Same as above |
| **ExecutionRecord** | →⑴⑵⑶⑷⑸ | **Dual-write transition** | P2→P5 | 1:5 split, build new tables P2, start dual-write, switch reads P5 after verification |
| **WorkflowStateRecord** | →⑴⑵⑶⑷ | **Dual-write transition** | P2→P6 | 1:4 split, loop/checkpoint/hibernation separation, switch reads after OAPEFLIR complete |
| **ApprovalRecord** | →⑴⑵⑶⑷ | **Dual-write transition** | P3→P5 | 1:4 split, org approval routing changes, switch reads after Runtime complete |
| **AgentExecutionRecord** | →⑴⑵⑶⑷⑸ | **Dual-write transition** | P5 | 1:5 split, observability-driven |
| **MemoryRecord** | →⑴⑵ | **Dual-write transition** | P7 | Needs content classifier for episodic vs knowledge |
| **OrganizationRecord + TenantRecord** | ⇒ | **Dual-write transition** | P3 | N:1 merge to org_node hierarchical tree, read/write paths fundamentally change |
| **TransitionCommand** | ⇝ | **Dual-write transition** | P5 | Semantic redefinition, command routing fundamentally changes |
| EvalResult | ⇝ | Lazy migration | P6 | Low access frequency, upgrade on access |
| EvolutionProposal | →+ | Lazy migration | P9 | Historical proposals upgrade on access |
| KnowledgeDocument | →+ | Lazy migration | P7 | Existing documents supplement namespace_id on access |

#### Dual-Write Transition Execution Process

```
Phase 1: Create new tables       → CREATE TABLE new_xxx (new schema)
Phase 2: Enable dual-write        → Write to both old_xxx + new_xxx simultaneously
Phase 3: Shadow reads             → Read both tables simultaneously, compare results, log differences
Phase 4: Switch primary read      → Primary read switches to new_xxx, old_xxx becomes secondary
Phase 5: Verification period     → Run ≥1 full Phase cycle, confirm zero differences
Phase 6: Deprecate old table      → DROP TABLE old_xxx
```

Each dual-write entity must have an assigned owner, and Phase exit criteria must include "dual-write consistency verification passed."

---

## 9. High-Risk Special: storage / AuthoritativeTaskStore Split

### 9.1 Current State Analysis

`AuthoritativeTaskStore` (`src/core/storage/authoritative-task-store.ts`) is the global data access facade of the current system:

| Metric | Value |
|--------|-------|
| Public method count | ~278 domain methods + 27 structural properties = ~305 public surface |
| Underlying Repository count | 21 (task, workflow, execution, session, event, worker, approval, billing, lease, lock, memory, artifact, dispatch, division, secret, marketplace, release, organization, intelligence, evolution, operations) |
| Consumer file count | ~123 source files directly depend (with tests 200+) |
| Code lines | 101 files / 26,102 lines in directory |

**Core Problem**: God object anti-pattern — single class bears data access responsibility for 21 domains, causing any storage layer change to impact the entire system.

### 9.2 Split Target Modules (7 Bounded Contexts)

| # | Bounded Context | Method Count | Contained Repositories | Split Strategy |
|---|----------------|--------------|------------------------|----------------|
| 1 | **Core Task Engine** | ~73 | task, workflow, execution, session | Retain as core — high inter-method coupling, not suitable for further split |
| 2 | **Worker Infrastructure** | ~47 | worker, dispatch, lease, lock | Extract — scheduling/lease/worker lifecycle are independent domains |
| 3 | **Event Infrastructure** | ~24 | event | Extract — event bus already has clear boundaries |
| 4 | **Billing & Cost** | ~29 | billing | Extract — billing logic decoupled from core execution |
| 5 | **Governance & Compliance** | ~50 | approval, organization, secret, compliance, operations | Extract — org governance independent domain (aligns with v2.7 Layer 5) |
| 6 | **Platform & Commerce** | ~47 | marketplace, release, division, intelligence, evolution | Extract — platform operations independent domain (aligns with v2.7 Layer 6-7) |
| 7 | **Memory & Artifacts** | ~10 | memory, artifact | Extract — knowledge/memory independent domain (aligns with v2.7 Layer 4) |

### 9.3 Split Execution Plan

**Prerequisite**: AuthoritativeTaskStore internally delegates via named Repositories, split infrastructure already in place, only need to migrate consumers.

| Step | Action | Est. Effort | Risk |
|------|--------|-------------|------|
| S1 | Define TypeScript interfaces (Repository contracts) for 7 bounded contexts | 2 person-days | Low |
| S2 | Implement facade adapter — AuthoritativeTaskStore temporarily delegates to new interfaces, maintaining backward compatibility | 3 person-days | Low |
| S3 | Migrate consumers module by module: replace `store.xxx()` calls with corresponding Repository interface injection | 8 person-days | Medium — each consumer needs verification |
| S4 | Remove AuthoritativeTaskStore facade, register each bounded context independently to ServiceRegistry | 2 person-days | Medium |
| S5 | Update all unit test/integration test store mocks | 3 person-days | Medium |
| S6 | Run full regression + stable-* rehearsals for verification | 2 person-days | Low |
| **Total** | | **~20 person-days** | |

### 9.4 Migration Order Recommendation

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
|--------|-------|
| File count | 101 .ts files |
| Code lines | 30,348 lines |
| Identified bounded contexts | 12 |

### 10.2 Bounded Context Decomposition

| BC# | Bounded Context | Files | Lines | Internal Dependencies | Can Extract Independently |
|-----|------------------|-------|-------|----------------------|---------------------------|
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
| BC11 | Infrastructure | 13 | 2,498 | 0 | Yes — utility classes |
| BC12 | HITL & Governance | 2 | 1,166 | 0 | **Yes — zero internal dependencies** |

### 10.3 Extraction Wave Plan

| Wave | Extraction Target | Lines | Percentage | Risk | Verification Point |
|------|-----------------|-------|------------|------|-------------------|
| **Wave 1** (Zero risk) | BC3 Worker + BC5 HA + BC6 Hot Upgrade + BC8 State Transition | 6,136 | 20% | Low — zero internal dependencies | Each BC unit test independently passes |
| **Wave 2** (Low risk) | BC2 Lease + BC9 Agent Execution + BC12 HITL + BC11 Infrastructure | 6,461 | 21% | Low — ≤1 dependency | lease/agent integration tests pass |
| **Wave 3** (Medium risk) | BC4 Handshake/Writeback + BC7 Recovery | 5,678 | 19% | Medium — multiple dependencies | recovery rehearsal scenarios pass |
| **Wave 4** (Wrap-up) | BC1 Dispatch + BC10 Orchestration remain as runtime/ core | 5,171 | 17% | Low — reorganization only | npm test full pass |

### 10.4 Estimated Effort

| Action | Effort |
|--------|--------|
| BC interface definition (12) | 3 person-days |
| Wave 1 extraction + tests | 4 person-days |
| Wave 2 extraction + tests | 5 person-days |
| Wave 3 extraction + tests | 5 person-days |
| Wave 4 wrap-up + full regression | 3 person-days |
| **Total** | **~20 person-days** |

### 10.5 Alignment with New Architecture

| Extracted Module | v2.7 Target Section | New Capabilities |
|-----------------|---------------------|------------------|
| Worker Management | §53 Resource competition | Fair scheduling, priority queue |
| HA Coordinator | §31 Disaster recovery | Multi-region leader election (§52) |
| State Transition | §9 State machine | Extended state set (hibernation/delegation) |
| Agent Execution | §13 OAPEFLIR | §42 Autonomy assessment phase |
| HITL & Governance | §21 HITL | §47 Org approval routing |
| Lease Management | §31 Lease | §54 SLA-tiered lease priority |

---

## 11. New Module Priority and Dependency Graph

### 11.1 Priority Classification

24 modules completely absent from old system, need all-new development in new platform, divided by business blocking relationships into P0/P1/P2:

| Priority | Meaning | Count |
|----------|---------|-------|
| **P0 — Foundation capabilities** | Without these, new platform cannot be distinguished from old system, blocks upper-layer modules | 6 |
| **P1 — Core differentiation** | Key capabilities of new platform, but does not block P0 module porting | 10 |
| **P2 — Operational enhancement** | Nice-to-have, can be delivered gradually after platform stabilizes | 8 |

### 11.2 P0 Foundation Capabilities (6)

| Module | v2.7 Section | Dependencies | Notes |
|--------|--------------|--------------|-------|
| `core/org-hierarchy/` | §46 | None | Org hierarchy model is foundation for §47-§51, develop first |
| `core/nl-entry/` | §39 | None | Natural language entry is new platform's core interaction pattern |
| `core/goal-decomposition/` | §40 | nl-entry | Goal decomposition engine depends on NL intent parsing |
| `core/autonomy/` | §42 | org-hierarchy | Autonomy model depends on org trust chain |
| `core/sso-scim/` | §48 | org-hierarchy | SSO/SCIM depends on org model |
| `core/emergency-brake/` | §60 | None | Emergency brake is security foundation, can develop independently |

### 11.3 P1 Core Differentiation (10)

| Module | v2.7 Section | Dependencies | Notes |
|--------|--------------|--------------|-------|
| `core/proactive-agent/` | §41 | autonomy, nl-entry | Proactive agent needs autonomy and NL capabilities |
| `core/agent-lifecycle/` | §61 | autonomy | Unified lifecycle depends on autonomy level |
| `core/explainability/` | §59 | agent-lifecycle | Explainability depends on lifecycle events |
| `core/multi-region/` | §52 | org-hierarchy | Multi-region depends on org topology |
| `core/resource-scheduler/` | §53 | multi-region | Resource scheduler depends on Region configuration |
| `core/sla/` | §54 | org-hierarchy, resource-scheduler | SLA depends on org + resources |
| `core/drift-detection/` | §65 | agent-lifecycle | Drift detection depends on behavior baseline |
| `core/dashboard/` | §43 | org-hierarchy | Dashboard depends on org views |
| Extend `core/approvals/` | §47 | org-hierarchy | Org approval routing |
| Extend `core/compliance/` | §49 | org-hierarchy | Department-level compliance |

### 11.4 P2 Operational Enhancement (8)

| Module | v2.7 Section | Dependencies | Notes |
|--------|--------------|--------------|-------|
| `gateway/user-portal/` | §44 | nl-entry, dashboard | Non-technical user UX |
| `core/marketplace/` | §55 | agent-lifecycle | Marketplace ecosystem |
| `core/edge-runtime/` | §64 | multi-region | Edge/offline deployment |
| `core/cost-attribution/` | §66 | sla, org-hierarchy | Cost attribution optimization |
| `core/debug-ui/` | §67 | explainability | Visual debugging |
| `core/compliance-report/` | §68 | compliance | Compliance report auto-generation |
| `core/multimodal/` | §69 | None | Multimodal capabilities |
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

### 12.1 Porting Principles

1. **Port Green direct items first**: Zero modification cost, quickly establish new platform code foundation
2. **Port in dependency order**: Shared Kernel → Infrastructure → Security → AI Ops → Runtime → OAPEFLIR → Interaction → Domain → Maturity → CLI
3. **Run corresponding tests after each Phase port completes**: Ensure no regression introduced
4. **Port documentation and code synchronously**: Move contracts/ADRs corresponding to each code Phase together
5. **Develop new features and port in parallel**: Porting team and new feature team can work simultaneously

### 12.2 Dual-Track Migration Strategy

"Porting and new feature development in parallel" requires clear lane division and intersection rules, otherwise they easily block each other.

#### Lane A: Migration Lane

| Responsibility | Content |
|----------------|---------|
| P0-P10 code migration | Execute per §6 ten-phase roadmap |
| storage split | §9 AuthoritativeTaskStore 4-wave split |
| runtime split | §10 runtime 4-wave split |
| Test regression | Each Phase exit gates (§13) |
| Contract/documentation migration | Synchronize with code Phase |
| Data migration scripts | Dual-write/offline migration for high-risk entities in §8 |

#### Lane B: New Capabilities Lane

| Responsibility | Content |
|----------------|---------|
| P0 Foundation | org-hierarchy / nl-entry / goal-decomposition / autonomy / sso-scim / emergency-brake |
| P1 Differentiation | proactive-agent / agent-lifecycle / explainability / multi-region / resource-scheduler / sla / drift-detection / dashboard / approval routing extension / department compliance extension |
| P2 Enhancement | user-portal / marketplace / edge-runtime / cost-attribution / debug-ui / compliance-report / multimodal / self-ops-agent |

#### Intersection Points and Dependency Rules

| Intersection | Migration Lane Prerequisites | New Capabilities Lane Action | Strategy |
|--------------|------------------------------|------------------------------|----------|
| **org-hierarchy integration** | P3 Security complete (hr/approvals migrated) | org-hierarchy module connects to migrated hr/approvals via adapter | New capabilities lane can develop with **stub interface** first, replace with real implementation after P3 completes |
| **autonomy integration** | P5 Runtime complete (state machine migrated) | autonomy module connects to migrated state-transition BC | New capabilities lane defines StateTransition interface stub first, integrates after P5 Wave 1 completes |
| **nl-entry integration** | P4 AI Ops complete (providers migrated) | nl-entry uses migrated LLM provider | New capabilities lane can develop with mock provider first, switch after P4 completes |
| **agent-lifecycle integration** | P6 OAPEFLIR complete | agent-lifecycle extends OAPEFLIR loop | Must wait for P6 complete, cannot stub |
| **multi-region integration** | P5 Runtime complete (HA/dispatch extracted) | multi-region extends extracted HA Coordinator | Must wait for P5 Wave 1 complete |
| **Knowledge domain isolation** | P7 Interaction complete (knowledge migrated) | §50 Knowledge domain isolation extends knowledge module | Must wait for P7 complete |

#### Stub Strategy

Modules that can be stubbed first then integrated (new capabilities lane can start early):
- `org-hierarchy` — stub `OrgNodeRepository` interface, return single-layer org
- `autonomy` — stub `AutonomyGate`, return LEVEL_1 (lowest autonomy) by default
- `nl-entry` — stub `IntentClassifier`, pass through original text
- `emergency-brake` — stub `BrakeService`, do not brake by default

Modules that must wait for migration complete before integration (hard dependencies):
- `agent-lifecycle` — depends on complete OAPEFLIR loop (P6)
- `multi-region` — depends on real HA Coordinator (P5)
- `drift-detection` — depends on real behavior baseline data (P9)
- `self-ops-agent` — depends on complete platform capabilities (after P10)

### 12.3 Porting Checklist

For each module port, complete the following:

- [ ] Copy source files to corresponding directory in new project
- [ ] Update import paths (if changed due to seven-layer directory reorganization)
- [ ] Synchronously copy `tests/unit/<module>/` and `tests/unit/core/<module>/` to new project
- [ ] Synchronously copy `tests/integration/<module>/` to new project
- [ ] Run unit tests for that module, confirm all pass
- [ ] Run related integration tests, confirm all pass
- [ ] If golden tests involve that module, update snapshots and verify
- [ ] If e2e tests involve that module, verify end-to-end flow passes
- [ ] If performance tests involve that module, verify performance baseline met
- [ ] Update contract document references (§ numbers) for the module
- [ ] Register in new platform's module-inventory
- [ ] Confirm zero TypeScript compilation errors
- [ ] Run `npm run test:unit` for full regression

### 12.4 NOT Migrating List

The following content is **explicitly NOT migrated**, archived only:

| Content | Reason |
|---------|--------|
| All of `doc/archive/` | Historical archive |
| 9 White D files in `doc/reference/` | Replaced by v2.7 |
| `doc/automatic_agent_platform/agent_platform.md` (92K lines) | Unexpurged old version, replaced by v2.7 (6.7K lines) |
| Intermediate translation fragment files in `doc/automatic_agent_platform/` | chunk_b-j, part1-6 are translation intermediate products |
| 6 White D files in `doc/reviews/` | Old reviews |
| 10 White D contracts in `doc/contracts/` | Early v1.x contracts |

---

## 13. Phase Entry and Exit Criteria

Each porting Phase must meet clear Definition of Ready (entry) and Definition of Done (exit). Cannot proceed to next Phase if criteria not met.

| Phase | Entry Criteria | Exit Criteria (Definition of Done) |
|-------|----------------|------------------------------------|
| **P0 Test Helpers** | New project repo initialized, tsconfig/eslint/package.json in place | All 19 helper files pass `tsc --noEmit`; `createTempWorkspace()` available in new project |
| **P1 Shared Kernel** | P0 exit criteria met | types/errors/constants/utils/results/lifecycle all compile; 38 unit tests all green; zero external runtime dependencies |
| **P2 Infra Foundation** | P1 exit criteria met | storage/events/config/locking/queue/cache compile; 180 unit tests + related integration tests all green; SQLite migration ledger integrity verified; `npm run test:unit` full regression green |
| **P3 Security** | P2 exit criteria met | security/approvals/cost/compliance/hr compile; 115 tests green; 64 security boundary integration tests all pass (including sandbox escape/path traversal/SSRF rejection paths) |
| **P4 AI Ops** | P2 exit criteria met | providers/tools/workflow/artifacts compile; 100 tests green; Provider CircuitBreaker integration tests pass |
| **P5 Runtime** | P2+P3+P4 exit criteria met | runtime 12 BCs extracted per wave; 150 tests green; all stable-* rehearsal scenarios pass; dispatch/lease/recovery integration tests pass |
| **P6 OAPEFLIR** | P4+P5 exit criteria met | agent-loop/planning/feedback/learning/evaluation/improvement compile; 56 tests green; OAPEFLIR 8-stage full loop E2E passes |
| **P7 Interaction** | P5+P6 exit criteria met | memory/knowledge/messages/gateway compile; 70 tests green; session→memory→retrieval end-to-end passes |
| **P8 Business Domain** | P2+P7 exit criteria met | domain-registry/divisions/plugins compile; 40 tests green; at least 1 division end-to-end loads successfully |
| **P9 Maturity** | P5 exit criteria met | observability/ops/stability/evolution/reliability/product/deployment compile; 165 tests green; health check + SLO alerting integration tests pass |
| **P10 CLI + E2E** | All P1-P9 exit criteria met | CLI 78 entries compile; 10 E2E tests green; 8 golden test snapshots match; 6 performance tests meet baseline; `npm test` full regression green; `npm run build` produces dist/ successfully |

### 13.1 Module-Level Deliverable Acceptance Template

Phase DoD defines phase-level gate, but each **module** must deliver the following 5 items upon completing migration. Incomplete items cannot mark module as "complete":

| Deliverable | Content | Acceptance Criteria |
|-------------|---------|---------------------|
| **Code** | Ported source code, placed in new project target directory | `tsc --noEmit` zero errors; import paths updated; no references to old project paths |
| **Contracts** | interface/schema/contract document updates | New adapter interfaces have JSDoc; if DB schema changes involved, migration file created |
| **Tests** | unit + integration + (if applicable) e2e regression | All tests for that module green; new adapters have corresponding unit tests |
| **Documentation** | module-inventory registration + contract references (§ numbers) updated | Module name/file count/lines/owner registered in new platform module-inventory.md |
| **Migration Notes** | Compatibility/breaking changes record | Record: (1) Interface change list (2) Deprecated APIs (3) New dependencies (4) Configuration item changes |

**Template Example** (using `core/events/` as example):

```
Module: core/events/
Phase: P2
Deliverable Check:
  [x] Code: 8 files migrated to new-project/src/core/events/, tsc passes
  [x] Contracts: New 8 event namespace interfaces (delegation.*/hibernation.*/...)
  [x] Tests: 10 unit tests + 2 integration tests all green
  [x] Documentation: module-inventory registered, contract references updated to v2.7 §28
  [x] Migration Notes: Breaking change — EventBus.emit() signature adds namespace parameter
```

### 13.2 Regression Gates

Upon each Phase exit, run:

1. `tsc --noEmit` — zero compilation errors
2. `npm run test:unit` — all unit tests green
3. `npm run test:integration` subset for that Phase — green
4. `npm run build` — dist/ can be generated

### 13.3 Block Upgrade Rules

- When any Phase exit criteria not met, that Phase is marked **BLOCKED**
- BLOCKED Phase's downstream Phases cannot start
- After fix, must re-run complete exit verification

---

## 14. Migration Freeze Line

During migration, the following technology stack is **frozen unchanged** to avoid introducing extra uncertainty:

| Frozen Item | Current Version/Selection | Freeze Reason |
|-------------|---------------------------|---------------|
| **Test framework** | Node.js 22 built-in `node:test` + `assert/strict` | 1,069 test files depend on it, switching framework equals rewrite |
| **Module system** | TypeScript ESM (`.js` extension imports) | Full ESM, switching CJS affects all imports |
| **Database backend** | SQLite (Phase 1-2) + PostgreSQL (optional) | storage layer 101 files + all test fixtures based on SQLite |
| **CLI framework** | Direct `process.argv` parsing + 78 thin scripts | CLI is thin wrapper of services, changing framework brings no benefit |
| **Observability stack** | OpenTelemetry + Prometheus + StructuredLogger | 36 observability files + SLO alerting depend on it |
| **Configuration validation** | Zod schema | 27 config files + 8-layer configuration governance depend on it |
| **Package manager** | npm | CI workflow + scripts depend on it |

### 14.1 Freeze Line Change Process

If a freeze item must be changed:

1. Submit ADR explaining change reason and impact scope
2. Assess affected file count and test count
3. Obtain architecture owner approval
4. Change must be completed on independent branch, not interleaved with porting work

---

## 15. Effort Estimation and Assumptions

### 15.1 Effort Breakdown

| Work Item | Person-days | Notes |
|-----------|-------------|-------|
| P0-P1 File move + compilation fix | 2 | Zero-modification modules |
| P2 Infra (including storage split §9) | 27 | storage split 20 person-days + remaining infra 7 person-days |
| P3 Security | 4 | Security test verification is main work |
| P4 AI Ops | 5 | providers/tools adapter writing |
| P5 Runtime (including runtime split §10) | 30 | runtime split 20 person-days + integration verification 10 person-days |
| P6-P8 OAPEFLIR + Interaction + Domain | 10 | Mostly adaptation work |
| P9 Maturity | 7 | observability/ops/stability |
| P10 CLI + E2E + Full regression | 8 | E2E transformation + golden update + performance verification |
| Buffer (20%) | 7 | Unforeseen compatibility issues |
| **Porting Total** | **~100 person-days** | |

### 15.2 Assumptions

1. 1 person-day = 8 hours effective development time
2. Team has TypeScript ESM + Node.js 22 experience
3. storage/runtime split can each have 1 dedicated person
4. Porting and 24 new module developments **in parallel**, new module development effort not included in this estimate
5. Excludes environment setup, CI configuration, code review and other management overhead
6. v1.0's 48 person-days is pure file movement scope (copy + import fix), does not include god object split, adapter writing, E2E test transformation

---

## Appendix A: Porting Quantification Statistics

| Metric | Value |
|--------|-------|
| **Source code** | |
| Total source file count | 799 |
| Total source lines | ~174,585 |
| Green Direct port code modules | 18 modules (~27K lines) |
| Yellow Transform port code modules | 25 modules (~147K lines) |
| Blue Reference-only code modules | 3 modules (~8.9K lines) |
| **Tests** | |
| Total test files | 1,069 |
| Total test lines | ~229,196 |
| Green Direct port tests | ~903 files (~192K lines) |
| Yellow Transform port tests | ~145 files (~34K lines) — storage/runtime/CLI/security/recovery/e2e |
| Blue Reference-only tests | ~17 files (~3K lines) — soak tests + performance.bak |
| Test infrastructure (helpers) | 19 files / 2,093 lines — 16 Green + 3 Yellow |
| **Documentation** | |
| Total documentation files | ~243 |
| Green Direct port documentation | ~48 files |
| Yellow Transform port documentation | ~74 files |
| Blue Reference documentation | ~84 files |
| White Archive/retire documentation | ~37 files |
| **Other assets** | |
| config/ directory | 27 JSON files — all direct port |
| divisions/ directory | 11 division definitions — Yellow transform (need DomainDescriptor semantic model adaptation) |
| **New development** | |
| Modules needing all-new development in new platform | 24 modules (missing from old system in v2.7 §39-§70) |
| **Total** | |
| Total files to port | ~1,868 (source 799 + tests 1,069) |
| Total lines to port | ~406K (source ~177K + tests ~229K) |
| Estimated total porting effort | **~70-100 person-days** (including tests, storage/runtime split transformation, adapter writing; excluding 24 new feature module development. v1.0's 48 person-days is pure file movement scope, not including god object split, interface adaptation, E2E test transformation) |
