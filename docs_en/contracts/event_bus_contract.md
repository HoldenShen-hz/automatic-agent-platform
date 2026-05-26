# Event Bus Contract

## Purpose
Define minimum authoritative constraints for platform durable event bus, covering event append, consumer replay, timeout and failure semantics.

## Core Constraints
- Event truth source is authoritative event storage, not projection cache.
- Tier-1 consumer must be replayable, and after `resetConsumerReplayState` re-enters pending delivery state.
- `drainConsumer` / `replayConsumer` must return structured result, must not impersonate failure with "empty result".
- Replay chain must have timeout protection; timeout result explicitly marked as `timeout`.
- Event bus operation log must retain `consumerId`, `errorCode`, `pendingBefore/After`, `failedBefore/After`.

## Operation Semantics
- `drainConsumer(consumerId)`
  - Success: `outcome = delivered`
  - Delivery exception: `outcome = failed`
  - Timeout: `outcome = timeout`
- `replayConsumer(consumerId)`
  - First reset replay state, then trigger drain
  - Must return `replayedFromHistoryCount`

## Failure Handling
- fetch / replay / drain failure must not be silently swallowed.
- Any error must fall into structured log, with context that can locate consumer.

## Related Implementation
- `src/platform/five-plane-state-evidence/events/event-ops-service.ts`
- `src/platform/five-plane-state-evidence/events/durable-event-bus.ts`
