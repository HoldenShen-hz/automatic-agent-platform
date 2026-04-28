# Observability Contract

> **OAPEFLIR Related**: This contract defines observability for OAPEFLIR 8 stages, corresponding to ADR-016.
> **Updated**: 2026-04-17

## 1. Scope

This contract defines minimum specifications for logs, metrics, traces, debug information, and PII protection.
For more detailed inspect, healthz, and backpressure rules, refer to the drill-down document `debug_inspect_health_backpressure_contract.md`.

## 2. Key Objects

- `LogEvent`
- `MetricSample`
- `TraceContext`
- `DebugFlag`
- `StageMetricSample`
- `LoopIterationTrace`
- `FeedbackMetricSample`

## 3. LogEvent Minimum Fields

- `timestamp`
- `level`
- `message`
- `task_id?`
- `agent_id?`
- `stage?`
- `trace_id?`
- `payload?`

## 4. Core Metrics

### 4.1 `RuntimeMetricsSummary`

The system should support generating runtime metrics summaries covering the following dimensions:

| Dimension | Key Metrics |
| --- | --- |
| `harnessRunMetrics` | total / completedCount / failedCount / abortedCount / activeCount / successRate |
| `nodeRunMetrics` | total / readyCount / runningCount / succeededCount / failedCount / retryCount / blockedCount |
| `attemptMetrics` | total / activeCount / retryAttemptCount / recoveryAttemptCount / averageDurationMs / **p95DurationMs** |
| `recoveryMetrics` | harnessRunCount / recoveredHarnessRunCount / successRate / decisionCount / repairEventCount / deadLetterCount / cancelledCount |
| `costMetrics` | totalActualCostUsd / averageActualCostUsdPerTask / averageActualCostUsdPerSuccessfulTask |
| `approvalMetrics` | total / pendingCount / resolvedCount / taskTriggerCount / taskTriggerRate |
| `eventMetrics` | total / tier1Count / tier2Count / tier3Count / pendingTier1AckCount / failedTier1AckCount |
| `runtimeMetrics` | status / degradationMode / queueGovernance / workerHealth / findings |
| `oapeflirViewMetrics` | loopCount / completedLoopCount / failedLoopCount / averageLoopDurationMs / convergenceRate |
| `stageViewMetrics` | observe / assess / plan / execute / feedback / learn / improve / release count / duration / failure / timeout |
| `feedbackMetrics` | receivedCount / classifiedCount / consumedCount / positiveCount / negativeCount / correctionCount |
| `learningMetrics` | objectCreatedCount / validatedCount / promotedCount / rejectedCount |
| `improvementMetrics` | candidateProposedCount / acceptedCount / rejectedCount / guardrailBlockedCount |
| `releaseMetrics` | startedCount / advancedCount / completedCount / rolledBackCount / currentLevel |

Rules:

- Attempt duration metrics must support percentile calculation (at least p95).
- Cost metrics must differentiate between all-task average and successful-task average.
- Recovery metrics must cover the complete chain from recovery events (`recovery:*`) to final HarnessRun success rate.
- Numeric precision is uniformly rounded to four decimal places.
- `oapeflirViewMetrics` and `stageViewMetrics` may only serve as view / trace / rationale metrics and must not be treated as runtime truth primary health metrics or state machine gate inputs.

### 4.2 Traditional Core Metrics (Summary)

The following summarized metric names remain valid as simplified projection views of `RuntimeMetricsSummary` dimensions:

- Task success rate (taskMetrics.successRate)
- Workflow recovery rate (projection from `recoveryMetrics.successRate`)
- Token usage (projection from `attemptMetrics` and `costMetrics`)
- Cost deviation (costMetrics.averageActualCostUsdPerTask)
- Approval trigger frequency (approvalMetrics.taskTriggerRate)
- Error distribution (taskMetrics.failedCount + executionMetrics.retryRate)

### 4.3 OAPEFLIR Loop Observability

Phase 1-4 OAPEFLIR closed loop must be able to reconstruct the minimum observability chain by loop iteration and stage:

`observe -> assess -> plan -> execute -> feedback -> learn -> improve -> release`

`StageMetricSample` minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `harness_run_id` | `string` | Associated run truth |
| `task_id?` | `string` | Associated task projection |
| `loop_iteration` | `integer` | Which round of OAPEFLIR, starting from 1 |
| `stage` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release` | Current stage |
| `status` | `pending \| active \| completed \| skipped \| failed \| timed_out` | Stage status |
| `duration_ms` | `number?` | Stage duration |
| `token_cost` | `number?` | Stage token cost |
| `error_code` | `string?` | Failure reason |
| `sampled_at` | `timestamp` | Sample time |

`LoopIterationTrace` minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `harness_run_id` | `string` | Associated run truth |
| `task_id?` | `string?` | Associated task projection |
| `loop_iteration` | `integer` | Which round of OAPEFLIR |
| `trace_id` | `string` | Primary trace |
| `started_at` | `timestamp` | This round start time |
| `completed_at` | `timestamp?` | This round end time |
| `current_stage` | `string?` | Current or last stage |
| `stage_refs` | `string[]` | Stage evidence / artifact references |
| `feedback_signal_refs` | `string[]` | Feedback signal references |
| `learning_object_refs` | `string[]` | Learning object references |
| `improvement_candidate_refs` | `string[]` | Improvement candidate references |
| `release_record_refs` | `string[]` | Release record references |

`FeedbackMetricSample` minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `harness_run_id` | `string?` | Associated run truth |
| `task_id?` | `string?` | Associated task projection |
| `signal_id` | `string?` | Feedback signal |
| `kind` | `satisfaction \| correction \| quality_metric \| failure_signal` | Feedback type |
| `sentiment` | `positive \| neutral \| negative` | Sentiment/quality tendency |
| `stage` | `string?` | Triggering stage |
| `consumed_by` | `feedback \| learn \| improve \| release` | Consumer |
| `sampled_at` | `timestamp` | Sample time |

Rules:

- Metric naming uniformly uses `oapeflir_<stage>_<metric>_<unit?>` style, e.g., `oapeflir_feedback_signal_count`.
- `stage` field must come from canonical OAPEFLIR stages and must not be replaced by synonyms created by individual modules.
- Improve / Release metrics must be traceable to guardrail, approval, and release evidence, and must not only record final success or failure.
- Knowledge / Memory related metrics belong to M2 extension dimension; if not enabled in current deployment, must explicitly return not_enabled / zero rather than fabricate samples.

## 5. Behavioral Constraints

- Tier 1 events and key state changes must be traceable.
- Logs are structured by default.
- Must support desensitization or truncation when user-sensitive information is involved.
- Debug switches must not leak highly sensitive content by default.
- Health / inspect / backpressure status semantics should be unified and not defined differently at different entry points.

## 6. Supplementary Rules

- Metric naming uniformly uses `<domain>_<metric>_<unit?>` style.
- Traces support head-based sampling by default; critical failure paths are forcibly retained.
- Log retention at minimum distinguishes: runtime logs, audit logs, debug logs, with different retention periods for different categories.


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` shall prevail.

- T-47: This document originally placed `oapeflirMetrics.convergenceRate` directly in the top-level canonical dimension of `RuntimeMetricsSummary`. Root cause: observability contract confused runtime truth health metrics with cognitive/explanatory view metrics. Fix: The main text now converges the primary dimensions to `harnessRunMetrics / nodeRunMetrics / attemptMetrics`, and explicitly demotes OAPEFLIR metrics to view-only metrics like `oapeflirViewMetrics / stageViewMetrics`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR may only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
