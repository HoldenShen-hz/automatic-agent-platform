# Lifecycle And Termination Contract

## 1. Scope

This contract defines the universal lifecycle template across entities and the unified rules for recording termination reasons.

Related documents:

- `runtime_state_machine_contract.md`
- `state_transition_matrix_contract.md`
- `transition_service_contract.md`

## 2. Objectives

Unify lifecycle commonality for the following entities:

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

And uniformly supplement termination reason records for terminal states such as failed / cancelled / killed / deprecated.

## 3. Lifecycle Template

The universal template is only allowed as a projection grouping and must not replace truth state enumerations:

- `created_like`
- `active_like`
- `waiting_like`
- `terminal_like`

Domain entities may perform projection mapping on this basis, but truth states must maintain their respective canonical enumerations.

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

- `retry_wait`, `awaiting_hitl`, and `reconciling` are waiting states and must not be flattened into a generalized `blocked` state and lose semantics.
- `leased` is an execution rights state and must not be replaced by an `active` projection and then reversely drive lease/fencing logic.
- All truth state transitions must still go through `RuntimeStateMachine.transition(command)`.

### 3A. OAPEFLIR Stage Lifecycle

`StageLifecycleRecord` minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `harness_run_id` | `string` | Associated HarnessRun |
| `task_id` | `string?` | Associated task query entry |
| `loop_iteration_view` | `integer` | Which round of loop view |
| `stage_view_ref` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release` | Current stage view |
| `status` | `pending \| active \| completed \| skipped \| failed \| timed_out` | Stage status |
| `entered_at` | `timestamp` | Entry time |
| `exited_at` | `timestamp?` | Exit time |
| `reason_code` | `string?` | Skip, failure, or timeout reason |

Rules:

- Stage status is a drill-down view of `HarnessRun` / workflow projection and does not replace `HarnessRun` or `NodeRun` primary status.
- `skipped` must have an explicit reason and must not be used as an alias for failure.
- `timed_out` must retain the corresponding evidence or alert reference to runtime execution.

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

- Release level and release status are two dimensions and must not be mixed into a single status field.
- Any release terminal state must leave behind metrics / approval / policy lineage.
- `canary / partial / stable` are design target states; if not currently enabled, they must not be disguised in the contract as implemented authoritative runtime levels.

## 4. Pause and Block Semantics

- `queued`: Not yet started
- `blocked`: Dependencies not met or external conditions not satisfied
- `paused`: Actively paused with recoverable context
- `waiting_input`: Waiting for human or external input
- `throttled`: Suspended due to rate limiting / backpressure
- `suspended`: System-level freeze
- `draining`: Worker or subsystem is draining current execution and no longer accepting new task dispatches

`draining` rules:

- `draining` is a worker-level lifecycle state, not a task or execution state.
- A worker entering `draining` must complete execution of already-held leases (or actively hand over) and must not accept new dispatch tickets.
- After `draining` completes, the worker enters `offline` or is deregistered, not directly `active`.
- Typical trigger scenarios: rolling upgrades (`upgrade_migration`), load rebalancing (`load_rebalance`), operator-initiated decommission (`operator_drain`).
- `draining` must coordinate with lease handover semantics in `task_lease_and_fencing_contract.md` to ensure orderly transfer of execution rights.

## 5. `TerminationRecord`

| Field | Type | Description |
| --- | --- | --- |
| `termination_reason_code` | `string` | Termination reason code |
| `termination_initiator` | `user \| agent \| system \| scheduler \| admin` | Who triggered it |
| `termination_scope` | `node \| run \| task_tree \| tenant \| region \| platform` | Scope of impact |
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

- A learning object's `promoted` only indicates it has entered the reusable pool and does not mean it is automatically published to runtime policy.
- An improvement candidate's `accepted` does not equal published; it still requires release / policy / approval constraints before entering release.
- `rolled_back` must retain a reference to the original candidate or strategy version lineage and must not only leave traces in logs.

## 6. Closure Conclusion

Lifecycle templating and unified termination reason management can significantly reduce state definition fragmentation, troubleshooting difficulties, and UI display chaos.


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` shall prevail.

- T-21: This document originally used `initial / active / paused / blocked / failed / terminal` generalized templates to cover all objects. Root cause: early desire to unify UI lifecycle display, but mistakenly wrote projection templates as runtime truth. Fix: This document now demotes the template to `created_like / active_like / waiting_like / terminal_like` projection grouping and explicitly writes back the full canonical state set for `HarnessRun.status` and `NodeRun.status`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR may only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
