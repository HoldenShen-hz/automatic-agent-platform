# Runtime Execution Contract

## v4.3 Architecture Remediation

- T-15: runtime execution contract switches entirely to the canonical execution chain `HarnessRun -> PlanGraphBundle -> NodeRun -> NodeAttemptReceipt`; legacy `stage`/step-centric fields are only permitted in projection or import compatibility layers, and new truth/control/recovery paths must explicitly carry `harness_run_id`, `node_run_id`, `attempt_id`, `plan_graph_bundle_id`, `graph_version`, `stage_view_ref`.
- All runtime state progression must be achieved through `RuntimeStateMachine.transition` or equivalent repository-level CAS atomic updates; bypassing to directly rewrite execution/workflow truth is not permitted.
- `PlanGraphBundle` is the sole authoritative input for P3 -> P4; execution results must first be persisted to `NodeAttemptReceipt`, then derive user display, feedback, learning, and recovery views.

## Purpose

Defines authoritative constraints for the runtime Execution Plane, covering `HarnessRun`, `PlanGraphBundle`, `NodeRun`, `NodeAttempt`, execution lease, recovery, and replay boundaries.

## Authoritative Implementation

- `src/platform/five-plane-execution/`
- `src/platform/five-plane-orchestration/harness/`
- `src/platform/contracts/executable-contracts/`

## Core Invariants

- Canonical execution objects are `HarnessRun -> PlanGraphBundle -> NodeRun -> NodeAttempt`.
- New execution capabilities must not regress to step-centric truth model.
- Execution state progression must go through repository/service layer CAS or equivalent atomic update path.
- Lease, fencing, recovery, replay must explicitly carry execution/run identifiers; implicit global state is not permitted.

## Canonical Runtime Fields

| Field | Description |
| --- | --- |
| `harness_run_id` | Runtime authoritative run primary key; any cross-plane execution, approval, recovery, or audit链路 must explicitly carry this. |
| `node_run_id` | Graph node execution instance primary key; core association key for worker claim, dispatch, lease, and writeback. |
| `attempt_id` | Single attempt ID; retry, replay, compensation, and `NodeAttemptReceipt` must be modeled at attempt granularity. |
| `plan_graph_bundle_id` | Graph bundle primary key entering P4; must appear paired with `graph_version`. |
| `stage_view_ref` | OAPEFLIR stage display view reference; used only for explanation/audit, does not participate in runtime truth determination. |

Rules:

- `stage` must no longer be used as a runtime execution truth field; stage semantics may only be expressed through `stage_view_ref` or upper-layer OAPEFLIR view projection.
- `NodeAttemptReceipt`, lease, fencing, budget, replay, and recovery events must all be traceable back to at least `harness_run_id` + `node_run_id` + `attempt_id`.
- Any execution recovery recommendation must point to a specific attempt, not a vague workflow step text description.

## Operations Boundary

- Recovery, repair, and replay capabilities belong to runtime control capabilities and do not imply that business-level retry is always allowed.
- When documentation conflicts with implementation, the runtime contract and schema in the source directories above take precedence.