# ADR-109: v4.3 Contract Freeze

## 状态

Accepted

## 决策日期

2026-04-27

## 背景

`docs_zh/architecture/00-platform-architecture.md` 已将 v4.1 深度评审、v4.2 pre-freeze 修正与 OAPEFLIR v4.4 executable spec 收敛为 v4.3 可执行规格冻结口径。此前 ADR 与 contract 中仍存在多套历史命名，包括 `ExecutionPlan`、`ExecutionReceipt`、`ControlDirective`、`StateCommand`、`workflow_run` 与线性 `step` 语义。若继续让这些名称作为实现入口，运行时会形成第二套 truth source。

## 决策

1. v4.3 以 `00-platform-architecture.md` 的 `§1.5 v4.3 Contract Freeze Scope` 为冻结范围。
2. 首批实现只以以下 12 组契约作为 canonical 入口：
   - `TaskDraft` / `ConfirmedTaskSpec` / `RequestEnvelope`
   - `HarnessRun`
   - `PlanGraphBundle` / `PlanGraph` / `PlanNode` / `PlanEdge`
   - `GraphPatch` / `GraphPatchOperation`
   - `NodeRun` / `NodeAttempt` / `AttemptLineage`
   - `NodeAttemptReceipt`
   - `SideEffectRecord` / `ReconciliationRecord` / `CompensationRecord`
   - `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`
   - `RunVersionLock` / `ArtifactVersionLockSet`
   - `DecisionInputBundle` / `HarnessDecision`
   - `HumanResponsibilityRecord`
   - `EventEnvelope` / `PlatformFactEvent` / `OapeflirViewEvent`
3. `ExecutionPlan`、`ExecutionReceipt`、`ControlDirective`、`StateCommand` 等旧名只允许作为 legacy adapter、deprecated alias、projection 或迁移说明出现，不得作为新模块的 public contract。
4. 中文文档优先冻结：先更新 `docs_zh/operations/current_todo_list.md`，再更新 `docs_zh/adr/` 与 `docs_zh/contracts/`，最后进入代码实现。
5. 已 Accepted 的历史 ADR 不改写正文；本 ADR 通过 supersede 关系收束历史语义。

## 被取代或约束的历史语义

- ADR-021 的平面间通信语义继续保留，但跨平面执行对象必须使用 v4.3 canonical contract。
- ADR-029 的 OAPEFLIR 语义继续保留，但 OAPEFLIR 不拥有独立执行权。
- ADR-030 的 runtime execution plane 继续保留，但状态推进入口由 v4.3 Contract Freeze 的 `RuntimeStateMachine.transition(command)` 统一定义。

## 后果

- 新实现可以建立 contract naming consistency test，直接阻止旧名重新成为 canonical 类型。
- contract 文档成为代码实现前置门禁；没有 contract 的 runtime 对象不得进入 MVP 主链。
- 旧 API 与旧查询表可以保留兼容层，但必须清楚标注 projection / deprecated / legacy。

## 关联文档

- [00-platform-architecture.md](../architecture/00-platform-architecture.md)
- [contracts/README.md](../contracts/README.md)
- [current_todo_list.md](../operations/current_todo_list.md)
