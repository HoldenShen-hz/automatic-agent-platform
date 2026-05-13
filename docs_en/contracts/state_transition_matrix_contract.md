# State Transition Matrix Contract

> **OAPEFLIR Related**: This contract defines the OAPEFLIR 8-stage state transition matrix, corresponding to ADR-016.
> **Last Updated**: 2026-04-17

## 1. Scope

This contract seals the unified state view for tasks, workflows, sessions, approvals, and execution runs.

It supplements `runtime_state_machine_contract.md` and answers two questions:

- Which state set is the only operational truth source.
- How multiple state machines map to each other and who can drive whom.

## 2. Core Principles

- `HarnessRun.status` is the operational truth source; all task-level "is it still running, has it completed, has it failed" judgments must be derived from it.
- `NodeRun.status` is the node execution truth source; responsible for expressing ready / running / awaiting_hitl / retry_wait / terminal and other execution states.
- `tasks.status`, `workflow_state.status`, `executions.status` are only allowed as read models, compatible projections, or migration inputs, and must not drive truth transition in reverse.
- `sessions.status` only expresses channel interaction state.
- `approvals.status` only expresses approval object state; approval results affect `HarnessRun` / `NodeRun` through state machine commands, not by directly rewriting projection table terminal states.

## 3. Primary State Sources

| Domain | Authoritative State | Purpose |
| --- | --- | --- |
| Execution Main Chain | `HarnessRun.status` | Unique execution-level truth source; determines whether task is active, paused, completed, failed, or aborted |
| Node Execution | `NodeRun.status` | Unique node-level truth source; determines lease, retry, HITL and other execution advancement |
| Approval Object | `approvals.status` | Whether approval itself is pending, approved, rejected, or timed out |
| Session | `sessions.status` | Channel interaction progress |
| Task/Workflow/Execution Read Model | `tasks.status` / `workflow_state.status` / `executions.status` | Query projection, compatible output, historical migration input; must not independently define truth |

For new evolution entities added by OAPEFLIR closed loop, authoritative state is recommended to be split at minimum:

| Domain | Authoritative State | Purpose |
| --- | --- | --- |
| Learning Object | `learning_objects.promotion_status` | Evidence validation, promotion boundary |
| Improvement Candidate | `improvement_candidates.status` | Improve evaluation and approval boundary |
| Release | `release_records.status` | Release stage advancement and blocking |

## 4. Unified Mapping Table

| Trigger Condition | `HarnessRun.status` | `NodeRun.status` | Common Projection | `sessions.status` |
| --- | --- | --- | --- | --- |
| Request accepted but ready node not yet generated | `created / admitted / planning` | `created` | `tasks.status=queued|pending`，`workflow_state.status=pending`，`executions.status=created` | `open` |
| Graph ready and entering execution | `ready / running` | `ready / leased / running` | `tasks.status=in_progress`，`workflow_state.status=running`，`executions.status=executing` | `streaming` or `open` |
| Waiting for approval / human input | `running / paused` | `awaiting_hitl / blocked` | `tasks.status=awaiting_decision`，`workflow_state.status=paused`，`executions.status=blocked` | `awaiting_user` or `paused` |
| Retry wait or recovering | `resuming / replanning / running` | `retry_wait / reconciling / ready / running` | `tasks.status=in_progress`，`workflow_state.status=resuming`，`executions.status=prechecking|executing` | `streaming` or `open` |
| Normal completion | `completed` | `succeeded / skipped` | `tasks.status=done`，`workflow_state.status=completed`，`executions.status=succeeded` | `completed` |
| Execution failed | `failed` | `failed / dependency_failed / policy_blocked / aborted` | `tasks.status=failed`，`workflow_state.status=failed`，`executions.status=failed|cancelled` | `failed` |
| User cancelled or platform aborted | `aborted` | `cancelled / aborted` | `tasks.status=cancelled`，`workflow_state.status=cancelled`，`executions.status=cancelled` | `cancelled` |

Rules:

- `sessions.status` can lag in closure, but must not prematurely declare task completion.
- All projection terminal states must be derived from `HarnessRun.status` / `NodeRun.status`; if projection conflicts with truth, truth prevails and triggers reconstruction.
- After `approvals.status` becomes approved/rejected/timed out, must drive `HarnessRun` / `NodeRun` to continue or terminate through `RuntimeStateMachine.transition(command)`, not directly modify `tasks.status`.
- After `HarnessRun.status` enters `completed / failed / aborted`, it must not directly return to active state by default; if recovery is truly needed, must create new `NodeAttempt`, append `GraphPatch`, or create new `HarnessRun`, must not rewrite old terminal state.

### 4.1 Terminal State and Recovery Boundary

- `completed` is `HarnessRun` successful terminal state, not allowed to be rolled back to active state by normal recovery chain.
- `failed` / `aborted` are `HarnessRun` terminal states; only when explicitly creating new attempt, preserving old evidence, and meeting recovery strategy, is it allowed to derive new active execution chain.
- `cancelled` / `aborted` of `NodeRun` must not continue advancing old node in background.
- `awaiting_hitl` is not terminal state; after recovery must return to active execution chain, not skip approval source fact.

### 4.2 Active Execution Ownership

- At any moment, the same `HarnessRun` allows at most one active `NodeRun` lease to hold a node's advancement right.
- If a new recovery attempt exists, the old attempt must first enter explainable `failed / cancelled / aborted / superseded` closure state.
- Inspect, recovery, and operator tools must be able to see current `HarnessRun`'s active `NodeRun` / `NodeAttempt` ownership.

## 5. Unified State Change Entry

Implementation layer must converge to unified entry, not scatter:

- `RuntimeStateMachine.transition(command)`
- `projectHarnessRunToTaskView(...)`
- `projectNodeRunToWorkflowView(...)`
- `projectNodeRunToExecutionView(...)`
- `transitionSessionStatus(...)`
- `transitionApprovalStatus(...)`

Rules:

- Any state change must carry `reason_code`, `trace_id`, and `updated_at`.
- Truth state can only be rewritten through `RuntimeStateMachine.transition(command)`; if task, workflow, and execution tables need cross-table coordinated advancement, should be updated as same-transaction projection.
- Callers are not allowed to directly scatter SQL to bypass truth transition layer.
- Specific service entry, transaction order, and idempotency requirements take `transition_service_contract.md` as the authoritative document.

## 6. Recovery Semantics

- Recovery logic first judges from `HarnessRun.status` whether execution is still in active lifecycle.
- `NodeRun.status`, `attempt lineage`, and `NodeAttemptReceipt` are used to determine recovery position.
- `tasks.status`, `workflow_state.status`, and `executions.status` are only used for auxiliary positioning query entry, must not serve as recovery truth source.
- `sessions.status` is only used for recovering channel interaction, must not serve as the sole basis for recovering business facts.
- Recovery must not skip `HarnessRun` / `NodeRun` / `NodeAttemptReceipt` fact checks by directly rewriting `tasks.status`.

For OAPEFLIR Phase 1-4 scope, additional requirements:

- `feedback_signals.status` at minimum distinguishes `received / classified / consumed / archived`.
- `learning_objects.promotion_status` at minimum distinguishes `draft / validated / promoted / decayed / archived`.
- `improvement_candidates.status` at minimum distinguishes `proposed / evaluating / accepted / rejected / deployed / rolled_back`.
- `release_records.status` at minimum distinguishes `pending / running / completed / failed / rolled_back`.
- `tasks.status` should not directly replace the above evolution entity states; they respectively answer four different questions: "is the main task complete", "is learning credible", "is improvement approved", "is release cleared".

## 7. Related Documents

- `runtime_state_machine_contract.md`
- `task_and_workflow_contract.md`
- `transition_service_contract.md`
- `storage_schema_contract.md`
- `gateway_streaming_contract.md`

## 8. Conclusion

The core of the state system is not "how many enums", but letting states at different layers each do their job, and always knowing which one is the master state.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs in this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` shall prevail.

- T-12: This document originally wrote `tasks.status / workflow_state.status / executions.status` as authoritative state. The root cause was that early single-machine task table-driven implementation was directly copied into the overall state matrix, and after subsequent `HarnessRun / NodeRun` became truth, the main text did not migrate together. Fix: The main text now defines `HarnessRun.status` / `NodeRun.status` as the only operational truth source; task/workflow/execution is only retained as projection or migration input.

Mandatory Rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.