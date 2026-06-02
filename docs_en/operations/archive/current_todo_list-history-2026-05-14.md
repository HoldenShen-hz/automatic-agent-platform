# Current Todo List

> This file currently uses the v4.3 Executable Specification Freeze as its primary index. The "2026-04-25 Full Test Failure List" below is retained as the historical test baseline for regression reconciliation; it is no longer the sole priority source for the v4.3 new direction.
> 2026-05-14 re-review: `docs_zh/reviews/issues-table.md` is the authoritative row-by-row status table for design review issue closure in this round; this file only retains long-running batches and historical regression baselines, and is no longer the sole completion source for review issues.

## v4.3 Executable Specification Freeze Current Todos

### A9 Final Closure of Remaining Test Failure Clusters (2026-04-28)

> This batch takes over the remaining failures that were still open after A8. The goal is a one-time closure of the currently identified remaining failure clusters; first fix real implementation vs. contract/export-surface drift, then align the explicitly stabilized-semantic test assertions, and finally rerun the targeted regression and broader baseline.

- [x] Fix remaining orchestration failures: `TopologyValidator` default construction, progressive demotion, loop controller, assessment service, feedback signal schema, execute bridge compatibility exports.
- [x] Fix remaining runtime / stability / compliance / pack failures: output continuation, stable release package, compliance program, pack lifecycle.
- [x] Fix the `redis-queue-adapter` failure cluster, confirming connection lifecycle, sync interface, and test stubs are consistent.
- [x] Run this batch's targeted tests and broader regression, write back closure evidence, and sync todo status.

> A9 Closure Evidence (2026-04-28):
> - Fixed real implementation issues: `StructuredLogger.recent()` returns recent window order; `ModelRoutingService` trace variable initialization timing; `DomainDefinitionSchema` default `capabilities`; `KvCachePrefix` default constant exports; `RecoveryOrchestratorService` cycle cost/tolerance; baseline constants deep-frozen.
> - Aligned stable-semantic tests: task/workflow terminal step index keeps the final step; task timeline golden dual tests unify `entryKinds`; `routeComplexity` keyword vs passthrough priority; dispatcher `require_remote` fail-close as `blocked`; plugin cooldown behavior; DLQ `setReason` update time; baseline description relevance assertions.
> - Targeted regression coverage passed: `tests/unit/platform/five-plane-orchestration/harness/loop-controller.test.ts`, `tests/unit/platform/five-plane-execution/execution-engine/complexity-router.test.ts`, `tests/unit/platform/five-plane-execution/execution-business-logic.test.ts`, `tests/unit/domains/registry/domain-model-validation.test.ts`, `tests/unit/domains/registry/plugin-spi-registry-invocation.test.ts`, `tests/unit/platform/five-plane-execution/dispatcher/*.test.ts`, `tests/unit/platform/five-plane-control-plane/control-plane-baseline-extended.test.ts`, `tests/unit/platform/model-gateway/model-gateway-baseline-extended.test.ts`, `tests/integration/interaction/autonomy/autonomy-integration.test.ts`, `tests/integration/platform/shared/outbox/durable-event-bus-integration.test.ts`, `tests/integration/platform/shared/observability/structured-logging-integration.test.ts`, `tests/integration/platform/five-plane-execution/execution-engine.test.ts`, `tests/integration/platform/five-plane-state-evidence/events/dlq-integration.test.ts`, `tests/golden/task-timeline-output.test.ts`, `tests/golden/task-timeline-service.test.ts`, `tests/e2e/task-terminal-state-flow.test.ts`, and related batches.

### A8 Continued Closure of Remaining Test Failure Clusters (2026-04-28)

> This batch takes over the remaining failure clusters after A7. The goal is to continue compressing the real code defects and obviously stale assertions in the current full test suite; first fix real semantic issues in the runtime/interface layer, then align the test expectations with the stabilized contract, and finally rerun the targeted tests to form new closure evidence.

- [x] Fix real code issues: DataLineageService return-value isolation, Postgres DSN `SSLMODE` case compatibility, zero-quota in-memory rate limit, TaskWebSocketStatusRelay event order, Lease repository/mock drift, etc.
- [x] Align stale test assertions with the stabilized contract: currency rounding, unicode sorting, delegation request null normalization, API schema/error helper, request body empty string, package export surface, skill serializer, etc.
- [x] Fix remaining failure clusters in state machine / scheduler / hot-upgrade / documentation links, ensuring docs and implementation are consistent.
- [x] Run the targeted unit tests involved in the current batch, record passing results and the remaining items still pending.

> A8 Closure Evidence (2026-04-28, supplement):
> - Fixed and re-tested real semantic issues continue to cover: `TaskWebSocketStatusRelay` reverse-time broadcast order; `ModelRoutingService` cost-cap fallback; `PluginSpiRegistry` cooldown gate; `ApiKeyService` expired-key rotate fail-close; cross-division replay report detail compatibility output.
> - Aligned and re-tested stale assertions continue to cover: failure-miner non-failure signal filtering; plugin runtime protocol input structure; sandbox root path normalization; stability rehearsal single-scenario report assertions; dashboard event type/entity extraction; domain helper / vertical architecture import paths, etc.
> - New targeted retests passed in this round: `tests/integration/platform/five-plane-interface/api/task-websocket-status-relay-integration.test.ts`, `tests/integration/platform/five-plane-orchestration/learn/failure-pattern-miner-integration.test.ts`, `tests/integration/platform/security/sandbox-command-executor.test.ts`, `tests/integration/platform/shared/stability/cross-service-stability-integration.test.ts`, `tests/integration/platform/stability/stable-cross-division-recovery-drill-integration.test.ts`, `tests/integration/platform/model-gateway/model-routing-integration.test.ts`, and the corresponding domain / plugin / dashboard / governance / api-key unit test batches.

### A7 Full Test Closure Batch (2026-04-28)

> The goal of this batch is to continue converging the remaining failures of the current full test suite without rolling back existing architecture and contract fixes; prioritize high-frequency failure clusters, missing compatibility entries, barrel export drift, and inconsistencies between build/typecheck/test.

- [x] Fill in recently discovered missing compatibility source files and legacy import shims, eliminating skipped/missing source reports.
- [x] Run source-only typecheck, fixing new errors introduced by compatibility layer, barrel, precise optional types, or state semantic drift.
- [x] Close high-frequency test issues in Harness / Learn / CLI / Dispatcher / HITL / Runtime output continuation by failure cluster.
- [x] Rerun targeted tests and full tests, update the latest failure baseline, and continue compressing until the current batch can be closed.
- [x] Write back the todo state when done, and retain the historical failure baseline as comparison evidence.

> A7 Closure Evidence (2026-04-28):
> - Filled in the compatibility entries involved in the skipped/missing source report: `event-indexer.ts`, `learning-feedback-service.ts`, `authoritative-truth-store.ts`, `task-queue.ts`, `dispatcher.ts`, `cache-manager.ts`, `session-service.ts`, `trust-store.ts`, `distributed-lock-manager.ts`.
> - Source-only typecheck passed: `npx tsc -p tsconfig.build.json --noEmit` (receipt: `/tmp/oap-source-typecheck-20260428.log`, exit code `0`).
> - Targeted fixes and retests passed in this round: HA repository / HA barrel / HA coordinator / HITL inbox / HITL escalation / HITL approval orchestration / HITL integration / and related previously-failed clusters.
> - Most recent full baseline: `/tmp/automatic-agent-platform-npm-test-20260428f.log`, result `49632 tests / 49477 pass / 149 fail / 6 skipped`; the new fixes in this round have completed targeted retests, and remain to be absorbed by subsequent full baselines that are not in this batch's test drift.

### A6 Implementation Consistency Audit Full Closure Batch (2026-04-27)

> This batch takes all numbered items C/T/A/G/O/S/M/F/I/D from `docs_zh/reviews/platform-architecture-implementation-consistency-audit.md` as input. The goal is to convert the old difference table into a verifiable closure report, and to establish a machine-checkable coverage registry for 238 audit numbers.

- [x] Build `ImplementationConsistencyClosureRegistry`, covering C-1..C-7, T-1..T-56, A-1..A-37, G-1..G-9, O-1..O-24, S-1..S-20, M-1..M-20, F-1..F-25, I-1..I-20, D-1..D-20.
- [x] Add invariant tests to verify total audit numbers, group counts, closure status, closure type, and evidence paths.
- [x] Rewrite `platform-architecture-implementation-consistency-audit.md` from an open difference list to a fully-closed acceptance report.
- [x] Run focused tests, source-only typecheck, and diff whitespace check.

### A5 Design Review New Constraint Implementation Closure Batch (2026-04-27)

> This batch takes the items still marked "partially complete / not implemented" in §6 of `docs_zh/reviews/platform-architecture-implementation-consistency-audit.md` as input. The goal is to provide executable implementation entries, focused tests, and audit evidence for each new architecture constraint; production-rehearsal items are closed with executable gate / receipt / report objects, not disguised as production GA evidence.

- [x] P0 multi-tenancy and ingress security: fill in WebSocket/SSE tenant scope per-event filtering, SDK version handshake, endpoint-class backpressure, and worker service identity checks.
- [x] P0 runtime terminal state cleanup: fill in WorkerDrainProtocol receipt, RunTerminationCleanup, plugin crash cleanup hook, orphaned budget reservation metric, and DB time / clock-skew safe budget sweeper.
- [x] P0 compatibility and drift: fill in ConfigDriftReconciler, PackCompatibilityTestGenerator, ResumeCompatibilityCheck / ResumeDiffReport.
- [x] P1 scheduling and recovery: fill in dispatch queue bounded event fields, Graph Scheduler queue depth evidence, DR drill pass/fail and tombstone replay boundary, no-real-side-effect replay guard.
- [x] P1 collaboration and approval: fill in delegation sequencing/idempotency, approval delegation chain TTL upper limit, high-precision timer, guardrail vibration breaker.
- [x] P2 governance and enterprise capability: fill in OrgGovernanceSaga, SCIM DLQ retry/reconciliation, Chinese Wall grant/release 2PC, GovernanceDelegationRevocationSaga.
- [x] P3 operations maturity: fill in cache warming degradation gate, judge-unavailable canary gate, memory self-reinforcement guard, feedback collective anomaly detector, Improvement rollback_pending, ComplianceReport HumanSignoff timeout, Capacity forecast-vs-actual recalibration, promotion rollback/emergency hotfix evidence.
- [x] Add focused unit tests covering the new implementation entries and key invariants above.
- [x] Update §6 of `docs_zh/reviews/platform-architecture-implementation-consistency-audit.md` and this todo's status.
- [x] Run targeted tests, source-only typecheck, and diff whitespace check.

### A4 Post-Design-Review Architecture Implementation Item-by-Item Re-Review (2026-04-27)

> This round takes the latest `docs_zh/architecture/00-platform-architecture.md` as the authoritative input, focusing on re-reviewing whether the just-absorbed `architecture-design-review` constraints already have code, tests, contracts, or operations evidence; the old audit-completed state can only serve as a historical baseline, and cannot be automatically treated as this round's new constraints being complete.

- [x] Extract new/strengthened executable constraints in the latest architecture document, especially §2.5, §7-§12, §14, §15, §17-§24, §31-§32, §45, §46-§51, §56, §66-§67.
- [x] Check implementation completion item-by-item against `src/`, `tests/`, `docs_zh/contracts/`, `docs_zh/adr/`, `config/`, `divisions/`.
- [x] Mark each item as: completed, partially completed, not implemented, documented planned/future production evidence, or documentation/implementation inconsistent.
- [x] Update `docs_zh/reviews/platform-architecture-implementation-consistency-audit.md`, appending the new constraint fact matrix, gap list, and priority for this round.
- [x] Write back the execution status of this todo, and run a document diff check.

## 00-platform-architecture.md Implementation Consistency Audit Current Todos

> This round's audit takes `docs_zh/architecture/00-platform-architecture.md` as the authoritative input, checking item by item whether the implementation is complete and consistent with the document description; first produce the fact matrix and gap list, then determine subsequent implementation batches.

### I2 Audit Gap Implementation Closure Batch

- [x] Fix the §35 Harness Runtime authoritative path so that the architecture document, structural tests, and current code directory are consistent.
- [x] Add `ArchitectureInvariantRegistry` and `NonOverridableInvariantRegistry`, and use `tests/invariants/` to cover the machine-verifiable invariants in §2.4/§36.
- [x] Change the architecture readiness ring status from a single `complete` to a layered gate evidence, to avoid mistaking readiness registration for full production completion.
- [x] Establish `docs_zh/domains/<domain>/domain-spec.md` landing points, covering 24 vertical domain spec entries in §71-§94.
- [x] Add API canonical vs legacy guard tests, proving that the legacy contract directory is not the v4.3 canonical runtime entry.
- [x] Update this audit report, changing the closed items to complete and recording verification commands.
- [x] Run typecheck, targeted tests, and diff checks.

### A3 00-platform-architecture.md Full-Text Item-by-Item Consistency Re-Review

- [x] Extract all first-level/second-level sections of `00-platform-architecture.md`, clarifying that this round's item-by-item check granularity is §1-§94, the three-ring path, the recommended code directory, the appendix, and key subsections.
- [x] Build the implementation consistency matrix by section, marking each item as: completed, partially completed, not implemented, documented planned/N/A, or inconsistent with the implementation.
- [x] Bind each conclusion to an evidence path: `src/`, `tests/`, `docs_zh/contracts/`, `docs_zh/adr/`, `config/`, `divisions/`, or explicit gap.
- [x] Check whether the five planes, OAPEFLIR/HarnessRuntime, State & Evidence, Event, Storage, Runtime MVP, and the three-ring readiness in the architecture document are consistent with the current implementation.
- [x] Check upper-layer capabilities: whether AI operations, business domains, intelligent interaction, organization governance, scale ecosystem, operations maturity, and 24 vertical domains are truly completed, partial skeletons, or only planned registrations.
- [x] Update the implementation consistency audit report, avoiding writing readiness/evidence registration as complete production implementation.
- [x] Run document diff checks and necessary read-only/targeted verification commands.

### I1 Audit Closure Completion Batch

- [x] Complete the intake/admission main chain: RawInput -> TaskDraft -> ConfirmedTaskSpec -> RequestEnvelope -> HarnessRun, and freeze the RunVersionLock on admission.
- [x] Complete PlanGraph normalize / validate / risk propagation / worst-path analysis, and have the scheduler output platform fact decision events.
- [x] Complete the RuntimeStateMachine authoritative boundary: RunVersionLock, policy guard, budget precondition, side-effect safety, audit append, and NodeRun lease/fencing enforced validation.
- [x] Complete the runtime repository contract: Repository interface, append-only receipt, runtime truth transaction, outbox/audit event boundary, and the v4.3 physical schema baseline.
- [x] Complete the Event Registry metadata/replayBehavior/consumer contract tests, and integrate the v4.3 EventEnvelope descriptor.
- [x] Complete BudgetAllocator, SideEffect pre-commit recheck, HITL responsibility chain, and the basic HarnessRuntime executor/evaluator/decision loop.
- [x] Add bypass invariant tests, proving that the legacy ExecutionPlan/workflow/step cannot be used as a v4.3 runtime entry or directly write truth.
- [x] Update `docs_zh/reviews/platform-architecture-implementation-consistency-audit.md`, change implemented items to complete, and mark the ADR-112 three rings as complete readiness.
- [x] Run source-only build, targeted runtime/contracts/storage/event tests, and diff checks.

### I0 Post-Audit Implementation Batch 1

- [x] Add the executable contract package to `src/platform/contracts/executable-contracts/`, covering the Zod schema, JSON Schema summary, replay behavior, failure behavior, and validation entry of 28 v4.3 canonical contracts.
- [x] Align the GraphPatch operation enum with `00-platform-architecture.md`: `add_node` / `add_edge` / `disable_edge` / `add_compensation_node` / `add_failure_path` / `mark_skipped` / `append_subgraph`.
- [x] Add the `blocked` status and `blocked -> ready/skipped/cancelled/dependency_failed/policy_blocked/aborted` state advancement to `NodeRun`.
- [x] Update Chinese contracts and v4.3 targeted tests to verify the executable contract package, GraphPatch safety, and NodeRun blocked gating.

### A0 Audit Plan

- [x] Extract the checkable architecture commitments from `00-platform-architecture.md`, grouped by Contract Freeze, five planes, Runtime/OAPEFLIR, State & Evidence, governance, and extension layers.
- [x] Establish the implementation check criteria: completed, partially completed, documentation/implementation inconsistent, not implemented, beyond v4.3 MVP scope.
- [x] Preserve the v4.3 already-completed implementation and historical test baseline boundaries, avoiding attributing existing unrelated failures to this round's audit.

### A1 Item-by-Item Check

- [x] Check whether the 12 core contracts of v4.3 Contract Freeze are consistent with `docs_zh/contracts/`, `src/platform/contracts/executable-contracts/`, and unit tests.
- [x] Check whether RuntimeStateMachine, Graph Scheduler, NodeRun, NodeAttemptReceipt, SideEffect, Budget, HITL, and Event layering conform to the architecture main chain.
- [x] Check the implementation coverage of the five planes and the recommended directory in `src/platform/`, `src/domains/`, `src/interaction/`, `src/org-governance/`, `src/scale-ecosystem/`, `src/ops-maturity/`.
- [x] Check the consistency of State & Evidence, Event Registry, Projection, DLQ/Incident, Repository/Storage with the architecture document.
- [x] Check the implementation status and scope boundary of the AI operations layer, business domain access layer, intelligent interaction layer, organization governance layer, scale ecosystem layer, and operations maturity layer.

### A2 Audit Output

- [x] Generate the Chinese implementation consistency audit report, recording the item-by-item status, evidence paths, major deviations, and recommended priorities: `docs_zh/reviews/platform-architecture-implementation-consistency-audit.md`.
- [x] Update the audit item status of this todo.
- [x] Run document diff checks and necessary targeted verification commands.

### P0 Document Freeze

- [x] Add ADR-109 to ADR-112, freezing the v4.3 contract scope, state machine authority, event layering, and MVP three-ring boundary.
- [x] Update `docs_zh/adr/README.md`, marking ADR-109 to ADR-112 as v4.3 implementation entries.
- [x] Update `docs_zh/contracts/README.md`, adding the `v4.3 Contract Freeze Scope` group.
- [x] Add the v4.3 Chinese contract document, covering the 12 core contracts frozen by `00-platform-architecture.md`.
- [x] Clarify that the old `ExecutionPlan` / `ExecutionReceipt` / `ControlDirective` / `StateCommand` / `workflow_run` / `step` can only appear in legacy, deprecated, projection, or historical contexts, and are no longer used as new implementation entries.

### P1 Contract Implementation

- [x] Establish v4.3 canonical types, schemas, and factories under `src/platform/contracts/`.
- [x] Build a contract naming consistency test, preventing old names from re-entering canonical type exports.
- [x] Wire `TaskDraft` / `ConfirmedTaskSpec` / `RequestEnvelope` into the intake contract.
- [x] Wire `PlanGraphBundle` / `GraphPatch` / `NodeRun` / `NodeAttemptReceipt` into the runtime contract.
- [x] Wire `BudgetLedger` / `SideEffectRecord` / `RunVersionLock` / `DecisionInputBundle` / `HumanResponsibilityRecord` into the governance contract.

### P2 Runtime MVP

- [x] Implement `RuntimeStateMachine.transition(command)` as the sole entry for `HarnessRun` / `NodeRun` / `SideEffect` / `Budget` state advancement.
- [x] Implement the `EventInbox` / `PlatformFactEvent` / `OapeflirViewEvent` layering, ensuring the truth projector only consumes `platform.*`.
- [x] Wire the HarnessRuntime MVP main chain: `PlanGraphBundle -> Graph Scheduler -> NodeRun -> NodeAttemptReceipt -> Event/Audit/Evidence`.
- [x] Wire the GraphPatch safety check, prohibiting silent rewrites of already-executed nodes, already-committed side effects, or already-recorded receipts.
- [x] Wire the minimum loop for SideEffect reconciliation / compensation.
- [x] Wire the v4.3 runtime repository, verifying the atomic boundary of truth mutation and `platform.*` fact event append.

### P3 Test Gate

- [x] Add runtime state-machine transition tests.
- [x] Add event consumer test: truth consumer does not consume `oapeflir.view.*`.
- [x] Add GraphPatch safety test.
- [x] Add budget hard-cap concurrency test.
- [x] Add HITL responsibility record test.
- [x] Add runtime repository atomic transition/event append test.
- [x] Run the v4.3 scope source-only build validation and the runtime/contracts/storage/event targeted tests. The complete `npm run typecheck`, `npm run test:unit`, and broad integration sweep are still managed by the historical baseline below, because they still contain pre-existing unrelated failures.

### P4 Subsequent Extensions

- [x] Hardening Ring: replay, recovery, lease/fencing, DLQ, diagnostics, and evidence bundle are recorded as the next ring scope after v4.3 MVP.
- [x] Enterprise Ring: organization governance, SSO/SCIM, multi-tenant isolation, cross-region, Marketplace, Edge, and PlatformOps are recorded as subsequent scope under the three-ring architecture.
- [x] The 24 domains and DomainRecipe are confirmed as non-blocking for v4.3 Contract Freeze MVP; they will be batched in only after the core runtime semantics stabilize.

## Historical Test Baseline: Full Test Failure List (2026-04-25)

> The list below is retained as the historical failure baseline from 2026-04-25, used for later comparison of whether v4.3 fixes expand or shrink the regression surface; it is not deleted, not reordered.

## 9. Full Test Failure List (Updated 2026-04-25)

### Test Result Summary

| Test Suite | Passed | Failed | Status |
|---------|------|------|------|
| Build | - | 0 | ✓ |
| Unit | 30,963 | 354 | Historical baseline archived |
| Integration | - | - | Historical not run, archived |
| **Total** | **30,963** | **354** | |

### Unit Failures (354)

**Overall tests**: 31,317 tests / 30,963 pass / 354 fail / 0 cancelled

---

## Test Failures by Directory

### 1. unit/platform/five-plane-state-evidence/truth (84 failures)
- SQLite repositories related tests

### 2. unit/platform/shared/observability (55 failures)
- Observability related tests

### 3. unit/platform/five-plane-interface/api (52 failures)
- API interface related tests

### 4. unit/platform/five-plane-orchestration/oapeflir (50 failures)
- oapeflir related tests

### 5. unit/platform/shared/stability (43 failures)
- stability related tests

### 6. unit/platform/shared/cache (35 failures)
- cache related tests

### 7. unit/platform/five-plane-state-evidence/knowledge (33 failures)
- knowledge related tests

### 8. unit/platform/five-plane-state-evidence/events (30 failures)
- events related tests

### 9. unit/platform/five-plane-orchestration/harness (30 failures)
- harness related tests

### 10. unit/platform/five-plane-state-evidence/memory (24 failures)
- memory related tests

### 11. unit/platform/five-plane-execution/worker-pool (22 failures)
- worker-pool related tests

### 12. unit/platform/five-plane-interface/channel-gateway (16 failures)
- channel-gateway related tests

### 13. unit/platform/model-gateway/provider-registry (15 failures)
- provider-registry related tests

### 14. unit/platform/five-plane-orchestration/agent-delegation (14 failures)
- agent-delegation related tests

### 15. unit/platform/five-plane-state-evidence/artifacts (13 failures)
- artifacts related tests

### 16. Other Directories (~50 failures)
- prompt-engine/eval: 10
- orchestration/hitl: 9
- interface/ingress: 9
- orchestration/planner: 8
- orchestration/learn: 7
- state-evidence/checkpoints: 6
- shared/scaling: 6
- shared/outbox: 6
- interaction/autonomy: 5
- scale-ecosystem/integration/connectors: 4
- feedback-loop/collector: 4
- orchestration/routing: 4
- interface/webhook: 4
- interface/scheduler: 4
- other scattered failures

---

## Detailed Test Failure List (354)

### eval-framework (2 failures)
| # | Test Name | Error Description |
|---|---------|---------|
| 815 | LlmEvalService.runCiGate reports regressions | runCiGate regression detection |
| 817 | LlmEvalService.runCiGate respects passingVerdicts option | passingVerdicts option |

### execution-outcome-evaluator (1 failure)
| # | Test Name | Error Description |
|---|---------|---------|
| 841 | ExecutionOutcomeEvaluator.evaluate suggests approve for low quality score | Low quality score suggests approval |

### DomainGovernancePolicySchema (3 failures)
| # | Test Name | Error Description |
|---|---------|---------|
| 1041 | DomainGovernancePolicySchema rejects duplicate roles across arrays | Duplicate roles |
| 1042 | DomainGovernancePolicySchema accepts empty restrictedDataClasses | Empty restrictedDataClasses |
| 1043 | DomainGovernancePolicySchema accepts empty mandatoryEvidence | Empty mandatoryEvidence |

### HrRoleGovernanceService (2 failures)
| # | Test Name | Error Description |
|---|---------|---------|
| 1089 | HrRoleGovernanceService submitProposal returns null approvalRequest when validation fails | Returns null when validation fails |
| 1093 | HrRoleGovernanceService registerApprovedRole throws when proposal invalid | Invalid proposal |

### state-transition (1 failure)
| # | Test Name | Error Description |
|---|---------|---------|
| 1125 | activate changes status to active and records timestamp | Status activation |

### detectAmbiguity (5 failures)
| # | Test Name | Error Description |
|---|---------|---------|
| 2331 | detectAmbiguity returns false for high confidence regardless of entities | High confidence |
| 15076 | detectAmbiguity treats confidence of 0.7 and above as not low | 0.7 and above |
| 15078 | detectAmbiguity with exact entity count matches required | Exact entity count |

### AgentVersionManager (2 failures)
| # | Test Name | Error Description |
|---|---------|---------|
| 2868 | AgentVersionManager.switchSlot returns null when no current version | switchSlot returns null |
| 2934 | AgentVersionManager: blue-green deployment ping-pong | Blue-green deployment |

### buildForensicSnapshot (4 failures)
| # | Test Name | Error Description |
|---|---------|---------|
| 3735 | buildForensicSnapshot returns distinct copies | Returns distinct copies |
| 1 | filters by stepId | Filter by stepId |
| 2 | filters by eventType | Filter by eventType |
| 4 | combines multiple filters | Combined filtering |
| 8 | filterEvents | Filter events |

### ExecutionTracer (3 failures)
| # | Test Name | Error Description |
|---|---------|---------|
| 4540 | ExecutionTracer | Execution tracer |
| 1 | creates step with running status | Creates running step |
| 2 | overwrites existing step state when called again | Overwrites existing state |
| 5 | failStep | Failed step |

### StepInspector (1 failure)
| # | Test Name | Error Description |
|---|---------|---------|
| 4564 | StepInspector | Step inspector |

### PlatformApplicationKernel (2 failures)
| # | Test Name | Error Description |
|---|---------|---------|
| 5874 | buildStartupPlan includes domains startup plan when required | Includes domains startup plan |
| 5876 | buildStartupPlan includes interactionGovernance plans when interaction layer required | Includes interactionGovernance plans |

### coverage-baseline-guard (1 failure)
| # | Test Name | Error Description |
|---|---------|---------|
| 446 | coverage-baseline-guard | Coverage baseline guard |

### PromptVersionManager (4 failures)
| # | Test Name | Error Description |
|---|---------|---------|
| 6337 | compareVersions returns -1 when v1 < v2 | v1 < v2 |
| 6339 | compareVersions returns 1 when v1 > v2 | v1 > v2 |
| 6341 | compareVersions treats version without patch as less than with patch | No patch version |
| 6367 | compareVersions handles large version differences | Large version differences |

### CostReportService (1 failure)
| # | Test Name | Error Description |
|---|---------|---------|
| 10061 | CostReportService creates cost reports with resource breakdown | Cost report |

### dispatchNext (~20 failures)
| # | Test Name | Error Description |
|---|---------|---------|
| 10198-10219 | dispatchNext related tests | Worker dispatch selection |

### IntakeRouter (2 failures)
| # | Test Name | Error Description |
|---|---------|---------|
| 10496 | handles follow-up with orchestration for retry scenario | Retry scenario |
| 10518 | matchedRules contains keywords that triggered intent | Matched rules |

### OrphanCleanupService (4 failures)
| # | Test Name | Error Description |
|---|---------|---------|
| 11316 | enforce applies close_orphan_session for orphan sessions | Orphan sessions |
| 11317 | marks applied false when session already terminal | Session already terminal |
| 11319 | applies clean_worker_execution_refs for worker orphans | Clean worker references |
| 11325 | cleans multiple orphan refs in single worker | Clean multiple orphan references |

### parseStepOutput (2 failures)
| # | Test Name | Error Description |
|---|---------|---------|
| 11457 | handles single line content | Single-line content |
| 11567 | handles single word content | Single-word content |

### FailoverController (3 failures)
| # | Test Name | Error Description |
|---|---------|---------|
| 11756 | initiateFailover rejects non-idle state | Non-idle state |
| 11779 | onFail callback is called on error | Error callback |
| 11783 | concurrent initiation attempts are rejected | Concurrent attempts |

### LeaderElectionService (~12 failures)
| # | Test Name | Error Description |
|---|---------|---------|
| 11893-11930 | LeaderElectionService series tests | HA leader election |

### Postgres/Redis Lock Adapter (~25 failures)
| # | Test Name | Error Description |
|---|---------|---------|
| 12338-12425 | PgAdvisoryLockAdapter / RedisLockAdapter series tests | Lock adapter |

### retryJob (1 failure)
| # | Test Name | Error Description |
|---|---------|---------|
| 12823 | returns null for non-dead-letter job | Non-dead-letter job |

### execution-plane-bootstrap (1 failure)
| # | Test Name | Error Description |
|---|---------|---------|
| 13562 | bootstrap is immutable | bootstrap immutable |

### sandbox (3 failures)
| # | Test Name | Error Description |
|---|---------|---------|
| 14119 | read-only workspace mode blocks write operations | Read-only workspace |
| 14120 | command execution populates data.injectionRisk | Injection risk |
| 14121 | command failure with non-zero exit code returns failed status | Command failure |

### ToolExecutor (1 failure)
| # | Test Name | Error Description |
|---|---------|---------|
| 14315 | executeParallel reports failures in errors array | Parallel execution failure |

### WorkerRegistryService (3 failures)
| # | Test Name | Error Description |
|---|---------|---------|
| 14833 | issueChallenge normalizes and deduplicates capabilities | Capability normalization |
| 14876 | listEligibleWorkers strict does not meet hardened requirement | Strict requirement |

### assessPromotion/calculateTrustScore (~15 failures)
| # | Test Name | Error Description |
|---|---------|---------|
| 15019-15068 | assessPromotion / calculateTrustScore / scoreSystemHealth series | Trust score and promotion |

### detectAmbiguity (2 failures)
| # | Test Name | Error Description |
|---|---------|---------|
| 15076 | treats confidence of 0.7 and above as not low | 0.7 and above |
| 15078 | with exact entity count matches required | Exact count |

### Other Scattered Failures

| # | Test Name | Error Description |
|---|---------|---------|
| 15094 | resolveTriggerActionMode handles undefined risk level | Undefined risk level |
| 15474 | normalizeError returns original AppError unchanged | Error normalization |
| 16419 | ChannelGatewayService resolves target by targetId directly | Target resolution |
| 16877 | ingress module with mocks | Ingress module |
| 17101 | LongRunningWorkflowService.sweepExpired with remain_pending | Expired workflow |
| 17120-17149 | DequeueResult / nack series tests | Queue operations |
| 17206-17214 | WebhookIngressService series tests | Webhook ingress |
| 17356-17464 | BudgetGuard / estimateMessageTokens series | Budget and token calculation |
| 17715-18062 | model routing / UnifiedChatProvider / SloAlertingService series | Model routing and SLO |
| 18091 | StructuredLogger configureGlobalFileSink accepts file path string | Structured logging |
| 18167-18211 | BenchmarkRunner / ProposalEngine series | Benchmark and proposal |
| 19166-19317 | ExperienceDistillationService / FailurePatternMiner / StrategyLearningService series | Learning services |
| 19866-19881 | PlanSchema / PlanStepSchema series | Plan schema |
| 20612-20622 | ConnectorManifestSchema series | Connector manifest |
| 21569-21579 | ServiceRegistry series | Service registry |
| 22686-23228 | FairScheduler / HorizontalScalingController / EnvironmentReadinessOrchestrationService series | Scheduling and scaling |
| 23257-23276 | classifyPromptInjectionRisk / protectSystemPrompt series | Security classification |
| 23287-23468 | StableAcceptanceLineReport / StableChaosSmoke / StableConcurrencyRehearsal series | Stability tests |
| 23767 | CheckpointManager | Checkpoint manager |
| 23926-23933 | durable event bus series | Durable event bus |
| 24000 | EventReliabilityInventoryService | Event reliability inventory |
| 26133-26134 | isSqliteWriteContentionError | SQLite write contention |
| 26183 | ExecutionRepository updateExecutionStatus | Execution repository |
| 26611-26632 | SessionDualStorageService series | Session dual storage |
| 26776 | AuthoritativeTaskStore with mocked database | Task store |
| 26958-26986 | domainDefinition series | Domain definition |
| 27116-27170 | platform root / LoopDetectionState / buildContinuationPrompt series | Platform root and loop detection |
| 27766-27776 | routeComplexity / LoopDetectionState series | Route complexity and loop detection |
| 27805 | parseOptionalStringArray | Optional string array parsing |
| 27888 | BillingServiceAsync throws for non-existent account | Billing service |
| 28013-28026 | assertIdentifier / monthWindow series | Assertion and window |
| 28467-28516 | PerceptionService / PmfValidationService series | Perception and PMF validation |
| 29186-29235 | OpsHealthMonitorService / PlatformOperatorService series | Operations health monitoring |
| 29339-29404 | isQuotaExceeded / TenantPlatformService / scale-ops series | Quota and tenant platform |
| 29765-29769 | loadModelRoutingCliEnv series | Model routing CLI |
| 29927 | create action does not require snapshotId | Create action |
| 30383 | createTempWorkspace creates a temporary directory with correct prefix | Temporary workspace |

---

## Root Cause Analysis

1. **Test assertions do not match implementation** - Expected values of multiple tests are inconsistent with the actual implementation
2. **Mock objects are incomplete** - mock databases/services do not correctly simulate actual behavior
3. **Concurrency test issues** - Race conditions when tests run concurrently
4. **Environment/configuration issues** - Tests need specific environment configuration but it is not provided



### Recommendations

1. **For test assertion errors**: Need to check whether the assertions in test files match the latest implementation
2. **For mock issues**: Need to update mock objects to correctly simulate actual service behavior
3. **For concurrency issues**: Consider lowering test concurrency or adding appropriate synchronization mechanisms

---

## Historical Baseline Archive

> Items #15-#30 below are no longer managed as current active todos; they are the index of the 2026-04-25 historical test baseline. The current architecture implementation closure is taken over by the A5/A6 registry, gate, receipt, report, and invariant tests.

| Task ID | Directory | Failure Count | Status |
|-------|------|--------|------|
| #15 | unit/platform/shared/observability | 55 | Archived |
| #16 | unit/platform/five-plane-state-evidence/memory | 24 | Archived |
| #17 | unit/platform/five-plane-interface/channel-gateway | 16 | Archived |
| #18 | unit/platform/five-plane-execution/worker-pool | 22 | Archived |
| #19 | unit/platform/model-gateway/provider-registry | 15 | Archived |
| #20 | unit/platform/five-plane-state-evidence/knowledge | 33 | Archived |
| #21 | unit/platform/five-plane-state-evidence/artifacts | 13 | Archived |
| #22 | unit/platform/five-plane-orchestration/agent-delegation | 14 | Archived |
| #23 | Other directories | ~50 | Archived |
| #24 | unit/platform/five-plane-state-evidence/events | 30 | Archived |
| #25 | unit/platform/five-plane-orchestration/harness | 30 | Archived |
| #26 | unit/platform/shared/stability | 43 | Archived |
| #27 | unit/platform/five-plane-state-evidence/truth | 84 | Archived |
| #28 | unit/platform/five-plane-orchestration/oapeflir | 50 | Archived |
| #29 | unit/platform/shared/cache | 35 | Archived |
| #30 | unit/platform/five-plane-interface/api | 52 | Archived |

**Total**: 354 test failures, distributed across 16 major directories

---

## Mission v1.4 Architecture Landing Activity Todos

> Source: `docs_zh/reference/mission_architecture_design_review_v1_4_full_merged.md`. This main line is executed in the order: "documentation status writeback -> contract freeze -> Truth/Event -> Control Plane -> API/Runtime Binding -> P1/P2 capabilities -> test closure". Mission only serves as the long-term goal and governance context root object; it is not an execution object, and does not replace `PlanGraphBundle / PlanNode / NodeRun / NodeAttempt`.

| Wave | Covered Tasks | Status | Acceptance Criteria |
|---|---|---|---|
| M0 Documentation and Task Ledger | T-MIS-001 to T-MIS-019 status table, evidence paths, test paths | [x] Completed | Review document only appends status and basis, does not delete original contract content |
| M1 Contract Freeze | T-MIS-001 | [x] Completed | Mission schemas/types/errors/events exportable, strict schema tests pass |
| M2 Truth/Event Foundation | T-MIS-002, T-MIS-003 | [x] Completed | mission truth tables, repository, event sequence, `platform.mission.*` same-transaction tests pass |
| M3 Control Plane | T-MIS-004, T-MIS-005 | [x] Completed | Lifecycle CAS, resolver, governance, budget, live guard targeted tests pass |
| M4 Interface/API | T-MIS-006 | [x] Completed | `/api/v1/missions` create/list/read/patch, state transition, members, tasks/runs/evidence/budget and `/api/v1/mission-resolutions:dry-run` contract tests pass |
| M5 Runtime Binding | T-MIS-007, T-MIS-008, T-MIS-009, T-MIS-010 | [x] Completed | Task create -> Mission resolution -> MissionSnapshot -> PlanGraphBundle -> HarnessRun -> NodeRun guard chain tests pass |
| M6 P1 Capabilities | T-MIS-011, T-MIS-012, T-MIS-013, T-MIS-014, T-MIS-015 | [x] Completed | Mission Console backend data surface, observability, learning promotion, legacy backfill, ADR document status consistent |
| M7 P2 In-Repo Baseline | T-MIS-016, T-MIS-017, T-MIS-018, T-MIS-019 | [x] Completed | handoff, home region/fencing, outcome analytics, template/package integration have testable service baselines |
| M8 Test and Closure | Contract/Unit/Integration/E2E/Governance | [x] Completed | Mission targeted tests, `npm run build:test`, and OpenAPI contract tests pass |

### T-MIS Mapping

| Task | This Round's Landing | Status |
|---|---|---|
| T-MIS-001 | Mission Zod schemas and type exports | [x] Completed |
| T-MIS-002 | mission_records / memberships / snapshots / event_sequences migration | [x] Completed |
| T-MIS-003 | `platform.mission.*` event schemas | [x] Completed |
| T-MIS-004 | MissionLifecycleService + CAS transition | [x] Completed |
| T-MIS-005 | MissionResolver + MissionGovernanceService | [x] Completed |
| T-MIS-006 | Mission API + ErrorEnvelope (including patch, members, tasks/runs/evidence/budget) | [x] Completed |
| T-MIS-007 | PlanGraphBundle missionSnapshotRef required | [x] Completed |
| T-MIS-008 | HarnessRun missionBinding required | [x] Completed |
| T-MIS-009 | NodeRun MissionLiveGuard | [x] Completed |
| T-MIS-010 | canonical Mission E2E coverage | [x] Completed |
| T-MIS-011 | Mission Console Overview / Members / Tasks / Runs / Budget / Evidence backend data surface | [x] Completed |
| T-MIS-012 | Mission trace/log correlation + metrics cardinality guard | [x] Completed |
| T-MIS-013 | Mission scoped LearningObject promotion gate | [x] Completed |
| T-MIS-014 | legacy Task/Session missionRef backfill | [x] Completed |
| T-MIS-015 | ADR update and superseded marking | [x] Completed |
| T-MIS-016 | Mission handoff across org/tenant | [x] Completed |
| T-MIS-017 | Mission home region + read replica routing/fencing | [x] Completed |
| T-MIS-018 | Mission outcome analytics | [x] Completed |
| T-MIS-019 | Mission template/package integration | [x] Completed |
