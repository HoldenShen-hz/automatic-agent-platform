# State Transition Matrix Contract

> **OAPEFLIR 相关**：本 contract 定义 OAPEFLIR 8 阶段状态转换矩阵，对应 ADR-016。
> **更新日期**：2026-04-17

## 1. 范围

本 contract 收口任务、工作流、会话、审批和执行 run 的统一状态视图。

它补充 `runtime_state_machine_contract.md`，回答两个问题：

- 哪组状态是唯一运行真相来源。
- 多套状态机之间如何映射、谁能驱动谁。

## 2. 核心原则

- `HarnessRun.status` 是运行真相来源，所有任务级“是否还在跑、是否已完成、是否失败”判断都必须从它派生。
- `NodeRun.status` 是节点执行真相来源，负责表达 ready / running / awaiting_hitl / retry_wait / terminal 等执行态。
- `tasks.status`、`workflow_state.status`、`executions.status` 仅允许作为读模型、兼容投影或迁移输入，不得反向驱动 truth transition。
- `sessions.status` 只表达渠道交互态。
- `approvals.status` 只表达审批对象状态；审批结果通过状态机命令影响 `HarnessRun` / `NodeRun`，而不是直接改写投影表终态。

## 3. 主状态来源

| 领域 | authoritative 状态 | 作用 |
| --- | --- | --- |
| 运行主链 | `HarnessRun.status` | 唯一运行级真相来源，决定任务是否活跃、暂停、完成、失败或中止 |
| 节点执行 | `NodeRun.status` | 唯一节点级真相来源，决定租约、重试、HITL 等执行推进 |
| 审批对象 | `approvals.status` | 审批本身是否待决、批准、拒绝、超时 |
| 会话 | `sessions.status` | 渠道交互进度 |
| 任务/工作流/execution 读模型 | `tasks.status` / `workflow_state.status` / `executions.status` | 查询投影、兼容输出、历史迁移输入；不得单独定义 truth |

对 OAPEFLIR 闭环新增的演化实体，authoritative 状态建议至少拆分为：

| 领域 | authoritative 状态 | 作用 |
| --- | --- | --- |
| 学习对象 | `learning_objects.promotion_status` | 证据校验、推广边界 |
| 改进候选 | `improvement_candidates.status` | Improve 评估与审批边界 |
| release | `release_records.status` | Release 阶段推进与阻断 |

## 4. 统一映射表

| 触发条件 | `HarnessRun.status` | `NodeRun.status` | 常见投影 | `sessions.status` |
| --- | --- | --- | --- | --- |
| 请求已接纳但尚未生成 ready 节点 | `created / admitted / planning` | `created` | `tasks.status=queued|pending`，`workflow_state.status=pending`，`executions.status=created` | `open` |
| 图已就绪并进入执行 | `ready / running` | `ready / leased / running` | `tasks.status=in_progress`，`workflow_state.status=running`，`executions.status=executing` | `streaming` 或 `open` |
| 等待审批/人工输入 | `running / paused` | `awaiting_hitl / blocked` | `tasks.status=awaiting_decision`，`workflow_state.status=paused`，`executions.status=blocked` | `awaiting_user` 或 `paused` |
| 重试等待或恢复中 | `resuming / replanning / running` | `retry_wait / reconciling / ready / running` | `tasks.status=in_progress`，`workflow_state.status=resuming`，`executions.status=prechecking|executing` | `streaming` 或 `open` |
| 正常完成 | `completed` | `succeeded / skipped` | `tasks.status=done`，`workflow_state.status=completed`，`executions.status=succeeded` | `completed` |
| 执行失败 | `failed` | `failed / dependency_failed / policy_blocked / aborted` | `tasks.status=failed`，`workflow_state.status=failed`，`executions.status=failed|cancelled` | `failed` |
| 用户取消或平台中止 | `aborted` | `cancelled / aborted` | `tasks.status=cancelled`，`workflow_state.status=cancelled`，`executions.status=cancelled` | `cancelled` |

规则：

- `sessions.status` 可以滞后收口，但不得提前宣布任务完成。
- 所有投影终态都必须由 `HarnessRun.status` / `NodeRun.status` 派生；若投影与 truth 冲突，以 truth 为准并触发重建。
- `approvals.status` 变为批准/拒绝/超时后，必须通过 `RuntimeStateMachine.transition(command)` 驱动 `HarnessRun` / `NodeRun` 继续推进或终止，而不是直接改 `tasks.status`。
- `HarnessRun.status` 进入 `completed / failed / aborted` 后默认不得直接回到活跃态；若确需恢复，必须创建新的 `NodeAttempt`、追加 `GraphPatch` 或新建 `HarnessRun`，不得重写旧终态。

### 4.1 终态与恢复边界

- `completed` 是 `HarnessRun` 成功终态，不允许被普通恢复链回退成活跃态。
- `failed` / `aborted` 是 `HarnessRun` 终态，只有在明确创建新 attempt、保留旧证据并满足恢复策略时，才允许派生新的活跃执行链。
- `cancelled` / `aborted` 的 `NodeRun` 不允许后台继续推进旧节点。
- `awaiting_hitl` 不是终态，恢复后必须回到活跃执行链，而不是跳过审批来源事实。

### 4.2 活跃执行所有权

- 同一 `HarnessRun` 在任一时刻最多只允许一个活跃 `NodeRun` lease 持有某个节点的推进权。
- 若存在新的恢复 attempt，则旧 attempt 必须先进入可解释的 `failed / cancelled / aborted / superseded` 收口状态。
- inspect、recovery 和 operator 工具必须能看见当前 `HarnessRun` 的活跃 `NodeRun` / `NodeAttempt` 所有权。

## 5. 统一状态变更入口

实现层必须收敛为统一入口，而不是散写：

- `RuntimeStateMachine.transition(command)`
- `projectHarnessRunToTaskView(...)`
- `projectNodeRunToWorkflowView(...)`
- `projectNodeRunToExecutionView(...)`
- `transitionSessionStatus(...)`
- `transitionApprovalStatus(...)`

规则：

- 任一状态变更必须带 `reason_code`、`trace_id` 和 `updated_at`。
- truth 状态只能通过 `RuntimeStateMachine.transition(command)` 改写；任务、工作流和 execution 表若需要跨表协同推进，应作为同事务投影更新。
- 不允许调用方直接散写 SQL 绕过 truth transition 层。
- 具体 service 入口、事务顺序和幂等要求以下钻文档 `transition_service_contract.md` 为准。

## 6. 恢复语义

- 恢复逻辑首先以 `HarnessRun.status` 判断运行是否仍处于活跃生命周期。
- `NodeRun.status`、`attempt lineage` 与 `NodeAttemptReceipt` 用于确定恢复位置。
- `tasks.status`、`workflow_state.status` 与 `executions.status` 仅用于辅助定位查询入口，不得作为恢复真相来源。
- `sessions.status` 只用于恢复渠道交互，不得作为恢复业务事实的唯一依据。
- 恢复不得通过直接重写 `tasks.status` 跳过 `HarnessRun` / `NodeRun` / `NodeAttemptReceipt` 的事实检查。

对 OAPEFLIR Phase 1-4 范围，额外要求：

- `feedback_signals.status` 至少区分 `received / classified / consumed / archived`。
- `learning_objects.promotion_status` 至少区分 `draft / validated / promoted / decayed / archived`。
- `improvement_candidates.status` 至少区分 `proposed / evaluating / accepted / rejected / deployed / rolled_back`。
- `release_records.status` 至少区分 `pending / running / completed / failed / rolled_back`。
- `tasks.status` 不应直接替代上述演化实体状态；它们分别回答“主任务是否完成”“学习是否可信”“改进是否获批”“release 是否放行”四个不同问题。

## 7. 关联文档

- `runtime_state_machine_contract.md`
- `task_and_workflow_contract.md`
- `transition_service_contract.md`
- `storage_schema_contract.md`
- `gateway_streaming_contract.md`

## 8. 收口结论

状态系统的核心不是“有多少枚举”，而是让不同层的状态各司其职，并且始终知道谁才是主状态。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-12: 本文原先把 `tasks.status / workflow_state.status / executions.status` 写成 authoritative 状态，根因是早期单机任务表驱动实现直接被抄进了总状态矩阵，后续 `HarnessRun / NodeRun` 成为 truth 后正文没有一起迁移。修复：正文现把 `HarnessRun.status` / `NodeRun.status` 定义为唯一运行真相来源，任务/工作流/execution 仅保留为投影或迁移输入。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
