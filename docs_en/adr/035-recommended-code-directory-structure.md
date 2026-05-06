# ADR-035 Recommended Code Directory Structure

- Status: Accepted
- Decision Date: 2026-04-17

## Context

The code directory structure needs to align with the five-plane architecture, facilitating developers in locating and understanding code.

## Decision

### 9 Major Top-Level Modules

```
src/
  platform/       # Five-plane runtime core
  domains/        # Domain descriptors, onboarding, governance
  interaction/    # NL entry, goal decomposition, dashboard
  org-governance/ # Organization hierarchy, approval routing, SSO
  scale-ecosystem/# Multi-region, marketplace, integration
  ops-maturity/   # Explainability, emergency brake, drift detection
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

- `core/` Compatibility layer (no new canonical runtime logic)
- `benchmarks/` Performance tests
- `testing/` Test utilities

## Consequences

Pros:

- Directory structure maps clearly to architecture
- Facilitates developers in locating code
- Supports large-scale team parallel development

Cons:

- Refactoring existing code requires significant cost
- Needs to stay synchronized with documentation

## Cross-references

- [ADR-001 Three-Layer Separation Architecture](./001-three-layer-architecture.md)

## Source Section

- `§35` Recommended Code Directory Structure
