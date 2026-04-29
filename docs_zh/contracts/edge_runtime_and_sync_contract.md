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
- `stateful`
- `lease_migration_supported`
- `checkpoint_required_before_preempt`
- `capabilities`
- `connectivity_mode`
- `max_local_retention_hours`
- `allowed_models`
- `sync_policy`
- `run_version_lock_ref`  (可选，离线节点若持有活跃 NodeRun 则必须关联 RunVersionLock)

规则：

- canonical edge runtime 必须显式声明 `stateful = true`，因为离线执行会持有本地 state、checkpoint 与待同步 evidence。
- `lease_migration_supported` 必须声明该 edge runtime 是否允许在回连或抢占时迁移 lease / ownership。
- 若 `checkpoint_required_before_preempt = true`，在抢占、升级或 region 接管前必须先完成 checkpoint，再允许终止本地执行。
- 离线节点持有活跃 `NodeRun` 时，必须关联 `RunVersionLock`（§24/§25）以确保配置版本冻结语义；配置发布不得改变已冻结 run 的语义，只能通过显式 GraphPatch、OperationalDirective、redrive 或新 HarnessRun 使用新版本。

## 4. 规则

- 边缘 runtime 默认最小权限。
- 离线期间产生的副作用必须写入 `OfflineExecutionRecord`。
- 回连同步必须显式处理冲突、重放和顺序性。
- 若 edge runtime 持有活跃 `NodeRun`，回连同步前必须先提交 checkpoint / receipt / side-effect evidence，再释放 lease。

## 5. 测试要求

- unit：sync envelope、conflict resolution
- integration：offline execute -> reconnect -> sync
- contract：不满足同步策略的边缘节点不得上送受限数据



## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-45: 本文原先把 edge runtime 描述成通用离线 profile，根因是早期边缘文案只关注“能否同步”，没有把 stateful 执行、lease 迁移和抢占前 checkpoint 这些运行时硬约束写进 contract。修复：正文现为 `EdgeRuntimeProfile` 增补 `stateful / lease_migration_supported / checkpoint_required_before_preempt`，并补充持有活跃 `NodeRun` 时的 checkpoint/lease 规则。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
