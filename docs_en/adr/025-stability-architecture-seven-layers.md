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
| L2 Rate Limiting & Backpressure | 4-level queue_lag threshold | Backpressure controlled in dispatcher |
| L3 Timeout & Retry | Exponential backoff base=1s max=60s | ExecutionStrategy |
| L4 Circuit Breaker | 50% failure rate/60s → open → 30s half-open | CircuitBreaker |
| L5 Degradation Mode | 8 runtime modes | PolicyMode enum |
| L6 Recovery | 6 recovery workers | RuntimeRecoveryService, etc. |
| L7 Observability | metrics/logs/traces/audit | shared/observability/ |

### PolicyMode 8 Runtime Modes

```typescript
enum PolicyMode {
  full_auto = 'full_auto',
  supervised_auto = 'supervised_auto',
  read_only = 'read_only',
  no_write = 'no-write',
  no_external_call = 'no-external-call',
  no_rollout = 'no-rollout',
  manual_only = 'manual_only',
  incident_mode = 'incident-mode'
}
```

### 6 Recovery Workers

1. RuntimeRecoveryService (622 lines)
2. RuntimeRepairService (595 lines)
3. RuntimeRecoveryDecisionService (355 lines)
4. RuntimeRecoveryReplayService (700 lines)
5. StalledExecutionEscalationService (130 lines)
6. ExecutionDbQueueDisconnectRepairService (346 lines)

### Automatic Rollback Conditions

| Condition | Threshold | Window |
|-----------|-----------|--------|
| Error rate exceeded | > 1% | 5 minutes |
| P99 latency exceeded | > 500ms | 5 minutes |
| Success rate not met | < 99% | 5 minutes |
| Consecutive failures | > 10 | 10 minutes |
| Resource exhaustion | Memory > 90% | 1 minute |

## Consequences

Benefits:

- Seven layers of defense cover common failure scenarios
- Automatic degradation ensures core service availability
- 6 recovery workers implement self-healing capabilities

Trade-offs:

- Multi-layer mechanisms increase system complexity
- Requires comprehensive monitoring and alerting infrastructure

## Cross-references

- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-075 Six-Level Controlled Release and Rollout State Machine](./075-controlled-rollout-release.md)

## Source Section

- `§9` Stability Architecture (Seven Layers)

## v4.3 ADR Remediation

- A-19: This ADR originally mixed `supervised / degraded / maintenance / emergency` into the canonical `PolicyMode`. The root cause was that the stability ADR merged alerting/operational semantics with runtime enforced modes into one enum. Fix: The text now converges the mode enum to the 8 runtime modes specified by the main architecture: `full_auto / supervised_auto / read_only / no-write / no-external-call / no-rollout / manual_only / incident-mode`.
