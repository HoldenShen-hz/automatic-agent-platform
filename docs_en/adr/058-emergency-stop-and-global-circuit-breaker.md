# ADR-058: Emergency Stop and Global Circuit Breaker Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

When security incidents occur, the platform needs to instantly stop all Agent operations across the entire platform. A global circuit breaker mechanism prevents fault propagation.

## Decision

### Emergency Stop Levels

| Level | Name | Impact Scope |
|-------|------|--------------|
| L0 | none | Normal operation |
| L1 | pause_new | Pause new runs via `OperationalDirective(type=pause_run)` or admission gate |
| L2 | pause_all | Pause all platform execution via `PlatformPanicDirective(scope=platform)` |
| L3 | kill_all | Terminate running runs via `OperationalDirective(type=kill_run)` or `PlatformPanicDirective(scope=platform)` |
| L4 | lockdown | Lock the platform via `PlatformPanicDirective(mode=incident-mode)`, allowing read-only operations only |

### Trigger Conditions

| Condition | Level |
|-----------|-------|
| Manual trigger | L1-L4 |
| SEV1 event | L2 |
| Consecutive failures > 90% | L3 |
| Security attack detected | L4 |

### Global Circuit Breaker

```typescript
interface GlobalCircuitBreaker {
  state: 'closed' | 'open' | 'half_open';
  threshold: number;       // Failure rate threshold
  window_ms: number;      // Statistical window
  open_duration_ms: number; // Circuit breaker duration (does not include auto-release semantics)
}

Constraints:
- `open_duration_ms` only defines circuit breaker duration, does not represent TTL auto-release.
- Circuit breaker transitioning from `open` to `half_open` must be via explicit `circuit_breaker.half_open()` call or manual intervention.
- Forbidden to automatically recover from `open` to `closed` without transition.
- In `half_open` state, only if probe request success rate meets threshold can it transition to `closed`; otherwise falls back to `open`.
```

### Recovery Process

1. Incident resolved
2. Manual confirmation
3. Degraded observation (half_open)
4. Gradually restore traffic
5. Complete recovery

### Access Control

- Emergency stop requires specific permissions
- Operations require secondary confirmation
- All operations recorded in audit logs
- Emergency stop must use formal mechanisms: `PlatformPanicDirective` or `OperationalDirective`, must not use bare switch variables or bypass scripts.

## Consequences

Advantages:

- Rapid response to security incidents
- Prevents fault propagation
- Graded recovery reduces impact

Disadvantages:

- Emergency stop affects business continuity
- Recovery process requires careful design

## Cross References

- [ADR-025 Stability Architecture](./025-stability-architecture-seven-layers.md)
- [ADR-059 Agent Explainability](./059-agent-explainability-and-decision-transparency.md)

## Source Section

- `§60` Emergency Stop and Global Circuit Breaker Architecture

## v4.3 ADR Remediation

- A-25: This ADR originally defined L0-L4 level names without binding them to formal control plane mechanisms. Root cause was that the emergency stop ADR was first drafted from operational playbook, and later did not align with `PlatformPanicDirective / OperationalDirective` main contract. Fix: The text now explicitly binds each level to `PlatformPanicDirective` or `OperationalDirective(type=kill_run / pause_run)`.