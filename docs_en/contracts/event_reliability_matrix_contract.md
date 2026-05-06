# Event Reliability Matrix Contract

> **OAPEFLIR Association**: This contract defines event reliability requirements for the OAPEFLIR dual-chain topology, corresponding to ADR-016.
> **Update date**: 2026-04-17

## 1. Scope

This contract defines event classification, reliability requirements, persistence strategy, ack strategy, and operational boundaries.

It supplements `event_bus_contract.md` by drilling down Tier 1 / 2 / 3 from principles to matrix.
More detailed event registry, consumer relationships, and operational thresholds follow in `event_registry_and_ops_threshold_contract.md`.

## 2. Classification Matrix

| Tier | Guarantee Level | Persistence | Ack | Replay | Applicable Scenario |
| --- | --- | --- | --- | --- | --- |
| `tier1` | Guaranteed delivery / recoverable | Must write DB first | Must acknowledge by consumer | Must support | Tasks, approvals, status, recovery chain |
| `tier2` | Best-effort delivery | Optional persistence | Optional | Recommended to support | Important progress, tool stages, observability events |
| `tier3` | Can be lost | May not persist | Not required | Not required | Streaming chunks, heartbeats, transient progress |

## 3. Ring 1 Baseline Events

| Event Type | Tier | Reason |
| --- | --- | --- |
| `platform.task.created` | `tier1` | Main chain fact event |
| `platform.task.status_changed` | `tier1` | User primary status |
| `platform.harness.started` | `tier1` | Harness lifecycle start |
| `platform.node.completed` | `tier1` | Next node progression depends on it |
| `platform.harness.failed` | `tier1` | Recovery and failure attribution |
| `approval.requested` | `tier1` | HITL main chain |
| `approval.resolved` | `tier1` | Prerequisite for recovery execution |
| `improve.candidate_accepted` | `tier1` | Candidate acceptance changes subsequent strategy and release trajectory |
| `platform.release.started` | `tier1` | Release chain start, requires audit and recovery |
| `platform.release.completed` | `tier1` | Release chain terminal state, requires stable trace |
| `release.rollback_triggered` | `tier1` | Rollback rewrites release trajectory, must be recoverable |
| `gateway.message_received` | `tier2` | Channel input is important but does not directly drive recovery |
| `feedback.signal_received` | `tier2` | Affects learn / improve, but evidence compensation recovery is acceptable |
| `loop.iteration_completed` | `tier2` | Critical for closed-loop observation but not separately as authoritative business state |
| `stream.chunk_emitted` | `tier3` | Display-class transient traffic |

## 4. Write Rules

- Tier 1: First write `events`, then register `event_consumer_acks`, then attempt distribution.
- Tier 2: Can emit first then supplement persistence.
- Tier 3: Default to memory or display layer channels, no requirement for per-event persistence.

## 5. Operational Rules

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

## 7. Conclusion

The core of event classification is not "labeling events", but defining acceptable loss cost and recovery cost for each type of event.
