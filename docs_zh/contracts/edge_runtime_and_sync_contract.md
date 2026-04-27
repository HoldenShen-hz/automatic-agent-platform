# Edge Runtime And Sync Contract

## 1. 范围

本 contract 定义 `§62` 的最小边缘运行时、离线执行约束和同步协议。

## 2. Canonical 对象

- `EdgeRuntimeProfile`
- `OfflineExecutionRecord`
- `SyncEnvelope`
- `ConflictResolutionDecision`

## 3. `EdgeRuntimeProfile` 最小字段

- `edge_node_id`
- `capabilities`
- `connectivity_mode`
- `max_local_retention_hours`
- `allowed_models`
- `sync_policy`

## 4. 规则

- 边缘 runtime 默认最小权限。
- 离线期间产生的副作用必须写入 `OfflineExecutionRecord`。
- 回连同步必须显式处理冲突、重放和顺序性。

## 5. 测试要求

- unit：sync envelope、conflict resolution
- integration：offline execute -> reconnect -> sync
- contract：不满足同步策略的边缘节点不得上送受限数据



## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-45: 缺架构§8.3要求EdgeRuntime声明stateful=true/lease_migration_supported/checkpoint_required_before_preempt。修复：该语义收敛到 v4.3 canonical contract；旧字段、旧状态、旧 DTO 或旧术语仅允许作为 legacy/deprecated/projection/migration input，不得作为新实现入口。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
