# ADR-058 Emergency Stop and Global Circuit Breaker

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Platform needs to respond quickly to cascading failures, requires emergency stop mechanism and global circuit breaker.

## Decision

### Emergency Stop Levels

| Level | Name | Scope of Impact |
|-------|------|-----------------|
| L0 | None | Normal operation |
| L1 | pause_new | Pause new runs via `OperationalDirective(type=pause_run)` or admission gate |
| L2 | pause_all | Pause all platform execution via `PlatformPanicDirective(scope=platform)` |
| L3 | kill_all | Terminate running runs via `OperationalDirective(type=kill_run)` or `PlatformPanicDirective(scope=platform)` |
| L4 | lockdown | Lock down platform via `PlatformPanicDirective(mode=incident-mode)`, allowing read-only operations |

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
  window_ms: number;      // Statistics window
  open_duration_ms: number; // Circuit breaker open duration before attempting half-open
}
```

**Important**: `open_duration_ms` is the timeout before transitioning from `open` to `half_open` (probe attempt). The circuit breaker does NOT automatically restore full function after `open_duration_ms` - it only transitions to `half_open` for probe. Explicit `closed` transition (manual or via successful probe) is required to fully restore. This distinguishes the circuit breaker from TTL-based auto-expiry patterns.

### Recovery Process

1. Event resolution
2. Manual confirmation
3. Degraded observation (half_open)
4. Gradually restore traffic
5. Complete recovery

### Access Control

- Emergency stop requires specific permissions
- Operations require secondary confirmation
- All operations are recorded in audit logs
- Emergency stop must be implemented through formal mechanisms: `PlatformPanicDirective` or `OperationalDirective`, not bare switch variables or bypass scripts.

## Consequences

Advantages:

- Rapid response to security incidents
- Prevents fault propagation
- Tiered recovery reduces impact

Costs:

- Emergency stop affects business continuity
- Recovery process requires careful design

## Cross-References

- [ADR-025 Stability Architecture - Seven Layers](./025-stability-architecture-seven-layers.md)
- [ADR-059 Agent Explainability](./059-agent-explainability-and-decision-transparency.md)

## Source Section

- `§58` Emergency Stop and Global Circuit Breaker

## v4.3 ADR Remediation

- A-25: This ADR originally only defined `L0-L4` level names without binding them to formal control plane mechanisms. The root cause was that the emergency stop ADR was first drafted from an operations playbook, and later did not align with the main `PlatformPanicDirective / OperationalDirective` contracts. Fix: The main text now explicitly binds each level to `PlatformPanicDirective` or `OperationalDirective(type=kill_run / pause_run)`.
