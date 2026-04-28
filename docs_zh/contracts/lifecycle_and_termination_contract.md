# Lifecycle And Termination Contract

## 1. 范围

本 contract 定义跨实体的通用生命周期模板，以及终止原因的统一记录规则。

相关文档：

- `runtime_state_machine_contract.md`
- `state_transition_matrix_contract.md`
- `transition_service_contract.md`

## 2. 目标

统一以下实体的生命周期共性：

- harness_run
- node_run
- node_attempt
- task_view
- workflow_view
- approval
- plugin / skill
- feedback_signal
- learning_object
- improvement_candidate
- release_record
- strategy_version
- stage_lifecycle_record

并为 failed / cancelled / killed / deprecated 等终止态统一补齐原因记录。

## 3. 生命周期模板

通用模板只允许作为投影分组，不得替代 truth 状态枚举：

- `created_like`
- `active_like`
- `waiting_like`
- `terminal_like`

领域实体可在此基础上做投影映射，但 truth 状态必须保持各自 canonical 枚举。

### 3.1 HarnessRun Truth Lifecycle

`HarnessRun.status` canonical states:

- `created`
- `admitted`
- `planning`
- `ready`
- `running`
- `pausing`
- `paused`
- `resuming`
- `replanning`
- `compensating`
- `completed`
- `failed`
- `aborted`

终态：`completed / failed / aborted`。

### 3.2 NodeRun Truth Lifecycle

`NodeRun.status` canonical states:

- `created`
- `ready`
- `leased`
- `running`
- `retry_wait`
- `awaiting_hitl`
- `reconciling`
- `succeeded`
- `failed`
- `skipped`
- `cancelled`
- `dependency_failed`
- `policy_blocked`
- `aborted`

终态：`succeeded / failed / skipped / cancelled / dependency_failed / policy_blocked / aborted`。

规则：

- `retry_wait`、`awaiting_hitl`、`reconciling` 是等待态，不得被压平到泛化 `blocked` 后丢失语义。
- `leased` 是执行权状态，不能用 `active` 投影替代后再反向驱动 lease / fencing 逻辑。
- 所有 truth 状态推进仍必须通过 `RuntimeStateMachine.transition(command)`。

### 3A. OAPEFLIR Stage Lifecycle

`StageLifecycleRecord` 最小字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `harness_run_id` | `string` | 关联 HarnessRun |
| `task_id` | `string?` | 关联任务查询入口 |
| `loop_iteration_view` | `integer` | 第几轮闭环视图 |
| `stage_view_ref` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release` | 当前阶段视图 |
| `status` | `pending \| active \| completed \| skipped \| failed \| timed_out` | 阶段状态 |
| `entered_at` | `timestamp` | 进入时间 |
| `exited_at` | `timestamp?` | 退出时间 |
| `reason_code` | `string?` | 跳过、失败、超时原因 |

规则：

- 阶段状态是 `HarnessRun` / workflow 投影的下钻视图，不替代 `HarnessRun` 或 `NodeRun` 主状态。
- `skipped` 必须有显式原因，不能用作失败的别名。
- `timed_out` 必须保留和 runtime execution 的对应 evidence 或 alert 引用。

### 3B. Release Lifecycle

`ReleaseRecord` 生命周期最小枚举：

- `pending`
- `running`
- `completed`
- `rolled_back`
- `failed`

Release 级别在当前 phase1-4 authoritative 边界内只允许：

- `off`
- `suggest`
- `shadow`

规则：

- release level 和 release status 是两个维度，不得混成一个单状态字段。
- 任何 release 终态都必须留下 metrics / approval / policy lineage。
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
| `termination_scope` | `node \| run \| task_tree \| tenant \| region \| platform` | 影响范围 |
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
- improvement candidate 的 `accepted` 不等于已发布；进入 release 前仍需 release / policy / approval 约束。
- `rolled_back` 必须保留指向原 candidate 或 strategy version 的 lineage，不能只在日志中留痕。

## 6. 收口结论

生命周期模板化和终止原因统一化，能显著减少状态定义分裂、排障困难和 UI 展示混乱。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-21: 本文原先用 `initial / active / paused / blocked / failed / terminal` 泛化模板覆盖所有对象，根因是早期想统一 UI 生命周期展示，却把投影模板误写成了 runtime truth。修复：正文现把模板降为 `created_like / active_like / waiting_like / terminal_like` 投影分组，并显式写回 `HarnessRun.status` 与 `NodeRun.status` 的 canonical 状态全集。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
