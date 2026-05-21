# Event Bus Contract

> **OAPEFLIR Association**: This contract defines the event bus mechanism for OAPEFLIR 8-stage pipeline, corresponding to ADR-016 §Dual-Chain Topology and ADR-079/ADR-080.
> **Last Updated**: 2026-04-17

## 1. Scope

This contract defines platform event bus, event reliability tiers, persistence requirements, naming conventions, and consumption semantics.

## 2. Key Objects

- `BusEvent`
- `EventEnvelope`
- `EventTier`
- `EventConsumerAck`
- `EventSchemaRegistry`
- `LoopEventEnvelope`

## 3. EventEnvelope Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Event unique ID |
| `type` | `string` | Event type |
| `tier` | `tier1 \| tier2 \| tier3` | Reliability tier |
| `harness_run_id` | `string?` | Associated harness run truth |
| `node_run_id` | `string?` | Associated node run truth |
| `attempt_id` | `string?` | Associated node attempt truth |
| `session_id` | `string?` | Associated session |
| `loop_iteration` | `integer?` | OAPEFLIR iteration number |
| `stage` | `string?` | Associated OAPEFLIR stage |
| `trace_id` | `string?` | Trace ID |
| `derived_from_event_id` | `string?` | Derived from event |
| `payload` | `json` | Event payload |
| `created_at` | `timestamp` | Creation timestamp |

Rules:

- `EventEnvelope` only describes the event itself and does not carry consumption state for any consumer.
- Multi-consumer acknowledgment must be expressed through independent ack records, and must not reuse a single `consumed_at` field.

## 4. `EventConsumerAck` Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `ack_id` | `string` | Ack record ID |
| `event_id` | `string` | Target event |
| `consumer_id` | `string` | Stable consumer identifier |
| `status` | `pending \| acked \| failed \| skipped` | Consumption status |
| `last_attempt_at` | `timestamp?` | Last attempt timestamp |
| `acked_at` | `timestamp?` | Ack timestamp |
| `error_code?` | `string` | Last failure reason |

Rules:

- For Tier 1 events, `pending` ack records must be initialized for all required consumers according to the registry at submission time.
- `consumer_id` must be a stable identifier and must not change randomly after restarts.
- Duplicate acks for the same `event_id + consumer_id` are treated as idempotent updates by default, not new consumption facts.

## 5. Reliability Tiers

- `tier1`: Write to DB first, then emit; must be recoverable.
- `tier2`: Best-effort delivery; small percentage of loss acceptable.
- `tier3`: High-frequency transient events; memory or streaming channels may be preferred.

## 6. Event Naming Convention

Unified format: `<domain><separator><action>`

Current conventions:

- Business-facing / closed-loop / user-semantic events use dot notation for canonical naming: `domain.action`.
- Historical dispatch / worker / recovery / skill operational events currently retain colon format: `domain:action`.
- New OAPEFLIR, feedback, improve, and release category events must not introduce new colon naming.

Stable event types retained after Ring 1 at minimum:

- `platform.harness_run.created`
- `platform.harness_run.status_changed`
- `platform.harness_run.completed`
- `platform.harness_run.failed`
- `platform.node_run.created`
- `platform.node_run.completed`
- `approval.requested`
- `approval.resolved`
- `execution:status_changed`
- `cost:limit_reached`
- `oapeflir.view.run_lifecycle`
- `feedback.signal_received`
- `learn.object_created`
- `learn.object_promoted`
- `improve.candidate_proposed`
- `improve.candidate_accepted`
- `release.rollout_started`
- `release.rollout_completed`
- `release.rollback_triggered`
- `stream.chunk_emitted`
- `dispatch:ticket_created`
- `dispatch:ticket_claimed`
- `dispatch:decision_recorded`
- `dispatch:ticket_reconciled`
- `dispatch:ticket_requeued`
- `worker:claim_accepted`
- `worker:claim_rejected`
- `worker:heartbeat_recorded`
- `worker:writeback_recorded`
- `worker:writeback_rejected`
- `worker:lease_released_after_writeback`
- `takeover:session_opened`
- `takeover:action_applied`
- `takeover:acknowledged`
- `takeover:completed`
- `takeover:timeout`
- `takeover:escalated`
- `takeover:cancelled`
- `takeover:request_enqueued`
- `takeover:request_processed`
- `takeover:ack_expired`
- `recovery:repair_applied`
- `recovery:decision_recorded`
- `recovery:dead_lettered`
- `recovery:cancelled`
- `skill:execution_started`
- `skill:cache_miss`
- `skill:cache_hit`
- `skill:cache_stored`
- `skill:step_started`
- `skill:retry_scheduled`
- `skill:step_succeeded`
- `skill:step_failed`
- `skill:execution_completed`

See `event_registry_and_ops_threshold_contract.md` for the full registry.

Rules:

- `domain` uses stable nouns; do not use implementation detail words.
- `action` uses past tense or completed semantics; avoid ambiguous words.
- New event types must be registered in the schema registry before implementation.

## 7. Event Schema Registry

Each event type must be defined in the registry:

- `type`
- `tier`
- `payload_schema`
- `producer`
- `consumers`
- `notes?`

Rules:

- `payload_schema` is the authoritative schema.
- Producers and consumers must not depend on unregistered event types.
- Breaking schema changes must go through explicit version evolution or new types.

Currently, OAPEFLIR closed-loop minimum requires the following projection view events to have explicit schema:

- `oapeflir.view.observe.signals_collected`
- `oapeflir.view.assess.evaluation_completed`
- `oapeflir.view.plan.proposal_created`
- `feedback.signal_received`
- `learn.object_created`
- `learn.object_promoted`
- `improve.candidate_proposed`
- `improve.candidate_accepted`
- `release.rollout_started`
- `release.rollout_completed`
- `release.rollback_triggered`
- `loop.iteration_completed`

## 8. StreamBridge and EventBus Boundary

- EventBus is responsible for platform factual events and recoverable event semantics.
- StreamBridge is responsible for translating events or progress into channel display streams.
- `stream.chunk_emitted` can be an EventBus event, but the display chunk itself is not an upstream source of truth.
- High-frequency display traffic may use `tier3` or StreamBridge only, and must not pollute the `tier1` recovery chain.

## 9. Behavioral Constraints

- Tier 1 events must support replay.
- Consumers must be idempotent.
- Event types should be stably named and not changed frequently.
- Stream-class high-frequency events should not be forced through heavy persistence paths.
- If multiple consumers exist for Tier 1, each must be acknowledged separately by `event_id + consumer_id`.
- One consumer's failure must not overwrite other consumers' acknowledgment status.
- When triggering resend/replay, only consumers still in `pending / failed` status for the target should be replayed, not broadcast to all already-acknowledged consumers.

## 10. Failure Semantics

- Emit failed but persisted: replay allowed later.
- Consumption failed: retry according to consumer strategy; do not delete Tier 1 events directly.
- Duplicate consumption: consumers must safely handle it.
- If a consumer has not acked for a long time, identify through the ack table, rather than treating the entire event as "unconsumed".

## 11. Supplementary Rules

- Event registry is authoritative at the documentation layer; code layer should map to a centralized schema registry module.
- When upgrading to cross-process bus, event type name, tier, and payload schema remain unchanged; changes only occur at the transport layer.