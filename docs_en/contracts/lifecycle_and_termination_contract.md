# Lifecycle And Termination Contract

## 1. Scope

This contract defines the common lifecycle template across entities and unified rules for recording termination reasons.

Related documents:

- `runtime_state_machine_contract.md`
- `state_transition_matrix_contract.md`
- `transition_service_contract.md`

## 2. Goals

Unify lifecycle commonality of the following entities:

- task
- workflow
- execution
- approval
- plugin / skill

And unify reason recording for terminal states such as failed / cancelled / killed / deprecated.

## 3. Lifecycle Template

Common template:

- `initial`
- `active`
- `paused`
- `blocked`
- `failed`
- `terminal`

Domain entities can extend their own sub-division states on this basis, but must not lose template mapping.

## 4. Pause and Block Semantics

- `queued`: Not yet started
- `blocked`: Dependencies not met or external conditions not met
- `paused`: Actively paused with recoverable context
- `waiting_input`: Waiting for human or external input
- `throttled`: Suspended due to rate limiting / backpressure
- `suspended`: System-level freeze
- `draining`: Worker or subsystem is draining current execution, no longer accepting new task dispatch

`draining` rules:

- `draining` is a worker-level lifecycle state, not a task or execution state.
- Worker entering `draining` must complete execution of already held lease (or actively handover) and must not accept new dispatch ticket.
- After `draining` completes, worker enters `offline` or is deregistered, does not directly enter `active`.
- Typical trigger scenarios: rolling upgrade (`upgrade_migration`), load rebalance (`load_rebalance`), operator-initiated drain.
- `draining` must coordinate with lease handover semantics in `task_lease_and_fencing_contract.md` to ensure orderly transfer of execution rights.

## 5. `TerminationRecord`

| Field | Type | Description |
| --- | --- | --- |
| `termination_reason_code` | `string` | Termination reason code |
| `termination_initiator` | `user \| agent \| system \| scheduler \| admin` | Who triggered |
| `termination_scope` | `unit \| task_tree \| workflow \| tenant \| system` | Impact scope |
| `recoverable` | `boolean` | Whether recoverable |
| `terminated_at` | `timestamp` | Termination time |

## 6. Closure