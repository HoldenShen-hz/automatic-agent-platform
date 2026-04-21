# ADR-021 Inter-Plane Communication Contract

- Status: Accepted
- Decision Date: 2026-04-03

## Context

The platform's five planes (P1 Interface, P2 Control, P3 Orchestration, P4 Execution, P5 State & Evidence) require standardized communication protocols. Without uniform contracts, cross-plane integration becomes fragile, boundaries blur, and auditing becomes difficult.

## Decision

### RequestEnvelope Contract (8 fields)

All cross-plane calls must be wrapped in RequestEnvelope:

```typescript
interface RequestEnvelope {
  trace_id: string;           // Full链路追踪 ID
  idempotency_key?: string;    // 幂等键，防止重复调用
  principal: Principal;        // 调用方身份
  source_plane: PlaneId;       // 来源平面
  target_plane: PlaneId;       // 目标平面
  control_directives: ControlDirective[];
  payload: unknown;            // 业务负载
  metadata?: Record<string, unknown>;
}
```

### ControlDirective Contract (6 types)

```typescript
type ControlDirective =
  | { type: 'mode_switch'; mode: PolicyMode }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'rollback'; target_state?: string }
  | { type: 'quota_adjust'; delta: number }
  | { type: 'kill' };
```

### ExecutionPlan and ExecutionReceipt

```typescript
interface ExecutionPlan {
  plan_id: string;
  budget: {
    max_steps: number;
    max_duration_ms: number;
    max_cost: number;
  };
  steps: Step[];
  precondition?: Precondition[];
}

interface ExecutionReceipt {
  receipt_id: string;
  plan_id: string;
  status: ExecutionStatus;
  outputs: StepOutput[];
  metrics: ExecutionMetrics;
}
```

### Plane Isolation Rules

- P1 must not bypass P2 to directly call P4: all P1 requests must go through PolicyCenterService.evaluate()
- P5 must not send directives to P4: state-evidence layer is read-only, no writes to execution/
- All contract objects must include principal + trace_id: enforced via factory functions

## Consequences

Positive:
- Uniform contracts enable traceable and auditable cross-plane calls
- trace_id enables end-to-end troubleshooting
- Plane isolation rules prevent unauthorized calls

Negative:
- All cross-plane calls add envelope wrapping overhead
- Contract changes require coordination across planes

Trade-offs:
- Standardization vs. flexibility
- Encapsulation vs. performance

## Cross-References

- [ADR-001 Three-Layer Separation of Authority](./001-three-layer-architecture.md)
- [ADR-004 Workflow and Routing](./004-workflow-routing.md)

## Source Sections

- `§5` Inter-Plane Communication Contract