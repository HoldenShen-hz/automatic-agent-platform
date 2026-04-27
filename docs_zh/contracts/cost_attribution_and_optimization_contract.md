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



## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-53: CostAttributionRecord.decision_ref为通用string，架构要求可追踪到HarnessRun/NodeRun/BudgetSettlement。修复：该语义收敛到 v4.3 canonical contract；旧字段、旧状态、旧 DTO 或旧术语仅允许作为 legacy/deprecated/projection/migration input，不得作为新实现入口。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
