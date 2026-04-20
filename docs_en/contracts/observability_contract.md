# Observability Contract

> **OAPEFLIR Association**: This contract defines observability for the OAPEFLIR 8-stage loop, corresponding to ADR-016.
> **Update Date**: 2026-04-17

## 1. Scope

This contract defines minimum specifications for logs, metrics, traces, debug information, and PII protection.
More detailed inspect, healthz, and backpressure rules are governed by the drill-down document `debug_inspect_health_backpressure_contract.md`.

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
| `taskMetrics` | total / successCount / failedCount / cancelledCount / activeCount / successRate / completionRate |
| `workflowMetrics` | total / completedCount / failedCount / cancelledCount / retriedCount / retryRate |
| `executionMetrics` | total / activeCount / retryAttemptCount / retryRate / supersededCount |
| `recoveryMetrics` | taskCount / successfulTaskCount / successRate / decisionCount / repairEventCount / deadLetterCount / cancelledCount |
| `stepMetrics` | total / averageDurationMs / **p95DurationMs** / averageTokenCost / totalTokenCost |
| `costMetrics` | totalActualCostUsd / averageActualCostUsdPerTask / averageActualCostUsdPerSuccessfulTask |
| `approvalMetrics` | total / pendingCount / resolvedCount / taskTriggerCount / taskTriggerRate |
| `eventMetrics` | total / tier1Count / tier2Count / tier3Count / pendingTier1AckCount / failedTier1AckCount |
| `runtimeMetrics` | status / degradationMode / queueGovernance / workerHealth / findings |
| `oapeflirMetrics` | loopCount / completedLoopCount / failedLoopCount / averageLoopDurationMs / convergenceRate |
| `stageMetrics` | observe / assess / plan / execute / feedback / learn / improve / release count / duration / failure / timeout |
| `feedbackMetrics` | receivedCount / classifiedCount / consumedCount / positiveCount / negativeCount / correctionCount |
| `learningMetrics` | objectCreatedCount / validatedCount / promotedCount / rejectedCount |
| `improvementMetrics` | candidateProposedCount / acceptedCount / rejectedCount / guardrailBlockedCount |
| `rolloutMetrics` | startedCount / advancedCount / completedCount / rolledBackCount / currentLevel |

Rules:

- Step duration metrics must support percentile calculation (at least p95).
- Cost metrics must distinguish between all-task average and successful-task average.
- Recovery metrics must cover the complete chain from recovery events (`recovery:*`) to final task success rate.
- Numerical precision is uniformly rounded to four decimal places.

### 4.2 Traditional Core Metrics (Summary)

The following summary metric names remain valid as simplified views of `RuntimeMetricsSummary` dimensions:

- Task success rate (taskMetrics.successRate)
- Workflow recovery rate (recoveryMetrics.successRate)
- Token usage (stepMetrics.totalTokenCost)
- Cost deviation (costMetrics.averageActualCostUsdPerTask)
- Approval trigger frequency (approvalMetrics.taskTriggerRate)
- Error distribution (taskMetrics.failedCount + executionMetrics.retryRate)

### 4.3 OAPEFLIR Loop Observability

OAPEFLIR closed loop in Phase 1-4 must be able to restore the minimum observation chain by loop iteration and stage:

`observe -> assess -> plan -> execute -> feedback -> learn -> improve -> release`

`StageMetricSample` minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `task_id` | `string` | Associated task |
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
| `task_id` | `string` | Associated task |
| `loop_iteration` | `integer` | OAPEFLIR round number |
| `trace_id` | `string` | Main trace |
| `started_at` | `timestamp` | This round start time |
| `completed_at` | `timestamp?` | This round end time |
| `current_stage` | `string?` | Current or final stage |
| `stage_refs` | `string[]` | Stage evidence / artifact references |
| `feedback_signal_refs` | `string[]` | Feedback signal references |
| `learning_object_refs` | `string[]` | Learning object references |
| `improvement_candidate_refs` | `string[]` | Improvement candidate references |
| `rollout_record_refs` | `string[]` | Rollout record references |

`FeedbackMetricSample` minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `task_id` | `string?` | Associated task |
| `signal_id` | `string?` | Feedback signal |
| `kind` | `satisfaction \| correction \| quality_metric \| failure_signal` | Feedback type |
| `sentiment` | `positive \| neutral \| negative` | Sentiment/quality tendency |
| `stage` | `string?` | Triggering stage |
| `consumed_by` | `feedback \| learn \| improve \| release` | Consumer |
| `sampled_at` | `timestamp` | Sample time |

Rules:

- Metric naming uniformly uses `oapeflir_<stage>_<metric>_<unit?>` style, e.g., `oapeflir_feedback_signal_count`.
- `stage` field must come from canonical OAPEFLIR stage; modules must not invent synonyms.
- Improve / Release metrics must be traceable to guardrail, approval, and rollout evidence; they cannot just record final success or failure.
- Knowledge / Memory related metrics belong to M2 extended dimension; if not enabled in current deployment, must explicitly return not_enabled / zero rather than fabricating samples.

## 5. Behavioral Constraints

- Tier 1 events and key state changes must be traceable.
- Logs are structured by default.
- When user-sensitive information is involved, support for deidentification or pruning must be available.
- Debug flags must not leak highly sensitive content by default.
- Health / inspect / backpressure status semantics should be unified; they must not be defined differently at different entry points.

## 6. Supplementary Rules

- Metric naming uniformly uses `<domain>_<metric>_<unit?>` style.
- Traces support head-based sampling by default; key failure paths are force-preserved.
- Log retention at minimum distinguishes: runtime logs, audit logs, debug logs; different categories have different retention periods.
