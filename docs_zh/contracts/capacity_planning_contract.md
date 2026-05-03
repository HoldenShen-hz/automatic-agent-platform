# Capacity Planning Contract

## 1. 范围

本 contract 定义 `§67` 的容量追踪、预测模型和 what-if 容量仿真。

## 2. Canonical 对象

- `CapacitySignal`
- `CapacityForecast`
- `CapacityAlert`
- `CapacityScenario`
- `CapacityRecommendation`

## 3. `CapacitySignal` 最小字段

- `tenant_id` — 租户关联（必填）
- `harness_run_id?` — canonical 执行关联
- `resource_type` — §53 ResourceKind (`token | tool_call | api | compute | storage | bandwidth | memory | human | side_effect | other`)
- `region_id?`
- `timestamp`
- `usage`
- `queue_depth?`
- `error_budget_burn?`

## 4. 规则

- 容量预测必须保留训练窗口与置信区间。
- what-if 仿真必须可比较多个扩容 / 降配场景。
- 容量建议必须同时考虑成本和 SLO 风险。
- 当 forecast 超过阈值时，必须产出 `CapacityAlert`，至少包含 `alert_id / resource_type / forecast_horizon / predicted_utilization / threshold / severity / recommended_actions / created_at`。

## 5. 测试要求

- unit：trend analysis、forecast、scenario simulation
- integration：runtime metrics -> forecast -> recommendation
- contract：无时间窗口的预测输出不得进入决策链

## v4.3 Contract Remediation

- T-79: 本文原先只定义 signal / forecast / scenario / recommendation，没有把 forecast 超阈值后的显式预警对象冻结下来。修复：正文现新增 `CapacityAlert` 作为容量越线时的权威输出对象。
