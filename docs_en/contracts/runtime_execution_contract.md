# Runtime Execution Contract

## v4.3 Architecture Remediation

- T-15: Runtime execution contract uniformly switches to canonical execution chain `HarnessRun -> PlanGraphBundle -> NodeRun -> NodeAttemptReceipt`; legacy `stage`/step-centric fields only allowed in projection or import compatibility layer; new truth / control / recovery paths must explicitly carry `harness_run_id`, `node_run_id`, `attempt_id`, `plan_graph_bundle_id`, `graph_version`, `stage_view_ref`.
- All runtime state progression must be achieved through `RuntimeStateMachine.transition` or equivalent repository-level CAS atomic updates; bypassing to directly overwrite execution / workflow truth is prohibited.
- `PlanGraphBundle` is the only authoritative input for P3 -> P4; execution results must first land `NodeAttemptReceipt`, then derive user display, feedback, learning, and recovery views.

## Purpose

Define the authoritative runtime execution surface, covering `HarnessRun`, `PlanGraphBundle`, `NodeRun`, `NodeAttempt`, execution leases, recovery, and replay boundaries.

## Authoritative Implementation
- `src/platform/five-plane-execution/`
- `src/platform/five-plane-orchestration/harness/`
- `src/platform/contracts/executable-contracts/`

## Core Invariants
- Canonical execution objects are `HarnessRun -> PlanGraphBundle -> NodeRun -> NodeAttempt`.
- New execution capabilities must not regress to step-centric truth model.
- Execution state progression must go through repository/service CAS or equivalent atomic update path.
- Lease, fencing, recovery, replay must explicitly carry execution / run identifiers; implicit global state is prohibited.

## Canonical Runtime Fields

| Field | Description |
| --- | --- |
| `harness_run_id` | Authoritative run primary key for runtime; any cross-plane execution, approval, recovery, audit chain must explicitly carry this. |
| `node_run_id` | Primary key for graph node run instance; core association key for worker claim, dispatch, lease, writeback. |
| `attempt_id` | Single attempt ID; retry, replay, compensation, and `NodeAttemptReceipt` must be modeled at attempt granularity. |
| `plan_graph_bundle_id` | Primary key for graph bundle entering P4; must appear together with `graph_version`. |
| `stage_view_ref` | OAPEFLIR stage display view reference; only for interpretation/audit, does not participate in runtime truth determination. |

Rules:

- `stage` must no longer be used as a runtime execution truth field; stage semantics can only be expressed through `stage_view_ref` or upper-layer OAPEFLIR view projection.
- `NodeAttemptReceipt`, lease, fencing, budget, replay, recovery events must all be traceable back to at least `harness_run_id` + `node_run_id` + `attempt_id`.
- Any execution recovery recommendation must point to a specific attempt, not a vague workflow step text description.

## Operational Boundary
- Recovery, repair, replay capabilities are runtime control capabilities and do not imply that business retry is unconditionally allowed.
- When docs conflict with implementation, the runtime contracts and schema in the source directories above are authoritative.