# Observability Contract

> **OAPEFLIR Related**: This contract defines observability for OAPEFLIR 8 stages, corresponding to ADR-016.
> **Updated**: 2026-04-17

## 1. Scope

This contract defines minimum specifications for logs, metrics, traces, debugging information, and PII protection.
Finer inspect, healthz, and backpressure rules are based on the drilling document `debug_inspect_health_backpressure_contract.md`.

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
- `harness_run_id` (required)
- `node_run_id` (required)
- `attempt_id` (required)
- `task_id?`
- `agent_id?`
- `stage?`
- `trace_id?`
- `payload?`

## 4. Core Metrics

### 4.1 `RuntimeMetricsSummary`

System should support generating runtime metrics summary covering the following dimensions:

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

- Attempt duration metrics must support percentile calculation (at minimum p95).
- Cost metrics must differentiate all-task average and successful-task average.
- Recovery metrics must cover the complete chain from recovery event (`recovery:*`) to final HarnessRun success rate.
- Numeric precision is uniformly rounded to 4 decimal places.
- `oapeflirViewMetrics` and `stageViewMetrics` can only be used as view / trace / rationale metrics and must not be used as runtime truth primary health metrics or state machine gate inputs.

### 4.2 Traditional Core Metrics (Summary)

The following summary metric names are still valid as simplified projection views of each dimension of `RuntimeMetricsSummary`:

- Task success rate (taskMetrics.successRate)
- Workflow recovery rate (projection from `recoveryMetrics.successRate`)
- Token usage (projection from `attemptMetrics` and `costMetrics`)
- Cost deviation (costMetrics.averageActualCostUsdPerTask)
- Approval trigger frequency (approvalMetrics.taskTriggerRate)
- Error distribution (taskMetrics.failedCount + executionMetrics.retryRate)

### 4.3 OAPEFLIR Loop Observability

For OAPEFLIR closed loop in Phase 1-4, must be able to restore minimum observability chain by loop iteration and stage:

`observe -> assess -> plan -> execute -> feedback -> learn -> improve -> release`

`StageMetricSample` minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `harness_run_id` | `string` | Associated run truth |
| `loop_iteration` | `integer` | OAPEFLIR loop number, starting from 1 |
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
| `loop_iteration` | `integer` | OAPEFLIR loop number |
| `trace_id` | `string` | Main trace |
| `started_at` | `timestamp` | This loop start time |
| `completed_at` | `timestamp?` | This loop end time |
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
| `stage` | `string?` | Trigger stage |
| `consumed_by` | `feedback \| learn \| improve \| release` | Consumer |
| `sampled_at` | `timestamp` | Sample time |

Rules:

- Metric naming uniformly uses `oapeflir_<stage>_<metric>_<unit?>` style; unimplemented sample metrics must not be written as frozen contract in advance.
- `stage` field must come from canonical OAPEFLIR stage and must not be replaced by synonyms created by each module.
- Improve / Release metrics must be traceable to guardrail, approval, and release evidence, must not only record final success or failure.
- Knowledge / Memory related metrics belong to M2 extension dimension; if currently deployed and not enabled, must explicitly return not_enabled / zero, not fabricate samples.

## 5. Behavioral Constraints

- Tier 1 events and key state changes must be traceable.
- Logs are structured by default.
- When involving user sensitive information, must support desensitization or trimming.
- Debug switches must not leak high-sensitivity content by default.
- Health / inspect / backpressure status semantics should be unified and not defined separately at different entrances.

## 6. Supplementary Rules

- Metric naming uniformly uses `<domain>_<metric>_<unit?>` style.
- Trace supports head-based sampling by default, key failure paths are forcibly preserved.
- Log retention distinguishes at minimum: run logs, audit logs, debug logs, with different retention periods for different categories.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs in this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-47: This document originally placed `oapeflirMetrics.convergenceRate` directly in `RuntimeMetricsSummary` top-level canonical dimension. Root cause: observability contract confused runtime truth health metrics with cognition/explanation view metrics. Fix: The body now converges main dimensions to `harnessRunMetrics / nodeRunMetrics / attemptMetrics`, and explicitly demotes OAPEFLIR metrics to `oapeflirViewMetrics / stageViewMetrics` view-only metrics.
- T-22 (observability): LogEvent now uses `harness_run_id / node_run_id / attempt_id` as canonical primary association key, and `task_id` is retained only as legacy query projection.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.