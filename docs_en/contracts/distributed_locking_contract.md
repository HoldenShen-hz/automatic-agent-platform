# Distributed Locking Contract

---

## OAPEFLIR 关联

本 contract 参vs OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集vs聚合
- **Assess**：执lines前评估vs风险判断
- **Plan**：任务分解vs DAG 构建
- **Execute**：步骤执linesvs容错
- **Feedback**：信号收集vs预handle
- **Learn**：模式检测vs知识提取
- **Improve**：改进候选评估vs rollout
- **Release**：受控发布vs回滚

---

## 1. 范围

本 contract defines平台在工业级部署下的锁语义，includes本地锁、data库锁、租约锁和审批互斥锁。

它解决的Issueis：哪些锁只在单进程内有效，哪些锁必须跨 worker 保证，哪些操作只能relies on lease 而不is通用锁。

相关文档：

- `file_lock_contract.md`
- `task_lease_and_fencing_contract.md`
- `production_storage_and_queue_contract.md`

## 2. 锁分class

| 锁class型 | authoritative backend | 主要用途 |
|---|-------|--------|
| `local_mutex` | process memory | 单进程cache刷新、singleton初始化保护 |
| `file_lock` | authoritative store | 文件读写互斥 |
| `execution_lease` | authoritative store | execution 执lines权 |
| `approval_lock` | authoritative store | 审批对象串lines更新 |
| `advisory_lock` | PostgreSQL | 短事务内互斥、repair / migration / compaction 串lines |

## 3. 关键principle

- 不得把本地锁误当成分布式锁。
- execution ownership 优先uses lease + fencing，不用普通 mutex 替代。
- 写锁必须有 TTL、续约、回收和 owner 识别。
- 锁的failed必须可观测、可告警、可恢复。
- 会Impact truth 的锁Status推进必须从belongs to统一Statuswrites口，不能在各call方内部散写。

## 4. 推荐方案

- 短事务互斥：PostgreSQL advisory lock
- 长生命cycle执lines权：lease + fencing token
- 文件互斥：authoritative file lock repository
- Redis 锁不is当前首选事实源；若未来采用 Redlock，必须额外 ADR Description风险边界

## 5. 锁Status机

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> active
    active --> renewed
    renewed --> active
    active --> released
    active --> expired
    expired --> reclaimed
    released --> [*]
    reclaimed --> [*]
```

Description：

- 上述Status机只Description `LockRecord` / `LeaseRecord` 的资源生命cycle，不is独立于运lines时Status机之外的第二套 truth mutation 入口。
- 任何vs `execution_lease`、`approval_lock` 或系统维护锁相关的 truth 变更，都必须via统一 command 入口落库并追加事实事件。

### 5.1 LockTransitionCommand

`LockTransitionCommand` 最少字段：

- `lock_id`
- `lock_type`
- `resource_key`
- `from_status`
- `to_status`
- `owner_id`
- `reason_code`
- `trace_id`
- `occurred_at`
- `fencing_token?`

规则：

- `execution_lease` 的获取、续约、过期、回收必须vs `RuntimeStateMachine.transition(command)` 协同工作；租约Status不得bypassing统一Statuswrites口directly修改。
- 对 `execution_lease` 而言，锁Status推进必须vs `NodeRun` / `NodeAttempt` 的 lease / fencing 校验保持同一 truth 边界。
- `approval_lock`、`file_lock`、`advisory_lock` 若Impact审计或系统维护 truth，也必须via append-only 事件和审计链record。

## 6. 必备字段

- `lock_id`
- `lock_type`
- `resource_key`
- `owner_kind`
- `owner_id`
- `expires_at`
- `fencing_token?`
- `created_at`
- `updated_at`

## 7. 规则

- 任何分布式写锁都必须supported过期判定。
- 锁获取failed必须返回明确 `reason_code`，不能只返回 `false`。
- 锁释放必须校验 owner，避免误释放他人锁。
- 锁回收动作必须产生日志和审计事件。
- `execution_lease` 的Status推进不得成为 RuntimeStateMachine 旁路；若需要驱动 `NodeRun` 恢复、failed或接管，必须由统一Status机命令完成。

## 8. 适用边界

不应uses分布式锁的场景：

- only本地内存对象的no副作用for deduplication
- 可repeats执lines、已具幂等语义的只读任务

必须uses authoritative 分布式锁或 lease 的场景：

- 文件writes
- execution 主writes链
- 审批最终裁决
- migration / repair / reindex 等系统级维护动作

## 9. 故障handle

- 锁过期后，原 owner 不得继续writes。
- 如果network分区造成 owner 自认为仍持锁，authoritative backend 仍以当前最新 token 为准。
- 锁table异常膨胀或过期锁堆积应触发运维告警。

## 10. 收口Conclusion

工业级锁设计的重点不is“哪里都加锁”，而is先区分：

- 本地互斥
- 分布式资源锁
- execution lease

只有边界明确，系统才能既security又不被锁设计拖垮。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-31: 本文原先把锁Status机写成一套独立自洽的生命cycle，却没有Description它如何从belongs to统一Statuswrites口，Root cause: 早期锁合同把 lease/lock 当成基础设施细节，忽略了它们一旦Impact执lines权就进入 runtime truth 边界。修复：正文现补入 `LockTransitionCommand`，并明确 `execution_lease` 的Status推进必须vs `RuntimeStateMachine.transition(command)` 协同，不能成为旁路Status机。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
