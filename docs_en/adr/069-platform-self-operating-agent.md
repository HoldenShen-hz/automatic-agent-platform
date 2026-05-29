# ADR-069 Platform Self-Operating Agent Architecture

- Status: Partially Superseded by v4.3 control-plane and runtime authority ADRs
- Decision Date: 2026-04-20

## Background

One-person companies have no dedicated SRE, and the platform needs to be self-operating, reducing manual intervention.

## Decision

### Self-Operating Capabilities

| Capability | Description |
|------------|-------------|
| Auto monitoring | Metrics collection and alerting |
| Auto diagnosis | Root cause analysis |
| Auto repair | Common problem repair |
| Auto scaling | Load-responsive scaling |
| Auto recovery | Fault self-healing |

### Self-Operating Agent Design

```typescript
interface SelfOpsAgent {
  agent_id: string;
  capabilities: OpsCapability[];
  authorization: OpsAuthorization;
  boundaries: OpsBoundary;
}
```

### OpsCapability

| Capability | Trigger Condition | Execute Action |
|------------|------------------|----------------|
| restart_service | Service unresponsive | Restart service |
| clear_cache | Cache hit rate low | Clear cache |
| scale_up | High load | Add Workers |
| scale_down | Low load | Reduce Workers |
| rotate_secrets | Secret about to expire | Rotate secrets |

### Permission Boundaries

| Operation | Requires Approval | Auto Execute |
|-----------|------------------|--------------|
| View logs | No | Yes |
| Restart service | Yes | No |
| Scaling | Yes | Can auto within config range |
| Modify config | Yes | No |
| Data operations | Yes | No |

- Any action that modifies runtime truth objects must ultimately sink to `OperationalDirective` and be implemented via `RuntimeStateMachine.transition(command)`, SelfOpsAgent cannot directly write truth state.

### Manual Intervention

- Complex issues escalate to human
- Key decisions require human confirmation
- Regular human review

## Consequences

Advantages:

- Reduces SRE dependency
- Improves availability
- Fast fault response

Trade-offs:

- Self-operating logic is complex
- Permission boundaries require careful design

## Cross References

- [ADR-025 Stability Architecture](./025-stability-architecture-seven-layers.md)
- [ADR-058 Emergency Stop and Global Circuit Breaker](./058-emergency-stop-and-global-circuit-breaker.md)

## Source Section

- `§69` Platform Self-Operating Agent Architecture