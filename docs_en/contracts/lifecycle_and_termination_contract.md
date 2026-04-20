# Lifecycle And Termination Contract

## 1. Scope

This contract defines a generic lifecycle template across entities, and unified rules for recording termination reasons.

Related Documents:

- `runtime_state_machine_contract.md`
- `state_transition_matrix_contract.md`
- `transition_service_contract.md`

## 2. Goals

Unify lifecycle commonalities of the following entities:

- task
- workflow
- execution
- approval
- plugin / skill
- feedback_signal
- learning_object
- improvement_candidate
- rollout_record
- strategy_version
- stage_lifecycle_record

And uniformly supplement reason recording for terminal states like failed / cancelled / killed / deprecated.

## 3. Lifecycle Template

Generic template:

- `initial`
- `active`
- `paused`
- `blocked`
- `failed`
- `terminal`

Domain entities may extend their own sub-states on this basis, but must not lose template mapping.

### 3A. OAPEFLIR Stage Lifecycle

`StageLifecycleRecord` minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `task_id` | `string` | Associated task |
| `loop_iteration` | `integer` | Iteration number of closed loop |
| `stage` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release` | Current stage |
| `status` | `pending \| active \| completed \| skipped \| failed \| timed_out` | Stage status |
| `entered_at` | `timestamp` | Entry timestamp |
| `exited_at` | `timestamp?` | Exit timestamp |
| `reason_code` | `string?` | Skip, failure, timeout reason |

Rules:

- Stage status is a drill-down view of workflow lifecycle; does not replace workflow main status.
- `skipped` must have explicit reason; must not be used as alias for failure.
- `timed_out` must preserve corresponding evidence or alert reference to runtime execution.

### 3B. Rollout Lifecycle

`RolloutRecord` lifecycle minimum enumeration:

- `pending`
- `running`
- `completed`
- `rolled_back`
- `failed`

Rollout level within current phase1-4 authoritative scope only allows:

- `off`
- `suggest`
- `shadow`

Rules:

- Rollout level and rollout status are two dimensions; must not be mixed into one single status field.
- Any rollout terminal state must leave metrics / approval / policy lineage.
- `canary / partial / stable` belong to design target states; if not currently enabled, must not impersonate as implemented authoritative running level in contract.

## 4. Pause And Block Semantics

- `queued`: Not yet started
- `blocked`: Dependencies unmet or external conditions unmet
- `paused`: Actively paused; has recoverable context
- `waiting_input`: Waiting for human or external input
- `throttled`: Suspended due to rate limiting / backpressure
- `suspended`: System-level freeze
- `draining`: Worker or subsystem is draining current execution; no longer accepting new task dispatch

`draining` rules:

- `draining` is a worker-level lifecycle status, not a task or execution status.
- Worker entering `draining` must complete executions with held lease (or actively handover); must not accept new dispatch tickets.
- After `draining` completes, worker enters `offline` or is deregistered; does not directly enter `active`.
- Typical trigger scenarios: rolling upgrade (`upgrade_migration`), load rebalance (`load_rebalance`), operator-initiated shutdown (`operator_drain`).
- `draining` must coordinate with lease handover semantics in `task_lease_and_fencing_contract.md` to ensure orderly transfer of execution authority.

## 5. `TerminationRecord`

| Field | Type | Description |
| --- | --- | --- |
| `termination_reason_code` | `string` | Termination reason code |
| `termination_initiator` | `user \| agent \| system \| scheduler \| admin` | Who triggered |
| `termination_scope` | `unit \| task_tree \| workflow \| tenant \| system` | Impact scope |
| `recoverable` | `boolean` | Whether recoverable |
| `terminated_at` | `timestamp` | Termination timestamp |

## 5A. LearningObject / ImprovementCandidate Lifecycle

`LearningObjectStatus` minimum enumeration:

- `draft`
- `validated`
- `promoted`
- `decayed`
- `archived`

`ImprovementCandidateStatus` minimum enumeration:

- `proposed`
- `evaluating`
- `accepted`
- `rejected`
- `deployed`
- `rolled_back`

Rules:

- Learning object's `promoted` only indicates it entered reusable pool; does not equal auto-publishing to running policy.
- Improvement candidate's `accepted` does not equal deployed; before entering release still needs rollout / policy / approval constraints.
- `rolled_back` must preserve lineage to original candidate or strategy version; must not only leave traces in logs.

## 6. Closure Conclusion

Lifecycle template unification and termination reason standardization can significantly reduce status definition fragmentation, troubleshooting difficulty, and UI display confusion.