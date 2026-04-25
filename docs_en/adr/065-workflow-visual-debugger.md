# ADR-065 Workflow Visual Debugger Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

When Workflow fails, developers need visual tools to understand execution flow and locate issues.

## Decision

### Debugger Architecture

| Component | Description |
|------------|-------------|
| Visualizer | DAG visualization |
| StepInspector | Step detail viewer |
| StateExplorer | State browser |
| TraceViewer | Trace viewer |
| BreakpointManager | Breakpoint manager |

### DAG Visualization

```typescript
interface WorkflowDAGView {
  workflow_id: string;
  nodes: DAGNode[];
  edges: DAGEdge[];
  current_step?: string;
  breakpoints: string[];
  execution_path: string[];
}
```

### Debug Functions

| Function | Description |
|----------|-------------|
| step_over | Step over |
| step_into | Step into |
| step_out | Step out |
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
| step_start | Step start |
| step_complete | Step complete |
| error | Error occurred |
| condition | Condition met |

### Trace Integration

- Full链路 trace (Full trace)
- Span details
- Performance profiling
- Error chain

## Consequences

Positive:

- Visual debugging improves efficiency
- Complete state aids problem location
- Breakpoint supports fine-grained debugging

Negative:

- Debugger development cost
- Runtime overhead

## Cross-References

- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-090 Runtime Data Reliability and Operations](./090-runtime-data-reliability-and-operations.md)

## Source Sections

- `§65` Workflow Visual Debugger Architecture