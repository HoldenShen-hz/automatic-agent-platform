# Perception Contract

> **OAPEFLIR 相关**：本 contract 定义 OAPEFLIR Observe Hub，对应 ADR-016 §3 和 G6 解决方案。
> **更新日期**：2026-04-17

> 兼容说明：文件名保留 `perception_contract.md` 以维持历史链接稳定性；当前 authoritative 语义已收口到 OAPEFLIR 的 `Observe` 阶段。

## 1. 范围

本 contract 定义 `Observe` 阶段的最小规范，包括多源信号采集、上下文快照构建和风险/领域提示整理。

当前不再把 “perception” 视为独立业务面；它是历史命名兼容壳，实际语义对齐 `ObserveHub`。

## 2. 关键对象

- `ObserveSource`
- `ObserveSignal`
- `TaskSituation`
- `SystemSituation`
- `TaskSituationBuilder`
- `SystemSituationBuilder`
- `ObservationAggregator`
- `ObserveSchedule`

## 3. ObserveSource 最小字段

- `source_id`
- `type`，取值 `rss | web | github | api | custom`
- `name`
- `enabled`
- `schedule`
- `filters`
- `priority`
- `trust_tier?`

## 4. ObserveSignal 最小字段

- `signal_id`
- `source_id`
- `kind`
- `summary`
- `raw_ref`
- `relevance_score`
- `risk_score?`
- `domain_hints?`
- `captured_at`

## 5. TaskSituation 最小字段

- `task_id`
- `context_snapshot`
- `risk_signals`
- `domain_hints`
- `source_refs`
- `generated_at`

## 5.1 SystemSituation 最小字段

- `health_status`：`ok | degraded | overloaded | unhealthy`
- `provider_health`：Map<providerId, { available, latencyP99 }>
- `resource_utilization`：{ memoryMB, cpuPercent, activeProcesses }
- `event_bus_backlog`：pending event 数量
- `generated_at`

## 5.2 ObservationAggregator

`ObservationAggregator` 是 Observe 阶段的唯一出口，聚合 `TaskSituation` + `SystemSituation` 为 `UnifiedObservation`：

```typescript
interface UnifiedObservation {
  taskSituation: TaskSituation;
  systemSituation: SystemSituation;
  aggregatedAt: string;
}
```

## 6. 行为约束

- Observe 默认不改变主任务链，只能产出信号和 `TaskSituation`。
- Observe 阶段输出进入 `Assess / Plan` 前必须可追溯到 source ref 或 signal ref。
- 重复信息必须支持去重与 TTL。
- Observe 分析成本必须可追踪并受预算控制。

## 8. 补充规则

- 信息源能力矩阵至少记录：拉取方式、频率、可信度、成本等级、可触发动作范围。
- `TaskSituationBuilder` 至少产出：`context_snapshot`、`risk_signals`、`domain_hints`。
- `SystemSituationBuilder` 至少产出：`health_status`、`provider_health`、`resource_utilization`、`event_bus_backlog`。
- 主动创建任务或触发动作默认走 HQ/system policy，不得由 Observe 自己直接签发。
