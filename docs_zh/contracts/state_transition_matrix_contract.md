# State Transition Matrix Contract

> **OAPEFLIR 相关**：本 contract 定义 OAPEFLIR 8 阶段状态转换矩阵，对应 ADR-016。
> **更新日期**：2026-04-17

## 1. 范围

本 contract 收口任务、工作流、会话、审批和执行 run 的统一状态视图。

它补充 `runtime_state_machine_contract.md`，回答两个问题：

- 哪个状态是唯一用户主状态。
- 多套状态机之间如何映射、谁能驱动谁。

## 2. 核心原则

- `tasks.status` 是唯一用户主状态。
- `workflow_state.status` 只表达执行态，不直接充当用户最终状态。
- `sessions.status` 只表达渠道交互态。
- `approvals.status` 只表达审批对象状态。
- `executions.status` 只表达 runtime run 生命周期。

## 3. 主状态来源

| 领域 | authoritative 状态 | 作用 |
| --- | --- | --- |
| 用户任务 | `tasks.status` | 用户主状态、列表与查询主入口 |
| 工作流 | `workflow_state.status` | division 内工作流推进 |
| 会话 | `sessions.status` | 渠道交互进度 |
| 审批 | `approvals.status` | 人工决策进度 |
| 执行 | `executions.status` | runtime 执行阶段 |

对 OAPEFLIR 闭环新增的演化实体，authoritative 状态建议至少拆分为：

| 领域 | authoritative 状态 | 作用 |
| --- | --- | --- |
| 学习对象 | `learning_objects.promotion_status` | 证据校验、推广边界 |
| 改进候选 | `improvement_candidates.status` | Improve 评估与审批边界 |
| rollout | `rollout_records.status` | Release 阶段推进与阻断 |

## 4. 统一映射表

| 触发条件 | `tasks.status` | `workflow_state.status` | `sessions.status` | `executions.status` |
| --- | --- | --- | --- | --- |
| 任务创建未开始 | `queued` / `pending` | 无 | `open` | 无 |
| 工作流开始执行 | `in_progress` | `running` | `streaming` 或 `open` | `created / prechecking / executing` |
| 等待审批/人工输入 | `awaiting_decision` | `paused` | `awaiting_user` 或 `paused` | `blocked` |
| 恢复中 | `in_progress` | `resuming` | `streaming` 或 `open` | `prechecking / executing` |
| 正常完成 | `done` | `completed` | `completed` | `succeeded` |
| 执行失败 | `failed` | `failed` | `failed` | `failed` 或 `cancelled` |
| 用户取消 | `cancelled` | `cancelling / cancelled` | `cancelled` | `cancelled` |

规则：

- `sessions.status` 可以滞后收口，但不得提前宣布任务完成。
- `workflow_state.status=completed` 时，`tasks.status` 必须在同事务或同一恢复逻辑内进入 `done`。
- `executions.status=blocked` 且原因为审批时，`tasks.status` 必须是 `awaiting_decision`。
- `tasks.status` 进入 `done / failed / cancelled` 后，默认不得直接回到活跃态；若确需恢复，必须以新的 execution attempt 或显式修复动作承接，而不是重写旧终态。

### 4.1 终态与恢复边界

- `done` 是业务成功终态，不允许被普通恢复链回退成 `in_progress`。
- `failed` 是失败终态，只有在明确创建新 attempt、并保留失败证据时，才允许进入新的活跃执行。
- `cancelled` 是取消终态，不允许后台继续推进旧 step。
- `awaiting_decision` 不是终态，恢复后必须回到活跃执行链，而不是跳过审批来源事实。

### 4.2 活跃执行所有权

- 同一 `task` 在单机 Stable Core 阶段，任一时刻最多只允许一个活跃 `execution` 持有推进权。
- 若存在新的恢复 execution，则旧 execution 必须先进入可解释的 `cancelled / failed / dead-letter / superseded` 收口状态。
- inspect、recovery 和 operator 工具必须能看见当前 task 的活跃 execution 所有权。

## 5. 统一状态变更入口

实现层必须收敛为统一入口，而不是散写：

- `transitionTaskStatus(...)`
- `transitionWorkflowStatus(...)`
- `transitionSessionStatus(...)`
- `transitionApprovalStatus(...)`
- `transitionExecutionStatus(...)`
- `transitionBlockedForApproval(...)`
- `transitionTaskTerminalState(...)`

规则：

- 任一状态变更必须带 `reason_code`、`trace_id` 和 `updated_at`。
- 需要跨表协同推进时，优先通过聚合型 transition 函数完成。
- 不允许调用方直接散写 SQL 绕过 transition 层。
- 具体 service 入口、事务顺序和幂等要求以下钻文档 `transition_service_contract.md` 为准。

## 6. 恢复语义

- 恢复逻辑首先以 `tasks.status` 判断是否仍处于活跃生命周期。
- `workflow_state.status` 与 `executions.status` 用于确定恢复位置。
- `sessions.status` 只用于恢复渠道交互，不得作为恢复业务事实的唯一依据。
- 恢复不得通过直接重写 `tasks.status` 跳过 `workflow_state` 与 `executions` 的事实检查。

对 OAPEFLIR Phase 1-4 范围，额外要求：

- `feedback_signals.status` 至少区分 `received / classified / consumed / archived`。
- `learning_objects.promotion_status` 至少区分 `draft / validated / promoted / decayed / archived`。
- `improvement_candidates.status` 至少区分 `proposed / evaluating / accepted / rejected / deployed / rolled_back`。
- `rollout_records.status` 至少区分 `pending / running / completed / failed / rolled_back`。
- `tasks.status` 不应直接替代上述演化实体状态；它们分别回答“主任务是否完成”“学习是否可信”“改进是否获批”“release 是否放行”四个不同问题。

## 7. 关联文档

- `runtime_state_machine_contract.md`
- `task_and_workflow_contract.md`
- `transition_service_contract.md`
- `storage_schema_contract.md`
- `gateway_streaming_contract.md`

## 8. 收口结论

状态系统的核心不是“有多少枚举”，而是让不同层的状态各司其职，并且始终知道谁才是主状态。
