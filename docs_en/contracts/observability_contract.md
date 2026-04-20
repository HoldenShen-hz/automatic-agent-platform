# Observability Contract

## 1. Scope

This contract defines minimum specifications for logs, metrics, traces, debug information, and PII protection.
For more detailed inspect, healthz, and backpressure rules, refer to the drill-down document `debug_inspect_health_backpressure_contract.md`.

## 2. Key Objects

- `LogEvent`
- `MetricSample`
- `TraceContext`
- `DebugFlag`

## 3. LogEvent Minimum Fields

- `timestamp`
- `level`
- `message`
- `task_id?`
- `agent_id?`
- `trace_id?`
- `payload?`

## 4. Core Metrics

### 4.1 `RuntimeMetricsSummary`

The system should support generating runtime metric summaries covering the following dimensions:

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

Rules:

- step duration metrics must support percentile calculation (at least p95).
- cost metrics must distinguish between all-task average and successful-task average.
- recovery metrics must cover the complete chain from recovery events (`recovery:*`) to final task success rate.
- Numerical precision is uniformly rounded to four decimal places.

### 4.2 Traditional Core Metrics (Summary)

The following summarized metric names remain valid as simplified views of `RuntimeMetricsSummary` dimensions:

- Task success rate (taskMetrics.successRate)
- Workflow recovery rate (recoveryMetrics.successRate)
- token usage (stepMetrics.totalTokenCost)
- Cost deviation (costMetrics.averageActualCostUsdPerTask)
- Approval trigger frequency (approvalMetrics.taskTriggerRate)
- Error distribution (taskMetrics.failedCount + executionMetrics.retryRate)

## 5. Behavioral Constraints

- Tier 1 events and key state changes must be traceable.
- Logs are structured by default.
- When user-sensitive information is involved, must support sanitization or trimming.
- Debug switches must not leak high-sensitivity content by default.
- health / inspect / backpressure state semantics should be unified and not defined differently at different entry points.

## 6. Supplementary Rules

- Metric naming uniformly uses `<domain>_<metric>_<unit?>` style.
- Trace supports head-based sampling by default, with critical failure paths forcibly retained.
- Log retention at minimum distinguishes: runtime logs, audit logs, and debug logs, with different retention periods for different categories.
