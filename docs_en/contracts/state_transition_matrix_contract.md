# State Transition Matrix Contract

> **OAPEFLIR related**: This contract defines the OAPEFLIR 8-stage state transition matrix, corresponding to ADR-016.
> **Last updated**: 2026-04-17

## 1. Scope

This contract closes the unified status view for tasks, workflows, sessions, approvals, and execution runs.

It supplements `runtime_state_machine_contract.md` and answers two questions:

- Which set of statuses is the sole source of operational truth.
- How multiple state machines map to each other and who can drive whom.

## 2. Core Principles

- `HarnessRun.status` is the source of operational truth; all task-level judgments of "is it still running, is it completed, is it failed" must be derived from it.
- `NodeRun.status` is the source of node execution truth, responsible for expressing execution states such as ready / running / awaiting_hitl / retry_wait / terminal.
- `tasks.status`, `workflow_state.status`, `executions.status` are only permitted as read models, compatible projections, or migration inputs; must not reverse-drive truth transitions.
- `sessions.status` only expresses channel interaction state.
- `approvals.status` only expresses approval object status; approval results drive `HarnessRun` / `NodeRun` through state machine commands, not by directly rewriting projection table terminal states.

## 3. Primary Status Sources

| Domain | Authoritative Status | Role |
|---|---|---|
| Execution main chain | `HarnessRun.status` | Sole operational-level source of truth, determines if task is active, paused, completed, failed, or aborted |
| Node execution | `NodeRun.status` | Sole node-level source of truth, determines lease, retry, HITL, and other execution advances |
| Approval object | `approvals.status` | Whether approval itself is pending, approved, rejected, or timed out |
| Session | `sessions.status` | Channel interaction progress |
| Task/workflow/execution read model | `tasks.status` / `workflow_state.status` / `executions.status` | Query projection, compatible output, historical migration input; must not independently define truth |

For evolution entities newly added to OAPEFLIR closed loop, authoritative status is recommended to be split at least:

| Domain | Authoritative Status | Role |
|---|---|---|
| Learning object | `learning_objects.promotion_status` | Evidence validation, promotion boundary |
| Improvement candidate | `improvement_candidates.status` | Improve evaluation and approval boundary |
| Release | `release_records.status` | Release phase advance and gate |

## 4. Unified Mapping Table

| Trigger Condition | `HarnessRun.status` | `NodeRun.status` | Common Projections | `sessions.status` |
|---|---|---|---|
| Request admitted but ready node not yet generated | `created / admitted / planning` | `created` | `tasks.status=queued|pending`, `workflow_state.status=pending`, `executions.status=created` | `open` |
| Graph ready and entering execution | `ready / running` | `ready / leased / running` | `tasks.status=in_progress`, `workflow_state.status=running`, `executions.status=executing` | `streaming` or `open` |
| Waiting for approval / human input | `running / paused` | `awaiting_hitl / blocked` | `tasks.status=awaiting_decision`, `workflow_state.status=paused`, `executions.status=blocked` | `awaiting_user` or `paused` |
| Retry wait or recovering | `resuming / replanning / running` | `retry_wait / reconciling / ready / running` | `tasks.status=in_progress`, `workflow_state.status=resuming`, `executions.status=prechecking|executing` | `streaming` or `open` |
| Normal completion | `completed` | `succeeded / skipped` | `tasks.status=done`, `workflow_state.status=completed`, `executions.status=succeeded` | `completed` |
| Execution failed | `failed` | `failed / dependency_failed / policy_blocked / aborted` | `tasks.status=failed`, `workflow_state.status=failed`, `executions.status=failed|cancelled` | `failed` |
| User cancelled or platform aborted | `aborted` | `cancelled / aborted` | `tasks.status=cancelled`, `workflow_state.status=cancelled`, `executions.status=cancelled` | `cancelled` |

Rules:

- `sessions.status` may lag closure but must not prematurely announce task completion.
- All projection terminal states must be derived from `HarnessRun.status` / `NodeRun.status`; if projection conflicts with truth, truth prevails and triggers rebuild.
- When `approvals.status` changes to approved / rejected / timed out, must drive `HarnessRun` / `NodeRun` to continue advancing or terminate through `RuntimeStateMachine.transition(command)`, not directly modify `tasks.status`.
- After `HarnessRun.status` enters `completed / failed / aborted`, it must not by default return to active state; if recovery is truly needed, must create new `NodeAttempt`, append `GraphPatch`, or create new `HarnessRun`; must not rewrite old terminal state.

### 4.1 Terminal State and Recovery Boundary

- `completed` is `HarnessRun` success terminal state and must not be rolled back to active state by normal recovery chain.
- `failed` / `aborted` are `HarnessRun` terminal states; new active execution chain is only permitted to derive when explicitly creating new attempt, preserving old evidence, and satisfying recovery policy.
- `cancelled` / `aborted` `NodeRun` must not continue advancing old nodes in background.
- `awaiting_hitl` is not a terminal state; after recovery must return to active execution chain, not skip approval source facts.

### 4.2 Active Execution Ownership

- At any moment, a single `HarnessRun` permits at most one active `NodeRun` lease to hold advancement rights for a node.
- If a new recovery attempt exists, old attempt must first enter explicable closure state: `failed / cancelled / aborted / superseded`.
- Inspect, recovery, and operator tools must be able to see current `HarnessRun`'s active `NodeRun` / `NodeAttempt` ownership.

## 5. Unified Status Change Entry Point

Implementation layer must converge to unified entry, not scattered writes:

- `RuntimeStateMachine.transition(command)`
- `projectHarnessRunToTaskView(...)`
- `projectNodeRunToWorkflowView(...)`
- `projectNodeRunToExecutionView(...)`
- `transitionSessionStatus(...)`
- `transitionApprovalStatus(...)`

Rules:

- Any status change must carry `reason_code`, `trace_id`, and `updated_at`.
- Truth status can only be rewritten through `RuntimeStateMachine.transition(command)`; tasks, workflows, and execution tables that need cross-table coordinated advancement should be updated as same-transaction projections.
- Callers must not directly write SQL to bypass truth transition layer.
- For specific service entry points, transaction ordering, and idempotency requirements, refer to drill-down document `transition_service_contract.md`.

## 6. Recovery Semantics

- Recovery logic first judges whether execution is still in active lifecycle based on `HarnessRun.status`.
- `NodeRun.status`, `attempt lineage`, and `NodeAttemptReceipt` are used to determine recovery position.
- `tasks.status`, `workflow_state.status`, and `executions.status` are only used for auxiliary location queries and must not serve as recovery truth source.
- `sessions.status` is only used for recovering channel interaction and must not serve as sole basis for recovering business facts.
- Recovery must not skip `HarnessRun` / `NodeRun` / `NodeAttemptReceipt` fact checks by directly rewriting `tasks.status`.

For OAPEFLIR Phase 1-4 scope, additional requirements:

- `feedback_signals.status` must distinguish at least `received / classified / consumed / archived`.
- `learning_objects.promotion_status` must distinguish at least `draft / validated / promoted / decayed / archived`.
- `improvement_candidates.status` must distinguish at least `proposed / evaluating / accepted / rejected / deployed / rolled_back`.
- `release_records.status` must distinguish at least `pending / running / completed / failed / rolled_back`.
- `tasks.status` must not directly replace these evolution entity statuses; they respectively answer four different questions: "is main task completed", "is learning trustworthy", "is improvement approved", "is release cleared".

## 7. Related Documents

- `runtime_state_machine_contract.md`
- `task_and_workflow_contract.md`
- `transition_service_contract.md`
- `storage_schema_contract.md`
- `gateway_streaming_contract.md`

## 8. Closure Conclusion

The core of a status system is not "how many enums are there," but making statuses at different layers each do their job, and always knowing who is the primary status.

## v4.3 Architecture Remediation

This section fixes contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If any historical section of this document conflicts with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-12: This document originally wrote `tasks.status / workflow_state.status / executions.status` as authoritative status. Root cause: Early single-machine task-table-driven implementation was directly copied into the overall status matrix; after `HarnessRun / NodeRun` became truth, the main text was not migrated together. Fix: This version now defines `HarnessRun.status` / `NodeRun.status` as the sole source of operational truth; tasks / workflows / executions are retained only as projections or migration inputs.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.