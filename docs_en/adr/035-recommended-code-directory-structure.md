# ADR-035 Recommended Code Directory Structure

- Status: Accepted
- Decision Date: 2026-04-17

## Context

Code directory structure needs to correspond to the five-plane architecture, facilitating developers in locating and understanding code.

## Decision

### 9 Top-Level Modules

```
src/
  platform/       # Five-plane runtime core
  domains/        # Domain descriptors, onboarding, registry
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

- `core/` Compatibility layer (do not add new canonical runtime logic here)
- `benchmarks/` Performance testing
- `testing/` Test utilities

## Consequences

Positive:
- Directory structure maps clearly to architecture
- Facilitates code location for developers
- Supports large-scale team parallel development

Negative:
- Refactoring existing code requires significant cost
- Need to keep synchronized with documentation

Trade-offs:
- Structure vs. flexibility
- Consistency vs. effort

## Cross-References

- [ADR-001 Three-Layer Separation of Authority](./001-three-layer-architecture.md)

## Source Sections

- `§35` Recommended Code Directory Structure