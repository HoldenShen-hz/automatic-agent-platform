# Old System to New Platform Portability Assessment Document

> **Document Version**: v1.1
> **Document Status**: Draft
> **Assessment Scope**: `docs_zh/` (excluding `docs_zh/automatic_agent_platform/`) + `src/` + `config/` + `divisions/` + `tests/`
> **Target System**: "Enterprise Agent Platform Overall Technical Architecture Design Document" v2.7 (1-70, seven-layer architecture)
> **Assessment Date**: 2026-04-19

---

## 1. Assessment Purpose

The old system (automatic-agent-system-main) has **797 source files / 174,585 lines of code** and **200+ document files**. The new platform architecture design document v2.7 defines a seven-layer enterprise architecture. This document answers:

1. **Which doc files** can be directly ported, adaptively ported, or archived?
2. **Which code modules** can be directly ported, adaptively ported, or need rewriting?
3. **What is the portability priority and recommended execution order?**

---

## 2. Assessment Methodology

### 2.1 Portability Level Definitions

| Level | Tag | Meaning | Typical Adaptation Range |
|------|------|------|-------------|
| **A1 — Complete Direct Port** | Green | Zero modification, copy and use. Interface, naming, dependencies all compatible with new architecture | 0 — Copy only + import path update |
| **A2 — Implementation Directly Reusable But Requires Adapter** | GreenWrench | Core implementation unchanged, needs adapter/wrapper to align with new architecture extension points | 15% or less — Add adapter layer or supplement missing interface |
| **B — Adaptive Port** | Yellow | Core logic reusable but needs adaptation to new architecture interface/naming/layering | 15%-50% — Interface refactoring + dependency replacement |
| **C — Reference Value** | Blue | Not directly portable, but design thinking/test cases/competitor analysis have reference value | N/A — Reference only, do not move code |
| **D — Archive and Deprecate** | White | Outdated or replaced by new design, keep only for historical archive | N/A — Archive |

### 2.2 Five-Dimensional Assessment Template

Each module/document's level determination must provide evidence across five dimensions:

| Dimension | Meaning | Scoring Standard |
|------|------|---------|
| **Architecture Alignment** | Alignment with v2.7 target architecture interface/layering | High=interface directly aligned / Medium=needs adapter / Low=interface needs rewriting |
| **Dependency Pollution** | Coupling degree to external modules, affecting independent portability | Low=2 or fewer direct dependencies / Medium=3-5 / High=6 or more or circular dependencies |
| **Interface Stability** | Expected changes to public API during migration | High=unchanged / Medium=expanded but compatible / Low=breaking changes |
| **Test Coverage** | Existing tests' coverage of core behavior | High=full behavior coverage / Medium=main path coverage / Low=insufficient coverage |
| **Adaptation Scope** | Proportion of code needing changes relative to total module size | Small=15% or less / Medium=15%-50% / Large=50% or more |

**Decision Rules**:
- **A1**: All five dimensions are "High/Low/High/High/Small"
- **A2**: Architecture alignment Medium or higher, adaptation scope 15% or less, but needs new adapter/wrapper
- **B**: Core reusable but at least one dimension is "Low" or adaptation scope exceeds 15%
- **C**: Architecture alignment is "Low" and adaptation scope is 50% or more
- **D**: Explicitly replaced or deprecated by v2.7

### 2.3 New Architecture Seven-Layer Mapping

```
Layer 7 │ Operational Maturity Layer (explainability, emergency brake, lifecycle, edge, drift, cost, debugging, compliance, capacity, multimodal, self-ops)
Layer 6 │ Scale Operation Layer + Ecosystem (multi-region, resource competition, SLA, marketplace, feedback, integration)
Layer 5 │ Organization Governance Layer (org hierarchy, approval routing, SSO, compliance, knowledge isolation, delegation)
Layer 4 │ Intelligent Interaction Layer (NL entry, goal decomposition, proactive agent, autonomy, dashboard, UX)
Layer 3 │ Business Domain Access Layer (DomainDescriptor, Recipe, Runbook)
Layer 2 │ AI Operations Layer (LLM abstraction, Prompt, Eval, Cost, HITL, SDK)
Layer 1 │ Infrastructure Layer (five-plane, stability, risk, security, recovery, audit)
```

---

## 3. Overview Matrix

### 3.1 Document Portability Overview

| Category | Files | Green Direct | Yellow Adaptive | Blue Reference | White Archive |
|------|--------|---------|---------|---------|---------|
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

### 3.2 Code Portability Overview

| Architecture Layer | Module | Files | Lines | Green | Yellow | Blue | White |
|--------|------|--------|------|-----|-----|-----|-----|
| Layer 1 Infrastructure | types, errors, storage, events, config, cache, locking, queue, api, lifecycle, constants, utils, resource, results | ~230 | ~50K | 8 modules | 5 modules | 1 module | 0 |
| Layer 2 AI Operations | runtime, agent-loop, planning, tools, providers, workflow, orchestration, artifacts, feedback, learning, evaluation | ~230 | ~58K | 3 modules | 7 modules | 1 module | 0 |
| Layer 3 Business Domain | domain-registry, divisions, plugins | ~38 | ~5.7K | 2 modules | 1 module | 0 | 0 |
| Layer 4 Intelligent Interaction | memory, knowledge, messages, gateway | ~54 | ~10.7K | 1 module | 3 modules | 0 | 0 |
| Layer 5 Organization Governance | security, approvals, compliance, cost, hr | ~28 | ~8.6K | 2 modules | 3 modules | 0 | 0 |
| Layer 6 Scale Operation | deployment, improvement, product (partial) | ~35 | ~8.4K | 0 | 2 modules | 1 module | 0 |
| Layer 7 Operational Maturity | observability, ops, stability, evolution, reliability | ~106 | ~32.6K | 2 modules | 3 modules | 0 | 0 |
| Cross-layer CLI | cli | 78 | ~6.1K | 0 | 1 (whole) | 0 | 0 |
| **Total** | **43 modules** | **~799** | **~180K** | **18** | **25** | **3** | **0** |

---

## 4. Document Portability Detailed Assessment

### 4.1 Main Documents (docs_zh/architecture/)

| File | Lines | Level | Target Architecture Layer | Portability Notes |
|------|------|------|-----------|---------|
| `00-platform-architecture.md` | ~2,000 | Yellow B | Cross-layer | Document layered governance model (L0-L10) reusable, needs update to seven-layer architecture document system |
| `01-code-structure.md` | ~500 | Yellow B | Layer 1-2 | Directory structure + control-plane role definition reusable, needs alignment with v2.7 1-5 |
| `02-code-architecture-reference.md` | ~800 | Yellow B | Layer 5 | Agent layering, permissions, security model compatible with v2.7 11 security system, needs org governance extension |
| `03-module-diagrams.md` | ~400 | Yellow B | Layer 2,4 | Six-layer module diagram and feedback loop compatible, needs KV cache alignment update |
| `04-runtime-sequence.md` | ~300 | Blue C | Cross-layer | Constraints and anti-pattern list serves as reference for new platform design |

### 4.2 Technical Analysis Documents (docs_zh/analysis/)

| File | Lines | Level | Portability Notes |
|------|------|------|---------|
| `00-architecture-coverage-matrix.md` | ~150 | Yellow B | Coverage matrix, needs update to reflect five-plane module reorganization |
| `01-codebase-vs-design-review.md` | ~2,000 | Yellow B | Code vs. design difference analysis manual |
| `02-implementation-progress-tracker.md` | ~100 | Blue C | Implementation progress tracking as reference |

### 4.3 Architecture and Sequence Diagram Documents

| File | Lines | Level | Portability Notes |
|------|------|------|---------|
| `00-platform-architecture.md` | ~2,000 | Yellow B | Main architecture entry document, SLO quantitative metrics (95%/90%/100%) reusable, needs alignment with v2.7 27 |
| `04-runtime-sequence.md` | ~300 | Yellow B | 4 sets of core runtime sequence diagrams (Intake/Dispatch/Writeback/Recovery) directly portable, needs OAPEFLIR full loop sequence supplement |

### 4.4 Contract Documents (docs_zh/contracts/) — 113 Files

**Direct Port (Green A) — 22 Files**: Contract interfaces defined are fully compatible with the new architecture.

| Contract | Target Architecture Section |
|------|-------------|
| `state_transition_matrix_contract.md` | 9 state machine |
| `event_bus_contract.md` | 4 event bus plane |
| `storage_schema_contract.md` (748 lines) | 26 data model |
| `sandbox_and_auth_contract.md` | 11 security system |
| `tool_skill_plugin_contract.md` | 30 Business Pack |
| `slo_alerting_and_runbook_contract.md` | 27 performance SLO |
| `memory_decay_and_quality_contract.md` | 3.5 memory quality |
| `release_rollout_and_rollback_contract.md` | 32 deployment |
| `runtime_execution_contract.md` | 13 OAPEFLIR |
| `plugin_spi_contract.md` | 30 Plugin |
| `knowledge_spi_contract.md` | 3.4 knowledge plane |
| `ha_coordinator_and_leader_election_contract.md` | 31 disaster recovery |
| Other 10 base contracts | Layer 1 various sections |

**Adaptive Port (Yellow B) — 38 Files**: Core constraints reusable, needs adaptation to new naming/layering/extension points.

| Contract Category | Files | Adaptation Points |
|----------|--------|---------|
| Agent behavior contracts | 8 | Need to add v2.7 42 progressive autonomy + 41 proactive agent constraints |
| OAPEFLIR loop contracts | 5 | Need to extend Plan/Learn/Improve/Rollout stage contract details |
| API contracts | 6 | Need to add 39 NL entry + 44 non-technical user endpoints |
| Billing/tenant contracts | 4 | Need to add 46 org hierarchy + 54 SLA tiering |
| Security/compliance contracts | 5 | Need to add 49 department compliance + 52 GDPR cross-border |
| Others | 10 | Naming and reference updates |

**Reference Value (Blue C) — 20 Files**: Design approach referenceable but interfaces already covered by new design.

**Archive and Deprecate (White D) — 10 Files**: Early v1.x contracts already replaced by v2.7.

### 4.5 ADR (docs_zh/adr/) — 38 Files

**Direct Port (Green A) — 15 Files**:

| ADR | Decision Topic | Target Architecture Section |
|-----|---------|-------------|
| `001-three-layer-architecture.md` | Three-layer architecture | 1 Overall architecture |
| `003-memory-six-layers.md` | Memory layering | 3.5 memory |
| `005-security-model.md` | Security model | 11 security |
| `006-llm-provider-strategy.md` | LLM strategy | 15 provider |
| `012-sqlite-phase-1-2-primary-store.md` | SQLite selection | 26 storage |
| `016-oapeflir-loop-model.md` | OAPEFLIR model | 13 OAPEFLIR |
| `018-rollout-eleven-state-machine.md` | Rollout state machine | 32 deployment |
| `019-agent-handoff-four-layer-protocol.md` | Agent handoff | 19 delegation |
| `020-memory-six-plane-model.md` | Memory six-plane | 3.5 |
| `060-explicit-planning-hub.md` | Planning Hub | 13 OAPEFLIR-P |
| `071-plugin-spi-framework.md` | Plugin SPI | 30 |
| `072-oapeflir-testing-strategy.md` | OAPEFLIR testing | 27 |
| `075-controlled-rollout-release.md` | Controlled release | 32 |
| `078-knowledge-plane-architecture.md` | Knowledge architecture | 3.4 |
| `079-feedback-hub-signals.md` | Feedback signals | 56 |

**Adaptive Port (Yellow B) — 8 Files**: Decisions valid but need extension for seven-layer architecture.

| ADR | Adaptation Points |
|-----|---------|
| `002-division-system.md` | Need to add 46 org hierarchy impact on Division |
| `004-workflow-routing.md` | Need to adapt 40 goal decomposition engine multi-level routing |
| `007-evolution-engine.md` | Need to align with v2.7 65 behavior drift detection |
| `008-cost-model.md` | Need to extend 66 cost attribution optimization |
| `009-deployment-ops.md` | Need to add 64 edge/offline deployment |
| `011-effect-ts-adoption.md` | Need to reassess Effect-TS adoption decision in new platform |
| `013-eventemitter-phase-2-boundary.md` | Need to assess whether Phase 2 continues using EventEmitter |
| `017-knowledge-architecture-refactor.md` | Need to align with v2.7 50 knowledge domain isolation |

**Reference Value (Blue C) — 3 Files**: `010-commercial-model.md`, `014-org-model-code-boundary.md`, `080-learn-hub-pattern-detection.md`

**Archive and Deprecate (White D) — 2 Files**: `015-unified-extension-marketplace.md` (replaced by v2.7 55), early draft ADRs

### 4.6 Governance Documents (docs_zh/governance/) — 7 Files

| File | Level | Portability Notes |
|------|------|---------|
| `source_of_truth.md` | Green A | Data source governance rules directly applicable |
| `change_control.md` | Green A | Change control process directly applicable |
| `naming_and_directory_conventions.md` | Green A | Naming and directory conventions directly applicable |
| `glossary_and_terminology.md` | Green A | Glossary directly applicable, need to supplement v2.7 Appendix G terminology |
| `autonomy_boundary_policy.md` | Yellow B | Need to align with v2.7 42 progressive autonomy model |
| `rollout_release_policy.md` | Yellow B | Need to align with v2.7 32 deployment strategy |
| `phase1_scope_freeze.md` | Yellow B | Need to map to new platform Phase definition |
| `README.md` | Blue C | Navigation file reference |

### 4.7 Guide Documents (docs_zh/guides/) — 4 Files

| File | Level | Portability Notes |
|------|------|---------|
| `quickstart.md` | Green A | Quick start guide directly reusable, update ports/config |
| `contributing.md` | Green A | Contributing guide directly applicable |
| `division-authoring.md` | Yellow B | Need update to reflect v2.7 37 DomainDescriptor |
| `skill-authoring.md` | Yellow B | Need update to reflect v2.7 30 Pack lifecycle |

### 4.8 Operations Documents (docs_zh/operations/) — 16 Files

**Direct Port (Green A) — 5 Files**:

| File | Portability Notes |
|------|---------|
| `runbooks/database-issues.md` | Database issue operations manual directly applicable |
| `runbooks/memory-pressure.md` | Memory pressure handling directly applicable |
| `runbooks/incident-response-playbook.md` | Incident response playbook directly applicable |
| `test_coverage_baseline_gate.md` | Coverage gate rules directly applicable |
| `src_module_test_matrix.md` (1,455 lines) | Module-test mapping matrix, need to update module list but format directly reusable |

**Adaptive Port (Yellow B) — 10 Files**: Phase plans, Roadmap, implementation plans need remapping to seven-phase roadmap.

**Reference/Archive — 15+ Files**: Historical TODOs, old gap analyses, archived plans under archive/.

### 4.9 Review Documents (docs_zh/reviews/) — 1 File

| Level | File | Description |
|------|------|------|
| Yellow B | `test_strategy_plan.md` (1,957 lines) | Test strategy reusable, needs extension for Layer 4-7 |
| Yellow B | `authoritative_task_store_refactoring_plan.md` (1,233 lines) | TaskStore refactoring plan valuable for new platform storage layer |
| Yellow B | `opeli_detailed_design.md` (4,484 lines) | OAPEFLIR detailed design directly corresponds to v2.7 13 |
| Blue C | `production_gap_detailed_solutions.md` (2,590 lines) | Production gap solutions as reference |
| Blue C | `production_gap_solution_v2.md` (2,598 lines) | Same as above v2 |
| Blue C | `design_gap_analysis.md` (2,424 lines) | Design gap analysis as new platform verification checklist |
| Blue C | Other 9 files | Historical review records as reference |
| White D | 6 files | Old reviews already replaced |

### 4.10 Reference Documents (docs_zh/reference/) — 0 Files

| Level | Description |
|------|------|
| Blue C (8 files) | Architecture/module/security/storage/communication chapters mechanically split from old monolith, design approach referenceable |
| White D (9 files) | Old content already fully covered by v2.7, archived |

### 4.11 Research Documents (docs_zh/research/) — 0 Files

| Level | Description |
|------|------|
| Blue C (all 28 files) | Competitor analysis (Claude Code/Codex/Goose/Aider/MetaGPT/LangGraph/Temporal/DeerFlow etc.) and reference alignment reviews. Not directly portable but high reference value for new platform design decisions. Recommend moving entire `docs_zh/research/` directory into new project |

### 4.12 Archive Documents (docs_zh/archive/) — 0 Files

| Level | Description |
|------|------|
| White D (all 3 files) | `automatic-agent-architecture-monolith-dedup.md` (11,392 lines) etc. are historical archives, retained only for audit traceability |

---

## 5. Code Module Portability Detailed Assessment

### 5.1 Layer 1 — Infrastructure Layer

#### Green Direct Port (8 Modules)

| Module | Files/Lines | Target Section | Portability Notes |
|------|---------|---------|---------|
| `core/types/` | 21 / 2,887 | 5 contracts | Branded ID, state enum, 15+ domain record types. Zero external dependencies, TypeScript strict mode. **Port as-is** |
| `core/errors.ts` | 1 / 490 | 10 exceptions | 14-category `AppError` hierarchy + serialization. Zero dependencies. **Port as-is** |
| `core/constants/` | 2 / 16 | Cross-layer | Time constants. **Port as-is** |
| `core/utils/` | 2 / 109 | Cross-layer | BoundedCache utility class. **Port as-is** |
| `core/results/` | 2 / 390 | 5 contracts | ResultEnvelope pattern. **Port as-is** |
| `core/locking/` | 8 / 635 | 31 disaster recovery | Distributed lock abstraction (SQLite/Redis/PG advisory). Clean adapter pattern. **Port as-is** |
| `core/queue/` | 6 / 771 | 4 events | Queue abstraction (SQLite/Redis) + factory. **Port as-is** |
| `core/lifecycle/` | 3 / 276 | 8 extensions | ServiceRegistry + teardown sorting. **Port as-is** |

#### Yellow Adaptive Port (5 Modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|------|---------|---------|---------|
| `core/storage/` | 101 / 26,102 | 26 data model | `AuthoritativeTaskStore` is the global data access facade (god object). Core SQL schema/migration reusable but needs splitting into domain-based Repositories. PG async adapter pattern excellent, retain |
| `core/events/` | 8 / 1,894 | 28 events | 3-tier DurableEventBus design is excellent. Need to add v2.7 28's 8 new event namespaces (delegation.*/hibernation.*/prompt.*/eval.*/cost.*/approval_flow.*/agent_lifecycle.*/circuit_breaker.*) |
| `core/config/` | 27 / 6,776 | 24 config | Zod schema validation + 8-layer config governance reusable. Need to add 46 org hierarchy config + 64 edge deployment config |
| `core/cache/` | 27 / 2,518 | 26 cache | L1/L2/L3 multi-level cache + domain strategy. Need to add 50 knowledge domain isolation cache partition |
| `core/api/` | 30 / 5,006 | 6 API | HTTP server + OIDC/OAuth + WebSocket. Need to add 39 NL entry endpoint + 44 non-technical user API + 48 SSO/SCIM endpoints |

#### Blue Reference Value (1 Module)

| Module | Description |
|------|------|
| `core/resource/` | 2 / 361 | ProcessTracker process tracking logic referenceable, but new platform may use different process management approach |

### 5.2 Layer 2 — AI Operations Layer

#### Green Direct Port (3 Modules)

| Module | Files/Lines | Target Section | Portability Notes |
|------|---------|---------|---------|
| `core/providers/` | 10 / 4,436 | 15 LLM | UnifiedChatProvider (Anthropic/OpenAI/MiniMax) + CircuitBreaker + CredentialPool + ModelRouting. Clean adapter pattern. **A2 Port**: Core implementation unchanged, need to add 15.6 streaming error handling adapter (architecture alignment=medium, adaptation scope=15% or less) |
| `core/workflow/` | 4 / 1,011 | 13 OAPEFLIR | MinimalWorkflow + Validator + OutputSchema + StepRetryPolicy. **Port as-is** |
| `core/artifacts/` | 13 / 1,095 | 30 Pack | Artifact model/storage/version/release/governance/sensitive content scanning. **A2 Port**: Need to add evidence/compliance chain adapter + 69 multimodal artifact + 55 marketplace release interface (architecture alignment=medium, adaptation scope=15% or less) |

#### Yellow Adaptive Port (7 Modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|------|---------|---------|---------|
| `core/runtime/` | 114 / 30,348 | 9,13,31 | **Largest module, highest risk**. ExecutionDispatch/Lease/Worker/HA/Recovery/HotUpgrade core logic reusable. Adaptation points: (1) Split into Dispatch/Lease/Worker/HA/Recovery five independent bounded contexts; (2) Adapt 41 proactive agent scheduling; (3) Add 52 multi-Region dispatch; (4) Add 53 resource competition management |
| `core/agent-loop/` | 31 / 2,562 | 13 OAPEFLIR | OapeflirLoopService + Assessment + Handoff + StageTimeline. Core loop logic complete. Need to add 42 autonomy assessment stage + 59 explainability output |
| `core/planning/` | 9 / 314 | 13 OAPEFLIR-P | PlanBuilder/DAGValidator/StrategySelector. Need to extend 40 goal decomposition engine multi-level decomposition capability |
| `core/tools/` | 36 / 13,500 | 30 tools | CommandExecutor/SkillExecution/ToolSanitizer/PathScope/MCPGuard. Security boundary complete. Need to add 69 multimodal tool support + 37 domain tool registration |
| `core/orchestration/` | 3 / 1,054 | 13 orchestration | IntakeRouter/WorkflowPlanner/AgentTeamService. Need to adapt 39 NL entry + 40 goal decomposition + 46 org hierarchy routing |
| `core/feedback/` | 5 / 532 | 56 feedback | FeedbackCollector/SignalPreprocessor. Need to extend 56 feedback-driven continuous improvement pipeline complete signal types |
| `core/learning/` | 14 / 682 | 13 OAPEFLIR-L | FailurePatternMiner/ExperienceDistillation/StrategyLearning + 4 pattern detectors. Need to add 65 behavior drift detection patterns |

#### Blue Reference Value (1 Module)

| Module | Description |
|------|------|
| `core/evaluation/` | 6 / 1,429 | PostExecutionQualityGate/LlmEvalService logic referenceable, but v2.7 17 defines a more complete model evaluation framework, needs redesign |

### 5.3 Layer 3 — Business Domain Access Layer

#### Green Direct Port (2 Modules)

| Module | Files/Lines | Target Section | Portability Notes |
|------|---------|---------|---------|
| `core/domain-registry/` | 14 / 2,456 | 37 domain modeling | DomainRegistryService/PluginSpiRegistry/ContractRegistry/ToolBundleRegistry/WorkflowRegistry/PluginRuntimeHost. SPI pattern clean. **Port as-is**, need to add DomainDescriptor registration |
| `core/divisions/` | 4 / 1,632 | 37 domain | DivisionLoader + YAML secure loading + HrRoleGovernance. **Port as-is** |

#### Yellow Adaptive Port (1 Module)

| Module | Files/Lines | Target Section | Adaptation Points |
|------|---------|---------|---------|
| `plugins/` | 20 / 1,672 | 30,55 | 16 builtin plugins (6 domains: coding/ops/growth/game-dev/asset-production/livestream). SPI adapter/presenter/retriever/validator/planner pattern reusable. Need to add 55 marketplace ecosystem packaging/release/deprecation lifecycle |

### 5.4 Layer 4 — Intelligent Interaction Layer

#### Green Direct Port (1 Module)

| Module | Files/Lines | Target Section | Portability Notes |
|------|---------|---------|---------|
| `core/messages/` | 2 / 509 | 39 messages | MessageParts + TokenEstimator. **Port as-is** |

#### Yellow Adaptive Port (3 Modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|------|---------|---------|---------|
| `core/memory/` | 16 / 3,335 | 3.5 memory | Layered memory (session/project/user/global) + consolidation/promotion/retrieval/quality. Need to add 50 knowledge domain isolation memory partition + 64 edge deployment local memory cache |
| `core/knowledge/` | 23 / 3,443 | 3.4 knowledge | KnowledgePlane/Ingestion/Embedding/VectorStore/Graph/Retrieval + governance. Need to add 50 knowledge domain isolation + 69 multimodal knowledge indexing |
| `gateway/` | 13 / 3,471 | 6,44 | ChannelGateway (Telegram/Slack/Webhook) + WebSocket + SSE. Need to add 39 NL channel + 44 non-technical user frontend gateway + 57 external system integration gateway |

### 5.5 Layer 5 — Organization Governance Layer

#### Green Direct Port (2 Modules)

| Module | Files/Lines | Target Section | Portability Notes |
|------|---------|---------|---------|
| `core/security/` | 19 / 7,125 | 11 security | SandboxPolicy/PolicyEngine/SecretManagement/AuditIntegrity/FieldEncryption/NetworkEgress/CveIntelligence. **A2 Port**: Core security mechanism unchanged, need to add 49 department-level security policy engine adapter (architecture alignment=medium, adaptation scope=15% or less) |
| `core/cost/` | 2 / 64 | 18 cost | BudgetGuard. Lightweight but complete. **Port as-is**, need to extend 66 cost attribution optimization |

#### Yellow Adaptive Port (3 Modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|------|---------|---------|---------|
| `core/approvals/` | 3 / 495 | 21 HITL | ApprovalService/TimeoutExecutor. Need to add 47 org structure approval routing + multi-party approval/delegation |
| `core/compliance/` | 2 / 346 | 23,68 | AuditExportService. Need to extend 68 compliance report auto-generation + 52 GDPR cross-border |
| `core/hr/` | 2 / 572 | 46 organization | HrRoleGovernanceService. Need to add 46 org hierarchy model + 51 tiered governance delegation |

### 5.6 Layer 6 — Scale Operation Layer

#### Yellow Adaptive Port (2 Modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|------|---------|---------|---------|
| `core/deployment/` | 2 / 502 | 32 deployment | TrafficRoutingService (blue-green/canary). Need to extend 52 multi-Region deployment + 64 edge deployment |
| `core/improvement/` | 11 / 770 | 13 OAPEFLIR-IR | StrategyVersioning/AutonomyBoundary/GuardrailEvaluator/AutoRollback/CanaryRouter/RolloutStateMachine. Need to align with 42 progressive autonomy + 55 marketplace Agent version management |

#### Blue Reference Value (1 Module)

| Module | Description |
|------|------|
| `core/product/` | 22 / 7,109 | BillingService/Marketplace/TenantPlatform/PMF/EnterpriseCapability. Business logic deeply coupled with old system Phase 1-2, needs redesign based on v2.7 54 SLA tiering + 55 marketplace ecosystem |

### 5.7 Layer 7 — Operational Maturity Layer

#### Green Direct Port (2 Modules)

| Module | Files/Lines | Target Section | Portability Notes |
|------|---------|---------|---------|
| `core/observability/` | 36 / 8,172 | 12,27 | StructuredLogger/HealthService/Prometheus/OpenTelemetry/SLO-Alerting/AnomalyDetection. **Port as-is**, need to add 67 visual debugging support |
| `core/reliability/` | 8 / 1,112 | 10 risk | FailureClassification/RepairPipeline/PatchBundle/TaskCard. **Port as-is** |

#### Yellow Adaptive Port (3 Modules)

| Module | Files/Lines | Target Section | Adaptation Points |
|------|---------|---------|---------|
| `core/ops/` | 19 / 8,308 | 12,32 | DoctorService/OpsGovernance/EnterpriseGovernance/ReleasePipeline/HumanTakeover/AutoStopLoss. Need to add 60 emergency brake + 70 platform self-ops Agent |
| `core/stability/` | 31 / 12,789 | 27,32 | 20+ stability rehearsal scenarios + evidence bundling. Need to add 64 edge deployment rehearsal + 65 drift detection rehearsal |
| `core/evolution/` | 12 / 2,268 | 65 drift | EvolutionMVP/Reflection/Proposal/Benchmark/Rollout. Need to align with 65 behavior drift detection + 61 unified lifecycle management |

### 5.8 Cross-Layer — CLI

#### Yellow Adaptive Port (Whole)

| Module | Files/Lines | Adaptation Points |
|------|---------|---------|
| `cli/` | 78 / 6,149 | 78 CLI entry points are thin wrapper layers, depend on underlying services. Portability strategy: **Port synchronously with service portability**. Need to add 39 NL CLI entry + 43 operations dashboard CLI + 46 org management CLI |

### 5.9 Auxiliary Assets

#### config/ — Green Direct Port

| Directory | Files | Portability Notes |
|------|--------|---------|
| `config/bootstrap/` | 1 | Phase configuration directly reusable |
| `config/runtime/` | 6 | Runtime configuration (including 5 environment variants) directly reusable |
| `config/security/` | 6 | Security configuration directly reusable |
| `config/providers/` | 3 | Provider + model metadata directly reusable |
| `config/environments/` | 5 | Environment configuration directly reusable |
| `config/plugins/` | 1 | Plugin configuration directly reusable |
| `config/domains/` | 1 | Domain configuration directly reusable, need to extend DomainDescriptor |
| `config/gateways/` | 1 | Gateway configuration directly reusable |
| `config/workflows/` | 1 | Workflow configuration directly reusable |
| `config/knowledge/` | 1 | Knowledge configuration directly reusable |
| `config/product/` | 1 | Product configuration directly reusable |

#### divisions/ — Yellow Adaptive Port

| Content | Portability Notes |
|------|---------|
| 11 division definitions (including YAML + roles/ + workflows/ + schemas/) | Yellow downgrade reason: v2.7 37 DomainDescriptor semantic model has breaking changes to division YAML structure, need to add descriptor metadata fields, domain capability declarations, SLA bindings. YAML schema changes affect all 11 definition files |

#### tests/ — See 5.10 Test Portability Detailed Assessment

#### Infrastructure Files — Green Direct Port

| File | Portability Notes |
|------|---------|
| `package.json` | Dependency declarations and 110+ npm scripts directly reusable, need to clean up unneeded scripts |
| `tsconfig.json` / `tsconfig.build.json` | TypeScript strict configuration directly reusable |
| `eslint.config.js` | ESLint 9 flat config directly reusable |
| `.c8rc.json` | Coverage configuration directly reusable |
| `Dockerfile` | Multi-stage build directly reusable, need to add edge deployment variant |
| `docker-compose.yml` | Three-service orchestration directly reusable, need to add Redis cluster variant |
| `.env.example` | 346-line environment variable template directly reusable, need to add Layer 4-7 configuration items |
| `.github/workflows/` | 4 CI workflows directly reusable |
| `scripts/` | CI/build scripts directly reusable |
| `deploy/` | Deployment manifests directly reusable |

### 5.10 Test Portability Detailed Assessment

> **Test Total Scale**: 1,069 files / ~229,196 lines

#### Test Infrastructure Dependencies

| Dependency | Description | Portability Impact |
|------|------|---------|
| Node.js 22 built-in test runner | `import test from "node:test"` + `assert/strict` | Green no migration cost, new platform continues to use |
| SQLite (DatabaseSync) | Almost all tests create temp DB via `SqliteDatabase` | Yellow need to ensure new platform retains SQLite test backend |
| TypeScript ESM | All uses `.js` extension ESM imports | Green new platform continues ESM |
| Hand-written Mocks (no external mock library) | `typed-factories.ts` + deterministic bridge pattern | Green zero external dependencies, directly portable |
| PostgreSQL (optional) | Only `pg-test-helper.ts` and few storage tests, need `AA_TEST_PG_DSN` env var | Green optional dependency, does not affect main flow |
| Temporary filesystem workspace | `createTempWorkspace()` / `cleanupPath()` | Green directly portable |

#### 5.10.1 tests/helpers/ — 19 files / ~2,093 lines

| File | Lines | Level | Purpose | Portability Notes |
|------|------|------|------|---------|
| `fs.ts` | 21 | Green A | Temp workspace create/cleanup | Almost all tests depend on this, **port first** |
| `seed.ts` | 100 | Green A | Database seed data (seedTaskAndExecution) | E2E/golden/integration dependency |
| `typed-factories.ts` | 143 | Green A | Type-safe mock factories (createPartial/unsafeCast) | Widely used |
| `env.ts` | 53 | Green A | Environment variable save/restore | Config/CLI test dependency |
| `golden.ts` | 80 | Green A | Golden snapshot assertions (supports UPDATE_GOLDEN=1) | Golden test dependency |
| `e2e-harness.ts` | 131 | Green A | E2E test harness (SQLite + Store + Workspace) | E2E test dependency |
| `integration-context.ts` | 131 | Green A | Integration test context | Integration test dependency |
| `repository-harness.ts` | 80 | Green A | Repository test harness | Storage unit test dependency |
| `concurrent-runner.ts` | 158 | Green A | Concurrent operation runner + invariant checks | Concurrent test dependency |
| `test-cleanup.ts` | 27 | Green A | Singleton reset + process cleanup | Tests requiring isolation dependency |
| `process-guard.ts` | 90 | Green A | Process leak detection | Runtime/Tool test dependency |
| `fixtures/base.ts` | 99 | Green A | Minimal valid record factory | Unit test dependency |
| `fixtures/composite.ts` | 227 | Green A | Complex multi-entity state factory | Integration test dependency |
| `perception.ts` | 66 | Green A | Perception dataset seed | Product test dependency |
| `pmf.ts` | 251 | Green A | PMF validation dataset seed | PMF test dependency |
| `billing.ts` | 36 | Green A | Billing dataset seed | Billing test dependency |
| `api.ts` | 362 | Yellow B | HTTP API full-stack bootstrap | Need to adapt to new API layer |
| `cli.ts` | 30 | Yellow B | CLI script runner | Need to adapt to new CLI path |
| `pg-test-helper.ts` | 35 | Yellow B | PostgreSQL test helper | Need to adapt to new PG configuration |

#### 5.10.2 tests/unit/ — 758 files / ~169,943 lines

Portability assessment grouped by source module:

| Source Module | Test Files | Test Lines | Level | Port With Phase |
|--------|-----------|---------|------|-------------|
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

**Summary**: Out of 758 unit test files, **~720 can be directly ported** (Green), only storage/ (51 files), runtime/ (92 files), and cli/ (2 files) need adaptive porting (Yellow).

#### 5.10.3 tests/integration/ — 247 files / ~49,342 lines

Grouped by test category:

| Category | Files | Lines | Level | Portability Notes |
|------|--------|------|------|---------|
| **Security boundary** | 64 | 8,929 | Yellow B | Command injection/path traversal/SSRF/data leakage/sandbox escape/JWT algorithm downgrade/container boundary etc. Coupled with sandbox implementation, need to verify new platform compatibility |
| **CLI integration** | 32 | 8,998 | Yellow B | Integration tests for 78 CLI commands. Call `dist/` compiled scripts, need to adapt to new CLI paths |
| **Runtime integration** | 53 | 9,498 | Yellow B | Dispatch/Lease/Worker/Recovery/rehearsal scenarios. Deeply coupled with SQLite storage and runtime lifecycle |
| **Contract validation** | 5 | 1,459 | Green A | OpenAPI/event schema/Gateway adapter/Provider interface/Store facade contracts. **Validates interfaces not implementations, directly portable** |
| **Data integrity** | 3 | 1,227 | Yellow B | Approval-execution consistency/event column mapping/memory reference integrity. Depends on SQLite column-level validation |
| **Recovery** | 6 | 1,456 | Yellow B | Approval timeout recovery/scheduling compensation/event replay/lease crash recovery/SQLite WAL recovery/writeback compensation. Contains SQLite-specific tests |
| **Concurrency** | 5 | 1,401 | Yellow B | Command concurrency limit/DB busy retry/scheduling race/event concurrency/lease contention. Partially SQLite-specific |
| **Reliability** | 6 | 1,423 | Green A | Degradation behavior/message queue/data lossless/audit/terminal state guarantees. **Validates invariants, directly portable** |
| **Observability** | 6 | 2,011 | Green A | Approval cascade/health checks/metrics/SLI-SLO/task panel/timeline diagnostics. Directly portable |
| **Other 36 subdirectories** | 67 | ~12,940 | Green A / Yellow B | API(2)/approvals(2)/cache(1)/compliance(1)/config(2)/cost(2)/deployment(1)/Division(2)/evaluation(1)/events(2)/evolution(1)/gateway(1)/HR(1)/lifecycle(5 Yellow)/locking(1)/memory(1)/messages(2)/migration(3 Yellow)/ops(3 Yellow)/orchestration(1)/product(3)/Provider(2)/queue(1)/resource(1)/results(2)/session(1)/smoke(5)/soak(2 Blue)/stability(1)/storage(5 Yellow)/tools(2)/types(2)/toolset(1)/workflow(2) |

**Summary**: Out of 247 integration tests, **~150 can be directly ported** (Green), **~90 need adaptation** (Yellow, concentrated in security/CLI/Runtime/Recovery/storage), **~7 for reference only** (Blue, soak tests).

#### 5.10.4 tests/golden/ — 8 files / ~1,662 lines

| File | Lines | Level | Portability Notes |
|------|------|------|---------|
| `diagnostics-bundle.test.ts` | 160 | Green A | Diagnostics bundle structure snapshot |
| `openapi-document.test.ts` | 187 | Green A | OpenAPI document snapshot |
| `release-plan-output.test.ts` | 202 | Green A | Release plan Markdown snapshot |
| `session-summary.test.ts` | 148 | Green A | Session summary snapshot |
| `golden-tasks.test.ts` | 30 | Green A | Golden tasks |
| `prompt-assembly.test.ts` | 220 | Green A | Prompt partition/cache key snapshots |
| `workflow-validation.test.ts` | 145 | Green A | Workflow validation snapshot |
| `cli-help-text.test.ts` | 238 | Yellow B | CLI help text snapshot. Need to adapt to new CLI command list |
| `snapshots/` (3 files) | 332 | Green A | Snapshot data files |

#### 5.10.5 tests/e2e/ — 10 files / ~2,807 lines

| File | Lines | Level | E2E Flow |
|------|------|---------|---------|
| `task-lifecycle.test.ts` | 371 | Yellow B | Task full lifecycle: create-schedule-execute-complete. API/model/runtime all have changes, need to adapt |
| `multi-step-workflow.test.ts` | 406 | Yellow B | Multi-step workflow: step dependency-output passing-complete. Workflow model extension affects assertions |
| `lease-recovery.test.ts` | 371 | Yellow B | Lease lifecycle: acquire-expiry-recover-contend. After runtime split, lease interface changes |
| `operator-takeover.test.ts` | 306 | Yellow B | Operations takeover: run-pause-manual control-recover. 60 emergency brake introduces new takeover path |
| `error-propagation.test.ts` | 298 | Yellow B | Error propagation: execution failure-terminal state-error code-retry. State machine extension affects terminal state determination |
| `oapeflir-full-loop.test.ts` | 248 | Yellow B | OAPEFLIR 8-stage full loop. 42 autonomy assessment adds new stage |
| `session-memory-flow.test.ts` | 237 | Yellow B | Session lifecycle + memory association. 50 knowledge domain isolation affects memory access |
| `gateway-webhook-flow.test.ts` | 230 | Yellow B | Webhook trigger-task creation-lifecycle transition. 39 NL entry changes entry API |
| `streaming-response.test.ts` | 208 | Yellow B | Streaming response: session streaming state + backpressure. 15.6 streaming error handling extension |
| `approval-event-flow.test.ts` | 132 | Yellow B | Approval event flow: block-Tier1 event-consumer confirmation. 47 org approval routing changes |

**Downgrade explanation**: v1.0 marked all 10 E2E tests as Green, but after review downgrade to Yellow. E2E tests run through entire API-model-runtime-storage chain; runtime split, API extension, state machine changes, org governance, etc. will require test harness and assertion adaptation. Core test scenarios (lifecycle/workflow/recovery) reusable, but expected adaptation effort 15%-30%.

#### 5.10.6 tests/performance/ — 6 files / ~874 lines

| File | Lines | P99 Target | Level |
|------|------|---------|------|
| `feedback-perf.test.ts` | 118 | <10ms | Green A |
| `handoff-perf.test.ts` | 167 | <5ms | Green A |
| `knowledge-perf.test.ts` | 127 | <100ms/<500ms | Green A |
| `oapeflir-perf.test.ts` | 150 | <30s | Green A |
| `planning-perf.test.ts` | 163 | <50ms | Green A |
| `plugin-perf.test.ts` | 149 | <200ms | Green A |
| `performance.bak/` (10 files) | 2,016 | — | Blue C |

**All 6 performance tests can be directly ported** Green. The 10 deprecated files under `.bak/` are for reference only.

#### 5.10.7 tests/fixtures/ — 4 files / ~459 lines

| File | Lines | Level | Portability Notes |
|------|------|------|---------|
| `migration/generate-snapshots.ts` | 134 | Yellow B | SQLite snapshot generation script, need to adapt to new migration version sequence |
| `migration/migration-fixtures.test.ts` | 235 | Yellow B | Migration ledger integrity test |
| `migration/snapshots/manifest.json` | 41 | Yellow B | Snapshot version manifest |
| `migration/README.md` | 49 | Green A | Usage instructions |

#### 5.10.8 Test Portability Summary

| Test Layer | Total Files | Total Lines | Green Direct | Yellow Adaptive | Blue Reference |
|--------|--------|--------|---------|---------|---------|
| helpers/ | 19 | 2,093 | 16 | 3 | 0 |
| unit/ | 758 | 169,943 | ~720 | ~38 | 0 |
| integration/ | 247 | 49,342 | ~150 | ~90 | ~7 |
| golden/ | 8+3 | 1,662 | 10 | 1 | 0 |
| e2e/ | 10 | 2,807 | 0 | 10 | 0 |
| performance/ | 6+10 | 2,890 | 6 | 0 | 10 |
| fixtures/ | 4 | 459 | 1 | 3 | 0 |
| **Total** | **1,069** | **~229,196** | **~903** | **~145** | **~17** |

#### 5.10.9 Test-to-Code Phase Portability Mapping

| Portability Phase | Source Module | Corresponding Test Directory | Test Files | Test Lines |
|-----------|--------|------------|-----------|---------|
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

## 6. Portability Execution Order

### 6.1 Ten-Phase Portability Roadmap

```
Phase │ Content                          │ Files │ Lines   │ Prerequisites │ Estimated Effort
──────┼───────────────────────────────┼────────┼────────┼──────────┼─────────
  P0  │ Test Helpers (first)            │   19   │  ~2.1K │ None     │ 0.5 person-days
      │ tests/helpers/ all             │        │        │          │
──────┼───────────────────────────────┼────────┼────────┼──────────┼─────────
  1   │ Shared Kernel + tests          │  ~68   │ ~13.2K │ P0       │ 1.5 person-days
      │ types/ + errors.ts +           │  src30 │  4.7K  │          │
      │ constants/ + utils/ +          │ test38 │  8.5K  │          │
      │ results/ + lifecycle/         │        │        │          │
──────┼───────────────────────────────┼────────┼────────┼──────────┼─────────
  2   │ Infra Foundation + tests       │ ~325   │ ~71.5K │ Phase 1  │ 7 person-days
      │ storage/ + events/ + config/   │ src145 │ 29.5K  │          │
      │ + locking/ + queue/ + cache/   │ test180│ 42.0K  │          │
      │ + config/ directory + fixtures/ │        │        │          │
──────┼───────────────────────────────┼────────┼────────┼──────────┼─────────
  3   │ Security & Governance + tests  │ ~141   │ ~28.1K │ Phase 2  │ 3.5 person-days
      │ security/ + approvals/ +       │  src26 │  8.1K  │          │
      │ cost/ + compliance/ + hr/      │ test115│ 20.0K  │          │
──────┼───────────────────────────────┼────────┼────────┼──────────┼─────────
  4   │ AI Ops Primitives + tests      │ ~163   │ ~41.5K │ Phase 2  │ 4.5 person-days
      │ providers/ + tools/ +          │  src63 │ 19.5K  │          │
      │ workflow/ + artifacts/         │ test100│ 22.0K  │          │
──────┼───────────────────────────────┼────────┼────────┼──────────┼─────────
  5   │ Runtime Core + tests (split)    │ ~264   │ ~72.3K │ Phase 2-4│ 10 person-days
      │ runtime/ → dispatch/lease/     │ src114 │ 30.3K  │          │
      │ worker/ha/recovery/            │ test150│ 42.0K  │          │
──────┼───────────────────────────────┼────────┼────────┼──────────┼─────────
  6   │ OAPEFLIR Pipeline + tests      │ ~119   │ ~15.5K │ Phase 4-5│ 3.5 person-days
      │ agent-loop/ + planning/ +       │  src63 │  4.1K  │          │
      │ feedback/ + learning/ +        │ test56 │ 11.4K  │          │
      │ evaluation/ + improvement/     │        │        │          │
──────┼───────────────────────────────┼────────┼────────┼──────────┼─────────
  7   │ Interaction Layer + tests      │ ~124   │ ~28.8K │ Phase 5-6│ 4 person-days
      │ memory/ + knowledge/ +         │  src54 │ 10.8K  │          │
      │ messages/ + gateway/           │ test70 │ 18.0K  │          │
──────┼───────────────────────────────┼────────┼────────┼──────────┼─────────
  8   │ Business Domain + tests        │  ~78   │ ~13.5K │ Phase 2,7│ 2.5 person-days
      │ domain-registry/ + plugins/ +  │  src38 │  5.8K  │          │
      │ divisions/ directory           │ test40 │  7.7K  │          │
──────┼───────────────────────────────┼────────┼────────┼──────────┼─────────
  9   │ Operational Maturity + tests   │ ~271   │ ~72.6K │ Phase 5  │ 7 person-days
      │ observability/ + ops/ +        │ src106 │ 32.6K  │          │
      │ stability/ + evolution/ +       │ test165│ 40.0K  │          │
      │ reliability/ + product/ +      │        │        │          │
──────┼───────────────────────────────┼────────┼────────┼──────────┼─────────
 10   │ CLI + E2E + Golden + Perf      │ ~146   │ ~23.6K │ Phase 1-9│ 4 person-days
      │ + Infra Files                  │  src78 │  6.1K  │          │
      │ cli/ + e2e/ + golden/ +        │ test68 │ 17.5K  │          │
      │ performance/ + smoke/ +        │        │        │          │
      │ contract/ + deploy/ + CI       │        │        │          │
```

**Total**: ~1,868 files (source 799 + tests 1,069) / ~406K lines (source ~177K + tests ~229K) / **~70-100 person-days** (including storage/runtime split, adapter writing, E2E adaptation; excluding 24 new module developments)

### 6.2 Document Portability Order

```
Batch │ Content                          │ Files │ Priority
─────┼────────────────────────────────┼────────┼───────
 D1  │ Governance + Guide documents (Green direct port) │   8   │ P0
 D2  │ 22 Green contracts + 15 Green ADRs │  37   │ P0
 D3  │ 5 Green ops manuals + ops runbooks │  ~8   │ P1
 D4  │ 5 Yellow main documents + 2 technical analysis │   7   │ P1
 D5  │ 38 Yellow contracts + 8 Yellow ADRs │  46   │ P2
 D6  │ 3 Yellow review documents        │   3   │ P2
 D7  │ 28 Blue research documents entire move │  28   │ P3
 D8  │ Reference/Archive cleanup marks  │  29   │ P4
```

---

## 7. Key Risks and Mitigations

### 7.1 High-Risk Items

| Risk | Impact | Mitigation |
|------|------|---------|
| `runtime/` module too large (114 files / 30K lines) | Regression during portability, interface breakage during split | Write boundary integration tests before Phase 5, verify all stable-* rehearsals pass after split |
| `storage/` AuthoritativeTaskStore is god object | Almost all modules depend on it, any change has huge impact | First abstract Repository interface layer, then gradually migrate direct calls to Repository |
| Event namespace expansion (17 to 25) | Consumers not updated will miss events | Register new namespaces as Tier 3 (best-effort) first, upgrade to Tier 1 after confirming consumers are ready |
| Modules needed by new platform but completely missing from old system | 39 NL entry/40 goal decomposition/41 proactive agent/46 org hierarchy/64 edge etc. need entirely new development | Portability and new feature development in parallel, start with building foundation |

### 7.2 Capabilities Completely Missing from Old System, Needed by New Platform

| v2.7 Section | Capability | New Modules Needed |
|-----------|------|-------------|
| 39 | Natural language task entry | `core/nl-entry/` — NL parser, intent classification, entity extraction, session management |
| 40 | Goal decomposition engine | `core/goal-decomposition/` — Goal graph, sub-goal generation, DAG orchestration |
| 41 | Proactive agent | `core/proactive-agent/` — Trigger engine, timed scheduling, event-driven wake-up |
| 42 | Progressive autonomy | `core/autonomy/` — Trust scoring, autonomy level state machine, promotion/demotion rules |
| 43 | Unified operations dashboard | `core/dashboard/` — Business view aggregation, multi-role dashboards |
| 44 | Non-technical user UX | `gateway/user-portal/` — Web UI gateway, drag-and-drop orchestration, wizards |
| 46 | Org hierarchy model | `core/org-hierarchy/` — Org tree, department/team, hierarchical inheritance |
| 47 | Org structure approval routing | Extend `core/approvals/` — Dynamic routing engine |
| 48 | SSO/SCIM integration | `core/sso-scim/` — SAML/OIDC SSO, SCIM user sync |
| 49 | Department-level compliance policy | Extend `core/compliance/` — Department-level policy engine |
| 50 | Knowledge domain isolation | Extend `core/knowledge/` — Namespace isolation, controlled sharing |
| 52 | Multi-region deployment | `core/multi-region/` — Region routing, data sync, failover |
| 53 | Resource competition management | `core/resource-scheduler/` — Priority queue, fair scheduling |
| 54 | SLA tiered guarantees | `core/sla/` — SLA tier definitions, guarantee strategies |
| 59 | Agent explainability | `core/explainability/` — Decision tracking, causal chains |
| 60 | Emergency brake | `core/emergency-brake/` — Global brake, tiered brake |
| 61 | Unified lifecycle management | `core/agent-lifecycle/` — Create-activate-hibernate-deprecate |
| 64 | Edge/offline deployment | `core/edge-runtime/` — Offline cache, sync |
| 65 | Behavior drift detection | `core/drift-detection/` — Baseline comparison, alerting |
| 66 | Cost attribution optimization | Extend `core/cost/` — Multi-dimensional attribution, optimization suggestions |
| 67 | Visual debugging | `core/debug-ui/` — Execution visualization, breakpoints |
| 68 | Compliance report auto-generation | Extend `core/compliance/` — Report templates, auto-generation |
| 69 | Multimodal capability | `core/multimodal/` — Image/audio/video processing |
| 70 | Platform self-ops agent | `core/self-ops-agent/` — Auto inspection, auto repair |

---

## 8. Core Object Migration Matrix

The old system defines ~84 domain entity types (`core/types/`), and the new platform v2.7 introduces many new entities and entity splits in organization governance (46-51), intelligent interaction (39-44), and scale operation (52-57) layers. This section maps old-to-new entity evolution relationships.

### 8.1 Mapping Type Definitions

| Mapping Type | Symbol | Meaning |
|----------|------|------|
| **1:1 Direct** | -> | Field name/semantics unchanged, directly rename or retain |
| **1:1 Enriched** | ->+ | Retain original fields, add new required fields |
| **1:N Split** | ->1 2 3... | One old entity splits into multiple new entities |
| **N:1 Merge** | => | Multiple old entities merge into one new entity |
| **Semantic Redefinition** | ~> | Same name but semantics/lifecycle fundamentally changed |
| **Brand New** | Star | No corresponding entity in old system |
| **Deprecated** | X | No longer needed |

### 8.2 Core Entity Mapping (Grouped by Domain)

#### Task and Execution Domain

| Old Entity | Mapping | New Entity | Risk | Description |
|--------|------|--------|------|------|
| TaskRecord | ->+ | task | Low | Added org_node_id, autonomy_level, sla_tier fields |
| ExecutionRecord | ->1 2 3 4 5 | execution + execution_step + execution_artifact + execution_metric + execution_decision_log | High | Split from single row to 5 tables, needs data migration script |
| TransitionCommand | ~> | state_command + control_directive | High | Fundamental architecture change: commands no longer directly operate state machine, route indirectly through control_directive |
| SessionRecord | ->+ | session | Low | Added channel_type, nl_context fields (39) |
| WorkflowRecord | ->+ | workflow_definition | Low | Added goal_decomposition_tree reference (40) |
| WorkflowStepRecord | ->+ | workflow_step | Low | Added autonomy_gate, explainability_output fields |
| WorkflowStateRecord | ->1 2 3 4 | workflow_run + loop_cycle + checkpoint + hibernation_snapshot | High | Loop/checkpoint/hibernate separation |

#### Worker and Scheduling Domain

| Old Entity | Mapping | New Entity | Risk | Description |
|--------|------|--------|------|------|
| WorkerRecord | ->+ | worker | Low | Added region_id, capability_vector fields |
| LeaseRecord | ->+ | lease | Low | Added sla_priority field |
| DispatchRecord | ->+ | dispatch_assignment | Low | Added resource_quota, region_affinity fields (52-53) |
| AgentExecutionRecord | ->1 2 3 4 5 | agent_run + agent_step + tool_invocation + llm_call + agent_decision | High | Fine-grained split driven by observability requirements |

#### Organization and Governance Domain

| Old Entity | Mapping | New Entity | Risk | Description |
|--------|------|--------|------|------|
| ApprovalRecord | ->1 2 3 4 | decision_record + approval_route + approval_sla + decision_comment | High | Org-structure-aware approval (47), routing rules change from hardcoded to dynamic |
| OrganizationRecord + TenantRecord | => | org_node (hierarchical tree) | High | N:1 merge into recursive org tree (46), tenant becomes top-level org_node |
| HrRoleRecord | ->+ | role_assignment | Medium | Added delegation_scope, escalation_chain (51) |
| ComplianceRecord | ->+ | compliance_policy | Medium | Added department_scope, geo_region (49, 52) |

#### Security Domain

| Old Entity | Mapping | New Entity | Risk | Description |
|--------|------|--------|------|------|
| SandboxPolicy | ->+ | sandbox_policy | Low | Added department_override field (49) |
| SecretRecord | -> | secret_entry | Low | 1:1 direct |
| AuditRecord | ->+ | audit_event | Low | Added compliance_tag, retention_policy fields |

#### Memory and Knowledge Domain

| Old Entity | Mapping | New Entity | Risk | Description |
|--------|------|--------|------|------|
| MemoryRecord | ->1 2 | memory_entry + knowledge_document/chunk | High | Needs content classifier to distinguish episodic memory and knowledge artifact |
| KnowledgeDocument | ->+ | knowledge_document | Medium | Added namespace_id (50 domain isolation), modality field (69) |
| EmbeddingRecord | -> | embedding_vector | Low | 1:1 direct |

#### AI Operations Domain

| Old Entity | Mapping | New Entity | Risk | Description |
|--------|------|--------|------|------|
| ProviderConfig | ->+ | provider_config | Low | Added streaming_error_policy (15.6) |
| ToolDefinition | ->+ | tool_definition | Low | Added modality_support, domain_binding fields |
| PluginManifest | ->+ | pack_manifest | Low | Renamed + added marketplace_metadata (55) |
| ArtifactRecord | ->+ | artifact | Medium | Added evidence_chain, compliance_tag, modality fields |
| FeedbackSignal | ->+ | feedback_signal | Low | Added signal_source_type enum extension |
| EvalResult | ~> | eval_result | Medium | Evaluation framework changed from post-hoc to inline (17) |

#### Operational Maturity Domain

| Old Entity | Mapping | New Entity | Risk | Description |
|--------|------|--------|------|------|
| SloDefinition | ->+ | slo_definition | Low | Added region_scope field |
| AlertRule | -> | alert_rule | Low | 1:1 direct |
| ReleaseRecord | ->+ | release | Low | Added canary_config, rollback_policy extension |
| StabilityScenario | -> | rehearsal_scenario | Low | Renamed, semantics unchanged |
| EvolutionProposal | ->+ | evolution_proposal | Medium | Added drift_baseline, behavior_fingerprint (65) |

### 8.3 Brand New Entity List (No Old System Corresponding — Star)

| New Entity | v2.7 Section | Domain |
|--------|-----------|--------|
| org_node | 46 | Organization governance |
| delegation_scope | 51 | Organization governance |
| sso_identity | 48 | Organization governance |
| scim_sync_log | 48 | Organization governance |
| nl_intent | 39 | Intelligent interaction |
| goal_tree | 40 | Intelligent interaction |
| proactive_trigger | 41 | Intelligent interaction |
| autonomy_level | 42 | Intelligent interaction |
| trust_score | 42 | Intelligent interaction |
| dashboard_view | 43 | Intelligent interaction |
| user_portal_session | 44 | Intelligent interaction |
| region_config | 52 | Scale operation |
| resource_quota | 53 | Scale operation |
| sla_tier | 54 | Scale operation |
| marketplace_listing | 55 | Scale operation |
| integration_connector | 57 | Scale operation |
| explainability_trace | 59 | Operational maturity |
| emergency_brake_event | 60 | Operational maturity |
| agent_lifecycle_state | 61 | Operational maturity |
| edge_deployment | 64 | Operational maturity |
| drift_baseline | 65 | Operational maturity |
| cost_attribution | 66 | Operational maturity |
| debug_session | 67 | Operational maturity |
| compliance_report | 68 | Operational maturity |
| multimodal_asset | 69 | Operational maturity |
| self_ops_task | 70 | Operational maturity |

### 8.4 Migration Statistics

| Mapping Type | Entity Count | Percentage |
|----------|--------|------|
| 1:1 direct (->) | ~12 | 14% |
| 1:1 enriched (->+) | ~22 | 26% |
| 1:N split (->1 2...) | ~5 | 6% |
| N:1 merge (=>) | ~2 | 2% |
| Semantic redefinition (~>) | ~3 | 4% |
| Brand new (Star) | ~26 | 31% |
| Deprecated (X) | ~14 | 17% |
| **Total** | **~84** | 100% |

### 8.5 Data Migration Strategy

The object migration matrix defines "what changes to what", this section defines "how to change". Based on risk level and data volume, three migration modes are adopted:

#### Migration Mode Definitions

| Mode | Applicable Scenario | Execution Method | Downtime Requirement |
|------|---------|---------|---------|
| **One-time offline migration** | Low risk, 1:1 direct/enriched mapping | Write migration script, execute once during maintenance window | Short downtime (minutes) |
| **Dual-write transition** | High risk entity split/merge, business cannot be interrupted | Write to both old and new tables on insert, gradually switch reads to new table, deprecate old table after verifying consistency | Zero downtime |
| **Lazy migration** | Long-tail low-frequency entities, full migration cost unreasonable | Check version on access, upgrade to new format on demand | Zero downtime |

#### Entity Migration Mode Assignment

| Entity | Mapping Type | Migration Mode | Phase | Description |
|------|---------|---------|-------|------|
| TaskRecord | ->+ | One-time offline | P2 | New fields can have defaults, ALTER TABLE + backfill |
| SessionRecord | ->+ | One-time offline | P2 | Same as above |
| WorkerRecord | ->+ | One-time offline | P2 | Same as above |
| LeaseRecord | ->+ | One-time offline | P2 | Same as above |
| ProviderConfig | ->+ | One-time offline | P4 | Same as above |
| SecretRecord | -> | One-time offline | P3 | 1:1 rename |
| SloDefinition | ->+ | One-time offline | P9 | Same as above |
| **ExecutionRecord** | ->1 2 3 4 5 | **Dual-write transition** | P2 to P5 | 1:5 split, need P2 to create new tables and start dual-write, switch reads at P5 after verifying consistency |
| **WorkflowStateRecord** | ->1 2 3 4 | **Dual-write transition** | P2 to P6 | 1:4 split, loop/checkpoint/hibernate separation, switch reads after OAPEFLIR completion |
| **ApprovalRecord** | ->1 2 3 4 | **Dual-write transition** | P3 to P5 | 1:4 split, org approval routing change, switch reads after Runtime completion |
| **AgentExecutionRecord** | ->1 2 3 4 5 | **Dual-write transition** | P5 | 1:5 split, driven by observability |
| **MemoryRecord** | ->1 2 | **Dual-write transition** | P7 | Needs content classifier to distinguish episodic memory and knowledge artifact |
| **OrganizationRecord + TenantRecord** | => | **Dual-write transition** | P3 | N:1 merge into org_node hierarchical tree, read/write paths fundamentally change |
| **TransitionCommand** | ~> | **Dual-write transition** | P5 | Semantic redefinition, command routing fundamentally changes |
| EvalResult | ~> | Lazy migration | P6 | Low access frequency for evaluation records, upgrade on access |
| EvolutionProposal | ->+ | Lazy migration | P9 | Historical proposals upgraded on demand when accessed |
| KnowledgeDocument | ->+ | Lazy migration | P7 | Supplement namespace_id when accessing existing documents |

#### Dual-Write Transition Execution Flow

```
Stage 1: Create new tables    -> CREATE TABLE new_xxx (new schema)
Stage 2: Enable dual-write     -> Write to both old_xxx + new_xxx on insert
Stage 3: Shadow reads          -> Read from both tables simultaneously, compare results, record differences
Stage 4: Switch primary read   -> Primary read switches to new_xxx, old_xxx becomes backup
Stage 5: Verification period   -> Run >= 1 complete Phase cycle, confirm zero differences
Stage 6: Deprecate old table   -> DROP TABLE old_xxx
```

Each dual-write object must have an assigned owner, and "dual-write consistency verification passed" must be added to Phase exit conditions.

---

## 9. High-Risk Special: storage / AuthoritativeTaskStore Split

### 9.1 Current State Analysis

`AuthoritativeTaskStore` (`src/platform/five-plane-state-evidence/truth/sqlite/authoritative-task-store-core.ts` and same-directory split modules) is the current system's global data access facade:

| Metric | Value |
|------|------|
| Public method count | ~278 domain methods + 27 structural properties = ~305 public surface |
| Underlying Repository count | 21 (task, workflow, execution, session, event, worker, approval, billing, lease, lock, memory, artifact, dispatch, division, secret, marketplace, release, organization, intelligence, evolution, operations) |
| Consumer file count | ~123 source files directly dependent (including tests 200+) |
| Code lines | 101 files / 26,102 lines in directory |

**Core problem**: god object anti-pattern — single class bears data access responsibilities for 21 domains, causing any storage layer change to affect entire system.

### 9.2 Split Target Modules (7 Bounded Contexts)

| # | Bounded Context | Methods | Contains Repository | Split Strategy |
|---|-----------|--------|-----------------|---------|
| 1 | **Core Task Engine** | ~73 | task, workflow, execution, session | Keep as core — high coupling between methods, not suitable for further split |
| 2 | **Worker Infrastructure** | ~47 | worker, dispatch, lease, lock | Extract — scheduling/lease/worker lifecycle is independent domain |
| 3 | **Event Infrastructure** | ~24 | event | Extract — event bus already has clear boundary |
| 4 | **Billing & Cost** | ~29 | billing | Extract — billing logic decoupled from core execution |
| 5 | **Governance & Compliance** | ~50 | approval, organization, secret, compliance, operations | Extract — org governance is independent domain (align with v2.7 Layer 5) |
| 6 | **Platform & Commerce** | ~47 | marketplace, release, division, intelligence, evolution | Extract — platform operations is independent domain (align with v2.7 Layer 6-7) |
| 7 | **Memory & Artifacts** | ~10 | memory, artifact | Extract — knowledge/memory is independent domain (align with v2.7 Layer 4) |

### 9.3 Split Execution Plan

**Prerequisite**: AuthoritativeTaskStore internally delegates through named Repositories, split infrastructure is in place, only need to migrate consumers.

| Step | Action | Estimated Effort | Risk |
|------|------|-----------|------|
| S1 | Define TypeScript interfaces for 7 bounded contexts (Repository contracts) | 2 person-days | Low |
| S2 | Implement facade adapter — AuthoritativeTaskStore temporarily delegates to new interface, maintain backward compatibility | 3 person-days | Low |
| S3 | Migrate consumers module by module: replace `store.xxx()` calls with corresponding Repository interface injection | 8 person-days | Medium — each consumer needs verification |
| S4 | Remove AuthoritativeTaskStore facade, each bounded context independently registers to ServiceRegistry | 2 person-days | Medium |
| S5 | Update all unit tests/integration tests' store mocks | 3 person-days | Medium |
| S6 | Run full regression + stable-* rehearsal verification | 2 person-days | Low |
| **Total** | | **~20 person-days** | |

### 9.4 Recommended Migration Order

```
Wave 1 (low risk extraction): Event Infrastructure -> Memory & Artifacts
  -> Verification point: all event-related tests pass
Wave 2 (medium risk extraction): Billing & Cost -> Worker Infrastructure
  -> Verification point: all dispatch/lease-related tests pass
Wave 3 (high risk extraction): Governance & Compliance -> Platform & Commerce
  -> Verification point: all org/approval/marketplace-related tests pass
Wave 4 (wrap-up): Remove facade, Core Task Engine becomes independent module
  -> Verification point: npm test full pass + stable-* rehearsals pass
```

---

## 10. High-Risk Special: runtime/ Bounded Context Split

### 10.1 Current State Analysis

`src/core/runtime/` is the system's largest module:

| Metric | Value |
|------|------|
| File count | 101 .ts files |
| Code lines | 30,348 lines |
| Identified bounded contexts | 12 |

### 10.2 Bounded Context Decomposition

| BC# | Bounded Context | Files | Lines | Internal Dependencies | Can Be Independently Extracted |
|-----|-----------|--------|------|-----------|-----------|
| BC1 | Execution Dispatch | 12 | 2,744 | 3 | No — composite root |
| BC2 | Lease Management | 8 | 1,807 | 1 | Yes — clean repo pattern |
| BC3 | Worker Management | 10 | 1,434 | 0 | **Yes — zero internal dependencies, best extraction target** |
| BC4 | Handshake/Writeback | 10 | 2,058 | 2 | No — depends on BC1+BC2 |
| BC5 | HA Coordinator | 8 | 1,849 | 0 | **Yes — zero internal dependencies** |
| BC6 | Hot Upgrade | 6 | 1,952 | 0 | **Yes — zero internal dependencies** |
| BC7 | Recovery & Repair | 13 | 3,620 | 4 | No — depends on multiple BCs |
| BC8 | State Transition | 4 | 901 | 0 | **Yes — zero internal dependencies** |
| BC9 | Agent Execution Engine | 12 | 2,990 | 1 | Yes — only depends on BC8 |
| BC10 | Multi-Step Orchestration | 13 | 2,427 | 5 | No — composite root, stays in runtime/ |
| BC11 | Infrastructure | 13 | 2,498 | 0 | Yes — utility classes |
| BC12 | HITL & Governance | 2 | 1,166 | 0 | **Yes — zero internal dependencies** |

### 10.3 Extraction Wave Plan

| Wave | Extraction Target | Lines | Percentage | Risk | Verification Point |
|------|---------|------|------|------|--------|
| **Wave 1** (zero risk) | BC3 Worker + BC5 HA + BC6 Hot Upgrade + BC8 State Transition | 6,136 | 20% | Low — zero internal dependencies | Each BC unit tests independently pass |
| **Wave 2** (low risk) | BC2 Lease + BC9 Agent Execution + BC12 HITL + BC11 Infrastructure | 6,461 | 21% | Low — 1 or fewer dependencies | lease/agent integration tests pass |
| **Wave 3** (medium risk) | BC4 Handshake/Writeback + BC7 Recovery | 5,678 | 19% | Medium — multiple dependencies | recovery rehearsal scenarios pass |
| **Wave 4** (wrap-up) | BC1 Dispatch + BC10 Orchestration remain as runtime/ core | 5,171 | 17% | Low — only reorganization | npm test full pass |

### 10.4 Estimated Effort

| Action | Effort |
|------|--------|
| BC interface definitions (12) | 3 person-days |
| Wave 1 extraction + tests | 4 person-days |
| Wave 2 extraction + tests | 5 person-days |
| Wave 3 extraction + tests | 5 person-days |
| Wave 4 wrap-up + full regression | 3 person-days |
| **Total** | **~20 person-days** |

### 10.5 Alignment with New Architecture

| Extracted Module | v2.7 Target Section | New Capabilities |
|-----------|-------------|---------|
| Worker Management | 53 resource competition | Fair scheduling, priority queue |
| HA Coordinator | 31 disaster recovery | Multi-region leader election (52) |
| State Transition | 9 state machine | Extended state set (hibernate/delegation) |
| Agent Execution | 13 OAPEFLIR | 42 autonomy assessment stage |
| HITL & Governance | 21 HITL | 47 org approval routing |
| Lease Management | 31 lease | 54 SLA tiered lease priority |

---

## 11. New Module Priority and Dependency Graph

### 11.1 Priority Classification

24 modules completely missing from old system, needed by new platform, classified by business blocking relationship as P0/P1/P2:

| Priority | Meaning | Count |
|--------|------|------|
| **P0 — Foundation capabilities** | New platform cannot be distinguished from old system without these, blocking upper-layer modules | 6 |
| **P1 — Core differentiation** | Key capabilities of new platform, but not blocking P0 module portability | 10 |
| **P2 — Operational enhancement** | Nice-to-have, can be delivered gradually after platform stabilizes | 8 |

### 11.2 P0 Foundation Capabilities (6)

| Module | v2.7 Section | Dependencies | Description |
|------|-----------|------|------|
| `core/org-hierarchy/` | 46 | None | Org hierarchy model is foundation for 47-51, develop first |
| `core/nl-entry/` | 39 | None | Natural language entry is core interaction pattern for new platform |
| `core/goal-decomposition/` | 40 | nl-entry | Goal decomposition engine depends on NL intent parsing |
| `core/autonomy/` | 42 | org-hierarchy | Autonomy model depends on organizational trust chain |
| `core/sso-scim/` | 48 | org-hierarchy | SSO/SCIM depends on org model |
| `core/emergency-brake/` | 60 | None | Emergency brake is security foundation, can be developed independently |

### 11.3 P1 Core Differentiation (10)

| Module | v2.7 Section | Dependencies | Description |
|------|-----------|------|------|
| `core/proactive-agent/` | 41 | autonomy, nl-entry | Proactive agent needs autonomy and NL capabilities |
| `core/agent-lifecycle/` | 61 | autonomy | Unified lifecycle depends on autonomy level |
| `core/explainability/` | 59 | agent-lifecycle | Explainability depends on lifecycle events |
| `core/multi-region/` | 52 | org-hierarchy | Multi-region depends on org topology |
| `core/resource-scheduler/` | 53 | multi-region | Resource scheduling depends on Region configuration |
| `core/sla/` | 54 | org-hierarchy, resource-scheduler | SLA depends on org + resources |
| `core/drift-detection/` | 65 | agent-lifecycle | Drift detection depends on behavior baseline |
| `core/dashboard/` | 43 | org-hierarchy | Dashboard depends on org views |
| Extend `core/approvals/` | 47 | org-hierarchy | Org approval routing |
| Extend `core/compliance/` | 49 | org-hierarchy | Department-level compliance |

### 11.4 P2 Operational Enhancement (8)

| Module | v2.7 Section | Dependencies | Description |
|------|-----------|------|------|
| `gateway/user-portal/` | 44 | nl-entry, dashboard | Non-technical user UX |
| `core/marketplace/` | 55 | agent-lifecycle | Marketplace ecosystem |
| `core/edge-runtime/` | 64 | multi-region | Edge/offline deployment |
| `core/cost-attribution/` | 66 | sla, org-hierarchy | Cost attribution optimization |
| `core/debug-ui/` | 67 | explainability | Visual debugging |
| `core/compliance-report/` | 68 | compliance | Compliance report auto-generation |
| `core/multimodal/` | 69 | None | Multimodal capability |
| `core/self-ops-agent/` | 70 | agent-lifecycle, drift-detection | Platform self-ops |

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
 emergency-brake(P0) ── independent, no dependencies
 multimodal(P2) ──── independent, no dependencies
 compliance-report(P2) ── depends on compliance(P1)
```

---

## 12. Execution Recommendations

### 12.1 Portability Principles

1. **Port Green direct port items first**: Zero adaptation cost, quickly establish new platform code foundation
2. **Port in dependency order**: Shared Kernel -> Infrastructure -> Security -> AI Ops -> Runtime -> OAPEFLIR -> Interaction -> Domain -> Maturity -> CLI
3. **Run corresponding tests after each Phase portability completes**: Ensure no regression introduced
4. **Port documents and code synchronously**: Move corresponding contracts/ADRs with each code Phase
5. **New feature development and portability in parallel**: Portability team and new feature team can work simultaneously

### 12.2 Dual-Track Migration Strategy

"Portability and new feature development in parallel" requires clear lane division and convergence rules, otherwise easy to block each other.

#### Lane A: Migration Lane

| Responsibility | Content |
|------|------|
| P0-P10 code migration | Execute according to Section 6 ten-phase roadmap |
| storage split | Section 9 AuthoritativeTaskStore 4-wave split |
| runtime split | Section 10 runtime 4-wave split |
| Test regression | Each Phase exit gate (Section 13) |
| Contract/document migration |同步 with code Phase |
| Data migration scripts | Section 8 high-risk entity dual-write/offline migration |

#### Lane B: New Capability Lane

| Responsibility | Content |
|------|------|
| P0 Foundation | org-hierarchy / nl-entry / goal-decomposition / autonomy / sso-scim / emergency-brake |
| P1 Differentiation | proactive-agent / agent-lifecycle / explainability / multi-region / resource-scheduler / sla / drift-detection / dashboard / approvals routing extension / department compliance extension |
| P2 Enhancement | user-portal / marketplace / edge-runtime / cost-attribution / debug-ui / compliance-report / multimodal / self-ops-agent |

#### Convergence Points and Dependency Rules

| Convergence Point | Migration Lane Prerequisites | New Capability Lane Action | Strategy |
|--------|-------------|---------------|------|
| **org-hierarchy integration** | P3 Security complete (hr/approvals migrated) | org-hierarchy module connects to migrated hr/approvals via adapter | New capability lane can develop with **stub interface** first, replace with real implementation after P3 completes |
| **autonomy integration** | P5 Runtime complete (state machine migrated) | autonomy module connects to state-transition BC | New capability lane defines StateTransition interface stub first, integrate after P5 Wave 1 completes |
| **nl-entry integration** | P4 AI Ops complete (providers migrated) | nl-entry uses migrated LLM provider | New capability lane can develop with mock provider, switch after P4 completes |
| **agent-lifecycle integration** | P6 OAPEFLIR complete | agent-lifecycle extends OAPEFLIR loop | Must wait for P6 completion, cannot stub |
| **multi-region integration** | P5 Runtime complete (HA/dispatch extracted) | multi-region extends extracted HA Coordinator | Must wait for P5 Wave 1 completion |
| **Knowledge domain isolation** | P7 Interaction complete (knowledge migrated) | 50 knowledge domain isolation extends knowledge module | Must wait for P7 completion |

#### Stub Strategy

Modules that can be stubbed first then integrated later (new capability lane can start early):
- `org-hierarchy` — stub `OrgNodeRepository` interface, return single-layer organization
- `autonomy` — stub `AutonomyGate`, return LEVEL_1 (lowest autonomy) by default
- `nl-entry` — stub `IntentClassifier`, pass through original text
- `emergency-brake` — stub `BrakeService`, do not brake by default

Modules that must wait for migration completion before integration (hard dependencies):
- `agent-lifecycle` — depends on complete OAPEFLIR loop (P6)
- `multi-region` — depends on real HA Coordinator (P5)
- `drift-detection` — depends on real behavior baseline data (P9)
- `self-ops-agent` — depends on complete platform capabilities (after P10)

### 12.3 Portability Checklist

Each module portability must complete:

- [ ] Copy source files to corresponding directory in new project
- [ ] Update import paths (if paths changed due to seven-layer directory reorganization)
- [ ] Copy `tests/unit/<module>/` and `tests/unit/core/<module>/` to new project
- [ ] Copy `tests/integration/<module>/` to new project
- [ ] Run that module's unit tests, confirm all pass
- [ ] Run related integration tests, confirm all pass
- [ ] If golden test involves this module, update snapshots and verify
- [ ] If e2e test involves this module, verify end-to-end flow passes
- [ ] If performance test involves this module, verify performance baseline is met
- [ ] Update contract document references (§ numbers) for the module
- [ ] Register in new platform's module-inventory
- [ ] Confirm no TypeScript compilation errors
- [ ] Run `npm run test:unit` full regression

### 12.4 Items That Will Not Be Ported

The following **explicitly will not be ported**, archived only:

| Content | Reason |
|------|------|
| All `docs_zh/archive/` | Historical archive |
| 9 White D files in `docs_zh/reference/` | Replaced by v2.7 |
| `docs_zh/automatic_agent_platform/agent_platform.md` (92K lines) | Unabridged old version, already replaced by v2.7 (6.7K lines) |
| Intermediate translation fragment files in `docs_zh/automatic_agent_platform/` | chunk_b-j, part1-6 are translation intermediate products |
| 6 White D files in `docs_zh/reviews/` | Old reviews |
| 10 White D contracts in `docs_zh/contracts/` | Early v1.x contracts |

---

## 13. Phase Entry and Exit Criteria

Each portability Phase must meet clear Definition of Ready (DoR) and Definition of Done (DoD), cannot proceed to next Phase if not met.

| Phase | Entry Conditions | Exit Conditions (DoD) |
|-------|---------|-------------------------------|
| **P0 Test Helpers** | New project repo initialized, tsconfig/eslint/package.json in place | 19 helper files all pass `tsc --noEmit`; `createTempWorkspace()` available in new project |
| **P1 Shared Kernel** | P0 exit criteria met | types/errors/constants/utils/results/lifecycle all compile; 38 unit tests all green; zero external runtime dependencies |
| **P2 Infra Foundation** | P1 exit criteria met | storage/events/config/locking/queue/cache compile; 180 unit tests + related integration tests all green; SQLite migration ledger integrity verification passed; `npm run test:unit` full regression green |
| **P3 Security** | P2 exit criteria met | security/approvals/cost/compliance/hr compile; 115 tests green; 64 security boundary integration tests all pass (including sandbox escape/path traversal/SSRF rejection paths) |
| **P4 AI Ops** | P2 exit criteria met | providers/tools/workflow/artifacts compile; 100 tests green; Provider CircuitBreaker integration tests pass |
| **P5 Runtime** | P2+P3+P4 exit criteria met | runtime 12 BCs extracted by waves; 150 tests green; stable-* rehearsal scenarios all pass; dispatch/lease/recovery integration tests pass |
| **P6 OAPEFLIR** | P4+P5 exit criteria met | agent-loop/planning/feedback/learning/evaluation/improvement compile; 56 tests green; OAPEFLIR 8-stage full loop E2E passes |
| **P7 Interaction** | P5+P6 exit criteria met | memory/knowledge/messages/gateway compile; 70 tests green; session->memory->retrieval end-to-end passes |
| **P8 Business Domain** | P2+P7 exit criteria met | domain-registry/divisions/plugins compile; 40 tests green; at least 1 division loads end-to-end successfully |
| **P9 Maturity** | P5 exit criteria met | observability/ops/stability/evolution/reliability/product/deployment compile; 165 tests green; health check + SLO alerting integration tests pass |
| **P10 CLI + E2E** | P1-P9 all exit criteria met | CLI 78 entry points compile; 10 E2E tests green; 8 golden test snapshots match; 6 performance tests meet targets; `npm test` full regression green; `npm run build` generates dist/ successfully |

### 13.1 Module-Level Deliverable Acceptance Template

Phase DoD defines the phase-wide gate, but each **module** that completes migration must deliver the following 5 items, missing items cannot mark as "completed":

| Deliverable | Content | Acceptance Criteria |
|--------|------|---------|
| **Code** | Migrated source code, placed in new project target directory | `tsc --noEmit` zero errors; import paths updated; no references to old project paths |
| **Contract** | Interface/schema/contract documents updated | New adapter interfaces have JSDoc; if DB schema changes involved, migration files created |
| **Tests** | unit + integration + (if applicable) e2e regression | All tests for this module green; new adapters have corresponding unit tests |
| **Documentation** | module-inventory registration + contract references (§ numbers) updated | Module name/files/lines/owner registered in new platform's module-inventory.md |
| **Migration Notes** | Compatibility/breaking change records | Record: (1) Interface change list (2) Deprecated APIs (3) New dependencies (4) Configuration item changes |

**Template Example** (taking `core/events/` as example):

```
Module: core/events/
Phase: P2
Deliverable Check:
  [x] Code: 8 files migrated to new-project/src/core/events/, tsc passes
  [x] Contract: 8 new event namespace interfaces (delegation.*/hibernation.*/...)
  [x] Tests: 10 unit tests + 2 integration tests all green
  [x] Documentation: module-inventory registered, contract references updated to v2.7 28
  [x] Migration Notes: Breaking change — EventBus.emit() signature adds namespace parameter
```

### 13.2 Regression Gate

Each Phase exit must run:
1. `tsc --noEmit` — zero compilation errors
2. `npm run test:unit` — full unit tests green
3. Subset of `npm run test:integration` for that Phase green
4. `npm run build` — dist/ can be generated

### 13.3 Blocking Upgrade Rules

- When any Phase exit conditions are not met, that Phase is marked as **BLOCKED**
- BLOCKED Phase's downstream Phases cannot start
- After fixing, need to run complete exit verification again

---

## 14. Migration Freeze Line

During migration, the following technology stacks **freeze unchanged**, to avoid introducing additional uncertainty:

| Freeze Item | Current Version/Selection | Freeze Reason |
|--------|-------------|---------|
| **Test framework** | Node.js 22 built-in `node:test` + `assert/strict` | 1,069 test files depend on it, switching framework equals rewriting tests |
| **Module system** | TypeScript ESM (`.js` extension imports) | Full ESM, switching to CJS affects all imports |
| **Database backend** | SQLite (Phase 1-2) + PostgreSQL (optional) | storage layer 101 files + all test fixtures based on SQLite |
| **CLI framework** | Direct `process.argv` parsing + 78 thin scripts | CLI is thin wrapper around services, changing framework has no benefit |
| **Observability stack** | OpenTelemetry + Prometheus + StructuredLogger | 36 observability files + SLO alerting depend on it |
| **Config validation** | Zod schema | 27 config files + 8-layer config governance depend on it |
| **Package manager** | npm | CI workflows + scripts depend on it |

### 14.1 Freeze Line Change Process

If freeze items truly need to change:
1. Submit ADR explaining change reason and impact scope
2. Evaluate affected file counts and test counts
3. Obtain architecture lead approval
4. Changes must be completed on independent branch, not interleaved with portability work

---

## 15. Effort Estimation and Assumptions

### 15.1 Effort Breakdown

| Work Item | Person-days | Description |
|--------|------|------|
| P0-P1 file搬运 + compilation fixes | 2 | Zero-adaptation modules |
| P2 Infra (including storage split 9) | 27 | storage split 20 person-days + remaining infra 7 person-days |
| P3 Security | 4 | Security test verification primarily |
| P4 AI Ops | 5 | providers/tools adapter writing |
| P5 Runtime (including runtime split 10) | 30 | runtime split 20 person-days + integration verification 10 person-days |
| P6-P8 OAPEFLIR + Interaction + Domain | 10 | Primarily adaptation work |
| P9 Maturity | 7 | observability/ops/stability |
| P10 CLI + E2E + full regression | 8 | E2E adaptation + golden updates + performance verification |
| Buffer (20%) | 7 | Unforeseen compatibility issues |
| **Portability Total** | **~100 person-days** | |

### 15.2 Assumptions

1. 1 person-day = 8 hours effective development time
2. Team has TypeScript ESM + Node.js 22 experience
3. storage/runtime split can each assign 1 dedicated person
4. Portability and 24 new module development **in parallel**, new module development person-days not included in this estimate
5. Excludes environment setup, CI configuration, code review and other management overhead
6. v1.0's 48 person-days was pure file搬运口径 (copy+import fix), not including god object split, adapter writing, E2E test adaptation

---

## Appendix A: Portability Quantitative Statistics

| Metric | Value |
|------|------|
| **Source Code** | |
| Total source code files | 799 |
| Total source code lines | ~174,585 |
| Green directly portable code modules | 18 (~27K lines) |
| Yellow adaptively portable code modules | 25 (~147K lines) |
| Blue reference-only code modules | 3 (~8.9K lines) |
| **Tests** | |
| Total test files | 1,069 |
| Total test lines | ~229,196 |
| Green directly portable tests | ~903 files (~192K lines) |
| Yellow adaptively portable tests | ~145 files (~34K lines) — storage/runtime/CLI/security/recovery/e2e |
| Blue reference-only tests | ~17 files (~3K lines) — soak tests + performance.bak |
| Test infrastructure (helpers) | 19 files / 2,093 lines — 16 Green + 3 Yellow |
| **Documents** | |
| Total document files | ~243 |
| Green directly portable documents | ~48 files |
| Yellow adaptively portable documents | ~74 files |
| Blue reference-value documents | ~84 files |
| White archive-deprecated documents | ~37 files |
| **Other Assets** | |
| config/ directory | 27 JSON files — all directly portable |
| divisions/ directory | 11 division definitions — Yellow adaptive port (need to adapt DomainDescriptor semantic model) |
| **New Development** | |
| Modules requiring entirely new development for new platform | 24 (missing from old system in v2.7 39-70) |
| **Total** | |
| Total files to port | ~1,868 (source 799 + tests 1,069) |
| Total lines to port | ~406K (source ~177K + tests ~229K) |
| Estimated total portability effort | **~70-100 person-days** (including tests, storage/runtime split adaptation, adapter writing; excluding 24 new function module development. v1.0's 48 person-days was only file搬运口径, not accounting for god object split, interface adaptation, E2E test adaptation) |