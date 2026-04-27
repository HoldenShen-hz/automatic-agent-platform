# Event Bus Contract

> **OAPEFLIR Related**: This contract defines the event bus mechanism for OAPEFLIR 8 phases, corresponding to ADR-016 §Dual Chain Topology and ADR-079/ADR-080.
> **Updated**: 2026-04-17

## 1. Scope

This contract defines the platform event bus, event reliability levels, persistence requirements, naming conventions, and consumer semantics.

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
| `tier` | `tier1 \| tier2 \| tier3` | Reliability level |
| `task_id` | `string?` | Associated task |
| `session_id` | `string?` | Associated session |
| `loop_iteration` | `integer?` | OAPEFLIR iteration number |
| `stage` | `string?` | Associated OAPEFLIR stage |
| `trace_id` | `string?` | Trace ID |
| `payload` | `json` | Event body |
| `created_at` | `timestamp` | Creation time |

Rules:

- `EventEnvelope` only describes the event itself, does not carry consumption status of any consumer.
- Multi-consumer acknowledgment must be expressed through separate ack records, cannot reuse single `consumed_at` field.

## 4. EventConsumerAck Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `ack_id` | `string` | Ack record ID |
| `event_id` | `string` | Target event |
| `consumer_id` | `string` | Consumer stable identifier |
| `status` | `pending \| acked \| failed \| skipped` | Consumption status |
| `last_attempt_at` | `timestamp?` | Last attempt time |
| `acked_at` | `timestamp?` | Acknowledged time |
| `error_code?` | `string` | Last failure reason |

Rules:

- Tier 1 events, when submitted, must initialize `pending` ack records for all required consumers according to registry.
- `consumer_id` must be a stable identifier and must not change randomly after restart.
- Duplicate acks for the same `event_id + consumer_id` default to idempotent updates rather than new consumption facts.

## 5. Reliability Classification

- `tier1`: Must write to DB before emit, must be recoverable.
- `tier2`: Best-effort delivery, can accept small proportion loss.
- `tier3`: High-frequency transient events, can prioritize memory or streaming channels.

## 6. Event Naming Convention

Unified format: `<domain><separator><action>`

Current conventions:

- For business / closed-loop / user semantic events, canonical naming uses dots: `domain.action`.
- Historical dispatch / worker / recovery / skill operational events currently preserve colon format: `domain:action`.
- New OAPEFLIR, feedback, improve, release events must not introduce new colon naming.

Phase 1a stable event types at least include:

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

For complete registry, see `event_registry_and_ops_threshold_contract.md`.

Rules:

- `domain` uses stable nouns, not implementation detail words.
- `action` uses past tense or perfect aspect semantics, avoiding vague words.
- New event types must be registered in schema registry before entering implementation.

## 7. Event Schema Registry

Each event type must define in registry:

- `type`
- `tier`
- `payload_schema`
- `producer`
- `consumers`
- `notes?`

Rules:

- `payload_schema` is the authoritative schema.
- Neither producers nor consumers can depend on unregistered event types.
- Schema breaking changes must go through explicit version evolution or new types.

Current OAPEFLIR closed loop requires at least the following events to have explicit schema:

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

- EventBus is responsible for platform factual events and recoverable event semantics.
- StreamBridge is responsible for translating events or progress into channel display streams.
- `stream.chunk_emitted` can be an EventBus event, but display chunks themselves are not authoritative fact sources.
- High-frequency display traffic can go through `tier3` or only StreamBridge, must not pollute `tier1` recovery chain.

## 9. Behavior Constraints

- Tier 1 events must support replay.
- Consumers must be idempotent.
- Event types should be stably named, not frequently changed.
- Stream high-frequency events should not forcibly go through heavy persistence path.
- If Tier 1 has multiple consumers, must acknowledge separately by `event_id + consumer_id`.
- Single consumer failure must not overwrite other consumers' acknowledgment status.
- During startup resend, must only replay still `pending / failed` target consumers, not rebroadcast to all acknowledged consumers.

## 10. Failure Semantics

- Emit failure but already persisted: Allow replay later.
- Consumer failure: Retry according to consumer strategy, must not directly delete Tier 1 events.
- Duplicate consumption: Consumers must handle safely.
- If some consumer has not acked for long time, should identify through ack table, not treat entire event as "unconsumed".

## 11. Supplementary Rules

- Event registry is authoritative at document layer, code layer should map to centralized schema registry module.
- When upgrading to cross-process bus, event type name, tier, and payload schema remain unchanged; changes only occur at transport layer.
