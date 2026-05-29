# ADR-112: MVP Ring Implementation Boundary

- Status：Accepted
- Decision日期：2026-04-27

## Background

平台目标态contains企业治理、24 域、多区域、Marketplace、Edge、PlatformOps 和运营成熟度能力。若首批实现试图一iterations性落满目标态，v4.3 Contract Freeze 会被外围能力拖慢，核心 HarnessRuntime no法形成可运lines闭环。

## Decision

1. v4.3 按三环推进：
   - Ring 1 MVP：contract freeze、intake、HarnessRun、PlanGraphBundle、Graph Scheduler、NodeRun、NodeAttemptReceipt、Budget、SideEffect、HITL basic、Event/Audit/Evidence。
   - Ring 2 Hardening：replay、recovery、lease/fencing、DLQ、diagnostics、evidence bundle、runtime drill。
   - Ring 3 Enterprise：组织治理、SSO/SCIM、多租户隔离、多区域、Marketplace、Edge、PlatformOps、24 域批量接入。
2. Ring 1 iscode实现的第一目标；Ring 2/3 不得反向阻塞 Ring 1 的 API、schema、Status机和测试冻结。
3. `docs_zh/contracts/` 的 v4.3 contract is Ring 1 的实现入口；旧 contract 可作为历史兼容Description，但不defines MVP 主链。
4. 24 域、12 DomainRecipe 原型和企业级规模化能力在核心 runtime 语义稳定后再按 wave 接入。

## Ring 1 验收边界

- 能从 `TaskDraft` via `ConfirmedTaskSpec` 创建 `RequestEnvelope`。
- 能创建并推进 `HarnessRun`。
- 能接收 `PlanGraphBundle`，调度 ready `NodeRun`。
- 能record `NodeAttempt` vs `NodeAttemptReceipt`。
- 能via `RuntimeStateMachine.transition(command)` 推进Status并追加 `platform.*` fact event。
- 能执linesbudget reservation / settlement vs副作用 reconciliation / compensation 最小闭环。
- 能record `DecisionInputBundle`、`HarnessDecision` vs `HumanResponsibilityRecord`。

## Consequences

- 当前开发计划优先更新 `docs_zh/operations/current_todo_list.md`、ADR vs contract。
- code实现以 `src/platform/contracts/` 和 runtime MVP 为第一批落点。
- `docs_en/` 在本轮不修改。

## 关联文档

- [109-contract-freeze.md](./109-contract-freeze.md)
- [00-platform-architecture.md](../architecture/00-platform-architecture.md)
- [current_todo_list.md](../operations/current_todo_list.md)
