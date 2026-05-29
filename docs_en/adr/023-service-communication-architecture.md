# ADR-023 Service Communication Architecture

- Status: Accepted
- Decision Date: 2026-04-03

## Background

Intra-plane and cross-plane service calls need unified timeout, reconnection, and event delivery mechanisms to avoid single points of failure and information loss.

## Decision

### Timeout Strategy

- Synchronous call default timeout: 5s
- Maximum timeout: 30s
- Supports header override, but not exceeding max clamp
- Configuration unified in `config/runtime/default.json`

### Stream Reconnection Mechanism

- DurableEventBus supports last_event_id recovery
- After disconnection, automatically resumes from last acknowledged event

### Outbox Pattern

- Same-transaction write events: Business operations and event delivery must be in same database transaction
- OutboxService (219 lines) implements reliable event delivery
- Ensures events are not lost

### Phase 1 Architecture

- Phase 1 is monolithic architecture
- Intra-process calls go through direct function calls
- Cross-process calls go through HTTP

## Consequences

Benefits:

- Unified timeout configuration avoids requests waiting indefinitely
- Outbox pattern ensures event reliability
- last_event_id enables stream reconnection

Costs:

- Outbox pattern increases transaction complexity
- Timeout configuration needs global coordination

## Cross-References

- [ADR-021 Inter-Plane Communication Contract](./021-inter-plane-communication-contract.md)
- [ADR-012 SQLite Whether as Phase 1-2 Only Primary Storage](./012-sqlite-phase-1-2-primary-store.md)

## Source Sections

- `§7` Service Communication Architecture