# ADR-021 Inter-Plane Communication Contract

- Status: Accepted
- Decision Date: 2026-04-03

## Context

Standardized communication protocols are needed between the platform's five planes (P1 Interface, P2 Control, P3 Orchestration, P4 Execution, P5 State & Evidence). If each plane defines contracts independently, it leads to fragile integration, blurred boundaries, and difficult auditing.

## Decision

### RequestEnvelope Contract (8 Fields)

All cross-plane calls must be wrapped in a RequestEnvelope:

```typescript
interface RequestEnvelope {
  trace_id: string;           // Full-chain tracing ID
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
- P5 must not send directives to P4: state-evidence layer is read-only, does not write to execution/
- All contract objects include principal + trace_id: Enforced through factory functions
- `ControlDirective`, `ExecutionPlan`, `ExecutionReceipt` are only allowed as legacy nouns in migration or historical compatibility layers, and are no longer canonical P2→P3/P4 contracts.

## Consequences

Benefits:

- Unified contracts make cross-plane calls traceable and auditable
- trace_id enables full-chain troubleshooting
- Plane isolation rules prevent unauthorized calls

Trade-offs:

- All cross-plane calls add envelope wrapper overhead
- Contract changes require coordination across all planes

## Cross-references

- [ADR-001 Three-Layer Separation Architecture](./001-three-layer-architecture.md)
- [ADR-004 Workflow and Routing](./004-workflow-routing.md)

## Source Section

- `§5` Inter-Plane Communication Contract

## v4.3 ADR Remediation

- A-13: This ADR originally converged P2→P3 control objects into a single `ControlDirective`. The root cause was that early design mixed "operational control" and "approval/decision results" into one cross-plane message type. Fix: The main text now separates them into `OperationalDirective` and `DecisionDirective`.
- A-14: This ADR originally wrote P3→P4 handoff as a linear `ExecutionPlan.steps[]`. The root cause was that the execution model still used linear workflow semantics when the ADR was formed, and did not upgrade with v4.3 graph handoff. Fix: The main text now uses `PlanGraphBundle`.
- A-15: This ADR originally wrote P4→P3 results as an aggregated `ExecutionReceipt`. The root cause was that the node attempt and append-only receipt model had not yet been refined into independent truth objects. Fix: The main text now uses `NodeAttemptReceipt` with `nodeAttemptId + nodeRunId`.
