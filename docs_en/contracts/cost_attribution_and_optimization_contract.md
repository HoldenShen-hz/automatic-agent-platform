# Cost Attribution And Optimization Contract

## 1. 范围

本 contract defines `§64` 的Decision级成本归因、自动优化Recommendation和 what-if 仿真。

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
- `harness_run_id`
- `node_run_id?`
- `budget_settlement_ref?`
- `decision_directive_ref?`
- `model_ref?`
- `captured_at`

## 4. 规则

- 成本归因粒度至少覆盖 harness run / node run / agent / model / domain。
- 优化Recommendation必须附带收益估计、风险Description和适用范围。
- what-if 仿真不得directly修改真实budgetStatus。
- 若成本no法回链到 `HarnessRun / NodeRun / BudgetSettlement`，不得进入自动优化Recommendation。

## 5. 测试要求

- unit：attribution aggregation、recommendation scoring、simulation
- integration：cost tracker -> optimizer -> dashboard
- contract：no来源成本不得计入优化Recommendation



## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-53: 本文原先把 `decision_ref` 留成通用字符串，Root cause: 成本归因合同长期把“Decision来源”当作报table标签handle，没有把 runtime truth vsbudget结算回链建模成硬约束。修复：正文现把 `CostAttributionRecord` 收敛到 `harness_run_id / node_run_id / budget_settlement_ref / decision_directive_ref` 这组可追溯references用，并禁止no truth 回链的成本进入自动优化。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
