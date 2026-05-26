# Event Registry And Ops Threshold Contract

## Purpose
Constrain the relationship between event registry and ops thresholds, ensuring default consumer set, replay scope and runtime thresholds have a unified source.

## Authoritative Rules
- Default Tier-1 consumer set comes from event schema registry.
- Ops surface reads registry to generate default drain/replay targets, must not manually maintain second copy of consumer whitelist.
- Event ops thresholds cover at minimum:
  - Single replay timeout
  - Single drain timeout
  - Backlog / failed queue observation threshold

## Consistency Requirements
- When registry adds consumer, event ops default consumer set should automatically include that consumer.
- Registry and ops document references must point to same contract, must not only implicitly约定 in code.

## Runtime-Service Operational Signals

The following async runtime-service observation signals belong to contract surface; when adding, deleting or renaming, must synchronize this section and pass CI audit:

- `event_published`: durable event bus completed single event publish.
- `event_delivered`: durable event bus completed single consumer delivery.
- `event_delivery_failed`: durable event bus failed delivery to single consumer.
- `event_dead_lettered`: durable event bus delivered delivery exceeding threshold to dead-letter.
- `subscriber_added`: durable event bus added subscriber.
- `subscriber_removed`: durable event bus removed subscriber.
- `batch_flush`: batching runtime service executed batch flush.
- `circuit_breaker_open`: dispatch / handshake / writeback / event bus / takeover async protector opened.
- `circuit_breaker_close`: dispatch / handshake / writeback / event bus / takeover async protector closed.
- `operation_start`: dispatch / handshake / takeover async operation started.
- `operation_complete`: dispatch / handshake / takeover async operation ended.
- `operation_retry`: dispatch / handshake / takeover async operation entered retry.
- `operation_timeout`: dispatch / handshake / takeover async operation timed out.
- `queue_overflow`: dispatch / handshake / writeback / takeover async queue reached upper limit.
- `writeback_start`: worker writeback async write-back started.
- `writeback_complete`: worker writeback async write-back ended.
- `writeback_retry`: worker writeback async write-back entered retry.
- `writeback_timeout`: worker writeback async write-back timed out.
- `writeback_coalesced`: worker writeback coalesced window收敛 multiple write-backs into single commit.
- `session_opened`: async human takeover service opened human takeover session.
- `session_closed`: async human takeover service closed human takeover session.

### Constraints

- The authoritative naming source for these signals is the external `type` union in `src/scale-ecosystem/runtime-services/*.ts`, not log free text.
- These signals are for observability, capacity protection and runtime state audit; they are not substitutes for business domain event schema.
- If multiple runtime services reuse the same signal name, semantic levels must be kept consistent, e.g., `operation_*` represents async operation lifecycle, `circuit_breaker_*` represents protector state transition.

## Related Implementation
- `src/platform/five-plane-state-evidence/events/event-registry.ts`
- `src/platform/five-plane-state-evidence/events/event-ops-service.ts`
- `src/scale-ecosystem/runtime-services/durable-event-bus-async.ts`
- `src/scale-ecosystem/runtime-services/execution-dispatch-service-async.ts`
- `src/scale-ecosystem/runtime-services/execution-worker-handshake-service-async.ts`
- `src/scale-ecosystem/runtime-services/execution-worker-writeback-service-async.ts`
- `src/scale-ecosystem/runtime-services/human-takeover-service-async.ts`
