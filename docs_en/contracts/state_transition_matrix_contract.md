# State Transition Matrix Contract

> **OAPEFLIR 相关**：本 contract defines OAPEFLIR 8 阶段Status转换矩阵，对应 ADR-016。
> **更新日期**：2026-04-17

## 1. 范围

本 contract 收口任务、工作流、会话、审批和执lines run 的统一Status视图。

它补充 `runtime_state_machine_contract.md`，回答两个Issue：

- 哪组Statusis唯一运lines真相来源。
- 多套Status机之间如何映射、谁能驱动谁。

## 2. 核心principle

- `HarnessRun.status` is运lines真相来源，所有任务级“isno还在跑、isnocompleted、isnofailed”判断都必须从它派生。
- `NodeRun.status` is节点执lines真相来源，负责table达 ready / running / awaiting_hitl / retry_wait / terminal 等执lines态。
- `tasks.status`、`workflow_state.status`、`executions.status` only允许作为读模型、兼容投影或迁移输入，不得反向驱动 truth transition。
- `sessions.status` 只table达渠道交互态。
- `approvals.status` 只table达审批对象Status；审批结果viaStatus机命令Impact `HarnessRun` / `NodeRun`，而不isdirectly改写投影table终态。

## 3. 主Status来源

| 领域 | authoritative Status | 作用 |
|---|-------|--------|
| 运lines主链 | `HarnessRun.status` | 唯一运lines级真相来源，决定任务isno活跃、暂停、完成、failed或中止 |
| 节点执lines | `NodeRun.status` | 唯一节点级真相来源，决定租约、重试、HITL 等执lines推进 |
| 审批对象 | `approvals.status` | 审批本身isno待决、批准、拒绝、timeout |
| 会话 | `sessions.status` | 渠道交互进度 |
| 任务/工作流/execution 读模型 | `tasks.status` / `workflow_state.status` / `executions.status` | 查询投影、兼容输出、历史迁移输入；不得单独defines truth |

对 OAPEFLIR 闭环新增的演化实体，authoritative StatusRecommendation至少拆分为：

| 领域 | authoritative Status | 作用 |
|---|-------|--------|
| 学习对象 | `learning_objects.promotion_status` | 证据校验、推广边界 |
| 改进候选 | `improvement_candidates.status` | Improve 评估vs审批边界 |
| release | `release_records.status` | Release 阶段推进vs阻断 |

## 4. 统一映射table

| 触发条件 | `HarnessRun.status` | `NodeRun.status` | 常见投影 | `sessions.status` |
|---|-------|--------| --- | --- |
| request已接纳但尚未生成 ready 节点 | `created / admitted / planning` | `created` | `tasks.status=queued|pending`，`workflow_state.status=pending`，`executions.status=created` | `open` |
| 图已就绪并进入执lines | `ready / running` | `ready / leased / running` | `tasks.status=in_progress`，`workflow_state.status=running`，`executions.status=executing` | `streaming` 或 `open` |
| 等待审批/人工输入 | `running / paused` | `awaiting_hitl / blocked` | `tasks.status=awaiting_decision`，`workflow_state.status=paused`，`executions.status=blocked` | `awaiting_user` 或 `paused` |
| 重试等待或恢复中 | `resuming / replanning / running` | `retry_wait / reconciling / ready / running` | `tasks.status=in_progress`，`workflow_state.status=resuming`，`executions.status=prechecking|executing` | `streaming` 或 `open` |
| 正常完成 | `completed` | `succeeded / skipped` | `tasks.status=done`，`workflow_state.status=completed`，`executions.status=succeeded` | `completed` |
| 执linesfailed | `failed` | `failed / dependency_failed / policy_blocked / aborted` | `tasks.status=failed`，`workflow_state.status=failed`，`executions.status=failed|cancelled` | `failed` |
| user取消或平台中止 | `aborted` | `cancelled / aborted` | `tasks.status=cancelled`，`workflow_state.status=cancelled`，`executions.status=cancelled` | `cancelled` |

规则：

- `sessions.status` 可以滞后收口，但不得提前宣布任务完成。
- 所有投影终态都必须由 `HarnessRun.status` / `NodeRun.status` 派生；若投影vs truth conflicts，以 truth 为准并触发重建。
- `approvals.status` 变为批准/拒绝/timeout后，必须via `RuntimeStateMachine.transition(command)` 驱动 `HarnessRun` / `NodeRun` 继续推进或终止，而不isdirectly改 `tasks.status`。
- `HarnessRun.status` 进入 `completed / failed / aborted` 后defaults to不得directly回到活跃态；若确需恢复，必须创建新的 `NodeAttempt`、追加 `GraphPatch` 或新建 `HarnessRun`，不得重写旧终态。

### 4.1 终态vs恢复边界

- `completed` is `HarnessRun` success终态，不允许被普通恢复链回退成活跃态。
- `failed` / `aborted` is `HarnessRun` 终态，只有在明确创建新 attempt、保留旧证据并满足恢复策略时，才允许派生新的活跃执lines链。
- `cancelled` / `aborted` 的 `NodeRun` 不允许后台继续推进旧节点。
- `awaiting_hitl` 不is终态，恢复后必须回到活跃执lines链，而不is跳过审批来源事实。

### 4.2 活跃执lines所有权

- 同一 `HarnessRun` 在任一时刻最多只允许一个活跃 `NodeRun` lease 持有某个节点的推进权。
- 若存在新的恢复 attempt，则旧 attempt 必须先进入可解释的 `failed / cancelled / aborted / superseded` 收口Status。
- inspect、recovery 和 operator 工具必须能看见当前 `HarnessRun` 的活跃 `NodeRun` / `NodeAttempt` 所有权。

## 5. 统一Status变更入口

实现层必须收敛为统一入口，而不is散写：

- `RuntimeStateMachine.transition(command)`
- `projectHarnessRunToTaskView(...)`
- `projectNodeRunToWorkflowView(...)`
- `projectNodeRunToExecutionView(...)`
- `transitionSessionStatus(...)`
- `transitionApprovalStatus(...)`

规则：

- 任一Status变更必须带 `reason_code`、`trace_id` 和 `updated_at`。
- truth Status只能via `RuntimeStateMachine.transition(command)` 改写；任务、工作流和 execution table若需要跨table协同推进，应作为同事务投影更新。
- 不允许call方directly散写 SQL bypassing truth transition 层。
- 具体 service 入口、事务顺序和幂等要求以下钻文档 `transition_service_contract.md` 为准。

## 6. 恢复语义

- 恢复逻辑首先以 `HarnessRun.status` 判断运linesisno仍occurrences于活跃生命cycle。
- `NodeRun.status`、`attempt lineage` vs `NodeAttemptReceipt` used for确定恢复位置。
- `tasks.status`、`workflow_state.status` vs `executions.status` onlyused for辅助定位查询入口，不得作为恢复真相来源。
- `sessions.status` 只used for恢复渠道交互，不得作为恢复业务事实的唯一依据。
- 恢复不得viadirectly重写 `tasks.status` 跳过 `HarnessRun` / `NodeRun` / `NodeAttemptReceipt` 的事实检查。

对 OAPEFLIR Phase 1-4 范围，额外要求：

- `feedback_signals.status` 至少区分 `received / classified / consumed / archived`。
- `learning_objects.promotion_status` 至少区分 `draft / validated / promoted / decayed / archived`。
- `improvement_candidates.status` 至少区分 `proposed / evaluating / accepted / rejected / deployed / rolled_back`。
- `release_records.status` 至少区分 `pending / running / completed / failed / rolled_back`。
- `tasks.status` 不应directly替代上述演化实体Status；它们分别回答“主任务isno完成”“学习isno可信”“改进isno获批”“release isno放lines”四个不同Issue。

## 7. 关联文档

- `runtime_state_machine_contract.md`
- `task_and_workflow_contract.md`
- `transition_service_contract.md`
- `storage_schema_contract.md`
- `gateway_streaming_contract.md`

## 8. 收口Conclusion

Status系统的核心不is“有多少枚举”，而is让不同层的Status各司其职，并且始终知道谁才is主Status。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-12: 本文原先把 `tasks.status / workflow_state.status / executions.status` 写成 authoritative Status，Root cause: 早期单机任务table驱动实现directly被抄进了总Status矩阵，后续 `HarnessRun / NodeRun` 成为 truth 后正文没有一起迁移。修复：正文现把 `HarnessRun.status` / `NodeRun.status` defines为唯一运lines真相来源，任务/工作流/execution only保留为投影或迁移输入。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
