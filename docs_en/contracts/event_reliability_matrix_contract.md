# Event Reliability Matrix Contract

> **OAPEFLIR Related**: This contract defines event reliability requirements for OAPEFLIR dual-chain topology, corresponding to ADR-016.
> **Update Date**: 2026-04-17

## 1. Scope

This contract defines event tiering, reliability requirements, persistence strategies, ack strategies, and operational boundaries.

It supplements `event_bus_contract.md` by drilling down Tier 1/2/3 from principles to matrix.
For finer event registry, consumer relationships, and ops thresholds, refer to the drilling document `event_registry_and_ops_threshold_contract.md`.

## 2. Tiering Matrix

| Tier | Guarantee Level | Persistence | Ack | Replay | Applicable Scenarios |
| --- | --- | --- | --- | --- | --- |
| `tier1` | Must deliver / recoverable | Must write DB first | Must acknowledge per consumer | Must support | Tasks, approvals, status, recovery chain |
| `tier2` | Best effort delivery | Optional persistence | Optional | Recommended to support | Important progress, tool stages, observability events |
| `tier3` | Can be lost | May skip persistence | Not required | Not required | Streaming chunks, heartbeats, transient progress |

## 3. Ring 1 Baseline Events

| Event Type | Tier | Reason |
| --- | --- | --- |
| `platform.task.created` | `tier1` | Main chain fact event |
| `platform.task.status_changed` | `tier1` | User primary status |
| `platform.harness.started` | `tier1` | Harness lifecycle start point |
| `platform.node.completed` | `tier1` | Next node advancement depends on this |
| `platform.harness.failed` | `tier1` | Recovery and failure attribution |
| `approval.requested` | `tier1` | HITL main chain |
| `approval.resolved` | `tier1` | Prerequisite for recovery execution |
| `improve.candidate_accepted` | `tier1` | Candidate acceptance changes subsequent strategy and rollout trajectory |
| `release.rollout_started` | `tier1` | Release chain start point, requires audit and recovery |
| `release.rollout_completed` | `tier1` | Release chain terminal state, requires stable footprint |
| `release.rollback_triggered` | `tier1` | Rollback rewrites release trajectory, must be recoverable |
| `gateway.message_received` | `tier2` | Channel input is important but does not directly drive recovery |
| `feedback.signal_received` | `tier2` | Affects learn/improve, but recovery through evidence compensation is acceptable |
| `loop.iteration_completed` | `tier2` | Key event for closed-loop observability, but not independently authoritative business status |
| `stream.chunk_emitted` | `tier3` | Display-class transient traffic |

## 4. Write Rules

- Tier 1: First write `events`, then register `event_consumer_acks`, then attempt distribution.
- Tier 2: May emit first then backfill persistence.
- Tier 3: Defaults to in-memory or display layer channels, does not require per-event persistence.

## 5. Ops Rules

| Item | Tier 1 | Tier 2 | Tier 3 |
| --- | --- | --- | --- |
| Loss alert | Must | Optional | Not required |
| Ack backlog alert | Must | Optional | Not required |
| Replay tool | Must | Optional | Not required |
| Consumer idempotency requirement | Must | Recommended | Recommended |

## 6. Related Documents

- `event_bus_contract.md`
- `storage_schema_contract.md`
- `gateway_streaming_contract.md`
- `event_registry_and_ops_threshold_contract.md`

## 7. Closure Conclusion

The core of event tiering is not "labeling events", but defining acceptable loss cost and recovery cost for each class of event.