# ADR-012 Whether SQLite Should Be Ring 1 MVP / Ring 2 Readiness Default Primary Storage

- Status: Accepted
- Decision Date: 2026-04-03

## Background

The platform is still in the basic closed-loop stage from Ring 1 MVP to Ring 2 readiness. The priority goal is to get tasks, workflow, execution, approval, event, session, and recovery paths running stably, not to immediately implement a layered data plane or multi-tenant transaction infrastructure.

The decision problem to resolve:

- Should Ring 1 continue using SQLite as the default primary transaction storage.
- When must we exit this decision.

## Decision

Ring 1 and early Ring 2 continue using SQLite as the default/preferred primary transaction storage.

Simultaneously clarify boundaries:

- SQLite continues to serve as the primary single-machine authoritative transaction storage for current Ring 1 / early Ring 2.
- PostgreSQL backend can exist as a controlled alternative implementation for dual-write drills, concurrency verification, and subsequent migration preparation, but must not bypass existing storage contract.
- Artifact body can still be stored in file system or object storage, but index and fact state use SQLite as standard.
- After entering more complex data plane, evolve to layered storage according to `data_plane_contract.md`.
- New cognitive projection objects introduced by OAPEFLIR, such as `TaskSituation / Assessment / PlanRationale / Feedback / Learning / Improvement / ReleaseDecisionView`, must still be able to map back to the `harness_runs / node_runs / node_attempt_receipts` set of SQLite authoritative truth boundaries at the current stage.

## Alternative Solutions

### Solution A: Directly Adopt PostgreSQL at Current Stage

Advantages:

- Stronger concurrency capability.
- Closer to future multi-tenant / multi-worker form.

Costs:

- Significantly increased complexity for local development, testing, release, and operations.
- Current main risk is not DB ceiling, but contract not yet fully mapped to code.
- Early stage would exhaust a lot of energy on infrastructure rather than product closed loop.

### Solution B: SQLite + Other Cache/Queue Hybrid Solution

Advantages:

- Can partially relieve write pressure.

Costs:

- System complexity rises, but the real problem boundary may still not be tightened.
- Prematurely introduces multiple authoritative sources.

### Solution C: Current Decision Solution

- SQLite continues as the sole primary transaction storage
- Explicitly define concurrency, backpressure, and Ring boundaries
- Formally upgrade through ADR and contract later

## Reasons for Choosing This Solution

- Currently most needed is low operations cost, high reproducibility, and local debuggability.
- SQLite is sufficient to support Ring 1 MVP single-machine closed loop and provide auditable single-machine authoritative storage for Ring 2 readiness.
- Currently first tighten state, events, approval, recovery, and storage schema, which is more critical than prematurely implementing heavier databases.
- Project already has clear data plane evolution documentation, so current SQLite choice will not lose subsequent upgrade path.

## Key Invariants

- SQLite is the current default authoritative transaction source.
- If enabling PostgreSQL, must connect through controlled storage adapter / migration / dual-run solution, must not form a second set of ungoverned business semantics.
- `foreign_keys = ON` is a formal operation requirement, not an optional optimization.
- High-value fact state must not exist only in memory.
- Do not use "SQLite will migrate in the future" as an excuse for currently ignoring consistency.
- OAPEFLIR evolutionary entities, even if temporarily hosted by lightweight service or in-memory registry, must be able to map back to `HarnessRun / NodeRun / NodeAttemptReceipt` SQLite authoritative fact boundary, must not form an ungoverned second source of truth.

## Adoption Triggers

Continue maintaining this decision as long as system still satisfies:

- Primarily single-machine
- Primarily Ring 1 MVP / Ring 2 readiness main chain
- Concurrency scale still controlled
- Multi-tenant, remote worker, analytics plane not yet formally implemented

## Exit Conditions

Should re-decide if any of the following occurs:

- Execution plane enters multi-worker / queue / lease main implementation
- Single-machine write bottleneck becomes persistent problem, and backpressure/async batch insufficient to relieve
- Multi-tenant or enterprise transaction isolation formally enters implementation scope
- Analytics / archive / replay needs independent data plane

## Implementation Impact

Current must-do:

- schema, migration, repository, and recovery inspection all designed per SQLite boundaries
- FileLock, event ack, execution, approval all fall to SQLite authoritative tables
- Control over-phase concurrency through backpressure and operational constraints
- When phase1-4 introduces new fact objects like `learning_objects`, `improvement_candidates`, `rollout_records`, contract and state machine must first clearly define authoritative responsibility before extending persistence implementation.

Subsequent upgrade requirements:

- If migrating to PostgreSQL, must not let business contract drift; should prioritize replacing storage adapter / migration / queue layer rather than rewriting business main chain

## Results

Advantages:

- Lowest local development and testing cost.
- Most suitable for quickly establishing recoverable, auditable minimum platform closed loop at current stage.
- Naturally aligned with current single-machine contract system.

Costs:

- Concurrency and scalability have clear upper limits.
- If capabilities continue expanding after Ring 2, must seriously plan migration, cannot indefinitely delay.

## Current Implementation Alignment

As of current phase1-4 delivery, this ADR's practical implications are:

- Fact such as `harness_runs / node_runs / node_attempt_receipts / approvals / events / diagnostics` still backed by SQLite boundaries.
- New objects like OAPEFLIR cognitive DTO, LearningObject, ReleaseDecisionView have first closed at type, test, and contract layer before gradually extending to persistence.
- This means "first define authoritative semantics, then supplement storage form", rather than first introducing second data plane.

## v4.3 ADR Remediation

- A-4: This ADR originally continued task/workflow/execution-centric storage narrative. The root cause was that SQLite decision was made when runtime truth still used old object naming, and it was not migrated along with `NodeRun` / `NodeAttemptReceipt` main chain completion. Fix: The text now explicitly states that SQLite authoritative truth subject is `harness_runs / node_runs / node_attempt_receipts`, and old task/workflow/execution retained only as compatibility narrative.

## Cross References

- [ADR-009 Deployment and Operations](./009-deployment-ops.md)
- [ADR-013 Whether to Continue Using EventEmitter to Ring 2 Readiness](./013-eventemitter-phase-2-boundary.md)
- [ADR-011 Whether Effect-TS Should Be Core Runtime Foundation](./011-effect-ts-adoption.md)

## Source Sections

- `storage_schema_contract.md`
- `runtime_repository_and_migration_contract.md`
- `state_transition_matrix_contract.md`
- `data_plane_contract.md`

## v4.3 Ring Remediation

- R8-71: This ADR originally wrote applicability as `Phase 1a / 1b / Phase 2`. The root cause was that after repository migrated from phase to ring terminology, this ADR only rewrote main semantics without synchronizing rewriting applicability boundary. Fix: The text now uniformly converges to `Ring 1 MVP / Ring 2 readiness`, with phase retained only as historical migration semantics.
