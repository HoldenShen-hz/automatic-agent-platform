# ADR-012 SQLite as Ring 1-2 Default Primary Store

- Status: Accepted
- Decision Date: 2026-04-03

## Context

The platform is currently in the Phase 1a/1b basic closed-loop stage. The priority is to stabilize task, workflow, execution, approval, event, session, and recovery paths—not to build a layered data plane or multi-tenant transaction infrastructure from the start.

The decision to be made:

- Whether Ring 1 continues to use SQLite as the default primary transaction store.
- When this decision must be exited.

## Decision

Ring 1 and early Ring 2 continue to use SQLite as the default/preferred primary transaction store.

Boundaries are also clarified:

- SQLite continues to serve as the primary single-machine authoritative transaction store for the current phase.
- A PostgreSQL backend may exist as a controlled alternative implementation for dual-write exercises, concurrency validation, and subsequent migration preparation, but must not bypass existing storage contracts.
- Artifacts may still be stored in filesystem or object storage, but indexes and factual state are governed by SQLite.
- When entering a more complex data plane, evolve to layered storage per `data_plane_contract.md`.
- Cognitive projection objects newly added by OAPEFLIR such as `TaskSituation`, `Assessment`, `PlanRationale`, `Feedback`, `Learning`, `Improvement`, and `ReleaseDecisionView` must still be mappable back to `harness_runs / node_runs / node_attempt_receipts` as the SQLite authoritative truth boundary in the current phase.

## Alternatives

### Option A: Adopt PostgreSQL Directly in the Current Phase

Pros:

- Stronger concurrency.
- Closer to future multi-tenant/multi-worker shape.

Cons:

- Significantly increased complexity for local development, testing, release, and operations.
- The primary risk now is not the database ceiling, but that contracts are not yet fully mapped to code.
- Early stages would drain significant energy on infrastructure rather than product closed-loop.

### Option B: SQLite + Other Cache/Queue Hybrid Approach

Pros:

- Can partially relieve write pressure.

Cons:

- Increases system complexity, but the real problem boundaries may still not be tightened.
- Prematurely introduces multiple authoritative sources.

### Option C: Current Decision (Chosen Option)

- SQLite continues as the sole primary transaction store.
- Clarify concurrency, backpressure, and phase boundaries.
- Formal upgrade via ADR and contract later.

## Reasons for Selecting This Option

- The current phase needs low operational cost, high reproducibility, and local debuggability most.
- SQLite is sufficient to support Phase 1a/1b single-machine closed-loop.
- Tightening state, events, approvals, recovery, and storage schema now is more critical than adopting heavier databases early.
- The project already has clear data plane evolution documentation, so choosing SQLite now does not lose the upgrade path for the future.

## Key Invariants

- SQLite is the current default authoritative transaction source.
- If PostgreSQL is enabled, it must be connected via a controlled storage adapter/migration/dual-run approach; an ungoverned second business semantics layer must not form.
- `foreign_keys = ON` is a formal operating requirement, not an optional optimization.
- High-value factual state must not exist only in memory.
- "SQLite will migrate in the future" is not an excuse for ignoring consistency now.
- Even if OAPEFLIR evolutionary entities are temporarily hosted by lightweight services or in-memory registries, they must be mappable back to the SQLite authoritative factual boundaries of `HarnessRun / NodeRun / NodeAttemptReceipt`; an ungoverned second source of truth must not form.

## Adoption Conditions

This decision remains in effect as long as the system satisfies:

- Single-machine primary operation
- Phase 1a/1b main chain primary
- Concurrency scale remains controlled
- Multi-tenancy, remote workers, and analytics plane have not entered formal implementation

## Exit Conditions

Re-evaluate the decision when any of the following occurs:

- Execution plane enters main implementation with multi-worker/queue/lease
- Single-machine write bottleneck becomes a sustained problem and backpressure/async batching is no longer sufficient
- Multi-tenant or enterprise transaction isolation formally enters implementation scope
- Analytics/archive/replay requires an independent data plane

## Implementation Impact

Must be done in conjunction currently:

- Schema, migration, repository, and recovery inspection are all designed around SQLite boundaries
- FileLock, event ack, execution, and approval all land in SQLite authoritative tables
- Control over-phase concurrency via backpressure and operating constraints
- When phase1-4 introduces new factual objects such as `learning_objects`, `improvement_candidates`, and `rollout_records`, contracts and state machines must first clearly define authoritative responsibilities before extending persistence implementation.

Future upgrade requirements:

- If migrating to PostgreSQL, business contracts must not drift; priority should be given to replacing the storage adapter/migration/queue layer rather than rewriting the main business chain.

## Consequences

Pros:

- Lowest local development and testing cost.
- Best suited for rapidly establishing a recoverable, auditable minimal platform closed-loop in the current phase.
- Naturally aligned with the current single-machine contract system.

Cons:

- Concurrency and scalability have clear upper limits.
- If capabilities continue to expand after Phase 2, migration must be seriously planned; it cannot be indefinitely delayed.

## Current Implementation Alignment

As of the current phase1-4 delivery, the practical implications of this ADR become:

- Factual entities such as `harness_runs`, `node_runs`, `node_attempt_receipts`, `approvals`, `events`, and `diagnostics` are still backed by SQLite boundaries.
- OAPEFLIR cognitive DTOs, LearningObject, ReleaseDecisionView, and other new objects have first been closed at the type, test, and contract layers, then gradually extended to persistence.
- This means "first define authoritative semantics, then fill in storage form"—not introducing a second data plane first.

## v4.3 ADR Remediation

- A-4: This ADR originally continued the task/workflow/execution-centric storage narrative. The root cause was that when the SQLite decision was formed, runtime truth still used the old object naming; subsequent migration to `NodeRun` / `NodeAttemptReceipt` main chain was not completed. Fix: The body now explicitly states that SQLite authoritative truth subject is `harness_runs / node_runs / node_attempt_receipts`, with old task/workflow/execution retained only for compatibility narrative.

## Cross References

- [ADR-009 Deployment and Operations](./009-deployment-ops.md)
- [ADR-013 EventEmitter Continued Use to Phase 2](./013-eventemitter-phase-2-boundary.md)
- [ADR-011 Effect-TS as Core Runtime Foundation](./011-effect-ts-adoption.md)

## Source Sections

- `storage_schema_contract.md`
- `runtime_repository_and_migration_contract.md`
- `state_transition_matrix_contract.md`
- `data_plane_contract.md`
