# Observability Contract

> **OAPEFLIR Related**: This contract defines OAPEFLIR 8-stage observability, corresponding to ADR-016.
> **Updated**: 2026-04-17

## 1. Scope

This contract defines minimum specifications for logs, metrics, traces, debug information, and PII protection.
More detailed inspect, healthz, and backpressure rules are authoritative in the drill-down document `debug_inspect_health_backpressure_contract.md`.

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
- `node_run_id?`
- `attempt_id?`
- `task_id?`
- `agent_id?`
- `stage?`
- `trace_id?`
- `payload?`

## 4. Core Metrics

### 4.1 `RuntimeMetricsSummary`

The system should support generating runtime metrics summary covering the following dimensions:

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
| `stageViewMetrics` | count / duration / failure / timeout for observe / assess / plan / execute / feedback / learn / improve / release |
| `feedbackMetrics` | receivedCount / classifiedCount / consumedCount / positiveCount / negativeCount / correctionCount |
| `learningMetrics` | objectCreatedCount / validatedCount / promotedCount / rejectedCount |
| `improvementMetrics` | candidateProposedCount / acceptedCount / rejectedCount / guardrailBlockedCount |
| `releaseMetrics` | startedCount / advancedCount / completedCount / rolledBackCount / currentLevel |

Rules:

- Attempt duration metrics must support percentile calculation (at least p95).
- Cost metrics must differentiate between all-task average and successful-task average.
- Recovery metrics must cover the complete chain from recovery events (`recovery:*`) to final HarnessRun success rate.
- Numeric precision is uniformly rounded to four decimal places.
- `oapeflirViewMetrics` and `stageViewMetrics` may only serve as view / trace / rationale metrics and must not be used as runtime truth primary health indicators or state machine gate inputs.

### 4.2 Legacy Core Metrics (Summary)

The following summary metric names remain valid as simplified projection views of `RuntimeMetricsSummary` dimensions:

- Task success rate (taskMetrics.successRate)
- Workflow recovery rate (projection from `recoveryMetrics.successRate`)
- Token usage (projection from `attemptMetrics` and `costMetrics`)
- Cost deviation (costMetrics.averageActualCostUsdPerTask)
- Approval trigger frequency (approvalMetrics.taskTriggerRate)
- Error distribution (taskMetrics.failedCount + executionMetrics.retryRate)

### 4.3 OAPEFLIR Loop Observability

Phase 1-4 OAPEFLIR closed loop must be able to restore minimum observability chain by loop iteration and stage:

`observe -> assess -> plan -> execute -> feedback -> learn -> improve -> release`

`StageMetricSample` minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `harness_run_id` | `string` | Associated run truth |
| `loop_iteration` | `integer` | OAPEFLIR round number, starting from 1 |
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
| `loop_iteration` | `integer` | OAPEFLIR round number |
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
| `stage` | `string?` | Trigger stage |
| `consumed_by` | `feedback \| learn \| improve \| release` | Consumer |
| `sampled_at` | `timestamp` | Sample time |

Rules:

- Metric naming uniformly uses `oapeflir_<stage>_<metric>_<unit?>` style, e.g., `oapeflir_feedback_signal_count`.
- The `stage` field must come from canonical OAPEFLIR stages and must not be synonyms created by individual modules.
- Improve / Release metrics must be traceable to guardrail, approval, and release evidence, not just final success or failure.
- Knowledge / Memory related metrics belong to M2 extension dimensions; if not enabled in current deployment, must explicitly return not_enabled / zero instead of fabricating samples.

## 5. Behavior Constraints

- Tier 1 events and key state changes must be trackable.
- Logs are structured by default.
- Must support desensitization or trimming when user-sensitive information is involved.
- Debug flags must not leak high-sensitivity content by default.
- Health / inspect / backpressure state semantics should be unified and not separately defined at different entry points.

## 6. Supplementary Rules

- Metric naming uniformly uses `<domain>_<metric>_<unit?>` style.
- Traces support head-based sampling by default, critical failure paths are forcibly preserved.
- Log retention must at minimum differentiate: run logs, audit logs, debug logs, with different retention periods for different categories.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If any historical section of this document conflicts with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-47: This document originally placed `oapeflirMetrics.convergenceRate` directly in the top-level canonical dimension of `RuntimeMetricsSummary`. Root cause: the observability contract confused runtime truth health metrics with cognitive/explanatory view metrics. Fix: The body now converges primary dimensions to `harnessRunMetrics / nodeRunMetrics / attemptMetrics` and explicitly demotes OAPEFLIR metrics to view-only metrics like `oapeflirViewMetrics / stageViewMetrics`.
- T-22 (observability): The original `LogEvent` field list already includes `harness_run_id` (required) and `node_run_id?` / `attempt_id?` (optional), satisfying architecture §25.8 budget correlation key requirements. R2-22 states that "missing harness_run_id/node_run_id" was an audit misjudgment; §3 of this document is already correctly aligned and requires no modification.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plan must use `PlanGraphBundle`; execution result must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR must only be `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.