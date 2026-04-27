# Runtime State Machine Contract

> **v4.3 兼容说明**：本文件保留为历史 OAPEFLIR / task / workflow 状态机说明。v4.3 状态推进权威以 [ADR-110](../adr/110-runtime-state-machine-authority.md)、[harness-run-contract.md](./harness-run-contract.md)、[node-run-attempt-receipt-contract.md](./node-run-attempt-receipt-contract.md)、[side-effect-reconciliation-contract.md](./side-effect-reconciliation-contract.md) 和 [budget-ledger-contract.md](./budget-ledger-contract.md) 为准；新模块必须通过 `RuntimeStateMachine.transition(command)` 推进 truth。

> **OAPEFLIR 相关**：本 contract 定义 OAPEFLIR 8 阶段状态机，对应 ADR-016。
> **更新日期**：2026-04-17

## 1. 范围

本 contract 定义 Phase 1a 必须稳定的任务、工作流、审批和执行状态机，以及允许的状态跃迁。

补充说明：

- 本文件回答”状态可以如何变化”。
- `runtime_execution_contract.md` 回答”runtime run 如何被检查、执行、重试和终止”。

## 1A. OAPEFLIR 顶层阶段状态机

Phase 1-4 的 workflow 顶层阶段按以下顺序推进：

```text
observe -> assess -> plan -> execute -> feedback -> learn -> improve -> release
```

循环语义：

- `release` 完成后，可进入下一轮 `observe`，并把 `loop_iteration + 1`。
- 若任务已经满足退出条件，可直接进入 terminal，不要求开启下一轮。

`OapeflirStage` 枚举：

- `observe`
- `assess`
- `plan`
- `execute`
- `feedback`
- `learn`
- `improve`
- `release`

`StageStatus` 枚举：

- `pending`
- `active`
- `completed`
- `skipped`
- `failed`
- `timed_out`

约束：

- `stage` 的 canonical 写法必须是上述枚举，不得使用 `perceive`、`analyze`、`deploy` 等同义词替代。
- `skipped` 只能用于明确受控跳过，不得用作失败降级别名。
- `release` 是当前闭环阶段，不等同于一定发生真实外部发布；在当前 phase1-4 authoritative 边界内，可仅推进到 `off / suggest / shadow`。

## 2. TaskStatus

```text
queued -> pending -> in_progress -> done
                    -> awaiting_decision -> in_progress
                    -> failed
                    -> cancelled
```

枚举：

- `queued`
- `pending`
- `in_progress`
- `awaiting_decision`
- `done`
- `failed`
- `cancelled`

约束：

- 新任务创建后默认进入 `queued` 或 `pending`，不能直接写入 `in_progress` 而没有创建记录。
- `awaiting_decision` 只用于等待外部审批/人工输入，不替代普通 pause。
- `done`、`failed`、`cancelled` 为终态，终态后只能通过新建恢复任务进入新生命周期。

## 3. WorkflowStatus

枚举：

- `running`
- `paused`
- `completed`
- `failed`
- `resuming`
- `cancelling`
- `cancelled`

允许跃迁：

- `running -> paused`
- `running -> completed`
- `running -> failed`
- `running -> cancelling`
- `paused -> resuming`
- `resuming -> running`
- `resuming -> failed`
- `cancelling -> cancelled`

约束：

- `completed` 与 `failed` 为终态。
- `paused` 必须伴随可恢复原因，例如审批等待、人工输入等待、外部依赖等待。
- `resuming` 仅作为短暂中间态，用于恢复前的状态修复和 preflight 检查。
- `WorkflowStatus` 表示 workflow 总体生命周期；具体闭环阶段进度由 `current_stage + StageStatus` 表达，不得把二者混成一个字段。

## 4. SessionStatus

会话状态只描述“渠道交互状态”，不是任务真相源。

枚举：

- `open`
- `streaming`
- `awaiting_user`
- `paused`
- `completed`
- `failed`
- `cancelled`

允许跃迁：

- `open -> streaming`
- `open -> awaiting_user`
- `streaming -> awaiting_user`
- `streaming -> completed`
- `streaming -> failed`
- `streaming -> cancelled`
- `awaiting_user -> streaming`
- `awaiting_user -> cancelled`
- `paused -> streaming`
- `paused -> cancelled`

约束：

- `SessionStatus` 只能表达渠道侧交互，不得替代任务或 workflow 的 authoritative 状态。
- `awaiting_user` 只表示会话层等待用户响应，不能直接推出任务失败或完成。
- `completed`、`failed`、`cancelled` 为会话终态。

## 5. ApprovalStatus

枚举：

- `requested`
- `approved`
- `rejected`
- `expired`
- `superseded`

允许跃迁：

- `requested -> approved`
- `requested -> rejected`
- `requested -> expired`
- `requested -> superseded`

约束：

- 同一个 `approval_id` 只能有一个终态。
- `approved` / `rejected` 决策只允许生效一次。
- 新请求替代旧请求时，旧请求必须写成 `superseded`，不能静默覆盖。

## 6. ExecutionStatus

> 注意：本枚举在早期文档中曾称 `AgentRunStatus`，现统一为 `ExecutionStatus`，与 `executions.status` 字段和 `transition_service_contract.md` 的入口保持一致。

枚举：

- `created`
- `prechecking`
- `executing`
- `blocked`
- `succeeded`
- `failed`
- `cancelled`
- `superseded`

允许跃迁：

- `created -> prechecking`
- `created -> cancelled`
- `created -> failed`
- `prechecking -> executing`
- `prechecking -> blocked`
- `prechecking -> cancelled`
- `prechecking -> failed`
- `executing -> blocked`
- `executing -> succeeded`
- `executing -> failed`
- `executing -> cancelled`
- `blocked -> prechecking`
- `blocked -> executing`
- `blocked -> cancelled`
- `blocked -> failed`
- `blocked -> superseded`

约束：

- `prechecking` 是正式运行态的一部分，不是可忽略的临时字段。
- `blocked` 必须伴随明确原因，例如 `approval_required`、`dependency_unavailable`。
- `superseded` 表示该 execution 被新的 attempt 或 handover 取代，旧 execution 不再推进。
- 重试语义不再由独立状态表达，而通过创建新的 execution attempt（递增 `attempt` 字段）实现，旧 execution 进入 `failed` 或 `superseded`。
- `succeeded`、`failed`、`cancelled`、`superseded` 为终态。

## 7. 跨状态一致性约束

- 任务进入 `awaiting_decision` 时，相关 workflow 应处于 `paused` 或可证明的等待态。
- workflow `completed` 时，任务必须在短事务或同一恢复逻辑内进入 `done`。
- approval `approved` 不自动等于任务成功，只表示可继续执行。
- 任一终态必须记录时间戳、触发原因和 trace id。
- run 若进入 `blocked` 且原因是审批等待，任务与 workflow 状态必须同步进入等待语义。
- session 进入 `awaiting_user` 时，任务应处于 `awaiting_decision`、workflow 处于 `paused`，或有明确的渠道侧等待理由。
- session 的 `completed / failed / cancelled` 应跟随任务终态收口，但 session 终态不得反向决定任务终态。
- 当 `current_stage=feedback|learn|improve|release` 时，workflow 仍可保持 `running`；不得因为 execute 已结束就提前把 workflow 标为 `completed`。
- stage 从 `release` 回到下一轮 `observe` 时，workflow 仍保持同一生命周期，只递增 `loop_iteration`。

## 8. 失败语义

- 非终态恢复只能通过显式状态迁移完成，禁止直接覆盖字段修复。
- `failed` 需区分可重试与不可重试原因码。
- `cancelled` 必须保留取消发起者和取消原因。
- precheck 失败不得伪装成执行成功后失败，必须保留真实失败阶段。

## 9. 补充规则

- 多子任务聚合时，若至少一个成功且至少一个失败，任务总体可进入 `partial_success`，但必须附带聚合摘要与未完成原因。
- 事件总线中的状态快照压缩只允许压缩可重建的中间态，不得压缩终态或关键审计节点。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-1: ExecutionStatus 用 running/paused/cancelled/completed/failed 5态，架构 NodeRun 用 pending/ready/running/blocked/succeeded/failed/skipped/cancelled/timed_out 9态；WorkflowStatus 6态 vs HarnessRun 13态。修复：该语义收敛到 v4.3 canonical contract；旧字段、旧状态、旧 DTO 或旧术语仅允许作为 legacy/deprecated/projection/migration input，不得作为新实现入口。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
