# State Transition Matrix Contract

> **OAPEFLIR Related**: This contract defines the OAPEFLIR 8-stage state transition matrix, corresponding to ADR-016.
> **Update Date**: 2026-04-17

## 1. Scope

This contract closes the unified state view for tasks, workflows, sessions, approvals, and execution runs.

It complements `runtime_state_machine_contract.md`, answering two questions:

- Which state set is the sole source of runtime truth.
- How multiple state machines map to each other, and who can drive whom.

## 2. Core Principles

- `HarnessRun.status` is the source of runtime truth; all task-level "is it still running, is it completed, is it failed" judgments must be derived from it.
- `NodeRun.status` is the source of node execution truth; responsible for expressing ready/running/awaiting_hitl/retry_wait/terminal and other execution states.
- `tasks.status`, `workflow_state.status`, `executions.status` are only permitted as read models, compatible projections, or migration inputs, must not retroactively drive truth transition.
- `sessions.status` only expresses channel interaction state.
- `approvals.status` only expresses the approval object state; approval results affect `HarnessRun` / `NodeRun` through state machine commands, not by directly rewriting projection table terminal states.

## 3. Primary State Sources

| Domain | Authoritative State | Purpose |
| --- | --- | --- |
| Execution main chain | `HarnessRun.status` | Sole execution-level source of truth, determines whether task is active, paused, completed, failed, or aborted |
| Node execution | `NodeRun.status` | Sole node-level source of truth, determines lease, retry, HITL, etc. execution progression |
| Approval object | `approvals.status` | Whether approval itself is pending, approved, rejected, expired |
| Session | `sessions.status` | Channel interaction progress |
| Task/workflow/execution read model | `tasks.status` / `workflow_state.status` / `executions.status` | Query projection, compatible output, historical migration input; must not independently define truth |

For OAPEFLIR closed-loop emerging entities, authoritative state is recommended to be split at minimum:

| Domain | Authoritative State | Purpose |
| --- | --- | --- |
| Learning object | `learning_objects.promotion_status` | Evidence validation, promotion boundary |
| Improvement candidate | `improvement_candidates.status` | Improve evaluation and approval boundary |
| Release | `release_records.status` | Release stage progression and blocking |

## 4. Unified Mapping Table

| Trigger Condition | `HarnessRun.status` | `NodeRun.status` | Common Projections | `sessions.status` |
| --- | --- | --- | --- | --- |
| Request admitted but ready node not yet generated | `created / admitted / planning` | `created` | `tasks.status=queued|pending`, `workflow_state.status=pending`, `executions.status=created` | `open` |
| Graph ready and entering execution | `ready / running` | `ready / leased / running` | `tasks.status=in_progress`, `workflow_state.status=running`, `executions.status=executing` | `streaming` or `open` |
| Waiting for approval/human input | `running / paused` | `awaiting_hitl / blocked` | `tasks.status=awaiting_decision`, `workflow_state.status=paused`, `executions.status=blocked` | `awaiting_user` or `paused` |
| Retry waiting or recovering | `resuming / replanning / running` | `retry_wait / reconciling / ready / running` | `tasks.status=in_progress`, `workflow_state.status=resuming`, `executions.status=prechecking|executing` | `streaming` or `open` |
| Normal completion | `completed` | `succeeded / skipped` | `tasks.status=done`, `workflow_state.status=completed`, `executions.status=succeeded` | `completed` |
| Execution failed | `failed` | `failed / dependency_failed / policy_blocked / aborted` | `tasks.status=failed`, `workflow_state.status=failed`, `executions.status=failed|cancelled` | `failed` |
| User canceled or platform aborted | `aborted` | `cancelled / aborted` | `tasks.status=cancelled`, `workflow_state.status=cancelled`, `executions.status=cancelled` | `cancelled` |

Rules:

- `sessions.status` may lag in closing, but must not prematurely announce task completion.
- All projected terminal states must be derived from `HarnessRun.status` / `NodeRun.status`; if projection conflicts with truth, truth prevails and triggers rebuild.
- After `approvals.status` becomes approved/rejected/expired, must drive `HarnessRun` / `NodeRun` to continue or terminate through `RuntimeStateMachine.transition(command)`, not directly modify `tasks.status`.
- After `HarnessRun.status` enters `completed / failed / aborted`, must not by default return to active state; if recovery is truly needed, must create new `NodeAttempt`, append `GraphPatch`, or create new `HarnessRun`, must not rewrite old terminal state.

### 4.1 Terminal State and Recovery Boundary

- `completed` is `HarnessRun` successful terminal state, not allowed to be rolled back to active state by normal recovery chain.
- `failed` / `aborted` are `HarnessRun` terminal states; only when explicitly creating new attempt, preserving old evidence, and satisfying recovery strategy, may derive new active execution chain.
- `cancelled` / `aborted` `NodeRun` must not continue advancing old node in background.
- `awaiting_hitl` is not a terminal state; after recovery must return to active execution chain, must not skip the approval source fact.

### 4.2 Active Execution Ownership

- At any moment, a single `HarnessRun` allows at most one active `NodeRun` lease to hold a node's advancement right.
- If a new recovery attempt exists, old attempt must first enter explicable `failed / cancelled / aborted / superseded` closure state.
- inspect, recovery, and operator tools must be able to see current `HarnessRun`'s active `NodeRun` / `NodeAttempt` ownership.

## 5. Unified State Change Entry Points

Implementation layer must converge to unified entry, not scatter writes:

- `RuntimeStateMachine.transition(command)`
- `projectHarnessRunToTaskView(...)`
- `projectNodeRunToWorkflowView(...)`
- `projectNodeRunToExecutionView(...)`
- `transitionSessionStatus(...)`
- `transitionApprovalStatus(...)`

Rules:

- Each state change must carry `reason_code`, `trace_id`, and `updated_at`.
- Truth state can only be modified through `RuntimeStateMachine.transition(command)`; if task, workflow, and execution tables need cross-table coordinated progression, should be as same-transaction projection updates.
- Callers must not directly scatter write SQL to bypass truth transition layer.
- Specific service entry points, transaction order, and idempotency requirements are governed by drilling document `transition_service_contract.md`.

## 6. Recovery Semantics

- Recovery logic first judges from `HarnessRun.status` whether execution is still in active lifecycle.
- `NodeRun.status`, `attempt lineage`, and `NodeAttemptReceipt` are used to determine recovery position.
- `tasks.status`, `workflow_state.status`, and `executions.status` are only used for auxiliary location query entry, must not be used as recovery truth source.
- `sessions.status` is only used for recovering channel interaction, must not be used as sole basis for recovering business facts.
- Recovery must not skip `HarnessRun` / `NodeRun` / `NodeAttemptReceipt` fact checks by directly rewriting `tasks.status`.

For OAPEFLIR Phase 1-4 scope, additional requirements:

- `feedback_signals.status` must distinguish at minimum `received / classified / consumed / archived`.
- `learning_objects.promotion_status` must distinguish at minimum `draft / validated / promoted / decayed / archived`.
- `improvement_candidates.status` must distinguish at minimum `proposed / evaluating / accepted / rejected / deployed / rolled_back`.
- `release_records.status` must distinguish at minimum `pending / running / completed / failed / rolled_back`.
- `tasks.status` must not directly replace the above emerging entity states; they respectively answer four different questions: "is the main task completed", "is learning credible", "is improvement approved", "is release cleared".

## 7. Related Documents

- `runtime_state_machine_contract.md`
- `task_and_workflow_contract.md`
- `transition_service_contract.md`
- `storage_schema_contract.md`
- `gateway_streaming_contract.md`

## 8. Closing Conclusion

The core of the state system is not "how many enums are there", but having different layers of state each serve their own purpose, and always knowing who is the primary state.


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical paragraphs conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-12: This document previously wrote `tasks.status / workflow_state.status / executions.status` as authoritative state. The root cause was early single-machine task-table-driven implementation was directly copied into the general state matrix, and after `HarnessRun / NodeRun` became truth, the main text did not migrate together. Fix: The main text now defines `HarnessRun.status` / `NodeRun.status` as the sole execution truth source; task/workflow/execution are only retained as projection or migration input.

Mandatory Rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR must only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.