# Event Bus Contract

> **OAPEFLIR Related**: This contract defines the event bus mechanism for OAPEFLIR 8-stage pipeline, corresponding to ADR-016 §Dual Chain Topology and ADR-079/ADR-080.
> **Last Updated**: 2026-04-17

## 1. Scope

This contract defines platform event bus, event reliability tiers, persistence requirements, naming conventions, and consumer semantics.

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
| `task_id` | `string?` | Associated task |
| `session_id` | `string?` | Associated session |
| `loop_iteration` | `integer?` | OAPEFLIR iteration number |
| `stage` | `string?` | Associated OAPEFLIR stage |
| `trace_id` | `string?` | Trace ID |
| `payload` | `json` | Event body |
| `created_at` | `timestamp` | Creation timestamp |

Rules:

- `EventEnvelope` only describes the event itself, it does not carry consumption state for any consumer.
- Multi-consumer acknowledgment must be expressed through separate ack records, not by reusing a single `consumed_at` field.

## 4. `EventConsumerAck` Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `ack_id` | `string` | Ack record ID |
| `event_id` | `string` | Target event |
| `consumer_id` | `string` | Consumer stable identifier |
| `status` | `pending \| acked \| failed \| skipped` | Consumption status |
| `last_attempt_at` | `timestamp?` | Last attempt timestamp |
| `acked_at` | `timestamp?` | Ack timestamp |
| `error_code?` | `string` | Last failure reason |

Rules:

- For Tier 1 events, on submission, must initialize `pending` ack records for all required consumers according to the registry.
- `consumer_id` must be a stable identifier, it must not change randomly after restart.
- Duplicate acks for the same `event_id + consumer_id` are by default treated as idempotent updates, not new consumption facts.

## 5. Reliability Tiers

- `tier1`: Write to DB first, then emit; must be recoverable.
- `tier2`: Best-effort delivery; small proportion of loss acceptable.
- `tier3`: High-frequency transient events; may prioritize memory or streaming channels.

## 6. Event Naming Conventions

Unified format: `<domain><separator><action>`

Current specifications:

- For business-facing / closed-loop / user-semantic events, canonical naming uses dot: `domain.action`.
- Legacy dispatch / worker / recovery / skill operational events currently retain colon format: `domain:action`.
- New OAPEFLIR, feedback, improve, release events must not introduce new colon naming.

Phase 1a stable event types include at least:

- `task.status_changed`
- `workflow.step_completed`
- `approval.requested`
- `approval.resolved`
- `feedback.signal_received`
- `learn.object_created`
- `learn.object_promoted`
- `improve.candidate_proposed`
- `improve.candidate_accepted`
- `release.rollout_started`
- `release.rollout_completed`
- `release.rollback_triggered`
- `loop.iteration_completed`
- `gateway.message_received`
- `stream.chunk_emitted`
- `dispatch:ticket_created`
- `dispatch:ticket_claimed`
- `dispatch:decision_recorded`
- `worker:claim_accepted`
- `worker:writeback_recorded`
- `takeover:initiated`
- `takeover:completed`
- `recovery:started`
- `recovery:completed`
- `skill:execution_started`
- `skill:execution_completed`

Full registry see `event_registry_and_ops_threshold_contract.md`.

Rules:

- `domain` uses stable nouns, not implementation detail words.
- `action` uses past tense or completed semantics, avoid vague words.
- New event types must be registered in schema registry before entering implementation.

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
- Schema-breaking changes must go through explicit version evolution or new types.

Current OAPEFLIR closed-loop minimum requires the following events to have explicit schema:

- `oapeflir.observe.signals_collected`
- `oapeflir.assess.evaluation_completed`
- `oapeflir.plan.proposal_created`
- `feedback.signal_received`
- `learn.object_created`
- `learn.object_promoted`
- `improve.candidate_proposed`
- `improve.candidate_accepted`
- `release.rollout_started`
- `release.rollout_completed`
- `release.rollback_triggered`
- `loop.iteration_completed`

## 8. StreamBridge And EventBus Boundary

- EventBus is responsible for platform factual events and recoverable event semantics.
- StreamBridge is responsible for translating events or progress into channel display streams.
- `stream.chunk_emitted` can be an EventBus event, but the display chunk itself is not the upstream factual source.
- High-frequency display traffic may use `tier3` or only StreamBridge, must not pollute `tier1` recovery chain.

## 9. Behavioral Constraints

- Tier 1 events must support replay.
- Consumers must be idempotent.
- Event types should be stably named, not frequently changed.
- Stream-type high-frequency events should not forced through heavy persistence path.
- If Tier 1 has multiple consumers, must acknowledge separately per `event_id + consumer_id`.
- Single consumer failure must not overwrite other consumers' acknowledged status.
- When initiating resend, must only replay target consumers still in `pending / failed`, not rebroadcast to all already-acknowledged consumers.

## 10. Failure Semantics

- Emit failed but persisted: allow retry later.
- Consumption failed: retry according to consumer strategy; must not directly delete Tier 1 events.
- Duplicate consumption: consumers must handle safely.
- If some consumer has not ack'd for a long time, should identify through ack table, not treat the entire event as "unconsumed".

## 11. Supplementary Rules

- Event registry is authoritative at document layer; code layer should map to centralized schema registry module.
- When upgrading to cross-process bus, event type name, tier, and payload schema remain unchanged; changes only occur at transport layer.