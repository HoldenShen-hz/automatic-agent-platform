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

