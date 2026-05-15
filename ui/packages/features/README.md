# UI Feature Modules

Feature packages under `ui/packages/features/` provide product-level capabilities on top of shared UI primitives and shared clients.

## Module Rules

- Keep each feature focused on one product capability.
- Import shared contracts from `ui/packages/shared/*`.
- Do not call platform APIs directly when a shared API client exists.
- Keep route-level error handling compatible with the global error boundary.
- Avoid storing secrets or long-lived tokens in feature state.

## Current Feature Areas

- Operations: `dashboard`, `health`, `incidents`, `stability`, `alerts`.
- Execution: `dispatch`, `task-cockpit`, `workers`, `queues`, `takeover`.
- Workflow: `workflow-builder`, `workflow-cockpit`, `workflow-debugger`.
- Governance: `approval`, `audit`, `compliance`, `policy`, `governance-compliance`.
- Domain and marketplace: `domain-wizard`, `marketplace`, `agent-manager`.
- User interaction: `conversation`, `hitl`, `inspect`, `settings`.

## Validation

Use focused UI tests for changed feature modules. Do not use a full test run as proof for a single feature README or route change.
