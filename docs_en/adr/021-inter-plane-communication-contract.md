# ADR-021 Inter-Plane Communication Contract

- Status: Accepted
- Decision Date: 2026-04-03

## Background

The platform's five planes (P1 Interface Plane, P2 Control Plane, P3 Orchestration Plane, P4 Execution Plane, P5 State and Evidence Plane) need standardized communication protocols. If each plane defines contracts independently, it will lead to fragile integration, blurred boundaries, and difficult auditing.

## Decision

### RequestEnvelope Contract (8 fields)

All cross-plane calls must be wrapped in RequestEnvelope:

```typescript
interface RequestEnvelope {
  trace_id: string;           // Full链路 tracing ID
  idempotency_key?: string;    // Idempotency key, prevent duplicate calls
  principal: Principal;        // Caller identity
  source_plane: PlaneId;       // Source plane
  target_plane: PlaneId;       // Target plane
  directives: Array<OperationalDirective | DecisionDirective>;
  payload: unknown;            // Business payload
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

- P1 must not directly call P4 bypassing P2: All P1 requests must go through PolicyCenterService.evaluate() approval
- P5 must not send directives to P4: state-evidence layer is read-only, does not write to execution/
- All contract objects contain principal + trace_id: Enforced through factory functions
- `ControlDirective`, `ExecutionPlan`, `ExecutionReceipt` are only allowed as legacy terms appearing in migration or historical compatibility layer, no longer as canonical P2→P3/P4 contract.

## Consequences

Advantages:

- Unified contract makes cross-plane calls traceable and auditable
- trace_id enables full-chain troubleshooting
- Plane isolation rules prevent unauthorized calls

Costs:

- All cross-plane calls add envelope wrapping overhead
- Contract changes require coordination across all planes

## Cross References

- [ADR-001 Three-Layer Separation Architecture](./001-three-layer-architecture.md)
- [ADR-004 Workflow and Routing](./004-workflow-routing.md)

## Source Sections

- `§5` Inter-plane communication contract

## v4.3 ADR Remediation

- A-13: This ADR originally converged P2→P3 control objects into single `ControlDirective`. The root cause was that early design mixed "operational control" and "approval/decision result" into one cross-plane message type. Fix: The text now splits into `OperationalDirective` and `DecisionDirective`.
- A-14: This ADR originally wrote P3→P4 handoff as linear `ExecutionPlan.steps[]`. The root cause was that the ADR was formed when execution model still停留在 linear workflow semantics and had not upgraded along with v4.3 graph handoff. Fix: The text now changes to `PlanGraphBundle`.
- A-15: This ADR originally wrote P4→P3 result as aggregated `ExecutionReceipt`. The root cause was that node attempt and append-only receipt model had not yet been refined as an independent truth object. Fix: The text now changes to `NodeAttemptReceipt`, with `nodeAttemptId + nodeRunId`.
