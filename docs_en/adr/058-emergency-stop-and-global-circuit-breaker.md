# ADR-058 Emergency Stop and Global Circuit Breaker Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

When security incidents occur, the platform needs to instantly stop all Agent operations, and a global circuit breaker prevents failure propagation.

## Decision

### Emergency Stop Levels

| Level | Name | Scope of Impact |
|-------|------|-----------------|
| L0 | none | Normal operation |
| L1 | pause_new | Pause new task creation |
| L2 | pause_all | Pause all execution |
| L3 | kill_all | Terminate all running tasks |
| L4 | lockdown | Lock platform, read-only operations only |

### Trigger Conditions

| Condition | Level |
|-----------|-------|
| Manual trigger | L1-L4 |
| SEV1 event | L2 |
| Continuous failure > 90% | L3 |
| Security attack detected | L4 |

### Global Circuit Breaker

```typescript
interface GlobalCircuitBreaker {
  state: 'closed' | 'open' | 'half_open';
  threshold: number;       // Failure rate threshold
  window_ms: number;      // Statistical window
  open_duration_ms: number; // Duration of circuit break
}
```

### Recovery Process

1. Event resolved
2. Manual confirmation
3. Degraded observation (half_open)
4. Gradually restore traffic
5. Full recovery

### Access Control

- Emergency stop requires specific permissions
- Operations require double confirmation
- All operations recorded in audit logs

## Consequences

Positive:

- Fast response to security incidents
- Prevent failure propagation
- Graduated recovery reduces impact

Negative:

- Emergency stop affects business continuity
- Recovery process requires careful design

## Cross-References

- [ADR-025 Stability Architecture](./025-stability-architecture-seven-layers.md)
- [ADR-059 Agent Explainability](./059-agent-explainability-and-decision-transparency.md)

## Source Sections

- `§60` Emergency Stop and Global Circuit Breaker Architecture