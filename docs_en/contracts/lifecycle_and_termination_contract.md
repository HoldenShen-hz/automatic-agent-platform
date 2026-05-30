# Lifecycle And Termination Contract

## 1. Scope

This contract defines the common lifecycle templates across entities and the unified rules for recording termination reasons.

Related documents:

- `runtime_state_machine_contract.md`
- `state_transition_matrix_contract.md`
- `transition_service_contract.md`
- `error_code_registry_contract.md`

If `terminalReason` / `reason_code` is exposed as stable error semantics, prefer reusing the codes already registered in `error_code_registry_contract.md`.

## 2. Objectives

Unify the common lifecycle patterns for the following entities:

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

And unify reason recording for terminal states such as failed / cancelled / killed / deprecated.

## 3. Lifecycle Templates

Generic templates are only allowed as projection groupings and must not replace truth state enumerations:

- `created_like`
- `active_like`
- `waiting_like`
- `terminal_like`

Domain entities may map projections on top of this, but truth states must maintain their respective canonical enumerations.

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

- `retry_wait`, `awaiting_hitl`, and `reconciling` are waiting states and must not be flattened into a generic `blocked` state that loses semantic meaning.
- `leased` is an execution ownership state and must not be replaced by an `active` projection that then drives lease/fencing logic in reverse.
- All truth state transitions must still go through `RuntimeStateMachine.transition(command)`.

### 3A. OAPEFLIR Stage Lifecycle

`StageLifecycleRecord` minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `harness_run_id` | `string` | Associated HarnessRun |
| `task_id` | `string?` | Associated task query entry |
| `loop_iteration_view` | `integer` | Loop iteration view count |
| `stage_view_ref` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release` | Current stage view |
| `status` | `pending \| active \| completed \| skipped \| failed \| timed_out` | Stage status |
| `entered_at` | `timestamp` | Entry timestamp |
| `exited_at` | `timestamp?` | Exit timestamp |
| `reason_code` | `string?` | Reason for skip/failure/timeout |

Rules:

- Stage status is a drill-down view of `HarnessRun` / workflow projections and does not replace `HarnessRun` or `NodeRun` primary status.
- `skipped` must have an explicit reason and must not be used as an alias for failure.
- `timed_out` must retain references to corresponding runtime execution evidence or alerts.

### 3B. Release Lifecycle

`ReleaseRecord` minimum lifecycle enumeration:

- `pending`
- `running`
- `completed`
- `rolled_back`
- `failed`

Release level within the current phase1-4 authoritative boundary only permits:

- `off`
- `suggest`
- `shadow`

Rules:

- Release level and release status are two separate dimensions and must not be combined into a single status field.
- Any release terminal state must leave behind metrics / approval / policy lineage.
- `canary / partial / stable` belong to design target states; if not yet enabled in the current phase, they must not be falsely represented as implemented authoritative runtime levels.

## 4. Pause and Block Semantics

- `queued`: Not yet started
- `blocked`: Dependencies not met or external conditions not satisfied
- `paused`: Actively paused with recoverable context
- `waiting_input`: Waiting for human or external input
- `throttled`: Suspended due to rate limiting / backpressure
- `suspended`: System-level freeze
- `draining`: Worker or subsystem is draining current execution and no longer accepting new task dispatch

`draining` rules:

- `draining` is a worker-level lifecycle state, not a task or execution state.
- A worker entering `draining` must complete execution of its held leases (or主动 handover) and must not accept new dispatch tickets.
- After `draining` completes, the worker transitions to `offline` or is deregistered; it does not directly return to `active`.
- Typical trigger scenarios: rolling upgrades (`upgrade_migration`), load rebalancing (`load_rebalance`), operator-initiated drain (`operator_drain`).
- `draining` must coordinate with lease handover semantics in `task_lease_and_fencing_contract.md` to ensure orderly transfer of execution ownership.

## 5. `TerminationRecord`

| Field | Type | Description |
| --- | --- | --- |
| `termination_reason_code` | `string` | Termination reason code |
| `termination_initiator` | `user \| agent \| system \| scheduler \| admin` | Who triggered it |
| `termination_scope` | `node \| run \| task_tree \| tenant \| region \| platform` | Scope of impact |
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

- A learning object's `promoted` only indicates it has entered the reusable pool, not that it is automatically published to runtime policy.
- An improvement candidate's `accepted` does not equal deployed; it still requires release / policy / approval constraints before entering release.
- `rolled_back` must retain lineage to the original candidate or strategy version and must not merely leave a log entry.

## 6. Conclusion

Template-based lifecycle unification and standardized termination reason recording significantly reduce state definition fragmentation, troubleshooting difficulty, and UI display inconsistencies.

## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical sections conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-21: This document previously used `initial / active / paused / blocked / failed / terminal` generic templates covering all objects. The root cause was that early work想把统一 UI lifecycle display 的投影模板误写成 runtime truth。修复：正文现把模板降为 `created_like / active_like / waiting_like / terminal_like` 投影分组，并显式写回 `HarnessRun.status` 与 `NodeRun.status` 的 canonical 状态全集。

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR must only appear as `oapeflir.view.*` / rationale projections; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.