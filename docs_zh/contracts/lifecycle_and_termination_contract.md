# Lifecycle And Termination Contract

## 1. 范围

本 contract 定义跨实体的通用生命周期模板，以及终止原因的统一记录规则。

相关文档：

- `runtime_state_machine_contract.md`
- `state_transition_matrix_contract.md`
- `transition_service_contract.md`

## 2. 目标

统一以下实体的生命周期共性：

- task
- workflow
- execution
- approval
- plugin / skill
- feedback_signal
- learning_object
- improvement_candidate
- rollout_record
- strategy_version
- stage_lifecycle_record

并为 failed / cancelled / killed / deprecated 等终止态统一补齐原因记录。

## 3. 生命周期模板

通用模板：

- `initial`
- `active`
- `paused`
- `blocked`
- `failed`
- `terminal`

领域实体可在此基础上扩展自己的细分状态，但不得丢失模板映射。

### 3A. OAPEFLIR Stage Lifecycle

`StageLifecycleRecord` 最小字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `task_id` | `string` | 关联任务 |
| `loop_iteration` | `integer` | 第几轮闭环 |
| `stage` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release` | 当前阶段 |
| `status` | `pending \| active \| completed \| skipped \| failed \| timed_out` | 阶段状态 |
| `entered_at` | `timestamp` | 进入时间 |
| `exited_at` | `timestamp?` | 退出时间 |
| `reason_code` | `string?` | 跳过、失败、超时原因 |

规则：

- 阶段状态是 workflow 生命周期的下钻视图，不替代 workflow 主状态。
- `skipped` 必须有显式原因，不能用作失败的别名。
- `timed_out` 必须保留和 runtime execution 的对应 evidence 或 alert 引用。

### 3B. Rollout Lifecycle

`RolloutRecord` 生命周期最小枚举：

- `pending`
- `running`
- `completed`
- `rolled_back`
- `failed`

Rollout 级别在当前 phase1-4 authoritative 边界内只允许：

- `off`
- `suggest`
- `shadow`

规则：

- rollout level 和 rollout status 是两个维度，不得混成一个单状态字段。
- 任何 rollout 终态都必须留下 metrics / approval / policy lineage。
- `canary / partial / stable` 属于设计目标态，当前若未启用，不得在 contract 中伪装成已落地 authoritative 运行级别。

## 4. 暂停与阻塞语义

- `queued`: 尚未开始
- `blocked`: 依赖未满足或外部条件未满足
- `paused`: 主动暂停，具备可恢复上下文
- `waiting_input`: 等待人或外部输入
- `throttled`: 因限流/背压挂起
- `suspended`: 系统级冻结
- `draining`: worker 或子系统正在排空当前执行，不再接受新任务派发

`draining` 规则：

- `draining` 是 worker 级别的生命周期状态，不是任务或 execution 的状态。
- 进入 `draining` 的 worker 必须完成已持有 lease 的执行（或主动 handover），不得接受新的 dispatch ticket。
- `draining` 完成后 worker 进入 `offline` 或被注销，不直接进入 `active`。
- 典型触发场景：滚动升级（`upgrade_migration`）、负载再平衡（`load_rebalance`）、运维主动下线（`operator_drain`）。
- `draining` 必须与 `task_lease_and_fencing_contract.md` 中的 lease handover 语义配合，确保执行权的有序转移。

## 5. `TerminationRecord`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `termination_reason_code` | `string` | 终止原因码 |
| `termination_initiator` | `user \| agent \| system \| scheduler \| admin` | 谁触发 |
| `termination_scope` | `unit \| task_tree \| workflow \| tenant \| system` | 影响范围 |
| `recoverable` | `boolean` | 是否可恢复 |
| `terminated_at` | `timestamp` | 终止时间 |

## 5A. LearningObject / ImprovementCandidate 生命周期

`LearningObjectStatus` 最小枚举：

- `draft`
- `validated`
- `promoted`
- `decayed`
- `archived`

`ImprovementCandidateStatus` 最小枚举：

- `proposed`
- `evaluating`
- `accepted`
- `rejected`
- `deployed`
- `rolled_back`

规则：

- learning object 的 `promoted` 只表示其进入可复用池，不等于自动发布到运行策略。
- improvement candidate 的 `accepted` 不等于已发布；进入 release 前仍需 rollout / policy / approval 约束。
- `rolled_back` 必须保留指向原 candidate 或 strategy version 的 lineage，不能只在日志中留痕。

## 6. 收口结论

生命周期模板化和终止原因统一化，能显著减少状态定义分裂、排障困难和 UI 展示混乱。
