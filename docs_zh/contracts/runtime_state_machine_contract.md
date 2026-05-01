# Runtime State Machine Contract

> **v4.3 兼容说明**：本文件保留为历史 task / workflow / OAPEFLIR 视图状态说明。v4.3 状态推进权威以 [ADR-110](../adr/110-runtime-state-machine-authority.md)、[harness-run-contract.md](./harness-run-contract.md)、[node-run-attempt-receipt-contract.md](./node-run-attempt-receipt-contract.md)、[side-effect-reconciliation-contract.md](./side-effect-reconciliation-contract.md) 和 [budget-ledger-contract.md](./budget-ledger-contract.md) 为准；新模块必须通过 `RuntimeStateMachine.transition(command)` 推进 truth。

> **OAPEFLIR 相关**：本文件中的 OAPEFLIR 段落只表达 stage projection 顺序，不定义任何 truth-grade run / node 状态机。
> **更新日期**：2026-04-17

## 1. 范围

本 contract 记录 Ring 1 之后仍需兼容的历史任务、workflow 与 OAPEFLIR 投影视图状态，以及它们与 v4.3 truth 状态机之间的映射约束。

补充说明：

- 本文件回答”状态可以如何变化”。
- `runtime_execution_contract.md` 回答”runtime run 如何被检查、执行、重试和终止”。

## 1A. OAPEFLIR 顶层阶段投影视图

OAPEFLIR 的八阶段只用于解释闭环语义视图，推荐按以下顺序展示：

```text
observe -> assess -> plan -> execute -> feedback -> learn -> improve -> release
```

循环语义：

- `release` 完成后，可进入下一轮 `observe`，并把 `loop_iteration + 1`。
- 若任务已经满足退出条件，可直接进入 terminal，不要求开启下一轮。

`OapeflirStageView` 枚举（projection-only；旧文档若写 `OapeflirStage`，必须按 view alias 理解）：

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

- `stage` / `OapeflirStageView` 只允许作为视图字段，不得驱动 truth 状态迁移。
- `stage` 的 canonical 写法必须是上述枚举，不得使用 `perceive`、`analyze`、`deploy` 等同义词替代。
- `skipped` 只能用于明确受控跳过，不得用作失败降级别名。
- `release` 是当前闭环阶段，不等同于一定发生真实外部发布；真正发布动作仍由 HarnessRuntime / Release Gate 受控推进。

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

## 3. HarnessRunStatus（canonical run status）

> 注意：本节描述 canonical HarnessRun 状态机。v4.3 权威 run 状态以 `HarnessRunStatus` 为准，不再使用 `WorkflowStatus` 作为 truth-grade 枚举。`WorkflowStatus` 仅保留为 legacy projection 说明。

`HarnessRunStatus` 枚举（13态，对齐架构 §25.8）：

- `created` — HarnessRun 已创建，等待 admission
- `admitted` — 已通过准入检查
- `planning` — 处于 plan 阶段
- `ready` — PlanGraphBundle 已就绪，等待执行调度
- `running` — 正在执行 NodeRun
- `pausing` — 请求暂停中（中间态）
- `paused` — 已暂停
- `resuming` — 请求恢复中（中间态）
- `replanning` — 反馈触发重计划
- `compensating` — 处于补偿阶段
- `completed` — 成功完成（终态）
- `failed` — 执行失败（终态）
- `aborted` — 因异常被中止（终态）

允许跃迁（核心子集）：

- `created -> admitted`
- `admitted -> planning`
- `planning -> ready`
- `ready -> running`
- `running -> pausing / replanning / compensating / completed / failed / aborted`
- `pausing -> paused`
- `paused -> resuming`
- `resuming -> running`
- `replanning -> ready`
- `compensating -> completed / failed / aborted`

终态封闭规则：`completed / failed / aborted` 为终态，不得迁出。

约束：

- `pausing / resuming / replanning / compensating` 为中间态，只在状态迁移过程中短暂存在。
- `HarnessRunStatus` 只允许作为历史 run projection；v4.3 truth run 状态以 `HarnessRun.status` 为准。
- 具体闭环阶段进度由 `current_stage + StageStatus` 表达，不得把二者混成一个字段。

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

## 6. NodeRunStatus（canonical execution status）

> 注意：本节描述 canonical NodeRun 状态机。v4.3 权威执行状态以 `NodeRunStatus` 为准，不再使用 `ExecutionStatus` 作为 truth-grade 枚举。`ExecutionStatus` 仅保留为 legacy projection 说明。

`NodeRunStatus` 枚举（14态，对齐架构 §25.8）：

- `created` — NodeRun 已创建，等待调度选中
- `ready` — 被 Graph Scheduler 选中，等待获取 lease
- `leased` — 已获取 lease，等待 worker 开始执行
- `running` — worker 正在执行
- `retry_wait` — 执行失败进入重试等待态（非终态）
- `awaiting_hitl` — 等待人工审批或输入
- `reconciling` — 处于 side-effect 调和阶段
- `succeeded` — 成功完成（终态）
- `failed` — 执行失败（终态）
- `skipped` — 被上游级联跳过（终态）
- `cancelled` — 被取消（终态）
- `dependency_failed` — 前置依赖未满足（终态）
- `policy_blocked` — 策略门禁阻止执行（终态）
- `aborted` — 因异常被中止（终态）

允许跃迁（核心子集）：

- `created -> ready`
- `ready -> leased`
- `leased -> running`
- `running -> succeeded / failed / awaiting_hitl / retry_wait / reconciling`
- `awaiting_hitl -> running`（审批通过）
- `retry_wait -> ready`（重试到期）
- `reconciling -> succeeded / failed`

终态封闭规则：`succeeded / failed / skipped / cancelled / dependency_failed / policy_blocked / aborted` 为终态，不得迁出；任何修复必须以 redrive、compensation、GraphPatch 或 child run 追加方式表达。

约束：

- 重试不得新建 NodeRun，必须追加新 NodeAttempt。
- `retry_wait` 必须记录 wake condition（wakeAt / retryPolicyRef / attemptId / backoff reason）。
- 补偿完成不是 NodeRun 终态；补偿事实记录在 SideEffectRecord / CompensationRecord。
- v4.3 truth 执行状态以 `NodeRunStatus` 和 `NodeAttemptReceipt` append-only 回执为准，不得反向驱动运行时合法性判断。

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
