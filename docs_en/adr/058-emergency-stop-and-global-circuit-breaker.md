# ADR-058 Emergency Stop and Global Circuit Breaker Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Background

When security incidents occur, the platform needs to instantly stop all platform Agent operations, and global circuit breaker mechanism prevents fault propagation.

## Decision

### Emergency Stop Levels

| Level | Name | Impact Scope |
|-------|------|--------------|
| L0 | none | Normal operation |
| L1 | pause_new | Pause new runs via `OperationalDirective(type=pause_run)` or admission gate |
| L2 | pause_all | Pause all platform execution via `PlatformPanicDirective(scope=platform)` |
| L3 | kill_all | Terminate running runs via `OperationalDirective(type=kill_run)` or `PlatformPanicDirective(scope=platform)` |
| L4 | lockdown | Lock platform via `PlatformPanicDirective(mode=incident-mode)`, only allow read operations |

### Trigger Conditions

| Condition | Level |
|-----------|-------|
| Manual trigger | L1-L4 |
| SEV1 event | L2 |
| Continuous failure >90% | L3 |
| Security attack detected | L4 |

### Global Circuit Breaker

```typescript
interface GlobalCircuitBreaker {
  state: 'closed' | 'open' | 'half_open';
  threshold: number;       // Failure rate threshold
  window_ms: number;      // Statistics window
  open_duration_ms: number; // Circuit breaker duration (does not include auto-release semantics)
}

Constraints:
- `open_duration_ms` only defines circuit breaker duration, does not represent TTL auto-release.
- Circuit breaker must transition from `open` to `half_open` through explicit call to `circuit_breaker.half_open()` or manual intervention.
- Prohibited from automatically recovering from `open` to `closed` without transition.
- In `half_open` state, if probe request success rate meets threshold, can transition to `closed`; otherwise revert to `open`.
```

### Recovery Flow

1. Event resolved
2. Manual confirmation
3. Degraded observation (half_open)
4. Gradually restore traffic
5. Complete recovery

### Permission Control

- Emergency stop requires specific permissions
- Operations require secondary confirmation
- All operations record audit logs
- Emergency stop must be implemented through formal mechanisms: `PlatformPanicDirective` or `OperationalDirective`, must not be replaced by bare switch variables or bypass scripts.

## Consequences

Advantages:

- Rapid response to security incidents
- Prevents fault propagation
- Tiered recovery reduces impact

Trade-offs:

- Emergency stop affects business continuity
- Recovery process requires careful design

## Cross References

- [ADR-025 Stability Architecture](./025-stability-architecture-seven-layers.md)
- [ADR-059 Agent Explainability](./059-agent-explainability-and-decision-transparency.md)

## Source Section

- `§60` Emergency Stop and Global Circuit Breaker Architecture

## v4.3 ADR Remediation

- A-25: This ADR originally only defined L0-L4 level names without binding them to formal control plane mechanisms, root cause being emergency stop ADR was first drafted from operations playbook and later not aligned with `PlatformPanicDirective / OperationalDirective` main contract. Fix: Body now explicitly binds each level to `PlatformPanicDirective` or `OperationalDirective(type=kill_run / pause_run)`.