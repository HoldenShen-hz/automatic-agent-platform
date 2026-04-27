# Current Todo List

> This document is currently using v4.3 Executable Specification Freeze as the main index. The "2026-04-25 Full Test Failure List" below is retained as a historical test baseline for regression reconciliation; it is no longer the sole priority source for the v4.3 new roadmap.

## v4.3 Executable Specification Freeze Current TODO

### P0 Document Freeze

- [x] Add ADR-109 to ADR-112, freeze v4.3 contract scope, state machine authority, event layering, and MVP three-ring boundaries.
- [x] Update `docs_zh/adr/README.md`, mark ADR-109 to ADR-112 as v4.3 implementation entry points.
- [x] Update `docs_zh/contracts/README.md`, add new `v4.3 Contract Freeze Scope` group.
- [x] Add v4.3 Chinese contract documents, covering the 12 core contracts frozen in `00-platform-architecture.md`.
- [x] Clarify that old `ExecutionPlan` / `ExecutionReceipt` / `ControlDirective` / `StateCommand` / `workflow_run` / `step` can only appear in legacy, deprecated, projection, or historical contexts, and are no longer new implementation entry points.

### P1 Contract Implementation

- [x] Establish v4.3 canonical types, schemas, and factories in `src/platform/contracts/`.
- [x] Establish contract naming consistency test, prevent old names from re-entering canonical type exports.
- [x] Connect `TaskDraft` / `ConfirmedTaskSpec` / `RequestEnvelope` to intake contract.
- [x] Connect `PlanGraphBundle` / `GraphPatch` / `NodeRun` / `NodeAttemptReceipt` to runtime contract.
- [x] Connect `BudgetLedger` / `SideEffectRecord` / `RunVersionLock` / `DecisionInputBundle` / `HumanResponsibilityRecord` to governance contract.

### P2 Runtime MVP

- [x] Implement `RuntimeStateMachine.transition(command)`, as the sole entry point for `HarnessRun` / `NodeRun` / `SideEffect` / `Budget` state progression.
- [x] Implement `EventInbox` / `PlatformFactEvent` / `OapeflirViewEvent` layering, ensuring truth projector only consumes `platform.*`.
- [x] Connect HarnessRuntime MVP main chain: `PlanGraphBundle -> Graph Scheduler -> NodeRun -> NodeAttemptReceipt -> Event/Audit/Evidence`.
- [x] Connect GraphPatch safety validation, prohibit silent overwriting of executed nodes, committed side effects, or recorded receipts.
- [x] Connect SideEffect reconciliation / compensation minimum closure.
- [x] Connect v4.3 runtime repository, validating the atomic boundary between truth mutation and `platform.*` fact event append.

### P3 Test Gates

- [x] Add runtime state-machine transition tests.
- [x] Add event consumer test: truth consumer does not consume `oapeflir.view.*`.
- [x] Add GraphPatch safety test.
- [x] Add budget hard-cap concurrency test.
- [x] Add HITL responsibility record test.
- [x] Add runtime repository atomic transition/event append test.
- [x] Execute source-only build validation and targeted runtime/contracts/storage/event tests for the v4.3 scope. Full `npm run typecheck`, `npm run test:unit`, and broad integration sweeps remain governed by the historical baseline below because they still include pre-existing unrelated failures.

### P4 Follow-up Extensions

- [x] Hardening Ring: recorded replay, recovery, lease/fencing, DLQ, diagnostics, and evidence bundle as the next ring after the v4.3 MVP.
- [x] Enterprise Ring: recorded org governance, SSO/SCIM, multi-tenant isolation, cross-region, Marketplace, Edge, and PlatformOps as follow-up scope under the three-ring architecture.
- [x] 24 domains and DomainRecipe are confirmed as non-blocking for v4.3 Contract Freeze MVP; batch integration starts only after core runtime semantics are stable.

## Historical Test Baseline: Full Test Failure List (2026-04-25)

> The following list is retained as the 2026-04-25 historical failure baseline for subsequent comparison on whether v4.3 fixes expand or reduce the regression surface; do not delete or reorder.

## 9. Full Test Failure List (2026-04-25 Update)


### Test Results Summary

| Test Suite | Pass | Fail | Status |
|---------|------|------|------|
| Build | - | 0 | ✓ |
| Unit | 30,963 | 354 | Has failures |
| Integration | - | - | Pending |
| **Total** | **30,963** | **354** | |

### Unit Failures (354)

**Overall tests**: 31,317 tests / 30,963 pass / 354 fail / 0 cancelled

---

## Test Failures by Directory

### 1. unit/platform/state-evidence/truth (84 failures)
- SQLite repositories related tests

### 2. unit/platform/shared/observability (55 failures)
- observability related tests

### 3. unit/platform/interface/api (52 failures)
- API interface related tests

### 4. unit/platform/orchestration/oapeflir (50 failures)
- oapeflir related tests

### 5. unit/platform/shared/stability (43 failures)
- stability related tests

### 6. unit/platform/shared/cache (35 failures)
- cache related tests

### 7. unit/platform/state-evidence/knowledge (33 failures)
- knowledge related tests

### 8. unit/platform/state-evidence/events (30 failures)
- events related tests

### 9. unit/platform/orchestration/harness (30 failures)
- harness related tests

### 10. unit/platform/state-evidence/memory (24 failures)
- memory related tests

### 11. unit/platform/execution/worker-pool (22 failures)
- worker-pool related tests

### 12. unit/platform/interface/channel-gateway (16 failures)
- channel-gateway related tests

### 13. unit/platform/model-gateway/provider-registry (15 failures)
- provider-registry related tests

### 14. unit/platform/orchestration/agent-delegation (14 failures)
- agent-delegation related tests

### 15. unit/platform/state-evidence/artifacts (13 failures)
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
| 4 | combines multiple filters | Combine filters |
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
| 5876 | buildStartupPlan includes interactionGovernance plans when interaction layer required | Include interactionGovernance plan |

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
| 10518 | matchedRules contains keywords that triggered intent | Match rules |

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
| 12338-12425 | PgAdvisoryLockAdapter / RedisLockAdapter series tests | Lock adapters |

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
| 18091 | StructuredLogger configureGlobalFileSink accepts file path string | Structured log |
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
| 29186-29235 | OpsHealthMonitorService / PlatformOperatorService series | Operations health monitoring |
| 29339-29404 | isQuotaExceeded / TenantPlatformService / scale-ops series | Quota and tenant platform |
| 29765-29769 | loadModelRoutingCliEnv series | Model routing CLI |
| 29927 | create action does not require snapshotId | Create action |
| 30383 | createTempWorkspace creates a temporary directory with correct prefix | Temporary workspace |

---

## Root Cause Analysis

1. **Test assertions do not match implementation** - Multiple tests have expected values inconsistent with actual implementation
2. **Mock objects incomplete** - Mock database/services do not correctly simulate actual behavior
3. **Concurrency test issues** - Race conditions when tests execute concurrently
4. **Environment/configuration issues** - Tests require specific environment configuration but not provided


### Suggestions

1. **For test assertion errors**: Need to check if assertions in test files match the latest implementation
2. **For mock issues**: Need to update mock objects to correctly simulate actual service behavior
3. **For concurrency issues**: Consider reducing test concurrency or adding appropriate synchronization mechanisms

---

## Pending Task List

| Task ID | Directory | Failures | Status |
|-------|------|--------|------|
| #15 | unit/platform/shared/observability | 55 | Pending |
| #16 | unit/platform/state-evidence/memory | 24 | Pending |
| #17 | unit/platform/interface/channel-gateway | 16 | Pending |
| #18 | unit/platform/execution/worker-pool | 22 | Pending |
| #19 | unit/platform/model-gateway/provider-registry | 15 | Pending |
| #20 | unit/platform/state-evidence/knowledge | 33 | Pending |
| #21 | unit/platform/state-evidence/artifacts | 13 | Pending |
| #22 | unit/platform/orchestration/agent-delegation | 14 | Pending |
| #23 | Other directories | ~50 | Pending |
| #24 | unit/platform/state-evidence/events | 30 | Pending |
| #25 | unit/platform/orchestration/harness | 30 | Pending |
| #26 | unit/platform/shared/stability | 43 | Pending |
| #27 | unit/platform/state-evidence/truth | 84 | Pending |
| #28 | unit/platform/orchestration/oapeflir | 50 | Pending |
| #29 | unit/platform/shared/cache | 35 | Pending |
| #30 | unit/platform/interface/api | 52 | Pending |

**Total**: 354 test failures, distributed across 16 main directories
