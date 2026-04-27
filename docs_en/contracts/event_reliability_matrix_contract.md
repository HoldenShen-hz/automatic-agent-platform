# Event Reliability Matrix Contract

> **OAPEFLIR Related**: This contract defines event reliability requirements for OAPEFLIR dual-chain topology, corresponding to ADR-016.
> **Updated**: 2026-04-17

## 1. Scope

This contract defines event classification, reliability requirements, persistence strategy, ack strategy, and ops boundaries.

It complements `event_bus_contract.md` by drilling down Tier 1 / 2 / 3 from principles to matrix.
Finer event registry, consumer relationships, and ops thresholds are based on the drilling document `event_registry_and_ops_threshold_contract.md`.

## 2. Classification Matrix

| Tier | Guarantee Level | Persistence | Ack | Replay | Applicable Scenarios |
| --- | --- | --- | --- | --- | --- |
| `tier1` | Must reach / recoverable | Must write to DB first | Must acknowledge per consumer | Must support | Tasks, approvals, status, recovery chain |
| `tier2` | Best-effort delivery | Optional persistence | Optional | Suggested support | Important progress, tool stages, observability events |
| `tier3` | Can be lost | May not persist | Not required | Not required | Streaming chunks, heartbeats, transient progress |

## 3. Phase 1a Baseline Events

| Event Type | Tier | Reason |
| --- | --- | --- |
| `task.created` | `tier1` | Primary chain factual event |
| `task.status_changed` | `tier1` | User primary state |
| `workflow.started` | `tier1` | Workflow lifecycle start |
| `workflow.step_completed` | `tier1` | Next step advancement depends on it |
| `workflow.failed` | `tier1` | Recovery and failure attribution |
| `approval.requested` | `tier1` | HITL primary chain |
| `approval.resolved` | `tier1` | Prerequisite for recovery execution |
| `improve.candidate_accepted` | `tier1` | Candidate acceptance will change subsequent strategy and rollout trajectory |
| `release.rollout_started` | `tier1` | Release chain start, requires audit and recovery |
| `release.rollout_completed` | `tier1` | Release chain terminal state, requires stable留痕 |
| `release.rollback_triggered` | `tier1` | Rollback rewrites release trajectory, must be recoverable |
| `gateway.message_received` | `tier2` | Channel input is important but does not directly drive recovery |
| `feedback.signal_received` | `tier2` | Affects learn / improve, but allows recovery compensation through evidence |
| `loop.iteration_completed` | `tier2` | Closed-loop observability key event, but not independently authoritative business state |
| `stream.chunk_emitted` | `tier3` | Display-type transient traffic |

## 4. Write Rules

- Tier 1: First write `events`, then register `event_consumer_acks`, then attempt dispatch.
- Tier 2: Can emit first then supplement persistence.
- Tier 3: Default goes through memory or display layer channels, does not require per-entry persistence.

## 5. Ops Rules

| Item | Tier 1 | Tier 2 | Tier 3 |
| --- | --- | --- | --- |
| Loss alert | Must | Optional | Not required |
| Ack backlog alert | Must | Optional | Not required |
| Replay tool | Must | Optional | Not required |
| Consumer idempotency requirement | Must | Suggested | Suggested |

## 6. Related Documents

- `event_bus_contract.md`
- `storage_schema_contract.md`
- `gateway_streaming_contract.md`
- `event_registry_and_ops_threshold_contract.md`

## 7. Closure Conclusion

The core of event classification is not "labeling events", but clarifying acceptable loss cost and recovery cost for each type of event.
