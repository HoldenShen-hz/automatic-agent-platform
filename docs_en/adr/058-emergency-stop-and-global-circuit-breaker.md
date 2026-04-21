# ADR-058 Emergency Stop and Global Circuit Breaker

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Platform must have emergency stop mechanisms to prevent cascading failures and allow rapid shutdown when critical issues occur.

## Decision

### EmergencyBrake Levels

| Level | Scope | Trigger Condition |
|-------|-------|-------------------|
| L1 | Single task | Execution timeout, resource exhaustion |
| L2 | Single workflow | Multiple task failures, dependency failure |
| L3 | Single tenant | Tenant-wide anomalies, quota breach |
| L4 | Single region | Region-wide failures, cascade failure |
| L5 | Platform-wide | Global outage, security breach |

### GlobalCircuitBreaker

```typescript
interface GlobalCircuitBreaker {
  state: 'closed' | 'open' | 'half_open';
  threshold: number;
  timeout_ms: number;
  half_open_success_threshold: number;
}
```

### Trigger Conditions

| Condition | Threshold | Window |
|-----------|-----------|--------|
| Platform error rate | > 20% | 1 minute |
| P99 latency | > 10x baseline | 5 minutes |
| Resource exhaustion | > 95% | Immediate |
| Security breach | Any | Immediate |

### Recovery Protocol

1. Identify root cause
2. Isolate affected scope
3. Execute recovery steps
4. Verify recovery success
5. Gradual traffic restoration

### Panic Mode

- `ops-maturity/emergency/platform-panic-service.ts`
- Freezes all new task creation
- Preserves execution state for recovery
- Enables forensic snapshot capture

## Consequences

Positive:
-分级控制 prevents cascade failure
- Clear recovery protocol enables fast response
- Panic mode preserves evidence for RCA

Negative:
- Emergency stops interrupt business operations
- False positives may cause unnecessary disruption

Trade-offs:
- Safety vs. availability
- Speed vs. accuracy

## Cross-References

- [ADR-025 Stability Architecture Seven Layers](./025-stability-architecture-seven-layers.md)
- [ADR-087 Ops Maturity Runtime](./087-ops-maturity-runtime.md)

## Source Sections

- `§58` Emergency Brake and Global Circuit Breaker