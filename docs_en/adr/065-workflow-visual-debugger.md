# ADR-065 Workflow Visual Debugger Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

When workflows fail, developers need visual tools to understand execution flow and locate problems.

## Decision

### Debugger Architecture

| Component | Description |
|-----------|-------------|
| Visualizer | DAG visualization |
| StepInspector | Step detail viewer |
| StateExplorer | State browser |
| TraceViewer | Trace tracking |
| BreakpointManager | Breakpoint management |

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

### Debugging Features

| Feature | Description |
|---------|-------------|
| step_over | Step over |
| step_into | Step into |
| step_out | Step out |
| resume | Resume execution |
| pause | Pause |
| stop | Stop |

### State Viewing

- Complete WorkflowState status
- Step input/output
- Intermediate variables
- Error messages

### Breakpoint Conditions

| Type | Description |
|------|-------------|
| step_start | Step started |
| step_complete | Step completed |
| error | Error occurred |
| condition | Condition met |

### Trace Integration

- Full trace
- Span details
- Performance profiling
- Error chain

## Consequences

Positive:

- Visual debugging improves efficiency
- Complete state facilitates problem location
- Breakpoint support for fine-grained debugging

Negative:

- Debugger development cost
- Runtime overhead

## Cross-References

- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-090 Runtime, Data Reliability and Operations Governance](./090-runtime-data-reliability-and-operations.md)

## Source Sections

- `§65` Workflow Visual Debugger Architecture
