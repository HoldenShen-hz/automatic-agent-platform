# Edge Runtime And Sync Contract

## 1. 范围

本 contract defines `§62` 的最小边缘运lines时、离线执lines约束和synchronous协议。

## 2. Canonical 对象

- `EdgeDeploymentMode`
- `EdgeRuntimeProfile`
- `OfflineExecutionRecord`
- `SyncEnvelope`
- `ConflictResolutionDecision`

`EdgeDeploymentMode` 允许以下分class：

- `edge_micro`
- `edge_standard`
- `edge_mobile`
- `edge_hybrid`

## 3. `EdgeRuntimeProfile` 最小字段

- `edge_node_id`
- `stateful`
- `lease_migration_supported`
- `checkpoint_required_before_preempt`
- `capabilities`
- `connectivity_mode`
- `deployment_mode?`
- `max_local_retention_hours`
- `allowed_models`
- `sync_policy`

规则：

- canonical edge runtime 必须显式声明 `stateful = true`，因为离线执lines会持有本地 state、checkpoint vs待synchronous evidence。
- `lease_migration_supported` 必须声明该 edge runtime isno允许在回连或抢占时迁移 lease / ownership。
- 若 `checkpoint_required_before_preempt = true`，在抢占、升级或 region 接管前必须先完成 checkpoint，再允许终止本地执lines。
- 若 `deployment_mode` 未显式提供，runtime 必须根据 capability / connectivity 自动解析为 `edge_micro | edge_standard | edge_mobile | edge_hybrid` 之一，避免边缘运lines态未分class。

## 4. 规则

- 边缘 runtime defaults to最小permission。
- 离线期间产生的副作用必须writes `OfflineExecutionRecord`。
- 回连synchronous必须显式handleconflicts、重放和顺序性。
- 若 edge runtime 持有活跃 `NodeRun`，回连synchronous前必须先提交 checkpoint / receipt / side-effect evidence，再释放 lease。

## 5. 测试要求

- unit：sync envelope、conflict resolution
- integration：offline execute -> reconnect -> sync
- contract：不满足synchronous策略的边缘节点不得上送受限data



## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-45: 本文原先把 edge runtime Description成通用离线 profile，Root cause: 早期边缘文案只关注“能nosynchronous”，没有把 stateful 执lines、lease 迁移和抢占前 checkpoint 这些运lines时硬约束写进 contract。修复：正文现为 `EdgeRuntimeProfile` 增补 `stateful / lease_migration_supported / checkpoint_required_before_preempt`，并补充持有活跃 `NodeRun` 时的 checkpoint/lease 规则。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
