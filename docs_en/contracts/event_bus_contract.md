# Event Bus Contract

> **v4.3 compatibility note**: This document defines bus semantics, namespaces, and consumption constraints. `EventEnvelope` canonical fields follow [event-envelope-contract.md](./event-envelope-contract.md); truth events can only use `platform.*`, `oapeflir.view.*` / `oapeflir.rationale.*` only as projection.

> **Update date**: 2026-05-01

## 1. Scope

This contract defines the platform event bus, event reliability tiers, persistence requirements, naming conventions, and consumption semantics.

## 2. Key Objects

- `EventEnvelope`
- `EventTier`
- `EventConsumerAck`
- `EventSchemaRegistry`
- `RegisteredEventType`

## 3. EventEnvelope and Association Anchors

Canonical `EventEnvelope` fields are defined in [event-envelope-contract.md](./event-envelope-contract.md).

Additional constraints at this layer:

- Truth event association anchor must use `runId + aggregateType + aggregateId + aggregateSeq`.
- If payload needs to expose specific run chain objects, should prioritize using `harnessRunId`, `nodeRunId`, `planGraphId`, `attemptId`.
- `task_id`, `workflow_id`, `execution_id` are only allowed in legacy compatibility adapters, not as primary association fields in new event payloads.
- `EventEnvelope` only describes the event itself and does not carry a consumer's consumption state.
- Multi-consumer acknowledgment must be expressed through separate ack records, cannot reuse a single `consumed_at` field.

## 4. EventConsumerAck

| Field | Type | Description |
| --- | --- | --- |
| `ackId` | `string` | Ack record ID |
| `eventId` | `string` | Target event |
| `consumerId` | `string` | Consumer stable identifier |
| `status` | `pending \| acked \| failed \| skipped` | Consumption status |
| `lastAttemptAt` | `timestamp?` | Last attempt time |
| `ackedAt` | `timestamp?` | Acknowledgment time |
| `errorCode` | `string?` | Most recent failure reason |

Rules:

- Tier 1 event submission must initialize `pending` ack records for all required consumers according to registry.
- `consumerId` must be a stable identifier and must not change randomly after restart.
- Duplicate ack for same `eventId + consumerId` is by default treated as idempotent update, not new consumption fact.

## 5. Reliability Classification

- `tier1`: Write to DB first then emit; must be recoverable.
- `tier2`: Best-effort delivery; small proportion of loss acceptable.
- `tier3`: High-frequency transient events; can prioritize memory or streaming channels.

## 6. Event Naming Convention

Unified adoption: `<namespace>.<aggregate_or_domain>.<action>`

Rules:

- Truth event namespace can only be `platform.*`.
- OAPEFLIR view / explanation events can only be `oapeflir.view.*` or `oapeflir.rationale.*`.
- `dispatch:*` / `worker:*` / `takeover:*` / `recovery:*` / `skill:*` can continue to exist as operational diagnostics or compatibility events, but must not impersonate truth fact.
- New event types must not use `task.*`, `workflow.*`, `execution.*` as canonical run fact naming.

Stable canonical event types retained after Ring 1 at minimum include:

- `platform.harness_run.created`
- `platform.harness_run.admitted`
- `platform.harness_run.planning`
- `platform.harness_run.ready`
- `platform.harness_run.status_changed`
- `platform.harness_run.completed`
- `platform.harness_run.aborted`
- `platform.node_run.created`
- `platform.node_run.admitted`
- `platform.node_run.ready`
- `platform.node_run.status_changed`
- `platform.node_run.completed`
- `platform.node_run.failed`
- `platform.node_run.skipped`
- `platform.budget.reservation_created`
- `platform.budget.reservation_released`
- `platform.budget.exhausted`
- `platform.release.started`
- `platform.release.completed`
- `platform.release.rollback_triggered`
- `platform.approval.requested`
- `platform.approval.resolved`
- `platform.feedback.signal_received`
- `platform.learn.object_created`
- `platform.learn.object_promoted`
- `platform.improve.candidate_proposed`
- `platform.improve.candidate_accepted`
- `platform.loop.iteration_completed`
- `oapeflir.view.observe.signals_collected`
- `oapeflir.view.assess.evaluation_completed`
- `oapeflir.view.plan.proposal_created`

Legacy / compatibility mapping:

- `platform.harness.run.*` -> `platform.harness_run.*`
- `platform.node.run.*` -> `platform.node_run.*`
- `approval.*` -> `platform.approval.*` (if carrying truth fact)
- `feedback.*` -> `platform.feedback.*` (if carrying truth fact)
- `learn.*` -> `platform.learn.*` (if carrying truth fact)
- `improve.*` -> `platform.improve.*` (if carrying truth fact)
- `release.*` -> `platform.release.*` (if carrying truth fact)
- `loop.*` -> `platform.loop.*` (if carrying truth fact)

## 7. Event Schema Registry

Each event type must be defined in the registry:

- `type`
- `tier`
- `payloadSchemaRef`
- `producer`
- `consumers`
- `compatibilityPolicy`
- `notes?`

Rules:

- `payloadSchemaRef` is authoritative schema.
- Neither producers nor consumers can depend on unregistered event types.
- Schema-breaking changes must go through explicit version evolution or new type.

Current OAPEFLIR loop minimum requires the following events to have explicit schema:

- `platform.harness_run.status_changed`
- `platform.node_run.status_changed`
- `platform.release.started`
- `platform.release.completed`
- `platform.release.rollback_triggered`
- `platform.feedback.signal_received`
- `platform.learn.object_created`
- `platform.improve.candidate_proposed`
- `oapeflir.view.observe.signals_collected`
- `oapeflir.view.assess.evaluation_completed`
- `oapeflir.view.plan.proposal_created`

## 8. StreamBridge and EventBus Boundary

- EventBus is responsible for platform fact events and recoverable event semantics.
- StreamBridge is responsible for translating events or progress into channel display streams.
- `stream.chunk_emitted` can be an EventBus event, but the display chunk itself is not an upstream fact source.
- High-frequency display traffic can go through `tier3` or only StreamBridge, and must not pollute `tier1` recovery chain.

## 9. Behavioral Constraints

- Tier 1 events must support replay.
- Consumers must be idempotent.
- Event types should be stably named and not frequently changed.
- Stream-class high-frequency events should not forcedly go through heavy persistence path.
- If Tier 1 has multiple consumers, must acknowledge separately by `eventId + consumerId`.
- One consumer's failure must not overwrite other consumers' acknowledgment status.
- During startup resend, must only replay target consumers still in `pending / failed`, not rebroadcast to all already-acknowledged consumers.

## 10. Failure Semantics

- Emit failed but persisted: allowed to replay later.
- Consumption failed: retry according to consumer strategy; must not directly delete Tier 1 events.
- Duplicate consumption: consumers must handle safely.
- If a consumer has not ack'd for a long time, should identify through ack table, not treat the entire event as "unconsumed".

## 11. Supplementary Rules

- Event registry is authoritative at document layer; code layer should map to centralized schema registry module.
- When upgrading to cross-process bus, event type name, tier, and payload schema remain unchanged; changes only occur at transport layer.
- `release.*` bare namespace is neither v4.3 truth namespace nor OAPEFLIR view namespace; if it still exists, must explicitly map to `platform.release.*` or `oapeflir.view.release.*` at boundary layer.
