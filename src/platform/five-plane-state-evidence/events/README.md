# Events Boundary

This directory owns event types, durable event bus behavior, typed event bus behavior, CAS/fencing event support, and replayable event evidence.

## Rules

- Durable ordering, DLQ, and partition semantics belong here.
- Typed event schemas should stay canonical and avoid duplicate event definitions.
- Tests should prefer event-driven synchronization over timer-only assumptions.
