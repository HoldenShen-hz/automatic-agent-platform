# Runtime State Machine Contract

> **v4.3 Compatibility Note**: This file is preserved as historical task / workflow / OAPEFLIR view state documentation. v4.3 state advancement authority is based on [ADR-110](../adr/110-runtime-state-machine-authority.md), [harness-run-contract.md](./harness-run-contract.md), [node-run-attempt-receipt-contract.md](./node-run-attempt-receipt-contract.md), [side-effect-reconciliation-contract.md](./side-effect-reconciliation-contract.md), and [budget-ledger-contract.md](./budget-ledger-contract.md); new modules must advance truth through `RuntimeStateMachine.transition(command)`.

> **OAPEFLIR Related**: The OAPEFLIR paragraphs in this document only express stage projection order and do not define any truth-grade run / node state machine.
> **Last Updated**: 2026-04-17

## 1. Scope

This contract documents historical task, workflow, and OAPEFLIR projection view states that still need compatibility after Ring 1, and the mapping constraints between them and v4.3 truth state machine.

Supplementary notes:

- This document answers "how can states change".
- `runtime_execution_contract.md` answers "how are runtime runs checked, executed, retried, and terminated".

## 1A. OAPEFLIR Top-Level Stage Projection View

The eight stages of OAPEFLIR are only used for explaining closed-loop semantic views, recommended display order:

```text
observe -> assess -> plan -> execute -> feedback -> learn -> improve -> release
```

Loop semantics:

- After `release` completes, it can proceed to the next round of `observe`, with `loop_iteration + 1`.
- If the task already meets exit conditions, it can directly enter terminal without requiring a new round.

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

- Canonical writing for `stage` must use the above enums; synonyms like `perceive`, `analyze`, `deploy` must not be used.
- `skipped` can only be used for explicit controlled skips, and must not be used as a failure degradation alias.
- `release` is the current closed-loop stage, not equivalent to a real external release necessarily occurring; real release actions are still controlled by HarnessRuntime / Release Gate.

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
- `awaiting_decision` is only used for waiting for external approval / human input, and does not replace normal pause.
- `done`, `failed`, `cancelled` are terminal states; after terminal state, new lifecycle can only be entered by creating a new recovery task.

## 3. HarnessRunStatus (v4.3 canonical run status, 14 states)

> Note: This document originally used `WorkflowStatus` as the run status enum. v4.3 canonical run status is based on `HarnessRun.status` (14 states). `WorkflowStatus` is retained only as old workflow projection view and should no longer be used as authoritative run status.

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

- `paused` must be accompanied by a recoverable reason, such as approval wait, human input wait, or external dependency wait.
- `resuming` is only a brief intermediate state, used for state repair and preflight checks before recovery.
- `replanning` / `compensating` are active running states during OAPEFLIR, not independent terminal states.
- `HarnessRunStatus` is v4.3 truth run status; old `WorkflowStatus` / `TaskStatus` are retained only as legacy projections.
- Specific closed-loop stage progress is expressed by `current_stage + StageStatus`; the two must not be mixed into one field.

### 3A. Legacy WorkflowStatus (deprecated projection)

The following enum is retained only as historical workflow read model projection and should not be used in new implementation entry points:

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

- `completing / cancelling / timed_out` are states unique to old workflow and have no corresponding state in v4.3 HarnessRun.
- All legacy states are only used as read model / migration input, and must not be used as authoritative state for new implementations.

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

- `SessionStatus` can only express channel-side interaction, and must not replace authoritative state of task or workflow.
- `awaiting_user` only indicates the session layer is waiting for user response, and cannot directly conclude task failure or completion.
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
- When a new request supersedes an old request, the old request must be written as `superseded`, and cannot be silently overwritten.

## 6. NodeRunStatus (canonical execution truth per v4.3)

> Note: This document previously used `ExecutionStatus` as the execution status enum. v4.3 canonical execution status is based on `NodeRun.status` (14 states). `ExecutionStatus` is retained only as old `executions` projection view and migration documentation; new implementations must not use it as authoritative execution status enum.

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
- `blocked -> ready` (when dependency is satisfied)
- `skipped -> aborted`
- `cancelled -> aborted`

Constraints:

- `retry_wait` is part of the formal running state, used for retry waiting period; must record `wakeAt`, `retryPolicyRef`, `attemptId`, and backoff reason.
- `awaiting_hitl` must be accompanied by a clear reason, such as `approval_required`, `human_input_required`.
- `reconciling` is used for coordinating side effects and compensation logic.
- `blocked` indicates the node is not executable due to upstream dependencies not being satisfied; must not be disguised as `queued` or `ready`.
- `queued` indicates the node has entered the scheduler queue and is waiting to be picked up by the scheduler; distinguish from `blocked` (dependency not satisfied).
- Retry semantics are achieved by creating a new `NodeAttempt` (incrementing `attemptNo` field); must not update old `NodeRun` status.
- `succeeded`, `failed`, `skipped`, `cancelled`, `aborted` are terminal states.
- v4.3 truth execution status is based on `NodeRunStatus` and `NodeAttemptReceipt` append-only receipt; old `ExecutionStatus` must not inversely drive runtime legality judgment.

## 7. Cross-State Consistency Constraints

- When a task enters `awaiting_decision`, the related workflow should be in `paused` or provable waiting state.
- When workflow becomes `completed`, the task must enter `done` within a short transaction or the same recovery logic.
- Approval `approved` does not automatically equal task success, only indicates execution can continue.
- Any terminal state must record timestamp, trigger reason, and trace id.
- If a run enters `blocked` and the reason is approval wait, task and workflow status must synchronously enter waiting semantics.
- When session enters `awaiting_user`, the task should be in `awaiting_decision`, workflow in `paused`, or have a clear channel-side waiting reason.
- Session `completed / failed / cancelled` should follow task terminal state closure, but session terminal state must not inversely determine task terminal state.
- When `current_stage=feedback|learn|improve|release`, the workflow can still remain `running`; must not mark the workflow as `completed` early just because execute has ended.
- When stage returns from `release` to the next round of `observe`, the workflow maintains the same lifecycle, only incrementing `loop_iteration`.

## 8. Failure Semantics

- Non-terminal state recovery can only be completed through explicit state transitions; direct field overwrites for repair are prohibited.
- `failed` must distinguish between retryable and non-retryable reason codes.
- `cancelled` must preserve the cancellation initiator and reason.
- Precheck failure must not be disguised as execution success then failure; the true failure stage must be preserved.

## 9. Supplementary Rules

- When aggregating multiple subtasks, if at least one succeeds and at least one fails, the overall task can enter `partial_success`, but must include an aggregation summary and reason for incompletion.
- Status snapshot compression in the event bus only allows compression of rebuildable intermediate states; terminal states or key audit nodes must not be compressed.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical paragraphs conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 to ADR-113, and `src/platform/contracts/executable-contracts/` shall prevail.

- T-1: Original ExecutionStatus used 13 states but lacked `blocked/queued`, and used the old name `ExecutionStatus` instead of `NodeRun.status`; WorkflowStatus 17 states (including `completing/cancelling/timed_out`) vs HarnessRun 13 states. Fix: §6 renames ExecutionStatus → NodeRunStatus, adds 14 states (`created/blocked/ready/queued/leased/running/retry_wait/awaiting_hitl/reconciling/succeeded/failed/skipped/cancelled/aborted`); §3 clarifies HarnessRunStatus as v4.3 canonical 13-state run status, old WorkflowStatus demoted to legacy projection.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
