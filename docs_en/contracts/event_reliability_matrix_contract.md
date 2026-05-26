# Event Reliability Matrix Contract

> **OAPEFLIR Related**: This contract defines event reliability requirements for OAPEFLIR dual-chain topology, corresponding to ADR-016.
> **Updated**: 2026-04-17

## 1. Scope

This contract defines event classification, reliability requirements, persistence strategy, ack strategy and ops boundaries.

It supplements `event_bus_contract.md`, diving from Tier 1 / 2 / 3 principles into matrix.
Finer event registry, consumer relationships and ops thresholds are governed by diving document `event_registry_and_ops_threshold_contract.md`.

## 2. Classification Matrix

| Tier | Guarantee Level | Persistence | ack | Replay | Applicable Scenario |
| --- | --- | --- | --- | --- | --- |
| `tier1` | Must deliver / recoverable | Must write DB first | Must ack per consumer | Must support | Task, approval, status, recovery chain |
| `tier2` | Best effort delivery | Optional persistence | Optional | Recommended | Important progress, tool stage, observation event |
| `tier3` | Can be lost | May not persist | Not required | Not required | Streaming chunk, heartbeat, transient progress |

## 3. Ring 1 Baseline Events

| Event Type | Tier | Reason |
| --- | --- | --- |
| `platform.task.created` | `tier1` | Main chain fact event |
| `platform.task.status_changed` | `tier1` | User main status |
| `platform.harness.started` | `tier1` | Harness lifecycle start |
| `platform.node.completed` | `tier1` | Next node advancement depends |
| `platform.harness.failed` | `tier1` | Recovery and failure attribution |
| `approval.requested` | `tier1` | HITL main chain |
| `approval.resolved` | `tier1` | Recovery execution prerequisite |
| `improve.candidate_accepted` | `tier1` | Candidate acceptance will change subsequent strategy and rollout trajectory |
| `release.rollout_started` | `tier1` | Release chain start, needs audit and recovery |
| `release.rollout_completed` | `tier1` | Release chain end state, needs stable trace |
| `release.rollback_triggered` | `tier1` | Rollback rewrites release trajectory, must be recoverable |
| `gateway.message_received` | `tier2` | Channel input important but not directly driving recovery |
| `feedback.signal_received` | `tier2` | Affects learn / improve, but can compensate recovery through evidence |
| `loop.iteration_completed` | `tier2` | Closed-loop observation key event, but not alone as authoritative business status |
| `stream.chunk_emitted` | `tier3` | Display-type transient流量 |

## 4. Write Rules

- Tier 1: First write `events`, then register `event_consumer_acks`, then try to distribute.
- Tier 2: Can first emit then supplement persistence.
- Tier 3: Default to memory or display layer channel, does not require per-item persistence.

## 5. Ops Rules

| Item | Tier 1 | Tier 2 | Tier 3 |
| --- | --- | --- | --- |
| Loss alert | Must | Optional | Not required |
| Ack backlog alert | Must | Optional | Not required |
| Replay tool | Must | Optional | Not required |
| Consumer idempotent requirement | Must | Recommended | Recommended |

## 6. Related Documents

- `event_bus_contract.md`
- `storage_schema_contract.md`
- `gateway_streaming_contract.md`
- `event_registry_and_ops_threshold_contract.md`

## 7. Closure Conclusion

The core of event classification is not "labeling events", but clarifying acceptable loss cost and recovery cost for each type of event.
