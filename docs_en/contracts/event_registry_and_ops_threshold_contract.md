# Event Registry And Ops Threshold Contract

## Purpose
Aligns event registry ownership, default Tier-1 consumer discovery, and operational thresholds.

## Core Rules
- Default Tier-1 consumers are derived from the event schema registry.
- Event ops must not maintain a second manual allowlist.
- Replay and drain thresholds must be explicitly documented.

## Runtime-Service Operational Signals

The following async runtime-service observability signals are part of the contract surface. Any addition, removal, or rename must update this section and pass CI audit:

- `event_published`: the durable event bus completed publishing one event.
- `event_delivered`: the durable event bus completed delivery to one consumer.
- `event_delivery_failed`: the durable event bus failed to deliver to one consumer.
- `event_dead_lettered`: the durable event bus moved a delivery beyond threshold into dead-letter handling.
- `subscriber_added`: the durable event bus registered a subscriber.
- `subscriber_removed`: the durable event bus removed a subscriber.
- `batch_flush`: a batching runtime service flushed a batch.
- `circuit_breaker_open`: the async dispatch, handshake, writeback, event-bus, or takeover breaker opened.
- `circuit_breaker_close`: the async dispatch, handshake, writeback, event-bus, or takeover breaker closed.
- `operation_start`: an async dispatch, handshake, or takeover operation started.
- `operation_complete`: an async dispatch, handshake, or takeover operation completed.
- `operation_retry`: an async dispatch, handshake, or takeover operation entered retry.
- `operation_timeout`: an async dispatch, handshake, or takeover operation timed out.
- `queue_overflow`: an async dispatch, handshake, writeback, or takeover queue hit its configured ceiling.
- `writeback_start`: an async worker writeback started.
- `writeback_complete`: an async worker writeback completed.
- `writeback_retry`: an async worker writeback entered retry.
- `writeback_timeout`: an async worker writeback timed out.
- `writeback_coalesced`: the writeback coalescing window merged multiple writes into one submission.
- `session_opened`: the async human takeover service opened a takeover session.
- `session_closed`: the async human takeover service closed a takeover session.

### Constraints

- The authoritative names for these signals come from the exported public `type` unions in `src/scale-ecosystem/runtime-services/*.ts`, not from free-form log text.
- These signals serve observability, capacity protection, and runtime-state audit; they do not replace business-domain event schemas.
- When multiple runtime services reuse the same signal name, the semantic level must remain aligned. For example, `operation_*` denotes async operation lifecycle and `circuit_breaker_*` denotes breaker state transitions.

## Relevant Code
- `src/platform/five-plane-state-evidence/events/event-registry.ts`
- `src/platform/five-plane-state-evidence/events/event-ops-service.ts`
- `src/scale-ecosystem/runtime-services/durable-event-bus-async.ts`
- `src/scale-ecosystem/runtime-services/execution-dispatch-service-async.ts`
- `src/scale-ecosystem/runtime-services/execution-worker-handshake-service-async.ts`
- `src/scale-ecosystem/runtime-services/execution-worker-writeback-service-async.ts`
- `src/scale-ecosystem/runtime-services/human-takeover-service-async.ts`
