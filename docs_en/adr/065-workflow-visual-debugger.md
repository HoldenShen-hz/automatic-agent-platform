# ADR-065 Workflow Visual Debugger Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

When Workflow fails, developers need visual tools to understand execution flow and locate issues.

## Decision

### Debugger Architecture

| Component | Description |
|-----------|-------------|
| Visualizer | DAG visualization |
| NodeInspector | Node detail view |
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

- A-62: This ADR originally anchored the debugger to `workflow_id / current_step / StepInspector`, root cause being the document inherited the old workflow debugger prototype without switching to the `HarnessRun / NodeRun` debugging model. Fix: The main text now changes the debugging anchor to harness/node semantics.

### Debugging Features

> **Step concept deprecated**: Debugging model is based on `HarnessRun / NodeRun`, does not support linear step debugging operations like `step_over/step_into/step_out`.

| Feature | Description |
|---------|-------------|
| node_over | Skip node |
| node_into | Enter node |
| node_out | Exit node |
| resume | Resume execution |
| pause | Pause |
| stop | Stop |

### State Viewing

- Complete WorkflowState
- Step input/output
- Intermediate variables
- Error messages

### Breakpoint Conditions

| Type | Description |
|------|-------------|
| node_start | Node started |
| node_complete | Node completed |
| error | Error occurred |
| condition | Condition met |

### Trace Integration

- Full trace chain
- Span details
- Performance profiling
- Error traces

## Consequences

Advantages:

- Visual debugging improves efficiency
- Complete state facilitates problem location
- Breakpoint support for fine-grained debugging

Costs:

- Debugger development cost
- Runtime overhead

## Cross References

- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-090 Runtime, Data Reliability and Operations](./090-runtime-data-reliability-and-operations.md)

## Source Section

- `§65` Workflow Visual Debugger Architecture