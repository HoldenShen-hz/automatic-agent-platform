# Observability Contract

> **OAPEFLIR 相关**：本 contract 定义 OAPEFLIR 8 阶段的可观测性，对应 ADR-016。
> **更新日期**：2026-04-17

## 1. 范围

本 contract 定义日志、指标、trace、调试信息和 PII 保护的最小规范。
更细的 inspect、healthz 和 backpressure 规则以下钻文档 `debug_inspect_health_backpressure_contract.md` 为准。

## 2. 关键对象

- `LogEvent`
- `MetricSample`
- `TraceContext`
- `DebugFlag`
- `StageMetricSample`
- `LoopIterationTrace`
- `FeedbackMetricSample`

## 3. LogEvent 最小字段

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

## 4. 核心指标

### 4.1 `RuntimeMetricsSummary`

系统应支持生成运行时指标摘要，覆盖以下维度：

| 维度 | 关键指标 |
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
| `stageViewMetrics` | observe / assess / plan / execute / feedback / learn / improve / release 的 count / duration / failure / timeout |
| `feedbackMetrics` | receivedCount / classifiedCount / consumedCount / positiveCount / negativeCount / correctionCount |
| `learningMetrics` | objectCreatedCount / validatedCount / promotedCount / rejectedCount |
| `improvementMetrics` | candidateProposedCount / acceptedCount / rejectedCount / guardrailBlockedCount |
| `releaseMetrics` | startedCount / advancedCount / completedCount / rolledBackCount / currentLevel |

规则：

- attempt duration 指标必须支持百分位计算（至少 p95）。
- cost 指标必须区分全量任务平均和成功任务平均。
- recovery 指标必须覆盖从恢复事件（`recovery:*`）到最终 HarnessRun 成功率的完整链路。
- 数值精度统一四舍五入到四位小数。
- `oapeflirViewMetrics` 与 `stageViewMetrics` 只能作为 view / trace / rationale 指标，不得被当作 runtime truth 主健康指标或状态机门禁输入。

### 4.2 传统核心指标（概括）

以下概括性指标名仍然有效，作为 `RuntimeMetricsSummary` 各维度的 projection 简化视图：

- 任务成功率（taskMetrics.successRate）
- 工作流恢复率（projection 自 `recoveryMetrics.successRate`）
- token 使用量（projection 自 `attemptMetrics` 与 `costMetrics`）
- 成本偏差（costMetrics.averageActualCostUsdPerTask）
- 审批触发频率（approvalMetrics.taskTriggerRate）
- 错误分布（taskMetrics.failedCount + executionMetrics.retryRate）

### 4.3 OAPEFLIR Loop Observability

Phase 1-4 的 OAPEFLIR 闭环必须能按 loop iteration 和 stage 还原最小观测链：

`observe -> assess -> plan -> execute -> feedback -> learn -> improve -> release`

`StageMetricSample` 最小字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `harness_run_id` | `string` | 关联运行 truth |
| `task_id?` | `string` | 关联任务投影 |
| `loop_iteration` | `integer` | OAPEFLIR 第几轮，从 1 开始 |
| `stage` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release` | 当前阶段 |
| `status` | `pending \| active \| completed \| skipped \| failed \| timed_out` | 阶段状态 |
| `duration_ms` | `number?` | 阶段耗时 |
| `token_cost` | `number?` | 阶段 token 成本 |
| `error_code` | `string?` | 失败原因 |
| `sampled_at` | `timestamp` | 采样时间 |

`LoopIterationTrace` 最小字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `harness_run_id` | `string` | 关联运行 truth |
| `task_id?` | `string` | 关联任务投影 |
| `loop_iteration` | `integer` | OAPEFLIR 第几轮 |
| `trace_id` | `string` | 主 trace |
| `started_at` | `timestamp` | 本轮开始时间 |
| `completed_at` | `timestamp?` | 本轮结束时间 |
| `current_stage` | `string?` | 当前或最后阶段 |
| `stage_refs` | `string[]` | 阶段 evidence / artifact 引用 |
| `feedback_signal_refs` | `string[]` | 反馈信号引用 |
| `learning_object_refs` | `string[]` | 学习对象引用 |
| `improvement_candidate_refs` | `string[]` | 改进候选引用 |
| `release_record_refs` | `string[]` | release 记录引用 |

`FeedbackMetricSample` 最小字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `harness_run_id` | `string?` | 关联运行 truth |
| `task_id?` | `string?` | 关联任务投影 |
| `signal_id` | `string?` | 反馈信号 |
| `kind` | `satisfaction \| correction \| quality_metric \| failure_signal` | 反馈类型 |
| `sentiment` | `positive \| neutral \| negative` | 情绪/质量倾向 |
| `stage` | `string?` | 触发阶段 |
| `consumed_by` | `feedback \| learn \| improve \| release` | 消费方 |
| `sampled_at` | `timestamp` | 采样时间 |

规则：

- 指标命名统一使用 `oapeflir_<stage>_<metric>_<unit?>` 风格，例如 `oapeflir_feedback_signal_count`。
- `stage` 字段必须来自 canonical OAPEFLIR stage，不得由各模块自造同义词。
- Improve / Release 指标必须能关联到 guardrail、approval 和 release 证据，不能只记录最终成功或失败。
- Knowledge / Memory 相关指标属于 M2 扩展维度；若当前部署未启用，必须显式返回 not_enabled / zero，而不是伪造采样。

## 5. 行为约束

- Tier 1 事件和关键状态变更必须可追踪。
- 日志默认结构化。
- 涉及用户敏感信息时必须支持脱敏或裁剪。
- debug 开关不得默认泄露高敏感内容。
- health / inspect / backpressure 的状态语义应统一，不得在不同入口各自定义。

## 6. 补充规则

- 指标命名统一使用 `<domain>_<metric>_<unit?>` 风格。
- trace 默认支持 head-based sampling，关键失败路径强制保留。
- 日志保留至少区分：运行日志、审计日志、调试日志，不同类别保留周期不同。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-47: 本文原先把 `oapeflirMetrics.convergenceRate` 直接放在 `RuntimeMetricsSummary` 的顶层 canonical 维度里，根因是观测合同混淆了 runtime truth 健康指标与认知/解释视图指标。修复：正文现把主维度收敛到 `harnessRunMetrics / nodeRunMetrics / attemptMetrics`，并把 OAPEFLIR 指标显式降为 `oapeflirViewMetrics / stageViewMetrics` 这类 view-only 指标。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
