# Lifecycle And Termination Contract

## 1. 范围

本 contract defines跨实体的通用生命cycle模板，以及终止原因的统一record规则。

相关文档：

- `runtime_state_machine_contract.md`
- `state_transition_matrix_contract.md`
- `transition_service_contract.md`
- `error_code_registry_contract.md`

`terminalReason` / `reason_code` 若暴露为稳定错误语义，必须优先复用 `error_code_registry_contract.md` 中已登记的 code。

## 2. 目标

统一以下实体的生命cycle共性：

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

并为 failed / cancelled / killed / deprecated 等终止态统一补齐原因record。

## 3. 生命cycle模板

通用模板只允许作为投影分组，不得替代 truth Status枚举：

- `created_like`
- `active_like`
- `waiting_like`
- `terminal_like`

领域实体可在此基础上做投影映射，但 truth Status必须保持each canonical 枚举。

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

- `retry_wait`、`awaiting_hitl`、`reconciling` is等待态，不得被压平到泛化 `blocked` 后丢失语义。
- `leased` is执lines权Status，不能用 `active` 投影替代后再反向驱动 lease / fencing 逻辑。
- 所有 truth Status推进仍必须via `RuntimeStateMachine.transition(command)`。

### 3A. OAPEFLIR Stage Lifecycle

`StageLifecycleRecord` 最小字段：

| 字段 | class型 | Description |
|---|-------|--------|
| `harness_run_id` | `string` | 关联 HarnessRun |
| `task_id` | `string?` | 关联任务查询入口 |
| `loop_iteration_view` | `integer` | 第几轮闭环视图 |
| `stage_view_ref` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release` | 当前阶段视图 |
| `status` | `pending \| active \| completed \| skipped \| failed \| timed_out` | 阶段Status |
| `entered_at` | `timestamp` | 进入time |
| `exited_at` | `timestamp?` | 退出time |
| `reason_code` | `string?` | 跳过、failed、timeout原因 |

规则：

- 阶段Statusis `HarnessRun` / workflow 投影的下钻视图，不替代 `HarnessRun` 或 `NodeRun` 主Status。
- `skipped` 必须有显式原因，不能用作failed的别名。
- `timed_out` 必须保留和 runtime execution 的对应 evidence 或 alert references用。

### 3B. Release Lifecycle

`ReleaseRecord` 生命cycle最小枚举：

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

- release level 和 release status is两个维度，不得混成一个单Status字段。
- 任何 release 终态都必须留下 metrics / approval / policy lineage。
- `canary / partial / stable` belongs to设计目标态，当前若未enabled，不得在 contract 中as已落地 authoritative 运lines级别。

## 4. 暂停vs阻塞语义

- `queued`: 尚未开始
- `blocked`: relies on未满足或外部条件未满足
- `paused`: 主动暂停，具备可恢复上下文
- `waiting_input`: 等待人或外部输入
- `throttled`: 因限流/背压挂起
- `suspended`: 系统级冻结
- `draining`: worker 或子系统正在排空当前执lines，不再accepts新任务派发

`draining` 规则：

- `draining` is worker 级别的生命cycleStatus，不is任务或 execution 的Status。
- 进入 `draining` 的 worker 必须完成已持有 lease 的执lines（或主动 handover），不得accepts新的 dispatch ticket。
- `draining` 完成后 worker 进入 `offline` 或被注销，不directly进入 `active`。
- 典型触发场景：滚动升级（`upgrade_migration`）、负载再平衡（`load_rebalance`）、运维主动下线（`operator_drain`）。
- `draining` 必须vs `task_lease_and_fencing_contract.md` 中的 lease handover 语义配合，确保执lines权的有序转移。

## 5. `TerminationRecord`

| 字段 | class型 | Description |
|---|-------|--------|
| `termination_reason_code` | `string` | 终止原因码 |
| `termination_initiator` | `user \| agent \| system \| scheduler \| admin` | 谁触发 |
| `termination_scope` | `node \| run \| task_tree \| tenant \| region \| platform` | Impact范围 |
| `recoverable` | `boolean` | isno可恢复 |
| `terminated_at` | `timestamp` | 终止time |

## 5A. LearningObject / ImprovementCandidate 生命cycle

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

- learning object 的 `promoted` 只table示其进入可复用池，不等于自动发布到运lines策略。
- improvement candidate 的 `accepted` 不等于已发布；进入 release 前仍需 release / policy / approval 约束。
- `rolled_back` 必须保留指向原 candidate 或 strategy version 的 lineage，不能只在日志中留痕。

## 6. 收口Conclusion

生命cycle模板化和终止原因统一化，能显著减少Statusdefines分裂、排障困难和 UI 展示混乱。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-21: 本文原先用 `initial / active / paused / blocked / failed / terminal` 泛化模板覆盖所有对象，Root cause: 早期想统一 UI 生命cycle展示，却把投影模板误写成了 runtime truth。修复：正文现把模板降为 `created_like / active_like / waiting_like / terminal_like` 投影分组，并显式写回 `HarnessRun.status` vs `NodeRun.status` 的 canonical Status全集。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
