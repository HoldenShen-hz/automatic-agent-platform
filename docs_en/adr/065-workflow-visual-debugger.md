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
| NodeInspector | Node detail viewer |
| StateExplorer | State browser |
| TraceViewer | Trace tracking |
| BreakpointManager | Breakpoint management |

### DAG Visualization

```typescript
interface PlanGraphView {
  harness_run_id: string;
  node_run_ids: string[];
  nodes: PlanNode[];
  edges: PlanEdge[];
  current_node?: string;
  breakpoints: string[];
  execution_path: string[];
}
```

**Note**: Debug anchor points have been updated from legacy `WorkflowDAGView/StepInspector` to `PlanGraphView/NodeRun` model (see v4.3 ADR Remediation).

### Debugging Features

| Feature | Description |
|---------|-------------|
| node_step_over | Skip current NodeRun, execute next sibling node |
| node_step_into | Enter NodeRun subgraph or PlanNode details |
| node_step_out | Exit current NodeRun subgraph |
| resume | Resume execution |
| pause | Pause |
| stop | Stop |

### State Viewing

Note: §176-2056 Fix: The original document referenced `WorkflowState` as the authoritative state viewing object, but spec §5.5 Canonical Runtime Object Map explicitly states that `WorkflowState` is non-authoritative/legacy usage. The authoritative runtime objects are `HarnessRun` (canonical run truth) and `NodeRun` (canonical execution truth). The debugger should query HarnessRun/NodeRun, not WorkflowState.

- HarnessRun complete status (canonical run truth)
- NodeRun node-level status (canonical execution truth)
- Step input/output (legacy step projection, for backward compatibility only)

### Breakpoint Conditions

| Type | Description |
|------|-------------|
| node_start | NodeRun started |
| node_complete | NodeRun completed |
| error | Error occurred |
| condition | Condition met |

### Trace Integration

- Full链路 trace
- Span details
- Performance profiling
- Error链路

## Consequences

Positive:

- Visual debugging improves efficiency
- Complete state facilitates problem location
- Breakpoint support for fine-grained debugging

Negative:

- Debugger development cost
- Runtime overhead

## v4.3 ADR Remediation

- A-62: This ADR originally anchored the debugger on `workflow_id / WorkflowDAGView / StepInspector / step_over` etc. legacy models. The root cause was that the document inherited the old workflow debugger prototype and did not switch to the `PlanGraph + NodeRun` debugging model. Fix: The main text now uniformly uses harness/node semantics for debugging anchors; breakpoint types changed from step_* to node_start/node_complete; debugging features changed from step_over/step_into/step_out to node_step_over/node_step_into/node_step_out.

## Cross-References

- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-090 Runtime, Data Reliability and Operations Governance](./090-runtime-data-reliability-and-operations.md)

## Source Section

- `§65` Workflow Visual Debugger Architecture
