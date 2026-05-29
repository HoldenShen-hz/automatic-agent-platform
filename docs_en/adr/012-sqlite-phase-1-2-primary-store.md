# ADR-012 Whether SQLite as Ring 1-2 Default Primary Storage

- Status: Accepted
- Decision Date: 2026-04-03

## Background

The platform is currently still in Phase 1a/1b basic closed-loop stage. Priority is to get tasks, workflow, execution, approval, event, session, and recovery paths running stably, not layering data planes or multi-tenant transaction infrastructure from the start.

Questions to decide:

- Whether Ring 1 continues to use SQLite as default primary transaction storage.
- When must exit this decision.

## Decision

Ring 1 and early Ring 2 continue to use SQLite as default/preferred primary transaction storage.

Also clarify boundaries:

- SQLite continues to bear the current stage's most important single-machine authoritative transaction storage.
- PostgreSQL backend can exist as a controlled alternative implementation, used for dual-write drills, concurrency verification, and subsequent migration preparation, but must not bypass existing storage contract.
- Artifact body can still be stored in file system or object storage, but index and factual state based on SQLite.
- When entering more complex data planes, evolve to layered storage per `data_plane_contract.md`.
- OAPEFLIR新增的认知 projection objects like `TaskSituation/Assessment/PlanRationale/Feedback/Learning/Improvement/ReleaseDecisionView` must still be mappable to this set of SQLite authoritative truth boundaries `harness_runs/node_runs/node_attempt_receipts` at current stage.

## Alternative Options

### Option A: Directly Adopt PostgreSQL at Current Stage

Benefits:

- Stronger concurrency.
- Closer to future multi-tenant/multi-worker form.

Costs:

- Local development, testing, release, and operations complexity significantly increased.
- Current main risk is not DB ceiling, but contract not yet fully mapped to code.
- Early stage would exhaust大量精力 on infrastructure rather than product closed loop.

### Option B: SQLite + Other Cache/Queue Hybrid Solution

Benefits:

- Can partially relieve write pressure.

Costs:

- System complexity rises, but real problem boundaries may still not be tightened.
- Prematurely introduces multiple authoritative sources.

### Option C: Current Decision

- SQLite continues as only primary transaction storage
- Explicitly acknowledge concurrency, backpressure, and phase boundaries
- Subsequently upgrade via ADR and contract

## Reasons for This Choice

- Current stage most needs low operations cost, high reproducibility, and local debuggability.
- SQLite sufficient to support Phase 1a/1b single-machine closed loop.
- First tightening state, events, approval, recovery, and storage schema is more critical than prematurely deploying heavier databases.
- Project already has clear data plane evolution documentation, will not lose subsequent upgrade path due to current SQLite choice.

## Key Invariants

- SQLite is current default authoritative transaction source.
- If enabling PostgreSQL, must接入 via controlled storage adapter/migration/dual-run scheme, cannot form second set of ungoverned business semantics.
- `foreign_keys = ON` is a formal operation requirement, not an optional optimization.
- High-value factual state must not exist only in memory.
- Must not use "SQLite will migrate in future" as excuse for currently ignoring consistency.
- OAPEFLIR evolutionary entities even if temporarily hosted by lightweight services or in-memory registry, must be mappable to SQLite authoritative fact boundaries of `HarnessRun/NodeRun/NodeAttemptReceipt`, cannot form ungoverned second source of truth.

## Adoption Triggers

Continue this decision as long as system still satisfies:

- Single-machine primarily
- Phase 1a/1b main chain primarily
- Concurrency scale still controlled
- Multi-tenant, remote worker, analytics plane not yet in formal implementation

## Exit Conditions

If any of the following occur, should re-decide:

- Execution plane enters multi-worker/queue/lease main implementation
- Single-machine write bottleneck becomes persistent issue and backpressure/async batch insufficient to relieve
- Multi-tenant or enterprise transaction isolation formally enters implementation scope
- Analytics/archive/replay need independent data plane

## Implementation Impact

Current must accompany:

- Schema, migration, repository, and recovery inspection all designed per SQLite boundaries
- FileLock, event ack, execution, approval all fall to SQLite authoritative tables
- Control over-phase concurrency via backpressure and operational constraints
- When phase1-4 introduces new factual objects like `learning_objects`, `improvement_candidates`, `rollout_records`, contract and state machine must first clearly define authoritative responsibilities before extending persistence implementation.

Subsequent upgrade requirements:

- If migrating to PostgreSQL, must not let business contract drift; should prioritize replacing storage adapter/migration/queue layer, not rewriting business main chain

## Results

Benefits:

- Lowest local development and testing cost.
- Most suitable for quickly establishing recoverable, auditable minimum platform closed loop at current stage.
- Naturally aligned with current single-machine contract system.

Costs:

- Concurrency and scalability have explicit ceilings.
- If capabilities continue expanding after Phase 2, must seriously plan migration, cannot indefinitely postpone.

## Current Implementation Alignment

As of current phase1-4 delivery, practical implications of this ADR have changed:

- Factual like `harness_runs/node_runs/node_attempt_receipts/approvals/events/diagnostics` still backed by SQLite boundaries.
- New objects like OAPEFLIR cognitive DTOs, LearningObject, ReleaseDecisionView have first closed at type, test, and contract layer, then gradually extended to persistence.
- This means "first define authoritative semantics, then supplement storage form", not first introducing second set of data planes.

## v4.3 ADR Remediation

- A-4: This ADR originally continued task/workflow/execution-centric storage narrative. Root cause was that SQLite decision formed when runtime truth still used old object naming, not subsequently unified with `NodeRun`/`NodeAttemptReceipt` main chain. Fix: Body now explicitly states SQLite authoritative truth subject as `harness_runs/node_runs/node_attempt_receipts`, old task/workflow/execution only retained as compatible narrative.

## Cross-References

- [ADR-009 Deployment and Operations](./009-deployment-ops.md)
- [ADR-013 Whether EventEmitter Continues to Phase 2](./013-eventemitter-phase-2-boundary.md)
- [ADR-011 Effect-TS Whether as Core Runtime Foundation](./011-effect-ts-adoption.md)

## Source Sections

- `storage_schema_contract.md`
- `runtime_repository_and_migration_contract.md`
- `state_transition_matrix_contract.md`
- `data_plane_contract.md`