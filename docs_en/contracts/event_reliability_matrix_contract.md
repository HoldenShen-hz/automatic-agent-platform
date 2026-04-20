# Event Reliability Matrix Contract

## 1. Scope

This contract defines event tiers, reliability requirements, persistence strategies, ack strategies, and operational boundaries.

It supplements `event_bus_contract.md` by drilling down Tier 1 / 2 / 3 from principles to a matrix.
More detailed event registry, consumer relationships, and operational thresholds are in the drill-down document `event_registry_and_ops_threshold_contract.md`.

## 2. Tier Matrix

| Tier | Guarantee Level | Persistence | Ack | Replay | Applicable Scenarios |
| --- | --- | --- | --- | --- | --- |
| `tier1` | Must deliver / recoverable | Must write to DB first | Must confirm by consumer | Must support | Tasks, approvals, states, recovery chains |
| `tier2` | Best-effort delivery | Optional persistence | Optional | Recommended | Important progress, tool stages, observability events |
| `tier3` | May be lost | May not persist | Not required | Not required | Stream chunks, heartbeats, transient progress |

## 3. Phase 1a Baseline Events

| Event Type | Tier | Reason |
| --- | --- | --- |
| `task.created` | `tier1` | Primary chain factual event |
| `task.status_changed` | `tier1` | User primary state |
| `workflow.started` | `tier1` | Workflow lifecycle start |
| `workflow.step_completed` | `tier1` | Next step depends on it |
| `workflow.failed` | `tier1` | Recovery and failure attribution |
| `approval.requested` | `tier1` | HITL primary chain |
| `approval.resolved` | `tier1` | Prerequisite for resuming execution |
| `improve.candidate_accepted` | `tier1` | Candidate acceptance changes subsequent strategy and rollout trajectory |
| `release.rollout_started` | `tier1` | Release chain start; needs audit and recovery |
| `release.rollout_completed` | `tier1` | Release chain terminal state; needs stable trace |
| `release.rollback_triggered` | `tier1` | Rollback changes release trajectory; must be recoverable |
| `gateway.message_received` | `tier2` | Channel input is important but does not directly drive recovery |
| `feedback.signal_received` | `tier2` | Affects learn / improve but allows compensation recovery through evidence |
| `loop.iteration_completed` | `tier2` | Key closed-loop observability event but not individually authoritative business state |
| `stream.chunk_emitted` | `tier3` | Display-type transient traffic |

## 4. Write Rules

- Tier 1: First write to `events`, then register `event_consumer_acks`, then attempt distribution.
- Tier 2: May emit first then supplement persistence.
- Tier 3: Defaults to flowing through memory or display layer channels; does not require per-entry persistence.

## 5. Operational Rules

| Item | Tier 1 | Tier 2 | Tier 3 |
| --- | --- | --- | --- |
| Loss alerting | Must | Optional | Not required |
| Ack backlog alerting | Must | Optional | Not required |
| Replay tools | Must | Optional | Not required |
| Consumer idempotency requirement | Must | Recommended | Recommended |

## 6. Related Documents

- `event_bus_contract.md`
- `storage_schema_contract.md`
- `gateway_streaming_contract.md`
- `event_registry_and_ops_threshold_contract.md`

## 7. Closure Conclusion

The core of event tiering is not "labeling events" but defining the acceptable loss cost and recovery cost for each type of event.
