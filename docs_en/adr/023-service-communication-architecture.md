# ADR-023 Service Communication Architecture

- Status: Accepted
- Decision Date: 2026-04-03

## Context

Intra-plane and cross-plane service calls require unified timeout, reconnect, and event delivery mechanisms to avoid single points of failure and message loss.

## Decision

### Timeout Strategy

- Default sync call timeout: 5s
- Maximum timeout: 30s
- Header override supported, but not exceeding max clamp
- Configuration unified in `config/runtime/default.json`

### Stream Reconnect Mechanism

- DurableEventBus supports last_event_id recovery
- After disconnect, automatically continues from last confirmed event

### Outbox Pattern

- Business operations and event delivery must be in same database transaction
- OutboxService (219 lines) implements reliable event delivery
- Ensures events are not lost

### Phase 1 Architecture

- Phase 1 is monolithic architecture
- In-process calls go through direct function invocation
- Cross-process calls go through HTTP

## Consequences

Positive:
- Unified timeout configuration prevents requests from waiting indefinitely
- Outbox pattern ensures event reliability
- last_event_id enables stream reconnection

Negative:
- Outbox pattern increases transaction complexity
- Timeout configuration requires global coordination

Trade-offs:
- Reliability vs. complexity
- Consistency vs. performance

## Cross-References

- [ADR-021 Inter-Plane Communication Contract](./021-inter-plane-communication-contract.md)
- [ADR-012 SQLite as Phase 1-2 Primary Storage](./012-sqlite-phase-1-2-primary-store.md)

## Source Sections

- `§7` Service Communication Architecture