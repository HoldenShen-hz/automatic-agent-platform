# ADR-061 Agent Unified Lifecycle Management Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Agents are composed of multiple loosely coupled components, lacking unified version and lifecycle management.

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
| production | Production |
| deprecated | Deprecated |
| retired | Retired |

### Version Management

- Semantic versioning (major.minor.patch)
- Version compatibility check
- Downgrade support

### Deployment Management

- Blue-green deployment
- Canary releases
- Rollback capability

### Component Dependencies

- Dependency relationship graph
- Version compatibility matrix
- Upgrade impact analysis

## Consequences

Advantages:

- Unified management improves maintainability
- Versioning supports rollback
- Dependency management prevents conflicts

Costs:

- Component version coordination is complex
- Lifecycle state machine maintenance costs

## Cross-References

- [ADR-075 Six-Level Controlled Release and Rollout State Machine](./075-controlled-rollout-release.md)
- [ADR-029 OAPEFLIR Controlled Cognition Kernel](./029-oapeflir-controlled-cognition-kernel.md)

## Source Section

- `§61` Agent Unified Lifecycle Management Architecture