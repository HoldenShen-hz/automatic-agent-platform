# Event Bus Contract

> **OAPEFLIR Association**: This contract defines the OAPEFLIR 8-stage event bus mechanism, corresponding to ADR-016 §Dual Chain Topology and ADR-079/ADR-080.
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
| `task_id` | `string?` | Associated task |
| `session_id` | `string?` | Associated session |
| `loop_iteration` | `integer?` | OAPEFLIR iteration number |
| `stage` | `string?` | Associated OAPEFLIR stage |
| `trace_id` | `string?` | Trace ID |
| `payload` | `json` | Event body |
| `created_at` | `timestamp` | Creation time |

Rules:

- `EventEnvelope` only describes the event itself and does not carry consumption status for any consumer.
- Multi-consumer acknowledgments must be expressed through separate ack records and cannot reuse a single `consumed_at` field.

## 4. `EventConsumerAck` Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `ack_id` | `string` | Ack record ID |
| `event_id` | `string` | Target event |
| `consumer_id` | `string` | Consumer stable identifier |
| `status` | `pending \| acked \| failed \| skipped` | Consumption status |
| `last_attempt_at` | `timestamp?` | Last attempt time |
| `acked_at` | `timestamp?` | Acknowledgment time |
| `error_code?` | `string` | Last failure reason |

Rules:

- For Tier 1 events, `pending` ack records must be initialized for all required consumers via the registry upon submission.
- `consumer_id` must be a stable identifier and must not change randomly after restarts.
- Duplicate acks for the same `event_id + consumer_id` are treated as idempotent updates by default, not new consumption facts.

## 5. Reliability Tiers

- `tier1`: Write to DB first, then emit; must be recoverable.
- `tier2`: Best-effort delivery; small proportion of loss acceptable.
- `tier3`: High-frequency transient events; may prioritize memory or streaming channels.

## 6. Event Naming Conventions

Unified format: `<domain><separator><action>`

Current conventions:

- For business-facing / closed-loop / user-semantic events, canonical naming uses dots: `domain.action`.
- Historical dispatch/worker/recovery/skill operations events currently retain colon format: `domain:action`.
- New OAPEFLIR, feedback, improve, release events must not introduce new colon naming.

Phase 1a stable event types to retain include at least:

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

Full registry at `event_registry_and_ops_threshold_contract.md`.

Rules:

- `domain` uses stable nouns, not implementation detail words.
- `action` uses past tense or perfect aspect semantics, avoiding vague words.
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
- Schema-breaking changes must go through explicit version evolution or new types.

Current OAPEFLIR closed-loop minimum requires these events to have explicit schema:

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

## 8. StreamBridge and EventBus Boundary

- EventBus is responsible for platform fact events and recoverable event semantics.
- StreamBridge is responsible for translating events or progress into channel display streams.
- `stream.chunk_emitted` can be an EventBus event, but the display chunk itself is not an upstream fact source.
- High-frequency display traffic may use `tier3` or only StreamBridge, and must not pollute `tier1` recovery chain.

## 9. Behavioral Constraints

- Tier 1 events must support replay.
- Consumers must be idempotent.
- Event types should be stably named and not change frequently.
- High-frequency stream events should not force heavy persistence paths.
- If Tier 1 has multiple consumers, each must be acknowledged separately by `event_id + consumer_id`.
- A single consumer's failure must not overwrite other consumers' acknowledgment status.
- When initiating replay, only replay still-pending/failed target consumers, not rebroadcast to all acknowledged consumers.

## 10. Failure Semantics

- Emit failed but persisted: Allow replay later.
- Consumption failed: Retry according to consumer strategy; must not directly delete Tier 1 events.
- Duplicate consumption: Consumers must safely handle.
- If a consumer has not acked for a long time, identify via ack table, not treat the entire event as "unconsumed".

## 11. Supplementary Rules

- Event registry is authoritative at the documentation layer; code layer should map to centralized schema registry module.
- When upgrading to cross-process bus, event type name, tier, and payload schema remain unchanged; changes only occur at transport layer.
