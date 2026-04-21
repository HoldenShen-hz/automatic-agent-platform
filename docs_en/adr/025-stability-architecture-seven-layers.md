# ADR-025 Stability Architecture (Seven Layers)

- Status: Accepted
- Decision Date: 2026-04-03

## Context

Enterprise-class Agent platforms must have comprehensive stability mechanisms to handle various failure scenarios: network partitions, dependency timeouts, resource exhaustion, etc.

## Decision

### Seven-Layer Stability Architecture

| Layer | Mechanism | Threshold/Strategy |
|-------|-----------|-------------------|
| L1 Isolation | Tenant failure rate >30% auto-isolation | AutoStopLossService |
| L2 Rate Limiting/Backpressure | 4-level queue_lag thresholds | Backpressure control in dispatcher |
| L3 Timeout Retry | Exponential backoff base=1s max=60s | ExecutionStrategy |
| L4 Circuit Breaker | 50% failure rate/60s → open → 30s half-open | CircuitBreaker |
| L5 Degradation Mode | 8 runtime modes | PolicyMode enum |
| L6 Recovery | 6 recovery workers | RuntimeRecoveryService etc. |
| L7 Observability | metrics/logs/traces/audit | shared/observability/ |

### PolicyMode 8 Runtime Modes

```typescript
enum PolicyMode {
  supervised = 'supervised',       // Human supervision
  auto = 'auto',                   // Auto mode
  full_auto = 'full_auto',         // Fully automatic
  read_only = 'read_only',         // Read-only
  maintenance = 'maintenance',     // Maintenance mode
  incident_mode = 'incident_mode', // Incident mode
  degraded = 'degraded',           // Degraded mode
  emergency = 'emergency'          // Emergency mode
}
```

### 6 Recovery Workers

1. RuntimeRecoveryService (622 lines)
2. RuntimeRepairService (595 lines)
3. RuntimeRecoveryDecisionService (355 lines)
4. RuntimeRecoveryReplayService (700 lines)
5. StalledExecutionEscalationService (130 lines)
6. ExecutionDbQueueDisconnectRepairService (346 lines)

### Auto-Rollback Conditions

| Condition | Threshold | Window |
|-----------|-----------|--------|
| Error rate exceeded | > 1% | 5 minutes |
| P99 latency exceeded | > 500ms | 5 minutes |
| Success rate below target | < 99% | 5 minutes |
| Consecutive failures | > 10 | 10 minutes |
| Resource exhaustion | Memory > 90% | 1 minute |

## Consequences

Positive:
- Seven layers of defense cover common failure scenarios
- Auto degradation ensures core service availability
- 6 recovery workers implement self-healing capability

Negative:
- Multi-layer mechanism increases system complexity
- Requires comprehensive monitoring and alerting support

Trade-offs:
- Defense in depth vs. complexity
- Resilience vs. overhead

## Cross-References

- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-075 Six-Level Controlled Release and Rollout State Machine](./075-controlled-rollout-release.md)

## Source Sections

- `§9` Stability Architecture (7 layers)