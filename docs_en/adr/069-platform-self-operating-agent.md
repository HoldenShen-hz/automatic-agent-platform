# ADR-069 Platform Self-Operating Agent Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

One-person companies have no dedicated SRE; the platform needs to self-operate, reducing manual intervention.

## Decision

### Self-Operation Capabilities

| Capability | Description |
|------------|-------------|
| auto_monitoring | Metric collection and alerting |
| auto_diagnosis | Root cause analysis |
| auto_repair | Common issue repair |
| auto_scaling | Load-responsive scaling |
| auto_recovery | Fault self-healing |

### Self-Op Agent Design

```typescript
interface SelfOpsAgent {
  agent_id: string;
  capabilities: OpsCapability[];
  authorization: OpsAuthorization;
  boundaries: OpsBoundary;
}
```

### OpsCapability

| Capability | Trigger | Action |
|------------|---------|--------|
| restart_service | Service unresponsive | Restart service |
| clear_cache | Low cache hit rate | Clear cache |
| scale_up | High load | Add Workers |
| scale_down | Low load | Reduce Workers |
| rotate_secrets | Key expiring soon | Rotate secrets |

All direct execution operations must go through RuntimeStateMachine.transition(OperationalDirective) + HarnessRuntime + PlanGraphBundle context to ensure operations are auditable and rollbackable. Per §5.3, all state changes must go through the canonical control path.

### Permission Boundaries

| Operation | Requires Approval | Auto Execute |
|-----------|-------------------|--------------|
| View logs | No | Yes |
| Restart service | Yes | No |
| Scaling | Yes | Configurable range |
| Modify config | Yes | No |
| Data operation | Yes | No |

### Manual Intervention

- Complex issues escalate to human
- Key decisions require human confirmation
- Regular human review

## Consequences

Positive:

- Reduces SRE dependency
- Improves availability
- Fast fault response

Negative:

- Self-ops logic is complex
- Permission boundaries require careful design

## Cross-References

- [ADR-025 Stability Architecture](./025-stability-architecture-seven-layers.md)
- [ADR-058 Emergency Stop and Global Circuit Breaker](./058-emergency-stop-and-global-circuit-breaker.md)

## Source Section

- `§69` Platform Self-Operating Agent Architecture

## v4.3 ADR Remediation

- R6-54: Fixed OpsCapability missing HarnessRuntime context and not following canonical control path. ADR-069 originally described restart_service/scale_up/rotate_secrets as direct execution operations, not going through RuntimeStateMachine.transition()/OperationalDirective, resulting in state changes that could not be audited or rolled back. Fix: All direct execution operations now execute through RuntimeStateMachine.transition(OperationalDirective) + HarnessRuntime + PlanGraphBundle context to ensure compliance with §5.3 requirements.
