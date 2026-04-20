# State Transition Matrix Contract

> **OAPEFLIR Related**: This contract defines the OAPEFLIR 8-stage state transition matrix, corresponding to ADR-016.
> **Last Updated**: 2026-04-17

## 1. Scope

This contract closes the unified state view for tasks, workflows, sessions, approvals, and execution runs.

It supplements `runtime_state_machine_contract.md`, answering two questions:

- Which state is the sole user primary state.
- How multiple state machines map to each other, and who can drive whom.

## 2. Core Principles

- `tasks.status` is the sole user primary state.
- `workflow_state.status` only expresses execution state, does not directly serve as user final state.
- `sessions.status` only expresses channel interaction state.
- `approvals.status` only expresses approval object state.
- `executions.status` only expresses runtime run lifecycle.

## 3. Primary State Sources

| Domain | Authoritative State | Purpose |
| --- | --- | --- |
| User Task | `tasks.status` | User primary state, list and query main entry |
| Workflow | `workflow_state.status` | Workflow progression within division |
| Session | `sessions.status` | Channel interaction progress |
| Approval | `approvals.status` | Manual decision progress |
| Execution | `executions.status` | Runtime execution stage |

For OAPEFLIR closed-loop emerging entities, authoritative state is recommended to be split at minimum:

| Domain | Authoritative State | Purpose |
| --- | --- | --- |
| Learning Object | `learning_objects.promotion_status` | Evidence verification, promotion boundary |
| Improvement Candidate | `improvement_candidates.status` | Improve evaluation and approval boundary |
| Rollout | `rollout_records.status` | Release stage progression and blocking |

## 4. Unified Mapping Table

| Trigger Condition | `tasks.status` | `workflow_state.status` | `sessions.status` | `executions.status` |
| --- | --- | --- | --- | --- |
| Task created not started | `queued` / `pending` | none | `open` | none |
| Workflow started execution | `in_progress` | `running` | `streaming` or `open` | `created / prechecking / executing` |
| Waiting for approval / manual input | `awaiting_decision` | `paused` | `awaiting_user` or `paused` | `blocked` |
| Resuming | `in_progress` | `resuming` | `streaming` or `open` | `prechecking / executing` |
| Normal completion | `done` | `completed` | `completed` | `succeeded` |
| Execution failed | `failed` | `failed` | `failed` | `failed` or `cancelled` |
| User cancelled | `cancelled` | `cancelling / cancelled` | `cancelled` | `cancelled` |

Rules:

- `sessions.status` can lag behind in closure, but must not prematurely announce task completion.
- When `workflow_state.status=completed`, `tasks.status` must enter `done` within same transaction or same recovery logic.
- When `executions.status=blocked` and reason is approval, `tasks.status` must be `awaiting_decision`.
- After `tasks.status` enters `done / failed / cancelled`, by default must not directly return to active state; if recovery is truly needed, must undertake through new execution attempt or explicit repair action, not rewrite old terminal state.

### 4.1 Terminal State and Recovery Boundary

- `done` is business success terminal state, not allowed to be reverted to `in_progress` by ordinary recovery chain.
- `failed` is failure terminal state, only allowed to enter new active execution when clearly creating new attempt and preserving failure evidence.
- `cancelled` is cancellation terminal state, does not allow background to continue advancing old step.
- `awaiting_decision` is not terminal state; after recovery must return to active execution chain, not skip approval source facts.

### 4.2 Active Execution Ownership

- Same `task` in single-machine Stable Core stage, at any moment only one active `execution` is allowed to hold progression rights.
- If new recovery execution exists, old execution must first enter explainable `cancelled / failed / dead-letter / superseded` closure state.
- inspect, recovery, and operator tools must be able to see current task's active execution ownership.

## 5. Unified State Transition Entry

Implementation layer must converge to unified entry, not scatter writes:

- `transitionTaskStatus(...)`
- `transitionWorkflowStatus(...)`
- `transitionSessionStatus(...)`
- `transitionApprovalStatus(...)`
- `transitionExecutionStatus(...)`
- `transitionBlockedForApproval(...)`
- `transitionTaskTerminalState(...)`

Rules:

- Any state change must carry `reason_code`, `trace_id`, and `updated_at`.
- When cross-table coordinated progression is needed, prioritize completing through aggregated transition function.
- Callers are not allowed to directly scatter-write SQL bypassing transition layer.
- Specific service entry, transaction order, and idempotency requirements are governed by drill-down document `transition_service_contract.md`.

## 6. Recovery Semantics

- Recovery logic first judges whether still in active lifecycle based on `tasks.status`.
- `workflow_state.status` and `executions.status` are used to determine recovery position.
- `sessions.status` is only used for recovering channel interaction, must not be sole basis for recovering business facts.
- Recovery must not skip `workflow_state` and `executions` fact checks by directly rewriting `tasks.status`.

For OAPEFLIR Phase 1-4 scope, additional requirements:

- `feedback_signals.status` must distinguish at minimum `received / classified / consumed / archived`.
- `learning_objects.promotion_status` must distinguish at minimum `draft / validated / promoted / decayed / archived`.
- `improvement_candidates.status` must distinguish at minimum `proposed / evaluating / accepted / rejected / deployed / rolled_back`.
- `rollout_records.status` must distinguish at minimum `pending / running / completed / failed / rolled_back`.
- `tasks.status` should not directly replace above emerging entity states; they respectively answer four different questions: "is main task completed", "is learning credible", "is improvement approved", "is release cleared".

## 7. Related Documents

- `runtime_state_machine_contract.md`
- `task_and_workflow_contract.md`
- `transition_service_contract.md`
- `storage_schema_contract.md`
- `gateway_streaming_contract.md`

## 8. Closure Conclusion

Core of state system is not "how many enums", but making different layers' states each serve their purpose, and always knowing who is the primary state.
