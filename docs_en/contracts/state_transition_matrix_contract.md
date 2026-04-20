# State Transition Matrix Contract

## 1. Scope

This contract closes the unified state view of tasks, workflows, sessions, approvals, and execution runs.

It supplements `runtime_state_machine_contract.md` to answer two questions:

- Which state is the only user primary state.
- How multiple state machines map to each other and who can drive whom.

## 2. Core Principles

- `tasks.status` is the only user primary state.
- `workflow_state.status` only expresses execution state and does not directly serve as user final state.
- `sessions.status` only expresses channel interaction state.
- `approvals.status` only expresses approval object state.
- `executions.status` only expresses runtime run lifecycle.

## 3. Primary State Source

| Domain | Authoritative State | Role |
| --- | --- | --- |
| User task | `tasks.status` | User primary state, list and query primary entry |
| Workflow | `workflow_state.status` | Division inner workflow progression |
| Session | `sessions.status` | Channel interaction progress |
| Approval | `approvals.status` | Human decision progress |
| Execution | `executions.status` | Runtime execution stage |

## 4. Unified Mapping Table

| Trigger Condition | `tasks.status` | `workflow_state.status` | `sessions.status` | `executions.status` |
| --- | --- | --- | --- | --- |
| Task created not started | `queued` / `pending` | none | `open` | none |
| Workflow starts executing | `in_progress` | `running` | `streaming` or `open` | `created / prechecking / executing` |
| Waiting approval/human input | `awaiting_decision` | `paused` | `awaiting_user` or `paused` | `blocked` |
| Recovering | `in_progress` | `resuming` | `streaming` or `open` | `prechecking / executing` |
| Normally completed | `done` | `completed` | `completed` | `succeeded` |
| Execution failed | `failed` | `failed` | `failed` | `failed` or `cancelled` |
| User cancelled | `cancelled` | `cancelling / cancelled` | `cancelled` | `cancelled` |

Rules:

- `sessions.status` can lag closure but must not prematurely announce task completion.
- When `workflow_state.status=completed`, `tasks.status` must enter `done` within same transaction or same recovery logic.
- When `executions.status=blocked` and reason is approval, `tasks.status` must be `awaiting_decision`.
- After `tasks.status` enters `done / failed / cancelled`, default must not directly return to active state; if recovery is truly needed, must be undertaken by new execution attempt or explicit repair action rather than rewriting old terminal state.

### 4.1 Terminal State and Recovery Boundary

- `done` is business success terminal state and must not be reverted to `in_progress` by ordinary recovery chain.
- `failed` is failure terminal state; only allowed to enter new active execution when explicitly creating new attempt and retaining failure evidence.
- `cancelled` is cancellation terminal state and must not allow backend to continue advancing old step.
- `awaiting_decision` is not terminal state; after recovery must return to active execution chain and must not skip approval source fact.

### 4.2 Active Execution Ownership

- At any moment, same `task` in single-machine Stable Core phase allows at most one active `execution` to hold advancement rights.
- If new recovery execution exists, old execution must first enter explicable `cancelled / failed / dead-letter / superseded` closure state.
- inspect, recovery, and operator tools must be able to see current task's active execution ownership.

## 5. Unified State Transition Entry

Implementation layer must converge to unified entry rather than scattered writes:

- `transitionTaskStatus(...)`
- `transitionWorkflowStatus(...)`
- `transitionSessionStatus(...)`
- `transitionApprovalStatus(...)`
- `transitionExecutionStatus(...)`
- `transitionBlockedForApproval(...)`
- `transitionTaskTerminalState(...)`

Rules:

- Any state transition must carry `reason_code`, `trace_id`, and `updated_at`.
- When cross-table coordinated progression is needed, prioritize completing through aggregate transition function.
- Callers must not directly scatter-write SQL bypassing transition layer.
- Specific service entry, transaction order, and idempotency requirements are detailed in `transition_service_contract.md`.

## 6. Recovery Semantics

- Recovery logic first judges whether still in active lifecycle based on `tasks.status`.
- `workflow_state.status` and `executions.status` are used to determine recovery position.
- `sessions.status` only used for recovering channel interaction and must not be the sole basis for recovering business fact.
- Recovery must not rewrite `tasks.status` to skip `workflow_state` and `executions` fact checks.

## 7. Related Documents

- `runtime_state_machine_contract.md`
- `task_and_workflow_contract.md`
- `transition_service_contract.md`
- `storage_schema_contract.md`
- `gateway_streaming_contract.md`

## 8. Closure Conclusion

The core of state system is not "how many enumerations" but letting states at different layers each perform their duties and always knowing which one is the primary state.
