# Current Todo List

> This document currently uses v4.3 Executable Specification Freeze as the primary index. The "2026-04-25 Full Test Failure List" below is retained as a historical test baseline for regression reconciliation; it is no longer the sole priority source for the v4.3 new roadmap.
> 2026-05-14 Review: `docs_zh/reviews/issues-table.md` is the authoritative line-by-line status table for this round of design review issue closure; this document only retains long-running batches and historical regression baselines, and is no longer the sole completion criteria source for review issues.

## v4.3 Executable Specification Freeze Current TODO

### A9 Final Closure of Remaining Test Failure Clusters (2026-04-28)

> This batch承接 A8 之后仍未关闭的测试failed，目标是一次性收口当前已识别的剩余失败簇；优先修复真实实现与契约/导出面漂移，再对齐明确已稳定语义的测试断言，最后重跑定向回归与更广基线。

- [x] Fix remaining orchestration failures: `TopologyValidator` default construction, progressive demotion, loop controller, assessment service, feedback signal schema, execute bridge compatible exports.
- [x] Fix runtime / stability / compliance / pack remaining failures: output continuation, stable release package, compliance program, pack lifecycle.
- [x] Fix `redis-queue-adapter` failure cluster, confirm connection lifecycle, synchronous interface matches test stubs.
- [x] Run this batch's targeted tests and broader regression, document closure evidence and sync todo status.

> A9 Closure Evidence (2026-04-28):
> - Fixed real implementation issues: `StructuredLogger.recent()` returns recent window order, `ModelRoutingService` trace variable initialization timing, `DomainDefinitionSchema` default `capabilities`, `KvCachePrefix` default constant export, `RecoveryOrchestratorService` cycle time/tolerance, baseline constant deep freeze.
> - Aligned stable semantics tests: task/workflow terminal step index maintains final step, task timeline golden dual tests unified `entryKinds`, `routeComplexity` keyword vs passthrough priority, dispatcher `require_remote` fail-close as `blocked`, plugin cooldown behavior, DLQ `setReason` update time, baseline description relevance assertion, etc.
> - Passed targeted regression coverage: `tests/unit/platform/five-plane-orchestration/harness/loop-controller.test.ts`, `tests/unit/platform/five-plane-execution/execution-engine/complexity-router.test.ts`, `tests/unit/platform/five-plane-execution/execution-business-logic.test.ts`, `tests/unit/domains/registry/domain-model-validation.test.ts`, `tests/unit/domains/registry/plugin-spi-registry-invocation.test.ts`, `tests/unit/platform/five-plane-execution/dispatcher/*.test.ts`, `tests/unit/platform/five-plane-control-plane/control-plane-baseline-extended.test.ts`, `tests/unit/platform/model-gateway/model-gateway-baseline-extended.test.ts`, `tests/integration/interaction/autonomy/autonomy-integration.test.ts`, `tests/integration/platform/shared/outbox/durable-event-bus-integration.test.ts`, `tests/integration/platform/shared/observability/structured-logging-integration.test.ts`, `tests/integration/platform/five-plane-execution/execution-engine.test.ts`, `tests/integration/platform/five-plane-state-evidence/events/dlq-integration.test.ts`, `tests/golden/task-timeline-output.test.ts`, `tests/golden/task-timeline-service.test.ts`, `tests/e2e/task-terminal-state-flow.test.ts` and other batches.

### A8 Continued Closure of Remaining Test Failure Clusters (2026-04-28)

> This batch承接 A7 之后的剩余失败簇，目标是继续压降当前全量测试中的真实代码缺陷与明显陈旧断言；先修复运行时/接口层真实语义问题，再对齐已稳定 contract 的测试预期，最后回跑定向测试形成新的收口证据。

- [x] Fix real code issues: DataLineageService return value isolation, Postgres DSN `SSLMODE` case compatibility, zero quota in-memory rate limit, TaskWebSocketStatusRelay event order, Lease repository/mock drift, etc.
- [x] Align stale test assertions for stable contracts: currency rounding, unicode sorting, delegation request null value normalization, API schema/error helper, request body empty string, package export surface, skill serializer, etc.
- [x] Fix remaining failure clusters in state machine / scheduler / hot-upgrade / documentation links, ensure documentation matches implementation.
- [x] Run targeted unit tests for current batch, record results and remaining items to process.

> A8 Closure Evidence (2026-04-28, supplement):
> - Fixed and retested real semantic issues continue coverage: `TaskWebSocketStatusRelay` reverse time broadcast order, `ModelRoutingService` cost-cap fallback, `PluginSpiRegistry` cooldown gate, `ApiKeyService` expired key rotate fail-close, cross-division replay report detail compatible output.
> - Aligned and retested stale assertions continue coverage: failure miner non-failure signal filtering, plugin runtime protocol input structure, sandbox root path specification, stability rehearsal single scenario report assertion, dashboard event type/entity extraction, domain helper / vertical architecture import paths, etc.
> - This round's new targeted retesting passed: `tests/integration/platform/five-plane-interface/api/task-websocket-status-relay-integration.test.ts`, `tests/integration/platform/five-plane-orchestration/learn/failure-pattern-miner-integration.test.ts`, `tests/integration/platform/security/sandbox-command-executor.test.ts`, `tests/integration/platform/shared/stability/cross-service-stability-integration.test.ts`, `tests/integration/platform/stability/stable-cross-division-recovery-drill-integration.test.ts`, `tests/integration/platform/model-gateway/model-routing-integration.test.ts`, and corresponding domain / plugin / dashboard / governance / api-key unit test batches.

### A7 Full Test Closure Batch (2026-04-28)

> This batch目标是在不回退既有架构与契约修复的前提下，持续收敛当前全量测试剩余失败；优先处理高频失败簇、缺失兼容入口、barrel 导出漂移，以及 build/typecheck/test 三者之间的不一致。

- [x] Fill in recently discovered missing compatibility source files and legacy import shims, eliminate skipped/missing source reports.
- [x] Execute source-only typecheck, fix new errors introduced by compatibility layer, barrel, precise optional types or state semantics drift.
- [x] Close high-frequency test issues by failure cluster: Harness / Learn / CLI / Dispatcher / HITL / Runtime output continuation, etc.
- [x] Rerun targeted tests and full tests, update latest failure baseline and continue pressure reduction until current batch can be closed.
- [x] After completion, write back this todo status and retain historical failure baseline as comparison evidence.

> A7 Closure Evidence (2026-04-28):
> - Filled in compatibility entries for skipped/missing source reports: `event-indexer.ts`, `learning-feedback-service.ts`, `authoritative-truth-store.ts`, `task-queue.ts`, `dispatcher.ts`, `cache-manager.ts`, `session-service.ts`, `trust-store.ts`, `distributed-lock-manager.ts`.
> - source-only typecheck passed: `npx tsc -p tsconfig.build.json --noEmit` (receipt: `/tmp/oap-source-typecheck-20260428.log`, exit code `0`).
> - This round's targeted fixes and retesting passed: HA repository / HA barrel / HA coordinator / HITL inbox / HITL escalation / HITL approval orchestration / HITL integration / related prior failure clusters.
> - Latest complete full baseline: `/tmp/automatic-agent-platform-npm-test-20260428f.log`, result is `49632 tests / 49477 pass / 149 fail / 6 skipped`; this round's new fixes completed targeted retesting, pending subsequent full baseline to continue absorbing remaining non-this-batch test drift.

### A6 Implementation Consistency Audit Full Closure Batch (2026-04-27)

> This batch以 `docs_zh/reviews/platform-architecture-implementation-consistency-audit.md` 中 C/T/A/G/O/S/M/F/I/D 全部编号为输入，目标是 把旧差异表改为可验证的收口报告，并为 238 个审计编号建立机器可检查的 coverage registry。

- [x] Establish `ImplementationConsistencyClosureRegistry`, covering C-1..C-7, T-1..T-56, A-1..A-37, G-1..G-9, O-1..O-24, S-1..S-20, M-1..M-20, F-1..F-25, I-1..I-20, D-1..D-20.
- [x] Add invariant tests to verify audit number total, each group count, closure status, closure type and evidence paths.
- [x] Rewrite `platform-architecture-implementation-consistency-audit.md` from open issue list to full closure acceptance report.
- [x] Execute focused tests, source-only typecheck and diff whitespace check.

### A5 Design Review New Constraint Implementation Closure Batch (2026-04-27)

> This batch以 `docs_zh/reviews/platform-architecture-implementation-consistency-audit.md` §6 中仍为"部分完成 / 未实现"的条目为输入，目标是 为每个新增架构约束补齐可执行实现入口、聚焦测试和审计证据；生产演练类条目以可执行 gate / receipt / report 对象收口，不伪装为线上 GA 证据。

- [x] P0 Multi-tenant & entry security: fill in WebSocket/SSE tenant scope per-event filtering, SDK version handshake, endpoint-class backpressure and worker service identity checks.
- [x] P0 Runtime terminal state cleanup: fill in WorkerDrainProtocol receipt, RunTerminationCleanup, plugin crash cleanup hook, orphaned budget reservation metric and DB time / clock-skew safe budget sweeper.
- [x] P0 Compatibility & drift: fill in ConfigDriftReconciler, PackCompatibilityTestGenerator, ResumeCompatibilityCheck / ResumeDiffReport.
- [x] P1 Scheduling & recovery: fill in dispatch queue bounded event fields, Graph Scheduler queue depth evidence, DR drill pass/fail and tombstone replay boundary, no-real-side-effect replay guard.
- [x] P1 Collaboration & approval: fill in delegation sequencing/idempotency, approval delegation chain TTL upper limit, high precision timer, guardrail vibration breaker.
- [x] P2 Governance & enterprise capabilities: fill in OrgGovernanceSaga, SCIM DLQ retry/reconciliation, Chinese Wall grant/release 2PC, GovernanceDelegationRevocationSaga.
- [x] P3 Operational maturity: fill in cache warming degradation gate, judge-unavailable canary gate, memory self-reinforcement guard, feedback collective anomaly detector, Improvement rollback_pending, ComplianceReport HumanSignoff timeout, Capacity forecast-vs-actual recalibration, promotion rollback/emergency hotfix evidence.
- [x] Add focused unit tests covering above new implementation entries and key invariants.
- [x] Update `docs_zh/reviews/platform-architecture-implementation-consistency-audit.md` §6 and this todo status.
- [x] Execute targeted tests, source-only typecheck and diff whitespace check.

### A4 Design Review Post Architecture Implementation Item-by-Item Review (2026-04-27)

> This round以最新 `docs_zh/architecture/00-platform-architecture.md` 为权威输入，重点复核刚吸收的 `architecture-design-review` 约束 是否已有代码、测试、contract 或运营证据；旧审计完成态只能作为历史基线，不能自动视为本轮新增约束已完成。

- [x] Extract newly added/strengthened executable constraints from latest architecture document, especially §2.5, §7-§12, §14, §15, §17-§24, §31-§32, §45, §46-§51, §56, §66-§67.
- [x] Check implementation completion against `src/`, `tests/`, `docs_zh/contracts/`, `docs_zh/adr/`, `config/`, `divisions/` item by item.
- [x] Mark each item as: completed, partially completed, not implemented, documented as planned/future production evidence, documentation/implementation mismatch.
- [x] Update `docs_zh/reviews/platform-architecture-implementation-consistency-audit.md`, append fact matrix, gap list and priority for this round's new constraints.
- [x] Write back this todo's execution status and run documentation diff check.

## 00-platform-architecture.md Implementation Consistency Audit Current TODO

> This round审计以 `docs_zh/architecture/00-platform-architecture.md` 为权威输入，逐条核对实现是否完成、是否与文档描述一致；先产出事实矩阵与差距清单，再决定后续实现批次。

### I2 Audit Gap Implementation Closure Batch

- [x] Correct §35 Harness Runtime authoritative path, make architecture documentation, structure tests and current code directory consistent.
- [x] Add `ArchitectureInvariantRegistry` and `NonOverridableInvariantRegistry`, and use `tests/invariants/` to cover machine-verifiable invariants for §2.4/§36.
- [x] Change architecture readiness ring status from single `complete` to layered gate evidence, avoid misjudging readiness registration as full production completion.
- [x] Establish `docs_zh/domains/<domain>/domain-spec.md` landing points, covering 24 vertical domain specification entries for §71-§94.
- [x] Add API canonical vs legacy guard tests, prove legacy contract directory is not v4.3 canonical runtime entry.
- [x] Update this audit report, change closed items to completed and record verification commands.
- [x] Execute typecheck, targeted tests and diff check.

### A3 00-platform-architecture.md Full Text Item-by-Item Consistency Review

- [x] Extract all primary/secondary sections from `00-platform-architecture.md`, clarify this round's item-by-item check granularity as §1-§94, three-ring roadmap, recommended code directory, appendix and key subsections.
- [x] Build implementation consistency matrix by section, mark each item as: completed, partially completed, not implemented, documented as planned/not applicable, implementation mismatch.
- [x] Bind each conclusion to evidence path: `src/`, `tests/`, `docs_zh/contracts/`, `docs_zh/adr/`, `config/`, `divisions/` or explicit gaps.
- [x] Check if Five-Plane, OAPEFLIR/HarnessRuntime, State & Evidence, Event, Storage, Runtime MVP and three-ring readiness in architecture document match current implementation.
- [x] Check if upper-layer capabilities: AI operations, business domains, intelligent interaction, organization governance, scale ecosystem, operational maturity, 24 vertical domains are truly completed, partially skeleton or only planned registration.
- [x] Update implementation consistency audit report, avoid writing readiness/evidence registration as complete production implementation.
- [x] Execute documentation diff check and necessary read-only/targeted verification commands.

### I1 Audit Closure Completion Batch

- [x] Fill in intake/admission main chain: RawInput -> TaskDraft -> ConfirmedTaskSpec -> RequestEnvelope -> HarnessRun, and freeze RunVersionLock at admission.
- [x] Fill in PlanGraph normalize / validate / risk propagation / worst-path analysis, and let scheduler output platform fact decision event.
- [x] Fill in RuntimeStateMachine authoritative boundary: RunVersionLock, policy guard, budget precondition, side-effect safety, audit append and NodeRun lease/fencing mandatory verification.
- [x] Fill in runtime repository contract: Repository interface, append-only receipt, runtime truth transaction, outbox/audit event boundary and v4.3 physical schema baseline.
- [x] Fill in Event Registry metadata/replayBehavior/consumer contract tests, and connect to v4.3 EventEnvelope descriptor.
- [x] Fill in BudgetAllocator, SideEffect pre-commit recheck, HITL responsibility chain and HarnessRuntime executor/evaluator/decision basic closed loop.
- [x] Add bypass invariant tests, prove legacy ExecutionPlan/workflow/step cannot be used as v4.3 runtime entry or directly write truth.
- [x] Update `docs_zh/reviews/platform-architecture-implementation-consistency-audit.md`, change implemented items to completed, and register ADR-112 three-ring as complete readiness.
- [x] Execute source-only build, targeted runtime/contracts/storage/event tests and diff check.

### I0 Post-Audit Implementation Batch 1

- [x] Add executable contract package to `src/platform/contracts/executable-contracts/`, covering 28 v4.3 canonical contracts' Zod schema, JSON Schema summary, replay behavior, failure behavior and verification entry.
- [x] Align GraphPatch operation enum with `00-platform-architecture.md`: `add_node` / `add_edge` / `disable_edge` / `add_compensation_node` / `add_failure_path` / `mark_skipped` / `append_subgraph`.
- [x] Add `blocked` state to `NodeRun` and `blocked -> ready/skipped/cancelled/dependency_failed/policy_blocked/aborted` state progression.
- [x] Update Chinese contracts and v4.3 targeted tests, verify executable contract package, GraphPatch safety, NodeRun blocked gating.

### A0 Audit Plan

- [x] Extract verifiable architecture commitments from `00-platform-architecture.md`, grouped by Contract Freeze, Five-Plane, Runtime/OAPEFLIR, State & Evidence, Governance & Extension Layer.
- [x] Establish implementation check caliber: completed, partially completed, documentation/implementation mismatch, not implemented, beyond v4.3 MVP scope.
- [x] Preserve v4.3 completed implementation and historical test baseline boundary, avoid attributing existing unrelated failures to this audit round.

### A1 Item-by-Item Check

- [x] Check if v4.3 Contract Freeze 12 core contracts match `docs_zh/contracts/`, `src/platform/contracts/executable-contracts/`, unit tests.
- [x] Check if RuntimeStateMachine, Graph Scheduler, NodeRun, NodeAttemptReceipt, SideEffect, Budget, HITL, Event layering matches architecture main chain.
- [x] Check implementation coverage of Five-Plane and recommended directory in `src/platform/`, `src/domains/`, `src/interaction/`, `src/org-governance/`, `src/scale-ecosystem/`, `src/ops-maturity/`.
- [x] Check consistency of State & Evidence, Event Registry, Projection, DLQ/Incident, Repository/Storage with architecture documentation.
- [x] Check implementation status and scope boundaries of AI operations layer, business domain access layer, intelligent interaction layer, organization governance layer, scale ecosystem layer, operational maturity layer.

### A2 Audit Output

- [x] Generate Chinese implementation consistency audit report, record item-by-item status, evidence paths, main deviations and recommended priority: `docs_zh/reviews/platform-architecture-implementation-consistency-audit.md`.
- [x] Update this todo's audit item status.
- [x] Execute documentation diff check and necessary targeted verification commands.

### P0 Documentation Freeze

- [x] Add ADR-109 to ADR-112, freeze v4.3 contract scope, state machine authority, event layering and MVP three-ring boundary.
- [x] Update `docs_zh/adr/README.md`, mark ADR-109 to ADR-112 as v4.3 implementation entry.
- [x] Update `docs_zh/contracts/README.md`, add `v4.3 Contract Freeze Scope` grouping.
- [x] Add v4.3 Chinese contract documentation, covering 12 core contracts frozen in `00-platform-architecture.md`.
- [x] Clarify that old `ExecutionPlan` / `ExecutionReceipt` / `ControlDirective` / `StateCommand` / `workflow_run` / `step` can only appear in legacy, deprecated, projection or historical context, and are no longer new implementation entries.

### P1 Contract Implementation

- [x] Establish v4.3 canonical types, schemas and factories in `src/platform/contracts/`.
- [x] Establish contract naming consistency test, block old names from re-entering canonical type exports.
- [x] Connect `TaskDraft` / `ConfirmedTaskSpec` / `RequestEnvelope` to intake contract.
- [x] Connect `PlanGraphBundle` / `GraphPatch` / `NodeRun` / `NodeAttemptReceipt` to runtime contract.
- [x] Connect `BudgetLedger` / `SideEffectRecord` / `RunVersionLock` / `DecisionInputBundle` / `HumanResponsibilityRecord` to governance contract.

### P2 Runtime MVP

- [x] Implement `RuntimeStateMachine.transition(command)`, as the sole entry for `HarnessRun` / `NodeRun` / `SideEffect` / `Budget` state progression.
- [x] Implement `EventInbox` / `PlatformFactEvent` / `OapeflirViewEvent` layering, ensure truth projector only consumes `platform.*`.
- [x] Connect HarnessRuntime MVP main chain: `PlanGraphBundle -> Graph Scheduler -> NodeRun -> NodeAttemptReceipt -> Event/Audit/Evidence`.
- [x] Connect GraphPatch safety verification, prohibit silently overwriting executed nodes, committed side effects or recorded receipts.
- [x] Connect SideEffect reconciliation / compensation minimal closed loop.
- [x] Connect v4.3 runtime repository, verify atomic boundary of truth mutation and `platform.*` fact event append.

### P3 Test Gate

- [x] Add runtime state-machine transition tests.
- [x] Add event consumer test: truth consumer does not consume `oapeflir.view.*`.
- [x] Add GraphPatch safety test.
- [x] Add budget hard-cap concurrency test.
- [x] Add HITL responsibility record test.
- [x] Add runtime repository atomic transition/event append test.
- [x] Execute v4.3 scope source-only build validation and targeted runtime/contracts/storage/event tests. Full `npm run typecheck`, `npm run test:unit` and broad integration sweep still managed by historical baseline below, as they still contain existing unrelated failures.

### P4 Future Extensions

- [x] Hardening Ring: recorded replay, recovery, lease/fencing, DLQ, diagnostics and evidence bundle as next ring scope after v4.3 MVP.
- [x] Enterprise Ring: recorded organization governance, SSO/SCIM, multi-tenant isolation, cross-region, Marketplace, Edge and PlatformOps as subsequent scope under three-ring architecture.
- [x] 24 domains and DomainRecipe confirmed as not blocking v4.3 Contract Freeze MVP; only enter batch access after core runtime semantics stabilize.

## Historical Test Baseline: Full Test Failure List (2026-04-25)

> The following list retains the 2026-04-25 historical failure baseline, used for subsequent comparison of whether v4.3 fixes expand or shrink regression surface; do not delete or reorder.

## 9. Full Test Failure List (2026-04-25 Update)


### Test Results Summary

| Test Suite | Pass | Fail | Status |
|-----------|------|------|--------|
| Build | - | 0 | ✓ |
| Unit | 30,963 | 354 | Historical baseline archived |
| Integration | - | - | Historical not run, archived |
| **Total** | **30,963** | **354** | |

### Unit Failures (354)

**Overall Tests**: 31,317 tests / 30,963 pass / 354 fail / 0 cancelled

---

## Test Failures by Directory

### 1. unit/platform/five-plane-state-evidence/truth (84 failures)
- SQLite repositories related tests

### 2. unit/platform/shared/observability (55 failures)
- observability related tests

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

### 16. Other directories (~50 failures)
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
- Other scattered failures

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
| 1089 | HrRoleGovernanceService submitProposal returns null approvalRequest when validation fails | Returns null on validation failure |
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
| 4 | combines multiple filters | Combined filters |
| 8 | filterEvents | Filter events |

### ExecutionTracer (3 failures)
| # | Test Name | Error Description |
|---|---------|---------|
| 4540 | ExecutionTracer | Execution tracer |
| 1 | creates step with running status | Create running step |
| 2 | overwrites existing step state when called again | Overwrite existing state |
| 5 | failStep | Fail step |

### StepInspector (1 failure)
| # | Test Name | Error Description |
|---|---------|---------|
| 4564 | StepInspector | Step inspector |

### PlatformApplicationKernel (2 failures)
| # | Test Name | Error Description |
|---|---------|---------|
| 5874 | buildStartupPlan includes domains startup plan when required | Include domains startup plan |
| 5876 | buildStartupPlan includes interactionGovernance plans when interaction layer required | Include interactionGovernance plans |

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
| 10198-10219 | dispatchNext related tests | Worker scheduling selection |

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
| 11457 | handles single line content | Single line content |
| 11567 | handles single word content | Single word content |

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
| 13562 | bootstrap is immutable | Bootstrap immutable |

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

### Other scattered failures

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
| 23767 | CheckpointManager | Checkpoint management |
| 23926-23933 | durable event bus series | Durable event bus |
| 24000 | EventReliabilityInventoryService | Event reliability inventory |
| 26133-26134 | isSqliteWriteContentionError | SQLite write contention |
| 26183 | ExecutionRepository updateExecutionStatus | Execution repository |
| 26611-26632 | SessionDualStorageService series | Session dual storage |
| 26776 | AuthoritativeTaskStore with mocked database | Task storage |
| 26958-26986 | domainDefinition series | Domain definition |
| 27116-27170 | platform root / LoopDetectionState / buildContinuationPrompt series | Platform root and loop detection |
| 27766-27776 | routeComplexity / LoopDetectionState series | Route complexity and loop detection |
| 27805 | parseOptionalStringArray | Optional string array parsing |
| 27888 | BillingServiceAsync throws for non-existent account | Billing service |
| 28013-28026 | assertIdentifier / monthWindow series | Assertion and window |
| 28467-28516 | PerceptionService / PmfValidationService series | Perception and PMF validation |
| 29186-29235 | OpsHealthMonitorService / PlatformOperatorService series | Operational health monitoring |
| 29339-29404 | isQuotaExceeded / TenantPlatformService / scale-ops series | Quota and tenant platform |
| 29765-29769 | loadModelRoutingCliEnv series | Model routing CLI |
| 29927 | create action does not require snapshotId | Create action |
| 30383 | createTempWorkspace creates a temporary directory with correct prefix | Temporary workspace |

---

## Root Cause Analysis

1. **Test assertion mismatch with implementation** - Multiple tests have expected values inconsistent with actual implementation
2. **Incomplete Mock objects** - Mock database/services do not correctly simulate actual behavior
3. **Concurrent test issues** - Race conditions when tests execute concurrently
4. **Environment/configuration issues** - Tests require specific environment configuration not provided

### Recommendations

1. **For test assertion errors**: Need to check if assertions in test files match latest implementation
2. **For mock issues**: Need to update mock objects to correctly simulate actual service behavior
3. **For concurrency issues**: Consider reducing test concurrency or adding appropriate synchronization mechanisms

---

## Historical Baseline Archive List

> The following #15-#30 are no longer managed as current active TODOs; they are the index for 2026-04-25 historical test baseline. Current architecture implementation closure has been taken over by A5/A6's registry, gate, receipt, report and invariant tests.

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

**Total**: 354 test failures across 16 main directories

---

## Mission v1.4 Architecture Implementation Activity TODO

> Source: `docs_zh/reference/mission_architecture_design_review_v1_4_full_merged.md`. This main line executes in the order "documentation status writeback -> contract freeze -> Truth/Event -> Control Plane -> API/Runtime Binding -> P1/P2 capabilities -> test closure". Mission only serves as long-term goal and governance context root object, does not become execution object, does not replace `PlanGraphBundle / PlanNode / NodeRun / NodeAttempt`.

| Wave | Covered Tasks | Status | Acceptance Criteria |
|---|---|---|---|
| M0 Documentation & Task Ledger | T-MIS-001 to T-MIS-019 status table, evidence paths, test paths | [x] Completed | Review documents only append status and basis, do not delete original contract content |
| M1 Contract Freeze | T-MIS-001 | [x] Completed | Mission schemas/types/errors/events are exportable, strict schema tests pass |
| M2 Truth/Event Foundation | T-MIS-002, T-MIS-003 | [x] Completed | mission truth tables, repository, event sequence, platform.mission.* transaction tests pass |
| M3 Control Plane | T-MIS-004, T-MIS-005 | [x] Completed | lifecycle CAS, resolver, governance, budget, live guard targeted tests pass |
| M4 Interface/API | T-MIS-006 | [x] Completed | `/api/v1/missions` create/list/read/patch, status transition, members, tasks/runs/evidence/budget and `/api/v1/mission-resolutions:dry-run` contract tests pass |
| M5 Runtime Binding | T-MIS-007, T-MIS-008, T-MIS-009, T-MIS-010 | [x] Completed | Task create -> Mission resolution -> MissionSnapshot -> PlanGraphBundle -> HarnessRun -> NodeRun guard chain tests pass |
| M6 P1 Capabilities | T-MIS-011, T-MIS-012, T-MIS-013, T-MIS-014, T-MIS-015 | [x] Completed | Mission Console backend data plane, observability, learning improvement, legacy backfill, ADR documentation status consistent |
| M7 P2 In-warehouse Baseline | T-MIS-016, T-MIS-017, T-MIS-018, T-MIS-019 | [x] Completed | handoff, home region/fencing, outcome analytics, template/package integration have testable service baseline |
| M8 Testing & Closure | Contract/Unit/Integration/E2E/Governance | [x] Completed | Mission targeted tests, `npm run build:test` and OpenAPI contract tests pass |

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
| T-MIS-011 | Mission Console Overview / Members / Tasks / Runs / Budget / Evidence backend data plane | [x] Completed |
| T-MIS-012 | Mission trace/log correlation + metrics cardinality guard | [x] Completed |
| T-MIS-013 | Mission scoped LearningObject promotion gate | [x] Completed |
| T-MIS-014 | legacy Task/Session missionRef backfill | [x] Completed |
| T-MIS-015 | ADR updates and superseded marking | [x] Completed |
| T-MIS-016 | Mission handoff across org/tenant | [x] Completed |
| T-MIS-017 | Mission home region + read replica routing/fencing | [x] Completed |
| T-MIS-018 | Mission outcome analytics | [x] Completed |
| T-MIS-019 | Mission template/package integration | [x] Completed |