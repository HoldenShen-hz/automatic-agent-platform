# ADR-013 Whether EventEmitter Continues to Phase 2

- Status: Accepted
- Decision Date: 2026-04-03

## Background

Current platform needs event-driven state projection, gateway streaming feedback, recovery scanning, and operations observability. But Ring 1 still primarily uses single-machine, single-process, and minimum multi-Agent orchestration.

Question is:

- Whether to continue using in-memory event distribution mechanism.
- How to avoid "using EventEmitter and mistakenly treating it as a reliable event bus".

## Decision

Ring 1 allows continuing to use in-memory event distribution mechanism as intra-process distribution tool.

But simultaneously freeze the following boundaries:

- Tier 1 event factual source must be persistent event table with per-consumer ack.
- EventEmitter only responsible for intra-process fan-out, does not bear reliability delivery semantics.
- Whether to replace with more formal queue/bus in Phase 2, to be separately decided then.
- OAPEFLIR-introduced Feedback/Learn/Improve/Release events also comply with above boundaries; they can first go through intra-process fan-out, but must not越过持久化事实层 defining themselves as authoritative source.

## Alternative Options

### Option A: Immediately Replace with Redis/Postgres/BullMQ Queue

Benefits:

- Stronger reliability and cross-process expansion space.

Costs:

- Significantly raises deployment and debugging complexity at current stage.
- Reliability issue truly needs first tightening via contract, ack, and replay mechanism, not first changing technical names.

### Option B: Completely Rely on In-Memory EventEmitter, No Persistent Events

Benefits:

- Simplest implementation.

Costs:

- Crash recovery, event replay, per-consumer ack全部失真.
- Cannot satisfy Tier 1 event semantics already clearly defined by current system.

### Option C: Current Decision

- In-memory EventEmitter continues for intra-process distribution
- Persistent event table and ack bear reliable event factual source
- Phase 2 re-evaluates whether to upgrade to heavier queue system

## Reasons for This Choice

- Current stage intra-process event distribution needs objectively exist, EventEmitter light enough.
- But key risk is not "in-memory distribution tool not advanced enough", but whether reliability semantics are placed on persistence layer.
- Current solution supports main chain with lowest complexity, while not obscuring its boundaries.

## Key Invariants

- Tier 1 factual events must first write to DB, then register consumer ack, then attempt distribution.
- EventEmitter failure must not become factual state rollback basis.
- Recovery scanning and event replay only based on `events + event_consumer_acks`.
- Tier 3 streaming chunks must not impersonate recoverable factual source.
- Events like `feedback.signal_received`, `learning.object_promoted`, `release.rollout_*` if defined as high-value factual events, must first satisfy persistence and ack constraints, not depend on pure in-memory subscription success.

## Adoption Triggers

Continue this decision as long as system still:

- Primarily single-machine
- Primarily intra-process distribution
- Phase 1a/1b orchestration primarily

## Exit Conditions

If any of the following occur, should re-evaluate and possibly upgrade:

- Multi-process/multi-worker becomes formal implementation subject
- Out-of-process consumers significantly increase
- Event throughput and backpressure already clearly exceed single-process fan-out applicable boundaries
- Queue/lease/execution plane has entered core path

## Implementation Impact

Current implementation must:

- Clearly distinguish "reliable event factual source" and "in-memory distribution channel"
- Establish event registry, ack threshold, recovery scanning, and replay tools synchronously
- Keep EventEmitter usage within intra-process adapter/projection scope
- OAPEFLIR closed-loop related services even if first implemented as in-memory/lightweight registry, should guarantee future migratability to more formal queue/bus via typed payload, reason code, and state machine constraints.

## Results

Benefits:

- Lightest current stage implementation.
- Does not prematurely raise infrastructure complexity for possible future multi-process.
- Consistent with existing Tier 1/2/3 event classification documentation.
- Allows OAPEFLIR main/secondary chain first forming closed loop in single process, then constraining reliability issues to contract and persistence layer.

Costs:

- Team needs to continuously remember EventEmitter is not a reliable messaging system.
- Once entering multi-worker stage, must proactively upgrade, cannot continue defaulting.

## Current Implementation Alignment

As of current phase1-4 delivery, aligned parts include:

- Feedback preprocessing, LearningObject validation, Rollout guardrail have first closed via type and service boundaries.
- OAPEFLIR stage timeline already can provide main/secondary chain sequence perspective, but itself is not a reliable event bus substitute.
- Event layer subsequent upgrade should only replace transport/fan-out, should not break already-defined closed-loop state machine and authoritative semantics.

## Cross-References

- [ADR-012 Whether SQLite as Phase 1-2 Only Primary Storage](./012-sqlite-phase-1-2-primary-store.md)
- [ADR-009 Deployment and Operations](./009-deployment-ops.md)
- [ADR-011 Effect-TS Whether as Core Runtime Foundation](./011-effect-ts-adoption.md)

## Source Sections

- `event_bus_contract.md`
- `event_reliability_matrix_contract.md`
- `event_registry_and_ops_threshold_contract.md`
- `typed_event_bus_contract.md`