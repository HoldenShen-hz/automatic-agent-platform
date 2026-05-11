# Lifecycle And Termination Contract

## 1. Scope

This contract defines a common lifecycle template across entities and unified rules for recording termination reasons.

Related documents:

- `runtime_state_machine_contract.md`
- `state_transition_matrix_contract.md`
- `transition_service_contract.md`

## 2. Objectives

Unify lifecycle commonalities for the following entities:

- harness_run
- node_run
- node_attempt
- task_view
- workflow_view
- approval
- plugin / skill
- feedback_signal
- learning_object
- improvement_candidate
- release_record
- strategy_version
- stage_lifecycle_record

And unify the completion of reason records for terminal states such as failed / cancelled / killed / deprecated.

## 3. Lifecycle Template

The common template is only allowed to serve as projection groupings and must not replace truth state enumerations:

- `created_like`
- `active_like`
- `waiting_like`
- `terminal_like`

Domain entities may perform projection mappings on this basis, but truth states must maintain their own canonical enumerations.

### 3.1 HarnessRun Truth Lifecycle

`HarnessRun.status` canonical states:

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
- `aborted`

Terminal states: `completed / failed / aborted`.

### 3.2 NodeRun Truth Lifecycle

`NodeRun.status` canonical states:

- `created`
- `ready`
- `leased`
- `running`
- `retry_wait`
- `awaiting_hitl`
- `reconciling`
- `succeeded`
- `failed`
- `skipped`
- `cancelled`
- `dependency_failed`
- `policy_blocked`
- `aborted`

Terminal states: `succeeded / failed / skipped / cancelled / dependency_failed / policy_blocked / aborted`.

Rules:

- `retry_wait`, `awaiting_hitl`, and `reconciling` are waiting states; they must not be flattened into a generalized `blocked` and lose semantics.
- `leased` is an execution rights state; it cannot be replaced by an `active` projection and then reversely drive lease/fencing logic.
- All truth state transitions must still go through `RuntimeStateMachine.transition(command)`.

### 3A. OAPEFLIR Stage Lifecycle

`StageLifecycleRecord` minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `harness_run_id` | `string` | Associated HarnessRun |
| `task_id` | `string?` | Associated task query entry |
| `loop_iteration_view` | `integer` | Which round of closed-loop view |
| `stage_view_ref` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release` | Current stage view |
| `status` | `pending \| active \| completed \| skipped \| failed \| timed_out` | Stage status |
| `entered_at` | `timestamp` | Entry time |
| `exited_at` | `timestamp?` | Exit time |
| `reason_code` | `string?` | Skip, failure, or timeout reason |

Rules:

- Stage status is a drill-down view of `HarnessRun` / workflow projections and does not replace `HarnessRun` or `NodeRun` primary status.
- `skipped` must have an explicit reason and must not be used as an alias for failure.
- `timed_out` must preserve the corresponding evidence or alert reference to runtime execution.

### 3B. Release Lifecycle

`ReleaseRecord` lifecycle minimum enumeration:

- `pending`
- `running`
- `completed`
- `rolled_back`
- `failed`

Release levels within the current phase1-4 authoritative boundary only allow:

- `off`
- `suggest`
- `shadow`

Rules:

- Release level and release status are two separate dimensions and must not be conflated into a single status field.
- Any release terminal state must leave behind metrics / approval / policy lineage.
- `canary / partial / stable` belong to design target states; if not currently enabled, they must not be masqueraded as implemented authoritative runtime levels in the contract.

## 4. Pause and Blocking Semantics

- `queued`: Not yet started
- `blocked`: Dependencies not satisfied or external conditions not met
- `paused`: Actively paused with recoverable context
- `waiting_input`: Waiting for human or external input
- `throttled`: Suspended due to rate limiting / backpressure
- `suspended`: System-level freeze
- `draining`: Worker or subsystem is draining current execution and no longer accepting new task dispatches

`draining` rules:

- `draining` is a worker-level lifecycle state, not a task or execution state.
- A worker entering `draining` must complete its currently held lease execution (or actively hand over) and must not accept new dispatch tickets.
- After `draining` completes, the worker enters `offline` or is deregistered and does not directly enter `active`.
- Typical trigger scenarios: rolling upgrades (`upgrade_migration`), load rebalancing (`load_rebalance`), operator-initiated decommission (`operator_drain`).
- `draining` must coordinate with the lease handover semantics in `task_lease_and_fencing_contract.md` to ensure orderly transfer of execution rights.

## 5. `TerminationRecord`

| Field | Type | Description |
| --- | --- | --- |
| `termination_reason_code` | `string` | Termination reason code |
| `termination_initiator` | `user \| agent \| system \| scheduler \| admin` | Who triggered it |
| `termination_scope` | `node \| run \| task_tree \| tenant \| region \| platform` | Impact scope |
| `recoverable` | `boolean` | Whether recoverable |
| `terminated_at` | `timestamp` | Termination time |

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

- `promoted` for a learning object only indicates it has entered the reusable pool and does not mean automatic release to runtime policy.
- `accepted` for an improvement candidate does not equal deployed; it still requires release / policy / approval constraints before entering release.
- `rolled_back` must preserve lineage pointing to the original candidate or strategy version and must not only leave traces in logs.

## 6. Conclusion

Lifecycle templating and unified termination reason recording can significantly reduce state definition fragmentation, troubleshooting difficulties, and UI display inconsistencies.

## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If any historical section of this document conflicts with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-21: This document previously used `initial / active / paused / blocked / failed / terminal` as a generalized template covering all objects. The root cause was an early attempt to unify UI lifecycle display, but the projection template was mistakenly written as runtime truth. Fix: The main text now demotes the template to `created_like / active_like / waiting_like / terminal_like` projection groupings and explicitly writes back the full canonical state sets for `HarnessRun.status` and `NodeRun.status`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only serve as `oapeflir.view.*` / rationale projections; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.