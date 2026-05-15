# Execution Engine Boundary

This directory owns execution-plan interpretation, node execution, task result envelopes, and execution-local runtime coordination.

## Rules

- Orchestration planning belongs in `src/platform/five-plane-orchestration/`.
- Execution engine code should consume plan contracts and emit execution evidence.
- Large orchestration helpers are governance targets; new code should be added as focused modules.
- Node identity should use canonical `nodeRunId` where step-level evidence is correlated.
