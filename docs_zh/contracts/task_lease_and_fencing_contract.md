# Task Lease And Fencing Contract

---

## OAPEFLIR 关联

本 contract 参与 OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集与聚合
- **Assess**：执行前评估与风险判断
- **Plan**：任务分解与 DAG 构建
- **Execute**：步骤执行与容错
- **Feedback**：信号收集与预处理
- **Learn**：模式检测与知识提取
- **Improve**：改进候选评估与 release
- **Release**：受控发布与回滚

---

## 1. 范围

本 contract 定义工业级执行平面里的任务租约、续约、回收和 fencing token 规则。

它回答的问题是：当 `NodeRun` 被派发到 worker 后，系统如何保证只有当前合法持有者能继续写结果，避免双写、脏写和 stale worker 回写。

相关文档：

- `runtime_execution_contract.md`
- `execution_plane_contract.md`
- `storage_schema_contract.md`
- `distributed_locking_contract.md`

## 2. 目标

- 为每个 active `NodeRun` 建立 authoritative lease。
- 用 `visibility timeout` 和 `lease renew` 控制执行权生命周期。
- 用 `fencing token` 拒绝旧 worker 的回写。
- 让恢复、接管、重试和死信进入统一链路。

## 3. 非目标

- 本 contract 不规定具体队列产品。
- 本 contract 不替代任务主状态机。
- Phase 1a 不要求完整分布式部署，但 contract 从一开始按多 worker 语义定义。

## 4. 关键对象

- `LeaseGrant`
- `LeaseRenewal`
- `LeaseReclaimDecision`
- `FencingToken`
- `StaleWriteRejection`
- `QueueDispatchRecord`
- `LeaseAuditRecord`
- `LeaseReconciliationRecord`

## 5. `LeaseGrant` 最小字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `lease_id` | `string` | 租约 ID |
| `node_run_id` | `string` | 目标 `NodeRun` |
| `worker_id` | `string` | 当前持有者 |
| `attempt_id` | `string` | 关联 `NodeAttempt` |
| `fencing_token` | `integer` | 单调递增执行权版本 |
| `leased_at` | `timestamp` | 获取时间 |
| `expires_at` | `timestamp` | 当前到期时间 |
| `status` | `active \| expired \| released \| reclaimed \| handed_over` | 租约状态（`handed_over` 见 §8A lease handover，对齐 `execution_plane_contract.md` §9） |

规则：

- 同一 `node_run_id` 在任一时刻只能有一个 `active` lease。
- 每次重新派发、接管或回收后重新授予 lease 时，`fencing_token` 必须递增。
- 任何副作用写入都必须带上当前 `fencing_token`。

## 6. 生命周期

```mermaid
flowchart TD
    A["Dispatch Ticket"] --> B["Acquire Lease"]
    B --> C["Grant Fencing Token"]
    C --> D["Run Execution"]
    D --> E["Renew Lease"]
    E --> F{"Completed?"}
    F -- "Yes" --> G["Release Lease"]
    F -- "No" --> H{"Lease Expired / Worker Lost?"}
    H -- "No" --> E
    H -- "Yes" --> I["Reclaim Lease"]
    I --> J["New Ticket / New Lease"]
```

## 7. 续约与回收

- worker 必须在 `expires_at` 前完成续约。
- 连续续约失败达到阈值后，lease 进入 `expired`，原 worker 失去执行权。
- 回收动作必须记录 `reason_code`，如：
  - `heartbeat_missing`
  - `worker_disconnected`
  - `worker_unhealthy`
  - `operator_takeover`
  - `budget_forced_stop`

## 8. Fencing Token 规则

- `fencing_token` 是 `NodeRun` 写权限版本号，不是展示字段。
- storage 层更新 `NodeRun`、artifact、tool result、side-effect receipt 时必须比较 token。
- 小于当前 authoritative token 的写入必须被拒绝，并记录 `stale_write_rejected` 审计事件。
- worker 本地缓存的旧 lease 即使尚未感知过期，也不得被系统接受。

## 8A. Lease Handover

### 8A.1 语义

Handover 是指在不中断 execution 的前提下，由当前 worker 主动将 lease 转移给新 worker 的受控操作。与 lease 过期后的被动回收不同，handover 是协作式的、可追踪的。

### 8A.2 `HandoverExecutionLeaseInput`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `leaseId` | `string` | 当前 active lease |
| `workerId` | `string` | 原 worker（必须是当前持有者） |
| `newWorkerId` | `string` | 目标 worker |
| `ttlMs` | `number` | 新 lease 的存活时间 |
| `reasonCode?` | `string` | handover 原因（如 `worker_draining`、`load_rebalance`、`upgrade_migration`） |

### 8A.3 `ExecutionLeaseHandoverDecision`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `outcome` | `handed_over \| blocked` | 结果 |
| `reasonCode` | `string?` | 如果被阻塞，原因码 |
| `previousLease` | `ExecutionLeaseRecord?` | 原 lease（已标记 `released`） |
| `lease` | `ExecutionLeaseRecord?` | 新 lease（新 fencing token） |

### 8A.4 规则

- handover 必须在单个事务内完成：释放旧 lease → 创建新 lease → 递增 fencing token → 更新 execution owner 和 worker snapshot。
- 只有 `active` 状态的 lease 才能 handover。
- 旧 lease 的 `workerId` 必须匹配请求中的 `workerId`。
- handover 完成后必须写入 `lease_audit`（event_type: `handover`），记录 source worker、target worker 和 lineage。
- handover 失败不应导致 execution 变为无主状态。

### 8A.5 典型场景

| 场景 | 触发方 | reasonCode |
| --- | --- | --- |
| worker 进入 draining | worker 自身 | `worker_draining` |
| 负载再平衡 | control plane | `load_rebalance` |
| 滚动升级 | 运维 | `upgrade_migration` |
| 运维主动切换 | operator | `operator_handover` |

## 9. 与恢复链的关系

- lease 过期不等于任务失败。
- lease 过期后，系统应进入恢复判断：
  - `resume_same_worker`
  - `retry_new_ticket`
  - `manual_takeover`
  - `move_dead_letter`

## 10. 队列绑定与审计

`QueueDispatchRecord` 最小字段：

- `dispatch_id`
- `node_run_id`
- `queue_name`
- `enqueued_at`
- `dequeued_at?`
- `worker_id?`
- `lease_id?`
- `status` (`queued | dequeued | leased | completed | abandoned`)

`LeaseAuditRecord` 最小字段：

- `audit_id`
- `node_run_id`
- `lease_id`
- `worker_id`
- `event_type` (`lease_granted | lease_renewed | lease_expired | lease_reclaimed | stale_write_rejected | lease_released`)
- `reason_code?`
- `recorded_at`

规则：

- dispatch、lease 和最终写权限拒绝必须能串成一条审计链。
- queue 状态用于回答“任务是否已经被派发、是否已被取走、是否已获得 lease”。
- stale write rejection 必须写入 lease 审计，而不能只落到临时日志里。

## 11. Reconciliation

`LeaseReconciliationRecord` 最小字段：

- `reconciliation_id`
- `node_run_id`
- `lease_id`
- `issue_type` (`stale_lease | duplicate_owner | replay_recovery_needed | orphan_queue_claim`)
- `detected_at`
- `resolution_action` (`extend | release | reclaim | handover | block_for_manual`)
- `resolved_at?`

### 11.1 Dispatch Reconciliation 扫描

Reconciliation 服务扫描所有 `pending` 或 `claimed` 状态的 `NodeRun` dispatch ticket，检测以下异常：

| issue_type | 检测条件 | 修复动作 |
| --- | --- | --- |
| `execution_terminal` | ticket 关联的 execution 已达终态（`succeeded / failed / cancelled / superseded`） | 作废 ticket（不生成替代 ticket） |
| `missing_active_lease` | ticket 已被 claim 但无 active lease | 作废旧 ticket + 创建替代 ticket（requeue） |
| `lease_ticket_mismatch` | lease 的 leaseId 或 workerId 与 ticket 不匹配 | 作废旧 ticket + 创建替代 ticket |
| `lease_expired_unreclaimed` | lease 已过 `expires_at` 但未被回收 | 作废旧 ticket + 创建替代 ticket |

### 11.2 Requeue 语义

替代 ticket 继承原 ticket 的以下属性：

- `node_run_id`、`priority`、`queue_name`
- `dispatch_target`、`required_isolation_level`、`required_capabilities`
- `dispatch_after`

替代 ticket 重置：`status = pending`、新的 `ticket_id`、新的 `created_at`。

### 11.3 Reconciliation 事件

| 事件 | 含义 |
| --- | --- |
| `dispatch:ticket_reconciled` | ticket 因 issue 被作废 |
| `dispatch:ticket_requeued` | 新替代 ticket 被创建 |

两者在同一事务内原子发出，事件 payload 必须包含 `issueType` 和 `reasonCode`。

### 11.4 规则

- 系统必须周期性扫描 stale lease、duplicate owner 和 orphan queue claim。
- reconciliation 是 authoritative repair 行为，不得只依赖人工日志排查。
- duplicate owner 决议后，必须显式记录 winner，并对 loser 写入 stale/fenced 结果。
- terminal execution 的 ticket 只作废不 requeue，避免为已完成的执行创建无效 ticket。

## 12. 一致性要求

工业级最低一致性要求：

- `NodeRun` 当前 lease：强一致
- fencing token 比较：强一致
- heartbeat 展示：最终一致
- worker UI 状态：最终一致

## 13. Phase 边界

Phase 1a / 1b：

- 允许单实例 control plane
- 允许 lease authoritative store 暂落在 SQLite/PG 抽象之下
- 必须先把 token 语义和 stale write rejection 定死

Phase 2+：

- 扩展到多 worker、多 queue、多租户隔离

## 14. 收口结论

Lease 解决“谁现在可以执行”，fencing token 解决“谁现在可以写结果”。

工业级系统必须同时具备这两层，才能避免重复执行和旧结果覆盖新结果。

## 15. Legacy / Deprecated 映射

| 旧名 | 新语义 |
| --- | --- |
| `execution_id` | legacy queue / repository 字段；v4.3 规范对象应映射为 `node_run_id` |
| `attempt` | legacy attempt 序号；v4.3 规范对象应映射为 `attempt_id` / `NodeAttempt` |
| `task lease` | 仅保留叙事语义；权威对象是 `NodeRun` lease |


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-6: 使用已废弃术语 execution_id，架构v4.0统一为 node_run_id。根因：该文档沿用了 v3 execution-centric 队列/租约术语，但没有随 `HarnessRun` / `NodeRun` 权威对象迁移同步更新。修复：`LeaseGrant`、`QueueDispatchRecord`、`LeaseAuditRecord`、`LeaseReconciliationRecord` 与 requeue 语义均已收敛到 `node_run_id` / `attempt_id`；`execution_id` 只保留为 legacy 映射说明。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
