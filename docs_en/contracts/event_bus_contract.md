# Event Bus Contract

> Companion note:
> The complete `EventEnvelope` field set and event naming authority are in `event-envelope-contract.md`.
> This document only constrains the durable bus delivery, replay, and failure semantics.

## Purpose

Define the minimum authoritative constraints for the platform durable event bus, covering event append, consumer replay, timeout, and failure semantics.

## Core Constraints

- The source of event truth is the authoritative event repository, not projection cache.
- Tier-1 consumers must be replayable, and after `resetConsumerReplayState` must re-enter pending delivery state.
- `drainConsumer`/`replayConsumer` must return structured results and must not use "empty result" to disguise failures.
- Replay chain must have timeout protection; timeout results must be explicitly marked as `timeout`.
- Event bus operation logs must retain `consumerId`, `errorCode`, `pendingBefore/After`, `failedBefore/After`.

## Operation Semantics

- `drainConsumer(consumerId)`
  - Success: `outcome = delivered`
  - Delivery exception: `outcome = failed`
  - Timeout: `outcome = timeout`
- `replayConsumer(consumerId)`
  - First reset replay state, then trigger drain
  - Must return `replayedFromHistoryCount`

## Failure Handling

- Fetch/replay/drain failures must not be silently swallowed.
- Any error must be written to structured logs with context that can locate the consumer.

## Related Implementation

- `src/platform/five-plane-state-evidence/events/event-ops-service.ts`
- `src/platform/five-plane-state-evidence/events/durable-event-bus.ts`