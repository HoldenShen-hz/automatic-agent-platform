# ADR-035 Recommended Code Directory Structure

- Status: Accepted
- Decision Date: 2026-04-17

## Context

The code directory structure must align with the five-plane architecture to facilitate developers in locating and understanding code.

## Decision

### 9 Top-Level Modules

```
src/
  platform/       # Five-plane runtime core
  domains/        # Domain descriptors, onboarding, governance
  interaction/    # NL entry, goal decomposition, dashboard
  org-governance/ # Organization hierarchy, approval routing, SSO
  scale-ecosystem/# Multi-region, marketplace, integrations
  ops-maturity/   # Explainability, emergency stop, drift detection
  plugins/        # Plugin SDK
  sdk/            # Developer toolchain
  apps/           # Application examples
```

### platform/ Subdirectories

```
platform/
  interface/      # API, Webhook, Scheduler, Console, Ingress
  control-plane/  # IAM, Config-Center, Approval, Incident, Rollout
  orchestration/  # OAPEFLIR, Workflow, Planner, Routing
  execution/      # Dispatcher, Execution-Engine, Recovery, Worker-Pool
  state-evidence/ # Truth, Events, Artifacts, Memory, Knowledge
  shared/         # Cross-cutting services
```

### Additional Directories

- `core/` Compatibility layer (do not add new canonical runtime logic here)
- `benchmarks/` Performance testing
- `testing/` Testing utilities

## Consequences

Benefits:

- Clear mapping between directory structure and architecture
- Easier for developers to locate code
- Supports large-scale team parallel development

Costs:

- Refactoring existing code requires significant effort
- Must keep in sync with documentation

## Cross References

- [ADR-001 Three-Layer Architecture](./001-three-layer-architecture.md)

## Source Section

- `§35` Recommended Code Directory