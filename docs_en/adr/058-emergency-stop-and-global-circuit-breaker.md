# ADR-058 Emergency Stop and Global Circuit Breaker Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

When security incidents occur, the platform must be able to instantly halt all Agent operations across the entire platform. The global circuit breaker mechanism prevents fault propagation.

## Decision

### Emergency Stop Levels

| Level | Name | Scope of Impact |
|-------|------|-----------------|
| L0 | None | Normal operation |
| L1 | pause_new | Pause new runs via `OperationalDirective(type=pause_run)` or admission gate |
| L2 | pause_all | Pause all platform execution via `PlatformPanicDirective(scope=platform)` |
| L3 | kill_all | Terminate running runs via `OperationalDirective(type=kill_run)` or `PlatformPanicDirective(scope=platform)` |
| L4 | lockdown | Lock down the platform via `PlatformPanicDirective(mode=incident-mode)`, allowing read operations only |

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
  window_ms: number;      // Statistical window
  open_duration_ms: number; // Duration of circuit break (does not include auto-clear semantics)
}

Constraints:
- `open_duration_ms` only defines the duration of the circuit break, not TTL auto-clear.
- Transition from `open` to `half_open` must be done via explicit call to `circuit_breaker.half_open()` or manual intervention.
- Automatic recovery directly from `open` to `closed` without transition is prohibited.
- In `half_open` state, the circuit may transition to `closed` only if the probe request success rate meets the threshold; otherwise, it reverts to `open`.
```

### Recovery Flow

1. Event resolution
2. Manual confirmation
3. Degraded observation (half_open)
4. Gradual traffic recovery
5. Full recovery

### Access Control

- Emergency stop requires specific permissions
- Operations require secondary confirmation
- All operations are logged to audit logs
- Emergency stop must be implemented via formal mechanisms: `PlatformPanicDirective` or `OperationalDirective`. Direct substitution with bare switch variables or bypass scripts is prohibited.

## Consequences

Advantages:

- Fast response to security incidents
- Prevents fault propagation
- Graded recovery reduces impact

Costs:

- Emergency stop affects business continuity
- Recovery flow requires careful design

## Cross References

- [ADR-025 Stability Architecture](./025-stability-architecture-seven-layers.md)
- [ADR-059 Agent Explainability](./059-agent-explainability-and-decision-transparency.md)

## Source Section

- Section 60: Emergency Stop and Global Circuit Breaker Architecture

## v4.3 ADR Remediation

- A-25: This ADR originally defined only L0-L4 level names without binding them to formal control plane mechanisms. The root cause is that the emergency stop ADR was first drafted from the operations playbook, and later was not aligned with the `PlatformPanicDirective / OperationalDirective` main contract. Fix: The main text now explicitly binds each level to `PlatformPanicDirective` or `OperationalDirective(type=kill_run / pause_run)`.