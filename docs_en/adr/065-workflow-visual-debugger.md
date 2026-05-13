# ADR-065 Workflow Visual Debugger Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Developers need visual tools to understand the execution process and locate issues when Workflows fail.

## Decision

### Debugger Architecture

| Component | Description |
|-----------|-------------|
| Visualizer | DAG visualization |
| NodeInspector | Node detail viewer |
| StateExplorer | State browser |
| TraceViewer | Trace viewer |
| BreakpointManager | Breakpoint management |

### DAG Visualization

```typescript
interface WorkflowDAGView {
  harness_run_id: string;
  node_run_ids: string[];
  nodes: DAGNode[];
  edges: DAGEdge[];
  current_node?: string;
  breakpoints: string[];
  execution_path: string[];
}
```

## v4.3 ADR Remediation

- A-62: This ADR originally anchored the debugger on `workflow_id / current_step / StepInspector`. The root cause was that the document inherited the old workflow debugger prototype and did not switch to the `HarnessRun / NodeRun` debugging model. Fix: The main text now uses harness/node semantics as the debugging anchor point.

### Debugging Features

> **Step concept deprecated**: The debugging model is based on `HarnessRun / NodeRun` and does not support linear step-by-step debugging operations such as `step_over/step_into/step_out`.

| Feature | Description |
|---------|-------------|
| node_over | Skip node |
| node_into | Enter node |
| node_out | Exit node |
| resume | Resume execution |
| pause | Pause |
| stop | Stop |

### State Viewing

- WorkflowState complete state
- Step input/output
- Intermediate variables
- Error messages

### Breakpoint Conditions

| Type | Description |
|------|-------------|
| node_start | Node start |
| node_complete | Node complete |
| error | Error occurred |
| condition | Condition met |

### Trace Integration

- Full trace chain
- Span details
- Performance profiling
- Error chain

## Consequences

Advantages:

- Visual debugging improves efficiency
- Complete state facilitates problem identification
- Breakpoint support enables fine-grained debugging

Costs:

- Debugger development cost
- Runtime overhead

## Cross References

- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-090 Runtime, Data Reliability, and Operations Governance](./090-runtime-data-reliability-and-operations.md)

## Source Section

- `§65` Workflow Visual Debugger Architecture
