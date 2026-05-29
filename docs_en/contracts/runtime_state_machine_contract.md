# Runtime State Machine Contract

> **v4.3 兼容Description**：本文件保留为历史 task / workflow / OAPEFLIR 视图StatusDescription。v4.3 Status推进权威以 [ADR-110](../adr/110-runtime-state-machine-authority.md)、[harness-run-contract.md](./harness-run-contract.md)、[node-run-attempt-receipt-contract.md](./node-run-attempt-receipt-contract.md)、[side-effect-reconciliation-contract.md](./side-effect-reconciliation-contract.md) 和 [budget-ledger-contract.md](./budget-ledger-contract.md) 为准；新模块必须via `RuntimeStateMachine.transition(command)` 推进 truth。

> **OAPEFLIR 相关**：本文件中的 OAPEFLIR 段落只table达 stage projection 顺序，不defines任何 truth-grade run / node Status机。
> **更新日期**：2026-04-17

## 1. 范围

本 contract record Ring 1 之后仍需兼容的历史任务、workflow vs OAPEFLIR 投影视图Status，以及它们vs v4.3 truth Status机之间的映射约束。

补充Description：

- 本文件回答”Status可以如何变化”。
- `runtime_execution_contract.md` 回答”runtime run 如何被检查、执lines、重试和终止”。

## 1A. OAPEFLIR 顶层阶段投影视图

OAPEFLIR 的八阶段只used for解释闭环语义视图，推荐按以下顺序展示：

```text
observe -> assess -> plan -> execute -> feedback -> learn -> improve -> release
```

循环语义：

- `release` 完成后，可进入下一轮 `observe`，并把 `loop_iteration + 1`。
- 若任务已via满足退出条件，可directly进入 terminal，不要求开启下一轮。

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

- `stage` 的 canonical 写法必须is上述枚举，不得uses `perceive`、`analyze`、`deploy` 等同义词替代。
- `skipped` 只能used for明确受控跳过，不得用作failed降级别名。
- `release` is当前闭环阶段，不等同于一定发生真实外部发布；真正发布动作仍由 HarnessRuntime / Release Gate 受控推进。

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

- 新任务创建后defaults to进入 `queued` 或 `pending`，不能directlywrites `in_progress` 而没有创建record。
- `awaiting_decision` 只used for等待外部审批/人工输入，不替代普通 pause。
- `done`、`failed`、`cancelled` 为终态，终态后只能via新建恢复任务进入新生命cycle。

## 3. HarnessRunStatus（v4.3 canonical run status, 14态）

> 注意：本文档原用 `WorkflowStatus` 作为 run Status枚举。v4.3 canonical run Status以 `HarnessRun.status`（14态）为准。`WorkflowStatus` only保留为旧 workflow 投影视图，不应再作为 authoritative run Status。

`HarnessRunStatus` 枚举（14态）：

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
- `cancelled`
- `aborted`

终态：`completed`、`failed`、`cancelled`、`aborted`。终态不可迁出。

允许跃迁：

- `created -> admitted`
- `created -> failed`
- `created -> cancelled`
- `created -> aborted`
- `admitted -> planning`
- `admitted -> ready`
- `admitted -> failed`
- `admitted -> cancelled`
- `admitted -> aborted`
- `planning -> ready`
- `planning -> replanning`
- `planning -> failed`
- `planning -> cancelled`
- `planning -> aborted`
- `ready -> running`
- `ready -> paused`
- `ready -> failed`
- `ready -> cancelled`
- `ready -> aborted`
- `running -> pausing`
- `running -> paused`
- `running -> replanning`
- `running -> compensating`
- `running -> completed`
- `running -> failed`
- `running -> cancelled`
- `running -> aborted`
- `pausing -> paused`
- `pausing -> failed`
- `pausing -> cancelled`
- `pausing -> aborted`
- `paused -> resuming`
- `paused -> replanning`
- `paused -> failed`
- `paused -> cancelled`
- `paused -> aborted`
- `resuming -> running`
- `resuming -> failed`
- `resuming -> cancelled`
- `resuming -> aborted`
- `replanning -> ready`
- `replanning -> running`
- `replanning -> failed`
- `replanning -> cancelled`
- `replanning -> aborted`
- `compensating -> completed`
- `compensating -> failed`
- `compensating -> cancelled`
- `compensating -> aborted`

约束：

- `paused` 必须伴随可恢复原因，例如审批等待、人工输入等待、外部relies on等待。
- `resuming` only作为短暂中间态，used for恢复前的Status修复和 preflight 检查。
- `replanning` / `compensating` 为 OAPEFLIR 期间的活跃运lines态，不is独立终态。
- `HarnessRunStatus` is v4.3 truth run Status；旧 `WorkflowStatus` / `TaskStatus` 只作为 legacy projection。
- 具体闭环阶段进度由 `current_stage + StageStatus` table达，不得把二者混成一个字段。

### 3A. Legacy WorkflowStatus（deprecated projection）

以下枚举only保留为历史 workflow 读模型投影，不应used for新实现入口：

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
- `completing`
- `completed`
- `failed`
- `cancelling`
- `cancelled`
- `timed_out`
- `aborted`

规则：

- `completing / cancelling / timed_out` is旧 workflow 特有Status，在 v4.3 HarnessRun 中don't exist对应Status。
- 所有 legacy Statusonly作为 read model / migration input，不得作为新实现的 authoritative Status。

## 4. SessionStatus

会话Status只Description“渠道交互Status”，不is任务真相源。

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

- `SessionStatus` 只能table达渠道侧交互，不得替代任务或 workflow 的 authoritative Status。
- `awaiting_user` 只table示会话层等待userresponse，不能directly推出任务failed或完成。
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
- `approved` / `rejected` Decision只允许生效一iterations。
- 新request替代旧request时，旧request必须写成 `superseded`，不能静默覆盖。

## 6. NodeRunStatus（canonical execution truth per v4.3）

> 注意：本文档原先uses `ExecutionStatus` 作为执linesStatus枚举。v4.3 canonical 执linesStatus以 `NodeRun.status`（14态）为准。`ExecutionStatus` only保留为旧 `executions` 投影视图vs迁移Description；新实现不得再把它作为权威执linesStatus枚举。

`NodeRunStatus` 枚举（14态）：

- `created`
- `blocked`
- `ready`
- `queued`
- `leased`
- `running`
- `retry_wait`
- `awaiting_hitl`
- `reconciling`
- `succeeded`
- `failed`
- `skipped`
- `cancelled`
- `aborted`

终态：`succeeded`、`failed`、`skipped`、`cancelled`、`aborted`。

允许跃迁：

- `created -> queued`
- `queued -> ready`
- `ready -> leased`
- `leased -> running`
- `running -> retry_wait`
- `running -> awaiting_hitl`
- `running -> reconciling`
- `running -> succeeded`
- `running -> failed`
- `running -> skipped`
- `running -> cancelled`
- `running -> aborted`
- `retry_wait -> ready`
- `retry_wait -> failed`
- `awaiting_hitl -> running`
- `awaiting_hitl -> failed`
- `reconciling -> succeeded`
- `reconciling -> failed`
- `blocked -> ready`（relies on满足时）
- `skipped -> aborted`
- `cancelled -> aborted`

约束：

- `retry_wait` is正式运lines态的一部分，used for重试等待期，必须record `wakeAt`、`retryPolicyRef`、`attemptId` 和 backoff reason。
- `awaiting_hitl` 必须伴随明确原因，例如 `approval_required`、`human_input_required`。
- `reconciling` used for协调 side effect 和补偿逻辑。
- `blocked` table示因上游relies on未满足而不可执lines，不得as `queued` 或 `ready`。
- `queued` table示已进入调度队列等待调度器挑选，区别于 `blocked`（relies on未满足）。
- 重试语义via创建新的 `NodeAttempt`（递增 `attemptNo` 字段）实现，不得更新旧 `NodeRun` Status。
- `succeeded`、`failed`、`skipped`、`cancelled`、`aborted` 为终态，终态不可迁出。
- v4.3 truth 执linesStatus以 `NodeRunStatus` 和 `NodeAttemptReceipt` append-only 回执为准，旧 `ExecutionStatus` 不得反向驱动运lines时合法性判断。

## 7. 跨Status一致性约束

- 任务进入 `awaiting_decision` 时，相关 workflow 应occurrences于 `paused` 或可证明的等待态。
- workflow `completed` 时，任务必须在短事务或同一恢复逻辑内进入 `done`。
- approval `approved` 不自动等于任务success，只table示可继续执lines。
- 任一终态必须recordtime戳、触发原因和 trace id。
- run 若进入 `blocked` 且原因is审批等待，任务vs workflow Status必须synchronous进入等待语义。
- session 进入 `awaiting_user` 时，任务应occurrences于 `awaiting_decision`、workflow occurrences于 `paused`，或有明确的渠道侧等待理由。
- session 的 `completed / failed / cancelled` 应跟随任务终态收口，但 session 终态不得反向决定任务终态。
- 当 `current_stage=feedback|learn|improve|release` 时，workflow 仍可保持 `running`；不得因为 execute 已结束就提前把 workflow 标为 `completed`。
- stage 从 `release` 回到下一轮 `observe` 时，workflow 仍保持同一生命cycle，只递增 `loop_iteration`。

## 8. failed语义

- 非终态恢复只能via显式Status迁移完成，禁止directly覆盖字段修复。
- `failed` 需区分可重试vs不可重试原因码。
- `cancelled` 必须保留取消发起者和取消原因。
- precheck failed不得as执linessuccess后failed，必须保留真实failed阶段。

## 9. 补充规则

- 多子任务聚合时，若至少一个success且至少一个failed，任务总体可进入 `partial_success`，但必须附带聚合摘要vs未完成原因。
- 事件总线中的Status快照压缩只允许压缩可重建的中间态，不得压缩终态或关键审计节点。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-1: 原 ExecutionStatus 用 13态但缺 `blocked/queued`，且以旧名称 `ExecutionStatus` 替代 `NodeRun.status`；WorkflowStatus 17态（含 `completing/cancelling/timed_out`）vs HarnessRun 13态。修复：§6 重命名 ExecutionStatus → NodeRunStatus，补齐 14 态（`created/blocked/ready/queued/leased/running/retry_wait/awaiting_hitl/reconciling/succeeded/failed/skipped/cancelled/aborted`）；§3 明确 HarnessRunStatus 为 v4.3 canonical 13态 run Status，原 WorkflowStatus 降为 legacy projection。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
