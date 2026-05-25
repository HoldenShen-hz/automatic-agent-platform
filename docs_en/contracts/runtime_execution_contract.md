# Runtime Execution Contract

## Purpose
Defines the authoritative runtime execution contract for `HarnessRun`, `PlanGraphBundle`, `NodeRun`, `NodeAttempt`, leases, recovery, and replay boundaries.

## Canonical Implementation
- `src/platform/five-plane-execution/`
- `src/platform/five-plane-orchestration/harness/`
- `src/platform/contracts/executable-contracts/`

## Core Invariants
- The canonical runtime chain is `HarnessRun -> PlanGraphBundle -> NodeRun -> NodeAttempt`.
- New runtime behavior must not introduce a step-centric truth model.
- Runtime state transitions must use repository/service CAS semantics or equivalent atomic updates.
- Lease, fencing, recovery, and replay flows must carry explicit execution/run identifiers.

## Operational Boundary
- Recovery, repair, and replay are runtime controls and do not imply unconditional business retry permission.
- When docs drift from code, the source directories above remain authoritative.
