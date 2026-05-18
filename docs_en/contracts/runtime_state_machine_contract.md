# Runtime State Machine Contract

> **v4.3 Compatibility Note**: This file is retained as historical task / workflow / OAPEFLIR view state documentation. v4.3 state progression authority takes [ADR-110](../adr/110-runtime-state-machine-authority.md), [harness-run-contract.md](./harness-run-contract.md), [node-run-attempt-receipt-contract.md](./node-run-attempt-receipt-contract.md), [side-effect-reconciliation-contract.md](./side-effect-reconciliation-contract.md), and [budget-ledger-contract.md](./budget-ledger-contract.md) as authoritative; new modules must advance truth through `RuntimeStateMachine.transition(command)`.

> **OAPEFLIR Related**: OAPEFLIR paragraphs in this file only express stage projection sequence, do not define any truth-grade run / node state machine.
> **Updated**: 2026-04-17

## 1. Scope

This contract records historical task, workflow, and OAPEFLIR projection view states that remain compatible after Ring 1, and the mapping constraints between them and v4.3 truth state machine.

Supplementary notes:

- This document answers "how can state change".
- `runtime_execution_contract.md` answers "how is a runtime run inspected, executed, retried, and terminated".

## 1A. OAPEFLIR Top-Level Stage Projection View

OAPEFLIR's eight stages are for explaining closed-loop semantic view only, recommended to display in the following order:

```text
observe -> assess -> plan -> execute -> feedback -> learn -> improve -> release
```

Loop semantics:

- After `release` completes, can enter next round of `observe` with `loop_iteration + 1`.
- If task already satisfies exit condition, can directly enter terminal, not required to start next round.

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

- Canonical写法 for `stage` must be the above enum, must not use synonyms like `perceive`, `analyze`, `deploy`.
- `skipped` can only be used for explicitly controlled skip, must not be used as failure downgrade alias.
- `release` is the current closed-loop stage, does not necessarily mean actual external release occurs; real release action is still controlled by HarnessRuntime / Release Gate.

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
- `awaiting_decision` is only used for waiting on external approval/human input, does not replace ordinary pause.
- `done`, `failed`, `cancelled` are terminal states; after terminal state, can only enter new lifecycle through creating new recovery task.

## 3. HarnessRunStatus (v4.3 canonical run status, 14 states)

> Note: This document originally used `WorkflowStatus` as run status enum. v4.3 canonical run status takes `HarnessRun.status` (14 states) as authoritative. `WorkflowStatus` is retained only as old workflow projection view and should not be used as authoritative run status for new implementations.

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

- `paused` must be accompanied by a recoverable reason, such as awaiting approval, awaiting human input, awaiting external dependency.
- `resuming` is only a brief intermediate state, used for state repair and preflight check before recovery.
- `replanning` / `compensating` are active running states during OAPEFLIR, not independent terminal states.
- `HarnessRunStatus` is v4.3 truth run status; old `WorkflowStatus` / `TaskStatus` are only legacy projections.
- Specific closed-loop stage progress is expressed by `current_stage + StageStatus`, must not mix the two into one field.

### 3A. Legacy WorkflowStatus (deprecated projection)

The following enum is retained only as historical workflow read model projection, must not be used as new implementation entry:

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

- `completing / cancelling / timed_out` are old workflow-specific states, have no corresponding state in v4.3 HarnessRun.
- All legacy states are only for read model / migration input, must not be used as authoritative state for new implementations.

## 4. SessionStatus

Session status only describes "channel interaction state", not task truth source.

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

- `SessionStatus` can only express channel-side interaction, must not replace task or workflow's authoritative state.
- `awaiting_user` only indicates session layer waiting for user response, cannot directly conclude task failure or completion.
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
- `approved` / `rejected` decision only allowed to take effect once.
- When new request supersedes old request, old request must be written as `superseded`, cannot be silently overwritten.

## 6. NodeRunStatus (canonical execution truth per v4.3)

> Note: This document originally used `ExecutionStatus` as execution status enum. v4.3 canonical execution status takes `NodeRun.status` (14 states) as authoritative. `ExecutionStatus` is retained only as old `executions` projection view and migration documentation; new implementations must not use it as authoritative execution status enum.

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
- `blocked -> ready` (when dependency satisfied)
- `skipped -> aborted`
- `cancelled -> aborted`

Constraints:

- `retry_wait` is part of formal running state, used for retry wait period; must record `wakeAt`, `retryPolicyRef`, `attemptId`, and backoff reason.
- `awaiting_hitl` must be accompanied by explicit reason, such as `approval_required`, `human_input_required`.
- `reconciling` is for reconciling side effect and compensation logic.
- `blocked` indicates non-executable due to upstream dependencies not satisfied, must not be disguised as `queued` or `ready`.
- `queued` indicates已进入调度队列 waiting for scheduler selection, distinguished from `blocked` (dependency not satisfied).
- Retry semantics achieved by creating new `NodeAttempt` (increment `attemptNo` field), must not update old `NodeRun` state.
- `succeeded`, `failed`, `skipped`, `cancelled`, `aborted` are terminal states, terminal states cannot transition out.
- v4.3 truth execution status takes `NodeRunStatus` and `NodeAttemptReceipt` append-only receipt as authoritative, old `ExecutionStatus` must not reverse-drive runtime legality judgment.

## 7. Cross-State Consistency Constraints

- When task enters `awaiting_decision`, related workflow should be in `paused` or provable waiting state.
- When workflow `completed`, task must enter `done` within short transaction or same recovery logic.
- Approval `approved` does not automatically equal task success, only indicates can continue execution.
- Any terminal state must record timestamp, trigger reason, and trace id.
- If run enters `blocked` with reason awaiting approval, task and workflow state must synchronously enter waiting semantics.
- When session enters `awaiting_user`, task should be in `awaiting_decision`, workflow in `paused`, or have explicit channel-side waiting reason.
- Session's `completed / failed / cancelled` should follow task terminal state closure, but session terminal state must not reverse-decide task terminal state.
- When `current_stage=feedback|learn|improve|release`, workflow can still remain `running`; must not prematurely mark workflow as `completed` just because execute has ended.
- When stage returns from `release` to next round of `observe`, workflow remains in same lifecycle, only increment `loop_iteration`.

## 8. Failure Semantics

- Non-terminal state recovery can only be completed through explicit state transition, prohibited from directly overwriting fields to fix.
- `failed` must distinguish retryable from non-retryable reason codes.
- `cancelled` must retain cancellation initiator and cancellation reason.
- Precheck failure must not be disguised as execution success, must retain true failure stage.

## 9. Supplementary Rules

- When aggregating multiple sub-tasks, if at least one succeeds and at least one fails, task overall can enter `partial_success`, but must attach aggregation summary and incomplete reason.
- Event bus state snapshot compression only allows compressing rebuildable intermediate states, must not compress terminal states or key audit nodes.


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` shall prevail.

- T-1: Original ExecutionStatus used 13 states but was missing `blocked/queued`, and used old name `ExecutionStatus` to replace `NodeRun.status`; WorkflowStatus 17 states (including `completing/cancelling/timed_out`) vs HarnessRun 13 states. Fix: §6 renames ExecutionStatus → NodeRunStatus, completes 14 states (`created/blocked/ready/queued/leased/running/retry_wait/awaiting_hitl/reconciling/succeeded/failed/skipped/cancelled/aborted`); §3 clarifies HarnessRunStatus as v4.3 canonical 13-state run status, old WorkflowStatus demoted to legacy projection.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
