# Runtime State Machine Contract

> **v4.3 Compatibility Note**: This file is retained as historical task/workflow/OAPEFLIR view state documentation. v4.3 state progression authority is governed by [ADR-110](../adr/110-runtime-state-machine-authority.md), [harness-run-contract.md](./harness-run-contract.md), [node-run-attempt-receipt-contract.md](./node-run-attempt-receipt-contract.md), [side-effect-reconciliation-contract.md](./side-effect-reconciliation-contract.md), and [budget-ledger-contract.md](./budget-ledger-contract.md); new modules must advance truth through `RuntimeStateMachine.transition(command)`.

> **OAPEFLIR Related**: The OAPEFLIR paragraphs in this document only express stage projection sequence, do not define any truth-grade run/node state machine.
> **Update Date**: 2026-04-17

## 1. Scope

This contract records historical task, workflow, and OAPEFLIR projection view states that need to remain compatible after Ring 1, and the mapping constraints between them and v4.3 truth state machines.

Supplementary Notes:

- This document answers "how can state change".
- `runtime_execution_contract.md` answers "how are runtime runs inspected, executed, retried, and terminated".

## 1A. OAPEFLIR Top-Level Stage Projection View

The eight stages of OAPEFLIR are only used for explaining closed-loop semantic views, recommended to display in the following order:

```text
observe -> assess -> plan -> execute -> feedback -> learn -> improve -> release
```

Loop semantics:

- After `release` completes, may enter next round of `observe`, with `loop_iteration + 1`.
- If task already meets exit conditions, may directly enter terminal, does not require starting a new round.

`OapeflirStage` enum:

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

- Canonical writing of `stage` must use the above enums, must not use synonyms like `perceive`, `analyze`, `deploy`.
- `skipped` can only be used for explicit controlled skips, must not be used as a failure degradation alias.
- `release` is the current closed-loop stage, not equivalent to a real external release necessarily occurring; actual release actions are still controlled by HarnessRuntime / Release Gate progression.

## 2. TaskStatus

```text
queued -> pending -> in_progress -> done
                    -> awaiting_decision -> in_progress
                    -> failed
                    -> cancelled
```

Enums:

- `queued`
- `pending`
- `in_progress`
- `awaiting_decision`
- `done`
- `failed`
- `cancelled`

Constraints:

- New tasks default to `queued` or `pending` after creation, must not directly write `in_progress` without a creation record.
- `awaiting_decision` is only used for waiting on external approval/human input, does not replace normal pause.
- `done`, `failed`, `cancelled` are terminal states; after terminal state, can only enter new lifecycle through creating recovery task.

## 3. HarnessRunStatus (v4.3 canonical run status, 14 states)

> Note: This document originally used `WorkflowStatus` as the run status enum. v4.3 canonical run status is governed by `HarnessRun.status` (14 states). `WorkflowStatus` is only retained as old workflow projection view, must not be used as authoritative run status.

`HarnessRunStatus` enum (14 states):

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

Terminal states: `completed`, `failed`, `cancelled`, `aborted`. Terminal states cannot transition out.

Allowed transitions:

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

Constraints:

- `paused` must be accompanied by a recoverable reason, such as waiting for approval, waiting for human input, waiting on external dependency.
- `resuming` is only a short-lived intermediate state, used for state repair and preflight checks before recovery.
- `replanning` / `compensating` are active running states during OAPEFLIR, not independent terminal states.
- `HarnessRunStatus` is v4.3 truth run state; old `WorkflowStatus` / `TaskStatus` are only legacy projections.
- Specific closed-loop stage progress is expressed by `current_stage + StageStatus`, must not mix the two into one field.

### 3A. Legacy WorkflowStatus (deprecated projection)

The following enum is only retained as historical workflow read model projection, must not be used for new implementation entry points:

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

Rules:

- `completing / cancelling / timed_out` are old workflow-specific statuses, with no corresponding status in v4.3 HarnessRun.
- All legacy statuses are only for read model / migration input, must not be used as authoritative state for new implementations.

## 4. SessionStatus

Session status only describes "channel interaction state", not a task source of truth.

Enums:

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

- `SessionStatus` can only express channel-side interaction, must not replace authoritative state of task or workflow.
- `awaiting_user` only indicates session layer waiting for user response, must not directly infer task failure or completion.
- `completed`, `failed`, `cancelled` are session terminal states.

## 5. ApprovalStatus

Enums:

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

- Each `approval_id` can only have one terminal state.
- `approved` / `rejected` decisions are only allowed to take effect once.
- When a new request supersedes an old request, the old request must be written as `superseded`, must not be silently overwritten.

## 6. NodeRunStatus (canonical execution truth per v4.3)

> Note: This document previously used `ExecutionStatus` as the execution status enum. v4.3 canonical execution status is governed by `NodeRun.status` (14 states). `ExecutionStatus` is only retained as old `executions` projection view and migration documentation; new implementations must not use it as authoritative execution status enum.

`NodeRunStatus` enum (14 states):

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

Terminal states: `succeeded`, `failed`, `skipped`, `cancelled`, `aborted`.

Allowed transitions:

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
- `blocked -> ready` (when dependencies are satisfied)
- `skipped -> aborted`
- `cancelled -> aborted`

Constraints:

- `retry_wait` is part of formal running state, used for retry waiting period; must record `wakeAt`, `retryPolicyRef`, `attemptId`, and backoff reason.
- `awaiting_hitl` must be accompanied by explicit reason, such as `approval_required`, `human_input_required`.
- `reconciling` is used for reconciling side effects and compensation logic.
- `blocked` indicates unexecutable due to upstream dependencies not being satisfied, must not be disguised as `queued` or `ready`.
- `queued` indicates the task has entered the scheduler queue and is waiting to be selected by the scheduler, distinguished from `blocked` (dependency not satisfied).
- Retry semantics are implemented by creating new `NodeAttempt` (incrementing `attemptNo` field), must not update old `NodeRun` status.
- `succeeded`, `failed`, `skipped`, `cancelled`, `aborted` are terminal states, cannot transition out of terminal states.
- v4.3 truth execution status is governed by `NodeRunStatus` and `NodeAttemptReceipt` append-only receipt; old `ExecutionStatus` must not retroactively drive runtime legality decisions.

## 7. Cross-State Consistency Constraints

- When task enters `awaiting_decision`, the associated workflow should be in `paused` or provable waiting state.
- When workflow `completed`, task must enter `done` within a short transaction or same recovery logic.
- Approval `approved` does not automatically equal task success, only indicates execution may continue.
- Each terminal state must record timestamp, trigger reason, and trace id.
- If run enters `blocked` and reason is approval waiting, task and workflow state must synchronously enter waiting semantics.
- When session enters `awaiting_user`, task should be in `awaiting_decision`, workflow in `paused`, or have explicit channel-side waiting reason.
- Session's `completed / failed / cancelled` should follow task terminal state to close, but session terminal state must not retroactively determine task terminal state.
- When `current_stage=feedback|learn|improve|release`, workflow may still remain `running`; must not prematurely mark workflow as `completed` just because execute has ended.
- When stage transitions from `release` back to next round of `observe`, workflow still maintains the same lifecycle, only increments `loop_iteration`.

## 8. Failure Semantics

- Non-terminal state recovery can only be completed through explicit state transition, direct field overwrites to fix are prohibited.
- `failed` needs to distinguish retryable from non-retryable reason codes.
- `cancelled` must preserve cancellation initiator and cancellation reason.
- Precheck failures must not be disguised as successful execution then failure, must preserve the true failure stage.

## 9. Supplementary Rules

- When aggregating multiple subtasks, if at least one succeeds and at least one fails, task overall may enter `partial_success`, but must include aggregation summary and incomplete reasons.
- State snapshot compression in the event bus can only compress rebuildable intermediate states, must not compress terminal states or key audit nodes.


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical paragraphs conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-1: Original ExecutionStatus used 13 states but lacked `blocked/queued`, and used old name `ExecutionStatus` to replace `NodeRun.status`; WorkflowStatus 17 states (including `completing/cancelling/timed_out`) vs HarnessRun 13 states. Fix: §6 renames ExecutionStatus → NodeRunStatus, completes 14 states (`created/blocked/ready/queued/leased/running/retry_wait/awaiting_hitl/reconciling/succeeded/failed/skipped/cancelled/aborted`); §3 explicitly states HarnessRunStatus as v4.3 canonical 13-state run status, original WorkflowStatus demoted to legacy projection.

Mandatory Rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR must only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.