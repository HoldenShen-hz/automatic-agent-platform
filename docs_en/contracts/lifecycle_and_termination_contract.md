# Lifecycle And Termination Contract

## 1. Scope

This contract defines a universal lifecycle template across entities and unified rules for recording termination reasons.

Related Documents:

- `runtime_state_machine_contract.md`
- `state_transition_matrix_contract.md`
- `transition_service_contract.md`

## 2. Goals

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

And uniformly supplement termination reason recording for terminal states such as failed / cancelled / killed / deprecated.

## 3. Lifecycle Template

The universal template is allowed only as a projection grouping and must not replace truth status enums:

- `created_like`
- `active_like`
- `waiting_like`
- `terminal_like`

Domain entities can do projection mapping on this basis, but truth status must maintain their respective canonical enums.

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

- `retry_wait`, `awaiting_hitl`, `reconciling` are waiting states and must not be flattened to generalized `blocked` and lose semantics.
- `leased` is an execution rights state, and `active` projection must not be used to replace it and then reversely drive lease / fencing logic.
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
| `reason_code` | `string?` | Skip, failure, timeout reason |

Rules:

- Stage status is a drill-down view of `HarnessRun` / workflow projection and must not replace `HarnessRun` or `NodeRun` primary status.
- `skipped` must have an explicit reason and must not be used as an alias for failure.
- `timed_out` must retain correspondence evidence or alert reference with runtime execution.

### 3B. Release Lifecycle

`ReleaseRecord` lifecycle minimum enum:

- `pending`
- `running`
- `completed`
- `rolled_back`
- `failed`

Release level within current phase1-4 authoritative scope only allows:

- `off`
- `suggest`
- `shadow`

Rules:

- Release level and release status are two dimensions and must not be mixed into a single status field.
- Any release terminal state must leave metrics / approval / policy lineage.
- `canary / partial / stable` belong to design target states; if not currently enabled, must not be disguised in the contract as delivered authoritative execution levels.

## 4. Pause and Block Semantics

- `queued`: Not yet started
- `blocked`: Dependencies or external conditions not met
- `paused`: Actively paused with recoverable context
- `waiting_input`: Waiting for human or external input
- `throttled`: Suspended due to rate limiting/backpressure
- `suspended`: System-level freeze
- `draining`: Worker or subsystem is draining current execution, no longer accepting new task dispatch

`draining` rules:

- `draining` is a worker-level lifecycle state, not a task or execution state.
- Worker entering `draining` must complete execution of held leases (or proactively hand over) and must not accept new dispatch tickets.
- After `draining` completes, worker enters `offline` or is deregistered, not directly `active`.
- Typical trigger scenarios: rolling upgrades (`upgrade_migration`), load rebalancing (`load_rebalance`), operator-initiated decommission (`operator_drain`).
- `draining` must coordinate with lease handover semantics in `task_lease_and_fencing_contract.md` to ensure orderly transfer of execution rights.

## 5. `TerminationRecord`

| Field | Type | Description |
| --- | --- | --- |
| `termination_reason_code` | `string` | Termination reason code |
| `termination_initiator` | `user \| agent \| system \| scheduler \| admin` | Who triggered it |
| `termination_scope` | `node \| run \| task_tree \| tenant \| region \| platform` | Impact scope |
| `recoverable` | `boolean` | Whether recoverable |
| `terminated_at` | `timestamp` | Termination time |

## 5A. LearningObject / ImprovementCandidate Lifecycle

`LearningObjectStatus` minimum enum:

- `draft`
- `validated`
- `promoted`
- `decayed`
- `archived`

`ImprovementCandidateStatus` minimum enum:

- `proposed`
- `evaluating`
- `accepted`
- `rejected`
- `deployed`
- `rolled_back`

Rules:

- `promoted` for learning object only indicates it has entered the reusable pool and does not equal automatic publication to runtime policy.
- `accepted` for improvement candidate does not equal deployed; still requires release / policy / approval constraints before entering release.
- `rolled_back` must retain lineage to original candidate or strategy version and must not leave traces only in logs.

## 6. Closure Conclusion

Lifecycle templating and termination reason unification can significantly reduce status definition fragmentation, troubleshooting difficulties, and UI display chaos.

## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` shall prevail.

- T-21: This document originally used `initial / active / paused / blocked / failed / terminal` generalized template to cover all objects. The root cause was that early attempts to unify UI lifecycle display mistakenly wrote the projection template as runtime truth. Fix: The body now demotes the template to `created_like / active_like / waiting_like / terminal_like` projection grouping, and explicitly writes back the complete canonical state sets for `HarnessRun.status` and `NodeRun.status`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be `oapeflir.view.*` / rationale projections; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
