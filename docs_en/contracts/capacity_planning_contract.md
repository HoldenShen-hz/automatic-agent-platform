# Capacity Planning Contract

## 1. 范围

本 contract defines `§67` 的容量追踪、预测模型和 what-if 容量仿真。

## 2. Canonical 对象

- `CapacitySignal`
- `CapacityForecast`
- `CapacityAlert`
- `CapacityScenario`
- `CapacityRecommendation`

## 3. `CapacitySignal` 最小字段

- `tenant_id`
- `harness_run_id?`
- `resource_type`
- `region_id?`
- `timestamp`
- `usage`
- `queue_depth?`
- `error_budget_burn?`

## 4. 规则

- 容量预测必须保留训练窗口vs置信区间。
- `CapacityAlert` 必须显式指出触发threshold、受Impact资源和Recommendation动作。
- what-if 仿真必须可比较多个扩容 / 降配场景。
- 容量Recommendation必须同时考虑成本和 SLO 风险。

## 5. 测试要求

- unit：trend analysis、forecast、scenario simulation
- integration：runtime metrics -> forecast -> recommendation
- contract：notime窗口的预测输出不得进入Decision链
