# Observability Contract

> **OAPEFLIR Related**: This contract defines observability for OAPEFLIR 8 stages, corresponding to ADR-016.
> **Last Updated**: 2026-04-17

## 1. Scope

This contract defines minimum specifications for logs, metrics, traces, debugging information, and PII protection.
For detailed inspect, healthz, and backpressure rules, refer to the drilling document `debug_inspect_health_backpressure_contract.md`.

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

- Attempt duration metrics must support percentile calculation (at least p95).
- Cost metrics must differentiate between all-tasks average and successful-tasks average.
- Recovery metrics must cover the complete chain from recovery events (`recovery:*`) to final HarnessRun success rate.
- Numeric precision uniformly rounded to four decimal places.
- `oapeflirViewMetrics` and `stageViewMetrics` can only serve as view / trace / rationale metrics, must not be treated as runtime truth primary health metrics or state machine gate inputs.

### 4.2 Traditional Core Metrics (Summary)

The following summary metric names remain valid as simplified projection views for each dimension of `RuntimeMetricsSummary`:

- Task success rate (taskMetrics.successRate)
- Workflow recovery rate (projection from `recoveryMetrics.successRate`)
- Token usage (projection from `attemptMetrics` and `costMetrics`)
- Cost deviation (costMetrics.averageActualCostUsdPerTask)
- Approval trigger frequency (approvalMetrics.taskTriggerRate)
- Error distribution (taskMetrics.failedCount + executionMetrics.retryRate)

### 4.3 OAPEFLIR Loop Observability

Phase 1-4 OAPEFLIR loop must be able to restore minimum observability chain by loop iteration and stage:

`observe -> assess -> plan -> execute -> feedback -> learn -> improve -> release`

`StageMetricSample` minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `harness_run_id` | `string` | Associated run truth |
| `loop_iteration` | `integer` | OAPEFLIR iteration number, starting from 1 |
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
| `loop_iteration` | `integer` | OAPEFLIR iteration |
| `trace_id` | `string` | Primary trace |
| `started_at` | `timestamp` | This iteration start time |
| `completed_at` | `timestamp?` | This iteration end time |
| `current_stage` | `string?` | Current or final stage |
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

- Metric naming uses unified `oapeflir_<stage>_<metric>_<unit?>` style; unimplemented example metrics must not be written as frozen contract prematurely.
- `stage` field must come from canonical OAPEFLIR stage, must not be synonymized by individual modules.
- Improve / Release metrics must be traceable to guardrail, approval, and release evidence, cannot only record final success or failure.
- Knowledge / Memory related metrics belong to M2 extension dimension; if current deployment does not enable them, must explicitly return not_enabled / zero, not falsify samples.

## 5. Behavioral Constraints

- Tier 1 events and key status changes must be traceable.
- Logs are structured by default.
- When user-sensitive information is involved, must support masking or redacting.
- Debug switches must not leak high-sensitivity content by default.
- health / inspect / backpressure status semantics should be unified, not defined separately at different entry points.

## 6. Supplementary Rules

- Metric naming uses unified `<domain>_<metric>_<unit?>` style.
- Trace supports head-based sampling by default, critical failure paths are forcibly preserved.
- Log retention differentiates at minimum: runtime logs, audit logs, debug logs, with different retention periods for different categories.

## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical sections conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-47: This document originally placed `oapeflirMetrics.convergenceRate` directly in `RuntimeMetricsSummary` top-level canonical dimension. Root cause: observability contract confused runtime truth health metrics with cognitive/explanation view metrics. Fix: the text now converges primary dimensions to `harnessRunMetrics / nodeRunMetrics / attemptMetrics`, and explicitly demotes OAPEFLIR metrics to `oapeflirViewMetrics / stageViewMetrics` as view-only metrics.
- T-22 (observability): LogEvent now uses `harness_run_id / node_run_id / attempt_id` as canonical primary correlation keys, with `task_id` retained only as legacy query projection.

Mandatory rules: status transitions must go through `RuntimeStateMachine.transition(command)`; execution plan must use `PlanGraphBundle`; execution result must use `NodeAttemptReceipt`; truth event must only use `platform.*`; OAPEFLIR can only act as `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.