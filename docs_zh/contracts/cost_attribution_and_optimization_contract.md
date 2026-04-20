# Cost Attribution And Optimization Contract

## 1. 范围

本 contract 定义 `§64` 的决策级成本归因、自动优化建议和 what-if 仿真。

## 2. Canonical 对象

- `CostAttributionRecord`
- `OptimizationRecommendation`
- `CostSimulationScenario`
- `CostDashboardSlice`

## 3. `CostAttributionRecord` 最小字段

- `subject_type`
- `subject_id`
- `cost_type`
- `amount_usd`
- `decision_ref`
- `model_ref?`
- `captured_at`

## 4. 规则

- 成本归因粒度至少覆盖 task / workflow / agent / model / domain。
- 优化建议必须附带收益估计、风险说明和适用范围。
- what-if 仿真不得直接修改真实预算状态。

## 5. 测试要求

- unit：attribution aggregation、recommendation scoring、simulation
- integration：cost tracker -> optimizer -> dashboard
- contract：无来源成本不得计入优化建议

