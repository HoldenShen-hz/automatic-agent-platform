# ADR-065 Workflow Visual Debugger Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Background

When Workflow fails, developers need visual tools to understand the execution process and locate problems.

## Decision

### Debugger Architecture

| Component | Description |
|-----------|-------------|
| Visualizer | DAG visualization |
| NodeInspector | Node detail view |
| StateExplorer | State browser |
| TraceViewer |链路追踪 |
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

- A-62: This ADR originally anchored debugger to `workflow_id / current_step / StepInspector`, root cause being document inherited old workflow debugger prototype, not switched to `HarnessRun / NodeRun` debugging model. Fix: Body now changes debugging anchor to harness/node semantics.

### Debugging Features

> **Deprecated step concept**: Debugging model based on `HarnessRun / NodeRun`, does not support `step_over/step_into/step_out` linear step debugging operations.

| Feature | Description |
|---------|-------------|
| node_over | Node skip |
| node_into | Node enter |
| node_out | Node exit |
| resume | Continue execution |
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
| condition | Condition satisfied |

### Trace Integration

- Full链路 trace
- Span details
- Performance profiling
- Error链路

## Consequences

Advantages:

- Visual debugging improves efficiency
- Complete state facilitates problem location
- Breakpoint supports fine-grained debugging

Trade-offs:

- Debugger development cost
- Runtime overhead

## Cross References

- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-090 Runtime, Data Reliability and Operations Governance](./090-runtime-data-reliability-and-operations.md)

## Source Section

- `§65` Workflow Visual Debugger Architecture