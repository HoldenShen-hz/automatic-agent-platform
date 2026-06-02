## 2026-04-28 Re-audit Conclusion

The following status matrix covers the current state of the original findings in this file; the original itemized list is preserved later as a historical discovery snapshot. The judgement relies solely on actual source code, configuration, and contract/ADR/spec text; closure tests, closure scripts, and "supersede" placeholder notes are no longer used.

| Topic | Current Status | Root Cause | Current Evidence |
| --- | --- | --- | --- |
| S1 OAPEFLIR Identity Crisis | Fixed | The root cause is that the OAPEFLIR spec/ADR once wrote the cognitive projection view as runtime truth; during the initial v4.3 migration only local contracts were changed, and the reference chain was not closed together. | `docs_zh/architecture/oapeflir-v4.4-executable-spec.md` has been downgraded to `Reference Draft`; `docs_zh/adr/070-conclusion.md`, `072-oapeflir-testing-strategy.md`, `071-plugin-spi-framework.md` and `docs_zh/contracts/workflow_debugger_contract.md`, `plugin_spi_contract.md` have explicitly rolled OAPEFLIR back to a projection/view. |
| S2 Deprecated Terminology Migration Not Executed | Partially Fixed | The root cause is not as simple as "there are still a few old words"; the v3 `workflow/execution/stepId` compatibility layer has long stayed in the first-class model position. Code, contracts, and ADRs continue to reuse old keys, and the migration has not formed a single canonical boundary. | This round has converged `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts` to `nodeId` as the internal primary key, `src/platform/five-plane-state-evidence/events/projections/workflow-timeline-projection.ts` has been supplemented with the canonical `planGraphBundleId / harnessRunId / nodeId` axes, and `src/domains/registry/plugin-spi.ts` has downgraded `stepId/workflowId` to aliases; however, the residual terminology in `src/scale-ecosystem/billing/types.ts` and some contracts/ADRs listed in sections 2.4 / 3.4 have not been fully migrated. |
| S3 RuntimeStateMachine Bypassed | Fixed | The root cause is that Harness / delegation / replay each maintained local state, causing runtime modifications to be scattered in business logic. | After re-auditing the actual files, `runLoop()` in `src/platform/five-plane-orchestration/harness/index.ts` now drives state transitions via `transitionRunStatus()`; `src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts` has been switched to the state machine path; `src/platform/five-plane-execution/ha/replay-worker.ts` has the `assertReplayPolicySafe()` gate. |
| S4 Sandbox Contains `none` Tier | Partially Fixed | The root cause is that the sandbox canonical tier is defined only at the security policy layer, but business packs, plugin SDKs, and delegation contexts have long directly exposed legacy aliases, and the compatible input and canonical output are not layered. | This round has converged the public types in `src/sdk/plugin-sdk/plugin-definition.ts`, `src/sdk/plugin-sdk/plugin-context.ts`, and `src/platform/five-plane-orchestration/agent-delegation/delegation-types.ts` to the canonical 4 tiers; however, `src/platform/five-plane-control-plane/iam/sandbox-policy.ts` and `src/domains/business-pack/business-pack-manifest.ts` still retain alias-compatible resolution, so we cannot claim "completely gone". |
| S5 Budget Protection Missing | Partially Fixed | The root cause has shifted from "no reservation at all" to "scattered budget responsibilities": orchestration does the gate first, the executor then reserves separately, and on failure there is no unified release/settle lifecycle, leading to duplicate reservation and leakage risk. | `src/platform/model-gateway/cost-tracker/budget-guard.ts` is now responsible for the pre-execution gate; this round complemented `release()` in `src/platform/five-plane-execution/budget-allocator.ts` and changed `src/interaction/goal-decomposer/llm-plan-generator.ts` and `src/scale-ecosystem/billing/billing-service.ts` to release the reservation on failure; `src/interaction/goal-decomposer/index.ts` no longer duplicates reservations at the upper layer. |
| S6 Trust Score Bypasses Security Boundary | Original Finding Outdated | The root cause is that previous audits were based on old snapshots and did not reflect the subsequently implemented risk capping and full-auto prohibition logic. | `src/interaction/autonomy/trust-scorer/index.ts` maps `fully_trusted` to `semi_auto`; `src/interaction/autonomy/promotion-engine/index.ts` explicitly blocks automatic `semi_auto -> full_auto` promotion; `src/interaction/proactive-agent/trigger-engine/index.ts` returns `suggest` for `high` risk instead of `auto_execute`. |
| S7 Domain Risk Spec Missing | Fixed | The root cause is that high-risk domains completed baseline onboarding first, and governance constraints were added later, leading to the risk spec being absent at the model layer. | `src/domains/domain-specs.ts` now contains `advisoryOnly / humanAccountable / deterministicHotPathOnly`, and includes default `DomainRiskSpec` for `healthcare / quant-trading / financial-services / legal`. |
| S8 Storage Schema Based on Deprecated Objects | Fixed | The root cause is that the storage contract directly reused the v3 single-machine table model; later when the runtime truth table family was added, the documentation did not switch to the main chain in sync. | `docs_zh/contracts/storage_schema_contract.md` now uses `harness_runs / plan_graph_bundles / node_runs / node_attempts / node_attempt_receipts / budget_*` as authoritative truth, and explicitly downgrades legacy tables such as `executions` to projection / compatibility. |
| S9 Phase 1-9 Still Used as Canonical Staging | Fixed | The root cause is that the previous so-called ring migration only changed the presentation layer; the canonical bootstrap service ids and dependency chains of `domains` remain bound to the historical phase. | This round has converged `src/domains/domains-bootstrap.ts`, `src/domains-runtime-catalog.ts`, `src/domains-startup-plan.ts`, `src/domains-runtime-orchestrator.ts` to use `ring1 / ring2 / ring3` as runtime truth; the legacy `9a-9f` is only retained as bootstrap input mapping. |
| S10 Saga Semantics Missing | Fixed | The root cause is that the org-governance saga was initially just "stitch receipts from input" without a real executor abstraction to carry `prepare/commit/compensate/audit`, so failure points and compensation paths were only in-memory derivations. | After this re-audit, `src/org-governance/org-model/org-governance-saga.ts`, `src/org-governance/knowledge-boundary/chinese-wall-access-saga.ts`, `src/org-governance/delegated-governance/governance-delegation-revocation-saga.ts` have all been changed into executable orchestrators with injectable handlers; on failure, the compensation handler is actually invoked, and `failedStepId/failedStage/executionLog` is written to the receipt. |

## Re-audit Method

- Only the actual file content is used as the basis.
- If a contract/ADR/spec still references old terminology but has been explicitly downgraded to `legacy / projection / migration input`, it is no longer counted as a canonical conflict.
- If a historical finding has been eliminated by actual source code or documentation changes, the original entry later no longer represents the current unfixed state.
- This round only performs targeted verification, not full test suite; the `domains` ring startup, `provider-registry` request context, budget allocator / llm plan generator, SDK / delegation sandbox, and `sub-workflow-executor / workflow-timeline-projection / plugin-spi` compatibility boundary migration related tests have been verified.

## Systematic Problem Summary

| #   | Systematic Theme                                                                                            | Severity | Scope                                 |
| --- | ------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------- |
| S1  | OAPEFLIR Identity Crisis: v4.4 Spec customizes the full set of Runtime objects and state machines, fundamentally conflicting with the main architecture's "projection only" positioning            | CRITICAL | spec + 10+ ADR + 5+ contract             |
| S2  | v3->v4 Terminology Migration Not Executed: ExecutionPlan/ControlDirective/stepId/executionId/workflow_run still canonical | CRITICAL | ~60% contract + ~40% ADR + ~30% code     |
| S3  | RuntimeStateMachine Bypassed: Harness/Delegation/Recovery directly modify status                               | HIGH     | Core runtime code                           |
| S4  | Sandbox "none" Tier: Architecture only allows 4 tiers, code has 5 (including none)                                              | HIGH     | 3+ modules                                  |
| S5  | Budget Protection Missing: Many LLM/execution calls have no pre-BudgetReservation                                           | HIGH     | billing + goal-decomposer + budget-guard |
| S6  | Trust Score Bypasses Security Boundary: directly mapped to full_auto without inherent risk check                                  | CRITICAL | autonomy + promotion-engine              |
| S7  | Domain Risk Spec Missing: high-risk domains (quant/finance/healthcare/legal) lack DomainRiskSpec                                          | HIGH     | 4+ domains                                    |
| S8  | Storage Schema Based on Deprecated Objects: DDL centers on `executions` table, no canonical truth table                           | CRITICAL | storage_schema_contract                  |
| S9  | Phase 1-9 Still Used as Canonical Staging: Ring 1/2/3 not landed                                                    | HIGH     | config + ADR + code                      |
| S10 | Saga Semantics Missing: org-governance saga has no actual compensate/rollback                                         | HIGH     | org-governance                           |

---

## 1. Code vs Architecture

### 1.1 CRITICAL — RuntimeStateMachine Bypassed

| Location                                                                                            | Issue                                                                                                                                        |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/platform/five-plane-orchestration/harness/index.ts:627-696`                                           | `runLoop()` directly modifies status via spread (`status: "running"/"aborted"/"completed"/"waiting_hitl"`), completely bypassing RuntimeStateMachine.transition() |
| `src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts:180,195,246,251,343` | Directly assigns `delegation.status = "cancelled"` etc., bypassing the state machine                                                                                   |
| `src/platform/five-plane-execution/ha/replay-worker.ts:39-77`                                              | ReplayWorker has no ReplaySandboxPolicy guard, violating INV-REPLAY-001 (replay must not produce real side effects)                                                  |

### 1.2 CRITICAL — Deprecated Contracts Exported as First-class

| Location                                                        | Issue                                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/platform/contracts/execution-plan/index.ts`            | Defines `ExecutionPlan` + linear `steps: ExecutionPlanStep[]` as an active contract (architecture requires deprecated only)                        |
| `src/platform/contracts/control-directive/index.ts`         | Defines `ControlDirective` + `createControlDirective()` factory (architecture v4.3 deprecated, must use OperationalDirective/DecisionDirective) |
| `src/platform/contracts/execution-receipt/index.ts`         | Defines `ExecutionReceipt` + `stepId` field (architecture requires NodeAttemptReceipt + nodeRunId/attemptId)                             |
| `src/platform/contracts/types/platform-contracts.ts:70-205` | Complete definition of ExecutionPlan/ControlDirective/ExecutionReceipt interfaces + createExecutionPlan() factory                               |
| `src/platform/contracts/types/platform-contracts.ts:55-62`  | SideEffectRecord only has 4 states (proposed/committed/rolled_back/failed), missing ambiguous/reconciling/confirming                     |

### 1.3 HIGH — Budget Protection Missing

| Location                                                            | Issue                                                                        |
| --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `src/platform/model-gateway/cost-tracker/budget-guard.ts:51-77` | BudgetGuard is a post-hoc check, not a pre-execution atomic BudgetReservation, violating INV-BUDGET-001 |
| `src/interaction/goal-decomposer/index.ts:248-349`              | No budget reservation when calling LLM to generate plans                                    |
| `src/interaction/goal-decomposer/llm-plan-generator.ts:39-46`   | LLM complete() call has no budget guard                                               |
| `src/scale-ecosystem/billing/billing-service.ts:260-277`        | recordUsage is post-hoc accounting, no pre-BudgetReservation                             |

### 1.4 CRITICAL — Trust Score Bypasses Security Boundary

| Location                                                          | Issue                                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/interaction/autonomy/trust-scorer/index.ts:25-39`        | `mapTrustLevelToAutonomyLevel` maps fully_trusted directly to full_auto, no inherent risk/compliance/sandbox check |
| `src/interaction/autonomy/index.ts:240-248`                   | `decideLevel()` only escalates to full_auto based on success rate/volume, does not query inherent risk                                                  |
| `src/interaction/autonomy/promotion-engine/index.ts:30-31`    | 500 executions/99% success rate promotes to full_auto; high/critical domains can be auto-promoted past the security boundary                                      |
| `src/interaction/autonomy/index.ts:252-261`                   | `applyDomainRiskAutonomyCap` only uses a hardcoded list to cap high->semi_auto, does not query DomainRiskSpec, critical domains have no cap         |
| `src/interaction/proactive-agent/trigger-engine/index.ts:1-9` | high-risk action returns auto_execute when requireConfirmation=false (architecture requires default deny)                   |

### 1.5 HIGH — Sandbox "none" Tier

| Location                                                                 | Issue                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/domains/business-pack/business-pack-manifest.ts:73,236`         | SandboxTier contains "none" (Zod schema also includes it); architecture only defines 4 tiers, no none      |
| `src/sdk/plugin-sdk/plugin-definition.ts:26`                         | sandboxTier contains "none"                                               |
| `src/sdk/plugin-sdk/plugin-context.ts:15`                            | sandboxTier contains "none"                                               |
| `src/platform/five-plane-orchestration/agent-delegation/delegation-types.ts:19` | sandboxTier contains "none"/"process"/"container" (not canonical 4-tier naming) |

### 1.6 HIGH — Domain Risk Spec Missing

| Location                                | Issue                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| `src/domains/domain-specs.ts:55-61` | DomainRiskSpecSchema missing advisory_only/human_accountable/deterministic_hot_path_only |
| `src/domains/quant-trading/`        | No DomainRiskSpec declaration (high-risk financial domain)                                          |
| `src/domains/financial-services/`   | No DomainRiskSpec declaration                                                              |
| `src/domains/healthcare/`           | No DomainRiskSpec declaration (arch explicitly requires advisory_only)                               |
| `src/domains/legal/`                | No DomainRiskSpec declaration                                                              |

### 1.7 HIGH — Saga Has No Actual Compensation

| Location                                                                                     | Issue                                                                |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/org-governance/org-model/org-governance-saga.ts:17-39`                              | execute() only classifies steps, no prepare->commit->compensate orchestration; no rollback on failure |
| `src/org-governance/knowledge-boundary/chinese-wall-access-saga.ts:14-23`                | execute() returns rolled_back but does not perform actual compensation/revocation                    |
| `src/org-governance/delegated-governance/governance-delegation-revocation-saga.ts:17-31` | No four-phase (prepare/commit/compensate/audit) semantics                       |

### 1.8 MED — Deprecated Terminology Used in Non-legacy Code

| Location                                                                                     | Terminology Issue                                                  |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `src/platform/five-plane-state-evidence/events/event-registry.ts:73-109`                            | producer = "workflow_runtime" (should be HarnessRuntime)      |
| `src/platform/five-plane-state-evidence/events/projections/workflow-timeline-projection.ts:282-398` | Consumes workflow_run.created/failed/completed events as truth |
| `src/platform/five-plane-control-plane/approval-center/approval-flow-engine.ts:114`                 | workflowRunId in approval records                                |
| `src/platform/contracts/types/domain/billing-types.ts:124`                               | UsageEventRecord uses stepId for cost attribution                     |
| `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:20-36`                  | Defines WorkflowStep/stepId, linear step execution                    |
| `src/ops-maturity/edge-runtime/edge-orchestrator/index.ts`                               | Defines EdgeExecutionPlan (should be PlanGraphBundle)            |
| `src/ops-maturity/edge-runtime/edge-runtime-sync-service.ts:45`                          | Defines EdgeExecutionReceipt (should be NodeAttemptReceipt)      |
| `src/ops-maturity/platform-ops-agent/platform-ops-agent-service.ts:52`                   | Defines OpsExecutionReceipt                                  |
| `src/ops-maturity/workflow-debugger/` (entire module)                                           | Built on stepId/workflow_id, no NodeRun/HarnessRun concept  |
| `src/scale-ecosystem/billing/types.ts:61`                                                | RecordUsageInput has stepId field                           |
| `src/domains/registry/plugin-spi.ts:8`                                                   | MachineOutput.stepId                                      |
| `src/domains/business-pack/pack-migration-service.ts:24,51,90`                           | Migration plan uses stepId throughout                              |

### 1.9 MED — HarnessRun Interface Duplicated and Inconsistent

| Location                                                  | Issue                                                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/platform/five-plane-orchestration/harness/index.ts:168-198` | Local HarnessRun uses runId (not harnessRunId), includes non-canonical states like sleeping/waiting_hitl/recovering |
| `src/platform/five-plane-orchestration/harness/index.ts:160-166` | Local HarnessDecision missing decisionInputBundleId/deciderType/deciderRef/reasonCode                      |

### 1.10 MED — Other

| Location                                                                        | Issue                                                                        |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `src/org-governance/knowledge-boundary/knowledge-boundary-service.ts:48-66` | evaluateAccess lacks tenantId parameter (architecture requires tenant-level isolation)                       |
| `src/org-governance/knowledge-boundary/knowledge-federator.ts:36-82`        | Federated search has no tenant isolation, only filters by orgNodeId                                     |
| `src/interaction/goal-decomposer/index.ts:248-349`                          | Produces TaskGraphDraft but does not route through HarnessRuntime                              |
| `src/platform/five-plane-orchestration/harness/index.ts` (runLoop)                     | HarnessRun interface has no planGraphBundle field, runLoop does not generate/validate PlanGraphBundle |

---

## 2. Contract Docs vs Architecture

### 2.1 CRITICAL — Storage Schema Based on Deprecated Objects

| Contract                             | Issue                                                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage_schema_contract.md:§15 DDL` | DDL centers on `executions` table as PK, 7 tables FK to execution_id; no harness_runs/plan_graph_bundles/node_runs/node_attempts/budget_ledgers canonical truth table DDL |
| `storage_schema_contract.md:§6`      | workflow_step_outputs uses step_id TEXT NOT NULL + UNIQUE(task_id, step_id)                                                                                   |
| `storage_schema_contract.md:§5`      | workflow_state uses current_step_index INTEGER + resumable_from_step TEXT (linear model)                                                                         |
| `storage_schema_contract.md:§11`     | events table uses execution_id FK, no harness_run_id/node_run_id column                                                                                               |
| `storage_schema_contract.md:§15`     | node_attempt_receipts PK uses node_attempt_receipt_id (T-46 deprecated, should be receiptId)                                                                          |
| `storage_schema_contract.md:§15`     | event_consumer_acks DDL misses attempt_count column required by §11                                                                                                    |

### 2.2 CRITICAL — runtime_state_machine_contract Treats Deprecated Objects as Authoritative

| Contract                                | Issue                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `runtime_state_machine_contract.md:§6`  | ExecutionStatus aligns with executions.status, treating deprecated entity as authoritative                       |
| `runtime_state_machine_contract.md:§3`  | WorkflowStatus is an independent state machine, not marked as projection-only                            |
| `runtime_state_machine_contract.md:§1`  | Uses "Phase 1a" to qualify scope (should be Ring 1)                                        |
| `runtime_state_machine_contract.md:§1A` | OAPEFLIR 8-stage state machine as truth-grade state machine (should be projection-only) |

### 2.3 HIGH — Event Namespace Errors

| Contract                                          | Issue                                                                                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `event_bus_contract.md:§6`                        | task.status_changed/workflow.started/workflow.step_completed/workflow.failed as Phase 1a stable events (should be platform.* namespace) |
| `event_registry_and_ops_threshold_contract.md:§4` | task._/workflow._/execution.* registered as Tier 1 truth events                                                                          |
| `event_reliability_matrix_contract.md:§3`         | Same as above                                                                                                                             |
| `event_bus_contract.md:§6`                        | oapeflir.observe._/oapeflir.assess._/oapeflir.plan._ do not use oapeflir.view._ prefix                                                   |

### 2.4 HIGH — Deprecated IDs Used as Canonical Keys

| Contract                                             | Issue                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| `api_surface_contract.md:§3`                         | GET /executions/:executionId/inspect uses deprecated executionId; no /harness-runs/ endpoint |
| `artifact_unified_model_contract.md:§3.1`            | ArtifactRecord uses executionId/planId (should be harnessRunId/planGraphId)           |
| `file_lock_contract.md:§3.1-3.2`                     | FileLockRequest/Record uses execution_id/holder_execution_id                      |
| `debug_inspect_health_backpressure_contract.md:§3.2` | TaskInspectView uses workflow_state + executions[]                                |
| `artifact_store_contract.md:§3`                      | ArtifactRecord only has task_id, missing harness_run_id/node_run_id                        |
| `audit_lineage_and_retention_contract.md:§5`         | Uses execution_id, missing harness_run_id/node_run_id                                  |
| `cost_and_budget_contract.md:§4`                     | CostEvent uses task_id as primary key, harness_run_id/node_run_id are optional             |
| `gateway_message_contract.md:§5`                     | DecisionRequest uses task_id                                                      |
| `gateway_streaming_contract.md:§3`                   | StreamEvent uses task_id                                                          |
| `policy_engine_contract.md:§3.1`                     | PolicyDecisionRequest uses execution_id                                           |
| `runtime_execution_contract.md:§3`                   | ExecutionEnvelope contains workflow_id                                                |
| `explainability_and_stage_rationale_contract.md:§3`  | StageRationale uses task_id as primary key                                                |

### 2.5 HIGH — Key Contracts Missing Canonical Fields

| Contract                                  | Issue                                                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `node-run-attempt-receipt-contract.md:§4` | NodeAttemptReceipt missing harnessRunId/planGraphBundleId/graphVersion/duration (architecture §5.3 explicitly requires) |
| `event_bus_contract.md:§3`                | EventEnvelope missing schema_version/idempotency_key/causation_id/partition_key/ttl/payloadHash      |
| `plugin_spi_contract.md:§2.4`             | DomainPresenterPlugin.present() accepts deprecated DualChannelStepOutput instead of NodeAttemptReceipt          |

### 2.6 HIGH — workflow_debugger_contract Fully Based on Deprecated Model

| Contract                               | Issue                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `workflow_debugger_contract.md` (full text) | Uses workflow_id/step_selector as breakpoint anchors; no HarnessRun/NodeRun/PlanGraph references; no v4.3 remediation |

### 2.7 MED — Other Contract Issues

| Contract                                              | Issue                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `admin_console_and_human_takeover_contract.md:§4`     | Human takeover uses step semantics, does not require RuntimeStateMachine.transition(), no budget reservation |
| `agent_definition_lifecycle_contract.md:§3`           | lifecycle_state transitions have no RuntimeStateMachine enforcement                                      |
| `division_definition_contract.md:§2`                  | default_workflow/orchestration_workflow as canonical reference                            |
| `sla_tier_contract.md`                                | No HarnessRun/NodeRun integration point, no v4.3 remediation                                           |
| `knowledge_boundary_and_federated_search_contract.md` | FederatedSearchRequest missing harnessRunId/nodeRunId audit chain                                     |
| `execution_plane_contract.md:§17`                     | References non-existent governance_control_plane_contract.md                                           |

---

## 3. ADR vs Architecture

### 3.1 HIGH — ADR Defines Canonical Objects Conflicting with Architecture

| ADR                               | Issue                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `060-explicit-planning-hub.md`    | Defines Plan DTO + PlanStep[] linear steps + RuntimeExecuteBridge.executePlan(); fundamentally conflicts with PlanGraphBundle |
| `060:R3 constraints`              | "Execute layer can only accept Plan DTO" — architecture requires P4 to only accept PlanGraphBundle                                     |
| `065-workflow-visual-debugger.md` | Full text uses workflow_id/current_step/WorkflowDAGView/StepInspector (deprecated objects)                             |
| `070-conclusion.md:Evolution Path`      | Uses Phase 1-7 roadmap (architecture explicitly deprecated as historical mapping)                                                         |
| `070-conclusion.md:Key Invariants`    | "OAPEFLIR loop invariant" as key invariant (should be HarnessRuntime + RuntimeStateMachine)                    |

### 3.2 HIGH — Phase Staging Not Migrated to Ring

| ADR                                     | Issue                               |
| --------------------------------------- | ---------------------------------- |
| `033-phased-roadmap.md`                 | Defines Phase 1-7 as canonical roadmap |
| `003-memory-seven-layers.md`            | MVP uses Phase 1/2/3/4               |
| `011-effect-ts-adoption.md`             | Phase 1a/1b                        |
| `012-sqlite-phase-1-2-primary-store.md` | Phase 1/2                          |
| `013-eventemitter-phase-2-boundary.md`  | Phase 2                            |
| `075-controlled-rollout-release.md`     | "Phase 1 simplified version"                   |
| `080-learn-hub-pattern-detection.md`    | "Phase 1 only supports these 3 types"            |
| `096-harness-recovery-controller.md`    | "phase 8b gate"                    |

### 3.3 MED — OAPEFLIR Treated as Runtime

| ADR                                        | Issue                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `072-oapeflir-testing-strategy.md:E2E`     | Treats OAPEFLIR as an executable 8-stage chain for testing "no stage skipped"                       |
| `072:Test 3`                               | "New Plan continues from failed step" uses deprecated step terminology                            |
| `071-plugin-spi-framework.md:OAPEFLIR Association` | Describes OAPEFLIR as "formal extension mechanism" (should be projection)                     |
| 10+ ADR boilerplate                        | OAPEFLIR Execute described as "step execution and Dual-Channel output" (should be cognitive projection) |

### 3.4 MED — Deprecated Terminology as Canonical

| ADR                                               | Issue                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| `019-agent-handoff-four-layer-protocol.md`        | buildFromStepResult(result: StepResult) uses deprecated StepResult/stepId |
| `022-api-contract-and-versioning.md`              | /api/v1/workflow-runs as canonical endpoint                        |
| `028-incident-and-event-handling-architecture.md` | Span "service -> operation -> step" (should be nodeRun/nodeAttempt)    |
| `079-feedback-hub-signals.md`                     | FeedbackSignal uses executionId instead of harnessRunId/nodeRunId        |
| `080-learn-hub-pattern-detection.md`              | EvidenceRef uses executionId/signalId                              |
| `094-harness-durable-execution.md:OAPEFLIR Association`   | "Execute: persist run, step, decision" uses step as truth unit       |
| `095-harness-context-assembly.md:OAPEFLIR Association`    | "Execute: provide context input for Harness step"                        |

### 3.5 LOW — SLA Preconditions Missing

| ADR                                     | Issue                                                          |
| --------------------------------------- | ------------------------------------------------------------- |
| `054-sla-tiered-guarantees.md:platinum` | Offers 99.99% SLA but does not declare automatic failover/quorum/drill evidence preconditions |

---

## 4. OAPEFLIR v4.4 Spec vs Main Architecture

### 4.1 CRITICAL — Spec Customizes the Full Set of Runtime Objects

| Section                | Issue                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------- |
| §3 "Overall Runtime Architecture"   | OAPEFLIR as a Runtime Overlay parallel to HarnessRuntime, with "Node Execution Runtime"            |
| §5 "NodeRun State Machine" | Defines complete NodeRunStatus enum + transition rules (should belong exclusively to RuntimeStateMachine)               |
| §5.4 rule 4         | Claims "node state owned by OAPEFLIR" (OAPEFLIR owns no truth state)                           |
| §7 "PlanGraph Contract" | Defines full PlanGraphBundle/PlanGraph/PlanNode/PlanEdge schema (should belong to P3->P4 canonical contract) |
| §2.1 Execute stage  | Claims to produce NodeRun / NodeAttemptReceipt (these are P4 execution objects, not OAPEFLIR outputs)               |
| §0 "Core Conclusion"       | Claims OAPEFLIR defines "what states can be transitioned / what graphs can be executed / what side effects can be committed"                              |

### 4.2 HIGH — Spec Defines Objects Belonging to Other Planes

| Section                     | Issue                                                                            |
| ------------------------ | ------------------------------------------------------------------------------- |
| §12 "Graph Scheduler"    | Defines ReadyNodeSchedulingPolicy type + 5 scheduling rules (belongs to P4 HarnessRuntime)       |
| §15 "Budget Ledger"      | Defines BudgetLedger/BudgetReservation type (belongs to P5 BudgetAllocator)               |
| §16 "SideEffect Manager" | Defines SideEffectRecord/Status/ExecutionContract/ReversibilityProfile (belongs to P4/P5) |
| §17 "Reconciliation"     | Defines ReconciliationRecord/Status (belongs to P5)                                       |

### 4.3 MED — Other Conflicts

| Section                    | Issue                                                                       |
| ----------------------- | -------------------------------------------------------------------------- |
| §34 Error Code          | OapeflirError type (architecture prefix is PLATFORM.{plane}.{component}.{category})   |
| §37 Capability Matrix   | Core/Durable/Governed/Enterprise/Learning tiers (do not align with Ring 1/2/3)        |
| §41 ADR                 | 18 ADR-OAPEFLIR-* prefixes (implies OAPEFLIR is an independent authority domain)                      |
| §14.1 OapeflirEvent     | Independent event envelope type (could be treated as truth source, violating invariant)        |
| §20 LLM Decision Record | isolated_reexecution_replay as first-class mode (architecture defaults to trace replay) |
| §Title                  | "Executable Specification" (conflicts with "migration input only" positioning)                 |

---

## 5. Config / Bootstrap vs Architecture

### 5.1 CRITICAL — Domain Config Uses Deprecated Phase + Missing Risk Spec

| File                                  | Issue                                           |
| ------------------------------------- | ---------------------------------------------- |
| `config/domains/quant-trading.json:7` | "phase": "9b" (should be Ring)                     |
| `config/domains/healthcare.json:3`    | "phase": "9e" (should be Ring)                     |
| `config/domains/quant-trading.json`   | Missing riskProfile/riskSpec block (high-risk financial domain) |
| `config/domains/healthcare.json`      | Missing riskProfile/riskSpec block (critical-risk domain) |

### 5.2 HIGH — Bootstrap / Catalog Uses Deprecated Staging

| File                                   | Issue                                                    |
| -------------------------------------- | ------------------------------------------------------- |
| `src/domains-runtime-catalog.ts:12-17` | phase9a-phase9f naming                                    |
| `src/domains-startup-plan.ts:27`       | DOMAIN_PHASES uses "9a"-"9f"                              |
| `src/index.ts:49-54`                   | PlatformRootSummary.capabilityCounts uses phase9a-phase9f |

### 5.3 HIGH — Five-Plane Structure Incomplete

| File                                         | Issue                                                |
| -------------------------------------------- | --------------------------------------------------- |
| `src/platform/five-plane-startup-plan.ts:29` | FivePlaneStartupStepId only defines P1-P5, missing X1 cross-cutting plane |
| `src/platform-architecture-bootstrap.ts`     | No explicit P1-P5 + X1 plane identifier                          |

### 7. AI Operations Layer Code vs Architecture (§15-§23)

| #     | Severity   | Code Location                                         | Issue                                                                                                |
| ----- | -------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| R2-1  | CRITICAL | model-gateway/unified-chat-provider.ts           | ChatCompletionRequest missing required traceId/tenantId/costTag fields, architecture §15.2 explicitly requires                     |
| R2-2  | CRITICAL | model-gateway/unified-chat-provider.ts stream()  | No AbortSignal / incremental budget deduction / partial response validation, architecture §15.4 requires real-time streaming budget control        |
| R2-3  | CRITICAL | prompt-engine/prompt-injection-guard.ts          | PromptInjectionDefenseChain is a single-layer regex, no multi-layer chain orchestrator (regex->classifier->LLM judge) as architecture §20.3 requires |
| R2-4  | CRITICAL | prompt-engine/eval/                              | EvalDataset has no minimum sample count validation by risk level, architecture §21.5 requires critical>=200/high>=100/medium>=50             |
| R2-5  | CRITICAL | plugins/builtin-plugin-registry.ts               | Plugin system has no DataTaintPropagation tracking, architecture §23.4 requires cross-plugin data taint label propagation                         |
| R2-6  | HIGH     | model-gateway/cost-tracker/budget-guard.ts       | BudgetPolicy only supports task-level budget, missing platform/pack/step three-level budget hierarchy required by architecture §18                  |
| R2-7  | HIGH     | model-gateway/cost-tracker/chargeback-service.ts | ChargebackAllocation missing fx_rate/cost_source fields, architecture §18.7 requires multi-currency attribution                         |
| R2-8  | HIGH     | prompt-engine/registry/                          | Prompt lifecycle missing deprecated stage, architecture §20.6 defines draft->active->deprecated->archived four stages        |
| R2-9  | HIGH     | plugins/builtin-plugin-registry.ts               | No BundleRevocationSeverity mechanism, architecture §23.6 requires plugin revocation severity grading                                 |
| R2-10 | HIGH     | prompt-engine/eval/                              | LLM-as-Judge has no risk-level-based independence enforcement (high risk requires external independent review), architecture §21.7 explicitly requires                    |
| R2-11 | HIGH     | plugins/ PluginContext                           | No call_depth/delegation_depth tracking, architecture §23.2 requires preventing infinite recursive plugin delegation                            |
| R2-12 | HIGH     | prompt-engine/eval/                              | critical_case_pass==100% only adds finding without blocking release, architecture §21.5 requires this as a hard gate                         |

### 8. Remaining Contract vs Architecture

| #     | Severity | File                                                    | Issue                                                                                                                                      |
| ----- | ------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| R2-13 | HIGH   | runtime_state_machine_contract.md                       | §6 ExecutionStatus 8-state machine conflicts with architecture §25.8 NodeRun 14-state lifecycle, missing admitted/planning/ready/pausing/replanning/compensating                 |
| R2-14 | HIGH   | runtime_state_machine_contract.md                       | §3 WorkflowStatus 7-state missing architecture's 13-state HarnessRun states: created/admitted/planning/ready/pausing/replanning/compensating/aborted                    |
| R2-15 | HIGH   | cost_and_budget_contract.md                             | §4 CostEvent uses task_id as required but harness_run_id is optional, architecture §18 uses HarnessRun as budget subject                                                 |
| R2-16 | HIGH   | cost_and_budget_contract.md                             | §7.4 implicit cost attribution still uses deprecated execution_id, should be node_run_id/attempt_id                                                                       |
| R2-17 | MEDIUM | cost_and_budget_contract.md                             | §4 CostEvent missing budget_reservation_id, architecture §18.3 requires reserve-before-execute linkage                                                        |
| R2-18 | MEDIUM | task_and_workflow_contract.md                           | §6-§7 WorkflowStep/StepOutput use step_id as primary key, should be node_run_id                                                                         |
| R2-19 | MEDIUM | policy_engine_contract.md                               | §3.1 PolicyDecisionRequest uses deprecated execution_id                                                                                            |
| R2-20 | MEDIUM | execution_plane_contract.md                             | §8 ExecutionTicket isolation_level uses deprecated standard/hardened/strict, should be read_only/workspace_write/scoped_external_access/restricted_exec |
| R2-21 | MEDIUM | model_gateway_routing_contract.md                       | ModelRouteRequest missing harness_run_id/node_run_id, cannot satisfy INV-BUDGET-001 budget gate                                                         |
| R2-22 | MEDIUM | observability_contract.md                               | §3 LogEvent missing required harness_run_id/node_run_id fields                                                                                        |
| R2-23 | LOW    | plugin_spi_contract.md vs tool_skill_plugin_contract.md | Lifecycle hook names contradict each other (initialize/activate vs onLoad/onActivate)                                                                      |
| R2-24 | MEDIUM | runtime_state_machine_contract.md                       | Uses ExecutionStatus name instead of canonical NodeRun.status                                                                                      |

### 9. Internal Consistency of Architecture Documentation

| #     | Severity | Location            | Issue                                                                       |
| ----- | ------ | --------------- | -------------------------------------------------------------------------- |
| R2-25 | HIGH   | §45.13 vs §25.8 | HarnessRun state count contradiction: §45.13 defines 6 states, §25.8 defines 13 states                    |
| R2-26 | HIGH   | §45.13 vs §58.6 | finalDecision value contradiction: §45.13 allows 4 values, §58.6 HarnessDecision lists 6 values    |
| R2-27 | HIGH   | §58.6           | Title says "six decisions" but table actually lists 10 kinds, self-contradictory                              |
| R2-28 | MEDIUM | §45.7 vs §58.6  | LoopController decision types: §45.7 lists 5 kinds, §58.6 requires 6 (missing downgrade_mode) |
| R2-29 | MEDIUM | §45.9           | Generator WorkProduct still uses deprecated step_id field                                |
| R2-30 | MEDIUM | §59.2           | ExplanationRequest uses deprecated workflow_id/step_id                              |
| R2-31 | MEDIUM | §35             | contracts/ directory structure contains deprecated named subdirectories (execution-plan/, workflow-run/)      |
| R2-32 | LOW    | §36.3           | Still uses Phase 1-9 as canonical success criteria, conflicts with Ring 1/2/3 system             |


### 11. Harness Runtime Deep Implementation Gaps (§45)

| #     | Severity   | File                                         | Issue                                                                                                                                    |
| ----- | -------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| R3-1  | CRITICAL | orchestration/harness/guardrail-engine.ts    | Guardrails only have policy/risk/tool/evidence/budget 5 layers; §45.20 requires Input (injection defense)/Planning/Tool/Memory/Output five layers — Input and Memory guardrails are completely missing |
| R3-2  | CRITICAL | orchestration/harness/hitl-runtime.ts        | Only supports open/resolve(approve/reject); §45.18 requires 5 HITL types: Inspect/Patch/Override/Takeover/Resume with complete state machines                          |
| R3-3  | CRITICAL | orchestration/harness/index.ts               | HumanResponsibilityRecord (§45.27) not implemented — each HITL operation needs to produce actor/action/scope/rationale/beforeRef/afterRef/expiresAt/auditRef       |
| R3-4  | HIGH     | orchestration/harness/index.ts               | autonomyMode uses manual/supervised/auto/full_auto; §42.1 requires suggestion/supervised/semi_auto/full_auto                                  |
| R3-5  | HIGH     | orchestration/harness/index.ts               | HarnessRun missing §45.13 required fields: tenantId/goal/mode/riskLevel/ownership/auditRefs/traceId 7 fields                                              |
| R3-6  | HIGH     | orchestration/harness/index.ts               | HarnessStep missing §45.13 required fields: nodeRunRefs/rationale/evidenceRefs/toolCalls/latency/cost/error/nextAction 8 fields                           |
| R3-7  | HIGH     | orchestration/harness/index.ts               | HarnessDecision only 6 values; §58.6 requires adding quarantine/revoke_approval/pause_for_external/require_revalidation                               |
| R3-8  | HIGH     | orchestration/harness/toolbelt-assembler.ts  | Only computes allowed/blocked set intersection; §45.4 requires 6-step assembly: domain->constraint->risk->budget->security->reliability                                   |
| R3-9  | HIGH     | orchestration/harness/recovery-controller.ts | Only handles 3 failure types; §45.11 requires 5 types including llm_provider_unavailable/budget_exhausted/platform_panic                                              |
| R3-10 | HIGH     | orchestration/harness/memory-manager.ts      | Namespaces run/domain/shared without governance; §45.16 requires Working/Long-term/Shared with promotion/demotion policy + anti-self-reinforcement                                      |
| R3-11 | HIGH     | orchestration/harness/index.ts               | assertInvariants only checks budget/state; §45.21 defines 10 invariants (INV-1~INV-10) all not enforced                                                    |
| R3-12 | HIGH     | orchestration/harness/index.ts               | PromptExecutionRecord (§45.24) not implemented — needs to freeze promptVersion/modelRoute/inputHash/outputHash/contextSnapshotRef/guardrailResult/usage     |
| R3-13 | HIGH     | orchestration/harness/index.ts               | DecisionInputBundle (§45.25) not implemented — need to freeze evaluator/policy/budget/risk/node/sideEffect/hitl/guardrail state before decision                       |
| R3-14 | MEDIUM   | orchestration/harness/context-assembler.ts   | Directly copies source object; §45.5 requires token budget trimming + relevance scoring + freshness scoring + trust filtering                              |
| R3-15 | MEDIUM   | orchestration/harness/index.ts               | ContextAssemblyContract (§45.23) not implemented — needs per-role context isolation with taintPolicy/rankingPolicy/redactionPolicy                            |

### 12. Org Governance + Scale Ecosystem Deep Gaps (§46-§57)

| #     | Severity   | File                                                          | Issue                                                                                                                                                                    |
| ----- | -------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R3-16 | CRITICAL | scale-ecosystem/multi-region/region-router/                   | RegionDescriptor missing provider/endpoints/dataResidencyPolicy; status uses active/degraded/disabled instead of architecture-required active/standby/draining                                     |
| R3-17 | CRITICAL | scale-ecosystem/multi-region/failover-controller/             | No fencing epoch; §52.3 requires failover to bump epoch, after old leader recovers it can only join as follower                                                                                    |
| R3-18 | CRITICAL | scale-ecosystem/integration/connector-registry/               | ConnectorManifest missing entire ConnectorCapabilityProfile (§57.1): actionRiskProfiles/permissionProbes/quotaProbes/credentialRotationPolicy                                    |
| R3-19 | HIGH     | scale-ecosystem/sla-engine/tier-resolver/                     | SlaTierSchema missing §54.1 required fields: availability/externalP95/internalP99/approvalLatencySlo/incidentResponseSlo/costMultiplier/supportLevel                                   |
| R3-20 | HIGH     | scale-ecosystem/sla-engine/sla-operations-service.ts          | No SLA split by workflow class (§54.3 requires deterministic/LLM-assisted/HITL-waiting with separate commitments)                                                                             |
| R3-21 | HIGH     | scale-ecosystem/marketplace/catalog/                          | Uses listingId instead of §55.2 entryId, missing packId/rating/installCount; certificationStatus enum does not match                                                                          |
| R3-22 | HIGH     | org-governance/compliance-engine/framework-catalog.ts         | auditRequirements is string[] instead of §49.1 required AuditSpec[] (with frequency/evidenceType/retentionPeriod)                                                                |
| R3-23 | HIGH     | org-governance/compliance-engine/inheritance/                 | No PolicyStrictnessComparator (§49.2); incomparable policies silently fall back to Math.min instead of entering compliance approval                                                                              |
| R3-24 | HIGH     | org-governance/approval-routing/route-engine/                 | applySodPolicy does not prevent same-chain mutual approval (§47.1) — two people in the same approval chain can approve each other's requests                                                                                                  |
| R3-25 | HIGH     | org-governance/knowledge-boundary/chinese-wall-access-saga.ts | Missing §50.3 two-phase commit (prepare lock->atomic commit->failure reconciliation); only does simple pass/fail classification                                                                       |
| R3-26 | HIGH     | scale-ecosystem/resource-manager/quota-enforcer/              | QuotaPolicy is single-dimension; §53.2 requires 7-dimension MultiResourceQuotaVector (worker_concurrency/tool_qps/model_tpm/model_rpm/budget_amount/approval_capacity/storage_io), all must pass for admission |
| R3-27 | MEDIUM   | org-governance/delegated-governance/                          | GovernanceDelegationRevocationSaga missing cascade scope (§51.1): needs to cover pending approval/active session/secret lease/worker lease/scheduled trigger                                |
| R3-28 | MEDIUM   | org-governance/org-model/org-governance-saga.ts               | §46.3 requires commit fixed order (identity->approval->budget->domain->agent) with OrgGovernanceSagaReceipt; actual is unordered and has no receipt                                                          |
| R3-29 | MEDIUM   | org-governance/sso-scim/identity-sync-service.ts              | DLQ only records without retry; §48.2 requires retry/backoff + daily reconciliation + IdentityReconciliationReport                                                                                    |
| R3-30 | MEDIUM   | scale-ecosystem/multi-region/cross-region-routing-service.ts  | Cross-border transfer is only boolean allowCrossBorder; §52.4 requires 5-step chain: JurisdictionClassifier->TransferImpactAssessor->MechanismSelector->DataMinimizer->OutputScanner                      |
| R3-31 | MEDIUM   | scale-ecosystem/billing/types.ts                              | RecordUsageInput has single metricType; §53.2 requires multi-dimensional admission guard                                                                                                                  |
| R3-32 | MEDIUM   | org-governance/knowledge-boundary/sharing-gate/               | evaluateKnowledgeShare returns boolean; §50.3 requires going through CrossBoundaryTransform (desensitization/summary/field filtering)                                                                          |

### 13. Operations Maturity + SDK Gaps (§51-§69)

| #     | Severity | File                                                        | Issue                                                                                                                                    |
| ----- | ------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| R3-33 | HIGH   | ops-maturity/explainability/explanation-pipeline-service.ts | StageRationale missing §59.3 fields: rationaleId/alternatives/confidence/decisionInputRef/versionLockRef/visibilityLabels/renderedExplanation     |
| R3-34 | HIGH   | ops-maturity/emergency/platform-panic-service.ts            | PlatformPanicDirective missing §60.1 severity (full/partial)/reconfirmationAfterSeconds/rollbackStrategy                                      |
| R3-35 | HIGH   | ops-maturity/agent-lifecycle/agent-registry/                | AgentLifecycleState missing removed state (§61.3 requires 9 states); transitions missing archived->removed and paused->canary                                      |
| R3-36 | HIGH   | ops-maturity/edge-runtime/edge-runtime-sync-service.ts      | EdgeRuntimeProfile missing §62.2 deviceId/offlineMaxDuration/keyLease/risk_level<=medium gate                                                 |
| R3-37 | HIGH   | ops-maturity/edge-runtime/sync-queue/                       | EdgeSyncEnvelope missing §62.3 device_id/sequence_no/prev_hash/side_effect_dependency_refs/signature/local_time_offset                       |
| R3-38 | HIGH   | sdk/client-sdk/api-client.ts                                | Does not send §22.2 required X-Platform-Version/X-SDK-Version/X-Contract-Version version handshake headers                                                      |
| R3-39 | HIGH   | sdk/cli/index.ts                                            | Missing §22.3 required pack create/test/validate/publish CLI commands                                                                              |
| R3-40 | MEDIUM | ops-maturity/edge-runtime/                                  | Conflict resolution includes accept_edge; §62.3 requires central wins + generating Incident for manual review                                                                |
| R3-41 | MEDIUM | sdk/pack-sdk/pack-manifest.ts                               | BusinessPackManifest missing §22.2 sdk_semver/platform_min_version/platform_max_version/contract_test_generator                              |
| R3-42 | MEDIUM | ops-maturity/cost-optimizer/                                | CostAttributionRecord uses single amountUsd; §64.1 requires 7-dimension breakdown (llm/tool/compute/storage/egress/humanReview/total)                           |
| R3-43 | MEDIUM | ops-maturity/compliance-reporter/                           | Missing ControlCoverageReport + GapAnalyzer (§66.2); evidence-to-control mapping missing controlId/freshness/owner/exception                       |
| R3-44 | MEDIUM | ops-maturity/chaos/                                         | Missing PanicDrillReport (§60.4): ingress_block_time/execution_quiescence_time/plane_ack_success_rate etc.                                      |
| R3-45 | MEDIUM | ops-maturity/multimodal/                                    | MultimodalInputPart missing §68.2 provenance (C2PA/watermark/hash/license)/artifactRef; SafetyFinding missing confidence/policyDecision/appealPath |
| R3-46 | MEDIUM | ops-maturity/drift-detection/cross-agent-analyzer/          | Does not produce CrossAgentDriftAlert (§63.4); missing alert severity + anti-gaming distinction                                                                |
| R3-47 | MEDIUM | ops-maturity/platform-ops-agent/                            | OpsAgentDefinition missing §69.1 ops_data_boundary declaration (only platform metrics/logs/config, no business payload)                                            |
| R3-48 | LOW    | ops-maturity/capacity-planner/                              | failoverReservePercent hardcoded to 15%; §67.2 requires dynamic N+1 by SLA tier                                                                       |
| R3-49 | LOW    | sdk/harness-sdk/                                            | Missing traceReplay/sideEffectReconciliation methods (§22)                                                                                       |
| R3-50 | LOW    | sdk/admin-sdk/                                              | Missing triggerPanic/resumePanic/manageAgentLifecycle/rotateSecrets (§22.1)                                                                   |

### 14. ADR and Architecture Conflicts (Newly Discovered)

| #     | Severity | ADR     | Issue                                                                                                                                                 |
| ----- | ------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| R3-51 | HIGH   | ADR-060 | Defines Plan DTO + RuntimeExecuteBridge as P3->P4 contract; §5.3/INV-GRAPH-001 requires PlanGraphBundle to be the only canonical P3->P4 handoff                      |
| R3-52 | HIGH   | ADR-061 | Lifecycle 6 states (draft/testing/staging/production/deprecated/retired); §61.3 requires 9 states, missing canary/active/paused/archived/removed, has extra production/retired |
| R3-53 | HIGH   | ADR-054 | Platinum promises 99.99%; §54.2 limits to 99.95% (99.99% only promised separately for dedicated deployment tier)                                                                             |
| R3-54 | HIGH   | ADR-042 | Autonomy level supervised/assisted/partial_auto/high_auto/full_auto (5 levels); §42.1 only suggestion/supervised/semi_auto/full_auto (4 levels)                          |
| R3-55 | HIGH   | ADR-083 | Another autonomy naming: manual_only/suggest_only/supervised_execute/trusted_auto_execute — a third mutually incompatible set                                                      |
| R3-56 | MEDIUM | ADR-058 | GlobalCircuitBreaker.open_duration_ms implies TTL auto-release; §60.3 explicitly prohibits Panic TTL auto-release, recovery requires manual two-person confirmation                                       |
| R3-57 | MEDIUM | ADR-022 | Exposes /api/v1/workflow-runs as canonical API; §5.5 declares workflow_run is only a query projection                                                            |
| R3-58 | MEDIUM | ADR-065 | Uses WorkflowDAGView/StepInspector all deprecated concepts, no v4.3 remediation                                                                                   |
| R3-59 | MEDIUM | ADR-040 | Goal decomposition MAX_DEPTH=5 does not reference global call_depth hard cap=8 and anti-multiplication rules (§19.2)                                                                      |
| R3-60 | MEDIUM | ADR-062 | Edge sync column last_write_wins is a legal policy; §25.11 truth data requires single-master writes, LWW violates invariant                                                                   |
| R3-61 | MEDIUM | ADR-060 | References §L.6/§H.2 sections — architecture v4.3 has no such section numbers, cross-refs invalid                                                                                                |
| R3-62 | LOW    | ADR-003 | Title "six layers" but file name "seven-layers", actual architecture and ADR-020 both have six layers — naming is fully confused                                                                              |
| R3-63 | LOW    | ADR-075 | ImprovementCandidate 12-state machine has no architecture support; §56.4 LearningCandidate only has quarantine/approved/rejected/released                                              |
| R3-64 | LOW    | ADR-019 | Claims source section §12 "Agent Handoff"; actually §12 is "Exception Event Handling Architecture" — section ref is wrong                                                                        |

### 15. Remaining Contract Deep Gaps

| #     | Severity | File                                               | Issue                                                                                                                                                |
| ----- | ------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| R3-65 | HIGH   | typed_event_bus_contract.md                        | OAPEFLIR event payloads all use task_id/workflow_id/execution_id; §5.5 requires harnessRunId/nodeRunId/planGraphId                                         |
| R3-66 | HIGH   | typed_event_bus_contract.md                        | PlanCreatedPayload uses step_count implying linear steps; §5 requires PlanGraph (graph structure)                                                                            |
| R3-67 | HIGH   | typed_event_bus_contract.md                        | ExecutionCompletedPayload defines execution_id/outcome/output_refs as execution result model; conflicts with §5 NodeAttemptReceipt (receiptId/nodeRunId/attemptId/status) |
| R3-68 | HIGH   | explainability_and_stage_rationale_contract.md     | StageRationale only has 7 fields; §59.3 requires 11 fields (missing rationaleId/decisionInputRef/versionLockRef/visibilityLabels/confidence/alternatives)                 |
| R3-69 | HIGH   | workflow_debugger_contract.md                      | BreakpointDefinition uses workflow_id/step_selector; §5.5 should be harnessRunId/nodeRunId                                                                 |
| R3-70 | HIGH   | startup_consistency_and_recovery_drill_contract.md | Consistency matrix uses current_step_index/workflow_state; should be HarnessRun.status/NodeRun.status/PlanGraph                                                     |
| R3-71 | MEDIUM | budget-ledger-contract.md                          | BudgetReservation.resourceKind enum missing §18 required storage/bandwidth/memory                                                                           |
| R3-72 | MEDIUM | naming_and_engineering_boundary_contract.md        | §2 lists WorkflowExecutor as canonical engineering name; §5 canonical entry point is HarnessRuntime                                                                      |
| R3-73 | MEDIUM | admin_console_and_human_takeover_contract.md       | takeover operation uses step language (modify next step/skip step/retry step); §5.5 operation granularity is NodeRun                                                                      |
| R3-74 | MEDIUM | nl_entry_and_goal_decomposition_contract.md        | IntentParseResult contains suggested_workflow_id; §5 all execution is HarnessRun, NL should suggest domain/pack/recipe                                                  |
| R3-75 | MEDIUM | typed_event_bus_contract.md                        | OAPEFLIR payload missing derivedFromEventId; event-envelope-contract §4 requires declaring derivation source                                                       |
| R3-76 | MEDIUM | governance_control_plane_contract.md               | §15A release_transition_gate values off/suggest/shadow do not map to §61.3 lifecycle 9 states                                                                     |
| R3-77 | MEDIUM | explainability_and_stage_rationale_contract.md     | ExplanationDepth uses brief/standard/audit; §59.4 requires L1 Summary/L2 Reasoning/L3 Forensic                                                            |
| R3-78 | LOW    | typed_event_bus_contract.md                        | ReplanTriggeredPayload uses old_version/new_version without referencing GraphPatch (baseGraphVersion->newGraphVersion)                                               |
| R3-79 | LOW    | capacity_planning_contract.md                      | Missing CapacityAlert output object (§67.2 requires output when forecast exceeds threshold)                                                                                         |
| R3-80 | LOW    | explainability_and_stage_rationale_contract.md     | No remediation section; does not reference §59 "explanations immutably included in Evidence Plane" + "explanations must be permission-aware" 

### 17. Platform Contracts Layer Fundamental Issues

| #     | Severity   | File                                           | Issue                                                                                                                                                   |
| ----- | -------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R4-1  | CRITICAL | platform/contracts/control-directive/          | ControlDirective still serves as a first-class active export; §5.2 explicitly deprecates it, canonical replacements OperationalDirective/DecisionDirective do not exist anywhere in the codebase                         |
| R4-2  | CRITICAL | platform/contracts/execution-plan/             | ExecutionPlan uses linear steps[] as active contract; §5.3 prohibits linear steps, PlanGraphBundle (graph nodes/edges) is the only P3->P4 handoff                              |
| R4-3  | CRITICAL | platform/contracts/execution-receipt/          | ExecutionReceipt with stepId as primary key is still an active contract; §5.5 canonical is NodeAttemptReceipt (nodeRunId+attemptId)                                          |
| R4-4  | CRITICAL | platform/contracts/types/platform-contracts.ts | Same file contains a second set of ExecutionPlan + ExecutionReceipt + ControlDirective definitions — two sets of deprecated contracts exist in parallel                                                    |
| R4-5  | CRITICAL | platform/five-plane-*/                        | Architecture §4 requires five-plane directory (P1-P5), **actually no five-plane-* directory** — plane separation is not structurally enforceable                                                                 |
| R4-6  | HIGH     | platform/contracts/executable-contracts/       | NodeAttemptReceipt missing harnessRunId/planGraphId/graphVersion/duration/error_detail (§5.3 required)                                                           |
| R4-7  | HIGH     | platform/contracts/request-envelope/           | RequestEnvelope missing confirmedTaskSpecId/principal(typed)/idempotencyKey/priority (§5.3 intake pipeline)                                                  |
| R4-8  | HIGH     | platform/contracts/state-command/              | StateCommand has no leaseId/fencingToken/event/principal — cannot satisfy INV-STATE-001                                                                           |
| R4-9  | HIGH     | platform/contracts/                            | Missing EventAppendCommand/AuditAppendCommand/ArtifactWriteCommand, the three §5.3 inter-plane contract modules                                                           |
| R4-10 | HIGH     | platform/contracts/types/platform-contracts.ts | SideEffectRecord only has 4 states (proposed/committed/rolled_back/failed); executable-contracts defines 16 states — two conflicting definitions coexist                                           |
| R4-11 | MEDIUM   | platform/contracts/executable-contracts/       | LEGACY_CONTRACT_NAMES list has no enforcement mechanism — no deprecation warning/re-export guard/CI lint to prevent new code from importing deprecated modules                                            |
| R4-12 | MEDIUM   | platform/contracts/index.ts                    | Barrel export prefers deprecated types (requestEnvelopeContract) over executable-contracts — incentivizes consuming deprecated interfaces                                                           |
| R4-13 | MEDIUM   | platform/contracts/executable-contracts/       | EventEnvelope missing required runId (§28.1); replayBehavior is optional (§28.1 requires explicit declaration); eventVersion is string instead of §28.1 numeric schemaVersion |
| R4-14 | MEDIUM   | platform/five-plane-control-plane/                        | P2 modules do not emit or consume any OperationalDirective/DecisionDirective — P2->P3/P4 governance gate is structurally missing                                                           |

### 18. Execution + State-Evidence Plane Gaps (§13-§14)

| #     | Severity | File                                                   | Issue                                                                                                                          |
| ----- | ------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| R4-15 | HIGH   | execution/state-transition/transition-service.ts       | Parallel legacy TransitionService directly operates task/workflow/session/execution state, completely bypassing RuntimeStateMachine — INV-STATE-001 bypass |
| R4-16 | HIGH   | execution/runtime-state-machine.ts                     | RuntimeTransitionCommand missing commandId(UUID)/entityType/entityId/principal (§5.3 required)                                          |
| R4-17 | HIGH   | execution/recovery/                                    | No RecoveryCadence/RecoveryReport type; §14.7 requires each Recovery Worker to declare check interval + produce report                                  |
| R4-18 | HIGH   | state-evidence/checkpoints/workflow-step-checkpoint.ts | Checkpoint uses stepId/workflowId/executionId instead of harnessRunId/nodeRunId/planGraphId                                           |
| R4-19 | MEDIUM | execution/state-transition/state-transition-machine.ts | Allows no-op transition (current==next returns silently); RuntimeStateMachine explicitly rejects — two machine behaviors conflict                                 |
| R4-20 | MEDIUM | execution/recovery/replay-boundary-guard.ts            | Only implements trace_replay/reexecution_replay two modes; §28.5 defines three including projection_replay                                           |
| R4-21 | MEDIUM | execution/run-termination-cleanup.ts                   | Always returns complete:true with no actual cleanup; §14.10 requires emitting cleanup_completed/cleanup_failed events                                      |
| R4-22 | MEDIUM | execution/run-termination-cleanup.ts                   | CleanupResourceKind missing callback type (§14.10 cleanup sequence includes "cancel pending callbacks")                                             |
| R4-23 | MEDIUM | execution/budget-allocator.ts                          | reserve() does not go through RuntimeStateMachine.transition(); §25.9 budget changes need the same CAS+event transaction path                                        |
| R4-24 | MEDIUM | execution/queue/bounded-dispatch-event.ts              | BoundedDispatchEvent missing nodeRunId/tenantId/traceId/ordering_policy_version/queue_class (§14.9)                                 |

### 19. Core Invariants Not Enforced (Most Severe Systematic Issue)

| #     | Severity   | Invariant                                               | Bypass Evidence                                                                                                                                                                              |
| ----- | -------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R4-25 | CRITICAL | INV-BUDGET-001 reserve-before-execute                | single-task-happy-path and multi-step-agent-round-loop have all LLM/Tool calls without BudgetReservation; BudgetAllocator.reserve() exists but is never called in execution path; only AdmissionController does coarse estimation |
| R4-26 | CRITICAL | INV-GRAPH-001 PlanGraphBundle as the only P3->P4 contract  | Actual execution path (single-task-happy-path/multi-step-orchestration) creates TaskRecord+WorkflowState+linear steps for direct execution, no PlanGraphBundle; RuntimeEntryGuard exists but is never called                  |
| R4-27 | CRITICAL | INV-RUN-001 HarnessRuntime as the only execution entry              | Two main execution paths do not create HarnessRun; uses legacy TaskRecord/ExecutionRecord for direct execution; RuntimeEntryGuard is not wired into any dispatch path                                                          |
| R4-28 | CRITICAL | INV-STATE-001 Truth mutation must append event in same transaction | single-task-happy-path inserts task/workflow/execution without appending PlatformFactEvent; uses legacy TransitionService instead of RuntimeStateMachine                                                 |
| R4-29 | CRITICAL | INV-REPLAY-001 Replay prohibited from producing real side effects             | ReplayWorker delegates to replayService but does not call ReplayBoundaryGuard; no ReplaySandboxPolicy implementation                                                                                             |
| R4-30 | HIGH     | INV-FENCING fencing token on state writes            | RuntimeStateMachine.assertLeaseAndFencing() only checks NodeRun; HarnessRun/SideEffectRecord/BudgetLedger skip fencing; legacy path completely bypasses                                                |
| R4-31 | HIGH     | INV-SANDBOX no execution without sandbox                     | executeToolCall()/executeAgentRoundLoop() has no sandbox policy check; todo_write hardcodes empty policy {allow:[],deny:[]} and never enforces                                                             |
| R4-32 | HIGH     | INV-APPROVAL risk-proportional approval              | single-task-happy-path hardcodes requiresApproval:0; multi-step-supervisor same; PolicyEngine not wired into execution path                                                                               |
| R4-33 | HIGH     | INV-SIDEEFFECT-001 ambiguous->reconciliation          | No execution path creates SideEffectRecord; web_fetch/web_search produce real side effects but are not recorded/tracked/reconciled                                                                                                |
| R4-34 | HIGH     | INV-POLICY-001 deny-by-default                       | executeToolCall uses hardcoded switch-case dispatch, no PolicyEngine/CapabilityGate pre-check                                                                                                |
| R4-35 | HIGH     | All decisions->immutable evidence                     | LLM calls and tool executions do not produce EvidenceRecord/DecisionInputBundle/HarnessDecision                                                                                                         |
| R4-36 | MEDIUM   | INV-SINGLE-LEADER                                    | Main execution path directly does store.* writes to SQLite without leader check; HACoordinator not wired in                                                                                                              |

### 20. Security / Observability / Error Handling Cross-Cutting

| #     | Severity   | File/Domain                                           | Issue                                                                               |
| ----- | -------- | --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| R4-37 | CRITICAL | control-plane/iam/network-egress-policy.ts          | Default mode="audit_only" — egress violations are only logged, not blocked (§11.5 requires deny as a formal security event)    |
| R4-38 | CRITICAL | interaction/dashboard/dashboard-websocket-server.ts | registerClient() has no authentication/no tenantId/no principal (§11.1 requires all operations to be associated with a principal) |
| R4-39 | HIGH     | entire src/                                             | DataTaintPropagation (§11.6) zero implementation — taint_label never appears in code                   |
| R4-40 | HIGH     | model-gateway/unified-chat-provider.ts              | LLM call has no principal/tenantId/audit/PolicyOutcome (§11.1-11.2)                      |
| R4-41 | HIGH     | model-gateway/circuit-breaker.ts                    | State changes only write logs, do not emit event bus events (§9.4)                                          |
| R4-42 | HIGH     | shared/observability/runtime-metrics-registry.ts    | 10+ canonical harness.* metrics, only 1 is recorded (§12.4)                                   |
| R4-43 | HIGH     | shared/observability/structured-logger.ts           | Missing crosscutting_fabric field (§12.4 requires reliability/security/governance classification)       |
| R4-44 | HIGH     | execution/plugin-executor/adapter-executor.ts       | Retry uses fixed delay, no exponential backoff, no jitter, no idempotency check (§9.3)                  |
| R4-45 | MEDIUM   | interaction/ux/conversation-history-service.ts      | Tenant isolation relies on post-hoc client-side filter, not query-level isolation (§9.1)                        |
| R4-46 | MEDIUM   | model-gateway/unified-chat-provider.ts              | createChatCompletion does not propagate traceId/spanId (§12.7 broken chain)                             |
| R4-47 | MEDIUM   | model-gateway/degradation-controller.ts             | Degradation switch does not emit OperationalDirective, does not interact with mode synthesis chain (§9.5)                       |
| R4-48 | MEDIUM   | execution/plugin-executor/adapter-executor.ts       | Retry exhausted silently returns error, no incident/DLQ/error_code (§12.1)                         |
| R4-49 | LOW      | model-gateway/circuit-breaker.ts                    | failure rate formula has no success count denominator — threshold comparison math is wrong                                    |

### 21. Testing / Config / Bootstrap Alignment

| #     | Severity   | File/Domain                          | Issue                                                                                                                                                                                                                               |
| ----- | -------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R4-50 | CRITICAL | tests/invariants/                  | §2.4 requires 9 invariant test files — **all do not exist** (truth-event-atomicity/harness-run-authority/plan-graph-only-dispatch/budget-reserve-before-execute/no-side-effect-in-replay/side-effect-ambiguous-reconciles/deny-by-default etc.) |
| R4-51 | CRITICAL | tests/                             | INV-BUDGET-001 zero test coverage                                                                                                                                                                                                          |
| R4-52 | CRITICAL | tests/                             | INV-REPLAY-001 zero test coverage                                                                                                                                                                                                          |
| R4-53 | CRITICAL | tests/                             | INV-SIDEEFFECT-001 zero test coverage                                                                                                                                                                                                      |
| R4-54 | CRITICAL | tests/                             | INV-POLICY-001 zero test coverage                                                                                                                                                                                                      |
| R4-55 | HIGH     | config/runtime/default.json        | Uses deprecated defaultStepTimeoutMs; no canonical state machine/five-plane/RuntimeStateMachine config — only 7-field stub                                                                                                                                    |
| R4-56 | HIGH     | config/risk/default.json           | Uses deprecated stepTypeRisk/stepTypeRiskValues; no §28 Event Registry/DLQ model alignment                                                                                                                                                         |
| R4-57 | HIGH     | config/domains/*.json             | Domain workflow config uses linear steps[] + stepName — §13/§45 requires PlanGraph                                                                                                                                                                  |
| R4-58 | HIGH     | config/domains/*.json             | No DomainRiskSpec (advisory_only/human_accountable/deterministic_hot_path_only) — quant-trading high-risk domain has no risk declaration                                                                                                                     |
| R4-59 | HIGH     | platform-architecture-bootstrap.ts | Registered as a flat directory with no mandatory startup order (§7 requires P5->X1->P2->P3->P4->P1)                                                                                                                                                                              |
| R4-60 | MEDIUM   | platform-architecture-types.ts     | No canonical runtime object types (HarnessRun/NodeRun/PlanGraphBundle/BudgetReservation) — only infrastructure types                                                                                                                                |
| R4-61 | MEDIUM   | domains-runtime-catalog.ts         | Still uses phase9a-9f legacy staging (§33 explicitly "historical mapping only", canonical is Ring 1/2/3)                                                                                                                                                              |
| R4-62 | MEDIUM   | index.ts                           | main() has no architecture startup invariant check (ArchitectureInvariantRegistry/NonOverridableInvariantRegistry §2.4)                                                                                                                                    |
| R4-63 | MEDIUM   | index.ts                           | runPlatformRootDemo uses snapshot.workflow.currentStepIndex/stepOutputs deprecated objects as main output                                                                                                                                           |
| R4-64 | MEDIUM   | tests/                             | No contract-naming-consistency.test.ts (§6.4 requires CI lint to scan for deprecated terminology)  

### 23. OAPEFLIR Orchestration Loop Implementation Gaps (§13/§45/§58)

| #     | Severity   | File                                            | Issue                                                                                                                    |
| ----- | -------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| R5-1  | CRITICAL | orchestration/oapeflir/oapeflir-loop-service.ts | Plan stage produces linear Plan{steps[]} — not PlanGraphBundle (§13.7 "Plan must be Graph")                                         |
| R5-2  | CRITICAL | orchestration/oapeflir/oapeflir-loop-service.ts | run() is a single-pass pipeline (O->A->P->E->F->L->I->R->return); replanDecision is computed but no re-entry — not a loop (§45.7 requires re-entrant Plan/Execute)            |
| R5-3  | CRITICAL | orchestration/oapeflir/oapeflir-loop-service.ts | StageTransitionFSM not integrated — FSM is dead code; stage transitions have no validation                                                                 |
| R5-4  | CRITICAL | orchestration/oapeflir/oapeflir-loop-service.ts | HarnessLoopController not integrated — no max-iteration/max-replan/max-duration/max-cost guards                                    |
| R5-5  | HIGH     | orchestration/harness/index.ts decide()         | No downgrade_mode decision branch (§58.6 requires 6 basic decisions)                                                                      |
| R5-6  | HIGH     | orchestration/oapeflir/assessment-service.ts    | Assess does not consume/produce ConstraintPack/EffectivePolicySnapshot/RiskAssessment (§13.1.1)                                       |
| R5-7  | HIGH     | orchestration/oapeflir/oapeflir-loop-service.ts | Evaluator produces ExecutionOutcomeEvaluation instead of §45.10 EvaluationReport (passed/score/issues[]/recommendation/confidence) |
| R5-8  | HIGH     | orchestration/oapeflir/oapeflir-loop-service.ts | Release stage calls PolicyRolloutService.start() with no EvaluationGate/approval/canary/rollback (§13.14)                          |
| R5-9  | HIGH     | orchestration/planner/plan-builder.ts           | No Graph Normalization/Validation/Risk Propagation/Worst-Path Analysis (§13.9-13.12)                                     |
| R5-10 | HIGH     | orchestration/oapeflir/stage-transition-fsm.ts  | FSM prohibits all backward transitions — replan is structurally impossible (§45.7/§13.4 requires feedback->plan)                                             |
| R5-11 | HIGH     | orchestration/oapeflir/oapeflir-loop-service.ts | Observer only merges TaskSituation+SystemSituation; missing event stream/goal decomposition/memory/previous run context (§45.8)                             |
| R5-12 | MEDIUM   | orchestration/oapeflir/oapeflir-loop-service.ts | Replan does not produce GraphPatch (§13.13 requires baseGraphVersion+operations[]+compatibilityReport)                                |
| R5-13 | MEDIUM   | orchestration/oapeflir/oapeflir-loop-service.ts | Execute uses flat ExecuteBridge with no subgraph/child-run support (§13.7 requires explicit modeling of subtasks/delegation)                                 |
| R5-14 | LOW      | orchestration/oapeflir/oapeflir-loop-service.ts | OapeflirLoopResult has no HarnessDecision field — OAPEFLIR layer disconnected from Harness decision model                                          |

### 24. NL Entry + Goal Decomposition + Proactive Agent Gaps (§8/§19/§40-§42)

| #     | Severity   | File                                           | Issue                                                                                           |
| ----- | -------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| R5-15 | CRITICAL | interaction/nl-gateway/index.ts                | pending_user_confirmation state still emits RequestEnvelope (§39.2 requires only confirmed TaskSpec can be produced) |
| R5-16 | CRITICAL | interaction/nl-gateway/index.ts                | No independent classify_risk pipeline stage (§39.2 requires as independent admission gate)                                      |
| R5-17 | HIGH     | interaction/nl-gateway/index.ts                | DetectedIntent.intentType missing "why" (§39 newly added explanation query type)                                       |
| R5-18 | HIGH     | interaction/goal-decomposer/index.ts           | No delegation chain depth limit (§19.2 max=3) and global call_depth hard cap (=8); no anti-multiplication guard                          |
| R5-19 | HIGH     | interaction/goal-decomposer/index.ts           | No proportional budget allocation to subtasks (§40.2); no risk propagation to subtasks                                            |
| R5-20 | HIGH     | interaction/goal-decomposer/index.ts           | GoalLifecycleState missing partially_completed (§40.5)                                               |
| R5-21 | HIGH     | interaction/autonomy/index.ts                  | TrustScore range 0-100; §42.1 requires 0-1000                                                       |
| R5-22 | HIGH     | interaction/autonomy/index.ts                  | Promotion rules have no time-window incident-free check (§42.2 requires 30d/60d/90d zero incidents)                           |
| R5-23 | HIGH     | interaction/autonomy/index.ts                  | No cost-over-budget 200% downgrade rule (§42.2)                                                              |
| R5-24 | HIGH     | interaction/proactive-agent/index.ts           | medium risk proactive action can auto_execute (§41.1 prohibits medium+ direct execution)                                |
| R5-25 | HIGH     | interaction/proactive-agent/trigger-engine/    | resolveTriggerActionMode() also returns auto_execute for medium/high (§41.1 violation)                    |
| R5-26 | MEDIUM   | interaction/autonomy/index.ts                  | TrustDecayWorker has no 180d no-execution->suggestion downgrade (§42.3); no 30d freeze on promotion                        |
| R5-27 | MEDIUM   | interaction/autonomy/index.ts                  | Autonomy level not linked with proactive trigger (§42.5 requires semi_auto or above to allow auto-execution)                            |
| R5-28 | MEDIUM   | interaction/goal-decomposer/index.ts           | No capability validation (§40.2 requires verifying DomainCapability exposed by target domain); no permission narrowing propagation                      |
| R5-29 | MEDIUM   | interaction/proactive-agent/index.ts           | batch_window config exists but evaluate() has no event batch aggregation (§41.4)                                       |
| R5-30 | MEDIUM   | interaction/nl-gateway/index.ts                | ClarificationState has no rounds/maxRounds tracking — could cause infinite clarification loop (§39.5)                           |
| R5-31 | LOW      | interaction/ux/conversation-history-service.ts | restricted/regulated conversation data written to long-term memory (§39.6 requires only session memory storage)              |
| R5-32 | LOW      | interaction/nl-gateway/index.ts                | UserConfirmationReceipt missing scope/time/riskPreviewVersion (§39.3 audit matching requirement)                   |

### 25. Event Stream + API Surface Gaps (§6/§28)

| #     | Severity   | File                                             | Issue                                                                                                                                                          |
| ----- | -------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R5-33 | CRITICAL | platform/contracts/types/domain/session-types.ts | EventRecord missing §28.1 required fields: schemaVersion/aggregateId/runId/sequence/replayBehavior/principal/evidenceRefs                                                 |
| R5-34 | CRITICAL | platform/five-plane-state-evidence/events/event-registry.ts | Two non-interoperable event registries coexist: legacy task:_ colon namespace vs canonical platform._ dot namespace; platform.* has no Tier-1 routing/Zod validation/typed payload                |
| R5-35 | CRITICAL | platform/five-plane-interface/api/http-server/              | No /api/v1/harness-runs and sub-resource routing (§6 canonical API); only legacy /v1/tasks                                                                                 |
| R5-36 | HIGH     | platform/five-plane-interface/api/http-server/              | Missing /api/v1/replay-sessions (§28.5 MVP); admin routes missing all write methods (PUT config/POST panic-directives/POST resume-directives)                                     |
| R5-37 | HIGH     | state-evidence/events/durable-event-bus.ts       | publish() does not persist aggregateId/runId/sequence/schemaVersion — replay ordering is impossible (§28.5)                                                                    |
| R5-38 | HIGH     | state-evidence/events/event-types.ts             | Tier-1 list contains non-architecture events (delegation:_/prompt:_/tenant:_) but missing architecture core facts (platform.harness_run._/platform.node*run.*/platform.side*effect.*/platform.budget.*) |
| R5-39 | MEDIUM   | platform/five-plane-interface/api/http-server/              | WebSocket binds /ws instead of §6 required /ws/v1/stream; task-routes use /v1/tasks without /api/ prefix                                                                       |
| R5-40 | MEDIUM   | state-evidence/events/event-registry.ts          | replayBehavior uses simulate_projection instead of §28.1 canonical simulate                                                                                           |
| R5-41 | MEDIUM   | state-evidence/events/typed-event-bus.ts         | TypedEventPayloadMap does not contain platform._/oapeflir._ events — compile-time type checking silently excludes all canonical runtime events                                                         |

### 26. Delegation + Version Lock + Memory + Truth Deep Gaps (§19/§24/§25/§29)

| #     | Severity | File                                                           | Issue                                                                                                        |
| ----- | ------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| R5-42 | HIGH   | orchestration/agent-delegation/delegation-types.ts             | DelegationResult missing §19.1 required: summary/artifact_refs/trust_level/taint_labels/evidence_refs/policy_outcome |
| R5-43 | HIGH   | orchestration/agent-delegation/collaboration-protocol/types.ts | ACP messages missing §19.1 required: delegationId/childRunId/capabilityIntersection/budgetCap/dataBoundary/deadline       |
| R5-44 | HIGH   | state-evidence/truth/runtime-truth-repository.ts               | transition() has no lease/fencing verification for HarnessRun (§25.3)                                                     |
| R5-45 | HIGH   | orchestration/agent-delegation/delegation-types.ts             | DelegationResult has no taint_labels/data_class — cross-delegation data classification chain is broken                                           |
| R5-46 | MEDIUM | orchestration/agent-delegation/call-depth-budget.ts            | Uses Math.max() instead of sum — global depth limit=8 is actually ineffective (§19.2)                                                        |
| R5-47 | MEDIUM | orchestration/agent-delegation/delegation-manager.service.ts   | delegate() does not call CallDepthBudget.evaluate() — direct delegation bypasses depth check                                            |
| R5-48 | MEDIUM | state-evidence/truth/runtime-truth-repository.ts               | transaction() is in-memory clone-and-rollback without database transactions — truth+event atomicity is not crash-safe (§25.6)                     |
| R5-49 | MEDIUM | state-evidence/knowledge/knowledge-query-service.ts            | Query has no tenant/domain boundary verification (§45.16+§50)                                                                   |
| R5-50 | MEDIUM | state-evidence/memory/memory-decay-service.ts                  | working/procedural has exponential decay applied — §29.2 prohibits silently dropping working, prohibits dropping procedural                            |
| R5-51 | MEDIUM | orchestration/agent-delegation/delegation-types.ts             | Only pipeline/negotiation modes; missing §19.1 broadcast+AggregationPolicy                                          |
| R5-52 | MEDIUM | orchestration/agent-delegation/delegation-types.ts             | DelegationStatus missing discovery/bid/awarded (§19.1 bidding)                                                       |
| R5-53 | MEDIUM | interface/api/middleware/sdk-version-handshake.ts              | Missing platform_min_version compatibility check (§24)                                                                       |
| R5-54 | LOW    | control-plane/config-center/config-versioning-service.ts       | Emits config.version.created instead of §24.2 config.changed hot-reload event                                                |

### 27. ADR and Architecture Conflicts (Second Batch)

| #     | Severity   | ADR                 | Issue                                                                                                                  |
| ----- | -------- | ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| R5-55 | CRITICAL | ADR-026             | Risk factor model (8 factors/weights/18-point scale) is completely incompatible with §10.2 canonical (impact*4/irreversibility*4/...)                             |
| R5-56 | CRITICAL | ADR-001             | Maps OAPEFLIR as an active orchestration loop (OapeflirLoopService orchestrates 8 stages); §13/§45 explicitly state OAPEFLIR is only StageRationale/Audit View |
| R5-57 | HIGH     | ADR-039             | Defines cancel_task intent; §6.3 explicitly removes it — callers must use abort/pause/panic kill                                           |
| R5-58 | HIGH     | ADR-001             | Three-layer CEO/VP architecture as Accepted decision with no remediation; v4.3 §4 has been replaced by five-plane+X1                                                  |
| R5-59 | HIGH     | ADR-002             | "Division" YAML division model has no remediation; v4.3 uses DomainDescriptor+BusinessPack+DomainRiskSpec                       |
| R5-60 | HIGH     | ADR-004             | Workflow data transfer still uses WorkflowState/StepOutput (§5.5 deprecated), no remediation                                               |
| R5-61 | HIGH     | ADR-034             | ADR freeze rule "no direct modification of frozen content" — v4.3 remediation process directly modified 30+ ADRs in violation of this rule                           |
| R5-62 | HIGH     | ADR-041             | TriggerAction.create_task directly creates tasks bypassing §5.3 intake pipeline (TaskDraft->ConfirmedTaskSpec->RequestEnvelope)          |
| R5-63 | MEDIUM   | ADR-006/008/005/002 | Source section references all point to old section numbers (§7/§8/§2) — v4.3 corresponding sections have been fully replaced; cross-refs batch invalid                                         |
| R5-64 | MEDIUM   | ADR-028             | trace span uses "service->operation->step" — step is deprecated terminology (§5.5)                                                         |
| R5-65 | MEDIUM   | ADR-066             | References non-existent §B/§G appendix; v4.3 has no such appendix                                                                            |
| R5-66 | MEDIUM   | ADR-046             | Uses CEO/VP as governance hierarchy — v4.3 §46-§51 uses OrgNode hierarchy                                                                  |
| R5-67 | MEDIUM   | ADR-047             | auto_action timeout auto-execute has no risk-level guard (§10.3 high/critical default deny)                                                   |



### 29. Intake Admission + Dispatcher Scheduling Gaps (§5.3/§14/§25.4)

| #     | Severity | File                                                      | Issue                                                                                                     |
| ----- | ------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| R6-1  | HIGH   | orchestration/harness/runtime/intake-admission-service.ts | §5.3 ClarificationSession stage completely missing; admit() directly RawTaskInput->TaskDraft->ConfirmedTaskSpec without clarification loop |
| R6-2  | HIGH   | orchestration/harness/runtime/intake-admission-service.ts | high/critical tasks do not enforce UserConfirmationReceipt (§39.6) — confirmationReceipt optional and even critical still lets through    |
| R6-3  | HIGH   | execution/dispatcher/admission-controller.ts              | Missing §14.2 scheduling factors: no risk-class isolation routing / no tenant-quota / no sandbox matching / no capability-class gate       |
| R6-4  | HIGH   | execution/dispatcher/                                     | No deterministic graph scheduler (§14.9) — should schedule by priority/risk_class/critical_path_rank/created_order/scheduler_seed   |
| R6-5  | HIGH   | execution/dispatcher/                                     | Missing §14.9 emergency lane (critical NodeRun independent channel)                                                       |
| R6-6  | HIGH   | execution/dispatcher/                                     | Missing dispatch_backpressure_rejected event + DLQ integration (§14.9)                                                   |
| R6-7  | HIGH   | execution/dispatcher/                                     | §14.9 scheduler events missing ready_set/selected_node_ids/ordering_policy_version/worker_pool_snapshot_ref   |
| R6-8  | MEDIUM | execution/dispatcher/admission-controller.ts              | priority uses "urgent" instead of §5.3 canonical "critical"                                                      |
| R6-9  | MEDIUM | execution/dispatcher/                                     | No verification of budget reservation existence before dispatch (§14.2 requires no dispatch without active reservation)                          |
| R6-10 | MEDIUM | execution/worker-pool/worker-registry-service.ts          | No heartbeat staleness detection (§14: gap>30s triggers worker_heartbeat_missing event + lease_reclaim)               |
| R6-11 | MEDIUM | orchestration/routing/intake-router.ts                    | Keyword matching only, no LLM intent extraction/confidence threshold(0.80)/AmbiguityResolver (§39.3)                 |
| R6-12 | MEDIUM | orchestration/harness/runtime/intake-admission-service.ts | policyGuard.allowed hardcoded true — §25.4/§45.2 admission-time policy/capability/risk check is a fiction                              |

### 30. Type System + API Serialization + Shared Layer Issues

| #     | Severity   | File                                                       | Issue                                                                                                             |
| ----- | -------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| R6-13 | CRITICAL | harness/index.ts vs contracts/executable-contracts/        | Two conflicting HarnessRun interfaces (runId+steps[] vs harnessRunId+confirmedTaskSpecId+currentSeq) — no unified re-export/adapter |
| R6-14 | CRITICAL | contracts/control-directive/ + types/platform-contracts.ts | Two incompatible ControlDirective (kind enum vs type enum) — deprecated types duplicated with no canonical replacement                         |
| R6-15 | CRITICAL | contracts/execution-plan/ + types/platform-contracts.ts    | Two ExecutionPlan (both linear steps[]) — deprecated types can be constructed twice with no @deprecated annotation                                        |
| R6-16 | CRITICAL | interface/api/http-server/task-routes.ts                   | POST /v1/tasks accepts {title,priority,source} completely bypassing §5.3 intake pipeline                                        |
| R6-17 | HIGH     | interface/api/http-server/schemas.ts                       | Task status enum (queued/pending/in_progress/done/failed/cancelled) cannot represent canonical 13-state HarnessRunStatus       |
| R6-18 | HIGH     | entire src/                                                    | OperationalDirective/DecisionDirective zero implementation / zero schema / zero import — §5.2 contract matrix completely unlanded                  |
| R6-19 | HIGH     | entire src/ 870+ places                                            | stepId still a common execution identifier (plugin-spi/domain registry/presenter/migration/SDK) — §5.5 only allows legacy projection              |
| R6-20 | HIGH     | harness/index.ts:174                                       | HarnessRun has steps:HarnessStep[] as first-level field — §5.5 HarnessStep is only a semantic projection, embedding naturally violates                                                              |
| R6-21 | MEDIUM   | execution/lease/execution-lease-service-async.ts:502       | `as any` cast on lease audit critical path — bypasses type safety                                                              |
| R6-22 | MEDIUM   | ops-maturity/edge-runtime/edge-orchestrator/               | EdgeExecutionPlan uses linear orderedTaskIds instead of PlanGraph (§4.4)                                                     |
| R6-23 | MEDIUM   | contracts/executable-contracts/schemas.ts:650              | validateExecutableContract() returns unknown — no type narrowing after validation                                                      |
| R6-24 | MEDIUM   | orchestration/harness/runtime/runtime-entry-guard.ts       | assertNoLegacyTruthWrite() only intercepts at runtime — no compile-time @deprecated/no import enforcement                                     |

### 31. Test System Encoding Wrong Model (Blocking Migration)

| #     | Severity   | File                                                | Issue                                                                                                                       |
| ----- | -------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| R6-25 | CRITICAL | tests/unit/platform/contracts/execution-plan/       | 400+ lines validate createExecutionPlan/ExecutionPlanStep+stepId as correct behavior — treats deprecated contract as correctness baseline                        |
| R6-26 | CRITICAL | tests/e2e/multi-step-workflow-comprehensive.test.ts | 7 scenarios all drive WorkflowState CRUD linear step model — migration to canonical will break all e2e                                           |
| R6-27 | CRITICAL | tests/e2e/multi-step-task-execution.test.ts         | 18+ WorkflowState calls assert linear stepping — encodes deprecated execution model as correct                                                                 |
| R6-28 | CRITICAL | tests/e2e/critical-workflows.test.ts                | 16+ WorkflowState calls assert deprecated state transitions (running->paused->completed)                                                           |
| R6-29 | CRITICAL | tests/unit/platform/contracts/control-directive/    | 50+ assertions validate createControlDirective as correct — deprecated contract has complete regression protection                                                   |
| R6-30 | HIGH     | tests/integration/platform/contracts/               | Integration tests import and validate createExecutionPlan+createControlDirective flow — serves as regression gate preventing deprecated removal                                 |
| R6-31 | HIGH     | tests/golden/workflow-validation.test.ts            | golden snapshot encodes linear steps[]+stepId+dependsOnStepIds — PlanGraph migration will break snapshot                                         |
| R6-32 | HIGH     | tests/helpers/fixtures/base.ts+composite.ts         | All fixture factories produce TaskRecord+ExecutionRecord without HarnessRun/NodeRun/PlanGraphBundle/BudgetReservation                   |
| R6-33 | HIGH     | tests/e2e/oapeflir-full-loop.test.ts                | E2E uses stepId-based PlanStep/StepResult to drive OAPEFLIR as execution runtime (§2.4 OAPEFLIR is not a truth source)                        |
| R6-34 | HIGH     | tests/e2e/ all                                     | Zero e2e tests go through canonical intake pipeline; zero e2e tests verify BudgetReservation pre-check; zero e2e tests verify SideEffectRecord lifecycle |

### 32. Remaining Contract Batch Gaps

| #     | Severity   | File                                                                                                | Issue                                                                                                                   |
| ----- | -------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| R6-35 | CRITICAL | event_bus_contract.md                                                                               | Event names task.status*changed/workflow.step_completed/execution.* conflict with architecture platform.harness*run.*/platform.node_run.* |
| R6-36 | CRITICAL | event_registry_and_ops_threshold_contract.md                                                        | Threshold rules bind to deprecated execution._ event types — ops alerts cannot capture canonical platform._ events                                      |
| R6-37 | CRITICAL | result_envelope_contract.md                                                                         | buildTaskResultEnvelope(task, stepOutputs, artifacts) is completely based on pre-v4.3 model                                           |
| R6-38 | CRITICAL | debug_inspect_health_backpressure_contract.md                                                       | TaskInspectView.executions[] + /executions/:executionId/inspect are all deprecated entities                                           |
| R6-39 | HIGH     | data_plane_contract.md                                                                              | ArtifactRef.source_execution_id should be source_harness_run_id/source_node_run_id                                          |
| R6-40 | HIGH     | app_error_contract.md                                                                               | AppError.execution_id uses legacy identifiers                                                                 |
| R6-41 | HIGH     | audit_lineage_and_retention_contract.md                                                             | Audit records use execution_id without harness_run_id/node_run_id — lineage chain broken                                                      |
| R6-42 | HIGH     | context_compaction_and_overflow_contract.md                                                         | CompactionRecord uses session_id/task_id without harness_run_id/node_run_id                                                   |
| R6-43 | HIGH     | workflow_io_compatibility_precheck_contract.md                                                      | Main fields workflow_id/step_id without PlanGraphBundle/NodeRun                                                                  |
| R6-44 | HIGH     | knowledge_spi_contract.md                                                                           | No harness_run_id integration; TrustLevel 4 levels do not reference §29 knowledge boundary rules                                                          |
| R6-45 | MEDIUM   | sla_tier_contract.md / quota_preemption / multimodal_gateway / org_hierarchy / feedback_improvement | All under 60 lines, missing ContractEnvelope compliance + remediation section                                                      |

### 33. ADR and Architecture Conflicts (Third Batch)

| #     | Severity   | ADR     | Issue                                                                                                                  |
| ----- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| R6-46 | CRITICAL | ADR-079 | FeedbackSignal uses taskId+executionId as association key; v4.3 canonical is harnessRunId/nodeRunId — learning objects cannot join truth      |
| R6-47 | CRITICAL | ADR-080 | FailurePattern/EvidenceRef uses executionId — same as R6-46, Learning subsystem disconnected from truth                                     |
| R6-48 | CRITICAL | ADR-033 | Status Accepted defines Phase 1-7 as canonical roadmap with evaluatePhaseAdvance() gate; §33 explicitly "historical mapping only" — should be Superseded |
| R6-49 | HIGH     | ADR-038 | Canary stages CANARY_5/20/50/100 conflict with ADR-075 canonical rollout states (canary_5/partial_25/50/75/stable)               |
| R6-50 | HIGH     | ADR-009 | Uses src/core/ as canonical directory + workflow_state as recovery table — v4.3 §35 uses src/platform/ + harness_runs                  |
| R6-51 | HIGH     | ADR-007 | "Supervisor" has restart/pause/upgrade/terminate Agent permissions — v4.3 §45 places all lifecycle control under HarnessRuntime                         |
| R6-52 | HIGH     | ADR-070 | Status Accepted lists Phase 1-7 + "OAPEFLIR loop invariant" without v4.3 qualifier (projection only) — should be Superseded                         |
| R6-53 | HIGH     | ADR-041 | TriggerAction.create_task bypasses §5.3 intake pipeline                                                                   |
| R6-54 | MEDIUM   | ADR-069 | OpsCapability contains restart_service/scale_up_down direct execution — not through HarnessRuntime+PlanGraphBundle                          |
| R6-55 | MEDIUM   | ADR-072 | Test matrix organized by OAPEFLIR module directory instead of v4.3 canonical runtime modules                                                      |
| R6-56 | MEDIUM   | ADR-078 | Knowledge TrustLevel lacks §10 risk model inherent_risk+trust_score separated mapping — could implicitly lower risk                           |


### 35. UI Monorepo Implementation vs UI Architecture Spec (§1-§7)

| #     | Severity | File/Domain                                        | Issue                                                                                           |
| ----- | ------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| R7-1  | P0     | ui/apps/web/src/feature-registry.ts              | 27 features all eagerly imported, no code split; §4.4.1 requires all features except / and /login to be React.lazy      |
| R7-2  | P0     | ui/vitest.config.ts                              | Coverage threshold (lines:30%/branches:20%) far below §7.2.6 (shared>=90%/ui-core>=80%/features>=70%/apps>=50%) |
| R7-3  | P0     | ui/scripts/perf-budget.mjs                       | JS chunk 550KB/total 1200KB — §7.3.1 requires main<200KB gz/lazy chunk<100KB gz (2.75-5.5x over)       |
| R7-4  | P1     | ui/apps/web/src/app-shell.tsx                    | Routes are flat single-path — no §4.4.1 L2-L5 nested drilling routes (/tasks/:id/evidence etc.)                         |
| R7-5  | P1     | ui/packages/features/                            | Missing feature-flags module (§4.1 Admin dedicated route /admin/feature-flags)                              |
| R7-6  | P1     | ui/packages/features/settings/                   | Settings has no sub-route navigation — §4.2.9 defines 8 sub-pages all missing                                             |
| R7-7  | P1     | ui/packages/shared/api-client/                   | Missing /api/v1/meta/contract-version endpoint (§1.8 contract version negotiation)                                       |
| R7-8  | P1     | ui/packages/shared/api-client/ws-event-router.ts | Missing nl.clarification_needed event mapping (§5.3)                                                      |
| R7-9  | P1     | ui/ root                                         | Missing Playwright/Detox/Spectron/axe-core dependencies (§7.2.4 E2E+accessibility testing)                              |
| R7-10 | P1     | ui/packages/shared/i18n/                         | Only 4 translation keys / 2 locales — §6.4 requires full module coverage                                                   |
| R7-11 | P2     | ui/packages/ui-core/src/design-tokens/           | No primitive/semantic token layering (§6.3.1)                                                       |
| R7-12 | P2     | ui/apps/web/src/app-shell.tsx                    | Route guards hardcode demo permissions — §4.4.3 requires 5-layer dynamic guard chain                                      |
| R7-13 | P2     | ui/packages/shared/api-client/rest-client.ts     | Missing Idempotency-Key header support (§5.6.4)                                                         |
| R7-14 | P2     | ui/pnpm-workspace.yaml + turbo.json              | Conflicts with §2.2 ADR selected npm workspaces — vestigial configuration                                         |

### 36. Backend UI Service vs UI Architecture Spec (§4-§5)

| #     | Severity | File/Domain                                              | Issue                                                                                                                 |
| ----- | ------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| R7-15 | P0     | src/interaction/dashboard/dashboard-projection-service | Only produces totalTasks/tasksByStatus etc. 4 fields; UI spec §4.7.7 requires success_rate/avg_duration_ms/active_agents etc. 10+ fields |
| R7-16 | P0     | src/interaction/dashboard/dashboard-websocket-server   | WS message types dashboard_delta/snapshot do not match UI spec domain event model like task.status_changed/approval.resolved     |
| R7-17 | P0     | src/interaction/dashboard/dashboard-websocket-server   | Subscription model is dashboard-ID-based; UI spec requires channel-based (global/task:{id}/approvals/admin)                         |
| R7-18 | P1     | src/interaction/dashboard/                             | DashboardProjectionService and DashboardWebSocketServer not integrated (has TODO)                                             |
| R7-19 | P1     | src/interaction/dashboard/metric-aggregator/           | Only covers ~15% of required metrics; UI spec 4-layer 28-panel requires complete metric set                                                           |
| R7-20 | P1     | src/interaction/dashboard/health-scorer/               | Returns single value; UI spec StabilityPanelView requires 8 fields (uptime/error_rate/p99 etc.)                                      |
| R7-21 | P1     | src/interaction/dashboard/alert-router/                | Only sorts; no real-time routing/overlay/push/haptic notifications                                                                          |
| R7-22 | P1     | src/platform/five-plane-interface/api/mission-control-service     | MissionControlSnapshot DTO does not match UI spec Dashboard wireframe fields                                                 |
| R7-23 | P1     | src/platform/five-plane-interface/api/mission-control-service     | getWorkflowCockpit() returns inspect-oriented shape instead of UI spec presentation shape                                     |
| R7-24 | P1     | src/platform/five-plane-interface/api/mission-control-service     | getStabilityPanel() returns array instead of UI spec required scalar count                                                              |
| R7-25 | P1     | src/interaction/ux/workflow-builder-service            | Only internal methods, no REST endpoints; UI spec requires CRUD + validate + publish API                                                   |
| R7-26 | P1     | src/interaction/ux/conversation-history-service        | Missing clarificationState/riskPreview/actionOptions[] fields                                                               |
| R7-27 | P1     | src/interaction/ux/conversation-history-service        | No WS event emission; UI spec requires nl.clarification_needed real-time push                                                        |
| R7-28 | P2     | src/interaction/ux/ux-event-tracking-service           | Hardcodes "test:many_events" event type; no §5.4 specified standard event taxonomy                                           |
| R7-29 | P2     | src/interaction/ux/platform-workbench-snapshot-service | Routes do not match UI spec §4.4.1 /workbench/:view                                                                        |
| R7-30 | P2     | src/interaction/dashboard/                             | DashboardAggregationService and DashboardProjectionService are two parallel unintegrated                                             |

### 37. UI-related Contract/ADR vs UI Architecture Conflicts

| #     | Severity | File/Domain                                                     | Issue                                                                                         |
| ----- | ------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| R7-31 | P0     | docs_zh/contracts/ui_console_and_cockpit_contract             | TaskCockpit uses task_id/task_status/current_step — all deprecated terms (should be harness_run_id/NodeRun) |
| R7-32 | P0     | docs_zh/contracts/ui_console_and_cockpit_contract             | WorkflowCockpit uses workflow_id/steps/current_step_index — deprecated linear model                        |
| R7-33 | P0     | docs_zh/contracts/ui_console_and_cockpit_contract             | AdminTakeoverConsole uses retry_step/skip_step/override_step_output — deprecated operation                  |
| R7-34 | P1     | docs_zh/contracts/admin_console_and_human_takeover_contract   | Also uses step language (step_id/step_status) instead of PlanGraph NodeRun                                  |
| R7-35 | P1     | docs_zh/contracts/ui_console_and_cockpit_contract             | Contract navigation only has 4 groups; UI spec has Extended/Shared Features with 12+ modules                         |
| R7-36 | P1     | docs_zh/contracts/gateway_message_contract                    | No console WebSocket push protocol definition                                                            |
| R7-37 | P1     | docs_zh/contracts/dashboard_and_operator_experience_contract  | WorkflowBuilderDraft.steps uses linear model — should be DAG nodes/edges                                  |
| R7-38 | P1     | docs_zh/contracts/hitl_experience_and_explainability_contract | Uses deprecated step terminology (step_id/step_output/step_retry)                                           |
| R7-39 | P2     | ui/docs/adr/                                                  | Only placeholder README; UI spec references ADR-UI-001~009 all do not exist                              |
| R7-40 | P2     | docs_zh/contracts/sdk_surface_contract                        | No MissionControlService typed endpoint definition                                                      |

### 38. Remaining Platform Gaps (API Gateway / Security / Reliability)

| #     | Severity | File/Domain                                    | Issue                                                                         |
| ----- | ------ | -------------------------------------------- | ---------------------------------------------------------------------------- |
| R7-41 | P0     | src/platform/five-plane-interface/api/middleware/       | No rate-limiting middleware; §9.2 requires per-endpoint-class rate limiting           |
| R7-42 | P0     | src/platform/five-plane-interface/api/middleware/       | No Idempotency-Key middleware; §6.2 requires idempotency guarantees                             |
| R7-43 | P0     | src/platform/five-plane-interface/api/http-server/      | Response missing X-Trace-Id header; §6.2 requires end-to-end tracing propagation                            |
| R7-44 | P0     | src/platform/contracts/                      | No inter-plane ContractEnvelope signature verification; §5.2 requires signature+version validation             |
| R7-45 | P0     | src/platform/                                | No bulkhead isolation pattern; §9.1 requires fault isolation between planes                       |
| R7-46 | P0     | src/platform/five-plane-control-plane/iam/              | SAML implementation missing X.509 trust-chain verification/C14N/encrypted assertion (security-critical TODO) |
| R7-47 | P1     | src/platform/five-plane-interface/api/                  | No API version routing/negotiation mechanism; §6.4 requires Accept-Version header routing               |
| R7-48 | P1     | src/platform/stability/                      | Only rehearsal runner, no reusable reliability library (circuit-breaker/retry/timeout all missing) |
| R7-49 | P1     | src/platform/five-plane-interface/api/middleware/       | CORS default allowedOrigins:["*"] + credentials:true — security anti-pattern                |
| R7-50 | P1     | src/platform/five-plane-execution/worker-pool/          | WorkerDrainProtocol 40-line stub missing §8.2 drain-quiesce-terminate three-phase behavior     |
| R7-51 | P1     | src/org-governance/                          | Governance console missing persistent audit log + RBAC check (marked TODO)                            |
| R7-52 | P2     | src/platform/shared/stability/ vs stability/ | Duplicate module trees; unclear responsibility boundary                                                     |


### 40. Platform Core Deep Gaps (Model Gateway / Planner / Recovery / Evidence)

| #     | Severity | File/Domain                                                             | Issue                                                                                                                                |
| ----- | ------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| R8-01 | P0     | src/platform/model-gateway/cost-tracker/budget-guard.ts               | Budget check is stateless comparison; §18.3 requires atomic reserve->execute->settle + BudgetReservation state machine; concurrency can over-spend                               |
| R8-02 | P0     | src/platform/five-plane-execution/recovery/runtime-recovery-service.ts           | Recovery service is read-only — classifies failures and suggests actions but never executes; no saga rollback/compensation executor/CompensationRecord                          |
| R8-03 | P0     | src/platform/five-plane-orchestration/planner/plan-builder.ts                    | Builds legacy Plan (steps array) instead of PlanGraphBundle DAG; no §13.9 graph normalization / §13.11 risk propagation / §13.12 worst-path analysis                       |
| R8-04 | P1     | src/platform/model-gateway/provider-registry/model-routing-service.ts | No latency SLO enforcement; missing latency_optimized routing strategy / P99 tracking / data_residency / pii_input_detected constraints                                      |
| R8-05 | P1     | src/platform/model-gateway/provider-registry/model-routing-service.ts | Routing decisions are in-memory only — not persisted to BudgetLedger or evidence store; missing model selection audit trail                                                       |
| R8-06 | P1     | src/platform/model-gateway/degradation/degradation-controller.ts      | getFallbackCandidates() returns empty array, making D1 degradation dead code; recursive route() can stack overflow                                                           |
| R8-07 | P1     | src/platform/model-gateway/provider-registry/circuit-breaker.ts       | Failure rate formula `(failures/windowSec)*10` is not a percentage; 50% threshold (§9.4) semantics wrong                                                               |
| R8-08 | P1     | src/platform/prompt-engine/eval/llm-eval-service.ts                   | runAbTest() uses hardcoded scores (0.85/0.90) to simulate evaluation; no real LLM call / statistical significance test                                                       |
| R8-09 | P1     | src/platform/five-plane-state-evidence/events/event-registry.ts                  | Main event types use legacy naming (task:status_changed); canonical platform.harness_run.* not wired into main registry                                     |
| R8-10 | P1     | src/platform/five-plane-state-evidence/checkpoints/                              | Checkpoint is based on workflow-step instead of NodeRun/NodeAttempt; missing graphVersion/planGraphId cannot align with PlanGraph                           |
| R8-11 | P1     | src/platform/five-plane-state-evidence/knowledge/semantic-knowledge-graph.ts     | Only 3 edge types (contains/shared_keyword/same_document); missing entity relationship edges / trust propagation / knowledge.trust_downgraded event; in-memory only with no persistence layer           |
| R8-12 | P1     | src/platform/five-plane-orchestration/planner/plan-evaluator.ts                  | Cost estimation is `steps.length * 1000` hardcoded constant; no token estimation / parallel branch detection (§13.8) / risk-weighted cost                                         |
| R8-13 | P1     | src/platform/five-plane-orchestration/planner/plan-dag-validator.ts              | Only validates cycles/self-dependency/missing dependencies; does not check entry/exit node existence / executor availability / risk/budget/tool/sandbox integrity (§13.10)                         |
| R8-14 | P1     | src/platform/five-plane-execution/recovery/failure-classification.ts             | Classifier targets coding-agent errors (schema_error/lint_error/test_failure); not a generic platform recovery classifier (§9.6 exception taxonomy)                           |
| R8-15 | P2     | src/platform/model-gateway/cost-tracker/chargeback-service.ts         | No multi-currency / exchange rate support; §18.4 requires original_currency/base_currency/FX snapshot                                                           |
| R8-16 | P2     | src/platform/model-gateway/fallback/index.ts                          | Fallback selects cheapest healthy alternative; no ordered fallback chain (primary->secondary->tertiary) §15.4                                                           |
| R8-17 | P2     | src/platform/prompt-engine/rollout/prompt-rollout-stage.ts            | Pipeline draft->review->staging->shadow->canary_5->partial_25->50->75->stable; §16.3 only canary(5%)->canary(20%)->stable; extra stages have no automatic rollback quality gate                                        |
| R8-18 | P2     | src/platform/five-plane-state-evidence/memory/memory-layer-model.ts              | working layer LRU eviction has no ContextTruncationReport; §29.2 requires "facts cannot be silently dropped, compression must attach loss report"                                       |

### 41. SDK / Plugin / Domain Registry / Multi-Region / Operations Maturity

| #     | Severity | File/Domain                                                       | Issue                                                                                                        |
| ----- | ------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| R8-19 | P0     | src/sdk/client-sdk/api-client.ts                                | No ContractEnvelope wrapping; §5.2 requires all inter-plane messages to contain schemaVersion/commandId/correlationId/signature  |
| R8-20 | P0     | src/sdk/client-sdk/                                             | No event subscription / streaming API; §6/§28 requires typed event subscription (PlatformFactEvent/ProjectionUpdate/run lifecycle) |
| R8-21 | P0     | src/sdk/harness-sdk/index.ts                                    | appendStep() still uses stage string routing; does not produce NodeAttemptReceipt (§5.3); nodeRunId/planGraphId stuffed into inputs bag  |
| R8-22 | P1     | src/sdk/harness-sdk/index.ts                                    | No PlanGraphBundle build/validation API; §22 SDK must expose graph-level planning operations                                                |
| R8-23 | P1     | src/sdk/admin-sdk/index.ts                                      | No OperationalDirective/DecisionDirective typed methods; pauseHarnessRun/abortHarnessRun bypass directive envelope model      |
| R8-24 | P1     | src/plugins/builtin-plugin-registry.ts                          | Built-in plugins have no PluginManifest; §10 requires owner/trustLevel/sbomRef/publicSdkSurface                               |
| R8-25 | P1     | src/plugins/adapters/github-adapter.ts                          | Plugin load has no signature verification; §10 requires signing.keyId/signature/algorithm verification before activation                                 |
| R8-26 | P1     | src/plugins/ (all built-in plugins)                                     | No complete lifecycle hooks; only initialize/healthCheck/shutdown, missing onLoad/onActivate/onDeactivate/onUnload(§10)     |
| R8-27 | P0     | src/domains/registry/domain-model.ts                            | No DomainManifest type; §37 requires capability matrix/risk classification/schema registry reference               |
| R8-28 | P1     | src/domains/domain-specs.ts                                     | DomainRiskSpecSchema missing advisory_only/human_accountable/deterministic_hot_path_only fields (§3.2 responsibility boundary)     |
| R8-29 | P1     | src/domains/registry/                                           | No dedicated SchemaRegistry; §37 requires domain input/output schema version management + compatibility check                                       |
| R8-30 | P1     | src/domains/registry/domain-registry-service.ts                 | register() auto validated->registered without smoke test gate; §37 requires validation gate                                         |
| R8-31 | P2     | src/domains/registry/domain-model.ts:45                         | WorkflowConfigSchema.steps is linear z.array(StepTemplateConfigSchema) — §13 prohibits complex tasks using linear steps           |
| R8-32 | P1     | src/scale-ecosystem/multi-region/                               | No fencing token/single-leader write enforcement; §25.11/§52.3 requires truth/budget/side-effect writes only through fencing single leader |
| R8-33 | P1     | src/scale-ecosystem/multi-region/cdc-replication-service.ts     | CDC replication has no conflict resolution; applyBatch() blindly applies events without epoch/version fencing check                                     |
| R8-34 | P2     | src/scale-ecosystem/tenant-platform/tenant-platform-service.ts  | No Chinese Wall enforcement / cross-tenant data movement blocking (§50 knowledge domain isolation)                                                     |
| R8-35 | P1     | src/ops-maturity/workflow-debugger/workflow-debugger-service.ts | Debugger uses stepId/workflowId terminology instead of nodeRunId/planGraphId (§65)                                         |
| R8-36 | P1     | src/ops-maturity/workflow-debugger/time-travel-debug-service.ts | Time-travel uses stepId/executionId as primary key; should be nodeRunId/harnessRunId (§5.5)                                 |
| R8-37 | P2     | src/ops-maturity/explainability/                                | No StageRationale/OAPEFLIR projection consumption; §59 requires rendering OAPEFLIR StageRationale as audit explanation                        |
| R8-38 | P2     | src/ops-maturity/edge-runtime/                                  | Edge orchestrator is a single file stub; missing §62 offline capability / local model execution / sync-queue+conflict resolution / deterministic fallback                |
| R8-39 | P2     | src/ops-maturity/                                               | No OpsMaturityScore aggregation model; §69 requires cross-drift/compliance/cost/explainability dimension scoring                      |
| R8-40 | P1     | src/sdk/plugin-sdk/plugin-test-harness.ts                       | executePlugin() entirely mocked returns hardcoded response; §22.4 test harness must execute real plugin lifecycle in sandbox                   |
| R8-41 | P2     | src/scale-ecosystem/marketplace/                                | No AgentCertification/PackCertificationGate; §55 requires pre-release security scan / eval gate / SBOM certification pipeline                 |
| R8-42 | P2     | src/sdk/plugin-sdk/plugin-definition.ts:26                      | PluginSecurityConfig.sandboxTier contains "none"; §10 plugin default distrust — "none" violates INV-POLICY-001                  |

### 42. UI Deep Gaps (Component Library / Accessibility / Native Shell / Offline / Tooling)

| #     | Severity | File/Domain                                               | Issue                                                                                                          |
| ----- | ------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| R8-43 | P0     | ui/packages/shared/auth/src/auth-service.ts             | No token refresh logic; §5.4.4 requires silent refresh 60s before expiry + concurrency lock + 401->redirect                                 |
| R8-44 | P0     | ui/packages/shared/auth/src/auth-service.ts             | No PKCE support; handleSsoCallback directly reads token from URL params without code_verifier/code_challenge/authorization code exchange            |
| R8-45 | P0     | ui/packages/shared/platform/src/web-platform-adapter.ts | Token stored in plaintext in localStorage; §6.5.2 requires HttpOnly Secure Cookie or memory-only                                |
| R8-46 | P1     | ui/packages/ui-core/src/components/                     | Very little ARIA coverage; §6.4.3+§6.4.5 requires all interactive elements to have role/aria-live/aria-label; ListCard/KeyValueTable/buttons all missing     |
| R8-47 | P1     | ui/packages/ui-core/src/components/                     | No keyboard focus management; §6.4.3 requires visible focus ring; designTokens.shadows.focusRing defined but components don't consume                      |
| R8-48 | P1     | ui/packages/ui-core/src/design-tokens/                  | Flat token structure with no primitive/semantic/domain layering; missing risk-level/autonomy-level/status/domain color scales (§6.3.1)     |
| R8-49 | P1     | ui/packages/ui-core/                                    | No animation system / prefers-reduced-motion support; §6.4.3 + §6.3.1 requires animation.ts with fast/normal/slow/easing          |
| R8-50 | P1     | ui/packages/ui-core/src/components/                     | Component library severely incomplete; §6.3.2 requires 50+ components (8 categories); currently only 7 (StatusPill/ListCard/KeyValueTable/FeatureScaffold etc.) |
| R8-51 | P1     | ui/packages/ui-core/src/themes/                         | Theme is JS object not CSS Custom Properties; §6.3.3 requires CSS vars + prefers-color-scheme media query             |
| R8-52 | P1     | ui/tools/mock-server/src/index.ts                       | Mock server only covers 3 endpoints (dashboard/tasks/workflows); §5.2 defines 30+ endpoints; missing approval/agent/policy/WS mock     |
| R8-53 | P1     | ui/tools/codegen/src/index.ts                           | Codegen only generates path constants; §5.4.3 requires typed endpoint functions + query key factories + DTO types                          |
| R8-54 | P1     | ui/apps/mobile/src/App.tsx                              | Mobile platform hardcodes android; §2.5.5/2.5.6 requires Android+iOS support; no runtime platform detection                                  |
| R8-55 | P2     | ui/apps/electron-win/, ui/apps/tauri-*/                | No auto-update mechanism; §7.1.5+§2.5.2 requires electron-updater/Sparkle/Tauri updater; desktop shells are manifest stubs                  |
| R8-56 | P2     | ui/packages/shared/sync/src/offline-queue.ts            | OfflineMutation missing idempotencyKey/retryCount/status fields (§5.4.5)                                              |
| R8-57 | P2     | ui/packages/shared/sync/src/conflict-resolver.ts        | Only server_wins/local_wins/shallow-merge; §5.5.4 requires data-type-specific conflict resolution (CAS/idempotent/first-come-first-served)                   |
| R8-58 | P2     | ui/packages/features/*/src/index.tsx                   | No Error Boundary; §5.6 requires P0-P3 error classification + fallback UI; single component crash takes down entire app                                 |
| R8-59 | P2     | ui/apps/tauri-macos/, ui/apps/tauri-linux/              | No Tauri native integration (Keychain/native menu/Spotlight/D-Bus/XDG/Wayland); src-tauri/ has no main.rs                    |
| R8-60 | P2     | ui/packages/ui-core/src/charts/                         | Charts have no table alternative view; §6.4.3 requires all charts to provide table fallback for screen readers                                   |

### 43. ADR / Contract Newly Discovered Conflicts and Gaps

| #     | Severity | File/Domain                                                   | Issue                                                                                                                                                                           |
| ----- | ------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R8-61 | P0     | docs_zh/adr/066-*.md (×2)                                  | ADR-066 number duplication: compliance-report-auto-generation and plugin-spi-framework share the same number                                                                                       |
| R8-62 | P0     | docs_zh/adr/060-explicit-planning-hub.md                    | Defines Plan DTO (planId/taskId/steps:PlanStep[]/DAGStructure) as P3->P4 canonical contract; v4.3 uses PlanGraphBundle/PlanGraph/PlanNode/PlanEdge — completely different object names; not marked superseded |
| R8-63 | P0     | docs_zh/adr/033-phased-roadmap.md                           | Defines 7-Phase roadmap; v4.3 §33 has been replaced by Ring 1/2/3 model; ADR still Accepted without Ring reference                                                                                           |
| R8-64 | P1     | docs_zh/contracts/event-envelope-contract.md                | Same schema mixes snake_case (schema_version/idempotency_key) and camelCase (eventId/eventType)                                                                                  |
| R8-65 | P1     | docs_zh/contracts/event_bus_contract.md                     | Legacy EventEnvelope uses task_id as association field; v4.3 requires harnessRunId + aggregate association; parallel schema not redirected                                                                  |
| R8-66 | P1     | docs_zh/adr/019-agent-handoff-four-layer-protocol.md        | HandoffSerializer.buildFromStepResult(result: StepResult) references deprecated type; v4.3 uses NodeAttemptReceipt                                                                             |
| R8-67 | P1     | Missing contract: Agent Delegation / Multi-Agent Collaboration | §19 defines complete delegation protocol (DelegationRequest/DelegationReceipt/depth C1-C7); no corresponding contract file                                                                                    |
| R8-68 | P1     | docs_zh/contracts/task-intake-request-contract.md           | TaskDraft/ConfirmedTaskSpec missing domainId field; §30/§37 requires every task entering execution to carry verified domain_id                                                                               |
| R8-69 | P1     | docs_zh/contracts/harness-run-contract.md                   | HarnessRun has tenantId but no domainId; §37 requires domain binding for risk override/knowledge boundary/prompt library selection                                                                                          |
| R8-70 | P1     | Missing contract: ReleaseDecisionView / ReleaseChannel         | §13 lists ReleaseDecisionView as canonical OAPEFLIR projection object; ADR-091 requires ReleaseChannel; both have no contract                                                                          |
| R8-71 | P1     | docs_zh/adr/012-sqlite-phase-1-2-primary-store.md           | Still Accepted scope is "Phase 1a/1b"; v4.3 uses Ring 1 MVP; exit conditions not mapped to Ring boundary                                                                                               |
| R8-72 | P1     | docs_zh/adr/013-eventemitter-phase-2-boundary.md            | Same as above — scope "Phase 1a/1b/Phase 2" has no Ring mapping; exit trigger ("Does Phase 2 replace") no longer defined                                                                                          |
| R8-73 | P2     | docs_zh/contracts/typed_event_bus_contract.md §3A           | All OAPEFLIR event payloads use task_id/workflow_id as primary association fields; v4.3 uses harnessRunId+aggregate association                                                                                 |
| R8-74 | P2     | docs_zh/adr/072-oapeflir-testing-strategy.md                | Tests OAPEFLIR as an independent execution pipeline ("O->A->P->E->F happy path" E2E); v4.3 downgrades OAPEFLIR to projection/view-only                                                                                     |
| R8-75 | P2     | docs_zh/contracts/runtime_state_machine_contract.md §1A     | Defines OapeflirStage as workflow-level state machine (observe->assess->plan->...); v4.3 says OAPEFLIR stages are only projection, not state machine transitions                                                                        |
| R8-76 | P2     | docs_zh/adr/002-division-system.md                          | Uses "division" modeling (division_id); v4.3 §37/§46 uses DomainDescriptor+OrgUnit; ADR still Accepted without deprecation marker                                                                                |
| R8-77 | P2     | docs_zh/contracts/task_and_workflow_contract.md             | WorkflowState contains required division_id field; v4.3 canonical objects (HarnessRun/TaskDraft/RequestEnvelope) lack this field                                                                       |

### 45. Execution Plane Deep Defects (Lease / Dispatch / State-Transition / Delegation)

| #     | Severity | File/Domain                                                                                 | Issue                                                                                                                                     |
| ----- | ------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| R9-01 | P0     | src/platform/five-plane-execution/lease/execution-lease-service.ts:556-663                           | validateWriteAccess does not check expiresAt vs current time; lease with expired TTL but not yet reclaimed still allows write (§8.3 stale detection)                              |
| R9-02 | P0     | src/platform/five-plane-execution/state-transition/transition-service.ts:500-526                     | TaskTerminalTransitionService.apply() uses non-CAS update (updateTaskStatus/updateWorkflowState); concurrent terminal transitions can overwrite each other, violating RT-01 invariant     |
| R9-03 | P0     | src/platform/five-plane-execution/lease/execution-lease-service-async.ts:247-289                     | releaseLeaseSync does not check lease.status!=="active"; expired/reclaimed lease can be released again, breaking audit trail + double-releasing worker slot                       |
| R9-04 | P1     | src/platform/five-plane-execution/state-transition/transition-service.ts:110-119                     | EXECUTION_TRANSITIONS only defines 8 states; §45.13 requires 13 states (missing queued/dispatching/paused/recovering/timed_out)                                    |
| R9-05 | P1     | src/platform/five-plane-execution/dispatcher/execution-dispatch-service.ts:223-251                   | No poison-pill detection; tickets with permanently no matching worker infinitely loop consuming scan time, no failure count / retry limit / dead letter mechanism                                      |
| R9-06 | P1     | src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts:55-76           | All delegation state (delegationStore/chainStore) is pure in-memory Map; process restart loses active delegation chains; SQLite delegation-repository exists but never wired in                  |
| R9-07 | P1     | src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts:405-428         | narrowPermissions replaces parent resource with child request resource (not intersection); child agent can request resources parent doesn't hold, violating §19 trust inheritance/only-narrow rule                          |
| R9-08 | P1     | src/platform/five-plane-execution/lease/types.ts vs execution-lease-service.ts                       | MIN_LEASE_TTL_MS(5s)/MAX_LEASE_TTL_MS(30s) defined but acquireLease never enforces; can pass ttlMs:1 or 999999999 (§8.3 TTL bounds)                    |
| R9-09 | P1     | src/platform/five-plane-orchestration/routing/intake-router.ts                                       | Routing is pure keyword matching, no capability matching; §8.5 requires matching worker/agent capability registration + capacity                                                         |
| R9-10 | P1     | src/platform/five-plane-execution/dispatcher/execution-dispatch-service.ts:227                       | Each ticket iteration instantiates new HealthService (when backpressureSnapshot==null); O(n) health scan + inconsistent backpressure decisions among tickets in same batch                             |
| R9-11 | P2     | src/platform/five-plane-orchestration/agent-delegation/call-depth-budget.ts vs topology-validator.ts | maxCallDepth=8 vs DEFAULT_MAX_DEPTH=3 two independent depth limits uncoordinated; §19 requires single authoritative depth limit                                                 |
| R9-12 | P2     | src/platform/five-plane-state-evidence/truth/async-repositories/event-repository.ts                  | No projection versioning; listEventsForTask returns raw events without snapshot cursor/version stamp; each read is full replay (§4.2 snapshot optimization)                        |
| R9-13 | P2     | src/platform/five-plane-orchestration/routing/agent-team-service.ts:146                              | Execution loop hardcoded ["plan","build","review","validate","repair","validate","release"]; low-risk single-file change still goes through all 7 stages (§8.5 adaptive routing) |

### 46. OAPEFLIR / Harness / Bootstrap Deep Issues

| #     | Severity | File/Domain                                                                   | Issue                                                                                                                            |
| ----- | ------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| R9-14 | P0     | src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:210            | OAPEFLIR contains direct execution logic (executeViaBridge calls executeBridge.executePlan); §45 specifies only projection/view, execution must be delegated to execution plane               |
| R9-15 | P0     | src/index.ts:179-189                                                        | buildPlatformRootSummary initializes all plane directories without dependency order; §2 requires control-plane->state-evidence->execution->orchestration->interaction |
| R9-16 | P1     | src/platform/five-plane-orchestration/oapeflir/ (loop-service vs stage-transition-fsm) | StageTransitionFSM fully implemented (236 lines) but never instantiated/consulted by OapeflirLoopService.run(); FSM is dead code, stage order not enforced                  |
| R9-17 | P1     | src/platform/five-plane-orchestration/oapeflir/assessment-service.ts:65                | routingDecision.division hardcoded "coding"; non-coding domain tasks always misrouted                                                              |
| R9-18 | P1     | src/platform/five-plane-orchestration/oapeflir/final-response.ts:27-48                 | FinalResponse interface 10 fields; §A.3 requires 13 fields (missing executionDurationMs/modelId/retryCount)                                          |
| R9-19 | P1     | config/runtime/default.json                                                 | Only 7 fields; missing §8 required healthCheckIntervalMs/shutdownGracePeriodMs/logLevel/metricsEnabled/tracingEnabled/retryPolicy           |
| R9-20 | P1     | src/platform/five-plane-orchestration/harness/index.ts:57-77                           | ConstraintPack mixes camelCase (toolPolicy) and snake_case (risk_policy/output_policy); serialization inconsistent                                |
| R9-21 | P1     | src/platform/five-plane-orchestration/harness/hitl-runtime.ts:18                       | HitlRuntime stores all requests in in-memory Map, no persistence; process restart loses all pending approval requests (§45 requires HITL state survives crash)                                 |
| R9-22 | P1     | src/platform/five-plane-orchestration/harness/recovery-controller.ts:12-31             | handleFailure does not emit events to state-evidence plane during recovery; §45 requires all lifecycle transitions to have evidence records                                 |
| R9-23 | P1     | platform-architecture-bootstrap.ts:128-148                              | registerPlatformArchitectureServices registers and immediately get()s without health/readiness gate; init failure silently propagates                                        |
| R9-24 | P1     | config/risk/default.json:2                                                  | $schema points to .ts file not JSON Schema; runtime cannot do JSON Schema validation                                                              |
| R9-25 | P2     | config/domains/default.json:98                                              | domain status:"testing" not canonical (§11: draft/active/deprecated/retired)                                                      |
| R9-26 | P2     | config/domains/default.json:7                                               | domain version:1 (integer); §11 requires semver string ("1.0.0") for compatibility check                                                       |
| R9-27 | P2     | src/platform/five-plane-orchestration/harness/oapeflir-harness-mapping.ts:24           | hitl_operator mapped to OAPEFLIR "assess" stage; §45 HITL is feedback/gate mechanism not automatic risk assessment                                       |
| R9-28 | P2     | src/platform/five-plane-orchestration/harness/guardrails/guardrail-engine.ts:91-95     | Never returns retry_same_plan; HarnessDecisionAction union contains this value but guardrails cannot trigger                                                      |
| R9-29 | P2     | src/platform/five-plane-orchestration/oapeflir/runtime-execute-bridge.ts:228           | Dynamic import ../../../core/runtime/orchestrator/index.js — path is outside src/platform/; couples to undeclared core/ module                     |
| R9-30 | P2     | tests/integration/                                                          | No cross-plane event propagation / event sourcing replay / OAPEFLIR FSM validation / PlanGraph execution integration tests; §45 core behavior zero coverage                                      |

### 47. Org Governance / NL Interaction / Autonomy Engine Deep Issues

| #     | Severity | File/Domain                                                     | Issue                                                                                                                                             |
| ----- | ------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| R9-31 | P0     | src/org-governance/org-model/org-governance-saga.ts           | §46.3 requires OrgGovernanceSaga to freeze orgVersion + compute impact diff + ordered sub-steps + compensation; implemented as stub, only groups by type without actual logic                                    |
| R9-32 | P0     | src/interaction/nl-gateway/index.ts:722                       | §39.6 specifies only confirmed TaskSpec can generate RequestEnvelope; buildTask() pre-builds envelope when confirmationReceipt.state="pending_user_confirmation" |
| R9-33 | P1     | src/org-governance/approval-routing/route-engine/index.ts:155 | §47.1 requires parallel joint-signing + sequential level-by-level approval modes; only implements single linear chain without parallel/joint-signing                                                                      |
| R9-34 | P1     | src/org-governance/approval-routing/route-engine/index.ts:257 | normalizeThresholdCny hardcodes USD->CNY exchange rate 7.2; §47.2 requires base_currency+FX snapshot                                                              |
| R9-35 | P1     | src/org-governance/approval-routing/route-engine/index.ts:46  | ApprovalRouteSnapshot has no expiresAt; §47.3 requires expiry/revocation/commit-time revalidation                                                        |
| R9-36 | P1     | src/org-governance/approval-routing/escalation/index.ts       | Timeout escalation uses static escalateToApproverId, does not traverse OrgTree; §47.1 requires walking up the org hierarchy                                                                     |
| R9-37 | P1     | src/org-governance/compliance-engine/inheritance/index.ts     | §49.2 requires PolicyStrictnessComparator + incomparable policies entering compliance approval; uses hardcoded heuristic without comparator interface                                             |
| R9-38 | P1     | src/org-governance/compliance-engine/                         | §49 requires ComplianceExceptionWorkflow (scope/expiresAt/compensating controls) + EvidenceQualityScore/ControlCoverageReport — all not implemented             |
| R9-39 | P1     | src/org-governance/compliance-engine/evidence-collector.ts    | §49.3 requires regular automatic evidence collection (quarterly SOX/continuous HIPAA); implementation only on-demand, no scheduler/cycle/freshness enforcement                                                          |
| R9-40 | P1     | src/interaction/nl-gateway/index.ts:161                       | UserConfirmationReceipt only has not_required/pending two states; missing confirmed state + risk preview version/scope/actor/timestamp (§39)                            |
| R9-41 | P1     | src/interaction/nl-gateway/index.ts:480                       | §39 high/critical directives require dry-run preview; buildRiskPreview is pure keyword matching without actual dry-run execution / side-effect preview                                            |
| R9-42 | P1     | src/interaction/goal-decomposer/index.ts                      | §40.2 requires capability validation + risk propagation through task graph; no DomainDescriptor capability check; risk does not propagate node by node                             |
| R9-43 | P1     | src/interaction/autonomy/promotion-engine/index.ts:27-31      | §42.2 requires human override rate <5%/<1% for promotion; assessPromotion only checks totalExecutions/successRate, never evaluates override rate                       |
| R9-44 | P1     | src/interaction/autonomy/index.ts:329                         | §42.2 requires domain_owner/platform_team approval for promotion; all promotions approvedBy:"auto" without approval gate                                                              |
| R9-45 | P2     | src/interaction/autonomy/promotion-engine/index.ts:24-31      | §42.2 requires per-level no-incident time window (30d/60d/90d); only global incidents>0 check without time window constraint                                                                |
| R9-46 | P2     | src/interaction/goal-decomposer/index.ts:368                  | §40.3 template matching should apply DomainRecipe (§37.7); detectTemplate uses 5 hardcoded regexes without DomainRecipe/DomainDescriptor integration                                     |
| R9-47 | P2     | src/interaction/proactive-agent/index.ts:76                   | §41.5 Suggestion pipeline (Context Builder->Generator->Queue->dashboard); enqueueSuggestion has no context building / quality scoring                                        |

### 48. Contract Deep Conflicts and Gaps (Newly Discovered)

| #     | Severity | File/Domain                                                               | Issue                                                                                                                                                                                                         |
| ----- | ------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R9-48 | P0     | docs_zh/contracts/platform_panic_and_resume_contract.md §3              | PlatformPanicDirective contains optional expires_at TTL; §2.4 invariant explicitly states "Panic cannot be TTL auto-released, recovery requires manual confirmation"                                                                                                     |
| R9-49 | P1     | docs_zh/contracts/observability_contract.md §3                          | LogEvent uses task_id? as primary association key, missing harness_run_id/node_run_id/attempt_id; §5.5 requires HarnessRun as canonical association                                                                                              |
| R9-50 | P1     | docs_zh/contracts/model_gateway_routing_contract.md §2                  | ModelRouteRequest uses taskId without harnessRunId/nodeRunId; INV-BUDGET-001 requires harnessRunId to verify budget reservation                                                                                                     |
| R9-51 | P1     | docs_zh/contracts/budget-ledger-contract.md §3                          | BudgetReservation.resourceKind enum (token/tool/api/compute/human/side_effect/other) is completely mismatched with §53 ResourceKind (worker_concurrency/tool_qps/model_tpm/model_rpm/budget_amount/approval_capacity/storage_io) |
| R9-52 | P1     | docs_zh/contracts/side-effect-reconciliation-contract.md §2             | SideEffectStatus enum missing approved/committed/confirming/manual_review_required/compensation_required states; has extra reserved state (§14.11 has no such state)                                                                       |
| R9-53 | P1     | docs_zh/contracts/cost_and_budget_contract.md §4                        | CostEvent has task_id as required primary key, harness_run_id/node_run_id/attempt_id as optional; break with budget-ledger (requires harnessRunId)                                                                                   |
| R9-54 | P1     | docs_zh/contracts/cost_and_budget_contract.md §3                        | BudgetPolicy.runtime_mode 8 states (full_auto/supervised_auto/read_only/no-write/...) does not overlap at all with sandbox_and_auth_contract §3 4 states (read_only/workspace_write/scoped_external_access/restricted_exec)              |
| R9-55 | P1     | docs_zh/contracts/workflow_static_analysis_and_compensation_contract.md | Full text uses step terminology ("unreachable step detection"/"step id uniqueness check"/"every step with side effects"); v4.3 uses PlanNode/nodeId; no migration section                                                                                           |
| R9-56 | P2     | docs_zh/contracts/multimodal_gateway_contract.md                        | MultimodalRequest missing harnessRunId/nodeRunId/tenantId/traceId (§5.2 ContractEnvelope required); no BudgetReservation reference                                                                                          |
| R9-57 | P2     | docs_zh/contracts/connector_framework_contract.md                       | ConnectorExecutionRequest/Result has no minimum field definition; missing harnessRunId/nodeRunId/sideEffectId association (§14.11 external writes must register SideEffectRecord)                                                                           |
| R9-58 | P2     | docs_zh/contracts/capacity_planning_contract.md                         | CapacitySignal has no tenantId/harnessRunId; resource_type is plain string not aligned with §53 ResourceKind canonical enum                                                                                                |
| R9-59 | P2     | docs_zh/contracts/gateway_streaming_contract.md §3                      | StreamEvent uses task_id as primary association key without harness_run_id/node_run_id; §6.8 legacy task endpoint must resolve to harnessRunId                                                                                                   |
| R9-60 | P2     | docs_zh/contracts/observability_contract.md §4.3                        | StageMetricSample/LoopIterationTrace carries task_id? as association field but T-47 remediation downgrades OAPEFLIR metrics to view-only — positioning contradiction                                                                                    |
| R9-61 | P2     | docs_zh/contracts/plugin_spi_contract.md §2.4                           | DomainPresenterPlugin.present() accepts DualChannelStepOutput (containing deprecated Step type); v4.3 uses NodeAttemptReceipt                                                                                                   |
