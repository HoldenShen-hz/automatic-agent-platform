# Event Registry And Ops Threshold Contract

## Purpose

Constrain the relationship between event registry and ops thresholds, ensuring default consumer sets, replay scopes, and operational thresholds have a unified source.

## Authority Rules

- Default Tier-1 consumer set comes from event schema registry.
- Ops surface reads registry to generate default drain/replay targets, and must not manually maintain a second consumer whitelist.
- Event ops thresholds must at least cover:
  - Single replay timeout
  - Single drain timeout
  - Backlog/failed queue observation thresholds

## Consistency Requirements

- When a new consumer is added to the registry, the event ops default consumer set should automatically include that consumer.
- Registry and ops document references must point to the same contract, and must not implicitly agree only in code.

## Runtime-Service Operational Signals

The following async runtime-service observation signals belong to contract surface; when adding, deleting, or renaming, this section must be synchronously updated and audited via CI:

- `event_published`: Durable event bus completed single event publication.
- `event_delivered`: Durable event bus completed single consumer delivery.
- `event_delivery_failed`: Durable event bus failed to deliver to a single consumer.
- `event_dead_lettered`: Durable event bus sent deliveries exceeding threshold to dead-letter.
- `subscriber_added`: Durable event bus added a subscriber.
- `subscriber_removed`: Durable event bus removed a subscriber.
- `batch_flush`: Batching runtime service executed batch flush.
- `circuit_breaker_open`: Dispatch/handshake/writeback/event bus/takeover async protector opened.
- `circuit_breaker_close`: Dispatch/handshake/writeback/event bus/takeover async protector closed.
- `operation_start`: Dispatch/handshake/takeover async operation started.
- `operation_complete`: Dispatch/handshake/takeover async operation completed.
- `operation_retry`: Dispatch/handshake/takeover async operation entered retry.
- `operation_timeout`: Dispatch/handshake/takeover async operation timed out.
- `queue_overflow`: Dispatch/handshake/writeback/takeover async queue reached upper limit.
- `writeback_start`: Worker writeback async writeback started.
- `writeback_complete`: Worker writeback async writeback completed.
- `writeback_retry`: Worker writeback async writeback entered retry.
- `writeback_timeout`: Worker writeback async writeback timed out.
- `writeback_coalesced`: Worker writeback coalescing window converged multiple writebacks into single commit.
- `session_opened`: Async human takeover service opened human takeover session.
- `session_closed`: Async human takeover service closed human takeover session.

### Constraints

- The authoritative naming source for these signals is the external `type` union in `src/scale-ecosystem/runtime-services/*.ts`, not free-form log text.
- These signals are used for observability, capacity protection, and operational status auditing; they are not a replacement for business domain event schemas.
- If multiple runtime services reuse the same signal name, semantic hierarchy must be consistent, for example `operation_*` denotes async operation lifecycle, `circuit_breaker_*` denotes protector state transitions.

## Related Implementation

- `src/platform/five-plane-state-evidence/events/event-registry.ts`
- `src/platform/five-plane-state-evidence/events/event-ops-service.ts`
- `src/scale-ecosystem/runtime-services/durable-event-bus-async.ts`
- `src/scale-ecosystem/runtime-services/execution-dispatch-service-async.ts`
- `src/scale-ecosystem/runtime-services/execution-worker-handshake-service-async.ts`
- `src/scale-ecosystem/runtime-services/execution-worker-writeback-service-async.ts`
- `src/scale-ecosystem/runtime-services/human-takeover-service-async.ts`