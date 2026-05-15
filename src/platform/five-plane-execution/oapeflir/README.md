# Execution OAPEFLIR Boundary

Execution-plane OAPEFLIR code is limited to runtime plan execution bridges and execution-specific adapters.

Canonical planning, assessment, learning, handoff, and stage orchestration live under:

`src/platform/five-plane-orchestration/oapeflir/`

Do not add planning or orchestration state machines here. Keep this directory focused on consuming orchestration contracts during execution.
