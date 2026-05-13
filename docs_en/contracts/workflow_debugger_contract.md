# Workflow Debugger Contract

## 1. Scope

This contract defines execution flow debugging, breakpoint APIs, and run comparison for `§65`.

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

- Debugging actions must not change the authoritative factual records of business output.
- Comparison reports must be based on replayable evidence, not UI temporary state.
- Production debugging must be subject to approval and permission control.

## v4.3 Contract Remediation

- T-69: This document originally bound breakpoint anchor to `workflow_id / step_selector`. The root cause was that the debugger contract was built on the old workflow debugger prototype and did not switch to `HarnessRun / NodeRun` debugging semantics. Fix: Main text now uses `harness_run_id / node_run_id / node_selector` as the authoritative anchor; old workflow terminology is only allowed in projection views.

## 5. Test Requirements

- unit: breakpoint matching, trace frame normalization
- integration: runtime trace -> debugger -> replay/compare
- contract: unauthorized users must not set production breakpoints