# ADR-061 Agent Unified Lifecycle Management Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Agent is composed of multiple loosely coupled components, lacking unified version and lifecycle management.

## Decision

### Agent Entity Model

```typescript
interface AgentEntity {
  agent_id: string;
  name: string;
  version: SemanticVersion;
  components: AgentComponent[];
  lifecycle_state: AgentLifecycleState;
  created_at: string;
  updated_at: string;
  deployed_at?: string;
}

interface AgentComponent {
  component_id: string;
  type: ComponentType;
  version: string;
  config: unknown;
}
```

### Lifecycle States

| State | Description |
|-------|-------------|
| draft | Draft |
| testing | Testing |
| staging | Staging |
| canary | Canary release |
| active | Production |
| paused | Paused |
| deprecated | Deprecated |
| archived | Archived |
| removed | Deleted |

### Version Management

- Semantic versioning (major.minor.patch)
- Version compatibility check
- Downgrade support

### Deployment Management

- Blue-green deployment
- Canary release
- Rollback capability

### Component Dependencies

- Dependency graph
- Version compatibility matrix
- Upgrade impact analysis

## Consequences

Positive:

- Unified management improves maintainability
- Versioning supports rollback
- Dependency management prevents conflicts

Negative:

- Component version coordination is complex
- Lifecycle state machine maintenance cost

## Cross-References

- [ADR-075 Six-Level Controlled Release and Rollout State Machine](./075-controlled-rollout-release.md)
- [ADR-029 OAPEFLIR Controlled Cognition Kernel](./029-oapeflir-controlled-cognition-kernel.md)

## Source Section

- `§61` Agent Unified Lifecycle Management Architecture
