# ADR-013 EventEmitter Continued Use to Phase 2

- Status: Accepted
- Decision Date: 2026-04-03

## Background

Current platform needs event-driven state projection, gateway streaming feedback, recovery scanning, and operations observation. But Phase 1a/1b still primarily uses single-machine, single-process, and minimal multi-Agent orchestration.

Problem is:

- Whether to continue using in-memory event distribution mechanism currently.
- How to avoid "using EventEmitter then mistakenly treating it as reliable event bus".

## Decision

Phase 1a/1b allows continuing to use in-memory event distribution mechanism as intra-process distribution tool.

But simultaneously freeze the following boundaries:

- Tier 1 event authoritative source must be persistent event table and per-consumer ack.
- EventEmitter only responsible for intra-process fan-out, does not bear reliable delivery semantics.
- Whether to replace with more formal queue/bus in Phase 2 will be decided separately at that time.
- Feedback/Learn/Improve/Release events introduced by OAPEFLIR similarly comply with the above boundaries; they can first go through intra-process fan-out but must not cross the persistence layer to define themselves as authoritative source.

## Alternatives

### Option A: Immediately Replace with Redis/Postgres/BullMQ Queue

Benefits:

- Stronger reliability and cross-process scaling space.

Costs:

- Current stage will significantly raise deployment and debugging complexity.
- Reliability problems first need tightening through contract, ack, and replay mechanism, not just changing technical names.

### Option B: Completely Rely on In-Memory EventEmitter, No Persistent Events

Benefits:

- Simplest implementation.

Costs:

- Crash recovery, event replay, per-consumer ack all become distorted.
- Cannot satisfy Tier 1 event semantics already clarified for current system.

### Option C: Current Decision

- In-memory EventEmitter continues for intra-process distribution
- Persistent event table and ack bear reliable event authoritative source
- Phase 2 re-evaluates whether to upgrade to heavier queue system

## Reasons for This Approach

- Current stage intra-process event distribution needs objectively exist, EventEmitter is light enough.
- But key risk is not "in-memory distribution tool not advanced enough" but whether reliability semantics are placed in persistence layer.
- Current approach can support main chain with lowest complexity while not obscuring its boundaries.

## Key Invariants

- Tier 1 factual events must first write to DB, then register consumer ack, then attempt distribution.
- EventEmitter failure must not become factual state rollback basis.
- Recovery scanning and event replay only based on `events + event_consumer_acks`.
- Tier 3 streaming chunks must not impersonate recoverable factual source.
- If events like `feedback.signal_received`, `learning.object_promoted`, `release.rollout_*` are defined as high-value factual events, must prioritize satisfy persistence and ack constraints rather than relying on pure memory subscription success.

## Adoption Triggers

As long as system still:

- Primarily single-machine
- Primarily intra-process distribution
- Phase 1a/1b orchestration primarily

Continue to maintain this decision.

## Exit Conditions

If any of the following occur, should re-evaluate and possibly upgrade:

- Multi-process/multi-worker becomes formal implementation topic
- Out-of-process consumers significantly increase
- Event throughput and backpressure clearly exceed single-process fan-out applicable boundary
- queue/lease/execution plane has entered core path

## Implementation Impact

Current implementation must be done:

- Clearly distinguish "reliable event factual source" and "memory distribution channel"
- Event registry, ack threshold, recovery scanning, and replay tools established concurrently
- Keep EventEmitter usage within intra-process adapter/projection scope
- OAPEFLIR closed-loop related services even if first implemented with memory/lightweight registry should guarantee future migratability to more formal queue/bus through typed payload, reason code, and state machine constraints.

## Results

Benefits:

- Current stage implementation is lightest.
- Won't prematurely raise infrastructure complexity for possible future multi-process.
- Consistent with existing Tier 1/Tier 2/Tier 3 event tiering documentation.
- Allows OAPEFLIR main/secondary chain to first form closed loop in single process, then consolidate reliability issues to contract and persistence layer.

Costs:

- Requires team to continuously remember EventEmitter is not a reliable messaging system.
- Once entering multi-worker stage, must actively upgrade, cannot continue defaulting.

## Current Implementation Alignment

As of current phase1-4 delivery, aligned parts include:

- Feedback preprocessing, LearningObject validation, Rollout guardrail have first closed through type and service boundary.
- OAPEFLIR stage timeline can already provide main/secondary chain sequence perspective, but it itself is not reliable event bus substitute.
- If event layer upgrades in the future, should only replace transport/fan-out, should not destroy already defined closed-loop state machine and authoritative semantics.

## Cross-References

- [ADR-012 SQLite as Phase 1-2 Primary Store](./012-sqlite-phase-1-2-primary-store.md)
- [ADR-009 Deployment and Operations](./009-deployment-ops.md)
- [ADR-011 Effect-TS as Core Runtime Foundation](./011-effect-ts-adoption.md)

## Source Sections

- `event_bus_contract.md`
- `event_reliability_matrix_contract.md`
- `event_registry_and_ops_threshold_contract.md`
- `typed_event_bus_contract.md`
