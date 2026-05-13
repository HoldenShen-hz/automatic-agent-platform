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

### Lifecycle States (§61.3 reconciliation)

| State | Description |
|------|-------------|
| draft | Draft |
| requirements_locked | Requirements Locked |
| testing | Testing |
| staging | Staging |
| production | Production |
| deprecated | Deprecated |
| retired | Retired |
| archived | Archived |
| superseded | Superseded (terminal state) |

Constraints:
- State transition order: draft → requirements_locked → testing → staging → production → deprecated → retired → archived → superseded
- After requirements_locked, trivial requirement changes are not accepted; must go through change board process
- archived state preserves audit history, cannot be reverted to active
- superseded is terminal state, indicating fully replaced by new version

## v4.3 ADR Remediation

- R3-52: This ADR originally defined 8-state lifecycle (draft/requirements_locked/testing/staging/production/deprecated/retired/archived), root cause being the lifecycle ADR omitted the superseded terminal state. Fix: The main text now adds superseded terminal state, forming a 9-state complete state machine, aligned with §61.3 architecture requirements.

- Semantic versioning (major.minor.patch)
- Version compatibility checking
- Rollback support

### Deployment Management

- Blue-green deployment
- Canary release
- Rollback capability

### Component Dependencies

- Dependency graph
- Version compatibility matrix
- Upgrade impact analysis

## Consequences

Advantages:

- Unified management improves maintainability
- Versioning supports rollback
- Dependency management prevents conflicts

Costs:

- Component version coordination is complex
- Lifecycle state machine maintenance cost

## Cross References

- [ADR-075 Six-Level Controlled Release and Rollout State Machine](./075-controlled-rollout-release.md)
- [ADR-029 OAPEFLIR Controlled Cognition Kernel](./029-oapeflir-controlled-cognition-kernel.md)

## Source Section

- `§61` Agent Unified Lifecycle Management Architecture