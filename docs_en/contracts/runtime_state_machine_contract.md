# Runtime State Machine Contract

> **v4.3 Compatibility Note**: This file is preserved as historical OAPEFLIR / task / workflow state machine documentation. v4.3 state advancement authority is based on [ADR-110](../adr/110-runtime-state-machine-authority.md), [harness-run-contract.md](./harness-run-contract.md), [node-run-attempt-receipt-contract.md](./node-run-attempt-receipt-contract.md), [side-effect-reconciliation-contract.md](./side-effect-reconciliation-contract.md), and [budget-ledger-contract.md](./budget-ledger-contract.md); new modules must advance truth through `RuntimeStateMachine.transition(command)`.

> **OAPEFLIR Related**: The OAPEFLIR paragraphs in this document only express stage projection order and do not define any truth-grade run/node state machine.
> **Last Updated**: 2026-04-17

## 1. Scope

This contract records historical task, workflow, and OAPEFLIR projection view states that remain compatible after Ring 1, and their mapping constraints with v4.3 truth state machines.

Supplementary notes:

- This document answers "how states can change".
- `runtime_execution_contract.md` answers "how runtime runs are checked, executed, retried, and terminated".

## 1A. OAPEFLIR Top-Level Stage Projection View

OAPEFLIR's eight stages are used only to explain closed-loop semantic views, recommended display order:

```text
observe -> assess -> plan -> execute -> feedback -> learn -> improve -> release
```

Loop semantics:

- After `release` completes, it can proceed to the next round of `observe`, with `loop_iteration + 1`.
- If the task already meets exit conditions, it can directly enter terminal without requiring a new round.

`OapeflirStageView` enum (projection-only; old documents writing `OapeflirStage` must be understood as view alias):

- `observe`
- `assess`
- `plan`
- `execute`
- `feedback`
- `learn`
- `improve`
- `release`

`StageStatus` enum:

- `pending`
- `active`
- `completed`
- `skipped`
- `failed`
- `timed_out`

Constraints:

- `stage` / `OapeflirStageView` are only allowed as view fields and must not drive truth state transitions.
- Canonical writing for `stage` must use the above enums; synonyms like `perceive`, `analyze`, `deploy` must not be used.
- `skipped` can only be used for explicit controlled skips and must not be used as a failure degradation alias.
- `release` is the current closed-loop stage, not equivalent to a real external release necessarily occurring; actual release actions are still controlled by HarnessRuntime / Release Gate.

## 2. TaskStatus

```text
queued -> pending -> in_progress -> done
                    -> awaiting_decision -> in_progress
                    -> failed
                    -> cancelled
```

Enum:

- `queued`
- `pending`
- `in_progress`
- `awaiting_decision`
- `done`
- `failed`
- `cancelled`

Constraints:

- After a new task is created, it enters `queued` or `pending` by default; it cannot directly write `in_progress` without a creation record.
- `awaiting_decision` is only used for waiting for external approval/human input and does not replace normal pause.
- `done`, `failed`, `cancelled` are terminal states; after terminal state, new lifecycle can only be entered by creating a new recovery task.

## 3. HarnessRunStatus (canonical run status)

> Note: This section describes the canonical HarnessRun state machine. v4.3 authoritative run status is based on `HarnessRunStatus` and no longer uses `WorkflowStatus` as a truth-grade enum. `WorkflowStatus` is retained only as legacy projection explanation.

`HarnessRunStatus` enum (13 states, aligned with architecture §25.8):

- `created` — HarnessRun created, waiting for admission
- `admitted` — admitted through准入检查
- `planning` — in plan phase
- `ready` — PlanGraphBundle ready, waiting for execution scheduling
- `running` — executing NodeRun
- `pausing` — pause requested (intermediate state)
- `paused` — paused
- `resuming` — resume requested (intermediate state)
- `replanning` — feedback triggered replanning
- `compensating` — in compensation phase
- `completed` — completed successfully (terminal state)
- `failed` — execution failed (terminal state)
- `aborted` — aborted due to exception (terminal state)

Allowed transitions (core subset):

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

Terminal state closure rules: `completed / failed / aborted` are terminal states and must not transition out.

Constraints:

- `pausing / resuming / replanning / compensating` are intermediate states and exist only briefly during state transitions.
- `HarnessRunStatus` is only allowed as historical run projection; v4.3 truth run status is based on `HarnessRun.status`.
- Specific closed-loop stage progress is expressed by `current_stage + StageStatus` and must not be mixed into one field.

## 4. SessionStatus

Session status only describes "channel interaction state", not a task truth source.

Enum:

- `open`
- `streaming`
- `awaiting_user`
- `paused`
- `completed`
- `failed`
- `cancelled`

Allowed transitions:

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

Constraints:

- `SessionStatus` can only express channel-side interaction and must not replace authoritative state of task or workflow.
- `awaiting_user` only indicates the session layer is waiting for user response and cannot directly conclude task failure or completion.
- `completed`, `failed`, `cancelled` are session terminal states.

## 5. ApprovalStatus

Enum:

- `requested`
- `approved`
- `rejected`
- `expired`
- `superseded`

Allowed transitions:

- `requested -> approved`
- `requested -> rejected`
- `requested -> expired`
- `requested -> superseded`

Constraints:

- Same `approval_id` can only have one terminal state.
- `approved` / `rejected` decision is only allowed to take effect once.
- When a new request supersedes an old request, the old request must be written as `superseded` and cannot be silently overwritten.

## 6. NodeRunStatus (canonical execution status)

> Note: This section describes the canonical NodeRun state machine. v4.3 authoritative execution status is based on `NodeRunStatus` and no longer uses `ExecutionStatus` as a truth-grade enum. `ExecutionStatus` is retained only as legacy projection explanation.

`NodeRunStatus` enum (14 states, aligned with architecture §25.8):

- `created` — NodeRun created, waiting for scheduler selection
- `ready` — selected by Graph Scheduler, waiting for lease acquisition
- `leased` — lease acquired, waiting for worker to start execution
- `running` — worker is executing
- `retry_wait` — execution failed, entering retry wait state (non-terminal)
- `awaiting_hitl` — waiting for human approval or input
- `reconciling` — in side-effect reconciliation phase
- `succeeded` — completed successfully (terminal state)
- `failed` — execution failed (terminal state)
- `skipped` — cascading skip by upstream (terminal state)
- `cancelled` — cancelled (terminal state)
- `dependency_failed` — prerequisite dependency not met (terminal state)
- `policy_blocked` — policy gate prevented execution (terminal state)
- `aborted` — aborted due to exception (terminal state)

Allowed transitions (core subset):

- `created -> ready`
- `ready -> leased`
- `leased -> running`
- `running -> succeeded / failed / awaiting_hitl / retry_wait / reconciling`
- `awaiting_hitl -> running` (approval passed)
- `retry_wait -> ready` (retry expired)
- `reconciling -> succeeded / failed`

Terminal state closure rules: `succeeded / failed / skipped / cancelled / dependency_failed / policy_blocked / aborted` are terminal states and must not transition out; any repair must be expressed via redrive, compensation, GraphPatch, or child run addition.

Constraints:

- Retry must not create a new NodeRun; must append a new NodeAttempt.
- `retry_wait` must record wake condition (wakeAt / retryPolicyRef / attemptId / backoff reason).
- Compensation completion is not a NodeRun terminal state; compensation facts are recorded in SideEffectRecord / CompensationRecord.
- v4.3 truth execution status is based on `NodeRunStatus` and `NodeAttemptReceipt` append-only receipts and must not inversely drive runtime legality judgments.

## 7. Cross-State Consistency Constraints

- When a task enters `awaiting_decision`, the related workflow should be in `paused` or provable waiting state.
- When workflow becomes `completed`, the task must enter `done` within a short transaction or the same recovery logic.
- Approval `approved` does not automatically equal task success, only indicates execution can continue.
- Any terminal state must record timestamp, trigger reason, and trace id.
- If run enters `blocked` and reason is approval wait, task and workflow status must synchronously enter waiting semantics.
- When session enters `awaiting_user`, the task should be in `awaiting_decision`, workflow in `paused`, or have a clear channel-side waiting reason.
- Session `completed / failed / cancelled` should follow task terminal state closure, but session terminal state must not inversely determine task terminal state.
- When `current_stage=feedback|learn|improve|release`, the workflow can still remain `running`; the workflow must not be marked `completed` early just because execute has ended.
- When stage returns from `release` to the next round of `observe`, the workflow still maintains the same lifecycle, only incrementing `loop_iteration`.

## 8. Failure Semantics

- Non-terminal state recovery can only be completed through explicit state transitions; direct field overwrites for repair are prohibited.
- `failed` must distinguish between retryable and non-retryable reason codes.
- `cancelled` must preserve the cancellation initiator and reason.
- Precheck failure must not be disguised as success followed by failure; the true failure stage must be preserved.

## 9. Supplementary Rules

- When aggregating multiple subtasks, if at least one succeeds and at least one fails, the overall task can enter `partial_success`, but must include an aggregation summary and reason for incompletion.
- Status snapshot compression in the event bus only allows compression of rebuildable intermediate states; terminal states or key audit nodes must not be compressed.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs in this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` shall prevail.

- T-1: ExecutionStatus uses 5 states (running/paused/cancelled/completed/failed), architecture NodeRun uses 9 states (pending/ready/running/blocked/succeeded/failed/skipped/cancelled/timed_out); WorkflowStatus has 6 states vs HarnessRun's 13 states. Fix: This semantics converges to v4.3 canonical contract; old fields, old states, old DTOs, or old terminology are only allowed as legacy/deprecated/projection/migration input and must not serve as new implementation entry points.

Mandatory Rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.