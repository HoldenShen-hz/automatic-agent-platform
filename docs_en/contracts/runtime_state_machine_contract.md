# Runtime State Machine Contract

## 1. Scope

This contract defines the task, workflow, approval, and execution state machines that Phase 1a must stabilize, along with allowed state transitions.

Supplementary notes:

- This document answers "how states can change".
- `runtime_execution_contract.md` answers "how runtime runs are checked, executed, retried, and terminated".

## 2. TaskStatus

```text
queued -> pending -> in_progress -> done
                    -> awaiting_decision -> in_progress
                    -> failed
                    -> cancelled
```

Enumerations:

- `queued`
- `pending`
- `in_progress`
- `awaiting_decision`
- `done`
- `failed`
- `cancelled`

Constraints:

- New tasks default to `queued` or `pending` after creation; they cannot be directly written to `in_progress` without a creation record.
- `awaiting_decision` is only used for waiting on external approval/human input, not as a substitute for normal pause.
- `done`, `failed`, `cancelled` are terminal states; after a terminal state, one can only enter a new lifecycle through creating a recovery task.

## 3. WorkflowStatus

Enumerations:

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

## 4. SessionStatus

Session status only describes "channel interaction state", it is not the source of truth for tasks.

Enumerations:

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

- `SessionStatus` can only express channel-side interaction, it must not replace the authoritative status of tasks or workflows.
- `awaiting_user` only indicates the session layer is waiting for user response; it cannot directly conclude task failure or completion.
- `completed`, `failed`, `cancelled` are session terminal states.

## 5. ApprovalStatus

Enumerations:

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
- When a new request supersedes an old request, the old request must be marked as `superseded`, not silently overwritten.

## 6. ExecutionStatus

> Note: This enum was previously called `AgentRunStatus` in earlier documents. It is now unified as `ExecutionStatus`, consistent with the `executions.status` field and the entry point in `transition_service_contract.md`.

Enumerations:

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

- `prechecking` is part of the formal running state, not an ignorable temporary field.
- `blocked` must be accompanied by a clear reason, such as `approval_required` or `dependency_unavailable`.
- `superseded` indicates the execution was replaced by a new attempt or handover; the old execution no longer advances.
- Retry semantics are no longer expressed through a separate state, but achieved by creating a new execution attempt (incrementing the `attempt` field); the old execution enters `failed` or `superseded`.
- `succeeded`, `failed`, `cancelled`, `superseded` are terminal states.

## 7. Cross-State Consistency Constraints

- When a task enters `awaiting_decision`, the associated workflow should be in `paused` or a provable waiting state.
- When workflow `completed`, the task must enter `done` within a short transaction or the same recovery logic.
- Approval `approved` does not automatically equal task success; it only indicates execution can continue.
- Every terminal state must record timestamp, trigger reason, and trace id.
- If a run enters `blocked` with an approval wait reason, task and workflow status must synchronize to the waiting semantics.
- When a session enters `awaiting_user`, the task should be in `awaiting_decision`, workflow in `paused`, or have a clear channel-side waiting reason.
- Session `completed / failed / cancelled` should follow task terminal state closure, but session terminal state must not反向决定 task terminal state.

## 8. Failure Semantics

- Non-terminal state recovery can only be completed through explicit state migration; direct field overwrite is prohibited.
- `failed` needs to distinguish retryable from non-retryable reason codes.
- `cancelled` must preserve the cancellation initiator and cancellation reason.
- Precheck failure must not be disguised as execution success then failure; the true failure stage must be preserved.

## 9. Supplementary Rules

- When aggregating multiple subtasks, if at least one succeeds and at least one fails, the overall task can enter `partial_success`, but must include aggregation summary and incomplete reasons.
- State snapshot compression in the event bus only allows compressing rebuildable intermediate states; terminal states or key audit nodes must not be compressed.
