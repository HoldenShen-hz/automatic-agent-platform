# ADR-013 Whether to Continue Using EventEmitter to Ring 2 Readiness

- Status: Accepted
- Decision Date: 2026-04-03

## Background

The current platform needs event-driven state projections, gateway streaming feedback, recovery scanning, and operations observability. But Ring 1 is still primarily single-machine, single-process, with minimal multi-agent orchestration.

The problem is:

- Whether to continue using in-memory event distribution mechanism.
- How to avoid "using EventEmitter and mistakenly treating it as a reliable event bus".

## Decision

Ring 1 allows continuing to use in-memory event distribution mechanism as intra-process distribution tool.

But simultaneously freeze the following boundaries:

- Tier 1 event authoritative source must be persistent event table + per-consumer ack.
- EventEmitter only handles intra-process fan-out, does not bear reliable delivery semantics.
- Whether to replace with more formal queue/bus after Ring 2 readiness, to be decided separately at that time.
- Feedback / Learn / Improve / Release events introduced by OAPEFLIR also comply with the above boundaries; they can first go through intra-process fan-out, but must not define themselves as authoritative source beyond the persistent fact layer.

## Alternative Solutions

### Solution A: Immediately Replace with Redis / Postgres / BullMQ Queue

Advantages:

- Stronger reliability and cross-process expansion space.

Costs:

- At current stage, significantly elevates deployment and debugging complexity.
- Reliability problem truly needs first to be tightened through contract, ack, and replay mechanism, not first changing technical name.

### Solution B: Completely Rely on In-Memory EventEmitter, No Persistent Events

Advantages:

- Simplest implementation.

Costs:

- Crash recovery, event replay, and per-consumer ack all become distorted.
- Cannot satisfy Tier 1 event semantics already clearly defined in current system.

### Solution C: Current Decision Solution

- In-memory EventEmitter continues for intra-process distribution
- Persistent event table and ack bear reliable event authoritative source
- After Ring 2 readiness, evaluate whether to upgrade to heavier queue system

## Reasons for Choosing This Solution

- Current stage intra-process event distribution needs objectively exist, EventEmitter is lightweight enough.
- But the key risk is not "memory distribution tool not advanced enough", but whether reliability semantics are placed on the persistent layer.
- Current solution supports main chain with lowest complexity, and does not conceal its boundaries.

## Key Invariants

- Tier 1 fact events must first write to DB, then register consumer ack, then attempt distribution.
- EventEmitter failure must not become fact state rollback basis.
- Recovery scan and event replay only based on `events + event_consumer_acks`.
- Tier 3 streaming chunks must not pretend to be recoverable fact source.
- Events like `platform.feedback.signal_received`, `platform.learn.object_promoted`, `platform.release.rollout_*`, if defined as high-value fact events, must first satisfy persistence and ack constraints, rather than relying on pure memory subscription success.

## Adoption Triggers

Continue maintaining this decision as long as system still has:

- Primarily single-machine
- Primarily intra-process distribution
- Primarily Ring 1 MVP / Ring 2 readiness orchestration

## Exit Conditions

Should re-evaluate and possibly upgrade if any of the following occurs:

- Multi-process / multi-worker becomes a formal implementation topic
- Off-process consumers significantly increase
- Event throughput and backpressure already clearly exceed single-process fan-out applicable boundary
- queue / lease / execution plane has entered core path

## Implementation Impact

Current implementation must-do:

- Clearly distinguish "reliable event authoritative source" and "memory distribution channel"
- Simultaneously establish event registry, ack threshold, recovery scan, and replay tools
- Keep EventEmitter usage within intra-process adapter / projection scope
- Even if OAPEFLIR closed-loop related services first implement via in-memory/lightweight registry, should ensure future migratability to more formal queue/bus through typed payload, reason code, and state machine constraints.

## Results

Advantages:

- Lightest at current stage.
- Does not elevate infrastructure complexity for possible multi-process prematurely.
- Consistent with existing Tier 1 / Tier 2 / Tier 3 event classification documentation.
- Allows OAPEFLIR main/secondary chain first to form closed loop in single process, then consolidate reliability issues to contract and persistence layer.

Costs:

- Requires team to continuously remember EventEmitter is not a reliable messaging system.
- Once entering multi-worker stage, must actively upgrade, cannot continue to default to using it.

## Current Implementation Alignment

As of current phase1-4 delivery, aligned parts include:

- Feedback preprocessing, LearningObject validation, Rollout guardrail have first closed through types and service boundaries.
- OAPEFLIR stage timeline already provides main chain/secondary chain sequential perspective, but it itself is not a reliable event bus replacement.
- If event layer upgrades later, should only replace transport/fan-out, should not destroy already-defined closed-loop state machine and authoritative semantics.

## Cross References

- [ADR-012 Whether SQLite Should Be Ring 1-2 Default Primary Storage](./012-sqlite-phase-1-2-primary-store.md)
- [ADR-009 Deployment and Operations](./009-deployment-ops.md)
- [ADR-011 Whether Effect-TS Should Be Core Runtime Foundation](./011-effect-ts-adoption.md)

## Source Sections

- `event_bus_contract.md`
- `event_reliability_matrix_contract.md`
- `event_registry_and_ops_threshold_contract.md`
- `typed_event_bus_contract.md`

## v4.3 Ring Remediation

- R8-72: This ADR originally still used `Phase 1a / 1b / Phase 2` to describe applicability boundary and exit triggers. The root cause was that event transport ADR's historical naming was not rewritten along with ring terminology. Fix: The text now uniformly converges to `Ring 1 MVP / Ring 2 readiness`, and changes "whether to replace" expression to a separate decision after ring readiness.
