# ADR-012 SQLite as Phase 1-2 Sole Primary Storage

- Status: Accepted
- Decision Date: 2026-04-03

## Context

The platform is currently still in the Phase 1a / 1b basic closure stage. The priority is to stabilize task, workflow, execution, approval, event, session, and recovery paths, rather than implementing a layered data plane or multi-tenant transaction infrastructure from the start.

The decision question is:

- Should SQLite continue as the default primary transactional storage for Phase 1a / 1b?
- When must this decision be exited?

## Decision

Phase 1a and Phase 1b will continue to use SQLite as the default/preferred primary transactional storage.

Simultaneously, boundaries are clarified:

- SQLite continues to serve as the primary single-machine authoritative transactional storage for the current stage.
- PostgreSQL backend may exist as a controlled alternative implementation for dual-write exercises, concurrency verification, and subsequent migration preparation, but must not bypass existing storage contracts.
- Artifact bodies may still be stored in filesystem or object storage, but indexes and factual state are based on SQLite.
- Upon entering more complex data planes, evolve to layered storage according to `data_plane_contract.md`.
- Cognitive projection objects newly added by OAPEFLIR such as `TaskSituation / Assessment / PlanRationale / Feedback / Learning / Improvement / ReleaseDecisionView` must still be mappable to the `harness_runs / node_runs / node_attempt_receipts` SQLite authoritative truth boundary at the current stage.

## Alternatives

### Option A: Adopt PostgreSQL directly in the current stage

Pros:

- Stronger concurrency capability.
- Closer to future multi-tenant / multi-worker patterns.

Costs:

- Significantly increased complexity for local development, testing, release, and operations.
- The primary risk at this stage is not the DB ceiling, but incomplete contract-to-code mapping.
- Early stages will consume substantial energy on infrastructure rather than product closure.

### Option B: SQLite + Other Cache/Queue Hybrid Approach

Pros:

- Can partially relieve write pressure.

Costs:

- System complexity increases, but the actual problem boundaries may still not be tightened.
- Introduces multiple authoritative sources prematurely.

### Option C: Current Decision

- SQLite continues as the sole primary transactional storage
- Clearly define concurrency, backpressure, and phase boundaries
- Formal upgrade through ADR and contract in subsequent phases

## Reasons for Selecting This Option

- The current stage needs lowest operational cost, highest reproducibility, and local debuggability.
- SQLite is sufficient to support Phase 1a / 1b single-machine closure.
- Tightening state, events, approvals, recovery, and storage schema first is more critical than adopting heavier databases prematurely.
- The project already has clear data plane evolution documentation, so choosing SQLite now does not forfeit the upgrade path.

## Key Invariants

- SQLite is the current default authoritative transactional source.
- If PostgreSQL is enabled, it must be connected through a controlled storage adapter / migration / dual-run scheme and cannot form a second uncontrolled business semantics layer.
- `foreign_keys = ON` is a formal operation requirement, not an optional optimization.
- High-value factual state must not exist only in memory.
- "SQLite will migrate in the future" must not be used as an excuse for current negligible consistency.
- OAPEFLIR evolutionary entities, even if temporarily hosted by lightweight services or in-memory registries, must be mappable to the `HarnessRun / NodeRun / NodeAttemptReceipt` SQLite authoritative factual boundary and must not form an uncontrolled second source of truth.

## Adoption Conditions

Continue to maintain this decision as long as the system still meets:

- Primarily single-machine
- Primarily Phase 1a / 1b main chain
- Concurrency scale remains controlled
- Multi-tenant, remote worker, and analytics plane have not entered formal implementation

## Exit Conditions

If any of the following occur, re-evaluation is required:

- Execution plane enters multi-worker / queue / lease main implementation
- Single-machine write bottleneck becomes a persistent problem, and backpressure/async batching is insufficient to relieve it
- Multi-tenant or enterprise transaction isolation formally enters implementation scope
- Analytics / archive / replay requires an independent data plane

## Implementation Impact

Current requirements:

- Schema, migration, repository, and recovery inspection must all be designed within SQLite boundaries
- FileLock, event ack, execution, and approval all fall to SQLite authoritative tables
- Control over-stage concurrency through backpressure and operational constraints
- When phase1-4 introduces new factual objects such as `learning_objects`, `improvement_candidates`, `rollout_records`, contracts and state machines must first clearly define authoritative responsibilities before extending persistence implementation

Upgrade requirements:

- If migrating to PostgreSQL, business contracts must not drift; prioritize replacing storage adapter / migration / queue layer rather than rewriting the main business chain

## Results

Pros:

- Lowest local development and testing costs.
- Most suitable for rapidly establishing a recoverable, auditable minimum platform closure at the current stage.
- Naturally aligned with current single-machine contract system.

Costs:

- Clear limits on concurrency and scalability.
- If capabilities continue to expand after Phase 2, migration must be seriously planned and cannot be indefinitely delayed.

## Current Implementation Alignment

As of current phase1-4 delivery, the practical implications of this ADR are:

- Facts such as `harness_runs / node_runs / node_attempt_receipts / approvals / events / diagnostics` are still backed by SQLite boundaries.
- New objects like OAPEFLIR cognitive DTOs, LearningObject, and ReleaseDecisionView have first been closed at the type, test, and contract layers before gradually extending to persistence.
- This means "first define authoritative semantics, then fill in storage form", rather than first introducing a second data plane.

## v4.3 ADR Remediation

- A-4: This ADR originally continued the task/workflow/execution-centric storage narrative, root cause being that when the SQLite decision was formed, runtime truth still used old object naming. Subsequent `NodeRun` / `NodeAttemptReceipt` main chain unification migration was not completed. Fix: The body now explicitly states that SQLite authoritative truth subject is `harness_runs / node_runs / node_attempt_receipts`. Old task/workflow/execution is retained only for compatible narrative.

## Cross-References

- [ADR-009 Deployment and Operations](./009-deployment-ops.md)
- [ADR-013 EventEmitter Usage Through Phase 2](./013-eventemitter-phase-2-boundary.md)
- [ADR-011 Effect-TS Adoption](./011-effect-ts-adoption.md)

## Source Sections

- `storage_schema_contract.md`
- `runtime_repository_and_migration_contract.md`
- `state_transition_matrix_contract.md`
- `data_plane_contract.md`
