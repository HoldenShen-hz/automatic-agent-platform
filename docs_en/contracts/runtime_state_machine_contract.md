# Runtime State Machine Contract

> **OAPEFLIR Related**: This contract defines the OAPEFLIR 8-stage state machine, corresponding to ADR-016.
> **Last Updated**: 2026-04-17

## 1. Scope

This contract defines the task, workflow, approval, and execution state machines and permitted state transitions that Phase 1a must stabilize.

Supplementary notes:

- This document answers "how can state change".
- `runtime_execution_contract.md` answers "how is runtime run checked, executed, retried, and terminated".

## 1A. OAPEFLIR Top-Level Stage State Machine

Phase 1-4 workflow top-level stages advance in the following order:

```text
observe -> assess -> plan -> execute -> feedback -> learn -> improve -> release
```

Loop semantics:

- After `release` completes, can enter next round of `observe`, with `loop_iteration + 1`.
- If task already meets exit condition, can directly enter terminal, not required to start next round.

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

- Canonical notation of `stage` must be the above enum, must not use synonyms like `perceive`, `analyze`, `deploy`.
- `skipped` can only be used for explicit controlled skip, must not be used as failure downgrade alias.
- `release` is the current closed-loop stage, not equivalent to necessarily having real external release; within current phase1-4 authoritative boundary, can only advance to `off / suggest / shadow`.

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

- New task after creation defaults to `queued` or `pending`, cannot directly write `in_progress` without creating record.
- `awaiting_decision` is only for waiting for external approval / manual input, does not replace ordinary pause.
- `done`, `failed`, `cancelled` are terminal states; after terminal state, can only enter new lifecycle through creating recovery task.

## 3. WorkflowStatus

Enum:

- `running`
- `paused`
- `completed`
- `failed`
- `resuming`
- `cancelling`
- `cancelled`

Permitted transitions:

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
- `paused` must be accompanied by recoverable reason, such as waiting for approval, waiting for manual input, waiting for external dependency.
- `resuming` is only a brief intermediate state, used for state repair and preflight check before recovery.
- `WorkflowStatus` represents workflow overall lifecycle; specific closed-loop stage progress is expressed by `current_stage + StageStatus`, must not mix the two into one field.

## 4. SessionStatus

Session status only describes "channel interaction state", is not task source of truth.

Enum:

- `open`
- `streaming`
- `awaiting_user`
- `paused`
- `completed`
- `failed`
- `cancelled`

Permitted transitions:

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

- `SessionStatus` can only express channel-side interaction, must not replace task or workflow's authoritative state.
- `awaiting_user` only indicates session layer waiting for user response, cannot directly infer task failure or completion.
- `completed`, `failed`, `cancelled` are session terminal states.

## 5. ApprovalStatus

Enum:

- `requested`
- `approved`
- `rejected`
- `expired`
- `superseded`

Permitted transitions:

- `requested -> approved`
- `requested -> rejected`
- `requested -> expired`
- `requested -> superseded`

Constraints:

- Same `approval_id` can only have one terminal state.
- `approved` / `rejected` decision only allowed to take effect once.
- When new request supersedes old request, old request must be written as `superseded`, cannot silently overwrite.

## 6. ExecutionStatus

> Note: This enum was previously called `AgentRunStatus` in early documents; now unified as `ExecutionStatus`, consistent with `executions.status` field and entry in `transition_service_contract.md`.

Enum:

- `created`
- `prechecking`
- `executing`
- `blocked`
- `succeeded`
- `failed`
- `cancelled`
- `superseded`

Permitted transitions:

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

- `prechecking` is part of formal running state, not an ignorable temporary field.
- `blocked` must be accompanied by explicit reason, such as `approval_required`, `dependency_unavailable`.
- `superseded` indicates this execution was replaced by new attempt or handover, old execution no longer advances.
- Retry semantics are no longer expressed through independent state, but through creating new execution attempt (increment `attempt` field), old execution enters `failed` or `superseded`.
- `succeeded`, `failed`, `cancelled`, `superseded` are terminal states.

## 7. Cross-State Consistency Constraints

- When task enters `awaiting_decision`, related workflow should be in `paused` or provable waiting state.
- When workflow `completed`, task must enter `done` within short transaction or same recovery logic.
- Approval `approved` does not automatically equal task success, only indicates can continue execution.
- Any terminal state must record timestamp, trigger reason, and trace id.
- If run enters `blocked` and reason is approval waiting, task and workflow state must synchronously enter waiting semantics.
- When session enters `awaiting_user`, task should be in `awaiting_decision`, workflow in `paused`, or have explicit channel-side waiting reason.
- Session `completed / failed / cancelled` should follow task terminal state closure, but session terminal state must not inversely decide task terminal state.
- When `current_stage=feedback|learn|improve|release`, workflow can still remain `running`; must not prematurely mark workflow as `completed` just because execute has ended.
- When stage goes from `release` back to next round of `observe`, workflow remains in same lifecycle, only increment `loop_iteration`.

## 8. Failure Semantics

- Non-terminal state recovery can only be completed through explicit state migration, forbidden to fix by directly overwriting fields.
- `failed` must distinguish retryable from non-retryable reason codes.
- `cancelled` must preserve cancel initiator and cancel reason.
- Precheck failure must not be disguised as execution success then failure, must preserve real failure stage.

## 9. Supplementary Rules

- When aggregating multiple sub-tasks, if at least one succeeds and at least one fails, task overall can enter `partial_success`, but must attach aggregation summary and incomplete reason.
- State snapshot compression in event bus only allows compressing rebuildable intermediate states, must not compress terminal states or key audit nodes.
