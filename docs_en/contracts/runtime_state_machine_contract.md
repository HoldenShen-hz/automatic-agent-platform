# Runtime State Machine Contract

> **v4.3 Compatibility Note**: This document is preserved as historical task/workflow/OAPEFLIR view state descriptions. v4.3 state progression authority is defined in [ADR-110](../adr/110-runtime-state-machine-authority.md), [harness-run-contract.md](./harness-run-contract.md), [node-run-attempt-receipt-contract.md](./node-run-attempt-receipt-contract.md), [side-effect-reconciliation-contract.md](./side-effect-reconciliation-contract.md), and [budget-ledger-contract.md](./budget-ledger-contract.md); new modules must advance truth through `RuntimeStateMachine.transition(command)`.

> **OAPEFLIR Note**: OAPEFLIR paragraphs in this document only express stage projection order, and do not define any truth-grade run/node state machine.
> **Updated**: 2026-04-17

## 1. Scope

This contract records historical task, workflow, and OAPEFLIR projection view states that remain compatible after Ring 1, and the mapping constraints between them and the v4.3 truth state machine.

Supplementary notes:

- This document answers "how states can change".
- `runtime_execution_contract.md` answers "how runtime runs are inspected, executed, retried, and terminated".

## 1A. OAPEFLIR Top-Level Stage Projection View

OAPEFLIR's eight stages are used only for explaining closed-loop semantic views, recommended to display in the following order:

```text
observe -> assess -> plan -> execute -> feedback -> learn -> improve -> release
```

Loop semantics:

- After `release` completes, may enter next round of `observe`, with `loop_iteration + 1`.
- If task already satisfies exit conditions, may go directly to terminal without starting a new round.

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

- `stage` canonical写法 must be the above enum; synonyms like `perceive`, `analyze`, `deploy` are not permitted.
- `skipped` may only be used for explicit controlled skipping; must not be used as a failure demotion alias.
- `release` is the current closed-loop stage; it does not equal that an actual external release must occur; true release actions are still controlled by HarnessRuntime/Release Gate.

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

- New tasks default to `queued` or `pending` after creation; cannot directly write `in_progress` without a creation record.
- `awaiting_decision` is only used for waiting on external approval/human input; does not replace ordinary pause.
- `done`, `failed`, `cancelled` are terminal states; after a terminal state, can only enter a new lifecycle through creating a recovery task.

## 3. HarnessRunStatus (v4.3 canonical run status, 14 states)

> Note: This document originally used `WorkflowStatus` as the run status enum. v4.3 canonical run status follows `HarnessRun.status` (14 states). `WorkflowStatus` is only retained as legacy workflow projection view and should not be used as authoritative run status.

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

- `paused` must have a recoverable reason, such as awaiting approval, awaiting human input, or awaiting external dependency.
- `resuming` only serves as a brief intermediate state for state repair and preflight checks before recovery.
- `replanning`/`compensating` are active running states during OAPEFLIR; they are not independent terminal states.
- `HarnessRunStatus` is the v4.3 truth run status; old `WorkflowStatus`/`TaskStatus` only serve as legacy projection.
- Specific closed-loop stage progress is expressed by `current_stage + StageStatus`; these two must not be combined into one field.

### 3A. Legacy WorkflowStatus (deprecated projection)

The following enum is only retained as historical workflow read model projection and should not be used as new implementation entry points:

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

- `completing/cancelling/timed_out` are states unique to old workflows and have no corresponding state in v4.3 HarnessRun.
- All legacy states only serve as read model/migration input and must not be used as authoritative state for new implementations.

## 4. SessionStatus

Session status only describes "channel interaction state", not the task source of truth.

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

- `SessionStatus` can only express channel-side interaction and must not replace authoritative state of task or workflow.
- `awaiting_user` only indicates the session layer is waiting for user response; it cannot directly conclude task failure or completion.
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

- Same `approval_id` can only have one terminal state.
- `approved`/`rejected` decisions are only permitted to take effect once.
- When new request supersedes old request, old request must be marked as `superseded`; silent overwrite is not permitted.

## 6. NodeRunStatus (canonical execution truth per v4.3)

> Note: This document originally used `ExecutionStatus` as the execution status enum. v4.3 canonical execution status follows `NodeRun.status` (14 states). `ExecutionStatus` is only retained for old `executions` projection view and migration descriptions; new implementations must not use it as authoritative execution status enum.

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

Terminal states: `succeeded`, `failed`, `skipped`, `cancelled`, `aborted`. Terminal states cannot transition out.

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
- `blocked -> ready` (when dependency satisfied)
- `skipped -> aborted`
- `cancelled -> aborted`

Constraints:

- `retry_wait` is part of formal running state, used for retry wait period; must record `wakeAt`, `retryPolicyRef`, `attemptId`, and backoff reason.
- `awaiting_hitl` must have explicit cause, such as `approval_required` or `human_input_required`.
- `reconciling` is used for coordinating side effects and compensation logic.
- `blocked` indicates it is not executable due to upstream dependency not being satisfied; must not be disguised as `queued` or `ready`.
- `queued` indicates it has entered the scheduling queue and is waiting for scheduler selection; distinguished from `blocked` (dependency not satisfied).
- Retry semantics are achieved by creating new `NodeAttempt` (incrementing `attemptNo` field); must not update old `NodeRun` state.
- `succeeded`, `failed`, `skipped`, `cancelled`, `aborted` are terminal states; terminal states cannot transition out.
- v4.3 truth execution status follows `NodeRunStatus` and `NodeAttemptReceipt` append-only receipt; old `ExecutionStatus` must not reversely drive runtime legitimacy judgment.

## 7. Cross-State Consistency Constraints

- When task enters `awaiting_decision`, related workflow should be in `paused` or provable waiting state.
- When workflow `completed`, task must enter `done` within a short transaction or same recovery logic.
- Approval `approved` does not automatically equal task success; it only indicates execution may continue.
- Each terminal state must record timestamp, trigger cause, and trace id.
- When run enters `blocked` with approval-waiting as reason, task and workflow status must synchronously enter waiting semantics.
- When session enters `awaiting_user`, task should be in `awaiting_decision`, workflow in `paused`, or there should be explicit channel-side waiting reason.
- Session `completed/failed/cancelled` should follow task terminal state closure, but session terminal state must not reversely determine task terminal state.
- When `current_stage=feedback|learn|improve|release`, workflow may still remain `running`; must not prematurely mark workflow as `completed` just because execute has ended.
- When stage returns from `release` to next round of `observe`, workflow remains in same lifecycle, only incrementing `loop_iteration`.

## 8. Failure Semantics

- Non-terminal state recovery can only be completed through explicit state transition; direct field overwrite repair is prohibited.
- `failed` must distinguish between retryable and non-retryable error codes.
- `cancelled` must preserve the initiator and reason for cancellation.
- Precheck failure must not be disguised as execution success followed by failure; must preserve the real failure stage.

## 9. Supplementary Rules

- When aggregating multiple sub-tasks, if at least one succeeds and at least one fails, the task overall may enter `partial_success`, but must attach aggregation summary and incomplete reasons.
- State snapshot compression in event bus only allows compressing reconstructible intermediate states; terminal states or key audit nodes must not be compressed.

## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-1: Original ExecutionStatus used 13 states but lacked `blocked/queued`, and used old name `ExecutionStatus` to replace `NodeRun.status`; WorkflowStatus 17 states (including `completing/cancelling/timed_out`) vs HarnessRun 13 states. Fix: Section 6 renames ExecutionStatus to NodeRunStatus, completing 14 states (`created/blocked/ready/queued/leased/running/retry_wait/awaiting_hitl/reconciling/succeeded/failed/skipped/cancelled/aborted`); Section 3 clarifies HarnessRunStatus as v4.3 canonical 13-state run status, original WorkflowStatus demoted to legacy projection.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*`/rationale projection; budgets must use `BudgetLedger`/`BudgetReservation`/`BudgetSettlement`.