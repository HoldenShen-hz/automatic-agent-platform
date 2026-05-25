# Event Bus Contract

## Purpose
Defines the authoritative baseline for the durable event bus: append, replay, timeout, and failure semantics.

## Core Rules
- Truth comes from the authoritative event repository, not projections.
- Tier-1 consumers must be replayable.
- `drainConsumer` and `replayConsumer` must return structured outcomes.
- Replay must be timeout-protected and return `timeout` explicitly.

## Relevant Code
- `src/platform/five-plane-state-evidence/events/event-ops-service.ts`
- `src/platform/five-plane-state-evidence/events/durable-event-bus.ts`

