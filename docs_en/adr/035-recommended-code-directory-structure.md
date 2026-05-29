# ADR-035 Recommended Code Directory Structure

- Status: Accepted
- Decision Date: 2026-04-17

## Background

Code directory structure needs to correspond to the Five-Plane architecture for easy developer code location and understanding.

## Decision

### 9 Major Top-Level Modules

```
src/
  platform/       # Five-Plane runtime core
  domains/        # Domain descriptors, onboarding, governance
  interaction/    # NL entry, goal decomposition, dashboard
  org-governance/ # Organization hierarchy, approval routing, SSO
  scale-ecosystem/# Multi-Region, marketplace, integration
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

- `core/` Compatibility layer (no new canonical runtime logic)
- `benchmarks/` Performance testing
- `testing/` Testing tools

## Consequences

Benefits:

- Directory structure clearly maps to architecture
- Easy for developers to locate code
- Supports large-scale team parallel development

Costs:

- Refactoring existing code requires significant cost
- Need to keep synchronized with documentation

## Cross-References

- [ADR-001 Three-Layer Separation Architecture](./001-three-layer-architecture.md)

## Source Sections

- `§35` Recommended Code Directory