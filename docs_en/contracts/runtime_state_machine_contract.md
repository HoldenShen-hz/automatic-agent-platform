# Runtime State Machine Contract

> **v4.3 Compatibility Note**: This file is preserved as historical OAPEFLIR / task / workflow state machine documentation. v4.3 state advancement authority is based on [ADR-110](../adr/110-runtime-state-machine-authority.md), [harness-run-contract.md](./harness-run-contract.md), [node-run-attempt-receipt-contract.md](./node-run-attempt-receipt-contract.md), [side-effect-reconciliation-contract.md](./side-effect-reconciliation-contract.md), and [budget-ledger-contract.md](./budget-ledger-contract.md); new modules must advance truth through `RuntimeStateMachine.transition(command)`.

> **OAPEFLIR Related**: This contract defines the OAPEFLIR 8-stage state machine, corresponding to ADR-016.
> **Last Updated**: 2026-04-17

## 1. Scope

This contract defines the task, workflow, approval, and execution state machines that must be stable in Phase 1a, and the allowed state transitions.

Supplementary notes:

- This document answers "how can states change".
- `runtime_execution_contract.md` answers "how are runtime runs checked, executed, retried, and terminated".

## 1A. OAPEFLIR Top-Level Stage State Machine

Workflow top-level stages in Phase 1-4 advance in the following order:

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
- `release` is the current closed-loop stage, not equivalent to a real external release necessarily occurring; within the current Phase 1-4 authoritative boundary, it can only advance to `off / suggest / shadow`.

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

## 3. WorkflowStatus

Enum:

- `running`
- `paused`
- `completed`
- `failed`
- `resuming`
- `cancelling`
- `cancelled`

Allowed transitions:

- `running -> paused`
- `running -> completed`
- `running -> failed`
- `running -> cancelling`
- `paused -> resuming`
- `resuming -> running`
- `resuming -> failed`
- `cancelling -> cancelled`

Constraints:

- `completed` and `failed` are terminal states.
- `paused` must be accompanied by a recoverable reason, such as approval wait, human input wait, or external dependency wait.
- `resuming` is only a brief intermediate state, used for state repair and preflight checks before recovery.
- `WorkflowStatus` represents the workflow overall lifecycle; specific closed-loop stage progress is expressed by `current_stage + StageStatus`, and the two must not be mixed into one field.

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

## 6. ExecutionStatus

> Note: This enum was previously called `AgentRunStatus` in early documents; now unified to `ExecutionStatus`, consistent with `executions.status` field and entry in `transition_service_contract.md`.

Enum:

- `created`
- `prechecking`
- `executing`
- `blocked`
- `succeeded`
- `failed`
- `cancelled`
- `superseded`

Allowed transitions:

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

Constraints:

- `prechecking` is part of the formal running state, not a negligible temporary field.
- `blocked` must be accompanied by a clear reason, such as `approval_required` or `dependency_unavailable`.
- `superseded` indicates the execution was replaced by a new attempt or handover, and the old execution no longer advances.
- Retry semantics are no longer expressed by a separate state, but achieved by creating a new execution attempt (incrementing the `attempt` field); the old execution enters `failed` or `superseded`.
- `succeeded`, `failed`, `cancelled`, `superseded` are terminal states.

## 7. Cross-State Consistency Constraints

- When a task enters `awaiting_decision`, the related workflow should be in `paused` or provable waiting state.
- When workflow becomes `completed`, the task must enter `done` within a short transaction or the same recovery logic.
- Approval `approved` does not automatically equal task success, only indicates execution can continue.
- Any terminal state must record timestamp, trigger reason, and trace id.
- If a run enters `blocked` and the reason is approval wait, task and workflow status must synchronously enter waiting semantics.
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

- T-1: ExecutionStatus uses 5 states (running/paused/cancelled/completed/failed), architecture NodeRun uses 9 states (pending/ready/running/blocked/succeeded/failed/skipped/cancelled/timed_out); WorkflowStatus has 6 states vs HarnessRun's 13 states. Fix: This semantics converges to v4.3 canonical contract; old fields, old states, old DTOs, or old terminology are only allowed as legacy/deprecated/projection/migration input, and must not serve as new implementation entry points.

Mandatory Rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
