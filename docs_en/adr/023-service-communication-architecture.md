# ADR-023 Service Communication Architecture

- Status: Accepted
- Decision Date: 2026-04-03

## Context

Intra-plane service calls and cross-plane service calls require unified timeout, reconnection, and event delivery mechanisms to avoid single points of failure and information loss.

## Decision

### Timeout Strategy

- Default timeout for synchronous calls: 5s
- Maximum timeout: 30s
- Header override supported, but must not exceed max clamp
- Configuration unified in `config/runtime/default.json`

### Stream Reconnection Mechanism

- DurableEventBus supports last_event_id recovery
- After disconnection, automatically resumes from the last confirmed event

### Outbox Pattern

- Transactional event writing: Business operations and event delivery must be in the same database transaction
- OutboxService (219 lines) implements reliable event delivery
- Ensures events are not lost

### Phase 1 Architecture

- Phase 1 is a monolithic architecture
- In-process calls use direct function invocation
- Cross-process calls use HTTP

## Consequences

Benefits:

- Unified timeout configuration prevents requests from waiting indefinitely
- Outbox pattern ensures event reliability
- last_event_id enables stream reconnection

Costs:

- Outbox pattern increases transaction complexity
- Timeout configuration requires global coordination

## Cross References

- [ADR-021 Inter-Plane Communication Contract](./021-inter-plane-communication-contract.md)
- [ADR-012 Whether SQLite is the Sole Primary Storage for Phase 1-2](./012-sqlite-phase-1-2-primary-store.md)

## Source Section

- `§7` Service Communication Architecture
