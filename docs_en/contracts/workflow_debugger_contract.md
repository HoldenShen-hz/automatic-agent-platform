# Workflow Debugger Contract

## 1. Scope

This contract defines the execution-flow debugging, breakpoint API, and run comparison for §65.

## 2. Canonical Objects

- `WorkflowTraceFrame`
- `BreakpointDefinition`
- `BreakpointHit`
- `RunComparisonReport`

## 3. `BreakpointDefinition` Minimum Fields

- `breakpoint_id`
- `harness_run_id`
- `node_run_id?`
- `node_selector`
- `condition`
- `action`: `pause | snapshot | compare`

## 4. Rules

- Debug actions must not change the authoritative fact records of business output.
- Comparison reports must be based on replayable evidence, not on transient UI state.
- Production debugging must be gated by approval and permission control.

## v4.3 Contract Remediation

- T-69: This document previously bound breakpoint anchors to `workflow_id / step_selector`. Root cause: the debugger contract was built on top of an older workflow debugger prototype and was not migrated to the `HarnessRun / NodeRun` debugging semantics. Fix: the body now uses `harness_run_id / node_run_id / node_selector` as the authoritative anchor; the legacy workflow terminology is allowed only in projection views.

## 5. Testing Requirements

- unit: breakpoint matching, trace frame normalization
- integration: runtime trace -> debugger -> replay/compare
- contract: unauthorized users must not be able to set production breakpoints
