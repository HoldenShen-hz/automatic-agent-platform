# ADR-021 Inter-Plane Communication Contract

- Status: Accepted
- Decision Date: 2026-04-03

## Context

The platform's five planes (P1 Interface Plane, P2 Control Plane, P3 Orchestration Plane, P4 Execution Plane, P5 State & Evidence Plane) require a standardized communication protocol. If each plane defines contracts independently, it leads to fragile integration, blurred boundaries, and difficult auditing.

## Decision

### RequestEnvelope Contract (8 Fields)

All cross-plane calls must be wrapped in a RequestEnvelope:

```typescript
interface RequestEnvelope {
  trace_id: string;           // Full-chain trace ID
  idempotency_key?: string;   // Idempotency key, prevents duplicate calls
  principal: Principal;       // Caller identity
  source_plane: PlaneId;      // Source plane
  target_plane: PlaneId;      // Target plane
  directives: Array<OperationalDirective | DecisionDirective>;
  payload: unknown;           // Business payload
  metadata?: Record<string, unknown>;
}
```

### `OperationalDirective` / `DecisionDirective` Contract

```typescript
type OperationalDirective =
  | { type: 'mode_switch'; runtime_mode: RuntimeMode }
  | { type: 'pause_run'; harnessRunId: string }
  | { type: 'resume_run'; harnessRunId: string }
  | { type: 'quota_adjust'; budgetLedgerId: string; delta: number }
  | { type: 'kill_run'; harnessRunId: string };

type DecisionDirective =
  | { type: 'approve'; approvalId: string }
  | { type: 'deny'; approvalId: string; reason?: string }
  | { type: 'expire_approval'; approvalId: string }
  | { type: 'request_manual_takeover'; harnessRunId: string; nodeRunId?: string };
```

### `PlanGraphBundle` and `NodeAttemptReceipt`

```typescript
interface PlanGraphBundle {
  planGraphBundleId: string;
  harnessRunId: string;
  graphVersion: number;
  budget: {
    max_steps: number;
    max_duration_ms: number;
    max_cost: number;
  };
  graph: PlanGraph;
  schedulerPolicy: SchedulerPolicy;
  validationReport: ValidationReport;
}

interface NodeAttemptReceipt {
  receiptId: string;
  nodeAttemptId: string;
  nodeRunId: string;
  status: NodeAttemptStatus;
  outputRef?: ArtifactRef;
  evidenceRefs: ArtifactRef[];
  budgetSettlementRefs: string[];
}
```

### Plane Isolation Rules

- P1 must not bypass P2 to directly call P4: All P1 requests must go through PolicyCenterService.evaluate() for approval
- P5 must not send directives to P4: The state-evidence layer is read-only and does not write to execution/
- All contract objects must include principal + trace_id: Enforced through factory functions
- `ControlDirective`, `ExecutionPlan`, and `ExecutionReceipt` are only permitted as legacy terms in migration or historical compatibility layers, and are no longer canonical P2→P3/P4 contracts.

## Consequences

Benefits:

- Unified contracts make cross-plane calls traceable and auditable
- trace_id enables full-chain troubleshooting
- Plane isolation rules prevent unauthorized calls

Trade-offs:

- All cross-plane calls add envelope wrapping overhead
- Contract changes require coordination across all planes

## Cross References

- [ADR-001 Three-Layer Architecture](./001-three-layer-architecture.md)
- [ADR-004 Workflow and Routing](./004-workflow-routing.md)

## Source Section

- `§5` Inter-Plane Communication Contract

## v4.3 ADR Remediation

- A-13: This ADR originally converged P2→P3 control objects into a single `ControlDirective`. The root cause was that early design mixed "operational control" and "approval/decision results" into one cross-plane message. Fix: The body now splits this into `OperationalDirective` and `DecisionDirective`.
- A-14: This ADR originally described P3→P4 handoff as a linear `ExecutionPlan.steps[]`. The root cause was that the execution model was still at linear workflow semantics when the ADR was formed, and had not upgraded with the v4.3 graph handoff. Fix: The body now uses `PlanGraphBundle`.
- A-15: This ADR originally described P4→P3 results as an aggregated `ExecutionReceipt`. The root cause was that the node attempt and append-only receipt model had not yet been refined into independent truth objects. Fix: The body now uses `NodeAttemptReceipt` with `nodeAttemptId + nodeRunId`.
