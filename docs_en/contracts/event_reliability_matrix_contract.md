# Event Reliability Matrix Contract

> **OAPEFLIR Related**: This contract defines event reliability requirements for OAPEFLIR dual chain topology, corresponding to ADR-016.
> **Last Updated**: 2026-04-17

## 1. Scope

This contract defines event classification, reliability requirements, persistence strategy, ack strategy, and operational boundaries.

It supplements `event_bus_contract.md`, drilling down Tier 1 / 2 / 3 from principles to matrix.
The more detailed event registry, consumer relationships, and operational thresholds are governed by `event_registry_and_ops_threshold_contract.md`.

## 2. Classification Matrix

| Tier | Guarantee Level | Persistence | Ack | Replay | Applicable Scenarios |
| --- | --- | --- | --- | --- | --- |
| `tier1` | Must-deliver / recoverable | Must write to DB first | Must acknowledge per consumer | Must support | Task, approval, status, recovery chain |
| `tier2` | Best-effort delivery | Optional persistence | Optional | Recommended | Important progress, tool stages, observability events |
| `tier3` | May be lost | May skip persistence | Not required | Not required | Streaming chunks, heartbeats, transient progress |

## 3. Phase 1a Baseline Events

| Event Type | Tier | Reason |
| --- | --- | --- |
| `task.created` | `tier1` | Main chain factual event |
| `task.status_changed` | `tier1` | User main status |
| `workflow.started` | `tier1` | Workflow lifecycle start |
| `workflow.step_completed` | `tier1` | Next step advancement depends on this |
| `workflow.failed` | `tier1` | Recovery and failure attribution |
| `approval.requested` | `tier1` | HITL main chain |
| `approval.resolved` | `tier1` | Prerequisite for recovery execution |
| `improve.candidate_accepted` | `tier1` | Candidate acceptance changes subsequent strategy and rollout trajectory |
| `release.rollout_started` | `tier1` | Release chain start; requires audit and recovery |
| `release.rollout_completed` | `tier1` | Release chain terminal state; requires stable record |
| `release.rollback_triggered` | `tier1` | Rollback rewrites release trajectory; must be recoverable |
| `gateway.message_received` | `tier2` | Channel input is important but does not directly drive recovery |
| `feedback.signal_received` | `tier2` | Affects learn / improve, but evidence compensation recovery is acceptable |
| `loop.iteration_completed` | `tier2` | Critical closed-loop observability event but not separately authoritative business status |
| `stream.chunk_emitted` | `tier3` | Display-type transient traffic |

## 4. Write Rules

- Tier 1: Write `events` first, then register `event_consumer_acks`, then attempt dispatch.
- Tier 2: May emit first then backfill persistence.
- Tier 3: Default to memory or display layer channels; do not require per-event persistence.

## 5. Operational Rules

| Item | Tier 1 | Tier 2 | Tier 3 |
| --- | --- | --- | --- |
| Loss alert | Must | Optional | Not required |
| Ack backlog alert | Must | Optional | Not required |
| Replay tools | Must | Optional | Not required |
| Consumer idempotency requirement | Must | Recommended | Recommended |

## 6. Related Documents

- `event_bus_contract.md`
- `storage_schema_contract.md`
- `gateway_streaming_contract.md`
- `event_registry_and_ops_threshold_contract.md`

## 7. Closure Conclusion

The core of event classification is not "labeling events", but explicitly defining the acceptable loss cost and recovery cost for each event type.