# ADR-012 Whether SQLite as Phase 1-2 Only Primary Storage

- Status: Accepted
- Decision Date: 2026-04-03

## Context

The platform is still in Phase 1a/1b basic closed-loop stage; priority is to stabilize task, workflow, execution, approval, event, session, and recovery paths, rather than adopting a layered data plane or multi-tenant transaction infrastructure from the start.

Questions needing decision:

- Whether to continue using SQLite as default primary transaction storage for Phase 1a/1b.
- When must exit this decision.

## Decision

Phase 1a and Phase 1b continue using SQLite as default/preferred primary transaction storage.

At the same time clarify boundaries:

- SQLite continues to serve as the current stage's primary single-machine authoritative transaction storage.
- PostgreSQL backend can exist as a controlled alternative implementation for dual-write drills, concurrency verification, and subsequent migration preparation, but must not bypass existing storage contract.
- Artifact main body can still be stored in file system or object storage, but index and factual state take SQLite as standard.
- When entering more complex data plane, evolve into layered storage according to `data_plane_contract.md`.
- New factual objects introduced by OAPEFLIR like `TaskSituation/Assessment/Plan/Feedback/Learning/Improvement/Rollout` are still constrained by SQLite authoritative boundary together with existing task facts at current stage.

## Alternatives

### Option A: Directly Adopt PostgreSQL at Current Stage

Benefits:

- Stronger concurrency capability.
- Closer to future multi-tenant/multi-worker form.

Costs:

- Significantly increased local development, testing, release, and operations complexity.
- Current main risk is not DB ceiling but contract not yet fully mapped to code.
- Early stage will exhaust significant energy on infrastructure rather than product closed loop.

### Option B: SQLite + Other Cache/Queue Hybrid Solution

Benefits:

- Can partially relieve write pressure.

Costs:

- System complexity increases, but real problem boundaries may still not be tightened.
- Prematurely introduces multiple authoritative sources.

### Option C: Current Decision

- SQLite continues as only primary transaction storage
- Clarify concurrency, backpressure, and Phase boundaries
- Later formally upgrade through ADR and contract

## Reasons for Choosing This Approach

- Current stage most needs low operations cost, high reproducibility, and local debuggability.
- SQLite is sufficient to support Phase 1a/1b single-machine closed loop.
- Tightening state, events, approval, recovery, and storage schema first is more critical than prematurely adopting heavier database.
- Project already has clear data plane evolution documentation, will not lose subsequent upgrade path due to current SQLite choice.

## Key Invariants

- SQLite is current default authoritative transaction source.
- If PostgreSQL is enabled, must be integrated through controlled storage adapter/migration/dual-run scheme, cannot form second set of business semantics without governance.
- `foreign_keys = ON` is formal operation requirement, not optional optimization.
- High-value factual state must not exist only in memory.
- Must not use "SQLite will migrate in future" as excuse to currently ignore consistency.
- OAPEFLIR evolution entities even if temporarily hosted by lightweight service or in-memory registry must be able to map back to SQLite authoritative fact boundary, cannot form an ungoverned second source of truth.

## Adoption Triggers

As long as system still meets:

- Primarily single-machine
- Phase 1a/1b main chain primarily
- Concurrency scale still under control
- Multi-tenant, remote worker, analytics plane not yet in formal implementation

Continue to maintain this decision.

## Exit Conditions

If any of the following occur, should re-decide:

- Execution plane enters main implementation for multi-worker/queue/lease
- Single-machine write bottleneck becomes persistent problem and backpressure/async batch insufficient to relieve
- Multi-tenant or enterprise transaction isolation formally enters implementation scope
- Analytics/archive/replay needs independent data plane

## Implementation Impact

Current must accompanying be done:

- Schema, migration, repository, and recovery inspection all designed around SQLite boundary
- FileLock, event ack, execution, approval all fall to SQLite authoritative tables
- Control over-stage concurrency through backpressure and operational constraints
- When phase1-4 introduces new factual objects like `learning_objects`, `improvement_candidates`, `rollout_records`, contract and state machine must first clearly define authoritative responsibilities before expanding persistence implementation.

Subsequent upgrade requirements:

- If migrating to PostgreSQL, must not let business contract drift; should prioritize replace storage adapter/migration/queue layer rather than rewriting business main chain

## Results

Benefits:

- Lowest local development and testing cost.
- Most suitable for quickly establishing recoverable, auditable minimum platform closed loop at current stage.
- Naturally aligned with current single-machine contract system.

Costs:

- Concurrency and scalability have clear ceiling.
- If capabilities continue to expand after Phase 2, must seriously plan migration, cannot indefinitely postpone.

## Current Implementation Alignment

As of current phase1-4 delivery, this ADR's practical implications become:

- Main task, execution, approval, and diagnostics facts still backed by SQLite boundary.
- OAPEFLIR DTO, LearningObject, Rollout and other new objects have first closed at type, testing, and contract layer before gradually expanding to persistence.
- This means "first define authoritative semantics, then fill storage form", rather than first introducing second data plane.

## Cross-References

- [ADR-009 Deployment and Operations](./009-deployment-ops.md)
- [ADR-013 Whether EventEmitter Continues to Phase 2](./013-eventemitter-phase-2-boundary.md)
- [ADR-011 Whether Effect-TS as Core Runtime Foundation](./011-effect-ts-adoption.md)

## Source Sections

- `storage_schema_contract.md`
- `runtime_repository_and_migration_contract.md`
- `state_transition_matrix_contract.md`
- `data_plane_contract.md`
