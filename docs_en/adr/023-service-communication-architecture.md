# ADR-023 Service Communication Architecture

- Status: Accepted
- Decision Date: 2026-04-03

## Context

Intra-plane and cross-plane service calls need unified timeout, reconnection, and event delivery mechanisms to avoid single points of failure and information loss.

## Decision

### Timeout Strategy

- Default timeout for synchronous calls: 5s
- Maximum timeout: 30s
- Supports header override, but cannot exceed max clamp
- Configuration unified in `config/runtime/default.json`

### Stream Reconnection Mechanism

- DurableEventBus supports last_event_id recovery
- Automatically resumes from the last confirmed event after disconnection

### Outbox Pattern

- Same-transaction event writing: business operations and event delivery must be in the same database transaction
- OutboxService (219 lines) implements reliable event delivery
- Ensures events are not lost

### Phase 1 Architecture

- Phase 1 is a monolith architecture
- In-process calls use direct function invocation
- Cross-process calls use HTTP

## Consequences

Benefits:

- Unified timeout configuration prevents requests from waiting indefinitely
- Outbox pattern ensures event reliability
- last_event_id enables stream reconnection

Trade-offs:

- Outbox pattern increases transaction complexity
- Timeout configuration requires global coordination

## Cross-references

- [ADR-021 Inter-Plane Communication Contract](./021-inter-plane-communication-contract.md)
- [ADR-012 SQLite as Phase 1-2 Only Primary Storage](./012-sqlite-phase-1-2-primary-store.md)

## Source Section

- `§7` Service Communication Architecture
